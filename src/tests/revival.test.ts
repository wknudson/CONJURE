import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, handCard, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { CARDS } from '../core/data/cards/index.js';
import { legalCardTargets } from '../core/engine/targeting.js';
import { killEntity } from '../core/engine/death.js';
import { makeCtx } from '../core/engine/context.js';
import { checkInvariants } from './replay.js';
import type { GameState } from '../core/types/state.js';
import type { ChosenTarget } from '../core/types/cards.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';

/**
 * Soul Pyres, X-costs, and the three ways to stand a body back up.
 *
 * Two properties carry this phase. **A pyre is memory, not matter** — nothing is spawned,
 * so the only thing that can deny Aetheric Resurgence is a body physically standing on the
 * tile. And **X is declared, not inferred**: the price is what the player asked for, the
 * health follows from it, and zero is refused outright.
 */

/** A board with one rostered body standing on it, ready to be killed. */
function withVanguard(def = 'grave_sentinel', opts: Record<string, unknown> = {}) {
  const state = scenario({ width: 6, height: 8, pips: 8, marrow: 8, ...opts });
  const unit = addUnit(state, { def, side: 'player', at: { x: 2, y: 5 }, fresh: false });
  state.players.player.roster = [{ defId: def, status: 'fielded', unitId: unit.id }];
  state.anchors = [{ x: 0, y: 7 }, { x: 1, y: 7 }];
  return { state, unit };
}

/** Kills a unit through the real pipeline, so the pyre is lit the way a fight lights it. */
function slay(state: GameState, unitId: string): void {
  const ctx = makeCtx(state);
  killEntity(ctx, state.units[unitId]!, 'spell');
}

const fallen = (i = 0): ChosenTarget => ({ kind: 'fallen', rosterIndex: i });

/** A session wrapped around a hand-built board, for the query-layer checks. */
function sessionOver(state: GameState): CombatSession {
  const s = new CombatSession(NOVICE_DUELIST, 1);
  (s as unknown as { state: GameState }).state = state;
  return s;
}


describe('Soul Pyres', () => {
  it('remembers the tile a rostered body fell on', () => {
    const { state, unit } = withVanguard();
    const at = { ...state.units[unit.id]!.anchor };

    slay(state, unit.id);

    const entry = state.players.player.roster[0]!;
    expect(entry.status).toBe('fallen');
    expect(entry.fellAt).toEqual(at);
    expect(entry.unitId, 'the body is gone, so the id must be too').toBeUndefined();
  });

  it('spawns nothing on the board — a pyre is memory, not matter', () => {
    const { state, unit } = withVanguard();
    const at = { ...state.units[unit.id]!.anchor };
    const obstaclesBefore = Object.keys(state.obstacles).length;
    const hazardsBefore = Object.keys(state.hazards).length;

    slay(state, unit.id);

    expect(Object.keys(state.obstacles).length).toBe(obstaclesBefore);
    expect(Object.keys(state.hazards).length).toBe(hazardsBefore);
    // The tile is free: anything may walk onto it, including the enemy.
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at });
    expect(state.units[foe.id]!.anchor).toEqual(at);
  });

  it('announces itself, so the renderer can mark the ground', () => {
    const { state, unit } = withVanguard();
    const ctx = makeCtx(state);
    killEntity(ctx, state.units[unit.id]!, 'spell');

    const lit = eventsOf(ctx.events, 'pyreLit');
    expect(lit).toHaveLength(1);
    expect(lit[0]!.defId).toBe('grave_sentinel');
  });

  it('lights no pyre for a body that was never on the roster', () => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } });
    const ctx = makeCtx(state);
    killEntity(ctx, state.units[foe.id]!, 'attack');

    expect(eventsOf(ctx.events, 'pyreLit')).toHaveLength(0);
    expect(state.players.enemy.roster).toEqual([]);
  });
});

describe('the X-cost pipeline', () => {
  /**
   * No Marrow on hand, deliberately.
   *
   * X is a *generic* price, and the economy pays generic prices out of Marrow before it
   * touches the Pip bank — Marrow evaporates at end of turn and Pips do not. A fixture
   * holding Marrow would therefore pay X out of it and leave the Pip total untouched,
   * which is correct behaviour and useless for testing the Pip drain. It is pinned on its
   * own two tests below.
   */
  function readyToRaise(pips = 8, marrow = 0) {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['aetheric_resurgence'],
      pips,
      marrow,
    });
    slay(state, unit.id);
    return { state, card: handCard(state, 'player', 'aetheric_resurgence') };
  }

  it('lets Marrow pay X, because X is a generic price like any other', () => {
    const { state, card } = readyToRaise(8, 5);
    const pipsBefore = state.players.player.pips;

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 3 });

    expect(res.state.players.player.marrow, 'Marrow goes first — it expires').toBe(2);
    expect(res.state.players.player.pips, 'and the bank is untouched').toBe(pipsBefore);
  });

  it('falls through to the bank once the Marrow runs out', () => {
    const { state, card } = readyToRaise(8, 2);
    const pipsBefore = state.players.player.pips;

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 5 });

    expect(res.state.players.player.marrow).toBe(0);
    expect(res.state.players.player.pips).toBe(pipsBefore - 3);
  });

  it('drains exactly the Pips declared, and no more', () => {
    const { state, card } = readyToRaise();
    const before = state.players.player.pips;

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 3 });

    expect(res.state.players.player.pips).toBe(before - 3);
  });

  it('ignores the printed cost, which is zero and not a floor', () => {
    const { state, card } = readyToRaise();
    const before = state.players.player.pips;
    expect(CARDS.aetheric_resurgence!.cost.pips, 'printed price').toBe(0);

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 1 });

    expect(res.state.players.player.pips).toBe(before - 1);
  });

  it('gives 20% of the ceiling per Pip spent', () => {
    const maxHp = CARDS.grave_sentinel!.unit!.hp;
    for (const [x, share] of [[1, 0.2], [3, 0.6], [5, 1]] as const) {
      const { state, card } = readyToRaise();
      const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x });
      const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;
      expect(body.hp, `X=${x}`).toBe(Math.round(maxHp * share));
    }
  });

  it('comes back whole at the ceiling, and never past it', () => {
    const { state, card } = readyToRaise();
    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 5 });
    const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;
    expect(body.hp).toBe(body.maxHp);
  });

  it('refuses X of zero', () => {
    const { state, card } = readyToRaise();
    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen(), x: 0 })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses X above the card ceiling', () => {
    const { state, card } = readyToRaise();
    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen(), x: 6 })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses a missing X rather than guessing one', () => {
    const { state, card } = readyToRaise();
    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen() })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses an X the player cannot pay', () => {
    const { state, card } = readyToRaise(2);
    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen(), x: 5 })).toThrow(
      IllegalCommandError,
    );
  });

  it('charges nothing when the play is refused', () => {
    const { state, card } = readyToRaise();
    const before = state.players.player.pips;
    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen(), x: 0 })).toThrow();
    expect(state.players.player.pips).toBe(before);
  });
});

describe('an enemy on the pyre blocks Aetheric Resurgence', () => {
  it('offers the raising while the ground is clear', () => {
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['aetheric_resurgence'] });
    slay(state, unit.id);
    expect(legalCardTargets(state, 'player', 'aetheric_resurgence')).toEqual([fallen()]);
  });

  it('offers nothing while something stands on it', () => {
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['aetheric_resurgence'] });
    const at = { ...state.units[unit.id]!.anchor };
    slay(state, unit.id);
    addUnit(state, { def: 'scout_imp', side: 'enemy', at });

    expect(legalCardTargets(state, 'player', 'aetheric_resurgence')).toEqual([]);
  });

  it('refuses the command too, not merely the offer', () => {
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['aetheric_resurgence'] });
    const at = { ...state.units[unit.id]!.anchor };
    slay(state, unit.id);
    addUnit(state, { def: 'scout_imp', side: 'enemy', at });
    const card = handCard(state, 'player', 'aetheric_resurgence');

    expect(() =>
      applyCommand(state, { type: 'playCard', card, target: fallen(), x: 3 }),
    ).toThrow(IllegalCommandError);
  });

  it('lets the raising through again once the blocker moves off', () => {
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['aetheric_resurgence'] });
    const at = { ...state.units[unit.id]!.anchor };
    slay(state, unit.id);
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at });
    expect(legalCardTargets(state, 'player', 'aetheric_resurgence')).toEqual([]);

    delete state.units[foe.id];
    expect(legalCardTargets(state, 'player', 'aetheric_resurgence')).toEqual([fallen()]);
  });
});

describe('the two Rallies', () => {
  it('Anchor Rally raises at half health, quickened', () => {
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['anchor_rally'], pips: 6 });
    const maxHp = state.units[unit.id]!.maxHp;
    slay(state, unit.id);
    const card = handCard(state, 'player', 'anchor_rally');

    const res = applyCommand(state, { type: 'playCard', card, target: fallen() });
    const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;

    expect(body.hp).toBe(Math.round(maxHp * 0.5));
    expect(body.statuses.fleet).toBe(1);
    expect(res.state.anchors.some((a) => a.x === body.anchor.x && a.y === body.anchor.y)).toBe(true);
  });

  it('Anchor Rally does not care where the body fell', () => {
    // Which is what lets it raise a body that died in an earlier fight of the dungeon.
    const { state, unit } = withVanguard('grave_sentinel', { hand: ['anchor_rally'], pips: 6 });
    slay(state, unit.id);
    delete state.players.player.roster[0]!.fellAt;

    expect(legalCardTargets(state, 'player', 'anchor_rally')).toEqual([fallen()]);
  });

  it('Blood & Bone raises at 1 health wearing everything it lost', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['blood_and_bone_rally'],
      marrow: 4,
    });
    const maxHp = state.units[unit.id]!.maxHp;
    slay(state, unit.id);
    const card = handCard(state, 'player', 'blood_and_bone_rally');

    const res = applyCommand(state, { type: 'playCard', card, target: fallen() });
    const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;

    expect(body.hp).toBe(1);
    expect(body.armor, 'armor equal to everything it lost').toBe(maxHp - 1);
  });

  it('Blood & Bone cannot be bought with Pips at any total', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['blood_and_bone_rally'],
      pips: 8,
      marrow: 0,
    });
    slay(state, unit.id);
    const card = handCard(state, 'player', 'blood_and_bone_rally');

    expect(() => applyCommand(state, { type: 'playCard', card, target: fallen() })).toThrow(
      IllegalCommandError,
    );
  });
});

describe('what a raised body carries', () => {
  it('comes back stripped: no rune, no status, no Aura, no growth', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['aetheric_resurgence'],
      pips: 8,
    });
    const live = state.units[unit.id]!;
    live.statuses.burn = 3;
    live.aura = { defId: 'aura_conflagration', stacks: 3 };
    live.escalation = 2;
    live.atk += 5;
    slay(state, unit.id);

    const card = handCard(state, 'player', 'aetheric_resurgence');
    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 5 });
    const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;

    expect(body.statuses.burn).toBeUndefined();
    expect(body.aura).toBeUndefined();
    expect(body.escalation).toBe(0);
    expect(body.rune).toBeUndefined();
    expect(body.atk, 'and its printed attack, not the one it died with').toBe(
      CARDS.grave_sentinel!.unit!.atk,
    );
  });

  it('is a new instance, not the old body restored', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['aetheric_resurgence'],
      pips: 8,
    });
    slay(state, unit.id);
    const card = handCard(state, 'player', 'aetheric_resurgence');

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 2 });

    expect(res.state.players.player.roster[0]!.unitId).not.toBe(unit.id);
    expect(res.state.units[unit.id], 'the old id is gone for good').toBeUndefined();
  });

  it('may act the turn it stands up', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['aetheric_resurgence'],
      pips: 8,
    });
    slay(state, unit.id);
    const card = handCard(state, 'player', 'aetheric_resurgence');

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 3 });
    const body = res.state.units[res.state.players.player.roster[0]!.unitId!]!;

    expect(body.summonedThisTurn).toBe(false);
    expect(body.freshlySummoned).toBe(false);
  });

  it('returns the roster entry to the field, and clears the pyre', () => {
    const { state, unit } = withVanguard('grave_sentinel', {
      hand: ['aetheric_resurgence'],
      pips: 8,
    });
    slay(state, unit.id);
    const card = handCard(state, 'player', 'aetheric_resurgence');

    const res = applyCommand(state, { type: 'playCard', card, target: fallen(), x: 3 });
    const entry = res.state.players.player.roster[0]!;

    expect(entry.status).toBe('fielded');
    expect(entry.fellAt, 'the pyre is spent').toBeUndefined();
    expect(eventsOf(res.events, 'unitRevived')).toHaveLength(1);
    expect(checkInvariants(res.state, 'after a revival')).toEqual([]);
  });

  it('offers nothing at all while the roster holds no dead', () => {
    const { state } = withVanguard('grave_sentinel', { hand: ['anchor_rally'], pips: 6 });
    expect(legalCardTargets(state, 'player', 'anchor_rally')).toEqual([]);
  });
});

describe('the spec the Graveyard picker will read', () => {
  it('reports the fallen as a pickable list, not an empty entity list', () => {
    // Without a `fallen` variant on the UI-facing spec these three cards report
    // `entities: []` and read as unplayable — the engine would accept a target no
    // interface could ever offer.
    const state = withVanguard('grave_sentinel', { hand: ['anchor_rally'], pips: 6 });
    slay(state.state, state.unit.id);

    const session = sessionOver(state.state);
    const card = handCard(state.state, 'player', 'anchor_rally');
    const spec = session.getLegalTargets(card);

    expect(spec.kind).toBe('fallen');
    if (spec.kind !== 'fallen') return;
    expect(spec.entries).toHaveLength(1);
    expect(spec.entries[0]!.defId).toBe('grave_sentinel');
    expect(spec.entries[0]!.name).toBe(CARDS.grave_sentinel!.name);
    expect(spec.entries[0]!.at, 'and where it fell, for a picker that points at ground').toBeDefined();
  });

  it('round-trips a picked entry back into a legal play', () => {
    const state = withVanguard('grave_sentinel', { hand: ['anchor_rally'], pips: 6 });
    slay(state.state, state.unit.id);

    const session = sessionOver(state.state);
    const card = handCard(state.state, 'player', 'anchor_rally');
    const spec = session.getLegalTargets(card);
    if (spec.kind !== 'fallen') throw new Error('expected a fallen spec');

    session.dispatch({
      type: 'playCard',
      card,
      target: { kind: 'fallen', rosterIndex: spec.entries[0]!.rosterIndex },
    });

    expect(session.getBoard().roster[0]!.status).toBe('fielded');
  });
});
