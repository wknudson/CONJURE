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
import { CARDS } from '../core/data/cards/index.js';
import { reagentById } from '../core/data/splicing.js';
import { formatCost } from '../hud/cost.js';
import { schoolOf } from '../render/palette.js';

export interface VictoryOptions {
  result: CombatResult;
  encounter: EncounterDef;
  /** What the accepted contract paid. Already in the purse.  */
  spoils: CombatSpoils;
  /** Cards offered as a reward, if any. */
  rewards: string[];
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

      <div class="victory__rewards"></div>
      <button class="brass-btn victory__leave">Return to Safehouse</button>
    `;

    el.querySelector('.victory__leave')!.addEventListener('click', () => this.opts.onLeave());

    root.appendChild(el);
    this.el = el;
    this.renderRewards();
  }

  /**
   * The card on offer, if a win earned one.
   *
   * One pick, and the rest of the row goes dim rather than disappearing — seeing what was
   * passed over is most of what makes the choice feel like one.
   */
  private renderRewards(): void {
    const host = this.el?.querySelector('.victory__rewards');
    if (!host || this.opts.rewards.length === 0) return;

    const title = document.createElement('div');
    title.className = 'victory__rewards-title';
    title.textContent = 'One card from the wreckage';
    host.appendChild(title);

    const row = document.createElement('div');
    row.className = 'victory__reward-row';

    for (const id of this.opts.rewards) {
      const def = CARDS[id];
      if (!def) continue;

      const card = document.createElement('button');
      card.className = 'reward-card';
      card.style.setProperty('--school', schoolOf(def.school as never).main);
      card.innerHTML = `
        <span class="reward-card__cost">${formatCost(def.cost)}</span>
        <span class="reward-card__name">${def.name}</span>
        <span class="reward-card__text">${def.text}</span>
      `;
      card.addEventListener('click', () => {
        if (this.claimed) return;
        this.claimed = true;
        this.opts.onClaim(id);
        row.classList.add('is-claimed');
        card.classList.add('is-taken');
        for (const other of row.querySelectorAll('button')) other.disabled = true;
      });
      row.appendChild(card);
    }

    host.appendChild(row);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
