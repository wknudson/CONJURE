import { describe, expect, it } from 'vitest';
import { cardFaceHtml, faceOfDef, faceOfSnapshot, ownerOfKind } from '../hud/cardFace.js';
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

  it('names the owner off the role, not off where the card is cast from', () => {
    // The badge used to print `CardDef.source`, which looks like it answers "whose card is
    // this" and does not -- it means "cast from the beast's tile", which is why it gates
    // the range check in `targeting.ts`. It is `'companion'` on the Cinder Mark, so the
    // face said COMPANION on a card only the Hero may deck.
    expect(ownerOfKind('spell')).toBe('companion');
    for (const kind of ['ability', 'mark', 'obstacle', 'minion'] as const) {
      expect(ownerOfKind(kind), kind).toBe('hero');
    }
  });

  it('puts HERO on a Mark, whatever its `source` still says', () => {
    // The regression, named. Cinder Mark is `source: 'companion'` on purpose -- flipping it
    // would discard the card's range and make the trap castable across the whole board --
    // so the face has to get the answer from somewhere else, and this is what proves it
    // does rather than merely happening to agree.
    const mark = CARDS.cinder_mark!;
    expect(mark.source, 'still cast from the beast, for range').toBe('companion');
    expect(mark.kind).toBe('mark');

    const html = cardFaceHtml(faceOfDef(mark));
    expect(html).toContain('>HERO<');
    expect(html).not.toContain('>COMPANION<');
    expect(html, 'and the class agrees with the word').toContain('card--src-hero');
  });

  it('gives every role its own word on the face', () => {
    const labels: Record<string, string> = {
      flame_surge: 'SPELL',
      shield_bash: 'ABILITY',
      cinder_mark: 'MARK',
      stone_barricade: 'CONSTRUCT',
      grave_sentinel: 'MINION',
    };
    for (const [id, label] of Object.entries(labels)) {
      expect(cardFaceHtml(faceOfDef(CARDS[id]!)), id).toContain(`>${label}<`);
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
