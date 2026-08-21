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
  coatLight: '#3D4A60',
  coatDark: '#1D2430',
  coatInk: '#12151C',
  brass: '#C8A558',
  brassLit: '#E8D6A0',
  /** Key light, warm and low. One stroke of it, at 55%. */
  rim: '#F0E4C8',
  /** The Magistracy's own indigo, worn until a discipline is vowed to. */
  cloak: '#3B3A6B',
  /**
   * Deliberately **not** a neutral slate.
   *
   * The first value here was `#2A2F3A`, which is byte-identical to `PALETTE.tileA` — the
   * ground the Commander stands on. The legs were the exact colour of the floor, and at
   * diorama distance the figure would have ended at the coat hem with two boots floating
   * under it. A sprite has to be picked out of its own background before anything else
   * about it matters.
   */
  trouser: '#3A3550',
  trouserDark: '#26223A',
  boot: '#5A4632',
} as const;

const COAT_LIGHT = RAMP.coatLight;
const COAT_DARK = RAMP.coatDark;
const COAT_INK = RAMP.coatInk;
const BRASS = RAMP.brass;
const BRASS_LIT = RAMP.brassLit;
const RIM = RAMP.rim;

/**
 * How tall the figure stands, in `unit`s.
 *
 * Raised, with a much smaller head, taking the reference silhouettes at their word: those
 * are roughly **one head to five** and slim, where this sprite was nearer one to three and a
 * half. Proportion is the first thing read at any distance, and a stubby figure reads as a
 * mascot no matter what is drawn on it.
 */
const FIGURE = 1.15;

/** The art grid. 44 tall against ~89 on screen is a clean 2x, which is the crispest ratio. */
const ART_H = 44;
const ART_W = 34;

/**
 * Landmarks down the body, as a fraction of figure height measured **up from the feet**.
 *
 * A table rather than arithmetic scattered through the drawing, because the whole point of
 * fixing the proportions was to be able to see them in one place and argue about them.
 */
const Y = {
  boot: 0.14,
  hem: 0.4,
  waist: 0.56,
  chest: 0.72,
  shoulder: 0.8,
  chin: 0.83,
} as const;

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
  const skin = SKIN_TONES[faceIdx % SKIN_TONES.length]!;
  const hairTone = HAIR_TONES[clampPreset(look.hairPreset, HAIR_TONES.length)]!;

  const H = unit * FIGURE;
  const p = (v: number): number => Math.round(v);
  const up = (f: number): number => p(-H * f);

  // The two bearings differ in shoulder width and coat flare and in nothing else — enough to
  // read at this size, and not a claim the art cannot keep.
  const broad = look.gender === 'male';
  const shoulder = p(H * (broad ? 0.135 : 0.115));
  const waistW = p(H * (broad ? 0.095 : 0.082));
  const hemW = p(H * (broad ? 0.165 : 0.19));

  const yBoot = up(Y.boot);
  const yHem = up(Y.hem);
  const yWaist = up(Y.waist);
  const yShoulder = up(Y.shoulder);
  const yChin = up(Y.chin);

  // ---------------------------------------------------------------- the cloak, behind
  //
  // A second garment in a contrasting hue, which every figure in the reference has and this
  // sprite had none of: a cape reading *behind* the body is what gives a silhouette its
  // outer edge and its second colour region. It takes the vowed school's colour once there
  // is one, so the Vow visibly changes what the Commander is wearing.
  const cloak = accent ?? RAMP.cloak;
  const cloakBottom = up(Y.boot * 0.7);
  const cloakW = p(H * 0.225);

  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-shoulder - 1, yShoulder);
  ctx.lineTo(shoulder + 1, yShoulder);
  ctx.lineTo(cloakW, cloakBottom);
  ctx.lineTo(-cloakW, cloakBottom);
  ctx.closePath();
  ctx.fill();

  // Its own shadow half, on the same centre line as the coat, so the whole figure agrees
  // about where the light is coming from.
  ctx.fillStyle = shade(cloak);
  ctx.beginPath();
  ctx.moveTo(0, yShoulder);
  ctx.lineTo(shoulder + 1, yShoulder);
  ctx.lineTo(cloakW, cloakBottom);
  ctx.lineTo(0, cloakBottom);
  ctx.closePath();
  ctx.fill();

  // ---------------------------------------------------------------- legs and boots
  const legW = Math.max(2, p(H * 0.05));
  const legX = p(H * 0.055);
  ctx.fillStyle = RAMP.trouser;
  ctx.fillRect(-legX - legW, yHem, legW, yBoot - yHem);
  ctx.fillStyle = RAMP.trouserDark;
  ctx.fillRect(legX, yHem, legW, yBoot - yHem);

  // Wider than the leg, which is the whole reason a boot reads as a boot.
  ctx.fillStyle = RAMP.boot;
  ctx.fillRect(-legX - legW - 1, yBoot, legW + 2, -yBoot);
  ctx.fillRect(legX - 1, yBoot, legW + 2, -yBoot);

  // ---------------------------------------------------------------- the coat
  //
  // Split into a lit panel and a shadow panel down the centre line rather than filled flat.
  // One value break tells the eye there is a body under the cloth turning away from the
  // light.
  ctx.beginPath();
  ctx.moveTo(-shoulder, yShoulder);
  ctx.lineTo(0, yShoulder);
  ctx.lineTo(0, yHem);
  ctx.lineTo(-hemW, yHem);
  ctx.closePath();
  ctx.fillStyle = COAT_LIGHT;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, yShoulder);
  ctx.lineTo(shoulder, yShoulder);
  ctx.lineTo(hemW, yHem);
  ctx.lineTo(0, yHem);
  ctx.closePath();
  ctx.fillStyle = COAT_DARK;
  ctx.fill();

  // The outline goes around the whole garment, and is deliberately *not* pure black: an ink
  // line darker than the shadow panel flattens the value break it is drawn around.
  ctx.beginPath();
  ctx.moveTo(-shoulder, yShoulder);
  ctx.lineTo(shoulder, yShoulder);
  ctx.lineTo(hemW, yHem);
  ctx.lineTo(-hemW, yHem);
  ctx.closePath();
  ctx.strokeStyle = COAT_INK;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ---------------------------------------------------------------- arms
  //
  // The single biggest thing missing before this: the figure was a trapezoid with a head on
  // it. Arms are what make a silhouette a person, and they are two rects and two squares.
  const armW = Math.max(2, p(H * 0.042));
  const yWrist = up(0.46);
  const handH = Math.max(2, p(H * 0.045));

  ctx.fillStyle = COAT_LIGHT;
  ctx.fillRect(-shoulder - armW + 1, yShoulder, armW, yWrist - yShoulder);
  ctx.fillStyle = COAT_DARK;
  ctx.fillRect(shoulder - 1, yShoulder, armW, yWrist - yShoulder);

  ctx.fillStyle = skin;
  ctx.fillRect(-shoulder - armW + 1, yWrist, armW, handH);
  ctx.fillRect(shoulder - 1, yWrist, armW, handH);

  // ---------------------------------------------------------------- belt and brass
  ctx.fillStyle = COAT_INK;
  ctx.fillRect(-waistW - 1, yWaist, waistW * 2 + 2, Math.max(1, p(H * 0.03)));

  // The Magistracy's brass, at the collar. One warm mark on a cold silhouette.
  //
  // A **rect**, not the triangle it started as. At 44 art-pixels the whole chest is four
  // pixels tall, and a triangle three of them high anti-aliased into mud — measured at
  // literally zero pixels within tolerance of the brass colour. Anything meant to read at
  // this resolution has to be axis-aligned and at least two pixels thick.
  const collarW = p(shoulder * 1.1);
  const collarH = Math.max(2, p(H * 0.045));
  ctx.fillStyle = BRASS;
  ctx.fillRect(-collarW, yShoulder + 1, collarW * 2, collarH);

  // Metal is a value gradient or it is a bar painted gold. One highlight along the top row
  // only, where the light would actually catch it.
  ctx.fillStyle = BRASS_LIT;
  ctx.fillRect(-collarW, yShoulder + 1, collarW * 2, 1);

  // ---------------------------------------------------------------- head
  const headR = Math.max(3, p(H * 0.095));
  const headY = yChin - headR;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  drawHair(ctx, headY, headR, hair.id, hairTone);
  drawFace(ctx, headY, headR, faceIdx);

  // ---------------------------------------------------------------- rim light
  //
  // Last, so it catches the hair silhouette rather than being buried under it. The single
  // highest-value mark on the sprite: a bright edge down the lit side is what separates "a
  // lit form standing in a place" from "a sticker on a background". Kept translucent so it
  // reads as light rather than as a drawn outline.
  // Alpha **0.85**, and the arm edge is a `fillRect` rather than a stroke. At 0.55 across a
  // 1px stroke this was measured at 28 pixels on the whole 48x104 figure — present in the
  // transcript and invisible on the screen, because a stroke anti-aliases across two rows at
  // half intensity each and 55% of that is nothing. Third time this file has learned the
  // same lesson: at 44 art-pixels, a mark is axis-aligned and near-opaque or it does not
  // exist.
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = RIM;
  ctx.fillRect(-shoulder - armW, yShoulder, 1, yWrist - yShoulder);
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, headY, headR + 1, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
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
      // Down past the shoulders and wider than the head — the biggest silhouette here.
      ctx.beginPath();
      ctx.ellipse(0, headY + headR * 0.5, headR * 1.5, headR * 1.7, 0, 0, Math.PI);
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
}

/** Three marks. Any more would be invisible at diorama scale and noise up close. */
function drawFace(
  ctx: CanvasRenderingContext2D,
  headY: number,
  headR: number,
  idx: number,
): void {
  const eyeY = headY + headR * 0.12;
  const eyeX = headR * 0.42;
  ctx.fillStyle = '#151A24';

  const dot = (x: number, y: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (idx) {
    case 1: // Weathered: a set line, and a heavier brow.
      ctx.fillRect(
        -eyeX - headR * 0.16,
        eyeY - headR * 0.3,
        headR * 1.16,
        Math.max(1, headR * 0.14),
      );
      dot(-eyeX, eyeY, headR * 0.13);
      dot(eyeX, eyeY, headR * 0.13);
      break;

    case 2: // Young: wider eyes, no brow.
      dot(-eyeX, eyeY, headR * 0.19);
      dot(eyeX, eyeY, headR * 0.19);
      break;

    case 3: // Scarred.
      dot(-eyeX, eyeY, headR * 0.14);
      dot(eyeX, eyeY, headR * 0.14);
      ctx.strokeStyle = '#8A5A4A';
      ctx.lineWidth = Math.max(1, headR * 0.14);
      ctx.beginPath();
      ctx.moveTo(eyeX - headR * 0.12, eyeY - headR * 0.6);
      ctx.lineTo(eyeX + headR * 0.34, eyeY + headR * 0.5);
      ctx.stroke();
      break;

    default: // Steady.
      dot(-eyeX, eyeY, headR * 0.15);
      dot(eyeX, eyeY, headR * 0.15);
      break;
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
