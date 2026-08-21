/**
 * Palette. Dark neutral environment; saturated colour is reserved for meaning.
 */

import type { School } from '../contract/ids.js';

export const PALETTE = {
  bg: '#14161D',
  tileA: '#2A2F3A',
  tileB: '#252A34',
  tileEdge: '#3A4150',
  tileSide: '#1B1F27',

  playerTint: 'rgba(59, 130, 246, 0.13)',
  enemyTint: 'rgba(229, 72, 77, 0.13)',
  neutralTint: 'rgba(255, 255, 255, 0.03)',

  boundary: '#8BE9E0',

  /** The Pact gauge's own blue, so the Bound Form on the board reads as the same pool. */
  pact: '#7DD3FC',

  allyBase: '#3B82F6',
  enemyBase: '#E5484D',

  highlight: '#67E8F9',
  highlightFill: 'rgba(103, 232, 249, 0.22)',
  attackFill: 'rgba(229, 72, 77, 0.28)',
  attackEdge: '#F87171',
  /**
   * The strike ring of a selected body: the same red as an attack, at a whisper.
   *
   * Same hue on purpose. "This is where I could hit" and "this is what I may hit" are the
   * same fact at two levels of certainty, and giving the ruler its own colour would make a
   * player learn a fourth thing rather than read a quieter version of one they know.
   */
  reachFill: 'rgba(229, 72, 77, 0.10)',
  reachEdge: 'rgba(248, 113, 113, 0.22)',

  /**
   * Where the cast under the cursor actually lands.
   *
   * Warm white rather than any school's colour, because the impact zone belongs to the
   * *cursor* rather than to the spell — it is the one overlay that changes as the mouse
   * moves, and tying it to a school would make a Frost card's area look like a Frost
   * effect that had already happened.
   */
  impactFill: 'rgba(255, 244, 214, 0.18)',
  impactEdge: 'rgba(255, 236, 179, 0.78)',

  fog: 'rgba(6, 8, 12, 0.55)',
  ghost: 'rgba(255, 255, 255, 0.42)',

  // Soul Pyres. Deliberately cold and off the highlight hue: the ground remembering a
  // body is not the same kind of thing as a tile offering itself, and a pyre drawn in
  // cyan would read as a fifth flavour of "click here".
  pyreEdge: 'rgba(125, 211, 252, 0.75)',
  pyreFill: 'rgba(56, 189, 248, 0.12)',

  danger: '#F87171',
  heal: '#6EE7B7',
  text: '#F1F5F9',
  textDim: '#94A3B8',
} as const;

export interface SchoolColors {
  main: string;
  deep: string;
  light: string;
}

export const SCHOOL: Record<School, SchoolColors> = {
  pyre: { main: '#FF6B35', deep: '#9A2E08', light: '#FFA271' },
  frost: { main: '#7DD3FC', deep: '#0C4A6E', light: '#BAE6FD' },
  surge: { main: '#FDE047', deep: '#854D0E', light: '#FEF08A' },
  bulwark: { main: '#B0946A', deep: '#4A3D28', light: '#D6C4A0' },
  dusk: { main: '#7C5CD6', deep: '#2E1E52', light: '#B49CF0' },
  bloom: { main: '#4ADE80', deep: '#14532D', light: '#A3F0BE' },
  arcane: { main: '#E2E8F0', deep: '#475569', light: '#F8FAFC' },
  neutral: { main: '#94A3B8', deep: '#334155', light: '#CBD5E1' },
};

export const schoolOf = (s: School): SchoolColors => SCHOOL[s] ?? SCHOOL.neutral;

/**
 * What each status looks like when it lands.
 *
 * One colour per affliction, and they are the colours the status already wears elsewhere
 * — the tooltip, the chip under the body — so the flash teaches nothing new. It confirms
 * something a player already knows the name of.
 *
 * Anything unlisted flashes white. A status with no colour of its own is still worth
 * confirming, and a silent one would be the exact failure this exists to fix.
 */
export const STATUS_COLOR: Record<string, string> = {
  toxin: '#4ADE80',
  burn: '#FB923C',
  chill: '#7DD3FC',
  freeze: '#BAE6FD',
  brittle: '#C4B5FD',
  charged: '#FDE047',
  entangle: '#86EFAC',
  stun: '#FCA5A5',
  exhaust: '#94A3B8',
  fleet: '#67E8F9',
  aetherPlated: '#F0B24A',
};

export function statusColor(kind: string): string {
  return STATUS_COLOR[kind] ?? '#FFFFFF';
}
