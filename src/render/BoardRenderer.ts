/**
 * The board renderer: a requestAnimationFrame loop drawing three passes per frame —
 * tiles, tile overlays (highlights, fog, ghosts), then depth-sorted entities.
 */

import type { Coord, Side, UnitId } from '../contract/ids.js';
import { coordKey } from '../contract/ids.js';
import type { IsoCamera } from './IsoCamera.js';
import type { EntityViewMap, EntityView } from './EntityViews.js';
import type { Fx } from './Fx.js';
import { PALETTE } from './palette.js';
import {
  drawBasePlate,
  drawBoundary,
  drawCommander,
  drawCover,
  drawRune,
  drawStatBar,
  drawTile,
  drawUnitBody,
  fillTile,
  hatchTile,
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
  /** Trajectory ghost: a translucent copy sliding to the collision point. */
  ghost: { unitId: UnitId; path: Coord[]; crashAt?: Coord } | null;
  /** Shift-held expanded prediction. */
  expanded: boolean;
  /** Tiles enemies can strike next turn, with incoming damage. */
  threat: { at: Coord; damage: number }[];
  /** Lingering tile hazards, drawn under the entities. */
  hazards: { at: Coord; kind: string; turns: number }[];
  /** Whether the threat overlay is currently visible. */
  showThreat: boolean;
}

/** A Commander standing beside the board: on the field, off the grid. */
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

export function emptyOverlays(): Overlays {
  return {
    highlight: [],
    attack: [],
    fog: [],
    hover: null,
    selected: null,
    predicted: [],
    ghost: null,
    expanded: false,
    threat: [],
    hazards: [],
    showThreat: false,
  };
}

export class BoardRenderer {
  private raf: number | null = null;
  private lastTime = 0;
  private clock = 0;
  overlays: Overlays = emptyOverlays();
  commanders: CommanderModel[] = [];
  /** Column the player's Companion watches, highlighted as its Resonance lane. */
  resonanceLane: number | null = null;

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

    this.drawTiles();
    drawBoundary(ctx, cam, pulse);
    this.drawResonanceLane(pulse);
    this.drawHazards(pulse);
    this.drawOverlays(pulse);
    this.drawCommanders(pulse);
    this.drawEntities(pulse);
    this.drawGhost();
    this.drawPredictions();

    this.fx.draw(ctx, rect.width, rect.height);
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

  private drawCommanders(pulse: number): void {
    const { ctx, cam } = this;
    for (const c of this.commanders) {
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
        const tint =
          y >= cam.gridH - 2
            ? PALETTE.playerTint
            : y <= 1
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

  private drawEntities(pulse: number): void {
    const { ctx, cam } = this;

    const sorted = this.views.all().slice().sort((a, b) => {
      const fa = a.snapshot?.footprint ?? 1;
      const fb = b.snapshot?.footprint ?? 1;
      return (
        cam.depthKey(cellsAt(roundCoord(a.pos), fa)) -
        cam.depthKey(cellsAt(roundCoord(b.pos), fb))
      );
    });

    // Track occupied screen boxes so 1x1s hidden behind a Behemoth can be silhouetted.
    const behemothBoxes: { x: number; y: number; r: number }[] = [];

    for (const view of sorted) {
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
        drawUnitBody(ctx, cam, centre, {
          archetype: view.snapshot.archetype,
          school: view.snapshot.school,
          footprint,
          ally,
          bob: (this.clock / 1400) % 1,
        });
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

      drawStatBar(ctx, centre, view.hp, view.maxHp, view.armor, view.atk, cam.zoom);

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

    // Silhouette pass: anything a Behemoth swallowed gets a flat team-colour ghost so
    // the board never hides a unit. This replaces the need for a rotating camera.
    for (const view of sorted) {
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

  /** Trajectory ghosting: a translucent copy sliding along the displacement vector. */
  private drawGhost(): void {
    const ghost = this.overlays.ghost;
    if (!ghost || ghost.path.length < 2) return;

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
