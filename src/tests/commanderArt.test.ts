/**
 * The Commanders standing beside the board, and finding the art to draw them with.
 *
 * They were geometry: a dashed dais with a prism for the Hero and a bobbing orb for the beast,
 * drawn by `shapes.drawCommander` — while the *painted* `drawCommander` in `sprites.ts` sat one
 * import away, used only by the character creation screen. Two functions of the same name, and
 * the combat board reached for the wrong one for as long as both existed.
 *
 * What is checked here is the part that can silently rot: the lookups that turn a fight into a
 * picture. The blitting itself is canvas work with no meaningful assertion available in this
 * environment, and it is verified on screen instead.
 */

import { describe, expect, it } from 'vitest';
import { COMPANIONS, companionById, companionByUnitCard } from '../core/data/companions.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { commanderSpriteSrc, companionSpriteSrc } from '../render/sprites.js';

describe('finding the species behind a Bound Form', () => {
  it('round-trips every species through its own unit card', () => {
    for (const species of COMPANIONS) {
      const found = companionByUnitCard(species.unitCardId);
      expect(found?.id, `${species.id} -> ${species.unitCardId}`).toBe(species.id);
    }
  });

  it('is unambiguous — no two species claim the same Bound Form', () => {
    // The lookup returns the first match, so a duplicate would silently give one species the
    // other's art. Cheap to state and impossible to notice by eye across seventeen entries.
    const seen = new Map<string, string>();
    for (const species of COMPANIONS) {
      const prior = seen.get(species.unitCardId);
      expect(prior, `${species.unitCardId} is claimed by both ${prior} and ${species.id}`).toBe(
        undefined,
      );
      seen.set(species.unitCardId, species.id);
    }
  });

  it('misses cleanly for a unit card that is nobody', () => {
    // A miss is the ordinary case for most of the card database and must not throw — the caller
    // falls back to the procedural body.
    expect(companionByUnitCard('vanguard_footman')).toBeUndefined();
    expect(companionByUnitCard('')).toBeUndefined();
  });
});

describe('what the enemy Commander can be drawn as', () => {
  const withBeast = ENCOUNTERS.filter((e) => e.enemyCompanion?.unitCardId);

  it('resolves to painted art for the great majority of fights', () => {
    // Not all of them, deliberately. `umbra_bound`, `ignis_drake_bound` and `lexis_bound` are
    // named antagonists rather than one of the tameable bloodlines, so no species claims them
    // and they keep the prism — which is arguably the better answer for something the player
    // has never bound. This asserts the *coverage* rather than demanding totality, so a change
    // that quietly broke the lookup for everybody still fails.
    const resolved = withBeast.filter((e) => companionByUnitCard(e.enemyCompanion!.unitCardId));
    expect(withBeast.length, 'fights with an enemy Companion').toBeGreaterThan(20);
    expect(resolved.length / withBeast.length).toBeGreaterThan(0.8);
  });

  it('names a real file for every one it does resolve', () => {
    // `spriteAssets.test.ts` already walks species against the folder; this checks the path
    // *this* feature builds is the same one that was walked, rather than a second convention.
    for (const enc of withBeast) {
      const species = companionByUnitCard(enc.enemyCompanion!.unitCardId);
      if (!species) continue;
      const src = companionSpriteSrc(species.id, 'front');
      expect(src, `${enc.id}`).toBe(
        `/assets/sprites/companions/${species.artId ?? species.id}-front.png`,
      );
    }
  });
});

describe('the player side', () => {
  it('builds a hero path for both bearings', () => {
    expect(commanderSpriteSrc('female', 'front')).toBe('/assets/sprites/hero-female-front.png');
    expect(commanderSpriteSrc('male', 'front')).toBe('/assets/sprites/hero-male-front.png');
  });

  it('routes a founder and a wild bloodline through the same call', () => {
    // The founders' art is filed under their ids and the wild bloodlines' under their titles.
    // The board asks for art by companion id and must get both right, which is what `artId`
    // is for — this is the assertion that the board is going through it.
    expect(companionSpriteSrc('ignis', 'front')).toBe(
      '/assets/sprites/companions/ignis-front.png',
    );
    const wild = COMPANIONS.find((c) => c.artId && c.artId !== c.id);
    expect(wild, 'there is a species whose art is filed under a different name').toBeDefined();
    expect(companionSpriteSrc(wild!.id, 'front')).toBe(
      `/assets/sprites/companions/${wild!.artId}-front.png`,
    );
    expect(companionById(wild!.id)?.artId).toBe(wild!.artId);
  });
});
