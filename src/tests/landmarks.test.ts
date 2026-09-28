/**
 * The landmarks, measured: under their height, inside their footprint (a moving part may reach
 * past it, by as much as it says), and wherever an area stands one, on ground that exists.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LANDMARKS, LANDMARK_IDS, buildLandmark, moverAngle } from '../district/landmarks.js';
import { AREAS } from '../district/areas/index.js';
import { isWalkable } from '../district/map.js';

describe('every landmark', () => {
  for (const id of LANDMARK_IDS) {
    it(`${id}: stands inside its footprint and under its height, whatever its seed`, () => {
      const k = LANDMARKS[id];
      for (const seed of [1, 99, 4242]) {
        const built = buildLandmark(id, seed);
        for (const part of built.parts) {
          part.geometry.computeBoundingBox();
          const b = part.geometry.boundingBox!;
          expect(b.max.y, `${id} ${part.surface}`).toBeLessThanOrEqual(k.height + 1e-4);
          expect(b.min.y).toBeGreaterThanOrEqual(-0.01);
          const over = (k.overhang ?? 0) + 0.3;
          expect(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), `${id} ${part.surface} x`).toBeLessThanOrEqual(k.w / 2 + over);
          expect(Math.max(Math.abs(b.min.z), Math.abs(b.max.z)), `${id} ${part.surface} z`).toBeLessThanOrEqual(k.d / 2 + over);
        }
        for (const m of built.movers) {
          // Swept through its whole motion, vertex by vertex: never above the budget, never
          // further out than its reach.
          const p = m.geometry.getAttribute('position') as THREE.BufferAttribute;
          const q = new THREE.Quaternion();
          const v = new THREE.Vector3();
          let top = -Infinity;
          let out = 0;
          const steps = 24;
          for (let s = 0; s <= steps; s++) {
            const a = m.motion === 'spin' ? (s / steps) * Math.PI * 2 : -m.amount + (2 * m.amount * s) / steps;
            q.setFromAxisAngle(m.axis, a);
            for (let i = 0; i < p.count; i++) {
              v.fromBufferAttribute(p, i).applyQuaternion(q).add(m.pivot);
              top = Math.max(top, v.y);
              out = Math.max(out, Math.hypot(v.x, v.z));
            }
          }
          expect(top, `${id} mover height`).toBeLessThanOrEqual(k.height + 1e-4);
          expect(out, `${id} mover reach`).toBeLessThanOrEqual(Math.max(k.w, k.d) / 2 + m.reach + 1e-4);
        }
      }
    });
  }

  it('moves: a spin turns steadily, a swing goes both ways and comes back', () => {
    const mill = buildLandmark('windmill', 1).movers[0]!;
    expect(moverAngle(mill, 2, 0)).toBeGreaterThan(moverAngle(mill, 1, 0));
    const bell = buildLandmark('bell_tower', 1).movers[0]!;
    const angles = Array.from({ length: 40 }, (_, i) => moverAngle(bell, i * 0.1, 0));
    expect(Math.min(...angles)).toBeLessThan(0);
    expect(Math.max(...angles)).toBeGreaterThan(0);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(bell.amount + 1e-9);
  });

  it('is built from real geometry', () => {
    for (const id of LANDMARK_IDS) {
      const built = buildLandmark(id, 7);
      expect(built.parts.length + built.movers.length).toBeGreaterThan(0);
      for (const g of [...built.parts.map((p) => p.geometry), ...built.movers.map((m) => m.geometry)]) {
        expect((g.getAttribute('position') as THREE.BufferAttribute).count).toBeGreaterThan(0);
        expect(g.getAttribute('uv')).toBeDefined();
      }
    }
  });
});

describe('where a landmark stands', () => {
  it('is on walkable ground, all the way across its footprint, in every area that has one', () => {
    for (const area of AREAS) {
      for (const l of area.props.landmarks ?? []) {
        const k = LANDMARKS[l.kind];
        for (const [dx, dz] of [
          [0, 0],
          [-k.w / 2, -k.d / 2],
          [k.w / 2, -k.d / 2],
          [-k.w / 2, k.d / 2],
          [k.w / 2, k.d / 2],
        ] as const) {
          expect(isWalkable(area, l.x + dx, l.z + dz), `${area.id}: ${l.kind} at ${l.x},${l.z} hangs over a wall`).toBe(true);
        }
      }
    }
  });
});
