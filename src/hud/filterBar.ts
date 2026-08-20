/**
 * One filter bar, for every shelf that has one.
 *
 * The Artificer's blueprint grid grew a bar of pills; the Field Journal's collection wants
 * the same bar over a different shelf. Building it twice is how the two come to disagree
 * about what a school pill looks like, which is the same failure `cardFace.ts` exists to
 * have already fixed once.
 *
 * Deliberately dumb: it renders groups of pills and reports which one was clicked. It
 * knows nothing about cards, schools, or what any filter *means* — the screens own that,
 * because the meanings differ and the chrome does not.
 *
 * DOM-producing, so it lives beside the other renderers rather than in `src/core`.
 */

export interface FilterPill {
  /** The value reported on click. */
  key: string;
  label: string;
  /** Optional accent, used for school pills so the bar and the grid agree on colour. */
  tint?: string;
}

export interface FilterGroup {
  /** Which filter this group sets, reported alongside the pill key. */
  name: string;
  label: string;
  pills: FilterPill[];
  /** The pill currently marked. */
  active: string;
}

export function filterBarHtml(groups: FilterGroup[]): string {
  return groups
    .map(
      (g) => `
      <div class="filterbar__group">
        <span class="filterbar__label">${g.label}</span>
        <div class="filterbar__pills">
          ${g.pills
            .map(
              (p) => `
            <button class="filterbar__pill${p.key === g.active ? ' is-on' : ''}"
                    data-filter="${g.name}" data-value="${p.key}"
                    ${p.tint ? `style="--pill:${p.tint}"` : ''}>${p.label}</button>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('');
}

/**
 * Wires every pill inside `host`.
 *
 * Call after replacing the bar's markup. The bar is rebuilt whole on each change rather
 * than having its marked class moved, so a stale pill cannot survive a re-render — which
 * is worth more than the handful of listeners it costs.
 */
export function wireFilterBar(
  host: HTMLElement,
  onChange: (name: string, value: string) => void,
): void {
  for (const pill of host.querySelectorAll<HTMLElement>('.filterbar__pill')) {
    pill.addEventListener('click', () => {
      onChange(pill.dataset.filter ?? '', pill.dataset.value ?? 'all');
    });
  }
}

/**
 * The Pip pills every card shelf uses.
 *
 * The top one is a **bucket**, not a number: everything at or above it lands there, so
 * nothing priced past the last pill can be filtered into invisibility.
 */
export const PIP_MAX = 5;

export function pipPills(): FilterPill[] {
  return [
    { key: 'all', label: 'Any' },
    ...[0, 1, 2, 3, 4, PIP_MAX].map((c) => ({
      key: String(c),
      label: c === PIP_MAX ? `${c}+` : String(c),
    })),
  ];
}

/** Whether a card at `pips` passes the chosen Pip pill. */
export function matchesPips(pips: number, active: string): boolean {
  if (active === 'all') return true;
  const want = Number(active);
  return want === PIP_MAX ? pips >= PIP_MAX : pips === want;
}
