/**
 * The Commander and companion, as drawn on the diorama.
 *
 * Both are bitmaps now: `hero-{male,female}-front.png` for the Commander and
 * `companions/{id}-front.png` for the beast, loaded through the two caches below and drawn
 * by `blit`. This replaced an earlier procedural version (arcs and rects driven by
 * hair/face/skin presets); that system is gone along with the presets it read, not merely
 * unused.
 *
 * `drawCompanion` — one silhouette recoloured per school — survives as the fallback for a
 * species with no art yet, so a newly added bloodline renders as *something arrived* rather
 * than as nothing at all. Every founder has art, so nothing reaches it today.
 */

import { PALETTE } from './palette.js';
import type { Gender } from '../core/data/characterLook.js';
import type { School } from '../contract/ids.js';

/** A school's colour on the stage. The same six the enrolment crests use. */
export const SCHOOL_COLOR: Record<string, string> = {
  pyre: '#D9643A',
  frost: '#6FB6D8',
  surge: '#D9C04A',
  bulwark: '#9A9086',
  dusk: '#9A6FC4',
  bloom: '#79B45C',
};

/**
 * Which way the Commander is turned.
 *
 * All four are on disk for both bearings. `front` is the only one the creation screen ever
 * asks for — the figure there stands still and faces camera — but the district walks the
 * same body around a street, so it needs the other three. `side-alt` is the second frame
 * of the walk: the same profile with the legs swapped, alternated on distance travelled.
 *
 * There is no `left`. A left-facing Commander is `side` mirrored by the caller, because
 * drawing the same profile twice would be two files to keep in agreement for no gain.
 */
export type HeroFacing = 'front' | 'back' | 'side' | 'side-alt';

/**
 * Where the Commander's sprite lives, for a bearing and a facing. The counterpart to
 * `companionSpriteSrc`.
 *
 * Exported so a test can ask whether the file the loader will request is actually on disk,
 * under exactly that name. Worth checking rather than assuming: the art arrived as
 * capitalised exports (`Boreas-removebg-preview.png`) and was renamed down to lowercase, and
 * a case slip survives every Windows filesystem to fail only once it is served from Linux.
 */
export function commanderSpriteSrc(gender: Gender, facing: HeroFacing = 'front'): string {
  return `/assets/sprites/hero-${gender}-${facing}.png`;
}

const spriteCache = new Map<string, HTMLImageElement>();
const spriteLoading = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads (and caches) one facing of the Commander sprite.
 *
 * Call this once, ahead of the first `render()` that needs it — e.g. when the creation
 * screen mounts — and hold the resolved `HTMLImageElement` for `drawCommander`, which is
 * synchronous and cannot itself await a decode mid-frame. Calling it again for a facing
 * already loaded or loading returns the same promise/image rather than re-fetching.
 *
 * Keyed `${gender}:${facing}`, the same shape as the companion cache below: loading a
 * female front and a female back are independent entries rather than one clobbering the
 * other, which is what lets the district warm all eight frames in one `Promise.all`.
 */
export async function loadCommanderSprite(
  gender: Gender,
  facing: HeroFacing = 'front',
): Promise<HTMLImageElement> {
  return loadHeroImage(`${gender}:${facing}`, commanderSpriteSrc(gender, facing));
}

/**
 * Cache, dedupe, decode. Shared by the standing facings above and the walk frames below so
 * there is one answer to "is this already loading?" rather than two that can disagree.
 *
 * The key is the caller's to choose and the two namespaces do not collide: standing facings
 * are `${gender}:${facing}`, walk frames `${gender}:${facing}-walk-${n}`.
 */
function loadHeroImage(key: string, src: string): Promise<HTMLImageElement> {
  const cached = spriteCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = spriteLoading.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    spriteCache.set(key, img);
    return img;
  })();
  spriteLoading.set(key, promise);
  return promise;
}

/** The cached facing, if `loadCommanderSprite` has already resolved it. */
export function commanderSpriteIfLoaded(
  gender: Gender,
  facing: HeroFacing = 'front',
): HTMLImageElement | null {
  return spriteCache.get(`${gender}:${facing}`) ?? null;
}

/**
 * How tall each body stands, in tile units.
 *
 * Exported because two files have to agree about it: the blit below, and the `height` the
 * creation screen hands its diorama actor so `focusBand` knows where the head is. They were
 * separate literals — 1.7 drawn against a declared 1.15 — and the disagreement was invisible
 * until Step I pulled in close, at which point the sharp band stopped a fifth of a figure
 * short of the head it exists to keep sharp. One constant per body, read by both.
 */
export const COMMANDER_HEIGHT_TILES = 1.7;
export const COMPANION_HEIGHT_TILES = 1.1;

/**
 * The one place a bitmap actor is scaled and drawn. Feet at the origin, upright — the same
 * convention every other actor on the diorama uses, and `Diorama.ts` neither knows nor cares
 * that these are `drawImage` calls instead of shapes.
 *
 * Smoothing is **on**, which reverses the rule the procedural sprite was drawn under. That
 * rule was right for what it governed: a small buffer of hand-placed pixels blown up whole
 * numbers of times, where interpolation could only soften marks that were already exact.
 * This art is not that. It is anti-aliased painted work 250–330px tall, and a zoomed Step I
 * blows it up two to three times once the display's pixel ratio is counted — a range where
 * nearest neighbour has no pixel edges to preserve and instead stair-steps every soft
 * gradient the artist did draw. Bilinear keeps the drawing and loses nothing that was there.
 */
function blit(
  ctx: CanvasRenderingContext2D,
  unit: number,
  img: HTMLImageElement,
  tiles: number,
): void {
  const destH = unit * tiles;
  const destW = destH * (img.width / img.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -destW / 2, -destH, destW, destH);
}

/**
 * A body in motion, for the placeholder walk.
 *
 * The counterpart to `DioramaActor.entry`: one optional value the caller owns and the draw
 * code reads, describing something the drawing cannot work out for itself. `entry` says how
 * far through arriving an actor is; this says how far through a step.
 *
 * Absent means standing. That is the default on purpose — every caller that has no idea
 * whether its actor is walking gets the still figure it drew before.
 */
export interface Gait {
  /**
   * Position in the step cycle, counted in footfalls: whole numbers are the moments a foot
   * lands, halves are mid-stride. Unbounded and expected to keep climbing — the draw code
   * takes it modulo a cycle itself, so a caller can just accumulate.
   *
   * Drive it from **distance covered**, not from a timer, if the caller knows the distance.
   * `Walker` in the district does this (`walked / 0.9`) and it is the reason a Commander who
   * walks into a wall stops moving their legs instead of jogging on the spot.
   */
  phase: number;
  /**
   * Which way the body is travelling across the screen, `-1` (left) to `1` (right). Scales
   * the lean, so a figure drifting slowly leans less than one at a run. Omit for none.
   */
  lean?: number;
}

/**
 * How far the body rises between footfalls, as a fraction of its own height.
 *
 * A fraction rather than a pixel count because the figure is drawn at wildly different
 * sizes — the creation screen's Step I blows it up better than three times what the street
 * shows — and a bounce fixed in pixels would be invisible at one end and a jolt at the
 * other. Proportion holds the same read at every zoom.
 */
const BOB_RISE = 0.015;
/** Lean into the direction of travel, in radians, at full speed. About two degrees. */
const LEAN_RADIANS = 0.035;
/** Sway rocked across the step on top of the lean. Half the lean, so it never overturns it. */
const SWAY_RADIANS = 0.014;

/**
 * The Commander, as a bitmap.
 *
 * The two bearings' source files differ in height (288px against 253px) and are blitted to
 * the same `destH`, so both figures stand the same height on the stage whichever is chosen.
 *
 * Pass a `gait` and the still figure gets a placeholder walk: it rises between footfalls and
 * leans into its travel. This is deliberately cheap and deliberately temporary — one frame
 * cannot move its legs, and no amount of rocking the whole body will convince anyone it is
 * walking. What it buys is that a figure crossing the street stops looking like it is being
 * *slid*, which is the specific ugliness of translating a static bitmap. Replace it with
 * `drawCommanderAnimated` once there are frames; keep the bob when you do, since a real walk
 * cycle wants the vertical travel too and the art will not carry it.
 */
export function drawCommander(
  ctx: CanvasRenderingContext2D,
  unit: number,
  img: HTMLImageElement | null,
  gait?: Gait | null,
): void {
  if (!img) return; // Sprite still loading — nothing to draw this frame rather than a blank flash.
  if (!gait) {
    blit(ctx, unit, img, COMMANDER_HEIGHT_TILES);
    return;
  }

  // `abs(sin)` rather than a plain sine: it touches zero at every whole phase and never goes
  // negative, so footfalls land the body on the ground instead of sinking it through the
  // pavement, and one stride gives one rise rather than a rise and a dip.
  const rise = Math.abs(Math.sin(gait.phase * Math.PI)) * unit * COMMANDER_HEIGHT_TILES * BOB_RISE;
  const sway = Math.sin(gait.phase * Math.PI * 2) * SWAY_RADIANS;
  const lean = (gait.lean ?? 0) * LEAN_RADIANS;

  ctx.save();
  // Rotate first, so the pivot is the feet — where a leaning body actually hinges. Lifting
  // before rotating would swing the figure about a point floating above the ground.
  ctx.rotate(lean + sway);
  ctx.translate(0, -rise);
  blit(ctx, unit, img, COMMANDER_HEIGHT_TILES);
  ctx.restore();
}


/* ------------------------------------------------------------------------------------ *
 * The real walk cycle — designed, not yet wired.
 *
 * NOTHING BELOW HAS ART BEHIND IT YET. `loadCommanderWalk` will 404 until the frames named
 * by `commanderWalkSrc` are on disk; the pure parts (`commanderWalkSrc`, `walkFrameAt`) are
 * live and tested so the convention is pinned down before anyone draws to it.
 * ------------------------------------------------------------------------------------ */

/**
 * Which facings get a walk cycle.
 *
 * No `side-alt` here. That file is the two-frame stopgap the district alternates on distance
 * travelled; a real cycle supersedes it, and its pose becomes frame 2 below. As with the
 * standing art there is no `left` — the caller mirrors `side`.
 */
export type WalkFacing = 'front' | 'back' | 'side';

/**
 * Frames per direction.
 *
 * Four is the classic contact/passing pair doubled, and it is the fewest that reads as a
 * walk rather than as a shuffle: 0 and 2 are the two contact poses (opposite feet forward),
 * 1 and 3 the passing poses between them. Three would force one passing pose to serve both
 * halves of the stride and the walk picks up a limp; eight is animator's work for a figure
 * this small on screen.
 */
export const WALK_FRAMES = 4;

/** How long one frame holds. Four of these is a full stride, so a stride is about half a second. */
export const WALK_FRAME_MS = 120;

/**
 * Where one frame of the walk lives.
 *
 * Extends the standing convention rather than replacing it: `hero-{gender}-{facing}` still
 * prefixes the name, so anything globbing a bearing keeps working, and the standing file
 * stays the idle pose for that facing. Frame index last, zero-based.
 *
 *     hero-male-side-walk-0.png     hero-female-front-walk-3.png
 */
export function commanderWalkSrc(gender: Gender, facing: WalkFacing, frame: number): string {
  return `/assets/sprites/hero-${gender}-${facing}-walk-${frame}.png`;
}

/**
 * One direction's worth of walk: the frames in order, how long each holds, and whether it
 * repeats. A cycle that does not loop holds its last frame forever, which is what a
 * one-shot (a stumble, a landing) wants.
 *
 * Separate images rather than one sheet plus rects, to match how the rest of this art
 * arrives — the pipeline exports a PNG per pose, and slicing a sheet would mean a second
 * place where a frame's boundaries are written down and can drift from the file.
 */
export interface WalkCycle {
  readonly frames: readonly HTMLImageElement[];
  readonly frameMs: number;
  readonly loops: boolean;
}

/**
 * Loads every frame of one direction, in parallel, into the same cache the standing facings
 * use. Safe to call repeatedly — the frames dedupe individually.
 *
 * Unused today. It is written because it is the existing loader's shape with the key changed,
 * and leaving a hole here would mean rediscovering that shape later.
 */
export async function loadCommanderWalk(
  gender: Gender,
  facing: WalkFacing,
  opts: { frameMs?: number; loops?: boolean } = {},
): Promise<WalkCycle> {
  const frames = await Promise.all(
    Array.from({ length: WALK_FRAMES }, (_unused, n) =>
      loadHeroImage(`${gender}:${facing}-walk-${n}`, commanderWalkSrc(gender, facing, n)),
    ),
  );
  return { frames, frameMs: opts.frameMs ?? WALK_FRAME_MS, loops: opts.loops ?? true };
}

/**
 * The frame showing at a given point in the cycle.
 *
 * Takes elapsed time rather than a frame index so the caller keeps one accumulating number
 * and never has to know how many frames there are. Negative input is handled because a
 * caller subtracting a start stamp from a clock can hand over a small negative on the first
 * frame, and a walk that flickers to its last pose for one frame on every start is the kind
 * of thing nobody finds until it ships.
 */
export function walkFrameAt(cycle: WalkCycle, elapsedMs: number): HTMLImageElement | null {
  const count = cycle.frames.length;
  if (count === 0) return null;
  const total = count * cycle.frameMs;
  if (!cycle.loops && elapsedMs >= total) return cycle.frames[count - 1] ?? null;
  const t = ((elapsedMs % total) + total) % total;
  return cycle.frames[Math.floor(t / cycle.frameMs)] ?? null;
}

/**
 * The Commander mid-walk, from real frames.
 *
 * Still takes a `gait`, and it should still be given one: the frames move the legs, the bob
 * moves the body, and the two are different jobs. Art that already carries its own vertical
 * travel wants `gait` omitted instead.
 */
export function drawCommanderAnimated(
  ctx: CanvasRenderingContext2D,
  unit: number,
  cycle: WalkCycle,
  elapsedMs: number,
  gait?: Gait | null,
): void {
  drawCommander(ctx, unit, walkFrameAt(cycle, elapsedMs), gait);
}

/* ------------------------------------------------------------------------------------ *
 * The walk sprite sheet.
 *
 * One file, one decode, one cache entry — `hero-male-walk.png`, a 5x4 grid of 256px cells.
 * This is how the Commander's walk arrives now; the per-file frames above are what the
 * female bearing still uses until it has a sheet of its own.
 * ------------------------------------------------------------------------------------ */

export const WALK_SHEET_COLS = 5;
export const WALK_SHEET_ROWS = 4;
export const WALK_SHEET_CELL = 256;
export const WALK_SHEET_FRAMES = WALK_SHEET_COLS * WALK_SHEET_ROWS;

/**
 * How many complete gait cycles the twenty frames actually contain.
 *
 * Two, not one, and this is the number that keeps the legs and the ground agreeing. Measured
 * off the art: foot separation at the ground line has a period of exactly five frames —
 * column 1 is the passing pose in every row (31px, 30px, 31px, 31px) and column 4 the widest
 * stride (86, 74, 81, 82). Five frames is therefore one step, twenty frames is four steps,
 * and four steps is two gait cycles. Treating the sheet as a single cycle would run the legs
 * at half the speed the ground moves.
 */
export const WALK_SHEET_GAIT_CYCLES = 2;

/**
 * Where the Commander actually is inside a 256px cell.
 *
 * The union of all twenty cells' opaque bounds, so one box holds every frame. The character
 * occupies 197 of the cell's 256 rows — a shade over three quarters — and stands clear of the
 * bottom edge by 29 of them. Cropping to this rather than to each frame's own bounds is what
 * keeps the body from throbbing: per-frame boxes vary by 5px in height, and normalising each
 * to the same drawn height would rescale the figure every frame. It also preserves the
 * animator's own vertical travel, since a frame whose feet sit high in the box is drawn high.
 */
export const WALK_SHEET_CONTENT = { x: 78, y: 30, w: 95, h: 197 } as const;

export function commanderWalkSheetSrc(gender: Gender): string {
  return `/assets/sprites/hero-${gender}-walk.png`;
}

/**
 * Top-left corner of a frame's cell, in sheet pixels. Frames read left to right, top to
 * bottom; the index wraps, so a caller can hand over an ever-climbing counter.
 */
export function walkFrameCell(index: number): { x: number; y: number } {
  const i = ((index % WALK_SHEET_FRAMES) + WALK_SHEET_FRAMES) % WALK_SHEET_FRAMES;
  return {
    x: (i % WALK_SHEET_COLS) * WALK_SHEET_CELL,
    y: Math.floor(i / WALK_SHEET_COLS) * WALK_SHEET_CELL,
  };
}

/** The one load. Cached beside the standing facings, keyed so it cannot collide with them. */
export async function loadCommanderWalkSheet(gender: Gender): Promise<HTMLImageElement> {
  return loadHeroImage(`${gender}:walk-sheet`, commanderWalkSheetSrc(gender));
}

/** The sheet if it is already decoded, for a draw path that cannot await one. */
export function commanderWalkSheetIfLoaded(gender: Gender): HTMLImageElement | null {
  return spriteCache.get(`${gender}:walk-sheet`) ?? null;
}

/**
 * One frame of the sheet, drawn feet-on-origin at the same height as every other body.
 *
 * Only the content box is blitted, not the whole cell — which is why `COMMANDER_HEIGHT_TILES`
 * still means what it says here. Handing the full 256px cell to the same scale would draw the
 * character at 77% of its height and float it a fifth of a tile off the pavement, because
 * nearly a quarter of the cell is padding and 29 rows of that sit under the boots.
 */
export function drawCommanderSheetFrame(
  ctx: CanvasRenderingContext2D,
  unit: number,
  sheet: HTMLImageElement | null,
  frameIndex: number,
  gait?: Gait | null,
): void {
  if (!sheet) return;
  const cell = walkFrameCell(frameIndex);
  const c = WALK_SHEET_CONTENT;
  const destH = unit * COMMANDER_HEIGHT_TILES;
  const destW = destH * (c.w / c.h);

  ctx.save();
  if (gait) {
    ctx.rotate((gait.lean ?? 0) * LEAN_RADIANS + Math.sin(gait.phase * Math.PI * 2) * SWAY_RADIANS);
    ctx.translate(0, -Math.abs(Math.sin(gait.phase * Math.PI)) * destH * BOB_RISE);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, cell.x + c.x, cell.y + c.y, c.w, c.h, -destW / 2, -destH, destW, destH);
  ctx.restore();
}

/**
 * Where a companion's bitmap sprite lives, one folder per species, one file per facing.
 *
 * Front is what the creation screen ever shows — the diorama beast stands still and faces
 * camera, same as the Commander. `back`/`side` exist for the combat board, where a unit
 * turns to face the direction it moved or attacked; nothing in this file uses them yet.
 *
 * Exported because the creation screen needs the same path for an `<img>` in its vow panel,
 * and was building it by hand. Two copies of a filename convention is one copy too many:
 * renaming a facing should break one line, not two.
 */
export function companionSpriteSrc(id: string, facing: 'front' | 'back' | 'side' = 'front'): string {
  return `/assets/sprites/companions/${id}-${facing}.png`;
}

const companionCache = new Map<string, HTMLImageElement>();
const companionLoading = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads (and caches) one facing of a companion's sprite.
 *
 * Cached by `${id}:${facing}` so loading `ignis` front and `ignis` back are independent
 * entries rather than one clobbering the other — same shape as `loadCommanderSprite`, keyed
 * one level deeper.
 */
export async function loadCompanionSprite(
  id: string,
  facing: 'front' | 'back' | 'side' = 'front',
): Promise<HTMLImageElement> {
  const key = `${id}:${facing}`;
  const cached = companionCache.get(key);
  if (cached) return cached;
  const inFlight = companionLoading.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const img = new Image();
    img.src = companionSpriteSrc(id, facing);
    await img.decode();
    companionCache.set(key, img);
    return img;
  })();
  companionLoading.set(key, promise);
  return promise;
}

/** The cached facing, if `loadCompanionSprite` has already resolved it. */
export function companionSpriteIfLoaded(
  id: string,
  facing: 'front' | 'back' | 'side' = 'front',
): HTMLImageElement | null {
  return companionCache.get(`${id}:${facing}`) ?? null;
}

/**
 * The companion, as a bitmap — the diorama's replacement for the old procedural silhouette.
 *
 * Shorter than the Commander, so it reads as an animal beside an upright person. The six
 * species' art differs in aspect as well as height — Voltara is wider than it is tall, Sylva
 * is the reverse — and `blit` preserves each one's own ratio rather than forcing a box, which
 * is why a lynx does not end up as tall as a stag.
 */
export function drawCompanionBitmap(
  ctx: CanvasRenderingContext2D,
  unit: number,
  img: HTMLImageElement | null,
): void {
  if (!img) return;
  blit(ctx, unit, img, COMPANION_HEIGHT_TILES);
}

/**
 * The beast, as a silhouette in its school's colour.
 *
 * Kept as a fallback for any species without bitmap art yet — one shape recoloured per
 * school, rather than every not-yet-drawn companion failing to render at all.
 */
export function drawCompanion(
  ctx: CanvasRenderingContext2D,
  unit: number,
  school: School | string,
): void {
  const color = SCHOOL_COLOR[school] ?? PALETTE.pact;

  // Low, long body — it reads as an animal beside an upright person, which is the only
  // silhouette distinction that matters at this size.
  const w = unit * 0.42;
  const top = -unit * 0.62;

  ctx.beginPath();
  ctx.moveTo(-w, -unit * 0.04);
  ctx.quadraticCurveTo(-w * 1.05, top, 0, top);
  ctx.quadraticCurveTo(w * 1.05, top, w, -unit * 0.04);
  ctx.closePath();
  ctx.fillStyle = '#20262F';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, unit * 0.05);
  ctx.stroke();

  // Four legs, so it stands on the ground rather than hovering above it.
  ctx.fillStyle = '#20262F';
  for (const x of [-w * 0.62, -w * 0.2, w * 0.2, w * 0.62]) {
    ctx.fillRect(x - unit * 0.03, -unit * 0.1, unit * 0.06, unit * 0.1);
  }

  // The head, lifted and forward.
  ctx.beginPath();
  ctx.arc(w * 0.62, top - unit * 0.1, unit * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#20262F';
  ctx.fill();
  ctx.stroke();

  // The eye, and the only lit thing on the beast. `shadowBlur` in the element's own colour
  // makes it a source rather than a dot — which is what sells the silhouette as a creature
  // with something burning inside it, at a size where no amount of detail would.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = unit * 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(w * 0.68, top - unit * 0.13, unit * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A tail, so the silhouette has a direction.
  ctx.beginPath();
  ctx.moveTo(-w * 0.92, -unit * 0.18);
  ctx.quadraticCurveTo(-w * 1.7, -unit * 0.5, -w * 1.35, -unit * 0.74);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, unit * 0.045);
  ctx.stroke();
}
