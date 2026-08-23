/**
 * Ashfall Ward — the hub, as a street you walk rather than a menu you read.
 *
 * The four trades are doors on a cross-street; the bounty board is a post on the plaza.
 * Opening any of them hands off to the same screens the DOM Safehouse used to open, and
 * closing one comes back here, to the spot the player left from.
 *
 * The whole screen is torn down and rebuilt on every one of those errands. That is the
 * cost of matching the app's one architecture (`ScreenManager` clears the root and each
 * screen owns its subtree), and it is why `unmount` below is written as carefully as it
 * is: a WebGL context leaked once per shop visit exhausts the browser's supply inside a
 * single session.
 */

import * as THREE from 'three';
import type { Screen } from '../app/ScreenManager.js';
import type { TutorialFlag } from '../app/save.js';
import type { Bounty } from '../core/data/bounties.js';
import type { Collection } from '../core/data/deckRules.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { Gender } from '../core/data/characterLook.js';
import { INVENTORY_LIMIT } from '../core/overworld/state.js';
import { GRIMOIRE_SIZE, companionById } from '../core/data/companions.js';
import { ascendableFor } from '../core/data/collection.js';
import { schematicsFor } from '../core/data/artificer.js';
import { fusedDeckSize, validateDeck } from '../core/data/deckRules.js';
import {
  loadCommanderSprite,
  loadCompanionSprite,
  type HeroFacing,
} from '../render/sprites.js';

import { LOOK, buildLookGui } from './look.js';
import { ColliderSet } from './collision.js';
import { DistrictWorld } from './world.js';
import { buildPostChain, type PostChain } from './post.js';
import { DistrictHud } from './hud.js';
import { DialogueBox, GATE_SEALED, VEX_INTRO, VEX_REPEAT } from './dialogue.js';
import {
  actorArtFromTextures,
  buildActorArt,
  disposeActorArt,
  Walker,
  type ActorArt,
} from './sprites3d.js';
import { makeWardenTexture } from './textures.js';
import {
  CompanionFollower,
  DoorHotspot,
  Hotspot,
  NPC,
  Warden,
  type Interactable,
  type Updatable,
} from './entities.js';
import {
  BOARD_POS,
  DOORS,
  GATE_POS,
  SPAWN,
  VEX_POS,
  WARDEN_WAYPOINTS,
  isSafeAt,
  type DoorKey,
} from './map.js';
import { flagForDoor, tutorialActive } from './quest.js';

const MAP_ID = 'ashfall_ward';
const MOVE_SPEED = 6;
const ORBIT_SPEED = 1.6;
const COMMANDER_HEIGHT = 2.1;
const COMPANION_HEIGHT = 1.5;

export interface DistrictOpts {
  global: GlobalGameState;
  /** The species standing beside the player — picks the follower's art and the door line. */
  companionId: string;
  companionLevel: number;
  gender: Gender;
  bounties: Bounty[];
  collection: Collection;
  deck: string[];
  notice?: { title: string; body: string };
  tutorial: readonly TutorialFlag[];
  onTutorialFlag: (flag: TutorialFlag) => void;
  onApothecary: () => void;
  onArtificer: () => void;
  onVivarium: () => void;
  onJournal: () => void;
  onBounty: (bounty: Bounty) => void;
  onChange?: () => void;
  onLeave: () => void;
}

export class DistrictScreen implements Screen {
  private readonly opts: DistrictOpts;

  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private world: DistrictWorld | null = null;
  private post: PostChain | null = null;
  private hud: DistrictHud | null = null;
  private dialogue: DialogueBox | null = null;
  private gui: ReturnType<typeof buildLookGui> | null = null;

  private player: Walker | null = null;
  private follower: CompanionFollower | null = null;
  private warden: Warden | null = null;
  private vex: NPC | null = null;

  private readonly interactables: Interactable[] = [];
  private readonly updatables: Updatable[] = [];
  private readonly heroArt: ActorArt[] = [];

  private readonly keys = new Set<string>();
  private cameraYaw = 0;
  private raf = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private inputLocked = true; // until the art has loaded and the world exists
  private disposed = false;

  private playerSafe = true;
  private readonly lastSafePos = new THREE.Vector3();
  private nearest: Interactable | null = null;
  private seizedTimer = 0;
  /** Local mirror of the profile's ledger, so the panel updates the instant a flag fires. */
  private flags: TutorialFlag[];

  private onKeyDown = (_e: KeyboardEvent): void => {};
  private onKeyUp = (_e: KeyboardEvent): void => {};
  private onResize = (): void => {};

  constructor(opts: DistrictOpts) {
    this.opts = opts;
    this.flags = [...opts.tutorial];
  }

  /* ============================================================
     Lifecycle
     ============================================================ */

  mount(root: HTMLElement): void {
    this.root = root;
    root.classList.add('screen', 'screen--district');

    const canvas = document.createElement('canvas');
    canvas.className = 'district-stage';
    root.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(root.clientWidth || innerWidth, root.clientHeight || innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LOOK.exposure;
    this.renderer = renderer;

    const colliders = new ColliderSet();
    this.colliderSet = colliders;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const world = new DistrictWorld(colliders, maxAnisotropy);
    this.world = world;

    const camera = new THREE.PerspectiveCamera(
      LOOK.fov,
      this.width() / this.height(),
      0.1,
      220,
    );
    this.camera = camera;

    this.post = buildPostChain(renderer, world.scene, camera, this.width(), this.height());

    this.hud = new DistrictHud({
      root,
      global: this.opts.global,
      onChange: this.opts.onChange,
      onBounty: (bounty) => this.opts.onBounty(bounty),
    });
    this.dialogue = new DialogueBox(root);

    this.buildInteractables();
    this.installInput();
    this.gui = buildLookGui(this.lookHandles());

    this.hud.renderTutorial(this.flags);

    if (this.opts.notice) {
      this.hud.showNotice(this.opts.notice, () => {
        this.inputLocked = false;
      });
    }

    // Art last: the ward is standing and rendering before the bodies arrive, which is a
    // better first frame than an empty canvas held back on a decode.
    void this.loadActors(colliders);

    // A handle on the ward from the console, for tuning and for driving it from a test.
    // Dev only: `import.meta.env.DEV` is statically false in a production build, so the
    // whole block is dropped rather than shipped as a global that reaches into the save.
    if (import.meta.env.DEV) {
      (globalThis as Record<string, unknown>).WARD = {
        screen: this,
        LOOK,
        player: () => this.player?.position,
        warden: () => this.warden,
        flags: () => this.flags,
        safe: () => this.playerSafe,
        nearest: () => this.nearest?.interactLabel ?? null,
        teleport: (x: number, z: number) => this.player?.position.set(x, 0, z),
      };
    }

    this.clock = new THREE.Clock();
    this.loop();
  }

  unmount(): void {
    if (this.disposed) return;
    this.disposed = true;

    cancelAnimationFrame(this.raf);
    this.raf = 0;

    // Where the player was standing, so the errand does not cost them the walk back.
    this.writePosition();

    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('resize', this.onResize);

    this.gui?.destroy();
    this.hud?.destroy();
    this.dialogue?.destroy();

    for (const art of this.heroArt) disposeActorArt(art);
    this.heroArt.length = 0;

    this.post?.dispose();
    this.world?.dispose();

    // `dispose` alone leaves the context alive. Browsers cap how many they will hand out,
    // and this screen is rebuilt on every shop visit, so the loss has to be explicit.
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();

    this.root?.classList.remove('screen--district');
    this.renderer = null;
    this.world = null;
    this.post = null;
    this.hud = null;
    this.dialogue = null;
    this.camera = null;
    this.canvas = null;
    this.root = null;
  }

  /* ============================================================
     Construction
     ============================================================ */

  private buildInteractables(): void {
    for (const door of DOORS) {
      const hotspot = new DoorHotspot(door.key, door.x, door.z, `Enter ${door.name}`, () =>
        this.openDoor(door.key, door.returnZ),
      );
      hotspot.interactDetail = this.doorStatus(door.key);
      this.interactables.push(hotspot);
    }

    const board = new Hotspot(BOARD_POS.x, BOARD_POS.z, 'Read the Bounty Board', () =>
      this.hud!.openBoard(this.opts.bounties, this.flags),
    );
    this.interactables.push(board);

    const gate = new Hotspot(GATE_POS.x, GATE_POS.z + 2.4, 'Inspect the warded gate', () =>
      this.dialogue!.start(GATE_SEALED),
    );
    this.interactables.push(gate);
  }

  /**
   * Loads the painted art and puts the bodies on the street.
   *
   * Everything is decoded before anything is added, so the Commander never appears a beat
   * before their beast. The loaders cache at module level, which makes every trip back
   * from a shop free after the first.
   */
  private async loadActors(colliders: ColliderSet): Promise<void> {
    const facings: HeroFacing[] = ['front', 'back', 'side', 'side-alt'];
    const { gender, companionId } = this.opts;
    // The Dispatcher wears the other bearing's coat. It is real painted art, it is already
    // on disk, and it is the cheapest way to guarantee the one person the player must talk
    // to does not look exactly like the player.
    const vexGender: Gender = gender === 'male' ? 'female' : 'male';

    const [hFront, hBack, hSide, hSideAlt, cFront, cBack, cSide, vFront, vBack, vSide] =
      await Promise.all([
        ...facings.map((f) => loadCommanderSprite(gender, f)),
        loadCompanionSprite(companionId, 'front'),
        loadCompanionSprite(companionId, 'back'),
        loadCompanionSprite(companionId, 'side'),
        loadCommanderSprite(vexGender, 'front'),
        loadCommanderSprite(vexGender, 'back'),
        loadCommanderSprite(vexGender, 'side'),
      ]);

    // The screen may have been swapped out while those were decoding.
    if (this.disposed || !this.world) return;

    const anis = this.renderer!.capabilities.getMaxAnisotropy();
    const heroArt = buildActorArt(
      { front: hFront!, back: hBack!, side: hSide!, sideAlt: hSideAlt! },
      anis,
    );
    const beastArt = buildActorArt({ front: cFront!, back: cBack!, side: cSide! }, anis);
    const vexArt = buildActorArt({ front: vFront!, back: vBack!, side: vSide! }, anis);
    const wardenArt = actorArtFromTextures(
      makeWardenTexture('front'),
      makeWardenTexture('back'),
      makeWardenTexture('side'),
      16 / 26,
    );
    this.heroArt.push(heroArt, beastArt, vexArt, wardenArt);

    const start = this.restorePosition();

    this.player = new Walker(heroArt, COMMANDER_HEIGHT);
    this.player.position.set(start.x, 0, start.z);
    this.world.scene.add(this.player.sprite);
    this.world.billboards.push(this.player.sprite);
    this.playerSafe = isSafeAt(start.x, start.z);
    // Seeded from the spawn unless the restored spot is genuinely pavement. Copying the
    // start position blind would make an alley the Commander logged out in count as
    // sanctuary — and the Warden's catch teleports you here, so the first thing it would
    // do is drop you back into the cone that caught you.
    this.lastSafePos.set(
      this.playerSafe ? start.x : SPAWN.x,
      0,
      this.playerSafe ? start.z : SPAWN.z,
    );

    this.follower = new CompanionFollower(
      beastArt,
      COMPANION_HEIGHT,
      start.x - 1.4,
      start.z + 1.2,
      colliders,
    );
    this.world.scene.add(this.follower.walker.sprite);
    this.world.billboards.push(this.follower.walker.sprite);
    this.updatables.push(this.follower);

    this.vex = new NPC(
      vexArt,
      COMMANDER_HEIGHT,
      VEX_POS.x,
      VEX_POS.z,
      'Talk to Dispatcher Vex',
      () => this.talkToVex(),
      1.3,
    );
    this.world.scene.add(this.vex.walker.sprite);
    this.world.billboards.push(this.vex.walker.sprite);
    this.updatables.push(this.vex);
    this.interactables.push(this.vex);

    this.warden = new Warden(wardenArt, 2.5, WARDEN_WAYPOINTS, colliders);
    this.world.scene.add(this.warden.walker.sprite);
    this.world.scene.add(this.warden.cone);
    this.world.billboards.push(this.warden.walker.sprite);
    this.updatables.push(this.warden);
    this.warden.onCatch = () => this.seize();
    this.warden.onAlertChange = (on) => this.hud?.setAlert(on);

    // Compile what the ward will need before it needs it, then let the player move.
    this.world.warmupShaders(() => this.post!.composer.render());
    if (!this.opts.notice) this.inputLocked = false;
  }

  /* ============================================================
     Doors, position, and the guided lap
     ============================================================ */

  /** The status line the old Safehouse door carried, now under the interact prompt. */
  private doorStatus(key: DoorKey): string {
    const { global, collection, deck, companionId, companionLevel } = this.opts;
    if (key === 'apothecary') {
      const { inventory } = global.overworld;
      return inventory.length >= INVENTORY_LIMIT
        ? 'Satchel full'
        : `room for ${INVENTORY_LIMIT - inventory.length} more`;
    }
    if (key === 'artificer') {
      const raise = ascendableFor(collection).length;
      const cut = schematicsFor(collection).length;
      if (raise > 0) return `${raise} ready to ascend · ${cut} schematics`;
      return cut === 0 ? 'nothing on the bench' : `${cut} schematics on file`;
    }
    if (key === 'vivarium') {
      const name = companionById(companionId)?.name ?? 'Nobody';
      return `${name} · Level ${companionLevel}`;
    }
    const problems = validateDeck(deck, collection);
    const total = fusedDeckSize(deck.length);
    return problems.length > 0
      ? `${deck.length} of ${total} — needs editing`
      : `${total} cards — ${deck.length} yours, ${GRIMOIRE_SIZE} the beast's`;
  }

  private openDoor(key: DoorKey, returnZ: number): void {
    // Written before the hand-off, not only on unmount: a tab closed inside the Artificer
    // should still come back to his doorstep rather than to the plaza.
    this.writePosition(returnZ);

    const flag = flagForDoor(key);
    if (flag) this.raiseFlag(flag);

    if (key === 'apothecary') this.opts.onApothecary();
    else if (key === 'artificer') this.opts.onArtificer();
    else if (key === 'vivarium') this.opts.onVivarium();
    else this.opts.onJournal();
  }

  private talkToVex(): void {
    const first = !this.flags.includes('intro');
    this.dialogue!.start(first ? VEX_INTRO : VEX_REPEAT, () => {
      if (first) this.raiseFlag('intro');
    });
  }

  /** Records a step locally so the panel is right now, and upward so it is right later. */
  private raiseFlag(flag: TutorialFlag): void {
    if (!this.flags.includes(flag)) this.flags.push(flag);
    this.opts.onTutorialFlag(flag);
    this.hud?.renderTutorial(this.flags);
  }

  /**
   * Where the Commander will be standing when they next see this street.
   *
   * A door sets `overrideZ` to a stride clear of itself, and that has to survive the
   * `unmount` that follows immediately after — otherwise the second write puts them back
   * on the hotspot and the prompt to enter the shop they just left is the first thing they
   * see. Once a door has spoken, later writes are ignored.
   */
  private writePosition(overrideZ?: number): void {
    if (!this.player) return;
    if (overrideZ === undefined && this.returnZ !== null) return;
    if (overrideZ !== undefined) this.returnZ = overrideZ;

    this.opts.global.overworld.playerPos = {
      x: this.player.position.x,
      y: overrideZ ?? this.player.position.z,
      mapId: MAP_ID,
    };
    this.opts.onChange?.();
  }

  private returnZ: number | null = null;

  /**
   * Where to put the Commander down.
   *
   * A stored position is only trusted if it came from this ward and still names somewhere
   * you can stand — the map is data and data drifts, and a spawn inside a wall is worse
   * than a spawn in the wrong place.
   *
   * "Can stand" and not "is pavement", deliberately. Standing on cobbles is legal; it is
   * the whole point of the danger zone. Asking for a safe tile here would quietly move
   * anyone who closed the tab in an alley back to the plaza.
   */
  private restorePosition(): { x: number; z: number } {
    const saved = this.opts.global.overworld.playerPos;
    if (saved && saved.mapId === MAP_ID && !this.colliderSet?.blocked(saved.x, saved.y)) {
      return { x: saved.x, z: saved.y };
    }
    return { x: SPAWN.x, z: SPAWN.z };
  }

  /* ============================================================
     Input
     ============================================================ */

  private installInput(): void {
    this.onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      this.keys.add(e.code);

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.dialogue?.open) this.dialogue.advance();
        else if (this.hud?.boardIsOpen) this.hud.closeBoard();
        else if (!this.inputLocked && this.nearest) this.nearest.onInteract();
        return;
      }
      if (e.code === 'KeyI') {
        e.preventDefault();
        this.hud?.toggleSatchel();
        return;
      }
      if (e.code === 'Escape') {
        if (this.hud?.boardIsOpen) this.hud.closeBoard();
        return;
      }
    };
    this.onKeyUp = (e: KeyboardEvent): void => void this.keys.delete(e.code);
    this.onResize = (): void => {
      const camera = this.camera;
      if (!camera || !this.renderer || !this.post) return;
      camera.aspect = this.width() / this.height();
      camera.updateProjectionMatrix();
      this.renderer.setSize(this.width(), this.height());
      this.post.setSize(this.width(), this.height());
    };

    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('resize', this.onResize);
  }

  private width(): number {
    return this.root?.clientWidth || innerWidth;
  }

  private height(): number {
    return this.root?.clientHeight || innerHeight;
  }

  /* ============================================================
     Frame
     ============================================================ */

  private loop = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    this.updatePlayer(dt);
    this.updateCamera();

    const world = this.world!;
    const camera = this.camera!;
    const anchor = this.player?.position ?? new THREE.Vector3(SPAWN.x, 0, SPAWN.z);

    if (this.warden) {
      this.warden.playerAt.copy(anchor);
      this.warden.playerSafe = this.playerSafe;
    }
    if (this.vex) this.vex.playerAt = anchor;

    for (const u of this.updatables) u.update(dt, this.elapsed, this.cameraYaw);

    world.updateLamps(this.elapsed);
    world.updateImpactLights(dt);
    world.scrollWater(dt);
    world.trackSun(anchor.x, anchor.y, anchor.z);
    world.updateOccluders(dt, camera, anchor);
    for (const b of world.billboards) b.faceCamera(camera);

    this.updateInteraction();
    this.dialogue?.update(dt);

    if (this.seizedTimer > 0) {
      this.seizedTimer -= dt;
      if (this.seizedTimer <= 0) {
        this.hud?.hideOverlay();
        this.inputLocked = false;
      }
    }

    this.post!.composer.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private updatePlayer(dt: number): void {
    // Orbit stays live even mid-conversation: it cannot change any state, and locking it
    // makes the world feel frozen rather than the player feel busy.
    if (this.keys.has('KeyQ')) this.cameraYaw -= ORBIT_SPEED * dt;
    if (this.keys.has('KeyE')) this.cameraYaw += ORBIT_SPEED * dt;

    const player = this.player;
    if (!player) return;

    const busy = this.inputLocked || this.dialogue?.open || this.hud?.boardIsOpen;
    let dx = 0;
    let dz = 0;

    if (!busy) {
      const fwdX = -Math.sin(this.cameraYaw);
      const fwdZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);

      let ix = 0;
      let iy = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;

      let mx = fwdX * iy + rightX * ix;
      let mz = fwdZ * iy + rightZ * ix;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx = (mx / len) * MOVE_SPEED * dt;
        mz = (mz / len) * MOVE_SPEED * dt;
        const before = { x: player.position.x, z: player.position.z };
        this.colliders().move(player.position as unknown as { x: number; z: number }, mx, mz);
        dx = player.position.x - before.x;
        dz = player.position.z - before.z;
      }
    }

    player.step(dx, dz, this.cameraYaw);
    this.follower?.notePlayer(player.position.x, player.position.z);

    // The Sidewalk Immunity check, every frame.
    this.playerSafe = isSafeAt(player.position.x, player.position.z);
    this.hud?.setZone(this.playerSafe);
    if (this.playerSafe) this.lastSafePos.copy(player.position);
  }

  private updateCamera(): void {
    const camera = this.camera;
    const anchor = this.player?.position ?? new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
    if (!camera) return;

    const pitch = THREE.MathUtils.degToRad(LOOK.cameraPitch);
    const horizontal = Math.cos(pitch) * LOOK.cameraDistance;
    const height = Math.sin(pitch) * LOOK.cameraDistance;
    camera.position.set(
      anchor.x + Math.sin(this.cameraYaw) * horizontal,
      height,
      anchor.z + Math.cos(this.cameraYaw) * horizontal,
    );
    camera.lookAt(anchor.x, anchor.y + 1.0, anchor.z);
  }

  private updateInteraction(): void {
    const player = this.player;
    const busy = this.inputLocked || this.dialogue?.open || this.hud?.boardIsOpen;
    if (!player || busy) {
      this.nearest = null;
      this.hud?.setPrompt(null, null);
      return;
    }

    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const e of this.interactables) {
      if (!e.interactLabel) continue;
      const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
      if (d < e.interactRadius && d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    this.nearest = best;
    this.hud?.setPrompt(best?.interactLabel ?? null, best?.interactDetail ?? null);
  }

  /**
   * Caught off the pavement.
   *
   * Costs nothing but the walk back. This is a lesson, not a tax — a Pact charge here
   * would punish the one player who went to find out what the rule meant, which is
   * precisely the player who was doing it right.
   */
  private seize(): void {
    if (this.inputLocked || !this.player) return;
    this.inputLocked = true;
    this.seizedTimer = 1.6;
    this.hud?.setAlert(false);
    this.world?.spawnImpactLight(this.player.position, '#ff5a30', 1.6);
    this.hud?.showSeized();
    this.player.position.set(this.lastSafePos.x, 0, this.lastSafePos.z);
    this.follower?.snapTo(this.lastSafePos.x - 1.2, this.lastSafePos.z + 1.0);
    this.playerSafe = true;
    this.warden?.reset();
  }

  private colliders(): ColliderSet {
    // The world owns the set it was built with; nothing else needs a handle on it.
    return this.colliderSet!;
  }

  private colliderSet: ColliderSet | null = null;

  /* ============================================================
     Panel wiring
     ============================================================ */

  private lookHandles(): Parameters<typeof buildLookGui>[0] {
    return {
      onExposure: (v) => {
        if (this.renderer) this.renderer.toneMappingExposure = v;
      },
      onCamera: () => {
        if (!this.camera) return;
        this.camera.fov = LOOK.fov;
        this.camera.updateProjectionMatrix();
      },
      onSun: () => this.world?.applySun(),
      onAmbient: () => this.world?.applyAmbient(),
      onFog: () => this.world?.applyFog(),
      onBloom: () => {
        if (!this.post) return;
        this.post.bloom.strength = LOOK.bloomStrength;
        this.post.bloom.radius = LOOK.bloomRadius;
        this.post.bloom.threshold = LOOK.bloomThreshold;
      },
      onTilt: () => this.post?.syncTilt(this.width(), this.height()),
      onLamps: () => this.world?.applyLamps(),
      onSigns: () => this.world?.applySigns(),
      onVision: () => this.warden?.rebuildCone(),
      onColliders: (show) => this.world?.setCollidersVisible(show),
    };
  }

  /** Whether the guided lap is still running — read by the board when it opens. */
  get guiding(): boolean {
    return tutorialActive(this.flags);
  }
}
