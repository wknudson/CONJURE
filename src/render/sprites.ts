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
 * Where the Commander's bitmap sprite lives, one file per bearing.
 *
 * Front-facing only for now — the creator only ever shows the figure from the front, so
 * that is the one frame actually wired up. `hero-*-side.png` / `-back.png` / `-side-alt.png`
 * exist alongside these if a facing change is ever added to the diorama; nothing in this
 * file references them yet.
 */
const SPRITE_SRC: Record<Gender, string> = {
  male: '/assets/sprites/hero-male-front.png',
  female: '/assets/sprites/hero-female-front.png',
};

/**
 * Where the Commander's sprite lives, for a bearing. The counterpart to `companionSpriteSrc`.
 *
 * Exported so a test can ask whether the file the loader will request is actually on disk,
 * under exactly that name. Worth checking rather than assuming: the art arrived as
 * capitalised exports (`Boreas-removebg-preview.png`) and was renamed down to lowercase, and
 * a case slip survives every Windows filesystem to fail only once it is served from Linux.
 */
export function commanderSpriteSrc(gender: Gender): string {
  return SPRITE_SRC[gender];
}

const spriteCache = new Map<Gender, HTMLImageElement>();
const spriteLoading = new Map<Gender, Promise<HTMLImageElement>>();

/**
 * Loads (and caches) the Commander sprite for a bearing.
 *
 * Call this once, ahead of the first `render()` that needs it — e.g. when the creation
 * screen mounts — and hold the resolved `HTMLImageElement` for `drawCommander`, which is
 * synchronous and cannot itself await a decode mid-frame. Calling it again for a bearing
 * already loaded or loading returns the same promise/image rather than re-fetching.
 */
export async function loadCommanderSprite(gender: Gender): Promise<HTMLImageElement> {
  const cached = spriteCache.get(gender);
  if (cached) return cached;
  const inFlight = spriteLoading.get(gender);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const img = new Image();
    img.src = SPRITE_SRC[gender];
    await img.decode();
    spriteCache.set(gender, img);
    return img;
  })();
  spriteLoading.set(gender, promise);
  return promise;
}

/** The cached sprite for a bearing, if `loadCommanderSprite` has already resolved it. */
export function commanderSpriteIfLoaded(gender: Gender): HTMLImageElement | null {
  return spriteCache.get(gender) ?? null;
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
 * The Commander, as a bitmap.
 *
 * The two bearings' source files differ in height (288px against 253px) and are blitted to
 * the same `destH`, so both figures stand the same height on the stage whichever is chosen.
 */
export function drawCommander(
  ctx: CanvasRenderingContext2D,
  unit: number,
  img: HTMLImageElement | null,
): void {
  if (!img) return; // Sprite still loading — nothing to draw this frame rather than a blank flash.
  blit(ctx, unit, img, COMMANDER_HEIGHT_TILES);
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
