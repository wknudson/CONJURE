# 03 — The RPG Sandbox

The Safehouse, and the four progression loops that run through it.

> **A naming note.** The hub is called **"The Safehouse"** everywhere in the code and on
> screen — subtitled *"Between contracts"*. The name *Oakhaven* does not appear anywhere in
> `src/`. If it is meant to be the settlement the Safehouse sits in, it is not yet
> implemented; this document uses the name the code uses.

---

## 1. The model

CONJURE is a **persistent RPG, not a roguelike.** That single decision shapes every loop
below.

Nothing is wagered on a single outing. The deck, the collection, the satchel, the relics
and the roster are the player's **property** and survive death. What a knockout costs is
**money and time, never possessions**.

```ts
export const RESCUE_FEE_RATE = 0.2;

export function rescuePlayer(state: GlobalGameState): number {
  const before = overworld.economy.ducats;
  overworld.economy.ducats = Math.floor(before * (1 - RESCUE_FEE_RATE));
  overworld.pact.currentHp = 10; // one point, on the stretched scale (STAT_SCALE = 10)
  overworld.activeBuff = null;
  overworld.activeEncounter = null;
  state.combat = null;
  return before - overworld.economy.ducats;
}
```

Two things make it sting anyway. The fee is a **share** of the purse, so it is felt by a
rich player as much as a poor one. And the Pact comes back at **10** — a single point on the
stretched scale, out of a 400-point pool — not full: upright,
but unable to take another contract without spending a tonic or a Clinic fee on getting
well. Waking at full health would make dying a free ride home.

### The Safehouse hub

Four zones plus the Bounty Board:

| Zone | Trade |
|---|---|
| **The Apothecary** | tonics and cosmetics. **Never** cards |
| **The Ironworks Artificer** | all card acquisition and upgrading — Schematics, Ascension, Splicing |
| **The Vivarium** | the Companion roster |
| **The Field Journal** | deck, Threat Ledger, Commander Loadout |

### The `*Refusal` convention

Every till in the sandbox shares one shape:

```ts
type SomeRefusal = 'in-combat' | 'too-poor' | … | null;

someRefusal(state, …): SomeRefusal      // names why, in the player's words
doTheThing(state, …): Result | null     // asks the refusal first, then acts
```

Three rules hold across all of them:

1. **The doer asks the refusal** rather than trusting the button that called it. The
   screen greys a button out; this decides whether it may be pressed. A click on a stale
   button is a thing that happens, not a programming error.
2. **Nothing is charged for a refusal.** Currency is taken only after the refusal passes.
3. **Every till refuses `in-combat`**, checked as
   `state.combat !== null || state.overworld.activeEncounter !== null`. Nothing may change
   a deck once a fight has been committed to, or a card could be upgraded between accepting
   the contract and mounting the board.

Implementations: `consumableRefusal` · `ascensionRefusal` · `schematicRefusal` ·
`spliceRefusal` · `levelRefusal` · `equipRefusal`.

---

## 2. The Vivarium — Rosters

### One beast, not one species

```ts
interface CompanionProgress {
  level: number;
  bonusMaxHp: number;      // added to the Pact ceiling while active
  startingArmor: number;   // nothing grants this yet
  bonusPips: number;       // nothing grants this yet
}

interface CompanionInstance extends CompanionProgress {
  instanceId: string;
  baseId: string;      // the species: 'ignis', 'boreas', 'voltara'
  baseHpRoll: number;  // this animal's constitution
  traitId: string;     // its knack
}
```

The roster is a **list** of these rather than a map keyed by species, because two Ignis are
two different animals: same bloodline, different constitution, different knack. A roster
keyed by `baseId` could only ever hold one of each — and there would be nothing to roll
*for*.

The bonuses are **stored rather than derived from `level`**, so a future level that grants
armour instead of health is a change to `levelCompanion` and not to a formula every reader
would have to learn.

### The taming roll

```ts
export const HP_ROLL_MIN = 36;
export const HP_ROLL_MAX = 44;

export function tameCompanion(rng: RngState, baseId: string, sequence: number): CompanionInstance {
  const pool = traitsFor(baseId);
  const traitId = pool.length > 0 ? pool[nextInt(rng, pool.length)]!.id : '';

  return {
    ...newCompanion(),
    instanceId: `${baseId}-${sequence}`,
    baseId,
    baseHpRoll: HP_ROLL_MIN + nextInt(rng, HP_ROLL_MAX - HP_ROLL_MIN + 1),
    traitId,
  };
}
```

Two axes roll independently: **constitution** (36–44 inclusive, a tight band on purpose)
and **a knack** drawn uniformly from that species' bloodline.

**Seeded**, like everything else in the project with a die in it — the *caller* owns the
stream, so a taming can be replayed and a test can pin one.

The `instanceId` carries the species and a counter rather than a random string, so a save
is readable by a human and two rolls in the same millisecond cannot collide.

`baseHpRoll` is **stored, not re-rolled**, because a beast's constitution is a fact about
the beast. Rolling it again on load would make every reload a re-roll.

The Vivarium grades a roll as **perfect / strong / fair / runt** by where it sits in the
band — the reason to keep one or let it go.

### Traits — a bloodline, not a pool

```ts
interface CompanionTrait {
  id: string;
  name: string;
  text: string;
  baseId: string;        // which species can roll this
  boons: CombatBoons;    // the engine's own vocabulary
}
```

Authored as **capabilities**, never as an id the reducer recognises — the same discipline
relics keep. `createCombat` is handed *"this side is immune to Burn"* and has never heard
of an Ash-Walker.

And the same house rule: a trait bends what is **possible**. None of them moves a damage
number, and `CombatBoons` has nowhere to put one that did.

| Species | Traits |
|---|---|
| **Ignis** (pyre) | Ash-Walker (`immuneToBurn`) · Searing Gaze (`ignoreFog`) · Banked Coals (`armor: 2`) |
| **Boreas** (frost) | Glacial Pacing (`boundFormGrounded`) · Deep Reserve (`maxPips: 9`) · Rimed Lungs (`immuneToBurn`) |
| **Voltara** (surge) | Storm Lungs (`maxPips: 9`) · Earthed Pelt (`armor: 2`) · Static Cling (`boundFormIgnoresHazards`) |

> **Adding a species requires adding its bloodline.** `tameCompanion` rolls from
> `traitsFor(baseId)`; a species with an empty pool hands every instance `traitId: ''`. A
> test asserts every species has more than one trait, because one trait makes the roll a
> formality.

> **Closed gap (2026-09-01):** `ignoreIceSlip` was carried all the way to
> `CommanderState.ignoresIceSlip` and read by nothing — there was never an ice hazard for
> it to answer — so Glacial Pacing, Static Cling, Glass-Footed and the Rimewalker Crampons
> did nothing. The boon is gone; each source now names the real footing rule its text was
> already describing, ids unchanged so a beast already carrying one simply starts working.

### The Pact ceiling

```ts
export const BASE_PACT_HP = 40;

export function syncPactCeiling(overworld, companion): void {
  const base = companion && 'baseHpRoll' in companion ? companion.baseHpRoll : BASE_PACT_HP;
  overworld.pact.maxHp = base + (companion?.bonusMaxHp ?? 0);
  overworld.pact.currentHp = Math.min(overworld.pact.currentHp, overworld.pact.maxHp);
}
```

**The active instance sets the Pact's ceiling.** Switching Companions moves the gauge
immediately — at the moment of the choice, not at the next fight.

Raising the ceiling **does not heal**. `currentHp` is only ever clamped *down*. A bigger
beast is a bigger gauge; growth of your own is what levelling hands over.

`maxHp` is a stored number resynced at chokepoints rather than derived, because four
separate clamps read it: the Clinic bill, the tonic cap, the post-fight write-back, and
the board.

### Levelling

```ts
export const HP_PER_LEVEL = 2;

export function levelCost(progress) {
  return { ducats: 150 * progress.level, marrowShards: 2 * progress.level };
}
```

Scales with the level being left behind, so the first is affordable off a couple of
contracts and the fifth is a campaign.

**Both currencies, deliberately.** This is the one sink that competes with *both* halves of
the Artificer — which is what stops a player pouring everything into cards and arriving at
a Master bounty with a level 1 body.

`levelRefusal`: `in-combat` · `unknown-companion` · `too-poor`.

### Release

Two clicks on the same button rather than a modal: releasing is destructive but small and
frequent — you will do it to most of what you catch — and a dialog per runt would make the
roll loop miserable.

**The last beast on the roster cannot be released.** A character with no Companion has no
Pact ceiling and no body on the board; every screen below would need a branch for it, and
the player would have made themselves unplayable in one click.

Releasing the active beast promotes the next one and resyncs the ceiling, or the gauge
would sit at a number nothing on the roster supports.

### Migration (v8 → v9)

A v8 save held `Record<baseId, progress>` — one entry per species, no constitution and no
knack. Those become instances **carrying the levels they earned**, and each gets
`BASE_PACT_HP` rather than a fresh roll.

> Rolling on migration would hand some players a god roll and others a dud purely for
> having upgraded — a lottery nobody entered.

`activeCompanionId` reads a v5 `lastCompanionId`, a v8 species id, or a v9 instance id, and
**always writes an instance id**.

---

## 3. The Artificer — the Forge

Two currencies, two jobs, deliberately not interchangeable:

> **Ducats acquire. Aether Shards master.**

Winning contracts and butchering things pull in different directions, and neither sink can
be starved by spending on the other.

### Schematic Forging

```ts
export const SCHEMATIC_COST_DUCATS = 100;
```

Buys **one copy** of a card you have never held. Flat cost whatever the card — a Tier 1
staple therefore costs what a Tier 3 finisher does, which is not where this should end up;
a per-tier curve is the wrong thing to build twice.

`schematicRefusal`: `in-combat` · `unknown-card` · `already-owned` · `too-poor`.

**One copy from the bench, ever.** Further copies are what winning is for — which is what
stops a rich player buying a legal deck outright.

The shelf is gated on `isObtainable`, so it never offers `setupOnly` bodies, the Rite,
`_r2` printings, or `spliceOnly` hybrids.

### Card Ascension

```ts
export const ASCENSION_COST_SHARDS = 3;
```

Flat, whatever the card. Ascension is a sink, not a market.

**Rank 2 is authored as a diff, not a second card:**

```ts
interface Rank2Overrides {
  name?; cost?; text?; effect?; keywords?;
  unit?: Partial<UnitStatBlock>;
  obstacleHp?; range?; minRange?; needsLoS?; vector?;
}
```

`id`, `school`, `source`, `kind` and `target` are **deliberately absent**. A Rank 2 that
picked its targets differently, or moved from Hero to Companion, would be a different card
wearing the same name — and since both ranks share one copy cap, it would be a different
card smuggled past the deck rules.

Authoring as overrides means a change to the Rank 1 printing — a nerf, a keyword, a
re-cost — carries into Rank 2 automatically instead of quietly leaving the upgraded copy
on last season's numbers.

**The `_r2` id convention.** `ascendedId(id)` appends `_r2`; `baseIdOf()` has stripped
`_r[23]` since long before Ascension existed, precisely so both ranks would share one copy
cap. Deck validation, tier limits and the builder need no idea Ascension happened.

**Merged at module load, not at draw time:**

```ts
const RANK2: Record<string, CardDef> = {};
for (const base of Object.values(RANK1)) {
  if (base.rank2) RANK2[ascendedId(base.id)] = ascend(base);
}
export const CARDS = { ...RANK1, ...RANK2 };
```

The combat reducer therefore never learns what "ascended" means. A Rank 2 card is simply a
card — exactly as a fight with an Ironbrew is simply a fight that started with armour.
`ascend()` also deletes the merged card's own `rank2`, or an ascended card would claim it
could be ascended again and the forge would offer it.

Ascension is tracked **account-wide per base id** in `collection.ascended`, not per copy.

`ascensionRefusal`: `in-combat` · `no-rank-2` · `not-owned` · `already-ascended` ·
`too-poor`.

### Aetheric Splicing

The only place in the game where **the collection can shrink**.

```ts
const REAGENTS = [ 'core_pyre', 'core_surge', 'core_frost' ];   // id = core_<school>

const SPLICE_RECIPES = [
  { baseCardId: 'flame_surge', catalystId: 'core_frost', resultId: 'vaporize_blast' },
  { baseCardId: 'flame_surge', catalystId: 'core_surge', resultId: 'superconduct_strike' },
];
```

**A recipe is a lookup, not a construction.** Base card + reagent *names a hybrid that
already exists in the registry.* That is the whole safety property: the bench can only ever
produce a card the engine already knows how to resolve, so it cannot invent something that
fails in combat instead of at the counter. A recipe naming a card nobody printed refuses at
the till.

Both current recipes take the same base card deliberately — the interesting decision is
*which core to spend*, not which card to feed in. `flame_surge` is the common Pyre spell
every starter deck carries, so the bench is reachable on day one.

**The transaction — refuse, then take, then give:**

```ts
if (spliceRefusal(…) !== null) return null;   // refuse first: a stale button takes nothing

reagents[catalystId] -= 1;                    // take the core
owned[baseCardId] -= 1;                       // take the card
owned[recipe.resultId] += 1;                  // give the hybrid

const trimmed = trimDecks(decks, baseCardId, remaining);
```

There is no window in which the player has been charged and has nothing.

**Deck trimming is part of the same transaction.** A splice that took a copy out from under
a deck holding three would leave the player with a deck flagged illegal and no explanation.
`trimDecks` removes copies **last-first** — so a deck loses the card it was least
deliberate about keeping — and only as many as it must, so a deck running one of three is
untouched when the other two are spent.

> Spending a card out of a 12-card deck legitimately leaves it `too_small`. Trimming
> guarantees no deck holds more than you own; it does not guarantee the deck stays legal.

**`spliceOnly` protects the loot pool.** Hybrids are real, playable cards, but they are the
*product* of a sink. `isObtainable` excludes them, so neither a reward roll nor the
Schematic shelf can hand one over for free — which is exactly how Rank 2 printings leaked
before that predicate caught them.

`spliceRefusal`: `in-combat` · `no-recipe` · `not-owned` · `no-reagent`.

### The Clinic (Apothecary)

`CLINIC_RATE = 3` Ducats per point of Pact health. An economic floor that keeps a player
who has spent everything from being locked out of the next contract.

---

## 4. The Bounty Board

### Seed-based generation

```ts
export function rollBounties(seed: number): Bounty[] {
  const rng = makeRng(seed);
  return DIFFICULTIES.map((difficulty) => { … });
}
```

**Three contracts at a time, exactly one per tier**, so the board is always a choice about
risk rather than a list of whatever the dice produced.

The seed lives on the character (`overworld.bountySeed`). That is what keeps the board
**still** while the player wanders in and out of the shops — a board that rerolled on every
hub mount would let anyone reroll a bad offer by opening a door and closing it.

```ts
export function nextBountySeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}
```

Advanced **once per finished fight, win or lose** — inside `resolveCombat`. A player who
declines everything keeps that board; refreshing on a timer would mean the right play is to
wait.

### Tiers

| Tier | Encounters | Base Ducats | Shards | Cores | Spread |
|---|---|---|---|---|---|
| **novice** | `novice_duelist` | 40 | 0 | 0 | ±15 |
| **adept** | `narrow_ruin`, `glacial_field` | 85 | 1 | 1 | ±30 |
| **master** | `ignis_trial` | 160 | 3 | 2 | ±60 |

Tiers are derived from what each encounter actually asks of a player, not from a number on
the encounter: the duel is an honest opener, the ruin and the field punish bad positioning,
and the Trial is a boss with a Rite attached.

**Shards only start at Adept.** They are the currency the Artificer wants, so the bench
stays out of reach until a player is taking real work.

**Cores are the only way to earn a reagent.** Novice work pays none — the two a character
starts with are for learning what the bench does; everything after is worked for. *Which*
core is rolled, so a run of Adept contracts is not a run of the same core.

`TIER_SPREAD` is what stops two Adept contracts being interchangeable.

The bounty id is `${difficulty}_${seed}_${enemySeed}`, seeded so a cached `bountyId` cannot
be confused with the same tier on a later board.

> `enemySeed` is an **encounter id**, not a number — so a bounty on disk still means the
> same fight after the catalogue grows.

> AI difficulty is a **global preference** on the SaveFile, kept deliberately separate from
> the Bounty Board's tier. Choosing harder work and choosing a sharper opponent are two
> different decisions.

### `spoils` dictates the reward

```ts
interface CombatSpoils {
  ducats?: number;
  marrowShards?: number;
  reagents?: Record<string, number>;
}
```

Named for **the purse it lands in** rather than the contract it came from — `ducats` and
`marrowShards` are the economy's own field names, so a payout cannot miss by being spelled
one way at the bounty end and another at the till.

The payload is **cached into `activeEncounter` at the moment the contract is accepted**
(see [01 — The Anti-Save-Scum Lock](./01_system_architecture.md)). The board rerolls after
every fight, so a win settled against the *new* board would pay for a job nobody accepted.

Payment, in `resolveCombat`:

```ts
const spoils = overworld.activeEncounter?.spoils ?? {};   // read BEFORE closing

overworld.pact.currentHp = clamp(outcome.pactHp);
overworld.activeBuff = null;
overworld.activeEncounter = null;

if (result === 'victory' || result === 'bound') {
  overworld.economy.ducats += spoils.ducats ?? 0;
  overworld.economy.marrowShards += spoils.marrowShards ?? 0;
  for (const [id, count] of Object.entries(spoils.reagents ?? {})) …
}

overworld.bountySeed = nextBountySeed(overworld.bountySeed);
```

**`bound` is a win.** The Companion was subjugated rather than the enemy killed, and it
pays the same.

The brew is spent **whether the fight was won or lost** — a consumable you get back on a
loss is not a cost.

The Pact is written back **wounds and all**. A fight won at three health is one that makes
the next contract terrifying.

### Rewards

A win also offers a **choice of cards**, rolled from `isObtainable` — drawn from what
exists rather than what is owned, so a reward can introduce a school the player has never
played. The roll is seeded off the running record, so rebuilding the screen does not
reroll the offer.

The Threat Ledger is written **win or lose**: killing a thing teaches you what it was, and
losing the fight afterwards does not un-teach it.

---

## 5. Loose ends

Currently true of the implementation, and worth knowing before building on it:

- **Reagent harvesting from the Overworld map does not exist.** Cores come only from Adept
  and Master bounties.
- **Companion unlocking is not gated.** Every species is tameable; the roster filter is the
  seam where a gate would go.
- **The title screen still lets you pick a Companion**, duplicating the Vivarium.
- **Schematic cost is flat** across all tiers.
- **`startingArmor` and `bonusPips` on `CompanionProgress` are never granted** by anything;
  `levelCompanion` only moves `bonusMaxHp`.
