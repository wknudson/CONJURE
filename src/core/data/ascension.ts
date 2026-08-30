/**
 * Ascension — Rank 1 to Rank 2, as arithmetic rather than as authorship.
 *
 * A Rank 2 printing used to be a hand-written diff: this card gets a Bone cheaper, that
 * one reaches a tile further, this third one draws an extra card. Five cards had one and
 * the other hundred-odd could never be upgraded at all, because upgrading them meant
 * somebody sitting down and inventing what "better" looked like.
 *
 * It is now a rule. **Ascending a card raises every number it deals by 10%, rounded up,
 * and changes nothing else.** Not its cost, not its targeting, not its keywords, not how
 * far it reaches. A Rank 2 Shield Bash is a Shield Bash — the same card at the same price
 * doing the same thing to the same tiles, hitting slightly harder.
 *
 * That restraint is the design, not a shortcut. A Rank 2 that re-costed or re-targeted a
 * card was a *second* card wearing the first one's name, and every one of them was a new
 * thing to learn, a new interaction to check, and a new way for the board to surprise
 * somebody who thought they knew what was in the other player's hand. Vertical progression
 * keeps the tactics predictable while the numbers move.
 *
 * ## What scales
 *
 * Damage, armour, healing, and the health of anything a card builds. Those four, and the
 * list is closed — every op below either appears in `ascendEffect` or is deliberately
 * absent, and the comments say which.
 *
 * ## What does not, and why the exclusions are the interesting half
 *
 *  - **Economy.** Bones, Marrow, cards drawn, Marrow extracted. Ascension must not touch
 *    the action economy: a Rank 2 that cost one Bone less is a *different tempo*, and the
 *    whole reason to make progression vertical was to leave tempo alone.
 *  - **Space.** Movement, range, shove and pull distance, area shape, cone depth, line
 *    length. A spell that reaches further is a spell aimed differently, and a player
 *    reading the board should never have to ask what rank the card in the other hand is.
 *  - **Status stacks.** Two Burn is two Burn at either rank. Stacks are counted, and
 *    2.2 of them is not a thing.
 *  - **A tithe's own damage.** Blood Magic wounds *your* body to pay you. Scaling it up
 *    would make the Ascension a straight downgrade — the one place where "more damage"
 *    is the wrong direction.
 *  - **Unit stat blocks.** Bodies are not ascended, they are *levelled*: a Vanguard unit
 *    earns its stats by surviving fights (`vanguardBonus`). Two systems raising the same
 *    numbers would be two systems arguing about them.
 */

import type { CardDef, EffectNode } from '../types/cards.js';

/** The uplift, as a percentage, for the UI to state and the tests to pin. */
export const ASCENSION_PERCENT = 10;

/**
 * One number, ascended.
 *
 * Integer arithmetic on purpose. `Math.ceil(30 * 1.1)` is 34, not 33, because 30 * 1.1 is
 * 33.000000000000004 in binary floating point — a card would deal one more than the rule
 * says on values that happen to land badly, and it would do so invisibly. `base / 10` is
 * exact for every integer, so this is the same formula without the trap.
 *
 * Always rounded **up**, per the brief: a 25-damage strike gains 2.5 and deals 28. The
 * engine counts in whole numbers and a fractional gain that rounded to nothing would make
 * Ascension worthless on exactly the small cards that most need it.
 */
export function ascendValue(base: number): number {
  if (base <= 0) return base;
  return base + Math.ceil(base / (100 / ASCENSION_PERCENT));
}

/**
 * The effect tree, with every scalable number raised.
 *
 * Returns a new tree and never mutates: `CARDS` is built once at module load and the Rank
 * 1 printing has to survive the Rank 2 being derived from it.
 */
export function ascendEffect(node: EffectNode): EffectNode {
  switch (node.op) {
    case 'seq':
      return { ...node, effects: node.effects.map(ascendEffect) };

    // --- damage
    case 'damage':
      return { ...node, amount: ascendValue(node.amount) };
    case 'cleaveFront':
      // The amount, never the `width`: a wider cleave is a different shape.
      return { ...node, amount: ascendValue(node.amount) };
    case 'detonateAllMarks':
      return { ...node, bonusDamage: ascendValue(node.bonusDamage) };

    // --- armour, and only in its flat form. `{ from: 'titheDamage' }` is already
    //     derived from a wound this same play took, and scaling a derivation twice is
    //     how a card ends up 21% better than the rule says.
    case 'grantArmor':
      return typeof node.amount === 'number'
        ? { ...node, amount: ascendValue(node.amount) }
        : node;

    // --- healing
    case 'heal':
      return { ...node, amount: ascendValue(node.amount) };

    // --- construct health
    case 'spawnConstruct':
      return { ...node, hp: ascendValue(node.hp) };

    // --- revival, in its flat form only. The two percentage modes are already scale-free:
    //     they ride the raised body's own ceiling, which Vanguard levelling moves. Nudging
    //     a percentage as well would have two systems raising one number.
    case 'revive':
      return node.hp.mode === 'fixed'
        ? { ...node, hp: { ...node.hp, amount: ascendValue(node.hp.amount) } }
        : node;

    // --- both branches, and neither the condition. A Rank 2 asks the same question and
    //     hits harder whichever way the answer goes; raising the *threshold* a condition
    //     tests would make an ascended card fire less often, which is not an uplift.
    case 'ifMet':
      return {
        ...node,
        then: ascendEffect(node.then),
        ...(node.otherwise ? { otherwise: ascendEffect(node.otherwise) } : {}),
      };

    // --- everything else, deliberately untouched. Listed rather than defaulted, so a new
    //     op cannot join the game and silently inherit an answer nobody chose for it.
    case 'summon':
    case 'spawnObstacle':
    case 'attachMark':
    case 'push':
    case 'applyStatus':
    case 'consumeTarget':
    case 'tithe':
    case 'attachAura':
    case 'detonateAura':
    case 'extractMarrow':
    case 'drawCards':
    case 'shoveArea':
    case 'pullArea':
    case 'anchorTether':
    // Bones are a *counted* quantity and the Stat Stretch left every one of them alone.
    // Ascension follows the same line: a Rank 2 hits ten percent harder, it does not
    // quietly rewrite the economy.
    case 'gainBones':
    // Terrain has no number to raise. `turns` is a clock, not a magnitude.
    case 'spawnHazard':
    // Stacks are counted, and a Rank 2 that stripped *more* Burn would be strictly worse
    // at the only thing this op is ever used for.
    case 'clearStatus':
      return node;
  }
}

/**
 * Every number this card's uplift moved, and **how many times** it moved it.
 *
 * The count is the part that matters, and it is what `ascendText` spends. Largest first,
 * so a longer number is rewritten before a shorter one that could be a prefix of it.
 */
interface Scaled {
  from: number;
  to: number;
  times: number;
}

function scaledValues(before: CardDef, after: CardDef): Scaled[] {
  const seen = new Map<number, Scaled>();
  const note = (from: number, to: number): void => {
    if (from === to) return;
    const existing = seen.get(from);
    if (existing) existing.times += 1;
    else seen.set(from, { from, to, times: 1 });
  };

  const walk = (a: EffectNode, b: EffectNode): void => {
    if (a.op === 'seq' && b.op === 'seq') {
      a.effects.forEach((child, i) => {
        const other = b.effects[i];
        if (other) walk(child, other);
      });
      return;
    }
    for (const key of ['amount', 'bonusDamage', 'hp'] as const) {
      const from = (a as Record<string, unknown>)[key];
      const to = (b as Record<string, unknown>)[key];
      if (typeof from === 'number' && typeof to === 'number') note(from, to);
    }
    if (a.op === 'revive' && b.op === 'revive' && a.hp.mode === 'fixed' && b.hp.mode === 'fixed') {
      note(a.hp.amount, b.hp.amount);
    }
  };

  walk(before.effect, after.effect);
  if (before.obstacleHp !== undefined && after.obstacleHp !== undefined) {
    note(before.obstacleHp, after.obstacleHp);
  }
  if (before.obstacleDeath?.damage !== undefined && after.obstacleDeath?.damage !== undefined) {
    note(before.obstacleDeath.damage, after.obstacleDeath.damage);
  }

  return [...seen.values()].sort((x, y) => y.from - x.from);
}

/**
 * The rules text, restated in the numbers the Rank 2 actually deals.
 *
 * Rank 2 text used to be written by hand. It cannot be any more — the printing is derived,
 * so its prose has to be too, or every ascended card in the game would advertise its Rank 1
 * damage while dealing something else.
 *
 * Two rules keep the substitution honest:
 *
 *  1. **Exactly as many occurrences as the card actually raised.** Shield Bash reads "Deals
 *     20 damage ... Triggers standard Collision Damage (30 / 20)" and raises one of those
 *     20s, so one is rewritten and the engine's collision figure is left alone. Overload
 *     Strike raises *both* of its 20s, so both are rewritten. Neither "the first" nor "all
 *     of them" gets both cards right; the count does.
 *  2. **Only values of ten or more.** Since the Stat Stretch every quantity a card *deals*
 *     is a multiple of ten, and everything it *counts* — Burn stacks, tiles, Bones — is a
 *     single digit. That makes the size of the number a reliable signal of which kind it is.
 */
function ascendText(text: string, scaled: Scaled[]): string {
  // Rewritten through placeholders rather than in place, so a value one pass produced
  // cannot be caught by the next: a card raising 20 to 22 *and* 22 to 25 would otherwise
  // put every 20 through both steps and land on 25. The sentinel is a control character,
  // which no card's prose contains.
  const parked: string[] = [];
  const MARK = String.fromCharCode(1);
  let out = text;

  for (const { from, to, times } of scaled) {
    if (from < 10) continue;
    let left = times;
    out = out.replace(new RegExp(`(?<!\\d)${from}(?!\\d)`, 'g'), (match) => {
      if (left <= 0) return match;
      left -= 1;
      parked.push(String(to));
      return `${MARK}${parked.length - 1}${MARK}`;
    });
  }

  return out.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i: string) => parked[Number(i)]!);
}

/**
 * The Rank 2 printing of a card, or `undefined` when there is nothing to raise.
 *
 * Absence is a real answer and the Forge reads it: a card that only applies a status, draws
 * a card or shoves something has no number Ascension is allowed to touch, so it has no Rank
 * 2 and the bench refuses it rather than charging for a copy identical to the one you own.
 */
export function ascendCardDef(base: CardDef, ascendedId: string): CardDef | undefined {
  // Bodies are levelled, not ascended. Excluded here rather than at the call site so the
  // rule travels with the transform.
  if (base.kind === 'minion') return undefined;

  const effect = ascendEffect(base.effect);
  const obstacleHp =
    base.obstacleHp !== undefined ? ascendValue(base.obstacleHp) : undefined;
  const obstacleDeath =
    base.obstacleDeath?.damage !== undefined
      ? { ...base.obstacleDeath, damage: ascendValue(base.obstacleDeath.damage) }
      : base.obstacleDeath;

  const raised: CardDef = {
    ...base,
    id: ascendedId,
    name: `${base.name} +`,
    effect,
    ...(obstacleHp !== undefined ? { obstacleHp } : {}),
    ...(obstacleDeath ? { obstacleDeath } : {}),
  };

  const scaled = scaledValues(base, raised);
  // Nothing moved. A Rank 2 identical to its Rank 1 is a card the Forge should never
  // offer, and returning it would let a player pay Shards for their own card back.
  if (scaled.length === 0) return undefined;

  raised.text = ascendText(base.text, scaled);
  return raised;
}
