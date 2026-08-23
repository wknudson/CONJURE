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
import { ACTOR_ALPHA_TEST, spriteTexture } from './textures.js';

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

export class BillboardSprite extends THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial> {
  /** Mirrored horizontally — the opposite bearing is the drawn one, flipped. */
  private mirrored = false;

  constructor(texture: THREE.Texture, worldWidth: number, worldHeight: number) {
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
      alphaTest: ACTOR_ALPHA_TEST,
      side: THREE.DoubleSide,
    });
    super(new THREE.PlaneGeometry(worldWidth, worldHeight), material);
    // Shift the geometry up so `position.y` sits at the feet, which is what every caller
    // means by "where it is standing".
    this.geometry.translate(0, worldHeight / 2, 0);
    this.castShadow = true;
    this.receiveShadow = false;
  }

  /** Cylindrical billboarding: Y only. */
  faceCamera(cam: THREE.Camera): void {
    this.rotation.y = Math.atan2(
      cam.position.x - this.position.x,
      cam.position.z - this.position.z,
    );
  }

  setTexture(texture: THREE.Texture): void {
    if (this.material.map !== texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
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
    this.scale.x = on ? -1 : 1;
  }
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
 * is a property of the walk and not of how many drawings happen to be in it — the two-frame
 * fallback and the four-entry cycle cover the same 1.8 units, which is the figure the old
 * two-frame version shipped with and which reads as a walk at six units a second.
 */
export const GAIT_CYCLE_DISTANCE = 1.8;

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
  /** Source aspect of the front frame, so the plane is not forced into a box. */
  aspect: number;
}

export function buildActorArt(
  images: {
    front: HTMLImageElement;
    back: HTMLImageElement;
    side: HTMLImageElement;
    /** The authored walk frames in file order; arranged into playback order here. */
    sideWalk?: readonly HTMLImageElement[];
  },
  maxAnisotropy: number,
): ActorArt {
  const authored = images.sideWalk ?? [];
  // One texture per authored frame, then the order applied over them — so a frame the cycle
  // uses twice is uploaded once and appears twice by reference.
  const made = authored.map((img) => spriteTexture(img, maxAnisotropy));
  // The reorder only applies to a set that can actually satisfy it. Anything shorter — the
  // two-pose fallback — plays in file order, because filtering the order down would drop a
  // frame and double another, which is a stranger walk than the one it set out to fix.
  const reorderable = SIDE_WALK_ORDER.every((i) => i < made.length);
  const sideWalk = reorderable ? SIDE_WALK_ORDER.map((i) => made[i]!) : made;
  return {
    front: spriteTexture(images.front, maxAnisotropy),
    back: spriteTexture(images.back, maxAnisotropy),
    side: spriteTexture(images.side, maxAnisotropy),
    sideWalk,
    aspect: images.front.width / images.front.height,
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
  aspect: number,
): ActorArt {
  return { front, back, side, sideWalk: [], aspect };
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
  private facing: Facing = 'down';
  private walked = 0;

  constructor(art: ActorArt, height: number) {
    this.art = art;
    this.sprite = new BillboardSprite(art.front, height * art.aspect, height);
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
      this.applyFrame();
      return;
    }
    this.walked += dist;
    this.facing = pickFacing(dx, dz, cameraYaw);
    this.applyFrame();
  }

  /** Turns on the spot without moving — used when an NPC should look at you. */
  face(facing: Facing): void {
    this.facing = facing;
    this.walked = 0;
    this.applyFrame();
  }

  private applyFrame(): void {
    const sideways = this.facing === 'left' || this.facing === 'right';
    // The one flip, taken against the one declared fact about the art. Nothing else mirrors.
    this.sprite.setMirrored(sideways && this.facing !== SIDE_ART_FACES);

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
    const frame = Math.floor((this.walked / GAIT_CYCLE_DISTANCE) * cycle.length) % cycle.length;
    this.sprite.setTexture(cycle[frame] ?? this.art.side);
  }
}
