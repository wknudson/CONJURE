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
  loadFolkSheet,
  type HeroFacing,
} from '../render/sprites.js';

import { LOOK, buildLookGui } from './look.js';
import type { CoachMarks } from '../hud/Tutorial.js';
import { ColliderSet } from './collision.js';
import { DistrictWorld } from './world.js';
import { buildPostChain, type PostChain } from './post.js';
import { DistrictHud } from './hud.js';
import { DialogueBox, FOLK_LINES, VEX_INTRO, VEX_REPEAT } from './dialogue.js';
import {
  FACING,
  actorArtFromOne,
  actorArtFromTextures,
  buildActorArt,
  buildSheetActorArt,
  actorArtFromProfile,
  BillboardSprite,
  disposeActorArt,
  pickFacing,
  setWindTime,
  Walker,
  type ActorArt,
} from './sprites3d.js';
import {
  CRITTER_ART,
  makeMinionTexture,
  makeWardenTexture,
  sheetFrameTexture,
} from './textures.js';
import { CRITTERS, type CritterId } from './wildlife.js';
import {
  FOLK_SHEETS,
  folkBox,
  folkHeight,
  folkSheetOf,
  type FolkId,
  type FolkSheetId,
} from '../render/folk.js';
import {
  CombatRing,
  CompanionFollower,
  Critter,
  DoorHotspot,
  Hotspot,
  NPC,
  Pack,
  Warden,
  type Interactable,
  type Updatable,
} from './entities.js';
import { isSafeAt, type AreaDef, type DoorKey, type ExitSpec } from './map.js';
import {
  cullSatisfiedBy,
  errandFor,
  errandMarker,
  NO_ERRANDS,
  type ErrandState,
} from './errands.js';
import { DRESSING_ART, makeCairnTexture } from './textures.js';
import { asideFor, gateOpen, type Chronicle } from './chronicle.js';
import { sitesInArea, type ContractSite } from './sites.js';
import { isLair } from '../core/data/lairs.js';
import { groundedEncounter, skyStrengthAt } from './skies.js';
import {
  lamplighterPost,
  lampsLitAt,
  packOutAt,
  packSightAt,
  packVigourAt,
  wardenGraceAt,
  wardenSightAt,
} from './daylight.js';
import { stallFor } from '../core/data/stalls.js';
import type { DialogueLine } from './dialogue.js';
import { WorldCombat } from './combat/WorldCombat.js';
import { Descent, frameBoard } from './combat/Descent.js';
import type { CombatResult } from '../contract/events.js';
import type { CombatOutcome } from '../core/overworld/run.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import type { CombatCarry } from '../core/engine/setup.js';
import type { AiProfile } from '../core/ai/controller.js';
import { huntAvailable } from '../core/data/hunts.js';
import { hashText, makeRng, nextInt } from '../core/util/rng.js';
import { flagForDoor, tutorialActive } from './quest.js';

/**
 * How fast the street clock runs: two game-hours a real minute.
 *
 * A whole day in about twelve minutes of walking. Fast enough that a player who wants the light
 * can wait for it, slow enough that an hour of the world is not gone before they have crossed
 * the ward.
 */
const HOURS_PER_SECOND = 2 / 60;

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

/**
 * The fight a Warden serves on you.
 *
 * A `PackDef` in `core/data/packs.ts`, so it is a registered encounter with balance coverage
 * and a costed warband, rather than a hand-cut arena nothing checks. It is the one pack in the
 * game that is never placed on a map — there is nothing to walk into, only somebody who has
 * decided to stop asking.
 */
const WARDEN_ENCOUNTER = 'warden_writ';

/**
 * Everything a fight needs that only the profile can answer.
 *
 * The district knows a pack was walked into and where it happened. It does not know which
 * deck this Companion fights with, what the spoils are worth, whether a contract is already
 * open, or how a result is settled — and it must not learn, because that is the overworld's
 * ledger and this is a renderer. So the screen asks upward for a fight and is handed the
 * pieces the engine needs, with `onFinish` closing the loop back into the save.
 *
 * That boundary is the reason combat can happen *in* the district without the district
 * gaining a single line about economy or persistence.
 */
export interface WorldFight {
  encounter: EncounterDef;
  seed: number;
  deck: string[];
  ai?: AiProfile;
  carry?: CombatCarry;
  roster?: string[];
  /** Squads the Combat Ring dragged in, one array of card ids per pulled mob. */
  wave2?: string[][];
  /** The first-fight coach marks: whether this character has had them, and whom to tell. */
  coach?: CoachMarks;
  onFinish: (result: CombatResult, encounter: EncounterDef, outcome: CombatOutcome) => void;
}

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
  /**
   * Every regional apex lair as a Bounty, composed the same way `huntBoard` is. The
   * site hotspots are the only consumer: a lair has no poster and no signpost — the
   * ground itself is the surfacing.
   */
  lairBoard: Bounty[];
  hunts: Readonly<Record<string, number>>;
  collection: Collection;
  deck: string[];
  notice?: { title: string; body: string; ack?: string };
  tutorial: readonly TutorialFlag[];
  onTutorialFlag: (flag: TutorialFlag) => void;
  /**
   * Story contracts walked, so the street can react to them.
   *
   * Handed in the same way `tutorial`, `hunts` and `errands` are: a snapshot per entry, which is
   * every crossing and every shop door. That granularity is exactly right here -- a contract
   * resolves on a screen change, so the ward you walk back into is always the one that knows.
   */
  campaign: readonly string[];
  /** What time it is, in hours. See `daylight.ts`. */
  hour: number;
  /**
   * The hour, handed back on the way out.
   *
   * The street clock runs while the player is standing in it, so the hour they leave with is not
   * the one they arrived with and the profile has to be told. Optional so a test can mount a
   * screen without a save behind it.
   */
  onHour?: (hour: number) => void;
  /**
   * What has been run and what is open, handed in exactly as `hunts` and `tutorial` are.
   *
   * A snapshot rather than a live object: the district reads it to decide what a townsperson has
   * to say and where to stand a marker, and writes through the three callbacks below. It is
   * re-read on every screen entry, which is every crossing and every shop door -- so a change
   * made here is in front of the player by the time they have walked out of the conversation.
   */
  errands: ErrandState;
  /** Taken. The ledger opens the slot and the screen puts the marker down. */
  onErrandAccept: (id: string) => void;
  /**
   * The step is satisfied and it is time to report back.
   *
   * Separate from `onErrandComplete` because they happen in different places and often minutes
   * apart: you kill the pack out on the Verge and you are paid in Ashfall.
   */
  onErrandReady: (id: string) => void;
  /**
   * Handed back, unpaid and unrecorded.
   *
   * Free on purpose. This is the release valve on the one-errand-at-a-time rule rather than a
   * penalty for changing your mind, and charging for it would turn that rule into a trap with a
   * fee attached.
   */
  onErrandAbandon: () => void;
  /**
   * Reported, and paid for. Returns a line to show the player, or null.
   *
   * A return value rather than `void` for one case that is small and real: an errand can pay a
   * brew and the satchel holds three. Paid into a full satchel the brew would simply evaporate
   * between the thanks and the purse, and the only place that knows it happened is the payout —
   * which is in `core` and has no HUD. So it says so, and the street shows it.
   */
  onErrandComplete: (id: string) => string | null;
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
  onPack: (encounterId: string, pulled: string[]) => WorldFight | null;
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
  /**
   * Everyone standing in this ward, the Dispatcher included.
   *
   * A list rather than the single `vex` field it replaces. That field was written when Ashfall
   * was the only populated area and Vex the only person in it; the screen consequently built
   * `props.npcs[0]` and dropped the rest on the floor, so an area file could declare a market
   * full of traders and get one. Everything the old field did — the look-at wiring below,
   * teardown — is done for the list.
   */
  private readonly npcs: NPC[] = [];

  /**
   * The wager duelists whose ground is live on this street.
   *
   * Recorded by `buildInteractables` and stood up by `loadActors`, because the split is
   * real: liveness is known at build time, but a body needs its sheet decoded. While a
   * duel's contract is on the board, its duelist is the interactable -- the person, not a
   * bare patch of ground, is what offers the wager.
   */
  private readonly liveDuelists: { site: ContractSite; offer: () => void }[] = [];

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
   * The animals.
   *
   * Held apart from `updatables` for the same two reasons the packs are: they need the player's
   * position pushed at them each frame, and they have to go off the street while a board is
   * standing on it. Everything else about them runs through `Updatable` like the rest.
   */
  private readonly critters: Critter[] = [];

  /**
   * What the player has been asked to do, as this screen believes it.
   *
   * Held rather than read from `opts` on every question, because the screen mutates it the
   * instant a conversation ends and the save write goes out through a callback -- so a read
   * straight from `opts` would answer with what was true when the street was built and the
   * townsperson you just spoke to would offer you the same job again.
   */
  private errands: ErrandState = NO_ERRANDS;

  /**
   * The hour, ticking.
   *
   * Held here rather than read from `opts` because it **moves while you stand in the street** —
   * and it has to. `daylight.ts` argues that the whole value of a cycle is being *in* the change,
   * and a first cut of this advanced the clock only on a crossing or a fight, which meant the
   * only way to see dawn was to miss it by walking through a door. Now the light comes up while
   * you are looking at it, the lamps go out while you are standing under them, and the Warden's
   * cone shortens in front of you at dusk.
   *
   * Written back to the profile on the way out rather than every frame: `persist` is a
   * `localStorage` write and this changes sixty times a second.
   */
  private hour = 0;
  /**
   * The hour the world is currently dressed for. See the gate in `tickClock`: the clock moves
   * every frame and the scene is re-lit about twice a second, so the two are deliberately
   * different numbers and the threshold is measured between them.
   */
  private litAtHour = 0;

  /** What the street knows, for the graffiti and for what people say. */
  private get chronicle(): Chronicle {
    return { campaign: this.opts.campaign };
  }

  /** Whoever walks this ward's lamps, if anybody does. See `walkTheRow`. */
  private lamplighter: NPC | null = null;

  /** The open errand's mark on this street, if it points here. See `placeErrandMarker`. */
  private marker: { hotspot: Hotspot; sprite: BillboardSprite | null } | null = null;
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
  /**
   * The fight currently standing on this street, if any.
   *
   * There is no screen swap any more: the board is laid on the district's own ground, the
   * district keeps drawing, and this is the thing that owns the engine while it is up.
   */
  private combat: WorldCombat | null = null;
  /** The camera's journey from the walk framing into the tactical one. */
  private descent: Descent | null = null;
  /** Where the camera holds once the descent has landed. */
  /**
   * A quarter-turn the player asked for with a button rather than by holding a key.
   *
   * Null while nothing is easing. `updatePlayer` walks the yaw toward it and clears it, and
   * touching Q or E cancels it — a held key and a queued turn fighting over the same number
   * is how a camera ends up drifting after the player has let go.
   */
  private yawGoal: number | null = null;

  private combatCam: {
    target: THREE.Vector3;
    yaw: number;
    pitch: number;
    fov: number;
    distance: number;
  } | null = null;
  /** Local mirror of the profile's ledger, so the panel updates the instant a flag fires. */
  private flags: TutorialFlag[];

  private onKeyDown = (_e: KeyboardEvent): void => {};
  private onKeyUp = (_e: KeyboardEvent): void => {};
  private onResize = (): void => {};

  constructor(opts: DistrictOpts) {
    this.opts = opts;
    this.area = opts.area;
    this.flags = [...opts.tutorial];
    // Here rather than in `mount`, because `unmount` hands the hour back and a screen that was
    // torn down before it finished building would otherwise report midnight -- setting every
    // such character's clock to zero on the way past.
    this.hour = opts.hour;
    // The constructor lights the world at this hour, so this is what it is dressed for.
    this.litAtHour = opts.hour;
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
    const world = new DistrictWorld(this.area, colliders, maxAnisotropy, this.chronicle, this.opts.hour);
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
      onErrandAbandon: () => this.abandonErrand(),
      // `this.hour`, not `this.opts.hour`. The latter is the hour the screen was *mounted* at,
      // and handing the HUD that froze the one readout the player can actually see: the world
      // moved -- lamps, sight, the Warden's beat, the sky -- while the ledger insisted it was
      // still whatever o'clock they walked in on. Every test passed, because `clockLabel` and
      // `phaseAt` are pure and were being asked the wrong question. Found by looking at it.
      hour: () => this.hour,
    });
    this.dialogue = new DialogueBox(root);

    this.buildInteractables();
    this.installInput();

    if (import.meta.env.DEV) {
      // Dev handle, matching the one `CombatScreen` has carried since the board was built:
      // it lets a headless session force a frame and inspect state.
      //
      // Earned rather than convenient. Every lighting decision in this district was settled by
      // sampling the framebuffer with `gl.readPixels` after forcing a frame, and by reading the
      // baked ground canvas back out of the scene — which caught, among other things, three
      // areas whose authored intent of "enclosed and dim" had quietly produced near-black, and
      // a combat grid measured adding 212 of 255 luma to the road under it. None of that is
      // reachable from a test, because none of it exists until something has drawn.
      //
      // Everything mutable is a function rather than a captured value, and not only because a
      // fight comes and goes: this runs before `loadActors` has resolved, so at the moment it is
      // installed there is no player, no follower and no pack yet. A snapshot here would be a
      // handle onto an empty street. That ordering is deliberate — `loadActors` awaits every
      // sprite in the ward, and a hidden tab stalls image decoding, so a handle installed at
      // the end of it does not exist in exactly the headless session it is for.
      //
      // Stripped from production by the `DEV` guard.
      (window as unknown as Record<string, unknown>).__district = {
        frame: () => this.loop(),
        renderer: this.renderer,
        post: this.post,
        world: this.world,
        camera: this.camera,
        area: this.area,
        player: () => this.player,
        follower: () => this.follower,
        packs: () => this.packs,
        warden: () => this.warden,
        combat: () => this.combat,
        cameraYaw: () => this.cameraYaw,
        setCameraYaw: (v: number) => void (this.cameraYaw = v),
        /** Walks into a pack by identity, so a fight can be opened without a collision. */
        ambush: (encounterId: string) => this.ambush(encounterId),
      };

      // The look-tuning panel is a development tool and lives inside the guard with the
      // rest of them. It sat two lines outside it for a while, and shipped: every player
      // who entered the ward got a floating panel of exposure, fog and bloom sliders, and
      // the legend told them to try it. `import.meta.env.DEV` is statically false in a
      // production build, so the panel and the lil-gui module behind it are dropped from
      // the bundle rather than merely hidden.
      this.gui = buildLookGui(this.lookHandles(), this.area.id, this.area.name);
    }

    this.errands = this.opts.errands;
    this.hud.renderObjective(this.flags, this.errands);
    // Here rather than at the end of `loadActors`, which is where it started: that method awaits
    // every sprite in the ward, and the marker needs none of them -- it is a cairn cut in code
    // and a hotspot. Down there, a slow or failed fetch takes the errand's mark with it.
    this.placeErrandMarker();

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
    // The hour goes home. Written here rather than in `tickClock` because `persist` is a
    // `localStorage` write and that runs sixty times a second; every path out of a district --
    // a crossing, a door, a fight, closing the tab on a screen change -- comes through here.
    this.opts.onHour?.(this.hour);
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
    // Before the world is disposed: the board hangs groups on that scene and the HUD it owns
    // is parented to a root this method is about to let go of.
    this.endFight();

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
        this.hud!.openBoard(this.opts.bounties, this.flags, this.area),
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

    // Contract sites: the board briefs, the ground launches. A story site is live iff
    // its contract's bounty is on the composed board this screen already holds — which
    // is `nextStoryContract` read back, so liveness needs no state of its own. A lair
    // is live when its gate opens and its cooldown has lapsed, and launches through
    // the same `onBounty` road so spoils, wagers, the tutorial ledger and the
    // open-contract failsafe all come along unchanged.
    for (const site of sitesInArea(this.area.id)) {
      const bounty =
        this.opts.bounties.find((b) => b.id === `story_${site.encounterId}`) ??
        this.opts.lairBoard.find((b) => b.enemySeed === site.encounterId);
      if (!bounty) continue;
      if (!gateOpen(site.gate, this.chronicle)) continue;
      // The guided lap steers to Novice work, the same policy the board itself keeps.
      if (tutorialActive(this.flags) && bounty.difficulty !== 'novice') continue;
      if (isLair(site.encounterId) && !huntAvailable(this.opts.hunts[site.encounterId], Date.now()))
        continue;
      // A duel is a person, and the person is the prompt. The body needs its sheet, so
      // the hotspot's work is deferred to `loadActors` -- which also falls back to bare
      // ground if the sheet does not, so a failed decode costs the figure and not the fight.
      if (site.duelist) {
        this.liveDuelists.push({ site, offer: () => this.opts.onBounty(bounty) });
        continue;
      }
      const spot = new Hotspot(site.at.x, site.at.z, site.label, () =>
        this.opts.onBounty(bounty),
      );
      if (site.interactDetail) spot.interactDetail = site.interactDetail;
      this.interactables.push(spot);
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

    // The people of the ward.
    //
    // The townsfolk sheets are fetched here rather than in the batch above, and only the ones
    // this area actually names — the same rule the walk art and the companion are already
    // fetched under, for the same reason. Three of the four sheets are about four megabytes,
    // so pulling the set into every street would cost twelve to draw nobody extra; and folded
    // into the `Promise.all`, one missing file would open the ward with no Commander, no Vex
    // and no unlock. A sheet that fails to load costs exactly the people on it.
    const specs = this.area.props.npcs ?? [];
    const sheets = new Map<FolkSheetId, HTMLImageElement | null>();
    for (const id of new Set(specs.map((n) => n.art).filter((a): a is FolkId => !!a))) {
      const sheet = folkSheetOf(id);
      if (!sheets.has(sheet)) sheets.set(sheet, await loadFolkSheet(sheet).catch(() => null));
    }
    if (this.disposed || !this.world) return;

    // One cut per distinct person on this street, not one per body — a market with two
    // stalls of the same trade uploads one texture and hangs both bodies off it.
    const folkArt = new Map<FolkId, ActorArt>();
    for (const spec of specs) {
      if (!spec.art || folkArt.has(spec.art)) continue;
      const sheet = sheets.get(folkSheetOf(spec.art));
      if (!sheet) continue;
      const box = folkBox(spec.art);
      const art = actorArtFromOne(
        sheetFrameTexture(
          sheet,
          box.x,
          box.y,
          box.w,
          box.h,
          anis,
          FOLK_SHEETS[folkSheetOf(spec.art)].pixelArt,
        ),
      );
      folkArt.set(spec.art, art);
      this.heroArt.push(art);
    }

    specs.forEach((spec, i) => {
      // No `art` means the Dispatcher, who is drawn from the hero bearings rather than off a
      // sheet and whose script is the tutorial. Ashfall's entry predates all of this and is
      // still written `{id: 'vex', x, z}`.
      const art = spec.art ? folkArt.get(spec.art) : vexArt;
      if (!art) return; // Their sheet did not load. One absent person, not an absent ward.

      const script = FOLK_LINES[spec.says ?? spec.id];
      const npc = new NPC(
        art,
        spec.art ? folkHeight(spec.art) : COMMANDER_HEIGHT,
        spec.x,
        spec.z,
        spec.label ?? 'Talk to Dispatcher Vex',
        // An errand takes precedence over the person's own script, and falls back to it when
        // there is nothing to say -- so a townsperson with no errand today is exactly the
        // townsperson they were before this existed. Vex keeps the tutorial, which is hers.
        spec.art
          ? () => this.talkTo(spec.id, spec.says ?? spec.id, script ?? [])
          : () => this.talkToVex(),
        // Offset per body, so four people on one street do not breathe in lockstep — which
        // reads as a row of copies rather than as a crowd.
        1.3 + i * 0.7,
        // The pixel sheets are drawn with their own ground shadow. A billboard casting a
        // second one puts two under the same boots, pointing different ways.
        !(spec.art && FOLK_SHEETS[folkSheetOf(spec.art)].pixelArt),
      );
      this.world!.scene.add(npc.walker.sprite);
      this.world!.billboards.push(npc.walker.sprite);
      this.updatables.push(npc);
      this.interactables.push(npc);
      this.npcs.push(npc);
      if (spec.id === this.area.props.lamplighter) this.lamplighter = npc;
    });

    // The wager duelists whose contracts are live, standing on their own ground. Their sheet
    // is fetched apart from the townsfolk's and only on a street where a duel is actually up,
    // under the same rule the cast sheets follow: art costs exactly the people drawn from it.
    if (this.liveDuelists.length > 0) {
      const duelSheet = await loadFolkSheet('duelists').catch(() => null);
      if (this.disposed || !this.world) return;
      for (const { site, offer } of this.liveDuelists) {
        if (!duelSheet) {
          // The ground still offers the wager; a failed decode costs the figure, not the fight.
          const spot = new Hotspot(site.at.x, site.at.z, site.label, offer);
          if (site.interactDetail) spot.interactDetail = site.interactDetail;
          this.interactables.push(spot);
          continue;
        }
        const id = site.duelist!;
        const box = folkBox(id);
        const art = actorArtFromOne(
          sheetFrameTexture(duelSheet, box.x, box.y, box.w, box.h, anis, true),
        );
        this.heroArt.push(art);
        const duelist = new NPC(
          art,
          folkHeight(id),
          site.at.x,
          site.at.z,
          site.label,
          offer,
          // Off the townsfolk's breathing cadence, the way each of them is off each other's.
          1.1,
          // The duelists sheet is pixel art with its own painted ground shadow, like the
          // trades sheets -- a billboard shadow under it would be the second of two.
          false,
        );
        if (site.interactDetail) duelist.interactDetail = site.interactDetail;
        this.world.scene.add(duelist.walker.sprite);
        this.world.billboards.push(duelist.walker.sprite);
        this.updatables.push(duelist);
        this.interactables.push(duelist);
        this.npcs.push(duelist);
      }
    }

    // Once, now that he exists. `tickClock` only calls this when the hour has moved a
    // game-minute, so without this the row would open on the uniform curve and stay there for the
    // first half-second -- and he would have nowhere to be.
    this.walkTheRow();

    const beat = this.area.props.patrols?.[0];
    if (beat && wardenArt) {
      this.warden = new Warden(wardenArt, 2.5, beat, colliders);
      this.world.scene.add(this.warden.walker.sprite);
      this.world.scene.add(this.warden.cone);
      this.world.billboards.push(this.warden.walker.sprite);
      this.updatables.push(this.warden);
      this.warden.onCatch = () => this.arrest();
      this.warden.setSight(wardenSightAt(this.hour));
      this.warden.grace = wardenGraceAt(this.hour);
      this.warden.onAlertChange = (on) => this.hud?.setAlert(on);
    }

    // The roaming packs.
    //
    // Skipped where the fight is on cooldown, which reuses the hunt clock already in the
    // save rather than inventing a second one -- and means a road you have just cleared
    // reads as cleared. That is also the third of the four things standing between the
    // player and an immediate re-trigger on the way back from a fight.
    const packSpecs = this.area.props.packs ?? [];
    if (packSpecs.length > 0) {
      const now = Date.now();
      for (const spec of packSpecs) {
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
        pack.setSight(packSightAt(this.hour));
        // Spawned whatever the hour, and put on or off shift by the clock -- see
        // `Pack.setOnShift`. Skipping the build for an off-hours crew was the first version and
        // the live street clock broke it: an hour that opens while the player is standing there
        // would have arrived with nothing on the road to arrive.
        pack.hours = spec.hours;
        pack.setOnShift(packOutAt(spec.hours, this.hour));
        pack.vigour = packVigourAt(spec.hours, this.hour);
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

    /* --- the wildlife ---
       After the packs and on purpose: the collider set is complete by here, so a hare's wander
       is rejected against the same walls the player is stopped by rather than against a partial
       world. One texture and one `ActorArt` per *kind* standing in this area, not per animal —
       the rule the furniture and the townsfolk both follow, and the reason a flight of six
       rooks uploads one rook. */
    const fauna = this.area.props.wildlife ?? [];
    if (fauna.length > 0) {
      const critterArt = new Map<CritterId, ActorArt>();
      const faunaRng = makeRng(hashText(`${this.area.id}:wildlife`) >>> 0);
      const roll = (): number => nextInt(faunaRng, 10_000) / 10_000;

      for (const spec of fauna) {
        let art = critterArt.get(spec.kind);
        if (!art) {
          // `actorArtFromProfile` rather than `actorArtFromOne`: an animal is drawn side-on and
          // a mirrored fox is the same fox facing the other way, where a mirrored townsperson
          // has swapped the tools in their hands. See that function for the whole of it.
          art = actorArtFromProfile(CRITTER_ART[spec.kind]());
          critterArt.set(spec.kind, art);
          this.heroArt.push(art);
        }
        // `count` spawns a group from one authored line, jittered around the given home so
        // they are a flock rather than a stack. Each keeps its own home, so they drift apart
        // over a minute the way a real group does instead of moving as one body.
        const n = Math.max(1, spec.count ?? 1);
        const flies = CRITTERS[spec.kind].flies;
        for (let i = 0; i < n; i++) {
          const spread = n === 1 ? 0 : Math.min(spec.roam * 0.6, 4);
          // The authored spot is checked by the per-area test; the *jittered* ones are not, and
          // a body born inside a wall cannot get out of it -- `colliders.move` tests the
          // destination, so something already inside one is stuck there in full view. Tried a
          // few times and then given the authored home, which is known good.
          let hx = spec.x;
          let hz = spec.z;
          for (let t = 0; t < 6 && spread > 0; t++) {
            const cx = spec.x + (roll() - 0.5) * 2 * spread;
            const cz = spec.z + (roll() - 0.5) * 2 * spread;
            if (flies || !colliders.blocked(cx, cz, 0.3)) {
              hx = cx;
              hz = cz;
              break;
            }
          }
          const critter = new Critter(spec.kind, art, hx, hz, spec.roam, colliders, roll);
          this.world.scene.add(critter.walker.sprite);
          this.world.billboards.push(critter.walker.sprite);
          this.critters.push(critter);
          this.updatables.push(critter);
        }
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
    this.refreshObjective();
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
    // The hour goes home *before* the crossing, not only in `unmount`. The next district's
    // options are built while this screen is still standing, so an hour handed back only on
    // the way out arrives after the new ward has already read the save -- and the save still
    // held the hour this screen was *mounted* at. Every crossing put the clock back to
    // whenever you last arrived somewhere: walk a ward to dusk, take a road, and it was
    // morning again. Found by leaving Lamprow after ten at night and reaching Ashfall at
    // three -- the class of bug no unit test sees, because every function involved is pure
    // and correct and the wrong value is handed between them.
    this.opts.onHour?.(this.hour);
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

      // A fight gets first refusal on every key. One listener rather than two competing ones:
      // the district is still watching for the map and for Escape, and two independent
      // handlers racing for the same key is how one of them ends up unreachable.
      if (this.combat) {
        // The map stays available -- it takes no action and looking at where you are is never
        // the wrong thing to allow -- but everything else belongs to the board.
        if (e.code !== 'KeyM' && this.combat.handleKey(e.code)) {
          e.preventDefault();
          return;
        }
        if (e.code !== 'KeyM' && e.code !== 'KeyQ' && e.code !== 'KeyE') return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.dialogue?.open) this.dialogue.advance();
        else if (this.hud?.boardIsOpen) this.hud.closeBoard();
        else if (!this.inputLocked && !this.hud?.menuIsOpen && this.nearest) this.nearest.onInteract();
        return;
      }
      if (e.code === 'KeyI') {
        e.preventDefault();
        this.hud?.toggleSatchel();
        return;
      }
      if (e.code === 'KeyM') {
        // Deliberately not gated on `inputLocked`: the map is the one thing worth being
        // able to look at while something else has the screen, and it takes no action.
        e.preventDefault();
        this.hud?.toggleMap();
        return;
      }
      if (e.code === 'Escape') {
        if (this.hud?.boardIsOpen) this.hud.closeBoard();
        else if (this.hud?.mapIsOpen) this.hud.closeMap();
        else if (this.hud?.menuIsOpen) this.hud.closeMenu();
        // With nothing else to close, Escape is the menu — and the only way back to the
        // title wall. Not over a dialogue line or a bill, which the player should finish.
        else if (this.hud && !this.dialogue?.open && !this.hud.overlayIsShown) {
          this.hud.showMenu(() => this.opts.onLeave());
        }
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
      this.combat?.resize();
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
      // Per frame rather than on the clock tick: the post is a function of the hour, and the
      // hour moves continuously. Assigning a number is cheaper than deciding whether to.
      this.warden.hour = this.hour;
    }
    for (const npc of this.npcs) npc.playerAt = anchor;
    // Copied rather than aliased, unlike the NPCs above: a critter reads this every frame to
    // decide whether to bolt, and `anchor` is the player's live position vector -- handing it
    // over by reference would be fine today and a very confusing bug the day somebody moves
    // the player inside the same frame.
    for (const critter of this.critters) critter.playerAt.copy(anchor);
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
        this.packArming > 0 || this.inputLocked || this.hud?.boardIsOpen || this.hud?.menuIsOpen
          ? null
          : () => this.ambush(pack.encounterId);
    }

    // Nothing on the street moves while a fight is up. A pack wandering past the arena --
    // or the Warden walking through it -- would be the loudest possible reminder that the
    // board is pasted onto a world still going about its business.
    if (!this.combat) {
      for (const u of this.updatables) u.update(dt, this.elapsed, this.cameraYaw);
    } else {
      this.ring?.update(dt);
    }

    // The clock, and everything that reads it. See `hour` above for why this ticks on the
    // street rather than only on a crossing.
    this.tickClock(dt);
    world.updateLamps(this.elapsed);
    world.updateImpactLights(dt);
    world.scrollWater(dt);
    world.updateRises(dt, Math.random);
    // The air follows whoever the camera is watching -- which during a fight is the board and
    // not the player, so it is `anchor` and not `player.position`. See `weather.ts`.
    world.updateSky(dt, anchor);
    // One clock for every swaying thing in the world. Written here rather than inside the
    // sprites so a field of reeds is provably in the same wind as the tree beside it.
    setWindTime(this.elapsed);
    world.trackSun(anchor.x, anchor.y, anchor.z);
    world.updateOccluders(dt, camera, anchor);
    for (const b of world.billboards) b.faceCamera(camera);
    // The board's own bodies, which come and go as the fight does — so they are asked for
    // each frame rather than pushed onto `world.billboards`, which nothing removes from.
    if (this.combat) {
      for (const sprite of this.combat.billboards) {
        (sprite as unknown as { faceCamera(c: THREE.Camera): void }).faceCamera(camera);
      }
    }

    this.updateInteraction();
    this.dialogue?.update(dt);

    // Drawn from the live scene rather than from a snapshot, so the dot moves while you
    // walk and the packs move while they roam — which is the whole use of having it open.
    if (this.hud?.mapIsOpen) {
      this.hud.drawMap(this.area, {
        player: { x: anchor.x, z: anchor.z },
        yaw: this.cameraYaw,
        // Only the crews actually on the road. A map that showed an off-shift pack would be
        // telling the player about a threat that is not there, which is worse than telling them
        // nothing -- the map is the one place in this game that is meant to be reliable.
        packs: this.packs
          .filter((p) => p.onShift)
          .map((p) => ({
            encounterId: p.encounterId,
            x: p.position.x,
            z: p.position.z,
            hunting: p.state !== 'ROAM',
          })),
        ...(this.marker ? { errand: { x: this.marker.hotspot.position.x, z: this.marker.hotspot.position.z } } : {}),
        // Only the ground a writ on *this* board names, so the map never marks a fight the
        // player has not been offered.
        sites: sitesInArea(this.area.id)
          .filter((site) => this.opts.bounties.some((b) => b.id === `story_${site.encounterId}`))
          .map((site) => ({ x: site.at.x, z: site.at.z, label: site.label })),
        ...(this.warden
          ? {
              warden: {
                x: this.warden.position.x,
                z: this.warden.position.z,
                alerted: this.warden.state === 'CHASE' || this.warden.state === 'ALERT',
              },
            }
          : {}),
      });
    }

    if (this.seizedTimer > 0) {
      this.seizedTimer -= dt;
      if (this.seizedTimer <= 0) {
        this.hud?.hideOverlay();
        this.inputLocked = false;
      }
    }

    // The fight, if one is standing on this street. There is no hand-off and no flash: the
    // board is on the ground the ring closed on, and the same scene carries straight through.
    if (this.combat) {
      // Whose yaw the fight is being watched from this frame: the descent's while it is
      // squaring up on the board, and the player's for every frame after that.
      let yaw = this.cameraYaw;
      if (this.descent) {
        const cam = this.descent.update(dt);
        yaw = cam.yaw;
        this.combatCam = {
          target: cam.target,
          yaw: cam.yaw,
          pitch: cam.pitch,
          fov: cam.fov,
          distance: cam.distance,
        };
        world.setFogScale(cam.fogScale);
        this.combat.reveal = this.descent.reveal;
        if (this.descent.finished) {
          // The camera is the player's again, continuing from where the descent left it rather
          // than from whatever the walk yaw happened to be -- otherwise letting go of the
          // board snaps the view back through most of a turn.
          this.cameraYaw = cam.yaw;
          this.descent = null;
        }
      }
      this.combat.update(dt, yaw);

      // The Commander and their beast look at the fight.
      //
      // Standing still, a `Walker` holds whichever frame it last walked on -- so the body that
      // ran into an ambush spends the whole battle facing whatever direction it happened to be
      // running, which is most often straight out of the arena. Set every frame and
      // camera-relative, because which of the four painted views reads as "facing up the
      // board" changes as the camera orbits round it.
      const upTheBoard = pickFacing(0, -1, yaw);
      this.player?.face(upTheBoard);
      this.follower?.walker.face(upTheBoard);

      // The beast is on the board now, so it is not also at your shoulder. Toggled per frame
      // rather than once at the opening bell because the Bound Form is *summoned* -- there are
      // a few seconds at the start of a fight where the Companion legitimately has no body yet,
      // and standing beside you is the right place to be for those.
      if (this.follower) {
        this.follower.walker.sprite.visible = !this.combat.companionEmbodied;
      }
    }

    this.post!.composer.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  /**
   * Moves the hour, and the world with it.
   *
   * Two game-hours a real minute, so a whole day is about twelve minutes of walking and the
   * three-hour dawn ramp takes ninety seconds — long enough to be a change you are *inside*
   * rather than a transition you watch, short enough that standing still to see it is a
   * reasonable thing to do.
   *
   * The scene is only re-lit when the hour has moved by a game-minute, which is roughly twice a
   * second: `setHour` re-derives seven values and parses four hex colours, and doing that per
   * frame to move the light by a hundredth of nothing is work for its own sake.
   *
   * Frozen during a fight. A board standing on the street is a scene with its own framing and its
   * own fog scale, and having the sun come up through it would be the world carrying on around
   * something that has everybody's attention.
   */
  private tickClock(dt: number): void {
    if (this.combat) return;
    // Not wrapped. The field is really the clock -- hours since this character started -- and
    // the day is read off it by the sky. Everything that wants the *hour* takes it modulo a day
    // itself, which is why nothing else here had to change.
    this.hour += dt * HOURS_PER_SECOND;

    // Against the hour the world was last *lit* at, not against the hour one frame ago.
    //
    // This was `const before = this.hour` captured at the top of the call, which made the
    // comparison `this.hour - before` -- exactly one frame's worth of clock, every time. One
    // frame at the clamped maximum `dt` of 0.05s moves the clock 0.00167 hours and the gate
    // wants 0.0167, so **it could never pass at any framerate**, and everything below it never
    // ran while the player stood in a ward: no re-light, no lamplighter, no pack coming on
    // shift, no sky re-rolled, and no ledger. The clock advanced and nothing read it. Re-entering
    // the district was the only thing that ever applied an hour, because the constructor does it.
    //
    // A threshold has to be measured against the last time the work was *done*. That is the whole
    // bug, and it is invisible to a unit test: every function below here is pure, tested, and was
    // simply never called. It took watching a lamp fail to come on.
    if (Math.abs(this.hour - this.litAtHour) < 1 / 60) return;
    this.litAtHour = this.hour;

    this.world?.setHour(this.hour);
    // The ledger, on the same gate. `renderLedger` was only called at mount and on a purse
    // change, so even once it was reading the live hour the readout sat at whatever it said
    // when the screen came up -- the second half of the same bug, and the reason the clock was
    // invisible twice over. This gate already fires about twice a second and is what re-lights
    // the world, so the text and the light now move together, which is the point.
    this.hud?.renderLedger();
    this.walkTheRow();
    this.warden?.setSight(wardenSightAt(this.hour));
    if (this.warden) this.warden.grace = wardenGraceAt(this.hour);
    for (const pack of this.packs) {
      pack.setSight(packSightAt(this.hour));
      // Coming on and going off while the player watches, which is the whole of what a shift is.
      // The windows overlap at dawn and dusk, so a crew arrives as the light goes.
      pack.setOnShift(packOutAt(pack.hours, this.hour));
      pack.vigour = packVigourAt(pack.hours, this.hour);
    }
  }

  /**
   * The lamplighter, on his rounds.
   *
   * How many lamps are lit is a function of the hour, and he stands at the boundary — the next
   * one he has to deal with. So the row lights from one end behind him through dusk and goes out
   * ahead of him through dawn, and he walks up the street and back down it over a day without
   * either direction being written anywhere.
   *
   * Called on the clock tick rather than per frame: the count changes about once a game-minute,
   * and the walking between posts is `NPC.goTo`'s business.
   */
  private walkTheRow(): void {
    const world = this.world;
    const man = this.lamplighter;
    if (!world || !man || world.lampCount === 0) return;

    const lit = lampsLitAt(this.hour, world.lampCount);
    for (let i = 0; i < world.lampCount; i++) world.setLampLit(i, i < lit ? 1 : 0);

    // Sent to the lamp rather than teleported to it: he arrives when he arrives, and the lamp is
    // already lit by the time he gets there because the clock said so. That is the one honest
    // compromise here -- the alternative is the light waiting on a walk, and a man who fell
    // behind his own schedule would leave a ward dark at midnight.
    man.goTo = world.lampPosition(lamplighterPost(lit, world.lampCount));
  }

  private updatePlayer(dt: number): void {
    // Orbit stays live even mid-conversation: it cannot change any state, and locking it
    // makes the world feel frozen rather than the player feel busy. It stays live during a
    // fight for the same reason and one more -- see `updateCamera`.
    const held = this.keys.has('KeyQ') || this.keys.has('KeyE');
    if (this.keys.has('KeyQ')) this.cameraYaw -= ORBIT_SPEED * dt;
    if (this.keys.has('KeyE')) this.cameraYaw += ORBIT_SPEED * dt;
    if (held) this.yawGoal = null;
    else if (this.yawGoal !== null) {
      const remaining = this.yawGoal - this.cameraYaw;
      if (Math.abs(remaining) < 0.002) {
        this.cameraYaw = this.yawGoal;
        this.yawGoal = null;
      } else {
        this.cameraYaw += remaining * Math.min(1, dt * 7);
      }
    }

    const player = this.player;
    if (!player) return;

    const busy =
      this.inputLocked || this.dialogue?.open || this.hud?.boardIsOpen || this.hud?.menuIsOpen;
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
    // The zone rule is suspended while a fight is on. The Commander has been placed at the
    // edge of the board, which may well be off the pavement, and flipping the chip to EXPOSED
    // mid-turn would be the HUD reporting on a rule that is not currently running.
    if (this.combat) return;

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

  /**
   * Turn the view a quarter, eased.
   *
   * The keyboard's Q and E are a continuous hold and want no easing; a button press is a
   * discrete request and snapping to it would read as a cut. Accumulated onto any turn still
   * in flight rather than onto the current yaw, so pressing the arrow twice quickly is half a
   * turn and not a quarter interrupted.
   */
  private nudgeOrbit(steps: number): void {
    this.yawGoal = (this.yawGoal ?? this.cameraYaw) + (steps * Math.PI) / 2;
  }

  private updateCamera(): void {
    const camera = this.camera;
    if (!camera) return;

    // A fight overrides the framing entirely: the camera belongs to the board, not to the
    // player, and it is held rather than followed. `combatCam` is written by the descent and
    // then simply stops changing, which is what makes the tactical view feel like a stage.
    const cam = this.combatCam;
    if (cam) {
      const pitch = THREE.MathUtils.degToRad(cam.pitch);
      const horizontal = Math.cos(pitch) * cam.distance;
      const height = Math.sin(pitch) * cam.distance;
      // Everything about the framing is the board's except which side you are looking from.
      // The descent owns the yaw while it is running -- it is turning the camera to square up
      // on the grid, and taking input mid-turn would fight it -- and hands it back on arrival,
      // after which Q and E walk round the arena exactly as they walk round the street. That
      // is the one camera gesture this game has always had, and a fight is a bad moment to
      // take it away: half the board's read is which bodies are behind which, and a fixed
      // stage cannot answer that.
      const yaw = this.descent ? cam.yaw : this.cameraYaw;
      // The shake `Fx` asked for, spent on the camera rather than on the overlay canvas — so
      // the world and the marks drawn over it shake together. See `OverlayCanvas`'s note.
      const shake = this.combat?.shake ?? { x: 0, y: 0 };
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.position.set(
        cam.target.x + Math.sin(yaw) * horizontal + shake.x * 0.02,
        height + shake.y * 0.02,
        cam.target.z + Math.cos(yaw) * horizontal,
      );
      camera.lookAt(cam.target.x, 0.8, cam.target.z);
      return;
    }

    const anchor = this.player?.position ?? new THREE.Vector3(this.area.spawn.x, 0, this.area.spawn.z);
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
    const busy =
      this.inputLocked || this.dialogue?.open || this.hud?.boardIsOpen || this.hud?.menuIsOpen;
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

  /* ============================================================
     Errands
     ============================================================ */

  /**
   * A townsperson, who may or may not want something today.
   *
   * The whole of the routing is one call to `errandFor`, which is deliberate: which of four
   * things this person is doing -- offering, nudging, taking a delivery, taking a report -- is a
   * question about global state, and answering it in four places here is how two of them end up
   * disagreeing about whether an errand is finished.
   */
  private talkTo(npcId: string, says: string, own: readonly DialogueLine[]): void {
    // A stall opens *after* whatever was said, not instead of it -- so a trader who is also
    // owed a delivery, or who has an opinion about the Census, gets to say so and then serve
    // you. Talking and trading are the same interaction with a shopkeeper; splitting them
    // across two prompts would be an interface deciding which half of a person you meant.
    const stall = stallFor(this.area.id, npcId);
    const thenTrade = stall ? () => this.hud?.openStall(stall) : undefined;

    // The errand comes first. Somebody who is owed a delivery says so before they remark on the
    // Census -- what they want from you now outranks what they think about last month.
    const found = errandFor(this.area.id, npcId, this.errands);
    if (!found) {
      // Then whatever the ledger has made true, and only then their fixed script.
      const lines = asideFor(says, this.chronicle) ?? own;
      // `DialogueBox.start` returns without firing `onEnd` on an empty script, so a keeper with
      // nothing to say would have a stall that never opened.
      if (lines.length === 0) thenTrade?.();
      else this.dialogue?.start([...lines], thenTrade);
      return;
    }
    const { def, phase } = found;
    if (phase === 'nudge') {
      this.dialogue?.start([...def.nudge], thenTrade);
      return;
    }
    if (phase === 'offer') {
      // Not while the guided lap is running. The panel has one slot and the lap wins it, so an
      // errand taken now would be a job with *no* UI at all -- no task line, and no way to hand
      // it back, which with one errand slot is a corner the player cannot get out of. It is also
      // simply wrong to send a Commander who has not met the Artificer to Highcourt. The lap is
      // four steps; the townsperson keeps their own line until it is walked.
      if (tutorialActive(this.flags)) {
        const lines = asideFor(says, this.chronicle) ?? own;
        if (lines.length === 0) thenTrade?.();
        else this.dialogue?.start([...lines], thenTrade);
        return;
      }
      // Recorded when the conversation *ends* rather than when it starts, so backing out of a
      // dialogue is backing out of the job. `DialogueBox` already takes the callback.
      this.dialogue?.start([...def.offer], () => {
        this.errands = { ...this.errands, active: { id: def.id, ready: false } };
        this.opts.onErrandAccept(def.id);
        this.refreshObjective();
        this.placeErrandMarker();
        thenTrade?.();
      });
      return;
    }
    this.dialogue?.start([...def.thanks], () => {
      this.errands = { done: [...this.errands.done, def.id], active: null };
      const said = this.opts.onErrandComplete(def.id);
      if (said) this.hud?.flashNotice(said);
      this.refreshObjective();
      this.placeErrandMarker();
      thenTrade?.();
    });
  }

  /**
   * Stands the open errand's marker on this street, or takes it away again.
   *
   * Called on entry and whenever the errand's state moves. Idempotent: it clears whatever it put
   * down last time first, so accepting and finishing in one visit cannot leave a cairn standing
   * in a ward nobody was ever sent to.
   */
  private placeErrandMarker(): void {
    if (this.marker) {
      const i = this.interactables.indexOf(this.marker.hotspot);
      if (i >= 0) this.interactables.splice(i, 1);
      if (this.marker.sprite) {
        this.world?.scene.remove(this.marker.sprite);
        const b = this.world?.billboards.indexOf(this.marker.sprite) ?? -1;
        if (b >= 0) this.world?.billboards.splice(b, 1);
        this.marker.sprite.material.map?.dispose();
        this.marker.sprite.material.dispose();
        this.marker.sprite.geometry.dispose();
      }
      this.marker = null;
    }

    const want = errandMarker(this.errands);
    if (!want || want.area !== this.area.id || !this.world) return;

    const texture = want.art ? DRESSING_ART[want.art]() : makeCairnTexture();
    const sprite = this.world.addBillboard(texture, 1.6, 1.6, want.x, want.z);
    const hotspot = new Hotspot(want.x, want.z, want.label, () => {
      this.errands = {
        ...this.errands,
        ...(this.errands.active ? { active: { ...this.errands.active, ready: true } } : {}),
      };
      if (this.errands.active) this.opts.onErrandReady(this.errands.active.id);
      this.refreshObjective();
      this.placeErrandMarker();
      this.hud?.flashNotice('Taken. Go and report it.');
    });
    this.interactables.push(hotspot);
    this.marker = { hotspot, sprite };
  }

  /**
   * Hands the open errand back.
   *
   * Free, and it does not go into the `done` ledger -- so the giver offers it again next time
   * you speak to them, which is the whole point. A job you gave back is a job you did not do,
   * not a job you failed.
   */
  private abandonErrand(): void {
    if (!this.errands.active) return;
    this.errands = { ...this.errands, active: null };
    this.opts.onErrandAbandon();
    this.refreshObjective();
    this.placeErrandMarker();
    this.hud?.flashNotice('Given back.');
  }

  /** The objective panel, which the tutorial and the errands share. See `quest.ts`. */
  private refreshObjective(): void {
    this.hud?.renderObjective(this.flags, this.errands);
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
      (pulled) => this.beginFight(encounterId, pulled),
    );
    this.ring = ring;
    this.world?.scene.add(ring.mesh);
    this.updatables.push(ring);
  }

  /**
   * The circle has closed. Lay a board on the ground inside it.
   *
   * Everything the engine needs that only the profile can answer comes back through
   * `onPack` — the deck, the seed, the carry, the roster, the reinforcement squads, and the
   * callback that settles the result into the save. It can decline — most often because a
   * contract is already open against this character — and returns `false` when it does, so a
   * caller with a sensible non-combat outcome can take it. The Warden has one.
   */
  private beginFight(encounterId: string, pulled: string[]): boolean {
    const player = this.player;
    const world = this.world;
    if (!player || !world || !this.camera || this.combat) {
      this.declineFight();
      return false;
    }

    const fight = this.opts.onPack(encounterId, pulled);
    if (!fight) {
      this.declineFight();
      return false;
    }

    // Centred on the ring, not on the player: the ring is what the player watched decide how
    // big this fight was going to be, and the board belongs inside it.
    const at = { x: this.ring?.originX ?? player.position.x, z: this.ring?.originZ ?? player.position.z };

    // The weather is the weather here -- and only out here. A contract played on the 2D board is
    // not standing on any particular ground; this is for the fights that happen on the road you
    // are already looking at. The rule about what the ground may and may not fill in lives in
    // `groundedEncounter`.
    // ...and only on a day it is actually falling. A clear night in the Rimefields is a fight
    // with clear air in it, which is the entire reason the sky learned to stop.
    const encounter = groundedEncounter(
      fight.encounter,
      this.area.props.sky,
      skyStrengthAt(this.area.id, this.area.props.sky, this.hour),
    );

    const combat = new WorldCombat({
      root: this.root!,
      scene: world.scene,
      camera: this.camera,
      area: this.area,
      at,
      maxAnisotropy: this.renderer!.capabilities.getMaxAnisotropy(),
      encounter,
      seed: fight.seed,
      companionId: this.opts.companionId,
      ...(this.opts.companionShiny !== undefined
        ? { companionShiny: this.opts.companionShiny }
        : {}),
      deck: fight.deck,
      ...(fight.ai ? { ai: fight.ai } : {}),
      ...(fight.carry ? { carry: fight.carry } : {}),
      ...(fight.roster ? { roster: fight.roster } : {}),
      ...(fight.wave2 ? { wave2: fight.wave2 } : {}),
      ...(fight.coach ? { coach: fight.coach } : {}),
      onRotate: (steps) => this.nudgeOrbit(steps),
      onFinish: (result, encounter, outcome) => {
        this.endFight();
        // A cull is satisfied by the *pack dying*, not by the errand having arranged it -- so a
        // player who was already going to clear that road gets the credit. Asked here rather
        // than pushed from the errand, which is why the two never have to agree about whose
        // fight this was.
        // `pulled` as well as the host: the ring drags in whatever was roaming nearby and they
        // all go off the road on the same clock, so they are all things that died here.
        if (result !== 'defeat' && cullSatisfiedBy(this.errands, encounterId, ...pulled)) {
          const id = this.errands.active!.id;
          this.errands = { ...this.errands, active: { id, ready: true } };
          this.opts.onErrandReady(id);
          this.refreshObjective();
        }
        fight.onFinish(result, encounter, outcome);
      },
    });
    this.combat = combat;
    this.hud?.setCombat(true);

    // Anything built inside the footprint gets out of the way. In a dense ward the search
    // cannot always find a window with nothing in it, and fading a terrace corner is a better
    // answer than drawing the grid through it.
    const a = combat.board.centreOf({ x: 0, y: 0 });
    const b = combat.board.centreOf({ x: combat.board.w - 1, y: combat.board.h - 1 });
    world.setArena({
      x0: Math.min(a.x, b.x) - 2,
      z0: Math.min(a.z, b.z) - 2,
      x1: Math.max(a.x, b.x) + 2,
      z1: Math.max(a.z, b.z) + 2,
    });

    // Everything that was hunting this street goes off it.
    //
    // Not an aesthetic choice. The pack that jumped you is now standing on the grid as a
    // squad, and its three roaming bodies were still on the road beside them -- the same
    // creatures drawn twice, one copy playable and one frozen mid-stride inside the arena. The
    // Warden goes for the same reason where it is in the fight, and where it is not, because
    // a patrol walking past a battlefield is the loudest possible reminder that the board is
    // pasted onto a world still going about its business.
    //
    // `endFight` puts them back, which matters for the one path that returns to this same
    // screen instance: a Warden who cannot serve a second contract falls through to `seize`.
    for (const pack of this.packs) pack.setVisible(false);
    for (const critter of this.critters) critter.setVisible(false);
    this.warden?.setVisible(false);
    // The errand's cairn too. `setArena` fades *structures*, so a marker seated inside the
    // footprint would otherwise stand in the middle of the grid with a prompt over it.
    if (this.marker?.sprite) this.marker.sprite.visible = false;

    // The Commander and their beast take their places at the near edge — off the grid but on
    // the field, which is the same geometry the 2D board draws its portraits in. They are the
    // bodies that were walking a moment ago, which is most of the point of fighting here.
    const stand = combat.heroStand();
    player.position.set(stand.x, 0, stand.z);
    this.follower?.snapTo(stand.x - 1.6, stand.z + 0.8);

    const framing = frameBoard(
      combat.board,
      this.width() / Math.max(1, this.height()),
      (world.scene.fog as THREE.FogExp2).density,
    );
    this.descent = new Descent(framing, {
      yaw: this.cameraYaw,
      target: new THREE.Vector3(player.position.x, 0, player.position.z),
    });

    // The circle has done its job; the grid is the thing on the ground now.
    this.clearRing();
    return true;
  }

  /** Takes the circle off the road and out of the update loop, wherever it ended up. */
  private clearRing(): void {
    if (!this.ring) return;
    this.world?.scene.remove(this.ring.mesh);
    const i = this.updatables.indexOf(this.ring);
    if (i >= 0) this.updatables.splice(i, 1);
    this.ring.dispose();
    this.ring = null;
  }

  /**
   * A closed circle whose fight never started.
   *
   * The ring has to go with the refusal, not merely the lock: `ambush` and `arrest` both
   * guard on `this.ring`, so a ring left standing here means no pack and no Warden can
   * ever start a fight again on this screen — one refused contract used to disarm the
   * whole ward until the next reload. And the refuge pin was written for a fight that is
   * not happening, so walking has to persist again; left latched, the walked position was
   * silently discarded and the player respawned at a stale refuge.
   */
  private declineFight(): void {
    this.clearRing();
    this.positionPinned = false;
    if (!this.combat) this.inputLocked = false;
  }

  /**
   * The fight is over. Give the street back.
   *
   * Called before the result is handed upward, because what happens next is usually a screen
   * change and this has to have let go of the scene by then. Everything it undoes was set by
   * `beginFight`, in the same order.
   */
  private endFight(): void {
    if (!this.combat) return;
    this.combat.dispose();
    this.combat = null;
    this.hud?.setCombat(false);
    // Whatever the fight did to the follower, it walks the road again after it.
    if (this.follower) this.follower.walker.sprite.visible = true;
    for (const pack of this.packs) pack.setVisible(true);
    for (const critter of this.critters) critter.setVisible(true);
    this.warden?.setVisible(true);
    if (this.marker?.sprite) this.marker.sprite.visible = true;
    this.descent = null;
    this.combatCam = null;
    this.world?.setArena(null);
    this.world?.setFogScale(1);
    if (this.camera) {
      this.camera.fov = LOOK.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Caught off the pavement, and no longer simply escorted back.
   *
   * The Warden used to `seize()`: a flash, a teleport to the last flagstone, nothing owed.
   * That was a deliberate choice — a lesson rather than a tax — and the lesson survives,
   * because losing this fight still ends at `lastRefuge`, which in a ward with pavement *is*
   * the last flagstone. What changes is that the rule now has something behind it.
   *
   * The circle is opened on the **Warden**, not on the player, and the packs stay candidates
   * for it. That is not an oversight: a Warden only ever catches you off the pavement, which
   * is precisely where packs are live — so an arrest that drags a gutter crew in with it comes
   * free, out of machinery that already exists, and is the best thing that can happen in this
   * ward.
   */
  private arrest(): void {
    const warden = this.warden;
    if (this.inputLocked || !this.player || !warden || this.ring) return;
    this.inputLocked = true;
    this.writePosition({ x: this.lastRefuge.x, z: this.lastRefuge.z });

    this.hud?.setAlert(false);
    this.world?.spawnImpactLight(warden.position, '#d8b13a', 1.6);
    warden.reset();

    const ring = new CombatRing(
      warden.position.x,
      warden.position.z,
      this.packs,
      (pulled) => {
        // A Warden who catches you while a contract is already open cannot serve a second
        // one, and the old escort is exactly the right thing to do instead: back onto the
        // flags, nothing owed. The lesson was never the fight.
        if (!this.beginFight(WARDEN_ENCOUNTER, pulled)) this.seize();
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
