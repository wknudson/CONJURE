import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { hashState } from './replay.js';

/**
 * The engine-side half of Undo, Tab-cycling and the End Turn failsafe.
 *
 * The UI wiring is client-side and checked in the browser; what is worth locking down
 * here is that these queries are exact. A readiness list that disagrees with what the
 * rules will accept, or a snapshot that does not round-trip, would make every one of
 * those conveniences quietly wrong.
 */

function fresh(seed = 4): CombatSession {
  return new CombatSession(ENCOUNTERS[0]!, seed);
}

describe('snapshot and restore', () => {
  it('round-trips the whole board exactly', () => {
    const session = fresh();
    const before = hashState(session.debugState);
    const snap = session.snapshot();

    const unit = session.getBoard().units.find((u) => u.side === 'player')!;
    session.dispatch({ type: 'moveUnit', unit: unit.id, to: session.getLegalMoves(unit.id)[0]! });
    expect(hashState(session.debugState)).not.toBe(before);

    session.restore(snap);
    expect(hashState(session.debugState)).toBe(before);
  });

  it('rewinds the RNG too, so the branch taken afterwards is unchanged', () => {
    // A snapshot that kept the advanced RNG would silently reshuffle the future — the
    // subtle failure mode of an undo built on partial state.
    const a = fresh(9);
    const snap = a.snapshot();
    const unit = a.getBoard().units.find((u) => u.side === 'player')!;
    a.dispatch({ type: 'moveUnit', unit: unit.id, to: a.getLegalMoves(unit.id)[0]! });
    a.restore(snap);
    a.dispatch({ type: 'endTurn' });
    a.runAiTurn();

    const b = fresh(9);
    b.dispatch({ type: 'endTurn' });
    b.runAiTurn();

    expect(hashState(a.debugState)).toBe(hashState(b.debugState));
  }, 30_000);

  it('hands back a copy, so the caller cannot mutate the live board', () => {
    const session = fresh();
    const snap = session.snapshot();
    snap.players.player.hp = 10;
    expect(session.getBoard().player.hp).not.toBe(10);
  });

  it('restores by value, so a snapshot survives being restored', () => {
    const session = fresh();
    const snap = session.snapshot();
    session.restore(snap);
    session.dispatch({ type: 'endTurn' });
    expect(snap.turn).toBe(1);
  });
});

describe('ready units', () => {
  it('lists only units the engine would actually accept an action from', () => {
    const session = fresh();
    for (const id of session.getReadyUnits()) {
      const canDo = session.getLegalMoves(id).length > 0 || session.getLegalAttacks(id).length > 0;
      expect(canDo, `${id} was offered by Tab but can do nothing`).toBe(true);
    }
  });

  it('drops a unit once it has spent both actions', () => {
    const session = fresh();
    const unit = session.getReadyUnits()[0];
    if (!unit) return;

    const attacks = session.getLegalAttacks(unit);
    if (attacks.length > 0) session.dispatch({ type: 'attack', attacker: unit, target: attacks[0]! });
    const moves = session.getLegalMoves(unit);
    if (moves.length > 0) session.dispatch({ type: 'moveUnit', unit, to: moves[0]! });

    if (session.getLegalMoves(unit).length === 0 && session.getLegalAttacks(unit).length === 0) {
      expect(session.getReadyUnits()).not.toContain(unit);
    }
  });

  it('offers nothing while it is not your turn', () => {
    const session = fresh();
    session.dispatch({ type: 'endTurn' });
    if (session.activeSide === 'enemy') {
      expect(session.getReadyUnits()).toEqual([]);
      expect(session.getUnspentPotential()).toEqual({ readyUnits: 0, playableCards: 0 });
    }
  });

  it('returns a stable order, so Tab walks the list instead of jumping about', () => {
    const session = fresh();
    expect(session.getReadyUnits()).toEqual(session.getReadyUnits());
  });
});

describe('unspent potential', () => {
  it('reports something to do at the start of a turn', () => {
    const potential = fresh().getUnspentPotential();
    expect(potential.readyUnits + potential.playableCards).toBeGreaterThan(0);
  });

  it('agrees with the affordances the UI is showing', () => {
    // The warning and the hand must never disagree about what is playable.
    const session = fresh();
    expect(session.getUnspentPotential().playableCards).toBe(session.getPlayableCards().length);
    expect(session.getUnspentPotential().readyUnits).toBe(session.getReadyUnits().length);
  });

  it('falls silent once the board and hand are spent', () => {
    const session = fresh();
    const st = session.debugState;
    st.players.player.hand = [];
    for (const unit of Object.values(st.units)) {
      if (unit.side !== 'player') continue;
      unit.movedThisTurn = true;
      unit.attackedThisTurn = true;
    }
    expect(session.getUnspentPotential()).toEqual({ readyUnits: 0, playableCards: 0 });
  });
});
