# MODULE 6: UI/UX & INTERFACE ARCHITECTURE

**Document Version:** 1.0
**System Anchor:** Master Game Build & Tactical Grid Engine
**Dependencies:** Draft 7.0 (Core Combat Architecture), Module 3 (World Biomes & Encounters)

---

## 1. Executive Summary & Design Pillars
Module 6 defines the visual language, camera architecture, and interface layouts for combat, deck building, and open-world exploration. Because CONJURE relies heavily on complex spatial mechanics (directional knockbacks, occlusion, chained detonations), the primary UI pillar is **Tactical Readability**. Information must be seamlessly integrated into the environment (diegetic design) to prevent spreadsheet-like screen clutter while maintaining absolute mathematical clarity for the player.

---

## 2. Combat Viewport & Camera Perspective

The battlefield is presented through a dynamic **2.5D Isometric Tilt** (heavily inspired by *Final Fantasy Tactics* and *Into the Breach*). 

### 2.1 The "Lazy Susan" Tactical Board
* **Visual Style:** An angled diamond grid with variable verticality. Terrain blocks, $1 \times 1$ minions, and $2 \times 2$ Behemoths are rendered as 2.5D or 3D miniatures on a tactile, tabletop-style board.
* **Manual Rotation (Mouse Drag):** The tactical grid operates like a physical board on a table. By clicking and dragging (right-click or middle-mouse), the player can smoothly rotate the battlefield 360 degrees to view the action from any angle. This provides a natural solution to peek behind towering Behemoths or environmental hazards.
* **Camera Snap:** A dedicated "Snap to Front" UI button (and Spacebar hotkey) instantly resets the camera to the default 30° isometric perspective.

### 2.2 Dynamic Silhouette System (The Skyscraper Failsafe)
* **The Problem:** Tall obstacles occluding crucial units or delayed Runes.
* **The Resolution:** When an active unit, enemy, or rune is positioned behind a taller model from the current camera angle, the game renders a bright, solid-color silhouette shining *through* the tall model. Players can also hold a specific keybind (e.g., Alt) to drop the opacity of all large terrain models to 20%.

---

## 3. Off-Grid Physical Commanders & Resource HUD

Rather than abstract 2D portraits, the Hero and Companion are physically present, standing just behind the player's side of the grid.

### 3.1 Commander Anchoring & Hitboxes
* **Screen Anchoring:** The Hero and Companion models, along with the bottom UI HUD, remain firmly anchored to the bottom of the player's screen regardless of how the player rotates the "Lazy Susan" grid.
* **The Runic Boundary:** To separate the grid physics from the off-grid commanders, a glowing magical perimeter (or raised physical lip) surrounds the $5 \times 5$ board. Units knocked off the edge explicitly crash into this boundary, taking standard $3/2$ collision damage rather than flying into the commanders.

### 3.2 The Dual-Ring Resource Dial
Positioned at the bottom center of the screen, beneath the physical Commander models, is the primary resource HUD.
* **Shared HP Bar:** A large, crystalline 40 HP gauge bridging the space between the Hero and Companion.
* **Banked Pips (Inner Ring):** Heavy, metallic sockets that fill with glowing energy to represent persistent Pips ($0\text{--}8$).
* **Temporary Sparks (Outer Ring):** A flickering, ethereal outer ring of flame beads. These generate dynamically upon minion sacrifice and aggressively burn away during the end-of-turn sequence.
* **Direct-to-HUD Damage:** When the shared HP takes damage from non-grid sources (like Ante wager penalties or direct spells), the game triggers a unified screen-shake and spawns damage numbers directly over the HUD HP bar to prevent grid confusion.

---

## 4. Spatial Overlays & Visual Feedback

To ensure players can calculate collision math and line of sight without committing to an action, the game uses immediate, non-intrusive preview overlays.

### 4.1 Line of Sight (Projective Vision Cones)
When hovering a ranged attack or spell, a light cone projects from the caster across the grid. Any tiles blocked by obstacles or Guardians are heavily shaded in a semi-transparent "fog of war," instantly communicating invalid targets.

### 4.2 Collision Physics (Trajectory Ghosting)
* **Primary Ghosting:** When aiming a knockback or shove, a translucent "ghost" of the target slides along the displacement vector, stopping at the exact collision tile. A bright, jagged **CRASH** badge previews the secondary $3/2$ collision damage.
* **Cascade Previews (Expand Prediction):** To prevent visual vomit during massive chain-reaction explosions, trajectory ghosting only shows the immediate collision by default. Holding "Expand Prediction" (e.g., Shift) pauses ghost animations and simply drops clean, numerical threat badges (e.g., `-5 HP`) on all tiles caught in the resulting cascade.

### 4.3 Runes & Cascades (Radial Pulse Auras)
Delayed detonation Runes attached to tiles or units emit a subtle, rhythmic pulse ring with a floating runic die ($2 \rightarrow 1 \rightarrow 0$). Hovering over a Rune aggressively highlights all connected tiles in a fiery glow, mapping out the chain-reaction blast radius.

---

## 5. Deck Builder & Collection Binder

The card collection menu abandons clunky grid pages in favor of a sleek, fast-paced deck-building experience.

### 5.1 Single Deck Stream with Dual Signature Headers
* **The 3D Card Fan:** Cards are presented in an overlapping, smooth-scrolling 3D horizontal stream.
* **Dual-Color Framing:** Hero Utility cards feature slate grey/neutral borders. Companion signature cards are styled after their specific magic school (e.g., crackling amber for Electromancy, deep crimson for Pyromancy).
* **Visual Limit Enforcement:** The UI visually enforces the $3/2/1$ duplicate limits. If a player hits the cap for a specific tier, all remaining copies of that card in the binder instantly gray out and lock.

### 5.2 The Quick-Grid Toggle (Navigation Failsafe)
* **The Problem:** Scrolling left-to-right through 30+ cards can cause UI fatigue when min-maxing a mana curve.
* **The Resolution:** A "Grid View" toggle icon instantly flattens the immersive 3D stream into a zoomed-out 2D matrix, allowing the player to view the entire deck on a single page while retaining color-coded borders for quick parsing.

---

## 6. Overworld HUD & Discovery Menus

The open-world UI embraces a **Diegetic Alchemist HUD**, framing menus as physical objects the Hero carries.

### 6.1 The Diegetic Field Journal
Menus for the Bestiary, Quest Log, and Blueprint Scribing open as a sprawling, illustrated traveler’s journal with flipping parchment pages and ink-drawn monster sketches.
* **Adaptive Animation Speed:** The first time the journal is opened in a session, it plays the full, satisfying page-flip animation. On subsequent quick-opens, it snaps to the screen in 0.2 seconds to prevent animation fatigue.

### 6.2 Exploration HUD Elements
* **Ornate Compass:** Replaces the standard mini-map. It floats in the corner and pings in the direction of roaming Ante Duelists, Subjugation Trials, and interactable hazards.
* **Overworld Recipe Tracker:** Players can "pin" one crafting recipe from their journal directly to the screen under the compass, allowing them to track required regional reagents without repeatedly opening menus.
* **Renown Badges:** Regional Renown tiers (Novice, Adept, Master) are displayed as polished, physical medals pinned to the top corner of the screen, upgrading their visual flair as the player ranks up.

---

## 7. Implementation Summary Table

| UI System | Core Visual Implementation | Edge Case Resolution |
| :--- | :--- | :--- |
| **Viewport** | 2.5D Isometric "Lazy Susan" | Dynamic x-ray silhouettes handle large occlusion. |
| **Commanders** | Off-grid 3D models bottom-anchored | Runic Boundary wall keeps collisions on-grid. |
| **Resources** | Dual-Ring Central HUD Dial | Direct-to-HUD numbers separate spell vs grid damage. |
| **Vision/LoS** | Projective light cones & Fog of War | Cleanly blocks invalid targets without visual clutter. |
| **Collisions** | Trajectory Ghosting & CRASH badges | Expand Prediction key summarizes massive chain combos. |
| **Deck Builder** | 3D Horizontal Fan Stream | Quick-Grid toggle flattens stream for rapid min-maxing. |
| **Overworld** | Diegetic Field Journal & Compass | Adaptive animation speeds prevent menu fatigue. |
