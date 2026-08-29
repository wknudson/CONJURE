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
| `world.ts` graffiti | three lines hung near door plaques | a proper set-dressing pass (more walls, wildland waystones in later waves) |
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
| `areas/ashfall.ts` graffiti (`DON'T CARRY IT IN`) | always present, on the ward wall by the Vivarium | the same line on Highcourt's last safe wall, appearing only late-campaign. **Half unblocked:** Highcourt is a walkable area now, so the approach it was waiting for exists; what is left is that the world does not read campaign state |
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
| `district/world.ts` (the gate) | the mesh is still a sealed warded gate, though you walk straight through it | a gate that reads as passable. **Half done:** the row also asked for "a road leaving the ward", and there are eighteen crossings now — only the mesh still says sealed |
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
| `district/dialogue.ts` (`FOLK_LINES`) | one fixed script each, 1–3 lines | dialogue that knows anything. The same blocker as the graffiti row above — the world does not read campaign state, so the Census clerk says the same thing before and after you walk the Stile |
| The Bonemarket's six traders, Fenwick's innkeeper and brewer | they talk; nothing is bought | shops. Every trade in the game is still a door in Ashfall, so a market with traders who do not trade is set dressing that argues with itself |
| All 48 | pure `Interactable`s — no contracts, no clues, no quest state | people who can start something. `NpcSpec` has `art`, `label` and `says` and nothing else; a hook comparable to `EncounterScript` would be the next thing it wants |
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

