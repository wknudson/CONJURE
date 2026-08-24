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
| `encounters/campaign.duels.ts` (all three) | `umbra_bound` companions | each duelist's own beast |
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
| `encounters/campaign.duels.ts` (`coldwater_duel`) | `umbra_bound` companion; devour approximated with culls/harvests | her own beast and a true devour/cascade kit |
| Boss phase gates | 50% purge + adds only (`phaseAtHalf`) | per-boss transformations — no species but Ignis has a grown form |

## Wave 4 — the Summons, the monologue, the throne room, the Colossus (pending)
