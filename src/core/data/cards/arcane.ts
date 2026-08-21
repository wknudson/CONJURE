/**
 * The Arcane set: the Hero's own baseline.
 *
 * Everything here is `source: 'hero'`, which is the constraint the whole file is built
 * around. The Hero is off-grid and has no anchor, so `castOriginCells` returns `'global'`
 * for these cards and `range` / `minRange` / `vector` / `needsLoS` are never consulted.
 * A Hero card cannot say "within 4 tiles of me" — it has no "me" to measure from. Where
 * one of these wants reach, it buys it with the shape of its target instead, which is a
 * thing the board can actually check.
 *
 * The set covers the two ends of a Hero's job: reaching out to move the enemy where you
 * want them (Grapple Line, Cull the Weak) and building something between them and the Pact
 * (Scrap Phalanx, Alchemist's Barricade, Volatile Munitions Cask).
 *
 * Only the first four are seeded into a new collection — see `ARCANE_BASELINE`. The Cask
 * is content to be earned rather than part of the floor.
 */

import type { CardDef } from '../../types/cards.js';

/** The reach of a grapple, in tiles. Both the target line and its area, kept in step. */
const GRAPPLE_REACH = 4;

export const ARCANE_CARDS: Record<string, CardDef> = {
  /**
   * A beam, and the first card in the game to say so.
   *
   * Two separate spellings of "straight line" are in play here and they are not
   * interchangeable:
   *
   * - `target: { kind: 'line', length: 4 }` is what the **player picks** — an origin tile
   *   and one of the eight directions. `line` is the only target kind that carries a
   *   direction at all, which is why a cone needs one too.
   * - `area: { shape: 'line', length: 4 }` is which tiles the effect then **touches**,
   *   walked from the chosen origin along the chosen direction.
   * - `vector: 'linear'` constrains the **cast** itself to a rank, file or diagonal from
   *   the Bound Form. Implemented since the beginning and used by nothing until now.
   *
   * There is no `kind: 'linear'` target: the spec asks for a shape the engine does not
   * have a word for, and these three fields are what it means.
   *
   * It hits **everything** on the line, allies included, because a beam does not check
   * sides on the way past. `spell` damage, so it does not shatter ice — and so it is
   * aligned for the Cinder Rune, which makes it an opener for a cascade rather than a
   * finisher.
   */
  aether_beam: {
    id: 'aether_beam',
    name: 'Aether Beam',
    cost: { pips: 2, marrow: 0 },
    school: 'arcane',
    source: 'companion',
    kind: 'spell',
    text: 'A line of light drawn through the arena. 30 damage to everything standing in it, yours included.',
    target: { kind: 'line', length: 4 },
    effect: {
      op: 'damage',
      amount: 30,
      dtype: 'spell',
      area: { shape: 'line', length: 4 },
    },
    keywords: [],
    range: 4,
    vector: 'linear',
    needsLoS: true,
  },

  /**
   * The pull card.
   *
   * A `line` target rather than an `entity` one, and not for flavour: `originOf` reads an
   * entity target's own anchor as the origin, so `displaceArea` computes a direction of
   * `{0,0}` and skips the unit entirely. An entity-targeted pull is a silent no-op. A
   * line carries its own origin — the near end, where the hook was thrown from — so the
   * drag has something to be *toward*.
   *
   * Damage lands before the pull so the line is judged on the board as it was thrown at,
   * and anything the point kills is not then dragged home as a corpse. Survivors converge
   * in reading order, which is where a grapple gets its collisions from.
   */
  grapple_line: {
    id: 'grapple_line',
    name: 'Grapple Line',
    cost: { pips: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: 'Deals 10 physical damage down a 4-tile line, then drags everything caught 2 tiles back toward the near end. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'line', length: GRAPPLE_REACH },
    effect: {
      op: 'seq',
      effects: [
        {
          op: 'damage',
          amount: 10,
          dtype: 'physical',
          area: { shape: 'line', length: GRAPPLE_REACH },
        },
        { op: 'pullArea', distance: 2, area: { shape: 'line', length: GRAPPLE_REACH } },
      ],
    },
    keywords: [],
  },

  /**
   * The wall.
   *
   * Guardian without Counter, which is the whole point: it is scrap, not a soldier, and
   * it answers a marksman by standing in the way rather than by hitting back. One ATK is
   * there so a spent wall is not entirely inert, not because anyone should be attacking
   * with it.
   */
  scrap_phalanx: {
    id: 'scrap_phalanx',
    name: 'Scrap Phalanx',
    cost: { pips: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. Sixty health of bolted-together plate, and almost no interest in moving.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'scrap_phalanx' },
    keywords: ['Guardian'],
    unit: {
      atk: 10,
      hp: 60,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // Bleeds at the flat rate and no more. There is no longer a gate on being worth
      // something — every body pays the same base, and a premium is what marks the
      // a rule — so this number alone decides whether a wall can be cashed in. One keeps
      // the option honest without making a 2-Pip body a Marrow engine.
      // Unreachable while the card carries no Growth keyword; the stat block requires
      // the field regardless. Zeroed rather than guessed, so a future grant of Growth
      // has to state what this thing actually grows into.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * The finisher.
   *
   * Priced entirely in Marrow, which Pips cannot substitute for at any price — so this is
   * castable only on a turn you have already opened something up. Free in Pips and lethal
   * to anything nearly dead, gated behind having made the sacrifice first.
   *
   * `true` damage, so armor is not an answer to it. The victim is whoever has the least
   * health, chosen by the same helper Soul Splinter uses — which includes an enemy Bound
   * Form, and therefore reaches the enemy Pact directly when their body is the weakest
   * thing standing.
   */
  cull_the_weak: {
    id: 'cull_the_weak',
    name: 'Cull the Weak',
    cost: { pips: 0, marrow: 1 },
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: 'Costs 1 Marrow, which no amount of banked Pips will cover. Deals 40 damage through any armor to the enemy with the least health.',
    target: { kind: 'global' },
    effect: { op: 'damage', amount: 40, dtype: 'true', area: { shape: 'lowestHpEnemy' } },
    keywords: [],
  },

  /**
   * A wall that is also a bomb.
   *
   * Two ops in one `seq`: raise the cask, then wire it. The second half only works because
   * `spawnConstruct` records what it built into the play context — a card aimed at an
   * *empty tile* has no entity in `chosen`, so without that handoff the rune would find no
   * host and the cask would go up unwired, silently.
   *
   * The rune's trigger is `death`, not `hpLoss`, which is the whole decision the card
   * asks. Chipping the cask does nothing. Somebody has to actually break it — and whoever
   * breaks it is standing next to it when it goes.
   *
   * Four health is deliberately thin. It is not there to hold a lane; it is there to be
   * destroyed, by them in a hurry or by you on purpose.
   */
  volatile_cask: {
    id: 'volatile_cask',
    name: 'Volatile Munitions Cask',
    cost: { pips: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a 40 HP cask on an empty tile. When it is destroyed it detonates for 30 impact damage in a cross around it, and leaves rubble.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnConstruct', obstacleDef: 'volatile_cask', hp: 40 },
        { op: 'attachRune', rune: 'cask_blast' },
      ],
    },
    keywords: [],
    obstacleHp: 40,
    // Broken masonry either way — the blast does not tidy the tile up after itself.
    leavesRubble: true,
  },

  /**
   * The construct.
   *
   * Raised with `spawnConstruct` rather than `spawnObstacle` so its durability belongs to
   * the casting, not to the definition — the seam that lets a later spell raise this same
   * barricade at a different strength without it becoming a second card. `obstacleHp` is
   * still required and still 8: `spawnObstacle` refuses any def without one, and the
   * construct op overwrites the value immediately afterward.
   *
   * `leavesRubble` sits on this def because it describes what breaking *this thing*
   * leaves behind. Masonry leaves rough ground; a geode shatters into nothing worth
   * walking around. Blowing it open opens a route without making it a fast one.
   */
  alchemists_barricade: {
    id: 'alchemists_barricade',
    name: "Alchemist's Barricade",
    cost: { pips: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a destructible 80 HP barricade on an empty tile. Blocks line of sight, and leaves rubble when it breaks.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnConstruct', obstacleDef: 'alchemists_barricade', hp: 80 },
    keywords: [],
    obstacleHp: 80,
    leavesRubble: true,
  },
};
