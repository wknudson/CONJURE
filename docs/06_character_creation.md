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
  ├─ Step I — The Applicant                  identityPanel()          :201
  │    nickname · bearing · hair · face
  │    (nothing written; fully reversible)
  │        │  "Take the Vow"
  │        ▼
  ├─ Step II — The Vow                       vowPanel()               :301
  │    six bloodlines; camera pans; beast drops in
  │        │  "Bind <name>"                  onCreate(look)           :322
  ▼
initializeNewProfile(slot, look)             src/app/save.ts:385
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

One object, five fields, defined in [`core/data/characterLook.ts:21`](../src/core/data/characterLook.ts#L21):

```ts
export interface CharacterLook {
  nickname: string;
  gender: 'male' | 'female';
  hairPreset: string | number;
  facePreset: string | number;
  starterCompanion: string;   // a CompanionDef.id — 'ignis', 'boreas', …
}
```

It hangs off `Profile.characterLook` ([save.ts:230](../src/app/save.ts#L230)) and is the reason
`SAVE_VERSION` is **18** ([save.ts:81](../src/app/save.ts#L81)).

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
| Text input | `nickname` | trimmed, capped at `NICKNAME_MAX` = **18** ([characterLook.ts:69](../src/core/data/characterLook.ts#L69)) |
| Two-button toggle | `gender` | `female` \| `male` |
| ‹ › cycler | `hairPreset` | 6 presets ([characterLook.ts:40](../src/core/data/characterLook.ts#L40)) |
| ‹ › cycler | `facePreset` | 4 presets ([characterLook.ts:55](../src/core/data/characterLook.ts#L55)) |

Built by `identityPanel()` ([:201](../src/app/CharacterCreationScreen.ts#L201)); the cyclers
come from one shared `cycler()` helper ([:272](../src/app/CharacterCreationScreen.ts#L272)).

### The design: the sprite *is* the preview

The single most important decision on this screen is that there is **no preview box**. The
Commander stands on the diorama from the first frame, at `HERO_AT`
([:61](../src/app/CharacterCreationScreen.ts#L61)), and `drawCommander` reads the look at draw
time rather than from a cached bitmap ([sprites.ts:42](../src/render/sprites.ts#L42)). Clicking
"next hair" changes the figure on the map on the very next frame.

That is why the step is called *The Applicant* rather than *Appearance*: the player is
looking at a person standing in a place, not at a form with a portrait beside it.

### Why six hairs and only four faces

Both counts are chosen against the size the sprite actually renders at. Hair is authored as
**silhouettes** — `crop`, `mane`, `braid`, `topknot`, `shorn`, `wild` — because a silhouette
is what survives being drawn ~40px tall and then tilted back into a diorama. "Layered bob"
and "textured bob" would not read across a room; a topknot does.

A face at that scale is three marks, so there are four of them. Six would be a choice the
player cannot see themselves having made.

Each preset also moves a **tone**: hair colour by `HAIR_TONES`
([:63](../src/core/data/characterLook.ts#L63)), skin by `SKIN_TONES`
([:66](../src/core/data/characterLook.ts#L66)), indexed off the same number. Shape is what
reads at distance; tone is what makes two silhouettes feel like different people.

### Two small rules worth knowing

**The default look is fixed, not rolled** ([`defaultLook()`:80](../src/core/data/characterLook.ts#L80)).
The first thing a player sees has to be the thing their first click changes. A randomised
opening state makes "next hair" read as "reroll".

**Cycling wraps in both directions** (`clampPreset`, [:134](../src/core/data/characterLook.ts#L134)).
A player who overshoots the hair they wanted should be able to go back one rather than around
five. The same modular arithmetic is what makes a hand-edited `hairPreset: 900` land on a real
haircut instead of an undefined sprite.

### The nickname is held raw and normalised on commit

The input handler stores what was typed, capped at length, and nothing else
([:224-229](../src/app/CharacterCreationScreen.ts#L224)). Trimming happens when the player
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

Six cards, one per discipline, from `starterSpecies()`
([characterLook.ts:154](../src/core/data/characterLook.ts#L154)):

| Discipline | Bloodline |
|---|---|
| Pyre | Ignis |
| Frost | Boreas |
| Surge | Voltara |
| Bulwark | Ferrum |
| Dusk | Mortis |
| Bloom | Sylva |

`starterSpecies()` defers to `SPECIES_BY_SCHOOL`
([pools.ts:179](../src/core/data/pools.ts#L179)) rather than deriving its own answer. That
deferral is load-bearing and was learned the hard way — see §7.

### Each card shows what enrolling actually buys

`vowCard()` ([:337](../src/app/CharacterCreationScreen.ts#L337)) reads every number from the
same place the profile will read it, so nobody is promised eleven spells and handed nine:

- **`8 of N spells`** — `GRIMOIRE_SIZE` drawn from `SPELL_POOLS_BY_SPECIES`
- **`N bodies`** — `MINIONS_BY_SPECIES`, the Vanguard unlock this Vow grants
- **`15-card deck`** — `fusedDeckSize(STARTER_DECK.length)`
- **the opening warband, named** — `startingRosterFor(school)` ([pools.ts:246](../src/core/data/pools.ts#L246))

What is deliberately **not** shown is *which* eight spells this beast will know. That is the
roll, and spoiling it would make the first tank in the Vivarium a formality.

### Picking is not signing

`vow()` ([:371](../src/app/CharacterCreationScreen.ts#L371)) drops the beast onto the stage,
tints the ground, and enables the button. It does **not** create anything. Signing does
([:322](../src/app/CharacterCreationScreen.ts#L322)).

Separating them is the whole point of the step: a player can try all six, watch each one
arrive in its own colour, and change their mind. Re-picking resets `beastEntry` to 0 so the
arrival animation replays — it is a thing that happens each time, not only the first.

The button reads **"Bind Ignis"**, not "Confirm". The name of the animal you are about to be
stuck with is the last thing you read before you commit.

---

## 4. The HD-2D staging

The aesthetic target was Octopath/Triangle Strategy: 2D sprites on a tilt-shifted 3D
diorama. This project has **zero runtime dependencies** and no art assets, so none of that
could come from an engine. It turns out not to need one — the look is three specific tricks,
all reachable from a 2D canvas ([`src/render/Diorama.ts`](../src/render/Diorama.ts)).

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
near where anything in this scene stands. The Commander spans **0.68 to 0.81** and the beast
lands at **0.88**, so every actor sat inside the blur: the subject of the shot was the one
thing out of focus, and it was erasing the sprite's finest marks — the brass collar measured
zero pixels on the live canvas against 48 in an unblurred probe. `FOCUS_NEAR`/`FOCUS_FAR` are
0.6/0.93 now, and a test projects the actors and asserts they land inside.

### The camera

Two framings — `SHOT_IDENTITY` and `SHOT_VOW` ([:65-66](../src/app/CharacterCreationScreen.ts#L65)) —
and the camera is always *arriving* at the current one via a framerate-independent
exponential ease ([:141-144](../src/app/CharacterCreationScreen.ts#L141)):

```ts
const k = 1 - Math.exp(-dt / 260);
this.cam.x += (shot.x - this.cam.x) * k;
```

Step II pulls back and to the right to make room for the beast. Because it eases rather than
cuts, changing step reads as a move. `dt` is clamped to 64ms so a backgrounded tab that
resumes after a minute eases in rather than snapping.

The beast's arrival uses ease-out-back ([`ease()`:395](../src/app/CharacterCreationScreen.ts#L395))
so it overshoots slightly as it lands, and its shadow tightens as it comes down
([Diorama.ts:200-210](../src/render/Diorama.ts#L200)).

### The sprites are lit, not flat

Three marks do the work, and all three are value rather than detail — which is the only
thing that survives at this size:

- **The coat is two panels, not one fill.** A lit side and a shadow side split down the
  centre line ([sprites.ts:60-88](../src/render/sprites.ts#L60)). One value break tells the
  eye there is a body under the cloth turning away from the light.
- **The ink line is not black.** `RAMP.coatInk` sits *below* the shadow panel but near it.
  An outline darker than the form reads as a void and flattens the very break it surrounds.
- **A rim light down the lit edge**, head to shoulder, at 55% alpha
  ([:112-124](../src/render/sprites.ts#L112)). This is the single highest-value mark on the
  figure: a bright edge is what separates "a lit form standing in a place" from "a sticker
  on a background", and it is two strokes.

Plus a hairline shadow under the cap — two tones of similar value sit flat against each
other whatever their hue, and one arc separates hair from head better than the colour
difference does — and a highlight along the top edge of the brass, because metal is a value
gradient or it is a triangle painted gold.

The beast's eye is the one lit thing on the Companion: `shadowBlur` in its own element
colour makes it a *source* rather than a dot, which sells the silhouette as a creature with
something burning inside it.

Measured on a 200×200 probe: the figure's luminance now spans **22 → 202**, where the flat
coat topped out around 148 with no mid-tone break in the garment at all.

The ramp is exported as `RAMP` ([sprites.ts:26](../src/render/sprites.ts#L26)) so the
ordering rule — ink under shadow under lit, rim brightest — is tested against the real
values rather than against a copy pasted into an assertion.

### They are pixel sprites, not vector art

The largest single change, and it is not about the drawing. The figure is painted into a
**34×44 buffer and blitted up with `imageSmoothingEnabled = false`**
([sprites.ts:128](../src/render/sprites.ts#L128)). Smooth anti-aliased curves at final size
read as vector illustration however well they are lit, and no amount of extra shape detail
fixes that; quantisation is most of the HD-2D look. Most of the body is axis-aligned
`fillRect` on integer coordinates, which is the pixel-art idiom and the reason a 2px forearm
stays a crisp 2px forearm.

Buffers are cached on the look, since they are identical every frame until the player clicks
something.

### The figure has a body

Proportions are **1:4**, head to height. An earlier pass pushed them to 1:5.3 chasing
anatomical realism, and that is the wrong idiom: the reference sprites — and every 16-bit
RPG sprite — carry big heads precisely because the head is where the identity lives and a
realistic one has no room for a face. At 44 art-pixels the head came out 4px across and the
eye dots were **0.6px**: drawn, sub-pixel, and invisible, which is why the sprite read as
facing away when it had been facing forward all along.

The body now breaks into parts rather than being one continuous shape:

- **A neck** — skin between the chin and the collar, measured off the *head* rather than a
  landmark of its own. A landmark looked right and drew a hole (see below).
- **Arms held a pixel clear of the torso**, with a forearm that steps outward so the limb
  has a bend. They were previously drawn at `-shoulder - armW + 1` — overlapping the body by
  a pixel, so the silhouette never actually broke.
- **Two legs with a gap between them**, in a warm dark that is a different hue family from
  the blue coat, under **boots that are lighter than the trousers** — both the width and the
  value jump are what make a boot read as a separate thing.

### The palette

Four hue families carry real area now, where the whole ramp used to sit inside a narrow
navy-slate spread — coat `#3D4A60`, cloak `#3B3A6B`, trousers `#3A3550`, which is four
garments in one hue and reads as a monochrome silhouette however carefully each is shaded.

The coat is shaded in **three discrete bands**, not two and not a gradient: pixel-art shading
is banded because a smooth ramp turns to mud once quantised, and the middle value is what
carries the turn of the form when there are only a few pixels to say it in.

A test asserts every pair of big garment blocks separates by **hue or by value**. That rule
took two attempts — the first demanded 45° of hue between every pair and failed on
crimson-against-brown at 40°, which is a real adjacency in hue and a perfectly legible pair
on screen because the two are far apart in value. Demanding the wrong separation moves
colours to satisfy a number rather than to be read.

### The old body notes

Proportions were rebuilt against the reference: roughly **one head to five**, where the
sprite had been nearer one to three and a half. A stubby figure reads as a mascot no matter
what is drawn on it. The landmarks live in one table (`Y`) so they can be argued about.

It also has arms, hands, legs and boots, which it previously did not — it was a trapezoid
with a head on it, and arms are what make a silhouette a person. And a **cloak** behind the
body in a contrasting hue, which every figure in the reference has: it is the largest colour
region on the sprite, and it takes the vowed school's colour, so the Vow visibly changes what
the Commander is wearing.

Measured on a real canvas at 90 units: a 48×104 body, 502px of cloak, 314px of boot, 104px
of leg, 72px of hand — all of the latter absent before.

### One lesson, learned three times

At 44 art-pixels a mark is **axis-aligned and near-opaque, or it does not exist**. Three
separate marks had to relearn this:

| mark | as first written | measured | fixed to |
|---|---|---|---|
| brass collar | 3px triangle | **0 px** | 2px `fillRect` bar → 48 px |
| rim light | 1px stroke @ 55% alpha | **28 px** on a 48×104 body | 1px `fillRect` @ 85% → 613 px |
| `shorn` hair | `destination-out` erase | 782 px *hole* | tighter cap → 0 |
| eye dots | `headR * 0.15` | **0.6 px** | floored at 1px radius |
| the neck | `yChin + headR` | negative height, **2px hole** through the figure | anchored to `yChin` |
| the mane | `headR * 2.2` below the crown | buried neck **and** collar | pulled to `1.45` |

### Why the sprites are canvas shapes

Every body on the combat board is canvas shapes out of `palette.ts`. The creator draws its
actors the same way rather than inventing a second visual language the game would then fail
to live up to. A player who builds a topknot here sees the same topknot in a fight.

The **companion** is one silhouette for all six bloodlines, recoloured by school
([sprites.ts:208](../src/render/sprites.ts#L208)). This is deliberate: what the Vow moment
communicates is *that something arrived, in a colour you just chose*. Six hand-drawn creatures
would be six promises the combat board would then have to keep.

### Layout

The stage is a full-bleed canvas; the UI floats on it
([`creation.css`](../src/styles/creation.css)). The Commander stands slightly left of centre,
so the panel lives on the right and the lower third stays clear. The scrim is two directional
gradients rather than a flat dim, so body text stays legible without darkening the stage the
screen exists to show.

---

## 5. What signing produces

`initializeNewProfile(slot, look)` ([save.ts:385](../src/app/save.ts#L385)) is the single
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
silhouette — the honest answer, because nobody ever asked them what their hair looked like.

`normalizeLook` runs on the way in either way, so a hand-edited look is repaired rather than
honoured: a blank nickname becomes `Commander`, `hairPreset: 900` wraps to a real haircut, and
a `starterCompanion` naming a hybrid or a non-discipline is replaced.

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

## 8. What is tested, and one thing that nearly was not

[`src/tests/creation.test.ts`](../src/tests/creation.test.ts) — 45 tests, all 36 deliberate
mutations of these rules confirmed to fail the suite.

Coverage: look normalisation (trim, cap, blank, wrap, string-form indices, total nonsense);
who may be vowed to (six founders, no Lexis, no hybrid, corrections); `initializeNewProfile`
(look stored, name filed, 0 Ducats, bare slots, coat owned, beast rolled and varied, unlocks
scoped, 7+8=15 legal in every discipline); migration (synthesis, round-trip, repair).

### The sprite tests

There is no DOM and no canvas in the test environment, so the sprite tests hand the drawing
code a **recording context** ([creation.test.ts:287](../src/tests/creation.test.ts#L287)) — an
object implementing enough of the 2D API to run, which writes down each call. The transcript
is what the assertions compare.

That is a better test than a pixel diff: *"a topknot draws a different shape than a crop"* is
the actual claim, and it survives somebody nudging a colour.

**It also nearly lied.** The first version compared the full transcript — including
`fillStyle`. But hair tone and skin tone are indexed by the *same* preset number, so six
haircuts could have collapsed to **one shape in six colours** and the colours alone would have
kept the transcripts distinct. A mutation that pinned every head to `crop` went completely
unnoticed.

The fix was [`shapeOf()`](../src/tests/creation.test.ts#L343), which strips every colour line and compares geometry only, plus a
separate test asserting the tones vary. Two claims, tested separately, because they are two
claims.

---

## 9. Open questions

- **`shorn` used to cut a hole in the world.** It drew the shared hair cap and then erased a
  disc out of it with `destination-out` — which does not remove "the hair", it removes
  pixels, and the sprite is drawn straight onto a diorama that already has sky and ground on
  it. A Shorn Commander arrived with a bite taken clean through their skull and the landscape
  behind it: **782 transparent pixels** on a 200×200 probe against zero for every other
  preset. Fixed by giving each style its own cap radius (`HAIR_CAP`) so nothing erases; a
  test now asserts no style emits `destination-out`.
- **The animation has not been seen.** The dev-browser pane used for verification does not
  composite frames, so `requestAnimationFrame` never ticks there. The render path was verified
  by driving `Diorama.render` directly and hashing pixels — seven look variants produced six
  distinct images, the one collision being two configs that are genuinely the same look. The
  camera pan, the beast's drop and the tilt-shift in motion are **unverified by eye**.
- **`gender` is two values.** It is what the brief specified and what the silhouette
  meaningfully distinguishes (shoulder width, coat flare). If it should be a bearing/build
  axis with more entries, the schema takes it without a migration — `normalizeLook` is the only
  gate.
- **The companion silhouette is one shape.** Intentional for now (§4). If bloodlines should be
  visually distinct at the Vow, that is six sprites' worth of authoring, and the combat board
  would want them too.
- **No portrait "slides on".** The brief described a portrait sliding in at Step 1; what
  shipped puts the character *on the diorama* instead, which serves the same goal more
  directly. Flagged in case the slide was wanted literally.
