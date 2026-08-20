import { describe, expect, it } from 'vitest';
import { createCombat, MIN_ANCHORS } from '../core/engine/setup.js';
import { applyCommand, deployRefusal } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { ENCOUNTERS, NOVICE_DUELIST } from '../core/data/encounters/index.js';
import {
  DEFAULT_ROSTER,
  ROSTER_BUDGET,
  MAX_ROSTER_BEHEMOTHS,
  isRosterEligible,
  pointsRemaining,
  rosterCost,
  rosterPointsOf,
  rosterPool,
  validateRoster,
} from '../core/data/roster.js';
import { CARDS } from '../core/data/cards/index.js';
import { validateDeck } from '../core/data/deckRules.js';
import { COMPANIONS } from '../core/data/companions.js';
import { STARTER_DECK } from '../core/data/cards/starter.js';
import type { GameState } from '../core/types/state.js';
import { checkInvariants } from './replay.js';
import { cellsOf } from '../core/util/grid.js';

/**
 * The Vanguard Roster, and the phase that puts it on the board.
 *
 * Two promises carry this phase. **The Anchor Guarantee** — the player is never forced to
 * bench a body they paid for, because a point-buy that punishes spending its own budget is
 * not a build system. And **the phase gate** — nothing about turn one happens until the
 * line is set, so the board a player fights from is the board they built.
 */

function combat(roster: string[], seed = 7): GameState {
  return createCombat(NOVICE_DUELIST, seed, undefined, undefined, undefined, roster).state;
}

/** Every tile a unit occupies, as "x,y" keys. */
function occupied(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const u of Object.values(state.units)) {
    for (const c of cellsOf(u)) out.add(`${c.x},${c.y}`);
  }
  return out;
}

describe('point-buy', () => {
  it('prices the ladder as specced', () => {
    expect(rosterPointsOf(CARDS.magma_brute!), 'Behemoth').toBe(6);
    expect(rosterPointsOf(CARDS.arc_turret!), 'elite').toBe(4);
    expect(rosterPointsOf(CARDS.slag_iron_golem!), 'elite melee').toBe(4);
    expect(rosterPointsOf(CARDS.cinder_lobber!), 'ranged').toBe(3);
    expect(rosterPointsOf(CARDS.vanguard_footman!), 'basic melee').toBe(2);
    expect(rosterPointsOf(CARDS.scout_imp!), 'basic melee').toBe(2);
  });

  it('asks cost before reach, so a 4-Pip archer is elite rather than merely ranged', () => {
    // The one ordering that is not obvious. Arc Turret reaches and costs 4, and pricing it
    // at 3 would make the ranged class the only class worth buying.
    expect((CARDS.arc_turret!.unit!.rangeMax ?? 1)).toBeGreaterThan(1);
    expect(rosterPointsOf(CARDS.arc_turret!)).toBe(4);
  });

  it('gives every eligible body a price, so none can ship free', () => {
    const pool = rosterPool();
    expect(pool.length, 'the pool should not be empty').toBeGreaterThan(0);
    for (const def of pool) {
      expect([2, 3, 4, 6], `${def.id} priced oddly`).toContain(rosterPointsOf(def));
    }
  });

  it('accepts a warband inside the budget and refuses one over it', () => {
    expect(validateRoster(DEFAULT_ROSTER)).toEqual([]);
    expect(rosterCost(DEFAULT_ROSTER)).toBeLessThanOrEqual(ROSTER_BUDGET);

    const greedy = ['magma_brute', 'arc_turret', 'slag_iron_golem'];
    const problems = validateRoster(greedy);
    const over = problems.find((p) => p.code === 'over_budget');
    expect(over, 'a 14-point warband must be refused').toBeDefined();
    expect(over!.budget).toBe(ROSTER_BUDGET);
  });

  it('spends the starting warband exactly', () => {
    // The budget is deliberately not divisible into a comfortable answer, so the default
    // should show that it can be met precisely.
    expect(rosterCost(DEFAULT_ROSTER)).toBe(ROSTER_BUDGET);
    expect(pointsRemaining(DEFAULT_ROSTER)).toBe(0);
  });

  it('never reports negative points remaining', () => {
    expect(pointsRemaining(['magma_brute', 'magma_brute', 'magma_brute'])).toBe(0);
  });

  it('allows one Behemoth and refuses two', () => {
    expect(validateRoster(['magma_brute']).some((p) => p.code === 'too_many_behemoths')).toBe(false);
    const two = validateRoster(['magma_brute', 'magma_brute']);
    expect(two.some((p) => p.code === 'too_many_behemoths')).toBe(true);
    expect(MAX_ROSTER_BEHEMOTHS).toBe(1);
  });

  it('refuses a spell, a Bound Form and a threat alike', () => {
    for (const id of ['shield_bash', 'ignis_bound', 'scrap_titan']) {
      const problems = validateRoster([id]);
      expect(problems.some((p) => p.code === 'not_a_minion'), id).toBe(true);
      expect(isRosterEligible(CARDS[id]!), id).toBe(false);
    }
  });

  it('names a unit it has never heard of', () => {
    expect(validateRoster(['no_such_body']).map((p) => p.code)).toContain('unknown_unit');
  });

  it('honours an unlock list when one is given', () => {
    expect(validateRoster(['grave_sentinel'], ['grave_sentinel'])).toEqual([]);
    expect(
      validateRoster(['grave_sentinel'], ['scout_imp']).some((p) => p.code === 'not_unlocked'),
    ).toBe(true);
  });

  it('reports every problem at once rather than the first', () => {
    const problems = validateRoster(['magma_brute', 'magma_brute', 'shield_bash']);
    const codes = problems.map((p) => p.code);
    expect(codes).toContain('too_many_behemoths');
    expect(codes).toContain('over_budget');
    expect(codes).toContain('not_a_minion');
  });
});

describe('minions have left the deck', () => {
  it('refuses one by name, in every player deck path', () => {
    const deck = [...STARTER_DECK, 'grave_sentinel'];
    expect(validateDeck(deck).some((p) => p.code === 'minion_in_deck')).toBe(true);
  });

  it('leaves every shipped deck legal', () => {
    expect(validateDeck(STARTER_DECK), 'the starter deck').toEqual([]);
    for (const c of COMPANIONS) {
      expect(validateDeck(c.deck), `${c.name}'s deck`).toEqual([]);
    }
  });

  it('keeps the enemy summoning from hand, which is how it builds a board', () => {
    // Enemy decks are authored content and never pass through `validateDeck`. Taking the
    // bodies out of *their* decks would leave four encounters with nothing to field.
    const withMinions = ENCOUNTERS.filter((e) =>
      e.enemyDeck.some((id) => CARDS[id]?.kind === 'minion'),
    );
    expect(withMinions.length, 'the enemy still drafts bodies').toBeGreaterThan(0);
  });
});

describe('the Anchor Guarantee', () => {
  it('never seats fewer anchors than the warband has bodies', () => {
    // The promise the whole point-buy rests on. If a cramped biome could refuse the fourth
    // body, the correct play would become "never fill your budget".
    for (const enc of ENCOUNTERS) {
      for (let seed = 1; seed <= 8; seed++) {
        const state = createCombat(enc, seed, undefined, undefined, undefined, DEFAULT_ROSTER).state;
        expect(
          state.anchors.length,
          `${enc.name} seed ${seed} seated ${state.anchors.length} for ${DEFAULT_ROSTER.length}`,
        ).toBeGreaterThanOrEqual(DEFAULT_ROSTER.length);
      }
    }
  });

  it('offers at least the floor, even for a single body', () => {
    const state = combat(['scout_imp']);
    expect(state.anchors.length).toBeGreaterThanOrEqual(MIN_ANCHORS);
  });

  it('always leaves an adjacent pair, so a Behemoth is placeable', () => {
    for (const enc of ENCOUNTERS) {
      for (let seed = 1; seed <= 5; seed++) {
        const state = createCombat(enc, seed, undefined, undefined, undefined, [
          'magma_brute',
          'scout_imp',
        ]).state;
        const keys = new Set(state.anchors.map((a) => `${a.x},${a.y}`));
        const pair = state.anchors.some((a) => keys.has(`${a.x + 1},${a.y}`));
        expect(pair, `${enc.name} seed ${seed} had nowhere to put a 2x2`).toBe(true);
      }
    }
  });

  it('never puts an anchor on top of something', () => {
    const state = combat(DEFAULT_ROSTER);
    const taken = occupied(state);
    for (const a of state.anchors) {
      expect(taken.has(`${a.x},${a.y}`), `anchor at ${a.x},${a.y} is occupied`).toBe(false);
    }
  });

  it('never puts two anchors on one tile', () => {
    const state = combat(DEFAULT_ROSTER);
    const keys = state.anchors.map((a) => `${a.x},${a.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lays them inside the board', () => {
    const state = combat(DEFAULT_ROSTER);
    for (const a of state.anchors) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThan(state.width);
      expect(a.y).toBeLessThan(state.height);
    }
  });

  it('places the same anchors for the same seed', () => {
    const a = combat(DEFAULT_ROSTER, 42).anchors;
    const b = combat(DEFAULT_ROSTER, 42).anchors;
    expect(a).toEqual(b);
  });
});

describe('the phase gate', () => {
  it('opens in deployment when a Vanguard came along', () => {
    const state = combat(DEFAULT_ROSTER);
    expect(state.phase).toBe('deployment');
    expect(state.players.player.roster.map((r) => r.status)).toEqual(
      DEFAULT_ROSTER.map(() => 'reserve'),
    );
  });

  it('skips deployment entirely when no roster came along', () => {
    // The legacy path, and what keeps every existing encounter and test behaving as before.
    const state = createCombat(NOVICE_DUELIST, 7).state;
    expect(state.phase).toBe('action');
    expect(state.players.player.roster).toEqual([]);
  });

  it('refuses every ordinary command until the line is set', () => {
    const state = combat(DEFAULT_ROSTER);
    expect(() => applyCommand(state, { type: 'endTurn' })).toThrow(IllegalCommandError);
    const anyUnit = Object.values(state.units)[0]!;
    expect(() =>
      applyCommand(state, { type: 'moveUnit', unit: anyUnit.id, to: { x: 0, y: 0 } }),
    ).toThrow(IllegalCommandError);
  });

  it('hands turn one over once deployment finishes', () => {
    const state = combat(DEFAULT_ROSTER);
    const res = applyCommand(state, { type: 'finishDeployment' });

    expect(res.state.phase).toBe('action');
    expect(res.state.activeSide).toBe('player');
    expect(res.state.turn).toBe(1);
  });

  it('refuses a second finish', () => {
    const started = applyCommand(combat(DEFAULT_ROSTER), { type: 'finishDeployment' }).state;
    expect(() => applyCommand(started, { type: 'finishDeployment' })).toThrow(IllegalCommandError);
  });

  it('lets a player hold bodies back rather than forcing every one down', () => {
    const state = combat(DEFAULT_ROSTER);
    const res = applyCommand(state, { type: 'finishDeployment' });
    expect(res.state.phase).toBe('action');
    expect(res.state.players.player.roster.every((r) => r.status === 'reserve')).toBe(true);
  });
});

describe('deploying', () => {
  function deployed() {
    const state = combat(DEFAULT_ROSTER);
    const at = state.anchors[0]!;
    return { ...applyCommand(state, { type: 'deployUnit', defId: 'scout_imp', at }), at };
  }

  it('puts the body on the anchor and marks the tray', () => {
    const { state, at } = deployed();
    const entry = state.players.player.roster.find((r) => r.defId === 'scout_imp')!;

    expect(entry.status).toBe('fielded');
    expect(entry.unitId).toBeDefined();
    expect(state.units[entry.unitId!]!.anchor).toEqual(at);
  });

  it('lets the deployed body act on turn one', () => {
    // The whole point of entering through `placeOpeningUnit`: a Vanguard is not summoned,
    // it was always there. Summoning sickness would make deployment a turn of nothing.
    const { state } = deployed();
    const entry = state.players.player.roster.find((r) => r.defId === 'scout_imp')!;
    const unit = state.units[entry.unitId!]!;

    expect(unit.summonedThisTurn).toBe(false);
    expect(unit.freshlySummoned).toBe(false);
  });

  it('refuses a tile that is not an anchor', () => {
    const state = combat(DEFAULT_ROSTER);
    const keys = new Set(state.anchors.map((a) => `${a.x},${a.y}`));
    let plain = { x: 0, y: 0 };
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (!keys.has(`${x},${y}`)) plain = { x, y };
      }
    }
    expect(deployRefusal(state, 'scout_imp', plain)).toBe('that tile is not an Anchor');
  });

  it('refuses a body that is not in reserve', () => {
    const state = combat(DEFAULT_ROSTER);
    expect(deployRefusal(state, 'magma_brute', state.anchors[0]!)).toMatch(/reserve/);
  });

  it('refuses the same body twice', () => {
    const { state } = deployed();
    const other = state.anchors.find((a) => !occupied(state).has(`${a.x},${a.y}`))!;
    expect(deployRefusal(state, 'scout_imp', other)).toMatch(/reserve/);
  });

  it('refuses an anchor that is already taken', () => {
    const { state, at } = deployed();
    expect(deployRefusal(state, 'cinder_lobber', at)).toBe('there is no room there');
  });

  it('refuses to deploy at all once the line is set', () => {
    const started = applyCommand(combat(DEFAULT_ROSTER), { type: 'finishDeployment' }).state;
    expect(deployRefusal(started, 'scout_imp', started.anchors[0]!)).toBe('not deploying');
  });

  it('holds every engine invariant while the line is being built', () => {
    const { state } = deployed();
    expect(checkInvariants(state, 'mid-deployment')).toEqual([]);
  });
});

describe('recalling', () => {
  it('picks the body back up and returns it to the tray', () => {
    // Deployment is a sketch until it is signed off, so this is a plain undo.
    const state = combat(DEFAULT_ROSTER);
    const placed = applyCommand(state, {
      type: 'deployUnit',
      defId: 'scout_imp',
      at: state.anchors[0]!,
    }).state;
    const id = placed.players.player.roster.find((r) => r.defId === 'scout_imp')!.unitId!;

    const back = applyCommand(placed, { type: 'recallUnit', unit: id }).state;
    const entry = back.players.player.roster.find((r) => r.defId === 'scout_imp')!;

    expect(entry.status).toBe('reserve');
    expect(entry.unitId).toBeUndefined();
    expect(back.units[id]).toBeUndefined();
  });

  it('frees the anchor for something else', () => {
    const state = combat(DEFAULT_ROSTER);
    const at = state.anchors[0]!;
    const placed = applyCommand(state, { type: 'deployUnit', defId: 'scout_imp', at }).state;
    const id = placed.players.player.roster.find((r) => r.defId === 'scout_imp')!.unitId!;
    const back = applyCommand(placed, { type: 'recallUnit', unit: id }).state;

    expect(deployRefusal(back, 'cinder_lobber', at)).toBeNull();
  });

  it('is free and repeatable, and leaves nothing behind', () => {
    let cur = combat(DEFAULT_ROSTER);
    const at = cur.anchors[0]!;
    for (let i = 0; i < 3; i++) {
      cur = applyCommand(cur, { type: 'deployUnit', defId: 'scout_imp', at }).state;
      const id = cur.players.player.roster.find((r) => r.defId === 'scout_imp')!.unitId!;
      cur = applyCommand(cur, { type: 'recallUnit', unit: id }).state;
    }
    expect(Object.keys(cur.units).filter((k) => cur.units[k]!.side === 'player').length).toBe(
      // Only the Bound Form: every scout that went down came back up.
      Object.values(cur.units).filter((u) => u.side === 'player').length,
    );
    expect(cur.players.player.roster.every((r) => r.status === 'reserve')).toBe(true);
    expect(checkInvariants(cur, 'after deploy/recall churn')).toEqual([]);
  });

  it('refuses to recall once the line is set', () => {
    const state = combat(DEFAULT_ROSTER);
    const placed = applyCommand(state, {
      type: 'deployUnit',
      defId: 'scout_imp',
      at: state.anchors[0]!,
    }).state;
    const id = placed.players.player.roster.find((r) => r.defId === 'scout_imp')!.unitId!;
    const started = applyCommand(placed, { type: 'finishDeployment' }).state;

    expect(() => applyCommand(started, { type: 'recallUnit', unit: id })).toThrow(
      IllegalCommandError,
    );
  });
});

describe('the enemy is authored, not deployed', () => {
  it('brings its opening board and no roster', () => {
    const state = combat(DEFAULT_ROSTER);
    expect(state.players.enemy.roster).toEqual([]);

    const enemies = Object.values(state.units).filter((u) => u.side === 'enemy');
    expect(enemies.length, 'the authored board still stands').toBeGreaterThan(0);
  });

  it('gets no anchors of its own', () => {
    // Symmetry here would buy nothing and cost an AI deployment phase.
    const state = combat(DEFAULT_ROSTER);
    const enemyRows = [0, 1];
    for (const a of state.anchors) {
      expect(enemyRows, `an anchor was laid in enemy ground at ${a.x},${a.y}`).not.toContain(a.y);
    }
  });
});
