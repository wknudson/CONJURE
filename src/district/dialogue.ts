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

export const GATE_SEALED: DialogueLine[] = [
  {
    who: 'WARDED GATE',
    text: 'The Magistracy’s seal drinks the light off your hand and gives nothing back. Whatever is behind it is not yours today.',
  },
];

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
