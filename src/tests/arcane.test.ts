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
import { legalCardTargets } from '../core/engine/targeting.js';
import { hasLoS } from '../core/engine/los.js';
import { CARDS } from '../core/data/cards/index.js';
import { deckRoleRefusal, remainingCopies } from '../core/data/deckRules.js';
import { ARCANE_CARDS } from '../core/data/cards/arcane.js';
import { tierOf, TIER_COPY_LIMIT } from '../core/data/deckRules.js';
import { ARCANE_BASELINE, isObtainable, SOULBOUND, startingCollection } from '../core/data/collection.js';
import { COLLISION_TARGET_DAMAGE } from '../core/engine/displacement.js';
import { formatCost } from '../hud/cost.js';
import { isRosterEligible } from '../core/data/roster.js';

/**
 * The Arcane set.
 *
 * These began as the Hero's own cards, and the Hero has no position on the board — so the
 * thing worth testing hardest is that each one's reach is expressed as something the
 * board can actually check, rather than as a `range` the engine will silently ignore.
 *
 * The school has a Companion now (Lexis), so "arcane" and "the Hero's" have stopped being
 * the same statement. The reach rule below is therefore split by **source** rather than
 * asserted over the whole set: it was only ever a rule about Hero cards, and it held for
 * every arcane card by the accident of there being no arcane Companion to cast one.
 */

const ids = Object.keys(ARCANE_CARDS);

describe('the set as a whole', () => {
  it('is registered, and every card is arcane', () => {
    for (const id of ids) {
      const def = CARDS[id];
      expect(def, id).toBeDefined();
      expect(def!.school, id).toBe('arcane');
    }
  });

  it('keeps the Hero baseline the Hero\'s', () => {
    // The four cards that existed before the school had a Companion. Named individually
    // rather than derived, so a new Companion card cannot quietly reclassify one of them.
    for (const id of ['grapple_line', 'scrap_phalanx', 'cull_the_weak', 'alchemists_barricade']) {
      expect(CARDS[id]!.source, id).toBe('hero');
    }
  });

  it('lands on the intended tiers', () => {
    // Tier is derived from what a card costs and does, never authored — so these are an
    // assertion about the design brief matching the rule, not about a field being typed
    // in correctly. A re-cost that quietly changed a copy limit would fail here.
    expect(tierOf(CARDS.grapple_line!)).toBe(1);
    expect(tierOf(CARDS.scrap_phalanx!)).toBe(2);
    expect(tierOf(CARDS.cull_the_weak!)).toBe(1);
    expect(tierOf(CARDS.alchemists_barricade!)).toBe(2);
  });

  it('can actually be obtained — except the body, which is roster kit now', () => {
    // Neither setupOnly nor spliceOnly, so reward rolls and the Schematic shelf both
    // offer them. A new card that failed this would be unreachable content.
    for (const id of ids) {
      const def = CARDS[id]!;
      if (def.kind === 'minion') {
        // Minions left the collection with the overhaul: they are unlocked into a Vanguard
        // Roster, not owned as copies, so offering one on the shelf would sell something
        // no deck can hold.
        expect(isObtainable(def), id).toBe(false);
        expect(isRosterEligible(def), id).toBe(true);
        continue;
      }
      expect(isObtainable(def), id).toBe(true);
    }
  });

  it('states no reach a Hero card cannot enforce', () => {
    // `castOriginCells` returns 'global' for any non-companion source, so range,
    // minRange, vector and needsLoS are never read on a Hero card. Authoring one would
    // be a rule written in the card that the engine does not apply.
    for (const id of ids) {
      const def = CARDS[id]!;
      if (def.source !== 'hero') continue;
      expect(def.range, id).toBeUndefined();
      expect(def.minRange, id).toBeUndefined();
      expect(def.vector, id).toBeUndefined();
      expect(def.needsLoS, id).toBeUndefined();
    }
  });

  it('gives every Companion card a reach the board can check', () => {
    // The inverse, and the reason the split above is not just a loosening: a
    // companion-source card is cast from the Bound Form's cells, so a missing `range`
    // would mean an unbounded one. Whatever a Companion card declares, it must declare
    // something.
    for (const id of ids) {
      const def = CARDS[id]!;
      if (def.source !== 'companion') continue;
      expect(def.range, `${id} casts from a body but names no reach`).toBeGreaterThan(0);
    }
  });
});

describe('Grapple Line', () => {
  /** Three enemies in a column at y=1,2,3, with the player's line thrown from y=4. */
  const hooked = () => {
    const state = scenario({ width: 5, height: 6, hand: ['grapple_line'], bones: 5 });
    const near = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 90 });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 90 });
    return { state, near, far };
  };

  it('drags what it catches toward the near end of the line', () => {
    const { state, near, far } = hooked();
    const card = handCard(state, 'player', 'grapple_line');

    const res = run(state, play(card, alongLine({ x: 2, y: 4 }, { x: 0, y: -1 })));

    // Both are pulled *down* the board, toward y=4 where the hook was thrown from.
    expect(res.state.units[near.id]!.anchor.y).toBeGreaterThan(2);
    expect(res.state.units[far.id]!.anchor.y).toBeGreaterThan(1);
  });

  it('hurts everything on the line, not only the first thing it meets', () => {
    const { state, near, far } = hooked();
    const card = handCard(state, 'player', 'grapple_line');

    const res = run(state, play(card, alongLine({ x: 2, y: 4 }, { x: 0, y: -1 })));

    // Filtered to the card's own blow: the pull that follows lands collision damage on
    // the same units, and a bare total would conflate the hook with what it drags them
    // into. That conflation is the card working, not the card misfiring.
    const struck = (id: string): number =>
      eventsOf(res.events, 'damageDealt')
        .filter((e) => e.cause === 'spell' && e.target.kind === 'unit' && e.target.id === id)
        .reduce((sum, e) => sum + e.hpLoss, 0);

    expect(struck(near.id)).toBe(10);
    expect(struck(far.id)).toBe(10);
    // And the drag hurts more than the hook does, which is where the card's damage
    // actually comes from.
    expect(damageTo(res.events, far.id)).toBeGreaterThan(struck(far.id));
  });

  it('collides the ones that converge', () => {
    // The near enemy is dragged onto ground the far one is also heading for. Whoever
    // arrives first is what the other hits — which is the whole reason a pull is
    // interesting where a shove is not.
    const { state } = hooked();
    const card = handCard(state, 'player', 'grapple_line');

    const res = run(state, play(card, alongLine({ x: 2, y: 4 }, { x: 0, y: -1 })));

    const bumps = eventsOf(res.events, 'collision');
    expect(bumps.length).toBeGreaterThan(0);
    // A collision is worth more than the card's own point of damage, so the pull is the
    // payload and the 1 damage is the hook.
    expect(COLLISION_TARGET_DAMAGE).toBeGreaterThan(1);
  });

  it('is aimed as a line, because an entity-targeted pull would not move anything', () => {
    // `originOf` reads an entity target's own anchor, so the direction away from the
    // origin is {0,0} and `displaceArea` skips the unit. This card must never be
    // re-targeted at an entity without that being fixed first.
    expect(CARDS.grapple_line!.target.kind).toBe('line');
  });

  it('reaches as far as its area, and no further', () => {
    const def = CARDS.grapple_line!;
    const target = def.target as { kind: 'line'; length: number };
    const seq = def.effect as { op: 'seq'; effects: { area?: { shape: string; length?: number } }[] };
    // The chosen line and the damaged line have to be the same length, or the card either
    // hurts something it never caught or catches something it never hurts.
    for (const node of seq.effects) {
      expect(node.area?.length).toBe(target.length);
    }
  });
});

describe('Scrap Phalanx', () => {
  it('goes down as a 6 HP body that blocks sight', () => {
    const state = scenario({ width: 5, height: 6, hand: ['scrap_phalanx'], bones: 5 });
    const card = handCard(state, 'player', 'scrap_phalanx');

    const res = run(state, play(card, atTile(2, 4)));
    const summoned = eventsOf(res.events, 'unitSummoned')[0];

    expect(summoned).toBeDefined();
    expect(summoned!.unit.hp).toBe(60);
    expect(summoned!.unit.atk).toBe(10);
    expect(summoned!.unit.mov).toBe(1);
    expect(summoned!.unit.keywords).toContain('Guardian');
  });

  it('actually breaks a line, rather than merely claiming to', () => {
    // Guardian is only worth two Bones if the LoS resolver honours it. Sighting past the
    // wall must fail, and sighting to a clear tile beside it must still succeed.
    const state = scenario({ width: 5, height: 6 });
    addUnit(state, { def: 'scrap_phalanx', side: 'player', at: { x: 2, y: 3 } });

    expect(hasLoS(state, { x: 2, y: 5 }, { x: 2, y: 1 }, [])).toBe(false);
    expect(hasLoS(state, { x: 1, y: 5 }, { x: 1, y: 1 }, [])).toBe(true);
  });

  it('is a wall, not a Marrow battery', () => {
    // Every body now pays the same flat tithe, so the question is only whether this one
    // pays a premium on top. A cheap 6 HP body bleeding above the rate would be an engine.
    expect(CARDS.scrap_phalanx!.unit!.titheBonus ?? 0).toBe(0);
  });
});

describe('Cull the Weak', () => {
  const wounded = () => {
    const state = scenario({ width: 5, height: 6, hand: ['cull_the_weak'], bones: 5, marrow: 1 });
    const healthy = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 }, hp: 90 });
    const weak = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: 3, y: 1 },
      hp: 70,
      armor: 60,
    });
    return { state, healthy, weak };
  };

  it('finds the weakest enemy without being aimed', () => {
    const { state, healthy, weak } = wounded();
    const card = handCard(state, 'player', 'cull_the_weak');

    const res = run(state, play(card, { kind: 'global' }));

    expect(damageTo(res.events, weak.id)).toBe(40);
    expect(damageTo(res.events, healthy.id)).toBe(0);
  });

  it('goes through armor', () => {
    // The victim above carries 6 armor, which would eat the whole blow if this were not
    // `true` damage. That is the card's entire reason to cost Marrow.
    const { state, weak } = wounded();
    const card = handCard(state, 'player', 'cull_the_weak');

    const res = run(state, play(card, { kind: 'global' }));

    expect(res.state.units[weak.id]!.hp).toBe(30);
    // Untouched: true damage goes past plate rather than through it.
    expect(res.state.units[weak.id]!.armor).toBe(60);
  });

  it('cannot be paid for with Bones at any price', () => {
    // A full Bone bank and no Marrow. The strict component is the whole point of the card.
    const state = scenario({ width: 5, height: 6, hand: ['cull_the_weak'], bones: 8, marrow: 0 });
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 } });
    const card = handCard(state, 'player', 'cull_the_weak');

    expect(() => run(state, play(card, { kind: 'global' }))).toThrow();
  });

  it('refuses to be cast at an empty board rather than eating the Marrow', () => {
    // Marrow expires at end of turn and cannot be banked back, so a wasted cast here is
    // strictly worse than a wasted Bone. No foes means no legal target.
    const state = scenario({ width: 5, height: 6, hand: ['cull_the_weak'], marrow: 1 });
    expect(legalCardTargets(state, 'player', 'cull_the_weak')).toEqual([]);

    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 1, y: 1 } });
    expect(legalCardTargets(state, 'player', 'cull_the_weak')).toEqual([{ kind: 'global' }]);
  });

  it('leaves the older global guard alone', () => {
    // The new check must not have swallowed the detonate-with-nothing-to-detonate case.
    const state = scenario({ width: 5, height: 6, hand: ['cataclysmic_core'], bones: 8 });
    expect(legalCardTargets(state, 'player', 'cataclysmic_core')).toEqual([]);
  });
});

describe("Alchemist's Barricade", () => {
  it('raises an 8 HP construct on an empty tile', () => {
    const state = scenario({ width: 5, height: 6, hand: ['alchemists_barricade'], bones: 5 });
    const card = handCard(state, 'player', 'alchemists_barricade');

    const res = run(state, play(card, atTile(2, 3)));
    const raised = eventsOf(res.events, 'obstacleSpawned')[0];

    expect(raised).toBeDefined();
    expect(raised!.obstacle.hp).toBe(80);
    expect(raised!.obstacle.maxHp).toBe(80);
  });

  it('carries an obstacleHp of its own, or nothing would spawn at all', () => {
    // `spawnObstacle` refuses any def without one, and `spawnConstruct` calls straight
    // through it — so a construct card that omitted this would silently do nothing.
    expect(CARDS.alchemists_barricade!.obstacleHp).toBe(80);
  });

  it('breaks into rubble rather than into open ground', () => {
    const state = scenario({
      width: 5,
      height: 6,
      obstacles: [{ at: { x: 2, y: 3 }, hp: 80 }],
    });
    // Retag the planted obstacle as this card's, so the death path reads our def.
    const obstacle = Object.values(state.obstacles)[0]!;
    obstacle.defId = 'alchemists_barricade';

    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 4 },
      atk: 200,
    });
    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: obstacle.id },
    });

    expect(eventsOf(res.events, 'obstacleDestroyed').length).toBe(1);
    expect(res.state.hazards['2,3']?.kind).toBe('rubble');
    // Rubble is a change to the ground, not a cloud sitting on it.
    expect(res.state.hazards['2,3']?.permanent).toBe(true);
  });

  it('blocks line of sight while it stands', () => {
    const state = scenario({ width: 5, height: 6, obstacles: [{ at: { x: 2, y: 3 }, hp: 80 }] });
    expect(hasLoS(state, { x: 2, y: 5 }, { x: 2, y: 1 }, [])).toBe(false);
  });
});

describe('the cost badge', () => {
  it('drops the leading zero on a purely Marrow price', () => {
    // Cull the Weak is the first card in the game costing no Bones at all, so it is the
    // first to reach this branch. `0+1✦` reads as a rendering fault rather than a price.
    expect(formatCost(CARDS.cull_the_weak!.cost)).toBe('1✦');
  });

  it('still writes both halves when both are demanded', () => {
    expect(formatCost({ bones: 1, marrow: 2 })).toBe('1+2✦');
    expect(formatCost({ bones: 2, marrow: 0 })).toBe('2');
  });
});

describe('the baseline a new character opens with', () => {
  it('unlocks every arcane card outright', () => {
    // "In buildable numbers" was the copy model: the baseline used to seed two of each so
    // a deck could hold two. An unlock has no number — how many go in a deck is the Tier
    // limit's business — so the only question left is whether the player has it at all.
    const { unlocked } = startingCollection();
    for (const id of ARCANE_BASELINE) {
      expect(unlocked, id).toContain(id);
    }
  });

  it('leaves the Tier limit as the only thing capping copies', () => {
    // The check this replaced guarded against seeding *above* the Tier cap — a collection
    // the player could not legally spend. That cannot happen now: nothing seeds a count,
    // so one unlock is exactly the Tier's allowance and never more.
    //
    // "Only thing capping copies" is now true of the cards a deck can actually hold, and
    // the exception is the interesting half. The baseline includes Scrap Phalanx, which is
    // a **body** — the Vanguard's, never a deck's. It used to report two copies remaining
    // while `validateDeck` refused the deck built with them, which is the builder holding
    // one rule twice and disagreeing with itself.
    const collection = startingCollection();
    for (const id of ARCANE_BASELINE) {
      const def = CARDS[id]!;
      const limit = TIER_COPY_LIMIT[tierOf(def)];

      if (deckRoleRefusal(def)) {
        expect(remainingCopies([], id, collection), `${id} cannot be decked at all`).toBe(0);
        continue;
      }

      expect(remainingCopies([], id, collection), id).toBe(limit);
      expect(
        remainingCopies(Array.from({ length: limit }, () => id), id, collection),
        `${id} at its cap`,
      ).toBe(0);
    }

    // Named rather than left to the branch above, so the day Scrap Phalanx stops being a
    // body this test says so instead of quietly testing nothing.
    expect(deckRoleRefusal(CARDS.scrap_phalanx!)).toBe('minion');
  });

  it('leaves them losable', () => {
    // Seeded is not soulbound. Eight staples already guarantee a legal deck exists; these
    // are the player's to spend.
    for (const id of ARCANE_BASELINE) expect(SOULBOUND).not.toContain(id);
  });

  it('seeds only real arcane cards', () => {
    for (const id of ARCANE_BASELINE) {
      expect(ids, `${id} is seeded but is not in this set`).toContain(id);
    }
  });

  it('leaves nothing in the set unreachable', () => {
    // The property that actually matters. A card may be earned rather than granted — the
    // Cask is — but every one of them has to be gettable *somehow*, or it is data
    // pretending to be content.
    for (const id of ids) {
      const seeded = (ARCANE_BASELINE as readonly string[]).includes(id);
      expect(seeded || isObtainable(CARDS[id]!), `${id} is neither seeded nor obtainable`).toBe(
        true,
      );
    }
  });
});
