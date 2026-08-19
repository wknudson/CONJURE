/**
 * The Vivarium.
 *
 * Glass, condensation, and something breathing behind it. Every tank holds a *specific*
 * animal rather than a species — two Ignis are two beasts with different constitutions
 * and different knacks, which is the entire reason a taming roll is worth doing.
 *
 * Three jobs, deliberately one screen: choosing who stands beside you, paying to make
 * them stronger, and deciding which bad rolls to let go. Splitting them would mean
 * comparing two beasts in one room and releasing one in another.
 *
 * The screen decides nothing. `vivarium.ts` owns the price and the refusal, and the
 * caller owns who may be released; this shows what they say.
 */

import type { Screen } from './ScreenManager.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { CompanionInstance } from '../core/overworld/vivarium.js';
import { HP_ROLL_MAX, HP_ROLL_MIN, levelCost, levelRefusal } from '../core/overworld/vivarium.js';
import { COMPANIONS, companionById } from '../core/data/companions.js';
import { traitById } from '../core/data/companionTraits.js';
import { schoolOf } from '../render/palette.js';
import { Tooltip } from '../hud/Tooltip.js';

export interface VivariumOpts {
  global: GlobalGameState;
  /** Every beast this character has tamed. Read live — levelling writes into it. */
  roster: () => CompanionInstance[];
  activeInstanceId: () => string;
  /** Sets who stands beside the player, and resyncs the Pact's ceiling. */
  onSelect: (instanceId: string) => void;
  /** Pays for a level. Returns whether it happened. */
  onLevel: (instanceId: string) => boolean;
  /** Lets one go. Returns false when it is the last on the roster. */
  onRelease: (instanceId: string) => boolean;
  /** Dev affordance: rolls a wild one of the given bloodline onto the roster. */
  onTame: (baseId: string) => CompanionInstance;
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

/** Where a roll sits in its band, as a word. The reason to keep one or let it go. */
function verdict(roll: number): string {
  const span = HP_ROLL_MAX - HP_ROLL_MIN;
  const k = span > 0 ? (roll - HP_ROLL_MIN) / span : 1;
  if (k >= 0.999) return 'perfect';
  if (k >= 0.75) return 'strong';
  if (k >= 0.4) return 'fair';
  return 'runt';
}

export class VivariumScreen implements Screen {
  private el: HTMLElement | null = null;
  private tooltip: Tooltip | null = null;
  /** Who is being *looked at*, which is not always who is standing beside you. */
  private viewing: string;
  /** The instance whose release is awaiting a second click. */
  private confirming: string | null = null;

  constructor(private readonly opts: VivariumOpts) {
    this.viewing = opts.activeInstanceId();
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
        <div class="vivarium__dev"></div>
        <button class="brass-btn vivarium__back">Back to Safehouse</button>
      </div>

      <div class="vivarium__body">
        <div class="vivarium__tanks"></div>
        <div class="vivarium__detail"></div>
      </div>
    `;

    el.querySelector('.vivarium__back')!.addEventListener('click', () => this.opts.onBack());
    // Dev affordance: one button per bloodline, until the Overworld has somewhere to
    // actually find one. A single Ignis button could not roll the other four species, so
    // four of their variants were unreachable content the moment they were written.
    const dev = el.querySelector('.vivarium__dev')!;
    for (const species of COMPANIONS) {
      const button = document.createElement('button');
      button.className = 'brass-btn vivarium__tame';
      button.textContent = `Dev: ${species.name}`;
      button.addEventListener('click', () => {
        const beast = this.opts.onTame(species.id);
        // Look at what was just caught. A roll you have to go and find is a roll you did
        // not feel yourself make.
        this.viewing = beast.instanceId;
        this.confirming = null;
        this.opts.onChange();
        this.render();
      });
      dev.appendChild(button);
    }

    root.appendChild(el);
    this.el = el;
    this.tooltip = new Tooltip(document.body);
    this.tooltip.attach(el);
    this.render();
  }

  private beast(instanceId: string): CompanionInstance | undefined {
    return this.opts.roster().find((c) => c.instanceId === instanceId);
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

    const active = this.opts.activeInstanceId();

    for (const beast of this.opts.roster()) {
      const species = companionById(beast.baseId);
      const trait = traitById(beast.traitId);

      const tank = document.createElement('button');
      tank.className = `tank brass-panel tank--${verdict(beast.baseHpRoll)}`;
      tank.classList.toggle('is-active', beast.instanceId === active);
      tank.classList.toggle('is-viewing', beast.instanceId === this.viewing);
      tank.style.setProperty('--school', schoolOf((species?.school ?? 'neutral') as never).main);
      tank.innerHTML = `
        <div class="tank__glass"><i class="tank__sigil"></i></div>
        <div class="tank__name">${species?.name ?? beast.baseId}</div>
        <div class="tank__roll">
          <span class="tank__hp">${beast.baseHpRoll} HP</span>
          <span class="tank__verdict">${verdict(beast.baseHpRoll)}</span>
        </div>
        <div class="tank__level">Level ${beast.level}${trait ? ` · ${trait.name}` : ''}</div>
        ${beast.instanceId === active ? '<div class="tank__badge">Standing with you</div>' : ''}
      `;
      tank.addEventListener('click', () => {
        this.viewing = beast.instanceId;
        this.confirming = null;
        this.render();
      });
      host.appendChild(tank);
    }
  }

  // ------------------------------------------------------------------ detail

  private renderDetail(): void {
    const host = this.el?.querySelector('.vivarium__detail');
    if (!host) return;

    const beast = this.beast(this.viewing) ?? this.opts.roster()[0];
    if (!beast) {
      host.innerHTML = '<div class="brass-panel vivarium__empty">Every tank is empty.</div>';
      return;
    }
    this.viewing = beast.instanceId;

    const species = companionById(beast.baseId);
    const trait = traitById(beast.traitId);
    const active = this.opts.activeInstanceId() === beast.instanceId;
    const cost = levelCost(beast);
    const refusal = levelRefusal(this.opts.global, beast);
    const colors = schoolOf((species?.school ?? 'neutral') as never);
    const onlyOne = this.opts.roster().length <= 1;

    host.innerHTML = `
      <div class="brass-panel vivarium__card" style="--school:${colors.main}">
        <div class="vivarium__name">${species?.name ?? beast.baseId}</div>
        <div class="vivarium__role">${species?.title ?? ''} · ${species?.school ?? ''}</div>
        <div class="vivarium__blurb">${species?.blurb ?? ''}</div>

        <div class="vivarium__stats">
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Constitution</span>
            <span class="vivarium__stat-value">${beast.baseHpRoll}</span>
            <span class="vivarium__stat-note">${HP_ROLL_MIN}–${HP_ROLL_MAX} · ${verdict(beast.baseHpRoll)}</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Level</span>
            <span class="vivarium__stat-value">${beast.level}</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Pact ceiling</span>
            <span class="vivarium__stat-value">${beast.baseHpRoll + beast.bonusMaxHp}</span>
            <span class="vivarium__stat-note">${
              beast.bonusMaxHp > 0 ? `${beast.baseHpRoll} + ${beast.bonusMaxHp}` : 'unlevelled'
            }</span>
          </div>
          <div class="vivarium__stat">
            <span class="vivarium__stat-label">Opening Armor</span>
            <span class="vivarium__stat-value">${beast.startingArmor}</span>
          </div>
        </div>

        <div class="vivarium__trait">
          <span class="vivarium__stat-label">Knack</span>
          <span class="vivarium__trait-name">${trait?.name ?? 'None'}</span>
          <span class="vivarium__trait-text">${trait?.text ?? 'Nothing remarkable about this one.'}</span>
        </div>

        <div class="vivarium__actions">
          <button class="brass-btn vivarium__pick" ${active ? 'disabled' : ''}>
            ${active ? 'Standing with you' : 'Take this one'}
          </button>
          <button class="brass-btn vivarium__release" ${onlyOne ? 'disabled' : ''}>
            ${this.confirming === beast.instanceId ? 'Release — sure?' : 'Release'}
          </button>
        </div>
        <div class="vivarium__release-note">${
          onlyOne ? 'The last one stays. You cannot walk into a contract alone.' : ''
        }</div>
      </div>

      <div class="brass-panel vivarium__feed">
        <div class="vivarium__feed-head">Feed</div>
        <div class="vivarium__feed-copy">
          Another level. More health on the Pact while this one stands beside you.
        </div>
        <div class="vivarium__feed-cost">
          <span class="workbench__coin--gold">${cost.ducats} d</span>
          <span class="workbench__coin--marrow">${cost.marrowShards} shards</span>
        </div>
        <button class="brass-btn vivarium__level">Feed / Enhance</button>
        <div class="vivarium__refusal">${REFUSAL_COPY[refusal ?? 'none']}</div>
      </div>
    `;

    host.querySelector('.vivarium__pick')!.addEventListener('click', () => {
      this.opts.onSelect(beast.instanceId);
      this.opts.onChange();
      this.render();
    });

    const feed = host.querySelector<HTMLButtonElement>('.vivarium__level')!;
    feed.disabled = refusal !== null;
    feed.addEventListener('click', () => {
      // The pen decides, not the button state: a stale render must not be able to spend.
      if (!this.opts.onLevel(beast.instanceId)) return;
      this.opts.onChange();
      this.render();
    });

    host.querySelector('.vivarium__release')!.addEventListener('click', () =>
      this.release(beast.instanceId),
    );
  }

  /**
   * Two clicks to let one go.
   *
   * The button becomes its own confirmation rather than opening a dialog: releasing is
   * destructive but small and frequent — you will do it to most of what you catch — and a
   * modal for every runt would make the roll loop miserable.
   */
  private release(instanceId: string): void {
    if (this.confirming !== instanceId) {
      this.confirming = instanceId;
      this.render();
      return;
    }

    this.confirming = null;
    if (!this.opts.onRelease(instanceId)) return;
    this.viewing = this.opts.activeInstanceId();
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
