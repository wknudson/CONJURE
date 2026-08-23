import { describe, expect, it } from 'vitest';
import { addUnit, findUnit, run, scenario } from './scenario.js';
import { dealDamage } from '../core/engine/damage.js';
import { makeCtx } from '../core/engine/context.js';
import { CARDS } from '../core/data/cards/index.js';
import { MARKS } from '../core/data/marks.js';
import { SCHOOLS } from '../core/data/pools.js';
import { minionPool } from '../core/data/pools.js';
import {
  ELEMENTAL_DTYPES,
  SCHOOL_DTYPE,
  SCHOOL_OF_DTYPE,
  SELF_ELEMENT_RESIST,
  WEATHER_ELEMENTAL,
  dtypeOf,
  resistOf,
  weatherMod,
} from '../core/data/elements.js';
import { FLOATER_FOR_DTYPE } from '../render/Fx.js';
import { readWeather } from '../hud/weather.js';
import type { DamageType, School } from '../contract/ids.js';
import type { GameState, Weather } from '../core/types/state.js';

/**
 * The elemental layer: a body's school reaching its damage.
 *
 * Before this, `school` was a colour on a card frame. A body swung for `physical` unless its
 * stat block said otherwise, and exactly two cards in the catalogue said otherwise — so a Pyre
 * minion could not detonate a Cinder Mark (aligned to fire and spell), no weather could favour
 * an element, and nothing resisted one. These tests are about the link being real and about the
 * three places it is easy to get wrong: the default, the mirror match, and physical.
 */

function underSky(weather: Weather | undefined, width = 8, height = 8): GameState {
  const state = scenario({ width, height });
  if (weather) state.encounter.weather = weather;
  return state;
}

/** The damage a hit of `dtype` actually takes off a given body, armour and all. */
function landOn(state: GameState, unitId: string, dtype: DamageType, amount: number): number {
  const ctx = makeCtx(state);
  const before = ctx.state.units[unitId]!.hp;
  dealDamage(ctx, { target: { kind: 'unit', id: unitId }, amount, dtype, cause: 'spell' });
  return before - ctx.state.units[unitId]!.hp;
}

describe('a school is a damage type', () => {
  it('gives all six elemental schools one element each, and no two the same', () => {
    const elements = SCHOOLS.map((s) => SCHOOL_DTYPE[s]);
    expect(new Set(elements).size, 'six schools, six elements').toBe(SCHOOLS.length);
    for (const s of SCHOOLS) {
      expect(ELEMENTAL_DTYPES, `${s} deals an element`).toContain(SCHOOL_DTYPE[s]);
    }
  });

  it('does not give the colourless schools an element', () => {
    // `arcane` and `neutral` swing physical, and `spell` is deliberately not used: it is
    // aligned by four of the six Marks, so an arcane body swinging with it would set off
    // Cinder, Rime, Arc and Soul Splinter alike.
    expect(dtypeOf('arcane')).toBe('physical');
    expect(dtypeOf('neutral')).toBe('physical');
    for (const school of ['arcane', 'neutral'] as School[]) {
      expect(ELEMENTAL_DTYPES).not.toContain(dtypeOf(school));
    }
  });

  it('names a school for every element, derived from the one table', () => {
    for (const dtype of ELEMENTAL_DTYPES) {
      const school = SCHOOL_OF_DTYPE[dtype];
      expect(school, `${dtype} belongs to somebody`).toBeDefined();
      expect(dtypeOf(school!), 'and the round trip holds').toBe(dtype);
    }
    // The inverse is elemental-only: physical is owned by two schools, so it is owned by none.
    expect(SCHOOL_OF_DTYPE.physical).toBeUndefined();
  });

  it('swings with its school, without a card having to say so', () => {
    // The whole point. Every minion in every elemental pool, with no `attackDtype` of its
    // own, must strike with its school's element — this is the assertion that would have
    // failed for all of them before, when the default was physical.
    for (const school of SCHOOLS) {
      for (const def of minionPool(school)) {
        if (def.unit?.attackDtype) continue; // the documented exceptions
        expect(SCHOOL_DTYPE[def.school], `${def.id} (${def.school})`).toBe(dtypeOf(school));
      }
    }
  });

  it('lets a Pyre body detonate a Cinder Mark, which it could not before', () => {
    // The failure this whole change exists to fix, end to end: the Mark aligns to fire and
    // spell, and a Pyre minion used to deal neither.
    expect(MARKS.cinder_mark!.trigger).toEqual({
      kind: 'hpLoss',
      alignedTypes: ['fire', 'spell'],
    });
    const pyre = minionPool('pyre').find((d) => !d.unit?.attackDtype)!;
    expect(dtypeOf(pyre.school), `${pyre.id} strikes with`).toBe('fire');
    expect(MARKS.cinder_mark!.trigger.kind === 'hpLoss' &&
      MARKS.cinder_mark!.trigger.alignedTypes.includes(dtypeOf(pyre.school))).toBe(true);
  });

  it('leaves every school able to spring its own Mark', () => {
    // The rule that has to hold for "marks can be triggered" to mean anything. An hpLoss Mark
    // whose own school's bodies cannot set it off is a trap its owner has to borrow somebody
    // else's deck to use — which is exactly what Bloom's was until `toxic` was added to it.
    for (const mark of Object.values(MARKS)) {
      if (mark.trigger.kind !== 'hpLoss') continue;
      if (mark.school === 'arcane') continue; // the Cask is nobody's school
      expect(
        mark.trigger.alignedTypes,
        `${mark.id} is aligned to ${mark.school}'s own element`,
      ).toContain(dtypeOf(mark.school));
    }
  });
});

describe('elemental resistance', () => {
  it('shrugs off its own element, and only by the stated amount', () => {
    for (const school of SCHOOLS) {
      expect(resistOf(school, dtypeOf(school)), school).toBe(-SELF_ELEMENT_RESIST);
    }
  });

  it('does not resist physical, however colourless the body', () => {
    // The bug this caught. `arcane` and `neutral` deal `physical`, so a self-resist keyed on
    // the same table quietly gave every colourless body in the game 10 free armour against
    // the commonest damage type on the board — two Scout Imps hit each other for 10 less
    // than their stat blocks claimed. Physical is the absence of an element; nothing resists
    // its own absence.
    expect(resistOf('arcane', 'physical')).toBe(0);
    expect(resistOf('neutral', 'physical')).toBe(0);
    for (const school of SCHOOLS) expect(resistOf(school, 'physical'), school).toBe(0);
  });

  it('never touches `true` damage', () => {
    // True damage bypasses armour and Brittle; a resistance that applied to it would make it
    // not true. Checked against an authored table as well, so a card cannot buy the exception.
    for (const school of [...SCHOOLS, 'arcane' as School]) {
      expect(resistOf(school, 'true'), school).toBe(0);
    }
    expect(resistOf('pyre', 'true', { true: -50 }), 'even when a card asks').toBe(0);
  });

  it('adds an authored table on top, in either direction', () => {
    // Negative resists, positive is a vulnerability — the interesting half, because a stated
    // weakness is a body the player can be told how to kill.
    expect(resistOf('pyre', 'frost', { frost: -20 }), 'resistant').toBe(-20);
    expect(resistOf('pyre', 'frost', { frost: +20 }), 'vulnerable').toBe(+20);
    expect(resistOf('pyre', 'fire', { fire: -20 }), 'stacks with its own').toBe(
      -SELF_ELEMENT_RESIST - 20,
    );
  });

  it('takes it off the number on the board, before armour', () => {
    const state = underSky(undefined);
    // A Pyre body, hit by fire and by frost at the same figure.
    const pyre = minionPool('pyre').find((d) => !d.unit?.attackDtype)!;
    const burned = addUnit(state, { def: pyre.id, side: 'enemy', at: { x: 2, y: 2 }, hp: 200 });
    const chilled = addUnit(state, { def: pyre.id, side: 'enemy', at: { x: 4, y: 2 }, hp: 200 });

    const fromFire = landOn(state, burned.id, 'fire', 50);
    const fromFrost = landOn(state, chilled.id, 'frost', 50);
    expect(fromFrost - fromFire, 'its own element hurts it less').toBe(SELF_ELEMENT_RESIST);
  });

  it('cannot heal, however resistant the body', () => {
    // Resistance clamps at zero before armour rather than after. A negative handed to the
    // armour branch would absorb backwards, and a negative HP loss is healing by accident.
    const state = underSky(undefined);
    const pyre = minionPool('pyre').find((d) => !d.unit?.attackDtype)!;
    const body = addUnit(state, { def: pyre.id, side: 'enemy', at: { x: 2, y: 2 }, hp: 200 });
    expect(landOn(state, body.id, 'fire', 10), 'damped to nothing, not below').toBe(0);
  });

  it('spares the Pact, which has no school of its own', () => {
    // A Commander's school is a deck-building fact. Reading it here would hand a Pyre player
    // a fire resistance on their portrait that they never chose or paid for.
    const state = underSky(undefined);
    const ctx = makeCtx(state);
    const before = ctx.state.players.player.hp;
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'player' },
      amount: 50,
      dtype: 'fire',
      cause: 'spell',
    });
    expect(before - ctx.state.players.player.hp).toBe(50);
  });
});

describe('the sky favours an element', () => {
  it('has an opinion only where the table says so', () => {
    expect(weatherMod(undefined, 'fire'), 'clear skies').toBe(0);
    // Fog is deliberately absent: its effect is on sight, and it is already the harshest
    // weather in the game for that. A fight where nobody can see does not need a damage rule.
    expect(WEATHER_ELEMENTAL.fog, 'fog is a vision rule').toBeUndefined();
    expect(weatherMod({ kind: 'fog' }, 'fire')).toBe(0);
  });

  it('drowns fire and carries a charge', () => {
    expect(weatherMod({ kind: 'rain' }, 'fire')).toBeLessThan(0);
    expect(weatherMod({ kind: 'rain' }, 'shock')).toBeGreaterThan(0);
  });

  it('fans a flame and scatters a cloud', () => {
    const gale: Weather = { kind: 'gale', wind: { x: 1, y: 0 } };
    expect(weatherMod(gale, 'fire')).toBeGreaterThan(0);
    expect(weatherMod(gale, 'toxic')).toBeLessThan(0);
  });

  it('leaves `true` and `physical` alone in every sky', () => {
    // Weather favours *elements*. A downpour has no view on a sword.
    for (const kind of Object.keys(WEATHER_ELEMENTAL) as Weather['kind'][]) {
      for (const dtype of ['physical', 'spell', 'true'] as DamageType[]) {
        expect(WEATHER_ELEMENTAL[kind]?.[dtype], `${kind}/${dtype}`).toBeUndefined();
      }
    }
  });

  it('reaches a body’s swing, not only a spell', () => {
    // The consequence worth stating out loud: now that a strike carries its school, rain
    // damping fire damps every Pyre *body* too, not just Pyre cards. That is the intended
    // reading of an elemental warband caught in the wrong weather.
    const hitIn = (weather: Weather | undefined): number => {
      // `ember_hound` is a plain melee Pyre body: no `attackDtype` of its own, so its swing
      // is fire purely because its school is.
      const state = scenario({
        units: [
          { def: 'ember_hound', side: 'player', at: { x: 2, y: 2 } },
          { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 300 },
        ],
      });
      if (weather) state.encounter.weather = weather;
      const attacker = findUnit(state, 'ember_hound', 'player');
      const foe = findUnit(state, 'grave_sentinel', 'enemy');
      const before = state.units[foe.id]!.hp;
      const res = run(state, {
        type: 'attack',
        attacker: attacker.id,
        target: { kind: 'unit', id: foe.id },
      });
      return before - res.state.units[foe.id]!.hp;
    };

    const dry = hitIn(undefined);
    const wet = hitIn({ kind: 'rain' });
    expect(dry, 'the swing lands for something').toBeGreaterThan(0);
    expect(dry - wet, 'and the rain takes the stated amount off it').toBe(
      -weatherMod({ kind: 'rain' }, 'fire'),
    );
  });
});

describe('the briefing names what the sky will do', () => {
  it('reports each modifier in the school’s own words, from the table', () => {
    // Derived rather than written out, because this is precisely the sentence that goes
    // stale. It used to read "Pyre dampened" and nothing else, from when one hard-coded rule
    // took 10 off fire and no other element could be touched — so the briefing was silently
    // incomplete the moment a second entry existed. Generating it means adding to
    // `WEATHER_ELEMENTAL` updates the briefing, the badge and the rules text at once.
    const rain = readWeather({ kind: 'rain' })!.effect;
    expect(rain, 'names the school, not the damage type').toContain('Pyre dampened by 10');
    expect(rain).toContain('Surge strengthened by 10');

    const gale = readWeather({ kind: 'gale', wind: { x: 0, y: 1 } })!.effect;
    expect(gale).toContain('Pyre strengthened by 10');
    expect(gale).toContain('Bloom dampened by 10');
  });

  it('says nothing about elements for a sky that has no opinion', () => {
    const fog = readWeather({ kind: 'fog' })!.effect;
    for (const school of SCHOOLS) {
      expect(fog.toLowerCase(), 'fog is a vision rule').not.toContain(school);
    }
  });
});

describe('the player can see which element hit', () => {
  it('gives every elemental type its own floater, and the rest the plain one', () => {
    // The type used to be invisible: one line special-cased shock and everything else was a
    // red number. Now that a Mark detonates on aligned damage and fizzles on the wrong kind,
    // "what element was that" is the difference between a combo and a wasted card.
    for (const dtype of ELEMENTAL_DTYPES) {
      expect(FLOATER_FOR_DTYPE[dtype], dtype).toBe(dtype);
    }
    for (const dtype of ['physical', 'spell', 'true'] as DamageType[]) {
      expect(FLOATER_FOR_DTYPE[dtype], dtype).toBe('damage');
    }
  });

  it('has a treatment for every damage type there is', () => {
    // `FLOATER_FOR_DTYPE` is a total Record on purpose, so adding a damage type fails to
    // compile until somebody decides how it looks. This asserts the runtime shape matches.
    const mark = Object.values(MARKS).map((m) => m.dtype);
    const attacks = Object.values(CARDS)
      .map((c) => c.unit?.attackDtype)
      .filter((d): d is DamageType => !!d);
    for (const dtype of [...mark, ...attacks]) {
      expect(FLOATER_FOR_DTYPE[dtype], dtype).toBeDefined();
    }
  });
});
