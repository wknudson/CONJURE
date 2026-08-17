# Open-World Progression & Companion Acquisition Architecture (Draft 1.0)

---

## 1. System Overview & Core Philosophy

This document defines the out-of-combat progression, open-world collection loops, and deck customization systems for the tactical card battler. Moving away from linear, node-based progression maps (*Slay the Spire*), the game employs an explorable, multi-zone overworld (*Wizard101* and *Pokémon*) anchored by four core progression loops:

```
                            [OPEN-WORLD EXPLORATION]
                                       │
      ┌────────────────────┬───────────┴───────────┬────────────────────┐
      ▼                    ▼                       ▼                    ▼
[Spire Altars &     [Wandering Wagers &     [Monster Mastery &    [Hazard Harvesting &
 Ancient Obelisks]   Guild Academies]        Blueprint Forging]    Field Variance]
      │                    │                       │                    │
(Attunements)        (Ante Duels / Gold)     (Crafting Chains)    (Affinity Stat Rolls)
```

---

## 2. Companion System: Acquisition & Roll Engine

Companions define the player's elemental alignment, baseline stat bonuses, unique passive traits, and high-impact finisher access.

```
[Defeat Wild Companion in Subjugation Trial]
                     │
                     ├── Base Archetype (Fixed Identity / Elemental Theme)
                     ├── Stat Modifiers (HP / Starting Persistent Armor / Turn-1 Sparks)
                     ├── 1 Major Passive Trait (Rolled from Archetype Pool)
                     └── 1 Signature Finisher / Power Tier Spell (Rolled from Archetype Pool)
```

### 2.1 Subjugation Trials (Wild Taming Battles)
* **Open-World Encounters:** Companions roam distinct biomes as world entities. Interacting with them initiates a dedicated **Subjugation Trial** on the tactical grid.
* **Trial Boss Mechanics:** The wild companion acts as the opposing commander, wielding archetype-specific spells and summons.
* **Mastery Objectives:** While standard defeat guarantees a base-tier tame, completing combat sub-objectives increases the companion's **Affinity Roll Tier** (yielding higher stat floors or rare passive traits):
  * *Rune Detonation Mastery:* Defeat the companion via an aligned Rune Cascade.
  * *Impenetrable Defense:* Take zero direct Commander HP damage during the encounter.
  * *Unit Sacrifice:* Sacrifice 3+ friendly units during the battle to fuel spells.

---

### 2.2 Companion Archetype Bank & Variance Engine

Each time a wild companion is defeated and claimed, its loadout is generated dynamically from its archetype bank:

#### Archetype 1: Ignis, the Ember Drake (Fire / Detonation Archetype)

| Component | Archetype Baseline | Randomized Roll Pool Example |
| :--- | :--- | :--- |
| **Commander Stat Modifier** | Health / Starting Defense | **Roll A:** $+0	ext{ HP}, +5	ext{ Starting Persistent Armor}$<br>**Roll B:** $+6	ext{ Max HP}, +0	ext{ Armor}$<br>**Roll C (Rare):** $+1	ext{ Temporary Spark on Turn 1}$ |
| **Major Passive Trait** | Fire & Rune Synergy | **Trait 1 (Ignition Aura):** First Fire spell played each combat deals $+1	ext{ damage}$.<br>**Trait 2 (Volatile Feedback):** Whenever a friendly Cinder Rune detonates, gain $+1	ext{ Armor}$.<br>**Trait 3 (Kindle):** Sacrificing a Fire minion generates $+1	ext{ extra Spark}$. |
| **Signature Companion Spell** | High-Impact Finisher | **Option 1:** *Cataclysmic Core* (Power Tier 5: Detonates all board runes with $+2	ext{ bonus damage}$)<br>**Option 2:** *Pyroclasm* (Power Tier 4: $3	imes3$ AoE blast that sets ground tiles ablaze) |

#### Archetype 2: Boreas, the Frost Weaver (Ice / Control Archetype)

| Component | Archetype Baseline | Randomized Roll Pool Example |
| :--- | :--- | :--- |
| **Commander Stat Modifier** | Health / Starting Defense | **Roll A:** $+0	ext{ HP}, +8	ext{ Starting Persistent Armor}$<br>**Roll B:** $+4	ext{ Max HP}, +3	ext{ Starting Armor}$<br>**Roll C (Rare):** Retaining a card at turn-end grants $+1	ext{ Armor}$ |
| **Major Passive Trait** | Crowd Control & Shatter | **Trait 1 (Glacial Grasp):** Frozen enemies take $+2	ext{ damage}$ from Physical attacks.<br>**Trait 2 (Sub-Zero Bastion):** Obstacles you summon gain $+3	ext{ Max HP}$.<br>**Trait 3 (Permafrost):** Applying Freeze to a target with Armor breaks $2	ext{ Armor}$ instantly. |
| **Signature Companion Spell** | Control Finisher | **Option 1:** *Absolute Zero* (Power Tier 5: Freezes all enemies in rows 3–5 for 1 turn).<br>**Option 2:** *Glacial Cataclysm* (Power Tier 4: Shatters all obstacles, dealing $4	ext{ damage}$ in a 1-tile radius around each). |

---

## 3. Open-World Card Acquisition & Progression

Cards are collected through direct gameplay actions across the open world rather than random post-combat drafts.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     OPEN-WORLD CARD PROGRESSION                        │
├─────────────────────┬──────────────────────────────────────────────────┤
│ Wandering Duelists  │ Ante/Wager Battles, Scaling Renown Tiers         │
│ Guild Academies     │ Linear Spell Curriculums, Mastery Trials         │
│ Monster Mastery     │ Bestiary Blueprints, Essence + Regional Reagents │
│ Hazard Harvesting   │ Field Terrain Interactions, Stat Variance Rolls  │
│ Spire Altars        │ High-Tier Attunements, Lost Tomes                │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

### 3.1 Wandering Duelists & The 3-Tier Renown System

NPC summoners travel roads, inhabit taverns, and explore wilderness outposts. Players can challenge them with custom stakes before combat begins:

```
[Challenge NPC Duelist]
          │
          ├──> [Standard Sparring] ──> Duel for Gold, Renown, and Basic Reagents
          │
          └──> [Ante / Wager Duel] ──> Bet 1 Owned Card as Collateral
                                              │
                                              ├── [Victory] ──> Claim 1 Random Card from NPC's Deck
                                              └── [Defeat]  ──> Lose Card (Held at Reclaim Shop for Gold)
```

#### The 3 Renown Difficulty Tiers
As players win duels across a zone, their **Renown Tier** increases, making future duels harder while unlocking superior stakes and rewards:

```
[Tier 1: Novice Wanderer] ──> [Tier 2: Adept Journeyman] ──> [Tier 3: Master Duelist]
```

* **Tier 1 (Novice Wanderer):** Uses baseline starter decks, simple $1 	imes 1$ summons, and predictable line attacks. Rewards standard currency and common crafting materials.
* **Tier 2 (Adept Journeyman):** AI integrates Power Tier spells, active Counter traps, and $2 	imes 2$ Behemoths. Wagers include uncommon/rare utility spells.
* **Tier 3 (Master Duelist):** High-level AI aggressively leverages Devour Spawning, complex Cascade Rune chains, and variant cards. Victory rewards rare regional reagents, large gold pots, and elite Ante wagers.

---

### 3.2 School Academies & Guild Masters

Permanent institutions located in major settlements and elemental hubs:
* **Curriculum Progression:** Players spend gold and regional quest tokens to learn fundamental Tier-1 and Tier-2 spells (e.g., standard projectiles, basic shields, and positioning tools).
* **Mastery Trials:** Completing specific grid puzzle encounters (e.g., *Defeat 3 targets in 1 turn using a single Rune Cascade*) unlocks advanced spell crafting recipes.

---

### 3.3 Monster Mastery & Blueprint Crafting Chains

Summon cards are forged by combining combat mastery with regional gathering:

```
[Defeat Monster / Behemoth] ──> [Unlock Bestiary Blueprint Achievement]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
         [Core Monster Essence]                               [Regional Field Reagents]
         (e.g., Molten Core)                                  (e.g., Volcanic Cinder Ore)
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              ▼
                             [Scribe Station / Campfire Forge]
                                              │
                                [Completed Summon Card Added]
```

1. **Achievement Blueprints:** Defeating a monster or open-world Behemoth (such as the $2 	imes 2$ *Magma Brute*) logs an entry in the Bestiary, unlocking its recipe.
2. **Core Essence Drops:** Defeating that specific mob yields its core component (e.g., *Molten Core*, *Grave Sinew*).
3. **Regional Gathering:** Players forage open-world minerals, elemental flora, or relic fragments required by the recipe.
4. **Scribing / Forging:** Reagents are assembled at a town Scribe or campfire to create the permanent minion card.

---

### 3.4 Environmental Hazard Harvesting & Card Variance

Interacting with field hazards yields deployable obstacle and trap cards with randomized sub-stats pulled from a variance pool (mirroring Companion stat variance):

| Field Hazard Source | Rolled Variant Tier | Variable Stat / Perk Result |
| :--- | :--- | :--- |
| **Toxic Briar** | **Defensive Roll** | $8	ext{ HP Obstacle}$; applies $+1	ext{ Poison Stack}$ to melee attackers. |
| **Toxic Briar** | **Offensive Roll** | $4	ext{ HP Obstacle}$; upon destruction, deals $3	ext{ damage}$ in a $3	imes3$ acid burst. |
| **Explosive Urn** | **Rune-Catalyst Roll** | $5	ext{ HP Obstacle}$; spawns with a dormant *Cinder Rune* pre-attached. |

---

## 4. Deck Customization & Duplicate Rules

```
[Small Deck: 12–15 Cards] ◄─────────────── [Standard: 16–20] ───────────────► [Large Deck: 21–30 Cards]
         │                                                                             │
(High Consistency / Burst)                                                     (High Utility / Adaptability)
```

### 4.1 Dynamic Deck Sizing (12–30 Cards)
Players configure active decks from their collection binder within a 12-to-30-card range:
* **Small Decks (12–15 Cards):** Delivers maximum cycling speed. Ideal for focused combo strategies aiming to draw specific Rune triggers and sacrifice spikes every 2–3 turns.
* **Large Decks (21–30 Cards):** Accommodates situational tools, extra obstacles, multiple $2 	imes 2$ Behemoths, and multi-elemental cards, trading draw consistency for adaptability.

---

### 4.2 Duplicate Limits: Option A (Power Tier Dynamic Cap)

To preserve spatial balance on the tactical grid without restricting deck customization, cards adhere to a tier-based duplicate cap:

| Card Tier / Category | Representative Examples | Max Copies Allowed | Design Function |
| :--- | :--- | :---: | :--- |
| **Tier 1: Basic Minions & Utility** | *Scout Imp*, *Spark Wisp*, *Shield Bash* | **3 Copies** | Ensures early-game frontline consistency without hand clogging. |
| **Tier 2: Runes, Wards & Obstacles** | *Cinder Rune*, *Stone Barricade*, *Aegis Ward* | **2 Copies** | Enables multi-tile combos without infinite grid stalling. |
| **Tier 3: Behemoths & Finishers** | *Magma Brute* ($2 	imes 2$), *Cataclysmic Core* | **1 Copy** | Prevents unblockable $2 	imes 2$ walls and repetitive board clears. |

---

## 5. Technical Implementation Schema (JSON)

```json
{
  "ProgressionArchitecture": {
    "DeckLimits": {
      "MinDeckSize": 12,
      "MaxDeckSize": 30,
      "DuplicateRules": {
        "Tier1_BasicMinionsAndUtility": 3,
        "Tier2_RunesWardsObstacles": 2,
        "Tier3_BehemothsAndFinishers": 1
      }
    },
    "RenownSystem": {
      "MaxTiers": 3,
      "Tiers": [
        {
          "Tier": 1,
          "Name": "Novice Wanderer",
          "AIPattern": "Basic_Linear",
          "AnteAllowed": true,
          "RewardMultiplier": 1.0
        },
        {
          "Tier": 2,
          "Name": "Adept Journeyman",
          "AIPattern": "Tactical_Behemoths_Wards",
          "AnteAllowed": true,
          "RewardMultiplier": 1.75
        },
        {
          "Tier": 3,
          "Name": "Master Duelist",
          "AIPattern": "Devour_CascadeChains_Optimized",
          "AnteAllowed": true,
          "RewardMultiplier": 3.0
        }
      ]
    },
    "CompanionRollEngine": {
      "StatModifierSlots": 1,
      "PassiveTraitSlots": 1,
      "SignatureSpellSlots": 1,
      "AffinityBonusMultiplier": 1.25
    },
    "CraftingSystem": {
      "BlueprintSource": "Bestiary_Achievement",
      "ReagentCategories": [
        "Core_Mob_Essence",
        "Regional_Field_Mineral",
        "Elemental_Flora"
      ],
      "CraftingNodes": ["Town_Inscriber", "Campfire_Forge"]
    }
  }
}
```
