/**
 * The Hero's kit: sixteen colourless cards and six arcane ones.
 *
 * Every Companion hands over the same Hero Deck, and that is by design — the Hero half is
 * what the player *builds*, and the beast's colour arrives through its Grimoire. What was
 * not by design was how little there was to build it out of. Eighteen hero-legal cards in
 * the whole game, three of them neutral, meant a 4-12 card deck had almost nothing to choose
 * between, and every player who reached the Field Journal was holding the same seven staples
 * and the same handful of upgrades.
 *
 * This file is the shelf. It stays inside the rules the Hero half has always had:
 *
 *  - **Abilities and Constructs only.** No Marks — there is exactly one per element and
 *    `duelist.test.ts` pins that. No bodies — the Vanguard is bought, not drawn.
 *  - **`source: 'hero'`, so no `range`.** The Hero stands off the grid with nothing to
 *    measure from, so every card here reaches the whole board and buys its limits with the
 *    shape of its target instead.
 *  - **No elemental statuses.** Burn, Toxin, Chill and Charge belong to the schools that
 *    make them. The neutral half hurts with weight and rope — physical damage, shoves,
 *    Entangle — and the arcane half with spell damage and the few holds that are nobody's
 *    element: Stun, and the clean slate of a cleanse.
 *  - **Nothing new in the engine.** Every effect is an op the interpreter already runs.
 *
 * Holds land during the caster's turn and lift at the end of the *owner's* turn (see
 * `liftHolds`), so a one-stack Entangle or Stun cast on an enemy holds it through the whole
 * of its next turn. The card faces say "through its next turn" for exactly that reason.
 *
 * Taught by the Adept and Master Duelists (`duelist.adept.ts`, `duelist.master.ts`), whose
 * decks are built out of this shelf the way the Novice Duelist's is built out of the first.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ALLY_UNIT = { kind: 'entity', side: 'ally', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;

export const HERO_KIT_CARDS: Record<string, CardDef> = {
  // ================================================================ neutral abilities

  /**
   * The first heal the Hero half has ever had.
   *
   * The Pact, not a unit: `heal` restores the Commander, and that is the right target for a
   * colourless card — a body is the Vanguard's to replace, the Pact is the thing a fight is
   * actually lost on. Forty for one Bone is a full exchange of blows undone, which is the
   * size a card has to be for a player to cut a strike to run it.
   */
  field_dressing: {
    id: 'field_dressing',
    name: 'Field Dressing',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Restores 40 health to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'heal', amount: 40 },
    keywords: [],
  },

  /**
   * Card advantage, priced as such.
   *
   * Two Bones puts it at Tier 2, so a deck holds two rather than three: a Hero Deck of four
   * that drew itself out in a turn would be a deck that played the same eight cards every
   * fight, which is the opposite of what a small deck is for.
   */
  quick_study: {
    id: 'quick_study',
    name: 'Quick Study',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Draw 2 cards.',
    target: { kind: 'none' },
    effect: { op: 'drawCards', amount: 2 },
    keywords: [],
  },

  /**
   * A free card that pays for the next one.
   *
   * It replaces itself and leaves a Bone behind, so it is never a dead draw and never a
   * large one. The Bone is clamped at the cap like every other gain, so it cannot be used to
   * bank past what the turn allows.
   */
  supply_run: {
    id: 'supply_run',
    name: 'Supply Run',
    cost: { bones: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Gain 1 Bone and draw 1 card.',
    target: { kind: 'none' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'gainBones', amount: 1 },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
  },

  /**
   * The cheap hold.
   *
   * Entangle rather than Stun: the body still swings at whatever is already next to it. What
   * the bola buys is the *approach* — a charger that cannot close, a skirmisher that cannot
   * leave — and that is worth one Bone, where a full Stun is worth three.
   */
  bola: {
    id: 'bola',
    name: 'Bola',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 10 damage to an enemy and Entangles it: it cannot move through its next turn.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'physical', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
  },

  /**
   * The bola's big brother, and the reason to aim it carefully.
   *
   * A net does not check uniforms: everything in the cross is caught, the caster's own
   * included. Thrown into the enemy's line it stops a whole advance; thrown into a melee it
   * pins both sides where they stand.
   */
  weighted_net: {
    id: 'weighted_net',
    name: 'Weighted Net',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Entangles an enemy and every unit in a cross around it, yours included, through their next turn.',
    target: ENEMY_UNIT,
    effect: {
      op: 'applyStatus',
      status: 'entangle',
      stacks: 1,
      area: { shape: 'plus', radius: 1 },
    },
    keywords: [],
  },

  /**
   * A shove that starts from your own side of the fight.
   *
   * Shield Bash moves one enemy; this clears the ground around one of yours, which is what a
   * body surrounded needs and what a body standing beside a wall turns into three collisions.
   * Everything adjacent goes, friend and foe, because the heave does not choose.
   */
  brace_and_heave: {
    id: 'brace_and_heave',
    name: 'Brace and Heave',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Everything adjacent to a friendly unit is shoved 1 tile away from it. Triggers standard Collision Damage (30 / 20).',
    target: ALLY_UNIT,
    effect: { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
    keywords: [],
  },

  /**
   * The colourless answer to a wall.
   *
   * Forty on anything — a body, a barricade, a crystal someone meant to shoot later. The
   * Hero half had no way to break a Construct short of walking a body up to it, which made
   * an enemy Barricade a problem only the Grimoire could solve.
   */
  sledgehammer: {
    id: 'sledgehammer',
    name: 'Sledgehammer',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 40 damage to a unit or obstacle.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'damage', amount: 40, dtype: 'physical', area: { shape: 'target' } },
    keywords: [],
  },

  /**
   * Two more tiles, once.
   *
   * Free, because on its own it does nothing — it is what gets a striker onto the Bound
   * Form that was one tile out of reach, or a body out of a blast that was one tile too wide.
   * Fleet lifts at the end of your turn, so it cannot be banked into the next one.
   */
  forced_march: {
    id: 'forced_march',
    name: 'Forced March',
    cost: { bones: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Grants a friendly unit +2 MOV this turn.',
    target: ALLY_UNIT,
    effect: { op: 'applyStatus', status: 'fleet', stacks: 2, area: { shape: 'target' } },
    keywords: [],
  },

  /**
   * A short line of steel.
   *
   * The line is picked like a grapple's, from its near end, and it catches everything on
   * it: the reach is two tiles because a pike is not a beam, and the damage is thirty
   * because it asks the player to line two enemies up to be worth more than a Shield Bash.
   */
  pike_thrust: {
    id: 'pike_thrust',
    name: 'Pike Thrust',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 30 damage to everything on a 2-tile line, yours included.',
    target: { kind: 'line', length: 2 },
    effect: { op: 'damage', amount: 30, dtype: 'physical', area: { shape: 'line', length: 2 } },
    keywords: [],
  },

  /**
   * Bad ground, on purpose.
   *
   * Rubble is what a broken wall leaves, and it blocks nothing: it only makes crossing
   * slower. Laid across a lane it turns a two-turn approach into three, which is the whole
   * card — terrain the Hero chooses rather than terrain the arena happened to have.
   */
  scatter_debris: {
    id: 'scatter_debris',
    name: 'Scatter Debris',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Strews rubble over a 2x2 block of tiles for 3 turns. Crossing it costs extra movement.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: { op: 'spawnHazard', kind: 'rubble', turns: 3, area: { shape: 'square', size: 2 } },
    keywords: [],
  },

  /**
   * The answer to a net — anybody's.
   *
   * Frees one body and puts a tile of stride back into it, so an Entangle landed on your
   * best striker costs the enemy a card and costs you nothing. Deliberately narrow: it cuts
   * rope, and does not thaw ice or wake a stunned body, which is the arcane cleanse's job.
   */
  cut_loose: {
    id: 'cut_loose',
    name: 'Cut Loose',
    cost: { bones: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Frees a friendly unit from Entangle and grants it +1 MOV this turn.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'clearStatus', status: 'entangle', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'fleet', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
  },

  /**
   * A smaller Aegis that pays for itself.
   *
   * Half the armour of Aegis Ward and no Retain, but it draws a card, so it is the one a
   * player runs when the deck is short on things to do rather than short on protection.
   */
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'ability',
    text: 'Grants a friendly unit or your Hero 20 Persistent Armor. Draw 1 card.',
    target: { kind: 'unitOrPortrait', side: 'ally' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
  },

  // =============================================================== neutral constructs

  /**
   * Cover for nothing.
   *
   * Free and thin: thirty health of sacking that hides a body from a marksman and stops no
   * one walking through it. The Battlement's job at a third of the price and a third of the
   * durability, for a Hero who needs a sightline closed this turn and not for long.
   */
  sandbag_wall: {
    id: 'sandbag_wall',
    name: 'Sandbag Wall',
    cost: { bones: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises 30 HP of cover on an empty tile. Blocks line of sight but not movement.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'sandbag_wall' },
    keywords: [],
    obstacleHp: 30,
    obstacleCover: true,
  },

  /**
   * The wall that holds a lane.
   *
   * Three Bones for a hundred and twenty, which is more health than any body the Hero can
   * field and the first construct in the colourless shelf that an enemy has to commit a
   * turn to. Raised with `spawnConstruct` so a later card could raise it at a different
   * strength without it becoming a second card, the same seam the Alchemist's Barricade uses.
   */
  timber_palisade: {
    id: 'timber_palisade',
    name: 'Timber Palisade',
    cost: { bones: 3, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a 120 HP palisade on an empty tile. Blocks line of sight, and leaves rubble when it breaks.',
    target: ANY_TILE,
    effect: { op: 'spawnConstruct', obstacleDef: 'timber_palisade', hp: 120 },
    keywords: [],
    obstacleHp: 120,
    leavesRubble: true,
  },

  /**
   * Bait, or a bank.
   *
   * Whoever breaks it takes the Marrow — credited to the side whose turn it is, exactly as a
   * geode is — so raising one is a bet about who will reach it first. Put it behind your own
   * line and it is two Marrow next turn; put it between the lines and it is a reason for the
   * enemy to walk where you want them.
   */
  supply_crate: {
    id: 'supply_crate',
    name: 'Supply Crate',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a 30 HP crate on an empty tile. Whoever breaks it takes 2 Marrow.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'supply_crate' },
    keywords: [],
    obstacleHp: 30,
    onDestroyReward: { marrow: 2 },
  },

  /**
   * A trap with a fuse the enemy lights.
   *
   * Breaking it catches everything in the nine tiles around it, both sides, the same rule
   * every crystal follows. Its point is to be broken by the charge coming through — which
   * leaves that charge stuck on the tile it broke it from.
   */
  tar_barrel: {
    id: 'tar_barrel',
    name: 'Tar Barrel',
    cost: { bones: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a 30 HP barrel of pitch. When it breaks, every unit on or beside it is Entangled.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'tar_barrel' },
    keywords: [],
    obstacleHp: 30,
    obstacleDeath: { status: 'entangle', stacks: 1 },
  },

  // ================================================================= arcane abilities

  /**
   * The plain strike, in spell damage.
   *
   * Thirty for one Bone against Shield Bash's twenty and a shove: more damage, no position.
   * Spell damage sets off a Cinder or Rime Mark, which is the other reason to run it — it is
   * the Hero's own trigger for the Hero's own traps.
   */
  mana_bolt: {
    id: 'mana_bolt',
    name: 'Mana Bolt',
    cost: { bones: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 30 spell damage to an enemy.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 30, dtype: 'spell', area: { shape: 'target' } },
    keywords: [],
  },

  /**
   * The clean slate.
   *
   * Every hold and every tick an enemy school can put on a body, gone. Brittle and Charged
   * are left alone on purpose: they are setups, not afflictions, and a cleanse that also
   * wiped the Hero's own combo pieces would be a card nobody could play on their own side.
   */
  cleansing_rune: {
    id: 'cleansing_rune',
    name: 'Cleansing Rune',
    cost: { bones: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Strips Burn, Toxin, Chill, Freeze, Entangle and Stun from a friendly unit.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: (['burn', 'toxin', 'chill', 'freeze', 'entangle', 'stun'] as const).map((status) => ({
        op: 'clearStatus' as const,
        status,
        area: { shape: 'target' as const },
      })),
    },
    keywords: [],
  },

  /**
   * The Hero's only full stop.
   *
   * Three Bones for one body out of one turn, which is the price Concussive Blow's rider has
   * implied since it was written. Nobody's element, so it lives in arcane rather than being
   * borrowed from a school; and single-target, because a Stun that caught an area would be
   * the only card worth playing.
   */
  stasis_glyph: {
    id: 'stasis_glyph',
    name: 'Stasis Glyph',
    cost: { bones: 3, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Stuns an enemy: it cannot move or attack through its next turn.',
    target: ENEMY_UNIT,
    effect: { op: 'applyStatus', status: 'stun', stacks: 1, area: { shape: 'target' } },
    keywords: [],
  },

  /**
   * A small burst, centred where the player chooses.
   *
   * Twenty in a cross, everything caught, so it is worth the most against a line that has
   * bunched up behind its Guardian — and worth the least, or less than nothing, thrown into
   * a fight your own bodies are in.
   */
  aether_lance: {
    id: 'aether_lance',
    name: 'Aether Lance',
    cost: { bones: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 20 spell damage to an enemy and everything in a cross around it, yours included.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 20, dtype: 'spell', area: { shape: 'plus', radius: 1 } },
    keywords: [],
  },

  /**
   * Damage that comes home.
   *
   * Half a Mana Bolt, and the other half paid back to the Pact. The card for a Hero behind on
   * the race rather than ahead of it: it trades tempo for time.
   */
  siphon_bolt: {
    id: 'siphon_bolt',
    name: 'Siphon Bolt',
    cost: { bones: 2, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'ability',
    text: 'Deals 20 spell damage to an enemy and restores 20 health to your Pact.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'spell', area: { shape: 'target' } },
        { op: 'heal', amount: 20 },
      ],
    },
    keywords: [],
  },

  // ================================================================ arcane construct

  /**
   * A row held by a stone.
   *
   * The colourless member of the pillar family — Coolant, Charnel, Briar — and the only one
   * whose tick is a hold rather than an element. Every enemy standing in its row starts its
   * turn Entangled, so a whole lane stops advancing until somebody breaks the obelisk; which
   * is why it has sixty health and not a hundred, and costs three.
   */
  warding_obelisk: {
    id: 'warding_obelisk',
    name: 'Warding Obelisk',
    cost: { bones: 3, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raises a 60 HP obelisk on an empty tile. Enemies in its row start each turn Entangled while it stands.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'warding_obelisk' },
    keywords: [],
    obstacleHp: 60,
    obstacleTurnStart: { status: 'entangle', stacks: 1 },
    leavesRubble: true,
  },
};
