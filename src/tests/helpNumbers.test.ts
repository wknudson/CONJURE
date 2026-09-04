import { describe, expect, it } from 'vitest';
import { TERMS } from '../hud/glossary.js';
import { SECTIONS } from '../hud/HelpOverlay.js';
import { REACTIONS } from '../core/data/reactions.js';
import { BRITTLE_BONUS } from '../core/engine/damage.js';
import { COLLISION_BLOCKER_DAMAGE, COLLISION_TARGET_DAMAGE } from '../core/engine/displacement.js';
import { BASE_PACT_HP } from '../core/overworld/vivarium.js';

/**
 * The help copy is the player's authoritative reference, and it was written against the
 * pre-Stretch scale and never migrated: it said 40 HP against a 400 HP bar, 3 and 2
 * collision damage against 30 and 20, sitting in the same panel as rows that had been
 * updated. The copy stays prose — the HUD does not import engine constants — so this holds
 * every number in it to the constant it describes.
 */
const row = (label: string): string => {
  for (const s of SECTIONS) for (const [k, v] of s.rows) if (k === label) return v;
  throw new Error(`no help row labelled ${label}`);
};

describe('the numbers in the help copy match the engine', () => {
  it('the Pact pool', () => {
    expect(TERMS.pact!.body).toContain(`${BASE_PACT_HP}`);
    expect(row('How you lose')).toContain(`${BASE_PACT_HP}`);
  });

  it('Brittle', () => {
    expect(TERMS.brittle!.body).toContain(`+${BRITTLE_BONUS}`);
    expect(row('Brittle')).toContain(`+${BRITTLE_BONUS}`);
  });

  it('collision', () => {
    expect(TERMS.collision!.body).toContain(`${COLLISION_TARGET_DAMAGE} damage`);
    expect(TERMS.collision!.body).toContain(`takes ${COLLISION_BLOCKER_DAMAGE}`);
    expect(row('Collision')).toContain(`${COLLISION_TARGET_DAMAGE} damage`);
    expect(row('Collision')).toContain(`takes ${COLLISION_BLOCKER_DAMAGE}`);
  });

  it('Vaporize', () => {
    const vaporize = REACTIONS.find((r) => r.id === 'vaporize');
    expect(vaporize).toBeDefined();
    const dmg = vaporize!.trueDamage ?? NaN;
    expect(Number.isFinite(dmg)).toBe(true);
    expect(TERMS.chill!.detail).toContain(`${dmg} damage`);
    expect(row('Vaporize')).toContain(`${dmg} damage`);
  });
});
