/**
 * Things you can read: posted bills, plaques, ledgers, the writing on a grave.
 *
 * The world had two ways to say something in text -- graffiti on a wall and a line cut into a
 * waystone -- and both are one sentence seen from across a street. A notice is the third: a
 * thing you walk up to and open, a title and a few lines, in the same overlay the Bounty Board
 * and the stalls use. It is the cheapest content in the game per word, which is why it exists:
 * a room with nothing to read in it is a room you cross once.
 *
 * Addressed into areas from outside by area id -- the pattern `sites.ts`, `errands.ts` and
 * `benches.ts` keep -- and gated by the Chronicle like an aside, so a ledger can say one thing
 * before a contract and another after. Two notices may share an `at`; the first whose gate is
 * open is the one that stands there, which is the `ASIDES` idiom and reads the same way.
 *
 * Pure: no three.js, no DOM.
 */

import type { DressingId } from './dressing.js';
import { gateOpen, type Chronicle, type Gate } from './chronicle.js';

/** What kind of thing it is, which decides how the panel sets it. */
export type NoticeForm = 'notice' | 'plaque' | 'gravestone' | 'ledger' | 'book';

export interface NoticeDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to read it. Walkable, clear of the furniture. */
  readonly at: { readonly x: number; readonly z: number };
  readonly form: NoticeForm;
  /** The interact prompt: "Read the notice". */
  readonly label: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** When it is up. Absent means always. */
  readonly gate?: Gate;
  /** The thing it is written on, if a piece of furniture stands for it. Placed by `world.ts`. */
  readonly prop?: {
    readonly kind: DressingId;
    readonly x: number;
    readonly z: number;
    readonly yaw?: number;
  };
  /** Raised into the world's flags the first time it is read, so the Chronicle can know. */
  readonly flag?: string;
}

export const NOTICES: readonly NoticeDef[] = [
  /* --- Ashfall Ward ------------------------------------------------------------------ */
  {
    id: 'ashfall_ward:magistracy_bill',
    areaId: 'ashfall_ward',
    at: { x: 16, z: 23 },
    form: 'notice',
    label: 'Read the posted bill',
    title: 'BY ORDER OF THE MAGISTRACY OF ASHFALL WARD',
    lines: [
      'The sanctioned walkway is sanctuary. No officer of the ward may lay hands on a citizen standing upon it.',
      'Ground beyond the kerb is not sanctuary. Citizens found upon it after the curfew bell will be escorted to the nearest flagstone and assessed.',
      'Assessment is payable in Ducats. Assessment is not a fine. The Magistracy does not levy fines.',
      'Posted by the Ward Clerk. Defacement of this bill is assessable.',
    ],
    prop: { kind: 'noticepost', x: 16, z: 20.4 },
  },
  {
    id: 'ashfall_ward:harbour_writ',
    areaId: 'ashfall_ward',
    at: { x: -20, z: -38.6 },
    form: 'notice',
    label: 'Read the harbour writ',
    title: 'WRIT OF CLOSURE — ASHFALL WHARF',
    lines: [
      'The wharf is closed to unlicensed freight by order of the Magistracy. Licences are issued at the Toll House and are not issued.',
      'Vessels tied up without a licence are impounded. Impounded vessels are auctioned. Auctions are held at the Counting House and are not announced.',
      'The canal remains open. The canal has never been the problem.',
    ],
    prop: { kind: 'noticepost', x: -20, z: -41.6 },
  },
  {
    id: 'ashfall_ward:grave_hollis',
    areaId: 'ashfall_ward',
    at: { x: -46, z: 47.6 },
    form: 'gravestone',
    label: 'Read the stone',
    title: 'MARGARET HOLLIS',
    lines: ['Of the granary.', 'She kept the count honest and the Magistracy kept the count.', 'Assessed in full.'],
    prop: { kind: 'gravestone', x: -46, z: 50 },
  },
  {
    id: 'ashfall_ward:grave_unnamed',
    areaId: 'ashfall_ward',
    at: { x: -30, z: 47.6 },
    form: 'gravestone',
    label: 'Read the stone',
    title: '— — —',
    lines: ['The name has been chiselled off.', 'Under it, in a different hand and a different tool:', 'RELOCATED.'],
    prop: { kind: 'gravestone', x: -30, z: 50 },
  },

  /* --- the Toll House ---------------------------------------------------------------- */
  {
    id: 'ashfall_toll_house:tariff',
    areaId: 'ashfall_toll_house',
    at: { x: 2, z: -15.6 },
    form: 'plaque',
    label: 'Read the tariff',
    title: 'TARIFF OF THE ASHFALL WHARF',
    lines: [
      'Coal, per barge: four Ducats. Grain, per barge: six. Marrow, per barge: assessed on inspection.',
      'Passengers: one Ducat a head, two if they are carrying anything, three if they will not say what.',
      'The strongbox behind the desk holds the day’s takings until the Counting House sends for them. The Counting House has not sent for them in some time.',
    ],
    prop: { kind: 'plaque', x: 2, z: -17.85 },
    flag: 'read_toll_tariff',
  },

  /* --- the Counting House ------------------------------------------------------------ */
  {
    id: 'ashfall_counting_house:arrears_ledger',
    areaId: 'ashfall_counting_house',
    at: { x: 0, z: -10.8 },
    form: 'ledger',
    label: 'Read the arrears',
    title: 'THE ARREARS — ASHFALL WARD — THIS QUARTER',
    lines: [
      'Hearths in arrears: 388. Hearths assessed: 388. Hearths collected: 388.',
      'Sum collected: 6,208 Ducats. Sum remitted to the Spire: 6,208 Ducats. Sum remaining in the ward: nil.',
      'Note, in the margin: "Nil is the figure the Spire asked for. The box says otherwise. Do not correct the box."',
    ],
    prop: { kind: 'lectern', x: 0, z: -14 },
    flag: 'read_the_arrears',
  },

  /* --- the chapel -------------------------------------------------------------------- */
  {
    id: 'ashfall_chapel:the_flame',
    areaId: 'ashfall_chapel',
    at: { x: 0, z: 13 },
    form: 'plaque',
    label: 'Light a candle at the Quiet Flame',
    title: 'THE QUIET FLAME',
    lines: [
      'You take a taper from the box and light it from the Flame, and set it in the sand with the others.',
      'The words are cut into the hearthstone, worn shallow: WHAT IS BOUND IS NOT OWNED. WHAT IS KEPT IS NOT KEPT FOR EVER.',
      'The keeper does not look up. He has seen people light candles before.',
    ],
    flag: 'lit_a_candle',
  },
  {
    id: 'ashfall_chapel:plaque_of_names',
    areaId: 'ashfall_chapel',
    at: { x: -16, z: -2 },
    form: 'plaque',
    label: 'Read the plaque',
    title: 'REMEMBERED HERE',
    lines: [
      'Those of the ward who bound and were unbound: forty-one names, and room left for more.',
      'The last three are cut fresher than the rest. The last one is cut in the same hand as the harbour writ.',
    ],
    prop: { kind: 'plaque', x: -19.85, z: -2, yaw: Math.PI / 2 },
  },

  /* --- the Cinder Cup ---------------------------------------------------------------- */
  {
    // What the board says once the Lamprow tithe has been collected. Above the ordinary board
    // so it wins the same wall -- the `ASIDES` rule.
    id: 'ashfall_cinder_cup:rumour_board_late',
    areaId: 'ashfall_cinder_cup',
    at: { x: -8, z: -19.4 },
    form: 'notice',
    label: 'Read the board',
    title: 'THE CINDER CUP — WHAT IS SAID',
    lines: [
      'That the tithe in Lamprow was collected twice, and the second collector has not been seen since.',
      'That the Warden’s beat now passes the Counting House door, which it never used to.',
      'That the publican will not serve the Tithe-Takers and the Tithe-Takers have not come in to be refused.',
    ],
    gate: { after: ['lamprow_tithe'] },
    prop: { kind: 'plaque', x: -8, z: -21.85 },
  },
  {
    id: 'ashfall_cinder_cup:rumour_board',
    areaId: 'ashfall_cinder_cup',
    at: { x: -8, z: -19.4 },
    form: 'notice',
    label: 'Read the board',
    title: 'THE CINDER CUP — WHAT IS SAID',
    lines: [
      'That there is a new Whisperer in the ward, and that the Dispatcher has already found them work.',
      'That the Lamprow tithe is due again, and that the collectors below the kerb do not carry a ledger.',
      'That the bed upstairs is twenty Ducats and worth it, and that the publican wrote this himself.',
    ],
    prop: { kind: 'plaque', x: -8, z: -21.85 },
  },

  /* --- Lamprow ----------------------------------------------------------------------- */
  {
    id: 'lamprow:tithe_bill',
    areaId: 'lamprow',
    at: { x: 20, z: -4.6 },
    form: 'notice',
    label: 'Read the tithe bill',
    title: 'THE LIGHT TITHE — LAMPROW — THIS QUARTER',
    lines: [
      'Every hearth on the High Street is assessed for the lamp nearest it. Every hearth in the Sink is assessed for the lamp it can see.',
      'Payment is taken at the Tithe Office by day and by the collectors by night. The collectors do not issue receipts.',
      'A hearth that cannot see a lamp is assessed for the dark. The dark is also Magistracy property.',
    ],
    prop: { kind: 'noticepost', x: 20, z: -7.6 },
  },
  {
    id: 'lamprow_oil_house:measure',
    areaId: 'lamprow_oil_house',
    at: { x: 2, z: -15.6 },
    form: 'plaque',
    label: 'Read the measure',
    title: 'THE MEASURE — LAMP OIL, BY THE WARD',
    lines: [
      'One lamp, one night: a gill. One row, one night: nine gills. One ward, one quarter: the keeper will not say, because the number is the tithe.',
      'Oil is sold to the Magistracy at the measure and to nobody else. What is on the shelf is what the Magistracy did not take.',
      'A gill spilled is a gill billed. The iron floor is for the drips, not for you.',
    ],
    prop: { kind: 'plaque', x: 2, z: -17.85 },
    flag: 'read_the_measure',
  },
  {
    id: 'lamprow_tithe_office:arrears',
    areaId: 'lamprow_tithe_office',
    at: { x: 0, z: -10.8 },
    form: 'ledger',
    label: 'Read the arrears',
    title: 'THE LIGHT TITHE — ARREARS',
    lines: [
      'Hearths on the High Street: 62. In arrears: 0. Hearths in the Sink: 140. In arrears: 140.',
      'Collected from the Sink this quarter, by the office: nil. Collected from the Sink this quarter, by the collectors: not recorded.',
      'Note, in the bailiff’s hand: "Not recorded is not the same as not collected. Ask the cellar."',
    ],
    prop: { kind: 'lectern', x: 0, z: -14 },
  },

  /* --- the Bonemarket ---------------------------------------------------------------- */
  {
    id: 'bonemarket:weigh_house_rates',
    areaId: 'bonemarket',
    at: { x: 14, z: -40.6 },
    form: 'notice',
    label: 'Read the weigh-house rates',
    title: 'THE WEIGH-HOUSE — RATES AND RULINGS',
    lines: [
      'Every slab is weighed at the weigh-house before it opens and the weigh-house is paid by the pound. The weigh-house is also paid by the trader. Both of these are the same coin.',
      'Disputes are settled by a second weighing. The second weighing is also paid for.',
      'Bone is weighed dry. Meat is weighed wet. Fish is weighed whenever the fishmonger is not looking.',
    ],
    prop: { kind: 'noticepost', x: 14, z: -43.4 },
  },
  {
    id: 'bonemarket_hall:weigh_house_board',
    areaId: 'bonemarket_hall',
    at: { x: 0, z: -21.6 },
    form: 'plaque',
    label: "Read the stallkeeper's board",
    title: "SUNDRIES — TODAY'S BOARD",
    lines: [
      'Twine, tallow, nails by the handful, a boot without its brother, a hat somebody died in.',
      'Nothing on this board can be carried out of here in a Whisperer’s satchel; the satchel is for brews. The stallkeeper is aware of this and finds it funny.',
      'Cores are the alchemist’s, on the floor, at his price.',
    ],
    prop: { kind: 'plaque', x: 0, z: -23.85 },
  },
  {
    id: 'bonemarket_hall:slab_board',
    areaId: 'bonemarket_hall',
    at: { x: 30, z: -8 },
    form: 'plaque',
    label: "Read the fishmonger's board",
    title: 'OFF THE CUT — TODAY',
    lines: [
      'Eel, canal. Roach, canal. Something with too many fins, canal, do not ask.',
      'Nothing off the sea since the harbour writ. The board used to be longer.',
    ],
    prop: { kind: 'plaque', x: 31.85, z: -8, yaw: -Math.PI / 2 },
  },
  {
    id: 'bonemarket_pawnshop:terms',
    areaId: 'bonemarket_pawnshop',
    at: { x: 4, z: -12 },
    form: 'plaque',
    label: 'Read the terms of pledge',
    title: 'TERMS OF PLEDGE',
    lines: [
      'A pledge is held one quarter. Interest is a tenth by the month. Redemption is in coin, in person, in daylight.',
      'A pledge not redeemed is sold. A pledge sold is not discussed.',
      'The Magistracy assesses the shop on what it holds, so the shop holds as little as it can and the shelf behind the desk is not on the inventory.',
    ],
    prop: { kind: 'plaque', x: 4, z: -15.85 },
  },

  /* --- the Cinderworks --------------------------------------------------------------- */
  {
    id: 'cinderworks:quota_board',
    areaId: 'cinderworks',
    at: { x: 34, z: -15 },
    form: 'notice',
    label: 'Read the quota board',
    title: 'THE WORKS — THIS QUARTER',
    lines: [
      'Pig iron, the Spire’s order: 400 pigs. Cast: 412. Delivered: 400. Remaining in the yard: 12, and do not ask which yard.',
      'Casualties, furnace: 3. Casualties, flats: not recorded. The flats are not part of the works.',
      'Coal from the Caldera cut is short by a third. The wind has changed. The quota has not.',
    ],
    prop: { kind: 'noticepost', x: 34, z: -18 },
  },
  {
    id: 'cinderworks_foundry:tally',
    areaId: 'cinderworks_foundry',
    at: { x: -26, z: -4 },
    form: 'plaque',
    label: "Read the foreman's tally",
    title: 'THE HALL — TALLY',
    lines: [
      'Heats today: 6. Heats lost: 1, to the flats. Men on the flats when it went: 4. Men off the flats after: 4, walking.',
      'Nothing is stolen from this hall. The flats let things go, and what they let go walks out the door on its own legs.',
      'Whisperers wanting the flats: speak to the foreman. He will not stop you. He will not come.',
    ],
    prop: { kind: 'plaque', x: -29.85, z: -4, yaw: Math.PI / 2 },
  },
  {
    id: 'cinderworks_posters:the_bill',
    areaId: 'cinderworks_posters',
    at: { x: -4, z: -15.6 },
    form: 'notice',
    label: "Read tonight's bill",
    title: 'TO THE WARD, FROM NOBODY',
    lines: [
      'THE LID IS OURS TOO. THE STACK NEVER SLEEPS AND NEITHER DO WE.',
      'The Magistracy counts the pigs and not the men. Count yourselves. Then count who is missing off the flats.',
      'Pasted at dawn. Taken down by noon. Read it in the four hours it exists, which is four more than the count gets.',
    ],
    prop: { kind: 'plaque', x: -4, z: -17.85 },
  },

  /* --- Ward Seven -------------------------------------------------------------------- */
  {
    id: 'ward_seven:water_notice',
    areaId: 'ward_seven',
    at: { x: -14, z: -8.6 },
    form: 'notice',
    label: 'Read the water notice',
    title: 'NOTICE TO THE HEARTHS OF WARD SEVEN',
    lines: [
      'The north pipe is closed. The south pipe is closed. The basin is not a pipe and drawing from it is not advised, not forbidden, and not the Magistracy’s concern.',
      'The pump house is Magistracy property. The pump is running. Where the water it pumps is going is a matter for the Counting House.',
      'Reports of fouling should be made to the healer, who is assessed for receiving them.',
    ],
    prop: { kind: 'noticepost', x: -14, z: -11 },
  },
  {
    id: 'ward_seven:drowned_grave',
    areaId: 'ward_seven',
    at: { x: -46, z: 19.6 },
    form: 'gravestone',
    label: 'Read the stone',
    title: 'THE SEEP TOOK THEM',
    lines: ['Eleven hearths, one winter.', 'The stone was cut before the water reached it. It has reached it.'],
    prop: { kind: 'gravestone', x: -46, z: 22 },
  },
  {
    id: 'ward_seven_cistern:pump_plate',
    areaId: 'ward_seven_cistern',
    at: { x: 6, z: 20.4 },
    form: 'plaque',
    label: 'Read the pump plate',
    title: 'ENGINE No. 3 — MAGISTRACY OF JOLREK',
    lines: [
      'Cast at the Cinderworks. Installed the year the basin stopped draining. Rated to lift the cistern in a season.',
      'It has run for nine years. The cistern is where it was. The pumpman says the pipe it lifts into runs uphill to the Spire, and he has never been told otherwise.',
    ],
    prop: { kind: 'plaque', x: 6, z: 23.85, yaw: Math.PI },
  },
  {
    id: 'ward_seven_clinic:quota_ledger',
    areaId: 'ward_seven_clinic',
    at: { x: 10, z: 7.4 },
    form: 'ledger',
    label: 'Read the quota ledger',
    title: 'THE CLINIC QUOTA — WARD SEVEN',
    lines: [
      'Treatments billed to the Magistracy: seven a week. Treatments given: as many as come through the door, which this week is thirty-one.',
      'The twenty-four the Magistracy did not pay for are entered under "declined". None of them were declined.',
      'In the margin: "If the pipe is closed, close the ledger too."',
    ],
    prop: { kind: 'lectern', x: 10, z: 4 },
    flag: 'read_clinic_quota',
  },

  /* --- the Chalk Verge, and the road ------------------------------------------------- */
  {
    id: 'chalk_verge:gate_grave',
    areaId: 'chalk_verge',
    at: { x: 46, z: 22.6 },
    form: 'gravestone',
    label: 'Read the stone by the gate',
    title: 'A CARTER',
    lines: [
      'Read the stone. Then read it again, the far side of the gate, where it is the last thing you read.',
      'Cut by the ward, which does not cut stones for carters, which tells you who was on the cart.',
    ],
    prop: { kind: 'gravestone', x: 46, z: 26 },
  },
  {
    id: 'chalk_verge_bothy:shepherds_tally',
    areaId: 'chalk_verge_bothy',
    at: { x: -10, z: 10 },
    form: 'book',
    label: "Read the shepherd's tally",
    title: 'THE TALLY — FOUR WINTERS',
    lines: [
      'Scavengers: any hour. They are the road, not something on it.',
      'Dogs: after dark. The heaps: after dark, and never once in the light, whatever the thing in them is.',
      'Fourth winter, last line: "Taking the flock down to the Crossing. If the bothy is open, it is yours. Leave something in the tin."',
    ],
    prop: { kind: 'lectern', x: -14, z: 10 },
    flag: 'read_the_tally',
  },
  {
    id: 'chalk_road:yard_grave_west',
    areaId: 'chalk_road',
    at: { x: 20, z: -9 },
    form: 'gravestone',
    label: 'Read the west grave',
    title: 'TOLL-KEEPER',
    lines: [
      'The Magistracy’s keeper, buried by the Magistracy, at the Magistracy’s expense. The stone says the expense.',
      'It does not say what he was keeping the toll from. The next stone does.',
    ],
    prop: { kind: 'gravestone', x: 20, z: -6.4 },
  },
  {
    id: 'chalk_road:yard_grave_east',
    areaId: 'chalk_road',
    at: { x: 30, z: -9 },
    form: 'gravestone',
    label: 'Read the east grave',
    title: 'NO NAME',
    lines: [
      'A cart-load, one grave. Cut by whoever cut the keeper’s, in the same hand, without the expense.',
      'Underneath, newer, scratched: "WAYWATCH". Nobody has scratched it out.',
    ],
    prop: { kind: 'gravestone', x: 30, z: -6.4 },
  },
  {
    id: 'chalk_road_waystation:ledger',
    areaId: 'chalk_road_waystation',
    at: { x: -14, z: -14 },
    form: 'ledger',
    label: 'Read the toll ledger',
    title: 'TOLL LEDGER — THE CHALK ROAD BAR',
    lines: [
      'Carts by day, six a week, a Ducat a wheel. Freight by night, unlisted, a column of its own that is not added up.',
      'Last page: "Waywatch at the stretch again. Sent to Jolrek for men. Sent again."',
      'Under it, the line stops half way through a word, and the ink went somewhere else.',
    ],
    prop: { kind: 'lectern', x: -18, z: -14 },
    flag: 'read_the_toll_ledger',
  },

  /* --- Millharrow, and the Levels ---------------------------------------------------- */
  {
    id: 'millharrow:toll_schedule',
    areaId: 'millharrow',
    at: { x: 26, z: 2 },
    form: 'notice',
    label: 'Read the toll schedule',
    title: 'SCHEDULE OF TOLLS — MILLHARROW GATE',
    lines: [
      'A Ducat a wheel, a half for a beast, nothing for a person on foot. Payable at the gate, in daylight, to the tollman, against this schedule and no other.',
      'Any toll taken on the Chalk Road east of this gate is not the Magistracy’s and should be reported to the tollman, who is not permitted to leave the gate to look.',
    ],
    prop: { kind: 'noticepost', x: 26, z: -1.4 },
  },
  {
    // What the town puts up for the boy, once the road is opened. The farmer wife's aside,
    // in stone.
    id: 'millharrow:the_boys_stone',
    areaId: 'millharrow',
    at: { x: -46, z: 33.4 },
    form: 'gravestone',
    label: 'Read the stone in the south field',
    title: 'A BOY. FOURTEEN.',
    lines: [
      'No name. A tithe mark cut where the name would go, because that is what he had instead of one.',
      'Somebody leaves bread on it. The children, probably. They leave it on the waystone too.',
    ],
    gate: { after: ['chalk_road_toll'] },
    prop: { kind: 'gravestone', x: -46, z: 30 },
  },
  {
    id: 'millharrow_mill:the_book',
    areaId: 'millharrow_mill',
    at: { x: -10, z: 10 },
    form: 'ledger',
    label: "Read the mill's book",
    title: 'THE MILL’S BOOK',
    lines: [
      'Grain in, by the cart, from every strip on the cross. Flour out, by the sack, to Fenwick’s and the Bonemarket and the ward.',
      'A third column, in the millhand’s hand: what the toll on the road took off each cart before it got here. It is the biggest number on the page.',
      'Bottom line: "Four sacks in, two paid. Fenwick’s." Underlined twice.',
    ],
    prop: { kind: 'lectern', x: -14, z: 10 },
    flag: 'read_the_mills_book',
  },
  {
    id: 'tallow_levels:condemnation',
    areaId: 'tallow_levels',
    at: { x: -6, z: -30 },
    form: 'notice',
    label: 'Read the order of condemnation',
    title: 'ORDER OF CONDEMNATION — THE NORTH FIELD',
    lines: [
      'By order of the Magistracy the north field of the Tallow Levels is condemned as blighted and is not to be worked, grazed, or crossed.',
      'The pump house is sealed pending inspection. The inspection is not scheduled.',
    ],
    prop: { kind: 'noticepost', x: -6, z: -33.4 },
  },
  {
    id: 'tallow_levels:drowned_hearth',
    areaId: 'tallow_levels',
    at: { x: -54, z: -22.6 },
    form: 'gravestone',
    label: 'Read the hearth-stone',
    title: 'A HEARTH, STOOD ON END',
    lines: [
      'A hearth-stone from a house that is under the north cut now, stood up as a marker because there was no other stone to hand.',
      'Scratched into it: the name of the house, and "DRAINED 1 YEAR. DROWNED 40."',
    ],
    prop: { kind: 'gravestone', x: -54, z: -26 },
  },
  {
    id: 'tallow_pump_house:the_log',
    areaId: 'tallow_pump_house',
    at: { x: -14, z: 6 },
    form: 'ledger',
    label: 'Read the pump log',
    title: 'PUMP LOG — TALLOW LEVELS ENGINE',
    lines: [
      'Daily, for eleven years: hours run, water lifted, coal burned. Then a fortnight of "engine stopped — no coal — sent to Jolrek".',
      'Then, in a different hand: "Something in the intake. Cleared it. It came back. Cleared it. It came up the pipe."',
      'The last line is not an entry. It is the chain being put on the door from the outside.',
    ],
    prop: { kind: 'lectern', x: -18, z: 6 },
    flag: 'read_the_pump_log',
  },

  /* --- Highcourt --------------------------------------------------------------------- */
  {
    id: 'highcourt:proclamation',
    areaId: 'highcourt',
    at: { x: -34, z: -50.4 },
    form: 'notice',
    label: 'Read the proclamation',
    title: 'PROCLAMATION — THE MAGISTRACY OF JOLREK',
    lines: [
      'The census of Azo proceeds. Every hearth in the six wards and the seven towns of the Ring will be counted, and every count will be sent up.',
      'Relocation for labour is a service the Magistracy provides. Applications are not taken; assignments are made.',
      'The Spire is not open to the public. The Spire has never been closed to it. Consider the distinction.',
    ],
    prop: { kind: 'noticepost', x: -34, z: -53.4 },
  },
  {
    id: 'highcourt_spire_lobby:census_plaque',
    areaId: 'highcourt_spire_lobby',
    at: { x: -30, z: -4 },
    form: 'plaque',
    label: 'Read the census plaque',
    title: 'THE CENSUS OF AZO — TO DATE',
    lines: [
      'Jolrek, six wards: counted. The Middle Ring, seven towns: counted, save one, which stopped answering.',
      'The Wildlands: not counted. Nothing in them pays.',
      'Total souls, sent up: the figure is not on the plaque. The figure has never been on the plaque.',
    ],
    prop: { kind: 'plaque', x: -33.85, z: -4, yaw: Math.PI / 2 },
  },
  {
    // What the board by the doors says once the Summons has been answered. Above the other
    // so it wins the same wall -- the `ASIDES` rule.
    id: 'highcourt_spire_lobby:the_summons_after',
    areaId: 'highcourt_spire_lobby',
    at: { x: 30, z: -16 },
    form: 'plaque',
    label: 'Read the board by the doors',
    title: 'BY THE DOORS',
    lines: [
      'The doors stood open. You went through them. The usher still has not.',
      'Under the summons, in the same hand as the census: "Received. Counted. Sent up."',
    ],
    gate: { after: ['the_summons'] },
    prop: { kind: 'plaque', x: 33.85, z: -16, yaw: -Math.PI / 2 },
  },
  {
    id: 'highcourt_spire_lobby:the_summons',
    areaId: 'highcourt_spire_lobby',
    at: { x: 30, z: -16 },
    form: 'plaque',
    label: 'Read the board by the doors',
    title: 'BY THE DOORS',
    lines: [
      'Summonses are posted here when the Spire wants somebody. There is one posted now. The name on it is not legible from this side of the rail.',
      'The usher says it is not for you. The usher says that to everybody. He has been right every time but one.',
    ],
    prop: { kind: 'plaque', x: 33.85, z: -16, yaw: -Math.PI / 2 },
  },
  {
    id: 'highcourt_smoke_eaters:board',
    areaId: 'highcourt_smoke_eaters',
    at: { x: -8, z: -19.4 },
    form: 'notice',
    label: "Read the Rest's board",
    title: 'THE SMOKE-EATER’S REST — WHAT THE HERALD DOES NOT SAY',
    lines: [
      'That the Smoke-Eater takes wagers at the bench by the hearth and has not lost one on this side of the stair.',
      'That a convoy forms up under the service end after dark, and the servants who see it off are not the servants who see it come back, because it does not.',
      'That the bed upstairs costs what it costs because the court pays it, and you are not the court.',
    ],
    prop: { kind: 'plaque', x: -8, z: -21.85 },
  },
  {
    id: 'highcourt_undercroft:manifest',
    areaId: 'highcourt_undercroft',
    at: { x: -20, z: -4.8 },
    form: 'ledger',
    label: 'Read the manifest',
    title: 'MANIFEST — THE RELOCATION TRAIN',
    lines: [
      'Berths: sixty. Direction: one. Return: the column is ruled and empty.',
      'Passengers, by ward: Lamprow 14. Ward Seven 22. Weeping Stile: see the roll. Ashfall: 3, and the three are underlined.',
      'Clerk’s note: "Counted on the stair, twice. The second count is smaller. Nobody got off."',
    ],
    prop: { kind: 'lectern', x: -20, z: -8 },
    flag: 'read_the_manifest',
  },

  /* --- the Ironworks ----------------------------------------------------------------- */
  {
    id: 'ashfall_ironworks:tally_board',
    areaId: 'ashfall_ironworks',
    at: { x: -6, z: -23.6 },
    form: 'plaque',
    label: "Read the smith's board",
    title: 'RATES — THE IRONWORKS ARTIFICER',
    lines: [
      'ASCENSION. A card raised a rank, on the bench, while you wait. Bring the card and the Ducats.',
      'SCHEMATICS. A plan cut into a working card. Bring the plan. Plans are not sold here and never have been.',
      'SPLICING. A card pressed with a Core. Bring both. The bench keeps nothing it does not need.',
      'No work is undertaken during a contract. Nothing is charged for work refused.',
    ],
    prop: { kind: 'plaque', x: -6, z: -25.85 },
  },

  /* --- the Apothecary ---------------------------------------------------------------- */
  {
    id: 'ashfall_apothecary:quota_bill',
    areaId: 'ashfall_apothecary',
    at: { x: -6, z: 16.6 },
    form: 'notice',
    label: 'Read the Clinic bill',
    title: 'THE CLINIC — TERMS',
    lines: [
      'The Clinic treats a Pact, not a person. What is bound to you is mended; what is you is not our trade.',
      'Seven treatments a week are billed to the Magistracy. The eighth is billed to you. Ask which you are.',
      'Brews are sold three to a satchel. A fourth is not sold; it is dropped.',
    ],
    prop: { kind: 'plaque', x: -6, z: 19.85, yaw: Math.PI },
  },

  /* --- the Records Office ------------------------------------------------------------ */
  {
    // What the roll says once the Weeping Stile has been walked: the word beside sixty-one
    // names. Above the ordinary entry so it wins the same lectern -- the `ASIDES` rule.
    id: 'ashfall_records:census_roll_after',
    areaId: 'ashfall_records',
    at: { x: 0, z: -5.4 },
    form: 'ledger',
    label: 'Read the census roll',
    title: 'THE ROLL — WEEPING STILE — SIXTY-ONE SOULS',
    lines: [
      'Hearth 1. Abel Marrow, cottar. RELOCATED. LABOUR.',
      'Hearth 2. Winn Marrow, his wife. RELOCATED. LABOUR.',
      'Hearth 3. The child. RELOCATED.',
      '. . .',
      'Hearth 61. RELOCATED. LABOUR.',
      'Roll closed. Clerk: E. Stile. Countersigned: the Spire.',
    ],
    gate: { after: ['hollow_census'] },
    prop: { kind: 'lectern', x: 0, z: -2.2 },
    flag: 'read_the_roll',
  },
  {
    id: 'ashfall_records:census_roll',
    areaId: 'ashfall_records',
    at: { x: 0, z: -5.4 },
    form: 'ledger',
    label: 'Read the census roll',
    title: 'THE ROLL — ASHFALL WARD — CURRENT COUNT',
    lines: [
      'Hearths counted: 214. Hearths answering: 209. Hearths sealed by order: 5.',
      'Persons on the roll: 1,006. Persons assessed this quarter: 1,006. Persons in arrears: 388.',
      'Note in the margin, in a different hand: "The count is not the point. The counting is."',
    ],
    prop: { kind: 'lectern', x: 0, z: -2.2 },
  },
];

/**
 * What stands readable in an area right now: gate-filtered, and one per `at`, first open wins.
 */
export function noticesInArea(areaId: string, chron: Chronicle): readonly NoticeDef[] {
  const taken = new Set<string>();
  const out: NoticeDef[] = [];
  for (const n of NOTICES) {
    if (n.areaId !== areaId || !gateOpen(n.gate, chron)) continue;
    const key = `${n.at.x},${n.at.z}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(n);
  }
  return out;
}

export const noticeById = (id: string): NoticeDef | undefined => NOTICES.find((n) => n.id === id);
