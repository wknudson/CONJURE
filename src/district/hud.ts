/**
 * Everything on the glass in front of the ward.
 *
 * All DOM, layered over the canvas rather than drawn into it, because it is text and text
 * belongs in the thing that already knows how to lay out text. The panels reuse the
 * Safehouse's own classes wherever the markup is the same — the pact ledger, the satchel
 * chips, the death notice, the bounty cards — so the street and the shops it opens onto
 * are visibly the same game rather than two skins.
 */

import { INVENTORY_LIMIT, isCritical } from '../core/overworld/state.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import { useConsumable } from '../core/overworld/run.js';
import type { Bounty } from '../core/data/bounties.js';
import { encounterById } from '../core/data/encounters/index.js';
import type { TutorialFlag } from '../app/save.js';
import { LOCKED_REASON, bountyAvailable, currentObjective, pipStates, tutorialActive } from './quest.js';
import { companionById } from '../core/data/companions.js';
import { huntByEncounter, huntCooldownLabel, huntCooldownRemaining } from '../core/data/hunts.js';

/**
 * Escapes text bound for `innerHTML`.
 *
 * Every string the gate panel interpolates is authored content — species names, region
 * names, encounter blurbs — so nothing here is user input today. It is escaped anyway
 * because "authored" is a property of the current content and not of the code: the panel
 * renders whatever the registry holds, and the day a name arrives from somewhere else this
 * is the line that decides whether that is a bug or a nothing.
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface HudOpts {
  root: HTMLElement;
  global: GlobalGameState;
  onChange?: () => void;
  onBounty: (bounty: Bounty) => void;
}

export class DistrictHud {
  private readonly objective: HTMLDivElement;
  private readonly objectiveTask: HTMLDivElement;
  private readonly objectivePips: HTMLDivElement;
  private readonly zoneChip: HTMLDivElement;
  private readonly alert: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly promptLabel: HTMLSpanElement;
  private readonly promptDetail: HTMLSpanElement;
  private readonly vignette: HTMLDivElement;
  private readonly ledger: HTMLDivElement;
  private readonly boardPanel: HTMLDivElement;
  private readonly overlay: HTMLDivElement;

  private zoneSafe: boolean | null = null;
  private boardOpen = false;
  /** Repaints the gate's countdowns while it is open. Cleared by `closeBoard`. */
  private huntTimer: number | undefined;

  constructor(private readonly opts: HudOpts) {
    const root = opts.root;

    this.objective = el('div', 'district-panel district-objective');
    this.objective.innerHTML =
      '<div class="district-objective__cap">OBJECTIVE</div>' +
      '<div class="district-objective__task"></div>' +
      '<div class="district-objective__pips"></div>';
    root.appendChild(this.objective);
    this.objectiveTask = this.objective.querySelector('.district-objective__task')!;
    this.objectivePips = this.objective.querySelector('.district-objective__pips')!;

    this.zoneChip = el('div', 'district-panel district-zone');
    root.appendChild(this.zoneChip);

    this.alert = el('div', 'district-alert');
    this.alert.textContent = 'SPOTTED';
    root.appendChild(this.alert);

    this.prompt = el('div', 'district-panel district-prompt');
    this.prompt.innerHTML =
      '<b>[SPACE]</b> <span class="district-prompt__label"></span>' +
      '<span class="district-prompt__detail"></span>';
    root.appendChild(this.prompt);
    this.promptLabel = this.prompt.querySelector('.district-prompt__label')!;
    this.promptDetail = this.prompt.querySelector('.district-prompt__detail')!;

    this.vignette = el('div', 'district-vignette');
    root.appendChild(this.vignette);

    // Deliberately not `.hub-ledger`: that class lays the old hub's ledger out as a wide
    // horizontal bar. The inner classes below (`ledger__pact`, `ledger__gauge`,
    // `ledger__item`…) carry the actual styling and are reused as-is.
    this.ledger = el('div', 'district-panel district-ledger');
    root.appendChild(this.ledger);

    this.boardPanel = el('div', 'district-board');
    root.appendChild(this.boardPanel);

    this.overlay = el('div', 'district-overlay');
    root.appendChild(this.overlay);

    const help = el('div', 'district-panel district-help');
    help.textContent =
      'WASD / arrows - move\nQ / E - orbit camera\nSpace - interact / advance\nI - satchel\nPanel (top right) - tune the look';
    root.appendChild(help);

    this.setZone(true);
    this.renderLedger();
  }

  /* ------------------------------------------------------------ objective */

  renderTutorial(flags: readonly TutorialFlag[]): void {
    if (!tutorialActive(flags)) {
      this.objective.classList.add('is-hidden');
      return;
    }
    this.objective.classList.remove('is-hidden');
    this.objectiveTask.textContent = currentObjective(flags) ?? '';
    this.objectivePips.innerHTML = pipStates(flags)
      .map(
        (p) =>
          `<span class="district-pip${p.lit ? ' is-lit' : ''}">&#9672; ${p.label}</span>`,
      )
      .join(' ');
  }

  /* ------------------------------------------------------------ zone + alert */

  /**
   * The Sidewalk Immunity readout.
   *
   * Only touches the DOM when the answer changes — this is asked every frame, and a chip
   * that rewrote its own text sixty times a second would fight the CSS transition it
   * depends on for the fade.
   */
  /**
   * Takes the zone chip and the danger vignette off the screen entirely.
   *
   * For an area where Sidewalk Immunity is not a rule. Pinning the chip to EXPOSED there
   * would be technically true and a lie in effect: it reads as "you are in trouble" when what
   * it means is "that rule is not in play here".
   */
  hideZone(): void {
    this.zoneSafe = null;
    this.zoneChip.classList.remove('is-safe', 'is-danger');
    this.zoneChip.textContent = '';
    this.vignette.classList.remove('is-shown');
  }

  setZone(safe: boolean): void {
    if (this.zoneSafe === safe) return;
    this.zoneSafe = safe;
    this.zoneChip.classList.toggle('is-safe', safe);
    this.zoneChip.classList.toggle('is-danger', !safe);
    this.zoneChip.textContent = safe
      ? 'SANCTIONED WALKWAY — SAFE'
      : 'UNPAVED GROUND — EXPOSED';
    this.vignette.classList.toggle('is-shown', !safe);
  }

  setAlert(on: boolean): void {
    this.alert.classList.toggle('is-shown', on);
  }

  /* ------------------------------------------------------------ prompt */

  setPrompt(label: string | null, detail: string | null): void {
    if (!label) {
      this.prompt.classList.remove('is-shown');
      return;
    }
    this.promptLabel.textContent = label;
    this.promptDetail.textContent = detail ? ` — ${detail}` : '';
    this.prompt.classList.add('is-shown');
  }

  /* ------------------------------------------------------------ ledger */

  /**
   * What the run is carrying, and the only place a tonic can be drunk.
   *
   * Here rather than in the Apothecary because this is the street you are standing on when
   * you decide what to take into the next fight, and items are barred once a fight starts.
   */
  renderLedger(): void {
    const { pact, economy, inventory, activeBuff } = this.opts.global.overworld;
    const pct = Math.max(0, Math.min(100, (pact.currentHp / pact.maxHp) * 100));
    const critical = isCritical(this.opts.global.overworld);

    this.ledger.innerHTML = `
      <div class="ledger__pact">
        <div class="ledger__label">The Pact</div>
        <div class="ledger__gauge"><i style="width:${pct}%"></i></div>
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
          <span class="ledger__label">Brew held</span>
          <span class="ledger__held">${activeBuff ?? 'none'}</span>
        </div>
      </div>
      <button class="district-satchel__toggle">Satchel ${inventory.length}/${INVENTORY_LIMIT}</button>
      <div class="district-satchel ledger__satchel"></div>
    `;
    this.ledger
      .querySelector('.district-satchel__toggle')!
      .addEventListener('click', () => this.toggleSatchel());
    this.renderSatchel();
  }

  toggleSatchel(): void {
    this.ledger.classList.toggle('is-open');
  }

  private renderSatchel(): void {
    const host = this.ledger.querySelector('.district-satchel')!;
    const { overworld } = this.opts.global;
    host.innerHTML = '';

    if (overworld.inventory.length === 0) {
      host.innerHTML = '<span class="ledger__held">empty</span>';
      return;
    }

    overworld.inventory.forEach((item, index) => {
      // A tonic drunk at full health is simply gone. Refusing the click is kinder than
      // charging for nothing, and the label says which of the two it is.
      const wasted = item.type === 'healing' && overworld.pact.currentHp >= overworld.pact.maxHp;
      const chip = document.createElement('button');
      chip.className = 'ledger__item';
      chip.disabled = wasted;
      chip.textContent = item.name;
      chip.title = wasted ? 'Already at full health.' : 'Click to use.';
      chip.addEventListener('click', () => {
        if (!useConsumable(this.opts.global, index)) return;
        this.opts.onChange?.();
        this.renderLedger();
        this.ledger.classList.add('is-open');
      });
      host.appendChild(chip);
    });
  }

  /* ------------------------------------------------------------ the board */

  get boardIsOpen(): boolean {
    return this.boardOpen;
  }

  /**
   * The contracts, as the physical board would show them.
   *
   * During the guided lap everything above Novice is shown but refused. Hiding them would
   * teach a new player that the board has one thing on it; greying them out teaches that
   * it has four and that three are not for them today.
   */
  openBoard(bounties: readonly Bounty[], flags: readonly TutorialFlag[]): void {
    this.boardOpen = true;
    const critical = isCritical(this.opts.global.overworld);

    // Whether the guided Novice contract is actually takeable. If its stake is out of
    // reach the gate lifts, because a gate that leaves the only open door locked is a
    // dead end rather than a tutorial.
    const purse = this.opts.global.overworld.economy.ducats;
    const noviceAffordable = bounties.some(
      (b) => b.difficulty === 'novice' && !b.audit && (b.wager ?? 0) <= purse,
    );

    const cards = bounties
      .map((bounty) => {
        const open = bountyAvailable(
          flags,
          bounty.difficulty,
          bounty.audit === true,
          noviceAffordable,
        );
        const encounter = encounterById(bounty.enemySeed);
        const reagents = bounty.spoils.reagents
          ? Object.values(bounty.spoils.reagents).reduce((a, b) => a + b, 0)
          : 0;
        return `
        <button class="bounty-card brass-panel bounty-card--${bounty.difficulty}${
          bounty.audit ? ' bounty-card--audit' : ''
        }${open ? '' : ' is-locked'}" data-bounty="${bounty.id}"${open ? '' : ' disabled'}>
          <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
          ${bounty.audit ? '<span class="bounty-seal">Audit</span>' : ''}
          <div class="bounty-card__tier">${bounty.audit ? 'audit' : bounty.difficulty}</div>
          <div class="bounty-card__title">${bounty.title}</div>
          <div class="bounty-card__where">${
            encounter
              ? `${encounter.name} · ${encounter.width}×${encounter.height}`
              : 'Location unknown'
          }</div>
          <div class="bounty-card__flavour">${bounty.flavour}</div>
          <div class="bounty-card__pay">
            <span class="bounty-card__coin bounty-card__coin--gold">${bounty.spoils.ducats ?? 0} d</span>
            ${
              bounty.spoils.marrowShards
                ? `<span class="bounty-card__coin bounty-card__coin--marrow">${bounty.spoils.marrowShards} shards</span>`
                : ''
            }
            ${reagents ? `<span class="bounty-card__coin bounty-card__coin--reagent">${reagents} cores</span>` : ''}
            ${critical ? '<span class="bounty-card__warn">at critical health</span>' : ''}
          </div>
          ${open ? '' : `<div class="bounty-card__locked">${LOCKED_REASON}</div>`}
        </button>`;
      })
      .join('');

    this.boardPanel.innerHTML = `
      <div class="district-board__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <div class="district-board__head">
          <div class="district-board__title">The Bounty Board</div>
          <button class="brass-btn district-board__close">Step away</button>
        </div>
        <div class="district-board__list">${cards}</div>
      </div>`;
    this.boardPanel.classList.add('is-open');

    this.boardPanel
      .querySelector('.district-board__close')!
      .addEventListener('click', () => this.closeBoard());

    for (const node of this.boardPanel.querySelectorAll<HTMLButtonElement>('[data-bounty]')) {
      node.addEventListener('click', () => {
        const found = bounties.find((b) => b.id === node.dataset.bounty);
        if (!found) return;
        this.closeBoard();
        this.opts.onBounty(found);
      });
    }
  }

  /**
   * The Wildlands Gate: standing work, on its own clock.
   *
   * Renders into the **same** panel element the Bounty Board uses, and sets the same
   * `boardOpen` flag. That is not laziness about styling — it is what makes Escape close
   * this, movement stay blocked while it is up, and the interact prompt behave, all without
   * a second copy of the logic in `DistrictScreen`. Two overlays that must never be open at
   * once are more honestly one overlay with two renderers.
   *
   * The countdown ticks. A ten-minute cooldown that only updated when the panel was reopened
   * would show a stale "returns in 4m" to a player standing there watching it, so a repaint
   * runs every second while the gate is up and is cleared the moment it closes.
   */
  openHunts(board: readonly Bounty[], stamps: Readonly<Record<string, number>>): void {
    this.boardOpen = true;
    this.boardPanel.classList.add('is-open');
    this.renderHunts(board, stamps);

    this.huntTimer = window.setInterval(() => {
      // Re-rendered rather than patched: the panel is small, rebuilt from scratch on every
      // open already, and a targeted update would need to know which cards crossed the line
      // this second. Repainting is the cheaper thing to be correct about.
      if (this.boardOpen) this.renderHunts(board, stamps);
    }, 1000);
  }

  private renderHunts(
    board: readonly Bounty[],
    stamps: Readonly<Record<string, number>>,
  ): void {
    const critical = isCritical(this.opts.global.overworld);
    // Read here rather than passed in, because this repaints on a timer and a `now` captured
    // at open would freeze every countdown at the moment the gate was opened.
    const now = Date.now();

    // Grouped by region so the panel reads as a map rather than as a list. Built off the
    // registry's own order, which is founders first and then the second bloodlines.
    const regions: { region: string; cards: string[] }[] = [];
    for (const bounty of board) {
      const entry = huntByEncounter(bounty.enemySeed);
      if (!entry) continue;
      const left = huntCooldownRemaining(stamps[bounty.enemySeed], now);
      const open = left === 0;
      const encounter = encounterById(bounty.enemySeed);
      const species = companionById(entry.species);
      const reagents = bounty.spoils.reagents
        ? Object.values(bounty.spoils.reagents).reduce((a, b) => a + b, 0)
        : 0;

      const card = `
        <button class="bounty-card brass-panel bounty-card--${bounty.difficulty}${
          open ? '' : ' is-locked'
        }" data-hunt="${esc(bounty.enemySeed)}"${open ? '' : ' disabled'}>
          <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
          <div class="bounty-card__tier">${esc(bounty.difficulty)}</div>
          <div class="bounty-card__title">${esc(species?.name ?? bounty.title)}</div>
          <div class="bounty-card__where">${
            encounter
              ? `${esc(encounter.name)} · ${encounter.width}×${encounter.height}`
              : esc(entry.region)
          }</div>
          <div class="bounty-card__flavour">${esc(bounty.flavour)}</div>
          <div class="bounty-card__pay">
            <span class="bounty-card__coin bounty-card__coin--gold">${bounty.spoils.ducats ?? 0} d</span>
            ${
              bounty.spoils.marrowShards
                ? `<span class="bounty-card__coin bounty-card__coin--marrow">${bounty.spoils.marrowShards} shards</span>`
                : ''
            }
            ${reagents ? `<span class="bounty-card__coin bounty-card__coin--reagent">${reagents} cores</span>` : ''}
            ${critical ? '<span class="bounty-card__warn">at critical health</span>' : ''}
          </div>
          ${open ? '' : `<div class="bounty-card__locked">${esc(huntCooldownLabel(left))}</div>`}
        </button>`;

      const group = regions.find((r) => r.region === entry.region);
      if (group) group.cards.push(card);
      else regions.push({ region: entry.region, cards: [card] });
    }

    const groups = regions
      .map(
        (r) => `
        <div class="district-board__region">${esc(r.region)}</div>
        <div class="district-board__list">${r.cards.join('')}</div>`,
      )
      .join('');

    this.boardPanel.innerHTML = `
      <div class="district-board__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <div class="district-board__head">
          <div class="district-board__title">Past the Gate</div>
          <button class="brass-btn district-board__close">Step away</button>
        </div>
        <div class="district-board__note">
          Nobody posted these. What comes back with you is whatever you catch — and no two
          are the same animal.
        </div>
        ${groups}
      </div>`;

    this.boardPanel
      .querySelector('.district-board__close')!
      .addEventListener('click', () => this.closeBoard());

    for (const node of this.boardPanel.querySelectorAll<HTMLButtonElement>('[data-hunt]')) {
      node.addEventListener('click', () => {
        const found = board.find((b) => b.enemySeed === node.dataset.hunt);
        if (!found) return;
        this.closeBoard();
        this.opts.onBounty(found);
      });
    }
  }

  closeBoard(): void {
    this.boardOpen = false;
    this.boardPanel.classList.remove('is-open');
    this.boardPanel.innerHTML = '';
    if (this.huntTimer !== undefined) {
      window.clearInterval(this.huntTimer);
      this.huntTimer = undefined;
    }
  }

  /* ------------------------------------------------------------ overlays */

  /**
   * The death notice: a Magistracy seal over the whole street until it is acknowledged.
   *
   * Modal on purpose. A player who lost a run to a fight they thought they could win
   * should have to look at the bill before the doors are in front of them again.
   */
  showNotice(notice: { title: string; body: string }, onAck: () => void): void {
    this.overlay.innerHTML = `
      <div class="hub-notice__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="hub-notice__seal"></div>
        <div class="hub-notice__title">${notice.title}</div>
        <div class="hub-notice__body">${notice.body}</div>
        <button class="brass-btn hub-notice__ack">Begin again</button>
      </div>`;
    this.overlay.classList.add('is-shown');
    this.overlay.querySelector('.hub-notice__ack')!.addEventListener('click', () => {
      this.hideOverlay();
      onAck();
    });
  }

  /** The Warden's hand on your shoulder. Dismisses itself. */
  showSeized(): void {
    this.overlay.innerHTML =
      '<div class="district-overlay__big">SEIZED</div>' +
      '<div class="district-overlay__sub">The pavement is sanctuary. Stay in the lamplight, and no Warden can lay a hand on you.</div>';
    this.overlay.classList.add('is-shown', 'is-passive');
  }

  hideOverlay(): void {
    this.overlay.classList.remove('is-shown', 'is-passive');
    this.overlay.innerHTML = '';
  }

  destroy(): void {
    for (const node of [
      this.objective,
      this.zoneChip,
      this.alert,
      this.prompt,
      this.vignette,
      this.ledger,
      this.boardPanel,
      this.overlay,
    ]) {
      node.remove();
    }
    document.body.classList.remove('is-talking');
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
