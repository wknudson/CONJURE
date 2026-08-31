/**
 * The enemy roster ledger: every fight fields exactly what it says it fields.
 *
 * ROADMAP §4 carried the complaint for a fortnight: Vanguard budgets moved to
 * `width + height`, the player's seatable points grew with the arena, and the enemy
 * opening boards quietly did not. Nothing made the gap visible, so it sat. This suite is
 * the follow-up, in the shape that keeps it closed: a fight either fills its arena's own
 * budget — which is what the player can seat against it — or it carries a `rosterBudget`
 * saying out loud that fielding less is its shape. A hunt is one apex beast and its adds;
 * a pack is one warband priced on the reinforcement ladder; a boss brings waves and a
 * script instead of an opening line. Those are shapes. An undeclared shortfall is a bug.
 *
 * Counted from the data rather than from a built combat, which is safe because
 * `createCombat` refuses an opening unit it cannot field and shunts the free vanguard to
 * the nearest open tile — placement moves bodies, never deletes them. The enemy Companion
 * is not counted: it is the Pact's body, not a warband purchase, the same rule the
 * player's side prices under.
 */

import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { CARDS } from '../core/data/cards/index.js';
import { rosterBudgetFor, rosterPointsOf } from '../core/data/roster.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';

/** Board plus the free vanguard — everything the enemy stands up before turn one. */
function fielded(e: EncounterDef): number {
  const vanguard = e.vanguard === undefined ? 'vanguard_footman' : e.vanguard;
  return (
    e.enemyOpeningBoard.reduce((n, [defId]) => n + rosterPointsOf(CARDS[defId]!), 0) +
    (vanguard ? rosterPointsOf(CARDS[vanguard]!) : 0)
  );
}

describe('the enemy roster ledger', () => {
  for (const e of ENCOUNTERS) {
    it(`${e.id} fields exactly what it declares`, () => {
      const owed = e.rosterBudget ?? rosterBudgetFor(e.width, e.height);
      expect(
        fielded(e),
        e.rosterBudget === undefined
          ? `${e.id} under-fills its ${e.width}x${e.height} arena — top the board up or declare a rosterBudget`
          : `${e.id} disagrees with its own declared rosterBudget — the board moved and the declaration did not`,
      ).toBe(owed);
    });
  }

  it('never declares the number the arena already means', () => {
    // A `rosterBudget` equal to `rosterBudgetFor(width, height)` says nothing the absence
    // of the field would not say better — and it stops tracking the arena the day someone
    // resizes the board. Absence is the declaration that the arena's number is the number.
    for (const e of ENCOUNTERS) {
      if (e.rosterBudget === undefined) continue;
      expect(
        e.rosterBudget,
        `${e.id} declares its arena's own budget — delete the field`,
      ).not.toBe(rosterBudgetFor(e.width, e.height));
    }
  });
});
