/**
 * Things you can read: posted bills, plaques, ledgers, the writing on a grave.
 *
 * The world had two ways to say something in text -- graffiti on a wall and a line cut into a
 * waystone -- and both are one sentence seen from across a street. A notice is the third: a
 * thing you walk up to and open, a title and a few lines, in the same overlay the Bounty Board
 * and the stalls use. It is the cheapest content in the game per word, which is why it exists:
 * a room with nothing to read in it is a room you cross once.
 *
 * Addressed into areas from outside by area id -- the pattern `sites.ts`, `errands.ts` and
 * `benches.ts` keep -- and gated by the Chronicle like an aside, so a ledger can say one thing
 * before a contract and another after. Two notices may share an `at`; the first whose gate is
 * open is the one that stands there, which is the `ASIDES` idiom and reads the same way.
 *
 * Pure: no three.js, no DOM.
 */

import type { DressingId } from './dressing.js';
import { gateOpen, type Chronicle, type Gate } from './chronicle.js';

/** What kind of thing it is, which decides how the panel sets it. */
export type NoticeForm = 'notice' | 'plaque' | 'gravestone' | 'ledger' | 'book';

export interface NoticeDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to read it. Walkable, clear of the furniture. */
  readonly at: { readonly x: number; readonly z: number };
  readonly form: NoticeForm;
  /** The interact prompt: "Read the notice". */
  readonly label: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** When it is up. Absent means always. */
  readonly gate?: Gate;
  /** The thing it is written on, if a piece of furniture stands for it. Placed by `world.ts`. */
  readonly prop?: {
    readonly kind: DressingId;
    readonly x: number;
    readonly z: number;
    readonly yaw?: number;
  };
  /** Raised into the world's flags the first time it is read, so the Chronicle can know. */
  readonly flag?: string;
}

export const NOTICES: readonly NoticeDef[] = [
  /* --- Ashfall Ward ------------------------------------------------------------------ */
  {
    id: 'ashfall_ward:magistracy_bill',
    areaId: 'ashfall_ward',
    at: { x: 16, z: 23 },
    form: 'notice',
    label: 'Read the posted bill',
    title: 'BY ORDER OF THE MAGISTRACY OF ASHFALL WARD',
    lines: [
      'The sanctioned walkway is sanctuary. No officer of the ward may lay hands on a citizen standing upon it.',
      'Ground beyond the kerb is not sanctuary. Citizens found upon it after the curfew bell will be escorted to the nearest flagstone and assessed.',
      'Assessment is payable in Ducats. Assessment is not a fine. The Magistracy does not levy fines.',
      'Posted by the Ward Clerk. Defacement of this bill is assessable.',
    ],
    prop: { kind: 'noticepost', x: 16, z: 20.4 },
  },
  {
    id: 'ashfall_ward:harbour_writ',
    areaId: 'ashfall_ward',
    at: { x: -20, z: -38.6 },
    form: 'notice',
    label: 'Read the harbour writ',
    title: 'WRIT OF CLOSURE — ASHFALL WHARF',
    lines: [
      'The wharf is closed to unlicensed freight by order of the Magistracy. Licences are issued at the Toll House and are not issued.',
      'Vessels tied up without a licence are impounded. Impounded vessels are auctioned. Auctions are held at the Counting House and are not announced.',
      'The canal remains open. The canal has never been the problem.',
    ],
    prop: { kind: 'noticepost', x: -20, z: -41.6 },
  },
  {
    id: 'ashfall_ward:grave_hollis',
    areaId: 'ashfall_ward',
    at: { x: -46, z: 47.6 },
    form: 'gravestone',
    label: 'Read the stone',
    title: 'MARGARET HOLLIS',
    lines: ['Of the granary.', 'She kept the count honest and the Magistracy kept the count.', 'Assessed in full.'],
    prop: { kind: 'gravestone', x: -46, z: 50 },
  },
  {
    id: 'ashfall_ward:grave_unnamed',
    areaId: 'ashfall_ward',
    at: { x: -30, z: 47.6 },
    form: 'gravestone',
    label: 'Read the stone',
    title: '— — —',
    lines: ['The name has been chiselled off.', 'Under it, in a different hand and a different tool:', 'RELOCATED.'],
    prop: { kind: 'gravestone', x: -30, z: 50 },
  },

  /* --- the Toll House ---------------------------------------------------------------- */
  {
    id: 'ashfall_toll_house:tariff',
    areaId: 'ashfall_toll_house',
    at: { x: 2, z: -15.6 },
    form: 'plaque',
    label: 'Read the tariff',
    title: 'TARIFF OF THE ASHFALL WHARF',
    lines: [
      'Coal, per barge: four Ducats. Grain, per barge: six. Marrow, per barge: assessed on inspection.',
      'Passengers: one Ducat a head, two if they are carrying anything, three if they will not say what.',
      'The strongbox behind the desk holds the day’s takings until the Counting House sends for them. The Counting House has not sent for them in some time.',
    ],
    prop: { kind: 'plaque', x: 2, z: -17.85 },
    flag: 'read_toll_tariff',
  },

  /* --- the Counting House ------------------------------------------------------------ */
  {
    id: 'ashfall_counting_house:arrears_ledger',
    areaId: 'ashfall_counting_house',
    at: { x: 0, z: -10.8 },
    form: 'ledger',
    label: 'Read the arrears',
    title: 'THE ARREARS — ASHFALL WARD — THIS QUARTER',
    lines: [
      'Hearths in arrears: 388. Hearths assessed: 388. Hearths collected: 388.',
      'Sum collected: 6,208 Ducats. Sum remitted to the Spire: 6,208 Ducats. Sum remaining in the ward: nil.',
      'Note, in the margin: "Nil is the figure the Spire asked for. The box says otherwise. Do not correct the box."',
    ],
    prop: { kind: 'lectern', x: 0, z: -14 },
    flag: 'read_the_arrears',
  },

  /* --- the chapel -------------------------------------------------------------------- */
  {
    id: 'ashfall_chapel:the_flame',
    areaId: 'ashfall_chapel',
    at: { x: 0, z: 13 },
    form: 'plaque',
    label: 'Light a candle at the Quiet Flame',
    title: 'THE QUIET FLAME',
    lines: [
      'You take a taper from the box and light it from the Flame, and set it in the sand with the others.',
      'The words are cut into the hearthstone, worn shallow: WHAT IS BOUND IS NOT OWNED. WHAT IS KEPT IS NOT KEPT FOR EVER.',
      'The keeper does not look up. He has seen people light candles before.',
    ],
    flag: 'lit_a_candle',
  },
  {
    id: 'ashfall_chapel:plaque_of_names',
    areaId: 'ashfall_chapel',
    at: { x: -16, z: -2 },
    form: 'plaque',
    label: 'Read the plaque',
    title: 'REMEMBERED HERE',
    lines: [
      'Those of the ward who bound and were unbound: forty-one names, and room left for more.',
      'The last three are cut fresher than the rest. The last one is cut in the same hand as the harbour writ.',
    ],
    prop: { kind: 'plaque', x: -19.85, z: -2, yaw: Math.PI / 2 },
  },

  /* --- the Cinder Cup ---------------------------------------------------------------- */
  {
    // What the board says once the Lamprow tithe has been collected. Above the ordinary board
    // so it wins the same wall -- the `ASIDES` rule.
    id: 'ashfall_cinder_cup:rumour_board_late',
    areaId: 'ashfall_cinder_cup',
    at: { x: -8, z: -19.4 },
    form: 'notice',
    label: 'Read the board',
    title: 'THE CINDER CUP — WHAT IS SAID',
    lines: [
      'That the tithe in Lamprow was collected twice, and the second collector has not been seen since.',
      'That the Warden’s beat now passes the Counting House door, which it never used to.',
      'That the publican will not serve the Tithe-Takers and the Tithe-Takers have not come in to be refused.',
    ],
    gate: { after: ['lamprow_tithe'] },
    prop: { kind: 'plaque', x: -8, z: -21.85 },
  },
  {
    id: 'ashfall_cinder_cup:rumour_board',
    areaId: 'ashfall_cinder_cup',
    at: { x: -8, z: -19.4 },
    form: 'notice',
    label: 'Read the board',
    title: 'THE CINDER CUP — WHAT IS SAID',
    lines: [
      'That there is a new Whisperer in the ward, and that the Dispatcher has already found them work.',
      'That the Lamprow tithe is due again, and that the collectors below the kerb do not carry a ledger.',
      'That the bed upstairs is twenty Ducats and worth it, and that the publican wrote this himself.',
    ],
    prop: { kind: 'plaque', x: -8, z: -21.85 },
  },

  /* --- Lamprow ----------------------------------------------------------------------- */
  {
    id: 'lamprow:tithe_bill',
    areaId: 'lamprow',
    at: { x: 20, z: -4.6 },
    form: 'notice',
    label: 'Read the tithe bill',
    title: 'THE LIGHT TITHE — LAMPROW — THIS QUARTER',
    lines: [
      'Every hearth on the High Street is assessed for the lamp nearest it. Every hearth in the Sink is assessed for the lamp it can see.',
      'Payment is taken at the Tithe Office by day and by the collectors by night. The collectors do not issue receipts.',
      'A hearth that cannot see a lamp is assessed for the dark. The dark is also Magistracy property.',
    ],
    prop: { kind: 'noticepost', x: 20, z: -7.6 },
  },
  {
    id: 'lamprow_oil_house:measure',
    areaId: 'lamprow_oil_house',
    at: { x: 2, z: -15.6 },
    form: 'plaque',
    label: 'Read the measure',
    title: 'THE MEASURE — LAMP OIL, BY THE WARD',
    lines: [
      'One lamp, one night: a gill. One row, one night: nine gills. One ward, one quarter: the keeper will not say, because the number is the tithe.',
      'Oil is sold to the Magistracy at the measure and to nobody else. What is on the shelf is what the Magistracy did not take.',
      'A gill spilled is a gill billed. The iron floor is for the drips, not for you.',
    ],
    prop: { kind: 'plaque', x: 2, z: -17.85 },
    flag: 'read_the_measure',
  },
  {
    id: 'lamprow_tithe_office:arrears',
    areaId: 'lamprow_tithe_office',
    at: { x: 0, z: -10.8 },
    form: 'ledger',
    label: 'Read the arrears',
    title: 'THE LIGHT TITHE — ARREARS',
    lines: [
      'Hearths on the High Street: 62. In arrears: 0. Hearths in the Sink: 140. In arrears: 140.',
      'Collected from the Sink this quarter, by the office: nil. Collected from the Sink this quarter, by the collectors: not recorded.',
      'Note, in the bailiff’s hand: "Not recorded is not the same as not collected. Ask the cellar."',
    ],
    prop: { kind: 'lectern', x: 0, z: -14 },
  },

  /* --- the Ironworks ----------------------------------------------------------------- */
  {
    id: 'ashfall_ironworks:tally_board',
    areaId: 'ashfall_ironworks',
    at: { x: -6, z: -23.6 },
    form: 'plaque',
    label: "Read the smith's board",
    title: 'RATES — THE IRONWORKS ARTIFICER',
    lines: [
      'ASCENSION. A card raised a rank, on the bench, while you wait. Bring the card and the Ducats.',
      'SCHEMATICS. A plan cut into a working card. Bring the plan. Plans are not sold here and never have been.',
      'SPLICING. A card pressed with a Core. Bring both. The bench keeps nothing it does not need.',
      'No work is undertaken during a contract. Nothing is charged for work refused.',
    ],
    prop: { kind: 'plaque', x: -6, z: -25.85 },
  },

  /* --- the Apothecary ---------------------------------------------------------------- */
  {
    id: 'ashfall_apothecary:quota_bill',
    areaId: 'ashfall_apothecary',
    at: { x: -6, z: 16.6 },
    form: 'notice',
    label: 'Read the Clinic bill',
    title: 'THE CLINIC — TERMS',
    lines: [
      'The Clinic treats a Pact, not a person. What is bound to you is mended; what is you is not our trade.',
      'Seven treatments a week are billed to the Magistracy. The eighth is billed to you. Ask which you are.',
      'Brews are sold three to a satchel. A fourth is not sold; it is dropped.',
    ],
    prop: { kind: 'plaque', x: -6, z: 19.85, yaw: Math.PI },
  },

  /* --- the Records Office ------------------------------------------------------------ */
  {
    // What the roll says once the Weeping Stile has been walked: the word beside sixty-one
    // names. Above the ordinary entry so it wins the same lectern -- the `ASIDES` rule.
    id: 'ashfall_records:census_roll_after',
    areaId: 'ashfall_records',
    at: { x: 0, z: -5.4 },
    form: 'ledger',
    label: 'Read the census roll',
    title: 'THE ROLL — WEEPING STILE — SIXTY-ONE SOULS',
    lines: [
      'Hearth 1. Abel Marrow, cottar. RELOCATED. LABOUR.',
      'Hearth 2. Winn Marrow, his wife. RELOCATED. LABOUR.',
      'Hearth 3. The child. RELOCATED.',
      '. . .',
      'Hearth 61. RELOCATED. LABOUR.',
      'Roll closed. Clerk: E. Stile. Countersigned: the Spire.',
    ],
    gate: { after: ['hollow_census'] },
    prop: { kind: 'lectern', x: 0, z: -2.2 },
    flag: 'read_the_roll',
  },
  {
    id: 'ashfall_records:census_roll',
    areaId: 'ashfall_records',
    at: { x: 0, z: -5.4 },
    form: 'ledger',
    label: 'Read the census roll',
    title: 'THE ROLL — ASHFALL WARD — CURRENT COUNT',
    lines: [
      'Hearths counted: 214. Hearths answering: 209. Hearths sealed by order: 5.',
      'Persons on the roll: 1,006. Persons assessed this quarter: 1,006. Persons in arrears: 388.',
      'Note in the margin, in a different hand: "The count is not the point. The counting is."',
    ],
    prop: { kind: 'lectern', x: 0, z: -2.2 },
  },
];

/**
 * What stands readable in an area right now: gate-filtered, and one per `at`, first open wins.
 */
export function noticesInArea(areaId: string, chron: Chronicle): readonly NoticeDef[] {
  const taken = new Set<string>();
  const out: NoticeDef[] = [];
  for (const n of NOTICES) {
    if (n.areaId !== areaId || !gateOpen(n.gate, chron)) continue;
    const key = `${n.at.x},${n.at.z}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(n);
  }
  return out;
}

export const noticeById = (id: string): NoticeDef | undefined => NOTICES.find((n) => n.id === id);
