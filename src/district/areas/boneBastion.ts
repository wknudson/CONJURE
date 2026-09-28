/**
 * The Bone Bastion — barrow country, and the wall somebody built through the middle of it.
 *
 * The mounds came first and there are a great many of them, set in pairs across the whole map.
 * The bastion wall is the boundary, and it is the tallest unbroken thing in the world after the
 * Spire — which is the joke of the place: an enormous fortification around ground whose only
 * occupants have been dead for a very long time.
 *
 * Walking it is a matter of threading between mounds, and the mounds are laid out in ranks that
 * do not quite align, so the route through is never the same twice and never quite straight. The
 * one made thing is the causeway east, which runs dead level across the middle because whoever
 * cut it was not going to walk round them.
 *
 * Forty-six by fifty now, grown from twenty-eight by thirty, and the wall is no longer the edge:
 * the bastion stands whole in the middle of the field it was built on, and the field is **the old
 * battlefield**. West, the besiegers' bank still runs the length of it, slumped in places, and
 * the wall facing it is down in **the breach**, its stones where they fell; the causeway runs on
 * out through the breach to what is left of **the siege camp**. East, the causeway leaves by the
 * one gate the wall was built with, between the two towers of **the ossuary gatehouse**, where the
 * field's bones were stacked when the field was cleared. North and south, **more paired barrows**,
 * outside the wall this time, and one of them dug open. South, the second siege line, facing the
 * two posterns.
 *
 * The Barrow Watch walks the causeway out on the battlefield by night, and by day keeps to the
 * opened barrow, to the barrows by the south-east postern, and to the breach.
 */

import { TILE, defineArea, type AreaDef, type TileDef } from '../map.js';

/**
 * The Bastion's legend.
 *
 *   o  bone dust    — the ground, and what it is made of
 *   #  scrub        — the little that grows
 *   ,  causeway     — chalk, and the only cut ground here
 *   M  barrow mound — impassable, low and wide
 *   X  bastion wall — impassable, and enormous
 *   t  turf        — grass over a mound, going grey where the barrow surfaces
 *   r  rubble       — the breach: the wall's own stones, where they fell
 *   E  earthwork    — impassable, low; the besiegers' banks
 *   R  rock         — impassable, the edge of the field
 *
 * `M` is unsplit and barely inset: a mound is one heaped mass, and chunking it would turn a
 * barrow into a terrace of huts.
 */
const BASTION_LEGEND: Record<string, TileDef> = {
  t: { tex: 'barrow', safe: false, walk: true },
  o: { tex: 'bone', safe: false, walk: true },
  '#': { tex: 'grass', safe: false, walk: true },
  ',': { tex: 'chalk', safe: false, walk: true },
  M: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'mound', minHeight: 2.6, maxHeight: 4.0, inset: 0.1, depthInset: 0.1, chimneyChance: 0, split: false },
  },
  X: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'wall', minHeight: 12.0, maxHeight: 14.0, inset: 0.05, depthInset: 0.05, chimneyChance: 0, split: false },
  },
  r: { tex: 'cobble', safe: false, walk: true },
  E: {
    tex: 'weeds',
    safe: false,
    walk: false,
    solid: { style: 'mound', minHeight: 1.2, maxHeight: 1.6, inset: 0.15, depthInset: 0.5, chimneyChance: 0, split: true },
  },
  R: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.0, maxHeight: 7.5, inset: 0.15, depthInset: 0.15, chimneyChance: 0, split: false },
  },
  /** The cave mouth: rock, taken whole, with a door in the south face of it. */
  K: {
    tex: 'bone',
    safe: false,
    walk: false,
    solid: { style: 'rock', minHeight: 5.5, maxHeight: 5.5, inset: 0.3, depthInset: 0.3, chimneyChance: 0, split: false, wall: 'rock', bare: true },
  },
};

/**
 * 46 wide by 50 deep; the bastion wall is columns 9 and 36, rows 10 and 39.
 *
 * The causeway runs the width of the map on rows 24 and 25: in through the breach at column 9,
 * out through the gate at column 36, and on to the east edge and the Tallow Levels. Inside the
 * wall, the mound ranks above and below it are offset by two columns from each other so that no
 * straight line north to south exists.
 */
const GRID: readonly string[] = [
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', //  0  the edge
  'Ro#ttot#ttotootootooootototttttototttt#ttoo#tR', //  1
  'Rot##ttottoootttottottttoottototttttttto#otttR', //  2
  'Ro#oEotoMMMMttt#ttoMMottoootMMMMtooo#tMMMMtttR', //  3  paired barrows outside the wall, two ranks; THE OPEN BARROW at cols 18-21
  'RtooEtttMMMMottot#oMMooo##ooMMMMott##tMMMM#ttR', //  4
  'RtotE#t#ootttttototttotoo#ttoooot###ototo##toR', //  5
  'RtttE#too#ooootttototott#ttt#tttttttottto##ooR', //  6
  'R#otEttotooooMMMMtt#tttMMMMttttttMMMMttt#ot#oR', //  7
  'Rtt#o#oooooooMMMMtttottMMMMtotootMMMMtoo#ttooR', //  8
  'Rot#Etototooottott#ott#ttooottttot##oot#t#ottR', //  9
  'RtttEoot#XXXXXXXXXXXXXXXXXXXXXXXXXXXX#otott##R', // 10  the bastion wall
  'RtotEtttoXtttttttttttttttKKKKtttttttXttttto#tR', // 11  the great barrow, in the north wall
  'RttoE#ottXtttttttttttttttKKKKtttttttX#tttttotR', // 12
  'RtttEtottXttttttttttooottttttttooottXot#tttttR', // 13
  'RtttottooXttttttttttooottttttttooottXtoottotoR', // 14
  'RtttEttt#XttttMMMMttooottMMMMttooottXo#ttttotR', // 15
  'R#otEttotXttttMMMMtttttttMMMMttooottX#ottt#ttR', // 16
  'R#otEottoXtttttttttttttttttttttooottXootott##R', // 17
  'RtttEttttXttttttttMMMMMMtttttttooottXttttttttR', // 18
  'RoooEttttXttttttttMMMMMMtttttooooottXtttttootR', // 19
  'RoooEo#ooXtttttttttttttttttttooooottXotototttR', // 20
  'Roootttt#XttttMMMMtttttMMMMttoooo#ttXtttoototR', // 21
  'Rooo#ttttrttttMMMMttottMMMMttoooo#ttXoottott#R', // 22  THE BREACH (west, col 9); the ossuary GATEHOUSE (east, col 37)
  'RoootttorrrtttttttttottttttttooooottXooot#o##R', // 23
  'Rooo,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,,,,,,,,,,', // 24  the causeway, west through the breach and east through the gate
  'Rooo,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,tt,,,,,,,,,,', // 25
  'RooooooorrrtttttttttottttttttooooottXoooo#ottR', // 26
  'Rooot#ot#rttttMMMMttottMMMMttoooo#ttXo###tttoR', // 27
  'Rooottt#oXttttMMMMtttttMMMMttoooo#ttXtt##tot#R', // 28
  'RoooE#t##XtttttttttttttttttttooooottXttttttotR', // 29
  'RoooEttotXttttttttMMMMMMtttttooooottXt#ttttooR', // 30
  'RttoEtottXttttttttMMMMMMtttttttooottXtooo#ottR', // 31
  'RttoE#tttXtttttttttttttttttttttooottXttt##ttoR', // 32
  'RtttEt#ttXttttMMMMtttttttMMMMttooottXtottotttR', // 33
  'Rto#EttotXttttMMMMttooottMMMMttooottXttttotttR', // 34
  'Rt#oo##toXttttttttttooottttttttooottXo###otttR', // 35
  'RotoEooooXttttttttttooottttttttooottXo#oo#tttR', // 36
  'Rt##EtttoXttttttttttttttttttttttttttXtoottottR', // 37
  'R#ttEtotoXttttttttttttttttttttttttttXot#otoo#R', // 38
  'RtooE##t#XttXXXXXXXXXXXXXXXXXXXXXXttXttttttt#R', // 39  the bastion wall, its two posterns
  'RottEttttttttt#t#oottttttottttoooott#otoo#tt#R', // 40
  'Rottotooo#tt#otttootooto#ttotoottttt#oMMMM#ttR', // 41
  'Rto#E#tototttt##ttotttttt#tottotttttooMMMMottR', // 42
  'R#ttEtttt#ttttoooottttt##tttootto#ttttottttttR', // 43
  'RtttEttoEEttEEEEEEEooEEEEEoEEEEoo#tto#ootoootR', // 44  the south siege line
  'RtotEoottttttttttoot##ttttottotttttttoMMMM#toR', // 45
  'RottEototttt#tMMMMto#oMMMMtttttt##ttttMMMMtooR', // 46
  'Rt#otttttttt#oMMMMoo#tMMMMot#ottttttott#t#ottR', // 47
  'Rt#ttto#totttoto#o#t#totttot#tttotttoo#o#toooR', // 48
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', // 49  the edge
];

const HALF_X = (GRID[0]!.length * TILE) / 2;
const HALF_Z = (GRID.length * TILE) / 2;
const xOfCol = (col: number): number => col * TILE - HALF_X + TILE / 2;
const zOfRow = (row: number): number => row * TILE - HALF_Z + TILE / 2;

export const BONE_BASTION_ID = 'bone_bastion';

export const BONE_BASTION: AreaDef = defineArea({
  id: BONE_BASTION_ID,
  name: 'The Bone Bastion',
  grid: GRID,
  legend: BASTION_LEGEND,
  /** On the causeway, with barrows on both sides. */
  spawn: { x: 0, z: -2 },
  safety: 'none',
  exits: [
    {
      // The great barrow, in the north wall. The one mound the rows were laid out from.
      to: 'bone_bastion_barrow',
      x: xOfCol(26.5),
      z: zOfRow(12) + TILE / 2 + 1.4,
      label: 'Into the great barrow',
      door: { x: xOfCol(26.5), z: zOfRow(12) + TILE / 2 + 0.05, facesSouth: true, style: 'cave' },
      arrive: { x: 0, z: 16 },
    },
    {
      to: 'tallow_levels',
      x: HALF_X - 2,
      z: -2,
      label: 'East, along the causeway to the Tallow Levels',
      arrive: { x: -86, z: -6 },
    },
  ],
  props: {
    /** Still air, deliberately. Rooks over the mounds and nothing on the ground under them. */
    sky: 'none',
    wildlife: [
      { kind: 'rook', x: -46, z: -50, roam: 26, count: 4 },
      { kind: 'rook', x: -2, z: -18, roam: 26, count: 4 },
      { kind: 'rook', x: 18, z: 18, roam: 26, count: 4 },
      // And over the battlefield, where there was always going to be something for them.
      { kind: 'rook', x: -70, z: 40, roam: 20, count: 4 },
      { kind: 'rook', x: 70, z: 40, roam: 20, count: 3 },
    ],
    /**
     * On the bastion wall, which is the one thing here anybody built.
     *
     * The atlas calls it "an enormous fortification around ground whose only occupants have
     * been dead a very long time". These two lines are somebody having noticed which way it
     * faces.
     */
    graffiti: [
      { text: 'THE WALL FACES IN', wallX: -34, wallZ: 15.95, dx: 3.0, facesSouth: true, tint: '#a46a4a' },
      { text: 'COUNT THEM AGAIN', wallX: 22, wallZ: 39.95, dx: -3.2, facesSouth: true, tint: '#b7ae9d' },
    ],
    /** Barrow country behind an enormous wall. Standing stones, and cairns on the mounds. */
    dressing: [
      { kind: 'cairn', x: 48, z: -52 },
      { kind: 'spoilheap', x: -48, z: -20 },
      { kind: 'cairn', x: 48, z: -8 },
      { kind: 'logpile', x: -48, z: 16 },
      { kind: 'bracken', x: 48, z: 28 },
      { kind: 'cairn', x: -48, z: 40 },
      { kind: 'cairn', x: -20, z: -52 },
      { kind: 'spoilheap', x: 24, z: 52 },
      { kind: 'cairn', x: -28, z: 52 },
      { kind: 'cairn', x: -42, z: -46 },
      { kind: 'cairn', x: -18, z: -42 },
      { kind: 'cairn', x: 38, z: -38 },
      { kind: 'cairn', x: 10, z: -30 },
      { kind: 'cairn', x: -30, z: -22 },
      { kind: 'cairn', x: 22, z: -18 },
      { kind: 'cairn', x: 26, z: -10 },
      { kind: 'cairn', x: -22, z: -2 },
      { kind: 'cairn', x: 30, z: 2 },
      { kind: 'cairn', x: -14, z: 10 },
      { kind: 'cairn', x: -18, z: 18 },
      { kind: 'cairn', x: 30, z: 22 },
      { kind: 'cairn', x: -10, z: 30 },
      { kind: 'cairn', x: -38, z: 38 },
      { kind: 'cairn', x: 18, z: 42 },
      { kind: 'waystone', x: -38, z: -46, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: 26, z: -38, text: 'COUNT THE MOUNDS' },
      { kind: 'waystone', x: 30, z: -26, text: 'NOTHING IS BURIED SHALLOW' },
      { kind: 'waystone', x: 38, z: -14, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: -34, z: 2, text: 'COUNT THE MOUNDS' },
      { kind: 'waystone', x: -38, z: 14, text: 'NOTHING IS BURIED SHALLOW' },
      { kind: 'waystone', x: -26, z: 26, text: 'THE BASTION HOLDS' },
      { kind: 'waystone', x: -6, z: 38, text: 'COUNT THE MOUNDS' },
      { kind: 'spoilheap', x: -34, z: -46 },
      { kind: 'spoilheap', x: 30, z: -38 },
      { kind: 'spoilheap', x: 34, z: -26 },
      { kind: 'spoilheap', x: -42, z: -10 },
      { kind: 'spoilheap', x: -30, z: 2 },
      { kind: 'spoilheap', x: -18, z: 14 },
      { kind: 'spoilheap', x: -22, z: 26 },
      { kind: 'spoilheap', x: -2, z: 38 },
      { kind: 'logpile', x: -30, z: -46 },
      { kind: 'logpile', x: 18, z: -30 },
      { kind: 'logpile', x: 38, z: -10 },
      { kind: 'logpile', x: -6, z: 10 },
      { kind: 'logpile', x: 2, z: 30 },
      { kind: 'bracken', x: -26, z: -46 },
      { kind: 'bracken', x: 42, z: -26 },
      { kind: 'bracken', x: -22, z: 2 },
      { kind: 'bracken', x: 6, z: 26 },

      // The battlefield: the bank's stakes, and what nobody came back for.
      { kind: 'fence', x: -80, z: -50, yaw: Math.PI / 2 },
      { kind: 'fence', x: -84, z: 40, yaw: Math.PI / 2 },
      { kind: 'bonepile', x: -60, z: -60 },
      { kind: 'bonepile', x: -30, z: 82 },
      { kind: 'cairn', x: 20, z: 84 },
      { kind: 'gravestone', x: -64, z: 56 },
      // The siege camp: its cart, its sacks, its dead fire.
      { kind: 'cart', x: -82, z: 14 },
      { kind: 'sacks', x: -86, z: -22 },
      // The opened barrow: the spoil, the shoring, what came out.
      { kind: 'spoilheap', x: -22, z: -78 },
      { kind: 'spoilheap', x: -2, z: -78 },
      { kind: 'logpile', x: -8, z: -90 },
      // The gatehouse: the field's leavings at its foot, and a stone saying what the wall says.
      { kind: 'bonepile', x: 62, z: -14 },
      { kind: 'waystone', x: 66, z: 6, text: 'THE BASTION HOLDS' },
      // Outside the wall, north and east.
      { kind: 'cairn', x: 80, z: -60 },
      { kind: 'cairn', x: 36, z: -90 },
      { kind: 'bracken', x: 70, z: 40 },
    ],
    crates: [
      { x: 38, z: -2 },
      { x: -86, z: 22 },
    ],
    /** In the scrub along the east wall, which is the only ground here anything grows on. */
    trees: [
      { x: 42, z: -12 },
      { x: 42, z: 12 },
    ],
    horizon: 'none',
    /**
     * The Barrow Watch. By night it walks the causeway out on the battlefield, from the breach to
     * the siege camp and back; by day it keeps to the barrow somebody opened, to the pair by the
     * south-east postern, and to the breach itself, facing out the way the besiegers came.
     */
    packs: [
      {
        encounterId: 'pack_barrow_watch',
        id: 'causeway',
        x: -62,
        z: 0,
        roam: 5,
        hours: 'night',
        band: 'causeway',
        behaviour: 'beat',
        route: [
          { x: -62, z: 0 },
          { x: -84, z: 0 },
        ],
      },
      { encounterId: 'pack_barrow_watch', id: 'opened', x: -12, z: -72, roam: 7, hours: 'day', band: 'opened' },
      { encounterId: 'pack_barrow_watch', id: 'postern', x: 62, z: 76, roam: 6, hours: 'day', band: 'postern' },
      {
        encounterId: 'pack_barrow_watch',
        id: 'breach',
        x: -46,
        z: 10,
        roam: 4,
        hours: 'day',
        band: 'breach',
        behaviour: 'sentry',
        // West, out through the breach.
        sweep: [-2.2, -0.9],
      },
    ],
    /** The ossuary gatehouse: a tower either side of the one gate the wall was built with. */
    landmarks: [
      { kind: 'ossuary', x: 58, z: -8 },
      { kind: 'ossuary', x: 58, z: 8 },
    ],
    vignettes: [
      { id: 'battlefield', x: -66, z: -40 },
      { id: 'battlefield', x: -20, z: 64 },
      { id: 'battlefield', x: 30, z: 64 },
      { id: 'ruined_camp', x: -82, z: -14 },
    ],
  },
});
