# 05 — The Ironworks Artificer

**Status:** Description of what the code does today, verified against the source. Every
claim carries a `file:line`.

The Artificer is the Safehouse's card bench: the one place a player's *collection* changes
outside of winning a fight. Three trades share the counter, and they are deliberately not
three flavours of the same shop — each answers a different question, takes a different
price, and is gated on a different thing.

| Trade | Question | Price | Gate |
|---|---|---|---|
| **Schematic Forging** | "I have never held this card." | 100 Ducats | A **Schematic in hand**, and not already forged |
| **Ascension Forge** | "I want this card to hit harder." | 60 Ducats + 3 Shards + 1 Core | Unlocked, has a Rank 2, not already ascended |
| **Aetheric Splicing** | "I want a card that does not exist yet." | 1 Core | A recipe, the base card, and both prerequisite schools |

The screen is `src/app/ArtificerScreen.ts`, three tabs on one workbench
([ArtificerScreen.ts:177](src/app/ArtificerScreen.ts:177)). What each trade *offers* lives
in `src/core/data/`; what each one *costs* lives beside the transaction that charges it, in
`src/core/overworld/`. That split is deliberate — a price and the check that it can be paid
drifting apart is how a button ends up promising something the till refuses.

---

## The house pattern

All three trades are the same shape, and it is worth stating once:

```ts
someRefusal(state, collection, …): 'why-not' | null   // the question
someDoer(state, collection, …): Result | null         // asks it, then acts
```

The screen greys a button out using the refusal; the doer asks the *same* refusal again
before spending anything. A stale render therefore cannot buy something the rules refuse,
and **nothing is ever charged for a refusal** — every till takes payment only after the
refusal has come back null.

Two more rules hold everywhere on this bench:

- **Nothing may be bought while a contract is open.** Every refusal begins with
  `in-combat` ([forge.ts:105](src/core/overworld/forge.ts:105),
  [splice.ts:57](src/core/overworld/splice.ts:57)). Upgrading a card between accepting a
  bounty and fighting it would change a deck the fight had already been committed to.
- **The collection is replaced, never mutated.** It lives in the save and outlives the
  character. The *purse* is mutated, because it belongs to the character being spent from.

---

## The currencies

Three, earned three different ways, and that is the whole reason there are three.

| Currency | Where it comes from | What it is for |
|---|---|---|
| **Ducats** | Every contract, at every tier | Acquiring — Schematics |
| **Aether Shards** | Adept contracts and up only | Mastering — Ascension |
| **Cores** (Reagents) | Adept and Master payouts, rolled | Transforming — Splicing, and part of Ascension |

Base pay per tier ([bounties.ts:80](src/core/data/bounties.ts:80)):

```
novice   40 Ducats,  0 Shards,  0 Cores
adept    85 Ducats,  1 Shard,   1 Core
master  160 Ducats,  3 Shards,  2 Cores
```

Shards start at Adept because they are the currency the bench wants — the Ascension Forge
stays out of reach until a player is taking real work. Cores are the same idea one notch
harder: **Novice work pays none**, so the two a character starts with
([save.ts:268](src/app/save.ts:268)) are meant to be spent learning what the bench does, and
everything after that is worked for. Which core a contract rolls is randomised, so a run of
Adept contracts is not a run of the same core.

There are three Cores, one per school whose elemental reactions the engine actually
understands ([splicing.ts:29](src/core/data/splicing.ts:29)):

- `core_pyre` — **Pyre Core**
- `core_surge` — **Surge Core**
- `core_frost` — **Frost Core**

> **Note on a stale name.** `artificer.ts` also exports a `CATALYSTS` table using ids like
> `pyre_reagent` ([artificer.ts:78](src/core/data/artificer.ts:78)). Nothing in the game
> reads it — only a test does. The live vocabulary is `REAGENTS` in `splicing.ts`, and the
> ids in `economy.reagents` are `core_*`. `CATALYSTS` is vestigial.

---

## 1. Schematic Forging

**Cuts a card you hold the plan for, for 100 Ducats.**

This is now the **only** door into a collection. A win used to hand the card over free,
which made this trade a formality — the bench would cut anything you had not already got,
so the shelf was the whole catalogue and Ducats were the only gate. Two routes to the same
place, and the free one was strictly better.

There is one route now, and it has two halves that are **not interchangeable**:

| | Where it comes from | What it costs |
|---|---|---|
| The **Schematic** | Won off a fight, out of the deck that fight played | A fight |
| The **card** | Cut here, from that Schematic | 100 Ducats |

Neither half is enough alone. `schematicsFor(collection, held)`
([artificer.ts](src/core/data/artificer.ts)) is the shelf, and `held` is the ledger the
character carries. Owning a card takes it off the list **entirely** rather than offering a
second and a third — the bench sells *access*, and there is no such thing as a second copy.
How many go in a deck is the Tier limit's business, not the collection's.

The workspace still shows the whole catalogue rather than just what is cuttable, and that
matters more now than it did: most of it is locked, and the lock is the game telling you
there is something out there still carrying the plan. Three states, three sentences:

| State | Foot reads | Why |
|---|---|---|
| **forged** | `Forged` | You have it. Nothing to buy |
| **ready** | `100 d` · Forge | Plan in hand, money owed |
| **unknown** | `No schematic` | *Beat something carrying it* |

The middle state is the new one. Before Schematics were things you found there were only
two — forged or not — and "not forged" meant "buy it". The shelf now has to separate *the
bench cannot cut this for you* from *the bench is waiting for your money*, because those
send the player to two completely different places.

### What is kept off the shelf

`isObtainable` ([collection.ts](src/core/data/collection.ts)) is the single gate, shared
with the post-victory Schematic offer so the two can never disagree:

- **Rank 2 printings.** Not something you obtain — something you upgrade into. Selling one
  would hand out for free the exact thing the Ascension sink charges for.
- **Hybrids** (`spliceOnly`). Free access to a sink's output is the sink not existing.
- **Minions.** Bodies are not cards you own; they are fielded from the Vanguard Roster,
  which is a point-buy over what you have *unlocked*.
- **Engine furniture** — setup-only stat blocks and the Rite of Subjugation, which the
  Trial deals itself.

### The refusals

`schematicRefusal` ([forge.ts:150](src/core/overworld/forge.ts:150)):

| Code | Means |
|---|---|
| `in-combat` | A contract is open |
| `unknown-card` | No such card |
| `already-forged` | You have it. There is no second copy to buy |
| `no-schematic` | You have not beaten anything carrying the plan |
| `too-poor` | Under 100 Ducats |

`no-schematic` is asked **before** `too-poor`, and the order is the message: "you have not
found that yet" is a different errand from "you cannot afford it", and telling a broke
player to go and earn Ducats for a card they could not cut at any price sends them to do
the wrong thing.

`held` is optional on both `schematicRefusal` and `forgeSchematic`. Omitting it means *no
Schematic gate*, which is deliberately the old behaviour — a caller asking a question about
prices (the catalogue view, a tooltip, a test) should not have to invent a ledger. Every
caller that is about to charge somebody passes one, and `main.ts` passes it to the till as
well as to the screen, so a stale render cannot cut a card the character has no plan for.

---

## 2. The Ascension Forge

**Raises a card you already know to its Rank 2 printing: +10% to every number it deals,
rounded up, and nothing else changes.**

### The arithmetic

`ascendValue` ([ascension.ts:61](src/core/data/ascension.ts:61)):

```ts
base + Math.ceil(base / 10)
```

- 30 damage → **33**
- 25 damage → **28** (the gain of 2.5 rounds up)

Integer arithmetic on purpose. `Math.ceil(30 * 1.1)` is **34**, because `30 * 1.1` is
`33.000000000000004` in binary floating point — a card would deal one more than the rule
says, invisibly, on the values that happen to land badly.

Always rounded **up**: a fractional gain that rounded to nothing would make Ascension
worthless on exactly the small cards that most need it.

### What scales, and what deliberately does not

Four things scale — **damage, armour, healing, and the health of anything a card builds**.
The list is closed, and every effect op either appears in `ascendEffect`
([ascension.ts:72](src/core/data/ascension.ts:72)) or is listed as deliberately untouched,
so a new op cannot join the game and silently inherit an answer nobody chose.

The exclusions are the more interesting half:

- **Economy.** Pips, Marrow, cards drawn, Marrow extracted. A Rank 2 that cost one Pip less
  is a *different tempo*, and leaving tempo alone is the whole reason progression was made
  vertical.
- **Space.** Movement, range, shove and pull distance, area shape, cone depth, line length.
  A spell that reaches further is a spell aimed differently, and a player reading the board
  should never have to ask what rank the card in the other hand is.
- **Status stacks.** Two Burn is two Burn at either rank. 2.2 of them is not a thing.
- **A tithe's own damage.** Blood Magic wounds *your* body to pay you, so raising it is a
  straight downgrade — the one place where "more damage" is the wrong direction.
- **Unit stat blocks.** Bodies are levelled, not ascended. A Vanguard unit earns its stats
  by surviving fights, and two systems raising the same numbers would be two systems
  arguing about them.

### Which cards have a Rank 2

**Derived, not authored.** Rank 2 printings used to be hand-written diffs and exactly five
cards had one. Now every card is run through `ascendCardDef`
([ascension.ts:228](src/core/data/ascension.ts:228)) at module load, and a card gets a Rank
2 **if and only if it has a number the rule is allowed to raise**. Twenty-four do today, and
a new card joins the Forge by existing.

A card made entirely of excluded quantities has no Rank 2 at all, and the bench says so
rather than charging for a printing identical to the one you own. *Harvest the Weak* is the
clean example: a self-inflicted tithe, a Marrow cap, and a card draw — nothing to sell.

Rank 2 rules text is derived too, since it can no longer be written by hand. The
substitution rewrites **exactly as many occurrences of a number as the card actually
raised**, which is what makes both awkward cases come out right:

- *Shield Bash* reads "Deals 20 damage … Triggers standard Collision Damage (30 / 20)" and
  owns one of those 20s. One is rewritten; the engine's collision figure is left alone.
- *Overload Strike* reads "20 shock damage, then 20 fire damage" and owns **both**.

### The price

`ASCENSION_COST` ([forge.ts:47](src/core/overworld/forge.ts:47)) — **60 Ducats, 3 Aether
Shards, and 1 Core**, all three at once. Each is earned a different way (time, difficulty,
scarcity), so the sink cannot be starved by saving in one currency or trivialised by a run
that happened to be rich in it.

Flat, whatever the card. A per-Tier curve is the obvious next move and deliberately not yet:
the uplift is a flat 10% at every Tier, so a flat price is the honest matching shape until
the uplift stops being flat.

**Which Core it takes:** any one, and the bench spends from whichever stack is deepest
(`reagentForAscension`, [forge.ts:71](src/core/overworld/forge.ts:71)), ties broken by id so
the choice is reproducible. The design brief called for "Regional Reagents", and regions are
not modelled — there is no biome on a bounty and no province on a map, so a Core cannot be
matched to where a card was earned. When regions exist, that function is the one place that
changes.

An emptied stack is deleted rather than left at zero, so a bag never renders "0 Frost Cores"
as a material you have.

### The refusals

`ascensionRefusal` ([forge.ts:98](src/core/overworld/forge.ts:98)), asked in this order:

| Code | Means |
|---|---|
| `in-combat` | A contract is open |
| `no-rank-2` | Nothing on this card can be raised |
| `not-owned` | You have never held it |
| `already-ascended` | Ascension teaches the card, once |
| `too-poor` | Under 60 Ducats or 3 Shards |
| `no-reagent` | No Core to spend |

`no-reagent` is named apart from `too-poor` on purpose: money and Shards are earned by
taking any contract, and a Core is not. Telling a player with a full purse that they are
"too poor" would send them to earn the wrong thing.

### Where the Rank 2 goes

Ascension writes to `collection.ascended`, and **both halves of the fused deck are printed
from it**:

- The **Hero half** by `printedDeck` ([collection.ts:117](src/core/data/collection.ts:117))
  at the call site, before the fight is built.
- The **Companion half** inside `createCombat`, after the sockets are applied — the two
  halves are resolved in different places, so the printing happens in two places too, and
  `printedWith` is the one rule both of them ask.

The ordering on the Companion side only reads one way: **sockets first, then printings**. A
socketed card is a card and earns its Rank 2 exactly as a drafted one does; printing first
would raise the card being replaced and leave the replacement at Rank 1.

> This was a real gap until recently. The Hero half was printed and the Grimoire was not, so
> a player could pay Ducats, Shards and a Core to raise Flame Surge and then watch their
> Ignis deal the Rank 1 printing all fight. It is fixed, and pinned by tests.

Both ranks share one copy cap through `baseIdOf`, so deck validation, Tier limits and the
builder need no idea Ascension happened.

---

## 3. Aetheric Splicing

**Presses a card and a Core into a Hybrid — a card that exists in no other way.**

A recipe is a *lookup*, not a construction ([splicing.ts:88](src/core/data/splicing.ts:88)):
base card plus core names a hybrid that already exists in the registry. That is the whole
safety property — the bench cannot invent something that fails in combat instead of at the
counter.

### The book

| Base card | Core | Produces | Also requires |
|---|---|---|---|
| Flame Surge | Frost | **Vaporize Blast** | Glacial Spike |
| Flame Surge | Surge | **Overload Strike** | Arc Lash |
| Glacial Spike | Pyre | **Cryo-Combustion** | Flame Surge |
| Spore Cloud | Surge | **Galvanic Spores** | Arc Lash |
| Dark Tithe | Surge | **Aetheric Defibrillator** | Arc Lash |

The book guards itself at module load: two rows claiming the same pressing would make the
later one unreachable, and a prerequisite naming a recipe's own result would gate a card
behind itself. Both throw on import rather than failing silently.

### The prerequisites

A Hybrid is two schools fused, and the base card only ever accounts for one of them.
`requiredUnlockedCards` names the **other** half: you may not press a Vaporize Blast out of
a fire spell and a cold rock unless you have actually learned to cast frost. It turns the
bench from a shop into a payoff for having played both schools.

**Prerequisites are never consumed.** Neither is the base card. An unlock cannot be spent —
that is what makes it an unlock — so the Core is the whole price, and the bench hands back a
second card the player now knows.

### The refusals

`spliceRefusal` ([splice.ts:51](src/core/overworld/splice.ts:51)):

| Code | Means |
|---|---|
| `in-combat` | A contract is open |
| `no-recipe` | The bench knows no such pressing |
| `not-owned` | You have never held the base card |
| `missing-prerequisite` | You have not learned the other school |
| `no-reagent` | You hold none of that Core |

The prerequisite is asked **before** the reagent, so a player short of both is told about
the thing they cannot buy their way out of first. `missingPrerequisites`
([splice.ts:42](src/core/overworld/splice.ts:42)) returns the actual list rather than a
boolean, so the counter can name what is missing instead of sending the player back to the
card list to work it out.

### Where a Hybrid goes

This is the part that used to be a dead end, and it is worth stating plainly.

A Hybrid is an **elemental** card, and the Hero Deck takes neutral and arcane only. So a
freshly pressed Vaporize Blast could be owned outright and played nowhere.

**Grimoire Override Sockets** are the answer. The Companion's half of the deck is where
elemental magic lives, so a forged Hybrid is socketed into one of the beast's eight slots
from the Field Journal. The gate is not "is this a Hybrid" — it is whether the beast has any
claim to the card:

- One school in common is enough. An **Ignis takes a Pyre/Frost fusion** because half of it
  is fire, and refuses a Bloom/Surge one because none of it is.
- The schools come from the **recipe**, not from where the card is filed. Vaporize Blast is
  filed under `frost`; asking `def.school` would tell a fire drake it cannot hold the
  fire-and-ice spell that is half made of fire.
- Neutral utility is refused, and that falls out of the rule rather than being a case in it:
  no bloodline is `neutral`.

---

## What the bench cannot do yet

Two honest gaps, both visible in the code rather than hidden:

1. **Cores have no region.** "Regional Reagents" is the design word; the implementation
   spends whichever stack is deepest, because there is no geography to match against.

2. ~~**Every Schematic is assumed available.**~~ **Done.** Schematics are things a player
   finds; `schematicsFor` grew its second argument and, as predicted, nothing else about
   the trade changed. What did change is everything around it — see
   [07_deck_building.md](docs/07_deck_building.md) for where a plan comes from.

3. **Most of the catalogue is behind no door.** Making the plan the only way in means a
   card is reachable exactly when some encounter's deck carries it. Four encounters ship,
   and **29 of the 50 obtainable cards are currently taught by none of them.** That closes
   as encounters are added, and the list is pinned in `schematics.test.ts` as an
   `UNREACHABLE` ledger that fails in *both* directions — a card joining it breaks the
   build, and so does a card leaving it.
