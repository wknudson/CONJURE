/**
 * How hard the board is allowed to shine on a street that is already lit, and which end of it
 * belongs to whom.
 *
 * Both of these are things that look fine in code review and wrong on screen, and both have
 * already been wrong once. The grid was authored against a palette written for the 2D board,
 * where every overlay is composited over an opaque dark plate — out here they are *added* to a
 * lit road, where the same figure is a lamp rather than a tint. Half those palette entries are
 * plain hex with no alpha, so the parser handed back 1.0 and four separate layers were drawn
 * additively at full strength: measured against the frame, the Resonance lane alone was adding
 * 212 of 255 luma, a solid column of light down the middle of the road brighter than anything
 * in the world around it.
 *
 * The correction was to state a strength per layer. This is the test that stops the next
 * palette-shaped change from quietly undoing it, and it asserts the *rule* — nothing on the
 * ground may be drawn at anything like full strength — rather than any particular number, so
 * retuning stays free and the trap stays closed.
 *
 * The board is built with no WebGL anywhere: three.js geometry and materials are plain objects
 * until something draws them, which is the whole reason this is checkable at all.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BoardMesh } from '../district/combat/BoardMesh.js';
import { placeBoard } from '../district/combat/WorldBoard.js';
import { CHALK_ROAD } from '../district/areas/chalkRoad.js';
import { PALETTE } from '../render/palette.js';
import { TILE } from '../district/map.js';

const ROAD = CHALK_ROAD;

function build(w = 6, h = 7): BoardMesh {
  const board = placeBoard(ROAD, { x: 0, z: 0 }, w, h);
  return new BoardMesh(board, { territoryDepth: 2 });
}

/**
 * What one tile of grid actually contributes, averaged over the tile.
 *
 * The grid's uniform alpha is not comparable with a tile layer's opacity and comparing them
 * directly is how you talk yourself into the wrong number: a fill layer covers its whole tile,
 * whereas the grid shader spends its alpha on `0.06 + 0.94 * edge` — nearly nothing across the
 * interior and the full figure only in a border a tenth of a tile wide. So the line may be
 * several times brighter than any fill and the tile still be darker overall, which is exactly
 * the point of drawing a grid as lines instead of as panels.
 *
 * Integrated numerically against the real shader expression rather than approximated, so this
 * stays true if either number is retuned.
 */
function gridMeanAlpha(uAlpha: number, uEdge: number): number {
  const smoothstep = (e: number, x: number): number => {
    const t = Math.min(1, Math.max(0, x / e));
    return t * t * (3 - 2 * t);
  };
  const N = 200;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N;
      const v = (j + 0.5) / N;
      const d = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
      const edge = 1 - smoothstep(uEdge, d);
      sum += uAlpha * (0.06 + 0.94 * edge);
    }
  }
  return sum / (N * N);
}

/** Every flat quad layer on the board, which is everything except the grid and the outline. */
function tileLayers(mesh: BoardMesh): THREE.MeshBasicMaterial[] {
  const out: THREE.MeshBasicMaterial[] = [];
  for (const child of mesh.group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const mat = child.material;
    if (mat instanceof THREE.MeshBasicMaterial) out.push(mat);
  }
  return out;
}

describe('what the board is allowed to add to a road that is already lit', () => {
  it('draws nothing on the ground at anything like full strength', () => {
    const mesh = build();
    for (const mat of tileLayers(mesh)) {
      if (mat.blending === THREE.NormalBlending) continue; // fog removes light; see below
      expect(
        mat.opacity,
        `an additive ground layer at ${mat.opacity} is a lamp, not a mark`,
      ).toBeLessThan(0.35);
    }
    mesh.dispose();
  });

  it('adds light everywhere except where it means "you cannot see this"', () => {
    const mesh = build();
    const normal = tileLayers(mesh).filter((m) => m.blending === THREE.NormalBlending);
    // Exactly one: line-of-sight fog. Everything else on the board is a mark being added to
    // the street, but fog has to *remove* contrast -- an additive dark wash still brightens
    // the tile it is trying to hide, which is how you end up with glowing shadows.
    expect(normal, 'only the fog composites normally').toHaveLength(1);
    mesh.dispose();
  });

  it('keeps the grid quieter than the marks the player is being asked to read', () => {
    const mesh = build();
    const grid = mesh.group.children.find(
      (c) => c instanceof THREE.Mesh && c.material instanceof THREE.ShaderMaterial,
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const gridAlpha = grid.material.uniforms.uAlpha!.value as number;
    const uEdge = grid.material.uniforms.uEdge!.value as number;

    // The ordering that has to hold on screen: the world first, then whatever the player just
    // asked a question about, then the furniture that is merely present. The grid is furniture.
    // It is the thing the board is drawn *on*, and when it was the brightest object in the
    // frame the board read as a light fixture lying in the road.
    //
    // Compared by what a tile of grid *contributes*, not by the uniform: the first draft of
    // this test compared 0.3 against a 0.2 fill and failed, which looked like the grid being
    // too bright and was actually the test forgetting that a line covers a tenth of a tile and
    // a fill covers all of it. The line is deliberately brighter than any fill. The tile is not.
    const brightest = Math.max(
      ...tileLayers(mesh)
        .filter((m) => m.blending !== THREE.NormalBlending)
        .map((m) => m.opacity),
    );
    expect(
      gridMeanAlpha(gridAlpha, uEdge),
      'a tile of grid is quieter than a tile of overlay',
    ).toBeLessThan(brightest);

    // The line itself still may not become a strip light. At 0.85 -- what shipped first -- one
    // grid line was adding about (88,133,135) to whatever road was under it.
    expect(gridAlpha, 'and the line is not a lamp either').toBeLessThan(0.4);
    // ...nor so faint that you cannot count the tiles you are being asked to move between,
    // which is the one job a grid has.
    expect(gridAlpha, 'but it is still a grid').toBeGreaterThan(0.15);
    mesh.dispose();
  });
});

describe('which end of the arena is whose', () => {
  /** The outline: the one thing on the board drawn as lines rather than as quads. */
  function outline(mesh: BoardMesh): THREE.LineSegments<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  > {
    const found = mesh.group.children.find((c) => c instanceof THREE.LineSegments);
    expect(found, 'the arena outline').toBeDefined();
    return found as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  }

  it('states it on the outline, in the two sides own colours', () => {
    const mesh = build();
    const lines = outline(mesh);
    expect(lines.material.vertexColors, 'coloured per edge').toBe(true);

    const pos = lines.geometry.getAttribute('position');
    const col = lines.geometry.getAttribute('color');
    expect(pos.count, 'four edges, two ends each').toBe(8);
    expect(col.count).toBe(pos.count);

    // Tile y counts away from the camera at the default framing, so the low-z edge is the
    // enemy's home row and the high-z edge is the player's. Read off the geometry rather than
    // assumed: this is precisely the fact that is invisible when it is backwards.
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      zMin = Math.min(zMin, pos.getZ(i));
      zMax = Math.max(zMax, pos.getZ(i));
    }

    const colourAt = (z: number): THREE.Color | null => {
      for (let i = 0; i < pos.count; i += 2) {
        // An edge that runs along one end has both of its vertices at that z.
        if (Math.abs(pos.getZ(i) - z) < 1e-6 && Math.abs(pos.getZ(i + 1) - z) < 1e-6) {
          return new THREE.Color(col.getX(i), col.getY(i), col.getZ(i));
        }
      }
      return null;
    };

    const far = colourAt(zMin);
    const near = colourAt(zMax);
    expect(far?.getHexString(), 'the far end is theirs').toBe(
      new THREE.Color(PALETTE.enemyBase).getHexString(),
    );
    expect(near?.getHexString(), 'the near end is yours').toBe(
      new THREE.Color(PALETTE.allyBase).getHexString(),
    );
    mesh.dispose();
  });

  it('leaves the two sides to nobody', () => {
    const mesh = build();
    const lines = outline(mesh);
    const pos = lines.geometry.getAttribute('position');
    const col = lines.geometry.getAttribute('color');

    const neutral = new THREE.Color(PALETTE.boundary).getHexString();
    let sides = 0;
    for (let i = 0; i < pos.count; i += 2) {
      // A side edge changes z along its length; an end edge does not.
      if (Math.abs(pos.getZ(i) - pos.getZ(i + 1)) < 1e-6) continue;
      sides++;
      expect(
        new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString(),
        'a side belongs to neither player',
      ).toBe(neutral);
    }
    expect(sides, 'two of them').toBe(2);
    mesh.dispose();
  });

  it('tints both home bands hard enough to be a colour and not a rumour', () => {
    const mesh = build();
    // The two bands are the only marks on the board that say which way round it is, and since
    // the camera can now walk the whole way round the arena they are the only ones that *can*.
    // At the strength they were first given, the blue band added 17 of 255 to the road's blue
    // channel and 4 to its red: technically a tint, practically invisible.
    const tints = tileLayers(mesh).filter(
      (m) => m.opacity > 0.1 && m.opacity < 0.3 && m.blending === THREE.AdditiveBlending,
    );
    expect(tints.length, 'both bands are drawn at a strength you can see').toBeGreaterThanOrEqual(2);
    mesh.dispose();
  });
});

describe('the bloom that brings the grid up', () => {
  it('starts dark and ends lit', () => {
    const mesh = build();
    const grid = mesh.group.children.find(
      (c) => c instanceof THREE.Mesh && c.material instanceof THREE.ShaderMaterial,
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

    mesh.update(0.016);
    expect(grid.material.uniforms.uProgress!.value, 'bare road before the descent').toBe(0);
    mesh.reveal = 1;
    mesh.update(0.016);
    expect(grid.material.uniforms.uProgress!.value, 'and a standing grid after it').toBe(1);
    mesh.dispose();
  });

  it('holds the outline down until the ground has lit', () => {
    const mesh = build();
    const lines = mesh.group.children.find(
      (c) => c instanceof THREE.LineSegments,
    ) as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

    mesh.reveal = 0;
    mesh.update(0.016);
    expect(lines.material.opacity, 'nothing before the bloom').toBe(0);
    mesh.reveal = 1;
    mesh.update(0.016);
    expect(lines.material.opacity, 'and a live edge after it').toBeGreaterThan(0);
    mesh.dispose();
  });
});

describe('the grid it lays', () => {
  it('covers exactly the board, one quad a tile', () => {
    const mesh = build(6, 7);
    const grid = mesh.group.children.find(
      (c) => c instanceof THREE.Mesh && c.material instanceof THREE.ShaderMaterial,
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    // Two triangles a tile, three vertices each.
    expect(grid.geometry.getAttribute('position').count).toBe(6 * 7 * 6);

    const pos = grid.geometry.getAttribute('position');
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      x0 = Math.min(x0, pos.getX(i));
      x1 = Math.max(x1, pos.getX(i));
    }
    expect(x1 - x0, 'six tiles wide, to the outer edge of both').toBeCloseTo(6 * TILE, 5);
    mesh.dispose();
  });
});
