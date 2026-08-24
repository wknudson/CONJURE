/**
 * Everything in the ward with behaviour.
 *
 * Entities are billboards too, so the one `faceCamera` pass in the main loop still covers
 * them and there is no second list to keep in step with the first.
 */

import * as THREE from 'three';
import { LOOK } from './look.js';
import type { ColliderSet } from './collision.js';
import type { DoorKey } from './map.js';
import { Walker, pickFacing, type ActorArt } from './sprites3d.js';

/** Anything the player can stand near and press a key at. */
export interface Interactable {
  readonly position: THREE.Vector3;
  interactLabel: string | null;
  /** A second line under the prompt — a door's status, a board's contract count. */
  interactDetail: string | null;
  readonly interactRadius: number;
  onInteract(): void;
}

export interface Updatable {
  update(dt: number, t: number, cameraYaw: number): void;
}

/**
 * An interaction volume with nothing to draw.
 *
 * Doors and the bounty board are places, not bodies: the geometry that represents them is
 * a building face or a post, and the hotspot is just the patch of pavement in front of it.
 */
export class Hotspot implements Interactable {
  readonly position: THREE.Vector3;
  interactLabel: string | null;
  interactDetail: string | null = null;
  readonly interactRadius: number;

  constructor(
    x: number,
    z: number,
    label: string | null,
    private readonly action: () => void,
    radius = 2.6,
  ) {
    this.position = new THREE.Vector3(x, 0, z);
    this.interactLabel = label;
    this.interactRadius = radius;
  }

  onInteract(): void {
    this.action();
  }
}

/** A door hotspot, which knows which trade it opens onto. */
export class DoorHotspot extends Hotspot {
  constructor(
    readonly key: DoorKey,
    x: number,
    z: number,
    label: string,
    action: () => void,
  ) {
    super(x, z, label, action);
  }
}

/**
 * Someone who stands still and has something to say.
 *
 * Turns to face the player when they come within talking distance, which is the cheapest
 * possible signal that a sprite is a person rather than scenery.
 */
export class NPC implements Interactable, Updatable {
  readonly walker: Walker;
  readonly position: THREE.Vector3;
  interactLabel: string | null;
  interactDetail: string | null = null;
  readonly interactRadius = 2.8;
  private readonly bobPhase: number;

  constructor(
    art: ActorArt,
    height: number,
    x: number,
    z: number,
    label: string,
    private readonly action: () => void,
    phase = 0,
  ) {
    this.walker = new Walker(art, height);
    this.walker.position.set(x, 0, z);
    this.position = this.walker.position;
    this.interactLabel = label;
    this.bobPhase = phase;
  }

  /** Set by the screen each frame so the NPC knows where to look. */
  playerAt: THREE.Vector3 | null = null;

  update(_dt: number, t: number, cameraYaw: number): void {
    this.position.y = Math.abs(Math.sin(t * 1.4 + this.bobPhase)) * 0.035;
    if (!this.playerAt) return;
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    if (Math.hypot(dx, dz) < this.interactRadius * 1.6) {
      this.walker.face(pickFacing(dx, dz, cameraYaw));
    }
  }

  onInteract(): void {
    this.action();
  }
}

/**
 * The beast that walks with you.
 *
 * Follows the path the Commander actually took rather than steering straight at them, so
 * it comes round corners instead of clipping the inside of them. Breadcrumbs are dropped
 * on distance rather than on time, which keeps the trail the same shape whether the player
 * is sprinting down the avenue or nudging along a wall.
 */
export class CompanionFollower implements Updatable {
  readonly walker: Walker;
  readonly position: THREE.Vector3;
  private readonly trail: { x: number; z: number }[] = [];
  private lastCrumb = new THREE.Vector2();

  /** How far back it hangs. Closer and it treads on the Commander's heels. */
  private static readonly TRAIL_GAP = 1.9;
  private static readonly CRUMB_EVERY = 0.25;
  private static readonly MAX_CRUMBS = 32;

  constructor(
    art: ActorArt,
    height: number,
    x: number,
    z: number,
    private readonly colliders: ColliderSet,
  ) {
    this.walker = new Walker(art, height);
    this.walker.position.set(x, 0, z);
    this.position = this.walker.position;
    this.lastCrumb.set(x, z);
  }

  /** Called by the screen after the player has moved. */
  notePlayer(px: number, pz: number): void {
    if (Math.hypot(px - this.lastCrumb.x, pz - this.lastCrumb.y) < CompanionFollower.CRUMB_EVERY) {
      return;
    }
    this.lastCrumb.set(px, pz);
    this.trail.push({ x: px, z: pz });
    if (this.trail.length > CompanionFollower.MAX_CRUMBS) this.trail.shift();
  }

  update(dt: number, t: number, cameraYaw: number): void {
    const target = this.trail[0];
    const before = { x: this.position.x, z: this.position.z };

    if (target) {
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.35) {
        this.trail.shift();
      } else if (this.trailLength() > CompanionFollower.TRAIL_GAP) {
        // Slightly quicker than the Commander so it can close a gap it has fallen into,
        // but resolved through the same walls so it cannot cheat through a lamp post.
        const speed = 6.6;
        this.colliders.move(
          this.position as unknown as { x: number; z: number },
          (dx / dist) * speed * dt,
          (dz / dist) * speed * dt,
          0.3,
        );
      }
    }

    const moved = { x: this.position.x - before.x, z: this.position.z - before.z };
    this.walker.step(moved.x, moved.z, cameraYaw);
    if (Math.hypot(moved.x, moved.z) < 1e-4) {
      // Breathing on the spot, on a timer, because nothing is being covered to drive it.
      this.position.y = Math.abs(Math.sin(t * 1.9)) * 0.03;
    }
    // Moving, the walk's own bob is already on `position.y` and is left alone. Flattening it
    // here is what made the beast slide: it has no walk frames, so the bob is the only thing
    // it has that says it is moving under its own legs.
  }

  /** Rough length of the path still ahead of it — cheaper than a true arc length. */
  private trailLength(): number {
    if (this.trail.length === 0) return 0;
    let total = 0;
    let px = this.position.x;
    let pz = this.position.z;
    for (const c of this.trail) {
      total += Math.hypot(c.x - px, c.z - pz);
      px = c.x;
      pz = c.z;
      if (total > CompanionFollower.TRAIL_GAP) break;
    }
    return total;
  }

  /** Puts the beast back at heel — used when the ward is re-entered from a doorway. */
  snapTo(x: number, z: number): void {
    this.trail.length = 0;
    this.position.set(x, 0, z);
    this.lastCrumb.set(x, z);
  }
}

export type WardenState = 'PATROL' | 'ALERT' | 'CHASE' | 'RETURN';

/**
 * The Magistracy's eye on the ward.
 *
 * Its cone is drawn on the ground and goes out the instant the player reaches pavement —
 * mid-pursuit included. That suppression *is* the lesson, so it is shown rather than
 * explained: the rule Vex states in words is the rule the player watches work.
 */
export class Warden implements Updatable {
  readonly walker: Walker;
  readonly position: THREE.Vector3;
  readonly cone: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

  state: WardenState = 'PATROL';
  private target = 1;
  private pause = 0;
  private detect = 0;
  private readonly heading = new THREE.Vector2(0, 1);
  private coneAlpha = 0;

  private static readonly SPEED = 2.4;
  private static readonly CHASE_SPEED = 4.6;
  /** A beat of grace before the chase — long enough to step back onto stone. */
  private static readonly GRACE = 0.4;

  constructor(
    art: ActorArt,
    height: number,
    private readonly waypoints: readonly { x: number; z: number }[],
    private readonly colliders: ColliderSet,
  ) {
    this.walker = new Walker(art, height);
    const start = waypoints[0]!;
    this.walker.position.set(start.x, 0, start.z);
    this.position = this.walker.position;

    this.cone = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#d8b13a'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.cone.renderOrder = 2;
    this.rebuildCone();
  }

  rebuildCone(): void {
    const half = THREE.MathUtils.degToRad(LOOK.visionAngle) / 2;
    this.cone.geometry.dispose();
    this.cone.geometry = new THREE.CircleGeometry(LOOK.visionRange, 28, -half, half * 2);
  }

  /* Set by the screen each frame — the Warden does not reach for global state. */
  playerAt = new THREE.Vector3();
  playerSafe = true;
  onCatch: (() => void) | null = null;
  onAlertChange: ((alerted: boolean) => void) | null = null;

  private sees(): boolean {
    if (this.playerSafe) return false; // Sidewalk Immunity, absolute.
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > LOOK.visionRange || dist < 0.001) return false;
    const dot = (dx * this.heading.x + dz * this.heading.y) / dist;
    return dot > Math.cos(THREE.MathUtils.degToRad(LOOK.visionAngle) / 2);
  }

  private steer(tx: number, tz: number, speed: number, dt: number, cameraYaw: number): number {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return 0;
    const ux = dx / dist;
    const uz = dz / dist;
    this.heading.set(ux, uz);

    const before = { x: this.position.x, z: this.position.z };
    if (speed > 0) {
      this.colliders.move(
        this.position as unknown as { x: number; z: number },
        ux * speed * dt,
        uz * speed * dt,
        0.45,
      );
    }
    this.walker.step(this.position.x - before.x, this.position.z - before.z, cameraYaw);
    if (speed === 0) this.walker.face(pickFacing(ux, uz, cameraYaw));
    return dist;
  }

  update(dt: number, _t: number, cameraYaw: number): void {
    if (this.state === 'PATROL' || this.state === 'RETURN') {
      if (this.pause > 0) {
        this.pause -= dt;
      } else {
        const wp = this.waypoints[this.target]!;
        const dist = this.steer(wp.x, wp.z, Warden.SPEED, dt, cameraYaw);
        if (dist < 0.6) {
          this.target = (this.target + 1) % this.waypoints.length;
          this.pause = 0.9;
          this.state = 'PATROL';
        }
      }
      if (this.sees()) {
        this.state = 'ALERT';
        this.detect = 0;
      }
    } else if (this.state === 'ALERT') {
      this.steer(this.playerAt.x, this.playerAt.z, 0, dt, cameraYaw);
      this.detect += dt;
      if (!this.sees()) {
        this.state = 'RETURN';
        this.detect = 0;
        this.onAlertChange?.(false);
      } else if (this.detect >= Warden.GRACE) {
        this.state = 'CHASE';
        this.onAlertChange?.(true);
      }
    } else if (this.state === 'CHASE') {
      if (this.playerSafe) {
        // The rule holds even mid-pursuit. This is the moment the lesson lands.
        this.state = 'RETURN';
        this.onAlertChange?.(false);
      } else {
        const dist = this.steer(this.playerAt.x, this.playerAt.z, Warden.CHASE_SPEED, dt, cameraYaw);
        if (dist < 1.0) this.onCatch?.();
      }
    }

    const want = this.playerSafe || this.state === 'RETURN' ? 0 : LOOK.coneOpacity;
    this.coneAlpha += (want - this.coneAlpha) * Math.min(1, dt * 6);
    this.cone.material.opacity = this.coneAlpha;
    this.cone.material.color.set(this.state === 'PATROL' ? '#d8b13a' : '#e04422');
    this.cone.position.set(this.position.x, 0.06, this.position.z);
    this.cone.rotation.set(-Math.PI / 2, 0, Math.atan2(-this.heading.y, this.heading.x));
  }

  /** Back to the beat, after a catch. */
  reset(): void {
    this.state = 'PATROL';
    this.detect = 0;
    this.pause = 0.6;
    this.target = 0;
    const wp = this.waypoints[0]!;
    this.position.set(wp.x, 0, wp.z);
    this.onAlertChange?.(false);
  }
}
