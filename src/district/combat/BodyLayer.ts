/**
 * The bodies on the board, as the district's own billboards.
 *
 * `EntityViewMap` is the whole input, and it needed no changes to serve this: it already
 * stores positions as *fractional tile coordinates* with an abstract `elev`, `squash`, `alpha`
 * and `flash`, because it is what the screen believes rather than what the screen draws. So
 * the animation handlers — every drop-in, hop, lunge, flinch and death in the game — drive the
 * bodies out here exactly as they drive the ones on the 2D board, unchanged and unaware.
 *
 * Art follows the same rule the road already follows. The player's Companion is the painted
 * beast they have been walking beside, because that continuity is most of the point of
 * fighting in the world: the thing that was following you a moment ago is the thing now
 * standing on the grid. Everything else gets a procedural silhouette from
 * `makeMinionTexture`, seeded off its card id and tinted by school — the same generator that
 * draws the packs roaming the road, so a body does not change species when the fight starts.
 */

import * as THREE from 'three';
import type { UnitId } from '../../contract/ids.js';
import type { EntityView, EntityViewMap } from '../../render/EntityViews.js';
import { PALETTE, schoolOf } from '../../render/palette.js';
import { loadCompanionSprite } from '../../render/sprites.js';
import { hashText } from '../../core/util/rng.js';
import { makeMinionTexture } from '../textures.js';
import {
  actorArtFromTextures,
  buildActorArt,
  disposeActorArt,
  pickFacing,
  Walker,
  type ActorArt,
} from '../sprites3d.js';
import { PX_TO_WORLD } from './OverlayCanvas.js';
import { TILE } from '../map.js';
import type { WorldBoard } from './WorldBoard.js';

/** How tall an ordinary body stands, in world units. Matched to the road's own minions. */
const BODY_HEIGHT = 1.9;
/** A Behemoth fills a 2x2 and has to look like it does. */
const BEHEMOTH_HEIGHT = 3.4;

/**
 * Just above the board's own marks, which stop at 0.16.
 *
 * A footing has to win against every tile overlay under it: the tile a body is standing on is
 * very often also a legal move, an impact zone and the hovered tile at once, and a ring that
 * z-fought with any of those would flicker under exactly the body the player is looking at.
 */
const FOOTING_Y = 0.2;

/**
 * What a body on the board is made of.
 *
 * The `Walker` is reused rather than a bare `BillboardSprite` because it already owns the
 * facing logic — which of the four painted views to show for a given movement direction and
 * camera yaw — and a body that walks two tiles across the arena should turn to do it, exactly
 * as it does out on the road.
 */
interface Body {
  readonly walker: Walker;
  /**
   * The side-coloured ring it stands in, or null for an obstacle.
   *
   * Null is a statement rather than an omission: a crate belongs to nobody, and drawing it a
   * footing would say it was somebody's piece.
   */
  readonly footing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;
  readonly art: ActorArt;
  /** Whether this layer cut the art and therefore owns freeing it. */
  readonly ownsArt: boolean;
  /** Last drawn position, so `step` gets a real delta and the legs move. */
  lastX: number;
  lastZ: number;
  /**
   * Whether this body is wearing the Companion's painted art.
   *
   * Tracked rather than inferred by comparing against `companionArt`, because the answer is
   * needed for a body created *before* that art existed — which is the ordinary case, not the
   * exception. See `sync`.
   */
  usesCompanionArt: boolean;
}

/** Where the two Commanders stand: off the grid at either end, but on the field. */
export interface Stands {
  /** The Hero's own body, which the district stands there itself. Footing only. */
  hero: { x: number; z: number };
  /**
   * The enemy Commander, or null where the fight has none to show.
   *
   * Null in two cases the rules actually produce, and both matter: a rout has no Commander at
   * all, and one whose Bound Form is on the board is already represented there. Drawing a
   * crowned figure the player cannot target would be the presentation inventing an opponent.
   */
  enemy: { x: number; z: number; school: string; seed: string } | null;
}

export interface BodyLayerOpts {
  /** The beast walking beside the player, so its Bound Form wears its own art. */
  companionId: string;
  /** A lustrous beast keeps its tint into the fight. */
  companionShiny?: boolean;
  /** The renderer's filtering limit, for the painted art. Procedural bodies need none. */
  maxAnisotropy: number;
  /**
   * The species standing in for the enemy Commander, when the encounter names one.
   *
   * The same lookup the 2D board makes, so the figure at the far end of the road is the figure
   * on the far dais of the diamond — a Warden fight should not be against a different-looking
   * Warden depending on which presentation the fight happens in.
   */
  enemySpeciesId?: string;
}

/**
 * The ring on the ground under a body, in the colour of the side that owns it.
 *
 * The 2D board draws `drawBasePlate` for this and it does the same job for the same reason:
 * school colour tells you *what* a body is and says nothing about *whose* it is, and on a board
 * where both sides field Frost the two are the same colour. Out here it matters more than it
 * does on the diamond, because the camera can now walk all the way round the arena — so
 * "the ones at the bottom of the screen are mine" is no longer a rule that holds.
 *
 * Cut once per radius and shared, and deliberately never freed — there are exactly three of
 * them for the lifetime of the process, and a ring cut per fight is a ring leaked per fight.
 * The *material* is per body: a ring fades with the body standing in it, and a shared material
 * would take every other body's down with the first death.
 */
function footingGeometry(outer: number): THREE.RingGeometry {
  const cached = FOOTING_GEO.get(outer);
  if (cached) return cached;
  const geo = new THREE.RingGeometry(outer * 0.72, outer, 32);
  geo.rotateX(-Math.PI / 2);
  FOOTING_GEO.set(outer, geo);
  return geo;
}

const FOOTING_GEO = new Map<number, THREE.RingGeometry>();

/** A body's ring, a Behemoth's, and a Commander's — which stands off the grid, not on it. */
const FOOTING_R = { unit: TILE * 0.4, behemoth: TILE * 0.78, commander: TILE * 0.56 } as const;

export class BodyLayer {
  readonly group = new THREE.Group();

  private readonly bodies = new Map<UnitId, Body>();
  /** Cut once per card id and shared — a pack of four footmen is one silhouette, not four. */
  private readonly artCache = new Map<string, ActorArt>();
  /** The Companion's painted art, once it has decoded. Null until then, and if it 404s. */
  private companionArt: ActorArt | null = null;
  /** The enemy Commander's, on exactly the same terms. */
  private enemyArt: ActorArt | null = null;

  /** The two off-grid Commanders. See `setStands`. */
  private heroFooting: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  private enemyStand: {
    walker: Walker;
    footing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    /** Whether it is wearing the painted art, so a late decode can be picked up. */
    painted: boolean;
  } | null = null;

  constructor(
    private readonly board: WorldBoard,
    private readonly views: EntityViewMap,
    private readonly opts: BodyLayerOpts,
  ) {
    void this.loadCompanionArt();
    if (opts.enemySpeciesId) void this.loadEnemyArt(opts.enemySpeciesId);
  }

  /**
   * The Companion's own three views, fetched apart from everything else and allowed to fail.
   *
   * The same discipline the district uses when it puts the follower on the street: the
   * campaign hands out bloodlines faster than they can be painted, and a species nobody has
   * drawn yet should cost exactly one silhouette rather than taking the fight down with it.
   * Until this resolves — or if it never does — the Bound Form uses the procedural body like
   * anything else, which is why nothing below waits on it.
   */
  private async loadCompanionArt(): Promise<void> {
    const [front, back, side] = await Promise.all([
      loadCompanionSprite(this.opts.companionId, 'front').catch(() => null),
      loadCompanionSprite(this.opts.companionId, 'back').catch(() => null),
      loadCompanionSprite(this.opts.companionId, 'side').catch(() => null),
    ]);
    if (!front) return;
    this.companionArt = buildActorArt(
      { front, back: back ?? front, side: side ?? front },
      this.opts.maxAnisotropy,
    );
  }

  /** The enemy Commander's painted views, allowed to fail exactly as the Companion's are. */
  private async loadEnemyArt(speciesId: string): Promise<void> {
    const [front, back, side] = await Promise.all([
      loadCompanionSprite(speciesId, 'front').catch(() => null),
      loadCompanionSprite(speciesId, 'back').catch(() => null),
      loadCompanionSprite(speciesId, 'side').catch(() => null),
    ]);
    if (!front) return;
    this.enemyArt = buildActorArt(
      { front, back: back ?? front, side: side ?? front },
      this.opts.maxAnisotropy,
    );
  }

  /**
   * The two Commanders standing off either end of the grid.
   *
   * The far end used to be empty. The Hero is the body that walked in here and the district
   * stands it at the near edge itself, so from the beginning there was somebody at one end of
   * the arena and nobody at the other — an asymmetry that reads as "there is no opponent", and
   * one that got much harder to ignore once the camera could walk round and look straight at
   * it. `WorldCombat.enemyStand()` had been sitting unused since the board was built.
   *
   * Called on the same beat the 2D board syncs its own Commanders — once per input unlock,
   * never per frame — which is also what lets a painted body that decoded late simply appear.
   */
  setStands(stands: Stands): void {
    if (!this.heroFooting) {
      this.heroFooting = this.buildStandFooting(PALETTE.allyBase);
      this.group.add(this.heroFooting);
    }
    this.heroFooting.position.set(stands.hero.x, FOOTING_Y, stands.hero.z);

    const want = stands.enemy;
    if (!want) {
      this.dropEnemyStand();
      return;
    }

    const painted = this.enemyArt !== null;
    if (this.enemyStand && this.enemyStand.painted === painted) {
      this.enemyStand.walker.position.set(want.x, 0, want.z);
      this.enemyStand.footing.position.set(want.x, FOOTING_Y, want.z);
      return;
    }
    this.dropEnemyStand();

    // Shared art in both branches, so nothing here owns anything to free: the painted views
    // belong to this layer and the silhouette belongs to the cache.
    const art = painted ? this.enemyArt! : this.silhouette(want.seed);
    // A Commander stands taller than what it fields, in the same proportion the 2D board draws
    // a boss over a unit, so the pecking order does not change between presentations.
    const walker = new Walker(art, BODY_HEIGHT * 1.18);
    if (!painted) {
      walker.sprite.setTint(new THREE.Color(schoolOf(want.school as never).main).getHex());
    }
    walker.position.set(want.x, 0, want.z);

    const footing = this.buildStandFooting(PALETTE.enemyBase);
    footing.position.set(want.x, FOOTING_Y, want.z);
    this.group.add(walker.sprite);
    this.group.add(footing);
    this.enemyStand = { walker, footing, painted };
  }

  /** Every sprite on this layer, the two stands included, for the screen to billboard. */
  private standSprites(): THREE.Object3D[] {
    return this.enemyStand ? [this.enemyStand.walker.sprite] : [];
  }

  /**
   * A Commander's footing: the same ring a unit stands in, half again as wide.
   *
   * Wider on purpose. It is the one mark that says a body is *beside* the grid rather than on
   * a tile of it, which is most of what makes melee reach at the two ends legible.
   */
  private buildStandFooting(css: string): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
    const mesh = new THREE.Mesh(
      footingGeometry(FOOTING_R.commander),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(css),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.renderOrder = 22;
    return mesh;
  }

  private dropEnemyStand(): void {
    const stand = this.enemyStand;
    if (!stand) return;
    this.group.remove(stand.walker.sprite);
    this.group.remove(stand.footing);
    stand.footing.material.dispose();
    this.enemyStand = null;
  }

  /** A procedural silhouette for an arbitrary key, cut once and shared with the bodies. */
  private silhouette(key: string): ActorArt {
    const cached = this.artCache.get(key);
    if (cached) return cached;
    const seed = hashText(key);
    const art = actorArtFromTextures(
      makeMinionTexture('front', seed),
      makeMinionTexture('back', seed),
      makeMinionTexture('side', seed),
    );
    this.artCache.set(key, art);
    return art;
  }

  /** A procedural silhouette for a card id, cut once and shared. */
  private artFor(view: EntityView): { art: ActorArt; owned: boolean } {
    const snap = view.snapshot;
    const key = snap ? snap.defId : 'obstacle';
    return { art: this.silhouette(key), owned: false };
  }

  /**
   * Brings the scene into line with what the view map believes.
   *
   * Additions and removals are driven off the map rather than off events, deliberately: the
   * handlers already add and remove views, and a second subscription here would be a second
   * place for the two to disagree. A body that is in the map has a sprite; one that is not,
   * does not.
   */
  private sync(): void {
    const live = new Set<UnitId>();

    for (const view of this.views.all()) {
      live.add(view.id);

      const existing = this.bodies.get(view.id);
      if (existing) {
        // The Companion's art arrives on a fetch and the board is standing within a frame of
        // the fight opening, so the art nearly always loses that race — meaning a body created
        // at the opening bell is wearing a procedural silhouette even though the painted views
        // are on their way. Once they land, the Bound Form is rebuilt to wear them.
        //
        // Whichever way it is fixed, it has to be fixed: the beast that was walking beside you
        // being the one now standing on the grid is most of the reason to fight out here at
        // all, and a generic hooded body in its place quietly throws that away. Waiting on the
        // decode before opening the board would cost every first fight a stall on the network,
        // which is worse; this costs one rebuild, once, and only when it would be wrong not to.
        if (this.wantsCompanionArt(view) && !existing.usesCompanionArt) {
          this.group.remove(existing.walker.sprite);
          this.dropFooting(existing);
          if (existing.ownsArt) disposeActorArt(existing.art);
          this.bodies.delete(view.id);
        } else {
          continue;
        }
      }

      const snap = view.snapshot;
      const useCompanion = this.wantsCompanionArt(view);
      const { art, owned } = useCompanion
        ? { art: this.companionArt!, owned: false }
        : this.artFor(view);

      // A Behemoth fills a 2x2 and has to look like it. The height goes into the `Walker`,
      // so `squash` below stays a plain multiplier over whatever this body's own size is.
      const footprint = snap?.footprint ?? 1;
      const walker = new Walker(art, footprint > 1 ? BEHEMOTH_HEIGHT : BODY_HEIGHT);

      // School colour as a wash, so a Frost body and a Pyre body are told apart at a glance
      // the way they are on the 2D board. The Companion keeps its painted palette — tinting
      // real art is how you make it look broken — unless it is lustrous, which is a tint the
      // player has already been shown out on the street.
      if (useCompanion) {
        if (this.opts.companionShiny) walker.sprite.setTint(SHINY_TINT);
      } else if (snap) {
        walker.sprite.setTint(new THREE.Color(schoolOf(snap.school).main).getHex());
      }

      const c = this.board.centreOf(view.pos);
      walker.position.set(c.x, 0, c.z);
      this.group.add(walker.sprite);

      let footing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
      if (snap) {
        footing = new THREE.Mesh(
          footingGeometry(footprint > 1 ? FOOTING_R.behemoth : FOOTING_R.unit),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(snap.side === 'player' ? PALETTE.allyBase : PALETTE.enemyBase),
            transparent: true,
            // Bright enough to find at the far end of the arena without being the brightest
            // thing on the ground — the grid's own lines add about 26 of red where this adds
            // 22, so a body reads as standing *in* the grid rather than on top of it.
            opacity: 0.38,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          }),
        );
        footing.renderOrder = 22;
        this.group.add(footing);
      }

      this.bodies.set(view.id, {
        walker,
        footing,
        art,
        ownsArt: owned,
        lastX: c.x,
        lastZ: c.z,
        usesCompanionArt: useCompanion,
      });
    }

    for (const [id, body] of [...this.bodies]) {
      if (live.has(id)) continue;
      this.group.remove(body.walker.sprite);
      this.dropFooting(body);
      if (body.ownsArt) disposeActorArt(body.art);
      this.bodies.delete(id);
    }
  }

  /** Takes a footing off the board and frees it. Its geometry is shared and stays. */
  private dropFooting(body: Body): void {
    if (!body.footing) return;
    this.group.remove(body.footing);
    body.footing.material.dispose();
  }

  /**
   * One frame.
   *
   * `cameraYaw` is threaded through to `Walker.step`, which is what picks the painted view: a
   * body crossing the arena away from a camera that has itself swung round should be seen from
   * behind, and that is a question only the two together can answer.
   *
   * Takes no `dt`: every animation out here is driven by the sequencer writing to the view
   * map, and the flash decay is aged by `EntityViewMap.ageFlashes`. Nothing on this layer
   * integrates time of its own, and a `dt` parameter would invite something to start.
   */
  update(cameraYaw: number): void {
    this.sync();

    // The enemy Commander squares up to the board it is looking across, from wherever the
    // camera happens to be. Camera-relative, so orbiting the arena turns the figure rather
    // than sliding it: a Commander seen from behind their own end is seen from behind.
    if (this.enemyStand) this.enemyStand.walker.face(pickFacing(0, 1, cameraYaw));

    for (const view of this.views.all()) {
      const body = this.bodies.get(view.id);
      if (!body) continue;

      // A Behemoth's `pos` is its anchor, and its bulk extends across the footprint — so the
      // sprite stands at the middle of the block rather than on its corner tile.
      const footprint = view.snapshot?.footprint ?? 1;
      const offset = (footprint - 1) / 2;
      const c = this.board.centreOf({ x: view.pos.x + offset, y: view.pos.y + offset });

      const dx = c.x - body.lastX;
      const dz = c.z - body.lastZ;
      body.walker.position.set(c.x, view.elev * PX_TO_WORLD, c.z);
      body.lastX = c.x;
      body.lastZ = c.z;
      // The real delta, so the gait is driven by ground covered exactly as it is on the road.
      body.walker.step(dx, dz, cameraYaw);

      const sprite = body.walker.sprite;
      // Squash is a flinch: shorter and correspondingly wider, so the body keeps its mass.
      const squash = 1 - view.squash * 0.35;
      sprite.scale.y = squash;
      sprite.scale.x = 1 / Math.max(0.2, squash);

      const mat = sprite.material;
      mat.opacity = view.alpha;
      mat.transparent = view.alpha < 1 || mat.transparent;

      // A status that changed nothing visible still gets said out loud, in the colour of the
      // thing that landed. `life` decays in `EntityViewMap.ageFlashes`, so nothing to clean up.
      if (view.flash) {
        const flash = new THREE.Color(view.flash.color);
        sprite.setTint(flash.getHex());
      } else if (view.snapshot && !body.usesCompanionArt) {
        sprite.setTint(new THREE.Color(schoolOf(view.snapshot.school).main).getHex());
      }

      // Spent bodies dim, which is the one piece of board state that is about availability
      // rather than about the body. Only your own: reading the enemy's is not yours to do.
      if (view.spent) mat.opacity = Math.min(mat.opacity, 0.55);

      // The footing stays flat on the road while the body above it hops, lunges and drops in:
      // it is where the piece *is*, and a ring that rose with a jump would stop meaning that.
      if (body.footing) {
        body.footing.position.set(c.x, FOOTING_Y, c.z);
        body.footing.material.opacity = view.alpha * (view.spent ? 0.18 : 0.38);
      }
    }
  }

  /**
   * Whether this body is the player's Companion, and whether its art is here yet.
   *
   * Both halves matter: the first is what makes it the Companion's body, and the second is
   * what makes it *possible* to dress it as one. A false answer is never wrong, only early.
   */
  private wantsCompanionArt(view: EntityView): boolean {
    const snap = view.snapshot;
    if (!snap || snap.side !== 'player' || !snap.keywords.includes('BoundForm')) return false;
    return this.companionArt !== null;
  }

  /** Every sprite, so the screen can add them to its billboard list. */
  get sprites(): THREE.Object3D[] {
    return [...[...this.bodies.values()].map((b) => b.walker.sprite), ...this.standSprites()];
  }

  /** Where a body is standing right now, for the camera to look at. */
  positionOf(id: UnitId): THREE.Vector3 | null {
    return this.bodies.get(id)?.walker.position ?? null;
  }

  dispose(): void {
    this.dropEnemyStand();
    if (this.heroFooting) {
      this.group.remove(this.heroFooting);
      this.heroFooting.material.dispose();
      this.heroFooting = null;
    }
    if (this.enemyArt) disposeActorArt(this.enemyArt);
    this.enemyArt = null;
    for (const body of this.bodies.values()) {
      this.group.remove(body.walker.sprite);
      this.dropFooting(body);
      if (body.ownsArt) disposeActorArt(body.art);
    }
    this.bodies.clear();
    for (const art of this.artCache.values()) disposeActorArt(art);
    this.artCache.clear();
    if (this.companionArt) disposeActorArt(this.companionArt);
    this.companionArt = null;
    this.group.clear();
  }
}

/** The gold a lustrous beast is multiplied by. Mirrors `DistrictScreen`'s own constant. */
const SHINY_TINT = 0xffe9a8;
