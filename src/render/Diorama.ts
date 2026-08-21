/**
 * The HD-2D diorama: a 3D-feeling stage with 2D actors standing on it.
 *
 * What makes the Octopath look work is not a 3D engine — it is three specific tricks, and
 * all three are reachable with a 2D canvas and a projection matrix:
 *
 *  1. **The ground is tilted, the actors are not.** The tile field is projected as if the
 *     camera were low and looking along it; sprites are drawn upright at the projected
 *     position of their feet. That contradiction — a receding floor under a straight-on
 *     character — *is* the HD-2D signature. Real 3D sprites would have to be billboarded
 *     to fake it; here it is simply how they are drawn.
 *  2. **Tilt-shift.** A narrow band of the frame is sharp and everything above and below
 *     falls off, which is what tells the eye it is looking at something small and lit from
 *     close up. Done as a vertical alpha ramp over a blurred copy, so it costs one extra
 *     canvas rather than a shader.
 *  3. **Depth haze.** Distant tiles wash toward the sky colour. Cheap, and it does most of
 *     the work of selling the ground as receding rather than merely squashed.
 *
 * Deliberately dependency-free and deliberately *not* the combat renderer. `BoardRenderer`
 * draws a game being played and has to stay honest about a grid; this draws a stage nobody
 * plays on, so it can lie about perspective in ways a tactics board never may.
 */

import { PALETTE } from './palette.js';

/** Where the camera is looking, in tile space. Panned between creation steps. */
export interface DioramaCamera {
  /** Tile the camera centres on. Fractional, so a pan is smooth. */
  x: number;
  y: number;
}

/** An actor standing on the diorama: a 2D sprite at a tile position. */
export interface DioramaActor {
  /** Tile coordinates of its feet. Fractional. */
  x: number;
  y: number;
  /** Draws the sprite, feet at the origin, upright, in device pixels. */
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
  /** 0 while dropping in, 1 once landed. Drives the arrival hop and its shadow. */
  entry?: number;
  /**
   * How tall it stands, in tile units, so the focus band can cover its head as well as its
   * feet. Defaults to roughly a person; a beast passes something lower.
   */
  height?: number;
}

export interface DioramaScene {
  camera: DioramaCamera;
  actors: DioramaActor[];
  /** Tints the whole stage toward a school's colour once the Vow is taken. */
  tint?: string | null;
}

/** How far back the field runs. Wide enough to pan across, small enough to stay a diorama. */
const FIELD_W = 22;
const FIELD_H = 16;

/**
 * The projection: how hard the ground lies down away from the camera.
 *
 * `0` would be a flat top-down grid and `1` would put the horizon in the middle of the
 * frame. Two-thirds is where a tile still reads as square-ish near the actors while the
 * back of the field has visibly gone away.
 */
const TILT = 0.66;

/** Height of the camera above the ground, in tiles. Lower is a more dramatic rake. */
const EYE = 6.5;

/**
 * The band of the frame that stays sharp, when there is nothing in it to focus on.
 *
 * These were once fixed at 0.34 and 0.62 — a sharp band across the *middle* of the picture,
 * which is where a tilt-shift band belongs in the abstract and was nowhere near where
 * anything in this scene stood. Every actor sat inside the blur: the subject of the shot was
 * the one thing out of focus, and it was quietly erasing the finest marks on the sprite.
 *
 * Constants alone could not survive the camera moving, which is exactly what a closer Step I
 * framing does — so the band is **derived from the cast** now (see `focusBand`) and these are
 * the fallback for an empty stage and the clamps that keep some blur at both edges.
 */
export const FOCUS_NEAR = 0.6;
export const FOCUS_FAR = 0.93;

/** Sharpness always stops short of the frame edge, or it is not tilt-shift, it is a photo. */
const FOCUS_MARGIN = 0.06;
const FOCUS_LIMIT_NEAR = 0.08;
const FOCUS_LIMIT_FAR = 0.97;

/** A person, in tile units. What an actor is assumed to be if it does not say. */
const ACTOR_HEIGHT = 1.15;

/**
 * The sharp band, computed from where the cast actually projects.
 *
 * The fix for a whole class of bug rather than for one instance of it. A band written as
 * constants is correct until somebody moves the camera, and then it is silently wrong in a
 * way that looks like the sprite being blurry rather than like the focus being in the wrong
 * place. Deriving it means the subject is in focus by construction, at any framing.
 *
 * Padded above the tallest head and below the nearest feet, then clamped so there is always
 * falloff at both edges.
 */
export function focusBand(
  actors: readonly DioramaActor[],
  cam: DioramaCamera,
  w: number,
  h: number,
): { near: number; far: number } {
  if (actors.length === 0) return { near: FOCUS_NEAR, far: FOCUS_FAR };

  let head = 1;
  let feet = 0;
  for (const a of actors) {
    const at = projectTile(a.x, a.y, cam, w, h);
    const tall = ((h / 9) * at.scale * (a.height ?? ACTOR_HEIGHT)) / h;
    const f = at.y / h;
    head = Math.min(head, f - tall);
    feet = Math.max(feet, f);
  }

  return {
    near: Math.max(FOCUS_LIMIT_NEAR, head - FOCUS_MARGIN),
    far: Math.min(FOCUS_LIMIT_FAR, feet + FOCUS_MARGIN),
  };
}

/**
 * The projection, as a free function.
 *
 * Pulled out of the class so it can be reasoned about — and tested — without a canvas: the
 * question "does the Commander stand in the sharp band" is pure arithmetic, and it should
 * not require a DOM to ask.
 */
export function projectTile(
  tx: number,
  ty: number,
  cam: DioramaCamera,
  w: number,
  h: number,
): { x: number; y: number; scale: number } {
  const dx = tx - cam.x;
  // Depth away from the camera, kept clear of the eye plane so nothing divides by zero as
  // the field passes behind the viewer.
  const dz = Math.max(0.35, ty - cam.y + EYE);
  const f = EYE / dz;

  const unit = h / 9;
  return {
    x: w / 2 + dx * unit * f,
    y: h * (0.5 + TILT * 0.5) - (EYE - dz) * unit * f * TILT - unit * f * TILT * 0.5,
    scale: f,
  };
}

export class Diorama {
  private readonly ctx: CanvasRenderingContext2D;
  /** The blurred copy tilt-shift composites from. Sized with the canvas. */
  private readonly blur: HTMLCanvasElement;
  private readonly blurCtx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Diorama: no 2D context');
    this.ctx = ctx;
    this.blur = document.createElement('canvas');
    const blurCtx = this.blur.getContext('2d');
    if (!blurCtx) throw new Error('Diorama: no blur context');
    this.blurCtx = blurCtx;
  }

  /** Matches the backing store to the element's box. Safe to call every frame. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    // Capped, because the blur pass is fill-rate bound and a 4x display gains nothing
    // visible on something this soft.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.blur.width = w;
      this.blur.height = h;
    }
  }

  /**
   * Projects a tile coordinate to a screen point.
   *
   * A one-point perspective divide rather than an isometric shear, which is the difference
   * between a diorama and a strategy map: rows genuinely converge, so the back of the
   * field is narrower than the front and a sprite standing there is smaller.
   *
   * Returns the scale as well, because everything drawn at that point — the sprite, its
   * shadow, the tile itself — has to agree about how far away it is.
   */
  project(tx: number, ty: number, cam: DioramaCamera, w: number, h: number): {
    x: number;
    y: number;
    scale: number;
  } {
    return projectTile(tx, ty, cam, w, h);
  }

  render(scene: DioramaScene): void {
    this.resize();
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.paint(ctx, scene, w, h);

    // Tilt-shift: a blurred copy of the finished frame, faded in toward the top and bottom
    // edges. The sharp band sits slightly below centre, where the actors stand.
    this.blurCtx.clearRect(0, 0, w, h);
    this.blurCtx.filter = `blur(${Math.round(h / 110)}px)`;
    this.blurCtx.drawImage(this.canvas, 0, 0);
    this.blurCtx.filter = 'none';

    const focus = focusBand(scene.actors, scene.camera, w, h);
    const ramp = ctx.createLinearGradient(0, 0, 0, h);
    ramp.addColorStop(0, 'rgba(0,0,0,1)');
    ramp.addColorStop(focus.near, 'rgba(0,0,0,0)');
    ramp.addColorStop(focus.far, 'rgba(0,0,0,0)');
    ramp.addColorStop(1, 'rgba(0,0,0,1)');

    // Masked composite: paint the blurred copy, then punch the sharp band out of it with
    // the ramp as a stencil. `destination-in` keeps only what the ramp covers.
    const stencil = document.createElement('canvas');
    stencil.width = w;
    stencil.height = h;
    const sctx = stencil.getContext('2d');
    if (sctx) {
      sctx.drawImage(this.blur, 0, 0);
      sctx.globalCompositeOperation = 'destination-in';
      sctx.fillStyle = ramp;
      sctx.fillRect(0, 0, w, h);
      ctx.drawImage(stencil, 0, 0);
    }

    // Vignette last, over everything, so the frame closes rather than the stage darkening.
    const vig = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, h * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** The stage itself: sky, ground, and the actors on it. */
  private paint(ctx: CanvasRenderingContext2D, scene: DioramaScene, w: number, h: number): void {
    const { camera } = scene;

    // Sky, and the haze distant tiles wash into. One colour, two uses — which is what
    // makes the fade read as air rather than as a gradient somebody drew.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0B0E15');
    sky.addColorStop(0.45, '#1A2030');
    sky.addColorStop(1, PALETTE.bg);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Tiles, back to front, so nearer rows overlap further ones and the field reads solid.
    for (let ty = FIELD_H - 1; ty >= 0; ty--) {
      for (let tx = 0; tx < FIELD_W; tx++) {
        this.tile(ctx, tx - FIELD_W / 2, ty - FIELD_H / 2, camera, w, h, scene.tint ?? null);
      }
    }

    // Actors, sorted by depth for the same reason, and drawn upright regardless of the
    // ground's rake. This is the HD-2D contradiction, and it is one line.
    const sorted = [...scene.actors].sort((a, b) => a.y - b.y);
    for (const actor of sorted) {
      const p = this.project(actor.x, actor.y, camera, w, h);
      if (p.scale <= 0.05) continue;

      const entry = actor.entry ?? 1;
      // The arrival hop: falls in from above, and the shadow tightens as it lands.
      const hop = (1 - entry) * h * 0.22;
      const unit = (h / 9) * p.scale;

      ctx.save();
      ctx.globalAlpha = Math.min(1, entry * 1.6);
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.42);
      ctx.beginPath();
      ctx.ellipse(0, 0, unit * 0.42 * (0.6 + entry * 0.4), unit * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = Math.min(1, entry * 1.6);
      ctx.translate(p.x, p.y - hop);
      actor.draw(ctx, unit);
      ctx.restore();
    }
  }

  /** One ground tile, projected as a quad and hazed by distance. */
  private tile(
    ctx: CanvasRenderingContext2D,
    tx: number,
    ty: number,
    cam: DioramaCamera,
    w: number,
    h: number,
    tint: string | null,
  ): void {
    const a = this.project(tx, ty, cam, w, h);
    const b = this.project(tx + 1, ty, cam, w, h);
    const c = this.project(tx + 1, ty + 1, cam, w, h);
    const d = this.project(tx, ty + 1, cam, w, h);
    if (a.scale <= 0.02) return;

    // Haze: near tiles are themselves, far tiles are mostly air.
    const near = Math.min(1, Math.max(0, (a.scale - 0.35) / 0.9));
    if (near <= 0.02) return;

    const checker = (Math.abs(Math.round(tx)) + Math.abs(Math.round(ty))) % 2 === 0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();

    ctx.globalAlpha = near;
    ctx.fillStyle = checker ? PALETTE.tileA : PALETTE.tileB;
    ctx.fill();

    if (tint) {
      ctx.globalAlpha = near * 0.16;
      ctx.fillStyle = tint;
      ctx.fill();
    }

    ctx.globalAlpha = near * 0.5;
    ctx.strokeStyle = PALETTE.tileEdge;
    ctx.lineWidth = Math.max(1, h / 900);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
