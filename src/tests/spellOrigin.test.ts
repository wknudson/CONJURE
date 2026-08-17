import { describe, expect, it } from 'vitest';
import { addUnit, scenario } from './scenario.js';
import { legalCardTargets } from '../core/engine/targeting.js';
import { CARDS } from '../core/data/cards/index.js';
import type { CardDef } from '../core/types/cards.js';
import type { GameState } from '../core/types/state.js';

/**
 * Where a spell is cast from.
 *
 * The Hero is off the board and reaches all of it; the Companion throws its own school's
 * magic from wherever it is standing, which is what makes walking it forward a decision
 * with a price. These tests use purpose-built cards rather than shipped ones so the rule
 * is pinned independently of which cards happen to carry a range today.
 */

/** Registers a card for the duration of the suite. Ids are unique per test file. */
function defineCard(def: CardDef): string {
  CARDS[def.id] = def;
  return def.id;
}

const RANGED_BOLT = defineCard({
  id: 'test_ranged_bolt',
  name: 'Test Bolt',
  cost: 1,
  school: 'frost',
  source: 'companion',
  kind: 'spell',
  text: 'A test spell with reach.',
  target: { kind: 'entity', side: 'enemy', includeObstacles: false },
  effect: { op: 'damage', amount: 2, dtype: 'frost', area: { shape: 'target' } },
  keywords: [],
  range: 3,
  needsLoS: true,
});

const HERO_BOLT = defineCard({
  id: 'test_hero_bolt',
  name: 'Test Hero Bolt',
  cost: 1,
  school: 'arcane',
  source: 'hero',
  kind: 'spell',
  text: 'A test spell cast by the Architect.',
  target: { kind: 'entity', side: 'enemy', includeObstacles: false },
  effect: { op: 'damage', amount: 2, dtype: 'spell', area: { shape: 'target' } },
  keywords: [],
});

/** A board with the player's Bound Form at (2,6) and one enemy wherever asked. */
function board(foeAt: { x: number; y: number }): { state: GameState; foeId: string } {
  const state = scenario({ width: 6, height: 8 });
  const body = addUnit(state, {
    def: 'ignis_bound',
    side: 'player',
    at: { x: 2, y: 6 },
    sacrificeValue: 0,
  });
  state.players.player.companionUnitId = body.id;
  state.players.player.companionUnitDefId = 'ignis_bound';
  const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: foeAt });
  return { state, foeId: foe.id };
}

function targetIds(state: GameState, cardId: string): string[] {
  return legalCardTargets(state, 'player', cardId)
    .map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''))
    .filter(Boolean);
}

describe('range from the Companion', () => {
  it('reaches a target exactly at its limit', () => {
    // (2,6) to (2,3) is three tiles: the edge of a range-3 spell.
    const { state, foeId } = board({ x: 2, y: 3 });
    expect(targetIds(state, RANGED_BOLT)).toContain(foeId);
  });

  it('falls one tile short of the next one out', () => {
    const { state, foeId } = board({ x: 2, y: 2 });
    expect(targetIds(state, RANGED_BOLT)).not.toContain(foeId);
  });

  it('measures diagonally, not around corners', () => {
    // Chebyshev: (2,6) to (5,3) is 3 diagonal steps, so it is in reach.
    const { state, foeId } = board({ x: 5, y: 3 });
    expect(targetIds(state, RANGED_BOLT)).toContain(foeId);
  });
});

describe('sight from the Companion', () => {
  it('cannot cast through a wall', () => {
    const { state, foeId } = board({ x: 2, y: 4 });
    expect(targetIds(state, RANGED_BOLT), 'in the open, this is a legal target').toContain(foeId);

    state.nextId += 1;
    state.obstacles.wall = {
      id: 'wall',
      defId: 'stone_barricade',
      name: 'Barricade',
      side: 'player',
      anchor: { x: 2, y: 5 },
      footprint: 1,
      hp: 8,
      maxHp: 8,
      destructible: true,
    };

    expect(targetIds(state, RANGED_BOLT), 'the wall must break the line').not.toContain(foeId);
  });

  it('lets the Hero ignore the same wall entirely', () => {
    // The Architect works from off the board: no origin, so nothing to block.
    const { state, foeId } = board({ x: 2, y: 4 });
    state.obstacles.wall = {
      id: 'wall',
      defId: 'stone_barricade',
      name: 'Barricade',
      side: 'player',
      anchor: { x: 2, y: 5 },
      footprint: 1,
      hp: 8,
      maxHp: 8,
      destructible: true,
    };

    expect(targetIds(state, HERO_BOLT)).toContain(foeId);
  });

  it('does not let the Companion block its own line', () => {
    const { state, foeId } = board({ x: 2, y: 5 });
    expect(targetIds(state, RANGED_BOLT)).toContain(foeId);
  });
});

describe('sides without a body', () => {
  it('lets the enemy cast Companion cards as it always did', () => {
    // The enemy Commander has no Bound Form. If origin filtering applied to it anyway,
    // it would silently lose every ranged card in its deck.
    const { state } = board({ x: 2, y: 3 });
    const ally = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 0, y: 7 } });

    const enemyTargets = legalCardTargets(state, 'enemy', RANGED_BOLT)
      .map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''))
      .filter(Boolean);

    expect(state.players.enemy.companionUnitDefId).toBeUndefined();
    expect(enemyTargets, 'the far side of the board must stay reachable').toContain(ally.id);
  });

  it('offers nothing when the body is gone', () => {
    const { state } = board({ x: 2, y: 3 });
    delete state.units[state.players.player.companionUnitId!];

    expect(() => legalCardTargets(state, 'player', RANGED_BOLT)).not.toThrow();
    expect(legalCardTargets(state, 'player', RANGED_BOLT)).toEqual([]);
  });
});

describe('what origin does not change', () => {
  it('still lets a frozen Companion cast', () => {
    // Casting is the Hero's action economy, not the Companion's: the body is a vantage
    // point, not the caster. Asserted so it stays a decision rather than an accident.
    const { state, foeId } = board({ x: 2, y: 4 });
    state.units[state.players.player.companionUnitId!]!.statuses.freeze = 1;
    expect(targetIds(state, RANGED_BOLT)).toContain(foeId);
  });

  it('leaves rangeless cards reaching the whole board', () => {
    const { state, foeId } = board({ x: 2, y: 0 });
    expect(targetIds(state, HERO_BOLT)).toContain(foeId);
  });

  it('leaves every shipped card unrestricted until ranges are assigned', () => {
    // The schema landing must not, by itself, change what any real card can do.
    for (const def of Object.values(CARDS)) {
      if (def.id.startsWith('test_')) continue;
      expect(def.range, `${def.id} gained a range unexpectedly`).toBeUndefined();
    }
  });
});
