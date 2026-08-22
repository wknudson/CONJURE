/**
 * Character creation, staged as a diorama.
 *
 * Two steps, and the reason they are steps rather than one long form is that they ask
 * different kinds of question. The first is about *you* and is entirely reversible — cycle
 * hair as long as you like, nothing is written. The second is the Vow, which is the one
 * choice on this screen the game will not let you take back, and it deserves its own beat
 * and its own camera move.
 *
 * The HD-2D framing is not decoration here. The player's sprite stands on the map from the
 * first frame and changes as they cycle presets, so "this is my character" is established
 * by watching a figure on a stage rather than by reading a preview panel. When the Vow
 * lands the camera pans and the beast drops in beside them — the same two bodies that will
 * be standing there in every fight afterwards.
 *
 * Nothing is persisted until `onCreate` fires. Backing out leaves the slot blank.
 */

import type { School } from '../contract/ids.js';
import type { Screen } from './ScreenManager.js';
import type { CharacterLook } from '../core/data/characterLook.js';
import {
  FACE_PRESETS,
  HAIR_PRESETS,
  NICKNAME_MAX,
  SKIN_TONES,
  clampPreset,
  defaultHairFor,
  defaultLook,
  hairIndexesFor,
  normalizeLook,
  starterSpecies,
} from '../core/data/characterLook.js';
import { companionById } from '../core/data/companions.js';
import {
  MINIONS_BY_SPECIES,
  SPELL_POOLS_BY_SPECIES,
  startingRosterFor,
} from '../core/data/pools.js';
import { GRIMOIRE_SIZE } from '../core/data/companions.js';
import { CARDS, STARTER_DECK } from '../core/data/cards/index.js';
import { fusedDeckSize } from '../core/data/deckRules.js';
import { Diorama, type DioramaActor } from '../render/Diorama.js';
import { SCHOOL_COLOR, drawCommander, drawCompanion } from '../render/sprites.js';

export interface CharacterCreationOpts {
  /** The look was confirmed. The only thing that writes a profile. */
  onCreate: (look: CharacterLook) => void;
  /** Backed out of step one. The slot stays blank. */
  onCancel: () => void;
}

/** What each discipline is *for*, in one line. The only authored copy on this screen. */
const DISCIPLINE: Record<string, string> = {
  pyre: 'Burn it down and burn it again. Fire that lands on something already alight is worth twice what it cost.',
  frost: 'Hold the board still. Three stacks of Chill is a body that cannot answer, and a frozen body breaks.',
  surge: 'Charge and discharge. Nothing here kills on its own; everything sets up the thing that does.',
  bulwark: 'Take the ground and keep it. Plate that grows, and a shove for whoever is standing where you want to be.',
  dusk: 'Spend what you have for what you need. Your own bodies are the resource, and the Pact drinks what they leave.',
  bloom: 'Poison and patience. Every stack is a number waiting for a fire to multiply it.',
};

/** Where the Commander stands, and where the beast lands beside them. */
export const HERO_AT = { x: -0.6, y: 0.4 };
export const BEAST_AT = { x: 1.4, y: 0.9 };

/**
 * The two camera framings.
 *
 * Step I is a **close** shot and that is the point of it: this is the step about who the
 * Commander is, and at the old distance the figure stood 89 pixels tall against a 48-pixel
 * art grid — under 2x, at which a one-pixel eyebrow is two screen pixels and a catchlight is
 * a smudge. Every mark on the sprite exists to be read here. Dollying in to `y = 2.2` puts
 * the figure at ~128px, a 2.7x blit, where a cuff and a boot sole are three pixels each.
 *
 * `x` shifts right of the Commander so they sit left of centre, clear of the panel.
 *
 * Step II pulls back out: the Vow is about the pair of them and the ground they stand on,
 * and it needs room for a beast to land beside a person.
 */
/**
 * `x` shifts right of the Commander so they sit left of centre, clear of the panel — but the
 * screen offset that produces is `(HERO_AT.x - cam.x) * zoom`, and `zoom` now multiplies it.
 * At `zoom: 1` this gap was tuned to `-0.5` tiles; left alone at `zoom: 1.8` it would render
 * `1.8x` wider and push the figure noticeably further left than intended. Held here at
 * `HERO_AT.x + 0.5 / zoom` so raising or lowering `zoom` changes size without re-drifting the
 * figure sideways — if `zoom` above changes, this constant needs recomputing to match.
 */
export const SHOT_IDENTITY = { x: -0.322, y: 0.4, zoom: 3 };
export const SHOT_VOW = { x: 0.5, y: -0.4, zoom: 1 };

export class CharacterCreationScreen implements Screen {
  private el: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private diorama: Diorama | null = null;
  private raf = 0;
  private onResize: (() => void) | null = null;

  private look: CharacterLook = defaultLook();
  private step: 1 | 2 = 1;

  /** Where the camera actually is, easing toward the current step's framing. */
  private cam = { ...SHOT_IDENTITY };
  /** 0 until the Vow is taken, then eases to 1 as the beast drops in. */
  private beastEntry = 0;
  /** Set once a discipline is picked, so the panel and the stage agree. */
  private vowed: string | null = null;

  private last = 0;

  constructor(private readonly opts: CharacterCreationOpts) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--creation';
    el.innerHTML = `
      <canvas class="creation__stage" aria-hidden="true"></canvas>
      <div class="creation__scrim" aria-hidden="true"></div>
      <div class="creation__ui">
        <header class="creation__head">
          <div class="creation__steps">
            <span class="creation__step is-on" data-step="1">I · The Applicant</span>
            <span class="creation__step" data-step="2">II · The Vow</span>
          </div>
          <h1 class="creation__title"></h1>
          <p class="creation__lede"></p>
        </header>
        <div class="creation__panel"></div>
      </div>
    `;

    root.appendChild(el);
    this.el = el;
    this.canvas = el.querySelector('.creation__stage');
    if (this.canvas) this.diorama = new Diorama(this.canvas);

    this.onResize = () => this.diorama?.resize();
    window.addEventListener('resize', this.onResize);

    this.renderStep();
    this.last = performance.now();
    this.frame(this.last);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.onResize = null;
    this.el?.remove();
    this.el = null;
    this.canvas = null;
    this.diorama = null;
  }

  // ------------------------------------------------------------------ the stage

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    // Clamped, so a backgrounded tab that resumes after a minute eases rather than snaps.
    const dt = Math.min(64, now - this.last);
    this.last = now;

    const shot = this.step === 1 ? SHOT_IDENTITY : SHOT_VOW;
    // Exponential ease, framerate-independent. The camera is always *arriving*, which is
    // what makes the step change read as a move rather than a cut.
    const k = 1 - Math.exp(-dt / 260);
    this.cam.x += (shot.x - this.cam.x) * k;
    this.cam.y += (shot.y - this.cam.y) * k;
    this.cam.zoom = (this.cam.zoom ?? 1) + ((shot.zoom ?? 1) - (this.cam.zoom ?? 1)) * k;

    if (this.vowed) this.beastEntry = Math.min(1, this.beastEntry + dt / 420);

    const actors: DioramaActor[] = [
      {
        x: HERO_AT.x,
        y: HERO_AT.y,
        height: 1.15,
        // The cloak takes the vowed school's colour, so the Vow visibly changes what the
        // Commander is wearing rather than only what is written down about them.
        draw: (ctx, scale) =>
          drawCommander(ctx, scale, this.look, this.vowed ? SCHOOL_COLOR[schoolOf(this.vowed)] : null),
      },
    ];
    if (this.vowed) {
      const school = companionById(this.vowed)?.grimoire.schools[0] ?? 'pyre';
      actors.push({
        x: BEAST_AT.x,
        y: BEAST_AT.y,
        height: 0.7,
        entry: ease(this.beastEntry),
        draw: (ctx, scale) => drawCompanion(ctx, scale, school),
      });
    }

    this.diorama?.render({
      camera: this.cam,
      actors,
      tint: this.vowed ? (SCHOOL_COLOR[schoolOf(this.vowed)] ?? null) : null,
    });
  };

  // ------------------------------------------------------------------ the panels

  private renderStep(): void {
    const el = this.el;
    if (!el) return;

    for (const chip of el.querySelectorAll('.creation__step')) {
      chip.classList.toggle('is-on', Number(chip.getAttribute('data-step')) === this.step);
    }

    const title = el.querySelector('.creation__title')!;
    const lede = el.querySelector('.creation__lede')!;
    const panel = el.querySelector('.creation__panel')!;
    panel.replaceChildren();

    if (this.step === 1) {
      title.textContent = 'Who is asking?';
      lede.textContent =
        'The Magistracy files a name and a likeness before it files anything else. None of this is worth anything yet, which is rather the point.';
      panel.appendChild(this.identityPanel());
    } else {
      title.textContent = 'The Vow';
      lede.textContent =
        'One bloodline, bound to you. It decides the spells you cast, the bodies your Vanguard may field, and half the deck you will shuffle. It cannot be changed.';
      panel.appendChild(this.vowPanel());
    }
  }

  /** Step one: a name, a silhouette, and two cyclers. */
  private identityPanel(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'creation__form';
    wrap.innerHTML = `
      <label class="creation__field">
        <span class="creation__label">Name on the commission</span>
        <input class="creation__input" type="text" maxlength="${NICKNAME_MAX}" spellcheck="false" />
      </label>
      <div class="creation__field">
        <span class="creation__label">Bearing</span>
        <div class="creation__toggle">
          <button type="button" class="creation__opt" data-gender="female">Female</button>
          <button type="button" class="creation__opt" data-gender="male">Male</button>
        </div>
      </div>
      <div class="creation__cyclers"></div>
      <div class="creation__actions">
        <button type="button" class="brass-btn creation__back">Back to the wall</button>
        <button type="button" class="brass-btn creation__next">Take the Vow</button>
      </div>
    `;

    const input = wrap.querySelector<HTMLInputElement>('.creation__input')!;
    input.value = this.look.nickname;
    input.addEventListener('input', () => {
      // Held raw while typing and normalised on commit, so the field does not fight the
      // player over a trailing space they are about to type a word after.
      this.look.nickname = input.value.slice(0, NICKNAME_MAX);
    });

    for (const btn of wrap.querySelectorAll<HTMLButtonElement>('[data-gender]')) {
      const g = btn.dataset.gender === 'male' ? 'male' : 'female';
      btn.classList.toggle('is-on', this.look.gender === g);
      btn.addEventListener('click', () => {
        if (this.look.gender === g) return;
        this.look.gender = g;
        // The hairstyles are offered per bearing, so switching gender lands on that
        // bearing's own default (crop for male, ponytail for female) rather than on
        // whatever raw index the previous bearing happened to be cycled to — carrying the
        // index across would either point at a style this bearing does not offer, or land
        // on some other style in the new list by coincidence of position.
        this.look.hairPreset = defaultHairFor(g);
        this.renderStep();
      });
    }

    const cyclers = wrap.querySelector('.creation__cyclers')!;
    const hairChoices = hairIndexesFor(this.look.gender);
    cyclers.appendChild(
      this.presetCycler('Hair', hairChoices, () => clampPreset(this.look.hairPreset, HAIR_PRESETS.length), (i) => {
        this.look.hairPreset = i;
        return HAIR_PRESETS[i]!.name;
      }),
    );
    cyclers.appendChild(
      this.cycler('Face', FACE_PRESETS.length, () => clampPreset(this.look.facePreset, FACE_PRESETS.length), (i) => {
        this.look.facePreset = i;
        return FACE_PRESETS[i]!.name;
      }),
    );
    // Its own control, because it is its own choice. Skin used to be read off the face
    // preset, so picking a weathered brow also picked a complexion and there was no way to
    // have one without the other.
    cyclers.appendChild(
      this.cycler('Skin', SKIN_TONES.length, () => clampPreset(this.look.skinPreset, SKIN_TONES.length), (i) => {
        this.look.skinPreset = i;
        return `${i + 1} of ${SKIN_TONES.length}`;
      }),
    );

    wrap.querySelector('.creation__back')!.addEventListener('click', () => this.opts.onCancel());
    wrap.querySelector('.creation__next')!.addEventListener('click', () => {
      this.look = normalizeLook(this.look);
      this.step = 2;
      this.renderStep();
    });

    return wrap;
  }

  /**
   * Like `cycler`, but for a control whose *offered* values are a subset of a shared
   * preset list — hair, filtered to the current bearing. `get`/`set` still deal in real
   * `HAIR_PRESETS` indices; only the stepping wraps through `indices` instead of `0..count`,
   * so ‹ › never lands on a style this bearing does not offer.
   */
  private presetCycler(
    label: string,
    indices: number[],
    get: () => number,
    set: (index: number) => string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'creation__cycler';
    row.innerHTML = `
      <span class="creation__label">${label}</span>
      <div class="creation__cycle">
        <button type="button" class="creation__arrow" data-step="-1" aria-label="Previous ${label}">‹</button>
        <span class="creation__value"></span>
        <button type="button" class="creation__arrow" data-step="1" aria-label="Next ${label}">›</button>
      </div>
    `;
    const value = row.querySelector('.creation__value')!;
    // Where the current value sits in the offered list. -1 (not found — a stale index from
    // before a gender switch) falls back to the first offered style rather than throwing.
    const posOf = (): number => Math.max(0, indices.indexOf(get()));
    value.textContent = set(indices[posOf()] ?? indices[0] ?? 0);

    for (const btn of row.querySelectorAll<HTMLButtonElement>('.creation__arrow')) {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.step);
        const next = (posOf() + delta + indices.length) % indices.length;
        value.textContent = set(indices[next]!);
      });
    }
    return row;
  }

  /**
   * A labelled ‹ value › control.
   *
   * Modular in both directions, which matters more than it sounds: a player who overshoots
   * the hair they wanted should be able to go back one rather than around five.
   */
  private cycler(
    label: string,
    count: number,
    get: () => number,
    set: (index: number) => string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'creation__cycler';
    row.innerHTML = `
      <span class="creation__label">${label}</span>
      <div class="creation__cycle">
        <button type="button" class="creation__arrow" data-step="-1" aria-label="Previous ${label}">‹</button>
        <span class="creation__value"></span>
        <button type="button" class="creation__arrow" data-step="1" aria-label="Next ${label}">›</button>
      </div>
    `;
    const value = row.querySelector('.creation__value')!;
    value.textContent = set(get());

    for (const btn of row.querySelectorAll<HTMLButtonElement>('.creation__arrow')) {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.step);
        value.textContent = set((get() + delta + count) % count);
      });
    }
    return row;
  }

  /** Step two: the six bloodlines, and what each one actually hands over. */
  private vowPanel(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'creation__vow';

    const grid = document.createElement('div');
    grid.className = 'creation__grid';
    for (const baseId of starterSpecies()) grid.appendChild(this.vowCard(baseId));
    wrap.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'creation__actions';
    actions.innerHTML = `
      <button type="button" class="brass-btn creation__back">Back</button>
      <button type="button" class="brass-btn creation__sign" disabled>Sign the register</button>
    `;
    actions.querySelector('.creation__back')!.addEventListener('click', () => {
      this.step = 1;
      this.renderStep();
    });
    actions.querySelector('.creation__sign')!.addEventListener('click', () => {
      if (!this.vowed) return;
      this.opts.onCreate(normalizeLook({ ...this.look, starterCompanion: this.vowed }));
    });
    wrap.appendChild(actions);

    return wrap;
  }

  /**
   * One bloodline.
   *
   * Every number is read from the same place the profile will read it, so nobody is
   * promised eleven spells and handed nine. What is deliberately *not* shown is which eight
   * of the pool this beast will know — that is the roll, and spoiling it would make the
   * first tank in the Vivarium a formality.
   *
   * **"drawn from", not "of".** The eight is a count of *slots* and the pool is a count of
   * *distinct cards*, and the Tier limits mean a slot may repeat a card — so a pool of
   * seven fills eight slots perfectly well. Phrased as "8 of 7 spells" it read as a
   * miscount, which is exactly what it looked like on the Vow screen the moment Marks
   * stopped being pyre cards and Ignis's shelf went from eight distinct to seven.
   */
  private vowCard(baseId: string): HTMLElement {
    const species = companionById(baseId)!;
    const school = species.grimoire.schools[0]!;
    const spells = SPELL_POOLS_BY_SPECIES[baseId]?.length ?? 0;
    const bodies = MINIONS_BY_SPECIES[baseId]?.length ?? 0;
    const line = startingRosterFor(school);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vow-card brass-panel';
    card.dataset.species = baseId;
    card.innerHTML = `
      <span class="vow-card__crest" data-school="${school}"></span>
      <span class="vow-card__school">${school}</span>
      <span class="vow-card__name">${escapeHtml(species.name)}</span>
      <span class="vow-card__blurb">${escapeHtml(DISCIPLINE[school] ?? '')}</span>
      <span class="vow-card__facts">
        <span>${GRIMOIRE_SIZE} drawn from ${spells}</span>
        <span>${bodies} ${bodies === 1 ? 'body' : 'bodies'}</span>
        <span>${fusedDeckSize(STARTER_DECK.length)}-card deck</span>
      </span>
      <span class="vow-card__line">${line.map((id) => escapeHtml(CARDS[id]?.name ?? id)).join(' · ')}</span>
    `;
    card.addEventListener('click', () => this.vow(baseId));
    return card;
  }

  /**
   * Takes the Vow, on the stage rather than in the save.
   *
   * Picking a bloodline drops the beast in and pans the camera; it does **not** create the
   * character. Signing the register does. Separating them is what lets a player try all six
   * and watch each one arrive before committing to any.
   */
  private vow(baseId: string): void {
    const changing = this.vowed !== baseId;
    this.vowed = baseId;
    // Re-dropped on a change of mind, so the arrival is a thing that happens each time
    // rather than only the first.
    if (changing) this.beastEntry = 0;

    for (const card of this.el?.querySelectorAll('.vow-card') ?? []) {
      card.classList.toggle('is-vowed', card.getAttribute('data-species') === baseId);
    }
    const sign = this.el?.querySelector<HTMLButtonElement>('.creation__sign');
    if (sign) {
      sign.disabled = false;
      sign.textContent = `Bind ${companionById(baseId)?.name ?? 'it'}`;
    }
  }
}

/** The school a founding bloodline speaks. */
function schoolOf(baseId: string): School | string {
  return companionById(baseId)?.grimoire.schools[0] ?? 'pyre';
}

/** Ease-out-back, so the beast overshoots slightly as it lands. */
function ease(t: number): number {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}