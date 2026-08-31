import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { createCombat } from '../core/engine/setup.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST, IGNIS_TRIAL } from '../core/data/encounters/index.js';
import { startingZone } from '../core/types/state.js';
import { spawnObstacle } from '../core/engine/spawn.js';
import { makeCtx } from '../core/engine/context.js';
import { CARDS } from '../core/data/cards/index.js';
import { planTurn, NOVICE_AI, ADEPT_AI } from '../core/ai/controller.js';
import { footprintDistance } from '../core/util/grid.js';

/**
 * Marrow Geodes: a prize on neutral ground.
 *
 * Two Marrow is most of a card, which is enough that both sides want one early — and
 * early is exactly when neither can spare the tempo to go and get it.
 */

describe('scattering', () => {
  it('places geodes on the duelist field, within its stated range', () => {
    const { state } = createCombat(NOVICE_DUELIST, 11);
    const geodes = Object.values(state.obstacles).filter((o) => o.defId === 'marrow_geode');

    const spec = NOVICE_DUELIST.marrowGeodes!;
    expect(geodes.length).toBeGreaterThanOrEqual(spec.min);
    expect(geodes.length).toBeLessThanOrEqual(spec.max);
  });

  it('keeps them out of both deployment zones', () => {
    // A geode in a summon row would either be free for its owner or block their own
    // deployment; neither is the decision it exists to create.
    for (const seed of [1, 2, 3, 7, 19]) {
      const { state } = createCombat(NOVICE_DUELIST, seed);
      const home = new Set([
        ...startingZone(state, 'player'),
        ...startingZone(state, 'enemy'),
      ]);
      for (const o of Object.values(state.obstacles)) {
        if (o.defId !== 'marrow_geode') continue;
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
        .filter((o) => o.defId === 'marrow_geode')
        .map((o) => `${o.anchor.x},${o.anchor.y}`)
        .sort()
        .join('|');

    expect(layout(b)).toBe(layout(a));
  });

  it('leaves the boss arena clean', () => {
    // Opt-in per encounter: the Trial is about the drake, not about scavenging.
    expect(IGNIS_TRIAL.marrowGeodes).toBeUndefined();
    const { state } = createCombat(IGNIS_TRIAL, 3);
    expect(Object.values(state.obstacles).some((o) => o.defId === 'marrow_geode')).toBe(false);
  });
});

describe('breaking one', () => {
  /** Puts a geode next to a player unit and returns both ids. */
  function withGeode() {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const striker = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'marrow_geode', 'player', { x: 2, y: 3 })!;
    return { state, striker, geodeId };
  }

  it('pays two marrow to whoever cracks it', () => {
    const { state, striker, geodeId } = withGeode();

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: geodeId },
    });

    expect(res.state.obstacles[geodeId]).toBeUndefined();
    expect(res.state.players.player.marrow).toBe(2);
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

  it('names the payout and the tile it fell on, so it can be shown there', () => {
    // `resourcesChanged` is a silent dial sync shared by every resource move; it cannot
    // tell the animation layer that a geode in particular just paid out, or where.
    const { state, striker, geodeId } = withGeode();
    const at = { ...state.obstacles[geodeId]!.anchor };

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: geodeId },
    });

    const paid = eventsOf(res.events, 'marrowExtracted');
    expect(paid).toHaveLength(1);
    expect(paid[0]!.amount).toBe(2);
    expect(paid[0]!.total).toBe(2);
    expect(paid[0]!.at).toEqual(at);
    expect(paid[0]!.side).toBe('player');
    // Glass, not a purse — the handler picks the shatter cue from this.
    expect(paid[0]!.source).toBe('obstacle');
  });

  it('says nothing when a pillar worth no marrow is broken', () => {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const striker = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });
    const ctx = makeCtx(state);
    const wall = spawnObstacle(ctx, 'stone_barricade', 'player', { x: 2, y: 4 })!;

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: wall },
    });
    expect(eventsOf(res.events, 'marrowExtracted')).toHaveLength(0);
  });

  it('is worth nothing to break an ordinary pillar', () => {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const striker = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 2, y: 5 } });
    const ctx = makeCtx(state);
    const wall = spawnObstacle(ctx, 'stone_barricade', 'player', { x: 2, y: 4 })!;

    const res = applyCommand(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'obstacle', id: wall },
    });

    expect(res.state.players.player.marrow).toBe(0);
  });

  it('can be taken by either side, being nobody else business', () => {
    const state = scenario({ width: 6, height: 8 });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'marrow_geode', 'player', { x: 2, y: 4 })!;
    state.activeSide = 'enemy';
    state.players.enemy.marrow = 0;

    const res = applyCommand(state, {
      type: 'attack',
      attacker: foe.id,
      target: { kind: 'obstacle', id: geodeId },
    });

    expect(res.state.players.enemy.marrow).toBe(2);
  });
});

describe('the geode itself', () => {
  it('is not a card anyone can own or be offered', () => {
    expect(CARDS.marrow_geode!.setupOnly).toBe(true);
  });

  it('dies to a single hit', () => {
    expect(CARDS.marrow_geode!.obstacleHp).toBe(10);
  });
});

describe('in play', () => {
  it('does not disturb a normal opening', () => {
    const session = new CombatSession(NOVICE_DUELIST, 9);
    expect(session.getPlayableCards().length).toBeGreaterThan(0);
    expect(session.getBoard().obstacles.length).toBeGreaterThan(0);
  });
});

describe('the AI and the geode', () => {
  /**
   * The prize used to be the player's alone. Attacks on obstacles were always enumerated,
   * but a broken Geode scored zero — so the enemy only ever clipped one incidentally, and
   * the roadmap carried the note: "free value the AI declines." The extraction now scores
   * through the same weight channelling uses, and the pursue term counts a Geode as
   * quarry, so the middle of the board is contested instead of gifted.
   */
  it('cracks a geode standing next to it', () => {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    // A footman, not an imp: at MOV 2 the crack (7) wins the plain auction against the
    // best advance (6), so even the greedy Novice takes it. A faster body walking past
    // the prize is the lookahead case below.
    const footman = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 3 } });
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 5, y: 7 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'marrow_geode', 'player', { x: 2, y: 4 })!;
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const cracked = commands.some(
      (c) => c.type === 'attack' && c.attacker === footman.id
        && c.target.kind === 'obstacle' && c.target.id === geodeId,
    );
    expect(cracked, 'the enemy should take the two marrow sitting next to it').toBe(true);
  });

  it('cracks before advancing, given one action of lookahead', () => {
    // A Hasted imp covers three rows a turn, and a plain advance (9) outbids the crack
    // (7) — so the greedy Novice walks past the prize, exactly as the controller's own
    // comment predicts: "moving first scores well on its own but leaves nothing." The
    // Adept re-values a candidate by what it leaves available, and the crack leaves the
    // move.
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 5, y: 7 } });
    const ctx = makeCtx(state);
    const geodeId = spawnObstacle(ctx, 'marrow_geode', 'player', { x: 2, y: 4 })!;
    state.activeSide = 'enemy';

    const commands = planTurn(state, 'enemy', ADEPT_AI);
    const cracked = commands.some(
      (c) => c.type === 'attack' && c.attacker === imp.id
        && c.target.kind === 'obstacle' && c.target.id === geodeId,
    );
    expect(cracked, 'the Adept should crack first and still make its move').toBe(true);
  });

  it('walks toward a geode when it is the nearest thing worth breaking', () => {
    const state = scenario({ width: 6, height: 8, marrow: 0 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 } });
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 5, y: 7 } });
    const ctx = makeCtx(state);
    const geodeObstacleId = spawnObstacle(ctx, 'marrow_geode', 'player', { x: 2, y: 3 })!;
    const geode = state.obstacles[geodeObstacleId]!;
    state.activeSide = 'enemy';

    const before = footprintDistance(imp, geode);
    const commands = planTurn(state, 'enemy', NOVICE_AI);
    const moved = commands.find((c) => c.type === 'moveUnit' && c.unit === imp.id);
    expect(moved, 'the imp should move at all').toBeDefined();
    if (moved?.type === 'moveUnit') {
      const after = footprintDistance({ ...imp, anchor: moved.to }, geode);
      expect(after, 'and the move should close on the geode').toBeLessThan(before);
    }
  });
});
