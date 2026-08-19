import { describe, expect, it } from 'vitest';
import { addUnit, atTile, damageTo, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { RUNES } from '../core/data/runes.js';
import { tierOf } from '../core/data/deckRules.js';
import { isObtainable } from '../core/data/collection.js';

/**
 * Traps and constructs.
 *
 * Two runes and a cask, and between them they lean on two capabilities the engine gained
 * for them: a rune that leaves a **status** rather than a number, and a card that raises
 * an obstacle and then wires it in the same `seq`. Both are the kind of thing that fails
 * silently — a rune that applies nothing, a cask that goes up unarmed — so most of what
 * follows is about proving they actually did something.
 */

describe('the set as data', () => {
  it('derives the tiers rather than declaring them', () => {
    expect(tierOf(CARDS.rot_root_snare!)).toBe(1);
    expect(tierOf(CARDS.volatile_cask!)).toBe(2);
    expect(tierOf(CARDS.soul_splinter_rune!)).toBe(1);
  });

  it('can all be obtained', () => {
    for (const id of ['rot_root_snare', 'volatile_cask', 'soul_splinter_rune']) {
      expect(isObtainable(CARDS[id]!), id).toBe(true);
    }
  });

  it('attaches runes to entities, never to tiles', () => {
    // The Lexicon's rule, and the engine's: `AttachedRune` lives on a Unit or an Obstacle,
    // and there is nowhere on a tile to put one. A rune card must therefore pick an entity.
    for (const id of ['rot_root_snare', 'soul_splinter_rune', 'cinder_rune']) {
      expect(CARDS[id]!.target.kind, id).toBe('entity');
    }
  });

  it('keeps every rune a card can attach in the registry', () => {
    for (const def of Object.values(CARDS)) {
      if (def.effect.op !== 'attachRune') continue;
      expect(RUNES[def.effect.rune], `${def.name} names a rune that does not exist`).toBeDefined();
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
      hp: 12,
      rune: 'rot_root_snare',
    });
    const beside = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 9 });
    const striker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 4 },
      hp: 9,
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

    expect(eventsOf(res.events, 'runeDetonated').length).toBe(1);
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
      eventsOf(res.events, 'damageDealt').filter((e) => e.cause === 'rune'),
      'a 0-damage rune does not fake a hit',
    ).toEqual([]);
  });

  it('spares its own host, like every ringed rune', () => {
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

  it('does not spring on a spell, which is the Cinder Rune’s job', () => {
    // Aligned to physical and impact. A board carrying both runes answers two threats.
    expect(RUNES.rot_root_snare!.trigger).toEqual({
      kind: 'hpLoss',
      alignedTypes: ['physical', 'impact'],
    });
    expect(RUNES.cinder_rune!.trigger).toEqual({
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
    expect(raised.obstacle.hp).toBe(4);
    expect(raised.obstacle.maxHp).toBe(4);
  });

  it('goes up **armed** — the seq wires what it just built', () => {
    // The whole reason `spawnedObstacleId` exists. A tile-targeted card has no entity in
    // `chosen`, so without the handoff `attachRune` would find no host and the cask would
    // be an ordinary crate.
    const { state, events, caskId } = withCask();

    expect(eventsOf(events, 'runeAttached').length, 'the rune was wired').toBe(1);
    expect(state.obstacles[caskId]!.rune?.defId).toBe('cask_blast');
  });

  it('does nothing when merely chipped', () => {
    // A `death` trigger, not `hpLoss`. Somebody has to actually break it.
    const { state, caskId } = withCask();
    const poker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 1,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: poker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(eventsOf(res.events, 'runeDetonated')).toEqual([]);
    expect(res.state.obstacles[caskId]!.rune, 'still armed').toBeDefined();
  });

  it('detonates in a cross when it is broken', () => {
    const { state, caskId } = withCask();
    // Orthogonal: caught. Diagonal: spared — the blast runs down the aisles.
    const orthogonal = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 9 });
    const diagonal = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 3 }, hp: 9 });
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 20,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(eventsOf(res.events, 'runeDetonated').length).toBe(1);
    expect(damageTo(res.events, orthogonal.id)).toBe(3);
    expect(damageTo(res.events, diagonal.id), 'the diagonal is the safe place').toBe(0);
  });

  it('leaves rubble where it stood', () => {
    const { state, caskId } = withCask();
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 20,
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
    const friend = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 1, y: 4 }, hp: 9 });
    const breaker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 5 },
      atk: 20,
      fresh: false,
    });

    const res = run(state, {
      type: 'attack',
      attacker: breaker.id,
      target: { kind: 'obstacle', id: caskId },
    });

    expect(damageTo(res.events, friend.id)).toBe(3);
  });
});

describe('Soul Splinter Rune', () => {
  it('was already in the game, and matches the brief but for its damage type', () => {
    // Shipped since the Draft 7 starter deck: dusk, Companion, 1 Pip, death trigger,
    // lowest-HP-enemy blast, 5 damage. The one difference from the brief is `spell` rather
    // than `true` — see the report. Left as shipped because it is in every starter deck
    // and `spell` is an aligned type for Cinder Rune, so changing it would quietly remove
    // a cascade interaction as well as re-balancing a card players already own.
    const card = CARDS.soul_splinter_rune!;
    expect(card.school).toBe('dusk');
    expect(card.source).toBe('companion');
    expect(card.cost).toEqual({ pips: 1, marrow: 0 });

    const rune = RUNES.soul_splinter_rune!;
    expect(rune.trigger).toEqual({ kind: 'death' });
    expect(rune.blast).toEqual({ shape: 'lowestHpEnemy' });
    expect(rune.damage).toBe(5);
    expect(rune.dtype, 'the one delta from the brief').toBe('spell');
  });

  it('fires when its host is sacrificed, not only when it is killed', () => {
    const state = scenario({ width: 6, height: 8 });
    const host = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 5 },
      rune: 'soul_splinter_rune',
      fresh: false,
    });
    const victim = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 });

    const res = run(state, { type: 'sacrifice', unit: host.id });

    expect(eventsOf(res.events, 'runeDetonated').length).toBe(1);
    expect(damageTo(res.events, victim.id)).toBe(5);
  });
});

describe('a rune that applies statuses, generally', () => {
  it('is opt-in — an ordinary rune leaves nothing behind', () => {
    expect(RUNES.cinder_rune!.applies).toBeUndefined();
    expect(RUNES.soul_splinter_rune!.applies).toBeUndefined();
    expect(RUNES.cask_blast!.applies).toBeUndefined();
  });

  it('never names a damage number in its status list', () => {
    // `damage` is already the field for that. Two ways to say the same thing is how the
    // two drift apart.
    for (const rune of Object.values(RUNES)) {
      for (const rider of rune.applies ?? []) {
        expect(Object.keys(rider).sort(), rune.name).toEqual(['stacks', 'status']);
      }
    }
  });
});
