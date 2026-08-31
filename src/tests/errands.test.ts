/**
 * The errands: that every one of them points at somebody who exists, somewhere you can stand,
 * and pays for the walk it asks for.
 *
 * An errand is the first thing in this game that names a **townsperson**, and a townsperson is
 * a string in an area file. There is no compiler between `'millharrow:millharrow_miller'` and
 * the miller — so a typo is not an error, it is an errand that can never be offered and a
 * dialogue nobody ever sees. Every id here is resolved against the world.
 *
 * The other half is the conversation state machine, which is small, has four branches, and is
 * asked the same question from four different places in `DistrictScreen`. Four branches is
 * exactly the size where a wrong one looks right in review.
 */

import { describe, expect, it } from 'vitest';
import {
  ERRANDS,
  NO_ERRANDS,
  activeErrand,
  cullSatisfiedBy,
  errandById,
  errandFor,
  errandMarker,
  errandObjective,
  isOffered,
  type ErrandState,
} from '../district/errands.js';
import { AREAS, areaById } from '../district/areas/index.js';
import { isWalkable } from '../district/map.js';
import { ColliderSet } from '../district/collision.js';
import { DRESSING } from '../district/dressing.js';
import { BUFF_IDS } from '../core/overworld/state.js';
import { reagentById } from '../core/data/splicing.js';

/** `${areaId}:${npcId}` for everybody standing in the world. */
const CAST = new Set(
  AREAS.flatMap((a) => (a.props.npcs ?? []).map((n) => `${a.id}:${n.id}`)),
);

/** Every pack roaming anywhere, by the encounter walking into it starts. */
const PACKS = new Set(AREAS.flatMap((a) => (a.props.packs ?? []).map((p) => p.encounterId)));

/**
 * How many crossings from Ashfall each area is, by breadth-first search over the exits.
 *
 * Used to check that pay tracks distance. Computed rather than authored, because the answer
 * changes the moment somebody opens a new crossing — and an authored table would then be
 * quietly wrong about the one thing it exists to say.
 */
const DEPTH: ReadonlyMap<string, number> = (() => {
  const out = new Map<string, number>([['ashfall_ward', 0]]);
  let edge = ['ashfall_ward'];
  while (edge.length > 0) {
    const next: string[] = [];
    for (const id of edge) {
      for (const exit of areaById(id)?.exits ?? []) {
        if (out.has(exit.to)) continue;
        out.set(exit.to, out.get(id)! + 1);
        next.push(exit.to);
      }
    }
    edge = next;
  }
  return out;
})();

const state = (over: Partial<ErrandState> = {}): ErrandState => ({ ...NO_ERRANDS, ...over });

describe('every errand points at something real', () => {
  it('is given by somebody who is standing in the world', () => {
    for (const e of ERRANDS) {
      expect(CAST.has(e.giver), `${e.id}: nobody called ${e.giver}`).toBe(true);
    }
  });

  it('delivers to somebody who is standing in the world', () => {
    for (const e of ERRANDS) {
      if (e.step.kind !== 'deliver') continue;
      const who = `${e.step.toArea}:${e.step.toNpc}`;
      expect(CAST.has(who), `${e.id}: nobody called ${who}`).toBe(true);
      // Delivering to the person who asked would be a conversation with itself, and
      // `errandFor` resolves the recipient branch first — so it would also never be nudged.
      expect(who, `${e.id} delivers to its own giver`).not.toBe(e.giver);
    }
  });

  it('culls a pack that is actually roaming somewhere', () => {
    for (const e of ERRANDS) {
      if (e.step.kind !== 'cull') continue;
      expect(PACKS.has(e.step.encounterId), `${e.id}: no pack ${e.step.encounterId}`).toBe(true);
    }
  });

  it('sends you somewhere you can stand', () => {
    for (const e of ERRANDS) {
      if (e.step.kind !== 'survey' && e.step.kind !== 'gather') continue;
      const area = areaById(e.step.area);
      expect(area, `${e.id}: no area ${e.step.area}`).toBeDefined();
      expect(
        isWalkable(area!, e.step.x, e.step.z),
        `${e.id}: its marker is inside a wall`,
      ).toBe(true);
      // And clear of the furniture. A cairn that spawned inside a barrel would be a prompt the
      // player can see and can never raise, which is the worst of the possible failures here.
      expect(
        new ColliderSet(area!).blocked(e.step.x, e.step.z, 0.6),
        `${e.id}: its marker is standing in something`,
      ).toBe(false);
    }
  });

  it('picks up something the world knows how to draw', () => {
    for (const e of ERRANDS) {
      if (e.step.kind !== 'gather') continue;
      expect(DRESSING[e.step.art], `${e.id}: unknown art ${e.step.art}`).toBeDefined();
      expect(e.step.label.length, `${e.id}: nothing to press`).toBeGreaterThan(0);
    }
  });

  it('is given by somebody the screen will actually ask about it', () => {
    // `DistrictScreen` routes an NPC with no `art` to `talkToVex` -- the Dispatcher is drawn
    // from the hero bearings and her script is the tutorial -- so an errand hung on her would
    // resolve, validate, and simply never be offered by anybody. Silent, and invisible in
    // review. Every giver must be a townsperson off a sheet.
    const artless = new Set(
      AREAS.flatMap((a) => (a.props.npcs ?? []).filter((n) => !n.art).map((n) => `${a.id}:${n.id}`)),
    );
    for (const e of ERRANDS) {
      expect(artless.has(e.giver), `${e.id}: ${e.giver} is not asked about errands`).toBe(false);
    }
    // And the same for a delivery's recipient, which is reached through the same lookup.
    for (const e of ERRANDS) {
      if (e.step.kind !== 'deliver') continue;
      const who = `${e.step.toArea}:${e.step.toNpc}`;
      expect(artless.has(who), `${e.id}: ${who} cannot take a delivery`).toBe(false);
    }
  });

  it('has an id nobody else has', () => {
    const ids = ERRANDS.map((e) => e.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('can be reached: no prerequisite names a job that does not exist, or itself', () => {
    for (const e of ERRANDS) {
      for (const before of e.after ?? []) {
        expect(errandById(before), `${e.id} waits on ${before}, which is not an errand`).toBeDefined();
        expect(before, `${e.id} waits on itself`).not.toBe(e.id);
      }
    }
    // And the whole set is completable in some order, which a cycle would make false.
    const done = new Set<string>();
    for (let pass = 0; pass < ERRANDS.length + 1; pass++) {
      for (const e of ERRANDS) {
        if (!done.has(e.id) && (e.after ?? []).every((id) => done.has(id))) done.add(e.id);
      }
    }
    expect([...ERRANDS].filter((e) => !done.has(e.id)).map((e) => e.id), 'unreachable').toEqual([]);
  });
});

describe('what it pays', () => {
  it('always pays something', () => {
    for (const e of ERRANDS) {
      const { ducats = 0, marrowShards = 0, reagents, brew } = e.reward;
      const anything = ducats > 0 || marrowShards > 0 || !!reagents || !!brew;
      expect(anything, `${e.id} pays nothing`).toBe(true);
    }
  });

  it('pays in currencies that exist', () => {
    for (const e of ERRANDS) {
      for (const id of Object.keys(e.reward.reagents ?? {})) {
        expect(reagentById(id), `${e.id}: no reagent ${id}`).toBeDefined();
      }
      if (e.reward.brew) {
        expect(BUFF_IDS as readonly string[], `${e.id}: no brew`).toContain(e.reward.brew);
      }
    }
  });

  it('never pays in Schematics, which is a decision and not an omission', () => {
    // The strongest reward in the game and the one gate between a rich player and the whole
    // catalogue. Errands are routine income; that must never be.
    for (const e of ERRANDS) {
      expect(Object.keys(e.reward), e.id).not.toContain('schematics');
    }
  });

  it('pays more for a longer walk', () => {
    // Not a per-errand rule -- one job can be worth more than its distance for its own reasons
    // -- but across the set the trend has to hold, or the deep country is somewhere nobody has
    // a reason to go. Measured against a hop count computed off the exits, so opening a new
    // crossing re-answers it rather than making this stale.
    const near: number[] = [];
    const far: number[] = [];
    for (const e of ERRANDS) {
      const step = e.step;
      const target =
        step.kind === 'deliver' ? step.toArea : step.kind === 'cull' ? null : step.area;
      if (!target) continue;
      const hops = DEPTH.get(target) ?? 0;
      const paid = (e.reward.ducats ?? 0) + (e.reward.marrowShards ?? 0) * 20;
      (hops >= 4 ? far : near).push(paid);
    }
    expect(near.length, 'there is near work').toBeGreaterThan(0);
    expect(far.length, 'and far work').toBeGreaterThan(0);
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(far), 'the deep country pays better').toBeGreaterThan(mean(near));
  });
});

describe('what people say', () => {
  it('gives every errand three different things to say', () => {
    for (const e of ERRANDS) {
      expect(e.offer.length, `${e.id}: nothing offered`).toBeGreaterThan(0);
      expect(e.nudge.length, `${e.id}: nothing to nudge with`).toBeGreaterThan(0);
      expect(e.thanks.length, `${e.id}: no thanks`).toBeGreaterThan(0);
      // The nudge is the one that matters. Repeating the offer verbatim is how a player ends up
      // unsure whether they took the job -- which is the exact question the nudge exists to
      // answer, and the reason it is a separate field rather than a re-read.
      expect(e.nudge[0]!.text, `${e.id}: the nudge repeats the offer`).not.toBe(e.offer[0]!.text);
    }
  });

  it('has somebody saying every line', () => {
    for (const e of ERRANDS) {
      for (const line of [...e.offer, ...e.nudge, ...e.thanks]) {
        expect(line.who.length, `${e.id}: an unattributed line`).toBeGreaterThan(0);
        expect(line.text.length, `${e.id}: an empty line`).toBeGreaterThan(0);
      }
    }
  });

  it('is thanked by the person who is owed the report', () => {
    // A delivery is turned in at the far end, so its thanks belong to the recipient and not to
    // whoever asked. Nothing enforces that but reading it, so read it: the offer and the thanks
    // must be spoken by different people.
    for (const e of ERRANDS) {
      if (e.step.kind !== 'deliver') continue;
      expect(e.thanks[0]!.who, `${e.id}: the giver thanks you for your own delivery`).not.toBe(
        e.offer[0]!.who,
      );
    }
  });
});

describe('the conversation, which is four branches and one function', () => {
  const first = ERRANDS.find((e) => !e.after && e.step.kind === 'cull')!;
  const [givenIn, givenBy] = first.giver.split(':') as [string, string];

  it('offers a job to somebody who has none', () => {
    const found = errandFor(givenIn, givenBy, NO_ERRANDS);
    expect(found?.phase).toBe('offer');
  });

  it('says nothing about errands to anybody else', () => {
    // The fall-through that keeps forty-eight townspeople exactly as they were: no errand means
    // null, and `DistrictScreen` reads their own script.
    expect(errandFor('ashfall_ward', 'ashfall_smith', NO_ERRANDS)).toBeNull();
  });

  it('nudges rather than re-offering while the job is open', () => {
    const open = state({ active: { id: first.id, ready: false } });
    expect(errandFor(givenIn, givenBy, open)?.phase).toBe('nudge');
  });

  it('takes the report once the step is done', () => {
    const open = state({ active: { id: first.id, ready: true } });
    expect(errandFor(givenIn, givenBy, open)?.phase).toBe('turnin');
  });

  it('offers nothing at all while something is open', () => {
    // The one-at-a-time rule, and the reason the panel has exactly one thing to say. Every
    // other giver in the world goes quiet.
    const open = state({ active: { id: first.id, ready: false } });
    for (const e of ERRANDS) {
      if (e.id === first.id) continue;
      const [area, npc] = e.giver.split(':') as [string, string];
      const found = errandFor(area, npc, open);
      expect(found?.phase, `${e.giver} offered a second job`).not.toBe('offer');
    }
  });

  it('takes a delivery from the far end, not from the giver', () => {
    const del = ERRANDS.find((e) => e.step.kind === 'deliver')!;
    const step = del.step as { kind: 'deliver'; toArea: string; toNpc: string };
    const open = state({ active: { id: del.id, ready: false } });
    expect(errandFor(step.toArea, step.toNpc, open)?.phase, 'the recipient').toBe('turnin');
    const [gArea, gNpc] = del.giver.split(':') as [string, string];
    expect(errandFor(gArea, gNpc, open)?.phase, 'the giver, still waiting').toBe('nudge');
  });

  it('does not offer a job twice', () => {
    const after = state({ done: [first.id] });
    expect(errandFor(givenIn, givenBy, after)).toBeNull();
  });

  it('holds the deep country back until something nearer is done', () => {
    const gated = ERRANDS.filter((e) => e.after && e.after.length > 0);
    expect(gated.length, 'something is gated').toBeGreaterThan(0);
    for (const e of gated) {
      expect(isOffered(e, NO_ERRANDS), `${e.id} is offered on turn one`).toBe(false);
      expect(isOffered(e, state({ done: [...e.after!] })), `${e.id} never opens`).toBe(true);
    }
  });
});

describe('the marker, and the objective line', () => {
  it('stands somewhere for a survey and a gather, and nowhere for a cull', () => {
    for (const e of ERRANDS) {
      const open = state({ active: { id: e.id, ready: false } });
      const marker = errandMarker(open);
      if (e.step.kind === 'survey' || e.step.kind === 'gather') {
        expect(marker?.area, `${e.id}`).toBe(e.step.area);
      } else {
        // A cull's quarry is already walking about with a vision cone on it, and a delivery's
        // target is a person. Neither wants a cairn.
        expect(marker, `${e.id} put a mark down`).toBeNull();
      }
    }
  });

  it('takes the marker away once the thing is picked up', () => {
    const gather = ERRANDS.find((e) => e.step.kind === 'gather')!;
    expect(errandMarker(state({ active: { id: gather.id, ready: false } }))).not.toBeNull();
    expect(errandMarker(state({ active: { id: gather.id, ready: true } }))).toBeNull();
  });

  it('says what to do, then says to go back', () => {
    const e = ERRANDS[0]!;
    expect(errandObjective(NO_ERRANDS)).toBeNull();
    expect(errandObjective(state({ active: { id: e.id, ready: false } }))).toBe(e.title);
    const reported = errandObjective(state({ active: { id: e.id, ready: true } }));
    expect(reported).toContain(e.title);
    expect(reported, 'and says the job is done').not.toBe(e.title);
  });

  it('survives an id that has stopped existing', () => {
    // A save can outlive an errand. `activeErrand` returning null rather than throwing is what
    // makes that a panel that goes away instead of a screen that does not open.
    const ghost = state({ active: { id: 'no_such_errand', ready: false } });
    expect(activeErrand(ghost)).toBeNull();
    expect(errandObjective(ghost)).toBeNull();
    expect(errandMarker(ghost)).toBeNull();
  });
});

describe('a cull is satisfied by the pack dying, whoever killed it', () => {
  const cull = ERRANDS.find((e) => e.step.kind === 'cull')!;
  const step = cull.step as { kind: 'cull'; encounterId: string };

  it('counts the fight the errand named', () => {
    expect(cullSatisfiedBy(state({ active: { id: cull.id, ready: false } }), step.encounterId)).toBe(
      true,
    );
  });

  it('does not count a different fight', () => {
    expect(cullSatisfiedBy(state({ active: { id: cull.id, ready: false } }), 'pack_somewhere_else')).toBe(
      false,
    );
  });

  it('does not count anything when nothing is open', () => {
    expect(cullSatisfiedBy(NO_ERRANDS, step.encounterId)).toBe(false);
  });

  it('counts a pack the ring dragged in, not only the one that started it', () => {
    // The bug this exists for, and it was a soft-lock rather than a missed payment. The Combat
    // Ring pulls in whatever is roaming nearby and `main.ts` puts every one of them on the hunt
    // clock on a win -- so the errand's pack could die inside somebody else's ambush, vanish
    // from the road for its whole cooldown, and leave the job open with nothing left to kill.
    // With one errand slot and (at the time) no way to hand one back, that locked the player
    // out of the entire system.
    const open = state({ active: { id: cull.id, ready: false } });
    expect(cullSatisfiedBy(open, 'pack_somewhere_else', step.encounterId)).toBe(true);
  });
});

describe('handing a job back', () => {
  const first = ERRANDS.find((e) => !e.after)!;
  const [area, npc] = first.giver.split(':') as [string, string];

  it('puts it straight back on offer', () => {
    // Abandoning does not touch `done`, which is the whole difference between a job you gave
    // back and a job you did. The same person offers it again next time you speak to them.
    const dropped = state({ done: [], active: null });
    expect(errandFor(area, npc, dropped)?.phase).toBe('offer');
    expect(isOffered(first, dropped)).toBe(true);
  });

  it('is not the same as finishing it', () => {
    // The distinction a `done` entry would erase. Worth pinning because "clear the slot" is the
    // obvious implementation and it is one line away from silently completing the errand.
    expect(isOffered(first, state({ done: [first.id] }))).toBe(false);
  });
});
