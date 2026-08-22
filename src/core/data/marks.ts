/**
 * Mark definitions: what a brand does when it goes off.
 *
 * **One per element, and exactly one.** The Hero lays Marks and the Companion casts
 * Spells, so a Mark is the Hero's only way to put an element on the board — which meant
 * that while three of the six existed, three schools had no trap at all and the Hero's
 * half of the pairing was a different size depending on who they had tamed.
 *
 * Deliberately **no hybrid Marks**. A fusion is the splicing bench's product and belongs
 * to a Grimoire socket; a Mark whose payload was two schools at once would be a Hybrid the
 * Hero could deck, which is the one thing the Forge's sink exists to charge for.
 *
 * These are the *payloads*. The cards that lay them live in `cards/arcane.ts`, because the
 * card is Hero property and arcane is the Hero's colour — the school below is the colour of
 * the blast, not of the hand that set it. See `docs/02_combat_lexicon.md` §10.
 *
 * Note on Cinder Mark's trigger: the founding card table said "Detonation (Fire/Spell):
 * triggers on partial HP loss", while §7 states damage-based triggers generally require
 * armor penetration. Both are modelled here: `alignedTypes` gates WHICH damage can set it
 * off, and the engine separately requires >= 1 real HP loss. An unaligned killing blow
 * fizzles it. Keeping alignment as data means rebalancing needs no engine change.
 */

import type { MarkDef } from '../types/units.js';

export const MARKS: Record<string, MarkDef> = {
  cinder_mark: {
    id: 'cinder_mark',
    name: 'Cinder Mark',
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
   * Mark sitting beside it: fire and spell set that one off, a bodily blow sets this one
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
   * which is why no mark card names it.
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

  /**
   * Frost's trap: it does not kill you, it makes you easy to kill.
   *
   * Two Chill rather than damage worth the pip, because Chill is the school's whole
   * sentence — a third stack Freezes, and anything Frozen Shatters to the impact the
   * Tremor Mark deals. Two traps laid next to each other are a combination the player set
   * up rather than a number they rolled, and this is the only pair in the set that reads
   * that way.
   *
   * Aligned to frost and spell, mirroring the Cinder Mark exactly: the school's own damage
   * type, plus magic generally.
   */
  rime_mark: {
    id: 'rime_mark',
    name: 'Rime Mark',
    school: 'frost',
    trigger: { kind: 'hpLoss', alignedTypes: ['frost', 'spell'] },
    damage: 20,
    dtype: 'frost',
    blast: { shape: 'adjacent8' },
    applies: [{ status: 'chill', stacks: 2 }],
    text: 'When the host loses health to frost or spell damage, the cold spreads: 20 frost damage and 2 Chill to everything adjacent.',
  },

  /**
   * Surge's trap: a setup piece that happens to hurt.
   *
   * Charged does nothing on its own, which is exactly what makes it Surge — fire sets it
   * off as an Overload, frost conducts through it as a Superconduct. A trap that leaves
   * everything around it Charged is a turn the player spends *arranging* rather than
   * spending, and the payoff is whatever their Companion casts next.
   *
   * **No `applies` entry, and that is not an oversight.** `dealDamage` already leaves 1
   * Charged on any unit a shock hit survives (`damage.ts:247`), so a rider here would be
   * the card paying for something the engine gives it free — and it measurably did: the
   * first draft charged the blast twice and the test caught it at two stacks. The `dtype`
   * *is* the effect.
   *
   * A cross rather than a ring, like the Cask: the arc runs down the aisles, so standing on
   * the diagonal is the safe place to be and the shape is a thing the player can play
   * around.
   */
  arc_mark: {
    id: 'arc_mark',
    name: 'Arc Mark',
    school: 'surge',
    trigger: { kind: 'hpLoss', alignedTypes: ['shock', 'spell'] },
    damage: 30,
    dtype: 'shock',
    blast: { shape: 'plus', radius: 1 },
    text: 'When the host loses health to shock or spell damage, the charge jumps: 30 shock damage in a cross around it, leaving everything it touches Charged.',
  },

  /**
   * Bulwark's trap, and the only one that deals impact.
   *
   * No status at all, and that is the design rather than an omission. Bulwark has no
   * condition of its own to leave behind — its whole vocabulary is mass and ground — so
   * this one buys its identity with a **damage type** instead: impact is what Shatters a
   * Frozen body, which makes a Tremor Mark the answer to whatever the Rime Mark set up.
   *
   * Triggered by violence rather than by magic, the same way the Rot-Root Snare is. Two
   * traps sharing a trigger is fine when their payloads are nothing alike: one holds a
   * body still and poisons it, this one breaks the ground under it.
   */
  tremor_mark: {
    id: 'tremor_mark',
    name: 'Tremor Mark',
    school: 'bulwark',
    trigger: { kind: 'hpLoss', alignedTypes: ['physical', 'impact'] },
    damage: 40,
    dtype: 'impact',
    blast: { shape: 'plus', radius: 1 },
    text: 'When the host loses health to a physical or impact blow, the ground gives: 40 impact damage in a cross around it. Shatters anything Frozen it catches.',
  },

  soul_splinter_mark: {
    id: 'soul_splinter_mark',
    name: 'Soul Splinter Mark',
    school: 'dusk',
    trigger: { kind: 'death' },
    damage: 50,
    dtype: 'spell',
    blast: { shape: 'lowestHpEnemy' },
    text: 'When the host dies, deals 50 damage to the lowest-HP enemy.',
  },
};
