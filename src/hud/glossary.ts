/**
 * Plain-language explanations for every term the game shows but never defines.
 *
 * A first-time player meets "Escalate", "Guardian", "Pips" and "Marrow" within seconds
 * of starting, and nothing on screen says what any of them mean. Everything here is
 * surfaced on hover.
 */

export interface GlossaryEntry {
  title: string;
  body: string;
  /** Optional second line for the rule detail behind the summary. */
  detail?: string;
}

export const KEYWORDS: Record<string, GlossaryEntry> = {
  Haste: {
    title: 'Haste',
    body: 'Can move and attack the same turn it is deployed.',
    detail: 'Units without Haste have to wait a turn before they can act.',
  },
  Dormant: {
    title: 'Dormant',
    body: 'Cannot move or attack on the turn it is summoned.',
  },
  Impact: {
    title: 'Impact',
    body: 'Triggers an effect the moment it lands, but cannot act that turn.',
  },
  Counter: {
    title: 'Counter',
    body: 'Strikes back for its full Attack whenever it is hit in melee — and survives.',
    detail: 'A blow that kills it outright takes no counter-damage. Attacking one head-on is expensive.',
  },
  Guardian: {
    title: 'Guardian',
    body: 'Blocks line of sight. Ranged attacks cannot shoot past it.',
    detail: 'Park one in front of your Commander and enemy archers have to come around it.',
  },
  companionRange: {
    title: 'Companion Range',
    body: 'Cast from your Companion, not from you. It reaches this many tiles from where your Companion is standing.',
    detail:
      'Most also need a clear line, so walls and Guardians block them. Move your Companion to change what you can hit — but the further forward it stands, the easier it is to hurt, and its wounds are yours.',
  },
  Feral: {
    title: 'Feral',
    body: 'Wild. It belongs to neither side, attacks whatever is nearest, and either side may attack it.',
    detail:
      'Nothing commands it. A beast between two armies will maul whichever is closer — so shoving an enemy into its path is as good as striking them yourself.',
  },
  BoundForm: {
    title: 'Bound Form',
    body: 'Your Companion, made flesh. Every wound it takes is dealt straight to your Pact.',
    detail:
      'It keeps no health of its own and cannot be tithed or made to grow. Shoving it into a wall hurts you, not it — but your elemental spells are cast from where it stands.',
  },
  Escalate: {
    title: 'Escalate',
    body: 'Grows stronger at the start of your turn, if it survived the enemy round.',
    detail: 'Never on the turn it is deployed. Small units cap at +3; Behemoths never stop growing.',
  },
  Retain: {
    title: 'Retain',
    body: 'Stays in your hand at end of turn instead of being discarded.',
  },
  PowerTier: {
    title: 'Power Tier',
    body: 'A high-cost finisher. Bank Pips across several turns to afford it.',
  },
};

export const TERMS: Record<string, GlossaryEntry> = {
  pips: {
    title: 'Pips — banked magic',
    body: 'You gain 1 Pip at the start of every turn, and unspent Pips carry over.',
    detail: 'The bank holds 8. Saving them is how you afford Power Tier cards like Cataclysmic Core.',
  },
  marrow: {
    title: 'Marrow — volatile magic',
    body: 'Volatile, unrefined energy torn from your own units during a turn, or from devouring and elemental reactions.',
    detail:
      'Marrow is consumed before Pips when casting, and all unspent Marrow is lost at the end of the turn. Use it or lose it.',
  },
  pact: {
    title: 'The Pact',
    body: 'Your Hero and Companion share one pool of 40 HP. At zero, you lose.',
    detail: 'This is what enemy units are marching toward. Defend it or race them.',
  },
  armor: {
    title: 'Persistent Armor',
    body: 'Soaks damage before health, and never expires until it is stripped away.',
    detail: 'Runes need damage to actually reach health — armor can stop a chain reaction cold.',
  },
  rubble: {
    title: 'Rubble — broken ground',
    body: 'Crossing a rubble tile costs 2 MOV instead of 1. It blocks nothing: units may stand on it and shoot over it.',
    detail:
      'Left behind when masonry is destroyed, and it never clears. Breaking a wall opens a route without making it a fast one — and a slow unit can be stopped by a single stretch of it.',
  },
  burn: {
    title: 'Burn',
    body: 'Deals damage at the start of the affected side\'s turn, then loses one stack.',
  },
  toxin: {
    title: 'Toxin',
    body: 'Damage at turn start that ignores Armor entirely.',
  },
  chill: {
    title: 'Chill',
    body: 'Stacks toward freezing. The third stack freezes the unit solid instead of stacking again.',
    detail: 'Fire on a Chilled target Vaporizes it: 2 damage through any armor, and the tile fogs.',
  },
  brittle: {
    title: 'Brittle',
    body: 'The target takes +2 damage from every hit until it wears off.',
  },
  charged: {
    title: 'Charged',
    body: 'Residual Surge energy. On its own it does nothing — it is what fire and frost react to.',
    detail:
      'Fire into it Overloads: the charge detonates and throws everything adjacent a tile clear. Frost through it Superconducts: all Armor is stripped and the target is left Brittle.',
  },
  fog: {
    title: 'Steam Fog',
    body: 'Blocks ranged line of sight through the tile. Movement is unaffected.',
    detail: 'Left behind when fire meets a Chilled target. Thins as it expires.',
  },
  intent: {
    title: 'Enemy intent',
    body: 'Red tiles are where the enemy has committed to strike next turn, with the damage shown.',
    detail: 'The blow lands on the tile, not the unit. Move the target away and it hits nothing — or whatever is standing there instead.',
  },
  reactions: {
    title: 'Elemental reactions',
    body: 'Damage of one school landing on the status of another produces something new.',
    detail:
      'Fire on Chill vaporizes. A physical hit on Frozen shatters. Fire on Toxin ignites it. Fire on Charged overloads; frost on Charged superconducts.',
  },
  freeze: {
    title: 'Frozen',
    body: 'Cannot move or attack this turn. Still grows from Escalate.',
    detail: 'A physical blow — including a shove into a wall — Shatters it, stripping all Armor.',
  },
  entangle: { title: 'Entangled', body: 'Cannot move, but can still attack.' },
  stun: { title: 'Stunned', body: 'Cannot move or attack this turn.' },
  exhaust: {
    title: 'Exhausted',
    body: 'Bled for Marrow. Cannot move, attack, or channel until your next turn.',
    detail: 'One tithe per body per turn — the Exhaustion is what enforces it.',
  },
  escalation: {
    title: 'Escalation stacks',
    body: 'How many times this unit has grown by surviving a full round.',
  },
  resonance: {
    title: 'Resonance',
    body: 'The first Companion card you play each turn fires your Companion\'s passive.',
    detail: 'Ignis is a Pyre companion: it ignites every enemy standing in its glowing lane.',
  },
  territory: {
    title: 'Territory',
    body: 'You summon into your two blue-tinted rows. The red rows belong to the enemy.',
    detail: 'Melee units must reach the enemy\'s red rows to strike their Commander.',
  },
  commander: {
    title: 'Enemy Commander',
    body: 'Stands beyond their back row. Reduce them to 0 HP to win.',
    detail: 'Melee has to be standing in the red rows to reach them. Ranged units need a clear line.',
  },
  collision: {
    title: 'Collision',
    body: 'A shoved unit that hits something takes 3 damage; whatever it hit takes 2.',
    detail: 'Walls hurt just as much as bodies. Shoving into a wall is free damage.',
  },
  runes: {
    title: 'Runes',
    body: 'Attach to a unit and detonate when their trigger is met. One rune per target.',
    detail: 'A detonation that reaches another rune-holder\'s health sets theirs off too — that is a cascade.',
  },
};

export const CARD_KINDS: Record<string, GlossaryEntry> = {
  minion: {
    title: 'Minion',
    body: 'Puts a body on the board. It stays until killed.',
  },
  spell: {
    title: 'Spell',
    body: 'Resolves immediately, then goes to your discard pile.',
  },
  rune: {
    title: 'Rune',
    body: 'Attaches to a unit or obstacle and waits for its trigger.',
  },
  obstacle: {
    title: 'Obstacle',
    body: 'Creates destructible terrain that blocks line of sight.',
  },
};

export function lookup(key: string): GlossaryEntry | undefined {
  return KEYWORDS[key] ?? TERMS[key.toLowerCase()] ?? CARD_KINDS[key.toLowerCase()];
}
