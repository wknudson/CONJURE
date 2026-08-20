/**
 * "Channel how much power?" — the X on a variable-cost card.
 *
 * A card with `xCost` has no price on its face until the player names one, so it cannot
 * follow the ordinary click-then-target flow: X has to be settled *before* a target is
 * chosen, or the preview would be showing the result of a cost nobody has picked.
 *
 * A row of pips rather than a slider. X tops out at five, and five discrete choices read
 * faster as five things to click than as a track to drag — and each pip is a Pip, which
 * is the same unit the player is spending.
 */

import type { CardSnapshot } from '../contract/snapshots.js';

export interface ChannelChoice {
  /** How much the player committed. Never zero — the engine refuses it. */
  x: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class ChannelPicker {
  private root: HTMLElement | null = null;
  private onPick: ((choice: ChannelChoice | null) => void) | null = null;
  private x = 1;
  private ceiling = 1;

  constructor(private readonly parent: HTMLElement) {}

  get open(): boolean {
    return this.root !== null;
  }

  /**
   * Asks for an X and calls back with it, or with null if the player backed out.
   *
   * `affordable` is the *live* ceiling — what the purse can actually pay right now —
   * and is clamped against the card's own maximum. Offering a sixth pip on a card that
   * caps at five, or a fourth on three Pips, would be offering a play the reducer will
   * throw on.
   */
  ask(card: CardSnapshot, affordable: number, onPick: (choice: ChannelChoice | null) => void): void {
    this.close();
    const max = card.xCost?.max ?? 1;
    this.ceiling = Math.max(1, Math.min(max, affordable));
    this.x = this.ceiling;
    this.onPick = onPick;

    const el = document.createElement('div');
    el.className = 'xcost';
    el.innerHTML = `
      <div class="xcost__sheet" role="dialog" aria-label="Channel how much power">
        <div class="xcost__title">Channel how much power?</div>
        <div class="xcost__card">${escapeHtml(card.name)}</div>
        <div class="xcost__pips"></div>
        <div class="xcost__read"></div>
        <div class="xcost__actions">
          <button class="xcost__cancel" type="button">Back</button>
          <button class="xcost__confirm" type="button">Channel</button>
        </div>
      </div>
    `;
    this.parent.appendChild(el);
    this.root = el;

    el.querySelector('.xcost__cancel')!.addEventListener('click', () => this.finish(null));
    el.querySelector('.xcost__confirm')!.addEventListener('click', () =>
      this.finish({ x: this.x }),
    );
    // Clicking the scrim backs out. Anything else would trap the player in a modal that
    // the rest of the board is still visible behind.
    el.addEventListener('click', (ev) => {
      if (ev.target === el) this.finish(null);
    });

    this.render(card);
  }

  private render(card: CardSnapshot): void {
    const el = this.root;
    if (!el) return;

    const pips = el.querySelector<HTMLElement>('.xcost__pips')!;
    pips.replaceChildren();
    const max = card.xCost?.max ?? 1;
    for (let i = 1; i <= max; i++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = 'xcost__pip';
      pip.classList.toggle('is-lit', i <= this.x);
      // Beyond the purse. Shown rather than hidden: what you cannot afford this turn is
      // information about the card, and hiding it would make the same card look different
      // from one turn to the next.
      pip.classList.toggle('is-beyond', i > this.ceiling);
      pip.disabled = i > this.ceiling;
      pip.textContent = String(i);
      pip.addEventListener('click', () => {
        this.x = i;
        this.render(card);
      });
      pips.appendChild(pip);
    }

    const read = el.querySelector<HTMLElement>('.xcost__read')!;
    read.textContent =
      this.ceiling < max
        ? `${this.x} of a possible ${max} — you can afford ${this.ceiling}.`
        : `${this.x} of ${max}.`;
  }

  private finish(choice: ChannelChoice | null): void {
    const cb = this.onPick;
    this.close();
    cb?.(choice);
  }

  /** Backs out without calling back. Used when the turn is taken away mid-choice. */
  close(): void {
    this.root?.remove();
    this.root = null;
    this.onPick = null;
  }

  /** Esc backs out, the same as every other cancel in the game. */
  handleKey(key: string): boolean {
    if (!this.root) return false;
    if (key === 'Escape') {
      this.finish(null);
      return true;
    }
    if (key === 'Enter') {
      this.finish({ x: this.x });
      return true;
    }
    return false;
  }
}
