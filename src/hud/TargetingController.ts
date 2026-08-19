/**
 * The input state machine.
 *
 *   IDLE ──hover card──▶ INSPECT (legal tiles pre-glow)
 *   IDLE ──click playable card──▶ TARGETING ──click legal tile──▶ COMMIT
 *   IDLE ──click own ready unit──▶ UNIT_SELECTED (moves + attacks highlighted)
 *   Esc / right-click ──▶ back to IDLE
 *
 * Every legality question and every preview goes through the RulesQuery facade, so the
 * UI and the engine can never disagree about what is possible.
 */

import type { CardInstanceId, Coord, TargetRef, UnitId } from '../contract/ids.js';
import { coordEq, coordKey } from '../contract/ids.js';
import type { Action, BoardView, RulesQuery, TargetSpec } from '../contract/query.js';
import type { Overlays } from '../render/BoardRenderer.js';
import { emptyOverlays } from '../render/BoardRenderer.js';
import { cellsAt } from '../core/util/grid.js';
import { describeShortfall } from './cost.js';

type Mode =
  | { kind: 'idle' }
  | { kind: 'targeting'; card: CardInstanceId; spec: TargetSpec }
  | { kind: 'unit'; unit: UnitId };

export interface TargetingCallbacks {
  commit(action: Action): void;
  setOverlays(overlays: Overlays): void;
  setSelectedCard(id: CardInstanceId | null): void;
  setEnemyTargetable(on: boolean): void;
  notice(text: string): void;
  /** A standing warning about what the hovered target would cost. Null clears it. */
  warn(text: string | null): void;
  setInspected(unitId: UnitId | null): void;
}

export class TargetingController {
  private mode: Mode = { kind: 'idle' };
  private hover: Coord | null = null;
  private hoveredCard: CardInstanceId | null = null;
  private expanded = false;
  private enabled = true;
  private threatOn = false;

  constructor(
    private readonly rules: RulesQuery,
    private readonly cb: TargetingCallbacks,
  ) {}

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
    else this.refresh();
  }

  reset(): void {
    this.mode = { kind: 'idle' };
    this.hoveredCard = null;
    this.cb.warn(null);
    this.cb.setSelectedCard(null);
    this.cb.setEnemyTargetable(false);
    this.cb.setInspected(null);
    this.cb.setOverlays(emptyOverlays());
  }

  /** The unit currently selected, if any. */
  get selectedUnit(): UnitId | null {
    return this.mode.kind === 'unit' ? this.mode.unit : null;
  }

  /** Selects a unit directly, as Tab-cycling does, bypassing a board click. */
  selectUnit(unitId: UnitId): void {
    if (!this.enabled) return;
    this.mode = { kind: 'unit', unit: unitId };
    this.hoveredCard = null;
    this.cb.setSelectedCard(null);
    this.cb.setInspected(unitId);
    this.refresh();
  }

  /** Re-emits the current overlays, e.g. after the board has been rotated. */
  refreshOverlays(): void {
    this.refresh();
  }

  setExpanded(on: boolean): void {
    if (this.expanded === on) return;
    this.expanded = on;
    this.refresh();
  }

  /** Danger zone: every tile the enemy could strike next turn. */
  toggleThreat(): boolean {
    this.threatOn = !this.threatOn;
    this.refresh();
    return this.threatOn;
  }

  get threatVisible(): boolean {
    return this.threatOn;
  }

  // -------------------------------------------------------------------- input

  onCardHover(id: CardInstanceId | null): void {
    if (!this.enabled) return;
    if (this.mode.kind === 'targeting') return;
    this.hoveredCard = id;
    this.refresh();
  }

  onCardClick(id: CardInstanceId): void {
    if (!this.enabled) return;

    if (this.mode.kind === 'targeting' && this.mode.card === id) {
      this.reset();
      return;
    }

    if (!this.rules.getPlayableCards().includes(id)) {
      this.cb.notice(this.whyUnplayable(id));
      return;
    }

    const spec = this.rules.getLegalTargets(id);

    // Cards with no choice to make resolve on the second click.
    if (spec.kind === 'global' || spec.kind === 'none') {
      this.cb.commit({ type: 'playCard', card: id, target: { kind: 'global' } });
      this.reset();
      return;
    }

    this.mode = { kind: 'targeting', card: id, spec };
    this.cb.setSelectedCard(id);
    this.refresh();
  }

  /** "You can't play that" is useless on its own — name the actual obstacle. */
  private whyUnplayable(id: CardInstanceId): string {
    const board = this.rules.getBoard();
    const card = this.rules.getHand().find((c) => c.instanceId === id);
    if (!card) return 'That card is no longer in your hand';

    // Names the pool that is actually missing. A strict Marrow cost cannot be solved by
    // banking, so telling the player they are "2 short" of a total would send them off to
    // save Pips that will never buy it.
    const shortfall = describeShortfall(card.cost, board.player.pips, board.player.marrow);
    if (shortfall) return `${card.name} ${shortfall}`;

    switch (card.kind) {
      case 'minion':
        return `Nowhere to deploy ${card.name} — your two home rows have no free space for it`;
      case 'rune':
        return `${card.name} has nothing to attach to right now`;
      case 'obstacle':
        return `No empty tile for ${card.name}`;
      default:
        return `${card.name} has no legal target right now`;
    }
  }

  onTileHover(tile: Coord | null): void {
    if (!this.enabled) return;
    if (this.hover && tile && coordEq(this.hover, tile)) return;
    this.hover = tile;
    this.cb.warn(this.hoverWarning(tile));
    this.refresh();
  }

  /**
   * What the player is about to do to themselves, if anything.
   *
   * Tethering the Bound Form is legal and is sometimes right — it is often the toughest
   * body available, and on a thin board it may be the only one. But the beast will then
   * spend three rounds hitting a unit whose wounds are dealt straight to the Pact, so it
   * is a decision that has to be made knowingly rather than discovered afterwards.
   */
  private hoverWarning(tile: Coord | null): string | null {
    // Captured into a local: narrowing `this.mode` does not survive into the closure.
    const mode = this.mode;
    if (!tile || mode.kind !== 'targeting') return null;

    const card = this.rules.getHand().find((c) => c.instanceId === mode.card);
    if (card?.defId !== 'rite_of_subjugation') return null;

    const board = this.rules.getBoard();
    const unit = board.units.find(
      (u) => u.side === 'player' && cellsAt(u.anchor, u.footprint).some((c) => coordEq(c, tile)),
    );
    if (!unit?.keywords.includes('BoundForm')) return null;

    return 'WARNING: tethering your Companion routes every blow the beast lands straight into your Pact.';
  }

  onTileClick(tile: Coord): void {
    if (!this.enabled) return;

    if (this.mode.kind === 'targeting') {
      const action = this.actionForTile(this.mode.card, this.mode.spec, tile);
      if (!action) {
        this.cb.notice('Not a legal target');
        return;
      }
      this.cb.commit(action);
      this.reset();
      return;
    }

    if (this.mode.kind === 'unit') {
      const unitId = this.mode.unit;

      // Attacking takes priority when an enemy occupies the clicked tile.
      const attack = this.rules
        .getLegalAttacks(unitId)
        .find((ref) => ref.kind !== 'portrait' && this.refOccupies(ref, tile));
      if (attack) {
        this.cb.commit({ type: 'attack', attacker: unitId, target: attack });
        this.reset();
        return;
      }

      if (this.rules.getLegalMoves(unitId).some((c) => coordEq(c, tile))) {
        this.cb.commit({ type: 'moveUnit', unit: unitId, to: tile });
        this.reset();
        return;
      }
    }

    // Otherwise: select whatever unit is on this tile.
    const unit = this.unitAt(tile);
    if (unit && unit.side === 'player') {
      this.mode = { kind: 'unit', unit: unit.id };
      this.cb.setInspected(unit.id);
      this.explainIfStuck(unit.id, unit.name);
      this.refresh();
      return;
    }

    if (unit && unit.side === 'enemy') {
      // Clicking an enemy is a natural instinct; say what it would take to hit it.
      this.cb.notice(`${unit.name} — select one of your units to attack it`);
      this.reset();
      return;
    }

    this.reset();
  }

  /**
   * A selected unit with nothing highlighted is the most confusing state in the game.
   * Say why rather than leaving the player clicking an inert piece.
   */
  private explainIfStuck(unitId: UnitId, name: string): void {
    const moves = this.rules.getLegalMoves(unitId);
    const attacks = this.rules.getLegalAttacks(unitId);
    if (moves.length > 0 || attacks.length > 0) return;

    const unit = this.rules.getBoard().units.find((u) => u.id === unitId);
    const statuses = this.rules
      .getBoard()
      .statuses.filter((s) => s.unitId === unitId)
      .map((s) => s.kind);

    if (statuses.includes('freeze') || statuses.includes('stun')) {
      this.cb.notice(`${name} is held in place and cannot act this turn`);
    } else if (unit && !unit.keywords.includes('Haste')) {
      this.cb.notice(`${name} has already acted, or was just deployed and must wait a turn`);
    } else {
      this.cb.notice(`${name} has already acted this turn`);
    }
  }

  /** Attacking the enemy Commander, who stands beside the board rather than on it. */
  onEnemyCommanderClick(): void {
    if (!this.enabled) return;

    if (this.mode.kind !== 'unit') {
      this.cb.notice('Select one of your units first, then click the enemy Commander');
      return;
    }

    const ref = this.rules
      .getLegalAttacks(this.mode.unit)
      .find((r): r is Extract<TargetRef, { kind: 'portrait' }> => r.kind === 'portrait');
    if (!ref) {
      this.cb.notice('That unit cannot reach the enemy Commander — get into their back rows');
      return;
    }
    this.cb.commit({ type: 'attack', attacker: this.mode.unit, target: ref });
    this.reset();
  }

  onCancel(): void {
    if (!this.enabled) return;
    this.reset();
  }

  // ------------------------------------------------------------------ overlays

  refresh(): void {
    if (!this.enabled) return;

    const overlays = emptyOverlays();
    overlays.hover = this.hover;
    overlays.expanded = this.expanded;
    const board = this.rules.getBoard();
    overlays.hazards = board.hazards;
    overlays.intents = board.intents;
    overlays.showThreat = this.threatOn;
    if (this.threatOn) overlays.threat = this.rules.getThreat().tiles;

    if (this.mode.kind === 'targeting') {
      this.paintCardTargets(overlays, this.mode.spec);
      this.paintCastOrigin(overlays, this.mode.card);
      // After the targets and the origin, both of which it reads.
      this.paintDimmed(overlays, this.mode.card);
      this.paintCardTrajectory(overlays, this.mode.card);
      this.previewInto(overlays, this.mode.card, this.mode.spec);
    } else if (this.mode.kind === 'unit') {
      this.paintUnitOptions(overlays, this.mode.unit);
    } else if (this.hoveredCard) {
      // Inspect mode: a faint pre-glow of where this card could land.
      const spec = this.rules.getLegalTargets(this.hoveredCard);
      this.paintCardTargets(overlays, spec);
      this.paintCastOrigin(overlays, this.hoveredCard);
      this.paintDimmed(overlays, this.hoveredCard);
      this.paintCardTrajectory(overlays, this.hoveredCard);
    }

    this.cb.setOverlays(overlays);
  }

  /**
   * Marks where a Companion card is thrown from, and shades what its origin cannot see.
   *
   * The legal tiles already account for range and sight, so this adds no rules — it
   * answers the question the highlighting raises but cannot answer on its own: *why* is
   * that tile not offered? Seeing the fog behind a wall makes the answer obvious, and
   * makes moving the Companion the visible fix.
   */
  private paintCastOrigin(overlays: Overlays, cardId: CardInstanceId): void {
    const info = this.rules.castInfo(cardId);
    if (!info) return;
    overlays.castOrigin = info.origin;
    if (info.occluded.length) overlays.fog = info.occluded;
  }

  /**
   * Shades what the cast can reach and cannot use.
   *
   * The highlighting says where you may aim; on its own it says nothing about why the
   * rest are refused, and "not lit" covers both "too far to bother showing you" and "you
   * could reach that and it will not work". Only the second is worth drawing, so the
   * shading is bounded by the card's own reach: everything inside the envelope that is
   * neither a legal target nor already hatched as unseeable.
   *
   * Chebyshev, like every other distance in the game.
   */
  private paintDimmed(overlays: Overlays, cardId: CardInstanceId): void {
    const info = this.rules.castInfo(cardId);
    if (!info) return;

    const legal = new Set(overlays.highlight.map((c) => coordKey(c)));
    const unseen = new Set(overlays.fog.map((c) => coordKey(c)));
    const board = this.rules.getBoard();
    const out: Coord[] = [];

    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        const at = { x, y };
        const key = coordKey(at);
        if (legal.has(key) || unseen.has(key)) continue;
        const reach = Math.max(
          Math.abs(x - info.origin.x),
          Math.abs(y - info.origin.y),
        );
        if (reach === 0 || reach > info.range) continue;
        out.push(at);
      }
    }

    overlays.dimmed = out;
  }

  /**
   * The one flight line, drawn to whatever is under the cursor.
   *
   * Deliberately one rather than one per legal tile: thirty lines fanning out of a body
   * is a starburst, not an answer. The question a player is asking while hovering is
   * "what happens if I click *here*", and the line answers exactly that.
   *
   * A card that does not need a line of sight is drawn as a lob, because that is what
   * not needing one means — it goes over rather than through, and on an isometric board
   * the arc is the only thing that says so.
   */
  private paintCardTrajectory(overlays: Overlays, cardId: CardInstanceId): void {
    if (!this.hover) return;
    const info = this.rules.castInfo(cardId);
    if (!info) return;
    if (!overlays.highlight.some((c) => coordEq(c, this.hover!))) return;

    const card = this.rules.getHand().find((c) => c.instanceId === cardId);
    overlays.trajectory = [
      {
        from: info.origin,
        to: this.hover,
        school: card?.school ?? 'neutral',
        arcing: !info.needsLoS,
      },
    ];
  }

  /**
   * The selected body's own reach: the ring around all of it, and the badge beside it.
   *
   * A Behemoth ringed on its anchor alone reads as a 1x1 standing inside a 2x2, so the
   * footprint is expanded here, where it is known, rather than guessed at in the renderer.
   */
  private paintReach(overlays: Overlays, unit: BoardView['units'][number]): void {
    overlays.selectedCells = cellsAt(unit.anchor, unit.footprint);

    const profile: 'melee' | 'ranged' | 'arcing' =
      unit.attackProfile === 'arcing' ? 'arcing' : unit.rangeMax > 1 ? 'ranged' : 'melee';

    overlays.badges = [
      { unitId: unit.id, profile, rangeMin: unit.rangeMin, rangeMax: unit.rangeMax },
    ];

    // A shot at whatever is under the cursor, if it is something this body may hit.
    if (this.hover && profile !== 'melee') {
      const reachable = overlays.attack.some((c) => coordEq(c, this.hover!));
      if (reachable) {
        overlays.trajectory = [
          {
            from: unit.anchor,
            to: this.hover,
            school: unit.school,
            arcing: profile === 'arcing',
          },
        ];
      }
    }
  }

  private paintCardTargets(overlays: Overlays, spec: TargetSpec): void {
    switch (spec.kind) {
      case 'tiles':
        overlays.highlight = spec.tiles;
        break;
      case 'entities':
        overlays.highlight = spec.refs.flatMap((ref) => this.refCells(ref));
        this.cb.setEnemyTargetable(spec.refs.some((r) => r.kind === 'portrait'));
        break;
      case 'lines':
        overlays.highlight = dedupe(spec.origins.map((o) => o.from));
        break;
      default:
        break;
    }
  }

  private paintUnitOptions(overlays: Overlays, unitId: UnitId): void {
    const board = this.rules.getBoard();
    const unit = board.units.find((u) => u.id === unitId);
    if (unit) overlays.selected = unit.anchor;

    overlays.highlight = this.rules.getLegalMoves(unitId);

    const attacks = this.rules.getLegalAttacks(unitId);
    overlays.attack = attacks.flatMap((ref) => this.refCells(ref));
    this.cb.setEnemyTargetable(attacks.some((r) => r.kind === 'portrait'));

    // After `attack` is filled: the trajectory is only drawn to a tile this body may
    // actually strike, and that list is what says so.
    if (unit) this.paintReach(overlays, unit);

    // Ranged units show their shadow cone so occlusion is visible, not guessed at.
    if (unit && unit.rangeMax >= 3) {
      overlays.fog = this.rules.getOccludedTiles(unit.anchor);
    }

    // Hovering a reachable tile previews the move; hovering an enemy previews the hit.
    if (this.hover) {
      const target = attacks.find(
        (ref) => ref.kind !== 'portrait' && this.refOccupies(ref, this.hover!),
      );
      const action: Action | null = target
        ? { type: 'attack', attacker: unitId, target }
        : overlays.highlight.some((c) => coordEq(c, this.hover!))
          ? { type: 'moveUnit', unit: unitId, to: this.hover }
          : null;
      if (action) this.applyPreview(overlays, action);
    }
  }

  private previewInto(overlays: Overlays, card: CardInstanceId, spec: TargetSpec): void {
    if (!this.hover) return;
    const action = this.actionForTile(card, spec, this.hover);
    if (action) this.applyPreview(overlays, action);
  }

  private applyPreview(overlays: Overlays, action: Action): void {
    const preview = this.rules.previewAction(action);
    if (!preview.legal) return;

    overlays.predicted = preview.tileEffects.map((e) => ({
      at: e.at,
      ...(e.damage !== undefined ? { damage: e.damage } : {}),
      kind: e.kind,
    }));

    // Trajectory ghosting: every unit the cast would move, and every wall it would put
    // one into. `previewAction` simulates on a clone and reads the resulting events, so
    // this is not an estimate — it is what will happen, shown early.
    overlays.ghosts = preview.displacements
      .filter((d) => d.path.length > 1)
      .map((d) => ({
        unitId: d.unitId,
        path: d.path,
        ...(d.collision ? { crashAt: d.collision.at } : {}),
      }));

    for (const d of preview.displacements) {
      if (!d.collision) continue;
      overlays.predicted.push({
        at: d.collision.at,
        damage: d.collision.damage,
        kind: 'hit',
      });
      // Whoever was standing where the shove lands takes the collateral, and they are
      // usually the reason a player wanted to know in the first place.
      if (d.collision.collateral) {
        overlays.predicted.push({
          at: d.collision.at,
          damage: d.collision.collateral.damage,
          kind: 'hit',
        });
      }
    }
  }

  // ------------------------------------------------------------------ helpers

  /** Maps a clicked tile to the concrete action for the selected card, if legal. */
  private actionForTile(card: CardInstanceId, spec: TargetSpec, tile: Coord): Action | null {
    switch (spec.kind) {
      case 'tiles': {
        const at = spec.tiles.find((c) => coordEq(c, tile));
        return at ? { type: 'playCard', card, target: { kind: 'tile', at } } : null;
      }

      case 'entities': {
        const ref = spec.refs.find((r) => r.kind !== 'portrait' && this.refOccupies(r, tile));
        return ref ? { type: 'playCard', card, target: { kind: 'entity', ref } } : null;
      }

      case 'lines': {
        // Prefer the line whose origin is the clicked tile and which covers the most.
        const candidates = spec.origins.filter((o) => coordEq(o.from, tile));
        const best = candidates.sort((a, b) => b.covers.length - a.covers.length)[0];
        return best
          ? { type: 'playCard', card, target: { kind: 'line', from: best.from, dir: best.dir } }
          : null;
      }

      case 'global':
        return { type: 'playCard', card, target: { kind: 'global' } };

      default:
        return null;
    }
  }

  private refCells(ref: TargetRef): Coord[] {
    if (ref.kind === 'portrait') return [];
    const board = this.rules.getBoard();
    const unit = board.units.find((u) => u.id === ref.id);
    if (unit) return cellsAt(unit.anchor, unit.footprint);
    const obstacle = board.obstacles.find((o) => o.id === ref.id);
    return obstacle ? [obstacle.anchor] : [];
  }

  private refOccupies(ref: TargetRef, tile: Coord): boolean {
    return this.refCells(ref).some((c) => coordEq(c, tile));
  }

  private unitAt(tile: Coord) {
    const board = this.rules.getBoard();
    return board.units.find((u) =>
      cellsAt(u.anchor, u.footprint).some((c) => coordEq(c, tile)),
    );
  }
}

function dedupe(coords: Coord[]): Coord[] {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const c of coords) {
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
