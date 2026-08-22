import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import { MARKS } from '../core/data/marks.js';
import { NOVICE_DUELIST } from '../core/data/encounters/index.js';
import { HERO_KINDS, deckRoleRefusal } from '../core/data/deckRules.js';
import { schematicPool } from '../core/data/schematics.js';
import { SCHOOLS } from '../core/data/pools.js';
import { rosterPointsOf } from '../core/data/roster.js';
import { startingRosterFor } from '../core/data/pools.js';
import { hybridSchools } from '../core/data/splicing.js';
import { VARIANT_PILLS, belongsInCase } from '../app/DeckBuilderScreen.js';

/**
 * The duel, and the set of Marks it hands out.
 *
 * A Wandering Duelist is another Hero: they hold a Hero Deck and deploy a warband, and
 * neither of you can buy a body with Pips. Before this, their deck held five minions and
 * two Spells — so beating them taught plans for cards the player's half could never
 * contain, and the offer was mostly noise.
 */

describe('the Wandering Duelist holds a Hero Deck', () => {
  it('plays nothing a Hero Deck could not legally hold', () => {
    // Asked through `deckRoleRefusal` rather than by listing kinds, so this test and the
    // validator are the same rule. Nothing enforces it at runtime — `validateDeck` is never
    // run against an enemy deck — which is exactly why it is enforced here.
    for (const id of NOVICE_DUELIST.enemyDeck) {
      const def = CARDS[id];
      expect(def, `${id} is not a card`).toBeDefined();
      expect(deckRoleRefusal(def!), `${id} cannot go in a Hero Deck`).toBeNull();
    }
  });

  it('covers all three Hero roles, so the offer is not all one thing', () => {
    const kinds = new Set(NOVICE_DUELIST.enemyDeck.map((id) => CARDS[id]!.kind));
    for (const kind of HERO_KINDS) {
      expect(kinds.has(kind), `the Duelist plays no ${kind}`).toBe(true);
    }
  });

  it('teaches every one of its own cards', () => {
    // The pool is derived from the deck, so this is really asking whether anything in the
    // deck is un-obtainable — a card the fight plays and can never hand over.
    const taught = new Set(schematicPool(NOVICE_DUELIST).map((d) => d.id));
    for (const id of NOVICE_DUELIST.enemyDeck) {
      expect(taught.has(id), `${id} is played but never offered`).toBe(true);
    }
  });

  it('fields a warband worth the same ten points a character gets', () => {
    // `setup.ts` hands the enemy a free `vanguard_footman`, so the authored list is the
    // other eight points. Counting it here is what caught the first draft listing a Footman
    // as well: six bodies against a ten-point roster, one of them on an occupied tile.
    const authored = NOVICE_DUELIST.enemyOpeningBoard.reduce(
      (n, [defId]) => n + rosterPointsOf(CARDS[defId]!),
      0,
    );
    const free = rosterPointsOf(CARDS.vanguard_footman!);
    expect(authored + free).toBe(
      startingRosterFor('dusk').reduce((n, id) => n + rosterPointsOf(CARDS[id]!), 0),
    );
  });

  it('leaves the free Footman alone on its tile', () => {
    // `setup.ts` places it at the middle of row 1. Two units authored onto one tile is the
    // kind of thing that silently resolves into a shunt nobody meant.
    const mid = Math.floor(NOVICE_DUELIST.width / 2);
    for (const [defId, x, y] of NOVICE_DUELIST.enemyOpeningBoard) {
      expect([x, y], `${defId} sits on the free Footman tile`).not.toEqual([mid, 1]);
    }
  });

  it('stands its line inside its own two rows', () => {
    for (const [defId, x, y] of NOVICE_DUELIST.enemyOpeningBoard) {
      expect(y, `${defId} is out of the enemy's zone`).toBeLessThanOrEqual(1);
      expect(x, `${defId} is off the board`).toBeLessThan(NOVICE_DUELIST.width);
    }
  });
});

describe('one Mark per element', () => {
  const markCards = Object.values(CARDS).filter((d) => d.kind === 'mark');

  it('gives every element exactly one, and no element two', () => {
    // A Mark is the only way the Hero puts an element on the board. While three of the six
    // existed, the Hero's half of the pairing was a different size depending on who the
    // player had tamed.
    const byPayload = new Map<string, string[]>();
    for (const card of markCards) {
      const mark = MARKS[card.effect.op === 'attachMark' ? card.effect.mark : ''];
      expect(mark, `${card.id} lays no mark`).toBeDefined();
      byPayload.set(mark!.school, [...(byPayload.get(mark!.school) ?? []), card.id]);
    }
    for (const school of SCHOOLS) {
      expect(byPayload.get(school), `no Mark detonates ${school}`).toHaveLength(1);
    }
    expect(markCards).toHaveLength(SCHOOLS.length);
  });

  it('files every Mark card as arcane, whatever it detonates', () => {
    // Two fields, two questions. The card's school is whose half of the deck it belongs to;
    // the payload's is the colour of the blast. Collapsing them would refuse the Hero their
    // own trap.
    for (const card of markCards) {
      expect(card.school, `${card.id}`).toBe('arcane');
      expect(deckRoleRefusal(card), `${card.id} cannot be decked`).toBeNull();
    }
  });

  it('never fuses two schools into one Mark', () => {
    // Explicitly asked for. A fusion is the splicing bench's product and lives in a Grimoire
    // socket; a two-school Mark would be a Hybrid the Hero could deck, which is the thing
    // that sink exists to charge for.
    for (const card of markCards) {
      expect(card.spliceOnly, `${card.id} is spliceable`).toBeFalsy();
      expect(hybridSchools(card.id), `${card.id} has a recipe`).toEqual([]);
    }
  });

  it('keeps every payload on the stretched scale and inside the vocabulary', () => {
    for (const mark of Object.values(MARKS)) {
      expect(mark.damage % 10, `${mark.id} damage is off the x10 scale`).toBe(0);
      for (const applied of mark.applies ?? []) {
        expect(applied.stacks, `${mark.id} applies ${applied.status}`).toBeGreaterThan(0);
      }
    }
  });

  it('makes each of the six do something the others do not', () => {
    // Six traps that all read "damage in a ring" would be one trap printed six times. The
    // distinguishing feature is (trigger, damage type, what it leaves behind) — no two may
    // share all three.
    const seen = new Set<string>();
    for (const card of markCards) {
      const mark = MARKS[card.effect.op === 'attachMark' ? card.effect.mark : '']!;
      const trigger =
        mark.trigger.kind === 'death' ? 'death' : mark.trigger.alignedTypes.join('/');
      const leaves = (mark.applies ?? []).map((a) => a.status).sort().join('+') || 'nothing';
      const shape = `${trigger}|${mark.dtype}|${leaves}`;
      expect(seen.has(shape), `${card.id} is a reprint: ${shape}`).toBe(false);
      seen.add(shape);
    }
  });
});

describe('the Deck tab is for cards, not bodies', () => {
  it('keeps every body off the Case', () => {
    // The Vanguard tab is one click away and builds a warband properly. This shelf is for
    // the cards you shuffle, and a Minion is not one of those and has not been since the
    // Vanguard overhaul.
    for (const def of Object.values(CARDS)) {
      expect(belongsInCase(def), `${def.id}`).toBe(def.kind !== 'minion');
    }
    expect(belongsInCase(CARDS.grave_sentinel!), 'a body is not a card you shuffle').toBe(false);
    expect(belongsInCase(CARDS.cinder_mark!)).toBe(true);
  });

  it('keeps what the player owns visible, even when it cannot be decked', () => {
    // Deliberately *not* `deckRoleRefusal(def) === null`. A Spell the player owns stays on
    // the shelf, barred and labelled with where it does go -- hiding it would read as the
    // card having been taken away.
    expect(belongsInCase(CARDS.flame_surge!), 'an owned Spell still shows').toBe(true);
    expect(belongsInCase(CARDS.pyre_pillar!), 'so does an off-school Construct').toBe(true);
  });

  it('offers a pill for each Hero role and nothing else', () => {
    const keys = VARIANT_PILLS.map((p) => p.key).filter((k) => k !== 'all');
    expect([...keys].sort()).toEqual([...HERO_KINDS].sort());
  });
});
