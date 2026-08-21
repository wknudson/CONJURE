/**
 * The Bloom mini-set.
 *
 * Bloom is the patience school. It deals almost nothing on impact and a great deal over
 * the following turns: Toxin ticks through armor at the start of its victim's turn, so a
 * heavily plated target is exactly the wrong thing to bring against it.
 *
 * The set's other half of the Reaction matrix is what makes it more than a damage-over-
 * time deck. Toxin is the only status Wildfire reads, and Wildfire consumes **every**
 * stack for 2 fire damage each to everything adjacent — so a Spore Cloud stacked deep
 * and then lit is a bomb the Bloom deck cannot set off on its own. It is the school that
 * wants a Pyre ally, or an enemy careless enough to bring fire to it.
 *
 * Both cards here are deliberately quiet on the turn they are played. That is the school.
 */

import type { CardDef } from '../../types/cards.js';

export const BLOOM_CARDS: Record<string, CardDef> = {
  /**
   * The Toxin layer, and the Wildfire fuse.
   *
   * Aimed at a tile, like every other radiating card, so the cross falls around the point
   * rather than around a victim. Two stacks per cast is what makes stacking it worth the
   * turns: Wildfire pays 2 fire damage *per stack consumed*, so a tile hit twice is a
   * four-stack detonation waiting for somebody's torch.
   *
   * It deals no damage of its own on the way in. Nothing here triggers a reaction at the
   * moment of casting — a status is not a hit — which is precisely why this is setup and
   * not removal.
   */
  spore_cloud: {
    id: 'spore_cloud',
    name: 'Spore Cloud',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Applies 2 Toxin to everything orthogonally beside the target tile. Toxin ticks through Armor. Fire ignites it for 20 damage per stack to everything adjacent.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'adjacentCross' } },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The trap, and Bloom's first rune.
   *
   * Attaches to a body on either side, exactly as the Cinder Rune does — the interesting
   * play is branding an *enemy* and letting their own front line spring it, but wiring
   * your own wall is a legitimate defensive read and the card does not judge.
   *
   * The blast spares its host, which is a property of every ringed rune in the game
   * (`applyBlast` skips the thing the rune was attached to). So this is a trap on a body
   * that catches whatever is standing *around* that body when it is struck — not a
   * shackle on the body itself.
   */
  rot_root_snare: {
    id: 'rot_root_snare',
    name: 'Rot-Root Snare',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'rune',
    text: 'Attach to a unit or obstacle (max 1 per target). When it loses health to a physical or impact blow, everything adjacent is Entangled and takes 1 Toxin.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'attachRune', rune: 'rot_root_snare' },
    keywords: [],
    // Laying a trap means getting close enough to lay it, and seeing where it goes.
    range: 4,
    needsLoS: true,
  },

  /**
   * The thing that cannot chase you.
   *
   * Zero movement, which is not a drawback dressed up as flavour — it is the entire price
   * of the card. A Briar threatens exactly the tile it was planted beside and nothing
   * else for the rest of the fight, so the decision is made once, when it goes down.
   *
   * An Aura is what makes that decision pay: it survives rounds precisely because
   * nothing has to walk past it, and by the cap it is a 4 ATK / 7 HP wall standing where
   * you chose to put it on turn one.
   */
  creeping_briar: {
    id: 'creeping_briar',
    name: 'Creeping Briar',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Cannot move, ever. Plant it where the fight is going to be.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'creeping_briar' },
    keywords: ['Growth'],
    unit: {
      atk: 10,
      hp: 40,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
    },
  },
};
