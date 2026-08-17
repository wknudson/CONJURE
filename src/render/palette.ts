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
  fog: 'rgba(6, 8, 12, 0.55)',
  ghost: 'rgba(255, 255, 255, 0.42)',

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
