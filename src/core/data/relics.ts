/**
 * Relics: gear that bends a rule rather than raising a number.
 *
 * The house style, stated as a constraint the data enforces. A relic may change what is
 * *possible* — how much energy banks, what the fog hides, what you are wearing when the
 * bell rings — and may not change what anything hits for. Damage is the one axis where a
 * number going up is indistinguishable from the game getting easier, and a relic that
 * added two damage would be worth exactly as much as a card that did, which is how a gear
 * system eats a card game.
 *
 * Each relic is therefore authored as a set of **capabilities**, in the engine's own
 * words, never as an id the reducer has to recognise. `createCombat` receives "the pip
 * ceiling is 9" and has never heard of a Galvanic Battery — the same rule that keeps
 * brews and Companion levels out of the engine.
 */

import type { CombatBoons } from '../engine/setup.js';

export interface RelicDef {
  id: string;
  name: string;
  /** One line, as it reads on the slot. */
  text: string;
  /** The rule it bends, in a word, for grouping and colour. */
  domain: 'armour' | 'energy' | 'sight';
  /**
   * What it does, in the engine's vocabulary.
   *
   * Additive fields stack across equipped relics; `maxPips` takes the highest rather than
   * summing, because two batteries should not be twice a battery.
   */
  boons: CombatBoons;
}

/** Slots on the coat. Four, and the fourth is the interesting one. */
export const RELIC_SLOTS = 4;

export const RELICS: Record<string, RelicDef> = {
  relic_coat: {
    id: 'relic_coat',
    name: 'Heavy Trenchcoat',
    text: 'Oilcloth over plate. Start every contract wearing 3 Armor.',
    domain: 'armour',
    boons: { armor: 3 },
  },

  relic_battery: {
    id: 'relic_battery',
    name: 'Galvanic Battery',
    text: 'Banks one more than the body should hold. Pip ceiling raised to 9.',
    domain: 'energy',
    // Stated as the ceiling it produces rather than as "+1", so two batteries are one
    // battery and the number in the data is the number the engine uses.
    boons: { maxPips: 9 },
  },

  relic_goggles: {
    id: 'relic_goggles',
    name: 'Soot-Stained Goggles',
    text: 'Smoked glass and a tight seal. Fog and steam no longer blind you.',
    domain: 'sight',
    boons: { ignoreFog: true },
  },
};

export function relicById(id: string): RelicDef | undefined {
  return RELICS[id];
}

/** Every relic in the game, in a stable order for the loadout screen. */
export function allRelics(): RelicDef[] {
  return Object.values(RELICS).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Folds a set of equipped relics into one set of capabilities.
 *
 * Additive where adding makes sense and maximal where it does not — a second coat is more
 * armour, a second battery is not a higher ceiling. Unknown ids are skipped rather than
 * throwing: a save naming a relic that has since been cut should lose the relic, not the
 * fight.
 */
export function boonsOfRelics(equipped: readonly string[]): CombatBoons {
  const out: CombatBoons = {};

  for (const id of equipped) {
    const relic = RELICS[id];
    if (!relic) continue;
    const { armor, pips, extraOpeningCards, maxPips, ignoreFog } = relic.boons;

    if (armor) out.armor = (out.armor ?? 0) + armor;
    if (pips) out.pips = (out.pips ?? 0) + pips;
    if (extraOpeningCards) out.extraOpeningCards = (out.extraOpeningCards ?? 0) + extraOpeningCards;
    if (maxPips) out.maxPips = Math.max(out.maxPips ?? 0, maxPips);
    if (ignoreFog) out.ignoreFog = true;
  }

  return out;
}
