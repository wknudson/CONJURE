import { describe, expect, it } from 'vitest';
import { bestiaryRoster, isIdentified, ledgerFor, ledgerProgress } from '../core/data/bestiary.js';
import { resolveCombat } from '../core/overworld/run.js';
import { newRun, type Bestiary, type GlobalGameState } from '../core/overworld/state.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { addUnit, run, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';

/**
 * The Threat Ledger.
 *
 * Two halves that have to agree: the engine noticing what walked on and what fell over,
 * and the overworld folding that into a tally that survives. Most of the risk is in the
 * first half being silently empty — a Ledger that never fills looks exactly like a player
 * who has not killed anything yet.
 */

const character = (): GlobalGameState => ({ overworld: newRun(1), combat: {} });

describe('what the board notices', () => {
  it('records every enemy that walks on', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7);
    expect(state.encountered.length, 'the opening board is a sighting').toBeGreaterThan(0);
    expect(state.defeated, 'and nothing has died yet').toEqual([]);
  });

  it("records nothing for the player own side", () => {
    const state = scenario({ width: 6, height: 6, pips: 8 });
    const before = state.encountered.length;
    addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 4 }, hp: 50 });
    expect(state.encountered.length, 'yours are not threats').toBe(before);
  });

  it('records a kill by definition, not by instance', () => {
    // A list of `u7` would grow for ever and identify nothing. The Ledger is about kinds.
    const state = scenario({ width: 6, height: 6, pips: 8 });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 10 });
    const killer = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 3 }, hp: 200 });

    const res = run(state, { type: 'attack', attacker: killer.id, target: { kind: 'unit', id: victim.id } });

    expect(res.state.defeated).toContain('scout_imp');
    expect(res.state.defeated.every((id) => !id.startsWith('u'))).toBe(true);
  });

  it('un-counts a kill the player takes back', () => {
    // The reason the tally lives in `GameState`: snapshot/restore deep-clones it, so undo
    // rewinds the Ledger for free. A tally kept beside the state would have to remember.
    const state = scenario({ width: 6, height: 6, pips: 8 });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 10 });
    const killer = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 3 }, hp: 200 });

    const before = structuredClone(state);
    const after = applyCommand(state, { type: 'attack', attacker: killer.id, target: { kind: 'unit', id: victim.id } });

    expect(after.state.defeated).toContain('scout_imp');
    expect(before.defeated, 'the snapshot never saw it').toEqual([]);
  });
});

describe('folding a fight into the Ledger', () => {
  it('counts sightings and kills separately', () => {
    const g = character();
    const bestiary: Bestiary = {};

    resolveCombat(
      g,
      {
        pactHp: 20,
        encounteredUnitIds: ['scout_imp', 'scout_imp', 'grave_sentinel'],
        defeatedUnitIds: ['scout_imp'],
      },
      'victory',
      bestiary,
    );

    expect(bestiary.scout_imp).toEqual({ encountered: 2, defeated: 1 });
    expect(bestiary.grave_sentinel).toEqual({ encountered: 1, defeated: 0 });
  });

  it('accumulates across fights', () => {
    const bestiary: Bestiary = {};
    for (let i = 0; i < 3; i++) {
      const g = character();
      resolveCombat(
        g,
        { pactHp: 20, encounteredUnitIds: ['scout_imp'], defeatedUnitIds: ['scout_imp'] },
        'victory',
        bestiary,
      );
    }
    expect(bestiary.scout_imp).toEqual({ encountered: 3, defeated: 3 });
  });

  it('writes the Ledger on a loss too', () => {
    // Killing a thing teaches you what it was. Losing the fight afterwards does not
    // un-teach it.
    const g = character();
    const bestiary: Bestiary = {};
    resolveCombat(
      g,
      { pactHp: 0, encounteredUnitIds: ['scout_imp'], defeatedUnitIds: ['scout_imp'] },
      'defeat',
      bestiary,
    );
    expect(bestiary.scout_imp!.defeated).toBe(1);
  });

  it('closes a fight fine with no Ledger at all', () => {
    const g = character();
    expect(() => resolveCombat(g, { pactHp: 120 }, 'victory')).not.toThrow();
    expect(g.overworld.pact.currentHp).toBe(120);
  });
});

describe('the mystery rule', () => {
  it('identifies a thing only once it has been put down', () => {
    const seen: Bestiary = { scout_imp: { encountered: 4, defeated: 0 } };
    expect(isIdentified(seen, 'scout_imp'), 'met four times, still a rumour').toBe(false);

    const killed: Bestiary = { scout_imp: { encountered: 4, defeated: 1 } };
    expect(isIdentified(killed, 'scout_imp')).toBe(true);
  });

  it('lists every stat block in the game, known or not', () => {
    const roster = bestiaryRoster();
    expect(roster.length).toBeGreaterThan(3);
    expect(roster.every((d) => d.unit !== undefined), 'only things with bodies').toBe(true);
    expect(roster.some((d) => d.id.endsWith('_r2')), 'a Rank 2 is not a second creature').toBe(
      false,
    );
  });

  it('renders an unmet entry as blank rather than omitting it', () => {
    const entries = ledgerFor({});
    expect(entries.length).toBe(bestiaryRoster().length);
    expect(entries.every((e) => !e.identified)).toBe(true);
    expect(entries.every((e) => e.encountered === 0 && e.defeated === 0)).toBe(true);
  });

  it('counts progress by what is identified, not by what is seen', () => {
    const bestiary: Bestiary = {
      scout_imp: { encountered: 9, defeated: 0 },
      grave_sentinel: { encountered: 1, defeated: 1 },
    };
    const { known, total } = ledgerProgress(bestiary);
    expect(known).toBe(1);
    expect(total).toBe(bestiaryRoster().length);
  });
});
