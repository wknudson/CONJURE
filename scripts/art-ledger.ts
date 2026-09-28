/**
 * Writes the art ledgers: `CREDITS.md`, `docs/sprite-requests.md`, and the placeholder
 * sprites for every species still waiting on its own.
 *
 *   npx tsx scripts/art-ledger.ts credits        # CREDITS.md from CREATURE_ART
 *   npx tsx scripts/art-ledger.ts requests       # docs/sprite-requests.md
 *   npx tsx scripts/art-ledger.ts placeholders   # stand-in PNGs for COMPANION_ART_PENDING
 *
 * The documents are pure functions of the data (`src/core/data/artLedger.ts`), and the suite
 * compares the files to them, so this script is only ever the thing that writes them down.
 *
 * **A placeholder never overwrites art.** A file that exists and does not carry
 * `PLACEHOLDER_MARK` is somebody's painting, and the script refuses to touch it — the one
 * mistake this tool could make that nobody could undo from the repository alone is replacing
 * a finished beast with a silhouette because its name was still on the ledger.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { companionById } from '../src/core/data/companions.js';
import {
  COMPANION_ART_PENDING,
  PLACEHOLDER_MARK,
  creditsMarkdown,
  spriteRequestsMarkdown,
  spriteStemOf,
} from '../src/core/data/artLedger.js';
import { SCHOOL } from '../src/render/palette.js';
import { placeholderPng } from './lib/placeholder.js';

const ROOT = process.cwd();
const COMPANION_DIR = join(ROOT, 'public', 'assets', 'sprites', 'companions');

// ------------------------------------------------------------------ commands

function writeCredits(): void {
  writeFileSync(join(ROOT, 'CREDITS.md'), creditsMarkdown());
  console.log('wrote CREDITS.md');
}

function writeRequests(): void {
  writeFileSync(join(ROOT, 'docs', 'sprite-requests.md'), spriteRequestsMarkdown());
  console.log('wrote docs/sprite-requests.md');
}

function writePlaceholders(): void {
  let wrote = 0;
  for (const id of COMPANION_ART_PENDING) {
    const species = companionById(id);
    if (!species) throw new Error(`COMPANION_ART_PENDING names unknown species ${id}`);
    const colour = SCHOOL[species.school].main;
    for (const facing of ['front', 'back', 'side'] as const) {
      const path = join(COMPANION_DIR, `${spriteStemOf(species)}-${facing}.png`);
      if (existsSync(path) && !readFileSync(path).includes(PLACEHOLDER_MARK)) {
        throw new Error(
          `${path} is real art, not a placeholder. Strike ${id} off COMPANION_ART_PENDING ` +
            'instead of regenerating it.',
        );
      }
      writeFileSync(path, placeholderPng(facing, colour));
      wrote++;
    }
  }
  console.log(`wrote ${wrote} placeholder sprite${wrote === 1 ? '' : 's'}`);
}

const COMMANDS: Record<string, () => void> = {
  credits: writeCredits,
  requests: writeRequests,
  placeholders: writePlaceholders,
};

const wanted = process.argv.slice(2);
const run = wanted.length > 0 ? wanted : Object.keys(COMMANDS);
for (const name of run) {
  const command = COMMANDS[name];
  if (!command) throw new Error(`unknown command ${name}; expected ${Object.keys(COMMANDS).join(', ')}`);
  command();
}
