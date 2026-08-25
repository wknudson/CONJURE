/**
 * The Bloom mini-set.
 *
 * Bloom is the patience school. It deals almost nothing on impact and a great deal over
 * the following turns: Toxin ticks through armor at the start of its victim's turn, so a
 * heavily plated target is exactly the wrong thing to bring against it.
 *
 * The set's other half of the Reaction matrix is what makes it more than a damage-over-
 * time deck. Toxin is the only status Wildfire reads, and Wildfire consumes **every**
 * stack for 2 fire damage each to everything adjacent — so a Spore Cloud stacked deep
 * and then lit is a bomb the Bloom deck cannot set off on its own. It is the school that
 * wants a Pyre ally, or an enemy careless enough to bring fire to it.
 *
 * Both cards here are deliberately quiet on the turn they are played. That is the school.
 */

import type { CardDef } from '../../types/cards.js';

export const BLOOM_CARDS: Record<string, CardDef> = {
  /**
   * The Toxin layer, and the Wildfire fuse.
   *
   * Aimed at a tile, like every other radiating card, so the cross falls around the point
   * rather than around a victim. Two stacks per cast is what makes stacking it worth the
   * turns: Wildfire pays 2 fire damage *per stack consumed*, so a tile hit twice is a
   * four-stack detonation waiting for somebody's torch.
   *
   * It deals no damage of its own on the way in. Nothing here triggers a reaction at the
   * moment of casting — a status is not a hit — which is precisely why this is setup and
   * not removal.
   */
  spore_cloud: {
    id: 'spore_cloud',
    name: 'Spore Cloud',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Applies 2 Toxin to everything orthogonally beside the target tile. Toxin ticks through Armor. Fire ignites it for 20 damage per stack to everything adjacent.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'adjacentCross' } },
    keywords: [],
    range: 3,
    needsLoS: true,
  },


  /**
   * The thing that cannot chase you.
   *
   * Zero movement, which is not a drawback dressed up as flavour — it is the entire price
   * of the card. A Briar threatens exactly the tile it was planted beside and nothing
   * else for the rest of the fight, so the decision is made once, when it goes down.
   *
   * An Aura is what makes that decision pay: it survives rounds precisely because
   * nothing has to walk past it, and by the cap it is a 4 ATK / 7 HP wall standing where
   * you chose to put it on turn one.
   */
  creeping_briar: {
    id: 'creeping_briar',
    name: 'Creeping Briar',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Cannot move, ever. Plant it where the fight is going to be.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'creeping_briar' },
    keywords: ['Growth'],
    unit: {
      atk: 10,
      hp: 40,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
    },
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * Four tiles of poison, and the first card to use a `square`.
   *
   * A 2x2 anchored at the chosen tile -- the same block a Behemoth stands on, and the same
   * zone the targeting overlay already paints when a footprint-2 card is held. That is
   * deliberate: the player has been reading that shape since deployment, so the cloud
   * lands where they expect it to.
   *
   * Two stacks matter more than the tiles do. Wildfire consumes every stack for 20 fire
   * damage each, so a cloud laid before a fire spell is 40 a body rather than 20.
   */
  noxious_cloud: {
    id: 'noxious_cloud',
    name: 'Noxious Cloud',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons a 2x2 block of tiles (Toxin 2).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'square', size: 2 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A body that poisons what it bites.
   *
   * `onHit` is the existing rider for exactly this, applied *after* the damage so the blow
   * resolves against the board it was swung at. Every bite is another stack, so a Wolf
   * left in contact is a Wildfire getting larger.
   *
   * The brief's Leech has no equivalent -- nothing in the engine drains health to its
   * attacker -- and its Escalate is the growth Auras replaced. What is here is the half
   * that was buildable, and it is the half that makes the Wolf a Bloom card.
   */
  briar_wolf: {
    id: 'briar_wolf',
    name: 'Briar Wolf',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Everything it bites is left poisoned (Toxin 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'briar_wolf' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      onHit: { status: 'toxin', stacks: 1 },
    },
  },

  /**
   * Held down, and softened while held.
   *
   * Entangle stops it moving and Brittle makes the next thing that reaches it hurt more,
   * which is the brief's "the next physical strike deals +2" said in the engine's own
   * word. Brittle is not limited to one strike or to physical damage -- it is +2 from
   * every hit until it decays -- so this is a touch more generous than the brief and a
   * good deal easier to read at the table.
   */
  root_snare: {
    id: 'root_snare',
    name: 'Root Snare',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Roots the target in place and leaves it Brittle — every hit against it lands harder until it wears off.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  // ------------------------------------------------------------ the second expansion
  //
  // Bloom's shelf was the thinnest in the game: five cards, none of which did anything on
  // the turn it was played. That is the school's character and it was also its problem --
  // a deck that cannot answer the board at all is not patient, it is helpless. The ten
  // below keep the identity and give it a floor: a body that poisons by dying, a wall that
  // poisons by standing there, and one line that finally *cashes* a Toxin stack instead of
  // waiting for somebody else's torch.

  /**
   * The school's only unconditional heal, and the reason it is a Spell rather than a rider.
   *
   * Bloom's Resonance already returns 20 to the Pact for free, once a turn. This is the
   * same idea bought deliberately, and the two stack — which is the whole Bloom race: a
   * deck that heals 50 a turn does not have to win the board, it only has to not lose it.
   *
   * `heal` reaches the Pact and nothing else. There is no way to mend a *unit* in this
   * engine, deliberately, so a card promising to would be a promise the reducer cannot
   * keep.
   */
  sap_draught: {
    id: 'sap_draught',
    name: 'Sap Draught',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Returns 30 health to your Pact. Stacks with the Verdant Growth your Companion already pays.',
    target: { kind: 'none' },
    effect: { op: 'heal', amount: 30 },
    keywords: [],
    range: 4,
  },

  /**
   * The answer to "what does Bloom do on turn one".
   *
   * Ordinary damage and one stack of rot, at the ordinary two-Pip rate. Nothing clever, and
   * that is the point: every other card in this school asks the player to spend a turn
   * setting up, and a shelf where *nothing* trades on impact cannot open a game.
   *
   * `physical`, not a bespoke type, and that is load-bearing rather than lazy — physical is
   * what Shatters a frozen body, so a Lash is also the Bloom deck's answer to an ally's
   * Frost card having done the hard part.
   */
  thornlash: {
    id: 'thornlash',
    name: 'Thornlash',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 physical damage and leaves 1 Toxin. Shatters a Frozen target, as any physical blow does.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'physical', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Lockdown, aimed at the ground.
   *
   * Entangle stops a body moving and leaves it free to swing, which is exactly the right
   * shape for a school that wins by outlasting: the vines do not stop the fight, they stop
   * the *retreat*. A cluster held in place is a cluster still standing in the Toxin next
   * turn.
   *
   * Tile-targeted and orthogonal, matching Spore Cloud, so the two read as one card played
   * twice rather than two cards with different geometry.
   */
  strangling_vines: {
    id: 'strangling_vines',
    name: 'Strangling Vines',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Roots everything orthogonally beside the target tile and poisons it (Toxin 1). A rooted unit can still attack.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The wide fuse.
   *
   * Eight tiles of rot and a little damage to go with it — the largest Toxin footprint in
   * the school, and the one that makes a Pyre ally's next card worth a whole turn. Two
   * stacks across `adjacent8` is up to 40 fire damage a body once somebody lights it.
   *
   * The 20 on the way in is deliberately small. A card that both laid the fuse *and*
   * cleared the board would make every other Bloom card a worse version of itself.
   */
  blight_bloom: {
    id: 'blight_bloom',
    name: 'Blight Bloom',
    cost: { pips: 3, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 physical damage and applies 2 Toxin to everything around the target tile. Fire consumes every stack for 20 damage each.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'physical', area: { shape: 'adjacent8' } },
        { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The first Bloom card that spends its own Toxin.
   *
   * Every other card in the school lays stacks and hopes an ally brings fire. This one
   * cashes them itself, and at a Pip it is the cheapest payoff in the game — but only
   * against a target already rotting, which is a board state Bloom had to work two turns to
   * reach.
   *
   * `true` damage on the paid branch, because armour has had two turns to matter and the
   * whole promise of Toxin is that plate does not answer it. The unpaid branch is a
   * consolation, not a card: 10 is what a Pip buys when the setup is not there.
   */
  spore_burst: {
    id: 'spore_burst',
    name: 'Spore Burst',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Against a target carrying 2 or more Toxin, deals 40 damage through any armor. Otherwise only 10.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'toxin', stacks: 2 },
      then: { op: 'damage', amount: 40, dtype: 'true', area: { shape: 'target' } },
      otherwise: { op: 'damage', amount: 10, dtype: 'physical', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A wall that fights by being walked past.
   *
   * The school's first Construct, and the only obstacle in the game that poisons rather
   * than burns or chills. It costs the enemy a stack every turn they leave it standing in
   * their row, which is the Bloom bargain stated as terrain: breaking it is a turn, and
   * not breaking it is a turn's worth of rot.
   *
   * Fifty health is deliberately soft. It is a clock, not a fortification.
   *
   * Also what **Iron Briar** raises, which is why it is a real card rather than a
   * setup-only stat block: the fusion presses a Bulwark spell into this, and a pressing
   * whose product nothing else could ever deal would be a card nobody can read.
   */
  briar_rampart: {
    id: 'briar_rampart',
    name: 'Briar Rampart',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 50 HP thicket on an empty tile. At the start of each enemy turn, every enemy in its row takes 1 Toxin. Leaves rough ground when it breaks.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'briar_rampart' },
    keywords: [],
    obstacleHp: 50,
    obstacleTurnStart: { status: 'toxin', stacks: 1 },
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * Bred to bleed, in the school with nothing to bleed for.
   *
   * Bloom has no Marrow costs and no Marrow sources — the one school where a tithe pays
   * for nothing of its own. That is exactly why it wants a body priced to be spent: the
   * Marrow leaves the school to pay for a colourless Hero card, and the Wisp is the pump
   * that lets a Sylva deck afford one.
   */
  sap_wisp: {
    id: 'sap_wisp',
    name: 'Sap Wisp',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Bled for +1 Marrow above the usual. Slow, soft, and worth more opened than standing.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'sap_wisp' },
    keywords: [],
    unit: {
      titheBonus: 1,
      atk: 10,
      hp: 30,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * A body that lays its own fuse by dying.
   *
   * The Briar Wolf poisons what it bites, which asks it to survive to bite twice. This one
   * poisons what killed it, which asks nothing at all — and that makes it the school's
   * first genuinely aggressive body: thirty attack on forty health wants to trade, and the
   * trade is where the card pays.
   *
   * Deathburst hits enemies of the dead body wherever it fell and whatever killed it, so
   * this is a Boar you are happy to see traded into a cluster.
   */
  sporeback_boar: {
    id: 'sporeback_boar',
    name: 'Sporeback Boar',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'When it dies, every adjacent enemy takes 2 Toxin. Toxin ticks through Armor.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'sporeback_boar' },
    keywords: [],
    unit: {
      atk: 30,
      hp: 40,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      deathburst: { status: 'toxin', stacks: 2 },
    },
  },

  /**
   * The line Bloom never had.
   *
   * Ten attack is not a threat and seventy health behind a Guardian is a genuine problem:
   * everything the school does needs turns, and this is the body that buys them. It blocks
   * sight for whatever is shooting from behind it, which in a Bloom deck is usually
   * nothing — the point is that the enemy has to come through it to reach the rot.
   */
  bramble_sentinel: {
    id: 'bramble_sentinel',
    name: 'Bramble Sentinel',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. A slow wall of thorns that would rather be stood in front of than swung.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'bramble_sentinel' },
    keywords: ['Guardian', 'Growth'],
    unit: {
      atk: 10,
      hp: 70,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 10 },
    },
  },

  /**
   * The school's elite, and its reach.
   *
   * Three tiles of reach on a forty-attack body is the longest arm in Bloom, and the reason
   * it costs four: at that price it is Tier 3, one copy a deck, and three roster points
   * rather than two. Sylva already fights at reach 3; this is the warband learning to.
   *
   * The rider is the school in one line. Everything it strikes rots, and it strikes from
   * far enough away that answering it means walking into the Toxin it has already laid.
   */
  verdant_colossus: {
    id: 'verdant_colossus',
    name: 'Verdant Colossus',
    cost: { pips: 4, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Strikes up to 3 tiles away, and everything it wounds is left poisoned (Toxin 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'verdant_colossus' },
    keywords: [],
    unit: {
      atk: 40,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 0, hp: 0 },
      onHit: { status: 'toxin', stacks: 2 },
    },
  },

  // -------------------------------------------------------------- the second bloodline
  //
  // Bloom carries more new company than any other school: the Thorn Warden founded it, the
  // Moss Aurochs walks the Tallow Levels, and four of the five new hybrid bloodlines are half
  // Bloom, because Bloom was the school with the fewest fusion partners already spoken for.
  // Three cards, chosen for what the shelf could not do: reach a body it had not already
  // poisoned, hold ground without a wall, and turn the poison into a real number.

  /**
   * Poison with no delivery cost, drifting where it is thrown.
   *
   * Bloom's toxin cards all attach to something — a cloud on a tile, a snare on a body, a
   * lash that has to connect. Pollen Drift is a Pip that poisons a 2x2 block wherever it
   * lands, no target required to already be there and nothing standing in the way, which
   * makes it the school's only genuine opener.
   *
   * Toxin 1 and no damage at all. It is a fuse, and everything else in the colour is a match:
   * Blight Bloom, Creeping Decay, and the Boar all read what is already rotting.
   */
  pollen_drift: {
    id: 'pollen_drift',
    name: 'Pollen Drift',
    cost: { pips: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons everything in a 2x2 block (Toxin 1). No damage.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'applyStatus',
      status: 'toxin',
      stacks: 1,
      area: { shape: 'square', size: 2 },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The rot, called in all at once.
   *
   * Bloom's poison is the slowest clock in the game and its whole weakness is that a fight
   * can end before the arithmetic does. Blight Harvest is the school's permission to stop
   * waiting: 40 through plate to a poisoned body, and it eats the Toxin to do it.
   *
   * `requiresStatus` rather than an `ifMet` fallback, and the difference is deliberate. A
   * card that punishes you for casting it early is one design; a card that simply is not
   * offered until the board is ready is a cleaner one, and Bloom already has enough cards
   * that ask the player to be patient without also asking them to be careful.
   */
  blight_harvest: {
    id: 'blight_harvest',
    name: 'Blight Harvest',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Consumes the poison on a Toxin-ridden target for 40 damage through any armor.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false, requiresStatus: 'toxin' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'clearStatus', status: 'toxin', area: { shape: 'target' } },
        { op: 'damage', amount: 40, dtype: 'true', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Ground held by growing through it, rather than by building on it.
   *
   * The Briar Rampart is a wall: it occupies tiles, it can be broken, and an enemy answers it
   * by breaking it. Taproot answers the same question the other way — nothing to break,
   * because there is nothing there. Everything in the block is Entangled and stays where it
   * is, and the ground is still walkable for anyone who was not standing in it.
   *
   * Three Pips because holding an army still for a turn is what Bloom's slow clock is worth,
   * and because Entangle on a 2x2 catches a formation rather than a body.
   */
  taproot: {
    id: 'taproot',
    name: 'Taproot',
    cost: { pips: 3, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Roots everything in a 2x2 block in place (Entangle 1) and deals 10 toxic damage there.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'toxic', area: { shape: 'square', size: 2 } },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A body that poisons the ground it came from.
   *
   * Bloom's bodies are all thorns — they hurt what touches them. The Toad hurts what stands
   * near where it dies, which is a different threat: an enemy can decline to attack a Briar
   * Wolf, and cannot decline to be adjacent to a Toad that something else killed.
   *
   * Two Toxin on death, in a school whose every other card reads Toxin. Killing it is a
   * favour to the Bloom player roughly as often as it is not, which is exactly the awkward
   * question a two-Pip body should pose.
   */
  mire_toad: {
    id: 'mire_toad',
    name: 'Mire Toad',
    cost: { pips: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'When it dies, every adjacent enemy is badly poisoned (Toxin 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'mire_toad' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      attackDtype: 'toxic',
      deathburst: { status: 'toxin', stacks: 2 },
    },
  },
};
