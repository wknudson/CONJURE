/**
 * Flat sprites standing up in a lit 3D scene.
 *
 * The whole HD-2D trick lives in two decisions here. The plane rotates on Y only, so it
 * turns to face the camera horizontally but never tips as the camera pitches — full
 * `lookAt` would lay the figures back like cards and the illusion goes with it. And the
 * material cuts out on alpha rather than blending, which keeps the silhouette hard and
 * lets the plane throw a real shadow with a hole in the middle of it.
 */

import * as THREE from 'three';
import { ACTOR_ALPHA_TEST, spriteTexture } from './textures.js';

/** The four frames an actor can be drawn in, before mirroring. */
export type Facing = 'down' | 'up' | 'left' | 'right';

export class BillboardSprite extends THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial> {
  /** Mirrored horizontally — a left-facing body is the right-facing art, flipped. */
  private mirrored = false;

  constructor(texture: THREE.Texture, worldWidth: number, worldHeight: number) {
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
      alphaTest: ACTOR_ALPHA_TEST,
      side: THREE.DoubleSide,
    });
    super(new THREE.PlaneGeometry(worldWidth, worldHeight), material);
    // Shift the geometry up so `position.y` sits at the feet, which is what every caller
    // means by "where it is standing".
    this.geometry.translate(0, worldHeight / 2, 0);
    this.castShadow = true;
    this.receiveShadow = false;
  }

  /** Cylindrical billboarding: Y only. */
  faceCamera(cam: THREE.Camera): void {
    this.rotation.y = Math.atan2(
      cam.position.x - this.position.x,
      cam.position.z - this.position.z,
    );
  }

  setTexture(texture: THREE.Texture): void {
    if (this.material.map !== texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }
  }

  /**
   * Flips the art without touching the billboard rotation.
   *
   * A negative X scale composes with the Y rotation cleanly because `DoubleSide` means the
   * now-inverted winding still draws. Mirroring at the texture instead would leak into the
   * right-facing frame, since both facings share one material.
   */
  setMirrored(on: boolean): void {
    if (this.mirrored === on) return;
    this.mirrored = on;
    this.scale.x = on ? -1 : 1;
  }
}

/**
 * Which frame to draw, from a world-space movement vector.
 *
 * Projected onto the *screen* axes rather than the world ones, so authored four-way art
 * stays correct as the camera orbits: walking north-east reads as "right" when the camera
 * is behind you and as "up" when it has swung ninety degrees.
 */
export function pickFacing(mx: number, mz: number, cameraYaw: number): Facing {
  const screenRight = mx * Math.cos(cameraYaw) - mz * Math.sin(cameraYaw);
  const screenAway = -mx * Math.sin(cameraYaw) - mz * Math.cos(cameraYaw);
  return Math.abs(screenAway) > Math.abs(screenRight)
    ? screenAway > 0
      ? 'up'
      : 'down'
    : screenRight > 0
      ? 'right'
      : 'left';
}

/**
 * One actor's art: a texture per frame, plus the second step of a walk cycle if it has one.
 *
 * The Commander has `side-alt`; companions do not, so `sideAlt` is optional and the walk
 * animation quietly does nothing for a beast rather than needing a branch at every call.
 */
export interface ActorArt {
  front: THREE.Texture;
  back: THREE.Texture;
  side: THREE.Texture;
  sideAlt?: THREE.Texture;
  /** Source aspect of the front frame, so the plane is not forced into a box. */
  aspect: number;
}

export function buildActorArt(
  images: { front: HTMLImageElement; back: HTMLImageElement; side: HTMLImageElement; sideAlt?: HTMLImageElement },
  maxAnisotropy: number,
): ActorArt {
  return {
    front: spriteTexture(images.front, maxAnisotropy),
    back: spriteTexture(images.back, maxAnisotropy),
    side: spriteTexture(images.side, maxAnisotropy),
    ...(images.sideAlt ? { sideAlt: spriteTexture(images.sideAlt, maxAnisotropy) } : {}),
    aspect: images.front.width / images.front.height,
  };
}

/**
 * The same thing from textures that were drawn rather than loaded.
 *
 * The Warden's frames come off a canvas already filtered for pixel art, so they must not
 * go through `spriteTexture` — that would blur exactly the hard edges they are drawn to
 * have.
 */
export function actorArtFromTextures(
  front: THREE.Texture,
  back: THREE.Texture,
  side: THREE.Texture,
  aspect: number,
): ActorArt {
  return { front, back, side, aspect };
}

export function disposeActorArt(art: ActorArt): void {
  art.front.dispose();
  art.back.dispose();
  art.side.dispose();
  art.sideAlt?.dispose();
}

/**
 * A body that walks: a billboard plus the art to draw it with, and enough state to run a
 * two-frame walk cycle off distance travelled rather than off a timer.
 *
 * Distance rather than time so the legs and the ground agree — a figure that walks into a
 * wall stops animating instead of jogging on the spot.
 */
export class Walker {
  readonly sprite: BillboardSprite;
  private readonly art: ActorArt;
  private facing: Facing = 'down';
  private walked = 0;

  constructor(art: ActorArt, height: number) {
    this.art = art;
    this.sprite = new BillboardSprite(art.front, height * art.aspect, height);
  }

  get position(): THREE.Vector3 {
    return this.sprite.position;
  }

  /** Reports movement since the last frame and redraws accordingly. */
  step(dx: number, dz: number, cameraYaw: number): void {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) {
      // Standing still: hold the frame, but reset the cycle so the next step starts on the
      // planted foot rather than mid-stride.
      this.walked = 0;
      this.applyFrame();
      return;
    }
    this.walked += dist;
    this.facing = pickFacing(dx, dz, cameraYaw);
    this.applyFrame();
  }

  /** Turns on the spot without moving — used when an NPC should look at you. */
  face(facing: Facing): void {
    this.facing = facing;
    this.walked = 0;
    this.applyFrame();
  }

  private applyFrame(): void {
    const sideways = this.facing === 'left' || this.facing === 'right';
    this.sprite.setMirrored(this.facing === 'left');

    if (this.facing === 'up') {
      this.sprite.setTexture(this.art.back);
      return;
    }
    if (!sideways) {
      this.sprite.setTexture(this.art.front);
      return;
    }
    // A stride every 0.9 units of ground covered reads as a walk at six units a second
    // without ever looking like a sprint.
    const alt = this.art.sideAlt;
    const onSecondFrame = alt !== undefined && Math.floor(this.walked / 0.9) % 2 === 1;
    this.sprite.setTexture(onSecondFrame ? alt! : this.art.side);
  }
}
