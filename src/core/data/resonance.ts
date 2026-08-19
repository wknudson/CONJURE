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
import { creditRefund } from '../engine/reactions.js';
import { healCommander } from '../engine/damage.js';
import { lowestHpEnemy, opposite, unitsOf } from '../engine/board.js';
import { cellsOf } from '../util/grid.js';

export interface ResonanceDef {
  school: School;
  name: string;
  text: string;
  apply(ctx: Ctx, side: Side, column: number): void;
}

/** What Verdant Growth returns. Small on purpose — see the passive. */
export const VERDANT_GROWTH_HEAL = 2;

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

  surge: {
    school: 'surge',
    name: 'Storm Tithe',
    text: 'Your first Companion card each turn pays a Pip back.',
    apply(ctx, side) {
      // Paid through the reaction refund rather than through `gainPips`, so it reads on
      // screen as a reward for doing the thing rather than as turn income — and so the
      // amount is the one number the game already means by "a Pip back".
      //
      // Anchored at the Companion's own body, which is where the player is looking when
      // a Companion card resolves. A side with no body on the board falls back to the
      // lane it watches from its own back row, so the label never lands off-grid.
      const cmd = ctx.state.players[side];
      const bodyId = cmd.companionUnitId;
      const body = bodyId ? ctx.state.units[bodyId] : undefined;
      const at = body
        ? { ...body.anchor }
        : {
            x: Math.min(Math.max(cmd.companionColumn, 0), ctx.state.width - 1),
            y: side === 'player' ? ctx.state.height - 1 : 0,
          };

      creditRefund(ctx, side, { id: 'storm_tithe', name: 'Storm Tithe' }, at);
    },
  },

  bloom: {
    school: 'bloom',
    name: 'Verdant Growth',
    text: 'Your first Companion card each turn returns 2 HP to the Pact.',
    apply(ctx, side) {
      // The only sustain in the game, and deliberately small: two a turn will not outpace
      // anything committed to killing you, but it does mean a long fight is not simply a
      // ledger of everything you have already lost.
      healCommander(ctx, side, VERDANT_GROWTH_HEAL);
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
