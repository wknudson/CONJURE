import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX,
  emptySave,
  initializeNewProfile,
  loadSave,
  pushHistory,
  writeSave,
  type GameRecord,
} from '../app/save.js';
import { buildDiagnostics, formatDiagnostics } from '../app/diagnostics.js';

/**
 * Per-game history is what turns "the Frost fight felt unfair" into an encounter, a seed
 * and a turn count. It is capped, it survives a save round trip, and a malformed entry is
 * dropped rather than repaired — the save file's standing rule.
 */
const rec = (n: number, over: Partial<GameRecord> = {}): GameRecord => ({
  at: 1_000 + n,
  encounterId: `enc_${n}`,
  seed: n,
  companionId: 'ignis',
  result: n % 3 === 0 ? 'defeat' : 'victory',
  turns: 10 + n,
  pactHp: 400 - n,
  difficulty: 'novice',
  ...over,
});

const withStorage = <T>(fn: () => T): T => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  const original = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try {
    return fn();
  } finally {
    if (original === undefined) delete g.localStorage;
    else g.localStorage = original;
  }
};

describe('the profile history', () => {
  it('keeps the newest games and drops the oldest past the cap', () => {
    const p = initializeNewProfile('slot-1', { nickname: 'T', gender: 'female', starterCompanion: 'ignis' });
    expect(p.history).toEqual([]);
    for (let n = 0; n < HISTORY_MAX + 5; n++) pushHistory(p, rec(n));
    expect(p.history).toHaveLength(HISTORY_MAX);
    expect(p.history[0]!.seed).toBe(5);
    expect(p.history.at(-1)!.seed).toBe(HISTORY_MAX + 4);
  });

  it('survives a save round trip, entry for entry', () =>
    withStorage(() => {
      const save = emptySave();
      const p = initializeNewProfile('slot-1', { nickname: 'T', gender: 'female', starterCompanion: 'ignis' });
      pushHistory(p, rec(1));
      pushHistory(p, rec(2, { result: 'bound' }));
      save.profiles['slot-1'] = p;
      expect(writeSave(save)).toBe(true);
      const back = loadSave().save.profiles['slot-1']!;
      expect(back.history).toEqual(p.history);
    }));

  it('drops a malformed entry and reads an older save as having none', () =>
    withStorage(() => {
      const save = emptySave();
      const p = initializeNewProfile('slot-1', { nickname: 'T', gender: 'female', starterCompanion: 'ignis' });
      pushHistory(p, rec(1));
      save.profiles['slot-1'] = p;
      writeSave(save);
      const raw = JSON.parse(localStorage.getItem('conjure.save')!);
      raw.profiles['slot-1'].history.push({ result: 'won', encounterId: 5 }, 'garbage', null);
      localStorage.setItem('conjure.save', JSON.stringify(raw));
      expect(loadSave().save.profiles['slot-1']!.history).toEqual(p.history);

      delete raw.profiles['slot-1'].history;
      localStorage.setItem('conjure.save', JSON.stringify(raw));
      expect(loadSave().save.profiles['slot-1']!.history).toEqual([]);
    }));
});

describe('the diagnostics dump', () => {
  it('names the build, the settings and every profile with its history', () => {
    const save = emptySave();
    const p = initializeNewProfile('slot-2', { nickname: 'Tester', gender: 'male', starterCompanion: 'boreas' });
    pushHistory(p, rec(7));
    save.profiles['slot-2'] = p;
    save.activeProfileId = 'slot-2';
    const d = buildDiagnostics(save, { userAgent: 'TestBrowser/1', viewport: '1x1', now: new Date(0) });
    expect(d.build.version).toBeTruthy();
    expect(d.activeProfile).toBe('slot-2');
    expect(d.profiles).toHaveLength(1);
    expect(d.profiles[0]!.name).toBe('Tester');
    expect(d.profiles[0]!.history[0]!.encounterId).toBe('enc_7');
    const text = formatDiagnostics(d);
    expect(JSON.parse(text)).toEqual(d);
  });
});
