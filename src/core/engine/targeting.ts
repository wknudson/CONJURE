/**
 * Legal target enumeration. One implementation serves both the UI (tile highlighting)
 * and the AI (action enumeration), so they can never disagree about what is playable.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import type { CardDef, ChosenTarget, EffectNode, ReviveSite } from '../types/cards.js';
import { effectContainsOp } from '../types/cards.js';
import type { GameState, RosterEntry } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import {
  allEntities,
  canPlace,
  emptyTiles,
  entityAt,
  getEntity,
  lowestHpEnemy,
  opposite,
  refOf,
  summonSpots,
  unitsOf,
} from './board.js';
import { canAttack, canAct } from './movement.js';
import { isClimaxed } from './growth.js';
import { hasLoS, hasLoSToPortrait } from './los.js';
import { DIRS_8, cellsAt, cellsOf } from '../util/grid.js';
import { inBounds, portraitRow, startingZone, visionClamp } from '../types/state.js';

/**
 * Where a card is cast from.
 *
 * The Hero works from off the board and so reaches all of it — that is what being the
 * Architect means. A Companion card is thrown by the Companion, so it reaches only as
 * far as the Companion can see and stretch from where it is standing.
 *
 * `'global'` means unrestricted; a cell list means measure from these; `'none'` means
 * there is nothing to cast from and the card has no legal target at all.
 */
function castOriginCells(state: GameState, side: Side, def: CardDef): Coord[] | 'global' | 'none' {
  if (def.source !== 'companion' || def.range === undefined) return 'global';

  // A side that never had a body -- every enemy Commander today -- casts as it always
  // did. Without this, the enemy AI would silently lose every ranged Companion card in
  // its deck the moment ranges were assigned.
  if (!state.players[side].companionUnitDefId) return 'global';

  const id = state.players[side].companionUnitId;
  const body = id ? state.units[id] : undefined;
  return body ? cellsOf(body) : 'none';
}

/** Whether any origin cell can reach any target cell, within range and sight. */
function inCastRange(
  state: GameState,
  side: Side,
  origin: Coord[],
  cells: Coord[],
  def: CardDef,
  ignore: string[],
): boolean {
  // Fog shortens a spell exactly as it shortens a bow: the Companion cannot throw at what
  // it cannot see. Gale is deliberately not applied — it bends arrows, not sorcery.
  const clamp = visionClamp(state);
  const range = Math.min(def.range ?? Infinity, clamp ?? Infinity);
  const minRange = def.minRange ?? 0;

  return origin.some((o) =>
    cells.some((c) => {
      const dx = c.x - o.x;
      const dy = c.y - o.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));

      if (distance < minRange || distance > range) return false;

      // A linear cast travels a rank, file or diagonal and nothing else — deliberately
      // the same geometry `canStrike` gives a marksman, so a beam is a beam whether a
      // unit or a card threw it.
      if (def.vector === 'linear' && dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
        return false;
      }

      return !def.needsLoS || hasLoS(state, o, c, ignore, side);
    }),
  );
}

/**
 * Whether a card's effects pick their own victim off the board rather than being aimed.
 *
 * Only `lowestHpEnemy` does today. It is asked of the whole tree, `seq` included, because
 * a card that damages a chosen tile *and* culls the weakest is still unplayable-in-part
 * with no foes -- and the half that still works is not worth a wasted cast.
 */
function effectSelfTargets(node: EffectNode): boolean {
  if (node.op === 'seq') return node.effects.some(effectSelfTargets);
  return 'area' in node && node.area.shape === 'lowestHpEnemy';
}

/** Every legal way to play this card right now. Empty means it is unplayable. */
/**
 * Where a raised body would stand, or undefined if it could not.
 *
 * One function, shared by the targeting that offers the card and by the op that resolves
 * it, so a pyre the UI lights is a pyre the revival can actually use. Splitting these was
 * the obvious shortcut and would have let a card be offered and then fizzle.
 */
export function reviveSpot(
  state: GameState,
  side: Side,
  entry: RosterEntry,
  site: ReviveSite,
): Coord | undefined {
  const footprint = CARDS[entry.defId]?.unit?.footprint ?? 1;

  if (site === 'pyre') {
    // The exact tile it died on, and nowhere else. An enemy standing there denies the
    // raising for exactly as long as it stands there, which is the counterplay it bought.
    if (!entry.fellAt) return undefined;
    return canPlace(state, entry.fellAt, footprint) ? { ...entry.fellAt } : undefined;
  }

  if (site === 'anchor') {
    for (const a of state.anchors) {
      if (canPlace(state, a, footprint)) return { ...a };
    }
    return undefined;
  }

  // The starting zone: anywhere behind your own line. The widest of the three, which is
  // what makes Blood & Bone the one that always has somewhere to put a body.
  for (const y of startingZone(state, side)) {
    for (let x = 0; x < state.width; x++) {
      const at = { x, y };
      if (canPlace(state, at, footprint)) return at;
    }
  }
  return undefined;
}

export function legalCardTargets(state: GameState, side: Side, defId: string): ChosenTarget[] {
  const def = CARDS[defId];
  if (!def) return [];

  const origin = castOriginCells(state, side, def);
  if (origin === 'none') return [];
  const bodyId = state.players[side].companionUnitId;
  // The caster never blocks its own line.
  const ignore = bodyId ? [bodyId] : [];
  const reaches = (cells: Coord[], alsoIgnore: string[] = []): boolean =>
    origin === 'global' || inCastRange(state, side, origin, cells, def, [...ignore, ...alsoIgnore]);

  switch (def.target.kind) {
    case 'none':
      return [{ kind: 'none' }];

    case 'fallen': {
      // Only bodies that could actually be raised are offered. A card whose site is
      // blocked has no legal target at all, which is what stops it burning its cost — the
      // same rule the global cards keep two cases below.
      const site = def.target.site;
      const out: ChosenTarget[] = [];
      state.players[side].roster.forEach((entry, rosterIndex) => {
        if (entry.status !== 'fallen') return;
        if (reviveSpot(state, side, entry, site) === undefined) return;
        out.push({ kind: 'fallen', rosterIndex });
      });
      return out;
    }

    case 'global':
      // A board-wide detonation with nothing to detonate would silently burn its whole
      // cost, so treat it as having no legal target rather than letting it be wasted.
      if (def.effect.op === 'detonateAllMarks' && !allEntities(state).some((e) => e.mark)) {
        return [];
      }
      // The same hole, for the same reason: a global card that picks its own victim has
      // nothing to pick when the board is empty of foes. Worse than the detonation case,
      // in fact -- a card priced in Marrow would burn a resource that expires this turn
      // and cannot be banked back. Checked by area rather than by card id so the next
      // card to aim itself this way inherits the guard instead of re-finding the bug.
      if (effectSelfTargets(def.effect) && !lowestHpEnemy(state, side)) {
        return [];
      }
      return [{ kind: 'global' }];

    case 'emptyTile': {
      const tiles =
        def.target.zone === 'ownTerritory'
          ? summonSpots(state, side, def.target.footprint)
          : emptyTiles(state);
      // Summons into your own territory are placed by the Hero and are never ranged;
      // a tile-targeted spell cast anywhere on the board is thrown by the Companion.
      return tiles.filter((at) => reaches([at])).map((at) => ({ kind: 'tile' as const, at }));
    }

    case 'entity': {
      const spec = def.target;
      // Three things can never be done to a Bound Form, and offering them would waste the
      // card: it cannot be spent whole, it cannot be tithed — it keeps no health of its
      // own, so the wound would land on the Pact — and a mark attached to it could never
      // detonate, because its damage is redirected before marks are ever evaluated.
      const barred =
        effectContainsOp(def.effect, 'consumeTarget') ||
        effectContainsOp(def.effect, 'tithe') ||
        effectContainsOp(def.effect, 'attachAura') ||
        effectContainsOp(def.effect, 'attachMark');
      const out: ChosenTarget[] = [];
      for (const e of allEntities(state)) {
        const isUnitEntity = 'atk' in e;
        if (!spec.includeObstacles && !isUnitEntity) continue;
        if (spec.side === 'ally' && e.side !== side) continue;
        if (spec.side === 'enemy' && e.side === side) continue;
        if (spec.requireUnexhausted && isUnitEntity && !canAct(e as Unit)) continue;
        if (spec.requiresAura) {
          if (!isUnitEntity) continue;
          const u = e as Unit;
          if (!u.aura) continue;
          if (spec.requiresAura === 'climax' && !isClimaxed(u)) continue;
        }
        if (spec.requiresStatus) {
          if (!isUnitEntity) continue;
          if (((e as Unit).statuses[spec.requiresStatus] ?? 0) <= 0) continue;
        }
        if (barred && isUnitEntity && (e as Unit).keywords.includes('BoundForm')) continue;
        // The target itself never blocks the line to itself.
        if (!reaches(cellsOf(e), [e.id])) continue;
        out.push({ kind: 'entity', ref: refOf(e) });
      }
      return out;
    }

    case 'adjacentEnemy': {
      const out: ChosenTarget[] = [];
      for (const foe of unitsOf(state, opposite(side))) {
        out.push({ kind: 'entity', ref: { kind: 'unit', id: foe.id } });
      }
      return out;
    }

    case 'line': {
      const out: ChosenTarget[] = [];
      const length = def.target.length;
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const from = { x, y };
          // A line erupts at `from` and runs outward, so that origin tile is what has to
          // be in reach — not the far end of the line.
          if (!reaches([from])) continue;
          for (const dir of DIRS_8) {
            // Only offer lines that actually cover at least one entity.
            if (!lineCovers(state, from, dir, length).some((c) => entityAt(state, c))) continue;
            out.push({ kind: 'line', from, dir });
          }
        }
      }
      return out;
    }

    case 'unitOrPortrait': {
      const out: ChosenTarget[] = [
        { kind: 'entity', ref: { kind: 'portrait', side } },
      ];
      for (const u of unitsOf(state, side)) {
        // Armor on a Bound Form would never be consumed: its damage is redirected to the
        // Pact before unit armor is considered. The portrait above is the real target.
        if (u.keywords.includes('BoundForm')) continue;
        out.push({ kind: 'entity', ref: { kind: 'unit', id: u.id } });
      }
      return out;
    }
  }
}

export function lineCovers(state: GameState, from: Coord, dir: Coord, length: number): Coord[] {
  const out: Coord[] = [];
  let cur = { ...from };
  for (let i = 0; i < length; i++) {
    if (!inBounds(state, cur)) break;
    out.push({ ...cur });
    cur = { x: cur.x + dir.x, y: cur.y + dir.y };
  }
  return out;
}

/**
 * Everything a unit may attack: enemy entities in range with line of sight, plus the
 * enemy portrait when reachable.
 *
 * Melee (range 1-2) must stand in the opponent's two home rows to strike the portrait.
 * Ranged (3+) needs a clear straight or diagonal vector to it.
 */
export function legalAttacks(state: GameState, unit: Unit): TargetRef[] {
  if (!canAttack(unit)) return [];

  const out: TargetRef[] = [];
  const foeSide = opposite(unit.side);

  for (const e of allEntities(state)) {
    if (e.id === unit.id) continue;
    // Obstacles are terrain, not allies: either side may break a pillar to open a lane,
    // regardless of who conjured it.
    const isObstacle = !('atk' in e);
    const targetIsFeral = !isObstacle && (e as Unit).keywords.includes('Feral');
    const attackerIsFeral = unit.keywords.includes('Feral');

    if (attackerIsFeral) {
      // A beast has no allies. It will bite anything that is not also a beast, on
      // whichever side that thing happens to be — which is the whole of "hostile to
      // both", falling out of the target list rather than needing a rule of its own.
      if (targetIsFeral) continue;
    } else {
      // And nobody counts a beast as an ally either, including the side whose record it
      // sits in: it is on the board the way a pillar is, and either army may swing at it.
      if (!isObstacle && !targetIsFeral && e.side === unit.side) continue;
    }
    if (!canStrike(state, unit, cellsOf(unit), cellsOf(e), [unit.id, e.id])) continue;
    out.push(refOf(e));
  }

  if (canHitPortrait(state, unit, foeSide)) {
    out.push({ kind: 'portrait', side: foeSide });
  }

  return out;
}

/**
 * Can this unit strike these tiles from those ones?
 *
 * The single answer to "is that in reach", used by attack legality, by the danger
 * overlay, and by anything else that needs to know. It lived in three hand-copied
 * versions before, which is two more than can be kept in step: a change to reach or
 * sight had to be made identically in each, and the copies had already drifted apart
 * once. Everything that decides reach now goes through here.
 *
 * `from` is passed separately from the unit because the threat map asks the question
 * about anchors the unit could move to, not the one it currently occupies.
 */
export function canStrike(
  state: GameState,
  unit: Unit,
  from: Coord[],
  targets: Coord[],
  ignoreIds: UnitId[] = [unit.id],
): boolean {
  let best = Infinity;
  let toward: Coord = { x: 0, y: 0 };
  for (const c of from) {
    for (const t of targets) {
      const d = Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y));
      if (d < best) {
        best = d;
        toward = { x: t.x - c.x, y: t.y - c.y };
      }
    }
  }
  if (best < unit.rangeMin || best > effectiveRange(state, unit, toward)) return false;

  // A mortar lobs over everything, which is the whole of what it buys with its blind
  // spot: no line is needed, at any distance.
  if (unit.attackProfile === 'arcing') return true;

  // A marksman fires only down a rank, file, or diagonal. Being off the line is a
  // complete defence, whatever the distance.
  if (unit.attackProfile === 'lineOnly' && !onLine(from, targets)) return false;

  // Reaching past arm's length means seeing what you are reaching for; melee never does.
  if (best <= 1) return true;
  return from.some((c) => targets.some((t) => hasLoS(state, c, t, ignoreIds, unit.side)));
}

/**
 * Does this unit threaten any enemy from `anchor`?
 *
 * Asked of a tile a unit is *considering* moving to, which is why it deliberately does
 * not consult exhaustion the way `legalAttacks` does: the question is what the position
 * will be worth on the next turn, not what can be done from it this instant.
 *
 * Walks the enemies rather than the board — `strikeableFrom` in threat.ts answers the
 * mirror-image question by sweeping every tile, which is the right shape for drawing an
 * overlay once and the wrong shape for scoring dozens of candidate moves.
 */
export function threatensFrom(state: GameState, unit: Unit, anchor: Coord): boolean {
  const from = cellsAt(anchor, unit.footprint);
  const foeSide = opposite(unit.side);

  for (const foe of unitsOf(state, foeSide)) {
    if (foe.id === unit.id) continue;
    if (canStrike(state, unit, from, cellsOf(foe), [unit.id, foe.id])) return true;
  }
  return canHitPortrait(state, { ...unit, anchor }, foeSide);
}

/**
 * How far this unit can actually reach, once the sky is taken into account.
 *
 * Fog clamps everything to what can be seen. A gale stretches a shot thrown downwind and
 * shortens one thrown into the teeth of it — melee is untouched, since a wind that could
 * hold off a sword would be a different kind of problem.
 */
export function effectiveRange(state: GameState, unit: Unit, toward: Coord): number {
  let range = unit.rangeMax;

  const weather = state.encounter.weather;
  if (weather?.kind === 'gale' && range > 1) {
    const dot = toward.x * weather.wind.x + toward.y * weather.wind.y;
    if (dot > 0) range += 1;
    else if (dot < 0) range = Math.max(unit.rangeMin, range - 1);
  }

  const clamp = visionClamp(state);
  return clamp === undefined ? range : Math.min(range, clamp);
}

/** Whether any attacking cell shares a rank, file, or diagonal with any target cell. */
function onLine(from: Coord[], targets: Coord[]): boolean {
  return from.some((c) =>
    targets.some((t) => {
      const dx = Math.abs(c.x - t.x);
      const dy = Math.abs(c.y - t.y);
      return dx === 0 || dy === 0 || dx === dy;
    }),
  );
}

export function canHitPortrait(state: GameState, unit: Unit, targetSide: Side): boolean {
  // A rout has no enemy commander worth the name. Nothing may aim at the space where one
  // would have stood, because the pack is the whole of the opposition — an attack that
  // "hit the enemy Commander" here would be a blow landing on an abstraction the fight has
  // already said does not exist.
  if (state.encounter.rout && targetSide === 'enemy') return false;

  const cells = cellsOf(unit);

  if (unit.rangeMax <= 2 && unit.attackProfile === undefined) {
    // Melee: reaching the enemy's front or back row is the whole
    // requirement — standing in their territory is what puts the portrait in reach.
    const homeRows = startingZone(state, targetSide);
    return cells.some((c) => homeRows.includes(c.y));
  }

  // The portrait stands one row beyond the board's edge. Everything ranged measures
  // against that virtual row, so the profiles apply to the Commander exactly as they do
  // to a unit: a mortar lobs at the face within its envelope and cannot hit it from
  // point-blank, and a marksman needs a straight line to it.
  const row = portraitRow(state, targetSide);
  const mid = Math.floor((state.width - 1) / 2);
  const portraitCells: Coord[] = [{ x: mid, y: row }];

  // The sky applies to the Commander as much as to anything else. Without this a fogged
  // board would blind every unit while leaving snipers a clear shot at the face.
  const dist = Math.min(...cells.map((c) => Math.max(Math.abs(c.x - mid), Math.abs(c.y - row))));
  const reach = effectiveRange(state, unit, { x: 0, y: row < 0 ? -1 : 1 });
  if (dist > reach) return false;

  if (unit.attackProfile === 'arcing') {
    return dist >= unit.rangeMin;
  }

  if (unit.attackProfile === 'lineOnly' && !onLine(cells, portraitCells)) return false;

  // Ranged: needs a clear vector to the off-grid portrait.
  return cells.some((c) => hasLoSToPortrait(state, c, targetSide, [unit.id], unit.side));
}

/**
 * Units the given side may tithe for Marrow right now.
 *
 * `canAct` carries the Exhaustion rule, so a body already bled this turn drops out here
 * without this needing to know why. The Bound Form is excluded by keyword rather than by
 * worth: every body pays the same base rate now, so there is no longer a "worth nothing"
 * class to filter on.
 */
export function titheCandidates(state: GameState, side: Side): Unit[] {
  return unitsOf(state, side).filter(
    // Nothing bleeds a wolf that does not belong to it in the first place.
    (u) => canAct(u) && !u.keywords.includes('BoundForm') && !u.keywords.includes('Feral'),
  );
}

/** Resolves an entity reference to its board anchor, for previews and AI heuristics. */
export function anchorOf(state: GameState, ref: TargetRef): Coord | undefined {
  if (ref.kind === 'portrait') return undefined;
  return getEntity(state, ref.id)?.anchor;
}
