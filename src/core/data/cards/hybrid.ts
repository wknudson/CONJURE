/**
 * Hybrids: what comes off the splicing bench.
 *
 * Authored as ordinary cards rather than assembled at runtime, deliberately. A hybrid
 * built by merging two `CardDef`s on the fly would be a second, weaker card parser living
 * beside the real one — and the first time a splice produced an effect tree nothing else
 * in the game could read, it would fail in combat rather than at the bench.
 *
 * So the Forge does not *make* a card. It looks one up, and charges for the lookup. Every
 * hybrid here is a card the engine already knows how to resolve, which means a splice can
 * never produce something unplayable.
 *
 * Each one is named for the elemental reaction it forces: the reactions already exist in
 * `data/reactions.ts`, and a hybrid that applied a status with no reaction behind it would
 * be a promise the combat engine could not keep.
 */

import type { CardDef } from '../../types/cards.js';

export const HYBRID_CARDS: Record<string, CardDef> = {
  /**
   * Frost pressed with a Pyre core.
   *
   * The mirror of Vaporize Blast, and deliberately the other way round: that card is a
   * fire spell taught to freeze first, this one is a cold spell taught to burn after.
   *
   * The order is the card. `impact` lands first, so anything already Frozen **Shatters**
   * — losing all its armour — and the Burn that follows goes on a target that has just
   * had its plate taken off. Against anything unprepared it is two damage and a fire,
   * which is a fair price for a card that costs a Pyre core.
   *
   * What it does *not* do is Vaporize on the cast, and that is worth stating because it is
   * the obvious thing to assume. Reactions are evaluated inside `dealDamage`; applying a
   * status is not damage. The flame lands as a status and sets nothing off — but the burn
   * *tick* deals real `fire` damage, and it runs before Chill decays in the same
   * start-of-turn order, so a Chilled target Vaporizes on its own next turn instead.
   *
   * Aimed at a body rather than a tile: this is a finisher pointed at something already
   * set up, not a burst thrown into a crowd.
   */
  cryo_combustion: {
    id: 'cryo_combustion',
    name: 'Cryo-Combustion',
    cost: { pips: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 2 impact damage, then sets the target alight for 2 Burn. A Frozen target Shatters first and loses all Armor. A Chilled one Vaporizes when the fire next bites, on its own turn.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 2, dtype: 'impact', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 2, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * Bloom pressed with a Surge core.
   *
   * Spore Cloud already lays the fuse for Wildfire; this lays that fuse *and* the one
   * Overload and Superconduct read, on the same cross, in one card. It is the only thing
   * in the game that puts two different reagents' worth of setup on a tile at once.
   *
   * One Toxin rather than Spore Cloud's two: the card buys breadth, not depth, and a
   * hybrid that beat its own base card at the base card's job would make the base card
   * pointless.
   */
  galvanic_spores: {
    id: 'galvanic_spores',
    name: 'Galvanic Spores',
    cost: { pips: 2, marrow: 1 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Everything orthogonally beside the target tile is left Charged and takes 1 Toxin. Fire Overloads or ignites it; frost Superconducts.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * Dusk pressed with a Surge core.
   *
   * Dark Tithe spends a body for armour and Marrow. This spends one for a *different
   * body*, standing on the same ground and able to act at once — the tempo card the Dusk
   * school never had.
   *
   * Two engine seams meet here. `consumeTarget` remembers the tile it emptied, and
   * `summon` falls back to it, because a card aimed at an ally carries no tile of its own.
   * And the Haste is baked into the revenant's own stat block rather than granted at
   * summon time: nothing in the engine can add a keyword to a body mid-play, and inventing
   * that for one card would be a rule with a single caller.
   *
   * Deliberately no Marrow. Dark Tithe pays out; this one converts, and a card that did
   * both would simply be Dark Tithe plus a free minion.
   */
  aetheric_defibrillator: {
    id: 'aetheric_defibrillator',
    name: 'Aetheric Defibrillator',
    cost: { pips: 3, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Consume an un-exhausted friendly minion. A Galvanic Revenant stands up on the same tile, ready to move and strike this turn.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'consumeTarget' },
        { op: 'summon', unitDef: 'galvanic_revenant' },
      ],
    },
    keywords: [],
    range: 4,
    spliceOnly: true,
  },
  /**
   * Pyre pressed with a Frost core.
   *
   * Fire that arrives on something already frozen, in one card. It chills first and
   * burns second, so the Vaporize reaction fires off its own setup rather than needing a
   * second caster — which is the whole point of paying for a hybrid.
   *
   * The leading `applyStatus` is load-bearing and was missing for a sprint. **Frost
   * damage does not chill**: the engine has exactly one automatic status-from-damage
   * rule, shock leaving `charged` (`damage.ts:274`). Without the status node the fire
   * half found nothing to react with and the card only worked on a target somebody else
   * had already chilled — precisely the case this paragraph claims it removes.
   *
   * The frost damage is kept anyway. It is what makes the card read as one motion rather
   * than a status and an unrelated burn, and it is a second Vaporize trigger of its own
   * if the target was already chilled when it arrived.
   */
  vaporize_blast: {
    id: 'vaporize_blast',
    name: 'Vaporize Blast',
    cost: { pips: 2, marrow: 1 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Chill the target, then boil it: 1 frost damage, then 3 fire damage. The steam blinds what is left.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'target' } },
        { op: 'damage', amount: 1, dtype: 'frost', area: { shape: 'target' } },
        { op: 'damage', amount: 3, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * Pyre pressed with a Surge core.
   *
   * The charge lands first so the flame has something to argue with. Cheaper in Marrow
   * than the Frost hybrid and shorter-ranged: this one is meant to be thrown into a
   * crowd you are already standing near.
   *
   * **Named for the reaction it actually produces.** Shock into fire is fire-on-charged,
   * which is *Overload* — Superconduct wants a `frost` trigger (`data/reactions.ts:106`)
   * this card never deals, so under its old name it promised a reaction it could not
   * make. The effect is deliberately unchanged: shock-then-fire is the better card, the
   * text already described Overload's shove, and Superconduct keeps its own route
   * through Glacial Spike.
   */
  overload_strike: {
    id: 'overload_strike',
    name: 'Overload Strike',
    cost: { pips: 2, marrow: 1 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Charge the target, then set it alight: 2 shock damage, then 2 fire damage, and the arc jumps.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 2, dtype: 'shock', area: { shape: 'target' } },
        { op: 'damage', amount: 2, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },
};
