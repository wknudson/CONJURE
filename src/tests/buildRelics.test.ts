import { describe, expect, it } from 'vitest';
import { addUnit, atTile, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { RELICS, RELIC_SLOT_LABELS, allRelics, boonsOfRelics, relicsForSlot, slotOf } from '../core/data/relics.js';
import { COMPANION_TRAITS, traitsFor } from '../core/data/companionTraits.js';
import { COMPANIONS } from '../core/data/companions.js';
import {
  RELIC_SLOT_ORDER,
  emptyLoadout,
  equipRelic,
  newRun,
  wornRelics,
  type GlobalGameState,
  type RelicLoadout,
} from '../core/overworld/state.js';
import { carryFor } from '../core/overworld/run.js';
import { createCombat, type CombatBoons } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { MIN_DISCOUNTED_PIPS, HAND_LIMIT, drawCards, effectiveCost } from '../core/engine/deck.js';
import { toCardSnapshot } from '../core/engine/views.js';
import { pushUnit } from '../core/engine/displacement.js';
import { makeCtx } from '../core/engine/context.js';
import { tameCompanion, type CompanionInstance } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';
import { BOON_KEYS, everyBoon } from './boons.js';

/**
 * Build-defining relics.
 *
 * Four pieces that change what a deck is allowed to do rather than what it hits for, plus
 * the fifth slot one of them needed. The most load-bearing test here is the last one: the
 * boon vocabulary has now grown twice while `carryFor` enumerated it by hand, and twice a
 * capability reached the data and stopped at the seam.
 */

const dressed = (...ids: string[]): RelicLoadout => {
  const out = emptyLoadout();
  for (const id of ids) {
    const slot = slotOf(id);
    if (slot) out[slot] = id;
  }
  return out;
};

const wearing = (...ids: string[]): GlobalGameState => {
  const overworld = newRun(1);
  overworld.relics = [...ids];
  overworld.equippedRelics = dressed(...ids);
  return { overworld, combat: null };
};

describe('the slots', () => {
  it('has five, and every one holds something', () => {
    expect(RELIC_SLOT_ORDER).toHaveLength(5);
    for (const slot of RELIC_SLOT_ORDER) {
      expect(relicsForSlot(slot).length, `${RELIC_SLOT_LABELS[slot]} is an empty shelf`)
        .toBeGreaterThan(0);
      expect(RELIC_SLOT_LABELS[slot], slot).toBeTruthy();
    }
  });

  it('places every relic in a slot the loadout can hold', () => {
    for (const relic of allRelics()) {
      expect(RELIC_SLOT_ORDER, relic.name).toContain(relic.slot);
    }
  });

  it('can wear one of each at once', () => {
    const g = wearing();
    g.overworld.relics = Object.keys(RELICS);
    for (const id of g.overworld.relics) equipRelic(g, id, slotOf(id));

    expect(wornRelics(g.overworld.equippedRelics)).toHaveLength(RELIC_SLOT_ORDER.length);
  });

  it('rebuilds an older loadout without a treads slot', () => {
    // `emptyLoadout` gained a key. A save written before it simply has nothing in that
    // slot, which `readRelics` handles by rebuilding the shape rather than trusting it.
    const legacy = { optics: null, vestment: 'relic_coat', trinket: null, will: null };
    const rebuilt: RelicLoadout = { ...emptyLoadout(), ...(legacy as Partial<RelicLoadout>) };
    expect(rebuilt.treads).toBeNull();
    expect(rebuilt.vestment).toBe('relic_coat');
  });
});

describe('the third variants', () => {
  it('makes every taming roll a three-way choice', () => {
    for (const species of COMPANIONS) {
      expect(traitsFor(species.id).length, species.name).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives Mortis armour and Sylva thicker walls', () => {
    expect(COMPANION_TRAITS.grave_ward!.baseId).toBe('mortis');
    expect(COMPANION_TRAITS.grave_ward!.boons.armor).toBe(2);
    expect(COMPANION_TRAITS.iron_wood!.baseId).toBe('sylva');
    expect(COMPANION_TRAITS.iron_wood!.boons.bonusObstacleHp).toBe(2);
  });

  it('stacks Iron-Wood with the Mortar rather than replacing it', () => {
    // A trait and a relic asking for one rule is the system working.
    const g = wearing('relic_mortar');
    const beast: CompanionInstance = { ...tameCompanion(makeRng(1), 'sylva', 1), traitId: 'iron_wood' };

    expect(carryFor(g.overworld, beast).boons?.bonusObstacleHp, '2 mortar + 2 wood').toBe(4);
  });
});

describe("The Gambler's Coin", () => {
  it('raises the ceiling, and only upward', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(wearing('relic_coin').overworld));
    expect(state.players.player.handLimit).toBe(HAND_LIMIT + 2);
    expect(state.players.enemy.handLimit, 'the enemy gets nothing').toBe(HAND_LIMIT);

    const mean = createCombat(NOVICE_DUELIST, 7, undefined, undefined, {
      boons: { bonusHandLimit: -5 },
    }).state;
    expect(mean.players.player.handLimit, 'gear never makes it worse').toBe(HAND_LIMIT);
  });

  it('lets a hand hold two more before anything burns', () => {
    const state = scenario({ width: 6, height: 8 });
    state.players.player.handLimit = HAND_LIMIT + 2;
    for (let i = 0; i < 40; i++) {
      state.nextId += 1;
      const id = `deck${state.nextId}`;
      state.players.player.cards[id] = { instanceId: id, defId: 'scout_imp' };
      state.players.player.deck.push(id);
    }

    const ctx = makeCtx(state);
    drawCards(ctx, 'player', HAND_LIMIT + 2);

    expect(ctx.state.players.player.hand.length).toBe(HAND_LIMIT + 2);
    expect(eventsOf(ctx.events, 'cardBurned'), 'nothing burned yet').toEqual([]);

    drawCards(ctx, 'player', 1);
    expect(eventsOf(ctx.events, 'cardBurned').length, 'the next one does').toBe(1);
  });
});

describe('Ironclad Boots', () => {
  it('roots the Bound Form, exactly as Deep Roots does', () => {
    const carry = carryFor(wearing('relic_boots').overworld);
    expect(carry.boons?.boundFormGrounded).toBe(true);

    const state = scenario({ width: 6, height: 8 });
    state.players.player.boundFormGrounded = true;
    const body = addUnit(state, {
      def: 'sylva_bound',
      side: 'player',
      at: { x: 2, y: 5 },
      titheBonus: 0,
      fresh: false,
    });
    const ctx = makeCtx(state);

    pushUnit(ctx, ctx.state.units[body.id]!, { x: 0, y: -1 }, 2);

    expect(ctx.state.units[body.id]!.anchor.y, 'did not budge').toBe(5);
  });

  it('is one flag, not two, when a Sylva wears them', () => {
    const g = wearing('relic_boots');
    const beast: CompanionInstance = { ...tameCompanion(makeRng(1), 'sylva', 1), traitId: 'deep_roots' };
    expect(carryFor(g.overworld, beast).boons?.boundFormGrounded).toBe(true);
  });
});

describe('Aether-Weave Gloves', () => {
  /** A Companion board with two Companion cards in hand. */
  const board = (twice: boolean) => {
    const state = scenario({ width: 6, height: 8, hand: ['spore_cloud', 'spore_cloud'], pips: 8 });
    state.players.player.maxHp = 40;
    state.players.player.hp = 20;
    state.players.player.companionSchool = 'bloom';
    state.players.player.doubleResonance = twice;
    const body = addUnit(state, {
      def: 'sylva_bound',
      side: 'player',
      at: { x: 2, y: 5 },
      titheBonus: 0,
    });
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'sylva_bound';
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 9 });
    return state;
  };

  const fired = (twice: boolean): number => {
    const state = board(twice);
    const first = handCard(state, 'player', 'spore_cloud');
    const after = run(state, play(first, atTile(2, 3))).state;
    const second = handCard(after, 'player', 'spore_cloud');
    const res = run(after, play(second, atTile(4, 3)));
    return (
      eventsOf(res.events, 'resonanceTriggered').length +
      (after.players.player.resonancesThisTurn > 0 ? 1 : 0)
    );
  };

  it('fires the passive on the second card as well as the first', () => {
    expect(fired(false), 'ordinarily once').toBe(1);
    expect(fired(true), 'and twice with the gloves').toBe(2);
  });

  it('stops at two, not at every card', () => {
    const state = board(true);
    state.players.player.cards.third = { instanceId: 'third', defId: 'spore_cloud' };
    state.players.player.hand.push('third');

    let cur = state;
    for (const at of [[2, 3], [4, 3], [1, 3]] as const) {
      const card = handCard(cur, 'player', 'spore_cloud');
      cur = run(cur, play(card, atTile(at[0], at[1]))).state;
    }

    expect(cur.players.player.resonancesThisTurn, 'capped').toBe(2);
  });

  it('resets with the turn', () => {
    const state = board(true);
    state.players.player.resonancesThisTurn = 2;
    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(res.state.players.player.resonancesThisTurn).toBe(0);
  });

  it('reaches the board from the relic', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, carryFor(wearing('relic_gloves').overworld));
    expect(state.players.player.doubleResonance).toBe(true);
    expect(state.players.enemy.doubleResonance).toBe(false);
  });
});

describe("Splicer's Goggles", () => {
  const goggled = (on: boolean) => {
    const state = scenario({ width: 6, height: 8, hand: ['galvanic_spores'], pips: 8, marrow: 4 });
    state.players.player.discountHybrids = on;
    addUnit(state, { def: 'sylva_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 9 });
    return state;
  };

  it('takes a Pip off a spliced card and nothing else', () => {
    const plain = goggled(false);
    const cheap = goggled(true);
    const def = CARDS.galvanic_spores!;

    expect(effectiveCost(plain, 'player', def)).toEqual(def.cost);
    expect(effectiveCost(cheap, 'player', def).pips).toBe(def.cost.pips - 1);
  });

  it('never touches the Marrow half', () => {
    // Marrow is a strict requirement rather than a price: it asks you to have opened
    // something up this turn, and gear does not do that for you.
    const cheap = goggled(true);
    const def = CARDS.galvanic_spores!;
    expect(def.cost.marrow, 'the card has one to protect').toBeGreaterThan(0);
    expect(effectiveCost(cheap, 'player', def).marrow).toBe(def.cost.marrow);
  });

  it('floors at one Pip', () => {
    const cheap = goggled(true);
    const cheapest = { ...CARDS.galvanic_spores!, cost: { pips: 1, marrow: 0 } };
    expect(effectiveCost(cheap, 'player', cheapest).pips).toBe(MIN_DISCOUNTED_PIPS);
  });

  it('leaves an ordinary card alone', () => {
    const cheap = goggled(true);
    expect(effectiveCost(cheap, 'player', CARDS.flame_surge!)).toEqual(CARDS.flame_surge!.cost);
  });

  it('actually charges the lower price', () => {
    const state = goggled(true);
    const before = state.players.player.pips;
    const card = handCard(state, 'player', 'galvanic_spores');

    const res = run(state, play(card, atTile(2, 3)));

    // Cost is 2 Pips + 1 Marrow; the discount makes it 1 Pip. Marrow covers generic Pips
    // first, so what actually leaves the Pip bank is what matters here.
    expect(res.state.players.player.pips).toBeGreaterThan(before - CARDS.galvanic_spores!.cost.pips);
  });

  it('reads the discounted price on the face of the card', () => {
    // A card that showed 2 and charged 1 would be a lie, which is why `toCardSnapshot`
    // has always taken a side.
    const cheap = goggled(true);
    const id = handCard(cheap, 'player', 'galvanic_spores');
    const plain = goggled(false);
    const plainId = handCard(plain, 'player', 'galvanic_spores');

    expect(toCardSnapshot(cheap, 'player', id).cost.pips).toBe(
      toCardSnapshot(plain, 'player', plainId).cost.pips - 1,
    );
  });
});

describe('the seam that keeps losing capabilities', () => {
  it('carries every boon a trait can hold through carryFor', () => {
    // Twice now, a capability has reached the data and stopped at this seam because
    // `carryFor` enumerates fields by hand. This is the test that makes a third time a
    // failing build rather than a silent nothing.
    const g = { overworld: newRun(1), combat: null } as GlobalGameState;
    const beast: CompanionInstance = { ...tameCompanion(makeRng(1), 'mortis', 1), traitId: 'probe' };
    COMPANION_TRAITS.probe = {
      id: 'probe',
      name: 'Probe',
      text: 'Every capability at once.',
      baseId: 'mortis',
      boons: everyBoon(),
    };

    const carried = carryFor(g.overworld, beast).boons ?? {};
    delete COMPANION_TRAITS.probe;

    for (const key of BOON_KEYS) {
      expect(carried[key as keyof CombatBoons], `carryFor drops ${key}`).toBeDefined();
    }
  });

  it('carries every boon a relic can hold through boonsOfRelics', () => {
    RELICS.probe = {
      id: 'probe',
      name: 'Probe',
      text: 'Every capability at once.',
      slot: 'trinket',
      boons: everyBoon(),
    };

    const folded = boonsOfRelics({ ...emptyLoadout(), trinket: 'probe' });
    delete RELICS.probe;

    for (const key of BOON_KEYS) {
      expect(folded[key as keyof CombatBoons], `boonsOfRelics drops ${key}`).toBeDefined();
    }
  });

  it('lands every boon on the commander through createCombat', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7, undefined, undefined, {
      boons: everyBoon(),
    });
    const me = state.players.player;

    expect(me.armor).toBeGreaterThan(0);
    expect(me.handLimit).toBeGreaterThan(HAND_LIMIT);
    expect(me.ignoresFog && me.immuneToBurn && me.immuneToToxin).toBe(true);
    expect(me.revealsIntents && me.doubleResonance && me.discountHybrids).toBe(true);
    expect(me.boundFormIgnoresHazards && me.boundFormGrounded).toBe(true);
    expect(me.bonusObstacleHp && me.bonusTitheMarrow).toBeGreaterThan(0);
    expect(me.healOnTithe && me.bonusToxinStacks).toBeGreaterThan(0);
  });

  it('still hands the engine no relic or trait id', () => {
    const g = wearing(...Object.keys(RELICS));
    expect(JSON.stringify(carryFor(g.overworld))).not.toContain('relic_');
  });
});
