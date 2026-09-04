import { afterEach, describe, expect, it } from 'vitest';
import { probeStorage } from '../app/save.js';

/**
 * `probeStorage` is how the game tells a browser that blocks storage from one that has run
 * out of it, so the warning it shows can say the right thing. Under node there is no
 * `localStorage` at all, which is the blocked case; the other two are stubbed in.
 */
describe('probeStorage', () => {
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  afterEach(() => {
    if (original === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = original;
  });

  it('reports storage as blocked when there is none to reach', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(probeStorage()).toBe('blocked');
  });

  it('reports storage as blocked when every access throws', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem: () => {},
    };
    expect(probeStorage()).toBe('blocked');
  });

  it('reports storage as full on a quota error', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(probeStorage()).toBe('full');
  });

  it('reports nothing wrong when a write and its removal both succeed', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    expect(probeStorage()).toBeNull();
    expect(store.size, 'the probe cleans up after itself').toBe(0);
  });
});
