import { describe, expect, it } from 'vitest';
import type { GrimoireSource } from '../core/data/grimoire.js';
import {
  draftGrimoire,
  hybridPool,
  learnsBloodline,
  purePool,
  signaturePool,
  socketRefusal,
} from '../core/data/grimoire.js';
import { CARDS } from '../core/data/cards/index.js';
import { COMPANIONS, GRIMOIRE_SIZE, companionById } from '../core/data/companions.js';
import type { CardDef } from '../core/types/cards.js';
import { makeRng } from '../core/util/rng.js';

/**
 * Signature cards.
 *
 * Two beasts of one school used to draft from one shelf with four cards struck off each —
 * which left them mostly the same book. A signature is the other half of that: a card only
 * the bloodline it names can learn. These tests register purpose-built cards rather than
 * waiting on shipped ones, so the rule is pinned before any content leans on it.
 */

/** Registers a card for the rest of this file. Ids are unique per test file. */
function defineCard(def: CardDef): string {
  CARDS[def.id] = def;
  return def.id;
}

function spell(id: string, school: CardDef['school'], bloodline?: string[]): CardDef {
  return {
    id,
    name: id,
    cost: { bones: 1, marrow: 0 },
    school,
    source: 'companion',
    kind: 'spell',
    text: 'A test signature.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'target' } },
    keywords: [],
    ...(bloodline ? { bloodline } : {}),
  };
}

const IGNIS = companionById('ignis')!.grimoire;
const SALAMANDER = companionById('salamander')!.grimoire;

describe('the bloodline stamp', () => {
  it('names every species on its own Grimoire source', () => {
    // Written once, where the list is built. A species whose source did not carry its own
    // id would draft none of its signatures and nothing would say so.
    for (const c of COMPANIONS) expect(c.grimoire.bloodline, c.id).toBe(c.id);
  });
});

describe('a signature card', () => {
  it('reaches only the bloodline it names', () => {
    const id = 'test_sig_flue_draught';
    const before = draftGrimoire(makeRng(7), IGNIS, GRIMOIRE_SIZE);
    defineCard(spell(id, 'pyre', ['salamander']));
    try {
      expect(purePool(SALAMANDER).map((c) => c.id)).toContain(id);
      expect(purePool(IGNIS).map((c) => c.id)).not.toContain(id);

      // The Drake shares the salamander's school and still cannot see it, so its draw is
      // exactly what it was before the card existed.
      expect(draftGrimoire(makeRng(7), IGNIS, GRIMOIRE_SIZE)).toEqual(before);
    } finally {
      delete CARDS[id];
    }
  });

  it('is invisible to a source that belongs to nobody', () => {
    const id = 'test_sig_orphan';
    defineCard(spell(id, 'pyre', ['salamander']));
    try {
      const anonymous: GrimoireSource = { schools: ['pyre'], hybridChance: 0 };
      expect(learnsBloodline(anonymous, CARDS[id]!)).toBe(false);
      expect(purePool(anonymous).map((c) => c.id)).not.toContain(id);
      expect(hybridPool(anonymous).map((c) => c.id)).not.toContain(id);
    } finally {
      delete CARDS[id];
    }
  });

  it('can name several bloodlines at once', () => {
    const id = 'test_sig_shared';
    defineCard(spell(id, 'pyre', ['ignis', 'salamander']));
    try {
      expect(purePool(IGNIS).map((c) => c.id)).toContain(id);
      expect(purePool(SALAMANDER).map((c) => c.id)).toContain(id);
    } finally {
      delete CARDS[id];
    }
  });

  it('still needs the bloodline to speak its school', () => {
    // A signature is a narrowing, never a way round the school rule: a frost card naming
    // the salamander is a frost card a fire beast cannot cast.
    const id = 'test_sig_wrong_school';
    defineCard(spell(id, 'frost', ['salamander']));
    try {
      expect(purePool(SALAMANDER).map((c) => c.id)).not.toContain(id);
      expect(signaturePool(SALAMANDER).map((c) => c.id)).not.toContain(id);
    } finally {
      delete CARDS[id];
    }
  });
});

describe('the draft with signatures', () => {
  it('opens every book on one of the bloodline’s own', () => {
    const ids = ['test_sig_a', 'test_sig_b'];
    for (const id of ids) defineCard(spell(id, 'pyre', ['salamander']));
    try {
      expect(signaturePool(SALAMANDER).map((c) => c.id).sort()).toEqual(ids);
      for (let seed = 1; seed <= 40; seed++) {
        const book = draftGrimoire(makeRng(seed), SALAMANDER, GRIMOIRE_SIZE);
        expect(book, `seed ${seed}`).toHaveLength(GRIMOIRE_SIZE);
        expect(ids, `seed ${seed}`).toContain(book[0]);
      }
    } finally {
      for (const id of ids) delete CARDS[id];
    }
  });

  it('draws the same beast from the same seed', () => {
    const id = 'test_sig_seeded';
    defineCard(spell(id, 'pyre', ['salamander']));
    try {
      expect(draftGrimoire(makeRng(3), SALAMANDER, GRIMOIRE_SIZE)).toEqual(
        draftGrimoire(makeRng(3), SALAMANDER, GRIMOIRE_SIZE),
      );
    } finally {
      delete CARDS[id];
    }
  });

  it('leaves a bloodline with no signatures drawing exactly as it did', () => {
    // No shipped card carries a bloodline yet, so every species is in this case today —
    // and the draft rule must have moved none of them.
    for (const c of COMPANIONS) {
      expect(signaturePool(c.grimoire), c.id).toEqual([]);
      const stripped: GrimoireSource = { ...c.grimoire, bloodline: undefined };
      expect(draftGrimoire(makeRng(11), c.grimoire, GRIMOIRE_SIZE), c.id).toEqual(
        draftGrimoire(makeRng(11), stripped, GRIMOIRE_SIZE),
      );
    }
  });
});

describe('socketing a signature', () => {
  it('seats a forged signature in its own bloodline and refuses it elsewhere', () => {
    const id = 'test_sig_socket';
    defineCard(spell(id, 'pyre', ['salamander']));
    try {
      expect(socketRefusal(SALAMANDER, [id], 2, id)).toBeNull();
      expect(socketRefusal(IGNIS, [id], 2, id)).toBe('off-bloodline');
    } finally {
      delete CARDS[id];
    }
  });

  it('refuses a card wrong on both counts for the broader reason', () => {
    const id = 'test_sig_both_wrong';
    defineCard(spell(id, 'frost', ['boreas']));
    try {
      expect(socketRefusal(IGNIS, [id], 0, id)).toBe('off-school');
    } finally {
      delete CARDS[id];
    }
  });
});
