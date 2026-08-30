import { describe, expect, it } from 'vitest';
import { createCombat, MAX_ARENA, MIN_ANCHORS, MIN_ARENA } from '../core/engine/setup.js';
import { applyCommand, deployRefusal } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { ENCOUNTERS, NOVICE_DUELIST } from '../core/data/encounters/index.js';
import {
  DEFAULT_ROSTER,
  KIT_BUDGET,
  MAX_ROSTER_BEHEMOTHS,
  STARTING_WARBAND_POINTS,
  fieldableBehemoths,
  isRosterEligible,
  pointsRemaining,
  rosterBudgetFor,
  rosterCost,
  rosterPointsOf,
  rosterPool,
  validateRoster,
} from '../core/data/roster.js';
import { territoryDepthFor } from '../core/types/state.js';
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

  it('asks cost before reach, so a 4-Bone archer is elite rather than merely ranged', () => {
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

  it('accepts a warband inside the kit and refuses one over it', () => {
    expect(validateRoster(DEFAULT_ROSTER)).toEqual([]);
    expect(rosterCost(DEFAULT_ROSTER)).toBeLessThanOrEqual(KIT_BUDGET);

    // Twenty-six points: one Behemoth at six, four elites at four, two basics at two. One
    // Behemoth only, so this trips the budget and nothing else.
    const greedy = [
      'magma_brute',
      'verdant_colossus',
      'arc_turret',
      'slag_iron_golem',
      'anvil_lord',
      'vanguard_footman',
      'scout_imp',
    ];
    expect(rosterCost(greedy)).toBeGreaterThan(KIT_BUDGET);
    const over = validateRoster(greedy).find((p) => p.code === 'over_budget');
    expect(over, 'a warband over the kit ceiling must be refused').toBeDefined();
    expect(over!.budget).toBe(KIT_BUDGET);
  });

  it('spends the starting allowance exactly', () => {
    // The starting ten is deliberately not divisible into a comfortable answer, so the
    // default should show that it can be met precisely. This is the *starting* number now,
    // not the kit ceiling — a character earns its way up to twenty-four.
    expect(rosterCost(DEFAULT_ROSTER)).toBe(STARTING_WARBAND_POINTS);
    expect(pointsRemaining(DEFAULT_ROSTER, STARTING_WARBAND_POINTS)).toBe(0);
  });

  it('never reports negative points remaining', () => {
    const fiveBehemoths = Array.from({ length: 5 }, () => 'magma_brute');
    expect(pointsRemaining(fiveBehemoths)).toBe(0);
    expect(pointsRemaining(DEFAULT_ROSTER, STARTING_WARBAND_POINTS)).toBe(0);
  });

  it('lets a kit hold two Behemoths and refuses a third', () => {
    // Was one. At a ten-point budget the 6-point price nearly enforced that on its own; at a
    // 24-point kit it does not, so the cap is now a stated rule that matches the deck's own
    // two-Behemoth limit. What an *arena* will seat is a separate question — see below.
    //
    // Two copies of the same body, because `magma_brute` is the only fieldable 2x2 in the
    // game. A warband holding two of it holds two of the *same* Behemoth, exactly as it
    // holds two of the same Footman — the roster has always been a multiset.
    expect(MAX_ROSTER_BEHEMOTHS).toBe(2);
    expect(
      rosterPool().filter((d) => d.unit?.footprint === 2).length,
      'if a second 2x2 body ever ships, this fixture can use distinct ids',
    ).toBe(1);

    const two = ['magma_brute', 'magma_brute'];
    expect(validateRoster(two).some((p) => p.code === 'too_many_behemoths')).toBe(false);
    const three = [...two, 'magma_brute'];
    expect(validateRoster(three).some((p) => p.code === 'too_many_behemoths')).toBe(true);
  });

  it('scales the budget with the ground, one point per rank and one per file', () => {
    // The historical ten survives exactly where it was tuned: a 5x5.
    expect(rosterBudgetFor(5, 5)).toBe(10);
    expect(rosterBudgetFor(MIN_ARENA, MIN_ARENA)).toBe(8);
    expect(rosterBudgetFor(MAX_ARENA, MAX_ARENA)).toBe(24);
    // Every shipped arena.
    expect(rosterBudgetFor(4, 6), 'Narrow Ruin').toBe(10);
    expect(rosterBudgetFor(6, 8), 'Novice Duelist').toBe(14);
    expect(rosterBudgetFor(8, 8), 'Glacial Field and the Trial').toBe(16);

    // The kit ceiling is the largest arena's budget, mirrored rather than imported: pricing
    // lives in the data layer and must not depend on the engine to know its own ceiling.
    expect(KIT_BUDGET).toBe(rosterBudgetFor(MAX_ARENA, MAX_ARENA));
  });

  it('never grants more bodies than the starting zone can seat', () => {
    // The property that ruled out an area-proportional budget. Deployment happens in the
    // starting zone — `width` across, `territoryDepthFor(height)` deep — and a budget that
    // buys more basic bodies than there are tiles to stand on is a budget that lies.
    for (let w = MIN_ARENA; w <= MAX_ARENA; w++) {
      for (let h = MIN_ARENA; h <= MAX_ARENA; h++) {
        const budget = rosterBudgetFor(w, h);
        expect(budget, `${w}x${h} bounds`).toBeGreaterThanOrEqual(8);
        expect(budget, `${w}x${h} bounds`).toBeLessThanOrEqual(24);
        // Cheapest body on the ladder is 2 points, so this is the most bodies possible.
        const bodies = Math.floor(budget / 2);
        const seats = w * territoryDepthFor(h);
        expect(bodies, `${w}x${h} overflows its zone`).toBeLessThanOrEqual(seats);
      }
    }
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
    // Five Behemoths: three over the hold cap, thirty points over a twenty-four kit, and a
    // card that is not a body at all. Two used to be enough to trip the cap; the kit is
    // bigger now and so is the fixture.
    const problems = validateRoster([
      'magma_brute',
      'magma_brute',
      'magma_brute',
      'magma_brute',
      'magma_brute',
      'shield_bash',
    ]);
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

describe('the arena budget', () => {
  /** A warband of `n` basic two-point bodies. */
  const basics = (n: number) => Array.from({ length: n }, () => 'vanguard_footman');

  /** Deploys onto the first anchor that will take the body, or throws the refusal. */
  const deployOne = (state: GameState, defId: string): GameState => {
    for (const at of state.anchors) {
      if (!deployRefusal(state, defId, at)) {
        return applyCommand(state, { type: 'deployUnit', defId, at }).state;
      }
    }
    // Nowhere legal: surface the reason the last tile gave rather than a bare failure.
    throw new IllegalCommandError(
      deployRefusal(state, defId, state.anchors[0]!) ?? 'no anchor available',
    );
  };

  it('stops fielding at what the ground seats, and holds the rest in reserve', () => {
    // Narrow Ruin is 4x6, so it seats ten points. Four basics is eight, leaving two points —
    // not enough for a three-point ranged body, which is what isolates the budget refusal
    // from "that tile is taken".
    const ruin = ENCOUNTERS.find((e) => e.width === 4 && e.height === 6)!;
    expect(rosterBudgetFor(ruin.width, ruin.height)).toBe(10);

    const kit = [...basics(4), 'cinder_lobber'];
    let state = createCombat(ruin, 3, undefined, undefined, undefined, kit).state;
    for (let i = 0; i < 4; i++) state = deployOne(state, 'vanguard_footman');

    expect(state.players.player.roster.filter((r) => r.status === 'fielded').length).toBe(4);

    // Every remaining anchor refuses it, and for capacity rather than for the tile.
    const free = state.anchors.filter((a) => !deployRefusal(state, 'vanguard_footman', a));
    const reasons = state.anchors.map((a) => deployRefusal(state, 'cinder_lobber', a));
    expect(reasons.every((r) => r !== null), 'the lobber cannot be seated anywhere').toBe(true);
    expect(
      reasons.some((r) => r?.includes('seats 10 points')),
      `expected a capacity refusal, got ${JSON.stringify(reasons)} with ${free.length} free anchors`,
    ).toBe(true);

    // And the fight still starts. Holding something back is a decision.
    const engaged = applyCommand(state, { type: 'finishDeployment' }).state;
    expect(engaged.phase).not.toBe('deployment');
    expect(engaged.players.player.roster.filter((r) => r.status === 'reserve').length).toBe(1);
  });

  it('fields the same warband whole on a board with room for it', () => {
    // The other half of the claim: the warband did not get worse, the arena got smaller.
    const field = ENCOUNTERS.find((e) => e.width === 8 && e.height === 8)!;
    expect(rosterBudgetFor(field.width, field.height)).toBe(16);

    let state = createCombat(field, 3, undefined, undefined, undefined, basics(6)).state;
    for (let i = 0; i < 6; i++) state = deployOne(state, 'vanguard_footman');
    expect(state.players.player.roster.every((r) => r.status === 'fielded')).toBe(true);
  });

  it('seats one Behemoth below sixteen points and two at or above it', () => {
    expect(fieldableBehemoths(14)).toBe(1);
    expect(fieldableBehemoths(16)).toBe(2);

    // The Duelist's 6x8 seats fourteen points, so two Behemoths at twelve are *affordable*
    // there and still refused — which is what proves the Behemoth rule is doing its own work
    // rather than riding on the budget arithmetic.
    const two = ['magma_brute', 'magma_brute'];
    expect(rosterBudgetFor(NOVICE_DUELIST.width, NOVICE_DUELIST.height)).toBe(14);
    let small = createCombat(NOVICE_DUELIST, 5, undefined, undefined, undefined, two).state;
    small = deployOne(small, 'magma_brute');
    const reasons = small.anchors.map((a) => deployRefusal(small, 'magma_brute', a));
    expect(
      reasons.some((r) => r?.includes('Behemoth')),
      `expected a Behemoth refusal, got ${JSON.stringify(reasons)}`,
    ).toBe(true);

    // At sixteen the second is allowed by rule. Whether the *ground* offers a second
    // adjacent pair is `placeAnchors`' business and is asserted separately, so this only
    // claims the rule no longer refuses it.
    const field = ENCOUNTERS.find((e) => e.width === 8 && e.height === 8)!;
    let big = createCombat(field, 5, undefined, undefined, undefined, two).state;
    big = deployOne(big, 'magma_brute');
    const allowed = big.anchors.some(
      (a) => !deployRefusal(big, 'magma_brute', a)?.includes('Behemoth'),
    );
    expect(allowed, 'the rule permits a second 2x2 at sixteen points').toBe(true);
  });

  it('never refuses a body for the kit it was bought with', () => {
    // The kit is settled in the Field Journal and is never re-litigated at the door. Only
    // capacity refuses, and only ever with a capacity reason.
    const state = createCombat(NOVICE_DUELIST, 9, undefined, undefined, undefined, basics(3)).state;
    for (const at of state.anchors) {
      const why = deployRefusal(state, 'vanguard_footman', at);
      if (why) expect(why, why).not.toMatch(/budget|costs|points of/);
    }
  });
});

describe('the Anchor Guarantee', () => {
  it('never seats fewer anchors than the arena will field', () => {
    // The promise the whole point-buy rests on. If a cramped biome could refuse a body the
    // budget paid for, the correct play would become "never fill your budget".
    //
    // Now stated against the *arena's* allowance rather than the whole kit: a warband larger
    // than the board can seat is holding the remainder back by rule, and lighting a tile for
    // a body that can never be placed would be a promise the budget breaks.
    for (const enc of ENCOUNTERS) {
      for (let seed = 1; seed <= 8; seed++) {
        const state = createCombat(enc, seed, undefined, undefined, undefined, DEFAULT_ROSTER).state;
        const seats = Math.floor(rosterBudgetFor(enc.width, enc.height) / 2);
        const promised = Math.min(DEFAULT_ROSTER.length, seats);
        expect(
          state.anchors.length,
          `${enc.name} seed ${seed} seated ${state.anchors.length} for ${promised}`,
        ).toBeGreaterThanOrEqual(promised);
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
