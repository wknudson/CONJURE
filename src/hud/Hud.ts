/**
 * The HUD: everything drawn as DOM rather than canvas, so text stays crisp at any scale
 * and hover/layout comes free from CSS.
 */

import type { CardInstanceId, Side } from '../contract/ids.js';
import type { Phase } from '../contract/events.js';
import type { BoardView, CommanderView } from '../contract/query.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import { CardView } from './CardView.js';
import { Tooltip } from './Tooltip.js';
import type { WeatherReading } from './weather.js';
import { schoolOf } from '../render/palette.js';
import { describeProjected, type ProjectedDamage } from './projection.js';

export interface HudCallbacks {
  onCardClick(cardId: CardInstanceId): void;
  onCardHover(cardId: CardInstanceId | null): void;
  onEndTurn(): void;
  onUndo(): void;
  onToggleMute(): boolean;
  onToggleThreat(): boolean;
  onChannel(): void;
  onHelp(): void;
  onRotate(steps: number): void;
  /** Returns the speed after the flip, so the button labels itself from the truth. */
  onToggleSpeed(): 'normal' | 'fast';
  onLastStand(active: boolean): void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Dwell for a notice with nothing behind it — matches the CSS fade exactly. */
const SOLO_NOTICE_MS = 2200;
/** Dwell when more notices are waiting, so a queue never feels sluggish. */
const QUEUED_NOTICE_MS = 900;

/**
 * How a body's attacks travel, in one word.
 *
 * Named rather than inferred from the numbers on the panel beside it. "RNG 2-4" and
 * "arcing" are different facts and a player reading the first has no way to reach the
 * second: a mortar that lobs over a wall and a marksman confined to a firing line can
 * print the identical range, and the difference decides where you stand.
 */
export function attackProfileOf(unit: {
  rangeMax: number;
  attackProfile?: string;
}): 'melee' | 'ranged' | 'arcing' | 'linear' {
  if (unit.attackProfile === 'arcing') return 'arcing';
  if (unit.attackProfile === 'lineOnly') return 'linear';
  return unit.rangeMax > 1 ? 'ranged' : 'melee';
}

const PROFILE_TIP: Record<ReturnType<typeof attackProfileOf>, string> = {
  melee: 'Melee|Strikes what it is standing beside, and nothing further.',
  ranged: 'Ranged|Free aim inside its reach, but it needs a clear line to what it shoots.',
  arcing: 'Arcing|Lobs over walls, bodies and its own front line — it needs no line of sight at all. It cannot depress its aim onto anything adjacent.',
  linear: 'Linear|Fires only down a straight rank, file or diagonal. Anything standing on the line stops the shot.',
};

export class Hud {
  private root: HTMLElement;
  private handEl!: HTMLElement;
  private pactFill!: HTMLElement;
  private pactText!: HTMLElement;
  private enemyBar!: HTMLElement;
  private enemyFill!: HTMLElement;
  private enemyText!: HTMLElement;
  private boneRing!: HTMLElement;
  private marrowRing!: HTMLElement;
  private turnLabel!: HTMLElement;
  private weatherEl!: HTMLElement;
  /** Last shown count, so a rise can be told from a redraw. -1 means hidden. */
  private subjugationHeld = -1;
  private subjugationEl!: HTMLElement;
  private subjugationPips!: HTMLElement;
  private phaseLabel!: HTMLElement;
  private noticeEl!: HTMLElement;
  private warningEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private heroArmorEl!: HTMLElement;
  private enemyArmorEl!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private resonanceEl!: HTMLElement;
  private threatBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private channelBtn!: HTMLButtonElement;
  private helpBtn!: HTMLButtonElement;
  private threatWarnEl!: HTMLElement;
  private declaredCastEl!: HTMLElement;
  private enemyHandEl!: HTMLElement;
  private enemyBonesEl!: HTMLElement;
  private inspectEl!: HTMLElement;
  private tooltip!: Tooltip;
  private noticeQueue: string[] = [];
  private showingNotice: string | null = null;
  private noticeTimer: number | null = null;
  private noticeShownAt = 0;
  private lastStand = false;

  private cards = new Map<CardInstanceId, CardView>();
  private playable = new Set<CardInstanceId>();
  private selected: CardInstanceId | null = null;

  constructor(
    parent: HTMLElement,
    private readonly cb: HudCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = TEMPLATE;
    parent.appendChild(this.root);
    this.bind();
  }

  private bind(): void {
    const q = <T extends HTMLElement>(sel: string): T => {
      const el = this.root.querySelector<T>(sel);
      if (!el) throw new Error(`HUD element missing: ${sel}`);
      return el;
    };

    this.handEl = q('.hand');
    this.pactFill = q('.pact__fill');
    this.pactText = q('.pact__text');
    this.enemyBar = q('.enemy-bar');
    this.enemyFill = q('.enemy-bar__fill');
    this.enemyText = q('.enemy-bar__text');
    this.boneRing = q('.dial__bones');
    this.marrowRing = q('.dial__marrow');
    this.turnLabel = q('.status__turn');
    this.weatherEl = q('.weather-badge');
    this.subjugationEl = q('.subjugation');
    this.subjugationPips = q('.subjugation__pips');
    this.phaseLabel = q('.status__phase');
    this.noticeEl = q('.notice');
    this.warningEl = q('.target-warning');
    this.bannerEl = q('.banner');
    this.endTurnBtn = q<HTMLButtonElement>('.end-turn');
    this.heroArmorEl = q('.pact__armor');
    this.enemyArmorEl = q('.enemy-bar__armor');
    this.muteBtn = q<HTMLButtonElement>('.mute');
    this.speedBtn = q<HTMLButtonElement>('.speed');
    this.resonanceEl = q('.resonance');
    this.threatBtn = q<HTMLButtonElement>('.threat-toggle');
    this.helpBtn = q<HTMLButtonElement>('.help');
    this.threatWarnEl = q('.status__threat-warning');
    this.declaredCastEl = q('.status__declared-cast');
    this.enemyHandEl = q('.enemy-read__hand');
    this.enemyBonesEl = q('.enemy-read__bones');
    this.inspectEl = q('.inspect');

    this.endTurnBtn.addEventListener('click', () => this.cb.onEndTurn());
    this.muteBtn.addEventListener('click', () => {
      const muted = this.cb.onToggleMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });
    this.undoBtn = q<HTMLButtonElement>('.undo');
    this.undoBtn.addEventListener('click', () => this.cb.onUndo());
    this.channelBtn = q<HTMLButtonElement>('.channel');
    this.channelBtn.addEventListener('click', () => this.cb.onChannel());
    this.threatBtn.addEventListener('click', () => this.setThreatActive(this.cb.onToggleThreat()));
    this.helpBtn.addEventListener('click', () => this.cb.onHelp());
    this.speedBtn.addEventListener('click', () => this.setSpeedLabel(this.cb.onToggleSpeed()));
    q('.rotate--ccw').addEventListener('click', () => this.cb.onRotate(-1));
    q('.rotate--cw').addEventListener('click', () => this.cb.onRotate(1));

    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(this.root);
  }

  /**
   * The sky, worn where the round counter is.
   *
   * Set once at mount: weather is fixed when combat begins and cannot change, so there
   * is nothing to keep in sync afterwards. A clear sky shows nothing rather than a badge
   * reading "Clear" — an indicator that is always present stops being read.
   */
  setWeather(reading: WeatherReading | undefined): void {
    this.weatherEl.classList.toggle('is-hidden', !reading);
    if (!reading) return;

    this.weatherEl.dataset.sky = reading.slug;
    this.weatherEl.innerHTML = `<span class="weather-badge__icon">${escapeHtml(reading.icon)}</span><span class="weather-badge__label">${escapeHtml(reading.label)}</span>`;
    this.weatherEl.setAttribute(
      'data-tip',
      `${reading.label}|${reading.effect}|Fixed for this battle — it was named on the briefing before you committed your deck.`,
    );
  }

  /**
   * The winch gauge. `null` hides it; a number shows that many rounds held.
   *
   * Bones rather than a bar: three is a small enough number that discrete notches read
   * faster than a fill, and each one landing is a beat the player is meant to feel. The
   * whole element pulses when the count rises, which is why the previous value is kept.
   */
  setSubjugation(held: number | null, of = 3): void {
    this.subjugationEl.classList.toggle('is-hidden', held === null);
    if (held === null) {
      this.subjugationHeld = -1;
      return;
    }

    const gained = held > this.subjugationHeld && this.subjugationHeld >= 0;
    this.subjugationHeld = held;

    this.subjugationPips.replaceChildren();
    for (let i = 0; i < of; i++) {
      const pip = document.createElement('span');
      pip.className = `subjugation__pip${i < held ? ' is-locked' : ''}`;
      this.subjugationPips.appendChild(pip);
    }
    this.subjugationEl.setAttribute(
      'data-tip',
      `Rite of Subjugation|The tether has held for ${held} of ${of} rounds.|Keep the anchor alive. If it falls the beast breaks free, one stack stronger.`,
    );

    if (gained) {
      this.subjugationEl.classList.remove('is-locking');
      void this.subjugationEl.offsetWidth; // restart the animation
      this.subjugationEl.classList.add('is-locking');
    }
  }

  /**
   * A standing warning about the target under the cursor.
   *
   * Deliberately not a `flashNotice`: those fade, and this one has to persist for exactly
   * as long as the cursor is over the thing it is warning about. It is the last thing
   * between the player and tethering their own Pact.
   */
  setTargetWarning(text: string | null): void {
    this.warningEl.classList.toggle('is-hidden', !text);
    if (text) this.warningEl.textContent = text;
  }

  setUndoAvailable(on: boolean): void {
    this.undoBtn.disabled = !on;
  }

  /**
   * Shows the Channel button only while it would do something.
   *
   * Hidden rather than disabled: Channel applies to whatever is selected, so a permanently
   * visible button would spend most of the game greyed out and reading as broken. The
   * hotkey still works regardless, and refuses with the engine's reason.
   */
  setChannelAvailable(on: boolean): void {
    this.channelBtn.classList.toggle('is-hidden', !on);
  }

  /**
   * Says what passing would cost, on the button itself.
   *
   * `warn` is the first press and the honest label; `armed` is the confirmation. Putting
   * the count on the button means the player does not have to audit the board to know
   * whether they are about to waste a turn.
   */
  setEndTurnWarning(
    state: 'none' | 'warn' | 'armed',
    potential: { readyUnits: number; playableCards: number },
  ): void {
    this.endTurnBtn.classList.toggle('is-warning', state === 'warn');
    this.endTurnBtn.classList.toggle('is-armed', state === 'armed');

    if (state === 'none') {
      this.endTurnBtn.textContent = 'End Turn';
      return;
    }
    if (state === 'armed') {
      this.endTurnBtn.textContent = 'End Turn anyway?';
      return;
    }

    const bits: string[] = [];
    if (potential.readyUnits > 0) bits.push(`${potential.readyUnits} unit${potential.readyUnits === 1 ? '' : 's'}`);
    if (potential.playableCards > 0) {
      bits.push(`${potential.playableCards} card${potential.playableCards === 1 ? '' : 's'}`);
    }
    this.endTurnBtn.textContent = `End Turn (${bits.join(', ')} left)`;
  }

  /**
   * Last Stand: the board desaturates and a heartbeat comes up under everything.
   *
   * Purely presentational — the rules have no such state. It exists because the moment
   * the Pact is two hits from breaking should feel different from the moment it is ten.
   */
  setLastStand(on: boolean): void {
    if (this.lastStand === on) return;
    this.lastStand = on;
    this.root.classList.toggle('is-last-stand', on);
    this.cb.onLastStand(on);
  }

  /**
   * Labels the speed button from whatever the screen says the speed now is.
   *
   * Told rather than asked: the button never holds the setting, so a click that the screen
   * refuses for any reason cannot leave the label claiming otherwise.
   */
  setSpeedLabel(speed: 'normal' | 'fast'): void {
    const label = this.speedBtn.querySelector('.speed__label');
    // Written to the label span rather than the button, or the gauge beside it would be
    // replaced by the text on the first click.
    if (label) label.textContent = speed === 'fast' ? 'Fast' : 'Normal';
    this.speedBtn.classList.toggle('is-fast', speed === 'fast');
  }

  setThreatActive(on: boolean): void {
    this.threatBtn.classList.toggle('is-active', on);
  }

  /**
   * What is actually coming, rather than what merely could.
   *
   * Once the enemy has committed, "7 damage incoming" beats "3 enemies can reach you" by
   * a wide margin — it is a number the player can plan against instead of worry about.
   */
  setIncoming(projected: ProjectedDamage, reachCount: number): void {
    if (projected.total > 0) {
      this.threatWarnEl.textContent = describeProjected(projected);
      this.threatWarnEl.classList.add('is-shown', 'is-declared');
      return;
    }
    if (reachCount > 0) {
      this.threatWarnEl.textContent =
        reachCount === 1 ? '1 enemy can reach your Pact' : `${reachCount} enemies can reach your Pact`;
      this.threatWarnEl.classList.add('is-shown');
      this.threatWarnEl.classList.remove('is-declared');
      return;
    }
    this.threatWarnEl.textContent = '';
    this.threatWarnEl.classList.remove('is-shown', 'is-declared');
  }

  /**
   * Declared casts the board cannot point at.
   *
   * A tiled declaration is drawn on its tile; a global one — a Cataclysmic Core — lands
   * everywhere, and "everywhere" has no diamond to mark. This line is where those go,
   * in both shells, so a declared card is never invisible whatever it is aimed at.
   */
  setDeclaredCasts(labels: string[]): void {
    if (labels.length === 0) {
      this.declaredCastEl.textContent = '';
      this.declaredCastEl.classList.remove('is-shown');
      return;
    }
    this.declaredCastEl.textContent = `Enemy casts: ${labels.join(' · ')}`;
    this.declaredCastEl.classList.add('is-shown');
  }

  get tips(): Tooltip {
    return this.tooltip;
  }

  destroy(): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
    this.tooltip.destroy();
    this.root.remove();
  }

  // ------------------------------------------------------------------ board sync

  /** Full refresh from the authoritative board — used on load and after each action. */
  syncFromBoard(board: BoardView, hand: CardSnapshot[], playable: CardInstanceId[]): void {
    // Maxima first. `setCommanderHp` prints the denominator, so setting it afterwards
    // left the opening render showing the default 40 — invisible for as long as every
    // Pact happened to be 40, and wrong the moment a levelled Companion raised one.
    // A rout has no enemy Commander, so it gets no Commander bar. Hidden rather than
    // zeroed: the readout divides by the maximum, and a fight with nothing behind the pack
    // would have printed a NaN-wide bar over "0 / 0". What the player should learn from the
    // top of the screen is that there is nothing up there to kill.
    this.enemyBar.classList.toggle('is-hidden', board.rout === true);

    this.setMaxHp(board.player, board.enemy);
    this.setCommanderHp('player', board.player.hp);
    this.setCommanderHp('enemy', board.enemy.hp);
    this.setCommanderArmor('player', board.player.armor);
    this.setCommanderArmor('enemy', board.enemy.armor);
    this.setResources('player', board.player.bones, board.player.marrow);
    this.setTurn(board.turn, board.activeSide);
    this.setPhase(board.phase, board.activeSide);
    this.syncHand(hand, playable);
    this.setResonance(board);
    this.setEnemyRead(board);
  }

  /**
   * What the enemy is holding.
   *
   * Not their cards — only how many and how much magic is banked. That is enough to make
   * a Power Tier turn foreseeable rather than a surprise, without giving the game away.
   */
  private setEnemyRead(board: BoardView): void {
    this.enemyHandEl.textContent = String(board.enemy.handCount);
    this.enemyBonesEl.textContent = String(board.enemy.bones);
    // Flagged once the bank could pay for the most expensive thing in the game.
    this.enemyBonesEl.parentElement?.classList.toggle('is-loaded', board.enemy.bones >= 5);
  }

  /**
   * The selected unit, spelled out in one place.
   *
   * Everything here is discoverable by hovering the piece, but a tactics player needs it
   * *while* choosing a destination, not while pointing at the unit they already chose.
   */
  showInspect(board: BoardView, unitId: string | null): void {
    if (!unitId) {
      this.inspectEl.classList.remove('is-shown');
      return;
    }
    const unit = board.units.find((u) => u.id === unitId);
    if (!unit) {
      this.inspectEl.classList.remove('is-shown');
      return;
    }

    const statuses = board.statuses
      .filter((s) => s.unitId === unitId)
      .map((s) => `<span class="inspect__status" data-tip="${s.kind}">${s.kind} ${s.stacks}</span>`)
      .join('');

    const actions: string[] = [];
    if (!unit.exhausted) actions.push('can act');
    if (unit.escalation > 0) actions.push(`escalated ×${unit.escalation}`);

    this.inspectEl.innerHTML = `
      <div class="inspect__name">${escapeHtml(unit.name)}</div>
      <div class="inspect__stats">
        <span data-tip="Attack|Damage this unit deals when it strikes.">${unit.atk} ATK</span>
        <span data-tip="Health|Damage it can take before dying.">${unit.hp}/${unit.maxHp} HP</span>
        <span data-tip="Movement|Tiles it can cross in one move, diagonals included.">${unit.mov} MOV</span>
        ${unit.armor > 0 ? `<span data-tip="armor">${unit.armor} ARM</span>` : ''}
        <span data-tip="Range|How far it can strike. Melee must be adjacent.">${
          unit.rangeMax > 1 ? `RNG ${unit.rangeMin}–${unit.rangeMax}` : 'RNG 1'
        }</span>
        <span class="inspect__profile" data-tip="${PROFILE_TIP[attackProfileOf(unit)]}">${attackProfileOf(
          unit,
        ).toUpperCase()}</span>
      </div>
      ${
        unit.keywords.length
          ? `<div class="inspect__keywords">${unit.keywords
              .map((k) => `<span data-tip="${k}">${k}</span>`)
              .join('')}</div>`
          : ''
      }
      ${statuses ? `<div class="inspect__statuses">${statuses}</div>` : ''}
      ${actions.length ? `<div class="inspect__actions">${actions.join(' · ')}</div>` : ''}
    `;
    this.inspectEl.classList.add('is-shown');
  }

  /** Shows whether the Companion's passive is still available this turn. */
  private setResonance(board: BoardView): void {
    const name = board.player.resonanceName;
    if (!name) {
      this.resonanceEl.textContent = '';
      return;
    }
    const ready = !board.player.resonanceUsed;
    this.resonanceEl.textContent = ready
      ? `${name} ready — next Companion card fires it`
      : `${name} spent`;
    this.resonanceEl.classList.toggle('is-ready', ready);
  }

  private maxPlayerHp = 40;
  private maxEnemyHp = 40;

  private setMaxHp(player: CommanderView, enemy: CommanderView): void {
    this.maxPlayerHp = player.maxHp;
    this.maxEnemyHp = enemy.maxHp;
  }

  syncHand(hand: CardSnapshot[], playable: CardInstanceId[]): void {
    this.playable = new Set(playable);
    const seen = new Set<CardInstanceId>();

    for (const snapshot of hand) {
      seen.add(snapshot.instanceId);
      let card = this.cards.get(snapshot.instanceId);
      if (!card) {
        card = new CardView(snapshot, {
          onClick: (id) => this.cb.onCardClick(id),
          onHover: (id) => this.cb.onCardHover(id),
        });
        this.cards.set(snapshot.instanceId, card);
        this.handEl.appendChild(card.el);
      }
      card.setPlayable(this.playable.has(snapshot.instanceId));
      card.setSelected(this.selected === snapshot.instanceId);
    }

    for (const [id, card] of this.cards) {
      if (seen.has(id)) continue;
      card.el.remove();
      this.cards.delete(id);
    }
  }

  setSelectedCard(id: CardInstanceId | null): void {
    this.selected = id;
    for (const [cardId, card] of this.cards) card.setSelected(cardId === id);
  }

  // ------------------------------------------------------------------ handlers

  onCardDrawn(side: Side, card: CardSnapshot): void {
    if (side !== 'player') return;
    if (this.cards.has(card.instanceId)) return;
    const view = new CardView(card, {
      onClick: (id) => this.cb.onCardClick(id),
      onHover: (id) => this.cb.onCardHover(id),
    });
    this.cards.set(card.instanceId, view);
    this.handEl.appendChild(view.el);
    view.playDrawAnimation();
  }

  /**
   * Where a hand card currently sits on screen, for the flight a played card takes to its
   * target tile. Null for the enemy's hand — it has no visible cards to leave from — and
   * null once the card is removed, which is why the caller reads it *before* the removal.
   */
  cardRect(id: CardInstanceId): DOMRect | null {
    return this.cards.get(id)?.el.getBoundingClientRect() ?? null;
  }

  onCardRemoved(side: Side, id: CardInstanceId): void {
    if (side !== 'player') return;
    const card = this.cards.get(id);
    if (!card) return;
    this.cards.delete(id);
    card.playRemoveAnimation();
  }

  setCommanderHp(side: Side, hp: number): void {
    if (side === 'player') {
      const frac = Math.max(0, hp) / this.maxPlayerHp;
      this.pactFill.style.width = `${frac * 100}%`;
      this.pactText.textContent = `PACT  ${Math.max(0, hp)} / ${this.maxPlayerHp}`;
      this.pactFill.classList.toggle('is-critical', frac <= 0.25);
    } else {
      // Defended even though the bar is hidden in the only case that can produce it: a
      // zero maximum here writes `width: NaN%`, which no later correct value repairs.
      const frac = this.maxEnemyHp > 0 ? Math.max(0, hp) / this.maxEnemyHp : 0;
      this.enemyFill.style.width = `${frac * 100}%`;
      this.enemyText.textContent = `${Math.max(0, hp)} / ${this.maxEnemyHp}`;
      this.enemyFill.classList.toggle('is-critical', frac <= 0.25);
    }
  }

  setCommanderArmor(side: Side, armor: number): void {
    const el = side === 'player' ? this.heroArmorEl : this.enemyArmorEl;
    el.textContent = armor > 0 ? `🛡 ${armor}` : '';
    el.classList.toggle('is-hidden', armor <= 0);
  }

  pulsePact(side: Side): void {
    const el = side === 'player' ? this.pactFill.parentElement : this.enemyFill.parentElement;
    if (!el) return;
    el.classList.remove('is-hit');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-hit');
  }

  /**
   * The dual-ring dial: heavy sockets for banked Bones, ethereal beads for Marrow.
   *
   * Either ring may be passed `undefined` to leave it alone. Events that move only one
   * resource — a Bone refund, a shattered geode — know nothing reliable about the other,
   * and writing a stale value would make the untouched ring flicker to the wrong count.
   */
  setResources(side: Side, bones: number | undefined, marrow: number | undefined): void {
    if (side !== 'player') return;

    if (bones !== undefined) this.renderBones(bones);
    if (marrow !== undefined) this.renderMarrow(marrow);
  }

  private renderBones(bones: number): void {
    this.boneRing.replaceChildren();
    for (let i = 0; i < 8; i++) {
      const socket = document.createElement('span');
      socket.className = `socket${i < bones ? ' is-filled' : ''}`;
      this.boneRing.appendChild(socket);
    }
  }

  private renderMarrow(marrow: number): void {
    this.marrowRing.replaceChildren();
    for (let i = 0; i < marrow; i++) {
      const bead = document.createElement('span');
      bead.className = 'bead';
      bead.textContent = '✦';
      this.marrowRing.appendChild(bead);
    }
    this.marrowRing.classList.toggle('is-empty', marrow === 0);
  }

  setTurn(turn: number, side: Side): void {
    this.turnLabel.textContent = `Turn ${turn} · ${side === 'player' ? 'YOU' : 'ENEMY'}`;
    this.root.classList.toggle('is-enemy-turn', side === 'enemy');
  }

  setPhase(phase: Phase, side: Side): void {
    this.phaseLabel.textContent = phase === 'action' ? '' : phase;
    if (phase === 'action') {
      this.banner(side === 'player' ? 'YOUR TURN' : 'ENEMY TURN', side === 'player' ? 'you' : 'foe');
    }
  }

  setInteractive(on: boolean): void {
    this.root.classList.toggle('is-locked', !on);
    this.endTurnBtn.disabled = !on;
  }

  /**
   * Queues a notice rather than overwriting the current one.
   *
   * Refusal messages are how the game explains itself, and two arriving close together
   * used to mean the player only ever saw the second. Each now gets its own moment.
   */
  flashNotice(text: string): void {
    // Repeating the same message just restarts its timer — no point queueing duplicates.
    const last = this.noticeQueue[this.noticeQueue.length - 1];
    if (last === text || (this.noticeQueue.length === 0 && this.showingNotice === text)) {
      this.restartNoticeTimer();
      return;
    }

    this.noticeQueue.push(text);
    // Never let a backlog build up; the newest messages are the relevant ones.
    if (this.noticeQueue.length > 3) this.noticeQueue.splice(0, this.noticeQueue.length - 3);

    if (this.showingNotice === null) {
      this.advanceNotice();
      return;
    }

    // Something arrived while a notice was already up. Cut the current one short rather
    // than making the new message wait out a full dwell it was not scheduled behind.
    const elapsed = performance.now() - this.noticeShownAt;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    const wait = Math.max(0, QUEUED_NOTICE_MS - elapsed);
    this.noticeTimer = window.setTimeout(() => {
      this.noticeTimer = null;
      this.advanceNotice();
    }, wait);
  }

  private advanceNotice(): void {
    const next = this.noticeQueue.shift();
    if (next === undefined) {
      this.showingNotice = null;
      this.noticeEl.classList.remove('is-shown');
      return;
    }

    this.showingNotice = next;
    this.noticeShownAt = performance.now();
    this.noticeEl.textContent = next;
    this.noticeEl.classList.remove('is-shown');
    void this.noticeEl.offsetWidth;
    this.noticeEl.classList.add('is-shown');
    this.restartNoticeTimer();
  }

  private restartNoticeTimer(): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    // Shorter dwell when others are waiting, so a queue never feels sluggish. With an
    // empty queue this matches the CSS fade exactly, so nothing is cut off mid-animation.
    const dwell = this.noticeQueue.length > 0 ? QUEUED_NOTICE_MS : SOLO_NOTICE_MS;
    this.noticeTimer = window.setTimeout(() => {
      this.noticeTimer = null;
      this.advanceNotice();
    }, dwell);
  }

  banner(text: string, kind: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.className = `banner banner--${kind}`;
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('is-shown');
  }

  setSchoolAccent(school: string): void {
    this.root.style.setProperty('--accent', schoolOf(school as never).main);
  }
}

/**
 * The Hero, Companion and enemy Commander are drawn on the board itself, so the HUD
 * carries only what has no place in world space: health bars, resources, and the hand.
 */
const TEMPLATE = `
  <div class="banner"></div>

  <div class="top-bar">
    <div class="enemy-bar" data-tip="commander">
      <div class="enemy-bar__label">ENEMY COMMANDER</div>
      <div class="enemy-bar__track"><div class="enemy-bar__fill"></div></div>
      <div class="enemy-bar__row">
        <span class="enemy-bar__text">40 / 40</span>
        <span class="enemy-bar__armor is-hidden" data-tip="armor"></span>
      </div>
      <div class="enemy-read">
        <span class="enemy-read__item" data-tip="Enemy hand|How many cards the enemy is holding.|You cannot see what they are, but a full hand means options.">
          <span class="enemy-read__icon">🂠</span><span class="enemy-read__hand">0</span>
        </span>
        <span class="enemy-read__item" data-tip="Enemy Bones|Banked magic the enemy has available.|A high bank means a Power Tier card may be coming.">
          <span class="enemy-read__icon">◈</span><span class="enemy-read__bones">0</span>
        </span>
      </div>
    </div>
    <div class="status">
      <div class="status__turn">Turn 1 · YOU</div>
      <div class="weather-badge is-hidden"></div>
      <div class="subjugation is-hidden">
        <div class="subjugation__title">Rite of Subjugation</div>
        <div class="subjugation__pips"></div>
      </div>
      <div class="status__phase"></div>
      <div class="status__threat-warning"></div>
      <div class="status__declared-cast"></div>
    </div>
  </div>

  <div class="notice"></div>
  <div class="target-warning is-hidden"></div>
  <div class="inspect"></div>

  <div class="bottom-bar">
    <div class="hand-row">
      <div class="corner corner--left">
        <!--
          The Pact, in the corner rather than over the board.

          It used to sit in a 400px stack centred above the hand, which put it across the
          middle of the arena — the one strip of screen the board is guaranteed to occupy
          at every size from 4x4 to 12x12. Health and resources belong at the edges the eye
          returns to, not on the tiles it is reading.
        -->
        <div class="pact" data-tip="pact">
          <div class="pact__track">
            <div class="pact__fill"></div>
            <div class="pact__ticks"></div>
          </div>
          <div class="pact__row">
            <span class="pact__text">PACT  40 / 40</span>
            <span class="pact__armor is-hidden" data-tip="armor"></span>
          </div>
        </div>
        <div class="resonance" data-tip="resonance"></div>
      </div>

      <div class="left-controls">
        <button class="end-turn">End Turn</button>
        <button class="undo" data-tip="Undo move|Steps back to before your last move.|Movement only — attacks and card plays are final. Press Z.">↶ Undo</button>
        <button class="threat-toggle" data-tip="Danger zone|Highlights every tile the enemy could strike on their next turn.|Press T to toggle. Red tiles are reachable; deeper red means more attackers.">
          <span class="threat-toggle__dot"></span> Threat
        </button>
        <button class="channel is-hidden" data-tip="Channel|Gives up the selected unit's attack to make Bones instead.|A swing costs 1 Bone; sitting a body down makes one. Melee brace for a Bone, ranged sight for a card, elites focus for two. It keeps its move. Press C.">✦ Channel</button>
      </div>
      <div class="hand"></div>
      <div class="right-controls">
        <button class="speed" data-tip="Playback speed|Normal gives the enemy's turn room to be read: one action at a time, and the motion itself unhurried.|Fast lets it run at full speed. Press F.">
          <span class="speed__gauge"><i class="speed__needle"></i></span>
          <span class="speed__label">Normal</span>
        </button>
        <button class="rotate rotate--ccw" data-tip="Rotate left|Turns the view a quarter-turn anticlockwise.|Press Q.">⟲</button>
        <button class="rotate rotate--cw" data-tip="Rotate right|Turns the view a quarter-turn clockwise.|Press E.">⟳</button>
        <button class="help" data-tip="Help|Opens the rules reference.|Press H at any time.">?</button>
        <button class="mute" title="Toggle sound">🔊</button>
      </div>

      <!-- The resource dial, mirroring the Pact in the opposite corner. -->
      <div class="corner corner--right">
        <div class="dial">
          <div class="dial__bones" data-tip="bones"></div>
          <div class="dial__marrow is-empty" data-tip="marrow"></div>
        </div>
      </div>
    </div>
  </div>
`;
