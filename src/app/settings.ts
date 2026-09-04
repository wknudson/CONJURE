/**
 * The player's preferences, in one place.
 *
 * There was no settings screen. Mute and playback speed existed as two buttons on the
 * combat HUD, each keeping its own `localStorage` key, so a player who wanted silence had
 * to start a fight to get it; volume was a fixed gain, and the screen shake fired
 * unconditionally at a dozen sites with nothing to turn it down. This is the store those
 * buttons and the new panel (`SettingsPanel.ts`) read and write, and the sound and effects
 * layers subscribe to.
 *
 * Kept outside the save file on purpose: these are facts about the machine and the person
 * at it, not about a character, and they should survive a burned commission.
 */

export type PlaybackSpeed = 'normal' | 'fast';

export interface Settings {
  /** Master volume, 0 to 1. Independent of `muted`, so unmuting restores the level. */
  volume: number;
  muted: boolean;
  /** Whether blows and detonations shake the camera. */
  shake: boolean;
  /** How the enemy's turn is paced. The HUD's F key toggles the same field. */
  speed: PlaybackSpeed;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  volume: 0.8,
  muted: false,
  shake: true,
  speed: 'normal',
};

const KEY = 'conjure.settings';
/** The two keys the HUD buttons used before there was a store. Read once, then retired. */
const LEGACY_MUTE_KEY = 'conjure.muted';
const LEGACY_SPEED_KEY = 'conjure.speed';

type Listener = (s: Readonly<Settings>) => void;

let current: Settings | null = null;
const listeners = new Set<Listener>();

/** Rebuilt rather than trusted, on the save file's rule: a stray value falls back. */
function clean(raw: unknown, legacy: { muted?: boolean; speed?: PlaybackSpeed }): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const volume = typeof r.volume === 'number' && Number.isFinite(r.volume) ? r.volume : DEFAULT_SETTINGS.volume;
  return {
    volume: Math.min(1, Math.max(0, volume)),
    muted: typeof r.muted === 'boolean' ? r.muted : (legacy.muted ?? DEFAULT_SETTINGS.muted),
    shake: typeof r.shake === 'boolean' ? r.shake : DEFAULT_SETTINGS.shake,
    speed: r.speed === 'fast' || r.speed === 'normal' ? r.speed : (legacy.speed ?? DEFAULT_SETTINGS.speed),
  };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Loads once, lazily; every later call is the same object until `updateSettings`. */
export function getSettings(): Readonly<Settings> {
  if (current) return current;
  let parsed: unknown = null;
  const stored = readRaw(KEY);
  if (stored !== null) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
  }
  const legacy: { muted?: boolean; speed?: PlaybackSpeed } = {};
  const oldMute = readRaw(LEGACY_MUTE_KEY);
  if (oldMute !== null) legacy.muted = oldMute === '1';
  const oldSpeed = readRaw(LEGACY_SPEED_KEY);
  if (oldSpeed === 'fast' || oldSpeed === 'normal') legacy.speed = oldSpeed;
  current = clean(parsed, legacy);
  return current;
}

export function updateSettings(patch: Partial<Settings>): Readonly<Settings> {
  current = clean({ ...getSettings(), ...patch }, {});
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    // The old keys would otherwise resurrect a stale preference on a machine that never
    // saw the store fail. Removed here, once something has been written to the new one.
    localStorage.removeItem(LEGACY_MUTE_KEY);
    localStorage.removeItem(LEGACY_SPEED_KEY);
  } catch {
    // Storage blocked or full. The setting holds for this session; the save banner has
    // already told the player their browser keeps nothing.
  }
  for (const fn of listeners) fn(current);
  return current;
}

/** Called with every change, and once immediately with the current values. */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  fn(getSettings());
  return () => void listeners.delete(fn);
}

/** For tests: forget the cached values so the next read comes from storage again. */
export function resetSettingsCache(): void {
  current = null;
}
