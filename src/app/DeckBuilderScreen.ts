/**
 * The deck builder.
 *
 * Two columns: everything you own on the left, the deck you are building on the right.
 * The rules are enforced as affordances rather than as error messages — a card you
 * cannot add any more of is visibly spent before you click it — and the confirm button
 * explains precisely what is wrong when it refuses.
 */

import { cardCostTotal } from '../core/types/cards.js';
import { formatCost } from '../hud/cost.js';
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
import { ledgerFor, ledgerProgress } from '../core/data/bestiary.js';
import type { Bestiary, GlobalGameState } from '../core/overworld/state.js';
import { equipRefusal, equipRelic, unequipRelic } from '../core/overworld/state.js';
import {
  RELIC_SLOT_BLURBS,
  RELIC_SLOT_LABELS,
  boonsOfRelics,
  relicById,
  relicsForSlot,
  slotOf,
} from '../core/data/relics.js';
import type { CombatBoons } from '../core/engine/setup.js';

/**
 * Every capability a loadout can grant, in the player's words.
 *
 * A list rather than a formatter over the raw keys: `bonusSacrificeMarrow` is a field
 * name, and a sheet that prints field names is a debug view. Typed against `CombatBoons`,
 * so a new capability that nobody labels fails the build rather than quietly going
 * unreadable on the one screen built to read them.
 */
const BOON_LABELS: readonly { key: keyof CombatBoons; label: string }[] = [
  { key: 'armor', label: 'Persistent Armor' },
  { key: 'pips', label: 'Opening Pips' },
  { key: 'maxPips', label: 'Pip ceiling' },
  { key: 'extraOpeningCards', label: 'Opening cards' },
  { key: 'bonusHandLimit', label: 'Hand limit' },
  { key: 'bonusObstacleHp', label: 'Obstacle health' },
  { key: 'bonusSacrificeMarrow', label: 'Marrow per offering' },
  { key: 'healOnSacrifice', label: 'Health per offering' },
  { key: 'bonusToxinStacks', label: 'Toxin per application' },
  { key: 'collisionResist', label: 'Collision damage shrugged off' },
  { key: 'ignoreFog', label: 'Sees through fog' },
  { key: 'ignoreGuardians', label: 'Sees past Guardians' },
  { key: 'ignoreIceSlip', label: 'Keeps its footing on ice' },
  { key: 'immuneToBurn', label: 'Immune to Burn' },
  { key: 'immuneToToxin', label: 'Immune to Toxin' },
  { key: 'revealIntents', label: 'Reads enemy intent' },
  { key: 'boundFormIgnoresHazards', label: 'Bound Form ignores hazards' },
  { key: 'boundFormGrounded', label: 'Bound Form cannot be moved' },
  { key: 'doubleResonance', label: 'Resonance fires twice' },
  { key: 'discountHybrids', label: 'Spliced cards cost less' },
];
import { RELIC_SLOT_ORDER } from '../core/overworld/state.js';

export interface DeckBuilderResult {
  companionId: string;
  cards: string[];
}

/**
 * `loadout` is the Hero sheet. The key kept its old name deliberately: it is written into
 * nothing persistent, but renaming it would churn every selector and stylesheet rule for
 * a label the player never sees.
 */
type Tab = 'deck' | 'ledger' | 'loadout';

/** Every way the loadout can say no, in the player's words. */
const EQUIP_REFUSAL: Record<string, string> = {
  none: '',
  'in-combat': 'Not while a contract is open',
  'not-owned': 'You do not have that',
  'already-worn': 'Already worn',
  // `no-slot` is gone with the flat list: a relic names its own slot, so wearing one over
  // another swaps rather than refusing. This is the case that remains — gear the
  // catalogue no longer places anywhere.
  'unknown-slot': 'Nowhere to put that',
};

export class DeckBuilderScreen implements Screen {
  private el: HTMLElement | null = null;
  private deck: string[];
  private tooltip: Tooltip | null = null;
  private tab: Tab = 'deck';

  constructor(
    private readonly companionId: string,
    startingDeck: string[],
    private readonly collection: Collection,
    private readonly bestiary: Bestiary,
    private readonly global: GlobalGameState,
    private readonly onLoadoutChange: () => void,
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
          <div class="builder__title">The Field Journal</div>
          <div class="builder__sub">${companion?.name ?? 'Companion'} · ${companion?.school ?? ''}</div>
        </div>
        <div class="builder__actions">
          <button class="builder__reset">Reset to default</button>
          <button class="builder__cancel">Back</button>
          <button class="builder__confirm">Save deck</button>
        </div>
      </div>

      <div class="journal-tabs">
        <button class="journal-tab" data-tab="deck">The Deck</button>
        <button class="journal-tab" data-tab="ledger">The Threat Ledger</button>
        <button class="journal-tab" data-tab="loadout">Hero</button>
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

      <div class="loadout">
        <div class="loadout__head">
          <span class="loadout__title">The Commander</span>
          <span class="loadout__note">
            Five slots, one apiece. Gear here bends a rule — none of it will make anything
            hit harder.
          </span>
        </div>

        <div class="hero">
          <div class="hero__doll">
            <div class="hero__figure">
              <span class="hero__figure-head"></span>
              <span class="hero__figure-body"></span>
              <span class="hero__figure-name">Commander</span>
            </div>
          </div>
          <div class="hero__sheet">
            <div class="hero__sheet-title">In effect</div>
            <div class="hero__boons"></div>
          </div>
        </div>

        <div class="loadout__slots"></div>
        <div class="loadout__refusal"></div>
        <div class="loadout__shelf-title">In the footlocker</div>
        <div class="loadout__shelf"></div>
      </div>

      <div class="threat-ledger">
        <div class="threat-ledger__head">
          <span class="threat-ledger__title">The Threat Ledger</span>
          <span class="threat-ledger__progress"></span>
        </div>
        <div class="threat-ledger__grid"></div>
      </div>
    `;

    el.querySelector('.builder__cancel')!.addEventListener('click', () => this.onCancel());
    el.querySelector('.builder__confirm')!.addEventListener('click', () => this.confirm());
    el.querySelector('.builder__reset')!.addEventListener('click', () => {
      this.deck = [...(companion?.deck ?? [])];
      this.render();
    });

    for (const tab of el.querySelectorAll<HTMLElement>('.journal-tab')) {
      tab.addEventListener('click', () => {
        this.tab = (tab.dataset.tab as Tab) ?? 'deck';
        this.render();
      });
    }

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.render();
  }

  /**
   * Four slots and a footlocker.
   *
   * The slots are drawn whether or not anything is in them, because the shape of what you
   * could be wearing is the information: three worn and one bare is a decision you have
   * not made yet, and a grid that collapsed to what is equipped would hide it.
   */
  /**
   * What the loadout is actually doing, totalled.
   *
   * The slots each say what one relic does; this says what the *set* does, which is not
   * the same reading — three pieces that each add obstacle health add six, and nothing on
   * the individual cells says so. Folded through `boonsOfRelics`, the same function the
   * run uses to build a carry, so the sheet cannot claim a total the fight will not honour.
   */
  private renderBoons(): void {
    const host = this.el?.querySelector('.hero__boons');
    if (!host) return;

    const boons = boonsOfRelics(this.global.overworld.equippedRelics);
    const rows = BOON_LABELS.filter((b) => {
      const v = boons[b.key];
      return v !== undefined && v !== false && v !== 0;
    });

    if (rows.length === 0) {
      host.innerHTML = '<div class="hero__boons-empty">Nothing worn. The rules apply as written.</div>';
      return;
    }

    host.innerHTML = rows
      .map((b) => {
        const v = boons[b.key];
        const amount = typeof v === 'number' ? `+${v}` : 'yes';
        return `
          <div class="hero__boon">
            <span class="hero__boon-amount">${amount}</span>
            <span class="hero__boon-label">${b.label}</span>
          </div>`;
      })
      .join('');
  }

  private renderLoadout(): void {
    const slots = this.el?.querySelector('.loadout__slots');
    const shelf = this.el?.querySelector('.loadout__shelf');
    if (!slots || !shelf) return;

    const { relics, equippedRelics } = this.global.overworld;
    slots.innerHTML = '';
    shelf.innerHTML = '';

    for (const slot of RELIC_SLOT_ORDER) {
      const id = equippedRelics[slot];
      const relic = id ? relicById(id) : undefined;

      const cell = document.createElement('button');
      cell.className = `relic-slot relic-slot--${slot}${relic ? ' is-worn' : ' is-bare'}`;
      cell.innerHTML = relic
        ? `<span class="relic-slot__domain relic-slot__domain--${slot}"></span>
           <span class="relic-slot__label">${RELIC_SLOT_LABELS[slot]}</span>
           <span class="relic-slot__name">${relic.name}</span>
           <span class="relic-slot__text">${relic.text}</span>
           <span class="relic-slot__action">Take off</span>`
        : `<span class="relic-slot__domain relic-slot__domain--${slot}"></span>
           <span class="relic-slot__label">${RELIC_SLOT_LABELS[slot]}</span>
           <span class="relic-slot__empty">${RELIC_SLOT_BLURBS[slot]}</span>`;

      if (relic) {
        cell.addEventListener('click', () => {
          unequipRelic(this.global, relic.id);
          this.say('');
          this.onLoadoutChange();
          this.render();
        });
      }
      slots.appendChild(cell);
    }

    // The footlocker, grouped by slot rather than as one list. A flat shelf would make
    // the player work out for themselves which of their gear competes with which — which
    // is the entire question the slots exist to answer.
    let anything = false;

    for (const slot of RELIC_SLOT_ORDER) {
      const spare = relicsForSlot(slot).filter(
        (r) => relics.includes(r.id) && equippedRelics[slot] !== r.id,
      );
      if (spare.length === 0) continue;
      anything = true;

      const group = document.createElement('div');
      group.className = 'relic-group';
      group.innerHTML = `<div class="relic-group__head">${RELIC_SLOT_LABELS[slot]}</div>`;

      for (const relic of spare) {
        const row = document.createElement('button');
        row.className = 'relic-row';
        // Named on the button, because putting this on means taking that off and the
        // player should read which before they click rather than after.
        const worn = equippedRelics[slot];
        const action = worn ? `Swap for ${relicById(worn)?.name ?? 'the other'}` : 'Put on';
        row.innerHTML = `
          <span class="relic-slot__domain relic-slot__domain--${slot}"></span>
          <span class="relic-row__body">
            <span class="relic-slot__name">${relic.name}</span>
            <span class="relic-slot__text">${relic.text}</span>
          </span>
          <span class="relic-slot__action">${action}</span>
        `;
        row.addEventListener('click', () => {
          const refusal = equipRefusal(this.global, relic.id, slotOf(relic.id));
          // The state decides, not the button: a stale render must not be able to dress
          // the player in something they no longer own.
          if (!equipRelic(this.global, relic.id, slotOf(relic.id))) {
            this.say(EQUIP_REFUSAL[refusal ?? 'none'] ?? '');
            return;
          }
          this.say('');
          this.onLoadoutChange();
          this.render();
        });
        group.appendChild(row);
      }
      shelf.appendChild(group);
    }

    if (!anything) {
      shelf.innerHTML = '<span class="loadout__empty">Nothing else to your name.</span>';
    }
  }

  private say(message: string): void {
    const host = this.el?.querySelector('.loadout__refusal');
    if (host) host.textContent = message;
  }

  /**
   * Everything the player has faced, and what is known about it.
   *
   * The roster comes from the card registry rather than from the Ledger, so a creature
   * never met still occupies its place in the list as a blank — which is the point. An
   * entry you have not identified tells you there is something you have not met, and
   * where it sits among the things you have.
   */
  private renderLedger(): void {
    const host = this.el?.querySelector('.threat-ledger__grid');
    const progress = this.el?.querySelector('.threat-ledger__progress');
    if (!host || !progress) return;

    const { known, total } = ledgerProgress(this.bestiary);
    progress.textContent = `${known} of ${total} identified`;

    host.innerHTML = '';
    for (const entry of ledgerFor(this.bestiary)) {
      const { def, identified } = entry;
      const card = document.createElement('div');
      card.className = `threat${identified ? '' : ' threat--unknown'}`;

      if (!identified) {
        // Deliberately not the creature's name, its school, or even its silhouette shape:
        // the only thing an unidentified entry may leak is that it exists. A sighting is
        // shown, because "seen three, killed none" is a fact the player earned.
        card.innerHTML = `
          <div class="threat__plate"></div>
          <div class="threat__name">???</div>
          <div class="threat__meta">${
            entry.encountered > 0 ? `Seen ${entry.encountered} · never taken` : 'Unrecorded'
          }</div>
        `;
        host.appendChild(card);
        continue;
      }

      const unit = def.unit!;
      const colors = schoolOf(def.school as never);
      card.style.setProperty('--school', colors.main);
      card.dataset.tip = `${def.name}|${def.text}|${def.school}`;
      card.innerHTML = `
        <div class="threat__plate threat__plate--known"></div>
        <div class="threat__name">${def.name}</div>
        <div class="threat__school">${def.school}</div>
        <div class="threat__stats">
          <span>HP ${unit.hp}</span><span>ATK ${unit.atk}</span><span>MOV ${unit.mov}</span>
          <span>RNG ${unit.rangeMin}-${unit.rangeMax}</span>
        </div>
        <div class="threat__meta">Seen ${entry.encountered} · taken ${entry.defeated}</div>
      `;
      host.appendChild(card);
    }
  }

  // ------------------------------------------------------------------ rendering

  private render(): void {
    const el = this.el;
    if (el) {
      for (const tab of el.querySelectorAll<HTMLElement>('.journal-tab')) {
        tab.classList.toggle('is-active', tab.dataset.tab === this.tab);
      }
      el.classList.toggle('is-ledger', this.tab === 'ledger');
      el.classList.toggle('is-loadout', this.tab === 'loadout');
    }

    this.renderLedger();
    this.renderLoadout();
    this.renderBoons();
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
      .sort((a, b) => cardCostTotal(a.cost) - cardCostTotal(b.cost) || a.name.localeCompare(b.name));

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
      .sort((a, b) => (a.def ? cardCostTotal(a.def.cost) : 0) - (b.def ? cardCostTotal(b.def.cost) : 0));

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
      <span class="deckrow__cost">${formatCost(def.cost)}</span>
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
