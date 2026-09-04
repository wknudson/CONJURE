# CONJURE — Roadmap v2

*Written 2026-08-16, after the Pirate101/Mewgenics grid rework. This is the plan for
what comes next, grounded in an audit of what is actually built.*

---

## 0b. Advanced Combat Dynamics (2026-08-17, after the Bound Form pivot)

Six sections shipped, 385 tests green. Two keystone refactors landed first, each proving
itself by changing no behaviour: one shared answer to "is that in reach" (which §3, fog
and gale each then modified in one place) and a cost-relaxing pathfinder (which rubble
then used).

| Section | What landed |
| :-- | :-- |
| **Symmetric battlefield** | Duelists field their own Companion; both routes to the Pact stay open. Ignis is the on-grid unit and docks into a 2×2 enraged form at half health |
| **Economy** | Channel (`C`), reaction Bone refunds capped at 2/turn, Marrow Geodes on neutral ground |
| **Ranged archetypes** | Sniper (lines only), Lobber (ignores sight, blind up close), Turret (immobile) |
| **Terrain** | Rubble costing double, volatile crystals hitting friend and foe, conveyor currents at the round boundary |
| **Wildlife** | `Feral` units nobody commands; a scavenger that flees and escapes, wolves that maul both sides |
| **Weather** | Fog clamping all vision to 3, a directional gale, rain blunting fire |

Three latent bugs surfaced: the AI hoarded Marrow that expires (Channel's gate must require
the Marrow to *complete a purchase*); `canMove` ignored MOV so an immobile unit never read
as spent; and the first draft of the boss phase re-announced itself when the drake was
boxed in (growth is now tracked apart from the phase).

**Deliberately not done, and why** *(ledger updated 2026-08-31 — three of the five have
since landed)*:
- ~~**Arc, the rain reaction.**~~ **Landed** once Surge shipped the damage type and cards
  the note was waiting on — a full `ReactionDef` with the `requiresWeather` field this
  bullet sketched, paying the standard refund under the standard cap.
- **§2.4 bone income fail-safe.** Still held, as the doc asks. It is one token: `turn.ts`'s
  `gainBones(ctx, side, 1)` is the only income in the game, and the line says so.
- ~~**AI kiting.**~~ **Landed in two halves.** Strike-and-withdraw came with the retreat
  term; the enumeration prune then still confined backward moves to the Bound Form, so
  ranged bodies could only sidestep. The prune now exempts every ranged body — backing a
  shooter up is kiting, not retreating — and melee stays pruned as before.
- ~~**The AI is blind to Geodes.**~~ **Landed.** Cracks score through a dedicated
  `extraction` weight read off the simulated `marrowExtracted` event, and the pursue term
  counts a Geode as quarry and gates off for a unit already in reach of one — so the
  middle is contested without any new enumeration. `docs/09_ai_and_encounters.md` has the
  pricing.
- **`magma_brute` Resonance.** Still a Pyre summon marked `source: 'hero'`, so it never
  triggers Resonance. Moving it is a buff, not a fix — a balance decision, and it stays
  one.

**Worth measuring before tuning:** with the same brain on both sides the player takes 9 of
10 on the mirror duelist (first move, stronger Companion), while a scripted player that
only swings loses every game. Skill separates those sharply now. Several wall-clock test
budgets were raised as the engine legitimately does more per turn; the assertions were not
weakened, and determinism is still caught by hash comparison rather than by the clock.

---

## 0. Since this was written: the Bound Form pivot (2026-08-17)

Four phases shipped, 267 tests green. The combat loop changed shape enough that parts of
the audit below are now history rather than plan.

| Phase | What landed |
| :-- | :-- |
| **Dynamic grid** | Territory depth derived rather than hardcoded in five places (one row on boards ≤5 tall, so a 4×4 keeps neutral ground); `createCombat` validates arena size and furniture placement; 4×4/4×7 and non-square camera-rotation coverage added |
| **Bound Form** | The Companion is a unit on the board. All damage to it — strike, spell, burn tick, wall collision — is dealt to the Pact; it cannot be tithed, marked, or grown. Sudden death restores it. HUD counts blows on it as incoming Pact damage |
| **Origin casting** | Hero cards reach the whole board; Companion cards are cast from the Companion's tile with range and line of sight. A side with no body still casts globally, which is what keeps the enemy AI's deck intact |
| **Pre-combat** | An overhead plan of the arena before the fight, with up to five card swaps; **Ready** fixes the deck and generates a recorded seed, so Rematch is the same battle |

Two pre-existing bugs fell out of this work: the threat map flagged *every* ranged enemy
as a Commander threat regardless of sightlines (the check asked only whether the unit was
on the board), and the raw blood-tithe command validated neither protection nor whether
the offering was worth any Marrow.

**Opened, not closed, by the pivot:**

- **Enemy Bound Forms.** Enemy Commanders stay off-grid. Giving a boss a body needs an
  `EncounterDef` field and a decision about its Resonance lane; the seam is commented.
- **Resonance follows the static lane**, not the Companion's live column. Recomputing it
  at trigger time is a one-line change and a real balance shift — deliberately not taken.
- **`magma_brute`** is a Pyre summon marked `source: 'hero'`, so it never triggers
  Resonance. Moving it is thematically right and a buff; left as a balance decision.
- ~~**`hud/projection.ts` hardcodes the Growth cap** rather than reading the stat block's
  `escalationCap` — harmless today, wrong the day a card changes a cap.~~ **Landed**
  (2026-09-01), and it was not harmless: the *step* was hardcoded too, at one point, against
  an engine that grows bodies by ten — so the "Incoming" readout the E1 trust-gap fix rests
  on was ten short for every grower and one too many for the Growth bodies whose stat block
  grows by nothing. The snapshot now carries each grower's real step and cap, and the HUD
  reads them rather than guessing.
- **Arena variety.** The engine now supports 4×4 through 12×12, but both shipped
  encounters are still 6×8 and 8×8. Nothing exercises the new shapes in play.

---

## 1. Where the project stands

### Done and verified (1591 tests across 88 files, clean build, playable at localhost:5173)

| System | State | Reference |
| :-- | :-- | :-- |
| Rules engine | Bones and Marrow, overdraw burn, free reshuffle, Retain, movement (BFS, 2×2 footprints), **independent move + attack per turn**, collisions 30/20 with Mass Invariance, supercover LoS, Guardian occlusion, Marks with cascades and armor gating and fizzle, Growth caps, the status tick order, sudden-death double-KO | `docs/02_combat_lexicon.md` |
| Cards | 214 base cards — **at least twenty per elemental school**, and every school's draftable shelf full — all data-driven through shared effect primitives. Rank 2 printings are derived, not authored | `docs/08_card_catalog.md` |
| Splicing | 19 pressings covering **all fifteen** dual-school pairings, from six Cores (one per school) | `docs/08_card_catalog.md` |
| Deck building | Hero Deck of 4–12, tier-derived copy limits, Behemoth cap, the Grimoire draft, one swap after seeing the arena | `docs/07_deck_building.md` |
| Encounters | Novice Duelist, Ignis Trial (damage gate with chain nullification, Rite of Subjugation at 25%, Forced Eviction), Glacial Field, Narrow Ruin, Wildlife | `docs/09_ai_and_encounters.md` |
| AI | Novice and Adept tiers — utility scoring, Lethal Veto, deterministic tie-breaks, seeded suboptimality, collision awareness at Adept | `docs/09_ai_and_encounters.md` |
| Reactions | Six shipped: Vaporize, Shatter, Overload, Superconduct, Arc, Wildfire | `docs/02_combat_lexicon.md` |
| Companions | 17 companions with Bound Forms, Resonance passives, the taming roll and trait bloodlines | `docs/03_rpg_sandbox.md` |
| Roster and revival | The Vanguard Roster on a point budget that **scales with the arena** (`width + height`, 8–24) against a 24-point owned kit, a deployment phase onto Anchor Tiles, Auras that climax, three revival routes | `docs/07_deck_building.md` |
| Sandbox | Safehouse hub, Bounty Board, the Artificer's Forge (schematics, ascension, splicing), 11 relics | `docs/05_ironworks_artificer.md` |
| Terrain and weather | Rubble, cover, volatile crystals, conveyor currents, hazard tiles, fog, a directional gale, rain | `docs/02_combat_lexicon.md` |
| Saves | Versioned localStorage with migration, a backup copy, corruption recovery, soulbound staples | `docs/01_system_architecture.md` |
| Onboarding | First-run tutorial, glossary tooltips on everything, rules reference, danger-zone overlay, contextual refusal messages | `docs/10_presentation.md` |
| Presentation | Canvas iso board with manual rotation, DOM HUD, animation sequencer over a typed event FIFO, trajectory ghosting, expand-prediction, WebAudio cues | `docs/10_presentation.md` |

### Partial — exists but shallow

| Item | Gap |
| :-- | :-- |
| **Frost and Arcane Auras** | The other five schools each have an Aura with a Climax trait. These two are designed and unbuilt (`src/core/data/auras.ts`). |
| **AI kiting** | Retreats stay pruned from enumeration for everything except a Bound Form, so the ranged archetypes get played as static shooters rather than kited. |
| **The AI is blind to Geodes** | No obstacle-kill scoring, so the enemy never crosses the board to break one. Deliberate — it keeps enumeration flat — but it is free value declined. |
| **Threat panel** | A toggle and a one-line warning exist; the itemised list of declared intents — which unit, how much, where — does not. `COMBAT_FEEL.md` §E3 |
| **Card hover preview** | Reading a card costs a click. Hovering should preview it. `COMBAT_FEEL.md` §E2 |
| **Spent-unit tick** | Spent units dim, which reads as "disabled" rather than "done". A tick would say it properly. `COMBAT_FEEL.md` §E2 |

### Not started, in rough demo-relevance order

Master AI tier (2-turn lookahead) · the cross-school reactions as *reactions* rather than as
cards (§6.1) · **more encounters**, so the new shelves can actually be forged and not merely
drafted (§6.2) · arcane's shelf, which pads six of Lexis's eight slots (§6.2) · Frost and
Arcane Auras · flanking and facing · per-unit initiative.

---

## 2. Recommended build order

Phases are ordered so each one makes the demo *more convincing to a playtester* per unit
of effort, and so nothing is built on ground that later phases would dig up.

---

### ~~Phase A — Hardening & feel~~ ✅ DONE (2026-08-16)

Shipped: determinism replay harness + fuzz soak (`src/tests/replay.ts`,
`determinism.test.ts`), AI retreat scoring, enemy-turn animation budget, notice queue,
small-screen clamp. Suite is now **123 tests**. Two latent bugs surfaced and were fixed
along the way — see §"What Phase A turned up" below.


### What Phase A turned up

- **The AI had no incentive for chip damage.** Only kills, face damage and Mark setups
  scored — a hit that failed to kill was worth exactly zero, so the AI declined free
  swings and softened enemies only by accident. Added a `unitDamage` weight.
- **Greedy ordering wastes swings.** Because advancing outscores chip damage, a Novice
  unit often moves out of range before attacking. This is per-spec ("greedy, current turn
  only") and is left as-is — it is one of the concrete things 1-turn lookahead buys in
  Phase D, and worth calling out as a visible difference between tiers.
- The retreat term needed the *survival* framing, not the damage one: dodging 6 damage on
  a 2 HP unit is worth the unit's life, not 2 points. Priced at a fraction of `kill`.
- Test-budget note: the deeper Pirate101-style arenas make full playouts genuinely
  slower; several suites now carry explicit 30s timeouts. Runtime AI is unaffected
  (32–64ms median per turn, well inside the 1.2s thinking cap — see
  `docs/09_ai_and_encounters.md`).

---

### ~~Phase B — Frost mini-set + the reaction engine~~ ✅ DONE (2026-08-16)

Shipped: card registry split into per-school files; Chill→Freeze at 3 stacks and Brittle;
tile hazards with Steam Fog; the data-driven reaction matrix (Vaporize, Shatter,
Wildfire); 6 Frost cards; Boreas as a selectable Companion; fog rendering and reaction
feedback; a glossary-coverage test that fails the build when a card gains an unexplained
keyword. Suite is now **141 tests**.

**Design decision worth recording:** Shatter is exempt from the reaction armor gate.
Every other reaction needs the hit to reach health, as a Mark does — but requiring that
of Shatter would mean armor prevented the one reaction whose whole purpose is stripping
armor, making a heavily armoured frozen target unbreakable. It is a `requiresHpLoss` flag
on the reaction data, not a special case in the engine.

**Deferred at the time:** Superconduct, because it pairs Frost with Surge and no Surge
content existed yet; implementing it as frost-on-burning would have meant inventing a
reaction nothing described. Three faithful reactions beat four with one made up. *Surge
landed later and Superconduct ships now.*


---

### ~~Phase C — Deck builder + collection~~ ✅ DONE (2026-08-17)

Shipped: tier-derived copy limits tracked by base id, 12–30 deck size, Behemoth cap,
ownership checks; a two-column builder with cost curve, greyed-out capped cards and
specific validation errors; a starting collection plus win-a-card rewards; versioned
localStorage saves with migration, a backup copy, corruption recovery and soulbound
staples. Suite is now **169 tests**.

**Verified end to end in the browser:** built a custom 17-card deck, saved it, confirmed
the save recorded exactly 17 cards with 3 Scout Imps, fought with it and confirmed the
in-play deck matched card for card, then won and claimed a reward that persisted.

**One bug found and fixed:** `TitleScreen` built its content before assigning `this.el`,
so both the companion highlight and the deck summary looked themselves up through a null
reference and silently no-opped. Nothing threw — the screen just rendered empty.


---

### ~~Phase D — Adept AI + difficulty select~~ ✅ DONE (2026-08-17)

Shipped: an Adept tier with whole-turn lookahead, collision awareness and 5%
suboptimality; a latching simulation/wall-clock budget that degrades to greedy instead of
stalling; a difficulty picker persisted in the save. Suite is now **180 tests**.

**Two implementation mistakes worth recording, both caught by measurement rather than by
the tests passing:**

1. *The beam was selected by greedy score.* Lookahead only re-ranked the top N — but the
   actions lookahead exists to rescue are exactly the ones that score badly alone. A free
   attack worth 4 never entered a beam full of advances worth 9. Fixed by guaranteeing
   the best action of every command type a place in the beam.
2. *The objective double-counted.* Scoring an opener as `its utility + best sequel`
   rewards actions that leave *many* options rather than *good* ones, because that sequel
   gets taken next iteration anyway. Replaced with a short greedy rollout: value the whole
   turn an opener leads to. Only after this did strength actually move.

**On measurement:** win rate against the scripted player was saturated (~85%) and could
not detect improvement — the first three ablations all read as noise. Speed-to-win and
remaining HP were the sensitive metrics, and AI-vs-AI isolated tier quality from player-script
quality.


---

### Phase E — Overworld alleyway slice (~1–1.5 weeks, optional)

**Why last of the big items:** it is the connective tissue between fights, but it proves
*scope* rather than *fun* — combat already carries the demo. Build it when the combat loop
is worth wrapping.

**Tasks**
1. One hand-authored alleyway zone (same iso renderer, bigger grid, camera follow):
   sidewalk tiles (safe) vs. street tiles (danger) — the Sidewalk Immunity rule.
2. ✅ Roaming packs with vision cones and a chase; aggro off the pavement, never from it.
3. ✅ **Combat Circle**: on contact, expanding ring for 2.5s; any second mob touched joins
   as Wave 2 on round 2, player compensated +1 Bone and +1 draw. Two deviations from the
   edge cases below, both deliberate: a **third** mob is ignored rather than queued as its
   own encounter, and contact locks input immediately, so there is no fleeing a ring
   half-drawn — the circle is not a window to escape through, it is the road deciding how
   big the fight is.
4. Contact advantage: frontal = neutral; player rear-ambush = +1 bone, draw 6.
5. Transition: snapshot the overworld position, run the encounter, return with results
   (defeated duelists stay down for the session).

**Edge cases**
- Aggro during an already-triggering combat circle (three mobs): cap Wave 2 size, queue
  the third as a new encounter rather than a Wave 3.
- Player stands half on sidewalk / half on street: tile under the *anchor* decides.
- Fleeing: leaving the aggro radius before the circle completes cancels cleanly.
- Losing a Wave 2 fight then rematching: both mobs must respawn in consistent positions.
- Returning from combat onto a tile that combat's obstacles would occupy — restore from
  the snapshot, never re-derive.

**Done when:** walk out of a safe zone, get jumped by two duelists, win a Wave 2 fight,
and walk back — twice in a row without a reload.

---

### Phase F — Continuous: balance & playtest instrumentation (runs alongside B–E)

- Log per-game stats locally (turns, cards played by id, win/loss, HP margins) into the
  save file; add a hidden `/stats` dump so playtest feedback is data, not vibes.
- Rebalance triggers: any card played in <5% or >40% of turns it's held; average game
  length drifting outside 8–16 turns; Ignis bind-rate outside 20–50%.
- Keep the scripted-player harness from this session as `npm run simulate` for quick
  before/after balance checks.

---

## 3. Cross-cutting tech debt (pay during Phase B, not after)

1. **Split `cards.starter.ts`** into per-school files under `data/cards/` with a
   `data/cards/index.ts` registry — it's about to triple in size.
2. **Effect-primitive audit**: reactions need `applyStatus` areas, `spawnHazard`, and
   `chainColumn` ops. Add them as primitives, never as card-specific branches.
3. **Event contract additions** (`statusConsumed`, `reactionTriggered`, `hazardSpawned`,
   `hazardExpired`) — add with sequencer handlers *and* skip-mode support in one PR.
4. **Glossary/help as single source**: Phase B adds ~8 terms; the help overlay and
   tooltips already share `glossary.ts` — keep new rules text there only, and add a test
   that every keyword appearing on any card def has a glossary entry.

## 4. Known issues (small, tracked, not blocking)

- ~~**The shipped fights got easier, and the enemy boards have not caught up.**~~ **Landed**
  (2026-08-31), in exactly the shape this bullet sketched and wider. The four proving-ground
  fights and all five wager duels now field their arena's full `width + height`, in
  each fight's own school; the `rosterBudget` override exists and every deliberately-light
  fight — hunts, packs, bosses with waves, the Summons — declares its number through it; and
  `rosterLedger.test.ts` holds all 63 encounters to *fields exactly what it declares*, both
  directions, so an undeclared shortfall can never sit unnoticed again. The duels also got
  faces: eleven duelist figures landed on a fifth folk sheet, and the five wager duels stand
  their duelist at the site while the contract is live — the person is the interactable.
- **`magma_brute` is the only fieldable 2×2 in the game**, so the two-Behemoth kit cap is
  reachable only by holding two copies of it. Legal — the roster has always been a multiset —
  but a second Behemoth body would make the cap mean something. `deployment.test.ts` asserts
  the count so the fixture can switch to distinct ids the day one ships.
- Threat projection is deliberately optimistic (ignores friendly-unit traffic jams) —
  documented behavior, revisit only if playtesters call tiles "wrongly red".
- Enemy hand shows a count but no card-level tell. Deliberate; revisit if the enemy turn
  reads as arbitrary.
- Behemoth Growth caps at `GROWTH_CAP_BEHEMOTH` (99) rather than being unbounded, but there
  is no dedicated long-game test that a Behemoth actually reaches and stops at the cap.
- ~~Two companion traits describe mechanics the engine does not have and are marked `pending`
  in `src/core/data/companionTraits.ts`: `echo_chamber` and `death_rattle`.~~ **Landed**
  (2026-09-03): all nine pending knacks are wired — three as designed, six rewritten to a
  capability the engine can express in the same flavour. Nothing is `pending` any more.
- **The player sees two words for one mechanic.** The keyword is `Growth`, but the HUD still
  says "Escalation stacks" (`hud/glossary.ts`), "escalated ×N" (`hud/Hud.ts`) and "N
  escalation" (`hud/projection.ts`), and the stat fields are still `escalationBonus` /
  `escalationCap`. The field names are fine to leave — renaming them buys nothing — but the
  three player-facing strings and the second glossary entry are worth settling one way or
  the other. A vocabulary decision, not a bug.

## 5. Explicitly deferred (post-demo)

Wagering and a reclaim economy on the Bounty Board · Master AI (2-turn lookahead, chain
collisions) · save-scum protection (`pending_combat_state`) · per-unit Speed initiative
(the one Mewgenics idea consciously not adopted — revisit only if side-based turns feel
flat) · engine port (Godot/Unity) — the renderer-agnostic core was built for this, but not
before the design is proven in the browser.

---

## 6. The design backlog

Consolidated here in 2026-08-21, when the original root-level design modules were retired.
These are the parts of that material that had **not** been built and were still wanted; the
numbers have been restated at the current stat scale (the old documents were written before
the Stat Stretch and ran a factor of ten low). Everything else in those documents was either
shipped, superseded by `docs/`, or deliberately declined.

### 6.1 Cross-school reactions not yet built

Six reactions ship today — Vaporize, Shatter, Overload, Superconduct, Arc and Wildfire
(`src/core/data/reactions.ts`). The original matrix paired every school with every other.
These are the pairings still open **as reactions**.

> **Seven of them now ship as hybrid cards instead**, which is a different thing and worth
> being precise about. A reaction is a rule the engine applies whenever two elements meet; a
> card is a thing a player chooses to cast. Soulfire, Black Ice, Permafrost, Kinetic Arc,
> Bone Bastion, Iron Briar and Blight Siphon exist as pressings in `cards/hybrid.ts` — so
> the *effect* is reachable and the theme is spoken for, while the automatic interaction
> below is still unbuilt. Plasma Burst and Magma Surge were already in that position
> (`plasma_arc`, `magma_shove`); Bio-Pulse is half-covered by `galvanic_spores`. What is
> genuinely untouched is the engine work: making these fire off *any* qualifying hit rather
> than off one specific card.

| Pairing | Name | Trigger | Effect |
| :-- | :-- | :-- | :-- |
| Pyre + Surge | **Plasma Burst** | A Surge hit on a target carrying 3+ Burn | Consume 2 Burn to deal 40 bonus shock, arcing to the target's whole row |
| Pyre + Bulwark | **Magma Surge** | A shove drives an enemy onto a burning tile | Collision damage, then double the enemy's remaining Burn stacks |
| Pyre + Dusk | **Soulfire** | A friendly unit carrying Burn is tithed | Detonates around it for fire damage equal to the health the tithe took |
| Frost + Dusk | **Black Ice** | A Frozen enemy dies | The tile keeps a lasting chill; the next enemy to enter it freezes |
| Frost + Bloom | **Permafrost** | Toxin applied to a Chilled or Frozen target | Entangles it, and Toxin stops decaying while the chill holds |
| Surge + Bulwark | **Kinetic Arc** | A Charged enemy is shoved into a wall or a body | The impact releases a shock blast to everything within one tile |
| Surge + Bloom | **Bio-Pulse** | Toxin ticks on a target carrying an Arc Mark | The tick discharges shock to adjacent enemies without spending the Mark |
| Bulwark + Dusk | **Bone Bastion** | A unit wearing Persistent Armor is tithed | Its armor converts into permanent Max HP on the body that took the tithe |
| Bulwark + Bloom | **Iron Briar** | A Bulwark card is cast onto a tile holding brambles | The brambles fortify into a real obstacle and reflect damage to attackers |
| Dusk + Bloom | **Blight Siphon** | A Dusk strike on a target carrying 3+ Toxin | Drains health through armor and spreads it as healing across your units |

One further pairing, **Volatile Spark** (Surge + Dusk), was deliberately *declined* as a
reaction — its payout ships instead as a card effect, and the reasoning is recorded in
`src/core/data/cards/hybrid.ts`. It is not pending work.

Two structural notes carried over: a reaction fired from inside a Mark cascade must resolve
in the same worklist without reentrancy, and a reaction that would kill a Pact mid-chain
has to respect the boss damage gate's `chainCancelled`. Both are already true of the six
shipped reactions and are the pattern any new one should follow.

### 6.2 Card backlog — **closed**

The original catalog specified roughly 136 cards. **173 ship**, at least twenty per elemental
school, all fifteen dual-school pairings have a pressing, and **every school's draftable shelf
now clears the target**. The specific card names in the retired catalog were not preserved and
were not worth preserving — they were written against different resources, a different scale
and a card taxonomy that no longer exists.

`pools.ts` states the target — `CATALOG_TARGET` of 10–15 spells per school — and
`catalogGaps()` reports against it. Dusk was the last school short, at seven, because nine of
its twenty cards are Bound Forms and authored threats rather than anything a Grimoire can draw.
Three cards closed it, and the interesting part was *why* they had not been written:

> **Dusk was the only school with no status of its own.** Pyre has Burn, Frost Chill, Surge
> Charged, Bloom Toxin, Bulwark armour and Stun. Dusk's payload is Marrow — a resource, not a
> status — and `obstacleTurnStart` is typed `{ status, stacks }` with nowhere to put a
> resource. So Dusk could not have a construct at all, and it had no area card either. The
> decay shelf gives it `brittle` as a second pillar: a Charnel Pillar that ticks it onto the
> row, a Wither that cashes it, and a Creeping Decay that spreads it.

The gap report's tripwire in `catalog.test.ts` has been retired, as its own comment instructed.
`catalogGaps()` itself stays — it is what will answer "is a new school ready to ship".

**Still short, and newly visible: arcane.** Lexis has **two** draftable cards and pads six of
its eight Grimoire slots from the neutral fallback — far worse than Mortis ever was, and
invisible to every report because arcane is excluded from `SCHOOLS` by design (it is the Hero's
colour, not a discipline anybody enrols in). Whether that wants fixing is a design question
about what a Lexis run is *for*, not a counting exercise.

The other remaining gap is not cards, it is **encounters**. Twenty-nine of the new spells and
Constructs are in no enemy deck, so they can be drafted onto a beast but not yet forged —
`UNREACHABLE` in `src/tests/schematics.test.ts` is the honest ledger of that, and it shrinks
by writing fights rather than cards.

### 6.3 Sandbox ideas not yet designed into `docs/03`

- **Mastery objectives.** Optional combat sub-objectives that raise the taming roll —
  winning without taking Pact damage, tithing three or more of your own, finishing by
  Mark cascade. The taming roll exists (`docs/03_rpg_sandbox.md`); nothing yet lets play
  quality feed it.
- **Reagent harvesting with variance.** Harvesting a hazard as a reagent, where the node
  rolls on what it yields and can bite back. `docs/03` notes only that Overworld reagent
  harvesting does not exist.
- **School academies.** A curriculum-and-mastery-trial route to new cards, parallel to the
  Forge rather than replacing it.
