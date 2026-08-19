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
import { PALETTE } from './palette.js';
import {
  drawBasePlate,
  drawBoundMark,
  drawBoundary,
  drawCommander,
  drawCover,
  drawRune,
  drawStatBar,
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
  /** Predicted damage badges, shown while previewing. */
  predicted: { at: Coord; damage?: number; kind: string }[];
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
    kind: 'attack' | 'commander' | 'card';
    at?: Coord;
    damage: number;
    label?: string;
  }[];
  /** Whether the threat overlay is currently visible. */
  showThreat: boolean;
  /** Tile a Companion card is being cast from, marked while aiming it. */
  castOrigin: Coord | null;
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
  targetable: boolean;
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
    predicted: [],
    ghosts: [],
    expanded: false,
    threat: [],
    hazards: [],
    intents: [],
    showThreat: false,
    castOrigin: null,
  };
}

export class BoardRenderer {
  private raf: number | null = null;
  private lastTime = 0;
  private clock = 0;
  overlays: Overlays = emptyOverlays();
  commanders: CommanderModel[] = [];
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
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    this.drawIntents(pulse);
    this.drawBoardObjects(pulse);
    this.drawTether();
    this.drawGhosts();
    this.drawPredictions();

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

  private drawCommanderModel(c: CommanderModel, pulse: number): void {
    const { ctx, cam } = this;
    const centre = cam.worldToScreen(c.at.x + 0.5, c.at.y + 0.5, 0);
    drawCommander(ctx, cam, centre, {
      school: c.school,
      ally: c.side === 'player',
      kind: c.kind,
      hp: c.hp,
      maxHp: c.maxHp,
      armor: c.armor,
      name: c.name,
      targetable: c.targetable,
      pulse,
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

    for (const c of overlays.fog) hatchTile(ctx, cam, c);

    for (const c of overlays.highlight) {
      fillTile(ctx, cam, c, PALETTE.highlightFill, PALETTE.highlight);
    }
    for (const c of overlays.attack) {
      fillTile(ctx, cam, c, PALETTE.attackFill, PALETTE.attackEdge);
    }

    // The tile the spell is thrown from, in the Pact's colour so it reads as "this is
    // you, and this is where you are casting from".
    if (overlays.castOrigin) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.35 * pulse;
      fillTile(ctx, cam, overlays.castOrigin, 'rgba(125, 211, 252, 0.10)', PALETTE.pact);
      ctx.restore();
    }

    if (overlays.selected) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.35 * pulse;
      fillTile(ctx, cam, overlays.selected, 'rgba(255,255,255,0.06)', '#FFFFFF');
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
    ctx.globalAlpha = view.alpha * (view.spent ? 0.5 : 1);

    if (view.snapshot) {
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
      });

      if (scaled) ctx.restore();
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

    if (view.rune) {
      const brandY = centre.y - (footprint === 2 ? 70 : 30) * cam.zoom;
      drawRune(ctx, { x: centre.x, y: brandY }, view.rune.school, pulse, cam.zoom);
    }

    // The Bound Form's health is the Pact's, shown on the gauge above. A bar here
    // would read as a second, separate pool -- and one that never moves.
    if (view.snapshot?.keywords.includes('BoundForm')) {
      drawBoundMark(ctx, centre, cam.zoom, pulse, view.snapshot.side === 'player');
    } else {
      drawStatBar(ctx, centre, view.hp, view.maxHp, view.armor, view.atk, cam.zoom);
    }

    if (view.escalation > 0) {
      ctx.fillStyle = '#FDE047';
      ctx.font = `700 ${Math.round(11 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`▲${view.escalation}`, centre.x, centre.y + 40 * cam.zoom);
      ctx.textAlign = 'left';
    }

    this.drawStatusChips(view, centre);

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

  private drawStatusChips(view: EntityView, centre: { x: number; y: number }): void {
    if (view.statuses.length === 0) return;
    const { ctx, cam } = this;
    const icons: Record<string, string> = {
      burn: '🔥',
      toxin: '☠',
      chill: '❄',
      freeze: '❄',
      entangle: '🌿',
      stun: '💫',
    };

    ctx.save();
    ctx.font = `${Math.round(12 * cam.zoom)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    let dx = -((view.statuses.length - 1) * 14 * cam.zoom) / 2;
    for (const s of view.statuses) {
      ctx.fillText(
        `${icons[s.kind] ?? '•'}${s.stacks > 1 ? s.stacks : ''}`,
        centre.x + dx,
        centre.y + 40 * cam.zoom,
      );
      dx += 16 * cam.zoom;
    }
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

function roundCoord(c: Coord): Coord {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}
