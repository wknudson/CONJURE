import { describe, expect, it } from 'vitest';
import {
  addUnit,
  atTile,
  damageTo,
  eventsOf,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { BULWARK_CARDS } from '../core/data/cards/bulwark.js';
import { DUSK_CARDS } from '../core/data/cards/dusk.js';
import { tierOf, TIER_COPY_LIMIT } from '../core/data/deckRules.js';
import { isObtainable } from '../core/data/collection.js';
import { hasLoS } from '../core/engine/los.js';
import { legalAttacks } from '../core/engine/targeting.js';
import { legalMoves, canAct } from '../core/engine/movement.js';
import { COLLISION_TARGET_DAMAGE } from '../core/engine/displacement.js';
import { TITHE_MARROW } from '../core/engine/effects.js';
import { isRosterEligible } from '../core/data/roster.js';

/**
 * Advanced grid cards.
 *
 * Four cards that each lean on a piece of the board rather than on a number: an arcing
 * lobber that ignores every sightline, a shove that turns walls into damage, a wall that
 * hits back, and a body whose whole purpose is to be spent.
 */

const NEW = ['clockwork_bombardier', 'seismic_slam', 'slag_iron_golem', 'ash_ghoul'];

describe('the set as data', () => {
  it('derives the tiers rather than declaring them', () => {
    expect(tierOf(CARDS.clockwork_bombardier!)).toBe(2);
    expect(tierOf(CARDS.seismic_slam!)).toBe(2);
    expect(tierOf(CARDS.slag_iron_golem!)).toBe(3);
    expect(tierOf(CARDS.ash_ghoul!)).toBe(1);
  });

  it('caps the heavy ones at a single copy', () => {
    // A four-Pip Guardian/Counter wall is Tier 3 by cost alone, and two of them would
    // make a narrow lane simply impassable.
    expect(TIER_COPY_LIMIT[tierOf(CARDS.slag_iron_golem!)]).toBe(1);
    expect(TIER_COPY_LIMIT[tierOf(CARDS.ash_ghoul!)]).toBe(3);
  });

  it('can all be reached, as cards or as roster kit', () => {
    for (const id of NEW) {
      const def = CARDS[id]!;
      // A body is reached through the Vanguard Roster now, not the collection, so
      // `isObtainable` is false for one by design. Roster eligibility is the equivalent
      // question, and it is the one that keeps new content from being unreachable.
      if (def.kind === 'minion') {
        expect(isRosterEligible(def), id).toBe(true);
        continue;
      }
      expect(isObtainable(def), id).toBe(true);
    }
  });

  it('claims reach only where the engine reads it', () => {
    // `castOriginCells` returns 'global' for any non-companion source, so a Hero card's
    // `range` is a rule written on the card that nothing applies.
    for (const id of NEW) {
      const def = CARDS[id]!;
      if (def.source === 'hero') expect(def.range, id).toBeUndefined();
      else expect(def.range, id).toBeGreaterThan(0);
    }
  });

  it('gives the arcing lobber a blind spot', () => {
    // An arcing profile with no minimum is just a better crossbow: it would shoot over
    // everything *and* defend itself. The price of the arc is that it cannot aim down.
    const stats = CARDS.clockwork_bombardier!.unit!;
    expect(stats.attackProfile).toBe('arcing');
    expect(stats.rangeMin).toBeGreaterThan(1);
    expect(stats.rangeMax).toBeGreaterThan(stats.rangeMin);
  });
});

describe('Clockwork Bombardier', () => {
  /** A wall between the lobber and its target, to prove the arc ignores it. */
  const besieged = () => {
    const state = scenario({ width: 6, height: 8 });
    const gun = addUnit(state, {
      def: 'clockwork_bombardier',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });
    // A Guardian directly in the line, which would stop any ordinary shot.
    addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 2, y: 4 } });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 120 });
    return { state, gun, foe };
  };

  it('lobs over a Guardian that would stop anything else', () => {
    const { state, gun, foe } = besieged();

    // The sightline really is blocked — this is not an empty board.
    expect(hasLoS(state, { x: 2, y: 5 }, { x: 2, y: 2 }, [gun.id, foe.id])).toBe(false);

    const shots = legalAttacks(state, state.units[gun.id]!);
    expect(shots.some((t) => t.kind === 'unit' && t.id === foe.id), 'the arc ignores it').toBe(true);
  });

  it('cannot depress its aim onto something adjacent', () => {
    const state = scenario({ width: 6, height: 8 });
    const gun = addUnit(state, {
      def: 'clockwork_bombardier',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });
    const close = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 4 }, hp: 90 });

    const shots = legalAttacks(state, state.units[gun.id]!);
    expect(shots.some((t) => t.kind === 'unit' && t.id === close.id)).toBe(false);
  });

  it('leaves whatever survives the shell Charged', () => {
    const { state, gun, foe } = besieged();

    const res = run(state, {
      type: 'attack',
      attacker: gun.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(damageTo(res.events, foe.id)).toBe(10);
    expect(res.state.units[foe.id]!.statuses.charged).toBe(1);
    expect(eventsOf(res.events, 'statusApplied').some((e) => e.status === 'charged')).toBe(true);
  });

  it('cannot charge and detonate in the same swing', () => {
    // The rider lands after the blow. If it landed first, one Bombardier would set up and
    // cash in its own Overload, and the card would stop being a setup piece.
    const { state, gun, foe } = besieged();
    const res = run(state, {
      type: 'attack',
      attacker: gun.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(eventsOf(res.events, 'reactionTriggered')).toEqual([]);
  });

  it('does not brand a corpse', () => {
    const state = scenario({ width: 6, height: 8 });
    const gun = addUnit(state, {
      def: 'clockwork_bombardier',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });
    const doomed = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 10 });

    const res = run(state, {
      type: 'attack',
      attacker: gun.id,
      target: { kind: 'unit', id: doomed.id },
    });

    expect(res.state.units[doomed.id], 'it died').toBeUndefined();
    expect(eventsOf(res.events, 'statusApplied').filter((e) => e.unitId === doomed.id)).toEqual([]);
  });

  it('sets up somebody else’s Overload, which is the whole point', () => {
    const { state, gun, foe } = besieged();
    const charged = run(state, {
      type: 'attack',
      attacker: gun.id,
      target: { kind: 'unit', id: foe.id },
    }).state;
    expect(charged.units[foe.id]!.statuses.charged).toBe(1);

    // Now a fire card into the charge.
    charged.players.player.pips = 8;
    charged.players.player.cards.torch = { instanceId: 'torch', defId: 'flame_surge' };
    charged.players.player.hand.push('torch');
    addUnit(charged, { def: 'ignis_bound', side: 'player', at: { x: 4, y: 3 }, titheBonus: 0 });

    const res = run(
      charged,
      play('torch', { kind: 'line', from: { x: 2, y: 2 }, dir: { x: 0, y: -1 } }),
    );

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('overload');
  });

  it('leaves an ordinary attacker unchanged', () => {
    // The hook is opt-in. A unit with no rider must not start applying statuses.
    const state = scenario({ width: 6, height: 8 });
    const plain = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 3 },
      fresh: false,
    });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 120 });

    const res = run(state, {
      type: 'attack',
      attacker: plain.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(res.state.units[foe.id]!.statuses.charged).toBeUndefined();
    expect(eventsOf(res.events, 'statusApplied')).toEqual([]);
  });
});

describe('Seismic Slam', () => {
  /** Four bodies ringing (2,3), one of them backed against the top wall. */
  const ringed = () => {
    const state = scenario({ width: 6, height: 8, hand: ['seismic_slam'], pips: 6 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const north = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 90 });
    const east = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 90 });
    const corner = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 90 });
    return { state, north, east, corner };
  };

  it('throws everything around the point directly away from it', () => {
    const { state, north, east, corner } = ringed();
    const card = handCard(state, 'player', 'seismic_slam');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.units[north.id]!.anchor.y, 'pushed further north').toBeLessThan(2);
    expect(res.state.units[east.id]!.anchor.x, 'pushed further east').toBeGreaterThan(3);
    // The diagonal is included: this is adjacent8, not the cross.
    const c = res.state.units[corner.id]!.anchor;
    expect(c.x > 3 || c.y < 2, 'the corner moved too').toBe(true);
  });

  it('deals no damage of its own', () => {
    // Everything it produces comes from what the bodies hit on the way out.
    const state = scenario({ width: 8, height: 8, hand: ['seismic_slam'], pips: 6 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 4, y: 5 }, titheBonus: 0 });
    const lone = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 3 }, hp: 90 });
    const card = handCard(state, 'player', 'seismic_slam');

    const res = run(state, play(card, atTile(4, 4)));

    expect(damageTo(res.events, lone.id), 'open ground: nothing to hit').toBe(0);
    expect(res.state.units[lone.id]!.anchor.y, 'but it still moved').toBeLessThan(3);
  });

  it('is indiscriminate — it moves your own bodies too', () => {
    // `adjacent8` is a shape, not an allegiance. Verified in a real fight: aimed beside
    // your own line it shoves your own line, collisions and all. That is the card's
    // restraint, and the reason it is aimed at a tile rather than at an enemy.
    const state = scenario({ width: 6, height: 8, hand: ['seismic_slam'], pips: 6 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 4, y: 5 }, titheBonus: 0 });
    const friend = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 2, y: 5 }, hp: 90 });
    const card = handCard(state, 'player', 'seismic_slam');

    const res = run(state, play(card, atTile(2, 4)));

    expect(res.state.units[friend.id]!.anchor.y, 'shoved away from the epicentre').toBeGreaterThan(5);
  });

  it('turns a wall into the damage', () => {
    // A unit already against the board edge has nowhere to go, so the shove becomes a
    // collision — which is the card's entire reason to exist.
    const state = scenario({ width: 6, height: 8, hand: ['seismic_slam'], pips: 6 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const pinned = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 0 }, hp: 90 });
    const card = handCard(state, 'player', 'seismic_slam');

    const res = run(state, play(card, atTile(2, 1)));

    expect(eventsOf(res.events, 'collision').length).toBeGreaterThan(0);
    expect(damageTo(res.events, pinned.id)).toBe(COLLISION_TARGET_DAMAGE);
  });
});

describe('Slag-Iron Golem', () => {
  it('goes down as an 8 HP body with both keywords', () => {
    const state = scenario({ width: 6, height: 8, hand: ['slag_iron_golem'], pips: 8 });
    const card = handCard(state, 'player', 'slag_iron_golem');

    const res = run(state, play(card, atTile(2, 6)));
    const summoned = eventsOf(res.events, 'unitSummoned')[0]!;

    expect(summoned.unit.hp).toBe(80);
    expect(summoned.unit.atk).toBe(30);
    expect(summoned.unit.keywords).toEqual(expect.arrayContaining(['Guardian', 'Counter']));
  });

  it('breaks a sightline', () => {
    const state = scenario({ width: 6, height: 8 });
    addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 2, y: 4 } });
    expect(hasLoS(state, { x: 2, y: 6 }, { x: 2, y: 2 }, [])).toBe(false);
    expect(hasLoS(state, { x: 1, y: 6 }, { x: 1, y: 2 }, [])).toBe(true);
  });

  it('strikes back for its full Attack, and survives to do it again', () => {
    const state = scenario({ width: 6, height: 8 });
    const golem = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 2, y: 4 } });
    const attacker = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 120,
      fresh: false,
    });
    // Drive the swing directly rather than hoping the AI throws itself at a Counter wall.
    state.activeSide = 'enemy';

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: golem.id },
    });

    // The Sentinel's 2 lands, then the Golem ripostes for its own 3.
    expect(res.state.units[golem.id]!.hp, '8 less the Sentinel 2').toBe(60);
    expect(res.state.units[attacker.id]!.hp, '12 less the riposte 3').toBe(90);
    const counters = eventsOf(res.events, 'damageDealt').filter((e) => e.cause === 'counter');
    expect(counters).toHaveLength(1);
    expect(counters[0]!.amount).toBe(30);
  });

  it('does not riposte a shot it cannot reach', () => {
    // Counter is a melee rule. A Bombardier shelling it from four tiles away takes
    // nothing back, which is exactly why the pairing works.
    const state = scenario({ width: 6, height: 8 });
    const golem = addUnit(state, { def: 'slag_iron_golem', side: 'player', at: { x: 2, y: 4 } });
    const gun = addUnit(state, {
      def: 'clockwork_bombardier',
      side: 'enemy',
      at: { x: 2, y: 1 },
      fresh: false,
    });
    state.activeSide = 'enemy';

    const res = run(state, {
      type: 'attack',
      attacker: gun.id,
      target: { kind: 'unit', id: golem.id },
    });

    expect(eventsOf(res.events, 'damageDealt').filter((e) => e.cause === 'counter')).toEqual([]);
    expect(res.state.units[gun.id]!.hp, 'untouched').toBe(40);
  });
});

describe('Ash-Ghoul', () => {
  const planted = (fresh: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    const ghoul = addUnit(state, {
      def: 'ash_ghoul',
      side: 'player',
      at: { x: 2, y: 6 },
      fresh: !fresh,
    });
    if (fresh) state.units[ghoul.id]!.summonedThisTurn = true;
    return { state, ghoul };
  };

  it('cannot move, ever', () => {
    const { state, ghoul } = planted(false);
    expect(state.units[ghoul.id]!.mov).toBe(0);
    expect(legalMoves(state, state.units[ghoul.id]!)).toEqual([]);
  });

  it('cannot be bled on the turn it lands', () => {
    // Dormant is the real price. `canAct` refuses anything summoned this turn without
    // Haste, and the tithe asks `canAct` — so one Pip buys the Marrow *next* turn, if the
    // thing is still standing.
    const { state, ghoul } = planted(true);
    expect(canAct(state.units[ghoul.id]!)).toBe(false);
    expect(() => run(state, { type: 'bloodTithe', unit: ghoul.id })).toThrow();
  });

  it('pays out once it has stood a turn', () => {
    const { state, ghoul } = planted(false);
    const before = state.players.player.marrow;

    const res = run(state, { type: 'bloodTithe', unit: ghoul.id });

    // The flat rate plus this body's premium. A Ghoul has 2 health and a tithe takes 3,
    // so it does not survive being bled — and is paid for anyway, which is the rule.
    expect(res.state.players.player.marrow).toBe(before + TITHE_MARROW + 1);
    expect(eventsOf(res.events, 'unitTithed')[0]!.marrow).toBe(TITHE_MARROW + 1);
    expect(res.state.units[ghoul.id], 'bled dry').toBeUndefined();
  });

  it('is worth the same as a Wisp, bought differently', () => {
    // The Wisp pays its premium for a Pip and can walk. This pays the same premium for a
    // Pip and cannot move or act for a turn — the same fuel, priced in tempo instead of
    // mobility.
    expect(CARDS.ash_ghoul!.unit!.titheBonus).toBe(CARDS.marrow_wisp!.unit!.titheBonus);
    expect(CARDS.ash_ghoul!.unit!.mov).toBe(0);
    expect(CARDS.marrow_wisp!.unit!.mov).toBeGreaterThan(0);
  });
});

describe('the summon path', () => {
  it('carries the on-hit rider and the attack profile onto the body the engine actually places', () => {
    // `scenario.addUnit` builds a unit by hand and had drifted from `spawn.ts` — it copied
    // `attackProfile` but not `onHit`, so these tests passed a unit the game would never
    // produce. Summoning through a played card is the only way to prove the real path.
    //
    // Two cards, because no single one carries both fields any anymore. The Bombardier's
    // `charged` rider was deleted when a Surge body's swing began carrying `shock`: the
    // engine already leaves a charge on any shock hit, so the rider had become a second
    // helping and branded its target twice. The Briar Wolf still has a rider worth copying.
    const state = scenario({
      width: 6,
      height: 8,
      hand: ['clockwork_bombardier', 'briar_wolf'],
      pips: 8,
    });

    const bombardier = handCard(state, 'player', 'clockwork_bombardier');
    const first = run(state, play(bombardier, atTile(2, 6)));
    const arcingId = eventsOf(first.events, 'unitSummoned')[0]!.unit.id;
    expect(first.state.units[arcingId]!.attackProfile).toBe('arcing');

    const wolf = handCard(first.state, 'player', 'briar_wolf');
    const second = run(first.state, play(wolf, atTile(3, 6)));
    const wolfId = eventsOf(second.events, 'unitSummoned')[0]!.unit.id;
    expect(second.state.units[wolfId]!.onHit).toEqual({ status: 'toxin', stacks: 1 });
  });

  it('leaves a body with no rider without one', () => {
    const state = scenario({ width: 6, height: 8, hand: ['scrap_phalanx'], pips: 8 });
    const card = handCard(state, 'player', 'scrap_phalanx');

    const res = run(state, play(card, atTile(2, 6)));
    const id = eventsOf(res.events, 'unitSummoned')[0]!.unit.id;

    expect(res.state.units[id]!.onHit).toBeUndefined();
  });
});

describe('the new school files', () => {
  it('registers everything they declare', () => {
    for (const id of [...Object.keys(BULWARK_CARDS), ...Object.keys(DUSK_CARDS)]) {
      expect(CARDS[id], id).toBeDefined();
    }
  });

  it('files each card under the school it says it is', () => {
    for (const def of Object.values(BULWARK_CARDS)) expect(def.school, def.name).toBe('bulwark');
    for (const def of Object.values(DUSK_CARDS)) expect(def.school, def.name).toBe('dusk');
  });
});
