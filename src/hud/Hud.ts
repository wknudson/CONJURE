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
import { schoolOf } from '../render/palette.js';

export interface HudCallbacks {
  onCardClick(cardId: CardInstanceId): void;
  onCardHover(cardId: CardInstanceId | null): void;
  onEndTurn(): void;
  onToggleMute(): boolean;
  onToggleThreat(): boolean;
  onHelp(): void;
}

/** Dwell for a notice with nothing behind it — matches the CSS fade exactly. */
const SOLO_NOTICE_MS = 2200;
/** Dwell when more notices are waiting, so a queue never feels sluggish. */
const QUEUED_NOTICE_MS = 900;

export class Hud {
  private root: HTMLElement;
  private handEl!: HTMLElement;
  private pactFill!: HTMLElement;
  private pactText!: HTMLElement;
  private enemyFill!: HTMLElement;
  private enemyText!: HTMLElement;
  private pipRing!: HTMLElement;
  private sparkRing!: HTMLElement;
  private turnLabel!: HTMLElement;
  private phaseLabel!: HTMLElement;
  private noticeEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private endTurnBtn!: HTMLButtonElement;
  private heroArmorEl!: HTMLElement;
  private enemyArmorEl!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private resonanceEl!: HTMLElement;
  private threatBtn!: HTMLButtonElement;
  private helpBtn!: HTMLButtonElement;
  private threatWarnEl!: HTMLElement;
  private tooltip!: Tooltip;
  private noticeQueue: string[] = [];
  private showingNotice: string | null = null;
  private noticeTimer: number | null = null;
  private noticeShownAt = 0;

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
    this.enemyFill = q('.enemy-bar__fill');
    this.enemyText = q('.enemy-bar__text');
    this.pipRing = q('.dial__pips');
    this.sparkRing = q('.dial__sparks');
    this.turnLabel = q('.status__turn');
    this.phaseLabel = q('.status__phase');
    this.noticeEl = q('.notice');
    this.bannerEl = q('.banner');
    this.endTurnBtn = q<HTMLButtonElement>('.end-turn');
    this.heroArmorEl = q('.pact__armor');
    this.enemyArmorEl = q('.enemy-bar__armor');
    this.muteBtn = q<HTMLButtonElement>('.mute');
    this.resonanceEl = q('.resonance');
    this.threatBtn = q<HTMLButtonElement>('.threat-toggle');
    this.helpBtn = q<HTMLButtonElement>('.help');
    this.threatWarnEl = q('.status__threat-warning');

    this.endTurnBtn.addEventListener('click', () => this.cb.onEndTurn());
    this.muteBtn.addEventListener('click', () => {
      const muted = this.cb.onToggleMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });
    this.threatBtn.addEventListener('click', () => this.setThreatActive(this.cb.onToggleThreat()));
    this.helpBtn.addEventListener('click', () => this.cb.onHelp());

    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(this.root);
  }

  setThreatActive(on: boolean): void {
    this.threatBtn.classList.toggle('is-active', on);
  }

  /** Warns when enemies are already in position to strike the Pact. */
  setCommanderThreat(count: number): void {
    if (count <= 0) {
      this.threatWarnEl.textContent = '';
      this.threatWarnEl.classList.remove('is-shown');
      return;
    }
    this.threatWarnEl.textContent =
      count === 1 ? '1 enemy can reach your Pact' : `${count} enemies can reach your Pact`;
    this.threatWarnEl.classList.add('is-shown');
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
    this.setCommanderHp('player', board.player.hp);
    this.setCommanderHp('enemy', board.enemy.hp);
    this.setCommanderArmor('player', board.player.armor);
    this.setCommanderArmor('enemy', board.enemy.armor);
    this.setResources('player', board.player.pips, board.player.sparks);
    this.setTurn(board.turn, board.activeSide);
    this.setPhase(board.phase, board.activeSide);
    this.setMaxHp(board.player, board.enemy);
    this.syncHand(hand, playable);
    this.setResonance(board);
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
      const frac = Math.max(0, hp) / this.maxEnemyHp;
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
   * The dual-ring dial: heavy sockets for banked Pips, ethereal beads for Sparks.
   * Passing `undefined` for sparks leaves that ring untouched.
   */
  setResources(side: Side, pips: number, sparks: number | undefined): void {
    if (side !== 'player') return;

    this.pipRing.replaceChildren();
    for (let i = 0; i < 8; i++) {
      const socket = document.createElement('span');
      socket.className = `socket${i < pips ? ' is-filled' : ''}`;
      this.pipRing.appendChild(socket);
    }

    if (sparks !== undefined) {
      this.sparkRing.replaceChildren();
      for (let i = 0; i < sparks; i++) {
        const bead = document.createElement('span');
        bead.className = 'bead';
        bead.textContent = '✦';
        this.sparkRing.appendChild(bead);
      }
      this.sparkRing.classList.toggle('is-empty', sparks === 0);
    }
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

  /** The enemy Commander is drawn on the board; the HUD only tints its health bar. */
  setEnemyTargetable(on: boolean): void {
    this.enemyFill.parentElement?.classList.toggle('is-targetable', on);
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
    </div>
    <div class="status">
      <div class="status__turn">Turn 1 · YOU</div>
      <div class="status__phase"></div>
      <div class="status__threat-warning"></div>
    </div>
  </div>

  <div class="notice"></div>

  <div class="bottom-bar">
    <div class="center-stack">
      <div class="pact" data-tip="pact">
        <div class="pact__track"><div class="pact__fill"></div></div>
        <div class="pact__row">
          <span class="pact__text">PACT  40 / 40</span>
          <span class="pact__armor is-hidden" data-tip="armor"></span>
        </div>
      </div>
      <div class="dial">
        <div class="dial__pips" data-tip="pips"></div>
        <div class="dial__sparks is-empty" data-tip="sparks"></div>
      </div>
      <div class="resonance" data-tip="resonance"></div>
    </div>

    <div class="hand-row">
      <div class="left-controls">
        <button class="end-turn">End Turn</button>
        <button class="threat-toggle" data-tip="Danger zone|Highlights every tile the enemy could strike on their next turn.|Press T to toggle. Red tiles are reachable; deeper red means more attackers.">
          <span class="threat-toggle__dot"></span> Threat
        </button>
      </div>
      <div class="hand"></div>
      <div class="right-controls">
        <button class="help" data-tip="Help|Opens the rules reference.|Press H at any time.">?</button>
        <button class="mute" title="Toggle sound">🔊</button>
      </div>
    </div>
  </div>
`;
