/**
 * The board, as light on the road.
 *
 * Everything here lies flat on the district's own ground and adds to it rather than covering
 * it. That is the whole point of fighting out in the world: the paving, the chalk dust and the
 * canal all stay visible under the grid, so the fight is legibly happening *here* and not on a
 * board that arrived from somewhere else. An opaque base plate would have been easier and would
 * have thrown away the only thing this feature is for.
 *
 * The split with `OverlayCanvas` is physical rather than arbitrary: anything that belongs to
 * the *ground* is a quad here, and anything that floats above it — badges, numbers, ghosts,
 * the tether — is drawn in screen space up there. A damage number flattened onto the road
 * would be unreadable, and a tile highlight floating above it would detach from the tile.
 *
 * Colours come from `render/palette.ts`, the same source the 2D board reads, so the two
 * renderers cannot drift on what "a legal move" looks like.
 */

import * as THREE from 'three';
import type { Coord } from '../../contract/ids.js';
import type { Overlays } from '../../render/BoardRenderer.js';
import { PALETTE } from '../../render/palette.js';
import { TILE } from '../map.js';
import type { WorldBoard } from './WorldBoard.js';

/**
 * How far off the ground each class of mark sits.
 *
 * Millimetres apart, and ordered rather than arbitrary: they are coplanar as far as the eye is
 * concerned, but a shared y would z-fight visibly at this camera distance. Written as a table
 * so the stacking order is one thing to read instead of a scatter of literals.
 */
const LAYER = {
  fill: 0.02,
  territory: 0.03,
  dimmed: 0.04,
  fog: 0.05,
  reach: 0.06,
  highlight: 0.07,
  attack: 0.08,
  impact: 0.09,
  hazard: 0.1,
  pyre: 0.11,
  selected: 0.12,
  hover: 0.13,
  lane: 0.14,
  lines: 0.15,
  boundary: 0.16,
} as const;

/** A palette entry as three.js wants it: a colour and the alpha it was written with. */
function parseColor(css: string): { color: THREE.Color; alpha: number } {
  const m = /^rgba?\(([^)]+)\)$/.exec(css.trim());
  if (!m) return { color: new THREE.Color(css), alpha: 1 };
  const parts = m[1]!.split(',').map((p) => Number(p.trim()));
  const color = new THREE.Color(
    (parts[0] ?? 0) / 255,
    (parts[1] ?? 0) / 255,
    (parts[2] ?? 0) / 255,
  );
  return { color, alpha: parts[3] ?? 1 };
}

/**
 * The grid's own light, blooming outward.
 *
 * A per-vertex ring index plus one progress uniform, rather than a tween per tile: the board
 * has to appear as something spreading across the ground from where the ring closed, and doing
 * that with forty separate meshes and forty tweens would be forty draw calls to animate one
 * gesture. The ring index is the Chebyshev distance from the board's centre, so the bloom goes
 * out in squares — which is the shape the grid itself is, and reads as the grid asserting
 * itself rather than as a circle passing over it.
 */
const REVEAL_VERT = `
  attribute float aRing;
  varying float vRing;
  varying vec2 vUv2;
  void main() {
    vRing = aRing;
    vUv2 = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const REVEAL_FRAG = `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uProgress;
  uniform float uRings;
  uniform float uEdge;
  varying float vRing;
  varying vec2 vUv2;
  void main() {
    // Each ring lights as the front passes it, over a short overlap so the bloom is a wave
    // rather than a sequence of separate flashes.
    float front = uProgress * (uRings + 1.0);
    float lit = clamp(front - vRing, 0.0, 1.0);
    // A brief overshoot as a tile catches, so the edge of the bloom is brighter than the
    // ground behind it. This is what makes it read as light arriving.
    float flare = 1.0 + 1.8 * exp(-8.0 * abs(front - vRing - 0.5));
    // Tile borders brighter than tile interiors: the grid is lines, not panels.
    float dx = min(vUv2.x, 1.0 - vUv2.x);
    float dy = min(vUv2.y, 1.0 - vUv2.y);
    float edge = 1.0 - smoothstep(0.0, uEdge, min(dx, dy));
    // The interior is nearly nothing and the border carries the read. An even wash across the
    // whole tile is what made the grid a sheet of light rather than a set of lines -- so the
    // strength went into the line and out of the panel, rather than out of both.
    float a = uAlpha * lit * flare * (0.06 + 0.94 * edge);
    gl_FragColor = vec4(uColor * flare, a);
  }
`;

/** Six vertices — two triangles — for one tile-sized quad in the XZ plane. */
function quad(cx: number, cz: number, y: number, size: number): number[] {
  const h = size / 2;
  return [
    cx - h, y, cz - h,
    cx + h, y, cz - h,
    cx + h, y, cz + h,
    cx - h, y, cz - h,
    cx + h, y, cz + h,
    cx - h, y, cz + h,
  ];
}

/** Matching UVs for `quad`, so a fragment shader can find the tile border. */
const QUAD_UV = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];

/**
 * One overlay class: a merged mesh rebuilt whenever the tile list changes.
 *
 * A mesh per tile would be simpler and is what this started as; a full board of legal moves
 * plus a reach ring plus fog is well over a hundred tiles, and a hundred draw calls a frame to
 * draw a hundred flat squares is the kind of waste that only shows up on the machine you are
 * not testing on. Merged, the whole board's furniture is a dozen draws.
 */
class TileLayer {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** The tiles currently drawn, so an unchanged overlay costs nothing to re-apply. */
  private key = '';

  constructor(
    private readonly board: WorldBoard,
    css: string,
    private readonly y: number,
    private readonly inset: number,
    order: number,
    /**
     * How hard this overlay is added to the road, stated rather than inherited.
     *
     * It used to come from the alpha in the palette string, which was a trap: half those
     * entries are written `rgba(...)` and half are plain hex, and a hex has no alpha — so
     * `parseColor` handed back 1.0 and the layer was drawn *additively at full strength*.
     * Measured against the frame, the Resonance lane alone was adding 212 of 255 luma, a
     * solid column of light down the board brighter than anything in the world around it.
     *
     * These are not the palette's numbers and should not be: the 2D board composites them
     * over an opaque dark plate, where 0.22 is a tint. Here they are added to a lit street,
     * where the same figure is a lamp. One number per layer, chosen for this renderer.
     */
    strength: number,
  ) {
    const { color } = parseColor(css);
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color,
        opacity: strength,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Fog is the one overlay that has to *remove* light rather than add it -- it means
        // "you cannot see this tile", and an additive dark wash still makes it brighter.
        blending: css === PALETTE.fog ? THREE.NormalBlending : THREE.AdditiveBlending,
      }),
    );
    this.mesh.renderOrder = order;
    this.mesh.visible = false;
  }

  set(tiles: readonly Coord[]): void {
    const key = tiles.map((t) => `${t.x},${t.y}`).join(';');
    if (key === this.key) return;
    this.key = key;

    if (tiles.length === 0) {
      this.mesh.visible = false;
      return;
    }

    const pos: number[] = [];
    const uv: number[] = [];
    for (const t of tiles) {
      const c = this.board.centreOf(t);
      pos.push(...quad(c.x, c.z, this.y, TILE - this.inset));
      uv.push(...QUAD_UV);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.visible = true;
  }

  /** Multiplies the authored alpha, for anything that pulses. */
  setPulse(k: number): void {
    const base = this.baseOpacity;
    this.mesh.material.opacity = base * k;
  }

  private baseOpacity = 0;

  rememberBase(): void {
    this.baseOpacity = this.mesh.material.opacity;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export interface BoardMeshOpts {
  /** Rows of home territory each side owns. Mirrors the engine; short arenas use one. */
  territoryDepth: number;
}

export class BoardMesh {
  readonly group = new THREE.Group();

  /** 0 while the ground is bare, 1 once the whole grid stands. Driven by the descent. */
  reveal = 0;

  private readonly grid: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly layers: Record<string, TileLayer> = {};
  private readonly boundary: THREE.LineSegments<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  >;
  private readonly lane: TileLayer;
  private overlays: Overlays | null = null;
  private clock = 0;

  constructor(
    private readonly board: WorldBoard,
    opts: BoardMeshOpts,
  ) {
    this.grid = this.buildGrid();
    this.group.add(this.grid);

    const add = (
      name: string,
      css: string,
      y: number,
      inset: number,
      order: number,
      strength: number,
    ): TileLayer => {
      const layer = new TileLayer(board, css, y, inset, order, strength);
      layer.rememberBase();
      this.layers[name] = layer;
      this.group.add(layer.mesh);
      return layer;
    };

    // Order matches the 2D board's passes, so a tile that is both a legal move and inside an
    // impact zone reads the same way in both renderers. The strengths are this renderer's own
    // — see `TileLayer` for why they cannot come from the palette.
    //
    // The scale they were chosen on: with the board up, the brightest pixel of the *street*
    // measures about 117 of 255. Nothing here may beat that. A legal-move wash lands near 84,
    // the grid near 60, the zone tints lower again — so the ordering on screen is world first,
    // then the marks the player is meant to read, then the furniture that is merely present.
    // The two home bands are the only thing on the board that says which way round it is,
    // and now that the camera can walk all the way round the arena they are the only thing
    // that *can* say it. At 0.07 the blue band added 17 of 255 to the road's blue channel and
    // 4 to its red -- technically a tint, practically invisible. These read as coloured
    // ground, which is what they have to be: a player looking at the far side of their own
    // board must be able to tell in one glance which end they are standing at.
    add('territoryPlayer', PALETTE.playerTint, LAYER.territory, 0, 10, 0.2);
    add('territoryEnemy', PALETTE.enemyTint, LAYER.territory, 0, 10, 0.2);
    add('dimmed', PALETTE.neutralTint, LAYER.dimmed, 0, 11, 0.04);
    add('fog', PALETTE.fog, LAYER.fog, 0, 12, 0.5);
    add('reach', PALETTE.reachFill, LAYER.reach, 0.6, 13, 0.06);
    add('highlight', PALETTE.highlightFill, LAYER.highlight, 0.5, 14, 0.09);
    add('attack', PALETTE.attackFill, LAYER.attack, 0.5, 15, 0.11);
    add('impact', PALETTE.impactFill, LAYER.impact, 0.3, 16, 0.09);
    add('hazard', PALETTE.attackFill, LAYER.hazard, 0.2, 17, 0.11);
    add('pyre', PALETTE.pact, LAYER.pyre, 0.8, 18, 0.1);
    add('selected', PALETTE.highlight, LAYER.selected, 0.2, 19, 0.12);
    // The tile under the pointer, which is the one overlay the player is actively hunting for
    // on screen. It pulses as well, so this is its floor rather than its level.
    add('hover', PALETTE.highlight, LAYER.hover, 0.9, 20, 0.16);
    // Quietest of all: it is a standing hint about a lane, on screen for the whole fight,
    // and the only overlay that is never a response to anything the player just did.
    this.lane = add('lane', PALETTE.pact, LAYER.lane, 1.2, 9, 0.07);

    this.boundary = this.buildBoundary();
    this.group.add(this.boundary);

    this.setTerritory(opts.territoryDepth);
  }

  /**
   * The grid itself: one quad per tile, carrying its ring index for the bloom.
   *
   * Built once and never rebuilt — the board does not change shape mid-fight — so the reveal
   * costs one uniform write per frame rather than any geometry work.
   */
  private buildGrid(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const pos: number[] = [];
    const uv: number[] = [];
    const ring: number[] = [];

    const midX = (this.board.w - 1) / 2;
    const midZ = (this.board.h - 1) / 2;
    let rings = 0;

    for (let y = 0; y < this.board.h; y++) {
      for (let x = 0; x < this.board.w; x++) {
        const c = this.board.centreOf({ x, y });
        pos.push(...quad(c.x, c.z, LAYER.lines, TILE));
        uv.push(...QUAD_UV);
        // Chebyshev from the middle, which makes the bloom go out in squares.
        const r = Math.max(Math.abs(x - midX), Math.abs(y - midZ));
        rings = Math.max(rings, r);
        for (let i = 0; i < 6; i++) ring.push(r);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aRing', new THREE.Float32BufferAttribute(ring, 1));

    const { color } = parseColor(PALETTE.tileEdge);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: REVEAL_VERT,
        fragmentShader: REVEAL_FRAG,
        uniforms: {
          // Pulled well back from the boundary's cyan. Blended 55% of the way there and drawn
          // additively at 0.85, one grid line added about (88,133,135) to whatever road was
          // under it -- which on a night street is not a line on the ground, it is a strip
          // light. The grid has to be something the board is drawn *on*, not the brightest
          // object in the frame.
          uColor: { value: new THREE.Color(color).lerp(new THREE.Color(PALETTE.boundary), 0.35) },
          // Twice what it was, and still a fifth of what it started as.
          //
          // The first number here was 0.85 and the grid was the brightest object in the frame:
          // one line added about (88,133,135) to whatever road was under it, which is a strip
          // light and not a mark on the ground. The correction went too far the other way --
          // at 0.14, spread over a tile whose interior also lit, you could not count the tiles
          // you were being asked to move between, which is the one thing a grid is for. This
          // is measured on the same scale as everything else here: a lit line adds about (26,
          // 48, 43), against a street whose brightest pixel is near 117.
          uAlpha: { value: 0.3 },
          uProgress: { value: 0 },
          uRings: { value: rings },
          // Wider, because a hairline seen at a forty-degree camera across eight tiles of
          // depth is a hairline for two rows and nothing for the rest.
          uEdge: { value: 0.1 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.renderOrder = 8;
    return mesh;
  }

  /**
   * The edge around the whole arena — where the fight stops being optional.
   *
   * Vertex-coloured rather than one flat cyan, and that is not decoration. The near edge is
   * drawn in the player's blue and the far edge in the enemy's red, so the board states its
   * own orientation on its outline as well as in its home bands. With the camera free to orbit
   * — which it now is — a plain rectangle tells you where the arena ends and nothing about
   * which end of it is yours, and you can be looking at your own back row from behind it
   * without a single mark on screen disagreeing.
   *
   * The two side edges stay the boundary cyan: they belong to neither side, and colouring them
   * would turn a statement into a gradient.
   */
  private buildBoundary(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const a = this.board.centreOf({ x: 0, y: 0 });
    const b = this.board.centreOf({ x: this.board.w - 1, y: this.board.h - 1 });
    const x0 = a.x - TILE / 2;
    const z0 = a.z - TILE / 2;
    const x1 = b.x + TILE / 2;
    const z1 = b.z + TILE / 2;
    const y = LAYER.boundary;

    const corners = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    // Tile y counts away from the camera at the default framing, so row 0 is the enemy's and
    // the low-z edge is theirs. Taken from the same `centreOf` the rest of the board is built
    // from rather than from the framing, which is what keeps it true when the camera moves.
    const edgeColor = [
      new THREE.Color(PALETTE.enemyBase), // z0 -- the far edge, their home row
      new THREE.Color(PALETTE.boundary), // the sides belong to nobody
      new THREE.Color(PALETTE.allyBase), // z1 -- the near edge, yours
      new THREE.Color(PALETTE.boundary),
    ];

    const pos: number[] = [];
    const col: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i]!;
      const [bx, bz] = corners[(i + 1) % 4]!;
      pos.push(ax!, y, az!, bx!, y, bz!);
      const c = edgeColor[i]!;
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    lines.renderOrder = 21;
    return lines;
  }

  /** The two home bands, tinted like the 2D board's rows. */
  private setTerritory(depth: number): void {
    const player: Coord[] = [];
    const enemy: Coord[] = [];
    for (let i = 0; i < depth; i++) {
      for (let x = 0; x < this.board.w; x++) {
        enemy.push({ x, y: i });
        player.push({ x, y: this.board.h - 1 - i });
      }
    }
    this.layers.territoryPlayer!.set(player);
    this.layers.territoryEnemy!.set(enemy);
  }

  /**
   * The Resonance lane: the column the player's Companion watches.
   *
   * A whole column rather than a tile, so it reads as a lane down the board.
   */
  setResonanceLane(col: number | null): void {
    if (col === null || col < 0 || col >= this.board.w) {
      this.lane.set([]);
      return;
    }
    const tiles: Coord[] = [];
    for (let y = 0; y < this.board.h; y++) tiles.push({ x: col, y });
    this.lane.set(tiles);
  }

  /**
   * Everything the targeting layer decided, as ground.
   *
   * Called only when the overlays change rather than per frame — `TargetingController` emits
   * on transitions, and each `set` below is a no-op when the tile list is the same, so a
   * mouse moving inside one tile rebuilds nothing.
   */
  setOverlays(o: Overlays): void {
    this.overlays = o;
    this.layers.fog!.set(o.fog);
    this.layers.dimmed!.set(o.dimmed);
    this.layers.reach!.set(o.reach);
    this.layers.highlight!.set(o.highlight);
    this.layers.attack!.set(o.attack);
    this.layers.impact!.set(o.impact);
    this.layers.pyre!.set(o.pyres);
    this.layers.hazard!.set(o.hazards.map((h) => h.at));
    // `selectedCells` is the whole footprint of the selected body; `selected` is its anchor.
    // Drawing the footprint is the honest one for a 2x2, and it falls back to the anchor.
    this.layers.selected!.set(
      o.selectedCells.length > 0 ? o.selectedCells : o.selected ? [o.selected] : [],
    );
    this.layers.hover!.set(o.hover ? [o.hover] : []);
  }

  update(dt: number): void {
    this.clock += dt;
    (this.grid.material.uniforms.uProgress!.value as number) = this.reveal;

    // The boundary and the hover mark breathe; everything else holds still. A board where
    // every overlay pulses is a board where nothing reads as the live one.
    const pulse = (Math.sin(this.clock * 1.6) + 1) / 2;
    // The one line that is *meant* to be bright — it is where the fight stops being optional,
    // and it is now also what names the two ends — but well short of what it was when it was
    // competing with a glowing grid.
    this.boundary.material.opacity = this.reveal * (0.18 + 0.1 * pulse);
    this.layers.hover!.setPulse(0.6 + 0.5 * pulse);
    if (this.overlays?.impact.length) this.layers.impact!.setPulse(0.7 + 0.45 * pulse);
  }

  dispose(): void {
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.boundary.geometry.dispose();
    this.boundary.material.dispose();
    for (const layer of Object.values(this.layers)) layer.dispose();
    this.group.clear();
  }
}
