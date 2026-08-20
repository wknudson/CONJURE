# Combat Overhaul — The Vanguard Roster and the Rule of 3

**Status:** Design baseline. Nothing here is implemented yet.

This document replaces the summoning economy described in `docs/02_combat_lexicon.md` §6
and the Escalation rule in §5. Where the two disagree, this one is the intent and the
Lexicon is the record of what the code does today.

Every claim about current behaviour carries a `file:line`. Every number the Game Director
fixed is reproduced exactly; everything layered on top is marked **[proposal]** so a reader
can tell the ruling from the reasoning.

---

## 0. Why

### The Pip Tax

A minion costs Pips out of the same pool as the spell it exists to enable.

All 33 `kind: 'minion'` definitions cost between 1 and 4 Pips, and **not one of them costs
Marrow** — every body competes directly with every spell. Turn income is exactly `+1`
(`turn.ts:44`, whose own comment calls it "the game's only source of Pip income"), so a
3-Pip ranged body is three turns of the entire economy. The player who wants a board pays
for it with the turns they wanted the board *for*.

Two consequences fall out of that, and both are visible in the shipped content:

1. **The opening is a setup turn, not a tactical one.** The engine already concedes this —
   `setup.ts:404-412` hands *both* sides a free `vanguard_footman` with the comment "so
   turn one is a real tactical turn instead of a setup turn." A free body is a patch over
   an economy that cannot afford one.
2. **Bodies are priced as spells and then die like bodies.** `killEntity` deletes the unit
   outright (`death.ts:42`). Three Pips buy a thing an enemy removes for free, and nothing
   in the game brings it back.

### The shape of the fix

Minions stop being cards. They become a **Vanguard Roster**: a persistent, point-bought
warband the player commits to before a dungeon and deploys onto the board before turn 1.
The deck keeps the spells. Pips buy magic, and only magic.

That single move breaks three other systems by implication, which is why this document has
five pillars rather than one:

- Persistent bodies that never leave make **Escalate** unbounded (§5).
- Persistent bodies that die *permanently* make the roster a wasting asset, so death needs
  an answer (§4).
- **Sacrifice** — killing your own minion for Marrow (`engine.ts:406-434`) — is a fine
  trade when the minion came from a card you can draw again, and an unacceptable one when
  it came from a roster slot you committed to for the dungeon (§3).

### What does not change

The overhaul stays inside the house style. Nothing below asks for an exception to any of
it:

| Invariant | Where it is stated |
|---|---|
| One pure reducer, `applyCommand(state, cmd) → {state, events}` | `02_combat_lexicon.md` §1 |
| Events carry **snapshots**; the renderer never re-reads live state | §1 |
| Cards are **data, not closures** — the AI reads their shape | §6 |
| Every till names its refusal in the player's words (`*Refusal` + doer) | `03_rpg_sandbox.md` §1 |
| Seeded RNG; the caller owns the stream | §2 |
| The engine never imports the overworld; they meet only in `run.ts` | `01_system_architecture.md` |
| Marrow is **use-it-or-lose-it** (`deck.ts:178`) | §2 |

New commands are commands. New phases are phases. Replay-from-seed, undo, and the AI's
data-driven enumeration all keep working because nothing here reaches around the reducer.

---

## 1. Pillar One — The Vanguard Roster

**Minions are no longer drawn from the deck.** The player builds a roster before entering a
dungeon, using a point-buy budget. Unlocking a Companion in the Overworld permanently
unlocks that Companion's minion types for the universal roster.

### 1.1 The budget

```
ROSTER_BUDGET = 10

  basic melee    2 points
  ranged         3 points
  Behemoth       6 points
```

**[proposal] A fourth class at 4 points — "elite".** Two shipped units (`slag_iron_golem`,
4 Pips, Guardian + Counter, 8 HP; `arc_turret`, 4 Pips, 5 ATK) are plainly not 3-point
ranged bodies and are equally plainly not Behemoths. Pricing them at 3 makes the ranged
class the only class worth buying; pricing them at 6 makes them Behemoths that cannot
block a 2×2 corridor. The four-class ladder keeps every existing unit expressible.

### 1.2 Cost is derived, never authored

The same discipline `tierOf` already enforces on cards (`deckRules.ts:31`, and the Lexicon's
note that it is "derived so a new card cannot be added *without* a tier"):

```ts
export function rosterPointsOf(def: CardDef): number {
  if (def.unit!.footprint === 2) return 6;          // Behemoth
  if (cardCostTotal(def.cost) >= 4) return 4;       // elite
  if ((def.unit!.rangeMax ?? 1) > 1) return 3;      // ranged
  return 2;                                          // basic melee
}
```

Derived so a minion cannot ship uncosted — which, on a point-buy system, would mean
shipping a free one. A vitest guard asserts every roster-eligible def resolves to one of
the four values, mirroring the existing `isObtainable` leak tests.

### 1.3 The sixteen, priced

The 33 minion definitions split three ways. Ten are `*_bound` Companion forms
(`companionUnits.ts`) and seven are `setupOnly` threats or wildlife; neither group was ever
draftable and neither becomes roster-eligible. The remaining **sixteen** are the roster:

| Points | Units |
|---|---|
| **2** — basic melee | `vanguard_footman` · `scout_imp` · `creeping_briar` · `concussive_blow` · `marrow_wisp` · `ash_ghoul` · `scrap_phalanx` |
| **3** — ranged | `longshot_stalker` · `cinder_lobber` · `scrap_metal_mortar` · `clockwork_bombardier` · `voltaic_hound` · `rimeguard` · `grave_sentinel` |
| **4** — elite | `slag_iron_golem` · `arc_turret` |
| **6** — Behemoth | `magma_brute` |

Ten points buys, for example: the footman, a scout, and two ranged specialists; or a
Behemoth and two basics; or an elite, a ranged, and a basic with a point spare. The budget
is deliberately not divisible into a comfortable answer.

> `vanguard_footman` currently carries `setupOnly` because the engine hands it out free at
> `setup.ts:407-412`. It loses that flag and becomes the universal 2-point basic — the
> thing every roster can afford, rather than the thing every player is given.

### 1.4 Unlocks — what a Companion is worth

A Companion currently brings three things into a fight: a Resonance school, the lane its
Resonance watches, and the cards that fill its Companion slots (`companions.ts:4-7`).
**It now brings a fourth: its bloodline's minions.**

```ts
// data/roster.ts
export const UNIVERSAL_ROSTER: CardDefId[] = ['vanguard_footman', 'scout_imp'];

export const MINIONS_BY_SPECIES: Record<string, CardDefId[]> = {
  ignis:   ['cinder_hellhound', 'cinder_lobber', 'magma_brute'],
  boreas:  ['rimeguard', /* … */],
  voltara: ['voltaic_hound', 'clockwork_bombardier', 'arc_turret'],
  mortis:  ['ash_ghoul', 'grave_sentinel', 'longshot_stalker'],
  sylva:   ['creeping_briar', /* … */],
  ferrum:  ['concussive_blow', 'slag_iron_golem', 'scrap_metal_mortar'],
  lexis:   ['scrap_phalanx', 'marrow_wisp'],
};
```

Taming **any instance** of a species stamps its list into `Profile.rosterUnlocks` — the
unlock is a fact about the bloodline, not about the animal, so releasing a beast never
takes the minions back. `tameCompanion` (`vivarium.ts:75`) is the one place this happens,
which makes the **Subjugation trial the delivery mechanism**: today a bound Apex grants a
`CompanionInstance` and nothing else (`run.ts:226`), and after this it also grants a
permanent widening of every future warband.

**The Cinder Hellhound** is the worked example of a unlock-only unit — a 2-point Ignis
pack beast, 3 ATK / 2 HP / 3 MOV, Haste, with `onHit: { status: 'burn', stacks: 1 }`.
Cheap, fast, dies to a stiff breeze, and brands whatever survives it. It exists to be
bought two at a time, which is the point of a roster the deck could never express: copy
limits are a card rule, and the Hellhound is not a card.

> **This closes the gate docs/03 identified.** `03_rpg_sandbox.md:506` records that
> "Companion unlocking is not gated. Every species is tameable; the roster filter is the
> seam where a gate would go." That seam is now load-bearing: taming grants combat
> capability, so the dev-button path in `VivariumScreen.ts:106-119` must be gated behind a
> build flag before this ships.

### 1.5 Where the roster lives

**In the profile**, beside the deck it replaces half of:

```ts
interface Profile {
  // …
  decks: Record<string, SavedDeck>;      // one per companion species — unchanged
  rosters: Record<string, string[]>;     // [new] one per companion species
  rosterUnlocks: string[];               // [new] def ids, stamped by taming
}
```

`rosterUnlocks` sits beside `collection` rather than inside it. A minion is no longer a
thing you own *copies* of — `Collection.owned` counts copies because copy limits are a deck
rule, and the roster's limit is points. Conflating them would ask "how many Hellhounds do
you own" when the only question is "may you field one."

**In combat**, as one record on `CommanderState`:

```ts
type RosterStatus = 'reserve' | 'fielded' | 'fallen';

interface RosterEntry {
  defId: CardDefId;
  status: RosterStatus;
  unitId?: UnitId;   // while fielded
  fellAt?: Coord;    // while fallen — this is the Soul Pyre (§4)
}
```

Deliberately **triple-duty**: it is the deployment tray in §2, the Graveyard in §4, and the
Soul Pyre registry in §4. Three UIs reading one array cannot disagree about whether a unit
is alive, and undo gets pyre-restoration for free because the pyre is state rather than an
event the renderer remembered.

The enemy's roster is `[]`, and so is a legacy encounter's. **An empty roster behaves
exactly as the game does today** — that is what keeps every existing test green through the
migration (§7).

### 1.6 Validation

`validateRoster` mirrors `validateDeck` (`deckRules.ts:99`) exactly — returns **all**
problems rather than the first, with machine-readable codes so the UI writes the sentences:

```ts
type RosterProblem =
  | { code: 'over_budget'; spent: number; budget: number }
  | { code: 'not_unlocked'; defId: CardDefId }
  | { code: 'too_many_behemoths' }
  | { code: 'empty_roster' }
  | { code: 'unknown_unit'; defId: CardDefId };
```

**Max one Behemoth per roster.** The 6-point cost nearly enforces it already; stating it
explicitly means a future budget rise does not silently legalise two.

### 1.7 What leaves the deck

`kind: 'minion'` cards become undeckable — `validateDeck` gains `minion_in_deck`. Two
existing deck rules go with them:

- `tierOf`'s `footprint === 2 → 3` branch (`deckRules.ts:31`) and `MAX_BEHEMOTHS = 2`
  become dead for decks and are **reborn as roster rules**.
- Tier copy limits `{1:3, 2:2, 3:1}` continue to govern spells, runes and obstacles
  unchanged.

`MIN_DECK` stays **12**. The roster is not deck thinning — it is deck *refocusing*, and a
lower floor would let a player bring four spells and a warband.

---

## 2. Pillar Two — Deployment and Anchor Tiles

**The grid has no static player half.** The environment spawns Anchor Tiles on the
player's side, and before turn 1 the player must deploy the Vanguard Roster onto them —
adapting the formation to the ground rather than to a rulebook.

### 2.1 What "neutral" means precisely

Today `territoryRows` (`state.ts:285`) is the source of truth for, in its own comment,
"deployment zones, melee portrait reach, threat display, and board tinting" — bottom two
rows yours, top two theirs.

**The ruling: `territoryRows` survives, renamed the *starting zone*, and loses exactly one
of its four jobs.** It stops being the summon gate. It keeps portrait melee reach, keeps
sudden-death Bound Form re-placement (`death.ts:205-243`), keeps the enemy's authored
placement, and is what the Blood & Bone Rally means by "the starting zone" (§4).

What the player sees changes completely: **the board tints anchors, not rows.** There is no
longer a coloured half of the grid to deploy anywhere within — there are five lit tiles,
and that is the whole of your freedom. The zone remains as engine plumbing that no rule
shows the player.

### 2.2 Anchor Tiles

```ts
interface GameState {
  // …
  anchors: Coord[];   // [new] the player's Anchor Tiles
}
```

**Plain coordinates, not entities and not hazards.** An anchor is not a thing on the tile;
it is a fact about the tile. That means it stacks freely with rubble, a current, cover, or
a Marrow Geode without a single interaction rule, and nothing can destroy, move, or
dispel one. Written once at setup, never mutated, never expiring — the "Anchor" Rally (§4)
reads them on turn nine as reliably as the deployment phase read them on turn zero.

**Generation.** Authored per encounter where the arena is hand-designed:

```ts
interface EncounterDef {
  anchorTiles?: Coord[];   // [new] authored anchors
}
```

Absent that, generated from the seeded RNG within the player's starting zone:

- count = `min(5, free tiles in zone)`
- guaranteed to include **one horizontally adjacent pair**, so a footprint-2 Behemoth is
  always deployable — a roster that spent 6 points on a body it cannot place is a
  point-buy system betraying the player at the last possible moment
- never on terrain, never on a tile a Geode will take

Generation runs at a **fixed point in the setup order** — immediately after terrain
(`setup.ts:381-397`), before `scatterGeodes` (`setup.ts:480`) — because the seeded stream is
positional. Moving the call moves every geode in every replay.

**Biome is the design lever.** A ruin gives four anchors in a broken line; a glacial field
gives five spread wide; a narrow corridor gives three stacked in a column and no adjacent
pair at all — which is that biome telling you, before you accept the contract, to leave the
Behemoth at home.

### 2.3 The deployment phase

```
deployment → startOfTurn → action → resolution → endOfTurn → (flip) → …
```

A new `Phase` member. `createCombat` ends in `phase: 'deployment', activeSide: 'player'`
**when the roster is non-empty**, and calls `beginTurn(ctx, 'player')` exactly as it does
today (`setup.ts:464`) when it is not.

Two new commands:

```ts
| { type: 'deployUnit'; defId: CardDefId; at: Coord }
| { type: 'finishDeployment' }
```

with a refusal exported for the UI, in the shape `channelRefusal` established
(`engine.ts:381`):

```ts
type DeployRefusal =
  | 'not-deploying'      // wrong phase
  | 'not-in-reserve'     // already fielded, or not on this roster
  | 'not-an-anchor'
  | 'occupied'
  | 'no-room'            // Behemoth's second cell blocked
  | null;
```

**Deployment is free and reversible until `finishDeployment`.** A player may place, pick
back up, and rearrange without cost — there is no resource to refund and no information to
leak, so a confirm step is the only sensible gate. `finishDeployment` calls
`beginTurn(ctx, 'player')` and the fight starts.

Units enter through `placeOpeningUnit` (`spawn.ts:80-95`) rather than `summonUnit`, which
means `freshlySummoned` is already false and **the Vanguard acts on turn 1**. That is the
entire point of the pillar: no summoning sickness, because nothing was summoned.

New events `unitDeployed` (carrying the unit snapshot) and `deploymentEnded`.

**Behemoth placement:** anchors on an anchor tile; its second cell need only be *free*, not
itself an anchor. Requiring two anchors would make the guaranteed adjacent pair the only
legal Behemoth placement on every map.

### 2.4 The enemy does not deploy

**Ruling: no enemy anchors, no enemy roster, no enemy deployment phase.**

The enemy is authored content. `enemyOpeningBoard: [defId, x, y][]`
(`encounters/registry.ts:36`) already lets a designer place exactly the fight they mean,
which is strictly more expressive than a point-buy the AI would have to spend. Symmetry
here would buy nothing and cost an AI deployment phase, enemy roster data, enemy unlock
tables, and a counterplay vocabulary for enemy revival.

The free enemy `vanguard_footman` is **removed along with the player's** — a designer who
wants a footman writes one into the board. Encounters whose authored board relied on the
freebie get it added explicitly, which is a content edit, not an engine one.

### 2.5 Where the player sees it first

`PreCombatScreen` (`PreCombatScreen.ts:73`) already sits between accepting a bounty and
starting combat, already previews the arena with its dimensions, weather, and a tinted map,
and already runs a 5-swap deck adaptation budget. It gains a **roster review step**: the
same map, with the actual anchor tiles lit.

That requires anchors to be computable outside combat, so generation is exposed as a pure
`previewAnchors(encounter, seed)` beside `validateEncounter`. The real placement still
happens in-combat through `deployUnit`, because the reducer is the only authority on where
a unit may stand.

**The roster is not swappable at PreCombat.** The deck is the adaptation layer — five swaps
after seeing the arena, exactly as today. The roster is a dungeon-level commitment, and
being able to rewrite it per fight would make the point-buy a per-encounter puzzle rather
than a build.

---

## 3. Pillar Three — Blood Magic and the Marrow Economy

**Minions are no longer killed for resources.** To generate Marrow, the player targets
their own Vanguard, deals it a set amount of damage, and applies Exhaustion — ripping the
Marrow out of a body that then stands there, wounded and useless, for the rest of the turn.

### 3.1 Why sacrifice cannot survive the roster

`sacrifice` (`engine.ts:406-434`) trades a whole unit for `sacrificeValue` Marrow — 1 or 2,
occasionally 3. That is a reasonable trade when the unit came from a 1-Pip card you have
two more copies of. It is an absurd one when the unit came from a roster slot you committed
to before the dungeon and cannot replace until you leave it.

Blood Magic keeps the fantasy — your own bodies are the fuel — and changes the price from
*the body* to *the body's blood and its turn*.

### 3.2 The command

```ts
| { type: 'bloodTithe'; unit: UnitId }

TITHE_DAMAGE = 3      // dtype 'true'
TITHE_MARROW = 2
```

Resolution order, and it matters: **Marrow is credited first, then the damage lands, then
Exhaustion applies.** A tithe that kills the unit still pays — you took the blood, and the
body failing afterward does not un-take it.

Damage routes through `dealDamage` like everything else, so armour, statuses, runes, and
the encounter Damage Gate all behave normally. It is `true` damage specifically so plate
does not make a unit un-bleedable: `true` "ignores armor entirely"
(`02_combat_lexicon.md` §7), and a Bulwark roster that cannot use Blood Magic would be a
school locked out of an economy.

```ts
type BloodTitheRefusal =
  | 'not-your-unit'
  | 'not-a-vanguard'    // Bound Forms, Ferals, spell-summons
  | 'exhausted'
  | 'already-attacked'
  | null;
```

**"Would die" is not a refusal.** See §6.2 — the ruling is that Blood Magic may kill, and
the UI warns rather than forbids.

**No per-turn commander cap.** Exhaustion caps each unit at one tithe per turn, and the
real cap is that the roster is bleeding. A player who tithes their whole warband on turn
two has bought a big spell with a board of exhausted, wounded bodies facing a full enemy
turn — the punishment is already in the position.

### 3.3 Exhaustion

**[proposal] A new `StatusKind: 'exhaust'`** — cannot move, attack, or channel; applied at
one stack; decays in the ordinary status tick at the start of the owner's turn.

Deliberately **not** `stun`. `stun` is typed, gated in `canAct`, decayed, threat-modelled,
HUD-iconned, and applied by nothing in the entire codebase — doc 04 named it the largest
status gap in the game. Reusing it here would spend the game's one reserved control status
on a self-inflicted cost. `stun` stays reserved for enemy control and for the `overload`
Climax trait (§5); `exhaust` is what you do to yourself.

New event `unitTithed { unitId, side, marrow, damage }`.

### 3.4 What this does to the sacrifice content

| Thing | Ruling |
|---|---|
| `sacrifice` command | Retired. |
| `sacrificeTarget` card op | Retired, replaced by `{ op: 'tithe'; damage; marrow }`. |
| `Sacrifice` keyword | Deleted from the union. It was glossary text that gated nothing (`02_combat_lexicon.md` §5). |
| `UnitStatBlock.sacrificeValue` | Becomes optional `titheBonus?: number` — extra Marrow this body yields when tithed. |
| `marrow_wisp`, `ash_ghoul` | Keep their bred-to-bleed identity as 2-point roster units with `titheBonus: 1`. |
| `dark_tithe`, `harvest_the_weak`, `cull_the_weak` | Re-templated onto `op: 'tithe'` at **above-command rates** — they cost a card *and* Pips, so the free command is the floor they beat. `cull_the_weak` becomes the big drain: 4 damage, 4 Marrow. |
| `grantArmor {from:'sacrificedHp'}`, `extractMarrow {from:'sacrificedHp'}` | Become `{from:'titheDamage'}` — damage actually dealt. |
| `bonusSacrificeMarrow` (relic boon, `CombatBoons`, `CommanderState`) | Renamed `bonusTitheMarrow`; semantics transfer intact. |
| `healOnSacrifice` | Renamed `healOnTithe`. Mortis's identity survives unchanged. |
| `channel` (`CHANNEL_MARROW = 1`) | **Kept exactly as-is.** It is the damage-free trickle — give up a swing, take 1. Blood Magic is the burst. Two verbs, two prices, no overlap. |

### 3.5 What Marrow is now worth

Marrow stays volatile — zeroed at `deck.ts:178`, use it or lose it. But its sources
re-rank sharply, and that is the intended tension:

| Source | After the overhaul |
|---|---|
| **Blood Magic** | The reliable one, and it hurts. |
| Marrow Geodes | Now much more load-bearing: Marrow that costs you nothing but the trip to break one. |
| `gilded_scavenger` bounty | Same — free Marrow, if you can catch it. |
| Overdraw burn | Kept. A pressure valve unrelated to bodies. |
| Channel | Kept. The patient option. |

A player who wants a Marrow-costed spell now asks: do I bleed the Vanguard, or do I spend
two turns walking to a geode? That question did not exist when a 1-Pip body could be fed
into the grinder on arrival.

---

## 4. Pillar Four — Soul Pyres, the Graveyard, and Revival

**When a Vanguard dies it leaves a Soul Pyre on its tile.** Dead minions go to a Graveyard.
Bringing them back requires drafting specific Arcane/Neutral cards into the spell deck.

### 4.1 Soul Pyres are memory, not matter

**Ruling: a Soul Pyre is a roster record, not a board object.**

`killEntity` (`death.ts:25-78`) is the single place a unit leaves the board. It gains one
step: if the dead unit matches a `RosterEntry`, set `status: 'fallen'`, `fellAt: {…at}`,
and emit `pyreLit { unitId, defId, at }`.

That is the whole implementation, and it buys the following by construction:

- Pyres **never block movement**, never occupy a tile, never interact with hazards or
  terrain, and stack freely with anything.
- Pyres **cannot be attacked, destroyed, or dispelled**. There is no HP, no entity, no
  target.
- Pyres **never expire** within a fight.
- Undo restores a pyre for free, because the pyre is state rather than a thing the renderer
  remembers.

The only interaction an enemy has with a pyre is **standing on it**, which denies Aetheric
Resurgence (§4.3) for exactly as long as they stand there. That is real counterplay, and it
costs the enemy a body's positioning to exert.

Enemy units, spell-summons, Ferals, and Bound Forms leave no pyre — none of them is a
roster entry.

**The Graveyard UI is the `'fallen'` list.** No second data structure.

### 4.2 X-costs — new machinery

Aetheric Resurgence is the game's first variable-cost card.

```ts
interface CardDef {
  xCost?: { max: number };   // [new]
}

| { type: 'playCard'; …; x?: number }   // [new] optional
```

`spendResources` charges `cost.pips + x`. **X must be at least 1** — a 0-Pip revive would
make every death a 20%-HP inconvenience and hollow out the Graveyard entirely. `x > max` is
refused.

**[proposal]** The AI always plays the maximum affordable X. A scorer that reasons about
partial revives is a research project; "spend everything on the body" is correct often
enough and never absurd.

### 4.3 The three cards

A new `ChosenTarget` variant carries the pick — the one honest widening of the targeting
contract:

```ts
| { kind: 'fallen'; rosterIndex: number; at?: Coord }
```

and one new op:

```ts
| { op: 'revive';
    site: 'pyre' | 'anchor' | 'startingZone';
    hp: { mode: 'perPipPercent'; percent: 20 }
      | { mode: 'percent'; percent: 50 }
      | { mode: 'fixed'; amount: 1 };
    riders?: { fleet?: number; armorFromMissingHp?: true } }
```

| Card | Cost | Where it lands | Comes back with |
|---|---|---|---|
| **Aetheric Resurgence** | X Pips, up to 5 | its **exact Soul Pyre** — refused if occupied by an enemy | **20% of Max HP per Pip spent**; stripped of all runes and buffs |
| **The "Anchor" Rally** | 3 Pips (flat) | any starting **Anchor Tile** | **50% HP** and **+1 MOV** for the turn |
| **The "Blood & Bone" Rally** | **0 Pips + 3 Marrow** | anywhere in the **starting zone** | **1 HP**, and **Persistent Armor equal to its missing Health** |

Each has a distinct job. Resurgence is the *expensive, correct* answer — full price at X=5
returns a whole body exactly where it fell, which is often the tile you needed held.
The Anchor Rally is the **safe defensive retreat**: cheap, flat, predictable, and it pulls
the unit all the way home with the movement to start walking back. Blood & Bone is the
**pillar-three payoff loop**: tithe a healthy Vanguard for the Marrow, spend it raising a
dead one as a near-unkillable armour wall. Zero Pips, and the whole cost paid in blood.

> **Blood & Bone's armour is enormous on purpose.** A 12-HP Behemoth returns at 1 HP with
> **11 Persistent Armor** — it will not die to chip damage, and it will die instantly to
> anything dealing `true` damage, which ignores armour entirely (`02_combat_lexicon.md` §7).
> The counterplay is already in the game.

### 4.4 "Stripped of all runes and buffs"

**Ruling: revival constructs a fresh unit from the definition and copies nothing.**

Runes, statuses, Escalate stacks, aura stacks (§5), and accumulated armour are gone by
construction rather than by five removal rules. Then HP is overridden per the card, the
roster entry flips back to `'fielded'`, `fellAt` clears, and `unitRevived` fires.

This is why the ruling applies to all three cards even though only Resurgence's text says
it. One rule that falls out of the implementation is worth more than three rules that
agree.

A revived unit **may act** (the `placeOpeningUnit` flag treatment). It came back to do
something. The Anchor Rally's "+1 MOV for the turn" is **[proposal]** a new one-stack
decaying status `'fleet'`, read additively by the movement layer — the same shape as every
other temporary modifier in the game.

### 4.5 Death across a dungeon

**Ruling: the roster redeploys every fight at full HP, but deaths persist for the dungeon.**

A Vanguard that ends a fight fallen is still fallen at the start of the next one — it stays
in the Graveyard and off the deployment tray. Between dungeons, the roster fully resets.

This gives the three cards genuinely different scopes, which is what makes drafting them a
decision:

- **Aetheric Resurgence is same-fight only.** A pyre is a coordinate on *this* board.
- **The two Rallies work on carried deaths** — an anchor and the starting zone both exist
  in the next fight. Drafting a Rally is a run-level insurance policy; drafting Resurgence
  is a tactical one.

It also matches the sandbox's existing philosophy exactly: `03_rpg_sandbox.md` §1 records
that a knockout costs "money and time, never possessions," and that the Pact deliberately
wakes at 1 HP because "waking at full health would make dying a free ride home." A roster
that healed itself between fights would be that free ride.

---

## 5. Pillar Five — The Rule of 3

**Escalate is no longer a passive unit trait.** On persistent units it would scale forever.
It becomes an elemental Aura cast on a Vanguard, capped hard at three stacks, with a
dangerous trait at the cap and a detonation to cash it in.

### 5.1 The problem is real and already in the code

```ts
// spawn.ts:56-57
// 1x1 units cap at +3 growth; Behemoths are uncapped (Module 2).
escalationCap: stats.footprint === 2 ? Infinity : 3,
```

A Behemoth's growth is **literally uncapped**. Today that is survivable because a Behemoth
costs 4 Pips, dies, and cannot be re-summoned cheaply. Under a roster that deploys the same
Behemoth every fight and revives it when it falls, `Infinity` is the whole game by turn
twelve.

> **This also fixes a live bug.** `Infinity` is stored in serialised `Unit` state and
> becomes `null` through `JSON.stringify` — the exact corruption the codebase bans
> elsewhere. The finite cap kills it.

### 5.2 The split

**The keyword leaves the player's units. The machinery stays for the enemy.**

`Escalate` is removed from all sixteen roster minions, and their `escalationBonus` stat
fields with it. The `escalate()` hook (`status.ts:114-140`), `Unit.escalation`, and
`escalationCap` survive under an **enemy-only keyword `Growth`** — `scrap_titan`'s clock is
the pressure that makes a long fight dangerous, and it should keep ticking. Its cap becomes
**99** rather than `Infinity`.

### 5.3 The Aura

Auras mirror the rune system deliberately — same slot discipline, same attach-op shape,
same data-not-closures rule:

```ts
// data/auras.ts
interface AuraDef {
  id: AuraDefId;
  name: string;
  school: School;
  perStack: { atk?: number; maxHp?: number; mov?: number; onHit?: OnHitRider };
  climaxTrait: ClimaxTraitId;
  text: string;
}
```

```ts
interface Unit {
  aura?: { defId: AuraDefId; stacks: number };   // [new] one slot, like `rune`
}
```

**One aura per unit.** Casting a second replaces the first and refunds nothing — the same
rule runes already keep, for the same reason: a unit wearing three auras is a spreadsheet.

New op `{ op: 'attachAura'; aura: AuraDefId }`, targeting an allied unit, refused on Bound
Forms (§6.4).

### 5.4 Stacks 1 and 2 — growth

Stacking runs in the **exact slot `escalate()` occupies today** — step 5 of
`startOfTurnStatuses`, at the start of your own turn, for units that survived the enemy
round. The `freshlySummoned` gate is reused verbatim: an aura cast this turn does not stack
this turn.

| School | Per stack | Climax trait |
|---|---|---|
| **pyre** | **+1 ATK** | `overload` |
| **bloom** | **+2 Max HP** | `heavyFootprint` |
| frost **[proposal]** | +1 Max HP, +1 armour | `rimeShell` |
| surge **[proposal]** | `onHit: charged 1` | `chainArc` |
| bulwark **[proposal]** | +2 Max HP | `immovable` |
| dusk **[proposal]** | +1 ATK | `soulLeech` |
| arcane **[proposal]** | +1 MOV | `blink` |

Stats apply incrementally as `escalationBonus` does now, so a snapshot is always the truth.
Events: `auraAttached`, `auraStacked`.

### 5.5 Stack 3 — Climax, the hard cap

At three stacks **growth stops entirely** and the aura reaches Climax, unlocking its trait.
`auraClimaxed` fires with a full stat snapshot.

Climax traits are a small enumerated union of ids interpreted at named engine seams — the
data-not-closures rule holds, so the AI can read that a unit is climaxed and what that
implies without executing anything:

| Trait | Effect | Why it is dangerous |
|---|---|---|
| `heavyFootprint` | The unit leaves `rubble` in its wake (`trail: 'rubble'`) | Rubble is **permanent** and costs 2 MOV to cross. Your own board slowly becomes ground your own units struggle through. |
| `overload` | When the host is hit, everything in `adjacent8` gains `charged` | Charges your own units as readily as theirs, priming Overload and Superconduct on both sides. |
| `rimeShell` | Host gains armour each turn, but its MOV drops to 0 | A wall that cannot be repositioned. |
| `soulLeech` | Host drains 1 HP from the nearest enemy each turn, and 1 from the Pact if none is in reach | It has to feed on something. |

The Rule of 3 is therefore not merely a ceiling — it is a **timer**. The aura stops paying
and starts costing, and the answer to that is to cash it in.

### 5.6 Detonation — the cash-in

```ts
| { op: 'detonateAura' }
```

with a targeting filter `requiresAura: 'climax'` — a Detonation card can only be pointed at
a 3-stack aura, which the AI's enumeration reads for free.

The op removes the aura, and then **the rest of the card's ordinary op tree fires**. No new
blast machinery: the burst is authored as normal `damage`, `heal`, or `extractMarrow` ops
centred on the host, which means a Detonation is balanced with the same vocabulary as every
other spell in the game.

Three cards at launch, 0–1 Pips, one per starting school:

| Card | Cost | Effect |
|---|---|---|
| **Pyre Detonation** — *Cataclysm* | 1 Pip | Heavy fire damage in `adjacent8` around the host. The host survives at 1 HP. |
| **Bloom Detonation** — *Verdant Collapse* | 1 Pip | Massive heal to the Pact, scaled off the host's Max HP. |
| **Dusk Detonation** — *Marrow Burst* | **0 Pips** | Large Marrow generation. Free to cast, and the aura took three turns to grow. |

Event `auraDetonated`. The loop the pillar creates: cast an aura, grow it two turns, hold a
climaxed unit that is now a liability, and choose the turn you spend it.

---

## 6. Ripple-Effect Inventory

Everything the five pillars break or orphan, with one ruling each.

| # | Affected | Ruling |
|---|---|---|
| 6.1 | **The 33 minion defs** | Three fates. The 10 `*_bound` Companion forms: untouched. The 7 `setupOnly` threats and wildlife: untouched — never deck cards. The 16 draftable: gain `rosterPoints`, lose deckability, keep `kind: 'minion'` and their full `CardDef` (the summon path is reused by deployment and by spell-summons). **No definition is deleted.** |
| 6.2 | **Can Blood Magic kill?** | **Yes.** `TITHE_DAMAGE` is real damage through `dealDamage`; a 2-HP unit dies, the Marrow is still paid, and a pyre lights. Clamping at 1 HP would need a special-case damage path and would sever the deliberate bridge to Blood & Bone. The UI shows a lethal warning; the refusal list does not include it. |
| 6.3 | **Starter deck (15, incl. 5 minions)** | Minions out, backfilled to 13 with Aetheric Resurgence ×1, the Pyre aura ×1, and Cataclysm ×1. `MIN_DECK` stays 12. |
| 6.4 | **Bound Forms** | One sentence, four refusals: *the Bound Form is the Pact, and the Pact is not a Vanguard.* It cannot be deployed (it is auto-placed), tithed (extends the existing sacrifice block at `engine.ts:416`), revived (it leaves no pyre; sudden death already restores it), or enchanted with an aura (extends the existing belt-and-braces at `status.ts:118`). |
| 6.5 | **Companion species decks** | Rebuilt without minions; the vacated slots become that school's aura and Detonation, which keeps each species' identity readable. Those minions move to `MINIONS_BY_SPECIES`. |
| 6.6 | **`enemyOpeningBoard`** | Unchanged. |
| 6.7 | **Free `vanguard_footman`** (`setup.ts:407-412`) | Removed for both sides; the `EncounterDef.vanguard` field is retired. The footman becomes the universal 2-point roster basic. Authored boards that relied on the freebie get it written in. |
| 6.8 | **Sudden death** (`death.ts:205-243`) | The wipe routes fielded roster units through pyre marking, recording pre-wipe positions. Sudden death becomes revival's showcase: both commanders at 1 HP, and the player holding a Rally is the intended drama. Bound Form re-placement unchanged. |
| 6.9 | **Subjugation** | Mechanically untouched, and worth strictly more: `'bound'` now also stamps `rosterUnlocks`. |
| 6.10 | **Tier / copy / Behemoth deck rules** | `tierOf`'s footprint branch and `MAX_BEHEMOTHS` leave `validateDeck` and are reborn as roster rules. Tier copy limits `{1:3, 2:2, 3:1}` continue governing spells, runes and obstacles unchanged. |
| 6.11 | **AI enumeration and scoring** | `sacrificeCandidates` → `titheCandidates` (own roster unit, unexhausted, un-attacked); the existing "only if it unlocks a purchase" gate (`enumerate.ts:87-118`) transfers verbatim, and now also weighs whether the unit would die — allowed, but scored negatively unless the purchase is lethal-swingy. `channel` unchanged. Aura, Detonation and revival plays fall out of data-driven targeting; the only new enumerator work is the `fallen` cross-product and picking X. **No deployment AI is needed** (§2.4). |
| 6.12 | **Overdraw burn, Geodes, bounties** | All kept, all more load-bearing — see §3.5. |
| 6.13 | **Minion ownership in `Collection`** | Minions leave the collection; they are unlocks, not copies (§1.5). **Ascension still applies** — `collection.ascended` on a minion base id means the roster deploys its Rank 2 stat block. Splice recipes producing minions are re-pointed at spell outputs. |
| 6.14 | **PreCombat 5-swap budget** | Unchanged for spells. Roster review is an added step, not a swap consumer, and the roster itself is not swappable (§2.5). |
| 6.15 | **Feral / wildlife** | Untouched. Sideless, `setupOnly`, no roster interaction, no pyres. |
| 6.16 | **Pacifist lockout** (`turn.ts:149`) | Unchanged — a player whose roster is entirely fallen still casts spells, and if they truly cannot engage, the lockout is doing its job. One addition: the deployment phase must not count as a stalled round. |
| 6.17 | **`escalationBonus` fields** | Stripped from the 16 converted minions; retained on `Growth` defs. `Unit.escalation` / `escalationCap` stay (the enemy uses them); cap `Infinity` → 99. |
| 6.18 | **Session, undo, replay** | Unmodified. `deployUnit`, `finishDeployment` and `bloodTithe` are ordinary commands through the one reducer, so replay-from-seed works by construction, and the roster living in `GameState` means undo un-kills a pyre for free. |
| 6.19 | **`03_rpg_sandbox.md` dead fields** | `CompanionProgress.startingArmor` and `.bonusPips` are still granted by nothing. Unrelated to this overhaul, but the roster work touches the same profile shape — worth clearing in the same pass. |
| 6.20 | **The dev tame buttons** (`VivariumScreen.ts:106-119`) | Must be gated behind a build flag before this ships. They now grant combat capability, not just a portrait (§1.4). |
| 6.21 | **Doc 02 and 03** | Both need a pass after each phase lands. The Lexicon's §5 Escalation section and §6 deck rules become wrong the moment pillars 5 and 1 ship. |

---

## 7. Migration Order

Four phases. **Each one is a shippable, playable game** — no phase leaves the build in a
state where the previous rules are gone and the new ones are not there yet.

### Phase 1 — Blood Magic

Smallest blast radius, and entirely engine-local. The `bloodTithe` command and its refusal,
the `exhaust` status, the `tithe` op; retire `sacrifice`, `sacrificeTarget`, and the
`Sacrifice` keyword; rename the two commander fields; re-template three spells; retarget the
AI's sacrifice enumeration.

**Interim state:** minions are still deck cards summoned into territory. They simply get
tithed instead of sacrificed. Ships alone as a playable balance change.

### Phase 2 — Auras and the `Growth` split

Aura data, the unit slot, the attach/stack/climax/detonate ops and their events; strip
`Escalate` from player minions; introduce `Growth` for threats; cap 99.

Independent of phases 3 and 4 — auras attach perfectly well to deck-summoned minions.

**Sequencing note:** put the aura and Detonation cards into companion decks in the slots the
minions will vacate in Phase 3, so the deck lists are edited once rather than twice.

### Phase 3 — Roster and Deployment (inseparable)

Removing minions from decks without a deployment path is an unplayable interim, so pillars
1 and 2 land together, sequenced internally:

- **3a — data, all inert.** `rosterPoints` on every eligible def, `data/roster.ts`, the
  unlock tables, the profile fields, the roster builder UI. Nothing reads it yet.
- **3b — engine.** `roster` on `CommanderState`, `anchors` on `GameState`, the
  `'deployment'` phase, `deployUnit` / `finishDeployment`, removal of the free footman, the
  `minion_in_deck` deck rule, the starter and species deck rebuilds, the PreCombat step.

**The empty-roster path is what keeps this safe.** Through all of 3a and into 3b, a fight
with `roster: []` behaves exactly as it does today, so every existing test and every legacy
encounter stays green until the content is deliberately switched over.

### Phase 4 — Revival

Depends on all three: roster identity and anchors from Phase 3, Marrow costs from Phase 1,
stripped-aura semantics from Phase 2. Pyre marking in `killEntity`, X-costs, the `fallen`
target, the `revive` op, the three cards, sudden-death integration, and the
dungeon-persistent Graveyard in the overworld carry.

---

## 8. Open Questions for the Game Director

Everything above is a ruling. These are the genuine judgment calls left:

1. **Anchor counts per biome.** §2.2 proposes `min(5, free)` with a guaranteed adjacent
   pair. Should a cramped biome be allowed to offer *fewer anchors than the roster has
   units*, forcing a deploy-time cut? That is a strong, hostile design lever, and it should
   be a deliberate choice rather than a side effect of a small arena.
2. **The five unspecified aura schools.** §5.4 fixes pyre (+1 ATK) and bloom (+2 Max HP) per
   the directive; the other five are proposals.
3. **The Climax trait roster.** Four are sketched in §5.5. `heavyFootprint` and `overload`
   are named in the directive; the rest need a pass, and the set should probably be small —
   one genuinely dangerous trait per school beats seven mild ones.
4. **Scripted enemy revival.** §2.4 rules out enemy rosters, but a boss script could still
   raise its own dead as an authored encounter effect. Worth it, or does that muddy the
   player's exclusive claim on the mechanic?
5. **Whether the roster resets between dungeons or between *contracts*.** §4.5 says
   dungeons. If a contract chain is long, that may be too punishing — or exactly the point.
