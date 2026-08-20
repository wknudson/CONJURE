import { describe, expect, it } from 'vitest';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { createCombat, MIN_ARENA } from '../core/engine/setup.js';
import { CombatSession } from '../core/session.js';
import { checkInvariants } from './replay.js';
import { territoryDepthFor } from '../core/types/state.js';
import { summonSpots } from '../core/engine/board.js';

/**
 * Arenas the shipped encounters do not cover.
 *
 * Both shipped fights are eight rows deep, so every rule that quietly assumed a roomy
 * board has never been exercised. These arenas are deliberately declared here rather
 * than added to ENCOUNTERS: the shipped list is pinned by terrain.test.ts, and a demo
 * player should not be handed a cramped arena just so a test has something to run on.
 */
function arena(width: number, height: number, over: Partial<EncounterDef> = {}): EncounterDef {
  return {
    id: `test_${width}x${height}`,
    name: `Test ${width}x${height}`,
    blurb: 'A test arena.',
    width,
    height,
    playerHp: 40,
    enemyHp: 40,
    playerName: 'Hero',
    companionName: 'Ignis',
    companionSchool: 'pyre',
    enemyName: 'Duelist',
    enemySchool: 'dusk',
    enemyDeck: ['scout_imp', 'marrow_wisp', 'grave_sentinel', 'flame_surge', 'shield_bash'],
    enemyOpeningBoard: [['scout_imp', 1, 0]],
    ...over,
  };
}

describe('small and irregular arenas', () => {
  // 4x4 is the floor; 4x7 is the irregular case the design calls for.
  for (const [w, h] of [
    [4, 4],
    [4, 7],
  ] as const) {
    it(`opens a playable ${w}x${h} board`, () => {
      const enc = arena(w, h);
      const session = new CombatSession(enc, 11);
      const board = session.getBoard();

      expect(board.width).toBe(w);
      expect(board.height).toBe(h);
      expect(checkInvariants(session.debugState, `${w}x${h} opening`)).toEqual([]);

      // Both free Vanguards found room, so turn one is a real turn.
      expect(board.units.filter((u) => u.side === 'player').length).toBeGreaterThan(0);
      expect(board.units.filter((u) => u.side === 'enemy').length).toBeGreaterThan(1);

      // And there is something to actually do with the opening hand.
      expect(session.getPlayableCards().length).toBeGreaterThan(0);
    });

    it(`survives three AI turns on ${w}x${h}`, () => {
      const session = new CombatSession(arena(w, h), 5);
      for (let i = 0; i < 3 && !session.isOver(); i++) {
        session.dispatch({ type: 'endTurn' });
        session.runAiTurn();
        expect(checkInvariants(session.debugState, `${w}x${h} turn ${i}`)).toEqual([]);
      }
    }, 30_000);
  }

  it('leaves neutral ground on the smallest board', () => {
    // The point of the derived depth: at 4 rows, two-deep territory would swallow the
    // whole board and there would be nowhere neutral to fight over.
    const depth = territoryDepthFor(4);
    expect(depth * 2).toBeLessThan(4);
  });

  it('keeps the summon zone one row deep on a short board', () => {
    const session = new CombatSession(arena(6, 5), 3);
    const board = session.getBoard();
    expect(board.territoryDepth).toBe(1);

    // Asked of the zone directly rather than through a card in hand. It used to be read
    // off whichever minion the opening draw happened to contain, and minions are a
    // Vanguard Roster now — so the old test could only have gone quiet, never red.
    const spots = summonSpots(session.debugState, 'player', 1);
    expect(spots.length, 'the home row must offer somewhere to stand').toBeGreaterThan(0);
    for (const at of spots) {
      expect(at.y, 'a summon spot strayed out of the one-row zone').toBe(4);
    }
  });
});

describe('encounter validation', () => {
  it('refuses an arena below the minimum', () => {
    expect(() => createCombat(arena(3, 3), 1)).toThrow(/below the/);
    expect(() => createCombat(arena(MIN_ARENA - 1, 8), 1)).toThrow(/below the/);
  });

  it('refuses an arena beyond the maximum', () => {
    expect(() => createCombat(arena(20, 8), 1)).toThrow(/exceeds the/);
  });

  it('refuses terrain outside the arena', () => {
    const enc = arena(6, 8, { terrain: [{ at: { x: 9, y: 3 }, kind: 'wall' }] });
    expect(() => createCombat(enc, 1)).toThrow(/outside the arena/);
  });

  it('refuses terrain parked in a territory row', () => {
    // Silently shrinking a summon zone is the failure this prevents.
    const enc = arena(6, 8, { terrain: [{ at: { x: 2, y: 7 }, kind: 'wall' }] });
    expect(() => createCombat(enc, 1)).toThrow(/territory row/);
  });

  it('refuses an opening unit outside the arena', () => {
    const enc = arena(6, 8, { enemyOpeningBoard: [['scout_imp', 6, 1]] });
    expect(() => createCombat(enc, 1)).toThrow(/outside the arena/);
  });

  it('accepts both shipped encounters unchanged', async () => {
    const { ENCOUNTERS } = await import('../core/data/encounters/index.js');
    for (const enc of ENCOUNTERS) {
      expect(() => createCombat(enc, 1), enc.id).not.toThrow();
    }
  });
});
