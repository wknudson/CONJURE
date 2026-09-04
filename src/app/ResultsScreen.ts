import type { Screen } from './ScreenManager.js';
import type { CombatResult } from '../contract/events.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';

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
      'The Rite takes hold. The beast kneels — not slain, but sworn. A companion joins your roster.',
    kind: 'bound',
  },
};

/**
 * How a contract ended, when it did not end well.
 *
 * **This screen hands out nothing**, and the absence is the design rather than an
 * omission. Cards used to be a choice offered here; they are Schematics now, they come off
 * things you *beat*, and a fight you lost taught you nothing you can take to the bench.
 *
 * The reward apparatus that used to live here was already dead before it was removed:
 * `main.ts` sends every win to `VictoryScreen` and reaches this one only on a loss, where
 * the offer was unconditionally empty. Forty lines of picker that could not run.
 *
 * What a loss costs is still money and time, never possessions — nothing is taken here
 * either.
 */
export interface ResultsOptions {
  result: CombatResult;
  encounter: EncounterDef;
  /**
   * What the loss is about to cost, said here rather than a screen later.
   *
   * The fee, the health and the lost brew were all real, and none of them were mentioned
   * until a modal on the street — after the player had already clicked through a screen
   * that said only "the Pact is broken". The bill belongs on the bill.
   */
  consequence?: string;
  onTitle: () => void;
}

export class ResultsScreen implements Screen {
  private el: HTMLElement | null = null;

  constructor(private readonly opts: ResultsOptions) {}

  mount(root: HTMLElement): void {
    const copy = COPY[this.opts.result];
    const el = document.createElement('div');
    el.className = `screen screen--results screen--${copy.kind}`;
    el.innerHTML = `
      <div class="results__title">${copy.title}</div>
      <div class="results__blurb">${copy.blurb}</div>
      ${this.opts.consequence ? `<div class="results__consequence">${this.opts.consequence}</div>` : ''}
      <div class="results__meta">${this.opts.encounter.name}</div>
      <div class="results__buttons">
        <button class="results__btn results__menu">Back to the street</button>
      </div>
    `;

    el.querySelector('.results__menu')!.addEventListener('click', () => this.opts.onTitle());

    root.appendChild(el);
    this.el = el;
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
