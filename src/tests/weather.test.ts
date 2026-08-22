import { describe, expect, it } from 'vitest';
import { addUnit, scenario } from './scenario.js';
import { applyCommand } from '../core/engine/engine.js';
import { legalAttacks, legalCardTargets } from '../core/engine/targeting.js';
import { threatMap } from '../core/engine/threat.js';
import { FOG_VISION } from '../core/types/state.js';
import { RAIN_FIRE_PENALTY } from '../core/engine/damage.js';
import type { GameState, Weather } from '../core/types/state.js';
import type { DamageType } from '../contract/ids.js';
import { dealDamage } from '../core/engine/damage.js';
import { makeCtx } from '../core/engine/context.js';
import { deepClone } from '../core/util/clone.js';
import { CARDS } from '../core/data/cards/index.js';

/**
 * Weather.
 *
 * The point of a sky is that it changes which cards are worth bringing, which is why the
 * pre-combat screen names it. These tests are about that: each effect has to be big
 * enough to change a decision, and has to apply to everything rather than to units only.
 */

function underSky(weather: Weather, width = 8, height = 8): GameState {
  const state = scenario({ width, height });
  state.encounter.weather = weather;
  return state;
}

const canHit = (state: GameState, attacker: string, target: string): boolean =>
  legalAttacks(state, state.units[attacker]!).some(
    (t) => t.kind === 'unit' && t.id === target,
  );

describe('dense fog', () => {
  it('stops a marksman seeing across the board', () => {
    const state = underSky({ kind: 'fog' });
    const sniper = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 7 } });
    const near = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 } });

    expect(canHit(state, sniper.id, near.id), 'three tiles is within the murk').toBe(true);
    expect(canHit(state, sniper.id, far.id), 'six tiles is not').toBe(false);
  });

  it('clamps a mortar too, which sees nothing but lobs anyway', () => {
    // Arcing ignores line of sight, not distance — it still cannot shell what it has no
    // idea is there.
    const state = underSky({ kind: 'fog' });
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 7 } });
    const atFour = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    expect(canHit(state, lobber.id, atFour.id), 'range 4 is beyond a 3-tile murk').toBe(false);
  });

  it('hides the Commander as well as the soldiers', () => {
    // Without this a fogged board blinds every unit and leaves snipers a clear shot at
    // the one target that ends the game.
    const state = underSky({ kind: 'fog' });
    const sniper = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 5 } });

    const targets = legalAttacks(state, state.units[sniper.id]!);
    expect(targets.some((t) => t.kind === 'portrait')).toBe(false);
  });

  it('shortens spells by the same measure', () => {
    const state = underSky({ kind: 'fog' });
    const body = addUnit(state, {
      def: 'boreas_bound',
      side: 'player',
      at: { x: 3, y: 7 },
      titheBonus: 0,
    });
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'boreas_bound';
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    // Glacial Spike reaches 5 in clear air; the fog cuts it to 3.
    const targets = legalCardTargets(state, 'player', 'glacial_spike');
    const ids = targets.map((t) => (t.kind === 'entity' && t.ref.kind === 'unit' ? t.ref.id : ''));
    expect(ids).not.toContain(far.id);
  });

  it('is agreed on by the danger overlay', () => {
    // The overlay and the rules run through the same predicate; if they disagreed the
    // player would be told a tile was safe when it was not.
    const clear = scenario({ width: 8, height: 8 });
    addUnit(clear, { def: 'longshot_stalker', side: 'enemy', at: { x: 3, y: 0 } });
    const foggy = underSky({ kind: 'fog' });
    addUnit(foggy, { def: 'longshot_stalker', side: 'enemy', at: { x: 3, y: 0 } });

    expect(threatMap(foggy, 'player').tiles.length).toBeLessThan(
      threatMap(clear, 'player').tiles.length,
    );
  });

  it('leaves melee alone, which never needed to see far', () => {
    const state = underSky({ kind: 'fog' });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    expect(canHit(state, imp.id, foe.id)).toBe(true);
    expect(FOG_VISION).toBeGreaterThan(1);
  });
});

describe('a gale', () => {
  it('carries a shot further downwind', () => {
    const state = underSky({ kind: 'gale', wind: { x: 0, y: -1 } });
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 7 } });
    // Range 4 normally; five tiles upwind of the shooter, which the wind is blowing toward.
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 } });

    expect(canHit(state, lobber.id, far.id)).toBe(true);
  });

  it('makes it fall short into the wind', () => {
    const state = underSky({ kind: 'gale', wind: { x: 0, y: 1 } });
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 7 } });
    const atFour = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    expect(canHit(state, lobber.id, atFour.id), 'range 4 becomes 3 into a headwind').toBe(false);
  });

  it('does nothing across the wind', () => {
    const state = underSky({ kind: 'gale', wind: { x: 1, y: 0 } });
    const lobber = addUnit(state, { def: 'cinder_lobber', side: 'player', at: { x: 3, y: 7 } });
    const atFour = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    expect(canHit(state, lobber.id, atFour.id)).toBe(true);
  });

  it('leaves melee untouched', () => {
    // A wind that could hold off a sword would be a different kind of problem.
    const state = underSky({ kind: 'gale', wind: { x: 0, y: 1 } });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 } });

    expect(canHit(state, imp.id, foe.id)).toBe(true);
  });
});

describe('torrential rain', () => {
  /** A burn tick, which is genuinely fire — unlike a Pyre unit's swing, which is not. */
  function burnFor(stacks: number, weather?: Weather): number {
    const state = weather ? underSky(weather) : scenario({ width: 8, height: 8 });
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
      keywords: [],
    });
    state.units[foe.id]!.statuses.burn = stacks;

    // Statuses tick at the start of the burning side's turn.
    const res = applyCommand(state, { type: 'endTurn' });
    return 200 - res.state.units[foe.id]!.hp;
  }

  it('blunts fire', () => {
    expect(burnFor(3, { kind: 'rain' })).toBe(burnFor(3) - RAIN_FIRE_PENALTY);
  });

  it('leaves a warrior swinging just as hard, being no kind of fire', () => {
    const state = underSky({ kind: 'rain' });
    const imp = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 4 } });
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 200,
      keywords: [],
    });

    const res = applyCommand(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(200 - res.state.units[foe.id]!.hp).toBe(state.units[imp.id]!.atk);
  });

  it('cannot drive a hit below nothing', () => {
    // A single stack of burn in a downpour goes out entirely rather than healing anyone.
    expect(burnFor(1, { kind: 'rain' })).toBe(0);
  });
});

describe('clear skies', () => {
  it('change nothing at all', () => {
    const state = scenario({ width: 8, height: 8 });
    expect(state.encounter.weather).toBeUndefined();

    const sniper = addUnit(state, { def: 'longshot_stalker', side: 'player', at: { x: 3, y: 7 } });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 0 } });
    expect(canHit(state, sniper.id, far.id)).toBe(true);
  });
});

/**
 * Surge conduction.
 *
 * The one weather effect that adds damage rather than subtracting reach, and the one
 * that needed a damage type to exist before it could be written at all: `shock` is what
 * a Surge card deals, exactly as a Pyre card deals `fire`.
 */
describe('torrential rain conducting a shock', () => {
  /**
   * Drives `dealDamage` directly rather than through Arc Lash.
   *
   * Conduction is a property of the damage, not of the card: a Surge unit's swing or a
   * future Surge mark would arc identically, and testing through one caller would tie
   * the rule to that caller.
   */
  const strike = (state: GameState, targetId: string, dtype: DamageType) => {
    const next = deepClone(state);
    const ctx = makeCtx(next);
    dealDamage(ctx, {
      target: { kind: 'unit', id: targetId },
      amount: 30,
      dtype,
      cause: 'spell',
    });
    return { units: next.units, events: ctx.events };
  };

  const cluster = (weather: Weather) => {
    const state = underSky(weather);
    // The one struck, two of its own side touching it, one standing clear, and a unit
    // of the caster's side pressed right up against the target.
    const primary = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 200 });
    const orthogonal = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 }, hp: 200 });
    const diagonal = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 200 });
    const clear = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 6, y: 6 }, hp: 200 });
    const ally = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 4 }, hp: 200 });
    return { state, primary, orthogonal, diagonal, clear, ally };
  };

  it("jumps to everything of the target's side that is touching it", () => {
    const { state, primary, orthogonal, diagonal, clear } = cluster({ kind: 'rain' });
    const out = strike(state, primary.id, 'shock');

    expect(out.units[primary.id]!.hp, 'the primary takes the full hit').toBe(170);
    expect(out.units[orthogonal.id]!.hp, 'orthogonal neighbour').toBe(190);
    expect(out.units[diagonal.id]!.hp, 'diagonal neighbour').toBe(190);
    expect(out.units[clear.id]!.hp, 'two tiles away, untouched').toBe(200);
  });

  it("strikes the caster's own line too, exactly as a volatile crystal does", () => {
    // Electricity does not check allegiance. This is what makes casting into a melee in
    // the rain a decision rather than a free bonus.
    const { state, primary, ally } = cluster({ kind: 'rain' });
    expect(strike(state, primary.id, 'shock').units[ally.id]!.hp).toBe(190);
  });

  it('does nothing under any other sky', () => {
    const { state, primary, orthogonal, diagonal } = cluster({ kind: 'fog' });
    const out = strike(state, primary.id, 'shock');
    expect(out.units[primary.id]!.hp).toBe(170);
    expect(out.units[orthogonal.id]!.hp).toBe(200);
    expect(out.units[diagonal.id]!.hp).toBe(200);
  });

  it('does not arc from fire, however wet the ground', () => {
    const { state, primary, orthogonal } = cluster({ kind: 'rain' });
    const out = strike(state, primary.id, 'fire');
    // Rain dampens the fire instead, which is the other half of the same sky.
    expect(out.units[primary.id]!.hp).toBe(200 - (30 - RAIN_FIRE_PENALTY));
    expect(out.units[orthogonal.id]!.hp).toBe(200);
  });

  it('arcs deal physical, so an arc cannot arc', () => {
    // The bound on the recursion. Were the secondary hits `shock`, a line of units in
    // the rain would chain end to end from a single cast.
    const { state, primary } = cluster({ kind: 'rain' });
    const out = strike(state, primary.id, 'shock');

    const arcs = out.events.filter(
      (e) => e.t === 'damageDealt' && e.cause === 'reaction' && e.dtype === 'physical',
    );
    // Two of the target's own side plus the caster's unit pressed against it.
    expect(arcs).toHaveLength(3);
    expect(
      out.events.some((e) => e.t === 'damageDealt' && e.dtype === 'shock' && e.cause === 'reaction'),
    ).toBe(false);
  });

  it('ships a Surge card that can actually reach this rule', () => {
    // The reason this feature waited: a branch nothing can trigger is untestable.
    expect(CARDS.arc_lash?.school).toBe('surge');
    const eff = CARDS.arc_lash!.effect;
    expect(eff.op === 'damage' && eff.dtype).toBe('shock');
  });
});
