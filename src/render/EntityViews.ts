/**
 * Per-entity view state.
 *
 * This is what the screen believes, which lags the logic state during animation. Only
 * sequencer handlers mutate it.
 */

import type { Coord, UnitId } from '../contract/ids.js';
import type { ObstacleSnapshot, UnitSnapshot } from '../contract/snapshots.js';

export interface EntityView {
  id: UnitId;
  snapshot: UnitSnapshot | null;
  obstacle: ObstacleSnapshot | null;
  /** Interpolated board position, in fractional tile coordinates. */
  pos: Coord;
  /** Extra screen-y lift: hover, spawn drop-in, attack lunge. */
  elev: number;
  /** 0..1 squash applied on impact. */
  squash: number;
  alpha: number;
  hp: number;
  maxHp: number;
  armor: number;
  atk: number;
  rune: { school: string } | null;
  statuses: { kind: string; stacks: number }[];
  escalation: number;
  /** Already acted this turn — drawn dimmed so it reads as unavailable. */
  spent: boolean;
  dead: boolean;
}

export class EntityViewMap {
  private views = new Map<UnitId, EntityView>();

  get(id: UnitId): EntityView | undefined {
    return this.views.get(id);
  }

  all(): EntityView[] {
    return [...this.views.values()].filter((v) => !v.dead);
  }

  addUnit(s: UnitSnapshot): EntityView {
    const view: EntityView = {
      id: s.id,
      snapshot: s,
      obstacle: null,
      pos: { ...s.anchor },
      elev: 0,
      squash: 0,
      alpha: 1,
      hp: s.hp,
      maxHp: s.maxHp,
      armor: s.armor,
      atk: s.atk,
      rune: null,
      statuses: [],
      escalation: 0,
      spent: false,
      dead: false,
    };
    this.views.set(s.id, view);
    return view;
  }

  addObstacle(o: ObstacleSnapshot): EntityView {
    const view: EntityView = {
      id: o.id,
      snapshot: null,
      obstacle: o,
      pos: { ...o.anchor },
      elev: 0,
      squash: 0,
      alpha: 1,
      hp: o.hp,
      maxHp: o.maxHp,
      armor: 0,
      atk: 0,
      rune: null,
      statuses: [],
      escalation: 0,
      spent: false,
      dead: false,
    };
    this.views.set(o.id, view);
    return view;
  }

  remove(id: UnitId): void {
    this.views.delete(id);
  }

  clear(): void {
    this.views.clear();
  }

  /** Rebuilds from a board snapshot — used on load and after a skip. */
  syncFrom(units: UnitSnapshot[], obstacles: ObstacleSnapshot[]): void {
    const seen = new Set<UnitId>();

    for (const u of units) {
      seen.add(u.id);
      const existing = this.views.get(u.id);
      if (existing) {
        existing.snapshot = u;
        existing.pos = { ...u.anchor };
        existing.hp = u.hp;
        existing.maxHp = u.maxHp;
        existing.armor = u.armor;
        existing.atk = u.atk;
        existing.escalation = u.escalation;
        // Only your own spent units dim: enemy availability is not yours to read.
        existing.spent = u.side === 'player' && u.exhausted;
      } else {
        const added = this.addUnit(u);
        added.escalation = u.escalation;
        added.spent = u.side === 'player' && u.exhausted;
      }
    }

    for (const o of obstacles) {
      seen.add(o.id);
      const existing = this.views.get(o.id);
      if (existing) {
        existing.obstacle = o;
        existing.hp = o.hp;
      } else {
        this.addObstacle(o);
      }
    }

    for (const id of [...this.views.keys()]) {
      if (!seen.has(id)) this.views.delete(id);
    }
  }
}

export function lerpCoord(a: Coord, b: Coord, k: number): Coord {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
