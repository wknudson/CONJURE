# CONJURE — Playable Combat Demo

A browser-playable vertical slice of **CONJURE**, the tactical grid card battler specced
in the design documents in this folder. It covers the Master GDD's demo Phases 1–3:
the combat sandbox, collision physics / line of sight / runes, and a full encounter loop
against an AI opponent — including the Ignis Subjugation Trial.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

| Command | What it does |
| :-- | :-- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck and build to `dist/` |
| `npm test` | Run the engine test suite |
| `npm run typecheck` | Typecheck only |

To verify the logic core has stayed free of DOM dependencies:

```bash
npx tsc -p src/core --noEmit
```

## How to play

Two encounters are available from the title screen: the **Wandering Novice Duelist**
(a straight fight) and the **Subjugation Trial: Ignis** (a two-phase boss you can bind
rather than kill). Each has its own arena — a narrow 6×8 lane and an open 8×8 boss
floor — and both sides open with a free Vanguard Footman already on the field.

- **Click a card**, then **click a highlighted tile** to play it.
- **Click your own unit** to see its legal moves (cyan) and attacks (red), then click a
  destination or target.
- **Click the enemy Commander** — who stands beyond their back row — when a selected unit
  can reach them. Melee has to be standing in the enemy's two home rows to do that, which
  is why the Commanders are drawn on the field rather than tucked into the HUD.
- Hold **Shift** to expand damage predictions across every affected tile.
- **T** toggles the danger zone — every tile the enemy could strike next turn.
- A unit gets **one move and one attack** each turn, in either order, so it can strike
  and then withdraw.
- **H** opens the rules reference. **Esc** or right-click cancels. **Space** fast-forwards
  the enemy turn. **Enter** ends yours.

### Learning it

A first-time player gets a six-step walkthrough and the danger zone switched on by
default; both can be dismissed and neither returns. After that, everything explains
itself on hover — resources, keywords, statuses, units on the board — and the full rules
sit behind **H**. When an action is refused, the game says why: which resource you are
short, that a unit has already acted, or that melee has to reach the enemy's back rows.

The onboarding follows Into the Breach's rule that clarity beats cleverness (its
designers spent roughly half of development on UI alone), and the danger zone follows the
Fire Emblem convention of outlining the *edge* of enemy reach rather than every tile in
it. Pirate101 — which splits its turn into a planning phase and an execution phase —
informed the decision to let you preview a shove's full outcome before committing to it.

Each card's type line tells you what it does with the board — **MINION**, **SPELL**,
**RUNE**, or **OBSTACLE** — and who casts it, **HERO** or **COMPANION**.

Your Companion stands in a marked lane beside the board. The first **Companion** card you
play each turn fires its **Resonance**: Ignis (Pyre) ignites every enemy standing in that
lane. The lane glows while the passive is still available.

You win by reducing the enemy Commander's shared 40 HP Pact pool to zero — or, in the
Ignis trial, by playing the Rite of Binding that appears once the boss drops below 25%.

## Architecture

The single most important structural decision, taken from Module 8, is that **game logic
and presentation are strictly separated**:

```
Command ──▶ applyCommand(state, cmd) ──▶ { state, events[] }
                (instant, deterministic)         │
                                                 ▼
                                    Sequencer drains the FIFO,
                                    awaiting each animation
```

The engine resolves an action completely — including every cascade, collision and death
it triggers — before returning. It emits an ordered batch of typed events, and the
Animation Sequencer replays those events visually one step at a time. Retrofitting this
later would have meant rewriting every effect, so it exists from the first commit.

```
src/
├─ contract/    Shared types: GameEvent, RulesQuery, snapshots. The logic↔render seam.
├─ core/        PURE LOGIC — no DOM imports, enforced by its own tsconfig (no DOM lib)
│  ├─ types/    GameState, Unit, CardDef, Command
│  ├─ engine/   applyCommand reducer, turn machine, effects interpreter, damage
│  │            pipeline, movement, displacement, LoS, runes, status, targeting
│  ├─ data/     Card and rune definitions, encounter scripts
│  ├─ ai/       Enumerate → simulate → score → pick
│  └─ session.ts  CombatSession: the façade the UI drives
├─ render/      IsoCamera, BoardRenderer, placeholder art, effects
├─ anim/        Tween util and the Sequencer + event handlers
├─ hud/         DOM HUD, cards, targeting state machine
├─ sound/       WebAudio-synthesised cues (no asset files)
├─ app/         Screens and wiring
└─ tests/       Vitest suites
```

### Key design choices

**Cards are data, not code.** Every card compiles to a tree of ~12 effect primitives
(`damage`, `summon`, `attachRune`, `push`, `sacrificeTarget`, …) interpreted by one
recursive function. The AI reads the same data to enumerate its options, so the UI, the
AI, and the rules can never disagree about what is legal.

**All mutation funnels through a few choke points.** `dealDamage`, `killEntity`,
`moveEntity` and friends are the only emitters of events, which is what guarantees a new
card cannot accidentally bypass rune triggers, armor gating, Counter, or the lethal check.

**Everything is deterministic.** All randomness flows through a seeded PRNG stored in the
state; the core never calls `Math.random()`. The same seed and command sequence always
produce an identical event stream, which is what makes the AI's simulate-and-score loop
and the test suite possible.

**Previews cannot lie.** `previewAction` clones the state, dispatches the real command,
collects the resulting events, and throws the clone away. The trajectory ghost and damage
badges are showing you what will actually happen, not a parallel estimate.

**Occupancy is derived, never stored.** Board lookups scan entities through a single
footprint helper, which removes an entire class of grid-desync bugs and makes the 2×2
Behemoth rules fall out for free — a Behemoth cannot squeeze through a 1×1 gap because
the movement BFS simply finds no legal step.

### Rendering

A hybrid: **Canvas 2D** draws the isometric world (tiles, units, runes, ghosts, particles)
with hand-rolled 2:1 diamond projection, while **DOM/CSS** draws all interface chrome, so
card text stays crisp when it scales on hover. There are no image assets — every visual is
a canvas path, and units are extruded prisms on team-coloured base plates.

Free camera rotation was cut for the demo; the `rotationStep` seam remains in `IsoCamera`
so 90° rotation is a small change rather than a rewrite. A silhouette pass ensures a 2×2
Behemoth never hides a unit behind it, which is what rotation would have been for.

## Rules adjudications

The source documents contradict each other in several places. This demo resolves them as
follows, and each is asserted by a test:

| Question | Ruling | Source |
| :-- | :-- | :-- |
| Empty deck | Free reshuffle, no fatigue | Draft 7 |
| Collision damage | 3 to the displaced unit, 2 to the blocker, 3/3 vs. obstacles; Mass Invariance | Draft 7 §5.1 |
| Hand size | 7; overdraw burns the card for +1 Spark | Draft 7 + Module 4 |
| Double KO | Both revive at 1 HP, board wiped, armor purged, sudden death | Draft 7 §9 |
| Pip cap | 8, enforced only during end-of-turn cleanup | Draft 7 |
| Opening hand | 5 cards and 3 banked Pips (frontal contact), then draw 4/turn | Module 3 |
| Status tick order | Toxin → Burn → Freeze/Entangle → hazards → Escalation | Module 1 |
| Melee Commander reach | Standing in the enemy's two home rows is the whole requirement | Draft 7 §5.2 |
| Obstacles | Terrain, not allies — either side may break a pillar to open a lane | Adapted |
| Action economy | One move and one attack per turn, in either order | Mewgenics |
| Arena shape | Set per encounter, with its own terrain | Pirate101 |
| Rite of Binding | Pushes the hand limit 7→8 as an undiscardable overlay | Adapted |

Three rules were implemented because their absence caused real problems. All three are
documented in the source material, and all three are verified by tests:

- **Starting Pips (Module 3).** Without the specified 3 banked Pips, turn one was a dead
  turn with nothing affordable.
- **Opening Vanguard.** Both sides begin with a free Vanguard Footman on their front
  line, so the first turn is a tactical decision rather than a setup step and the board
  is never empty.
- **Pacifist Lockout (Module 5).** Without it, two cautious sides could trade board
  presence indefinitely and a game would never resolve. Set to six idle rounds — high
  enough that competent play will never see it, but a game can never run forever.

### Independent actions

Draft 7 §4.3's Strict Commitment rule exhausted a unit the moment it declared an attack.
That has been replaced with the Mewgenics model: **one move and one attack per turn, in
either order**. Striking and then withdrawing is now a real option, which is the single
biggest change to how a turn feels. Each action is still once per turn — movement cannot
be split around an attack.

### Arenas

Each encounter defines its own board and furniture, the way Pirate101 varies its
battleboard by area:

| Encounter | Arena | Character |
| :-- | :-- | :-- |
| Wandering Novice Duelist | 6 × 8 | A narrow lane. Four neutral rows means closing the distance costs turns. |
| Subjugation Trial: Ignis | 8 × 8 | An open arena with room to circle the drake and its Behemoth. |

Terrain comes in two kinds. **Rubble walls** block movement and sight. **Bramble
screens** are cover: they block sight but *not* movement, so units may stand in them and
ranged attackers have to reposition rather than shoot over. Both are destructible by
either side.

Deeper boards are what make the danger zone meaningful. On the old compact grid a Scout
Imp could reach every tile on the board in one turn, so the overlay was a uniform red
wash. On the lane map your two home rows are genuinely safe and everything past row 5 is
contested, which turns stepping forward into a decision.

### Difficulty

Two AI tiers, chosen on the title screen and remembered between sessions.

| Tier | Behaviour |
| :-- | :-- |
| **Novice** | Greedy: takes the best action available right now. Visibly misjudges the order of its own actions — it will walk a unit out of range before remembering it could have swung first. |
| **Adept** | Values a candidate opener by the whole turn it leads to, so it strikes before it withdraws. Also sees collisions, and is far less prone to a deliberate mistake (5% vs 20%). |

Both run inside Module 5's 1.2s thinking cap, enforced by a latching budget that degrades
Adept to greedy mid-turn rather than letting a turn hang. Measured worst case on the
largest arena: ~1.2s; typical enemy turn ~300ms.

Adept is measurably harder where the matchup has headroom — against a fixed scripted
opponent on the Ignis trial it wins **18/20** against Novice's 12/20, and leaves that
opponent on 3.5 HP rather than 10.9.

### Deck building

Your collection grows by winning: each victory offers a choice of three cards. Decks are
built per companion and persist between sessions.

| Rule | Value | Source |
| :-- | :-- | :-- |
| Deck size | 12–30 cards | Draft 7 §10 |
| Copies allowed | Tier 1 → 3, Tier 2 → 2, Tier 3 → 1 | Draft 7 §10 |
| Behemoths | At most 2 per deck | Module 2 |

Copy limits are tracked by **base card id**, so a future Ascension printing a Rank 2
variant cannot double the allowance through the back door. Tier is *derived* from what a
card does — Power Tier keyword, 2×2 footprint, or cost — rather than hand-listed, so a new
card cannot be added without one and silently gain an unlimited copy count.

The builder enforces rules as affordances: a card you cannot add more of is visibly spent
before you click it, and the Save button explains exactly what is wrong when it refuses
("10 cards — the minimum is 12. Add 2 more.").

Saves are versioned from the first write, with a migration that re-reads card data from
the master registry rather than trusting the save (Module 8). A deck invalidated by a
patch is **flagged, not silently repaired** — you see what changed and fix it yourself.
The baseline Hero cards are permanent soulbound assets (Module 4), enforced in the
collection model, so no corrupted save can strand you without a legal deck.

### Elemental reactions

Damage of one school landing on the status of another produces something neither would
alone (Module 1 §4). The table lives in `core/data/reactions.ts` and is evaluated inside
`dealDamage`, the same choke point runes pass through, so no card can bypass it:

| Reaction | Trigger | Result |
| :-- | :-- | :-- |
| **Vaporize** | Fire on a **Chilled** target | Fog fills the tile for 2 turns, blocking ranged sight |
| **Shatter** | A physical hit or collision on a **Frozen** target | Strips 100% Armor, 4 shrapnel to adjacent |
| **Wildfire** | Fire on a **Toxined** target | Consumes every stack for 2 damage per stack, all around |

Reactions inherit the rune armor gate — a blow entirely absorbed changes nothing — with
one deliberate exception. **Shatter ignores it**, because requiring HP loss would mean
armor prevented the one reaction whose entire purpose is removing armor, and a heavily
armoured frozen target could never be broken. That exception is a `requiresHpLoss` flag
on the reaction, not a special case in the engine.

Frost supplies the setup half: **Chill** stacks toward a Freeze on the third stack, and
**Brittle** makes the target take +2 from everything.

### Companions

Two are playable, chosen before a run. The Hero half of the deck is shared; the Companion
decides the other half and the Resonance passive.

| Companion | School | Plays like |
| :-- | :-- | :-- |
| **Ignis**, Ember Drake | Pyre | Runes and cascades. *Ember Watch* ignites its lane. |
| **Boreas**, Frost Bear | Frost | Control — chill, freeze, break. *Rime Guard* armours your Hero. |

### Companion Resonance

The Hero/Companion split is more than a card-pool label. The Companion stands at a fixed
column beside the board, and the first Companion card played each turn fires that
school's passive in its lane (Module 1 §3). Pyre ignites, Frost armors, Dusk drains. Once
per turn, so a multi-card turn cannot spiral.

## Testing

```bash
npm test
```

123 tests covering collision splits and Mass Invariance, rune cascades and the armor
gate that stops them, fizzle rules, line of sight and Guardian occlusion, the turn and
resource machine, escalation caps, movement commitment, boss phase gates and the Rite of
Binding, Resonance firing once per turn in the right lane, AI lethal-taking and the
Lethal Veto, isometric projection round-trips, balance sanity (every encounter reaches a
decision across many seeds), and an edge-case suite: Behemoths with nowhere legal to
land, a full territory, Cataclysmic Core with no runes to detonate, corner shoves,
Counter killing its attacker, an empty deck *and* discard, runes on destroyed obstacles,
and a unit killed by its own cascade. Threat projection has its own suite: reach scales
with movement, held units project nothing, converging attackers stack their damage, and
walls stop ranged projection. A **determinism harness** replays recorded games from
their seed and asserts an identical event stream and state hash — including through boss
phase transitions — and a **fuzz soak** drives random legal commands across two dozen
games, checking engine invariants after every single one (no negative HP, no shared
tiles, no orphaned cards, no pip overflow after cleanup).

## What is deliberately not here

The overworld, deck builder, economy, crafting, ascension, the other three continents,
and five of the seven elemental schools. The demo ships the Pyre / Dusk / Arcane starter
deck from Draft 7 §10 — fifteen cards that between them exercise every core system:
summoning, a 2×2 Behemoth, displacement and collisions, rune attachment, cascading
detonations, sacrifice economy, obstacles, persistent armor, and a global finisher.
