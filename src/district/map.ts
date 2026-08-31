/**
 * What a walkable place is, as a grid of characters.
 *
 * A grid is the single source of truth for four separate things: what the ground is painted
 * with, where the Sidewalk Immunity rule holds, what the player can walk through, and where
 * the buildings stand. They were four answers once and they disagreed — a street that looked
 * paved but read as cobbles underfoot is a rule the player cannot learn. One grid means the
 * paving can never lie about where the rules change.
 *
 * This file used to *be* Ashfall Ward. It now describes the **kind** of thing Ashfall is, and
 * the ward itself lives in `areas/ashfall.ts` beside the wildlands. That is the same move the
 * file made once before, one level up: the four answers became one grid, and now the one grid
 * becomes one of several.
 *
 * Nothing here imports three.js or touches the DOM: it is geometry and lookup, so it can be
 * unit-tested without a canvas. In particular it holds **no module-level current area** —
 * every lookup takes the area it is asking about. See `defineArea` for why that is not
 * negotiable.
 */

import type { FolkId } from '../render/folk.js';
import type { DressingId } from './dressing.js';
import type { CritterId } from './wildlife.js';
import type { Gate } from './chronicle.js';
import type { PackHours } from './daylight.js';
import type { SkyId } from './skies.js';

/**
 * World units per tile, global to every area.
 *
 * Deliberately not per-area. Every feel constant in the game is tuned against it — the walk
 * speed, the collider radii, the interact radius, the camera distance — and the anti-tunneling
 * proof in `collision.ts` is stated in terms of it. An area with a different tile size would
 * be an area with a subtly different stride, which is a bug wearing the clothes of a feature.
 */
export const TILE = 4;

export interface TileDef {
  /** Which paint `bakeGround` puts down. Open-ended: the wilds grows its own. */
  readonly tex: string;
  /** Whether Sidewalk Immunity holds here. */
  readonly safe: boolean;
  readonly walk: boolean;
  /**
   * How this tile stands up, if it is solid.
   *
   * Here rather than in `world.ts` because building heights were literals in the geometry
   * builder, keyed by the characters `B` and `V` — which made those two characters magic in a
   * file that otherwise reads the grid generically. A new area's rock face gets a silhouette
   * through the same door instead of a third hardcoded branch.
   */
  readonly solid?: {
    readonly minHeight: number;
    readonly maxHeight: number;
    /** Shrink in x/z, so neighbouring blocks read as separate buildings. */
    readonly inset: number;
    readonly depthInset: number;
    readonly chimneyChance: number;
    /** Chunk long runs into two- and three-tile pieces, for a skyline. */
    readonly split: boolean;
  };
}

/** Which trade a door leads to. Mirrors the four callbacks the hub screen takes. */
export type DoorKey = 'apothecary' | 'artificer' | 'vivarium' | 'journal';

export interface DoorSpec {
  readonly key: DoorKey;
  /** What the sign over the door says, and what the interact prompt calls it. */
  readonly name: string;
  /** Where the player stands to read the prompt — always a walkway tile. */
  readonly x: number;
  readonly z: number;
  /** The plaque on the building face, lifted off the wall so bloom catches it. */
  readonly signX: number;
  readonly signZ: number;
  /**
   * Where to put the player when they come back out.
   *
   * Nudged away from the door along the street, because respawning exactly on the hotspot
   * re-raises the prompt the instant the screen mounts — the player closes the Artificer
   * and is immediately invited to open it again.
   */
  readonly returnZ: number;
}

/**
 * A way out of an area, and where it puts you down.
 *
 * `arrive` lives on the exit in the area you are **leaving**, which is `DoorSpec.returnZ`
 * generalised to two dimensions and to a destination. Where you come back to is a property of
 * the doorway rather than of the place: the wilds will grow a second way in, and both ways
 * cannot share one arrival tile.
 *
 * Deliberately not derived from the reciprocal exit's position plus an offset — the offset's
 * direction depends on which way the doorway faces, the data does not know that, and guessing
 * is how somebody spawns inside a wall.
 */
export interface ExitSpec {
  /** The area id this leads to. */
  readonly to: string;
  readonly x: number;
  readonly z: number;
  readonly label: string;
  readonly radius?: number;
  /**
   * Where the gate itself stands, if this doorway has one to draw.
   *
   * Stated rather than derived from the hotspot. It *was* derived — "a stride north of where
   * you stand" — which is true of Ashfall's yard wall and false the moment a doorway faces
   * the other way: the wall landed between the arrival tile and the way out, and the second
   * area was a room you could enter and not leave. Which side of a doorway the frame is on
   * is a fact about that doorway, and the data is where facts live.
   *
   * Absent means no scenery and no collider — a gap in a thicket is a way through without
   * being a gate.
   */
  readonly gate?: { readonly x: number; readonly z: number };
  /** Where the player stands on the far side. Must be walkable there, and clear of its hotspot. */
  readonly arrive: { readonly x: number; readonly z: number };
}

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

/**
 * Somebody standing in a ward with something to say.
 *
 * Everything past the position is optional, and absent means *the Dispatcher* — which is what
 * the one NPC that predates this interface is, and why Ashfall's `{id: 'vex', x, z}` still
 * reads correctly with no art, label or script of its own.
 */
export interface NpcSpec {
  /** Identity, and the key their dialogue is filed under. Unique within an area. */
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Which drawing off the townsfolk sheets. Absent means the Dispatcher's own art. */
  readonly art?: FolkId;
  /** The interact prompt: "Talk to the miller". Absent means the Dispatcher's. */
  readonly label?: string;
  /**
   * Which script they read, as a key into `FOLK_LINES`.
   *
   * Separate from `id` so two people can share a script — a market with four traders saying
   * the same thing about the weigh-house is a market, not a bug — and defaulted to `id` by
   * the screen when it is left out.
   */
  readonly says?: string;
}

/**
 * Animals on a patch. See `wildlife.ts` for what each kind is and how it behaves.
 *
 * Shaped like `PackSpec` on purpose — a home, a radius, and a wander — because the motion is
 * the same motion and reading the two side by side in an area file should make that obvious.
 * What it does not have is an encounter, and it never will: nothing here can be fought.
 */
export interface WildlifeSpec {
  readonly kind: CritterId;
  readonly x: number;
  readonly z: number;
  /** How far from home it will wander. */
  readonly roam: number;
  /**
   * How many, from one line.
   *
   * Their homes are jittered around this one, so a flight of six rooks or a pair of deer is a
   * single authored entry rather than six. Absent means one.
   */
  readonly count?: number;
}

/** A wandering minion pack. See `data/packs.ts` for what it fights as. */
export interface PackSpec {
  /** The encounter walking into it starts. */
  readonly encounterId: string;
  /**
   * When this crew is out. Absent means always.
   *
   * A reading of what they are doing rather than a difficulty setting — see `PackHours`. A pack
   * that is not out is not spawned at all, so the road is genuinely empty rather than holding
   * something asleep.
   */
  readonly hours?: PackHours;
  /** The middle of its beat. */
  readonly x: number;
  readonly z: number;
  /** How far from home it will wander. */
  readonly roam: number;
}

/**
 * A line scrawled on a wall — the campaign's clue layer.
 *
 * Anchored to a wall position and an offset along it, rather than to a door's **index** in
 * the area's door list, which is what it used to be. That form reached across files into an
 * array position and skipped silently when the index missed, so reordering the doors would
 * have erased the graffiti rather than moved it.
 */
export interface GraffitiSpec {
  readonly text: string;
  /**
   * When this line is on the wall, if it is not always.
   *
   * The reason `docs/worldbuild-todo.md` carried a row about `DON'T CARRY IT IN` through four
   * waves: the most pointed sentence in the world was painted on Ashfall's wall from turn one,
   * where it is a warning about something the player has not been offered yet. Absent means
   * always, which is what every other line here wants.
   */
  readonly gate?: Gate;
  /** The wall face it is painted on — the same point a door plaque is hung at. */
  readonly wallX: number;
  readonly wallZ: number;
  /** Strides along the wall from that point. Its sign also decides which way the tilt goes. */
  readonly dx: number;
  /** Whether the painted face looks south (+z). Decides the nudge off the wall and the yaw. */
  readonly facesSouth: boolean;
  readonly tint: string;
}

/**
 * One piece of furniture standing in a ward.
 *
 * The kind says what it is and how it is built (`district/dressing.ts`); this says where, and
 * which way round. Everything past the position is optional because most props do not care.
 */
export interface DressingSpec {
  readonly kind: DressingId;
  readonly x: number;
  readonly z: number;
  /**
   * Which way it faces, in radians, for the forms that have a front.
   *
   * Meaningful for `panel` and ignored by everything else: a billboard turns to the camera by
   * definition, a box this size reads the same from every side, and a ground decal is round.
   * Absent means zero, which faces south — the direction most of these maps are read from.
   */
  readonly yaw?: number;
  /** Overrides the kind's own size, for the one crate that should be bigger than the others. */
  readonly size?: number;
  /** What is carved on it. `waystone` only; ignored elsewhere. */
  readonly text?: string;
}

/** Everything an area may put on top of its ground. All optional; the wilds uses few. */
export interface AreaProps {
  readonly doors?: readonly DoorSpec[];
  readonly board?: Vec2;
  readonly npcs?: readonly NpcSpec[];
  /** Warden beats. One patrol per waypoint ring. */
  readonly patrols?: readonly (readonly Vec2[])[];
  readonly packs?: readonly PackSpec[];
  /**
   * What lives here.
   *
   * Empty is a legal and meaningful answer — the Caldera floor is not somewhere anything walks —
   * but it is worth being deliberate about, because "no animals" and "nobody got round to it"
   * look identical in an area file and only one of them is a decision.
   */
  readonly wildlife?: readonly WildlifeSpec[];
  /**
   * What is falling out of the sky here.
   *
   * Named `sky` rather than `weather` because the engine already has a `Weather` and it is
   * a combat rule -- fog shortens a sightline, a gale carries a shot. See `skies.ts`.
   *
   * Required in practice rather than by the type: a test asks every area to declare one, so an
   * area with still air says `'none'` out loud instead of arriving at it by omission. The
   * difference matters exactly once — the first time somebody adds an area and forgets.
   */
  readonly sky?: SkyId;
  /**
   * Where the hunting notices are posted.
   *
   * The gate used to *be* this panel. Travel took the gate over, and the cooldown
   * countdowns are still the only place a player can read when a beast comes back — so the
   * board moved out to the road rather than being deleted.
   */
  readonly huntSignpost?: Vec2;
  readonly crates?: readonly { x: number; z: number; size?: number }[];
  /**
   * Everything else standing about, by kind.
   *
   * One list rather than a field per prop type. `crates`, `lamps` and `trees` above predate
   * this and are left alone — they are load-bearing in `world.ts`, in the collider set and in
   * four tests — but nothing new should join them at this level. A barrel is not a different
   * *kind of thing* from a hay bale in the way a lamp is; it is a different noun, and nouns
   * belong in a registry.
   */
  readonly dressing?: readonly DressingSpec[];
  readonly lamps?: readonly Vec2[];
  /**
   * Who lights them, by `NpcSpec.id`. Absent means nobody does.
   *
   * Absent in eighteen of the nineteen, and that is the honest state rather than a gap: nowhere
   * else in the world claims a person whose job this is. Where it is absent the lamps fade
   * together on the hour's curve, which is the right picture drawn by the wrong cause — and where
   * it is present, they come on one at a time behind somebody walking the row.
   */
  readonly lamplighter?: string;
  readonly trees?: readonly Vec2[];
  readonly graffiti?: readonly GraffitiSpec[];
  /** Rows 0..n-1 are open water along the north edge. Absent means no canal and no quay. */
  readonly waterRows?: number;
  /** The ring of far silhouettes on the horizon. */
  readonly horizon?: 'city' | 'treeline' | 'none';
}

export interface AreaDef {
  /** Matches `playerPos.mapId`. Changing it strands saves in this area. */
  readonly id: string;
  readonly name: string;
  readonly grid: readonly string[];
  readonly legend: Readonly<Record<string, TileDef>>;
  /** Derived by `defineArea`, never authored. */
  readonly cols: number;
  readonly rows: number;
  readonly halfX: number;
  readonly halfZ: number;
  /** Where a new Commander is put down, and the fallback for any restore that fails. */
  readonly spawn: Vec2;
  readonly exits: readonly ExitSpec[];
  /**
   * Whether Sidewalk Immunity is a rule here.
   *
   * `'none'` hides the zone chip and the danger vignette rather than pinning them to EXPOSED
   * forever. An area with no pavement is not an area where you are permanently in trouble; it
   * is an area where the rule does not apply, and the HUD should say the second thing.
   */
  readonly safety: 'sidewalk' | 'none';
  readonly props: AreaProps;
}

/** What an area is written as. The derived fields are filled in by `defineArea`. */
export type AreaSpec = Omit<AreaDef, 'cols' | 'rows' | 'halfX' | 'halfZ'>;

/**
 * The only way to make an area, because it is the only way the derived numbers get derived.
 *
 * The validation is new and it is free. A typo in the ASCII used to fall through `TILES` into
 * out-of-bounds, so a mistyped character became an invisible hole the player walked into — the
 * exact class of failure the one-grid rule exists to prevent, unreachable until now only
 * because there was a single hand-checked grid. Two areas is where that luck runs out.
 */
export function defineArea(spec: AreaSpec): AreaDef {
  const rows = spec.grid.length;
  const cols = spec.grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) throw new Error(`area ${spec.id}: empty grid`);

  for (let r = 0; r < rows; r++) {
    const line = spec.grid[r]!;
    if (line.length !== cols) {
      throw new Error(`area ${spec.id}: row ${r} is ${line.length} wide, expected ${cols}`);
    }
    for (const ch of line) {
      if (!spec.legend[ch]) throw new Error(`area ${spec.id}: no legend entry for '${ch}'`);
    }
  }

  return {
    ...spec,
    rows,
    cols,
    halfX: (cols * TILE) / 2,
    halfZ: (rows * TILE) / 2,
  };
}

/* ============================================================
   Lookups
   ============================================================ */

const OUT_OF_BOUNDS: TileDef = { tex: 'water', safe: false, walk: false };

export const colOf = (a: AreaDef, x: number): number => Math.floor((x + a.halfX) / TILE);
export const rowOf = (a: AreaDef, z: number): number => Math.floor((z + a.halfZ) / TILE);
export const xOfCol = (a: AreaDef, col: number): number => col * TILE - a.halfX + TILE / 2;
export const zOfRow = (a: AreaDef, row: number): number => row * TILE - a.halfZ + TILE / 2;

export function tileAt(a: AreaDef, x: number, z: number): TileDef {
  const col = colOf(a, x);
  const row = rowOf(a, z);
  if (row < 0 || row >= a.rows || col < 0 || col >= a.cols) return OUT_OF_BOUNDS;
  return a.legend[a.grid[row]![col]!] ?? OUT_OF_BOUNDS;
}

/** The Sidewalk Immunity test, asked every frame the player moves. */
export const isSafeAt = (a: AreaDef, x: number, z: number): boolean => tileAt(a, x, z).safe;
export const isWalkable = (a: AreaDef, x: number, z: number): boolean => tileAt(a, x, z).walk;

/* ============================================================
   Building extraction
   ============================================================ */

export interface Rect {
  col: number;
  row: number;
  w: number;
  d: number;
}

/**
 * The maximal rectangles of one character in the grid.
 *
 * Buildings are read out of the map rather than listed beside it, so a change to the ASCII
 * moves the geometry, the collision and the ground art together. Listing them twice is how
 * a wall ends up somewhere the paving says you can walk.
 *
 * Walks `rows × cols` rather than a square: it used to loop `GRID` in both dimensions, which
 * was correct only for as long as every area was square, and would have dropped or duplicated
 * buildings on the first oblong one without erroring.
 */
export function extractRects(a: AreaDef, char: string): Rect[] {
  const seen = Array.from({ length: a.rows }, () => new Array<boolean>(a.cols).fill(false));
  const rects: Rect[] = [];

  for (let row = 0; row < a.rows; row++) {
    for (let col = 0; col < a.cols; col++) {
      if (a.grid[row]![col] !== char || seen[row]![col]) continue;

      let w = 0;
      while (col + w < a.cols && a.grid[row]![col + w] === char && !seen[row]![col + w]) w++;

      let d = 1;
      outer: while (row + d < a.rows) {
        for (let i = 0; i < w; i++) {
          if (a.grid[row + d]![col + i] !== char || seen[row + d]![col + i]) break outer;
        }
        d++;
      }

      for (let r = row; r < row + d; r++) {
        for (let i = col; i < col + w; i++) seen[r]![i] = true;
      }
      rects.push({ col, row, w, d });
    }
  }
  return rects;
}

/**
 * Chunks a run of tiles into pieces of two or three.
 *
 * A terrace extracted whole is one flat slab the length of the block. Split, each piece
 * takes its own height and the skyline gets a silhouette.
 */
export function splitRun(len: number): [number, number][] {
  const parts: [number, number][] = [];
  let i = 0;
  while (i < len) {
    const left = len - i;
    const take = left === 4 ? 2 : Math.min(3, left);
    parts.push([i, take]);
    i += take;
  }
  return parts;
}

/** Rows of open water along the north edge, and the rows the ground plane covers. */
export const waterRowsOf = (a: AreaDef): number => a.props.waterRows ?? 0;
export const groundRowsOf = (a: AreaDef): number => a.rows - waterRowsOf(a);
