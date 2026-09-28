/**
 * What people in the ward say, and the box they say it in.
 *
 * The typewriter is not decoration. It sets the pace at which a new Commander reads the
 * one rule that keeps them alive, and it makes the advance key mean something before it
 * has anything else to do.
 */

export interface DialogueLine {
  who: string;
  text: string;
}

export interface Dialogue {
  lines: DialogueLine[];
  onEnd?: () => void;
}

/** Characters revealed per second. Brisk enough not to be a tax on a re-read. */
const TYPE_SPEED = 48;

/**
 * The Dispatcher's script.
 *
 * Two jobs and no more: name the rule, and point at the first door. Everything else about
 * the ward the player finds out by walking into it.
 */
export const VEX_INTRO: DialogueLine[] = [
  {
    who: 'DISPATCHER VEX',
    text: 'New Whisperer. Walk with WASD; swing your eyes with Q and E.',
  },
  {
    who: 'DISPATCHER VEX',
    text: 'Now the only rule that keeps you breathing in Ashfall Ward. Sanctioned walkways are warded stone. On pavement, no Warden may see you. None. Ever.',
  },
  {
    who: 'DISPATCHER VEX',
    text: 'Step off onto the cobbles and you are EXPOSED. Their lamps find you, and the Magistracy does not argue with what it finds.',
  },
  {
    who: 'DISPATCHER VEX',
    text: 'Kit yourself out before you take work. The Artificer is up the walkway; your Field Journal is across from him. Then read the board, and take something small.',
  },
];

export const VEX_REPEAT: DialogueLine[] = [
  {
    who: 'DISPATCHER VEX',
    text: 'Contracts on the board, trades on the street, and the pavement under your feet. That is the whole of it.',
  },
];

/**
 * Everyone else in Azo, by script key.
 *
 * One entry per person placed in an area file, keyed by `NpcSpec.says` (which defaults to
 * their `id`). Kept here rather than in the area files for the same reason `VEX_INTRO` is
 * here: an area file is a map, and a map that also holds a page of prose stops being
 * readable as a map.
 *
 * The rule these were written to: **say something only this person, standing in this place,
 * would say.** Every line points at something the world already claims — the Census that
 * stopped being answered, the sluice that drowned the granary, the harbour closed by writ,
 * the pit that laid its miners off. A townsperson who remarks on the weather is a sign that
 * reads TOWNSPERSON, and the ward has enough signs.
 */
export const FOLK_LINES: Record<string, DialogueLine[]> = {
  /* --- Ashfall Ward ------------------------------------------------------------------ */
  ashfall_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'Ten on this ward. I start at the gate and I finish at the canal, and if you are still off the flags when I pass you a second time that is your own business.',
    },
    {
      who: 'LAMPLIGHTER',
      text: 'Every lamp in Jolrek is Magistracy property. So is the light. Bear that in mind about where you choose to stand.',
    },
  ],
  ashfall_gate_guard: [
    { who: 'GATE SENTRY', text: 'South gate. Stay on the flags and you and I have no argument.' },
    {
      who: 'GATE SENTRY',
      text: 'Lamprow is warded the same as here. What lies between the two of them is not.',
    },
  ],

  /* --- Lamprow ----------------------------------------------------------------------- */
  lamprow_pit_miner: [
    {
      who: 'ELLERY PIT HAND',
      text: 'Pit shut in the spring. Twelve years down it, and a note on the gate.',
    },
    {
      who: 'ELLERY PIT HAND',
      text: 'Now I light lamps I am not allowed to stand under. Read the wall if you think I am bitter.',
    },
  ],
  lamprow_tithe_clerk: [
    { who: 'TITHE CLERK', text: 'Lamprow pays for its own light. In person, and on time.' },
    {
      who: 'TITHE CLERK',
      text: 'You will meet the collectors below the kerb. They are not clerks and they carry no ledger.',
    },
  ],
  lamprow_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'Forty-one lamps on the High Street. I light them. I do not own them.',
    },
    {
      who: 'LAMPLIGHTER',
      text: 'Where the light stops, the Sink starts. That is not a figure of speech.',
    },
  ],

  /* --- The Bonemarket ---------------------------------------------------------------- */
  bonemarket_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'Five, and I light them while the stalls are still coming down. They want seeing to pack up and I want seeing to work.',
    },
  ],
  bonemarket_grocer: [
    {
      who: 'GROCER',
      text: 'Reagents are one row over. I sell what people eat, which makes me the odd stall here.',
    },
  ],
  bonemarket_fishmonger: [
    {
      who: 'FISHMONGER',
      text: 'Off the Saltglass carts, when the writ lets a cart through. Which is not this week.',
    },
  ],
  bonemarket_jeweler: [
    { who: 'JEWELLER', text: 'Bone sets better than silver and takes a polish nothing else takes.' },
    {
      who: 'JEWELLER',
      text: 'Do not ask me whose. Half of what is legal in this market is neither.',
    },
  ],
  bonemarket_stallkeeper: [
    {
      who: 'STALLKEEPER',
      text: 'Weigh it twice. Somebody painted that on the arcade and they were being kind.',
    },
  ],

  /* --- The Cinderworks --------------------------------------------------------------- */
  cinderworks_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'You would think a ward full of furnaces would light its own lanes. Furnace glow is not light. It is something happening to you.',
    },
  ],
  cinderworks_smith: [
    {
      who: 'FOUNDRY SMITH',
      text: 'Everything the Spire stands on came off a casting floor like this one.',
    },
    {
      who: 'FOUNDRY SMITH',
      text: 'The Artificer up in Ashfall will fit you out. I only make the stock he cuts it from.',
    },
  ],
  cinderworks_glassblower: [
    {
      who: 'GLASSBLOWER',
      text: 'This furnace has not been let go cold in nine years. Nobody here would dare be the one.',
    },
  ],
  cinderworks_miner: [
    {
      who: 'ASH-YARD HAND',
      text: 'Slag comes out hot and goes on the heap. Then we go through the heap.',
    },
    {
      who: 'ASH-YARD HAND',
      text: 'Something lives in the flues. We do not go in after it, and neither should you.',
    },
  ],

  /* --- Ward Seven -------------------------------------------------------------------- */
  ward_seven_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'Four lamps and I do not linger over any of them. Whatever is wrong with the water down here is wrong with the air by now.',
    },
  ],
  ward_seven_healer: [
    {
      who: 'WARD HEALER',
      text: 'The cistern stopped draining and the ward did not stop drinking. That is the whole of it.',
    },
    {
      who: 'WARD HEALER',
      text: 'There is no clinic here. There is me, and a back alley in Jolrek that works to a quota.',
    },
  ],
  ward_seven_apothecary: [
    {
      who: 'APOTHECARY',
      text: 'Boil it. Whatever it is, wherever you drew it, whatever I sold you. Boil it first.',
    },
  ],

  /* --- Highcourt and the Spire ------------------------------------------------------- */
  highcourt_lamplighter: [
    {
      who: 'LAMPLIGHTER',
      text: 'Seven, on the processional. Best-lit street in Azo and there is never anybody on it to see.',
    },
    {
      who: 'LAMPLIGHTER',
      text: 'They keep the service end dark on purpose. I asked once. I was told the round is seven lamps.',
    },
  ],
  highcourt_scribe: [
    {
      who: 'COURT SCRIBE',
      text: 'The Magistracy does not decide things. It records them, and then they are decided.',
    },
    {
      who: 'COURT SCRIBE',
      text: 'If your name reaches this floor on paper, you will hear about it after the ink dries.',
    },
  ],
  highcourt_noblewoman: [
    {
      who: 'A LADY OF THE COURT',
      text: 'The air is cleaner up here. It is sold by the hour, so it had better be.',
    },
  ],
  highcourt_crier: [
    {
      who: 'TOWN CRIER',
      text: 'Relocations are posted at the undercroft. Read them yourself. I only say them louder.',
    },
  ],

  /* --- Millharrow -------------------------------------------------------------------- */
  millharrow_miller: [
    { who: 'THE MILLER', text: 'Sluice went in the wet season and took the low granary with it.' },
    {
      who: 'THE MILLER',
      text: 'Something has been living in the flooded end since. It was not there before.',
    },
  ],
  millharrow_farmer_wife: [
    {
      who: 'A FARMER WIFE',
      text: 'Four roads out of this crossroads, and the toll sits on the best of them.',
    },
    {
      who: 'A FARMER WIFE',
      text: 'The boy running it is fourteen and branded with a tithe mark. Think on that before you draw.',
    },
  ],
  millharrow_baker: [
    {
      who: 'BAKER',
      text: 'The duellist at the waystone eats our bread. The children carry it out to him.',
    },
  ],

  /* --- The Tallow Levels ------------------------------------------------------------- */
  tallow_farmer_daughter: [
    {
      who: 'FARM GIRL',
      text: 'Keep to the worked strips. What lies between them is cut, and the cuts are deeper than they look.',
    },
    {
      who: 'FARM GIRL',
      text: 'The north field went over in a fortnight. Father calls it blight. It does not spread like blight.',
    },
  ],
  tallow_tanner: [
    {
      who: 'TANNER',
      text: 'Rendering country. You will smell the Levels before you see them, and then you will not stop.',
    },
  ],

  /* --- Saltglass --------------------------------------------------------------------- */
  saltglass_fisherman: [
    {
      who: 'FISHERMAN',
      text: 'Harbour is shut by writ. Boats here, fish there, and one sheet of paper between them.',
    },
    {
      who: 'FISHERMAN',
      text: 'There will be trouble on this quay before the month is out. Driftwood pikes, if it comes to it.',
    },
  ],
  saltglass_panwife: [
    {
      who: 'PAN-WIFE',
      text: 'Pans are worked before dawn, while the glare is off the flats. Come at noon and you will see nothing at all.',
    },
  ],

  /* --- Bray Hollow ------------------------------------------------------------------- */
  brays_elder: [
    { who: 'OLD BRAY', text: 'There is no town here. There never was. A bowl, a lane, and us.' },
    {
      who: 'OLD BRAY',
      text: 'Somebody puts those two lamps out every night. It is not the Magistracy, and they know it.',
    },
    {
      who: 'OLD BRAY',
      text: 'They came for the herd with a warrant. A licence costs more than the beasts now.',
    },
  ],
  brays_child: [
    {
      who: 'A HOLLOW CHILD',
      text: 'They throw stones from past the fences. Not at you. At the ones carrying paper.',
    },
  ],

  /* --- Fenwick Crossing -------------------------------------------------------------- */
  fenwick_innkeeper: [
    {
      who: 'INNKEEPER',
      text: 'Every rumour on Azo drinks here on its way somewhere else. Sit long enough and you will hear your own.',
    },
  ],
  fenwick_brewer: [
    {
      who: 'BREWER',
      text: 'There is a cellar under this house I have not opened since the spring. You can hear why.',
    },
  ],
  fenwick_bard: [
    {
      who: 'A TRAVELLING BARD',
      text: 'Fenwick took the toll and the bridge. It scans better than it happened.',
    },
    {
      who: 'A TRAVELLING BARD',
      text: 'Freight moves at night now, and the ones moving it wear masks. Nobody has asked me to sing about that.',
    },
  ],
  fenwick_cartographer: [
    {
      who: 'CARTOGRAPHER',
      text: 'Road north to Millharrow, road west to the Stile, track east onto the Shelf.',
    },
    {
      who: 'CARTOGRAPHER',
      text: 'I draw the Wildlands as a blank. That is not laziness. Nothing out there stays where you put it.',
    },
  ],

  /* --- Weeping Stile ----------------------------------------------------------------- */
  stile_census_clerk: [
    {
      who: 'CENSUS CLERK',
      text: 'Sixty-one souls on the roll. The village stopped answering two counts ago.',
    },
    {
      who: 'CENSUS CLERK',
      text: 'RELOCATED, it says beside them. LABOUR. Same hand that wrote the roll, and it was not mine.',
    },
  ],
  stile_mercenary: [
    {
      who: 'A HIRED BLADE',
      text: 'He pays me to walk him in and walk him out. He said nothing about the walking out being the hard half.',
    },
    {
      who: 'A HIRED BLADE',
      text: 'You are Coldwater sort. She works the same way and asks fewer questions.',
    },
  ],
  /* --- The second pass ---------------------------------------------------------------
   *
   * Seventeen more, filling in the trades each place already implies rather than opening a
   * new subject: the Levels tan hides and now also make boots out of them, Millharrow mills
   * grain and now also brews it, Saltglass charts a harbour it is not allowed to leave. The
   * Wildlands are still empty and still should be.
   */

  /* --- Ashfall Ward ------------------------------------------------------------------ */
  ashfall_smith: [
    {
      who: 'THE IRONWORKS SMITH',
      text: 'The Artificer fits your gear. I make the bar he cuts it out of. Different trade, same door.',
    },
  ],
  ashfall_cobbler: [
    {
      who: 'COBBLER',
      text: 'Whisperers wear through a sole a season. Whatever you are walking on out there, it is not flags.',
    },
  ],
  ashfall_crier: [
    {
      who: 'THE CRIER',
      text: 'Hear this: the wharf is closed, the Counting House is sealed, and the curfew bell is at nine. Hear this: none of that is new.',
    },
    {
      who: 'THE CRIER',
      text: 'I am paid by the word and the Magistracy writes the words. If you want the other news, the Cinder Cup has a board.',
    },
  ],
  ashfall_toll_clerk: [
    {
      who: 'TOLL CLERK',
      text: 'Nothing has tied up in eleven days. I open at six and I close at six and in between I count a box that does not change.',
    },
    {
      who: 'TOLL CLERK',
      text: 'The Counting House is supposed to send for the takings. If you see the Counting House, tell it.',
    },
  ],
  bonemarket_knacker: [
    {
      who: 'KNACKER',
      text: 'Everything that works dies of it, and I get it after. The Magistracy gets a line in my book, the tanners get the hide, the glue works get the rest, and I get to be the man nobody shakes hands with.',
    },
    {
      who: 'KNACKER',
      text: 'The lads on the Shambles at night are not mine. They take what comes to the pens before it is counted, and the counting is the only thing here worth stealing.',
    },
  ],
  bonemarket_rag_sorter: [
    {
      who: 'RAG-SORTER',
      text: 'Rags, bones, bottles, iron. Everything has a price in here, even the price. Especially the price.',
    },
    {
      who: 'RAG-SORTER',
      text: 'Keep out of the last lane after dark. Not for anything in it. For what you will look like, coming out, to whoever is waiting.',
    },
  ],
  millharrow_innkeeper: [
    {
      who: 'INNKEEPER',
      text: 'The Crossroads Arms. Four roads in and a bed for each of them, and the tollman drinks free because he counts the other three.',
    },
    {
      who: 'INNKEEPER',
      text: 'We hold the fair on the green every quarter-day, whatever the writ says. The writ says nothing about fairs. That is the point of a fair.',
    },
  ],
  millharrow_drover: [
    {
      who: 'DROVER',
      text: 'I bring the sheep down off the downs to the Bonemarket, and I bring the money back up to a man who does not own them. Somewhere in there I am meant to eat.',
    },
    {
      who: 'DROVER',
      text: 'Mind the fields after dark. There are men standing out there very still, and they are not scarecrows, whatever the miller tells you.',
    },
  ],
  millharrow_fiddler: [
    {
      who: 'FIDDLER',
      text: 'A tune is a copper. Silence is two. You would be surprised which one I earn more from.',
    },
    {
      who: 'FIDDLER',
      text: 'The Scarecrow Men come in off the fields at the end of the night and stand at the back to listen. They never pay. I never stop.',
    },
  ],
  ashfall_tanner: [
    {
      who: 'TANNER',
      text: 'Bark from the Ashwood, lime from the Verge, hides from the Bonemarket, and the smell goes back up the cross-street to the ward that wrote the rule about it. That is the arrangement.',
    },
    {
      who: 'TANNER',
      text: "They walled us off the end of the street in my father's time and called it a row. The Magistracy still buys the leather. It just buys it with its nose held.",
    },
  ],
  ashfall_tanners_boy: [
    {
      who: 'BOY AT THE PITS',
      text: 'I stir. That is the job. You stir till your arms come off, and then you stir with what is left.',
    },
    {
      who: 'BOY AT THE PITS',
      text: 'Not that one. That one is the lime. It does not look like anything, which is how it gets you.',
    },
  ],
  ashfall_barge_hand: [
    {
      who: 'BARGEE',
      text: 'Coal up from the works, grain down from the Ring. That was the run. Now the run is sitting in here waiting for a licence they do not issue.',
    },
    {
      who: 'BARGEE',
      text: 'The canal is open. Read the writ; it says so itself. It is everything on either bank of it that is shut.',
    },
  ],
  ashfall_records_clerk: [
    {
      who: 'RECORDS CLERK',
      text: 'The roll is on the lectern. You may read it. You may not correct it, and you may not ask why a hearth is marked sealed.',
    },
    {
      who: 'RECORDS CLERK',
      text: 'I was at Weeping Stile for the last count. I do the counting now and somebody else does the walking.',
    },
  ],
  ashfall_counting_clerk: [
    {
      who: 'COUNTING CLERK',
      text: 'The door was sealed for a reason and the reason has been served, apparently. So. Welcome to the arrears.',
    },
    {
      who: 'COUNTING CLERK',
      text: 'I remit what the Spire asks for. What is left over after that is a thing I have been told is nil. Look in the box if you like. I do not.',
    },
  ],
  ashfall_priest: [
    {
      who: 'KEEPER OF THE FLAME',
      text: 'Light one if you want. It costs nothing. That is the last thing in this ward of which that is true.',
    },
    {
      who: 'KEEPER OF THE FLAME',
      text: 'Forty-one names on the wall and sixty-one hearths in the Stile with none. I have asked for a second plaque. I have been assessed for asking.',
    },
  ],
  ashfall_publican: [
    {
      who: 'PUBLICAN',
      text: 'Brews on the shelf, a bed up the stair, and a board by the door that says what the crier is paid not to.',
    },
    {
      who: 'PUBLICAN',
      text: 'No tab for Whisperers. Nothing personal. You are the only trade in the ward that leaves and might not come back.',
    },
  ],
  ashfall_drinker_a: [
    {
      who: 'PIT HAND',
      text: 'Lamprow pit. Twelve years. Now I drink in the next ward over so nobody I know sees me do it before noon.',
    },
    {
      who: 'PIT HAND',
      text: 'The Cinderworks is hiring. So is the Warden. One of those you come home from.',
    },
  ],
  ashfall_drinker_b: [
    {
      who: 'THE SINGER',
      text: 'I had a song about the Counting House. The Magistracy assessed it. I have a song about the assessment now; it is shorter.',
    },
    {
      who: 'THE SINGER',
      text: 'Tip the box by the hearth if you want the long one. The keeper of the Flame gets a cut. Everybody gets a cut.',
    },
  ],
  lamprow_oil_keeper: [
    {
      who: 'OIL KEEPER',
      text: 'Nine gills a night for the row. I measure it out, the boy carries it, the lamplighter burns it, and the ward pays for it three times over.',
    },
    {
      who: 'OIL KEEPER',
      text: 'The measure is on the wall. Read it before you ask me why the shelf is half empty; the other half is the tithe.',
    },
  ],
  lamprow_bailiff: [
    {
      who: 'BAILIFF',
      text: 'The clerk outside talks about the tithe. I collect it. We do not do each other’s job and we do not stand in each other’s room.',
    },
    {
      who: 'BAILIFF',
      text: 'The Sink is in arrears to the last hearth and the collectors have been down there every night. Read the ledger and tell me where the money is. I would genuinely like to know.',
    },
  ],
  lamprow_printer: [
    {
      who: 'PRINTER',
      text: 'I print the tithe bills. I print the writs. I printed the notice that closed the Ashfall wharf, and I was paid on time for every one of them.',
    },
    {
      who: 'PRINTER',
      text: 'What is under my shop is not mine. I lease the cellar to a man I have never met, and the rent arrives in coin that smells of lamp oil.',
    },
  ],
  bonemarket_boiler: [
    {
      who: 'BONE-BOILER',
      text: 'Everything the market cannot sell comes to me, and I boil it down, and what comes out goes back to the market as glue and lamp-black and meal. Nothing leaves this ward. That is the whole economy.',
    },
    {
      who: 'BONE-BOILER',
      text: 'The heap is picked over by the time the bell goes. Pick it yourself if you want the marrow; I only want the bone.',
    },
  ],
  bonemarket_pawnbroker: [
    {
      who: 'PAWNBROKER',
      text: 'I held a title once and now I hold tickets. The Magistracy assessed the one and licenses the other; I am not sure which I mind more.',
    },
    {
      who: 'PAWNBROKER',
      text: 'The shelf behind me is not on the inventory. When the market has seen you clear its vermin, I shall not notice you looking at it.',
    },
  ],
  cinderworks_foreman: [
    {
      who: 'FOREMAN',
      text: 'Six heats a day and the flats take one of them. I have stopped writing the fourth column. The Spire only reads the first.',
    },
    {
      who: 'FOREMAN',
      text: 'You want the flats, they are behind you, and I will not stop you. I have four men who walked off them and I am not sending a fifth to fetch them.',
    },
  ],
  cinderworks_poster: [
    {
      who: 'THE POSTER',
      text: 'I print at night and paste at dawn and they take it down by noon. Four hours. It is more than the count gets.',
    },
    {
      who: 'THE POSTER',
      text: 'Nobody pays me. Somebody pays for the paper. I have never met them and I have stopped asking the printer in Lamprow whose hand the coin comes in.',
    },
  ],
  cinderworks_carter: [
    {
      who: 'CARTER',
      text: 'Coal down from the cut, pigs up to the ward. Same cart, same road, and the road got longer this year without moving.',
    },
    {
      who: 'CARTER',
      text: 'The spur was for a rail that never came. The Spire ordered the iron for it off this very works, and then ordered the works to melt it back down.',
    },
  ],
  ward_seven_pumpman: [
    {
      who: 'PUMPMAN',
      text: 'Engine three. Nine years I have kept her turning and the water has not gone down an inch, because the pipe she lifts into runs uphill to somebody’s bath.',
    },
    {
      who: 'PUMPMAN',
      text: 'The things at the dry end came in through the outfall when it stopped outflowing. I keep to this end. You go to that one if you must.',
    },
  ],
  ward_seven_washerwoman: [
    {
      who: 'WASHERWOMAN',
      text: 'I wash in the seep and I dry on the line and it comes in wetter than it went out. That is Ward Seven, in a sentence, for free.',
    },
    {
      who: 'WASHERWOMAN',
      text: 'Eleven under that stone, one winter. The Magistracy sent a pump. It did not send a second stone.',
    },
  ],
  highcourt_musician: [
    {
      who: 'COURT MUSICIAN',
      text: 'I play at the footing every evening and nobody has ever come down to listen. The doors are open. Nothing comes out of them but the bell.',
    },
    {
      who: 'COURT MUSICIAN',
      text: 'The Cinder Cup has a singer with a song about the Counting House. I have a song about the Spire. Mine is not assessed; nobody has heard it.',
    },
  ],
  highcourt_clerk_of_works: [
    {
      who: 'CLERK OF WORKS',
      text: 'I hold the survey. Every stone on the processional is on it, to the inch. The service end is on the back, in pencil, and the Undercroft is not on it at all.',
    },
    {
      who: 'CLERK OF WORKS',
      text: 'The stair-head was built the year the survey was drawn. Something was under here before the court was, and the court was built on top of it very carefully.',
    },
  ],
  highcourt_usher: [
    {
      who: 'USHER',
      text: 'The doors stand open. I have stood at them eleven years. I have not been through them and I am not going to be asked.',
    },
    {
      who: 'USHER',
      text: 'When a summons is posted, the name on it is read from the other side of the rail. If you can read it from this side, it is yours.',
    },
  ],
  highcourt_smoke_eater: [
    {
      who: 'THE SMOKE-EATER',
      text: 'I brew for the court and sell what the court leaves, and I take a wager at the bench by the hearth from anyone who thinks the Rest is a soft house. It is not.',
    },
    {
      who: 'THE SMOKE-EATER',
      text: 'The bed is thirty. The court pays it without looking; you will look. That is the difference between you and the court, and it is the only one that matters up here.',
    },
  ],
  highcourt_undercroft_clerk: [
    {
      who: 'CENSUS CLERK',
      text: 'I count them onto the train at the gate and I count them on the stair, and the second number is smaller, and nobody got off.',
    },
    {
      who: 'CENSUS CLERK',
      text: 'The floor below is a floor. I have been told to write that down and I have written it down. I would like it to be true.',
    },
  ],
  lamprow_lighter_boy: [
    {
      who: "LIGHTER'S BOY",
      text: 'Nine gills, nine lamps, one bucket, twice a night. Up from the oil house and down the row and back before the bell.',
    },
    {
      who: "LIGHTER'S BOY",
      text: 'Highcourt is up that way. They have lamps that never go out. Nobody carries a bucket up there; I have looked.',
    },
  ],

  /* --- Lamprow ----------------------------------------------------------------------- */
  lamprow_urchin: [
    { who: 'A LAMPROW CHILD', text: 'I am allowed on the flags. Standing is free. It is everything else that is not.' },
    {
      who: 'A LAMPROW CHILD',
      text: 'Do not go down the steps after dark. The crews down there are not collecting for the Magistracy.',
    },
  ],
  lamprow_butcher: [
    {
      who: 'WARD BUTCHER',
      text: 'The tithe takes its cut off the block before the ward does. Same knife, earlier in the week.',
    },
  ],

  /* --- The Bonemarket ---------------------------------------------------------------- */
  bonemarket_butcher: [
    {
      who: 'BUTCHER',
      text: 'Beast or beef, it comes off the same hook. The difference is which row you sell it in.',
    },
  ],
  bonemarket_alchemist: [
    {
      who: 'ALCHEMIST',
      text: 'Every reagent in this market passed a weigh-house that is paid by the people selling it.',
    },
    {
      who: 'ALCHEMIST',
      text: 'Bring me marrow off something you killed yourself and I will tell you what it was. Free. I am curious, not kind.',
    },
  ],

  /* --- The Cinderworks --------------------------------------------------------------- */
  cinderworks_potter: [
    {
      who: 'POTTER',
      text: 'The foundry will not let its furnace cool, so I fire in its waste heat. The Magistracy has not thought to tax that yet.',
    },
  ],

  /* --- Ward Seven -------------------------------------------------------------------- */
  ward_seven_herbalist: [
    {
      who: 'HERBALIST',
      text: 'Everything growing on this ward grows out of the cistern. I sort what helps from what is only green.',
    },
  ],

  /* --- Highcourt and the Spire ------------------------------------------------------- */
  highcourt_herald: [
    {
      who: 'HERALD',
      text: 'I carry the colours in front of the writ. People look at the banner and not at what follows it. That is the job.',
    },
  ],
  highcourt_tailor: [
    {
      who: 'COURT TAILOR',
      text: 'Nobody up here is measured twice. Rank does not change, so neither does the pattern.',
    },
  ],

  /* --- Millharrow -------------------------------------------------------------------- */
  millharrow_millhand: [
    {
      who: 'MILLHAND',
      text: 'The stones are upstairs and the sacks are down here and I am the thing in between. Forty a day, when the carts come. They come less.',
    },
    {
      who: 'MILLHAND',
      text: 'Rats in the grain. Not our rats -- the road’s. They come up the hedge from the east every time a cart gets stopped out there and the load sits.',
    },
  ],
  tallow_renderer: [
    {
      who: 'RENDERER',
      text: 'Everything that dies on the Levels comes to the yard, and I boil it down to what it was worth. Less every year. The ground is taking the good out of them.',
    },
    {
      who: 'RENDERER',
      text: 'The engineer used to buy tallow off me for the pump. Then he stopped buying, and then he stopped, and then they chained it.',
    },
  ],
  millharrow_brewer: [
    {
      who: 'BREWER',
      text: 'Grain the mill cannot sell comes to me and leaves as beer. That is the only part of the toll nobody has costed.',
    },
  ],
  millharrow_tollman: [
    {
      who: 'TOLLMAN',
      text: 'There is a boy on the chalk road collecting a toll that is not ours. I am told to stand here and not to go and look.',
    },
  ],

  /* --- The Tallow Levels ------------------------------------------------------------- */
  tallow_cobbler: [
    {
      who: 'COBBLER',
      text: 'Tanner cures it, I cut it, and the Levels wear it out inside a year. Wet ground eats boots.',
    },
  ],

  /* --- Saltglass --------------------------------------------------------------------- */
  saltglass_chartmaker: [
    {
      who: 'CHART-MAKER',
      text: 'I have every reach and every bar off this coast drawn true, and a writ says none of it may be used.',
    },
  ],
  saltglass_glassblower: [
    {
      who: 'GLASSBLOWER',
      text: 'The furnace has not been let out in thirty years. Let it out and it cracks; keep it in and it eats a cart of coal a week. The coal comes. The fish do not go.',
    },
    {
      who: 'GLASSBLOWER',
      text: 'Pyre, if you want it. It is what the furnace makes when it is not making glass. The Cinderworks sells it cheaper; the Cinderworks is four days from here.',
    },
  ],
  brays_herdsman: [
    {
      who: 'HERDSMAN',
      text: 'Sixty head, eleven goat, one barn, one warrant. They came for the beasts and found me in the door, and went away to get a bigger piece of paper.',
    },
    {
      who: 'HERDSMAN',
      text: 'The weaver will want to know the fleece count. I have it in my head and nowhere else, which is where the Magistracy cannot distrain it.',
    },
  ],
  saltglass_bard: [
    {
      who: 'A QUAY SINGER',
      text: 'I sing about the boats. There is more call for it now they do not go anywhere.',
    },
  ],

  /* --- Bray Hollow ------------------------------------------------------------------- */
  brays_weaver: [
    {
      who: 'WEAVER',
      text: 'Wool off the herd, and the herd is what the warrant came for. Take the beasts and you have taken this loom too.',
    },
  ],

  /* --- Fenwick Crossing -------------------------------------------------------------- */
  fenwick_tollkeeper: [
    {
      who: 'TOLL-KEEPER',
      text: 'Fenwick took the toll. The Magistracy took it off Fenwick. I take it off the carts, same as I did for him, and nobody has ever asked me which book I write it in.',
    },
    {
      who: 'TOLL-KEEPER',
      text: 'The night column is not mine. The men who fill it in wear masks and pay in advance, and the book does not ask them for a name any more than it asks you.',
    },
  ],
  fenwick_potboy: [
    {
      who: 'POT-BOY',
      text: 'I hear everything in this room and I am paid not to repeat it, and the board by the hearth is where I put what I am not repeating.',
    },
    {
      who: 'POT-BOY',
      text: 'The barking under the floor started in the spring. The brewer says it is the river. The river does not bark.',
    },
  ],
  fenwick_carpenter: [
    {
      who: 'CARPENTER',
      text: 'Fenwick took the toll and the bridge, and left the upkeep. I have re-decked that span twice on my own account.',
    },
  ],
};

/**
 * The bottom panel, and the state machine that fills it one character at a time.
 *
 * Owns its own DOM so the screen can hand it a root and forget about it. `open` is what
 * the screen checks to know whether the advance key belongs to the box or to the world.
 */
export class DialogueBox {
  private readonly el: HTMLDivElement;
  private readonly whoEl: HTMLDivElement;
  private readonly lineEl: HTMLDivElement;
  private readonly nextEl: HTMLDivElement;

  private lines: DialogueLine[] = [];
  private onEnd: (() => void) | undefined;
  private index = 0;
  private shown = 0;
  private complete = false;
  private active = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'district-panel district-dialogue';
    this.el.innerHTML =
      '<div class="district-dialogue__who"></div>' +
      '<div class="district-dialogue__line"></div>' +
      '<div class="district-dialogue__next">[SPACE] &#9662;</div>';
    parent.appendChild(this.el);
    this.whoEl = this.el.querySelector('.district-dialogue__who')!;
    this.lineEl = this.el.querySelector('.district-dialogue__line')!;
    this.nextEl = this.el.querySelector('.district-dialogue__next')!;
  }

  get open(): boolean {
    return this.active;
  }

  start(lines: DialogueLine[], onEnd?: () => void): void {
    if (this.active || lines.length === 0) return;
    this.lines = lines;
    this.onEnd = onEnd;
    this.index = 0;
    this.active = true;
    this.el.classList.add('is-open');
    document.body.classList.add('is-talking');
    this.renderLine();
  }

  /**
   * One press completes the line; the next moves on.
   *
   * Two presses rather than one because a player who reads faster than the typewriter
   * should not have to choose between skipping the line and waiting for it.
   */
  advance(): void {
    if (!this.active) return;
    const line = this.lines[this.index]!;
    if (!this.complete) {
      this.shown = line.text.length;
      this.lineEl.textContent = line.text;
      this.complete = true;
      this.nextEl.classList.add('is-shown');
      return;
    }
    this.index++;
    if (this.index < this.lines.length) {
      this.renderLine();
      return;
    }
    const done = this.onEnd;
    this.close();
    done?.();
  }

  update(dt: number): void {
    if (!this.active || this.complete) return;
    const full = this.lines[this.index]!.text;
    this.shown = Math.min(full.length, this.shown + TYPE_SPEED * dt);
    this.lineEl.textContent = full.slice(0, Math.floor(this.shown));
    if (this.shown >= full.length) {
      this.complete = true;
      this.nextEl.classList.add('is-shown');
    }
  }

  close(): void {
    this.active = false;
    this.lines = [];
    this.onEnd = undefined;
    this.el.classList.remove('is-open');
    document.body.classList.remove('is-talking');
  }

  destroy(): void {
    this.close();
    this.el.remove();
  }

  private renderLine(): void {
    const line = this.lines[this.index]!;
    this.whoEl.textContent = line.who;
    this.lineEl.textContent = '';
    this.nextEl.classList.remove('is-shown');
    this.shown = 0;
    this.complete = false;
  }
}
