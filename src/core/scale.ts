/**
 * The Stat Stretch.
 *
 * Every combat *health* number in the game — hit points, damage, healing, armour — is
 * authored and stored a factor of ten larger than it reads. A Footman is not a 4-health
 * body that a 2-attack blow takes half of; it is a 40-health body taking 20.
 *
 * The reason is levelling, and it is the only reason. A Vanguard unit that gains a point
 * of health per level is a body whose stat line doubles in four levels; a body that gains
 * ten out of four hundred is one that gets meaningfully, gradually better. Small integers
 * cannot express a small improvement, so the integers stopped being small.
 *
 * **What does not stretch is everything that is counted rather than measured.** Pips,
 * Marrow, cards in hand, card costs, movement, range, footprint, Anchor Tiles, status
 * stacks and Aura stacks are all *quantities of things*, and a hand of seventy cards or a
 * spell costing thirty Pips is not a finer-grained version of the same game — it is a
 * different one. The rule of thumb: if it is spent, drawn, stepped or stacked, it stays
 * where it is. If it is a wound, it stretched.
 *
 * The factor lives here rather than being spelled `10` at each site because two kinds of
 * code genuinely need to *undo* it: anything pricing health in a currency that did not
 * stretch (the Clinic charges Ducats per point of health), and anything weighing health
 * against a positional term (the AI's utility table, where a point of damage has to stay
 * comparable to a tile of ground). Both divide by this. Neither would be findable if the
 * factor were an anonymous ten.
 */

/** Health, damage, healing and armour are all authored at this multiple. */
export const STAT_SCALE = 10;

/**
 * A stretched health figure back in the units a human balances in.
 *
 * Rounds up, so a wound smaller than one old point still costs something — a Clinic bill
 * of zero for a real injury is the one rounding anybody would notice.
 */
export function unscaleStat(value: number): number {
  return Math.ceil(value / STAT_SCALE);
}
