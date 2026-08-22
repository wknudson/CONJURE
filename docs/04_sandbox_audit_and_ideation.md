# 04 — Sandbox Audit & Ideation

Two halves. **Part 1** is a QA pass: where the written vocabulary and the reducer disagree,
and what the engine will do with cases nobody has built yet. **Part 2** is design work
written in the engine's own words, so nothing here needs an engine change unless it says so.

Every claim in Part 1 carries a `file:line`. Terms are spelled exactly as
[`02_combat_lexicon.md`](02_combat_lexicon.md) spells them, so the two grep together.

Audited at `0d8a189`, against a green suite (843 tests, 58 files).

> **Status.** The Game Director has ruled on Part 1 and the rulings are implemented:
> §5.1 (dangling attacker), §5.2 (the pipeline gates), the Bound Form hole in §1, §5.4
> (both hybrids) and §7.2 (the Harpoon payoff) are **done** — see `onHitGates.test.ts` and
> `subjugationPayoff.test.ts`. The findings below are left as written, because an audit
> that edits itself as it is answered stops being a record of what was found.
>
> **Part 1 is now closed.** §5.3 (toxin attribution), §3.1 (`stun` had no source), §5.5
> (chain depth) and §4.4 (what Arc is) have all been actioned — see
> `finalCompanions.test.ts` and `cascades.test.ts`. Part 2 remains as written.
>
> One finding survives its own fix and is worth keeping visible: **no encounter is fought
> in rain**, so Arc is formal, tested, and still unreachable in play. It is held in
> `elements.test.ts`'s `KNOWN_UNREACHABLE` ledger rather than left to be rediscovered.

---
---

# PART 1 — The Engine Audit

## 1. The `onHit` rider is bound to a command, not to damage

This is the finding the rest of the section hangs off.

`applyOnHit` has **exactly one call site in the codebase**: the last line of the `attack`
reducer (`src/core/engine/engine.ts:283`, defined `:296`). It is not part of the damage
pipeline. `dealDamage` has never heard of it, and no field on `DamageRequest`
(`src/core/engine/damage.ts:26-35`) carries it.

Every damage-producing path, and whether the rider goes with it:

| Path | Site | `cause` | Rider? |
|---|---|---|---|
| Unit attack command | `engine.ts:275` | `attack` | **yes** |
| Counter / riposte | `damage.ts:260` | `counter` | no |
| Spell damage (`op:'damage'`) | `effects.ts:42` | `spell` | no |
| `cleaveFront` | `effects.ts:217` | `spell` | no |
| Mark blast | `marks.ts:150` | `mark` | no — has its own rider loop at `:157` |
| Burn / Toxin tick | `status.ts:85` | `status` | no |
| Collision (3 sites) | `displacement.ts:86,96,131` | `collision` | no |
| Rain shock conduction | `damage.ts:156` | `reaction` | no |
| Reaction damage (3 sites) | `reactions.ts:81,105,166` | `reaction` | no |
| Obstacle burst | `death.ts:109` | `spell` | no |
| Pacifist Lockout | `turn.ts:176` | `status` | no |
| Resonance bolt (Grave Tithe) | `data/resonance.ts:105` | `spell` | no |

Feral and AI attacks **do** carry it, because both route through the same reducer
(`feral.ts:126` and `ai/enumerate.ts:53` both emit `{type:'attack'}`). That part is right.

Four consequences follow from where the call sits, and all four are live today.

**1.1 — The rider does not require the blow to land.** It runs unconditionally after
`dealDamage` returns, never reading `hpLoss`. Marks require real HP loss (`marks.ts:58`)
and so do three of the five reactions (`reactions.ts:66`). A Plague-Bearer swinging into
5 armour poisons through it.

**1.2 — The rider ignores `chainCancelled`.** Every other secondary effect checks it —
`damage.ts:132`, `reactions.ts:68`, `marks.ts:108`, `death.ts:87`. A boss Damage Gate that
stops a chain mid-flight does not stop the rider.

**1.3 — A dead attacker still brands its killer.** `attack()` captures the attacker once
(`engine.ts:250`). `killEntity` removes it from the map but never mutates the object
(`death.ts:36`). So when a Grave Sentinel's Counter kills a Plague-Bearer inside the
`dealDamage` at `engine.ts:275`, control returns to `:283` and reads `attacker.onHit` off a
**dangling reference**. `applyOnHit` validates the victim (`:300`) and never the attacker.
The corpse poisons the thing that killed it.

**1.4 — The rider reaches a sealed Alpha.** `isSealed` is the first gate in the damage
pipeline (`damage.ts:67`), returning zero before anything else runs. `applyOnHit` has no
such gate. Toxin therefore stacks on an unkillable boss; the stacks then tick at
`status.ts:83`, which **emits `statusTicked` with a damage number**, and the `dealDamage`
on the next line is swallowed by `isSealed` again. The subjugation cannot be won by
poisoning — that guarantee holds — but the status pipeline visibly reports damage that
never happens.

### The Bound Form hole

`damage.ts:80-84` enumerates, in a comment, everything the Bound Form's portrait redirect
deliberately bypasses: *armor on the unit, Counter, Brittle, elemental reactions, and
mark-on-damage.* **`onHit` is not in that list, and not in the targeting refusal either.**
`applyOnHit` only asks `target.kind === 'unit'` (`engine.ts:297`), and a Bound Form is a unit.

So: a Plague-Bearer hits the enemy Companion's body and applies real Toxin. Next tick,
`status.ts:85` damages that unit, which re-enters `damage.ts:85` and lands on the **Pact
pool** as `true` damage (`status.ts:20`) — armour-ignoring, straight to commander HP, and it
sets `commanderDamagedThisRound` (`damage.ts:186`). This is the only route by which a melee
unit's rider converts into commander damage. Whether it is a bug or the best thing in the
Bestiary is a design call, but it is currently an accident.

## 2. Cleave and Counter — the question, answered plainly

The question was what happens if an `onHit: Toxin` unit gains Cleave or Counter. The honest
answer is that one of those keywords does not exist and the other cannot reach the rider.

**Counter is real.** Declared at `src/contract/ids.ts:56`, implemented at
`src/core/engine/damage.ts:250-268`. It fires only on `cause === 'attack'` with a
`sourceUnitId` set, and `sourceUnitId` is only set when `isMelee` (`engine.ts:270-272`).
The retaliation carries `cause: 'counter'`, which fails its own trigger test — so
counter-of-a-counter is impossible by construction, bounded at depth 1. **It does not call
`applyOnHit`.** A Counter unit with a rider would never apply it on the riposte. No card
has both today: the Counter holders are `grave_sentinel` (`starter.ts:100`) and the Bulwark
unit at `bulwark.ts:70`, neither with `onHit`.

Two smaller notes on Counter: an `arcing` attacker can never be countered (it is never
melee), so the Clockwork Bombardier charges targets from four tiles away with impunity; and
Counter is bypassed entirely against a Bound Form, because `damage.ts:85` returns before
`damageEntity` ever runs.

**Cleave is not a keyword.** It is absent from the `Keyword` union (`ids.ts:52-66`). There
is no multi-target melee anywhere — `attack()` takes a single `TargetRef`
(`types/commands.ts:8`). What exists is `cleaveFront`, an *effect op*
(`types/cards.ts:61`, `effects.ts:213-221`), used by exactly one card: `magma_brute`
(`starter.ts:127`), fired on deploy inside a `seq`. It deals **spell** damage, is not an
attack, cannot trigger Counter, and fires `onHit` zero times regardless of how many bodies
it catches.

**So the synergy is unreachable, and that is the useful part** — the rule can be decided
before anything is built rather than discovered afterwards. The recommendation is in §5.

## 3. Statuses: named, typed, and hooked up?

There is no **Frail**, **Leech**, or **Rooted** anywhere — not in the lexicon, not in the
glossary, not in `StatusKind` (`src/contract/ids.ts:26-50`; the union is named `StatusKind`,
not `StatusId`). The named set is ten. Three are clean, seven are worth a line.

| Status | Verdict |
|---|---|
| `chill`, `toxin`, `charged` | Clean — typed, applied by obtainable content, read by the reducer |
| **`stun`** | **Typed, read, decayed, HUD-iconed, glossed — and applied by nothing** |
| `freeze` | No direct applier; only chill overflow or `setupOnly` scenery |
| `burn` | No *obtainable card* applies it |
| `entangle` | Exactly one applier in the game |
| `brittle` | Behaviour drift against its own definition |
| `aetherPlated`, `anchor` | In the lexicon, absent from the player glossary |

### 3.1 `stun` is the largest gap in the sandbox

Every reference to `stun` outside tests is a **read**:

```
contract/ids.ts:32                 the union member
engine/movement.ts:114             canAct — gates move and attack
engine/status.ts:44                decay
engine/subjugation.ts:34           PURGED at the seal
engine/threat.ts:104               intent projection skips stunned foes
hud/TargetingController.ts:265     "held in place" refusal
render/BoardRenderer.ts:804        the 💫 icon
```

Zero cards, zero marks, zero riders, zero engine calls apply it. It is a complete hard-CC
primitive — gating, decay, threat model, icon, tooltip — with no way to reach it, and the
lexicon (`02:420`) and glossary (`glossary.ts:151`) both describe it as a live rule.
**§10.4 ships the first source.**

### 3.2 `freeze` has no direct applier

Only three stacks of chill (`status.ts:150-163`) or a `setupOnly` Cryo-Crystal
(`terrain.ts:85`) an encounter happens to place. No card names it. `elements.test.ts:433`
papers this over honestly (`if (out.has('chill')) out.add('freeze')`) — the coverage claim
is *derived*, not observed. This is what makes Shatter so hard to set up (§4.2).

### 3.3 `burn` is unreachable from an obtainable card

`isObtainable` excludes `spliceOnly` and `setupOnly` (`collection.ts:138-148`), which leaves
burn with three appliers and none of them a card you can draft: the pyre Resonance passive
(`resonance.ts:40`), the `spliceOnly` Cryo-Combustion (`hybrid.ts:54`), and `setupOnly`
scenery (`terrain.ts:97`). **Fire damage never applies Burn anywhere in the engine.**

Worth flagging separately: `resonance.ts:40` writes `foe.statuses.burn` **directly** rather
than calling `applyStatusTo` (`status.ts:193`). It is the only status application in the
game that skips the dispatcher, so it would miss the chill→freeze threshold and the toxin
bonus if it ever applied those. Harmless for burn today; a second write path regardless.

### 3.4 `brittle` drifts from its own definition

> Lexicon `02:421` — "+2 damage from **every hit** (`BRITTLE_BONUS`)"
> Glossary `glossary.ts:121` — "takes +2 damage from **every hit**"

```ts
// damage.ts:212-214
if (isUnit(entity) && (entity.statuses.brittle ?? 0) > 0 && req.dtype !== 'true') {
  amount += BRITTLE_BONUS;
}
```

`true` damage is exempt. So Brittle never amplifies Toxin ticks, Cull the Weak
(`arcane.ts:122`), or Vaporize's 2 and Overload's 1 — meaning **Superconduct's own output
does not amplify the other reactions' output**. The exemption is defensible (armour-piercing
damage arguably should not care about brittleness), but two player-facing texts currently
promise otherwise. Also: no renderer icon, so it draws as the `•` fallback
(`BoardRenderer.ts:812`).

### 3.5 Two protocol statuses are missing from the glossary

`aetherPlated` and `anchor` are both defined in the lexicon (`02:423-424`) and absent from
`glossary.ts` entirely. Note `lookup()` lowercases (`glossary.ts:202`), so an entry would
need the key `aetherplated`. Related: an anchored unit falls through
`TargetingController.ts:264-270` to the generic branch and is told it *"has already acted
this turn"* rather than that it is tethered — not false (`setAnchor` does burn both flags,
`subjugation.ts:138`) but the wrong explanation, which is the one thing the refusal pattern
exists to get right.

## 4. Elemental reactions: coverage, and two miswired cards

### 4.1 The matrix

`data/reactions.ts:68-125`. Lookup is `findReaction(dtype, statuses)` at `:141` —
**first match wins**, so array order is priority order.

| # | id | Trigger | Requires | Needs HP loss | Effect |
|---|---|---|---|---|---|
| 1 | `vaporize` | fire | chill | yes | 2 true; tile fogs |
| 2 | `shatter` | physical, impact | freeze | **no** | strip armour; 4 impact splash |
| 3 | `overload` | fire | charged | yes | 1 true; adjacent thrown a tile |
| 4 | `superconduct` | frost | charged | **no** | strip armour; Brittle 2 |
| 5 | `wildfire` | fire | toxin | yes | consumes every stack, 2 fire each |

Two structural notes. A unit carrying chill **and** charged **and** toxin hit by fire
resolves **Vaporize only** — `prepareReaction` returns a single `PendingReaction`
(`engine/reactions.ts:44-52`). There is no multi-reaction path, which is probably right but
is nowhere written down. And `ReactionDef.bonusDamage` is a **dead field**: declared
(`data/reactions.ts:27`), read (`engine/reactions.ts:50`), used by zero reactions.

### 4.2 Which reactions the player can actually assemble

Two facts shape everything below. **All unit attacks are `physical`** — hardcoded at
`engine.ts:278`, there is no per-unit damage type. **All collisions are `impact`**
(`displacement.ts:89,99,134`).

| Reaction | Prime | Trigger | Verdict |
|---|---|---|---|
| **Overload** | 3 routes (Static Arc, Bombardier rider, any shock damage) | 5+ fire sources | Healthiest in the matrix |
| **Vaporize** | 3 cards — **all Frost, all Boreas-only** | 5+ fire sources | Single-school prime |
| **Wildfire** | 2 — **both Bloom, both Sylva** | 5+ fire, **none of them Bloom** | Single-school prime, by design (`bloom.ts:8-13`) |
| **Superconduct** | Surge-only | **2 cards, Boreas-only** | **No in-school path exists** |
| **Shatter** | **zero direct appliers** | every basic attack | **Hardest to prime, easiest to trigger** |

Two of these are worth acting on.

**Shatter** is the reaction every deck can trigger and almost no deck can set up. Its
priming requires three casts of one school's chill, or scenery you do not control. §10.8
addresses it with an `onHit: chill` unit — a body that primes by doing what bodies do.

**Superconduct requires a cross-school deck by construction.** Priming is Surge-only,
triggering is Frost-only, and no single companion's starting deck contains both. It is
*legal* — `validateDeck` imposes no school restriction (`deckRules.ts:76-80`) and the pooled
`startingCollection()` grants both — but it is the only reaction with no in-school path, and
that is worth knowing deliberately rather than by accident.

### 4.3 Two hybrid cards do not do what they are named for

Both are `spliceOnly`, both are **untested** (`grep vaporize_blast src/tests` returns
nothing; same for `superconduct_strike`).

**Vaporize Blast cannot Vaporize on its own cast.** The card's own comment
(`hybrid.ts:134-137`) says it *"applies the frost first and the flame second, so the Vaporize
reaction fires off its own setup rather than needing a second caster — which is the whole
point of paying for a hybrid."* The effect is two `damage` nodes and no `applyStatus`
(`hybrid.ts:148-154`). **Frost damage never applies `chill`** — the only automatic
status-from-damage rule in the engine is shock→charged (`damage.ts:274-276`). So the fire
half finds nothing to react with, and the card only works on an already-chilled target:
precisely the case the comment says it removes.

**Superconduct Strike triggers Overload, not Superconduct.** It deals shock then fire
(`hybrid.ts:178-183`). The shock half does apply `charged`. The fire half then matches
**overload** — Superconduct requires a `frost` trigger (`data/reactions.ts:106`) the card
never deals. The card is well-built and the text is accurate (*"the arc jumps"* is exactly
Overload's shove); it is named for a reaction it cannot produce.

### 4.4 The Arc note is stale on both its premises

> Lexicon `02:503-507` — *"**Arc**, the rain/Surge reaction, is deliberately not implemented."*
> Data comment `reactions.ts:131-132` — *"There is no Surge damage type and no Surge card."*

Both premises are now false: `shock` is a `DamageType` (`ids.ts:21`) and `cards/surge.ts`
ships four Surge cards. More to the point, **the behaviour already exists**. Arc's described
effect — Surge damage on wet ground chaining to adjacent units — is implemented verbatim as
`conductShock` (`damage.ts:129-164`) and documented as a *weather* rule at `02:226`. It
simply is not a `ReactionDef`: it emits no `reactionTriggered`, pays no `pipRefunded`, and
is invisible to `findReaction`.

**And no encounter sets `rain`** — only `fog` (`glacial.field.ts:55`) and `gale`
(`narrow.ruin.ts:52`). So `dampenFire`, `conductShock`, `RAIN_FIRE_PENALTY` and
`RAIN_ARC_DAMAGE` are all currently unreachable in play. Rain is the most-implemented,
least-used feature in the codebase.

### 4.5 Lexicon staleness (documentation, not code)

- The coverage table (`02:494-499`) misses: the implicit shock→charged rule and the
  Bombardier's rider under `charged`; Rot-Root Snare under `toxin`; Cryo-Crystal under
  `freeze`; every splice-reachable applier; and it has no `burn` row at all.
- "Shipped: **Cinder Mark** and **Soul Splinter Mark**" (`02:588`) — there are four
  (`data/marks.ts` also ships `rot_root_snare` and `cask_blast`), and the same document
  describes Rot-Root's mechanic in detail at `02:533-548`. Summary line only.
- Burn immunity is documented one-sided (`02:427`); `immuneToToxin` behaves identically
  (`status.ts:71-77`).

## 5. Edge cases the engine would struggle with, and what to do

Five, ordered by how likely they are to bite.

### 5.1 The dead attacker's rider

**What happens.** A Plague-Bearer killed by its target's Counter still poisons that target,
via a dangling object reference (`engine.ts:250` captured, `death.ts:36` deletes from the
map without mutating, `:283` reads it anyway). Same for an attacker killed mid-swing by a
mark blast (`damage.ts:287`) or a rain arc.

**Fix.** Re-read the attacker inside `applyOnHit`, mirroring the victim check that is
already there. Pass `attackerId` instead of the rider:

```ts
function applyOnHit(ctx: Ctx, attackerId: string, target: TargetRef): void {
  const attacker = ctx.state.units[attackerId];   // ← the missing line
  if (!attacker?.onHit || target.kind !== 'unit') return;
  ...
}
```

One line, and it makes the two liveness checks symmetric. Note the mark path already uses a
stricter test (`marks.ts:221` checks `hp <= 0` as well as existence) — worth aligning on the
stricter one.

### 5.2 The rider pierces the Seal and the Damage Gate

**What happens.** `applyOnHit` checks neither `isSealed` nor `chainCancelled`, so Toxin
lands on an unkillable Alpha and then ticks, emitting `statusTicked` with a damage number
that `isSealed` immediately swallows.

**Recommendation — split the two.** Add the `isSealed` guard: phantom damage numbers on a
boss that cannot be hurt read as a bug to a player, and there is no design argument for
branding something the pipeline refuses to touch. Leave `chainCancelled` alone and **write
the ruling down**: a Damage Gate stops a *cascade*, and a venom rider is not a cascade — it
needs no force, which is the same reasoning that lets it ignore `hpLoss`. That asymmetry is
defensible; being undocumented is what makes it look accidental.

### 5.3 A rider's strength depends on whose turn it is

**What happens.** `toxinBonus` reads `players[activeSide].bonusToxinStacks`
(`status.ts:188-191`). The only `onHit: toxin` unit is `plague_bearer`, which is `setupOnly`
and swings on the **enemy's** turn — so it reads the *enemy* commander's stat. A player
holding Toxic Bloom gets nothing from it, and if an encounter ever granted the enemy that
stat, their Plague-Bearer would silently apply 2 stacks per swing with no card text saying
so. The magnitude is a function of the clock, not the source.

**Fix.** Resolve the bonus from the **source's** side at application time and store the
amplified stack count on the unit. Tick logic then stays side-free, which is what it wants
to be, and the caveat currently documented as thematic becomes true rather than tolerated.

### 5.4 The two miswired hybrids

**Vaporize Blast** — insert a leading `{ op: 'applyStatus', status: 'chill', stacks: 1,
area: { shape: 'target' } }` before the frost damage. That makes the card do what its own
comment claims and what the player paid a Marrow for.

**Superconduct Strike** — two options. **Rename it** (Overload Strike) and keep the effect:
the card is well-built, and *"the arc jumps"* already describes Overload's shove. Or swap the
second node to `frost` to match the name. **Recommend the rename** — the shock→fire ordering
is the better card, and Superconduct already has a Frost-damage route through Glacial Spike.

Either way, both cards need a test. Their absence is why this went a full sprint unnoticed.

### 5.5 Chain depth only bounds mark→mark

`DamageRequest.chainDepth` is written by exactly one caller (`marks.ts:150`) and read by one
(`marks.ts:54`). Every other damage source omits it, so a mark detonated by a collision, a
reaction, or a spell restarts the counter at depth 1. `MAX_CHAIN_DEPTH` (`marks.ts:24`)
therefore does not bound a mark→collision→mark cascade at all.

**Fix.** Thread `chainDepth` through the collision and reaction paths so the guard bounds
real cascades rather than one shape of them. Nothing currently exploits this, which is the
best time to fix it.

## 6. Dormant and dead members

Typed but unreachable, or read by nobody. Each is either a latent bug or a free content
slot — several become Part 2 material.

**Latent bugs**

- **`TargetSpec {kind:'adjacentEnemy'}` ignores adjacency.** Declared `cards.ts:107`,
  resolved `targeting.ts:164-170` — it returns **every enemy unit on the board**. Zero cards
  use it, so it has never been wrong in play. The first card that uses it will be.
- **`trail: 'current'` would typecheck and be silently inert** — `Hazard.dir` is never set
  (`reactions.ts:268-274`) and `turn.ts:117` filters directionless currents out. Worse,
  `spawnHazard` overwrites unconditionally, so **any trail laid over a current destroys the
  lane**.
- **`DamageCause 'impact'`** (`ids.ts:24`) is declared and never produced — displacement uses
  `dtype:'impact'` with `cause:'collision'`. Dead union member.

**Invisible to the player and the AI**

- `onHit`, `trail` and `hunts` are **absent from `UnitSnapshot`** (`views.ts:19-41` copies
  `attackProfile` and not these three; `contract/snapshots.ts:37`). No tooltip, inspector, or
  danger overlay can show them.
- **The AI does not read `onHit` at all.** `ai/score.ts` has no reference to it or to
  `statuses`. It attacks with a Plague-Bearer as though it were a 1-ATK body, and does not
  fear one either.
- `statusTicked.damage` is emitted (`status.ts:83`) and **discarded** by the handler
  (`anim/handlers.ts:228-234`) — which is why §1.4's phantom damage is never actually drawn.

**Free content slots** (each is data-only)

| Capability | State | Where |
|---|---|---|
| `AreaSpec {shape:'all'}` | implemented, **0 cards** | `effects.ts:392` |
| `BlastPattern {shape:'self'}` | implemented, **0 marks**, documented inert | `marks.ts:165`, `02:528` |
| `CardDef.vector:'linear'` | implemented, **0 cards** | `targeting.ts:77` |
| `CardDef.minRange` | implemented, **0 cards** | `targeting.ts:64,72` |
| `StatusKind 'stun'` | fully gated, **0 appliers** | §3.1 |
| `Weather 'rain'` | fully implemented, **0 encounters** | §4.4 |
| `Obstacle.cover` | encounter-only, **no card spawns it** | `setup.ts:363` |
| `trail: 'steam_fog'` | legal, **only `rubble` shipped** | `threats.ts:55` |
| `obstacleDeath.damage` | typed, **both users apply statuses only** | `terrain.ts:85,97` |
| `CombatBoons.pips` / `.extraOpeningCards` | **no relic, no trait** — brews only | `run.ts:26-33` |
| Keywords `Dormant`, `Impact`, `Sacrifice` | **no engine code reads them** — card text | `glossary.ts:23,27,72` |
| `isAnchor()` | exported, **never called** | `subjugation.ts:42` |
| `ignoreIceSlip` | reaches `CommanderState`, **movement never reads it** | — |
| Brew `quicksilver` | defined, **not in `APOTHECARY_STOCK`** — unpurchasable | `run.ts:32`, `apothecary.ts:30-50` |

## 7. The Harpoon Protocol is finished and starving

Worth stating clearly, because "dormant" undersells it: the protocol is **fully implemented,
tested, HUD-wired and AI-aware**. `subjugation.ts` is 224 lines covering the seal, the Rite,
the anchor, the tick, the snap and the enrage; `bossPhases.test.ts:130-252` covers all of it;
the AI hunts the anchor above lethal (`ai/score.ts:138-174`); the meter is drawn
(`Hud.ts:170-195`).

It is starving for content and for a payoff:

1. **One caller.** `beginSubjugation` is invoked from exactly one place in the game
   (`ignis.trial.ts:186`). Adding a subjugation to a new beast is one function call.
2. **Binding grants nothing.** `run.ts:172-173` treats `'bound'` identically to `'victory'`
   — the same spoils. `tameCompanion` exists (`vivarium.ts:75`) and is called from the
   dev-only `tameWild` (`main.ts:130`) and for the starter companion (`save.ts:195`) —
   **but nothing connects a `'bound'` result to it.** The fiction says *claim the beast*; the
   code says *collect the usual ducats*. This is the single biggest gap in the sandbox.
3. **No per-encounter tuning.** `SUBJUGATION_ROUNDS` is a module constant (`state.ts:150`),
   not a field on `EncounterDef`. A 5-round Apex needs a code change.
4. **No boss-side pressure during the tether.** The beast uses ordinary AI with a reweighted
   utility. Nothing spawns adds or ramps per round survived.
5. **`sealed` is never cleared, even after a successful bind.** Harmless today because
   `finish()` ends combat — but any state surviving past a bind is permanently unkillable.
6. **No partial progress.** `turnsSurvived` resets to 0 on a snap. No fractional credit.

§11's three Apex Threats each take one of these.

---
---

# PART 2 — The Content Expansion

Everything below is written in vocabulary the engine already has. Where a piece needs a new
field, it says so and names the single chokepoint that would read it — the pattern the
`CombatBoons` fields have followed since the loadout sprint.

The ideation deliberately targets **dormant capabilities first** (§6). Each of those is a
feature that has already been designed, implemented and tested, and is one data file away
from being live. That is the cheapest content in the game.

## 8. Two Companions

Five species exist and every one occupies a different school. Two schools have **no
companion, no resonance, and no traits**: `bulwark` and `arcane` (`School` union at
`ids.ts:18`; `RESONANCE` keys are pyre/frost/surge/bloom/dusk at `resonance.ts:33-98`).
So both new species fill real holes rather than crowding an occupied one.

Both need one new `RESONANCE` entry each. The existing per-school keying works as-is —
**no engine change**, and the test that holds the two lists together will simply start
passing for seven schools instead of five.

### 8.1 Ferrum, the Vault Boar — `bulwark`

A low, wide, immovable thing that treats the board as masonry.

**Resonance — Shield Oath.** +1 Armor to every allied unit in the Companion's **column**.
Deliberately the defensive mirror of Ember Watch: same shape, same `column` parameter the
signature already passes (`apply(ctx, side, column)`), opposite intent. It rewards the thing
Bulwark decks already want to do — stand in a line and not move.

| Trait | Boons | Note |
|---|---|---|
| **Ironbound Gut** | `{ pips: 1 }` | First trait in the game on the `pips` axis — currently brews-only |
| **Bulwark Stance** | `{ boundFormGrounded: true }` | Shares the flag with Ironclad Boots; a flag is a flag, so wearing both is not twice as rooted |
| **Quarry-Sense** | `{ bonusObstacleHp: 2 }` | Pairs with the Alchemist's Mortar for genuinely siege-grade walls |

### 8.2 Lexis, the Ink Owl — `arcane`

The first Companion whose passive touches the **hand** rather than the board.

**Resonance — Marginalia.** Draw 1 card. Routed through the ordinary `drawCards` path, so
the hand limit and the overdraw burn both still apply — a full hand turns the passive into
1 Marrow and a burnt card, which is a real cost and not a punishment. It is the first
Resonance that interacts with the economy rather than the arena, and it makes
`bonusHandLimit` (the Gambler's Coin) a build rather than a nicety.

| Trait | Boons | Note |
|---|---|---|
| **Prepared Margins** | `{ extraOpeningCards: 1 }` | Second untouched boon axis; opening hand is turn one's whole draw |
| **Wide Ledger** | `{ bonusHandLimit: 1 }` | Stacks additively with the Coin — 9 or 10 cards held |
| **Night Vision** | `{ ignoreFog: true }` | Shares with the Goggles, freeing the optics slot for the Monocle |

> **Both species also fix a smaller thing.** Traits currently exist only for the five
> playable species; a `bulwark` or `arcane` Companion appearing in the Vivarium today would
> roll an empty knack. Adding the species and the traits together keeps that invariant.

## 9. Five Relics

One per slot. Treads currently holds exactly one relic and vestment two, so the shelf needs
the width. All five bend a rule; none of them is a number.

### 9.1 Cascade Prism — `trinket`

*Ground from a single reaction that never stopped.*

**Raises the reaction-refund cap from 2 to 3 per turn.** New boon `bonusReactionCap: number`,
read at exactly one chokepoint: `REACTION_PIP_CAP` in `engine/reactions.ts:198`, which
becomes a per-commander value the way `pipCap` already is. The 2/turn cap exists so a cascade
cannot fund itself (`02:126-128`); 3 keeps that true while making a genuinely elaborate
Vaporize→Wildfire turn pay for one more card.

### 9.2 Sightline Lens — `optics`

*Everything is a silhouette if you are patient.*

**Guardians no longer block your line of sight.** New boon `ignoreGuardians: boolean`, read
in `los.ts:84` — the one place that consults Guardian and cover. Deliberately does **not**
see through Behemoths or obstacles: it is a rule about a *keyword*, not about geometry, which
keeps `arcing` the answer to walls and makes this the answer to a screen. Turns every ranged
unit in a Bulwark matchup from blocked into live.

### 9.3 Salvager's Apron — `vestment`

*Nothing is wasted twice.*

**An overdrawn card is discarded instead of burned, and pays 2 Marrow instead of 1.** New
boon `salvageOverdraw: boolean`, read at the overdraw branch in `deck.ts`. Overdraw today
burns the card and grants 1 (`02:364`). This rewrites what happens at the hand limit rather
than raising it — the card returns to the deck's cycle instead of leaving the game, and the
extra Marrow makes deliberate overdrawing a Bloom/Dusk engine rather than a mistake. Note
how badly it wants the Ink Owl, and how badly it fights the Gambler's Coin: two relics that
disagree about what a full hand is *for* is exactly the loadout tension the slots exist to
create.

### 9.4 Tidewalker Sandals — `treads`

*Choose your current.*

**Your Bound Form may ride a current in any of the eight directions, or refuse it.** New boon
`steersCurrents: boolean`, read in `runCurrents` (`turn.ts:117-132`). Currents today carry
whatever stands on them, once, at the end of the round; `boundFormIgnoresHazards` already
lets a Companion opt out entirely. This is the interesting middle: the current becomes free
movement you steer rather than a shove you tolerate. It is also the only reason to ever
*want* to stand in one, and it makes Narrow Ruin — the one encounter with currents
(`narrow.ruin.ts:62`) — a completely different map.

### 9.5 Anchor-Chain Sigil — `will`

*The chain remembers what the hand let go.*

**Tether progress survives one snap.** New boon `tetherMemory: boolean`, read in
`onAnchorDied` (`subjugation.ts:183`): instead of `turnsSurvived = 0`, decrement by 1 and
consume the memory for that combat. Directly answers §7.6 — the one place where a
subjugation currently punishes a good three-round plan with total loss. Also the first relic
that only matters in a boss fight, which is a category the shelf does not have yet.

## 10. Eight Cards

Each one exercises a specific dormant or single-use capability. Target and area shapes are
given exactly, because §6 is largely a list of what happens when they are guessed.

### 10.1 Refracted Lance — spell, `arcane`, hero

`vector: 'linear'`, `range: 5`, `needsLoS: true` · `target: { kind: 'line', length: 5 }` ·
`{ op: 'damage', amount: 3, dtype: 'spell', area: { shape: 'line', length: 5 } }`

**The first card in the game to use `vector: 'linear'`** (`targeting.ts:77`, zero uses).
A beam that hits everything down the rank — friend included, because a beam does not check
sides. `spell` damage, so it does not shatter ice; it is aligned for the Cinder Mark, which
makes it a cascade opener rather than a finisher.

### 10.2 Sunken Mortar — spell, `bulwark`, companion

`range: 5`, `minRange: 2`, `needsLoS: false` · `target: { kind: 'emptyTile', zone: 'any' }` ·
`{ op: 'damage', amount: 4, dtype: 'impact', area: { shape: 'adjacentCross' } }`

**The first card to use `minRange`** (`targeting.ts:64,72`, zero uses). The spell-side twin
of an `arcing` unit: it lobs over everything and cannot defend its own feet. `impact` typed,
so it **Shatters** — and it is the first Shatter trigger that is not a unit walking up and
punching. Tile-targeted with a cross, per the rule at `02:325-327`: aiming at a unit would
centre the cross on the victim and hit their neighbours instead.

### 10.3 Aetheric Saturation — spell, `surge`, hero · **PowerTier**

`target: { kind: 'global' }` ·
`{ op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'all' } }`

**The first card to use `area: 'all'`** (`effects.ts:392`, zero uses). Charges *every unit on
the board, both sides*. Alone it does nothing — that is what `charged` is (`02:422`). It is
one card that makes the next fire spell an Overload and the next frost spell a Superconduct,
and it hands the same gift to the enemy. PowerTier, so `tierOf()` derives tier 3 and the copy
limit is 1.

Note this is the card that makes **Superconduct reachable in-school** (§4.2): a Surge deck
can now prime globally and needs only to find a frost trigger, instead of needing Boreas.

### 10.4 Concussive Toll — spell, `bulwark`, companion

`target: { kind: 'entity', side: 'enemy', includeObstacles: false }` ·
`seq`: `{ op: 'damage', amount: 2, dtype: 'impact', area: { shape: 'target' } }` then
`{ op: 'applyStatus', status: 'stun', stacks: 1, area: { shape: 'target' } }`

**The game's first `stun` source** (§3.1). Every consumer already exists — `canAct` gating,
decay, threat projection, the 💫 icon, the glossary entry, the targeting refusal. This card
is the only missing half, and it costs one line of data.

Priced for it: hard CC on a single target for a turn is the strongest control in the game,
so it should be Marrow-gated (`marrow: 1`) — asking the player to have opened something up
this turn rather than banked patiently.

### 10.5 Censer Hound — minion, `pyre`, hero

`unit: { atk: 2, hp: 4, mov: 3, rangeMax: 1, trail: 'steam_fog', keywords: ['Haste'] }`

**The first `trail` that is not `rubble`** (`threats.ts:55` is the only trail in the game).
It lays a sight-blocking wake on every tile it leaves under its own power — and, being
`steam_fog`, that wake **expires** rather than being permanent, so unlike the Scrap-Titan it
does not permanently rewrite the arena.

A fast body that blinds the lane behind it. Note the rule at `02:559-562`: being *shoved*
lays nothing, so an opponent cannot use your own hound to build their screen.

### 10.6 Smokewall Charge — spell, `gaslamp`, hero

`target: { kind: 'emptyTile', zone: 'any' }` ·
`{ op: 'spawnConstruct', obstacleDef: 'smoke_bank', hp: 3 }`, where `smoke_bank` carries
`cover: true` and `obstacleHp: 3`

**The first card to spawn `cover`** — today cover exists only where an encounter places it
(`setup.ts:363-373`). Cover blocks sight without blocking movement, and units stand *on* it.
So this is a wall your own melee can walk through and your own archers cannot shoot through:
a screen with a real cost, rather than a barricade. `spawnConstruct` sets the HP from the
spell, and the caster's `bonusObstacleHp` still applies on top.

### 10.7 Bramble Cairn — spell, `bloom`, companion

`target: { kind: 'emptyTile', zone: 'any' }` ·
`seq`: `{ op: 'spawnConstruct', obstacleDef: 'thorn_cairn', hp: 4 }` then
`{ op: 'attachMark', mark: 'rot_root_snare' }`

**Raise a thing and then wire it, in one card.** This is the `spawnedObstacleId` handoff
(`02:352-356`) doing exactly what it was built for: the card targets an empty tile, so
`chosen` holds no entity, and `attachMark` falls back to what the previous node just built.
Without that handoff the mark would find no host and vanish silently.

The result is a wall that roots and poisons whatever is standing around it when it breaks —
and, per `02:526`, the blast spares its own host, which for an obstacle host is exactly
right.

### 10.8 Rime Wasp — minion, `frost`, hero

`unit: { atk: 1, hp: 3, mov: 2, rangeMin: 2, rangeMax: 4, attackProfile: 'arcing',
onHit: { status: 'chill', stacks: 1 } }`

**The answer to Shatter's priming problem** (§4.2). An arcing body that chills what it hits,
from range, every turn, for free. Three hits freeze; a physical blow then Shatters. It turns
the hardest reaction in the game to set up into something a deck can simply *do*, without
requiring three casts of Boreas' spells.

It obeys the arcing rule (`rangeMin: 2`, per `02:277-279`) — no blind spot, no arc. And note
what §1 makes true of it: it cannot be Countered (never melee), and its rider lands through
armour. Both are worth knowing before it ships.

> **A follow-on the splice bench needs.** Reagents exist only for pyre, surge and frost
> (`core_pyre`, `core_surge`, `core_frost`). A `core_bloom` and a `core_dusk` would let the
> five recipes become a matrix rather than a list — the Rime Wasp and the Censer Hound are
> both obvious pressings.

## 11. Three Apex Threats

All three are `footprint: 2` Behemoths, which brings uncapped Escalation
(`escalationCap = Infinity`, `spawn.ts:57`), line-of-sight blocking through the body
(`los.ts:84`), and a forced Tier 3 in deckbuilding (`deckRules.ts:116-159`).

All three call `beginSubjugation` from their own encounter script — which today has exactly
one caller in the entire game (§7.1). Each takes one of the protocol's named gaps.

### 11.1 The Slag Colossus — `bulwark`

`atk: 4, hp: 30, mov: 1, rangeMax: 1, footprint: 2, trail: 'rubble'`

**Passive — Siege Grind.** Every tile it vacates becomes permanent rubble. At 1 MOV over
2 MOV rubble it can never step back over its own wake (`02:565-567`), so it commits to a
direction and the arena is permanently different afterwards.

**Damage Gate.** Below half, `onDamageToCommander` clamps incoming damage to 5 per blow —
"nothing gets through in one piece." That is the existing gate hook (`registry.ts:82-91`)
doing what Ignis' Trial already does, and it sets `chainCancelled`.

**Subjugation.** Seals at 25%. **Takes protocol gap §7.3**: the encounter wants a *5*-round
tether, not 3, because the arena by then is a rubble maze and holding an anchor is much
easier. Needs `SUBJUGATION_ROUNDS` moved from a module constant (`state.ts:150`) to a field
on `Subjugation`, defaulted from the constant so nothing else changes.

### 11.2 The Brood Matron — `bloom`

`atk: 3, hp: 26, mov: 2, rangeMax: 2, footprint: 2, onHit: { status: 'toxin', stacks: 2 }`

**Passive — Clutch.** On `onTurnStart`, spawns one `plague_bearer` while fewer than two are
on the board. The Bestiary creature finally gets a reason to exist beyond scenery.

**The Wildfire trap.** Her whole board is dosed with Toxin — hers and yours. Wildfire
consumes **every** stack at once for 2 fire each to adjacent (`02:452`), so a single fire
card in the wrong place detonates a four-stack cluster in your own line. She is an encounter
that punishes the Pyre answer specifically.

**Subjugation.** Seals at 25%. **Takes protocol gap §7.4**: each round the tether survives,
`onTurnStart` spawns an additional Plague-Bearer adjacent to the anchor. The tether stops
being a countdown you wait out and becomes three rounds you have to *hold*.

> Note this Apex is the one that makes §5.3 urgent. Her rider reads `activeSide`, so she
> swings on her own turn and reads *her* commander's `bonusToxinStacks`. If the encounter
> ever grants the enemy that stat, she silently applies 3 stacks with no text saying so.
> Fix the attribution before building her.

### 11.3 The Hollow Choir — `dusk`

`atk: 5, hp: 22, mov: 2, rangeMax: 3, footprint: 2, attackProfile: 'arcing', rangeMin: 2`

**Passive — Threnody.** A mark-bearer: it enters with a `soul_splinter_mark` already
attached, so killing it detonates 5 into your lowest-HP body. Killing it is a cost.

**Phase shift.** At 50%, `dockIntoForm` swaps it for a larger stat block (`spawn.ts:126-171`)
— the transformation Ignis' Trial already demonstrates, carrying the HP pool and finding a
legal dock site around the old anchor. Emits `bossPhaseShift`, which the HUD already draws
(`handlers.ts:522`).

**Subjugation.** Seals at 25%. **Takes the headline gap, §7.2**: binding the Hollow Choir
should add it to the **Vivarium**. `tameCompanion` (`vivarium.ts:75`) already rolls a beast
with traits and is called by the dev-only `tameWild` (`main.ts:130`); `run.ts:172-173`
already recognises `'bound'`. The two have simply never been connected. Wiring a bound Apex
into the roster gives the Harpoon Protocol the payoff its fiction promises, and turns
`'bound'` from a differently-spelled victory into the only way to obtain certain Companions.

That is the single highest-value item in this document. Everything else here is content;
that one is the reason the content matters.

---

## What to build first

If the audit and the ideation compete for the same sprint, the order that unblocks the most:

1. **§5.4 — fix the two miswired hybrids** and give them tests. They are shipped, wrong, and
   untested; everything else here is greenfield.
2. **§5.1 — the dangling attacker reference.** One line, and it is a genuine correctness bug.
3. **§7.2 / §11.3 — wire `'bound'` to `tameCompanion`.** The protocol is finished and has no
   payoff; this is the largest gap between what the game says and what it does.
4. **§10.4 — the first `stun` source.** A whole documented mechanic is unreachable, and the
   fix is one card of data.
5. **§4.4 — decide what Arc is.** Either promote `conductShock` into a real `ReactionDef`
   (so it pays a refund and announces itself) or update the two comments that call it
   unimplemented. It is currently shipped and documented as absent, which is the worst of
   both.
