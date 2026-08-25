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
| `world.ts` graffiti (`DON'T CARRY IT IN`) | always present, on the ward wall by the Vivarium | Highcourt's last safe wall, appearing only late-campaign (world does not read campaign state) |
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
| `district/world.ts` (the gate) | the mesh is still a sealed warded gate, though it now opens onto the hunts | a gate that reads as passable, or a road leaving the ward |
| Shiny | tank treatment + a gold tint on the district follower | shiny art per species, and a combat-board tell (the board is keyed by school, not by instance) |
| Hunt cooldown | ten minutes of wall clock, one number for every hunt | per-tier or per-species pacing, if ten minutes turns out to be wrong |
| Hybrid acquisition | each of the fifteen hybrids is bound off one named enemy, once per save | a second route for a player who killed instead of binding (no hybrid is on the hunt rotation) |
