/**
 * The ward as geometry and light.
 *
 * Everything built here is owned by one `DistrictWorld` instance and released by its
 * `dispose`. That matters more than it usually would: the hub is torn down and rebuilt
 * every single time a shop door closes, so anything not released is leaked once per
 * errand, and a browser will only hand out so many WebGL contexts before it starts taking
 * the oldest one back.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOK, ambientFor, type AmbientDef } from './look.js';
import { SWAYS } from './dressing.js';
import { SKIES, SkyField, skyStrengthAt, type SkyId } from './skies.js';
import { hashText, makeRng, nextFloat } from '../core/util/rng.js';
import { BUILT, buildPiece, lotsOf, type Facing, type SolidStyle, type SurfaceKey } from './buildings.js';
import { CLUTTER_KINDS, CLUTTER_SIZE, STANDING, scatterClutter, type ClutterPoint } from './clutter.js';
import { LANDMARKS, buildLandmark, moverAngle, type LandmarkMover } from './landmarks.js';
import { gateOpen, NOTHING_HAPPENED, type Chronicle } from './chronicle.js';
import { ambientAt, lampsAt, lightingHour, NIGHT_ANCHOR, type Lit } from './daylight.js';
import { poolShares } from './lightPool.js';
import type { ColliderSet } from './collision.js';
import { DRESSING } from './dressing.js';
import { allDressing, registryHotspots, staticFootprints } from './footprints.js';
import {
  TILE,
  extractRects,
  groundRow0Of,
  groundRowsOf,
  splitRun,
  waterRow0Of,
  waterRowsOf,
  xOfCol,
  zOfRow,
  type AreaDef,
  type DressingSpec,
  type WallTex,
} from './map.js';
import {
  bakeGround,
  makeBoardTexture,
  makeCrateTexture,
  DRESSING_ART,
  makeGateTexture,
  makeWaystoneTexture,
  makeOutskirtsTexture,
  makeGraffitiTexture,
  makeSignTexture,
  makeDoorTexture,
  makeTreeTexture,
  WALL_ART,
  makeWaterTexture,
  mulberry32,
  configurePixelTexture,
  makeFacadeTextures,
  makeRoofTexture,
  makeTrimAtlas,
  makeLeafTexture,
  makeBarkTexture,
  makeTurfTexture,
  makeIceTexture,
  makeIronTexture,
  makeSmokeTexture,
  makeClutterTexture,
  type RoofKind,
  type WindowKind,
} from './textures.js';
import { BillboardSprite, applySway } from './sprites3d.js';

/**
 * A building, plus everything that has to disappear along with it.
 *
 * `mats` is deliberately not just the box: a parapet, a chimney and a door plaque all sit
 * on the same wall, and fading the wall while they stayed put would leave a sign hanging
 * in mid-air over the Commander's head.
 */
interface Structure {
  hit: THREE.Mesh;
  mats: (THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean })[];
}

interface Lamp {
  /**
   * How hard this one is burning, 0 to 1.
   *
   * Per lamp rather than per ward, which is the change that lets somebody walk the row. It was a
   * single multiplier applied to all of them, and a whole street dimming together is the right
   * picture drawn by the wrong cause -- nothing dims a gas lamp.
   */
  lit: number;
  /** Where it stands. The light it casts is borrowed from the pool -- see `Fire`. */
  x: number;
  z: number;
  head: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
}

/**
 * Anything burning that lights the ground around it: a gas lamp, a brazier, an ember vent.
 *
 * None of them owns a light. They are ranked each frame by distance from whoever the camera
 * follows, and the nearest borrow one of the area's fixed pool -- see `lightPool.ts` for why,
 * and for how they hand one over without it flashing.
 */
interface Fire {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: 'lamp' | 'brazier' | 'vent' | 'arc';
  /** The lamp this is, for its flicker and whether it is lit. Absent for the other two. */
  readonly lamp?: Lamp;
}

/**
 * How many real point lights an area gets, whatever it burns.
 *
 * Ten: the nearest ten fires cover everything the walk camera frames with margin to spare --
 * it sees about five tiles by four -- and ten is well inside what every GPU's forward shader
 * takes. Fewer fires than this and the area simply gets one light each.
 */
export const LIGHT_POOL = 10;

/** How far inside the pool's cut a fire burns at full strength. See `poolShares`. */
const POOL_BAND = 6;

/** How long a puff of chimney smoke lasts, in seconds. */
const SMOKE_LIFE = 4.5;

/** How brightly a lit window burns at the lamps' full strength. */
const WINDOW_GLOW = 1.15;

/**
 * Which side of a footprint the street is: the side with the most walkable ground against it,
 * south first on a tie, because that is the side the camera starts looking at. Null for a
 * footprint with no walkable ground round it at all.
 */
function streetFacing(area: AreaDef, x0: number, z0: number, w: number, d: number): Facing | null {
  const count = (fx: (t: number) => number, fz: (t: number) => number, len: number): number => {
    let n = 0;
    for (let t = TILE / 2; t < len; t += TILE) {
      const x = fx(t);
      const z = fz(t);
      const col = Math.floor((x + area.halfX) / TILE);
      const row = Math.floor((z + area.halfZ) / TILE);
      if (row < 0 || row >= area.rows || col < 0 || col >= area.cols) continue;
      if (area.legend[area.grid[row]![col]!]?.walk) n++;
    }
    return n;
  };
  const sides: [Facing, number][] = [
    ['south', count((t) => x0 + t, () => z0 + d + TILE / 2, w)],
    ['east', count(() => x0 + w + TILE / 2, (t) => z0 + t, d)],
    ['west', count(() => x0 - TILE / 2, (t) => z0 + t, d)],
    ['north', count((t) => x0 + t, () => z0 - TILE / 2, w)],
  ];
  let best: [Facing, number] = sides[0]!;
  for (const s of sides) if (s[1] > best[1]) best = s;
  return best[1] > 0 ? best[0] : null;
}

/** A brazier's light: the gas lamps' warmth, redder, because it is wood and not gas. */
const BRAZIER_LIGHT = new THREE.Color('#e08040');
/** An ember vent's: low and red, a crack that breathes. */
const VENT_LIGHT = new THREE.Color('#ff5a20');
/** The Great Pylon's crown: the one light in the world that is not a fire. */
const ARC_LIGHT = new THREE.Color('#9fd8ff');

/** One expanding ring on the canal. See `updateRises`. */
interface Rise {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  life: number;
  max: number;
  /** How wide this one gets. Varied per rise, so they are not one animation played repeatedly. */
  reach: number;
}

interface ImpactLight {
  light: THREE.PointLight;
  life: number;
  max: number;
  peak: number;
}

/**
 * The ground plane's span, computed per area rather than at import.
 *
 * These were module constants derived from a single global grid. Left that way they would
 * have described Ashfall's ground while the collision grid and the baked texture described
 * somebody else's — the exact "four answers that disagreed" failure `map.ts` exists to end,
 * and silent, because nothing compares them.
 */
function groundSpan(area: AreaDef): { w: number; d: number; cz: number } {
  const row0 = groundRow0Of(area);
  const d = groundRowsOf(area) * TILE;
  return { w: area.cols * TILE, d, cz: zOfRow(area, row0) - TILE / 2 + d / 2 };
}

export class DistrictWorld {
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Everything billboarded, turned to face the camera once per frame. */
  readonly billboards: BillboardSprite[] = [];

  private readonly structures: Structure[] = [];
  private readonly hitboxes: THREE.Mesh[] = [];
  private readonly lamps: Lamp[] = [];
  /** Every lamp, brazier and vent, in the order they were built. See `Fire`. */
  private readonly fires: Fire[] = [];
  /** The real lights, handed to the nearest fires each frame. Fixed for the life of the area. */
  private readonly pool: THREE.PointLight[] = [];
  /** Each fire's share of a pool light this frame. Sized once the fires are all known. */
  private shares = new Float32Array(0);
  /** The kit's surfaces, one texture per kind and variant for the life of this world. See `surface`. */
  private readonly kitTex = new Map<string, THREE.Texture>();
  /**
   * Every lit window's material, and whether that building has anybody home tonight. `setHour`
   * turns them up after dark -- the ward's own light, when the lamps are the other half of it.
   */
  private readonly windows: { mat: THREE.MeshLambertMaterial; home: boolean }[] = [];
  /** Each landmark's moving part, on its pivot. See `updateLandmarks`. */
  private readonly movers: { pivot: THREE.Object3D; mover: LandmarkMover; phase: number }[] = [];
  /** The ground clutter: one instanced mesh per kind, and the points it was placed at. */
  private readonly clutter: { mesh: THREE.InstancedMesh; points: ClutterPoint[] }[] = [];
  /** Where the chimneys smoke from, and the smoke. See `updateSmoke`. */
  private smoke: { points: THREE.Points; from: THREE.Vector3[]; age: Float32Array } | null = null;
  /**
   * Everything standing loose on the ground that is not a building: trees, plants, fences,
   * decals, crates, lamp posts, the board. See `setArena` -- these are hidden, not faded, when a
   * fight is laid over them, because the arena search looks for ground free of *walls* and
   * leaves the furniture where it stands.
   */
  private readonly loose: { obj: THREE.Object3D; x: number; z: number; r: number }[] = [];
  /** What `setArena` hid, so clearing it shows exactly those and nothing that was already out. */
  private readonly hiddenForArena: THREE.Object3D[] = [];
  /** One picture per kind of furniture, for the life of this world. See the build loop. */
  private readonly dressTex = new Map<string, THREE.Texture>();
  /**
   * How wide each piece of furniture's picture is, per placed piece, for the colliders.
   *
   * Per piece rather than per kind because a waystone's canvas is cut to its own line, so
   * two waystones are two widths. Read once, after the textures exist, by `staticFootprints`.
   */
  private readonly dressAspect = new Map<DressingSpec, number>();
  private readonly signs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly impacts: ImpactLight[] = [];
  /** Absent in an area with no canal. `dispose` and `scrollWater` both allow for it. */
  private readonly waterTexture: THREE.Texture | null = null;
  /**
   * Where the canal is, for putting a rise on it. Null wherever there is no canal.
   *
   * Kept rather than recomputed because the arithmetic that placed the water plane is a dozen
   * lines up and involves `waterRowsOf`, `zOfRow` and a half-tile — a second copy of it here
   * would be a second chance to put the fish in the road.
   */
  private readonly waterRect: { w: number; z0: number; z1: number } | null = null;
  /** Expanding rings on that water. See `updateRises`. */
  private readonly rises: Rise[] = [];
  private riseTimer = 1.5;
  /** This area's falling air, or null where it declares none. */
  private readonly sky: SkyField | null = null;
  /** Kept for the daily roll, which is per place as well as per day. */
  private readonly areaId: string;
  private readonly skyId: SkyId;
  private readonly colliderHelpers = new THREE.Group();
  /**
   * This area's ambience.
   *
   * Held rather than looked up per call so the tuning panel and the scene are editing one
   * object: `AMBIENT[id]` is mutable and the GUI binds straight to it, which is what makes a
   * nudged fog value show up without a reload — and what stops the ward and the road from
   * sharing one set of numbers the way they would if this still read `LOOK`.
   */
  private readonly amb: AmbientDef;
  /**
   * The same place, at the hour it currently is.
   *
   * Held apart from `amb` and not derived on the fly, because the two have different owners:
   * `amb` is `AMBIENT[id]`, which the tuning panel binds to and mutates live, and this is what
   * the scene is actually wearing. Pushing the panel's edits straight at the lights would mean
   * a nudged fog value snapped the world to midnight, and deriving `amb` from the hour would
   * mean the panel edited a value that was overwritten on the next frame.
   *
   * `applyFog`, `applySun` and `applyAmbient` all read this; `setHour` recomputes it from `amb`,
   * so a panel edit still reaches the screen through the same three calls it always did.
   */
  private lit: Lit;
  /** What the clock says. See `daylight.ts`; the authored values are one in the morning. */
  private hour = NIGHT_ANCHOR;
  /** Whether this is a room. Decides what the hour is allowed to do to the light. */
  private readonly indoor: boolean;
  /** The void past a room's walls, recoloured with the fog so the two never part. */
  private voidMat: THREE.MeshBasicMaterial | null = null;

  private readonly occRay = new THREE.Raycaster();
  private readonly occDir = new THREE.Vector3();
  private readonly occTarget = new THREE.Vector3();
  private readonly occHit = new Set<THREE.Object3D>();

  constructor(
    area: AreaDef,
    private readonly colliders: ColliderSet,
    maxAnisotropy: number,
    /**
     * What the street knows. Only the graffiti reads it, and only to decide what is painted.
     *
     * Defaulted so every existing caller and every test that builds a world for its geometry
     * keeps working unchanged -- and so the answer to "what does a ward look like to somebody
     * who has done nothing" is the one you get by not asking.
     */
    chron: Chronicle = NOTHING_HAPPENED,
    /**
     * What time it is, in hours.
     *
     * Defaulted to the hour the whole `AMBIENT` table was authored and measured at, so every
     * existing caller — and every test that builds a world for its geometry — gets exactly the
     * lighting those measurements describe, and "what does this ward look like" has the same
     * answer it had before there was a clock.
     */
    hour: number = NIGHT_ANCHOR,
  ) {
    // The ambience is the area's; the camera and the film are the game's. See `AMBIENT`.
    const amb = ambientFor(area.id);
    this.amb = amb;
    this.hour = hour;
    // Everything below builds from the *lit* values, so a ward entered at noon is built at noon
    // rather than built at night and corrected on the first frame -- which would have been one
    // visible flash of midnight on every crossing.
    // A room is lit at the anchor whatever the clock says -- see `lightingHour`. The clock
    // itself is kept as handed in, so the street is still at the right hour when you leave.
    const indoor = !!area.indoor;
    this.indoor = indoor;
    const lit = ambientAt(amb, lightingHour(indoor, hour));
    this.lit = lit;
    this.scene.fog = new THREE.FogExp2(lit.fogColor, lit.fogDensity);
    this.scene.background = new THREE.Color(lit.fogColor);

    /* --- ground, outskirts, canal --- */
    const span = groundSpan(area);
    const waterRows = waterRowsOf(area);
    // Cut clear where a banded canal runs under it; solid everywhere else, as it always was.
    const banded = waterRows > 0 && waterRow0Of(area) > 0;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(span.w, span.d),
      new THREE.MeshLambertMaterial({ map: bakeGround(area, maxAnisotropy), ...(banded ? { alphaTest: 0.5 } : {}) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, span.cz);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A big dull plane under everything, so the ward never terminates in visible void.
    // It has to sit below the canal surface or it would cover the water.
    //
    // Sized off the area rather than a flat 260: that number was a whisker past the largest
    // area there was, and an area drawn bigger would have shown its own edge from the far
    // side of the map. The margin is what the fog needs to close before the plane ends.
    const reach = Math.max(area.cols, area.rows) * TILE + 120;
    // Past a room's walls there is nothing, and nothing is painted the fog's colour so the
    // top of a wall and the void behind it meet without a seam. Unlit, because there is
    // nothing there to light.
    if (indoor) this.voidMat = new THREE.MeshBasicMaterial({ color: lit.fogColor });
    const outskirts = new THREE.Mesh(
      new THREE.PlaneGeometry(reach, reach),
      this.voidMat ?? new THREE.MeshLambertMaterial({ map: makeOutskirtsTexture(reach / 4) }),
    );
    outskirts.rotation.x = -Math.PI / 2;
    outskirts.position.y = -0.9;
    this.scene.add(outskirts);

    // Only where there is a canal to draw. An area with no water gets neither surface nor
    // quay, and `waterTexture` stays null — which `dispose` and `scrollWater` both allow for.
    if (waterRows > 0) {
      const depth = waterRows * TILE + 2;
      this.waterTexture = makeWaterTexture();
      // Unlit on purpose: no lamp reaches the canal, and a Lambert surface out there renders
      // as pure black. Basic material lets the water carry its own moonlight, and it still
      // takes fog so it fades into the smog like everything else.
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(span.w, depth),
        new THREE.MeshBasicMaterial({ map: this.waterTexture }),
      );
      water.rotation.x = -Math.PI / 2;
      const waterZ = zOfRow(area, waterRow0Of(area)) - TILE / 2 + depth / 2 - 1;
      water.position.set(0, -0.5, waterZ);
      this.scene.add(water);
      // Inset from the plane's own edges, so nothing ever rises half-under the quay.
      this.waterRect = { w: span.w - 6, z0: waterZ - depth / 2 + 2, z1: waterZ + depth / 2 - 2 };

      // The quay: along the south bank, and the north one too where there is a far bank, in
      // runs that break wherever a bridge leaves the water. An edge canal has no bridges, so
      // its quay is the one full-width run it always was.
      const quayMat = new THREE.MeshLambertMaterial({ color: 0x2a2b30 });
      const w0 = waterRow0Of(area);
      const banks: { row: number; z: number }[] = [{ row: w0 + waterRows - 1, z: zOfRow(area, w0 + waterRows) - TILE / 2 - 0.35 }];
      if (w0 > 0) banks.push({ row: w0, z: zOfRow(area, w0) - TILE / 2 + 0.35 });
      const wet = (row: number, col: number): boolean => area.legend[area.grid[row]![col]!]?.tex === 'water';
      for (const bank of banks) {
        for (let col = 0; col < area.cols; ) {
          if (!wet(bank.row, col)) {
            col++;
            continue;
          }
          let end = col;
          while (end + 1 < area.cols && wet(bank.row, end + 1)) end++;
          const quay = new THREE.Mesh(new THREE.BoxGeometry((end - col + 1) * TILE, 0.7, 0.7), quayMat);
          quay.position.set((xOfCol(area, col) + xOfCol(area, end)) / 2, -0.15, bank.z);
          quay.castShadow = true;
          quay.receiveShadow = true;
          this.scene.add(quay);
          col = end + 1;
        }
      }
    }

    /* --- solid ground, read straight out of the map ---
       Every character whose legend entry carries a `solid` profile, rather than the two
       hardcoded 'B' and 'V' branches this used to be. The heights, the insets and the
       chimneys live on the tile now, so an area's rock face and a ward's terrace come out of
       one loop and neither character is magic here. */
    // One texture per wall material standing in this area, made on first use and released
    // once every box that clones it has been built -- `addStructure` clones per box so each
    // can carry its own repeat.
    const wallTextures = new Map<WallTex, THREE.Texture>();
    const wallTex = (kind: WallTex): THREE.Texture => {
      let t = wallTextures.get(kind);
      if (!t) {
        t = WALL_ART[kind]();
        wallTextures.set(kind, t);
      }
      return t;
    };
    const buildRng = mulberry32(4242);
    const chimneys: THREE.Vector3[] = [];
    for (const [char, def] of Object.entries(area.legend)) {
      const solid = def.solid;
      if (!solid) continue;
      if (solid.style && solid.style !== 'plain') {
        for (const rect of extractRects(area, char)) chimneys.push(...this.buildStyled(area, char, rect, solid, solid.style));
        continue;
      }
      for (const rect of extractRects(area, char)) {
        const runs = solid.split ? splitRun(rect.w) : ([[0, rect.w]] as [number, number][]);
        for (const [off, w] of runs) {
          const cz = zOfRow(area, rect.row) - TILE / 2 + (rect.d * TILE) / 2;
          // Capped well under the camera's sight line to the player, so the occlusion fade
          // is a safety net for the awkward angles rather than a thing that runs constantly.
          const h = solid.minHeight + buildRng() * (solid.maxHeight - solid.minHeight);
          const chimney = buildRng() < solid.chimneyChance ? 1.6 + buildRng() * 1.8 : 0;
          // A gate is an opening before it is a picture: cut its span out of any run that
          // crosses it, or the drawing below hangs inside the masonry. That was the shipped
          // state -- the plane stood at the wall's own z, entombed, and only the top metre
          // cleared the coping. Verifiable from the street, and from nowhere else: every
          // texture test passed while no player could ever have seen the thing tested.
          const x0 = xOfCol(area, rect.col + off) - TILE / 2;
          let spans: [number, number][] = [[x0, x0 + w * TILE]];
          for (const exit of area.exits) {
            const g = exit.gate;
            if (!g || Math.abs(g.z - cz) > (rect.d * TILE) / 2) continue;
            spans = spans.flatMap(([a, b]) => {
              const cut: [number, number][] = [];
              if (g.x - 4 > a) cut.push([a, Math.min(b, g.x - 4)]);
              if (g.x + 4 < b) cut.push([Math.max(a, g.x + 4), b]);
              return cut;
            });
          }
          const widest = spans.reduce((m, s) => (s[1] - s[0] > m ? s[1] - s[0] : m), 0);
          for (const [a, b] of spans) {
            this.addStructure(
              wallTex(solid.wall ?? 'brick'),
              (a + b) / 2,
              cz,
              b - a - solid.inset,
              h,
              rect.d * TILE - solid.depthInset,
              // One chimney per run, kept to the widest piece, so cutting a gate out of a
              // wall does not mint a second chimney out of thin air.
              { chimney: b - a === widest ? chimney : 0, bare: solid.bare },
            );
          }
        }
      }
    }
    for (const t of wallTextures.values()) t.dispose();
    if (!indoor && chimneys.length > 0) this.buildSmoke(chimneys);

    /* --- the horizon, pure silhouette in the smog ---
       A city ring for the ward; low broken humps for open country. Either way it exists so
       the world does not visibly end. */
    const horizon = indoor ? 'none' : (area.props.horizon ?? 'none');
    if (horizon !== 'none') {
      const skyRng = mulberry32(88);
      const city = horizon === 'city';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + skyRng() * 0.2;
        // Outside the map's own corner, or a wide area would have the horizon standing in
        // its streets -- the Ashwood's did, at the old flat 52. Never nearer than the ward's
        // ring was, so the smaller places keep the skyline they were measured with.
        const r = Math.max(52, Math.hypot(area.halfX, area.halfZ) + 6) + skyRng() * 22;
        const h = city ? 12 + skyRng() * 22 : 7 + skyRng() * 6;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(6 + skyRng() * 8, h, 6 + skyRng() * 8),
          new THREE.MeshLambertMaterial({ color: city ? 0x171419 : 0x14180f }),
        );
        block.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
        this.scene.add(block);
      }
    }

    /* --- the air ---
       Built before the furniture so it is early in the scene graph and therefore early in the
       traversal `dispose` does; it is added to the scene like everything else, so it is cleaned
       up by that traversal and needs no line of its own down there. */
    const skyId = area.props.sky ?? 'none';
    this.areaId = area.id;
    this.skyId = skyId;
    // A room declares `'none'` and a test insists on it; the guard here is belt and braces.
    if (!indoor && skyId !== 'none') {
      // Seeded off the area id, so a place's weather is the same weather every time you walk
      // into it rather than a fresh scatter on every shop door.
      this.sky = new SkyField(SKIES[skyId], mulberry32(hashText(area.id) >>> 0));
      // Lit before it is added, so a ward entered at noon has daylight ash from its first frame
      // rather than a frame of midnight ash corrected afterwards.
      this.sky.relight(lit, hour);
      this.sky.setStrength(skyStrengthAt(area.id, skyId, hour));
      this.scene.add(this.sky.points);
    }

    /* --- dressing --- */
    const trees = area.props.trees ?? [];
    if (trees.length > 0) {
      const treeTexture = makeTreeTexture();
      // Trees are not `dressing` -- `props.trees` predates the registry -- so the sway that the
      // plants get from `SWAYS` is applied here directly. A quarter of a plant's amplitude:
      // a tree is a trunk with a canopy on it, and bracken-sized movement makes it rubber.
      for (const t of trees) {
        const tree = this.addBillboard(treeTexture, 3, 4, t.x, t.z);
        tree.setSway(0.05);
        this.loose.push({ obj: tree, x: t.x, z: t.z, r: 1.5 });
      }
    }

    const crates = area.props.crates ?? [];
    if (crates.length > 0) {
      const crateTexture = makeCrateTexture();
      for (const c of crates) this.addCrate(crateTexture, c.x, c.z, c.size ?? 1.1);
    }

    /* --- the furniture ---
       One texture per *kind* standing in this area, not per instance — the rule the trees and
       crates above already follow, and the reason a ward with twelve barrels uploads one
       barrel. Cached on the build rather than at module scope: `dispose()` traverses the scene
       disposing every map it finds and the screen is torn down on every shop door, so a
       module-level texture would be dead on the second visit.

       Waystones are the exception and cannot share, because the picture is the line carved
       into it. */
    // The area's own list and then the registries' -- a bench's workbench, a notice's lectern,
    // a cache's chest -- through one loop, so a registry prop is furniture like any other.
    for (const spec of allDressing(area)) {
      let texture = this.dressTex.get(spec.kind);
      if (spec.kind === 'waystone') {
        texture = makeWaystoneTexture(spec.text ?? '');
      } else if (!texture) {
        texture = DRESSING_ART[spec.kind]();
        this.dressTex.set(spec.kind, texture);
      }
      const img = texture.image as { width?: number; height?: number } | null | undefined;
      if (img?.width && img.height) this.dressAspect.set(spec, img.width / img.height);
      this.addDressing(spec, texture);
    }

    /* --- doors ---
       A doorway is an exit with a `door`: a leaf on the wall face over the hotspot, and a
       plaque above it if the place has a trade to name. Both hang a hair off the masonry, so
       bloom catches the plaque and the leaf does not fight the wall for depth. A way the
       Chronicle has not opened yet is drawn boarded rather than left out -- see `ExitSpec.when`. */
    for (const exit of area.exits) {
      const door = exit.door;
      if (!door) continue;
      const off = door.facesSouth ? 0.08 : -0.08;
      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 3.2),
        new THREE.MeshLambertMaterial({
          map: makeDoorTexture(door.style ?? 'plank', !gateOpen(exit.when, chron)),
          transparent: false,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      leaf.geometry.translate(0, 1.6, 0);
      leaf.position.set(door.x, 0, door.z + off);
      if (!door.facesSouth) leaf.rotation.y = Math.PI;
      this.scene.add(leaf);
      this.attachToStructure(door.x, door.z, leaf.material);

      if (!door.sign) continue;
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 1.2),
        new THREE.MeshBasicMaterial({
          map: makeSignTexture(door.sign),
          color: new THREE.Color(LOOK.signColor),
          transparent: false,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        }),
      );
      sign.position.set(door.x, 3.95, door.z + off);
      if (!door.facesSouth) sign.rotation.y = Math.PI;
      this.scene.add(sign);
      this.signs.push(sign);
      this.attachToStructure(door.x, door.z, sign.material);
    }

    /* --- graffiti ---
       The clue layer, hung on the same walls the plaques are, a few strides from each
       door and at reading height rather than signage height. Unlit basic material like
       the plaques, so the words hold in the dark the way chalk does.

       Anchored to a wall position on the area rather than to a door's index in this file's
       own list, which is what it was: a `door: number` reaching into `DOORS`, silently
       skipped when the index missed. Reordering the doors would have erased the words. */
    for (const g of area.props.graffiti ?? []) {
      // A line that has not been earned yet, or has been overtaken, is simply not painted.
      // Cheaper than fading it and more honest: a wall either says this or it does not.
      if (!gateOpen(g.gate, chron)) continue;
      const tex = makeGraffitiTexture(g.text);
      const img = tex.image as HTMLCanvasElement;
      const scrawl = new THREE.Mesh(
        // Sized off the text so long lines do not squash: ~0.045 world units per pixel.
        new THREE.PlaneGeometry(img.width * 0.045, img.height * 0.045),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(g.tint),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      scrawl.position.set(g.wallX + g.dx, 1.15, g.wallZ + (g.facesSouth ? 0.09 : -0.09));
      if (!g.facesSouth) scrawl.rotation.y = Math.PI;
      scrawl.rotation.z = 0.03 * (g.dx > 0 ? -1 : 1); // hand-drawn, not hung level
      this.scene.add(scrawl);
      this.attachToStructure(g.wallX, g.wallZ, scrawl.material);
    }

    /* --- the bounty board --- */
    const boardAt = area.props.board;
    if (boardAt) {
      const boardPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 1.6, 0.24),
        new THREE.MeshLambertMaterial({ color: 0x2a2118 }),
      );
      boardPost.position.set(boardAt.x, 0.8, boardAt.z);
      boardPost.castShadow = true;
      this.scene.add(boardPost);
      const board = this.addBillboard(makeBoardTexture(), 2.4, 2.0, boardAt.x, boardAt.z);
      board.position.y = 1.4;
      this.loose.push({ obj: boardPost, x: boardAt.x, z: boardAt.z, r: 1.2 }, { obj: board, x: boardAt.x, z: boardAt.z, r: 1.2 });
    }

    /* --- the gates ---
       One per exit that asks for one. The collider spans the whole opening, so this is not
       scenery: you do not walk through a gate, you walk up to it and the hotspot in front of it
       opens it. Which is why the drawing is a *closed, latched* gate rather than a sealed one or
       an open one -- see `makeGateTexture`, where the reasoning lives. */
    for (const exit of area.exits) {
      const at = exit.gate;
      if (!at) continue;
      const gate = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 4.6),
        new THREE.MeshLambertMaterial({
          map: makeGateTexture(),
          transparent: false,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      gate.geometry.translate(0, 2.3, 0);
      gate.position.set(at.x, 0, at.z);
      gate.castShadow = true;
      this.scene.add(gate);
    }

    /* --- lighting rig --- */
    this.hemi = new THREE.HemisphereLight(lit.skyColor, lit.groundBounce, lit.ambientIntensity);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(lit.sunColor, lit.sunIntensity);
    this.sun.position.set(-12, 18, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    for (const l of area.props.lamps ?? []) this.addLamp(l.x, l.z);

    // The tall things you steer by -- before the pool, because a lighthouse is a fire too.
    this.buildLandmarks(area);

    // The pool, now every fire is known. Built dark; the first `updateLamps` hands it out.
    // Added before `warmupShaders` runs, so the shaders are compiled for this many lights once
    // and never again for the life of the area.
    for (let i = 0; i < Math.min(LIGHT_POOL, this.fires.length); i++) {
      // No shadow map on these. One shadow-casting light is the budget, and the sun has it.
      const light = new THREE.PointLight(new THREE.Color(LOOK.lampColor), 0, LOOK.lampDistance, 2);
      this.scene.add(light);
      this.pool.push(light);
    }
    this.shares = new Float32Array(this.fires.length);

    /* --- what the furniture stops ---
       One pass over `staticFootprints` -- the same list the reachability test floods through
       -- rather than a `colliders.add` beside each thing as it was built, which is how the
       test and the world came to disagree three times about what was in the way. The picture
       decides how wide a box or a panel is, so the aspects recorded while the textures were
       made are handed in; the test, which has no pictures, walks against squares. */
    for (const f of staticFootprints(area, (spec) => this.dressAspect.get(spec) ?? 1)) {
      this.colliders.add(f.x, f.z, f.w, f.d, f.tag);
    }

    /* --- what lies about on the ground ---
       After the furniture and its footprints, because it is kept off them. See `clutter.ts`. */
    if (!indoor) this.buildClutter(area);

    /* --- collider wireframes, off by default --- */
    this.colliderHelpers.visible = false;
    this.scene.add(this.colliderHelpers);
    for (const c of this.colliders.boxes) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(c.maxX - c.minX, 3, c.maxZ - c.minZ),
        new THREE.MeshBasicMaterial({ color: 0xff3355, wireframe: true }),
      );
      box.position.set((c.minX + c.maxX) / 2, 1.5, (c.minZ + c.maxZ) / 2);
      this.colliderHelpers.add(box);
    }
  }

  /* ============================================================
     Construction helpers
     ============================================================ */

  /** `w` is ignored now: the sprite takes its width from the picture's own proportions. */
  addBillboard(texture: THREE.Texture, _w: number, h: number, x: number, z: number): BillboardSprite {
    const b = new BillboardSprite(texture, h);
    b.position.set(x, 0, z);
    this.scene.add(b);
    this.billboards.push(b);
    return b;
  }

  /**
   * One piece of furniture, built the way its kind says to build it.
   *
   * Four forms, because the two that existed do not cover the world. A fence is not a
   * billboard — it would swing to face the camera and stop enclosing anything the moment the
   * player orbits with Q/E — and a scorch mark is not a box.
   */
  private addDressing(spec: DressingSpec, texture: THREE.Texture): void {
    const kind = DRESSING[spec.kind];
    const size = spec.size ?? kind.size;
    const img = texture.image as { width?: number; height?: number } | null | undefined;
    const aspect = img?.width && img.height ? img.width / img.height : 1;
    const yaw = spec.yaw ?? 0;

    if (kind.form === 'billboard') {
      // Through the same helper the trees use, so it lands in `world.billboards` and is turned
      // to camera each frame with everything else. `yaw` is meaningless here and a test says so
      // rather than letting it be silently discarded.
      const b = this.addBillboard(texture, size * aspect, size, spec.x, spec.z);
      // Scaled by the prop's own height, so a tall reed leans further than a mushroom does
      // while both bend by the same angle. A flat amplitude makes the small things wobble.
      if (SWAYS.has(spec.kind)) b.setSway(0.035 * size);
      this.loose.push({ obj: b, x: spec.x, z: spec.z, r: (size * aspect) / 2 });
    } else if (kind.form === 'panel') {
      // Deliberately not a `BillboardSprite`, and deliberately not pushed into `billboards`:
      // holding the yaw it was given is the entire reason this form exists.
      const geo = new THREE.PlaneGeometry(size * aspect, size);
      // Lifted so `position.y = 0` means standing on the floor, the same trick the gate uses.
      geo.translate(0, size / 2, 0);
      const panel = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({
          map: texture,
          transparent: false,
          alphaTest: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      panel.position.set(spec.x, 0, spec.z);
      panel.rotation.y = yaw;
      panel.castShadow = true;
      // Washing on a line and an awning over a stall are the two pieces of furniture that are
      // cloth, and cloth moves. The sway axis is local x, which for a fixed panel is the way it
      // hangs -- so a line billows along its own length instead of flapping edge-on.
      // The height is handed over because a panel's geometry is built at full size rather
      // than scaled from a unit plane -- see `applySway`, where getting this wrong made an
      // awning swing through most of a metre.
      if (SWAYS.has(spec.kind)) applySway(panel.material, 0.03 * size, size);
      this.scene.add(panel);
      this.loose.push({ obj: panel, x: spec.x, z: spec.z, r: (size * aspect) / 2 });
    } else if (kind.form === 'ground') {
      // Lambert, not Basic: the ground plane it lies on is Lambert, and an unlit decal would
      // glow on a dark street instead of taking the ward's light with everything else.
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshLambertMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      decal.rotation.x = -Math.PI / 2;
      decal.rotation.z = yaw;
      // A hair off the floor, so it does not fight the baked ground for depth.
      decal.position.set(spec.x, 0.03, spec.z);
      decal.renderOrder = 1;
      this.scene.add(decal);
      this.loose.push({ obj: decal, x: spec.x, z: spec.z, r: size / 2 });
    } else {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size * aspect, size, size),
        // `alphaTest` rather than a bare map: these textures do not fill their canvas — a
        // barrel is round and a trough is low — and an untested alpha renders those pixels as
        // solid black faces rather than as nothing. The crate got away without it only because
        // its art is a filled square.
        new THREE.MeshLambertMaterial({ map: texture, transparent: false, alphaTest: 0.5 }),
      );
      box.position.set(spec.x, size / 2, spec.z);
      box.rotation.y = yaw;
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
      // Into `structures` so a fight fades it, exactly as a building is faded — a barrel left
      // standing opaque in the middle of an arena is the same complaint as a wall would be.
      // Only this form: `inArena` reads `BoxGeometry.parameters`, so handing it a plane would
      // give it `depth: undefined` and a NaN comparison that silently answers false.
      //
      // Not into `hitboxes`, though. That list is raycast every frame for occlusion, and
      // waist-high furniture never stands between a camera 22 units out and the player.
      this.structures.push({ hit: box, mats: [box.material] });
    }

    // A brazier is a fire, so it lights what is around it. Same warm light the gas lamps cast,
    // at a shorter reach and with no pole: a fire in a basket is not a street lamp. An ember vent
    // is lit from the floor, low and red: a crack that breathes. Both borrow from the pool.
    if (spec.kind === 'brazier') {
      this.fires.push({ x: spec.x, y: size * 0.9, z: spec.z, kind: 'brazier' });
    } else if (spec.kind === 'embervent') {
      this.fires.push({ x: spec.x, y: 0.4, z: spec.z, kind: 'vent' });
    }

    // Whether it stops anybody is `kind.collides`, and the box it stops them with is built by
    // `staticFootprints` in one pass after all the furniture stands -- see the constructor.
  }

  private addCrate(texture: THREE.Texture, x: number, z: number, s: number): void {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshLambertMaterial({ map: texture }),
    );
    crate.position.set(x, s / 2, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    this.scene.add(crate);
    this.loose.push({ obj: crate, x, z, r: s / 2 });
  }

  /**
   * One solid run, built in the kit's style: cut into lots, each lot a piece with its own seed,
   * height and street face, each piece its own few meshes and its own fade. Returns the chimney
   * tops, for the smoke.
   *
   * The collider is the run's footprint as it always was -- the kit changes what you see, not
   * where you can walk -- and the fade target is an invisible box the size of what was built,
   * roof and all, because the occluder ray and the arena both read a box.
   */
  private buildStyled(
    area: AreaDef,
    char: string,
    rect: { col: number; row: number; w: number; d: number },
    solid: NonNullable<AreaDef['legend'][string]['solid']>,
    style: SolidStyle,
  ): THREE.Vector3[] {
    const chimneys: THREE.Vector3[] = [];
    const x0 = xOfCol(area, rect.col) - TILE / 2;
    const z0 = zOfRow(area, rect.row) - TILE / 2;
    const alongX = rect.w >= rect.d;
    const len = alongX ? rect.w : rect.d;
    const baseSeed = hashText(`${area.id}:${char}:${rect.col}:${rect.row}`);
    // Lots for a street; the old two-and-three cut for anything natural that asked to be split;
    // one piece for the rest.
    const lots = BUILT.has(style)
      ? lotsOf(len, baseSeed)
      : solid.split
        ? splitRun(len).map(([, w]) => w)
        : [len];
    let at = 0;
    lots.forEach((n, i) => {
      const ax0 = alongX ? x0 + at * TILE : x0;
      const az0 = alongX ? z0 : z0 + at * TILE;
      const aw = alongX ? n * TILE : rect.w * TILE;
      const ad = alongX ? rect.d * TILE : n * TILE;
      at += n;
      const seed = (baseSeed + i * 0x9e3779b1) >>> 0;
      const rng = makeRng(seed);
      const height = solid.minHeight + nextFloat(rng) * (solid.maxHeight - solid.minHeight);
      const chimney = !solid.bare && nextFloat(rng) < solid.chimneyChance;
      const ix = (alongX ? solid.inset : solid.depthInset) / 2;
      const iz = (alongX ? solid.depthInset : solid.inset) / 2;
      const px0 = ax0 + ix;
      const px1 = ax0 + aw - ix;
      const pz0 = az0 + iz;
      const pz1 = az0 + ad - iz;
      const facing = streetFacing(area, ax0, az0, aw, ad);
      const hasDoor = area.exits.some((e) => {
        const d = e.door;
        if (!d || !facing) return false;
        if (facing === 'south' || facing === 'north') {
          const fz = facing === 'south' ? pz1 : pz0;
          return d.x > px0 - 0.5 && d.x < px1 + 0.5 && Math.abs(d.z - fz) < TILE / 2;
        }
        const fx = facing === 'east' ? px1 : px0;
        return d.z > pz0 - 0.5 && d.z < pz1 + 0.5 && Math.abs(d.x - fx) < TILE / 2;
      });
      const built = buildPiece({ style, x0: px0, x1: px1, z0: pz0, z1: pz1, height, seed, facing, chimney, hasDoor });

      const mats: Structure['mats'] = [];
      const home = nextFloat(rng) < 0.7;
      for (const part of built.parts) {
        const mat = this.surface(part.surface, solid.wall ?? 'brick', style);
        if (part.glows) this.windows.push({ mat, home });
        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.castShadow = part.surface !== 'trim';
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        mats.push(mat as Structure['mats'][number]);
      }
      // The fade target: the size of what was built, never drawn.
      const cx = (px0 + px1) / 2;
      const cz = (pz0 + pz1) / 2;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0, built.top, pz1 - pz0), new THREE.MeshBasicMaterial());
      hit.position.set(cx, built.top / 2, cz);
      hit.visible = false;
      this.scene.add(hit);
      hit.updateMatrixWorld();
      this.structures.push({ hit, mats });
      this.hitboxes.push(hit);
      this.colliders.add(cx, cz, px1 - px0, pz1 - pz0, 'structure');
      chimneys.push(...built.chimneys);
    });
    return chimneys;
  }

  /**
   * A material for one of the kit's surfaces, over a texture shared across the whole area.
   *
   * A fresh material per piece, because each piece fades on its own -- the occluder writes a
   * material's opacity -- but never a fresh texture: a ward of forty terraces uploads one facade.
   */
  private surface(key: SurfaceKey, wall: WallTex, style: SolidStyle): THREE.MeshLambertMaterial {
    const tex = (k: string, make: () => THREE.Texture): THREE.Texture => {
      let t = this.kitTex.get(k);
      if (!t) {
        t = make();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        this.kitTex.set(k, t);
      }
      return t;
    };
    if (key === 'facade') {
      const kind: WindowKind = style === 'hall' ? 'tall' : style === 'warehouse' ? 'wide' : style === 'tower' ? 'slit' : 'house';
      const id = `facade:${wall}:${kind}`;
      let map = this.kitTex.get(id);
      let glow = this.kitTex.get(`${id}:glow`);
      if (!map || !glow) {
        const made = makeFacadeTextures(wall, kind);
        map = made.map;
        glow = made.glow;
        this.kitTex.set(id, map);
        this.kitTex.set(`${id}:glow`, glow);
      }
      return new THREE.MeshLambertMaterial({ map, emissiveMap: glow, emissive: new THREE.Color('#ffb060'), emissiveIntensity: 0 });
    }
    if (key === 'roof') {
      const kind: RoofKind =
        style === 'cottage' ? 'thatch' : style === 'warehouse' ? 'tin' : wall === 'timber' || wall === 'plaster' ? 'tile' : 'slate';
      return new THREE.MeshLambertMaterial({ map: tex(`roof:${kind}`, () => makeRoofTexture(kind)) });
    }
    if (key === 'trim') {
      return new THREE.MeshLambertMaterial({ map: tex('trim', makeTrimAtlas), alphaTest: 0.5, side: THREE.DoubleSide });
    }
    if (key === 'leaf') return new THREE.MeshLambertMaterial({ map: tex('leaf', makeLeafTexture), flatShading: true });
    if (key === 'bark') return new THREE.MeshLambertMaterial({ map: tex('bark', makeBarkTexture) });
    if (key === 'rock') return new THREE.MeshLambertMaterial({ map: tex('rock', WALL_ART.rock), flatShading: true });
    if (key === 'turf') return new THREE.MeshLambertMaterial({ map: tex('turf', makeTurfTexture), flatShading: true });
    if (key === 'ice') {
      return new THREE.MeshLambertMaterial({ map: tex('ice', makeIceTexture), flatShading: true, emissive: new THREE.Color('#1a2a38') });
    }
    if (key === 'iron') return new THREE.MeshLambertMaterial({ map: tex('iron', makeIronTexture) });
    return new THREE.MeshLambertMaterial({ map: tex(`wall:${wall}`, WALL_ART[wall]) });
  }

  /**
   * The landmarks: fixed parts in the kit's surfaces, a moving part on a pivot, a fade box of
   * their full height, and a light from the pool where they burn. See `landmarks.ts`.
   */
  private buildLandmarks(area: AreaDef): void {
    for (const [i, l] of (area.props.landmarks ?? []).entries()) {
      const kind = LANDMARKS[l.kind];
      const seed = hashText(`${area.id}:landmark:${i}`);
      const built = buildLandmark(l.kind, seed);
      const mats: Structure['mats'] = [];
      const material = (surface: SurfaceKey | 'glow'): THREE.Material =>
        surface === 'glow'
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(built.glow ?? '#ffd08a'), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
          : this.surface(surface, 'stone', 'tower');
      for (const part of built.parts) {
        const mat = material(part.surface);
        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.position.set(l.x, 0, l.z);
        mesh.castShadow = part.surface !== 'glow';
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        if (part.surface !== 'glow') mats.push(mat as Structure['mats'][number]);
      }
      for (const m of built.movers) {
        const pivot = new THREE.Group();
        pivot.position.set(l.x + m.pivot.x, m.pivot.y, l.z + m.pivot.z);
        const mat = material(m.surface);
        const mesh = new THREE.Mesh(m.geometry, mat);
        mesh.castShadow = m.surface !== 'glow';
        pivot.add(mesh);
        this.scene.add(pivot);
        if (m.surface !== 'glow') mats.push(mat as Structure['mats'][number]);
        this.movers.push({ pivot, mover: m, phase: (seed % 628) / 100 });
      }
      if (built.light) {
        this.fires.push({ x: l.x + built.light.at.x, y: built.light.at.y, z: l.z + built.light.at.z, kind: built.light.arc ? 'arc' : 'brazier' });
      }
      const hit = new THREE.Mesh(new THREE.BoxGeometry(kind.w, kind.height, kind.d), new THREE.MeshBasicMaterial());
      hit.position.set(l.x, kind.height / 2, l.z);
      hit.visible = false;
      this.scene.add(hit);
      hit.updateMatrixWorld();
      this.structures.push({ hit, mats });
      this.hitboxes.push(hit);
    }
  }

  /** Turns the sails, swings the bells, sweeps the beams. Called every frame by the screen. */
  updateLandmarks(t: number): void {
    for (const { pivot, mover, phase } of this.movers) {
      pivot.quaternion.setFromAxisAngle(mover.axis, moverAngle(mover, t, phase));
    }
  }

  /**
   * The ground clutter, one instanced mesh per kind: a single draw call for every tuft in the
   * area, and no shadows -- at this size a shadow is a smudge and costs a second pass.
   */
  private buildClutter(area: AreaDef): void {
    const avoid = [
      ...area.exits.map((e) => ({ x: e.x, z: e.z, r: 1.6 })),
      ...area.exits.flatMap((e) => (e.door ? [{ x: e.door.x, z: e.door.z, r: 1.6 }] : [])),
      ...registryHotspots(area.id).map((h) => ({ x: h.x, z: h.z, r: 1.2 })),
      ...(area.props.npcs ?? []).map((n) => ({ x: n.x, z: n.z, r: 1.0 })),
      ...staticFootprints(area).map((f) => ({ x: f.x, z: f.z, r: Math.max(f.w, f.d) / 2 + 0.35 })),
      ...(area.props.lamps ?? []).map((l) => ({ x: l.x, z: l.z, r: 0.7 })),
    ];
    const points = scatterClutter(area, avoid);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const kind of CLUTTER_KINDS) {
      const mine = points.filter((p) => p.kind === kind);
      if (mine.length === 0) continue;
      const size = CLUTTER_SIZE[kind];
      let geo: THREE.BufferGeometry;
      if (STANDING.has(kind)) {
        // Two cards crossed, so it has a front from every side the camera orbits to.
        const a = new THREE.PlaneGeometry(size, size);
        a.translate(0, size / 2, 0);
        const b = a.clone();
        b.rotateY(Math.PI / 2);
        geo = mergeGeometries([a, b])!;
      } else {
        geo = new THREE.PlaneGeometry(size, size);
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0.025, 0);
      }
      const mat = new THREE.MeshLambertMaterial({
        map: makeClutterTexture(kind),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        ...(STANDING.has(kind) ? {} : { polygonOffset: true, polygonOffsetFactor: -1 }),
      });
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach((p, i) => {
        q.setFromAxisAngle(up, p.yaw);
        m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = !STANDING.has(kind);
      this.scene.add(mesh);
      this.clutter.push({ mesh, points: mine });
    }
  }

  /** Takes the clutter off the board's footprint, or puts it all back. */
  private clutterForArena(rect: { x0: number; z0: number; x1: number; z1: number } | null): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const { mesh, points } of this.clutter) {
      points.forEach((p, i) => {
        const hide = !!rect && p.x > rect.x0 && p.x < rect.x1 && p.z > rect.z0 && p.z < rect.z1;
        const s = hide ? 0 : p.scale;
        q.setFromAxisAngle(up, p.yaw);
        m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The chimney smoke: one cloud of points for the area, a dozen puffs a chimney. */
  private buildSmoke(from: THREE.Vector3[]): void {
    const per = 12;
    const n = from.length * per;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const age = new Float32Array(n);
    for (let i = 0; i < n; i++) age[i] = (i % per) * (SMOKE_LIFE / per);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.6,
        map: makeSmokeTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    points.frustumCulled = false;
    this.scene.add(points);
    this.smoke = { points, from, age };
    this.updateSmoke(0);
  }

  /**
   * Each puff rises, drifts downwind, swells and fades, then starts again at its chimney.
   * Allocates nothing. Called every frame by the screen.
   */
  updateSmoke(dt: number): void {
    const s = this.smoke;
    if (!s) return;
    const per = 12;
    const pos = s.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = s.points.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < s.age.length; i++) {
      let a = s.age[i]! + dt;
      if (a > SMOKE_LIFE) a -= SMOKE_LIFE;
      s.age[i] = a;
      const src = s.from[(i / per) | 0]!;
      const k = a / SMOKE_LIFE;
      const wob = Math.sin(i * 1.7 + a * 1.3) * 0.25;
      pos.setXYZ(i, src.x + k * 2.6 + wob, src.y + 0.2 + k * 3.4, src.z - k * 1.2 + wob * 0.6);
      // In fast and out slow, the way a puff thins.
      const alpha = Math.min(1, k * 6) * (1 - k) * 0.55;
      col.setXYZW(i, 0.62, 0.6, 0.58, alpha);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private addStructure(
    wallTexture: THREE.Texture,
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    opts: { chimney?: number; bare?: boolean },
  ): void {
    const tex = wallTexture.clone();
    configurePixelTexture(tex);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    tex.needsUpdate = true;

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    box.position.set(x, h / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);

    const parts: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[] = [
      box as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
    ];

    // Flat industrial roofs with a parapet. No fairytale cones in this ward -- and no roofline
    // at all on a `bare` wall, which is a partition or a rock face and not a building.
    if (!opts.bare) {
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.35, 0.4, d + 0.35),
        new THREE.MeshLambertMaterial({ color: 0x2b2622 }),
      );
      parapet.position.set(x, h + 0.2, z);
      parapet.castShadow = true;
      this.scene.add(parapet);
      parts.push(parapet as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>);
    }

    if (opts.chimney && !opts.bare) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, opts.chimney, 6),
        new THREE.MeshLambertMaterial({ color: 0x241f1c }),
      );
      stack.position.set(x + w * 0.28, h + opts.chimney / 2, z - d * 0.24);
      stack.castShadow = true;
      this.scene.add(stack);
      parts.push(stack as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>);
    }

    this.structures.push({ hit: box, mats: parts.map((p) => p.material) });
    this.hitboxes.push(box);
    this.colliders.add(x, z, w, d, 'structure');
  }

  /**
   * Hands a loose material to whichever building it is mounted on, so the two fade as one.
   *
   * Matched by position against the footprints already extracted from the map, rather than
   * by a list kept beside them: a sign is on the wall it is standing in front of, and that
   * is a fact the geometry already knows.
   */
  private attachToStructure(x: number, z: number, mat: THREE.Material): void {
    for (const s of this.structures) {
      const geo = s.hit.geometry as THREE.BoxGeometry;
      const { width, depth } = geo.parameters;
      const p = s.hit.position;
      if (
        x > p.x - width / 2 - 0.6 &&
        x < p.x + width / 2 + 0.6 &&
        z > p.z - depth / 2 - 0.6 &&
        z < p.z + depth / 2 + 0.6
      ) {
        s.mats.push(mat as Structure['mats'][number]);
        return;
      }
    }
  }

  private addLamp(x: number, z: number): void {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x17181d }),
    );
    pole.position.set(x, 1.7, z);
    pole.castShadow = true;
    this.scene.add(pole);

    // An unlit material reads as emissive and gives the bloom something to grab.
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 0.42),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(LOOK.lampColor) }),
    );
    head.position.set(x, 3.6, z);
    this.scene.add(head);
    // The post and its head go if a fight is laid over them; the light it casts is the pool's,
    // and a fire in the arena keeps lighting it -- which is the right picture for a street lamp
    // whose post is simply out of the shot.
    this.loose.push({ obj: pole, x, z, r: 0.3 }, { obj: head, x, z, r: 0.3 });

    const lamp: Lamp = {
      x,
      z,
      head,
      phase: this.lamps.length * 1.7,
      lit: lampsAt(lightingHour(this.indoor, this.hour)),
    };
    this.lamps.push(lamp);
    this.fires.push({ x, y: 3.6, z, kind: 'lamp', lamp });
  }

  /* ============================================================
     Per-frame
     ============================================================ */

  /**
   * The gas lamps, flickering — and going out.
   *
   * The lamps are the payoff of having a clock at all. Azo has forty-one of them on the Lamprow
   * High Street alone and a lamplighter whose whole job is walking that row; until now they
   * burned at the same intensity at every hour of a day that did not exist. `lampsAt` lags the
   * sun by an hour at each end, so they are lit before the light has entirely gone and are still
   * up for the first of the morning — which is the only thing in the world that shows somebody
   * is doing a job on a schedule.
   *
   * The flicker is unchanged and still runs at noon. A dead lamp does not flicker, but it also
   * does not cost anything to compute, and gating the maths would put a branch in the one loop
   * here that runs per lamp per frame.
   */
  /** Where a lamp stands, for whoever is walking the row. */
  lampPosition(i: number): { x: number; z: number } | null {
    const l = this.lamps[i];
    return l ? { x: l.x, z: l.z } : null;
  }

  get lampCount(): number {
    return this.lamps.length;
  }

  /**
   * How brightly one lamp burns, 0 to 1.
   *
   * Set per lamp so a row can be lit one at a time by somebody walking it. Every lamp is reset to
   * the hour's own curve by `setHour`, so a ward with nobody to light it behaves exactly as it
   * did — which is eighteen of the nineteen.
   */
  setLampLit(i: number, k: number): void {
    const l = this.lamps[i];
    if (l) l.lit = k;
  }

  /**
   * Hands the pool to the fires nearest `(fx, fz)` -- whoever the camera is following -- and
   * burns each at its own strength times its share. See `poolShares` for why a fire leaving the
   * pool never flashes.
   */
  updateLamps(t: number, fx = 0, fz = 0): void {
    poolShares(this.fires, fx, fz, this.pool.length, POOL_BAND, this.shares);
    let slot = 0;
    for (let i = 0; i < this.fires.length && slot < this.pool.length; i++) {
      const share = this.shares[i]!;
      if (share <= 0) continue;
      const fire = this.fires[i]!;
      const light = this.pool[slot++]!;
      light.position.set(fire.x, fire.y, fire.z);
      if (fire.lamp) {
        const l = fire.lamp;
        // Two summed sines read as a gas flame and allocate nothing.
        const n =
          0.5 +
          0.5 * (Math.sin(t * 6.3 + l.phase) * 0.6 + Math.sin(t * 11.7 + l.phase * 2.1) * 0.4);
        light.color.set(LOOK.lampColor);
        light.distance = LOOK.lampDistance;
        light.intensity = LOOK.lampIntensity * (1 - LOOK.lampFlicker + LOOK.lampFlicker * n * 2) * l.lit * share;
      } else if (fire.kind === 'brazier') {
        // A wood fire gutters harder and faster than gas: three sines, one of them quick, on a
        // phase from where it stands so two braziers in one yard never breathe together.
        const ph = fire.x * 0.37 + fire.z * 0.61;
        const n = 0.5 + 0.5 * (Math.sin(t * 7.1 + ph) * 0.45 + Math.sin(t * 13.3 + ph * 1.7) * 0.35 + Math.sin(t * 23 + ph * 2.9) * 0.2);
        light.color.copy(BRAZIER_LIGHT);
        light.distance = LOOK.lampDistance * 0.6;
        light.intensity = LOOK.lampIntensity * 0.8 * (0.62 + 0.76 * n) * share;
      } else if (fire.kind === 'arc') {
        // The sky coming down to the iron: a low hum of blue most of the time, and a strike every
        // few seconds -- two quick flashes, on a phase from where it stands.
        const ph = fire.x * 0.29 + fire.z * 0.53;
        const k = (t * 0.31 + ph) % 1;
        const strike = k < 0.03 || (k > 0.05 && k < 0.07) ? 1 : 0;
        light.color.copy(ARC_LIGHT);
        light.distance = LOOK.lampDistance * 1.4;
        light.intensity = LOOK.lampIntensity * (0.18 + 1.6 * strike) * share;
      } else {
        light.color.copy(VENT_LIGHT);
        light.distance = LOOK.lampDistance * 0.4;
        light.intensity = LOOK.lampIntensity * 0.5 * share;
      }
    }
    // Whatever the pool has left over this frame stands dark rather than being removed: taking
    // a light out of the scene is what recompiles it.
    for (; slot < this.pool.length; slot++) this.pool[slot]!.intensity = 0;
  }

  /** Keeps the key light's shadow frustum centred on whoever the camera is following. */
  trackSun(x: number, y: number, z: number): void {
    this.sun.position.set(x - 12, 18, z + 10);
    this.sun.target.position.set(x, y, z);
  }

  scrollWater(dt: number): void {
    // No canal, nothing to scroll. Called every frame from the loop, which does not know
    // or care which area it is drawing.
    if (!this.waterTexture) return;
    this.waterTexture.offset.x += 0.03 * dt;
  }

  /**
   * Something rising in the canal.
   *
   * A ring that expands and fades, on a timer, somewhere in the water. There is no fish: the
   * ring *is* the fish, the same way a footprint is a person, and at the range the camera keeps
   * from the quay a drawn body would be four pixels of guesswork. What the player reads is that
   * the water is not a scrolling texture — which, until this, is exactly what it was.
   *
   * Pooled and reused rather than allocated, on the `ImpactLight` pattern. Absent wherever
   * `waterRows` is, like the water itself.
   */
  updateRises(dt: number, rng: () => number): void {
    if (!this.waterRect) return;

    this.riseTimer -= dt;
    if (this.riseTimer <= 0) {
      // Irregular on purpose. A rise every three seconds exactly is a machine.
      this.riseTimer = 1.8 + rng() * 5.5;
      this.spawnRise(
        (rng() - 0.5) * this.waterRect.w,
        this.waterRect.z0 + rng() * (this.waterRect.z1 - this.waterRect.z0),
      );
    }

    for (let i = this.rises.length - 1; i >= 0; i--) {
      const r = this.rises[i]!;
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rises.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.max;
      // Expands fast and then slows, which is what a ring on water does; a linear expansion
      // reads as a circle being scaled, because that is all it is.
      const spread = Math.sqrt(k);
      r.mesh.scale.setScalar(0.4 + spread * r.reach);
      r.mesh.material.opacity = (1 - k) * 0.5;
    }
  }

  private spawnRise(x: number, z: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#cfe3ea'),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    // Just proud of the water plane at -0.5. Any lower and it z-fights the surface it is on.
    mesh.position.set(x, -0.46, z);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.rises.push({ mesh, life: 2.6, max: 2.6, reach: 1.6 + Math.random() * 1.4 });
  }

  /**
   * One frame of falling air, centred on whoever the camera is watching.
   *
   * The anchor is the whole design: see `weather.ts`. A field big enough to cover the Ashwood
   * would be tens of thousands of points, all but a few dozen of them behind the player or
   * beyond the fog.
   */
  updateSky(dt: number, anchor: THREE.Vector3): void {
    this.sky?.update(dt, anchor);
  }

  /**
   * Fades whatever stands between the camera and the player.
   *
   * Courtyards and the shopfront side of the cross-street are simply unplayable without
   * this: the camera sits low enough that a terrace behind the player becomes a wall
   * across the middle of the screen.
   */
  updateOccluders(dt: number, camera: THREE.Camera, target: THREE.Vector3): void {
    // Aimed at the head rather than the feet — a ray along the ground grazes every wall it
    // passes and would fade the whole street.
    this.occTarget.set(target.x, target.y + 1.2, target.z);
    this.occDir.subVectors(this.occTarget, camera.position);
    const dist = this.occDir.length();
    this.occRay.set(camera.position, this.occDir.normalize());
    this.occRay.far = dist;

    this.occHit.clear();
    for (const h of this.occRay.intersectObjects(this.hitboxes, false)) this.occHit.add(h.object);

    const k = Math.min(1, dt * 9);
    for (const s of this.structures) {
      // Nearly all the way out, not merely dim. These walls are dark brick against a dark
      // street, so a tenth of one still reads as a wall — the two south-facing doors put
      // the camera directly behind their own building, and at 0.16 the Commander was a
      // silhouette behind a grey pane rather than someone standing in a doorway.
      //
      // The arena is folded into the same `want` rather than faded by a second pass. It has
      // to be: this loop runs every frame and writes `1` to everything it does not consider
      // occluded, so an arena fade applied from outside would be undone on the next frame.
      // One place decides how visible a building is.
      const want =
        this.occHit.has(s.hit) || this.inArena(s.hit) || this.underCamera(s.hit, camera.position)
          ? 0.04
          : 1;
      for (const mat of s.mats) {
        if (Math.abs(mat.opacity - want) < 0.005) {
          mat.opacity = want;
          continue;
        }
        mat.opacity += (want - mat.opacity) * k;
        const clear = mat.opacity < 0.995;
        if (mat.transparent !== clear) {
          mat.transparent = clear;
          mat.needsUpdate = true;
        }
        mat.depthWrite = !clear;
      }
    }
  }

  /* ============================================================
     The combat arena
     ============================================================ */

  /**
   * A patch of ground that must be clear to fight on.
   *
   * Set while a board is standing on the street, so anything built inside its footprint
   * fades out of the way. In a dense ward the placement search cannot always find a window
   * with nothing in it — Ashfall's worst case clips the corner of one terrace — and the
   * honest answer is to move the terrace out of the shot rather than to draw the grid
   * through it.
   *
   * Consumed by `updateOccluders`, which is the one place that decides a building's opacity.
   * Null clears it and the street comes back on its own over the next few frames.
   */
  private arena: { x0: number; z0: number; x1: number; z1: number } | null = null;

  setArena(rect: { x0: number; z0: number; x1: number; z1: number } | null): void {
    this.arena = rect;
    // Buildings and box props fade through `updateOccluders`. Everything else loose on the ground
    // inside the footprint is simply taken away while the board is up: a tree or a fence standing
    // in the middle of the grid is the same complaint as a wall, and nothing fades a billboard.
    for (const o of this.hiddenForArena) o.visible = true;
    this.hiddenForArena.length = 0;
    this.clutterForArena(rect);
    if (!rect) return;
    for (const l of this.loose) {
      if (!l.obj.visible) continue;
      if (l.x + l.r > rect.x0 && l.x - l.r < rect.x1 && l.z + l.r > rect.z0 && l.z - l.r < rect.z1) {
        l.obj.visible = false;
        this.hiddenForArena.push(l.obj);
      }
    }
  }

  /**
   * Whether the camera is standing over this building, or nearly.
   *
   * The raycast fades what lies on the line to the player's head, and a terrace directly under
   * the camera is not on that line: the ray clears its roof by a metre and the roof still fills
   * the bottom third of the screen, with the player's feet behind its parapet. The yards behind
   * the terraces -- the Warden's, the back alley, the Counting House door -- are played from
   * exactly there, so anything within a stride of being under the lens goes with the rest.
   */
  private underCamera(hit: THREE.Mesh, cam: THREE.Vector3): boolean {
    const { width, depth } = (hit.geometry as THREE.BoxGeometry).parameters;
    const p = hit.position;
    const margin = 3.5;
    return Math.abs(cam.x - p.x) < width / 2 + margin && Math.abs(cam.z - p.z) < depth / 2 + margin;
  }

  private inArena(hit: THREE.Mesh): boolean {
    const a = this.arena;
    if (!a) return false;
    const geo = hit.geometry as THREE.BoxGeometry;
    const { width, depth } = geo.parameters;
    const p = hit.position;
    return (
      p.x - width / 2 < a.x1 &&
      p.x + width / 2 > a.x0 &&
      p.z - depth / 2 < a.z1 &&
      p.z + depth / 2 > a.z0
    );
  }

  /**
   * Thins the fog while a fight is on, and puts it back afterwards.
   *
   * Not a nicety. The walk camera sits twenty-two units out; framing a whole arena needs
   * roughly twice that, and at Lamprow's authored density of 0.036 an exponential fog has
   * eaten most of the board's contrast by the time it is all in shot. The area's own look is
   * still the look — this scales it for the one situation the area was not tuned for.
   *
   * A multiplier rather than an absolute, so each area keeps its own character: the Chalk
   * Road stays the clearest place in the game and Lamprow stays the thickest.
   */
  setFogScale(scale: number): void {
    (this.scene.fog as THREE.FogExp2).density = this.lit.fogDensity * scale;
  }

  /* ============================================================
     VFX
     ============================================================ */

  spawnImpactLight(position: THREE.Vector3, colorOverride?: string, scale = 1): void {
    const light = new THREE.PointLight(
      new THREE.Color(colorOverride ?? LOOK.impactColor),
      LOOK.impactIntensity * scale,
      LOOK.impactDistance,
      2,
    );
    light.position.copy(position).add(new THREE.Vector3(0, 1.1, 0));
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    this.scene.add(light);
    this.impacts.push({
      light,
      life: LOOK.impactDecayTime,
      max: LOOK.impactDecayTime,
      peak: LOOK.impactIntensity * scale,
    });
  }

  updateImpactLights(dt: number): void {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const fx = this.impacts[i]!;
      fx.life -= dt;
      if (fx.life <= 0) {
        this.scene.remove(fx.light);
        fx.light.dispose();
        this.impacts.splice(i, 1);
      } else {
        const t = fx.life / fx.max;
        fx.light.intensity = fx.peak * t * t;
      }
    }
  }

  /**
   * Compiles the shader variants the ward will need, before it needs them.
   *
   * three bakes the number of shadow-casting point lights into every lit material, so the
   * first impact light otherwise recompiles the whole scene mid-frame. Paying for it at
   * load costs a few frames nobody is looking at.
   */
  warmupShaders(render: () => void, maxConcurrent = 3): void {
    // The occluder fade's transparent variant, first.
    const restore: THREE.Material[] = [];
    for (const s of this.structures) {
      for (const mat of s.mats) {
        if (!mat.transparent) {
          mat.transparent = true;
          mat.needsUpdate = true;
          restore.push(mat);
        }
      }
    }
    render();
    for (const mat of restore) {
      mat.transparent = false;
      mat.needsUpdate = true;
    }
    render();

    const temp: THREE.PointLight[] = [];
    for (let i = 0; i < maxConcurrent; i++) {
      const l = new THREE.PointLight(0xffffff, 0.0001, 1, 2);
      l.position.set(0, -60 - i, 0);
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      this.scene.add(l);
      temp.push(l);
      render();
    }
    for (const l of temp) {
      this.scene.remove(l);
      l.dispose();
    }
  }

  setCollidersVisible(on: boolean): void {
    this.colliderHelpers.visible = on;
  }

  /* ============================================================
     Look changes from the panel
     ============================================================ */

  /**
   * Moves the clock, and the light with it.
   *
   * Recomputes from `amb` every time rather than stepping the current value, so the hour is the
   * single input and nothing drifts: setting it back to `NIGHT_ANCHOR` returns the exact street
   * the lighting passes measured, whatever it has been through since.
   */
  setHour(hour: number): void {
    this.hour = hour;
    this.lit = this.litNow();
    this.applyFog();
    this.applySun();
    this.applyAmbient();
    // The air too. A mote is lit by the same light as the street it is falling on, so this
    // reads the ambience that was just computed rather than the hour a second time.
    this.sky?.relight(this.lit, hour);
    this.sky?.setStrength(skyStrengthAt(this.areaId, this.skyId, hour));
    // The default, which is the whole ward fading together on one curve. A lamplighter overrides
    // it lamp by lamp immediately afterwards; everywhere else this is the behaviour, unchanged.
    const burning = lampsAt(lightingHour(this.indoor, hour));
    for (const l of this.lamps) l.lit = burning;
    // The windows of the houses with somebody in them, on the lamps' own curve.
    for (const w of this.windows) w.mat.emissiveIntensity = w.home ? burning * WINDOW_GLOW : 0;
  }

  /** The ambience at the hour this place is lit at -- the clock's, or a room's anchor. */
  private litNow(): Lit {
    return ambientAt(this.amb, lightingHour(this.indoor, this.hour));
  }

  applyFog(): void {
    // Re-derived here as well as in `setHour`, because the tuning panel calls this directly
    // after editing `amb` and would otherwise be writing last hour's values.
    this.lit = this.litNow();
    (this.scene.fog as THREE.FogExp2).color.set(this.lit.fogColor);
    (this.scene.fog as THREE.FogExp2).density = this.lit.fogDensity;
    (this.scene.background as THREE.Color).set(this.lit.fogColor);
    this.voidMat?.color.set(this.lit.fogColor);
  }

  applySun(): void {
    this.lit = this.litNow();
    this.sun.intensity = this.lit.sunIntensity;
    this.sun.color.set(this.lit.sunColor);
  }

  applyAmbient(): void {
    this.lit = this.litNow();
    this.hemi.intensity = this.lit.ambientIntensity;
    this.hemi.color.set(this.lit.skyColor);
    this.hemi.groundColor.set(this.lit.groundBounce);
  }

  /** The heads, after the panel moves the colour. The pool reads `LOOK` itself every frame. */
  applyLamps(): void {
    for (const l of this.lamps) l.head.material.color.set(LOOK.lampColor);
  }

  applySigns(): void {
    for (const s of this.signs) s.material.color.set(LOOK.signColor);
  }

  /* ============================================================
     Teardown
     ============================================================ */

  /**
   * Releases every GPU resource the ward holds.
   *
   * Walks the graph rather than tracking a list, because the list is the thing that goes
   * stale: anything added later and forgotten here would leak silently, once per errand,
   * until the browser started reclaiming contexts.
   */
  dispose(): void {
    for (const fx of this.impacts) {
      this.scene.remove(fx.light);
      fx.light.dispose();
    }
    this.impacts.length = 0;

    this.scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of list) {
        const withMap = m as THREE.Material & { map?: THREE.Texture | null };
        withMap.map?.dispose();
        m.dispose();
      }
      if ((obj as THREE.Light).isLight) (obj as THREE.PointLight).dispose?.();
    });

    for (const r of this.rises) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.rises.length = 0;

    this.sun.shadow.dispose();
    // Optional-chained because an area without a canal never made one. Unguarded this is a
    // crash on leaving the wilds, not a leak.
    this.waterTexture?.dispose();
    this.scene.clear();
    this.billboards.length = 0;
    this.structures.length = 0;
    this.hitboxes.length = 0;
    this.lamps.length = 0;
    this.signs.length = 0;
    this.loose.length = 0;
    this.hiddenForArena.length = 0;
    for (const t of this.kitTex.values()) t.dispose();
    this.kitTex.clear();
    this.windows.length = 0;
    this.smoke = null;
    this.clutter.length = 0;
    this.movers.length = 0;
  }
}
