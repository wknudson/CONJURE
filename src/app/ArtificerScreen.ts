/**
 * The Ironworks Artificer.
 *
 * Everything to do with cards happens at this bench and nowhere else — the Apothecary
 * sells nothing that goes in a deck, and this screen sells nothing that goes in a
 * satchel. The separation is enforced by what each file imports rather than by intent.
 *
 * Two trades share the workbench, and they are genuinely different jobs, so they are tabs
 * rather than columns: the **Ascension Forge** upgrades a card you already know to its
 * Rank 2 printing, and **Aetheric Splicing** presses two things into a third.
 *
 * Splicing is scaffolding only — the slots accept a selection and the press stays cold,
 * because a hybrid card has no representation in the engine and a bench that produced one
 * would be lying about what it made. The Forge is built out but not yet lit: the mutation
 * it would perform is the Rank 2 id mapping still awaiting a ruling, and a button that
 * charged three Shards for a decision nobody had made yet would be worse than a cold one.
 */

import type { Screen } from './ScreenManager.js';
import type { CardDef } from '../core/types/cards.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { Catalyst } from '../core/data/artificer.js';
import { CATALYSTS } from '../core/data/artificer.js';
import { CARDS, ascendedId } from '../core/data/cards/index.js';
import { ascendableFor } from '../core/data/collection.js';
import { formatCost } from '../hud/cost.js';
import { tierOf } from '../core/data/deckRules.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

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
   * Performs the Ascension, or absent while the forge is unlit.
   *
   * The bench takes no payment and writes nothing itself: Shards and the collection both
   * outlive this screen. Absent rather than a no-op function so the UI can *say* the
   * forge is cold instead of silently swallowing a click.
   */
  onAscend?: (cardId: string) => void;
  /** Called once after an Ascension, when the purse and the collection have both moved. */
  onChange: () => void;
  onBack: () => void;
}

/** Flat rate, whatever the card. Ascension is a sink, not a market. */
export const ASCENSION_COST_SHARDS = 3;

type Bench = 'forge' | 'splice';

export class ArtificerScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;
  private bench: Bench = 'forge';

  /** The splicing bench's two slots. Held, displayed, and otherwise inert. */
  private slotA: string | null = null;
  private slotB: string | null = null;

  /** The card laid on the Forge, whose two printings are being compared. */
  private chosen: string | null = null;

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
        <button class="workbench-tab" data-bench="forge">Ascension Forge</button>
        <button class="workbench-tab" data-bench="splice">Aetheric Splicing</button>
      </div>

      <div class="workbench__body"></div>
    `;

    el.querySelector('.workbench__back')!.addEventListener('click', () => this.opts.onBack());
    for (const tab of el.querySelectorAll<HTMLElement>('.workbench-tab')) {
      tab.addEventListener('click', () => {
        this.bench = (tab.dataset.bench as Bench) ?? 'forge';
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
    body.replaceChildren(this.bench === 'forge' ? this.forgeBench() : this.spliceBench());
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
   * Both panes read out of `CARDS`, and the Rank 2 entry there was merged from the card's
   * own `rank2` block at load. So this is not a preview of what Ascension would do — it
   * is the card, shown early. A hand-written "after" pane is how the shop and the fight
   * end up disagreeing.
   */
  private comparison(cardId: string): HTMLElement {
    const before = CARDS[cardId]!;
    const after = CARDS[ascendedId(cardId)];
    const shards = this.opts.global.overworld.economy.marrowShards;
    const affordable = shards >= ASCENSION_COST_SHARDS;
    const lit = Boolean(this.opts.onAscend);

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
          <span class="forge-till__label">Ascension</span>
          <span class="forge-till__shards">${ASCENSION_COST_SHARDS} Aether Shards</span>
          <span class="forge-till__held">You hold ${shards}</span>
        </div>
        <button class="brass-btn forge-till__go">Ascend Card</button>
        <div class="forge-till__refusal">${
          !affordable ? 'Not enough Shards' : !lit ? 'The forge is not lit' : ''
        }</div>
      </div>
    `;

    const btn = host.querySelector<HTMLButtonElement>('.forge-till__go')!;
    btn.disabled = !affordable || !lit || !after;
    btn.addEventListener('click', () => this.ascend(cardId));
    return host;
  }

  /** One printing as a card face. Same markup both sides, so differences are the data. */
  private printing(def: CardDef, rank: string, side: string): string {
    const colors = schoolOf(def.school as never);
    const unit = def.unit;
    return `
      <div class="forge-print forge-print--${side}" style="--school:${colors.main}">
        <div class="forge-print__rank">${rank}</div>
        <div class="forge-print__name">${def.name}</div>
        <div class="forge-print__cost">${formatCost(def.cost)}</div>
        <div class="forge-print__text">${def.text}</div>
        ${
          unit
            ? `<div class="forge-print__stats">
                 <span>ATK ${unit.atk}</span><span>HP ${unit.hp}</span><span>MOV ${unit.mov}</span>
                 <span>RNG ${unit.rangeMin}-${unit.rangeMax}</span>
               </div>`
            : ''
        }
        ${
          def.range !== undefined
            ? `<div class="forge-print__reach">reach ${def.range}${def.minRange ? ` (min ${def.minRange})` : ''}</div>`
            : ''
        }
      </div>
    `;
  }

  private ascend(cardId: string): void {
    const perform = this.opts.onAscend;
    if (!perform) return;
    if (this.opts.global.overworld.economy.marrowShards < ASCENSION_COST_SHARDS) return;

    perform(cardId);
    this.opts.onChange();
    this.chosen = null;
    this.render();
  }

  // -------------------------------------------------------- aetheric splicing

  /**
   * The press: a base card in slot A, a catalyst in slot B, a hybrid out of the die.
   *
   * Visual scaffolding. Both slots take a real selection so the layout can be judged with
   * something in it, and the output plate stays explicitly cold rather than showing an
   * invented result — a hybrid card would need an engine representation that does not
   * exist, and a mock of one here would be the thing everyone forgot was a mock.
   */
  private spliceBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'splicing-bench';
    host.innerHTML = `
      <div class="splicing-rig">
        <div class="splicing-slot splicing-slot--base" data-slot="a">
          <div class="splicing-slot__label">Slot A · Base Card</div>
          <div class="splicing-slot__well"></div>
        </div>
        <div class="splicing-arm"><i></i><i></i><i></i></div>
        <div class="splicing-slot splicing-slot--catalyst" data-slot="b">
          <div class="splicing-slot__label">Slot B · Catalyst Reagent</div>
          <div class="splicing-slot__well"></div>
        </div>
        <div class="splicing-arm"><i></i><i></i><i></i></div>
        <div class="splicing-output brass-panel">
          <div class="splicing-output__label">Output</div>
          <div class="splicing-output__plate"></div>
        </div>
      </div>

      <div class="splicing-trays">
        <div class="splicing-tray splicing-tray--cards">
          <div class="splicing-tray__title">Owned cards</div>
          <div class="splicing-tray__items" data-tray="a"></div>
        </div>
        <div class="splicing-tray splicing-tray--reagents">
          <div class="splicing-tray__title">Reagents</div>
          <div class="splicing-tray__items" data-tray="b"></div>
        </div>
      </div>
    `;

    this.fillCardTray(host);
    this.fillReagentTray(host);
    this.paintSlots(host);
    return host;
  }

  private fillCardTray(host: HTMLElement): void {
    const tray = host.querySelector('[data-tray="a"]')!;
    const collection = this.opts.collection();
    const owned = Object.keys(collection.owned)
      .filter((id) => (collection.owned[id] ?? 0) > 0 && CARDS[id])
      .map((id) => CARDS[id]!)
      .sort((a, b) => a.name.localeCompare(b.name));

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

  private fillReagentTray(host: HTMLElement): void {
    const tray = host.querySelector('[data-tray="b"]')!;
    for (const reagent of CATALYSTS) {
      const chip = document.createElement('button');
      chip.className = 'splicing-chip splicing-chip--reagent';
      chip.style.setProperty('--school', schoolOf(reagent.school).main);
      chip.dataset.tip = `${reagent.name}|${reagent.blurb}|Catalyst`;
      chip.textContent = reagent.name;
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
    const reagent: Catalyst | undefined = CATALYSTS.find((c) => c.id === this.slotB);

    const wellA = host.querySelector<HTMLElement>('.splicing-slot--base .splicing-slot__well')!;
    wellA.classList.toggle('is-loaded', Boolean(base));
    wellA.textContent = base?.name ?? 'empty';
    if (base) wellA.style.setProperty('--school', schoolOf(base.school as never).main);

    const wellB = host.querySelector<HTMLElement>('.splicing-slot--catalyst .splicing-slot__well')!;
    wellB.classList.toggle('is-loaded', Boolean(reagent));
    wellB.textContent = reagent?.name ?? 'empty';
    if (reagent) wellB.style.setProperty('--school', schoolOf(reagent.school).main);

    const plate = host.querySelector<HTMLElement>('.splicing-output__plate')!;
    const loaded = Boolean(base && reagent);
    plate.classList.toggle('is-ready', loaded);
    plate.textContent = loaded
      ? `${base!.name} · ${reagent!.name} — the press is cold`
      : 'Load both slots';

    host.querySelector('.splicing-rig')!.classList.toggle('is-loaded', loaded);
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
