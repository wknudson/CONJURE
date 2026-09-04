/**
 * The engine's single entry point.
 *
 * applyCommand(state, command) -> { state, events }
 *
 * It is a synchronous reducer: it clones, validates, resolves the command completely
 * (including every cascade and death it triggers), and returns the new state alongside
 * the ordered event batch the sequencer will animate.
 */

import type { Coord, StatusKind, TargetRef } from '../../contract/ids.js';
import type { Command } from '../types/commands.js';
import { IllegalCommandError } from '../types/commands.js';
import type { GameState, HazardKind, StepResult } from '../types/state.js';
import { climaxTraitOf } from './growth.js';
import type { Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import type { CardDef, CardPlayContext, ChosenTarget } from '../types/cards.js';
import type { Ctx } from './context.js';
import { emit, makeCtx, newCause } from './context.js';
import { deepClone } from '../util/clone.js';
import { CARDS } from '../data/cards/index.js';
import { ATTACK_BONE_COST, channelYieldFor } from '../data/economy.js';
import { dtypeOf } from '../data/elements.js';
import { canAfford, drawCards, effectiveCost, resolvePlayedCard, spendResources } from './deck.js';
import { applyTithe, executeEffect, TITHE_DAMAGE, TITHE_MARROW } from './effects.js';
import { canAct, canAttack, canMove, findMove, licenseFor, setAnchor } from './movement.js';
import { legalAttacks, legalCardTargets } from './targeting.js';
import { dealDamage, healUnit } from './damage.js';
import { applyStatusTo } from './status.js';
import { checkLethal, finish, killEntity } from './death.js';
import { entityAt, getEntity, refOf } from './board.js';
import { resonanceLimit, toCardSnapshot } from './views.js';
import { beginTurn, endTurn } from './turn.js';
import { placeOpeningUnit } from './spawn.js';
import { canPlace } from './board.js';
import { cellsAt, cellsOf, footprintDistance } from '../util/grid.js';
import { coordEq } from '../../contract/ids.js';
import { creditCappedRefund, spawnHazard } from './reactions.js';
import { resonanceFor } from '../data/resonance.js';
import { fieldableBehemoths, rosterBudgetFor, rosterPointsOf } from '../data/roster.js';
import { declareIntents } from './intents.js';
import { isSealed } from './subjugation.js';

/** The only commands the deployment phase entertains. */
// Concede is the exit that always works, so it is allowed here too.
const DEPLOYMENT_COMMANDS: Command['type'][] = ['deployUnit', 'recallUnit', 'finishDeployment', 'concede'];

/** Points already standing on the board, for the arena-capacity check. */
function fieldedPoints(state: GameState): number {
  return state.players.player.roster
    .filter((r) => r.status === 'fielded')
    .reduce((sum, r) => sum + (CARDS[r.defId] ? rosterPointsOf(CARDS[r.defId]!) : 0), 0);
}

/**
 * Why this body may not stand there, or null if it may.
 *
 * The shape `channelRefusal` and `bloodTitheRefusal` established: the reducer throws
 * whatever this returns and the UI asks the same question to decide whether the tile
 * should light up, so the two can never disagree.
 *
 * **The kit is never re-litigated here, and the arena is.** Those are two different
 * questions and the distinction is the whole design. What a character may *own* was settled
 * in the Field Journal, before the dungeon, and refusing a legally bought warband at the door
 * would make the point-buy a lie. What this arena will *seat* is not a purse, it is
 * capacity — `rosterBudgetFor(width, height)`, one point per rank and one per file — and a
 * kit larger than the ground it is standing on holds the remainder in reserve.
 *
 * Both numbers are derived from facts already in the state: the board's dimensions and the
 * def ids of what is standing. Nothing new is stored, so a replay of a save written before
 * this rule existed produces the same board it always did.
 */
export function deployRefusal(state: GameState, defId: string, at: Coord): string | null {
  if (state.phase !== 'deployment') return 'not deploying';

  const entry = state.players.player.roster.find(
    (r) => r.defId === defId && r.status === 'reserve',
  );
  if (!entry) return `no ${defId} waiting in reserve`;

  if (!state.anchors.some((a) => a.x === at.x && a.y === at.y)) {
    return 'that tile is not an Anchor';
  }

  const def = CARDS[defId];
  const footprint = def?.unit?.footprint ?? 1;
  const arenaBudget = rosterBudgetFor(state.width, state.height);

  // Capacity before geometry, and the order is the message.
  //
  // "There is no room there" is the right answer to a tile that is taken; it is the *wrong*
  // answer to a body this arena will never seat, because it sends the player hunting for a
  // bigger gap that cannot help. So the rules that hold everywhere on this board are asked
  // first, and only then whether this particular tile has space.

  // A second 2x2 needs a second adjacent pair of Anchor Tiles, which `placeAnchors`
  // guarantees exactly one of. Small arenas seat one Behemoth however many points are spare.
  if (footprint === 2) {
    const seats = fieldableBehemoths(arenaBudget);
    const standing = state.players.player.roster.filter(
      (r) => r.status === 'fielded' && CARDS[r.defId]?.unit?.footprint === 2,
    ).length;
    if (standing >= seats) {
      return `this arena seats ${seats} Behemoth${seats === 1 ? '' : 's'}`;
    }
  }

  const price = def ? rosterPointsOf(def) : 0;
  const spent = fieldedPoints(state);
  if (spent + price > arenaBudget) {
    return `this arena seats ${arenaBudget} points, and ${spent} are already standing`;
  }

  // A Behemoth anchors on the Anchor Tile; its second cell need only be free. Demanding
  // two anchors would make the guaranteed adjacent pair the only legal 2x2 placement on
  // every map in the game.
  if (!canPlace(state, at, footprint)) return 'there is no room there';

  return null;
}

/**
 * Places one rostered body on an Anchor Tile.
 *
 * Enters through `placeOpeningUnit`, which is what lets it act on turn one: a deployed
 * Vanguard is not summoned, it was always there. Summoning sickness would make the whole
 * phase a turn of doing nothing.
 */
/** The reserve entry this deploy is spending, if there is one. */
function entryOf(ctx: Ctx, defId: string) {
  return ctx.state.players.player.roster.find(
    (r) => r.defId === defId && r.status === 'reserve',
  );
}

function deployUnit(ctx: Ctx, defId: string, at: Coord): void {
  const refusal = deployRefusal(ctx.state, defId, at);
  if (refusal) throw new IllegalCommandError(refusal);

  const id = placeOpeningUnit(ctx, defId, 'player', at, entryOf(ctx, defId)?.level);
  if (!id) throw new IllegalCommandError('there is no room there');

  const entry = ctx.state.players.player.roster.find(
    (r) => r.defId === defId && r.status === 'reserve',
  )!;
  entry.status = 'fielded';
  entry.unitId = id;

  newCause(ctx);
  emit(ctx, { t: 'unitDeployed', unitId: id, defId, at: { ...at } });
}

/**
 * Picks a deployed body back up.
 *
 * Deployment is a sketch until it is signed off, so this is a plain undo rather than a
 * cost: the unit is removed outright and its roster entry goes back to reserve. Nothing
 * about the body persists, so a recalled unit redeployed elsewhere is identical to one
 * placed there first time.
 */
function recallUnit(ctx: Ctx, unitId: string): void {
  if (ctx.state.phase !== 'deployment') {
    throw new IllegalCommandError('the line is already set');
  }
  const entry = ctx.state.players.player.roster.find(
    (r) => r.unitId === unitId && r.status === 'fielded',
  );
  if (!entry) throw new IllegalCommandError(`no deployed unit ${unitId}`);

  const unit = ctx.state.units[unitId];
  const at = unit ? { ...unit.anchor } : { x: 0, y: 0 };
  // Removed directly rather than through `killEntity`: nothing died, and a death would fire
  // marks, pay bounties and trip the lethal check for a body that was never in the fight.
  delete ctx.state.units[unitId];

  entry.status = 'reserve';
  delete entry.unitId;

  newCause(ctx);
  emit(ctx, { t: 'unitRecalled', defId: entry.defId, at });
}

/**
 * Sets the line, and starts the fight.
 *
 * Legal with bodies still in reserve — a player who would rather hold something back is
 * making a decision, not a mistake, and the engine does not have an opinion about it.
 */
function finishDeployment(ctx: Ctx): void {
  if (ctx.state.phase !== 'deployment') {
    throw new IllegalCommandError('the line is already set');
  }
  const fielded = ctx.state.players.player.roster.filter((r) => r.status === 'fielded').length;

  newCause(ctx);
  emit(ctx, { t: 'deploymentEnded', fielded });
  beginTurn(ctx, 'player');
}

export function applyCommand(prev: GameState, command: Command): StepResult {
  const state = deepClone(prev);
  const ctx = makeCtx(state);

  if (state.result) {
    throw new IllegalCommandError('combat is already over');
  }
  // Deployment accepts its own three commands, plus Concede, and nothing else: the board is
  // being built, not played. Everything the ordinary turn allows is refused until the line
  // is set.
  if (state.phase === 'deployment') {
    if (!DEPLOYMENT_COMMANDS.includes(command.type)) {
      throw new IllegalCommandError(`cannot ${command.type} during deployment`);
    }
  } else if (
    state.phase !== 'action' &&
    command.type !== 'endTurn' &&
    command.type !== 'declareIntents'
  ) {
    throw new IllegalCommandError(`cannot act during phase "${state.phase}"`);
  }

  runCommand(ctx, command);

  // Every command ends with a lethal check so no path can miss a win condition.
  checkLethal(ctx);
  // The chain-cancel flag is scoped to one action.
  state.encounter.chainCancelled = false;

  return { state, events: ctx.events };
}

/**
 * Runs a command against a context that already exists, without cloning.
 *
 * Used by anything that acts from inside the engine's own turn — the wildlife, an
 * encounter script — so those get the real rules (exhaustion, Counter, collisions)
 * rather than a second, drifting implementation of each action.
 */
export function runCommand(ctx: Ctx, command: Command): void {
  switch (command.type) {
    case 'playCard':
      playCard(ctx, command.card, command.target, command.x);
      break;
    case 'moveUnit':
      moveUnit(ctx, command.unit, command.to);
      break;
    case 'attack':
      attack(ctx, command.attacker, command.target);
      break;
    case 'attackTile':
      attackTile(ctx, command.attacker, command.at);
      break;
    case 'bloodTithe':
      bloodTithe(ctx, command.unit);
      break;
    case 'deployUnit':
      deployUnit(ctx, command.defId, command.at);
      break;
    case 'recallUnit':
      recallUnit(ctx, command.unit);
      break;
    case 'finishDeployment':
      finishDeployment(ctx);
      break;
    case 'channel':
      channel(ctx, command.unit);
      break;
    case 'declareIntents':
      declareIntents(ctx, command.plan, command.telegraph);
      break;
    case 'concede':
      // Only the player concedes; the enemy has no hand to raise. `finish` is idempotent,
      // so conceding a fight already decided changes nothing and emits nothing.
      finish(ctx, 'defeat');
      break;
    case 'endTurn':
      endTurn(ctx);
      break;
  }
}

// ------------------------------------------------------------------------ commands

function playCard(ctx: Ctx, cardId: string, target: ChosenTarget, x?: number): void {
  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];

  if (!cmd.hand.includes(cardId)) {
    throw new IllegalCommandError(`card ${cardId} is not in hand`);
  }
  const inst = cmd.cards[cardId];
  const def = inst ? CARDS[inst.defId] : undefined;
  if (!inst || !def) throw new IllegalCommandError(`unknown card ${cardId}`);

  // A variable price is declared, not inferred. Refused rather than clamped: a player who
  // asked for six and silently got five would be told nothing, and the difference is a
  // whole body's worth of health.
  if (def.xCost) {
    if (x === undefined) throw new IllegalCommandError(`${def.name} needs an X`);
    if (!Number.isInteger(x)) throw new IllegalCommandError('X must be a whole number');
    if (x < 1) throw new IllegalCommandError('X must be at least 1');
    if (x > def.xCost.max) {
      throw new IllegalCommandError(`X may be at most ${def.xCost.max}`);
    }
  }

  const price = effectiveCost(ctx.state, side, def, x, inst.mods);
  if (!canAfford(ctx.state, side, price)) {
    throw new IllegalCommandError(`cannot afford ${def.name} (${price})`);
  }

  // Validate the chosen target before spending anything. Without this a summon onto an
  // occupied tile would consume the card and its Bones and quietly do nothing.
  const legal = legalCardTargets(ctx.state, side, def.id);
  if (!legal.some((t) => sameTarget(t, target))) {
    throw new IllegalCommandError(`illegal target for ${def.name}`);
  }

  const snapshot = toCardSnapshot(ctx.state, side, cardId);
  spendResources(ctx, side, price);

  emit(ctx, {
    t: 'cardPlayed',
    side,
    card: snapshot,
    ...(target.kind === 'tile' ? { at: target.at } : {}),
  });

  // Remove from hand before resolving, so effects that draw cannot redraw this card.
  resolvePlayedCard(ctx, side, cardId);

  const casterAnchor = casterAnchorFor(ctx, def, side, target);
  const play: CardPlayContext = {
    side,
    chosen: target,
    // Carried into resolution so a rolled `bonusDamage` reaches every number this card
    // deals, without any op having to know where the roll came from.
    ...(inst.mods ? { mods: { ...inst.mods } } : {}),
    ...(casterAnchor ? { casterAnchor } : {}),
    // Carried into resolution so an op can scale off what was actually paid, rather than
    // off what the card is allowed to charge.
    ...(def.xCost ? { x: x ?? 0 } : {}),
  };

  newCause(ctx);
  executeEffect(ctx, def.effect, play);

  // Resonance resolves after the card, so a Companion summon can be caught by its own
  // Companion's passive lane the same turn it lands.
  if (def.source === 'companion') triggerResonance(ctx, side);
}

/** Fires the Companion's school passive, once per turn. */
function triggerResonance(ctx: Ctx, side: 'player' | 'enemy'): void {
  const cmd = ctx.state.players[side];
  if (cmd.resonancesThisTurn >= resonanceLimit(cmd)) return;
  const def = resonanceFor(cmd.companionSchool);
  if (!def) return;

  cmd.resonancesThisTurn += 1;
  newCause(ctx);
  emit(ctx, { t: 'resonanceTriggered', side, name: def.name, column: cmd.companionColumn });
  def.apply(ctx, side, cmd.companionColumn);
}

function sameTarget(a: ChosenTarget, b: ChosenTarget): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'none':
    case 'global':
      return true;
    case 'tile':
      return b.kind === 'tile' && a.at.x === b.at.x && a.at.y === b.at.y;
    case 'line':
      return (
        b.kind === 'line' &&
        a.from.x === b.from.x &&
        a.from.y === b.from.y &&
        a.dir.x === b.dir.x &&
        a.dir.y === b.dir.y
      );
    case 'fallen':
      return b.kind === 'fallen' && a.rosterIndex === b.rosterIndex;
    case 'entity':
      if (b.kind !== 'entity' || a.ref.kind !== b.ref.kind) return false;
      return a.ref.kind === 'portrait'
        ? b.ref.kind === 'portrait' && a.ref.side === b.ref.side
        : 'id' in b.ref && a.ref.id === b.ref.id;
  }
}

/**
 * Where a card's effects consider themselves to originate, which decides which way a
 * shove throws its victim.
 *
 * Line spells carry their own origin. A Companion card is thrown by the Companion, so it
 * pushes away from wherever that is actually standing. A Hero card is cast from off the
 * board and has no position, so displacement.ts falls back to shoving away from the
 * caster's own side.
 */
function casterAnchorFor(
  ctx: Ctx,
  def: CardDef,
  side: 'player' | 'enemy',
  target: ChosenTarget,
): { x: number; y: number } | undefined {
  if (target.kind === 'line') return { ...target.from };
  if (def.source === 'companion') {
    const id = ctx.state.players[side].companionUnitId;
    const body = id ? ctx.state.units[id] : undefined;
    if (body) return { ...body.anchor };
  }
  return undefined;
}

function moveUnit(ctx: Ctx, unitId: string, to: { x: number; y: number }): void {
  const unit = ctx.state.units[unitId];
  if (!unit) throw new IllegalCommandError(`no unit ${unitId}`);
  if (unit.side !== ctx.state.activeSide) throw new IllegalCommandError('not your unit');
  if (!canMove(unit)) throw new IllegalCommandError(`${unit.name} cannot move`);

  const option = findMove(ctx.state, unit, to);
  if (!option) throw new IllegalCommandError('illegal destination');

  // Read before the move: for a 2x2 body these are two tiles, and after `setAnchor` there
  // is no way to know which ones they were.
  const trail = trailOf(unit);
  const leaving = trail ? cellsOf(unit) : [];

  // What the route ran into, gathered while everything is still standing where it was.
  const crossed = crossedEntities(ctx.state, unit, option.path);

  // Heavy Footprint shatters what it walked into, and it has to happen *before* the body
  // arrives: the destination may be the tile the obstacle was standing on, and moving onto
  // a live obstacle would put two things on one square.
  for (const obstacleId of crossed.obstacles) {
    const obstacle = ctx.state.obstacles[obstacleId];
    if (obstacle) killEntity(ctx, obstacle, 'impact');
  }

  // A mark on a shattered wall can kill the thing that broke it. Nothing below is safe to
  // run for a body that is no longer on the board.
  if (!ctx.state.units[unitId] || ctx.state.result) return;

  setAnchor(ctx.state, unitId, to);
  unit.movedThisTurn = true;

  emit(ctx, { t: 'unitMoved', unitId, path: option.path.map((c) => ({ ...c })) });

  // Overload bills whatever it walked through, after it has arrived — the damage is the
  // wake of the charge, not a series of small collisions along the way. `true` damage
  // because the trait promises unblockable, and armour is exactly what that means.
  for (const victimId of crossed.units) {
    if (ctx.state.result) break;
    if (!ctx.state.units[victimId]) continue;
    dealDamage(ctx, {
      target: { kind: 'unit', id: victimId },
      amount: OVERLOAD_PHASE_DAMAGE,
      dtype: 'true',
      cause: 'impact',
    });
  }

  if (ctx.state.units[unitId] && trail) layTrail(ctx, unit, trail, leaving);
}

/**
 * What this body leaves on the ground it walks off, if anything.
 *
 * A stat-block `trail` is the creature's own — a Titan's rubble. Conflagration lends one
 * to whatever wears it: a Climaxed Ember Coat host leaves fire in its wake, the second
 * half of what the card promises. Read once at the top of a move so the tiles are
 * gathered under the same rule that decides whether to lay anything on them.
 */
function trailOf(unit: Unit): HazardKind | undefined {
  if (unit.trail) return unit.trail;
  return climaxTraitOf(unit) === 'conflagration' ? 'burning' : undefined;
}

/** How long a Conflagration host's wake keeps burning. Matches the Pyre cards that lay fire. */
const CONFLAGRATION_TRAIL_TURNS = 2;

/** What an Overload charge deals to each body it passes straight through. */
export const OVERLOAD_PHASE_DAMAGE = 10;

/**
 * Everything the route ran over, by id.
 *
 * Gathered from the path rather than from the destination, because the whole point of both
 * traits is what happens *on the way*. The starting cells are excluded: a body does not
 * charge through the ground it was already standing on.
 *
 * Returns ids rather than entities: the obstacles are about to be destroyed and the units
 * about to be damaged, and either can remove something the other still holds a reference
 * to. Ids are re-read against live state at the moment they are used.
 */
function crossedEntities(
  state: GameState,
  unit: Unit,
  path: Coord[],
): { units: string[]; obstacles: string[] } {
  const license = licenseFor(unit);
  const units = new Set<string>();
  const obstacles = new Set<string>();
  if (!license.throughUnits && !license.throughObstacles) return { units: [], obstacles: [] };

  const startCells = new Set(cellsAt(path[0]!, unit.footprint).map((c) => `${c.x},${c.y}`));

  for (const step of path.slice(1)) {
    for (const cell of cellsAt(step, unit.footprint)) {
      if (startCells.has(`${cell.x},${cell.y}`)) continue;
      const occ = entityAt(state, cell);
      if (!occ || occ.id === unit.id) continue;
      if (isUnit(occ)) {
        // Only enemies. Walking through your own line is a manoeuvre, not an attack.
        if (license.throughUnits && occ.side !== unit.side) units.add(occ.id);
      } else if (license.throughObstacles && occ.destructible) {
        obstacles.add(occ.id);
      }
    }
  }
  return { units: [...units], obstacles: [...obstacles] };
}

/**
 * Wrecks the ground a heavy thing has just walked off.
 *
 * Only the tiles it actually left: a 2x2 body stepping one square still stands on half of
 * where it was, and burying its own feet would be both wrong and a way to immobilise it.
 *
 * Rubble is permanent and costs 2 MOV to cross, so a Titan with 1 MOV can never step back
 * over its own trail. That is the creature, not an oversight — it commits to a direction
 * and the arena is different afterwards.
 */
function layTrail(ctx: Ctx, unit: Unit, kind: HazardKind, leaving: Coord[]): void {
  const now = cellsOf(unit);

  // Rubble is permanent and a creature's own; fire is borrowed from a Climax and burns
  // out, so it takes the same clock the Pyre cards give the ground they light.
  const permanent = kind === 'rubble';
  const turns = permanent ? 1 : CONFLAGRATION_TRAIL_TURNS;

  for (const cell of leaving) {
    if (now.some((c) => coordEq(c, cell))) continue;
    spawnHazard(ctx, cell, kind, turns, permanent);
  }
}

/**
 * Why this body cannot swing, in the player's words, or null if it can.
 *
 * Exported for the same reason `channelRefusal` is: the HUD must be able to say *why* an
 * attack is unavailable. Affordability lives here rather than in `canAttack` deliberately —
 * `canAttack` answers "has this body still got its action", which the targeting layer and the
 * AI both ask, and folding a resource check into it would grey out attacks for a reason that
 * has nothing to do with the unit.
 *
 * **Feral beasts are exempt.** They sit in the enemy's unit list for bookkeeping and nothing
 * commands them (`ai/enumerate.ts` filters them out of `mine`); billing a commander for a
 * wolf's hunger would spend a pool its owner never agreed to. It would also crash the game —
 * `feral.ts` strikes from inside `beginTurn` with no catch, so a broke commander would throw
 * an IllegalCommandError straight out of the turn transition.
 */
export function attackRefusal(state: GameState, unitId: string): string | null {
  const unit = state.units[unitId];
  if (!unit) return `no unit ${unitId}`;
  if (unit.side !== state.activeSide) return 'not your unit';
  if (!canAttack(unit)) return `${unit.name} cannot attack`;
  // A body with no attack is not an attacker. `legalAttacks` never checked this, so the two
  // shipped `atk: 0` units could legally swing for nothing — which was free and harmless
  // before, and is now a Bone spent on a blow that cannot land.
  if (unit.atk <= 0) return `${unit.name} has nothing to strike with`;
  if (unit.keywords.includes('Feral')) return null;
  if (state.players[unit.side].bones < ATTACK_BONE_COST) {
    // The hint names the way out, and only when this body actually has one — the Bound Form
    // and Behemoths cannot channel, and telling them to would be advice that refuses itself.
    return channelRefusal(state, unitId) === null
      ? `not enough Bones to strike — ${unit.name} could channel instead`
      : `not enough Bones for ${unit.name} to strike`;
  }
  return null;
}

function attack(ctx: Ctx, attackerId: string, target: TargetRef): void {
  const refusal = attackRefusal(ctx.state, attackerId);
  if (refusal) throw new IllegalCommandError(refusal);
  const attacker = ctx.state.units[attackerId]!;

  const legal = legalAttacks(ctx.state, attacker);
  const ok = legal.some((l) =>
    l.kind === target.kind &&
    (l.kind === 'portrait'
      ? target.kind === 'portrait' && l.side === target.side
      : 'id' in target && l.id === target.id),
  );
  if (!ok) throw new IllegalCommandError('illegal attack target');

  emit(ctx, { t: 'attackDeclared', attackerId, target });

  // Charged *after* the target is validated, so an illegal swing bills nobody — the same
  // ordering `playCard` uses, where the target is checked before `spendResources`.
  //
  // A Feral pays nothing: see `attackRefusal`.
  if (!attacker.keywords.includes('Feral')) {
    const cmd = ctx.state.players[attacker.side];
    cmd.bones -= ATTACK_BONE_COST;
    emit(ctx, { t: 'resourcesChanged', side: attacker.side, bones: cmd.bones, marrow: cmd.marrow });
  }

  // Any swing counts as engaging, whether or not it reaches a portrait. Deliberately its own
  // flag rather than `commanderDamagedThisRound`, which means "a Pact was hurt" and is asserted
  // as such — a rout widens that one to include a kill, and an ordinary fight does not. See
  // `applyPacifistLockout`.
  ctx.state.engagedThisRound = true;

  // Attacking spends only the attack. A unit that has not yet moved may still withdraw
  // afterwards — striking and retreating is the point of independent actions.
  attacker.attackedThisTurn = true;

  const isMelee = target.kind !== 'portrait'
    ? footprintDistance(attacker, getEntity(ctx.state, target.id) ?? attacker) <= 1
    : false;

  const stats = CARDS[attacker.defId]?.unit;

  // The hunter's bonus, read off the target *before* the swing lands. Same ordering
  // `applyOnHit` documents: a body that both hunts Chilled targets and chills on hit must
  // not be able to set up and cash in with one blow.
  let bonus = 0;
  if (stats?.bonusVs && target.kind === 'unit') {
    const prey = ctx.state.units[target.id];
    if (prey && stats.bonusVs.statuses.some((s) => (prey.statuses[s] ?? 0) > 0)) {
      bonus = stats.bonusVs.amount;
    }
  }

  // What the two defensive knacks below need to know about the target, read before the
  // blow: a body that dies to it is gone from the map by the time they run.
  const victim = target.kind === 'unit' ? ctx.state.units[target.id] : undefined;
  const victimSide = victim?.side;
  const victimGuards = victim?.keywords.includes('Guardian') ?? false;

  newCause(ctx);
  const landed = dealDamage(ctx, {
    target,
    amount: attacker.atk + bonus,
    // **The body's own element**, derived from the school it already declares, with
    // `attackDtype` left as the override for the handful whose strikes are something else —
    // a Wraith striking `true` bypasses plate and stops Shattering ice in the same stroke.
    //
    // This used to default to `physical`, which made a school a colour on a card frame and
    // nothing else: a Pyre minion could not detonate a Cinder Mark, because that aligns to
    // fire and spell and a Pyre body dealt neither. Deriving it means the element cannot be
    // forgotten on a new card and cannot disagree with the school printed beside it.
    dtype: stats?.attackDtype ?? dtypeOf(attacker.school),
    cause: 'attack',
    ...(isMelee ? { sourceUnitId: attackerId } : {}),
  });

  applyOnHit(ctx, attackerId, target, landed.hpLoss);
  leech(ctx, attackerId, target, landed.hpLoss);

  // Two knacks the *defending* side may hold, both landing on the attacker and both only if
  // it is still standing — Counter can have killed it inside `dealDamage`.
  //
  // Lightning Rod: a Guardian struck from range leaves the shooter Charged. Not damage sent
  // back — the pipeline has no such thing — but a charge that Surge can cash in, which is
  // the school's own answer to being shot at.
  //
  // Death Rattle: a body killed by the blow leaves its killer Brittle. The design said Frail
  // on an Overloaded unit; the engine has Brittle for "takes more from every hit" and a
  // death for the trigger, and the two together are the same threat in the game's own words.
  if (victimSide && victimSide !== attacker.side && !ctx.state.result) {
    const defender = ctx.state.players[victimSide];
    const shooter = ctx.state.units[attackerId];
    if (shooter && defender.guardiansCharge && victimGuards && !isMelee) {
      applyStatusTo(ctx, shooter, 'charged', 1, victimSide);
    }
    const killer = ctx.state.units[attackerId];
    if (killer && defender.deathRattle && landed.died && !ctx.state.result) {
      applyStatusTo(ctx, killer, 'brittle', 1, victimSide);
    }
  }

  // What the body earns its owner for swinging. Paid whether or not the blow drew blood:
  // this is a generator striking, not a reaction landing, and a Storm Wisp held off by
  // plate has still discharged.
  // Capped now, where it was not before. See `creditCappedRefund`: an on-attack refund is
  // bounded only by how many bodies you own, so with a swing costing a Bone it would have paid
  // for itself and then some.
  const perStrike = stats?.refunds?.onAttack ?? 0;
  for (let i = 0; i < perStrike; i++) {
    if (!creditCappedRefund(ctx, attacker.side, { id: attacker.defId, name: attacker.name }, attacker.anchor)) break;
  }
}

/**
 * The rider an attack leaves behind, if it has one.
 *
 * It is applied *after* the damage rather than before, so the blow resolves against the
 * board as it was swung at: charging a target and then hitting it would let a single
 * Bombardier set up and cash in its own Overload.
 *
 * Six things it deliberately does not do, and the first five are all the same rule --
 * **a rider is something a landed blow leaves on a living body.**
 *
 * - It does not brand a corpse. A status on something already removed is bookkeeping
 *   nobody reads, and the kill is the better outcome anyway.
 * - It does not swing from one. The attacker is re-read here rather than captured before
 *   the blow, because `dealDamage` resolves Counter, mark blasts and the lethal check
 *   before returning: an attacker can be dead by the time its own rider would land, and
 *   `killEntity` removes a unit from the map without mutating the object a caller still
 *   holds. Reading `onHit` off that reference is reading a corpse's intentions.
 * - It does not land on a blow that was entirely soaked. `hpLoss` is the same test marks
 *   and three of the five reactions use: armor that stops the hit stops what rode in on
 *   it. Venom still needs a wound.
 * - It does not touch obstacles or portraits, neither of which carries a status field.
 * - It does not mark a **sealed** Alpha. The seal is the point where damage has stopped
 *   being the answer; branding something the damage pipeline refuses to touch would tick
 *   for numbers that are swallowed on arrival, which reads as a bug rather than a rule.
 *   **This check is belt-and-braces and currently unreachable**: `isSealed` is the first
 *   gate in `dealDamage`, so a sealed target always reports zero `hpLoss` and the wound
 *   test above returns first. It is kept because the two say different things — one is
 *   "the blow did nothing", the other is "this thing is not a legal host" — and the day
 *   the wound rule is loosened for some rider that should mark a blocked hit, the seal
 *   must not be loosened with it. Deleting the gates that never fire is how the case they
 *   guard comes back.
 * - It does not touch a **Bound Form**. That body keeps no health of its own, so a
 *   damaging status on it is not an affliction of the body at all -- every tick would be
 *   redirected straight to the Pact, turning a melee rider into the one thing in the game
 *   that poisons a portrait. It joins armor, Counter, Brittle, reactions and
 *   mark-on-damage on the list of things a Bound Form cannot host meaningfully.
 */
function applyOnHit(ctx: Ctx, attackerId: string, target: TargetRef, hpLoss: number): void {
  if (target.kind !== 'unit') return;
  if (ctx.state.result) return;
  if (hpLoss <= 0) return;

  const attacker = ctx.state.units[attackerId];
  if (!attacker) return;
  const rider = attacker.onHit ?? climaxRiderOf(attacker);
  if (!rider) return;

  const victim = ctx.state.units[target.id];
  if (!victim || victim.hp <= 0) return;
  if (victim.keywords.includes('BoundForm')) return;
  if (isSealed(ctx.state, target)) return;

  applyStatusTo(ctx, victim, rider.status, rider.stacks, attacker.side);
}

/**
 * The rider a Climax lends a body that has none of its own.
 *
 * Two traits are riders in all but name, so they take the rider's seam and every one of
 * its rules — a wound, a living host, no Bound Form, no sealed Alpha — rather than a
 * second copy of that list. Conflagration ignites what it strikes; Hollow's Frail-Strike
 * leaves its victim Brittle, which is already the status that means "takes more from
 * every later blow", so the trait needs no status of its own.
 *
 * A body's printed rider wins where it has one. Stacking the two would make an Ember Coat
 * on a Cinder Adder worth two statuses a swing, which no card text promises.
 */
function climaxRiderOf(unit: Unit): { status: StatusKind; stacks: number } | undefined {
  switch (climaxTraitOf(unit)) {
    case 'conflagration':
      return { status: 'burn', stacks: 2 };
    case 'hollow':
      return { status: 'brittle', stacks: 1 };
    default:
      return undefined;
  }
}

/**
 * Overgrowth's Leech: the host drinks what it wounds.
 *
 * Health actually taken, not damage swung — armour it failed to get through feeds nothing,
 * the same wound rule the rider above lives by. Re-read after the blow for the reason
 * `applyOnHit` documents: a Counter can have killed the attacker by now, and a corpse
 * does not drink.
 */
function leech(ctx: Ctx, attackerId: string, target: TargetRef, hpLoss: number): void {
  if (target.kind !== 'unit' || hpLoss <= 0 || ctx.state.result) return;
  const attacker = ctx.state.units[attackerId];
  if (!attacker || climaxTraitOf(attacker) !== 'overgrowth') return;
  healUnit(ctx, attacker, hpLoss);
}

/**
 * A declared attack landing on a tile that is now empty.
 *
 * The unit still spends its swing, and nothing takes damage. This is what the player
 * bought by moving the target out of the way, so it has to be visible rather than a
 * silently skipped action.
 */
/**
 * A declared blow landing on ground the target has left.
 *
 * **Not charged a Bone**, deliberately, where a real swing is. Being outplayed already costs the
 * attacker the action; billing them for the miss as well would punish the same mistake twice,
 * and the whole reason this command exists rather than silently skipping is that the whiff
 * should be *visible* — a resource quietly draining is the opposite of visible.
 *
 * The same reasoning is why a Counter riposte is free: it is a reaction, not an action, it
 * fires on somebody else's turn, and its owner never chose to spend anything.
 */
function attackTile(ctx: Ctx, attackerId: string, at: { x: number; y: number }): void {
  const attacker = ctx.state.units[attackerId];
  if (!attacker) return;
  if (!canAttack(attacker)) return;

  attacker.attackedThisTurn = true;
  newCause(ctx);
  emit(ctx, { t: 'intentWhiffed', attackerId, at: { ...at } });
}

/** Marrow extracted by a unit that spends its swing on the ritual instead of a target. */
export const CHANNEL_MARROW = 1;

/**
 * Channel: give up a unit's attack to extract Marrow.
 *
 * The floor under a bad hand. A turn where nothing is worth attacking and no card is
 * affordable used to be a turn spent passing; now every idle body is worth something,
 * and the choice between striking and channelling is a real one on the margin.
 *
 * Unlike a tithe this asks nothing of the unit but its turn — it takes no blood, so there is
 * no offering to be worth anything. The Bound Form is still excluded: extracting Marrow for
 * free with the one unit that cannot be traded away is a turn with no downside at all.
 */
/**
 * Why this unit may not Channel, or null if it may.
 *
 * One rule in one place. The reducer throws whatever this returns, and the UI asks the
 * same question to decide whether to offer the button — so the two can never disagree
 * about what is legal, and the refusal the player reads is the engine's own words.
 *
 * A predicate rather than a boolean-plus-message pair because the caller that needs the
 * reason and the caller that needs the yes/no are the same check either way.
 */
export function channelRefusal(state: GameState, unitId: string): string | null {
  const unit = state.units[unitId];
  if (!unit) return `no unit ${unitId}`;
  if (unit.side !== state.activeSide) return 'not your unit';
  if (unit.attackedThisTurn) return 'unit has already attacked';
  if (!canAct(unit)) return 'unit cannot act';
  // The Bound Form may channel now, and the reason it could not is the reason it can.
  //
  // It was barred because "extracting Marrow for free with the one unit that cannot be traded
  // away is a turn with no downside at all" — true when a swing cost nothing, so giving one up
  // cost nothing either. A swing costs a Bone now, so channelling trades a paid action for a
  // Bone and the downside is the swing itself.
  //
  // Leaving the bar in place made the endgame unresolvable: the last body standing is usually
  // the Bound Form, and a Bound Form that cannot channel is a body that can only ever spend.
  if (!channelYieldFor(CARDS[unit.defId] ?? ({} as never)))
    return `${unit.name} is too large to channel`;
  return null;
}

function channel(ctx: Ctx, unitId: string): void {
  const refusal = channelRefusal(ctx.state, unitId);
  if (refusal) throw new IllegalCommandError(refusal);
  const unit = ctx.state.units[unitId]!;

  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  unit.attackedThisTurn = true;

  // Per class, read off the same ladder that prices the body for the roster, so what a unit
  // costs and what it generates can never drift apart. Marrow is unchanged — dropping it would
  // orphan the fourteen cards that demand Marrow strictly, which Bones can never cover.
  const yielded = channelYieldFor(CARDS[unit.defId] ?? ({} as never))!;
  cmd.marrow += yielded.marrow;
  cmd.bones += yielded.bones;
  if (yielded.draw > 0) drawCards(ctx, side, yielded.draw);

  newCause(ctx);
  emit(ctx, {
    t: 'unitChannelled',
    unitId,
    side,
    marrow: yielded.marrow,
    bones: yielded.bones,
    draw: yielded.draw,
  });
  emit(ctx, { t: 'resourcesChanged', side, bones: cmd.bones, marrow: cmd.marrow });
}

/**
 * Why this unit may not be tithed, or null if it may.
 *
 * The shape `channelRefusal` established, and for the same reason: the reducer throws
 * whatever this returns and the UI asks the same question to decide whether to offer the
 * button, so the two can never disagree about what is legal.
 *
 * Note what is deliberately *absent*. "Would die" is not a refusal — a lethal tithe is a
 * legal play and occasionally the right one, so that warning belongs on the button rather
 * than in the rule. Nor is "worth no Marrow": every body now bleeds at the same base rate,
 * and the old `sacrificeValue > 0` gate has no successor.
 */
export function bloodTitheRefusal(state: GameState, unitId: string): string | null {
  const unit = state.units[unitId];
  if (!unit) return `no unit ${unitId}`;
  if (unit.side !== state.activeSide) return 'not your unit';
  // The Bound Form keeps no health of its own, so every wound it takes is the Pact's.
  // Tithing it would pay you out of your own life total at no cost to the board.
  if (unit.keywords.includes('BoundForm')) return 'the Bound Form cannot be tithed';
  // One tithe per body per turn. Asked before the general `canAct` — which also refuses an
  // exhausted unit — so the player is told which rule stopped them rather than the generic
  // one that happens to cover it.
  if (unit.statuses.exhaust) return 'unit is already exhausted';
  if (!canAct(unit)) return 'unit cannot act';
  return null;
}

/**
 * Blood Magic: open one of your own bodies for Marrow.
 *
 * Unlike the sacrifice it replaces, the unit stays on the board. What it costs is the
 * body's turn and 3 of its health, not the body — which is what makes it a decision every
 * turn rather than a one-time liquidation.
 *
 * Note it does *not* set `attackedThisTurn`. Exhaustion is the spend, and it is strictly
 * broader: an exhausted unit cannot move either, where a spent attack would still let it
 * walk away. Marking both would be one rule wearing two hats.
 */
function bloodTithe(ctx: Ctx, unitId: string): void {
  const refusal = bloodTitheRefusal(ctx.state, unitId);
  if (refusal) throw new IllegalCommandError(refusal);
  const unit = ctx.state.units[unitId]!;

  newCause(ctx);
  applyTithe(ctx, unit, TITHE_DAMAGE, TITHE_MARROW);
}

export { refOf };
