/**
 * Creature art: every drawing the game will ask for is on disk, and every drawing on disk is
 * claimed and licensed.
 *
 * The licence half is the one that matters most and the one nothing else would catch. A
 * CC-BY drawing shipped without its credit is a broken licence that looks exactly like a
 * working game.
 */

import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CREATURE_ART,
  LICENCES,
  creatureArtFor,
  creatureArtPath,
  facingPlan,
  type CreatureArt,
} from '../core/data/art.js';
import { CARDS, ascendedId } from '../core/data/cards/index.js';

const MINION_DIR = 'public/assets/sprites/minions';

const WOLF: CreatureArt = {
  file: 'test_wolf',
  facings: ['side'],
  style: 'pixel',
  title: 'Test Wolf',
  author: 'Somebody',
  source: 'https://example.org/wolf',
  licence: 'CC-BY-3.0',
};

describe('the creature art registry', () => {
  it('names only real cards with a body', () => {
    for (const cardId of Object.keys(CREATURE_ART)) {
      expect(CARDS[cardId], cardId).toBeDefined();
      expect(CARDS[cardId]!.unit, `${cardId} has no body to draw`).toBeDefined();
    }
  });

  it('has every drawn view on disk', () => {
    for (const [cardId, art] of Object.entries(CREATURE_ART)) {
      expect(art.facings.length, `${cardId} draws nothing`).toBeGreaterThan(0);
      for (const facing of art.facings) {
        const path = `public/${creatureArtPath(art, facing)}`;
        expect(existsSync(path), `${cardId}: ${path}`).toBe(true);
      }
    }
  });

  it('claims every drawing on disk', () => {
    // A PNG nobody listed is a PNG nobody credited. The reverse direction of the test above.
    if (!existsSync(MINION_DIR)) return;
    const claimed = new Set(
      Object.values(CREATURE_ART).flatMap((art) => art.facings.map((f) => creatureArtPath(art, f))),
    );
    const onDisk = readdirSync(MINION_DIR)
      .filter((f) => f.endsWith('.png'))
      .map((f) => `assets/sprites/minions/${f}`);
    expect(onDisk.filter((p) => !claimed.has(p)), 'unclaimed drawings').toEqual([]);
  });

  it('carries a licence the game accepts, and an author wherever one is owed', () => {
    for (const [cardId, art] of Object.entries(CREATURE_ART)) {
      expect(LICENCES[art.licence], `${cardId} licence`).toBeDefined();
      expect(art.source, `${cardId} source`).toMatch(/^https:\/\//);
      expect(art.title.trim(), `${cardId} title`).not.toBe('');
      if (LICENCES[art.licence].attribution) {
        expect(art.author.trim(), `${cardId} is owed a credit`).not.toBe('');
      }
    }
  });

  it('only ever accepts CC0 and attribution-only licences', () => {
    // The whole list, pinned. Adding a licence is a decision about the game, and it should
    // arrive as a change to this test rather than as one more line in a union.
    expect(Object.keys(LICENCES).sort()).toEqual(['CC-BY-3.0', 'CC-BY-4.0', 'CC0-1.0', 'OGA-BY-3.0']);
  });

  it('dresses a Rank 2 printing in its base card’s drawing', () => {
    const registry = { vanguard_footman: WOLF };
    expect(creatureArtFor(ascendedId('vanguard_footman'), registry)).toBe(WOLF);
    expect(creatureArtFor('vanguard_footman', registry)).toBe(WOLF);
    expect(creatureArtFor('scout_imp', registry)).toBeUndefined();
  });
});

describe('standing in for a missing view', () => {
  it('turns a profile-only animal to camera side-on, and flips it for the other bearing', () => {
    expect(facingPlan(WOLF)).toEqual({ front: 'side', back: 'side', side: 'side', mirrorSide: true });
  });

  it('never mirrors a front-on pose to stand in for a profile', () => {
    const pose: CreatureArt = { ...WOLF, facings: ['front'] };
    expect(facingPlan(pose)).toEqual({ front: 'front', back: 'front', side: 'front', mirrorSide: false });
  });

  it('uses every view that was drawn', () => {
    const full: CreatureArt = { ...WOLF, facings: ['front', 'back', 'side'] };
    expect(facingPlan(full)).toEqual({ front: 'front', back: 'back', side: 'side', mirrorSide: true });
  });
});
