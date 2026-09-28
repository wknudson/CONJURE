/**
 * The one tall thing in each place that you steer by.
 *
 * Every area had its identity in its layout and its colour and nothing standing up out of it:
 * from the walk camera there was no way to tell where the mill was from the far side of
 * Millharrow, because there was no mill to see, only a mill-shaped block of tiles. A landmark is
 * the thing a theme-park designer calls a weenie -- tall, particular, visible over the roofs,
 * moving, so the eye goes to it and the feet follow.
 *
 * Built from the kit's own surfaces (`buildings.ts` `SurfaceKey`) plus one moving part each: the
 * sails turn, the bell swings, the beam sweeps, the cage sways, the flare breathes. The world
 * builds the meshes and turns each moving part by `moverAngle` every frame (`updateLandmarks`);
 * this file only says what the parts are and how they move. A landmark stands on a footprint the
 * colliders learn like any prop's.
 *
 * Pure of the DOM, so what it builds can be measured: every landmark stays inside its footprint
 * (its moving part may overhang by its reach) and under its height.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, nextFloat } from '../core/util/rng.js';
import type { SurfaceKey } from './buildings.js';

export type LandmarkId =
  | 'windmill'
  | 'bell_tower'
  | 'lighthouse'
  | 'gibbet'
  | 'stone_circle'
  | 'great_tree'
  | 'water_tower'
  | 'furnace_stack'
  | 'crane'
  | 'gasholder'
  | 'toll_bar'
  | 'water_wheel'
  | 'beam_engine';

export interface LandmarkKind {
  /** The footprint the colliders learn, centred on the landmark, in world units. */
  readonly w: number;
  readonly d: number;
  /** The height budget, moving part included. */
  readonly height: number;
  /**
   * How far a fixed part may spread past the footprint overhead -- a gibbet's arm, a dead tree's
   * limbs. Over the head, so it stops nobody; the footprint is what stands on the ground.
   */
  readonly overhang?: number;
  readonly note: string;
}

export const LANDMARKS: Readonly<Record<LandmarkId, LandmarkKind>> = {
  windmill: { w: 3.2, d: 3.2, height: 13, note: 'A post mill on its mound, the sails turning whenever there is wind, which is always.' },
  bell_tower: { w: 3.6, d: 3.6, height: 15, note: 'A square tower with its bell in the open top, swinging on the hour.' },
  lighthouse: { w: 3.4, d: 3.4, height: 16, note: 'A round light over the salt, its beam sweeping at night.' },
  gibbet: { w: 1.6, d: 1.6, height: 6.5, overhang: 0.6, note: 'A post, an arm, and a cage on a chain, turning in the wind.' },
  stone_circle: { w: 9, d: 9, height: 3.6, note: 'Nine standing stones in a ring, one fallen.' },
  great_tree: { w: 3.2, d: 3.2, height: 17, overhang: 3.6, note: 'A dead ash older than the wood around it, bare-armed over the canopy.' },
  water_tower: { w: 4, d: 4, height: 11, note: 'A tank on iron legs, dripping.' },
  furnace_stack: { w: 3, d: 3, height: 18, note: 'A brick stack over the works, a flare breathing at its lip.' },
  crane: { w: 2.4, d: 2.4, height: 8.5, note: 'A quay crane on a timber mast, its jib slewing out over the water and back.' },
  gasholder: { w: 8.4, d: 8.4, height: 9, note: 'A gas bell in its iron frame, a lamp on the valve, the valve wheel turning.' },
  toll_bar: { w: 1.2, d: 1.2, height: 9, note: 'A striped boom on a post, raised on its counterweight over the road, rocking for carts that do not come.' },
  water_wheel: { w: 1.2, d: 1.2, height: 4.4, note: 'An undershot wheel standing in the race off its bearing post, turning because the water does.' },
  beam_engine: { w: 3.6, d: 3.6, height: 11, note: 'A pumping engine: the house, its stack, and the great beam rocking on the wall-top.' },
};

export const LANDMARK_IDS = Object.keys(LANDMARKS) as readonly LandmarkId[];

export function isLandmarkId(s: string): s is LandmarkId {
  return s in LANDMARKS;
}

/** One surface's geometry, fixed in place. */
export interface LandmarkPart {
  readonly surface: SurfaceKey | 'glow';
  readonly geometry: THREE.BufferGeometry;
}

/**
 * The moving part: a geometry, the pivot it moves about (relative to the landmark's centre), and
 * how it moves -- `spin` about an axis at a rate, `swing` back and forth by an angle.
 */
export interface LandmarkMover {
  readonly surface: SurfaceKey | 'glow';
  readonly geometry: THREE.BufferGeometry;
  readonly pivot: THREE.Vector3;
  readonly axis: THREE.Vector3;
  readonly motion: 'spin' | 'swing';
  /** Radians a second for a spin; radians either way for a swing. */
  readonly amount: number;
  /** Seconds per swing; ignored for a spin. */
  readonly period?: number;
  /** How far the moving part can reach past the footprint, for the budget test. */
  readonly reach: number;
}

export interface BuiltLandmark {
  readonly parts: LandmarkPart[];
  readonly movers: LandmarkMover[];
  /** A light it casts, relative to its centre, if it lights anything. */
  readonly light?: { readonly at: THREE.Vector3; readonly color: string };
}

/* ------------------------------------------------------------------------------------------ */

function uvify(g: THREE.BufferGeometry, su = 2, sv = 2): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const p = ng.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + p.getZ(i)) / su;
    uv[i * 2 + 1] = p.getY(i) / sv;
  }
  ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  ng.computeVertexNormals();
  return ng;
}

const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0): THREE.BufferGeometry =>
  uvify(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
const cyl = (r0: number, r1: number, h: number, seg: number, x = 0, y = h / 2, z = 0): THREE.BufferGeometry =>
  uvify(new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y, z));
const cone = (r: number, h: number, seg: number, x = 0, y = h / 2, z = 0): THREE.BufferGeometry =>
  uvify(new THREE.ConeGeometry(r, h, seg).translate(x, y, z));
const join = (gs: THREE.BufferGeometry[]): THREE.BufferGeometry => (gs.length === 1 ? gs[0]! : mergeGeometries(gs)!);

/** What a landmark is made of. `seed` varies the details that should not repeat between two. */
export function buildLandmark(id: LandmarkId, seed: number): BuiltLandmark {
  const rng = makeRng(seed);
  const k = LANDMARKS[id];
  if (id === 'windmill') {
    const body = join([cyl(1.5, 1.1, 7.2, 8), cone(1.35, 2.2, 8, 0, 8.3)]);
    const hub = new THREE.Vector3(0, 6.6, 1.5);
    const sails: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const s = box(0.9, 5.4, 0.08, 0, 2.9, 0);
      s.rotateZ((i * Math.PI) / 2);
      sails.push(s);
    }
    const blades = join(sails);
    return {
      parts: [
        { surface: 'wall', geometry: body },
        { surface: 'roof', geometry: cone(1.4, 0.01, 8, 0, 7.2) },
      ],
      movers: [{ surface: 'bark', geometry: blades, pivot: hub, axis: new THREE.Vector3(0, 0, 1), motion: 'spin', amount: 0.55, reach: 4.6 }],
    };
  }
  if (id === 'bell_tower') {
    const shaft = box(3.2, 10.5, 3.2);
    const posts = join([
      box(0.4, 2.4, 0.4, -1.4, 11.7, -1.4),
      box(0.4, 2.4, 0.4, 1.4, 11.7, -1.4),
      box(0.4, 2.4, 0.4, -1.4, 11.7, 1.4),
      box(0.4, 2.4, 0.4, 1.4, 11.7, 1.4),
    ]);
    const cap = cone(2.4, 2.1, 4, 0, 13.9);
    cap.rotateY(Math.PI / 4);
    const bell = join([cone(0.75, 1.1, 10, 0, -0.9, 0), cyl(0.12, 0.12, 0.35, 6, 0, -0.2, 0)]);
    return {
      parts: [
        { surface: 'facade', geometry: shaft },
        { surface: 'wall', geometry: posts },
        { surface: 'roof', geometry: cap },
      ],
      movers: [{ surface: 'iron', geometry: bell, pivot: new THREE.Vector3(0, 12.8, 0), axis: new THREE.Vector3(1, 0, 0), motion: 'swing', amount: 0.35, period: 2.4, reach: 0.5 }],
    };
  }
  if (id === 'lighthouse') {
    const tower = join([cyl(1.6, 1.1, 12.5, 12), cyl(1.35, 1.35, 0.4, 12, 0, 12.7)]);
    const lamp = cyl(0.8, 0.8, 1.4, 10, 0, 13.6);
    const top = cone(1.2, 1.4, 10, 0, 15.0);
    // The beam: a long thin wedge from the lamp, sweeping round.
    const beam = uvify(new THREE.ConeGeometry(1.6, 16, 10, 1, true).rotateZ(Math.PI / 2).translate(8.2, 0, 0));
    return {
      parts: [
        { surface: 'wall', geometry: tower },
        { surface: 'glow', geometry: lamp },
        { surface: 'roof', geometry: top },
      ],
      movers: [{ surface: 'glow', geometry: beam, pivot: new THREE.Vector3(0, 13.6, 0), axis: new THREE.Vector3(0, 1, 0), motion: 'spin', amount: 0.6, reach: 16 }],
      light: { at: new THREE.Vector3(0, 13.6, 0), color: '#ffe0a0' },
    };
  }
  if (id === 'crane') {
    // A mast on a braced foot with its winch; the jib points north, over the water a canal quay
    // has on that side, and slews on the mast head with a rope and a hook hung off its end.
    const mast = join([box(2.2, 0.5, 2.2), box(0.5, 7, 0.5, 0, 4), box(0.9, 0.7, 0.6, 0, 1.4, 0.55), box(0.7, 0.3, 0.7, 0, 7.65)]);
    const jib = join([
      box(0.3, 0.3, 4.4, 0, 0, -2.0),
      box(0.7, 0.6, 0.7, 0, 0, 0.6),
      box(0.05, 2.4, 0.05, 0, -1.35, -4.0),
      box(0.28, 0.32, 0.28, 0, -2.7, -4.0),
    ]);
    return {
      parts: [{ surface: 'bark', geometry: mast }],
      movers: [{ surface: 'bark', geometry: jib, pivot: new THREE.Vector3(0, 6.6, 0), axis: new THREE.Vector3(0, 1, 0), motion: 'swing', amount: 0.6, period: 11, reach: 3.2 }],
    };
  }
  if (id === 'gasholder') {
    // The bell sits low in its frame: eight columns round it, a girder ring on top, and on the
    // valve stand at the east side a wheel that turns and the lamp the works is known by.
    const bell = join([cyl(3.6, 3.6, 5.4, 16), cyl(3.6, 3.0, 0.9, 16, 0, 5.85)]);
    const frame: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      frame.push(box(0.3, 8.4, 0.3, Math.cos(a) * 3.95, 4.2, Math.sin(a) * 3.95));
      const b = ((i + 0.5) / 8) * Math.PI * 2;
      const girder = box(3.1, 0.25, 0.25, Math.cos(b) * 3.65, 8.3, Math.sin(b) * 3.65);
      girder.translate(-Math.cos(b) * 3.65, -8.3, -Math.sin(b) * 3.65).rotateY(-b + Math.PI / 2).translate(Math.cos(b) * 3.65, 8.3, Math.sin(b) * 3.65);
      frame.push(girder);
    }
    frame.push(box(0.5, 1.6, 0.5, 4.0, 0.8, 0));
    const wheel = uvify(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 10).rotateZ(Math.PI / 2));
    return {
      parts: [
        { surface: 'iron', geometry: bell },
        { surface: 'iron', geometry: join(frame) },
        { surface: 'glow', geometry: box(0.35, 0.35, 0.35, 4.0, 1.85, 0) },
      ],
      movers: [{ surface: 'iron', geometry: wheel, pivot: new THREE.Vector3(4.3, 1.2, 0), axis: new THREE.Vector3(1, 0, 0), motion: 'spin', amount: 0.4, reach: 0.4 }],
      light: { at: new THREE.Vector3(4.0, 2.2, 0), color: '#ffd89a' },
    };
  }
  if (id === 'toll_bar') {
    // A post with its counterweight, and the boom pivoted on the post head: laid south across
    // the road and then raised, so it stands over the road it tolls and never across it.
    const post = join([box(0.4, 3.2, 0.4), box(0.7, 0.3, 0.7, 0, 3.05)]);
    const boom = join([box(0.18, 0.18, 6.4, 0, 0, 2.4), box(0.5, 0.5, 0.6, 0, 0, -1.0)]);
    boom.rotateX(-1.26);
    return {
      parts: [{ surface: 'bark', geometry: post }],
      movers: [{ surface: 'trim', geometry: boom, pivot: new THREE.Vector3(0, 3.2, 0), axis: new THREE.Vector3(1, 0, 0), motion: 'swing', amount: 0.14, period: 6, reach: 2.6 }],
    };
  }
  if (id === 'water_wheel') {
    // The bearing post on the bank, and the wheel hung off it to the west, into the race: a rim
    // of eight staves, a paddle at each, spokes to the hub. It turns in the plane of the flow.
    const post = join([box(0.5, 2.4, 0.7, 0.1, 1.2, 0), box(0.9, 0.2, 0.9, 0.1, 2.5)]);
    const parts: THREE.BufferGeometry[] = [];
    const R = 1.7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stave = box(1.4, 0.18, 0.7, 0, 0, 0);
      stave.rotateZ(a + Math.PI / 2).translate(Math.cos(a) * R, Math.sin(a) * R, 0);
      parts.push(stave);
      const paddle = box(0.12, 0.55, 0.9, 0, 0, 0);
      paddle.rotateZ(a).translate(Math.cos(a) * (R + 0.2), Math.sin(a) * (R + 0.2), 0);
      parts.push(paddle);
      const spoke = box(R, 0.1, 0.1, R / 2, 0, 0);
      spoke.rotateZ(a);
      parts.push(spoke);
    }
    parts.push(uvify(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8).rotateX(Math.PI / 2)));
    return {
      parts: [{ surface: 'bark', geometry: post }],
      movers: [{ surface: 'bark', geometry: join(parts), pivot: new THREE.Vector3(-1.1, 2.1, 0), axis: new THREE.Vector3(0, 0, 1), motion: 'spin', amount: -0.9, reach: 2.6 }],
    };
  }
  if (id === 'beam_engine') {
    // The engine house, its stack at the back corner, and the beam pivoted on the front wall's
    // top: one end over the house, where the cylinder is, the other out over the pump shaft.
    const house = box(3.4, 6.2, 3.0, 0, 3.1, 0.2);
    const stack = cyl(0.55, 0.4, 10.6, 8, 1.2, 5.3, 1.2);
    const gable = cone(2.3, 1.2, 4, 0, 6.8, 0.2);
    gable.rotateY(Math.PI / 4);
    const beam = join([box(0.4, 0.5, 6.0, 0, 0, 0), box(0.12, 1.6, 0.12, 0, -0.8, 2.8), box(0.12, 1.6, 0.12, 0, -0.8, -2.8)]);
    return {
      parts: [
        { surface: 'wall', geometry: house },
        { surface: 'wall', geometry: stack },
        { surface: 'roof', geometry: gable },
      ],
      movers: [{ surface: 'iron', geometry: beam, pivot: new THREE.Vector3(0, 7.6, -1.3), axis: new THREE.Vector3(1, 0, 0), motion: 'swing', amount: 0.22, period: 4.5, reach: 2.7 }],
    };
  }
  if (id === 'gibbet') {
    const post = join([box(0.3, 6, 0.3), box(1.6, 0.25, 0.25, 0.65, 5.8, 0), box(0.12, 0.9, 0.12, 0.35, 5.35, 0)]);
    const cage = join([
      box(0.06, 1.6, 0.06, -0.3, -1.3, -0.3),
      box(0.06, 1.6, 0.06, 0.3, -1.3, -0.3),
      box(0.06, 1.6, 0.06, -0.3, -1.3, 0.3),
      box(0.06, 1.6, 0.06, 0.3, -1.3, 0.3),
      box(0.7, 0.06, 0.7, 0, -0.5, 0),
      box(0.7, 0.06, 0.7, 0, -2.1, 0),
      box(0.04, 0.5, 0.04, 0, -0.25, 0),
    ]);
    return {
      parts: [{ surface: 'bark', geometry: post }],
      movers: [{ surface: 'iron', geometry: cage, pivot: new THREE.Vector3(1.35, 5.7, 0), axis: new THREE.Vector3(0, 1, 0.3).normalize(), motion: 'swing', amount: 0.4, period: 3.6, reach: 1.4 }],
    };
  }
  if (id === 'stone_circle') {
    const stones: THREE.BufferGeometry[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + nextFloat(rng) * 0.15;
      const r = k.w / 2 - 0.6;
      const h = 2.2 + nextFloat(rng) * (k.height - 2.4);
      if (i === 4) {
        // The one that fell.
        const s = box(0.9, 0.7, h, Math.cos(a) * (r - 1), 0.35, Math.sin(a) * (r - 1));
        stones.push(s);
        continue;
      }
      const s = box(0.9 + nextFloat(rng) * 0.4, h, 0.6, 0, h / 2, 0);
      s.rotateY(-a + Math.PI / 2);
      s.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      stones.push(s);
    }
    return { parts: [{ surface: 'rock', geometry: join(stones) }], movers: [] };
  }
  if (id === 'great_tree') {
    const trunk = join([cyl(1.3, 0.8, 9, 8), cyl(0.7, 0.35, 5, 6, 0, 11.5)]);
    const limbs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + nextFloat(rng) * 0.4;
      const len = 3 + nextFloat(rng) * 1.8;
      const l = cyl(0.35, 0.12, len, 5, 0, len / 2, 0);
      l.rotateZ(-0.9 - nextFloat(rng) * 0.35);
      l.rotateY(a);
      l.translate(0, 8 + nextFloat(rng) * 5, 0);
      limbs.push(l);
    }
    return { parts: [{ surface: 'bark', geometry: join([trunk, ...limbs]) }], movers: [] };
  }
  if (id === 'water_tower') {
    const legs = join([
      box(0.3, 7, 0.3, -1.6, 3.5, -1.6),
      box(0.3, 7, 0.3, 1.6, 3.5, -1.6),
      box(0.3, 7, 0.3, -1.6, 3.5, 1.6),
      box(0.3, 7, 0.3, 1.6, 3.5, 1.6),
      box(3.5, 0.2, 0.2, 0, 3.5, 1.6),
      box(3.5, 0.2, 0.2, 0, 3.5, -1.6),
    ]);
    const tank = join([cyl(1.95, 1.95, 3, 12, 0, 8.5), cone(2.05, 1, 12, 0, 10.5)]);
    return { parts: [{ surface: 'iron', geometry: legs }, { surface: 'wall', geometry: tank }], movers: [] };
  }
  // furnace_stack
  const stack = join([box(3, 1.6, 3), cyl(1.3, 0.9, 16, 10, 0, 9.6)]);
  const lip = cyl(1.0, 1.0, 0.5, 10, 0, 17.6);
  return {
    parts: [
      { surface: 'wall', geometry: stack },
      { surface: 'glow', geometry: lip },
    ],
    movers: [],
    light: { at: new THREE.Vector3(0, 17.5, 0), color: '#ff8040' },
  };
}

/** Where a mover stands at time `t`: the rotation to apply about its pivot. */
export function moverAngle(m: LandmarkMover, t: number, phase: number): number {
  if (m.motion === 'spin') return t * m.amount + phase;
  return Math.sin((t / (m.period ?? 3)) * Math.PI * 2 + phase) * m.amount;
}
