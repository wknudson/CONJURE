/**
 * Who the player is, before the game has told them anything about themselves.
 *
 * Five fields, and the restraint is the design. There is no body type, no height slider,
 * no eye colour and — deliberately — **no gear**: optics, vestment, trinket, treads and
 * will are things a Commander *earns*, and putting them in the creator would spend the
 * reward before the first contract. What is here is what a 2D sprite can actually show at
 * the size the diorama renders it, and nothing that would be a promise the art cannot keep.
 *
 * Lives in `core/data` rather than beside the save schema because two very different
 * readers need it: the creation screen, which draws it, and `initializeNewProfile`, which
 * writes it down. One source means a preset the screen offers can never be a preset the
 * save refuses.
 */

import { DEFAULT_COMPANION } from './companions.js';
import { SCHOOLS, SPECIES_BY_SCHOOL } from './pools.js';

export type Gender = 'male' | 'female';

export interface CharacterLook {
  /** What the Magistracy files them under. Trimmed and capped; never blank. */
  nickname: string;
  gender: Gender;
  /** Index into `HAIR_PRESETS`. Typed loosely because the save schema calls it so. */
  hairPreset: string | number;
  /** Index into `FACE_PRESETS`. The *expression* — brow, eye and mouth shape. */
  facePreset: string | number;
  /**
   * Index into `SKIN_TONES`. Its own axis, and it has to be.
   *
   * Skin used to be read off `facePreset`, so choosing a weathered brow also chose a
   * complexion and there was no way to have one without the other. Four expressions times
   * four tones is sixteen faces; multiplexed onto one control it was four.
   */
  skinPreset: string | number;
  /** The bloodline they take the Vow with, by `CompanionDef.id` — `'ignis'`, `'boreas'`. */
  starterCompanion: string;
}

/**
 * The hair the creator offers.
 *
 * Authored as silhouettes rather than styles, because a silhouette is what survives being
 * drawn 40 pixels tall and then tilted back into a diorama. `crop` and `mane` read
 * differently across a room; "layered bob" and "textured bob" would not.
 */
export const HAIR_PRESETS = [
  { id: 'crop', name: 'Cropped', genders: ['male'] as Gender[] },
  { id: 'mane', name: 'Mane', genders: ['male', 'female'] as Gender[] },
  { id: 'braid', name: 'Braided', genders: ['female'] as Gender[] },
  { id: 'topknot', name: 'Topknot', genders: ['male', 'female'] as Gender[] },
  { id: 'shorn', name: 'Shorn', genders: ['male'] as Gender[] },
  { id: 'wild', name: 'Unkempt', genders: ['male', 'female'] as Gender[] },
  { id: 'undercut', name: 'Undercut', genders: ['male'] as Gender[] },
  { id: 'ponytail', name: 'Ponytail', genders: ['female'] as Gender[] },
  { id: 'curls', name: 'Curled', genders: ['female'] as Gender[] },
  { id: 'pigtails', name: 'Pigtails', genders: ['female'] as Gender[] },
  { id: 'longBangs', name: 'Long Bangs', genders: ['female'] as Gender[] },
] as const;

/**
 * Which `HAIR_PRESETS` indices this bearing offers, in list order.
 *
 * The cycler steps through *this*, not through `0..HAIR_PRESETS.length`, so switching
 * gender never lands on a style that was never offered for it — the alternative is an
 * index that happens to still be in range but points at the wrong bearing's hairstyle.
 */
export function hairIndexesFor(gender: Gender): number[] {
  return HAIR_PRESETS.reduce<number[]>((acc, preset, i) => {
    if ((preset.genders as readonly Gender[]).includes(gender)) acc.push(i);
    return acc;
  }, []);
}

/** The style a bearing opens on when first chosen — `defaultLook()` and the gender toggle both use this. */
export function defaultHairFor(gender: Gender): number {
  return hairIndexesFor(gender)[0] ?? 0;
}

/**
 * The faces.
 *
 * Fewer than the hair on purpose: at diorama scale a face is three marks, and six of them
 * would be a choice the player cannot see themselves having made.
 */
export const FACE_PRESETS = [
  { id: 'steady', name: 'Steady' },
  { id: 'weathered', name: 'Weathered' },
  { id: 'young', name: 'Young' },
  { id: 'scarred', name: 'Scarred' },
  { id: 'stern', name: 'Stern' },
  { id: 'gentle', name: 'Gentle' },
  { id: 'sly', name: 'Sly' },
] as const;

/** Hair tones, by preset index. Warm to cool, so cycling reads as a change. */
export const HAIR_TONES = [
  '#3B2C22', // crop
  '#6B4A2F', // mane
  '#A8763E', // braid
  '#8A8F98', // topknot
  '#2A2119', // shorn
  '#C2703F', // wild
  '#1C1712', // undercut
  '#5A3A24', // ponytail
  '#7A5230', // curls
  '#4A2E1E', // pigtails
  '#8F5A2E', // longBangs
];

/**
 * Skin tones, on their own control.
 *
 * Widened from four to six now that this is a choice rather than a side effect of picking an
 * expression. Ordered light to dark so cycling reads as a slider rather than as a shuffle.
 */
export const SKIN_TONES = ['#E8C49E', '#E0BC96', '#C8A07A', '#A87A52', '#8D6242', '#5E4030'];

/** Longest a nickname may be. A wanted poster has a width. */
/**
 * Where each pre-decoupling complexion lives in the widened list.
 *
 * The old four were `['#C8A07A', '#8D6242', '#E0BC96', '#5E4030']`, indexed by `facePreset`.
 * They are all still here — this is which slot each one moved to once the list grew to six
 * and was reordered light-to-dark.
 */
const LEGACY_SKIN_BY_FACE = [2, 4, 1, 5];

export const NICKNAME_MAX = 18;

/** What the Magistracy writes when the applicant would not give a name. */
export const DEFAULT_NICKNAME = 'Commander';

/**
 * The look a creator opens on, and what any caller that has not asked gets.
 *
 * Not a random roll. The first thing the player sees has to be the thing their first click
 * changes, and a randomised opening state makes "cycle hair" read as "reroll" instead.
 */
export function defaultLook(): CharacterLook {
  return {
    nickname: DEFAULT_NICKNAME,
    gender: 'female',
    hairPreset: defaultHairFor('female'),
    facePreset: 0,
    skinPreset: 2,
    starterCompanion: DEFAULT_COMPANION.id,
  };
}

/**
 * Forces anything into a look the renderer and the save can both accept.
 *
 * A save file is data. A hand-edited `hairPreset: 900` or a `starterCompanion` naming a
 * species that has since been renamed should put the player in the game wearing something
 * sensible, not in a stack trace or in front of an undefined sprite. Every field is
 * clamped or replaced rather than rejected, so this function has no failure mode.
 */
export function normalizeLook(raw: unknown): CharacterLook {
  const base = defaultLook();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const nickname =
    typeof o.nickname === 'string' && o.nickname.trim()
      ? o.nickname.trim().slice(0, NICKNAME_MAX)
      : base.nickname;

  const gender: Gender = o.gender === 'male' || o.gender === 'female' ? o.gender : base.gender;

  // Only a *founding* bloodline may be started beside — the same rule the Vow enforces, so
  // a save naming a hybrid is corrected rather than honoured.
  const starter =
    typeof o.starterCompanion === 'string' && isStarterSpecies(o.starterCompanion)
      ? o.starterCompanion
      : base.starterCompanion;

  // A look written before skin had its own control keeps the complexion it was rendering.
  //
  // Two steps, and the second is the one that is easy to miss. The old rule was
  // `SKIN_TONES[facePreset]` — but this list has since been reordered and widened from four
  // tones to six, so carrying the *index* across would hand every returning character a
  // different complexion while looking exactly like a faithful migration.
  // `LEGACY_SKIN_BY_FACE` maps the old index to whichever slot now holds the same colour.
  const skin =
    o.skinPreset ??
    (o.facePreset === undefined
      ? base.skinPreset
      : LEGACY_SKIN_BY_FACE[clampPreset(o.facePreset, LEGACY_SKIN_BY_FACE.length)]);

  const hair = clampPreset(o.hairPreset, HAIR_PRESETS.length);

  return {
    nickname,
    gender,
    hairPreset: hairIndexesFor(gender).includes(hair) ? hair : defaultHairFor(gender),
    facePreset: clampPreset(o.facePreset, FACE_PRESETS.length),
    skinPreset: clampPreset(skin, SKIN_TONES.length),
    starterCompanion: starter,
  };
}

/**
 * A preset index, whatever was written where one belonged.
 *
 * Accepts the string form too, because the schema types these as `string | number` and a
 * save round-tripped through a tool that stringifies numbers should not reset the player's
 * hair. Wraps rather than clamps: cycling is modular everywhere else in the creator, and
 * an out-of-range index is the same arithmetic.
 */
export function clampPreset(value: unknown, count: number): number {
  if (count <= 0) return 0;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 0;
  return ((Math.trunc(n) % count) + count) % count;
}

/**
 * Every bloodline the Vow may be taken with — the founders of the six disciplines.
 *
 * Deferred to `SPECIES_BY_SCHOOL` rather than re-derived, and the first attempt here is
 * why: filtering on "speaks exactly one school" reads like the same rule and is not. Lexis
 * speaks one school too, and that school is **arcane** — the Hero Deck's own colour, which
 * is not a discipline anybody enrols in. The looser rule put an Ink Owl on the Vow screen
 * as a seventh option, and a character who picked it would have got a warband with no
 * bodies of its own and a Grimoire in the same colour as the half it is supposed to
 * complement.
 *
 * One rule, in the place that already owns it.
 */
export function starterSpecies(): string[] {
  return SCHOOLS.map((s) => SPECIES_BY_SCHOOL[s]).filter((id): id is string => !!id);
}

/** Whether this species may be started beside. */
export function isStarterSpecies(baseId: string): boolean {
  return starterSpecies().includes(baseId);
}

export function hairOf(look: CharacterLook): (typeof HAIR_PRESETS)[number] {
  return HAIR_PRESETS[clampPreset(look.hairPreset, HAIR_PRESETS.length)]!;
}

export function faceOf(look: CharacterLook): (typeof FACE_PRESETS)[number] {
  return FACE_PRESETS[clampPreset(look.facePreset, FACE_PRESETS.length)]!;
}

/** The complexion this look wears. */
export function skinOf(look: CharacterLook): string {
  return SKIN_TONES[clampPreset(look.skinPreset, SKIN_TONES.length)]!;
}