import { describe, expect, it } from 'vitest';
import {
  atUnit,
  eventsOf,
  findUnit,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';

/**
 * Draft 7 §5.1: wall = 3 to the pushed unit; unit blocker = 3 pushed / 2 blocker;
 * obstacle = 3 / 3. Mass Invariance means a 2x2 changes none of those numbers.
 *
 * Shield Bash deals 2 damage first, then shoves 1 tile — so a bashed unit that hits
 * something takes 2 + 3 = 5 total.
 */
describe('collision physics', () => {
  it('deals 3 impact damage when a unit is shoved into the arena wall', () => {
    // Enemy sits on the top row (y=0); the shove pushes it further up, into the boundary.
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 }, hp: 100 }],
      hand: ['shield_bash'],
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(foe.id)));

    const collisions = eventsOf(res.events, 'collision');
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.against).toBe('wall');

    // 2 from the spell + 3 from the wall.
    expect(res.state.units[foe.id]!.hp).toBe(100 - 20 - 30);
    // It stays on the outermost tile.
    expect(res.state.units[foe.id]!.anchor).toEqual({ x: 2, y: 0 });
  });

  it('splits 3 / 2 when shoved into another unit', () => {
    const state = scenario({
      units: [
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 100 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 }, hp: 100 },
      ],
      hand: ['shield_bash'],
    });
    const pushed = Object.values(state.units).find((u) => u.anchor.y === 1)!;
    const blocker = Object.values(state.units).find((u) => u.anchor.y === 0)!;

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(pushed.id)));

    const collision = eventsOf(res.events, 'collision')[0]!;
    expect(collision.against).toBe('unit');
    expect(collision.blockerId).toBe(blocker.id);

    expect(res.state.units[pushed.id]!.hp).toBe(100 - 20 - 30);
    expect(res.state.units[blocker.id]!.hp).toBe(100 - 20);
    expect(res.state.units[pushed.id]!.anchor).toEqual({ x: 2, y: 1 });
  });

  it('deals 3 to both when shoved into a destructible obstacle', () => {
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 100 }],
      obstacles: [{ at: { x: 2, y: 0 }, hp: 60 }],
      hand: ['shield_bash'],
    });
    const pushed = findUnit(state, 'grave_sentinel', 'enemy');
    const obstacleId = Object.keys(state.obstacles)[0]!;

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(pushed.id)));

    expect(eventsOf(res.events, 'collision')[0]!.against).toBe('obstacle');
    expect(res.state.units[pushed.id]!.hp).toBe(100 - 20 - 30);
    expect(res.state.obstacles[obstacleId]!.hp).toBe(60 - 30);
  });

  it('moves the unit and deals no damage when the push lands on empty ground', () => {
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 100 }],
      hand: ['shield_bash'],
    });
    const foe = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(foe.id)));

    expect(eventsOf(res.events, 'collision')).toHaveLength(0);
    // Only the spell's own 2 damage.
    expect(res.state.units[foe.id]!.hp).toBe(80);
    expect(res.state.units[foe.id]!.anchor).toEqual({ x: 2, y: 1 });
  });

  it('applies Mass Invariance: a 2x2 blocker still takes exactly 2', () => {
    // Magma Brute (2x2) anchored at (1,0) covers (1,0),(2,0),(1,1),(2,1).
    // The pushed unit at (2,2) is shoved up into the Behemoth's (2,1) cell.
    const state = scenario({
      units: [
        { def: 'magma_brute', side: 'enemy', at: { x: 1, y: 0 }, hp: 120 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 100 },
      ],
      hand: ['shield_bash'],
    });
    const pushed = findUnit(state, 'grave_sentinel', 'enemy');
    const brute = findUnit(state, 'magma_brute', 'enemy');

    const res = run(state, play(handCard(state, 'player', 'shield_bash'), atUnit(pushed.id)));

    expect(eventsOf(res.events, 'collision')[0]!.against).toBe('unit');
    expect(res.state.units[brute.id]!.hp).toBe(120 - 20);
    expect(res.state.units[pushed.id]!.hp).toBe(100 - 20 - 30);
  });
});
