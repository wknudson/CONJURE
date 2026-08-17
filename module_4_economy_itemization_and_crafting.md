# Tactical Card Battler — Game Design Document (Draft 6.0)
## Economy, Itemization & Crafting Architecture

This document establishes the economic loop, hero relic itemization, blueprint scribing recipes, and the card ascension system. All currencies and formulas have been updated to use **Ducats**, and critical gameplay edge cases (bankruptcy loops, deck legality failsafes, 0-Pip infinites, duplicate cap inheritance, and vault persistence) have been systematically resolved.

---

## 1. Currency Architecture & Flow Mechanics

```
                             ┌────────────────────────────────────────┐
                             │           Player Activities            │
                             │  (Duels, Harvesting, Trials, Dungeons) │
                             └───────────────────┬────────────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          ▼                                      ▼                                      ▼
    ┌───────────┐                          ┌───────────┐                          ┌───────────┐
    │  Ducats   │                          │  Academy  │                          │  Aether   │
    │   [DUC]   │                          │  Crests   │                          │  Shards   │
    └─────┬─────┘                          └─────┬─────┘                          └─────┬─────┘
          │                                      │                                      │
  ┌───────┴────────┐                     ┌───────┴────────┐                     ┌───────┴────────┐
  │ • Ante Buyback │                     │ • Master Blue- │                     │ • Card Rank 2  │
  │ • Base Reagents│                     │   print Access │                     │   Ascension    │
  │ • Vendor Wares │                     │ • Relic Sockets│                     │ • Core Forging │
  └────────────────┘                     └────────────────┘                     └────────────────┘
```

### 1.1 Currency Taxonomy

| Currency | Symbol | Primary Sources | Primary Sinks | Economic Function |
| :--- | :---: | :--- | :--- | :--- |
| **Ducats** | **DUC** | Roaming duelist bounties, dungeon chests, open-world skirmishes, selling hazard surplus. | Ante wager reclaim fees, scribing inks/parchment, vendor booster packs, ferry tolls. | Primary liquid exchange medium; paces general progression. |
| **Academy Crests** | **AC** | School Mastery Trials, Subjugation rituals, Academy curriculum quests. | Specialized school blueprints, companion relic socket licensing, mentor training. | School-specific prestige gate; prevents cross-school skipping without engagement. |
| **Aether Shards** | **AS** | Salvaging duplicate blueprints, disenchanting excess harvested props, dungeon boss caches. | Card Ascension (Rank 1 $\rightarrow$ Rank 2), Behemoth Heartstone synthesis. | Hard bottleneck currency preventing premature power inflation. |

---

### 1.2 Anti-Inflation & Resource Faucet Controls

To prevent hyper-farming from destabilizing the economy:
* **Diminishing Duelist Bounties:** Wandering duelists pay **100% Ducats** on first daily defeat, **50%** on second defeat, and **10%** thereafter until daily dawn reset.
* **Harvest Node Depletion:** Environmental hazard harvesting nodes (e.g., Volcanic Fissures, Ice Spires) yield full reagents for **3 harvests per region per rest cycle**, then enter a *Depleted* state (yielding only common gravel/ash).

---

## 2. Ante Wagering, Reclaim Vault & Anti-Soft-Lock Engine

```
 [Wager Loss] ──► [Black Market Reclaim Vault] ──► [Option A: Pay Ducat Buyback]
                          │
                          └──────────────────────► [Option B: Guild Bounty Duel (Free Reclaim)]
```

### 2.1 Reclaim Buyback Formula

When a card is lost under the **Ante Rule**, it is transferred to the regional *Black Market Reclaim Vault*. The buyback cost in Ducats scales with the card's baseline tier, the duelist's Renown Tier, and its ascension rank:

$$\text{Reclaim Cost (Ducats)} = \left[ \text{Base Card Value} \times \left(1 + 0.5 \times \text{Renown Tier}\right) \right] + \text{Ascension Surcharge}$$

* **Base Card Values:** Tier 1 (Common, Cap 3) = **100 DUC**; Tier 2 (Rare, Cap 2) = **300 DUC**; Tier 3 (Master, Cap 1) = **750 DUC**.
* **Renown Multiplier:** Novice = $1.0\times$ (Tier 0); Adept = $1.5\times$ (Tier 1); Master = $2.0\times$ (Tier 2).
* **Ascension Surcharge:** +**250 DUC** if the lost card is **Rank 2 (Ascended)**.

---

### 2.2 Critical Edge Cases: Ante & Economy

#### Edge Case 2.2.1: The Zero-Ducat Bankruptcy & Legal Deck Trap
* **Problem:** A player wagers and loses a card, reducing their collection below the legal deck minimum of **12 cards**, while possessing **0 Ducats** and no sellable items.
* **Resolution:** 1. **Non-Wagerable Core Pool:** The 15 Universal Hero Baseline Cards are **Permanent Soulbound Assets** and cannot be selected for Ante wagering, sold, or destroyed.
  2. **The "Bailout Duel":** If a player has 0 Ducats and wants to reclaim a non-baseline card without paying, the Duelist Guild offers a **Repossession Bout**—a high-difficulty challenge match where victory reclaims the card for free, but loss incurs no additional penalty.

#### Edge Case 2.2.2: Reclaim Vault Expiration & Memory Persistence
* **Problem:** Does a player lose their card permanently if they leave it in the Black Market Vault for too long?
* **Resolution:** Reclaim Vault storage is **permanent and persistent**. Cards never decay, get deleted, or get sold to NPCs. The vault can store up to **50 cards**. If the vault is full, the player is barred from accepting Ante-wager duels until space is cleared.

#### Edge Case 2.2.3: Ante Wagering of Slotted Deck Cards
* **Problem:** A player wagers a card that is currently equipped across multiple saved deck profiles.
* **Resolution:** If the duel is lost, the card is stripped from all saved deck profiles. Any deck falling below 12 cards is flagged as **[Invalid / Incomplete]** and cannot be queued into battle until replaced.

---

## 3. Hero Equipment & Relic Loadouts

```
                             HERO RELIC ARCHITECTURE
 ┌───────────────────────────┐               ┌───────────────────────────┐
 │   [Slot 1: Focus/Tome]    │               │   [Slot 2: Robe/Vestment] │
 │  Hand limit, starting draw│               │  Passive armor, Last Stand│
 └───────────────────────────┘               └───────────────────────────┘
 ┌───────────────────────────┐               ┌───────────────────────────┐
 │   [Slot 3: Amulet/Charm]  │               │   [Slot 4: Greaves/Boots] │
 │  Pip banking & Spark yield│               │  Deploy zones, move buffs │
 └───────────────────────────┘               └───────────────────────────┘
```

The Hero equips up to **4 Relic Artifacts** that modify macro combat rules without generating direct attack cards.

### 3.1 Master Relic Catalog

| Item Name | Slot | Tier | Mechanical Effect | Acquisition Method |
| :--- | :---: | :---: | :--- | :--- |
| **Codex of the Grand Archivist** | Focus | Rare | Hand size maximum increases from 7 to **8 cards**. On Turn 1, draw +1 additional card. | Adept Mastery Trial (Arcane Academy) |
| **Mantle of the Granite Bastion** | Vestment | Common | Hero starts combat with **3 Persistent Armor**. Reduces the first collision damage taken each turn by 1. | Scribing Forge Blueprint (Verdant) |
| **Pyromancer’s Cinder-Core** | Amulet | Rare | Devouring an allied minion with Burn or on a Fire tile yields **+1 bonus Spark** (Limit 1/turn). | Ignis Companion Taming Milestone |
| **Boots of the Vanguard** | Greaves | Common | Minions summoned on your baseline row gain **+1 MOV** on their turn of entry. | Roaming Duelist Drop (Volcanic Crags) |
| **Pendant of the Final Ember** | Amulet | Master | When triggering **Last Stand** (1 HP), immediately gain **+4 Sparks** and draw 2 cards. | Master Subjugation Bounty Reward |
| **Tome of Quick Scribing** | Focus | Rare | The first Obstacle or Barricade card played each match costs **-1 Pip** (Min 1 Pip). | Hidden Vault Chest (Sunken Mire) |

---

### 3.2 Critical Edge Cases: Hero Relics

#### Edge Case 3.2.1: Hand Overflow on Turn 1 with Hand-Expansion Relics
* **Problem:** A player equips *Codex of the Grand Archivist* (Max Hand 8, Draw +1 on Turn 1). If an encounter rule also grants bonus opening cards, what happens if draw exceeds 8 cards?
* **Resolution:** Hard ceiling of 8 cards. Any excess card drawn is not placed into the hand; it is placed face-up in the **Overdraw Discard Pile**, and the player gains **1 Spark** as compensation for each burned card.

#### Edge Case 3.2.2: Starting Pip Relics vs. 8-Pip Bank Hard Ceiling
* **Problem:** A relic grants "+1 Starting Pip Bank". Does this allow the player to exceed the master cap of 8 Pips?
* **Resolution:** No. Starting pips accelerate the ramp (e.g., starting Turn 1 with 2/8 Pips instead of 1/8), but the **absolute capacity remains clamped at 8 Pips**. Any generation attempt beyond 8 Pips is voided.

#### Edge Case 3.2.3: Persistent Armor vs. Last Stand Threshold
* **Problem:** A player has 3 Persistent Armor from *Mantle of the Granite Bastion* and takes lethal damage reducing them to **1 HP (Last Stand)**. Does the armor remain active to absorb sudden-death hits?
* **Resolution:** **Yes.** Armor acts as a secondary buffer over the 1 HP pool. To eliminate a player in Last Stand who holds Persistent Armor, the attacker must first deplete all remaining Armor before direct HP damage triggers sudden-death defeat.

#### Edge Case 3.2.4: Mid-Combat Equipment Swapping
* **Problem:** Can players alter relic loadouts during active combat or dungeon crawl runs?
* **Resolution:** Relic loadouts are **hard-locked** upon initiating combat or entering an instanced dungeon chamber. Swapping is strictly restricted to campfires, towns, and overworld rest sites.

---

## 4. Blueprint Scribing & Crafting Matrix

```
       [Harvested Props]               [Beast Essences]
     (Volcanic Slate, Briars)        (Lesser Cores, Heartstones)
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │   Scribe's Workshop   │ ◄─── [Binding Mediums]
                     │ (Blueprint Execution) │      (Vellum, Astral Wax, DUC)
                     └───────────┬───────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ Playable Battle Card  │
                     │  (Minion / Obstacle)  │
                     └───────────────────────┘
```

Cards are scribed at the **Scribe’s Desk** using blueprints discovered through exploration, mastery trials, and boss subjugation.

### 4.1 Reagent Economy & Breakdown

* **Binding Mediums (Vendor Gold Sinks - Ducat Purchased):**
  * *Vellum Parchment:* 25 DUC
  * *Infused Star-Ink:* 75 DUC
  * *Astral Sealing Wax:* 150 DUC
* **Harvestable Biome Reagents (Field Harvesting):**
  * *Volcanic Slate* (Volcanic Crags — Fissures/Rocks)
  * *Permafrost Crystal* (Frostveil Glacier — Ice Spires)
  * *Noxious Briar* (Toxic Mire — Acid Brambles)
  * *Petrified Core* (Stone Barrens — Geo-Monoliths)
* **Creature Cores (Combat Drops / Subjugations):**
  * *Minor Anima Core* (Tier 1 Common Minions)
  * *Greater Fiend Heart* (Tier 2 Rare / Elite Minions)
  * *Behemoth Heartstone* (Tier 3 Master / $2 \times 2$ Colossi)

---

### 4.2 Master Blueprint Scribing Recipes

| Card Output | Category | Size | Exact Reagent Recipe | Scribing Cost |
| :--- | :--- | :---: | :--- | :---: |
| **Cinder Imp** | Minion (Chaff) | $1 \times 1$ | 1x Vellum Parchment + 2x Volcanic Slate + 1x Minor Anima Core | 25 DUC |
| **Bramble Spire** | Obstacle (Briar) | $1 \times 1$ | 1x Astral Sealing Wax + 3x Noxious Briar | 50 DUC |
| **Glacial Bulwark** | Minion (Guardian) | $1 \times 1$ | 1x Infused Star-Ink + 3x Permafrost Crystal + 1x Greater Fiend Heart | 100 DUC |
| **Obsidian Dreadnought** | Behemoth (Siege) | $2 \times 2$ | 2x Infused Star-Ink + 6x Volcanic Slate + 1x Behemoth Heartstone | 250 DUC |
| **Iron-Root Colossus** | Behemoth (Wall) | $2 \times 2$ | 2x Astral Sealing Wax + 6x Petrified Core + 1x Behemoth Heartstone | 250 DUC |
| **Volatile Magma Barrel** | Hazard Prop | $1 \times 1$ | 1x Vellum Parchment + 4x Volcanic Slate | 50 DUC |

---

### 4.3 Critical Edge Cases: Crafting & Blueprints

#### Edge Case 4.3.1: Duplicate Blueprint Discovery
* **Problem:** A player finds a blueprint in a dungeon chest for a card they already know.
* **Resolution:** Blueprints cannot be learned twice. Duplicate blueprints are automatically consumed on pickup and converted into **Currency Compensation**:
  * *Common Blueprint Duplicate:* **50 DUC + 5 Aether Shards**
  * *Rare Blueprint Duplicate:* **150 DUC + 15 Aether Shards**
  * *Master Blueprint Duplicate:* **400 DUC + 35 Aether Shards**

#### Edge Case 4.3.2: Scribing Beyond the Deck Duplicate Cap
* **Problem:** A player attempts to scribe a 4th copy of a Tier 1 card (Cap 3) or a 2nd copy of a Tier 3 Behemoth (Cap 1).
* **Resolution:** The Scribe UI **blocks creation** if the total owned copies in the player's binder equal the master duplicate limit ($3/2/1$), displaying: `[Crafting Blocked: Maximum Binder Capacity Reached for this Card]`.

---

## 5. Card Ascension Architecture (Rank 1 $\rightarrow$ Rank 2)

Card Ascension refines a card's strategic identity, geometric range, or utility without violating core balance formulas.

```
                      CARD ASCENSION PATHWAYS
                                 │
     ┌──────────────────┬────────┴─────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
[Pip Efficiency]  [Geometry Expansion] [Impact/Keyword]  [Stat Fortification]
 -1 Pip Cost or     +1 Push/Pull Dist    Adds Pierce,      +2 Damage or
 Spark Rebate       or Cone Widening     Haste, Counter    +3 Barrier HP
```

### 5.1 Ascension Cost Schedule

$$\text{Ascension Cost} = \text{Ducats} + \text{Regional Reagents} + \text{Aether Shards} + \text{Ascension Catalyst}$$

| Card Tier | Binder Limit | Ducat Cost | Reagents | Aether Shards | Core Catalyst |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Tier 1 (Common)** | 3 Copies | **100 DUC** | 4x Regional Reagents | 10 AS | — |
| **Tier 2 (Rare)** | 2 Copies | **300 DUC** | 8x Regional Reagents | 25 AS | 1x Greater Fiend Heart |
| **Tier 3 (Master)** | 1 Copy | **750 DUC** | 16x Regional Reagents | 60 AS | 1x Behemoth Heartstone + 25 AC |

---

### 5.2 Concrete Card Upgrade Catalog

```
[Rank 1: Flame Cascade]                  [Rank 2: Ascended Flame Cascade]
Cost: 3 Pips                             Cost: 3 Pips
Range: 3 Tiles                           Range: 3 Tiles
Effect: Deal 6 Fire Dmg.                 Effect: Deal 7 Fire Dmg.
        On kill: 3 Dmg to                        On kill: 4 Dmg + attaches
        adjacent tiles.                          Burn Rune (2 Dmg / 1 Turn)
                                                 to adjacent tiles.
```

#### 1. Baseline Neutral Strike (Hero Pool — Common)
* **Rank 1:** Cost: 1 Pip | Range: 1 Tile | Effect: Deal 4 Physical Damage.
* **Rank 2 (Ascended):** Cost: 1 Pip | Range: 1 Tile | Effect: Deal 5 Physical Damage. **Push target 1 Tile.** *(Enables directional collision into walls/minions).*

#### 2. Frost Barrier (Cryomancy — Common)
* **Rank 1:** Cost: 2 Pips | Placement: Empty Tile | Effect: Spawns a $1 \times 1$ Ice Wall with 6 HP. Blocks LoS.
* **Rank 2 (Ascended):** Cost: 2 Pips | Placement: Empty Tile | Effect: Spawns a $1 \times 1$ Ice Wall with **9 HP**. **Chilling Shards:** When destroyed by an enemy melee attack, applies **Chill (-1 MOV)** to the attacker for 1 turn.

#### 3. Magma Hurl (Pyromancy — Rare)
* **Rank 1:** Cost: 3 Pips | Range: 3 Tiles | Effect: Deal 5 Fire Damage to target tile and leaves a Fire Tile for 2 turns.
* **Rank 2 (Ascended):** Cost: **2 Pips** *(Efficiency Pathway)* | Range: 3 Tiles | Effect: Deal 5 Fire Damage to target tile and leaves a Fire Tile for 2 turns.

#### 4. Iron-Root Colossus (Verdant — Master Behemoth)
* **Rank 1:** Cost: 6 Pips | HP: 24 | MOV: 1 | Traits: *Guardian, Heavy Footprint*. Cleaves 2 frontal tiles for 5 Damage.
* **Rank 2 (Ascended):** Cost: 6 Pips | HP: **28** | MOV: 1 | Traits: *Guardian, Heavy Footprint*. Cleaves 2 frontal tiles for 6 Damage. **Entangling Canopy:** Struck targets are **Rooted** for 1 turn.

---

### 5.3 Critical Edge Cases: Ascension & Upgrades

#### Edge Case 5.3.1: The 0-Pip Cost Floor Rule (Preventing Infinite Loops)
* **Problem:** A Rank 1 card with a base cost of 1 Pip takes the Efficiency Ascension path (-1 Pip cost). Does it become a 0-Pip card, enabling infinite draw/cast loops?
* **Resolution:** **Hard Floor Rule:** Pip costs cannot be reduced below **1 Pip**. If a 1-Pip card takes an Efficiency upgrade, its text is constructed as: *"Cost: 1 Pip. On Play: Refund 1 Spark"* or *"On Kill: Gain 1 Spark"*. It still requires 1 banked Pip to initiate cast.

#### Edge Case 5.3.2: Duplicate Cap Enforcement Across Split Ranks
* **Problem:** A player owns two Rank 1 copies of a Tier 1 Common (Cap 3). Can they ascend both to Rank 2 and craft two more Rank 1 copies, ending up with 4 total playable copies?
* **Resolution:** **Master ID Inheritance:** The $3/2/1$ duplicate cap is tracked by the **Base Card ID**, not the rank.
  $$\text{Total Copies (Rank 1)} + \text{Total Copies (Rank 2)} \le \text{Tier Duplicate Cap}$$
  For a Common card (Cap 3), a player may hold (2x Rank 1 + 1x Rank 2) or (3x Rank 2), but never a sum exceeding 3.

#### Edge Case 5.3.3: Ascension Demolition & Resource Refund
* **Problem:** A player ascends a card to Rank 2 but wants to pivot builds or reallocate rare Aether Shards.
* **Resolution:** Players can **De-Ascend** a card at the Scribing Desk.
  * Reverts the card to Rank 1.
  * **Refund Yield:** **70% of Ducats** + **70% of Aether Shards** refunded.
  * Reagents and Essences used in the initial upgrade are permanently consumed.

#### Edge Case 5.3.4: Collision & Keyword Displacement vs. Immovable Units
* **Problem:** A Rank 2 ascended spell gains **Push 1 Tile**, but targets a $2 \times 2$ Behemoth with the *Heavy Footprint* trait (which resists push/pull).
* **Resolution:** The push displacement is completely negated by *Heavy Footprint*. However, because the push force was applied and immediately obstructed, the Behemoth immediately suffers **Standard Collision Damage (3 Direct Damage)** without moving from its tile.

---

## 6. Complete Module 4 Summary Table

| System | Primary Rule | Edge Case Protection Mechanism |
| :--- | :--- | :--- |
| **Currency** | Ducats [DUC] = Liquid; Crests [AC] = School Gate; Shards [AS] = Upgrades. | Faucet decay on duelist grinding; node depletion after 3 harvests. |
| **Ante Wagering** | Scaling Ducat buyback based on Card Tier + Renown Tier. | 15 Universal cards are Soulbound; Bailout Duels prevent 0-DUC soft locks. |
| **Hero Relics** | 4 Slots modifying hand, armor, pips, and movement. | Clamped 8-Pip ceiling; Overdraw Sparks; Persistent Armor buffers Last Stand. |
| **Scribing** | Discover blueprints $\rightarrow$ craft with parchment, reagents, and Ducats. | Duplicate blueprints auto-salvage; UI blocks crafting beyond $3/2/1$ cap. |
| **Ascension** | 4 Paths (Efficiency, Geometry, Keywords, Durability) to Rank 2. | Hard 1-Pip minimum floor; Master Card ID cap inheritance; 70% de-ascension refund. |
