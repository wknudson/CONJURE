/**
 * Choose Your Discipline — the one decision a character is made of.
 *
 * It sits between the blank poster and the Safehouse, and it is the only screen in the
 * game whose answer cannot be changed afterwards: everything else a player picks is a
 * loadout, and this is who they are. So it is deliberately unhurried — six panels, each
 * saying what the school *does* and what it hands you, and a second click to commit.
 *
 * The screen knows nothing about profiles. It is handed the schools and hands back the
 * one that was chosen, which keeps character creation in `save.ts` where the rest of the
 * `SaveData` schema lives.
 */

import type { School } from '../contract/ids.js';
import type { Screen } from './ScreenManager.js';
import { CARDS } from '../core/data/cards/index.js';
import { companionById } from '../core/data/companions.js';
import {
  MINIONS_BY_SPECIES,
  PLAYABLE_SCHOOLS,
  SPELL_POOLS_BY_SPECIES,
  speciesForSchool,
  startingRosterFor,
} from '../core/data/pools.js';
import { GRIMOIRE_SIZE } from '../core/data/companions.js';
import { STARTER_DECK } from '../core/data/cards/index.js';
import { fusedDeckSize } from '../core/data/deckRules.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface EnrolmentOpts {
  /** The discipline was chosen and confirmed. Nothing is written until this fires. */
  onEnrol: (school: School) => void;
  /** Backed out. The slot is left blank. */
  onCancel: () => void;
}

/**
 * What each discipline is *for*, in one line.
 *
 * Authored rather than derived, because "Frost holds the board still" is a claim about
 * how the school plays and no amount of reading its card list will produce that sentence.
 * The numbers beside it are all derived, so this is the only thing here that can go stale
 * — and it goes stale slowly, because a school's identity outlives its card list.
 */
const DISCIPLINE: Record<string, { title: string; blurb: string }> = {
  pyre: {
    title: 'Pyre',
    blurb: 'Burn it down and burn it again. Fire that lands on something already alight is worth twice what it cost.',
  },
  frost: {
    title: 'Frost',
    blurb: 'Hold the board still. Three stacks of Chill is a body that cannot answer, and a frozen body breaks.',
  },
  surge: {
    title: 'Surge',
    blurb: 'Charge and discharge. Nothing here kills on its own; everything sets up the thing that does.',
  },
  bulwark: {
    title: 'Bulwark',
    blurb: 'Take the ground and keep it. Plate that grows, and a shove for whoever is standing where you want to be.',
  },
  dusk: {
    title: 'Dusk',
    blurb: 'Spend what you have for what you need. Your own bodies are the resource, and the Pact drinks what they leave.',
  },
  bloom: {
    title: 'Bloom',
    blurb: 'Poison and patience. Every stack is a number waiting for a fire to multiply it.',
  },
};

export class EnrolmentScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;

  /** The panel awaiting its second click. Never more than one — see `choose`. */
  private confirming: School | null = null;

  constructor(private readonly opts: EnrolmentOpts) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--enrol';
    el.innerHTML = `
      <div class="enrol__head">
        <h1 class="enrol__title">Choose Your Discipline</h1>
        <p class="enrol__lede">
          The Magistracy files every commission under a school. Yours decides the beast that
          walks in beside you, the spells it knows, and the bodies your Vanguard may field.
          It cannot be changed once the ink is dry.
        </p>
        <button class="brass-btn enrol__back">Back to the wall</button>
      </div>
      <div class="enrol__grid"></div>
    `;

    el.querySelector('.enrol__back')!.addEventListener('click', () => this.opts.onCancel());

    const grid = el.querySelector('.enrol__grid')!;
    for (const school of PLAYABLE_SCHOOLS) grid.appendChild(this.panel(school));

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }

  /**
   * One school, and everything enrolling in it actually buys.
   *
   * Every number on the panel is read from the same place the profile will read it, so a
   * player cannot be promised eleven spells and handed nine. The one thing that is *not*
   * shown is which eight of the pool they will get — that is the roll, and telling them
   * in advance would make the Vivarium's first tank a formality.
   */
  private panel(school: School): HTMLElement {
    const baseId = speciesForSchool(school)!;
    const species = companionById(baseId)!;
    const copy = DISCIPLINE[school] ?? { title: school, blurb: '' };

    const spells = SPELL_POOLS_BY_SPECIES[baseId]?.length ?? 0;
    const bodies = MINIONS_BY_SPECIES[baseId] ?? [];
    const line = startingRosterFor(school);

    const panel = document.createElement('button');
    panel.type = 'button';
    panel.className = `enrol-card brass-panel enrol-card--${school}`;
    panel.dataset.school = school;
    panel.innerHTML = `
      <div class="enrol-card__crest" data-school="${school}"></div>
      <div class="enrol-card__name">${copy.title}</div>
      <div class="enrol-card__beast">${escapeHtml(species.name)}</div>
      <p class="enrol-card__blurb">${escapeHtml(copy.blurb)}</p>
      <dl class="enrol-card__facts">
        <div><dt>Grimoire</dt><dd>${GRIMOIRE_SIZE} drawn from ${spells}</dd></div>
        <div><dt>Vanguard</dt><dd>${bodies.length} ${bodies.length === 1 ? 'body' : 'bodies'}</dd></div>
        <div><dt>Opening deck</dt><dd>${fusedDeckSize(STARTER_DECK.length)} cards</dd></div>
      </dl>
      <div class="enrol-card__line">${line.map((id) => escapeHtml(CARDS[id]?.name ?? id)).join(' · ')}</div>
      <div class="enrol-card__stamp">Enrol</div>
    `;
    panel.setAttribute(
      'data-tip',
      `${copy.title}|Your ${species.name} drafts ${GRIMOIRE_SIZE} of the school's ${spells} spells when it is bound to you. Two characters of the same discipline are not the same character.`,
    );
    panel.addEventListener('click', () => this.choose(school, panel));
    return panel;
  }

  /**
   * First click arms, second commits.
   *
   * The same shape the revoke seal on the title wall uses, and for the same reason: this
   * is irreversible, and an irreversible thing should not happen under the thumb of
   * somebody reading. Arming a second panel disarms the first, so the screen never shows
   * two commitments at once.
   */
  private choose(school: School, panel: HTMLElement): void {
    if (this.confirming === school) {
      this.opts.onEnrol(school);
      return;
    }

    this.confirming = school;
    for (const other of this.el?.querySelectorAll('.enrol-card') ?? []) {
      other.classList.toggle('is-confirming', other === panel);
      const stamp = other.querySelector('.enrol-card__stamp');
      if (stamp) stamp.textContent = other === panel ? 'Sign the register' : 'Enrol';
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
