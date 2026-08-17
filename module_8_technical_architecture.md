# Module 8: Technical Architecture & Data Persistence

This document outlines the core technical systems required to build the game. It defines the engine requirements, the event-driven combat state loop, and the data schema necessary to handle unique companion variables and progression without data loss.

---

## 1. Engine Stack & Open-World-to-Grid Transition

To support a vibrant 3D open world, 2D UI/cards, and complex systemic grid mechanics, the chosen engine (e.g., **Unity**, **Godot**, or **Unreal**) must support robust NavMesh generation and physical layering.

* **World-to-Grid Instantiation (Edge Case Mitigation):** * *The Problem:* Transitioning from open world to combat could cause clipping if the terrain is uneven or if NPCs wander into the battle zone.
    * *The Solution:* When combat initiates, the engine takes a "snapshot" of the immediate environment. A localized, invisible physics box is instantiated around the 5x5 (or dynamic) grid. Non-combatant NPCs are paused and hidden, and the terrain within the box is mathematically flattened via a shader or vertex snap to ensure grid tiles are perfectly level for combat calculations, even on a hill.

---

## 2. Combat State Engine & Deterministic Queuing

The combat system features cascades, chained elemental reactions, and complex displacements. To prevent soft-locks (e.g., an animation hanging forever) or logic errors, the game must use a **Command Pattern Architecture** where logic and visuals are strictly separated.

### The Event-Driven Resolution Loop
1. **Player Input:** Player plays a card (e.g., *Pyromancy Fireball*).
2. **Logic Calculation (Instant):** The game mathematically resolves the damage, the cascade effect, the knockback, and any resulting deaths in milliseconds behind the scenes.
3. **The Action Queue:** These calculated events are placed into a First-In-First-Out (FIFO) queue.
4. **Animation Sequencer:** The engine plays the visual effects, animations, and audio *in order* based on the queue. The game state waits for the `Animation_Complete` flag before processing the next visual.

### Combat Edge Cases & Rules of Resolution
* **Simultaneous Deaths & "Last Stand":** * *Edge Case:* A chained explosion kills the Player’s Companion, an enemy Behemoth, and triggers a Death Rune all at the exact same time. Who wins?
    * *Resolution Rule:* The Active Player's turn always holds priority. Triggers resolve in an **Active Player, Non-Active Player (APNAP)** order. If the Boss's HP hits 0 simultaneously with the Player's HP hitting 0, the Player wins (tie-breaker goes to the instigator).
* **Displacement Collisions (2x2 vs. 1x1):** * *Edge Case:* A heavy 2x2 Behemoth is shoved into a space occupied by a 1x1 minion. 
    * *Resolution Rule:* Mass priority dictates displacement. If Mass A > Mass B, Mass B is crushed (takes collision damage and is pushed to the next tile). If Mass A = Mass B, both take collision damage and remain in place.
* **Grid Edge Displacement:**
    * *Edge Case:* A unit is pushed off the edge of the grid.
    * *Resolution Rule:* The edge of the grid acts as an infinitely dense wall. Units take maximum (3/2) collision damage and remain on the outermost tile. 

---

## 3. Save File Schema & Data Persistence

Because companions have "Wild Variance" (unique stat rolls and trait seeds), they cannot just be saved as a basic ID. They must be saved as unique database instances. 

### Recommended Save Structure (JSON / Binary)

| Data Object | Variables to Persist | Edge Case Mitigation |
| :--- | :--- | :--- |
| **Player Profile** | Shared 40 HP upgrades, currently equipped Gear/Relics, Gold balance. | Encrypt the currency strings to prevent simple text-editor save hacking. |
| **Binder State** | Inventory of all cards owned, card upgrade ranks (Rank 1 vs Rank 2), deck limitations. | Validate the active deck on load. If a patch removes a card, flag the deck as "Invalid" until edited. |
| **Companion Roster** | Unique ID, Base Archetype, Variance Seed (dictates stat bonuses), unlocked signature spells. | Store companions in an array of objects. Never overwrite a companion slot; append and allow the player to release them later. |
| **World State** | Renown levels per region, defeated Subjugation Bosses, harvested hazard nodes (respawn timers). | Track hazard respawns via a universal timestamp delta so nodes respawn even when the game is turned off. |

### Save System Edge Cases
* **Combat Disconnects / Save Scumming:** * *Edge Case:* A player forces the game to close right before their Hero is about to die to avoid losing Ante cards.
    * *Resolution Rule:* The game auto-saves at the exact moment combat is initiated, logging the Ante wagers in a `pending_combat_state` file. If the game is loaded and this file exists, the game considers it a "Forfeit" and the Ante is lost. There is no saving *during* combat.
* **Version Migration:** * *Edge Case:* You patch the game and change a card's Pip cost, which breaks an old save file's deck logic.
    * *Resolution Rule:* Save files must include a `version_number`. When an older save is loaded, a migration script updates all static card values from the master database rather than trusting the values stored in the local save.