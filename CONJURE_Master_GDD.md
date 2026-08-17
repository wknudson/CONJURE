# CONJURE: MASTER GAME DESIGN DOCUMENT
*The Comprehensive Blueprint for Demo & Full Game Production*

---

## TABLE OF CONTENTS
1. [Executive Summary & Core Loops](#1-executive-summary--core-loops)
2. [Master Glossary & Terminology](#2-master-glossary--terminology)
3. [Combat Architecture & Grid Engine](#3-combat-architecture--grid-engine)
4. [Magic Ecosystem: Schools & Reactions](#4-magic-ecosystem-schools--reactions)
5. [Master Bestiary & Card Database](#5-master-bestiary--card-database)
6. [Open-World Progression & Acquisition](#6-open-world-progression--acquisition)
7. [Economy, Itemization & Crafting](#7-economy-itemization--crafting)
8. [Tactical AI & Boss Architecture](#8-tactical-ai--boss-architecture)
9. [UI/UX & Interface Guidelines](#9-uiux--interface-guidelines)
10. [Art Direction & Soundscapes](#10-art-direction--soundscapes)
11. [Technical Architecture & Data Handling](#11-technical-architecture--data-handling)
12. [**VERTICAL SLICE (DEMO) IMPLEMENTATION PLAN**](#12-vertical-slice-demo-implementation-plan)

---

## 1. EXECUTIVE SUMMARY & CORE LOOPS

**CONJURE** is a tactical grid-based card battler that seamlessly bridges open-world exploration (inspired by *Pokémon* and *Wizard101*) with deep, deterministic tactical deck-building combat (inspired by *Slay the Spire*, *Inscryption*, and *Hearthstone*). 

The game eschews traditional node-based roguelike maps for a multi-zone overworld. Players navigate vast continents, uncovering mysteries, solving glyph puzzles, fighting wandering duelists under strict Ante rules, and initiating Subjugation Trials to tame powerful off-grid Companions. 

### 1.1 The Core Game Loop
1. **Explore:** Navigate safe "Sidewalk" zones and perilous "Danger Zones" in the overworld.
2. **Collect & Craft:** Gather reagents, discover blueprints, and forge new minion and spell cards.
3. **Engage:** Challenge wandering duelists or wild Companions. Combat seamlessly projects the grid onto the environment.
4. **Acquire:** Win Ante Wagers for Ducats and cards, or complete Subjugation Trials to bind new Companions with unique stat variance rolls.
5. **Ascend:** Use Aether Shards to upgrade cards to Rank 2, shifting combat dynamics.

---

## 2. MASTER GLOSSARY & TERMINOLOGY

### Core Entities
* **The Hero:** The primary player avatar. Operates as the frontline commander utilizing baseline physical attacks, obstacle constructs, and displacement spells.
* **The Companion:** An untargetable secondary caster selected prior to a run. They stand off-grid alongside the Hero, determining the specialized elemental pool, runic synergies, and finisher spells.
* **The Pact:** The shared health pool (Base: 40 HP) representing the mystical bond between Hero and Companion. Combat ends if The Pact is reduced to 0.
* **Minion:** Standard summoned units occupying exactly $1 \times 1$ grid cell.
* **Behemoth:** High-cost, tactical centerpiece units occupying a $2 \times 2$ footprint. Features the inherent *Heavy Footprint* trait.
* **Apex Boss:** Legendary, multi-phase continental figures guarding Sanctums.

### Economy & Resources
* **Banked Pips:** The persistent, baseline magical resource generated each turn (+1 per round). Unused Pips roll over across turns into the Pip Bank (Capped at 8 Pips).
* **Echo / Spark:** Volatile, fleeting energy generated dynamically during a turn (e.g., via Dusk sacrifices or Overdraw burn). Sparks must be spent on the turn they are acquired or they are lost.

### Combat Keywords
* **Attuned [School]:** Secondary amplified effect triggers if an allied Companion of the designated school is active.
* **Fast:** Can be played during reaction windows or chained immediately without passing priority.
* **Retain:** Card is not discarded at the end of the turn.
* **Impact / Concuss:** Deals physical force damage; concuss applies stun.
* **Shove / Pull:** Directional forced displacement.
* **Cascade:** Explosive chain reaction from overlapping Rune detonations.
* **Devour:** Summoning a unit directly on top of an ally, destroying the ally, absorbing its stats as Temporary Armor, and refunding Echoes.
* **Last Stand:** Sudden-death mechanic triggered at critical Pact HP; audio muffles and heartbeat sounds dominate.

---

## 3. COMBAT ARCHITECTURE & GRID ENGINE

### 3.1 Off-Grid Commanders & The Boundary
Neither the Hero nor the Boss occupies a grid tile. They exist as physical 3D models anchored behind their respective sides of the board. 
* **The Runic Boundary:** The grid (baseline $5 \times 5$, but dynamically sized based on biome) is surrounded by a magical perimeter. Units knocked off the edge crash into this wall instead of the Commanders.

### 3.2 Collision Physics & Line of Sight
* **Collision Damage:** Forced displacement is highly lethal. A unit forced into a wall takes **3 True Damage**. A unit forced into another unit deals **2 Damage** to both parties.
* **Line of Sight (LoS):** Ranged spells and attacks utilize literal projective geometry. Obstacles (e.g., Ice Barricades) and Behemoths cast "shadow cones" that occlude targeting behind them. 
* **Non-Retaliatory Trades:** Combat is strictly initiator-wins unless a unit has the **Counter** keyword.

### 3.3 Turn Sequencing
1. **Status Resolution:** Predictable 5-step order: Toxin $\rightarrow$ Burn $\rightarrow$ Freeze Check $\rightarrow$ Hazards $\rightarrow$ Escalation.
2. **Draw & Resource:** Draw to hand size. Gain +1 Pip (up to 8). 
3. **Main Phase:** Play minions, cast spells, trigger runes, utilize Echoes.
4. **Resolution:** End turn, unresolved Sparks vanish, hand discards to limit.

---

## 4. MAGIC ECOSYSTEM: SCHOOLS & REACTIONS

All magic draws from the universal Pip/Echo resource pool. School identity is defined by mechanical flavor and spatial manipulation. 

| School | Core Identity | Key Mechanics | Visual Motif |
| :--- | :--- | :--- | :--- |
| **Pyre** (Ignis) | Volatile combustion, delayed detonation | T-shaped AoE, Ignite, Combust | Magma, Ash, Explosions |
| **Frost** (Boreas) | Control, fortified obstacles, LoS occlusion | Chill, Freeze, Ice Barricades | Glaciers, Shards, Snow |
| **Surge** | Tempo, chain reactions, direct pressure | Arc, Overload | Lightning, Static, Storms |
| **Bulwark** | Persistent armor, heavy displacement | Geomancy, Shove, Fortify | Stone, Earth, Shields |
| **Dusk** | Occult sacrifice, Echo generation, recycling | Devour, Hollow, Frail | Shadows, Purple Void |
| **Bloom** | Vitality leeching, creeping traps, lockdown | Toxin (true dmg over time), Entangle, Leech | Spores, Roots, Toxic Vines |
| **Arcane** | Neutral, physical prowess, deck cycling | Shove, Draw, Universal utility | White Runes, Force Energy |

### 4.1 Emergent Reaction Matrix (Examples)
When different elements overlap on a grid tile, deterministic reactions occur:
* **Vaporize (Pyre + Frost):** Creates dense Steam Fog, acting as a dynamic LoS blocker that drops ranged targeting across columns.
* **Blight Siphon (Dusk + Bloom):** Dusk strike on an enemy with Toxin(3+) bypasses armor to drain 3 HP, healing allied Pacts.

---

## 5. MASTER BESTIARY & CARD DATABASE

### 5.1 Dynamic Deck Customization
Decks range from **12 to 30 cards**.
* **12-15 Cards:** Hyper-consistent, fast cycling combo decks.
* **21-30 Cards:** Highly adaptable control decks allowing multiple Behemoths.
* **Duplicate Limits:** Tier 1 (3 copies max), Tier 2 (2 copies max), Tier 3 / Behemoths (1 copy max).

### 5.2 Unit Archetypes
* **1x1 Minions:** * *Bruisers/Tanks:* High HP (8-14), Low MOV (1-2), Guardian traits.
    * *Skirmishers/Rogues:* Mid HP (5-7), High MOV (3-4), Flanking displacements.
    * *Snipers/Casters:* Low HP (3-5), Low MOV (1-2), Ranged LoS attacks (3-4 tiles).
* **2x2 Behemoths:** Tactical centerpieces. They require 4 empty tiles to summon, have the *Heavy Footprint* trait (immune to minor shoves), and feature massive cleave attacks.

---

## 6. OPEN-WORLD PROGRESSION & ACQUISITION

### 6.1 Exploration Rules
* **Sidewalk Immunity Rule:** Paved avenues and well-lit paths are Safe Zones. No random combat.
* **Danger Zones:** Off-path cobblestones, alleys, and overgrowth enable visible roaming encounters. 

### 6.2 Companion Subjugation (Taming)
Companions are found in the wild (e.g., *Ignis the Ember Drake*). 
* **The Trial:** Fight the Companion as a boss on the tactical grid.
* **Mastery Objectives:** Fulfilling challenges (e.g., "Sacrifice 3+ friendly units", "Win via Rune Detonation") increases the *Affinity Roll Tier*.
* **Variance Engine:** Upon taming, the Companion rolls base HP bonuses, unique passive traits, and unlocks its signature Finisher card.

### 6.3 Wandering Duelists & Ante Wagering
NPC duelists with 3-Tier Renown Scaling:
* **Novice Tier:** Standard wager (50-100 Ducats).
* **Adept Tier:** Wager 250 Ducats + 1 Tier 2 Binder Card.
* **Master Tier:** Wager 500 Ducats + 1 Tier 3 Power Card.
* *Reclaim Bounty:* Lost soulbound cards can be reclaimed at the Continental Magistracy for a steep fine within 24 hours.

---

## 7. ECONOMY, ITEMIZATION & CRAFTING

### 7.1 The Currency Triad
1.  **Ducats (DUC):** Liquid currency from duels and node harvests. Used for buybacks, base reagents, and scribing.
2.  **Academy Crests (AC):** Prestige gate currency from Mastery Trials. Used for advanced school blueprints and relic sockets.
3.  **Aether Shards (AS):** Bottleneck currency from salvaging duplicates and bosses. Used for Card Ascension.

### 7.2 Scribing & Ascension
* **Scribing:** Requires finding a blueprint, gathering biome reagents (e.g., Magma cores, Glacial ice), and forging them at a town Scribe to create playable cards.
* **Ascension (Rank 1 to Rank 2):** Upgrading a card permanently alters its properties using Aether Shards. Ascensions offer branching paths: *Efficiency* (-1 Pip cost), *Geometry* (Wider AoE), *Keywords* (Adding 'Fast' or 'Retain'), or *Durability* (+HP).

### 7.3 Hero Relics
4 Equipment slots (Head, Body, Accessory, Boots) modifying passive traits: starting hand size, maximum persistent Pips, grid movement, and starting temporary Armor.

---

## 8. TACTICAL AI & BOSS ARCHITECTURE

### 8.1 Heuristic Engine
The AI evaluates game states via a **Dynamic Utility Scoring Matrix**. Rather than scripted paths, it calculates the highest-value action sequence (capped at 1.2s compute time to prevent stalls).
* **Devour Logic:** AI heavily prioritizes devouring "doomed" minions ($\le 2$ HP) to recycle them into Sparks before they die to DoT.
* **Lethal Veto:** The engine guarantees the AI will execute lethal if present on the board.

### 8.2 Apex Boss Mechanics
Legendary continental figures with distinct voice lines and multi-phase triggers.
* **Phase Shifts:** Occur at 50% HP. Debuffs are purged, arenas may dynamically resize (e.g., $5\times5 \rightarrow 4\times6$), and Behemoths may spawn.
* **The Rite of Binding:** When an Alpha Companion boss drops below 25% HP, the player receives a 0-Pip *Rite of Binding* card. It bypasses hand limits (Ephemeral Overlay) and must be played to successfully bind the Companion.

---

## 9. UI/UX & INTERFACE GUIDELINES

### 9.1 Camera & Viewport
* **Perspective:** 2.5D Isometric Tilt ("Lazy Susan" design) resembling *Final Fantasy Tactics*. Allows free rotation to perfectly parse spatial geometry and occlusion.
* **X-Ray Silhouettes:** Dynamically activate when Behemoths occlude smaller units.

### 9.2 Diegetic Interface
* **Off-Grid Commanders:** Bottom-anchored 3D models with a Dual-Ring Central HUD Dial at their feet separating Persistent Pips from Temporary Sparks.
* **Trajectory Ghosting & CRASH Badges:** When aiming a Shove spell, the UI draws a glowing physical arc showing where the unit will land, accompanied by a bright "CRASH" badge if it intersects a wall.
* **Overworld:** Uses a diegetic Field Journal and an Ornate Compass that points to duelists and hazards (avoiding minimap clutter). Deck building uses a horizontal 3D card fan.

---

## 10. ART DIRECTION & SOUNDSCAPES

### 10.1 Visual Style
* **Vibrant Cel-Shaded Anime:** Inspired by *Genshin Impact* and *Wizard101*. Bright, readable, bold outlines.
* **Seamless Transition:** Combat initiates by drawing a glowing grid directly over the open-world terrain. Trees and rocks immediately snap to the grid as obstacles.
* **Diegetic VFX:** Runes physically sear into the armor/flesh of targets. Shadows are literal projected darkness rather than red UI overlays.

### 10.2 Sound Design (Heavy Contrast)
The game contrasts its vibrant visual style with brutal, tactile, high-stakes audio.
* **Pips:** Satisfying, rich sounds (heavy glass vials filling, thick coins in leather).
* **Sparks/Echoes:** Harsh, violent costs (sizzling flesh, tearing fabric).
* **Rune Detonations:** A high-pitched hum followed by a split-second of dead silence, culminating in a bass-heavy boom.
* **Last Stand:** When The Pact reaches critical HP, all background music cuts. Ambient audio muffles, and a heavy, relentless heartbeat takes over the soundscape.

---

## 11. TECHNICAL ARCHITECTURE & DATA HANDLING

### 11.1 Combat State Engine
* **Command Pattern & FIFO Queue:** Logic and visuals are strictly decoupled. When a card is played, mathematical resolution happens instantly in the background. The events (damage, shove, cascade, death) are placed in a First-In-First-Out queue. The Animation Sequencer plays them visually, waiting for `Animation_Complete` flags before proceeding.

### 11.2 Save Schema
* **Persistence:** Decks, inventories, and Companion Variance Seeds are stored securely. 
* **Combat Scumming Prevention:** The game auto-saves at combat initiation (`pending_combat_state`). Closing the game during an Ante Wager duel results in an automatic forfeit upon reload, losing the wagered card.

---

## 12. VERTICAL SLICE (DEMO) IMPLEMENTATION PLAN

To build a functional demo of **CONJURE**, focus purely on the core mechanical loop before expanding the overworld. 

### Phase 1: The Combat Sandbox
* **Grid Engine:** Implement a static $5 \times 5$ grid.
* **Resource Engine:** Implement the Pact (40 HP), persistent Pip tracker (1/turn, cap 8), and volatile Spark tracker.
* **Commanders:** 1 Off-grid Hero, 1 Off-grid Companion (*Ignis the Ember Drake* placeholder).
* **Actions:** Implement the FIFO Command Queue.
* **Card Set:** Create exactly 10 cards. 
    * 3 Arcane (Basic strike, Shove, Barrier).
    * 3 Pyre (Combust Rune, Ignite, T-AoE blast).
    * 2 Minions (1 Bruiser, 1 Sniper).
    * 2 Boss specific cards.

### Phase 2: Physics & Interactions
* **Collisions:** Code the $3 / 2$ damage displacement logic and the Runic Boundary.
* **Line of Sight:** Implement basic raycasting to block ranged attacks behind Minions/Obstacles.
* **Runes:** Implement delayed state triggers (e.g., "Explodes in 2 turns").

### Phase 3: The Encounter Loop
* **The Overworld:** A tiny, single-block "Danger Zone" alleyway.
* **The Duelist:** 1 Wandering Novice Duelist. Use greedy AI (always attacks).
* **The Subjugation Trial:** 1 Boss encounter (Ignis) featuring Phase Shift at 50% HP and the Rite of Binding overlay card at 25% HP.

### Phase 4: Polish
* **Audio/Visual Hook:** Add the diegetic UI HUD dial, the "Last Stand" muffled heartbeat effect, and trajectory ghosting for collision prediction. 

---
*End of Master Document.*
