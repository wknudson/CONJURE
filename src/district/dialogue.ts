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
