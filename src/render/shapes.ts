/**
 * The placeholder art vocabulary — every visual is drawn with canvas paths.
 *
 * The look is deliberate board-game minimalism: units are extruded prisms with a 2px
 * dark outline standing on a team-coloured base plate, so allegiance and archetype read
 * instantly at a glance without a single image asset.
 */

import type { Coord } from '../contract/ids.js';
import type { UnitArchetype } from '../contract/snapshots.js';
import { PALETTE, schoolOf, type SchoolColors } from './palette.js';
import type { IsoCamera } from './IsoCamera.js';
// The painted bodies, reused rather than reimplemented. `drawCommander` there is the *other*
// function of this name -- it blits a bitmap, where the one below draws a prism -- so it is
// aliased at the import to keep the two apart at every call site in this file.
import {
  COMMANDER_HEIGHT_TILES,
  drawCommander as drawHeroBitmap,
  drawCompanionBitmap,
} from './sprites.js';

type Ctx2D = CanvasRenderingContext2D;

/** Traces the diamond top face of one tile. */
export function tilePath(ctx: Ctx2D, cam: IsoCamera, c: Coord): void {
  const a = cam.worldToScreen(c.x, c.y);
  const b = cam.worldToScreen(c.x + 1, c.y);
  const d = cam.worldToScreen(c.x + 1, c.y + 1);
  const e = cam.worldToScreen(c.x, c.y + 1);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(d.x, d.y);
  ctx.lineTo(e.x, e.y);
  ctx.closePath();
}

export function drawTile(
  ctx: Ctx2D,
  cam: IsoCamera,
  c: Coord,
  opts: { tint?: string; checker: boolean },
): void {
  tilePath(ctx, cam, c);
  ctx.fillStyle = opts.checker ? PALETTE.tileA : PALETTE.tileB;
  ctx.fill();
  if (opts.tint) {
    ctx.fillStyle = opts.tint;
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.tileEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Fills a tile with a colour — used for target highlights and fog. */
export function fillTile(ctx: Ctx2D, cam: IsoCamera, c: Coord, fill: string, stroke?: string): void {
  tilePath(ctx, cam, c);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** Diagonal hatching for line-of-sight shadow. */
export function hatchTile(ctx: Ctx2D, cam: IsoCamera, c: Coord): void {
  ctx.save();
  tilePath(ctx, cam, c);
  ctx.clip();
  ctx.fillStyle = PALETTE.fog;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  const p = cam.worldToScreen(c.x, c.y);
  const w = cam.tileW;
  for (let i = -2; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 + i * 10, p.y);
    ctx.lineTo(p.x - w / 2 + i * 10 + cam.tileH, p.y + cam.tileH);
    ctx.stroke();
  }
  ctx.restore();
}

/** The glowing runic boundary framing the arena. */
export function drawBoundary(ctx: Ctx2D, cam: IsoCamera, pulse: number): void {
  const pad = 0.16;
  const corners = [
    cam.worldToScreen(-pad, -pad),
    cam.worldToScreen(cam.gridW + pad, -pad),
    cam.worldToScreen(cam.gridW + pad, cam.gridH + pad),
    cam.worldToScreen(-pad, cam.gridH + pad),
  ];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.strokeStyle = PALETTE.boundary;
  ctx.globalAlpha = 0.35 + 0.25 * pulse;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = PALETTE.boundary;
  ctx.shadowBlur = 14 + 8 * pulse;
  ctx.stroke();

  // Corner glyph dots.
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.boundary;
    ctx.fill();
  }
  ctx.restore();
}

/** The elliptical miniature base that marks allegiance. */
export function drawBasePlate(
  ctx: Ctx2D,
  cam: IsoCamera,
  centre: { x: number; y: number },
  footprint: 1 | 2,
  ally: boolean,
): void {
  const rx = (cam.tileW / 2) * (footprint === 2 ? 1.75 : 0.78);
  const ry = (cam.tileH / 2) * (footprint === 2 ? 1.75 : 0.78);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = ally ? PALETTE.allyBase : PALETTE.enemyBase;
  ctx.globalAlpha = 0.32;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = ally ? PALETTE.allyBase : PALETTE.enemyBase;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws an extruded prism body: light top face, mid left face, dark right face.
 * `profile` supplies the top-face outline in unit space (-1..1), which is what gives
 * each archetype its silhouette.
 */
function drawPrism(
  ctx: Ctx2D,
  cam: IsoCamera,
  centre: { x: number; y: number },
  profile: [number, number][],
  scale: number,
  height: number,
  colors: SchoolColors,
): void {
  const sx = (cam.tileW / 2) * scale;
  const sy = (cam.tileH / 2) * scale;

  const top = profile.map(([px, py]) => ({
    x: centre.x + (px - py) * sx,
    y: centre.y + (px + py) * sy - height,
  }));
  const bottom = profile.map(([px, py]) => ({
    x: centre.x + (px - py) * sx,
    y: centre.y + (px + py) * sy,
  }));

  // Side walls, drawn back-to-front by their lowest edge.
  const walls = profile.map((_, i) => {
    const j = (i + 1) % profile.length;
    return { i, j, depth: (bottom[i]!.y + bottom[j]!.y) / 2 };
  });
  walls.sort((a, b) => a.depth - b.depth);

  for (const w of walls) {
    ctx.beginPath();
    ctx.moveTo(top[w.i]!.x, top[w.i]!.y);
    ctx.lineTo(top[w.j]!.x, top[w.j]!.y);
    ctx.lineTo(bottom[w.j]!.x, bottom[w.j]!.y);
    ctx.lineTo(bottom[w.i]!.x, bottom[w.i]!.y);
    ctx.closePath();
    // Faces pointing right catch less light.
    const facingRight = bottom[w.j]!.x > bottom[w.i]!.x;
    ctx.fillStyle = facingRight ? colors.deep : shade(colors.main, -0.35);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Top face.
  ctx.beginPath();
  ctx.moveTo(top[0]!.x, top[0]!.y);
  for (const p of top.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = colors.main;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const SQUARE: [number, number][] = [
  [-0.62, -0.62],
  [0.62, -0.62],
  [0.62, 0.62],
  [-0.62, 0.62],
];

const HEX: [number, number][] = [
  [-0.7, -0.3],
  [0, -0.72],
  [0.7, -0.3],
  [0.7, 0.3],
  [0, 0.72],
  [-0.7, 0.3],
];

const KITE: [number, number][] = [
  [0, -0.8],
  [0.5, 0],
  [0, 0.8],
  [-0.5, 0],
];

export interface UnitDrawOptions {
  archetype: UnitArchetype;
  school: string;
  footprint: 1 | 2;
  ally: boolean;
  /** 0..1 bob phase for floating casters. */
  bob: number;
  dim?: boolean;
}

export function drawUnitBody(
  ctx: Ctx2D,
  cam: IsoCamera,
  centre: { x: number; y: number },
  o: UnitDrawOptions,
): void {
  const colors = schoolOf(o.school as never);
  ctx.save();
  if (o.dim) ctx.globalAlpha = 0.45;

  switch (o.archetype) {
    case 'bruiser':
      drawPrism(ctx, cam, centre, HEX, 0.62, 30 * cam.zoom, colors);
      drawShieldGlyph(ctx, centre, 30 * cam.zoom, cam.zoom);
      break;

    case 'skirmisher':
      drawPrism(ctx, cam, centre, KITE, 0.58, 40 * cam.zoom, colors);
      break;

    case 'caster': {
      // A floating orb rather than a prism, bobbing gently.
      const lift = (26 + Math.sin(o.bob * Math.PI * 2) * 5) * cam.zoom;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y - lift, 15 * cam.zoom, 15 * cam.zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = colors.main;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        centre.x - 4 * cam.zoom,
        centre.y - lift - 4 * cam.zoom,
        5 * cam.zoom,
        4 * cam.zoom,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = colors.light;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      break;
    }

    case 'sniper':
      drawPrism(ctx, cam, centre, SQUARE, 0.4, 52 * cam.zoom, colors);
      break;

    case 'behemoth':
      drawPrism(ctx, cam, centre, HEX, 1.35, 70 * cam.zoom, colors);
      drawCracks(ctx, centre, 70 * cam.zoom, cam.zoom, colors);
      break;

    case 'obstacle':
      drawPrism(ctx, cam, centre, SQUARE, 0.55, 46 * cam.zoom, {
        main: '#6B7280',
        deep: '#2F3540',
        light: '#9CA3AF',
      });
      break;
  }

  ctx.restore();
}

function drawShieldGlyph(ctx: Ctx2D, centre: { x: number; y: number }, h: number, z: number): void {
  ctx.save();
  ctx.translate(centre.x, centre.y - h);
  ctx.beginPath();
  ctx.moveTo(0, -8 * z);
  ctx.lineTo(7 * z, -3 * z);
  ctx.lineTo(7 * z, 3 * z);
  ctx.lineTo(0, 9 * z);
  ctx.lineTo(-7 * z, 3 * z);
  ctx.lineTo(-7 * z, -3 * z);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();
}

function drawCracks(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  h: number,
  z: number,
  colors: SchoolColors,
): void {
  ctx.save();
  ctx.translate(centre.x, centre.y - h);
  ctx.strokeStyle = colors.deep;
  ctx.lineWidth = 2.5 * z;
  ctx.beginPath();
  ctx.moveTo(-14 * z, -6 * z);
  ctx.lineTo(-4 * z, 2 * z);
  ctx.lineTo(-8 * z, 10 * z);
  ctx.moveTo(6 * z, -10 * z);
  ctx.lineTo(12 * z, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * A Commander standing beside the board — on the field, but off the grid.
 *
 * Drawing them in world space rather than as an abstract HUD portrait is what makes
 * melee reach legible: a unit standing in the enemy's back row is visibly next to the
 * enemy Commander, so "get there and you can hit them" reads without explanation.
 */
export function drawCommander(
  ctx: Ctx2D,
  cam: IsoCamera,
  centre: { x: number; y: number },
  o: {
    school: string;
    ally: boolean;
    kind: 'hero' | 'companion' | 'boss';
    hp: number;
    maxHp: number;
    armor: number;
    name: string;
    pulse: number;
    /**
     * The painted body, when there is one decoded.
     *
     * Null is ordinary rather than exceptional: the art arrives on a fetch, a species may not
     * be painted yet, and a test arena has no character behind it at all. Every one of those
     * falls through to the prism and the orb below, which is what shipped before this and is
     * still the honest thing to draw when nobody knows what the body looks like.
     */
    art?: HTMLImageElement | null;
  },
): void {
  const colors = schoolOf(o.school as never);
  const z = cam.zoom;
  const scale = o.kind === 'companion' ? 0.5 : 0.62;
  const height = (o.kind === 'boss' ? 62 : 54) * z;

  // A dais marks them as standing off the grid rather than occupying a tile.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, (cam.tileW / 2) * 0.9, (cam.tileH / 2) * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = o.ally ? PALETTE.allyBase : PALETTE.enemyBase;
  ctx.globalAlpha = 0.2;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = o.ally ? PALETTE.allyBase : PALETTE.enemyBase;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // The painted body, where there is one. Only the *body* is swapped: the dais above and the
  // name plate and gauge below are what say "this one stands off the grid and this is its
  // health", and they are as necessary over a bitmap as over a prism.
  //
  // `unit` is pixels per tile, derived from the height the prism already occupied rather than
  // picked -- so turning the art on does not resize anybody. `blit` inside these takes its
  // origin at the feet, which is exactly where the dais is drawn.
  if (o.art) {
    const unit = height / COMMANDER_HEIGHT_TILES;
    ctx.save();
    ctx.translate(centre.x, centre.y);
    if (o.kind === 'companion' || o.kind === 'boss') drawCompanionBitmap(ctx, unit, o.art);
    else drawHeroBitmap(ctx, unit, o.art);
    ctx.restore();
  } else if (o.kind === 'companion') {
    const lift = (34 + Math.sin(o.pulse * Math.PI * 2) * 4) * z;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y - lift, 17 * z, 17 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.main;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(centre.x - 5 * z, centre.y - lift - 5 * z, 6 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.light;
    ctx.fill();
    ctx.restore();
  } else {
    drawPrism(ctx, cam, centre, HEX, scale, height, colors);
    // A small crown notch distinguishes a Commander from an ordinary bruiser.
    ctx.save();
    ctx.translate(centre.x, centre.y - height);
    ctx.beginPath();
    ctx.moveTo(-9 * z, 0);
    ctx.lineTo(-5 * z, -9 * z);
    ctx.lineTo(0, -3 * z);
    ctx.lineTo(5 * z, -9 * z);
    ctx.lineTo(9 * z, 0);
    ctx.closePath();
    ctx.fillStyle = colors.light;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Name plate.
  ctx.save();
  ctx.font = `700 ${Math.round(10 * z)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeText(o.name, centre.x, centre.y + 26 * z);
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(o.name, centre.x, centre.y + 26 * z);
  ctx.restore();

  // The Companion shares the Hero's HP pool, so only the Hero and boss show a bar.
  if (o.kind !== 'companion') {
    drawStatBar(ctx, centre, o.hp, o.maxHp, o.armor, 0, z * 1.15);
  }
}

/**
 * Cover terrain: a low bramble screen. Drawn short and see-through so it reads as
 * something you can stand in, unlike the solid pillars that block movement.
 */
export function drawCover(ctx: Ctx2D, cam: IsoCamera, centre: { x: number; y: number }): void {
  const z = cam.zoom;
  const h = 20 * z;

  ctx.save();
  ctx.globalAlpha = 0.72;

  // A cluster of thin fronds rather than a solid mass.
  const blades = 9;
  for (let i = 0; i < blades; i++) {
    const t = i / (blades - 1) - 0.5;
    const x = centre.x + t * cam.tileW * 0.42;
    const y = centre.y + Math.abs(t) * cam.tileH * 0.14;
    const height = h * (0.62 + 0.38 * Math.cos(t * Math.PI));

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3 * z * (i % 2 ? 1 : -1), y - height * 0.6, x + 1.5 * z * t * 4, y - height);
    ctx.strokeStyle = i % 3 === 0 ? '#3f7a52' : '#4ADE80';
    ctx.lineWidth = 2 * z;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Faint ground patch so the occupied tile is unambiguous.
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, (cam.tileW / 2) * 0.6, (cam.tileH / 2) * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4ADE80';
  ctx.fill();
  ctx.restore();
}

/** A mark sigil branded onto the host's top face, pulsing on a slow cycle. */
export function drawMark(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  school: string,
  pulse: number,
  z: number,
): void {
  const colors = schoolOf(school as never);
  ctx.save();
  ctx.translate(centre.x, centre.y);

  ctx.globalAlpha = 0.35 + 0.4 * pulse;
  ctx.beginPath();
  ctx.arc(0, 0, (13 + 5 * pulse) * z, 0, Math.PI * 2);
  ctx.strokeStyle = colors.main;
  ctx.lineWidth = 2 * z;
  ctx.shadowColor = colors.main;
  ctx.shadowBlur = 12;
  ctx.stroke();

  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(0, -8 * z);
  ctx.lineTo(6 * z, 4 * z);
  ctx.lineTo(-6 * z, 4 * z);
  ctx.closePath();
  ctx.moveTo(0, 8 * z);
  ctx.lineTo(0, -2 * z);
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = 2 * z;
  ctx.stroke();
  ctx.restore();
}

/** HP pill and armor chip beneath a unit. */
/**
 * The Bound Form's badge, drawn where an ordinary unit's health bar would be.
 *
 * A bar would be a lie twice over: it is not this unit's health, and it would never
 * move. Instead a slow pulse in the Pact's own colour says the same thing the gauge
 * above says — this thing and your life are one.
 */
export function drawBoundMark(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  z: number,
  pulse: number,
  ally = true,
): void {
  const w = 30 * z;
  const h = 7 * z;
  const x = centre.x - w / 2;
  const y = centre.y + 12 * z;
  const glow = 0.55 + 0.25 * Math.sin(pulse * 2);

  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
  ctx.fill();

  ctx.globalAlpha = glow;
  roundRect(ctx, x + 1.5 * z, y + 1.5 * z, w - 3 * z, h - 3 * z, (h - 3 * z) / 2);
  // Their pool is not yours: the enemy's body pulses in their own colour, or the board
  // would be telling you that hurting it helps you in the way hurting yours hurts you.
  ctx.fillStyle = ally ? PALETTE.pact : PALETTE.enemyBase;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawStatBar(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  hp: number,
  maxHp: number,
  armor: number,
  atk: number,
  z: number,
): void {
  const w = 46 * z;
  const h = 15 * z;
  const x = centre.x - w / 2;
  const y = centre.y + 10 * z;

  roundRect(ctx, x, y, w, h, 4 * z);
  ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // HP fill.
  const frac = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  roundRect(ctx, x + 1, y + 1, (w - 2) * frac, h - 2, 3 * z);
  ctx.fillStyle = frac > 0.5 ? '#4ADE80' : frac > 0.25 ? '#FDE047' : '#F87171';
  ctx.globalAlpha = 0.32;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.font = `600 ${Math.round(10 * z)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  // Commanders pass atk 0: they have no attack of their own, so the slot stays empty.
  if (atk > 0) {
    ctx.textAlign = 'left';
    ctx.fillText(`${atk}`, x + 5 * z, y + h / 2);
    ctx.textAlign = 'right';
    ctx.fillText(`${hp}`, x + w - 5 * z, y + h / 2);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(`${hp}`, centre.x, y + h / 2);
  }

  if (armor > 0) {
    const ax = centre.x + w / 2 + 4 * z;
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + 12 * z, y + 3 * z);
    ctx.lineTo(ax + 12 * z, y + 10 * z);
    ctx.lineTo(ax + 6 * z, y + h);
    ctx.lineTo(ax, y + 10 * z);
    ctx.closePath();
    ctx.fillStyle = '#B0946A';
    ctx.fill();
    ctx.fillStyle = '#1B1F27';
    ctx.font = `700 ${Math.round(9 * z)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${armor}`, ax + 6 * z, y + h / 2);
  }

  ctx.textAlign = 'left';
}

/**
 * Everything a body wears above itself: its brand, its numbers, its statuses.
 *
 * Extracted from `BoardRenderer` when the district's board needed the same set, and shared
 * rather than copied because that list is a *rule* — the Bound Form shows a bound mark instead
 * of a bar because its health is the Pact's and a second gauge would read as a second pool —
 * and a rule written twice is a rule that will eventually be two different rules. Both
 * renderers pass a projected centre and a zoom, which is all of the camera this needs.
 *
 * The view is taken structurally rather than as an `EntityView`, so this file stays free of
 * the render layer above it.
 */
export function drawBodyFurniture(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  z: number,
  view: {
    snapshot: { side: string; keywords: readonly string[]; footprint?: number } | null;
    mark: { school: string } | null;
    hp: number;
    maxHp: number;
    armor: number;
    atk: number;
    escalation: number;
    statuses: readonly { kind: string; stacks: number }[];
    /** Gave up its swing this turn. Optional so older structural callers stay valid. */
    channelled?: boolean;
  },
  pulse: number,
  /**
   * How far above `centre` the brand hangs, in screen pixels — the one measurement here that
   * a caller may have to make for itself.
   *
   * Everything else on a body is anchored just *below* its feet, where `centre` is, and a fixed
   * offset in `z` units is right for any camera. The brand is the exception: it hangs over the
   * body's head, so its offset depends on how tall a body reads relative to a tile, and that
   * ratio is not a constant across renderers. On the 2D board a tile is 116 pixels and a body
   * is drawn 54 tall, and 30 clears it. Out in the district a tile is four world units wide and
   * a body is 1.9 tall, so the same figure lands mid-torso — over the body it is branding, but
   * looking like part of it rather than a mark laid on it.
   *
   * Omitted, the 2D board's own figure is used, which is what it has always drawn.
   */
  brandLift?: number,
): void {
  const footprint = view.snapshot?.footprint ?? 1;

  if (view.mark) {
    const lift = brandLift ?? (footprint === 2 ? 70 : 30) * z;
    drawMark(ctx, { x: centre.x, y: centre.y - lift }, view.mark.school, pulse, z);
  }

  // The Bound Form's health is the Pact's, shown on the gauge above. A bar here would read as
  // a second, separate pool -- and one that never moves.
  if (view.snapshot?.keywords.includes('BoundForm')) {
    drawBoundMark(ctx, centre, z, pulse, view.snapshot.side === 'player');
  } else {
    drawStatBar(ctx, centre, view.hp, view.maxHp, view.armor, view.atk, z);
  }

  if (view.escalation > 0) {
    ctx.fillStyle = '#FDE047';
    ctx.font = `700 ${Math.round(11 * z)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`▲${view.escalation}`, centre.x, centre.y + 40 * z);
    ctx.textAlign = 'left';
  }

  drawStatusChips(ctx, centre, z, view.statuses);

  if (view.channelled) drawChannelGlyph(ctx, centre, z, pulse);
}

/**
 * The mark of a body that channelled: an orb with a spark through it.
 *
 * The same glyph the enemy-intent badge uses for "about to channel", deliberately — one
 * symbol for the act, whether it is forecast or remembered. Worn in Marrow's crimson with
 * the aether-violet glow, because Marrow is what channelling makes, and drawn below the
 * status row so neither crowds the other. It answers the question the plain dim cannot:
 * this body is not merely spent, it spent its swing on purpose.
 */
function drawChannelGlyph(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  z: number,
  pulse: number,
): void {
  const cy = centre.y + 54 * z;
  const u = 5 * z;

  ctx.save();
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.strokeStyle = '#f0567a';
  ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
  ctx.shadowBlur = 8 * z;
  ctx.lineWidth = Math.max(1, 1.4 * z);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(centre.x, cy, u * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centre.x, cy - u * 1.25);
  ctx.lineTo(centre.x, cy - u * 0.75);
  ctx.moveTo(centre.x, cy + u * 0.75);
  ctx.lineTo(centre.x, cy + u * 1.25);
  ctx.stroke();
  ctx.restore();
}

/**
 * The little row of glyphs under a body.
 *
 * Every status the game can apply has a face here. `brittle` and `charged` were the two that
 * fell through to the bullet default — the first is what Superconduct leaves and the second
 * is half of three reactions, so both were invisible exactly when they mattered most.
 */
function drawStatusChips(
  ctx: Ctx2D,
  centre: { x: number; y: number },
  z: number,
  statuses: readonly { kind: string; stacks: number }[],
): void {
  if (statuses.length === 0) return;
  ctx.save();
  ctx.font = `${Math.round(12 * z)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  let dx = -((statuses.length - 1) * 14 * z) / 2;
  for (const st of statuses) {
    ctx.fillText(
      `${STATUS_ICON[st.kind] ?? '•'}${st.stacks > 1 ? st.stacks : ''}`,
      centre.x + dx,
      centre.y + 40 * z,
    );
    dx += 16 * z;
  }
  ctx.restore();
}

const STATUS_ICON: Record<string, string> = {
  burn: '🔥',
  toxin: '☠',
  chill: '❄',
  freeze: '❄',
  entangle: '🌿',
  stun: '💫',
  brittle: '🜃',
  charged: '⚡',
  aetherPlated: '🛡',
  anchor: '⚓',
};

export function roundRect(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Lightens or darkens a hex colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
