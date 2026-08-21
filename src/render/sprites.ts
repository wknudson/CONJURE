/**
 * Procedural 2D sprites, drawn from a `CharacterLook`.
 *
 * There is no art in this project — every body on the combat board is canvas shapes out of
 * `palette.ts` — so the creator draws its actors the same way rather than inventing a
 * second visual language that the game would then fail to live up to.
 *
 * Two things make these read as *pixel* sprites rather than as vector illustration, and
 * they are worth naming because neither is about the drawing:
 *
 *  1. **They are rendered into a small buffer and blitted up with smoothing off.** A figure
 *     ~89px tall on screen is painted at 44 art-pixels and doubled. That quantisation is
 *     most of the HD-2D read: smooth anti-aliased curves at final size look like vector art
 *     however well they are lit, and no amount of extra shape detail fixes it.
 *  2. **Most of the body is axis-aligned rectangles on integer coordinates.** Rects land on
 *     pixel boundaries exactly, which is the pixel-art idiom and the reason a 2px forearm
 *     stays a crisp 2px forearm instead of a grey smear.
 *
 * `paintCommander` is the shape code and takes any 2D context, so it is testable without a
 * DOM. `drawCommander` is the buffered wrapper the game actually calls.
 *
 * Everything is drawn in **sprite units**: feet at the origin, up is negative, and `unit` is
 * roughly a tile height. The figure stands `FIGURE` units tall.
 */

import { PALETTE } from './palette.js';
import type { CharacterLook } from '../core/data/characterLook.js';
import {
  FACE_PRESETS,
  HAIR_PRESETS,
  HAIR_TONES,
  SKIN_TONES,
  clampPreset,
} from '../core/data/characterLook.js';
import type { School } from '../contract/ids.js';

/** A school's colour on the stage. The same six the enrolment crests use. */
export const SCHOOL_COLOR: Record<string, string> = {
  pyre: '#D9643A',
  frost: '#6FB6D8',
  surge: '#D9C04A',
  bulwark: '#9A9086',
  dusk: '#9A6FC4',
  bloom: '#79B45C',
};

/**
 * The Commander's own value ramp.
 *
 * Exported so the ordering rule can be *tested* against the real values rather than against
 * a copy of them pasted into an assertion.
 *
 * Named rather than inlined because these have to be read *against each other* to stay
 * legible: the lit panel must sit above the shadow panel, and the ink line must sit below
 * both — but not far below, or an outline darker than the form reads as a void. Editing one
 * in isolation is how a sprite goes flat.
 */
export const RAMP = {
  // The coat: a genuinely saturated blue, in three discrete bands rather than two.
  //
  // The whole ramp used to live inside a narrow navy-slate spread — coat `#3D4A60`, cloak
  // `#3B3A6B`, trousers `#3A3550` — which is four garments in one hue family and reads as a
  // monochrome silhouette however carefully each one is shaded. Every value below now sits
  // in a *different* hue family from the ones it touches, and the jumps between them are
  // large enough to survive being quantised to a 48-pixel grid.
  coatLight: '#3F76C4',
  coatMid: '#2E5495',
  coatDark: '#1C3A69',
  coatInk: '#24304A',

  brass: '#E8C860',
  brassLit: '#FFF0B8',
  /** Key light, warm and low. */
  rim: '#FFF6D8',

  /** The Magistracy's own crimson, worn until a discipline is vowed to. */
  cloak: '#8E2F3F',

  /**
   * Legs, in a **warm** dark — deliberately a different hue family from the blue coat above
   * them and the tan boots below, so all three read as separate blocks rather than as one
   * tonal slide.
   *
   * The first value here was `#2A2F3A`, byte-identical to `PALETTE.tileA`: the legs were the
   * exact colour of the floor they stand on.
   */
  trouser: '#4A3826',
  trouserDark: '#2E2318',
  /** Lighter than the trouser, which is the only reason a boot reads as a separate thing. */
  boot: '#8A6A44',


  // -------------------------------------------------------- secondary detail
  //
  // Every one of these is a **one-pixel mark**. At this resolution that is not a limitation
  // to work around, it is the unit of the medium: an eyebrow is one pixel, a cuff is one
  // pixel, a boot sole is one pixel. What they buy is the difference between a shape with
  // colour blocks on it and a thing that looks made.

  /**
   * Inside the eye, top-left, where the key light catches a wet surface.
   *
   * Brighter and cooler than `rim`, and deliberately its own value: a specular hit on an eye
   * is not the same light as a warm edge on cloth. They were the same hex to begin with,
   * which was defensible as "one key light" right up until nothing could tell the catchlight
   * and the rim apart — including a test that then measured the arm rim as an eye.
   */
  eyeLit: '#FFFDF2',
  /** Eyes, brows, and the mouth line. Warmer than the coat's ink so a face is not machinery. */
  faceInk: '#2A1D1C',
  /** Seams, cuffs and the boot sole — one value below whatever they divide. */
  seam: '#171E2E',
} as const;

const COAT_LIGHT = RAMP.coatLight;
const COAT_MID = RAMP.coatMid;
const COAT_DARK = RAMP.coatDark;
const COAT_INK = RAMP.coatInk;
const BRASS = RAMP.brass;
const BRASS_LIT = RAMP.brassLit;
const RIM = RAMP.rim;

/**
 * How tall the figure stands, in `unit`s.
 */
const FIGURE = 1.15;

/**
 * The art grid.
 *
 * 48 tall against ~89 on screen. Raised from 44 for one reason: **the face.** At 44 the head
 * came out four pixels across and the eye dots were 0.6px — drawn, and literally sub-pixel,
 * which is why the sprite read as facing away when it has been facing forward all along. A
 * feature that cannot occupy a whole pixel does not exist.
 */
const ART_H = 48;
const ART_W = 36;

/**
 * Landmarks down the body, as a fraction of figure height measured **up from the feet**.
 *
 * Rebuilt around a **1:4** head. The previous table was 1:5.3, chasing anatomical realism,
 * and that is the wrong idiom: the reference sprites — and every 16-bit RPG sprite — carry
 * big heads precisely because the head is where all the identity lives and a realistic one
 * has no room for a face. Legibility beats proportion at this size.
 *
 * There is deliberately no `neck` entry. A landmark for it looked right and drew a hole:
 * the neck has to be measured off the **head**, from wherever the chin actually lands down
 * to the collar, or the two disagree by a pixel or two and the figure gets a gap through it.
 */
const Y = {
  boot: 0.14,
  hem: 0.4,
  waist: 0.54,
  shoulder: 0.68,
  chin: 0.74,
} as const;



/**
 * A rectangle snapped to the pixel grid, never smaller than a pixel.
 *
 * Every secondary mark goes through this. The rule the sprite keeps learning is that a
 * feature which cannot occupy a whole pixel does not exist — the eye dots were 0.6px, the
 * brass was a 3px triangle that measured zero, the rim light was a translucent stroke worth
 * 28 pixels on the whole figure. `Math.max(1, ...)` is that lesson, enforced.
 */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Rasterised sprites, keyed on everything that changes one. */
const CACHE = new Map<string, HTMLCanvasElement>();

/**
 * The Commander, as the diorama sees them — buffered and quantised.
 *
 * Cached on the look, because the buffer is identical every frame until the player clicks
 * something, and re-rasterising 34x44 sixty times a second to produce the same result is
 * work with no observable difference.
 */
export function drawCommander(
  ctx: CanvasRenderingContext2D,
  unit: number,
  look: CharacterLook,
  accent?: string | null,
): void {
  const h = unit * FIGURE;
  const w = h * (ART_W / ART_H);

  const buf = buffer(look, accent ?? null);
  if (!buf) {
    // Nothing to rasterise into. Paint straight through at full size rather than refusing —
    // the un-quantised drawing is the right fallback for a headless caller, which wants the
    // shapes rather than the pixels.
    paintCommander(ctx, unit, look, accent);
    return;
  }

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, -w / 2, -h, w, h);
  ctx.imageSmoothingEnabled = smoothing;
}

/** The rasterised sprite for a look, or null where there is nothing to rasterise into. */
function buffer(look: CharacterLook, accent: string | null): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const key = [
    look.gender,
    clampPreset(look.hairPreset, HAIR_PRESETS.length),
    clampPreset(look.facePreset, FACE_PRESETS.length),
    clampPreset(look.skinPreset, SKIN_TONES.length),
    accent ?? '-',
  ].join('|');

  const hit = CACHE.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  const g = c.getContext('2d');
  if (!g) return null;

  g.translate(ART_W / 2, ART_H);
  paintCommander(g, ART_H / FIGURE, look, accent);

  // Bounded, so cycling presets for ten minutes cannot grow this without limit. Six hairs by
  // four faces by two bearings by seven accents is 336 at the absolute worst.
  if (CACHE.size > 400) CACHE.clear();
  CACHE.set(key, c);
  return c;
}

/**
 * The shapes. Feet at the origin, up is negative.
 *
 * Split from `drawCommander` so it can be handed a recording context and tested without a
 * DOM — and so the buffered path and the fallback path are provably the same drawing.
 */
export function paintCommander(
  ctx: CanvasRenderingContext2D,
  unit: number,
  look: CharacterLook,
  accent?: string | null,
): void {
  const hair = HAIR_PRESETS[clampPreset(look.hairPreset, HAIR_PRESETS.length)]!;
  const faceIdx = clampPreset(look.facePreset, FACE_PRESETS.length);
  const skin = SKIN_TONES[clampPreset(look.skinPreset, SKIN_TONES.length)]!;
  const hairTone = HAIR_TONES[clampPreset(look.hairPreset, HAIR_TONES.length)]!;

  const H = unit * FIGURE;
  const p = (v: number): number => Math.round(v);
  const up = (f: number): number => p(-H * f);

  // The two bearings differ in shoulder width and coat flare and in nothing else — enough to
  // read at this size, and not a claim the art cannot keep.
  const broad = look.gender === 'male';
  const shoulder = Math.max(4, p(H * (broad ? 0.125 : 0.105)));
  const hemW = Math.max(5, p(H * (broad ? 0.16 : 0.185)));

  // Hoisted, because the neck below is measured off the head rather than off a landmark.
  const headR = Math.max(5, p(H * 0.13));

  const yBoot = up(Y.boot);
  const yHem = up(Y.hem);
  const yWaist = up(Y.waist);
  const yShoulder = up(Y.shoulder);
  const yChin = up(Y.chin);

  // ---------------------------------------------------------------- the cloak, behind
  //
  // A second garment in a contrasting hue, which every figure in the reference has: a cape
  // reading *behind* the body is what gives a silhouette its outer edge and its second
  // colour region. It takes the vowed school's colour once there is one, so the Vow visibly
  // changes what the Commander is wearing.
  const cloak = accent ?? RAMP.cloak;
  // Ends above the boots rather than at them. Reaching to `Y.boot * 0.8` left five rows of
  // leg showing out of forty-eight — the legs were drawn, separated and coloured, and then
  // almost entirely covered by the garment in front of them.
  const cloakBottom = up(0.22);
  const cloakW = Math.max(7, p(H * 0.21));

  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-shoulder - 1, yShoulder);
  ctx.lineTo(shoulder + 1, yShoulder);
  ctx.lineTo(cloakW, cloakBottom);
  ctx.lineTo(-cloakW, cloakBottom);
  ctx.closePath();
  ctx.fill();

  // Its own shadow half, on the same centre line as the coat, so the whole figure agrees
  // about where the light comes from.
  ctx.fillStyle = shade(cloak);
  ctx.beginPath();
  ctx.moveTo(0, yShoulder);
  ctx.lineTo(shoulder + 1, yShoulder);
  ctx.lineTo(cloakW, cloakBottom);
  ctx.lineTo(0, cloakBottom);
  ctx.closePath();
  ctx.fill();

  // ---------------------------------------------------------------- legs, separated
  //
  // Two of them, with a gap of bare pixels down the middle. One leg-shaped block is a robe;
  // two with daylight between them is a person standing.
  const legW = Math.max(3, p(H * 0.075));
  const gap = Math.max(2, p(H * 0.03));
  ctx.fillStyle = RAMP.trouser;
  ctx.fillRect(-gap - legW, yHem, legW, yBoot - yHem);
  ctx.fillStyle = RAMP.trouserDark;
  ctx.fillRect(gap, yHem, legW, yBoot - yHem);

  // Boots, wider than the leg and *lighter* than it. Both differences matter: the width is
  // what makes a boot a boot, and the value jump is what stops it merging into the trouser.
  ctx.fillStyle = RAMP.boot;
  ctx.fillRect(-gap - legW - 1, yBoot, legW + 2, -yBoot);
  ctx.fillRect(gap - 1, yBoot, legW + 2, -yBoot);

  // The sole: one darker row at the very bottom of each boot. It is what puts the figure
  // *on* the ground rather than hovering a pixel above it.
  ctx.fillStyle = shade(RAMP.boot);
  px(ctx, -gap - legW - 1, -1, legW + 2, 1);
  px(ctx, gap - 1, -1, legW + 2, 1);

  // ---------------------------------------------------------------- the coat, in three bands
  //
  // Three discrete steps rather than two, and hard-edged rather than blended. Pixel-art
  // shading is banded because a smooth ramp turns to mud the moment it is quantised — the
  // middle value is what carries the turn of the form once there are only a few pixels to
  // say it in.
  const bandL = -p(shoulder * 0.3);
  const bandR = p(shoulder * 0.35);

  ctx.fillStyle = COAT_LIGHT;
  ctx.beginPath();
  ctx.moveTo(-shoulder, yShoulder);
  ctx.lineTo(bandL, yShoulder);
  ctx.lineTo(bandL, yHem);
  ctx.lineTo(-hemW, yHem);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COAT_MID;
  ctx.fillRect(bandL, yShoulder, bandR - bandL, yHem - yShoulder);

  ctx.fillStyle = COAT_DARK;
  ctx.beginPath();
  ctx.moveTo(bandR, yShoulder);
  ctx.lineTo(shoulder, yShoulder);
  ctx.lineTo(hemW, yHem);
  ctx.lineTo(bandR, yHem);
  ctx.closePath();
  ctx.fill();

  // The outline goes around the whole garment, and is deliberately *not* pure black: an ink
  // line darker than the shadow band flattens the value break it is drawn around.
  ctx.strokeStyle = COAT_INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-shoulder, yShoulder);
  ctx.lineTo(shoulder, yShoulder);
  ctx.lineTo(hemW, yHem);
  ctx.lineTo(-hemW, yHem);
  ctx.closePath();
  ctx.stroke();

  // ---------------------------------------------------------------- arms, off the torso
  //
  // Held a pixel clear of the body and angled outward, which is the entire difference
  // between "arms" and "a slightly wider coat". They used to be drawn at `-shoulder - armW +
  // 1` — overlapping the torso by a pixel, so the silhouette never actually broke.
  const armW = Math.max(3, p(H * 0.06));
  const yElbow = up(0.5);
  const yWrist = up(0.42);
  const armGap = 1;
  const flare = Math.max(1, p(H * 0.02));

  const arm = (dir: -1 | 1, upper: string, lower: string): void => {
    const x = dir * (shoulder + armGap);
    ctx.fillStyle = upper;
    ctx.fillRect(dir < 0 ? x - armW : x, yShoulder, armW, yElbow - yShoulder);
    // The forearm steps out by a pixel or two, so the limb has a bend in it.
    ctx.fillStyle = lower;
    const fx = x + dir * flare;
    ctx.fillRect(dir < 0 ? fx - armW : fx, yElbow, armW, yWrist - yElbow);
    // The cuff: one dark row between sleeve and skin. Without it the sleeve and the hand are
    // two similar-value blocks touching, and the arm ends in a smudge rather than a wrist.
    ctx.fillStyle = RAMP.seam;
    px(ctx, dir < 0 ? fx - armW : fx, yWrist, armW, 1);

    // The hand.
    ctx.fillStyle = skin;
    ctx.fillRect(dir < 0 ? fx - armW : fx, yWrist + 1, armW, Math.max(2, p(H * 0.05)));
  };
  arm(-1, COAT_LIGHT, COAT_MID);
  arm(1, COAT_DARK, COAT_DARK);

  // ---------------------------------------------------------------- seams
  //
  // Three lines, and between them they turn one painted block into a garment with
  // construction: a centre seam down the tunic, the waist where the tunic meets the robe,
  // and the collar line that was already there.
  ctx.fillStyle = RAMP.seam;

  // The centre seam. Runs from under the collar to the waist, on the band boundary so it
  // reads as a closure rather than as a stripe.
  const collarBase = yShoulder + Math.max(2, p(H * 0.04));
  px(ctx, 0, collarBase, 1, yWaist - collarBase);

  // Where the tunic ends and the robe begins.
  px(ctx, -shoulder, yWaist, shoulder * 2, 1);

  // And a lighter row directly under it, so the waist reads as an overlap — the tunic
  // sitting *on* the robe — rather than as a line drawn across a flat panel.
  ctx.fillStyle = COAT_MID;
  px(ctx, -shoulder, yWaist + 1, shoulder * 2, 1);

  // ---------------------------------------------------------------- belt and brass
  ctx.fillStyle = COAT_INK;
  ctx.fillRect(-shoulder, yWaist + 2, shoulder * 2, Math.max(1, p(H * 0.028)));

  // The Magistracy's brass, at the collar. A **rect**, not the triangle it started as: at
  // this resolution the chest is a handful of pixels tall and a three-pixel triangle
  // anti-aliased into mud — measured at literally zero pixels of brass on a real canvas.
  const collarW = p(shoulder * 0.9);
  const collarH = Math.max(2, p(H * 0.04));
  ctx.fillStyle = BRASS;
  ctx.fillRect(-collarW, yShoulder, collarW * 2, collarH);
  ctx.fillStyle = BRASS_LIT;
  ctx.fillRect(-collarW, yShoulder, collarW * 2, 1);

  // ---------------------------------------------------------------- neck
  //
  // Two pixels of skin between the collar and the chin. A head sitting straight on a pair of
  // shoulders is one continuous blob; this is what makes it a person wearing a coat.
  //
  // Anchored to the **head**, not to `Y.neck`. Taking the landmark literally left rows of
  // bare canvas between the chin and the collar — a two-pixel hole through the figure,
  // which is a gap of the wrong kind entirely.
  const neckW = Math.max(2, p(H * 0.045));
  //
  // `yChin` **is** the bottom of the head — the circle is centred a radius above it — so the
  // neck runs from there to the collar and the two cannot disagree. Writing `yChin + headR`
  // put it a whole radius below the shoulder and gave the rect a negative height, which
  // draws nothing at all and left the hole exactly where it had been.
  // Derived from the chosen complexion rather than authored against one. A fixed hex was
  // fine while skin was four tones off the face preset and became wrong the moment it became
  // six on their own axis — a pale neck under a dark jaw is not a shadow, it is a mistake.
  ctx.fillStyle = shade(skin);
  ctx.fillRect(-neckW, yChin, neckW * 2, yShoulder - yChin);

  // ---------------------------------------------------------------- head, facing forward
  const headY = yChin - headR;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  // The shadow side of the face, as a hard band rather than a gradient — the same three-step
  // logic the coat uses, at the size a head can afford.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shade(skin);
  ctx.fillRect(p(headR * 0.35), headY - headR, headR, headR * 2);
  ctx.restore();

  drawHair(ctx, headY, headR, hair.id, hairTone);
  drawFace(ctx, headY, headR, faceIdx, skin);

  // ---------------------------------------------------------------- rim light
  //
  // Alpha 0.85, and a `fillRect` rather than a stroke. At 0.55 across a 1px stroke this
  // measured 28 pixels on the whole figure — present in the transcript and invisible on the
  // screen, because a stroke anti-aliases across two rows at half intensity each.
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = RIM;
  ctx.fillRect(-shoulder - armGap - armW, yShoulder, 1, yElbow - yShoulder);
  ctx.fillRect(-headR, headY - p(headR * 0.5), 1, headR);
  ctx.restore();
}

/**
 * The cap each style wears, as radius and arc.
 *
 * Per-style rather than one shared cap, and that is a **bug fix** rather than tidying.
 * `shorn` used to draw the common cap and then erase a disc out of it with
 * `destination-out` — which does not erase "the hair". It erases pixels, and the sprite is
 * drawn straight onto a diorama that already has sky and ground on it, so a Shorn Commander
 * came with a hole bitten clean through their skull and the landscape behind it. Measured at
 * 782 transparent pixels on a 200x200 probe against zero for every other preset.
 *
 * A tighter cap says the same thing and composites like everything else.
 */
const HAIR_CAP: Record<string, { r: number; from: number; to: number }> = {
  shorn: { r: 1.02, from: 1.2, to: 1.8 },
  default: { r: 1.12, from: 1.02, to: 1.98 },
};

/**
 * The six silhouettes, each a different outline against the sky.
 *
 * Bigger than a head strictly needs. Hair is the loudest thing in the reference
 * silhouettes — often wider than the skull it sits on — because at this size it is the only
 * feature with enough area to tell two people apart across a room.
 */
function drawHair(
  ctx: CanvasRenderingContext2D,
  headY: number,
  headR: number,
  id: string,
  tone: string,
): void {
  ctx.fillStyle = tone;

  const cap = HAIR_CAP[id] ?? HAIR_CAP.default!;
  ctx.beginPath();
  ctx.arc(0, headY, headR * cap.r, Math.PI * cap.from, Math.PI * cap.to);
  ctx.fill();

  // The shadow the hairline casts on the forehead. One arc, and it does more to separate
  // "hair" from "head" at this scale than the colour difference does — two tones of similar
  // value sit flat against each other without it, whatever the hue.
  ctx.beginPath();
  ctx.arc(0, headY, headR * 0.98, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, headR * 0.22);
  ctx.stroke();

  ctx.fillStyle = tone;

  switch (id) {
    case 'crop':
      break;

    case 'mane':
      // Down *to* the shoulders and wider than the head — the biggest silhouette here.
      //
      // It used to reach `headR * 2.2` below the crown, which at this resolution buried six
      // rows of the figure: the neck and the whole brass collar disappeared under it, and
      // the two features the sprite had just gained were invisible on the one preset most
      // likely to be chosen for being the loudest.
      ctx.beginPath();
      ctx.ellipse(0, headY + headR * 0.35, headR * 1.5, headR * 1.1, 0, 0, Math.PI);
      ctx.fill();
      break;

    case 'braid':
      ctx.beginPath();
      ctx.ellipse(
        headR * 1.05,
        headY + headR * 1.0,
        headR * 0.34,
        headR * 1.35,
        0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;

    case 'topknot':
      ctx.beginPath();
      ctx.arc(0, headY - headR * 1.35, headR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(
        -Math.max(1, headR * 0.12),
        headY - headR * 1.4,
        Math.max(1, headR * 0.24),
        headR * 0.5,
      );
      break;

    case 'shorn':
      // Nothing above the cap. The tighter arc in `HAIR_CAP` is the whole style, so there is
      // deliberately no second shape here — and, crucially, nothing erased.
      break;

    case 'wild':
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * headR * 0.44, headY - headR * 0.6);
        ctx.lineTo(i * headR * 0.6, headY - headR * 1.8);
        ctx.lineTo(i * headR * 0.44 + headR * 0.34, headY - headR * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      break;
  }

  // A highlight block and a shadow block, so the hair is not one flat fill.
  //
  // **After** the style switch, not before it. `wild` draws its spikes over the crown in
  // flat tone, and painting the surface detail first meant that preset overpainted its own
  // highlight and part-line — measured at zero pixels of both, where every other style had
  // them. Surface detail goes on last, which is what "surface" means.
  //
  // **Clipped to the cap.** The caps differ per style — `shorn` is a tighter arc than the
  // rest — so a rect at a fixed offset would hang off the side of the head on some presets
  // and land on skin. Clipping to the shape that was just filled means the marks are on
  // hair by construction, whatever shape the hair is.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, headY, headR * cap.r, Math.PI * cap.from, Math.PI * cap.to);
  ctx.clip();

  // Both marks hug the crown, near the vertical axis. Placed further out they measured zero
  // pixels on `shorn`, whose cap is a much tighter arc than the rest — the clip did its job
  // and there was simply no hair under them. The top of the head is the one place every
  // preset has material.
  const capTop = headY - headR * cap.r;

  // Lit side, just off the crown toward the key light.
  ctx.fillStyle = lift(tone);
  px(ctx, -headR * 0.55, capTop + headR * 0.15, Math.max(2, headR * 0.35), Math.max(2, headR * 0.3));

  // And the part-line: a darker column just off centre, which is where hair divides and
  // where the eye looks for the direction it falls.
  ctx.fillStyle = shade(tone);
  px(ctx, headR * 0.15, capTop + headR * 0.1, 1, Math.max(2, headR * 0.55));
  ctx.restore();

}

/**
 * The face: brows, eyes with a catchlight, and the suggestion of a nose and a mouth.
 *
 * Every mark is one or two pixels, placed on the grid, on a head twelve pixels tall. That
 * sounds like nothing and it is most of what makes a sprite read as a person — the eye
 * highlight in particular, which is a single pixel and is the difference between two dark
 * dots and something looking back.
 *
 * `idx` still changes the brow and the eye, because that is what the four presets are for.
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  headY: number,
  headR: number,
  idx: number,
  skin: string,
): void {
  const eyeY = Math.round(headY + headR * 0.12);
  const eyeX = Math.round(headR * 0.42);
  const eyeW = Math.max(1, Math.round(headR * 0.3));

  // ---------------------------------------------------------------- brows
  //
  // One row above the eye, and a pixel wider than it. A brow is the cheapest expression
  // control there is: its height off the eye is the whole difference between the presets.
  const browLift = idx === 1 ? 3 : idx === 2 ? 1 : 2;
  const browH = idx === 1 ? 1 : 1;
  ctx.fillStyle = RAMP.faceInk;
  px(ctx, -eyeX - eyeW, eyeY - browLift, eyeW + 1, browH);
  px(ctx, eyeX - 1, eyeY - browLift, eyeW + 1, browH);

  // ---------------------------------------------------------------- eyes
  //
  // Rects, not circles. A two-pixel disc is a rect that has been through anti-aliasing on
  // the way, and the blend is what made these read as smudges rather than as eyes.
  const eyeH = idx === 2 ? Math.max(2, eyeW) : Math.max(1, eyeW - 1);
  px(ctx, -eyeX - eyeW + 1, eyeY, eyeW, eyeH);
  px(ctx, eyeX - 1, eyeY, eyeW, eyeH);

  // The catchlight. One pixel, top-left of each eye, on the side the key light is on.
  ctx.fillStyle = RAMP.eyeLit;
  px(ctx, -eyeX - eyeW + 1, eyeY, 1, 1);
  px(ctx, eyeX - 1, eyeY, 1, 1);

  // ---------------------------------------------------------------- nose and mouth
  //
  // A suggestion, and deliberately no more: at twelve pixels a drawn nose is a blemish. One
  // pixel of shadow where the nose would cast, and a short line for the mouth.
  ctx.fillStyle = shade(skin);
  px(ctx, 0, eyeY + 2, 1, 1);
  px(ctx, -1, eyeY + 4, 3, 1);

  // ---------------------------------------------------------------- the scar
  //
  // The one preset whose identity is not in the brow. Kept as a rect column so it snaps to
  // the grid like everything else — the old diagonal stroke anti-aliased into a grey smear.
  if (idx === 3) {
    ctx.fillStyle = shade(shade(skin));
    px(ctx, eyeX, eyeY - 3, 1, Math.max(3, headR * 0.8));
  }
}

/**
 * The beast, as a silhouette in its school's colour.
 *
 * One shape for every bloodline, deliberately: this is the moment the Vow lands, and what
 * the player is being shown is *that something arrived*, in a colour they just chose. Six
 * hand-drawn creatures would be six promises the combat board would then have to keep.
 */
export function drawCompanion(
  ctx: CanvasRenderingContext2D,
  unit: number,
  school: School | string,
): void {
  const color = SCHOOL_COLOR[school] ?? PALETTE.pact;

  // Low, long body — it reads as an animal beside an upright person, which is the only
  // silhouette distinction that matters at this size.
  const w = unit * 0.42;
  const top = -unit * 0.62;

  ctx.beginPath();
  ctx.moveTo(-w, -unit * 0.04);
  ctx.quadraticCurveTo(-w * 1.05, top, 0, top);
  ctx.quadraticCurveTo(w * 1.05, top, w, -unit * 0.04);
  ctx.closePath();
  ctx.fillStyle = '#20262F';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, unit * 0.05);
  ctx.stroke();

  // Four legs, so it stands on the ground rather than hovering above it.
  ctx.fillStyle = '#20262F';
  for (const x of [-w * 0.62, -w * 0.2, w * 0.2, w * 0.62]) {
    ctx.fillRect(x - unit * 0.03, -unit * 0.1, unit * 0.06, unit * 0.1);
  }

  // The head, lifted and forward.
  ctx.beginPath();
  ctx.arc(w * 0.62, top - unit * 0.1, unit * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#20262F';
  ctx.fill();
  ctx.stroke();

  // The eye, and the only lit thing on the beast. `shadowBlur` in the element's own colour
  // makes it a source rather than a dot — which is what sells the silhouette as a creature
  // with something burning inside it, at a size where no amount of detail would.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = unit * 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(w * 0.68, top - unit * 0.13, unit * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A tail, so the silhouette has a direction.
  ctx.beginPath();
  ctx.moveTo(-w * 0.92, -unit * 0.18);
  ctx.quadraticCurveTo(-w * 1.7, -unit * 0.5, -w * 1.35, -unit * 0.74);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, unit * 0.045);
  ctx.stroke();
}

/**
 * A colour's lit side. The counterpart to `shade`, and derived the same way so any tone —
 * including the six school colours and every hair preset — gets a highlight nobody authored.
 */
function lift(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return hex;
  const up = (v: number): number => Math.min(255, Math.round(v * 1.35 + 24));
  const r = up((n >> 16) & 255);
  const g = up((n >> 8) & 255);
  const b = up(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * A colour's shadow side.
 *
 * Multiplied toward black rather than picked, so the cloak gets a matching dark whatever
 * accent it is handed — including the six school colours, which nobody authored a shadow
 * for and nobody should have to.
 */
function shade(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return hex;
  const dim = (v: number): number => Math.round(v * 0.62);
  const r = dim((n >> 16) & 255);
  const g = dim((n >> 8) & 255);
  const b = dim(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
