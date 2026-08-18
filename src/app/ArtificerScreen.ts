/**
 * The Ironworks Artificer.
 *
 * Everything to do with cards happens at this bench and nowhere else — the Apothecary
 * sells nothing that goes in a deck, and this screen sells nothing that goes in a
 * satchel. The separation is enforced by what each file imports rather than by intent.
 *
 * Two trades share the workbench, and they are genuinely different jobs, so they are tabs
 * rather than columns: **Blueprint Forging** buys a card outright, **Aetheric Splicing**
 * presses two things into a third. Splicing is scaffolding only — the slots accept a
 * selection and the press stays cold, because a hybrid card has no representation in the
 * engine yet and a bench that produced one would be lying about what it made.
 */

import type { Screen } from './ScreenManager.js';
import type { CardDef } from '../core/types/cards.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { Catalyst } from '../core/data/artificer.js';
import { CATALYSTS, blueprintsFor, canForge, forgeCostOf } from '../core/data/artificer.js';
import { CARDS } from '../core/data/cards/index.js';
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
  /** Hands the forged card to whoever owns the collection; the bench does not. */
  onForge: (cardId: string) => void;
  /**
   * Called once after a forge, when both the purse and the collection have changed.
   *
   * Required rather than optional: it is the only write to disk on this screen, and a
   * caller that forgot it would spend Ducats that came back on the next reload.
   */
  onChange: () => void;
  onBack: () => void;
}

type Bench = 'forge' | 'splice';

export class ArtificerScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;
  private bench: Bench = 'forge';

  /** The splicing bench's two slots. Held, displayed, and otherwise inert. */
  private slotA: string | null = null;
  private slotB: string | null = null;

  constructor(private readonly opts: ArtificerOpts) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--artificer';
    el.innerHTML = `
      <div class="workbench__head brass-panel">
        <div>
          <div class="workbench__title">The Ironworks Artificer</div>
          <div class="workbench__sub">Blueprints hammered flat · reagents pressed in</div>
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
        <button class="workbench-tab" data-bench="forge">Blueprint Forging</button>
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

  // ------------------------------------------------------- blueprint forging

  private forgeBench(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'forge-bench';

    const blueprints = blueprintsFor(this.opts.collection());
    if (blueprints.length === 0) {
      host.innerHTML = `<div class="forge-empty brass-panel">
        Nothing left to draw up. You own a copy of everything the bench knows how to make.
      </div>`;
      return host;
    }

    const list = document.createElement('div');
    list.className = 'forge-list';
    for (const def of blueprints) list.appendChild(this.blueprintRow(def));

    const note = document.createElement('div');
    note.className = 'forge-note';
    note.textContent =
      'Forging buys the first copy only. Further copies are what winning is for.';

    host.append(list, note);
    return host;
  }

  private blueprintRow(def: CardDef): HTMLElement {
    const cost = forgeCostOf(def);
    const { economy } = this.opts.global.overworld;
    const affordable = canForge(cost, economy);
    const colors = schoolOf(def.school as never);

    const row = document.createElement('div');
    row.className = 'blueprint-row brass-panel';
    row.style.setProperty('--school', colors.main);
    row.dataset.tip = `${def.name}|${def.text}|${def.source === 'companion' ? 'Companion' : 'Hero'} · Tier ${tierOf(def)}`;
    row.innerHTML = `
      <span class="blueprint-row__cost">${formatCost(def.cost)}</span>
      <span class="blueprint-row__body">
        <span class="blueprint-row__name">${def.name}</span>
        <span class="blueprint-row__text">${def.text}</span>
      </span>
      <span class="blueprint-row__price">
        <span class="blueprint-row__coin blueprint-row__coin--gold">${cost.ducats} d</span>
        <span class="blueprint-row__coin blueprint-row__coin--marrow">${cost.shards} shard${cost.shards === 1 ? '' : 's'}</span>
      </span>
      <button class="brass-btn blueprint-row__forge">Forge</button>
    `;

    const btn = row.querySelector<HTMLButtonElement>('.blueprint-row__forge')!;
    btn.disabled = !affordable;
    btn.addEventListener('click', () => this.forge(def, cost));
    return row;
  }

  private forge(def: CardDef, cost: { ducats: number; shards: number }): void {
    const { economy } = this.opts.global.overworld;
    if (!canForge(cost, economy)) return;

    economy.ducats -= cost.ducats;
    economy.marrowShards -= cost.shards;
    // The collection is not the run's to write — it outlives the run. The owner of the
    // save takes it from here.
    this.opts.onForge(def.id);
    this.opts.onChange();
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
