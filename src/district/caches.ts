/**
 * Things left lying about: a chest in a cellar, an urn in a corner, a strongbox behind a door.
 *
 * Opened once per character and remembered in the save (`Profile.caches`), which is what
 * separates a cache from a forage node: the node grows back and the chest does not. What one
 * hands over is exactly the shape an errand pays -- Ducats, Marrow Shards, Cores, a brew --
 * through the same purse writer (`payErrand`), so there is one answer to "what does a payout
 * do" and a cache cannot mint something the economy has no field for.
 *
 * Addressed into areas from outside by area id, the house pattern. Gated by the Chronicle where
 * a place should not be lootable before it has been earned: a shut cache keeps its furniture
 * standing and loses its prompt, so the room still has a strongbox in it and the strongbox
 * still says nothing.
 *
 * Pure: no three.js, no DOM -- `save.ts` reads the registry to drop ids that no longer exist.
 */

import type { BuffId } from '../core/overworld/state.js';
import { BREW_NAMES } from '../core/overworld/run.js';
import { reagentById } from '../core/data/splicing.js';
import type { DressingId } from './dressing.js';
import type { Gate } from './chronicle.js';

/** What a cache pays. The same shape as an errand's reward, on purpose. */
export interface CacheLoot {
  readonly ducats?: number;
  readonly marrowShards?: number;
  readonly reagents?: Readonly<Record<string, number>>;
  readonly brew?: BuffId;
}

export interface CacheDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to open it. Walkable, clear of the furniture including its own. */
  readonly at: { readonly x: number; readonly z: number };
  /** The thing itself. Always drawn; the prompt is what comes and goes. */
  readonly prop: {
    readonly kind: DressingId;
    readonly x: number;
    readonly z: number;
    readonly yaw?: number;
  };
  /** The interact prompt: "Open the chest". */
  readonly label: string;
  /** One line more, under the prompt. Where it came from, if the place knows. */
  readonly detail?: string;
  readonly loot: CacheLoot;
  /** When it can be opened. Absent means always. */
  readonly gate?: Gate;
}

export const CACHES: readonly CacheDef[] = [
  {
    id: 'ashfall_ward:alley_cache',
    areaId: 'ashfall_ward',
    at: { x: 27.8, z: -6 },
    prop: { kind: 'chest', x: 30, z: -6 },
    label: 'Open the chest',
    detail: 'Left in the back alley. Nobody has come back for it.',
    loot: { ducats: 15, marrowShards: 1 },
  },
  {
    id: 'ashfall_ironworks:scrap_chest',
    areaId: 'ashfall_ironworks',
    at: { x: -22.2, z: 18 },
    prop: { kind: 'chest', x: -24, z: 18 },
    label: 'Open the scrap chest',
    detail: "Offcuts the bench does not want. The Artificer will not miss them.",
    loot: { ducats: 25, reagents: { core_pyre: 1 } },
  },
  {
    id: 'ashfall_apothecary:cellar_urn',
    areaId: 'ashfall_apothecary',
    at: { x: 19.8, z: 18 },
    prop: { kind: 'urn', x: 22, z: 18 },
    label: 'Look in the urn',
    detail: 'Sealed with wax, and the wax is broken.',
    loot: { brew: 'ironbrew' },
  },
  {
    // The clerks' strongbox, and it stays shut until the ward's first contract has shown the
    // Magistracy what you are for. Standing in the room from the first visit, saying nothing.
    id: 'ashfall_records:strongbox',
    areaId: 'ashfall_records',
    at: { x: 19.8, z: -18 },
    prop: { kind: 'chest', x: 22, z: -18 },
    label: 'Open the strongbox',
    detail: 'The arrears, in coin. The clerk has turned her back on purpose.',
    loot: { ducats: 60, marrowShards: 2 },
    gate: { after: ['curfew_breakers'] },
  },
];

export const cacheById = (id: string): CacheDef | undefined => CACHES.find((c) => c.id === id);

export const cachesInArea = (areaId: string): readonly CacheDef[] =>
  CACHES.filter((c) => c.areaId === areaId);

/** "Found: 25 Ducats, 1 Pyre Core." -- the line that says what you found, in the game's names. */
export function describeLoot(loot: CacheLoot): string {
  const parts: string[] = [];
  if (loot.ducats) parts.push(`${loot.ducats} Ducats`);
  if (loot.marrowShards) {
    parts.push(`${loot.marrowShards} Marrow Shard${loot.marrowShards === 1 ? '' : 's'}`);
  }
  for (const [id, n] of Object.entries(loot.reagents ?? {})) {
    if (n > 0) parts.push(`${n} ${reagentById(id)?.name ?? id}`);
  }
  if (loot.brew) parts.push(BREW_NAMES[loot.brew]);
  return parts.length > 0 ? `Found: ${parts.join(', ')}.` : 'Empty.';
}
