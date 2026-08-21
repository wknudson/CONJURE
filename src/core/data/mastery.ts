/**
 * Mastery Objectives — what a subjugation was worth beyond having been survived.
 *
 * Putting a beast down gets you a beast. *How* you put it down decides which one.
 *
 * The problem this solves is that a capture used to be a coin flip you could not
 * influence: you fought the Alpha, you held the tether for three rounds, and the animal
 * that fell out was whatever the seed said. A player who fought brilliantly and a player
 * who scraped through at one health caught the same distribution of creature, so there was
 * nothing to *play* for once the tether landed.
 *
 * Affinity is the answer, and its shape matters as much as its existence: **it moves floors
 * and odds, never outcomes.** A flawless capture cannot promise a perfect beast. It raises
 * the worst constitution you might be handed and makes a wild modifier likelier, and then
 * it steps back and lets the dice finish the sentence. A mastery system that guaranteed the
 * good roll would turn the Variance Engine into a checklist, which is the thing it was
 * built to stop being.
 *
 * ## Why these three
 *
 * Each is a different way to be good at the game, so no single style sweeps them:
 *
 *  - **Untouched** rewards the player who never let the beast reach them. Defensive.
 *  - **Detonation** rewards the player who set something up and cashed it. Combo.
 *  - **Unbroken** rewards the player whose warband all walked out. Attrition.
 *
 * A cautious turtle takes the first and probably the third; a rune player takes the second
 * and rarely the first. Three at once is a genuinely good fight.
 *
 * Data and arithmetic only. Nothing here reaches into the reducer — the engine keeps two
 * integers and a roster, and this reads them.
 */

/** The objectives, in the order a results screen should list them. */
export const MASTERY_OBJECTIVES = [
  {
    id: 'untouched',
    name: 'Untouched',
    text: 'The Pact took no damage. Armour soaking a blow still counts — plate doing its job is not the same as being hit.',
  },
  {
    id: 'detonation',
    name: 'Detonation',
    text: 'Three or more of your own Runes went off. Whose trap it was, not whose body it was on.',
  },
  {
    id: 'unbroken',
    name: 'Unbroken',
    text: 'Every body you deployed was still standing at the bell.',
  },
] as const;

export type MasteryObjectiveId = (typeof MASTERY_OBJECTIVES)[number]['id'];

/** Runes of your own that have to go off to claim Detonation. */
export const DETONATION_TARGET = 3;

/** The most affinity a capture can carry, which is simply how many objectives there are. */
export const AFFINITY_CEILING = MASTERY_OBJECTIVES.length;

/** What the engine noticed, in the plainest possible terms. */
export interface MasteryFacts {
  damageTaken: number;
  runeDetonations: number;
  rosterFallen: number;
}

export interface MasteryReport {
  met: MasteryObjectiveId[];
  /** How many were met. The number every roll in the Variance Engine actually reads. */
  affinity: number;
}

/**
 * Scores a fight.
 *
 * Deliberately total: every objective is answered for every fight, won or lost. A defeat
 * scores its objectives and then never gets to spend them, because nothing was captured —
 * which is simpler than a scorer that has to be told the result, and leaves the results
 * screen free to show a player what they *did* manage on the way down.
 */
export function masteryOf(facts: MasteryFacts): MasteryReport {
  const met: MasteryObjectiveId[] = [];
  if (facts.damageTaken <= 0) met.push('untouched');
  if (facts.runeDetonations >= DETONATION_TARGET) met.push('detonation');
  if (facts.rosterFallen <= 0) met.push('unbroken');
  return { met, affinity: met.length };
}

/** An empty report, for a fight that reported nothing — a test, a standalone bout. */
export function noMastery(): MasteryReport {
  return { met: [], affinity: 0 };
}

export function masteryById(id: string): (typeof MASTERY_OBJECTIVES)[number] | undefined {
  return MASTERY_OBJECTIVES.find((o) => o.id === id);
}
