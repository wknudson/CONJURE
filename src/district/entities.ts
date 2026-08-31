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
import { CRITTERS, type CritterId, type CritterKind } from './wildlife.js';
import { beatPostAt, type PackHours } from './daylight.js';
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

  /**
   * Somewhere to be, or null to stand where they were put.
   *
   * Null for forty-seven of the forty-eight. The lamplighter is the exception and the reason this
   * exists: his whole line is that he lights the High Street, and until now he said so standing
   * still while the lamps came on by themselves. Walking is the only thing that makes the claim
   * true.
   *
   * The interact prompt follows him for free -- `updateInteraction` measures against the live
   * `position`, so a moving person is a person you catch up with.
   */
  goTo: { x: number; z: number } | null = null;
  /** Unhurried. A man on his rounds is not late for anything. */
  private static readonly WALK = 1.7;

  update(dt: number, t: number, cameraYaw: number): void {
    if (this.goTo) {
      const dx = this.goTo.x - this.position.x;
      const dz = this.goTo.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.35) {
        const step = Math.min(dist, NPC.WALK * dt);
        this.position.x += (dx / dist) * step;
        this.position.z += (dz / dist) * step;
        // The gait, and the facing that comes with it. Walking wins over looking at you: a man
        // on his rounds glances and keeps going.
        this.walker.step((dx / dist) * step, (dz / dist) * step, cameraYaw);
        return;
      }
    }

    if (this.playerAt) {
      const dx = this.playerAt.x - this.position.x;
      const dz = this.playerAt.z - this.position.z;
      if (Math.hypot(dx, dz) < this.interactRadius * 1.6) {
        this.walker.face(pickFacing(dx, dz, cameraYaw));
      }
    }
    // After the turn, not before it. `walker.position` is the sprite's own vector and
    // `Walker.face` ends by writing the standing bob -- zero -- into its `y`, so the order this
    // was in meant a townsperson stopped breathing the moment you walked up to them and started
    // again the moment you left. Caught by the wildlife tests, which asked the same question of
    // a rook and got it back on the ground.
    this.position.y = Math.abs(Math.sin(t * 1.4 + this.bobPhase)) * 0.035;
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
  /**
   * How much of its authored sight it has right now, 0 to 1. See `daylight.ts`.
   *
   * A multiplier held here rather than a changed `LOOK.visionRange`, for the reason `world.ts`
   * keeps `amb` and `lit` apart: `LOOK` is bound live by the tuning panel, and an hour that wrote
   * through it would mean nudging the vision slider at dusk permanently rewrote the authored
   * number for every area and every hour.
   */
  sight = 1;
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

  /**
   * What the hour does to that beat, 0 to 1. Set by the screen; see `wardenGraceAt`.
   *
   * The curfew. Lower is worse for the player, and it is lower at night — which is the one number
   * in this file that makes darkness a *harder* problem rather than an easier one.
   */
  grace = 1;

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
    this.cone.geometry = new THREE.CircleGeometry(this.range, 28, -half, half * 2);
  }

  /** How far it can actually see, this hour. The cone drawn on the road is this long. */
  get range(): number {
    return LOOK.visionRange * this.sight;
  }

  /**
   * Re-cuts the cone for a new hour, and only when the hour has actually moved it.
   *
   * `rebuildCone` disposes and re-allocates geometry, and the street clock ticks every frame --
   * so this is the guard that keeps a slow dusk from being a geometry churn sixty times a second.
   */
  setSight(k: number): void {
    if (Math.abs(k - this.sight) < 0.01) return;
    this.sight = k;
    this.rebuildCone();
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
  /**
   * What time it is. Drives which post it is due at; see `beatPostAt`.
   *
   * Pushed in rather than read, like `playerAt` and `playerSafe` above and for the same reason:
   * an entity in this file reaches for nothing.
   */
  hour = 0;
  onCatch: (() => void) | null = null;
  onAlertChange: ((alerted: boolean) => void) | null = null;

  private sees(): boolean {
    if (this.playerSafe) return false; // Sidewalk Immunity, absolute.
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.range || dist < 0.001) return false;
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
        // Where the clock says it is due, not the next post round the ring. See `beatPostAt`:
        // the whole value of this is that a player can learn it, and a loop that depends on
        // where the Warden happens to have got to is not learnable by anybody.
        const due = beatPostAt(this.hour, this.waypoints.length);
        if (due !== this.target) {
          this.target = due;
          this.pause = 0;
        }
        const wp = this.waypoints[this.target]!;
        const dist = this.steer(wp.x, wp.z, Warden.SPEED, dt, cameraYaw);
        // Arrived early, which is the ordinary case: the beat is two game-hours and the walk is
        // twenty real seconds. It stands at the post until the timetable moves on.
        if (dist < 0.6) this.state = 'PATROL';
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
      } else if (this.detect >= Warden.GRACE * this.grace) {
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
  /**
   * When this crew works, carried so the screen can ask the clock about it each tick.
   *
   * Held on the pack rather than looked up from the area each frame: the spec that built it is
   * the authority, and re-finding it by encounter id every tick would be a search per pack per
   * frame to answer a question that never changes.
   */
  hours: PackHours | undefined;
  /**
   * How much of its authored sight it has right now, 0 to 1.
   *
   * Steeper than the Warden's, because a pack has nothing to see by and the Magistracy has
   * gaslight. See `packSightAt`.
   */
  sight = 1;
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
    this.cone.geometry = new THREE.CircleGeometry(this.range, 28, -half, half * 2);
    this.aggroRing.geometry.dispose();
    this.aggroRing.geometry = new THREE.RingGeometry(this.range * 0.96, this.range, 40);
  }

  /** How far it can actually see, this hour. The cone and the ring are both this long. */
  get range(): number {
    return LOOK.packVisionRange * this.sight;
  }

  /** Re-cuts the cone and the ring, and only when the hour has moved them. See `Warden.setSight`. */
  setSight(k: number): void {
    if (Math.abs(k - this.sight) < 0.01) return;
    this.sight = k;
    this.rebuildCone();
  }

  /** Can it see you from where it is standing, facing the way it is facing? */
  sees(): boolean {
    if (!this.onShift) return false; // Off shift, and not on the road at all.
    if (this.playerSafe) return false; // Sanctioned pavement, same rule as the Warden's.
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.range || dist < 0.001) return false;
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
    this.drawn = v;
    this.applyVisible();
  }

  /**
   * Whether this crew is working right now.
   *
   * Separate from `setVisible`, and it has to be: that one is a fight taking the street away,
   * this one is the clock, and the two are asked at different moments by different owners. Folded
   * into a single flag, a fight that ended at dawn would put a night crew back on the road.
   *
   * Off shift a crew is invisible, blind and untouchable, and stands where it is. **Not
   * despawned**, which is the change the live street clock forced: the hour moves while the
   * player is standing in it, so a window can open under their feet — and a pack that existed
   * only if it happened to be its hour when the screen was built would mean waiting on the Chalk
   * Road at four in the morning and watching the waywatch's hour arrive with an empty road.
   */
  setOnShift(on: boolean): void {
    if (this.onShift === on) return;
    this.onShift = on;
    if (!on) {
      // Whatever it was doing about you, it has gone home. Clocking back on mid-sprint would be
      // a crew resuming a chase it left an hour ago.
      this.state = 'ROAM';
      this.detect = 0;
      this.pickTarget();
    }
    this.applyVisible();
  }

  /** Drawn only when the clock and the street both allow it. */
  private applyVisible(): void {
    const v = this.drawn && this.onShift;
    for (const w of this.walkers) w.sprite.visible = v;
    this.cone.visible = v;
    this.aggroRing.visible = v;
  }

  private drawn = true;
  /** False while its hours are closed. See `setOnShift`. */
  onShift = true;
  /**
   * How far it ranges right now, against its authored radius. See `packVigourAt`.
   *
   * A crew coming on shift is near where it started and one about to go off is drifting back, so
   * the patch is at its widest in the middle of the window. It is the difference between a shift
   * and a switch.
   */
  vigour = 1;

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
      // Scaled by how deep into its shift the crew is, so a patch opens out over the first of
      // the window and closes again at the end of it. See `packVigourAt`.
      const r = this.roam * this.vigour * (0.35 + this.rng() * 0.65);
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
      const lost = !this.sees() && this.rangeToPlayer() > this.range * Pack.GIVE_UP;
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

    // Off shift is off the road. Without this a crew that has clocked off is still standing
    // where it was, invisible, and walking through it starts a fight with something the player
    // cannot see -- the worst possible version of this feature.
    if (!this.onShift || this.spent || !this.onContact) return;
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
 * One animal, wandering its patch and breaking away from you.
 *
 * Most of this is `Pack` with the hunting taken out — a home, a radius, somewhere on it to walk
 * to, a beat of standing about, and a `Walker` so the body turns as it goes. That similarity is
 * deliberate rather than lazy: a pack roaming a road and a fox roaming a clearing are the same
 * motion, and the version of this that invented its own wander read as a different world from
 * the one the packs live in.
 *
 * What it adds is the whole reason it exists. **Flush**: come inside its tolerance and it runs
 * directly away from you for a beat, then goes back to what it was doing. That is the only thing
 * in this file the player can cause without a consequence attached, and it is what separates a
 * place with animals in it from a place with animated scenery in it.
 *
 * It is not an `Interactable` and it has no `onContact`. Nothing here can start a fight, be
 * targeted, be killed, or be walked into — a rabbit that blocked a doorway would be a soft-lock
 * with fur on. Ground kinds move *through* the collider layer so they go round walls; flying
 * kinds ignore it completely, because there is nothing at eleven units to go round.
 */
export class Critter implements Updatable {
  readonly walker: Walker;
  readonly position: THREE.Vector3;
  readonly kind: CritterKind;

  /** Set by the screen each frame, exactly as the Warden's and the pack's are. */
  playerAt = new THREE.Vector3();

  private readonly home: THREE.Vector2;
  private readonly target = new THREE.Vector2();
  private pause = 0;
  /** Seconds of bolting left. Above zero it is running from you and not steering anywhere. */
  private fleeing = 0;
  private readonly bobPhase: number;

  /**
   * How much faster it goes when it breaks.
   *
   * The number the anti-tunnelling bound has to be checked against, not `kind.speed`: the
   * fastest ground animal is the hare at 3.0, so this is 6.0, and `collision.ts` states its
   * proof against a `dt` clamped to 0.05 — a step of 0.3, inside the smallest collider radius.
   * The Warden's chase is quicker still, so nothing here moves the ceiling.
   */
  private static readonly FLUSH_SPEED = 2.0;
  /** How long a bolt lasts before it settles. Short: this is a startle, not a chase. */
  private static readonly FLUSH_TIME = 1.4;

  constructor(
    id: CritterId,
    art: ActorArt,
    homeX: number,
    homeZ: number,
    private readonly roam: number,
    private readonly colliders: ColliderSet,
    private readonly rng: () => number,
  ) {
    this.kind = CRITTERS[id];
    this.walker = new Walker(art, this.kind.height);
    this.walker.position.set(homeX, this.kind.flies ? (this.kind.altitude ?? 8) : 0, homeZ);
    this.position = this.walker.position;
    this.home = new THREE.Vector2(homeX, homeZ);
    this.target.set(homeX, homeZ);
    this.bobPhase = this.rng() * Math.PI * 2;
    this.pickTarget();
  }

  /**
   * Somewhere else on its patch that it can actually stand.
   *
   * The pack's routine, with one difference: a flying kind skips the collider check outright.
   * A rook whose wander was rejected because there is a chimney under it would spend the fight
   * circling the one clear corner of the ward.
   */
  private pickTarget(): void {
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * Math.PI * 2;
      const r = this.roam * (0.35 + this.rng() * 0.65);
      const x = this.home.x + Math.cos(a) * r;
      const z = this.home.y + Math.sin(a) * r;
      if (this.kind.flies || !this.colliders.blocked(x, z, 0.3)) {
        this.target.set(x, z);
        return;
      }
    }
    this.target.copy(this.home);
  }

  /** One step toward a spot. Through the collider layer on the ground, straight through it above. */
  private driveToward(tx: number, tz: number, speed: number, dt: number): void {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return;
    const mx = (dx / dist) * speed * dt;
    const mz = (dz / dist) * speed * dt;
    if (this.kind.flies) {
      this.position.x += mx;
      this.position.z += mz;
    } else {
      this.colliders.move(this.position as unknown as { x: number; z: number }, mx, mz, 0.3);
    }
  }

  update(dt: number, t: number, cameraYaw: number): void {
    const before = { x: this.position.x, z: this.position.z };

    if (this.fleeing > 0) {
      this.fleeing -= dt;
      // Directly away from where you are *now*, recomputed each frame, so walking after one
      // keeps it going rather than letting it run past you on the line it picked at the start.
      const dx = this.position.x - this.playerAt.x;
      const dz = this.position.z - this.playerAt.z;
      const dist = Math.hypot(dx, dz) || 1;
      this.driveToward(
        this.position.x + (dx / dist) * 6,
        this.position.z + (dz / dist) * 6,
        this.kind.speed * Critter.FLUSH_SPEED,
        dt,
      );
      if (this.fleeing <= 0) {
        // Wherever it has ended up is where it lives now. Snapping the home back would drag it
        // straight past the player it just ran from, which is the one thing it must not do.
        this.home.set(this.position.x, this.position.z);
        this.pause = 0.4 + this.rng() * 0.8;
        this.pickTarget();
      }
    } else if (this.startled()) {
      this.fleeing = Critter.FLUSH_TIME;
      this.pause = 0;
    } else if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.pickTarget();
    } else {
      const dx = this.target.x - this.position.x;
      const dz = this.target.y - this.position.z;
      if (Math.hypot(dx, dz) < 0.4) {
        // Longer than a pack's beat, and more variable. A pack loiters; an animal grazes,
        // and a field of sheep that all set off at once reads as a formation.
        this.pause = 1.5 + this.rng() * 5;
      } else {
        this.driveToward(this.target.x, this.target.y, this.kind.speed, dt);
      }
    }

    this.walker.step(this.position.x - before.x, this.position.z - before.z, cameraYaw);

    // Height, and it has to be written *after* `step` rather than before it.
    //
    // `walker.position` is the sprite's own position vector, and `Walker.step` ends by writing
    // the walking bob into its `y`. Set beforehand, every rook in the world was quietly put back
    // on the ground on the same frame it was lifted off it — which looked exactly like the
    // altitude never having been applied. `NPC` had the same bug for the same reason and it is
    // fixed above.
    //
    // A ground animal keeps whatever `step` gave it, which is the gait: that bob is wanted, and
    // overwriting it with zero would make everything with legs glide.
    if (this.kind.flies) {
      // A long slow rise and fall about the altitude it was given, which is what stops a flight
      // of rooks reading as a decal slid across the sky.
      this.position.y = (this.kind.altitude ?? 8) + Math.sin(t * 0.6 + this.bobPhase) * 0.8;
    }
  }

  /** Whether the player has just come inside its tolerance. Zero tolerance is never startled. */
  private startled(): boolean {
    if (this.kind.flush <= 0) return false;
    const dx = this.playerAt.x - this.position.x;
    const dz = this.playerAt.z - this.position.z;
    return Math.hypot(dx, dz) < this.kind.flush;
  }

  /** Off the street while a board stands on it. The same rule the packs follow. */
  setVisible(v: boolean): void {
    this.walker.sprite.visible = v;
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
      // A crew that is not working does not answer a circle drawn on the road. The ring is a
      // thing that *catches what is nearby*, and something off shift is not nearby -- it is not
      // there at all, and dragging it in would put a body on the grid that nobody had seen.
      if (!pack.onShift) continue;
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
