import { describe, expect, it } from 'vitest';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { scenario, addUnit, giveCard } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { statusColor, STATUS_COLOR } from '../render/palette.js';
import { emptyOverlays, FLASH_MS } from '../render/BoardRenderer.js';
import { EntityViewMap } from '../render/EntityViews.js';
import { toSnapshot } from '../core/engine/views.js';

/**
 * Tactical readability: the questions the board has to answer without being clicked.
 *
 * All three of these were answerable only by acting — cast the spell and find out what it
 * touched, move the unit and find out what it reached, read the log to find out what
 * landed. A tactics game that makes you commit in order to see is a tactics game played
 * by guessing.
 */

/** A session over a hand-built board, so geometry can be pinned rather than rolled. */
function sessionOn(state: ReturnType<typeof scenario>): CombatSession {
  const s = new CombatSession(NOVICE_DUELIST, 1);
  (s as unknown as { state: unknown }).state = state;
  return s;
}

describe('the strike ring', () => {
  it('is the shape of the reach, not the list of targets', () => {
    // The distinction the overlay exists for. `getLegalAttacks` answers "what may I hit";
    // a player deciding where to stand is asking "how far does this thing reach", and on
    // an empty board the first answer is nothing at all.
    const state = scenario({ width: 7, height: 7 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 3 } });
    const s = sessionOn(state);

    expect(s.getLegalAttacks(imp.id), 'nothing to hit').toEqual([]);
    expect(s.getStrikeReach(imp.id).length, 'and still a ring to count').toBe(8);
  });

  it('draws a melee ring of exactly the eight neighbours', () => {
    const state = scenario({ width: 7, height: 7 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 3 } });
    const reach = sessionOn(state).getStrikeReach(imp.id);

    for (const c of reach) {
      expect(Math.max(Math.abs(c.x - 3), Math.abs(c.y - 3)), `${c.x},${c.y}`).toBe(1);
    }
  });

  it('never includes the body’s own tile', () => {
    const state = scenario({ width: 7, height: 7 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 3 } });
    expect(sessionOn(state).getStrikeReach(imp.id)).not.toContainEqual({ x: 3, y: 3 });
  });

  it('honours a mortar’s blind spot', () => {
    // A Cinder Lobber fires 2-4 and cannot depress its aim. The ring has a hole in the
    // middle, and that hole is the single most important thing about standing near one.
    const state = scenario({ width: 9, height: 9 });
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 4, y: 4 } });
    const def = CARDS.cinder_lobber!.unit!;
    const reach = sessionOn(state).getStrikeReach(lobber.id);

    for (const c of reach) {
      const d = Math.max(Math.abs(c.x - 4), Math.abs(c.y - 4));
      expect(d, `${c.x},${c.y}`).toBeGreaterThanOrEqual(def.rangeMin);
      expect(d).toBeLessThanOrEqual(def.rangeMax);
    }
    expect(reach, 'adjacent is inside the blind spot').not.toContainEqual({ x: 5, y: 4 });
  });

  it('confines a linear body to its ranks, files and diagonals', () => {
    // A marksman with a square of reach and one confined to a firing line print the same
    // range and are entirely different pieces. The ring is where that becomes legible.
    const state = scenario({ width: 9, height: 9 });
    const stalker = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 4, y: 4 } });
    expect(CARDS.longshot_stalker!.unit!.attackProfile).toBe('lineOnly');

    const reach = sessionOn(state).getStrikeReach(stalker.id);
    for (const c of reach) {
      const dx = c.x - 4;
      const dy = c.y - 4;
      const online = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
      expect(online, `${c.x},${c.y} is off the line`).toBe(true);
    }
    expect(reach).toContainEqual({ x: 4, y: 0 });
    expect(reach, 'a knight’s move is not a line').not.toContainEqual({ x: 6, y: 5 });
  });

  it('stays on the board', () => {
    const state = scenario({ width: 5, height: 5 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 0, y: 0 } });
    const reach = sessionOn(state).getStrikeReach(imp.id);

    expect(reach).toHaveLength(3);
    for (const c of reach) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('measures a Behemoth from every cell it occupies', () => {
    // A 2x2 anchored at one corner threatens a ring around the whole body, not around the
    // corner. Measuring from the anchor alone would under-report two of its four sides.
    const state = scenario({ width: 9, height: 9 });
    const brute = addUnit(state, { def: 'magma_brute', side: 'player', at: { x: 4, y: 4 } });
    expect(CARDS.magma_brute!.unit!.footprint).toBe(2);

    const reach = sessionOn(state).getStrikeReach(brute.id);
    expect(reach, 'beside its far cell').toContainEqual({ x: 6, y: 5 });
    expect(reach, 'beside its near cell').toContainEqual({ x: 3, y: 3 });
    expect(reach, 'and none of its own cells').not.toContainEqual({ x: 5, y: 5 });
  });

  it('says nothing about a unit that is not there', () => {
    expect(sessionOn(scenario({})).getStrikeReach('u404')).toEqual([]);
  });
});

describe('the impact preview', () => {
  it('reports the tiles a status-only cast touches', () => {
    // The gap this closes. Frost Nova chills a cross and deals its damage to the same
    // tiles, but a card that *only* applied a status produced no tile effects at all —
    // so its area of effect could not be drawn until after it resolved.
    // Bodies that *survive* the blow, deliberately. A status lands on what is left
    // standing, so previewing one on a corpse would be previewing something that never
    // happens — and a Scout Imp has exactly as much health as Static Arc deals.
    const state = scenario({ width: 7, height: 7, pips: 8 });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } });
    const card = giveCard(state, 'player', 'static_arc');

    const preview = sessionOn(state).previewAction({
      type: 'playCard',
      card,
      target: { kind: 'tile', at: { x: 3, y: 3 } },
    });

    expect(preview.legal).toBe(true);
    const charged = preview.tileEffects.filter((e) => e.status === 'charged');
    expect(charged.map((e) => e.at), 'both bodies in the cross').toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 3 },
    ]);
  });

  it('previews a Resonance the cast sets off, which nothing used to show', () => {
    // The unlooked-for half. Casting a Companion card fires the school's Resonance, and a
    // Pyre one ignites whatever is standing in the Companion's lane — a body catching fire
    // several tiles from where the player aimed. It is a real consequence of the click and
    // there was no way to see it coming.
    const state = scenario({ width: 7, height: 7, pips: 8 });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } });
    const card = giveCard(state, 'player', 'static_arc');

    const preview = sessionOn(state).previewAction({
      type: 'playCard',
      card,
      target: { kind: 'tile', at: { x: 3, y: 3 } },
    });

    // x=4 is the Companion's column on a 7-wide board, and the Sentinel standing in it
    // burns for reasons that have nothing to do with where the arc was aimed.
    expect(state.players.player.companionColumn).toBe(4);
    const burn = preview.tileEffects.find((e) => e.status === 'burn');
    expect(burn?.at).toEqual({ x: 4, y: 3 });
  });

  it('names which status, so the flash can be the right colour', () => {
    const state = scenario({ width: 7, height: 7, pips: 8 });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
    const card = giveCard(state, 'player', 'glacial_spike');

    const preview = sessionOn(state).previewAction({
      type: 'playCard',
      card,
      target: { kind: 'entity', ref: { kind: 'unit', id: Object.keys(state.units)[0]! } },
    });

    const chill = preview.tileEffects.find((e) => e.status === 'chill');
    expect(chill, 'Glacial Spike chills what it hits').toBeDefined();
  });

  it('carries the footprint of what a placement puts down', () => {
    // A 2x2 body covers three tiles the player never clicked. The spec has to say so, or
    // the highlight is quietly lying about where the thing goes.
    const state = scenario({ width: 8, height: 8, pips: 8 });
    const card = giveCard(state, 'player', 'magma_brute');
    const spec = sessionOn(state).getLegalTargets(card);

    expect(spec.kind).toBe('tiles');
    if (spec.kind === 'tiles') expect(spec.footprint).toBe(2);
  });

  it('carries the whole line a linear cast covers', () => {
    // `covers` is the engine's own geometry, handed over rather than recomputed in the UI.
    const state = scenario({ width: 8, height: 8, pips: 8 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 3, y: 6 } });
    state.players.player.companionUnitId = Object.keys(state.units)[0]!;
    state.players.player.companionUnitDefId = 'ignis_bound';
    const card = giveCard(state, 'player', 'flame_surge');

    const spec = sessionOn(state).getLegalTargets(card);
    expect(spec.kind).toBe('lines');
    if (spec.kind === 'lines') {
      expect(spec.origins.length).toBeGreaterThan(0);
      for (const o of spec.origins) {
        expect(o.covers.length, 'a line is more than its near end').toBeGreaterThan(1);
      }
    }
  });
});

describe('the status flash', () => {
  it('has a colour for every affliction the engine can apply', () => {
    // A silent status is the exact failure the flash exists to fix, so the fallback is
    // white rather than nothing — but the ones a player meets should be named.
    for (const kind of ['toxin', 'burn', 'chill', 'freeze', 'brittle', 'charged', 'entangle', 'stun']) {
      expect(STATUS_COLOR[kind], kind).toBeDefined();
    }
  });

  it('falls back to white rather than to nothing', () => {
    expect(statusColor('a_status_nobody_has_written_yet')).toBe('#FFFFFF');
  });

  it('gives Toxin green and Chill blue, as the brief asks', () => {
    expect(statusColor('toxin')).toBe('#4ADE80');
    expect(statusColor('chill')).toBe('#7DD3FC');
  });
});

describe('the overlay contract', () => {
  it('starts empty, so a stale frame cannot leave a zone lit', () => {
    const empty = emptyOverlays();
    expect(empty.impact).toEqual([]);
    expect(empty.reach).toEqual([]);
  });
});

describe('the flash fades', () => {
  const bodied = (): EntityViewMap => {
    const views = new EntityViewMap();
    const state = scenario({ width: 5, height: 5 });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 } });
    views.addUnit(toSnapshot(state.units[imp.id]!));
    return views;
  };

  it('starts life at full and ages toward nothing', () => {
    const views = bodied();
    const v = views.all()[0]!;
    v.flash = { color: statusColor('chill'), life: 1 };

    views.ageFlashes(FLASH_MS / 2, FLASH_MS);
    expect(v.flash?.life).toBeCloseTo(0.5, 5);
  });

  it('drops the wash entirely once it has run out', () => {
    // Not merely invisible: a flash left at zero is state nobody cleans up, and the next
    // one has to be able to tell "no wash" from "a spent wash".
    const views = bodied();
    const v = views.all()[0]!;
    v.flash = { color: statusColor('toxin'), life: 1 };

    views.ageFlashes(FLASH_MS, FLASH_MS);
    expect(v.flash).toBeNull();
  });

  it('leaves a body that nothing landed on alone', () => {
    const views = bodied();
    views.ageFlashes(1000, FLASH_MS);
    expect(views.all()[0]!.flash).toBeNull();
  });

  it('fades in about a third of a second, not a full one', () => {
    // Long enough to catch, short enough that a cast poisoning five bodies does not leave
    // the board lit up.
    expect(FLASH_MS).toBeGreaterThan(150);
    expect(FLASH_MS).toBeLessThan(600);
  });
});
