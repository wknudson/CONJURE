/**
 * Ashfall Ward, as one grid of characters.
 *
 * This is the single source of truth for four separate things: what the ground is painted
 * with, where the Sidewalk Immunity rule holds, what the player can walk through, and
 * where the buildings stand. They were four answers once and they disagreed — a street
 * that looked paved but read as cobbles underfoot is a rule the player cannot learn. One
 * grid means the paving can never lie about where the rules change.
 *
 * Nothing here imports three.js or touches the DOM: it is geometry and lookup, so it can
 * be unit-tested without a canvas.
 */

/** World units per tile. The whole ward is 20 tiles square. */
export const TILE = 4;
export const GRID = 20;
export const HALF = (GRID * TILE) / 2;

/**
 * The ward.
 *
 *   S  sanctioned walkway  — SAFE, no Warden may see you here
 *   c  cobbles             — danger
 *   .  broken cobbles      — danger, weeds through the joints
 *   #  scrub verge         — danger
 *   W  canal               — impassable
 *   B  building footprint  — impassable, tall
 *   V  yard wall           — impassable, low
 *
 * The four trades sit on the cross-street (rows 12–13), two facing north and two facing
 * south, so a new Commander can walk the entire guided lap without once stepping off the
 * pavement. Leaving it is a choice they make, which is the only way the rule teaches.
 */
export const MAP: readonly string[] = [
  'WWWWWWWWWWWWWWWWWWWW', //  0  the canal
  'WWWWWWWWWWWWWWWWWWWW', //  1
  '##cccccccccccccccc##', //  2  quay
  '##cccc......cccccc##', //  3  the sealed yard
  '##cccccccccccccccc##', //  4
  '##VVVVVVVVVVVVVVVV##', //  5  yard wall — the Magistracy's seal, permanently shut
  '#cccccccccSSccccccc#', //  6
  '#ccBBBBBBcSScBBBBBB#', //  7
  '#cc......cSSc......#', //  8  west: warehouse yard (the Warden)   east: back alley
  '#cc......cSSc......#', //  9
  '#cc......cSSc......#', // 10
  '#ccBBBBBBcSScBBBBBB#', // 11  ARTIFICER (west)          FIELD JOURNAL (east)
  '#SSSSSSSSSSSSSSSSSS#', // 12  the cross-street
  '#SSSSSSSSSSSSSSSSSS#', // 13
  '#ccBBBBBBcSScBBBBBB#', // 14  APOTHECARY (west)         VIVARIUM (east)
  '#ccBBBBBBcSScBBBBBB#', // 15
  '#ccccccccSSSScccccc#', // 16
  '##cccccSSSSSSSScccc#', // 17  the plaza
  '###ccccSSSSSSSScc###', // 18
  '####################', // 19
];

export interface TileDef {
  readonly tex: 'sidewalk' | 'cobble' | 'weeds' | 'grass' | 'water';
  readonly safe: boolean;
  readonly walk: boolean;
}

export const TILES: Record<string, TileDef> = {
  S: { tex: 'sidewalk', safe: true, walk: true },
  c: { tex: 'cobble', safe: false, walk: true },
  '.': { tex: 'weeds', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  W: { tex: 'water', safe: false, walk: false },
  B: { tex: 'cobble', safe: false, walk: false },
  V: { tex: 'cobble', safe: false, walk: false },
};

/** Off the edge of the ward. Impassable, so the grid bounds itself. */
const OUT_OF_BOUNDS: TileDef = { tex: 'water', safe: false, walk: false };

export const colOf = (x: number): number => Math.floor((x + HALF) / TILE);
export const rowOf = (z: number): number => Math.floor((z + HALF) / TILE);
export const xOfCol = (col: number): number => col * TILE - HALF + TILE / 2;
export const zOfRow = (row: number): number => row * TILE - HALF + TILE / 2;

export function tileAt(x: number, z: number): TileDef {
  const col = colOf(x);
  const row = rowOf(z);
  if (row < 0 || row >= GRID || col < 0 || col >= GRID) return OUT_OF_BOUNDS;
  return TILES[MAP[row]![col]!] ?? OUT_OF_BOUNDS;
}

/** The Sidewalk Immunity test, asked every frame the player moves. */
export const isSafeAt = (x: number, z: number): boolean => tileAt(x, z).safe;
export const isWalkable = (x: number, z: number): boolean => tileAt(x, z).walk;

/* ============================================================
   Points of interest
   ============================================================ */

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

const WEST_X = xOfCol(5); // -18, the middle of both west blocks
const EAST_X = xOfCol(15); // 22, the middle of both east blocks

/**
 * North-side doors sit at the south face of the row-11 buildings (z = 8); south-side doors
 * at the north face of the row-14 buildings (z = 16). The player stands a stride into the
 * street from each.
 */
export const DOORS: readonly DoorSpec[] = [
  { key: 'artificer', name: 'The Ironworks Artificer', x: WEST_X, z: 9.4, signX: WEST_X, signZ: 8.05, returnZ: 10.8 },
  { key: 'journal', name: 'The Field Journal', x: EAST_X, z: 9.4, signX: EAST_X, signZ: 8.05, returnZ: 10.8 },
  { key: 'apothecary', name: 'The Apothecary', x: WEST_X, z: 14.6, signX: WEST_X, signZ: 15.95, returnZ: 13.2 },
  { key: 'vivarium', name: 'The Vivarium', x: EAST_X, z: 14.6, signX: EAST_X, signZ: 15.95, returnZ: 13.2 },
];

/** Where a new Commander is put down: the plaza, in sight of the Dispatcher. */
export const SPAWN = { x: 4, z: 30 } as const;

/** The Dispatcher, close enough to the spawn to be the obvious first thing. */
export const VEX_POS = { x: -2, z: 27 } as const;

/** The bounty board, on the plaza between the spawn and the cross-street. */
export const BOARD_POS = { x: 12, z: 29 } as const;

/** The sealed gate in the yard wall — dressing, and a hook for later content. */
export const GATE_POS = { x: 4, z: zOfRow(5) } as const;

/** The Warden's beat, clockwise around the open warehouse yard. */
export const WARDEN_WAYPOINTS: readonly { x: number; z: number }[] = [
  { x: -24, z: -6 },
  { x: -8, z: -6 },
  { x: -8, z: 2 },
  { x: -24, z: 2 },
];

/** Crates and clutter, kept clear of the Warden's patrol rectangle so it never snags. */
export const CRATES: readonly { x: number; z: number; size?: number }[] = [
  { x: 19.5, z: -6.5 },
  { x: 25, z: 1.5 },
  { x: -6, z: -2 },
  { x: -26, z: -2 },
];

/** Gas lamps, all on walkway tiles — the light *is* the safe zone, so it has to line up. */
export const LAMPS: readonly { x: number; z: number }[] = [
  { x: 0.7, z: -13 },
  { x: 7.3, z: -13 },
  { x: 0.7, z: -1 },
  { x: 7.3, z: -1 },
  { x: -16, z: 12.7 },
  { x: 16, z: 12.7 },
  { x: -4, z: 12.7 },
  { x: 28, z: 12.7 },
  { x: -8, z: 30 },
  { x: 16, z: 30 },
];

/** Darkened trees along the canal bank. */
export const TREES: readonly { x: number; z: number }[] = [
  { x: -30, z: -26 },
  { x: -24, z: -30 },
  { x: 26, z: -28 },
  { x: 32, z: -24 },
  { x: -34, z: -20 },
  { x: 34, z: -20 },
];

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
 */
export function extractRects(char: string): Rect[] {
  const seen = Array.from({ length: GRID }, () => new Array<boolean>(GRID).fill(false));
  const rects: Rect[] = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (MAP[row]![col] !== char || seen[row]![col]) continue;

      let w = 0;
      while (col + w < GRID && MAP[row]![col + w] === char && !seen[row]![col + w]) w++;

      let d = 1;
      outer: while (row + d < GRID) {
        for (let i = 0; i < w; i++) {
          if (MAP[row + d]![col + i] !== char || seen[row + d]![col + i]) break outer;
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
