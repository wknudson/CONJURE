import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';

/**
 * The card is a fixed box (`cards.css`: 112 by 160) and the rules text has to fit it at
 * the base size. Measured in the browser: at that size the box holds about 190 characters
 * of prose on a card with no keyword row, and about 150 on one that carries keywords or
 * stats under the text. These caps hold the data to what the box can show, so a card whose
 * rules are cut off mid-sentence is a failing test rather than a playtester's surprise.
 * `fitCardText` steps the type down as a backstop, but a card that needs it is a card that
 * should be reworded.
 */
const PROSE_MAX = 190;
const DENSE_MAX = 150;

describe('card rules text fits the card', () => {
  it('stays within what the box can show', () => {
    const over: string[] = [];
    for (const def of Object.values(CARDS)) {
      const dense = def.keywords.length > 0 || def.kind === 'minion';
      const max = dense ? DENSE_MAX : PROSE_MAX;
      if (def.text.length > max) over.push(`${def.id} (${def.text.length} > ${max})`);
    }
    expect(over.join('\n')).toBe('');
  });
});
