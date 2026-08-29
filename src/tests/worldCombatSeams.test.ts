/**
 * The two seams that let one combat stack drive two renderers, and the framing that has to be
 * solved rather than tuned.
 *
 * The point of the seams is that nothing was rewritten. `Fx` — every detonation, tracer,
 * bloom and damage floater in the game — asks a camera four questions, none of them
 * isometric, and `IsoCamera` already answered all four. Naming that set `FxCamera` is what
 * let the fight out in the district reuse the file whole. If somebody widens `FxCamera` with
 * something only a 2D board can answer, these tests are where that gets caught: the interface
 * is a promise that a perspective camera can keep it too.
 *
 * The framing is here because it is arithmetic with a wrong answer that is invisible in code
 * review and obvious on screen — a board with its ends cut off, or one lost in fog.
 */

import { describe, expect, it } from 'vitest';
import { IsoCamera, type FxCamera } from '../render/IsoCamera.js';
import * as THREE from 'three';
import { Descent, frameBoard, DESCENT_SECONDS } from '../district/combat/Descent.js';
import { boardAt, placeBoard } from '../district/combat/WorldBoard.js';
import { AREAS } from '../district/areas/index.js';
import { AMBIENT } from '../district/look.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { TILE } from '../district/map.js';

describe('the FxCamera seam', () => {
  it('is satisfied by IsoCamera without adding anything to it', () => {
    // Structural, and deliberately assigned rather than merely asserted: this line failing to
    // compile is the real test, and the runtime checks below only confirm the members are the
    // live ones rather than accidental look-alikes.
    const cam: FxCamera = new IsoCamera(7, 6);

    expect(typeof cam.tileCenter).toBe('function');
    expect(cam.tileW).toBeGreaterThan(0);
    expect(cam.tileH).toBeGreaterThan(0);
    expect(cam.shake).toEqual({ x: 0, y: 0 });
  });

  it('answers tileCenter in the units Fx spends them in', () => {
    // `Fx` scales blast radii off `tileW` and offsets floaters by a flat pixel count, so both
    // have to be in the same space. A tile's centre must move by about one tile's width when
    // the tile beside it is asked for.
    const cam = new IsoCamera(7, 6);
    cam.origin = { x: 500, y: 300 };
    const a = cam.tileCenter({ x: 2, y: 2 });
    const b = cam.tileCenter({ x: 3, y: 2 });
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    expect(step).toBeGreaterThan(cam.tileW * 0.4);
    expect(step).toBeLessThan(cam.tileW * 1.2);
  });

  it('lifts by elevation in the direction Fx expects', () => {
    // The handlers raise a summoned body to `elev: 46` and expect it to appear *above* the
    // tile. Screen y grows downward, so a lift has to reduce it.
    const cam = new IsoCamera(7, 6);
    const ground = cam.tileCenter({ x: 3, y: 3 });
    const lifted = cam.tileCenter({ x: 3, y: 3 }, 46);
    expect(lifted.y).toBeLessThan(ground.y);
  });
});

describe('framing a board that is not one size', () => {
  const aspect = 16 / 9;

  /** Every footprint an encounter actually asks for. */
  const SIZES = [...new Set(ENCOUNTERS.map((e) => `${e.width}x${e.height}`))].map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w: w!, h: h! };
  });

  it('gets the whole board and both Commanders inside the frame', () => {
    // The failure this exists for: a distance that frames a pack fight cuts the ends off a
    // duel. Checked by projecting the extremes through the same trigonometry the framing
    // solved, rather than against a remembered number.
    for (const { w, h } of SIZES) {
      const board = boardAt(AREAS[0]!, 0, 0, w, h);
      const f = frameBoard(board, aspect, 0.03);

      const halfV = Math.tan((f.fov * Math.PI) / 180 / 2) * f.distance;
      const halfH = halfV * aspect;

      // The Commanders stand about 1.35 rows past each end; the deepest thing to fit is the
      // grid plus both of them, lying down at the camera's pitch.
      const depth = (h + 2.7) * TILE;
      const onScreen = (depth / 2) * Math.sin((f.pitch * Math.PI) / 180);
      expect(onScreen, `${w}x${h} is taller than the frame`).toBeLessThanOrEqual(halfV);
      expect((w * TILE) / 2, `${w}x${h} is wider than the frame`).toBeLessThanOrEqual(halfH);
    }
  });

  it('does not pull back further than it has to', () => {
    // The other direction, and the one nothing else would notice: a board framed from twice
    // as far away still fits, and reads as a diorama on a table rather than a fight you are
    // standing at. A bigger arena must want more distance; a smaller one must want less.
    const small = frameBoard(boardAt(AREAS[0]!, 0, 0, 4, 6), aspect, 0.03);
    const large = frameBoard(boardAt(AREAS[0]!, 0, 0, 8, 9), aspect, 0.03);
    expect(small.distance).toBeLessThan(large.distance);
    // And the whole range stays inside the district camera's far plane, which is 220.
    expect(large.distance).toBeLessThan(200);
  });

  it('looks at the middle of the board, square on', () => {
    const board = placeBoard(AREAS[0]!, { x: 0, z: 0 }, 7, 6);
    const f = frameBoard(board, aspect, 0.03);
    const centre = board.centre();
    expect(f.target.x).toBeCloseTo(centre.x);
    expect(f.target.z).toBeCloseTo(centre.z);
    // Zero, not a diagonal. The grid is laid on district tiles and is therefore world-axis
    // aligned: at yaw zero its rows run straight across the screen, with the enemy's home
    // rows at the top and the player's at the bottom.
    expect(f.yaw).toBe(0);
  });
});

describe('the fog override, which is not a nicety', () => {
  it('brings every area to a legible haze at combat range', () => {
    // Without this the board is simply not visible in the thicker wards. `FogExp2` attenuates
    // by `1 - exp(-(density * distance)^2)`, and Lamprow authored at 0.036 against a combat
    // distance of around forty units loses almost all of its contrast.
    for (const area of AREAS) {
      const amb = AMBIENT[area.id] ?? AMBIENT.ashfall_ward!;
      const board = placeBoard(area, { x: area.spawn.x, z: area.spawn.z }, 7, 6);
      const f = frameBoard(board, 16 / 9, amb.fogDensity);

      const fogged = (d: number): number => 1 - Math.exp(-Math.pow(d * f.distance, 2));
      expect(
        fogged(amb.fogDensity * f.fogScale),
        `${area.id} is still washed out`,
      ).toBeLessThan(0.25);
    }
  });

  it('is the reason it exists: the unscaled fog really would swallow the board', () => {
    // Stated as a test so nobody deletes the override as dead weight. If an area is ever
    // re-authored clear enough that this stops being true, that is worth knowing too.
    const lamprow = AREAS.find((a) => a.id === 'lamprow')!;
    const amb = AMBIENT.lamprow!;
    const board = placeBoard(lamprow, { x: lamprow.spawn.x, z: lamprow.spawn.z }, 7, 6);
    const f = frameBoard(board, 16 / 9, amb.fogDensity);
    const unscaled = 1 - Math.exp(-Math.pow(amb.fogDensity * f.distance, 2));
    expect(unscaled, 'the override is load-bearing').toBeGreaterThan(0.6);
  });

  it('never raises an area past its own authored fog', () => {
    // The scale is a correction for one situation the area was not tuned for, not a house
    // style. An area already clear at combat range keeps exactly what it authored, which is
    // what stops the Chalk Road from being dragged toward Lamprow's look.
    for (const area of AREAS) {
      const amb = AMBIENT[area.id] ?? AMBIENT.ashfall_ward!;
      const board = placeBoard(area, { x: area.spawn.x, z: area.spawn.z }, 7, 6);
      expect(frameBoard(board, 16 / 9, amb.fogDensity).fogScale).toBeLessThanOrEqual(1);
    }
  });
});

describe('the descent', () => {
  it('takes long enough to read as an event and not long enough to wait through', () => {
    expect(DESCENT_SECONDS).toBeGreaterThan(1);
    expect(DESCENT_SECONDS).toBeLessThan(3);
  });

  /** A descent onto a board in the middle of the first area, from an arbitrary walk yaw. */
  function descentFrom(yaw: number): { d: Descent; to: ReturnType<typeof frameBoard> } {
    const board = placeBoard(AREAS[0]!, { x: 0, z: 0 }, 7, 6);
    const to = frameBoard(board, 16 / 9, 0.03);
    return {
      d: new Descent(to, { yaw, target: new THREE.Vector3(10, 0, 10) }),
      to,
    };
  }

  it('arrives exactly where it said it would', () => {
    const { d, to } = descentFrom(0);
    let last = d.update(0.016);
    for (let t = 0; t < DESCENT_SECONDS + 0.2; t += 0.016) last = d.update(0.016);

    expect(d.finished).toBe(true);
    expect(last.pitch).toBeCloseTo(to.pitch, 4);
    expect(last.fov).toBeCloseTo(to.fov, 4);
    expect(last.distance).toBeCloseTo(to.distance, 4);
    expect(last.fogScale).toBeCloseTo(to.fogScale, 4);
    expect(last.target.x).toBeCloseTo(to.target.x, 4);
    expect(last.target.z).toBeCloseTo(to.target.z, 4);
  });

  it('lights the ground before the camera has finished moving', () => {
    // The grid arriving is the thing the player is meant to watch; a camera that lands first
    // and *then* draws the board reads as two events instead of one.
    const { d } = descentFrom(0);
    let revealFull = -1;
    for (let i = 0, t = 0; t < DESCENT_SECONDS; i++, t += 0.016) {
      d.update(0.016);
      if (revealFull < 0 && d.reveal >= 1) revealFull = t;
    }
    expect(revealFull, 'the grid never finished blooming').toBeGreaterThan(0);
    expect(revealFull, 'it should not still be drawing when the camera lands').toBeLessThan(
      DESCENT_SECONDS,
    );
  });

  it('takes the short way round however far the player had orbited', () => {
    // `Q` and `E` wind `cameraYaw` without bound, so after a few laps it is numerically miles
    // from the zero the tactical framing wants. Turning the whole distance would spin the
    // camera through several revolutions on the way into a fight.
    for (const laps of [-3, -1, 1, 4]) {
      const start = laps * Math.PI * 2 + 0.4;
      const { d } = descentFrom(start);
      let last = d.update(0.016);
      for (let t = 0; t < DESCENT_SECONDS + 0.2; t += 0.016) last = d.update(0.016);
      // Ends at an angle equivalent to zero...
      expect(Math.abs(((last.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))).toBeLessThan(
        1e-6,
      );
      // ...having turned less than half a revolution to get there.
      expect(Math.abs(last.yaw - start), `${laps} laps`).toBeLessThan(Math.PI);
    }
  });
});
