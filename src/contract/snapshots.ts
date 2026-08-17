/**
 * Render-ready snapshots embedded in events.
 *
 * The renderer must NEVER read live core state during an animation: the core resolves
 * instantly, so its state is already *ahead* of what is on screen. Events therefore
 * carry everything needed to draw them.
 */

import type {
  CardDefId,
  CardInstanceId,
  Coord,
  Keyword,
  RuneDefId,
  School,
  Side,
  UnitId,
} from './ids.js';

export interface UnitSnapshot {
  id: UnitId;
  defId: CardDefId;
  name: string;
  side: Side;
  anchor: Coord;
  /** 1 => 1x1, 2 => 2x2 Behemoth. */
  footprint: 1 | 2;
  hp: number;
  maxHp: number;
  armor: number;
  atk: number;
  mov: number;
  rangeMin: number;
  rangeMax: number;
  school: School;
  keywords: Keyword[];
  archetype: UnitArchetype;
  /** Times this unit has grown by surviving a round. Otherwise invisible to the player. */
  escalation: number;
  /** Already moved or attacked this turn, so it cannot act again. */
  exhausted: boolean;
}

/** Drives which placeholder shape the renderer draws. */
export type UnitArchetype = 'bruiser' | 'skirmisher' | 'caster' | 'sniper' | 'behemoth' | 'obstacle';

export interface ObstacleSnapshot {
  id: UnitId;
  defId: CardDefId;
  name: string;
  anchor: Coord;
  hp: number;
  maxHp: number;
  /** Low terrain: blocks sight only, so units may stand on it. Drawn short. */
  cover?: boolean;
}

export interface RuneSnapshot {
  defId: RuneDefId;
  name: string;
  school: School;
  ownerSide: Side;
}

export interface CardSnapshot {
  instanceId: CardInstanceId;
  defId: CardDefId;
  name: string;
  cost: number;
  school: School;
  source: 'hero' | 'companion';
  kind: 'minion' | 'spell' | 'rune' | 'obstacle';
  text: string;
  keywords: Keyword[];
  /** Present for minion/behemoth cards, for the stat footer. */
  stats?: { atk: number; hp: number; mov: number };
  /** How far from the Companion this may be cast. Absent on Hero cards, which reach all. */
  range?: number;
  /** Rite of Binding overlay: sits outside the hand limit and cannot be discarded. */
  ephemeral?: boolean;
}
