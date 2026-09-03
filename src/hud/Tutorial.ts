/**
 * First-run coach marks.
 *
 * Deliberately short. Into the Breach's designers make the case that clarity beats
 * cleverness, and the corollary is that a tutorial nobody finishes teaches nothing —
 * so this covers only what a player cannot discover by clicking, and everything else
 * lives in the always-available help panel.
 *
 * Steps advance on click and can be skipped outright. Whether it has been seen is the
 * **profile's** business, not this file's: it used to keep a flag in `localStorage`, which
 * meant a second character on the same machine never saw it, a tester whose browser had
 * touched an earlier build never saw it, and a fight left mid-walkthrough marked it seen for
 * good. Now the caller says whether to run it and hears back when it has been finished or
 * skipped — and only then. A shell torn down mid-step says nothing, so the marks return
 * next fight.
 */

export interface TutorialStep {
  /** CSS selector to point at, or null for a centred message. */
  anchor: string | null;
  title: string;
  body: string;
  /** Where the bubble sits relative to the anchor. */
  place?: 'above' | 'below' | 'right';
}

/** The default anchor for the board step; the district's board is a different element. */
const BOARD_ANCHOR = 'canvas.board';

const STEPS: TutorialStep[] = [
  {
    anchor: null,
    title: 'You and the enemy Commander',
    body: 'You both stand beside the board, not on it, and neither of you can be struck. Reduce their health to zero to win — but they are trying to do the same to you. Everything on the grid is a means to that end.',
  },
  {
    anchor: '.dial__bones',
    title: 'Bones are your magic',
    body: 'You gain one at the start of every turn, and unspent Bones carry over. Cheap cards now, or bank them for something devastating later.',
    place: 'above',
  },
  {
    anchor: '.hand',
    title: 'Your hand',
    body: 'Each card says what it is — MINION puts a body on the board, SPELL resolves and is gone, MARK waits for a trigger. Click one, then click a highlighted tile to play it.',
    place: 'above',
  },
  {
    anchor: BOARD_ANCHOR,
    title: 'The board is territory',
    body: 'The blue rows nearest you are yours — you summon there. The red rows are theirs, and somewhere in them stands their Companion: the Commander’s body on the board, and the only thing whose wounds they feel.',
    place: 'right',
  },
  {
    anchor: '.threat-toggle',
    title: 'See what is coming',
    body: 'This marks every tile the enemy could hit next turn. It is on right now. Leave it on while you learn where it is safe to stand.',
    place: 'above',
  },
  {
    anchor: '.help',
    title: 'Everything else',
    body: 'Press H any time for the full rules, and hover anything on screen for an explanation. Good luck.',
    place: 'above',
  },
];

/**
 * What a fight shell is handed about the coach marks: whether this character has had them,
 * and whom to tell when they have. Both shells take one, so a first fight on the street
 * teaches the same as a first fight from the board.
 */
export interface CoachMarks {
  seen: boolean;
  onSeen: () => void;
}

export interface TutorialOptions {
  /** Called once, when the player finishes or skips. Never on `destroy`. */
  onDone: () => void;
  /** What to ring for the board step, where the board is not `canvas.board`. */
  boardAnchor?: string;
}

export class Tutorial {
  private el: HTMLElement;
  private index = 0;
  private done = false;
  private readonly opts: TutorialOptions;

  constructor(parent: HTMLElement, opts: TutorialOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    parent.appendChild(this.el);

    this.el.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.tutorial__skip')) {
        this.finish();
        return;
      }
      this.next();
    });
  }

  start(): void {
    this.index = 0;
    this.el.classList.add('is-open');
    this.render();
  }

  private next(): void {
    this.index++;
    if (this.index >= STEPS.length) {
      this.finish();
      return;
    }
    this.render();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    this.opts.onDone();
  }

  private render(): void {
    const step = STEPS[this.index];
    if (!step) return;

    const isLast = this.index === STEPS.length - 1;
    this.el.innerHTML = `
      <div class="tutorial__scrim"></div>
      <div class="tutorial__bubble">
        <div class="tutorial__step">${this.index + 1} of ${STEPS.length}</div>
        <h3>${step.title}</h3>
        <p>${step.body}</p>
        <div class="tutorial__actions">
          <button class="tutorial__skip">Skip</button>
          <button class="tutorial__next">${isLast ? 'Play' : 'Next'}</button>
        </div>
      </div>
      <div class="tutorial__ring"></div>`;

    this.position(step);
  }

  /** Places the bubble near its anchor, and rings the anchor so the eye finds it. */
  private position(step: TutorialStep): void {
    const bubble = this.el.querySelector<HTMLElement>('.tutorial__bubble');
    const ring = this.el.querySelector<HTMLElement>('.tutorial__ring');
    if (!bubble || !ring) return;

    const selector =
      step.anchor === BOARD_ANCHOR && this.opts.boardAnchor ? this.opts.boardAnchor : step.anchor;
    const target = selector ? document.querySelector<HTMLElement>(selector) : null;
    if (!target) {
      bubble.style.left = `${(window.innerWidth - bubble.offsetWidth) / 2}px`;
      bubble.style.top = `${(window.innerHeight - bubble.offsetHeight) / 2}px`;
      ring.style.display = 'none';
      return;
    }

    const r = target.getBoundingClientRect();
    ring.style.display = 'block';
    ring.style.left = `${r.left - 6}px`;
    ring.style.top = `${r.top - 6}px`;
    ring.style.width = `${r.width + 12}px`;
    ring.style.height = `${r.height + 12}px`;

    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const margin = 14;
    let left = r.left + r.width / 2 - bw / 2;
    let top: number;

    if (step.place === 'right') {
      left = r.right + margin;
      top = r.top + r.height / 2 - bh / 2;
    } else if (step.place === 'below') {
      top = r.bottom + margin;
    } else {
      top = r.top - bh - margin;
      if (top < margin) top = r.bottom + margin;
    }

    // Keep the bubble fully on screen regardless of anchor position.
    bubble.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - bw - margin))}px`;
    bubble.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - bh - margin))}px`;
  }

  /** Takes the marks down without a word. A fight left mid-step has not been taught. */
  destroy(): void {
    this.el.remove();
  }
}
