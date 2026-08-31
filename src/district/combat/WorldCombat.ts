/**
 * One fight, played on the road it started on.
 *
 * This owns everything a battle needs *except* the ground it stands on and the camera looking
 * at it, both of which belong to the district. The engine, the sequencer, the animation
 * handlers, the HUD, the trays and the targeting controller are all the same objects the 2D
 * board uses, unchanged: `CombatSession` is a pure reducer, `EntityViewMap` speaks fractional
 * tile coordinates, `TargetingController` speaks `Coord` and has no camera at all, and `Fx`
 * needed only a projection to point at. What is new here is the three layers that draw —
 * `BoardMesh`, `BodyLayer`, `OverlayCanvas` — and the wiring below.
 *
 * ## The one synchronisation rule
 *
 * Input is locked the moment an action is dispatched and unlocked when the sequencer goes
 * idle. That window is precisely when view state equals logic state, which is what makes
 * every preview and legality query in the game safe to ask. It is the most important
 * invariant in the app and it is **currently written twice**: here, and in
 * `app/CombatScreen.ts`. That is a deliberate, temporary duplication rather than an oversight
 * — see the note at the foot of this file for why, and for what to do about it.
 */

import * as THREE from 'three';
import type { Action, BoardView } from '../../contract/query.js';
import type { Coord, Side, UnitId } from '../../contract/ids.js';
import type { CombatResult } from '../../contract/events.js';
import type { CombatOutcome } from '../../core/overworld/run.js';
import type { EncounterDef } from '../../core/data/encounters/registry.js';
import type { CombatCarry } from '../../core/engine/setup.js';
import type { AiProfile } from '../../core/ai/controller.js';
import { CombatSession } from '../../core/session.js';
import { EntityViewMap } from '../../render/EntityViews.js';
import { Fx } from '../../render/Fx.js';
import { emptyOverlays, type Overlays, type TetherModel } from '../../render/BoardRenderer.js';
import { Sequencer, AI_BEAT_MS, NORMAL_MOTION } from '../../anim/Sequencer.js';
import { registerHandlers, type CombatView, type TetherSink } from '../../anim/handlers.js';
import { Hud } from '../../hud/Hud.js';
import { DeployTray } from '../../hud/DeployTray.js';
import { Graveyard } from '../../hud/Graveyard.js';
import { ChannelPicker } from '../../hud/ChannelPicker.js';
import { HelpOverlay } from '../../hud/HelpOverlay.js';
import { TargetingController } from '../../hud/TargetingController.js';
import { calculateProjectedDamage } from '../../hud/projection.js';
import { Sfx } from '../../sound/Sfx.js';
import { cellsAt } from '../../core/util/grid.js';
import { companionByUnitCard } from '../../core/data/companions.js';
import { drawBodyFurniture } from '../../render/shapes.js';
import { BoardMesh } from './BoardMesh.js';
import { BodyLayer } from './BodyLayer.js';
import { OverlayCanvas, PX_TO_WORLD } from './OverlayCanvas.js';
import { placeBoard, type WorldBoard } from './WorldBoard.js';
import type { AreaDef } from '../map.js';

/**
 * How tall a body stands, in the screen pixels the animation handlers speak.
 *
 * `BodyLayer` stands an ordinary body 1.9 world units tall and `PX_TO_WORLD` is 0.035, so this
 * is that height expressed in the one unit `OverlayCanvas.tileCenter` accepts. It comes out at
 * very nearly the 54 pixels the 2D board draws a body at, which is a coincidence and not a
 * dependency -- both were chosen against a tile.
 */
const BODY_PX = 1.9 / PX_TO_WORLD;

/** Below this share of the Pact the presentation turns to panic. Mirrors `CombatScreen`. */
const LAST_STAND_FRACTION = 0.25;

/** How the player likes to watch the game. The same key the 2D board reads. */
const SPEED_KEY = 'conjure.speed';

function readSpeed(): 'normal' | 'fast' {
  try {
    return localStorage.getItem(SPEED_KEY) === 'fast' ? 'fast' : 'normal';
  } catch {
    return 'normal';
  }
}

export interface WorldCombatOpts {
  /** Where the HUD and the overlay canvas are parented. The district's own root. */
  root: HTMLElement;
  /** The scene the board and the bodies are added to. */
  scene: THREE.Scene;
  /** The camera the overlay projects through, and the yaw the billboards face. */
  camera: THREE.Camera;
  /** The area the fight is happening in, for placing the board on its tiles. */
  area: AreaDef;
  /** Where the ring closed. The board is seated as near to this as the ground allows. */
  at: { x: number; z: number };
  /** Filtering limit for painted art. */
  maxAnisotropy: number;

  encounter: EncounterDef;
  seed: number;
  companionId: string;
  companionShiny?: boolean;
  deck?: string[];
  ai?: AiProfile;
  carry?: CombatCarry;
  roster?: string[];
  /** Squads the Combat Ring dragged in, one array of card ids per pulled mob. */
  wave2?: string[][];

  onFinish: (result: CombatResult, encounter: EncounterDef, outcome: CombatOutcome) => void;
  /**
   * A quarter-turn of the view, asked for with the HUD's two arrows.
   *
   * The board out here cannot turn -- it is lying on a road, with buildings around it -- so
   * what the arrows move is the camera, which is the district's and not ours. Same gesture,
   * same two buttons, and the one the player already knows from the 2D board.
   */
  onRotate?: (steps: number) => void;
}

export class WorldCombat {
  readonly session: CombatSession;
  /** The board's footprint, so the district can frame a camera on it and fade what it hides. */
  readonly board: WorldBoard;

  private readonly views = new EntityViewMap();
  private readonly sfx = new Sfx();
  private readonly fx: Fx;
  private readonly overlay: OverlayCanvas;
  private readonly mesh: BoardMesh;
  private readonly bodies: BodyLayer;
  private readonly sequencer: Sequencer<CombatView>;
  private readonly hud: Hud;
  private readonly targeting: TargetingController;
  private readonly grave: Graveyard;
  private readonly channel: ChannelPicker;
  private readonly help: HelpOverlay;
  private deploy: DeployTray | null = null;

  /** The tether the handlers hang on us. Drawn by `drawFurniture`. */
  private readonly tetherSink: TetherSink = { tether: null };

  private speed: 'normal' | 'fast' = readSpeed();
  private undoStack: ReturnType<CombatSession['snapshot']>[] = [];
  private armedEndTurn = false;
  private turnStamp = 0;
  private overlays: Overlays = emptyOverlays();
  private deployHover: Coord | null = null;
  private hover: Coord | null = null;
  /** Seconds since the board stood, for anything that breathes. The 2D board's own clock. */
  private clock = 0;
  private finished = false;
  private disposed = false;

  constructor(private readonly opts: WorldCombatOpts) {
    this.session = new CombatSession(
      opts.encounter,
      opts.seed,
      opts.ai,
      opts.companionId,
      opts.deck,
      opts.carry,
      opts.roster,
      opts.wave2,
    );

    const enc = opts.encounter;
    this.board = placeBoard(opts.area, opts.at, enc.width, enc.height);

    this.overlay = new OverlayCanvas(opts.root, this.board, opts.camera);
    this.fx = new Fx(this.overlay, this.overlay.floaters);

    // From the board rather than re-derived: the engine already decided how deep a short
    // arena's home rows are, and a second copy of that rule here is a second chance to get
    // it wrong.
    this.mesh = new BoardMesh(this.board, {
      territoryDepth: this.session.getBoard().territoryDepth,
    });
    opts.scene.add(this.mesh.group);

    // Whose body stands at the far end. Resolved through the same two steps `CombatScreen`
    // uses, from the encounter rather than from anything about the presentation, so the enemy
    // Commander is the same character in both.
    const enemyBeast = opts.encounter.enemyCompanion?.unitCardId;
    const enemySpecies = enemyBeast ? companionByUnitCard(enemyBeast) : undefined;

    this.bodies = new BodyLayer(this.board, this.views, {
      companionId: opts.companionId,
      ...(opts.companionShiny !== undefined ? { companionShiny: opts.companionShiny } : {}),
      maxAnisotropy: opts.maxAnisotropy,
      ...(enemySpecies ? { enemySpeciesId: enemySpecies.id } : {}),
    });
    opts.scene.add(this.bodies.group);

    this.hud = new Hud(opts.root, {
      onCardClick: (id) => this.targeting.onCardClick(id),
      onCardHover: (id) => this.targeting.onCardHover(id),
      onEndTurn: () => this.requestEndTurn(),
      onToggleSpeed: () => this.toggleSpeed(),
      onUndo: () => this.undo(),
      onToggleMute: () => this.sfx.toggleMute(),
      onToggleThreat: () => this.targeting.toggleThreat(),
      onChannel: () => this.channelSelected(),
      onHelp: () => this.help.toggle(),
      // The board does not turn out here: it is lying on a real street, with buildings around
      // it, and a grid rotating under a fixed world would be the one thing that gave away that
      // it is not really there. What turns is the camera, which belongs to the district — so
      // the arrows are forwarded rather than dead, and mean for the world exactly what they
      // have always meant for the diamond: show me this from the other side.
      onRotate: (steps) => this.opts.onRotate?.(steps),
      onLastStand: (active) => this.sfx.setHeartbeat(active),
    });

    this.targeting = new TargetingController(this.session, {
      commit: (action) => this.commit(action),
      setOverlays: (o) => this.setOverlays(o),
      setSelectedCard: (id) => this.hud.setSelectedCard(id),
      notice: (text) => this.hud.flashNotice(text),
      warn: (text) => this.hud.setTargetWarning(text),
      askChannel: (card, affordable, then) => {
        const snap = this.session.getHand().find((c) => c.instanceId === card);
        if (!snap) {
          then(null);
          return;
        }
        this.channel.ask(snap, affordable, (choice) => then(choice ? choice.x : null));
      },
      setAwaitingFallen: (spec) => this.grave.setAwaiting(spec, this.session.getBoard()),
      setInspected: (unitId) => {
        this.hud.showInspect(this.session.getBoard(), unitId);
        this.hud.setChannelAvailable(unitId !== null && this.session.canChannel(unitId));
      },
    });

    this.grave = new Graveyard(opts.root, {
      onPick: (rosterIndex) => this.targeting.onFallenPick(rosterIndex),
    });
    this.grave.sync(this.session.getBoard());
    this.channel = new ChannelPicker(opts.root);
    this.help = new HelpOverlay(opts.root);

    const view: CombatView = {
      views: this.views,
      fx: this.fx,
      sfx: this.sfx,
      hud: this.hud,
      renderer: this.tetherSink,
      // Answered in tile space — the same coords `heroStand`/`enemyStand` are built from —
      // because `Fx` projects through the overlay camera, not through the world mesh.
      casterAnchor: (side, owner) => this.commanderAnchor(side, owner),
      snapshotOf: (unitId) =>
        this.session.getBoard().units.find((u) => u.id === unitId) ?? null,
    };
    this.sequencer = new Sequencer(view);
    registerHandlers(this.sequencer);
    this.hud.setSpeedLabel(this.speed);
    this.applyBeat();
    this.sequencer.onIdle = () => this.onSequencerIdle();

    this.installPointer();
    this.openBoard();
  }

  /* ============================================================
     Opening
     ============================================================ */

  private openBoard(): void {
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.hud.setSchoolAccent(board.player.companionSchool);
    this.hud.syncFromBoard(board, this.session.getHand(), this.session.getPlayableCards());
    this.refreshLastStand(board);
    this.hud.setInteractive(false);
    this.mesh.setResonanceLane(resonanceLaneOf(board));
    this.syncStands(board);

    if (board.phase === 'deployment') this.enterDeployment();

    this.sequencer.enqueue(this.session.openingEvents);
  }

  /* ============================================================
     The frame
     ============================================================ */

  /**
   * One frame, driven by the district's own loop rather than a `requestAnimationFrame` of
   * our own.
   *
   * Deliberately: there is one WebGL context, one scene and one camera out here, and a
   * second loop rendering the same scene would either double the work or fight the first
   * one for the frame. The district draws; this only updates what the district is about to
   * draw, and then paints its own overlay on top.
   */
  update(dt: number, cameraYaw: number): void {
    if (this.disposed) return;

    const ms = dt * 1000;
    this.clock += dt;
    this.fx.update(ms);
    this.views.ageFlashes(ms, 420);

    this.mesh.update(dt);
    this.bodies.update(cameraYaw);

    this.overlay.clear();
    this.drawFurniture();
    this.fx.draw(this.overlay.ctx, this.overlay.width, this.overlay.height);
  }

  /** Every billboard on the board, so the district can turn them to face the camera. */
  get billboards(): THREE.Object3D[] {
    return this.bodies.sprites;
  }

  /** 0 while the ground is bare, 1 once the grid stands. Driven by the descent. */
  set reveal(v: number) {
    this.mesh.reveal = v;
  }

  /** The shake `Fx` asked for, in screen pixels, for the camera to consume. */
  get shake(): { x: number; y: number } {
    return this.overlay.shake;
  }

  /**
   * Whether the Companion's body is on the board.
   *
   * Asked by the district so it can put the follower away. The beast cannot be in two places
   * at once, and out here it very nearly was: its Bound Form stands on the grid while the
   * `CompanionFollower` that walked the road with you is still standing at your shoulder. The
   * 2D board has always dropped its off-grid model for exactly this reason; this is the same
   * rule, asked the same way, for the presentation that did not have it yet.
   */
  get companionEmbodied(): boolean {
    return this.session
      .getBoard()
      .units.some((u) => u.side === 'player' && u.keywords.includes('BoundForm'));
  }

  /** Where the Hero stands: one row beyond the near edge, off the grid but on the field. */
  heroStand(): { x: number; z: number } {
    return this.board.centreOf({ x: (this.board.w - 1) / 2, y: this.board.h + 0.35 });
  }

  /**
   * The stands again, in *tile* coordinates, for the handlers' cast flourish.
   *
   * The district draws no free-standing Companion — the player's own body is the Hero and
   * the Companion appears only as its Bound Form — so an unembodied companion answers
   * null and the flourish is simply skipped, rather than lighting up the wrong figure.
   */
  private commanderAnchor(side: Side, owner: 'hero' | 'companion'): Coord | null {
    const board = this.session.getBoard();
    if (side === 'enemy') {
      const bound = board.units.find(
        (u) => u.side === 'enemy' && u.keywords.includes('BoundForm'),
      );
      if (bound) return this.views.get(bound.id)?.pos ?? { ...bound.anchor };
      if (board.rout) return null;
      return { x: (board.width - 1) / 2, y: -1.35 };
    }
    if (owner === 'companion') {
      const bound = board.units.find(
        (u) => u.side === 'player' && u.keywords.includes('BoundForm'),
      );
      return bound ? (this.views.get(bound.id)?.pos ?? { ...bound.anchor }) : null;
    }
    return { x: (board.width - 1) / 2, y: board.height + 0.35 };
  }

  /** And where the enemy Commander stands, beyond the far edge. */
  enemyStand(): { x: number; z: number } {
    return this.board.centreOf({ x: (this.board.w - 1) / 2, y: -1.35 });
  }

  /* ============================================================
     The floating furniture
     ============================================================ */

  /**
   * What belongs above the ground rather than on it.
   *
   * The tile-level overlays are quads in `BoardMesh`; these are the marks that would be
   * unreadable flattened onto a road seen at a shallow angle — predicted damage, threat
   * numbers, and the tether. Drawn in screen space through the same projection `Fx` uses, so
   * they sit exactly over the tiles they describe.
   */
  private drawFurniture(): void {
    const ctx = this.overlay.ctx;
    const scale = this.overlay.tileW / 116;

    // The tether, first and lowest: a cable between the beast and whoever is holding it.
    this.drawTether(ctx, scale);

    // What each body is wearing: its brand, its numbers, its statuses. The same call the 2D
    // board makes, over the same `EntityView`s, so the two renderers cannot disagree about
    // what a body is telling you — see `drawBodyFurniture`.
    //
    // This was missing entirely, and it was the largest thing standing between the world board
    // and being readable: there was no way to see any unit's health, attack or armour without
    // clicking it, on a presentation whose whole selling point is that the fight is right there
    // in front of you. Everything needed was already in the view map.
    this.drawBodies(ctx, scale);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const p of this.overlays.predicted) {
      if (p.damage === undefined) continue;
      const at = this.overlay.tileCenter(p.at, 26);
      badge(ctx, at.x, at.y, `-${p.damage}`, '#F87171', scale);
    }

    if (this.overlays.showThreat) {
      for (const t of this.overlays.threat) {
        const at = this.overlay.tileCenter(t.at, 34);
        badge(ctx, at.x, at.y, `${t.damage}`, '#FCA5A5', scale);
      }
    }

    // `overlays.badges` is deliberately not drawn. It carries a body's range profile for the
    // 2D board's corner bones, and out here the same fact is already on the ground: the reach
    // ring is a tile layer, which is a better answer to "how far does this thing reach" than
    // two numbers floating over its head.

    ctx.restore();
  }

  /**
   * Who is standing off each end of the grid.
   *
   * The player's Hero is the district's own body and only wants a footing under it; the enemy
   * Commander wants a body as well, because nothing else in the world is standing there. Both
   * of the rules that drop the far figure are the 2D board's, taken from the same board view:
   * a rout has no Commander, and one already embodied on the grid is not also beside it.
   */
  private syncStands(board: BoardView): void {
    const embodied = board.units.some(
      (u) => u.side === 'enemy' && u.keywords.includes('BoundForm'),
    );
    const at = this.enemyStand();
    this.bodies.setStands({
      hero: this.heroStand(),
      enemy:
        embodied || board.rout
          ? null
          : {
              x: at.x,
              z: at.z,
              school: board.enemy.companionSchool,
              // Seeds the silhouette where nobody has painted this opponent. The name rather
              // than the encounter id, so two contracts against the same character get the
              // same figure.
              seed: `commander:${board.enemy.name}`,
            },
    });
  }

  /**
   * Numbers over bodies.
   *
   * `scale` is one figure for the whole board rather than per-body, even though the near row
   * is genuinely larger on screen than the far one under this camera. That is deliberate: a
   * health bar is text, and text that shrinks with distance is text you cannot read at the far
   * end of an eight-deep arena. The bodies foreshorten; what they are telling you does not.
   */
  private drawBodies(ctx: CanvasRenderingContext2D, scale: number): void {
    const pulse = (Math.sin(this.clock * 1.6) + 1) / 2;
    for (const view of this.views.all()) {
      // A Behemoth's `pos` is its anchor and its bulk spreads across the footprint, so the
      // numbers belong over the middle of the block. Same offset `BodyLayer` stands it on.
      const footprint = view.snapshot?.footprint ?? 1;
      const offset = (footprint - 1) / 2;
      const at = { x: view.pos.x + offset, y: view.pos.y + offset };
      const centre = this.overlay.tileCenter(at, view.elev);
      // Where this body's head actually projects to, rather than a fixed offset. `elev` is in
      // the same screen pixels the animation handlers speak, and `PX_TO_WORLD` is what converts
      // them -- so asking for the point one body-height up and measuring the gap on screen is
      // exact, and stays exact at the far end of the arena where the same body is smaller.
      const head = this.overlay.tileCenter(at, view.elev + BODY_PX * (footprint > 1 ? 1.8 : 1));
      ctx.save();
      // Spent bodies fade back, exactly as their sprites do, so the eye lands on the ones
      // that can still act.
      // Softened from 0.5 now the tick carries "done": the dim only has to whisper.
      ctx.globalAlpha = view.alpha * (view.spent ? 0.75 : 1);
      drawBodyFurniture(ctx, centre, scale, view, pulse, Math.max(12, centre.y - head.y));
      ctx.restore();
    }
  }

  private drawTether(ctx: CanvasRenderingContext2D, scale: number): void {
    const tether: TetherModel | null = this.tetherSink.tether;
    if (!tether?.bossId) return;
    const anchor = this.views.get(tether.anchorId);
    const boss = this.views.get(tether.bossId);
    if (!anchor || !boss) return;

    const centreOf = (id: UnitId): { x: number; y: number } => {
      const v = this.views.get(id)!;
      const fp = v.snapshot?.footprint ?? 1;
      return this.overlay.tileCenter(
        { x: v.pos.x + (fp - 1) / 2, y: v.pos.y + (fp - 1) / 2 },
        v.elev + 14,
      );
    };
    const a = centreOf(tether.anchorId);
    const b = centreOf(tether.bossId);

    // Grid distance, not pixels: a diagonal is not further away than a straight line, and
    // the camera must not change how much trouble the anchor reads as being in.
    const gap = Math.max(
      Math.abs(anchor.pos.x - boss.pos.x),
      Math.abs(anchor.pos.y - boss.pos.y),
    );
    const closeness = Math.max(0, Math.min(1, 1 - (gap - 1) / 4));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = closeness > 0.5 ? '#DC2626' : '#F97316';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10 * scale;
    ctx.lineWidth = Math.max(1.5, 3.5 * scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
     Input
     ============================================================ */

  private installPointer(): void {
    const el = this.overlay.el;
    // Pointer events are on the overlay rather than the WebGL canvas because the overlay is
    // the topmost element over the board. It is otherwise transparent to the eye, and the
    // HUD sits above it in the stack, so a click on a card still reaches the card.
    el.style.pointerEvents = 'auto';
    el.addEventListener('mousemove', (ev) => this.onMove(ev));
    el.addEventListener('click', (ev) => this.onClick(ev));
    el.addEventListener('mouseleave', () => {
      this.hover = null;
      this.targeting.onTileHover(null);
    });
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      this.targeting.onCancel();
    });
  }

  private onMove(ev: MouseEvent): void {
    const tile = this.overlay.tileAtPointer(ev.clientX, ev.clientY);
    if (this.deploying) {
      this.deployHover = tile;
      this.paintAnchors();
      return;
    }
    // Only on a change: `TargetingController` recomputes previews on every hover, and a
    // mouse moving inside one tile has not changed the question being asked.
    if (sameTile(tile, this.hover)) return;
    this.hover = tile;
    this.targeting.onTileHover(tile);
  }

  private onClick(ev: MouseEvent): void {
    const tile = this.overlay.tileAtPointer(ev.clientX, ev.clientY);
    if (this.deploying) {
      this.handleDeploymentClick(tile);
      return;
    }
    if (tile) this.targeting.onTileClick(tile);
  }

  /**
   * Keys, forwarded from the district.
   *
   * Not bound to `window` here: the district owns the keyboard — it is still listening for
   * the map, and for Escape — and two independent listeners racing for the same key is how
   * one of them ends up unreachable. Returns whether the key was consumed.
   */
  handleKey(code: string): boolean {
    if (this.disposed) return false;
    if (code === 'Escape') {
      this.targeting.onCancel();
      return true;
    }
    if (code === 'Enter') {
      this.requestEndTurn();
      return true;
    }
    if (code === 'KeyZ') {
      this.undo();
      return true;
    }
    if (code === 'KeyT') {
      this.hud.setThreatActive(this.targeting.toggleThreat());
      return true;
    }
    if (code === 'KeyH') {
      this.help.toggle();
      return true;
    }
    return false;
  }

  /* ============================================================
     Deployment
     ============================================================ */

  private get deploying(): boolean {
    return this.session.getBoard().phase === 'deployment';
  }

  private enterDeployment(): void {
    this.deploy = new DeployTray(this.opts.root, {
      onSelect: () => this.paintAnchors(),
      onEngage: () => this.commit({ type: 'finishDeployment' }),
    });
    this.deploy.sync(this.session.getBoard());
    this.deploy.setInteractive(true);
    this.paintAnchors();
  }

  private exitDeployment(): void {
    this.deploy?.destroy();
    this.deploy = null;
    this.setOverlays(emptyOverlays());
  }

  /** The Anchor Tiles a body may be set down on, lit as ground. */
  private paintAnchors(): void {
    const board = this.session.getBoard();
    const picked = this.deploy?.selectedDefId ?? null;
    const legal = board.anchors.filter((at) => this.session.canDeploy(picked, at));
    const impact =
      this.deployHover && picked ? cellsAt(this.deployHover, footprintOf(board, picked)) : [];

    this.setOverlays({
      ...emptyOverlays(),
      highlight: legal,
      impact,
      ...(this.deployHover ? { hover: this.deployHover } : {}),
    });
  }

  private handleDeploymentClick(tile: Coord | null): void {
    const picked = this.deploy?.selectedDefId ?? null;
    if (!tile || !picked) return;
    const refusal = this.session.deployRefusal(picked, tile);
    if (refusal !== null) {
      this.hud.flashNotice(refusal);
      return;
    }
    this.commit({ type: 'deployUnit', defId: picked, at: tile });
  }

  /* ============================================================
     The synchronisation rule
     ============================================================ */

  private commit(action: Action): void {
    if (this.sequencer.busy || this.finished) return;
    if (this.session.isOver()) return;
    if (this.session.activeSide !== 'player') return;

    this.sfx.unlock();
    this.recordUndo();
    // Any deliberate action clears a pending End Turn confirmation: the player has
    // demonstrably found something else to do.
    this.armedEndTurn = false;

    this.lockInput();

    let events;
    try {
      events = this.session.dispatch(action);
    } catch (err) {
      this.hud.flashNotice(err instanceof Error ? err.message : 'Illegal action');
      this.unlockInput();
      return;
    }
    this.sequencer.enqueue(events);
  }

  private lockInput(): void {
    // A pending choice belongs to a turn the player still had.
    this.channel.close();
    this.targeting.setEnabled(false);
    this.hud.setInteractive(false);
    this.deploy?.setInteractive(false);
    this.setOverlays(emptyOverlays());
  }

  private unlockInput(): void {
    if (this.deploying) {
      this.deploy?.sync(this.session.getBoard());
      this.deploy?.setInteractive(true);
      this.paintAnchors();
      return;
    }
    if (this.deploy) this.exitDeployment();

    const board = this.session.getBoard();
    if (this.session.activeSide === 'player' && board.phase === 'action') {
      // A fresh turn carries no history.
      if (this.turnStamp !== board.turn) {
        this.turnStamp = board.turn;
        this.undoStack.length = 0;
        this.armedEndTurn = false;
      }
    }

    this.hud.syncFromBoard(board, this.session.getHand(), this.session.getPlayableCards());
    const selected = this.targeting.selectedUnit;
    this.hud.setChannelAvailable(selected !== null && this.session.canChannel(selected));
    this.hud.setIncoming(
      calculateProjectedDamage(board),
      this.session.getThreat().commanderThreatCount,
    );
    this.refreshLastStand(board);
    this.grave.sync(board);
    this.mesh.setResonanceLane(resonanceLaneOf(board));
    this.syncStands(board);
    this.refreshTurnUi();
    this.hud.setInteractive(true);
    this.targeting.setEnabled(true);
  }

  private onSequencerIdle(): void {
    if (this.disposed) return;

    if (this.session.isOver()) {
      const result = this.session.result;
      if (result && !this.finished) {
        this.finished = true;
        this.hud.setInteractive(false);
        this.targeting.setEnabled(false);
        const roster = this.session.rosterOutcome;
        const outcome: CombatOutcome = {
          pactHp: this.session.pactHp,
          encounteredUnitIds: this.session.encounteredEnemies,
          defeatedUnitIds: this.session.defeatedEnemies,
          mastery: this.session.mastery,
          rosterSurvivors: roster.survivors,
          rosterFallen: roster.fallen,
        };
        window.setTimeout(() => {
          if (!this.disposed) this.opts.onFinish(result, this.opts.encounter, outcome);
        }, 900);
      }
      return;
    }

    // Re-sync from the authoritative board: insurance against drift from a skipped
    // animation.
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.syncMarksAndStatuses(board);

    if (this.session.activeSide === 'enemy') {
      this.hud.setInteractive(false);
      this.targeting.setEnabled(false);
      this.applyBeat();
      window.setTimeout(() => {
        if (this.disposed) return;
        const events = this.session.runAiTurn();
        if (events.length > 0) this.sequencer.enqueue(events);
        else this.unlockInput();
      }, 260);
      return;
    }

    this.unlockInput();
  }

  /* ============================================================
     Turn UI, undo, pacing
     ============================================================ */

  /**
   * Two-click End Turn, but only when there is something to lose.
   *
   * With nothing unspent it passes on the first click — nagging a player who has already
   * done everything is its own kind of friction.
   */
  private requestEndTurn(): void {
    if (this.sequencer.busy || this.session.activeSide !== 'player') return;

    const potential = this.session.getUnspentPotential();
    const wasted = potential.readyUnits + potential.playableCards;

    if (wasted > 0 && !this.armedEndTurn) {
      this.armedEndTurn = true;
      this.hud.flashNotice(describeUnspent(potential) + ' — click again to end your turn');
      this.refreshTurnUi();
      return;
    }

    this.armedEndTurn = false;
    this.commit({ type: 'endTurn' });
  }

  private refreshTurnUi(): void {
    const potential = this.session.getUnspentPotential();
    const wasted = potential.readyUnits + potential.playableCards;
    this.hud.setUndoAvailable(this.undoStack.length > 0);
    this.hud.setEndTurnWarning(
      this.armedEndTurn ? 'armed' : wasted > 0 ? 'warn' : 'none',
      potential,
    );
  }

  private recordUndo(): void {
    this.undoStack.push(this.session.snapshot());
    // A turn's worth is plenty; an unbounded stack is a slow leak of whole game states.
    if (this.undoStack.length > 24) this.undoStack.shift();
  }

  private undo(): void {
    if (this.sequencer.busy) return;
    const state = this.undoStack.pop();
    if (!state) return;
    this.session.restore(state);
    const board = this.session.getBoard();
    this.views.syncFrom(board.units, board.obstacles);
    this.syncMarksAndStatuses(board);
    this.targeting.reset();
    this.unlockInput();
  }

  private toggleSpeed(): 'normal' | 'fast' {
    this.speed = this.speed === 'fast' ? 'normal' : 'fast';
    try {
      localStorage.setItem(SPEED_KEY, this.speed);
    } catch {
      // Not worth a crash; the session keeps the setting either way.
    }
    this.applyBeat();
    return this.speed;
  }

  private applyBeat(): void {
    const normal = this.speed === 'normal';
    const enemyActing = this.session.activeSide === 'enemy';
    this.sequencer.setBeat(enemyActing && normal ? AI_BEAT_MS : 0);
    this.sequencer.setMotion(normal ? NORMAL_MOTION : 1);
  }

  private channelSelected(): void {
    const unit = this.targeting.selectedUnit;
    if (unit !== null) this.commit({ type: 'channel', unit });
  }

  private refreshLastStand(board: BoardView): void {
    this.hud.setLastStand(board.player.hp <= board.player.maxHp * LAST_STAND_FRACTION);
  }

  private setOverlays(overlays: Overlays): void {
    this.overlays = overlays;
    this.mesh.setOverlays(overlays);
  }

  private syncMarksAndStatuses(board: BoardView): void {
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

  resize(): void {
    this.overlay.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // The heartbeat and any other loop end with the fight, however it ended — the same
    // belt CombatScreen.unmount wears over combatEnded's suspenders.
    this.sfx.stopAllLoops();
    this.sequencer.onIdle = undefined;
    this.deploy?.destroy();
    this.grave.destroy();
    this.channel.close();
    this.help.destroy();
    this.hud.destroy();
    this.overlay.dispose();

    this.opts.scene.remove(this.mesh.group);
    this.opts.scene.remove(this.bodies.group);
    this.mesh.dispose();
    this.bodies.dispose();
    this.undoStack.length = 0;
  }
}

/** The lane the Companion watches, or nothing once its Resonance has been spent. */
function resonanceLaneOf(board: BoardView): number | null {
  return board.player.resonanceUsed ? null : board.player.companionColumn;
}

/** Plain-language summary of what passing right now would waste. Mirrors `CombatScreen`. */
function describeUnspent(p: { readyUnits: number; playableCards: number }): string {
  const parts: string[] = [];
  if (p.readyUnits > 0) {
    parts.push(p.readyUnits === 1 ? '1 unit can still act' : `${p.readyUnits} units can still act`);
  }
  if (p.playableCards > 0) {
    parts.push(
      p.playableCards === 1
        ? '1 card is still playable'
        : `${p.playableCards} cards are still playable`,
    );
  }
  return parts.join(' and ');
}

function footprintOf(board: BoardView, defId: string): 1 | 2 {
  const entry = board.roster?.find((r) => r.defId === defId);
  return entry?.footprint === 2 ? 2 : 1;
}

function sameTile(a: Coord | null, b: Coord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y;
}

/** A small pill of text over a tile, in the 2D board's idiom. */
function badge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  scale: number,
): void {
  const size = Math.max(9, 13 * scale);
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + size * 0.7;
  const h = size * 1.5;

  ctx.fillStyle = 'rgba(10,12,18,0.78)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(text, x, y + size * 0.05);
}

/*
 * ## On the duplication above
 *
 * `commit`, `lockInput`, `unlockInput`, `onSequencerIdle`, `applyBeat`, `toggleSpeed`,
 * `recordUndo`, `refreshTurnUi` and `syncMarksAndStatuses` are near-copies of the same
 * methods in `app/CombatScreen.ts`. That is not where this should end up.
 *
 * The intended shape is a shared `CombatCore` owning the session, sequencer, HUD, trays and
 * targeting, with each shell supplying only a renderer and a way to turn a pointer into a
 * tile. It was not done in the change that added this file for one specific reason:
 * `CombatScreen` has **no test coverage at all** — nothing in `src/tests` constructs it, and
 * the toolchain has no DOM or canvas environment to construct it in. Moving six hundred
 * lines of the app's most synchronisation-sensitive code with no guard, in the same change
 * that introduces a second renderer, risks the *working* path in order to tidy the new one.
 *
 * So the order is: get the in-world fight right, then extract. Doing the extraction after
 * this exists is also strictly easier, because the two copies together say exactly which
 * parts are genuinely shared and which were only ever presentation. When it happens, the
 * first step should be a DOM-environment smoke test that drives a whole turn through
 * `CombatScreen`, so the refactor has the guard this one did not.
 */
