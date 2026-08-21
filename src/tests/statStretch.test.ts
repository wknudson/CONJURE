import { describe, expect, it } from 'vitest';
import { STAT_SCALE, unscaleStat } from '../core/scale.js';
import { CARDS } from '../core/data/cards/index.js';
import { ALL_AURAS } from '../core/data/auras.js';
import { RUNES } from '../core/data/runes.js';
import { TITHE_DAMAGE, TITHE_MARROW } from '../core/engine/effects.js';
import {
  COLLISION_BLOCKER_DAMAGE,
  COLLISION_OBSTACLE_DAMAGE,
  COLLISION_TARGET_DAMAGE,
} from '../core/engine/displacement.js';
import { createCombat, MAX_ARENA } from '../core/engine/setup.js';
import { applyCommand } from '../core/engine/engine.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import {
  VANGUARD_ATK_PER_LEVEL,
  VANGUARD_MAX_HP_PER_LEVEL,
  VANGUARD_START_LEVEL,
  unlockVanguard,
  vanguardBonus,
  vanguardLevelOf,
  vanguardLevels,
  rosterPool,
  type VanguardProgress,
} from '../core/data/roster.js';
import { CLINIC_RATE, clinicPrice, APOTHECARY_STOCK } from '../core/data/apothecary.js';
import { BASE_PACT_HP, HP_ROLL_MAX, HP_ROLL_MIN } from '../core/overworld/vivarium.js';
import { CRITICAL_HP } from '../core/overworld/state.js';
import type { GameState } from '../core/types/state.js';

/**
 * The Stat Stretch, and what it is allowed to touch.
 *
 * Every health number in the game is now authored ten times larger, so that a level can
 * buy a *small* improvement instead of a 33% one. The interesting half of that change is
 * not the multiplication -- it is the boundary. Pips, Marrow, hand size, movement, range
 * and status stacks are counted rather than measured, and a hand of seventy cards is not
 * a finer-grained game, it is a broken one.
 *
 * So these tests are mostly about the seam: the places a stretched number meets one that
 * did not stretch, and has to be converted rather than compared.
 */

describe('the scale itself', () => {
  it('is ten, and undoes itself upward', () => {
    expect(STAT_SCALE).toBe(10);
    expect(unscaleStat(40)).toBe(4);
    // Rounded up: a wound smaller than one old point still cost something, and a Clinic
    // bill of zero for a real injury is the one rounding anybody would notice.
    expect(unscaleStat(1)).toBe(1);
    expect(unscaleStat(11)).toBe(2);
    expect(unscaleStat(0)).toBe(0);
  });
});

describe('the data layer', () => {
  it('stretched every body, and left the grid alone', () => {
    const bodies = Object.values(CARDS).filter((c) => c.unit);
    expect(bodies.length).toBeGreaterThan(20);

    for (const def of bodies) {
      const u = def.unit!;
      expect(u.hp % STAT_SCALE, `${def.id} hp`).toBe(0);
      expect(u.atk % STAT_SCALE, `${def.id} atk`).toBe(0);
      // A body that survives one point of anything is a body the stretch missed.
      expect(u.hp, `${def.id} hp`).toBeGreaterThanOrEqual(STAT_SCALE);

      // The counted half. Nothing here may have been multiplied: a Footman that moved
      // twenty tiles would cross the widest arena in the game twice in one turn.
      expect(u.mov, `${def.id} mov`).toBeLessThanOrEqual(6);
      // Either it fits the largest arena, or it is the marksman's `99` -- the sentinel
      // for "any distance down a line", which is a flag wearing a number and not a reach
      // anything could have been multiplied into.
      const boardScale = u.rangeMax === 99 || u.rangeMax <= MAX_ARENA;
      expect(boardScale, `${def.id} range ${u.rangeMax}`).toBe(true);
      expect([1, 2], `${def.id} footprint`).toContain(u.footprint);
    }
  });

  it('left card costs where they were', () => {
    for (const def of Object.values(CARDS)) {
      expect(def.cost.pips, `${def.id} pips`).toBeLessThanOrEqual(8);
      expect(def.cost.marrow, `${def.id} marrow`).toBeLessThanOrEqual(4);
    }
  });

  it('stretched obstacles too, so a wall is not paper', () => {
    for (const def of Object.values(CARDS)) {
      if (def.obstacleHp === undefined) continue;
      expect(def.obstacleHp % STAT_SCALE, `${def.id}`).toBe(0);
    }
  });

  it('stretched an Aura stat but not its stacks', () => {
    for (const aura of ALL_AURAS) {
      // Three, everywhere. It is the name of the mechanic, and it is a count.
      expect(aura.maxStacks, aura.defId).toBe(3);
      for (const key of ['atk', 'maxHp', 'armor'] as const) {
        const value = aura.passiveStat[key];
        if (value !== undefined) expect(value % STAT_SCALE, `${aura.defId}.${key}`).toBe(0);
      }
      // MOV is a tile. Marrow is a resource. Neither stretched.
      if (aura.passiveStat.mov !== undefined) expect(aura.passiveStat.mov).toBeLessThan(STAT_SCALE);
      if (aura.upkeep?.marrow !== undefined) expect(aura.upkeep.marrow).toBeLessThan(STAT_SCALE);
      if (aura.upkeep?.selfDamage !== undefined) {
        expect(aura.upkeep.selfDamage % STAT_SCALE).toBe(0);
      }
    }
  });

  it('stretched rune payloads', () => {
    for (const rune of Object.values(RUNES)) {
      expect(rune.damage % STAT_SCALE, rune.id).toBe(0);
    }
  });
});

describe('the engine constants', () => {
  it('bleeds thirty for two, per the brief', () => {
    expect(TITHE_DAMAGE).toBe(30);
    // Marrow is spent, not suffered. It did not stretch and must not.
    expect(TITHE_MARROW).toBe(2);
  });

  it('collides for thirty into a wall and twenty into a body', () => {
    expect(COLLISION_TARGET_DAMAGE).toBe(30);
    expect(COLLISION_BLOCKER_DAMAGE).toBe(20);
    expect(COLLISION_OBSTACLE_DAMAGE).toBe(30);
  });
});

describe('the seams, where a stretched number meets one that did not stretch', () => {
  it('keeps the Clinic priced in the money it was priced in', () => {
    // Forty old points of damage. Before the stretch that was a bill of 4 x 3 = 12
    // Ducats, and it still is: health multiplied, Ducats did not, and a bill that went
    // up tenfold overnight would make recovery the most expensive thing in the game.
    const overworld = { pact: { maxHp: 400, currentHp: 360 } } as never;
    expect(clinicPrice(overworld)).toBe(4 * CLINIC_RATE);
  });

  it('charges for a wound too small to fill a band, rather than nothing', () => {
    const overworld = { pact: { maxHp: 400, currentHp: 397 } } as never;
    expect(clinicPrice(overworld)).toBe(CLINIC_RATE);
  });

  it('stretched the tonic, so it still restores what it used to', () => {
    const tonic = APOTHECARY_STOCK.find((s) => s.item.id === 'mending_tonic')!;
    expect(tonic.item.value).toBe(120);
    // And its price did not move: the Ducat is the one thing on the shelf that is real.
    expect(tonic.price).toBe(25);
  });

  it('stretched the Pact and the band a beast rolls in', () => {
    expect(BASE_PACT_HP).toBe(400);
    expect(HP_ROLL_MIN).toBe(360);
    expect(HP_ROLL_MAX).toBe(440);
    expect(CRITICAL_HP).toBe(50);
  });

  it('caps Harvest the Weak in Marrow, not in blood', () => {
    // The one op that reads a wound and pays a resource. Its cap is four *Marrow*, and a
    // tithe of forty measured against it directly would pay the maximum off any body with
    // a scratch on it -- which is exactly what the cap exists to stop.
    const card = CARDS.harvest_the_weak!;
    const extract = (card.effect as { effects: { op: string; amount?: unknown }[] }).effects.find(
      (e) => e.op === 'extractMarrow',
    )!;
    expect(extract.amount).toEqual({ from: 'titheDamage', max: 4 });
    // The blood it takes did stretch, and the two numbers are deliberately incomparable.
    const tithe = (card.effect as { effects: { op: string; damage?: number }[] }).effects.find(
      (e) => e.op === 'tithe',
    )!;
    expect(tithe.damage).toBe(40);
  });
});

// ---------------------------------------------------------------- levelling

describe('Vanguard progression', () => {
  it('pays nothing at level 1, and two-and-ten per level after', () => {
    expect(vanguardBonus(VANGUARD_START_LEVEL)).toEqual({ atk: 0, maxHp: 0 });
    expect(vanguardBonus(2)).toEqual({
      atk: VANGUARD_ATK_PER_LEVEL,
      maxHp: VANGUARD_MAX_HP_PER_LEVEL,
    });
    // The brief's own worked example: a level 3 Footman is +4 ATK and +20 Max HP.
    expect(vanguardBonus(3)).toEqual({ atk: 4, maxHp: 20 });
  });

  it('never pays out for a level below the floor', () => {
    // A hand-edited save is a thing that happens, and a level of zero must not become a
    // *penalty* -- it is simply not a level.
    expect(vanguardBonus(0)).toEqual({ atk: 0, maxHp: 0 });
    expect(vanguardBonus(-5)).toEqual({ atk: 0, maxHp: 0 });
  });

  it('starts a body at level 1 with nothing earned', () => {
    const progress = unlockVanguard({}, 'vanguard_footman');
    expect(progress.vanguard_footman).toEqual({ level: VANGUARD_START_LEVEL, xp: 0 });
  });

  it('does not reset a body that is already on the books', () => {
    // The whole contract of the function. A Companion that re-granted its bodies on every
    // taming would otherwise demote everything the player had trained.
    const trained: Record<string, VanguardProgress> = {
      vanguard_footman: { level: 6, xp: 120 },
    };
    const after = unlockVanguard(trained, 'vanguard_footman');
    expect(after).toBe(trained);
    expect(after.vanguard_footman!.level).toBe(6);
  });

  it('refuses to enrol something that is not a body', () => {
    expect(unlockVanguard({}, 'flame_surge')).toEqual({});
    expect(unlockVanguard({}, 'no_such_card')).toEqual({});
  });

  it('reads a missing record as level 1 rather than level zero', () => {
    expect(vanguardLevelOf(undefined, 'vanguard_footman')).toBe(VANGUARD_START_LEVEL);
    expect(vanguardLevelOf({}, 'vanguard_footman')).toBe(VANGUARD_START_LEVEL);
    expect(vanguardLevelOf({ vanguard_footman: { level: 0, xp: 0 } }, 'vanguard_footman')).toBe(1);
  });

  it('hands the engine only what differs from the printed card', () => {
    // Level 1 is the card. Sending it would be sending the engine a fact it already has,
    // and would make every fight carry a map the size of the roster for no reason.
    const levels = vanguardLevels({
      vanguard_footman: { level: 3, xp: 0 },
      scout_imp: { level: 1, xp: 40 },
    });
    expect(levels).toEqual({ vanguard_footman: 3 });
  });
});

describe('a levelled body on the board', () => {
  const ANCHOR = (state: GameState) => state.anchors[0]!;

  function deployed(level?: number): GameState {
    const carry = level === undefined ? undefined : { vanguardLevels: { vanguard_footman: level } };
    const { state } = createCombat(
      NOVICE_DUELIST,
      11,
      undefined,
      undefined,
      carry,
      ['vanguard_footman'],
    );
    return applyCommand(state, {
      type: 'deployUnit',
      defId: 'vanguard_footman',
      at: ANCHOR(state),
    }).state;
  }

  function footman(state: GameState) {
    return Object.values(state.units).find(
      (u) => u.defId === 'vanguard_footman' && u.side === 'player',
    )!;
  }

  it('enters the fight at its printed numbers when it has no career', () => {
    const printed = CARDS.vanguard_footman!.unit!;
    const unit = footman(deployed());
    expect(unit.atk).toBe(printed.atk);
    expect(unit.maxHp).toBe(printed.hp);
  });

  it('enters the fight carrying its levels', () => {
    const printed = CARDS.vanguard_footman!.unit!;
    const unit = footman(deployed(3));
    expect(unit.atk).toBe(printed.atk + 4);
    expect(unit.maxHp).toBe(printed.hp + 20);
    // Whole, not merely capable of being whole: a body that deployed wounded by its own
    // level would be a promotion that hurt.
    expect(unit.hp).toBe(unit.maxHp);
  });

  it('announces the levelled stats, rather than the printed ones', () => {
    // The renderer draws the snapshot on the event and never re-reads live state, so a
    // body raised a line after the emit would be drawn permanently wrong.
    const carry = { vanguardLevels: { vanguard_footman: 4 } };
    const { state } = createCombat(
      NOVICE_DUELIST,
      11,
      undefined,
      undefined,
      carry,
      ['vanguard_footman'],
    );
    const step = applyCommand(state, {
      type: 'deployUnit',
      defId: 'vanguard_footman',
      at: state.anchors[0]!,
    });
    const summoned = step.events.find((e) => e.t === 'unitSummoned')!;
    expect(summoned.unit.atk).toBe(CARDS.vanguard_footman!.unit!.atk + 6);
    expect(summoned.unit.maxHp).toBe(CARDS.vanguard_footman!.unit!.hp + 30);
  });

  it('records the level on the roster entry, so a revival can read it back', () => {
    const state = deployed(3);
    expect(state.players.player.roster[0]!.level).toBe(3);
  });

  it('treats a fight with no carry as a warband of unknowns at level 1', () => {
    const state = deployed();
    expect(state.players.player.roster[0]!.level).toBe(1);
  });
});

describe('the roster pool', () => {
  it('offers only bodies, so nothing unlevellable can be enrolled', () => {
    for (const def of rosterPool()) {
      expect(def.kind, def.id).toBe('minion');
      expect(unlockVanguard({}, def.id)[def.id]).toEqual({ level: 1, xp: 0 });
    }
  });
});
