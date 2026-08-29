/**
 * The half of the board that floats, and the reason there is no second effects layer.
 *
 * `Fx` — every detonation, tracer, bloom, damage number and CRASH badge in the game — asks a
 * camera exactly four things: where is this tile on screen, how wide and tall does a tile
 * currently read, and how far is the frame shaken. None of those questions are isometric. This
 * class answers all four by projecting through the district's perspective camera, which is why
 * the fight out in the world reuses `render/Fx.ts` whole instead of reimplementing five hundred
 * lines of particle work against three.js.
 *
 * It also carries the furniture that genuinely belongs above the ground rather than on it:
 * badges, predicted damage, trajectory ghosts and the tether. Those are drawn in screen space
 * for the same reason they are in the 2D renderer — a number lying flat on the road at a forty
 * degree camera is a number nobody can read. Anything that *is* the ground is a quad in
 * `BoardMesh` instead.
 *
 * ## Shake belongs to the camera, not to this canvas
 *
 * `IsoCamera` folds `shake` into every projected point, because there is nothing else to move.
 * Here there is: the district camera itself is offset, and the projection then moves the scene
 * and this overlay together for free. So `shake` is a field `Fx` writes and the camera
 * controller reads, and `tileCenter` deliberately does **not** add it — doing both would shake
 * the overlay twice as far as the world under it.
 */

import * as THREE from 'three';
import type { Coord } from '../../contract/ids.js';
import type { FxCamera, ScreenPoint } from '../../render/IsoCamera.js';
import { TILE } from '../map.js';
import type { WorldBoard } from './WorldBoard.js';

/**
 * World units of lift per screen pixel of `elev`.
 *
 * The animation handlers speak in screen pixels — a summon drops from 46, a hop peaks at 6 —
 * because they were written against a 2D board and there is no reason for them to learn about
 * world space. One constant converts, and it is calibrated so a drop-in reads about the same
 * height relative to a tile as it does on the 2D board: 46px against a 116px tile is roughly
 * 0.4 of a tile, and a tile out here is `TILE` units.
 */
export const PX_TO_WORLD = 0.035;

export class OverlayCanvas implements FxCamera {
  /** The stacking container: canvas underneath, DOM floaters on top. */
  readonly el: HTMLElement;
  /** Where `Fx` appends its damage numbers and badges. Styled by `board.css`. */
  readonly floaters: HTMLElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Written by `Fx.screenShake`, read by whoever moves the camera. See the note above. */
  shake: ScreenPoint = { x: 0, y: 0 };

  private readonly canvas: HTMLCanvasElement;
  private cssW = 1;
  private cssH = 1;
  private readonly v = new THREE.Vector3();

  constructor(
    parent: HTMLElement,
    private readonly board: WorldBoard,
    private camera: THREE.Camera,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'world-combat__overlay';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world-combat__fx';
    this.el.appendChild(this.canvas);

    this.floaters = document.createElement('div');
    this.floaters.className = 'floaters';
    this.el.appendChild(this.floaters);

    parent.appendChild(this.el);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser');
    this.ctx = ctx;

    this.resize();
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.el.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * The drawing surface in CSS pixels.
   *
   * `Fx.draw` takes these and uses them for exactly one thing — the full-frame white flash a
   * mark detonation throws — so passing zeros here loses that beat silently, with everything
   * else about the effect still working. Worth a getter rather than a guess.
   */
  get width(): number {
    return this.cssW;
  }

  get height(): number {
    return this.cssH;
  }

  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /* ============================================================
     FxCamera
     ============================================================ */

  /**
   * A tile's centre in CSS pixels.
   *
   * `elevPx` lifts the point off the ground in *world* space before projecting, rather than
   * subtracting pixels from the result. That difference matters here and does not on a 2D
   * board: something raised above the far edge of the arena should shift by fewer screen
   * pixels than the same lift at the near edge, because it is further away. Subtracting a flat
   * pixel count would detach a summon's drop-in from the tile it is dropping onto.
   */
  tileCenter(c: Coord, elevPx = 0): ScreenPoint {
    const p = this.board.centreOf(c);
    this.v.set(p.x, elevPx * PX_TO_WORLD, p.z).project(this.camera);
    return {
      x: (this.v.x * 0.5 + 0.5) * this.cssW,
      y: (-this.v.y * 0.5 + 0.5) * this.cssH,
    };
  }

  /**
   * How wide a tile currently reads, measured rather than derived.
   *
   * Two neighbouring tile centres at the middle of the board, projected and subtracted. Taken
   * at the middle deliberately: under perspective the near row is genuinely bigger than the
   * far one, and a blast radius that changed size depending on which end of the arena it went
   * off at would read as a bug. One representative figure for the whole board is the honest
   * answer to a question that assumes an orthographic camera.
   */
  get tileW(): number {
    const midY = (this.board.h - 1) / 2;
    const a = this.tileCenter({ x: 0, y: midY });
    const b = this.tileCenter({ x: 1, y: midY });
    return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  }

  get tileH(): number {
    const midX = (this.board.w - 1) / 2;
    const a = this.tileCenter({ x: midX, y: 0 });
    const b = this.tileCenter({ x: midX, y: 1 });
    return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  }

  /* ============================================================
     Picking
     ============================================================ */

  /**
   * Mouse position -> the combat tile under it, or null if the pointer is off the board.
   *
   * The whole of the input adaptation. `TargetingController` has no camera coupling of any
   * kind — it speaks `Coord` and emits `Overlays` as lists of `Coord` — so once a pointer
   * becomes a tile, every hover, target, unit selection and legality query in the game works
   * out here unchanged.
   *
   * Un-projects against the ground plane rather than raycasting the board geometry: the grid
   * is drawn as light and its quads are additive and depth-write-free, so there is nothing
   * solid to hit, and the plane is where the tiles conceptually are anyway.
   */
  tileAtPointer(clientX: number, clientY: number): Coord | null {
    const rect = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );

    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera as THREE.PerspectiveCamera);
    const hit = new THREE.Vector3();
    // The board's own plane. `intersectPlane` returns null when the ray is parallel to it or
    // points away, which is exactly the "pointer is above the horizon" case.
    if (!ray.ray.intersectPlane(GROUND, hit)) return null;

    // World -> combat tile, inverting `centreOf`. The half-tile is because `centreOf` returns
    // a tile's middle and this is asking which tile a point falls inside.
    const origin = this.board.centreOf({ x: 0, y: 0 });
    const x = Math.floor((hit.x - origin.x) / TILE + 0.5);
    const y = Math.floor((hit.z - origin.z) / TILE + 0.5);
    if (x < 0 || y < 0 || x >= this.board.w || y >= this.board.h) return null;
    return { x, y };
  }

  dispose(): void {
    this.el.remove();
  }
}

/** The board's own plane. Constructed once: `intersectPlane` does not mutate it. */
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
