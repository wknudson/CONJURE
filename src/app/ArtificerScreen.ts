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
import type { Reagent } from '../core/data/splicing.js';
import { schematicCatalogue } from '../core/data/artificer.js';
import { REAGENTS, recipeFor, spliceableBaseIds } from '../core/data/splicing.js';
import { spliceRefusal, type SpliceResult } from '../core/overworld/splice.js';
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
import { filterBarHtml, matchesPips, pipPills, wireFilterBar } from '../hud/filterBar.js';
import { Tooltip } from '../hud/Tooltip.js';
import { ASCENSION_PERCENT } from '../core/data/ascension.js';
import { reagentById } from '../core/data/splicing.js';

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
   * Performs the transaction and reports whether it happened.
   *
   * The bench never writes the collection itself — it outlives this screen and belongs to
   * the save. Both of these take payment and hand back a result, and the screen simply
   * re-renders whatever the till decided.
   */
  onAscend: (cardId: string) => boolean;
  onForgeSchematic: (cardId: string) => boolean;
  /** Presses a card and a core together. Null when the bench refused. */
  onSplice: (baseCardId: string, catalystId: string) => SpliceResult | null;
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
  /** The chosen Pip pill, as its key. Compared through `matchesPips`. */
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
 */
const KIND_PILLS: { key: 'all' | CardDef['kind']; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'spell', label: 'Spells' },
  { key: 'minion', label: 'Minions' },
  { key: 'obstacle', label: 'Constructs' },
  { key: 'rune', label: 'Runes' },
];

const SORT_PILLS: { key: SchematicFilters['sort']; label: string }[] = [
  { key: 'unlock', label: 'Unforged first' },
  { key: 'cost', label: 'Pip cost' },
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

  /** The splicing bench's two slots. Held, displayed, and otherwise inert. */
  private slotA: string | null = null;
  private slotB: string | null = null;

  /** The card laid on the Forge, whose two printings are being compared. */
  private chosen: string | null = null;
  /** The last thing the press produced, so the bench can say what it made. */
  private lastSplice: SpliceResult | null = null;

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
        <button class="brass-btn workbench__back">Back to Safehouse</button>
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
      { name: 'cost', label: 'Pips', active: String(f.cost), pills: pipPills() },
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
    const f = this.filters;

    const shown = schematicCatalogue()
      .filter((d) => f.school === 'all' || d.school === f.school)
      .filter((d) => f.source === 'all' || d.source === f.source)
      .filter((d) => f.kind === 'all' || d.kind === f.kind)
      .filter((d) => matchesPips(d.cost.pips, f.cost))
      .sort((a, b) => {
        const ownedA = collection.unlocked.includes(a.id) ? 1 : 0;
        const ownedB = collection.unlocked.includes(b.id) ? 1 : 0;
        switch (f.sort) {
          case 'cost':
            return a.cost.pips - b.cost.pips || a.name.localeCompare(b.name);
          case 'school':
            return a.school.localeCompare(b.school) || a.name.localeCompare(b.name);
          case 'unlock':
            return ownedA - ownedB || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });

    if (count) {
      const unforged = shown.filter((d) => !collection.unlocked.includes(d.id)).length;
      count.textContent = shown.length
        ? `${shown.length} schematic${shown.length === 1 ? '' : 's'} · ${unforged} unforged`
        : '';
    }

    grid.innerHTML = '';
    if (shown.length === 0) {
      grid.innerHTML = `<div class="forge-empty brass-panel">
        Nothing on the shelf matches that. Widen the filters.
      </div>`;
      return;
    }

    for (const def of shown) grid.appendChild(this.schematicCard(def, collection));
  }

  /** One blueprint: the card, its price, and the one button that cuts it. */
  private schematicCard(def: CardDef, collection: Collection): HTMLElement {
    const refusal = schematicRefusal(this.opts.global, collection, def.id);
    const owned = collection.unlocked.includes(def.id);

    const cell = document.createElement('div');
    cell.className = `sch-cell${owned ? ' is-owned' : ''}`;
    cell.innerHTML = `
      ${cardFaceHtml(faceOfDef(def), { extraClass: 'card--mini', showReach: true })}
      <div class="sch-cell__foot">
        <span class="sch-cell__price">${owned ? 'Held' : `${SCHEMATIC_COST_DUCATS} d`}</span>
        <button class="brass-btn sch-cell__cut">${owned ? 'Held' : 'Forge'}</button>
      </div>
      <div class="sch-cell__refusal">${refusal === 'too-poor' ? 'Not enough Ducats' : ''}</div>
    `;

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

  private forgeBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'forge-bench';

    const candidates = ascendableFor(this.opts.collection());
    if (candidates.length === 0) {
      host.innerHTML = `<div class="forge-empty brass-panel">
        Nothing on the bench. Ascension needs a card you own and have not already raised —
        win one, or come back when the Board has paid you better.
      </div>`;
      return host;
    }

    // Default to the first candidate rather than an empty right-hand pane: the comparison
    // is the whole point of the screen, and an empty one teaches nothing.
    if (!this.chosen || !candidates.includes(this.chosen)) this.chosen = candidates[0]!;

    const layout = document.createElement('div');
    layout.className = 'forge-layout';

    const list = document.createElement('div');
    list.className = 'forge-list';
    for (const id of candidates) list.appendChild(this.candidateRow(id));

    layout.append(list, this.comparison(this.chosen));
    host.appendChild(layout);
    return host;
  }

  private candidateRow(cardId: string): HTMLElement {
    const def = CARDS[cardId]!;
    const row = document.createElement('button');
    row.className = 'forge-row brass-panel';
    row.classList.toggle('is-chosen', this.chosen === cardId);
    row.style.setProperty('--school', schoolOf(def.school as never).main);
    row.innerHTML = `
      <span class="forge-row__cost">${formatCost(def.cost)}</span>
      <span class="forge-row__name">${def.name}</span>
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
    const refusal = ascensionRefusal(this.opts.global, this.opts.collection(), cardId);

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
        <div class="forge-till__refusal">${REFUSAL_COPY[refusal ?? 'none']}</div>
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
   * The press: a base card in slot A, a core in slot B, a hybrid out of the die.
   *
   * A hybrid is *looked up*, never assembled — the recipe book names a card that already
   * exists in the registry, so the bench cannot produce something the engine has no idea
   * how to resolve. The output pane reads that card straight out of `CARDS`, which means
   * what is previewed here and what lands in the collection are the same object.
   */
  private spliceBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'splicing-bench';
    host.innerHTML = `
      <div class="splicing-rig">
        <div class="splicing-slot splicing-slot--base">
          <div class="splicing-slot__label">Slot A · Base Card</div>
          <div class="splicing-slot__well"></div>
        </div>
        <div class="splicing-arm"><i></i><i></i><i></i></div>
        <div class="splicing-slot splicing-slot--catalyst">
          <div class="splicing-slot__label">Slot B · Catalyst Core</div>
          <div class="splicing-slot__well"></div>
        </div>
        <div class="splicing-arm"><i></i><i></i><i></i></div>
        <div class="splicing-output brass-panel">
          <div class="splicing-output__label">Output</div>
          <div class="splicing-output__plate"></div>
          <button class="brass-btn splicing-output__go">Splice</button>
          <div class="splicing-output__refusal"></div>
        </div>
      </div>

      <div class="splicing-trays">
        <div class="splicing-tray splicing-tray--cards">
          <div class="splicing-tray__title">Cards the bench can press</div>
          <div class="splicing-tray__items" data-tray="a"></div>
        </div>
        <div class="splicing-tray splicing-tray--reagents">
          <div class="splicing-tray__title">Cores held</div>
          <div class="splicing-tray__items" data-tray="b"></div>
        </div>
      </div>
    `;

    if (this.lastSplice) {
      const said = document.createElement('div');
      said.className = 'splicing-said brass-panel';
      const made = CARDS[this.lastSplice.resultId];
      said.textContent = this.lastSplice.trimmed > 0
        ? `The press yields ${made?.name ?? 'something'}. ${this.lastSplice.trimmed} copy pulled from a deck to pay for it.`
        : `The press yields ${made?.name ?? 'something'}.`;
      host.prepend(said);
    }

    this.fillCardTray(host);
    this.fillReagentTray(host);
    this.paintSlots(host);
    return host;
  }

  /**
   * Only cards the book has a recipe for, and only ones the player owns.
   *
   * Offering the whole collection would mean most clicks land on "the bench knows no such
   * pressing", which teaches nothing. Narrowing the tray makes the choice legible: these
   * are the things that go in the press.
   */
  private fillCardTray(host: HTMLElement): void {
    const tray = host.querySelector('[data-tray="a"]')!;
    const collection = this.opts.collection();
    const owned = spliceableBaseIds()
      .filter((id) => collection.unlocked.includes(id) && CARDS[id])
      .map((id) => CARDS[id]!);

    if (owned.length === 0) {
      tray.innerHTML =
        '<span class="splicing-tray__empty">Nothing here presses. The book wants a Pyre spell.</span>';
      return;
    }

    for (const def of owned) {
      const chip = document.createElement('button');
      chip.className = 'splicing-chip';
      chip.style.setProperty('--school', schoolOf(def.school as never).main);
      chip.textContent = def.name;
      chip.classList.toggle('is-loaded', this.slotA === def.id);
      chip.addEventListener('click', () => {
        this.slotA = this.slotA === def.id ? null : def.id;
        this.render();
      });
      tray.appendChild(chip);
    }
  }

  /** The bag, as chips. A core the player holds none of is shown spent rather than hidden. */
  private fillReagentTray(host: HTMLElement): void {
    const tray = host.querySelector('[data-tray="b"]')!;
    const { reagents } = this.opts.global.overworld.economy;

    for (const reagent of REAGENTS) {
      const held = reagents[reagent.id] ?? 0;
      const chip = document.createElement('button');
      chip.className = 'splicing-chip splicing-chip--reagent';
      chip.style.setProperty('--school', schoolOf(reagent.school).main);
      chip.dataset.tip = `${reagent.name}|${reagent.blurb}|${held} held`;
      chip.textContent = `${reagent.name} ×${held}`;
      chip.disabled = held <= 0;
      chip.classList.toggle('is-loaded', this.slotB === reagent.id);
      chip.addEventListener('click', () => {
        this.slotB = this.slotB === reagent.id ? null : reagent.id;
        this.render();
      });
      tray.appendChild(chip);
    }
  }

  private paintSlots(host: HTMLElement): void {
    const base = this.slotA ? CARDS[this.slotA] : undefined;
    const reagent: Reagent | undefined = REAGENTS.find((r) => r.id === this.slotB);

    // Slot A shows the card itself. A bench that names the card you loaded and hides its
    // rules text is asking you to remember what you are pressing.
    const wellA = host.querySelector<HTMLElement>('.splicing-slot--base .splicing-slot__well')!;
    wellA.classList.toggle('is-loaded', Boolean(base));
    wellA.innerHTML = base
      ? cardFaceHtml(faceOfDef(base), { extraClass: 'card--mini', showReach: true })
      : '<span class="splicing-slot__empty">empty</span>';

    // Slot B is a reagent rather than a card, so it gets a card-shaped face without a
    // cost: a core is not bought at a Pip price, and printing a `0` there would invent one.
    const wellB = host.querySelector<HTMLElement>('.splicing-slot--catalyst .splicing-slot__well')!;
    wellB.classList.toggle('is-loaded', Boolean(reagent));
    wellB.innerHTML = reagent
      ? `<div class="card card--reagent card--mini" style="--school:${schoolOf(reagent.school).main};--school-deep:${schoolOf(reagent.school).deep}">
           <div class="card__name">${reagent.name}</div>
           <div class="card__type"><span class="card__kind">CORE</span><span class="card__source">${reagent.school.toUpperCase()}</span></div>
           <div class="card__body"><div class="card__text">${reagent.blurb ?? ''}</div></div>
         </div>`
      : '<span class="splicing-slot__empty">empty</span>';

    const recipe = base && reagent ? recipeFor(base.id, reagent.id) : undefined;
    const result = recipe ? CARDS[recipe.resultId] : undefined;
    const refusal =
      base && reagent
        ? spliceRefusal(this.opts.global, this.opts.collection(), base.id, reagent.id)
        : null;

    const plate = host.querySelector<HTMLElement>('.splicing-output__plate')!;
    plate.classList.toggle('is-ready', Boolean(result && refusal === null));
    // The output is the pressing's whole face, before a Shard is spent. What comes out of
    // the bench is the thing being bought, so it is shown the way it will be held.
    plate.innerHTML = result
      ? cardFaceHtml(faceOfDef(result), { extraClass: 'card--mini', showReach: true })
      : base && reagent
        ? '<span class="splicing-output__none">Nothing comes of that pairing.</span>'
        : '<span class="splicing-output__none">Load both slots</span>';

    const btn = host.querySelector<HTMLButtonElement>('.splicing-output__go')!;
    btn.disabled = !result || refusal !== null;
    btn.addEventListener('click', () => this.splice());

    host.querySelector('.splicing-output__refusal')!.textContent =
      base && reagent ? REFUSAL_COPY[refusal ?? 'none'] ?? '' : '';

    host.querySelector('.splicing-rig')!.classList.toggle('is-loaded', Boolean(result));
  }

  private splice(): void {
    if (!this.slotA || !this.slotB) return;
    // The bench decides, not the button state: a stale render must not be able to spend.
    const done = this.opts.onSplice(this.slotA, this.slotB);
    if (!done) return;

    this.opts.onChange();
    // The base card may be gone from the tray entirely now, and the core certainly is one
    // lighter. Clearing both slots is the honest reset — leaving them loaded would show a
    // press the player may no longer be able to make.
    this.slotA = null;
    this.slotB = null;
    this.lastSplice = done;
    this.render();
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
