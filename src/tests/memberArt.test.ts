/**
 * The bodies a pack shows on the road, and the shapes they are drawn in.
 *
 * The drawings need a canvas and are looked at in the browser; what is asked here is the part
 * that can be wrong silently -- a shape table naming a card that does not exist, or a pack whose
 * road bodies are not its members.
 */

import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import { PACKS } from '../core/data/packs.js';
import { packBodies, shapeOf } from '../district/memberArt.js';

describe('the bodies on the road', () => {
  it('shows every pack as a group of its own members, leader first', () => {
    for (const pack of PACKS) {
      const bodies = packBodies(pack.encounterId);
      expect(bodies.length, pack.encounterId).toBeGreaterThanOrEqual(Math.min(3, pack.members.length));
      expect(bodies.length, pack.encounterId).toBeLessThanOrEqual(4);
      expect(bodies[0], `${pack.encounterId} is led by its first member`).toBe(pack.members[0]);
      // No more of any kind than the pack actually has.
      for (const b of new Set(bodies)) {
        expect(bodies.filter((x) => x === b).length).toBeLessThanOrEqual(pack.members.filter((x) => x === b).length);
      }
    }
  });

  it('shows every kind a pack fields, where it fields up to four', () => {
    const strays = packBodies('pack_verge_stray_dogs');
    expect(new Set(strays).size).toBe(4);
  });

  it('draws nothing for an encounter that is not a pack', () => {
    expect(packBodies('not_a_pack')).toEqual([]);
  });

  it('names only real cards in its shape table, and draws hounds on four legs', () => {
    for (const pack of PACKS) for (const m of pack.members) expect(CARDS[m], m).toBeDefined();
    expect(shapeOf('ember_hound')).toBe('beast');
    expect(shapeOf('carrion_crow')).toBe('flyer');
    expect(shapeOf('storm_wisp')).toBe('wisp');
    expect(shapeOf('slag_iron_golem')).toBe('construct');
    expect(shapeOf('vanguard_footman')).toBe('humanoid');
    // A card id nobody drew a shape for is a person, which is what everything was before.
    expect(shapeOf('no_such_card')).toBe('humanoid');
  });
});
