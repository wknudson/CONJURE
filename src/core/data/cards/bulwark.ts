/**
 * The Bulwark set: holding ground, and moving other people off it.
 *
 * Bulwark is the school that wins by geometry rather than by damage. Its two existing
 * cards — Shield Bash and Stone Barricade — are both about *where* things are standing,
 * and these continue that: one is a wall that punishes being attacked, the other moves
 * everything around a point at once.
 *
 * Note on Seismic Slam being a Companion card in a school with no Companion: nothing
 * requires them to match. `castOriginCells` asks only whether the *card* is
 * `source: 'companion'`, and casts it from whichever Bound Form is on the board. So the
 * Slam is thrown by your Ignis or your Voltara, and its reach is measured from wherever
 * that beast is standing — which is the whole reason it is a Companion card rather than a
 * Hero one. A Hero card's `range` is read by nothing.
 */

import type { CardDef } from '../../types/cards.js';

export const BULWARK_CARDS: Record<string, CardDef> = {
  /**
   * The board-clearing shove.
   *
   * Aimed at a tile, so `originOf` reads the epicentre and `shoveArea` throws everything
   * *directly away* from it — the eight-way inverse of Aetheric Tether's pull. It deals no
   * damage of its own at all; every point it produces comes from what the bodies hit on
   * the way out.
   *
   * That is what makes it a positional card rather than a burst. Cast in the open it
   * scatters a formation and does nothing; cast against a wall it is the hardest single
   * hit in the game, because a shoved unit that meets masonry takes the full collision and
   * so does the masonry.
   */
  seismic_slam: {
    id: 'seismic_slam',
    name: 'Seismic Slam',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Every unit around the target tile is thrown 1 tile directly away from it. Deals no damage of its own — only what they hit. Triggers standard Collision Damage (3 / 2).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
    keywords: [],
    // Thrown short and by eye, like every other burst in the game.
    range: 3,
    needsLoS: true,
  },

  /**
   * The wall that hits back.
   *
   * Guardian *and* Counter is the expensive combination: attacking it head-on costs the
   * attacker its full Attack in return, and going around it means giving up the sightline
   * it is blocking. At four Pips it is Tier 3 and capped at one copy, which is correct —
   * two of these on a narrow board would make a lane simply impassable.
   *
   * No Escalate. It is already the largest body a Hero can field outside a Behemoth, and
   * something this hard to remove should not also grow while you fail to remove it.
   */
  slag_iron_golem: {
    id: 'slag_iron_golem',
    name: 'Slag-Iron Golem',
    cost: { pips: 4, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. Counter: strikes back for its full Attack whenever it is hit in melee, and survives to do it again.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'slag_iron_golem' },
    keywords: ['Guardian', 'Counter'],
    unit: {
      atk: 3,
      hp: 8,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // Worth something as an offering, but nowhere near four Pips back: a body this
      // expensive should be spent by fighting with it, not by cashing it in.
      sacrificeValue: 1,
      // Unreachable without the Escalate keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
