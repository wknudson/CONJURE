/**
 * Combat initialisation: builds a GameState from an encounter definition.
 */

import type { CardInstanceId, Coord, School, Side } from '../../contract/ids.js';
import type { GameState, StepResult, CommanderState } from '../types/state.js';
import { territoryDepthFor, startingZone } from '../types/state.js';
import { canPlace } from './board.js';
import type { Ctx } from './context.js';
import type { CardInstance, CardModifier } from '../types/cards.js';
import type { EncounterDef } from '../data/encounters/registry.js';
import { getEncounterScript } from '../data/encounters/registry.js';
import type { RngState } from '../util/rng.js';
import { makeRng, nextInt, shuffle } from '../util/rng.js';
import { cellsOf } from '../util/grid.js';
import { CARDS } from '../data/cards/index.js';
import { makeCtx, emit } from './context.js';
import { DEFAULT_COMPANION, companionById } from '../data/companions.js';
import { rosterBudgetFor } from '../data/roster.js';
import { HAND_LIMIT, OPENING_HAND, PIP_CAP, drawCards } from './deck.js';
import { placeOpeningUnit, spawnObstacle } from './spawn.js';
import { beginTurn } from './turn.js';
import { resolveGrimoire } from '../data/grimoire.js';
import { printedWith } from '../data/collection.js';

/**
 * Where the Hero and Companion stand: they flank the board, Hero left of centre and
 * Companion right. The Companion's column is the lane its Resonance passive watches.
 *
 * Exported because the test scenario builder needs the identical placement — two copies
 * of this arithmetic drifted apart once already.
 */
export function flankColumns(width: number): { heroColumn: number; companionColumn: number } {
  return {
    heroColumn: Math.max(0, Math.floor((width - 1) / 2) - 1),
    companionColumn: Math.min(width - 1, Math.ceil((width - 1) / 2) + 1),
  };
}

interface CommanderOpts {
  name: string;
  companionName?: string;
  companionSchool: School;
  hp: number;
  deckDefs: string[];
  /**
   * What each Grimoire spell rolled on the beast that brought it, keyed by def id.
   *
   * Applied per *instance* as the draw pile is built, which is what lets the same spell be
   * cheap in one fight and ordinary in the next without anything global changing.
   */
  spellModifiers?: Record<string, CardModifier>;
  /**
   * Where the Companion's half of the deck starts in `deckDefs`.
   *
   * Everything from here on is Grimoire and may carry a modifier; everything before it is
   * the Hero Deck and never does. An index rather than two lists, because the shuffle
   * wants one pile and splitting it here would only mean joining it two lines later.
   */
  grimoireFrom?: number;
  prefix: string;
  width: number;
}

function buildCommander(o: CommanderOpts): { commander: CommanderState; nextId: number } {
  const { name, companionName, companionSchool, hp, deckDefs, prefix, width } = o;
  const startId = 0;
  const cards: Record<CardInstanceId, CardInstance> = {};
  const deck: CardInstanceId[] = [];
  let id = startId;

  const from = o.grimoireFrom ?? deckDefs.length;
  deckDefs.forEach((defId, index) => {
    id += 1;
    const instanceId = `${prefix}${id}`;
    // Only the Companion's half can have rolled anything. A Hero Deck card with a modifier
    // would mean a roll the player never caught.
    const mods = index >= from ? o.spellModifiers?.[defId] : undefined;
    cards[instanceId] = { instanceId, defId, ...(mods ? { mods: { ...mods } } : {}) };
    deck.push(instanceId);
  });

  const { heroColumn, companionColumn } = flankColumns(width);

  return {
    commander: {
      name,
      ...(companionName ? { companionName } : {}),
      companionSchool,
      heroColumn,
      companionColumn,
      reactionPipsThisTurn: 0,
      roster: [],
      hp,
      maxHp: hp,
      armor: 0,
      pips: 0,
      marrow: 0,
      deck,
      hand: [],
      discard: [],
      cards,
      handLimit: HAND_LIMIT,
      pipCap: PIP_CAP,
      ignoresFog: false,
      immuneToBurn: false,
      immuneToToxin: false,
      ignoresIceSlip: false,
      revealsIntents: false,
      bonusObstacleHp: 0,
      bonusTitheMarrow: 0,
      healOnTithe: 0,
      bonusToxinStacks: 0,
      boundFormIgnoresHazards: false,
      boundFormGrounded: false,
      resonancesThisTurn: 0,
      doubleResonance: false,
      discountHybrids: false,
      collisionResist: 0,
      ignoresGuardians: false,
      fogConceals: false,
      steamBurns: 0,
      arcPierces: false,
      armorOnArcCollateral: 0,
      alliesGrounded: false,
      wildfireSeedsToxin: 0,
      chillConducts: false,
      bonusFreezeStacks: 0,
      immuneToShatterSplash: false,
      bonusShoveDistance: 0,
    },
    nextId: id,
  };
}

/** Smallest arena the rules stay coherent on, and the largest worth framing. */
export const MIN_ARENA = 4;
export const MAX_ARENA = 12;

/**
 * Rejects an unplayable arena at construction rather than midway through a battle.
 *
 * Encounters are hand-authored data, so these are authoring mistakes, not player
 * actions — a plain Error, not an IllegalCommandError. Nothing checked any of this
 * before: a typo in a coordinate produced terrain quietly dropped on the floor, and an
 * arena too small to hold two territories produced a game with no neutral ground.
 */
export function validateEncounter(encounter: EncounterDef): void {
  const { id, width, height } = encounter;
  if (width < MIN_ARENA || height < MIN_ARENA) {
    throw new Error(`${id}: arena ${width}x${height} is below the ${MIN_ARENA}x${MIN_ARENA} minimum`);
  }
  if (width > MAX_ARENA || height > MAX_ARENA) {
    throw new Error(`${id}: arena ${width}x${height} exceeds the ${MAX_ARENA}x${MAX_ARENA} maximum`);
  }

  const within = (c: Coord): boolean => c.x >= 0 && c.y >= 0 && c.x < width && c.y < height;

  // Terrain in a summon zone would silently shrink the deployable area instead of
  // announcing itself, so it is a hard error rather than a judgement call.
  const depth = territoryDepthFor(height);
  const homeRows = new Set<number>();
  for (let i = 0; i < depth; i++) homeRows.add(i).add(height - 1 - i);

  for (const t of encounter.terrain ?? []) {
    if (!within(t.at)) throw new Error(`${id}: terrain at ${t.at.x},${t.at.y} is outside the arena`);
    if (homeRows.has(t.at.y)) {
      throw new Error(`${id}: terrain at ${t.at.x},${t.at.y} sits in a territory row`);
    }
  }

  for (const [defId, x, y] of encounter.enemyOpeningBoard) {
    if (!within({ x, y })) {
      throw new Error(`${id}: opening unit ${defId} at ${x},${y} is outside the arena`);
    }
  }
}

/**
 * Advantages a fight can begin with, in the engine's own vocabulary.
 *
 * Every field is additive and optional, so a fight with no boons is the same fight the
 * engine has always built. Defined here rather than beside the brews that produce them:
 * the engine may not import the overworld, and this is the engine's word for the thing.
 */
export interface CombatBoons {
  /** Persistent Armor on the Commander at the opening bell. */
  armor?: number;
  /** Added to the starting Pip bank. */
  pips?: number;
  /** Drawn on top of the ordinary opening hand. */
  extraOpeningCards?: number;
  /**
   * Raises the Pip ceiling for the whole fight.
   *
   * The ceiling rather than a delta, so two sources of the same relic are one relic and
   * the number here is the number the cleanup uses. Ignored when lower than the default:
   * gear bends a rule in the player's favour or not at all.
   */
  maxPips?: number;
  /**
   * Line of sight is no longer broken by fog or steam.
   *
   * A flag rather than a number, because this is the shape most of this gear takes: it
   * changes what is *possible*, not what anything hits for.
   */
  ignoreFog?: boolean;
  /** Burn stops ticking on this side entirely. */
  immuneToBurn?: boolean;
  /** Ice underfoot no longer costs this side its footing. */
  ignoreIceSlip?: boolean;
  /** Toxin stops ticking on this side. The one status armour cannot answer. */
  immuneToToxin?: boolean;
  /**
   * The opposition declares its card plays as well as its blows.
   *
   * Phrased as a capability of the side that *reads* them rather than as a difficulty
   * setting, so the engine still knows nothing about who is watching or why.
   */
  revealIntents?: boolean;
  /** Added to the health of every obstacle this side raises from a card. */
  bonusObstacleHp?: number;
  /** Added to the Marrow every tithe this side makes pays out. */
  bonusTitheMarrow?: number;
  /** Health returned to the Pact each time this side gives a body up. */
  healOnTithe?: number;
  /** Extra stacks folded into every Toxin this side applies. */
  bonusToxinStacks?: number;
  /**
   * The Bound Form walks over broken ground and is not caught by currents.
   *
   * Scoped to the Bound Form rather than the whole army because that is the body the trait
   * belongs to — a Companion's own nature does not travel to the minions it fights beside.
   */
  boundFormIgnoresHazards?: boolean;
  /** The Bound Form cannot be shoved, pulled, or carried by anything. */
  boundFormGrounded?: boolean;
  /** Raises how many cards this side may hold through end of turn. */
  bonusHandLimit?: number;
  /** Resonance fires on the first *two* Companion cards each turn rather than one. */
  doubleResonance?: boolean;
  /** Spliced cards cost 1 Pip less, never below one. Marrow is untouched. */
  discountHybrids?: boolean;
  /**
   * Collision damage this side's units shrug off, per hit.
   *
   * A subtraction rather than a flag, because a collision comes in three sizes — 3 into
   * the body shoved, 2 into whatever it hit, 3 into a wall — and a plate that cancelled
   * all of them equally would be a different rule at each. Floored at zero where it is
   * read: a shove that ends up dealing nothing still *moves* the body, which is most of
   * what a shove was for.
   */
  collisionResist?: number;
  /**
   * This side's ranged attacks and spells see past a **Guardian**.
   *
   * Deliberately narrow. It does not see through walls, cover, Behemoths or fog: it is a
   * rule about a keyword, not about geometry, which keeps `arcing` the answer to terrain
   * and makes this the answer to a screen.
   */
  ignoreGuardians?: boolean;

  // ------------------------------------------------------- the hybrid knacks
  //
  // Ten capabilities the hybrid bloodlines asked for. Each is one read at one existing
  // chokepoint, in the engine's own words, exactly as every boon above it: the reducer
  // still has never heard of a Storm-Mantis.

  /**
   * A unit of this side standing in steam is not a legal target for a ranged attack.
   *
   * The exact inverse of the rule `occluderCells` documents — fog blocks shooting
   * *through* the cloud while leaving whoever is inside it shootable. Goggles still win:
   * a viewer with `ignoresFog` reads the tile as empty air and picks the body out of it,
   * which keeps the two rules an answer to each other rather than a stack.
   */
  fogConceals?: boolean;
  /**
   * Damage steam raised by this side deals to enemies standing in it at their turn start.
   *
   * Attributed to the hazard's owner, not to whoever's turn it is, for the same reason
   * `toxinBonus` is: the fog you paid for should collect on the enemy's clock.
   */
  steamBurns?: number;
  /** Arc's collateral is dealt as `true` damage, so plate does not soak the jump. */
  arcPierces?: boolean;
  /** Armor granted to one of this side's units each time Arc collateral strikes it. */
  armorOnArcCollateral?: number;
  /**
   * Nothing this side owns can be shoved, pulled, or carried.
   *
   * The army-wide reading of `boundFormGrounded`, checked at the same chokepoint. It cuts
   * both ways there too: your own repositioning tools stop working on your own line.
   */
  alliesGrounded?: boolean;
  /** Toxin stacks Wildfire leaves on whatever survives the blast. */
  wildfireSeedsToxin?: number;
  /** Chill satisfies a reaction that asks for Charged, and is spent in its place. */
  chillConducts?: boolean;
  /** Extra Freeze stacks this side's Chill converts into — one stack is one more turn. */
  bonusFreezeStacks?: number;
  /** Shatter's shrapnel does not touch this side. */
  immuneToShatterSplash?: boolean;
  /** Tiles added to every shove this side's *cards* deal out. Currents are not yours. */
  bonusShoveDistance?: number;
}

/**
 * What a run carries into a fight.
 *
 * Deliberately expressed in the engine's own terms — health, armour, pips, cards — and
 * not as a buff id or an overworld reference. A `createCombat` that knew what
 * "ironbrew" meant would be a combat engine you could not test without an overworld, and
 * adding a fourth brew would mean editing the reducer. The overworld translates; the
 * engine only ever receives numbers.
 */
export interface CombatCarry {
  /**
   * What the active Companion's Grimoire rolled.
   *
   * Travels on the carry rather than being looked up, because the engine has never heard
   * of a `CompanionInstance` — the overworld resolves the beast to its numbers, exactly as
   * it already does for relics and knacks.
   */
  spellModifiers?: Record<string, CardModifier>;
  /**
   * Pact health at the opening bell. Absent means full, as a standalone fight always is.
   *
   * The ceiling is untouched by this, so a wounded character fights at 12/40 rather than
   * at 12/12 — the gauge has to show how much was already lost.
   */
  startingHp?: number;
  /**
   * The Pact's ceiling, overriding the encounter's own.
   *
   * Present when a character exists, because their gauge is the authority and it moves:
   * a levelled Companion raises it. Absent for a standalone fight, which uses whatever
   * the encounter printed.
   */
  maxHp?: number;
  boons?: CombatBoons;
  /**
   * What each Vanguard body has trained to, by def id. Anything absent fights at 1.
   *
   * A flat `defId -> level` map, translated by the overworld exactly as a relic is
   * translated into "3 Armor": the reducer is handed a level and has never heard of XP,
   * a Profile, or a progression curve. Whenever there is a levelling curve, it lives
   * entirely outside this file.
   */
  vanguardLevels?: Record<string, number>;
  /**
   * The eight spells the tethered Companion actually knows.
   *
   * Travels on the carry rather than being looked up, for the same reason the rolls do:
   * the engine has never heard of a `CompanionInstance`, and which cards a *particular*
   * beast drafted is a fact about that beast rather than about its species.
   */
  grimoire?: string[];
  /**
   * Spells socketed over the drafted ones, by slot index.
   *
   * A plain `slot -> defId` record, exactly as `vanguardLevels` is a plain `defId -> level`
   * one. The reducer is handed the swap already decided and has never heard of a
   * `CompanionInstance`, a Forge, or the school rule that let the swap happen.
   */
  grimoireOverrides?: Record<number, string>;
  /**
   * Base card ids the character has Ascended, so the Companion's half arrives at Rank 2.
   *
   * The Hero half is printed by the caller before it ever reaches here, and for a long
   * time the Grimoire was not -- so a player could pay Ducats, Shards and a Core to raise
   * Flame Surge and then watch their Ignis deal the Rank 1 printing all fight. The two
   * halves are resolved in different places (the sockets are applied *here*), so the
   * printing has to happen here too, and the list is what makes that possible without the
   * reducer learning what a collection is.
   */
  ascended?: readonly string[];
}

/**
 * The fewest Anchor Tiles any arena offers, however small the warband.
 *
 * A floor rather than a fixed count: deployment is a decision about shape, and three lit
 * tiles for three units is not a decision at all.
 */
export const MIN_ANCHORS = 5;

/**
 * Where the Vanguard may stand.
 *
 * **The Anchor Guarantee: the ground never benches what the arena's budget seats.** The count
 * is always at least what this board will field, and always at least `MIN_ANCHORS`. That is
 * what makes the point-buy honest — if a cramped biome could refuse to seat a body the budget
 * paid for, the correct play would become "never fill your budget", and a point-buy that
 * punishes spending its own budget is not a build system.
 *
 * What changed when budgets became grid-derived: the guarantee is now about the *arena's*
 * allowance rather than the whole kit. A character carrying a 24-point warband into a 4x6 ruin
 * is holding most of it back by rule, so lighting an anchor for every body it owns would flood
 * the starting zone and spill anchors into neutral ground for units that can never be placed.
 * The caller passes what the budget will actually seat; the guarantee covers that, exactly.
 *
 * The biome still shapes the formation, and that is the whole intended difficulty: anchors
 * in a line, split around a wall, or backed into a corner. It simply may not shrink what the
 * budget allows.
 *
 * Runs at a fixed point in the setup order, before the geodes, because the seeded stream is
 * positional — moving this call moves every geode in every replay.
 */
function placeAnchors(state: GameState, rng: RngState, want: number): Coord[] {
  const need = Math.max(want, MIN_ANCHORS);
  const rows = startingZone(state, 'player');

  // Free ground in the starting zone first: no terrain, no body, nothing standing.
  const open: Coord[] = [];
  for (const y of rows) {
    for (let x = 0; x < state.width; x++) {
      const at = { x, y };
      if (occupiedTile(state, at)) continue;
      open.push(at);
    }
  }

  // Widen a row at a time if the zone alone cannot seat the warband. The guarantee outranks
  // the tidiness of keeping every anchor behind the line.
  let extra = rows.length;
  while (open.length < need && extra < state.height) {
    const y = state.height - 1 - extra;
    if (y < 0) break;
    for (let x = 0; x < state.width; x++) {
      const at = { x, y };
      if (occupiedTile(state, at)) continue;
      open.push(at);
    }
    extra += 1;
  }

  if (open.length <= need) return open;

  // More ground than we need: take a seeded sample, but seat an adjacent pair first so a
  // 2x2 Behemoth is always placeable. A roster that spent six points on a body it cannot
  // put down is a point-buy betraying the player at the last possible moment.
  const chosen: Coord[] = [];
  const pair = adjacentPair(open);
  if (pair) chosen.push(...pair);

  const rest = open.filter((c) => !chosen.some((k) => k.x === c.x && k.y === c.y));
  while (chosen.length < need && rest.length > 0) {
    chosen.push(rest.splice(nextInt(rng, rest.length), 1)[0]!);
  }
  return chosen;
}

/** Two horizontally adjacent free tiles on one row, if the ground offers any. */
function adjacentPair(open: Coord[]): [Coord, Coord] | undefined {
  for (const a of open) {
    const b = open.find((c) => c.y === a.y && c.x === a.x + 1);
    if (b) return [a, b];
  }
  return undefined;
}

/** Anything standing on or filling a tile: a unit, or solid terrain. */
function occupiedTile(state: GameState, at: Coord): boolean {
  for (const u of Object.values(state.units)) {
    if (cellsOf(u).some((c) => c.x === at.x && c.y === at.y)) return true;
  }
  for (const o of Object.values(state.obstacles)) {
    if (o.anchor.x === at.x && o.anchor.y === at.y) return true;
  }
  return false;
}

/** How much a piece of encounter scenery takes to break, per its own definition. */
function terrainHp(isCover: boolean): number {
  return CARDS[isCover ? 'terrain_cover' : 'terrain_wall']?.obstacleHp ?? 10;
}

export function createCombat(
  encounter: EncounterDef,
  seed: number,
  companionId?: string,
  deck?: string[],
  carry?: CombatCarry,
  /**
   * The player's Vanguard, as def ids.
   *
   * Optional, and omitting it is what keeps every legacy encounter and every existing test
   * behaving exactly as before: no roster means no Anchor Tiles, no deployment phase, and
   * a fight that opens on turn one the way it always has.
   */
  roster?: string[],
  /**
   * Squads the overworld's Combat Ring dragged in, one array of card ids per pulled mob.
   *
   * A separate parameter rather than a field on `CombatCarry`, because the carry is the
   * player's side of the ledger by definition — health, armour, pips, cards — and this is
   * the only thing the overworld has ever had to say about the *enemy*. Folding it in there
   * would make that promise false for one field and leave the next reader guessing which
   * kind it was.
   */
  wave2?: readonly (readonly string[])[],
): StepResult {
  validateEncounter(encounter);

  const rng = makeRng(seed);

  // The chosen Companion decides the player's deck and Resonance school; the encounter
  // only supplies a default.
  const companion =
    companionById(companionId ?? '') ?? companionById(encounter.companionId ?? '') ?? DEFAULT_COMPANION;

  /**
   * The Fused Grimoire: the Hero half the player built, then the eight the Companion always
   * brings.
   *
   * Concatenated rather than interleaved, and shuffled immediately afterwards, so the join
   * is invisible by the time anything is drawn. The order matters only for `grimoireFrom`,
   * which is how the instance builder knows which half may carry a roll.
   */
  const heroDeck = deck && deck.length > 0 ? deck : companion.deck;
  // The beast's own drafted eight when a beast is standing there, and the species' legacy
  // list when nothing brought one — a standalone bout, a test, a fight with no character
  // behind it. Both are eight cards; only one of them was rolled for.
  const drafted =
    carry?.grimoire && carry.grimoire.length > 0 ? carry.grimoire : companion.legacyGrimoire;
  // The sockets, applied before the two halves are joined. `resolveGrimoire` is the single
  // definition of "what is actually in this Grimoire", shared with the Field Journal that
  // edits it -- two readings of that question is how a screen comes to show one book while
  // the board deals another.
  // Sockets first, then printings. The order matters and only reads one way: a socketed
  // card is a card, so it earns its Rank 2 exactly as a drafted one does -- printing before
  // socketing would raise the card being replaced and leave the replacement at Rank 1.
  const socketed = resolveGrimoire(drafted, carry?.grimoireOverrides);
  const ascended = carry?.ascended ?? [];
  const grimoire = socketed.map((id) => printedWith(ascended, id));

  const player = buildCommander({
    name: encounter.playerName,
    companionName: companion.name,
    companionSchool: companion.school,
    hp: encounter.playerHp,
    deckDefs: [...heroDeck, ...grimoire],
    grimoireFrom: heroDeck.length,
    ...(carry?.spellModifiers ? { spellModifiers: carry.spellModifiers } : {}),
    prefix: 'pc',
    width: encounter.width,
  });
  const enemy = buildCommander({
    name: encounter.enemyName,
    companionSchool: encounter.enemySchool,
    hp: encounter.enemyHp,
    deckDefs: encounter.enemyDeck,
    prefix: 'ec',
    width: encounter.width,
  });

  player.commander.deck = shuffle(rng, player.commander.deck);
  enemy.commander.deck = shuffle(rng, enemy.commander.deck);

  // Frontal contact opens symmetric at 3 Pips. beginTurn adds the first
  // turn's +1 on top, so the player acts meaningfully from turn one.
  const opening = encounter.startingPips ?? 3;
  player.commander.pips = opening + (carry?.boons?.pips ?? 0);
  enemy.commander.pips = opening;

  // A raised ceiling has to land before the health is clamped against it, or levelling a
  // Companion would buy a bigger gauge that the first clamp immediately spent.
  if (carry?.maxHp !== undefined && carry.maxHp > 0) {
    player.commander.maxHp = carry.maxHp;
  }

  // A Pact does not heal between contracts. Clamped to the ceiling so a stale carried
  // value cannot start a fight above full.
  if (carry?.startingHp !== undefined) {
    player.commander.hp = Math.max(0, Math.min(player.commander.maxHp, carry.startingHp));
  }
  player.commander.armor += carry?.boons?.armor ?? 0;

  // Only upward. A relic may raise the ceiling; nothing in the data may lower it, so a
  // malformed save cannot hand the player a worse fight than the rules give them.
  const ceiling = carry?.boons?.maxPips ?? 0;
  if (ceiling > player.commander.pipCap) player.commander.pipCap = ceiling;

  if (carry?.boons?.ignoreFog) player.commander.ignoresFog = true;
  if (carry?.boons?.immuneToBurn) player.commander.immuneToBurn = true;
  if (carry?.boons?.immuneToToxin) player.commander.immuneToToxin = true;
  if (carry?.boons?.ignoreIceSlip) player.commander.ignoresIceSlip = true;
  if (carry?.boons?.revealIntents) player.commander.revealsIntents = true;

  // Additive, and floored at zero for the same reason the ceiling only moves up: a
  // hand-edited negative must not make the player's walls flimsier than the card says.
  player.commander.bonusObstacleHp += Math.max(0, carry?.boons?.bonusObstacleHp ?? 0);
  player.commander.bonusTitheMarrow += Math.max(0, carry?.boons?.bonusTitheMarrow ?? 0);
  player.commander.healOnTithe += Math.max(0, carry?.boons?.healOnTithe ?? 0);
  player.commander.bonusToxinStacks += Math.max(0, carry?.boons?.bonusToxinStacks ?? 0);
  player.commander.collisionResist += Math.max(0, carry?.boons?.collisionResist ?? 0);

  if (carry?.boons?.boundFormIgnoresHazards) player.commander.boundFormIgnoresHazards = true;
  if (carry?.boons?.boundFormGrounded) player.commander.boundFormGrounded = true;
  if (carry?.boons?.doubleResonance) player.commander.doubleResonance = true;
  if (carry?.boons?.discountHybrids) player.commander.discountHybrids = true;
  if (carry?.boons?.ignoreGuardians) player.commander.ignoresGuardians = true;

  // The hybrid knacks, applied on the same two rules as everything above: a flag is
  // raised or left alone, and a number is added and floored at zero.
  if (carry?.boons?.fogConceals) player.commander.fogConceals = true;
  if (carry?.boons?.arcPierces) player.commander.arcPierces = true;
  if (carry?.boons?.alliesGrounded) player.commander.alliesGrounded = true;
  if (carry?.boons?.chillConducts) player.commander.chillConducts = true;
  if (carry?.boons?.immuneToShatterSplash) player.commander.immuneToShatterSplash = true;

  player.commander.steamBurns += Math.max(0, carry?.boons?.steamBurns ?? 0);
  player.commander.armorOnArcCollateral += Math.max(0, carry?.boons?.armorOnArcCollateral ?? 0);
  player.commander.wildfireSeedsToxin += Math.max(0, carry?.boons?.wildfireSeedsToxin ?? 0);
  player.commander.bonusFreezeStacks += Math.max(0, carry?.boons?.bonusFreezeStacks ?? 0);
  player.commander.bonusShoveDistance += Math.max(0, carry?.boons?.bonusShoveDistance ?? 0);

  // Only ever upward, like the Pip ceiling: gear bends a rule in the player's favour or
  // not at all, so a malformed carry cannot hand them a smaller hand than the rules give.
  player.commander.handLimit += Math.max(0, carry?.boons?.bonusHandLimit ?? 0);

  const state: GameState = {
    rng,
    turn: 1,
    activeSide: 'player',
    phase: 'startOfTurn',
    width: encounter.width,
    height: encounter.height,
    units: {},
    obstacles: {},
    anchors: [],
    hazards: {},
    intents: [],
    declaredPlan: [],
    players: { player: player.commander, enemy: enemy.commander },
    encounter: {
      id: encounter.id,
      name: encounter.name,
      bossPhase: 1,
      firedGates: [],
      rout: encounter.victory === 'rout',
      chainCancelled: false,
      subjugation: { sealed: false, active: false, anchorUnitId: null, turnsSurvived: 0 },
      ...(encounter.weather ? { weather: encounter.weather } : {}),
      // Copied rather than kept, so the arena cannot be reached back through by whoever
      // built the list. Spread conditionally: a fight with no ring behind it has no field
      // at all, and hashes as it did before rings existed.
      ...(wave2 && wave2.length > 0 ? { wave2: wave2.map((squad) => [...squad]) } : {}),
    },
    nextId: 0,
    suddenDeath: false,
    commanderDamagedThisRound: false,
    stalledRounds: 0,
    causeCounter: 0,
    encountered: [],
    defeated: [],
    playerDamageTaken: 0,
    playerMarkDetonations: 0,
  };

  const ctx = makeCtx(state);
  emit(ctx, {
    t: 'combatStarted',
    grid: { width: state.width, height: state.height },
    encounterName: encounter.name,
  });

  // Map terrain. Placed before units so openings are never blocked by a spawn.
  for (const t of encounter.terrain ?? []) {
    state.nextId += 1;
    const id = `t${state.nextId}`;
    const isCover = t.kind === 'cover';
    state.obstacles[id] = {
      id,
      defId: isCover ? 'terrain_cover' : 'terrain_wall',
      name: isCover ? 'Bramble Screen' : 'Rubble Wall',
      side: 'player',
      anchor: { ...t.at },
      footprint: 1,
      // Read off the definition rather than restated. This was two literals, and the
      // Stat Stretch is exactly the kind of change that moves one and forgets the other.
      hp: t.hp ?? terrainHp(isCover),
      maxHp: t.hp ?? terrainHp(isCover),
      destructible: true,
      ...(isCover ? { cover: true } : {}),
    };
  }

  // Enemy opening board.
  for (const [defId, x, y] of encounter.enemyOpeningBoard) {
    placeOpeningUnit(ctx, defId, 'enemy', { x, y });
  }

  // A free body for the **enemy** only, centred on its front line, so an authored board
  // is never empty of melee.
  //
  // The player's half of this is gone. It existed so turn one was a real tactical turn
  // rather than a setup turn, and the Vanguard Roster is now that answer — a warband the
  // player bought and placed themselves. Handing them a fifth body on top would be paying
  // out points they never spent, and would quietly make every roster one unit better than
  // it was priced to be.
  const vanguard = encounter.vanguard === undefined ? 'vanguard_footman' : encounter.vanguard;
  if (vanguard) {
    const mid = Math.floor(encounter.width / 2);
    placeOpeningUnit(ctx, vanguard, 'enemy', { x: mid, y: 1 });
  }

  // The Companion takes the field, standing in its own lane on the back row. The Hero
  // stays off-grid as the Architect; only the Companion has a body to lose.
  const boundId = placeOpeningUnit(ctx, companion.unitCardId, 'player', {
    x: player.commander.companionColumn,
    y: encounter.height - 1,
  });
  if (boundId) {
    state.players.player.companionUnitId = boundId;
    state.players.player.companionUnitDefId = companion.unitCardId;
  }

  // The enemy fields one too, when the encounter says so. A side without one keeps its
  // Commander wholly off-grid, which is what every fight looked like before mirrors —
  // and everything downstream still keys off companionUnitDefId being absent.
  const foe = encounter.enemyCompanion;
  if (foe) {
    const foeAt = foe.at ?? { x: enemy.commander.companionColumn, y: 0 };
    const foeId = placeOpeningUnit(ctx, foe.unitCardId, 'enemy', foeAt);
    if (foeId) {
      state.players.enemy.companionUnitId = foeId;
      state.players.enemy.companionUnitDefId = foe.unitCardId;
    }
  }

  // Named scenery: crystals and the like, whose behaviour lives on their own card.
  for (const prop of encounter.props ?? []) {
    spawnObstacle(ctx, prop.defId, 'player', prop.at);
  }

  // Currents are part of the map, laid down like terrain rather than conjured.
  for (const c of encounter.currents ?? []) {
    state.hazards[`${c.at.x},${c.at.y}`] = {
      kind: 'current',
      at: { ...c.at },
      turns: 1,
      owner: 'player',
      permanent: true,
      dir: { ...c.dir },
    };
  }

  scatterGeodes(ctx, encounter);

  // Opening hands, then the encounter script, then turn 1.
  drawCards(ctx, 'player', OPENING_HAND + (carry?.boons?.extraOpeningCards ?? 0));
  drawCards(ctx, 'enemy', OPENING_HAND);

  getEncounterScript(encounter.id)?.setup?.(ctx);

  // The Vanguard, and the ground it may stand on. Anchors are laid even for a fight with
  // no roster, so the two Rallies in Phase 4 always have somewhere to put a body back.
  //
  // Anchors cover what this arena will *seat*, not the whole kit. A basic body is the
  // cheapest thing on the ladder at two points, so half the budget is the most bodies that
  // can ever be standing — lighting more tiles than that would promise placements the
  // deployment budget refuses. Whichever is smaller: what was brought, or what fits.
  const warband = (roster ?? []).filter((id) => CARDS[id]);
  const seats = Math.floor(rosterBudgetFor(encounter.width, encounter.height) / 2);
  state.anchors = placeAnchors(state, rng, Math.min(warband.length, seats));
  state.players.player.roster = warband.map((defId) => ({
    defId,
    status: 'reserve' as const,
    // Resolved once, here, and then carried on the entry. A body that looked its level up
    // at deploy time would be looking it up in a place the engine is not allowed to read.
    level: Math.max(1, carry?.vanguardLevels?.[defId] ?? 1),
  }));

  if (warband.length > 0) {
    // Deployment happens before anything else, so the board the player builds is the board
    // they take their first turn from. `finishDeployment` is what calls `beginTurn`.
    state.phase = 'deployment';
    emit(ctx, { t: 'phaseChanged', phase: 'deployment', side: 'player' });
    emit(ctx, { t: 'deploymentBegan', anchors: state.anchors.map((c) => ({ ...c })) });
    return { state, events: ctx.events };
  }

  // No Vanguard: the fight opens exactly as it always did.
  beginTurn(ctx, 'player');

  return { state, events: ctx.events };
}

/**
 * Scatters Marrow Geodes across the neutral middle.
 *
 * Never in either territory: a geode in a deploy zone would either be free for its owner
 * or block their own summons, and neither is the intended decision. On neutral ground it
 * is a prize both sides must walk to, which puts a reason to contest the middle on the
 * board from turn one.
 *
 * Placed last, after every unit and every wall, so it can see what ground is actually
 * free — and it consumes the seeded stream, so the same seed lays out the same field.
 */
function scatterGeodes(ctx: Ctx, encounter: EncounterDef): void {
  const spec = encounter.marrowGeodes;
  if (!spec) return;

  const state = ctx.state;
  const off = new Set<number>();
  for (const side of ['player', 'enemy'] as const) {
    for (const y of startingZone(state, side)) off.add(y);
  }

  const open: Coord[] = [];
  for (let y = 0; y < state.height; y++) {
    if (off.has(y)) continue;
    for (let x = 0; x < state.width; x++) {
      if (canPlace(state, { x, y }, 1)) open.push({ x, y });
    }
  }
  if (open.length === 0) return;

  const span = Math.max(0, spec.max - spec.min);
  const count = Math.min(spec.min + nextInt(state.rng, span + 1), open.length);

  for (let i = 0; i < count; i++) {
    const at = open.splice(nextInt(state.rng, open.length), 1)[0];
    if (!at) break;
    spawnObstacle(ctx, 'marrow_geode', 'player', at);
  }
}

export function sideName(state: GameState, side: Side): string {
  return state.players[side].name;
}
