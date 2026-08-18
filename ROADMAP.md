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
| **Economy** | Channel (`C`), reaction Pip refunds capped at 2/turn, Spark Geodes on neutral ground |
| **Ranged archetypes** | Sniper (lines only), Lobber (ignores sight, blind up close), Turret (immobile) |
| **Terrain** | Rubble costing double, volatile crystals hitting friend and foe, conveyor currents at the round boundary |
| **Wildlife** | `Feral` units nobody commands; a scavenger that flees and escapes, wolves that maul both sides |
| **Weather** | Fog clamping all vision to 3, a directional gale, rain blunting fire |

Three latent bugs surfaced: the AI hoarded Sparks that expire (Channel's gate must require
the Spark to *complete a purchase*); `canMove` ignored MOV so an immobile unit never read
as spent; and the first draft of the boss phase re-announced itself when the drake was
boxed in (growth is now tracked apart from the phase).

**Deliberately not done, and why:**
- **Arc, the rain reaction.** No Surge damage type and no Surge card exist, so the branch
  could not be reached or tested. The reaction table records the shape it takes when
  Surge lands — a `requiresWeather` field beside `requires`.
- **§2.4 pip income fail-safe.** Held as the doc asks. It is one token: `turn.ts`'s
  `gainPips(ctx, side, 1)` is the only income in the game, and the line says so.
- **AI kiting.** Retreats stay pruned from enumeration for everything except a Bound Form,
  so the new archetypes are used as static shooters rather than kited. Acceptable; noted
  beside the pruning.
- **`magma_brute` Resonance.** Still a Pyre summon marked `source: 'hero'`, so it never
  triggers Resonance. Moving it is a buff, not a fix — a balance decision.

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
| **Bound Form** | The Companion is a unit on the board. All damage to it — strike, spell, burn tick, wall collision — is dealt to the Pact; it cannot be sacrificed, runed, or Escalated. Sudden death restores it. HUD counts blows on it as incoming Pact damage |
| **Origin casting** | Hero cards reach the whole board; Companion cards are cast from the Companion's tile with range and line of sight. A side with no body still casts globally, which is what keeps the enemy AI's deck intact |
| **Pre-combat** | An overhead plan of the arena before the fight, with up to five card swaps; **Ready** fixes the deck and generates a recorded seed, so Rematch is the same battle |

Two pre-existing bugs fell out of this work: the threat map flagged *every* ranged enemy
as a Commander threat regardless of sightlines (the check asked only whether the unit was
on the board), and the raw `sacrifice` command validated neither protection nor whether
the offering was worth any Sparks.

**Opened, not closed, by the pivot:**

- **Enemy Bound Forms.** Enemy Commanders stay off-grid. Giving a boss a body needs an
  `EncounterDef` field and a decision about its Resonance lane; the seam is commented.
- **Resonance follows the static lane**, not the Companion's live column. Recomputing it
  at trigger time is a one-line change and a real balance shift — deliberately not taken.
- **`magma_brute`** is a Pyre summon marked `source: 'hero'`, so it never triggers
  Resonance. Moving it is thematically right and a buff; left as a balance decision.
- **`hud/projection.ts` hardcodes the Escalation cap** rather than reading
  `escalationCap` — harmless today, wrong the day a card changes a cap.
- **Arena variety.** The engine now supports 4×4 through 12×12, but both shipped
  encounters are still 6×8 and 8×8. Nothing exercises the new shapes in play.

---

## 1. Where the project stands

### Done and verified (107 tests, clean build, playable at localhost:5173)

| System | State |
| :-- | :-- |
| Rules engine | Complete for the Draft 7 set: pips/sparks, overdraw burn, free reshuffle, Retain, movement (BFS, 2×2 footprints), **independent move + attack per turn**, collisions 3/2 with Mass Invariance, supercover LoS, Guardian occlusion, runes/cascades/armor-gating/fizzle, Escalation caps, status ticks in Module 1 order, Last Stand double-KO |
| Cards | 15-card Draft 7 starter deck + Vanguard Footman, all data-driven through ~12 effect primitives |
| Encounters | Novice Duelist (6×8 lane, terrain), Ignis Trial (8×8 arena, 50% damage-gate with chain nullification, Rite of Binding at 25%, Forced Eviction) |
| AI | Novice tier: greedy utility scoring per Module 5 weights, Lethal Veto, deterministic tie-breaks, seeded 20% suboptimality; 32–64ms/turn |
| Companion | Resonance passives (Pyre live; Frost/Dusk written but unused), Companion lane, commanders rendered as board models |
| Terrain | Rubble walls (block move+sight) and bramble cover (blocks sight only), per-encounter maps |
| Onboarding | 6-step first-run tutorial, glossary tooltips on everything, H rules reference, T danger-zone overlay (Fire Emblem-style edge outline), contextual refusal messages, spent-unit dimming |
| Presentation | Canvas iso board + DOM HUD, animation sequencer over typed event FIFO, trajectory ghosting, Shift expand-prediction, WebAudio cues |

### Partial — exists but stubbed or shallow

| Item | Gap |
| :-- | :-- |
| **Chill status** | Stacks and decays but has no effect. Module 1: Freeze at 3 stacks, Brittle (+2 damage taken). Blocker for any Frost content. |
| **AI vs. new action economy** | The AI *can* attack-then-move (it re-enumerates each step) but nothing scores a retreat, so it never deliberately hits and runs. The player has a tool the AI ignores. |
| **Frost/Dusk Resonance** | Implemented in `resonance.ts`, unreachable — no companion selection exists. |
| **Hazard tiles** | Engine has a hazard slot in the status tick order; nothing creates or renders hazards. |
| **Camera rotation** | `rotationStep` seam exists, fixed at 0. Fine to leave. |
| **Determinism harness** | The original plan called for a replay-from-seed CI invariant and a fuzz soak test. Never built. The engine is designed for it (seeded PRNG, pure reducer) — it's cheap insurance that gets more valuable with every feature added. |

### Not started (from the GDD, in rough demo-relevance order)

Deck builder · companion selection · cross-school reactions (Module 1's 15-entry matrix) · more cards (Modules 1–2 spec ~136) · Adept/Master AI tiers · overworld slice (sidewalk immunity, aggro, combat circle) · economy/ascension/renown/ante · save system · flanking/facing.

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

<details>
<summary>Original Phase A plan (kept for reference)</summary>

### Phase A — Hardening & feel (do first; ~2–3 days)

**Why first:** every later phase adds rules. The safety net has to exist before the
rule-count doubles, and small feel problems compound with every feature that inherits them.

**Tasks**
1. **Determinism replay harness**: record `(seed, command log)` in every test teardown,
   replay, assert identical event stream + final state hash. Add a fuzz soak test:
   random legal commands for N turns × 50 seeds — no throws, no negative HP, no
   orphaned entities, pips ≤ 8 after cleanup.
2. **Teach the AI to retreat**: score `moveUnit` away from danger for units that have
   already attacked (bonus scaled by threat map damage on current vs. destination tile).
   One new scoring term, no new architecture.
3. **Feel pass on the enemy turn**: cap total enemy-turn animation time (~6s budget,
   auto-compressing delays when the AI takes many actions), so big turns don't drag.
4. **Small-screen guard**: below ~700px canvas width, clamp zoom and warn; tutorial
   bubbles already clamp but anchors can sit under the hand — verify each step at 1024×640.
5. **Notice queue**: notices currently overwrite each other and linger; make them a
   small queue with consistent fade so refusal messages never get eaten.

**Edge cases to cover**
- Replay across a Last Stand board wipe and a boss phase transition (both mutate state
  outside normal action flow).
- Fuzz discovering summon-with-no-space and empty-deck-empty-discard together.
- AI retreat scoring must not cause oscillation (move out, move back next turn, repeat) —
  cap the retreat bonus below the face-damage term so aggression still dominates.
- localStorage unavailable (private browsing): tutorial and mute settings already
  try/catch; fuzz the same for anything Phase C adds.

**Done when:** CI runs replay + fuzz green across 50 seeds; enemy turns never exceed the
animation budget; AI demonstrably retreats a wounded archer in a scripted test.

</details>

### What Phase A turned up

- **The AI had no incentive for chip damage.** Only kills, face damage and rune setups
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
  (32–64ms median per turn, well inside Module 5's 1.2s cap).

---

### ~~Phase B — Frost mini-set + the reaction engine~~ ✅ DONE (2026-08-16)

Shipped: card registry split into per-school files; Chill→Freeze at 3 stacks and Brittle;
tile hazards with Steam Fog; the data-driven reaction matrix (Vaporize, Shatter,
Wildfire); 6 Frost cards; Boreas as a selectable Companion; fog rendering and reaction
feedback; a glossary-coverage test that fails the build when a card gains an unexplained
keyword. Suite is now **141 tests**.

**Design decision worth recording:** Shatter is exempt from the reaction armor gate.
Every other reaction needs the hit to reach health, as a rune does — but requiring that
of Shatter would mean armor prevented the one reaction whose whole purpose is stripping
armor, making a heavily armoured frozen target unbreakable. It is a `requiresHpLoss` flag
on the reaction data, not a special case in the engine.

**Deferred:** Superconduct. Module 1 pairs it with Surge, and there is no Surge content
yet; implementing it as frost-on-burning would have meant inventing a reaction the docs
do not describe. Three faithful reactions beat four with one made up.

<details>
<summary>Original Phase B plan (kept for reference)</summary>

### Phase B — Frost mini-set + the reaction engine (~1 week)

**Why:** cross-school reactions are the design's most distinctive asset, and they are
the demo's missing "wow". One new school is the smallest slice that proves the system.

**Tasks**
1. **Finish Frost statuses**: Chill freezes at 3 stacks (consume stacks → Freeze 1);
   **Brittle** (+2 damage taken, 2 turns). Both tick/decay in the Module 1 order.
2. **Reaction engine**: a data-driven matrix keyed by `(incoming damage school, status
   present on target)` evaluated inside `dealDamage` — same choke-point pattern as rune
   triggers, so no card can bypass it. Ship 4 reactions:
   - **Vaporize** (fire on Chilled): consume Chill, spawn **Steam Fog** hazard (2 turns,
     blocks ranged LoS through the tile — reuses the cover occlusion path).
   - **Shatter** (physical/impact on Frozen): break Freeze, strip 100% armor, 4 to adjacent.
   - **Superconduct** (frost on Burning or fire on Chilled variant per Module 1): +3 and
     chain down the column.
   - **Wildfire** (fire on Toxined): consume Toxin stacks → AoE 2× stacks. (Uses existing
     Toxin; makes Dusk/Bloom future content slot in free.)
3. **~6 Frost cards** from Module 1's blueprint (Frost Nova, Glacial Spike, Ice Barricade
   as a wall-type obstacle, Frost Rune, one Frost minion with Guardian, one Chill spell).
4. **Steam Fog + hazard rendering**: first real tile hazard; render as a soft animated
   patch, add to threat/LoS calculations and the tick order slot that already exists.
5. **Companion selection screen** (minimal): pick Ignis (Pyre) or **Boreas** (Frost) before
   an encounter. Boreas swaps the Resonance (already written), tints the Companion model,
   and gates nothing else — Frost cards go into the shared deck for now.

**Edge cases**
- **Reaction vs. armor gate**: Module 1 rules runes need ≥1 HP loss — decide and test
  whether reactions trigger on fully-absorbed hits (recommend: statuses apply, reactions
  require HP loss, consistent with runes).
- **Reaction from a rune detonation** (fire rune detonates onto a Chilled unit → Vaporize
  inside a cascade): must resolve in the same worklist without reentrancy bugs; cap chain
  depth and test a Vaporize→Shatter→rune chain.
- **Freeze vs. Escalation**: frozen units still escalate (Draft 7) — already true, add a
  reaction-era regression test.
- **Fog on cover / fog on a wall tile**: occlusion sources must union, not conflict.
- **Frozen unit shoved into a wall**: Shatter triggers off impact? (Recommend yes — it's
  the fun answer and Module 1's Frost/Bulwark entry says so.) Test the double-dip damage.
- **Reaction killing the Commander mid-chain** during a boss damage-gate: gate clamps and
  nullifies the rest — reactions must respect `chainCancelled`.
- Threat overlay with fog: fog blocks enemy ranged threat — the danger zone must recompute.

**Done when:** a Boreas run can Chill → Vaporize → fog a lane, and a Frozen enemy shoved
into a wall Shatters, all animated in sequence, with table-driven tests over the matrix.

</details>

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

<details>
<summary>Original Phase C plan (kept for reference)</summary>

### Phase C — Deck builder + collection (~1 week)

**Why:** it's a *deck builder* — the demo currently never lets you touch the deck. This
is also where playtesters start expressing skill.

**Tasks**
1. **Collection model**: player owns starter 15 + Vanguard + the Frost set; win rewards
   grant 1–2 card picks from a small pool (the first real meta-loop hook).
2. **Deck rules from the docs**: 12–30 cards; duplicate caps **T1=3, T2=2, T3=1** tracked
   by base card id; **max 2 Behemoths per deck**; Power Tier floor (cost never below 1).
3. **Builder screen**: list + deck panel, school/color coding, capped duplicates grey out,
   cost-curve bar, validate-on-confirm with specific errors ("13 cards — minimum is 12").
4. **Persistence**: localStorage save `{version, collection, decks, tutorialSeen, results}`
   with a version number and a migration function from day one (Module 8's rule).

**Edge cases**
- Deck invalidated by data changes (a card's def removed/renamed): flag deck invalid on
  load, force edit, never crash (Module 8's binder-validation rule).
- Duplicate cap across future ranks (Ascension): track by base id now so Rank 2 doesn't
  double the cap later.
- Deleting the active deck / editing mid-run: lock the deck once an encounter starts.
- Sub-minimum collection (impossible now, possible after future "wager" mechanics): the
  soulbound starter 15 can never be removed — enforce in the model, not the UI.
- localStorage full or corrupted JSON: fall back to defaults, keep a `.bak` copy of the
  last good save before every write.
- Tutorial interaction: a brand-new player must be routed into a playable default deck
  without seeing the builder first.

**Done when:** you can win cards, build a legal 12–30 deck mixing Pyre/Frost, get precise
errors for every illegal deck, and it all survives a reload and a simulated corrupt save.

</details>

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

<details>
<summary>Original Phase D plan (kept for reference)</summary>

### Phase D — Adept AI + difficulty select (~3–4 days)

**Why:** Novice is beatable 8/10 by a naive scripted player. Anyone who likes the demo
will exhaust it in an evening without a second difficulty.

**Tasks**
1. **Adept profile** per Module 5: 1-turn lookahead (simulate the player's best single
   reply with a cheap version of its own scorer), 5% suboptimality, collision-aware
   (`w_pos` collision term on), deliberately pushes into walls, uses Shatter setups once
   Phase B lands.
2. **Compute budget**: hard 150-iteration / 1.2s cap from Module 5 with a graceful
   fall-back to greedy when exceeded; assert in tests on the 8×8 board.
3. **Difficulty picker** on the encounter cards; persist choice.

**Edge cases**
- Lookahead must clone through encounter script hooks (damage gates) without firing
  side effects twice — preview-style clone/discard, same as `previewAction`.
- Determinism: lookahead uses the same seeded RNG stream — replay harness (Phase A) must
  stay green with Adept enabled.
- Lethal Veto inside lookahead: don't veto a line just because the *player's reply* could
  be lethal — that's Master-tier caution, not Adept.
- Time cap on low-end machines: budget by iteration count, not wall clock alone.

**Done when:** Adept beats the Phase A scripted player ≥6/10 where Novice loses 8/10,
within budget, fully deterministic under seed.

</details>

---

### Phase E — Overworld alleyway slice (GDD demo Phase 3; ~1–1.5 weeks, optional)

**Why last of the big items:** it's the GDD's connective tissue, but it proves *scope*
rather than *fun* — combat already carries the demo. Build it when the combat loop is
worth wrapping.

**Tasks**
1. One hand-authored alleyway zone (same iso renderer, bigger grid, camera follow):
   sidewalk tiles (safe) vs. street tiles (danger) — the Sidewalk Immunity rule.
2. 2–3 roaming duelists with vision cones; aggro on street, never from sidewalk.
3. **Combat Circle**: on contact, expanding ring for 2.5s; any second mob touched joins
   as Wave 2 on round 2, player compensated +1 pip +1 draw (Module 3).
4. Contact advantage: frontal = neutral; player rear-ambush = +1 pip, draw 6.
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

- Tiny embedded-preview canvases (~350px) render at zoom 0.31 — unreadable but functional;
  Phase A adds the clamp/warning.
- Threat projection is deliberately optimistic (ignores friendly-unit traffic jams) —
  documented behavior, revisit only if playtesters call tiles "wrongly red".
- Enemy hand is fully hidden (no count-based tell); consider showing enemy hand count.
- `escalation` HP cap test asserts max-HP consistency but Behemoth uncapped growth has no
  dedicated long-game test — add one in Phase A's fuzz pass.

## 5. Explicitly deferred (post-demo)

Renown/ante wagering and the Black Market reclaim economy · Ascension crafting ·
full 7-school card catalog · Master AI (2-turn lookahead, chain collisions) ·
save-scum protection (`pending_combat_state`) · per-unit Speed initiative (the one
Mewgenics idea consciously not adopted — revisit only if side-based turns feel flat
after Phase B) · engine port (Godot/Unity) — the renderer-agnostic core was built for
this, but not before the design is proven in the browser.
