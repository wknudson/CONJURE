/**
 * The Ironworks Artificer.
 *
 * Everything to do with cards happens at this bench and nowhere else — the Apothecary
 * sells nothing that goes in a deck, and this screen sells nothing that goes in a
 * satchel. The separation is enforced by what each file imports rather than by intent.
 *
 * Three trades share the workbench, and they are genuinely different jobs, so they are
 * tabs rather than columns:
 *
 *  - **Schematic Forging** cuts a card you have never held, for Ducats.
 *  - **The Ascension Forge** raises one you know to its Rank 2 printing: +10% to every
 *    number it deals, for Ducats, Shards and a Core.
 *  - **Aetheric Splicing** presses a card and a reagent into a hybrid.
 *
 * Splicing is scaffolding only — the slots accept a selection and the press stays cold,
 * because a hybrid card has no representation in the engine and a bench that produced one
 * would be lying about what it made. The other two are live.
 *
 * No prices are decided here. The screen asks `forge.ts` whether a thing may be bought
 * and shows what it says, so a greyed-out button and a refused click always agree.
 */

import type { Screen } from './ScreenManager.js';
import type { CardDef } from '../core/types/cards.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import { schematicCatalogue } from '../core/data/artificer.js';
import { REAGENTS, recipeFor, spliceableBaseIds } from '../core/data/splicing.js';
import { missingPrerequisites, spliceRefusal, type SpliceResult } from '../core/overworld/splice.js';
import { companionById } from '../core/data/companions.js';
import { resolveGrimoire, socketRefusal } from '../core/data/grimoire.js';
import type { CompanionInstance } from '../core/overworld/vivarium.js';
import {
  ASCENSION_COST,
  reagentForAscension,
  SCHEMATIC_COST_DUCATS,
  ascensionRefusal,
  schematicRefusal,
} from '../core/overworld/forge.js';
import { CARDS, ascendedId } from '../core/data/cards/index.js';
import { ascendableFor } from '../core/data/collection.js';
import { formatCost } from '../hud/cost.js';
import { tierOf } from '../core/data/deckRules.js';
import { schoolOf } from '../render/palette.js';
import type { School } from '../contract/ids.js';
import { cardFaceHtml, faceOfDef } from '../hud/cardFace.js';
import { filterBarHtml, matchesBones, bonePills, wireFilterBar } from '../hud/filterBar.js';
import { Tooltip } from '../hud/Tooltip.js';
import { ASCENSION_PERCENT } from '../core/data/ascension.js';
import { reagentById } from '../core/data/splicing.js';

/**
 * Where a card stands, from this bench's point of view.
 *
 * Three states, and the middle one is new. Before Schematics were things you found there
 * were only two — forged or not — and "not forged" meant "buy it". Now the shelf has to
 * separate *the bench cannot cut this for you* from *the bench is waiting for your money*,
 * because those send the player to two completely different places.
 */
type SchematicState = 'forged' | 'ready' | 'unknown';

function stateOf(def: CardDef, collection: Collection, held: readonly string[]): SchematicState {
  if (collection.unlocked.includes(def.id)) return 'forged';
  return held.includes(def.id) ? 'ready' : 'unknown';
}

/** Sort weight: what you can act on, then what you might, then what is done. */
function rank(def: CardDef, collection: Collection, held: readonly string[]): number {
  return { ready: 0, unknown: 1, forged: 2 }[stateOf(def, collection, held)];
}

/**
 * Why the button is dark, in the player's words.
 *
 * `no-schematic` is the one that had to be written carefully: it is not a price problem and
 * it is not a permanent no, so it has to point somewhere. "Beat something carrying it" is
 * the whole loop in four words.
 */
const REFUSAL_LINE: Record<string, string> = {
  none: '',
  'too-poor': 'Not enough Ducats',
  'no-schematic': 'No schematic — beat something carrying it',
  'in-combat': 'Not while a contract is open',
  'already-forged': '',
  'unknown-card': '',
};

export interface ArtificerOpts {
  global: GlobalGameState;
  /**
   * Read as a function, not held as a value.
   *
   * `grantCard` returns a new collection rather than mutating one, so a bench holding the
   * object it was handed at mount would show a card it had just forged as still unowned.
   */
  collection: () => Collection;
  /**
   * Card plans this character has taken off something, read as a function for the same
   * reason the collection is: forging one does not spend it, but the shelf beside it
   * changes state, and a bench holding the array it was handed at mount would keep drawing
   * the old answer.
   */
  schematics: () => readonly string[];
  /**
   * Performs the transaction and reports whether it happened.
   *
   * The bench never writes the collection itself — it outlives this screen and belongs to
   * the save. Both of these take payment and hand back a result, and the screen simply
   * re-renders whatever the till decided.
   */
  onAscend: (cardId: string) => boolean;
  onForgeSchematic: (cardId: string) => boolean;
  /**
   * The tamed roster, read as a function for the same reason the collection is.
   *
   * The bench is Companion-centric now: what it presses is a spell out of a *particular*
   * beast's book, and a socket written by the choice modal has to land on that instance.
   */
  companions: () => CompanionInstance[];
  /** Whichever beast is currently bound, so the picker opens on the one that matters. */
  activeCompanionId: () => string | undefined;
  /** Presses a card and a core together. Null when the bench refused. */
  onSplice: (baseCardId: string, catalystId: string) => SpliceResult | null;
  /** Writes a socket after a pressing. Reports whether it took. */
  onSocket: (instanceId: string, slot: number, cardId: string) => boolean;
  /** Called once after either, when the purse and the collection have both moved. */
  onChange: () => void;
  onBack: () => void;
}

type Bench = 'schematic' | 'ascend' | 'splice';

/** Every way the till can say no, in the player's words rather than the code's. */
const REFUSAL_COPY: Record<string, string> = {
  none: '',
  'in-combat': 'Not while a contract is open',
  'not-owned': 'You have never held this card',
  // The same state, said where it is actionable. A Companion *brings* its eight; it does
  // not give them to you, and "you have never held this" is confusing next to a card the
  // player watches it cast every fight.
  'not-forged': 'Requires Schematic Forging',
  'not-unlocked': 'Requires Schematic Forging',
  'off-school': 'This beast has no claim to that school',
  'not-castable': 'Not a card a Companion can carry',
  'bad-slot': 'No such slot',
  'already-ascended': 'Already raised',
  'no-rank-2': 'This card has no Rank 2',
  'too-poor': 'Not enough Ducats or Shards',
  'no-recipe': 'The bench knows no such pressing',
  // Shared by both trades: the bench spends a Core to press a fusion, and the Forge spends
  // one to raise a card. Either way the errand is the same, so the wording is too.
  'no-reagent': 'No Core to spend — Master contracts pay them',
  'missing-prerequisite': 'You have not learned the other half of this fusion',
};

/**
 * What the schematic grid is currently showing.
 *
 * Screen state rather than saved state: a filter is a way of looking at the shelf, not a
 * fact about the character, so it resets with the screen and is written to nothing.
 */
interface SchematicFilters {
  school: School | 'all';
  /** The chosen Bone pill, as its key. Compared through `matchesBones`. */
  cost: string;
  source: 'all' | 'hero' | 'companion';
  kind: 'all' | CardDef['kind'];
  sort: 'name' | 'cost' | 'school' | 'unlock';
}

/**
 * Type names in the player's words rather than the schema's.
 *
 * `obstacle` is the field; "Construct" is what the game has always called the thing on the
 * board, and the filter bar is read by somebody looking at their board.
 *
 * The bench keeps a **Spells** pill where the Field Journal drops it, and the difference is
 * the point: the Journal's case is a shelf you build a Hero Deck out of, and a Spell can
 * never go in one. The bench sells and Ascends every card in the game, including the eight
 * a beast will draft and the fusions that can only ever live in a Grimoire socket. A
 * catalogue that could not filter to them would be hiding half its own stock.
 */
const KIND_PILLS: { key: 'all' | CardDef['kind']; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'ability', label: 'Abilities' },
  { key: 'mark', label: 'Marks' },
  { key: 'spell', label: 'Spells' },
  { key: 'minion', label: 'Minions' },
  { key: 'obstacle', label: 'Constructs' },
];

const SORT_PILLS: { key: SchematicFilters['sort']; label: string }[] = [
  { key: 'unlock', label: 'Unforged first' },
  { key: 'cost', label: 'Bone cost' },
  { key: 'name', label: 'Name' },
  { key: 'school', label: 'School' },
];

export class ArtificerScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;
  private bench: Bench = 'schematic';

  /** How the blueprint shelf is being looked at. Screen state; saved nowhere. */
  private filters: SchematicFilters = {
    school: 'all',
    cost: 'all',
    source: 'all',
    kind: 'all',
    sort: 'unlock',
  };

  /** Which beast's book the press is looking at, by instance id. */
  private beast: string | null = null;
  /** Which of its eight slots is loaded, and which Core is beside it. */
  private slotIndex: number | null = null;
  private slotB: string | null = null;

  /** The card laid on the Forge, whose two printings are being compared. */
  private chosen: string | null = null;

  /**
   * Which shelf the Ascension Forge is showing.
   *
   * `innate` is the half that needed saying out loud: a player's Companion casts eight
   * spells they may not own a single one of, and the old Forge simply did not list them —
   * so the answer to "why can I not raise my Ignis's Flame Surge" was an empty list rather
   * than an instruction.
   */
  private ascendView: 'owned' | 'innate' = 'owned';

  constructor(private readonly opts: ArtificerOpts) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--artificer';
    el.innerHTML = `
      <div class="workbench__head brass-panel">
        <div>
          <div class="workbench__title">The Ironworks Artificer</div>
          <div class="workbench__sub">Cards raised to Rank 2 · reagents pressed in</div>
        </div>
        <div class="workbench__purse">
          <span class="workbench__coin workbench__coin--gold">
            <span class="workbench__coin-label">Ducats</span>
            <span class="workbench__ducats"></span>
          </span>
          <span class="workbench__coin workbench__coin--marrow">
            <span class="workbench__coin-label">Shards</span>
            <span class="workbench__shards"></span>
          </span>
        </div>
        <button class="brass-btn workbench__back">Back to the street</button>
      </div>

      <div class="workbench-tabs">
        <button class="workbench-tab" data-bench="schematic">Schematic Forging</button>
        <button class="workbench-tab" data-bench="ascend">Ascension Forge</button>
        <button class="workbench-tab" data-bench="splice">Aetheric Splicing</button>
      </div>

      <div class="workbench__body"></div>
    `;

    el.querySelector('.workbench__back')!.addEventListener('click', () => this.opts.onBack());
    for (const tab of el.querySelectorAll<HTMLElement>('.workbench-tab')) {
      tab.addEventListener('click', () => {
        this.bench = (tab.dataset.bench as Bench) ?? 'schematic';
        this.render();
      });
    }

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.render();
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    const { economy } = this.opts.global.overworld;

    el.querySelector('.workbench__ducats')!.textContent = String(economy.ducats);
    el.querySelector('.workbench__shards')!.textContent = String(economy.marrowShards);
    for (const tab of el.querySelectorAll<HTMLElement>('.workbench-tab')) {
      tab.classList.toggle('is-active', tab.dataset.bench === this.bench);
    }

    const body = el.querySelector('.workbench__body')!;
    body.replaceChildren(
      this.bench === 'schematic'
        ? this.schematicBench()
        : this.bench === 'ascend'
          ? this.forgeBench()
          : this.spliceBench(),
    );
  }

  // ------------------------------------------------------- schematic forging

  /**
   * Cards the player has never held, and what it costs to cut one.
   *
   * Every card is assumed to have a Schematic for now. When Schematics become things a
   * player finds, this list narrows and nothing else on the screen changes.
   */
  /**
   * The blueprint shelf: every card the bench knows, as cards.
   *
   * A grid rather than a list of rows because the shelf is a *catalogue* — the question is
   * "what is there and what do I want", which is answered by scanning many at once, and a
   * column of full-width rows answers it four cards at a time.
   *
   * Owned cards stay on the shelf, marked and unbuyable. A shelf that silently drops what
   * you already hold makes a player conclude the bench has never heard of the card they
   * are looking for.
   */
  private schematicBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'forge-bench';

    host.innerHTML = `
      <div class="sch-filters"></div>
      <div class="sch-count"></div>
      <div class="sch-grid"></div>
      <div class="forge-note">
        One copy per Schematic. Further copies are what winning contracts is for.
      </div>
    `;

    this.paintFilters(host);
    this.paintGrid(host);
    return host;
  }

  /** The filter header. Rebuilt whole on every change, so the marked pill is never stale. */
  private paintFilters(host: HTMLElement): void {
    const bar = host.querySelector<HTMLElement>('.sch-filters');
    if (!bar) return;

    const f = this.filters;
    // Schools are read off the shelf rather than hard-coded, so a filter can never hide a
    // card by omitting the school somebody printed it in.
    const schools = [...new Set(schematicCatalogue().map((d) => d.school))].sort();

    bar.innerHTML = filterBarHtml([
      {
        name: 'school',
        label: 'School',
        active: String(f.school),
        pills: [
          { key: 'all', label: 'All' },
          ...schools.map((s) => ({
            key: s,
            label: s[0]!.toUpperCase() + s.slice(1),
            tint: schoolOf(s).main,
          })),
        ],
      },
      { name: 'cost', label: 'Bones', active: String(f.cost), pills: bonePills() },
      {
        name: 'source',
        label: 'Cast by',
        active: f.source,
        pills: [
          { key: 'all', label: 'Either' },
          { key: 'hero', label: 'Hero' },
          { key: 'companion', label: 'Companion' },
        ],
      },
      {
        name: 'kind',
        label: 'Type',
        active: f.kind,
        pills: KIND_PILLS.map((k) => ({ key: k.key, label: k.label })),
      },
      {
        name: 'sort',
        label: 'Sort',
        active: f.sort,
        pills: SORT_PILLS.map((s) => ({ key: s.key, label: s.label })),
      },
    ]);

    wireFilterBar(bar, (name, value) => {
      // Cast through unknown: the union is per-key and the handler is generic over all
      // five. The pills are generated from the same unions above, so the values are sound
      // even though this one assignment cannot prove it.
      (this.filters[name as keyof SchematicFilters] as unknown) = value;
      this.render();
    });
  }

  /** Applies the filters, then draws what survives. */
  private paintGrid(host: HTMLElement): void {
    const grid = host.querySelector<HTMLElement>('.sch-grid');
    const count = host.querySelector<HTMLElement>('.sch-count');
    if (!grid) return;

    const collection = this.opts.collection();
    const held = this.opts.schematics();
    const f = this.filters;

    const shown = schematicCatalogue()
      .filter((d) => f.school === 'all' || d.school === f.school)
      .filter((d) => f.source === 'all' || d.source === f.source)
      .filter((d) => f.kind === 'all' || d.kind === f.kind)
      .filter((d) => matchesBones(d.cost.bones, f.cost))
      .sort((a, b) => {
        switch (f.sort) {
          case 'cost':
            return a.cost.bones - b.cost.bones || a.name.localeCompare(b.name);
          case 'school':
            return a.school.localeCompare(b.school) || a.name.localeCompare(b.name);
          case 'unlock':
            // Cuttable first, then what the bench merely knows about, then what is already
            // yours. The old ordering was owned-last over two states; there are three now,
            // and the one the player came here to act on has to be the one at the top.
            return (
              rank(a, collection, held) - rank(b, collection, held) || a.name.localeCompare(b.name)
            );
          default:
            return a.name.localeCompare(b.name);
        }
      });

    if (count) {
      // What the player can *act on*, not what exists. "38 unforged" was true and useless
      // the moment a Schematic became something you have to go and find -- it counted the
      // catalogue rather than the shelf.
      const ready = shown.filter((d) => stateOf(d, collection, held) === 'ready').length;
      count.textContent = shown.length
        ? `${shown.length} card${shown.length === 1 ? '' : 's'} · ${ready} you hold the plan for`
        : '';
    }

    grid.innerHTML = '';
    if (shown.length === 0) {
      grid.innerHTML = `<div class="forge-empty brass-panel">
        Nothing on the shelf matches that. Widen the filters.
      </div>`;
      return;
    }

    for (const def of shown) grid.appendChild(this.schematicCard(def, collection, held));
  }

  /** One entry: the card, what stands between you and it, and the button that cuts it. */
  private schematicCard(def: CardDef, collection: Collection, held: readonly string[]): HTMLElement {
    const refusal = schematicRefusal(this.opts.global, collection, def.id, held);
    const state = stateOf(def, collection, held);

    const foot: Record<SchematicState, { price: string; button: string }> = {
      forged: { price: 'Forged', button: 'Forged' },
      ready: { price: `${SCHEMATIC_COST_DUCATS} d`, button: 'Forge' },
      unknown: { price: 'No schematic', button: 'Locked' },
    };

    const cell = document.createElement('div');
    cell.className = `sch-cell sch-cell--${state}${state === 'forged' ? ' is-owned' : ''}`;
    cell.innerHTML = `
      ${cardFaceHtml(faceOfDef(def), { extraClass: 'card--mini', showReach: true })}
      <div class="sch-cell__foot">
        <span class="sch-cell__price">${foot[state].price}</span>
        <button class="brass-btn sch-cell__cut">${foot[state].button}</button>
      </div>
      <div class="sch-cell__refusal">${REFUSAL_LINE[refusal ?? 'none']}</div>
    `;

    // The catalogue still shows everything, including what you cannot cut. That was already
    // deliberate -- a shelf that hid unowned cards answers "can this bench make a Cinder
    // Mark" with silence -- and it matters more now that most of it is locked: the lock is
    // the game telling you there is something out there still carrying the plan.
    const btn = cell.querySelector<HTMLButtonElement>('.sch-cell__cut')!;
    btn.disabled = refusal !== null;
    btn.addEventListener('click', () => this.cut(def.id));
    return cell;
  }

  private cut(cardId: string): void {
    if (!this.opts.onForgeSchematic(cardId)) return;
    this.opts.onChange();
    this.render();
  }

  // -------------------------------------------------------- ascension forge

  /**
   * Every spell the player's beasts fuse in, whether or not the player owns one.
   *
   * The list the Forge was missing. A Companion brings eight cards to every fight and the
   * player may own none of them, so a Forge that showed only owned cards answered "why can
   * I not raise my Ignis's Flame Surge" with an empty shelf — which reads as the bench
   * having never heard of the card rather than as an instruction.
   *
   * Deduplicated across the roster: two Ignis carrying the same spell is one entry, because
   * Ascension is account-wide and raising it once raises it for both.
   */
  private innateAscendables(): string[] {
    const seen = new Set<string>();
    for (const beast of this.opts.companions()) {
      for (const id of this.bookOf(beast)) {
        if (CARDS[ascendedId(id)]) seen.add(id);
      }
    }
    return [...seen].sort((a, b) => CARDS[a]!.name.localeCompare(CARDS[b]!.name));
  }

  private forgeBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'forge-bench';

    const collection = this.opts.collection();
    const owned = ascendableFor(collection);
    const innate = this.innateAscendables();
    const candidates = this.ascendView === 'innate' ? innate : owned;

    const tabs = document.createElement('div');
    tabs.className = 'forge-views';
    for (const [key, label, n] of [
      ['owned', 'Cards you own', owned.length],
      ['innate', 'Companion innate', innate.length],
    ] as const) {
      const pill = document.createElement('button');
      pill.className = 'forge-view';
      pill.classList.toggle('is-active', this.ascendView === key);
      pill.textContent = `${label} · ${n}`;
      pill.addEventListener('click', () => {
        this.ascendView = key;
        this.chosen = null;
        this.render();
      });
      tabs.appendChild(pill);
    }
    host.appendChild(tabs);

    if (candidates.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'forge-empty brass-panel';
      empty.textContent =
        this.ascendView === 'innate'
          ? 'No Companion is bound, so there is no innate book to raise.'
          : 'Nothing on the bench. Ascension needs a card you own and have not already raised — win one, or come back when the Board has paid you better.';
      host.appendChild(empty);
      return host;
    }

    // Default to the first candidate rather than an empty right-hand pane: the comparison
    // is the whole point of the screen, and an empty one teaches nothing.
    if (!this.chosen || !candidates.includes(this.chosen)) this.chosen = candidates[0]!;

    const layout = document.createElement('div');
    layout.className = 'forge-layout';

    const list = document.createElement('div');
    list.className = 'forge-list';
    for (const id of candidates) list.appendChild(this.candidateRow(id, collection));

    layout.append(list, this.comparison(this.chosen));
    host.appendChild(layout);
    return host;
  }

  private candidateRow(cardId: string, collection: Collection): HTMLElement {
    const def = CARDS[cardId]!;
    const locked = !collection.unlocked.includes(cardId);

    const row = document.createElement('button');
    row.className = 'forge-row brass-panel';
    row.classList.toggle('is-chosen', this.chosen === cardId);
    // Greyed rather than hidden: the point of the innate shelf is to *show* the card and
    // say where to go about owning it.
    row.classList.toggle('is-locked', locked);
    row.style.setProperty('--school', schoolOf(def.school as never).main);
    row.innerHTML = `
      <span class="forge-row__cost">${formatCost(def.cost)}</span>
      <span class="forge-row__name">${def.name}</span>
      ${
        locked
          ? '<span class="forge-row__lock" data-tip="Locked|Requires Schematic Forging.|Your Companion brings this card to every fight, but bringing is not owning — Ascension raises a card in your own collection.">🔒</span>'
          : ''
      }
      <span class="forge-row__tier">T${tierOf(def)}</span>
    `;
    row.addEventListener('click', () => {
      this.chosen = cardId;
      this.render();
    });
    return row;
  }

  /**
   * Rank 1 beside Rank 2, printed from the same data the fight will use.
   *
   * Both panes read out of `CARDS`, and the Rank 2 entry there was derived from the Rank 1
   * at load — +10% to every number it deals, and nothing else. So this is not a preview of
   * what Ascension would do; it is the card, shown early. A hand-written "after" pane is
   * how the shop and the fight end up disagreeing.
   */
  private comparison(cardId: string): HTMLElement {
    const before = CARDS[cardId]!;
    const after = CARDS[ascendedId(cardId)];
    const economy = this.opts.global.overworld.economy;
    const core = reagentForAscension(economy.reagents);
    const collection = this.opts.collection();
    const refusal = ascensionRefusal(this.opts.global, collection, cardId);
    // `not-owned` is the truthful code and the wrong words for this shelf. A player looking
    // at a spell their Companion casts every fight has certainly *seen* it; what they have
    // not done is forge it, and that is the sentence that tells them where to go.
    const why =
      refusal === 'not-owned' && !collection.unlocked.includes(cardId) ? 'not-forged' : refusal;

    const host = document.createElement('div');
    host.className = 'forge-compare';
    host.innerHTML = `
      <div class="forge-compare__panes">
        ${this.printing(before, 'Rank 1', 'before')}
        <div class="forge-arrow">→</div>
        ${after ? this.printing(after, 'Rank 2', 'after') : '<div class="forge-print">No Rank 2 printing.</div>'}
      </div>

      <div class="forge-till brass-panel">
        <div class="forge-till__cost">
          <span class="forge-till__label">Ascension · +${ASCENSION_PERCENT}%</span>
          <span class="forge-till__shards">${ASCENSION_COST.ducats} d · ${ASCENSION_COST.shards} Aether Shards · ${ASCENSION_COST.reagents} Core</span>
          <span class="forge-till__held">You hold ${economy.ducats} d, ${economy.marrowShards} Shards, ${
            core ? `${ASCENSION_COST.reagents}× ${reagentById(core)?.name ?? core}` : 'no Core'
          }</span>
        </div>
        <button class="brass-btn forge-till__go">Ascend Card</button>
        <div class="forge-till__refusal">${REFUSAL_COPY[why ?? 'none']}</div>
      </div>
    `;

    const btn = host.querySelector<HTMLButtonElement>('.forge-till__go')!;
    btn.disabled = refusal !== null || !after;
    btn.addEventListener('click', () => this.ascend(cardId));

    for (const opener of host.querySelectorAll<HTMLElement>('[data-expand]')) {
      opener.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const def = CARDS[opener.dataset.expand ?? ''];
        if (def) this.expandCard(def);
      });
    }
    return host;
  }

  /**
   * One printing, as the real card face.
   *
   * Both sides use the same renderer the hand uses, so the *only* thing that differs
   * between Rank 1 and Rank 2 on screen is the data — which is the entire question the
   * player is asking. This was a bespoke `forge-print` that showed a subset: no keywords,
   * no type line, no source. A Rank 2 that only adds a keyword looked identical to its
   * Rank 1, in the one screen built to compare them.
   */
  private printing(def: CardDef, rank: string, side: string): string {
    return `
      <div class="forge-print forge-print--${side}">
        <button class="forge-print__rank" data-expand="${def.id}" title="Open full card">
          ${rank} <span class="forge-print__zoom">⤢</span>
        </button>
        ${cardFaceHtml(faceOfDef(def), { extraClass: 'card--compare', showReach: true })}
      </div>
    `;
  }

  /**
   * The full-size card, over everything.
   *
   * The compared faces are deliberately small so both fit side by side; this is the way
   * back to reading one properly. Dismissed by clicking anywhere, because a modal in a
   * shop that needs aiming to close is a modal that gets in the way.
   */
  private expandCard(def: CardDef): void {
    this.el?.querySelector('.forge-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'forge-modal';
    modal.innerHTML = `
      <div class="forge-modal__inner">
        ${cardFaceHtml(faceOfDef(def), { extraClass: 'card--large', showReach: true })}
        <div class="forge-modal__hint">Click anywhere to close</div>
      </div>
    `;
    modal.addEventListener('click', () => modal.remove());
    this.el?.appendChild(modal);
    this.tooltip?.attach(modal);
  }

  private ascend(cardId: string): void {
    // The till decides, not the button state: a stale render must not be able to spend.
    if (!this.opts.onAscend(cardId)) return;
    this.opts.onChange();
    this.chosen = null;
    this.render();
  }

  // -------------------------------------------------------- aetheric splicing

  /**
   * The press, rebuilt around the beast rather than around the bag.
   *
   * The old bench was two slots and a tray of "cards the book can press". It was correct
   * and it taught nothing: a player had no way to see that the Flame Surge in the tray was
   * the *same card their Ignis brings to every fight*, and no reason to connect pressing it
   * with what would happen on the board. Splicing read as inventory management.
   *
   * It is Companion-centric now. Pick a beast, see its eight, press one of them. The card
   * you are mutating is a card you have watched it cast, and the fusion that comes out has
   * a slot waiting for it — which is the whole loop, said in one screen.
   *
   * The lock is the other half of the lesson. A Companion *brings* its eight; it does not
   * give them to you. Mutating a card means owning it, and owning it means Schematic
   * Forging — so a card the beast casts every fight can still be greyed out here, and the
   * tooltip says exactly which bench to go to.
   */
  private spliceBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'splice2';

    const roster = this.opts.companions();
    if (roster.length === 0) {
      host.innerHTML = `<div class="forge-empty brass-panel">
        No Companion is bound. The press works on a beast's own spells, and there is no
        beast — take a Subjugation contract and come back with one.
      </div>`;
      return host;
    }

    if (!this.beast || !roster.some((c) => c.instanceId === this.beast)) {
      this.beast = this.opts.activeCompanionId() ?? roster[0]!.instanceId;
    }

    host.innerHTML = `
      <div class="splice2__beasts brass-panel">
        <div class="splice2__beasts-title">The Vivarium</div>
        <div class="splice2__beasts-list"></div>
      </div>
      <div class="splice2__book">
        <div class="splice2__book-head">
          <span class="splice2__book-title"></span>
          <span class="splice2__book-sub"></span>
        </div>
        <div class="splice2__slots"></div>
      </div>
      <div class="splice2__press brass-panel">
        <div class="splice2__press-title">The Press</div>
        <div class="splice2__cores"></div>
        <div class="splice2__out"></div>
        <button class="brass-btn splice2__go">Splice</button>
        <div class="splice2__refusal"></div>
      </div>
    `;

    this.paintBeasts(host, roster);
    this.paintBook(host, roster);
    this.paintPress(host, roster);
    return host;
  }

  /** The roster, as a column. Two Ignis are two animals and socket separately. */
  private paintBeasts(host: HTMLElement, roster: readonly CompanionInstance[]): void {
    const list = host.querySelector('.splice2__beasts-list')!;
    const active = this.opts.activeCompanionId();

    for (const beast of roster) {
      const def = companionById(beast.baseId);
      const row = document.createElement('button');
      row.className = 'splice2__beast';
      row.classList.toggle('is-chosen', beast.instanceId === this.beast);
      row.style.setProperty('--school', schoolOf((def?.school ?? 'neutral') as never).main);
      const socketed = Object.keys(beast.overrides ?? {}).length;
      row.innerHTML = `
        <span class="splice2__beast-name">${def?.name ?? beast.baseId}</span>
        <span class="splice2__beast-sub">${def?.school ?? ''} · Lv ${beast.level}${
          socketed ? ` · ${socketed} socketed` : ''
        }${beast.instanceId === active ? ' · bound' : ''}</span>
      `;
      row.addEventListener('click', () => {
        this.beast = beast.instanceId;
        // The loaded slot belonged to the other beast's book.
        this.slotIndex = null;
        this.render();
      });
      list.appendChild(row);
    }
  }

  /** Whichever beast is being looked at, and the eight it will actually fuse in. */
  private chosenBeast(roster: readonly CompanionInstance[]): CompanionInstance | undefined {
    return roster.find((c) => c.instanceId === this.beast);
  }

  private bookOf(beast: CompanionInstance): string[] {
    const def = companionById(beast.baseId);
    const drafted = beast.grimoire.length > 0 ? beast.grimoire : (def?.legacyGrimoire ?? []);
    return resolveGrimoire(drafted, beast.overrides);
  }

  /**
   * The beast's eight, as cards, each one either pressable or locked.
   *
   * Locked is drawn rather than hidden, and that is the point of the panel: a player has to
   * be able to see the card their Companion casts, understand that they do not *own* it,
   * and be told where to go about that.
   */
  private paintBook(host: HTMLElement, roster: readonly CompanionInstance[]): void {
    const beast = this.chosenBeast(roster);
    const slots = host.querySelector('.splice2__slots')!;
    const collection = this.opts.collection();
    if (!beast) return;

    const def = companionById(beast.baseId);
    host.querySelector('.splice2__book-title')!.textContent = `${def?.name ?? beast.baseId}'s Grimoire`;
    host.querySelector('.splice2__book-sub')!.textContent =
      'The eight it fuses in at the bell. Press one you own to mutate it.';

    const book = this.bookOf(beast);
    book.forEach((cardId, slot) => {
      const card = CARDS[cardId];
      if (!card) return;

      const owned = collection.unlocked.includes(cardId);
      const pressable = owned && spliceableBaseIds().includes(cardId);
      const socketed = Boolean(beast.overrides?.[slot]);

      const cell = document.createElement('button');
      cell.className = 'splice2__slot';
      cell.classList.toggle('is-locked', !owned);
      cell.classList.toggle('is-inert', owned && !pressable);
      cell.classList.toggle('is-chosen', this.slotIndex === slot);
      cell.classList.toggle('is-socketed', socketed);
      cell.disabled = !pressable;

      cell.innerHTML = `
        <span class="splice2__slot-index">${slot + 1}</span>
        ${cardFaceHtml(faceOfDef(card), { extraClass: 'card--mini' })}
        ${
          owned
            ? pressable
              ? ''
              : '<span class="splice2__slot-note">The book has no pressing for this</span>'
            : '<span class="splice2__slot-lock" data-tip="Locked|Must unlock via Schematic Forging to mutate.|Your Companion brings this card to every fight, but bringing is not owning — the press works on cards in your own collection.">🔒 Locked</span>'
        }
        ${socketed ? '<span class="splice2__slot-socket">SOCKET</span>' : ''}
      `;

      cell.addEventListener('click', () => {
        this.slotIndex = this.slotIndex === slot ? null : slot;
        this.render();
      });
      slots.appendChild(cell);
    });
  }

  /** Cores, the output preview, and the till. */
  private paintPress(host: HTMLElement, roster: readonly CompanionInstance[]): void {
    const beast = this.chosenBeast(roster);
    const book = beast ? this.bookOf(beast) : [];
    const baseId = this.slotIndex === null ? undefined : book[this.slotIndex];
    const base = baseId ? CARDS[baseId] : undefined;

    // --- the bag
    const cores = host.querySelector('.splice2__cores')!;
    const held = this.opts.global.overworld.economy.reagents;
    for (const reagent of REAGENTS) {
      const count = held[reagent.id] ?? 0;
      const chip = document.createElement('button');
      chip.className = 'splicing-chip splicing-chip--reagent';
      chip.style.setProperty('--school', schoolOf(reagent.school).main);
      chip.dataset.tip = `${reagent.name}|${reagent.blurb}|${count} held`;
      chip.textContent = `${reagent.name} ×${count}`;
      chip.disabled = count <= 0;
      chip.classList.toggle('is-loaded', this.slotB === reagent.id);
      chip.addEventListener('click', () => {
        this.slotB = this.slotB === reagent.id ? null : reagent.id;
        this.render();
      });
      cores.appendChild(chip);
    }

    // --- what comes out
    const recipe = base && this.slotB ? recipeFor(base.id, this.slotB) : undefined;
    const result = recipe ? CARDS[recipe.resultId] : undefined;
    const refusal =
      base && this.slotB
        ? spliceRefusal(this.opts.global, this.opts.collection(), base.id, this.slotB)
        : null;

    const out = host.querySelector<HTMLElement>('.splice2__out')!;
    out.classList.toggle('is-ready', Boolean(result && refusal === null));
    out.innerHTML = result
      ? cardFaceHtml(faceOfDef(result), { extraClass: 'card--mini', showReach: true })
      : base && this.slotB
        ? '<span class="splice2__none">Nothing comes of that pairing.</span>'
        : !base
          ? '<span class="splice2__none">Pick a spell from the book</span>'
          : '<span class="splice2__none">Pick a Core</span>';

    const btn = host.querySelector<HTMLButtonElement>('.splice2__go')!;
    btn.disabled = !result || refusal !== null;
    btn.addEventListener('click', () => this.splice());

    const why = host.querySelector<HTMLElement>('.splice2__refusal')!;
    why.textContent = base && this.slotB ? (REFUSAL_COPY[refusal ?? 'none'] ?? '') : '';

    // What the recipe still wants, named rather than merely refused.
    if (base && this.slotB && refusal === 'missing-prerequisite') {
      const missing = missingPrerequisites(this.opts.collection(), base.id, this.slotB)
        .map((id) => CARDS[id]?.name ?? id)
        .join(', ');
      why.textContent = `Learn ${missing} first — a fusion needs both its schools.`;
    }
  }

  private splice(): void {
    const roster = this.opts.companions();
    const beast = this.chosenBeast(roster);
    const book = beast ? this.bookOf(beast) : [];
    const slot = this.slotIndex;
    const baseId = slot === null ? undefined : book[slot];
    if (!baseId || !this.slotB || !beast || slot === null) return;

    // The bench decides, not the button state: a stale render must not be able to spend.
    const done = this.opts.onSplice(baseId, this.slotB);
    if (!done) return;

    this.opts.onChange();
    // The Core is one lighter and the base card is now sitting beside a fusion of itself.
    // Clearing the Core is the honest reset; the slot stays loaded, because the very next
    // thing a player may want is to press the same spell with a different Core.
    this.slotB = null;
    this.render();
    // The choice the whole redesign exists to offer: the fusion is yours either way, and
    // the only question is whether the beast starts casting it.
    this.offerSocket(beast.instanceId, slot, done.resultId, baseId);
  }

  /**
   * "You made a thing. Does the beast carry it?"
   *
   * A modal rather than an automatic socket, because both answers are right. Slotting it in
   * is what a player pressing from the book usually wants; keeping the base card is what a
   * player who was pressing for the *collection* wants, and silently overwriting a spell
   * their Companion drafted would be the bench making a build decision for them.
   *
   * The socket is offered only when it would actually seat. A fusion pressed out of a
   * beast's own book always shares a school with it, so this is a guard rather than a
   * common case — but a guard that shows an unusable button is a guard that lies.
   */
  private offerSocket(instanceId: string, slot: number, resultId: string, replacedId: string): void {
    const made = CARDS[resultId];
    const replaced = CARDS[replacedId];
    const beast = this.opts.companions().find((c) => c.instanceId === instanceId);
    const source = beast ? companionById(beast.baseId)?.grimoire : undefined;
    if (!made || !source) return;

    const refusal = socketRefusal(source, this.opts.collection().unlocked, slot, resultId);

    const modal = document.createElement('div');
    modal.className = 'socket-modal';
    modal.innerHTML = `
      <div class="socket-modal__inner brass-panel">
        <div class="socket-modal__head">
          <span class="socket-modal__title">The press yields ${made.name}</span>
          <span class="socket-modal__sub">It is yours either way. The only question is whether ${
            companionById(beast!.baseId)?.name ?? 'the beast'
          } starts casting it in slot ${slot + 1}, in place of ${replaced?.name ?? 'the base card'}.</span>
        </div>
        <div class="socket-modal__options">
          <button class="socket-option" data-choice="socket" ${refusal ? 'disabled' : ''}>
            <span class="socket-option__label">Socket Hybrid</span>
            <span class="socket-option__name">${made.name} rides into every fight</span>
          </button>
          <button class="socket-option" data-choice="keep">
            <span class="socket-option__label">Keep Base Card</span>
            <span class="socket-option__name">${
              replaced?.name ?? 'The base card'
            } stays; the fusion waits in the Case</span>
          </button>
        </div>
        ${refusal ? `<div class="socket-modal__empty">${REFUSAL_COPY[refusal] ?? refusal}</div>` : ''}
      </div>
    `;

    modal.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      const choice = target.closest<HTMLElement>('[data-choice]');
      if (!choice) return;
      if (choice.dataset.choice === 'socket') {
        this.opts.onSocket(instanceId, slot, resultId);
        this.opts.onChange();
      }
      modal.remove();
      this.render();
    });

    this.el?.appendChild(modal);
    this.tooltip?.attach(modal);
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
