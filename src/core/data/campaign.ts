/**
 * The King's Contracts: the story campaign, as data.
 *
 * Thirty contracts across the three tiers, walked in order, per
 * `docs/11_world_of_azo_and_the_kings_contracts.md`. Each is pinned 1:1 to an encounter —
 * the contract's id IS its encounter id — so completion can be recognised off the fight
 * that was fought without adding anything to the combat state.
 *
 * The board surfaces these through `composeBoard` in `bounties.ts`: each tier's poster
 * shows the next *uncompleted* story contract of that tier, and falls back to the rolled
 * pools once a tier's arc is done. Completion lives on the profile as a ledger of ids
 * (`Profile.campaign`), the same idiom as `rosterUnlocks` and `tutorial`.
 *
 * The `crack` is the reveal — the wrong-shaped detail the doc seeds each contract with.
 * Rough pass: it is shown as the notice modal when the player next steps onto the street,
 * which is where the death/rescue notices already appear.
 */

import type { BountyDifficulty } from './bounties.js';

export interface StoryContract {
  /** Equals the encounter id it sends you to. One contract, one fight, one name. */
  id: string;
  tier: BountyDifficulty;
  title: string;
  /** The job as the poster tells it — the lie, in the regime's own voice. */
  flavour: string;
  /** The reveal, shown on the street after the contract resolves. */
  crack: { title: string; body: string };
  /** Duels stake a wager instead of only paying a fee. */
  wager?: true;
}

/**
 * The campaign, in walking order within each tier.
 *
 * Wave 1 ships the first three Novice contracts and the first Adept one — the set the
 * design doc names as proving the clue plumbing. Later waves append; nothing here is
 * removed or reordered once shipped, because the ledger on the profile stores ids.
 */
export const STORY_CONTRACTS: readonly StoryContract[] = [
  // ---- Novice: Jolrek and its outskirts -------------------------------------------
  {
    id: 'lamprow_tithe',
    tier: 'novice',
    title: 'The Lamprow Tithe',
    flavour:
      'Arrears owed on lamp-tax, three seasons deep. Collect from the crew squatting ' +
      'behind the lighters’ hall. The Magistracy prefers the ledger settled quietly.',
    crack: {
      title: 'The Ledger, Settled',
      body:
        'You take their coin and count it against the arrears ledger Dispatch handed you. ' +
        'The debt is already marked paid. Twice. Two different clerks’ stamps, two ' +
        'different dates — and the crew’s copy of the receipt, crumpled in a pot on the ' +
        'stove, matches the first.',
    },
  },
  {
    id: 'bonemarket_vermin',
    tier: 'novice',
    title: 'Vermin of the Bonemarket',
    flavour:
      'A cinder-wasp nest in the awnings over Stall Row. Burn it out before market day. ' +
      'Posted by the stallholders’ association; paid by weight of comb recovered.',
    crack: {
      title: 'What the Comb Held',
      body:
        'The comb comes down heavier than comb should. Packed through every cell: chewed ' +
        'grain. The sacks it came from are still in the rafters, stamped with the ' +
        'Magistracy’s own seal — confiscated food, warehoused above a hungry market, ' +
        'never redistributed. The wasps found it first.',
    },
  },
  {
    id: 'lamplighter_escort',
    tier: 'novice',
    title: 'Lamplighter Escort',
    flavour:
      'Three lamps dark on the Lamprow stretch, and old Tam will not walk it alone ' +
      'again. See him post to post. Whatever doused them is still there.',
    crack: {
      title: 'What the Lamps Cost',
      body:
        'The footpads carry no purses worth the name — but every one of them wears a ' +
        'miner’s tag from the Ellery pit, the one the Conduit Works closed in spring. ' +
        'And the lamps did not fail. Tam checks the first one while you stand guard: ' +
        'the wick is sound, the tax simply was not paid. Dark is what unpaid looks like.',
    },
  },
  {
    id: 'curfew_breakers',
    tier: 'novice',
    title: 'The Curfew Breakers',
    flavour:
      'An unlawful assembly gathers in Ashfall after the bell, same corner, every night. ' +
      'Disperse it. The Wardens are stretched and the Magistracy dislikes patterns.',
    crack: {
      title: 'The Pattern',
      body:
        'They scatter, and behind where they stood is a bakery’s back door, still warm. ' +
        'The “assembly” was a bread queue. The dole was cut by writ the same week the ' +
        'curfew was posted — the queue did not move to the night. The night was moved ' +
        'onto the queue.',
    },
  },

  {
    id: 'debt_collected_minor',
    tier: 'novice',
    title: 'A Debt Collected, Minor',
    flavour:
      'A printing press in a Lamprow cellar, to be seized against arrears. Bring gloves; ' +
      'ink does not wash out of a warrant.',
    crack: {
      title: 'Still Wet',
      body:
        'The press comes apart for carrying, and the last sheet is still drying on the ' +
        'drum: THE ENGINES EAT OUR MARROW. The same hand as every gutter wall in the ' +
        'ward. The graffiti has a source, and the Magistracy has known its address long ' +
        'enough to price the seizure into a debt ledger.',
    },
  },
  {
    id: 'smoke_eaters_rest',
    tier: 'novice',
    title: 'Smoke-Eater’s Rest',
    wager: true,
    flavour:
      'A cracked veteran has claimed a bench on Highcourt plaza and frightens the clean ' +
      'air trade. He duels anyone the Wardens send. Move him along.',
    crack: {
      title: 'What the Veteran Repeats',
      body:
        'Beaten, he does not move along. He straightens his coat like a man back on ' +
        'post and says the only thing he ever says: “I stood watch under the Spire. I ' +
        'heard the floor eating.” The Wardens call him cracked. Nobody has ever said ' +
        'about what.',
    },
  },
  {
    id: 'fouled_cistern',
    tier: 'novice',
    title: 'The Fouled Cistern',
    flavour:
      'Something has moved into the Ward Seven cistern and the water tastes of it. Put ' +
      'it down before the pumps foul.',
    crack: {
      title: 'The Threat Ledger, Amended',
      body:
        'The clerk who files your kill fee reads the carcass sheet aloud, once, without ' +
        'comment: stomach entirely empty. Scale-burns along both flanks, consistent with ' +
        'engine coolant. It was a juvenile. It was not hunting in the cistern. It was ' +
        'hiding in it.',
    },
  },
  {
    id: 'poster_work',
    tier: 'novice',
    title: 'Poster Work',
    flavour:
      'Seditious bills on the Cinderworks fence, fresh paste every morning. Strip the ' +
      'fence and detain whoever holds the brush.',
    crack: {
      title: 'The Bills, Read',
      body:
        'You peel one whole to bag as evidence and make the mistake of reading it. It is ' +
        'not a slogan. It is a freight manifest — times, gates, tonnage — and tomorrow ' +
        'night’s is accurate; you watch the gate from the walkway to be sure. Someone ' +
        'inside Dispatch is telling the ward what moves through it in the dark.',
    },
  },
  {
    id: 'gutter_dispute',
    tier: 'novice',
    title: 'Gutter Dispute',
    flavour:
      'The Hollis granary came down and two crews are contesting the scavenge. The ' +
      'Magistracy does not care who wins, only that it stops.',
    crack: {
      title: 'The Beams',
      body:
        'When the scrap is cleared you can finally see the frame that failed. The beams ' +
        'are not broken. They are sawn — clean, straight, from the access side. The ' +
        'insurance writ on the granary was filed by a Highcourt name three days before ' +
        'the collapse it insures against.',
    },
  },
  {
    id: 'clinic_quota',
    tier: 'novice',
    title: 'The Clinic Quota',
    flavour:
      'A back-alley clinic treats unregistered Whisperers and owes licensing fines. ' +
      'Collect them. The schedule of fees is attached.',
    crack: {
      title: 'The Schedule of Fees',
      body:
        'Counting out the fine against the attached schedule, you notice the docket ' +
        'date. The schedule is dated next month. The offences it prices have not ' +
        'happened yet — the Magistracy fines what it has already decided will exist, ' +
        'and it decided this clinic exists to be fined.',
    },
  },

  // ---- Adept: the Middle Ring ------------------------------------------------------
  {
    id: 'chalk_road_toll',
    tier: 'adept',
    title: 'The Chalk Road Toll',
    flavour:
      'Bandits are stopping grain wagons on the Chalk Road outside Millharrow. End it. ' +
      'Countersigned: the freight schedule does not move for weather or for sentiment.',
    crack: {
      title: 'The Toll, Counted',
      body:
        'Their whole haul, laid out on the verge: bread, seed-tools, a child’s boot. ' +
        'Their “chief” is fourteen and carries a tithe brand on the same wrist the ' +
        'manacle goes on. They were not robbing the wagons. They were robbing them back.',
    },
  },
  {
    id: 'tallow_blight',
    tier: 'adept',
    title: 'Blight on the Tallow Levels',
    flavour:
      'A treant is tearing up the Hollis rendering farm’s north field, fence to fence. ' +
      'The season will not wait for it to finish. Neither will the tithe.',
    crack: {
      title: 'One Straight Line',
      body:
        'Walk the torn ground after: one line, fence to fence, straight as a surveyor’s ' +
        'chain. Nothing else in the field is touched. The farmer’s boy says the Conduit ' +
        'Works buried a pipe on that line two winters back — and the “blight” the ' +
        'contract cites browns the grass along the pipe’s route exactly, on every farm ' +
        'it passes under.',
    },
  },
  {
    id: 'saltglass_riot',
    tier: 'adept',
    title: 'The Saltglass Riot',
    flavour:
      'The harbor crowd at Saltglass has stopped dispersing when told. The customs ' +
      'chain stays; the crowd does not. See to it.',
    crack: {
      title: 'The Boats',
      body:
        'From the mole you can see what the crowd was pressing toward: their own boats, ' +
        'rotting at anchor under a Magistracy customs chain no one will explain, sails ' +
        'mildewed to the spars. The freight fleet rides clean and crewed at the deep ' +
        'moorings. The riot was fishermen trying to reach their livelihoods before the ' +
        'harbormaster reassigns the berths.',
    },
  },
  {
    id: 'warrant_of_distraint',
    tier: 'adept',
    title: 'Warrant of Distraint: Bray’s Hollow',
    flavour:
      'Unlicensed livestock at the Marsh farmstead. Seize per the schedule attached. ' +
      'The fees are in the warrant; the arithmetic is not your concern.',
    crack: {
      title: 'The Arithmetic',
      body:
        'You do the arithmetic anyway, on the ride back, with the boar walking chained ' +
        'behind. The license the Marshes failed to hold costs more per season than ' +
        'their whole farm yields in a year. It is not a fee. It is a fence with a ' +
        'number on it, priced so that keeping a beast is a crime everywhere the ' +
        'Magistracy wants beasts kept only by itself.',
    },
  },
  {
    id: 'night_freight',
    tier: 'adept',
    title: 'The Night Freight',
    flavour:
      'A sealed wagon runs Fenwick’s Crossing to Jolrek tonight and wants a blade ' +
      'beside it. Do not open the crates. Do not answer questions about the crates.',
    crack: {
      title: 'The Manifest',
      body:
        'The masked ones never once swung at you — every blow was for the wagon. ' +
        'Delivering it, you sign against the manifest: MEDICAL, it says, in a clerk’s ' +
        'tidy hand. The crates tick. They smell of ozone, not of medicine. And the ' +
        'stencil on the lowest one is a pylon number — Storm Shelf grid, the same ' +
        'numbering the bills on the Cinderworks fence kept listing.',
    },
  },
  {
    id: 'ashwood_poacher',
    tier: 'adept',
    title: 'The Poacher of the Ashwood Fringe',
    wager: true,
    flavour:
      'A poacher-duelist is bleeding the King’s forest and mocking the wardens sent ' +
      'after him. Bring back his medallion, whole or otherwise.',
    crack: {
      title: 'The Medallion',
      body:
        'He hands the medallion over himself, laughing, when the duel is done. It is a ' +
        'King’s Duelist crest — struck through, formally, with the discharge mark. ' +
        '“Refused a contract,” he says. “You want to know which one? Bray’s Hollow. ' +
        'The boar, the family, the schedule of fees. You’ve already done my sin for ' +
        'me, friend.”',
    },
  },
  {
    id: 'cellar_clearance',
    tier: 'adept',
    title: 'Cellar Clearance, Fenwick’s Crossing',
    flavour:
      'Feral hounds under the coach inn, between the casks and the stairs. Clear the ' +
      'cellar without burning the Crossing down, if convenient.',
    crack: {
      title: 'Branded Stock',
      body:
        'Dragging the last hound off the cellar floor, you find the brand scar under ' +
        'its ear: a pit number, five digits, same series on every one of them. Nothing ' +
        'feral is born numbered. Somebody’s fighting pit lost its stock — and the ' +
        'Magistracy licenses exactly one fighting pit, and audits it never.',
    },
  },
  {
    id: 'hollow_census',
    tier: 'adept',
    title: 'The Hollow Census',
    flavour:
      'Weeping Stile has missed two counts. Escort the Census through, room by room, ' +
      'and let the clerk write what the clerk writes.',
    crack: {
      title: 'What the Clerk Writes',
      body:
        'Every door unlocked. Every hearth cold. Sixty-one names in the village ledger ' +
        'and the last page, in a clerk’s hand not the reeve’s: RELOCATED — LABOR, 61 ' +
        'SOULS. Your clerk reads it twice, tears the page out, and burns it on the ' +
        'cold hearth in front of you. The count they file that evening says PLAGUE.',
    },
  },
  {
    id: 'drowned_granary',
    tier: 'adept',
    title: 'The Drowned Granary',
    flavour:
      'Something enormous has dammed Millharrow’s sluice and the mill pond is climbing ' +
      'the granary steps. Kill it before the commons’ grain goes under.',
    crack: {
      title: 'The Gates Upstream',
      body:
        'With the tortoise dead the channel clears in an hour — and the water rises ' +
        'faster. You walk the race upstream to see why. The regulating gates stand ' +
        'chained open, Magistracy chain, Magistracy lock, a writ tag on the chain dated ' +
        'last month. The beast was not damming the sluice. It was the only thing ' +
        'keeping the commons’ grain dry, and now the flood finishes what the writ ' +
        'started.',
    },
  },
  {
    id: 'waystone_duel',
    tier: 'adept',
    title: 'Duel at the Waystone',
    wager: true,
    flavour:
      'A duelist holds the Waystone bridge and turns the toll-men back at the parapet. ' +
      'The crown wants its road, and is paying you to want it too.',
    crack: {
      title: 'Who Feeds Him',
      body:
        'While you bind your knuckles on the far bank, children come out from ' +
        'Millharrow along the safe path with bread for him, the way they plainly do ' +
        'every day. He takes it, thanks each one by name, and posts himself back on ' +
        'the bridge he is keeping toll-free. The town is not afraid of the man on the ' +
        'bridge. The town is feeding him.',
    },
  },
];

/** The next uncompleted story contract of a tier, in shipped order. */
export function nextStoryContract(
  tier: BountyDifficulty,
  completed: readonly string[],
): StoryContract | undefined {
  return STORY_CONTRACTS.find((c) => c.tier === tier && !completed.includes(c.id));
}

/** The story contract a fight belongs to, if it is one. Keyed by encounter id. */
export function storyContractByEncounter(encounterId: string): StoryContract | undefined {
  return STORY_CONTRACTS.find((c) => c.id === encounterId);
}
