# 02 — Combat Lexicon

The rules of the pure combat engine, and the vocabulary they are written in.

Every number quoted here is the number the code uses, with its constant named.

---

## 1. The Pure Reducer

```ts
applyCommand(state: GameState, command: Command): { state: GameState; events: GameEvent[] }
```

One entry point. Everything a player or an AI can do goes through it.

**Synchronous.** The call returns with the fight fully resolved — detonations, collisions,
cascades and deaths included. There is no scheduler, no promise, no partially-resolved
state a caller could observe.

**DOM-free.** `src/core/tsconfig.json` sets `"lib": ["ES2022"]`, so `document` and
`window` are not merely discouraged — they do not typecheck. The logic core cannot grow a
dependency on the renderer by accident.

**Deterministic.** The state carries its own `rng`. Same seed and same commands produce
the same fight, step for step.

**Events out, never state in.** The renderer must *never* read live core state during an
animation: the core resolves instantly, so its state is already ahead of what is on
screen. Events therefore embed **snapshots** — frozen copies of the unit, card, or
obstacle as it was at that moment.

### The eleven Commands

| Command | Effect |
|---|---|
| `playCard` | play a card from hand at a chosen target |
| `moveUnit` | spend a unit's move |
| `attack` | strike a unit or an obstacle. **Never a commander portrait** — see §3 |
| `attackTile` | a declared attack landing on a now-empty tile — costs the action, deals nothing |
| `bloodTithe` | open one of your own units for Marrow. The body **stays on the board**, wounded and Exhausted |
| `channel` | spend a unit's **attack** to extract Marrow instead of swinging |
| `deployUnit` | put one rostered body on an Anchor Tile, before turn one. Free and reversible |
| `recallUnit` | pick a deployed body back up, returning it to the tray |
| `finishDeployment` | set the line; ends deployment and begins turn one |
| `declareIntents` | record the enemy's commitment for next turn |
| `endTurn` | end the turn |

An illegal command throws `IllegalCommandError` — never a silent no-op.

`declareIntents` is a command rather than a side effect specifically so it passes through
the one reducer and replays identically from a seed.

### Phases

```
startOfTurn → action → resolution → endOfTurn → (flip side) → startOfTurn → … → over
```

Only **action** accepts external commands. The other three are internal pipelines that run
to completion.

Detonations, collisions and cascades resolve **inline** within each action, because the
rules describe them as instant and same-step. The formal **resolution** phase is a safety
sweep plus the lethal check. Presenting a detonation as its own dramatic beat is the
sequencer's job, not the engine's.

### Causes

Every event carries a `causeId` — the same value for all events from one atomic
resolution step. The animation sequencer groups by it, and `PARALLEL_SAFE` names the event
types that may animate simultaneously when they share one:

`damageDealt`, `statusApplied`, `statusTicked`, `armorGained`, `healed`,
`resourcesChanged`, `escalated`, `cardDrawn`.

---

## 2. Resources

### Bones — banked magic

+1 at the start of every turn, and unspent Bones carry over.

The ceiling is **8** (`BONE_CAP`), enforced **only during end-of-turn cleanup** — so
in-turn totals may freely exceed it. It is stored per-commander as `boneCap` rather than
read from the constant, because gear can move it and a rule that gear bends has to be a
value somebody can hold.

### Marrow — volatile magic

Extracted during a turn by the blood tithe, by channelling, or by opening something up.
**All unspent Marrow is lost at end of turn.** Use it or lose it.

Sources:

| Source | Amount |
|---|---|
| Tithing a unit | 2 (`TITHE_MARROW`), plus that body's `titheBonus` |
| Channelling | 1 (`CHANNEL_MARROW`) |
| Overdrawing past the hand limit | 1, and the drawn card burns |
| Breaking a Marrow Geode | its `onDestroyReward.marrow` |
| Killing a scavenger | its `bounty.marrow` |

The verb is **extract**: op `extractMarrow`, event `marrowExtracted`.

### The two halves of a cost

```ts
interface CardCost { bones: number; marrow: number; }
```

Two genuinely different demands:

- **`bones` is generic energy.** Marrow substitutes for it freely, and does so **first**,
  because Marrow evaporates while Bones bank. A card priced purely in Bones is still fully
  payable out of a tithe, which is what keeps the ramp economy intact.
- **`marrow` is a strict requirement.** Bones cannot cover it at any price. A card asking
  for Marrow is asking you to have opened something up *this turn*, and no amount of
  patient banking substitutes for that.

`costBreakdown(marrowOnHand, cost)` is shared between the spend path and the play preview,
so the numbers shown before committing are produced by the same arithmetic that will run.

The badge reads `3`, or `1+2✦` when both are demanded, or `1✦` when only Marrow is.

### Reaction refunds

Landing an elemental reaction pays **1 Bone** back (`REACTION_BONE_REFUND`), capped at **2
per turn** (`REACTION_BONE_CAP`, tracked as `reactionPipsThisTurn`) — beyond that a cascade
would fund itself, which is a loop rather than a reward.

Emitted as `pipRefunded`, deliberately distinct from the generic `pipGained`: turn income
is expected and silent, a refund is a reward for a setup that worked and is worth saying
out loud, at the tile where it happened.

> Voltara's **Storm Tithe** Resonance pays through the same credit but deliberately does
> **not** spend the reaction budget — it is already limited to once per turn by
> `resonanceUsedThisTurn`, and taking a slot would make the Surge school pay for its own
> passive out of the reactions it exists to set up.

---

## 2.5 The Action Economy

Every body gets **one move and one attack per turn, in either order**. Striking and then
withdrawing is legal; movement cannot be split around a swing.

**A swing costs 1 Bone. A body that gives up its swing makes one.**

| Class | Points | Channel yields | Verb |
|---|---|---|---|
| melee | 2 | 1 Bone, 1 Marrow | Brace |
| ranged | 3 | 1 card, 1 Marrow | Sight |
| elite | 4 | 2 Bones, 1 Marrow | Focus |
| Behemoth | 6 | — cannot channel | — |

Income is **`1 + bodies/3`** per turn, counting the bodies that could spend it. Ferals are
outside the economy entirely: nothing commands them, so they neither pay to strike nor earn.

Net Bones for a side attacking with a fraction `f` of `N` bodies is `income + N(1 - 2f)`. On a
six-body warband: attack with half and you bank +3 a turn, which funds a card and a half;
attack with three quarters and you break even and cast nothing; attack with everything and you
run -3, which is a burst paid for out of the bank. Army size cancels at the halfway point, so
the shape holds from a 4x6 ambush to a 12x12 field.

**What is not charged**, and why:

- **A Counter riposte.** It is a reaction, not an action, it fires on somebody else's turn, and
  its owner never chose to spend anything.
- **A whiff** (`attackTile`). Being outplayed already costs the action; billing the miss too
  would punish one mistake twice, and this command exists precisely so the whiff is *visible*.
- **A Feral's bite.** See above.

### Why this reverses "Bones buy magic, and only magic"

`docs/07_deck_building.md` and the combat overhaul both state that pillar, and it was written
about *bodies costing Bones to summon* — a one-off purchase against a trickle, where "a 3-Bone
ranged body is three turns of the entire economy." Buying a board meant casting nothing.

This is the opposite shape: a **cycle**, where the warband funds itself. A board is now what
lets you cast at all. The complaint the pillar answered does not apply to it, but the pillar as
written does contradict it, and the contradiction is deliberate rather than drift.

The problem it solves: attacking was free and unbounded, so a turn was ten or more free unit
actions against one or two card plays, and the deck was a garnish on a turn that was already
full. Measured over the shipped encounters, attacks ran 0.63 a turn against 1.16 cards, with
Bones left unspent every turn and nothing to spend a body's idleness on.

## 3. The Pact

**Hero and Companion share one HP pool.** At zero, you lose.

The Commander is off-grid, standing beyond the back row. It is a legal **damage** target via
`{ kind: 'portrait', side }` — that is how the Bound Form redirect, status ticks, Resonance
armour and healing all address a Pact — but it is never an **attack** target. `legalAttacks`
does not offer it at any range, from any tile, to either side.

The way to a Pact is the Companion's Bound Form below. Every fight that has a Commander
fields one for them (`EncounterDef.enemyCompanion`, required outside a `victory: 'rout'`),
because a Commander with no body is a Pact nothing can reach.

### Bound Forms

The Companion's body **on the grid**.

- Keeps **no health of its own** — every wound is dealt straight to the Pact.
- Cannot be tithed — `applyTithe` returns zero for a `BoundForm`, and `bloodTitheRefusal`
  turns the command away outright.
- **Never grows.** Its power is the Pact's, and the Pact does not grow. This is
  belt-and-braces: the card carries no Growth keyword *and* `growUnit()` returns early
  for `BoundForm` — as does `attachAura` — so a future effect granting Growth to
  everything you control still cannot grow it.
- Its `hp` field is cosmetic, set to the Pact's total so anything reading a health
  fraction reads full rather than a misleading sliver.

Companion-source cards are cast **from where it stands**. Walking it forward is what
extends your reach, and the same step is what puts the Pact in danger.

### Resonance

The first **Companion-source** card played each turn fires the Companion's school passive.
Once per turn (`resonanceUsedThisTurn`), so it stays predictable and cannot spiral when a
turn dumps several cards.

| School | Name | Effect |
|---|---|---|
| pyre | **Ember Watch** | Ignites (1 Burn) every enemy in the Companion's column |
| frost | **Rime Guard** | +20 Persistent Armor to your Hero |
| surge | **Storm Tithe** | Pays 1 Bone back |
| dusk | **Grave Tithe** | Drains 20 HP from the lowest-HP enemy |
| bloom | **Verdant Growth** | Returns 20 HP to the Pact (`VERDANT_GROWTH_HEAL`) |
| bulwark | **Shield Oath** | +10 Persistent Armor to your units in the Companion's column |
| arcane | **Marginalia** | Draws a card |

Every school a Companion can belong to has one. A species whose school had no entry would
promise a passive on the selection screen and deliver nothing in the fight, so a test holds
the two lists together.

> **Healing.** `healCommander` is the only thing in the game that puts health back, and
> Verdant Growth is the first caller — `healed` sat in the event union with an animation
> waiting for it long before anything emitted one. It clamps at the ceiling and stays
> silent when nothing is owed, because a floater reading "+0" is worse than no floater.

> The trigger is **source**, not school. A Surge card marked `source: 'hero'` does not fire
> Storm Tithe; a Pyre Companion card in a Voltara deck would.

> **Shield Oath** is Ember Watch's shape pointed the other way: same column, same
> `apply(ctx, side, column)`, allies instead of enemies. Armour on the *bodies* rather than
> on the Hero, because Bulwark's argument is that the line holds — armouring the portrait
> would be Rime Guard under another name.

> **Marginalia** is the first Resonance to touch the hand rather than the board. It routes
> through the ordinary draw, so the hand limit and the overdraw burn both still apply: a
> full hand turns the passive into a Marrow and a burnt card. That is what makes
> `bonusHandLimit` a build rather than a nicety.

---

## 4. The Board

| Term | Definition |
|---|---|
| **Arena** | 4×4 (`MIN_ARENA`) to 12×12 (`MAX_ARENA`), validated at construction |
| **Coord** | `x` = column, left to right. `y` = row — **0 is the enemy backline**, `h-1` the player's |
| **Territory** | two rows deep from your own edge; **one row** at height ≤ 5 (`territoryDepthFor`) |
| **Footprint** | `1` is 1×1; `2` is a 2×2 **Behemoth** |
| **Anchor** | the single coordinate a unit is keyed to; `cellsOf` expands it |
| **Distance** | Chebyshev throughout — diagonals count as one step |

A short arena cannot afford two-deep territories on both sides: at height 4 they would
consume the whole board, leaving no neutral ground and every opening body already in contact.
The fallback keeps the three-zone structure — yours / neutral / theirs — intact at every
supported size.

### Hazards

Terrain, not entities. They never block movement and cannot be attacked.

| Kind | Effect |
|---|---|
| `steam_fog` | blocks ranged LoS through the tile; movement unaffected. Left by Vaporize |
| `rubble` | crossing costs 2 MOV (`RUBBLE_MOVE_COST`). Blocks nothing. **Permanent** |
| `current` | carries whatever stands on it one tile at the end of the round |

### Weather

Global and permanent, so it lives on the encounter where the hazard tick cannot age it
away.

| Kind | Effect |
|---|---|
| `rain` | fire damage −10 (`RAIN_FIRE_PENALTY`); shock earths itself through whatever it hits — the **Arc** reaction, §9 |
| `fog` | nothing sees past 3 tiles (`FOG_VISION`), anyone, any direction |
| `gale` | ranged reach +1 downwind, −1 into it. Melee untouched |

Fog shortens a spell exactly as it shortens a bow. Gale is deliberately **not** applied to
spells — it bends arrows, not sorcery.

---

## 5. Units

### Keywords

| Keyword | Rule |
|---|---|
| **Haste** | can move and attack the turn it is deployed |
| **Dormant** | cannot move or attack the turn it is summoned |
| **Impact** | triggers an effect the moment it lands, but cannot act that turn |
| **Counter** | strikes back for full Attack whenever hit in melee — **and survives**. A blow that kills it outright takes no counter-damage |
| **Guardian** | blocks line of sight |
| **Growth** | grows at the start of its owner's turn, if it survived the opposing round. **Enemy-side only** — see below |
| **Retain** | stays in hand at end of turn instead of being discarded |
| **PowerTier** | a high-cost finisher |
| **BoundForm** | the Companion's body; its wounds are the Pact's |
| **Feral** | wild; belongs to no one, fights everyone, everyone may fight it. What it goes *after* is set by `hunts` |

> **The blood tithe is not a gate.** `bloodTitheRefusal` never looks at a keyword, and
> there is no keyword left to look at. Every body bleeds at the same base rate — **30**
> health (`TITHE_DAMAGE`) for **2** Marrow (`TITHE_MARROW`), plus whatever that stat block's
> `titheBonus` adds — so the old `sacrificeValue > 0` test has no successor. Exhaustion is
> what caps a body at one tithe a turn, not the resource. The only refusals are a Bound
> Form, a unit already carrying `exhaust`, and one that cannot act. "Would die" is
> deliberately *not* a refusal — a lethal tithe is a legal play and occasionally the right
> one, and the Marrow is credited *before* the wound lands, so it still pays.

### Growth

The enemy's clock, and only the enemy's. Fires at the start of the owner's turn for units
that lived through the opposing round. **Never on the deploy turn** — `freshlySummoned`
absorbs the first tick and clears.

**Enemy-side only.** `growUnit` refuses anything whose `side` is not `enemy`, because the
player's bodies grow through **Auras** instead, and those hard-stop at three stacks. A
player unit carrying both would be growing on two clocks at once and the looser one would
win. The gate is on the side rather than on the card data, so an enemy fielding a body the
player can also field still gets its clock.

1×1 units cap at **+3** stacks (`GROWTH_CAP`); Behemoths at **99**
(`GROWTH_CAP_BEHEMOTH`) — near-endless, but not uncapped. It was `Infinity`, which was
both a balance claim nobody meant literally and a real bug: `Infinity` is not JSON, so a
saved fight reloaded with the ceiling replaced by `null`. Either ceiling is held per-unit
as `escalationCap`. It fires even on Frozen or Stunned units — being held down does not
stop something growing.

The per-unit growth is still spelled `escalationBonus: { atk, hp }` on the stat block, and
the event is still `escalated`. The mechanic was renamed and fenced; the field names were
not.

### Attack profiles

Undefined is free aim within range, needing a clear line.

- **`lineOnly`** — fires only down a rank, file, or diagonal. Anything on the line stops it.
- **`arcing`** — lobs over everything and needs no line at all, but cannot hit what is close.

The spell-side spelling is `vector: 'linear'`, deliberately the same geometry: a beam is a
beam whether a unit or a card threw it.

An `arcing` unit needs a `rangeMin` above 1. Without the blind spot it is simply a better
crossbow — shooting over everything *and* defending itself — so the minimum is the price
of the arc, not a detail.

### On-hit riders

```ts
interface OnHitRider { status: StatusKind; stacks: number; }
```

A status an ordinary attack leaves on whatever **survives** it. Deliberately a status and
never a number: a rider that added damage would be an attack stat wearing a different
name, which is the same reason `CombatBoons` has nowhere to put one.

Applied **after** the blow resolves, so a unit can never charge a target and cash in its
own reaction in one swing. Opt-in: a stat block without `onHit` swings exactly as before.

Five refusals, and the first four are one rule — **a rider is what a landed blow leaves on
a living body**:

| It will not brand | Because |
|---|---|
| a corpse | a status on something already removed is bookkeeping nobody reads |
| *from* a corpse | the attacker is re-read after the blow; Counter and mark blasts resolve first, so an attacker can be dead by the time its own rider would land |
| a blow armour ate whole | `hpLoss > 0`, the same test marks and four of the six reactions use. Plate is a real answer to a Plague-Bearer |
| an obstacle or a portrait | neither carries a status field |
| a **Bound Form** | it keeps no health of its own, so every tick would be redirected to the Pact — a melee rider would be the one thing in the game that poisons a portrait |

A **sealed** Alpha is refused too, though that gate never fires on its own: `isSealed` is
the first thing `dealDamage` checks, so a sealed target always reports zero `hpLoss` and
the wound rule turns the rider away first. Kept because the two say different things, and
the day the wound rule is loosened the seal must not loosen with it.

> The rider is bound to the **`attack` command**, not to the damage pipeline. Counter
> retaliation, `cleaveFront`, collisions, spells and mark blasts all deal damage without
> one. It also still ignores `chainCancelled` — deliberately: a Damage Gate stops a
> *cascade*, and venom is not a cascade.

> `scenario.ts:addUnit` builds units by hand rather than calling `spawn.ts`, so **every new
> stat-block field has to be added in both places**. It copied `attackProfile` but not
> `onHit`, and the tests silently exercised a unit the game would never produce.

### Reach, and who has it

`range` / `minRange` / `vector` / `needsLoS` are **only read for `source: 'companion'`
cards.** `castOriginCells` returns `'global'` for any other source, because the Hero is
off-grid and has no position to measure from.

A Hero card that declares a range is stating a rule the engine will not apply. Express
reach through the *target shape* instead.

---

## 6. Cards

### Target specs vs. area shapes

These are two different vocabularies and are the most common place to slip.

**`TargetSpec`** — what the player must *pick*:
`none` · `emptyTile` · `entity` · `adjacentEnemy` · `line` · `unitOrPortrait` · `global`

**`AreaSpec`** — which tiles the effect then *touches*:
`target` · `line` · `adjacent8` · `adjacentCross` · `plus` · `cone` · `all` · `lowestHpEnemy`

A radiating card is therefore `target: emptyTile` + `area: adjacentCross` — you pick the
point, the area falls around it. Targeting a *unit* would centre the cross on the victim
and hit their neighbours instead of them.

`adjacentCross` is the four orthogonals and **not** the diagonals; `adjacent8` is all
eight. A `cone` needs a `line` target because it is the only one carrying a direction — a
cone with no facing is a circle.

> **The pull trap.** `originOf` reads an entity target's own anchor as the origin, so a
> `pullArea` aimed at an entity computes a direction of `{0,0}` and `displaceArea` skips
> the unit entirely. An entity-targeted pull is a **silent no-op**. Use a `line` or `tile`
> target, which carry an origin the drag can be *toward*.

### Effect ops

`seq` · `damage` · `summon` · `spawnObstacle` · `spawnConstruct` · `attachMark` · `push` ·
`grantArmor` · `applyStatus` · `consumeTarget` · `tithe` · `attachAura` · `detonateAura` ·
`heal` · `revive` · `extractMarrow` · `drawCards` · `shoveArea` · `pullArea` ·
`detonateAllMarks` · `cleaveFront` · `anchorTether` · `ifMet` · `gainBones` ·
`spawnHazard` · `clearStatus`

`tithe` and the `bloodTithe` command both resolve through the single `applyTithe`, so a
card cannot invent a tithe that skips the Exhaustion or pays on a different curve — the
only thing a card gets to choose is the two numbers.

Cards are **data, not closures**, so the AI can read a card's shape to enumerate targets
and new cards need no engine changes.

`spawnConstruct` raises an obstacle at the *casting spell's* strength rather than the
definition's — but `spawnObstacle` still refuses any def without an `obstacleHp`, so a
construct card must carry one anyway.

Both spawn ops record what they built into `CardPlayContext.spawnedObstacleId`, the
counterpart to `summonedUnitId`. `attachMark` falls back to it when nothing was picked,
which is what lets a single `seq` **raise a thing and then wire it** — a card aimed at an
empty tile has no entity in `chosen`, so without the handoff the mark finds no host and
vanishes silently.

### Hand and deck

| | |
|---|---|
| Opening hand | 5 (`OPENING_HAND`) — this **is** turn one's draw |
| Draw per turn | 4 (`DRAW_PER_TURN`), from turn 2 |
| Hand limit | 7 (`HAND_LIMIT`), stored per-commander so gear can move it |
| Overdraw | **burns** the card and grants 1 Marrow |
| Empty deck | reshuffles the discard for free. **No fatigue** |

### Tiers

**Tier is derived, never authored.** `tierOf()`:

```
PowerTier or Behemoth        → 3
total cost ≥ 4               → 3
total cost ≥ 2               → 2
otherwise                    → 1
```

Derived so a new card cannot be added *without* a tier, which would silently grant it an
unlimited copy count. Copy limits: `{ 1: 3, 2: 2, 3: 1 }` (`TIER_COPY_LIMIT`), tracked by
**base id** so a Rank 2 printing cannot double the cap by the back door.

A Hero Deck is **4–12** cards (`MIN_DECK` / `MAX_DECK`), at most 2 Behemoths
(`MAX_BEHEMOTHS`), and **one** swap after seeing the arena (`MAX_SWAPS`). It was 12–30 when
the deck was the whole spellbook; the Companion's Grimoire now brings the other eight, and
one swap against a twelve-card half is an answer brought for the terrain rather than a
second deck built once the terrain is known.

---

## 7. Damage

**The pipeline** — the choke point every rule passes through. Nothing else in the engine
writes `hp` directly:

```
encounter Damage Gate → weather → elemental resistance → Brittle → reaction bonus
  → armor absorption → HP loss → reactions → mark triggers → death → lethal check
```

### A school is a damage type

**Every body strikes with its school's element.** `SCHOOL_DTYPE`
([`core/data/elements.ts`](../src/core/data/elements.ts)) is the only place the mapping is
written, and the attack reducer reads it instead of defaulting; `attackDtype` on a stat block
remains the override for the handful whose strikes are something else.

| School | Deals | School | Deals |
|---|---|---|---|
| Pyre | `fire` | Dusk | `decay` |
| Frost | `frost` | Bloom | `toxic` |
| Surge | `shock` | arcane / neutral | `physical` |
| Bulwark | `impact` | | |

This was not always so, and the way it failed is worth keeping. The attack reducer defaulted
to `physical` and `attackDtype` was opt-in — **two cards in the whole catalogue set it.** So a
school was a colour on a card frame: a Pyre minion could not detonate a Cinder Mark, because
that aligns to fire and spell and a Pyre body dealt neither. Marks were triggerable only by
spells, no weather could favour an element, and nothing could resist one.

`decay` and `toxic` were added at the same time, for the same reason. Dusk and Bloom were the
two schools with no damage type of their own — Dusk's own Mark hit with `spell`, which is
aligned by four *other* Marks, so a Soul Splinter could set off a Cinder Mark on its way past.

Note the deliberate omission: **arcane and neutral deal `physical`, not `spell`.** `spell` is
aligned by four of the six Marks, so a colourless body swinging with it would be the best
mark-trigger in the game. `spell` is what a *spell* with no element does.

| Type | Notes |
|---|---|
| `physical` | the absence of an element. Breaks ice (Shatter) |
| `fire` | Pyre. Damped by rain, fanned by a gale. Triggers Vaporize, Overload, Wildfire |
| `frost` | Frost. Triggers Superconduct |
| `shock` | Surge. Leaves `charged`; amplified by rain, which also earths it (Arc) |
| `impact` | Bulwark, and collisions and slams. Shatters |
| `decay` | Dusk |
| `toxic` | Bloom. Scattered by a gale. Aligned for the Rot-Root Snare |
| `spell` | magic with no element. Does **not** shatter ice. Aligned for Cinder, Rime, Arc |
| `true` | **ignores armor, Brittle, resistance and weather alike** |

### Elemental resistance

**A body shrugs off its own element by `SELF_ELEMENT_RESIST` (10),** applied before armour so a
resisted hit is a genuinely smaller hit rather than one absorbed differently. Flat, not a
percentage, because every figure in this game is a multiple of ten and a percentage is the one
thing that reliably produces a 27. Setting the constant to `0` disables the rule outright.

The self-resist covers **elements only**. Physical is the absence of an element and nothing
resists its own absence — without that guard, `arcane` and `neutral` bodies (which deal
physical) quietly gained 10 free armour against the commonest damage type on the board, and two
Scout Imps hit each other for 10 less than their stat blocks claimed.

A stat block may name its own table with `elementalMod`: **negative resists, positive is a
vulnerability.** The positive entries are the interesting ones — a resistance is a small reward
for bringing the wrong element, but a stated weakness is a body the player can be *told* how to
kill, which is a puzzle with an answer rather than a fight that takes longer.

A **Pact takes no elemental resistance.** A Commander's school is a deck-building fact; reading
it at the portrait would hand a Pyre player a fire resistance they never chose or paid for.

### Weather favours an element

`WEATHER_ELEMENTAL` is the table, and it replaced a single hard-coded rule that took 10 off
fire in rain and could express nothing else.

| Sky | Elemental effect |
|---|---|
| Rain | `fire` −10, `shock` +10 — water drowns one and carries the other |
| Gale | `fire` +10, `toxic` −10 — wind fans a flame and scatters a cloud |
| Fog | **none.** Its effect is on sight, and it is already the harshest weather in the game for that |

Because a body's swing now carries its school, this reaches further than it used to: rain
damping fire damps every Pyre *body*, not only Pyre cards. That is the intended reading of an
elemental warband caught in the wrong weather, and the pre-combat briefing names the sky —
generating its wording from this table — so the decision is an informed one.

**Collision:** a shoved unit that hits something takes 30 (`COLLISION_TARGET_DAMAGE`);
whatever it hit takes 20 (`COLLISION_BLOCKER_DAMAGE`); an obstacle takes 30
(`COLLISION_OBSTACLE_DAMAGE`). Walls hurt just as much as bodies — shoving into a wall is
free damage.

---

## 8. Statuses

| Status | Rule |
|---|---|
| **Burn** | 10 fire per stack (`STAT_SCALE`) at the start of the affected side's turn, then loses a stack |
| **Toxin** | 10 per stack at turn start, **as `true` damage** — armor is bypassed, not spent. `bonusToxinStacks` is resolved from the **source's** side when the poison is applied and stored amplified, so the tick never asks whose it was — and a trap collects for whoever laid it, not for whoever's turn sprang it |
| **Chill** | stacks toward freezing; the third stack (`CHILL_TO_FREEZE`) freezes instead of stacking |
| **Freeze** | cannot move or attack. Still grows. A physical blow Shatters it |
| **Entangle** | cannot move, but **can** attack |
| **Stun** | cannot move or attack. Applied by **Concussive Blow**'s rider — the first and only source |
| **Exhaust** | bled for Marrow: cannot move, strike or channel until the start of its owner's next turn. Deliberately **not** `stun` — Stun is what an enemy does to you, Exhaustion is what you do to your own body |
| **Fleet** | quickened: +1 MOV per stack, this turn only |
| **Brittle** | +20 damage from every hit (`BRITTLE_BONUS`) until it wears off |
| **Charged** | residual Surge energy. Does nothing alone — it is what fire and frost react to |
| **aetherPlated** | the seal on a cornered Alpha. Nothing reduces its health. Never ticks |
| **anchor** | tethered; cannot move, strike, or channel — only endure. Never ticks |

**Burn immunity** (`immuneToBurn`) burns stacks off at the same rate *without dealing
damage*. It is an immunity, not a cleanse — clearing the stacks would be a different and
stronger thing.

### Tick order — start of the active side's turn

1. **Toxin**, across all units
2. **Burn**, across all units
3. **Chill / Brittle / Charged** decay — the primers the opponent cashes in on their own turn
4. **Tile hazards** age
5. **Growth, then Auras** — both fire even on Frozen or Stunned units

The **holds** — Freeze, Stun, Entangle, Exhaust and Fleet — do not decay at the start of the
turn. They lift at the **end** of their owner's turn, so a one-stack hold covers one full turn
of the body it is on: a Freeze the player lands on their turn holds the enemy through the whole
of its next one, and a two-stack Dense Ice through two. (Ruled 2026-09-01. Decayed at the start
of the owner's turn, before it acted, a one-stack Freeze was gone before the enemy moved and
held nothing at all.)

---

## 9. The Elemental Matrix

Damage of one school landing on the status of another. Evaluated inside `dealDamage` — the
same choke point marks go through — so no card can bypass a reaction and none has to opt
in.

| Reaction | Trigger | Requires | Needs HP loss? | Effect |
|---|---|---|---|---|
| **Vaporize** | fire | chill | **yes** | 20 `true` damage; the tile fogs for a turn |
| **Shatter** | physical, impact | freeze | **no** | strips **all** Armor; 40 splash to adjacent |
| **Overload** | fire | charged | **yes** | 10 `true` damage; everything adjacent thrown a tile clear |
| **Superconduct** | frost | charged | **no** | strips **all** Armor, leaves Brittle 2 |
| **Wildfire** | fire | toxin | **yes** | consumes **every** Toxin stack for 20 fire each to adjacent |
| **Arc** | shock | *rain* (weather) | **yes** | 10 `physical` to every adjacent unit, either side |

Six of them, and `findReaction` walks the table in that order — first match wins, so a
target carrying chill *and* charged *and* toxin, hit by fire, Vaporizes and does nothing
else.

### How they interact with Armor

This is the part most worth reading twice.

**A reaction needs the hit to *land*.** Damage entirely absorbed by armor applies its
status but triggers **nothing** — exactly as a mark would not detonate. A Flame Surge
dealing 30 into a target with 50 armor charges nothing, burns nothing, and sets nothing
off.

`requiresHpLoss` is what governs this, and **two reactions deliberately set it to
`false`**:

- **Shatter** and **Superconduct** happen to what is *encasing* the target, not to the
  target. Requiring HP loss there would mean armor prevents the one reaction whose entire
  purpose is removing armor — a heavily armoured frozen target could never be broken.

### Bonus damage vs. true damage

Two distinct fields, and the distinction matters:

- **`bonusDamage`** rides the triggering blow and is therefore absorbed by armor like the
  rest of it.
- **`trueDamage`** lands *separately, after the hit resolves*, and bypasses armor
  entirely. A reaction meant to bite through plate has to be typed `true`, or a
  well-armoured target simply shrugs off the thing the reaction exists to do.

Vaporize's 20 and Overload's 10 are both `trueDamage`. Overload's is deliberately small on
the target and violent around it — the point is the shove, not the number.

### Consumption

All but Arc set `consumes: true` — the status is spent when it fires. Arc gates on the
**sky** rather than on a status (`requiresWeather`), and the rain does not run out, so it
fires every time the conditions are met rather than once. Wildfire consumes
*every* stack at once and scales its area damage by how many it took (`perStack: 20`), so a
tile dosed twice is a 40-damage detonation waiting for somebody's torch.

Reactions also respect `chainCancelled`, so a boss Damage Gate stops one mid-chain.

### Coverage

The five **status**-gated reactions are all reachable from obtainable cards:

| Status | Applied by |
|---|---|
| `chill` | Glacial Spike, Frost Nova, Flash Freeze |
| `freeze` | *indirectly* — three stacks of Chill |
| `charged` | Static Arc; Clockwork Bombardier's rider; **any `shock` damage** |
| `toxin` | Spore Cloud; Rot-Root Snare |
| `burn` | Ember Watch (the pyre Resonance) — no obtainable *card* applies it |

**Arc is the exception**, and gates on weather rather than on a status. No shipped
encounter is fought in rain, so it is reachable in principle and not in play.

`src/tests/elements.test.ts` asserts both halves: the card coverage above, and a
`KNOWN_UNREACHABLE` ledger for the weather gap that fails in *both* directions — so the
gap cannot be forgotten and closing it cannot go unrecorded.

> **Arc** is the one reaction that collides a school with the *ground* rather than with a
> status, and `requiresWeather` is the field that lets the table say so. A definition must
> gate on a status, a weather, or both — `findReaction` refuses one that names neither,
> since it would fire on every hit of its type.
>
> It was shipped long before it was written down. The behaviour lived in `conductShock`, a
> private function in the damage pipeline, while this document and `reactions.ts` both
> said Arc was deliberately absent and could not be expressed — on two premises that had
> quietly stopped being true, since `shock` is a `DamageType` and the Surge set ships four
> cards. Formalising it changed two things: it now **announces itself** (`reactionTriggered`)
> and **pays the Bone refund** under the standard 2/turn cap, and it now **requires the hit
> to land**, which the special case never did.
>
> **No shipped encounter is fought in rain**, so Arc is reachable in principle and not yet
> in play. `elements.test.ts` holds that gap in a `KNOWN_UNREACHABLE` ledger which fails in
> *both* directions — the gap cannot be forgotten, and closing it cannot go unrecorded.

---

## 10. Marks

Attach to a unit or obstacle and wait. **One mark per target.**

| Trigger | Fires when |
|---|---|
| `hpLoss` | the host loses ≥ 1 **actual** HP to an aligned damage type |
| `death` | the host dies — including bled dry by a tithe |

An unaligned killing blow **fizzles** it (`markFizzled`, reason `unaligned` / `devour` /
`gate`). Alignment is data, so rebalancing needs no engine change.

Blast patterns: `self` · `adjacent8` · `plus` · `lowestHpEnemy`.

**A blast always spares its own host.** `applyBlast` skips the entity the mark was attached
to, so a ringed mark catches what is standing *around* the host, never the host itself.

> `self` is therefore currently inert for damage: `blastTiles` returns the host's own cells
> and `applyBlast` then skips them. Nothing ships with it.

### Marks that leave a status

```ts
applies?: { status: StatusKind; stacks: number }[];
```

A mark may leave statuses on the units its blast catches, as well as (or instead of)
damage. A list, because one trap can do two things at once — roots that hold *and* poison —
and modelling that as two marks would need two attachments on a target that may hold one.

Statuses only, never a damage number: `damage` is already that field, and a second one is
how the two drift apart. A mark with `damage: 0` and an `applies` list is a pure control
trap — **`strike` skips `dealDamage` entirely at zero**, so an empty blow never emits a
`damageDealt` the HUD would draw as a "0", and never runs the reaction and mark-trigger
pipeline for a hit that did not land.

Riders land after the damage and only on a survivor, the same discipline `onHit` keeps.

### Trails

```ts
trail?: HazardKind;
```

A hazard laid on every tile a unit walks **off**, under its own power. Only the cells it
actually left — a 2×2 body stepping one square still stands on half of where it was, and
burying its own feet would immobilise it.

Being **shoved leaves nothing**. A body dragged by a Seismic Slam is not grinding its way
forward, and letting displacement lay a trail would hand the player a way to wreck their
own board by pushing the wrong creature around.

> A `rubble` trail is permanent and costs 2 MOV to cross, so a 1 MOV creature can never
> step back over its own wake. The Scrap-Titan commits to a direction, and the arena is
> different afterwards.

### What a Feral creature hunts

```ts
hunts?: 'nearest' | 'weakest';
```

`nearest` is the default and the rule every beast followed before the field existed: go
for whatever is closest, on either side. Hostility to both armies is not a special case —
it falls out of picking a target without consulting sides at all.

`weakest` makes a creature a finisher instead. It walks *past* a healthy body to reach a
hurt one, and it is the one exception to the "never walk away from a meal" rule: an
ordinary beast bites whatever is already in reach before moving, while a blood-hunter only
takes that opening bite when the thing it has decided on is already in front of it.

Both break ties by health, then row, then column, so a replay sends the beast after the
same body.

**Cascade:** a detonation reaching another mark-holder's *health* sets theirs off too.
Armor can stop a chain reaction cold.

`chainDepth` counts how deep in a cascade a hit is, and **every** secondary carries it:
a mark blast, a reaction's splash or shove, a Counter, a collision, a death. Absent means
depth zero — a card, a swing, a status tick, or a current, all of which genuinely start a
chain. `MAX_CHAIN_DEPTH` is **8**.

At the ceiling a hit still **lands and still kills**; it simply causes nothing further.
That is the same courtesy `chainCancelled` extends, and it is why removal is never gated:
a cascade running out of budget must not leave a body standing at zero health.

> Two things are deliberately *outside* the gate. Leaving a **status** is not a cascade
> link — `charged` causes nothing by itself, so a hit at the ceiling still marks what it
> hit, and the reaction that mark later enables is what the ceiling is there to stop. And
> **death removal**, for the reason above; what a death then *causes* inherits the depth
> and meets the same ceiling one level down.
>
> The count lived in `marks.ts` while only marks read it, which meant `mark → collision →
> mark` restarted at one and was bounded by nothing. A death mark was worse: it was
> hardcoded to depth 1, so every death in a chain began a fresh one.

### The set: one per element, and exactly one

A Mark is the Hero's only way to put an element on the board — the Companion casts the
Spells — so while three of the six existed, the Hero's half of the pairing was a different
size depending on who the player had tamed. All six ship now.

| Mark | Detonates | Trigger | Blast | Leaves |
|---|---|---|---|---|
| **Cinder Mark** | pyre · `fire` 40 | fire or spell | adjacent8 | — |
| **Rime Mark** | frost · `frost` 20 | frost or spell | adjacent8 | Chill 2 |
| **Arc Mark** | surge · `shock` 30 | shock or spell | plus 1 | Charged (from the damage) |
| **Tremor Mark** | bulwark · `impact` 40 | physical or impact | plus 1 | — |
| **Soul Splinter Mark** | dusk · `decay` 50 | on death | lowest-HP enemy | — |
| **Rot-Root Snare** | bloom · none (`damage: 0`) | physical, impact or toxic | adjacent8 | Entangle 1 + Toxin 1 |

Plus **Cask Blast** (arcane; the Volatile Cask's own detonation, attached by no card).

Three things about that table are load-bearing:

- **No two share a (trigger, damage type, leaves-behind).** Six traps that all read "damage
  in a ring" would be one trap printed six times, and `duelist.test.ts` asserts the triple is
  unique.
- **The Arc Mark carries no `applies` entry.** `dealDamage` already leaves 1 Charged on any
  unit a shock hit survives ([damage.ts:247](src/core/engine/damage.ts:247)), so a rider
  would be the card paying for what the engine gives free — the first draft did exactly
  that and landed two stacks.
- **Rime and Tremor are a pair.** Chill 2 is one short of a Freeze, and `impact` is what
  Shatters a Frozen body. The only deliberate combination in the set.

**No hybrid Marks, ever.** A fusion is the splicing bench's product and lives in a Grimoire
socket; a two-school Mark would be a Hybrid the Hero could deck, which is the thing that
sink exists to charge for.

### The card and the brand are two different things

The schools above are the **`MarkDef`** schools — the colour of the payload. Each of the
six attachable Marks also has a **card**, and since the role overhaul those cards are
filed as `arcane`, because a Mark is Hero kit: the Hero lays it, the Hero decks it, and only
the Hero may.

| | card `school` | `MarkDef` school | detonates as |
|---|---|---|---|
| Cinder Mark | arcane | pyre | `fire` |
| Rime Mark | arcane | frost | `frost` |
| Arc Mark | arcane | surge | `shock` |
| Tremor Mark | arcane | bulwark | `impact` |
| Soul Splinter Mark | arcane | dusk | `decay` |
| Rot-Root Snare | arcane | bloom | no damage — `entangle` + `toxin` |

Two fields answering two questions, and the split is load-bearing in both directions.
`validateDeck` reads the card's school and would refuse the Hero their own trap if a Mark's
colour were its payload's; the board renderer reads the `MarkDef`'s and would draw every
brand the same grey if it were the card's. `deckRoleRefusal` exempts `kind: 'mark'` from the
colour gate for exactly this reason — see `docs/07_deck_building.md`.

`Rune` was the old word for all of this. It survives in exactly one place: the save
loader's rename table, which maps `cinder_rune` and `soul_splinter_rune` onto their
current ids so an existing collection keeps the cards it paid for.

---

## 11. Ending a fight

`CombatResult` is `victory`, `defeat`, or `bound`.

**Sudden Death** — both commanders reduced to 0 at once. Both revive at **10 HP
(`STAT_SCALE`), 0 armor**;
every unit is wiped and every mark cleared; Bound Forms are then **restored**, because the
Pact did not end and a player with no Companion could not cast. A *second* mutual KO
during sudden death resolves to the instigator.

**Pacifist Lockout** — if neither commander takes damage for **6 full rounds**
(`STALL_LIMIT`), the arena starts collecting: **10** unblockable `true` damage
(`LOCKOUT_DAMAGE`) to both, escalating by 5 per further round. Set high enough that
competent play never sees it.

> It is **suspended while a tether is live.** The lockout breaks a stalemate between two
> sides who will not commit; a subjugation is the opposite — a timed siege in which the
> beast is sealed and neither commander *can* be hurt. Left running it would kill the
> player with damage the sealed Alpha is immune to.

**Escaped** — something left the board without dying, such as a scavenger reaching the
edge. Deliberately not a death: nothing killed it, nobody is owed the kill, and it should
read as a lost opportunity rather than a victory.

### The Harpoon Protocol

A cornered Alpha will not be killed and will not submit. At a quarter strength it seals
itself, and the fight stops being a damage race.

| Term | Meaning |
|---|---|
| **Prize** | the species binding it adds to the roster, named by `EncounterDef.subjugationPrize`. The engine never learns a species name; which beast is on the end of a tether belongs to the encounter, the same way opting in does |
| **Sealed** | set at the enrage and **never cleared** — a failed tether leaves it just as unkillable, forcing you back to the Rite rather than back to swinging |
| **Rite of Subjugation** | the card the protocol deals (`RITE_CARD_DEF`) |
| **Anchor** | the tethered unit. Cannot move, strike, or channel |
| **Rounds** | 3 (`SUBJUGATION_ROUNDS`). Survive them and the result is `bound` |
| **Tether snapped** | the anchor fell; the beast is loose again |

`sealed` is held in `Subjugation` rather than read off the `aetherPlated` status because
the body carrying that status can leave the board — a wipe, a sudden death — and a boss
that became mortal because its model was removed would be a way to win a subjugation by
accident.

Nothing in the system names a specific beast. A boss opts in by calling `beginSubjugation`
from its own script: the rules of the tether belong to the engine, which beast has one
belongs to the encounter.

**A binding is paid in the beast.** `resolveCombat` reads a `bound` result and rolls the
encounter's `subjugationPrize` through `tameCompanion` — the same roll a wild taming makes,
with its own constitution and its own knack, so a second Ignis is a different animal rather
than a duplicate. Rolled from the bounty seed *before* it advances, so a subjugation
replays to the same creature. An encounter that seals without naming a prize still pays
like a victory, which is what every fight did before the field existed.
