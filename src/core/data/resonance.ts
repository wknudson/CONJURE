/**
 * Companion Resonance (Module 1 §3).
 *
 * A Companion is more than a card-pool label: playing a Companion card each turn fires
 * its school passive. Because the Companion now stands at a fixed column beside the
 * board, the column-based passives give that position real tactical weight — the lane
 * your Companion watches is genuinely more dangerous to stand in.
 *
 * Fires once per turn, on the first Companion card played, so it stays predictable and
 * cannot spiral when a turn dumps several cards.
 */

import type { School, Side } from '../../contract/ids.js';
import type { Ctx } from '../engine/context.js';
import { emit } from '../engine/context.js';
import { dealDamage, grantArmor } from '../engine/damage.js';
import { lowestHpEnemy, opposite, unitsOf } from '../engine/board.js';
import { cellsOf } from '../util/grid.js';

export interface ResonanceDef {
  school: School;
  name: string;
  text: string;
  apply(ctx: Ctx, side: Side, column: number): void;
}

export const RESONANCE: Partial<Record<School, ResonanceDef>> = {
  pyre: {
    school: 'pyre',
    name: 'Ember Watch',
    text: "Your first Companion card each turn Ignites every enemy in the Companion's column.",
    apply(ctx, side, column) {
      for (const foe of unitsOf(ctx.state, opposite(side))) {
        if (!cellsOf(foe).some((c) => c.x === column)) continue;
        foe.statuses.burn = (foe.statuses.burn ?? 0) + 1;
        emit(ctx, {
          t: 'statusApplied',
          unitId: foe.id,
          status: 'burn',
          stacks: foe.statuses.burn,
        });
      }
    },
  },

  frost: {
    school: 'frost',
    name: 'Rime Guard',
    text: 'Your first Companion card each turn grants your Hero +2 Persistent Armor.',
    apply(ctx, side) {
      grantArmor(ctx, { kind: 'portrait', side }, 2);
    },
  },

  dusk: {
    school: 'dusk',
    name: 'Grave Tithe',
    text: 'Your first Companion card each turn drains 2 HP from the lowest-HP enemy.',
    apply(ctx, side) {
      const victim = lowestHpEnemy(ctx.state, side);
      if (!victim) return;
      dealDamage(ctx, {
        target: { kind: 'unit', id: victim.id },
        amount: 2,
        dtype: 'spell',
        cause: 'spell',
      });
    },
  },
};

export function resonanceFor(school: School): ResonanceDef | undefined {
  return RESONANCE[school];
}
