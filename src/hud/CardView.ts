/**
 * A single hand card: the shared card face, plus the hand's own interactivity.
 *
 * The face itself lives in `cardFace.ts` and is shared with the Safehouse forges. It used
 * to be built here, which meant the Artificer grew a second, smaller card of its own — two
 * renderers for one object, and the forge is exactly where showing a player less about a
 * card they are about to buy is worst.
 */

import type { CardInstanceId } from '../contract/ids.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import { cardFaceHtml, faceOfSnapshot } from './cardFace.js';

export interface CardCallbacks {
  onClick(id: CardInstanceId): void;
  onHover(id: CardInstanceId | null): void;
}

export class CardView {
  readonly el: HTMLElement;

  constructor(
    readonly snapshot: CardSnapshot,
    private readonly cb: CardCallbacks,
  ) {
    const host = document.createElement('div');
    host.innerHTML = cardFaceHtml(faceOfSnapshot(snapshot));
    this.el = host.firstElementChild as HTMLElement;

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
