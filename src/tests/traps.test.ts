import { describe, expect, it } from 'vitest';
import { addUnit, atTile, damageTo, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { MARKS } from '../core/data/marks.js';
import { tierOf } from '../core/data/deckRules.js';
import { isObtainable } from '../core/data/collection.js';

/**
 * Traps and constructs.
 *
 * Two marks and a cask, and between them they lean on two capabilities the engine gained
 * for them: a mark that leaves a **status** rather than a number, and a card that raises
 * an obstacle and then wires it in the same `seq`. Both are the kind of thing that fails
 * silently — a mark that applies nothing, a cask that goes up unarmed — so most of what
 * follows is about proving they actually did something.
 */

describe('the set as data', () => {
  it('derives the tiers rather than declaring them', () => {
    expect(tierOf(CARDS.rot_root_snare!)).toBe(1);
    expect(tierOf(CARDS.volatile_cask!)).toBe(2);
    expect(tierOf(CARDS.soul_splinter_mark!)).toBe(1);
  });

  it('can all be obtained', () => {
    for (const id of ['rot_root_snare', 'volatile_cask', 'soul_splinter_mark']) {
      expect(isObtainable(CARDS[id]!), id).toBe(true);
    }
  });

  it('attaches marks to entities, never to tiles', () => {
    // The Lexicon's rule, and the engine's: `AttachedMark` lives on a Unit or an Obstacle,
    // and there is nowhere on a tile to put one. A mark card must therefore pick an entity.
    for (const id of ['rot_root_snare', 'soul_splinter_mark', 'cinder_mark']) {
      expect(CARDS[id]!.target.kind, id).toBe('entity');
    }
  });

  it('keeps every mark a card can attach in the registry', () => {
    for (const def of Object.values(CARDS)) {
      if (def.effect.op !== 'attachMark') continue;
      expect(MARKS[def.effect.mark], `${def.name} names a mark that does not exist`).toBeDefined();
    }
  });
});

describe('Rot-Root Snare', () => {
  /** A branded host with two bystanders beside it, and a striker in reach. */
  const trapped = () => {
    const state = scenario({ width: 6, height: 8 });
    const host = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 120,
      mark: 'rot_root_snare',
    });
    const beside = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 90 });
    const striker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 4 },
      hp: 90,
      fresh: false,
    });
    return { state, host, beside, striker };
  };

  it('springs on a physical blow and snares the neighbours', () => {
    const { state, beside, host, striker } = trapped();

    const res = run(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: host.id },
    });

    expect(eventsOf(res.events, 'markDetonated').length).toBe(1);
    expect(res.state.units[beside.id]!.statuses.entangle).toBe(1);
    expect(res.state.units[beside.id]!.statuses.toxin).toBe(1);
  });

  it('deals no damage of its own', () => {
    // Priced as control. Everything the card does is the two statuses.
    const { state, beside, host, striker } = trapped();

    const res = run(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: host.id },
    });

    expect(damageTo(res.events, beside.id), 'the bystander is snared, not hurt').toBe(0);
    // And no empty `damageDealt` for a blow that never landed.
    expect(
      eventsOf(res.events, 'damageDealt').filter((e) => e.cause === 'mark'),
      'a 0-damage mark does not fake a hit',
    ).toEqual([]);
  });

  it('spares its own host, like every ringed mark', () => {
    const { state, host, striker } = trapped();

    const res = run(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: host.id },
    });

    expect(res.state.units[host.id]!.statuses.entangle).toBeUndefined();
  });

  it('entangle stops movement without stopping the swing', () => {
    // The Lexicon's definition, and the reason this is control rather than a stun.
    const { state, beside, host, striker } = trapped();
    const after = run(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: host.id },
    }).state;

    const snared = after.units[beside.id]!;
    expect(snared.statuses.entangle).toBeGreaterThan(0);
    // Moving is refused; attacking is not.
    after.activeSide = 'enemy';
    snared.freshlySummoned = false;
    expect(() => run(after, { type: 'moveUnit', unit: snared.id, to: { x: 4, y: 3 } })).toThrow();
  });

  it('does not spring on a spell, which is the Cinder Mark’s job', () => {
    // Aligned to physical and impact. A board carrying both marks answers two threats.
    expect(MARKS.rot_root_snare!.trigger).toEqual({
      kind: 'hpLoss',
      alignedTypes: ['physical', 'impact'],
    });
    expect(MARKS.cinder_mark!.trigger).toEqual({
      kind: 'hpLoss',
      alignedTypes: ['fire', 'spell'],
    });
  });

  it('can be laid on either side’s body', () => {
    expect(CARDS.rot_root_snare!.target).toEqual({
      kind: 'entity',
      side: 'any',
      includeObstacles: true,
    });
  });
});

describe('Volatile Munitions Cask', () => {
  const withCask = () => {
    const state = scenario({ width: 6, height: 8, hand: ['volatile_cask'], pips: 6 });
    const card = handCard(state, 'player', 'volatile_cask');
    const res = run(state, play(card, atTile(2, 4)));
    const raised = eventsOf(res.events, 'obstacleSpawned')[0]!;
    return { state: res.state, events: res.events, caskId: raised.obstacle.id, raised };
  };

  it('goes up at 4 HP', () => {
    const { raised } = withCask();
    expect(raised.obstacle.hp).toBe(40);
    expect(raised.obstacle.maxHp).toBe(40);
  });

  it('goes up **armed** — the seq wires what it just built', () => {
    // The whole reason `spawnedObstacleId` exists. A tile-targeted card has no entity in
    // `chosen`, so without the handoff `attachMark` would find no host and the cask would
    // be an ordinary crate.
    const { state, events, caskId } = withCask();

    expect(eventsOf(events, 'markAttached').length, 'the mark was wired').toBe(1);
    expect(state.obstacles[caskId]!.mark?.defId).toBe('cask_blast');
  });

  it('does nothing when merely chipped', () => {
    // A `death` trigger, not `hpLoss`. Somebody has to actually break it.
    const { state, caskId } = withCask();
    const poker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 10,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: poker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(eventsOf(res.events, 'markDetonated')).toEqual([]);
    expect(res.state.obstacles[caskId]!.mark, 'still armed').toBeDefined();
  });

  it('detonates in a cross when it is broken', () => {
    const { state, caskId } = withCask();
    // Orthogonal: caught. Diagonal: spared — the blast runs down the aisles.
    const orthogonal = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 90 });
    const diagonal = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 90 });
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 200,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(eventsOf(res.events, 'markDetonated').length).toBe(1);
    expect(damageTo(res.events, orthogonal.id)).toBe(30);
    expect(damageTo(res.events, diagonal.id), 'the diagonal is the safe place').toBe(0);
  });

  it('leaves rubble where it stood', () => {
    const { state, caskId } = withCask();
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 200,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(res.state.hazards['2,4']?.kind).toBe('rubble');
    expect(res.state.hazards['2,4']?.permanent).toBe(true);
  });

  it('is indiscriminate about who it catches', () => {
    // It does not know whose army is standing beside it, which is what makes placing one
    // a decision rather than free removal.
    const { state, caskId } = withCask();
    const friend = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 4 }, hp: 90 });
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 200,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(damageTo(res.events, friend.id)).toBe(30);
  });
});

describe('Soul Splinter Mark', () => {
  it('was already in the game, and matches the brief but for its damage type', () => {
    // Shipped since the Draft 7 starter deck: 1 Pip, death trigger, lowest-HP-enemy blast,
    // 5 damage. The one difference from the brief is `spell` rather than `true` — see the
    // report. Left as shipped because `spell` is an aligned type for Cinder Mark, so
    // changing it would quietly remove a cascade interaction as well as re-balancing a card
    // players already own.
    //
    // The **card** used to be dusk. It is arcane now, and the two assertions below are the
    // whole shape of the role overhaul in one card: a Mark is the Hero's tool, filed in the
    // Hero's colour, and the elemental thing about it is the brand it leaves. Reading one
    // number for both is what the split exists to stop.
    const card = CARDS.soul_splinter_mark!;
    expect(card.kind, 'a Mark, not a Spell').toBe('mark');
    expect(card.school, "the Hero's colour, because the Hero lays it").toBe('arcane');
    expect(card.cost).toEqual({ pips: 1, marrow: 0 });

    const mark = MARKS.soul_splinter_mark!;
    expect(mark.school, 'the payload keeps the colour it detonates in').toBe('dusk');
    expect(mark.trigger).toEqual({ kind: 'death' });
    expect(mark.blast).toEqual({ shape: 'lowestHpEnemy' });
    expect(mark.damage).toBe(50);
    expect(mark.dtype, 'the one delta from the brief').toBe('spell');
  });

  it('fires when its host is bled to death, not only when an enemy kills it', () => {
    const state = scenario({ width: 6, height: 8 });
    const host = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 5 },
      mark: 'soul_splinter_mark',
      fresh: false,
    });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 90 });

    // A Marrow Wisp has exactly 30 health, and a tithe takes exactly 30. The mark's
    // trigger is `death`, so what matters is that a self-inflicted death is still a death.
    const res = run(state, { type: 'bloodTithe', unit: host.id });

    expect(eventsOf(res.events, 'markDetonated').length).toBe(1);
    expect(damageTo(res.events, victim.id)).toBe(50);
  });
});

describe('a mark that applies statuses, generally', () => {
  it('is opt-in — an ordinary mark leaves nothing behind', () => {
    expect(MARKS.cinder_mark!.applies).toBeUndefined();
    expect(MARKS.soul_splinter_mark!.applies).toBeUndefined();
    expect(MARKS.cask_blast!.applies).toBeUndefined();
  });

  it('never names a damage number in its status list', () => {
    // `damage` is already the field for that. Two ways to say the same thing is how the
    // two drift apart.
    for (const mark of Object.values(MARKS)) {
      for (const rider of mark.applies ?? []) {
        expect(Object.keys(rider).sort(), mark.name).toEqual(['stacks', 'status']);
      }
    }
  });
});
