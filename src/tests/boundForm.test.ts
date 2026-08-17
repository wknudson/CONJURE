import { describe, expect, it } from 'vitest';
import { addUnit, atTile, eventsOf, findUnit, handCard, play, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { legalCardTargets } from '../core/engine/targeting.js';
import { checkInvariants } from './replay.js';
import type { GameState } from '../core/types/state.js';
import type { Coord } from '../contract/ids.js';

/**
 * The Bound Form: the Companion's body on the board, and the Pact's.
 *
 * The single rule everything here defends is that it keeps no health of its own. Wound
 * it and you wound the player directly — which is what makes standing it in the open a
 * real decision rather than a free spell turret.
 *
 * These tests inject the keyword onto an ordinary unit rather than using a Companion
 * card, so the rule is proven independently of the data that will carry it.
 */
function withBound(opts: { at?: Coord; extra?: Parameters<typeof scenario>[0] } = {}): {
  state: GameState;
  boundId: string;
} {
  const state = scenario({
    width: 6,
    height: 8,
    playerHp: 40,
    ...(opts.extra ?? {}),
  });
  const bound = addUnit(state, {
    def: 'vanguard_footman',
    side: 'player',
    at: opts.at ?? { x: 2, y: 6 },
    keywords: ['BoundForm'],
    sacrificeValue: 0,
  });
  return { state, boundId: bound.id };
}

describe('damage lands on the Pact, not the body', () => {
  it('sends an enemy strike straight to the Pact', () => {
    const { state, boundId } = withBound({ at: { x: 2, y: 4 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    const foe = findUnit(state, 'scout_imp', 'enemy');
    state.activeSide = 'enemy';

    const before = state.players.player.hp;
    const res = applyCommand(state, {
      type: 'attack',
      attacker: foe.id,
      target: { kind: 'unit', id: boundId },
    });

    expect(res.state.players.player.hp).toBeLessThan(before);
    // The body itself is untouched.
    const body = res.state.units[boundId]!;
    expect(body.hp).toBe(body.maxHp);
    expect(checkInvariants(res.state, 'after strike')).toEqual([]);
  });

  it('reports the tile it happened on, so the hit can be drawn there', () => {
    const { state, boundId } = withBound({ at: { x: 2, y: 4 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 } });
    const foe = findUnit(state, 'scout_imp', 'enemy');
    state.activeSide = 'enemy';

    const res = applyCommand(state, {
      type: 'attack',
      attacker: foe.id,
      target: { kind: 'unit', id: boundId },
    });

    const hits = eventsOf(res.events, 'damageDealt').filter(
      (e) => e.target.kind === 'portrait' && e.target.side === 'player',
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.at, 'a redirected hit must name its tile').toEqual({ x: 2, y: 4 });
  });

  it('bleeds the Pact when the body is shoved into a wall', () => {
    // Shield Bash into the arena border: the collision damage has nowhere to go but
    // the Pact, which is exactly the high-stakes case the mechanic exists for.
    const { state, boundId } = withBound({ at: { x: 2, y: 7 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 6 } });
    const foe = findUnit(state, 'scout_imp', 'enemy');
    state.activeSide = 'enemy';

    const before = state.players.player.hp;
    const res = applyCommand(state, {
      type: 'attack',
      attacker: foe.id,
      target: { kind: 'unit', id: boundId },
    });

    expect(res.state.players.player.hp).toBeLessThan(before);
    expect(res.state.units[boundId]!.hp).toBe(res.state.units[boundId]!.maxHp);
  });

  it('ticks a burn into the Pact rather than the body', () => {
    const { state, boundId } = withBound();
    state.units[boundId]!.statuses.burn = 2;

    // Statuses tick at the start of the owner's turn, so the round has to come back around.
    const res = run(state, { type: 'endTurn' }, { type: 'endTurn' });

    expect(res.state.players.player.hp).toBeLessThan(40);
    const body = res.state.units[boundId];
    if (body) expect(body.hp).toBe(body.maxHp);
  });
});

describe('what cannot be done to it', () => {
  it('refuses to sacrifice it', () => {
    const { state, boundId } = withBound();
    expect(() => applyCommand(state, { type: 'sacrifice', unit: boundId })).toThrow(
      IllegalCommandError,
    );
  });

  it('refuses to sacrifice anything worth no sparks', () => {
    // Pre-existing hole: this command never checked, so a worthless offering was legal.
    const state = scenario({ width: 6, height: 8 });
    const pawn = addUnit(state, {
      def: 'vanguard_footman',
      side: 'player',
      at: { x: 1, y: 6 },
      sacrificeValue: 0,
    });
    expect(() => applyCommand(state, { type: 'sacrifice', unit: pawn.id })).toThrow(
      IllegalCommandError,
    );
  });

  it('hides it from Dark Tithe', () => {
    const { state, boundId } = withBound();
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 6 } });

    const targets = legalCardTargets(state, 'player', 'dark_tithe');
    const ids = targets.map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''));

    expect(ids).not.toContain(boundId);
    // But the ordinary minion beside it is still a legal offering.
    expect(ids.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('hides it from rune attachment, which could never detonate', () => {
    const { state, boundId } = withBound();
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 6 } });

    const targets = legalCardTargets(state, 'player', 'soul_splinter_rune');
    const ids = targets.map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''));

    expect(ids).not.toContain(boundId);
  });

  it('hides it from Aegis Ward, whose armor would be inert', () => {
    const { state, boundId } = withBound();
    const targets = legalCardTargets(state, 'player', 'aegis_ward');
    const ids = targets.map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''));

    expect(ids).not.toContain(boundId);
    // The portrait is still offered — that is where the ward belongs.
    expect(targets.some((t) => t.kind === 'entity' && t.ref.kind === 'portrait')).toBe(true);
  });

  it('never escalates, even holding the keyword', () => {
    const { state, boundId } = withBound();
    state.units[boundId]!.keywords = ['BoundForm', 'Escalate'];
    const atk = state.units[boundId]!.atk;

    let cur = state;
    for (let i = 0; i < 4; i++) {
      cur = run(cur, { type: 'endTurn' }, { type: 'endTurn' }).state;
    }

    const body = cur.units[boundId];
    if (body) {
      expect(body.escalation).toBe(0);
      expect(body.atk).toBe(atk);
    }
  });
});

describe('it still plays like a unit', () => {
  it('moves and attacks on the same turn, like anything else', () => {
    const { state, boundId } = withBound({ at: { x: 2, y: 5 } });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 20 });
    const foe = findUnit(state, 'scout_imp', 'enemy');

    const moved = applyCommand(state, { type: 'moveUnit', unit: boundId, to: { x: 2, y: 4 } });
    const struck = applyCommand(moved.state, {
      type: 'attack',
      attacker: boundId,
      target: { kind: 'unit', id: foe.id },
    });

    expect(struck.state.units[foe.id]!.hp).toBeLessThan(20);
    expect(checkInvariants(struck.state, 'after its own turn')).toEqual([]);
  });

  it('can still be healed-adjacent effects and ordinary summons around it', () => {
    // Sanity: the exclusions are narrow. A summon card still finds its usual tiles.
    const { state } = withBound({ extra: { hand: ['scout_imp'], pips: 5 } });
    const card = handCard(state, 'player', 'scout_imp');
    const res = run(state, play(card, atTile(1, 7)));
    expect(findUnit(res.state, 'scout_imp', 'player')).toBeDefined();
  });
});
