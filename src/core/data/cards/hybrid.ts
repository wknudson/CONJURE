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
    text: 'Deals 20 impact damage, then sets the target alight for 2 Burn. A Frozen target Shatters first and loses all Armor. A Chilled one Vaporizes when the fire next bites, on its own turn.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'target' } },
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
    text: 'Chill the target, then boil it: 10 frost damage, then 30 fire damage. The steam blinds what is left.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'target' } },
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'target' } },
        { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } },
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
    text: 'Charge the target, then set it alight: 20 shock damage, then 20 fire damage, and the arc jumps.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },

  // ---------------------------------------------------------- the second pressing

  /**
   * **Pyre + Frost.** Cryo-Combustion's opposite number, and the difference is the order.
   *
   * Cryo-Combustion chills and then burns, which is a Vaporize you set off yourself. This
   * one is aimed at something *already* held: the leading Chill is what guarantees the
   * fire finds cold to boil, exactly as the note on Cryo-Combustion explains, and the
   * conditional tail is the reward for having actually frozen it solid first.
   */
  thermal_eruption: {
    id: 'thermal_eruption',
    name: 'Thermal Eruption',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Chills the target, then deals 30 fire damage — which flash-boils it, fogging the tile. A Frozen target is also set alight (Burn 2).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'target' } },
        { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } },
        {
          op: 'ifMet',
          cond: { kind: 'targetStatus', status: 'freeze' },
          then: { op: 'applyStatus', status: 'burn', stacks: 2, area: { shape: 'target' } },
        },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Pyre + Surge.** A card that eats its own setup.
   *
   * The first `clearStatus` in the game, and the reason the op exists: the two stacks of
   * Burn are genuinely spent, so a Wasp cannot light a body once and cash the same fire
   * twice. Without a target already alight it is a bad three-Pip bolt, which is the
   * correct price for casting a payoff card into an empty board.
   *
   * Plasma Burst does not exist as a reaction and Arc is weather-gated. What is here is
   * their shape as ordinary damage: the blast, and the jump to everything touching it.
   */
  plasma_arc: {
    id: 'plasma_arc',
    name: 'Plasma Arc',
    cost: { pips: 3, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Consumes 2 Burn on the target for 50 shock damage, earthing 30 more into everything adjacent. Without the fire, only 20.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'burn', stacks: 2 },
      then: {
        op: 'seq',
        effects: [
          { op: 'clearStatus', status: 'burn', area: { shape: 'target' } },
          { op: 'damage', amount: 50, dtype: 'shock', area: { shape: 'target' } },
          { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'adjacent8' } },
        ],
      },
      otherwise: { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Pyre + Bulwark.** The shove that leaves a road behind it.
   *
   * Order is load-bearing and visible in the effect list: the push runs first and writes
   * the route it dragged the body along, then the hazard op paves it. Written the other
   * way round the card scorches an empty tile, which is why `shovePath` reports nothing
   * until something has actually been shoved.
   *
   * Burning ground does **not** check whose fire it is. Shoving somebody down a corridor
   * and then walking your own line into it is an ordinary mistake, and the card is more
   * interesting for the fact that it can be made.
   */
  magma_shove: {
    id: 'magma_shove',
    name: 'Magma Shove',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves the target 2 tiles and leaves every tile it crossed burning for 2 turns. Anything starting a turn on burning ground catches fire.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'push', distance: 2 },
        { op: 'spawnHazard', kind: 'burning', turns: 2, area: { shape: 'shovePath' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Pyre + Bloom.** Wildfire, bought rather than waited for.
   *
   * Nothing in the effect list says "Wildfire" and it fires anyway: a fire hit on a
   * poisoned body is what the reaction matches, and it consumes *every* stack for 20 fire
   * damage each to everything adjacent. The card lays its own two stacks across the block
   * first, so it is self-contained -- and it scales, because the stacks a Bloom deck had
   * already laid are consumed along with them.
   *
   * That is the whole design of paying three Pips for it: cast into a clean board it is
   * mediocre, and cast into a Noxious Cloud it is the biggest number in the school.
   */
  scorched_earth: {
    id: 'scorched_earth',
    name: 'Scorched Earth',
    cost: { pips: 3, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons the 3x3 around the target (Toxin 1), then sets it alight for 30 fire damage — igniting every Toxin stack it carries for 20 more each to everything adjacent.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'square', size: 3 } },
        { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Frost + Bulwark.** One Pip, and the whole card is the reaction.
   *
   * The effect list is a single physical blow, which is all Shatter has ever needed: a
   * physical hit on a Frozen body strips every point of its armour and throws 40 shrapnel
   * into everything beside it. The card is priced for the blow and sold for the reaction,
   * which is the most honest hybrid in the book -- it does nothing clever at all unless
   * the Frost half of your deck has already done its work.
   *
   * Melee, deliberately. A one-Pip armour strip you could throw across the board would be
   * the answer to every plated body in the game; walking into contact is the cost.
   */
  icebreaker: {
    id: 'icebreaker',
    name: 'Icebreaker',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'A 30 damage blow to an adjacent enemy. Against a Frozen one this Shatters: all of its Armor is stripped and everything beside it takes 40.',
    target: { kind: 'adjacentEnemy' },
    effect: { op: 'damage', amount: 30, dtype: 'physical', area: { shape: 'target' } },
    keywords: [],
    range: 1,
    spliceOnly: true,
  },

  /**
   * **Surge + Dusk.** Free, and unplayable until it is not.
   *
   * Zero Pips is only zero because the card cannot be cast at all without a Charged body
   * of your own standing on the board -- `requiresStatus` means there is literally nothing
   * else to click. Arcing Step charges one for a Pip; so does any Surge hit that lands on
   * your own line.
   *
   * Volatile Spark does not exist as a reaction. What it pays out does: three Pips,
   * clamped at the ceiling on the way in so the card never advertises more than the bank
   * can hold.
   */
  aetheric_overload: {
    id: 'aetheric_overload',
    name: 'Aetheric Overload',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Spends a Charged allied unit whole. You are paid 3 Pips.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requiresStatus: 'charged' },
    effect: {
      op: 'seq',
      effects: [{ op: 'consumeTarget' }, { op: 'gainPips', amount: 3 }],
    },
    keywords: [],
    range: 4,
    spliceOnly: true,
  },
};
