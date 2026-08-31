/**
 * The board renderer: a requestAnimationFrame loop drawing three passes per frame —
 * tiles, tile overlays (highlights, fog, ghosts), then depth-sorted entities.
 */

import type { Coord, Side, UnitId } from '../contract/ids.js';
import { coordKey } from '../contract/ids.js';
import type { IsoCamera } from './IsoCamera.js';
import { TILE_H, TILE_W } from './IsoCamera.js';
import type { EntityViewMap, EntityView } from './EntityViews.js';
import type { Fx } from './Fx.js';
import { PALETTE, schoolOf } from './palette.js';
import type { School } from '../contract/ids.js';
import {
  drawBasePlate,
  drawBodyFurniture,
  drawBoundary,
  drawCommander,
  drawCover,
  drawTile,
  drawUnitBody,
  fillTile,
  hatchTile,
  tilePath,
} from './shapes.js';
import { cellsAt } from '../core/util/grid.js';

export interface Overlays {
  /** Legal destinations or card targets. */
  highlight: Coord[];
  /** Legal attack targets. */
  attack: Coord[];
  /** Tiles with no line of sight from the current origin. */
  fog: Coord[];
  /** The currently hovered tile. */
  hover: Coord | null;
  /** The selected unit's tile. */
  selected: Coord | null;
  /**
   * Tiles where one of your Vanguard fell.
   *
   * Drawn from `BoardView.roster`, not from anything on the board: a Soul Pyre is roster
   * memory rather than an entity, so there is nothing at the coordinate to render *from*.
   * That is exactly why it has to travel as an overlay.
   */
  pyres: Coord[];
  /** Predicted damage badges, shown while previewing. */
  predicted: { at: Coord; damage?: number; kind: string }[];
  /**
   * Every tile the cast under the cursor would actually touch.
   *
   * The shape of the thing, drawn whether or not anything is standing in it. `highlight`
   * says where you may *aim*; this says where it *lands*, and the two are the same tile
   * only for a single-target spell. A cone, a cross, a 2x2 body, a beam down a rank —
   * each of those covers ground the player never clicked, and until this existed the only
   * way to see it was to hold Shift and read damage badges, which showed nothing at all
   * for a card that deals no damage.
   */
  impact: Coord[];
  /**
   * The ring the selected body threatens, occupied or not.
   *
   * Distinct from `attack`, which is the list of things it may hit right now. A player
   * deciding where to move is asking the other question — *how far does this thing
   * reach* — and needs tiles to count rather than targets to click.
   */
  reach: Coord[];
  /**
   * Trajectory ghosts: a translucent copy per displaced unit, sliding to where it lands.
   *
   * A list rather than one, because an area shove moves everything in the wedge and a
   * gravity pull drags four bodies onto a tile. Showing only the first is worse than
   * showing none — it reads as "this one moves and the others do not", which is exactly
   * the wrong answer to the question the ghost exists to answer.
   */
  ghosts: { unitId: UnitId; path: Coord[]; crashAt?: Coord }[];
  /** Shift-held expanded prediction. */
  expanded: boolean;
  /** Tiles enemies can strike next turn, with incoming damage. */
  threat: { at: Coord; damage: number }[];
  /** Lingering tile hazards, drawn under the entities. */
  hazards: { at: Coord; kind: string; turns: number }[];
  /** What the enemy has committed to next turn. */
  intents: {
    unitId: UnitId;
    kind: 'attack' | 'commander' | 'card' | 'move' | 'channel';
    at?: Coord;
    damage: number;
    label?: string;
  }[];
  /** Whether the threat overlay is currently visible. */
  showThreat: boolean;
  /** Tile a Companion card is being cast from, marked while aiming it. */
  castOrigin: Coord | null;
  /**
   * Tiles in reach of the thing being aimed, but not legal targets for it.
   *
   * The counterpart to `highlight`, and the half that was missing: highlighting the legal
   * tiles says *where* you may aim, and says nothing about why the rest are refused. A
   * tile shaded here is one the card can see and cannot use — wrong shape, wrong
   * occupant, too close for a mortar. Blocked sight keeps its own hatching (`fog`),
   * because "you cannot see it" and "you can see it and it will not do" are different
   * answers and a player acts on them differently.
   */
  dimmed: Coord[];
  /**
   * The flight the shot would take, drawn from where it is thrown to where it lands.
   *
   * A list because one cast can produce several — a beam down a rank touches every body
   * on it. `arcing` lobs the line into a parabola instead of drawing it flat, which is
   * the only way the profile reads on an isometric board: an arcing shot and a straight
   * one cover the same tiles and differ entirely in what they may cross.
   */
  trajectory: { from: Coord; to: Coord; school: string; arcing: boolean }[];
  /**
   * Every cell of the selected body, rather than its anchor.
   *
   * A Behemoth anchored at one corner was ringed on that corner alone, which reads as a
   * 1x1 standing inside a 2x2 rather than as the Behemoth being selected. `cellsAt` is
   * the one expansion, done where the footprint is known.
   */
  selectedCells: Coord[];
  /**
   * Reach badges, drawn beside a body's stat bar while it is selected.
   *
   * Carried as data rather than read off the snapshot in the renderer, so the rule about
   * *which* bodies show one stays in the controller with the rest of the targeting rules.
   */
  badges: {
    unitId: UnitId;
    profile: 'melee' | 'ranged' | 'arcing';
    rangeMin: number;
    rangeMax: number;
  }[];
}

/** A Commander standing beside the board: on the field, off the grid. */
/** The two ends of a live Aetheric Tether. */
export interface TetherModel {
  anchorId: UnitId;
  /** The Alpha's body. Absent for a bodiless boss, in which case nothing is drawn. */
  bossId?: UnitId;
}

export interface CommanderModel {
  side: Side;
  kind: 'hero' | 'companion' | 'boss';
  name: string;
  school: string;
  /** Fractional grid coordinate — deliberately outside the board's row range. */
  at: Coord;
  hp: number;
  maxHp: number;
  armor: number;
  /**
   * The painted body, if it has decoded.
   *
   * Resolved by the screen rather than looked up here, because the renderer is handed a fight
   * and not a character: which bearing the Hero wears and which species stands beside them are
   * facts about the save, and `BoardView` deliberately carries neither. `CombatScreen` knows
   * both and re-resolves this every time it syncs, so the art appears the moment it loads
   * without anything having to wait for it.
   */
  art?: HTMLImageElement | null;
  /**
   * The walk sheet, for the entrance march. Hero only — the sheet is side-profile art of
   * the Commander, and a beast slides to its dais instead. Resolved by the screen for the
   * same reason `art` is: the renderer is handed a fight, not a character.
   */
  walkSheet?: HTMLImageElement | null;
}

/** How much bigger a unit looks per Escalation stack. */
const ESCALATION_SCALE_PER_STACK = 0.05;

export function emptyOverlays(): Overlays {
  return {
    highlight: [],
    attack: [],
    fog: [],
    hover: null,
    selected: null,
    pyres: [],
    predicted: [],
    impact: [],
    reach: [],
    ghosts: [],
    expanded: false,
    threat: [],
    hazards: [],
    intents: [],
    showThreat: false,
    castOrigin: null,
    dimmed: [],
    trajectory: [],
    selectedCells: [],
    badges: [],
  };
}

/**
 * How long a status wash takes to fade, in milliseconds.
 *
 * Long enough to catch out of the corner of an eye, short enough that a cast poisoning
 * five bodies does not leave the board lit up.
 */
export const FLASH_MS = 340;

/**
 * A stable per-unit offset for idle motion, from the id's characters.
 *
 * Not a hash anyone relies on — it only has to spread a squad across the breath cycle,
 * and being deterministic per id keeps the motion continuous across frames and syncs.
 */
function idleSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h;
}

export class BoardRenderer {
  private raf: number | null = null;
  private lastTime = 0;
  private clock = 0;
  overlays: Overlays = emptyOverlays();
  commanders: CommanderModel[] = [];
  /**
   * The entrance march, or null once everyone has reached their dais.
   *
   * Set by the screen at the top of a fight; the figures walk in along their rows from
   * offstage while it runs. Held here rather than on the models because `syncCommanders`
   * rebuilds those on every input unlock, and an entrance that reset with them would
   * stutter every time the opening batch touched the board.
   */
  commanderEntrance: { startedAt: number; durationMs: number } | null = null;
  /**
   * The live tether, or null.
   *
   * Assembled by the animation handlers from the event stream rather than read off board
   * state, because `BoardView` does not carry the protocol and widening it would mean
   * editing the core. The events already say everything the cable needs to know, and a
   * renderer that learns from them stays correct through a skipped animation.
   */
  tether: TetherModel | null = null;
  /** Column the player's Companion watches, highlighted as its Resonance lane. */
  resonanceLane: number | null = null;
  /** Rows of territory each side owns. Mirrors the engine; short arenas use one. */
  territoryDepth = 2;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D,
    private readonly cam: IsoCamera,
    private readonly views: EntityViewMap,
    private readonly fx: Fx,
  ) {}

  start(): void {
    if (this.raf !== null) return;
    const loop = (now: number) => {
      const dt = this.lastTime === 0 ? 16 : Math.min(64, now - this.lastTime);
      this.lastTime = now;
      this.clock += dt;
      this.fx.update(dt);
      this.views.ageFlashes(dt, FLASH_MS);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Renders a single frame on demand. Used for tests and headless inspection. */
  drawOnce(): void {
    this.draw();
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastTime = 0;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    // A zero-sized box means the screen is mid-transition or hidden. Fitting to it would
    // divide by nothing and leave the camera holding a garbage zoom.
    if (rect.width < 1 || rect.height < 1) return;

    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    // Assigning `canvas.width` clears the canvas even when the value is unchanged, so the
    // guard is not a micro-optimisation -- it is what stops a same-size refit from blanking
    // the board for a frame. `Diorama.resize` has taken this shape from the start.
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.cam.fit(rect.width, rect.height);
  }

  private draw(): void {
    const { ctx, cam } = this;
    const rect = this.canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const pulse = (Math.sin(this.clock / 620) + 1) / 2;

    // A rotation in progress spins the whole finished image. An isometric diamond is a
    // squashed square, so it has to be un-squashed before rotating and re-squashed after
    // — rotating the projected shape directly would skew it into a parallelogram.
    const spinning = cam.spinning;
    if (spinning) {
      const centre = cam.worldToScreen(cam.gridW / 2, cam.gridH / 2);
      ctx.save();
      ctx.translate(centre.x, centre.y);
      ctx.scale(1, TILE_W / TILE_H);
      ctx.rotate(cam.spin);
      ctx.scale(1, TILE_H / TILE_W);
      ctx.translate(-centre.x, -centre.y);
    }

    this.drawTiles();
    drawBoundary(ctx, cam, pulse);
    this.drawResonanceLane(pulse);
    this.drawHazards(pulse);
    this.drawOverlays(pulse);
    // Above the tiles, below the bodies: a flight path passes behind what it is aimed at.
    this.drawTrajectories(pulse);
    this.drawIntents(pulse);
    this.drawBoardObjects(pulse);
    this.drawTether();
    this.drawGhosts();
    this.drawPredictions();
    // Last, and above everything: a badge that a body could stand in front of is a badge
    // nobody can read.
    this.drawIntentBadges(pulse);
    this.drawReachBadges();

    if (spinning) ctx.restore();

    // Screen effects sit outside the spin: a shake or a flash belongs to the camera, not
    // to the board being turned underneath it.
    this.fx.draw(ctx, rect.width, rect.height);
  }

  /**
   * The Aetheric Tether: a heavy cable between the beast and whatever is holding it.
   *
   * Drawn as three strands rather than one line — a bright core with a darker strand
   * either side of it — which is what makes it read as a braided cable under load rather
   * than as a laser. The strands are offset perpendicular to the run, so the bundle stays
   * a bundle whichever way the board is turned.
   *
   * The strain is sine-driven rather than random. Fresh noise every frame looks like
   * static and reads as a rendering fault; two waves of different frequency travelling
   * along the cable look like something being pulled, and cost nothing to compute.
   *
   * Colour runs orange to crimson as the beast closes, per the design note — so the
   * cable itself tells the player how much trouble the anchor is in without a number.
   */
  private drawTether(): void {
    const { ctx, cam, tether } = this;
    if (!tether || !tether.bossId) return;

    const anchor = this.views.get(tether.anchorId);
    const boss = this.views.get(tether.bossId);
    if (!anchor || !boss) return;

    const centreOf = (v: EntityView) => {
      const fp = v.snapshot?.footprint ?? 1;
      return cam.worldToScreen(v.pos.x + fp / 2, v.pos.y + fp / 2, v.elev + 14);
    };
    const a = centreOf(anchor);
    const b = centreOf(boss);

    // Grid distance, not pixels: a diagonal is not further away than a straight line, and
    // the camera's zoom must not change how close the beast reads as being.
    const gap = Math.max(Math.abs(anchor.pos.x - boss.pos.x), Math.abs(anchor.pos.y - boss.pos.y));
    const closeness = Math.max(0, Math.min(1, 1 - (gap - 1) / 4));

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Unit normal, for offsetting the outer strands and the strain wave.
    const nx = -dy / len;
    const ny = dx / len;

    const SEGMENTS = 18;
    const t = this.clock / 1000;
    // A cable pulled taut whips less than a slack one, and one about to fail whips more.
    const amplitude = (5 + closeness * 7) * cam.zoom;

    const strand = (offset: number, width: number, color: string, glow: number): void => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width * cam.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = glow * cam.zoom;
      ctx.beginPath();

      for (let i = 0; i <= SEGMENTS; i++) {
        const k = i / SEGMENTS;
        // Pinned at both ends: the cable is anchored, so the whip is greatest mid-span.
        const slack = Math.sin(k * Math.PI);
        const wave =
          Math.sin(k * 9 - t * 7) * amplitude * slack +
          Math.sin(k * 21 + t * 11) * amplitude * 0.35 * slack;
        const push = offset * cam.zoom + wave;
        const x = a.x + dx * k + nx * push;
        const y = a.y + dy * k + ny * push;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.restore();
    };

    // Orange at rest, crimson as it closes.
    const hot = closeness > 0.55 ? '#cc0000' : '#ff4500';
    strand(-3.2, 2.4, '#7a1b00', 4);
    strand(3.2, 2.4, '#7a1b00', 4);
    strand(0, 4.2, hot, 14);
    strand(0, 1.4, '#ffd9a0', 8);
  }

  /** The Companion's lane, marked so its Resonance reads as a place on the board. */
  private drawResonanceLane(pulse: number): void {
    if (this.resonanceLane === null) return;
    const { ctx, cam } = this;
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.06 * pulse;
    for (let y = 0; y < cam.gridH; y++) {
      fillTile(ctx, cam, { x: this.resonanceLane, y }, 'rgba(255, 107, 53, 0.55)');
    }
    ctx.restore();
  }

  /**
   * The danger zone, drawn the way Fire Emblem draws it: a light wash plus an outline
   * around the *edge* of the region rather than around every tile. Outlining each tile
   * turns a large threatened area into visual noise, which is exactly the case where
   * the player most needs to read it.
   */
  /**
   * The spectral flame standing on a Soul Pyre.
   *
   * A tint alone reads as another kind of highlight, and the board already has four. The
   * flame is what says *body* rather than *tile* — so it is drawn as a small upright
   * shape rather than more ground colour, and it breathes on the shared pulse so a row of
   * pyres moves together instead of shimmering independently.
   */
  private drawPyreFlame(at: Coord, pulse: number): void {
    const { ctx, cam } = this;
    const p = cam.tileCenter(at);
    const h = cam.tileH * (0.62 + 0.10 * pulse);
    const w = cam.tileH * 0.30;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + 0.25 * pulse;

    const flame = ctx.createLinearGradient(p.x, p.y - h, p.x, p.y);
    flame.addColorStop(0, 'rgba(186, 230, 253, 0)');
    flame.addColorStop(0.45, PALETTE.pyreEdge);
    flame.addColorStop(1, 'rgba(56, 189, 248, 0.05)');

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.quadraticCurveTo(p.x + w, p.y - h * 0.42, p.x, p.y);
    ctx.quadraticCurveTo(p.x - w, p.y - h * 0.42, p.x, p.y - h);
    ctx.fillStyle = flame;
    ctx.fill();
    ctx.restore();
  }

  private drawThreat(): void {
    const { ctx, cam, overlays } = this;
    const threatened = new Set(overlays.threat.map((t) => coordKey(t.at)));

    for (const t of overlays.threat) {
      // Deeper where more attackers converge, but kept light enough to see through.
      const intensity = Math.min(0.26, 0.09 + t.damage * 0.02);
      fillTile(ctx, cam, t.at, `rgba(229, 72, 77, ${intensity})`);
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Stroke only the edges facing a tile nobody can reach.
    for (const t of overlays.threat) {
      const { x, y } = t.at;
      const corners = [
        cam.worldToScreen(x, y),
        cam.worldToScreen(x + 1, y),
        cam.worldToScreen(x + 1, y + 1),
        cam.worldToScreen(x, y + 1),
      ];
      const neighbours: Coord[] = [
        { x, y: y - 1 },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x - 1, y },
      ];

      for (let i = 0; i < 4; i++) {
        if (threatened.has(coordKey(neighbours[i]!))) continue;
        const a = corners[i]!;
        const b = corners[(i + 1) % 4]!;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // With Shift held, put the actual incoming number on each tile.
    if (!overlays.expanded) return;
    ctx.save();
    ctx.font = `700 ${Math.round(11 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of overlays.threat) {
      const p = cam.tileCenter(t.at);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(`${t.damage}`, p.x, p.y);
      ctx.fillStyle = '#fecaca';
      ctx.fillText(`${t.damage}`, p.x, p.y);
    }
    ctx.restore();
  }

  /**
   * Steam fog: a soft drifting cloud. Drawn under the units so a unit standing in it is
   * still clearly readable — the fog hides what is *behind* it, not what is in it.
   */
  private drawHazards(pulse: number): void {
    const { ctx, cam } = this;

    // Rubble first and flat to the ground: it is the floor, not something on it.
    for (const h of this.overlays.hazards) {
      if (h.kind !== 'rubble') continue;
      const p = cam.tileCenter(h.at);
      ctx.save();
      ctx.globalAlpha = 0.55;
      // Scattered chips of stone, deterministic per tile so they do not crawl.
      for (let i = 0; i < 7; i++) {
        const a = ((h.at.x * 7 + h.at.y * 13 + i * 29) % 360) * (Math.PI / 180);
        const r = (0.1 + ((i * 37) % 100) / 320) * cam.tileW * 0.5;
        const size = (1.6 + (i % 3) * 0.9) * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(
          p.x + Math.cos(a) * r,
          p.y + Math.sin(a) * r * (cam.tileH / cam.tileW),
          size,
          size * 0.6,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = i % 2 ? '#6b7280' : '#4b5563';
        ctx.fill();
      }
      ctx.restore();
    }

    for (const h of this.overlays.hazards) {
      if (h.kind !== 'steam_fog') continue;
      const p = cam.tileCenter(h.at);
      ctx.save();
      // Thinning as it ages gives the player a read on how long it has left.
      ctx.globalAlpha = 0.2 + 0.1 * pulse + Math.min(0.22, h.turns * 0.09);
      for (let i = 0; i < 4; i++) {
        const drift = Math.sin(pulse * Math.PI * 2 + i) * 5 * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(
          p.x + drift + (i - 1.5) * 9 * cam.zoom,
          p.y - (6 + i * 3) * cam.zoom,
          (cam.tileW / 2) * 0.44,
          (cam.tileH / 2) * 0.62,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = i % 2 ? '#e2f4ff' : '#b9dcec';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * The enemy's declared turn, drawn on the board.
   *
   * Deliberately loud. A telegraph the player can overlook is worth nothing — the entire
   * mechanic rests on them having seen it before they commit to their own turn.
   */
  private drawIntents(pulse: number): void {
    const { ctx, cam, overlays } = this;
    if (overlays.intents.length === 0) return;

    // A blow aimed at the Commander has no tile — it is aimed at the player. Drawn as a
    // line to the Hero model, because "7 damage is coming at your Pact" is the single
    // most decision-changing thing on the board.
    const hero = this.commanders.find((m) => m.side === 'player' && m.kind === 'hero');
    for (const intent of overlays.intents) {
      if (intent.at || intent.kind !== 'commander' || !hero) continue;
      const source = this.views.get(intent.unitId);
      if (!source) continue;

      const from = cam.worldToScreen(source.pos.x + 0.5, source.pos.y + 0.5, 18 * cam.zoom);
      const to = cam.worldToScreen(hero.at.x + 0.5, hero.at.y + 0.5, 30 * cam.zoom);

      ctx.save();
      ctx.globalAlpha = 0.55 + 0.25 * pulse;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -(this.clock / 20) % 12;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();

      // The number rides the line rather than the endpoint, so several do not stack up.
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      ctx.save();
      ctx.font = `800 ${Math.round(13 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(String(intent.damage), mid.x, mid.y);
      ctx.fillStyle = '#fecaca';
      ctx.fillText(String(intent.damage), mid.x, mid.y);
      ctx.restore();
    }

    for (const intent of overlays.intents) {
      if (!intent.at) continue;
      const target = cam.tileCenter(intent.at);
      const source = this.views.get(intent.unitId);

      // Marked tile: a filled diamond that breathes, so it reads even under a unit.
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.16 * pulse;
      fillTile(ctx, cam, intent.at, 'rgba(229, 72, 77, 0.9)');
      ctx.restore();

      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(this.clock / 28) % 10;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
      ctx.lineWidth = 2.5;
      tilePath(ctx, cam, intent.at);
      ctx.stroke();
      ctx.restore();

      // The line of attack, so it is obvious *who* is throwing the blow.
      if (source) {
        const from = cam.worldToScreen(source.pos.x + 0.5, source.pos.y + 0.5, 18 * cam.zoom);
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -(this.clock / 22) % 10;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.restore();
      }

      // The number, which is the part that actually informs the decision.
      if (intent.damage > 0) {
        const label = String(intent.damage);
        ctx.save();
        ctx.font = `800 ${Math.round(15 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const y = target.y - 4 * cam.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(label, target.x, y);
        ctx.fillStyle = '#fecaca';
        ctx.fillText(label, target.x, y);
        ctx.restore();
      } else if (intent.label) {
        ctx.save();
        ctx.font = `700 ${Math.round(9 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(intent.label, target.x, target.y - 2 * cam.zoom);
        ctx.fillStyle = '#fde68a';
        ctx.fillText(intent.label, target.x, target.y - 2 * cam.zoom);
        ctx.restore();
      }
    }
  }

  /**
   * A category badge over every enemy that has committed to something.
   *
   * Deliberately **vague**: a blade, a boot, an orb. It answers "is that thing coming for
   * me, repositioning, or casting" and refuses to answer "at whom, for how much" — the
   * precise trajectory lines are a separate overlay, reserved for what earns them.
   *
   * Drawn over the body rather than over the destination, because the question is about
   * that creature. The lines already say where.
   */
  private drawIntentBadges(pulse: number): void {
    const { ctx, cam, overlays } = this;

    for (const intent of overlays.intents) {
      // Declared card plays are keyed `card:<id>` and have no body to sit over.
      const view = this.views.get(intent.unitId);
      if (!view || view.dead) continue;

      const span = view.snapshot?.footprint === 2 ? 0.5 : 0;
      const centre = cam.worldToScreen(
        view.pos.x + 0.5 + span,
        view.pos.y + 0.5 + span,
        (54 + view.elev) * cam.zoom,
      );
      const r = 10 * cam.zoom;
      const hostile = intent.kind === 'attack' || intent.kind === 'commander';

      ctx.save();
      ctx.translate(centre.x, centre.y);
      ctx.globalAlpha = 0.82 + 0.18 * pulse;

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = hostile ? 'rgba(60, 12, 16, 0.9)' : 'rgba(12, 16, 26, 0.88)';
      ctx.fill();
      ctx.strokeStyle = hostile ? 'rgba(248, 113, 113, 0.9)' : 'rgba(148, 163, 184, 0.8)';
      ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
      ctx.stroke();

      ctx.strokeStyle = hostile ? '#FECACA' : '#CBD5E1';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = Math.max(1.2, 1.6 * cam.zoom);
      ctx.lineCap = 'round';
      const u = r * 0.5;

      if (intent.kind === 'move') {
        // A boot: sole and upper.
        ctx.beginPath();
        ctx.moveTo(-u * 0.7, -u);
        ctx.lineTo(-u * 0.7, u * 0.5);
        ctx.lineTo(u, u * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-u, u);
        ctx.lineTo(u, u);
        ctx.stroke();
      } else if (intent.kind === 'channel' || intent.kind === 'card') {
        // An orb with a spark through it.
        ctx.beginPath();
        ctx.arc(0, 0, u * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -u * 1.25);
        ctx.lineTo(0, -u * 0.75);
        ctx.moveTo(0, u * 0.75);
        ctx.lineTo(0, u * 1.25);
        ctx.stroke();
      } else {
        // A blade on the diagonal, matching the melee reach badge.
        ctx.beginPath();
        ctx.moveTo(-u, u);
        ctx.lineTo(u, -u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-u * 0.2, -u * 0.9);
        ctx.lineTo(u * 0.9, u * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawCommanderModel(c: CommanderModel, pulse: number): void {
    const { ctx, cam } = this;

    // The entrance march: everyone walks in along their row from offstage. The player's
    // figures come in from the left and the enemy's from the right, so the two sides
    // visibly arrive from their own wings. The Hero walks it on real frames; a beast
    // slides, which suits a body that was never drawn with legs in mind.
    let at = c.at;
    let walk: { sheet: HTMLImageElement; frame: number; mirror: boolean } | null = null;
    const ent = this.commanderEntrance;
    if (ent) {
      const elapsed = performance.now() - ent.startedAt;
      if (elapsed >= ent.durationMs) {
        this.commanderEntrance = null;
      } else {
        const k = Math.min(1, Math.max(0, elapsed / ent.durationMs));
        const eased = 1 - (1 - k) * (1 - k);
        const fromLeft = c.side === 'player';
        const span = 3.2 * (1 - eased);
        at = { x: c.at.x + (fromLeft ? -span : span), y: c.at.y };
        if (c.kind === 'hero' && c.walkSheet) {
          // Frame from ground covered rather than a timer, in miniature: the eased span
          // is the distance walked, and five sheet frames make one step.
          const covered = 3.2 * eased;
          walk = {
            sheet: c.walkSheet,
            frame: Math.floor(covered * 5),
            // The sheet's profile walks leftward; a figure travelling +x mirrors it.
            mirror: fromLeft,
          };
        }
      }
    }

    const centre = cam.worldToScreen(at.x + 0.5, at.y + 0.5, 0);
    drawCommander(ctx, cam, centre, {
      school: c.school,
      ally: c.side === 'player',
      kind: c.kind,
      hp: c.hp,
      maxHp: c.maxHp,
      armor: c.armor,
      name: c.name,
      pulse,
      art: c.art ?? null,
      walk,
    });
  }

  /** Hit-tests a screen point against the Commander models standing beside the board. */
  commanderAt(sx: number, sy: number): CommanderModel | null {
    const { cam } = this;
    for (const c of this.commanders) {
      const centre = cam.worldToScreen(c.at.x + 0.5, c.at.y + 0.5, 0);
      const dx = (sx - centre.x) / (cam.tileW / 2);
      const dy = (sy - centre.y) / (cam.tileH / 2);
      // Generous vertical reach so clicking the model's body counts, not just its dais.
      if (dx * dx + dy * dy <= 1.1 || (Math.abs(dx) < 0.7 && sy < centre.y && centre.y - sy < 80 * cam.zoom)) {
        return c;
      }
    }
    return null;
  }

  private drawTiles(): void {
    const { ctx, cam } = this;
    for (let y = 0; y < cam.gridH; y++) {
      for (let x = 0; x < cam.gridW; x++) {
        // Faint territory tinting makes the three zones readable at a glance.
        const depth = this.territoryDepth;
        const tint =
          y >= cam.gridH - depth
            ? PALETTE.playerTint
            : y <= depth - 1
              ? PALETTE.enemyTint
              : PALETTE.neutralTint;
        drawTile(ctx, cam, { x, y }, { tint, checker: (x + y) % 2 === 0 });
      }
    }
  }

  private drawOverlays(pulse: number): void {
    const { ctx, cam, overlays } = this;

    // Danger zone first, underneath everything else: it is context, not a choice.
    if (overlays.showThreat && overlays.threat.length) this.drawThreat();

    // Refusals under the offers, so a legal tile is never drawn on top of its own denial.
    // Dimming first, then hatching: a tile can be both out of shape *and* out of sight,
    // and the sight answer is the more specific one.
    for (const c of overlays.dimmed) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      fillTile(ctx, cam, c, 'rgba(8, 11, 18, 0.42)');
      ctx.restore();
    }

    for (const c of overlays.fog) hatchTile(ctx, cam, c);

    // Soul Pyres, under the offers and over the refusals: the ground remembers a body
    // fell here whether or not you can do anything about it this turn. Drawn cool and
    // slow — a marker, not a prompt — so a lit anchor still reads as the brighter thing.
    for (const c of overlays.pyres) {
      ctx.save();
      ctx.globalAlpha = 0.30 + 0.22 * pulse;
      fillTile(ctx, cam, c, PALETTE.pyreFill, PALETTE.pyreEdge);
      ctx.restore();
      this.drawPyreFlame(c, pulse);
    }

    // The reach ring, under the offers: it is the *shape* of what this body threatens, and
    // a player counting tiles wants it behind the brighter answer to "what may I hit".
    // Faint on purpose — it is a ruler, not a prompt.
    for (const c of overlays.reach) {
      fillTile(ctx, cam, c, PALETTE.reachFill, PALETTE.reachEdge);
    }

    for (const c of overlays.highlight) {
      fillTile(ctx, cam, c, PALETTE.highlightFill, PALETTE.highlight);
    }
    for (const c of overlays.attack) {
      fillTile(ctx, cam, c, PALETTE.attackFill, PALETTE.attackEdge);
    }

    // Where the cast actually lands, over the tiles you may aim at. Pulsed, because it is
    // the one overlay that answers a question about *this moment* — move the cursor and it
    // is a different shape — and a still fill reads as scenery.
    if (overlays.impact.length) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.30 * pulse;
      for (const c of overlays.impact) {
        fillTile(ctx, cam, c, PALETTE.impactFill, PALETTE.impactEdge);
      }
      ctx.restore();
    }

    // The tile the spell is thrown from, in the Pact's colour so it reads as "this is
    // you, and this is where you are casting from".
    if (overlays.castOrigin) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.35 * pulse;
      fillTile(ctx, cam, overlays.castOrigin, 'rgba(125, 211, 252, 0.10)', PALETTE.pact);
      ctx.restore();
    }

    // The selection ring, around the whole body. `selectedCells` is authoritative; the
    // single `selected` anchor remains for anything still reading it.
    const ringed = overlays.selectedCells.length
      ? overlays.selectedCells
      : overlays.selected
        ? [overlays.selected]
        : [];
    for (const c of ringed) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.35 * pulse;
      fillTile(ctx, cam, c, 'rgba(255,255,255,0.06)', '#FFFFFF');
      ctx.restore();
    }

    if (overlays.hover) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      fillTile(ctx, cam, overlays.hover, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.55)');
      ctx.restore();
    }
  }

  /**
   * Everything standing on the floor, drawn back to front in one pass.
   *
   * Commanders used to have a pass of their own, ahead of the units. That was survivable
   * only while the board was locked to quarter-turns, where they were reliably at the far
   * end; once it can sit at any angle a Commander is as often in front of a unit as
   * behind one, and a fixed order gets it wrong roughly half the time — a Hero calmly
   * painted underneath a Behemoth it is standing in front of.
   *
   * They are off the grid at fractional coordinates, which is not a special case: the
   * same depth key runs them through the same rotation as everything else, and where
   * they land in the order falls out of the arithmetic.
   */
  private drawBoardObjects(pulse: number): void {
    const { cam } = this;

    // Commanders key on their logical coordinate, not their drawn centre, because that is
    // the convention entities use — a unit sorts on its cell and draws half a tile in.
    // Mixing the two would bias every Commander by half a tile, in a direction that
    // changes with the angle.
    const queue: { depth: number; view?: EntityView; model?: CommanderModel }[] = [];
    const entities = this.views.all();

    for (const view of entities) {
      const footprint = view.snapshot?.footprint ?? 1;
      queue.push({ depth: cam.depthKey(cellsAt(roundCoord(view.pos), footprint)), view });
    }
    for (const model of this.commanders) {
      queue.push({ depth: cam.depthKey([model.at]), model });
    }

    queue.sort((a, b) => a.depth - b.depth);

    // Track occupied screen boxes so 1x1s hidden behind a Behemoth can be silhouetted.
    const behemothBoxes: { x: number; y: number; r: number }[] = [];

    for (const item of queue) {
      if (item.model) this.drawCommanderModel(item.model, pulse);
      else if (item.view) this.drawEntity(item.view, pulse, behemothBoxes);
    }

    this.drawSilhouettes(entities, behemothBoxes);
  }

  private drawEntity(
    view: EntityView,
    pulse: number,
    behemothBoxes: { x: number; y: number; r: number }[],
  ): void {
    const { ctx, cam } = this;
    const footprint = view.snapshot?.footprint ?? 1;
    const centre = cam.worldToScreen(
      view.pos.x + footprint / 2,
      view.pos.y + footprint / 2,
      view.elev,
    );

    const ally = view.snapshot ? view.snapshot.side === 'player' : false;

    ctx.save();
    // Spent units fade back so the eye lands on the ones that can still act.
    // Softened from 0.5 now the tick carries "done": the dim only has to whisper.
    ctx.globalAlpha = view.alpha * (view.spent ? 0.75 : 1);

    if (view.snapshot) {
      // Under the plate: the stain is ground the body is standing in, not paint on it.
      this.drawStatusAura(view, pulse);
      drawBasePlate(ctx, cam, centre, footprint, ally);

      // A unit that has grown mechanically should look it. Scaled about its own feet so
      // it rises off the base plate rather than sinking through it.
      const growth = 1 + Math.min(view.escalation, 6) * ESCALATION_SCALE_PER_STACK;
      const scaled = growth !== 1;
      if (scaled) {
        ctx.save();
        ctx.translate(centre.x, centre.y);
        ctx.scale(growth, growth);
        ctx.translate(-centre.x, -centre.y);
      }

      drawUnitBody(ctx, cam, centre, {
        archetype: view.snapshot.archetype,
        school: view.snapshot.school,
        footprint,
        ally,
        bob: (this.clock / 1400) % 1,
        // The board's clock, offset per unit so a line of the same archetype breathes
        // out of step. The seed is stable across frames because the id is.
        idleMs: this.clock + idleSeed(view.id),
      });

      if (scaled) ctx.restore();

      // The status wash, over the body it just landed on. Additive, so it reads as light
      // falling on the piece rather than as the piece having been repainted -- a body that
      // changed colour would look like a different unit for as long as the flash lasted.
      if (view.flash && view.flash.life > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = view.flash.life * 0.55;
        ctx.beginPath();
        ctx.ellipse(
          centre.x,
          centre.y - 18 * cam.zoom,
          26 * cam.zoom * footprint,
          30 * cam.zoom * footprint,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = view.flash.color;
        ctx.fill();
        ctx.restore();
      }
    } else if (view.obstacle?.cover) {
      // Cover is knee-high: it must read as something you walk through, not around.
      drawCover(ctx, cam, centre);
    } else if (view.obstacle) {
      drawUnitBody(ctx, cam, centre, {
        archetype: 'obstacle',
        school: 'neutral',
        footprint: 1,
        ally: false,
        bob: 0,
      });
    }

    // The brand, the numbers and the statuses, all of which the district's board wears too.
    // Shared rather than duplicated: see `drawBodyFurniture`.
    drawBodyFurniture(ctx, centre, cam.zoom, view, pulse);

    ctx.restore();

    if (footprint === 2) {
      behemothBoxes.push({ x: centre.x, y: centre.y, r: cam.tileW * 1.1 });
    }
  }

  /**
   * Anything a Behemoth swallowed gets a flat team-colour ghost, so the board never fully
   * hides a unit.
   *
   * Kept to the units: a Commander is drawn beside the board rather than on it, and
   * ghosting one would suggest a piece was hidden when it is simply standing off-grid.
   */
  private drawSilhouettes(
    entities: EntityView[],
    behemothBoxes: { x: number; y: number; r: number }[],
  ): void {
    const { ctx, cam } = this;
    for (const view of entities) {
      const footprint = view.snapshot?.footprint ?? 1;
      if (footprint === 2 || !view.snapshot) continue;
      const centre = cam.worldToScreen(view.pos.x + 0.5, view.pos.y + 0.5, view.elev);
      const hidden = behemothBoxes.some(
        (b) => Math.hypot(centre.x - b.x, (centre.y - b.y) * 1.8) < b.r && centre.y < b.y,
      );
      if (!hidden) continue;

      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = view.snapshot.side === 'player' ? PALETTE.allyBase : PALETTE.enemyBase;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y - 18 * cam.zoom, 14 * cam.zoom, 22 * cam.zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * The flight a shot would take, in the school's own colour.
   *
   * Drawn above the tiles and below the bodies, so a line reads as passing *behind* what
   * it is aimed at rather than being painted over it.
   *
   * A straight cast is a dashed line; an `arcing` one is lifted into a parabola. That
   * difference is the whole point of the pass: an arcing shot and a flat one can cover
   * exactly the same tiles and differ completely in what they are allowed to cross, and
   * on an isometric board there is no other way to show which one you are holding.
   */
  private drawTrajectories(pulse: number): void {
    const { ctx, cam, overlays } = this;
    if (overlays.trajectory.length === 0) return;

    for (const shot of overlays.trajectory) {
      const colour = schoolColour(shot.school);
      const from = cam.worldToScreen(shot.from.x + 0.5, shot.from.y + 0.5, 16 * cam.zoom);
      const to = cam.worldToScreen(shot.to.x + 0.5, shot.to.y + 0.5, 16 * cam.zoom);

      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * pulse;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1.5, 2.5 * cam.zoom);
      ctx.lineCap = 'round';
      ctx.setLineDash([6, 5]);
      // Crawls toward the target, so the line reads as a direction rather than a tether.
      ctx.lineDashOffset = -(this.clock / 14) % 11;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      if (shot.arcing) {
        // Height scaled to span: a lob across the board climbs, a lob next door barely
        // leaves the ground, which is what makes the blind spot legible.
        const span = Math.hypot(to.x - from.x, to.y - from.y);
        const lift = Math.min(90, 26 + span * 0.32) * cam.zoom;
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
        ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
      } else {
        ctx.lineTo(to.x, to.y);
      }
      ctx.stroke();

      // A mark where it lands, so the end of the line is a point rather than a fade.
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.75 + 0.25 * pulse;
      ctx.beginPath();
      ctx.arc(to.x, to.y, Math.max(2.5, 4 * cam.zoom), 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Reach badges beside a selected body's stat bar.
   *
   * Three shapes rather than three words, because this sits on the board rather than in a
   * panel and has to be readable at a glance and at any zoom: a blade for melee, a
   * crosshair for a straight shot, an arc for a lob. Only the lob carries numbers, and
   * only because its **minimum** is a rule nothing else on the board expresses — a mortar
   * that cannot defend its own feet looks exactly like one that can.
   */
  private drawReachBadges(): void {
    const { ctx, cam, overlays } = this;
    if (overlays.badges.length === 0) return;

    for (const badge of overlays.badges) {
      const view = this.views.get(badge.unitId);
      if (!view || view.dead) continue;

      const span = view.snapshot?.footprint === 2 ? 0.5 : 0;
      const centre = cam.worldToScreen(
        view.pos.x + 0.5 + span,
        view.pos.y + 0.5 + span,
        (34 + view.elev) * cam.zoom,
      );
      // Beside the stat bar rather than under it: the bar is a number that changes and
      // this is a fact that does not, so they must not be mistaken for one reading.
      const x = centre.x + 26 * cam.zoom;
      const y = centre.y - 34 * cam.zoom;
      const r = 9 * cam.zoom;

      ctx.save();
      ctx.translate(x, y);

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(9, 12, 20, 0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
      ctx.stroke();

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1.2, 1.6 * cam.zoom);
      ctx.lineCap = 'round';
      const u = r * 0.55;

      if (badge.profile === 'melee') {
        // A blade on the diagonal, with a crossguard.
        ctx.beginPath();
        ctx.moveTo(-u, u);
        ctx.lineTo(u, -u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-u * 0.2, -u * 0.9);
        ctx.lineTo(u * 0.9, u * 0.2);
        ctx.stroke();
      } else if (badge.profile === 'ranged') {
        // A crosshair: a ring with four ticks.
        ctx.beginPath();
        ctx.arc(0, 0, u * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          ctx.beginPath();
          ctx.moveTo(dx * u * 0.8, dy * u * 0.8);
          ctx.lineTo(dx * u * 1.35, dy * u * 1.35);
          ctx.stroke();
        }
      } else {
        // A lob: an arc over a baseline.
        ctx.beginPath();
        ctx.moveTo(-u, u * 0.7);
        ctx.quadraticCurveTo(0, -u * 1.5, u, u * 0.7);
        ctx.stroke();
      }
      ctx.restore();

      if (badge.profile !== 'melee') {
        // `2–4` for a mortar, `4` for a bow. The dash is only printed when the minimum is
        // a real constraint, so an ordinary archer does not read as having a blind spot.
        const label =
          badge.rangeMin > 1 ? `${badge.rangeMin}\u2013${badge.rangeMax}` : `${badge.rangeMax}`;
        ctx.save();
        ctx.font = `800 ${Math.round(9 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, x, y + r + 7 * cam.zoom);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(label, x, y + r + 7 * cam.zoom);
        ctx.restore();
      }
    }
  }

  /**
   * The colour a status stains a body with, and how strongly.
   *
   * Separate from the chips: a chip is a *count* you read when you look at a unit, and an
   * aura is a *state* you notice without looking. Burning bodies glow, poisoned ones go
   * green at the edges, charged ones hum — all of it legible while your eye is somewhere
   * else on the board, which is the point.
   *
   * Statuses that mean "held in place" share one cold blue, because what matters about
   * Freeze, Entangle, Stun and Anchor at a glance is the same thing: that body is not
   * going anywhere this turn.
   */
  private auraFor(view: EntityView): { colour: string; weight: number } | null {
    const held = ['freeze', 'entangle', 'stun', 'anchor'];
    let best: { colour: string; weight: number } | null = null;

    const consider = (colour: string, weight: number): void => {
      if (!best || weight > best.weight) best = { colour, weight };
    };

    for (const s of view.statuses) {
      const stacks = Math.max(1, s.stacks);
      if (held.includes(s.kind)) consider('#7DD3FC', 3 + stacks);
      else if (s.kind === 'burn') consider('#FF6B35', 2 + stacks);
      else if (s.kind === 'toxin') consider('#4ADE80', 2 + stacks);
      else if (s.kind === 'charged') consider('#FDE047', 2 + stacks);
      else if (s.kind === 'chill') consider('#BAE6FD', 1 + stacks);
      else if (s.kind === 'brittle') consider('#B49CF0', 1 + stacks);
      else if (s.kind === 'aetherPlated') consider('#E2E8F0', 9);
    }
    return best;
  }

  /**
   * The stain itself: a soft ring on the floor under the body.
   *
   * Under rather than over, so it never competes with the token's own silhouette — a
   * status is a condition the body is standing in, not a hat it is wearing.
   */
  private drawStatusAura(view: EntityView, pulse: number): void {
    const aura = this.auraFor(view);
    if (!aura) return;

    const { ctx, cam } = this;
    const span = view.snapshot?.footprint === 2 ? 0.5 : 0;
    const centre = cam.worldToScreen(view.pos.x + 0.5 + span, view.pos.y + 0.5 + span, 0);
    const r = (view.snapshot?.footprint === 2 ? 46 : 26) * cam.zoom;

    ctx.save();
    ctx.globalAlpha = (0.16 + 0.12 * pulse) * Math.min(1, aura.weight / 6) * view.alpha;
    ctx.translate(centre.x, centre.y);
    // Squashed into the floor plane, like every other ground mark on the board.
    ctx.scale(1, TILE_H / TILE_W);
    const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    grad.addColorStop(0, aura.colour);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Trajectory ghosting: one translucent copy per unit the cast would move. */
  private drawGhosts(): void {
    for (const ghost of this.overlays.ghosts) {
      if (ghost.path.length >= 2) this.drawGhost(ghost);
    }
  }

  private drawGhost(ghost: { unitId: UnitId; path: Coord[]; crashAt?: Coord }): void {
    const { ctx, cam } = this;
    const view = this.views.get(ghost.unitId);
    if (!view?.snapshot) return;

    // Loop the ghost along the path unless prediction is frozen with Shift.
    const k = this.overlays.expanded ? 1 : ((this.clock / 900) % 1);
    const total = ghost.path.length - 1;
    const idx = Math.min(total - 1, Math.floor(k * total));
    const frac = k * total - idx;
    const from = ghost.path[idx]!;
    const to = ghost.path[idx + 1]!;
    const pos = { x: from.x + (to.x - from.x) * frac, y: from.y + (to.y - from.y) * frac };

    const footprint = view.snapshot.footprint;
    const centre = cam.worldToScreen(pos.x + footprint / 2, pos.y + footprint / 2, 0);

    ctx.save();
    ctx.globalAlpha = 0.45;
    drawUnitBody(ctx, cam, centre, {
      archetype: view.snapshot.archetype,
      school: view.snapshot.school,
      footprint,
      ally: view.snapshot.side === 'player',
      bob: 0,
    });
    ctx.restore();

    // Dotted trail along the vector.
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = PALETTE.ghost;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const start = cam.tileCenter(ghost.path[0]!);
    ctx.moveTo(start.x, start.y);
    for (const p of ghost.path.slice(1)) {
      const q = cam.tileCenter(p);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.restore();

    if (ghost.crashAt) {
      const c = cam.tileCenter(ghost.crashAt);
      ctx.save();
      ctx.translate(c.x, c.y - 6);
      ctx.rotate(-0.12);
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `800 ${Math.round(15 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText('CRASH', 0, 0);
      ctx.fillText('CRASH', 0, 0);
      ctx.restore();
    }
  }

  /**
   * Numeric damage badges. By default only the direct hits show; holding Shift expands
   * to every affected tile, so the normal case stays readable.
   */
  private drawPredictions(): void {
    const { ctx, cam, overlays } = this;
    if (overlays.predicted.length === 0) return;

    const shown = overlays.expanded
      ? overlays.predicted
      : overlays.predicted.filter((p) => p.kind === 'hit');

    const seen = new Set<string>();
    for (const p of shown) {
      const key = coordKey(p.at);
      if (seen.has(key)) continue;
      seen.add(key);

      if (p.kind === 'aoe' && !overlays.expanded) continue;
      const centre = cam.tileCenter(p.at);

      ctx.save();
      if (p.damage !== undefined) {
        ctx.font = `800 ${Math.round(15 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(`-${p.damage}`, centre.x, centre.y - 34 * cam.zoom);
        ctx.fillStyle = PALETTE.danger;
        ctx.fillText(`-${p.damage}`, centre.x, centre.y - 34 * cam.zoom);
      } else {
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = PALETTE.danger;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        fillTile(ctx, cam, p.at, 'rgba(248,113,113,0.14)');
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/** A school's line colour, defaulting to neutral for anything unrecognised. */
function schoolColour(school: string): string {
  return schoolOf(school as School).main;
}

function roundCoord(c: Coord): Coord {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}
