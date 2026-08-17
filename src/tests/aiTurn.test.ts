import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';

/**
 * Regression guard: a player minion must not vanish during the enemy turn unless the
 * enemy actually killed it. Every removal has to be explained by an event.
 */
describe('enemy turn integrity', () => {
  it('only removes player units via events that explain the removal', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const session = new CombatSession(NOVICE_DUELIST, seed);

      // Summon whatever the player can afford on turn one.
      const playable = session.getPlayableCards();
      const summon = session
        .getHand()
        .find((c) => playable.includes(c.instanceId) && c.kind === 'minion');
      if (!summon) continue;

      const spec = session.getLegalTargets(summon.instanceId);
      if (spec.kind !== 'tiles' || spec.tiles.length === 0) continue;

      session.dispatch({
        type: 'playCard',
        card: summon.instanceId,
        target: { kind: 'tile', at: spec.tiles[0]! },
      });

      const before = session.getBoard().units.filter((u) => u.side === 'player');
      expect(before.length, `seed ${seed}: summon failed`).toBeGreaterThan(0);
      const summonedId = before[0]!.id;

      session.dispatch({ type: 'endTurn' });
      const aiEvents = session.runAiTurn();

      const after = session.getBoard().units.find((u) => u.id === summonedId);
      if (after) continue; // survived — nothing to explain

      // It died: there must be a unitDied event naming it.
      const died = aiEvents.some((e) => e.t === 'unitDied' && e.unitId === summonedId);
      expect(
        died,
        `seed ${seed}: unit ${summonedId} disappeared with no unitDied event. ` +
          `Events: ${aiEvents.map((e) => e.t).join(',')}`,
      ).toBe(true);
    }
    // Runs many full AI turns on the larger arenas; the default 5s budget is tight when
    // the whole suite runs in parallel.
  }, 30_000);

  it('leaves control with the player after the enemy turn resolves', () => {
    const session = new CombatSession(NOVICE_DUELIST, 3);
    session.dispatch({ type: 'endTurn' });
    session.runAiTurn();
    if (!session.isOver()) {
      expect(session.activeSide).toBe('player');
    }
  });
});
