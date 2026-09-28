/**
 * The stand-in a species wears until its own art arrives: a dark animal silhouette with an
 * outline and eyes in its school's colour, in the three facings the game asks for.
 *
 * Drawn out of a handful of ellipses and capsules rather than loaded from a template, so it
 * needs nothing on disk to exist, and supersampled so its edges are soft enough to stand next
 * to painted art without looking like a bug. It is meant to read as "a beast of this school,
 * not drawn yet" — which is exactly what it is.
 */

import { PLACEHOLDER_MARK } from '../../src/core/data/artLedger.js';
import { encodePng } from './png.js';

export type Facing = 'front' | 'back' | 'side';

/** A shape the silhouette is built from, in canvas pixels. */
type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'capsule'; x0: number; y0: number; x1: number; y1: number; r: number };

function inside(shape: Shape, x: number, y: number, grow: number): boolean {
  if (shape.kind === 'ellipse') {
    const dx = (x - shape.cx) / (shape.rx + grow);
    const dy = (y - shape.cy) / (shape.ry + grow);
    return dx * dx + dy * dy <= 1;
  }
  const vx = shape.x1 - shape.x0;
  const vy = shape.y1 - shape.y0;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - shape.x0) * vx + (y - shape.y0) * vy) / len2));
  const px = shape.x0 + t * vx - x;
  const py = shape.y0 + t * vy - y;
  return px * px + py * py <= (shape.r + grow) ** 2;
}

function hex(css: string): [number, number, number] {
  const n = parseInt(css.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BODY = hex('#20262F');
const OUTLINE_PX = 3;
/** Rendered at twice the size and box-filtered down, so the edges are smooth enough to pass for art. */
const SUPERSAMPLE = 2;

/** The silhouette for one facing: body shapes, and the eyes that are the only lit thing on it. */
function silhouette(facing: Facing): { w: number; h: number; body: Shape[]; eyes: Shape[] } {
  if (facing === 'side') {
    // A long low animal facing left, the way every profile in the game faces.
    return {
      w: 200,
      h: 160,
      body: [
        { kind: 'ellipse', cx: 108, cy: 96, rx: 58, ry: 30 },
        { kind: 'ellipse', cx: 68, cy: 80, rx: 22, ry: 18 },
        { kind: 'ellipse', cx: 44, cy: 62, rx: 24, ry: 21 },
        { kind: 'capsule', x0: 62, y0: 108, x1: 62, y1: 150, r: 6 },
        { kind: 'capsule', x0: 82, y0: 112, x1: 82, y1: 150, r: 6 },
        { kind: 'capsule', x0: 132, y0: 112, x1: 132, y1: 150, r: 6 },
        { kind: 'capsule', x0: 152, y0: 106, x1: 152, y1: 150, r: 6 },
        { kind: 'capsule', x0: 160, y0: 88, x1: 188, y1: 48, r: 5 },
      ],
      eyes: [{ kind: 'ellipse', cx: 34, cy: 58, rx: 4, ry: 4 }],
    };
  }
  const common: Shape[] = [
    { kind: 'ellipse', cx: 80, cy: 112, rx: 44, ry: 40 },
    { kind: 'capsule', x0: 58, y0: 130, x1: 58, y1: 172, r: 7 },
    { kind: 'capsule', x0: 102, y0: 130, x1: 102, y1: 172, r: 7 },
  ];
  if (facing === 'front') {
    return {
      w: 160,
      h: 180,
      body: [...common, { kind: 'ellipse', cx: 80, cy: 62, rx: 30, ry: 28 }],
      eyes: [
        { kind: 'ellipse', cx: 69, cy: 58, rx: 4, ry: 4 },
        { kind: 'ellipse', cx: 91, cy: 58, rx: 4, ry: 4 },
      ],
    };
  }
  // Back: no face, and the tail is what says which way it is going.
  return {
    w: 160,
    h: 180,
    body: [
      ...common,
      { kind: 'ellipse', cx: 80, cy: 64, rx: 28, ry: 26 },
      { kind: 'capsule', x0: 86, y0: 96, x1: 118, y1: 40, r: 5 },
    ],
    eyes: [],
  };
}

/** One placeholder PNG, in the colours of the species' own school. */
export function placeholderPng(facing: Facing, schoolColour: string): Buffer {
  const { w, h, body, eyes } = silhouette(facing);
  const outline = hex(schoolColour);
  const S = SUPERSAMPLE;
  const out = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          let colour: [number, number, number] | null = null;
          if (eyes.some((e) => inside(e, px, py, 0))) colour = outline;
          else if (body.some((s) => inside(s, px, py, 0))) colour = BODY;
          else if (body.some((s) => inside(s, px, py, OUTLINE_PX))) colour = outline;
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 1;
        }
      }
      const i = (y * w + x) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a);
        out[i + 1] = Math.round(g / a);
        out[i + 2] = Math.round(b / a);
        out[i + 3] = Math.round((a / (S * S)) * 255);
      }
    }
  }
  return encodePng(w, h, out, { Software: PLACEHOLDER_MARK });
}

