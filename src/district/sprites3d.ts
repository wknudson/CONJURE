/**
 * Flat sprites standing up in a lit 3D scene.
 *
 * The whole HD-2D trick lives in two decisions here. The plane rotates on Y only, so it
 * turns to face the camera horizontally but never tips as the camera pitches — full
 * `lookAt` would lay the figures back like cards and the illusion goes with it. And the
 * material cuts out on alpha rather than blending, which keeps the silhouette hard and
 * lets the plane throw a real shadow with a hole in the middle of it.
 */

import * as THREE from 'three';
import { ACTOR_ALPHA_TEST, sheetFrameTexture, spriteTexture } from './textures.js';
import {
  WALK_SHEET_CONTENT,
  WALK_SHEET_FRAMES,
  WALK_SHEET_GAIT_CYCLES,
  walkFrameCell,
} from '../render/sprites.js';

/** The four frames an actor can be drawn in, before mirroring. */
export type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Which way the side-on art is actually drawn.
 *
 * Every side-facing frame the Commander has — the standing pose and all four walk frames,
 * both bearings — is drawn facing **left**. One declared fact, mirrored against by the one
 * flip below, so if the art is ever redrawn the other way this constant is the only edit.
 *
 * It was previously assumed to face right and mirrored on that assumption, which turned the
 * Commander around: walking left drew the left-facing art flipped to face right, and walking
 * right drew it unflipped, still facing left. Wrong in both directions at once, which is
 * exactly why it survived — there was no correct case on screen to compare against.
 */
export const SIDE_ART_FACES: Facing = 'left';

/**
 * The one clock every swaying thing in the world reads.
 *
 * A single shared uniform object, handed to every patched material rather than one per sprite.
 * That is not only cheaper — it is what keeps them all in the *same wind*. A field of reeds each
 * running its own clock is a field of reeds each in its own weather, and the eye reads that as
 * malfunction rather than as breeze.
 *
 * Written once a frame by `DistrictScreen`. Nothing else may touch it.
 */
const WIND = { value: 0 };

export function setWindTime(t: number): void {
  WIND.value = t;
}

/**
 * Makes a Lambert material bend in the wind.
 *
 * A vertex offset patched into the stock shader rather than a material of our own, which keeps
 * the lighting, the fog, the alpha cutout and the shadow exactly as they were — everything this
 * file's opening paragraph says the trick depends on. `onBeforeCompile` is the supported seam
 * for precisely this.
 *
 * Three details, each of which was wrong in a draft:
 *
 *  - **The weight is `position.y` squared.** Every plane this is applied to spans y 0..1 with
 *    the base at zero, so `position.y` is already "how far up this vertex is" with no extra
 *    attribute. Squaring it pins the base hard and puts nearly all the movement in the top
 *    third, which is how a stem actually bends; the linear version slides the whole plant
 *    sideways and its foot leaves the ground.
 *  - **The phase comes from the object's own world position**, read out of `modelMatrix`, so no
 *    two plants standing in one clearing move together and none of them needs a uniform of its
 *    own. Identical shader source for every instance, so three.js compiles one program.
 *  - **The offset is in local x**, which the billboard rotation then carries — so a plant sways
 *    across the screen whichever way the camera is orbited, rather than disappearing into the
 *    depth axis at ninety degrees. On a fixed `panel` it is the hanging direction, which is the
 *    right axis for a washing line too.
 */
export function applySway(material: THREE.Material, amount: number, height = 1): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND;
    shader.uniforms.uSway = { value: amount };
    shader.uniforms.uTall = { value: Math.max(1e-4, height) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uWind;\nuniform float uSway;\nuniform float uTall;',
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float swayPhase = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.53;',
          // Normalised, and that `uTall` is the whole of this fix. A `BillboardSprite` is a unit
          // plane sized by `scale`, so its `position.y` runs 0..1 and squaring it is a weight.
          // A `panel` is not: `addDressing` builds its geometry at full size, so an awning's
          // `position.y` runs 0..3 and the square of that is *nine* -- which put a 0.8-unit
          // swing on a stall awning and made the washing lines whip. Both forms now agree that
          // the top of the plane is 1.0.
          'float swayLean = (position.y / uTall) * (position.y / uTall);',
          // Two frequencies summed: a slow body to the gust and a quicker flutter over it. A
          // single sine is a metronome, and a plant on a metronome reads as a toy.
          'float swayAmt = sin(uWind * 1.1 + swayPhase) * 0.7 + sin(uWind * 2.7 + swayPhase * 1.7) * 0.3;',
          'transformed.x += swayAmt * uSway * swayLean;',
        ].join('\n'),
      );
  };
  // Forces the program to be rebuilt with the patch. Without it the mesh keeps whatever shader
  // it compiled on its first frame and nothing moves -- silently.
  material.needsUpdate = true;
}

export class BillboardSprite extends THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial> {
  /** Mirrored horizontally — the opposite bearing is the drawn one, flipped. */
  private mirrored = false;
  private readonly worldHeight: number;
  private worldWidth: number;

  /**
   * Built on a unit plane and sized by `scale`, rather than baked into the geometry.
   *
   * Because the width has to change with the picture. A body is not the same width from the
   * front as it is from the side — 110px against 76px for the Commander — and one plane cut
   * to the front's proportions was stretching the side-on figure 45% wider than it was drawn.
   * Sizing by scale lets `setTexture` correct it per frame at no cost, and the mirror is the
   * sign of the same number it was always the sign of.
   */
  constructor(texture: THREE.Texture, worldHeight: number, castsShadow = true) {
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
      alphaTest: ACTOR_ALPHA_TEST,
      side: THREE.DoubleSide,
    });
    // A 1x1 plane lifted so it spans y 0..1: scaled, its bottom edge stays on `position.y`,
    // which is what every caller means by "where it is standing".
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);
    super(geometry, material);
    this.worldHeight = worldHeight;
    this.worldWidth = worldHeight * aspectOf(texture);
    this.applyScale();
    // Off for art that already has a shadow painted into it. The townsfolk sheets are drawn
    // with their own ground contact, and a plane throwing a second one puts two shadows under
    // one pair of boots pointing in different directions.
    this.castShadow = castsShadow;
    this.receiveShadow = false;
  }

  private applyScale(): void {
    this.scale.set(this.mirrored ? -this.worldWidth : this.worldWidth, this.worldHeight, 1);
  }

  /**
   * Makes this billboard bend in the wind. See `applySway`.
   *
   * No height is passed because there is nothing to normalise: the geometry here is a unit
   * plane and the size lives in `scale`, which is exactly the case `applySway` defaults to.
   */
  setSway(amount: number): void {
    applySway(this.material, amount);
  }

  /** Cylindrical billboarding: Y only. */
  faceCamera(cam: THREE.Camera): void {
    this.rotation.y = Math.atan2(
      cam.position.x - this.position.x,
      cam.position.z - this.position.z,
    );
  }

  /** Swaps the picture, and the plane's width with it, so nothing is ever stretched. */
  setTexture(texture: THREE.Texture): void {
    if (this.material.map === texture) return;
    this.material.map = texture;
    this.material.needsUpdate = true;
    const width = this.worldHeight * aspectOf(texture);
    if (width !== this.worldWidth) {
      this.worldWidth = width;
      this.applyScale();
    }
  }

  /**
   * Flips the art without touching the billboard rotation.
   *
   * A negative X scale composes with the Y rotation cleanly because `DoubleSide` means the
   * now-inverted winding still draws. Mirroring at the texture instead would leak into the
   * right-facing frame, since both facings share one material.
   */
  setMirrored(on: boolean): void {
    if (this.mirrored === on) return;
    this.mirrored = on;
    this.applyScale();
  }

  /**
   * Tints the sprite, for a lustrous beast.
   *
   * `material.color` multiplies the texture, which is the cheapest correct way to recolour a
   * pixel-art billboard: no second texture to load, no shader variant to compile, and it
   * survives every `setTexture` because the colour lives on the material rather than on the
   * picture. Multiplication can only darken channels, so the tint is a *shift* — warm gold,
   * cool violet — rather than a brightening, and the sprite stays readable as itself.
   *
   * Deliberately not a hue-rotate filter: those are a CSS idea, and this is a WebGL mesh.
   */
  setTint(color: number | null): void {
    this.material.color.set(color ?? 0xffffff);
  }
}

/**
 * A texture's own proportions, read off whatever it wraps.
 *
 * An `Image` for a loaded PNG, a `<canvas>` for a sheet slice or the Warden's drawn frames —
 * both carry `width`/`height`, so the plane can follow the picture without anyone having to
 * declare the number twice and let the two drift.
 */
function aspectOf(texture: THREE.Texture): number {
  const src = texture.image as { width?: number; height?: number } | null | undefined;
  if (!src?.width || !src.height) return 1;
  return src.width / src.height;
}

/**
 * Which frame to draw, from a world-space movement vector.
 *
 * Projected onto the *screen* axes rather than the world ones, so authored four-way art
 * stays correct as the camera orbits: walking north-east reads as "right" when the camera
 * is behind you and as "up" when it has swung ninety degrees.
 */
export function pickFacing(mx: number, mz: number, cameraYaw: number): Facing {
  const screenRight = mx * Math.cos(cameraYaw) - mz * Math.sin(cameraYaw);
  const screenAway = -mx * Math.sin(cameraYaw) - mz * Math.cos(cameraYaw);
  return Math.abs(screenAway) > Math.abs(screenRight)
    ? screenAway > 0
      ? 'up'
      : 'down'
    : screenRight > 0
      ? 'right'
      : 'left';
}

/**
 * Where a movement vector points on screen, in degrees: 0 toward the camera, 90 to the
 * right, 180 away, 270 to the left. The continuous form of `pickFacing`'s four-way answer.
 */
export function screenAngleDeg(mx: number, mz: number, cameraYaw: number): number {
  const screenRight = mx * Math.cos(cameraYaw) - mz * Math.sin(cameraYaw);
  const screenAway = -mx * Math.sin(cameraYaw) - mz * Math.cos(cameraYaw);
  const deg = (Math.atan2(screenRight, -screenAway) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** The screen angle each facing actually depicts. */
export const FACING_CENTRES: Record<Facing, number> = { down: 0, right: 90, up: 180, left: 270 };

/** Smallest angle between two bearings, either way round the circle. Always 0..180. */
export function angleGap(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

/**
 * How facing is chosen, live-switchable from the debug panel so the two fixes can be felt
 * against each other rather than argued about.
 *
 * - `raw`        — what shipped: re-decide from the frame's vector, every frame.
 * - `hysteresis` — make the current facing keep the boundary until the direction is clearly past it.
 * - `smoothing`  — average the direction vector before deciding.
 * - `both`       — smoothing feeding hysteresis.
 */
export const FACING = {
  mode: 'hysteresis' as 'raw' | 'hysteresis' | 'smoothing' | 'both',
  /**
   * Degrees a direction must travel *past* a sector boundary before the facing gives way.
   * Fifteen either side of the line makes a thirty-degree band in which the facing sticks.
   */
  hysteresisDeg: 15,
  /** Ground over which the smoothed direction catches up to the real one. */
  smoothDistance: 0.35,
};

/**
 * `pickFacing`, but the incumbent gets to keep the boundary.
 *
 * A body only turns once the direction is more than `hysteresisDeg` past the line where the
 * sectors meet, so a direction sitting *on* the line holds whatever it was already showing
 * instead of being re-decided from scratch every frame.
 *
 * This is a stability fix and not a correctness one. On the boundary there is no correct
 * answer to find — see `SIDE_ART_FACES` and the note on diagonal art — so what this buys is
 * that the wrong answer at least stops changing sixty times a second.
 */
export function holdFacing(
  mx: number,
  mz: number,
  cameraYaw: number,
  current: Facing,
  marginDeg: number = FACING.hysteresisDeg,
): Facing {
  const proposed = pickFacing(mx, mz, cameraYaw);
  if (proposed === current) return current;
  const drift = angleGap(screenAngleDeg(mx, mz, cameraYaw), FACING_CENTRES[current]);
  return drift > 45 + marginDeg ? proposed : current;
}

/**
 * Playback order for the side-on walk, as indices into the authored frames.
 *
 * Not `[0, 1, 2, 3]`, and the reason is in the art rather than the code. Measured at the
 * ground line, the gap between the two boots across the four frames runs 35, 10, 31, 34
 * pixels (the female set: 37, 11, 34, 35). A walk alternates spread, together, spread,
 * together — one passing pose per footfall. What is drawn is spread, together, spread,
 * *spread*: frame 3 is a third stride pose rather than the second passing pose the cycle
 * needs, and only 41% of the body changes between frames 2 and 3 against 69% between 1
 * and 2. Played in file order it hitches through its second half.
 *
 * So frame 1 — the one real passing pose — carries both footfalls, and frame 3 is left out.
 * Two strides, two passes, even rhythm. The reused pass does not swap which leg leads, but
 * at the size a Commander occupies on the street that is invisible, where the hitch is not.
 *
 * Change this to `[0, 1, 2, 3]` the moment frame 3 is redrawn as a passing pose. That is the
 * whole fix — nothing else here knows or cares how many frames there are.
 */
export const SIDE_WALK_ORDER: readonly number[] = [0, 1, 2, 1];

/**
 * Ground covered by one complete gait cycle, whatever it is made of.
 *
 * Distance rather than time, for the same reason the rest of this class works that way: the
 * legs and the ground have to agree. Expressed per *cycle* rather than per frame so cadence
 * is a property of the walk and not of how many drawings happen to be in it.
 *
 * It was 1.8, inherited from the two-pose shuffle, and at a move speed of six units a second
 * that is three and a third gait cycles every second — a sprint cadence, seventy-five
 * milliseconds a frame. With three distinct poses to show, the eye does not read that as
 * legs; it reads it as a flicker. Four units puts it at one and a half cycles a second and
 * about a sixth of a second a frame, which is where hand-drawn walks usually sit.
 *
 * The cost is a longer stride than the art depicts, so the boots skate a little. That is the
 * honest trade at this move speed, and it is far less noticeable than the flicker was. The
 * lever for fixing it properly is `MOVE_SPEED`, not this.
 */
export const GAIT_CYCLE_DISTANCE = 4.0;

/**
 * How far a walking body rises between footfalls, as a fraction of its own height.
 *
 * Frames can only ever step; this is what makes the motion between them continuous. Because
 * the rise is driven by the same distance the frames are, it peaks exactly on the two passing
 * poses and returns to the ground on the two strides — so it reinforces the cycle instead of
 * beating against it, and a body with no walk frames at all (a companion) still reads as
 * walking rather than sliding.
 */
export const WALK_BOB_RISE = 0.022;

/**
 * One actor's art: a texture per facing, plus the side-on walk frames if it has any.
 *
 * `sideWalk` holds textures **in playback order**, already arranged by `SIDE_WALK_ORDER`, so
 * one texture can appear twice and `Walker` need only index. It is empty for a companion, a
 * Warden, or a Commander whose walk art failed to load, and the walk then quietly does
 * nothing rather than needing a branch at every call.
 */
export interface ActorArt {
  front: THREE.Texture;
  back: THREE.Texture;
  side: THREE.Texture;
  sideWalk: readonly THREE.Texture[];
  /**
   * How many complete gait cycles `sideWalk` spans.
   *
   * One for a hand-listed cycle; two for the twenty-frame sheet, which holds four steps. The
   * frame count alone cannot say this, and guessing it wrong is what decouples the legs from
   * the ground — twenty frames read as one cycle would swing them at half the speed the
   * pavement goes past.
   */
  walkGaitCycles: number;
  /**
   * Whether `side` is a genuine profile that may be flipped for the other bearing.
   *
   * True for everything drawn in four views, and the flip against `SIDE_ART_FACES` is what
   * gets both side facings out of one drawing. False for art that has **no side view at
   * all** — a townsperson cut from a sheet is one front-on portrait standing in for all
   * three facings, and mirroring it does not turn them round, it just swaps the bard's lute
   * into his other hand and reverses the guard's halberd every time the player walks past.
   *
   * Stated on the art because it is a fact about the art. The alternative was a flag on
   * every body that owns some, which is the same fact written down in more places.
   */
  mirrorSide?: boolean;
}

export function buildActorArt(
  images: {
    front: HTMLImageElement;
    back: HTMLImageElement;
    side: HTMLImageElement;
    /** The authored walk frames in file order; arranged into playback order here. */
    sideWalk?: readonly HTMLImageElement[];
    /** Gait cycles those frames span. Omit for one. */
    walkGaitCycles?: number;
  },
  maxAnisotropy: number,
): ActorArt {
  const authored = images.sideWalk ?? [];
  // One texture per authored frame, then the order applied over them — so a frame the cycle
  // uses twice is uploaded once and appears twice by reference.
  const made = authored.map((img) => spriteTexture(img, maxAnisotropy));
  // The reorder applies to exactly the four-frame set it was measured against, and nothing
  // else. Shorter — the two-pose fallback — has no frame 2 to name. Longer is a sheet, whose
  // frames are already a real cycle; running `[0, 1, 2, 1]` over twenty of them would throw
  // away seventeen and stutter on the rest. Everything but the four plays in file order.
  const reorderable = made.length === 4;
  const sideWalk = reorderable ? SIDE_WALK_ORDER.map((i) => made[i]!) : made;
  return {
    front: spriteTexture(images.front, maxAnisotropy),
    back: spriteTexture(images.back, maxAnisotropy),
    side: spriteTexture(images.side, maxAnisotropy),
    sideWalk,
    walkGaitCycles: images.walkGaitCycles ?? 1,
  };
}

/**
 * The same, from a walk sprite sheet instead of a folder of frames.
 *
 * Every cell is cut once, here, into an ordinary texture — so from `Walker`'s point of view a
 * sheet-backed walk and a file-backed one are the same thing, and none of the cycle machinery
 * has to learn what a sheet is. Twenty slices of the content box cost about a megabyte all
 * told, against five for holding the whole 1280x1024 sheet on the card, so this is also the
 * cheaper of the two.
 *
 * All twenty are cut to the same box rather than to their own bounds, which is what stops the
 * figure resizing every frame and keeps the animator's vertical travel in the picture.
 */
export function buildSheetActorArt(
  images: {
    front: HTMLImageElement;
    back: HTMLImageElement;
    side: HTMLImageElement;
    sheet: HTMLImageElement;
  },
  maxAnisotropy: number,
): ActorArt {
  const c = WALK_SHEET_CONTENT;
  const sideWalk: THREE.Texture[] = [];
  for (let i = 0; i < WALK_SHEET_FRAMES; i++) {
    const cell = walkFrameCell(i);
    sideWalk.push(
      sheetFrameTexture(images.sheet, cell.x + c.x, cell.y + c.y, c.w, c.h, maxAnisotropy),
    );
  }
  return {
    front: spriteTexture(images.front, maxAnisotropy),
    back: spriteTexture(images.back, maxAnisotropy),
    side: spriteTexture(images.side, maxAnisotropy),
    sideWalk,
    walkGaitCycles: WALK_SHEET_GAIT_CYCLES,
  };
}

/**
 * The same thing from textures that were drawn rather than loaded.
 *
 * The Warden's frames come off a canvas already filtered for pixel art, so they must not
 * go through `spriteTexture` — that would blur exactly the hard edges they are drawn to
 * have.
 */
export function actorArtFromTextures(
  front: THREE.Texture,
  back: THREE.Texture,
  side: THREE.Texture,
): ActorArt {
  return { front, back, side, sideWalk: [], walkGaitCycles: 1 };
}

/**
 * One drawing, standing in for every facing.
 *
 * What a townsperson gets. The sheets hold a single front-on portrait each, so there is no
 * back and no profile to give: the same texture answers all three, the walk is empty, and
 * `mirrorSide` is off so turning toward the player changes which way they *look* without
 * flipping what they are holding.
 *
 * `disposeActorArt` already de-dupes through a Set, so one texture named three times here is
 * still released exactly once.
 */
export function actorArtFromOne(tex: THREE.Texture): ActorArt {
  return { front: tex, back: tex, side: tex, sideWalk: [], walkGaitCycles: 1, mirrorSide: false };
}

/**
 * The same one-picture trick, but for something that *should* flip.
 *
 * The only difference from `actorArtFromOne` is `mirrorSide`, and the reason is the difference
 * between a person and an animal. A townsperson is drawn front-on holding something, so flipping
 * them swaps the bard's lute into his other hand — hence `false` up there. An animal is drawn in
 * profile, and a fox walking the other way *is* the same fox mirrored. Turning the flip off for
 * one would mean every fox in the world faces left forever, including the ones running east.
 */
export function actorArtFromProfile(tex: THREE.Texture): ActorArt {
  return { front: tex, back: tex, side: tex, sideWalk: [], walkGaitCycles: 1, mirrorSide: true };
}

export function disposeActorArt(art: ActorArt): void {
  // A Set because the walk order reuses one frame for both footfalls, so the same texture
  // appears twice in `sideWalk` and must still be released exactly once.
  const seen = new Set<THREE.Texture>([art.front, art.back, art.side, ...art.sideWalk]);
  for (const tex of seen) tex.dispose();
}

/**
 * A body that walks: a billboard plus the art to draw it with, and enough state to run a
 * two-frame walk cycle off distance travelled rather than off a timer.
 *
 * Distance rather than time so the legs and the ground agree — a figure that walks into a
 * wall stops animating instead of jogging on the spot.
 */
export class Walker {
  readonly sprite: BillboardSprite;
  private readonly art: ActorArt;
  private readonly height: number;
  private facing: Facing = 'down';
  private walked = 0;
  /** Smoothed direction, and whether it holds anything worth easing from. */
  private smoothX = 0;
  private smoothZ = 0;
  private moving = false;

  constructor(art: ActorArt, height: number, castsShadow = true) {
    this.art = art;
    this.height = height;
    this.sprite = new BillboardSprite(art.front, height, castsShadow);
  }

  get position(): THREE.Vector3 {
    return this.sprite.position;
  }

  /** Reports movement since the last frame and redraws accordingly. */
  step(dx: number, dz: number, cameraYaw: number): void {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) {
      // Standing still: hold the frame, but reset the cycle so the next step starts on the
      // planted foot rather than mid-stride.
      this.walked = 0;
      this.moving = false;
      this.applyFrame();
      return;
    }
    this.walked += dist;

    // Direction only — speed has no business in a facing decision, and normalising here
    // means the smoothing below averages bearings rather than bearings-times-framerate.
    const nx = dx / dist;
    const nz = dz / dist;
    let ux = nx;
    let uz = nz;

    if (FACING.mode === 'smoothing' || FACING.mode === 'both') {
      if (!this.moving) {
        // First step out of a standstill: start on the real direction, so the body does not
        // spend its first stride easing out of whichever way it last happened to be walking.
        this.smoothX = nx;
        this.smoothZ = nz;
      } else {
        // Keyed on distance, like everything else here, which makes it framerate-independent
        // without `step` having to be told the frame time.
        const a = 1 - Math.exp(-dist / FACING.smoothDistance);
        this.smoothX += (nx - this.smoothX) * a;
        this.smoothZ += (nz - this.smoothZ) * a;
      }
      const len = Math.hypot(this.smoothX, this.smoothZ) || 1;
      ux = this.smoothX / len;
      uz = this.smoothZ / len;
    }
    this.moving = true;

    this.facing =
      FACING.mode === 'hysteresis' || FACING.mode === 'both'
        ? holdFacing(ux, uz, cameraYaw, this.facing)
        : pickFacing(ux, uz, cameraYaw);
    this.applyFrame();
  }

  /** Turns on the spot without moving — used when an NPC should look at you. */
  face(facing: Facing): void {
    this.facing = facing;
    this.walked = 0;
    this.moving = false;
    this.applyFrame();
  }

  /**
   * How far off the ground the body is, this instant.
   *
   * Zero while standing, so an idle body sits flat and whatever owns it can put its own idle
   * bob there without the two fighting. `abs(sin)` for the same reason the canvas gait uses
   * it: it touches down at each footfall and never goes negative, so nobody sinks through
   * the pavement.
   */
  get bob(): number {
    if (this.walked === 0) return 0;
    const phase = this.walked / GAIT_CYCLE_DISTANCE;
    return Math.abs(Math.sin(phase * Math.PI * 2)) * this.height * WALK_BOB_RISE;
  }

  private applyFrame(): void {
    // Continuous, unlike the frames — this is what carries the eye between them.
    this.sprite.position.y = this.bob;

    const sideways = this.facing === 'left' || this.facing === 'right';
    // The one flip, taken against the one declared fact about the art. Nothing else mirrors —
    // and art that declares it has no side view is never flipped at all.
    const mayMirror = this.art.mirrorSide !== false;
    this.sprite.setMirrored(mayMirror && sideways && this.facing !== SIDE_ART_FACES);

    if (this.facing === 'up') {
      this.sprite.setTexture(this.art.back);
      return;
    }
    if (!sideways) {
      this.sprite.setTexture(this.art.front);
      return;
    }

    const cycle = this.art.sideWalk;
    if (cycle.length === 0) {
      // No walk art — the standing profile, which is what a companion and the Warden get.
      this.sprite.setTexture(this.art.side);
      return;
    }
    // Frames per gait cycle, not frames per loop — a sheet holding two cycles must advance
    // twice as fast through its list to keep pace with the same ground.
    const perCycle = cycle.length / Math.max(1, this.art.walkGaitCycles);
    const frame = Math.floor((this.walked / GAIT_CYCLE_DISTANCE) * perCycle) % cycle.length;
    this.sprite.setTexture(cycle[frame] ?? this.art.side);
  }
}
