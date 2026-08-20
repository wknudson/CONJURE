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
 * cost before deciding whether the purse goes on a tonic or a Schematic.
 */

import type { Screen } from './ScreenManager.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { Bounty } from '../core/data/bounties.js';
import { INVENTORY_LIMIT, isCritical } from '../core/overworld/state.js';
import { useConsumable } from '../core/overworld/run.js';
import { ascendableFor } from '../core/data/collection.js';
import { schematicsFor } from '../core/data/artificer.js';
import { companionById } from '../core/data/companions.js';
import { validateDeck } from '../core/data/deckRules.js';
import { encounterById } from '../core/data/encounters/index.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface SafehouseOpts {
  global: GlobalGameState;
  companionId: string;
  /** The active Companion's level, for the Vivarium door's status line. */
  companionLevel: number;
  /** The three contracts currently pinned to the board. */
  bounties: Bounty[];
  collection: Collection;
  /** The deck the Field Journal would open on, for the summary line. */
  deck: string[];
  /**
   * A one-off announcement to put in front of the room — a death, so far.
   *
   * Passed in rather than derived from the run, because it is news about a transition
   * and the hub is re-entered every time a shop door closes. The caller consumes it.
   */
  notice?: { title: string; body: string };
  onApothecary: () => void;
  onArtificer: () => void;
  onJournal: () => void;
  onVivarium: () => void;
  onBounty: (bounty: Bounty) => void;
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

      <div class="bounty-board">
        <div class="bounty-board__head">
          <span class="bounty-board__title">The Bounty Board</span>
          <span class="bounty-board__note">
            Nailed paper over older nailed paper. Take one and the rest are gone by morning.
          </span>
        </div>
        <div class="bounty-board__list"></div>
      </div>
    `;

    if (this.opts.notice) el.appendChild(this.buildNotice(this.opts.notice));

    el.querySelector('.safehouse__leave')!.addEventListener('click', () => this.opts.onLeave());

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.renderLedger();
    this.renderZones();
    this.renderBounties();
  }

  /**
   * The death notice: a magistracy seal over the whole room until it is acknowledged.
   *
   * Modal on purpose. A player who lost a run to a fight they thought they could win
   * should have to look at the bill before the shelves are in front of them again.
   */
  private buildNotice(notice: { title: string; body: string }): HTMLElement {
    const veil = document.createElement('div');
    veil.className = 'hub-notice';
    veil.innerHTML = `
      <div class="hub-notice__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="hub-notice__seal"></div>
        <div class="hub-notice__title">${notice.title}</div>
        <div class="hub-notice__body">${notice.body}</div>
        <button class="brass-btn hub-notice__ack">Begin again</button>
      </div>
    `;
    veil.querySelector('.hub-notice__ack')!.addEventListener('click', () => veil.remove());
    return veil;
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
    const critical = isCritical(this.opts.global.overworld);

    host.innerHTML = `
      <div class="ledger__pact">
        <div class="ledger__label">The Pact</div>
        <div class="ledger__gauge"><i style="width:${pactPct}%"></i></div>
        <div class="ledger__value${critical ? ' is-critical' : ''}">${pact.currentHp} / ${pact.maxHp}</div>
        ${critical ? '<div class="ledger__critical">Critical — heal before taking work</div>' : ''}
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
    const { global, collection, deck } = this.opts;

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
        blurb: 'Belt-driven, and far too warm. A card goes in known and comes out mastered.',
        status: () => {
          const raise = ascendableFor(collection).length;
          const cut = schematicsFor(collection).length;
          if (raise > 0) return `${raise} ready to ascend · ${cut} schematics`;
          return cut === 0 ? 'Nothing on the bench' : `${cut} schematics on file`;
        },
        onOpen: this.opts.onArtificer,
      },
      {
        key: 'vivarium',
        name: 'The Vivarium',
        trade: 'Companions',
        blurb: 'Glass, condensation, and something breathing behind it. It knows your step.',
        status: () => {
          const name = companionById(this.opts.companionId)?.name ?? 'Nobody';
          return `${name} · Level ${this.opts.companionLevel}`;
        },
        onOpen: this.opts.onVivarium,
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
    ];
  }

  // ------------------------------------------------------------------ the board

  /**
   * Three contracts, one per tier, so the board is always a question about risk.
   *
   * Nothing here refuses a wounded player. Taking a Master contract at 2 health is a
   * terrible idea and remains theirs to make — the ledger says Critical in red, which is
   * the game's job; deciding is the player's.
   */
  private renderBounties(): void {
    const host = this.el?.querySelector('.bounty-board__list');
    if (!host) return;
    host.innerHTML = '';

    const critical = isCritical(this.opts.global.overworld);

    for (const bounty of this.opts.bounties) {
      const card = document.createElement('button');
      // The audit gets its own face rather than borrowing a tier's: it is posted by the
      // same office and paid from a different ledger, and a player should be able to tell
      // at a glance which of the two they are taking.
      card.className = `bounty-card brass-panel bounty-card--${bounty.difficulty}${
        bounty.audit ? ' bounty-card--audit' : ''
      }`;
      const encounter = encounterById(bounty.enemySeed);

      card.innerHTML = `
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        ${bounty.audit ? '<span class="bounty-seal">Audit</span>' : ''}
        <div class="bounty-card__tier">${bounty.audit ? 'audit' : bounty.difficulty}</div>
        <div class="bounty-card__title">${bounty.title}</div>
        <div class="bounty-card__where">${
          encounter ? `${encounter.name} · ${encounter.width}×${encounter.height}` : 'Location unknown'
        }</div>
        <div class="bounty-card__flavour">${bounty.flavour}</div>
        <div class="bounty-card__pay">
          <span class="bounty-card__coin bounty-card__coin--gold">${bounty.spoils.ducats ?? 0} d</span>
          ${
            bounty.spoils.marrowShards
              ? `<span class="bounty-card__coin bounty-card__coin--marrow">${bounty.spoils.marrowShards} shards</span>`
              : ''
          }
          ${
            bounty.spoils.reagents
              ? `<span class="bounty-card__coin bounty-card__coin--reagent">${Object.values(
                  bounty.spoils.reagents,
                ).reduce((a, b) => a + b, 0)} cores</span>`
              : ''
          }
          ${critical ? '<span class="bounty-card__warn">at critical health</span>' : ''}
        </div>
      `;
      card.addEventListener('click', () => this.opts.onBounty(bounty));
      host.appendChild(card);
    }
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
