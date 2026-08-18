/**
 * The Vivarium.
 *
 * Glass, condensation, and something breathing behind it. Where the Artificer trades in
 * cards and the Apothecary in bottles, this room trades in the body that fights beside
 * you — which is why it is the only bench whose purchases change the Pact gauge itself.
 *
 * Two jobs, and they are deliberately one screen: choosing who stands beside you, and
 * paying to make them stand longer. Splitting them would mean picking a Companion in one
 * room and discovering what it was worth in another.
 *
 * The screen decides nothing. `vivarium.ts` owns the price and the refusal; this shows
 * what it says, so a greyed button and a refused click can never disagree.
 */

import type { Screen } from './ScreenManager.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { CompanionProgress } from '../core/overworld/vivarium.js';
import type { CompanionDef } from '../core/data/companions.js';
import { BASE_PACT_HP, HP_PER_LEVEL, levelCost, levelRefusal } from '../core/overworld/vivarium.js';
import { COMPANIONS } from '../core/data/companions.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface VivariumOpts {
  global: GlobalGameState;
  /** Progression per Companion. Read live — levelling writes into it. */
  companions: () => Record<string, CompanionProgress>;
  activeCompanionId: () => string;
  /** Sets who stands beside the player, and resyncs the Pact's ceiling. */
  onSelect: (companionId: string) => void;
  /** Pays for a level. Returns whether it happened. */
  onLevel: (companionId: string) => boolean;
  onChange: () => void;
  onBack: () => void;
}

/** Every way the pen can say no, in the player's words rather than the code's. */
const REFUSAL_COPY: Record<string, string> = {
  none: '',
  'in-combat': 'Not while a contract is open',
  'unknown-companion': 'This one is not yours',
  'too-poor': 'Not enough to feed it',
};

export class VivariumScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;
  /** Who is being *looked at*, which is not always who is standing beside you. */
  private viewing: string;

  constructor(private readonly opts: VivariumOpts) {
    this.viewing = opts.activeCompanionId();
  }

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--vivarium';
    el.innerHTML = `
      <div class="vivarium__head brass-panel">
        <div>
          <div class="vivarium__title">The Vivarium</div>
          <div class="vivarium__sub">Glass, condensation, and something breathing behind it</div>
        </div>
        <div class="vivarium__purse">
          <span class="workbench__coin workbench__coin--gold">
            <span class="workbench__coin-label">Ducats</span>
            <span class="vivarium__ducats"></span>
          </span>
          <span class="workbench__coin workbench__coin--marrow">
            <span class="workbench__coin-label">Shards</span>
            <span class="vivarium__shards"></span>
          </span>
        </div>
        <button class="brass-btn vivarium__back">Back to Safehouse</button>
      </div>

      <div class="vivarium__body">
        <div class="vivarium__tanks"></div>
        <div class="vivarium__detail"></div>
      </div>
    `;

    el.querySelector('.vivarium__back')!.addEventListener('click', () => this.opts.onBack());

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.render();
  }

  private progressFor(id: string): CompanionProgress | undefined {
    return this.opts.companions()[id];
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    const { economy } = this.opts.global.overworld;

    el.querySelector('.vivarium__ducats')!.textContent = String(economy.ducats);
    el.querySelector('.vivarium__shards')!.textContent = String(economy.marrowShards);

    this.renderTanks();
    this.renderDetail();
  }

  // ------------------------------------------------------------------- tanks

  private renderTanks(): void {
    const host = this.el?.querySelector('.vivarium__tanks');
    if (!host) return;
    host.innerHTML = '';

    const active = this.opts.activeCompanionId();

    for (const companion of COMPANIONS) {
      const progress = this.progressFor(companion.id);
      // A Companion with no progression entry has never been unlocked. Nothing gates
      // that yet, so in practice this shows every one — but the filter is the seam the
      // gate will need, and leaving it out now would mean adding it in three places.
      if (!progress) continue;

      const tank = document.createElement('button');
      tank.className = 'tank brass-panel';
      tank.classList.toggle('is-active', companion.id === active);
      tank.classList.toggle('is-viewing', companion.id === this.viewing);
      tank.style.setProperty('--school', schoolOf(companion.school as never).main);
      tank.innerHTML = `
        <div class="tank__glass"><i class="tank__sigil"></i></div>
        <div class="tank__name">${companion.name}</div>
        <div class="tank__level">Level ${progress.level}</div>
        ${companion.id === active ? '<div class="tank__badge">Standing with you</div>' : ''}
      `;
      tank.addEventListener('click', () => {
        this.viewing = companion.id;
        this.render();
      });
      host.appendChild(tank);
    }
  }

  // ------------------------------------------------------------------ detail

  private renderDetail(): void {
    const host = this.el?.querySelector('.vivarium__detail');
    if (!host) return;

    const companion = COMPANIONS.find((c) => c.id === this.viewing);
    const progress = this.progressFor(this.viewing);
    if (!companion || !progress) {
      host.innerHTML = '<div class="brass-panel vivarium__empty">Nothing in this tank.</div>';
      return;
    }

    const active = this.opts.activeCompanionId() === companion.id;
    const cost = levelCost(progress);
    const refusal = levelRefusal(this.opts.global, progress);
    const colors = schoolOf(companion.school as never);

    host.innerHTML = `
      <div class="brass-panel vivarium__card" style="--school:${colors.main}">
        <div class="vivarium__name">${companion.name}</div>
        <div class="vivarium__role">${companion.title} · ${companion.school}</div>
        <div class="vivarium__blurb">${companion.blurb}</div>

        <div class="vivarium__stats">
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Level</span>
            <span class="vivarium__stat-value">${progress.level}</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Pact ceiling</span>
            <span class="vivarium__stat-value">${BASE_PACT_HP + progress.bonusMaxHp}</span>
            <span class="vivarium__stat-note">${
              progress.bonusMaxHp > 0 ? `${BASE_PACT_HP} + ${progress.bonusMaxHp}` : 'base'
            }</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Opening Armor</span>
            <span class="vivarium__stat-value">${progress.startingArmor}</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Bonus Pips</span>
            <span class="vivarium__stat-value">${progress.bonusPips}</span>
          </div>
        </div>

        <div class="vivarium__actions">
          <button class="brass-btn vivarium__pick" ${active ? 'disabled' : ''}>
            ${active ? 'Standing with you' : 'Take this one'}
          </button>
        </div>
      </div>

      <div class="brass-panel vivarium__feed">
        <div class="vivarium__feed-head">Feed</div>
        <div class="vivarium__feed-copy">
          Another level. ${HP_PER_LEVEL} more health on the Pact while it stands beside you.
        </div>
        <div class="vivarium__feed-cost">
          <span class="workbench__coin--gold">${cost.ducats} d</span>
          <span class="workbench__coin--marrow">${cost.marrowShards} shards</span>
        </div>
        <button class="brass-btn vivarium__level">Feed / Enhance</button>
        <div class="vivarium__refusal">${REFUSAL_COPY[refusal ?? 'none']}</div>
      </div>
    `;

    host.querySelector('.vivarium__pick')!.addEventListener('click', () => this.pick(companion));

    const feed = host.querySelector<HTMLButtonElement>('.vivarium__level')!;
    feed.disabled = refusal !== null;
    feed.addEventListener('click', () => this.feed(companion));
  }

  private pick(companion: CompanionDef): void {
    this.opts.onSelect(companion.id);
    this.opts.onChange();
    this.render();
  }

  private feed(companion: CompanionDef): void {
    // The pen decides, not the button state: a stale render must not be able to spend.
    if (!this.opts.onLevel(companion.id)) return;
    this.opts.onChange();
    this.render();
  }

  unmount(): void {
    this.tooltip?.destroy();
    this.tooltip = null;
    this.el?.remove();
    this.el = null;
  }
}
