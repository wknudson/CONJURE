import { describe, expect, it } from 'vitest';
import { addUnit, handCard, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import {
  COMPANION_TRAITS,
  TRAIT_LINEAGE,
  declaredTraitsFor,
  traitsFor,
} from '../core/data/companionTraits.js';
import { HYBRID_HYBRID_CHANCE, MONO_HYBRID_CHANCE } from '../core/data/grimoire.js';
import { resonanceFor } from '../core/data/resonance.js';
import { validateDeck } from '../core/data/deckRules.js';
import { startingCollection } from '../core/data/collection.js';
import { createCombat, type CombatBoons } from '../core/engine/setup.js';
import { carryFor } from '../core/overworld/run.js';
import { tameCompanion, type CompanionInstance } from '../core/overworld/vivarium.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';
import { makeRng } from '../core/util/rng.js';
import { coordKey, type Coord } from '../contract/ids.js';
import { hasLoS } from '../core/engine/los.js';
import { applyStatusTo, startOfTurnStatuses } from '../core/engine/status.js';
import { pushUnit } from '../core/engine/displacement.js';
import { makeCtx } from '../core/engine/context.js';
import { prepareReaction } from '../core/engine/reactions.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';

/**
 * The ten hybrid Companion bloodlines, and the eleven knacks that are actually wired.
 *
 * The interesting half of this file is the second half. Twenty traits were designed and
 * eleven of them map onto capabilities the engine has; the other nine name mechanics it
 * does not (Echo, Pierce, Frail, Hollow, Devour, damage reflection). Those carry
 * `pending`, and the tests below exist to make sure a `pending` trait can never reach a
 * player — a knack that rolls and then does nothing is a bug somebody spends a run trying
 * to reproduce, which is strictly worse than a gap somebody can read about.
 */

/**
 * Every bloodline that draws on two schools.
 *
 * Named `BLOODLINES` rather than `BLOODLINES` because `hybrids.test.ts` next door already
 * owns that word for the *cards* the splicing bench presses. Two different things called
 * a hybrid is the game's own ambiguity, not this file's, but the two test files should at
 * least not both answer to the same name.
 */
const BLOODLINES = Object.keys(TRAIT_LINEAGE);

const character = (): GlobalGameState => ({ overworld: newRun(1), combat: null });

/** A character standing beside a beast of the given bloodline, wearing the given knack. */
const withKnack = (baseId: string, traitId: string) => {
  const g = character();
  const beast: CompanionInstance = { ...tameCompanion(makeRng(1), baseId, 1), traitId };
  return { g, beast, carry: carryFor(g.overworld, beast) };
};

describe('the hybrid roster', () => {
  it('registers all fifteen — one per school pairing', () => {
    // Six schools make fifteen pairings, and every one of them is now somebody's. The
    // number is asserted rather than derived on purpose: it is the whole claim of the
    // roster, and deriving it from `TRAIT_LINEAGE` would make this test agree with any
    // mistake made there.
    expect(BLOODLINES).toHaveLength(15);
    for (const id of BLOODLINES) {
      expect(companionById(id), id).toBeDefined();
    }
  });

  it('gives each of them a body of its own', () => {
    for (const id of BLOODLINES) {
      const species = companionById(id)!;
      const body = CARDS[species.unitCardId];
      expect(body, `${id} body`).toBeDefined();
      expect(body!.keywords, id).toContain('BoundForm');
      expect(body!.setupOnly, id).toBe(true);
    }
  });

  it('draws every one of them from two schools, and neither of them twice', () => {
    for (const id of BLOODLINES) {
      const { schools } = companionById(id)!.grimoire;
      expect(schools, id).toHaveLength(2);
      expect(new Set(schools).size, id).toBe(2);
    }
  });

  it('rolls them fusions far more often than a mono bloodline does', () => {
    // The whole point of a two-school beast. `draftGrimoire` has supported this since it
    // was written and had no content for it: every species before these was mono-element,
    // so the hybrid branch was a mechanism nobody could reach.
    for (const id of BLOODLINES) {
      expect(companionById(id)!.grimoire.hybridChance, id).toBe(HYBRID_HYBRID_CHANCE);
    }
    for (const c of COMPANIONS.filter((c) => !BLOODLINES.includes(c.id))) {
      expect(c.grimoire.hybridChance, c.name).toBe(MONO_HYBRID_CHANCE);
    }
    expect(HYBRID_HYBRID_CHANCE).toBeGreaterThan(MONO_HYBRID_CHANCE);
  });

  it('names a school whose Resonance actually exists', () => {
    // A hybrid inherits one parent's passive, because Resonance is keyed by school and a
    // Companion carries exactly one. Whichever it named has to be a school that has one.
    for (const id of BLOODLINES) {
      const species = companionById(id)!;
      expect(resonanceFor(species.school), species.name).toBeDefined();
      expect(species.grimoire.schools, species.name).toContain(species.school);
    }
  });

  it('brings a legal deck and a full Grimoire, like everyone else', () => {
    const { unlocked } = startingCollection();
    for (const id of BLOODLINES) {
      const species = companionById(id)!;
      expect(validateDeck(species.deck, { unlocked }), species.name).toEqual([]);
      expect(species.legacyGrimoire, species.name).toHaveLength(8);
      for (const card of species.legacyGrimoire!) {
        expect(CARDS[card], `${species.name}: ${card}`).toBeDefined();
      }
    }
  });

  it('opens a fight standing on the body it named', () => {
    for (const id of BLOODLINES) {
      const species = companionById(id)!;
      const { state } = createCombat(NOVICE_DUELIST, 7, id);
      expect(state.players.player.companionUnitDefId, id).toBe(species.unitCardId);
      expect(state.players.player.companionSchool, id).toBe(species.school);
    }
  });
});

describe('the taming roll', () => {
  it('gives every hybrid something worth rolling', () => {
    // Not a formality: three of these have *zero* wired knacks of their own, because all
    // four of their briefed traits need engine work first. Lineage is what keeps the roll
    // meaningful anyway.
    for (const id of BLOODLINES) {
      expect(traitsFor(id).length, id).toBeGreaterThan(1);
    }
  });

  it('never hands a player a knack that does nothing', () => {
    for (const species of COMPANIONS) {
      for (const trait of traitsFor(species.id)) {
        expect(trait.pending, `${species.name} can roll ${trait.name}`).toBeUndefined();
        expect(Object.keys(trait.boons).length, trait.name).toBeGreaterThan(0);
      }
    }
  });

  it('rolls only from its own pool and its two parents', () => {
    for (const id of BLOODLINES) {
      const allowed = new Set([id, ...TRAIT_LINEAGE[id]!]);
      for (const trait of traitsFor(id)) {
        expect(allowed.has(trait.baseId), `${id} rolled ${trait.name}`).toBe(true);
      }
    }
  });

  it('has built every knack it declared', () => {
    // Every hybrid was briefed two traits. `declaredTraitsFor` is the Field Journal's
    // question — what did we design — and `traitsFor` is the roll's; the two agree now.
    for (const id of BLOODLINES) {
      expect(declaredTraitsFor(id), id).toHaveLength(2);
      expect(traitsFor(id).filter((t) => t.baseId === id), `${id}'s own knacks`).toHaveLength(2);
    }
    // Nine knacks were declared and not built for a year of the file's life — Echo, Frail,
    // Pierce, Devour, reflection, and two that scaled a printed number. Each was either
    // built as designed or rewritten to a capability the engine can express in the same
    // flavour (2026-09-03). The field stays on the type so the next IOU has somewhere to be
    // written down; today nothing owes one.
    const pending = Object.values(COMPANION_TRAITS).filter((t) => t.pending);
    expect(pending.map((t) => t.id)).toEqual([]);
    for (const trait of Object.values(COMPANION_TRAITS)) {
      expect(Object.keys(trait.boons).length, `${trait.name} does nothing`).toBeGreaterThan(0);
    }
  });

  it('actually reaches one, given seeds', () => {
    // `tameCompanion` is the Vivarium's roll. If a bloodline's pool were empty this would
    // hand back an empty `traitId`, which is the failure this whole file is about.
    for (const id of BLOODLINES) {
      const rolled = new Set(
        Array.from({ length: 30 }, (_, i) => tameCompanion(makeRng(i + 1), id, 1).traitId),
      );
      expect(rolled.has(''), id).toBe(false);
      expect(rolled.size, `${id} variance`).toBeGreaterThan(1);
      for (const traitId of rolled) {
        expect(COMPANION_TRAITS[traitId]?.pending, `${id} rolled ${traitId}`).toBeUndefined();
      }
    }
  });
});

/**
 * The twelve wired knacks, one test each at the chokepoint the boon is read.
 *
 * Deliberately at the engine seam rather than through a card: what is being checked is
 * that the capability exists and is read off the right side, and a card play would put
 * targeting and cost between the assertion and the rule.
 */
describe('the wired knacks', () => {
  it('Heavy Tread grounds the whole line, its own tools included', () => {
    const moved = (grounded: boolean): Coord => {
      const state = scenario({ width: 6, height: 8 });
      const ally = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
      state.players.player.alliesGrounded = grounded;
      pushUnit(makeCtx(state), state.units[ally.id]!, { x: 0, y: -1 }, 1);
      return state.units[ally.id]!.anchor;
    };
    expect(moved(true), 'grounded').toEqual({ x: 2, y: 4 });
    expect(moved(false), 'ungrounded').toEqual({ x: 2, y: 3 });
  });

  it('Magma Plating is bracing rather than armour', () => {
    // The Ferrum knack's capability, reached from a second direction. They stack, and the
    // engine did not have to learn a new word for either.
    expect(withKnack('tortoise', 'magma_plating').carry.boons?.collisionResist).toBe(20);
  });

  it('Shrapnel Guard takes the splash and not the strip', () => {
    const splashed = (guarded: boolean) => {
      const state = scenario({ width: 6, height: 8 });
      const frozen = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 3, y: 3 },
        armor: 30,
      });
      frozen.statuses.freeze = 1;
      const bystander = addUnit(state, {
        def: 'grave_sentinel',
        side: 'player',
        at: { x: 4, y: 3 },
      });
      const striker = addUnit(state, {
        def: 'vanguard_footman',
        side: 'player',
        at: { x: 3, y: 4 },
      });
      state.players.player.immuneToShatterSplash = guarded;

      const after = run(state, {
        type: 'attack',
        attacker: striker.id,
        target: { kind: 'unit', id: frozen.id },
      }).state;
      return {
        hurt: (after.units[bystander.id]?.hp ?? 0) < bystander.hp,
        armor: after.units[frozen.id]?.armor ?? 0,
      };
    };

    expect(splashed(false).hurt, 'unguarded').toBe(true);
    expect(splashed(true).hurt, 'guarded').toBe(false);
    // Scoped to the splash: this is plate against flying ice, and it has nothing to say
    // about the armor Shatter takes off its host.
    expect(splashed(true).armor, 'host still stripped').toBe(0);
  });

  it('Dense Ice buys a Freeze one more turn of decay', () => {
    for (const [dense, want] of [
      [0, 1],
      [1, 2],
    ] as const) {
      const state = scenario({ width: 6, height: 8 });
      const victim = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
      state.players.player.bonusFreezeStacks = dense;
      applyStatusTo(makeCtx(state), state.units[victim.id]!, 'chill', 3, 'player');
      expect(state.units[victim.id]!.statuses.freeze, `dense=${dense}`).toBe(want);
    }
  });

  it('attributes Dense Ice to whoever cast the cold, not to the clock', () => {
    // The exact bug `toxinBonus` documents at length: a trap you laid springs on the
    // enemy's turn, so a rule read off `activeSide` collects for the wrong commander.
    const state = scenario({ width: 6, height: 8 });
    const victim = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    state.players.player.bonusFreezeStacks = 1;
    state.activeSide = 'enemy';
    applyStatusTo(makeCtx(state), state.units[victim.id]!, 'chill', 3, 'player');
    expect(state.units[victim.id]!.statuses.freeze).toBe(2);
  });

  it('Magnetic Repulsion lengthens a card shove and leaves a current alone', () => {
    expect(withKnack('dynamo', 'magnetic_repulsion').carry.boons?.bonusShoveDistance).toBe(1);

    // Shield Bash shoves one tile. Under the knack it shoves two, out of the same card.
    const bashed = (bonus: number) => {
      const state = scenario({ width: 6, height: 9, hand: ['shield_bash'], bones: 8 });
      const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
      state.players.player.bonusShoveDistance = bonus;
      const card = handCard(state, 'player', 'shield_bash');
      const after = run(state, {
        type: 'playCard',
        card,
        target: { kind: 'entity', ref: { kind: 'unit', id: foe.id } },
      }).state;
      return after.units[foe.id]?.anchor;
    };
    expect(bashed(0), 'printed').toEqual({ x: 2, y: 2 });
    expect(bashed(1), 'repulsed').toEqual({ x: 2, y: 1 });

    // The rule is deliberately *not* inside `pushUnit`: a current at the round boundary is
    // the board moving a body, not the player moving it.
    const state = scenario({ width: 6, height: 8 });
    const drift = addUnit(state, { def: 'vanguard_footman', side: 'player', at: { x: 2, y: 4 } });
    state.players.player.bonusShoveDistance = 3;
    pushUnit(makeCtx(state), state.units[drift.id]!, { x: 0, y: -1 }, 1);
    expect(state.units[drift.id]!.anchor).toEqual({ x: 2, y: 3 });
  });

  it('Fog-Stalker hides a body in steam, and goggles find it again', () => {
    const state = scenario({ width: 6, height: 8 });
    addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 3 } });
    state.hazards[coordKey({ x: 3, y: 3 })] = {
      at: { x: 3, y: 3 },
      kind: 'steam_fog',
      turns: 2,
      owner: 'player',
    };

    const shot = () => hasLoS(state, { x: 3, y: 6 }, { x: 3, y: 3 }, [], 'enemy');
    expect(shot(), 'plain fog screens but does not hide').toBe(true);

    state.players.player.fogConceals = true;
    expect(shot(), 'concealed').toBe(false);

    // The two rules answer each other rather than stacking into "nobody shoots anybody".
    state.players.enemy.ignoresFog = true;
    expect(shot(), 'goggles').toBe(true);
  });

  it('Boiling Point scalds whoever begins a turn in enemy steam', () => {
    const state = scenario({ width: 6, height: 8 });
    const victim = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 3 } });
    state.hazards[coordKey({ x: 3, y: 3 })] = {
      at: { x: 3, y: 3 },
      kind: 'steam_fog',
      turns: 3,
      owner: 'enemy',
    };
    state.players.enemy.steamBurns = 10;

    // `addUnit` hands back the live object, so this has to be a copy of the number.
    const before = victim.hp;
    startOfTurnStatuses(makeCtx(state), 'player');
    expect(before - state.units[victim.id]!.hp, 'scalded').toBe(10);
  });

  it('does not let Boiling Point cook its own side', () => {
    const state = scenario({ width: 6, height: 8 });
    const owner = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 3 } });
    state.hazards[coordKey({ x: 3, y: 3 })] = {
      at: { x: 3, y: 3 },
      kind: 'steam_fog',
      turns: 3,
      owner: 'player',
    };
    state.players.player.steamBurns = 10;

    const before = owner.hp;
    startOfTurnStatuses(makeCtx(state), 'player');
    expect(state.units[owner.id]!.hp).toBe(before);
  });

  it('Conductive Ice lets rime answer a reaction that asked for a charge', () => {
    for (const conducts of [false, true]) {
      const state = scenario({ width: 6, height: 8 });
      const victim = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 3, y: 3 },
        armor: 30,
      });
      victim.statuses.chill = 1;
      state.players.player.chillConducts = conducts;

      const { pending } = prepareReaction(makeCtx(state), state.units[victim.id]!, 'frost');
      expect(pending?.def.id, `conducts=${conducts}`).toBe(conducts ? 'superconduct' : undefined);

      if (conducts) {
        // It spends the cold it actually ran through, not the charge it borrowed the name
        // of — and it never writes a `charged` stack onto a body that had none.
        expect(state.units[victim.id]!.statuses.chill, 'chill spent').toBeUndefined();
        expect(state.units[victim.id]!.statuses.charged, 'no phantom charge').toBeUndefined();
      }
    }
  });

  it('carries every wired hybrid knack through to the fight', () => {
    // The plumbing test, and the one that would actually have caught a mistake here. A
    // boon added to `CombatBoons` and forgotten in `carryFor` is completely silent: the
    // trait rolls, the Field Journal prints its text, and the fight never hears about it.
    let checked = 0;
    for (const id of BLOODLINES) {
      for (const trait of traitsFor(id).filter((t) => t.baseId === id)) {
        const { carry } = withKnack(id, trait.id);
        for (const [key, value] of Object.entries(trait.boons)) {
          expect(carry.boons?.[key as keyof CombatBoons], `${trait.name}.${key}`).toEqual(value);
          checked += 1;
        }
      }
    }
    // Counts boon *entries*, not traits — a knack granting two boons contributes two. Rose
    // from 11 when the five closing hybrids arrived with ten wired knacks between them, and
    // to 33 when the nine pending knacks were built (2026-09-03): every hybrid's two, wired.
    expect(checked, 'wired hybrid knacks').toBe(33);
  });

  it('opens a fight with the knack already switched on', () => {
    // End to end: a tamed Obsidian Tortoise wearing Heavy Tread produces a commander that
    // the displacement chokepoint will actually refuse to shove.
    const { carry } = withKnack('tortoise', 'heavy_tread');
    const { state } = createCombat(NOVICE_DUELIST, 7, 'tortoise', undefined, carry);
    expect(state.players.player.alliesGrounded).toBe(true);
    expect(state.players.enemy.alliesGrounded, 'not the other side').toBe(false);
  });
});
