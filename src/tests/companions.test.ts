import { describe, expect, it } from 'vitest';
import { addUnit, atTile, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { COMPANION_TRAITS, traitsFor } from '../core/data/companionTraits.js';
import { RESONANCE, VERDANT_GROWTH_HEAL, resonanceFor } from '../core/data/resonance.js';
import { validateDeck } from '../core/data/deckRules.js';
import { startingCollection } from '../core/data/collection.js';
import { createCombat } from '../core/engine/setup.js';
import { carryFor } from '../core/overworld/run.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { tameCompanion, type CompanionInstance } from '../core/overworld/vivarium.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { makeRng } from '../core/util/rng.js';
import { pushUnit } from '../core/engine/displacement.js';
import { makeCtx } from '../core/engine/context.js';
import { stepCost } from '../core/engine/movement.js';

/**
 * Mortis and Sylva, and the four variants they roll.
 *
 * Two of these traits are the first things in the game to hang behaviour off a *moment*
 * rather than off a number — a body being given up, a status being applied. The codebase
 * has no listener system and does not want one, so both are boons the engine reads at the
 * chokepoint the moment already passes through.
 */

const character = (): GlobalGameState => ({ overworld: newRun(1), combat: null });

/** A character standing beside a beast of the given bloodline, wearing the given knack. */
const withKnack = (baseId: string, traitId: string) => {
  const g = character();
  const beast: CompanionInstance = { ...tameCompanion(makeRng(1), baseId, 1), traitId };
  return { g, beast, carry: carryFor(g.overworld, beast) };
};

describe('the roster', () => {
  it('has both new bloodlines, each with a body of its own', () => {
    for (const id of ['mortis', 'sylva']) {
      const species = companionById(id);
      expect(species, id).toBeDefined();
      const body = CARDS[species!.unitCardId];
      expect(body, `${id} body`).toBeDefined();
      expect(body!.keywords).toContain('BoundForm');
      expect(body!.setupOnly).toBe(true);
      expect(body!.school).toBe(species!.school);
    }
  });

  it('brings a legal deck, like everyone else', () => {
    const { unlocked } = startingCollection();
    for (const companion of COMPANIONS) {
      expect(validateDeck(companion.deck, { unlocked }), companion.name).toEqual([]);
    }
  });

  it('gives every species a school passive', () => {
    // A Companion whose school has no Resonance would fire nothing on the first card each
    // turn — a passive the selection screen promises and the fight never delivers.
    for (const companion of COMPANIONS) {
      expect(resonanceFor(companion.school), companion.name).toBeDefined();
    }
  });

  it('gives every species a bloodline to roll from', () => {
    for (const species of COMPANIONS) {
      expect(traitsFor(species.id).length, species.name).toBeGreaterThan(1);
    }
  });

  it('files every trait under a bloodline that exists', () => {
    const known = new Set(COMPANIONS.map((c) => c.id));
    for (const trait of Object.values(COMPANION_TRAITS)) {
      expect(known.has(trait.baseId), `${trait.name} -> ${trait.baseId}`).toBe(true);
      expect(Object.keys(trait.boons), trait.name).not.toContain('damage');
    }
  });

  it('opens a fight on the body it named', () => {
    for (const id of ['mortis', 'sylva']) {
      const { state } = createCombat(NOVICE_DUELIST, 7, id);
      expect(state.players.player.companionUnitDefId, id).toBe(companionById(id)!.unitCardId);
      expect(state.players.player.companionSchool).toBe(companionById(id)!.school);
    }
  });
});

describe('Verdant Growth', () => {
  it('is the Bloom passive', () => {
    expect(resonanceFor('bloom')).toBe(RESONANCE.bloom);
    expect(RESONANCE.bloom!.name).toBe('Verdant Growth');
  });

  /** A wounded Sylva board with one Companion card in hand. */
  const board = (hand: string[], hp: number) => {
    const state = scenario({ width: 6, height: 8, hand, pips: 8 });
    // `scenario` sets maxHp to whatever hp it is given, so asking for 20 would produce a
    // Pact that is *full at 20* and has nothing to heal. Wound it against a real ceiling.
    state.players.player.maxHp = 400;
    state.players.player.hp = hp;
    state.players.player.companionSchool = 'bloom';
    const body = addUnit(state, {
      def: 'sylva_bound',
      side: 'player',
      at: { x: 2, y: 5 },
      titheBonus: 0,
    });
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'sylva_bound';
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 90 });
    return state;
  };

  it('puts health back on the first Companion card', () => {
    const state = board(['spore_cloud'], 200);
    const card = handCard(state, 'player', 'spore_cloud');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.players.player.hp).toBe(200 + VERDANT_GROWTH_HEAL);
    const healed = eventsOf(res.events, 'healed');
    expect(healed.length, 'and says so').toBe(1);
    expect(healed[0]!.amount).toBe(VERDANT_GROWTH_HEAL);
  });

  it('says nothing when the Pact is already full', () => {
    // A floater reading "+0" is worse than no floater.
    const state = board(['spore_cloud'], 400);
    const card = handCard(state, 'player', 'spore_cloud');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.players.player.hp).toBe(400);
    expect(eventsOf(res.events, 'healed')).toEqual([]);
  });

  it('never overheals past the ceiling', () => {
    const state = board(['spore_cloud'], 390);
    const card = handCard(state, 'player', 'spore_cloud');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.players.player.hp).toBe(400);
    expect(eventsOf(res.events, 'healed')[0]!.amount, 'only what was owed').toBe(10);
  });

  it('fires once a turn, not once a card', () => {
    const state = board(['spore_cloud', 'spore_cloud'], 200);
    const first = handCard(state, 'player', 'spore_cloud');
    const after = run(state, play(first, atTile(2, 3))).state;
    const second = handCard(after, 'player', 'spore_cloud');

    const res = run(after, play(second, atTile(4, 3)));

    expect(eventsOf(res.events, 'healed')).toEqual([]);
  });
});

describe('Soul Siphon', () => {
  const siphoning = (hand: string[] = []) => {
    const state = scenario({ width: 6, height: 8, hand, pips: 8 });
    state.players.player.maxHp = 400;
    state.players.player.hp = 200;
    state.players.player.healOnTithe = 10;
    const victim = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });
    return { state, victim };
  };

  it('reaches the engine as a capability, not a listener', () => {
    const { carry } = withKnack('mortis', 'soul_siphon');
    expect(carry.boons?.healOnTithe).toBe(10);
    expect(JSON.stringify(carry), 'the engine never hears the name').not.toContain('soul_siphon');

    const { state } = createCombat(NOVICE_DUELIST, 7, 'mortis', undefined, carry);
    expect(state.players.player.healOnTithe).toBe(10);
    expect(state.players.enemy.healOnTithe, 'and the enemy gets nothing').toBe(0);
  });

  it('takes something back from a tithe made by hand', () => {
    const { state, victim } = siphoning();
    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.players.player.hp).toBe(210);
    expect(eventsOf(res.events, 'healed').length).toBe(1);
  });

  it('takes it back from a tithe made by a card too', () => {
    // Dark Tithe bleeds through the `tithe` op, which routes into the same `applyTithe` as
    // the command. A trait about tithing has to apply there as well, or it is worthless to
    // the deck most likely to want it.
    const { state, victim } = siphoning(['dark_tithe']);
    const card = handCard(state, 'player', 'dark_tithe');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: victim.id } }));

    expect(res.state.players.player.hp).toBe(210);
  });

  it('gives nothing without the knack', () => {
    const state = scenario({ width: 6, height: 8 });
    state.players.player.maxHp = 400;
    state.players.player.hp = 200;
    const victim = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 2, y: 5 },
      fresh: false,
    });

    const res = run(state, { type: 'bloodTithe', unit: victim.id });

    expect(res.state.players.player.hp).toBe(200);
    expect(eventsOf(res.events, 'healed')).toEqual([]);
  });
});

describe('Toxic Bloom', () => {
  const poisoning = (bonus: number) => {
    const state = scenario({ width: 6, height: 8, hand: ['spore_cloud'], pips: 8 });
    state.players.player.bonusToxinStacks = bonus;
    addUnit(state, { def: 'sylva_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 120 });
    return { state, foe };
  };

  it('deepens every Toxin the side applies', () => {
    const plain = poisoning(0);
    const bare = run(plain.state, play(handCard(plain.state, 'player', 'spore_cloud'), atTile(2, 3)));
    const base = bare.state.units[plain.foe.id]!.statuses.toxin!;

    const rich = poisoning(1);
    const res = run(rich.state, play(handCard(rich.state, 'player', 'spore_cloud'), atTile(2, 3)));

    expect(res.state.units[rich.foe.id]!.statuses.toxin).toBe(base + 1);
  });

  it('leaves every other status alone', () => {
    const { state, foe } = poisoning(1);
    state.players.player.cards.arc = { instanceId: 'arc', defId: 'static_arc' };
    state.players.player.hand.push('arc');

    const res = run(state, play('arc', atTile(2, 3)));

    expect(res.state.units[foe.id]!.statuses.charged, 'charge is not toxin').toBe(1);
  });

  it('is the acting side that pays for it', () => {
    // Attributed by `activeSide`, because `applyStatusTo` is handed the victim and nothing
    // else. A Plague-Bearer poisoning on the enemy's turn reads the *enemy's* number, so
    // the player's Toxic Bloom does not make the enemy's poison worse.
    const state = scenario({ width: 6, height: 8 });
    state.players.player.bonusToxinStacks = 1;
    state.players.enemy.bonusToxinStacks = 0;
    state.activeSide = 'enemy';

    const carrier = addUnit(state, {
      def: 'plague_bearer',
      side: 'enemy',
      at: { x: 2, y: 3 },
      fresh: false,
    });
    const mine = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 120 });

    const res = run(state, {
      type: 'attack',
      attacker: carrier.id,
      target: { kind: 'unit', id: mine.id },
    });

    expect(res.state.units[mine.id]!.statuses.toxin, 'the player bonus did not apply').toBe(1);
  });
});

describe('Ethereal-Bound', () => {
  const ethereal = (on: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    state.players.player.boundFormIgnoresHazards = on;
    const body = addUnit(state, {
      def: 'mortis_bound',
      side: 'player',
      at: { x: 2, y: 5 },
      titheBonus: 0,
      fresh: false,
    });
    state.players.player.companionUnitId = body.id;
    state.hazards['2,4'] = { kind: 'rubble', at: { x: 2, y: 4 }, turns: 1, owner: 'player', permanent: true };
    return { state, body };
  };

  it('crosses broken ground as if it were not there', () => {
    const slowed = ethereal(false);
    const free = ethereal(true);

    expect(stepCost(slowed.state, slowed.state.units[slowed.body.id]!, { x: 2, y: 4 })).toBe(2);
    expect(stepCost(free.state, free.state.units[free.body.id]!, { x: 2, y: 4 })).toBe(1);
  });

  it('is not picked up by a current', () => {
    const { state, body } = ethereal(true);
    state.hazards['2,5'] = {
      kind: 'current',
      at: { x: 2, y: 5 },
      turns: 9,
      owner: 'player',
      dir: { x: 0, y: -1 },
    };
    const before = { ...state.units[body.id]!.anchor };

    const res = run(state, { type: 'endTurn' });

    expect(res.state.units[body.id]!.anchor, 'the water flowed around it').toEqual(before);
  });

  it('spares an ordinary body none of it', () => {
    // The flag is scoped to the Bound Form: a Companion's nature does not travel to the
    // minions it fights beside.
    const { state } = ethereal(true);
    const grunt = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 4, y: 5 } });
    expect(stepCost(state, state.units[grunt.id]!, { x: 2, y: 4 })).toBe(2);
  });
});

describe('Deep Roots', () => {
  const rooted = (on: boolean) => {
    const state = scenario({ width: 6, height: 8 });
    state.players.player.boundFormGrounded = on;
    const body = addUnit(state, {
      def: 'sylva_bound',
      side: 'player',
      at: { x: 2, y: 5 },
      titheBonus: 0,
      fresh: false,
    });
    return { state, body };
  };

  it('refuses a shove outright', () => {
    const { state, body } = rooted(true);
    const ctx = makeCtx(state);
    const before = { ...state.units[body.id]!.anchor };

    const result = pushUnit(ctx, ctx.state.units[body.id]!, { x: 0, y: -1 }, 2);

    expect(ctx.state.units[body.id]!.anchor).toEqual(before);
    expect(result.collision, 'nothing was hit — it simply did not move').toBeUndefined();
  });

  it('refuses a pull, which is the same chokepoint inverted', () => {
    const { state, body } = rooted(true);
    const ctx = makeCtx(state);
    const before = { ...state.units[body.id]!.anchor };

    pushUnit(ctx, ctx.state.units[body.id]!, { x: 0, y: 1 }, 1);

    expect(ctx.state.units[body.id]!.anchor).toEqual(before);
  });

  it('moves normally without the knack', () => {
    const { state, body } = rooted(false);
    const ctx = makeCtx(state);

    pushUnit(ctx, ctx.state.units[body.id]!, { x: 0, y: -1 }, 1);

    expect(ctx.state.units[body.id]!.anchor.y).toBe(4);
  });

  it('does not root the army it stands beside', () => {
    const { state } = rooted(true);
    const grunt = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 4, y: 5 } });
    const ctx = makeCtx(state);

    pushUnit(ctx, ctx.state.units[grunt.id]!, { x: 0, y: -1 }, 1);

    expect(ctx.state.units[grunt.id]!.anchor.y).toBe(4);
  });
});

describe('the knacks reaching the board', () => {
  it('hands the engine capabilities and never a trait id', () => {
    for (const [baseId, traitId] of [
      ['mortis', 'soul_siphon'],
      ['mortis', 'ethereal_bound'],
      ['sylva', 'deep_roots'],
      ['sylva', 'toxic_bloom'],
    ] as const) {
      const { carry } = withKnack(baseId, traitId);
      expect(JSON.stringify(carry), traitId).not.toContain(traitId);
      expect(Object.keys(carry.boons ?? {}).length, `${traitId} does something`).toBeGreaterThan(0);
    }
  });

  it('sets each flag on the player and on nobody else', () => {
    const { carry } = withKnack('sylva', 'deep_roots');
    const { state } = createCombat(NOVICE_DUELIST, 7, 'sylva', undefined, carry);

    expect(state.players.player.boundFormGrounded).toBe(true);
    expect(state.players.enemy.boundFormGrounded).toBe(false);
  });
});
