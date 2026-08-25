/**
 * CombatScreen owns everything for one battle: the logic session, the canvas board,
 * the HUD, the sequencer, and the input controller.
 *
 * The one synchronisation rule of the whole app lives here: input is locked the moment
 * an action is dispatched and unlocked when the sequencer goes idle. That is precisely
 * the window in which view state equals logic state, which is what makes previews and
 * legality queries safe.
 */

import type { Screen } from './ScreenManager.js';
import type { Action, BoardView } from '../contract/query.js';
import type { CombatResult } from '../contract/events.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { CombatSession } from '../core/session.js';
import type { CombatCarry } from '../core/engine/setup.js';
import type { CombatOutcome } from '../core/overworld/run.js';
import { IsoCamera } from '../render/IsoCamera.js';
import { BoardRenderer, emptyOverlays, type Overlays } from '../render/BoardRenderer.js';
import { EntityViewMap } from '../render/EntityViews.js';
import { Fx } from '../render/Fx.js';
import { Sequencer } from '../anim/Sequencer.js';
import { registerHandlers, type CombatView } from '../anim/handlers.js';
import { Hud } from '../hud/Hud.js';
import { DeployTray } from '../hud/DeployTray.js';
import { Graveyard } from '../hud/Graveyard.js';
import { ChannelPicker } from '../hud/ChannelPicker.js';
import { AI_BEAT_MS, NORMAL_MOTION } from '../anim/Sequencer.js';
import { HelpOverlay } from '../hud/HelpOverlay.js';
import { Tutorial } from '../hud/Tutorial.js';
import { readWeather } from '../hud/weather.js';
import { cellsAt } from '../core/util/grid.js';
import { coordEq } from '../contract/ids.js';
import type { CommanderModel } from '../render/BoardRenderer.js';
import type { Coord } from '../contract/ids.js';
import type { GameState } from '../core/types/state.js';
import { calculateProjectedDamage } from '../hud/projection.js';

/** Below this share of the Pact, the presentation turns to panic. */
/**
 * A quarter of the gauge. Below this the room changes: the board drains of colour, the
 * edges close in red, and a heartbeat comes up under everything.
 */
const LAST_STAND_FRACTION = 0.25;
import type { AiProfile } from '../core/ai/controller.js';
import { easeOutQuad, tween } from '../anim/tween.js';

/** Plain-language summary of what passing right now would waste. */
function describeUnspent(p: { readyUnits: number; playableCards: number }): string {
  const parts: string[] = [];
  if (p.readyUnits > 0) {
    parts.push(p.readyUnits === 1 ? '1 unit can still act' : `${p.readyUnits} units can still act`);
  }
  if (p.playableCards > 0) {
    parts.push(
      p.playableCards === 1 ? '1 card is still playable' : `${p.playableCards} cards are still playable`,
    );
  }
  return parts.join(' and ');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
import { TargetingController } from '../hud/TargetingController.js';
import { Sfx } from '../sound/Sfx.js';

/**
 * Where the playback preference lives.
 *
 * Its own key rather than the save file: this is how somebody likes to *watch* the game,
 * not a fact about their character, and putting it in the save would mean a version bump
 * and a migration for a setting no rule reads. It is also why a missing or corrupt value
 * simply falls back to Normal rather than being repaired.
 */
const SPEED_KEY = 'conjure.speed';

function readSpeed(): 'normal' | 'fast' {
  try {
    return localStorage.getItem(SPEED_KEY) === 'fast' ? 'fast' : 'normal';
  } catch {
    // Private browsing, or storage disabled. The preference is not worth a crash.
    return 'normal';
  }
}

/** Coordinate equality that also accepts "both nowhere", for hover tracking. */
function coordEqOrBothNull(a: Coord | null, b: Coord | null): boolean {
  if (a === null || b === null) return a === b;
  return coordEq(a, b);
}

export class CombatScreen implements Screen {
  private session: CombatSession;
  private cam: IsoCamera;
  private views = new EntityViewMap();
  private sfx = new Sfx();

  private el: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: BoardRenderer | null = null;
  private hud: Hud | null = null;
  private targeting: TargetingController | null = null;
  private sequencer: Sequencer<CombatView> | null = null;
  /** How the player wants the enemy's turn played back. Read from storage on mount. */
  private speed: 'normal' | 'fast' = readSpeed();
  private fx: Fx | null = null;

  /**
   * Coalesced to one refit per frame.
   *
   * A drag-resize fires this continuously, and `renderer.resize()` reallocates the canvas
   * backing store every call -- so the unthrottled version did that work dozens of times
   * per second and cleared the canvas each time, which is visible as a flicker while
   * dragging a window edge.
   */
  private resizeFrame = 0;
  private onResize = () => {
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.renderer?.resize();
      this.reportViewportSize();
    });
  };
  /**
   * Watches the board's own box rather than the window.
   *
   * The window listener misses every resize that does not change the window: the Graveyard
   * drawer sliding in, a scrollbar appearing, the deploy tray mounting and unmounting. All
   * of those change how much room the canvas has, and before this the board simply stayed
   * fitted to a box it no longer occupied until the next window resize.
   */
  private boardObserver: ResizeObserver | null = null;
  private help: HelpOverlay | null = null;
  /** Board states to step back to. Client-side only; never part of the event stream. */
  private undoStack: GameState[] = [];
  /** True once End Turn has warned and is waiting for a confirming second click. */
  private armedEndTurn = false;
  /** Turn number the undo history belongs to, so it is dropped when the turn changes. */
  private turnStamp = 0;
  private warnedTooSmall = false;
  private tutorial: Tutorial | null = null;
  /** The deployment tray, alive only while the phase is. */
  private deploy: DeployTray | null = null;
  /** The Fallen Vanguard drawer. Alive for the whole fight; hides itself when empty. */
  private grave: Graveyard | null = null;
  /** The "channel how much power" modal, for variable-cost cards. */
  private channel: ChannelPicker | null = null;
  private onKeyDown = (ev: KeyboardEvent) => this.handleKeyDown(ev);
  private onKeyUp = (ev: KeyboardEvent) => this.handleKeyUp(ev);

  /**
   * Turntable drag: right or middle mouse held, dragged sideways to orbit the board.
   *
   * Held on the window rather than the canvas so a drag that wanders off the board keeps
   * working — letting go outside the canvas would otherwise strand the camera mid-turn.
   */
  private drag: { button: number; lastX: number; turned: number } | null = null;
  /**
   * Set the moment a right-drag actually turns the board, and read by the context-menu
   * handler so the same gesture does not also cancel the player's selection.
   *
   * A flag rather than an inspection of `drag`, because the two events arrive in either
   * order depending on the platform — Windows raises the context menu on release, others
   * on press — and this is true by the time either of them runs.
   */
  private swallowContextMenu = false;
  private onDragMove = (ev: MouseEvent) => this.handleDragMove(ev);
  private onDragEnd = () => this.endDrag();

  constructor(
    private readonly encounter: EncounterDef,
    private readonly onFinish: (
      result: CombatResult,
      encounter: EncounterDef,
      outcome: CombatOutcome,
    ) => void,
    companionId?: string,
    seed = Math.floor(Math.random() * 1e9),
    deck?: string[],
    ai?: AiProfile,
    carry?: CombatCarry,
    /**
     * The player's Vanguard, as def ids.
     *
     * An empty or omitted roster opens the fight on turn one with no deployment phase —
     * the pre-overhaul path, and the one every legacy test still takes.
     */
    roster?: string[],
  ) {
    this.session = new CombatSession(encounter, seed, ai, companionId, deck, carry, roster);
    this.cam = new IsoCamera(encounter.width, encounter.height);
  }

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--combat';
    el.innerHTML = `
      <canvas class="board"></canvas>
      <div class="floaters"></div>
    `;
    root.appendChild(el);
    this.el = el;

    const canvas = el.querySelector<HTMLCanvasElement>('.board')!;
    const floaters = el.querySelector<HTMLElement>('.floaters')!;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser');

    this.canvas = canvas;
    this.fx = new Fx(this.cam, floaters);
    this.renderer = new BoardRenderer(canvas, ctx, this.cam, this.views, this.fx);

    this.hud = new Hud(el, {
      onCardClick: (id) => this.targeting?.onCardClick(id),
      onCardHover: (id) => this.targeting?.onCardHover(id),
      onEndTurn: () => this.requestEndTurn(),
      onToggleSpeed: () => this.toggleSpeed(),
      onUndo: () => this.undo(),
      onToggleMute: () => this.sfx.toggleMute(),
      onToggleThreat: () => this.targeting?.toggleThreat() ?? false,
      onChannel: () => this.channelSelected(),
      onHelp: () => this.help?.toggle(),
      onRotate: (steps) => void this.rotate(steps),
      onLastStand: (active) => this.sfx.setHeartbeat(active),
    });

    this.targeting = new TargetingController(this.session, {
      commit: (action) => this.commit(action),
      setOverlays: (o) => this.setOverlays(o),
      setSelectedCard: (id) => this.hud?.setSelectedCard(id),
      setEnemyTargetable: (on) => {
        this.hud?.setEnemyTargetable(on);
        const boss = this.renderer?.commanders.find((c) => c.side === 'enemy');
        if (boss) boss.targetable = on;
      },
      notice: (text) => this.hud?.flashNotice(text),
      warn: (text) => this.hud?.setTargetWarning(text),
      askChannel: (card, affordable, then) => {
        const snap = this.session.getHand().find((c) => c.instanceId === card);
        if (!snap) {
          then(null);
          return;
        }
        this.channel?.ask(snap, affordable, (choice) => then(choice ? choice.x : null));
      },
      setAwaitingFallen: (spec) => this.grave?.setAwaiting(spec, this.session.getBoard()),
      setInspected: (unitId) => {
        this.hud?.showInspect(this.session.getBoard(), unitId);
        // Selection is the only thing that changes what Channel would apply to, so the
        // button's visibility rides along with it rather than polling every frame.
        this.hud?.setChannelAvailable(unitId !== null && this.session.canChannel(unitId));
      },
    });

    const view: CombatView = {
      views: this.views,
      fx: this.fx,
      sfx: this.sfx,
      hud: this.hud,
      renderer: this.renderer,
    };
    this.grave = new Graveyard(el, {
      onPick: (rosterIndex) => this.targeting?.onFallenPick(rosterIndex),
    });
    this.grave.sync(this.session.getBoard());
    this.channel = new ChannelPicker(el);

    this.sequencer = new Sequencer(view);
    // Label from the stored preference, not from the markup's default.
    this.hud.setSpeedLabel(this.speed);
    // And apply it now: without this the opening turn plays at the default motion
    // whatever the player last chose, since `applyBeat` otherwise waits for the first
    // enemy turn or a toggle.
    this.applyBeat();
    registerHandlers(this.sequencer);

    // The sky is read from the encounter rather than from board state: it is fixed when
    // combat begins and never changes, so there is nothing for the view contract to
    // carry and no core file to widen for the sake of a badge.
    const sky = readWeather(this.encounter.weather);
    this.hud.setWeather(sky);
    // Drives the atmospheric overlay. One attribute on the screen root, so the whole
    // effect is CSS and the renderer keeps its hands free for the tactical read.
    if (sky) el.dataset.sky = sky.slug;
    if (sky?.wind) {
      el.style.setProperty('--wind-x', String(Math.sign(sky.wind.x)));
      el.style.setProperty('--wind-y', String(Math.sign(sky.wind.y)));
    }
    this.sequencer.onIdle = () => this.onSequencerIdle();

    canvas.addEventListener('mousemove', (ev) => this.handleMouseMove(ev));
    canvas.addEventListener('click', (ev) => this.handleClick(ev));
    canvas.addEventListener('mouseleave', () => this.targeting?.onTileHover(null));
    canvas.addEventListener('mousedown', (ev) => this.handleDragStart(ev));
    canvas.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      // A right-click that turned the board was a camera gesture, not a cancel. Without
      // this, every orbit would also throw away whatever the player had selected.
      if (this.consumeDragGesture()) return;
      this.targeting?.onCancel();
    });

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Kept alongside the window listener rather than replacing it: the observer catches
    // layout changes, the window event catches a devicePixelRatio change on a monitor
    // switch, which does not alter the element's box at all.
    if (typeof ResizeObserver !== 'undefined') {
      this.boardObserver = new ResizeObserver(this.onResize);
      this.boardObserver.observe(canvas);
    }

    this.help = new HelpOverlay(root);

    // A first-time player gets the danger zone on by default and a short walkthrough.
    // Both are one keystroke from being turned off, and the tutorial never runs twice.
    if (!Tutorial.hasSeen()) {
      this.hud.setThreatActive(this.targeting.toggleThreat());
      this.tutorial = new Tutorial(root, () => {
        this.hud?.flashNotice('Press H for the rules at any time');
      });
      // Let the opening animation settle before pointing at anything.
      window.setTimeout(() => this.tutorial?.start(), 900);
    }

    this.renderer.resize();
    this.renderer.start();
    this.reportViewportSize();

    if (import.meta.env.DEV) {
      // Dev handle: lets a headless session force a frame and inspect state.
      (window as unknown as Record<string, unknown>).__conjure = {
        renderer: this.renderer,
        session: this.session,
        views: this.views,
        cam: this.cam,
        hud: this.hud,
        sequencer: this.sequencer,
        fx: this.fx,
      };
    }

    // Seed the board from the authoritative state, then animate the opening events.
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.syncCommanders(board);
    this.hud.setSchoolAccent(board.player.companionSchool);
    this.hud.syncFromBoard(board, this.session.getHand(), this.session.getPlayableCards());
    // At the opening bell too, not only after an action. Under the RPG model a character
    // routinely *starts* a contract already below the line — a wounded Pact carries from
    // the last fight — and a room that only turned red once you moved was telling you
    // something you needed before you decided to.
    this.refreshLastStand(board);
    this.hud.setInteractive(false);

    // A Vanguard came along, so the line is set before anything else happens. With no
    // roster the phase never starts and this is skipped entirely — the pre-overhaul path.
    if (board.phase === 'deployment') this.enterDeployment();

    this.sequencer.enqueue(this.session.openingEvents);
  }

  /** Last Stand is a property of the board, so it is asked wherever the board is read. */
  private refreshLastStand(board: BoardView): void {
    this.hud?.setLastStand(board.player.hp <= board.player.maxHp * LAST_STAND_FRACTION);
  }

  unmount(): void {
    this.grave?.destroy();
    this.grave = null;
    this.channel?.close();
    this.channel = null;
    this.renderer?.stop();
    this.hud?.destroy();
    // A screen torn down mid-drag would otherwise leave its window listeners behind.
    this.endDrag();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.boardObserver?.disconnect();
    this.boardObserver = null;
    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = 0;
    }
    this.help?.destroy();
    this.help = null;
    this.tutorial?.destroy();
    this.tutorial = null;
    this.el?.remove();
    this.el = null;
  }

  // ---------------------------------------------------------------- camera drag

  /** Radians turned per pixel dragged. A full turn is roughly the width of the board. */
  private static readonly RADIANS_PER_PIXEL = 0.01;
  /** Pixels of travel before a press counts as a drag rather than a click. */
  private static readonly DRAG_SLOP = 3;

  /**
   * Begins a turntable drag on right or middle mouse.
   *
   * Left is deliberately untouched: it selects units, aims cards and attacks, and a
   * camera control that fought with it would make the board feel unpredictable.
   */
  private handleDragStart(ev: MouseEvent): void {
    if (ev.button !== 1 && ev.button !== 2) return;
    if (this.cam.spinning) return;

    ev.preventDefault();
    this.drag = { button: ev.button, lastX: ev.clientX, turned: 0 };
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
  }

  private handleDragMove(ev: MouseEvent): void {
    const drag = this.drag;
    if (!drag || !this.renderer) return;

    // movementX is the honest figure where it exists; the fallback keeps this working
    // under synthetic events and browsers that leave it at zero.
    const delta = ev.movementX || ev.clientX - drag.lastX;
    drag.lastX = ev.clientX;
    if (delta === 0) return;

    drag.turned += Math.abs(delta);
    // Only a right-drag has a context menu to swallow; a middle-drag must not arm it, or
    // the next genuine right-click would be eaten instead of cancelling.
    if (drag.button === 2 && drag.turned >= CombatScreen.DRAG_SLOP) {
      this.swallowContextMenu = true;
    }
    this.cam.continuousRotation += delta * CombatScreen.RADIANS_PER_PIXEL;

    // Framing is recomputed rather than left alone: the board's centre stays put under
    // rotation, but the space it needs does not, and the swept extent keeps the zoom
    // steady while the drag is in flight.
    this.renderer.resize();

    // The board redraws itself every frame, so nothing needs forcing here — but the
    // DOM-anchored overlays do not ride the canvas, so they are settled as we go.
    this.targeting?.refreshOverlays();
  }

  private endDrag(): void {
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragEnd);
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.turned < CombatScreen.DRAG_SLOP) return;

    this.renderer?.resize();
    this.targeting?.refreshOverlays();
  }

  /** True if the gesture just finished turned the board. Reads once, then rearms. */
  private consumeDragGesture(): boolean {
    const swallow = this.swallowContextMenu;
    this.swallowContextMenu = false;
    return swallow;
  }

  // ---------------------------------------------------------------- input

  private handleMouseMove(ev: MouseEvent): void {
    if (!this.canvas || !this.renderer) return;
    if (this.cam.spinning) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const overCommander = this.renderer.commanderAt(x, y);
    this.canvas.style.cursor = overCommander?.targetable ? 'pointer' : 'crosshair';
    const tile = overCommander ? null : this.cam.screenToTile(x, y);

    // Deployment owns the board while it runs, and the targeting controller is asleep —
    // so the hover has to be tracked here or a held Behemoth would never learn where the
    // cursor is.
    if (this.deploying) {
      const moved = !coordEqOrBothNull(this.deployHover, tile);
      this.deployHover = tile;
      if (moved) this.paintAnchors();
      this.showBoardTip(overCommander, tile, ev.clientX, ev.clientY);
      return;
    }

    this.targeting?.onTileHover(tile);
    this.showBoardTip(overCommander, tile, ev.clientX, ev.clientY);
  }

  /**
   * Inspection on hover. A newcomer cannot read a unit's role off a coloured prism, so
   * anything on the board explains itself when the cursor rests on it.
   */
  private showBoardTip(
    commander: CommanderModel | null,
    tile: Coord | null,
    cx: number,
    cy: number,
  ): void {
    const tips = this.hud?.tips;
    if (!tips) return;

    if (commander) {
      const isFoe = commander.side === 'enemy';
      tips.showHtml(
        `<div class="tooltip__title">${escapeHtml(commander.name)}</div>
         <div class="tooltip__body">${
           isFoe
             ? 'Defeat them to win. Melee must be standing in their two red rows to strike.'
             : commander.kind === 'companion'
               ? 'Your Companion. Its lane is marked on the board — the first Companion card you play each turn fires its passive there.'
               : 'You. Your Hero and Companion share this health pool.'
         }</div>
         <div class="tooltip__detail">${commander.hp} / ${commander.maxHp} HP${
           commander.armor > 0 ? ` · ${commander.armor} Armor` : ''
         }</div>`,
        cx,
        cy,
      );
      return;
    }

    const board = this.session.getBoard();
    const unit = tile
      ? board.units.find((u) =>
          cellsAt(u.anchor, u.footprint).some((c) => c.x === tile.x && c.y === tile.y),
        )
      : undefined;

    if (!unit) {
      const obstacle = tile
        ? board.obstacles.find((o) => o.anchor.x === tile.x && o.anchor.y === tile.y)
        : undefined;
      if (obstacle) {
        tips.showHtml(
          `<div class="tooltip__title">${escapeHtml(obstacle.name)}</div>
           <div class="tooltip__body">Blocks line of sight and movement. Either side may break it.</div>
           <div class="tooltip__detail">${obstacle.hp} HP</div>`,
          cx,
          cy,
        );
        return;
      }
      tips.hide();
      return;
    }

    const statuses = board.statuses
      .filter((s) => s.unitId === unit.id)
      .map((s) => `${s.kind} ${s.stacks}`)
      .join(' · ');

    tips.showHtml(
      `<div class="tooltip__title">${escapeHtml(unit.name)}${
        unit.side === 'enemy' ? ' <span style="color:#fca5a5">(enemy)</span>' : ''
      }</div>
       <div class="tooltip__body">${unit.atk} Attack · ${unit.hp}/${unit.maxHp} Health · Moves ${unit.mov}${
         unit.rangeMax > 1 ? ` · Range ${unit.rangeMin}–${unit.rangeMax}` : ' · Melee'
       }</div>
       ${
         unit.keywords.length
           ? `<div class="tooltip__detail">${unit.keywords.join(' · ')}</div>`
           : ''
       }
       ${unit.armor > 0 ? `<div class="tooltip__detail">${unit.armor} Armor absorbs damage first</div>` : ''}
       ${statuses ? `<div class="tooltip__detail">${escapeHtml(statuses)}</div>` : ''}
       ${unit.escalation > 0 ? `<div class="tooltip__detail">Grown ${unit.escalation}×</div>` : ''}`,
      cx,
      cy,
    );
  }

  private handleClick(ev: MouseEvent): void {
    if (!this.canvas || !this.renderer) return;
    if (this.cam.spinning) return;
    this.sfx.unlock();
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Deployment owns the board while it runs: no card is selectable, no unit may move,
    // and neither commander is a legal target — so it is asked *before* the commander
    // hit-test, which otherwise swallows any anchor tile drawn under a portrait. On a
    // small viewport that is most of the back row.
    if (this.deploying) {
      this.handleDeploymentClick(this.cam.screenToTile(x, y) ?? null);
      return;
    }

    // Commanders stand beside the grid, so test them before falling through to tiles.
    const commander = this.renderer.commanderAt(x, y);
    if (commander) {
      if (commander.side === 'enemy') this.targeting?.onEnemyCommanderClick();
      else this.targeting?.onCancel();
      return;
    }

    const tile = this.cam.screenToTile(x, y);
    if (tile) this.targeting?.onTileClick(tile);
    else this.targeting?.onCancel();
  }

  /**
   * Selects the next unit that can still act, wrapping around.
   *
   * Starts from whoever is selected so repeated presses walk the list rather than
   * bouncing between two units. The board is small enough that centring the camera is
   * unnecessary — every tile is already on screen — so this only moves the selection.
   */
  private cycleNextReadyUnit(): void {
    if (this.sequencer?.busy || this.session.activeSide !== 'player') return;

    const ready = this.session.getReadyUnits();
    if (ready.length === 0) {
      this.hud?.flashNotice('No unit has an action left — press Enter to end your turn');
      return;
    }

    const current = this.targeting?.selectedUnit ?? null;
    const index = current ? ready.indexOf(current) : -1;
    const next = ready[(index + 1) % ready.length]!;

    this.targeting?.selectUnit(next);
    this.armedEndTurn = false;
    this.refreshTurnUi();
  }

  /**
   * Keeps the End Turn button honest about what passing would cost.
   *
   * The most common self-inflicted loss in a tactics game is ending a turn with actions
   * unspent, so the button says so and asks twice. Re-evaluated after every action, since
   * spending the last one should quietly return it to normal.
   */
  // ------------------------------------------------------------------ deployment

  /** Whether the fight is still being set up rather than played. */
  /** The tile under the cursor while the line is being set. Null off the board. */
  private deployHover: Coord | null = null;

  private get deploying(): boolean {
    return this.session.getBoard().phase === 'deployment';
  }

  /**
   * Raises the tray and puts the screen into placement mode.
   *
   * The HUD is hidden rather than disabled: during deployment there is no hand, no Pip to
   * spend and no turn to end, so leaving it up would be showing the player four controls
   * that all refuse them.
   */
  private enterDeployment(): void {
    if (!this.el || this.deploy) return;
    this.el.classList.add('is-deploying');

    this.deploy = new DeployTray(this.el, {
      onSelect: () => this.paintAnchors(),
      onEngage: () => this.commit({ type: 'finishDeployment' }),
    });
    this.deploy.sync(this.session.getBoard());
    this.paintAnchors();
  }

  /** Drops the tray once the line is set. Idempotent, so a double-finish is harmless. */
  private exitDeployment(): void {
    if (!this.deploy) return;
    this.deploy.destroy();
    this.deploy = null;
    this.el?.classList.remove('is-deploying');
    this.setOverlays(emptyOverlays());
  }

  /**
   * Lights the ground a body may stand on.
   *
   * Every anchor is shown from the moment the tray comes up, not only once something is
   * held: the shape of the ground is the decision the phase is asking about, and hiding it
   * until after the player commits to a body asks them to choose blind. Holding a body
   * narrows the lit set to what that body could actually take.
   */
  private paintAnchors(): void {
    const board = this.session.getBoard();
    const held = this.deploy?.selectedDefId ?? null;
    const free = board.anchors.filter((a) => this.session.canDeploy(held, a));

    // The ground a *Behemoth* would actually take, under the cursor.
    //
    // An Anchor Tile is one tile and a 2x2 body is four, so lighting the anchor alone told
    // a player they were placing something the size of a Footman. The impact zone is the
    // honest answer, and it is the same overlay a card's area of effect uses — placing a
    // body and casting a spell are the same question about where a thing lands.
    const size = held
      ? (board.roster.find((r) => r.defId === held && r.status === 'reserve')?.footprint ?? 1)
      : 1;
    const over =
      this.deployHover && size === 2 && free.some((a) => coordEq(a, this.deployHover!))
        ? cellsAt(this.deployHover, 2)
        : [];

    this.setOverlays({
      ...emptyOverlays(),
      highlight: held ? free : board.anchors,
      impact: over,
      selected: null,
    });
  }

  /**
   * A click on the board while the line is being set.
   *
   * Two gestures, told apart by what is under the cursor: an empty anchor takes the held
   * body, and a body already down is picked back up. Returns whether the click was
   * consumed, so the ordinary targeting path is never reached during deployment.
   */
  private handleDeploymentClick(tile: Coord | null): boolean {
    if (!this.deploying) return false;
    if (!tile) {
      this.deploy?.clearSelection();
      this.paintAnchors();
      return true;
    }

    const board = this.session.getBoard();

    // A body of ours standing here: take it back. Asked before placement, so clicking a
    // filled anchor recalls rather than failing to deploy onto it.
    const standing = board.units.find(
      (u) => u.side === 'player' && u.anchor.x === tile.x && u.anchor.y === tile.y,
    );
    const entry = standing && board.roster.find((r) => r.unitId === standing.id);
    if (entry) {
      this.commit({ type: 'recallUnit', unit: standing!.id });
      return true;
    }

    const held = this.deploy?.selectedDefId ?? null;
    if (!held) {
      this.hud?.flashNotice('Pick a body from the tray first');
      return true;
    }

    const refusal = this.session.deployRefusal(held, tile);
    if (refusal) {
      this.hud?.flashNotice(refusal);
      return true;
    }

    this.commit({ type: 'deployUnit', defId: held, at: tile });
    return true;
  }

  private refreshTurnUi(): void {
    const potential = this.session.getUnspentPotential();
    const wasted = potential.readyUnits + potential.playableCards;

    this.hud?.setUndoAvailable(this.canUndo);
    this.hud?.setEndTurnWarning(this.armedEndTurn ? 'armed' : wasted > 0 ? 'warn' : 'none', potential);
  }

  /**
   * Two-click End Turn, but only when there is something to lose.
   *
   * With nothing unspent it passes on the first click — nagging a player who has already
   * done everything is its own kind of friction.
   */
  private requestEndTurn(): void {
    if (this.sequencer?.busy || this.session.activeSide !== 'player') return;

    const potential = this.session.getUnspentPotential();
    const wasted = potential.readyUnits + potential.playableCards;

    if (wasted > 0 && !this.armedEndTurn) {
      this.armedEndTurn = true;
      this.hud?.flashNotice(describeUnspent(potential) + ' — click again to end your turn');
      this.refreshTurnUi();
      return;
    }

    this.armedEndTurn = false;
    this.commit({ type: 'endTurn' });
  }

  /**
   * Undo is movement-only, and only until something irreversible happens.
   *
   * Positioning is where a tactical mistake is cheapest to make and most annoying to
   * live with — misjudging a diagonal should not cost a turn. Attacks and card plays are
   * final because they reveal information and resolve dice-free consequences; being able
   * to take them back would turn the turn into a search rather than a decision.
   */
  private recordUndo(action: Action): void {
    if (action.type === 'moveUnit') {
      this.undoStack.push(this.session.snapshot());
      return;
    }
    // Everything else is a commitment. Once made, the moves that set it up are part of
    // that commitment and cannot be unpicked from underneath it.
    this.undoStack.length = 0;
  }

  get canUndo(): boolean {
    return (
      this.undoStack.length > 0 &&
      !this.sequencer?.busy &&
      !this.session.isOver() &&
      this.session.activeSide === 'player'
    );
  }

  /** Steps back to the board as it stood before the last move. */
  private undo(): void {
    if (!this.canUndo) return;
    const previous = this.undoStack.pop();
    if (!previous) return;

    this.session.restore(previous);
    this.targeting?.reset();

    // Snapped, not animated: an undo is a correction, and watching a unit walk backwards
    // would read as another move rather than as the removal of one.
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.syncMarksAndStatuses(board);
    this.syncCommanders(board);
    this.hud?.syncFromBoard(board, this.session.getHand(), this.session.getPlayableCards());
    this.refreshTurnUi();
    this.sfx.play('card');
  }

  /**
   * Turns the board a quarter-turn.
   *
   * The logical step flips first, so picking and depth sorting are correct from the very
   * next frame; the visual spin then unwinds from the old angle to the new one. Doing it
   * the other way round would leave a window where the board on screen and the board the
   * mouse is hitting disagree.
   */
  private async rotate(steps: number): Promise<void> {
    if (!this.renderer || this.cam.spinning) return;

    // A quarter-turn after a free drag tidies up first, so Q and E always leave the board
    // square to the screen rather than a quarter-turn from wherever it was left pointing.
    if (this.cam.freeRotated) this.cam.snapToNearestStep();

    this.cam.rotateBy(steps);
    this.renderer.resize();

    // Start fully counter-rotated, then relax to zero.
    const from = -steps * (Math.PI / 2);
    this.cam.spin = from;
    this.sfx.play('card');

    await tween(260, easeOutQuad, (k) => {
      this.cam.spin = from * (1 - k);
    });
    this.cam.spin = 0;

    // Overlays are recomputed against the new orientation: board-anchored DOM floaters
    // do not follow a canvas transform, so they need settling once the spin is done.
    this.targeting?.refreshOverlays();
  }

  /**
   * Tells the player when the window is simply too small, rather than silently drawing
   * a board whose tiles are too fine to aim at. Said once per session, not every resize.
   */
  private reportViewportSize(): void {
    // Re-armed once the board is readable again, so a player who enlarges the window and
    // later shrinks it is told a second time. The latch is there to stop the notice firing
    // on every frame of a drag-resize, not to ration it to one per fight -- and a warning
    // that never comes back is indistinguishable from one that was never wired up.
    if (!this.cam.tooSmall) {
      this.warnedTooSmall = false;
      return;
    }
    if (this.warnedTooSmall) return;
    this.warnedTooSmall = true;
    this.hud?.flashNotice('Window is small — enlarge it for a readable board');
  }

  private handleKeyDown(ev: KeyboardEvent): void {
    // The modal owns the keyboard while it is open, or Esc would cancel the targeting
    // underneath it and leave the dialog floating over nothing.
    if (this.channel?.open && this.channel.handleKey(ev.key)) {
      ev.preventDefault();
      return;
    }
    if (ev.key === 'h' || ev.key === 'H') {
      this.help?.toggle();
      return;
    }
    // While the reference is open it swallows everything but its own dismissal.
    if (this.help?.isOpen) {
      if (ev.key === 'Escape') this.help.hide();
      return;
    }
    if (ev.key === 'z' || ev.key === 'Z' || ev.key === 'Backspace') {
      ev.preventDefault();
      this.undo();
      return;
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      this.cycleNextReadyUnit();
      return;
    }
    if (ev.key === 'q' || ev.key === 'Q') {
      void this.rotate(-1);
      return;
    }
    if (ev.key === 'e' || ev.key === 'E') {
      void this.rotate(1);
      return;
    }
    if (ev.key === 'f' || ev.key === 'F') {
      this.hud?.setSpeedLabel(this.toggleSpeed());
      return;
    }
    if (ev.key === 't' || ev.key === 'T') {
      this.hud?.setThreatActive(this.targeting?.toggleThreat() ?? false);
      return;
    }
    if (ev.key === 'c' || ev.key === 'C') {
      this.channelSelected();
      return;
    }
    if (ev.key === 'Shift') this.targeting?.setExpanded(true);
    if (ev.key === 'Escape') this.targeting?.onCancel();
    if (ev.code === 'Space') {
      ev.preventDefault();
      this.sequencer?.fastForward(true);
    }
    if (ev.key === 'Enter' && !this.sequencer?.busy) this.requestEndTurn();
  }

  private handleKeyUp(ev: KeyboardEvent): void {
    if (ev.key === 'Shift') this.targeting?.setExpanded(false);
    if (ev.code === 'Space') this.sequencer?.fastForward(false);
  }

  private setOverlays(overlays: Overlays): void {
    if (this.renderer) this.renderer.overlays = overlays;
  }

  // ---------------------------------------------------------------- flow

  /**
   * Channel the selected unit. The engine owns the legality rules, so an ineligible unit
   * is refused there and the reason is surfaced as a notice rather than restated here.
   */
  private channelSelected(): void {
    const unit = this.targeting?.selectedUnit ?? null;
    if (!unit) {
      this.hud?.flashNotice('Select a unit first — C extracts Marrow instead of attacking');
      return;
    }
    this.commit({ type: 'channel', unit });
  }

  private commit(action: Action): void {
    if (!this.sequencer || this.sequencer.busy) return;
    if (this.session.isOver()) return;
    if (this.session.activeSide !== 'player') return;

    this.sfx.unlock();
    this.recordUndo(action);
    // Any deliberate action clears a pending End Turn confirmation: the player has
    // demonstrably found something else to do, so the warning has served its purpose.
    this.armedEndTurn = false;

    this.lockInput();

    let events;
    try {
      events = this.session.dispatch(action);
    } catch (err) {
      this.hud?.flashNotice(err instanceof Error ? err.message : 'Illegal action');
      this.unlockInput();
      return;
    }

    this.sequencer.enqueue(events);
  }

  private lockInput(): void {
    // A pending choice belongs to a turn the player still had. Taking input away closes
    // it rather than leaving a dialog over a board that has moved on.
    this.channel?.close();
    this.targeting?.setEnabled(false);
    this.hud?.setInteractive(false);
    this.deploy?.setInteractive(false);
    this.setOverlays(emptyOverlays());
  }

  private unlockInput(): void {
    // Still setting up: refresh the tray and the lit ground, and leave the turn UI alone —
    // there is no hand to sync and no End Turn to warn about yet.
    if (this.deploying) {
      this.deploy?.sync(this.session.getBoard());
      this.deploy?.setInteractive(true);
      this.paintAnchors();
      this.syncCommanders(this.session.getBoard());
      return;
    }
    // The line has just been set: drop the tray before the ordinary turn UI comes up.
    if (this.deploy) this.exitDeployment();

    if (this.session.activeSide === 'player' && this.session.getBoard().phase === 'action') {
      // A fresh turn carries no history: the moves that could be taken back belong to a
      // turn that has already been handed over.
      if (this.turnStamp !== this.session.getBoard().turn) {
        this.turnStamp = this.session.getBoard().turn;
        this.undoStack.length = 0;
        this.armedEndTurn = false;
      }
    }
    const board = this.session.getBoard();
    this.hud?.syncFromBoard(board, this.session.getHand(), this.session.getPlayableCards());
    this.syncCommanders(board);
    // The selection survives an action but its legality may not — a unit that just
    // channelled is still selected and must stop being offered the button.
    const selected = this.targeting?.selectedUnit ?? null;
    this.hud?.setChannelAvailable(selected !== null && this.session.canChannel(selected));
    this.hud?.setIncoming(
      calculateProjectedDamage(board),
      this.session.getThreat().commanderThreatCount,
    );
    this.refreshLastStand(board);
    this.grave?.sync(board);
    // Undo availability and the End Turn warning are both properties of the turn as it
    // now stands, so they are recomputed every time control comes back to the player.
    this.refreshTurnUi();
    this.hud?.setInteractive(true);
    this.targeting?.setEnabled(true);
  }

  /**
   * Places the Hero, Companion and enemy Commander one row beyond each end of the grid.
   * They are on the field but never on it, which is what makes melee reach legible.
   */
  private syncCommanders(board: ReturnType<CombatSession['getBoard']>, targetable = false): void {
    if (!this.renderer) return;

    const nearRow = board.height + 0.35;
    const farRow = -1.35;

    // The Companion cannot stand in two places at once. Once its Bound Form is on the
    // board, the off-grid model is the stale one and is dropped.
    const embodied = board.units.some(
      (u) => u.side === 'player' && u.keywords.includes('BoundForm'),
    );
    const enemyEmbodied = board.units.some(
      (u) => u.side === 'enemy' && u.keywords.includes('BoundForm'),
    );

    this.renderer.commanders = [
      {
        side: 'player',
        kind: 'hero',
        name: board.player.name,
        school: 'arcane',
        at: { x: board.player.heroColumn, y: nearRow },
        hp: board.player.hp,
        maxHp: board.player.maxHp,
        armor: board.player.armor,
        targetable: false,
      },
      ...(embodied
        ? []
        : [
            {
              side: 'player' as const,
              kind: 'companion' as const,
              name: board.player.companionName ?? 'Companion',
              school: board.player.companionSchool,
              at: { x: board.player.companionColumn, y: nearRow },
              hp: board.player.hp,
              maxHp: board.player.maxHp,
              armor: board.player.armor,
              targetable: false,
            },
          ]),
      // The enemy Commander is drawn off-grid only while nothing represents it on the
      // board. Once it has a Bound Form, the off-grid model is the stale one — the same
      // rule the player's Companion follows.
      //
      // A rout has no enemy Commander at all, so there is nothing to stand on the dais and
      // the same escape hatch drops it. Drawing a crowned figure the player cannot target
      // would be the screen inventing an opponent the rules do not have.
      ...(enemyEmbodied || board.rout
        ? []
        : [
            {
              side: 'enemy' as const,
              kind: 'boss' as const,
              name: board.enemy.name,
              school: board.enemy.companionSchool,
              at: { x: Math.floor((board.width - 1) / 2), y: farRow },
              hp: board.enemy.hp,
              maxHp: board.enemy.maxHp,
              armor: board.enemy.armor,
              targetable,
            },
          ]),
    ];

    this.renderer.resonanceLane = board.player.resonanceUsed
      ? null
      : board.player.companionColumn;
    this.renderer.territoryDepth = board.territoryDepth;
  }

  /**
   * Called whenever the animation queue empties. This is the only place the turn can
   * advance, which keeps view state and logic state in lockstep.
   */
  private onSequencerIdle(): void {
    if (this.session.isOver()) {
      const result = this.session.result;
      if (result) {
        this.hud?.setInteractive(false);
        this.targeting?.setEnabled(false);
        // Read the Pact now rather than inside the timeout: nothing can move the board
        // once the result is set, but taking it at the moment of the bell keeps what is
        // reported and what ended the fight the same instant.
        const roster = this.session.rosterOutcome;
        const outcome: CombatOutcome = {
          pactHp: this.session.pactHp,
          encounteredUnitIds: this.session.encounteredEnemies,
          defeatedUnitIds: this.session.defeatedEnemies,
          mastery: this.session.mastery,
          rosterSurvivors: roster.survivors,
          rosterFallen: roster.fallen,
        };
        window.setTimeout(() => this.onFinish(result, this.encounter, outcome), 900);
      }
      return;
    }

    // Re-sync the view from the authoritative board: cheap insurance against any
    // drift introduced by a skipped animation.
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.syncMarksAndStatuses(board);

    if (this.session.activeSide === 'enemy') {
      this.hud?.setInteractive(false);
      this.targeting?.setEnabled(false);
      // Let the "enemy turn" banner land before the AI starts acting.
      // Set before the batch is queued: the drain starts synchronously inside `enqueue`.
      this.applyBeat();
      window.setTimeout(() => {
        const events = this.session.runAiTurn();
        if (events.length > 0) this.sequencer?.enqueue(events);
        else this.unlockInput();
      }, 260);
      return;
    }

    this.unlockInput();
  }

  /**
   * Flips Normal and Fast, and returns what it now is.
   *
   * Only the *beat* changes. The animations themselves keep their designed durations in
   * both modes: Fast is the original pace, which was never too quick to see — what was
   * missing was the gap between one enemy action and the next.
   *
   * Safe to hit mid-turn. `setBeat` writes a number the drain loop reads fresh before each
   * pause, so a flip changes the next gap and leaves everything already queued exactly
   * where it was.
   */
  private toggleSpeed(): 'normal' | 'fast' {
    this.speed = this.speed === 'fast' ? 'normal' : 'fast';
    try {
      localStorage.setItem(SPEED_KEY, this.speed);
    } catch {
      // Not worth a crash; the session keeps the setting either way.
    }
    // Re-apply against the side currently acting, so a flip during the enemy's turn takes
    // effect on their next action rather than at the start of the following turn.
    this.applyBeat();
    return this.speed;
  }

  /**
   * Sets the pause between actions for whoever is acting.
   *
   * Only the enemy is paced. The player's own plays are already gated behind their own
   * clicks — pausing between the steps of something they just did would be the game
   * waiting on itself.
   */
  private applyBeat(): void {
    const normal = this.speed === 'normal';
    const enemyActing = this.session.activeSide === 'enemy';

    // The beat is the enemy's alone: the player's own plays are already gated behind their
    // own clicks, and pausing between the steps of something they just did would be the
    // game waiting on itself.
    this.sequencer?.setBeat(enemyActing && normal ? AI_BEAT_MS : 0);

    // The stretch is not. A blow landing is worth watching whoever threw it, and having
    // the player's own cascades snap while the enemy's glide would read as two games.
    this.sequencer?.setMotion(normal ? NORMAL_MOTION : 1);
  }

  private syncMarksAndStatuses(board: ReturnType<CombatSession['getBoard']>): void {
    for (const view of this.views.all()) {
      view.mark = null;
      view.statuses = [];
      view.escalation = 0;
    }
    for (const r of board.marks) {
      const v = this.views.get(r.hostId);
      if (v) v.mark = { school: r.mark.school };
    }
    for (const s of board.statuses) {
      const v = this.views.get(s.unitId);
      if (v) v.statuses.push({ kind: s.kind, stacks: s.stacks });
    }
    for (const e of board.escalation) {
      const v = this.views.get(e.unitId);
      if (v) v.escalation = e.stacks;
    }
  }
}
