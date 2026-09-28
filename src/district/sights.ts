/**
 * Things worth stopping to look at.
 *
 * There was no verb for it. The world had notices you read in a panel, chests you open, herbs you
 * pick and people you talk to, and everything else -- a gibbet on a rise, the milestone that has
 * the wrong number on it, a cart nobody came back for -- was scenery you walked past. A sight is
 * the smallest thing the street can offer: stand at it, press Space, and a line or two of what you
 * notice comes up over the prompt and goes again. No panel, no loot, no gate by default.
 *
 * What it is for is the walk. Each area keeps count on the map panel -- found out of total -- and
 * finding all of an area's sights pays a small purse, once, through the same errand purse a chest
 * pays through. That is the whole of the reward, on purpose: the point is to have looked.
 *
 * A registry like `notices.ts` and `caches.ts`, addressed into an area by `areaId:slug`, and a
 * found sight is a world flag (`sight:<id>`) -- the same ledger a notice's flag goes into -- so
 * nothing about the save changes.
 */

import type { Gate } from './chronicle.js';

export interface SightDef {
  /** `areaId:slug`. Stable: the flag that records it is built from it. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to look. */
  readonly at: { readonly x: number; readonly z: number };
  /** The prompt: "Look at the gibbet". */
  readonly label: string;
  /** What you notice. A line or two -- this is a caption, not a reading. */
  readonly caption: string;
  /** When it is there to be noticed, if not always. */
  readonly gate?: Gate;
}

/** The world flag a sight raises when it is found. */
export const sightFlag = (id: string): string => `sight:${id}`;

/** What finding every sight in an area pays, once. */
export const SIGHTS_PURSE = { ducats: 12 } as const;

/** The flag that says an area's sights purse has been paid. */
export const sightsPaidFlag = (areaId: string): string => `sights_paid:${areaId}`;

export const SIGHTS: readonly SightDef[] = [
  /* ---- Ashfall Ward ---- */
  {
    id: 'ashfall_ward:the_bell',
    areaId: 'ashfall_ward',
    at: { x: -56, z: 78 },
    label: 'Look up at the bell',
    caption:
      'Cast in the Cinderworks and hung before the census. The name round its lip has been ' +
      'filed off and a number cut in its place. It rings the hours for the Magistracy and, once ' +
      'at night, for whoever the sexton is burying.',
  },
  {
    id: 'ashfall_ward:the_crane',
    areaId: 'ashfall_ward',
    at: { x: -82, z: -41 },
    label: 'Look at the crane',
    caption:
      'The treadwheel is boarded over and the hook lashed to the jib, so nothing can be lifted ' +
      'without a licence. The Toll House issues the licences. It has not issued one in eleven ' +
      'days.',
  },
  {
    id: 'ashfall_ward:the_ash_bridge',
    areaId: 'ashfall_ward',
    at: { x: 2, z: -52 },
    label: 'Look over the parapet',
    caption:
      'Flood marks scored into the stone, each with its year. The highest is at knee height. ' +
      'Somebody has cut a new one at the top of the arch, with no year, and rubbed ash into the ' +
      'groove so it shows.',
  },
  {
    id: 'ashfall_ward:the_bonded_seal',
    areaId: 'ashfall_ward',
    at: { x: -40, z: -82 },
    label: 'Look at the bonded door',
    caption:
      "Every door on the far bank carries the Magistracy's wax, and every seal has been lifted " +
      'and pressed back with a thumb. The thumbprint is the same on all of them.',
  },
  {
    id: 'ashfall_ward:the_pits',
    areaId: 'ashfall_ward',
    at: { x: 70, z: -16 },
    label: 'Look into the pits',
    caption:
      'Lime, then the bark liquor, strongest to weakest, a hide a month in each. The weakest ' +
      'pit has a boot in it, sole up. Nobody on the Row will say whose, which on the Row is an ' +
      'answer.',
  },
  {
    id: 'ashfall_ward:the_ropewalk',
    areaId: 'ashfall_ward',
    at: { x: -94, z: -4 },
    label: 'Look down the Ropewalk',
    caption:
      'Two hundred paces of shed and barely a stride across, a rope walked out down the whole ' +
      'of it and nobody at the far end. The ward buys its rope by the fathom. Its hangman buys ' +
      'it here.',
  },
  {
    id: 'ashfall_ward:the_ossuary',
    areaId: 'ashfall_ward',
    at: { x: -88, z: 70.4 },
    label: 'Look at the ossuary',
    caption:
      'No windows, one door, and the door bricked up. When the churchyard fills, the sexton ' +
      'lifts the old ones and brings them here. It has been full since before the wall. He has ' +
      'not stopped lifting.',
  },
  {
    id: 'ashfall_ward:the_new_grave',
    areaId: 'ashfall_ward',
    at: { x: -30, z: 69.6 },
    label: 'Look at the new stone',
    caption:
      'Three stones in a row, one new. The new one has a name cut on it and no dates, which on ' +
      'Chapel Hill means the Magistracy has not yet said when.',
  },
  {
    id: 'ashfall_ward:the_allotment',
    areaId: 'ashfall_ward',
    at: { x: 38, z: 70 },
    label: 'Look at the plot',
    caption:
      'Marked out in string, with a board at the corner: WORKED BY HAND, SEALED BY WRIT. The ' +
      'beans are up. The writ is newer than the beans.',
  },
  {
    id: 'ashfall_ward:the_garden_well',
    areaId: 'ashfall_ward',
    at: { x: 62, z: 74.6 },
    label: 'Look down the well',
    caption:
      "The winch is padlocked, and the lock is the Magistracy's. The gardeners draw their water " +
      'with a pot on a string through the gap under the lid, which nobody has thought to seal ' +
      'yet.',
  },
  {
    id: 'ashfall_ward:the_slip',
    areaId: 'ashfall_ward',
    at: { x: -94, z: -60 },
    label: 'Look at the keel',
    caption:
      'A barge keel laid down on the slip and left: ribs up, no planking, the tar on the stem ' +
      "gone grey. The shipwright's mark is one the Toll House does not recognise, which is why " +
      'it is still here.',
  },
  {
    id: 'ashfall_ward:the_rookery_court',
    areaId: 'ashfall_ward',
    at: { x: 76, z: 34 },
    label: 'Look up at the washing',
    caption:
      'Four lines across the court, a sheet on each, and every sheet patched in the same blue. ' +
      'In the Rookeries that means one family, or one debt.',
  },
  {
    id: 'ashfall_ward:the_south_gate',
    areaId: 'ashfall_ward',
    at: { x: 12, z: 90.6 },
    label: 'Read the toll board',
    caption:
      'TOLL AT THE WARD WALL, and the rates. Under them, in chalk: TOLL AT THE OLD WALL, struck ' +
      'through. The ward moved its wall out and kept its toll, and the chalk has been keeping ' +
      'count.',
  },
  {
    id: 'ashfall_ward:the_coal_staithes',
    areaId: 'ashfall_ward',
    at: { x: 50, z: -70 },
    label: 'Look at the staithes',
    caption:
      'Coal from the works, heaped for barges that stopped coming. The heaps have been picked ' +
      'away at the edges to the shape of a hand, which is what a winter looks like from the far ' +
      'bank.',
  },

  /* ---- The Chalk Verge ---- */
  {
    id: 'chalk_verge:the_ward_stone',
    areaId: 'chalk_verge',
    at: { x: -38, z: -26.6 },
    label: 'Look at the waystone',
    caption:
      'THE WARD ENDS HERE, cut deep and recut deeper. Somebody has scratched a line under it, and ' +
      'under that: SO DOES THE WRIT.',
  },
  {
    id: 'chalk_verge:the_empty_pen',
    areaId: 'chalk_verge',
    at: { x: 42.6, z: -26.4 },
    label: 'Look at the pen',
    caption:
      'Hurdles lashed with twine, the gate tied shut from the outside. Whatever was kept in here was ' +
      'not let out. The ground inside is trodden bare and it has not rained since.',
  },
  {
    id: 'chalk_verge:the_spoil',
    areaId: 'chalk_verge',
    at: { x: 46, z: -2.6 },
    label: 'Look at the spoil heaps',
    caption:
      "Foundry spoil, tipped and left: slag, clinker, a boot. The carters' tally is chalked on a " +
      'board stuck into the nearest heap. It stops mid-week.',
  },

  {
    id: 'chalk_verge:the_gibbet',
    areaId: 'chalk_verge',
    at: { x: -20, z: 12.8 },
    label: 'Look at the gibbet',
    caption:
      'Empty, and oiled. The chain has been replaced recently, and the notice nailed to the post has ' +
      'been torn down so many times the nails are all that is left of it.',
  },

  /* ---- The Chalk Road ---- */
  {
    id: 'chalk_road:the_milestone',
    areaId: 'chalk_road',
    at: { x: 10, z: -10.6 },
    label: 'Look at the milestone',
    caption:
      'MILLHARROW -- III. It is two, if you have walked it. Nobody has corrected the stone; they have ' +
      'corrected the road, twice, and moved the mill once.',
  },
  {
    id: 'chalk_road:the_carts',
    areaId: 'chalk_road',
    at: { x: -50, z: -14.4 },
    label: 'Look at the cart',
    caption:
      'Pulled off the road and left with the shafts down. The load is gone and so is one wheel. The ' +
      'axle has been greased since.',
  },
  {
    id: 'chalk_road:the_cairns',
    areaId: 'chalk_road',
    at: { x: -42, z: -2.4 },
    label: 'Look at the cairn',
    caption:
      'Every stone on it was carried from somewhere else. The ones at the bottom are chalk; the ones at ' +
      'the top came from the Rimefields, which is a long way to carry a stone to put on a pile.',
  },

  /* ---- Lamprow ---- */
  {
    id: 'lamprow:the_gasholder',
    areaId: 'lamprow',
    at: { x: 28, z: -58.4 },
    label: 'Look up at the gasholder',
    caption:
      'The bell is half up its frame and has been for a month: there is gas in it and nowhere ' +
      'yet to send it. A lighter comes over the bridge every evening to light the valve lamp, ' +
      'which the works finds funnier than he does.',
  },
  {
    id: 'lamprow:the_retort_house',
    areaId: 'lamprow',
    at: { x: -64, z: -61 },
    label: 'Look at the retorts',
    caption:
      'Coal in at one end, coke out at the other, and in between it gives up the gas and the ' +
      'smell. The furnace doors are chalked with the dates they were last opened. The newest ' +
      "date is tomorrow's.",
  },
  {
    id: 'lamprow:the_lighters_bridge',
    areaId: 'lamprow',
    at: { x: 4, z: -48 },
    label: 'Look along the rail',
    caption:
      'Built so the oil barges could be met halfway. The Magistracy has had the rail painted in ' +
      "the works' colours, and under the paint the old ones show through wherever hands go.",
  },
  {
    id: 'lamprow:the_spent_lime',
    areaId: 'lamprow',
    at: { x: 72, z: -62 },
    label: 'Look at the lime heaps',
    caption:
      'Spent lime from the purifiers, blue-grey and stinking. Children from the Sink pick ' +
      'through it for the lumps that still burn, and are chased off, and come back.',
  },
  {
    id: 'lamprow:the_gas_main',
    areaId: 'lamprow',
    at: { x: -84, z: 2.6 },
    label: 'Look into the trench',
    caption:
      'A trench along the step with a pipe laid in it and not yet covered. It runs the length ' +
      'of the High Street under the lamps, and every evening the lighters walk beside it to ' +
      'work.',
  },
  {
    id: 'lamprow:the_chandlers_yard',
    areaId: 'lamprow',
    at: { x: -94, z: -22 },
    label: 'Look at the candle-ends',
    caption:
      'Candle-ends swept into a heap by the wall and saved for the tallow. On the High Street ' +
      'the light is taxed by the hour. In here it is whatever the Magistracy forgot to count.',
  },
  {
    id: 'lamprow:the_allotments',
    areaId: 'lamprow',
    at: { x: -54, z: 64.6 },
    label: 'Look at the plots',
    caption:
      "Every plot is marked with a lighter's number instead of a name. Two numbers have been " +
      'painted out. The beans in those plots are still being watered.',
  },
  {
    id: 'lamprow:the_shrine',
    areaId: 'lamprow',
    at: { x: -78, z: 66 },
    label: 'Look at the cairn',
    caption:
      'A cairn with a wick-lamp set in its top, the glass smoked black. It is not lit. Lighting ' +
      'it would be a light the tithe clerk has not been told about.',
  },
  {
    id: 'lamprow:the_boards',
    areaId: 'lamprow',
    at: { x: 78, z: 34 },
    label: 'Look down at the board',
    caption:
      'A board across the drain, worn hollow in the middle. Somebody has nailed a second board ' +
      'beside it, and it is not worn at all, which tells you how many come this way and how ' +
      'often.',
  },
  {
    id: 'lamprow:the_eel_traps',
    areaId: 'lamprow',
    at: { x: 66, z: 62.5 },
    label: 'Look at the traps',
    caption:
      'Wicker traps staked in the drain where it runs out of the Sink. What comes up in them is ' +
      'eels, mostly, and the Sink eats them, mostly.',
  },
  {
    id: 'lamprow:the_sink_grating',
    areaId: 'lamprow',
    at: { x: 0, z: 16 },
    label: 'Look at the grating',
    caption:
      'An iron grating in the lowest part of the Sink, where the water goes when it rains. The ' +
      "Tithe-Takers' cellars are under here somewhere. On a still night you can hear counting.",
  },
  {
    id: 'lamprow:the_works_office',
    areaId: 'lamprow',
    at: { x: -16, z: -66.6 },
    label: 'Read the notice on the door',
    caption:
      'LIGHTERS WILL BE RETAINED DURING THE TRANSITION. Somebody has underlined DURING, twice, ' +
      'in lamp black.',
  },

  /* ---- The Bonemarket ---- */
  {
    id: 'bonemarket:the_clock',
    areaId: 'bonemarket',
    at: { x: 44, z: -3.2 },
    label: 'Look up at the market clock',
    caption:
      'Seven minutes fast, and it has been since the Hall was a chapel. The traders set their ' +
      'prices by it; the Magistracy sets its tithe by the real time. Those seven minutes are ' +
      'the only thing in the market sold free of tax.',
  },
  {
    id: 'bonemarket:the_gutter',
    areaId: 'bonemarket',
    at: { x: 2, z: -50 },
    label: 'Look along the gutter',
    caption:
      'A stone channel the length of the Shambles, boarded in three places, running to the ' +
      'canal. Downstream on Tannery Row they say they can tell what the market is selling by ' +
      'the colour of the water.',
  },
  {
    id: 'bonemarket:the_pens',
    areaId: 'bonemarket',
    at: { x: -54, z: -60.6 },
    label: 'Look into the pens',
    caption:
      'Hurdles lashed into pens, the mud in them trodden to soup. Every post carries a chalk ' +
      'number and a Magistracy tick beside it, which means the beast has been counted and may ' +
      'now be killed.',
  },
  {
    id: 'bonemarket:the_killing_shed',
    areaId: 'bonemarket',
    at: { x: -24, z: -57 },
    label: 'Look at the shed doors',
    caption:
      "The killing shed's doors are shut. Over them somebody has nailed a horseshoe, points up, " +
      'to keep the luck in. Inside, it is the only thing that is.',
  },
  {
    id: 'bonemarket:the_knackers_yard',
    areaId: 'bonemarket',
    at: { x: -88, z: -14 },
    label: "Look round the knacker's yard",
    caption:
      'What comes to the knacker is what was worked until it could not be: a cart horse, a ' +
      'mule, two dogs. He writes each one in a book with where it came from. The book is ' +
      'thicker than the ledger in the Hall.',
  },
  {
    id: 'bonemarket:the_dead_end',
    areaId: 'bonemarket',
    at: { x: -90, z: 22 },
    label: 'Look down the dead end',
    caption:
      'Stacked to the eaves with what the rag-and-bone men could not sell and would not throw ' +
      'away: bedsteads, a pram, a birdcage with its door wired shut.',
  },
  {
    id: 'bonemarket:the_rag_heap',
    areaId: 'bonemarket',
    at: { x: 70, z: -22 },
    label: 'Look at the rag heaps',
    caption:
      'Rags sorted by colour into heaps, the heaps sorted by weight into sacks. The whites go ' +
      'to the papermakers. The reds go to whoever asks for them and does not say why.',
  },
  {
    id: 'bonemarket:the_vats',
    areaId: 'bonemarket',
    at: { x: -8, z: 50.5 },
    label: 'Look at the vats',
    caption:
      'The glue vats, lidded and steaming. The works buys bone by the hundredweight and sells ' +
      'glue by the pot, and in between is a smell the Bonemarket stopped noticing a generation ' +
      'ago.',
  },
  {
    id: 'bonemarket:the_tallow',
    areaId: 'bonemarket',
    at: { x: 88, z: 62 },
    label: 'Look at the tallow trays',
    caption:
      'Tallow set in trays to cool, grey-white and ridged. Lamprow buys it for the candles it ' +
      'is not taxed on. Lamprow says it does not.',
  },
  {
    id: 'bonemarket:the_scales',
    areaId: 'bonemarket',
    at: { x: -2, z: -30 },
    label: 'Look at the public scales',
    caption:
      'Chained to the floor. A brass plate says the Magistracy tested them; a second, screwed ' +
      'on under it, says by whom; a third, under that, says what he was paid.',
  },
  {
    id: 'bonemarket:the_hall_face',
    areaId: 'bonemarket',
    at: { x: -10, z: 2.6 },
    label: "Look up at the Hall's face",
    caption:
      "THIS WAS A CHAPEL, beside the door. Above the door is the stone where a saint's name was " +
      'cut out, and a price list painted into the hollow it left.',
  },
  {
    id: 'bonemarket:the_boilers_pot',
    areaId: 'bonemarket',
    at: { x: -57, z: 30 },
    label: "Look at the boiler's pot",
    caption:
      "The bone-boiler's great pot, cold for once, a ladder against it. Written on the ladder " +
      'is a rule: nobody climbs it alone.',
  },

  /* ---- The Cinderworks ---- */
  {
    id: 'cinderworks:the_stack',
    areaId: 'cinderworks',
    at: { x: 86, z: -24.6 },
    label: 'Look up at the stack',
    caption:
      'Taller than anything the Magistracy owns, and the flare at its lip never goes out. The ' +
      'works keeps a man whose whole job is to watch it and ring a bell if it does. He has rung ' +
      'it once.',
  },
  {
    id: 'cinderworks:the_quench_channel',
    areaId: 'cinderworks',
    at: { x: -82, z: 40 },
    label: 'Look into the channel',
    caption:
      'The slag is run in to break it, and the water hisses and throws it back up as grey sand. ' +
      'The sand is swept up and sold to Highcourt for its paths. Highcourt walks on the ' +
      'Cinderworks.',
  },
  {
    id: 'cinderworks:the_channel_bridge',
    areaId: 'cinderworks',
    at: { x: -88, z: 2 },
    label: 'Look along the rail',
    caption:
      'An iron bridge, warm underfoot even in winter. The rail is polished bright in two ' +
      'places, left and right, the height of a hand, where the night crews lean to wait.',
  },
  {
    id: 'cinderworks:the_slag_bank',
    areaId: 'cinderworks',
    at: { x: -100, z: -30 },
    label: 'Look at the slag bank',
    caption:
      'Tipped over the far side of the channel and left to cool, which it never quite has. ' +
      'Where it cracks it breathes, and the cracks are the only warm places anybody sleeps who ' +
      'is not on the barracks roll.',
  },
  {
    id: 'cinderworks:the_pump',
    areaId: 'cinderworks',
    at: { x: -16, z: -54 },
    label: 'Look at the pump',
    caption:
      "The barracks' one pump, its handle chained, and a board giving the hours it may be " +
      'worked. The hours are the ones when everybody is at the furnaces.',
  },
  {
    id: 'cinderworks:the_roll_call',
    areaId: 'cinderworks',
    at: { x: -2, z: -54 },
    label: 'Read the roll',
    caption:
      'A number for a name, a bunk for a number. Some numbers have a second number chalked ' +
      'beside them: the shift they did not come back from.',
  },
  {
    id: 'cinderworks:the_barracks_door',
    areaId: 'cinderworks',
    at: { x: 10, z: -66 },
    label: 'Look at the barracks door',
    caption:
      'One door to a family, four families to a stair. Each door carries a tin plate with the ' +
      "works' mark. The plates are the works' property. So, the plates say, is the door.",
  },
  {
    id: 'cinderworks:the_scrap_heap',
    areaId: 'cinderworks',
    at: { x: 70, z: -26 },
    label: 'Look at the scrap',
    caption:
      'Broken moulds, split ladles, a bedframe, rails, sorted by what they were before the ' +
      "melt. Somebody has set a child's iron horse on top of the heap, where it will go in " +
      'last.',
  },
  {
    id: 'cinderworks:the_wagons',
    areaId: 'cinderworks',
    at: { x: -50, z: 62 },
    label: 'Look at the wagons',
    caption:
      'Wagons on the siding, loaded with pig iron for Highcourt and chocked since the week the ' +
      'tithe went up. The iron is rusting. The tithe is not.',
  },
  {
    id: 'cinderworks:the_engine_shed',
    areaId: 'cinderworks',
    at: { x: 90, z: 70 },
    label: 'Look into the engine shed',
    caption:
      'The engine is in its shed with its fire drawn, and a shunter asleep in the cab, because ' +
      'a shunter who sleeps in the barracks gets called to the furnaces.',
  },
  {
    id: 'cinderworks:the_buffer_stop',
    areaId: 'cinderworks',
    at: { x: -96, z: 70 },
    label: 'Look at the buffer stop',
    caption:
      'The rails stop at a timber baulk and a bollard; past them the channel, and past that the ' +
      'Caldera. The baulk has been hit so often it is shaped like the wagon that hit it.',
  },
  {
    id: 'cinderworks:the_sorting_shed',
    areaId: 'cinderworks',
    at: { x: 98, z: -34 },
    label: 'Look at the shed door',
    caption:
      "The scrap-sorters' shed. On the door, in slag-chalk: WE KNOW WHAT IT WAS. The works has " +
      'painted over it twice, and the second coat is the thinner.',
  },

  /* ---- Ward Seven ---- */
  {
    id: 'ward_seven:the_water_tower',
    areaId: 'ward_seven',
    at: { x: 16, z: -65 },
    label: 'Look up at the water tower',
    caption:
      "The Magistracy's answer to a ward with too much water: a tank of clean water on iron " +
      'legs, on the one dry island, locked. The key is in Highcourt. The legs are rusting from ' +
      'the feet up.',
  },
  {
    id: 'ward_seven:the_drowned_door',
    areaId: 'ward_seven',
    at: { x: -78, z: -70 },
    label: 'Look at the door',
    caption:
      'A front door standing in the water, the step under it and the house gone. The knocker is ' +
      'polished bright. Somebody still knocks.',
  },
  {
    id: 'ward_seven:the_old_pump',
    areaId: 'ward_seven',
    at: { x: 78, z: -70 },
    label: 'Look at the pump',
    caption:
      'The old parish pump, its handle just clear of the flood. Work it and water comes out of ' +
      "the spout into the water it stands in, which is the ward's whole situation in one " +
      'gesture.',
  },
  {
    id: 'ward_seven:the_mooring_post',
    areaId: 'ward_seven',
    at: { x: -18, z: -74 },
    label: 'Look at the post',
    caption:
      'The boardwalk ends at a post with a rope-groove worn into it, and no punt. Cut into the ' +
      'post with a knife: BACK BY DARK.',
  },
  {
    id: 'ward_seven:the_cistern_bridge',
    areaId: 'ward_seven',
    at: { x: -40, z: -46 },
    label: 'Look down through the boards',
    caption:
      'Planks over the cistern where it is deepest, tarred and re-tarred. Under the boards the ' +
      "old ward's lamp posts are still standing in the dark water, and at night one of them is " +
      'lit.',
  },
  {
    id: 'ward_seven:the_moorings',
    areaId: 'ward_seven',
    at: { x: -72, z: -36.6 },
    label: 'Look along the moorings',
    caption:
      'Punts nose to tail along the quay, their poles stacked beside them. A copper to cross ' +
      'the drowned terraces, two after dark, and the punters will not say what the second ' +
      'copper is for.',
  },
  {
    id: 'ward_seven:the_punters_shed',
    areaId: 'ward_seven',
    at: { x: -80, z: -26 },
    label: "Look into the punters' shed",
    caption:
      'Poles, nets, a pot of tar, and a slate of names: who went out, and when. Some names have ' +
      'a line through them. Some have a second line through the first.',
  },
  {
    id: 'ward_seven:the_soak_graves',
    areaId: 'ward_seven',
    at: { x: -66, z: 46 },
    label: 'Look at the graves',
    caption:
      'Graves in the soak, their stones leaning where the ground gave. The water once lifted a ' +
      'coffin clean out and set it down a yard to the left. Nobody has moved it back.',
  },
  {
    id: 'ward_seven:the_washhouse',
    areaId: 'ward_seven',
    at: { x: 70, z: -18.6 },
    label: 'Look at the washhouse',
    caption:
      'The ward washes here for a copper a tub, in the only clean water in Ward Seven, carried ' +
      'from the tank on the island. The copper is for the carrying. The Magistracy says so.',
  },
  {
    id: 'ward_seven:the_drying_yard',
    areaId: 'ward_seven',
    at: { x: 80, z: 20 },
    label: 'Look at the lines',
    caption:
      'Sheets on every line, none of them dry, because nothing in Ward Seven ever is. In at ' +
      'dark, out again at dawn, which counts here as having done the washing.',
  },
  {
    id: 'ward_seven:the_new_cut',
    areaId: 'ward_seven',
    at: { x: -10, z: 53.6 },
    label: 'Look into the new cut',
    caption:
      "The drain the Magistracy began, to empty the ward into the Cinderworks' channel: dug to " +
      'the first bend and flooded to the brim. The men who dug it were paid in the water they ' +
      'were meant to take away.',
  },
  {
    id: 'ward_seven:the_engine_house',
    areaId: 'ward_seven',
    at: { x: 16, z: 72 },
    label: 'Look at the engine house',
    caption:
      'Built for the engine that would pump the cut dry. The engine never came. The family paid ' +
      'to guard it lives in the house now, and is still waiting.',
  },

  /* ---- Highcourt ---- */
  {
    id: 'highcourt:the_surveyor',
    areaId: 'highcourt',
    at: { x: -18, z: -80.8 },
    label: 'Look at the statue',
    caption:
      'The man who drew Highcourt before it was built, holding the plan. The plan in his hand ' +
      'is of a different city. Nobody has said so, which in Highcourt is the same as nobody ' +
      'having noticed.',
  },
  {
    id: 'highcourt:the_first_magistrate',
    areaId: 'highcourt',
    at: { x: 18, z: -80.8 },
    label: 'Look at the statue',
    caption:
      'The first Magistrate, one hand on a ledger. The ledger is the only part of the statue ' +
      'kept clean. Somebody polishes it every morning, and will not say on whose orders.',
  },
  {
    id: 'highcourt:the_census_taker',
    areaId: 'highcourt',
    at: { x: -18, z: -70.8 },
    label: 'Look at the statue',
    caption:
      'A census-taker with his tally-stick, notched in the stone. The notches go all the way ' +
      'round the stick and start again.',
  },
  {
    id: 'highcourt:the_nameless',
    areaId: 'highcourt',
    at: { x: 18, z: -70.8 },
    label: 'Look at the statue',
    caption:
      'A robed figure with its face chiselled off and its plaque left blank. The rooks treat it ' +
      'with more respect than the court does.',
  },
  {
    id: 'highcourt:the_lamplighter_general',
    areaId: 'highcourt',
    at: { x: -18, z: -60.8 },
    label: 'Look at the statue',
    caption:
      'The Lamplighter-General, pole raised to a lamp that was never fitted. Lamprow sends a ' +
      'man once a year to light a candle at its feet. The court sends a man to blow it out.',
  },
  {
    id: 'highcourt:the_child',
    areaId: 'highcourt',
    at: { x: 18, z: -60.8 },
    label: 'Look at the statue',
    caption:
      'The one figure in the garden who was not paid to be one: a child with a hoop. The plaque ' +
      'says WARD SEVEN and a year, and the court will not say what happened in it.',
  },
  {
    id: 'highcourt:the_beacon',
    areaId: 'highcourt',
    at: { x: 0, z: -71 },
    label: 'Look up at the beacon',
    caption:
      'Lit every night, sweeping the city from the Rimefields to the Caldera. It shows nothing ' +
      'and lights nothing. It is there so that everywhere in Azo is somewhere it has been seen ' +
      'from.',
  },
  {
    id: 'highcourt:the_archive_door',
    areaId: 'highcourt',
    at: { x: -56, z: -69 },
    label: 'Look at the Archive door',
    caption:
      'Three locks and a slot. Documents go in through the slot. There is no slot going the ' +
      'other way.',
  },
  {
    id: 'highcourt:the_annexe',
    areaId: 'highcourt',
    at: { x: 56, z: -69 },
    label: 'Look at the Annexe',
    caption:
      'Built when the Archive filled, and it filled in a year. A third building has been drawn ' +
      'and priced, and the price is on file in the Annexe, which is full.',
  },
  {
    id: 'highcourt:the_colonnade',
    areaId: 'highcourt',
    at: { x: -76, z: -30 },
    label: 'Look along the colonnade',
    caption:
      'Columns in pairs, each pair a different stone: one from every ward, the plaque says, ' +
      'freely given. The stone from Ward Seven is the one that is always wet.',
  },
  {
    id: 'highcourt:the_bailiffs_yard',
    areaId: 'highcourt',
    at: { x: 0, z: 72 },
    label: "Look round the bailiffs' yard",
    caption:
      'Their lanterns hang on numbered hooks by the gate. At dusk the Night Bailiffs take them ' +
      'down; at dawn they hang them up again, and two are always missing.',
  },
  {
    id: 'highcourt:the_stables',
    areaId: 'highcourt',
    at: { x: 0, z: 78 },
    label: 'Look at the stables',
    caption:
      'Better kept than the Sink. The horses are fed a ration the Magistracy calls generous. ' +
      "Lamprow's tithe clerk has been heard to use the same word.",
  },

  /* ---- The Chalk Verge, since it grew ---- */
  {
    id: 'chalk_verge:the_chalk_horse',
    areaId: 'chalk_verge',
    at: { x: -4, z: -42 },
    label: 'Look at the chalk horse',
    caption:
      'Cut through the turf to the chalk, long-backed and reaching, legs that do not meet the ' +
      'body. Older than the ward and older than the writ. The Magistracy scours it every ' +
      'spring, and has never said why.',
  },
  {
    id: 'chalk_verge:the_sheepfold',
    areaId: 'chalk_verge',
    at: { x: -68, z: -41 },
    label: 'Look into the fold',
    caption:
      'A drystone fold, knee high, with a gap to drive the sheep through. The sheep are the ' +
      "shepherd's. The shepherd is not in the bothy, and has not been since the census.",
  },
  {
    id: 'chalk_verge:the_dew_pond',
    areaId: 'chalk_verge',
    at: { x: -76, z: 18 },
    label: 'Look at the dew pond',
    caption:
      'Clay-lined and round, filled by the mist and nothing else, which is why the drovers ' +
      'trust it. Somebody has dropped a writ into it. It has not sunk.',
  },
  {
    id: 'chalk_verge:the_lime_kiln',
    areaId: 'chalk_verge',
    at: { x: 74, z: -8.6 },
    label: 'Look at the kiln',
    caption:
      'Chalk in at the top, lime out at the bottom, three days to burn. The lime goes to ' +
      'Tannery Row for the pits and to the Magistracy for the graves. The kiln does not ask ' +
      'which.',
  },
  {
    id: 'chalk_verge:the_quarry_face',
    areaId: 'chalk_verge',
    at: { x: -10, z: 50 },
    label: 'Look at the quarry face',
    caption:
      'The chalk is white where it was cut last week and grey where it was cut last year. Near ' +
      'the top, in the white, somebody has cut a name, and under it a date that has not come ' +
      'yet.',
  },
];

export function sightsInArea(areaId: string): SightDef[] {
  return SIGHTS.filter((s) => s.areaId === areaId);
}

export function sightById(id: string): SightDef | undefined {
  return SIGHTS.find((s) => s.id === id);
}
