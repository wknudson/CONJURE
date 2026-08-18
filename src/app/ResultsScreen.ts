import { formatCost } from '../hud/cost.js';
import type { Screen } from './ScreenManager.js';
import type { CombatResult } from '../contract/events.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { CARDS } from '../core/data/cards/index.js';
import { schoolOf } from '../render/palette.js';

const COPY: Record<CombatResult, { title: string; blurb: string; kind: string }> = {
  victory: {
    title: 'VICTORY',
    blurb: 'The duel is yours. The Pact holds.',
    kind: 'victory',
  },
  defeat: {
    title: 'DEFEAT',
    blurb: 'The Pact is broken. Your Hero and Companion fall together.',
    kind: 'defeat',
  },
  bound: {
    title: 'BOUND',
    blurb:
      'The Rite takes hold. Ignis kneels — not slain, but sworn. A companion joins your roster.',
    kind: 'bound',
  },
};

export interface ResultsOptions {
  result: CombatResult;
  encounter: EncounterDef;
  /** Cards offered as a reward. Empty on a loss. */
  rewards: string[];
  /**
   * Whether the fight can be taken again.
   *
   * False once a run is spent: replaying would open the same encounter with a Pact at
   * zero, which the Gauntlet has no answer for. Defaults to true for a standalone fight.
   */
  canRematch?: boolean;
  onClaim: (cardId: string) => void;
  onRematch: () => void;
  onTitle: () => void;
}

export class ResultsScreen implements Screen {
  private el: HTMLElement | null = null;
  private claimed = false;

  constructor(private readonly opts: ResultsOptions) {}

  mount(root: HTMLElement): void {
    const copy = COPY[this.opts.result];
    const el = document.createElement('div');
    el.className = `screen screen--results screen--${copy.kind}`;
    el.innerHTML = `
      <div class="results__title">${copy.title}</div>
      <div class="results__blurb">${copy.blurb}</div>
      <div class="results__meta">${this.opts.encounter.name}</div>
      <div class="results__rewards"></div>
      <div class="results__buttons">
        ${this.opts.canRematch === false ? '' : '<button class="results__btn results__rematch">Rematch</button>'}
        <button class="results__btn results__menu">Back to Safehouse</button>
      </div>
    `;

    el.querySelector('.results__rematch')?.addEventListener('click', () => this.opts.onRematch());
    el.querySelector('.results__menu')!.addEventListener('click', () => this.opts.onTitle());

    this.renderRewards(el);
    root.appendChild(el);
    this.el = el;
  }

  /**
   * A win offers a choice of one card. Picking is one-way and ends the offer, so the
   * player cannot rebuild the screen to claim all three.
   */
  private renderRewards(el: HTMLElement): void {
    const host = el.querySelector('.results__rewards');
    if (!host) return;

    const offers = this.opts.rewards.filter((id) => CARDS[id]);
    if (offers.length === 0) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = `
      <div class="results__rewards-title">Choose a card for your collection</div>
      <div class="results__reward-row"></div>
    `;
    const row = host.querySelector('.results__reward-row')!;

    for (const id of offers) {
      const def = CARDS[id]!;
      const colors = schoolOf(def.school as never);
      const btn = document.createElement('button');
      btn.className = 'reward';
      btn.style.setProperty('--school', colors.main);
      btn.innerHTML = `
        <span class="reward__cost">${formatCost(def.cost)}</span>
        <span class="reward__name">${def.name}</span>
        <span class="reward__kind">${def.kind} · ${def.school}</span>
        <span class="reward__text">${def.text}</span>
      `;
      btn.addEventListener('click', () => this.claim(id, host as HTMLElement));
      row.appendChild(btn);
    }
  }

  private claim(cardId: string, host: HTMLElement): void {
    if (this.claimed) return;
    this.claimed = true;
    this.opts.onClaim(cardId);

    const def = CARDS[cardId];
    host.innerHTML = `<div class="results__claimed">${def?.name ?? cardId} added to your collection.</div>`;
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
