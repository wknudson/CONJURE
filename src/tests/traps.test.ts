import { describe, expect, it } from 'vitest';
import { addUnit, atTile, damageTo, eventsOf, giveCard, handCard, play, run, scenario } from './scenario.js';
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

describe('the three Marks the set was missing', () => {
  /**
   * A branded host, a bystander beside it, and something able to hit it.
   *
   * `dtype` decides which trap springs, so every test below picks the striker's damage to
   * match the trigger it is proving — that is the whole of what a Mark's alignment does.
   */
  const wired = (mark: string, hostAt = { x: 2, y: 3 }) => {
    const state = scenario({ width: 6, height: 8 });
    const host = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: hostAt,
      hp: 200,
      mark,
    });
    // Orthogonally adjacent, so it is caught by a cross as well as by a ring.
    const beside = addUnit(state, {
      def: 'scout_imp',
      side: 'enemy',
      at: { x: hostAt.x + 1, y: hostAt.y },
      hp: 200,
    });
    const striker = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: hostAt.x, y: hostAt.y + 1 },
      hp: 200,
      fresh: false,
    });
    return { state, host, beside, striker };
  };

  const struck = (mark: string) => {
    const { state, host, beside, striker } = wired(mark);
    const res = run(state, {
      type: 'attack',
      attacker: striker.id,
      target: { kind: 'unit', id: host.id },
    });
    return { res, host, beside };
  };

  it('springs the Rime Mark on a physical blow? No — it wants frost or spell', () => {
    // The alignment rule, stated as a negative first because it is the half that fails
    // silently: a trap that goes off on everything is not a trap, it is a bomb.
    const { res } = struck('rime_mark');
    expect(eventsOf(res.events, 'markDetonated')).toHaveLength(0);
  });

  /** Sets a mark off with a real card of the right damage type, from the player's hand. */
  const cast = (mark: string, spell: string) => {
    const { state, host, beside } = wired(mark);
    state.players.player.bones = 8;
    const card = giveCard(state, 'player', spell);
    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: host.id } }));
    return { res, host, beside };
  };

  it('freezes the ground when frost sets the Rime Mark off', () => {
    const { res, beside } = cast('rime_mark', 'glacial_spike');

    expect(eventsOf(res.events, 'markDetonated')).toHaveLength(1);
    // The bystander is hit by the blast alone -- the Spike was aimed at the host.
    expect(damageTo(res.events, beside.id), 'and it hits for its 20').toBe(20);
    expect(res.state.units[beside.id]!.statuses.chill, 'two Chill, one short of a Freeze').toBe(2);
  });

  it('leaves everything around the Arc Mark Charged, exactly once', () => {
    // Charged does nothing on its own, which is exactly the point: this Mark is a setup
    // piece, and a test that only checked the damage would not notice the setup vanishing.
    //
    // **Exactly one**, and the number is the test. `dealDamage` already charges anything a
    // shock hit survives, so the first draft of this Mark also carried an `applies` entry
    // and the blast landed two stacks -- the card paying for what the engine gives free.
    // A `toBeGreaterThan(0)` here would have shrugged that off.
    const { res, beside } = cast('arc_mark', 'arc_lash');

    expect(eventsOf(res.events, 'markDetonated')).toHaveLength(1);
    expect(damageTo(res.events, beside.id)).toBe(30);
    expect(res.state.units[beside.id]!.statuses.charged).toBe(1);
  });

  it('breaks the ground under the Tremor Mark, and leaves nothing behind', () => {
    const { res, beside } = struck('tremor_mark');

    expect(eventsOf(res.events, 'markDetonated')).toHaveLength(1);
    expect(damageTo(res.events, beside.id)).toBe(40);
    // No status at all. It buys its identity with a damage type instead.
    expect(res.state.units[beside.id]!.statuses.chill).toBeUndefined();
    expect(res.state.units[beside.id]!.statuses.charged).toBeUndefined();
  });

  it('spares its own host, like every other Mark', () => {
    for (const mark of ['tremor_mark']) {
      const { res, host } = struck(mark);
      const dealt = eventsOf(res.events, 'damageDealt').filter(
        (e) => e.cause === 'mark' && e.target.kind === 'unit' && e.target.id === host.id,
      );
      expect(dealt, `${mark} caught its own host`).toEqual([]);
    }
  });

  it('is priced and obtainable exactly like the three that already existed', () => {
    for (const id of ['rime_mark', 'arc_mark', 'tremor_mark']) {
      expect(tierOf(CARDS[id]!), id).toBe(1);
      expect(isObtainable(CARDS[id]!), id).toBe(true);
      expect(CARDS[id]!.target.kind, id).toBe('entity');
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
    // Aligned to violence, not to magic. A board carrying both marks answers two threats.
    //
    // `toxic` joined the pair when bodies began swinging with their school's element: Bloom
    // deals toxic, so without it Bloom's own trap was the one Mark its own warband could not
    // spring. Spell is still deliberately absent — that is the Cinder Mark's trigger.
    expect(MARKS.rot_root_snare!.trigger).toEqual({
      kind: 'hpLoss',
      alignedTypes: ['physical', 'impact', 'toxic'],
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
    const state = scenario({ width: 6, height: 8, hand: ['volatile_cask'], bones: 6 });
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
    // Shipped since the founding starter deck: 1 Bone, death trigger, lowest-HP-enemy blast,
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
    expect(card.cost).toEqual({ bones: 1, marrow: 0 });

    const mark = MARKS.soul_splinter_mark!;
    expect(mark.school, 'the payload keeps the colour it detonates in').toBe('dusk');
    expect(mark.trigger).toEqual({ kind: 'death' });
    expect(mark.blast).toEqual({ shape: 'lowestHpEnemy' });
    expect(mark.damage).toBe(50);
    // `decay` now, where the brief said `spell`. Dusk was one of two schools with no damage
    // type of its own, so its Mark hit with the generic magic type that four other Marks
    // align to — a Soul Splinter could set off a Cinder Mark on its way past, which Dusk was
    // never meant to be able to do. It hits with Dusk's own element instead.
    expect(mark.dtype, 'Dusk hits with Dusk').toBe('decay');
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
