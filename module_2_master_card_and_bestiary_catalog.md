Markdown# MODULE 2: MASTER CARD & BESTIARY CATALOG

**Document Version:** 1.0  
**System Anchor:** Master Game Build & Engine Data Architecture  
**Dependencies:** Module 1 (Elemental Schools & Spell Matrix), Draft 7.0 (Core Combat Architecture), Draft 1.0 (Progression & Companion Acquisition)

---

## 1. Master Keyword & Combat Rule Glossary

All cards, unit traits, and runic inscriptions in *CONJURE* use standardized terminology.

┌─────────────────────────────────────────────────────────────────────────────┐│                           KEYWORD CLASSIFICATIONS                          │├──────────────────────┬──────────────────────┬───────────────────────────────┤│  Targeting & Timing  │  Combat & Collision  │     Elemental & Lifecycle     │├──────────────────────┼──────────────────────┼───────────────────────────────┤│ • Fast / Slow        │ • Impact / Concuss   │ • Ignite / Combust (Pyre)     ││ • Retain             │ • Cleave / Pierce    │ • Chill / Freeze (Frost)      ││ • Attuned            │ • Shove / Pull       │ • Arc / Overload (Surge)      ││ • Power Tier (T3)    │ • Counter            │ • Fortify (Bulwark)           ││ • Channel / Cycle    │ • Guardian           │ • Devour / Hollow (Dusk)      ││ • Dormant (X)        │ • Shatter            │ • Toxin / Entangle (Bloom)    ││                      │ • Escalate           │ • Leech                       │└──────────────────────┴──────────────────────┴───────────────────────────────┘
### 1.1 Universal Combat & Timing Keywords
* **Attuned [School]:** If an allied Companion of the designated school is active on the field, trigger the secondary amplified effect.
* **Fast:** Can be played during reaction windows or chained immediately without passing priority.
* **Retain:** This card is not discarded at the end of the round; it remains in hand until cast or manually cycled.
* **Cycle ($X$):** Discard up to $X$ cards from hand, then draw that exact number from your draw pile.
* **Channel:** Convert 1 unspent Pip into +2 Temporary Sparks at the start of your next turn.
* **Dormant ($X$):** The unit or construct enters the board inactive and invulnerable for $X$ turns. It cannot move, attack, or be targeted until the countdown reaches 0.
* **Power Tier (Tier 3):** Climax card. Hard-capped at exactly **1 copy per deck**. Cannot be discounted below 1 Pip by any passive effect.

### 1.2 Spatial, Movement & Displacement Keywords
* **Shove ($X$):** Forces the target unit $X$ tiles backward along the vector of the attack/impact.
  * **Wall Collision:** If movement is stopped by the board border, the target suffers **3 true collision damage**.
  * **Unit Collision:** If stopped by another unit, both the shoved unit and the blocking unit suffer **2 collision damage**.
* **Pull ($X$):** Drags the target unit $X$ tiles toward the caster/source along a straight line vector.
* **Guardian:** Adjacent allies (orthogonal cells) cannot be targeted by single-target ranged attacks; ranged attacks are redirected to the Guardian.
* **Cleave:** Attacks strike the primary target and the two adjacent orthogonal tiles in a sweeping arc.
* **Pierce:** Ignores target **Persistent Armor**, dealing damage directly to the unit's base HP pool.
* **Counter ($X$):** The first time this unit is struck by an adjacent melee attack each round, it strikes back dealing $X$ flat damage before the attacker moves away.
* **Escalate [Condition]:** Whenever the specified condition occurs, this unit gains permanent stat increases (e.g., *+1 ATK / +1 HP*) for the remainder of the battle.

---

## 2. Universal Hero Baseline Card Pool (Neutral / Arcane)

This pool represents standard combat maneuvers, parries, displacement spells, and arcane utility available to any deck regardless of Companion archetype.

Deck Limit Rules: Tier 1 = Max 3 copies | Tier 2 = Max 2 copies | Tier 3 = Max 1 copy
| Card Name | Pip Cost | Type | Tier | Targeting / Range | Card Rules & Mechanics |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Vanguard Strike** | 1 | Attack | T1 | Melee (1 tile) | Deal 3 physical damage. **Shove (1)**. |
| **Aether Dart** | 1 | Attack | T1 | Ranged (Line 3) | Deal 2 arcane damage. If the target has Persistent Armor, **Pierce**. |
| **Tactical Parry** | 1 | Skill | T1 | Self / Hero | Grant 3 Persistent Armor to Hero or target adjacent ally. |
| **Arcane Repulsion** | 2 | Skill | T1 | Ranged (Cone 2) | Push all enemies within a 2-tile forward cone back 1 tile. Wall collision deals +1 damage. |
| **Quickstep** | 0 | Skill | T1 | Allied Unit | Target minion gains +2 MOV this turn. Draw 1 card. |
| **Grappling Hook** | 1 | Skill | T1 | Ranged (Line 4) | Target unit is **Pulled (2)** toward the caster. If target hits an obstacle, deal 2 collision damage. |
| **Runed Barricade** | 1 | Construct | T1 | Empty Cell | Conjure a Stone Barrier (12 HP, 0 MOV, blocks Line of Sight). |
| **Siphon Pip** | 0 | Spell | T2 | Self | Sacrifice 3 Commander HP. Gain +1 Banked Pip (up to max reservoir). |
| **Aether Shift** | 2 | Spell | T2 | Any 2 Units | Swap the board positions of two target allied minions, or one ally and one neutral obstacle. |
| **Disruption Field**| 2 | Spell | T2 | Area ($2 \times 2$) | Target area becomes Silenced for 1 round. Units inside cannot trigger Resonance or cast Spells. |
| **Arcane Focus** | 1 | Skill | T2 | Self | **Cycle (2)**. Your next Spell played this turn costs 1 fewer Pip (minimum 0). |
| **Bastion Array** | 2 | Skill | T2 | Row (3 tiles) | Grant 4 Persistent Armor and **Guardian** to all allies in target row for 1 round. |
| **Kinetic Inversion**| 1 | Reaction | T2 | Target Ally | When target ally takes collision damage, negate the damage and grant them +2 ATK on next turn. |
| **Null Zone** | 3 | Spell | T2 | Area ($3 \times 3$) | Cleanse all Runes, Hazards, and Ground status effects in target zone. |
| **Grand Aether Surge**| 4 | Spell | T3 | Entire Board | Deal 4 arcane damage to all enemies. **Channel**: Draw 3 cards and gain +2 Sparks next round. |
| **Chrono Reversal** | 3 | Spell | T3 | Target Ally | Reset target ally's HP and position to where it started this round. Remove all debuffs. |

---

## 3. Companion Signature School Spell Pools

### 3.1 Pyre Signature Pool (Burst, Hazards & Chain Cascades)

Resonance: Playing a Pyre spell ignites the Companion's weapon, dealing 1 splash damage to adjacent foes.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Ignis Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Flame Lash** | 1 | Attack | T1 | Melee (1 tile) | Deal 3 fire damage. **Ignite (1)**. | **Ignite (2)** instead; target drops a Burning Tile. |
| **Fireball** | 2 | Attack | T1 | Ranged (Area +) | Deal 4 fire damage in a cross pattern (+). | Leaves Burning Hazards on all 5 affected cells. |
| **Cinder Sigil** | 1 | Rune | T1 | Target Tile | Attach **Cinder Rune** to cell. Detonates on unblocked damage (4 fire dmg). | Target unit also gains **Ignite (2)** upon detonation. |
| **Combustion Wave** | 2 | Spell | T1 | Cone (3 tiles) | Deal 2 fire damage. Trigger **Combust** on all affected targets. | Refund +1 Temporary Spark for each target Combusted. |
| **Searing Lance** | 2 | Attack | T2 | Ranged (Line 4) | Deal 5 fire damage to the first unit in line. **Pierce**. | If target dies, projectile continues to the next target. |
| **Ignition Trap** | 1 | Construct | T2 | Empty Cell | Spawns Fire Pot (4 HP). When destroyed, explodes for 4 dmg in $3 \times 3$. | Explosion damage increased to 6; applies **Ignite (2)**. |
| **Heat Sink** | 1 | Skill | T2 | Self / Unit | Consume all Burn stacks from target enemy. Grant caster 2 Armor per stack. | Draw 1 card for every 2 stacks consumed. |
| **Ember Infusion** | 2 | Skill | T2 | Target Ally | Ally attacks apply **Ignite (2)** for 2 turns. | Ally also gains **Counter (2)** while attacking. |
| **Cataclysmic Blast**| 4 | Spell | T3 | Area ($3 \times 3$) | Deal 7 fire damage to all units in area. Destroy all obstacles. | Converts all destroyed obstacles into instant 4-damage shrapnel. |
| **Hellfire Conflagration**| 3 | Spell | T3 | Entire Row | Set target row ablaze permanently. Units in row take 3 fire dmg/turn. | Enemies in row cannot gain Persistent Armor. |

---

### 3.2 Frost Signature Pool (Ice Barricades, Freezing & Shatter)

Resonance: Playing a Frost spell grants the Companion +2 Persistent Armor and extends its LoS shadow.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Boreas Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Glacial Spike** | 1 | Attack | T1 | Ranged (Line 3) | Deal 2 cold damage. Apply **Chill (1)**. | Apply **Chill (2)**. If target has 3 Chill, trigger **Freeze**. |
| **Ice Wall** | 1 | Construct | T1 | 2 Linear Cells | Conjure two connected Ice Barricades (8 HP each, blocks LoS). | Ice Barricades spawn with **Frost Rune** attached. |
| **Frost Nova** | 2 | Spell | T1 | Area (Around Unit)| Deal 2 cold damage to all surrounding units. Apply **Chill (1)**. | Units already Chilled become **Frozen** for 1 turn. |
| **Rime Rune** | 1 | Rune | T1 | Target Unit | Inscribe **Frost Rune**. Triggers when target is shoved or adjacent obstacle breaks. | Applies **Chill (2)** and **Brittle** to all adjacent units. |
| **Shatter Strike** | 2 | Attack | T2 | Melee (1 tile) | Deal 4 physical damage. If target is Frozen, trigger **Shatter**. | **Shatter** deals 6 shrapnel damage (up from 4) to adjacent cells. |
| **Glacial Armor** | 2 | Skill | T2 | Target Ally | Grant 6 Persistent Armor. Unit cannot be **Shoved**. | When this Armor is depleted, burst out **Chill (2)** to adjacent foes. |
| **Flash Freeze** | 2 | Spell | T2 | Ranged (2 tiles) | Target non-boss unit is **Frozen** for 1 turn. | Gain +1 Banked Pip if target had 0 Chill before casting. |
| **Deep Freeze** | 3 | Spell | T2 | Area ($2 \times 2$) | Target area becomes Freezing Terrain (MOV cost +2). Apply **Chill (2)**. | Units starting turn in area take 3 cold damage. |
| **Absolute Zero** | 4 | Spell | T3 | Target Enemy | Target unit is **Frozen** for 2 turns. Takes +4 bonus damage from all sources. | Surrounding enemies suffer **Chill (2)** each turn. |
| **Blizzard Engine** | 3 | Construct | T3 | Empty Cell | Spawns Glacial Monolith (16 HP). Applies **Chill (1)** to all foes each turn. | Allied Frost spells cost 1 fewer Pip while Monolith stands. |

---

### 3.3 Surge Signature Pool (High Velocity, Chains & Overload)

Resonance: Playing a Surge spell discharges 1 electric damage to the lowest HP enemy on the grid.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Volt Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Static Jolt** | 0 | Attack | T1 | Ranged (2 tiles) | Deal 2 lightning damage. | **Arc (2)** for 50% damage to nearby enemies. |
| **Chain Lightning** | 2 | Attack | T1 | Ranged (3 tiles) | Deal 4 lightning damage. Discharges **Arc (3)**. | If 3+ units are chained, refund +1 Banked Pip. |
| **Volt Step** | 1 | Skill | T1 | Empty Cell | Teleport caster/companion up to 2 tiles. Deal 1 shock damage at landing. | Trigger **Overload**: Gain +2 Temporary Sparks this round. |
| **Static Trap** | 1 | Rune | T1 | Target Tile | Attach **Static Rune**. Triggers when stepped on: 3 dmg + **Arc (2)**. | Target stepping onto rune is immobilized (**Entangle**) for 1 turn. |
| **Ball Lightning** | 2 | Attack | T2 | Vector Line | Project a slow orb traveling 1 tile/turn dealing 3 dmg to all path units. | Orb deals +2 damage for every card played this turn. |
| **Overcharge** | 1 | Skill | T2 | Self | Your next 2 attacks gain **Overload**: Deal +3 additional lightning damage. | Draw 2 cards immediately. |
| **Conductive Field**| 2 | Spell | T2 | Area ($3 \times 3$) | Units in area take double damage from all **Arc** discharges for 2 rounds. | Removes Persistent Armor from all targets in area. |
| **Hyper-Velocity** | 1 | Skill | T2 | Allied Minion | Target minion gains **Haste** and can attack twice this turn. | If it kills a unit, refund its full summon Pip cost. |
| **Gigavolt Cascade**| 4 | Spell | T3 | Target Unit | Deal 8 lightning damage. Discharges **Arc (5)** jumping across entire board. | Clears all enemy buffs and applies **Frail** (+2 damage taken). |
| **Plasma Storm** | 3 | Spell | T3 | Target Area | Spawns storm cloud over $2 \times 2$ area dealing 4 dmg/turn to occupants. | Storm moves 1 tile toward highest-HP enemy each turn. |

---

### 3.4 Bulwark Signature Pool (Armor Scaling, Concussion & Kinetic Force)

Resonance: Playing a Bulwark spell fortifies the lowest-HP ally with +2 Persistent Armor.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Terra Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Shield Slam** | 1 | Attack | T1 | Melee (1 tile) | Deal physical damage equal to 50% of current Armor. **Shove (1)**. | Deals 100% of current Armor as damage instead. |
| **Tectonic Shove** | 1 | Skill | T1 | Melee (1 tile) | **Shove (3)** target unit. Wall collision deals +2 bonus damage. | If unit collides with another unit, both are Stunned (0 MOV). |
| **Tremor Sigil** | 1 | Rune | T1 | Target Unit/Tile | Attach **Tremor Rune**. Detonates on forced move: 3 physical dmg + Stun. | Rune spreads a copy of itself to the collision obstruction. |
| **Fortified Stance**| 1 | Skill | T1 | Self / Companion | Grant 5 Persistent Armor. Unit gains **Counter (3)** this turn. | Draw 1 card if user already had Persistent Armor. |
| **Battering Ram** | 2 | Attack | T2 | Rush Line (3) | Dash forward 3 tiles. Deal 4 physical damage and **Shove (2)** first unit hit. | User gains +4 Persistent Armor upon successful collision. |
| **Earthen Spire** | 2 | Construct | T2 | Empty Cell | Spawns Stone Spire (14 HP). Deals 2 collision dmg if units are shoved into it. | Spire deals 4 collision damage and reflects melee attacks. |
| **Armor Burst** | 2 | Spell | T2 | Area (Self 1-rad) | Consume all Persistent Armor. Deal 100% of consumed armor to all foes. | 50% of consumed armor is refunded as Temporary Armor. |
| **Seismic Slam** | 3 | Attack | T2 | Area (Cone 3) | Deal 4 physical damage and knock all targets back 2 tiles. | Units hitting walls suffer instant **Shatter** on their Armor. |
| **Tectonic Cataclysm**| 4 | Spell | T3 | Entire Board | Deal 6 physical damage to all grounded units. Wall collisions deal 6 dmg. | Destroys all enemy constructs and converts them to friendly armor. |
| **Living Fortress** | 3 | Skill | T3 | Target Companion | Companion doubles its current Persistent Armor and gains **Guardian** for 3 turns. | Companion cannot take more than 4 damage from any single source. |

---

### 3.5 Dusk Signature Pool (Devour Spawning, Sparks & Sacrifices)

Resonance: Playing a Dusk spell generates +1 Temporary Spark if an ally died or was devoured this round.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Umbra Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Soul Harvest** | 1 | Spell | T1 | Target Minion | Destroy target allied minion. Gain +3 Temporary Sparks and draw 1 card. | Gain +4 Sparks and draw 2 cards instead. |
| **Shadowfang Strike**| 1 | Attack | T1 | Melee (1 tile) | Deal 3 shadow damage. **Pierce**. | If target dies, summon a $1 \times 1$ Shadow Ghoul (3 HP, 2 ATK). |
| **Soul Rune** | 1 | Rune | T1 | Ally / Tile | Inscribe **Soul Rune**. Detonates when ally in lane dies: Drains 3 HP from foe. | Drains 4 HP and transfers it directly to Commander HP. |
| **Dark Offering** | 0 | Skill | T1 | Self | Commander takes 4 damage. Gain +2 Banked Pips immediately. | Gain +1 additional Temporary Spark. |
| **Grave Rebirth** | 2 | Spell | T2 | Empty Cell | Resurrect the highest-stat friendly minion that died this battle at 50% HP. | Minion gains **Haste** and can act immediately. |
| **Cannibalize** | 2 | Skill | T2 | Target Ally | Target minion devours adjacent friendly minion, absorbing 100% HP and ATK. | Absorbing minion also gains +2 MOV and **Pierce**. |
| **Cursed Miasma** | 2 | Spell | T2 | Area ($2 \times 2$) | Enemies in area lose 2 HP/turn. Dying units in area grant player +1 Pip. | Duration extended by +1 turn whenever a unit dies inside. |
| **Shadowmeld** | 1 | Skill | T2 | Target Ally | Target gains Stealth (cannot be targeted) until it attacks. | Its next attack from Stealth deals double damage. |
| **Reaper's Harvest**| 4 | Spell | T3 | Target Enemy | Execute target non-boss enemy below 35% HP. Spawn Behemoth Abomination. | Spawns a $2 \times 2$ Dread Hulk (20 HP, 5 ATK) in its place. |
| **Eldritch Conduit**| 3 | Skill | T3 | Self | All friendly minions gain **Hollow (2)** for 3 rounds. | Whenever an ally dies, deal 3 shadow damage to enemy Commander. |

---

### 3.6 Bloom Signature Pool (Toxic Hazards, Snare Briars & Life Leech)

Resonance: Playing a Bloom spell heals the lowest-HP ally on the board for 2 HP.
| Card Name | Pip Cost | Type | Tier | Targeting | Base Effect | Attuned Effect (Flora Active) |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Thorn Whip** | 1 | Attack | T1 | Ranged (Line 2) | Deal 2 physical damage. **Pull (1)**. Apply **Toxin (1)**. | **Pull (2)**; applies **Toxin (2)**. |
| **Briar Patch** | 1 | Construct | T1 | 2 Linear Cells | Conjure Briars (6 HP). Units entering are **Entangled** and take 2 dmg. | Briars inherit **Leech (1)**, healing caster on contact. |
| **Spore Rune** | 1 | Rune | T1 | Target Enemy | Attach **Spore Rune**. Detonates on target death: Spreads **Toxin (3)** in (+). | Target takes +1 extra damage from all sources while rune is active. |
| **Noxious Bloom** | 2 | Spell | T1 | Area ($2 \times 2$) | Apply **Toxin (2)** to all enemies in area. | Leaves toxic mist that reapplies **Toxin (1)** for 2 turns. |
| **Leech Seed** | 2 | Skill | T2 | Target Enemy | Attach Leech Seed. Whenever target takes damage, heal your lowest unit by 2. | Target's MOV is reduced by 1 while seeded. |
| **Verdant Growth** | 2 | Skill | T2 | Target Ally | Heal target minion for 6 HP. Grant **Escalate**: +1 HP each turn start. | Target gains +2 Persistent Armor per turn as well. |
| **Bramble Wall** | 2 | Construct | T2 | 3 Linear Cells | Conjure Fortified Briar Wall (10 HP each, reflects 2 physical damage). | Spawns with **Spore Runes** attached to all segments. |
| **Toxic Overgrowth**| 2 | Spell | T2 | Target Enemy | Consume all **Toxin** stacks on target to deal $3 \times \text{stacks}$ true damage. | If target dies, spread half the consumed stacks to adjacent foes. |
| **Avatar of Nature**| 4 | Spell | T3 | Target Ally | Target transforms into Ancient Treant (+10 Max HP, +3 ATK, **Guardian**). | Treant leaves Briar Patches on every tile it traverses. |
| **Heartwood Rebirth**| 3 | Spell | T3 | Self | Restore 10 HP to Commander. Cleanse all negative status effects. | All active allied minions gain +3 HP and **Leech (1)**. |

---

## 4. Master Bestiary: $1 \times 1$ Minions

Minions occupy exactly 1 grid cell. They provide board control, lane blocking, burst physical damage, and sacrifice targets.

       FRONT-LINE                             MID-LANE                             BACK-LINE
┌──────────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────────┐│       BRUISER / TANK         │        │       SKIRMISHER / ROGUE     │        │       SNIPER / CASTER        ││  • High HP (8-14)            │   ──>  │  • Mid HP (5-7)              │   ──>  │  • Low HP (3-5)              ││  • Low MOV (1-2)             │        │  • High MOV (3-4)            │        │  • Low MOV (1-2)             ││  • Melee Strike (2-4 ATK)    │        │  • Flanking & Displacements  │        │  • Ranged Attacks (3-4 tiles)││  • Guardian / Persistent Arm │        │  • Stealth & Trap Placement  │        │  • Status Application        │└──────────────────────────────┘        └──────────────────────────────┘        └──────────────────────────────┘
### 4.1 Neutral Minions

| Unit Name | Pip Cost | HP | ATK | MOV | Range | Role / Sub-Type | Traits & Passive Behaviors |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Militia Footman** | 1 | 6 | 2 | 2 | Melee (1) | Frontline Chaff | **Guardian**: Orthogonal allies gain cover from ranged fire. |
| **Aether Scout** | 1 | 4 | 2 | 4 | Melee (1) | Fast Skirmisher | **Haste**: Can move and attack on the turn it is summoned. |
| **Ironclad Sentinel**| 2 | 10 | 2 | 1 | Melee (1) | Heavy Wall | Spawns with 4 Persistent Armor. **Counter (2)** against melee attacks. |
| **Crossbow Marksman**| 2 | 4 | 3 | 2 | Line (3) | Ranged Sniper | **Aim**: If this unit does not move, its attack gains **Pierce**. |
| **Runic Golem** | 3 | 12 | 4 | 2 | Melee (1) | Bruiser | **Escalate**: Gains +1 ATK and +1 Armor whenever you play an Arcane card. |
| **Battering Automaton**| 2 | 8 | 3 | 2 | Melee (1) | Siege Breaker | Deals $2\times$ damage to obstacles. On hit: **Shove (2)**. |

---

### 4.2 School-Specific Minions

| Unit Name | School | Cost | HP | ATK | MOV | Range | Traits & Escalation Rules |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Pyre Imp** | Pyre | 1 | 3 | 2 | 3 | Melee (1) | **Deathburst**: Detonates upon death, dealing 2 fire dmg to adjacent cells. |
| **Cinder Hellhound** | Pyre | 2 | 7 | 3 | 3 | Melee (1) | Attacks deal **Ignite (1)**. **Escalate**: +1 ATK when striking Burning units. |
| **Glacial Sprite** | Frost | 1 | 4 | 1 | 2 | Ranged (2)| Basic attack applies **Chill (1)**. Leaves an Ice Barricade when killed. |
| **Frostbound Warden** | Frost | 2 | 11 | 2 | 1 | Melee (1) | **Guardian**. Enemies striking this unit in melee suffer **Chill (1)**. |
| **Surge Sparker** | Surge | 1 | 3 | 2 | 4 | Melee (1) | Attacks apply **Arc (2)**. Can pass through enemy units during movement. |
| **Stormstrider** | Surge | 2 | 6 | 4 | 3 | Melee (1) | **Overload**: If 3+ cards played this turn, this unit gains +2 MOV and +2 ATK. |
| **Granite Basher** | Bulwark | 2 | 9 | 3 | 1 | Melee (1) | **Concuss**: Attacks deal **Shove (2)**. Wall impacts deal +2 extra damage. |
| **Earthshaper** | Bulwark | 2 | 7 | 2 | 2 | Ranged (2)| Attack pulls target 1 tile closer. Turn Start: Grants adjacent ally +2 Armor. |
| **Ghoul Thrall** | Dusk | 1 | 4 | 2 | 2 | Melee (1) | **Hollow (1)**: Grants +1 Temporary Spark upon death or sacrifice. |
| **Soul Weaver** | Dusk | 2 | 5 | 3 | 2 | Ranged (3)| **Devour Spawn**: Consumes ally on summon; inherits 100% of ally stats as Armor. |
| **Brier Stalker** | Bloom | 1 | 5 | 2 | 3 | Melee (1) | **Stealth**. First attack from Stealth inflicts **Toxin (2)** and **Entangle**. |
| **Spore Spitter** | Bloom | 2 | 5 | 2 | 2 | Ranged (3)| Attacks apply **Toxin (1)**. **Leech (1)** on all unblocked damage dealt. |

---

## 5. Master Bestiary: $2 \times 2$ Behemoth Engines

Behemoths occupy a $2 \times 2$ footprint (4 tiles). They are high-cost, high-impact tactical centerpieces with multi-tile collision profiles and unique pathing requirements.

                BEHEMOTH FOOTPRINT & SWEEP CONSTRAINTS
                
   4-CELL OCCUPANCY                        CLEAVE ATTACK CONE
  ┌───────┬───────┐                       ┌───────┬───────┬───────┐
  │ (X,Y) │(X+1,Y)│                       │ Cleave│ Target│ Cleave│
  ├───────┼───────┤                       ├───────┼───────┼───────┤
  │(X,Y+1)│(X+1,1)│                       │   [B E H E M O T H]   │
  └───────┴───────┘                       │   [2 x 2  U N I T ]   │
(Must clear all 4 cells)                   └───────────────────────┘
### 5.1 Behemoth Movement & Collision Mechanics
1. **Four-Cell Clearance:** A Behemoth can only move to a destination if all 4 destination cells are completely clear of obstacles, units, and impassable terrain.
2. **Heavy Mass (Unshoveable):** Behemoths are immune to standard **Shove** and **Pull** effects. Displacement spells fail unless explicitly labeled **"Heavy Displacement"**.
3. **Crush Displacement:** When a Behemoth moves forward, any $1 \times 1$ minion in its direct vector is pushed backward 1 cell. If blocked by a wall, that minion suffers **4 collision damage**.
4. **LoS Occlusion Wall:** A $2 \times 2$ Behemoth casts an absolute Line-of-Sight shadow across both occupied columns, blocking all ranged attacks passing through its footprint.

---

### 5.2 Complete Behemoth Catalog

Behemoth Deck Constraint: Maximum of TWO Behemoths total per 30-card deck.
#### 1. Siege Golem (Universal / Neutral)
* **Pip Cost:** 4 Pips | **Footprint:** $2 \times 2$
* **HP:** 24 | **Persistent Armor:** 6 | **ATK:** 5 | **MOV:** 1 | **Range:** Melee Frontal Arc (2 tiles wide)
* **Passive — Tectonic Plating:** Takes -1 damage from all non-Pierce attacks.
* **Active Attack — Fortified Cleave:** Deals 5 physical damage to 2 target cells in front. Knocks $1 \times 1$ targets back 2 tiles (**Heavy Shove**).
* **Escalation:** Whenever an allied construct or obstacle shatters, gain +2 Persistent Armor.

#### 2. Magma Wyrm (Pyre School)
* **Pip Cost:** 4 Pips (or 2 Pips + Sacrificing an active Pyre minion) | **Footprint:** $2 \times 2$
* **HP:** 18 | **Persistent Armor:** 0 | **ATK:** 6 | **MOV:** 2 | **Range:** Frontal Cone ($3 \times 2$)
* **Passive — Scorched Earth:** Leaves permanent Burning Hazards on all 4 tiles it vacates when moving.
* **Active Attack — Hellfire Breath:** Deals 6 fire damage across a 3-tile wide cone. Applies **Ignite (3)** to all targets struck.
* **Resonance Synergy (Ignis):** When Magma Wyrm attacks, detonate all **Cinder Runes** on the board instantly.

#### 3. Glacial Behemoth (Frost School)
* **Pip Cost:** 4 Pips | **Footprint:** $2 \times 2$
* **HP:** 26 | **Persistent Armor:** 8 | **ATK:** 4 | **MOV:** 1 | **Range:** Melee Frontal Sweep
* **Passive — Glacial Wall:** Acts as an impassable obstacle to enemy ranged spells. Enemies ending turn adjacent suffer **Chill (1)**.
* **Active Attack — Avalanche Slam:** Deals 4 cold damage in a $2 \times 2$ frontal pattern. All targets with 2+ Chill are instantly **Frozen**.
* **Shatter Trigger:** If striking a Frozen target, consumes Freeze to deal **10 true damage** and strip 100% of target Persistent Armor.

#### 4. Voltaic Colossus (Surge School)
* **Pip Cost:** 3 Pips + 2 Temporary Sparks | **Footprint:** $2 \times 2$
* **HP:** 16 | **Persistent Armor:** 2 | **ATK:** 5 | **MOV:** 3 | **Range:** Orthogonal Discharge (3 tiles)
* **Passive — Supercharged Core:** When summoned, discharges **Arc (4)** for 3 electrical damage across the board.
* **Active Attack — Thunderous Surge:** Deals 5 lightning damage to primary target. Discharges 3 damage to all units in the same row and column.
* **Overload Protocol:** If 4+ cards were played this turn, this unit's attack ignores target Persistent Armor (**Pierce**).

#### 5. Dread Abomination (Dusk School)
* **Pip Cost:** 3 Pips + Devour 2 Allied Minions | **Footprint:** $2 \times 2$
* **HP:** 20 | **Persistent Armor:** 0 | **ATK:** 6 | **MOV:** 2 | **Range:** Melee Frontal (2 tiles)
* **Devour Spawning Requirement:** Must be placed on top of at least two $1 \times 1$ allied units. It absorbs their total remaining HP into its starting HP pool.
* **Passive — Death Eater:** Gains +2 Max HP and +1 ATK whenever any unit (ally or foe) dies anywhere on the board.
* **Active Attack — Soul Rend:** Deals 6 shadow damage. Drains 3 HP from the target, healing Commander HP directly.

#### 6. Verdant Ironwood Ancient (Bloom School)
* **Pip Cost:** 4 Pips | **Footprint:** $2 \times 2$
* **HP:** 28 | **Persistent Armor:** 4 | **ATK:** 3 | **MOV:** 1 | **Range:** Sweep ($3 \times 1$)
* **Passive — Spore Canopy:** Allied units within 1 tile gain **Leech (1)** and cannot be targeted by single-target spells.
* **Active Attack — Root Entanglement:** Deals 3 physical damage to 3 tiles in front. Inflicts **Entangle** and **Toxin (2)** on all targets.
* **Escalate — Deep Roots:** At turn start, restore 4 HP to this unit and grant +1 Max HP to all allied companions.

---

## 6. Technical Data Models & JSON Schemas

```json
{
  "$schema": "[http://json-schema.org/draft-07/schema#](http://json-schema.org/draft-07/schema#)",
  "title": "ConjureCardDefinition",
  "type": "object",
  "properties": {
    "card_id": { "type": "string", "example": "pyr_atk_01_flamelash" },
    "card_name": { "type": "string", "example": "Flame Lash" },
    "school": { "type": "string", "enum": ["Arcane", "Pyre", "Frost", "Surge", "Bulwark", "Dusk", "Bloom"] },
    "tier": { "type": "integer", "minimum": 1, "maximum": 3 },
    "pip_cost": { "type": "integer", "minimum": 0, "maximum": 8 },
    "spark_cost": { "type": "integer", "default": 0 },
    "card_type": { "type": "string", "enum": ["Attack", "Skill", "Spell", "Construct", "Rune", "Reaction"] },
    "targeting_schema": {
      "type": "object",
      "properties": {
        "range_type": { "type": "string", "enum": ["Melee", "RangedLine", "RangedCone", "AreaCross", "AreaBox", "Global"] },
        "distance": { "type": "integer" },
        "width": { "type": "integer" },
        "requires_los": { "type": "boolean" },
        "can_target_empty_tile": { "type": "boolean" }
      },
      "required": ["range_type", "distance", "requires_los"]
    },
    "effects": {
      "type": "object",
      "properties": {
        "base_damage": { "type": "integer", "default": 0 },
        "damage_type": { "type": "string", "enum": ["Physical", "Fire", "Cold", "Lightning", "Shadow", "Arcane", "True"] },
        "armor_gain": { "type": "integer", "default": 0 },
        "status_applied": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "status_id": { "type": "string" },
              "stacks": { "type": "integer" }
            }
          }
        },
        "displacement": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["Shove", "Pull", "None"] },
            "magnitude": { "type": "integer" }
          }
        },
        "attuned_bonus": {
          "type": "object",
          "properties": {
            "required_companion": { "type": "string" },
            "bonus_damage": { "type": "integer" },
            "extra_status_stacks": { "type": "integer" },
            "refund_sparks": { "type": "integer" }
          }
        }
      }
    }
  },
  "required": ["card_id", "card_name", "school", "tier", "pip_cost", "card_type", "targeting_schema"]
}
JSON{
  "$schema": "[http://json-schema.org/draft-07/schema#](http://json-schema.org/draft-07/schema#)",
  "title": "ConjureUnitDefinition",
  "type": "object",
  "properties": {
    "unit_id": { "type": "string", "example": "min_frost_warden_01" },
    "unit_name": { "type": "string", "example": "Frostbound Warden" },
    "school": { "type": "string", "enum": ["Neutral", "Pyre", "Frost", "Surge", "Bulwark", "Dusk", "Bloom"] },
    "footprint": { "type": "string", "enum": ["1x1", "2x2"] },
    "stats": {
      "max_hp": { "type": "integer", "minimum": 1 },
      "base_armor": { "type": "integer", "default": 0 },
      "base_atk": { "type": "integer", "minimum": 0 },
      "base_mov": { "type": "integer", "minimum": 0 }
    },
    "attack_profile": {
      "range_type": { "type": "string", "enum": ["Melee", "Line", "Cone", "Arc"] },
      "reach": { "type": "integer", "default": 1 },
      "keywords": { "type": "array", "items": { "type": "string" } }
    },
    "innate_traits": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "trigger": { "type": "string", "enum": ["OnSummon", "TurnStart", "OnAttacked", "OnDeath", "OnKill", "Passive"] },
          "effect_script": { "type": "string" }
        }
      }
    }
  },
  "required": ["unit_id", "unit_name", "school", "footprint", "stats", "attack_profile"]
}
7. Strategic Validation & Balance MetricsTo maintain competitive balance across the open-draft ecosystem, all cards and units conform to the following mathematical balance targets:┌─────────────────────────────────────────────────────────────────────────────┐
│                       PIP-TO-VALUE CONVERSION CURVES                        │
├──────────┬──────────────────────┬─────────────────────┬─────────────────────┤
│ Pip Cost │ Single Target Damage │ Area Damage (3+ sq) │ Protective Armor    │
├──────────┼──────────────────────┼─────────────────────┼─────────────────────┤
│  0 Pip   │ 2 (with condition)   │ N/A                 │ 2 (Temporary)       │
│  1 Pip   │ 3-4 flat damage      │ 2 flat damage       │ 3-4 Persistent      │
│  2 Pips  │ 5-6 flat damage      │ 3-4 flat damage     │ 6-8 Persistent      │
│  3 Pips  │ 7-8 flat damage      │ 5-6 flat damage     │ 9-11 Persistent     │
│  4 Pips  │ 9-12 (Power Tier)    │ 7-8 flat damage     │ 12-16 Persistent    │
└──────────┴──────────────────────┴─────────────────────┴─────────────────────┘
Collision Multipliers: Forced displacement is priced at a premium because wall impacts deal 3 true damage and unit collisions deal 2 damage to both parties. A 1-Pip card with Shove (2) provides an effective value ceiling of 5 to 6 damage if the lane is engineered correctly.Devour & Sacrifice Scaling: Dusk sacrifice cards must refund approximately 1.5 Sparks per Pip spent on the sacrificed minion to maintain tempo against aggressive Pyre and Surge decks.Escalation Turn Limiters: Escalation traits on $1 \times 1$ minions are capped at a maximum of +3 stat growth over their baseline to prevent snowballs before turn 5. Behemoth escalation traits are uncapped but balanced by low movement ($MOV = 1$).