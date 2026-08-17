import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST, IGNIS_TRIAL } from '../core/data/encounters/index.js';
import { territoryRows } from '../core/types/state.js';
import { spawnObstacle } from '../core/engine/spawn.js';
import { makeCtx } from '../core/engine/context.js';
import { CARDS } from '../core/data/cards/index.js';

/**
 * Spark Geodes: a prize on neutral ground.
 *
 * Two Sparks is most of a card, which is enough that both sides want one early — and
 * early is exactly when neither can spare the tempo to go and get it.
 */

describe('scattering', () => {
  it('places geodes on the duelist field, within its stated range', () => {
    const { state } = createCombat(NOVICE_DUELIST, 11);
    const geodes = Object.values(state.obstacles).filter((o) => o.defId === 'spark_geode');

    const spec = NOVICE_DUELIST.sparkGeodes!;
    expect(geodes.length).toBeGreaterThanOrEqual(spec.min);
    expect(geodes.length).toBeLessThanOrEqual(spec.max);
  });

  it('keeps them out of both deployment zones', () => {
    // A geode in a summon row would either be free for its owner or block their own
    // deployment; neither is the decision it exists to create.
    for (const seed of [1, 2, 3, 7, 19]) {
      const { state } = createCombat(NOVICE_DUELIST, seed);
      const home = new Set([
        ...territoryRows(state, 'player'),
        ...territoryRows(state, 'enemy'),
      ]);
      for (const o of Object.values(state.obstacles)) {
        if (o.defId !== 'spark_geode') continue;
        expect(home.has(o.anchor.y), `seed ${seed}: geode in a home row`).toBe(false);
      }
    }
  });

  it('never stacks two on a tile, or one under a unit', () => {
    const { state } = createCombat(NOVICE_DUELIST, 5);
    const taken = new Set<string>();
    for (const o of Object.values(state.obstacles)) {
      const key = `${o.anchor.x},${o.anchor.y}`;
      expect(taken.has(key)).toBe(false);
      taken.add(key);
    }
    for (const u of Object.values(state.units)) {
      expect(taken.has(`${u.anchor.x},${u.anchor.y}`)).toBe(false);
    }
  });

  it('lays out the same field for the same seed', () => {
    const a = createCombat(NOVICE_DUELIST, 42).state;
    const b = createCombat(NOVICE_DUELIST, 42).state;
    const layout = (s: typeof a) =>
      Object.values(s.obstacles)
        .filter((o) => o.defId === 'spark_geode')
        .map((o) => `${o.anchor.x},${o.anchor.y}`)
        .sort()
        .join('|');

    expect(layout(b)).toBe(layout(a));
  });

  it('leaves the boss arena clean', () => {
    // Opt-in per encounter: the Trial is about the drake, not about scavenging.
    expect(IGNIS_TRIAL.sparkGeodes).toBeUndefined();
    const { state } = createCombat(IGNIS_TRIAL, 3);
    expect(Object.values(state.obstacles).some((o) => o.defId === 'spark_geode')).toBe(false);
  });
});

describe('breaking one', () => {
  /** Puts a geode next to a player unit and returns both ids. */
  function withGeode() {
    const state = scenario({ width: 6, height: 8, sparks: 0 });
    const striker = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'spark_geode', 'player', { x: 2, y: 3 })!;
    return { state, striker, geodeId };
  }

  it('pays two sparks to whoever cracks it', () => {
    const { state, striker, geodeId } = withGeode();

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: geodeId },
    });

    expect(res.state.obstacles[geodeId]).toBeUndefined();
    expect(res.state.players.player.sparks).toBe(2);
    expect(eventsOf(res.events, 'obstacleDestroyed').length).toBe(1);
  });

  it('announces the resources so the HUD can follow', () => {
    const { state, striker, geodeId } = withGeode();
    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: geodeId },
    });
    expect(eventsOf(res.events, 'resourcesChanged').length).toBeGreaterThan(0);
  });

  it('is worth nothing to break an ordinary pillar', () => {
    const state = scenario({ width: 6, height: 8, sparks: 0 });
    const striker = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });
    const ctx = makeCtx(state);
    const wall = spawnObstacle(ctx, 'stone_barricade', 'player', { x: 2, y: 4 })!;

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: wall },
    });

    expect(res.state.players.player.sparks).toBe(0);
  });

  it('can be taken by either side, being nobody else business', () => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'spark_geode', 'player', { x: 2, y: 4 })!;
    state.activeSide = 'enemy';
    state.players.enemy.sparks = 0;

    const res = applyCommand(state, {
      type: 'attack',
      attacker: foe.id,
      target: { kind: 'obstacle', id: geodeId },
    });

    expect(res.state.players.enemy.sparks).toBe(2);
  });
});

describe('the geode itself', () => {
  it('is not a card anyone can own or be offered', () => {
    expect(CARDS.spark_geode!.setupOnly).toBe(true);
  });

  it('dies to a single hit', () => {
    expect(CARDS.spark_geode!.obstacleHp).toBe(1);
  });
});

describe('in play', () => {
  it('does not disturb a normal opening', () => {
    const session = new CombatSession(NOVICE_DUELIST, 9);
    expect(session.getPlayableCards().length).toBeGreaterThan(0);
    expect(session.getBoard().obstacles.length).toBeGreaterThan(0);
  });
});
