/**
 * Things people ask you to do, and what they pay for them.
 *
 * `docs/worldbuild-todo.md` has carried this row since the townsfolk landed: *"All 48 | pure
 * `Interactable`s — no contracts, no clues, no quest state | people who can start something."*
 * Forty-eight people stood in twelve areas with a line each and no way to want anything. Every
 * task in the game arrived through one board in one ward.
 *
 * ## Where this lives, and why not in `core`
 *
 * An errand names an area, a townsperson and a patch of ground, which are district nouns; the
 * *reward* lands in the overworld purse through `core`. So the registry is here and the payment
 * is there, which keeps the dependency pointing the one way it already points. The one thing
 * borrowed upward is `DialogueLine`, and it is two strings.
 *
 * ## The shape, and the one rule
 *
 * **One errand open at a time.** Not a limitation wearing a design's clothes: it makes the
 * objective panel have exactly one thing to say, it makes "you are carrying this" literally true
 * for a delivery, and it means a turn-in can never be ambiguous. A player holding four parcels
 * and standing in front of somebody who wants one of them is a disambiguation UI nobody asked
 * for.
 *
 * Four kinds of step, and every one of them is something the world could already express — which
 * is the whole reason this is affordable. A delivery is two crossings and a conversation. A cull
 * points at a pack that is already roaming. A survey is a `Hotspot`, the same class the doors
 * use. Only `gather` needed a new object.
 *
 * The lines are written to the rule `FOLK_LINES` already follows: **say something only this
 * person, standing in this place, would say.** An errand that could be given by anybody is a
 * fetch quest, and the world has enough signs.
 */

import type { BuffId } from '../core/overworld/state.js';
import type { DressingId } from './dressing.js';

/**
 * One spoken line. Structurally `DialogueLine`, and deliberately re-declared rather than
 * imported.
 *
 * `dialogue.ts` holds `DialogueBox`, which touches the DOM. `app/save.ts` has to read the errand
 * ledger and validate it against the ids that exist, so it imports this module — and a save file
 * reaching transitively into `document` is both a cycle waiting to happen and the reason this
 * module could not otherwise be tested under node. Two field names is a cheap price for that.
 */
export interface ErrandLine {
  readonly who: string;
  readonly text: string;
}

/** What the errand actually asks for. */
export type ErrandStep =
  /**
   * Carry something to somebody else. Turned in *there*, not back here.
   *
   * The cheapest of the four and the one that best repays the world being walkable: it is two
   * crossings, and the crossings are the content.
   */
  | { readonly kind: 'deliver'; readonly toArea: string; readonly toNpc: string }
  /** Clear a pack that is already roaming somewhere. Satisfied by winning that fight. */
  | { readonly kind: 'cull'; readonly encounterId: string }
  /** Go and look at somewhere, and come back and say what you saw. */
  | { readonly kind: 'survey'; readonly area: string; readonly x: number; readonly z: number }
  /** Find a thing on the ground, pick it up, and bring it back. */
  | {
      readonly kind: 'gather';
      readonly area: string;
      readonly x: number;
      readonly z: number;
      /**
       * What it looks like on the ground. Reuses the furniture the world already draws.
       *
       * `waystone` is excluded because its picture *is* the line carved into it, so it is the one
       * kind `DRESSING_ART` cannot cut without being told what it says.
       */
      readonly art: Exclude<DressingId, 'waystone'>;
      /** The prompt over it: "Cut the reeds". */
      readonly label: string;
    };

/**
 * What it pays.
 *
 * Deliberately **no schematics.** That gate is the strongest reward in the game and the one
 * thing standing between a rich player and the whole catalogue; making it routine income out of
 * a walk across the Ring would spend a whole economy on errands.
 */
export interface ErrandReward {
  readonly ducats?: number;
  readonly marrowShards?: number;
  readonly reagents?: Readonly<Record<string, number>>;
  /** A brew for the satchel. Makes an errand feel like preparation rather than income. */
  readonly brew?: BuffId;
}

export interface ErrandDef {
  readonly id: string;
  /**
   * Who asks, as `${areaId}:${npcId}`.
   *
   * The errand names its giver rather than `NpcSpec` gaining an `errand` field, which means
   * **no area file changes at all** — and it is the direction `PackSpec` already points, where
   * an encounter names the pack rather than the pack naming the encounter.
   */
  readonly giver: string;
  /** One line for the objective panel. Imperative, and it names the place. */
  readonly title: string;
  readonly offer: readonly ErrandLine[];
  /** Said while it is open and unfinished. Must differ from the offer, and a test says so. */
  readonly nudge: readonly ErrandLine[];
  /** Said on turn-in, by whoever is owed the report. */
  readonly thanks: readonly ErrandLine[];
  readonly step: ErrandStep;
  readonly reward: ErrandReward;
  /**
   * Errands that have to be done first.
   *
   * Used sparingly and for one reason: the two deepest jobs in the world are five crossings out,
   * and a Commander who has been in Azo for four minutes should not be sent to the Bone Bastion
   * as their first piece of work. Not a story gate — nothing here has a story.
   */
  readonly after?: readonly string[];
}

/* ------------------------------------------------------------------------------------ *
 * The work.
 * ------------------------------------------------------------------------------------ */

export const ERRANDS: readonly ErrandDef[] = [
  /* --- the ward, and one crossing out ---------------------------------------------- */
  {
    id: 'gutter_crew',
    giver: 'lamprow:lamprow_lamplighter',
    title: 'Clear the gutter crew off the Lamprow Sink',
    offer: [
      { who: 'LAMPLIGHTER', text: 'You are armed. Good. There is a crew working the Sink and I light the Sink.' },
      { who: 'LAMPLIGHTER', text: 'Two of my posts have gone dark down there and I am not going back to find out why on my own. Deal with them and there is a brew in it — I keep one for the cold nights.' },
    ],
    nudge: [{ who: 'LAMPLIGHTER', text: 'Still dark down there. Still a crew in it.' }],
    thanks: [
      { who: 'LAMPLIGHTER', text: 'I walked the whole row tonight and nobody watched me do it.' },
      { who: 'LAMPLIGHTER', text: 'Take the brew. You will want it before I do.' },
    ],
    step: { kind: 'cull', encounterId: 'pack_lamprow_gutter_crew' },
    reward: { ducats: 110, brew: 'ironbrew' },
  },
  {
    id: 'a_word_to_the_gate',
    giver: 'highcourt:highcourt_crier',
    title: "Carry the crier's notice down to the Ashfall gate",
    offer: [
      { who: 'CRIER', text: 'I read the notices. I do not carry them — a crier who leaves the steps is a crier nobody can find.' },
      { who: 'CRIER', text: 'This one is for the Ashfall gate and it has been in my hand two days. Take it down and I will see you paid out of the reading fee.' },
    ],
    nudge: [{ who: 'CRIER', text: 'The gate. Down the High Street and keep going.' }],
    thanks: [
      { who: 'GATE SENTRY', text: 'From the Spire? Nobody has sent us anything from the Spire since the Census.' },
      { who: 'GATE SENTRY', text: 'I will post it. Here — the crier is good for it and I am not walking up there to collect.' },
    ],
    step: { kind: 'deliver', toArea: 'ashfall_ward', toNpc: 'ashfall_gate_guard' },
    reward: { ducats: 85 },
  },
  {
    id: 'ash_yard_count',
    giver: 'cinderworks:cinderworks_miner',
    title: 'Go up to the Caldera and see whether it is still venting',
    offer: [
      { who: 'ASH-YARD HAND', text: 'Everything I shovel came out of that crater, and this month there is half as much of it.' },
      { who: 'ASH-YARD HAND', text: 'Either the vents have closed or they have opened somewhere else, and the difference matters to me a great deal. Walk up the cut and look. I am not going.' },
    ],
    nudge: [{ who: 'ASH-YARD HAND', text: 'West, up the cut. You will know it when the ground gets warm.' }],
    thanks: [
      { who: 'ASH-YARD HAND', text: 'Still venting. Then it is the wind that has changed, and that I can plan for.' },
      { who: 'ASH-YARD HAND', text: 'There is a core in the yard that came up whole last week. Have it.' },
    ],
    step: { kind: 'survey', area: 'caldera', x: -2, z: 14 },
    reward: { ducats: 150, reagents: { core_pyre: 1 } },
  },
  {
    id: 'herbs_from_the_stile',
    giver: 'ward_seven:ward_seven_herbalist',
    title: 'Bring back fen-caps from the Weeping Stile',
    offer: [
      { who: 'HERBALIST', text: 'Everything I want grows where nobody has cut anything for twenty years, and there is exactly one place like that within reach.' },
      { who: 'HERBALIST', text: 'The Stile. Under the deadfall, on the wet side. Do not bring me anything with a ring on the stem.' },
    ],
    nudge: [{ who: 'HERBALIST', text: 'Under the deadfall. On the wet side.' }],
    thanks: [
      { who: 'HERBALIST', text: 'These are the ones. Look at the gills — nothing in the ward grows gills like that.' },
      { who: 'HERBALIST', text: 'I will have this in a bottle by the weekend. Take the fee.' },
    ],
    step: {
      kind: 'gather',
      area: 'weeping_stile',
      x: -2,
      z: 14,
      art: 'mushrooms',
      label: 'Cut the fen-caps',
    },
    reward: { ducats: 130, marrowShards: 2 },
  },

  /* --- the Middle Ring -------------------------------------------------------------- */
  {
    id: 'millers_debt',
    giver: 'millharrow:millharrow_miller',
    title: "Take the miller's account to the innkeeper at Fenwick's",
    offer: [
      { who: 'MILLER', text: "Fenwick's has had four sacks off me and settled for two, and the innkeeper is a friend, which is the problem." },
      { who: 'MILLER', text: 'Put it in his hand and stand there while he reads it. That is all. A letter that arrives by post can be lost by post.' },
    ],
    nudge: [{ who: 'MILLER', text: 'South, then west at the road. He will know what it is.' }],
    thanks: [
      { who: 'INNKEEPER', text: 'Ah. He has written it down. He never writes anything down.' },
      { who: 'INNKEEPER', text: 'Tell him it is coming. And here — that is for the walk, not for him.' },
    ],
    step: { kind: 'deliver', toArea: 'fenwicks_crossing', toNpc: 'fenwick_innkeeper' },
    reward: { ducats: 95 },
  },
  {
    id: 'the_roads_takings',
    giver: 'millharrow:millharrow_tollman',
    title: 'Break up the waywatch on the Chalk Road',
    offer: [
      { who: 'TOLLMAN', text: 'I take a toll at a gate, in daylight, against a schedule nailed to the post. That is a toll.' },
      { who: 'TOLLMAN', text: 'What is happening on the road east of here is not a toll, and every carter who pays it arrives here with nothing left for me.' },
    ],
    nudge: [{ who: 'TOLLMAN', text: 'East, and go in daylight. They work the carts, and the carts do not run at night.' }],
    thanks: [
      { who: 'TOLLMAN', text: 'Three carts through this morning and all three of them still had a purse.' },
      { who: 'TOLLMAN', text: 'Out of the gate takings. And a draught — the carters leave it and I do not drink.' },
    ],
    step: { kind: 'cull', encounterId: 'pack_road_waywatch' },
    reward: { ducats: 125, brew: 'quicksilver' },
  },
  {
    id: 'reeds_for_the_tanner',
    giver: 'tallow_levels:tallow_tanner',
    title: 'Cut reeds from the Tallow cuts',
    offer: [
      { who: 'TANNER', text: 'Reeds. I need reeds, and the ones by the pits are all cut and the rest are across two channels.' },
      { who: 'TANNER', text: 'You look like somebody who does not mind wet feet. A bundle will do me a fortnight.' },
    ],
    nudge: [{ who: 'TANNER', text: 'The cuts. Wherever the water has stopped moving.' }],
    thanks: [
      { who: 'TANNER', text: 'Long ones. Good. The short ones snap when you lay a hide on them.' },
      { who: 'TANNER', text: 'That is the fortnight. Take it.' },
    ],
    step: {
      kind: 'gather',
      area: 'tallow_levels',
      x: -2,
      z: -10,
      art: 'reeds',
      label: 'Cut a bundle of reeds',
    },
    reward: { ducats: 70 },
  },
  {
    id: 'salt_for_the_butcher',
    giver: 'lamprow:lamprow_butcher',
    title: 'Carry the butcher’s order out to the Saltglass pans',
    offer: [
      { who: 'BUTCHER', text: 'Everything I hang has to be salted and every grain of it comes off the pans, and the pans have stopped sending.' },
      { who: 'BUTCHER', text: 'Not a debt — an order, unfilled. Put it in the pan-wife\'s hand and find out what has happened out there.' },
    ],
    nudge: [{ who: 'BUTCHER', text: 'The pans. West of Millharrow, past the cart way.' }],
    thanks: [
      { who: 'PAN-WIFE', text: 'He thinks we stopped sending. We never stopped sending — the carter stopped coming.' },
      { who: 'PAN-WIFE', text: 'Tell him that, and tell him what it cost him to find out. Here.' },
    ],
    step: { kind: 'deliver', toArea: 'saltglass', toNpc: 'saltglass_panwife' },
    reward: { ducats: 120, reagents: { core_frost: 1 } },
  },
  {
    id: 'the_stile_report',
    giver: 'fenwicks_crossing:fenwick_cartographer',
    title: 'Walk to the Weeping Stile and see what is still standing',
    offer: [
      { who: 'CARTOGRAPHER', text: 'I have the Stile on three sheets and no two of them agree, and all three are older than I am.' },
      { who: 'CARTOGRAPHER', text: 'Nobody has been down there since the flood. Go and look at it. I do not need a survey — I need somebody who has stood in it.' },
    ],
    nudge: [{ who: 'CARTOGRAPHER', text: 'West of here. Follow the water and stop when the trees close over.' }],
    thanks: [
      { who: 'CARTOGRAPHER', text: 'Still standing. Then the flood took the road and not the village, which is the opposite of what all three sheets say.' },
      { who: 'CARTOGRAPHER', text: 'That is worth what I am paying you and more.' },
    ],
    step: { kind: 'survey', area: 'weeping_stile', x: -2, z: 14 },
    reward: { ducats: 145 },
  },
  {
    id: 'what_the_child_saw',
    giver: 'brays_hollow:brays_child',
    title: 'Go up to the Rimefields and see if the lights are real',
    offer: [
      { who: 'CHILD', text: 'There are lights on the snow. I have seen them twice and nobody believes me because I am nine.' },
      { who: 'CHILD', text: 'You could go. You are allowed to go. Then somebody who is not nine will have seen them.' },
    ],
    nudge: [{ who: 'CHILD', text: 'West. Past where the road runs out. You have to go all the way onto the snow.' }],
    thanks: [
      { who: 'CHILD', text: 'You saw them. You *saw* them.' },
      { who: 'CHILD', text: 'Here. It is everything I have. Do not tell old Bray I gave it you.' },
    ],
    step: { kind: 'survey', area: 'rimefields', x: 2, z: 14 },
    reward: { ducats: 160 },
  },

  /* --- the deep country, which asks for a job done first ---------------------------- */
  {
    id: 'wood_for_the_brewer',
    giver: 'fenwicks_crossing:fenwick_brewer',
    title: 'Bring seasoned deadfall out of the Ashwood',
    offer: [
      { who: 'BREWER', text: 'Every cask I have is green and green wood makes beer that tastes like a hedge.' },
      { who: 'BREWER', text: 'What I want is Ashwood deadfall — down five years, dry through, and four hours from here in the wrong direction. I will pay for the walk as much as for the wood.' },
    ],
    nudge: [{ who: 'BREWER', text: 'The Ashwood. Up through the Levels and keep going north.' }],
    thanks: [
      { who: 'BREWER', text: 'Listen to it. That is a dry note. Green wood thuds.' },
      { who: 'BREWER', text: 'That is a season of casks. Paid in full and in shards, because I do not have that many Ducats in the house.' },
    ],
    step: {
      kind: 'gather',
      area: 'ashwood',
      x: -2,
      z: -14,
      art: 'deadfall',
      label: 'Take a length of deadfall',
    },
    reward: { ducats: 190, marrowShards: 4 },
    after: ['millers_debt'],
  },
  {
    id: 'bone_meal',
    giver: 'bonemarket:bonemarket_grocer',
    title: 'Bring back barrow chalk from the Bone Bastion',
    offer: [
      { who: 'GROCER', text: 'You will think this is a joke because of where I keep my stall. It is not.' },
      { who: 'GROCER', text: 'Barrow chalk. It goes in the bread and it has gone in the bread for two hundred years, and the last man who fetched it for me did not come back. Five crossings, and I pay like it.' },
    ],
    nudge: [{ who: 'GROCER', text: 'West of the Levels, behind the wall. You cannot miss the wall.' }],
    thanks: [
      { who: 'GROCER', text: 'That is the colour. Anything greyer than that came off a wall and not a mound.' },
      { who: 'GROCER', text: 'Everything in the till and half the shards I was keeping. You earned the walk twice.' },
    ],
    step: {
      kind: 'gather',
      area: 'bone_bastion',
      x: -10,
      z: 10,
      art: 'cairn',
      label: 'Take a handful of barrow chalk',
    },
    reward: { ducats: 210, marrowShards: 5 },
    after: ['herbs_from_the_stile'],
  },
  {
    id: 'chart_the_shelf',
    giver: 'saltglass:saltglass_chartmaker',
    title: 'Stand on the Storm Shelf and count the pylons',
    offer: [
      { who: 'CHART-MAKER', text: 'The Shelf is on my chart as nine pylons in four ranks, copied off a chart that was copied off a chart.' },
      { who: 'CHART-MAKER', text: 'Nobody has counted them. Go and count them. If it is nine I will say so and if it is not I will have found something.' },
    ],
    nudge: [{ who: 'CHART-MAKER', text: 'East, past Fenwick\'s. You will hear it before you see it.' }],
    thanks: [
      { who: 'CHART-MAKER', text: 'And the ranks? All four still up?' },
      { who: 'CHART-MAKER', text: 'Then the chart has been right for a hundred years and nobody knew. That is worth paying for.' },
    ],
    step: { kind: 'survey', area: 'storm_shelf', x: -2, z: 10 },
    reward: { ducats: 175, marrowShards: 3 },
    after: ['salt_for_the_butcher'],
  },
  {
    id: 'hedgerow_vermin',
    giver: 'ashfall_ward:ashfall_gate_guard',
    title: 'Clear the scavengers off the Chalk Verge',
    offer: [
      { who: 'GATE SENTRY', text: 'My warrant stops at the flags and there is a crew working the verge who know it to the yard.' },
      { who: 'GATE SENTRY', text: 'You have no such problem. Go out there and make it somebody else\'s shift.' },
    ],
    nudge: [{ who: 'GATE SENTRY', text: 'South, off the flags. They will find you before you find them.' }],
    thanks: [
      { who: 'GATE SENTRY', text: 'Quiet out there this morning. First time this month.' },
      { who: 'GATE SENTRY', text: 'Out of my own purse, and you never had it from me.' },
    ],
    step: { kind: 'cull', encounterId: 'pack_chalk_scavengers' },
    reward: { ducats: 90 },
  },
];

/* ------------------------------------------------------------------------------------ *
 * Lookups. Pure, and all of them take the ledger rather than reading one.
 * ------------------------------------------------------------------------------------ */

/** The open errand and whether its step is satisfied. One at a time — see the header. */
export interface ErrandState {
  readonly done: readonly string[];
  readonly active: { readonly id: string; readonly ready: boolean } | null;
}

export const NO_ERRANDS: ErrandState = { done: [], active: null };

export function errandById(id: string): ErrandDef | undefined {
  return ERRANDS.find((e) => e.id === id);
}

/** The one currently open, if there is one and it still names a real errand. */
export function activeErrand(state: ErrandState): ErrandDef | null {
  return state.active ? (errandById(state.active.id) ?? null) : null;
}

/**
 * What this person has to say about errands right now, or null for "nothing; use their script".
 *
 * The whole of the conversation logic, and it is deliberately one function: which of the four
 * things a townsperson is doing — offering, nudging, taking a delivery, taking a report — is a
 * question about global state, and answering it in four places in `DistrictScreen` is how two of
 * them end up disagreeing.
 */
export function errandFor(
  areaId: string,
  npcId: string,
  state: ErrandState,
): { readonly def: ErrandDef; readonly phase: 'offer' | 'nudge' | 'turnin' } | null {
  const who = `${areaId}:${npcId}`;
  const open = activeErrand(state);

  if (open) {
    const step = open.step;
    // A delivery is turned in at the far end, so the person in front of you may be the
    // *recipient* rather than the giver -- and that is the only case where somebody who never
    // offered you anything has something to say about it.
    if (step.kind === 'deliver' && `${step.toArea}:${step.toNpc}` === who) {
      return { def: open, phase: 'turnin' };
    }
    if (open.giver === who) {
      // Everything else is reported back to whoever asked, and only once the step is done.
      // `ready` is set by the world -- a won fight, a hotspot reached, a thing picked up.
      return { def: open, phase: state.active!.ready ? 'turnin' : 'nudge' };
    }
    // Somebody else entirely, while you are carrying something. They keep their own script,
    // and no second errand may be offered: see the one-at-a-time rule in the header.
    return null;
  }

  const next = ERRANDS.find((e) => e.giver === who && isOffered(e, state));
  return next ? { def: next, phase: 'offer' } : null;
}

/** Whether this errand is available to be taken: not done, and its prerequisites are. */
export function isOffered(def: ErrandDef, state: ErrandState): boolean {
  if (state.done.includes(def.id)) return false;
  return (def.after ?? []).every((id) => state.done.includes(id));
}

/**
 * Whether a finished fight satisfies the open errand.
 *
 * Asked of the encounter rather than pushed by it, because a cull can be completed by walking
 * into the pack the ordinary way — the errand does not own the fight, it only cares that it
 * happened. Somebody who was already going to clear that road gets the credit.
 *
 * **Every pack in the fight counts, not only the one that started it.** The Combat Ring drags in
 * anything roaming nearby, and `main.ts` puts every one of them on the hunt clock on a win — so
 * a gutter crew pulled into somebody else's ambush is just as dead and just as gone from the
 * road. Crediting only the host meant the errand's pack could die, vanish for its whole cooldown,
 * and leave the job open with nothing left to kill: uncompletable, and with one errand slot and
 * no way to give it back, that locked the player out of the entire system.
 */
export function cullSatisfiedBy(state: ErrandState, ...fought: readonly string[]): boolean {
  const open = activeErrand(state);
  return open?.step.kind === 'cull' && fought.includes(open.step.encounterId);
}

/** Where in the world the open errand wants you, if anywhere. Null for a cull. */
export function errandMarker(state: ErrandState): ErrandMarker | null {
  const open = activeErrand(state);
  if (!open || state.active?.ready) return null;
  const step = open.step;
  if (step.kind === 'survey') {
    return { area: step.area, x: step.x, z: step.z, art: null, label: 'Look around' };
  }
  if (step.kind === 'gather') {
    return { area: step.area, x: step.x, z: step.z, art: step.art, label: step.label };
  }
  // A cull has no marker and wants none: the thing to find is already walking about out there
  // with a vision cone on it, and a cairn beside a roaming pack would be pointing at a patch of
  // road the pack had left ten seconds later.
  return null;
}

/** Somewhere the open errand wants you to stand. `art` is null for a survey — see below. */
export interface ErrandMarker {
  readonly area: string;
  readonly x: number;
  readonly z: number;
  /**
   * What is standing there, or null to mark the spot rather than an object.
   *
   * A survey has nothing to pick up, so it gets a cairn — which the atlas already calls "the
   * only mark people leave on the wilds", and is therefore exactly what somebody sent to look at
   * a place would be looking for.
   */
  readonly art: Exclude<DressingId, 'waystone'> | null;
  readonly label: string;
}

/** The line the objective panel shows, or null when nothing is open. */
export function errandObjective(state: ErrandState): string | null {
  const open = activeErrand(state);
  if (!open) return null;
  // Prefixed rather than replaced. The player has been carrying this line for a while and
  // swapping it for "go back to the miller" loses the one piece of context that makes the walk
  // make sense -- which of the several things you have been doing you are being paid for.
  return state.active?.ready ? `Report back: ${open.title}` : open.title;
}
