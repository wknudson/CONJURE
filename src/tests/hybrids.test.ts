import { describe, expect, it } from 'vitest';
import { addUnit, atTile, damageTo, eventsOf, handCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { HYBRID_CARDS } from '../core/data/cards/hybrid.js';
import { REAGENTS, SPLICE_RECIPES, recipeFor, spliceableBaseIds } from '../core/data/splicing.js';
import { spliceCard, spliceRefusal } from '../core/overworld/splice.js';
import { isObtainable } from '../core/data/collection.js';
import { tierOf } from '../core/data/deckRules.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';

/**
 * The splicing bench's output.
 *
 * Every hybrid is `spliceOnly`, which is the property that keeps the Forge a sink: a
 * reward roll or a Schematic that handed one over would be giving away for free the exact
 * thing the bench exists to charge for. Most of what follows is about that guard, about
 * the recipes actually resolving, and about the two engine seams the Defibrillator needs.
 */

const HYBRIDS = Object.keys(HYBRID_CARDS);

const bench = (unlocked: string[], reagents: Record<string, number>) => {
  const overworld = newRun(1);
  overworld.economy.reagents = { ...reagents };
  const global: GlobalGameState = { overworld, combat: null };
  return { global, collection: { unlocked: [...unlocked] } };
};

describe('the book', () => {
  it('never lets two rows claim the same pressing', () => {
    // `recipeFor` takes the first match, so a duplicate pairing would make the later row
    // unreachable — a card in the registry no amount of play could produce. The data
    // module throws on load; this is the same rule, said out loud.
    const seen = new Set<string>();
    for (const r of SPLICE_RECIPES) {
      const key = `${r.baseCardId}+${r.catalystId}`;
      expect(seen.has(key), `duplicate pressing: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('names only cards that exist, both in and out', () => {
    for (const r of SPLICE_RECIPES) {
      expect(CARDS[r.baseCardId], `base ${r.baseCardId}`).toBeDefined();
      expect(CARDS[r.resultId], `result ${r.resultId}`).toBeDefined();
      expect(REAGENTS.some((x) => x.id === r.catalystId), `core ${r.catalystId}`).toBe(true);
    }
  });

  it('gives every reagent something to press', () => {
    // A core that no recipe takes is a reward the player can earn and never spend. The
    // Pyre Core was exactly that until Cryo-Combustion existed.
    for (const reagent of REAGENTS) {
      const uses = SPLICE_RECIPES.filter((r) => r.catalystId === reagent.id);
      expect(uses.length, `${reagent.name} presses nothing`).toBeGreaterThan(0);
    }
  });

  it('only ever produces a spliceOnly card', () => {
    for (const r of SPLICE_RECIPES) {
      expect(CARDS[r.resultId]!.spliceOnly, r.resultId).toBe(true);
    }
  });

  it('offers every base the book knows', () => {
    for (const r of SPLICE_RECIPES) {
      expect(spliceableBaseIds()).toContain(r.baseCardId);
    }
  });
});

describe('the hybrids as cards', () => {
  it('are all kept out of the loot pool', () => {
    // The whole reason `spliceOnly` exists. Free access to a sink's output is the sink
    // not existing.
    for (const id of HYBRIDS) {
      expect(CARDS[id]!.spliceOnly, id).toBe(true);
      expect(isObtainable(CARDS[id]!), `${id} leaked into the loot pool`).toBe(false);
    }
  });

  it('derives its tiers rather than declaring them', () => {
    // All three total 3, which `tierOf` reads as Tier 2 — the same tier the two older
    // hybrids land on. Two copies apiece, and each copy costs a card and a core.
    expect(tierOf(CARDS.cryo_combustion!)).toBe(2);
    expect(tierOf(CARDS.galvanic_spores!)).toBe(2);
    expect(tierOf(CARDS.aetheric_defibrillator!)).toBe(2);
  });

  it('is cast from the Companion, so its reach is real', () => {
    for (const id of HYBRIDS) {
      expect(CARDS[id]!.source, id).toBe('companion');
      expect(CARDS[id]!.range, id).toBeGreaterThan(0);
    }
  });
});

describe('pressing them', () => {
  const press = (base: string, core: string) => {
    const { global, collection } = bench([base], { [core]: 1 });
    return { global, result: spliceCard(global, collection, base, core) };
  };

  it('turns a Glacial Spike and a Pyre Core into Cryo-Combustion', () => {
    const { global, result } = press('glacial_spike', 'core_pyre');
    expect(result?.resultId).toBe('cryo_combustion');
    expect(result?.collection.unlocked).toContain('cryo_combustion');
    expect(result?.collection.unlocked, 'and the base is kept').toContain('glacial_spike');
    expect(global.overworld.economy.reagents.core_pyre, 'and so is the core').toBeUndefined();
  });

  it('turns a Spore Cloud and a Surge Core into Galvanic Spores', () => {
    expect(press('spore_cloud', 'core_surge').result?.resultId).toBe('galvanic_spores');
  });

  it('turns a Dark Tithe and a Surge Core into an Aetheric Defibrillator', () => {
    expect(press('dark_tithe', 'core_surge').result?.resultId).toBe('aetheric_defibrillator');
  });

  it('refuses a pairing the book has never heard of', () => {
    const { global, collection } = bench(['glacial_spike'], { core_frost: 1 });
    expect(spliceRefusal(global, collection, 'glacial_spike', 'core_frost')).toBe('no-recipe');
    expect(recipeFor('glacial_spike', 'core_frost')).toBeUndefined();
  });

  it('charges nothing for a refusal', () => {
    const { global, collection } = bench(['glacial_spike'], {});
    expect(spliceCard(global, collection, 'glacial_spike', 'core_pyre')).toBeNull();
    expect(collection.unlocked, 'still unlocked').toContain('glacial_spike');
  });
});

describe('Cryo-Combustion', () => {
  const aimed = (statuses: Record<string, number> = {}) => {
    const state = scenario({ width: 6, height: 8, hand: ['cryo_combustion'], pips: 8 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 }, hp: 14 });
    Object.assign(state.units[foe.id]!.statuses, statuses);
    return { state, foe };
  };

  it('lands its impact and then sets the target alight', () => {
    const { state, foe } = aimed();
    const card = handCard(state, 'player', 'cryo_combustion');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));

    expect(damageTo(res.events, foe.id)).toBe(2);
    expect(res.state.units[foe.id]!.statuses.burn).toBe(2);
  });

  it('Shatters a Frozen target, which is what the impact is for', () => {
    const { state, foe } = aimed({ freeze: 1 });
    state.units[foe.id]!.armor = 6;
    const card = handCard(state, 'player', 'cryo_combustion');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('shatter');
    expect(res.state.units[foe.id]!.armor, 'all of it').toBe(0);
  });

  it('cannot Vaporize on the cast, because Burn is a status and not a hit', () => {
    // Worth pinning, because it is the obvious thing to assume. Reactions are evaluated
    // inside `dealDamage`; applying a status is not damage, so the flame this card leaves
    // sets nothing off at the moment it is applied. The `impact` half is not a fire type,
    // so it does not either.
    const { state, foe } = aimed({ chill: 1 });
    const card = handCard(state, 'player', 'cryo_combustion');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } }));

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).not.toContain(
      'vaporize',
    );
    expect(res.state.units[foe.id]!.statuses.chill, 'the chill is still there').toBe(1);
  });

  it('Vaporizes on the tick instead — the fire it left is real fire', () => {
    // The status tick deals `fire` damage, and it runs *before* Chill decays in the same
    // start-of-turn order. So the reaction lands a turn later, on the victim's own turn,
    // which is the honest reading of what this card does to a Chilled target.
    const { state, foe } = aimed({ chill: 1 });
    const card = handCard(state, 'player', 'cryo_combustion');
    const burning = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: foe.id } })).state;

    const res = run(burning, { type: 'endTurn' });

    expect(eventsOf(res.events, 'reactionTriggered').map((e) => e.reaction)).toContain('vaporize');
  });
});

describe('Galvanic Spores', () => {
  it('lays both fuses on the same cross', () => {
    const state = scenario({ width: 6, height: 8, hand: ['galvanic_spores'], pips: 8, marrow: 4 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const north = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 9 });
    const corner = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 9 });
    const card = handCard(state, 'player', 'galvanic_spores');

    const res = run(state, play(card, atTile(2, 3)));

    expect(res.state.units[north.id]!.statuses.charged).toBe(1);
    expect(res.state.units[north.id]!.statuses.toxin).toBe(1);
    expect(res.state.units[corner.id]!.statuses.charged, 'diagonals spared').toBeUndefined();
  });

  it('does not out-poison the card it was pressed from', () => {
    // A hybrid that beat its base at the base's own job would make the base pointless.
    const spores = CARDS.galvanic_spores!.effect as { op: 'seq'; effects: { stacks?: number }[] };
    const toxin = spores.effects.find((e) => (e as { status?: string }).status === 'toxin');
    expect(toxin?.stacks).toBeLessThan(2);
  });
});

describe('Aetheric Defibrillator', () => {
  const withOffering = () => {
    const state = scenario({ width: 6, height: 8, hand: ['aetheric_defibrillator'], pips: 8 });
    addUnit(state, { def: 'ignis_bound', side: 'player', at: { x: 2, y: 5 }, titheBonus: 0 });
    const offering = addUnit(state, {
      def: 'marrow_wisp',
      side: 'player',
      at: { x: 3, y: 6 },
      fresh: false,
    });
    return { state, offering, at: { ...state.units[offering.id]!.anchor } };
  };

  it('stands a revenant on the ground it just emptied', () => {
    // The seam under test: `sacrificeTarget` remembers the tile, `summon` falls back to
    // it. An entity-targeted card carries no tile of its own, so without the handoff the
    // sacrifice would happen and nothing would take its place.
    const { state, offering, at } = withOffering();
    const card = handCard(state, 'player', 'aetheric_defibrillator');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: offering.id } }));

    expect(res.state.units[offering.id], 'the offering is gone').toBeUndefined();
    const raised = eventsOf(res.events, 'unitSummoned')[0];
    expect(raised, 'something stood up').toBeDefined();
    expect(raised!.unit.anchor).toEqual(at);
    expect(raised!.unit.name).toBe('Galvanic Revenant');
  });

  it('raises a body that can act at once', () => {
    const { state, offering } = withOffering();
    const card = handCard(state, 'player', 'aetheric_defibrillator');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: offering.id } }));
    const id = eventsOf(res.events, 'unitSummoned')[0]!.unit.id;

    expect(res.state.units[id]!.keywords).toContain('Haste');
    expect(res.state.units[id]!.summonedThisTurn).toBe(true);
    // Haste is the exemption `canAct` reads, so a fresh revenant is not exhausted.
    expect(res.state.units[id]!.attackedThisTurn).toBe(false);
  });

  it('pays no Marrow — it converts rather than cashing in', () => {
    const { state, offering } = withOffering();
    const before = state.players.player.marrow;
    const card = handCard(state, 'player', 'aetheric_defibrillator');

    const res = run(state, play(card, { kind: 'entity', ref: { kind: 'unit', id: offering.id } }));

    expect(res.state.players.player.marrow).toBe(before);
  });

  it('keeps the revenant out of every pool it could leak into', () => {
    const revenant = CARDS.galvanic_revenant!;
    expect(revenant.setupOnly).toBe(true);
    expect(isObtainable(revenant)).toBe(false);
    expect(revenant.unit!.titheBonus ?? 0, 'and it bleeds at no premium').toBe(0);
  });
});
