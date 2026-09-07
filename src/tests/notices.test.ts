/**
 * The things you can read, and the rule that every one of them is somewhere you can stand.
 */

import { describe, expect, it } from 'vitest';
import { NOTICES, noticeById, noticesInArea } from '../district/notices.js';
import { NOTHING_HAPPENED, gateOpen, type Chronicle } from '../district/chronicle.js';
import { areaById } from '../district/areas/index.js';
import { ColliderSet } from '../district/collision.js';
import { staticFootprints } from '../district/footprints.js';
import { isWalkable } from '../district/map.js';
import { isDressingId } from '../district/dressing.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';

const walked = (...ids: string[]): Chronicle => ({ campaign: ids, flags: [] });

describe('the notices', () => {
  it('names itself the way sites do, and never twice', () => {
    const ids = NOTICES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of NOTICES) expect(n.id.startsWith(`${n.areaId}:`), n.id).toBe(true);
    expect(noticeById(NOTICES[0]!.id)).toBe(NOTICES[0]);
  });

  it('has a title and something under it, every one', () => {
    for (const n of NOTICES) {
      expect(n.title.trim(), n.id).not.toBe('');
      expect(n.lines.length, `${n.id} is a title with nothing under it`).toBeGreaterThan(0);
      for (const l of n.lines) expect(l.trim(), n.id).not.toBe('');
      expect(n.label.trim(), n.id).not.toBe('');
    }
  });

  it('stands in a real area, on ground a person can stand on', () => {
    for (const n of NOTICES) {
      const area = areaById(n.areaId);
      expect(area, n.id).toBeDefined();
      expect(isWalkable(area!, n.at.x, n.at.z), `${n.id} at`).toBe(true);
      const set = new ColliderSet(area!);
      for (const f of staticFootprints(area!)) set.add(f.x, f.z, f.w, f.d, f.tag);
      expect(set.blocked(n.at.x, n.at.z, 0.4), `${n.id}: furniture where you read it`).toBe(false);
    }
  });

  it('is written on a thing the world can draw, standing inside the map', () => {
    for (const n of NOTICES) {
      if (!n.prop) continue;
      const area = areaById(n.areaId)!;
      expect(isDressingId(n.prop.kind), `${n.id}: ${n.prop.kind}`).toBe(true);
      expect(Math.abs(n.prop.x), n.id).toBeLessThanOrEqual(area.halfX);
      expect(Math.abs(n.prop.z), n.id).toBeLessThanOrEqual(area.halfZ);
      // Near enough to read: the prop is what the prompt points at.
      expect(Math.hypot(n.prop.x - n.at.x, n.prop.z - n.at.z), `${n.id}: prop far from reader`).toBeLessThanOrEqual(4);
    }
  });

  it('gates only on contracts that exist, and every gate can open', () => {
    const ids = new Set(ENCOUNTERS.map((e) => e.id));
    for (const n of NOTICES) {
      for (const id of [...(n.gate?.after ?? []), ...(n.gate?.before ?? [])]) {
        expect(ids.has(id), `${n.id} gates on '${id}'`).toBe(true);
      }
      if (n.gate?.after) expect(gateOpen(n.gate, walked(...n.gate.after))).toBe(true);
    }
  });

  it('puts one thing on each lectern, and the deeper one first', () => {
    // Two notices may share an `at`; the first whose gate is open stands there. So the gated
    // one must come first in the file, or it can never be read.
    for (const n of NOTICES) {
      const twins = NOTICES.filter((o) => o.areaId === n.areaId && o.at.x === n.at.x && o.at.z === n.at.z);
      if (twins.length < 2) continue;
      const ungated = twins.findIndex((t) => !t.gate);
      const gated = twins.findIndex((t) => t.gate);
      if (ungated >= 0 && gated >= 0) expect(gated, `${n.id}: the gated notice is shadowed`).toBeLessThan(ungated);
    }
    const before = noticesInArea('ashfall_records', NOTHING_HAPPENED).map((n) => n.id);
    const after = noticesInArea('ashfall_records', walked('hollow_census')).map((n) => n.id);
    expect(before).toContain('ashfall_records:census_roll');
    expect(before).not.toContain('ashfall_records:census_roll_after');
    expect(after).toContain('ashfall_records:census_roll_after');
    expect(after).not.toContain('ashfall_records:census_roll');
  });

  it('reaches the street as well as the rooms', () => {
    expect(NOTICES.some((n) => !areaById(n.areaId)?.indoor), 'nothing posted outdoors').toBe(true);
    expect(NOTICES.some((n) => areaById(n.areaId)?.indoor), 'nothing to read indoors').toBe(true);
  });
});
