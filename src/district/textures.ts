/**
 * Every surface in the ward, painted onto a canvas at load.
 *
 * Two filtering rules live here and they pull in opposite directions, which is why they
 * are in one file where the difference is visible:
 *
 *   - **Environment** textures are hand-placed pixels blown up whole numbers of times.
 *     They get `NearestFilter`, because interpolation can only soften marks that were
 *     already exact.
 *   - **Actor** textures are the painted PNGs from `public/assets/sprites/` — anti-aliased
 *     work 250–330px tall, scaled by whatever the camera happens to be doing. They get
 *     `LinearFilter`, because nearest neighbour has no pixel edges to preserve there and
 *     would stair-step every soft gradient the artist actually drew.
 *
 * Getting this backwards is the single most common way pixel art in 3D looks wrong, in
 * both directions at once.
 */

import * as THREE from 'three';
import { groundRowsOf, waterRowsOf, type AreaDef } from './map.js';
import type { DressingId } from './dressing.js';

/** A deterministic RNG, so the ward is painted the same way every reload. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** The setting that makes pixel art in 3D look like pixel art. */
export function configurePixelTexture(tex: THREE.Texture): THREE.Texture {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function canvasTexture(canvas: HTMLCanvasElement): THREE.Texture {
  return configurePixelTexture(new THREE.CanvasTexture(canvas));
}

/**
 * A loaded painted PNG, wrapped for the scene.
 *
 * Linear, mipmapped and anisotropic — the opposite of every other texture in this file,
 * for the reason in the header. The image is already decoded by the loaders in
 * `render/sprites.ts`, so this never blocks a frame.
 */
export function spriteTexture(img: HTMLImageElement, maxAnisotropy = 1): THREE.Texture {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * How much alpha counts as solid on an actor.
 *
 * Lower than the 0.5 an aliased sprite wants. Painted edges carry a wide soft ramp, and
 * cutting at a half would chew a pixel off every silhouette in the ward.
 */
export const ACTOR_ALPHA_TEST = 0.35;

/**
 * Cuts one frame out of a walk sheet into a texture of its own.
 *
 * Sliced up front rather than by animating a shared texture's UV offset, because the frames
 * then behave exactly like every other actor texture — one image, feet on the bottom edge —
 * and the walk machinery that already existed needs to know nothing about sheets.
 *
 * Every frame is cut to the *same* box, handed in by the caller, not to its own bounds. Two
 * things depend on that: the figure keeps one size instead of being rescaled every frame, and
 * whatever vertical travel the animator drew stays in the art rather than being cropped out
 * of it.
 */
export function sheetFrameTexture(
  sheet: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxAnisotropy = 1,
  /**
   * Whether the source is pixel art, and must therefore be cut and filtered as such.
   *
   * Two settings move together and both matter. The blit is done with smoothing **off**, so a
   * one-to-one copy stays one-to-one instead of being resampled on the way into the canvas;
   * and the texture takes `configurePixelTexture`'s nearest filtering rather than the linear
   * mipmapped chain below. Half of that fix on its own is no fix: nearest filtering over a
   * canvas that was already softened by the copy just magnifies the softening.
   *
   * Defaults false, which is the walk sheet's answer — that art is painted.
   */
  pixelArt = false,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context for a sheet slice');
  ctx.imageSmoothingEnabled = !pixelArt;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);

  if (pixelArt) return configurePixelTexture(new THREE.CanvasTexture(canvas));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/* ============================================================
   Ground
   ============================================================ */

const PX = 16; // canvas pixels per tile

/**
 * Every ground paint `bakeGround` knows how to lay down.
 *
 * `TileDef.tex` is a plain string and the dispatch below ends in a bare `else`, so a typo in
 * an area's legend does not fail — it silently paints cobbles, and the first anyone hears of
 * it is a road that looks like a street. A test walks every area's legend against this list
 * so the failure happens where the mistake is.
 */
type PaintFn = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  rng: () => number,
) => void;

/**
 * Every ground paint, and the function that lays it down.
 *
 * A record rather than a list beside an if/else chain, because the two of them drifted. The
 * list has carried `water` since the canal wards were built and the chain never had a branch
 * for it, so `tex: 'water'` fell through the bare `else` and painted **cobbles**. Invisible in
 * the five areas that declare `waterRows` — the bake starts below the canal — and very visible
 * in the Tallow Levels, which declare `W: { tex: 'water' }` with no `waterRows` at all: every
 * drainage cut in "drained country losing the argument" was dry paving.
 *
 * The test walks each area's legend against `GROUND_TEXES`, which catches a *typo* in a legend.
 * It could never catch this, because the drift was in the other direction — a name on the list
 * with nothing drawing it. Deriving the list from the record is what makes that direction
 * impossible rather than merely tested.
 */
const PAINTS = {
  sidewalk: paintSidewalk,
  grass: paintGrass,
  chalk: paintChalk,
  field: paintField,
  weeds: (ctx, px, py, rng) => paintCobble(ctx, px, py, rng, true),
  cobble: (ctx, px, py, rng) => paintCobble(ctx, px, py, rng, false),
  water: paintCut,
  market: paintMarket,
  slag: paintSlag,
  ash: paintAsh,
  marsh: paintMarsh,
  flagstone: paintFlagstone,
  salt: paintSalt,
  forest: paintForest,
  snow: paintSnow,
  ice: paintIce,
  blasted: paintBlasted,
  bone: paintBone,
  // Wave 7: the surfaces the thin areas were missing. Each one exists to break up an area
  // where a single character covered most of the grid.
  crust: paintCrust,
  sulphur: paintSulphur,
  drift: paintDrift,
  litter: paintLitter,
  barrow: paintBarrow,
  heath: paintHeath,
} as const satisfies Record<string, PaintFn>;

export type GroundTex = keyof typeof PAINTS;

/**
 * Every paint an area's legend may ask for.
 *
 * `TileDef.tex` stays a plain string — "open-ended: the wilds grows its own" — and the dispatch
 * below still ends in a fallback rather than a throw, because a typo should paint something
 * wrong rather than take the ward down. The test is what turns that into a failure at the site
 * of the mistake.
 */
export const GROUND_TEXES = Object.keys(PAINTS) as readonly GroundTex[];

/**
 * Standing water in a cut, seen from above.
 *
 * `GROUND_TEXES` has listed `water` since the canal wards were built, and `bakeGround` never
 * had a branch for it — so it fell through the bare `else` and painted **cobbles**. Invisible
 * in Ashfall, Lamprow, Saltglass, Ward Seven and Fenwick's, because those five declare
 * `waterRows` and `bakeGround` starts below it. Not invisible in the Tallow Levels, which
 * declares `W: { tex: 'water' }` with no `waterRows` at all: every drainage cut in the area
 * the atlas calls "drained country losing the argument" has been baking as dry paving, while
 * the file's own comment says the cuts "are below you, not in front of you".
 *
 * The legend test only walks legend -> `GROUND_TEXES`, never `GROUND_TEXES` -> the dispatch,
 * which is how a green build hid it.
 */
/**
 * Cooled lava crust — the Caldera's floor where it has set hard rather than shattered.
 *
 * The crater was two textures over 672 cells, `slag` and `ash` at 43/35, which is why it read
 * as one surface with a slight tint change. This is the third: plated, near-black, with the
 * fissures still holding heat. The only warm ground in the game, and it should be — nothing
 * else in Azo is standing on something that is still cooling.
 */
function paintCrust(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const plate = ['#2b2422', '#332b28', '#251f1e', '#3a312d'];
  ctx.fillStyle = plate[(rng() * plate.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Plates, as several small blocks rather than two large ones. The first cut used blocks half
  // the tile wide, and since every tile is painted from the same 16px stamp the plates lined up
  // across tile boundaries and the crater read as a checkerboard — the 4-unit grid became
  // visible, which is the one thing ground paint must never do.
  for (let i = 0; i < 5; i++) {
    const w = 2 + ((rng() * 4) | 0);
    const h = 2 + ((rng() * 3) | 0);
    ctx.fillStyle = plate[(rng() * plate.length) | 0]!;
    ctx.fillRect(px + ((rng() * (PX - w)) | 0), py + ((rng() * (PX - h)) | 0), w, h);
  }

  // The fissures. Sparse and short: a floor that is more crack than plate is lava, not crust.
  if (rng() < 0.3) {
    const x = px + ((rng() * (PX - 4)) | 0);
    const y = py + ((rng() * PX) | 0);
    ctx.fillStyle = '#5e2413';
    ctx.fillRect(x, y, 2 + ((rng() * 3) | 0), 1);
    ctx.fillStyle = '#93381a';
    ctx.fillRect(x + 1, y, 2, 1);
  }
}

/** Sulphur bloom, where a vent has been breathing on the same patch for years. */
function paintSulphur(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const crust = ['#7e6b32', '#8d793a', '#6f5d2b', '#95813f'];
  ctx.fillStyle = crust[(rng() * crust.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);
  ctx.fillStyle = '#a8934a';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 2, 2);
  }
  // The rock showing through where the bloom is thin.
  ctx.fillStyle = '#4a4038';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

/**
 * Wind-piled drift, against the Rimefields' packed snow.
 *
 * Paler and smoother than `snow` and deliberately almost featureless: a drift is where the
 * wind put the snow down rather than scoured it, so it has none of `paintSnow`'s hollows. The
 * two side by side are what turns 63% of one character into weather.
 */
function paintDrift(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const pale = ['#b6bcc8', '#c0c6d2', '#adb3c0'];
  ctx.fillStyle = pale[(rng() * pale.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);
  // One long shallow ridge, aligned across the tile, which is how drift lies.
  ctx.fillStyle = '#c9cfda';
  ctx.fillRect(px, py + ((rng() * PX) | 0), PX, 2);
  ctx.fillStyle = '#a4aab7';
  ctx.fillRect(px, py + ((rng() * PX) | 0), PX, 1);
}

/** Leaf litter under the Ashwood's canopy, where the forest floor is not bare. */
function paintLitter(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  ctx.fillStyle = '#26301f';
  ctx.fillRect(px, py, PX, PX);
  const leaf = ['#4a3f22', '#5c4b28', '#3d3a1e', '#6b5530'];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = leaf[(rng() * leaf.length) | 0]!;
    ctx.fillRect(px + ((rng() * (PX - 2)) | 0), py + ((rng() * (PX - 1)) | 0), 2, 1);
  }
}

/** Turf over bone — the Bone Bastion's mounds, going grey where the barrow surfaces. */
function paintBarrow(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const turf = ['#3e4634', '#47503b', '#39412f'];
  ctx.fillStyle = turf[(rng() * turf.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);
  // What is coming up through it, which is the whole subject of the area.
  ctx.fillStyle = '#9a927f';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(px + ((rng() * (PX - 3)) | 0), py + ((rng() * PX) | 0), 2 + ((rng() * 2) | 0), 1);
  }
  ctx.fillStyle = '#2e3527';
  for (let i = 0; i < 4; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

/** Burnt heath on the Storm Shelf, where the sky has been down more than once. */
function paintHeath(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const scrub = ['#3a3328', '#443c2f', '#322c23'];
  ctx.fillStyle = scrub[(rng() * scrub.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);
  // Low woody stuff that survived, and the char that did not.
  ctx.fillStyle = '#55603c';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * (PX - 2)) | 0), 1, 2);
  }
  ctx.fillStyle = '#1b1815';
  for (let i = 0; i < 4; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

function paintCut(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  ctx.fillStyle = '#232d31';
  ctx.fillRect(px, py, PX, PX);
  // A little depth, so a cut reads as holding water rather than as a dark tile.
  ctx.fillStyle = '#1a2225';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 3, 1);
  }
  // The odd glint off the surface. Sparse — a cut is not a canal.
  if (rng() < 0.35) {
    ctx.fillStyle = '#3c4c50';
    ctx.fillRect(px + ((rng() * (PX - 3)) | 0), py + ((rng() * PX) | 0), 3, 1);
  }
}

function paintSidewalk(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  // Warm flagstones. The grout is only a shade darker than the slab — a hard black line at
  // this scale reads as a bathroom floor rather than as paving.
  const base = ['#7f7a6d', '#8a8477', '#767162', '#847e70'];
  const slab = (): string => base[(rng() * base.length) | 0]!;
  ctx.fillStyle = slab();
  ctx.fillRect(px, py, PX, PX);

  // The split is offset per tile so the street is not one stamp repeated down the block.
  const sx = 5 + ((rng() * 6) | 0);
  const sy = 5 + ((rng() * 6) | 0);
  ctx.fillStyle = slab();
  ctx.fillRect(px, py, sx, sy);
  ctx.fillStyle = slab();
  ctx.fillRect(px + sx, py + sy, PX - sx, PX - sy);
  ctx.fillStyle = slab();
  ctx.fillRect(px + sx, py, PX - sx, sy);

  ctx.fillStyle = '#6a6559';
  ctx.fillRect(px, py + sy, PX, 1);
  ctx.fillRect(px + sx, py, 1, PX);

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#918b7c' : '#6e6a5c';
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
  }
}

function paintCobble(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  rng: () => number,
  weedy: boolean,
): void {
  ctx.fillStyle = '#20242c';
  ctx.fillRect(px, py, PX, PX);
  const stones = ['#3b424e', '#434b58', '#333944', '#4a5260'];
  for (let ry = 0; ry < 4; ry++) {
    const offset = (ry % 2) * 2;
    for (let rx = -1; rx < 5; rx++) {
      const sx = px + rx * 4 + offset;
      const left = Math.max(px, sx);
      const w = Math.min(sx + 3, px + PX) - left;
      if (w <= 0) continue;
      ctx.fillStyle = stones[(rng() * stones.length) | 0]!;
      ctx.fillRect(left, py + ry * 4, w, 3);
    }
  }
  if (weedy) {
    ctx.fillStyle = '#2f4029';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
    }
  }
}

/**
 * A chalk track — the Verge's ground, and the Road's.
 *
 * It had been falling through to weedy cobbles, which is a paved street with grass in it:
 * exactly the wrong read for a road worn through turf down to the white under it. Pale dust
 * with the ruts a cart leaves, and the flint that comes up with them.
 */
function paintChalk(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const dust = ['#8a8578', '#948e80', '#7d786a', '#9a947f'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = dust[(rng() * dust.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // Two wheel ruts, broken rather than drawn: a solid line every tile would tile visibly
  // into one impossible groove running the width of the map.
  ctx.fillStyle = '#6b6656';
  for (const ry of [5, 10]) {
    let x = 0;
    while (x < PX) {
      const dash = 3 + ((rng() * 3) | 0);
      if (rng() < 0.7) ctx.fillRect(px + x, py + ry, Math.min(dash, PX - x), 1);
      x += dash + 1 + ((rng() * 2) | 0);
    }
  }

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#5c584c' : '#a49e8c';
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
  }
}

/**
 * Ploughed field, for the strips either side of the Chalk Road.
 *
 * Furrows run north-south, across an east-west road, so the two never read as the same
 * surface at a glance — which is the whole job of a texture that borders the thing you walk on.
 */
function paintField(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  ctx.fillStyle = '#2e2a20';
  ctx.fillRect(px, py, PX, PX);

  for (let x = 0; x < PX; x += 3) {
    ctx.fillStyle = (x / 3) % 2 === 0 ? '#3a3426' : '#4a4030';
    ctx.fillRect(px + x, py, 2, PX);
  }

  // Stubble left after the cut.
  ctx.fillStyle = '#5c5238';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
  }
}

/**
 * The Bonemarket's trodden floor.
 *
 * Cobbles that stopped being cobbles: forty years of feet, spilled meal and bone-dust have
 * filled the joints until the stones only show through where the traffic runs thinnest. Warmer
 * and flatter than the street outside, which is what tells you the market has started before
 * you have seen a stall.
 */
function paintMarket(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const trodden = ['#4a443a', '#544d41', '#433d34', '#5b5347'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = trodden[(rng() * trodden.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // A stone surfacing through the dirt, one tile in three or so. Partial on purpose: a full
  // outline every tile would read as paving again and undo the whole point.
  if (rng() < 0.34) {
    const sx = 2 + ((rng() * 7) | 0);
    const sy = 2 + ((rng() * 7) | 0);
    ctx.fillStyle = '#635a4c';
    ctx.fillRect(px + sx, py + sy, 5 + ((rng() * 3) | 0), 1);
    if (rng() < 0.6) ctx.fillRect(px + sx, py + sy, 1, 4 + ((rng() * 3) | 0));
  }

  // Chaff and bone grit, pale against the dirt.
  ctx.fillStyle = '#8d8371';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

/**
 * The Cinderworks casting floor: clinker underfoot.
 *
 * Dark and glassy where the slag cooled hard, with the odd ember still in it. The embers are
 * the only warm thing in the palette and there are very few of them -- a floor twinkling all
 * over would read as a starfield rather than as something that has not finished cooling.
 */
function paintSlag(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  // Lifted from a near-black set. Measured in place, the original clinker averaged 41 of 255
  // and the casting floor came out at a mean of 18 -- a floor is walked on and has to be seen,
  // and no amount of light rescues an albedo that low under buildings that shadow it.
  const clinker = ['#3c3945', '#464151', '#35323d', '#504a5c'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = clinker[(rng() * clinker.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // Vitrified patches, where it ran before it set.
  if (rng() < 0.45) {
    ctx.fillStyle = '#565060';
    ctx.fillRect(px + ((rng() * 10) | 0), py + ((rng() * 10) | 0), 4 + ((rng() * 4) | 0), 2);
  }

  // One ember in roughly every fifth tile, and never more than one.
  if (rng() < 0.22) {
    ctx.fillStyle = rng() < 0.5 ? '#9c4a1e' : '#c2661f';
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
  }
}

/**
 * Fallen ash -- the Caldera floor, and what settles in the Cinderworks yards.
 *
 * Pale grey and almost featureless, because that is what ash is: the interest has to come from
 * what is standing in it rather than from the ground itself. Drifts are laid as one tone per
 * row so the surface reads as *settled* rather than as noise.
 */
function paintAsh(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const fall = ['#494750', '#525059', '#434149', '#585661'];
  for (let y = 0; y < PX; y++) {
    const band = fall[(rng() * fall.length) | 0]!;
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = rng() < 0.18 ? fall[(rng() * fall.length) | 0]! : band;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // Cinders that fell through and did not burn out.
  ctx.fillStyle = '#2a2830';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

/**
 * Wet peat, for the Tallow Levels, Weeping Stile and the floor of Ward Seven's cistern.
 *
 * The trick is the sheen: standing water in the low spots, drawn as flat blue-grey pools with a
 * single bright pixel along the top edge. Without it the surface reads as mud, and mud and marsh
 * are the difference between ground you would cross and ground you would go round.
 */
function paintMarsh(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const peat = ['#3f3b30', '#4a4539', '#38352c', '#544d3d'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = peat[(rng() * peat.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // A pool in about half the tiles, never touching the edges -- one that ran to the tile border
  // would tile into a single impossible lake the width of the map.
  if (rng() < 0.5) {
    const w = 3 + ((rng() * 5) | 0);
    const h = 2 + ((rng() * 3) | 0);
    const ox = 2 + ((rng() * (PX - 4 - w)) | 0);
    const oy = 2 + ((rng() * (PX - 4 - h)) | 0);
    ctx.fillStyle = '#2f3a3c';
    ctx.fillRect(px + ox, py + oy, w, h);
    ctx.fillStyle = '#48585a';
    ctx.fillRect(px + ox + 1, py + oy, w - 2, 1);
  }

  // Sedge, pushing up through it.
  ctx.fillStyle = '#4a5238';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * (PX - 2)) | 0), 1, 2);
  }
}

/**
 * Dressed stone, for Highcourt and the Spire's processional.
 *
 * The one ground in the game that is *cut* rather than worn: big regular slabs ruled to a line.
 * It is meant to read as expensive and as maintained, which is the whole argument of the
 * district it belongs to -- the Magistracy paves what it uses.
 *
 * The joints sit on the tile edge rather than offset inside it, which is the opposite of what
 * `paintSidewalk` does and deliberately so: a walkway is laid by whoever could be made to lay
 * it, and this was surveyed. Two sides only, so neighbouring slabs share one groove.
 */
function paintFlagstone(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const stone = ['#5e6068', '#666870', '#585a62', '#6d6f78'];
  ctx.fillStyle = stone[(rng() * stone.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Faint mottling, so a whole plaza is not one flat colour.
  ctx.fillStyle = stone[(rng() * stone.length) | 0]!;
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 2, 1);
  }

  ctx.fillStyle = '#4a4c53';
  ctx.fillRect(px, py, PX, 1);
  ctx.fillRect(px, py, 1, PX);
  // A highlight under the joint, which is what makes it read as a cut edge and not a crack.
  ctx.fillStyle = '#787a83';
  ctx.fillRect(px, py + 1, PX, 1);
}

/**
 * Salt crust, for the pans at Saltglass.
 *
 * The brightest ground in the game, and it has to be: the whole place is named for glare. The
 * crust is drawn as plates rather than as noise -- salt dries in slabs and cracks between them,
 * and the cracks are what stop a bright surface reading as blank paper.
 */
function paintSalt(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  // Measured back from a first pass that averaged 184 of 255 -- brighter than any other
  // ground in the game by fifty, and bright enough that no lighting setting could stop the
  // pans blowing out. Still the palest thing anywhere, which is the whole point of the place,
  // but now by a margin rather than by an order.
  const crust = ['#96937f', '#a09d89', '#8b8875', '#a8a48f'];
  ctx.fillStyle = crust[(rng() * crust.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Plates, laid two or three to a tile.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = crust[(rng() * crust.length) | 0]!;
    ctx.fillRect(px + ((rng() * 10) | 0), py + ((rng() * 10) | 0), 4 + ((rng() * 5) | 0), 3 + ((rng() * 4) | 0));
  }

  // The cracks between them. Darker and thin, and deliberately not run to the tile edge --
  // a crack that reached the border would tile into a ruled grid across the whole pan.
  ctx.fillStyle = '#726f62';
  for (let i = 0; i < 2; i++) {
    const cx = 2 + ((rng() * (PX - 5)) | 0);
    const cy = 2 + ((rng() * (PX - 5)) | 0);
    if (rng() < 0.5) ctx.fillRect(px + cx, py + cy, 3 + ((rng() * 5) | 0), 1);
    else ctx.fillRect(px + cx, py + cy, 1, 3 + ((rng() * 5) | 0));
  }

  // Brine still standing in a hollow, once in a while.
  if (rng() < 0.16) {
    ctx.fillStyle = '#66746f';
    ctx.fillRect(px + ((rng() * 9) | 0) + 2, py + ((rng() * 9) | 0) + 2, 3, 2);
  }
}

/**
 * Leaf litter, for the Ashwood and the overgrown corners of Weeping Stile.
 *
 * Warmer and more broken up than grass, which is the distinction that matters: grass is a
 * surface and litter is a pile of separate things. Drawn as overlapping leaf-sized rectangles
 * over a dark humus base rather than per-pixel noise, so it reads as *fallen* rather than as
 * grown.
 */
function paintForest(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  // Lifted from '#231e18'. Litter is dark, but at an albedo of 41 of 255 the Ashwood measured
  // a mean of 38 even with the sun and ambient pushed to the highest figures anywhere in the
  // game -- and a ground that needs extreme lighting to be visible is a ground that is wrong,
  // not lighting that is wrong. Still the darkest floor in the world by a clear margin.
  ctx.fillStyle = '#332c22';
  ctx.fillRect(px, py, PX, PX);

  const leaf = ['#4f4230', '#5c4b32', '#453f2b', '#685639', '#3b3826'];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = leaf[(rng() * leaf.length) | 0]!;
    const w = 2 + ((rng() * 3) | 0);
    const h = 1 + ((rng() * 2) | 0);
    ctx.fillRect(px + ((rng() * (PX - w)) | 0), py + ((rng() * (PX - h)) | 0), w, h);
  }

  // A root or a fallen twig, crossing the tile.
  if (rng() < 0.3) {
    ctx.fillStyle = '#3a3124';
    const y = 2 + ((rng() * (PX - 4)) | 0);
    ctx.fillRect(px, py + y, PX, 1);
  }

  // The green that still gets through.
  ctx.fillStyle = '#41522f';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

/**
 * Packed snow, for the Rimefields.
 *
 * The hard part of snow is that it is nearly white and must not be flat. The colour range here
 * is deliberately narrow -- four tones inside twelve values of each other -- and all the reading
 * comes from *shadow*: shallow blue hollows scooped out of the surface, which is what wind does
 * to old snow and what stops a bright ground looking like a hole in the render.
 *
 * Calibrated against the salt at Saltglass, which had to be darkened after it blew out at 184.
 * This sits below it on purpose: snow lying under an overcast is not brighter than a salt pan
 * in the sun, whatever the two look like in isolation.
 */
function paintSnow(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const pack = ['#8e94a0', '#979dab', '#868c98', '#9ea4b2'];
  ctx.fillStyle = pack[(rng() * pack.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Wind hollows: blue, soft-edged by being drawn in two sizes rather than by blurring.
  for (let i = 0; i < 2; i++) {
    const w = 4 + ((rng() * 6) | 0);
    const h = 2 + ((rng() * 3) | 0);
    const ox = ((rng() * (PX - w)) | 0);
    const oy = ((rng() * (PX - h)) | 0);
    ctx.fillStyle = '#7b8290';
    ctx.fillRect(px + ox, py + oy, w, h);
    ctx.fillStyle = '#727988';
    ctx.fillRect(px + ox + 1, py + oy + 1, w - 2, h - 1);
  }

  // Crust catching the light on the windward lip of a hollow.
  ctx.fillStyle = '#adb3c0';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 2, 1);
  }
}

/**
 * Glare ice, for where the Rimefields have been swept down to it.
 *
 * Darker than the snow around it, not lighter -- which is counter-intuitive and correct: ice is
 * transparent, so what you see is whatever is underneath, and what is underneath is not white.
 * The reading comes entirely from the cracks and from one hard specular streak per tile.
 */
function paintIce(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const sheet = ['#5c6a78', '#657482', '#556270', '#6d7c8a'];
  ctx.fillStyle = sheet[(rng() * sheet.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Pressure cracks, pale and branching. Kept clear of the tile edge so a field of ice does not
  // acquire a ruled grid.
  ctx.fillStyle = '#8fa0b0';
  for (let i = 0; i < 2; i++) {
    const cx = 3 + ((rng() * (PX - 7)) | 0);
    const cy = 3 + ((rng() * (PX - 7)) | 0);
    const len = 3 + ((rng() * 5) | 0);
    if (rng() < 0.5) {
      ctx.fillRect(px + cx, py + cy, len, 1);
      ctx.fillRect(px + cx + (len >> 1), py + cy, 1, 2 + ((rng() * 3) | 0));
    } else {
      ctx.fillRect(px + cx, py + cy, 1, len);
      ctx.fillRect(px + cx, py + cy + (len >> 1), 2 + ((rng() * 3) | 0), 1);
    }
  }

  // The shine. One streak, and only on some tiles, or the whole sheet glitters like water.
  if (rng() < 0.4) {
    ctx.fillStyle = '#b6c4d2';
    ctx.fillRect(px + 2 + ((rng() * 8) | 0), py + 2 + ((rng() * 10) | 0), 4 + ((rng() * 3) | 0), 1);
  }
}

/**
 * Scorched rock, for the Storm Shelf.
 *
 * Ground that has been struck, repeatedly, for a long time. Dark and hard, with fulgurite --
 * the glassy scar lightning leaves in stone -- drawn as pale branching lines. They are rare on
 * purpose: one tile in four. A surface covered in them reads as cracked mud, and the point is
 * that each one was an event.
 */
function paintBlasted(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const rock = ['#403f47', '#4a4951', '#3a3941', '#54525b'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = rock[(rng() * rock.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }

  // Scorching, in patches.
  if (rng() < 0.5) {
    ctx.fillStyle = '#2b2a30';
    ctx.fillRect(px + ((rng() * 9) | 0), py + ((rng() * 9) | 0), 4 + ((rng() * 4) | 0), 3 + ((rng() * 3) | 0));
  }

  // Fulgurite: a forked line, once in a while.
  if (rng() < 0.26) {
    ctx.fillStyle = '#9a90a8';
    let x = 3 + ((rng() * (PX - 6)) | 0);
    let y = 2;
    while (y < PX - 2) {
      ctx.fillRect(px + x, py + y, 1, 1);
      x += (rng() * 3 | 0) - 1;
      x = Math.max(1, Math.min(PX - 2, x));
      y += 1;
    }
  }
}

/**
 * Bone dust, for the country around the Bastion.
 *
 * Pale, dry and dead -- chalk's colour with the warmth taken out of it, which is the whole
 * distinction: chalk is a road you travel and this is what a road looks like after nothing has
 * travelled it for a very long time. Fragments rather than grain, so the ground reads as made
 * of pieces of something.
 */
function paintBone(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const dust = ['#8b8a80', '#95948a', '#817f76', '#9e9d92'];
  ctx.fillStyle = dust[(rng() * dust.length) | 0]!;
  ctx.fillRect(px, py, PX, PX);

  // Fragments, laid flat and at angles implied by their aspect rather than by rotation.
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = dust[(rng() * dust.length) | 0]!;
    const long = 2 + ((rng() * 4) | 0);
    if (rng() < 0.5) ctx.fillRect(px + ((rng() * (PX - long)) | 0), py + ((rng() * (PX - 1)) | 0), long, 1);
    else ctx.fillRect(px + ((rng() * (PX - 1)) | 0), py + ((rng() * (PX - long)) | 0), 1, long);
  }

  // The dark between them.
  ctx.fillStyle = '#615f58';
  for (let i = 0; i < 4; i++) ctx.fillRect(px + ((rng() * PX) | 0), py + ((rng() * PX) | 0), 1, 1);
}

function paintGrass(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const palette = ['#232b21', '#2a3327', '#1e251c', '#303a2c'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = palette[(rng() * palette.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

/**
 * The whole ground, baked off one area's map in a single pass.
 *
 * One texture and one draw call. The curb — a warm line on the walkway side of every
 * safe/danger border — is drawn last, over the tiles, because it is the player's first and
 * quietest lesson in where the rule changes.
 *
 * The curb asks the **legend** whether a tile is safe rather than comparing the character to
 * `'S'`. That literal was correct while one grid existed and would have drawn a curb around
 * nothing in any area that spells its pavement differently — or, worse, around the wrong
 * tiles. The rule is "mark where safety ends", and safety is a property in the legend.
 */
export function bakeGround(area: AreaDef, maxAnisotropy: number): THREE.Texture {
  const row0 = waterRowsOf(area);
  const { c, ctx } = makeCanvas(area.cols * PX, groundRowsOf(area) * PX);
  const rng = mulberry32(1337);

  const safeAt = (r: number, cc: number): boolean => {
    if (r < 0 || r >= area.rows || cc < 0 || cc >= area.cols) return false;
    return area.legend[area.grid[r]![cc]!]?.safe === true;
  };

  for (let row = row0; row < area.rows; row++) {
    for (let col = 0; col < area.cols; col++) {
      const px = col * PX;
      const py = (row - row0) * PX;
      const tex = area.legend[area.grid[row]![col]!]?.tex ?? 'water';
      // Unknown paint falls back to cobbles rather than throwing, which is the stance the
      // header takes: a legend typo should look wrong, not end the ward.
      (PAINTS[tex as GroundTex] ?? PAINTS.cobble)(ctx, px, py, rng);
    }
  }

  ctx.fillStyle = '#b09263';
  for (let row = row0; row < area.rows; row++) {
    for (let col = 0; col < area.cols; col++) {
      if (!safeAt(row, col)) continue;
      const px = col * PX;
      const py = (row - row0) * PX;
      if (!safeAt(row - 1, col)) ctx.fillRect(px, py, PX, 2);
      if (!safeAt(row + 1, col)) ctx.fillRect(px, py + PX - 2, PX, 2);
      if (!safeAt(row, col - 1)) ctx.fillRect(px, py, 2, PX);
      if (!safeAt(row, col + 1)) ctx.fillRect(px + PX - 2, py, 2, PX);
    }
  }

  const t = canvasTexture(c);
  // Nearest magnification keeps the pixels hard; mipmaps stop the far end of the street
  // from shimmering as the camera moves.
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = maxAnisotropy;
  t.needsUpdate = true;
  return t;
}

/** The dull plane under everything, so the ward never terminates in visible void. */
export function makeOutskirtsTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(16, 16);
  const rng = mulberry32(55);
  const palette = ['#1d211c', '#22261f', '#191d18', '#262b22'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = palette[(rng() * palette.length) | 0]!;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(65, 65);
  return t;
}

/* ============================================================
   Structures and props
   ============================================================ */

export function makeWallTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(16, 16);
  const rng = mulberry32(7);
  ctx.fillStyle = '#4a3c35';
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 1) {
      if (rng() < 0.25) {
        ctx.fillStyle = '#55453c';
        ctx.fillRect(x, y + 1, 1, 3);
      }
    }
  }
  ctx.fillStyle = '#241d19';
  for (let y = 0; y < 16; y += 4) {
    ctx.fillRect(0, y, 16, 1);
    ctx.fillRect((y / 4) % 2 ? 4 : 11, y, 1, 4);
  }
  // Soot climbing the lower courses.
  for (let y = 10; y < 16; y++) {
    ctx.fillStyle = `rgba(10,8,10,${(y - 9) * 0.07})`;
    ctx.fillRect(0, y, 16, 1);
  }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeWaterTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(32, 16);
  const rng = mulberry32(19);
  const palette = ['#16292c', '#1b3337', '#122225', '#203d41'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      ctx.fillStyle = palette[(rng() * palette.length) | 0]!;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Ripple crests, deliberate bloom bait: without them the canal is a hole at the top of
  // the frame, because no lamp reaches that far.
  for (let i = 0; i < 7; i++) {
    const y = (rng() * 16) | 0;
    const x = (rng() * 26) | 0;
    ctx.fillStyle = rng() < 0.4 ? '#8ab4b2' : '#5d8583';
    ctx.fillRect(x, y, 3 + ((rng() * 4) | 0), 1);
  }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 2);
  return t;
}

export function makeTreeTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 32);
  ctx.fillStyle = '#2a1e16';
  ctx.fillRect(10, 20, 4, 12);
  const greens = ['#1a2c1e', '#233a26', '#2c472f'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = greens[i]!;
    ctx.fillRect(3 + i, 4 + i * 5, 18 - i * 2, 10 - i);
  }
  return canvasTexture(c);
}

export function makeCrateTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#4a3b28';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#5c4a33';
  ctx.fillRect(1, 1, 14, 14);
  ctx.fillStyle = '#332818';
  ctx.fillRect(0, 7, 16, 2);
  ctx.fillRect(7, 0, 2, 16);
  return canvasTexture(c);
}

/* ============================================================
   Dressing — the furniture of a ward

   One factory per kind in `district/dressing.ts`. Small canvases, nearest-filtered, no
   smoothing: the environment in this game is pixel art and these belong to it.

   Drawn to three rules, which is the difference between a shape and a prop:

   1. **One light, and it is the scene's.** `world.ts` puts the sun at `(-12, 18, +10)` — west,
      high, slightly in front — so on a billboard that reads as light from the upper left. Every
      highlight here is up-left and every shadow down-right. A prop lit from the other side
      reads as pasted on, and at this size that is the only cue the eye has.
   2. **Four tones per material, never one.** A flat fill is what makes a barrel a brown
      rectangle. `ramp()` derives highlight/light/mid/shadow from a single base so a material is
      one decision rather than four.
   3. **A dark edge, and a contact shadow.** Cheap, and it does more than either deserves: the
      edge separates the prop from whatever ground it stands on, and the shadow stops it
      floating. `outline()` finds the silhouette rather than being drawn by hand, so it is right
      for free whatever shape is above it.

   Everything is drawn facing south, because that is what `DressingSpec.yaw` measures from.
   ============================================================ */

/** A material's tones, from one base colour. Index 0 is the highlight, 4 the outline. */
type Ramp = readonly [string, string, string, string, string];

/**
 * Five tones from one hex.
 *
 * Scaled in RGB rather than converted to HSL: at these sizes the difference is invisible and
 * the arithmetic is four lines instead of forty. The steps are deliberately wide — a subtle
 * ramp reads as one colour on a 16px canvas seen from 22 units away.
 */
function ramp(hex: string): Ramp {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const at = (k: number): string => {
    const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  };
  return [at(1.42), at(1.18), at(1), at(0.74), at(0.42)];
}

/**
 * Traces a one-pixel edge around everything already drawn.
 *
 * Reads the alpha back rather than being drawn by hand, so it fits whatever shape it is given
 * and cannot fall out of step with it. Called last, always — anything drawn afterwards would
 * sit on top of its own outline.
 */
function outline(ctx: CanvasRenderingContext2D, w: number, h: number, colour: string): void {
  const src = ctx.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3]! > 128;
  ctx.fillStyle = colour;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** A soft dark ellipse under a prop, so it sits on the ground instead of hovering over it. */
function contact(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(12,10,9,0.42)';
  ctx.fillRect(cx - w / 2, y, w, 1);
  ctx.fillStyle = 'rgba(12,10,9,0.22)';
  ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 1);
}

/**
 * A standing cylinder — barrel, bollard, post.
 *
 * The whole trick is four vertical bands, widest at the lit edge: that is what a round thing
 * looks like when you only have four colours, and it is why a barrel drawn as stripes on a flat
 * fill never reads as round no matter how many stripes it has.
 */
function cylinder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: Ramp): void {
  const bands: [number, number][] = [
    [0, 0.22],
    [0.22, 0.58],
    [0.58, 0.84],
    [0.84, 1],
  ];
  const tone = [t[1], t[0], t[2], t[3]];
  bands.forEach(([a, b], i) => {
    ctx.fillStyle = tone[i]!;
    ctx.fillRect(x + Math.round(w * a), y, Math.max(1, Math.round(w * (b - a))), h);
  });
}

/** A heap: lit on the upper left, dark on the lower right, irregular along the top. */
function mound(ctx: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number, t: Ramp, rng: () => number): void {
  for (let i = 0; i < w; i++) {
    const x = cx - w / 2 + i;
    const across = i / (w - 1);
    // A cosine profile, roughed up a little so it is a heap and not a hill on a graph.
    const top = base - Math.round(h * Math.cos((across - 0.5) * Math.PI) * (0.82 + rng() * 0.3));
    ctx.fillStyle = across < 0.34 ? t[1] : across < 0.62 ? t[2] : t[3];
    ctx.fillRect(x, top, 1, base - top);
    if (across < 0.5 && rng() < 0.4) {
      ctx.fillStyle = t[0]!;
      ctx.fillRect(x, top, 1, 1);
    }
  }
}

/** Staves, hoops, and a lid you can see the near edge of. */
export function makeBarrelTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(18, 22);
  const wood = ramp('#6b4a2c');
  const iron = ramp('#3c3a38');
  cylinder(ctx, 1, 2, 16, 19, wood);
  // Hoops, dark against the staves and following the same lit edge.
  for (const y of [4, 11, 18]) {
    ctx.fillStyle = iron[2]!;
    ctx.fillRect(1, y, 16, 2);
    ctx.fillStyle = iron[1]!;
    ctx.fillRect(2, y, 4, 1);
  }
  // The lid, seen slightly from above — the camera looks down at 50 degrees.
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(2, 1, 14, 2);
  ctx.fillStyle = wood[0]!;
  ctx.fillRect(3, 1, 5, 1);
  contact(ctx, 9, 21, 15);
  outline(ctx, 18, 22, wood[4]!);
  return canvasTexture(c);
}

/** Two sacks, slumped, tied at the neck. */
export function makeSacksTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(22, 18);
  const hemp = ramp('#9a8760');
  const sack = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = hemp[2]!;
    ctx.fillRect(x, y + 2, w, h - 2);
    ctx.fillStyle = hemp[1]!;
    ctx.fillRect(x, y + 2, Math.ceil(w * 0.4), h - 2);
    ctx.fillStyle = hemp[0]!;
    ctx.fillRect(x + 1, y + 3, 2, Math.max(1, h - 6));
    ctx.fillStyle = hemp[3]!;
    ctx.fillRect(x + w - 2, y + 3, 2, h - 3);
    // The tied neck, which is the thing that says sack rather than bag of nothing.
    ctx.fillStyle = hemp[3]!;
    ctx.fillRect(x + Math.floor(w / 2) - 2, y, 4, 3);
    ctx.fillStyle = hemp[1]!;
    ctx.fillRect(x + Math.floor(w / 2) - 1, y, 2, 2);
  };
  sack(1, 3, 11, 15);
  sack(11, 6, 10, 12);
  contact(ctx, 11, 17, 20);
  outline(ctx, 22, 18, hemp[4]!);
  return canvasTexture(c);
}

/** A bale, banded twice, with the cut ends showing. */
export function makeHaybaleTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(22, 16);
  const straw = ramp('#a8904a');
  const rng = mulberry32(3311);
  ctx.fillStyle = straw[2]!;
  ctx.fillRect(1, 1, 20, 14);
  ctx.fillStyle = straw[1]!;
  ctx.fillRect(1, 1, 20, 5);
  ctx.fillStyle = straw[0]!;
  ctx.fillRect(2, 1, 12, 2);
  ctx.fillStyle = straw[3]!;
  ctx.fillRect(1, 12, 20, 3);
  // Cut stems, so the face has grain rather than being a flat slab.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = rng() < 0.5 ? straw[0]! : straw[3]!;
    ctx.fillRect(2 + ((rng() * 18) | 0), 2 + ((rng() * 12) | 0), 2, 1);
  }
  const twine = ramp('#4a3a1e');
  for (const x of [5, 15]) {
    ctx.fillStyle = twine[2]!;
    ctx.fillRect(x, 1, 2, 14);
    ctx.fillStyle = twine[1]!;
    ctx.fillRect(x, 1, 1, 14);
  }
  contact(ctx, 11, 15, 20);
  outline(ctx, 22, 16, straw[4]!);
  return canvasTexture(c);
}

/** Striped cloth over a stall, sagging between its poles. */
export function makeAwningTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(28, 14);
  const red = ramp('#8d4436');
  const cream = ramp('#c3b394');
  for (let x = 0; x < 28; x += 4) {
    const t = (x / 4) % 2 === 0 ? red : cream;
    // Each stripe sags a pixel toward the middle, which is what makes it cloth.
    const sag = Math.round(Math.sin((x / 28) * Math.PI) * 2);
    ctx.fillStyle = t[2]!;
    ctx.fillRect(x, 1 + sag, 4, 9);
    ctx.fillStyle = t[1]!;
    ctx.fillRect(x, 1 + sag, 4, 3);
    ctx.fillStyle = t[3]!;
    ctx.fillRect(x, 8 + sag, 4, 2);
  }
  // The scalloped hem.
  for (let x = 0; x < 28; x += 4) {
    const sag = Math.round(Math.sin((x / 28) * Math.PI) * 2);
    ctx.fillStyle = ((x / 4) % 2 === 0 ? red : cream)[3]!;
    ctx.fillRect(x + 1, 10 + sag, 2, 2);
  }
  outline(ctx, 28, 14, red[4]!);
  return canvasTexture(c);
}

/** Post and rail, the posts rounded and the rails running behind them. */
export function makeFenceTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 16);
  const wood = ramp('#6a5333');
  // Rails first, so the posts read as standing in front of them.
  for (const y of [4, 9]) {
    ctx.fillStyle = wood[2]!;
    ctx.fillRect(0, y, 24, 3);
    ctx.fillStyle = wood[1]!;
    ctx.fillRect(0, y, 24, 1);
    ctx.fillStyle = wood[3]!;
    ctx.fillRect(0, y + 2, 24, 1);
  }
  for (const x of [2, 19]) cylinder(ctx, x, 0, 4, 16, wood);
  contact(ctx, 12, 15, 22);
  outline(ctx, 24, 16, wood[4]!);
  return canvasTexture(c);
}

/** Livestock hurdles: lower than a fence, closer barred, and woven. */
export function makePensTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 13);
  const wood = ramp('#6a5333');
  for (const y of [3, 8]) {
    ctx.fillStyle = wood[2]!;
    ctx.fillRect(0, y, 24, 2);
    ctx.fillStyle = wood[1]!;
    ctx.fillRect(0, y, 24, 1);
  }
  for (let x = 1; x < 24; x += 5) cylinder(ctx, x, 0, 3, 13, wood);
  contact(ctx, 12, 12, 22);
  outline(ctx, 24, 13, wood[4]!);
  return canvasTexture(c);
}

/** A parked cart: bed, spoked wheel, shafts down. */
export function makeCartTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(26, 20);
  const wood = ramp('#6b512f');
  const iron = ramp('#39373a');
  // Bed and side board.
  ctx.fillStyle = wood[2]!;
  ctx.fillRect(2, 4, 22, 8);
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(2, 4, 22, 3);
  ctx.fillStyle = wood[0]!;
  ctx.fillRect(3, 4, 9, 1);
  ctx.fillStyle = wood[3]!;
  ctx.fillRect(2, 10, 22, 2);
  // Planking.
  ctx.fillStyle = wood[3]!;
  for (let x = 6; x < 24; x += 5) ctx.fillRect(x, 5, 1, 6);
  // Shaft, angled down to the ground the way a parked cart rests.
  ctx.fillStyle = wood[2]!;
  ctx.fillRect(23, 8, 3, 2);
  // Wheel: rim, hub, four spokes. The spokes are what stop it being a dark circle.
  const cx = 8;
  const cy = 14;
  ctx.fillStyle = iron[2]!;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wood[3]!;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = iron[1]!;
  ctx.fillRect(cx - 4, cy, 9, 1);
  ctx.fillRect(cx, cy - 4, 1, 9);
  ctx.fillStyle = iron[0]!;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
  contact(ctx, 13, 19, 22);
  outline(ctx, 26, 20, wood[4]!);
  return canvasTexture(c);
}

/** An iron basket with a fire in it. The only prop that is its own light source. */
export function makeBrazierTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(20, 24);
  const iron = ramp('#3a3634');
  // Legs, splayed.
  ctx.fillStyle = iron[2]!;
  ctx.fillRect(4, 15, 2, 8);
  ctx.fillRect(14, 15, 2, 8);
  ctx.fillStyle = iron[1]!;
  ctx.fillRect(4, 15, 1, 8);
  // The basket, tapering, with bars.
  ctx.fillStyle = iron[2]!;
  ctx.fillRect(3, 10, 14, 6);
  ctx.fillStyle = iron[1]!;
  ctx.fillRect(3, 10, 14, 2);
  ctx.fillStyle = iron[3]!;
  for (let x = 5; x < 17; x += 3) ctx.fillRect(x, 11, 1, 5);
  // Fire: three tones, the hottest smallest and highest. Drawn after the iron so it spills over
  // the rim, which is what stops it looking like a bowl with paint in it.
  ctx.fillStyle = '#8c2f14';
  ctx.fillRect(4, 6, 12, 5);
  ctx.fillStyle = '#d9643a';
  ctx.fillRect(6, 3, 8, 7);
  ctx.fillStyle = '#f0a85c';
  ctx.fillRect(8, 1, 4, 7);
  ctx.fillStyle = '#ffe8b0';
  ctx.fillRect(9, 0, 2, 4);
  contact(ctx, 10, 23, 14);
  outline(ctx, 20, 24, iron[4]!);
  return canvasTexture(c);
}

/** A stone rim, a crossbeam, and a bucket over the dark. */
export function makeWellTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(22, 24);
  const stone = ramp('#7a7266');
  const wood = ramp('#6a5333');
  const rng = mulberry32(771);
  // Posts and beam.
  for (const x of [2, 17]) cylinder(ctx, x, 2, 3, 12, wood);
  ctx.fillStyle = wood[2]!;
  ctx.fillRect(1, 1, 20, 3);
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(1, 1, 20, 1);
  // The bucket, hanging.
  ctx.fillStyle = wood[3]!;
  ctx.fillRect(9, 6, 4, 4);
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(9, 6, 1, 4);
  // The rim, coursed, each stone shaded on its own.
  for (let y = 14; y < 23; y += 3) {
    for (let x = 1; x < 21; x += 4) {
      ctx.fillStyle = rng() < 0.5 ? stone[2]! : stone[1]!;
      ctx.fillRect(x, y, 3, 2);
      ctx.fillStyle = stone[3]!;
      ctx.fillRect(x, y + 2, 4, 1);
    }
  }
  // The shaft. Black, because that is the point of a well.
  ctx.fillStyle = '#0d0c0b';
  ctx.fillRect(5, 13, 12, 3);
  contact(ctx, 11, 23, 20);
  outline(ctx, 22, 24, stone[4]!);
  return canvasTexture(c);
}

/** Low, long, and holding water that catches the sky. */
export function makeTroughTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 12);
  const wood = ramp('#6a5333');
  ctx.fillStyle = wood[2]!;
  ctx.fillRect(0, 2, 24, 9);
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(0, 2, 24, 2);
  ctx.fillStyle = wood[3]!;
  ctx.fillRect(0, 9, 24, 2);
  ctx.fillStyle = wood[3]!;
  ctx.fillRect(1, 4, 1, 6);
  ctx.fillRect(22, 4, 1, 6);
  // Water, lighter along the far edge where the sky is in it.
  ctx.fillStyle = '#31474f';
  ctx.fillRect(2, 3, 20, 4);
  ctx.fillStyle = '#4a6b74';
  ctx.fillRect(2, 3, 20, 1);
  ctx.fillStyle = '#6d949c';
  ctx.fillRect(4, 3, 6, 1);
  contact(ctx, 12, 11, 22);
  outline(ctx, 24, 12, wood[4]!);
  return canvasTexture(c);
}

/** A drying frame with things hung off it — nets, hides, herbs. */
export function makeRackTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 26);
  const wood = ramp('#6a5333');
  const rng = mulberry32(4242);
  for (const x of [1, 20]) cylinder(ctx, x, 0, 3, 26, wood);
  ctx.fillStyle = wood[2]!;
  ctx.fillRect(0, 1, 24, 3);
  ctx.fillStyle = wood[1]!;
  ctx.fillRect(0, 1, 24, 1);
  // What is hanging. Varied lengths and two cloths, so it is a rack in use.
  const cloth = [ramp('#7d7360'), ramp('#6b6a52'), ramp('#8a7a5c')];
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 4;
    const len = 8 + ((rng() * 11) | 0);
    const t = cloth[(rng() * cloth.length) | 0]!;
    ctx.fillStyle = t[2]!;
    ctx.fillRect(x, 4, 3, len);
    ctx.fillStyle = t[1]!;
    ctx.fillRect(x, 4, 1, len);
    ctx.fillStyle = t[3]!;
    ctx.fillRect(x + 2, 4, 1, len);
  }
  contact(ctx, 12, 25, 20);
  outline(ctx, 24, 26, wood[4]!);
  return canvasTexture(c);
}

/** A line strung between windows, hung high enough to walk under. */
export function makeWashingTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(30, 14);
  ctx.fillStyle = '#2e2a24';
  // The line dips, because a taut washing line is a wire.
  for (let x = 0; x < 30; x++) {
    ctx.fillRect(x, 1 + Math.round(Math.sin((x / 30) * Math.PI) * 2), 1, 1);
  }
  const cloths = ['#8f8574', '#6e7a72', '#94836a', '#5f6570', '#7f7462'];
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 6;
    const t = ramp(cloths[i]!);
    const dip = 1 + Math.round(Math.sin((x / 30) * Math.PI) * 2);
    const len = 6 + ((i * 3) % 5);
    ctx.fillStyle = t[2]!;
    ctx.fillRect(x, dip, 5, len);
    ctx.fillStyle = t[1]!;
    ctx.fillRect(x, dip, 2, len);
    ctx.fillStyle = t[3]!;
    ctx.fillRect(x + 4, dip, 1, len);
    // A pegged corner, so it hangs from the line rather than floating below it.
    ctx.fillStyle = t[0]!;
    ctx.fillRect(x + 1, dip, 1, 1);
  }
  outline(ctx, 30, 14, '#1d1a16');
  return canvasTexture(c);
}

/** Stacked stones, each one lit on its own. */
export function makeCairnTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(18, 20);
  const stone = ramp('#6f6a61');
  const rng = mulberry32(919);
  // Widest at the bottom and offset a little each course, which is what makes it stacked by
  // hand rather than a staircase.
  // Deliberately not centred. A cairn built as a symmetric pyramid reads as a ziggurat; the
  // courses lean, because somebody put these here one at a time and did not measure.
  const courses: [number, number, number][] = [
    [2, 15, 14],
    [4, 11, 11],
    [3, 8, 9],
    [6, 5, 7],
    [5, 2, 4],
  ];
  for (const [x, y, w] of courses) {
    const h = 3 + ((rng() * 2) | 0);
    ctx.fillStyle = stone[2]!;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = stone[1]!;
    ctx.fillRect(x, y, Math.ceil(w * 0.45), h - 1);
    ctx.fillStyle = stone[0]!;
    ctx.fillRect(x + 1, y, 2, 1);
    ctx.fillStyle = stone[3]!;
    ctx.fillRect(x, y + h - 1, w, 1);
  }
  contact(ctx, 9, 19, 15);
  outline(ctx, 18, 20, stone[4]!);
  return canvasTexture(c);
}

/** What came out of the ground and was not wanted. */
export function makeSpoilheapTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(28, 14);
  const spoil = ramp('#584c40');
  const rng = mulberry32(1717);
  mound(ctx, 14, 13, 26, 11, spoil, rng);
  // Lumps in it, so the heap has grain rather than being a smooth cone.
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = rng() < 0.5 ? spoil[0]! : spoil[3]!;
    ctx.fillRect(3 + ((rng() * 22) | 0), 5 + ((rng() * 8) | 0), 2, 1);
  }
  contact(ctx, 14, 13, 26);
  outline(ctx, 28, 14, spoil[4]!);
  return canvasTexture(c);
}

/** Cut timber, stacked end-on to season. */
export function makeLogpileTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 18);
  const bark = ramp('#4a3a28');
  const cut = ramp('#9a7c52');
  const rng = mulberry32(2323);
  ctx.fillStyle = bark[3]!;
  ctx.fillRect(1, 2, 22, 15);
  // Rounds, offset course by course so they nest the way stacked logs do.
  for (let row = 0; row < 4; row++) {
    const y = 3 + row * 4;
    const off = row % 2 ? 2 : 0;
    for (let x = 2 + off; x < 22; x += 4) {
      ctx.fillStyle = bark[2]!;
      ctx.beginPath();
      ctx.arc(x + 1.5, y + 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rng() < 0.5 ? cut[2]! : cut[1]!;
      ctx.beginPath();
      ctx.arc(x + 1.5, y + 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // The heartwood, one pixel, up-left of centre so even a log is lit.
      ctx.fillStyle = cut[0]!;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  contact(ctx, 12, 17, 22);
  outline(ctx, 24, 18, bark[4]!);
  return canvasTexture(c);
}

/** A burn mark. Nothing here is lit, because nothing here is standing up. */
export function makeScorchTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(28, 28);
  const rng = mulberry32(9137);
  // Three rings rather than one disc, so the edge breaks up instead of drawing a circle.
  const rings: [number, string][] = [
    [11, 'rgba(24,19,16,0.80)'],
    [8, 'rgba(14,11,9,0.88)'],
    [5, 'rgba(8,6,5,0.94)'],
  ];
  for (const [r, colour] of rings) {
    ctx.fillStyle = colour;
    for (let a = 0; a < 96; a++) {
      const th = (a / 96) * Math.PI * 2;
      const rr = r * (0.82 + rng() * 0.3);
      ctx.fillRect(14 + Math.cos(th) * rr, 14 + Math.sin(th) * rr * 0.8, 3, 2);
    }
  }
  // Ash flecks at the rim, which is where the eye reads the edge.
  ctx.fillStyle = 'rgba(96,86,74,0.5)';
  for (let i = 0; i < 22; i++) {
    const th = rng() * Math.PI * 2;
    const rr = 9 + rng() * 4;
    ctx.fillRect(14 + Math.cos(th) * rr, 14 + Math.sin(th) * rr * 0.8, 1, 1);
  }
  return canvasTexture(c);
}

/** Quay and processional. Iron, capped, and scuffed where carts have hit it. */
export function makeBollardTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(12, 18);
  const iron = ramp('#43434c');
  cylinder(ctx, 3, 3, 6, 14, iron);
  // The domed cap, wider than the shaft.
  ctx.fillStyle = iron[2]!;
  ctx.fillRect(2, 1, 8, 3);
  ctx.fillStyle = iron[1]!;
  ctx.fillRect(2, 1, 4, 2);
  ctx.fillStyle = iron[0]!;
  ctx.fillRect(3, 1, 2, 1);
  // A scuff, because a bollard exists to be hit.
  ctx.fillStyle = iron[0]!;
  ctx.fillRect(4, 9, 1, 3);
  contact(ctx, 6, 17, 9);
  outline(ctx, 12, 18, iron[4]!);
  return canvasTexture(c);
}

/**
 * A carved marker, with a line cut into it.
 *
 * The wilds have no walls, so they have no graffiti, so they have had nothing to say. This is
 * how the Chalk Road and the barrows get a voice — and the atlas asked for it first, placing
 * waystone pairs at rows 5 and 7 of the road.
 */
export function makeWaystoneTexture(text: string): THREE.Texture {
  const w = Math.max(24, 12 + text.length * 6);
  const h = 30;
  const { c, ctx } = makeCanvas(w, h);
  const stone = ramp('#6f6a5f');
  const rng = mulberry32(555);
  // A tapered slab, wider at the foot, so it reads as set into the ground.
  for (let y = 2; y < h - 1; y++) {
    const inset = Math.round(((h - y) / h) * 3);
    ctx.fillStyle = stone[2]!;
    ctx.fillRect(1 + inset, y, w - 2 - inset * 2, 1);
    ctx.fillStyle = stone[1]!;
    ctx.fillRect(1 + inset, y, Math.max(2, (w - inset * 2) >> 2), 1);
  }
  ctx.fillStyle = stone[0]!;
  ctx.fillRect(4, 2, Math.max(3, w >> 3), 2);
  // Weathering, so the face is stone rather than card.
  for (let i = 0; i < w; i++) {
    ctx.fillStyle = rng() < 0.5 ? stone[1]! : stone[3]!;
    ctx.fillRect(2 + ((rng() * (w - 4)) | 0), 3 + ((rng() * (h - 6)) | 0), 2, 1);
  }
  // The cut. Drawn twice — a dark groove and a lit lower lip — because that is the difference
  // between letters carved into stone and letters printed on it.
  ctx.font = 'bold 9px monospace';
  ctx.textBaseline = 'middle';
  let jitter = 7;
  for (let i = 0; i < text.length; i++) {
    jitter = (Math.imul(jitter, 31) + text.charCodeAt(i)) >>> 0;
    const dy = ((jitter >>> 3) % 3) - 1;
    ctx.fillStyle = 'rgba(28,25,21,0.92)';
    ctx.fillText(text[i]!, 6 + i * 6, h / 2 + dy);
    ctx.fillStyle = stone[0]!;
    ctx.fillText(text[i]!, 6 + i * 6, h / 2 + dy + 1);
    ctx.fillStyle = 'rgba(28,25,21,0.92)';
    ctx.fillText(text[i]!, 6 + i * 6, h / 2 + dy);
  }
  contact(ctx, w / 2, h - 1, w - 4);
  outline(ctx, w, h, stone[4]!);
  return canvasTexture(c);
}

export const DRESSING_ART: Record<Exclude<DressingId, 'waystone'>, () => THREE.Texture> = {
  barrel: makeBarrelTexture,
  sacks: makeSacksTexture,
  haybale: makeHaybaleTexture,
  awning: makeAwningTexture,
  fence: makeFenceTexture,
  cart: makeCartTexture,
  brazier: makeBrazierTexture,
  well: makeWellTexture,
  trough: makeTroughTexture,
  rack: makeRackTexture,
  washing: makeWashingTexture,
  cairn: makeCairnTexture,
  spoilheap: makeSpoilheapTexture,
  logpile: makeLogpileTexture,
  scorch: makeScorchTexture,
  bollard: makeBollardTexture,
  pens: makePensTexture,
};

export function makeGateTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(16, 24);
  ctx.fillStyle = '#14151a';
  for (let x = 1; x < 16; x += 4) ctx.fillRect(x, 0, 2, 24);
  ctx.fillStyle = '#7a5c2a';
  ctx.fillRect(0, 4, 16, 2);
  ctx.fillRect(0, 17, 16, 2);
  ctx.fillStyle = '#5ef2d6';
  ctx.fillRect(7, 10, 2, 2);
  return canvasTexture(c);
}

/**
 * The bounty board: a post and a sheaf of parchment.
 *
 * Deliberately the brightest unlit thing on the plaza. It is the one prop a new player has
 * to find without being told where it is.
 */
export function makeBoardTexture(): THREE.Texture {
  const { c, ctx } = makeCanvas(24, 20);
  ctx.fillStyle = '#3a2c1e';
  ctx.fillRect(0, 0, 24, 20);
  ctx.fillStyle = '#261c13';
  ctx.fillRect(0, 0, 24, 2);
  ctx.fillRect(0, 18, 24, 2);
  const rng = mulberry32(91);
  const papers = ['#cbbb96', '#ddcfae', '#b8a882'];
  for (let i = 0; i < 5; i++) {
    const px = 2 + ((rng() * 15) | 0);
    const py = 3 + ((rng() * 10) | 0);
    ctx.fillStyle = papers[(rng() * papers.length) | 0]!;
    ctx.fillRect(px, py, 5, 6);
    ctx.fillStyle = '#6a5c44';
    ctx.fillRect(px + 1, py + 2, 3, 1);
    ctx.fillRect(px + 1, py + 4, 3, 1);
  }
  return canvasTexture(c);
}

/**
 * The Warden, drawn rather than painted.
 *
 * The one body in the ward with no art on disk, and the only one that should not have any:
 * every painted sprite in this game is somebody the player can end up standing beside, and
 * the Warden is furniture with a lamp for a face. A hard-edged pixel silhouette says that
 * about it before it has moved, and the amber visor is the one mark that has to survive
 * being read across a dark yard.
 */
export function makeWardenTexture(facing: 'front' | 'back' | 'side'): THREE.Texture {
  const { c, ctx } = makeCanvas(16, 26);
  const coat = '#191a20';
  const brass = '#c8973a';
  const skin = '#c9a684';

  ctx.fillStyle = '#101116';
  ctx.fillRect(3, 1, 10, 4); // tall hat
  ctx.fillRect(2, 5, 12, 1); // brim
  ctx.fillStyle = skin;
  ctx.fillRect(5, 6, 6, 5); // face
  ctx.fillStyle = coat;
  ctx.fillRect(3, 11, 10, 11); // long coat
  ctx.fillRect(2, 12, 1, 7);
  ctx.fillRect(13, 12, 1, 7); // shoulders
  ctx.fillStyle = brass;
  for (let y = 12; y < 21; y += 3) ctx.fillRect(8, y, 1, 1);
  ctx.fillStyle = '#0c0d11';
  ctx.fillRect(5, 22, 3, 4);
  ctx.fillRect(9, 22, 3, 4);

  if (facing === 'back') {
    ctx.fillStyle = '#101116';
    ctx.fillRect(5, 6, 6, 5); // the back of the head, no lamp
  } else if (facing === 'side') {
    ctx.fillStyle = '#ffb43a';
    ctx.fillRect(8, 8, 3, 1);
  } else {
    ctx.fillStyle = '#ffb43a';
    ctx.fillRect(5, 8, 6, 1);
  }
  return canvasTexture(c);
}

/**
 * A door plaque, drawn per trade.
 *
 * The glyph is one shape per door — a bench, a book, a flask, a paw — at a size where
 * silhouette is the only thing that survives, which is exactly what a sign has to be.
 */
/**
 * A line of wall-scrawl, chalked in the hand that writes on every gutter wall in Jolrek.
 *
 * The campaign's first clue layer (doc §2): sidewalks suppress combat, so they are where
 * a player *reads* — and this is what they read. Rendered rough on purpose: each glyph is
 * jittered off the baseline so the same font never quite reads as a font.
 */
export function makeGraffitiTexture(text: string): THREE.Texture {
  const w = 12 + text.length * 11;
  const { c, ctx } = makeCanvas(w, 28);
  ctx.font = 'bold 15px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#cfc7b8';
  // Deterministic jitter, seeded off the character codes — same text, same scrawl.
  let h = 5;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
    const dy = ((h >>> 3) % 5) - 2;
    ctx.fillText(text[i]!, 6 + i * 11, 14 + dy);
  }
  return canvasTexture(c);
}

export function makeSignTexture(key: string): THREE.Texture {
  const { c, ctx } = makeCanvas(20, 12);
  ctx.fillStyle = '#141118';
  ctx.fillRect(0, 0, 20, 12);
  ctx.fillStyle = '#2a2230';
  ctx.fillRect(1, 1, 18, 10);

  ctx.fillStyle = '#ffffff';
  if (key === 'artificer') {
    ctx.fillRect(6, 7, 8, 2); // anvil base
    ctx.fillRect(7, 4, 6, 3); // anvil body
    ctx.fillRect(13, 3, 3, 2); // horn
  } else if (key === 'journal') {
    ctx.fillRect(5, 3, 4, 7); // left leaf
    ctx.fillRect(11, 3, 4, 7); // right leaf
    ctx.fillRect(9, 2, 2, 8); // spine
  } else if (key === 'apothecary') {
    ctx.fillRect(9, 2, 2, 3); // neck
    ctx.fillRect(7, 5, 6, 5); // flask body
    ctx.fillRect(8, 1, 4, 1); // stopper
  } else {
    ctx.fillRect(8, 6, 5, 4); // paw pad
    ctx.fillRect(7, 3, 2, 2);
    ctx.fillRect(10, 2, 2, 2);
    ctx.fillRect(13, 4, 2, 2);
  }
  return canvasTexture(c);
}

/**
 * A pack minion, drawn rather than painted.
 *
 * The same argument `makeWardenTexture` makes and for the same reason: there is no minion art
 * on disk, every painted sprite in this game is somebody the player can stand beside, and a
 * thing on the road that exists to be fought is furniture. Hard pixels say that before it has
 * moved.
 *
 * Seeded off the pack, so one pack looks like itself every time you meet it and unlike the
 * pack down the road. Tinting is left to the caller — `BillboardSprite.setTint` multiplies the
 * material, so three members can differ visibly off one texture.
 */
export function makeMinionTexture(facing: 'front' | 'back' | 'side', seed: number): THREE.Texture {
  const { c, ctx } = makeCanvas(14, 22);
  const rng = mulberry32(seed);

  // A hood, a body and two legs, jittered per pack so the silhouettes are not identical.
  const cloth = ['#2b2a33', '#332e2c', '#26302c', '#312a24'][(rng() * 4) | 0]!;
  const trim = ['#6b5a3c', '#5d4a52', '#4a5a5c'][(rng() * 3) | 0]!;
  const hoodW = 6 + ((rng() * 3) | 0);
  const hoodX = ((14 - hoodW) / 2) | 0;

  ctx.fillStyle = cloth;
  ctx.fillRect(hoodX, 2, hoodW, 5); // hood
  ctx.fillRect(3, 7, 8, 10); // body
  ctx.fillRect(2, 8, 1, 6);
  ctx.fillRect(11, 8, 1, 6); // arms
  ctx.fillStyle = '#14151a';
  ctx.fillRect(4, 17, 3, 5);
  ctx.fillRect(8, 17, 3, 5); // legs

  ctx.fillStyle = trim;
  ctx.fillRect(3, 12, 8, 1); // belt

  if (facing === 'back') {
    ctx.fillStyle = cloth;
    ctx.fillRect(hoodX, 3, hoodW, 4); // no face on the way out
  } else {
    // One cold eye-line, the only mark that has to read across a dark road.
    ctx.fillStyle = '#c8683a';
    if (facing === 'side') ctx.fillRect(8, 4, 2, 1);
    else ctx.fillRect(hoodX + 1, 4, hoodW - 2, 1);
  }
  return canvasTexture(c);
}
