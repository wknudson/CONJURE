# 08 — Card Catalog

> **Generated file — do not edit by hand.** Written by `scripts/generate-card-catalog.ts`; run `npm run cards:catalog` to rebuild it after adding or changing a card.

Every card in the game, grouped by the file it lives in. Card data is read from the real `CardDef`s, so the counts below are the counts — not a claim about them.

**Adding a card:** pick the shelf its school belongs to under `src/core/data/cards/`, add a `CardDef` to that file's exported record, and rerun the generator. A new *file* also needs wiring into `cards/index.ts` and into `SOURCES` in the generator — the script fails loudly if you do the first and forget the second.

## Totals

**214 base cards.** Rank 2 printings are derived, not authored — see [Rank 2](#rank-2).

| Kind | Count | Whose | Where it goes |
|---|---:|---|---|
| minion | 82 | Hero | Vanguard Roster, never a deck |
| spell | 96 | Companion | drafted into a Grimoire |
| ability | 10 | Hero | Hero Deck |
| mark | 6 | Hero | Hero Deck |
| obstacle | 20 | Hero | Hero Deck, shown as a Construct |
| **total** | **214** | | |

### By school

| School | Cards |
|---|---:|
| dusk | 35 |
| bulwark | 31 |
| frost | 31 |
| bloom | 29 |
| surge | 29 |
| pyre | 28 |
| arcane | 21 |
| neutral | 10 |

### By file

| File | Cards | Breakdown |
|---|---:|---|
| [`starter.ts`](#starterts) | 12 | 5 minion, 2 spell, 4 ability, 1 obstacle |
| [`arcane.ts`](#arcanets) | 12 | 1 minion, 3 ability, 6 mark, 2 obstacle |
| [`pyre.ts`](#pyrets) | 12 | 4 minion, 6 spell, 2 obstacle |
| [`frost.ts`](#frostts) | 20 | 5 minion, 12 spell, 3 obstacle |
| [`companionUnits.ts`](#companionunitsts) | 32 | 32 minion |
| [`terrain.ts`](#terraints) | 5 | 5 obstacle |
| [`ranged.ts`](#rangedts) | 3 | 3 minion |
| [`surge.ts`](#surgets) | 20 | 7 minion, 12 spell, 1 obstacle |
| [`bloom.ts`](#bloomts) | 19 | 7 minion, 11 spell, 1 obstacle |
| [`bulwark.ts`](#bulwarkts) | 20 | 7 minion, 11 spell, 2 obstacle |
| [`dusk.ts`](#duskts) | 15 | 5 minion, 8 spell, 2 obstacle |
| [`gaslamp.ts`](#gaslampts) | 4 | 1 minion, 2 spell, 1 ability |
| [`wildlife.ts`](#wildlifets) | 2 | 2 minion |
| [`threats.ts`](#threatsts) | 3 | 3 minion |
| [`hybrid.ts`](#hybridts) | 24 | 23 spell, 1 obstacle |
| [`auras.ts`](#aurasts) | 11 | 9 spell, 2 ability |
| **total** | **214** | |

---

## The cards

Columns: **Cost** is `P` Pips and `M` Marrow (Marrow is a strict requirement; Pips can be paid out of Marrow but never the reverse). **Tier** is derived from cost and keywords by `tierOf()` and sets the copy limit. **Stats** is the unit stat block or the obstacle HP. **Riders** is every optional behaviour hanging off it. **Flags** notes setup/splice-only cards, starter deck membership, and `R2` where the Forge sells a Rank 2 printing.

### `starter.ts`

The opening deck. Pyre and the colourless staples every Hero starts holding. — **12 cards** (5 minion, 2 spell, 4 ability, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Marrow Wisp** | `marrow_wisp` | minion | 1P | 1 | hero | 10 atk, 30 hp, 2 mov, rng 1, caster | tithe +1M; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Bled for +1 Marrow above the usual. |
| **Scout Imp** | `scout_imp` | minion | 1P | 1 | hero | 20 atk, 20 hp, 3 mov, rng 1, skirmisher | escalate +10/+0 | empty tile (ownTerritory) | Haste, Growth | — | Haste. Can move and attack the turn it is deployed. |
| **Vanguard Footman** | `vanguard_footman` | minion | 1P | 1 | hero | 20 atk, 40 hp, 2 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Growth | — | A conscript of the line. Steady, cheap, and yours from the first turn. |
| **Grave Sentinel** | `grave_sentinel` | minion | 2P | 2 | hero | 20 atk, 60 hp, 2 mov, rng 1, bruiser | escalate +10/+10 | empty tile (ownTerritory) | Counter, Guardian, Growth | — | Counter: retaliates when hit in melee. Guardian: blocks line of sight behind it. |
| **Magma Brute** | `magma_brute` | minion | 4P | 3 | hero | 40 atk, 120 hp, 1 mov, rng 1, behemoth, **2x2** | escalate +10/+10 | empty tile (ownTerritory, 2x2) | Impact, PowerTier, Growth | — | Power Tier. 2x2 Behemoth. Impact: deals 20 fire damage across a 2-tile front cleave. Cannot enter 1x1 gaps. |
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
| **Cull the Weak** | `cull_the_weak` | ability | 1M | 1 | hero | — | — | global | — | starter deck, R2 | Costs 1 Marrow, which no amount of banked Pips will cover. Deals 40 damage through any armor to the enemy with the least health. |
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

Bound Forms. Placed by setup, never drawn, never bought. — **32 cards** (32 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Barrow Jackal** | `jackal_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Bone Bastion Sovereign** | `sovereign_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Boreas** | `boreas_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Chimera of the Caldera** | `chimera_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Cinder Shade** | `shade_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Pyre and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Cinder-Wasp Swarm** | `wasp_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Conduit Kite** | `kite_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 3 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Crimson Treant** | `treant_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Dolmen Crab** | `crab_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ferrum** | `ferrum_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm, Guardian | setup only | Bound Form. Your Bulwark cards are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Flue Salamander** | `salamander_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 4 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Glacial Juggernaut** | `juggernaut_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Frost and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Grave-Gargoyle** | `gargoyle_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Frost and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ignis** | `ignis_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Ignis Enraged** | `ignis_behemoth_bound` | minion | 0 | 3 | companion | 50 atk, 440 hp, 1 mov, rng 1, behemoth, **2x2** | — | none | BoundForm | setup only | Bound Form. The drake grown into its full shape. Blocks sight through itself. |
| **Ignis, Ember Drake** | `ignis_drake_bound` | minion | 0 | 1 | companion | 40 atk, 440 hp, 2 mov, rng 1-2, bruiser | — | none | BoundForm | setup only | Bound Form. The drake itself. Wounds it takes are dealt to its Pact. |
| **Ink Owl** | `lexis_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 3 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Arcane cards are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Kinetic Dynamo** | `dynamo_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Surge and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Mortis** | `mortis_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 2 mov, rng 1, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Moss Aurochs** | `aurochs_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 2 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Murk Heron** | `heron_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Dusk and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Obsidian Tortoise** | `tortoise_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Pyre and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Quarry Ram** | `ram_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, bruiser | — | none | BoundForm | setup only | Bound Form. Your Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Saltglass Seal** | `seal_bound` | minion | 0 | 1 | companion | 20 atk, 40 hp, 1 mov, rng 1-2, caster | — | none | BoundForm | setup only | Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Storm-Mantis** | `mantis_bound` | minion | 0 | 1 | companion | 30 atk, 40 hp, 3 mov, rng 1, skirmisher | — | none | BoundForm | setup only | Bound Form. Your Frost and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **Sylva** | `sylva_bound` | minion | 0 | 1 | companion | 10 atk, 40 hp, 2 mov, rng 1-3, caster | — | none | BoundForm | setup only | Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact. |
| **The Clockwork Colossus** | `colossus_bound` | minion | 0 | 3 | companion | 60 atk, 440 hp, 1 mov, rng 1, behemoth, **2x2** | — | none | BoundForm | setup only | Bound Form. The Great Quieting, given legs. Blocks sight through itself. |
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

Bodies that shoot. — **3 cards** (3 minion).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Cinder Lobber** | `cinder_lobber` | minion | 3P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 2-4, caster | arcing; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Shoots over anything, needing no line of sight. Cannot hit what is adjacent. |
| **Longshot Stalker** | `longshot_stalker` | minion | 3P | 2 | hero | 30 atk, 30 hp, 2 mov, rng 1-99, sniper | lineOnly; escalate +10/+0 | empty tile (ownTerritory) | Growth | — | Fires any distance, but only along a straight line. Anything in the way stops the shot. |
| **Arc Turret** | `arc_turret` | minion | 4P | 3 | hero | 50 atk, 60 hp, 0 mov, rng 1-5, caster | escalate +0/+10 | empty tile (ownTerritory) | Growth | — | Hits hard at long range and never moves. Blocking its line, or shoving it, is the answer. |

### `surge.ts`

Surge expansion — charge and chain. — **20 cards** (7 minion, 12 spell, 1 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Static Hare** | `static_hare` | minion | 1P | 1 | hero | 10 atk, 20 hp, 3 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | — | Haste. Whatever survives its bite is left Charged. Fire Overloads a Charged target; frost Superconducts. |
| **Storm Rod** | `storm_rod` | minion | 1P | 1 | hero | 10 atk, 40 hp, 0 mov, rng 1, caster | deathburst charged 1 | empty tile (ownTerritory) | — | — | Cannot move, ever. When it dies, every adjacent enemy is left Charged. |
| **Storm Wisp** | `storm_wisp` | minion | 1P | 1 | hero | 10 atk, 20 hp, 2 mov, rng 1, skirmisher | refund 1P on attack | empty tile (ownTerritory) | Haste | — | Haste. Whenever it attacks, you are paid 1 Pip. |
| **Voltaic Coil** | `voltaic_coil` | minion | 2P | 2 | hero | 20 atk, 50 hp, 1 mov, rng 1, bruiser | refund 1P on death | empty tile (ownTerritory) | — | — | When it dies — however it dies — you are paid 1 Pip. |
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
| **Thunderhead** | `thunderhead` | spell | 2P | 2 | companion | — | — | entity (enemy) — range 4, LoS | — | R2 | Deals 30 shock damage. If you still hold 3 or more Pips, it earths outward for 20 more to everything adjacent. |
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

Bulwark expansion — plate and hold. — **20 cards** (7 minion, 11 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Shieldbearer** | `shieldbearer` | minion | 1P | 1 | hero | 10 atk, 50 hp, 1 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian | — | Guardian: blocks line of sight behind it. A Pip for a sightline, and almost no threat at all. |
| **Concussive Blow** | `concussive_blow` | minion | 2P | 2 | hero | 20 atk, 40 hp, 1 mov, rng 1, bruiser | onHit stun 1; escalate +10/+10 | empty tile (ownTerritory) | — | — | A slab of a thing with a hammer. Whatever it wounds is Stunned: no moving, no swinging. |
| **Quarry Hand** | `quarry_hand` | minion | 2P | 2 | hero | 20 atk, 50 hp, 2 mov, rng 1, bruiser | — | empty tile (ownTerritory) | Guardian | — | Guardian. Enemies must come through it before they reach what is behind it. |
| **Siege Ox** | `siege_ox` | minion | 2P | 2 | hero | 30 atk, 50 hp, 1 mov, rng 1, bruiser | onHit brittle 1 | empty tile (ownTerritory) | — | — | Whatever survives its charge is left Brittle, taking +20 damage from every hit until it wears off. |
| **Stone-Heart Golem** | `stone_heart_golem` | minion | 3P | 2 | hero | 30 atk, 80 hp, 1 mov, rng 1, bruiser | plates 10/turn | empty tile (ownTerritory) | Guardian | — | Guardian. At the start of each of your turns it welds on 10 more Armor, up to 30. |
| **Anvil Lord** | `anvil_lord` | minion | 4P | 3 | hero | 40 atk, 90 hp, 1 mov, rng 1, bruiser | plates 20/turn | empty tile (ownTerritory) | — | — | At the start of each of your turns it welds on 20 more Armor, up to 60. Slow, short-reached, and very hard to remove. |
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
| **Hammer Fall** | `hammer_fall` | spell | 2P+1M | 2 | companion | — | — | entity (enemy) — range 3, LoS | — | R2 | Costs 1 Marrow, which no amount of banked Pips will cover. Deals 30 impact damage and Stuns: no moving, no swinging. |
| **Sinkhole** | `sinkhole` | spell | 3P | 2 | companion | — | — | empty tile (any) — range 4, LoS | — | R2 | Collapses the ground: everything within a tile of the point is dragged 1 tile into it and takes 20 impact damage. Bodies arriving on the same tile collide. |
| **Battlement** | `battlement` | obstacle | 2P | 2 | companion | 40 hp, cover | — | empty tile (any) — range 3, LoS | — | R2 | Raises 40 HP of cover on an empty tile. Blocks line of sight but not movement — your own units may stand in it and shoot out. |
| **Iron Gate** | `iron_gate` | obstacle | 2P | 2 | companion | 80 hp | leaves rubble | empty tile (any) — range 3, LoS | — | R2 | Raises an 80 HP gate on an empty tile. Blocks movement and line of sight, and leaves rough ground when it finally breaks. |

### `dusk.ts`

Dusk expansion — drain, decay, the graveyard. — **15 cards** (5 minion, 8 spell, 2 obstacle).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Galvanic Revenant** | `galvanic_revenant` | minion | 0 | 1 | hero | 20 atk, 30 hp, 2 mov, rng 1, skirmisher | — | empty tile (ownTerritory) | Haste | setup only | Haste. Jolted upright and already moving. It does not remember what it was. |
| **Hollow Wraith** | `hollow_wraith` | minion | 0 | 1 | hero | 40 atk, 40 hp, 2 mov, rng 1, bruiser | dmg true | empty tile (ownTerritory) | — | setup only | Its strikes pass through armor entirely — and, being no longer physical, they no longer Shatter ice. |
| **Ash-Ghoul** | `ash_ghoul` | minion | 1P | 1 | hero | 20 atk, 20 hp, 0 mov, rng 1, bruiser | tithe +1M | empty tile (ownTerritory) | Dormant | — | Dormant: cannot act the turn it is summoned, and so cannot be tithed until the next one. Cannot move, ever. Bled for +1 Marrow above the usual. |
| **Carrion Crow** | `carrion_crow` | minion | 1P | 1 | hero | 10 atk, 20 hp, 4 mov, rng 1, skirmisher | tithe +1M | empty tile (ownTerritory) | — | — | Bleeds well. Yields extra Marrow when tithed. |
| **Hollowed Husk** | `hollowed_husk` | minion | 1P | 1 | hero | 0 atk, 40 hp, 1 mov, rng 1, bruiser | refund 2P on death | empty tile (ownTerritory) | Guardian | — | Guardian. It cannot strike. When it dies, you are paid 2 Pips. |
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
| **Aetheric Overload** | `aetheric_overload` | spell | 0 | 1 | companion | — | — | entity (ally, has charged) — range 4 | — | splice only | Spends a Charged allied unit whole. You are paid 3 Pips. |
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

The Aura attach cards, their Detonations and Revival. — **11 cards** (9 spell, 2 ability).

| Name | id | Kind | Cost | Tier | Source | Stats | Riders | Target | Keywords | Flags | Text |
|---|---|---|---|:-:|---|---|---|---|---|---|---|
| **Marrow Burst** | `marrow_burst` | spell | 0 | 1 | hero | — | — | entity (ally, aura climax) | — | — | Spends a Climaxed Aura for 4 Marrow. Use it this turn or lose it. |
| **Cataclysm** | `cataclysm` | spell | 1P | 1 | hero | — | — | entity (ally, aura climax) | — | R2 | Spends a Climaxed Aura. Everything around the host takes 50 fire. |
| **Marrow Siphon** | `marrow_siphon` | spell | 1P | 1 | hero | — | — | entity (ally) | — | — | Opens an ally to the dark. Each turn it bleeds 10 and yields 1 Marrow. It does not stop. |
| **Verdant Collapse** | `verdant_collapse` | spell | 1P | 1 | hero | — | — | entity (ally, aura climax) | — | R2 | Spends a Climaxed Aura. The growth goes back into the Pact — heal 80. |
| **Ember Coat** | `ember_coat` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Wraps an ally in fire. +10 ATK per stack, to two. At Climax it burns what it strikes. |
| **Petrifying Mantle** | `petrifying_mantle` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Sets an ally in stone. +10 Persistent Armor per stack, to two. At Climax nothing shoves it. |
| **Static Charge** | `static_charge` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Charges an ally. +1 MOV per stack, to two. At Climax it stops going around things. |
| **Verdant Swell** | `verdant_swell` | spell | 2P | 2 | hero | — | — | entity (ally) | — | — | Roots an ally deeper. +20 Max HP per stack, to two. At Climax it drinks what it wounds. |
| **The Blood & Bone Rally** | `blood_and_bone_rally` | spell | 3M | 2 | hero | — | — | fallen (startingZone) | — | R2 | Costs 3 Marrow, which no bank of Pips will cover. Raises a fallen Vanguard in your starting zone at 10 health, wearing Persistent Armor equal to everything it lost. |
| **Aetheric Resurgence** | `aetheric_resurgence` | ability | X (max 5) | 1 | hero | — | — | fallen (pyre) | — | — | X Pips, up to 5. Raises a fallen Vanguard on the exact tile it fell, at 20% of its health per Pip spent. Nothing may be standing there. |
| **The Anchor Rally** | `anchor_rally` | ability | 3P | 2 | hero | — | — | fallen (anchor) | — | — | Raises a fallen Vanguard on an Anchor Tile at half health, quickened: +1 MOV this turn. |

---

## Notes

### Rank 2

Every card above may also exist as a Rank 2 printing, id-suffixed `_r2`. These are **derived, not authored**: `ascendCardDef()` in `src/core/data/ascension.ts` raises the numbers a card deals by 10% and changes nothing else, and `cards/index.ts` builds them at module load. A card with no number to raise gets no printing, which is what the Forge reads to decide it has nothing to sell you. There is nothing to author and nothing to list here — 74 of the 214 base cards currently have one, marked `R2` above.

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
