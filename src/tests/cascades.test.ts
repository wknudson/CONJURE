import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, scenario } from './scenario.js';
import { MAX_CHAIN_DEPTH, dealDamage, nextDepth, atChainLimit } from '../core/engine/damage.js';
import { REACTIONS, findReaction } from '../core/data/reactions.js';
import { REACTION_BONE_CAP, REACTION_BONE_REFUND } from '../core/engine/reactions.js';
import { makeCtx } from '../core/engine/context.js';
import { pushUnit } from '../core/engine/displacement.js';

/**
 * The last two items on the sandbox audit: the cascade ceiling, and Arc.
 */

// ============================================================ §5.5 — the chain ceiling

describe('the cascade ceiling is one budget, not the marks’ own', () => {
  it('counts a depth for every kind of secondary, not just a mark', () => {
    // The bug: `chainDepth` was written by exactly one caller and read by one, so a mark
    // detonated by a collision restarted the count at one and `MAX_CHAIN_DEPTH` bounded
    // nothing. These two helpers are the shared vocabulary that replaced that.
    expect(nextDepth({})).toBe(1);
    expect(nextDepth({ chainDepth: 3 })).toBe(4);
    expect(atChainLimit({}), 'a fresh hit is never at the limit').toBe(false);
    expect(atChainLimit({ chainDepth: MAX_CHAIN_DEPTH - 1 })).toBe(false);
    expect(atChainLimit({ chainDepth: MAX_CHAIN_DEPTH })).toBe(true);
  });

  it('still lands the damage at the ceiling — it stops spreading, not hurting', () => {
    // The courtesy `chainCancelled` already extends. A bounded chain and a cancelled one
    // have to leave the board in shapes a player can tell apart, and "the last hit
    // silently did nothing" is not one of them.
    const state = scenario({ width: 6, height: 6 });
    const victim = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 200,
    });

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: victim.id },
      amount: 40,
      dtype: 'physical',
      cause: 'spell',
      chainDepth: MAX_CHAIN_DEPTH,
    });

    expect(ctx.state.units[victim.id]!.hp).toBe(160);
  });

  it('refuses a reaction reached at the ceiling', () => {
    // Reactions were bounded by *nothing* before this: only marks counted depth, so a
    // Shatter splash could be link twenty of a chain and still fire. Note the mark path
    // cannot demonstrate the new gate — `detonate` has always had its own internal check —
    // so the reaction and Counter paths are where this rule is actually observable.
    const state = scenario({ width: 7, height: 7 });
    const frozen = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
    });
    const neighbour = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 4, y: 3 },
      hp: 200,
    });
    state.units[frozen.id]!.statuses.freeze = 1;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: frozen.id },
      amount: 20,
      dtype: 'impact',
      cause: 'collision',
      chainDepth: MAX_CHAIN_DEPTH,
    });

    expect(eventsOf(ctx.events, 'reactionTriggered'), 'Shatter must not fire').toHaveLength(0);
    expect(ctx.state.units[neighbour.id]!.hp, 'and nothing splashed').toBe(200);
    // The blow itself still landed.
    expect(ctx.state.units[frozen.id]!.hp).toBe(180);
  });

  it('fires that same reaction one link shallower', () => {
    // The inverse, so the test above is measuring the ceiling and not a broken Shatter.
    const state = scenario({ width: 7, height: 7 });
    const frozen = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
    });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 4, y: 3 }, hp: 200 });
    state.units[frozen.id]!.statuses.freeze = 1;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: frozen.id },
      amount: 20,
      dtype: 'impact',
      cause: 'collision',
      chainDepth: MAX_CHAIN_DEPTH - 1,
    });

    expect(eventsOf(ctx.events, 'reactionTriggered')).toHaveLength(1);
  });

  it('refuses a Counter reached at the ceiling', () => {
    // Counter was unbounded too. It is depth-limited to one by its own `cause` check, but
    // nothing stopped it being the link that pushed a longer chain further along.
    const state = scenario({ width: 6, height: 6 });
    const attacker = addUnit(state, {
      def: 'vanguard_footman',
      side: 'player',
      at: { x: 2, y: 2 },
      hp: 200,
    });
    const sentinel = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 200,
      atk: 50,
      keywords: ['Counter'],
    });

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: sentinel.id },
      amount: 20,
      dtype: 'physical',
      cause: 'attack',
      sourceUnitId: attacker.id,
      chainDepth: MAX_CHAIN_DEPTH,
    });

    expect(ctx.state.units[attacker.id]!.hp, 'no riposte at the ceiling').toBe(200);
  });

  it('carries the count through a shove, which is where it used to reset', () => {
    // The specific hole §5.5 named. A collision omitted `chainDepth` entirely, so whatever
    // it slammed a body into began a brand new chain at depth one — `MAX_CHAIN_DEPTH`
    // bounded mark-to-mark and nothing else. A shove issued at the ceiling must not be
    // able to launder a detonation through a wall.
    const state = scenario({ width: 6, height: 6 });
    const shoved = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 200,
      // Aligned to `impact`, so a collision actually sets it off. A Cinder Mark would
      // fizzle on an unaligned blow and the test would prove nothing.
      mark: 'rot_root_snare',
    });
    // Something solid directly behind it, so the shove is guaranteed to collide.
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 3 }, hp: 300 });

    const ctx = makeCtx(state);
    pushUnit(ctx, ctx.state.units[shoved.id]!, { x: 0, y: 1 }, 1, MAX_CHAIN_DEPTH);

    expect(
      eventsOf(ctx.events, 'markDetonated'),
      'the collision restarted the chain',
    ).toHaveLength(0);
  });

  it('detonates through that same shove when the chain is young', () => {
    const state = scenario({ width: 6, height: 6 });
    const shoved = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 200,
      mark: 'rot_root_snare',
    });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 3 }, hp: 300 });

    const ctx = makeCtx(state);
    pushUnit(ctx, ctx.state.units[shoved.id]!, { x: 0, y: 1 }, 1, 0);

    expect(eventsOf(ctx.events, 'markDetonated')).toHaveLength(1);
  });

  it('passes the count on through a reaction’s own splash', () => {
    // One link further than the gate tests above: the Shatter *fires* here, and what it
    // throws outward has to arrive already counted. Passing zero instead — which is what
    // every reaction did before — would let a splash relaunch a chain from nothing.
    const state = scenario({ width: 7, height: 7 });
    const frozen = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
    });
    const bystander = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: 4, y: 3 },
      hp: 300,
      // Impact-aligned, and Shatter splashes `impact`.
      mark: 'rot_root_snare',
    });
    state.units[frozen.id]!.statuses.freeze = 1;

    const ctx = makeCtx(state);
    // One below the ceiling: the reaction resolves, and its splash lands *at* it.
    dealDamage(ctx, {
      target: { kind: 'unit', id: frozen.id },
      amount: 20,
      dtype: 'impact',
      cause: 'collision',
      chainDepth: MAX_CHAIN_DEPTH - 1,
    });

    expect(eventsOf(ctx.events, 'reactionTriggered'), 'Shatter still fires').toHaveLength(1);
    expect(ctx.state.units[bystander.id]!.hp, 'and the splash still lands').toBeLessThan(300);
    expect(
      eventsOf(ctx.events, 'markDetonated'),
      'but the splash must not start a fresh chain',
    ).toHaveLength(0);
  });

  it('passes the count on through a death', () => {
    // A death mark restarted the count at one, hardcoded, so a chain of dying mark-holders
    // was bounded by nothing at all.
    const state = scenario({ width: 7, height: 7 });
    const doomed = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 20,
      // Fires when the host dies.
      mark: 'soul_splinter_mark',
    });
    addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 5, y: 5 }, hp: 200 });

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: doomed.id },
      amount: 90,
      dtype: 'physical',
      cause: 'spell',
      chainDepth: MAX_CHAIN_DEPTH,
    });

    expect(ctx.state.units[doomed.id], 'the body is still removed').toBeUndefined();
    expect(
      eventsOf(ctx.events, 'markDetonated'),
      'but its death mark is past the ceiling',
    ).toHaveLength(0);
  });

  it('terminates on a board built to cascade', () => {
    // The real guarantee: whatever the arrangement, the reducer returns. Four mark-holders
    // packed together so each detonation reaches the next.
    const state = scenario({ width: 7, height: 7 });
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]] as const) {
      addUnit(state, {
        def: 'scout_imp',
        side: 'enemy',
        at: { x, y },
        hp: 40,
        mark: 'cinder_mark',
      });
    }

    const first = Object.values(state.units)[0]!;
    const ctx = makeCtx(state);

    // Light the first one. Each blast reaches the others, whose marks reach back.
    dealDamage(ctx, {
      target: { kind: 'unit', id: first.id },
      amount: 30,
      dtype: 'fire',
      cause: 'spell',
    });

    // It resolved rather than hanging, and every link was inside the budget.
    const dets = eventsOf(ctx.events, 'markDetonated');
    expect(dets.length).toBeGreaterThan(0);
    for (const d of dets) expect(d.chainDepth).toBeLessThanOrEqual(MAX_CHAIN_DEPTH);
  });
});

// ============================================================ §4.4 — Arc

describe('Arc is a reaction like any other', () => {
  const arc = () => REACTIONS.find((r) => r.id === 'arc')!;

  /** A shock hit in the rain, with two bodies touching the target. */
  const storm = () => {
    const state = scenario({ width: 7, height: 7 });
    state.encounter.weather = { kind: 'rain' };
    const target = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
    });
    const near = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 4, y: 3 },
      hp: 200,
    });
    const far = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 6, y: 6 },
      hp: 200,
    });
    return { state, target, near, far };
  };

  it('is in the table, gated on the sky rather than on a status', () => {
    expect(arc()).toBeDefined();
    expect(arc().requires, 'nothing on the body to name').toBeUndefined();
    expect(arc().requiresWeather).toBe('rain');
    expect(arc().triggers).toContain('shock');
    // The rain does not run out, so there is nothing to spend.
    expect(arc().consumes).toBe(false);
  });

  it('is found by findReaction only when it is actually raining', () => {
    expect(findReaction('shock', {}, 'rain')?.id).toBe('arc');
    expect(findReaction('shock', {}, 'fog'), 'wrong sky').toBeUndefined();
    expect(findReaction('shock', {}, undefined), 'clear sky').toBeUndefined();
  });

  it('jumps to every body touching the target and no further', () => {
    const { state, target, near, far } = storm();
    const ctx = makeCtx(state);

    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    // 40, not the 30 requested: rain conducts, so `WEATHER_ELEMENTAL` adds 10 to every shock
    // hit before armour. The arc it throws is `physical` and deliberately unaffected, which
    // is why the neighbours below are unchanged.
    expect(ctx.state.units[target.id]!.hp).toBe(160);
    expect(ctx.state.units[near.id]!.hp, 'the arc').toBe(190);
    expect(ctx.state.units[far.id]!.hp, 'out of reach').toBe(200);
  });

  it('announces itself, which it never used to', () => {
    // The whole point of formalising it. `conductShock` fired silently: no event, no
    // refund, invisible to `findReaction`.
    const { state, target } = storm();
    const ctx = makeCtx(state);

    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    const fired = eventsOf(ctx.events, 'reactionTriggered').filter((e) => e.reaction === 'arc');
    expect(fired, 'no reactionTriggered').toHaveLength(1);
    expect(fired[0]!.name).toBe('Arc');
  });

  it('pays the standard refund, under the standard cap', () => {
    const { state, target } = storm();
    state.players.player.reactionBonesThisTurn = 0;
    const bonesBefore = state.players.player.bones;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    expect(ctx.state.players.player.bones).toBe(bonesBefore + REACTION_BONE_REFUND);
    expect(ctx.state.players.player.reactionBonesThisTurn).toBe(1);
    expect(eventsOf(ctx.events, 'boneRefunded')).toHaveLength(1);
  });

  it('stops paying once the turn’s cap is spent, like every other reaction', () => {
    const { state, target } = storm();
    state.players.player.reactionBonesThisTurn = REACTION_BONE_CAP;
    const bonesBefore = state.players.player.bones;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    expect(ctx.state.players.player.bones, 'a cascade must not fund itself').toBe(bonesBefore);
  });

  it('needs the hit to land, which the old special case did not', () => {
    // A real behaviour change, and the consistent one: `conductShock` ran regardless of
    // hpLoss, so a shock entirely eaten by plate still arced. Nothing else in the table
    // works that way.
    const { state, target, near } = storm();
    state.units[target.id]!.armor = 90;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    expect(ctx.state.units[target.id]!.hp, 'plate ate it').toBe(200);
    expect(ctx.state.units[near.id]!.hp, 'so nothing arced').toBe(200);
  });

  it('does not arc in clear weather', () => {
    const { state, target, near } = storm();
    state.encounter.weather = undefined;

    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    expect(ctx.state.units[near.id]!.hp).toBe(200);
  });

  it('cannot arc from an arc', () => {
    // The arcs deal `physical`, so the depth is exactly one by construction — a property
    // of the data, independent of the cascade ceiling that now also bounds it.
    const out = arc().outcome as { op: 'conduct'; dtype: string };
    expect(out.op).toBe('conduct');
    expect(out.dtype, 'shock arcs would chain across the board').not.toBe('shock');
    expect(arc().triggers).not.toContain(out.dtype);
  });

  it('still leaves the charge behind', () => {
    // Arc replaced a special case, not the shock rule: a Surge hit marks what it hits for
    // fire or frost to find later, and that is above the cascade gate because a status
    // causes nothing by itself.
    const { state, target } = storm();
    const ctx = makeCtx(state);

    dealDamage(ctx, {
      target: { kind: 'unit', id: target.id },
      amount: 30,
      dtype: 'shock',
      cause: 'spell',
    });

    expect(ctx.state.units[target.id]!.statuses.charged).toBe(1);
  });
});
