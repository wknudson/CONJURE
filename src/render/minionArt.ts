/**
 * Loading a creature's drawing, for the presentations that can show one.
 *
 * The data half is `core/data/art.ts`, which says which cards have a drawing and which views
 * of it exist. This half fetches and decodes, and it is built around the one thing the
 * callers all need: **a drawing that is missing or slow must cost nothing.** Every body on
 * every board already has a procedural silhouette, so a caller asks for the drawing, keeps
 * the silhouette until it lands, and keeps it for good if it never does.
 */

import { creatureArtFor, creatureArtPath, facingPlan, type ArtFacing } from '../core/data/art.js';
import { assetUrl } from './assetUrl.js';

/** The three views a body turns between, each standing in for itself or for a missing one. */
export interface CreatureImages {
  front: HTMLImageElement;
  back: HTMLImageElement;
  side: HTMLImageElement;
  /** Whether `side` may be flipped for the other bearing. See `facingPlan`. */
  mirrorSide: boolean;
  style: 'pixel' | 'painted';
}

const images = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<CreatureImages | null>>();
const settled = new Map<string, CreatureImages | null>();

async function decode(path: string): Promise<HTMLImageElement> {
  const hit = images.get(path);
  if (hit) return hit;
  const img = new Image();
  img.src = assetUrl(path);
  await img.decode();
  images.set(path, img);
  return img;
}

/**
 * Every view of a card's drawing, or null if it has none or it failed to load.
 *
 * Cached per base card, so a pack of four hounds is one fetch, and a failure is remembered
 * rather than retried every time a body is drawn — a missing file stays missing for the
 * session, which is the honest reading of a 404.
 */
export function loadCreatureImages(cardId: string): Promise<CreatureImages | null> {
  const art = creatureArtFor(cardId);
  if (!art) return Promise.resolve(null);
  const key = art.file;
  if (settled.has(key)) return Promise.resolve(settled.get(key)!);
  const inFlight = loading.get(key);
  if (inFlight) return inFlight;

  const plan = facingPlan(art);
  const view = (f: ArtFacing): Promise<HTMLImageElement> => decode(creatureArtPath(art, f));
  const promise = Promise.all([view(plan.front), view(plan.back), view(plan.side)])
    .then(([front, back, side]): CreatureImages => ({
      front,
      back,
      side,
      mirrorSide: plan.mirrorSide,
      style: art.style,
    }))
    .catch(() => null)
    .then((result) => {
      settled.set(key, result);
      loading.delete(key);
      return result;
    });
  loading.set(key, promise);
  return promise;
}

/**
 * The drawing, if `loadCreatureImages` has already resolved it — and asks for it if not.
 *
 * The shape a per-frame painter wants: never awaits, never throws, and the first call is what
 * starts the fetch, so the drawing simply appears on some later frame.
 */
export function creatureImagesIfLoaded(cardId: string): CreatureImages | null {
  const art = creatureArtFor(cardId);
  if (!art) return null;
  const done = settled.get(art.file);
  if (done !== undefined) return done;
  void loadCreatureImages(cardId);
  return null;
}
