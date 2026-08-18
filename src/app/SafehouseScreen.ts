/**
 * The Safehouse: everything that happens between fights.
 *
 * A gaslit room above a workshop, four doors off it. The screen itself is a router with a
 * ledger nailed to the wall — it owns no progression logic of its own, because the run
 * already lives in `GlobalGameState`, and a hub keeping its own copy would be a second
 * source of truth for the same numbers.
 *
 * The ledger is the point of the room. The Gauntlet does not heal you between encounters,
 * so the Pact gauge here is the only place a player sees what the last fight actually
 * cost before deciding whether the purse goes on a tonic or a blueprint.
 */

import type { Screen } from './ScreenManager.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import { INVENTORY_LIMIT, isRunOver } from '../core/overworld/state.js';
import { useConsumable } from '../core/overworld/run.js';
import { blueprintsFor } from '../core/data/artificer.js';
import { companionById } from '../core/data/companions.js';
import { validateDeck } from '../core/data/deckRules.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface SafehouseOpts {
  global: GlobalGameState;
  companionId: string;
  /** The contract currently pinned to the Bounty Board. */
  posted: EncounterDef;
  collection: Collection;
  /** The deck the Field Journal would open on, for the summary line. */
  deck: string[];
  onApothecary: () => void;
  onArtificer: () => void;
  onJournal: () => void;
  onBounty: (encounter: EncounterDef) => void;
  /** Called after the run is mutated here — drinking something — so it reaches disk. */
  onChange?: () => void;
  /** Out the front door, back to the title. */
  onLeave: () => void;
}

interface Zone {
  key: string;
  name: string;
  trade: string;
  blurb: string;
  /** The one line of live state that makes the door worth opening. */
  status: () => string;
  disabled?: () => boolean;
  onOpen: () => void;
}

export class SafehouseScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;

  constructor(private readonly opts: SafehouseOpts) {}

  mount(root: HTMLElement): void {
    const companion = companionById(this.opts.companionId);
    const colors = schoolOf((companion?.school ?? 'neutral') as never);

    const el = document.createElement('div');
    el.className = 'screen screen--safehouse';
    el.style.setProperty('--school', colors.main);
    el.innerHTML = `
      <div class="safehouse__head">
        <div>
          <div class="safehouse__title">The Safehouse</div>
          <div class="safehouse__sub">Between contracts · ${companion?.name ?? 'Companion'}</div>
        </div>
        <button class="brass-btn safehouse__leave">Leave the Safehouse</button>
      </div>

      <div class="hub-ledger brass-panel"></div>
      <div class="hub-menu"></div>
    `;

    el.querySelector('.safehouse__leave')!.addEventListener('click', () => this.opts.onLeave());

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.renderLedger();
    this.renderZones();
  }

  // ------------------------------------------------------------------ ledger

  /**
   * What the run is carrying. Read straight off `OverworldState` on every render, so a
   * purchase made in the Apothecary is already true when the hub comes back.
   */
  private renderLedger(): void {
    const host = this.el?.querySelector('.hub-ledger');
    if (!host) return;
    const { pact, economy, inventory, activeBuff } = this.opts.global.overworld;

    const pactPct = Math.max(0, Math.min(100, (pact.currentHp / pact.maxHp) * 100));
    const spent = isRunOver(this.opts.global.overworld);

    host.innerHTML = `
      <div class="ledger__pact">
        <div class="ledger__label">The Pact</div>
        <div class="ledger__gauge"><i style="width:${pactPct}%"></i></div>
        <div class="ledger__value${spent ? ' is-spent' : ''}">${pact.currentHp} / ${pact.maxHp}</div>
      </div>
      <div class="ledger__coins">
        <div class="ledger__stat">
          <span class="ledger__label">Ducats</span>
          <span class="ledger__value ledger__value--gold">${economy.ducats}</span>
        </div>
        <div class="ledger__stat">
          <span class="ledger__label">Marrow Shards</span>
          <span class="ledger__value ledger__value--marrow">${economy.marrowShards}</span>
        </div>
        <div class="ledger__stat">
          <span class="ledger__label">Satchel ${inventory.length}/${INVENTORY_LIMIT}</span>
          <span class="ledger__satchel"></span>
        </div>
        <div class="ledger__stat">
          <span class="ledger__label">Brew held</span>
          <span class="ledger__held">${activeBuff ?? 'none'}</span>
        </div>
      </div>
    `;
    this.renderSatchel();
  }

  /**
   * The satchel, and the only place anything in it can be drunk.
   *
   * Here rather than in the Apothecary because this is the room you are standing in when
   * you decide what to take into the next fight — and because items are barred once the
   * fight starts, this is in fact the *last* place the decision can be made.
   */
  private renderSatchel(): void {
    const host = this.el?.querySelector('.ledger__satchel');
    if (!host) return;
    const { overworld } = this.opts.global;
    host.innerHTML = '';

    if (overworld.inventory.length === 0) {
      host.innerHTML = '<span class="ledger__held">empty</span>';
      return;
    }

    overworld.inventory.forEach((item, index) => {
      // A tonic drunk at full health is simply gone. Refusing the click is kinder than
      // charging for nothing, and the label says which of the two it is.
      const wasted =
        item.type === 'healing' && overworld.pact.currentHp >= overworld.pact.maxHp;

      const chip = document.createElement('button');
      chip.className = 'ledger__item';
      chip.disabled = wasted;
      chip.textContent = item.name;
      chip.dataset.tip = wasted
        ? `${item.name}|Already at full health.|Satchel`
        : `${item.name}|Click to use.|Satchel`;
      chip.addEventListener('click', () => {
        if (!useConsumable(this.opts.global, index)) return;
        this.opts.onChange?.();
        this.renderLedger();
        this.renderZones();
      });
      host.appendChild(chip);
    });
  }

  // ------------------------------------------------------------------- doors

  private zones(): Zone[] {
    const { global, collection, deck, posted } = this.opts;
    const over = () => isRunOver(global.overworld);

    return [
      {
        key: 'apothecary',
        name: 'The Apothecary',
        trade: 'Tonics & Tailoring',
        blurb: 'A counter of green glass and ledger-ink. Whatever keeps a body walking.',
        status: () => {
          const { inventory } = global.overworld;
          return inventory.length >= INVENTORY_LIMIT
            ? 'Satchel full — nothing more will fit'
            : `Room for ${INVENTORY_LIMIT - inventory.length} more`;
        },
        onOpen: this.opts.onApothecary,
      },
      {
        key: 'artificer',
        name: 'The Ironworks Artificer',
        trade: 'Forging & Splicing',
        blurb: 'Belt-driven, and far too warm. Cards go in flat and come out as other cards.',
        status: () => {
          const n = blueprintsFor(collection).length;
          return n === 0 ? 'Nothing left unforged' : `${n} blueprint${n === 1 ? '' : 's'} unforged`;
        },
        onOpen: this.opts.onArtificer,
      },
      {
        key: 'journal',
        name: 'The Field Journal',
        trade: 'Deck & Record',
        blurb: 'Every fight you have had, in a hand that got worse as it went.',
        status: () => {
          const problems = validateDeck(deck, collection);
          return problems.length > 0
            ? `${deck.length} cards — needs editing`
            : `${deck.length} cards — legal`;
        },
        onOpen: this.opts.onJournal,
      },
      {
        key: 'bounty',
        name: 'The Bounty Board',
        trade: 'Contracts',
        blurb: 'Nailed paper over older nailed paper. Somebody wants somebody stopped.',
        status: () =>
          over()
            ? 'The Pact is broken — no one will hire you'
            : `${posted.name} · ${posted.width}×${posted.height}`,
        disabled: over,
        onOpen: () => this.opts.onBounty(posted),
      },
    ];
  }

  private renderZones(): void {
    const host = this.el?.querySelector('.hub-menu');
    if (!host) return;
    host.innerHTML = '';

    for (const zone of this.zones()) {
      const disabled = zone.disabled?.() ?? false;
      const btn = document.createElement('button');
      btn.className = `hub-zone brass-panel hub-zone--${zone.key}`;
      btn.disabled = disabled;
      btn.innerHTML = `
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="hub-zone__sigil"></div>
        <div class="hub-zone__name">${zone.name}</div>
        <div class="hub-zone__trade">${zone.trade}</div>
        <div class="hub-zone__blurb">${zone.blurb}</div>
        <div class="hub-zone__status">${zone.status()}</div>
      `;
      if (!disabled) btn.addEventListener('click', zone.onOpen);
      host.appendChild(btn);
    }
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
