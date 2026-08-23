# 07 — Deck Building

**Status:** Description of what the code does today, verified against the source. Every
claim carries a `file:line`.

---

## The shape of it

You do not build "a deck". You build **three separate things**, and the game fuses them at
the bell:

| Layer | Size | Who chooses | Where it lives |
|---|---|---|---|
| **The Hero Deck** | 4–12 cards | You, card by card | `Profile.decks[companionId]` |
| **The Grimoire** | exactly 8 | The *beast* drafted it; you may socket over slots | `CompanionInstance.grimoire` + `overrides` |
| **The Vanguard Roster** | 10 points | You, out of a point budget | `Profile.roster` |

A fight's draw pile is the first two concatenated and shuffled. The third never enters the
draw pile at all — it is deployed onto the board before turn one.

The design rule underneath all of it:

> **What you choose is the utility. What you *catch* is the magic.**
> — [deckRules.ts:22](src/core/data/deckRules.ts:22)

The Hero Deck is colourless. Every elemental card in your fused deck came from the animal
standing beside you. That is why catching a second Ignis is worth doing.

### The five roles

Since the role overhaul, a card's `kind` is the axis that decides which half it can reach —
not its colour. There are five, and three of them are the Hero's:

| `kind` | Whose | Where it goes |
|---|---|---|
| `spell` | Companion | drafted into a Grimoire |
| `ability` | Hero | the Hero Deck |
| `mark` | Hero | the Hero Deck |
| `obstacle` | Hero | the Hero Deck (a **Construct** to the player) |
| `minion` | Hero | the Vanguard Roster, never a deck |

— [cards.ts](src/core/types/cards.ts)

**"Spell" now means the Companion's elemental magic and nothing else.** The colourless
utility the Hero holds — Shield Bash, Aegis Ward, Grapple Line — is an **Ability**. Before
the split both were `kind: 'spell'`, which meant the only thing separating the Hero's Shield
Bash from a Companion's Flame Surge was the `school` field: a fact about colour being asked
to answer a question about ownership. Two facts, two fields.

A **Mark** is what a Rune used to be. Attach it to a body, and it detonates when its trigger
is met.

---

## 1. The Hero Deck

### Size

```ts
export const MIN_DECK = 4;
export const MAX_DECK = 12;
```
— [deckRules.ts:24](src/core/data/deckRules.ts:24)

It has been three different sizes. It was 12–30 when the deck was the whole spellbook, then
5–15 once the Companion started fusing its own half in, and it is 4–12 now. The tightening
is the point: 12 Hero cards + 8 Grimoire cards is a 20-card deck, small enough that every
card in it is a card you actually meet, and every card you cut is a card you miss.

What the fused deck *is* is derived, never restated:

```ts
export function fusedDeckSize(heroCards: number): number {
  return heroCards + GRIMOIRE_SIZE;
}
```
— [deckRules.ts:32](src/core/data/deckRules.ts:32), with `GRIMOIRE_SIZE = 8` at
[companions.ts:23](src/core/data/companions.ts:23)

So the two halves can never disagree about the whole. The character creator quotes it
([CharacterCreationScreen.ts:439](src/app/CharacterCreationScreen.ts:439)) and so does the
Safehouse ([SafehouseScreen.ts:277](src/app/SafehouseScreen.ts:277)) — one function, three
readers.

### Colour

```ts
export const HERO_KINDS: readonly CardKind[] = ['ability', 'mark', 'obstacle'];
export const HERO_SCHOOLS: readonly string[] = ['neutral', 'arcane'];
```
— [deckRules.ts](src/core/data/deckRules.ts)

Two gates, and the role one is asked first. A Pyre card in a Hero Deck is refused with
`off_school`; a Flame Surge is refused with `spell_in_deck` before the colour is ever
looked at. The reason is not flavour: the elemental colour comes from the Companion, so a
Hero Deck holding Pyre would be competing with the Grimoire for the same job — and would
let a player carry a second school their Companion cannot support with a Resonance.

**Marks skip the colour gate entirely.** A Mark's `school` describes the *payload* it
detonates for, not whose half of the deck it belongs to. The Cinder Mark is filed as arcane
today and its brand still goes off for fire damage — `CARDS.cinder_mark.school` is `arcane`
and `MARKS.cinder_mark.school` is `pyre`, and the two are answering different questions.
Judging the card by the second one would refuse the Hero their own trap the moment anybody
gave it back the red it detonates in.

### Copies, by Tier

```ts
export const TIER_COPY_LIMIT: Record<CardTier, number> = { 1: 3, 2: 2, 3: 1 };
```
— [deckRules.ts:48](src/core/data/deckRules.ts:48)

Tier is **derived, not authored** ([deckRules.ts:60](src/core/data/deckRules.ts:60)):

| Test | Tier |
|---|---|
| has the `PowerTier` keyword | 3 |
| `unit.footprint === 2` (a Behemoth) | 3 |
| total cost ≥ 4 | 3 |
| total cost ≥ 2 | 2 |
| otherwise | 1 |

Deriving it means a new card cannot be added *without* a Tier — which would silently grant
it an unlimited copy count. This is the same discipline `rosterPointsOf` keeps for bodies
and `ascendValue` keeps for numbers, and it appears throughout the codebase for the same
reason.

The cap is tracked by **base id**, not by printed card:

```ts
export function baseIdOf(cardId: string): string {
  return cardId.replace(/_r[23]$/, '');
}
```
— [deckRules.ts:107](src/core/data/deckRules.ts:107)

So Ascending a card to Rank 2 cannot double its cap by the back door. Rank 1 and Rank 2 of
the same card share one allowance.

### The collection is a set, not a tally

```ts
export interface Collection {
  unlocked: string[];   // a SET of base ids
  ascended?: string[];  // account-wide
}
```
— [deckRules.ts:128](src/core/data/deckRules.ts:128)

Cards used to be physical copies you could run out of, which meant the deck builder was
arguing with the collection about the same number twice — a Tier limit *and* an inventory
count, both capping the same thing. Now unlocking is permanent and one-way: nothing in the
game removes an entry, not a loss, not a splice, not a wager. What a card costs is paid
once, at the Forge, and what bottlenecks a deck afterwards is the Tier limit alone.

Ascension is stored the same way — as a set of base ids, account-wide — rather than by
rewriting deck lists to `_r2`. A deck built before an Ascension keeps working, and nothing
has to be migrated when the Forge is used.

### One rule, four readers

The role gate lives in exactly one function:

```ts
export function deckRoleRefusal(def: CardDef): RoleRefusal   // 'minion' | 'spell' | 'off_school' | null
```
— [deckRules.ts](src/core/data/deckRules.ts)

Four things read it, and before it existed the first two disagreed:

| Reader | What it does with the answer |
|---|---|
| `validateDeck` | turns it into a `DeckProblem` |
| `remainingCopies` | returns 0, so the shelf greys the card out before it is clicked |
| the Field Journal | prints `roleRefusalMessage` on the tooltip |
| `loadProfile` | strips the card out of a save written under the old rules |

The builder used to let you click a Scrap Phalanx — `remainingCopies` said two — and then
refuse the deck you had just built with it, because `validateDeck` knew it was a body. That
is one rule held twice, and the two copies had already drifted.

### Validation

`validateDeck(deck, collection?)` returns **every** problem rather than the first
([deckRules.ts:156](src/core/data/deckRules.ts:156)), so the builder can show a complete
list instead of making the player fix them one at a time.

| Code | Meaning |
|---|---|
| `too_small` / `too_large` | Outside 4–12 |
| `minion_in_deck` | A body. It belongs in your Vanguard Roster |
| `spell_in_deck` | Elemental magic. Your Companion casts those |
| `off_school` | An elemental card that is *not* a Spell — in practice, a Construct |
| `unknown_card` | The card no longer exists in this version |
| `over_copy_limit` | More copies than the Tier allows |
| `not_unlocked` | Not forged yet |
| `too_many_behemoths` | See the note below |

The **order the checks are asked in is load-bearing**, and it is the same order the answers
are useful in: what the card *is*, then what colour it is, then how many of it you have.

A minion is very nearly always elemental too, so asking the colour first would tell the
player their Grave Sentinel is the wrong *colour* and send them looking for a neutral one
that does not exist. A Spell is elemental **by construction** now, so the same objection
applies twice over — "your Flame Surge is Pyre" is true, useless, and points at an arcane
Flame Surge that can never be printed. The role is the reason; the colour is only how you
can tell. And role comes before the copy limits, so a deck full of Spells is told the one
thing that matters rather than a list of tier violations underneath it.

That leaves `off_school` reachable by exactly one route: an elemental **Construct**. Pyre
Pillar is not a Spell, not a body and not a Mark, so nothing above catches it and the
colour rule is the only thing that does.

**A note on `too_many_behemoths`.** `MAX_BEHEMOTHS = 2`
([deckRules.ts:45](src/core/data/deckRules.ts:45)) is currently **unreachable**. Only
`kind: 'minion'` cards carry `unit.footprint === 2` — verified: `magma_brute`,
`scrap_titan`, `ignis_behemoth_bound`, and nothing else — and the minion check `continue`s
before the Behemoth tally is incremented. The rule is a vestige of the era when minions
were deck cards. It is harmless, and the live Behemoth limit is now
`MAX_ROSTER_BEHEMOTHS = 1` on the Vanguard side
([roster.ts:22](src/core/data/roster.ts:22)).

### What the builder shows

`remainingCopies` ([deckRules.ts:252](src/core/data/deckRules.ts:252)) is the affordance
behind the UI — the minimum of four independent ceilings: the Tier limit, ownership
(`Infinity` or `0`, never a count), the Behemoth cap, and the remaining deck size. The
builder greys a card out *before* it is clicked rather than erroring afterwards. Ownership
returning `Infinity` rather than a number is the copy model deliberately not surviving
inside a boolean question.

`costCurve` ([deckRules.ts:274](src/core/data/deckRules.ts:274)) buckets the deck by total
pip cost into seven bins for the curve display.

The screen is `src/app/DeckBuilderScreen.ts` — the Field Journal. Four tabs
([DeckBuilderScreen.ts:144](src/app/DeckBuilderScreen.ts:144)): **The Deck**, **The Threat
Ledger**, **Hero** (relics and boons), and **The Vanguard**. It returns all three
buildables at once ([DeckBuilderScreen.ts:1119](src/app/DeckBuilderScreen.ts:1119)):

```ts
{ companionId, cards, roster, overrides }
```

One Hero Deck exists **per species**, keyed by `companion.id`
([save.ts:390](src/app/save.ts:390)). The roster is one **per character**
([save.ts:189](src/app/save.ts:189)). The sockets belong to the **individual beast** — two
Ignis on your roster socket separately.

---

## 2. The Grimoire: the half you don't build

Eight cards, and you did not pick them. The beast did.

### Why it is drafted

A Companion used to bring a fixed list. Every Ignis anybody ever tamed carried the same
eight cards, so a second Ignis was worth nothing — the only thing that differed was a
health roll and a knack. Catching one was a checkbox.

A Companion now **drafts** its eight from its bloodline's pool
([grimoire.ts](src/core/data/grimoire.ts)). Two Ignis are two different decks — one heavy on
Ashen Wakes, one that happened to roll three Cataclysms — and that is the reason to go and
catch a second one.

### What a bloodline may draw

Since the role overhaul, a Companion drafts **Spells and the ground they stand on**:

```ts
function isBloodlineCard(def: CardDef): boolean {
  return def.kind === 'spell' || def.kind === 'obstacle';
}
```
— [grimoire.ts](src/core/data/grimoire.ts)

Marks are refused outright, in `isDraftable`, which is the stricter of the two gates: a
beast that drafted one would be holding a card its own half of the deck cannot contain, and
the Field Journal would show a Grimoire slot no socket could legally replace. That gate is
also what keeps Marks out of the **fallback** pool below, which matters more than it looks:
Marks are filed as arcane now, so the colourless shelves are exactly where one would sneak
back in.

Abilities are refused because they are the half the Hero builds. A Grimoire dealing a Shield
Bash would be handing the player a card they already chose not to run.

**Constructs are deliberately still in**, and this is the one place the rule reads looser
than "exclusively Spells". Pyre Pillar, Coolant Pillar, Ice Barricade and Smoke Bank are
elemental, so no Hero Deck may hold them either — dropping them from the draft as well would
leave four cards in the registry that nothing in the game can ever deal. Orphaning content
is a worse outcome than a Grimoire that occasionally raises a wall. In practice it is a thin
tail: measured across every bloodline and 200 seeds each, drafted books run 86–100% Spell,
with Constructs taking 4–14% of slots for the six bloodlines that have any.

### The weighting

```ts
export const MONO_HYBRID_CHANCE = 5;    // a mono-element bloodline
export const HYBRID_HYBRID_CHANCE = 35; // a hybrid bloodline
```
— [grimoire.ts:59](src/core/data/grimoire.ts:59)

That is a *per-slot* chance, rolled eight times. At 5% a mono-element beast knows a fusion
roughly one time in three — rare enough to be a story. A hybrid bloodline draws from two
schools at once and rolls their shared fusions about a third of the time, because mixing
them *is* what it is for.

Without weighting, an Ignis would be a random pile of fire and every Ignis would be the
same random pile as every other. The weights are what make a bloodline mean something.

### The draw

`draftGrimoire(rng, source, size)` ([grimoire.ts:166](src/core/data/grimoire.ts:166)) fills
slot by slot rather than shuffle-and-take, so a beast that rolled its rare Hybrid rolled it
*once*, on one slot, rather than having the whole draw tilt.

Each slot walks a preference chain, ordered by how much of the bloodline's identity each
option carries:

1. **`purePool`** — its own schools, no fusions ([grimoire.ts:94](src/core/data/grimoire.ts:94))
2. **`hybridPool`** — fusions it can reach ([grimoire.ts:108](src/core/data/grimoire.ts:108))
3. **`neutralPool`** — colourless utility, last resort ([grimoire.ts:128](src/core/data/grimoire.ts:128))

(1 and 2 swap places when the slot rolls hybrid.)

Two details are worth calling out:

**Reachability is decided by the recipe, not the filing.** A Hybrid card carries one school
on its face — Vaporize Blast is filed under frost — so matching on `def.school` alone would
hand a Pyre drake nothing and a Frost bear everything. `hybridSchools(c.id)` asks the
*recipe* which two schools press it, and the bloodline is in reach if it supplies either.

**The Tier cap is applied by narrowing the pool before each draw**, not by drawing and
re-drawing. That matters for the thin schools: Surge has three spells to its name, so a
re-draw loop spends most of its attempts landing on cards already at their cap and gives up
with a short book. Narrowing first cannot fail while any capacity remains, and the
arithmetic is eight passes over a list of a dozen.

Pools are sorted by id, because a pool ordered by `Object.values` would reshuffle every
Grimoire in every save the day somebody added a card to the wrong file.

### The colourless fallback, and the one bloodline that lives on it

Rather than deal a short book — silently, forever — a bloodline whose own shelf runs out
tops up from `neutral` and `arcane` ([grimoire.ts](src/core/data/grimoire.ts)). This used to
be a pure safety net: it was written when Bulwark had two spells and Surge three, and the
catalog expansion closed that. Every *elemental* bloodline now fills eight out of its own
Spells and fusions with room to spare — Ferrum, the thinnest, has capacity for 14.

**Lexis lives on it permanently, and that is a consequence of the overhaul rather than an
accident of content.** "Spell" now means *elemental* magic. Lexis's school is `arcane`, and
arcane is by definition not elemental — so an Ink Owl's own shelf holds two Constructs and
no Spells at all. Six of its eight slots come out of the fallback every single time, and its
Grimoire measures ~45% Ability / ~55% Construct.

The code does the only thing it can do without making a content decision on the Director's
behalf: it deals the beast a full eight. The three real options are the Director's to pick —
give arcane Spells of its own, stop Lexis being a drafting bloodline, or define an Ink Owl
as *the beast that lends the Hero its own tools*, which is what the code currently describes.

The test that guards this pins Lexis **by name**, so the day a second bloodline joins it,
that is a content bug and the suite says so rather than relaxing to "some may be thin".

### Per-copy rolls

25% of the time, a drafted spell rolls a modifier
([vivarium.ts:193](src/core/overworld/vivarium.ts:193)):

| Weight | Roll |
|---|---|
| 2 | −1 Pip cost |
| 4 | +10 damage |
| 3 | gains Retain |

— [vivarium.ts:203](src/core/overworld/vivarium.ts:203)

Weighted by worth rather than uniformly: a Pip off is the roll players will chase, so it is
the rarest, and Retain is the quiet one that makes a situational card worth drafting. A
spell that appears twice is rolled once and shares the result, because the key is the
spell.

The roll is seeded and stored. A beast caught before rolls existed gets a roll seeded off
its own `instanceId` ([save.ts:1108](src/app/save.ts:1108)), so the answer is identical on
every load — a fresh `Math.random()` there would make every reload a different animal.

A discount can take a card to free but never below it, and **never touches Marrow**
([deck.ts:134](src/core/engine/deck.ts:134)). Marrow is a strict requirement rather than a
price; discounting it would be discounting a demand.

### Override sockets: the one thing you *do* choose

Sockets close a gap the Forge left open. A spliced Hybrid is an elemental card, and a Hero
Deck takes neutral and arcane only — so a player could press a Vaporize Blast at the bench
and then have nowhere in the game to put it. The Companion's half is where elemental magic
lives, so that is where a forged one goes.

`socketRefusal(source, unlocked, slot, cardId, size)`
([grimoire.ts:243](src/core/data/grimoire.ts:243)) returns why not, or `null`:

| Refusal | Meaning |
|---|---|
| `bad-slot` | Not an integer in `[0, 8)` |
| `unknown-card` | No such card |
| `not-castable` | A body, a **Mark**, a Rank 2 printing, or engine furniture (`isDraftable`) |
| `not-unlocked` | Printed but not forged — this is the half that makes the Forge matter |
| `off-school` | The bloodline has no claim to either of its schools |

`acceptsSchool` ([grimoire.ts:239](src/core/data/grimoire.ts:239)) needs **one** school in
common, which is what makes a Hybrid the interesting case: an Ignis takes a Pyre/Frost
fusion because half of it is fire, and refuses a Surge/Bloom one because none of it is. A
beast is not a filing cabinet.

`socketableCards` is deliberately **slot-independent** — the gate asks about the card and
the bloodline, never about which of the eight is being replaced. Passing a slot would imply
there is a rule about position, and inventing one nobody asked for is how a picker starts
lying about why a card is grey.

A socketed card never carries the beast's roll
([DeckBuilderScreen.ts:797](src/app/DeckBuilderScreen.ts:797)): the roll belongs to a spell
the beast drafted, and this one was forged at a bench.

`resolveGrimoire(grimoire, overrides)`
([grimoire.ts:292](src/core/data/grimoire.ts:292)) is the **single** definition of "what is
actually in this Grimoire", shared by the fight and by the screen that edits it. Two
readings of that question is how a Field Journal comes to show one book while the board
deals another. An override naming a card that no longer exists is ignored rather than
dealt — a hole in the draw pile is worse than a card the player forgot they socketed.

---

## 3. The Vanguard Roster: bodies, not cards

Minions are **not deck cards**. They are bought once, before the dungeon, out of a budget
that competes with nothing.

### Why

A minion used to cost Pips out of the same pool as the spell it existed to enable, so
buying a board meant not casting anything — the "Pip Tax". The deck keeps the spells now,
and Pips buy magic and only magic
([roster.ts:1](src/core/data/roster.ts:1)).

### The budget: you own a kit, you field an arena's worth of it

```ts
export function rosterBudgetFor(width: number, height: number): number  // width + height
export const KIT_BUDGET = 24;               // what a character may own
export const STARTING_WARBAND_POINTS = 10;  // what a new one is bought with
export const MAX_ROSTER_BEHEMOTHS = 2;      // what a kit may hold
export function fieldableBehemoths(arenaBudget: number): number  // 2 at 16+, else 1
```
— [roster.ts](src/core/data/roster.ts)

There are **two budgets**, and they answer different questions.

The **kit** is what a character owns, capped at 24 — the largest thing any arena could seat.
It is built in the Field Journal, which has no encounter in scope and cannot have one: the
Journal is reached from the Safehouse and a contract is accepted somewhere else. So ownership
cannot be arena-dependent, and `validateRoster` defaults to this ceiling.

The **arena budget** is what a given board will seat: **one point per rank and one per file.**
A warband larger than the ground it is standing on holds the remainder in reserve — which
deployment has always allowed, because "holding something back is a decision, not a mistake."

| | h=4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|
| **w=4** | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
| **6** | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
| **8** | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
| **10** | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
| **12** | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |

Shipped arenas: Narrow Ruin (4×6) **10**, Novice Duelist (6×8) **14**, Glacial Field and the
Ignis Trial (8×8) **16**.

**Why width + height and not area.** The old flat ten was tuned for a 5×5, where ten points is
five basic bodies filling the single territory row — and the formula reproduces that exactly.
It is not area-proportional because area overflows the ground it is buying: deployment happens
in the starting zone, `width` across and one or two rows deep, and 0.4 × 144 would grant a
12×12 warband twenty-nine bodies for twenty-four tiles. A budget that cannot be deployed is a
budget that lies. `width + height` never overflows; the binding case is the 4×4, where four
bodies exactly fill a four-tile row. It also needs no rounding, because a sum of two integers
is an integer — no formula with a `Math.round` in it survives being explained at the table.

Height counts the same as width even though only width adds *seats*. That is intentional: a
deeper board is a longer walk, and a longer walk is what makes a second rank worth owning.

**Where each is enforced.** The kit is settled in the Journal and **never re-litigated at the
door** — refusing a legally bought warband would make the point-buy a lie. Capacity is checked
in `deployRefusal`, which asks the arena's rules before it asks whether a particular tile has
room, because "there is no room there" is the wrong answer to a body the board will never
seat. `PreCombatScreen` shows the number before Ready; the deploy tray shows the running total
and greys what will not fit.

Ten survives as the **starting** allowance, keeping its original character: deliberately not
divisible into a comfortable answer, so the opening warband is a shape somebody chose.

### The price ladder, derived

```ts
export function rosterPointsOf(def: CardDef): number
```
— [roster.ts:40](src/core/data/roster.ts:40)

| Test | Points |
|---|---|
| `footprint === 2` | **6** — a Behemoth is most of a warband |
| total cost ≥ 4 | **4** — elite (asked before reach, so a 4-Pip ranged body is elite rather than merely ranged) |
| `rangeMax > 1` | **3** — ranged |
| otherwise | **2** — basic melee |

Same discipline as `tierOf`, same reason: a minion that shipped without a cost would be a
*free* minion on a point-buy system.

### Eligibility and unlocks

`isRosterEligible` ([roster.ts:65](src/core/data/roster.ts:65)) admits `kind: 'minion'` and
rejects `setupOnly` and `spliceOnly` — that keeps out Bound Forms, authored threats and
wildlife, which were never the player's to field. The pool is derived from the card
database rather than listed, so a new minion joins by existing and can never fall out of
step with what the deck rules refuse.

```ts
export const UNIVERSAL_ROSTER: string[] = ['vanguard_footman', 'scout_imp'];
```
— [roster.ts:81](src/core/data/roster.ts:81)

The floor under a new player: whatever else happens, there is always a line to hold and
something quick to hold it with.

Everything above that floor is **unlocked by taming**. `Profile.rosterUnlocks` is a
persisted ledger ([save.ts:217](src/app/save.ts:217)), written only by
`grantRosterUnlocks` ([save.ts:329](src/app/save.ts:329)). It is deliberately *not* derived
from the current beast roster — that was a real bug: unlocks computed fresh from the
companions you happened to be holding meant that **releasing a Ferrum took the Bulwark
bodies back with it**, and `loadProfile` then silently trimmed a Stone-Heart Golem out of
the saved warband. Taming is a thing that happened; a ledger is how you record a thing that
happened.

`validateRoster(roster, unlocked?)` ([roster.ts:100](src/core/data/roster.ts:100)) mirrors
`validateDeck`'s shape — every problem, not the first — with codes `over_budget`,
`not_unlocked`, `too_many_behemoths`, `unknown_unit`, `not_a_minion`.

Nothing in `roster.ts` is engine vocabulary. The roster resolves to a list of def ids
before `createCombat` ever sees it, exactly as a deck does — the reducer has never heard of
a "point".

---

## 4. Fusion, at the bell

`createCombat` ([setup.ts:472](src/core/engine/setup.ts:472)) assembles the draw pile. The
order is load-bearing:

```ts
const heroDeck = deck && deck.length > 0 ? deck : companion.deck;
const drafted  = carry?.grimoire?.length ? carry.grimoire : companion.legacyGrimoire;
const socketed = resolveGrimoire(drafted, carry?.grimoireOverrides);   // sockets FIRST
const grimoire = socketed.map((id) => printedWith(ascended, id));      // ranks SECOND

buildCommander({
  deckDefs: [...heroDeck, ...grimoire],
  grimoireFrom: heroDeck.length,
});
player.commander.deck = shuffle(rng, player.commander.deck);
```
— [setup.ts:504](src/core/engine/setup.ts:504)

Four things to notice.

**Sockets are applied before printings.** It only reads one way: a socketed card is a card,
so it earns its Rank 2 exactly as a drafted one does. Printing first would raise the card
being *replaced* and leave the replacement at Rank 1.

**The halves are concatenated, then shuffled immediately.** The join is invisible by the
time anything is drawn. The order matters only for `grimoireFrom`, which is how the
instance builder knows which half may carry a roll — a Hero card can never carry a
Companion's spell modifier, because a Hero card was never in a beast.

**Ascension never reaches the reducer.** `printedWith` swaps the def id for its `_r2`
printing; every Rank 2 was derived once at module load
([cards/index.ts:77](src/core/data/cards/index.ts:77)). The combat engine never learns that
"ascended" is a thing at all — a Rank 2 card is simply a card, exactly as a fight with an
Ironbrew is simply a fight that started with armour.

**A fight with no character behind it still works.** No deck falls back to
`companion.deck`; no drafted book falls back to `companion.legacyGrimoire`. That is what
keeps standalone bouts and the engine test suite running with no save file in sight.

---

## 5. One swap, before the fight

```ts
export const MAX_SWAPS = 1;
```
— [deckRules.ts:83](src/core/data/deckRules.ts:83)

The Pre-Combat screen lets you see the arena before you commit
([PreCombatScreen.ts:269](src/app/PreCombatScreen.ts:269)). Adapting to a narrow ruin or an
open field should mean bringing the one answer that shape needs — not rebuilding into a
different deck once the terrain is known, which would make the deck you built beforehand
irrelevant.

It was five swaps against a thirty-card deck, then two against a 5–15 one, and it is one
now. Two swaps against a four-card deck is half the deck, which is not adapting to a ruin;
it is building a second deck once the ruin is known.

```ts
export function swapCount(base: string[], candidate: string[]): number
```
— [deckRules.ts:92](src/core/data/deckRules.ts:92)

A multiset difference taking the **larger** side, so trading one card for another costs one
swap rather than two, and changing the deck's size costs what it actually changes.

The screen refuses over-budget clicks up front rather than allowing them and then disabling
the ready button ([PreCombatScreen.ts:296](src/app/PreCombatScreen.ts:296)), and re-runs
the *full* `validateDeck` before starting — a screen that only checked swaps could ship an
illegal deck into a fight.

---

## 6. What the deck does once the fight starts

| Constant | Value | |
|---|---|---|
| `OPENING_HAND` | 5 | dealt at setup |
| `DRAW_PER_TURN` | 4 | at the start of your turn |
| `HAND_LIMIT` | 7 | |
| `PIP_CAP` | 8 | enforced only at end-of-turn cleanup |

— [deck.ts:21](src/core/engine/deck.ts:21)

**Running out is free.** An empty deck reshuffles the discard pile with no fatigue penalty
([deck.ts:35](src/core/engine/deck.ts:35)). With a 20-card fused deck drawing 4 a turn you
will cycle — that is expected, not punished.

**Overdrawing burns.** Drawing into a full hand discards the card and grants **1 Marrow**
([deck.ts:47](src/core/engine/deck.ts:47)) rather than overfilling. This is why deck size
is a real decision: a smaller deck cycles faster and burns more, and burning is a small
resource gain rather than a pure loss. Ephemeral overlay cards do not count against the
limit.

**Marrow evaporates; Pips bank.** `endOfTurnCleanup`
([deck.ts:201](src/core/engine/deck.ts:201)) zeroes Marrow and caps Pips, and
`costBreakdown` ([deck.ts:95](src/core/engine/deck.ts:95)) spends Marrow before Pips for
exactly that reason. A card priced `{ pips: 3, marrow: 0 }` is payable entirely out of a
tithe; a card priced `{ pips: 1, marrow: 2 }` cannot be bought with patience at any Pip
total.

**Retain** keeps a card through cleanup, and printed Retain and *rolled* Retain count the
same ([deck.ts:197](src/core/engine/deck.ts:197)) — asked of the instance as well as of the
definition, because the whole point of a roll is that this copy is different.

Relics shift some of these: `extraOpeningCards` and `bonusHandLimit` are boons on the Hero
sheet ([DeckBuilderScreen.ts:54](src/app/DeckBuilderScreen.ts:54)).

---

## 7. Where new cards come from

The builder can only arrange what you own, and **winning a fight no longer gives you a
card.** It gives you a *plan*.

### The one door, in two halves

```
beat something  →  take a Schematic off its deck  →  pay the Artificer 100 Ducats  →  card
```

Neither half is enough on its own. A rich character with no Schematics can buy nothing; a
character holding every plan in the game and no Ducats owns nothing new. `rollSchematicOffer`
([schematics.ts](src/core/data/schematics.ts)) is the first half; `forgeSchematic`
([forge.ts](src/core/overworld/forge.ts)) is the second.

This replaced a post-victory roll that drew three cards from the **whole catalogue** and
handed one over free. That made the Artificer's first trade a formality — it would cut
anything you had not already got, so the shelf was the catalogue and Ducats were the only
gate. Two routes to the same place, and the free one was strictly better.

### What a fight teaches

Its own deck. `schematicPool(encounter)`
([schematics.ts](src/core/data/schematics.ts)) is derived from `EncounterDef.enemyDeck`,
filtered through the same `isObtainable` the bench's shelf uses:

| | Offer | Pool it draws from |
|---|---|---|
| Novice | pick 1 of **2** | its own deck |
| Adept | pick 1 of **3** | its own deck |
| Master | pick 1 of **4** | its own deck |

You take **one**. The tier widens the *choice*, not the payout — a Master contract is a
decision with four ways to go wrong, which is the thing a boss should be selling.

Derived rather than authored, and the alternative is worth naming: a `blueprintPool` field
on `EncounterDef` would be a second list of what an encounter contains, correct on the day
it was written and wrong the first time somebody retuned an enemy deck without scrolling
down. Reading `enemyDeck` means a fight teaches what it actually beat you with, and a new
encounter has a pool by existing.

An offer never includes a card you have already forged **or** already hold a plan for. A
duplicate plan is a reward that does nothing, and the second time it happens it reads as
the game being broken rather than as a run of bad luck. A fight you have wrung dry offers
nothing and draws no panel — it still pays Ducats and Cores, it simply has no more to
teach.

**A loss offers nothing.** `ResultsScreen` hands out nothing at all now, and the reward
picker that used to live in it was already dead code: every win goes to `VictoryScreen`,
so the loss screen's offer was unconditionally empty. What a loss costs is still money and
time, never possessions.

### The three trades, unchanged in shape

| Trade | Price | Gate | Effect on deck building |
|---|---|---|---|
| **Schematic Forging** | 100 Ducats | **a Schematic in hand** | Adds a base id to `unlocked` |
| **Ascension** | 60 Ducats + 3 Shards + 1 Core | Unlocked, has a Rank 2 | Adds a base id to `ascended`. Every copy upgrades at once; the copy limit does **not** change |
| **Aetheric Splicing** | 1 Core | A recipe and both schools | Adds a Hybrid to `unlocked`. It is elemental, so a Grimoire socket is its only home |

Splicing deliberately does **not** consume the base card
([splice.ts:109](src/core/overworld/splice.ts:109)): an unlock cannot be spent, because
that is what makes it an unlock. A recipe that ate its base would be the one place in the
game where knowing something could be taken away from you.

**Forging does not consume the Schematic either**, and for a related reason. The ledger is
a record of a thing that happened — like `rosterUnlocks` — so keeping a spent plan is what
lets a later offer tell "you never had this" apart from "you already used it".

---

## 8. The one rule behind all of it

Almost every number above is **derived from what a thing does**, never authored beside it:

| Fact | Derived by |
|---|---|
| Whether a Hero Deck may hold a card | `deckRoleRefusal` — [deckRules.ts](src/core/data/deckRules.ts) |
| Whether a bloodline may draft one | `isDraftable` + `isBloodlineCard` — [grimoire.ts](src/core/data/grimoire.ts) |
| Whose card the face says it is | `ownerOfKind` — [cardFace.ts](src/hud/cardFace.ts) |
| A card's Tier, and so its copy limit | `tierOf` — [deckRules.ts:60](src/core/data/deckRules.ts:60) |
| A body's roster price | `rosterPointsOf` — [roster.ts:40](src/core/data/roster.ts:40) |
| The fused deck's size | `fusedDeckSize` — [deckRules.ts:32](src/core/data/deckRules.ts:32) |
| Which bodies exist to be fielded | `rosterPool` — [roster.ts:71](src/core/data/roster.ts:71) |
| Which cards a bloodline can draft | `purePool` / `hybridPool` — [grimoire.ts:94](src/core/data/grimoire.ts:94) |
| Every Rank 2 printing | `RANK1` → `RANK2`, once at module load — [cards/index.ts:77](src/core/data/cards/index.ts:77) |
| What is actually in a Grimoire | `resolveGrimoire` — [grimoire.ts:292](src/core/data/grimoire.ts:292) |

The reason is always the same, and it is worth stating once because it is the thing this
codebase actually believes:

> **Two derivations of one fact drift, and the drift is invisible because both look correct
> in isolation.**

A hand-listed Tier table would let a new card ship without one. A hand-listed roster price
would let a new body ship free. A second definition of "what is in the Grimoire" is how a
Field Journal comes to show one book while the board deals another — a bug that already
happened once.

The role overhaul added a fourth instance, and it had already gone wrong twice by the time
it was found. The rule "may a Hero Deck hold this" existed in three places: `validateDeck`,
`remainingCopies`, and the save loader's strip pass. The loader's copy read
`kind !== 'minion' && HERO_SCHOOLS.includes(school)`, which would have confiscated an
elemental Mark the Hero is now allowed to lay and kept a colourless Spell if anybody ever
printed one. `remainingCopies` did not ask about role at all, so the shelf offered bodies
the validator then refused. All three now call `deckRoleRefusal`.

**`ownerOfKind` is the same story on the card face.** The HERO / COMPANION badge printed
`CardDef.source`, which looks like it answers "whose card is this" and does not — it means
"cast from the beast's tile", which is why it gates the range check in `targeting.ts`. It is
`'companion'` on the Cinder Mark, so the badge read COMPANION on a card the rules call the
Hero's. The badge is derived from `kind` now; `source` was left alone, because changing it
would have made all three Marks global-range.

---

## 9. Known gaps

Stated plainly rather than left for someone to find:

- **`too_many_behemoths` in `validateDeck` is unreachable.** Minions cannot be deck cards,
  and nothing else in the catalogue carries `unit.footprint === 2`. Vestigial, harmless.
- **Lexis has no Spells and never will.** Its school is arcane, "Spell" means elemental, and
  the two cannot both be true. Its whole Grimoire comes out of the colourless fallback. See
  §2 — this is a Director's decision, not a bug to fix in code.
- **`CardDef.source` no longer means what its name suggests.** It is the *casting origin* —
  it gates the range check and fires Resonance — and it still reads `'companion'` on the
  three Mark cards, which are now Hero property by `kind`. Flipping it would be the honest
  rename and would silently make every Mark global-range, because
  [targeting.ts:41](src/core/engine/targeting.ts:41) discards `range` on Hero cards. Left
  as-is deliberately; the display reads `ownerOfKind` instead.
- **The Aura line is Hero-owned and Hero-undeckable.** Ember Coat, Cataclysm, Marrow Siphon
  and Marrow Burst are `source: 'hero'` and elemental, so they are Spells that no Hero Deck
  may hold. They reach the board only by being drafted into a Grimoire or pressed at the
  splicing bench. This predates the overhaul and the overhaul did not fix it.
- **Schematic and Ascension prices are flat across every Tier.** A Tier 1 staple costs what
  a Tier 3 finisher does. The Ascension uplift is also a flat 10%, so a flat price is the
  honest matching shape until the uplift stops being flat
  ([forge.ts:47](src/core/overworld/forge.ts:47)).
- **29 of the 50 obtainable cards are taught by no shipped fight.** Making the plan the only
  door means a card is reachable exactly when some encounter's deck carries it, and four
  encounters between them play five schools' worth. Bloom, Surge and Bulwark are entirely
  unreachable; so are the Hero's own arcane tools, because no enemy has ever cast one at
  anybody. This closes as encounters are added, and the list is pinned in
  `schematics.test.ts` as an `UNREACHABLE` ledger that fails in **both** directions — a card
  joining it breaks the build, and so does a card leaving it.
- **Cores have no region.** `reagentForAscension`
  ([forge.ts:71](src/core/overworld/forge.ts:71)) takes one Core off your deepest stack,
  because "Regional Reagents" needs a geography the game does not model yet. That function
  is the one place that changes when it does.
