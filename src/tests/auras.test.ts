import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, handCard, play, run, scenario } from './scenario.js';
import {
  ALL_AURAS,
  AURAS,
  AURA_LAST_PAYING_STACK,
  AURA_MAX_STACKS,
  auraDef,
} from '../core/data/auras.js';
import {
  attachAura,
  climaxTraitOf,
  growthCapFor,
  isClimaxed,
  removeAura,
  GROWTH_CAP,
  GROWTH_CAP_BEHEMOTH,
} from '../core/engine/growth.js';
import { applyCommand } from '../core/engine/engine.js';
import type { GameState } from '../core/types/state.js';
import { makeCtx } from '../core/engine/context.js';
import { checkInvariants } from './replay.js';
import { CARDS } from '../core/data/cards/index.js';
import type { CardDef, EffectNode } from '../core/types/cards.js';
import { legalCardTargets } from '../core/engine/targeting.js';

/**
 * Elemental Auras — the Rule of 3.
 *
 * Three properties carry the mechanic and get the most attention below. Growth **stops
 * dead at three stacks**; the Dusk upkeep is a **recurring toll that can kill its host**;
 * and replacing an Aura **hands back everything the old one paid**, without which
 * stacking one school and recasting another would be a way to wear both.
 */

/** Puts an Aura on a unit outside a card, so the system can be tested without content. */
function enchant(state: GameState, unitId: string, auraId: string): void {
  const ctx = makeCtx(state);
  attachAura(ctx, state.units[unitId]!, auraId);
}

/** A board where nothing else can end the fight while an Aura grows. */
function quiet() {
  return scenario({ width: 6, height: 8, playerHp: 5000, enemyHp: 5000, marrow: 0 });
}

/** One full round: our turn ends, theirs ends, our start-of-turn fires. */
function round(state: GameState): GameState {
  return run(state, { type: 'endTurn' }, { type: 'endTurn' }).state;
}

/** What one stack of an Aura pays, read off the data rather than restated in each test. */
const PER_STACK_ATK = AURAS.aura_conflagration!.passiveStat.atk!;
const PER_STACK_HP = AURAS.aura_overgrowth!.passiveStat.maxHp!;
/** The wound the Dusk siphon takes each turn. */
const SIPHON_BLEED = AURAS.aura_marrow_siphon!.upkeep!.selfDamage!;

describe('the registry', () => {
  it('ships one Aura for each of the five launch schools', () => {
    const schools = ALL_AURAS.map((a) => a.school).sort();
    expect(schools).toEqual(['bloom', 'bulwark', 'dusk', 'pyre', 'surge']);
  });

  it('caps every Aura at three, because that is the name of the mechanic', () => {
    for (const a of ALL_AURAS) expect(a.maxStacks, a.defId).toBe(AURA_MAX_STACKS);
    expect(AURA_MAX_STACKS).toBe(3);
  });

  it('gives every Aura a Climax trait, and no two share one', () => {
    const traits = ALL_AURAS.map((a) => a.climaxTrait);
    expect(traits.every(Boolean)).toBe(true);
    expect(new Set(traits).size, 'two schools cannot climax into the same thing').toBe(traits.length);
  });

  it('keys every entry by its own defId', () => {
    for (const [key, def] of Object.entries(AURAS)) expect(def.defId, key).toBe(key);
  });
});

describe('attaching', () => {
  it('lands at one stack and pays that stack immediately', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const atkBefore = state.units[u.id]!.atk;

    enchant(state, u.id, 'aura_conflagration');

    expect(state.units[u.id]!.aura).toEqual({ defId: 'aura_conflagration', stacks: 1 });
    expect(state.units[u.id]!.atk).toBe(atkBefore + PER_STACK_ATK);
  });

  it('refuses a Bound Form outright', () => {
    // The Pact's body does not grow, on any clock.
    const state = quiet();
    const bound = addUnit(state, {
      def: 'vanguard_footman',
      side: 'player',
      at: { x: 2, y: 6 },
      keywords: ['BoundForm'],
      fresh: false,
    });

    enchant(state, bound.id, 'aura_conflagration');

    expect(state.units[bound.id]!.aura).toBeUndefined();
  });

  it('ignores an Aura id it has never heard of', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_not_a_real_thing');
    expect(state.units[u.id]!.aura).toBeUndefined();
  });
});

describe('the three-stack cap', () => {
  it('grows one stack per round and then stops for good', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');

    let cur = state;
    const seen: number[] = [state.units[u.id]!.aura!.stacks];
    for (let i = 0; i < 5; i++) {
      cur = round(cur);
      seen.push(cur.units[u.id]!.aura!.stacks);
    }

    // One, two, three — and then three forever, however many rounds it survives.
    expect(seen).toEqual([1, 2, 3, 3, 3, 3]);
  });

  it('pays a stat for stacks one and two, and nothing for the third', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const base = state.units[u.id]!.atk;

    enchant(state, u.id, 'aura_conflagration');
    expect(state.units[u.id]!.atk, 'stack 1').toBe(base + PER_STACK_ATK);

    const two = round(state);
    expect(two.units[u.id]!.atk, 'stack 2').toBe(base + PER_STACK_ATK * 2);

    const three = round(two);
    expect(three.units[three.units[u.id]!.id]!.aura!.stacks).toBe(3);
    // The third stack buys the Climax trait instead of a number.
    expect(three.units[u.id]!.atk, 'stack 3 pays no stat').toBe(
      base + PER_STACK_ATK * AURA_LAST_PAYING_STACK,
    );

    const four = round(three);
    expect(four.units[u.id]!.atk, 'and nothing after it').toBe(
      base + PER_STACK_ATK * AURA_LAST_PAYING_STACK,
    );
  });

  it('announces the Climax exactly once', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');

    const two = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(eventsOf(two.events, 'auraClimaxed').length, 'not at stack 2').toBe(0);

    const three = run(two.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(eventsOf(three.events, 'auraClimaxed').length).toBe(1);
    expect(eventsOf(three.events, 'auraClimaxed')[0]!.trait).toBe('conflagration');

    const four = run(three.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(eventsOf(four.events, 'auraClimaxed').length, 'and never again').toBe(0);
  });

  it('marks the host as carrying its Climax trait, and only at three', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_static_charge');

    expect(isClimaxed(state.units[u.id]!)).toBe(false);
    expect(climaxTraitOf(state.units[u.id]!)).toBeUndefined();

    const three = round(round(state));

    expect(isClimaxed(three.units[u.id]!)).toBe(true);
    expect(climaxTraitOf(three.units[u.id]!)).toBe('overload');
  });

  it('does not stack on the turn the host arrived', () => {
    // Reuses the unit's own `freshlySummoned` gate: a body that has not stood a round is
    // not growing on any clock.
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: true });
    enchant(state, u.id, 'aura_conflagration');

    const next = round(state);

    expect(next.units[u.id]!.aura!.stacks, 'still one').toBe(1);
  });
});

describe('the Dusk upkeep', () => {
  it('bleeds the host and pays Marrow every turn', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const hpBefore = state.units[u.id]!.hp;
    enchant(state, u.id, 'aura_marrow_siphon');

    const after = round(state);

    expect(after.units[u.id]!.hp).toBe(hpBefore - SIPHON_BLEED);
    expect(after.players.player.marrow).toBeGreaterThanOrEqual(1);
  });

  it('keeps charging after it has Climaxed', () => {
    // What makes Hollow dangerous: the Aura stops paying and never stops costing.
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_marrow_siphon');

    let cur = state;
    for (let i = 0; i < 4; i++) cur = round(cur);

    expect(cur.units[u.id]!.aura!.stacks).toBe(AURA_MAX_STACKS);
    expect(isClimaxed(cur.units[u.id]!)).toBe(true);
    // Four rounds, four wounds — the cap stopped the growth, not the bleeding.
    expect(cur.units[u.id]!.hp).toBe(cur.units[u.id]!.maxHp - SIPHON_BLEED * 4);
  });

  it('cuts through armor, so plate does not buy a free siphon', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    state.units[u.id]!.armor = 100;
    const hpBefore = state.units[u.id]!.hp;
    enchant(state, u.id, 'aura_marrow_siphon');

    const after = round(state);

    expect(after.units[u.id]!.hp).toBe(hpBefore - SIPHON_BLEED);
    expect(after.units[u.id]!.armor, 'and the plate is untouched').toBe(100);
  });

  it('can bleed its own host to death', () => {
    const state = quiet();
    const u = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 2, y: 5 },
      hp: 10,
      fresh: false,
    });
    enchant(state, u.id, 'aura_marrow_siphon');

    const after = round(state);

    expect(after.units[u.id]).toBeUndefined();
    expect(checkInvariants(after, 'after a fatal siphon')).toEqual([]);
  });

  it('charges the toll before taking the stack, so a fatal turn grants nothing', () => {
    const state = quiet();
    const u = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 2, y: 5 },
      hp: 10,
      fresh: false,
    });
    enchant(state, u.id, 'aura_marrow_siphon');

    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.units[u.id]).toBeUndefined();
    expect(eventsOf(res.events, 'auraStacked').length, 'a corpse takes no stack').toBe(0);
  });

  it('is the only Aura that charges one', () => {
    const withUpkeep = ALL_AURAS.filter((a) => a.upkeep);
    expect(withUpkeep.map((a) => a.defId)).toEqual(['aura_marrow_siphon']);
  });
});

describe('replacement hands back what the old Aura paid', () => {
  it('strips the outgoing stats before the new Aura lands', () => {
    // Without this, growing Pyre to three and then casting Bloom keeps the ATK and adds
    // the health — a way to wear every Aura at once for the price of the last one.
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const baseAtk = state.units[u.id]!.atk;
    const baseHp = state.units[u.id]!.maxHp;

    enchant(state, u.id, 'aura_conflagration');
    const grown = round(round(state));
    expect(grown.units[u.id]!.atk).toBe(baseAtk + PER_STACK_ATK * AURA_LAST_PAYING_STACK);

    enchant(grown, u.id, 'aura_overgrowth');

    expect(grown.units[u.id]!.atk, 'the fire is given back in full').toBe(baseAtk);
    expect(grown.units[u.id]!.maxHp, 'and the vines pay their first stack').toBe(
      baseHp + PER_STACK_HP,
    );
    expect(grown.units[u.id]!.aura).toEqual({ defId: 'aura_overgrowth', stacks: 1 });
  });

  it('resets the clock to one stack', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');
    const grown = round(round(state));
    expect(grown.units[u.id]!.aura!.stacks).toBe(AURA_MAX_STACKS);

    enchant(grown, u.id, 'aura_conflagration');

    expect(grown.units[u.id]!.aura!.stacks).toBe(1);
    expect(isClimaxed(grown.units[u.id]!), 'and it is no longer climaxed').toBe(false);
  });

  it('never leaves a wounded body above its own ceiling', () => {
    // Dropping a maxHp Aura has to clamp, or the unit reads as overhealed forever.
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_overgrowth');
    const grown = round(state);

    removeAura(grown.units[u.id]!);

    const body = grown.units[u.id]!;
    expect(body.hp).toBeLessThanOrEqual(body.maxHp);
    expect(body.hp).toBeGreaterThan(0);
  });

  it('gives everything back when the Aura is simply removed', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const baseArmor = state.units[u.id]!.armor;
    enchant(state, u.id, 'aura_petrifying_mantle');
    const grown = round(round(state));
    expect(grown.units[u.id]!.armor).toBe(
      baseArmor + AURAS.aura_petrifying_mantle!.passiveStat.armor! * AURA_LAST_PAYING_STACK,
    );

    const spent = removeAura(grown.units[u.id]!);

    expect(spent).toBe('aura_petrifying_mantle');
    expect(grown.units[u.id]!.aura).toBeUndefined();
    expect(grown.units[u.id]!.armor).toBe(baseArmor);
  });
});

describe('the Growth split', () => {
  it('gives a Behemoth a finite, serialisable ceiling', () => {
    expect(growthCapFor(2)).toBe(GROWTH_CAP_BEHEMOTH);
    expect(growthCapFor(1)).toBe(GROWTH_CAP);
    expect(Number.isFinite(growthCapFor(2))).toBe(true);
    // The actual bug: `Infinity` does not survive JSON, so a saved fight lost the ceiling.
    expect(JSON.parse(JSON.stringify({ c: growthCapFor(2) })).c).toBe(GROWTH_CAP_BEHEMOTH);
  });

  it('never writes Infinity into a spawned unit', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'magma_brute', side: 'enemy', at: { x: 2, y: 1 } });
    expect(Number.isFinite(state.units[u.id]!.escalationCap)).toBe(true);
  });

  it('leaves a player unit without an Aura completely static', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const before = { atk: state.units[u.id]!.atk, hp: state.units[u.id]!.maxHp };

    let cur = state;
    for (let i = 0; i < 4; i++) cur = round(cur);

    expect(cur.units[u.id]!.atk).toBe(before.atk);
    expect(cur.units[u.id]!.maxHp).toBe(before.hp);
    expect(cur.units[u.id]!.escalation).toBe(0);
  });
});

describe('the snapshot the renderer reads', () => {
  it('carries the Aura and whether it has climaxed', () => {
    const state = quiet();
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');

    const climaxed = round(round(state));
    const res = applyCommand(climaxed, { type: 'endTurn' });
    const snap = res.state.units[u.id]!;

    // The engine's own view, not the live unit: events embed snapshots, so this is what
    // the renderer will actually be handed.
    expect(snap.aura).toEqual({ defId: 'aura_conflagration', stacks: AURA_MAX_STACKS });
    expect(auraDef(snap.aura!.defId)!.name).toBe('Conflagration');
  });
});

// ---------------------------------------------------------------- the card ops

/**
 * The ops as a card actually reaches them.
 *
 * Everything above drives `attachAura` directly, which proves the system but not the
 * wiring. These go through `playCard` -> targeting -> `executeEffect`, which is the path
 * a real Detonation card will take.
 */
describe('attachAura and detonateAura as card ops', () => {
  const ALLY_TARGET = {
    kind: 'entity' as const,
    side: 'ally' as const,
    includeObstacles: false,
  };

  function opCard(id: string, effect: EffectNode, target: CardDef['target']): string {
    CARDS[id] = {
      id,
      name: id,
      cost: { pips: 0, marrow: 0 },
      school: 'arcane',
      source: 'hero',
      kind: 'spell',
      text: '',
      target,
      effect,
      keywords: [],
    };
    return id;
  }

  it('hangs an Aura through a played card', () => {
    opCard('probe_attach_aura', { op: 'attachAura', aura: 'aura_conflagration' }, ALLY_TARGET);
    const state = scenario({ width: 6, height: 8, hand: ['probe_attach_aura'], pips: 4 });
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });

    const card = handCard(state, 'player', 'probe_attach_aura');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: u.id } }));

    expect(res.state.units[u.id]!.aura!.defId).toBe('aura_conflagration');
    expect(eventsOf(res.events, 'auraAttached').length).toBe(1);
  });

  it('never offers a Bound Form as a target', () => {
    opCard('probe_attach_aura2', { op: 'attachAura', aura: 'aura_conflagration' }, ALLY_TARGET);
    const state = scenario({ width: 6, height: 8, playerHp: 400 });
    const bound = addUnit(state, {
      def: 'vanguard_footman',
      side: 'player',
      at: { x: 2, y: 6 },
      keywords: ['BoundForm'],
      fresh: false,
    });
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });

    const ids = legalCardTargets(state, 'player', 'probe_attach_aura2').map((t) =>
      t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : '',
    );

    expect(ids).not.toContain(bound.id);
    expect(ids.filter(Boolean).length, 'but the ordinary body is offered').toBeGreaterThan(0);
  });

  it('offers a Detonation only once the Aura has climaxed', () => {
    opCard('probe_detonate', { op: 'detonateAura' }, { ...ALLY_TARGET, requiresAura: 'climax' });
    const state = scenario({ width: 6, height: 8, hand: ['probe_detonate'], pips: 4 });
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');

    // Stack 1: the fuse is lit but not burned down.
    expect(legalCardTargets(state, 'player', 'probe_detonate').length).toBe(0);

    const climaxed = round(round(state));
    const ids = legalCardTargets(climaxed, 'player', 'probe_detonate').map((t) =>
      t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : '',
    );
    expect(ids).toContain(u.id);
  });

  it('spends the Aura and hands its stats back', () => {
    opCard('probe_detonate2', { op: 'detonateAura' }, { ...ALLY_TARGET, requiresAura: 'climax' });
    const state = scenario({ width: 6, height: 8, hand: ['probe_detonate2'], pips: 4 });
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    const baseAtk = state.units[u.id]!.atk;
    enchant(state, u.id, 'aura_conflagration');
    const climaxed = round(round(state));

    const card = handCard(climaxed, 'player', 'probe_detonate2');
    const res = run(climaxed, play(card, { kind: 'entity', ref: { kind: 'unit', id: u.id } }));

    expect(res.state.units[u.id]!.aura).toBeUndefined();
    expect(res.state.units[u.id]!.atk).toBe(baseAtk);
    expect(eventsOf(res.events, 'auraDetonated')[0]!.aura).toBe('aura_conflagration');
  });

  it('lets the burst be ordinary ops that follow it in the seq', () => {
    // The whole design of the Detonation: `detonateAura` removes, and the damage is
    // authored in the same vocabulary as every other spell.
    opCard(
      'probe_detonate_burst',
      {
        op: 'seq',
        effects: [
          { op: 'detonateAura' },
          { op: 'extractMarrow', amount: 4 },
        ],
      },
      { ...ALLY_TARGET, requiresAura: 'climax' },
    );
    const state = scenario({ width: 6, height: 8, hand: ['probe_detonate_burst'], pips: 4, marrow: 0 });
    const u = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 }, fresh: false });
    enchant(state, u.id, 'aura_conflagration');
    const climaxed = round(round(state));
    const marrowBefore = climaxed.players.player.marrow;

    const card = handCard(climaxed, 'player', 'probe_detonate_burst');
    const res = run(climaxed, play(card, { kind: 'entity', ref: { kind: 'unit', id: u.id } }));

    expect(res.state.units[u.id]!.aura).toBeUndefined();
    expect(res.state.players.player.marrow).toBe(marrowBefore + 4);
  });
});
