import type { Screen } from './ScreenManager.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { ENCOUNTERS } from '../core/data/encounters/index.js';
import { COMPANIONS, DEFAULT_COMPANION } from '../core/data/companions.js';
import { schoolOf } from '../render/palette.js';
import type { SaveData } from './save.js';
import { validateDeck } from '../core/data/deckRules.js';
import { AI_PROFILES } from '../core/ai/controller.js';

export interface TitleOptions {
  save: SaveData;
  /** One-off messages from loading the save (migration, corruption recovery). */
  notes: string[];
  onStart: (encounter: EncounterDef, companionId: string, difficulty: string) => void;
  onEditDeck: (companionId: string) => void;
}

/** What each tier actually does differently, in the player's terms. */
const DIFFICULTY_BLURB: Record<string, string> = {
  Novice: 'Takes the best move available right now. Misjudges the order of its own actions.',
  Adept: 'Thinks a step ahead, strikes before it withdraws, and shoves you into walls.',
};

/**
 * Title and setup. Two choices before a run: who fights beside you, and what you fight.
 * The Companion is picked first because it decides half the deck.
 */
export class TitleScreen implements Screen {
  private el: HTMLElement | null = null;
  private companionId = DEFAULT_COMPANION.id;
  private difficulty: string;

  constructor(private readonly opts: TitleOptions) {
    this.companionId = opts.save.lastCompanionId || DEFAULT_COMPANION.id;
    this.difficulty = opts.save.difficulty;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--title';
    el.innerHTML = `
      <div class="title__mark">CONJURE</div>
      <div class="title__sub">Tactical grid card battler — combat demo</div>

      <div class="title__section-label">Choose your Companion</div>
      <div class="companions"></div>

      <div class="deck-summary"></div>

      <div class="title__section-label">Difficulty</div>
      <div class="difficulty"></div>

      <div class="title__section-label">Choose an encounter</div>
      <div class="encounters"></div>

      <div class="title__hint">
        Click a card to select it, then click a highlighted tile to play it.
        Click your own unit to move or attack. Each unit gets one move and one attack per
        turn, in either order. <kbd>T</kbd> shows the danger zone, <kbd>H</kbd> the rules.
      </div>
    `;

    // Assign before building: both the companion highlight and the deck summary look
    // themselves up through `this.el`, so they would silently no-op if it were still null.
    this.el = el;
    root.appendChild(el);

    this.buildCompanions(el);
    this.buildDifficulty(el);
    this.buildEncounters(el);
    this.renderNotes(el);
  }

  private buildCompanions(el: HTMLElement): void {
    const list = el.querySelector('.companions')!;

    for (const companion of COMPANIONS) {
      const colors = schoolOf(companion.school as never);
      const card = document.createElement('button');
      card.className = 'companion';
      card.dataset.id = companion.id;
      card.style.setProperty('--school', colors.main);
      card.innerHTML = `
        <div class="companion__sigil"></div>
        <div class="companion__name">${companion.name}</div>
        <div class="companion__title">${companion.title} · ${companion.school}</div>
        <div class="companion__blurb">${companion.blurb}</div>
      `;
      card.addEventListener('click', () => this.select(companion.id));
      list.appendChild(card);
    }

    this.select(this.companionId);
  }

  private select(id: string): void {
    this.companionId = id;
    const root = this.el ?? document;
    for (const el of root.querySelectorAll<HTMLElement>('.companion')) {
      el.classList.toggle('is-selected', el.dataset.id === id);
    }
    this.renderDeckSummary();
  }

  /** Shows the deck this companion will fight with, and why it might need editing. */
  private renderDeckSummary(): void {
    const host = this.el?.querySelector('.deck-summary');
    if (!host) return;

    const companion = COMPANIONS.find((c) => c.id === this.companionId);
    const saved = this.opts.save.decks[this.companionId];
    const cards = saved?.cards?.length ? saved.cards : (companion?.deck ?? []);
    const problems = validateDeck(cards, this.opts.save.collection);
    const broken = Boolean(saved?.invalid) || problems.length > 0;

    host.innerHTML = `
      <div class="deck-summary__line">
        <span class="deck-summary__count${broken ? ' is-bad' : ''}">${cards.length} cards</span>
        ${
          broken
            ? `<span class="deck-summary__warn">needs editing — ${problems[0]?.message ?? 'no longer legal'}</span>`
            : '<span class="deck-summary__ok">ready</span>'
        }
      </div>
      <button class="deck-summary__edit">Edit deck</button>
    `;
    host
      .querySelector('.deck-summary__edit')!
      .addEventListener('click', () => this.opts.onEditDeck(this.companionId));
  }

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

    this.selectDifficulty(this.difficulty);
  }

  private selectDifficulty(name: string): void {
    this.difficulty = name;
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

  private buildEncounters(el: HTMLElement): void {
    const list = el.querySelector('.encounters')!;

    for (const encounter of ENCOUNTERS) {
      const card = document.createElement('button');
      card.className = 'encounter';
      card.innerHTML = `
        <div class="encounter__name">${encounter.name}</div>
        <div class="encounter__blurb">${encounter.blurb}</div>
        <div class="encounter__meta">${encounter.width}×${encounter.height} arena · ${encounter.enemyHp} HP</div>
      `;
      card.addEventListener('click', () =>
        this.opts.onStart(encounter, this.companionId, this.difficulty),
      );
      list.appendChild(card);
    }
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
