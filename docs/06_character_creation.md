# 06 — Character Creation: The Applicant & The Vow

How a blank save slot becomes a Commander, what each of the two steps is *for*, and why
they are shaped the way they are.

Everything here is live. Line references were checked against the tree at the time of
writing; where a claim is a design intention rather than shipped behaviour it says so.

---

## 0. The shape of it

```
Title wall
  │  click a blank poster                    TitleScreen.blankPoster → draft()
  │  ~700ms "Sketching new contract…"        TitleScreen.ts:246
  ▼
CharacterCreationScreen                      src/app/CharacterCreationScreen.ts
  │
  ├─ Step I — The Applicant                  identityPanel()          :277
  │    nickname · bearing
  │    (nothing written; fully reversible)
  │        │  "Take the Vow"
  │        ▼
  ├─ Step II — The Vow                       vowPanel()               :349
  │    six bloodlines; camera pans; beast drops in
  │        │  "Bind <name>"                  onCreate(look)           :380
  ▼
initializeNewProfile(slot, look)             src/app/save.ts:407
  │
  ▼
Safehouse
```

The screen is handed two callbacks and nothing else ([CharacterCreationScreen.ts:45-47](../src/app/CharacterCreationScreen.ts#L45)).
It never touches a save, a profile, or `localStorage`. `main.ts` owns that seam
([main.ts:236-246](../src/main.ts#L236)):

```ts
new CharacterCreationScreen({
  onCreate: (look) => {
    saveFile.profiles[slot] = initializeNewProfile(slot, look);
    openProfile(slot);
  },
  onCancel: showTitle,
});
```

**Nothing is persisted until `onCreate` fires.** Backing out at any point leaves the slot as
blank as it was. That is what makes the title wall safe to poke at.

---

## 1. The data the whole flow exists to produce

One object, three fields, defined in [`core/data/characterLook.ts:22`](../src/core/data/characterLook.ts#L22):

```ts
export interface CharacterLook {
  nickname: string;
  gender: 'male' | 'female';
  starterCompanion: string;   // a CompanionDef.id — 'ignis', 'boreas', …
}
```

It hangs off `Profile.characterLook` ([save.ts:252](../src/app/save.ts#L252)) and is the reason
`SAVE_VERSION` is **19** ([save.ts:81](../src/app/save.ts#L81)).

**It used to be five.** `hairPreset`, `facePreset` and `skinPreset` drove a procedural painter
that no longer exists — the Commander is authored art now, and there is no sheet to index a
haircut out of. Those keys are **ignored** on load rather than migrated
([characterLook.ts:53-56](../src/core/data/characterLook.ts#L53)): a save that still carries
them loads as a clean three-field look. That is the honest outcome, because the question they
answered stopped existing rather than changing its answer. See §4 for what replaced the painter
and §6 for what an older save gets.

### Why it lives in `core/data` and not beside the save schema

Two very different readers need it: the screen, which *draws* it, and `initializeNewProfile`,
which *writes it down*. One source means a preset the screen offers can never be a preset the
save refuses. `save.ts` imports the type and the two functions; it does not redeclare them.

### Why there is no gear in it

The brief was explicit and the reasoning holds independently: optics, vestment, trinket,
treads and will are things a Commander **earns**. A creator that could set them would be
spending the reward before the first contract. The prohibition is enforced by a test that
walks `RELIC_SLOT_ORDER` and asserts none of those keys exist on the look
([creation.test.ts:59-68](../src/tests/creation.test.ts#L59)) — so somebody adding a slot to
the creator has to delete an assertion that says why not.

### Why `starterCompanion` is a species and not a school

It is the narrower fact. The school is derivable from the beast; the beast is *not* derivable
from the school the moment a second bloodline speaks one. Storing the wider fact would mean
storing a second copy that could disagree with the first.

---

## 2. Step I — The Applicant

> *"The Magistracy files a name and a likeness before it files anything else. None of this is
> worth anything yet, which is rather the point."*

### What the player does

| Control | Field | Range |
|---|---|---|
| Text input | `nickname` | trimmed, capped at `NICKNAME_MAX` = **18** |
| Two-button toggle | `gender` | `female` \| `male` |

Two controls, because two is what the art supports: there are two sprite sheets, and `gender`
is the only look field that still changes what is drawn. The three cyclers that used to sit
here drove the procedural painter and went with it.

Built by `identityPanel()` ([:277](../src/app/CharacterCreationScreen.ts#L277)), laid out as a
**bar docked along the bottom** rather than the column that used to sit in the bottom-right
corner. The corner existed to clear the figure, which stood left of centre; now that the figure
stands *in* the centre, a panel on one side would put the composition back off-balance for no
reason. Two fields and two buttons is short enough to lie down.

**The bearing toggle does not blank the figure.** Both sheets are preloaded when the screen is
constructed ([:113-121](../src/app/CharacterCreationScreen.ts#L113)), so the swap resolves on a
microtask and the old figure is replaced before the next frame draws. It used to null the image
first and let `drawCommander` skip a frame, which opened a guaranteed hole in the middle of the
stage — a figure that vanishes reads as a bug, where a figure that changes reads as the toggle
working. The stale-load guard in `loadHeroSprite` is what makes holding the old bitmap safe:
a slow load that lands after a second click is discarded.

### Step I is a close shot, dead centre

`SHOT_IDENTITY` puts the camera **on the Commander's own tile** — `x` and `y` are literally
`HERO_AT` ([:91](../src/app/CharacterCreationScreen.ts#L91)) — and two useful things fall out
of that arithmetic rather than out of tuning:

- `dx = 0`, so the figure projects to the exact centre of the frame at *any* zoom. The previous
  framing pushed them left to clear the panel and paid for it with a hand-derived constant
  (`HERO_AT.x + 0.5 / zoom`) that had to be recomputed every time the zoom moved, because zoom
  multiplies the offset. A centred subject cannot drift.
- `ty - cam.y = 0`, so `dz` is exactly `EYE` and the projected scale is exactly `zoom`. One
  knob now sets how big the figure is *and* where its feet land, monotonically.

At `zoom: 3.2` the feet land at **0.713** of frame height and the figure stands **0.604** of it
— three-fifths of the frame, sky above, and the bottom quarter left clear for the form bar.

**The old framing was cutting the head off.** At `zoom: 1.8` the feet landed at 0.410 and the
sprite blitted 0.470 tall, which put the crown **44 pixels above the frame** at 720p, at every
window size. The suite contained a test for the Commander being inside the *focus band* and it
passed, because the cast was declared 1.15 tiles tall while the draw code blitted 1.7 — so
every assertion was about a figure a fifth shorter than the one on screen. Both numbers now
come from `COMMANDER_HEIGHT_TILES` ([sprites.ts:96](../src/render/sprites.ts#L96)), and a test
asserts the crown is inside the *frame*, which is a different claim from being inside the band.

Step II pulls back to `zoom: 2.2` — still a close shot, because it has a second body to fit in
rather than because the Vow wants distance. See §3.

Moving the camera is what forced the **focus band to be derived** rather than written down.
Constants were correct until something moved, and then silently wrong in a way that looks
like a blurry sprite rather than like misplaced focus — a close Step I would have put the
Commander straight back into the blur she had been rescued from. `focusBand` projects the
cast, covers the tallest head and the nearest feet, and clamps so there is always falloff at
both edges. The subject is in focus by construction, at any framing.

### The design: the sprite *is* the preview

The single most important decision on this screen is that there is **no preview box**, and it
survived the art change. The Commander stands on the diorama from the first frame, at `HERO_AT`
([:63](../src/app/CharacterCreationScreen.ts#L63)) — not in a bordered portrait pane beside a
form. Centring and zooming the shot is that decision taken further, not walked back: the figure
is now the largest thing on the screen, which is what a preview box would have been trying to
achieve by other means.

That is why the step is called *The Applicant* rather than *Appearance*: the player is
looking at a person standing in a place, not at a form with a portrait beside it.

What did change is *when* the bitmap is resolved. `drawCommander` blits a **cached image**
([sprites.ts:131](../src/render/sprites.ts#L131)) rather than re-painting from the look every
frame, so the figure changes when the file for the new bearing has decoded rather than on the
very next frame. With both sheets preloaded that distinction is invisible, which is the point of
preloading them.

### One small rule worth knowing

**The default look is fixed, not rolled** ([`defaultLook()`:39](../src/core/data/characterLook.ts#L39)).
The first thing a player sees has to be the thing their first click changes. A randomised
opening state makes a deliberate choice read as a reroll.

### The nickname is held raw and normalised on commit

The input handler stores what was typed, capped at length, and nothing else
([:303](../src/app/CharacterCreationScreen.ts#L303)). Trimming happens when the player
leaves the step. If the field trimmed on every keystroke it would fight a player over a
trailing space they are about to type a word after.

---

## 3. Step II — The Vow

> *"One bloodline, bound to you. It decides the spells you cast, the bodies your Vanguard may
> field, and half the deck you will shuffle. It cannot be changed."*

### Why it is a separate step

Step I is entirely reversible and Step II is not. Everything about a look can be changed by
clicking again; the bloodline is the one choice on this screen the game will never let the
player take back. Giving it its own beat, its own camera move and its own vocabulary is the
screen saying so without a modal warning.

### What is on offer, and the rule behind it

Six bloodlines, one per discipline, from `starterSpecies()`
([characterLook.ts:93](../src/core/data/characterLook.ts#L93)):

| Discipline | Bloodline |
|---|---|
| Pyre | Ignis |
| Frost | Boreas |
| Surge | Voltara |
| Bulwark | Ferrum |
| Dusk | Mortis |
| Bloom | Sylva |

`starterSpecies()` defers to `SPECIES_BY_SCHOOL`
([pools.ts:202](../src/core/data/pools.ts#L202)) rather than deriving its own answer. That
deferral is load-bearing and was learned the hard way — see §7.

### A rail of six, and one card

The layout is a **rail** down the left (`vowTab()`, [:389](../src/app/CharacterCreationScreen.ts#L389))
and one **featured card** on the right (`renderFeatured()`, [:424](../src/app/CharacterCreationScreen.ts#L424)),
with the channel between them left empty for the pair of bodies.

It was six equal cards in a horizontal scroller. Each had to carry everything about a bloodline
inside a 13rem column, so all six were a wall of 0.66rem prose nobody reads — and the one thing
that distinguishes an Ember Drake from a Vault Boar at a glance, the beast's own art, was an
`<img>` with **no CSS rule anywhere in the project**, rendering at its intrinsic 169×274 and
blowing the card apart.

Splitting the question splits the layout. The rail answers *which six are there* with a name, a
school and a face; the card answers *what is this one* at a size where the answer is legible.

### Step II is a two-shot, not an establishing shot

`SHOT_VOW` was `zoom: 1` looking from `y = -0.4`, which drew the Commander **121px** tall and the
beast **73px** on a 720p frame. Both were on screen and neither was worth looking at, which is a
strange way to stage the one irreversible choice in the game.

The camera now sits just behind and between them — `{ x: 0.75, y: 0.6, zoom: 2.2 }` — for
**309px and 188px** on the same frame, about two and a half times the size. `BEAST_AT` moved in
with it, from `x: 1.4` to `x: 1.0`: a two-tile gap reads fine in a wide shot and throws the pair
to opposite edges of a close one, at which point they stop being a pair.

`x: 0.75` is deliberately *not* the midpoint between them. It is offset so the pair lands inside
the empty middle column of the layout above, and **that column, not the frame, is what bounds the
zoom.** Two things set the ceiling and both were measured rather than eyeballed:

- The Commander's crown has to stay clear of the header. This is why the Step II lede is one
  short line — what it used to say about spells, bodies and the deck moved into the card, which
  has room for it and is where the player is looking anyway.
- The **widest** beast has to stay clear of the card. Voltara is 276×211 and Sylva is 177×332, so
  at a shared height Voltara is nearly two and a half times the width — 246px against 100px on a
  1280 frame. A framing tuned on a narrow beast puts a wide one half-behind a panel, so the
  ceiling is set by the worst case or one bloodline in six is drawn wrong.

Verified by intercepting the real `drawImage` calls and mapping them through the live transform:
at 1280×720 the Commander paints at x 328–462 and Voltara at 560–806, inside a channel running
216–864, with a 98px gap between them.

### The card shows what enrolling actually buys

Every number is read from the same place the profile will read it, so nobody is promised eleven
spells and handed nine:

- **`8 of N spells`** — `GRIMOIRE_SIZE` drawn from `SPELL_POOLS_BY_SPECIES`
- **`N bodies`** — `MINIONS_BY_SPECIES`, the Vanguard unlock this Vow grants
- **`15-card deck`** — `fusedDeckSize(STARTER_DECK.length)`
- **the opening warband, named** — `startingRosterFor(school)` ([pools.ts:271](../src/core/data/pools.ts#L271))

It also carries **two lines of copy rather than one**, because they answer different questions
and the old card had room to ask only one of them: `CompanionDef.blurb` is what this *beast*
does — authored on the def, with a comment reading "shown on the selection screen", which until
now it was not — and `DISCIPLINE` is what its *school* is for, which is the half that outlives
this one animal.

What is deliberately **not** shown is *which* eight spells this beast will know. That is the
roll, and spoiling it would make the first tank in the Vivarium a formality.

### Picking is not signing

`vow()` ([:471](../src/app/CharacterCreationScreen.ts#L471)) drops the beast onto the stage,
tints the ground, fills the card, and enables the button. It does **not** create anything.
Signing does ([:380](../src/app/CharacterCreationScreen.ts#L380)).

Nothing about the rail changes that. A tab click is a free, reversible act — which is why the
rail is not a `tablist` and the tabs are not radios: they are toggle buttons carrying
`aria-pressed`, reached by Tab and activated by Enter, and claiming `role="tab"` would promise
arrow-key navigation that nothing here implements.

Separating them is the whole point of the step: a player can try all six, watch each one
arrive in its own colour, and change their mind. Re-picking resets `beastEntry` to 0 so the
arrival animation replays — it is a thing that happens each time, not only the first.

The button reads **"Bind Ignis"**, not "Confirm". The name of the animal you are about to be
stuck with is the last thing you read before you commit.

---

## 4. The HD-2D staging

The aesthetic target was Octopath/Triangle Strategy: 2D sprites on a tilt-shifted 3D
diorama. This project has **zero runtime dependencies**, so none of that could come from an
engine. It turns out not to need one — the look is three specific tricks, all reachable from a
2D canvas ([`src/render/Diorama.ts`](../src/render/Diorama.ts)).

The *stage* is entirely code. The two **actors** standing on it are authored PNGs, which is the
one part of this screen that is not procedural; see "The sprites are authored art" below.

### 1. The ground is tilted; the actors are not

`project()` ([:110](../src/render/Diorama.ts#L110)) is a one-point perspective divide, not an
isometric shear. Rows genuinely converge, so the back of the field is narrower than the front
and a sprite standing there is smaller. It returns a `scale` alongside the point, because
everything drawn there — the sprite, its shadow, the tile — has to agree about distance.

Sprites are then drawn **upright** at the projected position of their feet
([:192-218](../src/render/Diorama.ts#L192)). A receding floor under a straight-on character
*is* the HD-2D signature. In a real 3D engine you would billboard to fake this; here it is
simply how they are drawn — one line, no correction needed.

Two constants control the rake: `TILT = 0.66` and `EYE = 6.5`
([:62-65](../src/render/Diorama.ts#L62)). Tilt 0 would be a flat top-down grid; 1 would put
the horizon mid-frame.

### 2. Tilt-shift

A narrow sharp band with falloff above and below is what tells the eye it is looking at
something *small*. Implemented in `render()` ([:129](../src/render/Diorama.ts#L129)) as: blur a
copy of the finished frame, then stencil it through a vertical alpha ramp with
`destination-in`, then composite. One extra canvas, no shader. The sharp band sits slightly
below centre, where the actors stand.

### 3. Depth haze

`tile()` ([:223](../src/render/Diorama.ts#L223)) fades each tile toward the sky colour by its
projected scale. Cheap, and it does most of the work of selling the ground as receding rather
than merely squashed.

A vignette closes the frame last, over everything.

**The band has to be where the actors are.** It was first written as 0.34–0.62 — across the
middle of the frame, which is where a tilt-shift band belongs in the abstract and is nowhere
near where anything in this scene stands. At Step II the Commander spans **0.285 to 0.714** of
frame height and the beast's feet land at **0.783**, so a fixed mid-frame band put every actor
inside the blur: the subject of the shot was the one thing out of focus.

`FOCUS_NEAR`/`FOCUS_FAR` are 0.6/0.93 now, but only as the fallback for an empty stage and the
clamps that keep some falloff at both edges — the band itself is **derived from the cast** by
`focusBand` ([Diorama.ts:115](../src/render/Diorama.ts#L115)), which is what let Step I dolly in
to `zoom: 3.2` without putting the Commander straight back into the blur. A test projects the
actors at both framings and asserts each one lands inside.

### The camera

Two framings — `SHOT_IDENTITY` and `SHOT_VOW` ([:91-92](../src/app/CharacterCreationScreen.ts#L91)) —
and the camera is always *arriving* at the current one via a framerate-independent
exponential ease ([:199](../src/app/CharacterCreationScreen.ts#L199)):

```ts
const k = 1 - Math.exp(-dt / 260);
this.cam.x += (shot.x - this.cam.x) * k;
```

Step II pulls back and to the right to make room for the beast — from `zoom: 3.2` to `2.2`, so
it is a widening rather than a retreat. Because it eases rather than cuts, changing step reads
as a move. `dt` is clamped to 64ms so a backgrounded tab that resumes after a minute eases in
rather than snapping.

The beast's arrival uses ease-out-back ([`ease()`:513](../src/app/CharacterCreationScreen.ts#L513))
so it overshoots slightly as it lands, and its shadow tightens as it comes down
([Diorama.ts:290-303](../src/render/Diorama.ts#L290)).

`zoom` is a third channel alongside `x`/`y` and exists because `y` alone conflates *how close
the camera is* with *where on screen the subject lands* — push `y` far enough to make the figure
big and its feet slide out of frame before it gets there. `zoom` scales the projection without
moving the subject, which is what lets Step I be both centred and close.

### The sprites are authored art

The two actors on the stage are PNGs, loaded from `public/assets/sprites/` and blitted by
`blit()` ([sprites.ts:112](../src/render/sprites.ts#L112)). Everything else on this screen —
ground, sky, haze, shadows, vignette — is still canvas paths.

| What | Files | Size on disk |
|---|---|---|
| Commander | `hero-{male,female}-{front,side,side-alt,back}.png` | 110×253 to 125×288 |
| Companions | `companions/{id}-{front,side,back}.png`, six species | 101×324 to 308×214 |

Naming is a convention, not a manifest: `commanderSpriteSrc(gender)`
([sprites.ts:50](../src/render/sprites.ts#L50)) and `companionSpriteSrc(id, facing)`
([:152](../src/render/sprites.ts#L152)) build the paths, and the `id` half is a `CompanionDef.id`
verbatim. Both are exported so a **test can compare the path against a directory listing** —
which is the whole class of failure this rewrite introduced and the procedural version could not
have had. A path is a string, a filename is a fact, and nothing but a test compares them; and
because `drawCommander` treats a missing image as "skip this frame", a typo'd path is a silently
empty stage rather than an error.

That test reads the directory rather than calling `existsSync`, because `existsSync` answers
case-insensitively on Windows and macOS. The art arrived as capitalised exports and was renamed
down to lowercase, so a leftover `Ignis-front.png` would pass on every machine here and 404 the
first time it is served from Linux.

**Only the `front` facings are wired up.** Side and back exist for all six beasts and both
bearings; nothing loads them, because both figures stand still and face camera. They are the art
a facing change on the combat board would need, and a test asserts the set stays complete so a
half-delivered species is known about before then.

### Smoothing is on, and that reverses the old rule

The procedural sprite was painted into a small buffer of hand-placed pixels and blown up whole
numbers of times with `imageSmoothingEnabled = false`. That was right for what it governed:
interpolating those marks could only soften something already exact.

This art is not that. It is anti-aliased painted work 250–330px tall, with soft gradients and
sub-pixel linework, and a centred Step I blows it up two to three times once the display's pixel
ratio is counted. In that range nearest-neighbour has no pixel edges to preserve — there are
none in the source — and instead stair-steps every gradient the artist did draw. Bilinear keeps
the drawing and loses nothing that was there, and the diorama's own tilt-shift and haze are
softer than either.

So the rule is now: **match the interpolation to the art, not to the aesthetic.** Pixel art gets
nearest-neighbour; painted art gets bilinear. The board's procedural bodies are unaffected —
they are paths, and paths do not interpolate.

### Both figures agree about their own height

`COMMANDER_HEIGHT_TILES = 1.7` and `COMPANION_HEIGHT_TILES = 1.1`
([sprites.ts:96-97](../src/render/sprites.ts#L96)) are exported because two files have to agree
about them: the blit, and the `height` the creation screen hands its diorama actor so `focusBand`
knows where the head is.

They were separate literals — 1.7 drawn against a declared 1.15 — and the disagreement was
invisible until Step I pulled in close, at which point the sharp band stopped a fifth of a figure
short of the head it exists to keep sharp, and the head itself left the frame entirely. One
constant per body, read by both, is the fix; the tests import them rather than restating them,
which is what stops the same drift recurring.

Each species' art also keeps **its own aspect ratio** rather than being fitted to a box — Voltara
is wider than tall, Sylva the reverse — so a lynx does not end up as tall as a stag.

### The beast fallback is still procedural

`drawCompanion` ([sprites.ts:218](../src/render/sprites.ts#L218)) — one silhouette recoloured per
school, with a lit eye rather than a dotted one — survives as the fallback for a species with no
art yet. Every founder has art, so nothing reaches it today; it exists so that adding a seventh
bloodline renders as *something arrived* rather than as nothing at all.

This is the remains of a deliberate earlier decision, recorded here because the reasoning
changed rather than being wrong: one shape in six colours was enough while what the Vow moment
communicated was *that something arrived, in a colour you just chose*. Six hand-drawn creatures
were called "six promises the combat board would then have to keep" — and the promises have now
been made, so the board owes them.

### Layout

The stage is a full-bleed canvas; the UI floats on it
([`creation.css`](../src/styles/creation.css)). The scrim is two gradients rather than a flat
dim, so body text stays legible without darkening the stage the screen exists to show.

**The one hard rule is that the middle of the frame belongs to the cast.** Step I stands the
Commander dead centre, so the form docks along the bottom under their feet; Step II lands the
beast beside them, so the rail goes left, the card goes right, and the channel between them
stays empty. Both steps leave the sky clear.

That channel is not decoration — **it is what caps `SHOT_VOW.zoom`** (see §3), so widening either
flank crops a beast. The relationship runs the wrong way round for CSS to express: the cast is
sized off frame *height* while the panels are sized off *width*, so as a window narrows the
bodies hold their size and the channel closes on them. Hence a ladder of three breakpoints for
the vow columns (68rem, 56rem, 44rem) rather than one, each measured against where the widest
beast actually lands.

This replaced the previous rule — *figure left of centre, panel on the right* — which is why
nothing in the stylesheet is anchored to a corner any more. Both scrim gradients run vertically
now; the old pair washed the top and the **left**, the left one existing purely to seat that
right-hand panel, and a one-sided wash under a centred figure reads as weather.

Two smaller consequences worth knowing:

- **The header is capped against the viewport** (`min(44rem, 42vw)`), not just in rems. At 44rem
  of prose on a 1280-wide frame the lede would run under the Commander's head.
- **The six school colours are a `--school` custom property** set from `data-school`, read by the
  rail tabs and the featured card for their edge, glow and selected fill. It is a deliberate
  mirror of `SCHOOL_COLOR` in `sprites.ts` — CSS cannot import it — and it replaced six
  near-identical crest rules. Change them together.

Below `44rem` both steps stack: the stage keeps the top of the frame, and the controls become
sheets under it rather than full-screen panels over it.

---

## 5. What signing produces

`initializeNewProfile(slot, look)` ([save.ts:407](../src/app/save.ts#L407)) is the single
writer of a new `Profile`. Everything it decides follows from the look:

| | |
|---|---|
| **Look** | normalised on the way in — the boundary between a screen the player was typing into and a schema everything downstream reads |
| **Name** | the commission is filed under `characterLook.nickname` |
| **Companion** | `tameCompanion(rng, starterCompanion, 1)` — a real roll: constitution, one knack from its bloodline pool, and eight drafted spells |
| **Active** | that instance is `activeCompanionId` |
| **Vanguard unlocks** | `unlockFloor(grantsFor(baseId))` — the universal bodies plus that school's, and **nobody else's** |
| **Warband** | `startingRosterFor(school)` — 9–10 of the 10 points, in the player's own colour |
| **Deck** | 7 colourless Hero cards + 8 drafted elemental = **15** |
| **Ducats** | 0 |
| **Gear** | all five slots `null`; the coat is *owned*, not worn |

`newProfile(slot, name, school)` ([save.ts:359](../src/app/save.ts#L359)) survives as a thin
legacy door onto this, because a couple of dozen tests and the old title flow call it with a
slot and a school.

### The fifteen is the *fused* deck

Worth restating because it is a reading, not an arbitrary number. The Hero Deck is **4–12** by
rule and strictly `['neutral', 'arcane']` by rule — the elemental colour is the Companion's to
bring. So the opening fifteen is seven colourless staples plus the beast's eight, and
`fusedDeckSize()` computes it. The Safehouse door says so out loud —
*"15 cards — 7 yours, 8 the beast's"* — because a number only true in the data is not true.

### Gear starts bare

This reverses an earlier deliberate call (the coat used to arrive worn, so the loadout screen
was not an empty grid). The compromise: the coat is still in the footlocker, just not on. The
screen keeps something to teach, and equipping it yourself is the better first lesson.

---

## 6. Older saves

A v17 profile has no `characterLook`. The migration synthesises one
([save.ts:838](../src/app/save.ts#L838)) from the two facts an old save already holds: the name
on the commission, and the beast currently standing beside them.

A returning player therefore keeps their name and their bloodline and is handed the default
bearing — the honest answer, because nobody ever asked them which one they were.

A save from *after* v17 but before the bitmaps is the other case, and it needs no migration step
at all: it carries `hairPreset`/`facePreset`/`skinPreset`, and `normalizeLook` builds its result
from the three keys it knows rather than copying the object, so the retired three are dropped on
the way in. Deliberately not migrated — there is no sheet to index a haircut out of any more, so
the only faithful answer to `hairPreset: 3` is that the question stopped existing. A test loads
such a save and asserts the look comes back with exactly three keys.

`normalizeLook` runs on the way in either way, so a hand-edited look is repaired rather than
honoured: a blank nickname becomes `Commander`, an unknown bearing becomes one that has a sprite,
and a `starterCompanion` naming a hybrid or a non-discipline is replaced.

---

## 7. The bug this flow already caught

Worth recording, because the fix is the interesting part.

`starterSpecies()` was first written as *"every bloodline that speaks exactly one school"*.
That reads like the founder rule and **is not**. Lexis speaks one school too — and that school
is `arcane`, the Hero Deck's own colour, not a discipline anybody enrols in.

The result was a seventh card on the Vow screen. A player who picked the Ink Owl would have
got a warband with no bodies of its own and a Grimoire in the same colour as the half it exists
to complement. Nothing threw; it just quietly made a bad character.

It was caught by clicking through the real screen in a browser, not by a test — the card list
came back seven long. The fix was to delete the second rule rather than tighten it:
`starterSpecies()` now defers to `SPECIES_BY_SCHOOL`, which already owned the question.

**The lesson, restated as a rule this codebase keeps elsewhere:** two derivations of one fact
drift, and the drift is invisible because both look correct in isolation.

---

## 8. What is tested

[`src/tests/creation.test.ts`](../src/tests/creation.test.ts) — 34 tests.

Coverage: look normalisation (trim, cap, blank, unknown bearing, retired preset keys dropped,
total nonsense); who may be vowed to (six founders, no Lexis, no hybrid, corrections);
`initializeNewProfile` (look stored, name filed, 0 Ducats, bare slots, coat owned, beast rolled
and varied, unlocks scoped, 7+8=15 legal in every discipline); migration (v17 synthesis,
round-trip, a pre-bitmap save loading without its presets, hand-edit repair); the art on disk;
the beast fallback; and the shot.

### It used to be 56, and the 22 that went were the right ones

The largest block in this suite was **twenty-eight sprite tests** asserting that the procedural
painter gave every haircut its own silhouette, put a catchlight in both eyes, shaded a coat in
three discrete bands, kept the value ramp in order, and never erased a hole through the figure.
Every one of those claims was about code that no longer exists.

They were not replaced one-for-one, because there is no honest bitmap equivalent. A `drawImage`
transcript can only report that one image was blitted at one size, and that is not twenty-eight
tests' worth of claim — asserting it would be testing the canvas API. Deleting them is not lost
coverage; it is coverage of a thing that is gone.

Two survived intact, because they test `drawCompanion`, the procedural fallback that is still
there: the beast's eye is *lit* rather than dotted, and each school gets its own colour.

### What replaced them: the failures the bitmaps actually introduced

- **The art on disk.** Every id `starterSpecies()` returns has a front sprite, both bearings do,
  and all three facings exist for all six beasts. Checked against a **directory listing** rather
  than `existsSync`, which answers case-insensitively on Windows and macOS — the art arrived as
  capitalised exports and was renamed down, so a leftover `Ignis-front.png` would pass on every
  machine here and 404 the first time it is served from Linux. A missing file is not an error at
  runtime: `drawCommander` skips a null image, so the failure mode is a silently empty stage.
- **No raw exports under `public/`.** The background-removal sources are ~250KB each, referenced
  by nothing, and everything under `public/` is served. They live in `art-source/` now, and a
  test keeps them out.
- **The crown is inside the frame.** At both framings, for both bodies. This is the test that was
  missing: the suite already checked that the Commander was inside the *focus band* and it
  passed, while the head was 44 pixels above the top of the screen. Feet on screen and body on
  screen are two different claims.
- **The Commander is exactly centred at Step I**, asserted as `x === W / 2` rather than
  approximately, because the camera sits on their own tile and the projection cannot drift.
- **The cast heights are imported, not restated.** `COMMANDER_HEIGHT_TILES` and
  `COMPANION_HEIGHT_TILES` come from `sprites.ts`. The old block wrote `1.15` while the draw code
  blitted `1.7`, and that single duplicated literal is the whole reason a decapitated figure
  passed a green suite.

### The lesson, which is the same one as §7

Two copies of one fact drift, and the drift is invisible because both look correct in isolation.
It was `starterSpecies()` re-deriving the founder rule; it was then an actor height written down
in three places. The fix is the same both times: one owner, everybody else reads it.

---

## 9. Open questions

- **The animation has not been seen in full.** The dev-browser pane used for verification does
  not composite frames, so `requestAnimationFrame` never ticks there. The render path is verified
  by driving `Diorama.render` directly and by pure arithmetic over `projectTile`/`focusBand`. The
  camera pan, the beast's drop and the tilt-shift in motion are **unverified by eye**.
- **`gender` is two values**, and now for a concrete reason: there are two sprite sheets. If it
  should become a bearing/build axis with more entries, the schema takes it without a migration —
  `normalizeLook` is the only gate — but each new value is a pair of PNGs somebody has to draw.
- **Side and back facings are drawn but unused.** Six beasts × 2 and both bearings × 3 frames sit
  in `public/` loaded by nothing. The obvious use is the combat board turning a unit to face the
  direction it moved; the near one is the hero turning toward the beast when the Vow lands, which
  was deliberately left out of this pass because which way `hero-*-side.png` faces has not been
  checked against where the beast stands. `loadCommanderSprite` would need a facing parameter
  mirroring `loadCompanionSprite`.
- **The board and the creator no longer draw the same body.** `BoardRenderer` draws procedural
  prisms out of `shapes.ts`; the creator draws authored PNGs. The old rule — *the creator draws
  its actors the same way the board does, rather than inventing a second visual language the game
  would then fail to live up to* — is currently broken in the direction of the creator being
  better. Either the board grows sprites or the gap stays visible at the first fight.
- **The Commander's art does not react to the Vow.** The procedural version tinted the cloak with
  the vowed school's colour, so the Vow visibly changed what the Commander was wearing; a bitmap
  has no shape left to tint and that was dropped. The ground still tints. Whether the figure
  should is an art question, not a code one.
- **No portrait "slides on".** The brief described a portrait sliding in at Step 1; what shipped
  puts the character *on the diorama* instead, centred and at three-fifths of frame height, which
  serves the same goal more directly. Flagged in case the slide was wanted literally.
