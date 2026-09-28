/**
 * The art ledgers: `CREDITS.md` and the sprite request list are in step with the data they
 * are generated from, and every beast still waiting on its own art is known to be waiting.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LICENCES, type CreatureArt } from '../core/data/art.js';
import {
  COMPANION_ART_PENDING,
  PLACEHOLDER_MARK,
  creditsMarkdown,
  spriteRequestsMarkdown,
  spriteStemOf,
} from '../core/data/artLedger.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';

const COMPANION_DIR = 'public/assets/sprites/companions';

/** Normalised so a checkout with CRLF endings compares equal to what the generator writes. */
const text = (path: string): string => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const WOLF: CreatureArt = {
  file: 'test_wolf',
  facings: ['side'],
  style: 'pixel',
  title: 'Test Wolf',
  author: 'Somebody',
  source: 'https://example.org/wolf',
  licence: 'CC-BY-3.0',
};

describe('the generated ledgers', () => {
  it('keeps CREDITS.md in step with the registry', () => {
    expect(text('CREDITS.md'), 'run `npm run art:credits`').toBe(creditsMarkdown());
  });

  it('keeps the sprite request list in step with the pending ledger', () => {
    expect(text('docs/sprite-requests.md'), 'run `npm run art:requests`').toBe(
      spriteRequestsMarkdown(),
    );
  });

  it('credits every author the registry names', () => {
    const credits = creditsMarkdown({ scout_imp: WOLF });
    expect(credits).toContain('Somebody');
    expect(credits).toContain('https://example.org/wolf');
    expect(credits).toContain(LICENCES['CC-BY-3.0'].url);
    expect(credits).toContain(CARDS.scout_imp!.name);
  });
});

describe('companions still waiting on their own art', () => {
  const isPlaceholder = (path: string): boolean => readFileSync(path).includes(PLACEHOLDER_MARK);

  it('names only real species, once each', () => {
    for (const id of COMPANION_ART_PENDING) expect(companionById(id), id).toBeDefined();
    expect(new Set(COMPANION_ART_PENDING).size).toBe(COMPANION_ART_PENDING.length);
  });

  it('gives every species three files on disk, stand-ins included', () => {
    // A missing front sprite drops the follower from the street entirely, so a stand-in is
    // what lets a newly bound beast walk beside the player at all.
    for (const species of COMPANIONS) {
      for (const facing of ['front', 'back', 'side'] as const) {
        const path = `${COMPANION_DIR}/${spriteStemOf(species)}-${facing}.png`;
        expect(existsSync(path), path).toBe(true);
      }
    }
  });

  it('lists exactly the species whose files are stand-ins', () => {
    // Two-way: a painted beast still on the ledger, or a stand-in nobody listed, both fail.
    const pending = new Set(COMPANION_ART_PENDING);
    for (const species of COMPANIONS) {
      for (const facing of ['front', 'back', 'side'] as const) {
        const path = `${COMPANION_DIR}/${spriteStemOf(species)}-${facing}.png`;
        if (!existsSync(path)) continue;
        expect(isPlaceholder(path), `${path} placeholder?`).toBe(pending.has(species.id));
      }
    }
  });
});
