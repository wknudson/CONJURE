/**
 * The wall.
 *
 * Three commissions pinned to wet brick under a gaslamp. A poster is a character: either
 * somebody is wanted, in which case the paper carries their name, their standing and what
 * they are currently worth, or the sheet is blank and waiting to be drafted.
 *
 * The screen reads only what a Profile keeps at its top level — name, level, purse — so
 * painting the wall never means deserialising three engine states. That is the entire
 * reason those fields are cached there.
 *
 * It owns no progression of its own. Which Companion, which deck, which contract are all
 * questions the Safehouse asks; this one asks only *who*.
 */

import type { Screen } from './ScreenManager.js';
import type { Profile, SaveFile, SlotId } from './save.js';
import { SLOT_IDS } from './save.js';
import { companionById } from '../core/data/companions.js';
import { AI_PROFILES } from '../core/ai/controller.js';
import { schoolOf } from '../render/palette.js';

export interface TitleOptions {
  save: SaveFile;
  /** One-off messages from loading the save (migration, corruption recovery). */
  notes: string[];
  /** Opens an existing character. */
  onLoad: (slot: SlotId) => void;
  /** Drafts a new one into an empty slot. */
  onDraft: (slot: SlotId) => void;
  onDifficulty: (name: string) => void;
}

/** What each tier actually does differently, in the player's terms. */
const DIFFICULTY_BLURB: Record<string, string> = {
  Novice: 'Takes the best move available right now. Misjudges the order of its own actions.',
  Adept: 'Thinks a step ahead, strikes before it withdraws, and shoves you into walls.',
};

/** Ducats read as money on a poster, so they wear a separator. */
function bounty(ducats: number): string {
  return `${ducats.toLocaleString('en-GB')} d`;
}

export class TitleScreen implements Screen {
  private el: HTMLElement | null = null;
  private drafting: SlotId | null = null;

  constructor(private readonly opts: TitleOptions) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--title';
    el.innerHTML = `
      <div class="title__mark">CONJURE</div>
      <div class="title__sub">Commissions of the Magistracy</div>

      <div class="brick-wall">
        <div class="brick-wall__lamp"></div>
        <div class="brick-wall__posters"></div>
      </div>

      <div class="title__section-label">Difficulty</div>
      <div class="difficulty"></div>

      <div class="title__hint">
        Pick a commission to carry on, or draft a new one. Work is posted on the Bounty
        Board inside the Safehouse. <kbd>T</kbd> shows the danger zone in a fight,
        <kbd>H</kbd> the rules.
      </div>
    `;

    this.el = el;
    root.appendChild(el);

    this.renderPosters();
    this.buildDifficulty(el);
    this.renderNotes(el);
  }

  // ------------------------------------------------------------- the posters

  private renderPosters(): void {
    const host = this.el?.querySelector('.brick-wall__posters');
    if (!host) return;
    host.innerHTML = '';

    for (const slot of SLOT_IDS) {
      const profile = this.opts.save.profiles[slot];
      host.appendChild(profile ? this.wantedPoster(slot, profile) : this.blankPoster(slot));
    }
  }

  /**
   * A commission with somebody on it.
   *
   * The charcoal portrait is a placeholder holding its own space: an empty framed element
   * tinted to the Companion's school, sized and positioned where the animated drawing
   * will go. Reserving the box now means dropping the real thing in later changes nothing
   * about the layout around it.
   */
  private wantedPoster(slot: SlotId, profile: Profile): HTMLElement {
    const companion = companionById(profile.activeCompanionId);
    const colors = schoolOf((companion?.school ?? 'neutral') as never);
    const { pact, economy } = profile.state.overworld;

    const poster = document.createElement('button');
    poster.className = 'wanted-poster wanted-poster--taken';
    poster.dataset.slot = slot;
    poster.style.setProperty('--school', colors.main);
    poster.innerHTML = `
      <i class="wanted-poster__pin"></i>
      <div class="wanted-poster__head">Wanted</div>
      <div class="wanted-poster__charcoal" data-companion="${profile.activeCompanionId}">
        <span class="wanted-poster__charcoal-note">charcoal, unfinished</span>
      </div>
      <div class="wanted-poster__name">${profile.name}</div>
      <div class="wanted-poster__rank">Level ${profile.level} · ${companion?.name ?? 'unaccompanied'}</div>
      <div class="wanted-poster__bounty">
        <span class="wanted-poster__bounty-label">Bounty</span>
        <span class="wanted-poster__bounty-value">${bounty(economy.ducats)}</span>
      </div>
      <div class="wanted-poster__vitals">
        Pact ${pact.currentHp}/${pact.maxHp} · ${profile.record.wins + profile.record.bound} taken
      </div>
      <div class="wanted-poster__stamp">Read it</div>
    `;
    poster.addEventListener('click', () => this.opts.onLoad(slot));
    return poster;
  }

  /** Blank paper, and an invitation to draw on it. */
  private blankPoster(slot: SlotId): HTMLElement {
    const poster = document.createElement('button');
    poster.className = 'wanted-poster wanted-poster--blank';
    poster.dataset.slot = slot;
    poster.innerHTML = `
      <i class="wanted-poster__pin"></i>
      <div class="wanted-poster__blank-mark"></div>
      <div class="wanted-poster__blank-copy">No commission drawn up.</div>
      <div class="wanted-poster__stamp">Draft New Commission</div>
    `;
    poster.addEventListener('click', () => this.draft(slot, poster));
    return poster;
  }

  /**
   * Drafting: the ink goes on before the screen changes.
   *
   * A beat of "Sketching new contract…" rather than an instant cut, because creating a
   * character is the one irreversible thing on this screen and it should feel like it
   * took a moment. The click is disarmed first — a second one during the beat would draft
   * two characters into one slot.
   */
  private draft(slot: SlotId, poster: HTMLElement): void {
    if (this.drafting) return;
    this.drafting = slot;

    poster.classList.add('is-sketching');
    poster.innerHTML = `
      <i class="wanted-poster__pin"></i>
      <div class="wanted-poster__sketch"></div>
      <div class="wanted-poster__blank-copy">Sketching new contract…</div>
    `;

    window.setTimeout(() => this.opts.onDraft(slot), 700);
  }

  // ------------------------------------------------------------- difficulty

  private buildDifficulty(el: HTMLElement): void {
    const list = el.querySelector('.difficulty')!;

    for (const profile of AI_PROFILES) {
      const btn = document.createElement('button');
      btn.className = 'difficulty__opt';
      btn.dataset.name = profile.name;
      btn.innerHTML = `
        <span class="difficulty__name">${profile.name}</span>
        <span class="difficulty__desc">${DIFFICULTY_BLURB[profile.name] ?? ''}</span>
      `;
      btn.addEventListener('click', () => this.selectDifficulty(profile.name));
      list.appendChild(btn);
    }

    this.selectDifficulty(this.opts.save.difficulty);
  }

  private selectDifficulty(name: string): void {
    this.opts.onDifficulty(name);
    const root = this.el ?? document;
    for (const el of root.querySelectorAll<HTMLElement>('.difficulty__opt')) {
      el.classList.toggle('is-selected', el.dataset.name === name);
    }
  }

  private renderNotes(el: HTMLElement): void {
    if (this.opts.notes.length === 0) return;
    const box = document.createElement('div');
    box.className = 'title__notes';
    box.innerHTML = this.opts.notes.map((n) => `<div>${n}</div>`).join('');
    el.appendChild(box);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
