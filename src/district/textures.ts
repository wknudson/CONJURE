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
import { GRID, MAP, TILES } from './map.js';

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
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context for a sheet slice');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);

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

function paintGrass(ctx: CanvasRenderingContext2D, px: number, py: number, rng: () => number): void {
  const palette = ['#232b21', '#2a3327', '#1e251c', '#303a2c'];
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      ctx.fillStyle = palette[(rng() * palette.length) | 0]!;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

/** The first row the ground plane covers — the two above it are canal. */
export const GROUND_ROW0 = 2;
export const GROUND_ROWS = GRID - GROUND_ROW0;

/**
 * The whole ground, baked off the map in one pass.
 *
 * One texture and one draw call. The curb — a warm line on the walkway side of every
 * safe/danger border — is drawn last, over the tiles, because it is the player's first and
 * quietest lesson in where the rule changes.
 */
export function bakeGround(maxAnisotropy: number): THREE.Texture {
  const { c, ctx } = makeCanvas(GRID * PX, GROUND_ROWS * PX);
  const rng = mulberry32(1337);

  for (let row = GROUND_ROW0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const px = col * PX;
      const py = (row - GROUND_ROW0) * PX;
      const tex = (TILES[MAP[row]![col]!] ?? TILES.W!).tex;
      if (tex === 'sidewalk') paintSidewalk(ctx, px, py, rng);
      else if (tex === 'grass') paintGrass(ctx, px, py, rng);
      else if (tex === 'weeds') paintCobble(ctx, px, py, rng, true);
      else paintCobble(ctx, px, py, rng, false);
    }
  }

  ctx.fillStyle = '#b09263';
  const notS = (r: number, cc: number): boolean =>
    r < 0 || r >= GRID || cc < 0 || cc >= GRID ? true : MAP[r]![cc] !== 'S';
  for (let row = GROUND_ROW0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (MAP[row]![col] !== 'S') continue;
      const px = col * PX;
      const py = (row - GROUND_ROW0) * PX;
      if (notS(row - 1, col)) ctx.fillRect(px, py, PX, 2);
      if (notS(row + 1, col)) ctx.fillRect(px, py + PX - 2, PX, 2);
      if (notS(row, col - 1)) ctx.fillRect(px, py, 2, PX);
      if (notS(row, col + 1)) ctx.fillRect(px + PX - 2, py, 2, PX);
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
