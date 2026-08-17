# Tactical Card Battler — Game Design Document (Draft 7.0)
## Module 5: Boss Architecture & Enemy AI Decision Trees

This document establishes the tactical AI decision engine, action utility scoring heuristics, devour/spark resource optimization, difficulty scaling algorithms, and multi-phase encounter sheets for Continental Apex Bosses.

---

## 1. Tactical AI Decision Architecture & Heuristic Engine

The AI evaluates grid states and hand combinations deterministically using a **Dynamic Utility Scoring Matrix**. Rather than relying on hardcoded attack scripts, the AI calculates action utility scores across every legal play, choosing the highest-value action sequence within its execution budget.

### 1.1 Action Utility Scoring Formula

Every candidate action is evaluated using the composite utility function:

$$U(a) = w_{\text{kill}} \cdot S_{\text{kill}} + w_{\text{face}} \cdot S_{\text{face}} + w_{\text{threat}} \cdot S_{\text{threat}} + w_{\text{pos}} \cdot S_{\text{pos}} + w_{\text{eff}} \cdot S_{\text{eff}} - w_{\text{risk}} \cdot S_{\text{risk}}$$

**Utility Score Parameters:**
* **Lethal / Unit Elimination Score:** Player Hero Lethal grants +10,000 (Overriding priority). Standard Minion Kill grants +50 per Card Tier, plus +10 per Current Escalation Stack.
* **Portrait Pressure Score:** Direct damage dealt to Player Hero grants +15 per point of Damage Dealt. Multiplied by 0.2x if a Player minion with active Escalation is currently on the board.
* **Threat Neutralization Score:** Displacing or killing a minion holding an active Rune grants +40. Destroying a Guardian minion occluding Line of Sight (LoS) grants +60.
* **Positional & Collision Score:** Pushing a player minion into a wall or another unit (3/2 Collision Damage) grants +45. Positioning a Guardian ally into the LoS cone protecting Boss grants +35.
* **Resource Efficiency Score:** Sparks consumed before expiration grants +10 per Spark. Pips preserved below the 8-Pip Bank cap grants +5 per Pip.
* **Self-Damage & Counter Risk Score:** Attacking a target with active Counter deducts Counter Damage x 12. Triggering an enemy Rune that causes friendly collateral damage deducts Collateral Damage x 15.

### 1.2 Target Prioritization Hierarchy

When selecting targets for spells, ranged attacks, and movement vectors, the AI filters targets through this priority order:

1.  **Lethal Boss-to-Hero Vector:** Direct path to reduce Player HP to 0.
2.  **Escalating Minion Neutralization:** Targeting player minions that survived 1 or more rounds before their turn-start Escalation buffs trigger.
3.  **Occlusion Breakers:** Eliminating Guardian minions or destructible Stone Barricades that block ranged LoS vectors to the Player portrait.
4.  **Collision Setups:** Using displacement spells (Push / Pull) to shove player units into walls (3 damage) or other player units (3/2 split damage).
5.  **Rune Detonation Triggers:** Applying elemental attacks to penetrate Armor to trigger equipped Runes and Cascades.
6.  **Face Chipping:** Direct damage to the Player Hero portrait when no high-priority grid threats exist.

---

## 2. Resource, Spark Generation & Devour Management

The AI does not blindly cast every card in its hand. It dynamically manages the dual-resource engine (Persistent Pips up to 8 + Turn-Only Sparks).

### 2.1 Pip Banking Thresholds

* **Ramp Phase (Pips 1 to 4):** The AI will spend only what is strictly necessary to contest board territory (Rows 4 and 3), holding at least 1 to 2 Pips to accelerate into high-cost cards.
* **Capacity Management (Pips 6 to 8):** If the AI ends its turn at 8 Pips, the +1 Turn Start Pip would be wasted. The AI prioritizes casting at least one mid-cost minion or obstacle to prevent resource overflow.
* **Burst Turn Trigger:** If the AI's banked Pips plus potential sacrifice Sparks equal a Power Tier card cost (e.g., 5-Pip Finisher or 6-Pip Behemoth), it executes a full resource flush in a single turn.

### 2.2 Devour & Sacrifice Decision Heuristics

The AI scans its active minions on Rows 4 and 5 at the start of its Main Phase to identify Devour Candidates using the following formula:

$$D_{\text{score}} = (\text{Max HP} - \text{Current HP}) + (\text{Debuff Stacks} \times 3) - (\text{Escalation Stacks} \times 4)$$

* **Condition A (Doomed Unit Reclamation):** If a friendly minion has 2 HP or less and is afflicted with a recurring status effect (Burn, Poison) that will kill it at the start of the next round, the score exceeds 10. The AI devours the unit or casts a new minion over its tile, capturing its sacrifice Sparks before it dies.
* **Condition B (Tile Unlocking for Behemoths):** 2x2 Behemoths require a clear 2x2 footprint. If a 1x1 chaff minion occupies one of the four required deployment tiles, the AI devours the blocking minion to deploy the Behemoth immediately.
* **Condition C (Rune Fizzle Prevention):** If a friendly minion with a detonate-on-death Rune is about to be destroyed by an unaligned physical attack (which would fizzle the rune), the AI sacrifices the minion itself via spells to force the detonation.

---

## 3. Difficulty Scaling & Algorithmic Tiers

AI opponents scale in tactical depth across the three Renown Tiers.

| AI Parameter | Novice Tier (Tier 0) | Adept Tier (Tier 1) | Master Tier (Tier 2) |
| :--- | :--- | :--- | :--- |
| **Search Depth / Lookahead** | Greedy (Current turn only) | 1-Turn Lookahead (Evaluates counter-attacks) | 2-Turn Lookahead (Predicts player resource curves) |
| **Sub-Optimal Move Rate** | 20% chance to pick 2nd/3rd best move | 5% chance of minor positional inaccuracy | 0% (Always executes mathematically optimal chain) |
| **Collision Awareness** | Ignores collision damage | Actively pushes units into empty walls | Calculates chain collisions (A into B into Wall) |
| **LoS Cone Usage** | Summons minions on random tiles | Places Guardians directly in front of Boss | Builds interlocking Guardian/Barricade walls |
| **Devour Efficiency** | Sacrifices only when forced | Devours units with 1 HP or less | Devours debuffed units to hit exact Pip points |
| **Rune Cascade Logic** | Detonates Runes in isolation | Targets Armor to ensure detonation | Sets up 3+ unit Cascade chain explosions |

---

## 4. Continental Apex Boss Encounters

### 4.1 Boss 1: Arch-Magister Vane & The Clockwork Colossus
**Continent:** The Crownreach Archonate
**Schools:** Surge / Arcane (Aether)
**Starting Life Pool:** 50 HP (Phase 1) to 50 HP (Phase 2)
**Arena Dimensions:** 5x5 Dynamic Grid
**Phase 1 (The Chrono-Leyline Siphon):** Passive — Temporal Rewind. At the end of every round, Vane shifts the position of the player's most advanced minion backward 1 tile.
**Phase 2 (The Colossus Awakens):** Triggers at 50% HP. Vane retreats off-grid and deploys **The Clockwork Colossus** (2x2 Master Behemoth, 30 HP, 4 ATK) onto tiles C4-D5. Passive switches to Overclock Surge, granting the Colossus +1 MOV and a 5-damage front cleave whenever a Shock spell is played.

### 4.2 Boss 2: Grand Astrologer Zahir & The Solar Pylon Engine
**Continent:** The Sunken Sultanate of Qal'Abar
**Schools:** Surge / Pyre
**Starting Life Pool:** 55 HP (Phase 1) to 45 HP (Phase 2)
**Arena Dimensions:** 6x5 Vitrified Sand Corridor
**Phase 1 (The Mirror Alignment):** Passive — Vitrified Reflection. Zahir's beam attacks ricochet off Pylons at 90-degree angles, bypassing Guardian LoS cones.
**Phase 2 (Orbital Convergence):** Triggers at 50% HP. Row 3 turns into Vitrified Glass (units slide indefinitely on impact). Zahir charges a global orbital strike every 3 turns dealing 8 Fire damage to non-occluded tiles.

### 4.3 Boss 3: Matriarch Morwenna & The Blighted Ancient
**Continent:** The Viridian Moot
**Schools:** Bloom / Dusk
**Starting Life Pool:** 60 HP (Single continuous pool with dynamic morph)
**Arena Dimensions:** 5x5 Overgrown Bog
**Phase 1 (The Spore Swarm):** Passive — Spore Explosion. Allied plant minions leave a Blight Spore hazard upon death that explodes for 3 Dusk Damage.
**Phase 2 (Wrath of the Blighted Ancient):** Triggers at 50% HP. Morwenna fuses with roots, spawning the **Blighted Ancient** (2x2 Behemoth, 35 HP). Passive switches to Parasitic Drain, stealing 1 HP from every poisoned unit on the board to add to Morwenna's Persistent Armor.

### 4.4 Boss 4: Warmaster Kaelen & The Magma Juggernaut
**Continent:** The Ashforged Bastion
**Schools:** Pyre / Bulwark
**Starting Life Pool:** 40 HP + 20 Persistent Armor (Phase 1) to 60 HP (Phase 2)
**Arena Dimensions:** 5x6 Slag Crucible
**Phase 1 (The Iron Phalanx):** Passive — Shield Wall Discipline. All enemy minions gain +2 Persistent Armor when deployed adjacent to an ally. Focuses heavily on displacement/push attacks.
**Phase 2 (Magma Core Meltdown):** Triggers at 50% HP. Row 3 collapses into active lava. Deploys the **Magma Juggernaut** (2x2 Behemoth, 40 HP, 6 ATK). Whenever the Juggernaut collides with an obstacle, player-occupied tiles suffer 2 Fire damage from falling slag.

---

## 5. Comprehensive Edge Cases & AI Failsafes

### 5.1 Grid Geometry & Spatial Failsafes

**The "Pacifist Lockout" (Anti-Stall Enrage):**
If the player completely obstructs the Boss summon zone with indestructible obstacles and refuses to attack, the AI is granted an Aetheric Overload heuristic. If the AI ends its turn with 8 Pips and a full hand for three consecutive rounds without dealing damage, it consumes all 8 Pips to cast an unblockable Overload Strike directly onto the Hero portrait for 10 True Damage.

**Behemoth Geometric Displacement Clipping (Anchor-Point Collision):**
If a 2x2 Behemoth is pushed and any tile of its footprint encounters an invalid space, the entire Behemoth immediately stops its movement on the last valid 2x2 coordinate. Standard Collision Damage is applied to the Behemoth and the specific obstructing unit, preventing clipping errors.

**Complete Board Lockout (Crush Summoning):**
If all tiles in the Boss summon zone are occupied by player Guardians or Barricades, the Boss uses "Crush Summoning." It casts high-tier minions directly on top of player obstacles, dealing Instant Crush Damage equal to the summoned minion's base ATK to the occupying entity.

### 5.2 AI Targeting & Heuristic Failsafes

**Infinite Evaluation Stall Prevention:**
The AI decision search tree is hard-capped at 150 iterations or 1.2 seconds of compute time. Once the execution budget of 8 actions per turn is hit, the AI must instantly pass priority.

**Symmetrical Utility Paralysis (Deterministic Spatial Seed):**
The AI never uses RNG to break utility score ties. Ties are broken by targeting the unit closest to the Boss's Row (Row 5). If they share a Row, it targets the leftmost unit (Column A to E).

**Bypassing Guardians via Offset Splash Targeting:**
To bypass Untargetable Guardians, the AI heuristic engine can evaluate empty grid tiles as primary targets for AoE spells. If the splash damage clips the Hero or protected minions, the AI executes the cast on the empty ground.

**Boss Self-Mutilation (Lethal Veto):**
If an action (like triggering a massive chain cascade) would reduce the Boss's HP to 0 without guaranteeing an immediate player defeat, the action's Utility Score is overwritten to a negative infinite value.

### 5.3 State Resolution & Timing Conflicts

**Simultaneous Status Effect Death (Active Turn Advantage):**
If both the Boss and Hero are at lethal HP thresholds with DoTs (Burn/Poison), the damage resolves based on turn priority. The entity whose turn it currently is takes their status damage first, ending the game before the opponent's debuff calculates.

**Armor Persistence Through Sudden Death:**
If mutual AoE damage triggers Sudden Death (both revive at 1 HP), all Persistent Armor is purged. Both entities enter Sudden Death entirely naked at 1 HP with a clean board.

**Mid-Action Deck Depletion (Fatigue Spark Burn):**
If a deck is empty, drawing a card does not reshuffle. Instead, each attempted card draw inflicts 1 point of True Damage directly to the commander's portrait and grants 1 temporary Spark to the opponent.

### 5.4 Boss Phase Transitions & Interruptions

**The Mid-Turn Phase Push (Damage Gates):**
Phase transitions are strict Damage Gates. Any single damage instance that pushes a Boss below the 50% threshold reduces their HP to exactly 50% and nullifies all remaining damage in that chain. The phase transition immediately interrupts the player's turn, executes the board transformation, and then passes priority back to the player.

**Status Effect Phase Triggers:**
If a DoT pushes the Boss below the transition threshold at the start of a turn, the transition triggers instantly. The Boss purges all active debuffs and DoTs, receives its Phase 2 hand, and then proceeds with its turn.

**The Behemoth Displacement Trap (Forced Eviction):**
If a player minion is sitting on the exact tiles where a Phase 2 Behemoth is scripted to spawn, the player minion is subject to Forced Eviction. It is returned to the player's hand, and its Pip cost is refunded as Temporary Sparks.

### 5.5 The Rite of Binding Mechanics

**The Full-Hand Binding Lock:**
When a Boss drops below 25% HP, the 0-Pip [Rite of Binding] card is generated. If the player's hand is full (8 cards), the Rite acts as an Ephemeral Overlay Card. It visually attaches to the HUD, temporarily pushing the hand limit to 9. It cannot be discarded or wagered.

---

## 6. Implementation Summary Table

| System Component | Core Architecture Rule | Edge Case / Balance Failsafe |
| :--- | :--- | :--- |
| **Heuristic Scoring** | Multi-variable utility formula prioritizing lethal, escalation defense, and collision. | 1.2s compute cap prevents turn stall; Spatial Seeding breaks ties deterministically. |
| **Resource Engine** | Dynamic Pip banking; holds Pips early, flushes for finishers. | Fatigue Spark Burn penalizes overdraw with True Damage. |
| **Devour Heuristics** | Scans doomed units to recycle Sparks before round-start death ticks. | DoTs detonate as AoE upon devour to prevent consequence-free recycling. |
| **Difficulty Scaling** | Novice (Greedy) to Master (2-turn lookahead + combos). | Lethal Veto Constraint prevents AI self-mutilation via cascades. |
| **Phase Transitions** | Arena transforms, Behemoth adds, and passive swaps at 50% HP. | Damage Gates prevent 1-turn burst skips; debuffs are purged on shift. |
| **Rite of Binding** | Boss HP < 25% unlocks 0-Pip binding ritual card for continental companions. | Ephemeral Overlay bypasses hand limits; Forced Eviction clears spawn tiles. |
| **Board Lockout** | Bosses use Crush Summoning if summon rows are obstructed. | Aetheric Overload deals unblockable True Damage if players indefinitely stall. |