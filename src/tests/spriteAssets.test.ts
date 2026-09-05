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

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import {
  commanderSpriteSrc,
  commanderWalkSrc,
  companionSpriteSrc,
  WALK_FRAMES,
} from '../render/sprites.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';

/** `/assets/...` as the browser asks for it -> the file on disk that serves it. */
const onDisk = (src: string): string => `public${src}`;

/**
 * A PNG's own width and height, read off its IHDR chunk rather than decoded.
 *
 * The signature is 8 bytes, the first chunk is always IHDR, and its length+type header is
 * another 8 — width and height are the four-byte big-endian pair right after that, decoded
 * without pulling in an image library or a DOM `Image` neither of which this suite has.
 */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

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

describe('hero art', () => {
  it('exists for every standing bearing, both genders', () => {
    const missing: string[] = [];
    for (const gender of ['male', 'female'] as const) {
      for (const facing of ['front', 'back', 'side'] as const) {
        const src = commanderSpriteSrc(gender, facing);
        if (!existsSync(onDisk(src))) missing.push(src);
      }
    }
    expect(missing, 'standing hero sprites the loader cannot fetch').toEqual([]);
  });

  it('shares one aspect ratio across the female side-walk frames', () => {
    // `BillboardSprite` fixes the drawn *height* and derives width from each texture's own
    // aspect ratio (`aspectOf`) — so four independently-cropped frames at four slightly
    // different aspect ratios is not a cosmetic quirk, it is the character visibly changing
    // width every frame she takes a step, at a fixed height. The male bearing cannot have
    // this problem: `buildSheetActorArt` cuts every one of its twenty frames to the same
    // `WALK_SHEET_CONTENT` box by construction. The female bearing has no shared box — her
    // four frames are separate files — so the aspect ratio has to be pinned down here
    // instead, against the files themselves rather than against `buildActorArt`'s arithmetic
    // (which `districtWalk.test.ts` already covers with same-sized fixture images and so
    // could not have caught a real file mismatch).
    const sizes = Array.from({ length: WALK_FRAMES }, (_u, n) =>
      pngSize(onDisk(commanderWalkSrc('female', 'side', n))),
    );
    const aspects = sizes.map((s) => s.width / s.height);
    const [first, ...rest] = aspects;
    for (const [i, a] of rest.entries()) {
      expect(a, `frame ${i + 1} vs frame 0: ${JSON.stringify(sizes)}`).toBeCloseTo(first!, 3);
    }
  });
});
