/**
 * The beat between the ring closing and the first card being played.
 *
 * Wizard101's move, and the reason the BATTLE wipe is gone from this path: the grid arrives
 * on the ground you are standing on, the camera settles into a tactical framing, and the
 * fight begins where you were. Nothing is hidden behind a flash, because there is no longer
 * anything to hide — the same scene is on screen before and after.
 *
 * This owns only the *transition*: the camera, the fog, and how far the grid has bloomed.
 * The board itself is `WorldCombat`, and the district still draws every frame.
 */

import * as THREE from 'three';
import { LOOK } from '../look.js';
import { TILE } from '../map.js';
import type { WorldBoard } from './WorldBoard.js';

/** How long the whole descent takes. Long enough to read as an event, short enough to sit through. */
export const DESCENT_SECONDS = 1.9;

/** Where the camera ends up. The walk framing is fov 28 / pitch 50 / distance 22. */
const COMBAT_FOV = 42;
const COMBAT_PITCH = 42;

/**
 * How much room the two Commanders need beyond the grid's own ends.
 *
 * They stand off the board — a row and a bit past each edge, which is what makes melee reach
 * legible — so framing the grid alone would cut both of them off. In rows, doubled because
 * there is one at each end, plus a little air.
 */
const COMMANDER_ROWS = 2.7;

/**
 * The fog depth a board is legible through.
 *
 * `FogExp2` attenuates by `1 - exp(-(density * distance)^2)`, so what matters is the product.
 * At about 0.45 roughly a fifth of the contrast is gone, which reads as air rather than as
 * haze. Each area keeps its own character because the scale is derived from *its* density —
 * the Chalk Road stays the clearest place in the game and Lamprow stays the thickest.
 */
const LEGIBLE_FOG_DEPTH = 0.45;

export interface Framing {
  /** Where the camera looks. The middle of the board. */
  target: THREE.Vector3;
  yaw: number;
  pitch: number;
  fov: number;
  distance: number;
  /** What to multiply the area's authored fog density by while the board is up. */
  fogScale: number;
}

/**
 * Where to put the camera so a whole board is in shot.
 *
 * Solved rather than tuned, because the arena is not one size: encounters run from 4x6 to
 * 8x9, and a distance that frames a pack fight cuts the ends off a duel. Both screen axes
 * are checked and the binding one wins — in practice that is nearly always the vertical,
 * since depth foreshortens by `sin(pitch)` while width does not foreshorten at all.
 *
 * `yaw` is snapped to zero rather than to a diagonal. The 2D board is a 2:1 diamond and the
 * obvious thing was to match it, but the grid out here is laid on district tiles and is
 * therefore world-axis-aligned: at yaw zero its rows run straight across the screen, the
 * enemy's home rows sit at the top and the player's at the bottom. That is both the clearer
 * tactical read and the straight-on framing Wizard101 uses.
 */
export function frameBoard(board: WorldBoard, aspect: number, fogDensity: number): Framing {
  const centre = board.centre();
  const width = board.w * TILE;
  const depth = (board.h + COMMANDER_ROWS) * TILE;

  const fovRad = THREE.MathUtils.degToRad(COMBAT_FOV);
  const pitchRad = THREE.MathUtils.degToRad(COMBAT_PITCH);

  // Vertical: the board's depth lies down at the camera's pitch, and a standing body adds
  // its height back on.
  const screenDepth = depth * Math.sin(pitchRad) + 3.2 * Math.cos(pitchRad);
  const forVertical = screenDepth / 2 / Math.tan(fovRad / 2);

  // Horizontal: unforeshortened, against the wider half-angle a wide viewport gives.
  const halfHorizontal = Math.atan(Math.tan(fovRad / 2) * Math.max(0.5, aspect));
  const forHorizontal = width / 2 / Math.tan(halfHorizontal);

  // A little air, so nothing is flush against the frame edge.
  const distance = Math.max(forVertical, forHorizontal) * 1.08;

  return {
    target: new THREE.Vector3(centre.x, 0, centre.z),
    yaw: 0,
    pitch: COMBAT_PITCH,
    fov: COMBAT_FOV,
    distance,
    // Clamped at 1: an area already clear enough at this range keeps its authored fog rather
    // than having it *raised* to hit the target.
    fogScale: Math.min(1, LEGIBLE_FOG_DEPTH / Math.max(1e-6, fogDensity * distance)),
  };
}

/** Smooth in, smooth out. The camera is a body, not a cut. */
function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

export class Descent {
  /** 0 at the start, 1 once the camera has arrived and the grid stands. */
  private t = 0;
  private done = false;

  private readonly from: { yaw: number; pitch: number; fov: number; distance: number };
  private readonly fromTarget: THREE.Vector3;

  constructor(
    private readonly to: Framing,
    from: { yaw: number; target: THREE.Vector3 },
  ) {
    // The walk framing is whatever the Look panel currently says it is, not the authored
    // defaults — somebody tuning the camera should see the descent start from what they are
    // looking at.
    this.from = {
      // Unwound to the nearest equivalent angle, so the camera takes the short way round
      // rather than spinning most of a turn to reach a numerically distant zero.
      yaw: from.yaw,
      pitch: LOOK.cameraPitch,
      fov: LOOK.fov,
      distance: LOOK.cameraDistance,
    };
    this.fromTarget = from.target.clone();
    // `to.yaw` is zero; express it in the same winding as the camera currently sits in.
    const turns = Math.round(from.yaw / (Math.PI * 2));
    this.to = { ...to, yaw: to.yaw + turns * Math.PI * 2 };
  }

  get finished(): boolean {
    return this.done;
  }

  /** 0..1, for the grid's bloom. Runs ahead of the camera so the ground lights first. */
  get reveal(): number {
    return Math.min(1, this.t * 1.45);
  }

  /**
   * One frame of the descent.
   *
   * Returns the camera state to apply. The district owns the camera, so this hands back
   * numbers rather than reaching for it — which is also what makes the whole transition
   * inspectable from a test or the dev console without a renderer.
   */
  update(dt: number): {
    target: THREE.Vector3;
    yaw: number;
    pitch: number;
    fov: number;
    distance: number;
    fogScale: number;
  } {
    this.t = Math.min(1, this.t + dt / DESCENT_SECONDS);
    if (this.t >= 1) this.done = true;
    const k = easeInOut(this.t);

    const lerp = (a: number, b: number): number => a + (b - a) * k;
    return {
      target: this.fromTarget.clone().lerp(this.to.target, k),
      yaw: lerp(this.from.yaw, this.to.yaw),
      pitch: lerp(this.from.pitch, this.to.pitch),
      fov: lerp(this.from.fov, this.to.fov),
      distance: lerp(this.from.distance, this.to.distance),
      fogScale: lerp(1, this.to.fogScale),
    };
  }

  /** The framing the descent is heading for, for anything that needs it before it arrives. */
  get destination(): Framing {
    return this.to;
  }
}
