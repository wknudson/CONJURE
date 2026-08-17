import { describe, expect, it } from 'vitest';
import { atTile, atUnit, eventsOf, findUnit, giveCard, handCard, play, run, scenario } from './scenario.js';
import { coordKey } from '../contract/ids.js';
import { hasLoS } from '../core/engine/los.js';
import { CHILL_TO_FREEZE } from '../core/engine/status.js';
import { BRITTLE_BONUS } from '../core/engine/damage.js';
import { REACTIONS, findReaction } from '../core/data/reactions.js';
import { canAttack, canMove } from '../core/engine/movement.js';

describe('Chill and Freeze', () => {
  it('freezes a unit solid on the third stack instead of stacking further', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 } }],
      hand: ['glacial_spike', 'glacial_spike', 'glacial_spike'],
      pips: 12,
    });
    const foe = findUnit(state, 'scout_imp', 'enemy');

    let cur = state;
    for (let i = 0; i < CHILL_TO_FREEZE; i++) {
      const card = handCard(cur, 'player', 'glacial_spike');
      const alive = cur.units[foe.id];
      if (!alive) break;
      cur = run(cur, play(card, atUnit(foe.id))).state;
    }

    const frozen = cur.units[foe.id];
    if (frozen) {
      expect(frozen.statuses.freeze ?? 0).toBeGreaterThan(0);
      expect(frozen.statuses.chill ?? 0).toBeLessThan(CHILL_TO_FREEZE);
    }
  });

  it('stops a frozen unit moving and attacking', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } },
      ],
    });
    const mine = findUnit(state, 'scout_imp', 'player');
    state.units[mine.id]!.statuses.freeze = 1;

    expect(canMove(state.units[mine.id]!)).toBe(false);
    expect(canAttack(state.units[mine.id]!)).toBe(false);
  });

  it('thaws after a turn', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
    });
    const mine = findUnit(state, 'scout_imp', 'player');
    state.units[mine.id]!.statuses.freeze = 1;

    const after = run(state, { type: 'endTurn' }, { type: 'endTurn' }).state;
    expect(after.units[mine.id]!.statuses.freeze ?? 0).toBe(0);
  });
});

describe('Brittle', () => {
  it('adds flat damage to every hit that lands', () => {
    const base = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, atk: 3 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 20, keywords: [] },
      ],
    });
    const attacker = findUnit(base, 'scout_imp', 'player');
    const target = findUnit(base, 'grave_sentinel', 'enemy');
    const strike = { type: 'attack' as const, attacker: attacker.id, target: { kind: 'unit' as const, id: target.id } };

    const plain = run(base, strike).state.units[target.id]!.hp;

    const brittle = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, atk: 3 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 20, keywords: [] },
      ],
    });
    brittle.units[findUnit(brittle, 'grave_sentinel', 'enemy').id]!.statuses.brittle = 2;
    const brittled = run(brittle, strike).state.units[target.id]!.hp;

    expect(plain - brittled).toBe(BRITTLE_BONUS);
  });

  it('does not amplify armor-bypassing true damage', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 9 }],
    });
    const unit = findUnit(state, 'scout_imp', 'player');
    state.units[unit.id]!.statuses.brittle = 2;
    state.units[unit.id]!.statuses.toxin = 1;

    // Toxin ticks for 1 true damage; Brittle must not turn that into 3.
    const after = run(state, { type: 'endTurn' }, { type: 'endTurn' }).state;
    expect(after.units[unit.id]!.hp).toBe(8);
  });
});

describe('Vaporize', () => {
  it('turns a Chilled target into fog that blocks ranged sight', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, keywords: [] }],
      hand: ['flame_surge'],
      pips: 8,
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');
    state.units[foe.id]!.statuses.chill = 2;

    expect(hasLoS(state, { x: 2, y: 5 }, { x: 2, y: 0 })).toBe(true);

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), {
        kind: 'line',
        from: { x: 2, y: 2 },
        dir: { x: 0, y: -1 },
      }),
    );

    const fired = eventsOf(res.events, 'reactionTriggered');
    expect(fired.map((e) => e.reaction)).toContain('vaporize');
    expect(res.state.hazards[coordKey({ x: 2, y: 2 })]?.kind).toBe('steam_fog');
    // The cloud now occludes the lane it was made in.
    expect(hasLoS(res.state, { x: 2, y: 5 }, { x: 2, y: 0 })).toBe(false);
    // And the Chill was spent making it.
    expect(res.state.units[foe.id]?.statuses.chill ?? 0).toBe(0);
  });

  it('expires after its stated duration', () => {
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, keywords: [] }],
      hand: ['flame_surge'],
      pips: 8,
    });
    state.units[findUnit(state, 'grave_sentinel', 'enemy').id]!.statuses.chill = 2;

    let cur = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), {
        kind: 'line',
        from: { x: 2, y: 2 },
        dir: { x: 0, y: -1 },
      }),
    ).state;
    expect(Object.keys(cur.hazards)).toHaveLength(1);

    // Two of the owner's turns must pass before it clears.
    for (let i = 0; i < 3; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }
    expect(Object.keys(cur.hazards)).toHaveLength(0);
  });
});

describe('Shatter', () => {
  it('strips all armor and splashes the neighbours', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 3 }, atk: 2 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, armor: 6, keywords: [] },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 9 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const frozen = findUnit(state, 'grave_sentinel', 'enemy');
    const bystander = Object.values(state.units).find(
      (u) => u.side === 'enemy' && u.anchor.x === 3,
    )!;
    state.units[frozen.id]!.statuses.freeze = 1;

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: frozen.id },
    });

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('shatter');
    expect(res.state.units[frozen.id]!.armor).toBe(0);
    expect(res.state.units[frozen.id]!.statuses.freeze ?? 0).toBe(0);
    // 4 shrapnel to the unit standing beside it.
    expect(res.state.units[bystander.id]!.hp).toBe(9 - 4);
  });

  it('is not set off by a spell', () => {
    // Module 1 pairs Shatter with Bulwark: it takes a physical blow, not a fireball.
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, keywords: [] }],
      hand: ['flame_surge'],
      pips: 8,
    });
    state.units[findUnit(state, 'grave_sentinel', 'enemy').id]!.statuses.freeze = 1;

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), {
        kind: 'line',
        from: { x: 2, y: 2 },
        dir: { x: 0, y: -1 },
      }),
    );
    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).not.toContain('shatter');
  });

  it('fires when a frozen unit is shoved into a wall', () => {
    // Collisions deal impact damage, so the shove itself breaks the ice.
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 }, hp: 20, armor: 5, keywords: [] }],
      hand: ['shield_bash'],
      pips: 8,
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');
    state.units[foe.id]!.statuses.freeze = 1;

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(foe.id)));

    expect(eventsOf(res.events, 'collision').length).toBeGreaterThan(0);
    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('shatter');
    expect(res.state.units[foe.id]!.armor).toBe(0);
  });
});

describe('armor gating', () => {
  it('does not fire a reaction when armor absorbs the whole hit', () => {
    // Same rule as runes: a blow that never reaches health changes nothing.
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, armor: 30, keywords: [] }],
      hand: ['flame_surge'],
      pips: 8,
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');
    state.units[foe.id]!.statuses.chill = 2;

    const res = run(
      state,
      play(handCard(state, 'player', 'flame_surge'), {
        kind: 'line',
        from: { x: 2, y: 2 },
        dir: { x: 0, y: -1 },
      }),
    );

    expect(eventsOf(res.events, 'reactionTriggered')).toHaveLength(0);
    expect(Object.keys(res.state.hazards)).toHaveLength(0);
  });
});

describe('reaction table', () => {
  it('matches on damage school and required status', () => {
    expect(findReaction('fire', { chill: 1 })?.id).toBe('vaporize');
    expect(findReaction('physical', { freeze: 1 })?.id).toBe('shatter');
    expect(findReaction('impact', { freeze: 1 })?.id).toBe('shatter');
    expect(findReaction('fire', { toxin: 3 })?.id).toBe('wildfire');
    expect(findReaction('fire', {})).toBeUndefined();
    expect(findReaction('frost', { chill: 1 })).toBeUndefined();
  });

  it('gives every reaction the text the help panel needs', () => {
    for (const r of REACTIONS) {
      expect(r.text.length, `${r.id} needs explaining`).toBeGreaterThan(20);
      expect(r.triggers.length).toBeGreaterThan(0);
    }
  });
});

describe('Frost cards', () => {
  it('raises an ice wall that blocks both movement and sight', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
      hand: ['ice_barricade'],
      pips: 8,
    });

    const res = run(state, play(handCard(state, 'player', 'ice_barricade'), atTile(2, 2)));
    const wall = Object.values(res.state.obstacles)[0];

    expect(wall?.name).toBe('Ice Barricade');
    expect(wall?.cover).toBeUndefined();
    expect(hasLoS(res.state, { x: 2, y: 4 }, { x: 2, y: 0 })).toBe(false);
  });
});

describe('reaction pip refunds', () => {
  /** A board where one Flame Surge into a Chilled target vaporizes. */
  function vaporizeSetup(pips = 8) {
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 20, keywords: [] }],
      hand: ['flame_surge', 'flame_surge', 'flame_surge'],
      pips,
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');
    state.units[foe.id]!.statuses.chill = 2;
    return { state, foe };
  }

  const surgeAt = (from: { x: number; y: number }) => ({
    kind: 'line' as const,
    from,
    dir: { x: 0 as number, y: -1 as number },
  });

  it('pays a pip back for landing one', () => {
    // Reactions take real setup — a status applied on an earlier turn, then the right
    // element into it. Refunding part of the cost is what makes that worth planning.
    const { state } = vaporizeSetup();
    const before = state.players.player.pips;
    const cost = 2; // Flame Surge

    const res = run(state, play(handCard(state, 'player', 'flame_surge'), surgeAt({ x: 2, y: 2 })));

    expect(eventsOf(res.events, 'reactionTriggered').length).toBeGreaterThan(0);
    expect(res.state.players.player.pips).toBe(before - cost + 1);
    expect(res.state.players.player.reactionPipsThisTurn).toBe(1);
  });

  it('stops paying after two in one turn, so a cascade cannot fund itself', () => {
    let cur = vaporizeSetup(20).state;
    const foe = findUnit(cur, 'grave_sentinel', 'enemy');
    const spend: number[] = [];

    // Three separate reactions in one turn; only the first two are paid for.
    for (let i = 0; i < 3; i++) {
      const alive = cur.units[foe.id];
      if (!alive) break;
      alive.statuses.chill = 2;
      alive.hp = 20;
      const before = cur.players.player.pips;
      const res = run(cur, play(handCard(cur, 'player', 'flame_surge'), surgeAt({ x: 2, y: 2 })));
      expect(eventsOf(res.events, 'reactionTriggered').length, `reaction ${i + 1}`).toBeGreaterThan(0);
      spend.push(before - res.state.players.player.pips);
      cur = res.state;
    }

    // Flame Surge costs 2: the refunded casts net 1, the third pays full freight.
    expect(spend).toEqual([1, 1, 2]);
    expect(cur.players.player.reactionPipsThisTurn).toBe(2);
  });

  it('resets the allowance each turn', () => {
    const { state } = vaporizeSetup();
    const after = run(state, play(handCard(state, 'player', 'flame_surge'), surgeAt({ x: 2, y: 2 })));
    expect(after.state.players.player.reactionPipsThisTurn).toBe(1);

    const cycled = run(after.state, { type: 'endTurn' }, { type: 'endTurn' });
    expect(cycled.state.players.player.reactionPipsThisTurn).toBe(0);
  });

  it('credits the side that caused it, not the side that suffered it', () => {
    // The enemy sets off a reaction on its own turn: the enemy is paid, not the player.
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 2 }, hp: 20, keywords: [] }],
      hand: [],
    });
    const victim = findUnit(state, 'grave_sentinel', 'player');
    state.units[victim.id]!.statuses.chill = 2;

    const enemy = state.players.enemy;
    const card = giveCard(state, 'enemy', 'flame_surge');
    enemy.pips = 8;
    state.activeSide = 'enemy';
    const before = enemy.pips;

    const res = run(state, play(card, surgeAt({ x: 2, y: 2 })));

    expect(eventsOf(res.events, 'reactionTriggered').length).toBeGreaterThan(0);
    expect(res.state.players.enemy.pips).toBe(before - 2 + 1);
    expect(res.state.players.player.reactionPipsThisTurn).toBe(0);
  });
});
