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
   * The game's first source of Stun.
   *
   * `stun` has been in `StatusKind` since the beginning with every *consumer* already
   * built — `canAct` gates move and attack on it, the tick decays it, the threat
   * projection skips a stunned foe, the renderer has an icon, the glossary has an entry,
   * and the targeting layer has a refusal that names it. Every one of those was writing
   * about something no card, rune, or rider could produce. This is the missing half, and
   * it is one line of data.
   *
   * Delivered as a **rider** rather than as a spell, deliberately. Hard CC that arrives
   * on a body has to walk up, survive a turn in the open, and connect — and since the
   * gates went on `onHit`, connecting means actually wounding: armour that eats the blow
   * eats the Stun with it. A spell version would be the same effect with none of that
   * asked for.
   *
   * 1 MOV and 4 HP is the price. It threatens the tile in front of it and nothing else.
   */
  concussive_blow: {
    id: 'concussive_blow',
    name: 'Concussive Blow',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'A slab of a thing with a hammer. Whatever it wounds is Stunned: no moving, no swinging.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'concussive_blow' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 40,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
      onHit: { status: 'stun', stacks: 1 },
    },
  },

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
    text: 'Every unit around the target tile is thrown 1 tile directly away from it. Deals no damage of its own — only what they hit. Triggers standard Collision Damage (30 / 20).',
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
   * No Growth. It is already the largest body a Hero can field outside a Behemoth, and
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
      atk: 30,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // Worth something as an offering, but nowhere near four Pips back: a body this
      // expensive should be spent by fighting with it, not by cashing it in.
      // Unreachable without the Growth keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * Both halves of what Bulwark does, on one Pip.
   *
   * Plate on a body of your choosing and a shove on everything around it -- the school's
   * two verbs, and the reason the card is a Pip rather than two: neither half is large,
   * and the value is entirely in aiming them at the same tile.
   */
  tectonic_plate: {
    id: 'tectonic_plate',
    name: 'Tectonic Plate',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 30 Armor and shoves everything beside it 1 tile away.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 30 },
        { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
  },

  /**
   * A body that gets harder for standing still, and the one place player-side growth came
   * back.
   *
   * Not Escalate. Escalate was removed from the player's side on purpose -- unbounded
   * growth on a persistent body is exactly what Auras replaced, and those cap at three
   * stacks. This plates at ten a turn and stops at `PLATE_CAP` times that, so a Guardian
   * left alone in a corner becomes genuinely hard and never becomes unkillable. It also
   * takes a turn to start, like everything else that grows.
   *
   * Guardian is what makes the plate matter: a body nobody can shoot past is a body worth
   * armouring.
   */
  stone_heart_golem: {
    id: 'stone_heart_golem',
    name: 'Stone-Heart Golem',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian. At the start of each of your turns it welds on 10 more Armor, up to 30.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'stone_heart_golem' },
    keywords: ['Guardian'],
    unit: {
      atk: 30,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      platesEachTurn: 10,
    },
  },

  /**
   * A shove that cares whether it landed.
   *
   * The collision damage is the engine's own and happens either way; what this adds is a
   * card noticing. `play.collided` is written by the shove and read by the `ifMet`, which
   * is the same one-op-tells-another pattern `titheDamage` established -- and it means the
   * Frailty is earned by aiming at a wall rather than granted for casting.
   */
  avalanche_slam: {
    id: 'avalanche_slam',
    name: 'Avalanche Slam',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves the target 2 tiles. If it slams into something, it is left Brittle.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'push', distance: 2 },
        {
          op: 'ifMet',
          cond: { kind: 'collided' },
          then: { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
        },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },
};
