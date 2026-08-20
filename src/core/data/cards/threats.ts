/**
 * The Bestiary: creatures an encounter fields against you.
 *
 * Not cards. Every one is `setupOnly`, so it can never be drawn, owned, drafted or put in
 * a deck — the same guard the Bound Forms and the Vanguard Footman use. They exist as stat
 * blocks an encounter places, and they reach the player only through the Threat Ledger,
 * which builds itself from every definition in `CARDS` that carries a `unit`.
 *
 * The wildlife in `wildlife.ts` belongs to neither army. These belong to whoever posted
 * the contract you took.
 *
 * Each one leans on a capability rather than on a stat line, because a creature that is
 * only a bigger number is a creature the player answers the same way as the last one.
 */

import type { CardDef } from '../../types/cards.js';

export const THREAT_CARDS: Record<string, CardDef> = {
  /**
   * The siege engine, and the first thing in the game that changes the arena by walking
   * through it.
   *
   * Every tile it steps off becomes rubble — permanent, and 2 MOV to cross. Two facts
   * follow that are worth knowing before you place one. It cannot cross its own trail: at
   * 1 MOV it can never afford a rubble tile, so it commits to a direction and cannot take
   * it back. And the lane it walks becomes expensive for *everyone*, which is as much a
   * problem for the army that fielded it as for the one facing it.
   *
   * Uncapped Escalation, because `escalationCap` is Infinity for anything 2x2. Left alone
   * it does not stop growing — the clock the player is actually playing against.
   */
  scrap_titan: {
    id: 'scrap_titan',
    name: 'Scrap-Titan',
    cost: { pips: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'A walking scrapyard. Grinds every tile it leaves into rubble, and never stops growing. It cannot cross its own wreckage.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 2 },
    effect: { op: 'summon', unitDef: 'scrap_titan' },
    keywords: ['Escalate'],
    setupOnly: true,
    unit: {
      atk: 5,
      hp: 25,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      // Behemoth escalation is uncapped; the cap is applied in status.ts by footprint.
      escalationBonus: { atk: 1, hp: 2 },
      trail: 'rubble',
    },
  },

  /**
   * The finisher, and the reason a wounded unit behind your line is now a liability.
   *
   * Feral, so it belongs to nobody and either army may put it down — but unlike the Ridge
   * Wolf it does not take whatever is closest. It hunts the **weakest** thing on the
   * board and walks past healthy bodies to reach it. Four movement and Haste mean it
   * usually gets there the turn it arrives.
   *
   * The counterplay is real and specific: heal, or put something weaker in front of it.
   */
  marrow_hound: {
    id: 'marrow_hound',
    name: 'Marrow-Hound',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Feral. Haste. Smells blood and goes for it — the most wounded thing on the board, whoever it belongs to. Anyone may put it down.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'marrow_hound' },
    keywords: ['Feral', 'Haste'],
    setupOnly: true,
    unit: {
      atk: 3,
      hp: 3,
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      hunts: 'weakest',
    },
  },

  /**
   * The one you should not answer with armour.
   *
   * One attack is nothing, and that is the point — the damage is not the attack, it is the
   * Toxin the attack leaves, which ticks through plate as `true` damage. Eight health on
   * two movement means it is slow, obvious, and still worth killing early, because every
   * swing it lands is a stack that never stops mattering.
   *
   * It is also a Wildfire fuse the *enemy* is laying on your units, which is the first
   * time that particular knife points the other way.
   */
  plague_bearer: {
    id: 'plague_bearer',
    name: 'Plague-Bearer',
    cost: { pips: 0, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Every blow it lands leaves 1 Toxin, which ticks through Armor. It hits for almost nothing and is worth killing anyway.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'plague_bearer' },
    keywords: [],
    setupOnly: true,
    unit: {
      atk: 1,
      hp: 8,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      onHit: { status: 'toxin', stacks: 1 },
    },
  },
};
