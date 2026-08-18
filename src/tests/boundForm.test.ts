import { describe, expect, it } from 'vitest';
import { addUnit, atTile, eventsOf, findUnit, handCard, play, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { IllegalCommandError } from '../core/types/commands.js';
import { legalAttacks, legalCardTargets } from '../core/engine/targeting.js';
import { enumerateActions } from '../core/ai/enumerate.js';
import { checkInvariants } from './replay.js';
import { CombatSession } from '../core/session.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
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

  it('refuses to sacrifice anything worth no marrow', () => {
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

describe('the Companion takes the field', () => {
  it('places the chosen Companion, and only the chosen one', () => {
    for (const [companionId, expected] of [
      ['ignis', 'ignis_bound'],
      ['boreas', 'boreas_bound'],
    ] as const) {
      const session = new CombatSession(ENCOUNTERS[0]!, 7, undefined, companionId);
      const st = session.debugState;

      const mine = Object.values(st.units).filter(
        (u) => u.side === 'player' && u.keywords.includes('BoundForm'),
      );
      expect(mine.length, `${companionId} should field exactly one body`).toBe(1);
      expect(mine[0]!.defId).toBe(expected);
      expect(st.players.player.companionUnitId).toBe(mine[0]!.id);
      expect(st.players.player.companionUnitDefId).toBe(expected);
    }
  });

  it('stands it in its own Resonance lane on the back row', () => {
    const session = new CombatSession(ENCOUNTERS[0]!, 7, undefined, 'ignis');
    const st = session.debugState;
    const body = st.units[st.players.player.companionUnitId!]!;

    expect(body.anchor.y).toBe(st.height - 1);
    expect(body.anchor.x).toBe(st.players.player.companionColumn);
  });

  it('gives the enemy a body only when the encounter asks for one', () => {
    // Having a body is a property of the fight, not of being the enemy. A duelist mirrors
    // you; something else may still command wholly from off the board.
    for (const enc of ENCOUNTERS) {
      const session = new CombatSession(enc, 7);
      const st = session.debugState;
      const theirs = Object.values(st.units).filter(
        (u) => u.side === 'enemy' && u.keywords.includes('BoundForm'),
      );

      if (enc.enemyCompanion) {
        expect(theirs.length, `${enc.id} should field one`).toBe(1);
        expect(theirs[0]!.defId).toBe(enc.enemyCompanion.unitCardId);
        expect(st.players.enemy.companionUnitId).toBe(theirs[0]!.id);
      } else {
        expect(theirs.length, `${enc.id} should field none`).toBe(0);
        expect(st.players.enemy.companionUnitDefId).toBeUndefined();
      }
    }
  });

  it('can act from turn one, like the Vanguard beside it', () => {
    const session = new CombatSession(ENCOUNTERS[0]!, 7, undefined, 'ignis');
    const id = session.debugState.players.player.companionUnitId!;
    expect(session.getLegalMoves(id).length).toBeGreaterThan(0);
  });

  it('restores the body when sudden death wipes the board', () => {
    // Both Pacts revive at 1 HP, so the Companion has to come back with them — otherwise
    // the rest of the fight is played with no Companion and no elemental origin.
    const session = new CombatSession(ENCOUNTERS[0]!, 7, undefined, 'ignis');
    const st = session.debugState;
    const before = st.players.player.companionUnitId;

    // Drive the mutual KO straight through the lethal checker, as armor.test.ts does.
    st.players.player.hp = 0;
    st.players.enemy.hp = 0;
    const res = applyCommand(st, { type: 'endTurn' });

    expect(res.state.suddenDeath).toBe(true);
    const after = res.state.players.player.companionUnitId;
    expect(after, 'the body must return').toBeDefined();
    expect(after).not.toBe(before);
    expect(res.state.units[after!]!.keywords).toContain('BoundForm');
    expect(checkInvariants(res.state, 'after sudden death')).toEqual([]);
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

describe('the mirror', () => {
  /** The duelist fight, where both sides have a body on the board. */
  function mirror(seed = 7) {
    const session = new CombatSession(ENCOUNTERS[0]!, seed, undefined, 'ignis');
    const st = session.debugState;
    return {
      st,
      mine: st.units[st.players.player.companionUnitId!]!,
      theirs: st.units[st.players.enemy.companionUnitId!]!,
    };
  }

  it('routes damage on their body to their Pact, not ours', () => {
    const { st, theirs } = mirror();
    const striker = addUnit(st, {
      def: 'scout_imp',
      side: 'player',
      at: { x: theirs.anchor.x, y: theirs.anchor.y + 1 },
    });
    const before = { player: st.players.player.hp, enemy: st.players.enemy.hp };

    const res = applyCommand(st, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: theirs.id },
    });

    expect(res.state.players.enemy.hp).toBeLessThan(before.enemy);
    expect(res.state.players.player.hp).toBe(before.player);
    expect(res.state.units[theirs.id]!.hp).toBe(res.state.units[theirs.id]!.maxHp);
  });

  it('leaves their portrait attackable too, so both routes are open', () => {
    // True symmetry: the body is a second way in, not a replacement for the first.
    const { st } = mirror();
    const striker = addUnit(st, { def: 'scout_imp', side: 'player', at: { x: 2, y: 1 } });

    const targets = legalAttacks(st, st.units[striker.id]!);
    expect(targets.some((t) => t.kind === 'portrait' && t.side === 'enemy')).toBe(true);
  });

  it('anchors their ranged Companion cards to their body', () => {
    // The knock-on that makes the mirror real: the moment they have a body, their spells
    // are thrown from it, exactly as yours are.
    const { st, theirs } = mirror();
    expect(st.players.enemy.companionUnitDefId).toBeDefined();

    const near = legalCardTargets(st, 'enemy', 'flame_surge');
    const reach = near.flatMap((t) => (t.kind === 'line' ? [t.from] : []));
    for (const from of reach) {
      const dist = Math.max(
        Math.abs(from.x - theirs.anchor.x),
        Math.abs(from.y - theirs.anchor.y),
      );
      expect(dist, 'cast from beyond their Companion reach').toBeLessThanOrEqual(4);
    }
    expect(reach.length).toBeGreaterThan(0);
  });

  it('restores both bodies after sudden death', () => {
    const { st } = mirror();
    st.players.player.hp = 0;
    st.players.enemy.hp = 0;

    const res = applyCommand(st, { type: 'endTurn' });

    expect(res.state.suddenDeath).toBe(true);
    for (const side of ['player', 'enemy'] as const) {
      const id = res.state.players[side].companionUnitId;
      expect(id, `${side} body must return`).toBeDefined();
      expect(res.state.units[id!]!.keywords).toContain('BoundForm');
    }
    expect(checkInvariants(res.state, 'mirror sudden death')).toEqual([]);
  });

  it('lets the AI walk its own body backwards out of danger', () => {
    // Retreats are pruned from enumeration for every other unit. The Bound Form is the
    // exception, because without it the AI cannot defend the one loss that ends the game.
    const { st, theirs } = mirror();
    st.activeSide = 'enemy';
    // It opens on its own back row, where there is nowhere further back to go. Walk it
    // out first — which is the situation the retreat rule exists for.
    theirs.anchor = { x: theirs.anchor.x, y: 3 };

    const actions = enumerateActions(st, 'enemy');
    const retreats = actions.filter(
      (a) => a.type === 'moveUnit' && a.unit === theirs.id && a.to.y < 3,
    );

    expect(retreats.length, 'the body must be able to fall back').toBeGreaterThan(0);
  });

  it('does not un-prune retreats for ordinary units', () => {
    const { st } = mirror();
    st.activeSide = 'enemy';
    const pawn = addUnit(st, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 3 } });

    const actions = enumerateActions(st, 'enemy');
    const back = actions.filter(
      (a) => a.type === 'moveUnit' && a.unit === pawn.id && a.to.y < 3,
    );

    expect(back).toHaveLength(0);
  });
});
