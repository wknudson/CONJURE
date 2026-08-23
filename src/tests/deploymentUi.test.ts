import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import {
  DEFAULT_ROSTER,
  STARTING_WARBAND_POINTS,
  rosterBudgetFor,
  rosterCost,
  rosterPointsOf,
  validateRoster,
} from '../core/data/roster.js';
import { newProfile } from '../app/save.js';
import { CARDS } from '../core/data/cards/index.js';

/**
 * The bridge between a bought Vanguard and the board it stands on.
 *
 * The UI itself is DOM and is verified by driving the real screen; what is pinned here is
 * the **contract underneath it** — the view fields the tray draws from, the refusal the
 * lit tiles come from, and the actions the reducer accepts. Those are what a UI change
 * could silently break without a single test going red.
 */

function session(roster?: string[]): CombatSession {
  return new CombatSession(NOVICE_DUELIST, 7, undefined, undefined, undefined, undefined, roster);
}

describe('the view the tray draws from', () => {
  it('carries the anchors, so the renderer never recomputes them', () => {
    const board = session(DEFAULT_ROSTER).getBoard();
    expect(board.anchors.length).toBeGreaterThanOrEqual(DEFAULT_ROSTER.length);
    // Coordinates, not references into engine state: a renderer that mutated one must not
    // be able to move the ground.
    expect(board.anchors[0]).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('carries every rostered body, with the price it was bought at', () => {
    const board = session(DEFAULT_ROSTER).getBoard();
    expect(board.roster.map((r) => r.defId)).toEqual(DEFAULT_ROSTER);
    for (const entry of board.roster) {
      expect(entry.status, entry.defId).toBe('reserve');
      expect(entry.name, entry.defId).toBe(CARDS[entry.defId]!.name);
      expect(entry.points, entry.defId).toBeGreaterThan(0);
    }
    expect(board.roster.reduce((n, r) => n + r.points, 0)).toBe(rosterCost(DEFAULT_ROSTER));
  });

  it('carries what the arena seats, so the tray never recomputes the budget', () => {
    // The tray shows a running total and greys a body that will not fit, and it must reach
    // the same verdict `deployRefusal` does. One number, shipped on the view — the renderer
    // cannot import the engine, and a second copy of the arithmetic is a second answer.
    const board = session(DEFAULT_ROSTER).getBoard();
    expect(board.deployBudget).toBe(
      rosterBudgetFor(NOVICE_DUELIST.width, NOVICE_DUELIST.height),
    );
    expect(board.deployBudget, 'the Duelist is 6x8').toBe(14);
  });

  it('is empty, with no phase, when no Vanguard came along', () => {
    const board = session().getBoard();
    expect(board.roster).toEqual([]);
    expect(board.phase, 'the legacy path opens on turn one').toBe('action');
    // Still carried: the budget is a fact about the arena, not about the warband.
    expect(board.deployBudget).toBeGreaterThan(0);
  });

  it('names the unit a fielded body became, so a board click can find its tray entry', () => {
    const s = session(DEFAULT_ROSTER);
    const at = s.getBoard().anchors[0]!;
    s.dispatch({ type: 'deployUnit', defId: DEFAULT_ROSTER[0]!, at });

    const entry = s.getBoard().roster.find((r) => r.defId === DEFAULT_ROSTER[0]);
    expect(entry!.status).toBe('fielded');
    expect(entry!.unitId).toBeDefined();
    expect(s.getBoard().units.some((u) => u.id === entry!.unitId)).toBe(true);
  });
});

describe('the refusal the lit tiles come from', () => {
  it('agrees with what the reducer will accept', () => {
    // The whole reason the UI asks rather than deciding: a tile it lights must be a tile
    // the command takes.
    const s = session(DEFAULT_ROSTER);
    const at = s.getBoard().anchors[0]!;
    expect(s.deployRefusal(DEFAULT_ROSTER[0]!, at)).toBeNull();
    expect(() => s.dispatch({ type: 'deployUnit', defId: DEFAULT_ROSTER[0]!, at })).not.toThrow();
  });

  it('refuses a tile that is not an Anchor, in words a player can read', () => {
    const s = session(DEFAULT_ROSTER);
    const board = s.getBoard();
    const lit = new Set(board.anchors.map((a) => `${a.x},${a.y}`));
    let plain = { x: 0, y: 0 };
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) if (!lit.has(`${x},${y}`)) plain = { x, y };
    }
    expect(s.deployRefusal(DEFAULT_ROSTER[0]!, plain)).toBe('that tile is not an Anchor');
  });

  it('lights every anchor before a body is held, and narrows once one is', () => {
    // Nothing held asks the weaker question — "could anything stand here" — which is what
    // shows the shape of the ground before the player commits to a body.
    const s = session(DEFAULT_ROSTER);
    const board = s.getBoard();
    expect(board.anchors.every((a) => s.canDeploy(null, a))).toBe(true);
    expect(board.anchors.every((a) => s.canDeploy(DEFAULT_ROSTER[0]!, a))).toBe(true);
  });

  it('stops lighting an anchor once something stands on it', () => {
    const s = session(DEFAULT_ROSTER);
    const at = s.getBoard().anchors[0]!;
    s.dispatch({ type: 'deployUnit', defId: DEFAULT_ROSTER[0]!, at });
    expect(s.canDeploy(DEFAULT_ROSTER[1]!, at)).toBe(false);
    expect(s.canDeploy(null, at), 'and nothing else may take it either').toBe(false);
  });
});

describe('the actions the tray dispatches', () => {
  it('deploys, recalls, and engages through the session facade', () => {
    const s = session(DEFAULT_ROSTER);
    const at = s.getBoard().anchors[0]!;
    const defId = DEFAULT_ROSTER[0]!;

    s.dispatch({ type: 'deployUnit', defId, at });
    const placed = s.getBoard().roster.find((r) => r.defId === defId)!;
    expect(placed.status).toBe('fielded');

    s.dispatch({ type: 'recallUnit', unit: placed.unitId! });
    expect(s.getBoard().roster.find((r) => r.defId === defId)!.status).toBe('reserve');

    s.dispatch({ type: 'finishDeployment' });
    expect(s.getBoard().phase).toBe('action');
    expect(s.getBoard().turn).toBe(1);
  });

  it('lets a body deployed before the bell act on turn one', () => {
    // The point of entering through `placeOpeningUnit`. Summoning sickness here would make
    // the whole phase a turn of standing still.
    const s = session(DEFAULT_ROSTER);
    const at = s.getBoard().anchors[0]!;
    s.dispatch({ type: 'deployUnit', defId: DEFAULT_ROSTER[0]!, at });
    s.dispatch({ type: 'finishDeployment' });

    const unit = s.getBoard().units.find((u) => u.side === 'player' && u.defId === DEFAULT_ROSTER[0]);
    expect(unit, 'the body is on the board').toBeDefined();
    // `exhausted` is the view's word for "cannot act again this turn", and it is what the
    // HUD greys a unit out by. A deployed body must not arrive already spent.
    expect(unit!.exhausted).toBe(false);
    // And the engine agrees it may be given orders this turn.
    expect(s.getUnspentPotential().readyUnits).toBeGreaterThan(0);
  });

  it('starts the fight with bodies still in reserve, because holding back is a choice', () => {
    const s = session(DEFAULT_ROSTER);
    s.dispatch({ type: 'finishDeployment' });
    expect(s.getBoard().phase).toBe('action');
    expect(s.getBoard().roster.every((r) => r.status === 'reserve')).toBe(true);
  });
});

describe('the Vanguard on the profile', () => {
  it('gives a new character a legal warband with nothing left it could add', () => {
    // The invariant, rather than the old exact `=== STARTING_WARBAND_POINTS`.
    //
    // That number was an artefact of `DEFAULT_ROSTER` being hand-authored to spend the ten
    // precisely. Enrolment derives the opening warband from the chosen school's shelf, and
    // no school has a one-point body — so a line that has taken a 3-cost specialist can
    // finish on nine with nothing that fits the remainder. "As full as it can be" is the
    // property that was actually meant, and unlike the number it stays true as bodies are
    // added.
    const p = newProfile('slot-1');
    expect(validateRoster(p.roster, p.rosterUnlocks)).toEqual([]);
    expect(rosterCost(p.roster)).toBeGreaterThan(STARTING_WARBAND_POINTS - 3);

    const cheapest = Math.min(
      ...p.rosterUnlocks.map((id) => rosterPointsOf(CARDS[id]!)).filter((n) => n > 0),
    );
    expect(rosterCost(p.roster) + cheapest, 'nothing else would fit').toBeGreaterThan(
      STARTING_WARBAND_POINTS,
    );
  });

  it('is one warband per character, not one per Companion', () => {
    // `decks` is keyed by companion; this deliberately is not. A player who swapped beasts
    // and found their warband gone would be re-buying it every time.
    const p = newProfile('slot-1');
    expect(Array.isArray(p.roster)).toBe(true);
    expect(p.decks).not.toHaveProperty('roster');
  });
});
