# Module 7: Audio, Visual FX & Animation Specifications

[cite_start]This document outlines the artistic and auditory direction for the game[cite: 39]. [cite_start]It defines how the open-world aesthetic seamlessly transitions into tactical combat, ensuring that visual and audio feedback grounds the mechanics in a tactile, immersive way[cite: 40].

---

## 1. Visual Style & Art Direction Guide

[cite_start]The game utilizes a **Vibrant Cel-Shaded** aesthetic (inspired by *Genshin Impact* and *Wizard101*). [cite_start]The world is bright, readable, and inviting, defined by bold character outlines and expressive, colorful environments[cite: 42].

* [cite_start]**World-to-Combat Seamless Transition:** Combat does not load into a separate void or diorama box[cite: 43]. [cite_start]When a battle is initiated, the grid seamlessly projects directly over the existing open-world terrain with a glowing, stylized boundary line[cite: 44].
* [cite_start]**Environmental Grid Integration:** Physical objects in the overworld immediately snap into the grid ecosystem[cite: 45]. [cite_start]A wandering duel near a ruined wall means that wall occupies specific tiles as impenetrable obstacles[cite: 46]. [cite_start]Trees, explosive barrels, or harvestable props naturally become part of the battlefield layout[cite: 47].
* [cite_start]**Dynamic Weather States:** Overworld weather persists during combat and visually impacts the grid[cite: 48]. [cite_start]Rain makes tiles slick and enhances lightning VFX, falling ash from volcanic biomes layers onto Behemoth models, and snow accumulates on Dormant barricades[cite: 49].

---

## 2. VFX Specifications (Diegetic Approach)

[cite_start]Visual feedback prioritizes in-world realism within the stylized art, avoiding overly game-y UI overlays wherever possible. [cite_start]Spells and impacts should feel like they are physically altering the environment[cite: 51].

* [cite_start]**Line-of-Sight & Occlusion:** Instead of glowing red UI overlays, blocked line-of-sight is represented by literal, looming shadows cast by obstacles and Behemoths, dynamically shifting based on the angle of the attack[cite: 52].
* [cite_start]**Rune Attachments:** Delayed detonation Runes do not float above a unit's head as a UI icon[cite: 53]. [cite_start]They appear as glowing, magical brands physically seared onto the minion's armor, skin, or the terrain tile itself, pulsating as the timer ticks down[cite: 54].
* [cite_start]**Collision & Impact Physics:** Directional shoving and 3/2 collision damage feature heavy, physics-based reactions[cite: 55]. [cite_start]Heavy Behemoths being shoved into walls generate localized screen-shake, structural cracking textures on the obstacle, and thick dust clouds[cite: 56].
* [cite_start]**Elemental Scars:** Spells leave temporary marks on the environment[cite: 57]. [cite_start]A heavy Pyromancy cascade leaves the grass tiles charred and smoking, while Cryomancy freezes the grass blades and creates a localized frost layer[cite: 58].

---

## 3. SFX & Soundscape Plan

[cite_start]The audio design must sell the weight of the mechanics, contrasting the vibrant art style with violent, impactful, and high-stakes sound cues.

| Audio Trigger | Soundscape Description |
| :--- | :--- |
| **Pip Generation (Persistent)** | [cite_start]Satisfying and rhythmic[cite: 60]. [cite_start]Sounds like a heavy glass vial rapidly filling with liquid, or thick gold coins dropping into a leather pouch[cite: 61]. |
| **Spark Generation (Sacrifice)** | [cite_start]Harsh and aggressive to emphasize the violent cost[cite: 62]. [cite_start]Features the sound of sizzling flesh, tearing fabric, or shattering glass[cite: 63]. |
| **Rune Detonations** | [cite_start]A delayed audio cue[cite: 63]. [cite_start]A high-pitched, escalating magical hum that cuts out for a split second of absolute silence before a massive, bass-heavy boom[cite: 64]. |
| **Unit Deaths (1x1)** | [cite_start]Quick and brittle[cite: 65]. [cite_start]A sharp crumble, a burst of energy, or a swift "poof" of smoke depending on the unit's elemental type[cite: 66]. |
| **Unit Deaths (2x2)** | [cite_start]Heavy and prolonged[cite: 67]. [cite_start]Sounds like a collapsing stone building or a massive tree falling, with a delayed thud that resonates in the bass[cite: 68]. |
| **"Last Stand" Sudden Death** | [cite_start]Absolute panic induction[cite: 69]. [cite_start]Background music cuts out completely[cite: 69]. [cite_start]Ambient noise is muffled[cite: 69]. [cite_start]The primary audio becomes a heavy, rhythmic heartbeat or the relentless ticking of a clock[cite: 70]. |