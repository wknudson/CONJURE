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
import { siteByEncounter } from './sites.js';
import { areaById } from './areas/index.js';
import type { TutorialFlag } from '../app/save.js';
import type { AreaDef } from './map.js';
import { LOCKED_REASON, bountyAvailable, currentObjective, pipStates, tutorialActive } from './quest.js';
import { errandObjective, type ErrandState } from './errands.js';
import { clockLabel, phaseAt } from './daylight.js';
import {
  brewPrice,
  buyAt,
  buyRefusal,
  corePrice,
  sellAt,
  sellRefusal,
  stallStock,
  type StallDef,
} from '../core/data/stalls.js';
import { APOTHECARY_STOCK } from '../core/data/apothecary.js';
import { reagentById } from '../core/data/splicing.js';
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
  /** Hands an open errand back. See `renderObjective`. */
  onErrandAbandon?: () => void;
  /**
   * What time it is, asked rather than handed over.
   *
   * A function because the ledger is re-rendered on every purse change and the hour moves
   * underneath it -- a value captured when the HUD was built would be the time the ward was
   * entered, frozen, for as long as the player stayed in it.
   */
  hour: () => number;
}

export class DistrictHud {
  private readonly objective: HTMLDivElement;
  private readonly objectiveTask: HTMLDivElement;
  private readonly objectivePips: HTMLDivElement;
  private readonly objectiveCap: HTMLDivElement;
  private readonly objectiveFlash: HTMLDivElement;
  private readonly objectiveDrop: HTMLButtonElement;
  private flashTimer = 0;
  private readonly zoneChip: HTMLDivElement;
  private readonly alert: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly promptLabel: HTMLSpanElement;
  private readonly promptDetail: HTMLSpanElement;
  private readonly vignette: HTMLDivElement;
  private readonly ledger: HTMLDivElement;
  private readonly boardPanel: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly mapPanel: HTMLDivElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly mapCaption: HTMLDivElement;
  private help: HTMLDivElement | null = null;

  private zoneSafe: boolean | null = null;
  private boardOpen = false;
  private mapOpen = false;
  /**
   * The ground, drawn once and kept.
   *
   * The tiles never move, so redrawing six hundred of them every frame to put one dot on
   * top would be the most expensive thing on the glass. Baked per area and blitted.
   */
  private mapGround: HTMLCanvasElement | null = null;
  private mapGroundFor = '';
  private mapCell = 0;
  /** Repaints the gate's countdowns while it is open. Cleared by `closeBoard`. */
  private huntTimer: number | undefined;

  constructor(private readonly opts: HudOpts) {
    const root = opts.root;

    this.objective = el('div', 'district-panel district-objective');
    this.objective.innerHTML =
      '<div class="district-objective__cap">OBJECTIVE</div>' +
      '<div class="district-objective__task"></div>' +
      '<div class="district-objective__pips"></div>' +
      '<button class="district-objective__drop" type="button">Give it back</button>' +
      '<div class="district-objective__flash"></div>';
    root.appendChild(this.objective);
    this.objectiveTask = this.objective.querySelector('.district-objective__task')!;
    this.objectivePips = this.objective.querySelector('.district-objective__pips')!;
    this.objectiveCap = this.objective.querySelector('.district-objective__cap')!;
    this.objectiveFlash = this.objective.querySelector('.district-objective__flash')!;
    this.objectiveDrop = this.objective.querySelector('.district-objective__drop')!;
    this.objectiveDrop.addEventListener('click', () => this.opts.onErrandAbandon?.());

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

    this.mapPanel = el('div', 'district-panel district-map');
    this.mapPanel.innerHTML =
      '<div class="district-map__cap"></div>' +
      '<canvas class="district-map__canvas"></canvas>' +
      '<div class="district-map__key">' +
      '<span class="district-map__swatch is-safe"></span>walkway' +
      '<span class="district-map__swatch is-you"></span>you' +
      '<span class="district-map__swatch is-exit"></span>road out' +
      '<span class="district-map__swatch is-pack"></span>pack' +
      '</div>';
    root.appendChild(this.mapPanel);
    this.mapCanvas = this.mapPanel.querySelector('.district-map__canvas')!;
    this.mapCaption = this.mapPanel.querySelector('.district-map__cap')!;

    const help = el('div', 'district-panel district-help');
    this.help = help;
    help.textContent =
      'WASD / arrows - move\nQ / E - orbit camera\nSpace - interact / advance\nM - map\nI - satchel\nEsc - menu / leave';
    root.appendChild(help);

    this.setZone(true);
    this.renderLedger();
  }

  /* ------------------------------------------------------------ objective */

/**
   * The objective panel, which now has two tenants.
   *
   * It used to belong to the guided lap alone and to go away for good once that was walked --
   * which left a panel, a caption and a slot of screen furniture doing nothing for the rest of
   * the game. An errand is exactly the same kind of statement ("here is the one thing you are
   * being asked to do"), so it moves in rather than a second panel being built beside it.
   *
   * The lap wins where both are live. It is the shorter of the two and it is teaching, and a
   * new Commander who takes a job off a townsperson should not have the instructions replaced
   * by it. The pips belong to the lap and are dropped when the errand has the panel, because
   * three marks that never light would read as an errand with steps.
   */
  renderObjective(flags: readonly TutorialFlag[], errands: ErrandState): void {
    const lap = tutorialActive(flags) ? currentObjective(flags) : null;
    const errand = lap ? null : errandObjective(errands);
    const task = lap ?? errand;
    if (!task) {
      this.objective.classList.add('is-hidden');
      return;
    }
    this.objective.classList.remove('is-hidden');
    this.objective.classList.toggle('is-errand', !lap);
    this.objectiveCap.textContent = lap ? 'OBJECTIVE' : 'ERRAND';
    this.objectiveTask.textContent = task;
    this.objectivePips.innerHTML = lap
      ? pipStates(flags)
          .map((p) => `<span class="district-pip${p.lit ? ' is-lit' : ''}">&#9672; ${p.label}</span>`)
          .join(' ')
      : '';
    // The release valve, and it is not a nicety.
    //
    // One errand open at a time is a good rule and it has a sharp edge: an errand that becomes
    // uncompletable locks the player out of the *entire* system, permanently, with no way to
    // say so. The cull is the case that made this real — the Combat Ring can drag the errand's
    // pack into somebody else's ambush, and a pack that has died is off the road for its whole
    // cooldown whether or not anybody got the credit.
    //
    // That particular hole is fixed. This is here because it was not the only one available:
    // any single-slot commitment needs a way out, and the honest one is free. Giving a job back
    // is not a failure state and does not cost anything -- the errand simply goes back on offer.
    this.objectiveDrop.classList.toggle('is-shown', !lap && !!task);
  }

  /**
   * A line that says something just happened, over the interact prompt.
   *
   * The district had nowhere to say "taken" -- `showNotice` is a modal that wants acknowledging
   * and this is a receipt. Clears itself, and is deliberately not queued: two of these in the
   * same second means the second one is what matters.
   */
  flashNotice(text: string): void {
    this.objectiveFlash.textContent = text;
    this.objectiveFlash.classList.add('is-shown');
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.objectiveFlash.classList.remove('is-shown');
    }, 2600);
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
        <div class="ledger__stat">
          <span class="ledger__label">The hour</span>
          <span class="ledger__value ledger__value--hour">${clockLabel(this.opts.hour())} · ${phaseAt(this.opts.hour())}</span>
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
        // A story poster is a briefing, not a button: the board says what the job is
        // and where, and the fight is launched by walking up to the ground the writ
        // names. Rolled work and the audit keep click-to-launch — placeless arena
        // work with no geography to walk to.
        const site = bounty.id.startsWith('story_') ? siteByEncounter(bounty.enemySeed) : undefined;
        const whereLine = site
          ? `The writ names ${areaById(site.areaId)?.name ?? site.areaId} — ${site.label}`
          : encounter
            ? `${encounter.name} · ${encounter.width}×${encounter.height}`
            : 'Location unknown';
        if (site) {
          return `
        <div class="bounty-card brass-panel bounty-card--${bounty.difficulty} bounty-card--writ">
          <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
          <span class="bounty-seal">Writ</span>
          <div class="bounty-card__tier">${bounty.difficulty}</div>
          <div class="bounty-card__title">${bounty.title}</div>
          <div class="bounty-card__where">${whereLine}</div>
          <div class="bounty-card__flavour">${bounty.flavour}</div>
          <div class="bounty-card__pay">
            <span class="bounty-card__coin bounty-card__coin--gold">${bounty.spoils.ducats ?? 0} d</span>
            ${
              bounty.spoils.marrowShards
                ? `<span class="bounty-card__coin bounty-card__coin--marrow">${bounty.spoils.marrowShards} shards</span>`
                : ''
            }
            ${reagents ? `<span class="bounty-card__coin bounty-card__coin--reagent">${reagents} cores</span>` : ''}
            ${bounty.wager ? `<span class="bounty-card__coin bounty-card__coin--marrow">stake ${bounty.wager} d</span>` : ''}
          </div>
        </div>`;
        }
        return `
        <button class="bounty-card brass-panel bounty-card--${bounty.difficulty}${
          bounty.audit ? ' bounty-card--audit' : ''
        }${open ? '' : ' is-locked'}" data-bounty="${bounty.id}"${open ? '' : ' disabled'}>
          <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
          ${bounty.audit ? '<span class="bounty-seal">Audit</span>' : ''}
          <div class="bounty-card__tier">${bounty.audit ? 'audit' : bounty.difficulty}</div>
          <div class="bounty-card__title">${bounty.title}</div>
          <div class="bounty-card__where">${whereLine}</div>
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


  /**
   * A stall on the street.
   *
   * The **third** renderer into the one overlay the Bounty Board and the Wildlands Gate already
   * share, for the reason `openHunts` states above and which applies again here: Escape closes
   * it, movement stays blocked while it is up, and the interact prompt behaves, all without a
   * third copy of that logic in `DistrictScreen`. Overlays that must never be open at once are
   * more honestly one overlay with several renderers.
   *
   * Deliberately not a `Screen`. Every trade in this game has been a door in Ashfall and a full
   * screen change, which is right for a shop you walk *into* — the Apothecary has a counter and
   * a fitting room. A stall is a person standing in a street, and stepping out of the world to
   * buy one Core off them would be the interface disagreeing with the fiction. You stay on the
   * street; the street goes quiet for a moment.
   *
   * Repainted rather than patched after every trade, on the same reasoning: the panel is a
   * dozen rows, it is rebuilt from scratch on open anyway, and a targeted update would have to
   * know which rows a purse of 90 Ducats had just made unaffordable.
   */
  openStall(stall: StallDef): void {
    this.boardOpen = true;
    this.boardPanel.classList.add('is-open');
    this.renderStall(stall);
  }

  private renderStall(stall: StallDef): void {
    const { overworld } = this.opts.global;
    const cores = stall.goods === 'cores';

    const rows = stallStock(stall)
      .map((id) => {
        const held = cores ? (overworld.economy.reagents[id] ?? 0) : 0;
        const price = cores ? corePrice(stall, id)!.buy : brewPrice(stall, id)!;
        const paid = cores ? corePrice(stall, id)!.sell : 0;
        const name = cores
          ? (reagentById(id)?.name ?? id)
          : (APOTHECARY_STOCK.find((s) => s.item.id === id)?.item.name ?? id);
        const blurb = cores
          ? (reagentById(id)?.blurb ?? '')
          : (APOTHECARY_STOCK.find((s) => s.item.id === id)?.blurb ?? '');
        const cannotBuy = buyRefusal(overworld, stall, id);
        const cannotSell = cores ? sellRefusal(overworld, stall, id) : 'not-stocked';

        return `
          <div class="stall-row brass-panel">
            <div class="stall-row__what">
              <div class="stall-row__name">${esc(name)}${
                held > 0 ? `<span class="stall-row__held">you hold ${held}</span>` : ''
              }</div>
              <div class="stall-row__blurb">${esc(blurb)}</div>
            </div>
            <div class="stall-row__deal">
              <button class="brass-btn stall-row__buy" data-buy="${esc(id)}"${
                cannotBuy ? ' disabled' : ''
              }>${cannotBuy === 'satchel-full' ? 'Satchel full' : `Buy · ${price} d`}</button>
              ${
                cores && paid > 0
                  ? `<button class="brass-btn stall-row__sell" data-sell="${esc(id)}"${
                      cannotSell ? ' disabled' : ''
                    }>Sell · ${paid} d</button>`
                  : ''
              }
            </div>
          </div>`;
      })
      .join('');

    this.boardPanel.innerHTML = `
      <div class="district-board__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <div class="district-board__head">
          <div class="district-board__title">${esc(stall.name)}</div>
          <div class="district-stall__purse">${overworld.economy.ducats} d</div>
          <button class="brass-btn district-board__close">Step away</button>
        </div>
        <div class="district-stall__line">${esc(stall.line)}</div>
        <div class="district-stall__rows">${rows}</div>
      </div>`;

    this.boardPanel
      .querySelector('.district-board__close')!
      .addEventListener('click', () => this.closeBoard());

    for (const node of this.boardPanel.querySelectorAll<HTMLButtonElement>('[data-buy]')) {
      node.addEventListener('click', () => {
        if (buyAt(overworld, stall, node.dataset.buy!)) {
          // Written before the shelf is redrawn, so a closed tab cannot lose a purchase the
          // player has already watched happen. The Apothecary's counter saves on the same beat.
          this.opts.onChange?.();
          this.renderStall(stall);
        }
      });
    }
    for (const node of this.boardPanel.querySelectorAll<HTMLButtonElement>('[data-sell]')) {
      node.addEventListener('click', () => {
        if (sellAt(overworld, stall, node.dataset.sell!)) {
          this.opts.onChange?.();
          this.renderStall(stall);
        }
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

  /* ------------------------------------------------------------ the map */

  get mapIsOpen(): boolean {
    return this.mapOpen;
  }

  toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    this.mapPanel.classList.toggle('is-open', this.mapOpen);
  }

  closeMap(): void {
    this.mapOpen = false;
    this.mapPanel.classList.remove('is-open');
  }

  /**
   * The area from above, with whatever is moving on it.
   *
   * Deliberately drawn from the `AreaDef` rather than from the scene: the grid *is* the
   * map, so there is no second description of the ward to fall out of step with the one
   * the collision and the paving already read. Anything the map shows wrong is the area
   * file being wrong, which is the only failure mode worth having.
   *
   * Called every frame while it is open, so the ground is baked once and blitted — six
   * hundred tiles redrawn to move one dot would be the most expensive thing on the glass.
   */
  drawMap(area: AreaDef, view: MapView): void {
    if (!this.mapOpen) return;

    const ground = this.bakeMapGround(area);
    const cell = this.mapCell;
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;

    this.mapCanvas.width = ground.width;
    this.mapCanvas.height = ground.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ground.width, ground.height);
    ctx.drawImage(ground, 0, 0);

    // World units to map pixels. The grid is the same grid `tileAt` reads, so a marker
    // landing on the wrong square means the position is wrong, not the drawing.
    const px = (x: number): number => ((x + area.halfX) / 4) * cell;
    const pz = (z: number): number => ((z + area.halfZ) / 4) * cell;

    const dot = (x: number, z: number, r: number, fill: string, ring?: string): void => {
      ctx.beginPath();
      ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (ring) {
        ctx.strokeStyle = ring;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // Where the roads leave. Drawn under everything that moves.
    for (const exit of area.exits) {
      const x = px(exit.x);
      const z = pz(exit.z);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#63e0c4';
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }

    // What is roaming, and how far it wanders. The circle is the roam radius from the
    // area file, so an overlap you can see here is an overlap the Combat Ring can use.
    for (const pack of view.packs) {
      const spec = (area.props.packs ?? []).find((p) => p.encounterId === pack.encounterId);
      if (spec) {
        ctx.beginPath();
        ctx.arc(px(spec.x), pz(spec.z), (spec.roam / 4) * cell, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(224, 68, 34, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      dot(pack.x, pack.z, 3, pack.hunting ? '#ff6a45' : '#c2603a', '#1b1720');
    }

    if (view.warden) {
      dot(view.warden.x, view.warden.z, 3.2, view.warden.alerted ? '#ff6a45' : '#d8b13a', '#1b1720');
    }

    // The errand, drawn as a ring rather than a dot: everything else on this map is a body
    // that moves, and a mark that means "a place" should not look like one of them.
    if (view.errand) {
      const ex = px(view.errand.x);
      const ez = pz(view.errand.z);
      ctx.beginPath();
      ctx.arc(ex, ez, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#e8c86a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ez, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c86a';
      ctx.fill();
    }

    // You, and which way you are looking — the camera's yaw rather than the body's, because
    // the map is oriented to the screen and that is the heading a player is steering by.
    const hx = px(view.player.x);
    const hz = pz(view.player.z);
    ctx.beginPath();
    ctx.moveTo(hx + Math.sin(view.yaw) * 7, hz + Math.cos(view.yaw) * 7);
    ctx.lineTo(hx - Math.sin(view.yaw) * 4, hz - Math.cos(view.yaw) * 4);
    ctx.strokeStyle = 'rgba(246, 236, 216, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    dot(view.player.x, view.player.z, 3.6, '#f6ecd8', '#1b1720');

    this.mapCaption.textContent = area.name.toUpperCase();
  }

  /**
   * The tiles, once.
   *
   * Colour is read off the legend the same way the paving is: `safe` decides the bright
   * one, because the whole point of looking at a map of this game is seeing where the rule
   * changes. Everything else is told apart by `tex`, so a new ground type shows up here
   * without the map having to be taught about it.
   */
  private bakeMapGround(area: AreaDef): HTMLCanvasElement {
    if (this.mapGround && this.mapGroundFor === area.id) return this.mapGround;

    const cell = Math.max(6, Math.min(16, Math.floor(Math.min(520 / area.cols, 360 / area.rows))));
    const canvas = document.createElement('canvas');
    canvas.width = area.cols * cell;
    canvas.height = area.rows * cell;
    const ctx = canvas.getContext('2d')!;

    for (let row = 0; row < area.rows; row++) {
      for (let col = 0; col < area.cols; col++) {
        const def = area.legend[area.grid[row]![col]!];
        ctx.fillStyle = def ? mapTileColor(def) : '#12151b';
        ctx.fillRect(col * cell, row * cell, cell, cell);
      }
    }

    this.mapGround = canvas;
    this.mapGroundFor = area.id;
    this.mapCell = cell;
    return canvas;
  }

  /* ------------------------------------------------------------ overlays */

  /**
   * The death notice: a Magistracy seal over the whole street until it is acknowledged.
   *
   * Modal on purpose. A player who lost a run to a fight they thought they could win
   * should have to look at the bill before the doors are in front of them again.
   */
  showNotice(notice: { title: string; body: string; ack?: string }, onAck: () => void): void {
    // The button used to say "Begin again" under every notice — a story reveal, a refused
    // contract, a bill — and read as a game-over under all of them. The notice names its
    // own acknowledgement now; the default is neutral.
    this.overlay.innerHTML = `
      <div class="hub-notice__card brass-panel">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="hub-notice__seal"></div>
        <div class="hub-notice__title">${notice.title}</div>
        <div class="hub-notice__body">${notice.body}</div>
        <button class="brass-btn hub-notice__ack">${notice.ack ?? 'Continue'}</button>
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

  /*
   * There was a `showBattle()` here: the word BATTLE, thrown up full-screen to cover the
   * swap from this three.js street to the 2D combat canvas. It is gone because there is no
   * longer a swap to cover — the board is laid on the ground the ring closed on and the same
   * scene carries straight through. `combat/Descent.ts` is what replaced it.
   */

  /**
   * The way out of a character: a small modal with the only two choices the street cannot
   * otherwise offer, carry on or go back to the title wall.
   *
   * It exists because there was no other exit. `onLeave` had been wired to the title screen
   * since the district was built and nothing ever invoked it, so a player who opened a
   * character could never switch to another, delete one, or reach the wall again without
   * clearing the browser's storage. Escape opens and closes it; the legend says so.
   *
   * Uses the same overlay as the death notice and refuses to open over one, so a bill is
   * never covered by a menu. Nothing here saves — progress is written as it happens.
   */
  showMenu(onLeave: () => void): void {
    if (this.overlayIsShown) return;
    this.overlay.innerHTML = `
      <div class="hub-notice__card brass-panel district-menu">
        <i class="rivet rivet--tl"></i><i class="rivet rivet--tr"></i>
        <i class="rivet rivet--bl"></i><i class="rivet rivet--br"></i>
        <div class="hub-notice__title district-menu__title">The Ward</div>
        <div class="hub-notice__body">Your progress is kept as you go. Leaving returns you to the title wall, where another commission can be opened or this one burned.</div>
        <div class="district-menu__actions">
          <button class="brass-btn district-menu__resume">Back to the street</button>
          <button class="brass-btn district-menu__leave">Leave to the title wall</button>
        </div>
      </div>`;
    this.overlay.classList.add('is-shown', 'is-menu');
    this.overlay.querySelector('.district-menu__resume')!.addEventListener('click', () => this.closeMenu());
    this.overlay.querySelector('.district-menu__leave')!.addEventListener('click', () => {
      this.closeMenu();
      onLeave();
    });
  }

  get menuIsOpen(): boolean {
    return this.overlay.classList.contains('is-menu');
  }

  closeMenu(): void {
    if (this.menuIsOpen) this.hideOverlay();
  }

  /** Whether anything at all — a bill, the Warden's hand, the menu — is over the street. */
  get overlayIsShown(): boolean {
    return this.overlay.classList.contains('is-shown');
  }

  hideOverlay(): void {
    this.overlay.classList.remove('is-shown', 'is-passive', 'is-menu');
    this.overlay.innerHTML = '';
  }

  /**
   * Puts the walk-time furniture away while a fight is on.
   *
   * The combat HUD is the full one — a hand, two gauges, the bone dial, the trays — and it
   * arrives on top of a screen that is still wearing the objective panel, the zone chip, the
   * interact prompt and the walking help. Two HUDs at once is unreadable, and the walking one
   * is answering questions nobody is asking mid-turn.
   *
   * Hidden rather than destroyed: the street is still there underneath and the player is
   * coming back to it, usually within a minute.
   */
  setCombat(on: boolean): void {
    for (const node of [
      this.objective,
      this.zoneChip,
      this.alert,
      this.prompt,
      this.ledger,
      this.help,
    ]) {
      node?.classList.toggle('is-hidden-in-combat', on);
    }
    // The map is a walking tool and its own overlay; a fight is not the time for it.
    if (on) this.closeMap();
  }

  destroy(): void {
    window.clearTimeout(this.flashTimer);
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

/** What the screen hands the map each frame. Positions in world units, as everything is. */
export interface MapView {
  player: { x: number; z: number };
  /** Camera yaw, because the map is oriented to the screen rather than to the body. */
  yaw: number;
  packs: readonly { encounterId: string; x: number; z: number; hunting: boolean }[];
  warden?: { x: number; z: number; alerted: boolean };
  /**
   * Where the open errand wants you, when it wants you in *this* area.
   *
   * The one thing the map does that could not be got at any other way. Being told to fetch
   * something from the Ashwood and then hunting a thirty-by-twenty-six wood tile by tile is
   * not an errand, it is a search; the marker is what turns the first into a walk.
   */
  errand?: { x: number; z: number };
}

/**
 * One tile's colour on the map.
 *
 * `safe` wins over everything, and brightly: a map of this game is mostly a map of where
 * the rule changes, so the pavement has to be the thing the eye lands on first. Below that
 * it goes by `tex`, which means a ground type added to an area shows up here without the
 * map being taught about it — the `default` is a legible grey rather than a hole.
 */
function mapTileColor(def: { safe: boolean; walk: boolean; tex: string }): string {
  if (!def.walk) return def.tex === 'water' ? '#16202b' : '#3d3830';
  if (def.safe) return '#b6a887';
  switch (def.tex) {
    case 'chalk':
      return '#6e6a5e';
    case 'field':
      return '#3a3426';
    case 'grass':
      return '#2a3327';
    case 'weeds':
      return '#2f3238';
    default:
      return '#282c33';
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
