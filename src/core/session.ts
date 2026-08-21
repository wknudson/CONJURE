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
  CastInfo,
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
import { applyCommand, channelRefusal, deployRefusal } from './engine/engine.js';
import { deepClone } from './util/clone.js';
import { createCombat, type CombatCarry } from './engine/setup.js';
import { toBoardView, toCardSnapshot } from './engine/views.js';
import { CARDS } from './data/cards/index.js';
import { canAfford } from './engine/deck.js';
import { legalCardTargets, legalAttacks } from './engine/targeting.js';
import { costBreakdown, effectiveCost } from './engine/deck.js';
import { legalMoves } from './engine/movement.js';
import { occludedTiles } from './engine/los.js';
import { threatMap } from './engine/threat.js';
import { getEntity } from './engine/board.js';
import {
  COLLISION_BLOCKER_DAMAGE,
  COLLISION_OBSTACLE_DAMAGE,
  COLLISION_TARGET_DAMAGE,
} from './engine/displacement.js';
import { boardForNextEnemyTurn, commandsForDeclaredTurn } from './engine/intents.js';
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
    carry?: CombatCarry,
    /**
     * The player's Vanguard, as def ids.
     *
     * Omitting it opens the fight on turn one exactly as before. Passing one puts the
     * session into the deployment phase, which means the caller **must** have a UI able to
     * issue `finishDeployment` — there is no other way out of it.
     */
    roster?: string[],
  ) {
    const { state, events } = createCombat(encounter, seed, companionId, deck, carry, roster);
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

      case 'fallen':
        return {
          kind: 'fallen',
          entries: chosen.flatMap((c) => {
            if (c.kind !== 'fallen') return [];
            const entry = cmd.roster[c.rosterIndex];
            if (!entry) return [];
            return [
              {
                rosterIndex: c.rosterIndex,
                defId: entry.defId,
                name: CARDS[entry.defId]?.name ?? entry.defId,
                ...(entry.fellAt ? { at: { ...entry.fellAt } } : {}),
              },
            ];
          }),
        };

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

  /**
   * Where this card is cast from, for the targeting overlay.
   *
   * Returns undefined for anything the Hero throws, which is most of the deck — those
   * have no origin to draw and no reach to dim. Occlusion is computed here rather than
   * in the HUD because the HUD is not allowed to reach into the engine.
   */
  castInfo(cardId: CardInstanceId): CastInfo | undefined {
    const cmd = this.state.players.player;
    const def = CARDS[cmd.cards[cardId]?.defId ?? ''];
    if (!def || def.source !== 'companion' || def.range === undefined) return undefined;

    const bodyId = cmd.companionUnitId;
    const body = bodyId ? this.state.units[bodyId] : undefined;
    if (!body) return undefined;

    return {
      origin: { ...body.anchor },
      range: def.range,
      needsLoS: def.needsLoS === true,
      occluded: def.needsLoS ? occludedTiles(this.state, body.anchor) : [],
    };
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

  /**
   * Your units that can still do something this turn, in board order.
   *
   * Readiness is derived rather than stored: a unit is ready if the engine would accept a
   * move or an attack from it. Asking the same functions the rules use means Tab can
   * never offer a unit that turns out to be inert, which is exactly the friction it
   * exists to remove.
   */
  getReadyUnits(): UnitId[] {
    if (this.state.activeSide !== 'player') return [];
    return Object.values(this.state.units)
      .filter((u) => u.side === 'player')
      .filter((u) => legalMoves(this.state, u).length > 0 || legalAttacks(this.state, u).length > 0)
      .sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x)
      .map((u) => u.id);
  }

  /**
   * Whether this unit could Channel right now.
   *
   * Delegates to the engine's own refusal check rather than re-deriving the rules from a
   * snapshot: `exhausted` conflates having moved with having attacked, and a unit that
   * has moved may still Channel, so the UI cannot answer this from a snapshot alone.
   */
  canChannel(unitId: UnitId): boolean {
    if (this.state.activeSide !== 'player') return false;
    return channelRefusal(this.state, unitId) === null;
  }

  /**
   * Whether the player is about to waste something by passing.
   *
   * Two kinds of waste: a unit that could still act, and a card that could still be
   * played. Both are asked of the same helpers the UI uses to offer them in the first
   * place, so the warning cannot disagree with the affordances on screen.
   */
  getUnspentPotential(): { readyUnits: number; playableCards: number } {
    if (this.state.activeSide !== 'player') return { readyUnits: 0, playableCards: 0 };
    return {
      readyUnits: this.getReadyUnits().length,
      playableCards: this.getPlayableCards().length,
    };
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
      cost: { pips: 0, marrow: 0 },
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
      cost: { pips: 0, marrow: 0 },
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
              // Read from the engine's own constants rather than restated. The preview
              // is a promise about what the reducer will do, and a promise written twice
              // is a promise that drifts -- which is exactly what the Stat Stretch would
              // have done to a hard-coded three.
              damage: COLLISION_TARGET_DAMAGE,
              ...(blocker
                ? {
                    collateral: {
                      id: blocker.id,
                      damage:
                        e.against === 'obstacle'
                          ? COLLISION_OBSTACLE_DAMAGE
                          : COLLISION_BLOCKER_DAMAGE,
                    },
                  }
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
        preview.cost = costBreakdown(
          before.players.player.marrow,
          effectiveCost(before, 'player', def),
        );
      }
    }

    return preview;
  }

  isOver(): boolean {
    return Boolean(this.state.result);
  }

  /**
   * The Pact as it stands, which is the one number a run needs back out of a fight.
   *
   * A named getter rather than letting the teardown reach through `debugState`: the run
   * should be able to close a fight without being handed the whole board.
   */
  get pactHp(): number {
    return this.state.players.player.hp;
  }

  /** Enemy stat blocks met on this board, by definition id. Duplicates kept. */
  get encounteredEnemies(): string[] {
    return [...this.state.encountered];
  }

  /** Enemy stat blocks killed on this board, by definition id. Duplicates kept. */
  get defeatedEnemies(): string[] {
    return [...this.state.defeated];
  }

  get result() {
    return this.state.result;
  }

  get activeSide() {
    return this.state.activeSide;
  }

  // ----------------------------------------------------------------- mutation

  /** Commits a player action and returns the events to animate. */
  /**
   * Why this body may not stand on that tile, or null if it may.
   *
   * The engine's own predicate, forwarded rather than reimplemented: the reducer throws
   * exactly this string, so the tile the UI lights and the tile the command accepts can
   * never disagree.
   */
  deployRefusal(defId: string, at: Coord): string | null {
    return deployRefusal(this.state, defId, at);
  }

  /**
   * Whether the tray's held body could take this tile.
   *
   * `null` asks the weaker question — "is this an Anchor anything could stand on" — which
   * is what lights the ground before the player has picked anyone up.
   */
  canDeploy(defId: string | null, at: Coord): boolean {
    if (defId) return deployRefusal(this.state, defId, at) === null;
    return this.state.players.player.roster.some(
      (r) => r.status === 'reserve' && deployRefusal(this.state, r.defId, at) === null,
    );
  }

  dispatch(action: Action): GameEvent[] {
    const res = applyCommand(this.state, toCommand(action));
    this.state = res.state;
    return res.events;
  }

  /**
   * A snapshot the client can hold onto and hand back later.
   *
   * This exists for Undo, which is deliberately a *client* convenience rather than a game
   * action: nothing is emitted, nothing enters the event stream, and the engine remains a
   * pure reducer that has no idea the player changed their mind. Because a snapshot
   * includes the RNG state, restoring one rewinds the seeded stream too — so a rewound
   * game continues along exactly the branch it would have taken had the move never
   * happened, rather than a differently-shuffled one.
   */
  snapshot(): GameState {
    return deepClone(this.state);
  }

  restore(state: GameState): void {
    this.state = deepClone(state);
  }

  /** Runs the AI's whole turn and returns its combined event stream. */
  /**
   * Runs the enemy turn from what it already committed to.
   *
   * The plan is *not* recomputed here. Whatever was declared at the end of the previous
   * turn is what happens, adapted only for a board that has changed since — that promise
   * is the entire value of telegraphing. Only when nothing was declared (the very first
   * enemy turn) does it fall back to planning on the spot.
   */
  runAiTurn(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.result) return events;
    if (this.state.activeSide !== 'enemy') return events;

    // `endTurn` is stripped: ending the turn belongs to finishEnemyTurn, which has to
    // declare next turn's intents first. Letting it through here would flip the side and
    // skip the declaration entirely.
    const plan = (
      this.state.declaredPlan.length > 0
        ? commandsForDeclaredTurn(this.state)
        : planTurn(this.state, 'enemy', this.ai)
    ).filter((c) => c.type !== 'endTurn');

    // The declaration has now been cashed in; it must not be shown again or replayed.
    this.state = { ...this.state, intents: [], declaredPlan: [] };

    for (const command of plan) {
      if (this.state.result) break;
      try {
        const res = applyCommand(this.state, command);
        this.state = res.state;
        events.push(...res.events);
      } catch {
        // A declared action can be invalidated by an earlier one's cascade, or by the
        // player having moved the ground out from under it. Skip it and continue: one
        // dead intent must not silently cancel the rest of the turn.
        continue;
      }
    }

    // Whatever remains unspent is played out and re-declared for next turn.
    events.push(...this.finishEnemyTurn());
    return events;
  }

  /**
   * Ends the enemy turn and commits to the next one.
   *
   * Declaration happens here, inside the normal command flow, so it consumes the seeded
   * RNG at a fixed point and replays identically.
   */
  private finishEnemyTurn(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.result || this.state.activeSide !== 'enemy') return events;

    // An Adept keeps its cards hidden, so it still has undeclared plays to make.
    if (this.ai.telegraph !== 'all') {
      for (const command of planTurn(this.state, 'enemy', this.ai)) {
        if (command.type === 'endTurn') break;
        if (command.type === 'declareIntents') continue;
        if (this.state.result) break;
        try {
          const res = applyCommand(this.state, command);
          this.state = res.state;
          events.push(...res.events);
        } catch {
          continue;
        }
      }
    }

    if (this.state.result) return events;

    // Commit to next turn *before* handing over, so the player spends their turn
    // answering a known threat. Planned against a forecast board on which the enemy's
    // units have refreshed, since they are all spent at this exact moment.
    const next = planTurn(boardForNextEnemyTurn(this.state), 'enemy', this.ai);
    // The Monocle buys back what the difficulty hides. Resolved here rather than inside
    // the reducer because the engine has no idea an AI tier exists — it is handed a
    // telegraph setting and honours it, exactly as before.
    const telegraph = this.state.players.player.revealsIntents ? 'all' : this.ai.telegraph;
    const declared = applyCommand(this.state, { type: 'declareIntents', plan: next, telegraph });
    this.state = declared.state;
    events.push(...declared.events);

    try {
      const res = applyCommand(this.state, { type: 'endTurn' });
      this.state = res.state;
      events.push(...res.events);
    } catch {
      /* already over */
    }
    return events;
  }
}

function toCommand(action: Action): Command {
  switch (action.type) {
    case 'playCard':
      return {
        type: 'playCard',
        card: action.card,
        target: toChosen(action.target),
        ...(action.x !== undefined ? { x: action.x } : {}),
      };
    case 'moveUnit':
      return { type: 'moveUnit', unit: action.unit, to: action.to };
    case 'attack':
      return { type: 'attack', attacker: action.attacker, target: action.target };
    case 'bloodTithe':
      return { type: 'bloodTithe', unit: action.unit };
    case 'channel':
      return { type: 'channel', unit: action.unit };
    case 'deployUnit':
      return { type: 'deployUnit', defId: action.defId, at: action.at };
    case 'recallUnit':
      return { type: 'recallUnit', unit: action.unit };
    case 'finishDeployment':
      return { type: 'finishDeployment' };
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
    case 'fallen':
      return { kind: 'fallen', rosterIndex: sel.rosterIndex };
    case 'global':
      return { kind: 'global' };
  }
}
