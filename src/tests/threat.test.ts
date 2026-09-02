import { describe, expect, it } from 'vitest';
import { addUnit, scenario } from './scenario.js';
import { heldNextTurn, threatMap } from '../core/engine/threat.js';
import { applyCommand } from '../core/engine/engine.js';
import { canAct } from '../core/engine/movement.js';
import { coordKey } from '../contract/ids.js';
import type { GameState } from '../core/types/state.js';

const has = (tiles: { x: number; y: number }[], x: number, y: number): boolean =>
  tiles.some((t) => t.x === x && t.y === y);

describe('threat projection', () => {
  it('marks tiles an enemy can reach by moving then attacking', () => {
    // Grave Sentinel: MOV 2, melee range 1, sitting at (2,0).
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 } }],
    });

    const map = threatMap(state, 'player');

    // Two tiles of movement plus one of reach covers rows 1 through 3.
    expect(has(map.tiles, 2, 1)).toBe(true);
    expect(has(map.tiles, 2, 3)).toBe(true);
    // Row 4 needs three tiles of movement, which it does not have.
    expect(has(map.tiles, 2, 4)).toBe(false);
  });

  it('projects further for a faster unit', () => {
    // Scout Imp has MOV 3, so the same start line reaches a row deeper.
    const state = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } }],
    });

    expect(has(threatMap(state, 'player').tiles, 2, 4)).toBe(true);
  });

  it('accumulates damage where several attackers converge', () => {
    const state = scenario({
      width: 6,
      height: 6,
      units: [
        { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 }, atk: 20 },
        { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 }, atk: 30 },
      ],
    });

    const map = threatMap(state, 'player');
    // A tile between them is reachable by both, so the shown damage is the sum.
    expect(map.damageByTile.get(coordKey({ x: 2, y: 2 }))).toBe(50);
  });

  it('flags whatever can already reach the player Bound Form', () => {
    // The body is the only route to a Pact — no attack may name a portrait — so "threatens
    // your Commander" is exactly "can reach the thing standing in for them".
    const withBody = (foe: { def: string; at: { x: number; y: number } }) => {
      const state = scenario({
        width: 6,
        height: 6,
        units: [{ def: foe.def, side: 'enemy', at: foe.at }],
      });
      const body = addUnit(state, {
        def: 'scout_imp',
        side: 'player',
        at: { x: 2, y: 5 },
        keywords: ['BoundForm'],
      });
      state.players.player.companionUnitId = body.id;
      state.players.player.companionUnitDefId = 'ignis_bound';
      return state;
    };

    const near = withBody({ def: 'scout_imp', at: { x: 2, y: 4 } });
    expect(threatMap(near, 'player').commanderThreats).toHaveLength(1);

    // MOV 2 from row 0 cannot reach the back row this turn.
    const far = withBody({ def: 'grave_sentinel', at: { x: 2, y: 0 } });
    expect(threatMap(far, 'player').commanderThreats).toHaveLength(0);
  });

  it('does not project threat through a wall of obstacles for ranged units', () => {
    const blocked = scenario({
      width: 6,
      height: 6,
      units: [{ def: 'marrow_wisp', side: 'enemy', at: { x: 0, y: 0 } }],
      obstacles: [{ at: { x: 0, y: 1 } }, { at: { x: 1, y: 1 } }, { at: { x: 1, y: 0 } }],
    });

    // The wisp is walled into its corner: nothing it can move to reaches far.
    const map = threatMap(blocked, 'player');
    expect(has(map.tiles, 0, 5)).toBe(false);
  });
});

/**
 * The forecast reads the board as the enemy's turn will find it.
 *
 * Every status that gates an action counts down by one at the start of its owner's turn,
 * before the owner acts. The map used to read the live stacks, and so told the player that
 * a body under a one-stack Freeze threatened nothing — when that ice is gone before the
 * body moves and it acts freely. Each case below is checked twice: once against the map,
 * and once against the engine by actually ending the turn, so the two cannot drift apart.
 */
describe('what a held body will and will not do next turn', () => {
  const lone = (status: 'freeze' | 'stun' | 'entangle' | 'exhaust' | 'anchor', stacks: number) => {
    const state = scenario({
      width: 6,
      height: 6,
      playerHp: 5000,
      enemyHp: 5000,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 } }],
    });
    const id = Object.keys(state.units)[0]!;
    state.units[id]!.statuses[status] = stacks;
    return { state, id };
  };

  /** The body as the engine leaves it at the start of its own turn. */
  const atItsTurn = (state: GameState, id: string) =>
    applyCommand(state, { type: 'endTurn' }).state.units[id]!;

  it('reads a one-stack hold as a body that acts, because the ice is gone before it moves', () => {
    for (const status of ['freeze', 'stun'] as const) {
      const { state, id } = lone(status, 1);
      expect(heldNextTurn(state.units[id]!), `${status} 1`).toBe(false);
      expect(threatMap(state, 'player').tiles.length, `${status} 1 projects`).toBeGreaterThan(0);
      // And that is what the engine does: the hold has decayed by the time it may act.
      expect(canAct(atItsTurn(state, id)), `${status} 1 acts`).toBe(true);
    }
  });

  it('reads a two-stack hold as a body that threatens nothing', () => {
    for (const status of ['freeze', 'stun'] as const) {
      const { state, id } = lone(status, 2);
      expect(heldNextTurn(state.units[id]!), `${status} 2`).toBe(true);
      expect(threatMap(state, 'player').tiles, `${status} 2 projects nothing`).toHaveLength(0);
      expect(canAct(atItsTurn(state, id)), `${status} 2 still held`).toBe(false);
    }
  });

  it('reads the Anchor as a hold that does not lift', () => {
    // The tether does not decay: it holds until it resolves.
    const { state, id } = lone('anchor', 1);
    expect(heldNextTurn(state.units[id]!)).toBe(true);
    expect(threatMap(state, 'player').tiles).toHaveLength(0);
  });

  it('roots a two-stack Entangle where it stands but lets it swing', () => {
    const rooted = lone('entangle', 2);
    const tiles = threatMap(rooted.state, 'player').tiles;
    expect(has(tiles, 2, 2), 'adjacent').toBe(true);
    expect(has(tiles, 2, 4), 'nothing it could walk to').toBe(false);

    // A one-stack Entangle has lifted by the time it moves.
    const freed = lone('entangle', 1);
    expect(has(threatMap(freed.state, 'player').tiles, 2, 4)).toBe(true);
  });

  it('counts Fleet at what it will be worth after its owner\'s tick', () => {
    // Scout Imp: MOV 3 from row 0 reaches row 4 with one of reach. Fleet 1 is spent by the
    // tick and adds nothing; Fleet 2 leaves one stride, and row 5 comes into reach.
    const board = (fleet: number) => {
      const state = scenario({
        width: 6,
        height: 7,
        units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } }],
      });
      state.units[Object.keys(state.units)[0]!]!.statuses.fleet = fleet;
      return threatMap(state, 'player').tiles;
    };
    expect(has(board(1), 2, 5), 'one stack is spent by the tick').toBe(false);
    expect(has(board(2), 2, 5), 'two stacks leave a stride').toBe(true);
  });
});

describe('what a Climax lets a body reach', () => {
  const climaxed = (state: GameState, id: string, aura: string) => {
    state.units[id]!.aura = { defId: aura, stacks: 3 };
  };

  it('projects a Blink host onto every tile it can see', () => {
    // Scout Imp at the far end of a tall board. MOV 3 cannot bring row 8 into reach; the
    // Written Path's Climax steps there directly.
    const state = scenario({
      width: 6,
      height: 9,
      units: [{ def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } }],
    });
    const id = Object.keys(state.units)[0]!;
    expect(has(threatMap(state, 'player').tiles, 2, 8), 'out of stride before Climax').toBe(false);

    climaxed(state, id, 'aura_written_path');
    expect(has(threatMap(state, 'player').tiles, 2, 8), 'a step through nothing after').toBe(true);
  });

  it('projects an Overload host through the body in its way', () => {
    // Voltaic Hound at (2,0), a wall of one at (2,1). An ordinary body walks around and
    // still reaches most tiles, so the test looks at the straight line: (2,3) needs the
    // route through (2,1) to be counted as ground it could stand on the far side of.
    const build = () => {
      const state = scenario({
        width: 3,
        height: 6,
        units: [
          { def: 'voltaic_hound', side: 'enemy', at: { x: 1, y: 0 } },
          { def: 'scout_imp', side: 'player', at: { x: 0, y: 1 } },
          { def: 'scout_imp', side: 'player', at: { x: 1, y: 1 } },
          { def: 'scout_imp', side: 'player', at: { x: 2, y: 1 } },
        ],
      });
      return state;
    };
    // A solid row of bodies: nothing beyond row 1 without walking through one.
    const plain = build();
    expect(has(threatMap(plain, 'player').tiles, 1, 4), 'walled in').toBe(false);

    const charged = build();
    climaxed(charged, Object.keys(charged.units)[0]!, 'aura_static_charge');
    expect(has(threatMap(charged, 'player').tiles, 1, 4), 'charges straight through').toBe(true);
  });
});
