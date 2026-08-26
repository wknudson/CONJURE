# CONJURE — Playable Combat Demo

A browser-playable vertical slice of **CONJURE**, the tactical grid card battler specced
in `docs/`. It covers the demo's first three phases: the combat sandbox, collision
physics / line of sight / marks, and a full encounter loop against an AI opponent —
including the Ignis Subjugation Trial.

## The documentation

`docs/` is the design record, and it is the only one — where it and this README disagree,
`docs/` wins; where either disagrees with `src/`, **the code wins**.

| Doc | What it settles |
| :-- | :-- |
| [01 — System Architecture](docs/01_system_architecture.md) | The logic/visual seam, the save schema and its migrations, determinism |
| [02 — Combat Lexicon](docs/02_combat_lexicon.md) | Every rule, keyword, status, damage type and reaction. The canonical rules reference |
| [03 — The RPG Sandbox](docs/03_rpg_sandbox.md) | The Safehouse, the Bounty Board, taming and trait bloodlines |
| [04 — Sandbox Audit & Ideation](docs/04_sandbox_audit_and_ideation.md) | A closed audit, kept as a record, plus a live design backlog |
| [05 — The Ironworks Artificer](docs/05_ironworks_artificer.md) | The Forge: schematics, ascension, splicing, the Clinic |
| [06 — Character Creation](docs/06_character_creation.md) | The Applicant, the Vow, and what a new character is handed |
| [07 — Deck Building](docs/07_deck_building.md) | Hero Deck size, tiers and copy limits, the Grimoire draft, the roster budget |
| [08 — Card Catalog](docs/08_card_catalog.md) | Every card in the game. **Generated** — run `npm run cards:catalog` |
| [09 — Enemy AI and Encounters](docs/09_ai_and_encounters.md) | The utility matrix and its weights, difficulty tiers, failsafes, the encounters |
| [10 — Presentation](docs/10_presentation.md) | Board and camera, readability, the HUD, art direction, sound |
| [Combat Overhaul](docs/combat_overhaul_vanguard_and_escalate.md) | Why the Vanguard Roster and the Aura/Growth split happened. Shipped; kept as the record |

Alongside them, [`ROADMAP.md`](ROADMAP.md) is where the project stands and what is next,
and [`COMBAT_FEEL.md`](COMBAT_FEEL.md) is the combat-experience plan.

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

Four encounters ship (`core/data/encounters/index.ts`), taken on as contracts from the
Safehouse's Bounty Board rather than picked off the title screen: the **Wandering Novice
Duelist** (a straight fight), the **Narrow Ruin** (a corridor that punishes standing
still), the **Glacial Field** (an open board where nothing can see far), and the
**Subjugation Trial: Ignis** (a two-phase boss you can bind rather than kill). Each brings
its own arena and furniture, and both sides open with a free Vanguard Footman already on
the field.

- **Click a card**, then **click a highlighted tile** to play it.
- **Click your own unit** to see its legal moves (cyan) and attacks (red), then click a
  destination or target.
- **A Commander cannot be attacked.** Neither yours nor theirs. Every Commander fields a
  Companion, and that Bound Form is the Pact's body on the grid — break it and the health
  bar above it drops. There is no way around the board to the face.
- Hold **Shift** to expand damage predictions across every affected tile.
- **T** toggles the danger zone — every tile the enemy could strike next turn.
- A unit gets **one move and one attack** each turn, in either order, so it can strike
  and then withdraw.
- **Z** takes back your last move. Attacks and card plays are final.
- **Tab** jumps to the next unit that can still act.
- **Q** and **E** turn the board a quarter-turn, to see behind a Behemoth or a wall.
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
**ABILITY**, **MARK**, or **OBSTACLE** — and who casts it, **HERO** or **COMPANION**.

Your Companion stands in a marked lane beside the board. The first **Companion** card you
play each turn fires its **Resonance**: Ignis (Pyre) ignites every enemy standing in that
lane. The lane glows while the passive is still available.

You win by reducing the enemy Commander's shared 400 HP Pact pool to zero — or, in the
Ignis trial, by playing the Rite of Subjugation that appears once the boss drops below
25%.

## Architecture

The single most important structural decision, recorded in
`docs/01_system_architecture.md` §1, is that **game logic and presentation are strictly
separated**:

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
│  │            pipeline, movement, displacement, LoS, marks, status, targeting
│  ├─ data/     Card and Mark definitions, encounter scripts
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

**Cards are data, not code.** Every card compiles to a tree of 25 effect primitives
(`damage`, `summon`, `attachMark`, `push`, `tithe`, …) interpreted by one
recursive function. The AI reads the same data to enumerate its options, so the UI, the
AI, and the rules can never disagree about what is legal.

**All mutation funnels through a few choke points.** `dealDamage`, `killEntity`,
`moveEntity` and friends are the only emitters of events, which is what guarantees a new
card cannot accidentally bypass Mark triggers, armor gating, Counter, or the lethal check.

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

A hybrid: **Canvas 2D** draws the isometric world (tiles, units, marks, ghosts, particles)
with hand-rolled 2:1 diamond projection, while **DOM/CSS** draws all interface chrome, so
card text stays crisp when it scales on hover. On the board every visual is a canvas path,
and units are extruded prisms on team-coloured base plates.

The one exception is **character creation**, which stands the Commander and the six Companions
on its diorama as authored PNG sprites out of `public/assets/sprites/` — the only image assets
in the project. The board has not caught up, so the two currently draw a body differently; see
`docs/06_character_creation.md` §4 and §9.

The board turns in 90° steps. The *logical* orientation flips instantly, so depth sorting
and tile picking never see an in-between state; what animates is the drawing, which spins
the finished image about the board centre. An isometric diamond is a squashed square, so
the renderer un-squashes before rotating and re-squashes after — rotating the projected
shape directly would skew it into a parallelogram.

Enabling it surfaced a latent bug in the projection: `rot` reflects *continuous points*
and must mirror about the board extent, while `unrot` reflects *tile indices* and must
mirror about the last index. Using one constant for both put every pick one tile out at
90° and 270°. A test round-trips every tile at all four steps.

## Rules adjudications

The design record contradicted itself in several places. This demo resolves them as
follows, and each is asserted by a test:

| Question | Ruling | Source |
| :-- | :-- | :-- |
| Empty deck | Free reshuffle, no fatigue | `docs/02_combat_lexicon.md` §6 |
| Collision damage | 30 to the displaced unit, 20 to the blocker, 30/30 vs. obstacles; Mass Invariance | `docs/02_combat_lexicon.md` §7 + `core/engine/displacement.ts` |
| Hand size | 7; overdraw burns the card for +1 Marrow | `docs/02_combat_lexicon.md` §6 + `core/engine/deck.ts` |
| Double KO | Both revive at 10 HP, board wiped, armor purged, sudden death | `docs/02_combat_lexicon.md` §11 + `core/engine/death.ts` |
| Pip cap | 8, enforced only during end-of-turn cleanup | `docs/02_combat_lexicon.md` §2 + `core/engine/deck.ts` |
| Opening hand | 5 cards and 3 banked Pips (frontal contact), then draw 4/turn | `core/engine/setup.ts` + `core/engine/deck.ts` |
| Status tick order | Toxin → Burn → Freeze/Entangle → hazards → Growth | `docs/02_combat_lexicon.md` §8 |
| Reaching a Commander | Only through their Companion's Bound Form; no attack may name a portrait | `docs/02_combat_lexicon.md` §3 |
| Obstacles | Terrain, not allies — either side may break a pillar to open a lane | Adapted |
| Action economy | One move and one attack per turn, in either order | Mewgenics |
| Arena shape | Set per encounter, with its own terrain | Pirate101 |
| Rite of Subjugation | Dealt on top of the draw pile, not smuggled into a full hand as an over-limit overlay | `docs/02_combat_lexicon.md` §11 + `core/engine/subjugation.ts` |

Three rules were implemented because their absence caused real problems. All three are
documented in the design record, and all three are verified by tests:

- **Starting Pips (`core/engine/setup.ts`).** Without the specified 3 banked Pips, turn
  one was a dead turn with nothing affordable.
- **Opening Vanguard.** Both sides begin with a free Vanguard Footman on their front
  line, so the first turn is a tactical decision rather than a setup step and the board
  is never empty.
- **Pacifist Lockout (`docs/09_ai_and_encounters.md` §5).** Without it, two cautious
  sides could trade board presence indefinitely and a game would never resolve. Set to
  six idle rounds — high enough that competent play will never see it, but a game can
  never run forever.

### Independent actions

The original Strict Commitment rule exhausted a unit the moment it declared an attack.
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
| The Narrow Ruin | 4 × 6 | A corridor with no flank. A gale down its length, a turret at the end, and a moving floor on one side. |
| Open Glacial Field | 8 × 8 | The widest board, under fog that blinds it. Pillars, crystals, and wolves that arrive uninvited. |
| Subjugation Trial: Ignis | 8 × 8 | An open arena with room to circle the drake — until it grows. |

Terrain comes in two kinds. **Rubble walls** block movement and sight. **Bramble
screens** are cover: they block sight but *not* movement, so units may stand in them and
ranged attackers have to reposition rather than shoot over. Both are destructible by
either side.

Deeper boards are what make the danger zone meaningful. On the old compact grid a Scout
Imp could reach every tile on the board in one turn, so the overlay was a uniform red
wash. On the lane map your two home rows are genuinely safe and everything past row 5 is
contested, which turns stepping forward into a decision.

Arenas may be anywhere from 4×4 to 12×12, square or not, and `createCombat` refuses
anything outside that or with furniture parked in a deployment zone — these are authoring
mistakes in hand-written data, so they fail loudly at construction rather than producing a
subtly wrong game. Territory depth is derived rather than fixed: two rows per side
normally, one on a board five rows or shorter, since two-deep territories on a four-row
board would consume the whole map and leave no neutral ground to fight over.

### The economy

Three ways to find resources when the hand is bad, because a turn spent passing is a
turn the game did not ask you anything.

**Channel** (`C`) spends a unit's attack to extract Marrow. It keeps its move, so this is a
use for the swing rather than exhaustion. **Reactions pay a Pip back** — capped at two a
turn, which is the whole design: without the cap a three-reaction cascade funds the card
that caused it. **Marrow Geodes** are 10 HP and worth two Marrow, scattered only on neutral
ground, so taking one means walking somewhere you would rather not stand yet.

If play still feels starved, the fail-safe is one token: `gainPips(ctx, side, 1)` in
`turn.ts` is the game's only income, and the line says so.

### Fighting at a distance

Reach on a large board is simply strength unless it costs something specific, so each
archetype buys its range with a weakness you can see and play around.

| Unit | Reach | Bought with |
| :-- | :-- | :-- |
| **Longshot Stalker** | Any distance, straight lines only | One sidestep is a complete defence; anything on the line eats the shot |
| **Cinder Lobber** | 2–4, ignores line of sight entirely | Cannot hit what is adjacent — walking into its face beats it |
| **Arc Turret** | 5, hits hardest | Never moves, so where it lands is the whole decision |

The profiles are the whole of what reach buys, because there is nothing off the board to
shoot at. A Commander is reached through their Companion's body, which stands on the grid
like anything else — so a marksman's line and a mortar's blind spot price the game-ending
shot exactly as they price every other one.

### The ground itself

**Rubble** is what a broken wall leaves: rough ground costing double to cross, so
demolition opens a route without making it a fast one. **Volatile crystals** freeze or
burn everything in the nine tiles around them, including whoever broke them — the question
is never "should I shoot it" but "who is standing there". **Conveyor currents** carry
whatever stands on them one tile at the end of each round, both armies alike, and a
current running into a wall is a weapon.

### Weather

Chosen per encounter and named before the deck is locked, because it changes which cards
are worth bringing.

- **Dense fog** clamps everything to three tiles — units, spells, and the Commander alike.
  Snipers are humbled; a mortar still cannot shell what nobody can see.
- **A gale** carries ranged attacks further downwind and makes them fall short into it.
  Melee is untouched, and so is sorcery: it bends arrows, not spells.
- **Torrential rain** blunts fire before armor is considered, so a burn in a downpour is
  genuinely weaker. A Pyre unit's swing is physical and stays dry.

### Wildlife

Some things on the board belong to nobody. A **Ridge Wolf** hunts whatever is nearest
without consulting sides, and either army may put it down — so shoving an enemy into its
path is as good as striking them yourself. A **Gilded Scavenger** never fights, runs for
the edge, and leaves with its purse if ignored long enough; it departs by escaping rather
than dying, because nothing killed it and nobody is owed the kill.

They are filed under the enemy for bookkeeping only. Nothing treats them as allies: not
targeting, not the blood tithe, not the AI, not the threat map.

### Before the fight

Choosing an encounter opens a plan of the ground before combat starts: a flat overhead
map — not the isometric view, because from directly above the distances are honest and the
shape is obvious — with both territories, terrain, and the enemy's opening position.

One card may then be swapped from your collection. The budget is small deliberately:
adapting should mean bringing the one answer a shape needs, not rebuilding into a
different deck once the terrain is known. Pressing **Ready** fixes the
deck and generates the combat seed, which is recorded alongside the encounter and the
adapted deck so the same battle can be replayed or reported later — and so **Rematch**
means the same fight rather than a new one.

### Turn flow

Positioning is where a tactical mistake is cheapest to make and most annoying to live
with, so **movement is reversible** until something irreversible happens. Undo is a client
convenience rather than a game action: it stores whole-state snapshots on the screen
component, emits nothing, and never enters the event stream. Because a snapshot carries
the RNG state, rewinding rewinds the seeded stream too — the game continues along exactly
the branch it would have taken had the move never happened.

**End Turn says what passing would cost** — *"End Turn (1 unit, 5 cards left)"* — and asks
for a second click. With nothing unspent it passes on the first click, because nagging a
player who has already done everything is its own kind of friction. Any other action
resets it.

### Enemy intent

The enemy commits, at the end of its turn, to what it will do next — and then does it.
Declared blows are drawn on the board with their damage on them; a blow aimed at your Pact
draws a line to your Hero and totals into the HUD.

Two rules make the telegraph worth trusting:

- **A declared blow lands on the tile, not the target.** Move the victim away and the
  attack hits empty ground — or whatever is standing there now, including one of the
  enemy's own units. That is the reward for reading it.
- **What is declared is what happens.** The enemy does not re-plan on its turn. If it
  could, the telegraph would be a suggestion rather than a promise.

This is what turns the rest of the game into tools. A shove stops being chip damage and
becomes "push the attacker off its firing line"; a Barricade becomes a body-block; Freeze
becomes "cancel that specific hit".

How much is declared is a difficulty setting, not a constant.

### Difficulty

Two AI tiers, chosen on the title screen and remembered between sessions.

| Tier | Behaviour |
| :-- | :-- |
| **Novice** | Greedy: takes the best action available right now. Visibly misjudges the order of its own actions — it will walk a unit out of range before remembering it could have swung first. Declares its entire turn. |
| **Adept** | Values a candidate opener by the whole turn it leads to, so it strikes before it withdraws. Also sees collisions, and is far less prone to a deliberate mistake (5% vs 20%). Declares only its blows, keeping its cards hidden. |

Thinking is bounded by a **simulation count**, not a clock. An earlier version used wall
time, which made the AI's choices depend on how busy the machine was — the same seed
produced different games, and the replay harness caught it immediately. Anything that
changes a decision has to be deterministic; a clock survives only as an anti-hang backstop
that normal play never reaches. Typical enemy turn ~220ms, worst case ~2s on the largest
arena, with the turn banner up throughout.

Adept is measurably harder where the matchup has headroom — against a fixed scripted
opponent on the Ignis trial it won **18/20** against Novice's 12/20.

> The margin that accompanied those win rates ("leaves the opponent on 3.5 HP rather than
> 10.9") was measured before the Stat Stretch and is not restated here, because nothing
> asserts it. It wants re-running rather than multiplying by ten.

### Deck building

Your collection grows by winning: each victory offers a choice of three cards. Decks are
built per companion and persist between sessions.

| Rule | Value | Source |
| :-- | :-- | :-- |
| Hero Deck size | 4–12 cards | `docs/07_deck_building.md` §1 |
| Copies allowed | Tier 1 → 3, Tier 2 → 2, Tier 3 → 1 | `docs/07_deck_building.md` §1 |
| Behemoths | At most 2 per deck | `core/data/deckRules.ts` |

Copy limits are tracked by **base card id**, so a future Ascension printing a Rank 2
variant cannot double the allowance through the back door. Tier is *derived* from what a
card does — Power Tier keyword, 2×2 footprint, or cost — rather than hand-listed, so a new
card cannot be added without one and silently gain an unlimited copy count.

The builder enforces rules as affordances: a card you cannot add more of is visibly spent
before you click it, and the Save button explains exactly what is wrong when it refuses
("3 cards — the minimum is 4. Add 1 more.").

Saves are versioned from the first write, with a migration that re-reads card data from
the master registry rather than trusting the save (`docs/01_system_architecture.md` §2).
A deck invalidated by a patch is **flagged, not silently repaired** — you see what changed
and fix it yourself. The baseline Hero cards are permanent soulbound assets
(`docs/05_ironworks_artificer.md`), enforced in the collection model, so no corrupted save
can strand you without a legal deck.

### Elemental reactions

Damage of one school landing on the status of another produces something neither would
alone (`docs/02_combat_lexicon.md` §9). The table lives in `core/data/reactions.ts` and is
evaluated inside `dealDamage`, the same choke point Marks pass through, so no card can
bypass it:

All six:

| Reaction | Trigger | Result |
| :-- | :-- | :-- |
| **Vaporize** | Fire on a **Chilled** target | 20 damage through armor, and the tile fogs for a turn, blocking ranged sight |
| **Shatter** | A physical hit or collision on a **Frozen** target | Strips all Armor, 40 shrapnel to adjacent |
| **Overload** | Fire into a **Charged** target | 10 damage through armor, and everything adjacent is thrown a tile away, taking collision damage if it lands on something |
| **Superconduct** | Frost through a **Charged** target | Conducts past the plate: all Armor stripped, and the target is left Brittle |
| **Arc** | Surge damage **in the rain** | Earths itself through everything touching the target: 10 damage to every adjacent unit, whoever it belongs to |
| **Wildfire** | Fire on a **Toxined** target | Consumes every stack for 20 fire damage per stack, all around |

Each reads differently on the board without needing its label: Shatter throws oriented ice
slivers under a sharp shake, Vaporize blooms a lingering cloud with no shake at all, and
Wildfire's embers cross from green to orange as the fire front outruns them.

Arc is the odd one out — it gates on the **weather** rather than on a status, and no
shipped encounter is fought in rain, so it is tested and currently unreachable in play.
`elements.test.ts` holds that in a `KNOWN_UNREACHABLE` ledger rather than leaving it to be
rediscovered.

Reactions inherit the Mark armor gate — a blow entirely absorbed changes nothing — with
one deliberate exception. **Shatter ignores it**, because requiring HP loss would mean
armor prevented the one reaction whose entire purpose is removing armor, and a heavily
armoured frozen target could never be broken. That exception is a `requiresHpLoss` flag
on the reaction, not a special case in the engine.

Frost supplies the setup half: **Chill** stacks toward a Freeze on the third stack, and
**Brittle** makes the target take +20 from everything.

### Companions

**Six bloodlines are playable** — one per elemental school — and you vow to one at
character creation (`starterSpecies()`, asserted at six by `creation.test.ts`). The Hero
half of the deck is shared; the Companion decides the other half, the Resonance passive,
and the body that stands on the board.

| Companion | School | On the board | Resonance |
| :-- | :-- | :-- | :-- |
| **Ignis**, Ember Drake | Pyre | 30 ATK, melee, MOV 2 | *Ember Watch* — ignites its lane |
| **Boreas**, Frost Bear | Frost | 20 ATK, reach 3, MOV 2 | *Rime Guard* — armours your Hero |
| **Voltara**, Storm Lynx | Surge | 20 ATK, reach 2, MOV 3 | *Storm Tithe* — refunds a Pip |
| **Mortis**, Carrion Stag | Dusk | 20 ATK, melee, MOV 2 | *Grave Tithe* — drains the weakest enemy |
| **Sylva**, Thorn Warden | Bloom | 10 ATK, reach 3, MOV 2 | *Verdant Growth* — returns health to the Pact |
| **Ferrum**, Vault Boar | Bulwark | 20 ATK, melee, MOV 1 | *Shield Oath* — plates your units |

Their stat lines follow their magic: Ignis fights at arm's length, where its shorter spells
want it anyway; Boreas and Sylva hold a longer sightline, which is what reach is for; and
Ferrum trades all its movement for being immovable.

**Lexis**, the Ink Owl, exists and is not on that list. Its school is arcane — the Hero
Deck's own colour, which is not a discipline anybody enrols in — so it is a Companion you
can meet rather than one you can start beside.

### The Companion on the board

The Companion is a physical unit, deployed in its own lane on your back row and moving and
attacking like any other. The Hero remains off-grid as the Architect.

It carries **Bound Form**, which makes it the Pact's body: it keeps no health of its own,
and every wound it takes — a strike, a spell, a burn tick, a shove into a wall — is dealt
straight to your shared 400 HP pool. It cannot be bled for a blood tithe, cannot be given
a Mark (one attached to it could never detonate), and never Grows. Cards that would do those
things simply do not offer it as a target rather than being wasted on it.

That body is the **only** route to your Pact, and the HUD treats it as one: a declared blow
on the Companion counts as incoming Pact damage in the forecast, and a foe that can reach it
is flagged as a threat to your Commander.

**The enemy fights the same way.** Every Commander fields a Companion — their spells are
cast from it, their Pact bleeds when it is struck, and shoving it into a wall costs them
what it would cost you. Their portrait is not attackable, and neither is yours: the symmetry
is that *neither* Hero is a target, and the fight is decided by the two bodies standing
between them.

That also means a blow at a Pact is always committed to a *tile*, so moving the body makes
it miss. There is no undodgeable swing at a face any more — the defender always has the
option, on both sides.

The Ignis Trial goes further: the drake **is** the unit. At half health it grows into a
2×2 enraged form that hits harder, moves slower, and blocks line of sight through itself —
so the arena's lanes are redrawn by the transformation alone, and every declared intent is
cleared with it. Not every enemy has a body; the Ruin Warden commands wholly from off the
board, as all of them once did.

### Origin casting

Who throws a card decides where it is thrown from. **Hero** cards are cast from off the
board and reach all of it. **Companion** cards are thrown by the Companion, so they reach
only as far as it can stretch and see from where it stands:

| Card | Reach | Needs a line |
| :-- | :-- | :-- |
| Rime Touch | 2 | yes |
| Frost Nova | 3 | yes |
| Cinder Mark, Flame Surge, Flash Freeze | 4 | yes |
| Soul Splinter Mark | 4 | no — marking your own is closeness, not aim |
| Glacial Spike | 5 | yes |

Cataclysmic Core stays board-wide, and the Rite of Subjugation is never range-gated: it is a
win condition, not a spell.

Aiming a Companion card marks the tile it is cast from and shades what that origin cannot
see, so the answer to "why is that tile not offered?" is visible rather than inferred —
and moving the Companion is the obvious fix. Walking it forward to line up a shot is a
real decision, because the further forward it stands, the easier it is to hurt, and its
wounds are yours.

A side that has no Bound Form — every enemy today — casts globally, exactly as before.

### Companion Resonance

The Hero/Companion split is more than a card-pool label. The first Companion card played
each turn fires that school's passive in the Companion's lane
(`docs/02_combat_lexicon.md` §3). Pyre ignites,
Frost armors, Dusk drains. Once per turn, so a multi-card turn cannot spiral.

## Testing

```bash
npm test
```

1,591 tests across 88 files, covering collision splits and Mass Invariance, Mark cascades
and the armor gate that stops them, fizzle rules, line of sight and Guardian occlusion,
the turn and resource machine, Growth caps, movement commitment, boss phase gates and the
Rite of Subjugation, Resonance firing once per turn in the right lane, AI lethal-taking
and the Lethal Veto, isometric projection round-trips, balance sanity (every encounter
reaches a decision across many seeds), and an edge-case suite: Behemoths with nowhere
legal to land, a full territory, Cataclysmic Core with no Marks to detonate, corner
shoves, Counter killing its attacker, an empty deck *and* discard, Marks on destroyed
obstacles, and a unit killed by its own cascade. Threat projection has its own suite: reach scales
with movement, held units project nothing, converging attackers stack their damage, and
walls stop ranged projection. A **determinism harness** replays recorded games from
their seed and asserts an identical event stream and state hash — including through boss
phase transitions — and a **fuzz soak** drives random legal commands across two dozen
games, checking engine invariants after every single one (no negative HP, no shared
tiles, no orphaned cards, no pip overflow after cleanup, at most one Bound Form per side
and never one that lost health of its own).

Three suites guard the pivot specifically. **Bound Form** proves every route to the Pact —
strikes, burn ticks, shoves into walls — and every refusal: the blood tithe, Mark
attachment, warding, Growth. **Spell origin** pins range boundaries at exactly N and N+1, walls
breaking a Companion's line while a Hero card ignores the same wall, and the case that
would quietly break the enemy AI: a side with no body must still cast. **Grid bounds**
opens 4×4 and 4×7 arenas, runs AI turns in them, and checks that the camera's rotation
round-trips on a non-square board — the one place where reflecting about the board extent
and about the last tile index differ, which is invisible until a click lands a tile out.

## What is deliberately not here

The continent system, and the three continents that would hang off it: `ignis_trial` is
the only boss, with an `EncounterScript` seam where the rest would go
(`docs/09_ai_and_encounters.md` §6).

Most of the rest of this list has since arrived — the overworld and its Vivarium roster,
the Ironworks forge with Ascension and Splicing (`docs/05_ironworks_artificer.md`), and
cards in all seven schools. A new character is handed a **seven-card** Hero Deck of
colourless staples — a strike, a shove, a wall, a ward, a tithe, a beam and a finisher —
which the Companion's eight-spell Grimoire fuses to fifteen at the bell
(`core/data/cards/starter.ts`, `docs/07_deck_building.md` §4). The catalog behind it is
214 base cards (`docs/08_card_catalog.md`), and between them they exercise every core
system: summoning, a 2×2 Behemoth, displacement and collisions, Mark attachment, cascading
detonations, the blood tithe economy, obstacles, persistent armor, and a global finisher.
