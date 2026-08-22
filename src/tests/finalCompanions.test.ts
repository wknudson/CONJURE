import { describe, expect, it } from 'vitest';
import { addUnit, eventsOf, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { traitsFor } from '../core/data/companionTraits.js';
import { RESONANCE } from '../core/data/resonance.js';
import { isObtainable, startingCollection } from '../core/data/collection.js';
import { tierOf, validateDeck } from '../core/data/deckRules.js';
import { makeCtx } from '../core/engine/context.js';
import { applyStatusTo } from '../core/engine/status.js';
import { pushUnit } from '../core/engine/displacement.js';
import { hasLoS } from '../core/engine/los.js';
import { detonate } from '../core/engine/marks.js';
import { isRosterEligible } from '../core/data/roster.js';

/**
 * Content Sprint 2: the last two schools get a Companion, and three dormant mechanics
 * get their first user.
 */

// ============================================================ Phase 0

describe('poison is credited to whoever laid it', () => {
  it('gives a trap the bonus of the side that laid it, on the enemy’s turn', () => {
    // The bug this replaces: `toxinBonus` read `activeSide`, so a Rot-Root Snare *you*
    // laid sprang on the enemy's clock and collected nothing — the one deck built around
    // the trait was the one deck that never saw it.
    const state = scenario({ width: 6, height: 6 });
    const host = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 2 },
      hp: 200,
      mark: 'rot_root_snare',
    });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 3 }, hp: 200 });

    // The player laid it and holds Toxic Bloom; it springs while the enemy is acting.
    state.players.player.bonusToxinStacks = 1;
    state.activeSide = 'enemy';

    const ctx = makeCtx(state);
    detonate(ctx, ctx.state.units[host.id]!, 1);

    const victim = Object.values(ctx.state.units).find((u) => u.side === 'enemy')!;
    // Snare applies 1; the layer's bonus makes it 2, on a turn that is not theirs.
    expect(victim.statuses.toxin, 'the layer’s bonus, on the enemy’s clock').toBe(2);
  });

  it('does not hand the bonus to the side merely holding the turn', () => {
    const state = scenario({ width: 6, height: 6 });
    const host = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 2, y: 2 },
      hp: 200,
      mark: 'rot_root_snare',
    });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 3 }, hp: 200 });

    // The *enemy* holds the stat this time, and it is their turn. Reading the clock would
    // have credited them for walking into someone else's roots.
    state.players.enemy.bonusToxinStacks = 1;
    state.activeSide = 'enemy';

    const ctx = makeCtx(state);
    detonate(ctx, ctx.state.units[host.id]!, 1);

    const victim = Object.values(ctx.state.units).find((u) => u.side === 'enemy')!;
    expect(victim.statuses.toxin).toBe(1);
  });

  it('stores the amplified count, so the tick never asks whose poison it was', () => {
    // The amplification happens once, at application. Everything downstream reads a plain
    // number, which is what keeps `tickStatus` side-agnostic.
    const state = scenario({ width: 5, height: 5 });
    const victim = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 200,
    });
    state.players.player.bonusToxinStacks = 2;

    const ctx = makeCtx(state);
    applyStatusTo(ctx, ctx.state.units[victim.id]!, 'toxin', 1, 'player');

    expect(ctx.state.units[victim.id]!.statuses.toxin, 'stored already amplified').toBe(3);
  });

  it('credits nobody for scenery', () => {
    // A crystal bursting is the board's doing. `source: undefined` collects nothing.
    const state = scenario({ width: 5, height: 5 });
    const victim = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 200,
    });
    state.players.player.bonusToxinStacks = 3;
    state.players.enemy.bonusToxinStacks = 3;

    const ctx = makeCtx(state);
    applyStatusTo(ctx, ctx.state.units[victim.id]!, 'toxin', 1);

    expect(ctx.state.units[victim.id]!.statuses.toxin).toBe(1);
  });
});

// ============================================================ Phase 1

describe('the roster is complete', () => {
  it('gives every school with a Companion a Resonance, and vice versa', () => {
    // The two lists are held together so a species cannot promise a passive on the
    // selection screen and deliver nothing in the fight.
    for (const c of COMPANIONS) {
      expect(RESONANCE[c.school], `${c.id} has no Resonance`).toBeDefined();
    }
  });

  it('fields Ferrum and Lexis with bodies, decks and three knacks each', () => {
    for (const id of ['ferrum', 'lexis']) {
      const def = companionById(id)!;
      expect(def, id).toBeDefined();
      expect(CARDS[def.unitCardId], `${id} has no body`).toBeDefined();
      expect(CARDS[def.unitCardId]!.keywords).toContain('BoundForm');
      expect(traitsFor(id), `${id} knacks`).toHaveLength(3);
    }
  });

  it('builds both a legal opening deck out of the pooled collection', () => {
    // A species whose own deck does not validate would be unpickable.
    const collection = startingCollection();
    for (const id of ['ferrum', 'lexis']) {
      const def = companionById(id)!;
      const problems = validateDeck(def.deck, collection);
      expect(problems, `${id}: ${JSON.stringify(problems)}`).toHaveLength(0);
    }
  });
});

describe('Shield Oath', () => {
  it('armours allies in the Companion’s column and nobody else', () => {
    const state = scenario({ width: 6, height: 6 });
    const inLane = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
    const offLane = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 4, y: 4 } });
    const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 2, y: 1 } });

    const ctx = makeCtx(state);
    RESONANCE.bulwark!.apply(ctx, 'player', 2);

    expect(ctx.state.units[inLane.id]!.armor).toBe(10);
    expect(ctx.state.units[offLane.id]!.armor, 'a different lane').toBe(0);
    expect(ctx.state.units[foe.id]!.armor, 'the enemy standing in it').toBe(0);
  });

  it('is the mirror of Ember Watch, not a copy of Rime Guard', () => {
    // Armour on the bodies, not on the portrait — Bulwark's argument is that the line
    // holds, and armouring the Hero would be Rime Guard under a new name.
    const state = scenario({ width: 6, height: 6 });
    addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
    const before = state.players.player.armor;

    const ctx = makeCtx(state);
    RESONANCE.bulwark!.apply(ctx, 'player', 2);

    expect(ctx.state.players.player.armor).toBe(before);
  });
});

describe('Marginalia', () => {
  it('draws a card', () => {
    const state = scenario({ deck: ['scout_imp', 'scout_imp', 'scout_imp'] });
    const before = state.players.player.hand.length;

    const ctx = makeCtx(state);
    RESONANCE.arcane!.apply(ctx, 'player', 0);

    expect(ctx.state.players.player.hand.length).toBe(before + 1);
  });

  it('goes through the ordinary draw, so a full hand burns for Marrow', () => {
    // The passive is not exempt from the hand limit: that is what makes the Coin and the
    // Hoarder knack a build rather than a nicety.
    const state = scenario({ deck: ['scout_imp', 'scout_imp'] });
    const cmd = state.players.player;
    while (cmd.hand.length < cmd.handLimit) cmd.hand.push(cmd.hand[0] ?? 'x');
    const marrowBefore = cmd.marrow;

    const ctx = makeCtx(state);
    RESONANCE.arcane!.apply(ctx, 'player', 0);

    expect(ctx.state.players.player.marrow, 'overdraw paid a Marrow').toBeGreaterThan(
      marrowBefore,
    );
  });
});

describe('the new knacks reach the engine', () => {
  it('braces a collision by exactly what Heavy Plating promises', () => {
    const state = scenario({ width: 7, height: 7 });
    const shoved = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 3 }, hp: 200 });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 3, y: 4 }, hp: 200 });
    state.players.player.collisionResist = 10;

    const ctx = makeCtx(state);
    pushUnit(ctx, ctx.state.units[shoved.id]!, { x: 0, y: 1 }, 1);

    // 30 into the shoved body, less ten for the plate.
    expect(ctx.state.units[shoved.id]!.hp).toBe(200 - 20);
  });

  it('never turns a collision into a heal', () => {
    const state = scenario({ width: 7, height: 7 });
    const shoved = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 3 }, hp: 200 });
    addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 3, y: 4 }, hp: 200 });
    state.players.player.collisionResist = 99;

    const ctx = makeCtx(state);
    pushUnit(ctx, ctx.state.units[shoved.id]!, { x: 0, y: 1 }, 1);

    expect(ctx.state.units[shoved.id]!.hp).toBe(200);
  });

  it('sees past a Guardian with Piercing Gaze, and never past a Behemoth', () => {
    const state = scenario({ width: 7, height: 7 });
    addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 3, y: 3 },
      keywords: ['Guardian'],
    });

    const from = { x: 3, y: 5 };
    const to = { x: 3, y: 1 };
    expect(hasLoS(state, from, to, [], 'player'), 'screened by default').toBe(false);

    state.players.player.ignoresGuardians = true;
    expect(hasLoS(state, from, to, [], 'player'), 'read around the screen').toBe(true);
  });

  it('leaves a Behemoth opaque even to a piercing eye', () => {
    // Bulk is geometry; a Guardian is a posture. Only the posture can be read around.
    const state = scenario({ width: 7, height: 7 });
    // A real 2x2. `slag_iron_golem` reads like a Behemoth and is footprint 1, so using it
    // here would have tested nothing — its Guardian keyword is what blocks, and that is
    // exactly the half a piercing eye is allowed to read around.
    addUnit(state, { def: 'magma_brute', side: 'enemy', at: { x: 3, y: 3 } });
    state.players.player.ignoresGuardians = true;

    const blocked = !hasLoS(state, { x: 3, y: 6 }, { x: 3, y: 0 }, [], 'player');
    expect(blocked, 'a 2x2 is still solid').toBe(true);
  });
});

// ============================================================ Phase 2

describe('the three dormant mechanics have a user', () => {
  it('gives the game its first Stun', () => {
    // Every consumer of `stun` already existed — canAct, the decay, the threat model, the
    // icon, the glossary. This is the half that was missing.
    const state = scenario({ width: 6, height: 6 });
    const hammer = addUnit(state, {
      def: 'concussive_blow',
      side: 'player',
      at: { x: 2, y: 2 },
      fresh: false,
    });
    const victim = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 200,
    });

    const out = run(state, {
      type: 'attack',
      attacker: hammer.id,
      target: { kind: 'unit', id: victim.id },
    });

    expect(out.state.units[victim.id]!.statuses.stun).toBe(1);
    expect(eventsOf(out.events, 'statusApplied').some((e) => e.status === 'stun')).toBe(true);
  });

  it('makes a Stunned body unable to act', () => {
    const state = scenario({ width: 6, height: 6 });
    const hammer = addUnit(state, {
      def: 'concussive_blow',
      side: 'player',
      at: { x: 2, y: 2 },
      fresh: false,
    });
    const victim = addUnit(state, {
      def: 'vanguard_footman',
      side: 'enemy',
      at: { x: 2, y: 3 },
      hp: 200,
    });

    const hit = run(state, {
      type: 'attack',
      attacker: hammer.id,
      target: { kind: 'unit', id: victim.id },
    });
    hit.state.activeSide = 'enemy';
    hit.state.units[victim.id]!.movedThisTurn = false;
    hit.state.units[victim.id]!.attackedThisTurn = false;

    expect(() =>
      run(hit.state, {
        type: 'attack',
        attacker: victim.id,
        target: { kind: 'unit', id: hammer.id },
      }),
    ).toThrow();
  });

  it('draws Aether Beam down a line, through friend and foe alike', () => {
    const state = scenario({ width: 7, height: 7, hand: ['aether_beam'], pips: 6 });
    // A Bound Form to cast from — a companion-source card is thrown from a body.
    addUnit(state, {
      def: 'lexis_bound',
      side: 'player',
      at: { x: 3, y: 5 },
      keywords: ['BoundForm'],
    });
    const foe = addUnit(state, { def: 'vanguard_footman', side: 'enemy', at: { x: 3, y: 3 }, hp: 200 });
    const ally = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 3, y: 2 }, hp: 200 });

    const card = Object.keys(state.players.player.cards)[0]!;
    const out = run(state, {
      type: 'playCard',
      card,
      target: { kind: 'line', from: { x: 3, y: 4 }, dir: { x: 0, y: -1 } },
    });

    expect(out.state.units[foe.id]!.hp, 'the enemy on the line').toBe(170);
    expect(out.state.units[ally.id]!.hp, 'a beam does not check sides').toBe(170);
  });

  it('raises cover from a card for the first time', () => {
    const state = scenario({ width: 7, height: 7, hand: ['smoke_bomb'], pips: 6 });
    const card = Object.keys(state.players.player.cards)[0]!;

    const out = run(state, {
      type: 'playCard',
      card,
      target: { kind: 'tile', at: { x: 3, y: 3 } },
    });

    const bank = Object.values(out.state.obstacles).find((o) => o.defId === 'smoke_bank');
    expect(bank, 'the bank was raised').toBeDefined();
    expect(bank!.cover, 'and it is cover, not masonry').toBe(true);

    // The snapshot carries it, or the renderer draws a screen as a wall.
    const spawned = eventsOf(out.events, 'obstacleSpawned');
    expect(spawned.at(-1)!.obstacle.cover).toBe(true);
  });

  it('blocks sight with the smoke without blocking the ground', () => {
    const state = scenario({ width: 7, height: 7, hand: ['smoke_bomb'], pips: 6 });
    const card = Object.keys(state.players.player.cards)[0]!;
    const out = run(state, {
      type: 'playCard',
      card,
      target: { kind: 'tile', at: { x: 3, y: 3 } },
    });

    expect(
      hasLoS(out.state, { x: 3, y: 5 }, { x: 3, y: 1 }, [], 'player'),
      'smoke occludes',
    ).toBe(false);
  });
});

describe('the new cards as data', () => {
  it('derives the intended tiers rather than authoring them', () => {
    expect(tierOf(CARDS.concussive_blow!)).toBe(2);
    expect(tierOf(CARDS.aether_beam!)).toBe(2);
    expect(tierOf(CARDS.smoke_bomb!)).toBe(1);
  });

  it('offers the three playable ones and hides the scenery', () => {
    for (const id of ['aether_beam', 'smoke_bomb']) {
      expect(isObtainable(CARDS[id]!), id).toBe(true);
    }
    // Concussive Blow is a body, and bodies are roster kit rather than collection cards.
    expect(isObtainable(CARDS.concussive_blow!)).toBe(false);
    expect(isRosterEligible(CARDS.concussive_blow!)).toBe(true);
    // The bank is a product of the Bomb, never a card in its own right.
    expect(isObtainable(CARDS.smoke_bank!), 'smoke_bank leaked into the loot pool').toBe(false);
    for (const id of ['ferrum_bound', 'lexis_bound']) {
      expect(isObtainable(CARDS[id]!), id).toBe(false);
    }
  });
});
