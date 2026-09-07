/**
 * Things that grow back: an herb patch, a seam of ore, a comb, a vent that breathes embers.
 *
 * The other half of `caches.ts`. A cache opens once; a node is picked and regrows on the
 * street clock -- `Profile.clock`, in hours, and deliberately not the wall clock the hunts
 * use. A bed advances the street clock and sleeping should regrow the herbs; a node on
 * wall-clock time would refill while the tab was closed and never while you slept. It also
 * keeps this file pure: no `Date.now()`, so a test can ask what a node does on day nine.
 *
 * What one yields is rolled with variance, and some of them **bite back**: a comb has wasps
 * in it, a seam has something living in the dark behind it. The bite is an ordinary pack
 * ambush through the screen's own `ambush()`, on a pack that already exists -- nothing new
 * enters the balance harness for a hornet's nest. The roll is seeded off the node and the
 * hour it was picked, so a reload cannot reroll a bite into a windfall.
 *
 * Addressed into areas from outside by area id, the house pattern. Pure: no three.js, no DOM.
 */

import type { CacheLoot } from './caches.js';
import type { DressingId } from './dressing.js';
import type { Gate } from './chronicle.js';
import { hashText } from '../core/util/rng.js';

/** What a node yields. The same purse an errand or a cache pays into. */
export type ForageYield = CacheLoot;

export type ForageKind = 'herbs' | 'fungi' | 'ore' | 'comb' | 'bone' | 'reeds' | 'ember';

export interface ForageKindDef {
  /** The furniture that is the node. Placed by `world.ts` through `registryProps`. */
  readonly prop: DressingId;
  /** The interact prompt: "Cut the herbs". */
  readonly label: string;
  /** One line under the prompt while it is ready. */
  readonly detail: string;
  /** Hours on the street clock before it can be picked again. */
  readonly cooldownHours: number;
  /** What it may yield, weighted. Rolled once per pick. */
  readonly yields: readonly { readonly weight: number; readonly loot: ForageYield }[];
  /** What it does when it bites, if this kind bites at all. `chance` is 0 to 1. */
  readonly bite?: { readonly chance: number; readonly encounterId: string; readonly line: string };
}

export const FORAGE_KINDS: Record<ForageKind, ForageKindDef> = {
  herbs: {
    prop: 'herbpatch',
    label: 'Cut the herbs',
    detail: 'Bloom grows where nobody weeds.',
    cooldownHours: 18,
    yields: [
      { weight: 3, loot: { ducats: 6 } },
      { weight: 2, loot: { reagents: { core_bloom: 1 } } },
      { weight: 1, loot: { ducats: 6, reagents: { core_bloom: 1 } } },
    ],
  },
  fungi: {
    prop: 'mushrooms',
    label: 'Gather the mushrooms',
    detail: 'Rot and shade. Some of them are the eating kind.',
    cooldownHours: 24,
    yields: [
      { weight: 3, loot: { ducats: 8 } },
      { weight: 2, loot: { reagents: { core_dusk: 1 } } },
      { weight: 1, loot: { marrowShards: 1 } },
    ],
  },
  ore: {
    prop: 'orevein',
    label: 'Work the seam',
    detail: 'Something in the rock catches the light.',
    cooldownHours: 36,
    yields: [
      { weight: 2, loot: { ducats: 14 } },
      { weight: 2, loot: { reagents: { core_bulwark: 1 } } },
      { weight: 1, loot: { reagents: { core_surge: 1 } } },
    ],
    bite: { chance: 0.15, encounterId: 'pack_spoil_heap_hollows', line: 'The seam was not empty.' },
  },
  comb: {
    prop: 'honeycomb',
    label: 'Take the comb',
    detail: 'Wild honey. Wild wasps.',
    cooldownHours: 30,
    yields: [
      { weight: 3, loot: { ducats: 12 } },
      { weight: 1, loot: { ducats: 12, reagents: { core_bloom: 1 } } },
    ],
    bite: { chance: 0.25, encounterId: 'pack_hedgerow_vermin', line: 'The comb was not the only thing in the hedge.' },
  },
  bone: {
    prop: 'bonepile',
    label: 'Pick through the bones',
    detail: 'Old bones, and one or two that are not.',
    cooldownHours: 30,
    yields: [
      { weight: 3, loot: { marrowShards: 1 } },
      { weight: 1, loot: { marrowShards: 2 } },
      { weight: 1, loot: { reagents: { core_dusk: 1 } } },
    ],
    bite: { chance: 0.2, encounterId: 'pack_verge_stray_dogs', line: 'Something had been keeping these.' },
  },
  reeds: {
    prop: 'reeds',
    label: 'Cut the reeds',
    detail: 'Thatch, matting, kindling. Somebody buys it.',
    cooldownHours: 12,
    yields: [
      { weight: 4, loot: { ducats: 5 } },
      { weight: 1, loot: { ducats: 5, reagents: { core_frost: 1 } } },
    ],
  },
  ember: {
    prop: 'embervent',
    label: 'Rake the vent',
    detail: 'The furnace breathes out through the floor. What it coughs up is worth having.',
    cooldownHours: 24,
    yields: [
      { weight: 2, loot: { ducats: 10 } },
      { weight: 2, loot: { reagents: { core_pyre: 1 } } },
      { weight: 1, loot: { ducats: 10, reagents: { core_pyre: 1 } } },
    ],
    bite: { chance: 0.12, encounterId: 'pack_verge_stray_dogs', line: 'The heat brought them in off the street.' },
  },
};

export interface ForageNode {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  readonly kind: ForageKind;
  /** Where you stand to pick it. Walkable, clear of the furniture including its own. */
  readonly at: { readonly x: number; readonly z: number };
  /** Where the prop stands. Absent means on the spot itself, a stride further from the door. */
  readonly prop?: { readonly x: number; readonly z: number; readonly yaw?: number };
  /** Per-node override of the kind's bite. `{ chance: 0 }` disarms a kind that usually bites. */
  readonly bite?: { readonly chance: number; readonly encounterId?: string; readonly line?: string };
  readonly gate?: Gate;
}

export const FORAGE_NODES: readonly ForageNode[] = [
  {
    id: 'ashfall_ward:quay_reeds',
    areaId: 'ashfall_ward',
    kind: 'reeds',
    at: { x: 20, z: -46 },
    prop: { x: 20, z: -48.4 },
  },
  {
    id: 'ashfall_ward:churchyard_herbs',
    areaId: 'ashfall_ward',
    kind: 'herbs',
    at: { x: -38, z: 50 },
  },
  {
    id: 'ashfall_ironworks:ember_vent',
    areaId: 'ashfall_ironworks',
    kind: 'ember',
    at: { x: -14, z: -10 },
    prop: { x: -14, z: -13.2 },
  },
  {
    id: 'ashfall_vivarium:hedge_comb',
    areaId: 'ashfall_vivarium',
    kind: 'comb',
    at: { x: -22, z: 6 },
    prop: { x: -22, z: 3.6 },
  },

  /* --- Lamprow ----------------------------------------------------------------------- */
  {
    id: 'lamprow:cut_reeds',
    areaId: 'lamprow',
    kind: 'reeds',
    at: { x: -2, z: -42 },
    prop: { x: -2, z: -45 },
  },
  {
    id: 'lamprow:garden_herbs',
    areaId: 'lamprow',
    kind: 'herbs',
    at: { x: -16, z: 36 },
  },

  /* --- the Bonemarket ---------------------------------------------------------------- */
  {
    id: 'bonemarket:boilers_bones',
    areaId: 'bonemarket',
    kind: 'bone',
    at: { x: -26, z: 34 },
    prop: { x: -28.2, z: 34 },
    // The boiler's heap, not a barrow's: nothing has been keeping these but him.
    bite: { chance: 0 },
  },
  {
    id: 'bonemarket:eaves_comb',
    areaId: 'bonemarket',
    kind: 'comb',
    at: { x: 52, z: 34 },
    prop: { x: 52, z: 31.6 },
  },

  /* --- Ward Seven -------------------------------------------------------------------- */
  {
    id: 'ward_seven:seep_reeds',
    areaId: 'ward_seven',
    kind: 'reeds',
    at: { x: 26, z: 22 },
    prop: { x: 26, z: 19.6 },
  },
  {
    id: 'ward_seven:bank_herbs',
    areaId: 'ward_seven',
    kind: 'herbs',
    at: { x: 6, z: -34 },
  },

  /* --- the Chalk Verge, and the road ------------------------------------------------- */
  {
    // In the spoil by the gate. What the dogs have been keeping.
    id: 'chalk_verge:spoil_bones',
    areaId: 'chalk_verge',
    kind: 'bone',
    at: { x: 38, z: 6 },
    prop: { x: 40.2, z: 6 },
  },
  {
    id: 'chalk_verge:thicket_fungi',
    areaId: 'chalk_verge',
    kind: 'fungi',
    at: { x: -14, z: -2 },
    prop: { x: -11.8, z: -4 },
  },
  {
    // In the west hedge, where the vermin are, which the bite already knows.
    id: 'chalk_road:hedge_comb',
    areaId: 'chalk_road',
    kind: 'comb',
    at: { x: -66, z: -6 },
    prop: { x: -66, z: -8.2 },
  },

  /* --- Millharrow, and the Levels ---------------------------------------------------- */
  {
    id: 'millharrow:north_strip_herbs',
    areaId: 'millharrow',
    kind: 'herbs',
    at: { x: 30, z: -42 },
    prop: { x: 32.2, z: -42 },
  },
  {
    id: 'millharrow:south_hedge_comb',
    areaId: 'millharrow',
    kind: 'comb',
    at: { x: -50, z: 42 },
    prop: { x: -50, z: 44.2 },
  },
  {
    // Reeds through the boards of the flooded end. Something is in there until the contract is
    // fought, and the bite says so.
    id: 'millharrow_granary:the_reeds',
    areaId: 'millharrow_granary',
    kind: 'reeds',
    at: { x: -18, z: -10 },
    prop: { x: -18, z: -13.8 },
    bite: { chance: 0.3, encounterId: 'pack_hedgerow_vermin', line: 'The flooded end was not as empty as it looked.' },
  },
  {
    id: 'tallow_levels:west_bank_reeds',
    areaId: 'tallow_levels',
    kind: 'reeds',
    at: { x: -30, z: -2 },
    prop: { x: -32.2, z: -2 },
  },
  {
    // The rendering yard's bone heap. Dogs, obviously.
    id: 'tallow_levels:rendering_bones',
    areaId: 'tallow_levels',
    kind: 'bone',
    at: { x: 34, z: 42 },
    prop: { x: 36.2, z: 42 },
  },

  /* --- Highcourt --------------------------------------------------------------------- */
  {
    // In the weeds of the service end: the one thing on the court's ground the court did not plant.
    id: 'highcourt:service_herbs',
    areaId: 'highcourt',
    kind: 'herbs',
    at: { x: -42, z: 38 },
  },

  /* --- the country ------------------------------------------------------------------ */
  {
    // Where the pavement stops, the first thing that grows without permission.
    id: 'chalk_verge:verge_herbs',
    areaId: 'chalk_verge',
    kind: 'herbs',
    at: { x: -6, z: -26 },
  },
  {
    id: 'cinderworks:slag_seam',
    areaId: 'cinderworks',
    kind: 'ore',
    at: { x: -30, z: 38 },
    prop: { x: -32.2, z: 38 },
  },
  {
    id: 'cinderworks:terrace_vent',
    areaId: 'cinderworks',
    kind: 'ember',
    at: { x: 10, z: 42 },
    prop: { x: 10, z: 39.6 },
  },
  {
    id: 'cinderworks:spur_vent',
    areaId: 'cinderworks',
    kind: 'ember',
    at: { x: 46, z: 38 },
    prop: { x: 46, z: 35.6 },
  },
  {
    // Inside the Hall, by the east wall: what the furnace bank does not draw.
    id: 'cinderworks_foundry:hall_vent',
    areaId: 'cinderworks_foundry',
    kind: 'ember',
    at: { x: 14, z: 4 },
    prop: { x: 14, z: 1 },
  },
  {
    id: 'bone_bastion:barrow_bones',
    areaId: 'bone_bastion',
    kind: 'bone',
    at: { x: -10, z: -46 },
    prop: { x: -12.2, z: -46 },
  },
  {
    id: 'ashwood:rot_ring',
    areaId: 'ashwood',
    kind: 'fungi',
    at: { x: -30, z: -46 },
  },
];

export const forageNodeById = (id: string): ForageNode | undefined =>
  FORAGE_NODES.find((n) => n.id === id);

export const forageInArea = (areaId: string): readonly ForageNode[] =>
  FORAGE_NODES.filter((n) => n.areaId === areaId);

/** Where a node's furniture stands. */
export function foragePropAt(node: ForageNode): { x: number; z: number; yaw?: number } {
  return node.prop ?? { x: node.at.x, z: node.at.z };
}

/**
 * Whether a node can be picked, against the street clock.
 *
 * `undefined` is never picked. A stamp in the *future* -- a save from a character whose
 * clock was later wound back, or a hand-edited file -- reads as ready rather than as locked
 * for a day nobody can wait out; the same rule `huntCooldownRemaining` keeps for its clock.
 */
export function forageReady(last: number | undefined, clock: number, cooldownHours: number): boolean {
  return forageRemaining(last, clock, cooldownHours) === 0;
}

/** Hours until it can be picked again, 0 when it can. */
export function forageRemaining(last: number | undefined, clock: number, cooldownHours: number): number {
  if (last === undefined || !Number.isFinite(last)) return 0;
  if (last > clock) return 0;
  return Math.max(0, cooldownHours - (clock - last));
}

/** "back in 7h", rounded up so it never says zero and then refuses. */
export function forageLabel(remainingHours: number): string {
  if (remainingHours <= 0) return '';
  return `back in ${Math.ceil(remainingHours)}h`;
}

/** The bite a node carries, after its own override, or null if it does not bite. */
export function forageBite(node: ForageNode): { chance: number; encounterId: string; line: string } | null {
  const kind = FORAGE_KINDS[node.kind];
  const chance = node.bite?.chance ?? kind.bite?.chance ?? 0;
  const encounterId = node.bite?.encounterId ?? kind.bite?.encounterId;
  if (chance <= 0 || !encounterId) return null;
  return { chance, encounterId, line: node.bite?.line ?? kind.bite?.line ?? 'Something was in there.' };
}

/**
 * What one pick of this node yields, and whether it bit.
 *
 * Seeded off the node and the whole hour it was picked in, so a reload between the roll and
 * the write cannot try again for a kinder answer. Two picks in the same hour are the same
 * roll, which the cooldown makes unreachable anyway.
 */
export function rollForage(node: ForageNode, clock: number): { loot: ForageYield; bit: boolean } {
  const kind = FORAGE_KINDS[node.kind];
  const seed = hashText(`${node.id}:${Math.floor(clock)}`) >>> 0;
  // Two draws off one hash: the low bits pick the yield, the high bits decide the bite.
  const a = (seed & 0xffff) / 0x10000;
  const b = (seed >>> 16) / 0x10000;
  const total = kind.yields.reduce((s, y) => s + y.weight, 0);
  let roll = a * total;
  let loot: ForageYield = kind.yields[kind.yields.length - 1]!.loot;
  for (const y of kind.yields) {
    if (roll < y.weight) {
      loot = y.loot;
      break;
    }
    roll -= y.weight;
  }
  const bite = forageBite(node);
  return { loot, bit: bite !== null && b < bite.chance };
}
