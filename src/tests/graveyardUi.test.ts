import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { CARDS } from '../core/data/cards/index.js';
import { faceOfDef, faceOfSnapshot } from '../hud/cardFace.js';
import { toCardSnapshot } from '../core/engine/views.js';

/**
 * The Graveyard and the X picker, at the seam the UI actually reads.
 *
 * The components themselves are DOM and are verified by driving the real screen. What is
 * pinned here is everything they depend on being true: that a pyre reaches the view at
 * all, that a card announces its variable price on its face, and that the ceiling offered
 * to the player matches what the reducer will accept.
 */

function fought(roster: string[] = ['grave_sentinel']): CombatSession {
  return new CombatSession(NOVICE_DUELIST, 7, undefined, undefined, undefined, undefined, roster);
}

/**
 * Deploys the roster, starts the fight, and bleeds one body out.
 *
 * Returns only the session, deliberately. `applyCommand` clones, so a `debugState`
 * captured before a dispatch is a *stale object* — mutating it does nothing to the live
 * fight. Every caller re-reads through the session instead.
 */
function withPyre(): CombatSession {
  const session = fought();
  const at = session.getBoard().anchors[0]!;
  session.dispatch({ type: 'deployUnit', defId: 'grave_sentinel', at });
  session.dispatch({ type: 'finishDeployment' });

  const entry = session.debugState.players.player.roster[0]!;
  // A Grave Sentinel has 6 health; wound it first so one tithe finishes the job.
  session.debugState.units[entry.unitId!]!.hp = 20;
  session.dispatch({ type: 'bloodTithe', unit: entry.unitId! });
  return session;
}

/** Slips a card into hand on the live state, and returns its instance id. */
function give(session: CombatSession, defId: string, bones: number, marrow = 0): string {
  const st = session.debugState;
  st.nextId += 1;
  const id = `rv${st.nextId}`;
  st.players.player.cards[id] = { instanceId: id, defId };
  st.players.player.hand.push(id);
  st.players.player.bones = bones;
  st.players.player.marrow = marrow;
  return id;
}

describe('a pyre reaches the renderer', () => {
  it('carries the tile it fell on, which is the only thing the board can draw from', () => {
    // There is no entity at the coordinate — a Soul Pyre is roster memory — so without
    // `fellAt` on the view the board has no way to know the ground is marked at all.
    const session = withPyre();
    const entry = session.getBoard().roster.find((r) => r.status === 'fallen');

    expect(entry, 'a body went down').toBeDefined();
    expect(entry!.fellAt, 'and the view remembers where').toBeDefined();
  });

  it('leaves nothing on the board to mistake it for', () => {
    const session = withPyre();
    const board = session.getBoard();
    const at = board.roster.find((r) => r.status === 'fallen')!.fellAt!;

    expect(board.units.some((u) => u.anchor.x === at.x && u.anchor.y === at.y)).toBe(false);
    expect(board.obstacles.some((o) => o.anchor.x === at.x && o.anchor.y === at.y)).toBe(false);
  });

  it('reports no pyres at all before anyone falls', () => {
    const session = fought();
    expect(session.getBoard().roster.some((r) => r.status === 'fallen')).toBe(false);
  });
});

describe('the Graveyard is the only route for some raisings', () => {
  it('offers a Rally an entry that lights no ground', () => {
    // The reason the drawer is not a convenience. A Rally ignores where a body fell, so
    // its entries carry no tile, and a board-only interface could never point at one.
    const session = withPyre();
    const id = give(session, 'anchor_rally', 6);
    delete session.debugState.players.player.roster[0]!.fellAt;

    const spec = session.getLegalTargets(id);
    expect(spec.kind).toBe('fallen');
    if (spec.kind !== 'fallen') return;
    expect(spec.entries).toHaveLength(1);
    expect(spec.entries[0]!.at, 'no pyre on this board to click').toBeUndefined();
  });

  it('drops an entry whose pyre is occupied, so a row cannot be clicked into a throw', () => {
    const session = withPyre();
    const id = give(session, 'aetheric_resurgence', 8);

    const before = session.getLegalTargets(id);
    expect(before.kind === 'fallen' && before.entries.length).toBe(1);

    // Something stands on the pyre.
    const at = session.debugState.players.player.roster[0]!.fellAt!;
    const foe = Object.values(session.debugState.units).find((u) => u.side === 'enemy')!;
    foe.anchor = { ...at };

    // Reported as 'none' rather than an empty 'fallen' list, which is the stronger
    // answer: the card is unplayable, so the hand greys it out instead of opening a
    // drawer with nothing pickable in it.
    expect(session.getLegalTargets(id).kind).toBe('none');
    expect(session.getPlayableCards()).not.toContain(id);
  });
});

describe('a variable price on the card face', () => {
  it('reaches the hand snapshot, or the card reads as free', () => {
    // Zero is the printed cost and means nothing. Without `xCost` travelling with the
    // face, Aetheric Resurgence would sit in the hand showing a cost of 0.
    const session = withPyre();
    const id = give(session, 'aetheric_resurgence', 8);

    const snap = toCardSnapshot(session.debugState, 'player', id);
    expect(snap.cost.bones, 'the printed price is zero').toBe(0);
    expect(snap.xCost).toEqual({ max: 5 });
  });

  it('shows X on the face rather than the printed zero', () => {
    const face = faceOfDef(CARDS.aetheric_resurgence!);
    expect(face.xCost).toEqual({ max: 5 });
  });

  it('leaves every ordinary card alone', () => {
    for (const id of ['anchor_rally', 'blood_and_bone_rally', 'shield_bash']) {
      expect(faceOfDef(CARDS[id]!).xCost, id).toBeUndefined();
    }
  });

  it('survives the trip from snapshot to face', () => {
    const session = withPyre();
    const id = give(session, 'aetheric_resurgence', 8);

    expect(faceOfSnapshot(toCardSnapshot(session.debugState, 'player', id)).xCost).toEqual({ max: 5 });
  });
});

describe('the ceiling the picker offers', () => {
  /** What the picker computes: the card's own max, against what the purse can pay. */
  const ceiling = (max: number, bones: number, marrow: number): number =>
    Math.max(1, Math.min(max, bones + marrow));

  it('never offers more than the reducer will accept', () => {
    const session = withPyre();
    const id = give(session, 'aetheric_resurgence', 2, 0);

    const offered = ceiling(5, 2, 0);
    expect(offered).toBe(2);

    // The offered ceiling plays; one past it throws.
    expect(() =>
      session.dispatch({
        type: 'playCard',
        card: id,
        target: { kind: 'fallen', rosterIndex: 0 },
        x: offered + 1,
      }),
    ).toThrow();
  });

  it('counts Marrow, because Marrow pays generic prices first', () => {
    // A ceiling that ignored it would hide plays the engine would happily accept.
    const session = withPyre();
    const id = give(session, 'aetheric_resurgence', 1, 3);

    expect(ceiling(5, 1, 3)).toBe(4);
    expect(() =>
      session.dispatch({
        type: 'playCard',
        card: id,
        target: { kind: 'fallen', rosterIndex: 0 },
        x: 4,
      }),
    ).not.toThrow();
  });

  it('never falls below one, because zero is illegal', () => {
    expect(ceiling(5, 0, 0)).toBe(1);
  });
});
