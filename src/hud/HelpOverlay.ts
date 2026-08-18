/**
 * The rules reference, opened with H or the ? button.
 *
 * A card battler on a grid asks a newcomer to hold several systems in their head at
 * once. Rather than front-loading all of it into a tutorial nobody reads, the tutorial
 * teaches the minimum and this panel stays one keystroke away for everything else.
 */

import { KEYWORDS, TERMS } from './glossary.js';

const SECTIONS: { heading: string; rows: [string, string][] }[] = [
  {
    heading: 'How you win',
    rows: [
      ['Your goal', 'Reduce the enemy Commander to 0 HP. They stand beyond their back row.'],
      ['How you lose', 'Your Hero and Companion share 40 HP. At zero, the run ends.'],
      ['Reaching them', 'Melee must be standing in the enemy\'s two red rows. Ranged needs a clear line.'],
    ],
  },
  {
    heading: 'A turn, in order',
    rows: [
      ['1 · Upkeep', 'You gain a Pip, draw to four cards, and Burn and Toxin tick.'],
      ['2 · Escalation', 'Units that survived a full round grow stronger.'],
      ['3 · Your actions', 'Play cards, move units, attack — in any order you like.'],
      ['4 · End turn', 'Unspent Marrow is lost. Unplayed cards are discarded unless they Retain.'],
    ],
  },
  {
    heading: 'Units',
    rows: [
      ['Moving', 'Any direction including diagonals, up to the unit\'s MOV.'],
      ['One of each', 'One move and one attack per turn, in either order — so a unit can strike and then withdraw.'],
      ['No retaliation', 'The attacker wins the exchange outright, unless the defender has Counter.'],
      ['Behemoths', 'Fill a 2×2 space and cannot squeeze through single-tile gaps.'],
    ],
  },
  {
    heading: 'Shoving things',
    rows: [
      ['Collision', 'A shoved unit that hits anything takes 3 damage. What it hit takes 2.'],
      ['Walls count', 'The arena boundary hurts exactly as much as a body does.'],
      ['Preview it', 'Hover a shove and a ghost slides to the exact tile it will stop on.'],
    ],
  },
  {
    heading: 'Reading the enemy',
    rows: [
      ['Declared attacks', 'Red tiles mark where the enemy will strike next turn, with the damage on them.'],
      ['It hits the tile', 'Move the target away and the blow lands on empty ground — or on whatever is standing there now, including one of their own.'],
      ['Stopping it', 'Kill the attacker, or Freeze it, and the blow never comes.'],
      ['What is hidden', 'A Novice shows you everything. An Adept shows only its blows and keeps its cards to itself.'],
    ],
  },
  {
    heading: 'Elemental reactions',
    rows: [
      ['Vaporize', 'Fire on a Chilled target flashes it to fog that blocks ranged sight for 2 turns.'],
      ['Shatter', 'A physical hit — or a shove into a wall — on a Frozen target strips all its Armor and sprays 4 damage to its neighbours.'],
      ['Wildfire', 'Fire on a Toxined target burns off every stack for 2 damage per stack, all around it.'],
      ['Chill', 'Three stacks freeze a unit solid instead of stacking a fourth.'],
      ['Brittle', 'The target takes +2 from every hit until it wears off.'],
    ],
  },
  {
    heading: 'Runes and cascades',
    rows: [
      ['Attaching', 'One rune per target, on either side\'s units.'],
      ['Detonating', 'Damage must reach actual health. Armor absorbing it all means nothing happens.'],
      ['Cascades', 'A detonation that draws blood from another rune-holder sets theirs off too.'],
      ['Fizzling', 'Kill a rune-holder with the wrong damage type and the rune is simply lost.'],
    ],
  },
];

const CONTROLS: [string, string][] = [
  ['Click a card', 'Then click a highlighted tile to play it'],
  ['Click your unit', 'Cyan tiles are moves, red outlines are attacks'],
  ['Click the enemy Commander', 'Attacks them, if the selected unit can reach'],
  ['Hold Shift', 'Expands damage predictions across every affected tile'],
  ['C', 'Channels the selected unit: gives up its attack to extract Marrow'],
  ['T', 'Toggles the danger zone — every tile the enemy can strike'],
  ['Q / E', 'Turns the board a quarter-turn, to see behind tall pieces'],
  ['Z', 'Takes back your last move. Attacks and card plays are final'],
  ['Tab', 'Jumps to the next unit that can still act'],
  ['Space', 'Fast-forwards the enemy turn'],
  ['Enter', 'Ends your turn'],
  ['Esc / right-click', 'Cancels the current selection'],
  ['H', 'Opens and closes this panel'],
];

export class HelpOverlay {
  private el: HTMLElement;
  private open = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'help-overlay';
    this.el.innerHTML = this.render();
    parent.appendChild(this.el);

    this.el.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t === this.el || t.closest('.help-overlay__close')) this.hide();
    });
  }

  private render(): string {
    const section = (s: (typeof SECTIONS)[number]): string => `
      <section class="help__section">
        <h3>${s.heading}</h3>
        <dl>${s.rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      </section>`;

    const keywordRows = Object.values(KEYWORDS)
      .map((k) => `<dt>${k.title}</dt><dd>${k.body}</dd>`)
      .join('');

    const resourceRows = (['pips', 'marrow', 'armor'] as const)
      .map((k) => {
        const e = TERMS[k]!;
        return `<dt>${e.title.split('—')[0]!.trim()}</dt><dd>${e.body}${e.detail ? ` ${e.detail}` : ''}</dd>`;
      })
      .join('');

    return `
      <div class="help__panel" role="dialog" aria-label="Rules reference">
        <button class="help-overlay__close" aria-label="Close">×</button>
        <h2>CONJURE — Rules Reference</h2>
        <div class="help__cols">
          <div>
            ${SECTIONS.slice(0, 3).map(section).join('')}
            <section class="help__section">
              <h3>Resources</h3>
              <dl>${resourceRows}</dl>
            </section>
          </div>
          <div>
            ${SECTIONS.slice(3).map(section).join('')}
            <section class="help__section">
              <h3>Keywords</h3>
              <dl>${keywordRows}</dl>
            </section>
            <section class="help__section">
              <h3>Controls</h3>
              <dl>${CONTROLS.map(([k, v]) => `<dt class="key">${k}</dt><dd>${v}</dd>`).join('')}</dl>
            </section>
          </div>
        </div>
      </div>`;
  }

  toggle(): void {
    this.open ? this.hide() : this.show();
  }

  show(): void {
    this.open = true;
    this.el.classList.add('is-open');
  }

  hide(): void {
    this.open = false;
    this.el.classList.remove('is-open');
  }

  get isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.el.remove();
  }
}
