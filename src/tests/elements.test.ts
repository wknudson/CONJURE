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
import { SURGE_CARDS } from '../core/data/cards/surge.js';
import { BLOOM_CARDS } from '../core/data/cards/bloom.js';
import { tierOf, validateDeck, TIER_COPY_LIMIT } from '../core/data/deckRules.js';
import { isObtainable, startingCollection } from '../core/data/collection.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { COMPANION_TRAITS, traitsFor } from '../core/data/companionTraits.js';
import { RESONANCE, resonanceFor } from '../core/data/resonance.js';
import { REACTION_PIP_CAP, REACTION_PIP_REFUND } from '../core/engine/reactions.js';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { legalMoves } from '../core/engine/movement.js';
import type { EffectNode } from '../core/types/cards.js';
import { REACTIONS, findReaction } from '../core/data/reactions.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { CHILL_TO_FREEZE, applyStatusTo } from '../core/engine/status.js';

/**
 * The Surge and Bloom wave.
 *
 * These two schools exist to feed the Reaction matrix: Surge is the only source of
 * `charged` and Bloom the only repeatable source of `toxin`, so three of the five
 * reactions were unreachable from a deck before this. Most of what follows is therefore
 * about the *handoff* — a status applied by one school being read by another's damage.
 */

const NEW_CARDS = { ...SURGE_CARDS, ...BLOOM_CARDS };

describe('the new cards, as data', () => {
  it('derives the tiers rather than declaring them', () => {
    expect(tierOf(CARDS.static_arc!)).toBe(1);
    expect(tierOf(CARDS.voltaic_hound!)).toBe(2);
    expect(tierOf(CARDS.spore_cloud!)).toBe(2);
    expect(tierOf(CARDS.creeping_briar!)).toBe(1);
  });

  it('can all be obtained', () => {
    for (const id of Object.keys(NEW_CARDS)) {
      expect(isObtainable(CARDS[id]!), id).toBe(true);
    }
  });

  it('only claims reach on the cards that can enforce it', () => {
    // A Hero card's `range` is read by nothing — `castOriginCells` returns 'global' for
    // any non-companion source. Only the two Companion spells may carry one.
    for (const [id, def] of Object.entries(NEW_CARDS)) {
      if (def.source === 'hero') expect(def.range, id).toBeUndefined();
      else expect(def.range, id).toBeGreaterThan(0);
    }
  });

  it('aims its radiating spells at a tile, not at a body', () => {
    // `resolveArea` centres `adjacentCross` on the chosen origin. Targeting a unit would
    // put the cross around the victim and spare the victim — the opposite of the card.
    for (const id of ['static_arc', 'spore_cloud']) {
      expect(CARDS[id]!.target.kind, id).toBe('emptyTile');
    }
  });
});

describe('Static Arc', () => {
  /** Two enemies orthogonally beside (2,2), and one on the diagonal that must be spared. */
  const cluster = () => {
    const state = scenario({ width: 6, height: 7, hand: ['static_arc'], pips: 6 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 4 }, titheBonus: 0 });
    const north = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 });
    const east = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 9 });
    const corner = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 }, hp: 9 });
    return { state, north, east, corner };
  };

  it('charges the cross and spares the diagonals', () => {
    const { state, north, east, corner } = cluster();
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 2)));

    expect(res.state.units[north.id]!.statuses.charged).toBe(1);
    expect(res.state.units[east.id]!.statuses.charged).toBe(1);
    expect(res.state.units[corner.id]!.statuses.charged, 'the diagonal is the restraint')
      .toBeUndefined();
  });

  it('deals its damage to the same cross', () => {
    const { state, north, east, corner } = cluster();
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 2)));

    expect(damageTo(res.events, north.id)).toBe(2);
    expect(damageTo(res.events, east.id)).toBe(2);
    expect(damageTo(res.events, corner.id)).toBe(0);
  });

  it('sets off nothing by itself — charge is inert until somebody reads it', () => {
    const { state } = cluster();
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 2)));

    expect(eventsOf(res.events, 'reactionTriggered')).toEqual([]);
  });
});

describe('the handoff Surge exists for', () => {
  /** One charged enemy, and a hand holding whichever card is about to read the charge. */
  const charged = (hand: string[], armor = 0) => {
    const state = scenario({ width: 6, height: 7, hand, pips: 8, marrow: 4 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 4 }, titheBonus: 0 });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 12, armor });
    foe.statuses.charged = 1;
    const bystander = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 });
    return { state, foe, bystander };
  };

  it('Overloads when fire meets the charge, and throws the neighbours clear', () => {
    // No armor, deliberately. Overload is `requiresHpLoss: true` — a blow entirely
    // absorbed applies its status but sets nothing off, exactly as a rune would not
    // detonate. Five armor here would swallow Flame Surge's 3 and the charge would hold.
    const { state, foe, bystander } = charged(['flame_surge']);
    const card = handCard(state, 'player', 'flame_surge');

    const res = run(state, play(card, { kind: 'line', from: { x: 2, y: 2 }, dir: { x: 0, y: -1 } }));

    const fired = eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction);
    expect(fired).toContain('overload');
    expect(res.state.units[foe.id]?.statuses.charged, 'the charge is spent').toBeFalsy();
    // The blast throws everything adjacent a tile clear of the detonation.
    expect(res.state.units[bystander.id]?.anchor.y ?? 0).toBeLessThan(1);
  });

  it('Superconducts when frost runs through it, stripping plate and leaving it Brittle', () => {
    const { state, foe } = charged(['glacial_spike'], 5);
    const card = handCard(state, 'player', 'glacial_spike');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));

    const fired = eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction);
    expect(fired).toContain('superconduct');
    expect(res.state.units[foe.id]!.armor, 'all of it, not some of it').toBe(0);
    expect(res.state.units[foe.id]!.statuses.brittle).toBeGreaterThan(0);
  });

  it('pays a Pip back for landing one, capped so a cascade cannot fund itself', () => {
    const { state, foe } = charged(['glacial_spike']);
    const before = state.players.player.pips;
    const card = handCard(state, 'player', 'glacial_spike');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));

    const refunds = eventsOf(res.events, 'pipRefunded');
    expect(refunds.length).toBeGreaterThan(0);
    expect(refunds[0]!.amount).toBe(REACTION_PIP_REFUND);
    expect(res.state.players.player.reactionPipsThisTurn).toBeLessThanOrEqual(REACTION_PIP_CAP);
    expect(res.state.players.player.pips).toBeGreaterThan(before - CARDS.glacial_spike!.cost.pips);
  });
});

describe('Spore Cloud', () => {
  const dosed = (hand: string[] = ['spore_cloud'], armor = 8) => {
    const state = scenario({ width: 6, height: 7, hand, pips: 8 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 4 }, titheBonus: 0 });
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 2 },
      hp: 12,
      armor,
    });
    return { state, foe };
  };

  it('lays two stacks on the cross', () => {
    const { state, foe } = dosed();
    const card = handCard(state, 'player', 'spore_cloud');

    const res = run(state, play(card, atTile(2, 1)));

    expect(res.state.units[foe.id]!.statuses.toxin).toBe(2);
  });

  it('does nothing at all on the way in', () => {
    // No damage, so no reaction and no rune. Bloom's whole cost is the turn it spends.
    const { state, foe } = dosed();
    const card = handCard(state, 'player', 'spore_cloud');

    const res = run(state, play(card, atTile(2, 1)));

    expect(damageTo(res.events, foe.id)).toBe(0);
    expect(eventsOf(res.events, 'reactionTriggered')).toEqual([]);
  });

  it('ticks straight through armor when the turn comes round', () => {
    // Eight armor and it changes nothing: Toxin is dealt as `true` damage.
    const { state, foe } = dosed();
    const card = handCard(state, 'player', 'spore_cloud');

    const dosedState = run(state, play(card, atTile(2, 1))).state;
    const armorBefore = dosedState.units[foe.id]!.armor;
    const res = run(dosedState, { type: 'endTurn' });

    const ticks = eventsOf(res.events, 'statusTicked').filter(
      (e) => e.unitId === foe.id && e.status === 'toxin',
    );
    expect(ticks.length).toBe(1);
    expect(ticks[0]!.damage).toBeGreaterThan(0);
    expect(res.state.units[foe.id]!.armor, 'armor is bypassed, not spent').toBe(armorBefore);
  });

  it('is the fuse Wildfire consumes, all stacks at once', () => {
    // Unarmoured, for the same reason Overload's victim is: Wildfire needs the fire to
    // actually reach health before it will consume anything.
    const { state, foe } = dosed(['spore_cloud', 'flame_surge'], 0);
    const cloud = handCard(state, 'player', 'spore_cloud');
    const dosedState = run(state, play(cloud, atTile(2, 1))).state;
    expect(dosedState.units[foe.id]!.statuses.toxin).toBe(2);

    // Now light it. Fire on Toxin burns every stack for 2 damage each to the neighbours.
    const torch = handCard(dosedState, 'player', 'flame_surge');
    const res = run(
      dosedState,
      play(torch, { kind: 'line', from: { x: 2, y: 2 }, dir: { x: 0, y: -1 } }),
    );

    const fired = eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction);
    expect(fired).toContain('wildfire');
    expect(res.state.units[foe.id]?.statuses.toxin, 'every stack, not one').toBeFalsy();
  });
});

describe('Creeping Briar', () => {
  it('cannot move, ever', () => {
    const state = scenario({ width: 6, height: 7 });
    const briar = addUnit(state, { def: 'creeping_briar', side: 'player', at: { x: 2, y: 4 } });

    expect(state.units[briar.id]!.mov).toBe(0);
    expect(legalMoves(state, state.units[briar.id]!), 'nowhere to go').toEqual([]);
  });

  it('is refused as an illegal command, not silently ignored', () => {
    const state = scenario({ width: 6, height: 7 });
    const briar = addUnit(state, { def: 'creeping_briar', side: 'player', at: { x: 2, y: 4 } });

    expect(() =>
      run(state, { type: 'moveUnit', unit: briar.id, to: { x: 2, y: 3 } }),
    ).toThrow();
  });

  it('no longer grows on its own — that is what an Aura is for now', () => {
    // It used to pay for standing still with free Escalation. Growth is the enemy's clock
    // now, so a Briar that wants to get bigger has to be enchanted like anything else.
    const state = scenario({ width: 6, height: 7 });
    const briar = addUnit(state, {
      def: 'creeping_briar',
      side: 'player',
      at: { x: 2, y: 4 },
      fresh: false,
    });
    const atkBefore = state.units[briar.id]!.atk;

    let cur = run(state, { type: 'endTurn' }).state;
    const res = run(cur, { type: 'endTurn' });

    expect(res.state.units[briar.id]!.atk).toBe(atkBefore);
    expect(res.state.units[briar.id]!.escalation).toBe(0);
  });

  it('still attacks what walks into reach', () => {
    const state = scenario({ width: 6, height: 7 });
    const briar = addUnit(state, {
      def: 'creeping_briar',
      side: 'player',
      at: { x: 2, y: 4 },
      fresh: false,
    });
    const foe = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 3 }, hp: 9 });

    const res = run(state, {
      type: 'attack',
      attacker: briar.id,
      target: { kind: 'unit', id: foe.id },
    });

    expect(damageTo(res.events, foe.id)).toBeGreaterThan(0);
  });
});

describe('Voltara', () => {
  const voltara = () => companionById('voltara')!;

  it('is on the roster with a body of her own', () => {
    expect(voltara().school).toBe('surge');
    expect(CARDS[voltara().unitCardId]).toBeDefined();
    expect(CARDS[voltara().unitCardId]!.keywords).toContain('BoundForm');
    expect(CARDS[voltara().unitCardId]!.setupOnly).toBe(true);
  });

  it('brings a legal deck', () => {
    // Every companion deck is offered as-is to a new player, so an illegal one would be
    // a character that cannot take a contract.
    const owned = startingCollection().owned;
    for (const companion of COMPANIONS) {
      // `validateDeck` returns the problems, so an empty array is the whole assertion —
      // and a failure prints what was actually wrong rather than a bare count.
      expect(validateDeck(companion.deck, { owned }), companion.name).toEqual([]);
    }
  });

  it('never packs more copies than the tier allows', () => {
    const counts = new Map<string, number>();
    for (const id of voltara().deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      expect(n, id).toBeLessThanOrEqual(TIER_COPY_LIMIT[tierOf(CARDS[id]!)]);
    }
  });

  it('has a bloodline to roll from, like every other species', () => {
    // `tameCompanion` picks from this pool. A species with fewer than two would make the
    // taming roll a formality and hand every one of them the same knack.
    for (const species of COMPANIONS) {
      expect(traitsFor(species.id).length, species.name).toBeGreaterThan(1);
    }
    for (const trait of traitsFor('voltara')) {
      expect(COMPANION_TRAITS[trait.id]!.baseId).toBe('voltara');
      expect(Object.keys(trait.boons), trait.name).not.toContain('damage');
    }
  });

  it('opens a fight on her own body, not on somebody else’s', () => {
    const { state } = createCombat(NOVICE_DUELIST, 7, 'voltara');
    expect(state.players.player.companionSchool).toBe('surge');
    expect(state.players.player.companionUnitDefId).toBe('voltara_bound');
  });
});

describe('Storm Tithe', () => {
  it('is the Surge school’s passive', () => {
    expect(resonanceFor('surge')).toBe(RESONANCE.surge);
    expect(RESONANCE.surge!.name).toBe('Storm Tithe');
  });

  /** A Voltara board with one Companion card in hand. */
  const board = (hand: string[]) => {
    const state = scenario({ width: 6, height: 7, hand, pips: 6 });
    state.players.player.companionSchool = 'surge';
    const body = addUnit(state, {
      def: 'voltara_bound',
      side: 'player',
      at: { x: 2, y: 4 },
      titheBonus: 0,
    });
    state.players.player.companionUnitId = body.id;
    state.players.player.companionUnitDefId = 'voltara_bound';
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 9 });
    return { state, body };
  };

  it('pays a Pip back on the first Companion card', () => {
    const { state } = board(['static_arc']);
    const before = state.players.player.pips;
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 3)));

    const tithe = eventsOf(res.events, 'pipRefunded').filter((e) => e.reaction === 'storm_tithe');
    expect(tithe.length).toBe(1);
    expect(tithe[0]!.amount).toBe(REACTION_PIP_REFUND);
    // Static Arc costs 1 and the tithe pays 1, so the first cast each turn is free.
    expect(res.state.players.player.pips).toBe(before);
  });

  it('lands the label on the Companion, where the player is looking', () => {
    const { state, body } = board(['static_arc']);
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 3)));

    const tithe = eventsOf(res.events, 'pipRefunded').find((e) => e.reaction === 'storm_tithe')!;
    expect(tithe.at).toEqual(state.units[body.id]!.anchor);
  });

  it('fires once a turn, not once a card', () => {
    const { state } = board(['static_arc', 'static_arc']);
    const first = handCard(state, 'player', 'static_arc');
    const afterFirst = run(state, play(first, atTile(2, 3))).state;
    const second = handCard(afterFirst, 'player', 'static_arc');

    const res = run(afterFirst, play(second, atTile(4, 3)));

    expect(eventsOf(res.events, 'pipRefunded').filter((e) => e.reaction === 'storm_tithe')).toEqual(
      [],
    );
  });

  it('does not spend the reaction budget it sits beside', () => {
    // The whole point of the split: the tithe must leave both reaction refunds available,
    // or the Surge companion would pay for its own passive out of the reactions it exists
    // to set up.
    const { state } = board(['static_arc']);
    const card = handCard(state, 'player', 'static_arc');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.players.player.reactionPipsThisTurn).toBe(0);
  });
});

describe('the Reaction matrix, as content', () => {
  /** Every op in an effect tree, `seq` flattened. */
  const ops = (node: EffectNode): EffectNode[] =>
    node.op === 'seq' ? [node, ...node.effects.flatMap(ops)] : [node];

  const playable = () => Object.values(CARDS).filter(isObtainable);

  /** Statuses a real, obtainable card can put on something. */
  const appliableStatuses = (): Set<string> => {
    const out = new Set<string>();
    for (const def of playable()) {
      for (const node of ops(def.effect)) {
        if (node.op === 'applyStatus') out.add(node.status);
      }
    }
    // Chill is not the only route to Frozen — it *is* the route. Three stacks freeze the
    // target instead of stacking again, so a deck that can Chill can reach Shatter.
    if (out.has('chill')) out.add('freeze');
    return out;
  };

  /** Damage types a real, obtainable card can deal. */
  const dealableTypes = (): Set<string> => {
    const out = new Set<string>();
    for (const def of playable()) {
      for (const node of ops(def.effect)) {
        if (node.op === 'damage' || node.op === 'cleaveFront') out.add(node.dtype);
      }
    }
    return out;
  };

  it('has a card for every half of every reaction', () => {
    // The point of this wave. Before it, `charged` and `toxin` had no source at all, so
    // Overload, Superconduct and Wildfire were rules nothing could reach — code that
    // could not be played rather than content. This fails the moment that is true again.
    const statuses = appliableStatuses();
    const types = dealableTypes();

    for (const reaction of REACTIONS) {
      // Both halves have to be reachable, but a reaction's *priming* half is whichever
      // gate it uses: a status on the body for most, the sky for Arc.
      if (reaction.requires) {
        expect(
          statuses.has(reaction.requires),
          `${reaction.name}: nothing applies ${reaction.requires}`,
        ).toBe(true);
      }
      expect(
        reaction.requires ?? reaction.requiresWeather,
        `${reaction.name}: gates on nothing, so it would fire on every hit of its type`,
      ).toBeDefined();
      expect(
        reaction.triggers.some((t) => types.has(t)),
        `${reaction.name}: no card deals ${reaction.triggers.join(' or ')}`,
      ).toBe(true);
    }
  });

  /**
   * Weather-gated reactions need a fight actually *had* in that weather.
   *
   * Kept apart from the card-coverage test above because it fails for a different reason
   * and is fixed in a different file: no card can make it pass, only an encounter can.
   *
   * `KNOWN_UNREACHABLE` is a ledger, not an exemption. A reaction listed here is formal,
   * tested, and unplayable — and the assertion runs in *both* directions, so the gap
   * cannot be forgotten and closing it cannot go unrecorded.
   */
  const KNOWN_UNREACHABLE = new Set(['arc']);

  it('knows which weather no encounter provides', () => {
    const skies = new Set(ENCOUNTERS.map((e) => e.weather?.kind).filter(Boolean));

    for (const reaction of REACTIONS) {
      if (!reaction.requiresWeather) continue;
      const reachable = skies.has(reaction.requiresWeather);

      if (KNOWN_UNREACHABLE.has(reaction.id)) {
        expect(
          reachable,
          `${reaction.name} is reachable now — take it out of KNOWN_UNREACHABLE`,
        ).toBe(false);
      } else {
        expect(
          reachable,
          `${reaction.name}: no encounter is fought in ${reaction.requiresWeather}`,
        ).toBe(true);
      }
    }
  });

  it('reaches Frozen the long way, through Chill', () => {
    // Guards the shortcut above: if Chill ever stopped freezing, the claim that Shatter
    // is reachable would quietly become false and the test above would still pass.
    expect(CHILL_TO_FREEZE).toBeGreaterThan(0);

    const state = scenario({ width: 6, height: 7 });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 2 }, hp: 12 });
    for (let i = 0; i < CHILL_TO_FREEZE; i++) {
      applyStatusTo({ state, events: [] } as never, state.units[foe.id]!, 'chill', 1);
    }

    expect(state.units[foe.id]!.statuses.freeze).toBeGreaterThan(0);
    expect(findReaction('physical', state.units[foe.id]!.statuses)?.id).toBe('shatter');
  });
});
