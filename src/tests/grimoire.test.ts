import { describe, expect, it } from 'vitest';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { CARDS, isAscendedId } from '../core/data/cards/index.js';
import {
  HERO_KINDS,
  HERO_SCHOOLS,
  MAX_DECK,
  MIN_DECK,
  TIER_COPY_LIMIT,
  deckRoleRefusal,
  fusedDeckSize,
  remainingCopies,
  tierOf,
  validateDeck,
} from '../core/data/deckRules.js';
import type { GrimoireSource } from '../core/data/grimoire.js';
import { draftGrimoire, hybridPool, isDraftable, purePool } from '../core/data/grimoire.js';
import { STARTER_DECK } from '../core/data/cards/starter.js';
import { rollSpellModifiers, tameCompanion, MODIFIER_CHANCE } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';
import type { CardModifier } from '../core/types/cards.js';
import { toCardSnapshot } from '../core/engine/views.js';
import { applyCommand } from '../core/engine/engine.js';
import { addUnit, damageTo, scenario } from './scenario.js';

/**
 * The Fused Grimoire.
 *
 * The deck is two halves now. The Hero half is small, hand-built and colourless; the
 * Companion half is eight fixed spells that arrive at the bell. What a player *chooses*
 * is the utility — what they *catch* is what those eight rolled.
 */

import { GRIMOIRE_SIZE } from '../core/data/companions.js';

describe('the sliding scale', () => {
  it('takes a Hero Deck between four and twelve', () => {
    expect(MIN_DECK).toBe(4);
    expect(MAX_DECK).toBe(12);

    const four = ['shield_bash', 'shield_bash', 'aegis_ward', 'stone_barricade'];
    expect(validateDeck(four)).toEqual([]);
  });

  it('refuses three, and refuses thirteen', () => {
    const filler = (n: number) =>
      Array.from({ length: n }, (_, i) => ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line', 'cull_the_weak'][i % 5]!);
    expect(validateDeck(filler(3)).map((p) => p.code)).toContain('too_small');
    expect(validateDeck(filler(13)).map((p) => p.code)).toContain('too_large');
  });

  it('adds up to a fused deck small enough to know', () => {
    // The reason the Hero half tightened. Twelve plus the beast's eight is twenty, which
    // is a deck where every card is one you meet and every cut is one you miss.
    expect(fusedDeckSize(MAX_DECK)).toBe(20);
    expect(fusedDeckSize(MIN_DECK)).toBe(12);
  });

  it('names a Spell as a Spell, not as the wrong colour', () => {
    // This used to expect `off_school`, and the change is the whole point of the overhaul.
    // A Spell is elemental *by construction* now, so "your Flame Surge is Pyre" is true,
    // useless, and sends the player hunting for an arcane one that cannot exist. What is
    // wrong with it is its role, and the colour is only how you can tell.
    const problems = validateDeck([...STARTER_DECK, 'flame_surge']);
    const problem = problems.find((p) => p.code === 'spell_in_deck');

    expect(problem, 'a Spell has no place in a Hero Deck').toBeDefined();
    expect(problem!.cardId).toBe('flame_surge');
    expect(problem!.message).toMatch(/your Companion casts those/);
    expect(problems.map((p) => p.code)).not.toContain('off_school');
  });

  it('still refuses an elemental card that is not a Spell, and says whose job that is', () => {
    // `off_school` survives the overhaul with exactly one way to reach it: a Construct in
    // a school the Hero does not hold. Pyre Pillar is not a Spell, not a body and not a
    // Mark, so nothing above catches it — the colour rule is the only thing that does.
    expect(CARDS['pyre_pillar']!.kind).toBe('obstacle');
    const problem = validateDeck([...STARTER_DECK, 'pyre_pillar']).find(
      (p) => p.code === 'off_school',
    );

    expect(problem, 'Pyre has no place in a Hero Deck').toBeDefined();
    expect(problem!.cardId).toBe('pyre_pillar');
    expect(problem!.message).toMatch(/Companion brings the elements/);
  });

  it('lets a Mark in whatever it detonates for', () => {
    // The exemption, and the reason it is not decoration. A Mark's `school` describes the
    // payload it goes off with, not whose half of the deck it belongs to. Judge it by the
    // colour and the day somebody gives the Cinder Mark its red back is the day the Hero
    // can no longer deck their own trap.
    const mark = CARDS['cinder_mark']!;
    expect(mark.kind).toBe('mark');
    expect(validateDeck([...STARTER_DECK, 'cinder_mark'])).toEqual([]);

    // Not because it happens to be arcane today: prove the *rule* by asking the refusal
    // about a Mark wearing a colour no Hero Deck would otherwise take.
    expect(deckRoleRefusal({ ...mark, school: 'pyre' })).toBeNull();
    expect(deckRoleRefusal({ ...mark, kind: 'obstacle', school: 'pyre' })).toBe('off_school');
  });

  it('offers no copies of a card the deck can never hold', () => {
    // The affordance and the validator read one rule. When they read two, the case lets you
    // click a Spell and the validator then refuses the deck you just built with it.
    expect(remainingCopies([], 'flame_surge', undefined)).toBe(0);
    expect(remainingCopies([], 'grave_sentinel', undefined)).toBe(0);
    expect(remainingCopies([], 'pyre_pillar', undefined)).toBe(0);
    expect(remainingCopies([], 'cinder_mark', undefined)).toBeGreaterThan(0);
    expect(remainingCopies([], 'shield_bash', undefined)).toBeGreaterThan(0);
  });

  it('names a body as a body, not as the wrong colour', () => {
    // A minion is very nearly always elemental too, so the school rule would happily
    // claim it first — and "your Grave Sentinel is Dusk" sends the player looking for a
    // neutral one that does not exist.
    const codes = validateDeck([...STARTER_DECK, 'grave_sentinel']).map((p) => p.code);
    expect(codes).toContain('minion_in_deck');
    expect(codes).not.toContain('off_school');
  });

  it('leaves the shipped Hero Deck legal, and colourless', () => {
    expect(validateDeck(STARTER_DECK)).toEqual([]);
    for (const id of STARTER_DECK) {
      expect(HERO_SCHOOLS, `${id} is ${CARDS[id]!.school}`).toContain(CARDS[id]!.school);
    }
  });

  it('leaves every Companion default legal', () => {
    for (const c of COMPANIONS) {
      expect(validateDeck(c.deck), `${c.name}`).toEqual([]);
    }
  });
});

describe('the Grimoire, as data', () => {
  it('has exactly one bloodline that cannot fill a book on its own, and it is Lexis', () => {
    // This test used to name Voltara and Ferrum, because Surge had three spells to its
    // name and Bulwark two. The catalog expansion closed that, and the test was inverted to
    // assert nobody needed the colourless fallback any more.
    //
    // The role overhaul reopened it for exactly one bloodline, and not by accident.
    // "Spell" now means *elemental* magic; Lexis's school is `arcane`, which is by
    // definition not elemental. An Ink Owl's own shelf holds two Constructs and no Spells
    // at all, so six of its eight come from the fallback every single time.
    //
    // Pinned to Lexis by name rather than relaxed to "some may be thin", because the day a
    // second bloodline joins it, that is a content bug and this has to say so.
    const thin = COMPANIONS.filter((c) => {
      const capacity = purePool(c.grimoire).reduce((n, def) => n + TIER_COPY_LIMIT[tierOf(def)], 0);
      return capacity < GRIMOIRE_SIZE;
    }).map((c) => c.id);

    // Was `['lexis']` -- the arcane bloodline drafted from the Hero Deck's own colour and
    // could never fill eight from it. It has been retired, so the assertion gets to be the
    // stronger one it always wanted to be: nothing on the roster is thin.
    expect(thin, 'a bloodline has gone thin').toEqual([]);
  });

  it('lets every elemental bloodline fill a book out of its own school alone', () => {
    for (const c of COMPANIONS) {
      const capacity = purePool(c.grimoire).reduce((n, def) => n + TIER_COPY_LIMIT[tierOf(def)], 0);
      expect(capacity, `${c.name}`).toBeGreaterThanOrEqual(GRIMOIRE_SIZE);
    }
  });

  it('still deals a full eight when a pool cannot cover it, out of the fallback', () => {
    // The fallback is what stands between a thin pool and a short book. Lexis used to be
    // the live example and has been retired, so the case is made synthetically rather than
    // deleted -- a source drafting a school with almost nothing castable in it. Losing the
    // only exerciser of a safety net is how safety nets rot.
    const thinSource: GrimoireSource = { schools: ['arcane'], hybridChance: 0 };
    for (let seed = 0; seed < 40; seed++) {
      const book = draftGrimoire(makeRng(seed), thinSource, GRIMOIRE_SIZE);
      expect(book.length, `seed ${seed}`).toBe(GRIMOIRE_SIZE);
    }
  });

  it('never drafts the Hero half: no Marks, no Abilities, no bodies', () => {
    // Phase 3, as the thing that would notice it being undone. Asked over every bloodline
    // and over a wide spread of seeds rather than over the pools, because the pools are
    // only two of the three chains a slot can fall down -- the colourless fallback is the
    // third, and it is the one a Mark would sneak back in through now that Marks are
    // filed as arcane.
    for (const c of COMPANIONS) {
      for (let seed = 0; seed < 60; seed++) {
        const book = draftGrimoire(makeRng(seed), c.grimoire, GRIMOIRE_SIZE);
        for (const id of book) {
          const def = CARDS[id]!;
          expect(def.kind, `${c.id} drafted ${id}`).not.toBe('mark');
          expect(def.kind, `${c.id} drafted ${id}`).not.toBe('minion');
          expect(isDraftable(def), `${c.id} drafted ${id}`).toBe(true);
        }
      }
    }
  });

  it('draws its own shelves for Spells and the ground they stand on, nothing else', () => {
    // The pools proper, separately from the fallback. A bloodline's *own* answer to a slot
    // is a Spell or one of its Constructs -- an Ability turning up here would mean a beast
    // had started dealing the player the colourless half they build themselves.
    for (const c of COMPANIONS) {
      for (const def of [...purePool(c.grimoire), ...hybridPool(c.grimoire)]) {
        expect(['spell', 'obstacle'], `${c.id} pool holds ${def.id} (${def.kind})`).toContain(
          def.kind,
        );
      }
    }
  });

  it('agrees with the Hero Deck about who owns every coloured card', () => {
    // The two halves checked against each other rather than each against a list.
    //
    // The claim is deliberately about **coloured** cards, and the first draft of this test
    // got it wrong by asserting no card at all could be in both. Stone Barricade is: it is
    // neutral, so the Hero may deck it, and the colourless fallback may deal it to a beast
    // whose own shelf ran dry. Lexis makes it worse — its school *is* arcane, so the Ink
    // Owl's own pool is cards the Hero can also hold.
    //
    // That overlap is the fallback working, not a leak. What must never overlap is anything
    // wearing a colour: a Pyre card is the Companion's or it is nothing, and the day an
    // elemental Spell becomes Hero-legal this is what says so.
    const colourless = ['neutral', 'arcane'];
    for (const def of Object.values(CARDS)) {
      if (isAscendedId(def.id) || def.setupOnly || def.kind === 'minion') continue;
      if (colourless.includes(def.school)) continue;
      const heroCanHold = deckRoleRefusal(def) === null;
      const beastCanDraft = isDraftable(def) && (def.kind === 'spell' || def.kind === 'obstacle');
      expect(heroCanHold && beastCanDraft, `${def.id} belongs to both halves`).toBe(false);
      expect(heroCanHold || beastCanDraft, `${def.id} belongs to neither half`).toBe(true);
    }
  });

  it('enforces exactly the three roles it advertises', () => {
    // `HERO_KINDS` is the sentence the refusal message promises the player. A list that
    // said one thing while the validator did another would be a rule nobody could learn.
    expect([...HERO_KINDS].sort()).toEqual(['ability', 'mark', 'obstacle']);
    for (const kind of ['ability', 'mark', 'obstacle', 'spell', 'minion'] as const) {
      const sample = Object.values(CARDS).find(
        (d) => d.kind === kind && !isAscendedId(d.id) && HERO_SCHOOLS.includes(d.school),
      );
      if (!sample) continue;
      expect(deckRoleRefusal(sample) === null, `${sample.id} (${kind})`).toBe(
        HERO_KINDS.includes(kind),
      );
    }
  });

  it('never drafts the card the Trial deals itself', () => {
    // Lexis's own school holds the Rite, so a draft that asked only "is it Arcane" would
    // put the Harpoon Protocol in its opening hand.
    for (const c of COMPANIONS) {
      expect(purePool(c.grimoire).map((d) => d.id), c.name).not.toContain('rite_of_subjugation');
    }
  });

  it('leaves every species more than one card to draw', () => {
    // A pool of one is the old fixed list wearing a die.
    for (const c of COMPANIONS) {
      expect(purePool(c.grimoire).length, `${c.name}`).toBeGreaterThan(1);
    }
  });

  it('keeps the legacy eight, for beasts caught before the draft existed', () => {
    for (const c of COMPANIONS) {
      expect(c.legacyGrimoire, `${c.name}`).toHaveLength(GRIMOIRE_SIZE);
      for (const id of c.legacyGrimoire) {
        expect(CARDS[id], `${c.name} carries an unknown card ${id}`).toBeDefined();
      }
    }
  });

  it('never offers a body — the Vanguard is bought, not drawn', () => {
    for (const c of COMPANIONS) {
      for (const def of purePool(c.grimoire)) {
        expect(def.kind, `${c.name}: ${def.id}`).not.toBe('minion');
      }
      for (const id of c.legacyGrimoire) {
        expect(CARDS[id]!.kind, `${c.name}: ${id}`).not.toBe('minion');
      }
    }
  });

  it('is where the colour lives, so two species differ by Grimoire and not by deck', () => {
    const decks = new Set(COMPANIONS.map((c) => c.deck.join('|')));
    const pools = new Set(COMPANIONS.map((c) => c.grimoire.schools.join('|')));

    expect(decks.size, 'every species hands over the same Hero Deck').toBe(1);
    expect(pools.size, 'and draws from its own shelf').toBe(COMPANIONS.length);
  });
});

describe('the roll', () => {
  it('is seeded, so the same catch is the same beast', () => {
    const a = tameCompanion(makeRng(99), 'ignis', 1);
    const b = tameCompanion(makeRng(99), 'ignis', 1);
    expect(a.spellModifiers).toEqual(b.spellModifiers);
    expect(a.baseHpRoll).toBe(b.baseHpRoll);
  });

  it('gives two beasts of one bloodline different books', () => {
    // The whole change, and the reason to go and catch a second Ignis: it is not the same
    // eight cards with a different roll on them, it is a different eight.
    const books = new Set(
      Array.from({ length: 24 }, (_, i) =>
        tameCompanion(makeRng(i + 1), 'ignis', 1).grimoire.slice().sort().join('|'),
      ),
    );
    expect(books.size, 'twenty-four catches should not all know the same spells').toBeGreaterThan(1);
  });

  it('drafts exactly eight, every time', () => {
    for (const c of COMPANIONS) {
      for (let seed = 1; seed <= 12; seed++) {
        const beast = tameCompanion(makeRng(seed), c.id, 1);
        expect(beast.grimoire, `${c.name} seed ${seed}`).toHaveLength(GRIMOIRE_SIZE);
      }
    }
  });

  it('drafts almost entirely from its own school', () => {
    // "Heavily weighted", per the brief. A pool that ignored the weighting would make an
    // Ignis a random pile of anything, and every bloodline the same pile.
    let own = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const id of tameCompanion(makeRng(seed), 'ignis', 1).grimoire) {
        total += 1;
        if (CARDS[id]!.school === 'pyre') own += 1;
      }
    }
    expect(own / total, 'the overwhelming majority is Pyre').toBeGreaterThan(0.85);
  });

  it('never drafts more copies than the deck rules allow', () => {
    // Eight copies of a Power Tier finisher is not a lucky beast, it is a broken one --
    // and it would be the only beast anybody used.
    for (const c of COMPANIONS) {
      for (let seed = 1; seed <= 25; seed++) {
        const tally = new Map<string, number>();
        for (const id of tameCompanion(makeRng(seed), c.id, 1).grimoire) {
          tally.set(id, (tally.get(id) ?? 0) + 1);
        }
        for (const [id, n] of tally) {
          expect(n, `${c.name} seed ${seed}: ${id}`).toBeLessThanOrEqual(
            TIER_COPY_LIMIT[tierOf(CARDS[id]!)],
          );
        }
      }
    }
  });

  it('only ever rolls spells that beast actually carries', () => {
    // A modifier on a card the fusion never deals is unreachable content.
    for (let seed = 1; seed <= 30; seed++) {
      const beast = tameCompanion(makeRng(seed), 'boreas', 1);
      const carried = new Set(beast.grimoire);
      for (const defId of Object.keys(beast.spellModifiers)) {
        expect(carried.has(defId), `${defId} is not in this Boreas's Grimoire`).toBe(true);
      }
    }
  });

  it('gives a duplicated spell one shared roll, not two', () => {
    // Ignis carries Flame Surge twice. A roll belongs to the spell, so both copies are the
    // same — which is the version a player can reason about.
    const mods = rollSpellModifiers(makeRng(4), ['flame_surge', 'flame_surge', 'cinder_mark']);
    expect(Object.keys(mods).length).toBeLessThanOrEqual(2);
  });

  it('leaves most spells ordinary', () => {
    // A Grimoire where everything rolled would make the roll meaningless.
    let rolled = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const beast = tameCompanion(makeRng(seed), 'ignis', 1);
      rolled += Object.keys(beast.spellModifiers).length;
      total += new Set(beast.grimoire).size;
    }
    const rate = rolled / total;
    expect(rate, 'roughly the table chance, not everything').toBeLessThan(MODIFIER_CHANCE * 2);
    expect(rate, 'and not nothing').toBeGreaterThan(0);
  });

  it('only ever produces modifiers the table can make', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const beast = tameCompanion(makeRng(seed), 'voltara', 1);
      for (const mod of Object.values(beast.spellModifiers) as CardModifier[]) {
        if (mod.pipCostDelta !== undefined) expect(mod.pipCostDelta).toBe(-1);
        if (mod.bonusDamage !== undefined) expect(mod.bonusDamage).toBe(10);
        if (mod.grantRetain !== undefined) expect(mod.grantRetain).toBe(true);
        expect(Object.keys(mod).length, 'one roll per spell').toBe(1);
      }
    }
  });
});

describe('the fusion', () => {
  const fight = (deck?: string[], mods?: Record<string, CardModifier>) =>
    createCombat(NOVICE_DUELIST, 7, 'ignis', deck, mods ? { spellModifiers: mods } : undefined);

  it('deals the Hero Deck and the Grimoire together', () => {
    const hero = ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line', 'cull_the_weak'];
    const { state } = fight(hero);
    const player = state.players.player;

    const dealt = [...player.hand, ...player.deck].map((id) => player.cards[id]!.defId);
    expect(dealt).toHaveLength(hero.length + GRIMOIRE_SIZE);

    for (const id of companionById('ignis')!.legacyGrimoire) {
      expect(dealt, `the Grimoire's ${id} was not dealt`).toContain(id);
    }
  });

  it('gives a different Companion a different fused deck from the same Hero Deck', () => {
    const hero = ['shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line', 'cull_the_weak'];
    const dealtBy = (companionId: string) => {
      const { state } = createCombat(NOVICE_DUELIST, 7, companionId, hero);
      const p = state.players.player;
      return [...p.hand, ...p.deck].map((id) => p.cards[id]!.defId).sort().join('|');
    };
    expect(dealtBy('ignis')).not.toBe(dealtBy('boreas'));
  });

  it('stamps a roll onto the Grimoire copies and nothing else', () => {
    const hero = ['shield_bash', 'shield_bash', 'aegis_ward', 'stone_barricade', 'grapple_line'];
    const { state } = fight(hero, { flame_surge: { pipCostDelta: -1 } });
    const player = state.players.player;

    const surges = Object.values(player.cards).filter((c) => c.defId === 'flame_surge');
    expect(surges.length, 'Ignis carries two').toBe(2);
    for (const c of surges) expect(c.mods).toEqual({ pipCostDelta: -1 });

    // Nothing from the Hero half ever carries one: that half is not what you caught.
    for (const c of Object.values(player.cards)) {
      if (hero.includes(c.defId)) expect(c.mods, c.defId).toBeUndefined();
    }
  });

  it('stamps only the Grimoire copy when a card is in both halves', () => {
    // The case `grimoireFrom` exists for, and the only one that can tell an index-split
    // from a plain lookup by def id. Mortis carries Harvest the Weak, and so does the Hero
    // Deck below — the roll belongs to the beast's copy, not to the player's. (Was Lexis
    // and Grapple Line until the Ink Owl stopped being a bloodline; the property under
    // test is a card in both halves, and Mortis supplies one.)
    const hero = ['harvest_the_weak', 'shield_bash', 'aegis_ward', 'stone_barricade', 'cull_the_weak'];
    const { state } = createCombat(NOVICE_DUELIST, 7, 'mortis', hero, {
      spellModifiers: { harvest_the_weak: { pipCostDelta: -1 } },
    });
    const player = state.players.player;

    expect(companionById('mortis')!.legacyGrimoire, 'the premise').toContain('harvest_the_weak');

    const copies = Object.values(player.cards).filter((c) => c.defId === 'harvest_the_weak');
    expect(copies.length, 'one from each half').toBe(2);
    expect(copies.filter((c) => c.mods !== undefined), 'exactly one rolled').toHaveLength(1);
  });

  it('never stamps a roll for a card the Grimoire does not hold', () => {
    const { state } = fight(undefined, { glacial_spike: { bonusDamage: 1 } });
    const player = state.players.player;
    for (const c of Object.values(player.cards)) expect(c.mods, c.defId).toBeUndefined();
  });

  it('leaves the enemy deck untouched by any of it', () => {
    const { state } = fight();
    for (const c of Object.values(state.players.enemy.cards)) {
      expect(c.mods, c.defId).toBeUndefined();
    }
  });
});

describe('a roll changes the fight, not just the save', () => {
  /** Finds the first dealt copy of a Grimoire spell, wherever the shuffle put it. */
  function grimoireCard(state: ReturnType<typeof createCombat>['state'], defId: string) {
    const p = state.players.player;
    const id = [...p.hand, ...p.deck].find((i) => p.cards[i]!.defId === defId)!;
    return { id, inst: p.cards[id]! };
  }

  it('takes a Pip off the price, on the face and at the till', () => {
    const plain = createCombat(NOVICE_DUELIST, 7, 'ignis').state;
    const rolled = createCombat(NOVICE_DUELIST, 7, 'ignis', undefined, {
      spellModifiers: { flame_surge: { pipCostDelta: -1 } },
    }).state;

    const base = CARDS.flame_surge!.cost.pips;
    expect(toCardSnapshot(plain, 'player', grimoireCard(plain, 'flame_surge').id).cost.pips).toBe(base);
    expect(
      toCardSnapshot(rolled, 'player', grimoireCard(rolled, 'flame_surge').id).cost.pips,
      'and the face shows what the till will charge',
    ).toBe(base - 1);
  });

  it('never takes a card below free', () => {
    const state = createCombat(NOVICE_DUELIST, 7, 'mortis', undefined, {
      spellModifiers: { harvest_the_weak: { pipCostDelta: -1 } },
    }).state;
    const { id } = grimoireCard(state, 'harvest_the_weak');
    expect(CARDS.harvest_the_weak!.cost.pips, 'already free').toBe(0);
    expect(toCardSnapshot(state, 'player', id).cost.pips).toBe(0);
  });

  it('leaves Marrow alone, because Marrow is a demand rather than a price', () => {
    const state = createCombat(NOVICE_DUELIST, 7, 'mortis', undefined, {
      spellModifiers: { marrow_burst: { pipCostDelta: -1 } },
    }).state;
    const { id } = grimoireCard(state, 'marrow_burst');
    expect(toCardSnapshot(state, 'player', id).cost.marrow).toBe(CARDS.marrow_burst!.cost.marrow);
  });

  it('adds its damage to every hit the card makes', () => {
    // Cull the Weak: a global cast at the lowest-HP enemy, so it needs no Companion body
    // to be thrown from and lands the same way every time.
    const cast = (mods?: CardModifier) => {
      const st = scenario({ width: 6, height: 8, pips: 8, marrow: 4 });
      const victim = addUnit(st, { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 2 }, hp: 120 });
      st.nextId += 1;
      const id = `g${st.nextId}`;
      st.players.player.cards[id] = {
        instanceId: id,
        defId: 'cull_the_weak',
        ...(mods ? { mods } : {}),
      };
      st.players.player.hand.push(id);
      const res = applyCommand(st, { type: 'playCard', card: id, target: { kind: 'global' } });
      return damageTo(res.events, victim.id);
    };

    const plain = cast();
    const rolled = cast({ bonusDamage: 1 });
    expect(plain, 'the card connects at all').toBeGreaterThan(0);
    expect(rolled).toBe(plain + 1);
  });

  it('keeps a rolled-Retain card in hand at end of turn', () => {
    const st = scenario({ width: 6, height: 8, pips: 8 });
    st.nextId += 1;
    const kept = `g${st.nextId}`;
    st.players.player.cards[kept] = { instanceId: kept, defId: 'flame_surge', mods: { grantRetain: true } };
    st.players.player.hand.push(kept);

    st.nextId += 1;
    const dropped = `g${st.nextId}`;
    st.players.player.cards[dropped] = { instanceId: dropped, defId: 'flame_surge' };
    st.players.player.hand.push(dropped);

    const res = applyCommand(st, { type: 'endTurn' });

    expect(res.state.players.player.hand, 'the roll keeps it').toContain(kept);
    expect(res.state.players.player.hand, 'the ordinary copy goes').not.toContain(dropped);
  });
});
