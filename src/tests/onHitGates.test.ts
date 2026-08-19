import { describe, expect, it } from 'vitest';
import { eventsOf, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { SPLICE_RECIPES } from '../core/data/splicing.js';
import { beginSubjugation } from '../core/engine/subjugation.js';
import { makeCtx } from '../core/engine/context.js';

/**
 * The gates on an on-hit rider.
 *
 * The rider used to live at the end of the `attack` reducer with no conditions on it at
 * all: it did not care whether the blow landed, whether the attacker was still alive to
 * have swung it, or whether the thing it was branding could carry a status meaningfully.
 * Every test here is one of those questions, and every one of them failed before the
 * gates went in.
 */

/** A Plague-Bearer: `onHit: { status: 'toxin', stacks: 1 }`. The only toxin rider shipped. */
const BEARER = 'plague_bearer';

function toxinOn(state: ReturnType<typeof scenario>, id: string): number {
  return state.units[id]?.statuses.toxin ?? 0;
}

describe('a rider needs a wound', () => {
  it('does not poison through armor that soaked the whole blow', () => {
    // Armor that stops the hit stops what rode in on it. This is the same `hpLoss` test
    // runes and three of the five reactions already used; the rider was the one secondary
    // effect in the engine that ignored it.
    const state = scenario({
      units: [
        { def: BEARER, side: 'player', at: { x: 1, y: 1 }, atk: 2 },
        { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 1 }, armor: 9 },
      ],
    });
    const [bearer, victim] = Object.values(state.units);

    const out = run(state, {
      type: 'attack',
      attacker: bearer!.id,
      target: { kind: 'unit', id: victim!.id },
    });

    expect(out.state.units[victim!.id]!.hp).toBe(victim!.hp);
    expect(toxinOn(out.state, victim!.id), 'armor stopped the blow but not the venom').toBe(0);
  });

  it('still poisons when even one point gets through', () => {
    // The gate is `hpLoss > 0`, not "unarmored" — a blow that mostly bounces still bites.
    const state = scenario({
      units: [
        { def: BEARER, side: 'player', at: { x: 1, y: 1 }, atk: 3 },
        { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 1 }, armor: 2 },
      ],
    });
    const [bearer, victim] = Object.values(state.units);

    const out = run(state, {
      type: 'attack',
      attacker: bearer!.id,
      target: { kind: 'unit', id: victim!.id },
    });

    expect(out.state.units[victim!.id]!.hp).toBe(victim!.hp - 1);
    expect(toxinOn(out.state, victim!.id)).toBe(1);
  });
});

describe('a rider needs a living arm behind it', () => {
  it('does not brand the thing that killed it mid-swing', () => {
    // The bug this replaces: `attack()` captured the attacker *before* dealing damage,
    // and `killEntity` removes a unit from the map without mutating the object a caller
    // is still holding. A Counter that killed the attacker left the rider reading a
    // corpse's intentions, and the corpse poisoned the thing that killed it.
    const state = scenario({
      units: [
        { def: BEARER, side: 'player', at: { x: 1, y: 1 }, hp: 1, atk: 1 },
        {
          def: 'grave_sentinel',
          side: 'enemy',
          at: { x: 2, y: 1 },
          hp: 20,
          atk: 9,
          keywords: ['Counter'],
        },
      ],
    });
    const [bearer, sentinel] = Object.values(state.units);

    const out = run(state, {
      type: 'attack',
      attacker: bearer!.id,
      target: { kind: 'unit', id: sentinel!.id },
    });

    // The riposte killed the attacker.
    expect(out.state.units[bearer!.id], 'the bearer should be dead').toBeUndefined();
    expect(toxinOn(out.state, sentinel!.id), 'poisoned from beyond the grave').toBe(0);
  });
});

describe('a rider needs a body that can hold it', () => {
  it('does not mark a Bound Form', () => {
    // A Bound Form keeps no health of its own, so a damaging status on it is not an
    // affliction of the body at all: every tick is redirected to the Pact. Left in, this
    // was the only route in the game from a melee swing to poisoning a portrait.
    const state = scenario({
      units: [
        { def: BEARER, side: 'player', at: { x: 1, y: 1 }, atk: 2 },
        {
          def: 'ignis_bound',
          side: 'enemy',
          at: { x: 2, y: 1 },
          keywords: ['BoundForm'],
        },
      ],
    });
    const [bearer, body] = Object.values(state.units);

    const before = state.players.enemy.hp;
    const out = run(state, {
      type: 'attack',
      attacker: bearer!.id,
      target: { kind: 'unit', id: body!.id },
    });

    // The blow itself still lands on the Pact — that part is the Bound Form working.
    expect(out.state.players.enemy.hp).toBeLessThan(before);
    expect(toxinOn(out.state, body!.id), 'a rider must not become portrait poison').toBe(0);
  });

  it('does not mark a sealed Alpha', () => {
    // The seal is the point at which damage has stopped being the answer. Branding
    // something the damage pipeline refuses to touch produced `statusTicked` events
    // carrying numbers that were swallowed on arrival — the pipeline visibly reporting
    // damage that never happened.
    //
    // This asserts the *behaviour*, not one line of it. `applyOnHit` does carry an
    // explicit `isSealed` gate, but deleting that gate leaves this test green: a sealed
    // target reports zero `hpLoss`, so the wound gate already turned the rider away. The
    // seal check is deliberate redundancy rather than the thing under test here, and this
    // comment exists so nobody reads a passing test as proof that it fires.
    const state = scenario({
      units: [
        { def: BEARER, side: 'player', at: { x: 1, y: 1 }, atk: 2 },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 30 },
      ],
    });
    const [bearer, alpha] = Object.values(state.units);

    // Seal it the way the protocol does, by hand: aetherPlated on an enemy body with the
    // subjugation live is what `isSealed` reads.
    state.players.enemy.companionUnitId = alpha!.id;
    const ctx = makeCtx(state);
    beginSubjugation(ctx);
    expect(ctx.state.encounter.subjugation.sealed).toBe(true);

    const out = run(ctx.state, {
      type: 'attack',
      attacker: bearer!.id,
      target: { kind: 'unit', id: alpha!.id },
    });

    expect(out.state.units[alpha!.id]!.hp, 'the seal holds').toBe(alpha!.hp);
    expect(toxinOn(out.state, alpha!.id), 'branded a body damage cannot reach').toBe(0);
  });
});

describe('the rider still works where it should', () => {
  it('brands an ordinary survivor, and the charge rider too', () => {
    // The gates are conditions, not an off switch. A Bombardier that lands a hit still
    // leaves `charged` for fire or frost to find.
    const state = scenario({
      units: [
        { def: 'clockwork_bombardier', side: 'player', at: { x: 1, y: 1 }, atk: 2 },
        { def: 'vanguard_footman', side: 'enemy', at: { x: 3, y: 1 }, hp: 12 },
      ],
    });
    const [bomb, victim] = Object.values(state.units);

    const out = run(state, {
      type: 'attack',
      attacker: bomb!.id,
      target: { kind: 'unit', id: victim!.id },
    });

    expect(out.state.units[victim!.id]!.statuses.charged).toBe(1);
    expect(eventsOf(out.events, 'statusApplied').length).toBeGreaterThan(0);
  });
});

/**
 * The two hybrids that were named for reactions they could not produce.
 *
 * Both shipped, both wrong, and neither had a test — which is why it took a sprint to
 * notice.
 */
describe('the bench presses what it says it presses', () => {
  it('lets Vaporize Blast prime its own Vaporize', () => {
    // Frost *damage* does not chill: the engine has exactly one automatic
    // status-from-damage rule, and it is shock leaving `charged`. Without a leading
    // `applyStatus` the fire half found nothing to react with, and the card only worked
    // on a target somebody else had already chilled.
    const def = CARDS['vaporize_blast']!;
    expect(def.effect.op).toBe('seq');

    const seq = def.effect as { op: 'seq'; effects: { op: string }[] };
    expect(seq.effects[0]!.op, 'the chill must come first or it primes nothing').toBe(
      'applyStatus',
    );

    const first = seq.effects[0] as { op: 'applyStatus'; status: string; stacks: number };
    expect(first.status).toBe('chill');
    expect(first.stacks).toBeGreaterThan(0);

    // And the fire that follows is what the chill is for.
    const types = seq.effects
      .filter((e): e is { op: 'damage'; dtype: string } => e.op === 'damage')
      .map((e) => e.dtype);
    expect(types).toContain('fire');
  });

  it('names Overload Strike after the reaction it actually makes', () => {
    // Shock into fire is fire-on-charged, which is Overload. Superconduct wants a `frost`
    // trigger this card never deals.
    expect(CARDS['superconduct_strike'], 'the old id should be gone').toBeUndefined();

    const def = CARDS['overload_strike']!;
    expect(def.name).toBe('Overload Strike');

    const seq = def.effect as { op: 'seq'; effects: { op: string; dtype?: string }[] };
    const dmg = seq.effects.filter((e) => e.op === 'damage');
    expect(dmg[0]!.dtype, 'the charge lands first').toBe('shock');
    expect(dmg[1]!.dtype, 'and the flame argues with it').toBe('fire');
  });

  it('keeps the recipe pointing at a card that exists', () => {
    // A recipe naming a dead id is a bench that consumes reagents and produces nothing.
    for (const recipe of SPLICE_RECIPES) {
      expect(CARDS[recipe.resultId], `${recipe.resultId} is not a card`).toBeDefined();
    }
  });
});
