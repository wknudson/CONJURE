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
import type { School } from '../contract/ids.js';
import { cardFaceHtml, faceOfDef } from '../hud/cardFace.js';
import { filterBarHtml, matchesPips, pipPills, wireFilterBar } from '../hud/filterBar.js';

/**
 * Every capability a loadout can grant, in the player's words.
 *
 * A list rather than a formatter over the raw keys: `bonusTitheMarrow` is a field
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
  { key: 'bonusTitheMarrow', label: 'Marrow per offering' },
  { key: 'healOnTithe', label: 'Health per offering' },
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
import type { CardModifier } from '../core/types/cards.js';
import {
  DEFAULT_ROSTER,
  ROSTER_BUDGET,
  rosterCost,
  rosterPointsOf,
  rosterPool,
  validateRoster,
} from '../core/data/roster.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface DeckBuilderResult {
  companionId: string;
  cards: string[];
  /**
   * The Vanguard, as def ids.
   *
   * Rides back with the deck because the two are saved together and the screen edits both.
   * A character owns one warband across every Companion, so unlike `cards` this is not
   * keyed by `companionId`.
   */
  roster: string[];
}

/**
 * `loadout` is the Hero sheet. The key kept its old name deliberately: it is written into
 * nothing persistent, but renaming it would churn every selector and stylesheet rule for
 * a label the player never sees.
 */
/**
 * How the collection is being looked at.
 *
 * Screen state, saved nowhere: a filter is a way of looking at the shelf rather than a
 * fact about the character.
 *
 * There is deliberately no `skill` type. The engine's `kind` union is minion, spell, rune
 * and obstacle — a fifth pill matching nothing would be a filter that always returns an
 * empty shelf, which reads as a broken collection rather than as a category the game does
 * not have. "Construct" is the label for `obstacle`, because that is what the game has
 * always called the thing standing on the board.
 */
interface CollectionFilters {
  school: School | 'all';
  cost: string;
  kind: 'all' | CardDef['kind'];
}

const VARIANT_PILLS: { key: 'all' | CardDef['kind']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'spell', label: 'Spell' },
  { key: 'minion', label: 'Minion' },
  { key: 'obstacle', label: 'Construct' },
  { key: 'rune', label: 'Rune' },
];

type Tab = 'deck' | 'ledger' | 'loadout' | 'vanguard';

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
  /** The warband being assembled. Committed with the deck, on Save. */
  private roster: string[];
  private tooltip: Tooltip | null = null;
  private tab: Tab = 'deck';

  /** How the case is being looked at. Screen state; written to nothing. */
  private filters: CollectionFilters = { school: 'all', cost: 'all', kind: 'all' };

  constructor(
    private readonly companionId: string,
    startingDeck: string[],
    startingRoster: string[],
    /**
     * What the *equipped beast's* Grimoire rolled.
     *
     * Passed in rather than looked up, because the screen is handed a species id and the
     * rolls belong to one animal of that species — two Ignis on the roster have different
     * ones, and only the caller knows which is standing beside the player.
     */
    private readonly spellModifiers: Record<string, CardModifier>,
    private readonly collection: Collection,
    private readonly bestiary: Bestiary,
    private readonly global: GlobalGameState,
    private readonly onLoadoutChange: () => void,
    private readonly onDone: (result: DeckBuilderResult) => void,
    private readonly onCancel: () => void,
  ) {
    this.deck = [...startingDeck];
    this.roster = [...startingRoster];
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
        <button class="journal-tab" data-tab="vanguard">The Vanguard</button>
      </div>

      <div class="builder__body">
        <div class="builder__pane builder__pane--deck">
          <div class="builder__pane-title">
            <span class="builder__pane-name">The Hero Deck</span>
            <span class="builder__count"></span>
          </div>
          <div class="builder__pane-note">
            Five to fifteen, neutral and arcane only. Click a card to strike it out.
          </div>
          <div class="builder__curve"></div>
          <div class="builder__deck"></div>
          <div class="builder__problems"></div>

          <div class="grimoire">
            <div class="grimoire__head">
              <span class="grimoire__title">The Pact Grimoire</span>
              <span class="grimoire__count"></span>
            </div>
            <div class="grimoire__note"></div>
            <div class="grimoire__list"></div>
          </div>
        </div>

        <div class="builder__pane builder__pane--case">
          <div class="builder__pane-title">
            <span class="builder__pane-name">The Case</span>
            <span class="builder__collection-count"></span>
          </div>
          <div class="builder__filters filterbar"></div>
          <div class="builder__collection"></div>
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

      <div class="vanguard">
        <div class="vanguard__head">
          <span class="vanguard__title">Vanguard Assembly</span>
          <span class="vanguard__note">
            Bought once, before the contract. These bodies cost no Pips in the fight —
            you deploy them onto Anchor Tiles before the first turn.
          </span>
          <div class="vanguard__budget">
            <span class="vanguard__budget-count"></span>
            <span class="vanguard__budget-bar"><i></i></span>
          </div>
        </div>
        <div class="vanguard__warband-title">The warband</div>
        <div class="vanguard__warband"></div>
        <div class="vanguard__problems"></div>
        <div class="vanguard__pool-title">The muster roll</div>
        <div class="vanguard__pool"></div>
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
      // Resets whichever list the player is actually looking at. A Reset on the Vanguard
      // tab that silently rebuilt the deck would be the worst kind of surprise.
      if (this.tab === 'vanguard') this.roster = [...DEFAULT_ROSTER];
      else this.deck = [...(companion?.deck ?? [])];
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
      el.classList.toggle('is-vanguard', this.tab === 'vanguard');
    }

    this.renderVanguard();

    this.renderLedger();
    this.renderLoadout();
    this.renderBoons();
    this.renderFilters();
    this.renderCollection();
    this.renderDeck();
    this.renderCurve();
    this.renderStatus();
    this.renderGrimoire();
  }

  /**
   * The collection, as a grid of cards.
   *
   * Every card the player owns, whatever the filters, is still *owned* — a filter narrows
   * what is shown and never what is held. A card already at its copy limit stays on the
   * shelf, marked and unclickable, because a shelf that hides what you have maxed out
   * makes a player think they lost it.
   */
  private renderCollection(): void {
    const host = this.el?.querySelector('.builder__collection');
    const count = this.el?.querySelector('.builder__collection-count');
    if (!host) return;

    const f = this.filters;
    const owned = Object.keys(this.collection.owned)
      .filter((id) => (this.collection.owned[id] ?? 0) > 0 && CARDS[id])
      .map((id) => CARDS[id]!)
      .filter((d) => f.school === 'all' || d.school === f.school)
      .filter((d) => f.kind === 'all' || d.kind === f.kind)
      .filter((d) => matchesPips(d.cost.pips, f.cost))
      .sort(
        (a, b) => cardCostTotal(a.cost) - cardCostTotal(b.cost) || a.name.localeCompare(b.name),
      );

    if (count) {
      count.textContent = owned.length
        ? `${owned.length} card${owned.length === 1 ? '' : 's'}`
        : '';
    }

    host.innerHTML = '';
    if (owned.length === 0) {
      host.innerHTML = '<div class="builder__empty">Nothing in the case matches that.</div>';
      return;
    }

    for (const def of owned) {
      const inDeck = this.deck.filter((c) => baseIdOf(c) === def.id).length;
      const room = remainingCopies(this.deck, def.id, this.collection);
      host.appendChild(this.collectionCell(def, inDeck, room > 0));
    }
  }

  /** One card in the case: the face, how many are in the deck, and the copy ceiling. */
  private collectionCell(def: CardDef, inDeck: number, canAdd: boolean): HTMLElement {
    const tier = tierOf(def);
    const cell = document.createElement('button');
    cell.className = `collcell${canAdd ? '' : ' is-full'}${inDeck > 0 ? ' is-in-deck' : ''}`;
    cell.disabled = !canAdd;
    cell.dataset.tip = `${def.name}|${def.text}|Tier ${tier} · max ${TIER_COPY_LIMIT[tier]} per deck`;
    cell.innerHTML = `
      ${cardFaceHtml(faceOfDef(def), { extraClass: 'card--mini', showReach: true })}
      <span class="collcell__tally">${inDeck}/${TIER_COPY_LIMIT[tier]}</span>
    `;
    cell.addEventListener('click', () => this.add(def.id));
    return cell;
  }

  /** The filter header over the case. Rebuilt whole, so a marked pill is never stale. */
  private renderFilters(): void {
    const bar = this.el?.querySelector<HTMLElement>('.builder__filters');
    if (!bar) return;

    // Schools are read off what the player actually owns, so a pill can never point at an
    // empty shelf and a card can never be hidden by an omitted school.
    const schools = [
      ...new Set(
        Object.keys(this.collection.owned)
          .filter((id) => (this.collection.owned[id] ?? 0) > 0 && CARDS[id])
          .map((id) => CARDS[id]!.school),
      ),
    ].sort();

    bar.innerHTML = filterBarHtml([
      {
        name: 'school',
        label: 'Element',
        active: String(this.filters.school),
        pills: [
          { key: 'all', label: 'All' },
          ...schools.map((s) => ({
            key: s,
            label: s[0]!.toUpperCase() + s.slice(1),
            tint: schoolOf(s).main,
          })),
        ],
      },
      { name: 'cost', label: 'Pips', active: this.filters.cost, pills: pipPills() },
      {
        name: 'kind',
        label: 'Variant',
        active: this.filters.kind,
        pills: VARIANT_PILLS.map((v) => ({ key: v.key, label: v.label })),
      },
    ]);

    wireFilterBar(bar, (name, value) => {
      (this.filters[name as keyof CollectionFilters] as unknown) = value;
      this.render();
    });
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

  /**
   * The Pact Grimoire: the eight your Companion fuses in, and what they rolled.
   *
   * Beside the Hero Deck rather than inside it, because it is not editable and showing it
   * as a list you can click would be promising otherwise. What it *is* for is the second
   * half of the same question — a player deciding whether nine utility cards is enough
   * needs to see the eight that arrive with them.
   *
   * The rolls are the reason this panel exists at all. Two Boreas bring the same eight
   * spells; what makes one worth keeping is the green -1 on a Glacial Spike, and there is
   * nowhere else in the game that fact is visible.
   */
  private renderGrimoire(): void {
    const el = this.el;
    if (!el) return;

    const companion = companionById(this.companionId);
    const grimoire = companion?.innateGrimoire ?? [];
    const mods = this.spellModifiers;

    const count = el.querySelector<HTMLElement>('.grimoire__count');
    if (count) count.textContent = `${grimoire.length} fixed`;

    const note = el.querySelector<HTMLElement>('.grimoire__note');
    if (note) {
      // Distinct *spells*, not copies. The list below is grouped, so counting cards here
      // would promise five highlighted rows and show three.
      const rolled = new Set(grimoire.filter((id) => mods[id])).size;
      note.textContent = rolled
        ? `${companion?.name ?? 'Your Companion'} fuses these in at the bell. ${rolled} of them rolled well.`
        : `${companion?.name ?? 'Your Companion'} fuses these in at the bell. This one rolled nothing — catch another.`;
    }

    const list = el.querySelector<HTMLElement>('.grimoire__list');
    if (!list) return;
    list.replaceChildren();

    // Grouped, because a Grimoire holding three Soul Splinters should read as "three of
    // this" rather than as three rows a player has to notice are identical.
    const seen = new Map<string, number>();
    for (const id of grimoire) seen.set(id, (seen.get(id) ?? 0) + 1);

    for (const [defId, copies] of seen) {
      const def = CARDS[defId];
      if (!def) continue;
      list.appendChild(this.grimoireRow(def, copies, mods[defId]));
    }
  }

  /** One Grimoire spell, with whatever it rolled worn on its face. */
  private grimoireRow(def: CardDef, copies: number, mod?: CardModifier): HTMLElement {
    const row = document.createElement('div');
    row.className = 'grimoire-row';
    row.classList.toggle('is-rolled', mod !== undefined);

    const badges: string[] = [];
    if (mod?.pipCostDelta) {
      const sign = mod.pipCostDelta > 0 ? '+' : '';
      badges.push(
        `<span class="grimoire-mod grimoire-mod--cost" data-tip="Cost roll|This copy costs ${Math.abs(mod.pipCostDelta)} Pip less than the printed card.">${sign}${mod.pipCostDelta} PIP</span>`,
      );
    }
    if (mod?.bonusDamage) {
      badges.push(
        `<span class="grimoire-mod grimoire-mod--dmg" data-tip="Damage roll|Every hit this card makes lands for ${mod.bonusDamage} more.">+${mod.bonusDamage} DMG</span>`,
      );
    }
    if (mod?.grantRetain) {
      badges.push(
        `<span class="grimoire-mod grimoire-mod--retain" data-tip="Retain roll|This copy stays in your hand at end of turn instead of being discarded.">RETAIN</span>`,
      );
    }

    const cost = def.xCost ? 'X' : formatCost(def.cost);
    row.innerHTML = `
      <span class="grimoire-row__cost">${cost}</span>
      <span class="grimoire-row__body">
        <span class="grimoire-row__name">${escapeHtml(def.name)}${copies > 1 ? ` <em>${copies}×</em>` : ''}</span>
        <span class="grimoire-row__school">${escapeHtml(def.school)}</span>
      </span>
      <span class="grimoire-row__mods">${badges.join('')}</span>
    `;
    return row;
  }

  private renderStatus(): void {
    const countEl = this.el?.querySelector('.builder__count');
    const problemsEl = this.el?.querySelector('.builder__problems');
    const confirm = this.el?.querySelector<HTMLButtonElement>('.builder__confirm');
    if (!countEl || !problemsEl || !confirm) return;

    countEl.textContent = `${this.deck.length} / ${MAX_DECK}`;
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

  // ------------------------------------------------------------------ the Vanguard

  /**
   * Vanguard Assembly: the point-buy, as two lists and a budget.
   *
   * The warband on top and the muster roll beneath, rather than a single toggling grid,
   * because the two answer different questions — "what am I taking" and "what could I
   * take" — and a player mid-decision wants both on screen at once.
   *
   * Every rule shown here comes from `validateRoster`. The screen never decides for itself
   * what is legal, so the button it greys out and the roster the engine accepts cannot
   * drift apart.
   */
  private renderVanguard(): void {
    const el = this.el;
    if (!el) return;

    const spent = rosterCost(this.roster);
    const problems = validateRoster(this.roster);

    const count = el.querySelector<HTMLElement>('.vanguard__budget-count');
    if (count) count.textContent = `Budget ${spent} / ${ROSTER_BUDGET}`;

    const bar = el.querySelector<HTMLElement>('.vanguard__budget-bar i');
    if (bar) {
      bar.style.width = `${Math.min(100, (spent / ROSTER_BUDGET) * 100)}%`;
      bar.classList.toggle('is-full', spent >= ROSTER_BUDGET);
    }

    // --- the warband
    const warband = el.querySelector<HTMLElement>('.vanguard__warband');
    if (warband) {
      warband.replaceChildren();
      if (this.roster.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vanguard__empty';
        empty.textContent =
          'No bodies. A fight with an empty Vanguard skips deployment entirely.';
        warband.appendChild(empty);
      }
      this.roster.forEach((defId, index) => {
        const def = CARDS[defId];
        if (!def) return;
        warband.appendChild(
          this.vanguardChip(def, 'remove', () => {
            this.roster.splice(index, 1);
            this.render();
          }),
        );
      });
    }

    // --- what is wrong with it, in the engine's own words
    const problemsEl = el.querySelector<HTMLElement>('.vanguard__problems');
    if (problemsEl) {
      problemsEl.replaceChildren();
      for (const p of problems) {
        const line = document.createElement('div');
        line.className = 'vanguard__problem';
        line.textContent = p.message;
        problemsEl.appendChild(line);
      }
    }

    // --- the muster roll
    const pool = el.querySelector<HTMLElement>('.vanguard__pool');
    if (!pool) return;
    pool.replaceChildren();
    for (const def of rosterPool()) {
      // Asked of the *candidate* roster rather than computed here: "would adding this be
      // legal" is one question with one answer, and it lives in `validateRoster`.
      const refusal = validateRoster([...this.roster, def.id])[0];
      pool.appendChild(
        this.vanguardChip(def, 'add', () => {
          this.roster.push(def.id);
          this.render();
        }, refusal?.message),
      );
    }
  }

  /** One body, in either list. `mode` decides whether clicking adds it or takes it away. */
  private vanguardChip(
    def: CardDef,
    mode: 'add' | 'remove',
    onClick: () => void,
    refusal?: string,
  ): HTMLElement {
    const unit = def.unit;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `vanguard-chip vanguard-chip--${mode}`;
    if (refusal) {
      chip.disabled = true;
      chip.classList.add('is-refused');
      chip.setAttribute('data-tip', `${def.name}|${refusal}`);
    } else {
      chip.addEventListener('click', onClick);
    }

    const reach = (unit?.rangeMax ?? 1) > 1 ? `Range ${unit?.rangeMax}` : 'Melee';
    const size = unit?.footprint === 2 ? ' · Behemoth' : '';
    chip.innerHTML = `
      <span class="vanguard-chip__points">${rosterPointsOf(def)}</span>
      <span class="vanguard-chip__body">
        <span class="vanguard-chip__name">${escapeHtml(def.name)}</span>
        <span class="vanguard-chip__stats">${unit?.atk ?? 0} ATK · ${unit?.hp ?? 0} HP · ${reach}${size}</span>
      </span>
      <span class="vanguard-chip__mark">${mode === 'add' ? '+' : '−'}</span>
    `;
    return chip;
  }

  private confirm(): void {
    if (validateDeck(this.deck, this.collection).length > 0) return;
    // An illegal warband is refused for the same reason an illegal deck is: it would be
    // written to the save and then rejected at the door.
    if (validateRoster(this.roster).length > 0) return;
    this.onDone({
      companionId: this.companionId,
      cards: [...this.deck],
      roster: [...this.roster],
    });
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
