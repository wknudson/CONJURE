/**
 * One card face, in one place.
 *
 * The hand had a card component and the Artificer had `forge-print`, a second, smaller
 * card drawn from the same data with different markup. Two renderers for one object is
 * how a card comes to cost 2 Pips in the hand and 2 Pips in the forge and show its
 * keywords in only one of them — and the forge is precisely where a player is deciding
 * whether to spend Shards on a printing, so it is the worst place to show them less.
 *
 * This module owns the face. `CardView` wraps it with the hand's interactivity, and the
 * Safehouse screens render it directly off a `CardDef`.
 *
 * DOM-producing and therefore outside `src/core`, like every other renderer.
 */

import { formatCost } from './cost.js';
import { schoolOf } from '../render/palette.js';
import { isAscendedId } from '../core/data/cards/index.js';
import { ASCENSION_PERCENT } from '../core/data/ascension.js';
import type { CardCost } from '../core/types/cards.js';
import type { CardDef } from '../core/types/cards.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import type { Keyword, School } from '../contract/ids.js';

/**
 * Everything a card face draws, and nothing about where it came from.
 *
 * A deliberate narrowing: a `CardDef` carries effect trees and rank-2 override tables that
 * no face has ever shown, and a `CardSnapshot` carries an instance id the Safehouse does
 * not have. Both collapse to this.
 */
export interface CardFace {
  name: string;
  cost: CardCost;
  school: School;
  source: 'hero' | 'companion';
  kind: 'minion' | 'spell' | 'rune' | 'obstacle';
  text: string;
  keywords: Keyword[];
  stats?: { atk: number; hp: number; mov: number; rangeMin: number; rangeMax: number };
  /** Cast reach. Only Companion cards have one — the Hero has no position to measure from. */
  range?: number;
  ephemeral?: boolean;
  /** A variable price. The badge shows X rather than the printed zero. */
  xCost?: { max: number };
  /**
   * This is the Rank 2 printing.
   *
   * Shown as a badge rather than left to the name's trailing `+`, because the uplift is
   * uniform and invisible: a card reading 33 instead of 30 is a card a player has to hold
   * two of, side by side, to notice. The badge is what makes the Shards feel spent.
   */
  ascended?: boolean;
}

/** What the card does with the board, in one word. */
const KIND_LABEL: Record<CardFace['kind'], string> = {
  minion: 'MINION',
  spell: 'SPELL',
  rune: 'RUNE',
  obstacle: 'OBSTACLE',
};

/**
 * A face from a definition — what the Safehouse holds.
 *
 * `rangeMin`/`rangeMax` come along here and not in the hand's snapshot, because the forge
 * is where a mortar's blind spot is a purchasing decision rather than a mid-fight one.
 */
export function faceOfDef(def: CardDef): CardFace {
  return {
    name: def.name,
    cost: def.cost,
    school: def.school,
    source: def.source,
    kind: def.kind,
    text: def.text,
    keywords: def.keywords,
    ...(def.unit
      ? {
          stats: {
            atk: def.unit.atk,
            hp: def.unit.hp,
            mov: def.unit.mov,
            rangeMin: def.unit.rangeMin,
            rangeMax: def.unit.rangeMax,
          },
        }
      : {}),
    ...(def.range !== undefined ? { range: def.range } : {}),
    ...(def.xCost ? { xCost: { max: def.xCost.max } } : {}),
    ...(isAscendedId(def.id) ? { ascended: true } : {}),
  };
}

/** A face from a live hand card. */
export function faceOfSnapshot(s: CardSnapshot): CardFace {
  return {
    name: s.name,
    cost: s.cost,
    school: s.school,
    source: s.source,
    kind: s.kind,
    text: s.text,
    keywords: s.keywords,
    ...(s.stats ? { stats: { ...s.stats, rangeMin: 1, rangeMax: 1 } } : {}),
    ...(s.range !== undefined ? { range: s.range } : {}),
    ...(s.ephemeral ? { ephemeral: true } : {}),
    ...(s.xCost ? { xCost: { max: s.xCost.max } } : {}),
    ...(isAscendedId(s.defId) ? { ascended: true } : {}),
  };
}

/**
 * The face as markup.
 *
 * Returns a string rather than an element so it can be composed into a template the way
 * the Safehouse screens already build their panels. `cardFaceEl` is here for callers that
 * want the node.
 *
 * `showStats` exists because the hand deliberately shows three numbers and the forge shows
 * five: mid-fight, reach is already drawn on the board, and in the forge it is the thing
 * being bought.
 */
export function cardFaceHtml(
  face: CardFace,
  opts: { extraClass?: string; showReach?: boolean } = {},
): string {
  const colors = schoolOf(face.school);
  const cls = [
    'card',
    `card--${face.kind}`,
    `card--src-${face.source}`,
    face.ascended ? 'card--ascended' : '',
    face.ephemeral ? 'card--ephemeral' : '',
    opts.extraClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const stats = face.stats
    ? `<div class="card__stats">
         <span title="Attack">${face.stats.atk}</span>
         <span title="Health">${face.stats.hp}</span>
         <span title="Movement">${face.stats.mov}</span>
         ${
           opts.showReach && face.stats.rangeMax > 1
             ? `<span title="Reach">${face.stats.rangeMin}–${face.stats.rangeMax}</span>`
             : ''
         }
       </div>`
    : '';

  // Each keyword carries its own tooltip: they are the densest jargon on screen.
  const keywords = face.keywords.length
    ? `<div class="card__keywords">${face.keywords
        .map((k) => `<span data-tip="${k}">${k}</span>`)
        .join(' · ')}</div>`
    : '';

  const rangeChip =
    face.range === undefined
      ? ''
      : `<span class="card__range" data-tip="companionRange">RANGE ${face.range}</span>`;

  // The whole of what Ascension shows. One badge, one number, and it means the same thing
  // on every card in the game -- which is the point of having made the uplift uniform.
  const ascendedChip = face.ascended
    ? `<span class="card__ascended" data-tip="Ascended|Rank 2. Every number this card deals is ${ASCENSION_PERCENT}% higher, rounded up.|Its cost, its reach and its targeting are untouched -- an Ascension never changes how a card is played.">+${ASCENSION_PERCENT}%</span>`
    : '';

  return `
    <div class="${cls}" style="--school:${colors.main};--school-deep:${colors.deep}">
      <div class="card__cost${face.xCost ? ' card__cost--x' : ''}">${
        face.xCost ? 'X' : formatCost(face.cost)
      }</div>
      <div class="card__name">${escapeHtml(face.name)}</div>
      <div class="card__type">
        <span class="card__kind">${KIND_LABEL[face.kind]}</span>
        ${rangeChip}
        ${ascendedChip}
        <span class="card__source">${face.source === 'companion' ? 'COMPANION' : 'HERO'}</span>
      </div>
      <div class="card__body">
        <div class="card__text">${escapeHtml(face.text)}</div>
        ${
          face.xCost
            ? `<div class="card__xnote" data-tip="Variable cost|You name X when you play it. Up to ${face.xCost.max}, and never zero.|Marrow can pay it, the same as any other Pip cost.">Costs X · up to ${face.xCost.max}</div>`
            : ''
        }
        ${keywords}
      </div>
      ${stats}
    </div>
  `;
}

/** The same face, as a node. */
export function cardFaceEl(
  face: CardFace,
  opts: { extraClass?: string; showReach?: boolean } = {},
): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = cardFaceHtml(face, opts);
  return host.firstElementChild as HTMLElement;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
