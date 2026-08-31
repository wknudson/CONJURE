/**
 * What the street knows, and the four separate placeholders it closes.
 *
 * The gate itself is six lines and could hardly be wrong. What is worth testing is everything
 * *hung* on it, because all of it is strings pointing at other strings: an aside names a script
 * key that lives in another file, and a gate names a story contract that lives in a third. None
 * of those crossings is checked by a compiler, and every one of them fails the same silent way —
 * a line nobody ever sees, on a wall nobody ever reads, with a green build.
 *
 * The sharpest test here is the last one in the first block. The Census clerk's fixed script has
 * always given away the *crack* of `hollow_census` — the reveal you are supposed to walk the
 * Weeping Stile to find — to anybody who talked to her on the way past. That was not a bug
 * anybody could have seen without a way to ask "what does she know yet".
 */

import { describe, expect, it } from 'vitest';
import {
  ASIDES,
  NOTHING_HAPPENED,
  asideFor,
  gateOpen,
  type Chronicle,
} from '../district/chronicle.js';
import { FOLK_LINES } from '../district/dialogue.js';
import { STORY_CONTRACTS } from '../core/data/campaign.js';
import { AREAS } from '../district/areas/index.js';

const CONTRACTS = new Set(STORY_CONTRACTS.map((c) => c.id));
const walked = (...ids: string[]): Chronicle => ({ campaign: ids });

/** Every id any gate anywhere names — asides and graffiti alike. */
function allGateIds(): { where: string; id: string }[] {
  const out: { where: string; id: string }[] = [];
  for (const a of ASIDES) {
    for (const id of a.gate.after ?? []) out.push({ where: `aside ${a.says}`, id });
    for (const id of a.gate.before ?? []) out.push({ where: `aside ${a.says}`, id });
  }
  for (const area of AREAS) {
    for (const g of area.props.graffiti ?? []) {
      for (const id of g.gate?.after ?? []) out.push({ where: `${area.id} graffiti`, id });
      for (const id of g.gate?.before ?? []) out.push({ where: `${area.id} graffiti`, id });
    }
  }
  return out;
}

describe('the gate', () => {
  it('is open when nothing is asked of it', () => {
    expect(gateOpen(undefined, NOTHING_HAPPENED)).toBe(true);
    expect(gateOpen({}, NOTHING_HAPPENED)).toBe(true);
  });

  it('waits for everything in `after`, not just one of it', () => {
    const gate = { after: ['lamprow_tithe', 'bonemarket_vermin'] };
    expect(gateOpen(gate, NOTHING_HAPPENED)).toBe(false);
    expect(gateOpen(gate, walked('lamprow_tithe')), 'half is not enough').toBe(false);
    expect(gateOpen(gate, walked('lamprow_tithe', 'bonemarket_vermin'))).toBe(true);
  });

  it('closes the moment anything in `before` happens', () => {
    const gate = { before: ['hollow_census'] };
    expect(gateOpen(gate, NOTHING_HAPPENED)).toBe(true);
    expect(gateOpen(gate, walked('hollow_census'))).toBe(false);
  });

  it('holds a window open between the two', () => {
    // The shape neither list buys on its own, and the reason there are two of them: a line that
    // is only true for a stretch of the campaign.
    const gate = { after: ['lamprow_tithe'], before: ['the_summons'] };
    expect(gateOpen(gate, NOTHING_HAPPENED), 'too early').toBe(false);
    expect(gateOpen(gate, walked('lamprow_tithe')), 'in the window').toBe(true);
    expect(gateOpen(gate, walked('lamprow_tithe', 'the_summons')), 'too late').toBe(false);
  });

  it('ignores contracts nothing is gated on', () => {
    expect(gateOpen({ after: ['lamprow_tithe'] }, walked('lamprow_tithe', 'poster_work'))).toBe(true);
  });
});

describe('every gate points at a contract that exists', () => {
  it('names only real story contracts', () => {
    // The silent failure this whole file is for. A gate on a misspelled id is not an error --
    // it is a line that can never be true, on a wall that will never say it.
    for (const { where, id } of allGateIds()) {
      expect(CONTRACTS.has(id), `${where} waits on '${id}', which is not a contract`).toBe(true);
    }
  });

  it('gates on something, or does not exist', () => {
    for (const a of ASIDES) {
      const asks = (a.gate.after ?? []).length + (a.gate.before ?? []).length;
      expect(asks, `aside ${a.says} is gated on nothing and would always win`).toBeGreaterThan(0);
    }
  });

  it('can actually open', () => {
    // A gate naming the same contract in both lists is a line that is true never. Cheap to
    // write by accident when a window is being narrowed.
    for (const a of ASIDES) {
      const after = new Set(a.gate.after ?? []);
      for (const id of a.gate.before ?? []) {
        expect(after.has(id), `aside ${a.says} waits for and refuses '${id}'`).toBe(false);
      }
    }
  });
});

describe('every aside stands in for somebody real', () => {
  it('names a script that exists', () => {
    for (const a of ASIDES) {
      expect(FOLK_LINES[a.says], `aside for '${a.says}', who has no script`).toBeDefined();
    }
  });

  it('is spoken by somebody, and says something', () => {
    for (const a of ASIDES) {
      expect(a.lines.length, `${a.says}: an aside with no lines`).toBeGreaterThan(0);
      for (const line of a.lines) {
        expect(line.who.length, `${a.says}: an unattributed line`).toBeGreaterThan(0);
        expect(line.text.length, `${a.says}: an empty line`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the same voice as the script it replaces', () => {
    // The same person, still. An aside that changed who was speaking would read as the wrong
    // body having been handed the wrong words, which is exactly what it would be.
    for (const a of ASIDES) {
      const fixed = FOLK_LINES[a.says]!;
      expect(a.lines[0]!.who, `${a.says}: a different speaker`).toBe(fixed[0]!.who);
    }
  });

  it('says something new, rather than rephrasing', () => {
    // The rule the module header states: an aside must *answer* the line it replaces. Half these
    // fixed scripts are predictions -- the miller says something is living in the flooded end,
    // the fisherman says there will be trouble on this quay -- and the whole value of reading
    // the ledger is being able to say what happened next.
    //
    // Some, not every, line. The first draft of this asked that no line repeat at all and the
    // Census clerk failed it, correctly: her opening ("sixty-one souls on the roll") is true
    // before and after, and only her second line is the one that leaks the contract. Keeping a
    // shared opening and diverging from it is good writing. Restating the whole script is not.
    for (const a of ASIDES) {
      const fixed = new Set(FOLK_LINES[a.says]!.map((l) => l.text));
      expect(
        a.lines.some((l) => !fixed.has(l.text)),
        `${a.says}: the aside is entirely a restatement of the fixed script`,
      ).toBe(true);
    }
  });

  it('does not write two asides for one person with the same gate', () => {
    // First match wins, so a duplicate gate is a line that can never be reached.
    const seen = new Set<string>();
    for (const a of ASIDES) {
      const key = `${a.says}|${[...(a.gate.after ?? [])].sort().join(',')}|${[...(a.gate.before ?? [])].sort().join(',')}`;
      expect(seen.has(key), `${a.says}: a second aside behind the same gate`).toBe(false);
      seen.add(key);
    }
  });
});

describe('what the clerk knew, and when', () => {
  const CLERK = 'stile_census_clerk';

  it('does not give away the Stile before you have walked it', () => {
    // The bug this feature found. `hollow_census` resolves with a page torn out of the roll and
    // the count filed as PLAGUE -- and the clerk's fixed script has always opened with
    // "RELOCATED, it says beside them", to anybody who wandered past her on the way to
    // somewhere else. She has been spoiling her own contract since she was placed.
    const early = asideFor(CLERK, NOTHING_HAPPENED);
    expect(early, 'she has something else to say beforehand').not.toBeNull();
    expect(early!.some((l) => /RELOCATED/i.test(l.text)), 'and it is not the reveal').toBe(false);
  });

  it('lets her say it once it is true', () => {
    const after = asideFor(CLERK, walked('hollow_census'));
    expect(after, 'the fixed script takes over').toBeNull();
    expect(FOLK_LINES[CLERK]!.some((l) => /RELOCATED/i.test(l.text))).toBe(true);
  });
});

describe('the overlay', () => {
  it('says nothing about somebody with no aside', () => {
    // The fall-through that leaves four hundred lines of dialogue exactly as they were.
    expect(asideFor('ashfall_smith', NOTHING_HAPPENED)).toBeNull();
    expect(asideFor('ashfall_smith', walked('the_summons'))).toBeNull();
  });

  it('takes the first gate that is open', () => {
    const target = ASIDES[0]!;
    const open = walked(...(target.gate.after ?? []));
    if ((target.gate.before ?? []).length === 0) {
      expect(asideFor(target.says, open)).toEqual(target.lines);
    }
  });

  it('reaches somebody in more than one region, rather than being one ward feature', () => {
    const areas = new Set<string>();
    for (const area of AREAS) {
      for (const npc of area.props.npcs ?? []) {
        if (ASIDES.some((a) => a.says === (npc.says ?? npc.id))) areas.add(area.id);
      }
    }
    expect(areas.size, 'the ledger is heard in several places').toBeGreaterThanOrEqual(6);
  });
});

describe('the walls', () => {
  it('leaves every area something it always says', () => {
    // `district.test.ts` asks that every area says *something*; this asks that it says something
    // **unconditionally**. An area whose only line is gated is an area that is mute for most of
    // a campaign, which is the failure mode gating introduces and nothing else would catch.
    for (const area of AREAS) {
      const always =
        (area.props.graffiti ?? []).some((g) => !g.gate) ||
        (area.props.dressing ?? []).some((d) => d.kind === 'waystone' && d.text);
      expect(always, `${area.id} is mute until the campaign is walked`).toBe(true);
    }
  });

  it('keeps every painted line inside the map it is painted on', () => {
    // `world.ts` sizes the plane off the text at ~0.045 world units per pixel and
    // `makeGraffitiTexture` lays out at 11px a character, so a long sentence is a wide object:
    // the two 36-character lines in the world are over eighteen units across, four and a half
    // tiles. Nothing stops one running off the end of the ward, and nothing would tell you --
    // it would simply hang in the air past the wall, in an area nobody has looked at yet.
    for (const area of AREAS) {
      for (const g of area.props.graffiti ?? []) {
        const half = ((12 + g.text.length * 11) * 0.045) / 2;
        const centre = g.wallX + g.dx;
        expect(
          Math.abs(centre) + half,
          `${area.id}: '${g.text}' runs off the map`,
        ).toBeLessThanOrEqual(area.halfX);
      }
    }
  });

  it('puts the Spire warning on the approach, late, and nowhere else', () => {
    // Four waves of `docs/worldbuild-todo.md` asked for this. It was on Ashfall's Vivarium wall
    // from the first minute of the game -- a warning about carrying something into a Spire the
    // player has not been told wants them.
    const lines = AREAS.flatMap((a) =>
      (a.props.graffiti ?? []).map((g) => ({ area: a.id, ...g })),
    ).filter((g) => g.text === "DON'T CARRY IT IN");

    expect(lines, 'exactly one wall says it').toHaveLength(1);
    expect(lines[0]!.area, 'on the approach to the Spire').toBe('highcourt');
    expect(gateOpen(lines[0]!.gate, NOTHING_HAPPENED), 'not from turn one').toBe(false);
    expect(gateOpen(lines[0]!.gate, walked('bone_bastion')), 'the week the Summons goes up').toBe(
      true,
    );
  });
});
