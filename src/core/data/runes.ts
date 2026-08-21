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
    damage: 40,
    dtype: 'fire',
    blast: { shape: 'adjacent8' },
    text: 'Detonates for 40 fire damage to all adjacent when the host loses HP to fire or spell damage.',
  },
  /**
   * The control trap. No damage at all — everything it does is a status.
   *
   * Triggered by violence rather than by magic, which is what separates it from the Cinder
   * Rune sitting beside it: fire and spell set that one off, a bodily blow sets this one
   * off. A board carrying both answers two different threats.
   *
   * Entangle holds a unit where it stands without stopping it swinging, and the Toxin
   * ticks through armour while it is held there. Neither is a big number; together they
   * are a turn somebody else does not get to spend moving.
   */
  rot_root_snare: {
    id: 'rot_root_snare',
    name: 'Rot-Root Snare',
    school: 'bloom',
    trigger: { kind: 'hpLoss', alignedTypes: ['physical', 'impact'] },
    // Deliberately none. The card is priced as control, and a snare that also hit would
    // be doing two jobs for one Pip.
    damage: 0,
    dtype: 'true',
    blast: { shape: 'adjacent8' },
    applies: [
      { status: 'entangle', stacks: 1 },
      { status: 'toxin', stacks: 1 },
    ],
    text: 'When the host loses health to a physical or impact blow, roots burst out: everything adjacent is Entangled and takes 1 Toxin. Deals no damage of its own.',
  },

  /**
   * What a Volatile Munitions Cask is packed with.
   *
   * A death trigger rather than an hpLoss one, so the cask has to actually be broken —
   * chipping it does nothing, and the player who wants the blast has to finish the job.
   * `impact` damage, so it Shatters anything Frozen caught in it.
   *
   * Not attachable by any card: it exists only as the second half of the Cask's own `seq`,
   * which is why no rune card names it.
   */
  cask_blast: {
    id: 'cask_blast',
    name: 'Volatile Munitions',
    school: 'arcane',
    trigger: { kind: 'death' },
    damage: 30,
    dtype: 'impact',
    // A cross rather than a ring: the blast runs down the aisles, so standing on the
    // diagonal from a cask is the safe place to be.
    blast: { shape: 'plus', radius: 1 },
    text: 'When the cask is destroyed, it goes up: 30 impact damage in a cross around it.',
  },

  soul_splinter_rune: {
    id: 'soul_splinter_rune',
    name: 'Soul Splinter Rune',
    school: 'dusk',
    trigger: { kind: 'death' },
    damage: 50,
    dtype: 'spell',
    blast: { shape: 'lowestHpEnemy' },
    text: 'When the host dies, deals 50 damage to the lowest-HP enemy.',
  },
};
