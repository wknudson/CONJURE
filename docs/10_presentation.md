# 10 — Presentation: Board, HUD, Art and Sound

How the fight is drawn, what the HUD is allowed to say, and what the game sounds like.

This document absorbs two abandoned briefs — the old UI/UX architecture module and the
old art-and-sound module — and keeps only the parts the shipped game either does or still
wants. Every claim marked **SHIPPED** was checked against the tree; every claim marked
**OPEN** was checked and found absent.

---

## 0. The one premise that had to be thrown away

The old art brief described a **vibrant cel-shaded 3D open world** whose terrain the combat
grid projected onto: battle without a load, a ruined wall in the overworld becoming an
obstacle on the tiles beneath it, snow settling on a barricade's actual mesh.

**None of that is the game.** CONJURE is HD-2D on a single 2D canvas, with zero runtime
dependencies and no art assets — every body on the board is canvas shapes out of
`palette.ts`. There is no world mesh for a grid to land on, no cel-shader, and no camera
that can look at a wall from two sides. A brief that assumes a 3D engine cannot be
"adapted"; it has to be re-decided in the medium that exists.

What survived the medium change is the part that was never about polygons:

| Kept | Because |
|---|---|
| **Diegetic feedback** | The principle is medium-independent: a Mark is a brand seared onto the host, not an icon floating over it. See §2 and §3 |
| **Weather that persists into the fight** | Weather is real, engine-side and rendered — see §3 and §5 |
| **The soundscape intent** | The whole audio design was written as *descriptions of sounds*, which is exactly what a WebAudio synth can be handed. See §6 |
| **Tactical Readability as the first pillar** | It became more important, not less: a 2D canvas has fewer depth cues to spend |

What died with the premise: seamless world-to-combat transition, environmental props
snapping into the grid, ash layering onto Behemoth models, and dynamic shadows standing in
for line of sight. The last one is worth naming — the brief wanted **literal cast shadows**
instead of "game-y overlays", and on a 2D canvas with one light direction that reads as
decoration rather than as information. Blocked sight ships as explicit hatching instead
(§2), and it is the better answer here even setting the medium aside: a player about to
spend a card needs to know *why* a tile is refused, and a shadow cannot say "wrong
occupant".

---

## 1. The board and the camera

The battlefield is a classic **2:1 isometric diamond**. `TILE_W` is 116 and `TILE_H` is 58
([`src/render/IsoCamera.ts`](../src/render/IsoCamera.ts)), and *all* world-to-screen maths
routes through that one class — projection, tile picking, framing and depth sorting alike.
That single seam is what made turning the board a small change rather than a rewrite.

### The turntable — SHIPPED

The old brief called it the "Lazy Susan", and it is the one piece of that document that
shipped almost exactly as written.

| Gesture | Effect |
|---|---|
| **Right- or middle-drag** | free rotation, `0.01` radians per pixel (`RADIANS_PER_PIXEL`) — roughly a full turn per board width |
| **Q / E**, or the two HUD arrows | a quarter-turn, tweened over 260ms with `easeOutQuad` |

Left mouse is deliberately untouched. It selects, aims and attacks, and a camera control
fighting with it would make the board feel unpredictable. A press only counts as a drag
after 3px of travel (`DRAG_SLOP`), so a right-click that does not move still cancels
targeting.

Three rulings inside that are worth reading:

**The logical turn flips before the visual one.** `rotationStep` is quantised to quarter
turns and changes instantly; what animates is `spin`, which counter-rotates the finished
image and relaxes to zero. Doing it the other way round would leave a window in which the
board on screen and the board the mouse is hitting disagree.

**Picking un-projects in continuous space and floors last.** While rotation was limited to
quarter-turns, rounding first and un-rotating whole indices happened to work. At 47 degrees
a tile's screen diamond straddles several index cells and flooring early picks a neighbour.

**Free rotation is framed against the circle the board sweeps, not the box it currently
occupies** (`sweptExtentAtUnitZoom`). The tight box would be tighter and it grows and
shrinks as the board turns, so the zoom would pulse under the player's hand mid-drag. A
board that appears to breathe is far worse than a little unused margin at the clean angles.

Q and E also **snap a free-rotated board back onto the nearest quarter-turn first**, so the
arrows always leave the board square to the screen. The clean angles are the ones the art
was drawn for: at a quarter-turn the diamonds line up with the tile shapes and a Behemoth
reads as a box rather than a lozenge.

### Framing — SHIPPED

`fit()` measures the **projected corners** rather than deriving from grid dimensions,
because rotating a non-square board changes its screen footprint and rotating the *centre*
is not the same as the centre of the rotated *extent* — that discrepancy put the board half
a tile off at 90 and 270 degrees. The extent includes the Commander lines, which stand
`COMMANDER_MARGIN` = 1.35 tiles beyond each end of the grid.

Zoom is clamped at **0.45** (`MIN_READABLE_ZOOM`). Below that, tiles are drawn but cannot be
aimed at, and it is better to overflow slightly and let the player enlarge the window than
to render a board too fine to hit. `tooSmall` lets the HUD say so — once per session, not
once per resize.

### The Runic Boundary — SHIPPED

A glowing perimeter frames the arena
([`src/render/shapes.ts:80`](../src/render/shapes.ts#L80), `drawBoundary`, in
`PALETTE.boundary`). **This is the one retired-sounding term that stays**: the Commanders
stand off-grid beyond the back row, and the boundary is what a shoved unit crashes into
instead of flying into them. It hurts exactly as much as a body does — **30** to the shoved
unit (`COLLISION_TARGET_DAMAGE`), and the AI scores it as a damage source in its own right
([`src/core/ai/score.ts:118`](../src/core/ai/score.ts#L118)). The help overlay says it in
one line: *the arena boundary hurts exactly as much as a body does*.

> **Note the scale.** Collision is **30 / 20**, not 3 / 2. The old briefs were written
> against a pre-stretch stat scale and every number in them is a tenth of the shipped one.
> The Pact is **400 HP** (`BASE_PACT_HP`), and a levelled Companion raises it.

---

## 2. Readability

The board has to answer four different questions without becoming a spreadsheet: what can
I reach, where will this land, what is hidden, and what is about to happen to me. Each gets
its own visual channel, and the channels are deliberately not interchangeable.

### Silhouettes — SHIPPED

`drawSilhouettes` ([`BoardRenderer.ts:1046`](../src/render/BoardRenderer.ts#L1046)) tracks
the occupied screen box of every Behemoth, and any 1x1 whose centre falls inside one *and*
sits behind it gets a flat team-colour ellipse at 45% alpha drawn through the larger body.
**The board never fully hides a unit.**

Two scope decisions: Behemoths do not silhouette each other (a 2x2 is never swallowed by a
2x2), and **Commanders are excluded** — a Commander is drawn beside the board rather than
on it, and ghosting one would suggest a piece was hidden when it is simply off-grid.

The old brief also wanted an **Alt-held x-ray** dropping all tall terrain to 20% opacity.
That is **OPEN**, and probably unnecessary: silhouettes are automatic rather than
modal, and the turntable already answers "what is behind that". A held key to see the board
is a key the player has to learn is there.

### Where you may aim, where it lands, and why the rest is refused — SHIPPED

Four overlays, because these are four different answers and a player acts on them
differently:

| Overlay | Says |
|---|---|
| `highlight` | tiles you may legally aim at |
| `impact` | every tile the cast would actually **touch** — the shape of the thing, drawn whether or not anything is standing in it |
| `dimmed` | in reach, and refused: wrong shape, wrong occupant, too close for a mortar |
| `fog` | hatched — **you cannot see it** |

`impact` earned its place: a cone, a cross, a 2x2 body or a beam down a rank all cover
ground the player never clicked, and before it existed the only way to see that ground was
to hold Shift and read damage badges — which showed nothing at all for a card that deals no
damage. And `fog` keeps its own hatching rather than folding into `dimmed`, because "you
cannot see it" and "you can see it and it will not do" are different sentences.

`reach` is distinct from `attack` for the same reason: a player deciding where to *move* is
asking how far the thing gets, and needs tiles to count rather than targets to click.

### Trajectories — SHIPPED

`drawTrajectories` draws the flight of a shot in its school's colour, as a dashed line that
crawls toward the target so it reads as a direction rather than a tether. An `arcing`
profile is lifted into a parabola, with height scaled to span. That is the whole point of
the pass: **an arcing shot and a flat one can cover exactly the same tiles and differ
completely in what they may cross**, and on an isometric board there is no other way to
show which one you are holding.

Drawn above the tiles and below the bodies, so a line reads as passing *behind* what it is
aimed at rather than being painted over it.

### Ghosts and the CRASH badge — SHIPPED

Aim a shove and a translucent copy of each displaced unit slides along its path to where it
lands. A **list**, not one ghost, because an area shove moves everything in the wedge and a
gravity pull drags four bodies onto a tile — showing only the first reads as "this one
moves and the others do not", which is precisely the wrong answer to the question the ghost
exists to answer.

Where a body lands on something, a jagged **CRASH** badge is stamped at the collision tile
— stroked then filled, in the canvas at [`BoardRenderer.ts:1367`](../src/render/BoardRenderer.ts#L1367),
with a DOM floater counterpart in [`Fx.ts:266`](../src/render/Fx.ts#L266) for the
resolution itself. The preview and the payoff use the same word on purpose.

### Expand Prediction — SHIPPED

**This one the old brief got right and it is built.** Holding **Shift**
(`TargetingController.setExpanded`) does three things at once:

1. **Freezes the ghosts** at their landing position instead of looping them along the path.
2. **Reveals the area half of the prediction** — `aoe` badges are suppressed at rest and
   shown while expanded, so an ordinary single-target preview stays quiet and a cascade can
   be inspected on demand.
3. **Prints the actual incoming number on every threatened tile** when the danger zone is up.

That is the brief's "prevent visual vomit during massive chain reactions" resolution,
implemented as a modifier rather than as a mode.

### The danger zone — SHIPPED

**T** toggles it, and the HUD's Threat button mirrors the state. Drawn the way *Fire
Emblem* draws it: a light red wash per tile, plus an outline around the **edge** of the
region rather than around every tile — outlining each tile turns a large threatened area
into visual noise, which is exactly the case where the player most needs to read it. Wash
depth scales with converging attackers (`min(0.26, 0.09 + damage × 0.02)`) and is kept
light enough to see the board through.

The HUD carries the same fact in words: *"3 enemies can reach your Pact"*, and a distinct
declared-intent line once the enemy has committed.

### Marks are brands, not icons — SHIPPED

The diegetic ruling from the old art brief, kept verbatim in intent. `drawMark`
([`shapes.ts:488`](../src/render/shapes.ts#L488)) paints a sigil **onto the host's top
face**, pulsing on a slow cycle, offset higher for a Behemoth than a 1x1. It is not a UI
badge parked above a head.

> **Terminology.** These are **Marks**. `Rune` was the old word and survives in exactly one
> place — the save loader's rename table, so an existing collection keeps the cards it paid
> for. The **Runic Boundary** in §1 is unrelated and keeps its name.

### Screen effects — SHIPPED

`Fx` ([`src/render/Fx.ts`](../src/render/Fx.ts)) owns shake, detonation flashes, expanding
rings, particles and world-anchored DOM floaters. `screenShake` takes the **max** of the
current and requested magnitude rather than summing, so a cascade shakes hard once instead
of resonating itself apart.

Not everything gets a bang. A steam cloud has **no flash and no shake** — the tile quietly
fills, because a hazard arriving is a change to the ground rather than an impact on it, and
the cloud outlives the moment that made it.

---

## 3. The HUD

The rule the whole layout follows: **health and resources belong at the edges the eye
returns to, never on the tiles it is reading.**

The Pact bar used to sit in a 400px stack centred above the hand, which put it across the
middle of the arena — the one strip of screen the board is guaranteed to occupy at every
size from 4x4 to 12x12. It now lives in the bottom-left corner, and the resource dial
mirrors it in the bottom-right ([`src/hud/Hud.ts`](../src/hud/Hud.ts),
[`src/styles/hud.css`](../src/styles/hud.css)).

### The resource dial — SHIPPED

The old brief's "Dual-Ring Resource Dial", rebuilt in the shipped vocabulary. It shows
**banked Pips** and **volatile Marrow**, and the two are drawn to be tellable apart at a
glance mid-fight:

| Ring | Drawn as | Why |
|---|---|---|
| **Pips** — banked | Heavy metallic sockets, up to `PIP_CAP` = 8, filled ones warm gold with a glow | A socket is a thing that *holds*. Pips carry over between turns |
| **Marrow** — volatile | Flickering crimson beads on a 1.4s animation, hidden entirely at zero | Crimson rather than ember, deliberately: Marrow is the visceral one, and all of it is lost at end of turn |

At narrow widths a row of eight sockets would reach the hand, so under 1000px the dial
wraps to two rows of four and shrinks the sockets rather than sitting over the rightmost
card.

**"Spark" is retired.** The volatile resource is **Marrow**, extracted by the blood tithe,
by channelling, by overdraw and by opening something up — see `docs/02_combat_lexicon.md` §2.

### The Pact bar — SHIPPED

One shared pool, printed as `PACT 400 / 400`. The **denominator is read from the board, not
assumed** — `syncFromBoard` sets the maxima *before* printing, because `setCommanderHp`
prints the denominator and setting it afterwards left the opening render showing a default
that was invisible for as long as every Pact happened to match it, and wrong the moment a
levelled Companion raised one.

The old brief's **Direct-to-HUD damage** ruling holds: damage from non-grid sources lands as
a pulse on the corner bar rather than as a floater over empty tiles, so a wager penalty
never reads as something happening on the board. `pulsePact(side)` is the hook.

### Last Stand — SHIPPED

At a quarter of the Pact (`LAST_STAND_FRACTION` = 0.25) the presentation changes state:
the canvas **desaturates**, a red vignette pulses on a 1.15s cycle, the Pact fill goes
critical, a `LAST STAND` banner fires, and the heartbeat ambience comes up underneath
everything (§6). This is the old brief's "absolute panic induction" beat, and it is the one
place the game deliberately degrades its own readability for effect.

### Controls, and what each is for

| Key | Button | Does |
|---|---|---|
| Q / E | ⟲ ⟳ | quarter-turn the board |
| right/middle drag | — | free turntable |
| Shift *(hold)* | — | Expand Prediction |
| T | Threat | danger zone |
| F | speed gauge | playback pace — Normal gives the enemy's turn room to be read; Fast runs it out |
| C | ✦ Channel | spend the selected unit's attack for 1 Marrow |
| Z / Backspace | ↶ Undo | steps back a **move**; attacks and card plays are final |
| Tab | — | cycle to the next ready unit |
| Space *(hold)* | — | fast-forward the animation queue |
| Enter | End Turn | |
| H | ? | rules reference |
| Esc | — | cancel targeting |
| — | 🔊 | mute, persisted to `conjure.muted` |

Every one of those buttons carries a `data-tip` written as **name / what it does / how to
reach it**, so the keyboard is discoverable from the mouse.

**There is no "Snap to Front".** Q and E snap a free-rotated board back onto a clean angle,
but nothing returns it to the *default* orientation — see §7.

### Weather badge — SHIPPED

Worn beside the round counter, brass and etched glass rather than a weather app, tinted per
sky. One glyph, a name in the world's own voice, and the rule in plain words:

| Sky | Badge | Says |
|---|---|---|
| `fog` | ☁ Smog Bank | *Vision clamped: nothing sees or shoots past 3 tiles.* |
| `rain` | ☂ Acid Rain | *Pyre dampened. Shock arcs to everything touching what it hits, yours included.* |
| `gale` | ≫ Gale, eastward | *Projectiles carry further downwind, and fall short into it.* |

[`src/hud/weather.ts`](../src/hud/weather.ts) is the **single** source for both the badge
and the pre-combat briefing, because two hand-written copies of one rule is how a card ends
up promising something the engine stopped doing three commits ago. It imports nothing from
`src/core/` in the other direction — the engine has no opinion about what a gale is called.

---

## 4. The Field Journal and the screens outside the fight

The old brief's **Diegetic Alchemist HUD** — menus as physical objects the Hero carries —
is the frame that survived best, because it needs no engine at all. It is CSS.

The Safehouse is a hub of four zones: **the Apothecary**, **the Ironworks Artificer**, **the
Vivarium**, **the Field Journal**, plus **the Bounty Board** for what work is going and what
it pays.

### The Field Journal — SHIPPED

The live name, in the code and in the fiction
([`src/app/DeckBuilderScreen.ts`](../src/app/DeckBuilderScreen.ts),
[`src/styles/builder.css:925`](../src/styles/builder.css#L925)). Four tabs: **The Deck**,
**The Threat Ledger**, **Hero**, **The Vanguard**.

Drawn as an object rather than a menu. Tooled leather with a lamp over the desk; both panes
are pages — aged paper, a ruled inner edge the way a ledger is ruled, brass at the corners.
Pane headers are **set in a serif**, not the UI face: the journal is written in a hand, and
the filter pills below are the same hand in a smaller size.

The proportions are load-bearing: **left is the decklist, a column you read down; right is
the case, laid open, a surface you scan across.** Those want very different amounts of room
(`minmax(270px, 28%) 1fr`).

### What the brief wanted here and did not get

The old document proposed a **3D card fan** — an overlapping smooth-scrolling horizontal
stream — with a **Grid View toggle** to flatten it when the fan got tiring. Neither exists,
and the reason is that the brief argued itself out of the fan on the way to proposing the
toggle. If scrolling 30 cards left-to-right causes fatigue the moment a player is actually
min-maxing, then the flat case is the *default*, not the escape hatch. **The shipped case is
the grid**, and the toggle it would have needed is moot rather than missing.

Card frames still carry colour: the Hero's half of a deck is `neutral` and `arcane` by rule
— colourless — and the Companion's Spells wear their school. **The schools are Pyre, Frost,
Surge, Dusk, Bulwark and Bloom**, plus **Arcane**, the Hero's own. Pyromancy, Cryomancy and
Electromancy are retired words.

The brief's **visual limit enforcement** does ship, and against the right numbers: copy caps
are `{ tier 1: 3, tier 2: 2, tier 3: 1 }` tracked by base id, and an ineligible card becomes
a disabled card in the case rather than vanishing from it
([`deckRules.ts:131`](../src/core/data/deckRules.ts#L131)) — the refusal is shown with its
reason, not hidden.

> **The Hero Deck is 4 to 12 cards** (`MIN_DECK` / `MAX_DECK`), not a 15-card dual-signature
> stream. Fifteen is the *fused* opening deck — 7 colourless Hero cards plus the beast's 8
> drafted Spells — and it is a reading, not a rule. See `docs/07_deck_building.md`.

### Economy vocabulary

**Renown and Ante are retired.** There are no Renown medals pinned to the screen and no
Ante wager. The currencies are **Ducats**, **Shards** and **Cores**, and the work comes from
the **Bounty Board**.

---

## 5. Art direction: HD-2D

The full account of the look lives in `docs/06_character_creation.md` §4, written against
the creation diorama. It is the same visual language the board speaks, and the short version
is that HD-2D turned out to be **three tricks, all reachable from a 2D canvas**
([`src/render/Diorama.ts`](../src/render/Diorama.ts)):

1. **The ground is tilted; the actors are not.** A one-point perspective divide, not an
   isometric shear — rows genuinely converge, and sprites are drawn *upright* at the
   projected position of their feet. A receding floor under a straight-on character **is**
   the HD-2D signature.
2. **Tilt-shift.** A narrow sharp band with falloff above and below is what tells the eye it
   is looking at something *small*. One extra canvas, no shader.
3. **Depth haze.** Each tile fades toward the sky colour by its projected scale.

Three rulings from that work generalise to everything drawn in this game:

**Pixel, not vector.** Figures are painted into a small buffer and blitted up with
`imageSmoothingEnabled = false`. Smooth anti-aliased curves at final size read as vector
illustration however well they are lit, and **quantisation is most of the HD-2D look**.

**Value, not detail.** At sprite scale a mark is axis-aligned and near-opaque or it does not
exist. The three marks that carry a figure are a lit/shadow split down the form, an ink line
that is *not* black (an outline darker than the form reads as a void and flattens the very
break it surrounds), and a rim light down the lit edge — which is the single mark separating
"a lit form standing in a place" from "a sticker on a background".

**Silhouette over ornament.** Hair is authored as six silhouettes because a silhouette is
what survives being drawn 40px tall and tilted back into a diorama. The same reasoning gives
each unit archetype its outline on the board ([`shapes.ts:139`](../src/render/shapes.ts#L139)).

### Weather on the board — SHIPPED

The old brief's persistent weather is real, and it is where the diegetic principle earns
most of its keep. Weather is global, permanent, and lives on the encounter; the presentation
is a non-interactive layer above the canvas and below the HUD, keyed off one `data-sky`
attribute set once at mount ([`src/styles/board.css:166`](../src/styles/board.css#L166)).

| Sky | Drawn as |
|---|---|
| **Smog Bank** | a sour industrial haze closing in from the edges — heavy in the corners, nearly clear over the middle, so the board a player is reading stays readable |
| **Acid Rain** | a cold wash, plus streaks from one repeating gradient panned by `transform` |
| **Gale** | dust streaming downwind, driven by `--wind-x` / `--wind-y` set from the encounter's **actual** wind vector, so the drift follows the direction the engine is scoring |

**They tint and vignette; they never occlude.** Nothing here can eat a click or hide a unit
outline, and nothing animates position, so none of it forces layout. A
`prefers-reduced-motion` query stops the drifting and keeps the tint — the tint carries the
information, the movement is decoration and is the part that causes trouble.

Elemental scars — charred grass after a Pyre cascade, a frost layer under a Frost one — are
half-shipped and renamed. What exists is **hazards**: `steam_fog` left by Vaporize, permanent
`rubble` left by a trail, and `current`. Those are mechanical terrain rather than cosmetic
staining, and they are rendered as ground rather than as an effect on it — rubble is drawn
flat and first, because it *is* the floor and not something on it, with chips scattered
deterministically per tile so they do not crawl.

---

## 6. Sound

**The entire audio layer is one file:** [`src/sound/Sfx.ts`](../src/sound/Sfx.ts). WebAudio
synthesis, no asset files, and **no music at all**. Every cue is oscillators and filtered
noise assembled from two private primitives, `tone()` and `noise()`.

That constraint is what made the old brief usable. Its audio section was written as prose
descriptions of sounds — *"a heavy glass vial rapidly filling"*, *"sizzling flesh"*, *"a
collapsing stone building"* — and prose descriptions are exactly what you can hand a synth.
The table below is the brief's intent as it actually shipped.

| Cue | What it is |
|---|---|
| `pip` | one rising sine. Turn income: expected, and quiet |
| `chime` | **two** rising notes where `pip` has one, so a reaction refund is audibly better news than the Pip that arrives anyway |
| `rasp` | a falling sawtooth under harsh noise. **Named for the sound, not the event** — it serves Marrow, hazards and Resonance alike, and a cue named after one of them would misdescribe the other two. Deliberately unpleasant: spending life should sound like it costs something |
| `hit` | short filtered noise plus a low triangle |
| `shock` | a *crack*, not a boom: a very short high square burst over bright noise, with a second snap a hair later so it reads as a discharge rather than a hit |
| `crash` | the collision. Low, blunt, no ring |
| `detonate` | **the signature cue.** A sine sweeping 220→900Hz over 0.3s, then **~90ms of genuine scheduled silence**, then a bass boom at 70Hz. Pitched up by chain depth, so a cascade climbs |
| `shatter` | brittle and bright — a high crack over a sharp noise burst |
| `hiss` | sustained and tuneless: steam is pressure escaping, not an impact |
| `wildfire` | bass-heavy roar. Combustion rather than a bang |
| `death1` | 1x1: quick and brittle, 0.12s of bright noise |
| `death2` | Behemoth: heavy and prolonged, half a second of low noise with a delayed 60Hz thud under it |
| `gear_lock` | the winch taking a notch. A low thunk with a metallic scrape and **no ring afterwards** — machinery, not magic |
| `card`, `win`, `lose` | the small furniture |

The detonation cue is the one the old brief built its whole identity around, and it is the
one place the game schedules **silence as a sound**. It is also the reason the audio layer
needed nothing else: a rising hum, a held nothing, and a boom is a *structure*, and structure
survives being synthesised where a sample would not have been available at all.

### Ambiences — SHIPPED (one of two)

Loops are scheduled repeats of a synthesised figure, not looped buffers, since there are no
files to loop. They are kept in a registry keyed by id and are **deliberately not
exclusive** — a player dying while holding the tether should hear the heartbeat under the
winch, and the two together are the point.

| Loop | Figure | Period | Status |
|---|---|---|---|
| `last_stand` | **heartbeat** — lub at 82Hz, softer dub a fifth of a second later | 1150ms | **SHIPPED**, driven by `Hud.setLastStand` |
| `tether_strain` | **winch grind** — two detuned saws beating against each other, grinding underneath, a scrape over the top | 620ms | **built, never triggered** — see §7 |

The winch is quiet on purpose: it would play under combat for rounds at a time, and an
ambience that competes with the hits is one the player turns the game off to escape. *It is
meant to be noticed and then felt rather than heard.* Its period is shorter than its own
sound so the tail of one grind overlaps the head of the next and the strain reads as
continuous rather than as a pulse.

Restarting a live id is a deliberate no-op — the alternative is a second interval nobody
holds a handle to, which is how a sound becomes unstoppable. Loops are also safe to start
before `unlock()` has run: the ticks check for a context and fall silent, so a loop begun in
an un-gestured session simply produces nothing and can still be stopped normally.

> The brief's Last Stand wanted *"background music cuts out completely, ambient noise
> muffled"*. There is no music and no ambient bed to cut, so the effect is carried the other
> way round — the heartbeat **arrives** rather than the music **leaving**, and the visual
> desaturation does the muffling. Same beat, inverted, because the game has no soundtrack
> to take away.

---

## 7. Open

Everything below was checked against the tree and is absent or incomplete.

**Wanted, and worth building:**

- **`stopAllLoops` has no caller.** Its own doc comment says *"called on the way out of
  combat"*, and nothing calls it. `setHeartbeat(false)` covers the common exit, so the
  practical risk is narrow — but a heartbeat following the player into the Safehouse is
  exactly the failure mode the method exists to prevent.
- **`tether_strain`, `cable_snap` and `vault_lock` are synthesised and never played.** The
  winch grind, the steel letting go, and the opposite sound — nothing breaks, something
  closes. Three finished cues waiting on the subjugation presentation to call them.
- **No "reset the camera" control.** Q and E snap a dragged board back to a clean angle, but
  nothing returns it to the *default* orientation. The old brief's "Snap to Front" button
  and Spacebar hotkey are both unbuilt, and Space is taken (fast-forward).
- **Adaptive Animation Speed.** The brief wanted the full page-flip animation on first open
  and a 0.2s snap thereafter. What ships is a **manual** pace toggle (F: Normal / Fast) for
  combat playback, which is a different and more honest thing — the player says when they
  are done being shown. Nothing adapts on its own, anywhere.

**Not wanted — declined, with the reason:**

- **The Alt-held terrain x-ray.** Superseded by automatic silhouettes plus the turntable.
- **The 3D card fan and its Grid View toggle.** The flat case is the default (§4).
- **The Ornate Compass, the overworld recipe tracker, and Renown medals.** All three belong
  to an explorable overworld HUD that does not exist; there is no minimap because there is
  no map. Renown is a retired currency besides.
- **Seamless world-to-combat transition, props snapping into the grid, and cast shadows for
  line of sight.** All three assume the 3D world of §0.

**Unverified rather than unbuilt:**

- **Nobody has watched the camera turn.** The dev-browser pane used for verification does not
  composite frames, so `requestAnimationFrame` never ticks there — the same gap
  `docs/06_character_creation.md` §9 records for the creation diorama. Rotation is tested by
  round-tripping every tile's picking at all four quarter-turns and at the clamped minimum
  zoom ([`src/tests/presentation.test.ts`](../src/tests/presentation.test.ts)), which proves
  the maths and says nothing about how the 260ms spin *feels*.
- **No audio test.** `Sfx` is untested by construction: there is no `AudioContext` in the
  test environment, and a recording-context approach of the kind the sprite tests use would
  assert the shape of a graph rather than the sound of a cue. `isLooping` is exposed partly
  so that a future test has something to hold.
