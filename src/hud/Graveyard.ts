/**
 * The Fallen Vanguard — a standing list of who is dead, and the only way to raise a body
 * whose pyre is not on this board.
 *
 * It exists because the board cannot carry the whole answer. A Soul Pyre marks the tile a
 * body fell on, but the two Rallies do not care about that tile, and a body carried in
 * from an earlier fight of the dungeon has no pyre here at all. Those are pickable *only*
 * from a list, so the list is not a convenience — for half the revival cards it is the
 * entire interface.
 *
 * Reads `BoardView.roster` and dispatches. It holds no state of its own beyond whether the
 * drawer is open.
 */

import type { BoardView, RosterView, TargetSpec } from '../contract/query.js';

export interface GraveyardCallbacks {
  /** A fallen body was picked while a card was waiting for one. */
  onPick(rosterIndex: number): void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TEMPLATE = `
  <button class="grave__tab" type="button">
    <span class="grave__skull">☠</span>
    <span class="grave__count">0</span>
  </button>
  <div class="grave__drawer">
    <div class="grave__title">The Fallen Vanguard</div>
    <div class="grave__note"></div>
    <div class="grave__list"></div>
  </div>
`;

export class Graveyard {
  private root: HTMLElement;
  private tabEl: HTMLButtonElement;
  private countEl: HTMLElement;
  private listEl: HTMLElement;
  private noteEl: HTMLElement;
  private open = false;
  /** Set while a card is waiting on a fallen target; null the rest of the time. */
  private awaiting: TargetSpec | null = null;

  constructor(
    parent: HTMLElement,
    private readonly cb: GraveyardCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'grave';
    this.root.innerHTML = TEMPLATE;
    parent.appendChild(this.root);

    this.tabEl = this.root.querySelector<HTMLButtonElement>('.grave__tab')!;
    this.countEl = this.root.querySelector<HTMLElement>('.grave__count')!;
    this.listEl = this.root.querySelector<HTMLElement>('.grave__list')!;
    this.noteEl = this.root.querySelector<HTMLElement>('.grave__note')!;

    this.tabEl.addEventListener('click', () => this.toggle());
  }

  private toggle(): void {
    this.open = !this.open;
    this.root.classList.toggle('is-open', this.open);
  }

  /**
   * Tells the drawer a card is waiting on a fallen body.
   *
   * It opens itself when that happens: a player who has just clicked a Rally is looking
   * for somewhere to point it, and making them find the tab first would be hiding the
   * answer behind a second click.
   */
  setAwaiting(spec: TargetSpec | null, board: BoardView): void {
    this.awaiting = spec && spec.kind === 'fallen' ? spec : null;
    if (this.awaiting) {
      this.open = true;
      this.root.classList.add('is-open');
    }
    this.sync(board);
  }

  sync(board: BoardView): void {
    const fallen = board.roster.filter((r) => r.status === 'fallen');

    this.countEl.textContent = String(fallen.length);
    // Hidden entirely while nobody is dead. An empty drawer permanently in the corner is
    // furniture; one that appears when your line breaks is a message.
    this.root.classList.toggle('is-empty', fallen.length === 0);
    this.root.classList.toggle('is-awaiting', this.awaiting !== null);
    if (fallen.length === 0) {
      this.open = false;
      this.root.classList.remove('is-open');
    }

    this.noteEl.textContent = this.awaiting
      ? 'Pick a body to raise.'
      : fallen.length === 1
        ? 'One of yours is down.'
        : `${fallen.length} of yours are down.`;

    this.listEl.replaceChildren();
    board.roster.forEach((entry, rosterIndex) => {
      if (entry.status !== 'fallen') return;
      this.listEl.appendChild(this.rowFor(entry, rosterIndex));
    });
  }

  private rowFor(entry: RosterView, rosterIndex: number): HTMLElement {
    // Pickable only when a card is actually waiting, and only when *this* card will take
    // this body: Aetheric Resurgence drops any entry whose pyre is occupied, and the row
    // has to say so rather than throwing when clicked.
    const offered = this.awaiting?.kind === 'fallen'
      ? this.awaiting.entries.some((e) => e.rosterIndex === rosterIndex)
      : false;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'grave-row';
    row.classList.toggle('is-pickable', offered);
    row.disabled = !offered;

    const where = entry.fellAt ? `fell at ${entry.fellAt.x},${entry.fellAt.y}` : 'no pyre here';
    row.innerHTML = `
      <span class="grave-row__portrait">${escapeHtml(entry.name.slice(0, 1))}</span>
      <span class="grave-row__body">
        <span class="grave-row__name">${escapeHtml(entry.name)}</span>
        <span class="grave-row__where">${escapeHtml(where)}</span>
      </span>
    `;
    if (offered) row.addEventListener('click', () => this.cb.onPick(rosterIndex));
    return row;
  }

  destroy(): void {
    this.root.remove();
  }
}
