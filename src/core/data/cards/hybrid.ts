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

  // ------------------------------------------------------------- the third pressing
  //
  // Eight rows that close the book: every one of the fifteen elemental pairings now has a
  // fusion. Three of these needed a Core the bench had never bottled -- Dusk, Bloom and
  // Bulwark -- because a pressing is base card plus Core and the three pairings among those
  // schools contained none of the original three. The reagent table is symmetric now: six
  // schools, six Cores.
  //
  // Four species were rolling a 35% hybrid chance against an empty pool before this: the
  // Storm-Mantis, the Grave-Gargoyle, the Kinetic Dynamo and the Bone Bastion Sovereign.
  // Each of them has something to draw now.

  /**
   * **Pyre + Dusk.** The fire on a body, spent as a detonation.
   *
   * Dusk's verb is spending something you already have; Pyre's is fire. This spends the
   * *Burn* — `clearStatus` strips every stack before the damage lands, so the card cannot
   * be cast twice on the same fire, and the fifty is paid for by giving up the ten a turn
   * the Burn would have ticked for anyway.
   *
   * `requiresStatus` makes it unplayable until something is alight, which is what lets it
   * cost what it costs. A Stoke or an Ashen Wake is the turn before this one.
   *
   * Soulfire is not a reaction and was never built as one. This is its shape as ordinary
   * damage: the body, and the fire coming off it.
   */
  soulfire: {
    id: 'soulfire',
    name: 'Soulfire',
    cost: { pips: 2, marrow: 1 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Can only be aimed at a Burning unit. Consumes the fire on it for 50 fire damage, and 20 to everything adjacent.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false, requiresStatus: 'burn' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'clearStatus', status: 'burn', area: { shape: 'target' } },
        { op: 'damage', amount: 50, dtype: 'fire', area: { shape: 'target' } },
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Frost + Surge.** The one fusion whose reaction already ships.
   *
   * Superconduct has been in the reaction table since Surge landed: frost through a Charged
   * target strips all its armour and leaves it Brittle. Nothing needed writing here except
   * a card that reliably *causes* it — frost damage, aimed by a bloodline that speaks both
   * schools, at the status its own other half applies.
   *
   * So this is deliberately plain. The two stacks of Chill are the frost half being paid
   * for; the Superconduct is the engine's, and it fires off the damage above without this
   * card mentioning it.
   */
  superconductor: {
    id: 'superconductor',
    name: 'Superconductor',
    cost: { pips: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 frost damage and applies Chill 2. Against a Charged target this Superconducts: all Armor stripped, and it is left Brittle.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 2, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Frost + Dusk.** Through the ice, and through the plate.
   *
   * Two Pips for forty through any armour is above rate, and the gate is why: it cannot be
   * cast at all except at something already Frozen, which is two Frost cards or a Rime Lock
   * of setup. `true` damage because a frozen body has had every chance to be plated and the
   * whole point of a Dusk fusion is that plate is not an answer.
   *
   * The spread Chill is what makes it a board card rather than a finisher. Everything
   * standing around the corpse is two stacks closer to being the next target.
   */
  black_ice: {
    id: 'black_ice',
    name: 'Black Ice',
    cost: { pips: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Can only be aimed at a Frozen unit. Deals 40 damage through any armor, and everything adjacent takes Chill 2.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false, requiresStatus: 'freeze' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 40, dtype: 'true', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 2, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Frost + Bloom.** The rot sets where the cold holds it.
   *
   * Both schools are patient and both are answered the same way — by walking out of the
   * area. This is the card that refuses that: Entangle stops the body moving and the Toxin
   * ticks through its armour while it stands there, which is Bloom's damage finally
   * guaranteed to land.
   *
   * Chill is the gate rather than an effect, because a Permafrost that also chilled would
   * be doing the setup and the payoff at once. Creeping Rime is the turn before.
   */
  permafrost: {
    id: 'permafrost',
    name: 'Permafrost',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Can only be aimed at a Chilled unit. Deals 20 frost damage, roots it in place, and applies 2 Toxin that ticks through Armor.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false, requiresStatus: 'chill' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Surge + Bulwark.** The shove that discharges when it lands.
   *
   * Bulwark supplies the collision and Surge supplies what the collision releases. The
   * `ifMet collided` is the same pattern the Avalanche Slam established — `push` writes
   * `play.collided`, the condition reads it — so the blast is *earned* by aiming at a wall
   * rather than granted for casting.
   *
   * Everything caught is left Charged, which is the Surge half paying forward: a Kinetic
   * Arc into a corner is three bodies armed for a Discharge next turn.
   *
   * **No `applyStatus` for that charge, deliberately.** `dealDamage` already leaves one
   * Charged on anything a `shock` hit survives, so a rider here would be the card paying
   * for what the engine gives free — and it would land *two* stacks, which reads on the
   * board as a card doing something it never claimed. This is the same trap Static Arc
   * sidesteps from the other direction: that card wants the charge and so deals `spell`
   * rather than `shock`, because `shock` would have applied it twice over.
   */
  kinetic_arc: {
    id: 'kinetic_arc',
    name: 'Kinetic Arc',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves the target 2 tiles. If it slams into something, the impact discharges for 30 shock damage all around it — and shock leaves everything it touches Charged.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'push', distance: 2 },
        {
          op: 'ifMet',
          cond: { kind: 'collided' },
          then: { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'adjacent8' } },
        },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Bulwark + Dusk.** The wound worn as plate.
   *
   * The first fusion pressed with a Bulwark Core, and the reason that Core had to exist:
   * Bulwark, Dusk and Bloom are the three schools that were never bottled, and the three
   * pairings among them could not be pressed at all.
   *
   * `grantArmor` with `{ from: 'titheDamage' }` reads the wound the tithe just made and
   * plates the **Pact** with it — that dynamic form always pays the portrait, which is what
   * makes this a Bone Bastion rather than a buff on one body. Thirty health off a minion
   * becomes thirty armour on the thing you actually have to protect, and the Marrow is paid
   * on top.
   *
   * One Pip, because the tithe is the cost. A body has to be standing there un-exhausted.
   */
  bone_bastion: {
    id: 'bone_bastion',
    name: 'Bone Bastion',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Bleed an un-exhausted friendly minion for 30: extracts 1 Marrow and plates your Pact with Persistent Armor equal to the health taken.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'tithe', damage: 30, marrow: 1 },
        { op: 'grantArmor', amount: { from: 'titheDamage' } },
      ],
    },
    keywords: [],
    range: 4,
    spliceOnly: true,
  },

  /**
   * **Bulwark + Bloom.** A wall that is also a snare.
   *
   * Bulwark raises constructs and Bloom roots things; this does both at the same tile, which
   * is the only way either half is worth two Pips. The thicket goes up and everything
   * orthogonally beside it is caught in the same motion — so the enemy is held in place
   * *next to* the thing that poisons its row every turn.
   *
   * The Rampart it raises is a real Bloom card in its own right (`briar_rampart`), not a
   * setup-only stat block. A pressing whose product nothing else in the game could ever
   * deal would be a card nobody could learn to read.
   */
  iron_briar: {
    id: 'iron_briar',
    name: 'Iron Briar',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Raises a 50 HP Briar Rampart on an empty tile and roots everything orthogonally beside it, poisoning them (Toxin 1).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnObstacle', obstacleDef: 'briar_rampart' },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Dusk + Bloom.** The rot, drunk.
   *
   * The last pairing in the book, and the one both halves were already built for: Bloom
   * spends turns stacking Toxin and Dusk spends bodies turning damage into health. This
   * turns the stacks themselves into health — fifty through any armour, and thirty of it
   * back to your Pact.
   *
   * `ifMet` rather than `requiresStatus`, so it is always castable and merely weak when the
   * setup is not there. That is the right shape for the *last* card a Bloom deck draws: a
   * fusion you cannot play at all on a board that went badly is a dead card in the hand you
   * least want one.
   */
  blight_siphon: {
    id: 'blight_siphon',
    name: 'Blight Siphon',
    cost: { pips: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Against a target carrying 2 or more Toxin, deals 50 damage through any armor and returns 30 health to your Pact. Otherwise only 20.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'toxin', stacks: 2 },
      then: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 50, dtype: 'true', area: { shape: 'target' } },
          { op: 'heal', amount: 30 },
        ],
      },
      otherwise: { op: 'damage', amount: 20, dtype: 'true', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  // ------------------------------------------------------------- the fourth pressing
  //
  // Five rows, one for each pairing that just gained a bloodline of its own. Every one of
  // those pairings already had exactly one fusion — enough to say the recipe book was
  // complete, not enough to make a hybrid beast's book *feel* like two schools. A Murk Heron
  // draws roughly a third of its Grimoire from fusions, and until now every one of them was
  // the same card.
  //
  // Chosen as the second half of each pair's argument rather than as a bigger version of the
  // first: where Soulfire is Dusk taking fire's leavings, the Funeral Pyre is fire taking the
  // corpse. Same two schools, opposite direction.

  /**
   * **Pyre + Dusk.** The corpse as fuel.
   *
   * Soulfire, the pairing's first fusion, is a siphon that burns. This is the reverse
   * argument: fire that pays for what it has already killed. It deals its damage down a line
   * like the Ashen Wake it is pressed from, and then puts health back on the Pact for the
   * burning it found — so a board the Pyre deck has spent three turns lighting is also a
   * board the Dusk half can drink.
   *
   * The heal is conditional on Burn *being there*, not on the damage landing, which is the
   * whole seam: the fire has to have been set earlier. A Funeral Pyre cast into a cold board
   * is a mediocre three-Pip line, and that is the price of holding it.
   */
  funeral_pyre: {
    id: 'funeral_pyre',
    name: 'Funeral Pyre',
    cost: { pips: 3, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 fire damage in a 3-tile line. If anything on the line was already Burning, your Pact takes 30 health back.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 40, dtype: 'fire', area: { shape: 'line', length: 3 } },
        {
          op: 'ifMet',
          cond: { kind: 'targetStatus', status: 'burn', area: { shape: 'line', length: 3 } },
          then: { op: 'heal', amount: 30 },
        },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Frost + Bloom.** Winter arriving early, on everything at once.
   *
   * Permafrost freezes ground. This freezes a *crop*: a 2x2 block takes frost damage, and
   * everything already poisoned in it is Frozen outright rather than merely Chilled — the
   * rot goes rigid. It is the Winterthorn Elk's card in one line, which is why the Elk drafts
   * fusions at a third of its book and this is one of two it can reach.
   *
   * Freeze from a spell, with no Chill ladder to climb, is the strongest thing in the
   * pairing, and Toxin is a fair toll: the Bloom half has to have done its slow work first.
   */
  killing_frost: {
    id: 'killing_frost',
    name: 'Killing Frost',
    cost: { pips: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 frost damage in a 2x2 block. Anything poisoned there freezes solid.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'frost', area: { shape: 'square', size: 2 } },
        {
          op: 'ifMet',
          cond: { kind: 'targetStatus', status: 'toxin', area: { shape: 'square', size: 2 } },
          then: {
            op: 'applyStatus',
            status: 'freeze',
            stacks: 1,
            area: { shape: 'square', size: 2 },
          },
        },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Surge + Bloom.** A snare with a current in it.
   *
   * Galvanic Spores is the pairing's cloud. This is its trap: the roots hold a body still and
   * the charge sits in them waiting, so the thing cannot walk out of the shock that is coming.
   * Entangle and Charged on the same target is a genuinely nasty pair — one of them stops the
   * answer to the other.
   *
   * Two Pips and almost no damage, because it is entirely a setup card. The Voltbriar Serpent
   * is the beast that wants it, and the Serpent's whole plan is that nothing gets to leave.
   */
  livewire_snare: {
    id: 'livewire_snare',
    name: 'Livewire Snare',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Roots the target in place (Entangle 1), leaves it Charged, and deals 20 shock damage.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Dusk + Bloom.** The rot spreading off the body it finished.
   *
   * Blight Siphon drinks a poisoned body. Rot Bloom uses one as a seed: decay damage on the
   * target, and Toxin on everything around it, so the poison that killed one thing starts
   * killing its neighbours. The Murk Heron's book is half made of this idea.
   *
   * `adjacentCross` rather than `adjacent8` and 2 Pips rather than 3, because the pairing
   * already has a heavy finisher and what it lacked was a cheap card that makes the *next*
   * one better. Cast it into a line and the whole line is rotting for the Blight Harvest.
   */
  rot_bloom: {
    id: 'rot_bloom',
    name: 'Rot Bloom',
    cost: { pips: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 decay damage to the target and poisons everything orthogonally beside it (Toxin 2).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * **Bulwark + Bloom.** A wall that grew there.
   *
   * Iron Briar plates a body in thorns. This raises the thorns as a *structure* — a 70 HP
   * construct, which is sturdier than anything Bloom can raise alone and thornier than
   * anything Bulwark can, and it poisons whatever is standing next to it at the start of each
   * enemy turn.
   *
   * The Dolmen Crab's card, and the reason a Hedgefort is worth catching: Bulwark's walls
   * hold ground and this one *taxes* it. Three Pips for a construct with upkeep attached is
   * the going rate — the Pyre Pillar set it.
   */
  bramble_dolmen: {
    id: 'bramble_dolmen',
    name: 'Bramble Dolmen',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 70 HP thorn-grown stone on an empty tile. At the start of each enemy turn, everything beside it is poisoned (Toxin 1).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'bramble_dolmen' },
    keywords: [],
    obstacleHp: 70,
    obstacleTurnStart: { status: 'toxin', stacks: 1 },
    leavesRubble: true,
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },
};
