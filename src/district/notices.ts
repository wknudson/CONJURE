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
    at: { x: 22, z: 30 },
    form: 'notice',
    label: 'Read the posted bill',
    title: 'BY ORDER OF THE MAGISTRACY OF ASHFALL WARD',
    lines: [
      'The sanctioned walkway is sanctuary. No officer of the ward may lay hands on a citizen standing upon it.',
      'Ground beyond the kerb is not sanctuary. Citizens found upon it after the curfew bell will be escorted to the nearest flagstone and assessed.',
      'Assessment is payable in Ducats. Assessment is not a fine. The Magistracy does not levy fines.',
      'Posted by the Ward Clerk. Defacement of this bill is assessable.',
    ],
    prop: { kind: 'noticepost', x: 22, z: 27.6 },
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
