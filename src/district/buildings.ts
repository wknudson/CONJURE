/**
 * What stands on a solid tile: a building that looks like one, or a thicket, a rock, a mound.
 *
 * Every solid run in the grid used to become one `BoxGeometry` with a wall texture on it, a flat
 * parapet and sometimes a chimney -- which is a terrace drawn by somebody who has heard of them.
 * It was also the Ashwood's trees, the Verge's thickets, the Rimefields' ridges and the Bone
 * Bastion's barrows, because they are solid tiles too and nobody had said what else they were:
 * a forest of brick boxes with parapets on. This is the kit that says.
 *
 * A legend entry's `solid.style` picks a builder. The built styles cut a run into lots -- one to
 * three tiles each, the way a street is plots rather than a slab, after the recursive bisection
 * in watabou's town generator (GPL, ideas only) -- and give each its own height, a wall with
 * windows in it, a roof, and a door on the side the street is. The natural ones are masses of
 * primitives roughed up with simplex noise: leaf blobs, trunks and canopies, a slumped rock, a
 * turf mound, ice crystals, an iron lattice. Each piece is a handful of merged geometries, one
 * per material, which is what keeps a dense ward inside its draw-call budget.
 *
 * Pure of the DOM, so what it builds can be measured in a test: every piece stays inside its
 * footprint and under its height, which is the budget the camera fade depends on -- a building
 * taller than it was authored, one tile camera-side, would fade constantly. UVs are in world
 * units over a fixed tile of each material (see `UV`), so a texture repeats at the same scale on
 * a lot of any size and every lot can share one set of textures.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, nextFloat, type RngState } from '../core/util/rng.js';
import { makeNoise2D } from '../core/util/noise.js';

/** What a solid tile is. `plain` is the box every solid was before there was a choice. */
export type SolidStyle =
  | 'plain'
  | 'terrace'
  | 'shopfront'
  | 'warehouse'
  | 'hall'
  | 'cottage'
  | 'tower'
  | 'wall'
  | 'stall'
  | 'foliage'
  | 'forest'
  | 'rock'
  | 'mound'
  | 'ice'
  | 'pylon';

/** The styles that are buildings: lots, windows, roofs and doors. */
export const BUILT: ReadonlySet<SolidStyle> = new Set(['terrace', 'shopfront', 'warehouse', 'hall', 'cottage', 'tower']);

/**
 * Which surface a part is drawn in. The world owns the textures and the materials; this only says
 * which one. `facade` is a wall with windows, `wall` a wall without.
 */
export type SurfaceKey = 'facade' | 'wall' | 'roof' | 'trim' | 'leaf' | 'bark' | 'rock' | 'turf' | 'ice' | 'iron';

/** How big one repeat of each surface's texture is, in world units, across and up. */
export const UV: Readonly<Record<SurfaceKey, readonly [number, number]>> = {
  facade: [2, 2.4],
  wall: [2, 2],
  roof: [2, 2],
  trim: [1, 1],
  leaf: [2, 2],
  bark: [1, 2],
  rock: [3, 3],
  turf: [3, 3],
  ice: [2, 2],
  iron: [1, 1],
};

/** Where on the trim atlas each decoration is, in atlas units (the atlas is 4 by 2). */
export const TRIM = {
  door: [0, 0, 1, 2],
  shop: [1, 0, 2, 1],
  awning: [1, 1, 2, 1],
  sign: [3, 0, 1, 1],
  loading: [3, 1, 1, 1],
} as const;

/** Which way a building's street is. Its door and its shop front are on that side. */
export type Facing = 'north' | 'south' | 'east' | 'west';

/** One footprint to build on: a lot's worth of a run, in world units, already inset. */
export interface SolidPiece {
  readonly style: SolidStyle;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Total height, roof included. The budget. */
  readonly height: number;
  readonly seed: number;
  /** The street side, when there is one. */
  readonly facing: Facing | null;
  /** Whether this one has a chimney. */
  readonly chimney: boolean;
  /** Whether a real door (an exit) is already on this face, so no painted one is added. */
  readonly hasDoor?: boolean;
}

export interface BuiltPart {
  readonly surface: SurfaceKey;
  readonly geometry: THREE.BufferGeometry;
  /** A lit surface in the dark: windows. Only the facade has any. */
  readonly glows?: boolean;
}

export interface BuiltPiece {
  readonly parts: BuiltPart[];
  /** The highest point anything reaches. The fade box is this tall. */
  readonly top: number;
  /** Where smoke comes out, if anywhere. */
  readonly chimneys: THREE.Vector3[];
}

/**
 * A run of `len` tiles cut into lots of one to three.
 *
 * A bisection, as the town generator cuts a block: split the run somewhere near the middle, with
 * a spread either way, and cut each half again until the pieces are small enough. Deterministic
 * for a seed, so a terrace is the same houses every time it is built.
 */
export function lotsOf(len: number, seed: number): number[] {
  const rng = makeRng(seed);
  const out: number[] = [];
  const cut = (n: number): void => {
    if (n <= 3 && (n <= 1 || nextFloat(rng) < 0.55 || n === 1)) {
      out.push(n);
      return;
    }
    if (n <= 3) {
      const a = 1 + Math.floor(nextFloat(rng) * (n - 1));
      out.push(a, n - a);
      return;
    }
    // Near the middle, spread by a third either way, never leaving a sliver of nothing.
    const spread = 0.34;
    const at = Math.max(1, Math.min(n - 1, Math.round(n * ((1 - spread) / 2 + nextFloat(rng) * spread))));
    cut(at);
    cut(n - at);
  };
  cut(Math.max(1, Math.round(len)));
  return out;
}

/* ------------------------------------------------------------------------------------------ *
 * Geometry helpers. Everything is built non-indexed with position, normal and uv, so any mix of
 * it merges into one geometry.
 * ------------------------------------------------------------------------------------------ */

type V3 = readonly [number, number, number];

/** A quad from four corners (counter-clockwise seen from outside), UV'd in world units. */
function quad(out: number[], uvs: number[], a: V3, b: V3, c: V3, d: V3, surface: SurfaceKey, uOf: (p: V3) => number, vOf: (p: V3) => number): void {
  const [su, sv] = UV[surface];
  for (const p of [a, b, c, a, c, d]) {
    out.push(p[0], p[1], p[2]);
    uvs.push(uOf(p) / su, vOf(p) / sv);
  }
}

/** A triangle, likewise. */
function tri(out: number[], uvs: number[], a: V3, b: V3, c: V3, surface: SurfaceKey, uOf: (p: V3) => number, vOf: (p: V3) => number): void {
  const [su, sv] = UV[surface];
  for (const p of [a, b, c]) {
    out.push(p[0], p[1], p[2]);
    uvs.push(uOf(p) / su, vOf(p) / sv);
  }
}

function finish(pos: number[], uvs: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** The four walls of a box from the ground to `h`, and its top if `lid`. UVs run round the walls. */
function walls(x0: number, x1: number, z0: number, z1: number, h: number, surface: SurfaceKey, lid = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const up = (p: V3): number => p[1];
  // South (+z), north, east (+x), west -- each quad wound to face outward.
  quad(pos, uvs, [x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], surface, (p) => p[0], up);
  quad(pos, uvs, [x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], surface, (p) => -p[0], up);
  quad(pos, uvs, [x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], surface, (p) => -p[2], up);
  quad(pos, uvs, [x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], surface, (p) => p[2], up);
  if (lid) quad(pos, uvs, [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], surface, (p) => p[0], (p) => -p[2]);
  return finish(pos, uvs);
}

/**
 * A pitched roof over a box: two slopes meeting at a ridge, and the two gable triangles closing
 * the ends in the wall's own surface. The ridge runs along x when `alongX`, else along z. The
 * slopes overhang the walls by `eave` so the roof reads as a roof and not as a cap.
 */
function gable(x0: number, x1: number, z0: number, z1: number, wallH: number, roofH: number, alongX: boolean, eave: number): { roof: THREE.BufferGeometry; ends: THREE.BufferGeometry } {
  const pos: number[] = [];
  const uvs: number[] = [];
  const epos: number[] = [];
  const euvs: number[] = [];
  const top = wallH + roofH;
  const along = (p: V3): number => (alongX ? p[0] : p[2]);
  if (alongX) {
    const zm = (z0 + z1) / 2;
    const slope = (p: V3): number => Math.hypot(p[2] - zm, p[1] - top);
    quad(pos, uvs, [x0 - eave, wallH - eave * 0.4, z1 + eave], [x1 + eave, wallH - eave * 0.4, z1 + eave], [x1 + eave, top, zm], [x0 - eave, top, zm], 'roof', along, slope);
    quad(pos, uvs, [x1 + eave, wallH - eave * 0.4, z0 - eave], [x0 - eave, wallH - eave * 0.4, z0 - eave], [x0 - eave, top, zm], [x1 + eave, top, zm], 'roof', (p) => -along(p), slope);
    tri(epos, euvs, [x1, wallH, z1], [x1, wallH, z0], [x1, top, zm], 'facade', (p) => -p[2], (p) => p[1]);
    tri(epos, euvs, [x0, wallH, z0], [x0, wallH, z1], [x0, top, zm], 'facade', (p) => p[2], (p) => p[1]);
  } else {
    const xm = (x0 + x1) / 2;
    const slope = (p: V3): number => Math.hypot(p[0] - xm, p[1] - top);
    quad(pos, uvs, [x1 + eave, wallH - eave * 0.4, z1 + eave], [x1 + eave, wallH - eave * 0.4, z0 - eave], [xm, top, z0 - eave], [xm, top, z1 + eave], 'roof', (p) => -along(p), slope);
    quad(pos, uvs, [x0 - eave, wallH - eave * 0.4, z0 - eave], [x0 - eave, wallH - eave * 0.4, z1 + eave], [xm, top, z1 + eave], [xm, top, z0 - eave], 'roof', along, slope);
    tri(epos, euvs, [x0, wallH, z1], [x1, wallH, z1], [xm, top, z1], 'facade', (p) => p[0], (p) => p[1]);
    tri(epos, euvs, [x1, wallH, z0], [x0, wallH, z0], [xm, top, z0], 'facade', (p) => -p[0], (p) => p[1]);
  }
  return { roof: finish(pos, uvs), ends: finish(epos, euvs) };
}

/** A pyramid roof: four slopes to a point. */
function pyramid(x0: number, x1: number, z0: number, z1: number, wallH: number, roofH: number, eave: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const apex: V3 = [(x0 + x1) / 2, wallH + roofH, (z0 + z1) / 2];
  const y = wallH - eave * 0.4;
  const a: V3 = [x0 - eave, y, z1 + eave];
  const b: V3 = [x1 + eave, y, z1 + eave];
  const c: V3 = [x1 + eave, y, z0 - eave];
  const d: V3 = [x0 - eave, y, z0 - eave];
  const u = (p: V3): number => p[0] + p[2];
  const v = (p: V3): number => p[1];
  tri(pos, uvs, a, b, apex, 'roof', u, v);
  tri(pos, uvs, b, c, apex, 'roof', u, v);
  tri(pos, uvs, c, d, apex, 'roof', u, v);
  tri(pos, uvs, d, a, apex, 'roof', u, v);
  return finish(pos, uvs);
}

/**
 * A flat decoration on one face of a lot, from the trim atlas: a door, a shop window, a sign.
 * `along` is where across the face it is centred, `y0`/`y1` its bottom and top; it stands a hair
 * proud of the wall so it never fights it for depth.
 */
function onFace(face: Facing, x0: number, x1: number, z0: number, z1: number, along: number, width: number, y0: number, y1: number, cell: readonly [number, number, number, number], proud = 0.04): THREE.BufferGeometry {
  const [cu, cv, cw, ch] = cell;
  const au = cu / 4;
  const bu = (cu + cw) / 4;
  const av = 1 - (cv + ch) / 2;
  const bv = 1 - cv / 2;
  const h = width / 2;
  let corners: [V3, V3, V3, V3];
  if (face === 'south') corners = [[along - h, y0, z1 + proud], [along + h, y0, z1 + proud], [along + h, y1, z1 + proud], [along - h, y1, z1 + proud]];
  else if (face === 'north') corners = [[along + h, y0, z0 - proud], [along - h, y0, z0 - proud], [along - h, y1, z0 - proud], [along + h, y1, z0 - proud]];
  else if (face === 'east') corners = [[x1 + proud, y0, along + h], [x1 + proud, y0, along - h], [x1 + proud, y1, along - h], [x1 + proud, y1, along + h]];
  else corners = [[x0 - proud, y0, along - h], [x0 - proud, y0, along + h], [x0 - proud, y1, along + h], [x0 - proud, y1, along - h]];
  const pos: number[] = [];
  const uvs: number[] = [];
  const [p0, p1, p2, p3] = corners;
  for (const [p, u, v] of [
    [p0, au, av],
    [p1, bu, av],
    [p2, bu, bv],
    [p0, au, av],
    [p2, bu, bv],
    [p3, au, bv],
  ] as [V3, number, number][]) {
    pos.push(p[0], p[1], p[2]);
    uvs.push(u, v);
  }
  return finish(pos, uvs);
}

/** A sloping awning out from a face over its door or shop window. */
function awningOn(face: Facing, x0: number, x1: number, z0: number, z1: number, along: number, width: number, at: number, reach: number): THREE.BufferGeometry {
  const [cu, cv, cw, ch] = TRIM.awning;
  const au = cu / 4;
  const bu = (cu + cw) / 4;
  const av = 1 - (cv + ch) / 2;
  const bv = 1 - cv / 2;
  const h = width / 2;
  const low = at - reach * 0.45;
  let q: [V3, V3, V3, V3];
  if (face === 'south') q = [[along - h, low, z1 + reach], [along + h, low, z1 + reach], [along + h, at, z1 + 0.05], [along - h, at, z1 + 0.05]];
  else if (face === 'north') q = [[along + h, low, z0 - reach], [along - h, low, z0 - reach], [along - h, at, z0 - 0.05], [along + h, at, z0 - 0.05]];
  else if (face === 'east') q = [[x1 + reach, low, along + h], [x1 + reach, low, along - h], [x1 + 0.05, at, along - h], [x1 + 0.05, at, along + h]];
  else q = [[x0 - reach, low, along - h], [x0 - reach, low, along + h], [x0 - 0.05, at, along + h], [x0 - 0.05, at, along - h]];
  const pos: number[] = [];
  const uvs: number[] = [];
  const [p0, p1, p2, p3] = q;
  for (const [p, u, v] of [
    [p0, au, av],
    [p1, bu, av],
    [p2, bu, bv],
    [p0, au, av],
    [p2, bu, bv],
    [p3, au, bv],
  ] as [V3, number, number][]) {
    pos.push(p[0], p[1], p[2]);
    uvs.push(u, v);
  }
  // Both sides, because it is seen from under as well as over.
  const g = finish(pos, uvs);
  const back = g.clone();
  const idx = back.getAttribute('position') as THREE.BufferAttribute;
  const uv = back.getAttribute('uv') as THREE.BufferAttribute;
  for (let t = 0; t < idx.count; t += 3) {
    for (const attr of [idx, uv]) {
      const k = attr.itemSize;
      for (let c = 0; c < k; c++) {
        const tmp = attr.getComponent(t + 1, c);
        attr.setComponent(t + 1, c, attr.getComponent(t + 2, c));
        attr.setComponent(t + 2, c, tmp);
      }
    }
  }
  back.computeVertexNormals();
  return mergeGeometries([g, back])!;
}

/** Converts any three.js geometry to the non-indexed, uv'd form everything here merges in. */
function plain(g: THREE.BufferGeometry, surface: SurfaceKey): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('normal');
  // World-unit UVs: planar from the side, which for lumpy masses is what reads as texture.
  const p = ng.getAttribute('position') as THREE.BufferAttribute;
  const [su, sv] = UV[surface];
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + p.getZ(i)) / su;
    uv[i * 2 + 1] = p.getY(i) / sv;
  }
  ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  ng.computeVertexNormals();
  return ng;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return parts.length === 1 ? parts[0]! : mergeGeometries(parts)!;
}

/* ------------------------------------------------------------------------------------------ *
 * The builders.
 * ------------------------------------------------------------------------------------------ */

/** A roof's share of a building's height, by style: a cottage is mostly roof, a warehouse none. */
const ROOF_SHARE: Partial<Record<SolidStyle, number>> = {
  terrace: 0.3,
  shopfront: 0.28,
  cottage: 0.42,
  hall: 0.36,
  tower: 0.3,
};

function house(p: SolidPiece, rng: RngState): BuiltPiece {
  const { x0, x1, z0, z1, height: H, style } = p;
  const w = x1 - x0;
  const d = z1 - z0;
  const facing = p.facing ?? 'south';
  const streetAlongX = facing === 'north' || facing === 'south';
  const parts: BuiltPart[] = [];
  const chimneys: THREE.Vector3[] = [];

  // The height budget is the whole building, roof included: the roof comes out of it, never on
  // top of it. A warehouse is flat-roofed, with a parapet inside the budget.
  const share = ROOF_SHARE[style] ?? 0;
  const span = streetAlongX ? d : w;
  const roofH = style === 'tower' ? Math.min(H * share, Math.max(w, d) * 0.9) : Math.min(H * share, span * (style === 'cottage' || style === 'hall' ? 0.62 : 0.45));
  const wallH = style === 'warehouse' ? H - 0.35 : H - roofH;
  parts.push({ surface: 'facade', geometry: walls(x0, x1, z0, z1, wallH, 'facade'), glows: true });

  if (style === 'warehouse') {
    // The flat roof, in the roof's own surface -- the facade's windows on a lid would be a
    // skylight on every warehouse in the ward.
    const lid: number[] = [];
    const lidUv: number[] = [];
    quad(lid, lidUv, [x0, wallH, z1], [x1, wallH, z1], [x1, wallH, z0], [x0, wallH, z0], 'roof', (q) => q[0], (q) => -q[2]);
    parts.push({ surface: 'roof', geometry: finish(lid, lidUv) });
    // A parapet round a flat roof, within the budget.
    const t = 0.25;
    const para = merged([
      walls(x0, x1, z1 - t, z1, 0.35, 'wall'),
      walls(x0, x1, z0, z0 + t, 0.35, 'wall'),
      walls(x0, x0 + t, z0, z1, 0.35, 'wall'),
      walls(x1 - t, x1, z0, z1, 0.35, 'wall'),
    ]);
    para.translate(0, wallH, 0);
    parts.push({ surface: 'wall', geometry: para });
  } else if (style === 'tower') {
    parts.push({ surface: 'roof', geometry: pyramid(x0, x1, z0, z1, wallH, roofH, 0.25) });
  } else {
    const g = gable(x0, x1, z0, z1, wallH, roofH, streetAlongX, style === 'cottage' ? 0.35 : 0.25);
    parts.push({ surface: 'roof', geometry: g.roof });
    parts.push({ surface: 'facade', geometry: g.ends, glows: true });
  }

  // A chimney, standing on the back slope and inside the budget.
  if (p.chimney && style !== 'tower') {
    const cw = 0.55;
    const cx = streetAlongX ? x0 + w * (0.25 + nextFloat(rng) * 0.5) : (x0 + x1) / 2 + (facing === 'east' ? -w * 0.2 : w * 0.2);
    const cz = streetAlongX ? (z0 + z1) / 2 + (facing === 'south' ? -d * 0.2 : d * 0.2) : z0 + d * (0.25 + nextFloat(rng) * 0.5);
    const base = wallH * 0.8;
    const stackTop = Math.min(H, wallH + roofH * 0.95);
    const stack = walls(cx - cw / 2, cx + cw / 2, cz - cw / 2, cz + cw / 2, stackTop - base, 'wall', true);
    stack.translate(0, base, 0);
    parts.push({ surface: 'wall', geometry: stack });
    chimneys.push(new THREE.Vector3(cx, stackTop, cz));
  }

  // What is on the street face: a door, and for a shop its window, sign and awning.
  const trims: THREE.BufferGeometry[] = [];
  const faceLen = streetAlongX ? w : d;
  const mid = streetAlongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
  // A door never taller than the wall it is in: a low cottage's eaves come down to meet it.
  const doorH = Math.min(2.05, wallH - 0.2);
  if (!p.hasDoor && faceLen >= 1.6 && doorH > 1.2) {
    if (style === 'warehouse') {
      trims.push(onFace(facing, x0, x1, z0, z1, mid, Math.min(2.4, faceLen - 0.6), 0, Math.min(2.8, wallH - 0.3), TRIM.loading));
    } else if (style === 'shopfront' && faceLen >= 3 && wallH > 2.9) {
      const shopW = Math.min(faceLen - 1.6, 3.2);
      trims.push(onFace(facing, x0, x1, z0, z1, mid - 0.55, shopW, 0.35, 2.1, TRIM.shop));
      trims.push(onFace(facing, x0, x1, z0, z1, mid + shopW / 2 + 0.05, 0.95, 0, doorH, TRIM.door));
      trims.push(awningOn(facing, x0, x1, z0, z1, mid, Math.min(faceLen - 0.3, shopW + 1.4), 2.55, 1.1));
      // The sign above the awning, where there is wall for one.
      if (wallH > 3.6) trims.push(onFace(facing, x0, x1, z0, z1, mid, 1.2, 2.75, 3.45, TRIM.sign, 0.06));
    } else {
      trims.push(onFace(facing, x0, x1, z0, z1, mid, 1.0, 0, doorH, TRIM.door));
    }
  }
  if (trims.length > 0) parts.push({ surface: 'trim', geometry: merged(trims) });

  return { parts, top: H, chimneys };
}

function wallRun(p: SolidPiece): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const coping = 0.22;
  const body = walls(x0, x1, z0, z1, H - coping, 'wall', false);
  const cap = walls(x0 - 0.12, x1 + 0.12, z0 - 0.12, z1 + 0.12, coping, 'wall', true);
  cap.translate(0, H - coping, 0);
  return { parts: [{ surface: 'wall', geometry: merged([body, cap]) }], top: H, chimneys: [] };
}

function stall(p: SolidPiece): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const facing = p.facing ?? 'south';
  const counterH = Math.min(1.05, H * 0.5);
  const counter = walls(x0 + 0.1, x1 - 0.1, z0 + 0.1, z1 - 0.1, counterH, 'wall', true);
  // A canvas over the whole stall, high at the back and sloping down toward the customer.
  const low = Math.max(counterH + 0.5, H * 0.78);
  const [cu, cv, cw, ch] = TRIM.awning;
  const au = cu / 4;
  const bu = (cu + cw) / 4;
  const av = 1 - (cv + ch) / 2;
  const bv = 1 - cv / 2;
  const corner = (f: Facing): [V3, V3, V3, V3] => {
    // Front-left, front-right, back-right, back-left, seen from the customer.
    if (f === 'south') return [[x0, low, z1], [x1, low, z1], [x1, H, z0], [x0, H, z0]];
    if (f === 'north') return [[x1, low, z0], [x0, low, z0], [x0, H, z1], [x1, H, z1]];
    if (f === 'east') return [[x1, low, z1], [x1, low, z0], [x0, H, z0], [x0, H, z1]];
    return [[x0, low, z0], [x0, low, z1], [x1, H, z1], [x1, H, z0]];
  };
  const [q0, q1, q2, q3] = corner(facing);
  const cpos: number[] = [];
  const cuv: number[] = [];
  for (const [q, u, v] of [
    [q0, au, av],
    [q1, bu, av],
    [q2, bu, bv],
    [q0, au, av],
    [q2, bu, bv],
    [q3, au, bv],
    // And from underneath.
    [q0, au, av],
    [q2, bu, bv],
    [q1, bu, av],
    [q0, au, av],
    [q3, au, bv],
    [q2, bu, bv],
  ] as [V3, number, number][]) {
    cpos.push(q[0], q[1], q[2]);
    cuv.push(u, v);
  }
  const canvas = finish(cpos, cuv);
  const posts: THREE.BufferGeometry[] = [];
  for (const [px, pz] of [
    [x0 + 0.15, z0 + 0.15],
    [x1 - 0.15, z0 + 0.15],
    [x0 + 0.15, z1 - 0.15],
    [x1 - 0.15, z1 - 0.15],
  ] as const) {
    posts.push(walls(px - 0.06, px + 0.06, pz - 0.06, pz + 0.06, H * 0.92, 'wall'));
  }
  return {
    parts: [
      { surface: 'wall', geometry: merged([counter, ...posts]) },
      { surface: 'trim', geometry: canvas },
    ],
    top: H,
    chimneys: [],
  };
}

/** Pushes a lumpy mass's vertices about with noise, keeping it inside its footprint and budget. */
function rough(g: THREE.BufferGeometry, seed: number, amp: number, box: { x0: number; x1: number; z0: number; z1: number; top: number }): void {
  const n = makeNoise2D(seed);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (y <= 0.001) continue; // the base stays on the ground
    const k = n(x * 0.45 + y * 0.3, z * 0.45 - y * 0.3);
    const k2 = n(z * 0.5 + 11, x * 0.5 - 7);
    p.setXYZ(
      i,
      Math.min(box.x1, Math.max(box.x0, x + k * amp)),
      Math.min(box.top, Math.max(0, y + k2 * amp * 0.6)),
      Math.min(box.z1, Math.max(box.z0, z + k2 * amp)),
    );
  }
  p.needsUpdate = true;
}

function rock(p: SolidPiece): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const w = x1 - x0;
  const d = z1 - z0;
  const g = new THREE.BoxGeometry(w, H, d, Math.max(2, Math.round(w / 1.5)), Math.max(2, Math.round(H / 1.5)), Math.max(2, Math.round(d / 1.5)));
  g.translate((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
  const ng = g.toNonIndexed();
  // Slumped: the top pulled in toward the middle, so it reads as rock and not as masonry.
  const pos = ng.getAttribute('position') as THREE.BufferAttribute;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 - 0.22 * (y / H);
    pos.setX(i, cx + (pos.getX(i) - cx) * k);
    pos.setZ(i, cz + (pos.getZ(i) - cz) * k);
  }
  rough(ng, p.seed, 0.45, { x0, x1, z0, z1, top: H });
  return { parts: [{ surface: 'rock', geometry: plain(ng, 'rock') }], top: H, chimneys: [] };
}

function mound(p: SolidPiece): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const g = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale((x1 - x0) / 2, H, (z1 - z0) / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const ng = g.toNonIndexed();
  rough(ng, p.seed, 0.3, { x0, x1, z0, z1, top: H });
  return { parts: [{ surface: 'turf', geometry: plain(ng, 'turf') }], top: H, chimneys: [] };
}

/**
 * Leaf masses: overlapping blobs covering the footprint, the tallest reaching the budget.
 *
 * On a jittered grid rather than scattered, so a thicket covers its ground: scattered blobs
 * bunch, and a thicket with a bare patch at its front edge reads as two bushes and a lawn. A
 * low course fills the footprint and a high course, set between the low one's centres, gives it
 * a crown.
 */
function blobs(p: SolidPiece, rng: RngState, fromY: number, radius: number): THREE.BufferGeometry {
  const { x0, x1, z0, z1, height: H } = p;
  const w = x1 - x0;
  const d = z1 - z0;
  const out: THREE.BufferGeometry[] = [];
  const step = radius * 1.35;
  const nx = Math.max(1, Math.round(w / step));
  const nz = Math.max(1, Math.round(d / step));
  const tall = H - fromY;
  let i = 0;
  for (const course of [0, 1]) {
    for (let a = 0; a < nx + (course ? -1 : 0); a++) {
      for (let b = 0; b < nz + (course ? -1 : 0); b++) {
        if (course && nx + nz <= 2) continue;
        const r = radius * (0.8 + nextFloat(rng) * 0.35);
        const rx = Math.min(r, w / 2);
        const rz = Math.min(r, d / 2);
        const ry = Math.min(r * (0.85 + nextFloat(rng) * 0.3), tall / (course ? 2.2 : 2.6));
        const fx = (a + 0.5 + (course ? 0.5 : 0)) / nx;
        const fz = (b + 0.5 + (course ? 0.5 : 0)) / nz;
        const cx = Math.min(x1 - rx, Math.max(x0 + rx, x0 + fx * w + (nextFloat(rng) - 0.5) * step * 0.4));
        const cz = Math.min(z1 - rz, Math.max(z0 + rz, z0 + fz * d + (nextFloat(rng) - 0.5) * step * 0.4));
        // The low course sits on its base; the high one reaches the top of the budget.
        const cy = course ? H - ry * (1 + nextFloat(rng) * 0.2) : fromY + ry + nextFloat(rng) * Math.max(0, tall * 0.45 - ry);
        const g = new THREE.IcosahedronGeometry(1, 1);
        g.scale(rx, ry, rz);
        g.translate(cx, cy, cz);
        const ng = g.toNonIndexed();
        rough(ng, p.seed + i++ * 17, Math.min(rx, rz) * 0.18, { x0, x1, z0, z1, top: H });
        out.push(plain(ng, 'leaf'));
      }
    }
  }
  return merged(out);
}

function foliage(p: SolidPiece, rng: RngState): BuiltPiece {
  return { parts: [{ surface: 'leaf', geometry: blobs(p, rng, 0, 1.5) }], top: p.height, chimneys: [] };
}

function forest(p: SolidPiece, rng: RngState): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const trunks: THREE.BufferGeometry[] = [];
  const crownFrom = H * 0.4;
  // A trunk a tile, roughly, set off-centre so the stand does not read as planted.
  for (let x = x0 + 2; x < x1; x += 4) {
    for (let z = z0 + 2; z < z1; z += 4) {
      const tx = Math.min(x1 - 0.5, Math.max(x0 + 0.5, x + (nextFloat(rng) - 0.5) * 1.6));
      const tz = Math.min(z1 - 0.5, Math.max(z0 + 0.5, z + (nextFloat(rng) - 0.5) * 1.6));
      const r = 0.22 + nextFloat(rng) * 0.16;
      const t = new THREE.CylinderGeometry(r * 0.75, r, crownFrom + 0.6, 6);
      t.translate(tx, (crownFrom + 0.6) / 2, tz);
      trunks.push(plain(t, 'bark'));
    }
  }
  const parts: BuiltPart[] = [{ surface: 'leaf', geometry: blobs(p, rng, crownFrom, 1.8) }];
  if (trunks.length > 0) parts.push({ surface: 'bark', geometry: merged(trunks) });
  return { parts, top: H, chimneys: [] };
}

function ice(p: SolidPiece, rng: RngState): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const w = x1 - x0;
  const d = z1 - z0;
  const out: THREE.BufferGeometry[] = [];
  const count = Math.max(2, Math.round((w * d) / 3));
  for (let i = 0; i < count; i++) {
    const r = 0.5 + nextFloat(rng) * 0.7;
    const h = H * (0.45 + nextFloat(rng) * 0.55);
    const g = new THREE.ConeGeometry(Math.min(r, w / 2, d / 2), h, 5);
    g.rotateY(nextFloat(rng) * Math.PI);
    g.translate(x0 + Math.min(r, w / 2) + nextFloat(rng) * Math.max(0, w - 2 * r), h / 2, z0 + Math.min(r, d / 2) + nextFloat(rng) * Math.max(0, d - 2 * r));
    out.push(plain(g, 'ice'));
  }
  return { parts: [{ surface: 'ice', geometry: merged(out) }], top: H, chimneys: [] };
}

function pylon(p: SolidPiece): BuiltPiece {
  const { x0, x1, z0, z1, height: H } = p;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const base = Math.min(x1 - x0, z1 - z0) / 2 - 0.1;
  const topW = base * 0.25;
  const legs: THREE.BufferGeometry[] = [];
  // Four legs leaning in, braced every few units, capped with a crossarm.
  const leg = (sx: number, sz: number): void => {
    // Thick enough to read from a camera looking down at fifty degrees: thinner and a pylon
    // is four hairlines over a dark square.
    const g = new THREE.CylinderGeometry(0.16, 0.22, H * 0.92, 4);
    const lean = Math.atan2(base - topW, H * 0.92);
    g.rotateZ(sx * lean);
    g.rotateX(-sz * lean);
    g.translate(cx + sx * (base + topW) / 2, (H * 0.92) / 2, cz + sz * (base + topW) / 2);
    legs.push(plain(g, 'iron'));
  };
  leg(1, 1);
  leg(-1, 1);
  leg(1, -1);
  leg(-1, -1);
  for (let y = 1.6; y < H * 0.85; y += 2.2) {
    const k = base - (base - topW) * (y / (H * 0.92));
    legs.push(plain(walls(cx - k, cx + k, cz - 0.09, cz + 0.09, 0.18, 'iron', true).translate(0, y, 0), 'iron'));
    legs.push(plain(walls(cx - 0.09, cx + 0.09, cz - k, cz + k, 0.18, 'iron', true).translate(0, y, 0), 'iron'));
  }
  const arm = walls(cx - base, cx + base, cz - 0.14, cz + 0.14, 0.3, 'iron', true);
  arm.translate(0, H - 0.75, 0);
  legs.push(plain(arm, 'iron'));
  // The footing it is bolted to, and the insulators at the arm's ends, which catch the light the
  // way the whole Shelf is afraid they will.
  const footing = plain(walls(x0, x1, z0, z1, 0.55, 'rock', true), 'rock');
  const insulators = merged(
    [-1, 1].map((s) => plain(walls(cx + s * base - 0.16, cx + s * base + 0.16, cz - 0.16, cz + 0.16, 0.45, 'ice', true).translate(0, H - 0.45, 0), 'ice')),
  );
  return {
    parts: [
      { surface: 'iron', geometry: merged(legs) },
      { surface: 'rock', geometry: footing },
      { surface: 'ice', geometry: insulators },
    ],
    top: H,
    chimneys: [],
  };
}

/** Everything built on one piece, in the style it asks for. */
export function buildPiece(p: SolidPiece): BuiltPiece {
  const rng = makeRng(p.seed);
  if (BUILT.has(p.style)) return house(p, rng);
  if (p.style === 'wall') return wallRun(p);
  if (p.style === 'stall') return stall(p);
  if (p.style === 'rock') return rock(p);
  if (p.style === 'mound') return mound(p);
  if (p.style === 'foliage') return foliage(p, rng);
  if (p.style === 'forest') return forest(p, rng);
  if (p.style === 'ice') return ice(p, rng);
  if (p.style === 'pylon') return pylon(p);
  return { parts: [{ surface: 'wall', geometry: walls(p.x0, p.x1, p.z0, p.z1, p.height, 'wall', true) }], top: p.height, chimneys: [] };
}
