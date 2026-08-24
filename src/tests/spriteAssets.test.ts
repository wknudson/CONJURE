/**
 * Every sprite the game will ask for is on disk, under exactly that name.
 *
 * `creation.test.ts` already checks the six starters, which is what the creation screen
 * shows. That was not enough: the campaign hands out ten more bloodlines as subjugation
 * prizes, and every one of them was filed under its title (`chimera_of_the_caldera`) while
 * the loader asked for its id (`chimera`). A bound Chimera 404ed, took the district's
 * whole actor batch down with it, and left a soft-locked ward — with CI green throughout,
 * because nothing walked the species registry against the folder.
 *
 * This does. The path under test is the real one (`companionSpriteSrc`), so a rename on
 * either side — the file, or the `artId` that points at it — fails here.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { companionSpriteSrc } from '../render/sprites.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';

/** `/assets/...` as the browser asks for it -> the file on disk that serves it. */
const onDisk = (src: string): string => `public${src}`;

describe('companion art', () => {
  it('exists for every species the registry knows', () => {
    const missing = COMPANIONS.filter((c) => !existsSync(onDisk(companionSpriteSrc(c.id))));
    expect(
      missing.map((c) => `${c.id} -> ${companionSpriteSrc(c.id)}`),
      'species whose front sprite the loader cannot fetch',
    ).toEqual([]);
  });

  it('exists for every species a contract can award', () => {
    // The prize path is the one that broke: a beast you are given becomes the active
    // companion, and the district loads its art on the very next street.
    const prizes = ENCOUNTERS.map((e) => e.subjugationPrize).filter(
      (p): p is string => typeof p === 'string',
    );
    expect(prizes.length, 'the campaign awards beasts').toBeGreaterThan(0);

    for (const id of prizes) {
      expect(companionById(id), `${id} is a real species`).toBeDefined();
      for (const facing of ['front', 'back', 'side'] as const) {
        expect(
          existsSync(onDisk(companionSpriteSrc(id, facing))),
          `${id} ${facing}: ${companionSpriteSrc(id, facing)}`,
        ).toBe(true);
      }
    }
  });

  it('resolves through the species, not the raw id', () => {
    // The bug in one line: these two differ for every wild bloodline, and the loader used
    // to use the left-hand one.
    expect(companionSpriteSrc('chimera')).toBe(
      '/assets/sprites/companions/chimera_of_the_caldera-front.png',
    );
    expect(companionSpriteSrc('sovereign')).toBe(
      '/assets/sprites/companions/bone_bastion_sovereign-front.png',
    );
    // A founder is filed under its id, so it passes straight through.
    expect(companionSpriteSrc('ignis')).toBe('/assets/sprites/companions/ignis-front.png');
    // An id nothing knows falls through to itself rather than throwing — test arenas and
    // fixtures name species that were never in the registry.
    expect(companionSpriteSrc('not_a_species')).toBe(
      '/assets/sprites/companions/not_a_species-front.png',
    );
  });
});
