# 08 — Card Catalog

> **Generated file — do not edit by hand.** Written by `scripts/generate-card-catalog.ts`; run `npm run cards:catalog` to rebuild it after adding or changing a card.

Every card in the game, grouped by the file it lives in. Card data is read from the real `CardDef`s, so the counts below are the counts — not a claim about them.

**Adding a card:** pick the shelf its school belongs to under `src/core/data/cards/`, add a `CardDef` to that file's exported record, and rerun the generator. A new *file* also needs wiring into `cards/index.ts` and into `SOURCES` in the generator — the script fails loudly if you do the first and forget the second.

## Totals

**437 base cards.** Rank 2 printings are derived, not authored — see [Rank 2](#rank-2).

| Kind | Count | Whose | Where it goes |
|---|---:|---|---|
| minion | 151 | Hero | Vanguard Roster, never a deck |
| spell | 216 | Companion | drafted into a Grimoire |
| ability | 27 | Hero | Hero Deck |
| mark | 6 | Hero | Hero Deck |
| obstacle | 37 | Hero | Hero Deck, shown as a Construct |
| **total** | **437** | | |

### By school

| School | Cards |
|---|---:|
| bulwark | 64 |
| dusk | 64 |
| bloom | 62 |
| frost | 62 |
| surge | 59 |
| pyre | 58 |
| arcane | 35 |
| neutral | 33 |

### By file

| File | Cards | Breakdown |
|---|---:|---|
| [`starter.ts`](#starterts) | 12 | 5 minion, 2 spell, 4 ability, 1 obstacle |
| [`arcane.ts`](#arcanets) | 12 | 1 minion, 3 ability, 6 mark, 2 obstacle |
| [`pyre.ts`](#pyrets) | 12 | 4 minion, 6 spell, 2 obstacle |
| [`frost.ts`](#frostts) | 20 | 5 minion, 12 spell, 3 obstacle |
| [`companionUnits.ts`](#companionunitsts) | 50 | 50 minion |
| [`terrain.ts`](#terraints) | 5 | 5 obstacle |
| [`ranged.ts`](#rangedts) | 7 | 7 minion |
| [`surge.ts`](#surgets) | 20 | 7 minion, 12 spell, 1 obstacle |
| [`bloom.ts`](#bloomts) | 19 | 7 minion, 11 spell, 1 obstacle |
| [`bulwark.ts`](#bulwarkts) | 21 | 8 minion, 11 spell, 2 obstacle |
| [`dusk.ts`](#duskts) | 15 | 5 minion, 8 spell, 2 obstacle |
| [`gaslamp.ts`](#gaslampts) | 4 | 1 minion, 2 spell, 1 ability |
| [`wildlife.ts`](#wildlifets) | 2 | 2 minion |
| [`threats.ts`](#threatsts) | 3 | 3 minion |
| [`hybrid.ts`](#hybridts) | 24 | 23 spell, 1 obstacle |
| [`auras.ts`](#aurasts) | 13 | 11 spell, 2 ability |
| [`hero.ts`](#herots) | 22 | 17 ability, 5 obstacle |
| [`shelf.pyre.ts`](#shelfpyrets) | 22 | 21 spell, 1 obstacle |
| [`shelf.frost.ts`](#shelffrostts) | 22 | 20 spell, 2 obstacle |
| [`shelf.surge.ts`](#shelfsurgets) | 21 | 19 spell, 2 obstacle |
| [`shelf.bulwark.ts`](#shelfbulwarkts) | 23 | 20 spell, 3 obstacle |
| [`shelf.dusk.ts`](#shelfduskts) | 19 | 17 spell, 2 obstacle |
| [`shelf.bloom.ts`](#shelfbloomts) | 23 | 21 spell, 2 obstacle |
| [`vanguard.ts`](#vanguardts) | 36 | 36 minion |
| [`threats.dens.ts`](#threatsdensts) | 10 | 10 minion |
| **total** | **437** | |

---

## The cards

Columns: **Cost** is `P` Bones and `M` Marrow (Marrow is a strict requirement; Bones can be paid out of Marrow but never the reverse). **Tier** is derived from cost and keywords by `tierOf()` and sets the copy limit. **Stats** is the unit stat block or the obstacle HP. **Riders** is every optional behaviour hanging off it. **Flags** notes setup/splice-only cards, starter deck membership, and `R2` where the Forge sells a Rank 2 printing.

### `starter.ts`

The opening deck. Pyre and the colourless staples every Hero starts holding. — **12 cards** (5 minion, 2 spell, 4 ability, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Marrow Wisp** | `marrow_wisp` | minion | 1P | 1 | hero | 10 atk, 30 hp, 2 mov, rng 1, caster | tithe +1M; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Bled for +1 Marrow above the usual. |
| **Scout Imp** | `scout_imp` | minion | 1P | 1 | hero | 20 atk, 20 hp, 3 mov, rng 1, skirmisher | escalate +10/+0 | empty tile (ownTerritory) | Haste, Growth | — | Haste. Can move and attack the turn it is deployed. |
| **Vanguard Footman** | `vanguard_footman` | minion | 1P | 1 | hero | 20 atk, 40 hp, 2 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Growth | — | A conscript of the line. Steady, cheap, and yours from the first turn. |
| **Grave Sentinel** | `grave_sentinel` | minion | 2P | 2 | hero | 20 atk, 60 hp, 2 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Counter, Guardian, Growth | — | Counter: retaliates when hit in melee. Guardian: blocks line of sight behind it. |
| **Magma Brute** | `magma_brute` | minion | 4P | 3 | hero | 40 atk, 120 hp, 1 mov, rng 1, behemoth, **2x2** | escalate +10/+10 | empty tile (ownTerritory, 2x2) | PowerTier, Growth | — | Power Tier. 2x2 Behemoth. On arrival, deals 20 fire damage across a 2-tile front cleave. Cannot enter 1x1 gaps. |
| **Flame Surge** | `flame_surge` | spell | 2P | 2 | companion | — | — | line 2 — range 4, LoS | — | R2 | Deals 30 fire damage in a 2-tile line or diagonal. Detonates any Cinder Marks whose armor is penetrated. |
| **Cataclysmic Core** | `cataclysmic_core` | spell | 5P | 3 | companion | — | — | global | PowerTier, Retain | R2 | Power Tier. Retain. Detonates every active Mark on the board immediately with +20 bonus damage. |
| **Dark Tithe** | `dark_tithe` | ability | 0 | 1 | hero | — | — | entity (ally, unexhausted) | — | starter deck | Bleed an un-exhausted friendly minion for 40: extracts 3 Marrow and grants Persistent Armor equal to the health taken. |
| **Rite of Subjugation** | `rite_of_subjugation` | ability | 0 | 1 | companion | — | — | entity (ally) | Retain | — | Tether a friendly unit to the sealed beast. It cannot move or act. Hold it there for three rounds to claim the companion. |
| **Aegis Ward** | `aegis_ward` | ability | 1P | 1 | hero | — | — | ally unit or portrait | Retain | starter deck, R2 | Retain. Grants a friendly unit or your Hero +40 Persistent Armor. |
| **Shield Bash** | `shield_bash` | ability | 1P | 1 | hero | — | — | entity (enemy) | — | starter deck, R2 | Deals 20 damage to an enemy and shoves it 1 tile away. Triggers standard Collision Damage (30 / 20). |
| **Stone Barricade** | `stone_barricade` | obstacle | 1P | 1 | hero | 60 hp | leaves rubble | empty tile (any) | — | starter deck, R2 | Spawns a destructible 60 HP pillar on an empty tile. Blocks line of sight. |

### `arcane.ts`

The Hero's own colour: Marks, abilities and constructs, never a Spell. — **12 cards** (1 minion, 3 ability, 6 mark, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Scrap Phalanx** | `scrap_phalanx` | minion | 2P | 2 | hero | 10 atk, 60 hp, 1 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian | — | Guardian: blocks line of sight behind it. Sixty health of bolted-together plate, and almost no interest in moving. |
| **Cull the Weak** | `cull_the_weak` | ability | 1M | 1 | hero | — | — | global | — | starter deck, R2 | Costs 1 Marrow, which no amount of banked Bones will cover. Deals 40 damage through any armor to the enemy with the least health. |
| **Grapple Line** | `grapple_line` | ability | 1P | 1 | hero | — | — | line 4 | — | starter deck, R2 | Deals 10 physical damage down a 4-tile line, then drags everything caught 2 tiles back toward the near end. Triggers standard Collision Damage (30 / 20). |
| **Aether Beam** | `aether_beam` | ability | 2P | 2 | companion | — | — | line 4 — range 4, linear, LoS | — | starter deck, R2 | A line of light drawn through the arena. 30 damage to everything standing in it, yours included. |
| **Arc Mark** | `arc_mark` | mark | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | — | Attach to a unit or obstacle (max 1 per target). When it loses health to shock or spell damage, deals 30 shock damage in a cross around it — and shock leaves everything it touches Charged. |
| **Cinder Mark** | `cinder_mark` | mark | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | — | Attach to a unit or obstacle (max 1 per target). Detonates for 40 fire damage to all adjacent when the host loses HP to fire or spell damage. |
| **Rime Mark** | `rime_mark` | mark | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | — | Attach to a unit or obstacle (max 1 per target). When it loses health to frost or spell damage, deals 20 frost damage and 2 Chill to everything adjacent. |
| **Rot-Root Snare** | `rot_root_snare` | mark | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | — | Attach to a unit or obstacle (max 1 per target). When it loses health to a physical or impact blow, everything adjacent is Entangled and takes 1 Toxin. |
| **Soul Splinter Mark** | `soul_splinter_mark` | mark | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | Attach to a friendly unit. When it dies — including bled dry by a tithe — deals 50 damage to the lowest-HP enemy. |
| **Tremor Mark** | `tremor_mark` | mark | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | — | Attach to a unit or obstacle (max 1 per target). When it loses health to a physical or impact blow, deals 40 impact damage in a cross around it. |
| **Alchemist's Barricade** | `alchemists_barricade` | obstacle | 2P | 2 | hero | 80 hp | leaves rubble | empty tile (any) | — | R2 | Raises a destructible 80 HP barricade on an empty tile. Blocks line of sight, and leaves rubble when it breaks. |
| **Volatile Munitions Cask** | `volatile_cask` | obstacle | 2P | 2 | hero | 40 hp | leaves rubble | empty tile (any) | — | R2 | Raises a 40 HP cask on an empty tile. When it is destroyed it detonates for 30 impact damage in a cross around it, and leaves rubble. |

### `pyre.ts`

Pyre expansion — burst and burn. — **12 cards** (4 minion, 6 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Ember Moth** | `ember_moth` | minion | 1P | 1 | hero | 10 atk, 20 hp, 3 mov, rng 1, skirmisher | deathburst burn 1 | empty tile (ownTerritory) | Haste | — | Haste. When it dies, every adjacent enemy catches fire (Burn 1). |
| **Soot Sprite** | `soot_sprite` | minion | 1P | 1 | hero | 10 atk, 20 hp, 3 mov, rng 1, skirmisher | onHit burn 1 | empty tile (ownTerritory) | — | — | Anything it strikes is left burning (Burn 1). |
| **Cinder Adder** | `cinder_adder` | minion | 2P | 2 | hero | 20 atk, 30 hp, 1 mov, rng 1-3, sniper | dmg fire; +20 vs burn | empty tile (ownTerritory) | — | — | Spits fire at 3 tiles. Deals 20 extra damage to anything already Burning. |
| **Ember Hound** | `ember_hound` | minion | 2P | 2 | hero | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | trail burning | empty tile (ownTerritory) | — | — | Every tile it walks off is left burning. Anything starting its turn on burning ground catches fire — yours included. |
| **Chimney Draw** | `chimney_draw` | spell | 1P | 1 | companion | — | — | empty tile (any) — range 3, LoS | — | R2 | Drags everything within a tile of the target point 1 tile toward it, sets it alight (Burn 1), and deals 10 fire damage. |
| **Stoke** | `stoke` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a Burning target, deals 30 damage through any armor. Otherwise it merely sets the target alight (Burn 1). |
| **Ashen Wake** | `ashen_wake` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 fire damage in a 3-tile line. If anything on the line was already Burning, everything on it is left Brittle. |
| **Backdraft** | `backdraft` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Consumes 2 Burn on the target for 40 fire damage, and 20 more to everything orthogonally adjacent. Without the fire, only 15. |
| **Cinder Gale** | `cinder_gale` | spell | 3P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 fire damage in a widening 3-deep cone and sets everything caught alight (Burn 1). |
| **Emberfall** | `emberfall` | spell | 3P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Sets a 2x2 block of ground burning for 2 turns and deals 10 fire damage there. Anything starting its turn on burning ground catches fire — yours included. |
| **Pyre Pillar** | `pyre_pillar` | obstacle | 2P | 2 | companion | 60 hp | turn start burn 1; leaves rubble | empty tile (any) | — | R2 | Raises a 60 HP pillar on an empty tile. At the start of each enemy turn, every enemy in its row catches fire (Burn 1). |
| **Slag Cairn** | `slag_cairn` | obstacle | 2P | 2 | companion | 40 hp | on break 30 dmg + burn 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 40 HP cairn on an empty tile. When it breaks it bursts for 30 fire damage and Burn 1 in a cross around it, hitting whatever is there. |

### `frost.ts`

Frost expansion — slow, freeze, shatter. — **20 cards** (5 minion, 12 spell, 3 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Rime Fox** | `rime_fox` | minion | 1P | 1 | hero | 10 atk, 20 hp, 3 mov, rng 1, skirmisher | onHit chill 1 | empty tile (ownTerritory) | Haste | — | Haste. Whatever survives its bite takes Chill 1, and the third stack freezes a unit solid. |
| **Glacial Stalker** | `glacial_stalker` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | +20 vs chill/freeze | empty tile (ownTerritory) | — | — | Deals 20 extra damage to a Chilled or Frozen target. |
| **Hoarhound** | `hoarhound` | minion | 2P | 2 | hero | 20 atk, 40 hp, 4 mov, rng 1, skirmisher | onHit chill 1 | empty tile (ownTerritory) | — | — | Anything it strikes is left Chilled. |
| **Rimeguard** | `rimeguard` | minion | 2P | 2 | hero | 10 atk, 70 hp, 1 mov, rng 1, bruiser | escalate +0/+10 | empty tile (ownTerritory) | Guardian, Growth | — | Guardian: blocks line of sight behind it. |
| **Glacier Warden** | `glacier_warden` | minion | 4P | 3 | hero | 40 atk, 80 hp, 1 mov, rng 1, bruiser | deathburst chill 2 | empty tile (ownTerritory) | Counter | — | Counter: strikes back for its full Attack whenever it is hit in melee. When it dies, every adjacent enemy takes Chill 2. |
| **Cold Snap** | `cold_snap` | spell | 1P | 1 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 10 frost damage in a 3-tile line and Chills everything on it. |
| **Creeping Rime** | `creeping_rime` | spell | 1P | 1 | companion | — | — | entity (any) — range 4, LoS | — | — | Chills the target tile and everything orthogonally beside it (Chill 1). |
| **Rime Touch** | `brittle_touch` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 2, LoS | — | — | Apply Brittle 2 to a unit. A Brittle target takes +20 damage from every hit. |
| **Glacial Spike** | `glacial_spike` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 5, LoS | — | R2 | Deal 30 frost damage to a unit and apply Chill 1. Chill 3 freezes a unit solid. |
| **Hoarfrost Veil** | `hoarfrost_veil` | spell | 2P | 2 | companion | — | — | none — range 1 | — | R2 | Sheathes the caster in 20 Armor and Chills everything adjacent to it. |
| **Rime Lance** | `rime_lance` | spell | 2P | 2 | companion | — | — | line 3 — range 5, linear, LoS | — | R2 | Deals 30 frost damage down a 3-tile line and applies Chill 1 to everything in it. Fires only along a rank, file or diagonal. |
| **Whiteout** | `whiteout` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Fogs a 2x2 block of tiles for 2 turns, blocking ranged line of sight through them, and Chills everything standing there. |
| **Calving** | `calving` | spell | 3P | 2 | companion | — | — | entity (enemy, +obstacles) — range 3, LoS | — | — | Against a Frozen target, breaks the ice for 50 impact damage and 20 more to everything adjacent. Otherwise, 20 impact. |
| **Deep Winter** | `deep_winter` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Applies Chill 2 to everything in a 3x3 around the target tile, and deals no damage at all. The third stack freezes a unit solid. |
| **Flash Freeze** | `flash_freeze` | spell | 1P+2M | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Raise a 40 HP Coolant Pillar on an empty tile, Chilling everything orthogonally beside it. |
| **Frost Nova** | `frost_nova` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | R2 | Apply Chill 1 to every unit adjacent to the target tile, and 10 frost damage. |
| **Rime Lock** | `rime_lock` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Freezes the target solid. If it was already Frozen, deals 50 damage through any armor instead. |
| **Coolant Pillar** | `coolant_pillar` | obstacle | 0 | 1 | companion | 40 hp | leaves rubble | none | — | setup only | A venting column of coolant. Blocks sight and movement; leaves rubble when broken. |
| **Ice Barricade** | `ice_barricade` | obstacle | 1P | 1 | hero | 50 hp | leaves rubble | empty tile (any) | — | R2 | Raise a wall of ice. Blocks movement and line of sight until it is broken. |
| **Hail Spire** | `hail_spire` | obstacle | 2P | 2 | companion | 50 hp | turn start chill 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 50 HP spire on an empty tile. At the start of each enemy turn, every enemy in its row takes Chill 1. Three stacks freeze. |

### `companionUnits.ts`

Bound Forms. Placed by setup, never drawn, never bought. — **50 cards** (50 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Ashwing Phoenix** | `phoenix_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Barrow Bear** | `bear_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Barrow Jackal** | `jackal_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Bone Bastion Sovereign** | `sovereign_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Boreas** | `boreas_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Bramble Fox** | `fox_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Chimera of the Caldera** | `chimera_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Cinder Shade** | `shade_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Pyre and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Cinder-Wasp Swarm** | `wasp_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Cinderback Badger** | `badger_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Conduit Kudu** | `kudu_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Crimson Treant** | `treant_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Crypt Spider** | `spider_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Dolmen Crab** | `crab_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ferrum** | `ferrum_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm, Guardian | setup only | Bound Form. Your Bulwark cards are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Flue Salamander** | `salamander_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Frostbarrow Wight** | `wight_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Frost and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Galvanic Eel** | `eel_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Glacial Juggernaut** | `juggernaut_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Frost and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Gloam Owl** | `owl_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Grave-Gargoyle** | `gargoyle_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Frost and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Hoarfrost Mammoth** | `mammoth_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm, Guardian | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ignis** | `ignis_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ignis Enraged** | `ignis_behemoth_bound` | minion | 0 | 3 | companion | 50 atk, 440 hp, 1 mov, rng 1, behemoth, **2x2** | — | none | BoundForm | setup only | Bound Form. The drake grown into its full shape. Blocks sight through itself. |
| **Ignis, Ember Drake** | `ignis_drake_bound` | minion | 0 | 1 | companion | 40 atk, 440 hp, 2 mov, rng 1-2, bruiser | — | none | BoundForm | setup only | Bound Form. The drake itself. Wounds it takes are dealt to its Pact. |
| **Ink Owl** | `lexis_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 3 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Arcane cards are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ironhide Rhino** | `rhino_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Kinetic Dynamo** | `dynamo_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Surge and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Menhir Beetle** | `beetle_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1-3, caster | — | none | BoundForm, Guardian | setup only | Bound Form. Your Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Mortis** | `mortis_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Moss Aurochs** | `aurochs_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Murk Heron** | `heron_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Obsidian Tortoise** | `tortoise_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Pollen Moth** | `moth_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Quarry Ram** | `ram_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Rime Ermine** | `ermine_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Rotcap Myconid** | `myconid_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Saltglass Seal** | `seal_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Sparkback Pangolin** | `pangolin_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm, Guardian | setup only | Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Steamvent Otter** | `otter_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre and Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Storm-Mantis** | `mantis_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Frost and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Sylva** | `sylva_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **The Clockwork Colossus** | `colossus_bound` | minion | 0 | 3 | companion | 60 atk, 440 hp, 1 mov, rng 1, behemoth, **2x2** | dmg shock; onHit charged 1; plates 10/turn | none | BoundForm | setup only | Bound Form. The Great Quieting, given legs. Blocks sight through itself. |
| **The Sovereign, Risen** | `sovereign_behemoth_bound` | minion | 0 | 3 | companion | 50 atk, 440 hp, 1 mov, rng 1, behemoth, **2x2** | — | none | BoundForm | setup only | Bound Form. The Bastion, awake. Blocks sight through itself. |
| **Thunderhawk** | `thunderhawk_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Pyre and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Umbra** | `umbra_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-2, skirmisher | — | none | BoundForm | setup only | Bound Form. The Duelist casts from where it stands, and bleeds when it is struck. |
| **Volatile Geist** | `geist_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Surge and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Voltara** | `voltara_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-2, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Voltbriar Serpent** | `serpent_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-2, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Surge and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Winterthorn Elk** | `elk_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Frost and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |

### `terrain.ts`

Encounter scenery. Built by the arena, not by a player. — **5 cards** (5 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Bramble Screen** | `terrain_cover` | obstacle | 0 | 1 | hero | 40 hp, cover | — | none | — | setup only | Blocks sight but not movement. Units may stand in it. |
| **Cryo-Crystal** | `cryo_crystal` | obstacle | 0 | 1 | hero | 20 hp | on break freeze 1 | none | — | setup only | Volatile. Shattering it freezes every unit around it, friend and foe. |
| **Magma Barrel** | `magma_crystal` | obstacle | 0 | 1 | hero | 20 hp | on break burn 2 | none | — | setup only | Volatile. Shattering it sets fire to every unit around it, friend and foe. |
| **Marrow Geode** | `marrow_geode` | obstacle | 0 | 1 | hero | 10 hp | breaks for 2M | none | — | setup only | Volatile. Breaking it extracts 2 Marrow for the attacker. |
| **Rubble Wall** | `terrain_wall` | obstacle | 0 | 1 | hero | 80 hp | leaves rubble | none | — | setup only | Blocks movement and sight until broken. |

### `ranged.ts`

Bodies that shoot. — **7 cards** (7 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Hedge Slinger** | `hedge_slinger` | minion | 2P | 2 | hero | 10 atk, 40 hp, 2 mov, rng 1-3, sniper | escalate +10/+0 | empty tile (ownTerritory) | Growth | — | A conscript with a sling. Shoots up to three tiles away with a clear line, and not hard. |
| **Rime Archer** | `rime_archer` | minion | 2P | 2 | hero | 20 atk, 40 hp, 1 mov, rng 1-3, sniper | escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Shoots up to three tiles away with a clear line. Slow: it holds the ground it was set on. |
| **Cinder Lobber** | `cinder_lobber` | minion | 3P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 2-4, caster | arcing; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Shoots over anything, needing no line of sight. Cannot hit what is adjacent. |
| **Glass Arbalest** | `glass_arbalest` | minion | 3P | 2 | hero | 30 atk, 30 hp, 1 mov, rng 1-4, sniper | escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Shoots up to four tiles away with a clear line. Fragile, and slow to reposition. |
| **Longshot Stalker** | `longshot_stalker` | minion | 3P | 2 | hero | 30 atk, 30 hp, 2 mov, rng 1-99, sniper | lineOnly; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Fires any distance, but only along a straight line. Anything in the way stops the shot. |
| **Thorn Lobber** | `thorn_lobber` | minion | 3P | 2 | hero | 20 atk, 50 hp, 1 mov, rng 2-4, caster | arcing; escalate +0/+10 | empty tile (ownTerritory) | Growth | — | Shoots over anything, needing no line of sight. Cannot hit what is adjacent. |
| **Arc Turret** | `arc_turret` | minion | 4P | 3 | hero | 50 atk, 60 hp, 0 mov, rng 1-5, caster | escalate +0/+10 | empty tile (ownTerritory) | Growth | — | Hits hard at long range and never moves. Blocking its line, or shoving it, is the answer. |

### `surge.ts`

Surge expansion — charge and chain. — **20 cards** (7 minion, 12 spell, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Static Hare** | `static_hare` | minion | 1P | 1 | hero | 10 atk, 20 hp, 3 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | — | Haste. Whatever survives its bite is left Charged. Fire Overloads a Charged target; frost Superconducts. |
| **Storm Rod** | `storm_rod` | minion | 1P | 1 | hero | 10 atk, 40 hp, 0 mov, rng 1, caster | deathburst charged 1 | empty tile (ownTerritory) | — | — | Cannot move, ever. When it dies, every adjacent enemy is left Charged. |
| **Storm Wisp** | `storm_wisp` | minion | 1P | 1 | hero | 10 atk, 20 hp, 2 mov, rng 1, skirmisher | refund 1P on attack | empty tile (ownTerritory) | Haste | — | Haste. Whenever it attacks, you are paid 1 Bone. |
| **Voltaic Coil** | `voltaic_coil` | minion | 2P | 2 | hero | 20 atk, 50 hp, 1 mov, rng 1, bruiser | refund 1P on death | empty tile (ownTerritory) | — | — | When it dies — however it dies — you are paid 1 Bone. |
| **Voltaic Hound** | `voltaic_hound` | minion | 2P | 2 | hero | 30 atk, 20 hp, 3 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | — | Haste. Can move and attack the turn it is deployed. Fast, vicious, and made of paper. |
| **Clockwork Bombardier** | `clockwork_bombardier` | minion | 3P | 2 | hero | 10 atk, 40 hp, 1 mov, rng 2-4, sniper | arcing | empty tile (ownTerritory) | — | — | Lobber. Fires 2-4 tiles, arcing over cover, and cannot depress its aim onto anything adjacent. Whatever survives a shell is left Charged. |
| **Arc Dynamo** | `arc_dynamo` | minion | 4P | 3 | hero | 50 atk, 60 hp, 1 mov, rng 1-3, sniper | — | empty tile (ownTerritory) | — | — | Strikes up to 3 tiles away, and whatever survives is left Charged. Slow to move, and the whole reason to bring a Discharge. |
| **Arcing Step** | `arcing_step` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | An allied unit moves 2 further this turn and is left Charged. Fire Overloads it; frost Superconducts. |
| **Galvanic Rally** | `galvanic_rally` | spell | 1P | 1 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Every unit orthogonally beside the target tile moves 1 further this turn and is left Charged. |
| **Induction** | `induction` | spell | 1P | 1 | companion | — | — | line 3 — range 4, LoS | — | — | Leaves everything in a 3-tile line Charged. No damage. |
| **Static Arc** | `static_arc` | spell | 1P | 1 | companion | — | — | empty tile (any) — range 3, LoS | — | R2 | Deals 20 spell damage to everything orthogonally beside the target tile and leaves it Charged. Fire into a Charged target Overloads; frost Superconducts. |
| **Arc Lash** | `arc_lash` | spell | 2P | 2 | hero | — | — | entity (enemy) | — | R2 | Deal 30 shock damage to a unit. In rain, the charge arcs for 10 to everything adjacent to it. |
| **Chain Bolt** | `chain_bolt` | spell | 2P | 2 | companion | — | — | line 3 — range 5, linear, LoS | — | R2 | Deals 30 shock damage down a 3-tile line, and shock leaves everything it touches Charged. Fires only along a rank, file or diagonal. |
| **Discharge** | `discharge` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a Charged target, deals 40 shock damage and 20 more to everything adjacent. Otherwise only 20. |
| **St. Elmo's Fire** | `elmos_fire` | spell | 2P | 2 | companion | — | — | none — range 1 | — | R2 | Deals 20 shock damage to everything adjacent to the caster and leaves it all Charged. |
| **Thunderhead** | `thunderhead` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 30 shock damage. If you still hold 3 or more Bones, it earths outward for 20 more to everything adjacent. |
| **Capacitor Dump** | `capacitor_dump` | spell | 3P | 2 | companion | — | — | entity (enemy, has charged) — range 4, LoS | — | R2 | Consumes the Charge on a Charged target for 60 shock damage, earthing 20 into everything adjacent. |
| **Paralytic Arc** | `paralytic_arc` | spell | 2P+1M | 2 | companion | — | — | entity (enemy, has charged) — range 4, LoS | — | R2 | Costs 1 Marrow, and can only be aimed at a Charged unit. Deals 20 shock damage and Stuns it: no moving, no swinging. |
| **Tempest Break** | `tempest_break` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 30 shock damage in a 3x3 around the target tile, and shock leaves every survivor Charged. |
| **Tesla Pylon** | `tesla_pylon` | obstacle | 2P | 2 | companion | 40 hp | turn start charged 1 | empty tile (any) — range 3, LoS | — | R2 | Raises a 40 HP pylon on an empty tile. At the start of each enemy turn, every enemy in its row is left Charged. Deals no damage itself. |

### `bloom.ts`

Bloom expansion — growth and regrowth. — **19 cards** (7 minion, 11 spell, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Creeping Briar** | `creeping_briar` | minion | 1P | 1 | hero | 10 atk, 40 hp, 0 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Growth | — | Cannot move, ever. Plant it where the fight is going to be. |
| **Sap Wisp** | `sap_wisp` | minion | 1P | 1 | hero | 10 atk, 30 hp, 2 mov, rng 1, caster | tithe +1M | empty tile (ownTerritory) | — | — | Bled for +1 Marrow above the usual. Slow, soft, and worth more opened than standing. |
| **Bramble Sentinel** | `bramble_sentinel` | minion | 2P | 2 | hero | 10 atk, 70 hp, 1 mov, rng 1, bruiser | escalate +0/+10 | empty tile (ownTerritory) | Guardian, Growth | — | Guardian: blocks line of sight behind it. A slow wall of thorns that would rather be stood in front of than swung. |
| **Briar Wolf** | `briar_wolf` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | onHit toxin 1 | empty tile (ownTerritory) | — | — | Everything it bites is left poisoned (Toxin 1). |
| **Mire Toad** | `mire_toad` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | dmg toxic; deathburst toxin 2 | empty tile (ownTerritory) | — | — | When it dies, every adjacent enemy is badly poisoned (Toxin 2). |
| **Sporeback Boar** | `sporeback_boar` | minion | 2P | 2 | hero | 30 atk, 40 hp, 2 mov, rng 1, bruiser | deathburst toxin 2 | empty tile (ownTerritory) | — | — | When it dies, every adjacent enemy takes 2 Toxin. Toxin ticks through Armor. |
| **Verdant Colossus** | `verdant_colossus` | minion | 4P | 3 | hero | 40 atk, 80 hp, 1 mov, rng 1-3, sniper | onHit toxin 2 | empty tile (ownTerritory) | — | — | Strikes up to 3 tiles away, and everything it wounds is left poisoned (Toxin 2). |
| **Pollen Drift** | `pollen_drift` | spell | 1P | 1 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Poisons everything in a 2x2 block (Toxin 1). No damage. |
| **Root Snare** | `root_snare` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Roots the target in place and leaves it Brittle — every hit against it lands harder until it wears off. |
| **Sap Draught** | `sap_draught` | spell | 1P | 1 | companion | — | — | none — range 4 | — | R2 | Returns 30 health to your Pact. Stacks with the Verdant Growth your Companion already pays. |
| **Spore Burst** | `spore_burst` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a target carrying 2 or more Toxin, deals 40 damage through any armor. Otherwise only 10. |
| **Blight Harvest** | `blight_harvest` | spell | 2P | 2 | companion | — | — | entity (enemy, has toxin) — range 4, LoS | — | R2 | Consumes the poison on a Toxin-ridden target for 40 damage through any armor. |
| **Noxious Cloud** | `noxious_cloud` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Poisons a 2x2 block of tiles (Toxin 2). |
| **Spore Cloud** | `spore_cloud` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Applies 2 Toxin to everything orthogonally beside the target tile. Toxin ticks through Armor. Fire ignites it for 20 damage per stack to everything adjacent. |
| **Strangling Vines** | `strangling_vines` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Roots everything orthogonally beside the target tile and poisons it (Toxin 1). A rooted unit can still attack. |
| **Thornlash** | `thornlash` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 30 physical damage and leaves 1 Toxin. Shatters a Frozen target, as any physical blow does. |
| **Blight Bloom** | `blight_bloom` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 20 physical damage and applies 2 Toxin to everything around the target tile. Fire consumes every stack for 20 damage each. |
| **Taproot** | `taproot` | spell | 3P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Roots everything in a 2x2 block in place (Entangle 1) and deals 10 toxic damage there. |
| **Briar Rampart** | `briar_rampart` | obstacle | 2P | 2 | companion | 50 hp | turn start toxin 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 50 HP thicket on an empty tile. At the start of each enemy turn, every enemy in its row takes 1 Toxin. Leaves rough ground when it breaks. |

### `bulwark.ts`

Bulwark expansion — plate and hold. — **21 cards** (8 minion, 11 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Shieldbearer** | `shieldbearer` | minion | 1P | 1 | hero | 10 atk, 50 hp, 1 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian | — | Guardian: blocks line of sight behind it. A Bone for a sightline, and almost no threat at all. |
| **Concussive Blow** | `concussive_blow` | minion | 2P | 2 | hero | 20 atk, 40 hp, 1 mov, rng 1, bruiser | onHit stun 1; escalate +10/+10 | empty tile (ownTerritory) | — | — | A slab of a thing with a hammer. Whatever it wounds is Stunned: no moving, no swinging. |
| **Quarry Hand** | `quarry_hand` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian | — | Guardian. Enemies must come through it before they reach what is behind it. |
| **Siege Ox** | `siege_ox` | minion | 2P | 2 | hero | 30 atk, 50 hp, 1 mov, rng 1, bruiser | onHit brittle 1 | empty tile (ownTerritory) | — | — | Whatever survives its charge is left Brittle, taking +20 damage from every hit until it wears off. |
| **Stone-Heart Golem** | `stone_heart_golem` | minion | 3P | 2 | hero | 30 atk, 80 hp, 1 mov, rng 1, bruiser | plates 10/turn | empty tile (ownTerritory) | Guardian | — | Guardian. At the start of each of your turns it welds on 10 more Armor, up to 30. |
| **Anvil Lord** | `anvil_lord` | minion | 4P | 3 | hero | 40 atk, 90 hp, 1 mov, rng 1, bruiser | plates 20/turn | empty tile (ownTerritory) | — | — | At the start of each of your turns it welds on 20 more Armor, up to 60. Slow, short-reached, and very hard to remove. |
| **Bastion Golem** | `bastion_golem` | minion | 4P | 3 | hero | 30 atk, 160 hp, 1 mov, rng 1, behemoth, **2x2** | escalate +0/+20 | empty tile (ownTerritory, 2x2) | PowerTier, Guardian, Growth | — | Power Tier. 2x2 Behemoth. Guardian: blocks line of sight behind it. Cannot enter 1x1 gaps. |
| **Slag-Iron Golem** | `slag_iron_golem` | minion | 4P | 3 | hero | 30 atk, 80 hp, 1 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian, Counter | — | Guardian: blocks line of sight behind it. Counter: strikes back for its full Attack whenever it is hit in melee, and survives to do it again. |
| **Bastion Stance** | `bastion_stance` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 40 Persistent Armor and moves nothing. Armor is spent before health, and does not decay. |
| **Deadweight** | `deadweight` | spell | 1P | 1 | companion | — | — | entity (ally, unexhausted) — range 3 | — | R2 | Bolts 30 Armor onto an allied body. It digs in and cannot act until your next turn. |
| **Tectonic Plate** | `tectonic_plate` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 30 Armor and shoves everything beside it 1 tile away. |
| **Avalanche Slam** | `avalanche_slam` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Shoves the target 2 tiles. If it slams into something, it is left Brittle. |
| **Counterweight** | `counterweight` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Shoves the target 1 tile, deals 20 impact damage, and leaves it Brittle. |
| **Phalanx Step** | `phalanx_step` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Drags everything around the target tile 1 tile toward it. They collide with whatever arrives first. Triggers standard Collision Damage (30 / 20). |
| **Seismic Slam** | `seismic_slam` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Every unit around the target tile is thrown 1 tile directly away from it. Deals no damage of its own — only what they hit. Triggers standard Collision Damage (30 / 20). |
| **Siege Break** | `siege_break` | spell | 2P | 2 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | R2 | Deals 50 impact damage to any unit or construct, yours included. The answer to a wall you cannot walk around. |
| **Crag Slam** | `crag_slam` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 40 impact damage to everything orthogonally beside the target tile, then shoves them 1 tile away. Shatters anything Frozen. |
| **Hammer Fall** | `hammer_fall` | spell | 2P+1M | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Costs 1 Marrow, which no amount of banked Bones will cover. Deals 30 impact damage and Stuns: no moving, no swinging. |
| **Sinkhole** | `sinkhole` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Collapses the ground: everything within a tile of the point is dragged 1 tile into it and takes 20 impact damage. Bodies arriving on the same tile collide. |
| **Battlement** | `battlement` | obstacle | 2P | 2 | companion | 40 hp, cover | — | empty tile (any) — range 3, LoS | — | R2 | Raises 40 HP of cover on an empty tile. Blocks line of sight but not movement — your own units may stand in it and shoot out. |
| **Iron Gate** | `iron_gate` | obstacle | 2P | 2 | companion | 80 hp | leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises an 80 HP gate on an empty tile. Blocks movement and line of sight, and leaves rough ground when it finally breaks. |

### `dusk.ts`

Dusk expansion — drain, decay, the graveyard. — **15 cards** (5 minion, 8 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Galvanic Revenant** | `galvanic_revenant` | minion | 0 | 1 | hero | 20 atk, 30 hp, 2 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | setup only | Haste. Jolted upright and already moving. It does not remember what it was. |
| **Hollow Wraith** | `hollow_wraith` | minion | 0 | 1 | hero | 40 atk, 40 hp, 2 mov, rng 1, bruiser | dmg true | empty tile (ownTerritory) | — | setup only | Its strikes pass through armor entirely — and, being no longer physical, they no longer Shatter ice. |
| **Ash-Ghoul** | `ash_ghoul` | minion | 1P | 1 | hero | 20 atk, 20 hp, 0 mov, rng 1, bruiser | tithe +1M | empty tile (ownTerritory) | — | — | Cannot move, ever. Like any summon it cannot act — or be bled — the turn it arrives. Bled for +1 Marrow above the usual. |
| **Carrion Crow** | `carrion_crow` | minion | 1P | 1 | hero | 10 atk, 20 hp, 4 mov, rng 1, skirmisher | tithe +1M | empty tile (ownTerritory) | — | — | Bleeds well. Yields extra Marrow when tithed. |
| **Hollowed Husk** | `hollowed_husk` | minion | 1P | 1 | hero | 0 atk, 40 hp, 1 mov, rng 1, bruiser | refund 2P on death | empty tile (ownTerritory) | Guardian | — | Guardian. It cannot strike. When it dies, you are paid 2 Bones. |
| **Pall** | `pall` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 10 damage through any armor to the target and everything orthogonally beside it, and leaves it all poisoned (Toxin 1). |
| **Shadow Siphon** | `shadow_siphon` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Spends an allied unit whole. The weakest enemy loses 30 health through any armor, and your Pact recovers 30. |
| **Smoke Bomb** | `smoke_bomb` | spell | 1P | 1 | hero | — | — | empty tile (any) | — | R2 | A held breath of black smoke. Blocks line of sight; anyone may walk into it. |
| **Wither** | `wither` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a Brittle target, deals 30 damage through any armor. Otherwise it merely leaves the target Brittle. |
| **Creeping Decay** | `creeping_decay` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | R2 | Deals 20 damage through any armor to everything orthogonally beside the target tile, and leaves it all Brittle. |
| **Grave Call** | `grave_call` | spell | 2P | 2 | companion | — | — | entity (ally) — range 4 | — | — | Spends an allied unit whole. A Hollow Wraith stands up on the same tile, striking through any armor. |
| **Last Rites** | `last_rites` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Drains 30 decay damage out of the target and puts 20 back on your Pact. |
| **Exhume** | `exhume` | spell | 3P | 2 | companion | — | — | fallen (startingZone) | — | — | Digs a fallen Vanguard body out of the ground. It stands up in your starting zone at half health, stripped of everything it was carrying. |
| **Smoke Bank** | `smoke_bank` | obstacle | 0 | 1 | hero | 30 hp, cover | — | none | — | setup only | Blocks sight but not movement. Units may stand in it. |
| **Charnel Pillar** | `charnel_pillar` | obstacle | 2P | 2 | companion | 50 hp | turn start brittle 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 50 HP cairn of bone on an empty tile. At the start of each enemy turn, every enemy in its row is left Brittle — taking +20 damage from every hit until it wears off. |

### `gaslamp.ts`

Gaslamp expansion — clockwork and gas. — **4 cards** (1 minion, 2 spell, 1 ability).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Scrap-Metal Mortar** | `scrap_metal_mortar` | minion | 3P | 2 | hero | 20 atk, 60 hp, 1 mov, rng 2-4, sniper | arcing; escalate +10/+0; leaves rubble | empty tile (ownTerritory) | Growth | — | Lobber. Fires 2-4 tiles, arcing over cover, and cannot depress its aim onto anything adjacent. Leaves rubble when it breaks. |
| **Harvest the Weak** | `harvest_the_weak` | spell | 0 | 1 | hero | — | — | entity (ally, unexhausted) | — | — | Bleed an un-exhausted friendly minion for 40. Extract Marrow equal to the health actually taken, up to 4, and draw a card. |
| **Pressure Valve Release** | `pressure_valve_release` | spell | 2P | 2 | companion | — | — | line 3 — range 3, LoS | — | R2 | Vent a widening blast: 30 fire damage in a 3-deep cone, then shove everything caught 1 tile away. |
| **Aetheric Tether** | `aetheric_tether` | ability | 1P+1M | 2 | companion | — | — | empty tile (any) — range 5, LoS | — | — | Drag every unit orthogonally beside the target tile onto it. They collide with whatever arrives first. |

### `wildlife.ts`

Feral beasts. Loyal to nobody. — **2 cards** (2 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Gilded Scavenger** | `gilded_scavenger` | minion | 0 | 1 | hero | 0 atk, 60 hp, 4 mov, rng 1, skirmisher | bounty 3M | none | Feral, Haste | setup only | Feral. Never attacks. Flees for the edge, and is gone if it reaches one. Kill it for its purse. |
| **Ridge Wolf** | `ridge_wolf` | minion | 0 | 1 | hero | 30 atk, 50 hp, 3 mov, rng 1, skirmisher | — | none | Feral | setup only | Feral. Hunts whatever is closest, on either side. Anyone may put it down. |

### `threats.ts`

Enemy warband bodies. — **3 cards** (3 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Marrow-Hound** | `marrow_hound` | minion | 0 | 1 | hero | 30 atk, 30 hp, 4 mov, rng 1, skirmisher | hunts weakest | empty tile (ownTerritory) | Feral, Haste | setup only | Feral. Haste. Smells blood and goes for it — the most wounded thing on the board, whoever it belongs to. Anyone may put it down. |
| **Plague-Bearer** | `plague_bearer` | minion | 0 | 1 | hero | 10 atk, 80 hp, 2 mov, rng 1, bruiser | onHit toxin 1 | empty tile (ownTerritory) | — | setup only | Every blow it lands leaves 1 Toxin, which ticks through Armor. It hits for almost nothing and is worth killing anyway. |
| **Scrap-Titan** | `scrap_titan` | minion | 0 | 3 | hero | 50 atk, 250 hp, 1 mov, rng 1, behemoth, **2x2** | trail rubble; escalate +10/+20 | empty tile (ownTerritory, 2x2) | Growth | setup only | A walking scrapyard. Grinds every tile it leaves into rubble, and never stops growing. It cannot cross its own wreckage. |

### `hybrid.ts`

Splice products. Obtainable only at the bench. — **24 cards** (23 spell, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Aetheric Overload** | `aetheric_overload` | spell | 0 | 1 | companion | — | — | entity (ally, has charged) — range 4 | — | splice only | Spends a Charged allied unit whole. You are paid 3 Bones. |
| **Bone Bastion** | `bone_bastion` | spell | 1P | 1 | companion | — | — | entity (ally, unexhausted) — range 4 | — | splice only | Bleed an un-exhausted friendly minion for 30: extracts 1 Marrow and plates your Pact with Persistent Armor equal to the health taken. |
| **Icebreaker** | `icebreaker` | spell | 1P | 1 | companion | — | — | adjacent enemy — range 1 | — | splice only, R2 | A 30 damage blow to an adjacent enemy. Against a Frozen one this Shatters: all of its Armor is stripped and everything beside it takes 40. |
| **Black Ice** | `black_ice` | spell | 2P | 2 | companion | — | — | entity (enemy, has freeze) — range 4, LoS | — | splice only, R2 | Can only be aimed at a Frozen unit. Deals 40 damage through any armor, and everything adjacent takes Chill 2. |
| **Blight Siphon** | `blight_siphon` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only | Against a target carrying 2 or more Toxin, deals 50 damage through any armor and returns 30 health to your Pact. Otherwise only 20. |
| **Iron Briar** | `iron_briar` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | splice only | Raises a 50 HP Briar Rampart on an empty tile and roots everything orthogonally beside it, poisoning them (Toxin 1). |
| **Kinetic Arc** | `kinetic_arc` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | splice only | Shoves the target 2 tiles. If it slams into something, the impact discharges for 30 shock damage all around it — and shock leaves everything it touches Charged. |
| **Livewire Snare** | `livewire_snare` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Roots the target in place (Entangle 1), leaves it Charged, and deals 20 shock damage. |
| **Magma Shove** | `magma_shove` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | splice only | Shoves the target 2 tiles and leaves every tile it crossed burning for 2 turns. Anything starting a turn on burning ground catches fire. |
| **Permafrost** | `permafrost` | spell | 2P | 2 | companion | — | — | entity (enemy, has chill) — range 4, LoS | — | splice only, R2 | Can only be aimed at a Chilled unit. Deals 20 frost damage, roots it in place, and applies 2 Toxin that ticks through Armor. |
| **Rot Bloom** | `rot_bloom` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Deals 30 decay damage to the target and poisons everything orthogonally beside it (Toxin 2). |
| **Superconductor** | `superconductor` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Deals 30 frost damage and applies Chill 2. Against a Charged target this Superconducts: all Armor stripped, and it is left Brittle. |
| **Thermal Eruption** | `thermal_eruption` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Chills the target, then deals 30 fire damage — which flash-boils it, fogging the tile. A Frozen target is also set alight (Burn 2). |
| **Aetheric Defibrillator** | `aetheric_defibrillator` | spell | 3P | 2 | companion | — | — | entity (ally, unexhausted) — range 4 | — | splice only | Consume an un-exhausted friendly minion. A Galvanic Revenant stands up on the same tile, ready to move and strike this turn. |
| **Cryo-Combustion** | `cryo_combustion` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Deals 20 impact damage, then sets the target alight for 2 Burn. A Frozen target Shatters first and loses all Armor. A Chilled one Vaporizes when the fire next bites, on its own turn. |
| **Funeral Pyre** | `funeral_pyre` | spell | 3P | 2 | companion | — | — | line 3 — range 4, LoS | — | splice only, R2 | Deals 40 fire damage in a 3-tile line. If anything on the line was already Burning, your Pact takes 30 health back. |
| **Galvanic Spores** | `galvanic_spores` | spell | 2P+1M | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | splice only | Everything orthogonally beside the target tile is left Charged and takes 1 Toxin. Fire Overloads or ignites it; frost Superconducts. |
| **Killing Frost** | `killing_frost` | spell | 3P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | splice only, R2 | Deals 20 frost damage in a 2x2 block. Anything poisoned there freezes solid. |
| **Overload Strike** | `overload_strike` | spell | 2P+1M | 2 | companion | — | — | entity (enemy, +obstacles) — range 3, LoS | — | splice only, R2 | Charge the target, then set it alight: 20 shock damage, then 20 fire damage, and the arc jumps. |
| **Plasma Arc** | `plasma_arc` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only | Consumes 2 Burn on the target for 50 shock damage, earthing 30 more into everything adjacent. Without the fire, only 20. |
| **Scorched Earth** | `scorched_earth` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | splice only, R2 | Poisons the 3x3 around the target (Toxin 1), then sets it alight for 30 fire damage — igniting every Toxin stack it carries for 20 more each to everything adjacent. |
| **Soulfire** | `soulfire` | spell | 2P+1M | 2 | companion | — | — | entity (enemy, has burn) — range 4, LoS | — | splice only, R2 | Can only be aimed at a Burning unit. Consumes the fire on it for 50 fire damage, and 20 to everything adjacent. |
| **Vaporize Blast** | `vaporize_blast` | spell | 2P+1M | 2 | companion | — | — | entity (enemy, +obstacles) — range 4, LoS | — | splice only, R2 | Chill the target, then boil it: 10 frost damage, then 30 fire damage. The steam blinds what is left. |
| **Bramble Dolmen** | `bramble_dolmen` | obstacle | 3P | 2 | companion | 70 hp | turn start toxin 1; leaves rubble | empty tile (any) — range 3, LoS | — | splice only, R2 | Raises a 70 HP thorn-grown stone on an empty tile. At the start of each enemy turn, everything beside it is poisoned (Toxin 1). |

### `auras.ts`

The Aura attach cards, their Detonations and Revival. — **13 cards** (11 spell, 2 ability).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Marrow Burst** | `marrow_burst` | spell | 0 | 1 | hero | — | — | entity (ally, aura climax) | — | — | Spends a Climaxed Aura for 4 Marrow. Use it this turn or lose it. |
| **Cataclysm** | `cataclysm` | spell | 1P | 1 | hero | — | — | entity (ally, aura climax) | — | R2 | Spends a Climaxed Aura. Everything around the host takes 50 fire. |
| **Marrow Siphon** | `marrow_siphon` | spell | 1P | 1 | hero | — | — | entity (ally) | — | — | Opens an ally to the dark. Each turn it bleeds 10 and yields 1 Marrow. It does not stop. At Climax its wounds fester: whatever it hurts is left Brittle. |
| **Verdant Collapse** | `verdant_collapse` | spell | 1P | 1 | hero | — | — | entity (ally, aura climax) | — | R2 | Spends a Climaxed Aura. The growth goes back into the Pact — heal 80. |
| **Ember Coat** | `ember_coat` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Wraps an ally in fire. +20 ATK per stack, to two. At Climax it burns what it strikes, and the ground it leaves. |
| **Petrifying Mantle** | `petrifying_mantle` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Sets an ally in stone. +20 Persistent Armor per stack, to two. At Climax nothing shoves it. |
| **Rime Shell** | `rime_shell` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Plates an ally in ice. +20 Max HP and +10 Armor per stack, to two. At Climax it re-forms. |
| **Static Charge** | `static_charge` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Charges an ally. +1 MOV per stack, to two. At Climax it stops going around things. |
| **Verdant Swell** | `verdant_swell` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Roots an ally deeper. +40 Max HP per stack, to two. At Climax it drinks what it wounds, and bursts with Toxin when it dies. |
| **Written Path** | `written_path` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Writes an ally a road. +1 MOV per stack, to two. At Climax it steps to anywhere it sees. |
| **The Blood & Bone Rally** | `blood_and_bone_rally` | spell | 3M | 2 | hero | — | — | fallen (startingZone) | — | R2 | Costs 3 Marrow, which no bank of Bones will cover. Raises a fallen Vanguard in your starting zone at 10 health, wearing Persistent Armor equal to everything it lost. |
| **Aetheric Resurgence** | `aetheric_resurgence` | ability | X (max 5) | 1 | hero | — | — | fallen (pyre) | — | — | X Bones, up to 5. Raises a fallen Vanguard on the exact tile it fell, at 20% of its health per Bone spent. Nothing may be standing there. |
| **The Anchor Rally** | `anchor_rally` | ability | 3P | 2 | hero | — | — | fallen (anchor) | — | — | Raises a fallen Vanguard on an Anchor Tile at half health, quickened: +1 MOV this turn. |

### `hero.ts`

The Hero's kit: colourless and arcane abilities and constructs, taught by the Duelists. — **22 cards** (17 ability, 5 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Cut Loose** | `cut_loose` | ability | 0 | 1 | hero | — | — | entity (ally) | — | — | Frees a friendly unit from Entangle and grants it +1 MOV this turn. |
| **Forced March** | `forced_march` | ability | 0 | 1 | hero | — | — | entity (ally) | — | — | Grants a friendly unit +2 MOV this turn. |
| **Supply Run** | `supply_run` | ability | 0 | 1 | hero | — | — | none | — | — | Gain 1 Bone and draw 1 card. |
| **Bola** | `bola` | ability | 1P | 1 | hero | — | — | entity (enemy) | — | R2 | Deals 10 damage to an enemy and Entangles it: it cannot move through its next turn. |
| **Cleansing Rune** | `cleansing_rune` | ability | 1P | 1 | hero | — | — | entity (ally) | — | — | Strips Burn, Toxin, Chill, Freeze, Entangle and Stun from a friendly unit. |
| **Field Dressing** | `field_dressing` | ability | 1P | 1 | hero | — | — | none | — | R2 | Restores 40 health to your Pact. |
| **Mana Bolt** | `mana_bolt` | ability | 1P | 1 | hero | — | — | entity (enemy) | — | R2 | Deals 30 spell damage to an enemy. |
| **Scatter Debris** | `scatter_debris` | ability | 1P | 1 | hero | — | — | empty tile (any, 2x2) | — | — | Strews rubble over a 2x2 block of tiles for 3 turns. Crossing it costs extra movement. |
| **Second Wind** | `second_wind` | ability | 1P | 1 | hero | — | — | ally unit or portrait | — | R2 | Grants a friendly unit or your Hero 20 Persistent Armor. Draw 1 card. |
| **Aether Lance** | `aether_lance` | ability | 2P | 2 | hero | — | — | entity (enemy) | — | R2 | Deals 20 spell damage to an enemy and everything in a cross around it, yours included. |
| **Brace and Heave** | `brace_and_heave` | ability | 2P | 2 | hero | — | — | entity (ally) | — | — | Everything adjacent to a friendly unit is shoved 1 tile away from it. Triggers standard Collision Damage (30 / 20). |
| **Pike Thrust** | `pike_thrust` | ability | 2P | 2 | hero | — | — | line 2 | — | R2 | Deals 30 damage to everything on a 2-tile line, yours included. |
| **Quick Study** | `quick_study` | ability | 2P | 2 | hero | — | — | none | — | — | Draw 2 cards. |
| **Siphon Bolt** | `siphon_bolt` | ability | 2P | 2 | hero | — | — | entity (enemy) | — | R2 | Deals 20 spell damage to an enemy and restores 20 health to your Pact. |
| **Sledgehammer** | `sledgehammer` | ability | 2P | 2 | hero | — | — | entity (any, +obstacles) | — | R2 | Deals 40 damage to a unit or obstacle. |
| **Weighted Net** | `weighted_net` | ability | 2P | 2 | hero | — | — | entity (enemy) | — | — | Entangles an enemy and every unit in a cross around it, yours included, through their next turn. |
| **Stasis Glyph** | `stasis_glyph` | ability | 3P | 2 | hero | — | — | entity (enemy) | — | — | Stuns an enemy: it cannot move or attack through its next turn. |
| **Sandbag Wall** | `sandbag_wall` | obstacle | 0 | 1 | hero | 30 hp, cover | — | empty tile (any) | — | R2 | Raises 30 HP of cover on an empty tile. Blocks line of sight but not movement. |
| **Supply Crate** | `supply_crate` | obstacle | 1P | 1 | hero | 30 hp | breaks for 2M | empty tile (any) | — | R2 | Raises a 30 HP crate on an empty tile. Whoever breaks it takes 2 Marrow. |
| **Tar Barrel** | `tar_barrel` | obstacle | 1P | 1 | hero | 30 hp | on break entangle 1 | empty tile (any) | — | R2 | Raises a 30 HP barrel of pitch. When it breaks, every unit on or beside it is Entangled. |
| **Timber Palisade** | `timber_palisade` | obstacle | 3P | 2 | hero | 120 hp | leaves rubble | empty tile (any) | — | R2 | Raises a 120 HP palisade on an empty tile. Blocks line of sight, and leaves rubble when it breaks. |
| **Warding Obelisk** | `warding_obelisk` | obstacle | 3P | 2 | hero | 60 hp | turn start entangle 1; leaves rubble | empty tile (any) | — | R2 | Raises a 60 HP obelisk on an empty tile. Enemies in its row start each turn Entangled while it stands. |

### `shelf.pyre.ts`

Pyre third shelf — commons, and the Drake and Salamander signatures. — **22 cards** (21 spell, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Kindling** | `kindling` | spell | 0 | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Sets a unit alight (Burn 1). |
| **Burrow Strike** | `burrow_strike` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 fire damage to an adjacent enemy and sets it alight (Burn 1). |
| **Drake's Brand** | `drakes_brand` | spell | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | R2 | Deals 10 fire damage to a unit or obstacle and brands it with a Cinder Mark. |
| **Scorch** | `scorch` | spell | 1P | 1 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | R2 | Deals 20 fire damage to a unit or obstacle. |
| **Smoulder** | `smoulder` | spell | 1P | 1 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Sets the ground burning in a cross around the target tile for 2 turns. Anything starting its turn there catches fire. |
| **Wingbeat Embers** | `wingbeat_embers` | spell | 1P | 1 | companion | — | — | line 3 — range 4, LoS | — | — | Fans embers down a 3-tile line, setting everything on it alight (Burn 1). No damage. |
| **Ash Rebirth** | `ash_rebirth` | spell | 2P | 2 | companion | — | — | fallen (pyre) | — | — | Raises a fallen Vanguard on the exact tile it fell, at 40% of its health. Nothing may be standing there. |
| **Backburn** | `backburn` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 10 fire damage down a 3-tile line and leaves it burning for 2 turns. |
| **Cinderback Bristle** | `cinderback_bristle` | spell | 2P | 2 | companion | — | — | none — range 1 | — | R2 | Deals 20 fire damage to everything adjacent to the caster, yours included. |
| **Drake's Roar** | `drakes_roar` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Sets every unit in a wide cross around the target tile alight (Burn 1), two tiles out each way. |
| **Ductwork Drag** | `ductwork_drag` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | — | Drags everything on a 3-tile line 1 tile toward its near end and sets it alight (Burn 1). |
| **Fire Breath** | `fire_breath` | spell | 2P | 2 | companion | — | — | line 2 — range 2, LoS | — | R2 | Deals 20 fire damage in a 2-deep cone and sets everything caught alight (Burn 1). |
| **Flashover** | `flashover` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a Burning unit, deals 30 fire damage to it and everything in a cross around it. Otherwise only 10. |
| **Lampblack** | `lampblack` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 decay damage to a unit and sets it alight (Burn 1). |
| **Molten Shot** | `molten_shot` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 5, LoS | — | R2 | Deals 30 fire damage to a unit. |
| **Phoenix Dive** | `phoenix_dive` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 30 fire damage to a unit and sets everything adjacent to it alight (Burn 1). |
| **Smoke Sett** | `smoke_sett` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Fills a 2x2 block with smoke for 2 turns, blocking ranged line of sight, and sets everything there alight (Burn 1). |
| **Twin Breath** | `twin_breath` | spell | 2P | 2 | companion | — | — | line 2 — range 2, LoS | — | R2 | Deals 20 fire damage in a 2-deep cone and Chills everything caught. |
| **Wildfire** | `wildfire` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Sets every unit in a 3x3 around the target tile alight (Burn 1), yours included. No damage. |
| **Ember Cascade** | `ember_cascade` | spell | 3P | 2 | companion | — | — | global | — | — | Sets off every Mark on the board at once. |
| **Immolate** | `immolate` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Deals 40 fire damage to a unit, or 60 if it is already Burning. |
| **Brazier** | `brazier` | obstacle | 1P | 1 | companion | 30 hp, cover | on break 20 dmg + burn 1 | empty tile (any) — range 3, LoS | — | R2 | Raises 30 HP of cover on an empty tile. When it breaks it spills its coals: 20 damage and Burn 1 to every unit on or beside it. |

### `shelf.frost.ts`

Frost third shelf — commons, and the Bear and Seal signatures. — **22 cards** (20 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **White Dash** | `white_dash` | spell | 0 | 1 | companion | — | — | entity (ally) — range 4 | — | — | An ally moves 1 further this turn. |
| **Ermine Bite** | `ermine_bite` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 frost damage to an adjacent enemy and applies Brittle 1. A Brittle target takes +20 damage from every hit. |
| **Frostbite** | `frostbite` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 10 frost damage to a unit and applies Brittle 1. A Brittle target takes +20 damage from every hit. |
| **Hoar Glaze** | `hoar_glaze` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Grants an ally 20 Armor and Chills everything orthogonally beside it, yours included. |
| **Sea Fog** | `sea_fog` | spell | 1P | 1 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Fogs a 2x2 block of tiles for 2 turns, blocking ranged line of sight through them. |
| **Woolly Hide** | `woolly_hide` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 30 Armor. |
| **Cold Front** | `cold_front` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | — | Shoves everything on a 3-tile line 1 tile away from its near end and Chills it. Triggers standard Collision Damage (30 / 20). |
| **Frostgrave Gaze** | `frostgrave_gaze` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 decay damage to a unit and Chills it. |
| **Frozen Ambush** | `frozen_ambush` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Deals 40 frost damage to a Chilled unit, or 20 to anything else. |
| **Hoarthorn** | `hoarthorn` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 20 physical damage to a unit, Chills it and poisons it (Toxin 1). |
| **Icebreaker Dive** | `icebreaker_dive` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Against a Frozen unit, deals 40 impact damage and shoves it 1 tile away. Otherwise, 20 frost damage. |
| **Numbing Roar** | `numbing_roar` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 10 frost damage to an enemy and everything in a cross around it, and Chills them all. |
| **Permafrost Stomp** | `permafrost_stomp` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | — | Applies Chill 2 to everything in a cross around the target tile. The third stack freezes a unit solid. |
| **Scalding Splash** | `scalding_splash` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 20 fire damage to a unit, Chills it, and wreathes its tile in steam for 1 turn. |
| **Sleet** | `sleet` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Deals 10 frost damage to a 2x2 block of tiles and Chills everything there. |
| **Static Frost** | `static_frost` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 frost damage to a unit and leaves it Charged. Frost into a Charged target Superconducts. |
| **Tidal Floe** | `tidal_floe` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | — | Turns a 2x2 block of tiles into a drifting current for 2 turns and Chills everything there. The current carries what stands on it 1 tile each round. |
| **Glacial Maul** | `glacial_maul` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 2, LoS | — | R2 | Deals 40 frost damage to a unit and applies Chill 2. The third stack freezes it solid. |
| **Icicle Rain** | `icicle_rain` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 20 frost damage in a cross around the target tile and Chills everything there. |
| **Mammoth Trample** | `mammoth_trample` | spell | 3P | 2 | companion | — | — | line 3 — range 3, LoS | — | R2 | Tramples a 3-tile line for 30 impact damage. Shatters anything Frozen. |
| **Snowdrift** | `snowdrift` | obstacle | 1P | 1 | companion | 30 hp, cover | on break chill 1 | empty tile (any) — range 3, LoS | — | R2 | Raises 30 HP of cover on an empty tile. When it breaks, every unit on or beside it is Chilled. |
| **Den of Ice** | `den_of_ice` | obstacle | 3P | 2 | companion | 80 hp | on break freeze 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises an 80 HP wall of ice on an empty tile. When it breaks, every unit on or beside it is Frozen. |

### `shelf.surge.ts`

Surge third shelf — commons, and the Lynx and Kudu signatures. — **21 cards** (19 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Spark** | `spark` | spell | 0 | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 10 shock damage to a unit, leaving it Charged. |
| **Static Bristle** | `static_bristle` | spell | 0 | 1 | companion | — | — | none — range 1 | — | — | Leaves everything adjacent to the caster Charged. No damage. |
| **Crackle Chase** | `crackle_chase` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | An ally moves 1 further this turn, and everything adjacent to it is left Charged. |
| **Eel Jolt** | `eel_jolt` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 2, LoS | — | R2 | Deals 20 shock damage to a unit, leaving it Charged. |
| **Haunting Charge** | `haunting_charge` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 10 decay damage to a unit and leaves it Charged. |
| **Scale Shed** | `scale_shed` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 20 Armor, and leaves everything adjacent to it Charged. |
| **Short Circuit** | `short_circuit` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Against a Charged unit, deals 30 damage through any armor. Otherwise, 10 shock damage. |
| **Static Curl** | `static_curl` | spell | 1P | 1 | companion | — | — | none — range 1 | — | R2 | Your Hero gains 20 Armor, and everything adjacent to the caster is left Charged. |
| **Static Insight** | `static_insight` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 10 shock damage to a unit, leaving it Charged. Draw 1 card. |
| **Ball Roll** | `ball_roll` | spell | 2P | 2 | companion | — | — | line 3 — range 3, LoS | — | R2 | Deals 20 shock damage down a 3-tile line and shoves everything on it 1 tile away from its near end. Triggers standard Collision Damage (30 / 20). |
| **Canal Current** | `canal_current` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Turns a 2x2 block into a live current for 2 turns and deals 10 shock damage there. The current carries what stands on it 1 tile each round. |
| **Eel Coil** | `eel_coil` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 2, LoS | — | R2 | Deals 10 shock damage to a unit and Entangles it: it cannot move through its next turn. |
| **Lightning Dive** | `lightning_dive` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 30 shock damage to a unit and sets it alight (Burn 1). Fire into a Charged target Overloads. |
| **Lightning Draw** | `lightning_draw` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Drags everything within 2 tiles of an enemy 1 tile toward it, then deals 10 shock damage to everything adjacent to it. |
| **Static Field** | `static_field` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Leaves every unit in a 3x3 around the target tile Charged, yours included. No damage. |
| **Storm Pounce** | `storm_pounce` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Deals 40 shock damage to a Charged unit, or 20 to anything else. |
| **Swarm Sting** | `swarm_sting` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 10 shock damage to a unit and sets it alight (Burn 1). Fire into a Charged target Overloads. |
| **Thunderclap** | `thunderclap` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 3, LoS | — | R2 | Deals 10 shock damage to everything adjacent to the target tile and shoves it 1 tile away. Triggers standard Collision Damage (30 / 20). |
| **Ball Lightning** | `ball_lightning` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 30 shock damage in a cross around the target tile, leaving every survivor Charged. |
| **Capacitor Bank** | `capacitor_bank` | obstacle | 1P | 1 | companion | 30 hp | on break 20 dmg + stun 1 | empty tile (any) — range 3, LoS | — | R2 | Raises a 30 HP capacitor bank on an empty tile. When it breaks it discharges: 20 damage and Stun to every unit on or beside it. |
| **Storm Spire** | `storm_spire` | obstacle | 3P | 2 | companion | 60 hp | on break 40 dmg + charged 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 60 HP spire on an empty tile. When it breaks it earths out: 40 damage to every unit on or beside it, leaving them Charged. |

### `shelf.bulwark.ts`

Bulwark third shelf — commons, and the Boar and Ram signatures. — **23 cards** (20 spell, 3 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Hardened Shell** | `hardened_shell` | spell | 1P | 1 | companion | — | — | none | — | R2 | Your Hero gains 20 Armor. Draw 1 card. |
| **Headbutt** | `headbutt` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 impact damage to an adjacent enemy and shoves it 1 tile away. Triggers standard Collision Damage (30 / 20). |
| **Iron Brace** | `iron_brace` | spell | 1P | 1 | companion | — | — | none | — | R2 | Your Hero gains 30 Armor. |
| **Steady Footing** | `steady_footing` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 20 Armor. Draw 1 card. |
| **Tusk Toss** | `tusk_toss` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | — | Throws an adjacent enemy 2 tiles away. Triggers standard Collision Damage (30 / 20). |
| **Boar Charge** | `boar_charge` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 30 impact damage to a unit and shoves it 2 tiles away. Triggers standard Collision Damage (30 / 20). |
| **Bone Bulwark** | `bone_bulwark` | spell | 2P | 2 | companion | — | — | entity (ally) — range 4 | — | R2 | Grants an ally 20 Armor, and leaves everything adjacent to it poisoned (Toxin 1). |
| **Dung Ball** | `dung_ball` | spell | 2P | 2 | companion | — | — | entity (any, +obstacles) — range 4, LoS | — | R2 | Deals 30 impact damage to a unit or obstacle. |
| **Fault Line** | `fault_line` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 impact damage down a 3-tile line and shoves everything on it 1 tile away from its near end. Triggers standard Collision Damage (30 / 20). |
| **Ground Breaker** | `ground_breaker` | spell | 2P | 2 | companion | — | — | entity (any, +obstacles) — range 3, LoS | — | R2 | Deals 30 impact damage to a unit or obstacle and leaves rough ground in a cross around it for 3 turns. |
| **Horn Gore** | `horn_gore` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 40 impact damage to an adjacent enemy. Shatters anything Frozen. |
| **Magma Shell** | `magma_shell` | spell | 2P | 2 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 30 Armor, and sets everything adjacent to it alight (Burn 1). |
| **Magnet Pull** | `magnet_pull` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Drags everything within 2 tiles of the target tile 1 tile toward it, then leaves everything in a cross around it Charged. |
| **Ossuary Maul** | `ossuary_maul` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 30 impact damage to an adjacent enemy and poisons it (Toxin 1). |
| **Rockslide Run** | `rockslide_run` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | — | Shoves everything on a 3-tile line 2 tiles away from its near end. Triggers standard Collision Damage (30 / 20). |
| **Stone Lance** | `stone_lance` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 5, LoS | — | — | Deals 30 impact damage to a unit, or 50 if it is Brittle. |
| **Crushing Charge** | `crushing_charge` | spell | 3P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 30 impact damage down a 3-tile line and shoves everything on it 1 tile away from its near end. Triggers standard Collision Damage (30 / 20). |
| **Glacier Ram** | `glacier_ram` | spell | 3P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 impact damage down a 3-tile line and Chills everything on it. |
| **Landslide** | `landslide` | spell | 3P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 impact damage in a widening 3-deep cone and shoves everything caught 1 tile away. Triggers standard Collision Damage (30 / 20). |
| **Rockfall** | `rockfall` | spell | 3P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Drops 30 impact damage on a 2x2 block of tiles. Shatters anything Frozen. |
| **Rubble Wall** | `rubble_wall` | obstacle | 1P | 1 | companion | 50 hp | leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 50 HP wall of rubble on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks. |
| **Standing Stone** | `standing_stone` | obstacle | 3P | 2 | companion | 100 hp | on break 20 dmg + stun 1; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 100 HP standing stone on an empty tile. When it falls, every unit on or beside it takes 20 damage and is Stunned. |
| **Vault Door** | `vault_door` | obstacle | 3P | 2 | companion | 120 hp | leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 120 HP vault door on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks. |

### `shelf.dusk.ts`

Dusk third shelf — commons, and the Stag and Jackal signatures. — **19 cards** (17 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Carrion Feast** | `carrion_feast` | spell | 1P | 1 | companion | — | — | entity (ally, unexhausted) — range 4 | — | R2 | Bleed an un-exhausted friendly minion for 20: extracts 2 Marrow and restores 20 health to your Pact. |
| **Gloom Bolt** | `gloom_bolt` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 5, LoS | — | R2 | Deals 20 decay damage to a unit. |
| **Offering** | `offering` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | Spends an allied unit whole. Gain 3 Bones. |
| **Rot Bite** | `rot_bite` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 decay damage to an adjacent enemy and poisons it (Toxin 1). |
| **Shadowstep** | `shadowstep` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | An ally moves 2 further this turn. |
| **Silent Talon** | `silent_talon` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 decay damage to a unit. |
| **Venom Bite** | `venom_bite` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 decay damage to an adjacent enemy and poisons it (Toxin 2). |
| **Barrow Chill** | `barrow_chill` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 decay damage to a unit and Chills it and everything in a cross around it. |
| **Barrow Howl** | `barrow_howl` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 10 decay damage to every unit in a 3x3 around the target tile and poisons them (Toxin 1), yours included. |
| **Moonless Night** | `moonless_night` | spell | 2P | 2 | companion | — | — | empty tile (any, 2x2) — range 4, LoS | — | R2 | Darkens a 2x2 block for 2 turns, blocking ranged line of sight, and deals 10 decay damage to everything there. |
| **Owl Omen** | `owl_omen` | spell | 2P | 2 | companion | — | — | none | — | — | Draw 2 cards. The Owl has already seen them coming. |
| **Plague Wind** | `plague_wind` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 10 decay damage in a widening 3-deep cone and poisons everything caught (Toxin 1). |
| **Shallow Grave** | `shallow_grave` | spell | 2P | 2 | companion | — | — | fallen (anchor) | — | — | Raises a fallen Vanguard on an Anchor Tile at 30% of its health. |
| **Soul Toll** | `soul_toll` | spell | 2P | 2 | companion | — | — | global | — | R2 | Deals 30 damage through any armor to the weakest enemy standing. |
| **Web Snare** | `web_snare` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Webs a unit for its next two turns (Entangle 2). A webbed unit can still attack. |
| **Dread Gaze** | `dread_gaze` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Exhausts an enemy: it cannot move, strike or channel through its next turn. |
| **Soul Rend** | `soul_rend` | spell | 3P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 40 decay damage to a unit and restores 20 health to your Pact. |
| **Brood Sac** | `brood_sac` | obstacle | 2P | 2 | companion | 40 hp | on break 10 dmg + toxin 2 | empty tile (any) — range 3, LoS | — | R2 | Raises a 40 HP egg sac on an empty tile. When it breaks, every unit on or beside it takes 10 damage and is poisoned (Toxin 2). |
| **Ossuary Wall** | `ossuary_wall` | obstacle | 2P | 2 | companion | 60 hp | leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 60 HP wall of bone on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks. |

### `shelf.bloom.ts`

Bloom third shelf — commons, and the Warden and Aurochs signatures. — **23 cards** (21 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Nettle** | `nettle` | spell | 0 | 1 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Poisons a unit (Toxin 1). |
| **Bark Skin** | `bark_skin` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | R2 | Gives an ally 30 Armor. It takes root: Entangled until the end of your turn. |
| **Briar Bite** | `briar_bite` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 physical damage to an adjacent enemy and poisons it (Toxin 1). |
| **Dusting Wings** | `dusting_wings` | spell | 1P | 1 | companion | — | — | none — range 1 | — | — | Poisons everything adjacent to the caster (Toxin 1), yours included. |
| **Mossback Pinch** | `mossback_pinch` | spell | 1P | 1 | companion | — | — | entity (enemy) — range 1 | — | R2 | Deals 20 impact damage to an adjacent enemy and roots it through its next turn (Entangle 1). |
| **Ruminate** | `ruminate` | spell | 1P | 1 | companion | — | — | none | — | R2 | Restores 20 health to your Pact. Draw 1 card. |
| **Sly Retreat** | `sly_retreat` | spell | 1P | 1 | companion | — | — | entity (ally) — range 4 | — | — | An ally moves 2 further this turn. |
| **Bramble Lash** | `bramble_lash` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 20 physical damage to a unit and poisons it and everything in a cross around it (Toxin 1). |
| **Bramble Pounce** | `bramble_pounce` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | — | Deals 50 physical damage to an Entangled unit, or 30 to anything else. |
| **Ember Bark** | `ember_bark` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 20 physical damage to a unit, sets it alight (Burn 1) and poisons it (Toxin 1). |
| **Fallow Cloud** | `fallow_cloud` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Poisons every unit in a 3x3 around the target tile (Toxin 1), yours included. No damage. |
| **Fen Strike** | `fen_strike` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Deals 20 decay damage to a unit and poisons it (Toxin 2). |
| **Leech Vine** | `leech_vine` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 20 toxic damage to a unit and restores 20 health to your Pact. |
| **Live Briar** | `live_briar` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Roots a unit through its next turn (Entangle 1) and deals 10 shock damage to it, leaving it Charged. |
| **Moss Stampede** | `moss_stampede` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | — | Shoves everything on a 3-tile line 1 tile away from its near end and poisons it (Toxin 1). Triggers standard Collision Damage (30 / 20). |
| **Pollen Burst** | `pollen_burst` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 10 toxic damage to everything in a cross around the target tile and poisons it (Toxin 1). |
| **Rootbind** | `rootbind` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | — | Roots a unit for its next two turns (Entangle 2) and poisons it (Toxin 1). A rooted unit can still attack. |
| **Rotcap Bloom** | `rotcap_bloom` | spell | 2P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 10 decay damage to everything in a cross around the target tile and poisons it (Toxin 2). |
| **Thorn Volley** | `thorn_volley` | spell | 2P | 2 | companion | — | — | line 3 — range 4, LoS | — | R2 | Deals 20 physical damage down a 3-tile line and poisons everything on it (Toxin 1). |
| **Moth Swarm** | `moth_swarm` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Deals 10 toxic damage to every unit in a 3x3 around the target tile and poisons them (Toxin 1), yours included. |
| **Rot Spores** | `rot_spores` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | — | Poisons every unit in a wide cross around the target tile, two tiles out each way (Toxin 2), yours included. |
| **Seed Pod** | `seed_pod` | obstacle | 1P | 1 | companion | 30 hp | on break toxin 2 | empty tile (any) — range 3, LoS | — | R2 | Raises a 30 HP seed pod on an empty tile. When it breaks, every unit on or beside it is poisoned (Toxin 2). |
| **Warden Tree** | `warden_tree` | obstacle | 3P | 2 | companion | 90 hp | on break 20 dmg + toxin 2; leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises a 90 HP tree on an empty tile. When it falls it bursts: 20 damage and Toxin 2 to every unit on or beside it. |

### `vanguard.ts`

The third muster — thirty-six bodies a warband can field, four per school and twelve colourless. — **36 cards** (36 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Arcane Familiar** | `arcane_familiar` | minion | 2P | 2 | hero | 10 atk, 30 hp, 3 mov, rng 1, caster | dmg spell; refund 1P on attack | empty tile (ownTerritory) | — | — | Its touch is spell damage. Refunds 1 Bone each time it attacks. |
| **Bone Rattler** | `bone_rattler` | minion | 2P | 2 | hero | 20 atk, 30 hp, 3 mov, rng 1, skirmisher | refund 1P on death | empty tile (ownTerritory) | — | — | Quick and thin. Refunds 1 Bone when it dies — including bled dry by a tithe. |
| **Frost Wisp** | `frost_wisp` | minion | 2P | 2 | hero | 10 atk, 30 hp, 3 mov, rng 1, caster | dmg frost; onHit chill 1 | empty tile (ownTerritory) | — | — | Whatever survives its touch takes Chill 1. The third stack freezes a unit solid. |
| **Kiln Guard** | `kiln_guard` | minion | 2P | 2 | hero | 20 atk, 60 hp, 2 mov, rng 1, bruiser | onHit burn 1 | empty tile (ownTerritory) | Guardian | — | Guardian: blocks line of sight behind it. Whatever survives its blows catches fire (Burn 1). |
| **Militia Pikeman** | `militia_pikeman` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Counter | — | Counter: strikes back for its full Attack whenever it is hit in melee and survives. |
| **Ramming Goat** | `ramming_goat` | minion | 2P | 2 | hero | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | dmg impact | empty tile (ownTerritory) | — | — | Its blows are impact, which shatters anything Frozen. Quick on its feet for a Bulwark body. |
| **Rampart Mason** | `rampart_mason` | minion | 2P | 2 | hero | 10 atk, 70 hp, 1 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian, Counter | — | Guardian and Counter: blocks line of sight behind it, and strikes back when hit in melee. |
| **Road Scout** | `road_scout` | minion | 2P | 2 | hero | 10 atk, 30 hp, 4 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | — | Haste. Fast and fragile: four tiles a turn. |
| **Rune Golem** | `rune_golem` | minion | 2P | 2 | hero | 20 atk, 60 hp, 1 mov, rng 1, bruiser | dmg spell | empty tile (ownTerritory) | Guardian | — | Guardian: blocks line of sight behind it. Its blows are spell damage. |
| **Salamander Whelp** | `salamander_whelp` | minion | 2P | 2 | hero | 20 atk, 30 hp, 4 mov, rng 1, skirmisher | trail burning | empty tile (ownTerritory) | — | — | Every tile it walks off is left burning. Quick, and gone before the fire takes. |
| **Spark Imp** | `spark_imp` | minion | 2P | 2 | hero | 20 atk, 30 hp, 3 mov, rng 1, skirmisher | dmg shock | empty tile (ownTerritory) | Haste | — | Haste. Its bite is shock, so whatever survives it is left Charged. |
| **Spellblade** | `spellblade` | minion | 2P | 2 | hero | 30 atk, 30 hp, 3 mov, rng 1, skirmisher | dmg spell | empty tile (ownTerritory) | — | — | Its blows are spell damage, which sets off Cinder and Rime Marks. Thin, and quick. |
| **Thorn Sprout** | `thorn_sprout` | minion | 2P | 2 | hero | 10 atk, 50 hp, 1 mov, rng 1, bruiser | onHit toxin 1; escalate +10/+10 | empty tile (ownTerritory) | Growth | — | Growth. Whatever survives its thorns is poisoned (Toxin 1). |
| **War Dog** | `war_dog` | minion | 2P | 2 | hero | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | +20 vs entangle/stun | empty tile (ownTerritory) | — | — | Deals 20 more to anything Entangled or Stunned. It goes for whatever cannot run. |
| **Aether Archer** | `aether_archer` | minion | 3P | 2 | hero | 30 atk, 30 hp, 2 mov, rng 2-5, sniper | lineOnly; dmg spell | empty tile (ownTerritory) | — | — | Fires spell damage only along a rank, file or diagonal, 2 to 5 tiles. Cannot hit what is adjacent. |
| **Boulder Slinger** | `boulder_slinger` | minion | 3P | 2 | hero | 30 atk, 40 hp, 1 mov, rng 2-4, caster | arcing; dmg impact | empty tile (ownTerritory) | — | — | Throws 2 to 4 tiles over anything, needing no line of sight, for impact damage. Cannot hit what is adjacent. |
| **Coil Lancer** | `coil_lancer` | minion | 3P | 2 | hero | 30 atk, 40 hp, 2 mov, rng 2-3, caster | dmg shock | empty tile (ownTerritory) | — | — | Strikes 2 to 3 tiles away in shock, leaving what survives Charged. Cannot hit what is adjacent. |
| **Crossbowman** | `crossbowman` | minion | 3P | 2 | hero | 30 atk, 30 hp, 2 mov, rng 2-4, sniper | — | empty tile (ownTerritory) | — | — | Shoots 2 to 4 tiles. Cannot hit what is adjacent. |
| **Flame Archer** | `flame_archer` | minion | 3P | 2 | hero | 20 atk, 30 hp, 2 mov, rng 2-4, sniper | dmg fire; onHit burn 1 | empty tile (ownTerritory) | — | — | Shoots 2 to 4 tiles and sets what it hits alight (Burn 1). Cannot hit what is adjacent. |
| **Frost Ballista** | `frost_ballista` | minion | 3P | 2 | hero | 40 atk, 40 hp, 1 mov, rng 2-5, sniper | lineOnly; dmg frost | empty tile (ownTerritory) | — | — | Fires only along a rank, file or diagonal, 2 to 5 tiles. Cannot hit what is adjacent. |
| **Glyph Turret** | `glyph_turret` | minion | 3P | 2 | hero | 30 atk, 50 hp, 0 mov, rng 1-4, caster | arcing; dmg spell | empty tile (ownTerritory) | — | — | Cannot move. Throws spell damage 1 to 4 tiles over anything, needing no line of sight. |
| **Spore Archer** | `spore_archer` | minion | 3P | 2 | hero | 20 atk, 30 hp, 2 mov, rng 2-4, sniper | dmg toxic; onHit toxin 2 | empty tile (ownTerritory) | — | — | Shoots 2 to 4 tiles and poisons what it hits (Toxin 2). Cannot hit what is adjacent. |
| **Wight Archer** | `wight_archer` | minion | 3P | 2 | hero | 20 atk, 30 hp, 2 mov, rng 2-4, sniper | dmg decay; onHit toxin 1 | empty tile (ownTerritory) | — | — | Shoots 2 to 4 tiles in decay and poisons what it hits (Toxin 1). Cannot hit what is adjacent. |
| **Furnace Titan** | `furnace_titan` | minion | 4P | 3 | hero | 40 atk, 110 hp, 1 mov, rng 1, bruiser | deathburst burn 2 | empty tile (ownTerritory) | Counter | — | Counter. When it dies, every adjacent enemy catches fire (Burn 2). Weak to frost. |
| **Galvanic Brute** | `galvanic_brute` | minion | 4P | 3 | hero | 40 atk, 90 hp, 2 mov, rng 1, bruiser | dmg shock; refund 1P on death | empty tile (ownTerritory) | — | — | Its blows are shock, leaving what survives Charged. Refunds 1 Bone when it dies. Weak to impact. |
| **Grave Knight** | `grave_knight` | minion | 4P | 3 | hero | 40 atk, 100 hp, 2 mov, rng 1, bruiser | dmg decay; tithe +2M | empty tile (ownTerritory) | Counter | — | Counter. Its blows are decay. Yields 2 more Marrow when tithed. Weak to fire. |
| **Iron Juggernaut** | `iron_juggernaut` | minion | 4P | 3 | hero | 40 atk, 110 hp, 1 mov, rng 1, bruiser | dmg impact; +30 vs freeze; plates 10/turn | empty tile (ownTerritory) | — | — | Grows 10 Armor every turn. Deals 30 more to anything Frozen. Weak to shock. |
| **Oakheart Guardian** | `oakheart_guardian` | minion | 4P | 3 | hero | 30 atk, 120 hp, 1 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Guardian, Growth | — | Guardian and Growth: blocks line of sight behind it, and gets bigger every turn it stands. Weak to fire. |
| **Permafrost Troll** | `permafrost_troll` | minion | 4P | 3 | hero | 40 atk, 100 hp, 1 mov, rng 1, bruiser | onHit chill 1; plates 10/turn | empty tile (ownTerritory) | — | — | Grows 10 Armor of ice every turn. Whatever survives its blows takes Chill 1. Weak to fire. |
| **Sergeant-at-Arms** | `sergeant_at_arms` | minion | 4P | 3 | hero | 30 atk, 100 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian, Counter | — | Guardian and Counter: blocks line of sight behind it, and strikes back when hit in melee. |
| **Warden Construct** | `warden_construct` | minion | 4P | 3 | hero | 30 atk, 100 hp, 1 mov, rng 1, bruiser | plates 10/turn | empty tile (ownTerritory) | Guardian | — | Guardian. Grows 10 Armor every turn. Weak to impact. |
| **Battering Ram** | `battering_ram` | minion | 5P | 3 | hero | 50 atk, 120 hp, 1 mov, rng 1, behemoth, **2x2** | dmg impact | empty tile (ownTerritory, 2x2) | PowerTier | — | Power Tier. 2x2 Behemoth. Its blows are impact, which shatters anything Frozen. Cannot enter 1x1 gaps. |
| **Bone Colossus** | `bone_colossus` | minion | 5P | 3 | hero | 50 atk, 140 hp, 1 mov, rng 1, behemoth, **2x2** | +20 vs brittle | empty tile (ownTerritory, 2x2) | PowerTier | — | Power Tier. 2x2 Behemoth. Deals 20 more to anything Brittle. Cannot enter 1x1 gaps. |
| **Frost Colossus** | `frost_colossus` | minion | 5P | 3 | hero | 40 atk, 140 hp, 1 mov, rng 1, behemoth, **2x2** | onHit chill 1 | empty tile (ownTerritory, 2x2) | PowerTier | — | Power Tier. 2x2 Behemoth. Whatever survives its blows takes Chill 1. Cannot enter 1x1 gaps. |
| **Mossback Colossus** | `mossback_colossus` | minion | 5P | 3 | hero | 40 atk, 150 hp, 1 mov, rng 1, behemoth, **2x2** | deathburst toxin 3 | empty tile (ownTerritory, 2x2) | PowerTier | — | Power Tier. 2x2 Behemoth. When it dies, every adjacent enemy is poisoned (Toxin 3). Cannot enter 1x1 gaps. |
| **Tempest Engine** | `tempest_engine` | minion | 5P | 3 | hero | 40 atk, 130 hp, 1 mov, rng 1, behemoth, **2x2** | dmg shock; plates 10/turn | empty tile (ownTerritory, 2x2) | PowerTier | — | Power Tier. 2x2 Behemoth. Its blows are shock, leaving what survives Charged. Cannot enter 1x1 gaps. |

### `threats.dens.ts`

Den threats: the enemy-only bodies that guard the newer hybrids. — **10 cards** (10 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Barrow Wight** | `barrow_wight` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | dmg decay; onHit chill 1 | empty tile (ownTerritory) | — | setup only | Its touch is decay, and chills what survives it (Chill 1). |
| **Bear Cub** | `bear_cub` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | — | setup only | Small, stubborn, and heavier than it looks. |
| **Drake Hatchling** | `drake_hatchling` | minion | 2P | 2 | hero | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | onHit burn 1 | empty tile (ownTerritory) | — | setup only | Quick, and bites fire (Burn 1). |
| **Hawk Fledgling** | `hawk_fledgling` | minion | 2P | 2 | hero | 20 atk, 30 hp, 4 mov, rng 1, skirmisher | dmg shock | empty tile (ownTerritory) | — | setup only | Four tiles a turn, and its talons leave what they strike Charged. |
| **Spore Thrall** | `spore_thrall` | minion | 2P | 2 | hero | 10 atk, 50 hp, 1 mov, rng 1, bruiser | deathburst toxin 2 | empty tile (ownTerritory) | — | setup only | When it dies, every adjacent enemy is poisoned (Toxin 2). |
| **Brood Drake** | `brood_drake` | minion | 4P | 3 | hero | 40 atk, 110 hp, 2 mov, rng 1-2, caster | dmg fire; deathburst burn 2 | empty tile (ownTerritory) | — | setup only | Breathes fire at 2 tiles. When it dies, every adjacent enemy catches fire (Burn 2). |
| **Den Bear** | `den_bear` | minion | 4P | 3 | hero | 50 atk, 130 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Counter | setup only | Counter. Fifty in a swipe, and it strikes back when struck. |
| **Ring Elder** | `ring_elder` | minion | 4P | 3 | hero | 30 atk, 100 hp, 1 mov, rng 1-3, caster | dmg toxic; onHit toxin 2 | empty tile (ownTerritory) | Guardian | setup only | Guardian. Throws spores 1 to 3 tiles, poisoning what it hits (Toxin 2). |
| **Storm Roc** | `storm_roc` | minion | 4P | 3 | hero | 40 atk, 100 hp, 3 mov, rng 1, bruiser | dmg shock | empty tile (ownTerritory) | Haste | setup only | Haste. Its strikes are shock, leaving what survives Charged. |
| **Wight Lord** | `wight_lord` | minion | 4P | 3 | hero | 40 atk, 110 hp, 2 mov, rng 1, bruiser | dmg decay; onHit chill 1 | empty tile (ownTerritory) | Counter | setup only | Counter. Its blows are decay, and chill what survives them (Chill 1). |

---

## Notes

### Rank 2

Every card above may also exist as a Rank 2 printing, id-suffixed `_r2`. These are **derived, not authored**: `ascendCardDef()` in `src/core/data/ascension.ts` raises the numbers a card deals by 10% and changes nothing else, and `cards/index.ts` builds them at module load. A card with no number to raise gets no printing, which is what the Forge reads to decide it has nothing to sell you. There is nothing to author and nothing to list here — 176 of the 437 base cards currently have one, marked `R2` above.

### Tiers and copy limits

There is no rarity field. Tier is derived by `tierOf()` in `src/core/data/deckRules.ts`:

| Tier | Earned by | Copies allowed |
|:-:|---|:-:|
| 1 | total cost 0-1 | 3 |
| 2 | total cost 2-3 | 2 |
| 3 | total cost 4+, `PowerTier`, or a 2x2 footprint | 1 |

### Payloads that are not cards

Some cards deliver a definition that lives in its own registry. Those are not listed above:

| Registry | File | What it holds |
|---|---|---|
| `MARKS` | `src/core/data/marks.ts` | Mark payloads — what a Mark detonates for |
| `AURAS` | `src/core/data/auras.ts` | Aura payloads — what each Aura grows into |
| `COMPANIONS` | `src/core/data/companions.ts` | Companions, each pointing at a Bound Form card |
| `RELICS` | `src/core/data/relics.ts` | Gear, not cards |
| `SPLICE_RECIPES` | `src/core/data/splicing.ts` | What the bench turns into the `hybrid.ts` cards |

Pools, the bestiary and the roster (`pools.ts`, `bestiary.ts`, `roster.ts`) are all derived from the registry above. There is deliberately no second list to keep in step.
