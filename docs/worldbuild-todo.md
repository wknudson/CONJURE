# Worldbuild TODO — placeholder manifest

Every placeholder in the rough-pass build of `11_world_of_azo_and_the_kings_contracts.md`,
in one place, so cleanup never requires re-auditing the world. The matching code comments
all use the marker `TODO(worldbuild):` — grep for it to find each site.

**Convention:** a row is removed when its placeholder is replaced by the real thing. Rows
are grouped by wave; waves not yet built are listed as pending so the doc always shows the
whole remaining surface.

## Wave 1 — clue plumbing (built)

| Where | Placeholder | Standing in for |
|---|---|---|
| `encounters/lamprow.tithe.ts` | `scout_imp` ×2, `marrow_wisp` | the Gutter Crew's kitchen-tool fighters (want their own units/art) |
| `encounters/bonemarket.vermin.ts` | `ember_moth` ×2, `ember_hound` | cinder-wasp drones (want a drone unit) |
| `encounters/bonemarket.vermin.ts` | pyre stock spells | a swarm-flavoured enemy deck |
| `encounters/curfew.breakers.ts` | `shieldbearer` ×2, `scout_imp` | the bread-queue crowd with linked arms |
| `encounters/curfew.breakers.ts` | `turfwar` with `marrow_hound` | the crowd's loose street dogs (want a street-dog unit) |
| `encounters/chalk.road.toll.ts` | stock minions + `ferrum_bound` | farmhand bandits and their working vault boar (want a lighter beast body and bandit units) |
| Crack delivery | street notice modal (`pendingNotice`) | a dedicated aftermath/debrief screen, if one is ever wanted |
| Threat Ledger clue (`bonemarket_vermin`, doc §3.2) | folded into the crack notice text | a real bestiary note ("stomach empty" convention) — bestiary has no notes field yet |
| Wrong-shaped spoils | described in crack text only | spoils that *are* bread/seed-tools would need an item system; ducat pay is unchanged |

## Wave 2 — duels + remaining Novice/Adept + graffiti (built)

| Where | Placeholder | Standing in for |
|---|---|---|
| `encounters/campaign.novice.ts` (`lamplighter_escort`) | stock dusk bodies | laid-off Ellery-pit miners |
| `encounters/campaign.novice.ts` (`debt_collected_minor`) | stock bodies | printers with ink and hooks |
| `encounters/campaign.novice.ts` (`poster_work`) | normal AI + `scavenger` as the lookout | flee-biased bill-sticker AI (no data field for it) |
| `encounters/campaign.novice.ts` (`gutter_dispute`) | `turfwar` marrow-hounds | a genuinely three-sided rival crew (engine is two-sided) |
| `encounters/campaign.adept.ts` (`saltglass_riot`) | stock bulwark bodies | fishermen with driftwood pikes |
| `encounters/campaign.adept.ts` (`night_freight`) | plain fight; wagon is a scenery prop | the doc's prop-destruction win condition (needs an engine objective) |
| `encounters/campaign.adept.ts` (`warrant_of_distraint`) | script chips the most advanced player unit 10/turn | the family throwing stones (want a visual/event for it) |
| `encounters/campaign.duels.ts` | enemy decks are approximated Hero kit | tuned duelist decks (only `novice_duelist`'s is test-enforced) |
| `world.ts` graffiti | three lines hung near door plaques | **Done — see Waves 7 and 8.** The set-dressing pass landed, the wildland waystones with it, and every area now carries a written line: graffiti where there is a wall to paint, a carved waystone where there is not |
| Escort framing (`lamplighter_escort`, `hollow_census`, `night_freight`) | plain fights | actual escort objectives (no escort mechanic exists) |

## Wave 3 — the Master tier (built)

| Where | Placeholder | Standing in for |
|---|---|---|
| `encounters/campaign.master.ts` (`pylon_nine`) | no shock-healing | the doc's "heals from shock — starve it" rule (needs a unit keyword or a unit-damage script hook) |
| `encounters/campaign.master.ts` (`bone_bastion`) | Sovereign fights at footprint 1 | the doc's 2×2 behemoth-class body (only Ignis has a grown form; wants a `sovereign_behemoth_bound`) |
| `encounters/campaign.master.ts` (`relocation_train`) | waves reuse stock unit defs; wagons are scenery props | attackers wearing earlier contracts' identities (reskin system) + protect-the-wagons objective (same engine work as Night Freight) |
| `encounters/campaign.master.ts` (`dynamo_flats`) | freed stock arrives as `ember_hound` | freed foundry-beast variety |
| `encounters/campaign.duels.ts` (`coldwater_duel`) | devour approximated with culls/harvests | a true devour/cascade kit (she has her own beast now — the Cinder Shade) |
| Boss phase gates | 50% purge + adds only (`phaseAtHalf`) | per-boss transformations — no species but Ignis has a grown form |

## Wave 4 — the Summons and the throne room (built)

| Where | Placeholder | Standing in for |
|---|---|---|
| `encounters/the.summons.ts` | monologue compressed into the encounter blurb | a real pre-fight monologue scene (dialogue screen / cutscene) |
| `encounters/the.summons.ts` | the fight begins at the throne | the doc's fightless cheering walk through Highcourt (needs an overworld route beyond the ward) |
| `encounters/the.summons.ts` | Vane's phase-1 body is his Ink Owl (`lexis_bound`) | a Vane-specific dais form/portrait |
| `cards/companionUnits.ts` (`colossus_bound`) | stats mirror `ignis_behemoth_bound` | tuned Colossus kit (smog aura, cascade punishes) |
| `areas/ashfall.ts` graffiti (`DON'T CARRY IT IN`) | ~~always present, on the ward wall by the Vivarium~~ | **Done — see Wave 11.** It is on Highcourt's service wall, on the approach, gated `after: ['bone_bastion']` — which is to say the week the Summons goes up. Ashfall's wall carries a different line |
| Ending | the crack notice is the epilogue | a real ending screen/credits beat |

## Wave 5 — the bestiary closes (built)

Eleven new species: a second mono bloodline for every school, and hybrids for the last five
school pairings. With them, **every one of the 27 species has an in-game acquisition route** —
before this, six existed as data and art with no way to get them but a dev button.

### Sprites to paint

Every new species ships with a **placeholder copied from an existing beast's art**, so the
files exist under their final names and `spriteAssets.test.ts` is honest. Replacing one is a
file overwrite — no code change, no rename, nothing to register.

All under `public/assets/sprites/companions/`, three facings each (`-front`, `-back`,
`-side`):

| File stem | Species | Currently a copy of |
|---|---|---|
| `flue_salamander` | Flue Salamander (pyre) | `ignis` |
| `saltglass_seal` | Saltglass Seal (frost) | `boreas` |
| `conduit_kite` | Conduit Kite (surge) | `voltara` |
| `barrow_jackal` | Barrow Jackal (dusk) | `mortis` |
| `moss_aurochs` | Moss Aurochs (bloom) | `sylva` |
| `quarry_ram` | Quarry Ram (bulwark) | `ferrum` |
| `cinder_shade` | Cinder Shade (pyre+dusk) | `mortis` |
| `winterthorn_elk` | Winterthorn Elk (frost+bloom) | `sylva` |
| `voltbriar_serpent` | Voltbriar Serpent (surge+bloom) | `voltara` |
| `murk_heron` | Murk Heron (dusk+bloom) | `mortis` |
| `dolmen_crab` | Dolmen Crab (bulwark+bloom) | `ferrum` |

### Everything else standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| `encounters/hunts.ts` | twelve hunts built from one `hunt()` spec — one arena shape, 8×8 | hand-built dens per beast, if any of them turns out to want one |
| `data/resonance.ts` | the six second bloodlines share their school's Resonance | their own passives (the table is keyed by `School`; same blocker the ten hybrids have) |
| `data/companionTraits.ts` | five new hybrids get 2 wired knacks each, no `pending` ones | nothing outstanding — but the original nine pending hybrid knacks are still waiting on engine hooks |
| `district/world.ts` (the gate) | ~~the mesh is still a sealed warded gate~~ | **Done — see Wave 13.** Redrawn as a closed, latched, unwarded gate in two leaves. The road half of this row was closed by the eighteen crossings |
| Shiny | tank treatment + a gold tint on the district follower | shiny art per species, and a combat-board tell (the board is keyed by school, not by instance) |
| Hunt cooldown | ten minutes of wall clock, one number for every hunt | per-tier or per-species pacing, if ten minutes turns out to be wrong |
| Hybrid acquisition | each of the fifteen hybrids is bound off one named enemy, once per save | a second route for a player who killed instead of binding (no hybrid is on the hunt rotation) |

## Wave 6 — the wards get people in them (built)

Forty-eight townsfolk across the city and the Middle Ring, from four sheets dropped into
`public/assets/sprites/`. Before this the whole world held **one** NPC — Vex — because
`DistrictScreen` read `props.npcs[0]` and drew it with Vex's art no matter what it said.

The art is explicitly a placeholder pass: it was picked up as-is rather than commissioned to
the game's own spec, and everything below follows from that. Where each figure sits on their
sheet is measured, not authored — see `scripts/measure-folk-sheets.ts` — so redrawing a sheet
is a file overwrite plus `npm run folk:measure`.

### What the art cannot do

| Where | Placeholder | Standing in for |
|---|---|---|
| `render/folk.ts` / all 48 | one **front-facing** drawing each; `actorArtFromOne` hands the same texture to `front`, `back` and `side` | four-view art. A townsperson never shows you their back — they face camera from every angle, which is why `mirrorSide` is off (flipping a front view swaps the bard's lute into his other hand) |
| `district/entities.ts` (`NPC`) | stands, bobs, and turns toward you | anybody who walks. There are no walk frames, so no townsperson can keep a beat the way the Warden does; a market is a market of statues |
| Sheet 1 vs sheets 2–4 | **two art styles in one scene** — sheet 1 is painted like the hero art, the other three are pixel art | one style. Ashfall now puts a painted blacksmith and a pixel cobbler on the same pavement. Filtering is correct per sheet (`sheetFrameTexture`'s `pixelArt` flag) but the seam is a look decision, not a bug |
| `BillboardSprite` `castsShadow` | pixel-sheet folk cast **no** shadow, because their art has one painted in; painted-sheet folk cast a real one | one shadow treatment. Two people standing together can be lit by different rules |
| `alts` sheet | ButcherB and BrewerB genuinely overlap by 112 rows; the seam cut minimises it but Miller carries a stray coin and ButcherB a stray cleaver | figures drawn clear of each other. Only fixable by redrawing the sheet |
| `FOLK_SCALE` (5 entries) | eyeballed height corrections for the figures holding a pole above their head | a measurement. "How tall is the person inside this drawing" is not something the alpha channel knows |
| The `B` variants | eight trades appear twice under near-duplicate art (`butcher`/`butcher_b`, `cobbler`/`cobbler_b`, …), placed in different towns | distinct people. Two towns' cobblers are currently the same cobbler drawn twice |

### What they cannot do

| Where | Placeholder | Standing in for |
|---|---|---|
| `district/dialogue.ts` (`FOLK_LINES`) | one fixed script each, 1–3 lines | **Half done — see Wave 11.** Fourteen of them now have a gated aside keyed off the campaign ledger, including the Census clerk, who was giving away her own contract's reveal. The other thirty-four still say one thing forever |
| The Bonemarket's six traders, Fenwick's innkeeper and brewer | ~~they talk; nothing is bought~~ | **Mostly done — see Wave 12.** Ten stalls across seven areas trade Cores and brews, including the Bonemarket alchemist and Fenwick's innkeeper. The market's other five benches sell food, fish and jewellery, which the game has no representation for at all — see the Wave 12 table |
| All 48 | pure `Interactable`s — no contracts, no clues, no quest state | **Half done — see Wave 10.** Fourteen of them give errands now, through a registry that names *them* rather than `NpcSpec` gaining a field. The other thirty-four still have one fixed line each, and nobody carries a clue |
| Placement | 49 people across 12 areas, hand-placed via `scripts/area-vacancies.ts` | crowds. Two to four to a ward reads as *inhabited*, not as a capital |

### Deliberately not placeholders

Recorded so nobody "fixes" them later:

- **The Wildlands and the Chalk Road are empty on purpose.** The atlas says nothing lives out
  there, and that the Road carries no notices because "the notices are posted where somebody
  is accountable for them". A test pins it.
- **The sheets keep their original filenames**, which are their own manifests. Two contain
  spaces and are `encodeURI`'d; a test pins that too, because a raw space survives the dev
  server and 404s behind a stricter host.
- **The name labels printed under the pixel figures are already cropped out** by measurement,
  not left to be dealt with.

## Wave 7 — the wards get things in them (built)

Five hundred and sixty-four props across all nineteen areas, from a vocabulary of eighteen.

Before this the world had **three** kinds of object in it — a crate, a lamp and a tree — and
every place was assembled from those three. That was the reason a foundry and a barrow field
read as the same place with a different floor, and it was never a count problem: Ashfall
carried thirty-four props and the Caldera carried one, but both were built from the same three
nouns.

The registry is `src/district/dressing.ts`; the geometry is `DistrictWorld.addDressing`; the
pictures are the `make*Texture` factories in `textures.ts`, indexed by `DRESSING_ART`. Adding a
nineteenth kind is one registry entry and one factory — no schema change, no new field on
`AreaProps`, and nothing downstream learns a new name.

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| All eighteen kinds | procedural canvas art, 8–26px, drawn in code | painted or pixelled props. They are drawn blocky on purpose — the environment is pixel art and the actors are painted, and a prop splitting the difference belongs to neither — but a barrel drawn by somebody would still be better than a barrel drawn by `fillRect` |
| `form: 'box'` | only three kinds use it (`barrel`, `sacks`, `haybale`) | more of them. A box wears its picture on all six faces, so it needs art that fills its canvas; everything with a real silhouette had to become a `billboard` instead, and a billboard is a flat plane pretending |
| `scripts/place-dressing.ts` | positions generated by search against the placement rules, from a hand-authored plan of *what* goes where | hand-placed furniture. The plan is authored — the Levels get vats and Bray's Hollow gets hurdles — but which tile each one lands on is whatever the sweep found first, so nothing is *composed*: no stall has its barrels beside it, no cart is parked against a wall |
| Density | one prop per eighteen cells, one number for all nineteen areas | a judgement per area. A market should be denser than a snowfield and currently is not |
| `brazier` | a point light, warm, at 0.8× a gas lamp | fire. It does not flicker, where `updateLamps` already flickers the gaslight |
| `waystone` | carries one carved line, rendered like graffiti | signage generally. There is still no shop board and no notice outside Ashfall. **Conditional text is unblocked** — `GraffitiSpec` takes a `gate` now (Wave 11) and a waystone could take the same one — but no waystone uses it |
| `yaw` | authored per instance, and only `panel` reads it | art with a front. A `box` accepts a yaw and rotates its collider correctly, but its picture is the same on every face, so turning one changes nothing you can see |

### Deliberately not placeholders

- **`collides` is per kind, not per form.** The world already disagreed within a form before
  this — crates collide, trees do not — and the line that matters is mass, not shape.
- **Ground decals are `MeshLambertMaterial`.** An unlit decal glows on a dark street; the
  ground it lies on is Lambert and so is it.
- **`panel` never joins `world.billboards`.** Holding its yaw is the whole reason the form
  exists, and `faceCamera` would overwrite it every frame.

### Fixed in passing

**Every drainage cut in the Tallow Levels was painting as cobbles.** `GROUND_TEXES` has listed
`water` since the canal wards were built and `bakeGround` never had a branch for it, so it fell
through the bare `else`. Invisible in the five areas that declare `waterRows` — `bakeGround`
starts below the canal — and very visible in the Levels, which declare `W: { tex: 'water' }`
with no `waterRows` at all. The area the atlas calls "drained country losing the argument" had
dry paving in its ditches. Now `paintCut`.

The legend test only ever walked legend → `GROUND_TEXES`, never `GROUND_TEXES` → the dispatch,
which is how a green build hid it. **That direction is still unchecked** and is the obvious next
guard.

Three more, all in `district.test.ts`'s spawn-to-exit reachability walk, all pre-existing and
all making the test weaker than it read: the crate collider was hardcoded at `1.1` while
`world.ts` uses `c.size ?? 1.1`; and lamps and the bounty board were absent from the walk
entirely, though both collide. All three now come from the same numbers the world uses.

## Wave 8 — the ground stops being one texture, and every place says something (built)

Two halves of the same complaint: five areas were a single character repeated, and eleven had
nothing written in them at all.

### Ground

Six new paints, and the grids rewritten to use them. The numbers are the share of the grid held
by the commonest character — Ashfall, the only area anyone has called dressed, sits at 29%:

| Area | Before | After | Chars |
|---|---|---|---|
| The Ashwood | `w` 73% of 780 cells | 49% | 5 → 6 |
| The Storm Shelf | `b` 72% | 50% | 5 → 6 |
| The Bone Bastion | `o` 63% | 46% | 5 → 6 |
| The Rimefields | `n` 63% | 49% | 6 → 7 |
| The Caldera | `s` 43%, **two textures total** | 31% | 4 → 6 |

New surfaces: `crust` and `sulphur` (Caldera), `drift` (Rimefields), `litter` (Ashwood),
`barrow` (Bone Bastion), `heath` (Storm Shelf).

The substitutions are **spatial, not random**, and that is the whole of the work. Sulphur blooms
where a vent is; litter lies where the canopy is; heath grows where the pylons are not. The
first cut used a per-tile coin flip and it was wrong in a way worth recording: a 55/45 random
mix of two surfaces does not read as two surfaces, it reads as a **checkerboard**, because the
eye finds the 4-unit grid the moment neighbours alternate. Crust set in sheets, so it wants a
low-frequency field and patches several tiles across.

### Voice

Every one of the nineteen areas now carries a written line, and a test says so.

Graffiti needs a wall, and eleven areas had none — so the split is by what a place has. Four
gained graffiti (Millharrow's toll, the Caldera's tap field, the Storm Shelf's pylons, the
Bastion wall). The rest carry a **carved waystone**, which is what `waystone` holds text for.

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| The six new paints | `fillRect` on a 16px tile, like every other paint in the file | drawn ground |
| `scripts/enrich-ground.ts` | rules that fire once and refuse to run twice | hand-authored maps. The rules are per-area and readable, but no one has laid out a grid by eye since the four original wards |
| Graffiti coverage | eleven areas of nineteen | a line on every wall worth painting. Eight areas have a waystone because they have no wall at all — a hoarding or a gable would give them one |
| Ashfall, Lamprow, the Bonemarket, the Cinderworks, Ward Seven, Highcourt, Fenwick's | untouched by the ground pass | nothing, probably. They already run 6–7 characters at 29–41% dominance, which is what this wave was trying to reach |

### Fixed in passing

`GROUND_TEXES` is now **derived from the dispatch** rather than written beside it. The two had
drifted — the list carried `water` and the if/else chain had no branch for it — and the test
could never have caught it, because it only walks legend → list and the drift was in the other
direction. `PAINTS` is now the single record and `GROUND_TEXES = Object.keys(PAINTS)`, so a name
with nothing drawing it is a type error rather than a ward quietly painted in cobbles.

## Wave 9 — the world stops holding still (built)

Before this, four things in Azo moved: a gas lamp flickered, the canal texture scrolled, a
townsperson bobbed on the spot, and the packs roamed. Nineteen areas of it. Trees were static
billboards and the air was empty — Ashfall is named for what falls on it and none of it fell.

**One hundred and twenty groups of animals** across all nineteen areas (about 260 bodies from
twelve kinds), **six skies** with every area declaring one, **138 plants** from six new
dressing kinds, wind sway on everything that grows, and rises on the canals.

The seven areas with no people in them got the most, which is the point. `district.test.ts` has
always pinned the Wildlands and the Chalk Road as uninhabited, because the atlas says nobody
*lives* out there — and the obvious misreading of that is "these areas are empty", which is not
what it says and left the seven largest maps with nothing moving on them. A second test now pins
the distinction: nobody lives in the Ashwood; things live in the Ashwood.

### The pieces

| Where | What | Note |
|---|---|---|
| `district/wildlife.ts` | the bestiary — twelve kinds, `height`/`speed`/`flush`/`flies` | Same registry shape as `dressing.ts`: one entry plus one texture factory, and nothing downstream learns a name |
| `district/entities.ts` (`Critter`) | the behaviour | Mostly `Pack` with the hunting removed. What it adds is the **flush** — the only thing in the world the player can cause without a consequence attached |
| `district/skies.ts` | six moods, and one `THREE.Points` field | The box **rides the player**; particles are stored as offsets from it |
| `district/sprites3d.ts` (`applySway`) | wind, patched into the stock Lambert shader | One shared `uWind`, so a field of reeds is provably in the same wind as the tree beside it |
| `district/world.ts` (`updateRises`) | expanding rings on the canal | There is no fish. The ring *is* the fish |
| `scripts/place-wildlife.ts` | where all of it stands | Sibling of `place-dressing.ts`, on the same terms: the plan is authored, the coordinates are searched |

### What the tests caught

Four real bugs, three of them invisible on inspection:

1. **Every flying kind was on the ground.** `walker.position` *is* the sprite's position vector,
   and `Walker.step` ends by writing the walking bob into its `y` — so an altitude set before
   `step` was overwritten on the same frame it was applied. It looked exactly like the altitude
   never having been written.
2. **`NPC` had the same bug**, found by the same test and fixed with it. A townsperson stopped
   breathing the moment you walked up to them, because `Walker.face` also ends in `applyFrame`,
   and started again the moment you left.
3. **The Chalk Verge got its plants and no weather at all.** It is the one area file tracked from
   before the rest and it carries CRLF, so the placement script's literal `'  props: {\n'` match
   failed silently on exactly that file. Caught by the test asking every area to declare a
   sky — which is precisely why that test asks rather than defaulting.
4. **The gull is faster than the tunnelling bound**, at 3.6 against a limit of 3.5 — and is
   allowed to be, because it flies and never asks the collider set a question. The first draft
   of the test applied the bound to everything.

A fifth was in the fixture rather than the code, and is worth recording because it cost the most
time: `packAggro.test.ts` drives a `Pack` with `() => 0.5` and gets away with it. A `Critter` does
nothing but consult its roll — `pickTarget` makes twelve attempts at a random bearing, and under a
constant roll those are twelve attempts at *the same bearing*. One blocked point and the animal
stands perfectly still forever.

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| All twelve animals | procedural canvas art, 8–22px, drawn in code | painted or pixelled animals. Drawn to the same rules as the furniture — one light, four tones, an outline — but a fox drawn by somebody would still be better than a fox drawn by `fillRect` |
| Every animal | **one picture, in profile, facing left** | four-view art. A fox seen from the front is the same fox seen from the side, at this size and this distance. `actorArtFromProfile` exists so an animal mirrors where a townsperson must not |
| Every animal | no walk frames, so no gait beyond the `Walker` bob | animals that move like animals. A deer covers ground by sliding, not by walking |
| `flush` | one radius, one reaction, one duration | behaviour. Nothing grazes, nothing looks up, nothing follows anything else — a flock of sheep is six independent sheep who happen to have started together |
| `Critter.pickTarget` | twelve tries then fall back to home | an animal that can be boxed in. Cornered by furniture, it will stand still rather than find a way out — inherited from `Pack`, and rare enough that neither has fixed it |
| `pollen` and `embers` | additive points | anything volumetric. They are motes, not light — a brazier does not glow harder because embers are coming off it |
| The sky | six kinds, one `constancy` each | more weather than "is it doing it". A day is on or off and then a strength; there is no wind picking up, no front arriving, no storm. Two neighbouring wards can have opposite weather with a road between them |
| Sway | one wind vector, one speed, everywhere | wind with a direction. Every plant in the world leans along its own local x, so a gale would look identical in the Ashwood and in Saltglass |
| Rises | a ring on a timer, only where `waterRows` is declared | fish, and water anywhere else. The Levels' drainage cuts and Saltglass's pans are `tex: 'water'` tiles with no animated surface, so nothing rises in them |
| `scripts/place-wildlife.ts` | positions searched against the rules, from a hand-authored plan | composed placement, the same gap `place-dressing.ts` has. No heron is standing *in* a cut; it is standing near one because the sweep found that cell first |

### Deliberately not placeholders

- **The Caldera has moths and nothing else.** That is the statement, not a gap.
- **The Bone Bastion declares `sky: 'none'`.** Still air over the barrows is authored, and the
  test that asks every area to declare one exists so that reads as a decision rather than as an
  omission.
- **The wolf does not run from you.** `flush: 0` on the ground is used exactly once, and one
  animal that stands and watches is worth more than another six that scatter.
- **Flying kinds ignore the collider set.** A rook that had to path round a chimney would spend
  the ward circling its one clear corner.

## Wave 10 — people who can ask you for something (built)

The row Wave 6 left open. Forty-eight townspeople stood in twelve areas with one fixed line
each and no way to want anything, and every task in the game arrived through one board in one
ward.

**Fourteen errands**, four kinds of step, given by fourteen of the forty-eight, paid out of the
purse a contract pays into, and remembered in the save at **v23**.

### The pieces

| Where | What | Note |
|---|---|---|
| `district/errands.ts` | the registry, and the whole conversation rule | The errand names its **giver**, so no area file changed at all — the direction `PackSpec` already points |
| `app/save.ts` (`ErrandLedger`) | `{ done, active }` at v23 | `done` is a ledger like `campaign`; `active` is a slot like `activeEncounter` |
| `core/overworld/run.ts` (`payErrand`) | the payout | Through the same three lines that settle a contract, because there should be one place that knows how to add to a purse |
| `district/hud.ts` (`renderObjective`) | the panel's second tenant | It used to belong to the guided lap and go away for good once that was walked |
| `DistrictScreen.placeErrandMarker` | the cairn or the thing on the ground | A `Hotspot`, the same class the doors use. Only `gather` needed anything new, and it needed a billboard |

### The four steps, and why they cost nothing

Every one of them is something the world could already express, which is the reason this was
affordable at all:

- **deliver** — two crossings and a conversation. The world is nineteen walkable areas with
  eighteen crossings, and the crossings *are* the content.
- **cull** — points at a pack that is already roaming. Satisfied by the pack dying, not by the
  errand having arranged it, so a player who was going that way anyway gets the credit.
- **survey** — a `Hotspot`, unchanged, plus a cairn to find it by.
- **gather** — the only genuinely new object, and it is a billboard beside a `Hotspot`.

### Decisions worth not re-litigating

- **One errand open at a time.** It gives the panel exactly one thing to say, makes "you are
  carrying this" literally true for a delivery, and means a turn-in can never be ambiguous.
- **No Schematics.** The strongest reward in the game and the one gate between a rich player and
  the whole catalogue. Errands are routine income and that must never be.
- **A cull has no marker.** Its quarry is walking about with a vision cone on it; a cairn would
  point at a patch of road the pack had left ten seconds later.
- **The nudge is its own field**, not a re-read of the offer. Repeating the offer verbatim is how
  a player ends up unsure whether they took the job.

### Bugs found in the audit pass, after it was built

Five, and the first three compounded into a soft-lock:

1. **A cull was credited only to the pack that started the fight.** The Combat Ring drags in
   whatever is roaming nearby and `main.ts` puts every one of them on the hunt clock on a win —
   so the errand's pack could die inside somebody else's ambush, vanish from the road for its
   whole ten-minute cooldown, and leave the job open with nothing left to kill.
2. **There was no way to hand an errand back.** One slot, no release valve. Combined with (1),
   an uncompletable errand locked the player out of the entire system rather than out of one job.
   The panel now carries a free `Give it back`, which does not touch `done`.
3. **An errand taken during the guided lap had no UI at all.** The panel has one slot and the lap
   wins it, so the task line and the give-back button were both hidden — a job with nothing on
   screen and no way out. Errands are now held back until the lap is walked, which is also the
   right call for a Commander who has not met the Artificer yet.
4. **The wind sway was not normalised.** `BillboardSprite` is a unit plane sized by `scale`, so
   `position.y` runs 0..1 and squaring it is a weight; a `panel` is built at full size, so an
   awning's ran 0..3 and the square of that is **nine**. Stall awnings and washing lines were
   swinging through most of a metre.
5. **A grouped animal could be born inside a wall.** The per-area test checks the *authored*
   spot, not the jittered ones a `count` produces — and `colliders.move` tests the destination,
   so a body already inside a collider is stuck there in plain view.

### What the tests caught

- **`weather.test.ts` was the combat weather suite** — fog, gale, rain, 297 lines of engine
  rules — and a new district weather module was briefly given the same name and wrote over it.
  Restored, and the module is `skies.ts` now: the engine's `Weather` changes what a card can
  reach and the district's does not, and two of those in one codebase is a trap.
- **CRLF, twice.** Two files here are tracked from before the rest and carry CRLF; a literal
  multi-line search fails on them silently. It cost the Chalk Verge its sky in Wave 9 and cost
  an afternoon here. Every scripted edit now translates its search to the file's own endings.

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| Fourteen errands | thirty-four townspeople still have nothing to ask | a world where most people want something. The registry costs one entry per errand; the writing is the work |
| `ErrandStep` | four kinds | escort, timed, and choose-a-side. The first two need engine work the campaign contracts are also waiting on (`docs` Wave 2's escort row); the third needs somewhere for a choice to be recorded |
| `deliver` | the parcel is implied by the errand state | a quest item. Nothing is in your hands and nothing can be lost, dropped or stolen |
| `gather` | one object, at one authored spot, present only while the errand is open | things that are simply *there*. Reeds you could cut whenever you liked would be a gathering system; this is a marker that looks like reeds |
| Rewards | fixed per errand | pay that scales with a character. A hundred Ducats is a fortune at Novice and a rounding error at Master, and nothing here reads the campaign |
| The lines | fixed scripts, like `FOLK_LINES` | dialogue that knows anything. The Census clerk still says the same thing before and after you walk the Stile, and an errand does not change what its giver says about anything else |
| `after` | used three times, purely for distance | a shape. It gates the two deepest jobs behind one nearer one, and that is all it does — no town has an arc |
| Placement | the survey and gather spots are searched, not composed | a chosen place. The Ashwood's deadfall is wherever the sweep found room, not beside a particular fallen tree |

## Wave 11 — the world reads what you have done (built)

Four rows above, in four separate waves, were all the same missing thing: the district was handed
a `campaign` ledger by nobody and read it **nowhere**. Forty-eight people and every painted wall
in Azo said one fixed sentence for the length of a campaign that is about them.

### The pieces

| Where | What |
|---|---|
| `district/chronicle.ts` | `Chronicle`, `Gate`, `gateOpen`, and the `ASIDES` overlay |
| `map.ts` (`GraffitiSpec.gate`) | a wall can be conditional |
| `world.ts` | a gated-off line is simply not painted |
| `DistrictScreen.talkTo` | errand first, then aside, then the fixed script |

**Two lists and no expression language.** `after` is "all of these have happened", `before` is
"none of these have yet", and between them they buy every shape actually wanted: appears once X
is done, disappears once Y is done, and lives only in the window between. Anything needing more
wants a script, and a script is not what a wall is.

**An overlay, not a field.** `FOLK_LINES` is four hundred lines of prose; teaching every entry to
be a list of gated variants would have rewritten all of it to make a dozen conditional. So the
asides are a separate table keyed by the same script name, consulted first and falling through.
The existing dialogue did not change by a character — the same trade `errands.ts` makes by naming
its own giver rather than adding a field to `NpcSpec`.

### What it found

**The Census clerk has been spoiling her own contract since she was placed.** `hollow_census`
resolves with a page torn out of the roll and the count filed as PLAGUE; her fixed script opens
with *"RELOCATED, it says beside them. LABOUR."* — the crack itself, said to anyone who wandered
past her on the way somewhere else. She now has a guarded `before` aside and only says the reveal
once it is true. Nobody could have seen that without a way to ask "what does she know yet".

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| `ASIDES` | fourteen, across eight areas | the other thirty-four townspeople. The registry costs one entry each; the writing is the work |
| `Chronicle` | one field, `campaign` | the errand ledger, the bestiary, the hunt clock. A neighbour ought to be able to remark that you ran a job for the miller, and the interface is shaped to widen |
| Gated graffiti | one line in the world uses it | walls that change. The mechanism is there and exactly one wall has an opinion that moves |
| Waystones | no gate, though `DressingSpec` could carry one | the wilds reacting. A waystone is the only voice five areas have |
| `asideFor` | first match wins, by file order | priority. Two open asides for one person is decided by which was typed first, which is fine for fourteen and will not be for forty |
| The crack notices | still a modal on the next screen entry | the street saying it. A contract resolves and the world changes silently behind a dialog |

## Wave 12 — street trade (built)

Wave 6's last open row. Every transaction in the game was a door in Ashfall, and the Bonemarket
had six traders who could not trade.

**Ten stalls across seven areas**, in the same overlay the Bounty Board and the Wildlands Gate
already share — the third renderer into one panel, for the reason `openHunts` gives about the
second. **Deliberately not a `Screen`.** Walking *into* the Apothecary is right; it has a counter
and a fitting room. A stall is a person standing in a street, and stepping out of the world to
buy one Core off them would be the interface disagreeing with the fiction.

### The shortage it ends

Reagents had **exactly one source** — a won contract — and no way to convert between the six
schools. A player holding three Pyre Cores and needing a Frost one for a splice had nothing to do
but keep fighting and hope. That is not a shortage; it is a dice roll standing where a decision
should be.

### The map is the price list

Cores are sold **where the ground makes them**. The Cinderworks deals in Pyre because it is a
foundry, Saltglass in Frost because it is a salt flat, Millharrow in Bloom because it is farmland,
the Tallow Levels in Dusk, Bray's Hollow in Bulwark, and a boy under the Lamprow kerb in Surge
with no ledger and no questions. One school each, cheap. The Bonemarket alchemist deals in all six
on one bench and charges for it.

Which makes the geography arithmetic:

| Converting a surplus Pyre into a Frost | Cost |
|---|---|
| Over the counter at the Bonemarket | **87 Ducats**, no walking |
| Cinderworks, then out to the pans | **54 Ducats**, two crossings |

A walkable world should pay for being walked, and until now nothing in it did.

Brews are the second, smaller half: Fenwick's innkeeper, the Millharrow brewhouse and the Ward
Seven bench stock what the Apothecary stocks, dearer (38 Ducats for a tonic against the ward's
25), four crossings from Ashfall. Nobody was ever going to walk back to the ward for a tonic; the
point is that they no longer have to.

### What the tests caught

Nothing — but two of them are worth keeping for what they *could* catch. A stall that pays as
much for a Core as it charges is somewhere a player stands and clicks until they are rich, and it
would look entirely correct in review: two plausible numbers in a table of two-number rows. Worse,
the same hole exists **across** stalls — buy at the cheapest counter, walk it to the best-paying
one — and that one is only visible if you compare every stall against every other, which is
exactly what a person will not do and a loop will. Both are pinned. The current margin is 59 paid
against 79 asked at the tightest pair.

Also pinned: the satchel is checked **before** the Ducats move. `addConsumable` refuses a full
satchel by returning false, and a purchase that debited first would take the money and hand
nothing over — the one failure here a player would rightly call theft.

### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| The Bonemarket's other five benches | grocer, fishmonger, jeweller, stallkeeper, butcher — still talk only | an item system. They sell food, fish and jewellery, and the game has no representation for any of it. Inventing one for flavour goods would be a lot of machinery with no mechanical payoff, so this is recorded rather than padded |
| `StallGoods` | two kinds, `cores` and `brews` | gear, cards, and anything a specialist would keep. The Highcourt tailor and the two cobblers are dressed for a shop they do not have |
| Prices | fixed rates per stall | a market. Nothing moves with supply, the campaign, or what the player has been selling — a stall that had bought four Pyre Cores off you would sensibly stop paying for the fifth |
| `sellRate: 0` on brews | nobody buys a brew back | a fence. Reasonable for a half-drunk tonic and not for a sealed one |
| The keeper's line | one fixed sentence per stall | a shopkeeper who knows you. The `Chronicle` from Wave 11 is right there and no stall reads it |
| Stock | every stall always has everything it deals in | scarcity. A Core Row that had sold out of Frost this week would make the walk to the pans a decision rather than a sum |

## Wave 13 — the hour (built)

### Azo was already a night game, and that decided the whole shape of this

Read the `AMBIENT` table together and it tells you what kind of place this is. Ashfall's sun is
`#9fb2d6`. Ward Seven's is `#a3b6d2`. Highcourt's `#b6c4dc`, Lamprow's `#8c9cc2` — cool blue-grey,
every ward. That is moonlight. There are forty-one gas lamps on the Lamprow High Street and a
lamplighter whose whole line is that he lights them and does not own them.

So this does **not** add a night. Night is what the game already was, and every measured value in
that table survives untouched. What it adds is a **day**, derived from the authored night by one
documented transform.

That direction is the entire safety argument. Those numbers were authored and then measured
against the rendered frame across three passes — including three occasions where an area turned
out near-black and one where the combat grid was found adding 212 of 255 luma to the road. Had the
authored values been treated as noon with night derived from them, every one of those
measurements would have become a number nobody had ever looked at. Instead `ambientAt(amb,
NIGHT_ANCHOR)` returns the authored def **exactly**, and a test pins that at every dark hour.

### The pieces

| Where | What |
|---|---|
| `district/daylight.ts` | the curve, the phases, `ambientAt`, `dayOf`, `lampsAt` |
| `look.ts` (`AmbientDef.day`) | what noon does to a place, where the general answer is wrong |
| `world.ts` (`amb` vs `lit`) | the authored def and the one the scene is wearing, kept apart |
| `save.ts` | `Profile.clock` at **v24** |

**`amb` and `lit` are two different things** and had to be. `amb` is `AMBIENT[id]`, which the
tuning panel binds to and mutates live; `lit` is what the lights are actually set to. Pushing the
panel's edits straight at the scene would mean a nudged fog value snapped the world to midnight,
and deriving `amb` from the hour would mean the panel edited a value overwritten on the next frame.

### The lamps are the payoff

`lampsAt` lags the sun by an hour at each end, so the lamps are lit before the light has entirely
gone and are still up for the first of the morning. That lag is the only thing in the world that
shows a person keeping to a schedule, and it is the reason a clock was worth having at all in a
ward named for lighting.

### Not a wall clock

`hunts` reads a real timestamp because a cooldown is about the *player's* day. This is about the
*character's*, so it moves when they do.

**And it moves while they stand still**, at two game-hours a real minute — a whole day in about
twelve minutes of walking, with the three-hour dawn ramp taking ninety seconds. The first cut
advanced the clock only on a crossing or a fight, which meant the *only* way to see dawn was to
miss it by walking through a door — the exact failure `daylight.ts`'s own header warns about. Now
the light comes up while you are looking at it and the lamps go out while you are standing under
them. A fight still costs a flat hour and a half on top, won or lost, which is the one place the
clock gets to say something rather than merely tick.

### The six places the transform lies about

A single transform over nineteen areas is wrong wherever the place is unusual, and `AmbientDef.day`
is the escape hatch. Every override is somewhere `look.ts` already argued the place was strange:

| Area | Overrides | Why |
|---|---|---|
| Saltglass | sun, ambient | already the brightest place measured, at a mean of 105. Salt at 184 of 255 does most of the work; a common daylight over it makes a white rectangle |
| The Rimefields | sun, ambient, colours | snow at 140, the one area whose night was tuned *downward*. Noon on a snowfield is genuinely blinding |
| Weeping Stile | sun | the tightest map in the game. Daylight there is what gets through the canopy and over the walls |
| The Caldera | fog | the ground *is* the light source, so the sky changes and the floor does not |
| The Ashwood | fog | what makes a wood dark at noon is the green half-light under the timber, not a weaker sun — a colour, not an intensity |

**Four overrides went away while this was being written**, which is the useful part. They were
authored against a first transform that *multiplied* the authored night, and multiplying amplifies
whatever spread the night already had: the Tallow Levels and Saltglass sit at 3.6 and 1.3 because
one has dark marsh underfoot and the other has salt, and scaling both by 2.4 put noon at 8.6
against 2.1 — a four-fold difference in how brightly the sun shines on two fields ten miles apart.

Blending toward **one common daylight** instead compresses the spread rather than widening it,
which is both the better physics and the better picture: the sun at noon is the same sun
everywhere, and what differs is what stands between it and the ground. That change did the work of
four of the six overrides on its own — and revealed that two of them had quietly become pushes
*upward* rather than holds, which is the transform being overruled by a number nobody had looked
at since. A test now refuses an override that raises anything.

It also found a real bug: **the Caldera's noon was dimmer than its midnight.** Its ambient is
authored at 5.8, *above* the common daylight level, because a crater floor is a light source and
the night had to account for it. Every intensity is floored at the night value now.


### The curfew

Three things read the hour now, and the shape of them is the design:

| | At noon | At one in the morning |
|---|---|---|
| A pack's sight | full | **62%** |
| The Warden's sight | full | 80% |
| The Warden's grace | full | **66%** |

**A pack loses nearly twice as much sight as a Warden does**, and that asymmetry is the whole
point. A gutter crew at two in the morning is going by sound and shapes; the Magistracy is funded,
its officers carry a lamp, and the ward's forty-one lamps are lit for them as much as for anybody.

**The grace is the one number that gets *worse* after dark.** `curfew_breakers` has sat in the
campaign since Wave 1 and the world has never had a night-time rule to break — a curfew that
exists only in a contract's blurb is a curfew nobody is under. Being off the pavement after dark
is the offence now: they see you later and they act sooner. Night is a *different* problem rather
than a softer one.

Sidewalk Immunity is untouched at every hour. The rule is about warrants, not eyesight.

### Five of the eight crews keep hours

Not a difficulty knob — a reading of what each crew is *doing*:

| Crew | Out | Because |
|---|---|---|
| Lamprow gutter crew, tithe takers | night | what happens below the kerb happens when the light stops |
| Verge stray dogs, spoil-heap hollows | night | dogs range after dark, and whatever is in the heaps does not come out into the light |
| Chalk Road freight pickers | night | freight moves after dark — there is a whole contract about it |
| **Chalk Road waywatch** | **day** | a waywatch robs carts, carts travel by day, and an empty road pays nothing |
| Chalk scavengers, hedgerow vermin | any | the verge is never entirely safe, which is the lesson it exists to teach |

The waywatch is the interesting one: **the only place in Azo where the sun is the dangerous
time**, and a player can work out why. The tollman's errand that points at them now says to go in
daylight.

A crew that is not out is **not spawned at all**, so the road is genuinely empty rather than
holding something asleep — which keeps the map honest and stops the Combat Ring dragging in
something that is not there. Tests pin that the night and day windows overlap at the edges (an
hour when nothing is out anywhere reads as an empty world), that every crew is reachable at some
hour, and that something is roaming somewhere at every hour of the clock.


### The air reads it too

Every colour in `SKIES` is the **night** colour, on the same convention `AmbientDef` follows, and
`skyDayOf` derives the day. Two rules, pulling opposite ways because the two kinds of mote are lit
differently:

- **Anything emissive fades.** An ember is a small hot thing competing with the sun and at noon it
  loses — down to a fifth of its opacity. That is the reason the Caldera is worth standing in
  after dark.
- **Anything lit from outside darkens**, and this is the counter-intuitive half. Ash is pale at
  night because it is the brightest thing in a near-black frame: the fog sits at a luma of 40 and
  a `#b9b2a6` speck is unmissable. By day that fog is at 142 and the same speck vanishes into it.
  Real ash is dark grey — what makes it visible against a bright sky is being *darker* than the
  sky, not lighter.

Motes also take a cast off whatever is lighting the street, a third of the way at most, so at dawn
the ash picks up the same low warm colour the road does.

**Measuring it caught two failures that every individual number hid.** The first shadow tone left
ash and drizzle at a daylight contrast of **21**, against 139 at night — technically present,
practically gone. And `leaves` came out at **six**: a silhouetted leaf against the Ashwood's
deliberately dark green half-light is the same value as the air it falls through. Leaves now go
the *other* way, brighter than the air, which is what a leaf catching light through a canopy
actually does. Every mote holds 63–83 luma of contrast at both ends of the clock, and a test pins
it against the fog of the area that actually wears each sky.


### They walk a schedule now, not a loop

**The Warden's position is a pure function of the clock.** A blind `(target + 1) % n` loop is
unlearnable: where the Warden will be in thirty seconds depended on where it happened to be now,
which depended on everything that had happened since the screen was built. A timetable is
*knowledge* — at ten past two it is at the north-east post, every day, and a player who has
watched one circuit can plan the next.

That matters here more than in most games, because Sidewalk Immunity is this world's core rule and
the interesting version of it is not "react to a cone" but **"know where the cone will be"**.

A circuit is two game-hours — about a real minute at the street clock's pace — and Ashfall's beat
is forty-eight units, or twenty real seconds at the Warden's walk. So it arrives at each post
*early* and stands about, which is what makes it read as a beat rather than as a thing circling.
`RETURN` now has somewhere honest to go too: not back to where it broke off, but forward to
wherever it should be by now, which is what a person who has been chasing somebody does.

**Crews come on and off shift while you watch.** This was forced by the live clock and is a bug
the previous pass shipped: packs were *skipped at spawn* if it was not their hour, so standing on
the Chalk Road at four in the morning and waiting for the waywatch's window to open would have got
you an empty road until you crossed an area. Every crew is built now and the clock decides who is
working. Their patch also opens out over the first of the window and closes again at the end of
it, so a shift has a shape rather than being a switch.

Three places still treated an off-shift crew as present, and all three were found by asking rather
than by seeing:

1. **It could still ambush you.** `sees()` was guarded but contact is a plain distance check — so
   a crew that had gone home was standing where it was, invisible, and walking through it started
   a fight with something the player never saw. The worst possible version of this feature.
2. **The Combat Ring could drag it in**, putting a body on the grid that nobody had laid eyes on.
3. **The map drew it**, which is worse than drawing nothing — the map is the one thing in this
   game that is meant to be reliable.

`setVisible` and `setOnShift` are deliberately two switches. One is a fight taking the street
away and the other is the hour taking the crew away; folded into a single flag, a fight that ended
at dawn would put a night crew back on the road.


### Somebody lights them now

`lampsAt` fades every lamp in a ward together on one curve. That reads correctly and is a lie:
**nothing dims a gas lamp.** A lamp is lit or it is not, and what changes over an evening is how
many of them somebody has got to yet.

Lamprow has seven lamps in a straight line at z=6, from one end of the map to the other — it is
literally the High Street, and the ward is named for the job. Its lamplighter's fixed line has
always been *"Forty-one lamps on the High Street. I light them. I do not own them,"* said standing
perfectly still while they came on by themselves.

**How many are lit is a function of the hour, and he stands at the boundary** — the next one he
has to deal with. So the row lights from one end behind him through dusk and goes out ahead of him
through dawn, and he walks up the street and back down it over a day *without either direction
being written down anywhere*. Same property the Warden's beat has: watchable, repeatable, and
holding no state that could drift. `NPC.goTo` is the only new machinery, and the interact prompt
follows him for free because `updateInteraction` measures against the live position.

The lag `lampsAt` puts on the sun turns out to be doing real work here, and **I asserted the
opposite and was wrong**: he does not finish before dusk is over. He starts as the light goes and
is still on the last few after full dark — five of seven at 20:00, all seven by 21:00 — which is
what somebody walking a row actually does. Same at the other end: dawn breaks at 04:00 and the row
is still fully lit at 05:00, because nobody puts a street out while it is still dark to save an
hour of gas.

One honest compromise: he is *sent* to each lamp rather than the lamp waiting on him. The clock
decides what is lit, and he catches up. The alternative is a light that waits on a walk, and a man
who fell behind his own schedule would leave a ward dark at midnight.


### Everybody's lamps, and who lights them

The world has lamps in **eleven** areas and had one lamplighter. Ten of the eleven have one now,
and the interesting part is that they are not all the same kind of person — which turned out to be
the honest reading rather than a compromise.

**The five city wards get a municipal lamplighter**, in the same coat: Ashfall, the Bonemarket,
the Cinderworks, Ward Seven and Highcourt. There is exactly one `night_watchman` drawing on the
sheets — halberd and a raised lantern — and all five wear it. Five identical figures across
Jolrek is not the "two towns' cobblers are the same cobbler" problem the Wave 6 table complains
about; it is a **uniform**, and the Magistracy lighting its own streets with its own men in its own
coat is the point. Ashfall's man says as much: *"Every lamp in Jolrek is Magistracy property. So is
the light."*

**The four Ring towns light their own**, because no Magistracy man comes that far out and each
choice says something about the place:

| Town | Who | Why |
|---|---|---|
| Millharrow | the tollman | he keeps the gate on the crossroads, and the lamps *are* the crossroads |
| The Tallow Levels | the tanner | rendering runs late; the yard is the only lit ground out there |
| Saltglass | the pan-wife | she is already up — the pans are worked before dawn |
| Fenwick's Crossing | the innkeeper | a bridge town lit by its inn. An unlit crossing is bad for trade, which is a better reason than a wage |

### And Bray's Hollow refuses

The eleventh has two lamps and gets nobody, and that is **canon that predates the mechanic**. Old
Bray's fixed script has said since the townsfolk landed:

> *"Somebody puts those two lamps out every night. It is not the Magistracy, and they know it."*

Giving the Hollow a lamplighter would be the system contradicting a line the world has been saying
for two waves. A test now pins both halves: every lamp-bearing area has somebody except Bray's,
and Bray's exception is checked against **his own dialogue** — so deleting the line breaks the
test that explains the gap.


### The gate

Wave 5's last open row, and it survived eight waves because **nothing could see it**. A texture
here is a couple of dozen `fillRect` calls into a canvas that only exists in a browser: no type
catches a bad one, no test touched it, and reading the calls tells you the colours and not the
picture.

Getting it right meant first being honest about what the gate **is**. Its collider spans the whole
eight-unit opening, so you do not walk through it — you walk up to it and the exit hotspot takes
you. That is a gate somebody opens, which rules out both obvious answers:

- **Sealed** was the old lie: a glowing cyan ward pinned at the centre, saying Magistracy business
  and not yours.
- **Ajar** would have been a new one, and worse — a visible gap you cannot walk through is the
  picture contradicting the collider, and a player would walk straight into it.

So it is closed, latched, unwarded, and readably a *gate* rather than a wall with bars in it. Three
things carry that, none of which fit in the old sixteen pixels: **two leaves** with a seam down the
middle (a single field of evenly spaced bars is a railing), **hinge straps** on the outer edges
that say which way it swings, and **a latch** across the seam in iron and brass where the ward used
to be. A latch is a thing a person operates. That swap is the whole change.

### A texture you can test

The stub that made this checkable is worth more than the drawing. `makeCanvas` wants `fillStyle`
and `fillRect` and nothing else, so a fake context that records rectangles into a grid renders the
real function exactly, under node — and the *composition* becomes assertable. Six tests now ask
only what the gate has to mean: you can see through it, it is in halves, it has hinges and a latch,
nothing on it glows, and it is not drawn open.

**Two of them were wrong on the first pass**, and running them against the old drawing is what
showed it. "Is there a seam?" asked whether a middle column was mostly clear — which the old sealed
railing passed by accident, because the gaps between its bars are mostly clear too. "Are the edges
solid?" is answered yes by any railing whose outermost bar sits at the edge. Both now test the
shape that *cannot* occur in a field of vertical bars: a column open through the **rails** (the
rails close every ordinary gap, so an opening through them is the space between two separate
objects), and a **horizontal** run of iron at a height where the rest of the leaf is open.

A test that accepts the thing it exists to reject is worse than no test, because it claims coverage
it does not have.


### The air you fight in

`skies.ts` opened with a note that the district sky and the engine's `Weather` were deliberately
independent and that wiring them was the obvious next move. It is wired: **the thing you can see is
now the thing that acts.** It snowed in the Rimefields and a fight there had clear air; ash falls
on the ward that is *named* for it and a marksman could see the length of the street.

Three of the six skies map, and the three that do not are not gaps:

| Sky | Fight | Why |
|---|---|---|
| `ash`, `snow` | **fog** | both are opaque things in the air between you and what you are shooting at, which is what `FOG_VISION` models |
| `drizzle` | **rain** | the same weather under a different name |
| `embers`, `leaves`, `pollen` | nothing | small, sparse, warm, and none of them *between* you and anything. A crater throwing sparks does not blunt a bowshot |

**Nothing produces a gale**, and that is a real limit worth stating: a gale carries a shot
*downwind*, so it needs a bearing, and a sky field's drift is a symmetric wander with no direction
in it. Inventing one would be the mechanical half claiming something the visible half never said. A
gale stays a thing an encounter declares for itself.

Two rules keep it safe, and both are in `groundedEncounter` rather than inline so they can be
tested. The ground **fills a weather in and never overrides one** — an encounter that declares its
own has been authored and, in the campaign's case, balanced against it, since `weather.test.ts`
holds real rules about what fog does to a sightline. And it hands the encounter **straight back**
when it has nothing to add, by identity: `EncounterDef`s are shared registry objects, and copying
one per fight leaves two definitions of the same encounter in play that differ in a field somebody
will later assume is canonical.

### What it comes to, read off the world

| Where a fight can start on its own ground | Sky | Fought in |
|---|---|---|
| Ashfall Ward (a Warden) | ash | **fog** |
| Lamprow (two crews, a Warden) | ash | **fog** |
| The Chalk Verge (three crews) | pollen | clear air |
| The Chalk Road (three crews) | pollen | clear air |

**The city fights in fog and the countryside fights clear**, which is not a shortfall of the
mapping — it is Azo. The smog *is* the city, and every arrest and every gutter ambush now happens
in it. A test asserts exactly that split, off the area files rather than off the table, so opening
a new road re-answers it.

### A sky that stops

The last standing lie about the weather, and the oldest one: **it never stopped.** An area declared
`snow` and it snowed, always, which was a great deal more weather than the world had before and
still meant the Rimefields had been snowing since the world was made and no ward had ever had a
clear night. A place you had seen once, you had seen.

Now it is rolled **per area, per day**, off a hash rather than a save field — a sky is not worth a
migration. That gives determinism for free, which matters more than it sounds: the same place has
the same weather on the same day every time, so walking out of the Bonemarket and back in does not
reroll it. A sky that changed every time you crossed a road would read as a bug, not as weather.

Each kind carries one number, `constancy`, which is roughly the share of days it is doing anything:

| Sky | Constancy | Why |
|---|---|---|
| `embers` | 0.95 | a crater vents whether anybody is watching |
| `snow` | 0.75 | most days, up there. Not all of them |
| `leaves` | 0.7 | wind-dependent, and the wood has only so many left to give |
| `ash` | 0.6 | depends which way the wind is off the Cinderworks, and some days it is off somewhere else |
| `drizzle` | 0.55 | the most changeable thing in the world, which is what rain is |
| `pollen` | 0.5 | half the days, and only the still ones — it does not hang about in a breeze |

Three decisions in it are worth keeping, because in each case the obvious version was wrong:

**It thins, it does not fade.** `setStrength` cuts `drawRange` to a prefix of the field, so fewer
flakes fall and the ones that do are at full strength. Fading them instead gives a sky of faint
smears, which is not what less snow looks like. The motes are scattered independently, so any
prefix is still a fair scatter over the whole box — there is nothing to choose. A clear sky costs
nothing per frame: `update` returns immediately, and the weather coming back is one call rather
than a rebuild.

**A day holds.** The first cut lerped continuously from one midnight to the next, which sounds
gentler and is much worse — every noon sat exactly halfway between two days, so a clear day was
never clear, it was half of yesterday's snow all afternoon. A day has to be able to *be* a kind of
day. The roll is flat from 02:00 to 22:00 and hands over across the four hours between, which is
two real minutes at the street clock's rate: long enough to stand in, and in the small hours when
there is nobody on the road to watch it happen.

**And a day it is falling is never barely falling.** A roll under the constancy is stretched back
over 0.4 to 1.0. A hundred flakes reads as a renderer struggling rather than as light snow.

The fight inherits it *only when it is coming down* — `FIGHT_WEATHER_FLOOR`, 0.45. Fog shortens
every sightline on the board, and charging that for a few drifting flakes would be the ground
overstating what the player can see out of the window. So the table two sections up now has a third
column that says **most days**: the Rimefields fight in fog on a snowing day and in clear air on a
clear one, which is the whole point stated as one sentence — the weather you can see is the weather
you fight in, *including when there is not any*.

#### The clock stopped wrapping

`Profile.clock` counted hours and threw the day away every midnight. The sky needs the day, so it
does not do that any more.

**No save version.** Every clock a v24 file holds is a number between 0 and 24, which is already a
valid reading of a counting clock — it means day zero. There was nothing to migrate, and nothing
else broke, because every consumer of the *hour* already takes it modulo a day: `daylightAt`,
`phaseAt`, `clockLabel`, and `beatPostAt` off a two-hour beat that divides one. A negative clock is
still refused, since that is a corrupt file rather than day minus one.

#### The hash that had to be redone

Worth recording, because reading the code will not tell you and a test now holds it. The first roll
hashed `${areaId}:sky:${day}` with `hashText` and took the float straight off it. FNV-1a is a good
string hash, but consecutive days differ only in the final byte and the float comes off the *top*
bits, which that byte barely reaches. The result was weather in ten-day blocks, and Bonemarket and
the Cinderworks had — byte for byte — the same month. That is not four wards under one sky; it is
one ward drawn four times.

The area is now hashed once for its name, the day folded in by the golden-ratio constant, and the
pair run through `nextFloat` — mulberry32's finalizer, which exists to avalanche exactly this. Over
eight thousand days the clear-day rate lands within a percentage point of every kind's stated
constancy and the on-day strengths are flat across their range.


### What is still standing in

| Where | Placeholder | Standing in for |
|---|---|---|
| **All of it** | **never seen** | the Browser pane has been closed for this entire session. The day is arithmetic and tests; not one hour of it has been on a screen, and the six overrides above are *reasoned* from the notes rather than measured against the frame like everything else in that table |
| `daylight.ts` | one curve for the whole world | latitude, season, weather. Dawn breaks at 04:00 in the Rimefields and in Jolrek on the same schedule |
| The sky | ~~does not read the hour~~ | **Done — see below.** Motes take a cast off whatever is lighting the street, the emissive ones fade by day, and the lit ones go to silhouette |
| The lamps | ~~intensity only~~ | **Done — see below.** Lamprow's seven come on one at a time behind a man walking the High Street. The other eighteen wards still fade on the curve, because nowhere else claims somebody whose job it is |
| The Warden's beat | one circuit, same posts at every hour | a night beat and a day beat. It walks the same rectangle at four in the morning as at noon, only slower to be seen doing it |
| The lamplighter | ~~one ward~~ | **Done.** Ten of the eleven lamp-bearing areas have somebody walking the row. The eleventh is Bray's Hollow, which refuses on purpose |
| His round | he is sent to each lamp; the clock decides what is lit | a man the light waits on. Walk beside him and the lamp ahead is already burning before he reaches it |
| A crew's shift | appears and disappears at the window edge | walking on and off. They arrive by existing, which the overlapping windows hide at dawn and dusk and nothing hides if you are looking straight at one |
| Packs and the Warden | ~~do not read the hour~~ | **Done — see below.** Sight scales with the light, the Warden's grace shortens after dark, and five of the eight crews keep hours |
| `Chronicle` | does not carry the hour | dialogue that knows what time it is. The asides landed one wave ago and nobody can say "you are out late" |
| Shadows | one sun angle | the sun tracks the player (`trackSun`) but never moves across the sky, so noon and dusk cast the same shadow in the same direction |

