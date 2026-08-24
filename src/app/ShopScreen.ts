/**
 * The Apothecary.
 *
 * Strictly survival goods and, eventually, tailoring. The Lead Designer's separation
 * holds here in the code as well as on the sign: this screen imports nothing about cards,
 * crafting, or reagents, so there is no path by which the shelf quietly grows a forge.
 *
 * The shelf is transactional rather than decorative — buying spends real Ducats and puts
 * a real item in the satchel, because both halves already exist in `OverworldState` and a
 * button that pretended would be harder to remove later than one that works.
 */

import type { Screen } from './ScreenManager.js';
import type { GlobalGameState } from '../core/overworld/state.js';
import type { StockItem } from '../core/data/apothecary.js';
import { addConsumable, INVENTORY_LIMIT } from '../core/overworld/state.js';
import { APOTHECARY_STOCK, clinicPrice, effectOf } from '../core/data/apothecary.js';
import { buyGear, gearForSlot, gearRefusal, gearRelic } from '../core/data/outfitter.js';
import { RELIC_SLOT_ORDER } from '../core/overworld/state.js';
import { RELIC_SLOT_BLURBS, RELIC_SLOT_LABELS } from '../core/data/relics.js';

export interface ShopOpts {
  global: GlobalGameState;
  /**
   * Called after the run has been mutated, so the purchase is on disk before the player
   * has finished looking at the shelf. Saving on the way out instead would lose a tonic
   * to a closed tab.
   */
  onChange?: () => void;
  onBack: () => void;
}

/** Why a purchase is refused, or null if it can go through. */
type Refusal = 'too-poor' | 'satchel-full' | null;

export class ShopScreen implements Screen {
  private el: HTMLElement | null = null;

  constructor(private readonly opts: ShopOpts) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen screen--shop';
    el.innerHTML = `
      <div class="shop__head brass-panel">
        <div>
          <div class="shop__title">The Apothecary</div>
          <div class="shop__sub">Tonics, brews, and tailoring · no cards traded here</div>
        </div>
        <div class="shop__purse">
          <span class="shop__purse-label">Ducats</span>
          <span class="shop__purse-value"></span>
        </div>
        <button class="brass-btn shop__back">Back to the street</button>
      </div>

      <div class="shop__body">
        <section class="shop__section">
          <div class="shop__section-title">On the shelf</div>
          <div class="shop-stock"></div>
          <div class="shop__satchel"></div>
        </section>

        <section class="shop__section shop__section--clinic">
          <div class="shop__section-title">The Clinic</div>
          <div class="brass-panel shop__clinic"></div>
        </section>

        <section class="shop__section shop__section--cosmetics">
          <div class="shop__section-title">Cosmetics &amp; Tailoring</div>
          <div class="shop__section-note">
            Five slots, one apiece. Gear here bends a rule — none of it will make anything
            hit harder.
          </div>
          <div class="shop-gear"></div>
        </section>
      </div>
    `;

    el.querySelector('.shop__back')!.addEventListener('click', () => this.opts.onBack());

    root.appendChild(el);
    this.el = el;
    this.render();
  }

  // ------------------------------------------------------------- the counter

  private render(): void {
    this.renderPurse();
    this.renderStock();
    this.renderSatchel();
    this.renderClinic();
    this.renderGear();
  }

  /**
   * The Tailoring counter.
   *
   * Grouped by slot rather than listed flat, for the same reason the footlocker is: the
   * question a player is answering here is "what competes with what I am already wearing",
   * and a flat shelf makes them work that out themselves.
   *
   * Gear already owned stays on the shelf, marked, rather than disappearing. A counter
   * whose stock silently shrinks reads as a bug the first time somebody looks for the coat
   * they bought last week.
   */
  private renderGear(): void {
    const host = this.el?.querySelector('.shop-gear');
    if (!host) return;
    host.innerHTML = '';

    const { overworld } = this.opts.global;

    for (const slot of RELIC_SLOT_ORDER) {
      const stock = gearForSlot(slot);
      if (stock.length === 0) continue;

      const group = document.createElement('div');
      group.className = 'gear-group';
      group.innerHTML = `
        <div class="gear-group__head">
          <span class="relic-slot__domain relic-slot__domain--${slot}"></span>
          <span class="gear-group__label">${RELIC_SLOT_LABELS[slot]}</span>
          <span class="gear-group__blurb">${RELIC_SLOT_BLURBS[slot]}</span>
        </div>
      `;

      for (const item of stock) {
        const relic = gearRelic(item);
        if (!relic) continue;
        const refusal = gearRefusal(overworld, item.relicId);
        const owned = refusal === 'already-owned';

        const row = document.createElement('div');
        row.className = `gear-item brass-panel${owned ? ' is-owned' : ''}`;
        row.innerHTML = `
          <div class="gear-item__body">
            <div class="gear-item__name">${relic.name}</div>
            <div class="gear-item__rule">${relic.text}</div>
            <div class="gear-item__pitch">${item.pitch}</div>
          </div>
          <div class="gear-item__buy">
            <div class="gear-item__price">${item.price} <span>d</span></div>
            <button class="brass-btn gear-item__take">${owned ? 'Owned' : 'Buy'}</button>
            <div class="gear-item__refusal">${
              refusal === 'too-poor'
                ? `${item.price - overworld.economy.ducats} short`
                : ''
            }</div>
          </div>
        `;

        const btn = row.querySelector<HTMLButtonElement>('.gear-item__take')!;
        btn.disabled = refusal !== null;
        btn.addEventListener('click', () => this.buyGear(item.relicId));
        group.appendChild(row);
      }
      host.appendChild(group);
    }
  }

  /**
   * Takes payment and the gear together, or neither.
   *
   * `buyGear` owns both halves and asks its own refusal, so a stale render cannot charge
   * the purse for something the footlocker already holds.
   */
  private buyGear(relicId: string): void {
    if (!buyGear(this.opts.global.overworld, relicId)) return;
    this.opts.onChange?.();
    this.render();
  }


  /**
   * A bed and a bill.
   *
   * The counterpart to the rescue fee: a knockout leaves the player at 1 health, and this
   * is the way back to full for anyone without a tonic. Priced by the point, so being
   * barely scratched costs barely anything and being carried in off the street is dear.
   */
  private renderClinic(): void {
    const host = this.el?.querySelector('.shop__clinic');
    if (!host) return;
    const { overworld } = this.opts.global;
    const { pact, economy } = overworld;
    const price = clinicPrice(overworld);
    const whole = price === 0;
    const affordable = economy.ducats >= price;

    host.innerHTML = `
      <div class="shop__clinic-line">Pact ${pact.currentHp} / ${pact.maxHp}</div>
      <div class="shop__clinic-copy">${
        whole
          ? 'Nothing here needs mending. Come back bleeding.'
          : 'Boiled linen and a lamp turned low. You will walk out whole.'
      }</div>
      <div class="shop__clinic-price">${whole ? '—' : `${price} d`}</div>
      <button class="brass-btn shop__clinic-buy">Take the bed</button>
      <div class="shop-item__refusal">${
        !whole && !affordable ? `${price - economy.ducats} short` : ''
      }</div>
    `;

    const btn = host.querySelector('button')!;
    btn.disabled = whole || !affordable;
    btn.addEventListener('click', () => this.treat());
  }

  /** Pays the bill, then heals — asking the price once, so the two cannot disagree. */
  private treat(): void {
    const { overworld } = this.opts.global;
    const price = clinicPrice(overworld);
    if (price === 0 || overworld.economy.ducats < price) return;

    overworld.economy.ducats -= price;
    overworld.pact.currentHp = overworld.pact.maxHp;

    this.opts.onChange?.();
    this.render();
  }

  private renderPurse(): void {
    const host = this.el?.querySelector('.shop__purse-value');
    if (host) host.textContent = String(this.opts.global.overworld.economy.ducats);
  }

  private renderSatchel(): void {
    const host = this.el?.querySelector('.shop__satchel');
    if (!host) return;
    const { inventory } = this.opts.global.overworld;
    const held = inventory.map((i) => `<span class="shop__chit">${i.name}</span>`).join('');
    host.innerHTML = `
      <span class="shop__satchel-label">Satchel ${inventory.length}/${INVENTORY_LIMIT}</span>
      ${held || '<span class="shop__chit shop__chit--empty">empty</span>'}
    `;
  }

  /**
   * Why a given purchase cannot happen, named rather than merely disabled.
   *
   * A greyed-out button that does not say which of the two walls you hit — an empty purse
   * or a full satchel — leaves the player guessing at a rule they cannot see.
   */
  private refusal(stock: StockItem): Refusal {
    const { economy, inventory } = this.opts.global.overworld;
    if (inventory.length >= INVENTORY_LIMIT) return 'satchel-full';
    if (economy.ducats < stock.price) return 'too-poor';
    return null;
  }

  private renderStock(): void {
    const host = this.el?.querySelector('.shop-stock');
    if (!host) return;
    host.innerHTML = '';

    for (const stock of APOTHECARY_STOCK) {
      const refusal = this.refusal(stock);
      const row = document.createElement('div');
      row.className = `shop-item brass-panel shop-item--${stock.item.type}`;
      row.innerHTML = `
        <div class="shop-item__vial"></div>
        <div class="shop-item__body">
          <div class="shop-item__name">${stock.item.name}</div>
          <div class="shop-item__effect">${effectOf(stock)}</div>
          <div class="shop-item__blurb">${stock.blurb}</div>
        </div>
        <div class="shop-item__buy">
          <div class="shop-item__price">${stock.price} <span>d</span></div>
          <button class="brass-btn shop-item__take">Buy</button>
          <div class="shop-item__refusal">${
            refusal === 'satchel-full'
              ? 'Satchel is full'
              : refusal === 'too-poor'
                ? `${stock.price - this.opts.global.overworld.economy.ducats} short`
                : ''
          }</div>
        </div>
      `;

      const btn = row.querySelector<HTMLButtonElement>('.shop-item__take')!;
      btn.disabled = refusal !== null;
      btn.addEventListener('click', () => this.buy(stock));
      host.appendChild(row);
    }
  }

  /**
   * Takes payment, then the item — in that order, and only if the item is actually
   * accepted. `addConsumable` owns the cap, so asking it rather than trusting the
   * disabled button means the purse can never be charged for something that did not fit.
   */
  private buy(stock: StockItem): void {
    if (this.refusal(stock) !== null) return;
    const { overworld } = this.opts.global;

    const taken = addConsumable(overworld, { ...stock.item });
    if (!taken) return;
    overworld.economy.ducats -= stock.price;

    this.opts.onChange?.();
    this.render();
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
