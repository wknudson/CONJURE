/**
 * The deployment tray — the bridge between a bought Vanguard and the board it stands on.
 *
 * Its own component rather than a mode inside `Hud`, because the deployment phase is not a
 * turn: there are no cards, no Pips and no End Turn, and the one thing the player can do
 * has no counterpart once the fight starts. Keeping it separate means the HUD is simply
 * hidden while this is up, instead of learning a second set of rules about itself.
 *
 * It owns no game state. Everything drawn here comes from `BoardView.roster`, which the
 * reducer produces — so a tray that disagrees with the board is not possible.
 */

import type { BoardView, RosterView } from '../contract/query.js';

export interface DeployTrayCallbacks {
  /** A body was picked up in the tray, or the selection cleared. */
  onSelect(defId: string | null): void;
  /** The player is done. Dispatches `finishDeployment`. */
  onEngage(): void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TEMPLATE = `
  <div class="deploy__bar">
    <div class="deploy__brief">
      <div class="deploy__title">Set your line</div>
      <div class="deploy__hint"></div>
    </div>
    <div class="deploy__tray"></div>
    <button class="deploy__engage" type="button">
      <span class="deploy__engage-label">Engage</span>
      <span class="deploy__engage-sub"></span>
    </button>
  </div>
`;

export class DeployTray {
  private root: HTMLElement;
  private trayEl: HTMLElement;
  private hintEl: HTMLElement;
  private engageBtn: HTMLButtonElement;
  private engageSub: HTMLElement;
  private selected: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly cb: DeployTrayCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'deploy';
    this.root.innerHTML = TEMPLATE;
    parent.appendChild(this.root);

    this.trayEl = this.root.querySelector<HTMLElement>('.deploy__tray')!;
    this.hintEl = this.root.querySelector<HTMLElement>('.deploy__hint')!;
    this.engageBtn = this.root.querySelector<HTMLButtonElement>('.deploy__engage')!;
    this.engageSub = this.root.querySelector<HTMLElement>('.deploy__engage-sub')!;

    this.engageBtn.addEventListener('click', () => this.cb.onEngage());
  }

  /** The body the player is currently holding, if any. */
  get selectedDefId(): string | null {
    return this.selected;
  }

  /**
   * Redraws from the authoritative board.
   *
   * Called after every deploy and recall rather than mutated in place: the reducer has
   * already decided what the tray contains, and re-reading it is cheaper than keeping a
   * second copy honest.
   */
  sync(board: BoardView): void {
    const reserve = board.roster.filter((r) => r.status === 'reserve');
    const fielded = board.roster.filter((r) => r.status === 'fielded');

    // A selection that just went down on the board is no longer holdable.
    if (this.selected && !reserve.some((r) => r.defId === this.selected)) {
      this.selected = null;
      this.cb.onSelect(null);
    }

    // What this arena seats, against what is standing. A kit is built for the biggest board
    // in the game, so on a small one the tray is showing a warband it cannot fully field —
    // and the player has to be told that here rather than discovering it as a refusal.
    const spent = fielded.reduce((sum, r) => sum + r.points, 0);
    const room = board.deployBudget - spent;

    this.trayEl.replaceChildren();
    for (const entry of reserve) {
      this.trayEl.appendChild(this.chipFor(entry, entry.points > room));
    }

    if (reserve.length === 0) {
      const done = document.createElement('div');
      done.className = 'deploy__empty';
      done.textContent = 'Every body is on the field.';
      this.trayEl.appendChild(done);
    }

    const benched = reserve.some((r) => r.points > room);
    this.hintEl.textContent = this.selected
      ? 'Click a glowing Anchor Tile to place it.'
      : benched
        ? 'This arena has no room left for the greyed bodies. They stay in reserve.'
        : reserve.length > 0
          ? 'Pick a body, then an Anchor Tile. Click a placed body to take it back.'
          : 'Click a placed body to take it back.';

    // Deliberately never disabled. Holding something back is a decision, and a button that
    // refused to start the fight would be the UI overruling it.
    const points = `${spent} / ${board.deployBudget} pts`;
    this.engageSub.textContent =
      reserve.length > 0
        ? `${points} · ${fielded.length} placed · ${reserve.length} held back`
        : `${points} · ${fielded.length} placed`;
  }

  private chipFor(entry: RosterView, noRoom: boolean): HTMLElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'deploy-chip';
    chip.classList.toggle('is-selected', entry.defId === this.selected);
    // Greyed rather than removed: a body the arena cannot seat is still yours, and hiding it
    // would read as having lost it.
    chip.classList.toggle('is-no-room', noRoom);
    if (noRoom) chip.title = 'No room left in this arena for this body.';
    chip.dataset.defId = entry.defId;
    chip.innerHTML = `
      <span class="deploy-chip__points">${entry.points}</span>
      <span class="deploy-chip__name">${escapeHtml(entry.name)}</span>
    `;
    chip.addEventListener('click', () => this.pick(entry.defId));
    return chip;
  }

  /** Clicking the held body again puts it down, which is the only way to cancel. */
  private pick(defId: string): void {
    this.selected = this.selected === defId ? null : defId;
    this.cb.onSelect(this.selected);
    for (const el of this.trayEl.querySelectorAll<HTMLElement>('.deploy-chip')) {
      el.classList.toggle('is-selected', el.dataset.defId === this.selected);
    }
    this.hintEl.textContent = this.selected
      ? 'Click a glowing Anchor Tile to place it.'
      : 'Pick a body, then an Anchor Tile. Click a placed body to take it back.';
  }

  /** Clears the held body without redrawing the whole tray. */
  clearSelection(): void {
    if (!this.selected) return;
    this.selected = null;
    this.cb.onSelect(null);
    for (const el of this.trayEl.querySelectorAll<HTMLElement>('.deploy-chip')) {
      el.classList.remove('is-selected');
    }
  }

  setInteractive(on: boolean): void {
    this.root.classList.toggle('is-locked', !on);
  }

  destroy(): void {
    this.root.remove();
  }
}
