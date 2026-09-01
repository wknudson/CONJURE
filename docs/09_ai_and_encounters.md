# 09 — Enemy AI and Encounters

This is the specification of record for the thing on the other side of the board. Every
weight, cap, threshold and failsafe below is mirrored in `src/core/ai/` — the utility
matrix in `src/core/ai/score.ts`, the turn loop and the difficulty tiers in
`src/core/ai/controller.ts`, the candidate list in `src/core/ai/enumerate.ts` — and the
constant that holds each number is named so you can go and read it.

The AI has no script. There is no attack table, no "boss pattern", no phase-two routine
that plays itself. There is one function that puts a price on a board, and a loop that
buys the most board it can afford. Everything the enemy appears to *know* — that a
Guardian is worth killing first, that a mortar should stop short of its own blind spot,
that a sealed Alpha must break the tether and nothing else — is a line in a weight table.

**Where an older design document and the code disagree, the code is what this document
says.** §8 is the ledger of those disagreements, kept because a superseded rule is
worth recording once rather than rediscovering twice.

---

## 1. The Utility Matrix

Every candidate action is simulated through the real reducer and then priced. The
composite is:

```
U(a) = w_kill·S_kill + w_face·S_face + w_threat·S_threat
     + w_pos·S_pos + w_eff·S_eff − w_risk·S_risk
```

The important word is **simulated**. `scoreAction` calls `applyCommand` and reads the
score off the resulting **event batch** — counting `unitDied`, `collision`, `damageDealt`,
`armorGained`, `markAttached` — rather than re-deriving the rules from the board.

> **The AI never has a second opinion about what the rules do.** Re-deriving a collision
> or a cascade in the scorer would be two implementations of one fact, and the copy nobody
> plays through is always the copy that drifts. An illegal command is caught and dropped
> silently instead — `scoreAction` wraps the call in a `try` and returns `undefined` — so a
> mis-enumerated candidate costs a simulation and nothing else.

### The weights

`NOVICE_WEIGHTS` in `src/core/ai/score.ts`. `ADEPT_WEIGHTS` spreads it and changes two
fields, and they are named in the Adept row.

| Weight | Novice | Adept | Priced per |
|---|---|---|---|
| `kill` | **50** | — | enemy unit removed |
| `killPerEscalation` | **10** | — | Growth stack the victim had taken |
| `markHolderKill` | **40** | — | victim was carrying a Mark |
| `guardianKill` | **60** | — | victim had **Guardian** |
| `face` | **15** | — | old point of commander health |
| `faceDampenedByEscalation` | **0.2** | — | multiplier, while the foe has grown bodies |
| `unitDamage` | **2** | — | old point knocked off a unit without killing it |
| `collision` | **0** | **45** | `collision` event |
| `advance` | **3** | — | row gained toward the enemy |
| `firingPosition` | **8** | — | ending a move somewhere the unit can actually shoot from |
| `pursue` | **6** | — | tile closed on the nearest hostile body, when nothing is in reach |
| `armorChip` | **0.5** | — | fraction of a point credited for stripping armor rather than health |
| `retreat` | **2.5** | **3.5** | old point of incoming damage stepped out of |
| `extraction` | **3.5** | — | Marrow pried out of a Geode — priced above a plain advance, below a real swing |
| `retreatSurvival` | **0.5** | — | fraction of `kill` for leaving lethal range |
| `developAtk` | **4** | — | old point of Attack summoned |
| `developHp` | **1.5** | — | old point of Health summoned |
| `armorValue` | **1.5** | — | old point of Armor gained |
| `markSetup` | **12** | — | Mark attached (halved on one of its own units) |
| `statusValue` | **2** | — | stack of a debuff landed on a foe; the same, negated, for one landed on its own |
| `auraValue` | **8** | — | Elemental Aura attached to one of its own bodies |
| `marrowEfficiency` | **10** | — | Marrow actually spent |
| `channelValue` | **6** | — | Marrow extracted by channelling |
| `counterRisk` | **12** | — | old point taken from a **Counter** |
| `friendlyCollateral` | **15** | — | own unit lost by accident |

### Health is divided; ground is not

Health, damage, healing and armour are all authored ten times larger than they read
(`STAT_SCALE = 10`, `src/core/scale.ts`). The weight table is **not**. It is written in
*old* points, and `hpPoints()` divides at the seven places health enters the score.

This is deliberate and the alternative was tried: dividing the whole table by ten makes
every entry a decimal fraction of a tile of ground, which cannot be tuned by eye against
`advance` or `collision` — neither of which stretched, and neither of which ever will.
Left undone the other way, a single 30-damage swing would outweigh every positional term
in the matrix combined, and the AI would walk into any trap that let it land one.

The division is **not rounded**. A utility is a comparison, never a display, and rounding
a chip hit down to zero would score two genuinely different lines identically.

### Lethal, and the Veto

```
LETHAL_SCORE       = 10_000
ANCHOR_KILL_SCORE  = 20_000
```

If the simulated command ends the fight, the score short-circuits: `LETHAL_SCORE` if the
AI won it, **negative infinity** if it did not. That second branch is the **Lethal Veto**,
and it is the whole of it — a chain cascade that would kill the AI's own commander without
guaranteeing the player falls first prices itself out of consideration entirely, and
`scoreAll` then discards it for failing `Number.isFinite`.

Two ranks sit above the ordinary matrix, and the order is load-bearing:

| Term | Value | Why it is where it is |
|---|---|---|
| `ANCHOR_KILL_SCORE` | 20,000 | Killing the anchor ends a subjugation in the beast's favour. It is the only thing a sealed Alpha can do, so nothing may outrank it |
| `LETHAL_SCORE` | 10,000 | Taking the game |
| `ANCHOR_CHIP` | 60 | per old point taken off the anchor — progress toward the above |
| `ANCHOR_APPROACH` | 40 | per tile closed on the anchor, by `footprintDistance` so a 2×2 is judged by its nearest cell |

**The Harpoon term is a weight, not a second planner.** While a tether is live the beast
still has to path, still has to respect reach, still must not walk into a wall — all of
which the matrix already does. What a subjugation changes is only *what the board is
worth*, and that is exactly what scoring is for. Everything else still scores underneath
at its usual magnitude, so between two lines that make identical progress on the tether
the beast still prefers the one that also kills a blocker. It simply cannot prefer a face
hit, because a face hit cannot win a fight it is sealed out of.

### Two terms that exist only because their absence was a bug

**`unitDamage`.** Without it a hit that fails to kill scores exactly nothing, and the AI
declines free swings — softening a unit only by accident, on the way to something else.

**`developAtk` / `developHp`.** Without them summoning scores exactly zero and the enemy
never builds a board at all.

**`statusValue` / `auraValue`.** Without them a card whose whole effect is a status or an
Aura scored exactly zero, and zero sits at the pass threshold — so all six Auras and four
control spells (Spore Cloud, Noxious Cloud, Rime Touch, Creeping Rime) were shipped in
enemy decks and unplayable by the side they were written for. They cost Bones and no
Marrow, so not even `marrowEfficiency` rescued them; the AI re-enumerated and re-declined
the same cards every turn of every game that dealt them, and the whole Aura system was
player-only in practice. Both are read off the simulated events like everything else, so
an attack whose rider applies Burn earns the same small credit a spell does, and gassing
its own bodies costs exactly what gassing the enemy pays.

Both are the same lesson: a term missing from the matrix is not a neutral omission, it is
a strong claim that the thing is worthless.

### Growth is enemy-side, and the matrix reads it twice

`Growth` — the enemy's clock, `src/core/engine/growth.ts` — is the keyword that makes a
long fight frightening rather than merely slow. A body that survived the opposing round
gets worse. **Player units do not have it**; `growUnit` returns early on anything that is
not `side === 'enemy'`, and the player's bodies grow through Auras instead, which stop at
three stacks.

| Constant | Value |
|---|---|
| `GROWTH_CAP` | **3** — a 1×1 enemy's ceiling |
| `GROWTH_CAP_BEHEMOTH` | **99** — a 2×2's |

> 99 rather than `Infinity`, and the reason is not balance. `Infinity` is not JSON: a
> saved fight reloaded with the ceiling replaced by `null`. 99 is unreachable in any fight
> that ends and survives a round trip.

The matrix reads Growth from both ends. `killPerEscalation` pays **10 per stack** for
removing a grown body, and `faceDampenedByEscalation` cuts the value of a face hit to
**0.2×** while the opponent has any grown unit standing — chipping a portrait matters less
when there is a clock on the board that has to be answered first.

> The engine's *field* names are still the old ones: `unit.escalation`,
> `unit.escalationCap`, the `escalated` event, `escalationBonus` on the stat block,
> `killPerEscalation` in the weight table. The keyword and the rule are **Growth**; the
> storage was left alone because renaming it would break every save that holds a fight.

### The `friendlyCollateral` wrinkle

A friendly death is charged one of two ways:

```
deliberate ? weights.kill * 0.4 : weights.friendlyCollateral
```

`deliberate` means the death came from a `bloodTithe` or a `playCard` — the AI opened the
body on purpose. At the shipped weights that is **20** for a deliberate loss against
**15** for an accidental one, so the code charges *more* for the choice than for the
mistake, which is the reverse of what its own comment claims it is doing. Recorded here
rather than quietly fixed: it is a real inversion, it is small, and it wants a balance
decision rather than an edit.

---

## 2. What the AI considers, and in what order

There is **no target-priority hierarchy** in the code, and there should not be. A
hierarchy is a second set of rules that has to agree with the weights, and the day they
disagree the AI does something no number in the table explains. The priority is what falls
out of the matrix, and at the shipped weights it falls out in roughly this order:

1. **Break the tether**, if one is live — 20,000, above everything.
2. **Take the game** — 10,000.
3. **Occlusion breakers.** A Guardian is 50 + 60 before anything else is counted, so the
   thing standing in the line of sight dies first.
4. **Grown bodies.** 50 + 10 per stack, plus 40 again if it is carrying a Mark.
5. **Collisions**, for an Adept only — 45 a shove, which on a walled arena is a whole
   extra damage source and, since the elemental matrix, the way to Shatter a frozen body.
6. **Chip and development** — `unitDamage`, `developAtk`/`developHp`, `armorValue`,
   `markSetup`, `statusValue`, `auraValue`.
7. **Face** — 15 an old point, cut to a fifth of that while the player has anything growing.

### The candidate list is pruned, and one exception is the whole point

`enumerateActions` reuses the same targeting and movement functions the UI uses, so **the
AI can never consider an action the player could not also take**. On top of that it prunes:

| Pruned | Why |
|---|---|
| Backward moves | A minion walking away is almost never right, and enumerating every such move triples the search for nothing |
| `Feral` units | Wildlife sits in a side's unit list for bookkeeping. Nothing commands it — offering its moves would let the AI play the beasts against itself |
| Blood Tithes with nothing to buy | See §3 |
| Channels that complete no purchase | See §3 |

**The Bound Form and every ranged body are exempt from the retreat prune.** The Bound Form
because it is the one body whose loss is the game, so withdrawing it is frequently the
entire turn. A ranged body because backing up is not retreating, it is **kiting**: with
move and attack independent, the step out of a blade's reach costs a shooter nothing it
cannot still do from the new tile. Melee stays pruned — the same backward step costs a
bruiser its whole turn. Whether a legal retreat is taken is the retreat term's business;
the prune only decides what is considered at all.

Attacks are enumerated **before** moves, so an equal-utility tie favours acting over
repositioning.

### Retreat, and the Bound Form's different arithmetic

A unit that has already swung values safety instead of ground. `retreat` reads
`threatMap` — **the same projection that draws the player's danger zone**, so the AI is
looking at exactly the board the player can see and holds no hidden information — and pays
per old point of damage it steps out of, capped at what would actually land. Damage past
a unit's health is wasted on it either way.

Stepping out of *lethal* range pays `kill × retreatSurvival` on top, because that is the
difference between keeping the body and losing it.

The Bound Form is judged by a different number: its effective health is the **Pact's** HP
plus armour, not its own, since its own is decorative. Pricing its safety off `unit.hp`
would value a 30-health Pact at a comfortable 400. And it is worth pulling back whether or
not it has swung — what is at risk is not a minion.

### Firing position

`advance` says forward is better. That is true of almost every unit and false of exactly
two archetypes: a mortar has a blind spot at its feet (`rangeMin > 1`) and a marksman
fires only down a rank (`attackProfile === 'lineOnly'`). For those, the last row of ground
gained can be the row that disarms them.

`firingPosition` is **8**, which must outweigh the two rows of `advance` a mortar gives up
by stopping short of its own blind spot, or the archetype walks itself out of the fight
every single time. It is consulted **only** for units whose reach is genuinely
non-monotonic; for everything else closer is never worse and this would be noise.

### Pursuit, and the stalemate it fixes

`advance` is a **y-gradient**, not a distance to anything: the player scores by decreasing
`y`, the enemy by increasing it. Almost every turn that points the right way, and it needs
nothing cleverer — the enemy is, broadly, over there.

It fails completely at the end of a fight. Two Bound Forms with the board otherwise clear
each maximise `advance` by walking to *opposite* edges. They pass each other on the way,
arrive eight tiles apart with nothing in reach, and stand there — one chipping the other's
Pact with spells while a bloom Resonance heals it back. Neither can win and neither will
move, because "forward" has run out and nothing in the matrix said "toward **them**".

That state used to be invisible, because the player's body standing in the enemy's home
rows could strike the portrait from there and simply end the fight. Once a Commander could
only be reached through their Companion's body, the stalemate surfaced — as four encounters
that no longer resolved, every one of them a bloom fight.

`pursue` is **6**: per tile closed on the nearest hostile body, credited only to the unit
that moved. Above `advance` so closing beats the gradient when they disagree, and below
`firingPosition` so a constrained shooter is not talked out of its firing line.

It is gated on **`threatensFrom`**, not on `legalAttacks`, and the distinction is the whole
correctness of it: the question is whether the tile threatens anything *at all*, not whether
this unit has a swing left. A body that has already attacked still threatens from where it
stands, so strike-and-withdraw stays the retreat term's business rather than becoming
strike-and-chase.

A **Marrow Geode counts on both sides of this term**. It is quarry — the nearer of the
nearest foe and the nearest unbroken Geode is what `pursue` closes on — and it gates the
term off for a unit already standing in reach of one, for the same reason `threatensFrom`
does: the greedy planner plays the highest-scoring command first, and a pursue bonus that
outbid the crack would walk the unit away from two Marrow every time. The crack itself
scores through `extraction`, read off the simulated `marrowExtracted` event. A Novice takes
the prize when the plain auction says to; an Adept's lookahead also cracks before a long
advance, because the crack leaves the move and the move leaves nothing.

Hostility is read the same way `legalAttacks` reads it — a Feral beast is an enemy of
everything that is not also Feral, including the side whose record it sits in — and distance
is `footprintDistance`, so a 2×2 Behemoth is measured from its nearest cell.

### Fighting through armor

`pursue` gets a body to the fight. It does not make it swing, and on its own it did not
finish these fights — it moved *which* encounters stalled rather than how many.

A blow that armor absorbs entirely reports `hpLoss: 0`. Both damage terms counted health and
nothing else, so such a swing was worth exactly zero — and because zero sits **at** the pass
threshold, `scoreAll` discarded it before it was even a candidate. Against a Pact sitting
behind 160 armor, the AI had no scored attack available at all. It paced instead, every turn,
while the armor was topped back up. Two bodies doing this to each other shuttled between the
same pair of tiles for sixty turns.

`armorChip` is **0.5**: armor stripped counts as progress toward the health behind it, at
half rate. Applied to enemy units and the enemy portrait alike. It is *not* applied to damage
against your own side — that term exists to protect the Pact's health, and armor exists to be
spent, so treating its loss as a wound to avoid would teach the AI to hoard the one resource
whose purpose is to be used up.

The two weights are both load-bearing, and measurably so. With `armorChip` alone, four of the
seven affected encounters still stall (two of them on every seed): the bodies swing, but never
arrive. With `pursue` alone, the bodies arrive and decline to swing. Together, all seven
resolve — and faster than the old portrait-hitting route did, because the AI is now fighting
rather than walking: `clinic_quota` went from stalling to eleven turns, `ashwood_poacher` to
nine.

**What is still imperfect.** `pursue` and `retreat` trade against each other, so on a board
holding *nothing but* the two Bound Forms and no armor to chew, they can still hover — pursuit
pulls in, retreat pushes out. `src/tests/pursuit.test.ts` pins that cycle deliberately, so
whoever finally makes the body commit sees the test fail and knows they changed something real
rather than fixed something incidental.

### The binder's side of the Harpoon Protocol

Everything about a subjugation was written from the beast's point of view. It knew how to hunt
an anchor; nothing knew how to *place* one. Three faults compounded, and each hid the next.

**No score for casting the Rite.** A sealed beast cannot be damaged or killed, so the tether is
not the best line on the board — it is the only one. The matrix scores damage and kills, and the
Rite produces neither, so it was worth nothing: the planner held a free card with a legal target
for a dozen turns while the fight ran out. `TETHER_SCORE` is **20,000**, the same magnitude as
`ANCHOR_KILL_SCORE`, because it is the same event seen from the other side.

**`anchorPressure` was not side-gated.** It was applied to whichever side happened to be
planning, so the side that *owned* the tether was offered twenty thousand points for destroying
it. This was invisible only because of the first fault — the binder never placed a tether, so it
never had one to blow up — and it was primed to fire the moment the first fault was fixed. The
term now branches on the anchor's owner: `anchorPressure` for the side hunting it,
`anchorDefence` for the side holding it. The defensive mirror is deliberately simpler, because
`setAnchor` spends the anchor's move and attack — it is pinned, so there is no positioning to
reward and nothing to do but not lose it.

**The Pacifist Lockout guarded the wrong flag.** It suspended on `subjugation.active` and meant
`sealed`. The gap between the two is exactly where the hazard lived: after the seal, before the
Rite is cast, the beast is already immune and the tether is not yet down, so the lockout's
unblockable damage landed on the player alone. Every round spent looking for that card was a
round the arena charged one side for. The function's own comment had described this hazard
correctly for as long as it had been checking the wrong thing.

Note the ordering constraint, because it is not obvious: fixing the lockout *alone* would have
been worse than leaving it. `tickSubjugation` returns immediately unless the tether is live, so
the sealed-but-untethered window has no timeout of its own — the lockout killing the player was
the only thing ending it. Removing that without teaching the planner to cast the Rite converts a
slow loss into a fight that never ends at all.

Measured on `fouled_cistern`, the campaign's designated easy fight: it lost all eight balance
seeds before, never once casting the Rite. It now **binds five of eight** and every seed resolves
inside the harness's guard, where one previously ran past it.

### Splash on empty ground

An AoE aimed at an untargetable body is refused; an AoE aimed at the **tile beside it** is
not. `legalCardTargets` enumerates `emptyTile` targets, and a card built as
`target: emptyTile` + an area shape puts the effect on the ground and lets the shape catch
whatever is standing around it. The AI gets this for free from the shared targeting layer —
it is not a special case in the planner, it is the ordinary consequence of cards being data.

---

## 3. Bones, Marrow, and the mechanic that never shipped

The AI spends out of the same two-resource engine the player does: **Bones** bank at +1 a
turn to a ceiling of 8 (`BONE_CAP`), **Marrow** is extracted during a turn and every
unspent point evaporates at cleanup. See `docs/02_combat_lexicon.md` §2.

There is **no Bone-banking heuristic**. No ramp phase, no capacity-management rule, no burst
trigger. `marrowEfficiency` pays **10 per point of Marrow actually spent** and that is the
whole of the resource term — and it is enough, because Marrow expires. A plan that opens a
body and then leaves the Marrow on the table scores strictly worse than one that spends it,
without anybody writing down a threshold.

> A banking rule would be a claim about the *future* of a turn, and the Novice tier
> deliberately cannot see one. Pricing what expires is how the same matrix gets the answer
> right at both tiers.

### Blood Tithe, not sacrifice

`bloodTithe` opens one of the AI's own bodies for Marrow. The body **stays on the board**:

| | |
|---|---|
| `TITHE_DAMAGE` | **30** (`src/core/engine/effects.ts`) |
| `TITHE_MARROW` | **2** |
| Cost | the body's turn — it takes `exhaust`, which is broader than a spent attack |
| Refused for | a **Bound Form** (it would pay out of the Pact), an already-exhausted unit |

Tithes are enumerated **only when the hand holds something unaffordable**. Bleeding a body
for Marrow that buys nothing is worse than doing nothing at all.

### Channel is gated on completing a purchase

`channel` extracts 1 Marrow (`CHANNEL_MARROW`) with a unit's **attack**, and is offered
only when that specific Marrow makes a specific unaffordable card affordable — asked of
each card in hand directly, because with a strict Marrow component a *dearer* card may be
the one a single point unlocks while a cheaper one stays impossible.

Without that gate the AI channels every idle unit until it hits the action cap, hoarding
Marrow it cannot spend and quadrupling its own planning time. Only **one** candidate is
offered even so: every idle unit extracts the same 1 Marrow, so which one is not a decision
worth searching.

`channelValue` is **6** — above `passThreshold` so an idle unit channels rather than
standing there, and well under a kill or a face hit so it never competes with actually
fighting.

### Devour does not exist

There is no Devour mechanic in CONJURE. Nothing consumes an allied body for stats or for
resources; `companionTraits.ts` says so in as many words, and the trait that would have
redirected a devoured card away from the discard pile is recorded there as having no
trigger to hang on.

The `devoured` flag on `killEntity` survives as a **fizzle reason** — a mark whose host was
devoured is discarded without detonating, `markFizzled` with `reason: 'devour'` — and
nothing in the shipped game passes it. It is a path kept warm for a mechanic that was
designed and never built. The heuristics that were written for it (doomed-unit reclamation,
clearing a 2×2 footprint, forcing a detonation before an unaligned blow fizzles it) have
no code and no board state to run against.

---

## 4. The two difficulty tiers

`AI_PROFILES` holds **Novice** and **Adept**. `profileByName` resolves those two,
case-insensitively, and nothing else — `adept.test.ts` pins the absence by asserting that
`profileByName('Grandmaster')` is undefined.

| Field | `NOVICE_AI` | `ADEPT_AI` |
|---|---|---|
| `weights` | `NOVICE_WEIGHTS` | `ADEPT_WEIGHTS` — sees collisions (45), preserves units slightly harder (3.5) |
| `suboptimalChance` | **0.2** | **0.05** |
| `lookahead` | **0** — pure greedy | **1** |
| `beamWidth` | 1 | **4** |
| `lookaheadDiscount` | 0 | **0.9** |
| `rolloutDepth` | 0 | **3** |
| `actionCap` | **8** | **8** |
| `passThreshold` | **0** | **0** |
| `simulationBudget` | **400** | **1600** |
| `hangGuardMs` | **8000** | **8000** |
| `telegraph` | `'all'` | `'attacks'` |

### What the tiers actually feel like

**Novice is visibly imperfect, and the imperfection has a shape.** Being greedy on a
single action, it will move a unit out of range before remembering it could have swung
first. It ignores collision damage entirely — `collision: 0` means it does not seek shoves
out, though it still causes them by walking into things. And one turn in five it takes the
second or third best action instead of the best.

**Adept fixes the ordering weakness, and that is precisely what lookahead is for.** A
candidate is re-valued as `its own utility + 0.9 × the value of the turn it leads to`,
where that second half is a greedy rollout three actions deep. Moving first scores well
alone and leaves nothing; attacking first scores modestly and still leaves the move.

Two details in `withLookahead` are load-bearing:

- **The value is the whole turn's, not the action plus its single best sequel.** Adding a
  sequel's score to the opener double-counts it — that sequel gets taken on the next
  iteration anyway — and rewards actions that leave *many* options over actions that leave
  *good* ones.
- **The beam is the top N *plus the best of every command type*.** Taking the top N by
  greedy score defeats the entire purpose, because the actions lookahead exists to rescue
  are exactly the ones that score badly alone. A free attack worth 4 never enters a beam
  full of advances worth 9, so it never gets the chance to show that it costs nothing.

**A winning line is never re-ranked and never fumbled.** Both `withLookahead` and
`pickWithSuboptimality` bail out at a utility of 10,000 or above, so no amount of follow-up
beats taking the game and the suboptimality roll cannot throw it away.

> Both of those guards spell the threshold as the literal `10_000` rather than importing
> `LETHAL_SCORE`. Two places holding one number, which is the drift this codebase warns
> about everywhere else. Worth naming.

### Difficulty scales along information, not only skill

`telegraph` is the second axis, and it is the one players feel. The enemy commits in
advance to what it will do next turn (`declareIntents`, `src/core/engine/intents.ts`), and
how *much* it commits to is a difficulty setting:

- **`'all'`** shows attacks and card plays. The teaching tier, where total clarity is the
  point.
- **`'attacks'`** shows only the blows. An Adept keeps what it is holding to itself, and
  `finishEnemyTurn` plays out its undeclared cards after the declared blows have landed.

Two rules make a telegraph trustworthy, and both matter more than they look. **A declared
blow lands on the tile, not the target** — move the victim and the attack strikes empty
ground, or whatever is standing there now, including one of the enemy's own. And **what is
declared is what happens**: `runAiTurn` replays the recorded plan rather than asking the AI
again. If it could re-plan, the telegraph would be a suggestion instead of a promise, and
the whole mechanic would be worth nothing.

The plan is made against a **forecast board** (`boardForNextEnemyTurn`) on which the
enemy's units have refreshed, since at the moment of declaration they are all spent. The
Monocle relic buys back what the tier hides: `revealsIntents` on the player forces
`'all'`, resolved in the session rather than in the reducer, because the engine has no idea
an AI tier exists.

---

## 5. The failsafes

Fifteen things that cannot be allowed to happen, and what stops each one.

### The thinking budget

| | |
|---|---|
| Actions per turn | **8** (`actionCap`), then the AI passes |
| Simulations per turn | **400** Novice / **1600** Adept (`simulationBudget`) |
| Wall clock | **8000 ms** (`hangGuardMs`) — last resort only |

**The simulation count is the binding constraint, and deliberately so.** An earlier version
let the wall clock decide, which made the AI's choices depend on how busy the machine was:
the same seed produced different games, and the replay harness caught it immediately.
Anything that changes a decision has to be deterministic.

The clock survives only as an anti-hang backstop, set far enough out that ordinary play
never reaches it. If it fires, determinism is knowingly traded away to avoid freezing the
tab — the right call, and the reason it is not the primary limit.

Exhausting the budget **degrades quality, not time**: `withLookahead` is skipped and the
rest of the turn is planned greedily. The budget is checked *inside* the enumeration loop,
because a single enumeration on a large board can be a hundred simulations — enough to
overrun the whole turn on its own.

Adept's 1600 is tuned against measured play: it buys the full strength gain over Novice,
where 2200 costs noticeably more thinking time for no additional wins.

### Deterministic tie-breaking

**The AI never uses RNG to break a utility tie.** `compareActions` sorts by utility, then:

1. **Highest `y` first** — deepest into the player's half. The `y = 99` key for a portrait
   attack is retained for exhaustiveness only: no attack may name a portrait, so a swing at
   a Pact is a swing at its Bound Form and sorts by that body's actual anchor.
2. **Lowest `x`** — leftmost.
3. The command's own stable tag, so the comparator is a total order.

The default arm of `tieBreakKey` returns a stable key rather than throwing, because a sort
comparator is the worst possible place to discover a new command type. The deployment
commands land there and never reach it in practice: the enemy is authored content, with no
roster and no deployment phase.

The one place RNG *is* used is `pickWithSuboptimality`, and it draws from `state.rng` — the
seeded generator the whole fight replays from — so a Novice's fumble is part of the replay
rather than a divergence in it.

### The Lethal Veto

See §1. A line that kills the AI's own commander without guaranteeing the player falls
first is priced at negative infinity and then discarded for being non-finite.

### The Pacifist Lockout

`src/core/engine/turn.ts`. If **neither commander takes damage for 6 full rounds**
(`STALL_LIMIT`), the arena starts collecting: **10** unblockable `true` damage
(`LOCKOUT_DAMAGE`) to **both** commanders, escalating by **5 per further round** until
somebody falls.

Set high enough that competent play never sees it. It exists only so that a game cannot
literally run forever if both sides refuse to engage — two turtling sides, or two cautious
AIs, can otherwise trade board presence indefinitely and nothing resolves.

Three details:

- It counts **rounds without commander damage**, not Bone totals or hand sizes. A full hand
  and a banked 8 are not stalling; not hurting anybody is.
- **It is suspended while a tether is live.** The lockout breaks a stalemate between two
  sides who will not commit; a subjugation is the opposite — a timed siege in which the
  beast is *sealed* and neither commander can be hurt. Left running it would fire on
  schedule and kill the player with damage the sealed Alpha is immune to, turning a
  try-again loop into a guaranteed loss.
- The lockout's own damage does not reset the counter, or it would fire exactly once.

### Behemoth displacement clipping

`src/core/engine/displacement.ts`. A shoved 2×2 is stepped one anchor at a time, and each
step tests **every cell of the new footprint**. If any is off-board or occupied the body
stops on the last valid 2×2 coordinate and collision damage is applied there. Cells the
unit is vacating do not obstruct it.

**Mass invariance**: the numbers do not change when a Behemoth is involved, in either role.

| Collision | Damage |
|---|---|
| Displaced unit, into anything | **30** (`COLLISION_TARGET_DAMAGE`) |
| A blocking **unit** | **20** (`COLLISION_BLOCKER_DAMAGE`) |
| A blocking **obstacle** | **30** (`COLLISION_OBSTACLE_DAMAGE`) |
| A wall or the arena border | 30 to the displaced unit, nothing to the wall |

Walls hurt as much as bodies, so shoving into one is free damage — which is what makes
`collision: 45` worth 45 to an Adept.

Two things can refuse a shove outright and do so **silently, with no collision**: the
`heavyFootprint` Climax trait and the army-wide Heavy Tread. Nothing hit anything; it simply
did not move, and a zero-length path is what a blocked displacement already reports.

### Complete board lockout

There is **no Crush Summoning**. `canPlace` refuses an occupied footprint and `summonUnit`
respects it, so an enemy whose deployment ground is walled off simply cannot summon there.
What it does instead is what the matrix already tells it to do: kill the wall. A
`stone_barricade` in the way is an obstacle worth `unitDamage` per point to break, and a
Guardian in front of it is worth 110.

The Pacifist Lockout is the backstop if neither side can reach the other at all.

### Sudden death, and the armour purge

`checkLethal` in `src/core/engine/death.ts`. Both commanders reduced to 0 in the same step:

- Both revive at **10 health** (`STAT_SCALE` — one point on the old scale) and **0 armour**.
  All Persistent Armor is purged; both sides enter sudden death naked.
- **Every unit is wiped** and every mark on every obstacle cleared.
- **Bound Forms are then restored**, because the Pact did not end — a player with no
  Companion body could not cast at all for the rest of the fight.
- A **second** mutual KO during sudden death resolves to the instigator.

### Simultaneous status death cannot happen

The doc's mutual damage-over-time tiebreak has nothing to resolve: **statuses attach to
units, never to portraits.** A commander carries no status field, so no Burn or Toxin tick
can ever be racing another one across the two portraits. What *can* happen is a mutual AoE
lethal, and that is sudden death above.

For unit ticks the order is fixed and total, so it needs no tiebreak: Toxin across all
units, then Burn across all units, then decay, then hazards, then Growth. See
`docs/02_combat_lexicon.md` §8.

### Deck depletion is free

There is **no fatigue**. An empty deck reshuffles the discard pile at no cost
(`src/core/engine/deck.ts`); with a 20-card fused deck drawing 4 a turn, cycling is
expected rather than punished.

**Overdrawing burns.** Drawing into a full hand (`HAND_LIMIT = 7`) discards the card and
grants **1 Marrow — to the side that drew it**, not to the opponent, and no true damage is
dealt to anybody.

### The Damage Gate

`ignis.trial.ts`'s `onDamageToCommander` is the shipped example, and it is a hook on the
encounter rather than a branch in the engine. Any single blow that would carry the boss
below half:

1. is **clamped** so HP lands on exactly the halfway mark and the remainder is nullified;
2. sets `chainCancelled`, so no further cascade damage in that resolution can undo the
   clamp;
3. transforms.

The engine is synchronous, so the transformation runs before the damage write completes —
which is safe precisely because `enterPhaseTwo` touches units and the board and never boss
HP.

**A status tick can cross the gate outside any damage chain**, which is why `onTurnStart`
tests the threshold too. The transition then also purges every status from the boss's own
units, its own body included — which is the reason spending a Flash Freeze just before the
halfway mark is a mistake rather than a plan.

Priority is **not** interrupted and handed back. There is no mid-turn interrupt in the
reducer; the transformation resolves inline within the action that caused it.

### Forced Eviction

A player body standing where the phase-two form needs to stand is **returned to the
player's hand with 1 Marrow refunded** (`cardReturnedToHand`, `refundedMarrow: 1`) — a flat
refund, not the card's cost back.

If the drake is boxed in and cannot grow, the phase **still happened**: the clamp, the
purge and the adds are all done, and only the transformation is outstanding. It is retried
at the start of each of the boss's turns, tracked on a separate gate so a blocked attempt
does not re-announce the phase. When it does grow, `clearIntents` fires — every declared
blow was aimed from a body that no longer stands there, and half the sightlines it was
aimed along have just been rewritten by a 2×2 appearing.

### The Rite of Subjugation

At a quarter strength (`hp <= floor(maxHp * 0.25)`) the encounter calls `beginSubjugation`
and the fight stops being a damage race. `src/core/engine/subjugation.ts`:

| | |
|---|---|
| The card | `rite_of_subjugation`, **0 Bones, 0 Marrow**, carries **Retain** |
| Where it is dealt | **onto the top of the draw pile**, `cmd.deck.unshift` |
| Rounds to hold | **3** (`SUBJUGATION_ROUNDS`) |
| Result | `bound` |

**It is not an ephemeral overlay and the hand limit is never bent.** A hand that is already
full would need the Rite smuggled in outside the limit, and the player would get it without
having spent the turn it costs to draw. On top of the deck it is guaranteed and still has to
be picked up. `Retain` is what stops it being discarded at cleanup once it is in hand.

`beginSubjugation` is **idempotent** by way of the seal itself — a second call finds the
plating already on and does nothing — so an encounter may check its own threshold as
loosely as it likes, and `ignis.trial.ts` does exactly that from two hooks.

`sealed` lives in `Subjugation` rather than being read off the `aetherPlated` status,
because the body carrying that status can leave the board. A boss that became mortal
because its model was removed would be a way to win a subjugation by accident.

When the tether snaps, `enrageBoss` puts **one punitive Growth stack** on the Alpha and
deals the Rite again. That stack is written directly rather than routed through `growUnit`,
which refuses a Bound Form on the grounds that the Pact does not grow — this is not the
keyword rewarding survival, it is the beast getting angrier because something tried to cage
it.

### Nothing in the engine names a beast

`subjugationPrize` on the `EncounterDef` says which species a binding adds to the roster.
The engine never learns a species name and the overworld never learns how a tether works.
An encounter that seals without naming a prize pays like a victory, which is what every
subjugation did before the field existed.

---

## 6. The encounters

Four ship, and they are ordered by what they ask of a player rather than by difficulty
number: an honest duel, a corridor that punishes standing still, an open field where nothing
can see, then the boss.

| id | Arena | Enemy | What it is for |
|---|---|---|---|
| `novice_duelist` | 6×8 | Novice Duelist (dusk), embodied | The honest test of your deck. All six Marks ride in its deck — it is where a player meets them |
| `narrow_ruin` | 4×6 | Ruin Warden (bulwark), off-grid | The smallest arena the rules accept. Four columns means no flank; a gale down the hall makes standing still worse than advancing |
| `glacial_field` | 8×8 | Glacier Duelist (frost), embodied | The opposite problem. Room for everything to work, and fog takes it away — nothing sees past 3 tiles, so reach counts for nothing |
| `ignis_trial` | 8×8 | Ignis, Ember Drake (pyre), embodied | Two scripted thresholds and a subjugation. 440 enemy HP against 400 |

`narrow_ruin` keeps the older shape deliberately: the Warden fights wholly from off the
board, so the global-cast fallback stays exercised in something a player actually meets.

### What both sides open with

| | |
|---|---|
| Banked Bones | **3** — `encounter.startingPips ?? 3` in `setup.ts` |
| Opening hand | **5** (`OPENING_HAND`) |

This is the contact table: **frontal contact is the neutral state, and the neutral state is
3 Bones and 5 cards.** Without the opening Bones, turn one is a dead turn — the
first turn's income is +1 on top of the 3, and a 4-cost card would be unreachable until
turn five.

**The opening hand of 5 *is* turn one's draw.** `beginTurn` gates `drawCards` on
`turn > 1`, because drawing 4 more on top of 5 would immediately overdraw past the hand
limit of 7 and burn two cards before anybody had acted. No shipped encounter sets
`startingPips`, so all four open at the neutral state; the field exists for an arena that
wants to open asymmetrically.

### The encounter seam

Boss behaviour lives in **data-side hooks**, not in the engine, so the Ignis trial's phase
gates and the Harpoon Protocol add no branches to the combat rules. `EncounterScript` is
four optional functions:

| Hook | Fires |
|---|---|
| `setup` | once, after both sides are set up |
| `onDamageToCommander` | before damage lands; **returns the new amount** |
| `onCommanderHpChanged` | after a commander actually loses health |
| `onTurnStart` | at the start of each side's turn, before that side acts |

Everything else an arena is — its shape, its walls and cover, its props, its geodes, its
currents, its weather, its wildlife, its scavenger — is a **field on `EncounterDef`**, and
the turn machine reads it back out of the registry by id. Wildlife is driven from
`beginTurn` rather than from a script precisely so that an encounter can have beasts
without having to be a program: opting in is a field, not code.

> `EncounterDef` is registered as it is declared (`registerEncounter`), so the definition
> the turn machine reads cannot fall out of step with the one that ships. The turn machine
> only ever has an id to hand.

### One encounter, two presentations

Nothing about an `EncounterDef` says how it is drawn, and since the district gained the
ability to hold a fight there are two answers:

| Reached from | Drawn by | Notes |
|---|---|---|
| The Bounty Board | `app/CombatScreen.ts` — the 2D isometric canvas | Unchanged |
| The road (a pack, or the Warden) | `district/combat/WorldCombat.ts` — in the three.js district, on the ground the Combat Ring closed on | No screen swap |

Both drive the **same** `CombatSession`, `Sequencer`, animation handlers, `Hud`,
`TargetingController` and `Fx`. That was possible without touching the engine because none of
those layers ever knew about the projection: `EntityViewMap` stores fractional *tile*
coordinates, `TargetingController` speaks only `Coord`, and `Fx` asks its camera four questions
that a perspective camera can answer as well as an isometric one. See `docs/12` §2.6.

The one thing an arena's **size** now also decides is whether it can be seated on real district
ground. Every roaming pack shares a 7×6 arena and every area that roams packs can seat it
cleanly; a larger arena in a dense ward falls back to fading the buildings it cannot avoid.
`worldBoard.test.ts` is where that is enforced.

`warden_writ` joins the registry through the same `PackDef` route the roaming packs use, and is
the only one never placed on a map — it is served on you rather than walked into.

### Continental Apex Bosses

There are none, and there is no continent system. `ignis_trial` is the shipped boss and the
`EncounterScript` seam is the shipped way to build another.

---

## 7. Difficulty is not the encounter

Worth stating plainly, because the two look adjacent and are not. The `AiProfile` is chosen
by the **player**, persisted on the save (`difficulty`, defaulting to `NOVICE_AI.name`) and
resolved through `profileByName` at load, falling back to Novice for anything unrecognised.
The `EncounterDef` says nothing about it.

So the same arena can be fought by either tier, and every encounter is playable at both.
The tier names also appear on the **Bounty Board** as contract grades — where a Novice
contract offers a pick of 2 Schematics, an Adept 3, a Master 4 — and that ladder is an
economy thing, unrelated to which `AiProfile` is driving the units. See
`docs/03_rpg_sandbox.md` §4 and `docs/07_deck_building.md` §7.

The economy is **Ducats, Aether Shards and Cores** against a Bounty Board. There is no
Ante and no Renown; nothing is wagered on a fight and nothing is ranked by it.

---

## 8. Where the old specification and the code disagree

The AI was built from a design document, and most of it survived — the utility formula, the
weight table, the action cap, the deterministic tie-break, the Lethal Veto, the armour purge
on sudden death. These are the places it did not, and in every case **the code is the
answer**.

| The old spec said | The code does | Why |
|---|---|---|
| Minion kill worth **+50 per Card Tier** | flat **50** (`kill`), plus 10 per Growth stack | Tier is derived from cost, and pricing a kill by cost double-counts what the board already shows |
| **+35** for positioning a Guardian ally into the boss's line of sight | no such term | Never implemented. Guardian *removal* is priced (60); Guardian *placement* is not |
| **+5** per Bone preserved under the 8 cap | no such term | Replaced by pricing Marrow spent. See §3 |
| Collision **+45** for everyone | **0** Novice, **45** Adept | Collision awareness is what separates the tiers |
| Three difficulty tiers: Novice, Adept, **Master** | **two**. `AI_PROFILES` is Novice and Adept | Master (2-turn lookahead, 0% suboptimal, chain collisions, interlocking walls) was never built. `adept.test.ts` pins the absence |
| Adept has **1-turn lookahead** | one-***action*** lookahead, beam 4, rollout depth 3, discount 0.9 | The unit of planning is an action, not a turn — which is what makes it fix the move-before-swing ordering bug |
| **150 iterations / 1.2 s** compute cap | **400** sims Novice, **1600** Adept; **8000 ms** hang guard | The clock cannot be the binding limit without breaking determinism. It survives only as an anti-hang backstop |
| Ties break toward the unit **closest to the boss's own back row** | **highest `y`** — deepest into the *player's* half; a face hit (`y = 99`) wins every tie | Opposite orientation. Leftmost-`x` as the second key does match |
| A full **Devour / sacrifice-Spark** heuristic engine | **Devour does not exist.** `bloodTithe` (30 damage, 2 Marrow, body survives) and `channel` (1 Marrow) are the resource verbs | The mechanic was designed and never built. `companionTraits.ts` records it as having no trigger |
| Pacifist Lockout: **3 rounds** at 8 Bones with a full hand, **10 true to the Hero** | **6 rounds** without commander damage, **10 true to both**, +5 per further round, suspended during a subjugation | Stalling is measured as nobody getting hurt, not as resources held. Symmetric because either side can be the one refusing to commit |
| **Crush Summoning** onto occupied tiles | does not exist; `canPlace` refuses | The answer to a walled summon zone is to break the wall, which the matrix already rewards |
| **Fatigue Spark Burn**: empty deck deals 1 true damage per draw and grants the opponent a Spark | empty deck **reshuffles free**; overdrawing burns the card and grants **1 Marrow to the drawer** | Cycling a 20-card deck is expected play, not a punishable mistake |
| A Boss below 25% generates the Rite as an **Ephemeral Overlay** pushing the hand limit to 9 | dealt **onto the top of the draw pile**; the hand limit is never bent. `Retain` stops it being discarded | An overlay hands the player the card without the turn it costs to draw it. The `ephemeral` field exists and is honoured elsewhere — the Rite simply does not use it |
| Phase transition **interrupts the player's turn** and passes priority back | resolves **inline**, synchronously, inside the action that triggered it | There is no mid-turn interrupt in the reducer, and adding one for a boss would be a scheduler |
| Forced Eviction refunds the evicted unit's **Bone cost as temporary Sparks** | returns it to hand with a flat **1 Marrow** | Bodies are no longer bought with Bones — they come off the Vanguard Roster — so there is no cost to refund |
| Simultaneous status death resolves by **turn priority** | cannot arise: **portraits carry no statuses** | Mutual lethal is handled by sudden death instead |
| Four **Continental Apex Bosses** on four continents | one boss (`ignis_trial`) and an `EncounterScript` seam | That world does not exist in the code |

### Retired vocabulary

For anyone reading the old material against this:

| Retired | Current |
|---|---|
| Rune | **Mark** (`kind: 'mark'`, `src/core/data/marks.ts`) |
| Spark / Sparks | **Marrow** |
| Echo | nothing — no such mechanic |
| Escalate / Escalation | **Growth**, and **enemy-side only**. Player units grow via Auras |
| Sacrifice (the command) | **Blood Tithe** (`bloodTithe`) — the body survives |
| Rite of Binding | **Rite of Subjugation** (`rite_of_subjugation`) |
| Ante / Renown | **Ducats / Shards / Cores** and the Bounty Board |
| Single-digit damage | the **stat stretch**: `STAT_SCALE = 10`, so a collision is 30 and not 3 |
