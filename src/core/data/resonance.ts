/**
 * Companion Resonance. See `docs/03_rpg_sandbox.md`.
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
import { applyStatusTo } from '../engine/status.js';
import { dealDamage, grantArmor } from '../engine/damage.js';
import { creditRefund } from '../engine/reactions.js';
import { healCommander } from '../engine/damage.js';
import { lowestHpEnemy, opposite, unitsOf } from '../engine/board.js';
import { cellsOf } from '../util/grid.js';
import { drawCards } from '../engine/deck.js';

export interface ResonanceDef {
  school: School;
  name: string;
  text: string;
  apply(ctx: Ctx, side: Side, column: number): void;
}

/** What Verdant Growth returns. Small on purpose — see the passive. */
export const VERDANT_GROWTH_HEAL = 20;

/**
 * The ten hybrid bloodlines' own Resonances: designed, and **not built**.
 *
 * `data/companions.ts` ships ten two-school Companions and every one of them borrows a
 * parent's passive, because this table is keyed by `School` and each of them is two.
 * That is the smaller of the two obstacles. The real one is the trigger.
 *
 * Every passive here fires in one place — `engine.ts` asks `resonanceFor` on the first
 * Companion card of the turn, hands it a side and a column, and that is the whole
 * contract. All ten of the designed hybrid Resonances are instead **event-triggered**:
 *
 *  - Thermal Shock (Chimera)     — when a Steam Fog hazard is spawned, heal the Pact 20.
 *  - Plasma Conduit (Wasp)       — when a Plasma Burst triggers, generate 1 Echo.
 *  - Eruption (Tortoise)         — when a shove lands, leave a burning tile behind it.
 *  - Ash Fertilizer (Treant)     — when Wildfire goes off, Leech (1) to allies in the blast.
 *  - Flash Freeze (Mantis)       — when Superconduct chains, Chill (1) to the collateral.
 *  - Icebreaker (Juggernaut)     — when Shatter triggers, Fortify the nearest ally 30 Armor.
 *  - Winter's Grasp (Gargoyle)   — when a Soul Mark detonates, bank a Pip.
 *  - Momentum Transfer (Dynamo)  — when a Kinetic Arc triggers, Haste the lowest-HP ally.
 *  - Aether Siphon (Geist)       — when an Overloaded unit is tithed, draw 1 and make 1 Echo.
 *  - Marrow Shield (Sovereign)   — when a Devour triggers, Fortify the Pact 20 Armor.
 *
 * Three things stand between that list and this table, in order of size:
 *
 *  1. **Nothing subscribes to anything.** Firing "when a hazard spawns" needs a hook at
 *     `spawnHazard`, "when a shove lands" one at `pushUnit`, and so on. The shape that
 *     fits this codebase is the boon shape — a capability read at the chokepoint the
 *     moment already passes through — not a listener registry.
 *  2. **Four of them name resources or mechanics that do not exist**: Echo (twice),
 *     Leech, Haste, and Devour. Plasma Burst, Kinetic Arc, Black Ice and Soul Marks are
 *     likewise not reactions this engine has; the real table is in `data/reactions.ts`.
 *  3. **`RESONANCE` is keyed by school.** Ten more entries need a key that is not a
 *     `School` — a Companion-level override, most likely, resolved in `resonanceFor`
 *     before it falls back to the school.
 *
 * Recorded here rather than in a tracker because this is the file somebody will be
 * looking at when they go to build one.
 */
export const RESONANCE: Partial<Record<School, ResonanceDef>> = {
  pyre: {
    school: 'pyre',
    name: 'Ember Watch',
    text: "Your first Companion card each turn Ignites every enemy in the Companion's column.",
    apply(ctx, side, column) {
      for (const foe of unitsOf(ctx.state, opposite(side))) {
        if (!cellsOf(foe).some((c) => c.x === column)) continue;
        // Through the dispatcher like everything else. This wrote `foe.statuses.burn`
        // directly for as long as it has existed — the only status application in the
        // game that skipped `applyStatusTo`, and so the only one that would have missed
        // the chill threshold or the source attribution had it ever applied those.
        applyStatusTo(ctx, foe, 'burn', 1, side);
      }
    },
  },

  /**
   * The defensive mirror of Ember Watch, and deliberately the same shape.
   *
   * Pyre's lane is dangerous to *stand* in; Bulwark's is safe to hold. Both read the
   * Companion's column, so both make walking the body forward the decision it was always
   * meant to be — the difference is only ever which side of the line benefits.
   *
   * Persistent armour on the units rather than on the Hero, because Bulwark's whole
   * argument is that the line holds. Armouring the portrait would be Rime Guard with a
   * different name.
   */
  bulwark: {
    school: 'bulwark',
    name: 'Shield Oath',
    text: "Your first Companion card each turn grants +1 Persistent Armor to your units in the Companion's column.",
    apply(ctx, side, column) {
      for (const ally of unitsOf(ctx.state, side)) {
        if (!cellsOf(ally).some((c) => c.x === column)) continue;
        grantArmor(ctx, { kind: 'unit', id: ally.id }, 10);
      }
    },
  },

  /**
   * The first Resonance that touches the hand rather than the board.
   *
   * Routed through the ordinary draw, so the hand limit and the overdraw burn both still
   * apply: a full hand turns the passive into a Marrow and a burnt card. That is a real
   * cost rather than a punishment, and it is what makes `bonusHandLimit` — the Gambler's
   * Coin, the Ink Owl's own Hoarder knack — a build instead of a nicety.
   */
  arcane: {
    school: 'arcane',
    name: 'Marginalia',
    text: 'Your first Companion card each turn draws a card.',
    apply(ctx, side) {
      drawCards(ctx, side, 1);
    },
  },

  frost: {
    school: 'frost',
    name: 'Rime Guard',
    text: 'Your first Companion card each turn grants your Hero +2 Persistent Armor.',
    apply(ctx, side) {
      grantArmor(ctx, { kind: 'portrait', side }, 20);
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
        amount: 20,
        dtype: 'spell',
        cause: 'spell',
      });
    },
  },
};

export function resonanceFor(school: School): ResonanceDef | undefined {
  return RESONANCE[school];
}
