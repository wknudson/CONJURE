/**
 * Procedural 2D sprites, drawn from a `CharacterLook`.
 *
 * There is no art in this project — every body on the combat board is canvas shapes out of
 * `palette.ts` — so the creator draws its actors the same way rather than inventing a
 * second visual language that the game would then fail to live up to. A player who builds
 * a topknot here sees the same topknot in a fight.
 *
 * Everything is drawn in **sprite units**: feet at the origin, up is negative, and one unit
 * is roughly the height of a tile. The diorama multiplies that by the projected scale, so
 * these functions never learn how far away they are.
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
 * The Commander, as the diorama sees them.
 *
 * Read at draw time from the look rather than baked into a bitmap, which is what lets the
 * sprite on the stage change on the same frame the player clicks "next hair" — the whole
 * point of putting the character on the map instead of in a preview box.
 */
export function drawCommander(
  ctx: CanvasRenderingContext2D,
  unit: number,
  look: CharacterLook,
): void {
  const hair = HAIR_PRESETS[clampPreset(look.hairPreset, HAIR_PRESETS.length)]!;
  const faceIdx = clampPreset(look.facePreset, FACE_PRESETS.length);
  const skin = SKIN_TONES[faceIdx % SKIN_TONES.length]!;
  const hairTone = HAIR_TONES[clampPreset(look.hairPreset, HAIR_TONES.length)]!;

  // Silhouette first. The two genders differ in shoulder width and coat flare and in
  // nothing else — enough to read at this size, and not a claim the art cannot keep.
  const broad = look.gender === 'male';
  const shoulder = unit * (broad ? 0.30 : 0.25);
  const hem = unit * (broad ? 0.26 : 0.30);
  const bodyTop = -unit * 1.02;
  const bodyBottom = -unit * 0.06;

  // The coat.
  ctx.beginPath();
  ctx.moveTo(-shoulder, bodyTop);
  ctx.lineTo(shoulder, bodyTop);
  ctx.lineTo(hem, bodyBottom);
  ctx.lineTo(-hem, bodyBottom);
  ctx.closePath();
  ctx.fillStyle = '#2E3646';
  ctx.fill();
  ctx.strokeStyle = '#151A24';
  ctx.lineWidth = Math.max(1, unit * 0.035);
  ctx.stroke();

  // The Magistracy's brass, at the collar. One warm mark on a cold silhouette.
  ctx.beginPath();
  ctx.moveTo(-shoulder * 0.55, bodyTop + unit * 0.04);
  ctx.lineTo(shoulder * 0.55, bodyTop + unit * 0.04);
  ctx.lineTo(0, bodyTop + unit * 0.26);
  ctx.closePath();
  ctx.fillStyle = '#C8A558';
  ctx.fill();

  // Head.
  const headR = unit * 0.20;
  const headY = bodyTop - headR * 0.85;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  drawHair(ctx, headY, headR, hair.id, hairTone);
  drawFace(ctx, headY, headR, faceIdx);
}

/** The six silhouettes, each a different outline against the sky. */
function drawHair(
  ctx: CanvasRenderingContext2D,
  headY: number,
  headR: number,
  id: string,
  tone: string,
): void {
  ctx.fillStyle = tone;

  // The cap every style shares: hair sits on the skull rather than floating above it.
  ctx.beginPath();
  ctx.arc(0, headY, headR * 1.04, Math.PI * 1.06, Math.PI * 1.94);
  ctx.fill();

  switch (id) {
    case 'crop':
      break;

    case 'mane':
      ctx.beginPath();
      ctx.ellipse(0, headY + headR * 0.35, headR * 1.22, headR * 1.15, 0, 0, Math.PI);
      ctx.fill();
      break;

    case 'braid':
      ctx.beginPath();
      ctx.ellipse(headR * 0.9, headY + headR * 0.8, headR * 0.3, headR * 1.05, 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'topknot':
      ctx.beginPath();
      ctx.arc(0, headY - headR * 1.12, headR * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'shorn':
      // Nothing above the cap, and the cap itself is tighter.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.35, headR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;

    case 'wild':
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * headR * 0.42, headY - headR * 0.55);
        ctx.lineTo(i * headR * 0.55, headY - headR * 1.5);
        ctx.lineTo(i * headR * 0.42 + headR * 0.3, headY - headR * 0.55);
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
  const eyeY = headY + headR * 0.08;
  const eyeX = headR * 0.38;
  ctx.fillStyle = '#151A24';

  const dot = (x: number, y: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (idx) {
    case 1: // Weathered: a set line, and a heavier brow.
      ctx.fillRect(-eyeX - headR * 0.14, eyeY - headR * 0.26, headR * 1.08, headR * 0.12);
      dot(-eyeX, eyeY, headR * 0.09);
      dot(eyeX, eyeY, headR * 0.09);
      break;

    case 2: // Young: wider eyes, no brow.
      dot(-eyeX, eyeY, headR * 0.14);
      dot(eyeX, eyeY, headR * 0.14);
      break;

    case 3: // Scarred.
      dot(-eyeX, eyeY, headR * 0.1);
      dot(eyeX, eyeY, headR * 0.1);
      ctx.strokeStyle = '#8A5A4A';
      ctx.lineWidth = Math.max(1, headR * 0.1);
      ctx.beginPath();
      ctx.moveTo(eyeX - headR * 0.1, eyeY - headR * 0.5);
      ctx.lineTo(eyeX + headR * 0.3, eyeY + headR * 0.4);
      ctx.stroke();
      break;

    default: // Steady.
      dot(-eyeX, eyeY, headR * 0.11);
      dot(eyeX, eyeY, headR * 0.11);
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

  // The head, lifted and forward.
  ctx.beginPath();
  ctx.arc(w * 0.62, top - unit * 0.1, unit * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#20262F';
  ctx.fill();
  ctx.stroke();

  // Two eyes of its element, which is the whole colour cue at a distance.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(w * 0.68, top - unit * 0.13, unit * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // A tail, so the silhouette has a direction.
  ctx.beginPath();
  ctx.moveTo(-w * 0.92, -unit * 0.18);
  ctx.quadraticCurveTo(-w * 1.7, -unit * 0.5, -w * 1.35, -unit * 0.74);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, unit * 0.045);
  ctx.stroke();
}
