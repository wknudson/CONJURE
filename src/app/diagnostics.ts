/**
 * The diagnostics dump: what a playtester pastes alongside "it felt wrong".
 *
 * The roadmap's Phase F promised per-game stats and a hidden stats dump so that feedback
 * would be data rather than vibes, and neither shipped. This is the dump. It is plain
 * JSON, built from the save file and the build stamp, and it names the exact games —
 * encounter, seed, Companion, result, turns, the Pact at the bell — that the profile's
 * history records. Copied from the settings panel; nothing here leaves the machine on
 * its own.
 */

import { BUILD, type BuildStamp } from './build.js';
import type { Profile, SaveFile } from './save.js';
import { getSettings } from './settings.js';

export interface Diagnostics {
  build: BuildStamp;
  at: string;
  browser: string;
  viewport: string;
  settings: ReturnType<typeof getSettings>;
  difficulty: string;
  activeProfile: string | null;
  profiles: {
    slot: string;
    name: string;
    level: number;
    record: Profile['record'];
    ducats: number;
    pactHp: number;
    clock: number;
    companions: number;
    lastRun: Profile['lastRun'];
    history: Profile['history'];
  }[];
}

export function buildDiagnostics(
  save: SaveFile,
  env: { userAgent: string; viewport: string; now: Date } = {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    now: new Date(),
  },
): Diagnostics {
  const profiles: Diagnostics['profiles'] = [];
  for (const [slot, p] of Object.entries(save.profiles)) {
    if (!p) continue;
    profiles.push({
      slot,
      name: p.name,
      level: p.level,
      record: p.record,
      ducats: p.state.overworld.economy.ducats,
      pactHp: p.state.overworld.pact.currentHp,
      clock: p.clock,
      companions: p.companions.length,
      lastRun: p.lastRun,
      history: p.history,
    });
  }
  return {
    build: BUILD,
    at: env.now.toISOString(),
    browser: env.userAgent,
    viewport: env.viewport,
    settings: getSettings(),
    difficulty: save.difficulty,
    activeProfile: save.activeProfileId,
    profiles,
  };
}

/** The text the button copies. */
export function formatDiagnostics(d: Diagnostics): string {
  return JSON.stringify(d, null, 2);
}
