# Tactical Card Battler: Master Game Build To-Do Roadmap

This document outlines all required systems, design documents, and technical modules needed to expand the current combat and progression foundations into a complete, build-ready game.

---

## 1. Existing Completed Pillars (Current Baseline)
- [x] **Draft 7.0 – Master Combat Architecture (`deck_builder_mechanics_draft_7.md`)**
  - Off-grid dual commander architecture (Shared 40 HP, Hero + Companion).
  - Dual-resource engine (Persistent Pips up to 8 + Temporary Sparks via devouring/sacrifices).
  - Spatial grid tactics ($5 \times 5$ / dynamic sizing, $1 \times 1$ minions, $2 \times 2$ Behemoths).
  - Directional collision physics ($3/2$ damage), cone line-of-sight occlusion, and non-retaliatory combat.
  - Delayed detonation Runes, cascade chain explosions, persistent armor, and "Last Stand" sudden death.
- [x] **Draft 1.0 – Open-World Progression & Companion Acquisition (`progression_and_companion_acquisition_draft_1.md`)**
  - Open-world exploration loops (Wizard101 / Pokémon inspired).
  - Wild companion taming rituals & stat/trait variance roll engine (Ignis & Boreas prototypes).
  - Wandering duelists with 3-tier Renown scaling and card Ante wagering.
  - School academies, mastery trials, bestiary blueprint crafting chains, and hazard harvesting.
  - Flexible deck construction ($12\text{--}30$ cards) and 3-Tier duplicate dynamic cap ($3/2/1$).

---

## 2. To-Do Modules for Complete Game Build

```
                      MASTER BUILD ROADMAP
                               │
 ┌──────────────┬──────────────┼──────────────┬──────────────┐
 ▼              ▼              ▼              ▼              ▼
[Phase 1]      [Phase 2]      [Phase 3]      [Phase 4]      [Phase 5]
Magic Matrix   Card & Mob     Biomes &       Economy &      Boss & AI
& Schools      Catalog        Environments   Crafting Data  Architecture
 │              │              │              │              │
 └──────────────┴──────────────┼──────────────┴──────────────┘
                               ▼
                   ┌───────────────────────┐
                   ▼                       ▼
               [Phase 6]               [Phase 7]
             UI/UX & HUD             Audio/VFX & Meta
             Architecture            Systems
```

---

### Module 1: Elemental Schools & Spell Matrix (Draft 3)
* **Objective:** Define the complete magic ecosystem, elemental affinities, and cross-elemental interaction rules.
* **Key Tasks:**
  - [ ] **Complete School Roster:** Define all primary and hybrid magic schools (e.g., *Pyromancy, Cryomancy, Electromancy, Necromancy, Geomancy, Verdant/Nature, Arcane/Aether*).
  - [ ] **School Identities & Mechanics:** Assign distinct tactical identities to each school (e.g., Pyromancy = Burst & Cascades; Cryomancy = Obstacles & Freezes; Necromancy = Sacrifices & Death Runes; Geomancy = Collision & Armor; Electromancy = Chain Damage & Disruption).
  - [ ] **Cross-Elemental Reaction Matrix:** Establish rules for when two elemental effects occupy the same tile or unit (e.g., *Fire + Ice = Steam Fog (blocks LoS)*; *Water + Lightning = Shock Spread*; *Poison + Fire = Caustic Explosion*).
  - [ ] **Status Effect Matrix:** Detail conditions, stack caps, and tick resolutions for all elemental debuffs (*Burn, Chill/Freeze, Shock, Poison, Root, Frail*).

---

### Module 2: Master Card & Bestiary Catalog (Draft 4)
* **Objective:** Create the complete playable card database, creature stat blocks, and standardized keyword rules.
* **Key Tasks:**
  - [ ] **Universal Hero Baseline Pool (15–20 Cards):** General physical attacks, basic shields, shove/pull displacements, neutral stone barricades, and card-draw spells available regardless of Companion.
  - [ ] **Companion Signature Spell Pools:** Build out 10–15 unique cards per Companion archetype (Runes, catalysts, elemental projectiles, and Power Tier finishers).
  - [ ] **Master Bestiary ($1 \times 1$ Minions):** Stat blocks, MOV values, traits, and escalation paths for frontline chaff, ranged snipers, stealth scouts, and Guardian blockers.
  - [ ] **Master Bestiary ($2 \times 2$ Behemoths):** Heavy siege engines, living walls, and area-cleaving monstrosities with strict $2 \times 2$ pathing rules.
  - [ ] **Master Keyword Glossary:** Standardize all card text definitions (*Dormant, Impact, Haste, Counter, Guardian, Escalate, Retain, Power Tier, Cleave, Pierce, Shatter, Pull, Push*).

---

### Module 3: World Biomes, Dungeons & Encounter Rules (Draft 5)
* **Objective:** Design the open-world map zones, dungeon chambers, environmental hazards, and how roaming encounters transition into grid battles.
* **Key Tasks:**
  - [ ] **Biome Profiles:** Specify 4–6 distinct world regions (e.g., *Volcanic Crags, Frostveil Glacier, Toxic Mire, Sunken Ruins, Arcane Academy Grounds*).
  - [ ] **Dynamic Arena Grid Layouts:** Define grid dimensions and obstacle placement rules per zone ($5 \times 5$ standard plains, $4 \times 6$ narrow dungeon corridors, $6 \times 6$ boss arenas).
  - [ ] **Environmental Hazards & Harvestable Props:** Define interactable world objects (explosive urns, poison briars, ice spires, lava fissures) that generate variable obstacle cards when harvested.
  - [ ] **Overworld Traversal & Enemy Spawns:** Roaming mob aggro radiuses, dungeon instance resets, and Subjugation Trial spawn triggers.

---

### Module 4: Economy, Itemization & Crafting Data (Draft 6)
* **Objective:** Formalize inventory systems, currency flow, equipment/relic slots, and crafting recipe requirements.
* **Key Tasks:**
  - [ ] **Currency Architecture:** Balance Gold income/sinks, school-specific quest tokens, and Ante reclaim pricing.
  - [ ] **Hero Gear & Relic Slots:** Define whether the Hero equips artifacts (e.g., *Amulets, Spellbooks, Robes, Boots*) that grant passive starting stats, bonus Pips, or hand size expansions.
  - [ ] **Complete Blueprint & Scribing Recipes:** Exact ingredient requirements (Core Essence + Regional Reagents) to forge every craftable minion and obstacle card.
  - [ ] **Card Upgrade System (Rank 1 $\rightarrow$ Rank 2):** Rules and material costs for upgrading cards (e.g., reduced Pip cost, bonus damage, increased barrier HP, or expanded AoE).

---

### Module 5: Boss Architecture & Enemy AI Decision Trees (Draft 7)
* **Objective:** Define tactical AI behaviors, threat prioritization, and multi-phase boss mechanics.
* **Key Tasks:**
  - [ ] **Combat AI Decision Heuristics:** How enemy AI evaluates actions (targeting Hero portrait vs. eliminating Escalating minions vs. breaking barricades).
  - [ ] **AI Resource & Devour Management:** Rules for when AI decides to bank Pips, sacrifice wounded minions for Sparks, or trigger burst turns.
  - [ ] **Multi-Phase Boss Encounters:** Mechanics for major bosses (e.g., phase transitions at 50% HP, board transformation, elemental shifts, or summoning Behemoth adds).
  - [ ] **Difficulty Scaling per Renown Tier:** Specific algorithmic modifiers for Novice, Adept, and Master AI opponents.

---

### Module 6: UI/UX & Interface Architecture (Draft 8)
* **Objective:** Create wireframes, layout blueprints, and information architecture for all combat and menu screens.
* **Key Tasks:**
  - [ ] **Combat HUD Wireframe:** Positioning for off-grid Hero/Boss portraits, shared 40 HP gauge, persistent Pip Bank (0–8), temporary Sparks, hand zone (max 7), and turn-end button.
  - [ ] **Grid Tactical Overlay:** Visual indicators for movement range, valid attack targets, collision paths, line-of-sight cone shadows, and AoE blast templates.
  - [ ] **Collection Binder & Deck Builder UI:** Filtering by Actor (Hero vs. Companion), School, Pip Cost, and Card Tier with visual $3/2/1$ duplicate limit enforcement.
  - [ ] **Overworld HUD & Menus:** Mini-map, active quest/recipe tracker, regional Renown meter, and Bestiary discovery log.

---

### Module 7: Audio, Visual FX & Animation Specifications
* **Objective:** Define art direction, combat animations, and audio cues.
* **Key Tasks:**
  - [ ] **Visual Style & Art Direction Guide:** 2D/3D stylistic guidelines for characters, companions, grid tiles, and UI elements.
  - [ ] **VFX Specifications:** Particle indicators for Rune attachments, cascade explosions, collision impacts, and Line of Sight occlusion shadows.
  - [ ] **SFX & Soundscape Plan:** Sound cues for Pip generation, Spark burning, Rune detonations, unit death, and "Last Stand" sudden death triggers.

---

### Module 8: Technical Architecture & Data Persistence
* **Objective:** Technical engine setup, data models, and save game structure.
* **Key Tasks:**
  - [ ] **Engine & Tech Stack Selection:** Framework choices (e.g., Unity / Godot / Custom engine).
  - [ ] **Save File Schema:** Structure for persisting deck binder contents, discovered blueprints, companion variance rolls, and regional Renown progress.
  - [ ] **Combat State Engine Architecture:** Event-driven turn resolution loop, deterministic action queuing, and animation sequencing pipeline.

---

## 3. Recommended Drafting Sequence

| Step | Target Document | Deliverable |
| :---: | :--- | :--- |
| **1** | **Draft 3: Elemental Schools & Spell Matrix** | Complete magic roster, cross-elemental combinations, and status effects. |
| **2** | **Draft 4: Master Card & Bestiary Catalog** | Full database of Hero cards, Companion pools, minions ($1\times1$), Behemoths ($2\times2$), and glossary. |
| **3** | **Draft 5: World Biomes & Dungeon Encounters** | Zone profiles, field hazards, dynamic arena dimensions, and overworld rules. |
| **4** | **Draft 6: Economy, Equipment & Crafting Recipes** | Itemization, gear slots, forging recipes, and card upgrade mechanics. |
| **5** | **Draft 7: Boss Design & AI Decision Trees** | AI heuristics, devour logic, boss phase triggers, and difficulty scaling. |
| **6** | **Draft 8: UI/UX & Wireframe Specifications** | Battle screen, binder UI, overworld HUD, and tactical overlays. |
| **7** | **Draft 9: Technical & Audio/VFX Guidelines** | Art/sound style, animation cues, save schemas, and state architecture. |
