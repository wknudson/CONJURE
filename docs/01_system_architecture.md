# 01 — System Architecture

State, persistence, and the boundary between the two halves of the game.

Everything here describes the implementation as it currently stands. Where a number is
quoted, the constant that holds it is named so you can find it.

---

## 1. The two halves

CONJURE is two programs that meet at one seam.

| | **The Overworld** | **The Combat Engine** |
|---|---|---|
| Lives in | `src/core/overworld/` | `src/core/engine/`, `src/core/ai/`, `src/contract/` |
| Owns | a character: the Pact, the purse, the satchel, the roster, the open contract | one fight: a grid, two commanders, cards, units, hazards |
| Lifetime | forever | from the opening bell to `combatEnded` |
| Persisted | yes | **no** |

They share `src/core/types` and `src/contract`, and they meet in exactly one file:
`src/core/overworld/run.ts`. Nothing else is allowed to know both.

---

## 2. The Save Schema

### The file

```
SaveFile
├── version: number                    ← SAVE_VERSION, currently 9
├── activeProfileId: SlotId | null     ← which poster is being played
├── difficulty: string                 ← AI tier, a global preference
└── profiles: Partial<Record<SlotId, Profile>>
```

Stored in `localStorage` under `conjure.save`, with a rolling backup at
`conjure.save.bak`.

`difficulty` sits on the file rather than on a Profile because the AI tier is a preference
about how the player likes to be challenged, not something a character owns — changing it
should not mean changing it three times.

### Three slots, fixed

```ts
export const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;
```

Slot ids are **fixed, not generated**. A poster is a place on a wall, so its identity is
the place. That buys three things for free: an empty slot is simply a missing key,
deleting a character is deleting one, and `activeProfileId` survives a reload as a string
that means the same thing next time.

`profiles` is a `Partial<Record<…>>` — a missing key is an empty poster, which is a real
and expected state rather than a corrupt one.

### One Profile

```
Profile
├── profileId, name, level              ← poster metadata (see below)
├── state: GlobalGameState              ← the live character
├── collection: Collection              ← every card owned, + ascensions
├── decks: Record<companionId, SavedDeck>
├── activeCompanionId: string           ← an *instanceId*, not a species
├── companions: CompanionInstance[]     ← the roster
├── record: { wins, losses, bound }
├── bestiary: Bestiary                  ← per character, deliberately
└── lastRun?: { encounterId, seed, companionId, deck }
```

The split is between **the live character** (`state`) and **property that outlives any
single fight** (everything beside it). That is the same split the rest of the codebase
draws, and keeping it here meant `GlobalGameState` needed no widening to be storable.

`level` is a **denormalised cache** of the active Companion's level, restamped on every
write by `stampProfile`. The title wall paints three posters without deserialising three
engine states; it should not have to reason about Companion progression to do it.

`bestiary` is per character rather than shared, so a second Commander starts the Threat
Ledger blank — which is what makes filling it in feel like their own work.

### How `GlobalGameState` is wrapped

```ts
export interface GlobalGameState {
  overworld: OverworldState;          // persisted
  combat: CombatSnapshotRef | null;   // transient
}

/** Typed as unknown so this module has no reason to import the engine. */
export type CombatSnapshotRef = unknown;
```

Two things are going on here, and both are deliberate.

**The type is opaque on purpose.** `combat` is declared `unknown`, not `GameState`, so
`state.ts` has no reason to import the engine — this is the boundary of §3 being held at
the type level. `run.ts` is where the two halves are known together, and it does the
narrowing.

**What actually gets assigned is a pointer, never a board.** `main.ts` writes:

```ts
global.combat = { encounterId: encounter.id, seed };
```

Just the two values needed to *rebuild* a fight. A live `GameState` is transient by
construction — it is never assigned here, so it can never reach the disk.

That falls out of determinism rather than being enforced separately. The engine is a
seeded reducer, so `encounterId + seed + the same commands` reproduces the same fight
exactly. Storing the board would be storing a derived value.

`OverworldState` deliberately has **no `deck` field**. The saved master deck *is* the
active deck. A second copy would be the "run deck" the RPG pivot discarded, and a mirror
is how the two drift apart.

### Writes are whole-file

```ts
writeSave(file: SaveFile): void
```

There is deliberately **no per-profile write**. Every write takes the whole file, so a
save can never be assembled from one profile and half of another. Unplayed slots survive
by construction rather than by remembering to copy them.

### Loading is reconstruction, not trust

`loadSave()` never trusts what is on disk. Every field is rebuilt:

- **Version migration.** Older saves run `migrateFile` / `migrateProfile`, which re-read
  static card data from `CARDS` rather than trusting what the save recorded. Card
  definitions change; a save must never pin stale numbers.
- **Renames are remapped.** `RENAMED_CARDS` maps old ids to new (`spark_wisp` →
  `marrow_wisp`, `spell_vaporize_blast` → `vaporize_blast`). Without this a rename is a
  *confiscation*: `reconcileCollection` drops ids it does not recognise, and decks holding
  one stop validating.
- **Hand-edited values are clamped.** Negative purses become 0, fractional shards are
  rounded, an over-full satchel is cut to `INVENTORY_LIMIT`, an unreadable brew becomes
  `null`, and a `baseHpRoll` outside `36–44` is clamped back into the band.
- **Unknown ids are dropped, not fatal.** A relic or species that has since been cut is
  skipped; the save loses the item, not the character.

localStorage can be unavailable (private browsing), full (quota), or hold corrupted JSON
from an interrupted write. None of those may lose a collection or crash the game on boot.

---

## 3. The Seam

### The rule

> **The combat engine never imports the overworld, and the overworld's state never
> imports the engine.**

They meet in `run.ts`, which is the one file allowed to know both.

This is what keeps `createCombat` testable with no run existing at all. An engine that
understood what an "ironbrew" was would be a combat engine you could not test without an
overworld — and adding a fourth brew would mean editing the reducer.

### How it is enforced

`src/tests/boundaries.test.ts` reads **source text**, not the module graph:

```ts
const ENGINE = {
  ...import.meta.glob<string>('../core/engine/**/*.ts', { query: '?raw', … }),
  ...import.meta.glob<string>('../core/ai/**/*.ts',     { query: '?raw', … }),
  ...import.meta.glob<string>('../contract/**/*.ts',    { query: '?raw', … }),
};
```

Source text rather than the graph, deliberately: **a type-only import vanishes at
runtime**, so a graph walk would call the boundary clean while the code says otherwise —
and it is the code a future reader copies from.

Two assertions:

1. No file under `engine/`, `ai/`, or `contract/` has a `from '…overworld…'` specifier.
2. `overworld/state.ts` imports nothing from `engine` or `contract`.

Plus a guard against the one way an architectural test fails silently:

```ts
expect(Object.keys(ENGINE).length, 'files actually read').toBeGreaterThan(20);
```

A scan that read nothing would otherwise pass by vacuum.

> Vite parses the glob options statically, so they **must be an inline object literal** —
> a shared constant is rejected at transform time. `node:fs` is not used because the
> project carries no Node types, and one guard is not worth a dependency.

### Capability translation

Everything the overworld owns is translated into the engine's own vocabulary **before** it
crosses the seam. The engine receives numbers and flags; it never receives an id.

```
brew id ─────────┐
relic ids ───────┼──► carryFor() ──► CombatBoons ──► CombatCarry ──► createCombat
companion level ─┤
trait id ────────┘
```

`CombatBoons` is the entire vocabulary of what a run may bend:

| Field | Effect |
|---|---|
| `armor` | Persistent Armor on the Commander at the opening bell |
| `bones` | added to the starting Bone bank |
| `extraOpeningCards` | drawn on top of the ordinary opening hand |
| `maxBones` | raises the Bone **ceiling** for the whole fight |
| `ignoreFog` | fog and steam no longer break this side's line of sight |
| `immuneToBurn` | Burn stops ticking on this side |
| `immuneToToxin` | Toxin stops ticking on this side |
| `revealIntents` | the opposition declares its card plays as well as its blows |
| `bonusObstacleHp` | added to every wall this side raises from a card |
| `bonusTitheMarrow` | added to what each of this side's blood tithes pays out |
| `healOnTithe` | health returned to the Pact each time this side bleeds a body |
| `bonusToxinStacks` | extra stacks folded into every Toxin this side applies |
| `boundFormIgnoresHazards` | the Bound Form crosses rubble freely and rides no current |
| `boundFormGrounded` | the Bound Form cannot be shoved, pulled, or carried |

The last four are worth a note. Two of them describe a *moment* rather than a state — a
body being given up, a status being applied — and the obvious way to build those is an
event listener. This codebase has none and does not want one: each is a number the engine
reads **at the chokepoint the moment already passes through**, so a tithe is still one
straight line of code and a trait is still a row in a data table.

The two `boundForm*` flags are deliberately scoped to that one body. A Companion's own
nature does not travel to the minions it fights beside.

**There is no `damage` field, and that is the point.** The house rule — *"gear bends a
rule, it does not raise a number"* — is enforced by the schema having nowhere to put one.
A test asserts no trait's boons contain a `damage` key.

Folding in `carryFor`:

```ts
const gear  = boonsOfRelics(overworld.equippedRelics);
const knack = traitById(companion.traitId)?.boons ?? {};

const armor   = brew.armor + companion.startingArmor + gear.armor + knack.armor;  // additive
const maxBones = Math.max(gear.maxBones ?? 0, knack.maxBones ?? 0);                   // maximal
```

**Additive where adding makes sense, maximal where it does not.** A second coat is more
armour; a second battery is not a higher ceiling. `maxBones` is stated as *the ceiling it
produces* (9) rather than as `+1`, so the number in the data is the number the engine uses
and two batteries are one battery. It is ignored when lower than the default: gear bends a
rule in the player's favour or not at all.

`CombatCarry` is what actually crosses:

```ts
interface CombatCarry {
  startingHp?: number;   // the Pact as it currently stands — absent means full
  maxHp?: number;        // the character's gauge, ceiling already folded in
  boons?: CombatBoons;
}
```

`createCombat` applies `maxHp` **before** the `startingHp` clamp, so a bigger Companion is
a bigger gauge rather than a heal.

Adding a fourth relic, a fourth brew, or a seventh trait is a **row in a data table**. The
reducer is not touched.

---

## 4. The Anti-Save-Scum Lock

### The problem

Without this, closing the tab on a losing turn is strictly better than losing. Walking
away costs nothing; losing costs a rescue fee.

### The mechanism

```ts
// main.ts — startCombat, before the board mounts
global.combat = { encounterId: encounter.id, seed };
global.overworld.activeEncounter = { bountyId: bounty.id, spoils: bounty.spoils };
persist();                 // ← on disk BEFORE the screen exists

screens.go(new CombatScreen(…));
```

The ordering is the whole feature. `persist()` runs **before** `screens.go`, so from the
instant a contract is committed to, the disk says a fight is open.

```ts
interface ActiveEncounterState {
  bountyId: string;
  spoils: CombatSpoils;
}
```

### Collection at boot

```ts
// main.ts:175
if (p && forfeitIfAbandoned(p.state.overworld)) forfeited = true;
```

```ts
export function forfeitIfAbandoned(state: OverworldState): boolean {
  if (state.activeEncounter === null) return false;
  state.activeEncounter = null;
  state.pact.currentHp = 0;
  return true;
}
```

A still-open contract on boot is a fight the player walked out of. It resolves as a
knockout: the Pact drops to 0, and the player is met by the rescue flow — the same 20%
purse fee (`RESCUE_FEE_RATE`) and the same revival that losing honestly would have cost.

### Why the payload carries the spoils

`activeEncounter` holds the **payout**, not merely a flag that a fight is open. What a win
is worth is fixed at the moment the contract is accepted.

The Bounty Board rerolls after every fight (`nextBountySeed`). Without the cached copy, a
victory would be settled against whatever the *new* board happened to offer — paying for a
job nobody accepted. `resolveCombat` therefore reads the spoils **before** clearing the
contract:

```ts
const spoils = overworld.activeEncounter?.spoils ?? {};   // read first
…
overworld.activeEncounter = null;                          // then close
```

### The consequence for the Victory Screen

The Victory Screen is a **read-only receipt**. It cannot defer the save write, because the
character is written back the moment combat resolves — and a deferred write would leave
`activeEncounter` set while the player looked at their winnings, so closing the tab on the
victory screen would forfeit a fight they actually won.

---

## 5. Determinism

| Guarantee | How |
|---|---|
| Same seed, same fight | `makeRng` / `nextInt` / `shuffle`; the state carries its own `rng` |
| Same commands, same result | the reducer is pure and synchronous |
| Ids never depend on timing | `nextId` and `causeCounter` are monotonic counters in state |
| Rewind un-counts kills | `encountered` / `defeated` live in `GameState`, so `snapshot`/`restore` handles them for free |

`Infinity` is banned from state: it serialises as `null`, which would corrupt the state
hash and with it both replay and saves. Permanent hazards carry a `permanent: true` flag
instead of `turns: Infinity`.

Because the fight is reproducible from `encounterId + seed`, `lastRun` records both — a
battle worth talking about can be found again, and a bug report can name the exact game.
