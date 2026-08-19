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

### The nine Commands

| Command | Effect |
|---|---|
| `playCard` | play a card from hand at a chosen target |
| `moveUnit` | spend a unit's move |
| `attack` | strike a unit, obstacle, or commander portrait |
| `attackTile` | a declared attack landing on a now-empty tile — costs the action, deals nothing |
| `sacrifice` | destroy your own unit to extract Marrow |
| `channel` | spend a unit's **attack** to extract Marrow instead of swinging |
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

### Pips — banked magic

+1 at the start of every turn, and unspent Pips carry over.

The ceiling is **8** (`PIP_CAP`), enforced **only during end-of-turn cleanup** — so
in-turn totals may freely exceed it. It is stored per-commander as `pipCap` rather than
read from the constant, because gear can move it and a rule that gear bends has to be a
value somebody can hold.

### Marrow — volatile magic

Extracted during a turn by sacrifice, devouring, or elemental reactions. **All unspent
Marrow is lost at end of turn.** Use it or lose it.

Sources:

| Source | Amount |
|---|---|
| Sacrificing a unit | its `sacrificeValue` |
| Channelling | 1 (`CHANNEL_MARROW`) |
| Overdrawing past the hand limit | 1, and the drawn card burns |
| Breaking a Marrow Geode | its `onDestroyReward.marrow` |
| Killing a scavenger | its `bounty.marrow` |

The verb is **extract**: op `extractMarrow`, event `marrowExtracted`.

### The two halves of a cost

```ts
interface CardCost { pips: number; marrow: number; }
```

Two genuinely different demands:

- **`pips` is generic energy.** Marrow substitutes for it freely, and does so **first**,
  because Marrow evaporates while Pips bank. A card priced purely in Pips is still fully
  payable out of a sacrifice, which is what keeps the ramp economy intact.
- **`marrow` is a strict requirement.** Pips cannot cover it at any price. A card asking
  for Marrow is asking you to have opened something up *this turn*, and no amount of
  patient banking substitutes for that.

`costBreakdown(marrowOnHand, cost)` is shared between the spend path and the play preview,
so the numbers shown before committing are produced by the same arithmetic that will run.

The badge reads `3`, or `1+2✦` when both are demanded, or `1✦` when only Marrow is.

### Reaction refunds

Landing an elemental reaction pays **1 Pip** back (`REACTION_PIP_REFUND`), capped at **2
per turn** (`REACTION_PIP_CAP`, tracked as `reactionPipsThisTurn`) — beyond that a cascade
would fund itself, which is a loop rather than a reward.

Emitted as `pipRefunded`, deliberately distinct from the generic `pipGained`: turn income
is expected and silent, a refund is a reward for a setup that worked and is worth saying
out loud, at the tile where it happened.

> Voltara's **Storm Tithe** Resonance pays through the same credit but deliberately does
> **not** spend the reaction budget — it is already limited to once per turn by
> `resonanceUsedThisTurn`, and taking a slot would make the Surge school pay for its own
> passive out of the reactions it exists to set up.

---

## 3. The Pact

**Hero and Companion share one HP pool.** At zero, you lose.

The Commander is off-grid, standing beyond the back row, and is a legal damage target via
`{ kind: 'portrait', side }`. `portraitRow` gives it a virtual row — `height` for the
player, `-1` for the enemy — used for melee reach and ranged LoS vectors.

### Bound Forms

The Companion's body **on the grid**.

- Keeps **no health of its own** — every wound is dealt straight to the Pact.
- Cannot be sacrificed (`sacrificeValue: 0`, and the command refuses `BoundForm` outright).
- **Never Escalates.** Its power is the Pact's, and the Pact does not grow. This is
  belt-and-braces: the card carries no Escalate keyword *and* `escalate()` returns early
  for `BoundForm`, so a future effect granting Escalate to everything you control still
  cannot grow it.
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
| frost | **Rime Guard** | +2 Persistent Armor to your Hero |
| surge | **Storm Tithe** | Pays 1 Pip back |
| dusk | **Grave Tithe** | Drains 2 HP from the lowest-HP enemy |
| bloom | **Verdant Growth** | Returns 2 HP to the Pact (`VERDANT_GROWTH_HEAL`) |
| bulwark | **Shield Oath** | +1 Persistent Armor to your units in the Companion's column |
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
consume the whole board, leaving no neutral ground and putting every tile within melee
reach of a portrait. The fallback keeps the three-zone structure — yours / neutral /
theirs — intact at every supported size.

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
| `rain` | fire damage −1 (`RAIN_FIRE_PENALTY`); arcing shots splash 1 (`RAIN_ARC_DAMAGE`) |
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
| **Escalate** | grows at the start of your turn, if it survived the enemy round |
| **Retain** | stays in hand at end of turn instead of being discarded |
| **PowerTier** | a high-cost finisher |
| **Sacrifice** | glossary text only — see below |
| **BoundForm** | the Companion's body; its wounds are the Pact's |
| **Feral** | wild; belongs to no one, fights everyone, everyone may fight it. What it goes *after* is set by `hunts` |

> **Sacrifice is not a gate.** The `sacrifice` command checks `sacrificeValue > 0` and
> never looks at the keyword. Any unit worth Marrow can be offered; the keyword is
> documentation. Set `sacrificeValue: 0` to make something un-sacrificeable.

### Escalation

Fires at the start of your turn for units that lived through the enemy round. **Never on
the deploy turn** — `freshlySummoned` absorbs the first tick and clears.

1×1 units cap at **+3** stacks; **Behemoths are uncapped** (`escalationCap`). It fires
even on Frozen or Stunned units — being held down does not stop something growing.

The per-unit growth is `escalationBonus: { atk, hp }` on the stat block.

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
| *from* a corpse | the attacker is re-read after the blow; Counter and rune blasts resolve first, so an attacker can be dead by the time its own rider would land |
| a blow armour ate whole | `hpLoss > 0`, the same test runes and three of the five reactions use. Plate is a real answer to a Plague-Bearer |
| an obstacle or a portrait | neither carries a status field |
| a **Bound Form** | it keeps no health of its own, so every tick would be redirected to the Pact — a melee rider would be the one thing in the game that poisons a portrait |

A **sealed** Alpha is refused too, though that gate never fires on its own: `isSealed` is
the first thing `dealDamage` checks, so a sealed target always reports zero `hpLoss` and
the wound rule turns the rider away first. Kept because the two say different things, and
the day the wound rule is loosened the seal must not loosen with it.

> The rider is bound to the **`attack` command**, not to the damage pipeline. Counter
> retaliation, `cleaveFront`, collisions, spells and rune blasts all deal damage without
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

`seq` · `damage` · `summon` · `spawnObstacle` · `spawnConstruct` · `attachRune` · `push` ·
`grantArmor` · `applyStatus` · `sacrificeTarget` · `extractMarrow` · `drawCards` ·
`shoveArea` · `pullArea` · `detonateAllRunes` · `cleaveFront` · `anchorTether`

Cards are **data, not closures**, so the AI can read a card's shape to enumerate targets
and new cards need no engine changes.

`spawnConstruct` raises an obstacle at the *casting spell's* strength rather than the
definition's — but `spawnObstacle` still refuses any def without an `obstacleHp`, so a
construct card must carry one anyway.

Both spawn ops record what they built into `CardPlayContext.spawnedObstacleId`, the
counterpart to `summonedUnitId`. `attachRune` falls back to it when nothing was picked,
which is what lets a single `seq` **raise a thing and then wire it** — a card aimed at an
empty tile has no entity in `chosen`, so without the handoff the rune finds no host and
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

Decks are 12–30 cards, at most 2 Behemoths, at most 5 swaps after seeing the arena.

---

## 7. Damage

**The pipeline** — the choke point every rule passes through. Nothing else in the engine
writes `hp` directly:

```
encounter Damage Gate → armor absorption → HP loss → rune triggers → death → lethal check
```

| Type | Notes |
|---|---|
| `physical` | breaks ice (Shatter) |
| `fire` | reduced by rain. Triggers Vaporize, Overload, Wildfire |
| `frost` | triggers Superconduct |
| `shock` | leaves `charged` |
| `spell` | magic. Does **not** shatter ice. Aligned for Cinder Rune |
| `impact` | collisions and slams. Shatters |
| `true` | **ignores armor entirely** |

**Collision:** a shoved unit that hits something takes 3 (`COLLISION_TARGET_DAMAGE`);
whatever it hit takes 2 (`COLLISION_BLOCKER_DAMAGE`); an obstacle takes 3. Walls hurt just
as much as bodies — shoving into a wall is free damage.

---

## 8. Statuses

| Status | Rule |
|---|---|
| **Burn** | 1 fire per stack at the start of the affected side's turn, then loses a stack |
| **Toxin** | 1 per stack at turn start, **as `true` damage** — armor is bypassed, not spent. `bonusToxinStacks` is resolved from the **source's** side when the poison is applied and stored amplified, so the tick never asks whose it was — and a trap collects for whoever laid it, not for whoever's turn sprang it |
| **Chill** | stacks toward freezing; the third stack (`CHILL_TO_FREEZE`) freezes instead of stacking |
| **Freeze** | cannot move or attack. Still Escalates. A physical blow Shatters it |
| **Entangle** | cannot move, but **can** attack |
| **Stun** | cannot move or attack. Applied by **Concussive Blow**'s rider — the first and only source |
| **Brittle** | +2 damage from every hit (`BRITTLE_BONUS`) until it wears off |
| **Charged** | residual Surge energy. Does nothing alone — it is what fire and frost react to |
| **aetherPlated** | the seal on a cornered Alpha. Nothing reduces its health. Never ticks |
| **anchor** | tethered; cannot move, strike, or channel — only endure. Never ticks |

**Burn immunity** (`immuneToBurn`) burns stacks off at the same rate *without dealing
damage*. It is an immunity, not a cleanse — clearing the stacks would be a different and
stronger thing.

### Tick order — start of the active side's turn

1. **Toxin**, across all units
2. **Burn**, across all units
3. **Freeze / Entangle / Stun / Chill / Brittle / Charged** decay
4. **Tile hazards** age
5. **Escalation** — fires even on Frozen or Stunned units

---

## 9. The Elemental Matrix

Damage of one school landing on the status of another. Evaluated inside `dealDamage` — the
same choke point runes go through — so no card can bypass a reaction and none has to opt
in.

| Reaction | Trigger | Requires | Needs HP loss? | Effect |
|---|---|---|---|---|
| **Vaporize** | fire | chill | **yes** | 2 `true` damage; the tile fogs for a turn |
| **Shatter** | physical, impact | freeze | **no** | strips **all** Armor; 4 splash to adjacent |
| **Overload** | fire | charged | **yes** | 1 `true` damage; everything adjacent thrown a tile clear |
| **Superconduct** | frost | charged | **no** | strips **all** Armor, leaves Brittle 2 |
| **Wildfire** | fire | toxin | **yes** | consumes **every** Toxin stack for 2 fire each to adjacent |
| **Arc** | shock | *rain* (weather) | **yes** | 1 `physical` to every adjacent unit, either side |

### How they interact with Armor

This is the part most worth reading twice.

**A reaction needs the hit to *land*.** Damage entirely absorbed by armor applies its
status but triggers **nothing** — exactly as a rune would not detonate. A Flame Surge
dealing 3 into a target with 5 armor charges nothing, burns nothing, and sets nothing off.

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

Vaporize's 2 and Overload's 1 are both `trueDamage`. Overload's is deliberately small on
the target and violent around it — the point is the shove, not the number.

### Consumption

All but Arc set `consumes: true` — the status is spent when it fires. Arc gates on the
**sky** rather than on a status (`requiresWeather`), and the rain does not run out, so it
fires every time the conditions are met rather than once. Wildfire consumes
*every* stack at once and scales its area damage by how many it took (`perStack: 2`), so a
tile dosed twice is a four-stack detonation waiting for somebody's torch.

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
> and **pays the Pip refund** under the standard 2/turn cap, and it now **requires the hit
> to land**, which the special case never did.
>
> **No shipped encounter is fought in rain**, so Arc is reachable in principle and not yet
> in play. `elements.test.ts` holds that gap in a `KNOWN_UNREACHABLE` ledger which fails in
> *both* directions — the gap cannot be forgotten, and closing it cannot go unrecorded.

---

## 10. Runes

Attach to a unit or obstacle and wait. **One rune per target.**

| Trigger | Fires when |
|---|---|
| `hpLoss` | the host loses ≥ 1 **actual** HP to an aligned damage type |
| `death` | the host dies or is sacrificed |

An unaligned killing blow **fizzles** it (`runeFizzled`, reason `unaligned` / `devour` /
`gate`). Alignment is data, so rebalancing needs no engine change.

Blast patterns: `self` · `adjacent8` · `plus` · `lowestHpEnemy`.

**A blast always spares its own host.** `applyBlast` skips the entity the rune was attached
to, so a ringed rune catches what is standing *around* the host, never the host itself.

> `self` is therefore currently inert for damage: `blastTiles` returns the host's own cells
> and `applyBlast` then skips them. Nothing ships with it.

### Runes that leave a status

```ts
applies?: { status: StatusKind; stacks: number }[];
```

A rune may leave statuses on the units its blast catches, as well as (or instead of)
damage. A list, because one trap can do two things at once — roots that hold *and* poison —
and modelling that as two runes would need two attachments on a target that may hold one.

Statuses only, never a damage number: `damage` is already that field, and a second one is
how the two drift apart. A rune with `damage: 0` and an `applies` list is a pure control
trap — **`strike` skips `dealDamage` entirely at zero**, so an empty blow never emits a
`damageDealt` the HUD would draw as a "0", and never runs the reaction and rune-trigger
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

**Cascade:** a detonation reaching another rune-holder's *health* sets theirs off too.
Armor can stop a chain reaction cold.

`chainDepth` counts how deep in a cascade a hit is, and **every** secondary carries it:
a rune blast, a reaction's splash or shove, a Counter, a collision, a death. Absent means
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
> The count lived in `runes.ts` while only runes read it, which meant `rune → collision →
> rune` restarted at one and was bounded by nothing. A death rune was worse: it was
> hardcoded to depth 1, so every death in a chain began a fresh one.

Shipped: **Cinder Rune** (pyre; fire or spell; 4 fire to adjacent8), **Rot-Root Snare**
(bloom; entangle and toxin, `damage: 0`), **Cask Blast** (the Volatile Cask's detonation,
attached by no card) and **Soul Splinter Rune** (dusk; on death; 5 to the lowest-HP
enemy).

---

## 11. Ending a fight

`CombatResult` is `victory`, `defeat`, or `bound`.

**Sudden Death** — both commanders reduced to 0 at once. Both revive at **1 HP, 0 armor**;
every unit is wiped and every rune cleared; Bound Forms are then **restored**, because the
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
