/**
 * CombatSession — the façade the UI drives.
 *
 * It owns the authoritative GameState, exposes the pure RulesQuery the renderer needs
 * for affordances and previews, and returns event batches for the sequencer to animate.
 * The UI never touches GameState directly.
 */

import type { CardInstanceId, Coord, TargetRef, UnitId } from '../contract/ids.js';
import type { GameEvent } from '../contract/events.js';
import type {
  Action,
  ActionPreview,
  BoardView,
  RulesQuery,
  TargetSelection,
  TargetSpec,
  ThreatView,
} from '../contract/query.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import type { GameState } from './types/state.js';
import type { Command } from './types/commands.js';
import type { ChosenTarget } from './types/cards.js';
import type { EncounterDef } from './data/encounters/registry.js';
import { applyCommand } from './engine/engine.js';
import { createCombat } from './engine/setup.js';
import { toBoardView, toCardSnapshot } from './engine/views.js';
import { CARDS } from './data/cards/index.js';
import { canAfford } from './engine/deck.js';
import { legalCardTargets, legalAttacks } from './engine/targeting.js';
import { legalMoves } from './engine/movement.js';
import { occludedTiles } from './engine/los.js';
import { threatMap } from './engine/threat.js';
import { getEntity } from './engine/board.js';
import { planTurn, NOVICE_AI, type AiProfile } from './ai/controller.js';
import { lineCovers } from './engine/targeting.js';

export class CombatSession implements RulesQuery {
  private state: GameState;
  private readonly ai: AiProfile;
  /** Events produced by setup, handed to the sequencer on first drain. */
  readonly openingEvents: GameEvent[];

  constructor(
    encounter: EncounterDef,
    seed: number,
    ai: AiProfile = NOVICE_AI,
    companionId?: string,
    deck?: string[],
  ) {
    const { state, events } = createCombat(encounter, seed, companionId, deck);
    this.state = state;
    this.openingEvents = events;
    this.ai = ai;
  }

  /**
   * Raw state, for the determinism harness and invariant checks only. Treat as
   * read-only — the UI must go through the view and query methods.
   */
  get debugState(): GameState {
    return this.state;
  }

  // ----------------------------------------------------------------- queries

  getBoard(): BoardView {
    return toBoardView(this.state);
  }

  getHand(): CardSnapshot[] {
    return this.state.players.player.hand.map((id) =>
      toCardSnapshot(this.state, 'player', id),
    );
  }

  getPlayableCards(): CardInstanceId[] {
    const cmd = this.state.players.player;
    if (this.state.activeSide !== 'player' || this.state.phase !== 'action') return [];

    return cmd.hand.filter((id) => {
      const def = CARDS[cmd.cards[id]?.defId ?? ''];
      if (!def) return false;
      if (!canAfford(this.state, 'player', def.cost)) return false;
      return legalCardTargets(this.state, 'player', def.id).length > 0;
    });
  }

  getLegalTargets(cardId: CardInstanceId): TargetSpec {
    const cmd = this.state.players.player;
    const def = CARDS[cmd.cards[cardId]?.defId ?? ''];
    if (!def) return { kind: 'none' };

    const chosen = legalCardTargets(this.state, 'player', def.id);
    if (chosen.length === 0) return { kind: 'none' };

    switch (def.target.kind) {
      case 'global':
        return { kind: 'global' };

      case 'emptyTile':
        return {
          kind: 'tiles',
          tiles: chosen.flatMap((c) => (c.kind === 'tile' ? [c.at] : [])),
        };

      case 'line':
        return {
          kind: 'lines',
          origins: chosen.flatMap((c) =>
            c.kind === 'line'
              ? [{ from: c.from, dir: c.dir, covers: lineCovers(this.state, c.from, c.dir, def.target.kind === 'line' ? def.target.length : 2) }]
              : [],
          ),
        };

      default:
        return {
          kind: 'entities',
          refs: chosen.flatMap((c) => (c.kind === 'entity' ? [c.ref] : [])),
        };
    }
  }

  getLegalMoves(unitId: UnitId): Coord[] {
    const unit = this.state.units[unitId];
    if (!unit || unit.side !== 'player') return [];
    if (this.state.activeSide !== 'player') return [];
    return legalMoves(this.state, unit).map((m) => m.to);
  }

  getLegalAttacks(unitId: UnitId): TargetRef[] {
    const unit = this.state.units[unitId];
    if (!unit || unit.side !== 'player') return [];
    if (this.state.activeSide !== 'player') return [];
    return legalAttacks(this.state, unit);
  }

  getOccludedTiles(from: Coord): Coord[] {
    return occludedTiles(this.state, from);
  }

  getThreat(): ThreatView {
    const map = threatMap(this.state, 'player');
    return {
      tiles: map.tiles.map((at) => ({
        at,
        damage: map.damageByTile.get(`${at.x},${at.y}`) ?? 0,
      })),
      commanderThreatCount: map.commanderThreats.length,
    };
  }

  /**
   * Simulates an action without committing it. Implemented as a real dispatch onto a
   * clone, so a preview can never disagree with what actually happens.
   */
  previewAction(action: Action): ActionPreview {
    const empty: ActionPreview = {
      legal: false,
      tileEffects: [],
      displacements: [],
      detonations: [],
      predictedDeaths: [],
      cost: { pips: 0, sparks: 0 },
    };

    let events: GameEvent[];
    let before = this.state;
    try {
      const res = applyCommand(this.state, toCommand(action));
      events = res.events;
    } catch (err) {
      return { ...empty, reason: err instanceof Error ? err.message : 'illegal' };
    }

    const preview: ActionPreview = {
      legal: true,
      tileEffects: [],
      displacements: [],
      detonations: [],
      predictedDeaths: [],
      cost: { pips: 0, sparks: 0 },
    };

    const paths = new Map<UnitId, Coord[]>();

    for (const e of events) {
      switch (e.t) {
        case 'damageDealt': {
          if (e.at) preview.tileEffects.push({ at: e.at, damage: e.amount, kind: 'hit' });
          break;
        }
        case 'unitDisplaced': {
          const path = paths.get(e.unitId) ?? [e.from];
          path.push(e.to);
          paths.set(e.unitId, path);
          break;
        }
        case 'collision': {
          const path = paths.get(e.unitId) ?? [e.at];
          paths.set(e.unitId, path);
          const blocker = e.blockerId ? getEntity(before, e.blockerId) : undefined;
          preview.displacements.push({
            unitId: e.unitId,
            path,
            collision: {
              at: e.at,
              against: e.against,
              damage: 3,
              ...(blocker
                ? { collateral: { id: blocker.id, damage: e.against === 'obstacle' ? 3 : 2 } }
                : {}),
            },
          });
          break;
        }
        case 'runeDetonated': {
          preview.detonations.push({
            hostId: e.hostId,
            at: e.at,
            affected: e.affected,
            chainDepth: e.chainDepth,
          });
          for (const at of e.affected) {
            preview.tileEffects.push({ at, kind: 'aoe' });
          }
          break;
        }
        case 'unitDied':
          preview.predictedDeaths.push(e.unitId);
          break;
        case 'unitSummoned':
          preview.tileEffects.push({ at: e.unit.anchor, kind: 'summon' });
          break;
        case 'armorGained':
          if (e.target.kind === 'unit') {
            const u = before.units[e.target.id];
            if (u) preview.tileEffects.push({ at: u.anchor, kind: 'buff' });
          }
          break;
        default:
          break;
      }
    }

    // Displacements that never collided still deserve a ghost path.
    for (const [unitId, path] of paths) {
      if (preview.displacements.some((d) => d.unitId === unitId)) continue;
      preview.displacements.push({ unitId, path });
    }

    if (action.type === 'playCard') {
      const def = CARDS[before.players.player.cards[action.card]?.defId ?? ''];
      if (def) {
        const sparks = Math.min(before.players.player.sparks, def.cost);
        preview.cost = { pips: def.cost - sparks, sparks };
      }
    }

    return preview;
  }

  isOver(): boolean {
    return Boolean(this.state.result);
  }

  get result() {
    return this.state.result;
  }

  get activeSide() {
    return this.state.activeSide;
  }

  // ----------------------------------------------------------------- mutation

  /** Commits a player action and returns the events to animate. */
  dispatch(action: Action): GameEvent[] {
    const res = applyCommand(this.state, toCommand(action));
    this.state = res.state;
    return res.events;
  }

  /** Runs the AI's whole turn and returns its combined event stream. */
  runAiTurn(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.result) return events;
    if (this.state.activeSide !== 'enemy') return events;

    const plan = planTurn(this.state, 'enemy', this.ai);
    for (const command of plan) {
      if (this.state.result) break;
      try {
        const res = applyCommand(this.state, command);
        this.state = res.state;
        events.push(...res.events);
      } catch {
        // A planned action can be invalidated by an earlier one's cascade; skip it.
        break;
      }
    }
    return events;
  }
}

function toCommand(action: Action): Command {
  switch (action.type) {
    case 'playCard':
      return { type: 'playCard', card: action.card, target: toChosen(action.target) };
    case 'moveUnit':
      return { type: 'moveUnit', unit: action.unit, to: action.to };
    case 'attack':
      return { type: 'attack', attacker: action.attacker, target: action.target };
    case 'sacrifice':
      return { type: 'sacrifice', unit: action.unit };
    case 'endTurn':
      return { type: 'endTurn' };
  }
}

function toChosen(sel: TargetSelection | undefined): ChosenTarget {
  if (!sel) return { kind: 'none' };
  switch (sel.kind) {
    case 'tile':
      return { kind: 'tile', at: sel.at };
    case 'entity':
      return { kind: 'entity', ref: sel.ref };
    case 'line':
      return { kind: 'line', from: sel.from, dir: sel.dir };
    case 'global':
      return { kind: 'global' };
  }
}
