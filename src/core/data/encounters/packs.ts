/**
 * The roaming packs, as fights.
 *
 * Built from one spec apiece, the way the Wild Hunts are, and for the same reason: what
 * differs between two packs is which bodies are in them, and twelve hand-cut arenas would be
 * twelve chances to make one accidentally unwinnable.
 *
 * Every one of these is a **rout** (`victory: 'rout'`): there is no enemy Commander, no Bound
 * Form, no deck, and no portrait to aim at. Clear the bodies and it is over. See
 * `data/packs.ts` for what a pack is and `engine/death.ts` for how the rule reads.
 *
 * ## The reinforcement roll happens once, at setup
 *
 * Rolled in `script.setup` and stored in `firedGates`, not re-rolled per turn. A lazy roll
 * would draw from the shared RNG stream on every turn of every pack fight, so a replay of a
 * fight where reinforcements never came would consume a different number of draws than the
 * original and diverge — the same discipline `tameCompanion` keeps about the order of its
 * own rolls.
 */

import type { Ctx } from '../../engine/context.js';
import type { EncounterDef, EncounterScript } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { PACKS, type PackDef } from '../packs.js';
import { CARDS } from '../cards/index.js';
import { rosterPointsOf } from '../roster.js';
import { placeOpeningUnit } from '../../engine/spawn.js';
import { nextInt } from '../../util/rng.js';
import { emit, newCause } from '../../engine/context.js';

/** Round the reinforcements can first arrive. Late enough that the fight has a shape. */
const REINFORCE_FIRST = 3;
/** ...and the last. Rolled between the two, so you cannot learn one turn to dread. */
const REINFORCE_LAST = 6;

const ROLLED = 'reinforce:rolled';
const ARRIVED = 'reinforce:arrived';

/**
 * Where the pack stands at the opening bell.
 *
 * Spread along the enemy's own rows rather than clustered, so a five-body pack does not open
 * as one shape a single Cinder Gale erases. `placeOpeningUnit` walks to the nearest free tile
 * from each of these, so overlaps resolve rather than dropping a body.
 */
const OPENING: readonly [number, number][] = [
  [1, 1],
  [3, 0],
  [5, 1],
  [2, 0],
  [6, 0],
  [4, 1],
];

/**
 * Decides the reinforcement round once, and then honours it.
 *
 * The gate strings carry the decision so it survives into the save and out the other side of
 * a reload: `reinforce:rolled` means the coin has been flipped, and the round it landed on is
 * appended to it. Storing the round in the gate array rather than adding a field keeps this
 * to the encounter layer — nothing about `EncounterState` needs to know packs exist.
 */
function reinforceScript(pack: PackDef): EncounterScript {
  return {
    setup(ctx: Ctx) {
      const gates = ctx.state.encounter.firedGates;
      if (gates.some((g) => g.startsWith(ROLLED))) return;
      const coming = nextInt(ctx.state.rng, 100) < pack.reinforce.chance;
      const round = REINFORCE_FIRST + nextInt(ctx.state.rng, REINFORCE_LAST - REINFORCE_FIRST + 1);
      // Both draws happen whether or not the reinforcements are coming, so the stream is
      // consumed identically either way and a replay cannot diverge on the coin flip.
      gates.push(coming ? `${ROLLED}:${round}` : `${ROLLED}:never`);
    },

    onTurnStart(ctx: Ctx, side) {
      if (side !== 'enemy') return;
      const gates = ctx.state.encounter.firedGates;
      if (gates.includes(ARRIVED)) return;

      const rolled = gates.find((g) => g.startsWith(ROLLED));
      const when = rolled?.slice(ROLLED.length + 1);
      if (!when || when === 'never') return;
      if (ctx.state.turn < Number(when)) return;

      gates.push(ARRIVED);

      // Spend the budget down the priority list. Not Feral: these are part of the pack, so
      // the AI commands them and — the part that matters — they count toward the rout.
      let budget = pack.reinforce.points;
      let placed = 0;
      newCause(ctx);
      for (const defId of pack.reinforce.unitCardIds) {
        const def = CARDS[defId];
        if (!def) continue;
        const cost = rosterPointsOf(def);
        while (budget >= cost && placed < OPENING.length) {
          const [x, y] = OPENING[placed]!;
          const id = placeOpeningUnit(ctx, defId, 'enemy', { x, y });
          placed += 1;
          if (!id) break;
          budget -= cost;
        }
        if (budget <= 0) break;
      }

      if (placed > 0) {
        emit(ctx, { t: 'bossPhaseShift', side: 'enemy', phase: 2, name: 'More of them' });
      }
    },
  };
}

function packEncounter(pack: PackDef): EncounterDef {
  registerEncounterScript(pack.encounterId, reinforceScript(pack));

  return registerEncounter({
    id: pack.encounterId,
    name: pack.name,
    blurb: pack.blurb,
    // Small and open. A pack fight is short by design and a big arena would spend most of it
    // walking toward each other.
    width: 7,
    height: 6,
    playerHp: 400,
    // Never shown and never reachable: `victory: 'rout'` hides the bar and refuses the
    // portrait as a target. Authored at the ordinary figure anyway, because the field is
    // required and a zero would read as "already won" to anything that forgets why.
    enemyHp: 400,
    playerName: 'Hero',
    companionName: 'Companion',
    companionSchool: 'pyre',
    enemyName: pack.name,
    enemySchool: 'neutral',
    // Nothing casts. There is no Commander behind these to hold a hand.
    enemyDeck: [],
    enemyOpeningBoard: pack.members.map((defId, i) => {
      const [x, y] = OPENING[i % OPENING.length]!;
      return [defId, x, y] as [string, number, number];
    }),
    // No free footman: the pack is costed at exactly ten points and a gift body would make
    // every one of them twelve.
    vanguard: null,
    victory: 'rout',
  });
}

export const PACK_ENCOUNTERS: readonly EncounterDef[] = PACKS.map(packEncounter);
