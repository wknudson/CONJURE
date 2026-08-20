import { describe, expect, it } from 'vitest';
import { cardFaceHtml, faceOfDef, faceOfSnapshot } from '../hud/cardFace.js';
import { CARDS } from '../core/data/cards/index.js';
import { isObtainable } from '../core/data/collection.js';
import type { CardSnapshot } from '../contract/snapshots.js';

/**
 * The shared card face.
 *
 * It exists because there were two: the hand had a card component and the Artificer had
 * `forge-print`, a smaller card drawn from the same data with different markup and a
 * subset of the fields. The forge is exactly where showing a player *less* about a card
 * they are deciding to buy is worst — a Rank 2 that only adds a keyword looked identical
 * to its Rank 1 in the one screen built to compare them.
 *
 * These tests are about that: whatever the face shows, it shows from either source.
 */

const face = (id: string) => faceOfDef(CARDS[id]!);

describe('a definition becomes a face', () => {
  it('carries the four things the brief names', () => {
    // School colour, Pip cost, title, rules text.
    const f = face('flame_surge');
    const html = cardFaceHtml(f);
    expect(html).toContain(CARDS.flame_surge!.name);
    expect(html).toContain(CARDS.flame_surge!.text);
    expect(html, 'school drives the CSS custom property').toContain('--school:');
    expect(html).toContain('card__cost');
  });

  it('shows keywords, which the old forge print never did', () => {
    const withKeywords = Object.values(CARDS).find((d) => d.keywords.length > 0)!;
    const html = cardFaceHtml(faceOfDef(withKeywords));
    for (const k of withKeywords.keywords) {
      expect(html, `${withKeywords.id} hides ${k}`).toContain(`data-tip="${k}"`);
    }
  });

  it('shows a minion’s stat line', () => {
    const minion = Object.values(CARDS).find((d) => d.unit)!;
    const f = faceOfDef(minion);
    expect(f.stats?.atk).toBe(minion.unit!.atk);
    expect(f.stats?.hp).toBe(minion.unit!.hp);
    expect(f.stats?.mov).toBe(minion.unit!.mov);
  });

  it('shows a mortar’s blind spot when the forge asks for reach', () => {
    // The one number the hand deliberately omits and the forge needs: mid-fight the
    // envelope is drawn on the board, and in the shop it is what is being bought.
    const arcing = Object.values(CARDS).find((d) => d.unit && d.unit.rangeMin > 1);
    if (!arcing) return;
    const html = cardFaceHtml(faceOfDef(arcing), { showReach: true });
    expect(html).toContain(`${arcing.unit!.rangeMin}–${arcing.unit!.rangeMax}`);
  });

  it('omits reach unless asked, so the hand stays as it was', () => {
    const arcing = Object.values(CARDS).find((d) => d.unit && d.unit.rangeMin > 1);
    if (!arcing) return;
    const html = cardFaceHtml(faceOfDef(arcing));
    expect(html).not.toContain(`${arcing.unit!.rangeMin}–${arcing.unit!.rangeMax}`);
  });
});

describe('a snapshot becomes the same face', () => {
  const snapshot: CardSnapshot = {
    instanceId: 'c1',
    defId: 'flame_surge',
    name: 'Flame Surge',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'A gout of fire down a short line.',
    keywords: [],
    range: 4,
  };

  it('draws the same markup shape from either side', () => {
    // The point of the module: one renderer, so the hand and the forge cannot disagree
    // about what a card looks like.
    const fromSnapshot = cardFaceHtml(faceOfSnapshot(snapshot));
    expect(fromSnapshot).toContain('Flame Surge');
    expect(fromSnapshot).toContain('card--spell');
    expect(fromSnapshot).toContain('card--src-companion');
    expect(fromSnapshot).toContain('RANGE 4');
  });

  it('marks an ephemeral card as one', () => {
    const html = cardFaceHtml(faceOfSnapshot({ ...snapshot, ephemeral: true }));
    expect(html).toContain('card--ephemeral');
  });
});

describe('the face is safe to build from any card in the game', () => {
  it('renders every obtainable card without throwing', () => {
    // The forge shelves iterate the catalogue, so one card that cannot be drawn takes the
    // whole screen with it.
    for (const def of Object.values(CARDS)) {
      if (!isObtainable(def)) continue;
      expect(() => cardFaceHtml(faceOfDef(def), { showReach: true }), def.id).not.toThrow();
    }
  });

  it('escapes text rather than trusting it', () => {
    const nasty = faceOfDef({
      ...CARDS.flame_surge!,
      name: '<script>x</script>',
      text: 'a & b "c"',
    });
    const html = cardFaceHtml(nasty);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
  });
});
