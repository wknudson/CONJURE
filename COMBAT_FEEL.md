# CONJURE — Combat Feel & Presentation Plan

*Written 2026-08-17, after Phases A–D. The overworld is deferred; this is about making
the fight itself worth playing twice.*

---

## The honest diagnosis

The combat **rules** are deep: collisions, line of sight, Mark cascades, three elemental
reactions, 2×2 Behemoths, Escalation, two AI tiers. The combat **experience** does not yet
use that depth, for three reasons:

1. **You play blind.** You act, then the enemy acts, and you find out what happened. The
   danger zone shows what *could* be hit, which on a small board is nearly everything —
   so the honest answer to "am I safe here?" is usually "no", which is the same as no
   information. Every loss feels like something that happened *to* you.

2. **A turn is a checklist, not a decision.** Play affordable cards, move each unit
   forward, attack if something is in reach, end turn. There is rarely a moment where two
   options are both good and you have to choose.

3. **Nothing lands.** A Mark cascade that wipes three units and a plain chip hit get
   nearly the same presentation. The systems with the most design behind them are the
   least celebrated on screen.

Fixing (1) is worth more than everything else combined, and it also happens to make the
HUD work and the rotation work more valuable — so it goes first.

---

## ~~E1 — Enemy intent~~ ✅ DONE (2026-08-17)

The enemy commits at the end of its turn and honours the commitment. Declared blows are
drawn on the board with their damage; blows aimed at the Pact draw a line to the Hero and
total into a HUD readout. Moving a target off a declared tile makes the swing land on
empty ground, which emits a visible MISS.

**Design points that turned out to matter:**

- *Declaration is a command*, so it passes through the one reducer and replays identically
  from a seed rather than being a side effect the harness cannot see.
- *The next turn is planned against a forecast board* on which the enemy's units have
  refreshed. Planning against the live state finds nothing, because every unit is spent at
  the moment the turn ends. The forecast deliberately does not simulate the upkeep draw —
  promising a card the enemy does not hold yet would be a lie.
- *A dead intent skips rather than aborts.* Killing one attacker must not cancel the rest
  of the enemy's turn.

**Trust gap: closed 2026-08-17.** The cause turned out not to be status ticks — statuses
live on units and never on a Commander in this engine. It was **Growth**: an intent
records the attacker's ATK when declared, but Growth fires at the start of the enemy's
turn, *before* the blow lands, so a growing unit hit harder than it promised. The HUD now
projects that growth and itemises the total ("Incoming: 7 damage (5 attack, 2
escalation)"). It is an upper bound — an attacker that dies before swinging makes it read
high — which is the safe direction to err.


## ~~E2 — Turn flow~~ ✅ DONE (2026-08-17)

Undo (Z / Backspace / button), Tab-cycling, and a two-click End Turn that names what it
would waste. Undo is deliberately **client-side**: it stores whole `GameState` snapshots
on the screen component, emits nothing, and never enters the event stream — the engine
stays a pure reducer that has no idea the player changed their mind.

Because a snapshot carries the RNG state, rewinding rewinds the seeded stream too, so a
rewound game continues along exactly the branch it would have taken had the move never
happened. A snapshot that kept the advanced RNG would silently reshuffle the future, which
is the subtle failure an undo built on partial state produces; there is a test for it.

Attacks and card plays clear the stack outright. They reveal information and resolve
consequences, and being able to take them back would turn a turn into a search rather
than a decision.

**Not done:** hover-a-card-to-preview, and a tick on spent units. Both are cosmetic
against the three that remove real friction.


## ~~E3 — HUD refinement~~ ✅ MOSTLY DONE (2026-08-17)

*The dial, the enemy read, the inspection panel and the Pact gauge shipped — see
"Current scope" below. The itemised threat panel is the one piece still open.*

Do this *after* E1, because intent changes what the HUD must communicate.

**Problems today:** the resource dial is a simplified stand-in for the docs' Dual-Ring
design; there is no read on the enemy's resources; status effects live only as small chips
on the board; and there is no single place that answers "what should I be worried about".

**Planned:**

1. **Threat panel.** A compact list of declared intents: which unit, how much, where. This
   is the HUD's new centre of gravity, and it is what E1 makes possible.
2. **Proper Dual-Ring dial** (see `docs/10_presentation.md`) — metallic sockets for banked
   Pips, ephemeral beads for Marrow that visibly burn away at end of turn.
3. **Enemy read.** Hand count and banked Pips, so a Cataclysmic Core turn is foreseeable
   rather than a surprise.
4. **Selected-unit panel.** Stats, keywords, statuses and remaining actions in one place,
   rather than only in a hover tooltip.
5. **Pact gauge with segments.** The Pact pool as eight readable segments, so "two hits from death"
   is legible at a glance instead of arithmetic.

---

## ~~E4 — Camera rotation~~ ✅ DONE (2026-08-17)

*Shipped in full. The plan below is kept because its "one real snag" and its verification
list are exactly what the implementation had to solve — including the projection bug
recorded under "Current scope".*

The seam was already there and clean: `rot()`/`unrot()` exist in `IsoCamera` and nothing
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

## ~~E5 — Making things land~~ ✅ DONE (2026-08-17)

Hit-stops on death (150ms for a minion, 400ms for a Behemoth), a cascade crescendo that
escalates shake and pitch per link and prints CASCADE ×N, Escalation stacks scaling the
unit's drawn size, and a Last Stand state below 20% Pact that desaturates the board and
brings up a synthesised heartbeat.

Entirely client-side: `git diff src/core/` is empty for this work. The one supporting
change was giving the sound layer a `pitch` option, which the crescendo needs and which
lives in the presentation layer.

**Per-reaction identity — done 2026-08-17.** The `reactionTriggered` handler is now a
router on the reaction id:

| Reaction | Reads as |
| :-- | :-- |
| **Shatter** | Oriented cyan/white slivers thrown outward under hard gravity, a sharp 140ms shake, and a brittle high crack. Rigid failure: loud and over at once. |
| **Vaporize** | A soft white bloom that holds opacity before clearing, drifting upward, with a sustained hiss and **no shake** — nothing struck anything. It outstays the animation beat because the fog it leaves is a real rule. |
| **Wildfire** | Embers that cross from green to orange over their own lifetime, a fire ring outrunning a green one, and a bass-heavy roar pitched down to 0.85. |

Unknown ids fall through to the generic burst, so a reaction added later is unstyled
rather than invisible.

Supporting work, all presentation-layer: particles gained size, orientation, per-particle
gravity and decay, and a colour ramp; rings gained a filled soft-edged mode.

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
gravity. E1 shipped, so that panel can be what it was meant to be — a readout of *declared*
intent rather than potential threat.

**What is actually left.** E1, E2, E4 and E5 all shipped; the struck-through headings above
carry the retrospectives. Three items from this plan did not land:

| # | Work | Why it is worth returning to |
| :-- | :-- | :-- |
| 1 | **The threat panel itself** | A toggle and a one-line warning exist. The itemised list — which unit, how much, where — is the piece E3 was actually about |
| 2 | **Hover a card to preview it** | E2's cheapest remaining idea; reading a card should not cost a click |
| 3 | **A tick, not a dim, on spent units** | Dimming reads as "disabled"; a tick reads as "done" |

All three are tracked in `ROADMAP.md` so they do not live only here.

## Deliberately not here

Flanking and facing · per-unit initiative · more schools or cards · the overworld ·
economy and ascension. All are additions; this plan is about the fight that already exists.
