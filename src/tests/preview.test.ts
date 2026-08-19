import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { addUnit, giveCard, scenario } from './scenario.js';
import type { GameState } from '../core/types/state.js';

/**
 * What the trajectory ghost is drawn from.
 *
 * `previewAction` simulates the whole cast on a clone and reads the resulting events, so
 * a preview cannot disagree with what happens — that part is already load-bearing. What
 * these pin is that it describes *every* body the cast moves, because the overlay draws
 * one ghost per entry and a short list is a silent lie: it reads as "this one moves and
 * the others stay", which is the wrong answer to the only question a ghost is asked.
 */

/** A session driving a hand-built board, so a cast can be aimed at known tiles. */
function sessionOn(state: GameState): CombatSession {
  const session = new CombatSession(NOVICE_DUELIST, 1);
  session.restore(state);
  return session;
}

describe('an area displacement', () => {
  /** Four bodies around a tile, and the gravity bomb that drags them onto it. */
  function gravity() {
    const state = scenario({ width: 7, height: 7, pips: 8, marrow: 4 });
    for (const at of [
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
    ]) {
      addUnit(state, { def: 'grave_sentinel', side: 'enemy', at, hp: 20 });
    }
    const card = giveCard(state, 'player', 'aetheric_tether');

    return sessionOn(state).previewAction({
      type: 'playCard',
      card,
      target: { kind: 'tile', at: { x: 3, y: 3 } },
    });
  }

  it('describes every unit the cast touches, not just the first', () => {
    // The overlay draws one ghost per entry. A list of one out of four reads as "this one
    // moves and the others stay", which is the wrong answer to the only question a ghost
    // is ever asked.
    const preview = gravity();

    expect(preview.legal).toBe(true);
    expect(preview.displacements.length, 'all four are accounted for').toBe(4);
  });

  it('gives a ghost somewhere to slide, for the ones that actually move', () => {
    // A blocked body still gets an entry — it was pulled at — but its path is one tile
    // long, so the overlay draws no ghost for it. That filter is why the entry can exist
    // without putting a stationary phantom on the board.
    const moved = gravity().displacements.filter((d) => d.path.length > 1);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length, 'and not all four: three are blocked by the first').toBeLessThan(4);
  });

  it('names what each blocked body slams into, and for how much', () => {
    // Every crash badge has to show. A player who sees one of three reads the quiet two
    // as safe, which is the exact misread this preview exists to prevent.
    const crashes = gravity().displacements.filter((d) => d.collision);

    expect(crashes.length, 'more than one body meets something').toBeGreaterThan(1);
    for (const d of crashes) {
      expect(d.collision!.damage).toBeGreaterThan(0);
      expect(['wall', 'unit', 'obstacle']).toContain(d.collision!.against);
    }
  });

  it('says nothing about displacement for a cast that moves nobody', () => {
    const state = scenario({ width: 6, height: 6, pips: 8 });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 20 });
    const card = giveCard(state, 'player', 'flame_surge');

    const preview = sessionOn(state).previewAction({
      type: 'playCard',
      card,
      target: { kind: 'entity', ref: { kind: 'unit', id: victim.id } },
    });

    if (preview.legal) expect(preview.displacements).toEqual([]);
  });
});
