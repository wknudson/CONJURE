import { describe, expect, it } from 'vitest';
import { BONE_MAX, filterBarHtml, matchesBones, bonePills } from '../hud/filterBar.js';
import { CARDS } from '../core/data/cards/index.js';
import { isObtainable } from '../core/data/collection.js';

/**
 * The shared filter bar.
 *
 * Chrome, mostly — but `matchesBones` is a real rule, and it is the one that decides
 * whether a card can be filtered into invisibility.
 */

describe('the Bone pills', () => {
  it('offer a bucket at the top rather than a last number', () => {
    const pills = bonePills();
    expect(pills.at(-1)!.label).toBe(`${BONE_MAX}+`);
    expect(pills[0]!.key).toBe('all');
  });

  it('lets everything through on Any', () => {
    for (const bones of [0, 1, 5, 99]) expect(matchesBones(bones, 'all')).toBe(true);
  });

  it('matches an exact cost below the bucket', () => {
    expect(matchesBones(2, '2')).toBe(true);
    expect(matchesBones(3, '2')).toBe(false);
    expect(matchesBones(0, '0')).toBe(true);
  });

  it('sweeps everything at or above the bucket into it', () => {
    // The rule that matters. A `=== 5` comparison would make a 6-Bone card unreachable by
    // any pill — present in the collection, and findable by no filter.
    expect(matchesBones(BONE_MAX, String(BONE_MAX))).toBe(true);
    expect(matchesBones(BONE_MAX + 3, String(BONE_MAX))).toBe(true);
    expect(matchesBones(BONE_MAX - 1, String(BONE_MAX))).toBe(false);
  });

  it('leaves no obtainable card unreachable by some pill', () => {
    // Swept over the real catalogue rather than asserted in the abstract: this is the
    // property the bucket exists to guarantee, and it is only true of the cards that
    // actually exist.
    const pills = bonePills().filter((p) => p.key !== 'all');
    for (const def of Object.values(CARDS)) {
      if (!isObtainable(def)) continue;
      const found = pills.some((p) => matchesBones(def.cost.bones, p.key));
      expect(found, `${def.id} at ${def.cost.bones} Bones matches no pill`).toBe(true);
    }
  });
});

describe('the bar renders what it is given', () => {
  const groups = [
    {
      name: 'school',
      label: 'Element',
      active: 'pyre',
      pills: [
        { key: 'all', label: 'All' },
        { key: 'pyre', label: 'Pyre', tint: '#FF6B35' },
      ],
    },
  ];

  it('marks exactly the active pill', () => {
    const html = filterBarHtml(groups);
    const on = html.match(/is-on/g) ?? [];
    expect(on).toHaveLength(1);
    expect(html).toContain('data-value="pyre"');
  });

  it('carries the filter name and value onto every pill, for the click handler', () => {
    const html = filterBarHtml(groups);
    expect(html).toContain('data-filter="school"');
    expect(html).toContain('data-value="all"');
  });

  it('paints a tint only where one was given', () => {
    const html = filterBarHtml(groups);
    expect(html).toContain('--pill:#FF6B35');
    // The 'all' pill has no tint and must not inherit one.
    const allPill = html.slice(html.indexOf('data-value="all"') - 120, html.indexOf('data-value="all"'));
    expect(allPill).not.toContain('--pill');
  });
});
