# Deck Building

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
export const HERO_SCHOOLS: readonly string[] = ['neutral', 'arcane'];
```
— [deckRules.ts:43](src/core/data/deckRules.ts:43)

A Pyre card in a Hero Deck is refused with `off_school`. The reason is not flavour: the
elemental colour comes from the Companion, so a Hero Deck holding Pyre would be competing
with the Grimoire for the same job — and would let a player carry a second school their
Companion cannot support with a Resonance.

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

### Validation

`validateDeck(deck, collection?)` returns **every** problem rather than the first
([deckRules.ts:156](src/core/data/deckRules.ts:156)), so the builder can show a complete
list instead of making the player fix them one at a time.

| Code | Meaning |
|---|---|
| `too_small` / `too_large` | Outside 4–12 |
| `minion_in_deck` | A body. It belongs in your Vanguard Roster |
| `off_school` | An elemental card. Your Companion brings the elements |
| `unknown_card` | The card no longer exists in this version |
| `over_copy_limit` | More copies than the Tier allows |
| `not_unlocked` | Not forged yet |
| `too_many_behemoths` | See the note below |

The **order the checks are asked in is load-bearing.** `minion_in_deck` is asked before
`off_school` because a minion is very nearly always elemental too, and "this belongs in
your Vanguard" is the useful half of that answer — being told a Grave Sentinel is the wrong
*colour* would send the player looking for a neutral one that does not exist. `off_school`
in turn is asked before the copy limits, so a deck full of Pyre is told the one thing that
matters rather than a list of tier violations.

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
([grimoire.ts](src/core/data/grimoire.ts)). Two Ignis are two different decks — one heavy
on runes, one that happened to roll three Cataclysms — and that is the reason to go and
catch a second one.

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

### The neutral fallback is a content gap wearing a rule

Bulwark has two spells to its name and Surge has three, so neither can fill eight out of
its own school even with every copy the Tier limits allow. Rather than deal a short book —
silently, forever — a thin bloodline tops up from `neutral` and `arcane`
([grimoire.ts:146](src/core/data/grimoire.ts:146)).

This is stated in the source as a known gap, not as a design: it fires only when a
bloodline runs out, so the day Bulwark has eight spells' worth of its own is the day this
stops happening, with nothing to remove.

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
| `not-castable` | A body, a Rank 2 printing, or engine furniture (`isDraftable`) |
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

### The budget

```ts
export const ROSTER_BUDGET = 10;
export const MAX_ROSTER_BEHEMOTHS = 1;
```
— [roster.ts:19](src/core/data/roster.ts:19)

Ten is "deliberately not divisible into a comfortable answer."

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

The builder can only arrange what you own. The collection itself changes in exactly three
places, all at the Ironworks Artificer — see
[05_ironworks_artificer.md](docs/05_ironworks_artificer.md).

| Trade | Price | Effect on deck building |
|---|---|---|
| **Schematic Forging** | 100 Ducats | Adds a base id to `unlocked`. Owning one copy takes the card off the shelf entirely — extra copies are what winning is for, which is what stops a rich player buying a finished deck outright |
| **Ascension** | 60 Ducats + 3 Shards + 1 Core | Adds a base id to `ascended`. Every copy in every deck upgrades at once; the copy limit does **not** change |
| **Aetheric Splicing** | 1 Core | Adds a Hybrid to `unlocked`. It is elemental, so it can never enter a Hero Deck — a Grimoire socket is its only home |

Splicing deliberately does **not** consume the base card
([splice.ts:109](src/core/overworld/splice.ts:109)): an unlock cannot be spent, because
that is what makes it an unlock. A recipe that ate its base would be the one place in the
game where knowing something could be taken away from you.

---

## 8. The one rule behind all of it

Almost every number above is **derived from what a thing does**, never authored beside it:

| Fact | Derived by |
|---|---|
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

---

## 9. Known gaps

Stated plainly rather than left for someone to find:

- **`too_many_behemoths` in `validateDeck` is unreachable.** Minions cannot be deck cards,
  and nothing else in the catalogue carries `unit.footprint === 2`. Vestigial, harmless.
- **The `neutral`/`arcane` Grimoire fallback is a content gap wearing a rule.** Bulwark has
  two spells and Surge three; neither can fill eight out of its own school. Write the
  content and the rule stops firing on its own, with nothing to remove.
- **Schematic and Ascension prices are flat across every Tier.** A Tier 1 staple costs what
  a Tier 3 finisher does. The Ascension uplift is also a flat 10%, so a flat price is the
  honest matching shape until the uplift stops being flat
  ([forge.ts:47](src/core/overworld/forge.ts:47)).
- **Cores have no region.** `reagentForAscension`
  ([forge.ts:71](src/core/overworld/forge.ts:71)) takes one Core off your deepest stack,
  because "Regional Reagents" needs a geography the game does not model yet. That function
  is the one place that changes when it does.
