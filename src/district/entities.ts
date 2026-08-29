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
    /** False for art with its own shadow painted in. See `BillboardSprite`. */
    castsShadow = true,
  ) {
    this.walker = new Walker(art, height, castsShadow);
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

  /**
   * Put the body away, or bring it back.
   *
   * Called when a board stands on this street. The Warden is either on that board or is not
   * in this fight, and in both cases a figure frozen mid-stride at the edge of the arena is
   * the loudest possible statement that the grid is pasted onto a world still going about its
   * business. The cone goes with it: a patrol arc lying across a battlefield is describing a
   * rule that is not currently running.
   */
  setVisible(v: boolean): void {
    this.walker.sprite.visible = v;
    this.cone.visible = v;
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

/**
 * A minion pack, wandering its patch of road until somebody walks into it.
 *
 * Built on the `Warden`'s shape rather than the `Hotspot`'s, and the difference is the whole
 * point: a Hotspot waits for Space, and nothing about meeting a pack should involve pressing
 * a key to agree to it. Like the Warden it is `Updatable` only, it never reaches for global
 * state, and everything it knows about the player is injected by the screen each frame.
 *
 * Three bodies are drawn per pack rather than one, tinted apart, so what you see coming is a
 * group. They are decoration hung off one position — the fight is the fight, and a pack that
 * modelled its members individually out here would be promising a tactical situation the
 * arena does not inherit.
 *
 * It hunts, on the Warden's pattern: a cone it can see you through, a beat of grace, then a
 * run at you. The cone goes dark the moment you are on sanctioned pavement, which is the
 * same rule the Warden keeps and for the same reason — the walkway has to be worth
 * something. On the verge, where nothing is paved, it never goes dark at all.
 */
export class Pack implements Updatable {
  readonly walkers: Walker[] = [];
  /** The fight walking into this one starts. Carried so the screen can re-arm by identity. */
  readonly encounterId: string;
  readonly position: THREE.Vector3;

  /** Injected by the screen, exactly as the Warden's are. */
  playerAt = new THREE.Vector3();
  /**
   * Whether pack aggro is suppressed — the player is on sanctioned pavement.
   *
   * Deliberately its own flag rather than the screen's `playerSafe`, which is pinned true
   * in an area with no walkways because it means "no Warden may see you here". Out on the
   * verge that is exactly backwards for a pack: nothing there needs a warrant.
   */
  playerSafe = false;
  onContact: (() => void) | null = null;

  /** What it is doing about you, on the Warden's three-state pattern. */
  state: 'ROAM' | 'ALERT' | 'CHASE' = 'ROAM';
  readonly cone: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly aggroRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

  private readonly home: THREE.Vector2;
  private readonly target = new THREE.Vector2();
  private readonly heading = new THREE.Vector2(0, 1);
  private pause = 0;
  private spent = false;
  private detect = 0;
  private coneAlpha = 0;

  /**
   * Under the player's six, and under the Warden's chase.
   *
   * `collision.ts` states the anti-tunneling proof in terms of the fastest thing on the
   * board against a dt clamped to 0.05: at six units a second the longest step is 0.3, which
   * is inside the smallest collider radius. A pack quicker than that could cross a wall
   * between two frames, so this is a bound rather than a taste.
   */
  private static readonly SPEED = 2.0;
  /** A shorter beat than the Warden's: a pack is not deciding whether it is allowed. */
  private static readonly GRACE = 0.3;
  /** How far past its own sight it will keep running before losing interest. */
  private static readonly GIVE_UP = 1.6;
  /** How close is close enough to have walked into them. */
  private static readonly CONTACT = 1.6;
  /** Offsets for the two hangers-on, so the group reads as a group. */
  private static readonly FLANK: readonly [number, number][] = [
    [-0.95, 0.55],
    [0.9, -0.5],
  ];

  constructor(
    encounterId: string,
    art: ActorArt,
    height: number,
    homeX: number,
    homeZ: number,
    private readonly roam: number,
    private readonly colliders: ColliderSet,
    private readonly rng: () => number,
  ) {
    this.encounterId = encounterId;
    for (let i = 0; i < 3; i++) {
      const w = new Walker(art, height * (i === 0 ? 1 : 0.92));
      w.position.set(homeX, 0, homeZ);
      this.walkers.push(w);
    }
    this.position = this.walkers[0]!.position;
    this.home = new THREE.Vector2(homeX, homeZ);
    this.target.set(homeX, homeZ);
    this.pickTarget();

    // The Warden's recipe, because it is the established visual language for "this thing
    // can see you": additive and unlit so the bloom pass finds it, no depth write so it
    // lies over the ground rather than fighting it.
    this.cone = new THREE.Mesh(new THREE.BufferGeometry(), Pack.sightMaterial('#c2603a'));
    this.cone.renderOrder = 2;
    this.aggroRing = new THREE.Mesh(new THREE.BufferGeometry(), Pack.sightMaterial('#c2603a'));
    this.aggroRing.renderOrder = 2;
    this.aggroRing.rotation.x = -Math.PI / 2;
    this.rebuildCone();
  }

  private static sightMaterial(color: string): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }

  /** Re-cut the cone and the ring after the tuning panel moves the numbers. */
  rebuildCone(): void {
    const half = THREE.MathUtils.degToRad(LOOK.packVisionAngle) / 2;
    this.cone.geometry.dispose();
    this.cone.geometry = new THREE.CircleGeometry(LOOK.packVisionRange, 28, -half, half * 2);
    this.aggroRing.geometry.dispose();
    this.aggroRing.geometry = new THREE.RingGeometry(
      LOOK.packVisionRange * 0.96,
      LOOK.packVisionRange,
      40,
    );
  }

  /** Can it see you from where it is standing, facing the way it is facing? */
  sees(): boolean {
    if (this.playerSafe) return false; // Sanctioned pavement, same rule as the Warden's.
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > LOOK.packVisionRange || dist < 0.001) return false;
    const dot = (dx * this.heading.x + dz * this.heading.y) / dist;
    return dot > Math.cos(THREE.MathUtils.degToRad(LOOK.packVisionAngle) / 2);
  }

  /**
   * Stand still for a while.
   *
   * Used by the ring: the pack that jumped you should be standing where the ring opened,
   * not wandering off its own ambush while the circle draws.
   */
  holdStill(seconds: number): void {
    this.pause = Math.max(this.pause, seconds);
    this.state = 'ROAM';
  }

  /** Turn and come running — what a pulled pack does when the circle catches it. */
  answerTheCall(x: number, z: number): void {
    this.pause = 0;
    this.state = 'CHASE';
    this.target.set(x, z);
  }

  /**
   * Off the street, because they are on the board now.
   *
   * The one that jumped you is *represented twice* the moment a fight starts: once as the
   * three roaming bodies that walked into you, and once as the squad standing on the grid.
   * Freezing the roamers — which is what the screen does to everything while a board is up —
   * left three figures standing in the arena that no card could touch and no turn could move.
   * They are the same creatures; only one of the two copies should be on screen, and it is
   * the one the player can play against.
   *
   * The cone and the aggro ring go too. Their whole subject is "walk in here and a fight
   * starts", which is a thing that has already happened.
   */
  setVisible(v: boolean): void {
    for (const w of this.walkers) w.sprite.visible = v;
    this.cone.visible = v;
    this.aggroRing.visible = v;
  }

  /** Frees the cone and ring geometry. The walkers' art is owned by the screen. */
  dispose(): void {
    this.cone.geometry.dispose();
    this.cone.material.dispose();
    this.aggroRing.geometry.dispose();
    this.aggroRing.material.dispose();
  }

  /** Somewhere else on its patch that it can actually stand. */
  private pickTarget(): void {
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * Math.PI * 2;
      const r = this.roam * (0.35 + this.rng() * 0.65);
      const x = this.home.x + Math.cos(a) * r;
      const z = this.home.y + Math.sin(a) * r;
      if (!this.colliders.blocked(x, z, 0.4)) {
        this.target.set(x, z);
        return;
      }
    }
    // Nothing free within reach — go home and try again from there.
    this.target.copy(this.home);
  }

  /**
   * Whether a point is far enough from this pack to be worth retreating to.
   *
   * The screen tracks the last such point and writes *that* as the return position, because
   * writing the tile you collided on means arriving back inside contact range and starting
   * the same fight again — at one Pact if you lost it.
   */
  clearOf(x: number, z: number, margin = 3): boolean {
    return Math.hypot(x - this.position.x, z - this.position.z) > Pack.CONTACT + margin;
  }

  private rangeToPlayer(): number {
    return Math.hypot(this.playerAt.x - this.position.x, this.playerAt.z - this.position.z);
  }

  /** Points the heading at a spot without moving, so the cone tracks what it is watching. */
  private faceToward(tx: number, tz: number): void {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) this.heading.set(dx / dist, dz / dist);
  }

  /** One step toward a spot, through the collider layer, heading updated to match. */
  private driveToward(tx: number, tz: number, speed: number, dt: number): void {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return;
    this.heading.set(dx / dist, dz / dist);
    this.colliders.move(
      this.position as unknown as { x: number; z: number },
      (dx / dist) * speed * dt,
      (dz / dist) * speed * dt,
      0.4,
    );
  }

  update(dt: number, _t: number, cameraYaw: number): void {
    const before = { x: this.position.x, z: this.position.z };

    if (this.state === 'CHASE') {
      // Straight at you, through the collider layer so it slides along walls instead of
      // grinding into them — the Warden's chase does the same, for the same reason.
      const lost = !this.sees() && this.rangeToPlayer() > LOOK.packVisionRange * Pack.GIVE_UP;
      if (this.playerSafe || lost) {
        this.state = 'ROAM';
        this.detect = 0;
        this.pickTarget();
      } else {
        this.driveToward(this.playerAt.x, this.playerAt.z, LOOK.packChaseSpeed, dt);
      }
    } else if (this.state === 'ALERT') {
      // Facing you, deciding. A beat of grace is what makes stepping back onto pavement a
      // real escape rather than a reflex test.
      this.faceToward(this.playerAt.x, this.playerAt.z);
      this.detect += dt;
      this.walkers[0]!.step(0, 0, cameraYaw);
      if (!this.sees()) {
        this.state = 'ROAM';
        this.detect = 0;
      } else if (this.detect >= Pack.GRACE) {
        this.state = 'CHASE';
      }
    } else if (this.pause > 0) {
      this.pause -= dt;
      this.walkers[0]!.step(0, 0, cameraYaw);
      if (this.sees()) {
        this.state = 'ALERT';
        this.detect = 0;
      }
    } else {
      const dx = this.target.x - this.position.x;
      const dz = this.target.y - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.5) {
        // A beat of standing about, then somewhere new. Without the pause a pack reads as a
        // patrol rather than as something loitering.
        this.pause = 0.8 + this.rng() * 2.2;
        this.pickTarget();
      } else {
        this.driveToward(this.target.x, this.target.y, Pack.SPEED, dt);
      }
      if (this.sees()) {
        this.state = 'ALERT';
        this.detect = 0;
      }
    }

    const movedX = this.position.x - before.x;
    const movedZ = this.position.z - before.z;
    this.walkers[0]!.step(movedX, movedZ, cameraYaw);

    // The hangers-on trail the leader at a fixed offset. Not collided: they are dressing on
    // one body, and three colliding bodies in a roam circle spend their lives stuck on each
    // other rather than wandering.
    for (let i = 0; i < Pack.FLANK.length; i++) {
      const [ox, oz] = Pack.FLANK[i]!;
      const w = this.walkers[i + 1]!;
      w.position.set(this.position.x + ox, 0, this.position.z + oz);
      w.step(movedX, movedZ, cameraYaw);
    }

    // The cone and its ring, on one alpha so suppression fades both together. Drawn at the
    // pack's own feet, pointing wherever it last steered.
    const want = this.playerSafe ? 0 : LOOK.packConeOpacity;
    this.coneAlpha += (want - this.coneAlpha) * Math.min(1, dt * 6);
    this.cone.material.opacity = this.coneAlpha;
    this.cone.material.color.set(this.state === 'ROAM' ? '#c2603a' : '#e04422');
    this.cone.position.set(this.position.x, 0.06, this.position.z);
    this.cone.rotation.set(-Math.PI / 2, 0, Math.atan2(-this.heading.y, this.heading.x));

    const ringWant = LOOK.packConeOpacity > 0 ? LOOK.packAggroRingOpacity / LOOK.packConeOpacity : 0;
    this.aggroRing.material.opacity = this.coneAlpha * ringWant;
    this.aggroRing.material.color.copy(this.cone.material.color);
    this.aggroRing.position.set(this.position.x, 0.05, this.position.z);

    if (this.spent || !this.onContact) return;
    const d = Math.hypot(this.playerAt.x - this.position.x, this.playerAt.z - this.position.z);
    if (d < Pack.CONTACT) {
      // Latched, because `update` runs every frame and the player is still standing there
      // during the frames it takes the screen to hand off. The Warden's catch guards the
      // same way, one level up, with `inputLocked`.
      this.spent = true;
      this.onContact();
    }
  }
}

/**
 * The Combat Ring: the beat between walking into a pack and the fight starting.
 *
 * A circle of light thrown out from where the contact happened, growing for two and a half
 * seconds. Anything roaming that it touches in that window is in the fight too — which is
 * the whole mechanic, and the reason the ring is a visible thing rather than a radius check
 * done instantly and silently. The player watches the second pack get caught, so when it
 * arrives on round two it is something they saw happen rather than something the game did
 * to them.
 *
 * An `Updatable` like everything else out here, owned by the screen, and it reaches for
 * nothing: the candidate packs are handed in, and the answer goes out through `onDone`.
 */
export class CombatRing implements Updatable {
  /** How far the circle finally reaches, in world units. */
  static readonly RADIUS = 5;
  /** How long it takes to get there. Long enough to watch, short enough not to wait. */
  static readonly DURATION = 2.5;
  /**
   * How many extra mobs one ring can catch.
   *
   * Two, and the third is simply ignored rather than queued into a wave three. A player
   * jumped by four things at once has not been given a tactical situation, they have been
   * given a loss with extra steps — and the compensation is priced per pull, so an
   * unbounded pull is an unbounded promise.
   */
  static readonly MAX_PULLS = 2;

  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Encounter ids of the packs caught, in the order the circle reached them. */
  readonly pulled: string[] = [];

  private elapsed = 0;
  private finished = false;

  constructor(
    /**
     * Where the contact happened, and therefore where the board goes.
     *
     * Public because the circle is the thing that decided the shape of this fight, and the
     * grid is laid inside it — reading the player's position instead would put the board
     * wherever they had drifted to over the two and a half seconds it took to draw.
     */
    readonly originX: number,
    readonly originZ: number,
    private readonly candidates: readonly Pack[],
    private readonly onDone: (pulled: string[]) => void,
  ) {
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#e04422'),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.renderOrder = 3;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(originX, 0.07, originZ);
    this.cutTo(0.01);
  }

  /** The circle as it stands right now — an annulus, so it reads as a ring and not a disc. */
  private cutTo(radius: number): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.RingGeometry(Math.max(0.01, radius * 0.82), radius, 48);
  }

  /** How far the edge has travelled. Linear, because the player is timing it by eye. */
  radiusAt(t: number): number {
    return (Math.min(t, CombatRing.DURATION) / CombatRing.DURATION) * CombatRing.RADIUS;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    const radius = this.radiusAt(this.elapsed);
    this.cutTo(radius);
    // Brightest as it goes out, fading as it thins — a ring at full alpha for the whole
    // two and a half seconds reads as a bug rather than as an expanding edge.
    this.mesh.material.opacity = 0.5 * (1 - this.elapsed / (CombatRing.DURATION * 1.4));

    for (const pack of this.candidates) {
      if (this.pulled.length >= CombatRing.MAX_PULLS) break;
      if (this.pulled.includes(pack.encounterId)) continue;
      const d = Math.hypot(pack.position.x - this.originX, pack.position.z - this.originZ);
      if (d > radius) continue;
      this.pulled.push(pack.encounterId);
      // It turns and comes in. Being caught by the circle has to look like a decision the
      // pack made, not like the ground claiming it.
      pack.answerTheCall(this.originX, this.originZ);
    }

    if (this.elapsed >= CombatRing.DURATION) {
      this.finished = true;
      this.onDone([...this.pulled]);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
