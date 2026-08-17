# MODULE 1: ELEMENTAL SCHOOLS & SPELL MATRIX
**Document Version:** 1.0  
**System Anchor:** Grid-Based Tactical Deckbuilder  
**Related Modules:** Core Combat Rules (Draft 7.0), Progression & Companions (Draft 1.0)

---

```
                              ┌────────────────────────┐
                              │    ARCANE (NEUTRAL)    │
                              │ Baseline Utility/Draw  │
                              └───────────┬────────────┘
         ┌──────────────┬─────────────────┼─────────────────┬──────────────┐
  ┌──────┴──────┐┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐┌──────┴──────┐
  │    PYRE     ││    FROST    │   │    SURGE    │   │   BULWARK   ││    DUSK     │
  │ Burst / Trap││ Control/Wall│   │ Chains/Tempo│   │ Armor/Shove ││Sacrifice/Raw│
  └──────┬──────┘└──────┬──────┘   └──────┬──────┘   └──────┬──────┘└──────┬──────┘
         └──────────────┼─────────────────┴─────────────────┼──────────────┘
                                   ┌──────┴──────┐
                                   │    BLOOM    │
                                   │Toxin/Hazards│
                                   └─────────────┘
```

---

## 1. Executive Summary & Design Pillars

Module 1 establishes the mathematical, spatial, and mechanical rules governing magic in **CONJURE**. The magic system is structured around three foundational pillars:

1. **Universal Energy, Divergent Output:** All schools draw from the unified universal **Pip** (bankable up to 5) and **Temporary Spark** resource pool. Differentiation occurs through card costs, hand tempo, and spatial manipulation rather than colored resource pools.
2. **Open Draft with Resonance Anchors:** Players may draft any card from any school at any time. However, controlling active companions on the battlefield unlocks amplified card effects (**Attuned**) and triggers continuous passive field engines (**Resonance**).
3. **Emergent Reaction Matrix:** When spells, statuses, and runes from differing schools collide on the same grid tile or unit, deterministic **Elemental Reactions** trigger, rewarding multi-school hybrid deckbuilding.

---

## 2. Magic School Comprehensive Profiles

```
┌──────────┬─────────────────────────────┬────────────────────────────┬─────────────────────────────┐
│ School   │ Primary Spatial Vector      │ Resource Signature         │ Delayed Trigger Type        │
├──────────┼─────────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ Pyre     │ Front-arc cleaves, fire pits│ High-cost Pip conversion   │ Cinder Rune (Direct Damage) │
│ Frost    │ Ice barricades, LoS blocks  │ Defensive tempo / Banking  │ Frost Rune (Shatter/Impact) │
│ Surge    │ Orthogonal arc chains       │ Low-cost refunds / Sparks  │ Static Rune (Displacement)  │
│ Bulwark  │ Lane shoves, wall slams     │ Armor-to-Spark conversion  │ Tremor Rune (Impact/Stun)   │
│ Dusk     │ Tile Devour, friendly sac   │ Sacrifices for raw Pips    │ Soul Rune (Death Trigger)   │
│ Bloom    │ Hazard briars, line snares  │ Low-cost stack escalation  │ Spore Rune (Death AoE)      │
└──────────┴─────────────────────────────┴────────────────────────────┴─────────────────────────────┘
```

---

### 2.1 Pyre

* **Flavor & Theme:** Volatile combustion, lingering hellfire, and sudden explosive detonations.
* **Grid Mechanics:** Excels at directional cleaves (cone and T-shaped AoE) and seeding tiles with burning ground.
* **Resource Profile:** High Pip costs (2 to 4 Pips); specializes in converting banked resources into board wipes.
* **Core Keywords:**
  * **Ignite (X):** Applies $X$ stacks of Burn. Burn ticks at turn start against Persistent Armor first, then HP, degrading by 1 stack per turn.
  * **Combust:** Instantly triggers total remaining Burn damage on the target in a single hit and clears the stacks.
* **Delayed Rune Mechanism:** **Cinder Rune**
  * *Trigger Condition:* Placed on an enemy or tile. Detonates when the marked target receives direct unblocked physical or spell damage.
  * *Effect:* Deals 4 flat fire damage to the target and leaves a Burning Hazard on that tile for 1 turn.

---

### 2.2 Frost

* **Flavor & Theme:** Glacial stasis, crystalline defense, line-of-sight manipulation, and absolute cold.
* **Grid Mechanics:** Conjures destructible ice barricades on empty tiles to alter pathing and block ranged enemy attacks.
* **Resource Profile:** Mid-cost (1 to 2 Pips); defensive tempo that preserves health to bank Pips safely.
* **Core Keywords:**
  * **Chill (X):** Reduces target MOV by $X$ (minimum 0).
  * **Freeze:** Triggered when a unit reaches 3 Chill stacks. The target cannot move or declare attacks on its next turn. *(Note: Escalation growth continues during Freeze).*
  * **Brittle:** Frozen or brittle targets take +2 bonus damage from physical strikes and collision impacts.
* **Delayed Rune Mechanism:** **Frost Rune**
  * *Trigger Condition:* Placed on a tile or obstacle. Detonates when an adjacent obstacle shatters or an adjacent unit is shoved.
  * *Effect:* Applies Chill (2) and Brittle to all adjacent units in a cross pattern (+).

---

### 2.3 Surge

* **Flavor & Theme:** Raw kinetic voltage, electrical acceleration, high velocity, and chaining arcs.
* **Grid Mechanics:** Punishes clustered enemy formations by jumping damage orthogonally and diagonally.
* **Resource Profile:** Ultra-low cost (0 to 2 Pips); card-chaining focus that refunds Pips and generates Temporary Sparks.
* **Core Keywords:**
  * **Arc (X):** Deals 50% of primary strike damage to up to $X$ adjacent enemy units.
  * **Overload:** Unlocks bonus parameters if this is the 3rd or subsequent card played during the current turn.
* **Delayed Rune Mechanism:** **Static Rune**
  * *Trigger Condition:* Inscribed on a grid cell. Detonates the instant any unit steps into or is forcibly shoved onto the tile.
  * *Effect:* Deals 3 lightning damage to the unit and discharges Arc (2) to surrounding units.

---

### 2.4 Bulwark

* **Flavor & Theme:** Tectonic mass, physical impact, earthen shields, and kinetic displacement.
* **Grid Mechanics:** Heavy emphasis on lane displacement (Shoves and Pulls), utilizing back-wall impacts (3 damage) and friendly/enemy collisions (2 damage).
* **Resource Profile:** Flexible (1 to 3 Pips); converts built-up Persistent Armor into offensive damage output.
* **Core Keywords:**
  * **Shove (X):** Pushes target unit $X$ tiles directly backward along its current lane vector.
  * **Fortify (X):** Grants $X$ Persistent Armor (does not decay at round end).
  * **Concuss:** Collision damage dealt by this unit or spell scales with 50% of the user's current Persistent Armor.
* **Delayed Rune Mechanism:** **Tremor Rune**
  * *Trigger Condition:* Placed on a unit or tile. Triggers when the target suffers forced displacement or collision impact.
  * *Effect:* Deals 3 physical damage and Stuns the target (reduces target's next turn MOV to 0).

---

### 2.5 Dusk

* **Flavor & Theme:** Shadow rites, soul extraction, cannibalistic board sacrifices, and necromancy.
* **Grid Mechanics:** Utilizes Devour Spawning, deploying higher-tier companions directly over friendly tokens to consume them for instant buffs.
* **Resource Profile:** Extreme resource generation; sacrifices friendly HP and board units for raw Sparks and card draw.
* **Core Keywords:**
  * **Devour:** Summon this unit on top of an allied minion/companion. Destroys the occupant and grants the summoner its remaining stats as Temporary Armor.
  * **Hollow (X):** When this unit dies or is sacrificed, grant +$X$ Temporary Sparks to the player on the following turn.
* **Delayed Rune Mechanism:** **Soul Rune**
  * *Trigger Condition:* Inscribed on a tile or friendly unit. Detonates when any friendly unit in the same lane dies or is sacrificed.
  * *Effect:* Drains 3 HP from the closest enemy in that lane and grants +1 Card Draw.

---

### 2.6 Bloom

* **Flavor & Theme:** Overgrowth, toxic spores, creeping briars, and parasitic life-leeching.
* **Grid Mechanics:** Seeds lane hazard tiles (Briar Patches) that snare approaching enemies and restrict maneuverability.
* **Resource Profile:** Low initial cost (1 to 2 Pips) with exponential damage output over sustained combat rounds.
* **Core Keywords:**
  * **Toxin (X):** Ticks at turn start. **Bypasses Persistent Armor completely** to deal true damage to HP, degrading by 1 stack per turn.
  * **Entangle:** Unit MOV is reduced to 0 for 1 turn. The unit may still declare attacks within its natural reach.
  * **Leech (X):** Whenever the affected target takes damage, heal the player's lowest-health unit by $X$.
* **Delayed Rune Mechanism:** **Spore Rune**
  * *Trigger Condition:* Inscribed on an enemy. Detonates upon that enemy's death.
  * *Effect:* Bursts in a cross pattern (+), applying Toxin (3) to all surrounding units.

---

### 2.7 Arcane (Neutral Discipline)

* **Flavor & Theme:** Raw runic manipulation, physical martial prowess, and general tactical utility.
* **Deck Role:** Available in all card pools regardless of active party composition. Provides universal card cycling, Retain manipulation, raw Pip generation, and non-elemental strikes.
* **Core Keywords:**
  * **Retain:** This card is not discarded at the end of the round.
  * **Channel:** Convert 1 unspent Pip into +2 Temporary Sparks next turn.
  * **Cycle (X):** Discard up to $X$ cards from hand, then draw that many cards.

---

## 3. Dual Synergy Architecture: Attuned + Resonance

CONJURE uses an **Open Draft Pool** combined with two synergy layers: **Attuned** (Card level) and **Resonance** (Unit level).

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                       SPELL CAST RESOLUTION FLOW                        │
 └─────────────────────────────────────────────────────────────────────────┘
                                      │
                         [PLAYER PLAYS "PYRE" SPELL]
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
         [CARD LAYER: ATTUNED CHECK]       [UNIT LAYER: RESONANCE CHECK]
                     │                                 │
         Is an allied Pyre Companion       Allied Pyre Companion detects
            alive on battlefield?             matching spell played.
                     │                                 │
            ┌────────┴────────┐                        ▼
           YES                NO               Triggers Unit Passive
            │                 │              (e.g., Gain 2 Persistent
            ▼                 ▼               Armor or free Step move)
      Triggers Base    Triggers Base
      + Attuned Bonus  Effect Only
```

### 3.1 The "Attuned" Keyword (Card-Level Scaling)
Every colored spell has a functional baseline effect usable by any party configuration. Controlling a companion of the matching school activates the card's **Attuned** bonus.

* **Design Rule:** The base effect must be cost-efficient (baseline 1.0x curve), while the Attuned bonus elevates the card to high efficiency (1.4x to 1.6x curve).
* **Example:**
  * *Base Cast:* Deal 3 damage.
  * *Attuned Cast:* Deal 3 damage. If the target has Burn, trigger **Combust** and refund +1 Spark.

### 3.2 Companion Resonance (Unit-Level Field Engines)
Companions act as elemental conduits on the board. Playing a card of their matching school triggers their innate **Resonance Passive**:

```
┌──────────┬──────────────────────────┬────────────────────────────────────────────────────────────────┐
│ School   │ Companion Class Archetype│ Resonance Passive Ability                                      │
├──────────┼──────────────────────────┼────────────────────────────────────────────────────────────────┤
│ Pyre     │ Fire-Weaver Mage         │ Whenever you play a Pyre spell, apply Ignite (1) to all        │
│          │                          │ enemies in this companion's row.                               │
│ Frost    │ Glacial Sentinel         │ Whenever you play a Frost spell, this unit gains +2            │
│          │                          │ Persistent Armor.                                              │
│ Surge    │ Storm Conduit            │ The first Surge spell cast each turn refunds +1 Spark.         │
│ Bulwark  │ Earth Bastion            │ Whenever you play a Bulwark spell, this unit may Shove an      │
│          │                          │ adjacent enemy 1 tile.                                         │
│ Dusk     │ Shadow Harvester         │ Whenever you play a Dusk spell, heal this unit for 2 HP.       │
│ Bloom    │ Briar Shaman             │ Whenever you play a Bloom spell, apply Toxin (1) to the enemy  │
│          │                          │ with the lowest HP on the grid.                                │
└──────────┴──────────────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## 4. The 15 Cross-Elemental Reaction Matrix

When elements interact on the same target or tile, they trigger specific deterministic **Elemental Reactions**:

```
                              ┌───────────────┐
                              │     PYRE      │
                              └──┬────┬────┬──┘
                  ┌──────────────┘    │    └──────────────┐
             ┌────┴───┐          ┌────┴───┐          ┌────┴───┐
             │ FROST  │          │ SURGE  │          │BULWARK │
             └────┬───┘          └────┬───┘          └────┬───┘
                  └──────────────┐    │    ┌──────────────┘
                              ┌──┴────┴────┴──┐
                              │  DUSK / BLOOM │
                              └───────────────┘
```

| Combination | Reaction Name | Trigger Condition | Board Resolution / Tactical Outcome |
| :--- | :--- | :--- | :--- |
| **Pyre + Frost** | **Vaporize** | Fire spell hits Frozen target OR Ice hits Burning tile | Spawns a **Steam Fog** cloud on the tile for 2 turns. Blocks all ranged Line of Sight (LoS) through that tile. |
| **Pyre + Surge** | **Plasma Burst** | Surge spell strikes a target with Ignite (3+) | Consumes 2 Burn stacks to deal 4 bonus electric damage that arcs to all units in the same row. |
| **Pyre + Bulwark** | **Magma Surge** | Bulwark shove forces an enemy onto a Burning tile | Deals collision damage (3 pts) plus instantly doubles the enemy's remaining Burn stacks. |
| **Pyre + Dusk** | **Soulfire** | Friendly unit with Burn is Sacrificed / Devoured | Detonates in a 3x3 AoE, dealing fire damage equal to the sacrificed unit's lost HP. |
| **Pyre + Bloom** | **Wildfire** | Fire spell strikes an enemy affected by Toxin | Consumes all Toxin stacks to trigger an immediate AoE explosion dealing 2x Toxin Stacks as fire damage. |
| **Frost + Surge** | **Superconduct** | Surge spell strikes a unit with Chill (2+) or Freeze | Deals +3 critical shock damage and chains full damage to all units sharing the target's grid column. |
| **Frost + Bulwark** | **Shatter** | Physical strike or Shove collision hits a Frozen unit | Instantly breaks Freeze, completely strips all Persistent Armor from target, and deals 4 shrapnel damage to adjacent units. |
| **Frost + Dusk** | **Black Ice** | Frozen enemy is killed or sacrificed | Spawns a permanent Soul Rune on that cell; the next enemy entering that cell is instantly Frozen for 1 turn. |
| **Frost + Bloom** | **Permafrost** | Toxin applied to a Frozen / Chilled target | Target is **Entangled** for 2 turns; Toxin cannot naturally degrade while the unit remains Chilled. |
| **Surge + Bulwark** | **Kinetic Arc** | Shocked enemy is shoved into an ally or wall | Collision impact releases an electric blast dealing 3 damage to all units within 1 tile radius. |
| **Surge + Dusk** | **Volatile Spark** | Friendly unit with Overload is sacrificed | Immediately refunds +2 Banked Pips (stored into player's main reservoir). |
| **Surge + Bloom** | **Bio-Pulse** | Toxin ticks on an enemy holding Static Runes | Toxin tick automatically discharges 1 electrical shock to all adjacent enemies without consuming the rune. |
| **Bulwark + Dusk** | **Bone Bastion** | Sacrificing a unit with Persistent Armor | Converts 100% of sacrificed unit's Persistent Armor into permanent Max HP for the Devour summoner. |
| **Bulwark + Bloom** | **Iron Briar** | Bulwark spell cast on a tile occupied by Briars | Briars become Fortified (10 HP obstacle) and reflect 2 physical damage back to attackers. |
| **Dusk + Bloom** | **Blight Siphon** | Dusk strike against an enemy with Toxin (3+) | Bypasses armor to drain 3 HP from the enemy, distributing it as direct healing across all active allied companions. |

---

## 5. Status Effect Lifecycle & Turn-Start Queue

All status effects and recurring board triggers resolve deterministically at the **start of the affected unit's turn** in the following sequence:

```
[UNIT TURN START]
   │
   ├─► STEP 1: TRUE DAMAGE RESOLUTION
   │           └─► Toxin Stacks tick (Deals direct damage to HP; bypasses Persistent Armor).
   │           └─► Toxin stack degrades by 1.
   │
   ├─► STEP 2: MITIGATED DAMAGE RESOLUTION
   │           └─► Burn Stacks tick (Deals damage to Persistent Armor first, then HP).
   │           └─► Burn stack degrades by 1.
   │
   ├─► STEP 3: ACTION & MOVEMENT CHECK
   │           ├─► Chill / Freeze: If Chill = 3, unit is Frozen (Skip Action Phase; Reset Chill to 0).
   │           └─► Entangle: MOV set to 0 (Unit can still declare in-range attacks).
   │
   ├─► STEP 4: SPATIAL HAZARD & TILE RESOLUTION
   │           └─► Check ground tile (Burning Ground, Steam Fog, Briars). Apply entry/turn-start effects.
   │           └─► Decrement tile hazard durations.
   │
   └─► STEP 5: ESCALATION ENGINE
               └─► Unit stat scaling applies (Escalation triggers regardless of Freeze/Stun status).
```

---

## 6. Blueprint Spell Catalog (30 Foundational Cards)

```
┌────────────────────────┬───────┬──────┬─────────┬─────────────────────────────────────────────────────────────┐
│ Card Name              │ School│ Cost │ Rarity  │ Mechanical Specification                                    │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 1. Cinder Dart         │ Pyre  │ 1 Pip│ Common  │ Deal 3 damage. If target has Burn, apply Combust.           │
│                        │       │      │         │ [Attuned: Pyre] Refund +1 Spark if Combust triggers.        │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 2. Searing Wave        │ Pyre  │ 2 Pip│ Common  │ Deal 3 fire damage to all enemies in target row; Ignite (1).│
│                        │       │      │         │ [Attuned: Pyre] Leaves Burning Ground for 1 turn.           │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 3. Magma Lance         │ Pyre  │ 2 Pip│ Uncomm. │ Deal 6 damage in a 3-tile straight line piercing through.   │
│                        │       │      │         │ [Attuned: Pyre] Applies Ignite (2) to all units pierced.    │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 4. Cinder Ward         │ Pyre  │ 1 Pip│ Uncomm. │ Inscribe Cinder Rune on target ally or enemy.               │
│                        │       │      │         │ [Attuned: Pyre] Detonation damage increased from 4 to 7.    │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 5. Cataclysm           │ Pyre  │ 4 Pip│ Rare    │ Deal 10 damage to a 2x2 area; applies Ignite (3).           │
│                        │       │      │         │ [Attuned: Pyre] Instantly triggers Combust on all targets.  │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 6. Ice Shard           │ Frost │ 1 Pip│ Common  │ Deal 2 damage; apply Chill (1).                             │
│                        │       │      │         │ [Attuned: Frost] If target already Chilled, apply Chill (2).│
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 7. Glacial Barricade   │ Frost │ 1 Pip│ Common  │ Conjure an Ice Block (6 HP) on target empty cell (blocks LoS)│
│                        │       │      │         │ [Attuned: Frost] Ice Block gains +4 HP and Brittle aura.    │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 8. Flash Freeze        │ Frost │ 2 Pip│ Uncomm. │ Target unit with Chill (2+) is instantly Frozen and Brittle.│
│                        │       │      │         │ [Attuned: Frost] Apply Chill (1) to all adjacent enemies.   │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 9. Frost Rune Inscription│ Frost│ 1 Pip│ Uncomm. │ Place Frost Rune on tile; detonates on adjacent movement.   │
│                        │       │      │         │ [Attuned: Frost] Detonation applies Freeze directly.        │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 10. Absolute Zero      │ Frost │ 3 Pip│ Rare    │ Freeze all units in target column for 1 turn.               │
│                        │       │      │         │ [Attuned: Frost] Grant all allied units +4 Persistent Armor.│
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 11. Forked Bolt        │ Surge │ 1 Pip│ Common  │ Deal 3 damage + Arc (1) to closest adjacent unit.           │
│                        │       │      │         │ [Attuned: Surge] Arc jumps to 2 targets instead of 1.       │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 12. Galvanic Step      │ Surge │ 1 Pip│ Common  │ Move target companion 1 tile; next attack deals +2 damage.  │
│                        │       │      │         │ [Attuned: Surge] Refunds +1 Spark on movement completion.   │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 13. Static Mine        │ Surge │ 1 Pip│ Uncomm. │ Place Static Rune on empty cell (3 damage + Arc on enter).  │
│                        │       │      │         │ [Attuned: Surge] Place 2 runes instead of 1.                │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 14. Overload Surge     │ Surge │ 2 Pip│ Uncomm. │ Deal 5 damage. Overload: If 3rd card played, costs 0 Pips.  │
│                        │       │      │         │ [Attuned: Surge] Draw 1 card when Overload triggers.        │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 15. Chain Tempest      │ Surge │ 3 Pip│ Rare    │ Deal 4 damage to target; arcs through all connected enemies.│
│                        │       │      │         │ [Attuned: Surge] Each arc hit refunds +1 Spark.             │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 16. Shield Slam        │Bulwark│ 1 Pip│ Common  │ Deal damage equal to user's Persistent Armor + Shove 1.     │
│                        │       │      │         │ [Attuned: Bulwark] Shove distance increased to 2 tiles.     │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 17. Earth Ward         │Bulwark│ 1 Pip│ Common  │ Grant target allied companion +5 Persistent Armor.          │
│                        │       │      │         │ [Attuned: Bulwark] Target gains Concuss keyword for 1 turn. │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 18. Tectonic Stomp     │Bulwark│ 2 Pip│ Uncomm. │ Shove all units in front rank back 1 tile; deal 2 damage.   │
│                        │       │      │         │ [Attuned: Bulwark] Collision damage increased from 3 to 5.  │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 19. Tremor Trap        │Bulwark│ 1 Pip│ Uncomm. │ Inscribe Tremor Rune; triggers on target shove/impact.      │
│                        │       │      │         │ [Attuned: Bulwark] Applies Stun for 1 turn on detonation.   │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 20. Impassable Wall    │Bulwark│ 3 Pip│ Rare    │ Grant +10 Persistent Armor; user cannot be shoved this round│
│                        │       │      │         │ [Attuned: Bulwark] Reflect 50% collision damage to attacker.│
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 21. Dark Extraction    │ Dusk  │ 1 Pip│ Common  │ Deal 4 damage. If this kills the target, draw 1 card.       │
│                        │       │      │         │ [Attuned: Dusk] Gain +2 Temporary Sparks next turn.         │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 22. Grim Offering      │ Dusk  │ 0 Pip│ Common  │ Destroy a friendly minion/token to gain +2 Pips this turn.  │
│                        │       │      │         │ [Attuned: Dusk] Draw 2 cards.                               │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 23. Soul Rune Trap     │ Dusk  │ 1 Pip│ Uncomm. │ Place Soul Rune on ally; triggers when ally dies/devoured.  │
│                        │       │      │         │ [Attuned: Dusk] Deals 5 damage to lowest-HP enemy in lane.  │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 24. Devouring Shadow   │ Dusk  │ 2 Pip│ Uncomm. │ Devour target friendly token; grant summoner +3/+3 stats.   │
│                        │       │      │         │ [Attuned: Dusk] Summoner immediately gains Hollow (2).      │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 25. Nether Rift        │ Dusk  │ 3 Pip│ Rare    │ Destroy all friendly tokens; deal 4 damage per token to all.│
│                        │       │      │         │ [Attuned: Dusk] Resummon consumed tokens as 1/1 Skeletons.  │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 26. Thorn Strike       │ Bloom │ 1 Pip│ Common  │ Deal 2 damage; apply Toxin (2).                             │
│                        │       │      │         │ [Attuned: Bloom] Apply Toxin (3) and Entangle for 1 turn.   │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 27. Briar Patch        │ Bloom │ 1 Pip│ Common  │ Seed tile with Briars (deals 2 true damage, sets MOV to 0). │
│                        │       │      │         │ [Attuned: Bloom] Briar spreads to 1 adjacent empty cell.    │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 28. Leech Seed         │ Bloom │ 2 Pip│ Uncomm. │ Apply Leech (2) to target enemy.                            │
│                        │       │      │         │ [Attuned: Bloom] Direct spell damage heals all allies for 1.│
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 29. Spore Inscription  │ Bloom │ 1 Pip│ Uncomm. │ Inscribe Spore Rune on target; bursts into AoE Toxin on death│
│                        │       │      │         │ [Attuned: Bloom] Spore explosion area increases to 3x3.     │
├────────────────────────┼───────┼──────┼─────────┼─────────────────────────────────────────────────────────────┤
│ 30. Verdant Bloom      │ Bloom │ 3 Pip│ Rare    │ Double all active Toxin stacks on all enemies on the grid.  │
│                        │       │      │         │ [Attuned: Bloom] Heal commander HP equal to total stacks.   │
└────────────────────────┴───────┴──────┴─────────┴─────────────────────────────────────────────────────────────┘
```

---

## 7. Strategic Deckbuilding Archetypes

Under the Open Draft + Attuned framework, deck construction supports three major competitive archetypes:

```
┌────────────────────────┬──────────────────────────────────┬──────────────────────────────────────────┐
│ Deck Archetype         │ Roster Configuration             │ Strategic Advantage & Win Condition      │
├────────────────────────┼──────────────────────────────────┼──────────────────────────────────────────┤
│ Mono-School Focus      │ 1 Commander + 3 Matching Units   │ • 100% Attuned activation rate.          │
│                        │ (e.g., Pure Pyre)                │ • Exponential stacking of single debuff. │
│                        │                                  │ • Vulnerable to element-immune bosses.   │
├────────────────────────┼──────────────────────────────────┼──────────────────────────────────────────┤
│ Dual-School Hybrid     │ 2 & 2 Split Roster               │ • Consistent Cross-Reactions (Shatter,   │
│                        │ (e.g., Frost + Bulwark)          │   Wildfire, Superconduct).               │
│                        │                                  │ • Balanced offense and board control.    │
├────────────────────────┼──────────────────────────────────┼──────────────────────────────────────────┤
│ Multi / Rainbow Splash │ 3+ Mixed Schools                 │ • Maximum tactical flexibility.          │
│                        │ (e.g., Pyre + Frost + Dusk)      │ • Access to hard counters for every node.│
│                        │                                  │ • Lower Attuned consistency on cards.    │
└────────────────────────┴──────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 8. Integration & Implementation Verification

When implementing Module 1 into the engine, verify the following logical constraints:

1. **Deterministic Resolution:** Status effects must tick in the exact order specified in Section 5 (Toxin -> Burn -> Freeze check -> Hazards -> Escalation).
2. **LoS Calculations:** Steam Fog (Vaporize reaction) and Ice Barricades (Frost) must dynamically cast raycast shadows across grid columns to occlude ranged targeting.
3. **Collision Checks:** Any unit shoved via Bulwark spells into an occupied tile or border must trigger collision damage calculations (3 wall / 2 unit) before any secondary rune detonations resolve.
4. **Attuned State Tracking:** The card execution pipeline must query the active combatant array to verify matching school presence before resolving card parameters.
