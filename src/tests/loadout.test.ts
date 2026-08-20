import { describe, expect, it } from 'vitest';
import { addUnit, atTile, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { ADEPT_AI, NOVICE_AI } from '../core/ai/controller.js';
import { createCombat } from '../core/engine/setup.js';
import { carryFor } from '../core/overworld/run.js';
import { RELICS, slotOf } from '../core/data/relics.js';
import { TITHE_MARROW } from '../core/engine/effects.js';
import {
  emptyLoadout,
  equipRelic,
  newRun,
  type GlobalGameState,
  type RelicLoadout,
} from '../core/overworld/state.js';

/**
 * The Commander Loadout.
 *
 * Four slots, and four relics that each bend a rule nothing else in the game bends. The
 * tests that matter are the ones proving the capability actually reaches the board —
 * gear the engine receives but never acts on is a line of data pretending to be content.
 */

const dressed = (...ids: string[]): RelicLoadout => {
  const loadout = emptyLoadout();
  for (const id of ids) {
    const slot = slotOf(id);
    if (slot) loadout[slot] = id;
  }
  return loadout;
};

/** A character wearing exactly the given gear. */
const wearing = (...ids: string[]): GlobalGameState => {
  const overworld = newRun(1);
  overworld.relics = [...ids];
  overworld.equippedRelics = dressed(...ids);
  return { overworld, combat: null };
};

describe('Magistrate’s Monocle', () => {
  it('reaches the commander as a capability, not an id', () => {
    const carry = carryFor(wearing('relic_monocle').overworld);
    expect(carry.boons?.revealIntents).toBe(true);
    expect(JSON.stringify(carry)).not.toContain('relic_');

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carry);
    expect(state.players.player.revealsIntents).toBe(true);
    expect(state.players.enemy.revealsIntents, 'and the enemy gets nothing').toBe(false);
  });

  it('makes an Adept declare its cards, which it otherwise hides', () => {
    // The Adept's whole edge is that only its blows are foreseeable. This is the counter,
    // and it is a rule being bent rather than a number moved.
    const hidden = new CombatSession(NOVICE_DUELIST, 7, ADEPT_AI);
    const shown = new CombatSession(NOVICE_DUELIST, 7, ADEPT_AI, undefined, undefined, {
      boons: { revealIntents: true },
    });

    expect(hidden.debugState.players.player.revealsIntents).toBe(false);
    expect(shown.debugState.players.player.revealsIntents).toBe(true);
    // The setting the session hands the reducer is what actually changes.
    expect(ADEPT_AI.telegraph, 'the tier it is buying back').toBe('attacks');
    expect(NOVICE_AI.telegraph).toBe('all');
  });
});

describe('Lead-Lined Trenchcoat', () => {
  const poisoned = (immune: boolean) => {
    const state = scenario({ width: 6, height: 7 });
    state.players.player.immuneToToxin = immune;
    const mine = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 }, hp: 9 });
    state.units[mine.id]!.statuses.toxin = 2;
    return { state, mine };
  };

  it('stops Toxin costing anything', () => {
    const { state, mine } = poisoned(true);
    // End our turn, then theirs, so start-of-turn statuses tick on us again.
    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    const ticks = eventsOf(res.events, 'statusTicked').filter(
      (e) => e.unitId === mine.id && e.status === 'toxin',
    );
    expect(ticks.every((t) => t.damage === 0), 'no damage from any tick').toBe(true);
    expect(res.state.units[mine.id]!.hp, 'untouched').toBe(9);
  });

  it('is an immunity, not a cleanse — the stacks still burn off', () => {
    // Clearing them outright would be a different and stronger thing, and it would deny
    // Wildfire the Toxin it consumes.
    const { state, mine } = poisoned(true);
    const before = state.units[mine.id]!.statuses.toxin;

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.units[mine.id]!.statuses.toxin).toBe(before! - 1);
  });

  it('does nothing for a side that is not wearing it', () => {
    const { state, mine } = poisoned(false);
    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.units[mine.id]!.hp).toBeLessThan(9);
  });
});

describe('Alchemist’s Mortar', () => {
  const raising = (card: string, bonus: number) => {
    const state = scenario({ width: 6, height: 7, hand: [card], pips: 8, marrow: 4 });
    state.players.player.bonusObstacleHp = bonus;
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    return state;
  };

  it('thickens a wall raised by spawnObstacle', () => {
    const plain = raising('stone_barricade', 0);
    const bare = run(plain, play(handCard(plain, 'player', 'stone_barricade'), atTile(2, 3)));
    const base = eventsOf(bare.events, 'obstacleSpawned')[0]!.obstacle.maxHp;

    const state = raising('stone_barricade', 2);
    const res = run(state, play(handCard(state, 'player', 'stone_barricade'), atTile(2, 3)));
    const raised = eventsOf(res.events, 'obstacleSpawned')[0]!;

    expect(raised.obstacle.maxHp).toBe(base + 2);
    expect(raised.obstacle.hp).toBe(base + 2);
  });

  it('thickens a construct too, on top of the strength the spell chose', () => {
    // `spawnConstruct` replaces the definition's health with the casting's, so the two
    // numbers have to be added together *before* the spawn — the event embeds a snapshot
    // the renderer never re-reads, and adjusting health afterwards would draw the pillar
    // permanently wrong.
    const state = raising('flash_freeze', 2);
    const res = run(state, play(handCard(state, 'player', 'flash_freeze'), atTile(2, 3)));

    const raised = eventsOf(res.events, 'obstacleSpawned')[0];
    expect(raised, 'the pillar went up').toBeDefined();
    expect(raised!.obstacle.maxHp, '4 from the spell, 2 from the mortar').toBe(6);
  });

  it('leaves the map’s own scenery alone', () => {
    // Setup spawns crystals and Marrow Geodes through the same function, filed under
    // 'player' because scenery belongs to no side. If the bonus were applied down there,
    // the Mortar would be quietly rewriting the arena.
    const plain = createCombat(NOVICE_DUELIST, 7).state;
    const geared = createCombat(NOVICE_DUELIST, 7, undefined, undefined, {
      boons: { bonusObstacleHp: 2 },
    }).state;

    const health = (s: typeof plain): number[] =>
      Object.values(s.obstacles).map((o) => o.maxHp).sort((a, b) => a - b);

    expect(health(geared)).toEqual(health(plain));
  });
});

describe('Blood-Ink Ledger', () => {
  it('pays extra on the tithe command', () => {
    const state = scenario({ width: 6, height: 7 });
    state.players.player.bonusTitheMarrow = 1;
    const victim = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 4 },
      fresh: false,
    });
    const worth = state.units[victim.id]!.titheBonus;

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.players.player.marrow).toBe(TITHE_MARROW + worth + 1);
    // The event has to agree with the purse, or the floater says a different number.
    expect(eventsOf(res.events, 'unitTithed')[0]!.marrow).toBe(TITHE_MARROW + worth + 1);
  });

  it('pays on a tithe made by a card, not only by the command', () => {
    // Dark Tithe bleeds through the `tithe` op, which routes into the same `applyTithe` as
    // the command. The Ledger is a rule about tithing, so it applies to both — a relic
    // that skipped this would be worthless to the deck most likely to want it.
    const state = scenario({ width: 6, height: 7, hand: ['dark_tithe'], pips: 4 });
    state.players.player.bonusTitheMarrow = 1;
    const victim = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 4 },
      fresh: false,
    });

    const card = handCard(state, 'player', 'dark_tithe');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: victim.id } }));

    // Dark Tithe's own 3, plus the Wisp's 1 premium, plus the Ledger's 1.
    expect(res.state.players.player.marrow).toBe(5);
  });

  it('gives nothing without the relic', () => {
    const state = scenario({ width: 6, height: 7 });
    const victim = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 4 },
      fresh: false,
    });
    const worth = state.units[victim.id]!.titheBonus;

    const res = run(state, { type: 'bloodTithe', unit: victim.id });
    expect(res.state.players.player.marrow).toBe(TITHE_MARROW + worth);
  });
});

describe('the four together', () => {
  it('can all be worn at once, one to a slot', () => {
    const g = wearing();
    g.overworld.relics = ['relic_monocle', 'relic_lead_coat', 'relic_mortar', 'relic_ledger'];
    for (const id of g.overworld.relics) equipRelic(g, id, slotOf(id));

    const carry = carryFor(g.overworld);
    expect(carry.boons?.revealIntents).toBe(true);
    expect(carry.boons?.immuneToToxin).toBe(true);
    expect(carry.boons?.bonusObstacleHp).toBe(2);
    expect(carry.boons?.bonusTitheMarrow).toBe(1);
  });

  it('reaches the board as capabilities the engine can act on', () => {
    const g = wearing();
    g.overworld.relics = ['relic_monocle', 'relic_lead_coat', 'relic_mortar', 'relic_ledger'];
    for (const id of g.overworld.relics) equipRelic(g, id, slotOf(id));

    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(g.overworld));
    const me = state.players.player;

    expect(me.revealsIntents).toBe(true);
    expect(me.immuneToToxin).toBe(true);
    expect(me.bonusObstacleHp).toBe(2);
    expect(me.bonusTitheMarrow).toBe(1);
  });

  it('still names no relic to the engine', () => {
    const g = wearing();
    g.overworld.relics = Object.keys(RELICS);
    for (const id of g.overworld.relics) equipRelic(g, id, slotOf(id));

    expect(JSON.stringify(carryFor(g.overworld))).not.toContain('relic_');
  });

  it('never lets a malformed carry make things worse', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, {
      boons: { bonusObstacleHp: -5, bonusTitheMarrow: -3 },
    });
    expect(state.players.player.bonusObstacleHp).toBe(0);
    expect(state.players.player.bonusTitheMarrow).toBe(0);
  });
});
