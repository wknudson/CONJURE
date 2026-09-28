# CONJURE — Pre-Alpha Readiness Report

*Audit date: 2026-09-01. Scope: `src/core/engine`, state schemas, AI, animation/HUD layers,
data registries, save system, overworld, and content registries. Every claim carries
file:line evidence; the three highest-severity findings were re-verified line-by-line
against source before this report was written. No code was changed by this audit.*

*Updated 2026-09-03: every finding below through the High tier was fixed and merged as
PR #20. A second audit the same week looked at the layer this one did not — the operational
shell around the game and the first-time player's path through it — and its findings were
fixed and merged as PRs #21, #22 and #23. That audit and those fixes are recorded in §6; the
Medium bullets in §5 are annotated where a later PR closed them. The three design calls the
audits had left open were then ruled and built as PRs #25, #26 and #27, the nine pending
companion knacks as PR #29, the blood-tithe telegraph as PR #31, the sequencer-driven Last
Stand as PR #33, the three generic reactions as PR #35, and the opening hour as PR #36 —
recorded in §7. Nothing either audit raised remains open. Outside the audits' scope, the female
side-walk was fixed as PR #37 and the world itself rebuilt as PR #39 — every area larger,
thirty-nine rooms behind real doors, four registries of things to do on the ground — recorded in
§7.9 and §7.10; that note was PR #40. The bestiary and grimoire expansion then began with its
machinery as PR #41 — signature cards, rare hunts, and a pipeline for creature art — recorded in
§7.11; that note was PR #42. Its second wave, the Hero kit and a duelist at every tier, merged
as PR #43 and is recorded in §7.12; that note was PR #44. The expansion's Wave 2, deeper shelves and signature cards for Pyre, Frost and Surge, merged as PR #45 and is recorded in §7.13; that note was PR #46. The expansion's Wave 3, the same shelves and signatures for Bulwark, Dusk and Bloom, merged as PR #48 and is recorded in §7.14; that note was PR #49. A motion pass over both boards and the streets, including two fixes for flinches that were computed and never drawn, merged as PR #47 and is recorded in §7.15; that note was PR #50. The expansion's Wave 4, thirty-six new bodies for the Vanguard, merged as PR #51 and is recorded in §7.16; that note was PR #52. Its Wave 5, the third and fourth bloodlines of Pyre, Frost and Surge, merged as PR #53 and is recorded in §7.17; that note was PR #54. Its Wave 6, the same for Bulwark, Dusk and Bloom, merged as PR #64 and is recorded in §7.18; this note is PR #65.*

*Updated 2026-09-04: a rendering bug outside either audit's scope — the female Commander's
side-walk pulsing at a fixed height, found and fixed on request rather than by an audit pass
— was merged as PR #37, recorded in §7.9 for the same continuity the audits' own fixes are.*

**Bottom line:** the core loop — create a character, take a contract, fight, win or lose,
get rescued or paid, and go again — is intact, well-tested, and completable. The death
penalty, the 3-slot save system, the Harpoon Protocol, and the E5 presentation hooks all
work as designed. What the audit found instead is **one reachable soft-lock in the game's
signature boss fight, one input-latch that can kill all overworld encounters for a
session, a scoring hole that silently cuts the entire enemy Aura system, and a telegraph
that goes blind for most declared card plays** — plus a tail of smaller gaps ranked in §5.

---

## Terminology map — the brief vs. the codebase

Several terms in the audit brief do not exist under those names. Real names first, because
the rest of the report uses them:

| Brief said | Codebase reality |
| :-- | :-- |
| "Intent System (E1)" | `src/core/engine/intents.ts` (`declareIntents`, `GameState.intents`/`declaredPlan`, event `intentDeclared`). E1 shipped 2026-08-17 per `COMBAT_FEEL.md`. |
| "Adept and Novice" | Correct — `NOVICE_AI` / `ADEPT_AI`, `src/core/ai/controller.ts:70,85`. Only two tiers exist. |
| "E5 Juice hooks" | Not a module; implemented across `src/anim/handlers.ts`, `src/render/Fx.ts`, `src/hud/Hud.ts`, `src/sound/Sfx.ts`. |
| "Ducats" | Correct — `overworld.economy.ducats` (`src/core/overworld/state.ts:146`). Second currency: `marrowShards`. |
| "Pact hits 0 → deduct 20%, HP to 1" | Implemented as `rescuePlayer` (`state.ts:346-377`): 20% fee, HP set to **10** — which *is* 1 pre-Stretch point (`STAT_SCALE = 10`, `src/core/scale.ts:29`). |
| "3-Slot Title Screen" | Correct — `PROFILE_SLOTS = 3` (`src/app/save.ts:129`), `src/app/TitleScreen.ts`. |
| "Tall Grass Danger Zone" | Two systems: Sidewalk Immunity (`safety: 'sidewalk'`, 2 of 19 areas) and roaming `Pack` entities with vision cones (`src/core/data/packs.ts`, 9 packs). |
| "Safehouse" | The hub is the `DistrictScreen` street; `DEFAULT_AREA = ASHFALL` (`src/district/areas/index.ts:63`). |
| "Harpoon Protocol" | Correct — the module's own title (`src/core/engine/subjugation.ts:2`). |
| "Aetheric Tether" | **Does not name the tether.** `aetheric_tether` is an unrelated displacement card (`docs/08_card_catalog.md:319`). The tethered unit is the **Anchor**; the sealed state is **Aether-Plated**; the win result is `'bound'`. |
| "Subjugation Meter" | Correct — `Hud.setSubjugation()`, a 3-pip winch gauge (`src/hud/Hud.ts:194-227`). |
| "minimum 8-card pools" / "rarity" | The real constants are `GRIMOIRE_SIZE = 8` and `CATALOG_TARGET = {min:10,max:15}` (`src/core/data/pools.ts:87`). **No rarity axis exists** — no `CardDef.rarity` field; the copy-cap axis is derived `CardTier` 1/2/3 (`deckRules.ts:64-82`). Any criterion phrased "per rarity" cannot be measured. |
| "Reagents" / "Blueprint Schematics" | `REAGENTS` = 6 Cores, one per school (`splicing.ts:29-70`). A `Schematic` is derived from a fight's `enemyDeck` (`schematics.ts:60-70`) — there is no authored blueprint pool. |

---

## 1. Combat & Grid Mechanics

### 1.1 Data registries vs. reducer execution

**Reactions — OK, with one geometry bug.** All 6 reactions (`vaporize`, `shatter`,
`overload`, `superconduct`, `arc`, `wildfire`; `src/core/data/reactions.ts:92-183`) have
full execution paths in `src/core/engine/reactions.ts:110-266`, dispatched from the
`dealDamage` choke point (`damage.ts:247,331`). But:

- **GAP — reaction AoE is geometrically wrong against/from 2×2 Behemoths.**
  `adjacentTiles()` (`engine/reactions.ts:390-402`) expands the 8 neighbours of the
  **anchor cell only**. For a 2×2 host it misses tiles adjacent to the other three cells
  and its ring cuts through the host's own footprint. `blastTiles()` in
  `engine/marks.ts:187-218` does this correctly via `cellsOf(host)` — the fix is to
  match it. Affects Shatter splash, Overload shove, Wildfire AoE, and Arc conduction.
- Dead data/branches (hygiene): `ReactionDef.bonusDamage` set by nothing
  (`reactions.ts:44`), `op: 'none'` used by nothing, `BlastPattern shape:'self'` provably
  inert (`marks.ts:189,241`).
- Doc drift: `docs/02_combat_lexicon.md:691` still says no encounter ships rain, so Arc is
  unreachable. **Three encounters ship rain now** (`chalk.road.toll.ts:57`,
  `campaign.novice.ts:143`, `hunts.ts:445`); the `KNOWN_UNREACHABLE` test ledger is
  already empty and correct.

**Statuses — OK.** All 12 `StatusKind` values have both an application path and a
read/tick path; every `status:` literal in card data resolves to a handled kind.

**Marks — OK.** All 7 marks attachable and resolved; both trigger kinds work. One stale
comment: `marks.ts:80` claims `cask_blast` is unattachable — `cards/arcane.ts:196`
attaches it.

**GAP — 5 of 7 Aura Climax traits do not exist, and the card text promises them.**
`climaxTraitOf` (`engine/growth.ts:147`) has exactly two consumers: `overload`
(`movement.ts:43`) and `heavyFootprint` (`movement.ts:45`, `displacement.ts:64`).
`conflagration`, `overgrowth`, `hollow`, `rimeShell`, and `blink` have **zero engine
references** — while `cards/auras.ts:36,49,75,103,116` sell them to the player ("At
Climax it burns what it strikes", "it steps to anywhere it sees"). Five of seven Auras
have a third stack that does nothing but unlock a Detonation target. The engine's own
comment concedes this (`growth.ts:144-146`), but nothing player-facing does. Either
implement, rewrite the card text, or fence them the way `companionTraits.ts` fences its
`pending:` knacks — that ledger (9 pending traits at the time, correctly excluded from the
roll table; all nine built in #29, see §7.4) is the model this should have followed.

**GAP — two keywords have no engine code.** `Dormant` (documented at
`docs/02_combat_lexicon.md:309`, glossary `src/hud/glossary.ts:22`, carried by
`cards/dusk.ts:119`) is a no-op label that coincides with the default summon-turn rule.
`Impact` ("triggers on landing, cannot act that turn", `docs/02:310`) is carried only by
`magma_brute`, whose cleave is hand-wired as a `seq` — any future card carrying `Impact`
gets nothing. `PowerTier` is combat-inert (copy-limit only) while the glossary sells it as
a mechanic (`glossary.ts:68`).

**GAP — `ignoreIceSlip` is a purchasable rule that is not in the game.** Granted by three
Companion traits (`companionTraits.ts:73,121,518`) and one relic (`relics.ts:399`),
threaded all the way to `commander.ignoresIceSlip` (`overworld/run.ts:195` →
`setup.ts:588`), surfaced in the deck builder ("Keeps its footing on ice",
`DeckBuilderScreen.ts:88`) — and read by **nothing**. There is no ice hazard
(`HazardKind` = `steam_fog | rubble | current | burning`, `types/state.ts:261-276`).
A playtester can equip a relic slot for a no-op.

**GAP — four player-facing numbers are stale by the 10× Stat Stretch.**
`glossary.ts:191` (collision "3/2" vs engine 30/20), `glossary.ts:117` and
`HelpOverlay.ts:68` (Brittle "+2" vs +20), `glossary.ts:113` (Vaporize "2" vs 20).
`glossary.test.ts:48` only asserts entries exist, not that their numbers are current.

**Hygiene:** `DamageCause` is documented as "the renderer picks animations from this"
(`contract/ids.ts:46`) and no presentation code reads it — a collision, a counter, and a
spell all animate identically.

### 1.2 The Intent System (E1)

The core telegraph is real and honest: attacks and channels are declared at both tiers,
blows land on the *tile* not the target, the enemy never re-plans, and the Growth
trust-gap fix from `COMBAT_FEEL.md` is in. Novice declares moves and cards; Adept declares
blows only — by design. But the forecast does **not** correctly telegraph everything:

- **GAP (blocker-class) — declared card plays are invisible for all non-tile targets.**
  `intents.ts:107-113` only writes `at` when the target is `kind:'tile'`, which per
  `targeting.ts:153-272` means only `emptyTile` specs. Everything else (mark attach, aura
  cast, single-target/adjacent/line/global spells) produces an `intentDeclared` event that
  the renderer then drops twice: `BoardRenderer.ts:652` (`if (!intent.at) continue`) and
  `:729-731` (the synthetic `card:<id>` unitId misses the badge lookup). At **Novice —
  the total-clarity teaching tier — a declared Cataclysmic Core draws nothing at all**,
  and there is no itemised threat panel to catch it (the E3 leftover, `COMBAT_FEEL.md:189`).
- **GAP — the Adept's second action pass is broader than documented.**
  `session.ts:632-645` re-runs `planTurn` after declared blows and executes **every**
  command it returns, not just cards (`docs/09_ai_and_encounters.md:481` claims cards
  only). A unit that only moved in the declared plan still has its swing; anything that
  arrived mid-turn is fresh. `intents.test.ts:111-112` only asserts `kind !== 'card'`.
- **GAP — wave-2 reinforcements arrive with de-facto Haste.** `wave.ts:114` reuses
  `placeOpeningUnit`, which clears `summonedThisTurn`/`freshlySummoned`
  (`spawn.ts:119-120`) — correct pre-game, wrong mid-fight. Combined with the above, at
  Adept a Combat-Ring wave body can attack the turn it lands, untelegraphed.
- **GAP — `bloodTithe` is never telegraphed at any tier** (falls into `default: break`,
  `intents.ts:117`). Self-inflicted, but it exhausts a body and silently changes the
  danger zone.
- **GAP — the "Incoming: N" forecast is 10× wrong on Growth.** `hud/projection.ts:42`
  hardcodes `ESCALATION_STEP = 1`; the engine adds `escalationBonus.atk`, which is 10 for
  growing bodies and 0 for many `Growth` carriers. The readout under-reports a real growth
  by 10 and over-reports zero-growth bodies by 1 — and `projection.test.ts:94` **asserts
  the wrong value**, so it will fail when fixed. (`projection.ts:105` has the sibling
  stacks-vs-`STAT_SCALE*stacks` bug, currently latent.)
- **GAP — the danger zone under-warns**, against its own stated doctrine
  (`threat.ts:32-33`): uses base `mov` not `movementRange()` so Fleet-buffed enemies
  out-range the overlay (`threat.ts:42`); skips only `freeze`/`stun` while `canAct` also
  refuses `anchor`/`exhaust` (`threat.ts:104` vs `movement.ts:201-213`).
- PARTIAL — `Intent.path` is computed, typed into `BoardView`, projected in views… and
  never drawn (`BoardRenderer.ts:673` draws from the unit's current tile). The
  "arrow starts where the unit will be standing" promise in `intents.ts:49` does not exist
  on screen. Also, move/channel intents are painted with the hostile red-dash attack
  treatment (`BoardRenderer.ts:658-668`) — "walking here" reads as "striking here".
- By construction, `declareIntents` sees only AI commands. Feral bites, script summons,
  conveyor currents, status ticks, and aura upkeep are all untelegraphed; feral is at
  least covered by the threat map (`threat.ts:99`), the rest by nothing. Acceptable if
  documented as such, but worth a deliberate decision before Alpha.

**GAP (blocker-class) — the AI can never play 10 cards that ship in enemy decks.**
`scoreAction` has no weight for `statusApplied`, `auraAttached/Stacked/Climaxed`, or
`hazardSpawned` (see `UtilityWeights`, `score.ts:26-112`). A card whose whole effect is
one of those and costs 0 marrow scores exactly 0, and `controller.ts:202` drops anything
`<= passThreshold` (0 on both tiers). Verified against every `enemyDeck`: all six enemy
Auras (`ember_coat`, `verdant_swell`, `static_charge`, `petrifying_mantle`,
`written_path`, `marrow_siphon`) plus `spore_cloud`, `noxious_cloud`, `brittle_touch`,
and `creeping_rime` are **unplayable by the AI**. The enemy never casts an Aura; the
entire Aura system is player-only in practice, and these cards clog the AI's hand every
turn.

### 1.3 E5 "Juice" hooks

**Logic/presentation separation — OK, verified clean.** `src/anim` imports exactly one
core symbol (`AURAS`, read-only, for a colour). Zero hits for `applyCommand`/`dealDamage`/
state mutation across `anim`, `render`, `hud`, `sound`. The `COMBAT_FEEL.md:139` claim
("`git diff src/core/` is empty for this work") is consistent with the tree.

| Hook | Status |
| :-- | :-- |
| Hit-stop on death (150/400ms) | **OK** — `handlers.ts:70-71,535`, through the sequencer, collapses under `skip()`. |
| Heavy-blow hit-stop (undocumented bonus) | **OK** — `handlers.ts:303-307`, correctly suppressed on kills so the two never stack. |
| Cascade crescendo | **OK** — `handlers.ts:346-362`, pitch/shake escalate off real engine `chainDepth`, `CASCADE ×N` label, deliberately serial (`Sequencer.ts:236`). |
| Last Stand heartbeat | **OK** — `Sfx.setHeartbeat` (`Sfx.ts:146`), wired in both combat shells, stopped on end and dispose. |
| Last Stand vignette | **OK** — `styles/onboarding.css:445-467`, works in both shells. |
| Last Stand board desaturation | **GAP in the district shell** — the CSS selectors (`onboarding.css:439-443`) match only `CombatScreen`'s `canvas.board`; `WorldCombat` renders through three.js + `OverlayCanvas` under `screen--district`, so in-world fights never drain of colour. |
| Last Stand trigger | PARTIAL — polled from board-view syncs, not sequencer-driven, so it flips off-beat; `LAST_STAND_FRACTION = 0.25` is declared twice with no shared constant (`CombatScreen.ts:54`, `WorldCombat.ts:64`). `COMBAT_FEEL.md:137` says 20%; code says 25%. |
| Per-reaction identity | PARTIAL — 3 of 6 bespoke (shatter/vaporize/wildfire); **overload, superconduct, arc** fall through to the generic burst, including the one reaction that throws bodies across the board. |
| `pyreLit` | **GAP** — the event that makes a revival legal has no handler at all; the revival itself is lavishly animated (`handlers.ts:549-574`). |
| Naming collision | The sudden-death banner is literally captioned `LAST STAND` (`handlers.ts:823-828`) — an unrelated mechanic sharing the low-Pact state's name. |

**Test coverage:** zero tests exercise `src/anim` (851 lines, 58 handlers). The suite has
no skipped tests anywhere and the engine has zero TODO/stub markers — which means **every
gap in this section is silent**. That's the headline QA risk: the commentary is so
thorough that unmarked gaps read as finished work.

---

## 2. Progression & The Save Schema

### 2.1 RPG Death Penalty — **OK, implemented as designed**

`rescuePlayer` (`src/core/overworld/state.ts:346-377`): `RESCUE_FEE_RATE = 0.2` deducts
exactly 20% of current Ducats (floored in the player's favour); `currentHp = 10` — one
point at `STAT_SCALE = 10`; deck, inventory, relics, collection, companions, and
marrowShards are untouched; there is **no run-wipe branch anywhere** (`resolveCombat`,
`run.ts:324-380`). Well tested (`overworld.test.ts:357-420`: fee split, satchel survival,
pauper safety, proportionality). It fires at the district door via `rescueIfDown`
(`main.ts:279-288,358`), and the tab-closed-mid-fight case is covered by
`forfeitIfAbandoned` (`state.ts:339-344`) run for all three slots at boot.

Three caveats:

- **GAP — the death-spiral is open.** A pack you *lost* to is still standing on the road
  (`main.ts:941` stamps the cooldown only `if (won ...)`), and `isCritical` is purely
  cosmetic — it renders warnings (`district/hud.ts:307,455,557`) but gates nothing
  (`contractRefusal`, `run.ts:109-115`). A rescued player at 10/400 can be re-ambushed
  immediately, each loss costing another 20%. Only `lastRefuge` distance mitigates it.
- Doc drift: `docs/03_rpg_sandbox.md:21-33` reproduces `rescuePlayer` with `= 1` — the
  pre-Stretch value. Will mislead the next reader (it evidently informed this brief).

### 2.2 3-Slot Title Screen & profile isolation — **OK; two real bugs**

The save system is the strongest subsystem audited. Three fixed slots
(`save.ts:129,138`), `TitleScreen.ts` wanted-poster UI with delete confirmation,
localStorage with a rolling backup written *before* every overwrite
(`save.ts:96-97,1688-1703`), fall-through recovery (primary → backup → empty, each
surfacing a player note), `SAVE_VERSION = 24` with named migration gates and a
card-rename map, newer-version saves rejected rather than partially read.

**Cross-contamination: architecturally prevented.** There is no per-profile save
function — `writeSave` takes the whole file, so untouched slots round-trip by
construction; `active` is a reference into `saveFile.profiles`, never a copy;
`profile()` throws if anything runs without one (`main.ts:121-124`); all progression
state is per-`Profile`; `difficulty` is the one deliberate cross-slot value with its
rationale recorded (`save.ts:450-456`). Tested: `save.test.ts:100-131` ("keeps the other
two slots untouched"). **No contamination risk found.**

The two bugs:

- **GAP — every populated title poster reads "unaccompanied."** `TitleScreen.ts:182`
  passes `profile.activeCompanionId` — an *instance* id like `"ignis-1"` — to
  `companionById`, which matches species ids. It always returns `undefined`, so the poster
  loses the beast's name and falls back to the neutral school tint. `save.ts:409-415`
  warns about exactly this confusion and provides `activeCompanionOf(profile)` for it.
  One-line fix.
- **GAP — silent partial data loss on a malformed `overworld`.** `save.ts:1032-1034`
  falls back to `newRun(...)` — ducats to 0, satchel emptied, relics dropped, position
  reset — while keeping collection and decks, and **pushes no player note**, unlike every
  other repair in the file. The policy is documented (`save.ts:1103-1108`); the silence
  is the bug. From the player's seat it is the save system eating their money.

Minor: `TitleScreen` interpolates the player-typed profile name into `innerHTML`
unescaped (`:148,196`) while `Hud.ts:187` uses `escapeHtml` — inconsistent, local-only.

**Persisted vs. lost on reload:** everything progression-shaped persists (position, purse,
collection, decks, roster XP, campaign, clock, seeds). The live fight is deliberately
never restored — reload forfeits the contract (`save.ts:1029-1031`). That is a design
decision, not a gap.

---

## 3. Overworld & Encounters

### 3.1 Danger-zone encounter → combat → return — **PARTIAL: right area, deliberate not-exact position, two real bugs**

The claim "returns them to their exact x,y rather than the Safehouse" is **90% true and
10% deliberately false**:

- **You are never dumped at a hub.** `currentAreaId()` reads `playerPos.mapId`
  (`main.ts:324-326`), so win *or lose* you return to the same ward or road, and
  `restorePosition()` (`DistrictScreen.ts:1200-1206`) validates the saved position against
  the area and colliders before using it.
- **You return to `lastRefuge`, not the exact contact tile — by design.** `ambush()` pins
  the last *safe* position at the moment of contact (`DistrictScreen.ts:1846-1849`), with
  the rationale written in place (`:1841-1844`): returning to the contact tile after a
  loss puts a 10 HP player back inside the pack's aggro radius on frame one — a death
  loop, not an annoyance. Practically it is a few strides back. **This needs a design
  ruling, not a code fix** — the code contradicts the brief on purpose, and the brief's
  version reopens the death-spiral in §2.1.

Two real bugs in this flow, both verified against source:

- **GAP (blocker-class) — a declined fight permanently disables all ambushes AND Warden
  arrests for that screen.** `beginFight` has two early `return false` paths
  (`DistrictScreen.ts:1879` and `:1882-1885`) and neither disposes `this.ring`; the ring
  is only cleared on success and on unmount. Since both `ambush()` (`:1847`) and
  `arrest()` (`:2044`) guard on `|| this.ring`, one declined encounter (unknown pack id,
  `contractRefusal`, etc.) leaves an orphaned ring mesh ticking and **no combat can ever
  start again until the ward is re-entered**. `docs/verification-backlog.md:210-213`
  recorded this as a *testing* trap ("every later call is a no-op too") without triaging
  it as the gameplay bug it also is.
- **GAP — `positionPinned` latches for the screen's lifetime.** `writePosition`
  (`:1153-1164`) ignores every unpinned write after any pinned one, and nothing resets it
  in `endFight()`. After a declined fight the player keeps walking but `unmount()`'s
  position write is a no-op — they respawn at the stale refuge.

Minor: confirm `warden_writ` (registered as a pack, `packs.ts:173`, but actually the
arrest encounter) is never placed by the roaming spawn loop.

### 3.2 Harpoon Protocol (Subjugation Trial) — **engine OK, UI OK, AI OK; one reachable soft-lock**

Fully implemented end to end: seal at 25% of the enemy ceiling (`encounters/seal.ts:24-37`),
Aether-Plated immunity covering both unit and portrait routes (`subjugation.ts:60-69`),
Rite dealt to the top of the draw pile so a full hand can't dodge the cost
(`:109-122`), Anchor burns both action flags (`:130-144`), 3-round tick, snap → enrage →
re-deal (`:183-223`), hooked *before* `checkLethal` (`death.ts:67-71`), Pacifist Lockout
correctly suspended from the seal (`turn.ts:177-194`). The **AI override works in both
directions** — tether owner defends the anchor, beast attacks it, and casting the Rite
scores above lethal (`score.ts:422-450`, tested in `subjugationAi.test.ts`). The **UI
meter is real**: 3 pips with lock/pulse states, tether line, winch loop, `TETHER SNAPPED`
banner (`Hud.ts:194-227`, `anim/handlers.ts:771-814`). It applies far beyond bosses —
20 encounters carry a `subjugationPrize`, enforced prize↔seal by `hunts.test.ts:36-42`.

- **GAP (top blocker) — the tether can hang the game unwinnable.** `tickSubjugation`
  returns early when the anchor is missing (`subjugation.ts:153-173`) but leaves
  `sub.active` and `sealed` set. A unit can leave the board without dying — and the
  dangerous path is `evictAndSpawn` (`bossPhases.ts:157-183`, verified: it
  `delete state.units[occupant.id]` and emits a raw `unitDied` event **without the death
  pipeline**, so `onAnchorDied` never fires). Collision course: the boss retries `grow()`
  every enemy turn while boxed in (`bossPhases.ts:140-142`), `forcedEviction` deletes
  player units in the footprint, the seal fires at 25%, and **the Anchor cannot move**.
  If the immobile anchor stands in the growth footprint it is deleted mid-tether: the
  tether never completes, never snaps, the Rite is never re-dealt, the boss stays sealed
  (unkillable), and the Pacifist Lockout is off. Unwinnable, un-losable, and the only
  exit — closing the tab — then charges the 20% rescue fee via `forfeitIfAbandoned`.
  **`ignis_trial` has both halves** (`forcedEviction: true` at `ignis.trial.ts:33`,
  prize at `:90`) — this is the flagship fight. Fix is one line: fire `onAnchorDied` from
  `evictAndSpawn`, or have `tickSubjugation` treat a missing anchor as a snap.
- Smaller subjugation gaps: `sealed` never cleared after a bind (`:169-172`; survives
  only because `finish` ends combat); `SUBJUGATION_ROUNDS` is a module constant, not an
  `EncounterDef` field; a snap zeroes all progress; no boss-side pressure ramps during the
  tether; `isAnchor()` is dead code; the meter isn't explicitly hidden on a win (HUD
  teardown saves it).

---

## 4. Content Gaps

### 4.1 Card pools — **OK; the 8-card bar is cleared everywhere**

217 base cards, 298 printings. Per school: dusk 36, frost 32, **bulwark 31**, bloom 29,
**surge 29**, pyre 28, arcane 22, neutral 10 — no school below 8, none at zero. The real
pool constraint is the Grimoire, and it is healthy: `catalogGaps()` reports 0 short for
all six schools (draftable shelves 13–15 vs the 10 target), and a 300-seed simulation
across all 27 companions filled all 8 Grimoire slots every time with **0% neutral
padding**. Every school fields a legal deck trivially, because the Hero deck is
school-agnostic (`HERO_SCHOOLS = ['neutral','arcane']`, `deckRules.ts:46`); the starter
deck validates clean.

- PARTIAL — the hero-legal pool is only **22 distinct cards** for a 4–12 card deck; thin
  decision space for Alpha, and the hero Construct shelf is 6 cards.
- The `MAX_BEHEMOTHS = 2` deck rule is unreachable (0 hero-legal 2×2s) — already disclosed
  in `docs/07:782-784`.
- **No rarity axis exists** (see terminology map).

### 4.2 Vanguard roster — **fillable everywhere; two structural gaps**

43 fieldable bodies (of 83 unit-bearing cards; the rest are correctly `setupOnly`). All
six starting warbands spend `STARTING_WARBAND_POINTS = 10` **exactly** and validate
clean; at the 24-point kit ceiling every school reaches 23–24. No bloodline lacks bodies.

- ~~**GAP — one distinct Behemoth in the entire game** (`magma_brute`, pyre). Non-Pyre
  characters have no Behemoth access; nobody can field two *different* ones.~~ **FIXED in
  #27**: `bastion_golem` (bulwark) is the second fieldable 2×2 and the first outside Pyre.
- ~~**GAP — 4 of 8 schools have no ranged (3pt) body** (frost, bloom, arcane, neutral),~~
  **FIXED in #27** — one per dry school (`rime_archer`, `thorn_lobber`, `glass_arbalest`,
  `hedge_slinger`), and the opening-warband derivation now takes a school's ranged body
  first, so every line opens with one. Original finding: four schools had none,
  and the card-draw Channel is exclusive to 3pt bodies (`economy.ts:104-116`) — so
  **five of six starting warbands cannot access the draw channel at all**. Only Pyre
  opens with the mechanic the ranged class exists to provide.
- PARTIAL — 9 companion knacks are `pending` (correctly fenced, not rollable), leaving
  Gargoyle, Geist, and Sovereign with zero unique knacks; all 15 hybrid Resonances are
  unbuilt (every hybrid borrows a parent's passive, `resonance.ts:54-65`).

### 4.3 Crafting chain — **reagents complete; one hard dead-end**

All 6 Cores have multiple sources (contract spoils by tier, 10 stalls, seeded start);
every Core has a consuming recipe and vice versa, tested both directions. All 24 splice
recipes resolve; zero dangling base/result/catalyst/prerequisite ids; zero orphaned
outputs anywhere (gear→relics, prizes→companions all clean).

- **GAP (blocker-class) — `kinetic_arc` is unobtainable in real play.** Its only recipe
  is `avalanche_slam + core_surge` (`splicing.ts:221-226`); `spliceRefusal` requires the
  base card be **unlocked in the collection** (`overworld/splice.ts:64`, UI agrees at
  `ArtificerScreen.ts:829`); and `avalanche_slam` is on the acknowledged-unreachable
  ledger (`schematics.test.ts:212`) — no encounter teaches it and it is not seeded. It is
  the only splice base in that state. **The suite masks this**: both press-tests fabricate
  the unlock (`expansion2.test.ts:201,208`, `catalog.test.ts:178`). Note also
  `splicing.ts:110-112` claims the bench gates on the Grimoire while the code gates on
  the collection — doc/code contradiction; resolving it either way fixes this.
- PARTIAL (known, tripwired) — 18 obtainable cards are taught by no route and therefore
  can never be forged **or Ascended**; the `UNREACHABLE` ledger
  (`schematics.test.ts:195-283`) is current and two-way asserted. Shrinks by writing
  fights, not cards.
- **GAP — post-campaign content collapses to 4 fights.** With all 34 story contracts
  complete, `TIER_ENCOUNTERS` (`bounties.ts:71-75`) rolls the poster from exactly the four
  original demo encounters (verified over 2000 seeds). Not broken — just a very narrow
  endgame for a playtest that runs long.
- Hygiene: `CATALYSTS` (`artificer.ts:89-108`) is a dead registry in a stale id namespace
  (documented vestigial in `docs/05:82-85`, still shipping); delete it before a
  contributor reads it as the reagent list.

### 4.4 Dangling references — **OK, registries are clean**

Full cross-check over all 62 encounters: zero dangling ids in `enemyDeck`,
`enemyOpeningBoard`, `enemyCompanion`, props, turfwar, vanguard; zero encounters missing
a companion (unwinnable) outside `rout` types; all 34 story contracts, 12 hunts, 3 lairs,
and 9 packs resolve; zero cards playable by no route. The nine empty `enemyDeck` packs
are intentional and asserted (`schematics.test.ts:58-67`). No validation script exists in
`scripts/` — the coverage lives in the test suite, and it is genuinely strong; the one
hole is that nothing asserts every splice base is *obtainable* (§4.3).

**Immediate playtester-visible content holes** (from `docs/worldbuild-todo.md`, confirmed):
11 of 27 companion sprites are placeholder copies of another beast's art; all 12 hunts
share one 8×8 arena; 14 `TODO(worldbuild)` markers dress encounters in stock bodies — of
which two are **mechanical**, not cosmetic: `campaign.adept.ts:217` (the documented
destroy-the-wagon win condition does not exist) and `campaign.novice.ts:174` (flee-biased
AI is not a data field).

---

## 5. Triage

### Alpha blockers — patch before lock

| # | Finding | Where | Effort |
| :-- | :-- | :-- | :-- |
| B1 | ~~Subjugation soft-lock: evicted anchor hangs the tether; boss sealed forever; ignis_trial has both halves~~ **FIXED** (`95aceb2`): eviction snaps the tether like a death, and the tick treats a missing anchor as a snap — backstop for any future removal route. Two new tests. | `bossPhases.ts:171`, `subjugation.ts:158` | done |
| B2 | ~~Combat-ring latch: one declined fight kills all ambushes and arrests for the screen; `positionPinned` latch discards walked position~~ **FIXED** (`47cb30d`): declined fights clear the ring, release the pin, unlock input. Browser-verified: ambush → decline → second ambush starts a real fight. | `DistrictScreen.ts:1879,1882-1885,1153` | done |
| B3 | ~~AI can never play 10 shipped enemy cards; enemy Auras are cut content in practice~~ **FIXED** (`e6e17a5`): `statusValue` (2/stack, mirrored as a cost on own bodies) and `auraValue` (8/attach) added to the weight table and docs/09. Four new tests; determinism harness and all 562 balance playouts hold. `hazardSpawned` stays unscored — no shipped enemy card is hazard-only. | `score.ts:26-112`, `controller.ts:202` | done |
| B4 | ~~Declared card plays draw nothing for all non-tile targets, at the clarity tier~~ **FIXED** (`f7384f6`): intents carry an anchor for every target shape (entity → marked where it stands, followed via `targetId`; line → origin; global → a new HUD line). Casts read amber, strikes red. The world-combat shell, which drew no intents at all, now draws them too. Browser-verified in both shells; new engine test covers all target kinds. | `intents.ts:107-113`, `BoardRenderer.ts:652,729` | done |
| B5 | ~~5 of 7 Aura Climax traits missing while card text promises them~~ **FIXED** (implemented, not fenced): Conflagration = Ignite (2) rider + burning trail; Overgrowth = Leech + Toxin (2) deathburst; Hollow = Brittle rider (Frail-Strike, no new status needed); Rime Shell = one armour step refunded per turn, capped at three stacks' worth; Blink = the one move may end on any visible empty tile, fog-clamped. Each hangs off `climaxTraitOf` at an existing seam. Card texts corrected (three stale ÷2 stat numbers too); catalog regenerated; 16 new tests in `climaxTraits.test.ts`. | `growth.ts:147`, `cards/auras.ts` | done |
| B6 | ~~`kinetic_arc` unobtainable; tests fabricate the unlock~~ **FIXED**: `avalanche_slam` now drops from the Quarry Ram's hunt (its own legacy Grimoire card), taken off the `UNREACHABLE` ledger; a new guard in `schematics.test.ts` asserts every splice base *and every recipe prerequisite* is taught by some fight, so a fabricated-collection press test can never again mask an unreachable pressing. The `splicing.ts` docblock now describes the real gate (collection, not Grimoire). | `splice.ts:64`, `schematics.test.ts:212` | done |

### High — should fix

- ~~Forecast 10× wrong on Growth (`projection.ts:42`; fix the test at
  `projection.test.ts:94` with it) and the latent stacks bug at `:105`.~~ **FIXED**: the
  `UnitSnapshot` now carries each Growth body's real `step` and `cap` off its stat block
  (same fallback `growUnit` pays), the HUD reads those instead of a constant, the latent
  status-tick path uses the stat scale, and the test suite holds the readout to the
  engine's numbers — including the zero-step growers the old constant over-reported and a
  live-board check that every grower's snapshot matches its card.
- ~~Adept's post-declaration pass executes attacks (`session.ts:632-645`).~~ **FIXED**: the
  hidden-hand pass now applies `playCard` alone — no moves, swings or channels — and is
  skipped entirely when the Monocle has revealed the hand. A sweep test across encounters
  and seeds asserts no non-Feral enemy ever emits `attackDeclared` without a declared
  intent at Adept.
  ~~Wave-2 bodies land action-ready (`wave.ts:114`, `spawn.ts:119-120`).~~ **FIXED**: the
  wave now arrives as a real summon (`firstFreeNear` + `summonUnit`) rather than an opening
  placement, so it keeps its arrival flags, sits out the round it lands, and acts on the
  next like every other mid-fight arrival; the planner is asserted never to commit an
  arrival on its landing turn.
- ~~Reaction AoE geometry vs 2×2 Behemoths (`engine/reactions.ts:390-402` → use
  `cellsOf`, per `marks.ts:187-218`).~~ **FIXED**: Shatter, Overload, Wildfire and Arc now
  ring the host's whole footprint (excluding its own cells), matching `blastTiles`; Overload
  measures its throw direction from the nearest host cell rather than the anchor. New
  `reactionGeometry.test.ts` holds all four against a live `magma_brute`.
- ~~`ignoreIceSlip`: obtainable boon, zero readers, no ice hazard — remove the sources or
  fence them `pending`.~~ **FIXED**: the boon is removed end to end (`CombatBoons`,
  `CommanderState`, the relic merge, the carry, the deck-builder label). Its four sources
  keep their ids and now grant real footing rules their text already described — Glacial
  Pacing → `boundFormGrounded`, Static Cling → `boundFormIgnoresHazards`, Glass-Footed keeps
  its Shatter immunity, Rimewalker Crampons → `collisionResist`. A beast or bag already
  carrying one simply starts working.
- ~~Title poster companion lookup (`TitleScreen.ts:182` → `activeCompanionOf().baseId`).~~
  **FIXED**: the poster resolves the roster instance to its species through
  `activeCompanionOf`, so it names the beast and tints to its school; `data-companion` now
  carries the species id the future portrait renderer will want. Browser-verified.
- ~~Silent purse/relic/position reset on malformed overworld — add the missing player note
  (`save.ts:1032-1034`).~~ **FIXED**: a run that cannot be rebuilt now pushes a note naming
  exactly what was reset and what survived, but only when there was a run on disk to lose —
  a pre-run legacy save still upgrades silently. Two new tests hold both halves.
- ~~Death-spiral: cooldown a pack on *loss* too (`main.ts:941`), or give `isCritical`
  teeth.~~ **FIXED** (design ruling: same cooldown either way): a roaming pack now stamps
  the hunt clock on a loss as well as a win, host and pulled squads alike, so a rescued
  character is not dropped back beside the crew that just beat them; hunts and lairs stay
  win-only, since they are chosen from a board rather than walked into. The rule lives in
  `core/data/hunts.ts` as `stampClock` and is tested there.

### Medium

- ~~Danger zone under-warns (Fleet range, `anchor`/`exhaust` still projected) —
  `threat.ts:42,104`.~~ **FIXED**: the map now forecasts the board as the enemy's turn
  will find it — every action-gating status is read *after* its owner's start-of-turn tick
  (`heldNextTurn`), Fleet is counted at what it will be worth after that tick, the Anchor
  is a hold that never lifts, and a Climaxed Blink or Overload host is projected through the
  ground its trait lets it cross. Each hold case is asserted against the map *and* against
  the engine by ending the turn. **This surfaced a new finding — see "Freeze timing"
  below.**

**~~NEW (found fixing the above)~~ FIXED (ruling: a one-stack hold covers a full enemy
turn) — Freeze/Stun/Entangle from the player's turn did not hold the enemy through its
next turn.** The holds now lift at the *end* of the owner's turn (`liftHolds` in
`status.ts`, called from `endTurn`); Chill/Brittle/Charged keep their start-of-turn decay.
The forecast reads the live holds accordingly. Original finding follows for the record: `beginTurn(side)` runs `startOfTurnStatuses(side)`,
whose `decay` takes one stack off `freeze`/`stun`/`entangle`/`exhaust` on that side's own
units *before* that side acts (`status.ts:81-97`, `turn.ts:62`). Rime Lock (`frost.ts:243`)
and the third Chill (`status.ts:259`, depth 1 without Dense Ice) apply **one** stack. So a
Freeze the player lands on their turn is gone at the enemy's turn start, before any enemy
unit moves — probed directly: freeze/stun/entangle/exhaust at 1 stack all read `canAct:
true` at the enemy's turn. The README's "Freeze becomes 'cancel that specific hit'" is
therefore not true of the shipped engine; only a hold landed *during* the enemy's own turn
(a trap, a Counter, a crystal, a construct) or a two-stack Dense-Ice freeze holds anything.
Either statuses that gate actions should decay at the **end** of the owner's turn (or the
start of the opponent's), so a one-stack hold covers one full enemy turn — a balance-wide
rule change worth a ruling — or the cards should apply two stacks. Not changed under the
danger-zone fix; the forecast now tells the truth about whichever rule stands.
- ~~`Dormant`/`Impact` keywords with no engine code~~ — **ruled and FIXED in #25**: both
  named the universal summoning wait as if it were special; dropped from the union, the two
  cards and the glossary, with the rule stated once under Haste and in the help panel.
  `PowerTier` turned out to be a live mechanic and was never part of this.
- ~~Last Stand desaturation dead in the district shell; `LAST_STAND_FRACTION` duplicated;
  `pyreLit` silent; `LAST STAND` naming collision.~~ **FIXED in #23** (the CSS now covers
  the district's two canvases; one export in `Hud.ts`; the fallen body flares where it
  fell; the sudden-death banner says SUDDEN DEATH). ~~The trigger is polled on board sync
  rather than sequencer-driven~~ — **FIXED in #33** (see §7.6). ~~Overload/superconduct/arc
  remain visually generic~~ — **FIXED in #35** (see §7.7).
- ~~`Intent.path` never drawn; move intents painted hostile.~~ **FIXED in #23** (a declared
  move is slate and follows its path). Still open: `bloodTithe` is untelegraphed.
- ~~Stat Stretch ÷10 strings: `glossary.ts:113,117,191`, `HelpOverlay.ts:68`.~~ **FIXED in
  #22**, and `helpNumbers.test.ts` holds every figure in the copy to its engine constant.
- ~~Ranged-body/draw-channel drought in 5 of 6 starting warbands; single Behemoth
  game-wide~~ — **FIXED in #27** (see §4.2 and §7).
- ~~Post-campaign board = 4 demo fights (`bounties.ts:71-75`).~~ **FIXED in #23**: a finished
  story contract joins its tier's rolled pool as repeatable arena work.
- ~~Subjugation polish: clear `sealed` on bind (#23); per-encounter rounds, partial
  progress, boss pressure.~~ **All FIXED**: the seal in #23, the other three ruled and built
  in #26 (see §7).
- Two mechanical worldbuild TODOs: wagon win condition (`campaign.adept.ts:217`),
  flee-bias AI (`campaign.novice.ts:174`) — **still open**; the wagon epilogue no longer
  asserts the missing mechanic (#23).

### ~~NEW (found under the hold-timing ruling)~~ FIXED (ruling: cap Pact armour) — the Frost enemy's armour race

**Fixed:** a Pact may now wear at most **half its ceiling** in plate (`PACT_ARMOR_CAP_FRACTION`
in `damage.ts`, applied at `grantArmor`, the one choke point every Pact plate passes through;
refused silently at the cap, as a heal at full is). Measured on the same eight Glacial Field
seeds: enemy armour pins at 200 in every game, and the 81-turn marathon ends at turn 40; the
longest game is now 53. Unit plate keeps its own bounds. **Still open, and different:** the
Frost mirror remains 8/8 Novice-vs-Novice defeats — the enemy Boreas deck beats the player's
Ignis starter in every seed. That is a matchup question for the balance pass, not a structural
failure; the ledger's contract (every game reaches a decision) holds. Original finding follows
for the record:

Measured while verifying the ruling, and **pre-existing** — an A/B against HEAD in an
isolated worktree shows the same shape under the old timing. On the Glacial Field, the
Novice-vs-Novice ledger loses **8 of 8** seeds, in 25–50 turns (old) / 10–81 turns (new),
and the enemy Pact ends every game at 160–390 HP behind **430–1,020 armour**. From about
turn 50 the enemy's health never moves again: it plates its Pact — Rime Guard Resonance,
Aegis Ward on Retain, Rime Shell's refund, Petrifying Mantle — faster than anything left
on the player's side can chip, while its board grinds the player down. Pact armour has no
ceiling (`PLATE_CAP` bounds a Guardian's self-plating; nothing bounds the Pact's), so a
fight the player has lost the board in cannot be *lost quickly* either — seed 1 took 81
turns to end. The Pacifist Lockout cannot help, since the player's Pact is being damaged.
**Needs a ruling:** a Pact armour ceiling (the obvious one), Aegis Ward off Retain, or a
lockout that also counts rounds in which *one* side's health never moves. The balance
harness now tells a grind that is still resolving from a true stalemate (progress-gated
guard, `balanceSuite.ts`); it does not hide this — seed 1 is flagged `slow`.

### Design rulings needed (code contradicts the brief on purpose)

1. **Return position after an ambush is `lastRefuge`, not the exact contact tile**
   (`DistrictScreen.ts:1841-1849`). The code's reasoning is sound — exact-tile return
   after a loss is a death loop at 10 HP. Recommend keeping `lastRefuge`; if exact-tile
   is wanted, it must ship together with a loss-side pack cooldown.
2. **Rescue HP is 10, which is 1 pre-Stretch point** — matches design intent; fix the
   stale snippet in `docs/03_rpg_sandbox.md:21-33`.
3. **No rarity axis exists** — readiness criteria should be phrased against `CardTier`.

### Verified OK — the brief's direct questions, answered

- **Death penalty**: 20% Ducats, HP to 1 (stretched), deck/inventory preserved, no run
  wipe. Implemented and tested. ✅
- **3-slot title screen / profile isolation**: real, versioned (v24), backed up, migrated;
  cross-slot contamination architecturally prevented and tested. ✅
- **Return after Tall-Grass encounters**: same ward/road always, near-exact position
  (refuge) by deliberate design; never the hub. ✅ (with ruling #1)
- **Harpoon Protocol**: engine, 3-pip meter, and two-sided AI override fully implemented
  across 20 catchable encounters. ✅ (minus B1)
- **E1 forecast**: attacks/channels telegraphed at both tiers, tile-committed and honest;
  Adept hiding cards is by design. ✅ (minus B4 and the §1.2 list)
- **E5 hooks**: hit-stops, cascade crescendo, Last Stand heartbeat all wired through the
  sequencer; the logic core is verifiably untouched by presentation. ✅
- **Bulwark & Surge pools**: 31 and 29 base cards — the 8-card bar is cleared 3–4× over;
  every Grimoire fills 8/8 with zero padding. ✅
- **Vanguard roster**: every school's starting warband spends its 10 points exactly and
  validates; kits reach 23–24/24. ✅
- **Reagents & schematics**: all 6 Cores multi-sourced; zero dangling ids across every
  registry; the 18 unforgeable cards are known and two-way tripwired. ✅ (minus B6)

## 6. The shell audit (2026-09-03) — PRs #21, #22, #23

*Scope: everything the first audit did not look at — the operational shell a tester needs
(getting a build, error handling, saving, settings, leaving a screen) and the first-time
player's path from the title wall to the first fight. Three exploration passes, all findings
verified against source, then fixed in order of what a tester would hit first. Each PR was
merged to `main` behind typecheck, build, browser passes on every fix, and the full
non-balance suite; the balance ledger was not rerun because none of these PRs changes a
rule the AI plays against (the one engine change, Concede, is a command the AI never sees).
The game has been live at <https://wknudson.github.io/CONJURE/> since #21.*

**Bottom line:** the engine was ready and the shell was not. A tester could not get a
build, could not leave the district once a character was opened, would have been greeted
by a lighting debug panel, and on the first error would have seen a blank page with no way
to report it. All of that is closed. What remains is design work, not holes.

### 6.1 Alpha blockers — **all FIXED, PR #21**

| # | Finding | Fix |
| :-- | :-- | :-- |
| 1 | No way for a tester to get a build: no hosting config, `dist/` ignored, absolute asset paths | GitHub Pages workflow on every push to `main`; relative base; every sprite path through `render/assetUrl.ts`. Pages had to be created once with an admin token after the repo went public. |
| 2 | No exit from the district: `onLeave` wired since the district was built and never invoked | Escape menu (back / leave to the title wall). Surfaced an ordering bug — the title closed the profile before the district wrote hour and position on unmount — fixed with `ScreenManager.close()`. |
| 3 | The lil-gui look-tuning panel shipped in production, two lines outside its DEV guard, and the legend advertised it | Moved inside the guard; legend line removed; lil-gui to devDependencies; verified absent from the bundle. |
| 4 | No error boundary: a throw in any `mount` left a blank page; the animation drain had no `catch`; no build stamp anywhere | Global `error`/`unhandledrejection` handlers raise a crash panel with a copyable report (build, screen, profile, last fight's encounter and seed, stack). Version and commit inlined by Vite and shown on the title wall. The drain drops its queue and rethrows naming the event. The mute-preference storage read is guarded. |
| 5 | No concede, pause or quit in combat; reload was the only exit and it forfeited the wager | `concede` engine command, legal at any moment and never enumerated by the AI; two-press white-flag button in both shells; `beforeunload` guard while a fight is open. |
| 6 | `writeSave`'s `false` discarded across ~40 call sites — silent total loss in private browsing or at quota | Banner on the first failed write, worded for the cause by a storage probe, cleared on the next success; probe also runs at boot. |
| 7 | Combat coach marks keyed to `localStorage`, so a second character never saw them and a mid-run reload marked them seen; the district shell never ran them | Flag on the profile's tutorial ledger, recorded only on finish or skip; both shells run the marks. |

### 6.2 High — **all FIXED, PR #22**

| Finding | Fix |
| :-- | :-- |
| Help copy said 40 HP / +2 Brittle / 3–2 collision / 2 Vaporize against 400 / +20 / 30–20 / 20; HUD flashed "PACT 40 / 40" before sync | Corrected; dashes until sync; `docs/03` snippet says 10; `helpNumbers.test.ts` binds each figure to its constant. |
| Defeat screen said only "the Pact is broken"; fee arrived a screen later, never mentioning the drop to 10 health or the lost brew; every notice said "Begin again" | The bill on the defeat screen, computed as the rescue computes it; rescue notice says the same; notices name their own button. |
| Coach marks fired over deployment and rang the hidden hand | One tray step, then a pause; both shells `resume()` as Engage drops the tray. |
| The first contract looked broken: writs are non-clickable briefings for a site in another area, and the map did not mark it | Writ sites marked on the map with the writ's words; route line on every writ card; lap objective says the same. |
| Blank page without WebGL; the district is the only way in | Probe before the district; plain screen with what to try, the build stamp and a retry; renderer constructor guarded. |
| Card rules text clipped: 104×142 at 7.5px, overflow hidden | 112×168 at 8px; all 298 texts fit at base (measured); `cardText.test.ts` caps lengths; `fitCardText` backstop. |
| Laptop height untested | Measured both shells and the district at 1366×650: everything above the fold, before and after the taller cards. No code. |

### 6.3 Medium — **FIXED, PR #23** (except as noted)

| Finding | Fix |
| :-- | :-- |
| Four words for one mechanic (Escalation / Growth / Grown / escalated); raw ids on card faces (`BOUNDFORM`) and tooltips (`chill 2`); Hero tab titled "The Commander"; title hint named a Safehouse | Growth everywhere; glossary titles on chips and tooltips; "The Hero"; "on the plaza". `Hero` (the rules term) and `Commander` (the world title) are kept as two words for two things. |
| No settings: mute and speed only on the combat HUD with their own keys; fixed volume; unconditional shake | One store (volume, mute, shake, playback) migrating the old keys; sound and effects read it at use; panel from the title, the Escape menu and a HUD gear. |
| Roadmap Phase F promised per-game stats and a dump; `record` was three counters | `Profile.history` (v25): encounter, seed, Companion, result, turns, Pact at the bell, difficulty; capped at 30; "Copy diagnostics" in the settings panel. |
| Post-campaign board = four demo fights | Finished story contracts join their tier's rolled pool. |
| Last Stand trio, `pyreLit`, move-intent colour and path, seal on bind, Behemoth ceiling test, wagon epilogue, district shell missing C / Shift / Space | All as annotated in §5 above. |
| Still open by choice | ~~`Dormant`/`Impact`~~ (#25); ~~Subjugation rounds/progress/pressure~~ (#26); ~~ranged-body drought and single Behemoth~~ (#27); ~~pending companion traits~~ (#29); ~~`bloodTithe` telegraph~~ (#31); ~~Last Stand trigger polled~~ (#33); ~~three reactions visually generic~~ (#35); ~~the 01:00 start~~ (#36). Nothing remains. |

### 6.4 Two things learned about the repository itself

- **Squash merges from a long-lived branch conflict the moment later work edits lines a
  squash touched.** `main` holds each PR as one commit, the branch holds the same content
  as many; a three-way merge against the old base sees two different changes to one
  region. #22 and #23 both hit it. The fix is a `git merge -s ours origin/main` on the branch
  after each squash (tree hash unchanged, verified), which tells git the squash is in.
- **GitHub Pages on this repo needed two things the workflow could not do:** the plan did
  not allow Pages on a private repo (the repo went public), and even then the workflow token
  cannot create the Pages site (`enablement: true` fails with "Resource not accessible by
  integration"); it was created once with the owner's token. Deploys have run unattended
  since.

## 7. The three design calls (2026-09-03) — PRs #25, #26, #27

*Everything both audits had marked "open by choice" that was a ruling rather than a
scoping decision. Each was decided, built, and merged behind the same gates as §6; the two
that change the engine or the content the AI plays against also reran the full balance
ledger (562 playouts, every fight decided).*

### 7.1 `Dormant` and `Impact` — **dropped, PR #25**

Both keywords named the wait every summon already obeys — nothing moves, strikes, channels or
is bled on the turn it arrives unless it has Haste (`canAct`) — as if the two cards that
carried them did something special. Nothing in the engine ever read either. `Dormant` on the
Ash-Ghoul named the universal wait; `Impact` on the Magma Brute claimed credit for a
`cleaveFront` effect that is authored in the definition and fires regardless. Each had a
glossary entry, so players were taught two rules that did not exist. Making them real would
have meant removing the universal wait from every other summon or inventing engine code for a
keyword that changes nothing. Removed from the union, the cards and the glossary; the cards
say what happens in plain words; the wait is stated once, under Haste and in a "Fresh
summons" help row; lexicon and catalog follow. No engine behaviour changed.

### 7.2 The Harpoon Protocol — **three rulings, PR #26**

| Ruling | Was | Is |
| :-- | :-- | :-- |
| Rounds belong to the encounter | `SUBJUGATION_ROUNDS` module constant | copied into the fight's state at setup from `EncounterDef.subjugationRounds` (default 3); every event carries the target, so the HUD's pips size themselves |
| Pressure | a round held cost the beast nothing | the sealed beast gains one stack per round the tether stands, none on the round that binds — a race, not a wait |
| Memory | a snap zeroed the count | half the rounds held (rounded down) carry to the next tether; `anchorSet` says what the new tether starts with and the HUD shows it |

**Bug found on the way:** every Bound Form's `escalationBonus` is written as zero, so the
punitive stack on a snap changed nothing — the Ignis Drake came back from a snap exactly as
strong as it went, and the test allowed it with "not weaker". `enrageBoss` now falls back to
a flat `STAT_SCALE` of attack when the card's bonus sums to nothing; the test says "stronger".
Without this the new pressure would also have been a stack that did nothing. Dead `isAnchor()`
removed. Balance ledger rerun: 562 playouts, all decided.

### 7.3 The ranged drought and the single Behemoth — **content, PR #27**

Four of the eight schools had no 3-point body, and the card-draw Channel belongs to that
class alone; and the Magma Brute was the only fieldable 2×2 in the game.

- **Four ranged bodies**, one per dry school, each buying reach with a visible weakness in
  `ranged.ts`'s idiom: `rime_archer` (frost; cheap, one movement), `thorn_lobber` (bloom;
  arcing, blind adjacent), `glass_arbalest` (arcane; the Stalker's hit on thirty health),
  `hedge_slinger` (neutral; the Footman's cousin with a sling — the floor under everyone's
  draw).
- **`bastion_golem`** (bulwark): the Brute's frame with the school's priorities — less
  attack, far more health, a Guardian, no arrival effect, a Bone cheaper. The first fieldable
  Behemoth outside Pyre; the two-Behemoth cap can now be met with two distinct bodies, and the
  fixture that waited for that day uses them.
- **Reachability:** archer via the Glacial Field and the Rimefield Bear; lobber via the Thorn
  Warden; golem via the Vault Boar; the colourless pair via `startingCollection`, since no
  fight teaches a colourless card.
- **The ruling that made it matter:** `startingRosterFor` derives the opening warband and
  took a school's two-pointers before its ranged body, so a new ranged body alone would never
  have reached an opening line. It now takes the school's cheapest ranged body first. Every
  line opens with the Footman, the Scout, its ranged body and one of its own, at **nine**
  points; the enrolment tests already allowed that, and `STARTING_WARBAND_POINTS` stays 10 as
  the design doc argues.

Verified: `rangedDrought.test.ts`; full non-balance suite 136 files / 2,693 tests; balance
ledger rerun, 562 playouts, all decided.

### 7.4 The nine pending companion knacks — **built, PR #29**

Nine of the twenty hybrid knacks were declared and never built: they named mechanics the
engine does not have — Echo, Frail, Pierce, Devour, damage reflection — or scaled a number a
card already prints, which `companionTraits.ts` refuses on purpose. They carried a `pending`
reason and were filtered from the roll, so three hybrids had no knack of their own and the
Field Journal showed designs that could not happen. Each is now one read at one existing
chokepoint, in the engine's own words; three built as designed, six rewritten in the same
flavour, and every entry's comment says which.

| Knack | Bloodline | Now |
| :-- | :-- | :-- |
| Static Burn | wasp | a Burning enemy moves one tile less, read off the burning body's foe in the legal-moves walk and the danger-zone forecast |
| Ember Spores | treant | every Toxin tick also lights a Burn, landed **after** the Burn pass so it is a real affliction rather than a bigger number in a costume |
| Lightning Rod | mantis | a Guardian struck from range leaves the shooter Charged — nothing reflects, but Surge cashes a charge |
| Frost-Reaper | gargoyle | Dusk damage on a Chilled body also leaves it Brittle, the engine's own "+20 from every hit", as a status |
| Hollow Ice | gargoyle | a Climaxed Hollow host leaves an Ice Barricade where it falls |
| Echo Chamber | geist | Deathbursts carry one ring further |
| Death Rattle | geist | a body killed by a blow leaves its killer Brittle |
| Ossify | sovereign | Shatter and Superconduct cannot strip the side's Armor — Pierce does not exist, the strip does |
| Grave-Robber | sovereign | every fallen body refunds a Bone |

Nine boons on the side's state, carried through setup, the run's carry, the relic seam (the
one place the full run caught as missed) and the Field Journal's labels. Verified:
`knacks.test.ts`, one test per knack at its chokepoint with the negative case; the hybrid
tests assert nothing is pending and every declared knack is wired (carry count 24 → 33);
full non-balance suite 137 files / 2,703 tests; balance ledger rerun, 562 playouts, all
decided.

### 7.5 The blood-tithe telegraph — **FIXED, PR #31**

The one action the enemy could plan that the intent layer never drew: `enumerateActions`
offers the tithe, `declareIntents` had no case for it, and a Novice — the tier whose premise
is that nothing is hidden — watched a body get bled for Marrow with no warning. A declared
tithe is now an intent kind of its own, drawn where the body stands at both tiers like a
Channel (a spend is not a card): a drop for its badge and the grey of a move for its tile on
the 2D board; `TITHE` and, for a Channel, `SIGHT` badges in the district shell, which drew
neither. **Found on the way:** the tile marker for a declared Channel was painted in the
strike's red, telling the player a sitting body was about to hit them; Channels wear the grey
now. The README's intent section states which declarations each tier shows. Verified:
`titheIntent.test.ts` at both telegraph settings; full non-balance suite 138 files / 2,705
tests. Ledger not rerun: intents are derived from the plan after the AI has chosen it and do
not change what executes.

### 7.6 The polled Last Stand trigger — **FIXED, PR #33**

Both fight shells polled Last Stand off the board on every sync, comparing the Pact's health
to `LAST_STAND_FRACTION` against a logic state already several animation steps ahead — so the
board drained before the blow that took the Pact to a quarter had landed, and the heartbeat
came up under a hit the player had not yet seen. The HUD now sets it from the number it is
told in `setCommanderHp`, which the sequencer calls as each portrait blow and each heal
replays and the mount-time sync calls once for the opening state: the drain lands on the hit
and lifts on the heal. The shells' polling and their duplicate comparisons are gone; the
threshold constant stays in `Hud.ts` and the Pact bar's critical fill reads the same one.
Verified: browser (the class follows the number the HUD is told); full non-balance suite 138
files / 2,705 tests. Presentation only, ledger not rerun.

### 7.7 The three generic reactions — **FIXED, PR #35**

Six reactions, three presentations: Shatter, Vaporize and Wildfire each had a burst that
looked like its rule, and Overload, Superconduct and Arc shared one generic bang — a detonate
cue, a shake, and nothing drawn but the name. Each now looks like the rule it is, built from
the primitives the other three already use so it runs over both fight shells' cameras.
**Overload** throws: eight heavy sparks along the eight compass lines ahead of a ring a tile
wider than any other reaction's, amber going to fire, the biggest shake in the set.
**Superconduct** runs in: a ring contracts onto the body and a column of frost sparks rises off
the tile, in the cyan of the strip and the Brittle it leaves, with no flash and barely a
tremor. **Arc** chains: a bolt to each of the eight neighbours in a quick stagger, with a spark
where each lands. Verified: each effect's rings, particles and tracers inspected mid-animation
on a mounted board, and all settle to nothing; full non-balance suite 138 files / 2,705 tests.
Presentation only.

### 7.8 The opening hour — **ruled and FIXED, PR #36**

Every character began at `NIGHT_ANCHOR`, one in the morning — the hour the ambience was
measured at, and the only hour that existed when the clock shipped. Read against the daylight
curves that is the hardest hour in the world for a stranger: the light at nothing, the Warden's
grace at two thirds, the curfew on, the night crews at full vigour — and the first thing a
player ever saw was a dark ward. **Ruling:** a new character opens at `OPENING_HOUR`, six in the
morning, mid-dawn. The light is coming up under them as they walk the first lap, the lamps are
half lit and going out one at a time behind the lamplighter, both the night and the day crews
are on the road, and the Warden's grace is nearly full. The design comment on the daylight
curve already said the whole value of a cycle in a twenty-minute sitting is being *in* the
change; this puts a new player in it from the first step. Existing saves are untouched, and
the anchor keeps its job as the hour a pre-clock save is put back at. Verified: a fresh
character's ledger reads `06:08 · dawn` with daylight 0.8, lamps 0.68, grace 0.93; the save,
enrolment and district suites pass and the full non-balance suite follows.

### 7.9 The female side-walk — **FIXED, PR #37**

Outside either audit's scope: the player asked directly why the female Commander's walk
looked wrong compared to the male's, rather than an exploration pass surfacing it. Recorded
here anyway, for the same continuity §6 and the rest of §7 already keep.

Her four side-walk frames were independent files, each cropped tight to its own content at a
different aspect ratio (143×359, 124×357, 143×372, 131×368). `BillboardSprite` fixes the
Commander's drawn height and derives width from each texture's own aspect ratio, so four
ratios meant her on-screen width swung by up to 15% every frame she took a step — the exact
throbbing the male bearing's walk sheet avoids by cutting all twenty of its frames to one
fixed box. Padded all four female frames onto a shared 143×372 canvas, bottom-anchored so her
feet hold the same ground line, leaving the drawn poses untouched. `SIDE_WALK_ORDER` was left
alone: the art has exactly one true passing pose, so `[0, 1, 2, 1]` is the only arrangement it
supports, not a bug. Front and back walking turned out to be unrelated — neither gender has
walk frames for those two facings at all, confirmed live in the browser, so there was nothing
gender-specific left to fix there; making that look good is unstarted art or animation work,
not a defect. Verified: a new test reads the four files' real PNG dimensions and fails if they
drift apart again; full suite 145 files / 3269 tests, including all six balance ledger files
run individually; `tsc --noEmit` clean.

### 7.10 The world redesign — **built, PR #39**

Not an audit finding: a verdict. Nineteen hand-painted areas, none of which could be entered;
the four trades were twenty-pixel plaques on anonymous terraces that swapped the whole screen for
a menu; every one of the forty-one contract sites was a label on bare ground; and thirty-four of
forty-eight townsfolk said one line and offered nothing. The owner's reading — *mundane and
generic* — was fair, and the ask was for every part of the world to be bigger, to have more to do
in it, to be designed rather than scattered, and for the Artificer to be a place rather than a
symbol on a wall.

**What was built.** `AreaDef.indoor` and `ExitSpec.door` turn a building's face into a doorway
onto a room that mounts as its own area — wall textures, no ceiling, a steeper camera, lit at the
night anchor whatever the clock says — and a door can be shut by the Chronicle and say why.
Thirty-nine rooms open off all nineteen areas. The three trades are benches inside rooms
(`benches.ts`); the Field Journal is no longer a building but the **J** key and an Esc-menu
entry, and the east building it occupied is the Records Office. Four registries, each addressed
into an area by id on the sites idiom and none of them a new noun on `AreaProps`: notices,
plaques, graves, ledgers and books you stand at and read (first open one per spot wins, so a
board changes once a contract is walked); caches opened once per character and paid through the
errand purse; forage that regrows on the street clock and sometimes bites back with a pack that
already exists; beds that advance the clock for a fee and heal nothing. Eleven contract sites
moved indoors — the cellar count, the cistern, the clinic, the Foundry Hall, the Poster's shed,
the Spire lobby, the Rest, the Undercroft, the drowned granary, the barn, the inn cellars — and
five Wildlands dens hold a crew behind a cave mouth, the first places in the world you enter to
fight rather than fight on the way to. Every area grew: the city wards to twenty-eight and
thirty-odd tiles a side, the Ring towns by about half, the Wildlands with a ring of new ground
and a north-wall entrance each, with nothing already placed moving. The Chronicle widened to
`{campaign, flags}` and the save to v26 (`caches`, `worldFlags`, `visited`, `forage`).

**What was found on the way.** Tile-edge arithmetic: a value on a tile boundary belongs to the
next row, which put waypoints on the Counting House and a cache's opening spot inside a room's
north wall until every placement was recomputed from row centres. A pack-aggro fixture that
stood its pack at the Verge's origin and silently depended on a thicket beside it. And the
browser pane, which was closed for the last third of the work, so the later Ring rooms and all
five wild dens were verified by the placement suite and by reading prompts off the screen object
rather than by eye — recorded in the worldbuild to-do's Wave 14.

**Verified.** The full non-balance suite on the exact tip: 143 files, 3,533 tests, green. The
balance ledger was not run, because `core/data/packs.ts` is untouched and nothing the AI plays
against changed. The Pages deploy of the squash commit carries its build stamp.

**Open by choice, and written down in Wave 14 rather than here:** the wild dens borrow existing
road crews instead of themed packs, because a new `PackDef` enters the balance harness; the
Wildlands floors are still one texture per region with a ring added; a room's cache and door
liveness is read once at mount; and the bench screens are still screens — the room is the shop
now, but the shop still swaps the view.

### 7.11 The bestiary expansion, Wave 0 — **built, PR #41**

Not an audit finding: an ask. More companions, many more minions, and more cards in every school,
the colourless one included, "so not every companion has the same pool of cards". The complaint
was accurate. Every species hands over the identical Hero Deck by design, built from the colourless
shelf §5 already calls thin; the two mono species of a school drafted from one
pure pool of nine to eleven cards and differed only by a four-card `omit`; and a fusion reached
any beast sharing one of its two schools, so the hybrid pools overlapped heavily too. Minions
had no art at all — every body on both boards was a procedural silhouette or an archetype prism.

The expansion was planned as twelve waves and ruled in one sitting: two new mono species per
elemental school and one new hybrid per school pair (twenty-seven in all, none neutral or
arcane); signature cards per species plus larger school shelves, with the Hero Deck left shared;
thirty-six new fieldable minions and twelve threats; the new hybrids split across lairs, story
contracts and rare hunts; bundled art restricted to CC0 and attribution-only licences; and the
owner painting the new companions, with stand-ins until then. Wave 0 builds only the machinery
those need, and changes nothing a player sees.

**What was built.** `CardDef.bloodline` names the species that may learn a card, and
`GrimoireSource.bloodline` is stamped from the species id where `COMPANIONS` is built, so a new
species cannot forget it. One predicate guards all four doors a card comes through — the pure
shelf, the fusions, the colourless fallback and the socket, which refuses a forged signature in
the wrong beast as `off-bloodline` — and a draft's first slot deals from the species' own
signatures when it has any. A hunt may now carry `requires`, and the board posts it only once
the kept beasts speak every school it names: a rare hunt is a hybrid that comes to the scent of
both its parents. `CREATURE_ART` lists a card's drawing, its facings, its filtering and whose it
is; the loader remembers failures, BodyLayer changes a body into its drawing on the frame the
file lands, the 2D board draws a standee, and the silhouette stays the fallback everywhere.
`CREDITS.md` and `docs/sprite-requests.md` are generated from the data and checked against it,
and `COMPANION_ART_PENDING` is a two-way ledger over placeholder PNGs that mark themselves.

**What was found on the way.** `rosterUnlocks` is the wrong thing to gate a hunt on, although
it is the permanent ledger: its migration floor hands a pre-enrolment save a Dusk archer and a
Pyre lobber nobody tamed, so the gate reads the Vivarium instead. A missing front sprite drops
the district follower entirely rather than drawing a shape, which is why stand-ins are files on
disk rather than a code path. And the hunt spec lists each enemy deck by hand, so signatures will
not be taught by their hunts automatically — every content wave adds its own to the fight that
teaches it, because `schematics.test.ts`'s UNREACHABLE list fails in both directions.

**Verified.** The full non-balance suite on the exact tip: 146 files, 3,565 tests, green. The
balance ledger was not run: no card, encounter or pack changed, and a test pins that the draft
rule moved no shipped species' draw. In the browser, a throwaway registry entry pointed the
footman at a probe PNG; both enemy footmen wore it on the diamond and in a Chalk Road fight while
everything else kept its silhouette, and the probe was removed before commit. The Pages deploy
of the squash commit carries its build stamp.

**Open by choice:** the road's roaming packs stay procedural until the world waves finish
reworking `Pack`; `CATALOG_TARGET` rises with the second school-shelf wave, because raising it
now fails the catalog test before the cards exist; and `CREATURE_ART` ships empty, so the first
drawings arrive with the art wave.

### 7.12 The bestiary expansion, Wave 1 — **built, PR #43**

The Hero half's shelf. Every Companion hands over the same Hero Deck by design, and §5 had
already called the colourless pool thin: eighteen hero-legal cards in the whole game, three of
them neutral, for a deck of four to twelve. `cards/hero.ts` adds twenty-two — sixteen neutral,
six arcane — every one an Ability or Construct cast from the Hero's side of the board and built
from ops the interpreter already runs. The neutral half hurts with weight and rope and brings the
Hero's first heal, draw and ramp; the arcane half is spell damage and the holds nobody's element
owns. No elemental statuses, no Marks, no bodies.

**Taught by two new duels.** The Journeyman Duelist (Adept) plays the neutral shelf and the Master
Duelist (Master) the arcane half, both on their tier's rolled poster and wagered like the first
duel — which also widens the post-campaign board §4 recorded as collapsing to four fights.
`duelist.test.ts` now asks the Novice's Hero Deck questions of every duel, and that every kit card
is played by one.

**What was found on the way.** Holds lift at the end of the *owner's* turn, so a one-stack
Entangle or Stun cast on an enemy holds it through the whole of its next turn; the faces say so,
and it is what prices them (Entangle on a one-Bone Bola, Stun on a three-Bone Glyph). The first
Journeyman was softer than the Novice: in AI playouts the default character beat it eight times
in eight, against none in eight for every existing duel, because a deck made only of lessons
spends its turns on utility with nothing to do. Staples and a heavier warband took it to three in
eight, several decided by twenty health. `heal` restores the Pact, not a unit, and the heal cards
say so.

**Verified.** The full non-balance suite on the exact tip: 146 files, 3,571 tests, green. The
balance ledger: 7 files, 580 tests, green, including eight playouts of each new duel. The browser
was not reachable — the folder was at its dev-server limit, held by other sessions — so the AI
playouts, which played nineteen of the twenty-two new cards, stand in for it.

### 7.13 The bestiary expansion, Wave 2 — **built, PR #45**

The first three schools' shelves, and the fix for why their beasts dealt the same books. Two
single-school species per school drafted eight cards out of one shelf of nine to eleven, with
four struck off each; an Ignis and a Flue Salamander were two draws of mostly the same dozen.
Twenty commons fill the shapes each shelf lacked (Pyre, the thinnest, gets eight), and eighteen
signatures — three per species, tagged `bloodline` — give every one of the six a card its cousin
can never learn and a book that opens on it. The omits drop from four cards to two. Every new card
is taught in the same PR: each hunt plays its species' three, and the commons ride in the
school's story fights, because the `UNREACHABLE` ledger fails in both directions.

**What was found on the way.** A latent engine bug older than the expansion: a Companion card
with no target of its own resolved every area against nothing, because `originOf` had no
coordinate for a `none` target. Elmo's Fire's burst and Hoarfrost Veil's chill had never landed,
silently, since each shipped. The engine already records where the caster stands, and now reads
it; `casterBursts.test.ts` pins both cards and the new Static Bristle. Along the way, an entity
area of the eight tiles around a unit excludes the unit (the ground version counts it), and two
faces were corrected to say exactly who they touch.

**Verified.** The full non-balance suite on the exact tip: 147 files, 3,577 tests, green — one
earlier run on it timed out twice under CPU contention from probes in another worktree, and the
clean rerun is the result. The balance ledger: 7 files, 580 tests, green. The catalog grows from
244 base cards to 282.

### 7.14 The bestiary expansion, Wave 3 — **built, PR #48**

The second half of the shelf work. Eighteen commons fill what Bulwark, Dusk and Bloom lacked
— Bulwark a line, a cone and a draw; Dusk anything plain (a bolt, a wall, a way to move a body);
Bloom a free nettle, a line of thorns and a pod — and eighteen signatures give the Boar, the Ram,
the Stag, the Jackal, the Warden and the Aurochs cards of their own. Each hunt teaches its
species' three and the commons ride in the schools' story fights. The six omits halve as Wave 2's
did, and `CATALOG_TARGET` rises from ten-to-fifteen to twenty-to-thirty-four now every elemental
school carries forty-odd cards. No new Dusk card leaves Brittle, so the list `expansion2.test.ts`
pins still holds.

**Verified.** The balance ledger on the exact tip: 7 files, 580 tests, green. The full
non-balance suite on the same commit: green on a clean rerun, after the first run lost the
`intents` Adept case to the known load timeout. The catalog grows to 318 base cards.

### 7.15 Smoother motion — **FIXED and built, PR #47**

Asked for on the grounds that the game should "look much smoother". A survey of open-source
animated sprites came first. Under the CC0/CC-BY ruling, nothing 2D comes near the painted
cast's 250px Octopath look. The CC0 3D route (KayKit, Quaternius) was downloaded, pre-rendered
and put beside the cast, and it animates well but reads as low-poly chibi. That route stays on a
local `sprite-bake` branch, unmerged. What merged is the motion the existing art could already
have had.

**What was wrong.** Two flinches were computed every fight and drawn on neither board. The
canvas board's `drawEntity` never read `view.squash`, so no hit or collision squash had ever
shown there. On the district board, `BodyLayer` wrote `view.elev` into the walker's `y` before
`Walker.step()` wrote the walk bob into the same vector, so lunge hops, summon drops and death
sinks were overwritten every frame. Both are fixed. Squash scales about the feet through one
`squashScale()` shared by the two boards, and the lift is added after the step.

**What was built.** The curves live in `src/anim/motion.ts` as pure functions of progress, and
every one of them ends at rest at k = 1, so skip still leaves nothing behind.

- A walk is one eased tween along the whole path, where it used to brake on every tile.
- Melee has a wind-up, a strike and an overshooting recovery. It keeps its 240 ms and stays
  under half a tile.
- Ranged shots recoil, summons, deploys and revives land with a squash, and deaths stretch and
  collapse.
- The painted Commander and companion breathe beside the board.
- On the streets, `src/district/gait.ts` adds momentum to the companion, Wardens and packs, a
  lean into sideways travel for every walker, and a `(1 − cos)/2` breath at rest in place of
  `abs(sin)`, which tapped the ground. `Walker` itself is untouched.

**Verified.** `motionPolish.test.ts` pins the curves, the momentum and the lean. The nearby
walk, pack, wildlife, hero-walk and pacing suites are green. The full non-balance suite on the
exact tip is green: 148 files, 3,593 tests. An earlier tip hit the two known load timeouts,
`intents` and `determinism`, which were green when rerun alone. That tip was superseded when
Wave 3 merged, and the rerun on the final tip was clean. In the browser, the canvas board
now issues the squash scale it never drew. The melee swing winds up, peaks under half a tile
and lands back on its tile, a three-tile walk runs without stopping per tile, and on the
street the Commander and companion lean into travel and settle upright when they stop.

### 7.16 The bestiary expansion, Wave 4 — **built, PR #51**

Thirty-six bodies a warband can field (`cards/vanguard.ts`): four per elemental school — a
two-pointer with a rider the school lacked, a ranged body, an elite, and a first 2x2 Behemoth
for the four schools that had none — plus six neutral and six arcane anybody may field.
`MAX_BEHEMOTHS` is reachable for every school now. The enemy-only threats this wave was planned
to carry moved to the lair, hunt and contract waves, because a `PackDef`'s members must be bodies
a warband could field, and the world waves are authoring the road's themed crews.

**What was found on the way.** Nothing in the balance ledger plays a body no encounter fields,
so `vanguardDrill.test.ts` fields each of the thirty-six against a passive opponent and requires
it to swing — the first version let the player's side fight back, and six thin two-pointers died
on the approach, which said nothing about the planner. Four schools' opening warbands change,
because `startingRosterFor` derives them from the shelf by design.

**Verified.** The full non-balance suite and the balance ledger on the exact tip, green.

### 7.17 The bestiary expansion, Wave 5 — **built, PR #53**

Six species — the Ashwing Phoenix and Cinderback Badger, the Hoarfrost Mammoth and Rime Ermine,
the Galvanic Eel and Sparkback Pangolin — each whole: a Bound Form with a shape its school
lacked, three wired knacks built from existing boons, three signatures its own hunt teaches, and
a hunt at the gate. Stand-in art (`COMPANION_ART_PENDING`) until they are painted.

**What was found on the way.** The Eel's hunt in rain ended AI playouts in four to six turns at
an Adept tier whose other hunts run to twenty, because rain lifts every shock hit the Eel's deck
is made of; fog and a slower handler brought it to six to nine.

**Verified.** The full non-balance suite and the balance ledger on the exact tip, green.

### 7.18 The bestiary expansion, Wave 6 — **built, PR #64**

Six more species on Wave 5's terms: the Ironhide Rhino and Menhir Beetle, the Gloam Owl and Crypt
Spider, the Bramble Fox and Pollen Moth. Every elemental school now speaks through four beasts,
each opening its book on a card of its own. Stand-in art until painted.

**What was found on the way.** The Rhino's hunt deals Siege Break, which made it the first fight
to teach that card, and the two-way `UNREACHABLE` ledger struck it off — one fewer card no
route can forge.

**Verified.** The full non-balance suite and the balance ledger on the exact tip, green.

### 7.19 What remains

Nothing either audit raised. Every finding either audit ranked as a blocker, High or Medium,
and every design call they left open, is closed and merged. §7.9 to §7.18 are reminders that
"nothing remains" describes the audits' own scope, not every gap the game has — the next thing
found outside it belongs here on the same terms PRs #37, #39, #41, #43, #45, #47, #48, #51, #53 and #64 did. What comes next is
a playtest, and the remaining waves of the bestiary expansion, each recorded here as it
merges.

### Appendix — documentation drift found along the way

| Stale claim | Where | Reality |
| :-- | :-- | :-- |
| "No shipped encounter is fought in rain" (Arc unreachable) | `docs/02:691-711` | 3 rain encounters ship; test ledger already empty |
| Generated catalog: "216 base cards", dusk 35, etc. | `docs/08` | 217; missing `sovereign_behemoth_bound` — rerun `npm run cards:catalog` |
| "214 base cards"; "encounters are still 6×8 and 8×8" | `ROADMAP.md:96,85` | 217; ten distinct arena sizes ship |
| "29 of the 50 obtainable cards" unforgeable | `docs/07:801`, `docs/05:373` | 18 of 102 |
| "Lexis pads six of its eight slots" (4 places) | `pools.ts:109`, `grimoire.ts:191`, `docs/07:785`, `ROADMAP.md:125` | Lexis retired as a bloodline (`creation.test.ts:138`); padding is 0% |
| "The **ten** hybrid bloodlines" | `resonance.ts:33` | 15 ship |
| "Aetheric Splicing is not built yet" | `artificer.ts:6` | It ships: 24 recipes and a till |
| Death penalty snippet `currentHp = 1` | `docs/03:21-33` | `= 10` (1 stretched point) |
| "cask_blast not attachable by any card" | `marks.ts:80` | `cards/arcane.ts:196` attaches it |
| Last Stand "below 20% Pact" | `COMBAT_FEEL.md:137` | 0.25 in code and `docs/10:283` |
| Sound "Open" list (`stopAllLoops` uncalled, tether cues unplayed) | `docs/10:527-536` | All four now wired |
| docs/04 §7.1/§7.2 (seal has one caller; binding grants nothing) | `docs/04:449-455` | Both fixed; §7.3–7.6 still open |
