import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  getSettings,
  onSettingsChange,
  resetSettingsCache,
  updateSettings,
} from '../app/settings.js';

/**
 * The settings store replaces two ad hoc localStorage keys the combat HUD kept. It has to
 * read those keys once so nobody's mute or speed is lost, clamp what it stores, and answer
 * sensibly where there is no storage at all.
 */
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('settings', () => {
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
    resetSettingsCache();
  });
  afterEach(() => {
    if (original === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = original;
    resetSettingsCache();
  });

  it('starts from the defaults with nothing stored', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('carries the HUD\'s old mute and speed keys over, then retires them on the first write', () => {
    store.set('conjure.muted', '1');
    store.set('conjure.speed', 'fast');
    expect(getSettings().muted).toBe(true);
    expect(getSettings().speed).toBe('fast');
    updateSettings({ volume: 0.5 });
    expect(store.has('conjure.muted')).toBe(false);
    expect(store.has('conjure.speed')).toBe(false);
    expect(JSON.parse(store.get('conjure.settings')!)).toMatchObject({ muted: true, speed: 'fast', volume: 0.5 });
  });

  it('clamps and repairs what it reads rather than trusting it', () => {
    store.set('conjure.settings', JSON.stringify({ volume: 7, muted: 'yes', shake: null, speed: 'ludicrous' }));
    expect(getSettings()).toEqual({ ...DEFAULT_SETTINGS, volume: 1 });
    store.set('conjure.settings', 'not json');
    resetSettingsCache();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('tells subscribers once now and again on every change', () => {
    const seen: boolean[] = [];
    const off = onSettingsChange((s) => seen.push(s.shake));
    updateSettings({ shake: false });
    off();
    updateSettings({ shake: true });
    expect(seen).toEqual([true, false]);
  });

  it('holds a setting for the session when storage refuses it', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    resetSettingsCache();
    expect(updateSettings({ muted: true }).muted).toBe(true);
    expect(getSettings().muted).toBe(true);
  });
});
