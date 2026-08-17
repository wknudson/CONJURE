# CONJURE — Combat Feel & Presentation Plan

*Written 2026-08-17, after Phases A–D. The overworld is deferred; this is about making
the fight itself worth playing twice.*

---

## The honest diagnosis

The combat **rules** are deep: collisions, line of sight, rune cascades, three elemental
reactions, 2×2 Behemoths, Escalation, two AI tiers. The combat **experience** does not yet
use that depth, for three reasons:

1. **You play blind.** You act, then the enemy acts, and you find out what happened. The
   danger zone shows what *could* be hit, which on a small board is nearly everything —
   so the honest answer to "am I safe here?" is usually "no", which is the same as no
   information. Every loss feels like something that happened *to* you.

2. **A turn is a checklist, not a decision.** Play affordable cards, move each unit
   forward, attack if something is in reach, end turn. There is rarely a moment where two
   options are both good and you have to choose.

3. **Nothing lands.** A rune cascade that wipes three units and a plain 2-damage poke get
   nearly the same presentation. The systems with the most design behind them are the
   least celebrated on screen.

Fixing (1) is worth more than everything else combined, and it also happens to make the
HUD work and the rotation work more valuable — so it goes first.

---

## E1 — Enemy intent: the centrepiece (~1 week)

**The change.** At the end of its turn, the enemy *commits* to what each of its units will
do next turn, and that commitment is drawn on the board. Your turn is then spent playing
against a known threat rather than guessing at a probability.

This is Into the Breach's core mechanic, and its designers are explicit that without it
"it would be impossible for the players to make the decisions the game is built around."
It is also the thing that turns every existing system into a tool:

| System | What it does today | What it does with intent shown |
| :-- | :-- | :-- |
| Shield Bash / collisions | Chip damage and a shove | *Move the attacker off its firing line* |
| Stone Barricade / Ice Barricade | Blocks a lane | *Body-block a declared attack* |
| Guardian | Blocks ranged sight | *Invalidate a declared shot* |
| Freeze / Entangle | Skips a turn | *Cancel a specific declared attack* |
| The danger zone | "Most tiles are risky" | *These four tiles, this much damage, from that unit* |

Every one of those becomes a puzzle answer instead of a stat.

### How it works

- Each enemy unit that intends to act declares an **Intent**: a kind (attack / move+attack
  / summon), a target tile, and the damage it will deal.
- Intents render as a coloured arrow from the unit to the tile, with the number on it.
- On the enemy turn, intents **execute in declaration order**.
- An intent whose premise is gone still fires at the *tile*. Move the target away and the
  attack whiffs into empty ground. That is what makes displacement and blocking matter.
- Killing or hard-disabling (Freeze, Stun) the unit cancels its intent entirely.

### Decided: declare by difficulty

**Novice telegraphs everything** — attacks, moves and summons. It is the teaching tier, and
total clarity is what teaches.

**Adept telegraphs attacks only**, keeping its cards and summons hidden. Difficulty then
scales along *information* as well as skill, which is a cleaner distinction than "the same
opponent, but sharper".

Cost to be aware of: two telegraphing modes doubles the tuning and testing surface, and the
threat display must handle a partially-known turn without implying it is complete. The HUD
should show explicitly that Adept has undeclared cards in hand.

> **Status: not scheduled.** E1 is deferred; the current pass is E4 (rotation) and E3 (HUD)
> only. This section records the decision so it does not have to be relitigated later.

### Implementation sketch

New in the core (`src/core/engine/intents.ts`):

```ts
export interface Intent {
  unitId: UnitId;
  kind: 'attack' | 'moveAttack' | 'summon';
  /** Where the blow lands, whether or not anything is still standing there. */
  at: Coord;
  /** Movement committed to before the strike, for the arrow's path. */
  path?: Coord[];
  damage: number;
  /** Cleared when the unit dies or is disabled. */
  cancelled?: boolean;
}
```

- `GameState.intents: Intent[]`, cleared and re-declared at the end of each enemy turn.
- The AI already produces a full command list from `planTurn`; declaring is *reading that
  plan* rather than new search — cheap, and it reuses the tier system so Adept telegraphs
  smarter intents than Novice.
- Execution replays the declared commands, skipping any whose unit is dead or disabled and
  re-resolving the target from the tile rather than the entity.

### Edge cases

- **The declared target moved.** The attack resolves on the tile: it hits whatever is
  standing there *now*, including one of the enemy's own units. That is the reward for
  clever play and it must be allowed.
- **The declaring unit was displaced.** Its intent should either follow (it re-paths) or
  cancel. Recommend: cancel if it can no longer reach, so shoving an archer out of position
  is a real answer.
- **A summon intent's tile is occupied** by the player's turn. Crush per Module 5's
  failsafe, or cancel — pick one and test it.
- **Boss phase transitions** mid-turn invalidate every intent; re-declare after the shift.
- **The danger zone overlay** must become "declared damage per tile", not "reachable".
  Both can exist: declared in solid red, potential in a faint outline behind it.
- **Determinism.** Declaring must not consume RNG from the shared stream, or the replay
  harness breaks. Declare on a clone.
- **Novice tier** should telegraph *honestly but badly* — its intents are as flawed as its
  play, which is exactly what makes it the easy tier.

---

## E2 — Turn flow (~2 days, do alongside E1)

Small frictions, each cheap, that together decide whether a turn feels smooth.

1. **Undo a move.** Movement before an attack is committed should be reversible; the engine
   is a pure reducer over cloned state, so undo is keeping the previous `GameState` on a
   stack, not writing an inverse operation. Attacks and card plays stay final.
2. **Cycle units with Tab.** Jumps to the next unit with an action remaining and centres it.
3. **Smart End Turn.** The button reads "End Turn (2 units can still act)" and asks for a
   second click when actions are unspent. Removes the most common self-inflicted loss.
4. **Hover a card to see its preview** without clicking. The preview pipeline already
   exists; this just wires hover to it.
5. **A visible "acted" state.** Spent units already dim; add a small tick so it reads as
   *done* rather than *disabled*.

---

## E3 — HUD refinement (~3 days)

Do this *after* E1, because intent changes what the HUD must communicate.

**Problems today:** the resource dial is a simplified stand-in for the docs' Dual-Ring
design; there is no read on the enemy's resources; status effects live only as small chips
on the board; and there is no single place that answers "what should I be worried about".

**Planned:**

1. **Threat panel.** A compact list of declared intents: which unit, how much, where. This
   is the HUD's new centre of gravity, and it is what E1 makes possible.
2. **Proper Dual-Ring dial** per Module 6 — metallic sockets for banked Pips, ephemeral
   beads for Sparks that visibly burn away at end of turn.
3. **Enemy read.** Hand count and banked Pips, so a Cataclysmic Core turn is foreseeable
   rather than a surprise.
4. **Selected-unit panel.** Stats, keywords, statuses and remaining actions in one place,
   rather than only in a hover tooltip.
5. **Pact gauge with segments.** 40 HP as eight readable segments, so "two hits from death"
   is legible at a glance instead of arithmetic.

---

## E4 — Camera rotation (~1 day, explicitly requested)

The seam is already there and clean: `rot()`/`unrot()` exist in `IsoCamera` and nothing
else in the codebase reads `rotationStep`. Every orientation assumption (`forward`,
`homeRows`, push directions) lives in the logic core, which rotation never touches — the
board is rotated for the *viewer*, not for the rules.

**Work:** bind `Q`/`E` to 90° steps and Space to snap home; animate the transition rather
than snapping; re-fit the camera per step, since a 6×8 board has a different screen
footprint rotated 90°.

**The one real snag.** Commander models sit at fractional coordinates *outside* the grid
(`y = height + 0.35`, `y = -1.35`). The rotation remap assumes in-range coordinates, so
they will land in the wrong place. Fix by rotating them about the board centre as a
special case rather than through the tile remap.

**Also verify under each step:** tile picking round-trips; depth sorting still orders 2×2
Behemoths correctly; the Runic Boundary and territory tints follow; world-anchored DOM
floaters (damage numbers, CRASH badges) track. A rotation test that round-trips every tile
at all four steps is the cheap guard.

---

## E5 — Making things land (~2 days)

The systems with the most design behind them currently get the least presentation.

1. **Cascade crescendo.** Each detonation in a chain hits harder than the last: rising
   pitch, growing shake, and a counter — "CASCADE ×3". Right now a three-rune chain looks
   like three separate pops.
2. **Kill emphasis.** A brief hit-stop on a kill, longer for a Behemoth. Tactics games live
   on the moment a unit comes off the board.
3. **Reaction identity.** Vaporize, Shatter and Wildfire currently share one flash. Each
   should look like itself — steam bloom, ice shards, a green-to-orange bloom.
4. **Escalation made visible.** A unit that has grown three times should *look* grown.
5. **Last Stand.** The rule exists and is dramatic; nothing on screen says so. Music cut,
   desaturation, heartbeat — the docs already specify it.

---

## Current scope

**This pass: E4 (rotation) and E3 (HUD).** ✅ Done 2026-08-17.

Shipped: 90° board rotation on Q/E and buttons, with an animated spin and an extent-based
camera fit; an enemy read (hand count and banked Pips, flagged when a Power Tier turn
becomes affordable); a selected-unit inspection panel; and a segmented Pact gauge.

**Two bugs surfaced, both by tests rather than by looking at it:**

1. *The rotation projection was subtly wrong.* `rot` reflects continuous points and must
   mirror about the board extent; `unrot` reflects tile indices and must mirror about the
   last index. Sharing one constant put every pick one tile out at 90° and 270°. This had
   been sitting in the codebase since the seam was first written, unnoticed because
   rotation was never switched on.
2. *The AI's compute budget was wall-clock based, which broke determinism.* Under parallel
   test load the machine slowed, the budget latched at a different point, and the same
   seed produced a different game. The simulation count is now the binding limit and the
   clock is only an anti-hang backstop. Deterministic play cost the hard 1.2s cap — worst
   case is now ~2s — which is the right trade, and the budget was retuned against measured
   strength rather than guessed at.

E3 was written assuming intent existed, with a declared-threat panel as its centre of
gravity. Without E1 that panel becomes a *potential*-threat readout instead, built on the
threat projection that already drives the danger zone — less pointed, still the answer to
"what should I be worried about". The rest of the HUD work is unaffected.

Deferred, in the order I would pick them back up:

| # | Work | Why it is worth returning to |
| :-- | :-- | :-- |
| 1 | **E2 turn flow** | Cheapest thing on the list; undo alone changes how a turn feels |
| 2 | **E1 enemy intent** | The engagement centrepiece — the fix for "you play blind" |
| 3 | **E5 juice** | Polish lands best on a game that already plays well |

## Deliberately not here

Flanking and facing · per-unit initiative · more schools or cards · the overworld ·
economy and ascension. All are additions; this plan is about the fight that already exists.
