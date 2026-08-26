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
  loadCommanderWalk,
  loadCommanderWalkSheet,
  loadCompanionSprite,
  type HeroFacing,
} from '../render/sprites.js';

import { LOOK, buildLookGui } from './look.js';
import { ColliderSet } from './collision.js';
import { DistrictWorld } from './world.js';
import { buildPostChain, type PostChain } from './post.js';
import { DistrictHud } from './hud.js';
import { DialogueBox, VEX_INTRO, VEX_REPEAT } from './dialogue.js';
import {
  FACING,
  actorArtFromTextures,
  buildActorArt,
  buildSheetActorArt,
  disposeActorArt,
  Walker,
  type ActorArt,
} from './sprites3d.js';
import { makeMinionTexture, makeWardenTexture } from './textures.js';
import {
  CombatRing,
  CompanionFollower,
  DoorHotspot,
  Hotspot,
  NPC,
  Pack,
  Warden,
  type Interactable,
  type Updatable,
} from './entities.js';
import { isSafeAt, type AreaDef, type DoorKey, type ExitSpec } from './map.js';
import { huntAvailable } from '../core/data/hunts.js';
import { hashText, makeRng, nextInt } from '../core/util/rng.js';
import { flagForDoor, tutorialActive } from './quest.js';

const MOVE_SPEED = 6;
const ORBIT_SPEED = 1.6;
const COMMANDER_HEIGHT = 2.1;
const COMPANION_HEIGHT = 1.5;

/**
 * The colour a lustrous companion is multiplied by.
 *
 * Warm gold with the blue pulled down, so any beast reads as gilded regardless of its own
 * palette — a tint keyed to the species' school would be invisible on half of them.
 */
const SHINY_TINT = 0xffe9a8;

export interface DistrictOpts {
  /**
   * Which place this is.
   *
   * The screen was Ashfall Ward and is now whichever area it is handed — the shops, the
   * Dispatcher and the Warden are all built from `area.props` and simply absent where the
   * props are. One screen rather than a base class and two leaves: of ~800 lines here, about
   * 120 are ward content, and `unmount`'s disposal ordering is the kind of thing that breaks
   * when a subclass owns a resource the base never tears down.
   */
  area: AreaDef;
  global: GlobalGameState;
  /** The species standing beside the player — picks the follower's art and the door line. */
  companionId: string;
  companionLevel: number;
  /** Whether the beast beside you is lustrous. Tints the follower, nothing more. */
  companionShiny?: boolean;
  gender: Gender;
  bounties: Bounty[];
  /**
   * The Wild Hunts, and when each was last walked.
   *
   * Handed in the same way `bounties` is — composed once per district entry, so the panel
   * renders from data rather than reaching into a profile the district has never been
   * allowed to see. `hunts` is the raw stamp map; the panel does the cooldown arithmetic
   * against a clock it reads itself, because a countdown has to tick while the panel is
   * open and a value captured at mount would be stale by the time anybody read it.
   */
  huntBoard: Bounty[];
  hunts: Readonly<Record<string, number>>;
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
  /** Walking out of one area and into another. */
  onTravel: (exit: ExitSpec) => void;
  /**
   * Walking into a pack, and whoever else the Combat Ring closed on.
   *
   * Separate from `onBounty` because a pack is not a contract the player accepted -- it is a
   * fight that happened to them -- and because the guided lap must not count it: taking one
   * would otherwise tick `bounty_taken` and skip a step of the tutorial the player never did.
   *
   * `pulled` is the other packs the ring caught, in the order it caught them, and is empty
   * far more often than not -- one mob is the ordinary case and two is the road being unkind.
   */
  onPack: (encounterId: string, pulled: string[]) => void;
  onChange?: () => void;
  onLeave: () => void;
}

export class DistrictScreen implements Screen {
  private readonly opts: DistrictOpts;
  /** Shorthand: this is read on nearly every line below. */
  private readonly area: AreaDef;

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
  private readonly packs: Pack[] = [];
  /**
   * The last place worth being put back to.
   *
   * In the ward that is the last pavement tile, and the Warden's catch uses it. Out on the
   * road there is no pavement, so it is the last spot clear of every pack -- which is what
   * stops a fight you just walked into being a fight you immediately walk into again.
   */
  private readonly lastRefuge = new THREE.Vector3();
  /**
   * How long before the packs are allowed to notice you.
   *
   * Covers the case the refuge cannot: a tab closed while standing on top of one. Without it
   * that save reopens straight into the same fight, forever.
   */
  private packArming = 1.5;
  /** The circle currently closing, if the player has just walked into something. */
  private ring: CombatRing | null = null;
  /** Counts the BATTLE flash down; at zero the fight is handed over. */
  private battleTimer = 0;
  /** Who is in that fight, settled the moment the circle stopped growing. */
  private pendingFight: { encounterId: string; pulled: string[] } | null = null;
  /** Local mirror of the profile's ledger, so the panel updates the instant a flag fires. */
  private flags: TutorialFlag[];

  private onKeyDown = (_e: KeyboardEvent): void => {};
  private onKeyUp = (_e: KeyboardEvent): void => {};
  private onResize = (): void => {};

  constructor(opts: DistrictOpts) {
    this.opts = opts;
    this.area = opts.area;
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

    const colliders = new ColliderSet(this.area);
    this.colliderSet = colliders;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const world = new DistrictWorld(this.area, colliders, maxAnisotropy);
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
    this.gui = buildLookGui(this.lookHandles(), this.area.id, this.area.name);

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
        FACING,
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

    // Geometry cut per-pack rather than shared, so it is freed per-pack too. `world.dispose`
    // clears the scene but does not own what was hung on it from out here.
    for (const pack of this.packs) pack.dispose();
    this.ring?.dispose();
    this.ring = null;

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
    for (const door of this.area.props.doors ?? []) {
      const hotspot = new DoorHotspot(door.key, door.x, door.z, `Enter ${door.name}`, () =>
        this.openDoor(door.key, door.returnZ),
      );
      hotspot.interactDetail = this.doorStatus(door.key);
      this.interactables.push(hotspot);
    }

    if (this.area.props.board) {
      const at = this.area.props.board;
      const board = new Hotspot(at.x, at.z, 'Read the Bounty Board', () =>
        this.hud!.openBoard(this.opts.bounties, this.flags),
      );
      this.interactables.push(board);
    }

    // Every way out of here. The ward's gate used to open a panel of hunts; it is a road
    // now, and the panel moved to a signpost on the far side where the cooldowns are still
    // worth reading.
    for (const exit of this.area.exits) {
      this.interactables.push(new Hotspot(exit.x, exit.z, exit.label, () => this.travel(exit)));
    }

    // The hunts board, where an area posts one.
    if (this.area.props.huntSignpost) {
      const at = this.area.props.huntSignpost;
      const signpost = new Hotspot(at.x, at.z, 'Read the hunting notices', () =>
        this.hud!.openHunts(this.opts.huntBoard, this.opts.hunts),
      );
      this.interactables.push(signpost);
    }
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

    // The beast is fetched apart from the people, and allowed to fail.
    //
    // Not every species has art: the campaign hands out bloodlines faster than they can be
    // painted, and a bound Chimera used to take the whole street down with it — one 404
    // rejected the batch, so the ward opened with no Commander, no Vex and no Warden, and
    // input never unlocked. A beast nobody has drawn yet should cost exactly one beast.
    const beast = await Promise.all([
      loadCompanionSprite(companionId, 'front').catch(() => null),
      loadCompanionSprite(companionId, 'back').catch(() => null),
      loadCompanionSprite(companionId, 'side').catch(() => null),
    ]);

    const [hFront, hBack, hSide, hSideAlt, vFront, vBack, vSide] = await Promise.all([
      ...facings.map((f) => loadCommanderSprite(gender, f)),
      loadCommanderSprite(vexGender, 'front'),
      loadCommanderSprite(vexGender, 'back'),
      loadCommanderSprite(vexGender, 'side'),
    ]);
    // Front is the one that must exist — the other two fall back to it, exactly as a
    // species with only a front sprite already renders on the creation screen.
    const [cFront, cBack, cSide] = [beast[0], beast[1] ?? beast[0], beast[2] ?? beast[0]];

    // The walk art, fetched apart from the rest and allowed to fail at every step.
    //
    // Three sources in order of preference, because the two bearings are not in the same
    // place: the male has a twenty-frame sheet, the female still has her four separate
    // frames, and anything with neither falls back to the standing profile. Only `side` is
    // covered at all — there are no front or back walk frames for either.
    //
    // Kept out of the `Promise.all` above because a missing walk should cost the animation
    // and nothing else. Folded in, one absent file would reject the whole batch and the
    // street would open with no Commander, no companion and no Vex standing in it.
    const walkSheet = await loadCommanderWalkSheet(gender).catch(() => null);
    const heroWalk = walkSheet ? null : await loadCommanderWalk(gender, 'side').catch(() => null);
    if (this.disposed || !this.world) return;

    // The screen may have been swapped out while those were decoding.
    if (this.disposed || !this.world) return;

    const anis = this.renderer!.capabilities.getMaxAnisotropy();
    const heroArt = walkSheet
      ? buildSheetActorArt(
          { front: hFront!, back: hBack!, side: hSide!, sheet: walkSheet },
          anis,
        )
      : buildActorArt(
          {
            front: hFront!,
            back: hBack!,
            side: hSide!,
            // The four separate frames when they loaded, and otherwise the old two-pose
            // shuffle — so a bearing with no walk art still has legs that move at all.
            // `side-alt` is that second pose, and it is why it is still fetched above.
            sideWalk: heroWalk ? [...heroWalk.frames] : [hSide!, hSideAlt!],
          },
          anis,
        );
    const beastArt = cFront
      ? buildActorArt({ front: cFront, back: cBack!, side: cSide! }, anis)
      : null;
    const vexArt = buildActorArt({ front: vFront!, back: vBack!, side: vSide! }, anis);
    const wardenArt = actorArtFromTextures(
      makeWardenTexture('front'),
      makeWardenTexture('back'),
      makeWardenTexture('side'),
    );
    this.heroArt.push(heroArt, vexArt, wardenArt);
    if (beastArt) this.heroArt.push(beastArt);

    const start = this.restorePosition();

    this.player = new Walker(heroArt, COMMANDER_HEIGHT);
    this.player.position.set(start.x, 0, start.z);
    this.world.scene.add(this.player.sprite);
    this.world.billboards.push(this.player.sprite);
    this.playerSafe = isSafeAt(this.area, start.x, start.z);
    // Seeded from the spawn unless the restored spot is genuinely pavement. Copying the
    // start position blind would make an alley the Commander logged out in count as
    // sanctuary — and the Warden's catch teleports you here, so the first thing it would
    // do is drop you back into the cone that caught you.
    this.lastSafePos.set(
      this.playerSafe ? start.x : this.area.spawn.x,
      0,
      this.playerSafe ? start.z : this.area.spawn.z,
    );
    // Seeded to the spawn rather than to wherever we came in: on a road with no pavement the
    // arrival tile is as likely as any other to be next to something.
    this.lastRefuge.set(this.area.spawn.x, 0, this.area.spawn.z);

    // No art, no follower. The Commander walks the ward alone rather than beside a hole,
    // and everything downstream already treats the follower as optional.
    if (beastArt) {
      this.follower = new CompanionFollower(
        beastArt,
        COMPANION_HEIGHT,
        start.x - 1.4,
        start.z + 1.2,
        colliders,
      );
      // A lustrous beast walks the ward wearing it. Cosmetic, like the tank treatment the
      // Vivarium gives it — see `CompanionInstance.shiny`.
      if (this.opts.companionShiny) this.follower.walker.sprite.setTint(SHINY_TINT);
      this.world.scene.add(this.follower.walker.sprite);
      this.world.billboards.push(this.follower.walker.sprite);
      this.updatables.push(this.follower);
    }

    // The Dispatcher, where an area has one to stand.
    const npc = this.area.props.npcs?.[0];
    if (npc && vexArt) {
      this.vex = new NPC(
        vexArt,
        COMMANDER_HEIGHT,
        npc.x,
        npc.z,
        'Talk to Dispatcher Vex',
        () => this.talkToVex(),
        1.3,
      );
      this.world.scene.add(this.vex.walker.sprite);
      this.world.billboards.push(this.vex.walker.sprite);
      this.updatables.push(this.vex);
      this.interactables.push(this.vex);
    }

    const beat = this.area.props.patrols?.[0];
    if (beat && wardenArt) {
      this.warden = new Warden(wardenArt, 2.5, beat, colliders);
      this.world.scene.add(this.warden.walker.sprite);
      this.world.scene.add(this.warden.cone);
      this.world.billboards.push(this.warden.walker.sprite);
      this.updatables.push(this.warden);
      this.warden.onCatch = () => this.seize();
      this.warden.onAlertChange = (on) => this.hud?.setAlert(on);
    }

    // The roaming packs.
    //
    // Skipped where the fight is on cooldown, which reuses the hunt clock already in the
    // save rather than inventing a second one -- and means a road you have just cleared
    // reads as cleared. That is also the third of the four things standing between the
    // player and an immediate re-trigger on the way back from a fight.
    const specs = this.area.props.packs ?? [];
    if (specs.length > 0) {
      const now = Date.now();
      for (const spec of specs) {
        const last = this.opts.hunts[spec.encounterId];
        if (!huntAvailable(last, now)) continue;

        const seed = hashText(spec.encounterId);
        const art = actorArtFromTextures(
          makeMinionTexture('front', seed),
          makeMinionTexture('back', seed),
          makeMinionTexture('side', seed),
        );
        this.heroArt.push(art);

        const rng = makeRng(seed >>> 0);
        const pack = new Pack(
          spec.encounterId,
          art,
          1.9,
          spec.x,
          spec.z,
          spec.roam,
          colliders,
          () => nextInt(rng, 10_000) / 10_000,
        );
        pack.onContact = () => this.ambush(spec.encounterId);
        for (const w of pack.walkers) {
          this.world.scene.add(w.sprite);
          this.world.billboards.push(w.sprite);
        }
        // The cone and its ring lie flat on the road, so they are scene furniture rather
        // than billboards — nothing about them should turn to face the camera.
        this.world.scene.add(pack.cone);
        this.world.scene.add(pack.aggroRing);
        this.packs.push(pack);
        this.updatables.push(pack);
      }
    }

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
    this.writePosition({ x: this.player?.position.x ?? 0, z: returnZ });

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
   * A door pins a spot a stride clear of itself, and that has to survive the `unmount` that
   * follows immediately after — otherwise the second write puts them back on the hotspot and
   * the prompt to enter the shop they just left is the first thing they see. Once something
   * has pinned a position, later writes are ignored.
   *
   * Generalised from a bare `overrideZ` to a whole position and a destination, because
   * travel needs the same latch for the same reason and needs to move the player to a
   * different **area** as well as a different tile.
   */
  private writePosition(pin?: { x: number; z: number; mapId?: string }): void {
    if (!this.player) return;
    if (!pin && this.positionPinned) return;
    if (pin) this.positionPinned = true;

    this.opts.global.overworld.playerPos = {
      x: pin?.x ?? this.player.position.x,
      y: pin?.z ?? this.player.position.z,
      mapId: pin?.mapId ?? this.area.id,
    };
    this.opts.onChange?.();
  }

  private positionPinned = false;

  /**
   * Out of this area and into the one the exit names.
   *
   * The arrival is written **before** the hand-off, for the reason `openDoor` writes its
   * own: `unmount` runs immediately after and would otherwise overwrite the destination with
   * wherever the player happened to be standing when they pressed Space.
   */
  private travel(exit: ExitSpec): void {
    this.writePosition({ x: exit.arrive.x, z: exit.arrive.z, mapId: exit.to });
    this.opts.onTravel(exit);
  }

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
    if (saved && saved.mapId === this.area.id && !this.colliderSet?.blocked(saved.x, saved.y)) {
      return { x: saved.x, z: saved.y };
    }
    return { x: this.area.spawn.x, z: this.area.spawn.z };
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
    const anchor = this.player?.position ?? new THREE.Vector3(this.area.spawn.x, 0, this.area.spawn.z);

    if (this.warden) {
      this.warden.playerAt.copy(anchor);
      this.warden.playerSafe = this.playerSafe;
    }
    if (this.vex) this.vex.playerAt = anchor;
    if (this.packArming > 0) this.packArming -= dt;
    // Pack aggro answers to the pavement, not to `this.playerSafe`. That flag is pinned
    // true in an area with no walkways, because what it means is "no Warden may see you
    // here" — and out on the verge nothing hunting you needs a warrant.
    const onWalkway =
      this.area.safety === 'sidewalk' && isSafeAt(this.area, anchor.x, anchor.z);
    for (const pack of this.packs) {
      pack.playerAt.copy(anchor);
      pack.playerSafe = onWalkway;
      // Armed only once the screen has settled, and never while something else has the
      // player's attention.
      pack.onContact =
        this.packArming > 0 || this.inputLocked || this.hud?.boardIsOpen
          ? null
          : () => this.ambush(pack.encounterId);
    }

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

    // The flash, and then the fight. Handed over under full cover rather than on the frame
    // the ring closed, so the screen swap happens behind the word instead of beside it.
    if (this.battleTimer > 0) {
      this.battleTimer -= dt;
      if (this.battleTimer <= 0 && this.pendingFight) {
        const { encounterId, pulled } = this.pendingFight;
        this.pendingFight = null;
        this.opts.onPack(encounterId, pulled);
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

    // The Sidewalk Immunity check, every frame -- where the area has the rule at all. An
    // area with no pavement is not an area where you are permanently in danger; it is one
    // where the rule does not apply, and the chip should say the second thing by not being
    // there.
    if (this.area.safety === 'sidewalk') {
      this.playerSafe = isSafeAt(this.area, player.position.x, player.position.z);
      this.hud?.setZone(this.playerSafe);
      if (this.playerSafe) this.lastSafePos.copy(player.position);
      this.lastRefuge.copy(this.lastSafePos);
    } else {
      this.playerSafe = true; // nothing out here is hunting by warrant
      this.hud?.hideZone();
      if (this.packs.every((p) => p.clearOf(player.position.x, player.position.z))) {
        this.lastRefuge.copy(player.position);
      }
    }
  }

  private updateCamera(): void {
    const camera = this.camera;
    const anchor = this.player?.position ?? new THREE.Vector3(this.area.spawn.x, 0, this.area.spawn.z);
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
  /**
   * Walked into a pack: open the circle.
   *
   * Input locks here rather than when the fight starts, and the two and a half seconds in
   * between are the mechanic — the ring is drawing, and anything else on this road that it
   * reaches is in the fight too. Locking immediately is also what makes fleeing a
   * non-question: the circle is not a window to escape through, it is the moment the road
   * decided how big this fight is going to be.
   *
   * The position written is the **refuge**, not the tile the collision happened on. Writing
   * the collision tile means arriving back inside the pack's contact radius, which re-starts
   * the fight on the first frame -- and after a loss `rescuePlayer` puts the player there at
   * a tenth of their Pact, so it is a death loop rather than an annoyance.
   */
  private ambush(encounterId: string): void {
    if (this.inputLocked || !this.player || this.ring) return;
    this.inputLocked = true;
    this.writePosition({ x: this.lastRefuge.x, z: this.lastRefuge.z });

    // The one that jumped you stands its ground. A pack that wandered off its own ambush
    // while the circle drew would leave the ring centred on nothing.
    const host = this.packs.find((p) => p.encounterId === encounterId);
    host?.holdStill(CombatRing.DURATION + 1);

    const ring = new CombatRing(
      this.player.position.x,
      this.player.position.z,
      this.packs.filter((p) => p !== host),
      (pulled) => {
        this.hud?.showBattle();
        this.battleTimer = 0.9;
        this.pendingFight = { encounterId, pulled };
      },
    );
    this.ring = ring;
    this.world?.scene.add(ring.mesh);
    this.updatables.push(ring);
  }

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
      onPackVision: () => {
        for (const pack of this.packs) pack.rebuildCone();
      },
      onColliders: (show) => this.world?.setCollidersVisible(show),
    };
  }

  /** Whether the guided lap is still running — read by the board when it opens. */
  get guiding(): boolean {
    return tutorialActive(this.flags);
  }
}
