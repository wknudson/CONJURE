import { describe, expect, it } from 'vitest';
import { createCombat } from '../core/engine/setup.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { CARDS } from '../core/data/cards/index.js';
import {
  HERO_SCHOOLS,
  MAX_DECK,
  MIN_DECK,
  TIER_COPY_LIMIT,
  fusedDeckSize,
  tierOf,
  validateDeck,
} from '../core/data/deckRules.js';
import { purePool } from '../core/data/grimoire.js';
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

  it('refuses an elemental card, and says whose job that is', () => {
    const deck = [...STARTER_DECK, 'flame_surge'];
    const problem = validateDeck(deck).find((p) => p.code === 'off_school');

    expect(problem, 'Pyre has no place in a Hero Deck').toBeDefined();
    expect(problem!.cardId).toBe('flame_surge');
    expect(problem!.message).toMatch(/Companion brings the elements/);
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
  it('no longer has a bloodline that cannot fill a book on its own', () => {
    // This test used to name Voltara and Ferrum, because Surge had three spells to its
    // name and Bulwark two -- neither could reach eight even taking every copy the Tier
    // limits allow, so both quietly topped up from the colourless pool. The catalog
    // expansion closed it: Surge and Bulwark now carry enough of their own.
    //
    // Kept, inverted, as the thing that stops it reopening. The neutral fallback in
    // `draftGrimoire` is still there and still correct -- it is the answer for whatever
    // thin school gets added next -- but nothing shipped today needs it.
    const thin = COMPANIONS.filter((c) => {
      const capacity = purePool(c.grimoire).reduce((n, def) => n + TIER_COPY_LIMIT[tierOf(def)], 0);
      return capacity < GRIMOIRE_SIZE;
    }).map((c) => c.id);

    expect(thin, 'a school has gone thin again').toEqual([]);
  });

  it('lets the rest fill a book out of their own school alone', () => {
    for (const c of COMPANIONS) {
      if (['voltara', 'ferrum'].includes(c.id)) continue;
      const capacity = purePool(c.grimoire).reduce((n, def) => n + TIER_COPY_LIMIT[tierOf(def)], 0);
      expect(capacity, `${c.name}`).toBeGreaterThanOrEqual(GRIMOIRE_SIZE);
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
    const mods = rollSpellModifiers(makeRng(4), ['flame_surge', 'flame_surge', 'cinder_rune']);
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
    // from a plain lookup by def id. Lexis carries Grapple Line, and so does the Hero Deck
    // below — the roll belongs to the beast's copy, not to the player's.
    const hero = ['grapple_line', 'shield_bash', 'aegis_ward', 'stone_barricade', 'cull_the_weak'];
    const { state } = createCombat(NOVICE_DUELIST, 7, 'lexis', hero, {
      spellModifiers: { grapple_line: { pipCostDelta: -1 } },
    });
    const player = state.players.player;

    expect(companionById('lexis')!.legacyGrimoire, 'the premise').toContain('grapple_line');

    const copies = Object.values(player.cards).filter((c) => c.defId === 'grapple_line');
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
