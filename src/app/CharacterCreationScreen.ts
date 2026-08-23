/**
 * Character creation, staged as a diorama.
 *
 * Two steps, and the reason they are steps rather than one long form is that they ask
 * different kinds of question. The first is about *you* and is entirely reversible — change
 * your name and bearing as often as you like, nothing is written. The second is the Vow,
 * which is the one choice on this screen the game will not let you take back, and it
 * deserves its own beat and its own camera move.
 *
 * The HD-2D framing is not decoration here. The player's sprite stands on the map from the
 * first frame — centred, and close enough to read — so "this is my character" is established
 * by watching a figure on a stage rather than by reading a preview panel. There is still no
 * preview box on this screen and there should not be one. When the Vow lands the camera pans
 * out and the beast drops in beside them — the same two bodies that will be standing there
 * in every fight afterwards.
 *
 * Nothing is persisted until `onCreate` fires. Backing out leaves the slot blank.
 */

import type { School } from '../contract/ids.js';
import type { Screen } from './ScreenManager.js';
import type { CharacterLook } from '../core/data/characterLook.js';
import { NICKNAME_MAX, defaultLook, normalizeLook, starterSpecies } from '../core/data/characterLook.js';
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
import {
  COMMANDER_HEIGHT_TILES,
  COMPANION_HEIGHT_TILES,
  SCHOOL_COLOR,
  companionSpriteSrc,
  drawCommander,
  drawCompanionBitmap,
  loadCommanderSprite,
  loadCompanionSprite,
} from '../render/sprites.js';

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

/**
 * Where the Commander stands, and where the beast lands beside them.
 *
 * The beast was two full tiles to the Commander's right, which read fine while Step II was a
 * wide establishing shot and stopped working the moment it became a two-shot: at any real zoom
 * a two-tile gap throws them to opposite edges of the frame and the pair stops being a pair.
 * Pulled in to one tile, and slightly less far back, so they can both be large *and* both be on
 * screen. Still far enough apart that the widest beast art clears the Commander — see `SHOT_VOW`.
 */
export const HERO_AT = { x: -0.6, y: 0.4 };
export const BEAST_AT = { x: 1.0, y: 0.8 };

/**
 * The two camera framings.
 *
 * Step I looks **straight at** the Commander: the camera sits on the tile they stand on, so
 * `x` and `y` are simply `HERO_AT`. Two things fall out of that, and both replace tuning with
 * arithmetic:
 *
 *  - `dx = 0`, so the figure projects to exactly the centre of the frame at *any* zoom. The
 *    previous framing pushed them left of centre to clear a panel on the right, and paid for
 *    it with a constant (`HERO_AT.x + 0.5 / zoom`) that had to be recomputed by hand every
 *    time `zoom` moved, because zoom multiplies the offset. A centred subject cannot drift.
 *  - `ty - cam.y = 0`, so `dz` is exactly `EYE` and the projected scale is exactly `zoom`.
 *    One knob now sets how big the figure is *and* where its feet land, monotonically.
 *
 * With the feet at `0.83 - 0.33·zoom/9` and the figure `1.7·zoom/9` tall (see
 * `COMMANDER_HEIGHT_TILES`), `zoom: 3.2` puts the crown at `0.108` and the feet at `0.713` of
 * frame height — a figure filling three-fifths of the frame with sky above it and the lower
 * quarter left clear for the form. It is also the practical ceiling: the old `zoom: 1.8`
 * framing drew the figure 0.470 of the frame tall with its feet at 0.410, which put the top
 * of its head 44 pixels **above** the frame at 720p. The head was being cut off, and no test
 * asked whether it was in shot. One does now.
 *
 * Step II is a **two-shot**, not an establishing shot. It was `zoom: 1` looking from `y = -0.4`,
 * which drew the Commander 121px tall and the beast 73px on a 720p frame — the pair were
 * technically both on screen and neither was worth looking at, which is a strange way to stage
 * the one irreversible choice in the game. The camera now sits just behind and between them
 * (`y: 0.6`, roughly the midpoint of the two ground positions) at `zoom: 2.2`, which is about
 * two and a half times the size: 309px and 188px on the same frame.
 *
 * `x: 0.75` is not the midpoint. It is offset so the pair lands inside the **empty middle
 * column** of the vow layout — rail on the left, card on the right, nothing between them — and
 * that column, not the frame, is what bounds the zoom. Two things set the ceiling, and both were
 * checked rather than eyeballed: the Commander's crown has to stay below the header, and the
 * *widest* beast has to stay clear of the card. Voltara is 276x211, so at a shared height it is
 * nearly three times the width of Sylva — the framing has to survive the worst case, or one
 * bloodline in six is drawn half-behind a panel.
 */
export const SHOT_IDENTITY = { x: HERO_AT.x, y: HERO_AT.y, zoom: 3.2 };
export const SHOT_VOW = { x: 0.75, y: 0.6, zoom: 2.2 };

export class CharacterCreationScreen implements Screen {
  private el: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private diorama: Diorama | null = null;
  private raf = 0;
  private onResize: (() => void) | null = null;

  private look: CharacterLook = defaultLook();
  private step: 1 | 2 = 1;
  /** The bitmap for `look.gender`, once `loadCommanderSprite` resolves. Null while loading. */
  private heroImg: HTMLImageElement | null = null;
  /** The bitmap for whichever bloodline is currently vowed. Null until it resolves. */
  private companionImg: HTMLImageElement | null = null;

  /** Where the camera actually is, easing toward the current step's framing. */
  private cam = { ...SHOT_IDENTITY };
  /** 0 until the Vow is taken, then eases to 1 as the beast drops in. */
  private beastEntry = 0;
  /** Set once a discipline is picked, so the panel and the stage agree. */
  private vowed: string | null = null;

  private last = 0;

  constructor(private readonly opts: CharacterCreationOpts) {
    void this.loadHeroSprite(this.look.gender);
    // Warm every sprite this screen can possibly ask for, immediately.
    //
    // Both bearings, because the toggle should be a swap and not a load; and all six beasts,
    // because a rail click has to put one on the stage *now* — the pan and the drop are the
    // payoff for picking, and a beast that fades in two frames late lands after its own
    // arrival hop. Around 700KB total, fetched in parallel while the player is still typing
    // a name, and `loadCommanderSprite`/`loadCompanionSprite` both dedupe by cache so the
    // real requests later are free.
    for (const g of ['female', 'male'] as const) void loadCommanderSprite(g);
    for (const id of starterSpecies()) void loadCompanionSprite(id, 'front');
  }

  /**
   * Loads the bitmap for a bearing and swaps it in once ready.
   *
   * Fire-and-forget from the caller's side on purpose: `render()` already treats a null
   * `heroImg` as "nothing to draw this frame" (see `drawCommander`), so there is no loading
   * state to wire up beyond letting the figure pop in a frame or two after the screen opens.
   */
  private async loadHeroSprite(gender: CharacterLook['gender']): Promise<void> {
    const img = await loadCommanderSprite(gender);
    // Bail if the gender changed again while this load was in flight, so a slow first
    // load can never stomp a faster second one and leave the wrong bearing on screen.
    if (this.look.gender !== gender) return;
    this.heroImg = img;
  }

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
        // Read from the draw code rather than restated here: this number is what tells
        // `focusBand` where the head is, and a second copy of it is a second answer.
        height: COMMANDER_HEIGHT_TILES,
        // Bitmap, not procedural — school tint dropped along with the recolour logic it
        // used to drive, since there is no shape here left to tint.
        draw: (ctx, scale) => drawCommander(ctx, scale, this.heroImg),
      },
    ];
    if (this.vowed) {
      actors.push({
        x: BEAST_AT.x,
        y: BEAST_AT.y,
        height: COMPANION_HEIGHT_TILES,
        entry: ease(this.beastEntry),
        draw: (ctx, scale) => drawCompanionBitmap(ctx, scale, this.companionImg),
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
    // The two steps want opposite layouts — Step I docks a bar under a centred figure, Step
    // II opens a rail and a card around a pair of them — and which one is showing is a fact
    // about the step, so it is stated on the container rather than inferred in six rules.
    panel.classList.toggle('creation__panel--identity', this.step === 1);
    panel.classList.toggle('creation__panel--vow', this.step === 2);

    if (this.step === 1) {
      title.textContent = 'Who is asking?';
      lede.textContent =
        'The Magistracy files a name and a likeness before it files anything else. None of this is worth anything yet, which is rather the point.';
      panel.appendChild(this.identityPanel());
    } else {
      title.textContent = 'The Vow';
      // Deliberately one short line. The header sits directly above a pair of bodies that are
      // now 309px and 188px tall, and a three-line lede put prose across the Commander's head;
      // what it used to say about spells, bodies and the deck moved into the card below, which
      // has room for it and is where the player is looking anyway.
      lede.textContent = 'One bloodline, bound to you. It cannot be changed.';
      panel.appendChild(this.vowPanel());
    }
  }

  /**
   * Step one: a name and a bearing. The figure itself is the bitmap; nothing here shapes it.
   *
   * Laid out as one horizontal bar docked under the figure's feet rather than the column that
   * used to sit in the bottom-right corner. The corner existed because the Commander stood
   * left of centre; now that they stand *in* the centre, a panel on one side would put the
   * composition back off-balance for no reason. Three fields' worth of form is short enough
   * to be a bar, and a bar leaves the whole upper frame to the subject.
   */
  private identityPanel(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'creation__form creation__form--bar';
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
        // Deliberately *not* cleared to null first. Both bearings are preloaded in the
        // constructor, so the swap resolves on a microtask and the old figure is replaced
        // before the next frame draws — whereas nulling it opened a guaranteed hole in the
        // middle of the stage, and a figure that vanishes reads as a bug where a figure that
        // changes reads as the toggle working. The stale-load guard below is what makes
        // holding the old bitmap safe.
        void this.loadHeroSprite(g);
        for (const other of wrap.querySelectorAll('[data-gender]')) {
          other.classList.toggle('is-on', other === btn);
        }
      });
    }

    wrap.querySelector('.creation__back')!.addEventListener('click', () => this.opts.onCancel());
    wrap.querySelector('.creation__next')!.addEventListener('click', () => {
      this.look = normalizeLook(this.look);
      this.step = 2;
      this.renderStep();
    });

    return wrap;
  }

  /**
   * Step two: the six bloodlines, and what each one actually hands over.
   *
   * A rail of six plus one large card, rather than the six equal cards this used to be. Those
   * cards each had to carry everything about a bloodline inside a 13rem column, so all six
   * were a wall of 0.66rem prose nobody reads, and the one thing that tells an Ember Drake
   * from a Vault Boar at a glance — the beast's own art — was a thumbnail with no styling
   * whatsoever, rendering at its intrinsic 169×274 and blowing the card apart.
   *
   * Splitting the question splits the layout: the rail answers "which six are there" with a
   * name and a face, and the card answers "what is this one" at a size where the answer can
   * actually be read. Both sit clear of the middle of the frame, because the middle is where
   * the pair of them stand and the camera pulled back specifically to show it.
   */
  private vowPanel(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'creation__vow';

    const rail = document.createElement('div');
    rail.className = 'vow-rail';
    // A group of toggles rather than a `tablist`: these are buttons that Tab reaches and
    // Enter activates, and claiming `role="tab"` would promise arrow-key navigation that
    // nothing here implements.
    rail.setAttribute('role', 'group');
    rail.setAttribute('aria-label', 'Bloodlines');
    for (const baseId of starterSpecies()) rail.appendChild(this.vowTab(baseId));
    wrap.appendChild(rail);

    const card = document.createElement('div');
    card.className = 'vow-featured';
    // The slot is what gets replaced on every pick; the actions are built once, outside it,
    // so choosing a fourth bloodline does not rebind the button that signs the register.
    card.innerHTML = `
      <div class="vow-featured__slot"></div>
      <div class="creation__actions">
        <button type="button" class="brass-btn creation__back">Back</button>
        <button type="button" class="brass-btn creation__sign" disabled>Sign the register</button>
      </div>
    `;
    card.querySelector('.creation__back')!.addEventListener('click', () => {
      this.step = 1;
      this.renderStep();
    });
    card.querySelector('.creation__sign')!.addEventListener('click', () => {
      if (!this.vowed) return;
      this.opts.onCreate(normalizeLook({ ...this.look, starterCompanion: this.vowed }));
    });
    wrap.appendChild(card);

    this.renderFeatured(card);
    return wrap;
  }

  /** One name and one face in the rail. Everything else about the bloodline is in the card. */
  private vowTab(baseId: string): HTMLElement {
    const species = companionById(baseId)!;
    const school = species.grimoire.schools[0]!;

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'vow-tab';
    tab.dataset.species = baseId;
    tab.dataset.school = school;
    tab.setAttribute('aria-pressed', String(this.vowed === baseId));
    tab.innerHTML = `
      <img class="vow-tab__thumb" src="${companionSpriteSrc(baseId)}" alt="" />
      <span class="vow-tab__text">
        <span class="vow-tab__name">${escapeHtml(species.name)}</span>
        <span class="vow-tab__school">${escapeHtml(school)}</span>
      </span>
    `;
    tab.addEventListener('click', () => this.vow(baseId));
    return tab;
  }

  /**
   * The bloodline currently under consideration, at length.
   *
   * Every number is read from the same place the profile will read it, so nobody is promised
   * eleven spells and handed nine. What is deliberately *not* shown is which eight of the
   * pool this beast will know — that is the roll, and spoiling it would make the first tank
   * in the Vivarium a formality.
   *
   * Two lines of copy rather than one, because they answer different questions and the old
   * card only had room to ask one of them: `blurb` is what this *beast* does — it is authored
   * on the `CompanionDef` and its own comment says "shown on the selection screen", which
   * until now it was not — and `DISCIPLINE` is what its *school* is for, which is the half
   * that outlives this one animal.
   */
  private renderFeatured(card: HTMLElement): void {
    const slot = card.querySelector<HTMLElement>('.vow-featured__slot')!;
    const baseId = this.vowed;

    if (!baseId) {
      card.classList.add('is-empty');
      delete card.dataset.school;
      slot.innerHTML = `
        <p class="vow-featured__prompt">Six bloodlines are holding a place open. Whichever you take decides the spells you cast, the bodies your Vanguard may field, and half the deck you will shuffle.</p>
        <p class="vow-featured__prompt">Pick one and it walks onto the stage beside you. Nothing is signed until you say so, so try all six.</p>
      `;
      return;
    }

    const species = companionById(baseId)!;
    const school = species.grimoire.schools[0]!;
    const spells = SPELL_POOLS_BY_SPECIES[baseId]?.length ?? 0;
    const bodies = MINIONS_BY_SPECIES[baseId]?.length ?? 0;
    const line = startingRosterFor(school);

    card.classList.remove('is-empty');
    card.dataset.school = school;
    slot.innerHTML = `
      <div class="vow-featured__portrait">
        <img class="vow-featured__art" src="${companionSpriteSrc(baseId)}"
             alt="${escapeHtml(species.name)}, the ${escapeHtml(species.title)}" />
      </div>
      <span class="vow-featured__school">${escapeHtml(school)}</span>
      <h2 class="vow-featured__name">${escapeHtml(species.name)}</h2>
      <span class="vow-featured__title">${escapeHtml(species.title)}</span>
      <p class="vow-featured__blurb">${escapeHtml(species.blurb)}</p>
      <p class="vow-featured__discipline">${escapeHtml(DISCIPLINE[school] ?? '')}</p>
      <div class="vow-featured__facts">
        <span><b>${GRIMOIRE_SIZE}</b> of ${spells} spells</span>
        <span><b>${bodies}</b> ${bodies === 1 ? 'body' : 'bodies'}</span>
        <span><b>${fusedDeckSize(STARTER_DECK.length)}</b>-card deck</span>
      </div>
      <p class="vow-featured__line">${line.map((id) => escapeHtml(CARDS[id]?.name ?? id)).join(' · ')}</p>
    `;
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
    if (changing) {
      // Cleared immediately so a slow first pick can't finish loading after a quicker
      // second pick and overwrite it with the wrong beast — same guard `loadHeroSprite`
      // uses for the gender toggle.
      this.companionImg = null;
      void this.loadCompanionArt(baseId);
    }

    for (const tab of this.el?.querySelectorAll<HTMLElement>('.vow-tab') ?? []) {
      const on = tab.dataset.species === baseId;
      tab.classList.toggle('is-vowed', on);
      tab.setAttribute('aria-pressed', String(on));
    }
    const card = this.el?.querySelector<HTMLElement>('.vow-featured');
    if (card) this.renderFeatured(card);

    const sign = this.el?.querySelector<HTMLButtonElement>('.creation__sign');
    if (sign) {
      sign.disabled = false;
      sign.textContent = `Bind ${companionById(baseId)?.name ?? 'it'}`;
    }
  }

  private async loadCompanionArt(baseId: string): Promise<void> {
    const img = await loadCompanionSprite(baseId, 'front');
    if (this.vowed !== baseId) return;
    this.companionImg = img;
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