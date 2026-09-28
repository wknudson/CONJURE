/**
 * The Vanguard's third muster: thirty-six bodies a warband can field.
 *
 * Four per elemental school, six colourless and six arcane. A school's bodies unlock when a
 * beast of that school is bound; neutral and arcane belong to everybody (`rosterUnlocksFor`).
 *
 * ## What each school was missing
 *
 * Every school's shelf had its two-point melee and most had a ranged body, and the gaps were
 * the same everywhere: few elites at four points, and only Pyre and Bulwark with a Behemoth —
 * which left `MAX_BEHEMOTHS` a rule most characters could never reach. So each school gets:
 *
 *  - **one two-point body** with a rider the school did not have on a body yet;
 *  - **one ranged body** at three, so no opening warband is short of reach;
 *  - **one elite** at four, a body worth building a line around;
 *  - **a 2x2 Behemoth** for the four schools that had none, and a second two-pointer for the
 *    two that did.
 *
 * The colourless twelve are the other half of the muster: soldiers anybody can hire, and the
 * arcane constructs the Hero's own workshop turns out. They are the reason a character who
 * has bound one beast still has a real choice to make on the Vanguard tab.
 *
 * ## The rules they keep
 *
 * Points are derived, never authored (`rosterPointsOf`): footprint 2 is six, a total cost of
 * four is an elite, reach past one is three, anything else two. Stats sit on the stretched
 * scale in tens. Every rider is one the engine already resolves — `onHit`, `trail`,
 * `deathburst`, `platesEachTurn`, `refunds`, `bonusVs`, `elementalMod`, `attackDtype`,
 * `attackProfile` — and every keyword is one the glossary already explains.
 */

import type { CardDef, UnitStatBlock } from '../../types/cards.js';
import type { Keyword, School } from '../../../contract/ids.js';

/**
 * One body, written the way every minion card is: summoned from its own territory, its
 * card's only effect the summon itself. A helper because thirty-six copies of the same eight
 * lines would bury what actually differs between them, which is the stat block.
 */
function body(
  id: string,
  name: string,
  school: School,
  bones: number,
  text: string,
  keywords: Keyword[],
  unit: Omit<UnitStatBlock, 'escalationBonus'> & { escalationBonus?: UnitStatBlock['escalationBonus'] },
): CardDef {
  return {
    id,
    name,
    cost: { bones, marrow: 0 },
    school,
    source: 'hero',
    kind: 'minion',
    text,
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: unit.footprint },
    effect: { op: 'summon', unitDef: id },
    keywords,
    unit: { escalationBonus: { atk: 0, hp: 0 }, ...unit },
  };
}

const MELEE = { rangeMin: 1, rangeMax: 1, footprint: 1 } as const;

export const VANGUARD_CARDS: Record<string, CardDef> = {
  // ======================================================================= pyre

  /** A Guardian that sets fire to what it blocks. Pyre's first body built to hold a line. */
  kiln_guard: body('kiln_guard', 'Kiln Guard', 'pyre', 2,
    'Guardian: blocks line of sight behind it. Whatever survives its blows catches fire (Burn 1).',
    ['Guardian'],
    { atk: 20, hp: 60, mov: 2, ...MELEE, archetype: 'bruiser', onHit: { status: 'burn', stacks: 1 } }),

  /** Four tiles a turn and fire behind it: the Ember Hound's pup, quicker and thinner. */
  salamander_whelp: body('salamander_whelp', 'Salamander Whelp', 'pyre', 2,
    'Every tile it walks off is left burning. Quick, and gone before the fire takes.',
    [],
    { atk: 20, hp: 30, mov: 4, ...MELEE, archetype: 'skirmisher', trail: 'burning' }),

  /** A marksman whose arrows are lit. Cannot hit what is adjacent. */
  flame_archer: body('flame_archer', 'Flame Archer', 'pyre', 3,
    'Shoots 2 to 4 tiles and sets what it hits alight (Burn 1). Cannot hit what is adjacent.',
    [],
    { atk: 20, hp: 30, mov: 2, rangeMin: 2, rangeMax: 4, footprint: 1, archetype: 'sniper', attackDtype: 'fire', onHit: { status: 'burn', stacks: 1 } }),

  /** The elite: slow, heavy, and it bursts into flame when it finally falls. */
  furnace_titan: body('furnace_titan', 'Furnace Titan', 'pyre', 4,
    'Counter. When it dies, every adjacent enemy catches fire (Burn 2). Weak to frost.',
    ['Counter'],
    { atk: 40, hp: 110, mov: 1, ...MELEE, archetype: 'bruiser', deathburst: { status: 'burn', stacks: 2 }, elementalMod: { frost: 20 } }),

  // ====================================================================== frost

  /** A mote of cold that hangs back and chills. Frost's cheap caster. */
  frost_wisp: body('frost_wisp', 'Frost Wisp', 'frost', 2,
    'Whatever survives its touch takes Chill 1. The third stack freezes a unit solid.',
    [],
    { atk: 10, hp: 30, mov: 3, ...MELEE, archetype: 'caster', attackDtype: 'frost', onHit: { status: 'chill', stacks: 1 } }),

  /** A bolt-thrower on a sled. It fires straight or not at all. */
  frost_ballista: body('frost_ballista', 'Frost Ballista', 'frost', 3,
    'Fires only along a rank, file or diagonal, 2 to 5 tiles. Cannot hit what is adjacent.',
    [],
    { atk: 40, hp: 40, mov: 1, rangeMin: 2, rangeMax: 5, footprint: 1, archetype: 'sniper', attackDtype: 'frost', attackProfile: 'lineOnly' }),

  /** The elite: plates itself in ice every turn and chills what it strikes. */
  permafrost_troll: body('permafrost_troll', 'Permafrost Troll', 'frost', 4,
    'Grows 10 Armor of ice every turn. Whatever survives its blows takes Chill 1. Weak to fire.',
    [],
    { atk: 40, hp: 100, mov: 1, ...MELEE, archetype: 'bruiser', platesEachTurn: 10, onHit: { status: 'chill', stacks: 1 }, elementalMod: { fire: 20 } }),

  /** Frost's first Behemoth: a glacier that walks, and chills whatever stands in its way. */
  frost_colossus: body('frost_colossus', 'Frost Colossus', 'frost', 5,
    'Power Tier. 2x2 Behemoth. Whatever survives its blows takes Chill 1. Cannot enter 1x1 gaps.',
    ['PowerTier'],
    { atk: 40, hp: 140, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 2, archetype: 'behemoth', onHit: { status: 'chill', stacks: 1 } }),

  // ====================================================================== surge

  /** Haste, and a shock bite that leaves its target Charged. */
  spark_imp: body('spark_imp', 'Spark Imp', 'surge', 2,
    'Haste. Its bite is shock, so whatever survives it is left Charged.',
    ['Haste'],
    { atk: 20, hp: 30, mov: 3, ...MELEE, archetype: 'skirmisher', attackDtype: 'shock' }),

  /** A lancer with a coil for a spear: shock at two to three tiles. */
  coil_lancer: body('coil_lancer', 'Coil Lancer', 'surge', 3,
    'Strikes 2 to 3 tiles away in shock, leaving what survives Charged. Cannot hit what is adjacent.',
    [],
    { atk: 30, hp: 40, mov: 2, rangeMin: 2, rangeMax: 3, footprint: 1, archetype: 'caster', attackDtype: 'shock' }),

  /** The elite: a brute wired to a battery that pays a Bone back when it dies. */
  galvanic_brute: body('galvanic_brute', 'Galvanic Brute', 'surge', 4,
    'Its blows are shock, leaving what survives Charged. Refunds 1 Bone when it dies. Weak to impact.',
    [],
    { atk: 40, hp: 90, mov: 2, ...MELEE, archetype: 'bruiser', attackDtype: 'shock', refunds: { onDeath: 1 }, elementalMod: { impact: 20 } }),

  /** Surge's first Behemoth: an engine of the storm, still humming. */
  tempest_engine: body('tempest_engine', 'Tempest Engine', 'surge', 5,
    'Power Tier. 2x2 Behemoth. Its blows are shock, leaving what survives Charged. Cannot enter 1x1 gaps.',
    ['PowerTier'],
    { atk: 40, hp: 130, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 2, archetype: 'behemoth', attackDtype: 'shock', platesEachTurn: 10 }),

  // ==================================================================== bulwark

  /** A mason who holds the wall and hits back. Low attack, very hard to move. */
  rampart_mason: body('rampart_mason', 'Rampart Mason', 'bulwark', 2,
    'Guardian and Counter: blocks line of sight behind it, and strikes back when hit in melee.',
    ['Guardian', 'Counter'],
    { atk: 10, hp: 70, mov: 1, ...MELEE, archetype: 'bruiser' }),

  /** Quick horns, for the one Bulwark body that goes somewhere. */
  ramming_goat: body('ramming_goat', 'Ramming Goat', 'bulwark', 2,
    'Its blows are impact, which shatters anything Frozen. Quick on its feet for a Bulwark body.',
    [],
    { atk: 20, hp: 40, mov: 3, ...MELEE, archetype: 'skirmisher', attackDtype: 'impact' }),

  /** A slinger that throws over anything, in stone. */
  boulder_slinger: body('boulder_slinger', 'Boulder Slinger', 'bulwark', 3,
    'Throws 2 to 4 tiles over anything, needing no line of sight, for impact damage. Cannot hit what is adjacent.',
    [],
    { atk: 30, hp: 40, mov: 1, rangeMin: 2, rangeMax: 4, footprint: 1, archetype: 'caster', attackDtype: 'impact', attackProfile: 'arcing' }),

  /** The elite: iron that plates itself and breaks what is frozen. */
  iron_juggernaut: body('iron_juggernaut', 'Iron Juggernaut', 'bulwark', 4,
    'Grows 10 Armor every turn. Deals 30 more to anything Frozen. Weak to shock.',
    [],
    { atk: 40, hp: 110, mov: 1, ...MELEE, archetype: 'bruiser', platesEachTurn: 10, attackDtype: 'impact', bonusVs: { statuses: ['freeze'], amount: 30 }, elementalMod: { shock: 20 } }),

  // ======================================================================= dusk

  /** Bones that rattle back into a Bone when they fall. */
  bone_rattler: body('bone_rattler', 'Bone Rattler', 'dusk', 2,
    'Quick and thin. Refunds 1 Bone when it dies — including bled dry by a tithe.',
    [],
    { atk: 20, hp: 30, mov: 3, ...MELEE, archetype: 'skirmisher', refunds: { onDeath: 1 } }),

  /** A dead archer, whose arrows rot. */
  wight_archer: body('wight_archer', 'Wight Archer', 'dusk', 3,
    'Shoots 2 to 4 tiles in decay and poisons what it hits (Toxin 1). Cannot hit what is adjacent.',
    [],
    { atk: 20, hp: 30, mov: 2, rangeMin: 2, rangeMax: 4, footprint: 1, archetype: 'sniper', attackDtype: 'decay', onHit: { status: 'toxin', stacks: 1 } }),

  /** The elite: a knight still in its mail, bred to be bled. */
  grave_knight: body('grave_knight', 'Grave Knight', 'dusk', 4,
    'Counter. Its blows are decay. Yields 2 more Marrow when tithed. Weak to fire.',
    ['Counter'],
    { atk: 40, hp: 100, mov: 2, ...MELEE, archetype: 'bruiser', attackDtype: 'decay', titheBonus: 2, elementalMod: { fire: 20 } }),

  /** Dusk's first Behemoth: an ossuary that got up. It hunts the Brittle. */
  bone_colossus: body('bone_colossus', 'Bone Colossus', 'dusk', 5,
    'Power Tier. 2x2 Behemoth. Deals 20 more to anything Brittle. Cannot enter 1x1 gaps.',
    ['PowerTier'],
    { atk: 50, hp: 140, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 2, archetype: 'behemoth', bonusVs: { statuses: ['brittle'], amount: 20 } }),

  // ====================================================================== bloom

  /** A sprout that grows while it holds, and poisons what it holds against. */
  thorn_sprout: body('thorn_sprout', 'Thorn Sprout', 'bloom', 2,
    'Growth. Whatever survives its thorns is poisoned (Toxin 1).',
    ['Growth'],
    { atk: 10, hp: 50, mov: 1, ...MELEE, archetype: 'bruiser', onHit: { status: 'toxin', stacks: 1 }, escalationBonus: { atk: 10, hp: 10 } }),

  /** A pod-launcher that fires toxin at range. */
  spore_archer: body('spore_archer', 'Spore Archer', 'bloom', 3,
    'Shoots 2 to 4 tiles and poisons what it hits (Toxin 2). Cannot hit what is adjacent.',
    [],
    { atk: 20, hp: 30, mov: 2, rangeMin: 2, rangeMax: 4, footprint: 1, archetype: 'sniper', attackDtype: 'toxic', onHit: { status: 'toxin', stacks: 2 } }),

  /** The elite: an old oak that stands in front of everything. */
  oakheart_guardian: body('oakheart_guardian', 'Oakheart Guardian', 'bloom', 4,
    'Guardian and Growth: blocks line of sight behind it, and gets bigger every turn it stands. Weak to fire.',
    ['Guardian', 'Growth'],
    { atk: 30, hp: 120, mov: 1, ...MELEE, archetype: 'bruiser', elementalMod: { fire: 20 }, escalationBonus: { atk: 10, hp: 10 } }),

  /** Bloom's first Behemoth: a hill with a back of moss, that bursts in spores as it dies. */
  mossback_colossus: body('mossback_colossus', 'Mossback Colossus', 'bloom', 5,
    'Power Tier. 2x2 Behemoth. When it dies, every adjacent enemy is poisoned (Toxin 3). Cannot enter 1x1 gaps.',
    ['PowerTier'],
    { atk: 40, hp: 150, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 2, archetype: 'behemoth', deathburst: { status: 'toxin', stacks: 3 } }),

  // ==================================================================== neutral

  /** A levied pike: holds, and hits back. */
  militia_pikeman: body('militia_pikeman', 'Militia Pikeman', 'neutral', 2,
    'Counter: strikes back for its full Attack whenever it is hit in melee and survives.',
    ['Counter'],
    { atk: 20, hp: 50, mov: 2, ...MELEE, archetype: 'bruiser' }),

  /** A runner. Four tiles a turn and in the fight the turn it lands. */
  road_scout: body('road_scout', 'Road Scout', 'neutral', 2,
    'Haste. Fast and fragile: four tiles a turn.',
    ['Haste'],
    { atk: 10, hp: 30, mov: 4, ...MELEE, archetype: 'skirmisher' }),

  /** A hound trained to go for the weakest thing on the field. */
  war_dog: body('war_dog', 'War Dog', 'neutral', 2,
    'Deals 20 more to anything Entangled or Stunned. It goes for whatever cannot run.',
    [],
    { atk: 20, hp: 40, mov: 3, ...MELEE, archetype: 'skirmisher', bonusVs: { statuses: ['entangle', 'stun'], amount: 20 } }),

  /** A hired crossbow. Plain, reliable, three tiles of reach. */
  crossbowman: body('crossbowman', 'Crossbowman', 'neutral', 3,
    'Shoots 2 to 4 tiles. Cannot hit what is adjacent.',
    [],
    { atk: 30, hp: 30, mov: 2, rangeMin: 2, rangeMax: 4, footprint: 1, archetype: 'sniper' }),

  /** The elite: a sergeant who holds the line and makes the line hold. */
  sergeant_at_arms: body('sergeant_at_arms', 'Sergeant-at-Arms', 'neutral', 4,
    'Guardian and Counter: blocks line of sight behind it, and strikes back when hit in melee.',
    ['Guardian', 'Counter'],
    { atk: 30, hp: 100, mov: 2, ...MELEE, archetype: 'bruiser' }),

  /** A siege ram on wheels: the colourless Behemoth, for walls and whoever is behind them. */
  battering_ram: body('battering_ram', 'Battering Ram', 'neutral', 5,
    'Power Tier. 2x2 Behemoth. Its blows are impact, which shatters anything Frozen. Cannot enter 1x1 gaps.',
    ['PowerTier'],
    { atk: 50, hp: 120, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 2, archetype: 'behemoth', attackDtype: 'impact' }),

  // ===================================================================== arcane

  /** A familiar that refunds a Bone each time it strikes. */
  arcane_familiar: body('arcane_familiar', 'Arcane Familiar', 'arcane', 2,
    'Its touch is spell damage. Refunds 1 Bone each time it attacks.',
    [],
    { atk: 10, hp: 30, mov: 3, ...MELEE, archetype: 'caster', attackDtype: 'spell', refunds: { onAttack: 1 } }),

  /** A rune-carved golem that holds the line. */
  rune_golem: body('rune_golem', 'Rune Golem', 'arcane', 2,
    'Guardian: blocks line of sight behind it. Its blows are spell damage.',
    ['Guardian'],
    { atk: 20, hp: 60, mov: 1, ...MELEE, archetype: 'bruiser', attackDtype: 'spell' }),

  /** A blade that cuts with light. Quick, and hits hard for its size. */
  spellblade: body('spellblade', 'Spellblade', 'arcane', 2,
    'Its blows are spell damage, which sets off Cinder and Rime Marks. Thin, and quick.',
    [],
    { atk: 30, hp: 30, mov: 3, ...MELEE, archetype: 'skirmisher', attackDtype: 'spell' }),

  /** An archer whose bolts are drawn light. Fires straight or not at all. */
  aether_archer: body('aether_archer', 'Aether Archer', 'arcane', 3,
    'Fires spell damage only along a rank, file or diagonal, 2 to 5 tiles. Cannot hit what is adjacent.',
    [],
    { atk: 30, hp: 30, mov: 2, rangeMin: 2, rangeMax: 5, footprint: 1, archetype: 'sniper', attackDtype: 'spell', attackProfile: 'lineOnly' }),

  /** A glyph on a post that throws over anything. It does not move. */
  glyph_turret: body('glyph_turret', 'Glyph Turret', 'arcane', 3,
    'Cannot move. Throws spell damage 1 to 4 tiles over anything, needing no line of sight.',
    [],
    { atk: 30, hp: 50, mov: 0, rangeMin: 1, rangeMax: 4, footprint: 1, archetype: 'caster', attackDtype: 'spell', attackProfile: 'arcing' }),

  /** The elite: a warding construct that plates itself and stands in front. */
  warden_construct: body('warden_construct', 'Warden Construct', 'arcane', 4,
    'Guardian. Grows 10 Armor every turn. Weak to impact.',
    ['Guardian'],
    { atk: 30, hp: 100, mov: 1, ...MELEE, archetype: 'bruiser', platesEachTurn: 10, elementalMod: { impact: 20 } }),
};
