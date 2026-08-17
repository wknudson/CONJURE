/**
 * First-run coach marks.
 *
 * Deliberately short. Into the Breach's designers make the case that clarity beats
 * cleverness, and the corollary is that a tutorial nobody finishes teaches nothing —
 * so this covers only what a player cannot discover by clicking, and everything else
 * lives in the always-available help panel.
 *
 * Steps advance on click and can be skipped outright. It never runs twice.
 */

const SEEN_KEY = 'conjure.tutorial.seen';

export interface TutorialStep {
  /** CSS selector to point at, or null for a centred message. */
  anchor: string | null;
  title: string;
  body: string;
  /** Where the bubble sits relative to the anchor. */
  place?: 'above' | 'below' | 'right';
}

const STEPS: TutorialStep[] = [
  {
    anchor: null,
    title: 'You and the enemy Commander',
    body: 'You both stand beside the board, not on it. Reduce their health to zero to win — but they are trying to do the same to you. Everything on the grid is a means to that end.',
  },
  {
    anchor: '.dial__pips',
    title: 'Pips are your magic',
    body: 'You gain one at the start of every turn, and unspent Pips carry over. Cheap cards now, or bank them for something devastating later.',
    place: 'above',
  },
  {
    anchor: '.hand',
    title: 'Your hand',
    body: 'Each card says what it is — MINION puts a body on the board, SPELL resolves and is gone, RUNE waits for a trigger. Click one, then click a highlighted tile to play it.',
    place: 'above',
  },
  {
    anchor: 'canvas.board',
    title: 'The board is territory',
    body: 'The blue rows nearest you are yours — you summon there. The red rows are theirs. Melee units have to reach those red rows before they can strike the enemy Commander.',
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

export class Tutorial {
  private el: HTMLElement;
  private index = 0;
  private onDone: () => void;

  constructor(parent: HTMLElement, onDone: () => void) {
    this.onDone = onDone;
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

  static hasSeen(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  static markSeen(): void {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private browsing — the tutorial simply runs again next time */
    }
  }

  static reset(): void {
    try {
      localStorage.removeItem(SEEN_KEY);
    } catch {
      /* nothing to clear */
    }
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
    Tutorial.markSeen();
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    this.onDone();
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

    const target = step.anchor ? document.querySelector<HTMLElement>(step.anchor) : null;
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

  destroy(): void {
    this.el.remove();
  }
}
