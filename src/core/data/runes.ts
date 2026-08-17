/**
 * Rune definitions for the demo.
 *
 * Note on Cinder Rune's trigger: Draft 7's card table says "Detonation (Fire/Spell):
 * triggers on partial HP loss", while §7 states damage-based triggers generally require
 * armor penetration. Both are modelled here: `alignedTypes` gates WHICH damage can set it
 * off, and the engine separately requires >= 1 real HP loss. An unaligned killing blow
 * fizzles it. Keeping alignment as data means rebalancing needs no engine change.
 */

import type { RuneDef } from '../types/units.js';

export const RUNES: Record<string, RuneDef> = {
  cinder_rune: {
    id: 'cinder_rune',
    name: 'Cinder Rune',
    school: 'pyre',
    trigger: { kind: 'hpLoss', alignedTypes: ['fire', 'spell'] },
    damage: 4,
    dtype: 'fire',
    blast: { shape: 'adjacent8' },
    text: 'Detonates for 4 fire damage to all adjacent when the host loses HP to fire or spell damage.',
  },
  soul_splinter_rune: {
    id: 'soul_splinter_rune',
    name: 'Soul Splinter Rune',
    school: 'dusk',
    trigger: { kind: 'death' },
    damage: 5,
    dtype: 'spell',
    blast: { shape: 'lowestHpEnemy' },
    text: 'When the host dies or is sacrificed, deals 5 damage to the lowest-HP enemy.',
  },
};
