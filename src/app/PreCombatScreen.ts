/**
 * The moment between choosing a fight and having it.
 *
 * Arenas differ enough that the same deck is not equally good in all of them: a long
 * board rewards reach and mobility, a cramped one rewards area damage and bodies. This
 * screen shows the ground before the fight starts and allows a handful of changes, so
 * arriving somewhere awkward is a problem to solve rather than a loss already decided.
 *
 * The swap budget is small deliberately. Adapting should mean bringing two or three
 * answers, not rebuilding into a different deck once the terrain is known — otherwise
 * the deck built beforehand stops mattering.
 */

import type { Screen } from './ScreenManager.js';
import type { CardDef } from '../core/types/cards.js';
import type { Collection } from '../core/data/deckRules.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { readWeather } from '../hud/weather.js';
import {
  MAX_SWAPS,
  baseIdOf,
  remainingCopies,
  swapCount,
  validateDeck,
} from '../core/data/deckRules.js';
import { CARDS } from '../core/data/cards/index.js';
import { companionById } from '../core/data/companions.js';
import { territoryDepthFor } from '../core/types/state.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface PreCombatOpts {
  encounter: EncounterDef;
  companionId: string;
  deck: string[];
  collection: Collection;
  onReady: (deck: string[], seed: number) => void;
  onBack: () => void;
}

/** Reads the arena's shape as a phrase, since "6x8" alone says nothing about play. */
function describeArena(enc: EncounterDef): string {
  const { width, height } = enc;
  const area = width * height;
  if (height >= width * 1.5) return 'A narrow lane — closing the distance takes real turns.';
  if (width >= height * 1.5) return 'A broad front — expect to be flanked.';
  if (area <= 25) return 'Cramped quarters — everything is in reach of everything.';
  if (area >= 60) return 'Open ground — reach and mobility earn their keep.';
  return 'Even ground.';
}

/**
 * What the sky is doing, and what it will do to you.
 *
 * Stated in terms of consequences rather than flavour, because this is the screen where
 * the deck is chosen — "fire is weaker here" is actionable in a way that "it is raining"
 * is not.
 */
/**
 * The briefing line, from the same reading the in-combat badge wears.
 *
 * Previously a second hand-written description that had already drifted: it promised
 * rain blunted fire and said nothing about shock arcing, which by then it did.
 */
function describeWeather(enc: EncounterDef): string | undefined {
  const reading = readWeather(enc.weather);
  return reading && `${reading.label} — ${reading.effect}`;
}

export class PreCombatScreen implements Screen {
  private el: HTMLElement | null = null;
  private deck: string[];
  private readonly base: string[];
  private tooltip: Tooltip | null = null;

  constructor(private readonly opts: PreCombatOpts) {
    this.base = [...opts.deck];
    this.deck = [...opts.deck];
  }

  mount(root: HTMLElement): void {
    const enc = this.opts.encounter;
    const companion = companionById(this.opts.companionId);

    const el = document.createElement('div');
    el.className = 'screen screen--precombat';
    el.innerHTML = `
      <div class="builder__head">
        <div>
          <div class="builder__title">${enc.name}</div>
          <div class="builder__sub">${companion?.name ?? 'Companion'} · ${enc.width}×${enc.height} · ${describeArena(enc)}</div>
          ${describeWeather(enc) ? `<div class="pre__weather">${describeWeather(enc)}</div>` : ''}
        </div>
        <div class="builder__actions">
          <button class="pre__reset">Undo changes</button>
          <button class="builder__cancel">Back</button>
          <button class="builder__confirm pre__ready">Ready</button>
        </div>
      </div>

      <div class="builder__body">
        <div class="builder__pane pre__pane--map">
          <div class="builder__pane-title">The ground</div>
          <div class="pre__map"></div>
          <div class="pre__legend">
            <span><i class="pre__key pre__key--you"></i>Yours</span>
            <span><i class="pre__key pre__key--foe"></i>Theirs</span>
            <span><i class="pre__key pre__key--wall"></i>Wall</span>
            <span><i class="pre__key pre__key--cover"></i>Cover</span>
          </div>
        </div>
        <div class="builder__pane">
          <div class="builder__pane-title">Your collection</div>
          <div class="builder__collection"></div>
        </div>
        <div class="builder__pane builder__pane--deck">
          <div class="builder__pane-title">
            Deck <span class="builder__count"></span>
          </div>
          <div class="builder__deck"></div>
          <div class="builder__problems"></div>
        </div>
      </div>
    `;

    el.querySelector('.builder__cancel')!.addEventListener('click', () => this.opts.onBack());
    el.querySelector('.pre__ready')!.addEventListener('click', () => this.ready());
    el.querySelector('.pre__reset')!.addEventListener('click', () => {
      this.deck = [...this.base];
      this.render();
    });

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.renderMap();
    this.render();
  }

  // ------------------------------------------------------------------ the arena

  /**
   * A flat plan of the board — not the isometric view.
   *
   * Read from directly overhead, distances are honest and the shape is obvious at a
   * glance, which is the entire question being asked here.
   */
  private renderMap(): void {
    const host = this.el?.querySelector('.pre__map');
    if (!host) return;
    const enc = this.opts.encounter;
    const depth = territoryDepthFor(enc.height);

    const terrain = new Map<string, 'wall' | 'cover'>();
    for (const t of enc.terrain ?? []) terrain.set(`${t.at.x},${t.at.y}`, t.kind);
    const foes = new Set((enc.enemyOpeningBoard ?? []).map(([, x, y]) => `${x},${y}`));

    const cells: string[] = [];
    for (let y = 0; y < enc.height; y++) {
      for (let x = 0; x < enc.width; x++) {
        const key = `${x},${y}`;
        const zone =
          y >= enc.height - depth ? ' is-you' : y <= depth - 1 ? ' is-foe' : '';
        const kind = terrain.get(key);
        const feature = kind ? ` is-${kind}` : '';
        const occupant = foes.has(key) ? '<i class="pre__foe"></i>' : '';
        cells.push(`<div class="pre__cell${zone}${feature}">${occupant}</div>`);
      }
    }

    (host as HTMLElement).style.setProperty('--cols', String(enc.width));
    host.innerHTML = cells.join('');
  }

  // ------------------------------------------------------------------ the deck

  private render(): void {
    this.renderCollection();
    this.renderDeck();
    this.renderStatus();
  }

  private renderCollection(): void {
    const host = this.el?.querySelector('.builder__collection');
    if (!host) return;

    const owned = Object.keys(this.opts.collection.owned)
      .filter((id) => (this.opts.collection.owned[id] ?? 0) > 0 && CARDS[id])
      .map((id) => CARDS[id]!)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

    host.innerHTML = '';
    for (const def of owned) {
      const inDeck = this.deck.filter((c) => baseIdOf(c) === def.id).length;
      const canAdd =
        remainingCopies(this.deck, def.id, this.opts.collection) > 0 && this.swapsLeft() > 0;
      host.appendChild(this.cardRow(def, inDeck, canAdd, () => this.add(def.id)));
    }
  }

  private renderDeck(): void {
    const host = this.el?.querySelector('.builder__deck');
    if (!host) return;

    const counts = new Map<string, number>();
    for (const id of this.deck) counts.set(id, (counts.get(id) ?? 0) + 1);

    host.innerHTML = '';
    const rows = [...counts.entries()]
      .map(([id, n]) => ({ def: CARDS[id], id, n }))
      .sort((a, b) => (a.def?.cost ?? 0) - (b.def?.cost ?? 0));

    for (const { def, n } of rows) {
      if (!def) continue;
      host.appendChild(this.cardRow(def, n, true, () => this.remove(def.id), true));
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
    const row = document.createElement('button');
    row.className = `deckrow deckrow--${def.kind}`;
    row.style.setProperty('--school', colors.main);
    row.disabled = !enabled;
    // Reach matters more here than anywhere else: it is half of what a shape rewards.
    const reach = def.range === undefined ? '' : ` · range ${def.range}`;
    row.dataset.tip = `${def.name}|${def.text}|${def.source === 'companion' ? 'Companion' : 'Hero'}${reach}`;
    row.innerHTML = `
      <span class="deckrow__cost">${def.cost}</span>
      <span class="deckrow__name">${def.name}</span>
      <span class="deckrow__kind">${def.range === undefined ? def.kind : `${def.kind} ${def.range}`}</span>
      <span class="deckrow__n">${count > 0 ? `${count}×` : ''}</span>
      <span class="deckrow__op">${isDeckSide ? '−' : '+'}</span>
    `;
    row.addEventListener('click', onClick);
    return row;
  }

  private renderStatus(): void {
    const countEl = this.el?.querySelector('.builder__count');
    const problemsEl = this.el?.querySelector('.builder__problems');
    const ready = this.el?.querySelector<HTMLButtonElement>('.pre__ready');
    if (!countEl || !problemsEl || !ready) return;

    const used = swapCount(this.base, this.deck);
    countEl.textContent = `${this.deck.length} cards · ${used}/${MAX_SWAPS} swaps`;
    countEl.classList.toggle('is-bad', used > MAX_SWAPS);

    const problems = validateDeck(this.deck, this.opts.collection);
    const overBudget = used > MAX_SWAPS;
    ready.disabled = problems.length > 0 || overBudget;

    const messages = problems.map((p) => p.message);
    if (overBudget) messages.push(`Only ${MAX_SWAPS} cards may be swapped before a fight.`);

    problemsEl.innerHTML = messages.length
      ? messages.map((m) => `<div class="builder__problem">${m}</div>`).join('')
      : `<div class="builder__ok">${used === 0 ? 'Fighting with your deck as built.' : `${used} swapped — ready to fight.`}</div>`;
  }

  private swapsLeft(): number {
    return MAX_SWAPS - swapCount(this.base, this.deck);
  }

  // ------------------------------------------------------------------ mutation

  private add(cardId: string): void {
    if (remainingCopies(this.deck, cardId, this.opts.collection) <= 0) return;
    const next = [...this.deck, cardId];
    // Never let a click take the deck past the budget: refusing up front reads better
    // than allowing it and then disabling the button that ends the screen.
    if (swapCount(this.base, next) > MAX_SWAPS) return;
    this.deck = next;
    this.render();
  }

  private remove(cardId: string): void {
    const i = this.deck.lastIndexOf(cardId);
    if (i < 0) return;
    const next = [...this.deck];
    next.splice(i, 1);
    if (swapCount(this.base, next) > MAX_SWAPS) return;
    this.deck = next;
    this.render();
  }

  private ready(): void {
    if (validateDeck(this.deck, this.opts.collection).length > 0) return;
    if (swapCount(this.base, this.deck) > MAX_SWAPS) return;

    // The seed is generated here, at the last moment before the fight is fixed, and
    // handed onward so the same battle can be replayed or reported later.
    const seed = Math.floor(Math.random() * 1e9);
    this.opts.onReady([...this.deck], seed);
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
