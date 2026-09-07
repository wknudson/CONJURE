/**
 * The things that grow back: what they pay, when they come back, and what bites.
 */

import { describe, expect, it } from 'vitest';
import {
  FORAGE_KINDS,
  FORAGE_NODES,
  forageBite,
  forageInArea,
  forageLabel,
  forageNodeById,
  foragePropAt,
  forageReady,
  forageRemaining,
  rollForage,
  type ForageKind,
} from '../district/forage.js';
import { areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';
import { DRESSING, isDressingId } from '../district/dressing.js';
import { reagentById } from '../core/data/splicing.js';
import { isBuffId } from '../core/overworld/state.js';
import { isPack } from '../core/data/packs.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';

const KINDS = Object.keys(FORAGE_KINDS) as ForageKind[];

describe('the kinds', () => {
  it('each stand for a piece of furniture the world can draw', () => {
    for (const k of KINDS) expect(isDressingId(FORAGE_KINDS[k].prop), k).toBe(true);
  });

  it('pay in the currencies the purse has, every row, and never nothing', () => {
    for (const k of KINDS) {
      const kind = FORAGE_KINDS[k];
      expect(kind.yields.length, k).toBeGreaterThan(0);
      for (const y of kind.yields) {
        expect(y.weight, `${k} weight`).toBeGreaterThan(0);
        const { ducats = 0, marrowShards = 0, reagents = {}, brew } = y.loot;
        for (const [id, n] of Object.entries(reagents)) {
          expect(reagentById(id), `${k} pays '${id}'`).toBeDefined();
          expect(n).toBeGreaterThan(0);
        }
        if (brew) expect(isBuffId(brew), `${k} pays '${brew}'`).toBe(true);
        expect(ducats + marrowShards + Object.keys(reagents).length + (brew ? 1 : 0), `${k} pays nothing`).toBeGreaterThan(0);
      }
      expect(kind.cooldownHours, `${k} cooldown`).toBeGreaterThanOrEqual(6);
      expect(kind.cooldownHours, `${k} cooldown`).toBeLessThanOrEqual(72);
    }
  });

  it('bite with packs that exist, at a chance that is a chance', () => {
    // A bite is an ambush through the screen's own `ambush()`, and `onPack` looks the id up in
    // `PACKS`; anything else declines the fight and silently unlocks input.
    for (const k of KINDS) {
      const bite = FORAGE_KINDS[k].bite;
      if (!bite) continue;
      expect(isPack(bite.encounterId), `${k} bites with '${bite.encounterId}'`).toBe(true);
      expect(bite.chance).toBeGreaterThan(0);
      expect(bite.chance).toBeLessThanOrEqual(1);
      expect(bite.line.trim()).not.toBe('');
    }
    expect(KINDS.some((k) => FORAGE_KINDS[k].bite), 'something bites').toBe(true);
    expect(KINDS.some((k) => !FORAGE_KINDS[k].bite), 'something is safe').toBe(true);
  });
});

describe('the nodes', () => {
  it('name themselves the way sites do, and never twice', () => {
    const ids = FORAGE_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of FORAGE_NODES) expect(n.id.startsWith(`${n.areaId}:`), n.id).toBe(true);
    expect(forageNodeById(FORAGE_NODES[0]!.id)).toBe(FORAGE_NODES[0]);
    expect(forageInArea(FORAGE_NODES[0]!.areaId).length).toBeGreaterThan(0);
  });

  it('stand in a real area, on ground a person can stand on, beside their own furniture', () => {
    for (const n of FORAGE_NODES) {
      const area = areaById(n.areaId);
      expect(area, n.id).toBeDefined();
      expect(isWalkable(area!, n.at.x, n.at.z), `${n.id} at`).toBe(true);
      const prop = foragePropAt(n);
      const kind = FORAGE_KINDS[n.kind];
      if (DRESSING[kind.prop].collides) {
        expect(isWalkable(area!, prop.x, prop.z), `${n.id}: prop in a wall`).toBe(true);
      }
      expect(Math.abs(prop.x), n.id).toBeLessThanOrEqual(area!.halfX);
      expect(Math.abs(prop.z), n.id).toBeLessThanOrEqual(area!.halfZ);
      expect(Math.hypot(prop.x - n.at.x, prop.z - n.at.z), `${n.id}: prop far from picker`).toBeLessThanOrEqual(4);
      const set = new ColliderSet(area!);
      for (const f of staticFootprints(area!)) set.add(f.x, f.z, f.w, f.d, f.tag);
      expect(set.blocked(n.at.x, n.at.z, 0.4), `${n.id}: furniture where you pick it`).toBe(false);
    }
  });

  it('gate only on contracts that exist', () => {
    const ids = new Set(ENCOUNTERS.map((e) => e.id));
    for (const n of FORAGE_NODES) {
      for (const id of [...(n.gate?.after ?? []), ...(n.gate?.before ?? [])]) {
        expect(ids.has(id), `${n.id} gates on '${id}'`).toBe(true);
      }
    }
  });

  it('use every kind somewhere, so every prop is placed', () => {
    const used = new Set(FORAGE_NODES.map((n) => n.kind));
    expect(KINDS.filter((k) => !used.has(k))).toEqual([]);
  });

  it('take a per-node override of the bite, including none at all', () => {
    const bites = FORAGE_NODES.find((n) => FORAGE_KINDS[n.kind].bite && !n.bite)!;
    expect(forageBite(bites)?.encounterId).toBe(FORAGE_KINDS[bites.kind].bite!.encounterId);
    expect(forageBite({ ...bites, bite: { chance: 0 } })).toBeNull();
    expect(forageBite({ ...bites, bite: { chance: 0.5, encounterId: 'pack_road_waywatch' } })?.encounterId).toBe(
      'pack_road_waywatch',
    );
  });
});

describe('the clock a node keeps', () => {
  it('is ready when never picked, and when the stamp is in the future', () => {
    expect(forageReady(undefined, 10, 24)).toBe(true);
    expect(forageReady(NaN, 10, 24)).toBe(true);
    expect(forageReady(30, 10, 24)).toBe(true);
  });

  it('counts down in hours and comes back exactly on time', () => {
    expect(forageRemaining(10, 10, 24)).toBe(24);
    expect(forageRemaining(10, 22, 24)).toBe(12);
    expect(forageRemaining(10, 34, 24)).toBe(0);
    expect(forageReady(10, 33.9, 24)).toBe(false);
    expect(forageReady(10, 34, 24)).toBe(true);
  });

  it('never says zero and then refuses', () => {
    expect(forageLabel(0)).toBe('');
    expect(forageLabel(0.1)).toBe('back in 1h');
    expect(forageLabel(6.5)).toBe('back in 7h');
  });
});

describe('the roll', () => {
  const node = FORAGE_NODES[0]!;

  it('is the same roll for the same node in the same hour, and a real row of the table', () => {
    const a = rollForage(node, 100.2);
    const b = rollForage(node, 100.9);
    expect(a).toEqual(b);
    const table = FORAGE_KINDS[node.kind].yields.map((y) => y.loot);
    expect(table).toContainEqual(a.loot);
  });

  it('spreads across the table over a season rather than always paying the same row', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 400; h += 1) seen.add(JSON.stringify(rollForage(node, h).loot));
    expect(seen.size).toBe(FORAGE_KINDS[node.kind].yields.length);
  });

  it('never bites where nothing bites, and sometimes bites where something does', () => {
    const safe = FORAGE_NODES.find((n) => !forageBite(n))!;
    for (let h = 0; h < 200; h++) expect(rollForage(safe, h).bit).toBe(false);
    const biter = FORAGE_NODES.find((n) => forageBite(n))!;
    let bites = 0;
    for (let h = 0; h < 400; h++) if (rollForage(biter, h).bit) bites++;
    const chance = forageBite(biter)!.chance;
    expect(bites / 400).toBeGreaterThan(chance * 0.5);
    expect(bites / 400).toBeLessThan(chance * 1.6);
  });
});
