import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, scenario } from './scenario.js';
import { makeCtx } from '../core/engine/context.js';
import { summonUnit } from '../core/engine/spawn.js';
import {
  beginSubjugation,
  onAnchorDied,
  setAnchor,
  tickSubjugation,
} from '../core/engine/subjugation.js';
import { createCombat } from '../core/engine/setup.js';
import { IGNIS_TRIAL } from '../core/data/encounters/index.js';
import { CARDS } from '../core/data/cards/index.js';
import { STAT_SCALE } from '../core/scale.js';
import { SUBJUGATION_ROUNDS } from '../core/types/state.js';
import type { GameState } from '../core/types/state.js';

/**
 * The three polish items the audits left on the Harpoon Protocol, ruled and built:
 * the round count is the encounter's, a round held costs the beast nothing no longer,
 * and a snapped tether keeps half of what it had held.
 */
function sealed(rounds?: number): { state: GameState; bossId: string; anchorId: string } {
  const state = scenario({ enemyHp: 100 });
  const ctx = makeCtx(state);
  const bossId = summonUnit(ctx, 'ignis_drake_bound', 'enemy', { x: 2, y: 1 })!;
  state.players.enemy.companionUnitId = bossId;
  state.players.enemy.companionUnitDefId = 'ignis_drake_bound';
  if (rounds !== undefined) state.encounter.subjugation.rounds = rounds;
  beginSubjugation(makeCtx(state));
  const anchor = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 5 } });
  return { state, bossId, anchorId: anchor.id };
}

describe('rounds belong to the encounter', () => {
  it('defaults to SUBJUGATION_ROUNDS and takes the encounter\'s number when it names one', () => {
    const plain = createCombat(IGNIS_TRIAL, 1).state;
    expect(plain.encounter.subjugation.rounds).toBe(SUBJUGATION_ROUNDS);
    const longer = createCombat({ ...IGNIS_TRIAL, subjugationRounds: 5 }, 1).state;
    expect(longer.encounter.subjugation.rounds).toBe(5);
  });

  it('binds after exactly that many rounds, and tells the HUD the target', () => {
    const { state, anchorId } = sealed(2);
    const began = makeCtx(state);
    expect(eventsOf(began.events, 'subjugationBegan')).toHaveLength(0); // already sealed above
    const ctx = makeCtx(state);
    setAnchor(ctx, state.units[anchorId]!);
    expect(eventsOf(ctx.events, 'anchorSet')[0]).toMatchObject({ held: 0, of: 2 });

    tickSubjugation(ctx);
    expect(state.result).toBeUndefined();
    expect(eventsOf(ctx.events, 'subjugationProgress').at(-1)).toMatchObject({ turnsSurvived: 1, of: 2 });
    tickSubjugation(ctx);
    expect(state.result).toBe('bound');
  });
});

describe('pressure', () => {
  it('gives the sealed beast a stack for every round the tether holds, and none on the round that binds', () => {
    const { state, bossId, anchorId } = sealed(3);
    const ctx = makeCtx(state);
    setAnchor(ctx, state.units[anchorId]!);
    const boss = state.units[bossId]!;
    const atk0 = boss.atk;
    const hp0 = boss.maxHp;
    // The stack is the card's own Growth bonus where that is worth anything; a Bound Form's
    // is written as zero, and a stack that changed nothing was no pressure, so the engine
    // falls back to a flat STAT_SCALE of attack. Mirror that rule rather than assume either.
    const own = CARDS[boss.defId]!.unit!.escalationBonus;
    const bonus = own.atk + own.hp > 0 ? own : { atk: STAT_SCALE, hp: 0 };

    tickSubjugation(ctx);
    expect(boss.escalation).toBe(1);
    expect(boss.atk).toBe(atk0 + bonus.atk);
    expect(boss.maxHp).toBe(hp0 + bonus.hp);
    expect(bonus.atk + bonus.hp, 'a stack that changed nothing would be no pressure').toBeGreaterThan(0);
    tickSubjugation(ctx);
    expect(boss.escalation).toBe(2);
    tickSubjugation(ctx);
    expect(state.result).toBe('bound');
    expect(boss.escalation, 'the binding round adds nothing — the beast is caught').toBe(2);
    expect(eventsOf(ctx.events, 'escalated')).toHaveLength(2);
  });
});

describe('a snapped tether keeps half of what it held', () => {
  it('carries floor(held / 2) into the next tether and says so in both events', () => {
    const { state, bossId, anchorId } = sealed(5);
    const ctx = makeCtx(state);
    setAnchor(ctx, state.units[anchorId]!);
    tickSubjugation(ctx);
    tickSubjugation(ctx);
    tickSubjugation(ctx);
    expect(state.encounter.subjugation.turnsSurvived).toBe(3);
    const stacksBefore = state.units[bossId]!.escalation;

    onAnchorDied(ctx, state.units[anchorId]!);
    const snap = eventsOf(ctx.events, 'tetherSnapped')[0]!;
    expect(snap.kept).toBe(1);
    expect(state.encounter.subjugation.turnsSurvived).toBe(1);
    expect(state.encounter.subjugation.active).toBe(false);
    expect(state.units[bossId]!.escalation, 'the snap still costs a stack').toBe(stacksBefore + 1);

    const second = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 1, y: 5 } });
    const ctx2 = makeCtx(state);
    setAnchor(ctx2, state.units[second.id]!);
    expect(eventsOf(ctx2.events, 'anchorSet')[0]).toMatchObject({ held: 1, of: 5 });
    // Four more rounds, not five.
    for (let i = 0; i < 4; i++) tickSubjugation(ctx2);
    expect(state.result).toBe('bound');
  });

  it('keeps nothing from a tether that held a single round', () => {
    const { state, anchorId } = sealed(3);
    const ctx = makeCtx(state);
    setAnchor(ctx, state.units[anchorId]!);
    tickSubjugation(ctx);
    onAnchorDied(ctx, state.units[anchorId]!);
    expect(eventsOf(ctx.events, 'tetherSnapped')[0]!.kept).toBe(0);
    expect(state.encounter.subjugation.turnsSurvived).toBe(0);
  });
});
