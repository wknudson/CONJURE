/**
 * Aura and Detonation spells — the cards that drive the Rule of 3.
 *
 * Phase 2 built the machinery (`attachAura`, `detonateAura`, the stacking hook) and
 * deliberately shipped no cards for it. These are those cards, and they arrive now because
 * Phase 3 takes minions out of the deck: the slots they vacate are exactly what an Aura
 * wants, and a deck that lost a third of its contents needs something to hold.
 *
 * The pairing is the point. An Aura is a three-turn investment that stops paying at the
 * cap and starts costing, and a Detonation is how you cash it in — so a school that drafts
 * one wants the other, and a deck running neither is playing a different game.
 */

import type { CardDef } from '../../types/cards.js';

/** Every Aura targets an allied body, and none may touch the Bound Form. */
const ALLY_UNIT = {
  kind: 'entity' as const,
  side: 'ally' as const,
  includeObstacles: false,
};

/** A Detonation is unplayable until the fuse has burned down. */
const CLIMAXED_ALLY = { ...ALLY_UNIT, requiresAura: 'climax' as const };

export const AURA_CARDS: Record<string, CardDef> = {
  // ------------------------------------------------------------------ the five Auras

  ember_coat: {
    id: 'ember_coat',
    name: 'Ember Coat',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'spell',
    text: 'Wraps an ally in fire. +1 ATK per stack, to two. At Climax it burns what it strikes.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_conflagration' },
    keywords: [],
  },

  verdant_swell: {
    id: 'verdant_swell',
    name: 'Verdant Swell',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'spell',
    text: 'Roots an ally deeper. +2 Max HP per stack, to two. At Climax it drinks what it wounds.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_overgrowth' },
    keywords: [],
  },

  static_charge: {
    id: 'static_charge',
    name: 'Static Charge',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'spell',
    text: 'Charges an ally. +1 MOV per stack, to two. At Climax it stops going around things.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_static_charge' },
    keywords: [],
  },

  petrifying_mantle: {
    id: 'petrifying_mantle',
    name: 'Petrifying Mantle',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'spell',
    text: 'Sets an ally in stone. +1 Persistent Armor per stack, to two. At Climax nothing shoves it.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_petrifying_mantle' },
    keywords: [],
  },

  /**
   * The only Aura you cast on something you are willing to lose.
   *
   * Priced at one Pip rather than two because what it really costs is the body: a Siphon
   * bleeds its host every turn forever, and the Marrow it pays is the only Marrow in the
   * game that asks for neither an action nor a card.
   */
  marrow_siphon: {
    id: 'marrow_siphon',
    name: 'Marrow Siphon',
    cost: { pips: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Opens an ally to the dark. Each turn it bleeds 1 and yields 1 Marrow. It does not stop.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_marrow_siphon' },
    keywords: [],
  },

  // ------------------------------------------------------------- the three Detonations

  /**
   * Detonations are cheap because the Aura already cost three turns. What you are paying
   * for here is the timing, not the effect.
   */
  cataclysm: {
    id: 'cataclysm',
    name: 'Cataclysm',
    cost: { pips: 1, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'spell',
    text: 'Spends a Climaxed Aura. Everything around the host takes 5 fire.',
    target: CLIMAXED_ALLY,
    effect: {
      op: 'seq',
      effects: [
        { op: 'detonateAura' },
        { op: 'damage', amount: 5, dtype: 'fire', area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
  },

  verdant_collapse: {
    id: 'verdant_collapse',
    name: 'Verdant Collapse',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'spell',
    text: 'Spends a Climaxed Aura. The growth goes back into the Pact — heal 8.',
    target: CLIMAXED_ALLY,
    effect: {
      op: 'seq',
      effects: [
        { op: 'detonateAura' },
        { op: 'heal', amount: 8 },
      ],
    },
    keywords: [],
  },

  /**
   * Free to cast, because the Aura took three turns to grow and the Marrow evaporates at
   * end of turn anyway. What it buys is a single enormous turn.
   */
  marrow_burst: {
    id: 'marrow_burst',
    name: 'Marrow Burst',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Spends a Climaxed Aura for 4 Marrow. Use it this turn or lose it.',
    target: CLIMAXED_ALLY,
    effect: {
      op: 'seq',
      effects: [
        { op: 'detonateAura' },
        { op: 'extractMarrow', amount: 4 },
      ],
    },
    keywords: [],
  },
};
