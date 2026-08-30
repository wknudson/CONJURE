import { describe, expect, it } from 'vitest';
import {
  addUnit,
  alongLine,
  atTile,
  damageTo,
  eventsOf,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { PYRE_CARDS } from '../core/data/cards/pyre.js';
import { HYBRID_CARDS } from '../core/data/cards/hybrid.js';
import { REAGENTS, SPLICE_RECIPES, recipeFor } from '../core/data/splicing.js';
import { spliceCard } from '../core/overworld/splice.js';
import { isObtainable } from '../core/data/collection.js';
import { DEFAULT_ROSTER, rosterPointsOf, validateRoster } from '../core/data/roster.js';
import { DEFAULT_COMPANION } from '../core/data/companions.js';
import {
  CATALOG_TARGET,
  SCHOOLS,
  catalogGaps,
  minionPool,
  rosterUnlocksFor,
  spellPool,
} from '../core/data/pools.js';
import { PLATE_CAP } from '../core/engine/growth.js';
import { startOfTurnStatuses } from '../core/engine/status.js';
import { makeCtx } from '../core/engine/context.js';
import { coordKey } from '../contract/ids.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';

/**
 * The catalog expansion: eighteen school cards, six new pressings, and the primitives
 * they needed.
 *
 * Most of this file is one test per card actually resolving on a board, because "playable"
 * is the claim being made and a card that typechecks is not a card that works. The
 * primitives get their own section, since each of them is a new seam in the reducer and
 * several are read at chokepoints every fight passes through.
 */

/** The eighteen mono-elemental additions, by school. */
const NEW_MONO = [
  'ashen_wake',
  'ember_moth',
  'pyre_pillar',
  'creeping_rime',
  'glacial_stalker',
  'rime_lock',
  'arcing_step',
  'storm_wisp',
  'thunderhead',
  'tectonic_plate',
  'stone_heart_golem',
  'avalanche_slam',
  'shadow_siphon',
  'hollowed_husk',
  'grave_call',
  'noxious_cloud',
  'briar_wolf',
  'root_snare',
];

/** The seven pressings the expansion asked for. Galvanic Spores already shipped. */
const NEW_HYBRIDS = [
  'thermal_eruption',
  'plasma_arc',
  'magma_shove',
  'scorched_earth',
  'icebreaker',
  'aetheric_overload',
  'galvanic_spores',
];

const board = (hand: string[] = [], bones = 8) =>
  scenario({ width: 6, height: 8, hand, bones });

describe('the new shelf', () => {
  it('registers all eighteen, each under a real school', () => {
    for (const id of NEW_MONO) {
      const def = CARDS[id];
      expect(def, id).toBeDefined();
      expect(SCHOOLS, `${id} school`).toContain(def!.school);
      expect(def!.text.length, `${id} has no rules text`).toBeGreaterThan(20);
    }
  });

  it('keeps every one of them out of the splicing bench and in the loot pool', () => {
    // The mirror of the hybrid rule. A school card the player can never find is a card
    // that does not exist; a hybrid the player can find for free is a sink that does not.
    for (const id of NEW_MONO) {
      expect(CARDS[id]!.spliceOnly, id).toBeUndefined();
    }
    for (const id of NEW_MONO.filter((i) => CARDS[i]!.kind !== 'minion')) {
      expect(isObtainable(CARDS[id]!), `${id} is unreachable`).toBe(true);
    }
  });

  it('prices every new body on the point ladder', () => {
    // `rosterPointsOf` derives rather than reads, so a body cannot ship without a cost —
    // but it can ship at a cost nobody looked at. These are the four that matter.
    expect(rosterPointsOf(CARDS.ember_moth!)).toBe(2);
    expect(rosterPointsOf(CARDS.glacial_stalker!)).toBe(2);
    expect(rosterPointsOf(CARDS.stone_heart_golem!)).toBe(2);
    expect(rosterPointsOf(CARDS.briar_wolf!)).toBe(2);
  });

  it('gives Pyre a shelf of its own', () => {
    // The starter four stay in `starter.ts`; everything new is here. Both are Pyre, and
    // `spellPool` cannot tell the difference, which is the point.
    //
    // A superset check rather than an exact one. This assertion was pinned to the three
    // cards the first expansion added, which made *adding a Pyre card* a test failure — a
    // guard that fires on the thing it was meant to permit. What it should protect is the
    // split itself: these live here, the founders live in `starter.ts`.
    for (const id of ['ashen_wake', 'ember_moth', 'pyre_pillar']) {
      expect(Object.keys(PYRE_CARDS), `${id} left the Pyre shelf`).toContain(id);
    }
    expect(Object.keys(PYRE_CARDS), 'a founder wandered onto the expansion shelf').not.toContain(
      'flame_surge',
    );
    const pyre = spellPool('pyre').map((c) => c.id);
    expect(pyre, 'the new one').toContain('ashen_wake');
    expect(pyre, 'and the old one').toContain('flame_surge');
  });
});

describe('the new pressings', () => {
  it('registers all seven, spliceOnly and cast from the Companion', () => {
    for (const id of NEW_HYBRIDS) {
      const def = CARDS[id];
      expect(def, id).toBeDefined();
      expect(def!.spliceOnly, id).toBe(true);
      expect(def!.source, id).toBe('companion');
      expect(def!.range, id).toBeGreaterThan(0);
      expect(isObtainable(def!), `${id} leaked into the loot pool`).toBe(false);
      expect(HYBRID_CARDS[id], `${id} is not in the hybrid bank`).toBeDefined();
    }
  });

  it('gives every one of them a row in the book', () => {
    const results = SPLICE_RECIPES.map((r) => r.resultId);
    for (const id of NEW_HYBRIDS) {
      expect(results, `${id} has no recipe`).toContain(id);
    }
  });

  it('bottles one Core per school, and spends every one of them', () => {
    // A pressing is two schools and the *base card* is always one of them, so a Bulwark
    // spell plus a Pyre Core is a Pyre/Bulwark fusion without Bulwark ever being bottled.
    // That trick covered ten pairings on three Cores — and then ran out, because the three
    // pairings *among* Bulwark, Dusk and Bloom contain none of the original three. Hence
    // six Cores, one per school.
    expect(REAGENTS).toHaveLength(SCHOOLS.length);
    for (const school of SCHOOLS) {
      expect(REAGENTS.map((x) => x.school), `${school} is not bottled`).toContain(school);
    }
    // Both directions. A Core no recipe takes is a reward the player can earn and never
    // spend; a catalyst no Core provides is a row nobody can press.
    for (const r of SPLICE_RECIPES) {
      expect(REAGENTS.some((x) => x.id === r.catalystId), r.resultId).toBe(true);
    }
    for (const x of REAGENTS) {
      expect(SPLICE_RECIPES.some((r) => r.catalystId === x.id), `${x.id} presses nothing`).toBe(
        true,
      );
    }
  });

  it('actually presses each of the six new rows', () => {
    const press = (base: string, core: string) => {
      const prereqs = recipeFor(base, core)?.requiredUnlockedCards ?? [];
      const overworld = newRun(1);
      overworld.economy.reagents = { [core]: 1 };
      const global: GlobalGameState = { overworld, combat: null };
      const collection = { unlocked: [base, ...prereqs] };
      return spliceCard(global, collection, base, core);
    };

    expect(press('ember_coat', 'core_frost')?.resultId).toBe('thermal_eruption');
    expect(press('arc_lash', 'core_pyre')?.resultId).toBe('plasma_arc');
    expect(press('seismic_slam', 'core_pyre')?.resultId).toBe('magma_shove');
    expect(press('spore_cloud', 'core_pyre')?.resultId).toBe('scorched_earth');
    expect(press('seismic_slam', 'core_frost')?.resultId).toBe('icebreaker');
    expect(press('marrow_siphon', 'core_surge')?.resultId).toBe('aetheric_overload');
  });
});

// --------------------------------------------------------------------- the cards, cast

describe('Pyre', () => {
  it('Ashen Wake burns the line, and only Frails one that was already alight', () => {
    const cast = (alight: boolean) => {
      const state = board(['ashen_wake']);
      const near = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
      const far = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 } });
      if (alight) near.statuses.burn = 1;
      const card = handCard(state, 'player', 'ashen_wake');
      const res = run(state, play(card, alongLine({ x: 2, y: 4 }, { x: 0, y: -1 })));
      return {
        hit: damageTo(res.events, near.id),
        nearBrittle: res.state.units[near.id]?.statuses.brittle ?? 0,
        farBrittle: res.state.units[far.id]?.statuses.brittle ?? 0,
      };
    };

    expect(cast(false).hit, 'the flat half always lands').toBe(20);
    expect(cast(false).nearBrittle, 'nothing was burning').toBe(0);
    // Any burning thing on the line arms it, and then the whole line takes the Frailty.
    expect(cast(true).nearBrittle, 'the one that was alight').toBe(1);
    expect(cast(true).farBrittle, 'and everything beside it').toBe(1);
  });

  it('the Ember Moth sets its killers alight and spares its own side', () => {
    const state = board();
    const moth = addUnit(state, { def: 'ember_moth', side: 'player', at: { x: 3, y: 3 } });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
    const friend = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });

    const killer = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } });
    state.activeSide = 'enemy';
    const res = run(state, {
      type: 'attack',
      attacker: killer.id,
      target: { kind: 'unit', id: moth.id },
    });

    expect(res.state.units[moth.id], 'twenty health is one blow').toBeUndefined();
    expect(res.state.units[foe.id]!.statuses.burn, 'an adjacent enemy').toBe(1);
    expect(res.state.units[killer.id]!.statuses.burn, 'and the one that did it').toBe(1);
    expect(res.state.units[friend.id]!.statuses.burn ?? 0, 'never its own side').toBe(0);
  });

  it('the Pyre Pillar lights the row at the start of the enemy turn', () => {
    const state = board(['pyre_pillar']);
    const inRow = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 5, y: 3 } });
    const offRow = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 5, y: 5 } });
    const mine = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 1, y: 3 } });

    const card = handCard(state, 'player', 'pyre_pillar');
    const raised = run(state, play(card, atTile(3, 3))).state;
    expect(Object.values(raised.obstacles).some((o) => o.defId === 'pyre_pillar')).toBe(true);

    // The owner's own turn first. The pillar has to be silent here, and it is the *only*
    // moment it could burn its own line — `obstacleUpkeep` only ever walks the side whose
    // turn is beginning, so checking a friendly body on the enemy's turn proves nothing.
    startOfTurnStatuses(makeCtx(raised), 'player');
    expect(raised.units[mine.id]!.statuses.burn ?? 0, 'never the side that raised it').toBe(0);

    startOfTurnStatuses(makeCtx(raised), 'enemy');
    expect(raised.units[inRow.id]!.statuses.burn, 'same row').toBe(1);
    expect(raised.units[offRow.id]!.statuses.burn ?? 0, 'a different row').toBe(0);
  });
});

describe('Frost', () => {
  it('Creeping Rime chills the target and its four neighbours', () => {
    const state = board(['creeping_rime']);
    const mid = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } });
    const diagonal = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 4 } });

    const card = handCard(state, 'player', 'creeping_rime');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: mid.id } }));

    expect(res.state.units[mid.id]!.statuses.chill, 'the target').toBe(1);
    expect(res.state.units[beside.id]!.statuses.chill, 'orthogonal').toBe(1);
    expect(res.state.units[diagonal.id]!.statuses.chill ?? 0, 'not the diagonal').toBe(0);
  });

  it('the Glacial Stalker hits a Chilled body harder', () => {
    const struck = (chilled: boolean) => {
      const state = board();
      const stalker = addUnit(state, { def: 'glacial_stalker', side: 'player', at: { x: 3, y: 4 } });
      const prey = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 3, y: 3 },
        hp: 300,
      });
      if (chilled) prey.statuses.chill = 1;
      const res = run(state, {
        type: 'attack',
        attacker: stalker.id,
        target: { kind: 'unit', id: prey.id },
      });
      return damageTo(res.events, prey.id);
    };

    expect(struck(false), 'printed').toBe(20);
    expect(struck(true), 'hunting').toBe(40);
  });

  it('Rime Lock holds a body, or finishes one already held', () => {
    const cast = (frozen: boolean) => {
      const state = board(['rime_lock']);
      const prey = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 3, y: 3 },
        hp: 300,
        armor: 60,
      });
      if (frozen) prey.statuses.freeze = 1;
      const card = handCard(state, 'player', 'rime_lock');
      const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));
      return {
        damage: damageTo(res.events, prey.id),
        freeze: res.state.units[prey.id]?.statuses.freeze ?? 0,
      };
    };

    expect(cast(false), 'a free body is locked down').toEqual({ damage: 0, freeze: 1 });
    // Through the plate: Pierce is the `true` damage type in this engine.
    expect(cast(true).damage, 'one already held is finished').toBe(50);
  });
});

describe('Surge', () => {
  it('Arcing Step lengthens an ally’s stride and leaves it Charged', () => {
    const state = board(['arcing_step']);
    const ally = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    const card = handCard(state, 'player', 'arcing_step');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: ally.id } }));

    expect(res.state.units[ally.id]!.statuses.fleet, 'two more tiles').toBe(2);
    expect(res.state.units[ally.id]!.statuses.charged, 'and a charge to set off').toBe(1);
  });

  it('the Storm Wisp is paid a Bone for swinging, so its swing is free', () => {
    // Opened with one Bone rather than none, because a swing costs one now. The refund then
    // hands it straight back: the Wisp exactly funds its own attack, which is the whole reason
    // `refunds.onAttack` had to start respecting the reaction cap. Uncapped, a second Wisp made
    // attacking profitable rather than free.
    const state = board([], 1);
    const wisp = addUnit(state, { def: 'storm_wisp', side: 'player', at: { x: 3, y: 4 } });
    addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, armor: 300 });
    const foe = Object.values(state.units).find((u) => u.side === 'enemy')!;

    const res = run(state, {
      type: 'attack',
      attacker: wisp.id,
      target: { kind: 'unit', id: foe.id },
    });

    // Paid whether or not it drew blood: a Wisp held off by plate has still discharged. One in,
    // one out, one back — net unchanged.
    expect(res.state.players.player.bones).toBe(1);
    expect(eventsOf(res.events, 'boneRefunded').length).toBe(1);
  });

  it('the Thunderhead earths outward only on a full bank', () => {
    const cast = (bones: number) => {
      const state = board(['thunderhead'], bones);
      const mid = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
      const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 } });
      const card = handCard(state, 'player', 'thunderhead');
      const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: mid.id } }));
      return { mid: damageTo(res.events, mid.id), beside: damageTo(res.events, beside.id) };
    };

    // Two Bones in hand pays the cost and leaves nothing, so the condition fails.
    expect(cast(2), 'bank empty after paying').toEqual({ mid: 30, beside: 0 });
    // Five leaves three, which is the threshold.
    expect(cast(5).beside, 'three still banked').toBe(20);
  });
});

describe('Bulwark', () => {
  it('Tectonic Plate armours one body and clears the ground around it', () => {
    const state = board(['tectonic_plate']);
    const ally = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });

    const card = handCard(state, 'player', 'tectonic_plate');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: ally.id } }));

    expect(res.state.units[ally.id]!.armor).toBe(30);
    expect(res.state.units[foe.id]!.anchor, 'shoved off the wall').not.toEqual({ x: 3, y: 3 });
  });

  it('the Stone-Heart Golem plates itself, and stops', () => {
    const state = board();
    const golem = addUnit(state, { def: 'stone_heart_golem', side: 'player', at: { x: 3, y: 4 } });
    golem.freshlySummoned = false;

    const ctx = makeCtx(state);
    for (let turn = 0; turn < 6; turn++) startOfTurnStatuses(ctx, 'player');

    // Not Escalate. Bounded at `PLATE_CAP` helpings, the same ceiling an Aura stops at.
    expect(state.units[golem.id]!.armor).toBe(10 * PLATE_CAP);
  });

  it('counts armour from anywhere against the Golem’s own ceiling', () => {
    // The ceiling is on the *total*, not on what this rule contributed, so a Golem handed
    // 25 by a Tectonic Plate tops up by five and stops rather than overshooting to 35.
    const state = board();
    const golem = addUnit(state, {
      def: 'stone_heart_golem',
      side: 'player',
      at: { x: 3, y: 4 },
      armor: 25,
    });
    golem.freshlySummoned = false;

    startOfTurnStatuses(makeCtx(state), 'player');
    expect(state.units[golem.id]!.armor).toBe(10 * PLATE_CAP);
  });

  it('Avalanche Slam only Frails a body it slammed into something', () => {
    const cast = (wall: boolean) => {
      const state = board(['avalanche_slam']);
      const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
      if (wall) addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
      const card = handCard(state, 'player', 'avalanche_slam');
      const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));
      return res.state.units[foe.id]?.statuses.brittle ?? 0;
    };

    expect(cast(false), 'clear air').toBe(0);
    expect(cast(true), 'into a body').toBe(1);
  });
});

describe('Dusk', () => {
  it('Shadow Siphon spends a body, drains the weakest, and heals the Pact', () => {
    const state = board(['shadow_siphon']);
    state.players.player.maxHp = 400;
    state.players.player.hp = 200;
    const fodder = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    const strong = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 1, y: 2 },
      hp: 300,
    });
    const weak = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 5, y: 2 },
      hp: 90,
      armor: 200,
    });

    const card = handCard(state, 'player', 'shadow_siphon');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: fodder.id } }));

    expect(res.state.units[fodder.id], 'spent whole').toBeUndefined();
    // Through the plate, and aimed by the board rather than by the caster.
    expect(damageTo(res.events, weak.id), 'the weakest').toBe(30);
    expect(damageTo(res.events, strong.id), 'not the nearest').toBe(0);
    expect(res.state.players.player.hp).toBe(230);
  });

  it('the Hollowed Husk pays two Bones for dying', () => {
    const state = board([], 0);
    const husk = addUnit(state, { def: 'hollowed_husk', side: 'player', at: { x: 3, y: 3 }, hp: 10 });
    const killer = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 2 } });
    state.activeSide = 'enemy';

    const res = run(state, {
      type: 'attack',
      attacker: killer.id,
      target: { kind: 'unit', id: husk.id },
    });

    expect(res.state.units[husk.id]).toBeUndefined();
    expect(res.state.players.player.bones, 'paid to its own side, on the enemy clock').toBe(2);
  });

  it('Grave Call trades a body for a Wraith that strikes through plate', () => {
    const state = board(['grave_call']);
    const fodder = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    const card = handCard(state, 'player', 'grave_call');
    const after = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: fodder.id } })).state;

    const wraith = Object.values(after.units).find((u) => u.defId === 'hollow_wraith');
    expect(wraith, 'raised').toBeDefined();
    expect(wraith!.anchor, 'on the tile it was spent from').toEqual({ x: 3, y: 4 });

    // No Haste, so it does not swing the turn it stands up — the Galvanic Revenant is the
    // card that pays for that, and this one is priced without it. Clear the flag to get at
    // the half being tested here.
    after.units[wraith!.id]!.summonedThisTurn = false;

    const plated = addUnit(after, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 300,
      armor: 300,
    });
    const res = run(after, {
      type: 'attack',
      attacker: wraith!.id,
      target: { kind: 'unit', id: plated.id },
    });

    // Straight through three hundred points of plate.
    expect(damageTo(res.events, plated.id)).toBe(40);
    expect(res.state.units[plated.id]!.armor, 'and the plate is untouched').toBe(300);
  });
});

describe('Bloom', () => {
  it('the Noxious Cloud poisons a 2x2 block anchored at the tile', () => {
    const state = board(['noxious_cloud']);
    const inside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 4 } });
    const outside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 } });

    const card = handCard(state, 'player', 'noxious_cloud');
    const res = run(state, play(card, atTile(3, 3)));

    expect(res.state.units[inside.id]!.statuses.toxin, 'the far corner of the block').toBe(2);
    expect(res.state.units[outside.id]!.statuses.toxin ?? 0, 'outside it').toBe(0);
  });

  it('the Briar Wolf poisons what it bites', () => {
    const state = board();
    const wolf = addUnit(state, { def: 'briar_wolf', side: 'player', at: { x: 3, y: 4 } });
    const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 300 });

    const res = run(state, {
      type: 'attack',
      attacker: wolf.id,
      target: { kind: 'unit', id: prey.id },
    });

    expect(res.state.units[prey.id]!.statuses.toxin).toBe(1);
  });

  it('the Root Snare roots and softens', () => {
    const state = board(['root_snare']);
    const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const card = handCard(state, 'player', 'root_snare');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));

    expect(res.state.units[prey.id]!.statuses.entangle).toBe(1);
    expect(res.state.units[prey.id]!.statuses.brittle).toBe(1);
  });
});

describe('the pressings, cast', () => {
  it('Thermal Eruption boils what it chilled, and burns what was frozen', () => {
    const state = board(['thermal_eruption']);
    const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 300 });
    const card = handCard(state, 'player', 'thermal_eruption');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));

    // The leading Chill is load-bearing: it is what gives the fire something to boil.
    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('vaporize');
    expect(Object.values(res.state.hazards).some((h) => h.kind === 'steam_fog'), 'fogged').toBe(true);
  });

  it('the Plasma Arc eats the fire it is paid with', () => {
    const cast = (burning: boolean) => {
      const state = board(['plasma_arc']);
      const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 300 });
      const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 }, hp: 300 });
      if (burning) prey.statuses.burn = 2;
      const card = handCard(state, 'player', 'plasma_arc');
      const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));
      return {
        mid: damageTo(res.events, prey.id),
        beside: damageTo(res.events, beside.id),
        burn: res.state.units[prey.id]?.statuses.burn ?? 0,
      };
    };

    expect(cast(false), 'a bad bolt into an empty board').toMatchObject({ mid: 20, beside: 0 });
    const paid = cast(true);
    expect(paid.mid, 'the burst').toBe(50);
    expect(paid.beside, 'and the jump').toBe(30);
    expect(paid.burn, 'the fire is genuinely spent').toBe(0);
  });

  it('the Magma Shove paves the route it dragged them down', () => {
    const state = board(['magma_shove']);
    const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 300 });
    const card = handCard(state, 'player', 'magma_shove');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));

    const burning = Object.values(res.state.hazards).filter((h) => h.kind === 'burning');
    expect(burning.length, 'the tile it left and every one it crossed').toBeGreaterThan(1);
    expect(burning.some((h) => h.at.x === 3 && h.at.y === 3), 'including where it started').toBe(true);
  });

  it('burning ground sets fire to whoever stops on it, either side', () => {
    const state = board();
    const mine = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
    state.hazards[coordKey({ x: 2, y: 4 })] = {
      at: { x: 2, y: 4 },
      kind: 'burning',
      turns: 2,
      owner: 'player',
    };

    startOfTurnStatuses(makeCtx(state), 'player');
    // Fire does not check a uniform. Shoving somebody onto your own road and then walking
    // into it is an ordinary mistake, and the card is better for being able to make it.
    expect(state.units[mine.id]!.statuses.burn).toBe(1);
  });

  it('Scorched Earth poisons the block and then ignites it', () => {
    const state = board(['scorched_earth']);
    const prey = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 400 });
    const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 }, hp: 400 });
    prey.statuses.toxin = 1;

    const card = handCard(state, 'player', 'scorched_earth');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));

    // Nothing in the effect list says Wildfire. The fire hit on a poisoned body is what
    // the reaction matches, and it consumes every stack.
    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('wildfire');
    expect(damageTo(res.events, beside.id), 'the blast reaches the neighbour').toBeGreaterThan(0);
    expect(res.state.units[prey.id]?.statuses.toxin ?? 0, 'every stack spent').toBe(0);
  });

  it('lays Scorched Earth’s poison centred on the target, not off one corner', () => {
    // The odd-size `square` convention, and the only card that uses it.
    //
    // The discriminating cell has to be one the corner convention covers and the centred
    // one does not — never the other way round, because *every* centred-only cell is also
    // adjacent to the target, and so has its poison eaten by the Wildfire chain a moment
    // later. (3,3)+(2,2) is a real 3x3; (3,3)..(5,5) is what a corner anchor would give,
    // and only that reading reaches the far corner.
    const state = board(['scorched_earth']);
    const mid = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 }, hp: 400 });
    const corner = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 5, y: 5 }, hp: 400 });

    const card = handCard(state, 'player', 'scorched_earth');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: mid.id } }));

    expect(res.state.units[corner.id]?.statuses.toxin ?? 0, 'two tiles down-right').toBe(0);
    // And the block genuinely was laid: the target's own stacks are what Wildfire spent.
    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('wildfire');
  });

  it('the Icebreaker is priced for the blow and sold for the Shatter', () => {
    const state = board(['icebreaker']);
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 3, y: 4 }, titheBonus: 0 });
    const prey = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 3 },
      hp: 300,
      armor: 90,
    });
    prey.statuses.freeze = 1;
    const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 4, y: 3 }, hp: 300 });

    const card = handCard(state, 'player', 'icebreaker');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: prey.id } }));

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('shatter');
    expect(res.state.units[prey.id]!.armor, 'all of it').toBe(0);
    expect(damageTo(res.events, beside.id), 'shrapnel').toBe(40);
  });

  it('Aetheric Overload is unplayable without a Charged body, and free with one', () => {
    const state = board(['aetheric_overload'], 0);
    const plain = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
    const charged = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    charged.statuses.charged = 1;

    const card = handCard(state, 'player', 'aetheric_overload');
    // `requiresStatus` means the plain body is not even offered.
    expect(() =>
      run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: plain.id } })),
    ).toThrow();

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: charged.id } }));
    expect(res.state.units[charged.id], 'spent whole').toBeUndefined();
    expect(res.state.players.player.bones).toBe(3);
  });

  it('never pays more Bones than the bank can hold', () => {
    const state = board(['aetheric_overload'], 8);
    const charged = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 4 } });
    charged.statuses.charged = 1;
    const card = handCard(state, 'player', 'aetheric_overload');
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: charged.id } }));

    // Clamped on the way in, so the card never advertises three and hands over one the
    // end of turn then takes back.
    expect(res.state.players.player.bones).toBe(res.state.players.player.boneCap);
  });
});

// ---------------------------------------------------------------- the pool architecture

describe('the catalog pools', () => {
  it('derives every school pool from the card database', () => {
    // The whole architecture claim: a card joins a pool by existing. Nothing here is a
    // list somebody has to remember to update.
    expect(spellPool('bulwark').map((c) => c.id)).toContain('tectonic_plate');
    expect(minionPool('bulwark').map((c) => c.id)).toContain('stone_heart_golem');
    expect(spellPool('pyre').map((c) => c.id), 'no fusions in a pure pool').not.toContain(
      'thermal_eruption',
    );
  });

  it('reports how far each school is from a full shelf', () => {
    // Deliberately asserted as a *ceiling on the gap* rather than as an exact number, so
    // authoring a card makes this test more true rather than making it fail.
    //
    // **That day came.** This block used to end with `expect(gaps.some(g => g.short > 0))`,
    // a tripwire whose own message read "if this fails the catalog is complete and the gap
    // report can go". Dusk was the last school short — seven draftable cards, because nine
    // of its twenty were Bound Forms and authored threats — and the decay shelf closed it.
    // The tripwire is gone; the report is not, because it is still the thing that answers
    // "is a new school ready to ship" and it costs nothing to keep asking.
    const gaps = catalogGaps();
    expect(gaps).toHaveLength(SCHOOLS.length);
    for (const gap of gaps) {
      expect(gap.spells, `${gap.school} has no shelf at all`).toBeGreaterThan(0);
      expect(gap.minions, `${gap.school} has no bodies`).toBeGreaterThan(0);
      expect(gap.short, `${gap.school} fell back below the target`).toBe(0);
    }
    expect(CATALOG_TARGET.min).toBe(10);
  });

  it('gates a body behind the bloodline that grants it', () => {
    const fresh = rosterUnlocksFor([]);
    expect(fresh, 'the floor is always there').toContain('vanguard_footman');
    expect(fresh, 'a Bulwark body is not free').not.toContain('stone_heart_golem');

    const withFerrum = rosterUnlocksFor(['ferrum']);
    expect(withFerrum, 'taming Bulwark buys the Bulwark shelf').toContain('stone_heart_golem');
    expect(withFerrum, 'and nothing else').not.toContain('briar_wolf');
  });

  it('gives a hybrid both of its schools', () => {
    // `schoolsOf` reads the Grimoire source, not `def.school` — a Grave-Gargoyle's `school`
    // names only the parent whose Resonance it borrows.
    const gargoyle = rosterUnlocksFor(['gargoyle']);
    expect(gargoyle, 'the Frost half').toContain('glacial_stalker');
    expect(gargoyle, 'and the Dusk half').toContain('hollowed_husk');
  });

  it('never refuses the warband the game itself deals out', () => {
    // Caught in the browser, not by a test: `DEFAULT_ROSTER` carries a Longshot Stalker,
    // which is Dusk, and a fresh character has tamed an Ignis. Gating it made the opening
    // position illegal — every chip in the tray greyed out, all of them reporting the same
    // unrelated body's lockout. The gate is about what a player may *add*.
    expect(validateRoster([...DEFAULT_ROSTER], rosterUnlocksFor([DEFAULT_COMPANION.id]))).toEqual(
      [],
    );
    // And with nothing tamed at all, which is what a hand-edited save can produce.
    expect(validateRoster([...DEFAULT_ROSTER], rosterUnlocksFor([]))).toEqual([]);
  });

  it('blames the body that is actually locked, not the first one in the list', () => {
    // The other half of the same browser bug. Every chip showed one unrelated refusal
    // because the screen took `problems[0]`, and a warband already holding an illegal body
    // makes that the first problem for every candidate.
    const unlocks = rosterUnlocksFor([]);
    const dirty = ['stone_heart_golem'];

    const already = validateRoster(dirty, unlocks);
    expect(already.map((p) => p.code), 'the warband is already wrong').toContain('not_unlocked');

    // Adding a *legal* body introduces nothing new, so the screen must offer it.
    const after = validateRoster([...dirty, 'scout_imp'], unlocks);
    const fresh = after.filter(
      (p) => !already.some((q) => q.code === p.code && ('defId' in q ? q.defId : '') === ('defId' in p ? p.defId : '')),
    );
    expect(fresh, 'a legal addition must not inherit the blame').toEqual([]);
  });

  it('refuses a roster holding a body this character never earned', () => {
    const problems = validateRoster(['stone_heart_golem'], rosterUnlocksFor([]));
    expect(problems.map((p) => p.code)).toContain('not_unlocked');
    expect(validateRoster(['stone_heart_golem'], rosterUnlocksFor(['ferrum']))).toEqual([]);
  });
});
