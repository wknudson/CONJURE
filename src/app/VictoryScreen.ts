/**
 * Spoils of War.
 *
 * The moment a contract is settled, itemised. A win used to drop the player straight back
 * into the hub with three numbers quietly larger than before; this is the receipt.
 *
 * **The spoils are already banked by the time this mounts.** `resolveCombat` credits them
 * and the file is written before the screen is built, deliberately: the anti-save-scum
 * failsafe writes an open contract to disk *before* the board mounts, and a tab closed on
 * an unwritten victory screen would boot into a forfeit of the fight the player just won.
 * So the button below is a door, not a commit — it re-writes whatever the screen itself
 * changed (a claimed card) and leaves.
 */

import type { Screen } from './ScreenManager.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import type { CombatSpoils } from '../core/overworld/state.js';
import type { CombatResult } from '../contract/events.js';
import type { CompanionInstance } from '../core/overworld/vivarium.js';
import { CARDS } from '../core/data/cards/index.js';
import { companionById } from '../core/data/companions.js';
import { traitById } from '../core/data/companionTraits.js';
import { reagentById } from '../core/data/splicing.js';
import { formatCost } from '../hud/cost.js';
import { schoolOf } from '../render/palette.js';
import { SCHEMATIC_COST_DUCATS } from '../core/overworld/forge.js';

export interface VictoryOptions {
  result: CombatResult;
  encounter: EncounterDef;
  /** What the accepted contract paid. Already in the purse.  */
  spoils: CombatSpoils;
  /**
   * Schematics laid out to choose between, if this fight had any left to teach.
   *
   * Not cards. Claiming one puts a *plan* in the character's hands; the card itself still
   * costs Ducats at the Artificer. A fight the player has already wrung dry offers an
   * empty list and this section is not drawn at all.
   */
  offer: string[];
  /** The beast a subjugation added to the roster, if this was a binding. */
  tamed?: CompanionInstance | null;
  onClaim: (cardId: string) => void;
  onLeave: () => void;
}

/** A tally line, or nothing when the contract paid none of that kind. */
function line(label: string, value: string, kind: string): string {
  return `
    <div class="spoils__line spoils__line--${kind}">
      <span class="spoils__label">${label}</span>
      <span class="spoils__value">${value}</span>
    </div>
  `;
}

export class VictoryScreen implements Screen {
  private el: HTMLElement | null = null;
  private claimed = false;

  constructor(private readonly opts: VictoryOptions) {}

  mount(root: HTMLElement): void {
    const { spoils, result } = this.opts;
    const reagents = Object.entries(spoils.reagents ?? {}).filter(([, n]) => n > 0);

    const el = document.createElement('div');
    el.className = 'screen screen--victory';
    el.innerHTML = `
      <div class="victory__seal"></div>
      <div class="victory__stamp">Contract Fulfilled</div>
      <div class="victory__sub">
        ${this.opts.encounter.name}${result === 'bound' ? ' · the Rite took hold' : ''}
      </div>

      <div class="spoils brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="spoils__head">Spoils of War</div>
        ${line('Ducats', String(spoils.ducats ?? 0), 'gold')}
        ${line('Marrow Shards', String(spoils.marrowShards ?? 0), 'marrow')}
        ${
          reagents.length > 0
            ? reagents
                .map(([id, n]) =>
                  line(reagentById(id)?.name ?? id, `×${n}`, 'reagent'),
                )
                .join('')
            : line('Reagents', 'none', 'empty')
        }
      </div>

      ${this.bindingPanel()}
      <div class="victory__rewards"></div>
      <button class="brass-btn victory__leave">Back to the street</button>
    `;

    el.querySelector('.victory__leave')!.addEventListener('click', () => this.opts.onLeave());

    root.appendChild(el);
    this.el = el;
    this.renderRewards();
  }

  /**
   * The animal, when the Rite took hold.
   *
   * Its own panel rather than a line in the Spoils, because it is not a payout: the
   * ducats were promised by the contract, and this was taken off the board. It names the
   * roll — the constitution and the knack — since those are what make one bound Ignis a
   * different animal from the next.
   */
  private bindingPanel(): string {
    const tamed = this.opts.tamed;
    if (!tamed) return '';

    const def = companionById(tamed.baseId);
    const trait = traitById(tamed.traitId);

    return `
      <div class="spoils brass-panel spoils--binding">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="spoils__head">Bound to the Pact</div>
        ${line('Beast', def?.name ?? tamed.baseId, 'beast')}
        ${line('Constitution', String(tamed.baseHpRoll), 'marrow')}
        ${trait ? line('Knack', trait.name, 'trait') : line('Knack', 'none', 'empty')}
        <div class="spoils__note">It waits for you in the Vivarium.</div>
      </div>
    `;
  }

  /**
   * The plans on offer, if this fight had any left to teach.
   *
   * One pick, and the rest of the row goes dim rather than disappearing — seeing what was
   * passed over is most of what makes the choice feel like one.
   *
   * The copy is doing real work here. What the player takes is **not the card**, and a
   * screen that said "one card from the wreckage" while handing over a plan would be
   * lying about the one thing that changed: they now have to go and pay for it. So the
   * title names the thing, and a note underneath names the price and where it is paid.
   */
  private renderRewards(): void {
    const host = this.el?.querySelector('.victory__rewards');
    if (!host || this.opts.offer.length === 0) return;

    const title = document.createElement('div');
    title.className = 'victory__rewards-title';
    title.textContent = 'One schematic, off what it fought you with';
    host.appendChild(title);

    const row = document.createElement('div');
    row.className = 'victory__reward-row';

    for (const id of this.opts.offer) {
      const def = CARDS[id];
      if (!def) continue;

      const card = document.createElement('button');
      card.className = 'reward-card reward-card--schematic';
      card.style.setProperty('--school', schoolOf(def.school as never).main);
      card.innerHTML = `
        <span class="reward-card__cost">${formatCost(def.cost)}</span>
        <span class="reward-card__name">${def.name}</span>
        <span class="reward-card__text">${def.text}</span>
        <span class="reward-card__plan">SCHEMATIC</span>
      `;
      card.addEventListener('click', () => {
        if (this.claimed) return;
        this.claimed = true;
        this.opts.onClaim(id);
        row.classList.add('is-claimed');
        card.classList.add('is-taken');
        for (const other of row.querySelectorAll('button')) other.disabled = true;
        note.textContent = `${def.name} — the plan is yours. The Artificer cuts it for ${SCHEMATIC_COST_DUCATS} Ducats.`;
      });
      row.appendChild(card);
    }

    host.appendChild(row);

    const note = document.createElement('div');
    note.className = 'victory__rewards-note';
    note.textContent = `A plan, not the card. Take one to the Artificer and pay ${SCHEMATIC_COST_DUCATS} Ducats to have it cut.`;
    host.appendChild(note);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
