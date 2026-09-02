/**
 * Render-ready snapshots embedded in events.
 *
 * The renderer must NEVER read live core state during an animation: the core resolves
 * instantly, so its state is already *ahead* of what is on screen. Events therefore
 * carry everything needed to draw them.
 */

import type { CardCost } from '../core/types/cards.js';
import type {
  CardDefId,
  CardInstanceId,
  Coord,
  Keyword,
  MarkDefId,
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
  /** 'lineOnly' fires down straight lines; 'arcing' ignores line of sight entirely. */
  attackProfile?: 'lineOnly' | 'arcing';
  school: School;
  keywords: Keyword[];
  archetype: UnitArchetype;
  /** Times this unit has grown by surviving a round. Otherwise invisible to the player. */
  escalation: number;
  /**
   * How this body grows, for anything carrying `Growth`: the Attack it gains per stack
   * and the stack it stops at.
   *
   * Travels with the view for the same reason `territoryDepth` does — the HUD forecasts
   * what a declared blow will *actually* strike for, and that means knowing the step. It
   * used to guess one point for every grower, which was ten short of the bodies that grow
   * and one too many for the ones whose stat block grows by nothing.
   */
  growth?: { step: number; cap: number };
  /** The Elemental Aura riding this unit, if any, and how far it has grown. */
  aura?: { defId: string; stacks: number; climaxed: boolean };
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

export interface MarkSnapshot {
  defId: MarkDefId;
  name: string;
  school: School;
  ownerSide: Side;
}

export interface CardSnapshot {
  instanceId: CardInstanceId;
  defId: CardDefId;
  name: string;
  cost: CardCost;
  school: School;
  source: 'hero' | 'companion';
  kind: 'minion' | 'spell' | 'ability' | 'mark' | 'obstacle';
  text: string;
  keywords: Keyword[];
  /** Present for minion/behemoth cards, for the stat footer. */
  stats?: { atk: number; hp: number; mov: number };
  /** How far from the Companion this may be cast. Absent on Hero cards, which reach all. */
  range?: number;
  /** Ephemeral overlay: sits outside the hand limit and cannot be discarded. */
  ephemeral?: boolean;
  /**
   * A variable price, and the most the player may declare.
   *
   * Carried on the face because the whole cost is a decision here: without it the card
   * reads as free, which is the one thing X is not.
   */
  xCost?: { max: number };
}
