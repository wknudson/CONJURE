/**
 * What the street knows about what you have done.
 *
 * `docs/worldbuild-todo.md` has asked for this in four separate waves, in four separate words:
 *
 * - Wave 2: graffiti that appears when it should rather than from turn one;
 * - Wave 4: `DON'T CARRY IT IN` is on Ashfall's wall and belongs on Highcourt's, late;
 * - Wave 6: *"the Census clerk says the same thing before and after you walk the Stile"*;
 * - Wave 7: *"no way for a prop to say anything conditional"*.
 *
 * All four are the same missing thing: the district was handed a `campaign` ledger by nobody and
 * read it nowhere. Forty-eight people and every painted wall in Azo said one fixed sentence for
 * the length of a campaign that is *about them*.
 *
 * ## The shape, and why it is a second registry rather than a field
 *
 * `FOLK_LINES` is four hundred lines of prose keyed by script name. Teaching every entry there
 * to be a list of gated variants would have rewritten all of it to make a dozen of them
 * conditional. So this is an **overlay**: a separate table of gated lines keyed by the same
 * script name, consulted first and falling through to the fixed script when nothing matches.
 * The existing dialogue did not change by a character.
 *
 * That is the same trade `errands.ts` makes by naming its own giver instead of adding a field to
 * `NpcSpec`, and the same one `dressing.ts` makes with one registry instead of twenty fields.
 *
 * ## The gate
 *
 * Two lists and no expression language. `after` is "all of these have happened" and `before` is
 * "none of these have yet", which between them buy every shape actually wanted: appears once X
 * is done, disappears once Y is done, and lives only in the window between the two. Anything
 * needing more than that wants a script, and a script is not what a wall is.
 *
 * Pure: no three.js, no DOM, no save. It reads a ledger of ids and returns lines and booleans.
 */

import type { ErrandLine } from './errands.js';

/**
 * What has happened, as far as the world is concerned.
 *
 * One field today. It is an object rather than a bare array because the next thing to reach in
 * here is certainly the errand ledger — a townsperson ought to be able to remark that you ran a
 * job for their neighbour — and widening an interface is cheaper than changing every call site
 * from an array to one.
 */
export interface Chronicle {
  /** Story contracts resolved, by encounter id. `Profile.campaign`, handed over as it is. */
  readonly campaign: readonly string[];
}

export const NOTHING_HAPPENED: Chronicle = { campaign: [] };

/** When a thing is true. Absent lists are not conditions. */
export interface Gate {
  /** Every one of these contracts must have been walked. */
  readonly after?: readonly string[];
  /** None of these may have been walked yet. */
  readonly before?: readonly string[];
}

export function gateOpen(gate: Gate | undefined, chron: Chronicle): boolean {
  if (!gate) return true;
  if ((gate.after ?? []).some((id) => !chron.campaign.includes(id))) return false;
  if ((gate.before ?? []).some((id) => chron.campaign.includes(id))) return false;
  return true;
}

/** A gated replacement for somebody's fixed script. */
export interface Aside {
  /** The script name it stands in for — the key `NpcSpec.says` uses, defaulting to the id. */
  readonly says: string;
  readonly gate: Gate;
  readonly lines: readonly ErrandLine[];
}

/* ------------------------------------------------------------------------------------ *
 * What people say once something has happened.
 *
 * Written to one rule beyond the one `FOLK_LINES` already follows: **an aside must answer the
 * line it replaces.** Half the fixed scripts in this world are predictions — the miller says
 * something has been living in the flooded end, the fisherman says there will be trouble on
 * this quay before the month is out — and the whole value of reading the ledger is being able
 * to say *what happened next*. An aside that merely rephrases the original is a variant, not a
 * consequence, and is worse than nothing because it costs a lookup to say the same thing.
 * ------------------------------------------------------------------------------------ */

export const ASIDES: readonly Aside[] = [
  /* --- the one that fixes a leak ---------------------------------------------------- */
  {
    // The Census clerk's fixed script says "RELOCATED, it says beside them. LABOUR." — which is
    // the *crack* of `hollow_census`, the reveal you are supposed to walk the Stile to find.
    // She has been giving it away to anyone who talked to her, before the contract, for as long
    // as she has stood there. This is what she knows beforehand: that the village stopped
    // answering, and nothing about why.
    says: 'stile_census_clerk',
    gate: { before: ['hollow_census'] },
    lines: [
      { who: 'CENSUS CLERK', text: 'Sixty-one souls on the roll. The village stopped answering two counts ago.' },
      { who: 'CENSUS CLERK', text: 'I am to go through room by room and write what I find. I have done eleven villages. I have never been sent to one twice.' },
    ],
  },

  /* --- Jolrek ------------------------------------------------------------------------ */
  {
    says: 'lamprow_tithe_clerk',
    gate: { after: ['lamprow_tithe'] },
    lines: [
      { who: 'TITHE CLERK', text: 'The arrears you collected are marked paid. They were marked paid before you went.' },
      { who: 'TITHE CLERK', text: 'Twice, in two hands, on two dates. I have stopped asking which of them is mine.' },
    ],
  },
  {
    says: 'lamprow_pit_miner',
    gate: { after: ['lamplighter_escort'] },
    lines: [
      { who: 'ELLERY PIT HAND', text: 'You walked the lamps out past the kerb. Those were pit men. Same shift as me, same note on the same gate.' },
      { who: 'ELLERY PIT HAND', text: 'They are calling it an escort. Twelve years down that hole and now we are what needs escorting through.' },
    ],
  },
  {
    says: 'ward_seven_healer',
    gate: { after: ['fouled_cistern'] },
    lines: [
      { who: 'WARD HEALER', text: 'You went down into it. Then you know it was not the cistern that was sick.' },
      { who: 'WARD HEALER', text: 'I have been treating the water for two years. Nobody asked me what was in it, and I am not a person anybody asks.' },
    ],
  },
  {
    says: 'bonemarket_fishmonger',
    gate: { after: ['saltglass_riot'] },
    lines: [
      { who: 'FISHMONGER', text: 'Carts are through. Not because the writ lifted — because there is nobody left on that quay to stop them loading.' },
      { who: 'FISHMONGER', text: 'I am selling Saltglass fish at Saltglass prices and I cannot look at the stall while I do it.' },
    ],
  },
  {
    says: 'highcourt_crier',
    gate: { after: ['bone_bastion'] },
    lines: [
      { who: 'TOWN CRIER', text: 'One posting on the board this morning and it has your name on it. I read it out four times.' },
      { who: 'TOWN CRIER', text: 'They do not summon people to the Spire. They send for them. This one is posted like a hanging.' },
    ],
  },
  {
    says: 'ashfall_gate_guard',
    gate: { after: ['the_summons'] },
    lines: [
      { who: 'GATE SENTRY', text: 'Nobody has come down from the Spire since. No writs, no relocations, no quota.' },
      { who: 'GATE SENTRY', text: 'I am still standing on the flags because I do not know what else to stand on. Ask me again in a month.' },
    ],
  },
  {
    says: 'cinderworks_smith',
    gate: { after: ['smoke_eaters_rest'] },
    lines: [
      { who: 'FOUNDRY SMITH', text: 'The rest house is quiet. That is the first quiet thing in this ward in eleven years and I do not trust it.' },
      { who: 'FOUNDRY SMITH', text: 'Whatever was in there was breathing what we breathe. It just did it longer.' },
    ],
  },

  /* --- the Middle Ring --------------------------------------------------------------- */
  {
    says: 'millharrow_miller',
    gate: { after: ['drowned_granary'] },
    lines: [
      { who: 'THE MILLER', text: 'Channel ran clear inside the hour. Then it kept running, and it has not stopped since.' },
      { who: 'THE MILLER', text: 'That thing was not damming my sluice. It was the only lid on it. You took the lid off for four crowns and a handshake, and so did I.' },
    ],
  },
  {
    says: 'millharrow_farmer_wife',
    gate: { after: ['chalk_road_toll'] },
    lines: [
      { who: 'A FARMER WIFE', text: 'Toll gate is down and the road is open. Everybody keeps saying that to me like it settles it.' },
      { who: 'A FARMER WIFE', text: 'He was fourteen. I told you he was fourteen before you went and I will keep telling you.' },
    ],
  },
  {
    says: 'millharrow_baker',
    gate: { after: ['waystone_duel'] },
    lines: [
      { who: 'BAKER', text: 'The children still walk the bread out to the waystone. There is nobody there to take it.' },
      { who: 'BAKER', text: 'They leave it on the stone anyway. I have stopped telling them not to.' },
    ],
  },
  {
    says: 'tallow_farmer_daughter',
    gate: { after: ['tallow_blight'] },
    lines: [
      { who: 'FARM GIRL', text: 'I said it did not spread like blight. Father has stopped calling it blight.' },
      { who: 'FARM GIRL', text: 'He has not started calling it anything else, either. The north field is still bare and now the middle one is going.' },
    ],
  },
  {
    says: 'saltglass_fisherman',
    gate: { after: ['saltglass_riot'] },
    lines: [
      { who: 'FISHERMAN', text: 'Driftwood pikes. I said it would come to that and I was hoping to be wrong in front of you.' },
      { who: 'FISHERMAN', text: 'The harbour is still shut. That is the part nobody mentions — we did all that and the writ never moved.' },
    ],
  },
  {
    says: 'brays_elder',
    gate: { after: ['hollow_census'] },
    lines: [
      { who: 'OLD BRAY', text: 'Word came up the lane about the Stile. Sixty-one, and a page torn out.' },
      { who: 'OLD BRAY', text: 'There is no town here either. I have said that for forty years and I used to mean it as a joke.' },
    ],
  },
  {
    says: 'fenwick_cartographer',
    gate: { after: ['hollow_census'] },
    lines: [
      { who: 'CARTOGRAPHER', text: 'I have three sheets with the Stile on them and a fourth now, from the Census office. Sixty-one names.' },
      { who: 'CARTOGRAPHER', text: 'The new one has the village marked and no roll at all. A place with no people in it is not a smaller place. It is a different one.' },
    ],
  },
];

/**
 * What this person says right now, or null for "nothing; use their fixed script".
 *
 * First match wins and the table is read in order, so a later, deeper gate on the same person
 * should be written *above* an earlier one. Two asides that are open at once is not an error —
 * it is a person with more than one thing on their mind, and the file's order decides.
 */
export function asideFor(says: string, chron: Chronicle): readonly ErrandLine[] | null {
  const found = ASIDES.find((a) => a.says === says && gateOpen(a.gate, chron));
  return found ? found.lines : null;
}
