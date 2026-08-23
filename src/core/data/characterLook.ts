/**
 * Who the player is, before the game has told them anything about themselves.
 *
 * Down to three fields. Hair, face, and skin used to live here as procedural presets
 * driving a canvas-drawn sprite — the Commander is a bitmap now (`hero-male-front.png` /
 * `hero-female-front.png`), so there is nothing left to customise about *how they look*,
 * only who they are and which discipline they Vow to. Deliberately: gear is still earned,
 * not chosen at creation, and a bitmap sprite cannot be recoloured or reshaped by a preset
 * the way the old procedural one could — so the honest move is to stop offering a choice
 * the art can no longer keep.
 *
 * Lives in `core/data` rather than beside the save schema because two very different
 * readers need it: the creation screen, which shows it, and `initializeNewProfile`, which
 * writes it down.
 */

import { DEFAULT_COMPANION } from './companions.js';
import { SCHOOLS, SPECIES_BY_SCHOOL } from './pools.js';

export type Gender = 'male' | 'female';

export interface CharacterLook {
  /** What the Magistracy files them under. Trimmed and capped; never blank. */
  nickname: string;
  gender: Gender;
  /** The bloodline they take the Vow with, by `CompanionDef.id` — `'ignis'`, `'boreas'`. */
  starterCompanion: string;
}

/** Longest a nickname may be. A wanted poster has a width. */
export const NICKNAME_MAX = 18;

/** What the Magistracy writes when the applicant would not give a name. */
export const DEFAULT_NICKNAME = 'Commander';

/**
 * The look a creator opens on, and what any caller that has not asked gets.
 */
export function defaultLook(): CharacterLook {
  return {
    nickname: DEFAULT_NICKNAME,
    gender: 'female',
    starterCompanion: DEFAULT_COMPANION.id,
  };
}

/**
 * Forces anything into a look the renderer and the save can both accept.
 *
 * A save file is data. A hand-edited or stale field should put the player in the game
 * looking sensible, not in a stack trace. Every field is clamped or replaced rather than
 * rejected, so this function has no failure mode.
 *
 * Saves written before this cut down still carry `hairPreset`/`facePreset`/`skinPreset` —
 * those keys are simply ignored now rather than read, which is what lets an old save load
 * cleanly without a dedicated migration step.
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

  return { nickname, gender, starterCompanion: starter };
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