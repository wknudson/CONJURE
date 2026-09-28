/**
 * The building kit, measured.
 *
 * What the camera fade and the collider layer both rest on: a piece never rises past the height
 * it was given and never spreads past its footprint -- walls and roofs by no more than an eave,
 * decorations by no more than an awning's reach. And what makes a street a street: a run cut
 * into lots that tile it exactly, the same way every time.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILT, buildPiece, lotsOf, type SolidPiece, type SolidStyle } from '../district/buildings.js';

const STYLES: SolidStyle[] = ['plain', 'terrace', 'shopfront', 'warehouse', 'hall', 'cottage', 'tower', 'wall', 'stall', 'foliage', 'forest', 'rock', 'mound', 'ice', 'pylon'];

const piece = (style: SolidStyle, over: Partial<SolidPiece> = {}): SolidPiece => ({
  style,
  x0: -6,
  x1: 6,
  z0: -4,
  z1: 4,
  height: 6,
  seed: 1234,
  facing: 'south',
  chimney: true,
  ...over,
});

function bounds(g: THREE.BufferGeometry): THREE.Box3 {
  g.computeBoundingBox();
  return g.boundingBox!;
}

describe('the lots a run is cut into', () => {
  it('tile the run exactly, one to three tiles each, the same every time', () => {
    for (let len = 1; len <= 24; len++) {
      for (const seed of [1, 7, 99, 4242]) {
        const lots = lotsOf(len, seed);
        expect(lots.reduce((a, b) => a + b, 0), `len ${len}`).toBe(len);
        for (const l of lots) {
          expect(l).toBeGreaterThanOrEqual(1);
          expect(l).toBeLessThanOrEqual(3);
        }
        expect(lotsOf(len, seed)).toEqual(lots);
      }
    }
  });

  it('are not all the same width on a long terrace', () => {
    const lots = lotsOf(20, 5);
    expect(new Set(lots).size).toBeGreaterThan(1);
  });
});

describe('every piece stays inside what it was given', () => {
  for (const style of STYLES) {
    for (const facing of ['north', 'south', 'east', 'west'] as const) {
      it(`${style}, facing ${facing}: under its height, inside its footprint`, () => {
        for (const height of [2, 3.4, 6, 9.5, 14]) {
          const p = piece(style, { facing, height });
          const built = buildPiece(p);
          expect(built.top).toBeLessThanOrEqual(height + 1e-6);
          for (const part of built.parts) {
            const b = bounds(part.geometry);
            expect(b.max.y, `${style} ${part.surface} at ${height}`).toBeLessThanOrEqual(height + 1e-4);
            expect(b.min.y, `${style} ${part.surface} underground`).toBeGreaterThanOrEqual(-0.5);
            // An eave may overhang its walls; an awning may reach over the street; nothing else.
            const slack = part.surface === 'trim' ? 1.3 : 0.45;
            expect(b.min.x, `${style} ${part.surface} west`).toBeGreaterThanOrEqual(p.x0 - slack);
            expect(b.max.x, `${style} ${part.surface} east`).toBeLessThanOrEqual(p.x1 + slack);
            expect(b.min.z, `${style} ${part.surface} north`).toBeGreaterThanOrEqual(p.z0 - slack);
            expect(b.max.z, `${style} ${part.surface} south`).toBeLessThanOrEqual(p.z1 + slack);
          }
          for (const c of built.chimneys) expect(c.y).toBeLessThanOrEqual(height + 1e-6);
        }
      });
    }
  }
});

describe('what a building shows the street', () => {
  it('has windows, a roof, and a door on the side the street is', () => {
    for (const style of BUILT) {
      const built = buildPiece(piece(style, { facing: 'south' }));
      expect(built.parts.some((p) => p.surface === 'facade' && p.glows), `${style} has no lit windows`).toBe(true);
      expect(built.parts.some((p) => p.surface === 'roof'), `${style} has no roof`).toBe(true);
      const trim = built.parts.find((p) => p.surface === 'trim');
      expect(trim, `${style} has no door`).toBeDefined();
      // On the south face: its front is past the wall's south edge.
      expect(bounds(trim!.geometry).max.z).toBeGreaterThan(4);
    }
  });

  it('paints no door where a real one already is', () => {
    const built = buildPiece(piece('terrace', { hasDoor: true }));
    expect(built.parts.find((p) => p.surface === 'trim')).toBeUndefined();
  });

  it('builds the same piece the same way, and a different seed differently', () => {
    const a = buildPiece(piece('foliage', { seed: 1 }));
    const b = buildPiece(piece('foliage', { seed: 1 }));
    const c = buildPiece(piece('foliage', { seed: 2 }));
    const pos = (x: typeof a): number[] => Array.from((x.parts[0]!.geometry.getAttribute('position') as THREE.BufferAttribute).array);
    expect(pos(a)).toEqual(pos(b));
    expect(pos(a)).not.toEqual(pos(c));
  });

  it('merges each surface into one geometry, so a piece is a few draw calls', () => {
    for (const style of STYLES) {
      const built = buildPiece(piece(style));
      const surfaces = new Set(built.parts.map((p) => `${p.surface}${p.glows ? '*' : ''}`));
      expect(built.parts.length, style).toBeLessThanOrEqual(surfaces.size + 1);
      expect(built.parts.length, style).toBeLessThanOrEqual(5);
    }
  });
});
