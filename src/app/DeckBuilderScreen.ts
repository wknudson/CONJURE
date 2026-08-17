/**
 * The deck builder.
 *
 * Two columns: everything you own on the left, the deck you are building on the right.
 * The rules are enforced as affordances rather than as error messages — a card you
 * cannot add any more of is visibly spent before you click it — and the confirm button
 * explains precisely what is wrong when it refuses.
 */

import type { Screen } from './ScreenManager.js';
import type { CardDef } from '../core/types/cards.js';
import type { Collection } from '../core/data/deckRules.js';
import {
  MAX_DECK,
  MIN_DECK,
  TIER_COPY_LIMIT,
  baseIdOf,
  costCurve,
  remainingCopies,
  tierOf,
  validateDeck,
} from '../core/data/deckRules.js';
import { CARDS } from '../core/data/cards/index.js';
import { companionById } from '../core/data/companions.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface DeckBuilderResult {
  companionId: string;
  cards: string[];
}

export class DeckBuilderScreen implements Screen {
  private el: HTMLElement | null = null;
  private deck: string[];
  private tooltip: Tooltip | null = null;

  constructor(
    private readonly companionId: string,
    startingDeck: string[],
    private readonly collection: Collection,
    private readonly onDone: (result: DeckBuilderResult) => void,
    private readonly onCancel: () => void,
  ) {
    this.deck = [...startingDeck];
  }

  mount(root: HTMLElement): void {
    const companion = companionById(this.companionId);
    const el = document.createElement('div');
    el.className = 'screen screen--builder';
    el.innerHTML = `
      <div class="builder__head">
        <div>
          <div class="builder__title">Deck Builder</div>
          <div class="builder__sub">${companion?.name ?? 'Companion'} · ${companion?.school ?? ''}</div>
        </div>
        <div class="builder__actions">
          <button class="builder__reset">Reset to default</button>
          <button class="builder__cancel">Back</button>
          <button class="builder__confirm">Save deck</button>
        </div>
      </div>

      <div class="builder__body">
        <div class="builder__pane">
          <div class="builder__pane-title">Your collection</div>
          <div class="builder__collection"></div>
        </div>
        <div class="builder__pane builder__pane--deck">
          <div class="builder__pane-title">
            Deck <span class="builder__count"></span>
          </div>
          <div class="builder__curve"></div>
          <div class="builder__deck"></div>
          <div class="builder__problems"></div>
        </div>
      </div>
    `;

    el.querySelector('.builder__cancel')!.addEventListener('click', () => this.onCancel());
    el.querySelector('.builder__confirm')!.addEventListener('click', () => this.confirm());
    el.querySelector('.builder__reset')!.addEventListener('click', () => {
      this.deck = [...(companion?.deck ?? [])];
      this.render();
    });

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.render();
  }

  // ------------------------------------------------------------------ rendering

  private render(): void {
    this.renderCollection();
    this.renderDeck();
    this.renderCurve();
    this.renderStatus();
  }

  private renderCollection(): void {
    const host = this.el?.querySelector('.builder__collection');
    if (!host) return;

    const owned = Object.keys(this.collection.owned)
      .filter((id) => (this.collection.owned[id] ?? 0) > 0 && CARDS[id])
      .map((id) => CARDS[id]!)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

    host.innerHTML = '';
    for (const def of owned) {
      const inDeck = this.deck.filter((c) => baseIdOf(c) === def.id).length;
      const canAdd = remainingCopies(this.deck, def.id, this.collection) > 0;
      host.appendChild(this.cardRow(def, inDeck, canAdd, () => this.add(def.id)));
    }
  }

  private renderDeck(): void {
    const host = this.el?.querySelector('.builder__deck');
    if (!host) return;

    const counts = new Map<string, number>();
    for (const id of this.deck) counts.set(id, (counts.get(id) ?? 0) + 1);

    const rows = [...counts.entries()]
      .map(([id, n]) => ({ def: CARDS[id], id, n }))
      .sort((a, b) => (a.def?.cost ?? 0) - (b.def?.cost ?? 0));

    host.innerHTML = '';
    for (const { def, id, n } of rows) {
      if (!def) {
        // A card removed by a patch: show it so the player can see what to delete.
        const stale = document.createElement('button');
        stale.className = 'deckrow deckrow--stale';
        stale.innerHTML = `<span class="deckrow__name">${id} (no longer exists)</span><span class="deckrow__n">${n}×</span>`;
        stale.addEventListener('click', () => this.removeAll(id));
        host.appendChild(stale);
        continue;
      }
      host.appendChild(this.cardRow(def, n, true, () => this.remove(id), true));
    }
  }

  private cardRow(
    def: CardDef,
    count: number,
    enabled: boolean,
    onClick: () => void,
    isDeckSide = false,
  ): HTMLElement {
    const colors = schoolOf(def.school as never);
    const tier = tierOf(def);
    const row = document.createElement('button');
    row.className = `deckrow deckrow--${def.kind}`;
    row.style.setProperty('--school', colors.main);
    row.disabled = !enabled;
    row.dataset.tip = `${def.name}|${def.text}|Tier ${tier} · max ${TIER_COPY_LIMIT[tier]} per deck`;
    row.innerHTML = `
      <span class="deckrow__cost">${def.cost}</span>
      <span class="deckrow__name">${def.name}</span>
      <span class="deckrow__kind">${def.kind}</span>
      <span class="deckrow__n">${count > 0 ? `${count}×` : ''}</span>
      <span class="deckrow__op">${isDeckSide ? '−' : '+'}</span>
    `;
    row.addEventListener('click', onClick);
    return row;
  }

  private renderCurve(): void {
    const host = this.el?.querySelector('.builder__curve');
    if (!host) return;
    const curve = costCurve(this.deck);
    const peak = Math.max(1, ...curve);
    host.innerHTML = curve
      .map(
        (n, cost) => `
        <div class="curve__col" data-tip="Cost ${cost}|${n} card${n === 1 ? '' : 's'} at ${cost} Pips">
          <div class="curve__bar" style="height:${(n / peak) * 100}%"></div>
          <div class="curve__label">${cost}${cost === 6 ? '+' : ''}</div>
        </div>`,
      )
      .join('');
  }

  private renderStatus(): void {
    const countEl = this.el?.querySelector('.builder__count');
    const problemsEl = this.el?.querySelector('.builder__problems');
    const confirm = this.el?.querySelector<HTMLButtonElement>('.builder__confirm');
    if (!countEl || !problemsEl || !confirm) return;

    countEl.textContent = `${this.deck.length} / ${MIN_DECK}–${MAX_DECK}`;
    countEl.classList.toggle('is-bad', this.deck.length < MIN_DECK || this.deck.length > MAX_DECK);

    const problems = validateDeck(this.deck, this.collection);
    confirm.disabled = problems.length > 0;
    problemsEl.innerHTML = problems.length
      ? problems.map((p) => `<div class="builder__problem">${p.message}</div>`).join('')
      : '<div class="builder__ok">Legal deck — ready to fight.</div>';
  }

  // ------------------------------------------------------------------ mutation

  private add(cardId: string): void {
    if (remainingCopies(this.deck, cardId, this.collection) <= 0) return;
    this.deck.push(cardId);
    this.render();
  }

  private remove(cardId: string): void {
    const i = this.deck.lastIndexOf(cardId);
    if (i >= 0) this.deck.splice(i, 1);
    this.render();
  }

  private removeAll(cardId: string): void {
    this.deck = this.deck.filter((c) => c !== cardId);
    this.render();
  }

  private confirm(): void {
    if (validateDeck(this.deck, this.collection).length > 0) return;
    this.onDone({ companionId: this.companionId, cards: [...this.deck] });
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
