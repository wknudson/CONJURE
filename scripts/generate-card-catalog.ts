/**
 * Writes `docs/08_card_catalog.md` — every card in the game, as a reference table.
 *
 * Generated rather than hand-written because a hand-written catalog is wrong the moment
 * somebody adds a card, and a card list whose counts you cannot trust is worse than none:
 * it answers "how many Frost spells are there" confidently and incorrectly. This reads the
 * real `CardDef`s, so the doc is a view of the data instead of a claim about it.
 *
 * Imports the per-school records **individually** rather than the merged `CARDS`, because
 * the question the catalog exists to answer is "what cards are where" — and once the
 * records are spread into one object, which file a card came from is gone. The cost is that
 * a new school file must be added to `SOURCES` below; `assertComplete` turns that from a
 * silent omission into a failed run.
 *
 * Run with `npm run cards:catalog`.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { CardDef } from '../src/core/types/cards.js';
import { cardCostTotal } from '../src/core/types/cards.js';
import { CARDS, ascendableIds, STARTER_DECK, isAscendedId } from '../src/core/data/cards/index.js';
import { tierOf, TIER_COPY_LIMIT } from '../src/core/data/deckRules.js';

import { STARTER_CARDS } from '../src/core/data/cards/starter.js';
import { ARCANE_CARDS } from '../src/core/data/cards/arcane.js';
import { PYRE_CARDS } from '../src/core/data/cards/pyre.js';
import { FROST_CARDS } from '../src/core/data/cards/frost.js';
import { COMPANION_UNIT_CARDS } from '../src/core/data/cards/companionUnits.js';
import { TERRAIN_CARDS } from '../src/core/data/cards/terrain.js';
import { RANGED_CARDS } from '../src/core/data/cards/ranged.js';
import { SURGE_CARDS } from '../src/core/data/cards/surge.js';
import { BLOOM_CARDS } from '../src/core/data/cards/bloom.js';
import { BULWARK_CARDS } from '../src/core/data/cards/bulwark.js';
import { DUSK_CARDS } from '../src/core/data/cards/dusk.js';
import { GASLAMP_CARDS } from '../src/core/data/cards/gaslamp.js';
import { WILDLIFE_CARDS } from '../src/core/data/cards/wildlife.js';
import { THREAT_CARDS } from '../src/core/data/cards/threats.js';
import { HYBRID_CARDS } from '../src/core/data/cards/hybrid.js';
import { AURA_CARDS } from '../src/core/data/cards/auras.js';

/**
 * The shelves, in the order `cards/index.ts` merges them.
 *
 * `blurb` is the one piece of prose in this file that is not derived, and it is here rather
 * than in the doc because the doc is overwritten: a note about what belongs on a shelf is
 * only useful if it survives the next run.
 */
interface Source {
  file: string;
  cards: Record<string, CardDef>;
  blurb: string;
}

const SOURCES: Source[] = [
  {
    file: 'starter.ts',
    cards: STARTER_CARDS,
    blurb: 'The opening deck. Pyre and the colourless staples every Hero starts holding.',
  },
  {
    file: 'arcane.ts',
    cards: ARCANE_CARDS,
    blurb: "The Hero's own colour: Marks, abilities and constructs, never a Spell.",
  },
  { file: 'pyre.ts', cards: PYRE_CARDS, blurb: 'Pyre expansion — burst and burn.' },
  { file: 'frost.ts', cards: FROST_CARDS, blurb: 'Frost expansion — slow, freeze, shatter.' },
  {
    file: 'companionUnits.ts',
    cards: COMPANION_UNIT_CARDS,
    blurb: 'Bound Forms. Placed by setup, never drawn, never bought.',
  },
  {
    file: 'terrain.ts',
    cards: TERRAIN_CARDS,
    blurb: 'Encounter scenery. Built by the arena, not by a player.',
  },
  { file: 'ranged.ts', cards: RANGED_CARDS, blurb: 'Bodies that shoot.' },
  { file: 'surge.ts', cards: SURGE_CARDS, blurb: 'Surge expansion — charge and chain.' },
  { file: 'bloom.ts', cards: BLOOM_CARDS, blurb: 'Bloom expansion — growth and regrowth.' },
  { file: 'bulwark.ts', cards: BULWARK_CARDS, blurb: 'Bulwark expansion — plate and hold.' },
  { file: 'dusk.ts', cards: DUSK_CARDS, blurb: 'Dusk expansion — drain, decay, the graveyard.' },
  { file: 'gaslamp.ts', cards: GASLAMP_CARDS, blurb: 'Gaslamp expansion — clockwork and gas.' },
  { file: 'wildlife.ts', cards: WILDLIFE_CARDS, blurb: 'Feral beasts. Loyal to nobody.' },
  { file: 'threats.ts', cards: THREAT_CARDS, blurb: 'Enemy warband bodies.' },
  {
    file: 'hybrid.ts',
    cards: HYBRID_CARDS,
    blurb: 'Splice products. Obtainable only at the bench.',
  },
  { file: 'auras.ts', cards: AURA_CARDS, blurb: 'The Aura attach cards, their Detonations and Revival.' },
];

const KIND_ORDER = ['minion', 'spell', 'ability', 'mark', 'obstacle'] as const;

/**
 * Every base card is on exactly one shelf listed above.
 *
 * The check that makes this script safe to forget about. A new school file wired into
 * `cards/index.ts` but not into `SOURCES` would produce a catalog that is quietly missing a
 * whole shelf while still reporting a confident total — the precise failure the generated
 * doc exists to prevent.
 */
function assertComplete(listed: CardDef[]): void {
  const registryBase = Object.keys(CARDS).filter((id) => !isAscendedId(id));
  const listedIds = new Set(listed.map((c) => c.id));
  const missing = registryBase.filter((id) => !listedIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `card(s) in the registry but on no shelf in SOURCES — add the school file to ` +
        `scripts/generate-card-catalog.ts: ${missing.join(', ')}`,
    );
  }
  if (listedIds.size !== registryBase.length) {
    throw new Error(
      `shelf total ${listedIds.size} does not match registry base total ${registryBase.length}`,
    );
  }
}

/** `2P`, `1P+1M`, `X` — the price as a player reads it off the card. */
function costCell(def: CardDef): string {
  if (def.xCost) return `X (max ${def.xCost.max})`;
  const parts: string[] = [];
  if (def.cost.bones > 0) parts.push(`${def.cost.bones}P`);
  if (def.cost.marrow > 0) parts.push(`${def.cost.marrow}M`);
  return parts.length > 0 ? parts.join('+') : '0';
}

/** A unit's stat line, or an obstacle's, or nothing. */
function statsCell(def: CardDef): string {
  const u = def.unit;
  if (u) {
    const bits = [`${u.atk} atk`, `${u.hp} hp`, `${u.mov} mov`];
    bits.push(u.rangeMin === u.rangeMax ? `rng ${u.rangeMax}` : `rng ${u.rangeMin}-${u.rangeMax}`);
    bits.push(u.archetype);
    if (u.footprint === 2) bits.push('**2x2**');
    return bits.join(', ');
  }
  if (def.obstacleHp !== undefined) {
    const bits = [`${def.obstacleHp} hp`];
    if (def.obstacleCover) bits.push('cover');
    return bits.join(', ');
  }
  return '—';
}

/**
 * The rider fields — every optional behaviour hanging off a stat block or an obstacle.
 *
 * Rendered as a column rather than folded into the stat line because these are exactly what
 * somebody authoring a new card is shopping for: a list of the levers that already exist.
 */
function ridersCell(def: CardDef): string {
  const out: string[] = [];
  const u = def.unit;
  if (u) {
    if (u.attackProfile) out.push(u.attackProfile);
    if (u.attackDtype) out.push(`dmg ${u.attackDtype}`);
    if (u.onHit) out.push(`onHit ${u.onHit.status} ${u.onHit.stacks}`);
    if (u.deathburst) out.push(`deathburst ${u.deathburst.status} ${u.deathburst.stacks}`);
    if (u.trail) out.push(`trail ${u.trail}`);
    if (u.bonusVs) out.push(`+${u.bonusVs.amount} vs ${u.bonusVs.statuses.join('/')}`);
    if (u.platesEachTurn) out.push(`plates ${u.platesEachTurn}/turn`);
    if (u.refunds?.onAttack) out.push(`refund ${u.refunds.onAttack}P on attack`);
    if (u.refunds?.onDeath) out.push(`refund ${u.refunds.onDeath}P on death`);
    if (u.titheBonus) out.push(`tithe +${u.titheBonus}M`);
    if (u.hunts) out.push(`hunts ${u.hunts}`);
    if (u.escalationBonus.atk || u.escalationBonus.hp) {
      out.push(`escalate +${u.escalationBonus.atk}/+${u.escalationBonus.hp}`);
    }
  }
  if (def.obstacleTurnStart) {
    out.push(`turn start ${def.obstacleTurnStart.status} ${def.obstacleTurnStart.stacks}`);
  }
  if (def.obstacleDeath) {
    const d = def.obstacleDeath;
    const dmg = d.damage ? `${d.damage} dmg + ` : '';
    out.push(`on break ${dmg}${d.status} ${d.stacks}`);
  }
  if (def.onDestroyReward) out.push(`breaks for ${def.onDestroyReward.marrow}M`);
  if (def.bounty) out.push(`bounty ${def.bounty.marrow}M`);
  if (def.leavesRubble) out.push('leaves rubble');
  return out.length > 0 ? out.join('; ') : '—';
}

/** What the player picks, and how far away they may pick it. */
function targetCell(def: CardDef): string {
  const t = def.target;
  let base: string;
  switch (t.kind) {
    case 'none':
      base = 'none';
      break;
    case 'emptyTile':
      base = `empty tile (${t.zone}${t.footprint === 2 ? ', 2x2' : ''})`;
      break;
    case 'entity': {
      const narrows: string[] = [t.side];
      if (t.includeObstacles) narrows.push('+obstacles');
      if (t.requireUnexhausted) narrows.push('unexhausted');
      if (t.requiresAura) narrows.push(`aura ${t.requiresAura}`);
      if (t.requiresStatus) narrows.push(`has ${t.requiresStatus}`);
      base = `entity (${narrows.join(', ')})`;
      break;
    }
    case 'adjacentEnemy':
      base = 'adjacent enemy';
      break;
    case 'line':
      base = `line ${t.length}`;
      break;
    case 'unitOrPortrait':
      base = `ally unit or portrait`;
      break;
    case 'global':
      base = 'global';
      break;
    case 'fallen':
      base = `fallen (${t.site})`;
      break;
  }
  const reach: string[] = [];
  if (def.range !== undefined) {
    reach.push(def.minRange !== undefined ? `range ${def.minRange}-${def.range}` : `range ${def.range}`);
  }
  if (def.vector === 'linear') reach.push('linear');
  if (def.needsLoS) reach.push('LoS');
  return reach.length > 0 ? `${base} — ${reach.join(', ')}` : base;
}

/** setupOnly / spliceOnly / starter membership / whether the Forge sells a Rank 2. */
function flagsCell(def: CardDef, ascendable: Set<string>, starter: Set<string>): string {
  const out: string[] = [];
  if (def.setupOnly) out.push('setup only');
  if (def.spliceOnly) out.push('splice only');
  if (starter.has(def.id)) out.push('starter deck');
  if (ascendable.has(def.id)) out.push('R2');
  return out.length > 0 ? out.join(', ') : '—';
}

/** A pipe in a card's rules text would end the table row three columns early. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function countBy<T extends string>(cards: CardDef[], key: (c: CardDef) => T): Map<T, number> {
  const out = new Map<T, number>();
  for (const c of cards) out.set(key(c), (out.get(key(c)) ?? 0) + 1);
  return out;
}

/** `12 (5 minion, 4 ability, 2 spell, 1 obstacle)` — in the fixed kind order. */
function kindBreakdown(cards: CardDef[]): string {
  const counts = countBy(cards, (c) => c.kind);
  return KIND_ORDER.filter((k) => (counts.get(k) ?? 0) > 0)
    .map((k) => `${counts.get(k)} ${k}`)
    .join(', ');
}

function render(): string {
  const all = SOURCES.flatMap((s) => Object.values(s.cards));
  assertComplete(all);

  const ascendable = new Set(ascendableIds());
  const starter = new Set<string>(STARTER_DECK);
  const kindCounts = countBy(all, (c) => c.kind);
  const schoolCounts = countBy(all, (c) => c.school);

  const L: string[] = [];
  const p = (s = '') => L.push(s);

  p('# 08 — Card Catalog');
  p();
  p(
    '> **Generated file — do not edit by hand.** Written by `scripts/generate-card-catalog.ts`; ' +
      'run `npm run cards:catalog` to rebuild it after adding or changing a card.',
  );
  p();
  p(
    'Every card in the game, grouped by the file it lives in. Card data is read from the real ' +
      '`CardDef`s, so the counts below are the counts — not a claim about them.',
  );
  p();
  p(
    '**Adding a card:** pick the shelf its school belongs to under `src/core/data/cards/`, add a ' +
      '`CardDef` to that file\'s exported record, and rerun the generator. A new *file* also needs ' +
      'wiring into `cards/index.ts` and into `SOURCES` in the generator — the script fails loudly ' +
      'if you do the first and forget the second.',
  );
  p();

  p('## Totals');
  p();
  p(`**${all.length} base cards.** Rank 2 printings are derived, not authored — see [Rank 2](#rank-2).`);
  p();
  p('| Kind | Count | Whose | Where it goes |');
  p('|---|---:|---|---|');
  const KIND_HOME: Record<string, [string, string]> = {
    minion: ['Hero', 'Vanguard Roster, never a deck'],
    spell: ['Companion', 'drafted into a Grimoire'],
    ability: ['Hero', 'Hero Deck'],
    mark: ['Hero', 'Hero Deck'],
    obstacle: ['Hero', 'Hero Deck, shown as a Construct'],
  };
  for (const k of KIND_ORDER) {
    const [whose, home] = KIND_HOME[k];
    p(`| ${k} | ${kindCounts.get(k) ?? 0} | ${whose} | ${home} |`);
  }
  p(`| **total** | **${all.length}** | | |`);
  p();

  p('### By school');
  p();
  p('| School | Cards |');
  p('|---|---:|');
  for (const [school, n] of [...schoolCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    p(`| ${school} | ${n} |`);
  }
  p();

  p('### By file');
  p();
  p('| File | Cards | Breakdown |');
  p('|---|---:|---|');
  for (const s of SOURCES) {
    const cards = Object.values(s.cards);
    p(`| [\`${s.file}\`](#${anchor(s.file)}) | ${cards.length} | ${kindBreakdown(cards)} |`);
  }
  p(`| **total** | **${all.length}** | |`);
  p();

  p('---');
  p();
  p('## The cards');
  p();
  p(
    'Columns: **Cost** is `P` Bones and `M` Marrow (Marrow is a strict requirement; Bones can be ' +
      'paid out of Marrow but never the reverse). **Tier** is derived from cost and keywords by ' +
      '`tierOf()` and sets the copy limit. **Stats** is the unit stat block or the obstacle HP. ' +
      '**Riders** is every optional behaviour hanging off it. **Flags** notes setup/splice-only ' +
      'cards, starter deck membership, and `R2` where the Forge sells a Rank 2 printing.',
  );
  p();

  for (const s of SOURCES) {
    const cards = Object.values(s.cards).sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        cardCostTotal(a.cost) - cardCostTotal(b.cost) ||
        a.name.localeCompare(b.name),
    );
    p(`### \`${s.file}\``);
    p();
    p(`${s.blurb} — **${cards.length} cards** (${kindBreakdown(cards)}).`);
    p();
    p('| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |');
    p('|---|---|---|---|:-:|---|---|---|---|---|---|---|');
    for (const c of cards) {
      p(
        '| ' +
          [
            `**${cell(c.name)}**`,
            `\`${c.id}\``,
            c.kind,
            costCell(c),
            String(tierOf(c)),
            c.source,
            cell(statsCell(c)),
            cell(ridersCell(c)),
            cell(targetCell(c)),
            c.keywords.length > 0 ? c.keywords.join(', ') : '—',
            flagsCell(c, ascendable, starter),
            cell(c.text),
          ].join(' | ') +
          ' |',
      );
    }
    p();
  }

  p('---');
  p();
  p('## Notes');
  p();
  p('### Rank 2');
  p();
  p(
    'Every card above may also exist as a Rank 2 printing, id-suffixed `_r2`. These are **derived, ' +
      'not authored**: `ascendCardDef()` in `src/core/data/ascension.ts` raises the numbers a card ' +
      'deals by 10% and changes nothing else, and `cards/index.ts` builds them at module load. A ' +
      'card with no number to raise gets no printing, which is what the Forge reads to decide it ' +
      'has nothing to sell you. There is nothing to author and nothing to list here — ' +
      `${ascendable.size} of the ${all.length} base cards currently have one, marked \`R2\` above.`,
  );
  p();
  p('### Tiers and copy limits');
  p();
  p('There is no rarity field. Tier is derived by `tierOf()` in `src/core/data/deckRules.ts`:');
  p();
  p('| Tier | Earned by | Copies allowed |');
  p('|:-:|---|:-:|');
  p(`| 1 | total cost 0-1 | ${TIER_COPY_LIMIT[1]} |`);
  p(`| 2 | total cost 2-3 | ${TIER_COPY_LIMIT[2]} |`);
  p(`| 3 | total cost 4+, \`PowerTier\`, or a 2x2 footprint | ${TIER_COPY_LIMIT[3]} |`);
  p();
  p('### Payloads that are not cards');
  p();
  p('Some cards deliver a definition that lives in its own registry. Those are not listed above:');
  p();
  p('| Registry | File | What it holds |');
  p('|---|---|---|');
  p('| `MARKS` | `src/core/data/marks.ts` | Mark payloads — what a Mark detonates for |');
  p('| `AURAS` | `src/core/data/auras.ts` | Aura payloads — what each Aura grows into |');
  p('| `COMPANIONS` | `src/core/data/companions.ts` | Companions, each pointing at a Bound Form card |');
  p('| `RELICS` | `src/core/data/relics.ts` | Gear, not cards |');
  p('| `SPLICE_RECIPES` | `src/core/data/splicing.ts` | What the bench turns into the `hybrid.ts` cards |');
  p();
  p(
    'Pools, the bestiary and the roster (`pools.ts`, `bestiary.ts`, `roster.ts`) are all derived ' +
      'from the registry above. There is deliberately no second list to keep in step.',
  );
  p();

  return L.join('\n');
}

/** GitHub's heading-anchor slug, for the by-file table's links. */
function anchor(file: string): string {
  return file.replace(/\./g, '').toLowerCase();
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'docs', '08_card_catalog.md');
writeFileSync(out, render(), 'utf8');
console.log(`wrote ${out}`);
