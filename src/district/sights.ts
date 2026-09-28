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

  /* ---- The Chalk Road, since it grew ---- */
  {
    id: 'chalk_road:the_toll_bar',
    areaId: 'chalk_road',
    at: { x: -22, z: -6 },
    label: 'Look at the toll bar',
    caption:
      'Raised on its counterweight at the foot of the Millharrow lane, and rocking there for ' +
      'carts that do not come. The rates on the board beside it have been painted over so often ' +
      'they stand out in relief.',
  },
  {
    id: 'chalk_road:the_wagon_train',
    areaId: 'chalk_road',
    at: { x: -96, z: -2 },
    label: 'Look along the wagons',
    caption:
      'Five wagons drawn up on the verges nose to tail, harness still on the shafts and no sign ' +
      'of the teams. The loads are picked over by night and put back by day, which tells you ' +
      'who is doing each.',
  },
  {
    id: 'chalk_road:the_stables',
    areaId: 'chalk_road',
    at: { x: 84, z: -14 },
    label: 'Look into the stables',
    caption:
      "The waystation's stables, the stalls swept, a horse's name chalked over each. The horses " +
      'are gone. The names are fresh.',
  },
  {
    id: 'chalk_road:the_shrine',
    areaId: 'chalk_road',
    at: { x: 106, z: 14 },
    label: 'Look at the shrine',
    caption:
      'A cairn with an urn in it, for whoever does not come back up the road. There are flowers ' +
      'in the urn, and they are the kind that only grow in the Rimefields.',
  },
  {
    id: 'chalk_road:the_far_milestone',
    areaId: 'chalk_road',
    at: { x: 80, z: -2.4 },
    label: 'Look at the milestone',
    caption:
      'THE VERGE — I, and under it in a later hand, THE WARD — II. Somebody has scratched out ' +
      'WARD and cut WRIT instead, which is the same distance and a different place.',
  },
  {
    id: 'chalk_road:the_last_hedge',
    areaId: 'chalk_road',
    at: { x: -108, z: 14 },
    label: 'Look past the last hedge',
    caption:
      'The last hedge before the Rime. Past it the furrows are frozen white; this side of it ' +
      'somebody is still ploughing, and has left the plough in the furrow to go and look.',
  },

  /* ---- Millharrow ---- */
  {
    id: 'millharrow:the_windmill',
    areaId: 'millharrow',
    at: { x: 72, z: -74.6 },
    label: 'Look up at the windmill',
    caption:
      'A post mill on its hill out in the strips, turned to the wind by the tail-pole. The ' +
      'miller grinds what the Mill in the town will not, which is anything brought in after the ' +
      'tollman has gone to bed.',
  },
  {
    id: 'millharrow:the_water_wheel',
    areaId: 'millharrow',
    at: { x: -26, z: -17.4 },
    label: 'Look at the wheel',
    caption:
      'The wheel at the head of the race, turning as long as the leat runs. Somebody has ' +
      'painted the paddles in turn, red and white, so the children can count the turns. The ' +
      'miller counts them too, for other reasons.',
  },
  {
    id: 'millharrow:the_millpond',
    areaId: 'millharrow',
    at: { x: -70, z: -62 },
    label: 'Look over the millpond',
    caption:
      'Dammed a lifetime ago to feed the race, and full of what fell in since: a cartwheel, a ' +
      'millstone that cracked, a boat with its bottom out. The heron stands on the boat, which ' +
      'is what the boat is for now.',
  },
  {
    id: 'millharrow:the_leat_bridge',
    areaId: 'millharrow',
    at: { x: -58, z: -34 },
    label: 'Look down at the leat',
    caption:
      'Planks over the leat, and the water under them running fast and brown to the race. A ' +
      "notice on the rail, the Magistracy's: the water is the mill's, the mill is the Crown's. " +
      "Under it, in chalk: THE RAIN IS NOBODY'S.",
  },
  {
    id: 'millharrow:the_north_end',
    areaId: 'millharrow',
    at: { x: -10, z: -92.6 },
    label: 'Look along the North End',
    caption:
      'Two rows of cottages at the head of the Levels road, doors open onto the yards. Every ' +
      'door has a sprig of something green over it. It is either for luck or for the tithe-men, ' +
      'and the North End will not say which.',
  },
  {
    id: 'millharrow:the_granary_yard',
    areaId: 'millharrow',
    at: { x: -104, z: -34.6 },
    label: 'Look at the granaries',
    caption:
      'Stone granaries on staddle stones, so the rats cannot climb in. The rats have been told. ' +
      'A second set of marks on each door counts what went in; a third counts what the ' +
      'Magistracy says went in.',
  },
  {
    id: 'millharrow:the_tithe_barn',
    areaId: 'millharrow',
    at: { x: -98, z: 6 },
    label: 'Look at the tithe barn',
    caption:
      'The tithe barn, a tenth of everything, and built big enough to hold a fifth. The doors ' +
      'are chained. The chain is new. The barn is empty, and has been since before the chain.',
  },
  {
    id: 'millharrow:the_orchard',
    areaId: 'millharrow',
    at: { x: -70, z: 76 },
    label: 'Look down the rows',
    caption:
      'Old trees, pruned by somebody who knew how and has not been back. The fruit is the ' +
      "Crown's by law. The wasps have not been told, and neither have the children.",
  },
  {
    id: 'millharrow:the_cider_press',
    areaId: 'millharrow',
    at: { x: -30, z: 74 },
    label: 'Look at the cider press',
    caption:
      'The press stands in its shed with the last pressing still in the bed, gone to vinegar. A ' +
      'barrel beside it is marked FOR THE FAIR, and is the only barrel in Millharrow nobody has ' +
      'touched.',
  },
  {
    id: 'millharrow:the_fair_green',
    areaId: 'millharrow',
    at: { x: 70, z: 78 },
    label: 'Look across the green',
    caption:
      'The green where the fair is held every quarter-day: the stalls standing empty between, ' +
      'the grass worn in two rings where the dancing goes round. The writ does not mention ' +
      'fairs. That is the point of a fair.',
  },
  {
    id: 'millharrow:the_inn',
    areaId: 'millharrow',
    at: { x: 34, z: 74 },
    label: 'Look up at the inn sign',
    caption:
      'The Crossroads Arms: four roads painted on the board, one of them repainted since. The ' +
      'one repainted goes to the Chalk Road, and somebody has painted a toll bar across it, ' +
      'very small.',
  },
  {
    id: 'millharrow:the_chapel',
    areaId: 'millharrow',
    at: { x: 90, z: 30 },
    label: 'Look at the chapel',
    caption:
      'The crossroads chapel, one bell and no bell-ringer. The door is never locked, because ' +
      'the door is the only thing in the chapel worth taking and it is hung on.',
  },
  {
    id: 'millharrow:the_forge',
    areaId: 'millharrow',
    at: { x: 104, z: -6 },
    label: 'Look at the forge',
    caption:
      "The East End's smith shoes the drovers' horses and mends the tollman's chain, and " +
      'charges both the same, which is the only fair price in Millharrow.',
  },
  {
    id: 'millharrow:the_crossroads',
    areaId: 'millharrow',
    at: { x: -4, z: -2 },
    label: 'Look round the crossroads',
    caption:
      'Four roads, four quarters, and in the middle a stone worn flat by everybody who stopped ' +
      'here to decide. Somebody has cut an arrow into it pointing straight down.',
  },

  /* ---- The Tallow Levels ---- */
  {
    id: 'tallow_levels:the_beam_engine',
    areaId: 'tallow_levels',
    at: { x: 88, z: -10.6 },
    label: 'Look up at the engine',
    caption:
      'The engine that was meant to win the argument: a beam as long as a cart rocking on the ' +
      'wall-top, lifting the Levels out a bucket at a stroke. The water comes back in ' +
      'overnight. The engine does not mind.',
  },
  {
    id: 'tallow_levels:the_sluice_gates',
    areaId: 'tallow_levels',
    at: { x: -86, z: -6 },
    label: 'Look at the sluice gates',
    caption:
      'Timber gates on iron screws, set in the drain so the Levels can be let out and the river ' +
      'kept out. The screws have rusted where they were when the keeper stopped coming, which ' +
      'is half open.',
  },
  {
    id: 'tallow_levels:the_main_drain',
    areaId: 'tallow_levels',
    at: { x: -82, z: 30 },
    label: 'Look along the drain',
    caption:
      'The main drain, straight as a rule and older than anything else on the Levels. On a high ' +
      'tide it runs the wrong way, which the Levels have learned to call a tide.',
  },
  {
    id: 'tallow_levels:the_sluice_keeper',
    areaId: 'tallow_levels',
    at: { x: -82, z: -30 },
    label: "Look into the keeper's hut",
    caption:
      'A stove, a bench, and a ledger of every gate opened and closed. The last entry is a gate ' +
      'closed. The gate beside the hut is open.',
  },
  {
    id: 'tallow_levels:the_reed_beds',
    areaId: 'tallow_levels',
    at: { x: -70, z: -62 },
    label: 'Look into the reeds',
    caption:
      'Grown up where the cuts silted, taller than a man and loud with birds. The thatchers cut ' +
      'them in winter. Something else walks in them at night and cuts nothing.',
  },
  {
    id: 'tallow_levels:the_dyke_top',
    areaId: 'tallow_levels',
    at: { x: 82, z: 24 },
    label: 'Look along the dyke',
    caption:
      'The one dry path on the east of the Levels, grassed and walked flat. The Dyke Wardens ' +
      'walk it by day and fine anybody else who does, for wearing it down.',
  },
  {
    id: 'tallow_levels:the_new_drain',
    areaId: 'tallow_levels',
    at: { x: 74, z: -40 },
    label: 'Look into the new drain',
    caption:
      'Cut last year for the engine to empty into, and already weeded to the brim. The spoil ' +
      'from it made the dykes either side, which is the one part of the plan that worked.',
  },
  {
    id: 'tallow_levels:the_sunk_chapel',
    areaId: 'tallow_levels',
    at: { x: -26, z: 72 },
    label: 'Look at the chapel',
    caption:
      'Its west end has gone into the water to the sills, and the font with it. Christenings ' +
      'are held at the east end now, on the altar step, which the priest says is nearer anyway.',
  },
  {
    id: 'tallow_levels:the_half_sunk_cottage',
    areaId: 'tallow_levels',
    at: { x: -70, z: 62 },
    label: 'Look at the cottage',
    caption:
      'Lived in upstairs, the ground floor given to the water. A ladder at the window, a boat ' +
      'tied to the ladder, washing hung from the boat.',
  },
  {
    id: 'tallow_levels:the_condemned_field',
    areaId: 'tallow_levels',
    at: { x: -26, z: -22 },
    label: 'Look at the north field',
    caption:
      'NORTH FIELD — CONDEMNED, on the stone, and the field past it grey where the blight took ' +
      'it. It did not spread like blight. It spread like something that knew where the cuts ' +
      'ran.',
  },

  /* ---- Saltglass ---- */
  {
    id: 'saltglass:the_lighthouse',
    areaId: 'saltglass',
    at: { x: 76, z: -50.6 },
    label: 'Look up at the lighthouse',
    caption:
      'Still lit, though the harbour is shut. The keeper was never told to stop, and the writ ' +
      'that closed the harbour says nothing about the sea, which goes on having rocks in it.',
  },
  {
    id: 'saltglass:the_salt_pans',
    areaId: 'saltglass',
    at: { x: -30, z: -50 },
    label: 'Look over the pans',
    caption:
      'Pans in their ranks, flooded on the spring tide and left for the sun. The salt is raked ' +
      'by hand and taxed by the Customs House, which is chained, so for now it is only raked.',
  },
  {
    id: 'saltglass:the_salt_heap',
    areaId: 'saltglass',
    at: { x: -58, z: -62 },
    label: 'Look at the salt heap',
    caption:
      'Raked salt heaped on the sea bank, with a sack of it stood on top sealed with the ' +
      'Customs mark. The heap under the sack is not sealed. The heap is not going anywhere.',
  },
  {
    id: 'saltglass:the_rakers_shed',
    areaId: 'saltglass',
    at: { x: 66, z: -37.4 },
    label: "Look at the rakers' shed",
    caption:
      'Rakes on pegs, boots by the door, a slate of whose pan is whose. One pan has three names ' +
      'against it, crossed out one under the other.',
  },
  {
    id: 'saltglass:the_kilns',
    areaId: 'saltglass',
    at: { x: -74, z: -26 },
    label: 'Look at the kilns',
    caption:
      'Fired on driftwood and salt-grass. What comes out is green and full of bubbles and the ' +
      'Glasshouse will not buy it, so it goes to Highcourt, where it is sold as antique.',
  },
  {
    id: 'saltglass:the_cullet_heap',
    areaId: 'saltglass',
    at: { x: -80, z: 30 },
    label: 'Look at the cullet',
    caption:
      'Broken glass heaped to be melted again: bottle ends, a cracked pane, a lens. The ' +
      'Glass-Pickers come for the lenses at night. Nobody knows what they want lenses for.',
  },
  {
    id: 'saltglass:the_shipwreck',
    areaId: 'saltglass',
    at: { x: 0, z: 50 },
    label: 'Look at the wreck',
    caption:
      'A ship on the salt, a mile from any water that could have put it there. The flats were ' +
      'sea once. The ship is older than the flats, which is the part Saltglass does not talk ' +
      'about.',
  },
  {
    id: 'saltglass:the_figurehead',
    areaId: 'saltglass',
    at: { x: 28, z: 54 },
    label: 'Look at the figurehead',
    caption:
      'A woman holding up a lamp, worn to a stump by the wind and the salt. The Glass-Pickers ' +
      'leave her alone. They leave her a light.',
  },
  {
    id: 'saltglass:the_stern',
    areaId: 'saltglass',
    at: { x: -54, z: 56 },
    label: 'Look at the stern',
    caption:
      'Broken open, its ribs standing up out of the salt like a hand. Half a name on the ' +
      'transom: ...IGHT OF THE KING. The rest of it is under the salt.',
  },
  {
    id: 'saltglass:the_harbour_writ',
    areaId: 'saltglass',
    at: { x: -14, z: -22 },
    label: 'Read the stone',
    caption:
      'HARBOUR CLOSED BY WRIT, and a sheet of paper nailed under it saying the same in smaller ' +
      'letters. The paper is newer than the stone. The stone was cut to match it.',
  },

  /* ---- Bray's Hollow ---- */
  {
    id: 'brays_hollow:the_stone_circle',
    areaId: 'brays_hollow',
    at: { x: 0, z: -57 },
    label: 'Look at the stone circle',
    caption:
      'Nine stones on the crown of the rim, older than the hedges and older than the name. The ' +
      'Magistracy has never surveyed them, which is the only thing in the Ring it has never ' +
      'surveyed.',
  },
  {
    id: 'brays_hollow:the_fallen_stone',
    areaId: 'brays_hollow',
    at: { x: -8, z: -64 },
    label: 'Look at the fallen stone',
    caption:
      'The one that fell, lying where it went down. There are coins pushed into the turf under ' +
      'its edge, so far in the grass has grown over them. Nobody will say who puts them there, ' +
      'because everybody does.',
  },
  {
    id: 'brays_hollow:the_farmhouse',
    areaId: 'brays_hollow',
    at: { x: -58, z: -34 },
    label: "Look at Old Bray's door",
    caption:
      'The farmhouse door stands open with a dog asleep across the step. The warrant for the ' +
      'herd is nailed to the frame. The dog has chewed the bottom of it off.',
  },
  {
    id: 'brays_hollow:the_dairy',
    areaId: 'brays_hollow',
    at: { x: -58, z: -10 },
    label: 'Look into the dairy',
    caption:
      'Cool stone and a slate floor, cheeses on the shelves in rows, each marked with a date ' +
      "and a cow's name. The cows are in the barn under a warrant. The cheeses are not " +
      'mentioned in it.',
  },
  {
    id: 'brays_hollow:the_byre',
    areaId: 'brays_hollow',
    at: { x: -62, z: 22 },
    label: 'Look into the byre',
    caption:
      'The old byre, too small now for a herd that is not here. The mangers are full of hay ' +
      'anyway. Somebody fills them every morning.',
  },
  {
    id: 'brays_hollow:the_pond',
    areaId: 'brays_hollow',
    at: { x: -54, z: 36 },
    label: 'Look at the pond',
    caption:
      'Green and still, a willow over it and a duck on it. A notice on a post says the water is ' +
      'licensed. The duck has not seen it.',
  },
  {
    id: 'brays_hollow:the_hives',
    areaId: 'brays_hollow',
    at: { x: 64, z: 2 },
    label: 'Look at the hives',
    caption:
      "Straw hives on a bench at the orchard's edge, loud and warm. The honey is the one thing " +
      'in the Hollow nobody has thought to tax. The bees would take it badly.',
  },
  {
    id: 'brays_hollow:the_orchard_row',
    areaId: 'brays_hollow',
    at: { x: 64, z: -34 },
    label: 'Look along the trees',
    caption:
      'Old trees in rows, their bark cut with initials a hundred years deep. The newest pair ' +
      'are carved together inside a ring, and the ring has been carved again since, deeper.',
  },
  {
    id: 'brays_hollow:the_south_rim',
    areaId: 'brays_hollow',
    at: { x: 0, z: 62 },
    label: 'Look back across the Hollow',
    caption:
      'From the rim the whole bowl is in sight: the lane, the barn, the stubs of hedge, the ' +
      'farm. The one place in the Ring where you can see everywhere you could go, and nowhere ' +
      'you have to.',
  },
  {
    id: 'brays_hollow:the_waystone',
    areaId: 'brays_hollow',
    at: { x: 14, z: -18 },
    label: 'Read the waystone',
    caption:
      'BRAY — NO MARKET, NO INN. Under it somebody has scratched NO TOLL, and under that, in ' +
      'another hand, a very small sheep.',
  },

  /* ---- Fenwick's Crossing ---- */
  {
    id: 'fenwicks_crossing:the_great_bridge',
    areaId: 'fenwicks_crossing',
    at: { x: 10, z: -46 },
    label: 'Look over the bridge',
    caption:
      'Six carts wide and eleven arches long, older than Fenwick and older than the toll. The ' +
      "downstream stones are worn smooth to a gunwale's height. The river used to be busier " +
      'than the road.',
  },
  {
    id: 'fenwicks_crossing:the_bridge_chapel',
    areaId: 'fenwicks_crossing',
    at: { x: -8, z: -37.4 },
    label: 'Look at the bridge chapel',
    caption:
      'A chapel on the bridge for travellers to pray in before the crossing. There is a slot in ' +
      'the door for offerings, and a newer slot beside it with TOLL cut over it. Both slots go ' +
      'into the same box.',
  },
  {
    id: 'fenwicks_crossing:the_watermill',
    areaId: 'fenwicks_crossing',
    at: { x: 38, z: -50 },
    label: 'Look at the watermill',
    caption:
      "The far bank's mill, its wheel turning in a race cut off the river. It grinds for the " +
      'far bank and not for the town, which has its own mill and its own opinions.',
  },
  {
    id: 'fenwicks_crossing:the_north_ferry',
    areaId: 'fenwicks_crossing',
    at: { x: -82, z: -52 },
    label: 'Look at the ferry landing',
    caption:
      "The far bank's landing, for when the bridge is shut. The bridge has never been shut. The " +
      'ferryman is paid by the tollers to wait, which is the only job on the river that pays.',
  },
  {
    id: 'fenwicks_crossing:the_south_ferry',
    areaId: 'fenwicks_crossing',
    at: { x: -86, z: -32 },
    label: 'Look at the ferry bell',
    caption:
      'Nets on the racks, the ferry rope through its post, and a bell to ring for the boat. The ' +
      'bell has no clapper. People ring it anyway, out of habit, and the ferryman comes, out of ' +
      'habit.',
  },
  {
    id: 'fenwicks_crossing:the_drovers_fold',
    areaId: 'fenwicks_crossing',
    at: { x: 80, z: -54 },
    label: "Look at the drovers' fold",
    caption:
      'Hurdle pens where the drovers hold the herds overnight rather than pay the bridge by the ' +
      'head. In the morning the herds cross at the ford upstream, and the tollers pretend not ' +
      'to see.',
  },
  {
    id: 'fenwicks_crossing:the_moorings',
    areaId: 'fenwicks_crossing',
    at: { x: 56, z: -52 },
    label: 'Look at the moorings',
    caption:
      'Mooring posts along the far bank, their ropes rotted through. A ring on one post is ' +
      'polished bright. Something ties up here at night that does not use a rope.',
  },
  {
    id: 'fenwicks_crossing:the_burying_ground',
    areaId: 'fenwicks_crossing',
    at: { x: -14, z: 48 },
    label: 'Look at the burying ground',
    caption:
      'The older stones along the river side, the newer going up the slope away from it. Nobody ' +
      'wants to be buried near the water. The water keeps coming for them anyway.',
  },
  {
    id: 'fenwicks_crossing:the_toll_board',
    areaId: 'fenwicks_crossing',
    at: { x: 28, z: -20 },
    label: 'Read the toll board',
    caption:
      "FENWICK'S RATES, and under it in Magistracy paint, THE RATES: a cart, a horse, a head of " +
      'cattle, a soul on foot. The last line has been rubbed out and written in again, several ' +
      'times, at the same price.',
  },
  {
    id: 'fenwicks_crossing:the_tollers_lodge',
    areaId: 'fenwicks_crossing',
    at: { x: 86, z: -16 },
    label: "Look at the tollers' lodge",
    caption:
      'A bench outside worn to the shape of sitting, and the rates pinned to the door. So is a ' +
      'list of names headed EXEMPT, and it is shorter than you would think.',
  },
  {
    id: 'fenwicks_crossing:the_mill_race',
    areaId: 'fenwicks_crossing',
    at: { x: 26, z: -60 },
    label: 'Look at the mill race',
    caption:
      "Cut off the river to turn the far bank's wheel, with a sluice at its head chained open. " +
      'Somebody has hung a key on the chain, which is either a joke or a very long patience.',
  },

  /* ---- Weeping Stile ---- */
  {
    id: 'weeping_stile:the_stile',
    areaId: 'weeping_stile',
    at: { x: 2, z: -50 },
    label: 'Look at the stile',
    caption:
      'Two steps up, a plank over, two steps down, through the thicket to the field beyond. The ' +
      'steps are worn in the middle. The field is where the hollow buried its own, before the ' +
      'roll decided where they went instead.',
  },
  {
    id: 'weeping_stile:the_willow',
    areaId: 'weeping_stile',
    at: { x: -6, z: -60.6 },
    label: 'Look up at the willow',
    caption:
      'A willow gone to bone, older than the chapel, its limbs over the stile. Sixty-one ' +
      'ribbons are tied to the lowest branch, grey now. One of them is new.',
  },
  {
    id: 'weeping_stile:the_hermits_cell',
    areaId: 'weeping_stile',
    at: { x: -26, z: -62 },
    label: "Look into the hermit's cell",
    caption:
      'Four walls, no roof, a stone bench and a stone cup on it. The hermit kept the grave ' +
      'field when there was nobody else to. The cup has rainwater in it and a leaf, and ' +
      'somebody has left a crust beside it.',
  },
  {
    id: 'weeping_stile:the_hermits_grave',
    areaId: 'weeping_stile',
    at: { x: -18, z: -66 },
    label: "Look at the hermit's grave",
    caption:
      'At the head of the field he kept: a cairn, and an urn with nothing in it. Nobody knows ' +
      'who buried him. The roll has him down as RELOCATED with the rest.',
  },
  {
    id: 'weeping_stile:the_grave_field',
    areaId: 'weeping_stile',
    at: { x: 18, z: -70 },
    label: 'Look along the graves',
    caption:
      'Stones in rows, the old names cut deep and the newer ones scratched. The newest row has ' +
      'no names, only a mark, the same mark over and over, as if whoever cut them could not ' +
      'bring themselves to write the word.',
  },
  {
    id: 'weeping_stile:the_lych_gate',
    areaId: 'weeping_stile',
    at: { x: 40, z: -2 },
    label: 'Look at the lych-gate',
    caption:
      'Where the coffins waited for the priest. The roof is a sheet of canvas now. Under it on ' +
      'the bench somebody has left a pair of boots, laced, side by side, facing out.',
  },
  {
    id: 'weeping_stile:the_drowned_well',
    areaId: 'weeping_stile',
    at: { x: -58, z: 18 },
    label: 'Look into the well',
    caption:
      'Drowned to the lip at the end of the path. The rope still goes down into it and does not ' +
      'come up. Pull on it and it pulls back, a little, and then lets go.',
  },
  {
    id: 'weeping_stile:the_south_wood',
    areaId: 'weeping_stile',
    at: { x: -2, z: 62 },
    label: 'Look into the wood',
    caption:
      'The only dry ground in the hollow is the wood, which is why nobody lived in it. It is ' +
      'quiet here in a way the rest of the Stile is not. That is not the same as empty.',
  },
  {
    id: 'weeping_stile:the_roll',
    areaId: 'weeping_stile',
    at: { x: -14, z: -38 },
    label: 'Read the stone',
    caption:
      'RELOCATED — LABOUR — 61, cut clean by a Magistracy mason. Beside it, scratched in with a ' +
      'nail: WE WERE NOT ASKED. Beside that, in another hand: WE WERE COUNTED.',
  },
  {
    id: 'weeping_stile:the_lane_shrine',
    areaId: 'weeping_stile',
    at: { x: 64, z: 8 },
    label: 'Look at the cairn',
    caption:
      'A cairn on the lane just past the gate, for whoever comes back. Sixty-one stones in it. ' +
      'Somebody counts them every week, and every week there are sixty-one.',
  },

  /* ---- The Caldera ---- */
  {
    id: 'caldera:the_lava_fall',
    areaId: 'caldera',
    at: { x: 100, z: 30 },
    label: 'Look at the lava fall',
    caption:
      'Running down a spur of the east wall into a pool that never crusts over, since before ' +
      'the Cinderworks was built. The works always said it would tap it. The tap field is what ' +
      'happened when it tried.',
  },
  {
    id: 'caldera:the_obsidian_field',
    areaId: 'caldera',
    at: { x: -40, z: -70 },
    label: 'Look across the glass',
    caption:
      'The floor set to glass, black and sharp enough to cut a boot through. Footprints are ' +
      'pressed into it where it was still soft. They go out towards the middle, and they do not ' +
      'come back.',
  },
  {
    id: 'caldera:the_obsidian_spire',
    areaId: 'caldera',
    at: { x: -56, z: -68 },
    label: 'Look into the spire',
    caption:
      'Black glass taller than a man, grown where a bubble in the flow burst and froze. Look ' +
      'into it and there is something in the glass, a long way down, that looks back.',
  },
  {
    id: 'caldera:the_fumaroles',
    areaId: 'caldera',
    at: { x: -90, z: -18 },
    label: 'Look at the fumaroles',
    caption:
      'The ground breathes here, a vent every few strides with its own colour of bloom round ' +
      'its mouth. The survey numbered each one. The numbers go up to forty. There are ' +
      'fifty-one.',
  },
  {
    id: 'caldera:the_sulphur_bloom',
    areaId: 'caldera',
    at: { x: -106, z: 30 },
    label: 'Look at the sulphur',
    caption:
      'Crusted yellow on the ash where the vents breathe on it, bright enough to see by at ' +
      'night. It stinks of the Cinderworks, or the Cinderworks stinks of it.',
  },
  {
    id: 'caldera:the_survey_camp',
    areaId: 'caldera',
    at: { x: 6, z: 70 },
    label: 'Look at the camp',
    caption:
      'Somebody surveyed the Caldera once: tents gone to rags, a fire gone to scorch, a sack of ' +
      'stakes. The report is in the Archive at Highcourt, under a title that is only a number.',
  },
  {
    id: 'caldera:the_survey_line',
    areaId: 'caldera',
    at: { x: 40, z: 90 },
    label: 'Look along the cairns',
    caption:
      'A line of cairns straight across the south floor, one every thirty paces, marking where ' +
      'the Magistracy decided the crater ends. The crater did not agree. The last cairn is on ' +
      'its side in the ash.',
  },
  {
    id: 'caldera:the_fallen_hut',
    areaId: 'caldera',
    at: { x: -18, z: 72 },
    label: 'Look into the hut',
    caption:
      'Fallen in, the table inside still set up with its instruments. The last reading was ' +
      'written down and then crossed out so hard the pen went through the paper.',
  },
  {
    id: 'caldera:the_tap_field',
    areaId: 'caldera',
    at: { x: -30, z: -42 },
    label: 'Look at the tap field',
    caption:
      'THE TAP FIELD — KEEP OUT, and past the stone the ground cracked and scorched where the ' +
      'works tried to draw the heat off. It took nine. The wall says so, in the same paint as ' +
      'the warning.',
  },
  {
    id: 'caldera:the_inner_rim',
    areaId: 'caldera',
    at: { x: -36, z: -54 },
    label: 'Look through the gap',
    caption:
      'A gap in the old crater wall where the rock came down, and past it the inner basin, the ' +
      "Caldera's first floor. Everything out here is the Caldera still growing.",
  },

  /* ---- The Ashwood ---- */
  {
    id: 'ashwood:the_great_ash',
    areaId: 'ashwood',
    at: { x: 78, z: -82 },
    label: 'Look up at the Great Ash',
    caption:
      'Dead a hundred years and still standing, older than the wood round it by as much again. ' +
      'It made this clearing by dying: nothing grew where its shade fell. The wolves sleep ' +
      'under it, when they sleep.',
  },
  {
    id: 'ashwood:the_ash_roots',
    areaId: 'ashwood',
    at: { x: 92, z: -80 },
    label: 'Look at the roots',
    caption:
      'Roots out of the ground like knuckles, and between them bones picked white. Deer, ' +
      'mostly. The wolves bring what they take up here to eat it where they can see the whole ' +
      'wood coming.',
  },
  {
    id: 'ashwood:the_charcoal_clamp',
    areaId: 'ashwood',
    at: { x: -14, z: -80 },
    label: 'Look at the clamp',
    caption:
      'A dome of turf with the wood stacked inside, burning too slowly to flame. It wants ' +
      "opening today or it burns through to ash and a season's work goes up the smoke. Nobody " +
      'has come to open it.',
  },
  {
    id: 'ashwood:the_burners_hut',
    areaId: 'ashwood',
    at: { x: 26, z: -84 },
    label: 'Look into the hut',
    caption:
      'Two bunks, a pot, a pair of boots by the door. The burners live out here all season and ' +
      'walk down to the Levels once, black to the elbow, to sell. They are late this year, and ' +
      'the boots are still here.',
  },
  {
    id: 'ashwood:the_woodcutters_cottage',
    areaId: 'ashwood',
    at: { x: -106, z: -22 },
    label: 'Look inside the walls',
    caption:
      'A cottage down to its footings, the hearth still in the middle. The woodcutters left ' +
      'when the Magistracy stopped paying for the ride to be kept, and took the roof with them. ' +
      'It was good timber.',
  },
  {
    id: 'ashwood:the_sawpit',
    areaId: 'ashwood',
    at: { x: -92, z: -14 },
    label: 'Look into the sawpit',
    caption:
      'A pit for the man under the saw, the one who took the dust in his eyes. It has filled ' +
      'with rain, and there is a saw still down there, the handle just showing, as if it were ' +
      'waiting for a hand.',
  },
  {
    id: 'ashwood:the_second_cottage',
    areaId: 'ashwood',
    at: { x: -98, z: 10 },
    label: 'Look at the burnt cottage',
    caption:
      'The other cottage, the one that burned. The ends of its rafters are charcoal under the ' +
      "grass, and a horse whittled out of ash lies in the hearth, small enough for a child's " +
      'hand. Nobody came back for it.',
  },
  {
    id: 'ashwood:the_hunting_stand',
    areaId: 'ashwood',
    at: { x: 98, z: 6 },
    label: 'Look up at the stand',
    caption:
      "A platform on legs, high enough to see over a deer's back across the whole clearing. The " +
      'Magistracy built it for its guests. The poachers use it now, and there is always ' +
      'somebody up there.',
  },
  {
    id: 'ashwood:the_ruins_hide',
    areaId: 'ashwood',
    at: { x: -82, z: -30 },
    label: 'Look at the hide',
    caption:
      'Brush woven over a frame, low enough to lie in. A bedroll, a sack of pegs, a line of ' +
      "snares already knotted. The knots are the ones on the ranger's stone.",
  },
  {
    id: 'ashwood:the_snare_line',
    areaId: 'ashwood',
    at: { x: -70, z: 82 },
    label: 'Look along the snares',
    caption:
      'Snares strung at ankle height round the hide, dozens of them, most with something in. ' +
      'The poachers do not come back for all of it. The foxes do, and they have learned which ' +
      'knots slip.',
  },
  {
    id: 'ashwood:the_east_hide',
    areaId: 'ashwood',
    at: { x: 66, z: 82 },
    label: 'Look at the watching hide',
    caption:
      'A third hide, with a clear line out of it down the ride towards the Levels road. Marks ' +
      'are scratched into the frame: carts, and beside each cart a tally of what it carried.',
  },
  {
    id: 'ashwood:the_old_edge',
    areaId: 'ashwood',
    at: { x: -66, z: -6 },
    label: "Look at the old wood's edge",
    caption:
      'The trunks close up here like a hedge, planted that way round the old wood when there ' +
      'was a ranger to plant it. Somebody has cut a way through since. Not recently, and not ' +
      'the ranger.',
  },

  /* ---- The Rimefields ---- */
  {
    id: 'rimefields:the_frozen_falls',
    areaId: 'rimefields',
    at: { x: 6, z: -70 },
    label: 'Look up at the frozen falls',
    caption:
      'The fall came off the escarpment and froze where it fell, a sheet of ice as tall as a ' +
      'house. Put an ear to it and the water is still moving somewhere behind it, a long way ' +
      'in.',
  },
  {
    id: 'rimefields:the_icicles',
    areaId: 'rimefields',
    at: { x: -2, z: -74 },
    label: 'Look at the icicles',
    caption:
      'Icicles off the lip of the fall, some longer than a man is tall. Every so often one lets ' +
      'go, and the sound it makes going into the pool carries across the whole field.',
  },
  {
    id: 'rimefields:the_frozen_stream',
    areaId: 'rimefields',
    at: { x: 6, z: -52 },
    label: 'Look along the stream',
    caption:
      'What the fall fed, frozen from bank to bank and all the way down. There are fish in it, ' +
      "stopped in the middle of turning, an arm's length under your boots.",
  },
  {
    id: 'rimefields:the_lead_wagon',
    areaId: 'rimefields',
    at: { x: -108, z: 2 },
    label: 'Look at the lead wagon',
    caption:
      'Broadside across the road where the road stops, as if the driver turned it to make a ' +
      'wall. There is frost on the inside of the canvas. Whatever they were keeping out, they ' +
      'kept it out from in here.',
  },
  {
    id: 'rimefields:the_oxen',
    areaId: 'rimefields',
    at: { x: -96, z: -12 },
    label: 'Look at the oxen',
    caption:
      'Still in the traces, or what the hounds have left of them. The yoke is iced to the pole. ' +
      'Nobody unhitched them, which means nobody meant to stop here.',
  },
  {
    id: 'rimefields:the_road_end',
    areaId: 'rimefields',
    at: { x: -92, z: 2 },
    label: 'Look along the road',
    caption:
      'The Chalk Road runs on past the last waystone for a hundred paces more under the snow, ' +
      'the same as it has for sixty miles. Then it stops at a wagon.',
  },
  {
    id: 'rimefields:the_fishing_huts',
    areaId: 'rimefields',
    at: { x: -92, z: 54 },
    label: 'Look at the fishing huts',
    caption:
      'Timber huts dragged out onto the tarn on runners, a stovepipe through each roof and a ' +
      'hole through the ice by each door. The stoves are cold. The holes are freezing over from ' +
      'the edges in.',
  },
  {
    id: 'rimefields:the_fishing_hole',
    areaId: 'rimefields',
    at: { x: -74, z: 76 },
    label: 'Look into the hole',
    caption:
      'Cut through ice as thick as an arm is long. The water under it is black and very still, ' +
      'and something down there has been taking the lines. All of them, hooks and all.',
  },
  {
    id: 'rimefields:the_mammoth',
    areaId: 'rimefields',
    at: { x: 86, z: 28 },
    label: 'Look at the mammoth',
    caption:
      'A beast the size of a house lay down in the snow here, long before there were houses, ' +
      'and the snow took the rest of it away. The ribs still stand. The hounds sleep inside ' +
      'them.',
  },
  {
    id: 'rimefields:the_tusks',
    areaId: 'rimefields',
    at: { x: 104, z: 26 },
    label: 'Look at the tusks',
    caption:
      'Curled up and back over the skull, longer than a cart and yellow under the rime. ' +
      "Somebody tried to saw one off. The saw is still in it, a hand's width in, and its teeth " +
      'are gone.',
  },
  {
    id: 'rimefields:the_archers_post',
    areaId: 'rimefields',
    at: { x: -22, z: 54 },
    label: "Look at the archers' post",
    caption:
      "A fire in a ring of stones at the ridge's end, and a tally cut into the rock beside it: " +
      'one mark a day, rows of them, until the marks stop being days and start being something ' +
      'else.',
  },

  /* ---- The Storm Shelf ---- */
  {
    id: 'storm_shelf:pylon_nine',
    areaId: 'storm_shelf',
    at: { x: 4, z: -64 },
    label: 'Look up at Pylon Nine',
    caption:
      'The tallest iron on the shelf, and the one the others were set out from. The sky comes ' +
      'down to its crown more than to all the rest together. The survey never said why. The ' +
      'waystones only say not to shelter.',
  },
  {
    id: 'storm_shelf:the_gap_in_the_rank',
    areaId: 'storm_shelf',
    at: { x: -10, z: -74 },
    label: 'Look along the rank',
    caption:
      'The rank runs east to west, footing after footing, and breaks here for one. Nine stands ' +
      'behind the gap, as if the rank stepped aside for it, or it stepped out.',
  },
  {
    id: 'storm_shelf:the_glass_in_the_ground',
    areaId: 'storm_shelf',
    at: { x: 14, z: -78 },
    label: 'Look at the glass in the ground',
    caption:
      'Where a strike went into the shelf it melted the rock into a root of glass, branched ' +
      'like a tree grown downwards. There are dozens of them round Nine. You can hear the ones ' +
      'under you ring.',
  },
  {
    id: 'storm_shelf:the_ranks_west',
    areaId: 'storm_shelf',
    at: { x: -80, z: -6 },
    label: 'Look down the ranks',
    caption:
      'From the track the footings run away east in their rows as far as the rain lets you see, ' +
      'and past that, you know, they keep going. Somebody surveyed this, and then left.',
  },
  {
    id: 'storm_shelf:the_survey_hut',
    areaId: 'storm_shelf',
    at: { x: 82, z: 66 },
    label: 'Look into the hut',
    caption:
      'Burnt to the sills, the table in the middle still standing because it was iron. The ' +
      "survey's instruments are fused to it in a lump. Whatever they were measuring, they got a " +
      'reading.',
  },
  {
    id: 'storm_shelf:the_survey_table',
    areaId: 'storm_shelf',
    at: { x: 88, z: 76 },
    label: 'Look at the survey table',
    caption:
      'Iron, and scorched blue. Scratched into the top by somebody who did not have paper left: ' +
      'a column of dates, and against each date a count of strikes that goes up by one every ' +
      'day.',
  },
  {
    id: 'storm_shelf:the_strike',
    areaId: 'storm_shelf',
    at: { x: 66, z: 60 },
    label: 'Look at the scorch',
    caption:
      'The ground here is black in a star as wide as a cart, and the tent that stood in the ' +
      'middle of it is a ring of pegs. The strike found the camp on its first night. The camp ' +
      'stayed nine more.',
  },
  {
    id: 'storm_shelf:the_stakes',
    areaId: 'storm_shelf',
    at: { x: 60, z: 80 },
    label: 'Look at the stakes',
    caption:
      "Iron stakes driven in round the camp in a ring, the survey's idea of a lightning rod. " +
      'Every one of them has been struck. Every one of them is still standing, which is more ' +
      'than the camp is.',
  },
  {
    id: 'storm_shelf:the_shelter_scorch',
    areaId: 'storm_shelf',
    at: { x: -94, z: 26 },
    label: 'Look under the footing',
    caption:
      'Somebody sheltered under this footing once, whatever the waystones said. The scorch on ' +
      'the ground under it is the shape of a person sitting with their knees up.',
  },
  {
    id: 'storm_shelf:the_track_east',
    areaId: 'storm_shelf',
    at: { x: 78, z: 10 },
    label: 'Look down the track',
    caption:
      'The track used to stop where the old survey stopped. Somebody carried it on, on foot, a ' +
      'stone at a time, down to the camp. It is the straightest thing on the shelf that is not ' +
      'iron.',
  },
];

export function sightsInArea(areaId: string): SightDef[] {
  return SIGHTS.filter((s) => s.areaId === areaId);
}

export function sightById(id: string): SightDef | undefined {
  return SIGHTS.find((s) => s.id === id);
}
