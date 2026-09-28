/**
 * The Rimefields — the west end of the Chalk Road, and what the road stops at.
 *
 * Old snow with the wind still working on it, swept down to bare ice in long bands where it
 * crosses open ground. The ice sheets and the pressure ridges run east to west, across the way
 * you are travelling, so the field is a sequence of things to get over rather than a space to
 * cross — the same argument the Tallow Levels makes with water, made with cold.
 *
 * It is the only place where the ground you would call the *background* is brighter than the
 * ground you would call the *feature*: the snow is pale and the ice sheets are dark, because ice
 * is transparent and what you see through it is not white.
 *
 * Sixty-four by forty-six now, grown from thirty-six by twenty-six, and the rock ring the old field
 * sat in is gone: the field runs out to a bigger one. North, **the escarpment**, its face coming
 * down to a different row in every column, the ice cave still cut into it, and **the frozen falls**
 * coming off it into a pool and a stream that froze where they lay. West, the road runs on past
 * where it used to stop, a hundred paces more under the snow, and ends at **the frozen caravan**:
 * two wagons slewed off it and the lead wagon broadside across it. South-west, **the tarn**, and
 * the huts dragged out onto it to fish through the ice. South, **the ridges** the Rime-Archers were
 * posted on a long winter ago. East, by the road in, **the mammoth**, where it lay down.
 *
 * The Hoarhound Pack keeps to the mammoth's hollow, and one of its stalkers prowls the whole
 * field. The Rime-Archers hold two of the ridges' ends, looking north over the snow.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The field's legend.
 *
 *   n  packed snow  — most of it
 *   i  glare ice    — swept bare, and darker than the snow around it
 *   #  frozen scrub — the only living thing
 *   ,  chalk road   — the road east, running out into the snow
 *   I  pressure ridge — impassable, low and broad
 *   R  rock         — impassable, the boundary
 *   d  drift       — where the wind put the snow down rather than scouring it
 *   W  a wagon       — impassable; the caravan, frozen where it stopped
 *   h  a fishing hut — timber on runners, a stovepipe through the roof
 *   o  a fishing hole — through the tarn's ice; open water, impassable
 *
 * `I` is the widest low solid in the game: almost no inset, so a ridge is a continuous barrier
 * you walk the end of rather than a row of blocks you walk between.
 */
const RIME_LEGEND: Record<string, TileDef> = {
  d: { tex: 'drift', safe: false, walk: true },
  n: { tex: 'snow', safe: false, walk: true },
  i: { tex: 'ice', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  I: {
    tex: 'ice',
    safe: false,
    walk: false,
    solid: { style: 'ice', minHeight: 1.8, maxHeight: 2.8, inset: 0.05, depthInset: 0.6, chimneyChance: 0, split: false },
  },
  R: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 7.0, maxHeight: 11.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  W: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 1.8, maxHeight: 2.2, inset: 0.4, depthInset: 0.7, chimneyChance: 0, split: false, wall: 'timber' },
  },
  h: {
    tex: 'ice',
    safe: false,
    walk: false,
    solid: { style: 'cottage', minHeight: 2.8, maxHeight: 3.0, inset: 0.6, depthInset: 0.6, chimneyChance: 1, split: false, wall: 'timber' },
  },
  o: { tex: 'water', safe: false, walk: false },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'snow',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 64 wide by 46 deep.
 *
 * The road comes in at the east edge on rows 22 and 23 and runs west to the lead wagon. In the old
 * field, columns 15 to 48, the ridges above and below it are offset from each other so that
 * leaving the road in either direction means going round something.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0  the rock
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  1
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  2  the north escarpment: THE FROZEN FALLS come off it here, cols 30-35
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRiiiiiiRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  3
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRiiiiiiRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  4
  'RRRRRRRRRRRRdddddddRRRRRRRRRRRiiiiiiRRRdddRRRdRdddRddddddddddddR', //  5
  'RRddRdRRRRRddddddddRRRRRRRRRRRddiidddddddddddddddddddddddddddddR', //  6
  'RdddddddRdddddnnnddRRRRRRRRRRRddiidddddddddddddddddddnnnddnnnddR', //  7
  'RddddddddddddnnnnddRRRRRRRRRRRddiindnnnnnnnnnnnnnnnnnnnnddnnnddR', //  8
  'RddnnndddddnnnnnnddRRRRRRRRRRRddiidnnnnnnnnnnnndnnnddnnddnnnnddR', //  9
  'RddnnndnnnnnnndddddRRRRRRRRRRRddiidnnnnnnnnnnnndnnnddnndnnnnnddR', // 10
  'RddnnndnnnnnnnnddddddddKKKddddddddddddddddddddddddnnnndddnnnnddR', // 11  the ice cave, in the escarpment face
  'RddnnnnnnnnnnnnddddddddKKKdddddddddddddddddddddddnnnnnnniiiiiidR', // 12
  'RddnnnnndddnnnnddddddddddddddddddddddddddddddddddnddddddiiiiiidR', // 13
  'RddiiiiiiiiinnnddddddIIIIddddddddddIIIIddddddddddndddddddddddddR', // 14
  'RddiiiiiiiiinnnddddddIIIIddnndddnddIIIIdddnnnddddnddIIIIIIIddddR', // 15
  'RddddddddnnnnnnddddddddddddnnnnnnddddddddnnnnddddndddddddddddddR', // 16
  'RddddddddnnnnnnddddiiiiiiddnnnnnnddddiiiiiinnddddddddddddddddddR', // 17
  'RdIIIIIddnndnnnddddiiiiiiddddddddnnddiiiiiiddddddddddddddnnnnddR', // 18
  'RdddddddddddnnnddddnnnnddddddddddnndddddddddddddddIIIIIddnnnnddR', // 19
  'RddddddddnnnnnnddddnnnnddIIIIIIddnnddIIIIIIddddddddddddddnnnnddR', // 20
  'RddnnnWWWndnnnnddddnnnnddddddddddnnddddddddddddddddddddddnnnnddR', // 21  THE FROZEN CARAVAN (west), where the road runs out
  'RddWn,,dd,,,,,,dd,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,dd,,,,,,,,,,,,,,,', // 22  the Chalk Road, from the east edge to the lead wagon
  'RddWn,,dd,,,,,,dd,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,dd,,,,,,,,,,,,,,,', // 23
  'RddnnnnndnWWWnnddddnnnnddddddddddnnddddddddddddddnnnnndnnnnnnddR', // 24
  'RddnnndddddddddddddnnnnddIIIIIIddnnddIIIIIIddddddnnnnnnnnnnnnddR', // 25
  'RddnnndddddddddddddnnnnddddddddddnnddddddddddddddnnnnnnnnnnnnddR', // 26
  'RddnnnddIIIIIIdddddiiiiiiddddddddnnddiiiiiidddddddnddddddddddddR', // 27  THE MAMMOTH's hollow (east)
  'RddnnndddddddddddddiiiiiinnnnnnnnnnnniiiiiinnddddndddddddddddddR', // 28
  'RdddnndddddddddddddddddddddnnnnnnddddddddnnnnddddnnddiiiiiiidddR', // 29
  'Rdiiiiiiiiinnnndddddd##ddddnnndnndddd##ddnnddddddnnddiiiiiiidddR', // 30
  'RdiiiiiiiiinnnnddddddIIIIddddddddddIIIIddddddddddndddiiiiiiidddR', // 31
  'RddnnnnnnndnnnnddddddddddddddddddddddddddddddddddndddddddddddddR', // 32
  'RddnnnnnnndnnnnddddddddddddddddddddddddddddddddddnnddddddddddddR', // 33
  'RddnnnnnnnnnnnnddddddddddddddddddddddddddddddddddnnnnnnnnnnnnddR', // 34
  'RdddndnniiiiiiiiiiinnnnnnnnnnnnnnnnnnnnnnddnnnnnnnnnnnnnnnnnnddR', // 35  THE TARN (south-west), its huts and holes; the ridges the archers were posted on
  'RdddiiiiiiiiiiiiiiiiiiinnnnnnnnnnnnndnnnnddnnndnnndddddddddddddR', // 36
  'RddiiiihioiiiiiiihiiiiiinndddddddddddddnnddnnnnnnndddddddddddddR', // 37
  'RdiiiiiiiiiiiiioiiiiiiiiindddddddddddddnnnnnnnnnnnddRRRRRRRRRddR', // 38
  'RdiiiiiiiiiiiiiiiiiiiiiiiiddRRRRRRRRRdddddddddddddddddRRRRRddddR', // 39
  'RdiiiiiiiiihioiiiiiiiiiiinddddRRRRRddddddddddddddddddddddddddddR', // 40
  'RddiiiiiiiiiiiiiiioihiiinnddddddddddddddRRRRRRRRRddndddddddddddR', // 41
  'RdddiiiiiiiiiiiiiiiiiiidddddddddddddddddddRRRRRddddddddddddddddR', // 42
  'RdddddddiiiiiiiiiiiddddddddddddddddddddddddddddddddddddddddddddR', // 43
  'RRRdRdRRRRdRddddRRRRdRdddRdRRddRdRdRRdRddRdRRdRdddRddRRRddRddRdR', // 44
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 45  the rock
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const RIMEFIELDS_ID = 'rimefields';

export const RIMEFIELDS: AreaDef = defineArea({
  id: RIMEFIELDS_ID,
  name: 'The Rimefields',
  grid: GRID,
  legend: RIME_LEGEND,
  /** On the road, in the middle of the field. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The ice cave, cut into the north face. The only shelter past the stones that say there is none.
      to: 'rimefields_ice_cave',
      x: xOfCol(24),
      z: zOfRow(12) + TILE / 2 + 1.4,
      label: 'Into the ice cave',
      door: { x: xOfCol(24), z: zOfRow(12) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'chalk_road',
      x: HALF_X - 2,
      z: -2,
      label: 'East, back down the Chalk Road',
      arrive: { x: -106, z: 2 },
    },
  ],
  props: {
    /** Hares that break at fifty yards, and wolves that do not break at all. */
    sky: 'snow',
    wildlife: [
      { kind: 'hare', x: -46, z: -38, roam: 10 },
      { kind: 'hare', x: -46, z: -18, roam: 10 },
      { kind: 'hare', x: -22, z: 2, roam: 10 },
      { kind: 'hare', x: -26, z: 22, roam: 10 },
      { kind: 'wolf', x: -38, z: -38, roam: 14, count: 2 },
      { kind: 'wolf', x: 22, z: -14, roam: 14, count: 2 },
      { kind: 'wolf', x: 38, z: 14, roam: 14, count: 2 },
      { kind: 'rook', x: -62, z: -42, roam: 26, count: 3 },
      // The new field: hares in the west, a fox picking at the caravan, rooks under the falls.
      { kind: 'hare', x: -100, z: -40, roam: 10 },
      { kind: 'hare', x: -112, z: 34, roam: 8 },
      { kind: 'fox', x: -96, z: 12, roam: 8 },
      { kind: 'rook', x: 6, z: -60, roam: 14, count: 3 },
    ],
    /** Two crates on a snowfield was the whole area. Cairns are what people leave on ice. */
    dressing: [
      { kind: 'cairn', x: -64, z: -44 },
      { kind: 'spoilheap', x: 64, z: -16 },
      { kind: 'cairn', x: -64, z: 8 },
      { kind: 'bramble', x: 64, z: 20 },
      { kind: 'spoilheap', x: -64, z: 32 },
      { kind: 'cairn', x: 64, z: -32 },
      { kind: 'cairn', x: 20, z: -44 },
      { kind: 'spoilheap', x: -20, z: 44 },
      { kind: 'cairn', x: 40, z: 44 },
      { kind: 'cairn', x: -58, z: -38 },
      { kind: 'cairn', x: 50, z: -38 },
      { kind: 'cairn', x: -50, z: -30 },
      { kind: 'cairn', x: -30, z: -26 },
      { kind: 'cairn', x: -42, z: -22 },
      { kind: 'cairn', x: -54, z: -18 },
      { kind: 'cairn', x: 54, z: -18 },
      { kind: 'cairn', x: 42, z: -14 },
      { kind: 'cairn', x: -42, z: -6 },
      { kind: 'cairn', x: -38, z: -2 },
      { kind: 'cairn', x: -34, z: 2 },
      { kind: 'cairn', x: -34, z: 6 },
      { kind: 'cairn', x: -46, z: 10 },
      { kind: 'cairn', x: -10, z: 14 },
      { kind: 'cairn', x: -22, z: 18 },
      { kind: 'cairn', x: -34, z: 22 },
      { kind: 'cairn', x: -46, z: 26 },
      { kind: 'cairn', x: -58, z: 30 },
      { kind: 'cairn', x: 50, z: 30 },
      { kind: 'cairn', x: -50, z: 38 },
      { kind: 'waystone', x: -54, z: -38, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -46, z: -30, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -38, z: -22, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: 58, z: -18, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -38, z: -6, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -30, z: 2, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: -42, z: 10, text: 'THE ROAD — EAST' },
      { kind: 'waystone', x: -18, z: 18, text: 'NO SHELTER PAST HERE' },
      { kind: 'waystone', x: -42, z: 26, text: 'COUNT YOUR PARTY' },
      { kind: 'waystone', x: 54, z: 30, text: 'THE ROAD — EAST' },
      { kind: 'spoilheap', x: -50, z: -38 },
      { kind: 'spoilheap', x: -26, z: -30 },
      { kind: 'spoilheap', x: -34, z: -22 },
      { kind: 'spoilheap', x: -58, z: -14 },
      { kind: 'spoilheap', x: -34, z: -6 },
      { kind: 'spoilheap', x: -26, z: 2 },
      { kind: 'spoilheap', x: -38, z: 10 },
      { kind: 'spoilheap', x: -14, z: 18 },
      { kind: 'spoilheap', x: -38, z: 26 },
      { kind: 'spoilheap', x: 58, z: 30 },
      { kind: 'bracken', x: -46, z: -38 },
      { kind: 'bracken', x: -46, z: -18 },
      { kind: 'bracken', x: -22, z: 2 },
      { kind: 'bracken', x: -26, z: 22 },
      { kind: 'bramble', x: -42, z: -38 },
      { kind: 'bramble', x: 54, z: 2 },

      // The frozen caravan: its oxen still in the traces, its load, the last waystone.
      { kind: 'bonepile', x: -100, z: -12 },
      { kind: 'bonepile', x: -104, z: -10 },
      { kind: 'barrel', x: -90, z: -8 },
      { kind: 'sacks', x: -88, z: 12 },
      { kind: 'cart', x: -110, z: 10 },
      { kind: 'waystone', x: -80, z: -8, text: 'THE ROAD ENDS' },
      // The tarn's shore.
      { kind: 'barrel', x: -84, z: 50 },
      { kind: 'sacks', x: -60, z: 50 },
      { kind: 'cairn', x: -110, z: 62 },
      // The falls: a cairn where the stream comes out onto the field.
      { kind: 'cairn', x: -6, z: -50 },
      // The archers' posts: a fire at each ridge's end, the only light out here.
      { kind: 'brazier', x: -22, z: 60 },
      { kind: 'brazier', x: 74, z: 56 },
      { kind: 'cairn', x: -2, z: 58 },
      { kind: 'spoilheap', x: 50, z: 66 },
      // The mammoth's hollow: what the hounds have had off it.
      { kind: 'bonepile', x: 104, z: 36 },
      { kind: 'bonepile', x: 82, z: 22 },
      // The ring, round the old field: cairns along the road, and out across the snow.
      { kind: 'cairn', x: 70, z: -10 },
      { kind: 'cairn', x: 116, z: -10 },
      { kind: 'spoilheap', x: 90, z: 8 },
      { kind: 'cairn', x: -100, z: -60 },
      { kind: 'cairn', x: 60, z: -60 },
      { kind: 'spoilheap', x: 90, z: -56 },
      { kind: 'bramble', x: -116, z: -24 },
      { kind: 'bramble', x: 112, z: -40 },
    ],
    // No lamps and no trees. There is nothing out here to hang one on or for one to be.
    crates: [
      { x: 46, z: -2 },
      { x: -50, z: -2 },
    ],
    /**
     * No horizon silhouette.
     *
     * The rock is eleven units tall and closes the view on its own, and the alternatives on
     * offer are a city skyline and a treeline — neither of which belongs at the top of a
     * snowfield. Better to draw nothing than to draw the wrong distance.
     */
    horizon: 'none',
    /**
     * The Hoarhound Pack keeps to the mammoth's hollow, south of the bones, and one of its
     * stalkers prowls the whole field -- nobody lives here to keep it from. The Rime-Archers hold
     * the ends of two of the south ridges, their fires lit, looking north over the snow.
     */
    packs: [
      { encounterId: 'pack_hoarhounds', id: 'hollow', x: 90, z: 44, roam: 8, band: 'hollow' },
      { encounterId: 'pack_hoarhounds', id: 'stalker', x: -60, z: -60, roam: 8, behaviour: 'prowl' },
      {
        encounterId: 'pack_rime_archers',
        id: 'west_ridge',
        x: -18,
        z: 62,
        roam: 4,
        band: 'west_ridge',
        behaviour: 'sentry',
        // North, over the field.
        sweep: [2.5, 3.8],
      },
      {
        encounterId: 'pack_rime_archers',
        id: 'east_ridge',
        x: 78,
        z: 58,
        roam: 4,
        band: 'east_ridge',
        behaviour: 'sentry',
        sweep: [2.5, 3.8],
      },
    ],
    /** The frozen falls off the escarpment, and the mammoth by the road in. */
    landmarks: [
      { kind: 'frozen_falls', x: 6, z: -78 },
      { kind: 'mammoth', x: 96, z: 30 },
    ],
    vignettes: [
      { id: 'broken_cart', x: -84, z: -14 },
      { id: 'fish_racks', x: -74, z: 50 },
    ],
  },
});
