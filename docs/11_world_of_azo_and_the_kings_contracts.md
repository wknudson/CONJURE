# 11 — The World of Azo, and the King's Contracts

The plot, the continent it happens on, and the thirty contracts that carry it. This is a
design document: nothing in it ships as code, and every fight described below is specified
using only vocabulary the engine already has (`EncounterDef` in
`src/core/data/encounters/registry.ts` — terrain, weather, currents, marrow geodes,
scavenger, turfwar, vanguard, wagers, `subjugationPrize`, and `EncounterScript` hooks).

> **A naming note, in the tradition of `03_rpg_sandbox.md`'s.** The regime is **the
> Magistracy** — the name the code already uses (`bounties.ts`, the district's dialogue:
> *"the Magistracy does not argue with what it finds"*). This document names its head:
> **Lord Magistrate Vane**. The capital is **Jolrek**; the continent is **Azo**. Ashfall
> Ward, already shipped as the hub district, is a ward *of Jolrek*.

---

## 1. The premise

The player is a Whisperer taking contracts off the Bounty Board — for the crown, at first
without knowing it, because every board in every ward clears through Dispatch and Dispatch
clears through the Spire. The work escalates exactly along the tiers the game already has:
Novice work in Jolrek's gutters, Adept work on the roads and farm towns, Master work in the
wildlands against the great beasts. Alongside the contracts runs the duelist ladder —
countryside duelists, city duelists, and finally the King's Duelists — as the measure of
the player's growing strength and infamy.

The twist, seeded from the first contract and never once announced: **the jobs are the
crime.** The bandits are the people the crown starved. The rampaging beasts are the
evicted tenants of the land the Conduit Works drilled. The saboteurs are Whisperers who
worked it out first. After the last contract, Vane says his plan aloud — complete — and
the finale is a throne-room duel that ends not in an execution but in a **Rite of
Subjugation** performed on his war engine: the instrument he built to license the wild,
turned on its owner.

### How the truth is hidden

Four layers, all skippable, all convergent. A player who reads everything can call the
twist by mid-Adept; a player who reads nothing still gets the full reveal in the throne
room, and loses nothing but the pleasure of having known.

1. **Graffiti in safe zones.** Sidewalks suppress combat, so they are where a player
   *reads*. Jolrek's gutters: `THE ENGINES EAT OUR MARROW`. `THE CENSUS COUNTS DOWN`.
   `VANE'S LIGHT IS OUR DARK`. Late game, on wildland waystones, the same handwriting as
   the capital's gutters — the resistance walks the same roads the player does.
2. **Offhand NPC lines** — complaint-voiced, never plot-voiced. *"Beasts never raided till
   the taps went in."* *"Harbor's closed, but the freight moves at night."*
3. **Wrong-shaped spoils.** "Smugglers" drop bread and seed-tools. A "war-beast" enters
   the Threat Ledger with an empty stomach. A seized vault holds grain in sacks stamped
   with the Magistracy's own seal.
4. **Paper tells.** Warrants whose arrears were already paid. Manifests where "medical
   freight" ticks. A fine schedule dated next month.

The tier rule: **Novice clues are ignorable, Adept clues are odd, Master clues are
undeniable if you stand still and look.**

---

## 2. Azo

One continent, three rings. The further from Jolrek, the less the writ means and the more
the wild magic does.

### Jolrek, the capital

A city built upward because Vane taxed the ground. Stacked chimneys, leyline conduits
bolted to façades like ivy made of brass, and a permanent smog the locals call **the
Lid**. The **Spire** — the Magistracy's seat — burns refined marrow around the clock; its
light is the only thing that gets through the Lid, and the city sets its clocks by which
of its windows are lit.

| Ward | What it is |
|---|---|
| **Ashfall Ward** | the shipped hub district — Dispatch, the Safehouse trades, honest poverty |
| **Lamprow** | the lamplighters' quarter; the tax on light is collected here, in person |
| **The Bonemarket** | the legal market for beast reagents; half of it is neither |
| **The Cinderworks** | the foundry belt feeding the Spire; the "relocated" work here, briefly |
| **Highcourt** | the Spire's foot; clean air sold by the hour. The player enters twice: once to be paid, once to end it |

### The Middle Ring — towns and farmland

| Place | What it is |
|---|---|
| **The Tallow Levels** | rendering farms and grain flats, tithed to the wick |
| **Bray's Hollow** | a livestock hamlet; the licenses cost more than the herds |
| **Millharrow** | a mill town on the **Chalk Road**, the main artery to Jolrek |
| **Saltglass** | a fishing town whose harbor is closed by a writ nobody will explain |
| **Fenwick's Crossing** | coach inn and waystation; every rumor on Azo drinks here |
| **Weeping Stile** | a village that stopped answering the Census |

### The Wildlands

Each region is anchored to species already in the registry (`companions.ts`), whose titles
were already doing this geography's work.

| Region | Character | Native apexes |
|---|---|---|
| **The Caldera** | volcanic scrubland, geothermal tap-fields | Chimera of the Caldera, Obsidian Tortoise, Cinder-Wasp Swarm |
| **The Ashwood** | the last old forest, half of it already stumps | Crimson Treant ("Ashwood Warden") |
| **The Rimefields** | glacial passes north | Glacial Juggernaut, Storm-Mantis ("Rime Conductor"), Grave-Gargoyle ("Black Ice") |
| **The Storm Shelf** | high plateau strung with sky-conduits; the storms never leave | Volatile Geist ("Aether Siphon"), Kinetic Dynamo ("Momentum Engine") |
| **The Bone Bastion** | a necropolis ridge the Magistracy calls unconsecrated and posts no maps of | Bone Bastion Sovereign |

### The Magistracy's organs

Every contract is posted by one of these, and by the end the player can read a poster's
provenance the way they read a card's cost.

- **Dispatch** — Vex's service. Posts the board, pays the fees, asks no questions *in writing*.
- **The Wardens** — street enforcement; their lamps, their vision cones, their curfews.
- **The Census** — counts people. Lately the counts go down, and the ledgers say "relocated."
- **The Conduit Works** — builds the leyline grid. Every wildland contract is theirs at the root.
- **The King's Duelists** — Vane's personal circuit of champions. Dueling one is legal. Beating all of them is a message.

---

## 3. The ten Novice contracts — Jolrek and its outskirts

*Posted by shopkeepers, ward clerks, Dispatch. Novice pay (~40 Ducats, no shards, no
cores, per `TIER_PAY`). The rot is a hairline crack.*

| # | Contract | The job | The fight | The crack |
|---|---|---|---|---|
| 1 | **The Lamprow Tithe** | Collect overdue lamp-tax from a gutter crew behind the lighters' hall | 6×6, kitchen-tool minions, no enemy companion | The arrears ledger shows the debt *paid* — twice, under two different clerks' stamps |
| 2 | **Vermin of the Bonemarket** | Burn a cinder-wasp nest out of a market awning | Swarm units, market-stall cover, `scavenger` — a nest-robber runs for the edge with comb | The comb is packed with chewed grain from sacks bearing the Magistracy's own seal: confiscated food, never redistributed |
| 3 | **Lamplighter Escort** | Walk old Tam the lamplighter through a stretch where three lamps "failed" | Ambush by "footpads," `fog` | The footpads wear miners' tags from a pit the Conduit Works closed. The lamps didn't fail; they were unpaid |
| 4 | **The Curfew Breakers** | Disperse an unlawful night assembly in Ashfall | `turfwar` — they hold a spot and do not chase | The "assembly" is a queue at a bakery's back door. The bread dole was cut by writ the same week the curfew was posted |
| 5 | **A Debt Collected, Minor** | Seize a printing press from a Lamprow cellar | Cramped 6×6, walls; the printers fight with ink and hooks | The sheet still drying on the drum reads THE ENGINES EAT OUR MARROW. The graffiti has a source, and the Magistracy knows its address |
| 6 | **Smoke-Eater's Rest** | A "cracked" veteran frightens Highcourt's plaza; move him along | **Wager duel**, novice stake (`TIER_WAGER`) | He isn't mad. He repeats one thing: *"I stood post under the Spire. I heard the floor eating."* First mention of the undercroft |
| 7 | **The Fouled Cistern** | Kill the beast in the Ward Seven cistern | A starved juvenile grave-gargoyle; `rain` (fire −10, shock +10) | The Threat Ledger entry afterward: *stomach empty; scale-burns match engine coolant.* It wasn't hunting. It was hiding |
| 8 | **Poster Work** | Strip seditious bills off the Cinderworks fence; detain the vandals | Two bill-stickers and a lookout, flee-biased AI | The "seditious bills" are freight manifests — accurate ones. Someone inside Dispatch is leaking the night freight schedule |
| 9 | **Gutter Dispute** | Two scavenge crews contest a collapsed granary; clear both | Three-sided scrap, `marrowGeodes` in the rubble | The granary didn't collapse: the beams are sawn, and the insurance writ was filed by a Highcourt name three days *before* |
| 10 | **The Clinic Quota** | Collect licensing fines from a back-alley clinic treating unregistered Whisperers | The clinic's small, loyal minder-beasts defending doorways; walls and cover | The fine schedule is dated **next month**. The Magistracy fines what it has already decided will exist |

---

## 4. The ten Adept contracts — the Middle Ring

*Countersigned. Adept pay (~85 Ducats, 1 shard, 1 rolled core). The crack is now a seam.*

| # | Contract | The job | The fight | The crack |
|---|---|---|---|---|
| 1 | **The Chalk Road Toll** | Bandits stop grain wagons outside Millharrow; end it | Road ambush, `rain`, hedge cover | Their spoils: bread, seed-tools, a child's boot. Their "chief" is fourteen and branded with a tithe mark. They aren't robbing the wagons — they're robbing them *back* |
| 2 | **Blight on the Tallow Levels** | A crimson treant tears up a rendering farm's north field | The treant + root minions; shatterable `cover` | It tears one dead-straight line — directly above the Conduit Works' buried pipe. The "blight" browns the grass along the same line |
| 3 | **The Saltglass Riot** | Put down a riot at the closed harbor | `gale` off the sea (wind vector), crowd units with driftwood pikes | The boats are rotting under a Magistracy customs chain. The rioters are fishermen trying to reach their own boats before the freight fleet takes the moorings |
| 4 | **Warrant of Distraint: Bray's Hollow** | Seize unlicensed livestock from a farmstead | The family's *tamed vault boar* — a Ferrum-line unit — defends the yard; script: stones from beyond the fences chip the attacker each `onTurnStart` | The license fees in your own warrant exceed the farm's whole annual yield. The law was priced to be unkeepable |
| 5 | **The Night Freight** | Ride guard on a sealed wagon, Fenwick's Crossing to Jolrek | Masked Whisperers target the *wagon*, not you — script: they win by destroying a prop | The manifest says MEDICAL. The crates tick, smell of ozone, and one is stencilled with Storm Shelf pylon numbering |
| 6 | **The Poacher of the Ashwood Fringe** | A poacher-duelist bleeds the King's forest; bring back his medallion | **Wager duel**, forest cover, `fog` | The medallion is a King's Duelist crest, struck through — discharged for refusing a contract. Win and he names it: *"Bray's Hollow. You've already done my sin for me, friend."* |
| 7 | **Cellar Clearance, Fenwick's Crossing** | Feral ember hounds under the coach inn | Tight cellar, walls, fire hazards; wildfire reactions live | Every hound is brand-scarred with a pit number. Nothing feral is born numbered — and the Magistracy licenses exactly one fighting pit |
| 8 | **The Hollow Census** | Escort a Census clerk through Weeping Stile, which stopped answering | The village's left-behind watch-beasts holding turf (`turfwar`); `fog` | Every door unlocked, every hearth cold; the ledger's last page reads RELOCATED — LABOR, 61 SOULS. Your escort burns that page in front of you and files "plague" |
| 9 | **The Drowned Granary** | Kill the beast damming Millharrow's sluice before the flood takes the mill | An obsidian tortoise mid-channel; `currents` drag units downstream each turn — the tortoise blocks them | The gates upstream are chained **open**, by writ. The tortoise is the only thing keeping the commons' grain dry, and the aftermath text says exactly what killing it completed |
| 10 | **Duel at the Waystone** | A duelist holds the Waystone bridge against the toll-men; the crown wants its road back | **Wager duel**, one-lane bridge map, `gale` | Millharrow feeds him. Children bring him bread along the sidewalk — inside the safe zone, where nothing can be made to look like a lie |

---

## 5. The ten Master contracts — the Wildlands

*Wax seal, no name. Master pay (~160 Ducats, 3 shards, 2 cores). The crack is a canyon;
these contracts are the King's plan wearing a bounty's clothes.*

A design rule with teeth: several of these are Apex subjugations, and each carries a
`subjugationPrize` — the wild species can be **bound instead of destroyed**. Mercy is
mechanically better, and the game never says so out loud. That is the moral argument of
the whole plot, made entirely through the reward table.

| # | Contract | The job | The fight | The crack |
|---|---|---|---|---|
| 1 | **Apex Subjugation: The Caldera Chimera** | The chimera raids tap-field crews | Boss script, 50% phase gate; `subjugationPrize: chimera_of_the_caldera`; `marrowGeodes` all over the map — the arena is the motive | The "raided" crews are drilling its denning grounds. The raid schedule matches the blasting schedule to the day |
| 2 | **The Rimefield Break** | A glacial juggernaut menaces the north pass; it must open before winter freight | Ice field, shatter/superconduct reactions; avalanche script — rubble spawns each `onTurnStart` | It is not menacing the pass. It is *bracing the snowpack* the Conduit Works' blasting cracked. Aftermath: the pass town evacuates; the freight goes through |
| 3 | **Binding Order: Sealed — the Storm Shelf** | Subjugate the Storm-Mantis "interfering" with the sky-conduits | Permanent `gale`, arc reactions live, pylons as terrain; `subjugationPrize: storm_mantis` | The shelf's storms are the conduits' *exhaust*. The mantis grounds strikes that would hit the last shepherd camps. The pylon numbers match the Night Freight crates |
| 4 | **The Geist of Pylon Nine** | Something haunts the newest pylon and drinks its charge | The Volatile Geist; script: it *heals* from shock — it must be starved, not blasted | The geist is the pylon's own waste: siphoned aether curdled into something that remembers being alive. The contract calls it "product loss" |
| 5 | **Wildfire Writ: the Ashwood** | Burn out the treant grove before the "blight" reaches the timber camps | The Crimson Treant elder + grove; a deliberate wildfire-reaction map; `vanguard` permitted | The blight is engine runoff, and the writ's own map draws the burn line *around* the harvestable timber |
| 6 | **The King's Duelist: Coldwater** | Vane's first champion requests you by name | **Wager duel, master stake**; clean arena; devour/cascade deck | Lose and she spares you, with a warning. Win and she unpins her crest: *"I cleared Weeping Stile. Sixty-one souls to the undercroft. Ask the floor what it eats."* The poacher's story now corroborates |
| 7 | **Apex Subjugation: The Kinetic Dynamo** | An engine-beast broke out of the Cinderworks and is freeing foundry stock across the flats | Boss + freed beasts arriving on *its* side (script); `subjugationPrize: kinetic_dynamo` | It is not wild. It was **built**, then worked, then it left — and everything it frees carries pit numbers the player has now seen three times |
| 8 | **The Relocation Train** | Guard the season's last relocation convoy, Fenwick's Crossing to the Spire undercroft | Wave defense of the wagons; the attackers reuse unit identities from earlier contracts — Millharrow bread-thieves, Saltglass fishers | The undeniable one. The manifest lists **no return trips**. Deliver it or walk away — the contract "completes" either way, and the Bounty Board is never innocent again |
| 9 | **Apex Subjugation: The Bone Bastion Sovereign** | The necropolis apex walks at night; put it down before it reaches the Levels | The Sovereign, 2×2 behemoth-class, dusk statuses; `subjugationPrize: bone_bastion_sovereign` | The Bastion's "unconsecrated" graves are fresh, mass, and numbered in Census hand — the relocation train's other terminus. It is not raiding. It is *grieving its new tenants*, and it walks toward Jolrek because that is where they came from |
| 10 | **The Summons** | Not a bounty: a royal writ with the player's name on it. Carry the Boss Core — distilled from the Apex victories — to the throne room and be honored | No fight. The city cheers the player through Highcourt | There is no clue left to find; the walk *is* the clue. Every lamp passed is one Lamprow cannot afford, and the last safe wall before the Spire reads, in fresh paint: **DON'T CARRY IT IN** |

---

## 6. The reveal, and the throne room

**The monologue.** Vane thanks the player — by contract, by name, in order. The bandits
who would have unionized the road. The treant that held up the south pipe. The Sovereign
that knew where the bodies were. Then, aloud, the plan complete: **the Great Quieting**.
The delivered core keys the Spire's grid, siphoning Azo's wild magic into a metered
monopoly — every pact on the continent, the player's included, drawing its marrow from
*his* ledger.

> *"You were never hunting threats. You were collecting my collateral."*

**The duel.** Two phases on the throne-room grid, built from machinery `ignis_trial`
already proves out (HP clamp at the gate, status purge, `bossPhaseShift`, behemoth
growth, `beginSubjugation`):

1. **The Lord Magistrate.** Vane casts from the backline behind royal sentinels — a
   surge/dusk deck, cascade-heavy.
2. **The Clockwork Colossus.** At the 50% damage gate the throne floor opens and Vane
   boards a 2×2 smog-spewing engine.
3. **The Rite.** At 25% the Colossus purges its statuses and gains aether plating — raw
   damage immunity. The engine injects the 0-bone **Rite of Subjugation**; the player
   anchors a unit and holds the three-round siege while Vane's AI throws every action at
   the tether. Victory strips the engine, not the man: **Vane is subjugated by the exact
   instrument he built to license the wild.**

**The duelist ladder**, running under all of it: countryside duelists (novice wagers) →
city and guild duelists (adept) → the King's Duelists (master). Coldwater is the ladder's
narrative rung, and beating the King's Duelists is what earns The Summons.

---

## Appendix — suggested implementation order

Nothing beyond this document ships with it. When content work starts, the waves that pay
off soonest:

1. **Wave 1 — the board learns to lie.** Three novice contracts (Lamprow Tithe, Vermin of
   the Bonemarket, Curfew Breakers) plus the Chalk Road Toll as the first clue-bearing
   adept fight. This wave proves the clue plumbing: contract text, wrong-shaped spoils,
   one Threat Ledger note.
2. **Wave 2 — the ladder.** The wager duels (Smoke-Eater, Poacher, Waystone) and the
   remaining adept spread; graffiti set dressing in the district.
3. **Wave 3 — the apexes.** The subjugation bosses, one per wildland region, reusing the
   `ignis_trial` script shape.
4. **Wave 4 — the end.** The Summons, the monologue, the throne room, the Colossus.

---

## 8. The Wildlands, as standing work

Everything above is a contract: posted, finite, walked once. The wilds are the other half of
the map, and they run on a different clock.

**The Wildlands Gate.** The warded gate in Ashfall's yard wall opens now. Past it is not a
place the player walks — there is no wildland map — but a board of standing work, twelve
hunts grouped by region. Nobody posted them and completing one closes nothing.

**Why they repeat.** A hunt pays out an *animal*, and an animal is rolled: its eight-card
Grimoire drawn from its bloodline's own shelf, its constitution, its knack, the modifiers on
each of its eight cards, and — one time in a hundred — its lustre. Two Saltglass Seals are
two different beasts. Each hunt is empty for ten minutes of real time after it pays, which
is long enough to be a reason to go and do something else and short enough that a session
sees one twice.

**Who lives where.**

| Region | Beast | Tier |
|---|---|---|
| The Caldera | Ignis, Ember Drake | novice |
| The Cinderworks | Flue Salamander, Chimney Fire | novice |
| The Ashwood (grove) | Sylva, Thorn Warden | novice |
| The Ashwood (dark) | Mortis, Carrion Stag | master |
| The Chalk Road | Ferrum, Vault Boar | novice |
| The Chalk Cut | Quarry Ram, Chalk Breaker | novice |
| The Rimefields | Boreas, Frost Bear | adept |
| Saltglass | Saltglass Seal, Harbor Ghost | adept |
| The Tallow Levels | Moss Aurochs, Fallow Warden | adept |
| The Storm Shelf | Voltara, Storm Lynx | adept |
| The Storm Shelf (Pylon Twelve) | Conduit Kite, Pylon Nester | master |
| The Bone Bastion (fringe) | Barrow Jackal, Grave-Digger | master |

The six founding bloodlines are on that list deliberately. A character enrols vowed to one
of them, and the other five were previously unreachable in a finished save — five sixths of
the starting roster was content nobody could ever field. The player's *own* species is
listed too, for the same reason a second Ignis is worth catching: it is a different book.

**What the wilds do not give you.** No hybrid is huntable. Every one of the fifteen two-school
bloodlines is bound off a named enemy in the campaign — a duelist's stake, a contract's apex —
and each of those is a single occasion. A hybrid on a ten-minute timer would turn the arc's
most particular rewards into a shopping list.

## 9. Mercy, as a mechanic

The doc has said from the start that the wild species can be bound rather than destroyed and
that the game never says so out loud. That was true of four contracts. It is true of all of
them now: **every fight in the game that fields a beast can end in a binding instead of a
kill**, including the six species that previously appeared as enemies with no way to take
them alive, and all four wager duels — where the beast, not only the purse, is the stake.

The arithmetic the player is never told: a killed apex pays its contract, and a bound one
pays the same contract *and* joins the roster. The generous reading is also the profitable
one, and the game leaves them to notice.
