/**
 * A single hand card, rendered as DOM so its rules text stays crisp when it scales up
 * on hover.
 */

import type { CardInstanceId } from '../contract/ids.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import { schoolOf } from '../render/palette.js';

export interface CardCallbacks {
  onClick(id: CardInstanceId): void;
  onHover(id: CardInstanceId | null): void;
}

/** What the card does with the board, in one word. */
const KIND_LABEL: Record<CardSnapshot['kind'], string> = {
  minion: 'MINION',
  spell: 'SPELL',
  rune: 'RUNE',
  obstacle: 'OBSTACLE',
};

export class CardView {
  readonly el: HTMLElement;

  constructor(
    readonly snapshot: CardSnapshot,
    private readonly cb: CardCallbacks,
  ) {
    const colors = schoolOf(snapshot.school);
    this.el = document.createElement('div');
    this.el.className = `card card--${snapshot.kind} card--src-${snapshot.source}`;
    if (snapshot.ephemeral) this.el.classList.add('card--ephemeral');
    this.el.style.setProperty('--school', colors.main);
    this.el.style.setProperty('--school-deep', colors.deep);

    const stats = snapshot.stats
      ? `<div class="card__stats">
           <span title="Attack">${snapshot.stats.atk}</span>
           <span title="Health">${snapshot.stats.hp}</span>
           <span title="Movement">${snapshot.stats.mov}</span>
         </div>`
      : '';

    // Each keyword carries its own tooltip: they are the densest jargon on screen.
    const keywords = snapshot.keywords.length
      ? `<div class="card__keywords">${snapshot.keywords
          .map((k) => `<span data-tip="${k}">${k}</span>`)
          .join(' · ')}</div>`
      : '';

    // The type line tells you at a glance what the card *is* — whether it puts a body on
    // the board, attaches to something, or resolves and goes away — and who casts it.
    // Reach is part of what the card *is* on a grid, so it sits on the type line rather
    // than buried in the rules text. Only Companion cards have one: the Hero has no
    // position to measure from.
    const rangeChip =
      snapshot.range === undefined
        ? ''
        : `<span class="card__range" data-tip="companionRange">RANGE ${snapshot.range}</span>`;

    const typeLine = `
      <div class="card__type">
        <span class="card__kind">${KIND_LABEL[snapshot.kind]}</span>
        ${rangeChip}
        <span class="card__source">${snapshot.source === 'companion' ? 'COMPANION' : 'HERO'}</span>
      </div>`;

    this.el.innerHTML = `
      <div class="card__cost">${snapshot.cost}</div>
      <div class="card__name">${escapeHtml(snapshot.name)}</div>
      ${typeLine}
      <div class="card__body">
        <div class="card__text">${escapeHtml(snapshot.text)}</div>
        ${keywords}
      </div>
      ${stats}
    `;

    this.el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.cb.onClick(snapshot.instanceId);
    });
    this.el.addEventListener('mouseenter', () => this.cb.onHover(snapshot.instanceId));
    this.el.addEventListener('mouseleave', () => this.cb.onHover(null));
  }

  setPlayable(playable: boolean): void {
    this.el.classList.toggle('is-unplayable', !playable);
  }

  setSelected(selected: boolean): void {
    this.el.classList.toggle('is-selected', selected);
  }

  playDrawAnimation(): void {
    this.el.classList.add('is-drawing');
    window.setTimeout(() => this.el.classList.remove('is-drawing'), 320);
  }

  playRemoveAnimation(): void {
    this.el.classList.add('is-leaving');
    window.setTimeout(() => this.el.remove(), 240);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
