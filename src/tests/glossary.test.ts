import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import { KEYWORDS, TERMS, lookup } from '../hud/glossary.js';
import { REACTIONS } from '../core/data/reactions.js';

/**
 * The onboarding layer drifts silently: a card gains a keyword, nothing explains it, and
 * nobody notices until a playtester asks. These tests make that a build failure.
 */
describe('glossary coverage', () => {
  it('explains every keyword that appears on a card', () => {
    const missing = new Set<string>();
    for (const card of Object.values(CARDS)) {
      for (const kw of card.keywords) {
        if (!KEYWORDS[kw]) missing.add(kw);
      }
    }
    expect([...missing].join(', ')).toBe('');
  });

  it('explains every status a card can apply', () => {
    const missing = new Set<string>();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.op === 'applyStatus' && typeof n.status === 'string') {
        if (!TERMS[n.status]) missing.add(n.status);
      }
      for (const v of Object.values(n)) {
        if (Array.isArray(v)) v.forEach(walk);
        else walk(v);
      }
    };
    for (const card of Object.values(CARDS)) walk(card.effect);
    expect([...missing].join(', ')).toBe('');
  });

  it('gives every reaction a name the help panel can show', () => {
    for (const r of REACTIONS) {
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.text.length).toBeGreaterThan(20);
    }
  });

  it('resolves glossary lookups case-insensitively for terms', () => {
    expect(lookup('Guardian')).toBeDefined();
    expect(lookup('bones')).toBeDefined();
    expect(lookup('BRITTLE')).toBeDefined();
    expect(lookup('minion')).toBeDefined();
    expect(lookup('not-a-real-term')).toBeUndefined();
  });
});
