/**
 * Aura, Detonation and Revival spells — the cards the overhaul added.
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
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'spell',
    text: 'Wraps an ally in fire. +20 ATK per stack, to two. At Climax it burns what it strikes, and the ground it leaves.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_conflagration' },
    keywords: [],
  },

  verdant_swell: {
    id: 'verdant_swell',
    name: 'Verdant Swell',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'spell',
    text: 'Roots an ally deeper. +40 Max HP per stack, to two. At Climax it drinks what it wounds, and bursts with Toxin when it dies.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_overgrowth' },
    keywords: [],
  },

  static_charge: {
    id: 'static_charge',
    name: 'Static Charge',
    cost: { bones: 2, marrow: 0 },
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
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'spell',
    text: 'Sets an ally in stone. +20 Persistent Armor per stack, to two. At Climax nothing shoves it.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_petrifying_mantle' },
    keywords: [],
  },

  /**
   * The only Aura you cast on something you are willing to lose.
   *
   * Priced at one Bone rather than two because what it really costs is the body: a Siphon
   * bleeds its host every turn forever, and the Marrow it pays is the only Marrow in the
   * game that asks for neither an action nor a card.
   */
  /**
   * Frost and Arcane, the two Auras the overhaul designed and did not build.
   *
   * Priced at 2 Bones like the other four that pay a stat outright. Rime Shell pays both halves
   * of survival because that is frost's whole argument; the Written Path pays reach, and is the
   * only Aura the Hero can put in their own deck — `deckRules` allows `neutral` and `arcane`,
   * so the Hero's colour is the one they may build with rather than draft.
   */
  rime_shell: {
    id: 'rime_shell',
    name: 'Rime Shell',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'spell',
    text: 'Plates an ally in ice. +20 Max HP and +10 Armor per stack, to two. At Climax it re-forms.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_rime_shell' },
    keywords: [],
  },

  written_path: {
    id: 'written_path',
    name: 'Written Path',
    cost: { bones: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: 'Writes an ally a road. +1 MOV per stack, to two. At Climax it steps to anywhere it sees.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_written_path' },
    keywords: [],
  },

  marrow_siphon: {
    id: 'marrow_siphon',
    name: 'Marrow Siphon',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Opens an ally to the dark. Each turn it bleeds 10 and yields 1 Marrow. It does not stop. At Climax its wounds fester: whatever it hurts is left Brittle.',
    target: ALLY_UNIT,
    effect: { op: 'attachAura', aura: 'aura_marrow_siphon' },
    keywords: [],
  },

  // ------------------------------------------------------------------ revival

  /**
   * The first variable-cost card in the game.
   *
   * X is the whole decision: five Bones is a whole body back on the exact tile it died on,
   * one Bone is a warm corpse holding a lane. Sited on the pyre, so it is the only revival
   * an enemy can deny — and denying it costs them a body standing on the spot.
   *
   * Same-fight only, by construction rather than by rule: a pyre is a coordinate on *this*
   * board, and a body carried into the next fight has no `fellAt` there to aim at.
   */
  aetheric_resurgence: {
    id: 'aetheric_resurgence',
    name: 'Aetheric Resurgence',
    cost: { bones: 0, marrow: 0 },
    xCost: { max: 5 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'X Bones, up to 5. Raises a fallen Vanguard on the exact tile it fell, at 20% of its health per Bone spent. Nothing may be standing there.',
    target: { kind: 'fallen', site: 'pyre' },
    effect: {
      op: 'revive',
      site: 'pyre',
      hp: { mode: 'perBonePercent', percent: 20 },
    },
    keywords: [],
  },

  /**
   * The safe raising. Half a body, well behind the line, and quick enough to get somewhere
   * the turn it stands up.
   *
   * Sited on an Anchor Tile rather than the pyre, which is what lets it raise a body that
   * fell in an *earlier* fight of the same dungeon — the anchors exist in every fight, the
   * pyre only in the one where it was lit.
   */
  anchor_rally: {
    id: 'anchor_rally',
    name: 'The Anchor Rally',
    cost: { bones: 3, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Raises a fallen Vanguard on an Anchor Tile at half health, quickened: +1 MOV this turn.',
    target: { kind: 'fallen', site: 'anchor' },
    effect: {
      op: 'revive',
      site: 'anchor',
      hp: { mode: 'percent', percent: 50 },
      riders: { fleet: 1 },
    },
    keywords: [],
  },

  /**
   * Free in Bones, and paid for in blood you had to open something up for this turn.
   *
   * The payoff loop Blood Magic was built toward: tithe a healthy body for the Marrow,
   * spend it raising a fallen one as a wall. It stands up at 1 health wearing everything
   * it lost, which makes it briefly the toughest thing you own and one true-damage tick
   * from gone.
   */
  blood_and_bone_rally: {
    id: 'blood_and_bone_rally',
    name: 'The Blood & Bone Rally',
    cost: { bones: 0, marrow: 3 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Costs 3 Marrow, which no bank of Bones will cover. Raises a fallen Vanguard in your starting zone at 10 health, wearing Persistent Armor equal to everything it lost.',
    target: { kind: 'fallen', site: 'startingZone' },
    effect: {
      op: 'revive',
      site: 'startingZone',
      hp: { mode: 'fixed', amount: 10 },
      riders: { armorFromMissingHp: true },
    },
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
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'spell',
    text: 'Spends a Climaxed Aura. Everything around the host takes 50 fire.',
    target: CLIMAXED_ALLY,
    effect: {
      op: 'seq',
      effects: [
        { op: 'detonateAura' },
        { op: 'damage', amount: 50, dtype: 'fire', area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
  },

  verdant_collapse: {
    id: 'verdant_collapse',
    name: 'Verdant Collapse',
    cost: { bones: 1, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'spell',
    text: 'Spends a Climaxed Aura. The growth goes back into the Pact — heal 80.',
    target: CLIMAXED_ALLY,
    effect: {
      op: 'seq',
      effects: [
        { op: 'detonateAura' },
        { op: 'heal', amount: 80 },
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
    cost: { bones: 0, marrow: 0 },
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
