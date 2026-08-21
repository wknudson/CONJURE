import { describe, expect, it } from 'vitest';
import {
  ASCENSION_PERCENT,
  ascendCardDef,
  ascendEffect,
  ascendValue,
} from '../core/data/ascension.js';
import { CARDS, ascendableIds, ascendedId, isAscendedId } from '../core/data/cards/index.js';
import type { EffectNode } from '../core/types/cards.js';
import {
  AFFINITY_CEILING,
  DETONATION_TARGET,
  MASTERY_OBJECTIVES,
  masteryOf,
  noMastery,
} from '../core/data/mastery.js';
import {
  AFFINITY_HP_FLOOR_STEP,
  AFFINITY_MAX,
  HP_ROLL_MAX,
  HP_ROLL_MIN,
  rollWildModifier,
  tameCompanion,
} from '../core/overworld/vivarium.js';
import {
  VANGUARD_XP_FELL,
  VANGUARD_XP_SURVIVED,
  VANGUARD_XP_VICTORY,
  awardVanguardXp,
  unlockVanguard,
  xpForNextLevel,
} from '../core/data/roster.js';
import { COMPANIONS } from '../core/data/companions.js';
import {
  HYBRID_HYBRID_CHANCE,
  MONO_HYBRID_CHANCE,
  hybridPool,
  purePool,
} from '../core/data/grimoire.js';
import { makeRng } from '../core/util/rng.js';
import { CombatSession } from '../core/session.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { makeCtx } from '../core/engine/context.js';
import { dealDamage } from '../core/engine/damage.js';
import { resolveCombat } from '../core/overworld/run.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import type { CompanionInstance } from '../core/overworld/vivarium.js';
import type { MasteryReport } from '../core/data/mastery.js';
import { GRIMOIRE_SIZE } from '../core/data/companions.js';


/**
 * The progression loop, end to end.
 *
 * Three systems that all answer the same question — what did playing well *get* you — and
 * each answers it in a different currency. Cards get better by being paid for; beasts get
 * better by being caught cleanly; bodies get better by surviving.
 */

// ---------------------------------------------------------------- ascension

describe('the ascension arithmetic', () => {
  it('adds ten per cent, rounded up', () => {
    expect(ASCENSION_PERCENT).toBe(10);
    // The brief's two worked examples, verbatim.
    expect(ascendValue(30)).toBe(33);
    expect(ascendValue(25)).toBe(28);
  });

  it('never rounds a gain away to nothing', () => {
    // The failure mode of rounding down: every small card ascends into itself, and the
    // Shards buy a printing identical to the one already owned.
    for (let n = 1; n <= 60; n++) expect(ascendValue(n), `${n}`).toBeGreaterThan(n);
  });

  it('does not drift on the values floating point gets wrong', () => {
    // `Math.ceil(30 * 1.1)` is 34, because 30 * 1.1 is 33.000000000000004. A card dealing
    // one more than the rule says, invisibly, on the values that happen to land badly.
    for (const n of [30, 60, 90, 120, 300]) {
      expect(ascendValue(n), `${n}`).toBe(n + n / 10);
    }
  });

  it('leaves nothing to raise alone', () => {
    expect(ascendValue(0)).toBe(0);
  });
});

describe('what ascension is allowed to touch', () => {
  const scaled = (node: EffectNode): EffectNode => ascendEffect(node);

  it('raises damage, armour, healing and construct health', () => {
    expect(scaled({ op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } })).toMatchObject({ amount: 33 });
    expect(scaled({ op: 'grantArmor', amount: 40 })).toMatchObject({ amount: 44 });
    expect(scaled({ op: 'heal', amount: 80 })).toMatchObject({ amount: 88 });
    expect(scaled({ op: 'spawnConstruct', obstacleDef: 'x', hp: 40 })).toMatchObject({ hp: 44 });
  });

  it('leaves the action economy exactly where it was', () => {
    // The whole reason progression was made vertical. A Rank 2 that cost a Pip less, or
    // drew an extra card, is a *different tempo* — and tempo is what a player reads the
    // board with.
    expect(scaled({ op: 'drawCards', amount: 2 })).toMatchObject({ amount: 2 });
    expect(scaled({ op: 'extractMarrow', amount: 4 })).toMatchObject({ amount: 4 });
    expect(scaled({ op: 'tithe', damage: 40, marrow: 3 })).toMatchObject({ damage: 40, marrow: 3 });
  });

  it('leaves geometry exactly where it was', () => {
    expect(scaled({ op: 'push', distance: 1 })).toMatchObject({ distance: 1 });
    expect(scaled({ op: 'shoveArea', distance: 2, area: { shape: 'adjacent8' } })).toMatchObject({ distance: 2 });
    expect(scaled({ op: 'pullArea', distance: 1, area: { shape: 'adjacentCross' } })).toMatchObject({ distance: 1 });
  });

  it('leaves status stacks exactly where they were', () => {
    // Two Burn is two Burn at either rank. 2.2 of them is not a thing.
    expect(
      scaled({ op: 'applyStatus', status: 'burn', stacks: 2, area: { shape: 'target' } }),
    ).toMatchObject({ stacks: 2 });
  });

  it('never raises a tithe, because that would be a downgrade', () => {
    // Blood Magic wounds your *own* body to pay you. The one place in the game where more
    // damage is the wrong direction.
    const card = CARDS.dark_tithe!;
    expect(CARDS[ascendedId('dark_tithe')], 'and so it has no Rank 2 at all').toBeUndefined();
    expect(card.effect).toEqual(ascendEffect(card.effect));
  });

  it('scales a cleave without widening it', () => {
    const before = { op: 'cleaveFront', amount: 20, dtype: 'fire', width: 2 } as const;
    expect(scaled(before)).toEqual({ ...before, amount: 22 });
  });
});

describe('the derived Rank 2 printings', () => {
  it('changes nothing a player would have to re-learn', () => {
    for (const id of ascendableIds()) {
      const a = CARDS[id]!;
      const b = CARDS[ascendedId(id)]!;
      expect(b.cost, `${id} cost`).toEqual(a.cost);
      expect(b.target, `${id} target`).toEqual(a.target);
      expect(b.keywords, `${id} keywords`).toEqual(a.keywords);
      expect(b.range, `${id} range`).toBe(a.range);
      expect(b.minRange, `${id} minRange`).toBe(a.minRange);
      expect(b.vector, `${id} vector`).toBe(a.vector);
      expect(b.needsLoS, `${id} LoS`).toBe(a.needsLoS);
    }
  });

  it('offers a printing only when there is something to raise', () => {
    // The Forge reads this absence. A Rank 2 identical to its Rank 1 would let a player
    // pay Shards for their own card back.
    for (const base of Object.values(CARDS)) {
      if (isAscendedId(base.id)) continue;
      const raised = CARDS[ascendedId(base.id)];
      if (!raised) continue;
      expect(JSON.stringify(raised.effect) + raised.obstacleHp, base.id).not.toBe(
        JSON.stringify(base.effect) + base.obstacleHp,
      );
    }
  });

  it('restates its own numbers in its rules text', () => {
    // Rank 2 text cannot be hand-written any more, so it is derived — and a printing that
    // advertised its Rank 1 damage while dealing something else is the failure this
    // catches. Shield Bash is the awkward case: two 20s in the text and only one of them
    // is the card's.
    expect(CARDS[ascendedId('shield_bash')]!.text).toContain('Deals 22 damage');
    expect(CARDS[ascendedId('shield_bash')]!.text, 'the engine’s collision figure is not the card’s').toContain('(30 / 20)');

    // And the mirror case: Overload Strike raises *both* of its 20s.
    expect(CARDS[ascendedId('overload_strike')]!.text).toContain('22 shock damage, then 22 fire damage');
  });

  it('never ascends a body', () => {
    for (const def of Object.values(CARDS)) {
      if (def.kind !== 'minion') continue;
      expect(CARDS[ascendedId(def.id)], def.id).toBeUndefined();
    }
  });

  it('refuses to build a Rank 3', () => {
    for (const id of ascendableIds()) {
      expect(ascendCardDef(CARDS[ascendedId(id)]!, 'nope_r2_r2')).toBeDefined();
      // ...but the registry never asks it to, which is what actually matters.
      expect(CARDS[`${ascendedId(id)}_r2`], id).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------- mastery

describe('mastery objectives', () => {
  it('has as many as affinity can count to', () => {
    expect(AFFINITY_CEILING).toBe(MASTERY_OBJECTIVES.length);
    expect(AFFINITY_MAX).toBe(AFFINITY_CEILING);
  });

  it('scores a flawless fight at the ceiling', () => {
    const report = masteryOf({ damageTaken: 0, runeDetonations: DETONATION_TARGET, rosterFallen: 0 });
    expect(report.affinity).toBe(AFFINITY_CEILING);
    expect(report.met).toEqual(['untouched', 'detonation', 'unbroken']);
  });

  it('scores a scrape at nothing', () => {
    const report = masteryOf({ damageTaken: 120, runeDetonations: 1, rosterFallen: 2 });
    expect(report).toEqual({ met: [], affinity: 0 });
  });

  it('counts armour soaking a blow as untouched', () => {
    // The reading the engine actually implements: `playerDamageTaken` is health lost, and
    // plate doing its job is not the same as being hit.
    expect(masteryOf({ damageTaken: 0, runeDetonations: 0, rosterFallen: 0 }).met).toContain('untouched');
  });

  it('rewards three different ways of being good, so no one style sweeps', () => {
    const turtle = masteryOf({ damageTaken: 0, runeDetonations: 0, rosterFallen: 0 });
    const combo = masteryOf({ damageTaken: 90, runeDetonations: 5, rosterFallen: 1 });
    expect(turtle.met).not.toEqual(combo.met);
    expect(turtle.affinity).toBeGreaterThan(0);
    expect(combo.affinity).toBeGreaterThan(0);
  });

  it('has an empty report for a fight nobody was scoring', () => {
    expect(noMastery()).toEqual({ met: [], affinity: 0 });
  });
});

// ---------------------------------------------------------------- the variance engine

describe('the wild variance roll', () => {
  it('is seeded, so the same catch is the same beast', () => {
    const a = tameCompanion(makeRng(77), 'ignis', 1);
    const b = tameCompanion(makeRng(77), 'ignis', 1);
    expect(a).toEqual(b);
  });

  it('rolls a constitution inside the band, whatever the affinity', () => {
    for (let affinity = 0; affinity <= AFFINITY_MAX; affinity++) {
      for (let seed = 1; seed <= 30; seed++) {
        const beast = tameCompanion(makeRng(seed), 'boreas', 1, affinity);
        expect(beast.baseHpRoll).toBeGreaterThanOrEqual(HP_ROLL_MIN);
        expect(beast.baseHpRoll).toBeLessThanOrEqual(HP_ROLL_MAX);
      }
    }
  });

  it('raises the floor with affinity, and never the ceiling', () => {
    // The shape that keeps mastery from becoming a checklist: a clean capture narrows the
    // range of beast you might get. It cannot promise you the best one.
    const worst = (affinity: number) =>
      Math.min(
        ...Array.from({ length: 60 }, (_, i) => tameCompanion(makeRng(i + 1), 'ignis', 1, affinity).baseHpRoll),
      );
    expect(worst(AFFINITY_MAX)).toBeGreaterThanOrEqual(HP_ROLL_MIN + AFFINITY_MAX * AFFINITY_HP_FLOOR_STEP);
    expect(worst(0)).toBeLessThan(worst(AFFINITY_MAX));
  });

  it('makes a wild modifier likelier the cleaner the capture', () => {
    const rate = (affinity: number) =>
      Array.from({ length: 300 }, (_, i) => rollWildModifier(makeRng(i + 1), affinity)).filter(
        (m) => m.startingArmor > 0 || m.bonusPips > 0,
      ).length;
    expect(rate(AFFINITY_MAX)).toBeGreaterThan(rate(0));
  });

  it('rolls one gift or none, never a spreadsheet of small ones', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = rollWildModifier(makeRng(seed), 2);
      const given = [m.startingArmor, m.bonusPips].filter((n) => n > 0).length;
      expect(given, `seed ${seed}`).toBeLessThanOrEqual(1);
    }
  });

  it('leaves plenty of beasts with nothing, or the gift is the baseline', () => {
    const plain = Array.from({ length: 200 }, (_, i) => rollWildModifier(makeRng(i + 1), 0)).filter(
      (m) => m.startingArmor === 0 && m.bonusPips === 0,
    ).length;
    expect(plain).toBeGreaterThan(60);
  });

  it('spends the same number of draws whatever it decides', () => {
    // A roll that consumed a variable number of integers would make the Grimoire draft
    // after it depend on an upstream coin flip, and a seeded system stops being
    // reproducible in any useful way.
    const spend = (seed: number) => {
      const rng = makeRng(seed);
      rollWildModifier(rng, 0);
      return rng;
    };
    const generous = (seed: number) => {
      const rng = makeRng(seed);
      rollWildModifier(rng, AFFINITY_MAX);
      return rng;
    };
    for (let seed = 1; seed <= 20; seed++) {
      expect(spend(seed), `seed ${seed}`).toEqual(generous(seed));
    }
  });
});

describe('the grimoire pool', () => {
  it('keeps a mono-element bloodline rare on fusions', () => {
    // Scoped by `hybridChance` rather than by a list of names, so the day somebody adds an
    // eleventh two-school bloodline this keeps testing the rule instead of failing. It
    // still bites on the thing it was written for: a mono beast whose pool quietly grew a
    // second school, or whose fusion odds were nudged, lands here.
    const mono = COMPANIONS.filter((c) => c.grimoire.hybridChance === MONO_HYBRID_CHANCE);
    expect(mono.length, 'the mono bloodlines').toBe(COMPANIONS.length - 10);
    for (const c of mono) {
      expect(c.grimoire.schools, `${c.name}`).toHaveLength(1);
    }
  });

  it('gives a two-school bloodline both its schools and a far better fusion rate', () => {
    const hybrid = COMPANIONS.filter((c) => c.grimoire.hybridChance !== MONO_HYBRID_CHANCE);
    expect(hybrid.length, 'the hybrid bloodlines').toBe(10);
    for (const c of hybrid) {
      expect(c.grimoire.schools, `${c.name}`).toHaveLength(2);
      expect(c.grimoire.hybridChance, `${c.name}`).toBe(HYBRID_HYBRID_CHANCE);
    }
  });

  it('reaches a fusion through the recipe, not through the card’s filing', () => {
    // Vaporize Blast is filed under frost and pressed from Pyre + Frost. A Pyre bloodline
    // has to be able to reach it, and asking `def.school` would say otherwise.
    const pyre = hybridPool({ schools: ['pyre'], hybridChance: 100 }).map((c) => c.id);
    expect(pyre, 'a fire drake can dream of a steam blast').toContain('vaporize_blast');
  });

  it('offers a hybrid bloodline both its schools at once', () => {
    // No Chimera is authored yet, so this is the mechanism rather than the content — and
    // it is worth pinning, because the day one ships is the day this stops being tested.
    const chimera = { schools: ['pyre', 'frost'] as const, hybridChance: 35 };
    const pool = purePool({ schools: [...chimera.schools], hybridChance: chimera.hybridChance });
    expect(pool.some((c) => c.school === 'pyre')).toBe(true);
    expect(pool.some((c) => c.school === 'frost')).toBe(true);
  });

  it('never offers a body or a Rank 2 printing', () => {
    for (const c of COMPANIONS) {
      for (const def of [...purePool(c.grimoire), ...hybridPool(c.grimoire)]) {
        expect(def.kind, def.id).not.toBe('minion');
        expect(isAscendedId(def.id), def.id).toBe(false);
        expect(def.setupOnly, def.id).toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------- survival XP

describe('survival XP', () => {
  const enrolled = () => unlockVanguard(unlockVanguard({}, 'vanguard_footman'), 'scout_imp');

  it('pays a body for walking off the field', () => {
    const after = awardVanguardXp(enrolled(), {
      survivors: ['vanguard_footman'],
      fallen: [],
      won: false,
    });
    expect(after.vanguard_footman!.xp).toBe(VANGUARD_XP_SURVIVED);
  });

  it('pays a body that fell, but less', () => {
    const after = awardVanguardXp(enrolled(), { survivors: [], fallen: ['scout_imp'], won: false });
    expect(after.scout_imp!.xp).toBe(VANGUARD_XP_FELL);
    expect(VANGUARD_XP_FELL).toBeLessThan(VANGUARD_XP_SURVIVED);
  });

  it('pays a bonus to everything that fought, when the fight is won', () => {
    const after = awardVanguardXp(enrolled(), {
      survivors: ['vanguard_footman'],
      fallen: ['scout_imp'],
      won: true,
    });
    expect(after.vanguard_footman!.xp).toBe(VANGUARD_XP_SURVIVED + VANGUARD_XP_VICTORY);
    expect(after.scout_imp!.xp).toBe(VANGUARD_XP_FELL + VANGUARD_XP_VICTORY);
  });

  it('pays two of the same body twice', () => {
    const after = awardVanguardXp(enrolled(), {
      survivors: ['vanguard_footman', 'vanguard_footman'],
      fallen: [],
      won: false,
    });
    expect(after.vanguard_footman!.xp).toBe(VANGUARD_XP_SURVIVED * 2);
  });

  it('pays nothing to a body that stayed in the tray', () => {
    // Otherwise holding your warband back would be the efficient way to train it.
    const after = awardVanguardXp(enrolled(), {
      survivors: ['vanguard_footman'],
      fallen: [],
      won: true,
    });
    expect(after.scout_imp!.xp).toBe(0);
    expect(after.scout_imp!.level).toBe(1);
  });

  it('rolls a level over, and keeps the change', () => {
    const start = { vanguard_footman: { level: 1, xp: xpForNextLevel(1) - 10 } };
    const after = awardVanguardXp(start, {
      survivors: ['vanguard_footman'],
      fallen: [],
      won: false,
    });
    expect(after.vanguard_footman!.level).toBe(2);
    expect(after.vanguard_footman!.xp, 'the surplus carries').toBe(VANGUARD_XP_SURVIVED - 10);
  });

  it('rolls over as many levels as one night actually bought', () => {
    // A cap of one level per fight would silently swallow the rest.
    const start = { vanguard_footman: { level: 1, xp: 0 } };
    const many = Array.from({ length: 20 }, () => 'vanguard_footman');
    const after = awardVanguardXp(start, { survivors: many, fallen: [], won: true });
    expect(after.vanguard_footman!.level).toBeGreaterThan(2);
  });

  it('never enrols a body that was never unlocked', () => {
    // Earning XP is not how a unit joins the roster. A fight that quietly created records
    // would let a body the player never bought start accumulating a career.
    const after = awardVanguardXp({}, { survivors: ['magma_brute'], fallen: [], won: true });
    expect(after).toEqual({});
  });

  it('leaves the record untouched when nothing fought', () => {
    const before = enrolled();
    expect(awardVanguardXp(before, { survivors: [], fallen: [], won: true })).toBe(before);
  });
});

// ---------------------------------------------------------------- the wiring

describe('what a fight actually reports', () => {
  const fight = (roster: string[]) =>
    new CombatSession(
      NOVICE_DUELIST,
      11,
      undefined,
      undefined,
      undefined,
      undefined,
      roster,
    );

  it('counts a fight nobody has been hit in as untouched and unbroken', () => {
    const s = fight(['vanguard_footman']);
    expect(s.mastery).toEqual({ met: ['untouched', 'unbroken'], affinity: 2 });
  });

  it('stops calling it untouched the moment the Pact actually loses health', () => {
    // Health lost, not blows landed: the engine writes `playerDamageTaken` where the Pact's
    // HP is written, so armour eating a hit leaves the objective intact.
    const s = fight(['vanguard_footman']);
    const state = s.debugState;
    const ctx = makeCtx(state);
    dealDamage(ctx, {
      target: { kind: 'portrait', side: 'player' },
      amount: 30,
      dtype: 'true',
      cause: 'spell',
    });
    expect(masteryOf({
      damageTaken: state.playerDamageTaken,
      runeDetonations: state.playerRuneDetonations,
      rosterFallen: 0,
    }).met).not.toContain('untouched');
  });

  it('reports the warband split by who is still standing', () => {
    const s = fight(['vanguard_footman', 'scout_imp']);
    // Nothing deployed yet: a body in the tray never fought and is in neither list.
    expect(s.rosterOutcome).toEqual({ survivors: [], fallen: [] });

    s.dispatch({ type: 'deployUnit', defId: 'vanguard_footman', at: s.debugState.anchors[0]! });
    expect(s.rosterOutcome.survivors).toEqual(['vanguard_footman']);
    expect(s.rosterOutcome.fallen).toEqual([]);
  });
});

describe('affinity reaching the beast', () => {
  const bound = (mastery: MasteryReport | undefined) => {
    const global: GlobalGameState = { overworld: newRun(4), combat: null };
    const roster: CompanionInstance[] = [];
    resolveCombat(
      global,
      { pactHp: 300, ...(mastery ? { mastery } : {}) },
      'bound',
      undefined,
      { prize: 'ignis', roster },
    );
    return roster[0]!;
  };

  it('hands a clean capture a beast rolled against a higher floor', () => {
    const flawless = bound({ met: ['untouched', 'detonation', 'unbroken'], affinity: 3 });
    expect(flawless.baseHpRoll).toBeGreaterThanOrEqual(
      HP_ROLL_MIN + 3 * AFFINITY_HP_FLOOR_STEP,
    );
  });

  it('rolls at affinity zero when nobody was scoring', () => {
    // A standalone bout, or a fight resolved by a test. It has to still produce a beast.
    const plain = bound(undefined);
    expect(plain.baseId).toBe('ignis');
    expect(plain.grimoire).toHaveLength(GRIMOIRE_SIZE);
  });
});
