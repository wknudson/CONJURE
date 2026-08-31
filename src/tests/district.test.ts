/**
 * The ward's pure logic: the guided lap, and the grid it is walked on.
 *
 * Deliberately no three.js and no DOM here — `map.ts`, `quest.ts` and `collision.ts` were
 * split out of the screen precisely so the rules could be asked questions without a canvas.
 */

import { describe, expect, it } from 'vitest';
import type { TutorialFlag } from '../app/save.js';
import {
  LOCKED_REASON,
  bountyAvailable,
  currentObjective,
  pipStates,
  tutorialActive,
} from '../district/quest.js';
import {
  isSafeAt,
  isWalkable,
  extractRects,
  splitRun,
  tileAt,
} from '../district/map.js';
import { AREAS, ASHFALL, CHALK_ROAD, LAMPROW, areaById } from '../district/areas/index.js';
import { GROUND_TEXES } from '../district/textures.js';
import { ColliderSet } from '../district/collision.js';
import { FOLK_LINES } from '../district/dialogue.js';
import { DRESSING, DRESSING_IDS, isDressingId } from '../district/dressing.js';
import { CRITTERS, CRITTER_IDS, isCritterId } from '../district/wildlife.js';
import { isSkyId, SKIES } from '../district/skies.js';
import { FOLK_IDS, isFolkId } from '../render/folk.js';

const SPAWN = ASHFALL.spawn;
const DOORS = ASHFALL.props.doors ?? [];
const BOARD_POS = ASHFALL.props.board!;
const VEX_POS = ASHFALL.props.npcs![0]!;
const WARDEN_WAYPOINTS = ASHFALL.props.patrols![0]!;

const ALL: TutorialFlag[] = ['intro', 'artificer', 'journal', 'bounty_taken', 'complete'];

describe('the world is populated', () => {
  const cast = AREAS.flatMap((a) => (a.props.npcs ?? []).map((n) => ({ area: a.id, ...n })));

  it('uses every drawing on every sheet', () => {
    // All forty-eight, deliberately. An unused sprite is not a bug, but it is a decision, and
    // this is the line that makes dropping one a decision somebody has to take on purpose
    // rather than a thing that quietly happens while an area is edited.
    const placed = new Set(cast.map((n) => n.art).filter(Boolean));
    expect([...FOLK_IDS].filter((id) => !placed.has(id))).toEqual([]);
  });

  it('gives everybody their own name, and their own script', () => {
    // Two people can share a `says` on purpose -- a market row agreeing about the weigh-house
    // -- but nobody may share an `id`, which is what the screen keys them by.
    const ids = cast.map((n) => n.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('uses every kind of thing it knows how to build', () => {
    // The same both-ways rule the sprite sheets get. Dropping a prop kind should be a decision
    // somebody takes, not a thing that quietly happens while an area is edited.
    const placed = new Set(AREAS.flatMap((a) => (a.props.dressing ?? []).map((d) => d.kind)));
    expect([...DRESSING_IDS].filter((id) => !placed.has(id))).toEqual([]);
  });

  it('gives every area something written in it', () => {
    // Graffiti needs a wall and eleven areas had none, so the wilds get carved markers instead
    // — which is why `waystone` carries text. The rule is that every place says *something*:
    // an area with no line anywhere in it is a place the world has no opinion about.
    const mute = AREAS.filter(
      (a) =>
        (a.props.graffiti ?? []).length === 0 &&
        !(a.props.dressing ?? []).some((d) => d.kind === 'waystone' && d.text),
    );
    expect(mute.map((a) => a.id)).toEqual([]);
  });

  it('uses every animal it knows how to draw', () => {
    // The same both-ways rule the sprite sheets and the furniture get. An unused animal is not
    // a bug, but it is a decision, and this is the line that makes dropping one a decision
    // somebody takes rather than a thing that quietly happens while an area is edited.
    const placed = new Set(AREAS.flatMap((a) => (a.props.wildlife ?? []).map((w) => w.kind)));
    expect([...CRITTER_IDS].filter((id) => !placed.has(id))).toEqual([]);
  });

  it('says what the air is doing in every one of them', () => {
    // Declared rather than defaulted, and that is the whole content of this test. `'none'` and
    // "nobody got round to it" look identical in an area file and only one of them is a
    // decision -- the Bone Bastion's still air is authored, and this is what makes it possible
    // to tell that from the outside.
    for (const area of AREAS) {
      expect(area.props.sky, `${area.id} does not say what its air is doing`).toBeDefined();
      expect(isSkyId(area.props.sky!), `${area.id}: unknown weather`).toBe(true);
    }
  });

  it('uses every kind of weather it can draw', () => {
    const declared = new Set(AREAS.map((a) => a.props.sky));
    expect(Object.keys(SKIES).filter((id) => !declared.has(id as never))).toEqual([]);
  });

  it('has somebody to light every lamp in the world but two', () => {
    // The lamps used to fade together on one curve everywhere, which is the right picture drawn
    // by the wrong cause: nothing dims a gas lamp. Somewhere with lamps and nobody to light them
    // is that cause again, so this asks that every lit street have a person on it.
    const unlit = AREAS.filter((a) => (a.props.lamps ?? []).length > 0 && !a.props.lamplighter);
    expect(unlit.map((a) => a.id)).toEqual(['brays_hollow']);
  });

  it("lets Bray's Hollow off, because Old Bray already told us why", () => {
    // The one exception, and it is not an omission -- it is canon that predates the mechanic.
    // Old Bray's fixed script has always said: "Somebody puts those two lamps out every night.
    // It is not the Magistracy, and they know it." Giving the Hollow a lamplighter would be the
    // system contradicting a line the world has been saying since the townsfolk landed.
    const hollow = areaById('brays_hollow')!;
    expect(hollow.props.lamps ?? [], 'it does have lamps').toHaveLength(2);
    expect(hollow.props.lamplighter, 'and nobody who lights them').toBeUndefined();
    const bray = FOLK_LINES.brays_elder!.map((l) => l.text).join(' ');
    expect(bray, 'and says so out loud').toMatch(/lamps out every night/i);
  });

  it('leaves the Wildlands and the Chalk Road empty', () => {
    // Not an oversight, and this is where that is written down. The atlas says nothing lives
    // out here, and that the Road carries no notices because "the notices are posted where
    // somebody is accountable for them". A townsperson on the Rimefields would be the map
    // contradicting the only thing those areas exist to say.
    const uninhabited = [
      'chalk_verge',
      'chalk_road',
      'caldera',
      'ashwood',
      'rimefields',
      'storm_shelf',
      'bone_bastion',
    ];
    for (const id of uninhabited) {
      expect(areaById(id)?.props.npcs ?? [], id).toEqual([]);
    }
  });

  it('does not read that emptiness as a claim about animals', () => {
    // The line above is about *people*, and it is worth pinning that the two are different
    // claims -- because the obvious misreading of it is "these areas are empty", which is not
    // what the atlas says and would leave the seven largest maps in the game with nothing
    // moving on them. Nobody lives in the Ashwood. Things live in the Ashwood.
    for (const id of ['chalk_road', 'ashwood', 'rimefields', 'caldera', 'storm_shelf']) {
      expect((areaById(id)?.props.wildlife ?? []).length, id).toBeGreaterThan(0);
    }
  });
});

describe('the guided lap', () => {
  it('opens by pointing at the Dispatcher', () => {
    expect(currentObjective([])).toMatch(/Vex/);
    expect(tutorialActive([])).toBe(true);
  });

  it('walks the doors in the order that teaches, then the board', () => {
    expect(currentObjective(['intro'])).toMatch(/Artificer/);
    expect(currentObjective(['intro', 'artificer'])).toMatch(/Journal/);
    expect(currentObjective(['intro', 'artificer', 'journal'])).toMatch(/Bounty Board/);
  });

  it('cannot be stranded by doing things out of order', () => {
    // A Commander who finds the Journal first has still done the Journal. Every step is
    // checked by presence, so no ordering can leave the panel asking for something twice
    // or for nothing at all.
    const outOfOrder: TutorialFlag[] = ['journal', 'intro'];
    expect(currentObjective(outOfOrder)).toMatch(/Artificer/);
    expect(currentObjective(['journal', 'intro', 'artificer'])).toMatch(/Bounty Board/);
  });

  it('goes away once the lap is walked', () => {
    expect(tutorialActive(ALL)).toBe(false);
    expect(currentObjective(ALL)).toBeNull();
    expect(pipStates(ALL).every((p) => p.lit)).toBe(true);
  });

  it('lights a pip per step taken', () => {
    const pips = pipStates(['intro', 'artificer']);
    expect(pips.find((p) => p.key === 'artificer')!.lit).toBe(true);
    expect(pips.find((p) => p.key === 'journal')!.lit).toBe(false);
  });
});

describe('the board during the lap', () => {
  const affordable = true;

  it('offers the Novice contract and refuses the rest', () => {
    expect(bountyAvailable([], 'novice', false, affordable)).toBe(true);
    expect(bountyAvailable([], 'adept', false, affordable)).toBe(false);
    expect(bountyAvailable([], 'master', false, affordable)).toBe(false);
    expect(bountyAvailable([], 'novice', true, affordable)).toBe(false);
  });

  it('opens everything once the lap is done', () => {
    for (const tier of ['novice', 'adept', 'master']) {
      expect(bountyAvailable(ALL, tier, false, affordable)).toBe(true);
    }
    expect(bountyAvailable(ALL, 'novice', true, affordable)).toBe(true);
  });

  it('lifts the gate rather than trapping a player who cannot cover the stake', () => {
    // The Novice contract is the only posting with a buy-in. Someone who has lost theirs
    // would otherwise be gated to the one fight they can no longer pay for, with no way
    // to earn — so the gate opens instead of closing the last door.
    expect(bountyAvailable([], 'adept', false, false)).toBe(true);
    expect(bountyAvailable([], 'master', false, false)).toBe(true);
  });

  it('says why a contract is greyed out', () => {
    expect(LOCKED_REASON).toMatch(/Novice/);
  });
});

describe('closing the lap', () => {
  // `finishCombat` completes the tutorial whenever `tutorialActive` still reports true.
  // These pin the cases that rule has to get right, since the alternative — keying off
  // which contract was taken — is what left the panel nagging forever in the last one.

  it('closes on a resolved contract however far round the player got', () => {
    expect(tutorialActive(['bounty_taken'])).toBe(true);
    expect(tutorialActive(['intro', 'artificer', 'journal', 'bounty_taken'])).toBe(true);
  });

  it('closes for someone who ignored the Dispatcher and just went to work', () => {
    // Skipping the guided doors and taking a contract still demonstrates the loop. The
    // panel has nothing left to teach them.
    expect(tutorialActive([])).toBe(true);
  });

  it('does not fire twice', () => {
    expect(tutorialActive(ALL)).toBe(false);
    expect(tutorialActive(['bounty_taken', 'complete'])).toBe(false);
  });

  it('leaves a character from before the ward alone', () => {
    // A pre-v20 save migrates in with the whole ledger, so their next fight must not try
    // to complete a lap they were never shown.
    expect(tutorialActive(ALL)).toBe(false);
  });
});

describe('every area', () => {
  // The invariants that must hold wherever the player can walk. Written as a loop rather
  // than against Ashfall because a second area is exactly how the assumptions in here get
  // tested -- the ward was hand-checked, and hand-checking does not survive a third map.
  for (const area of AREAS) {
    describe(area.name, () => {
      it('is rectangular, and every character means something', () => {
        // `defineArea` throws on both, so reaching this test at all is most of the proof.
        // Asserted anyway: the throw happens at import, and an import error reads as "the
        // whole suite is broken" rather than as "this grid is malformed".
        expect(area.grid).toHaveLength(area.rows);
        for (const row of area.grid) expect(row).toHaveLength(area.cols);
        for (const row of area.grid) {
          for (const ch of row) expect(area.legend[ch], ch + ' in ' + area.id).toBeDefined();
        }
      });

      it('puts the player down somewhere they can stand', () => {
        expect(isWalkable(area, area.spawn.x, area.spawn.z), 'spawn').toBe(true);
      });

      it('bounds itself, so nothing walks off the edge', () => {
        expect(isWalkable(area, 0, 9999)).toBe(false);
        expect(isWalkable(area, -9999, 0)).toBe(false);
        expect(tileAt(area, 9999, 9999).walk).toBe(false);
      });

      it('lands every exit somewhere real, and clear of the way back', () => {
        for (const exit of area.exits) {
          const target = areaById(exit.to);
          expect(target, area.id + ' -> ' + exit.to).toBeDefined();
          expect(isWalkable(area, exit.x, exit.z), exit.to + ' hotspot').toBe(true);
          expect(
            isWalkable(target!, exit.arrive.x, exit.arrive.z),
            'arrival in ' + exit.to,
          ).toBe(true);

          // The rule `DoorSpec.returnZ` states in prose: arriving on top of a hotspot
          // re-raises its prompt the instant the screen mounts, so you step out of a gate
          // and are immediately invited back through it.
          const back = target!.exits.find((e) => e.to === area.id);
          if (back) {
            const d = Math.hypot(back.x - exit.arrive.x, back.z - exit.arrive.z);
            expect(d, 'arrival from ' + area.id + ' sits on the way back').toBeGreaterThan(2.6);
          }
        }
      });

      it('can be left from where it puts you down', () => {
        // The trap this caught, and the reason it is phrased as reachability rather than as
        // "the gate is in the right place": the gate mesh used to be derived as a stride
        // north of the hotspot, which is true of the ward's yard wall and false of any
        // doorway facing the other way. In the second area the wall landed between the
        // arrival tile and the way out, so you could walk in and never leave -- with no
        // error, because every individual position was perfectly legal.
        //
        // Walked rather than reasoned about: a straight line from the spawn to each exit,
        // sampled against the same collision the player is subject to.
        const set = new ColliderSet(area);
        // Every collider the world actually puts down, which this walk has never quite been.
        // Three gaps, all of them pre-existing and all of them making the test weaker than it
        // reads: the crate size was hardcoded at 1.1 while `world.ts` uses `c.size ?? 1.1`, so
        // a crate authored bigger was wider in play than in the walk; and lamps and the board
        // were simply absent, though both collide.
        for (const c of area.props.crates ?? []) {
          const w = c.size ?? 1.1;
          set.add(c.x, c.z, w, w, 'crate');
        }
        for (const l of area.props.lamps ?? []) set.add(l.x, l.z, 0.5, 0.5, 'lamp');
        if (area.props.board) set.add(area.props.board.x, area.props.board.z, 0.9, 0.5, 'board');
        for (const d of area.props.dressing ?? []) {
          const kind = DRESSING[d.kind];
          if (!kind.collides) continue;
          const size = d.size ?? kind.size;
          set.add(d.x, d.z, size, size, d.kind);
        }
        for (const exit of area.exits) {
          if (exit.gate) set.add(exit.gate.x, exit.gate.z, 8, 1.2, 'gate');
        }

        for (const exit of area.exits) {
          // A coarse flood from the spawn: if the hotspot is reachable at all, some route
          // of one-unit steps finds it.
          const key = (x: number, z: number): string => `${Math.round(x)},${Math.round(z)}`;
          const seen = new Set<string>([key(area.spawn.x, area.spawn.z)]);
          const queue = [{ x: area.spawn.x, z: area.spawn.z }];
          let found = false;
          while (queue.length > 0 && !found) {
            const at = queue.shift()!;
            if (Math.hypot(at.x - exit.x, at.z - exit.z) < 2.6) {
              found = true;
              break;
            }
            for (const [dx, dz] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ] as const) {
              const nx = at.x + dx;
              const nz = at.z + dz;
              const k = key(nx, nz);
              if (seen.has(k)) continue;
              seen.add(k);
              if (set.blocked(nx, nz, 0.4)) continue;
              queue.push({ x: nx, z: nz });
            }
          }
          expect(found, `${area.id}: cannot walk from the spawn to the ${exit.to} exit`).toBe(true);
        }
      });

      it('stands every prop on ground that exists', () => {
        for (const pk of area.props.packs ?? []) {
          expect(isWalkable(area, pk.x, pk.z), 'pack ' + pk.encounterId).toBe(true);
        }
        for (const l of area.props.lamps ?? []) {
          expect(isWalkable(area, l.x, l.z), 'lamp').toBe(true);
        }
        if (area.props.huntSignpost) {
          const at = area.props.huntSignpost;
          expect(isWalkable(area, at.x, at.z), 'signpost').toBe(true);
        }
        // NPCs were not in this list while there was one of them, standing on a tile
        // somebody had checked by eye. There are thirty-one now, placed across eleven areas
        // nobody has ever walked, and a person inside a wall is unreachable rather than
        // merely wrong -- their whole content is behind an interact prompt you cannot get
        // close enough to raise.
        for (const n of area.props.npcs ?? []) {
          expect(isWalkable(area, n.x, n.z), `${area.id}: npc ${n.id}`).toBe(true);
        }
      });

      it('puts its animals somewhere they can live', () => {
        for (const w of area.props.wildlife ?? []) {
          expect(isCritterId(w.kind), `${area.id}: unknown animal '${w.kind}'`).toBe(true);
          const kind = CRITTERS[w.kind];
          // A flying kind is homed anywhere in the map on purpose: it never touches the
          // collider set, so a rook over a chimney is a rook over a chimney. Everything with
          // legs has to start on ground a body could stand on, or it spends the whole area
          // shoved against the inside of a wall by the collider it was born in.
          if (!kind.flies) {
            expect(isWalkable(area, w.x, w.z), `${area.id}: ${w.kind} homed inside a wall`).toBe(
              true,
            );
          }
          expect(w.roam, `${area.id}: ${w.kind} with no room to wander`).toBeGreaterThan(0);
          // The bound `collision.ts` states its anti-tunnelling proof against, and it applies
          // to legs only -- which the first draft of this got wrong, and the gull failed it at
          // 3.6. Nothing that flies ever asks the collider set a question, so its speed is a
          // look decision rather than a safety one; a hare at four would be through the hedge.
          // `Critter` runs at double this when it bolts, against a `dt` clamped to 0.05, and
          // the step has to stay inside the smallest collider radius.
          if (!kind.flies) {
            expect(kind.speed, `${w.kind} is fast enough to tunnel`).toBeLessThanOrEqual(3.5);
          }
        }
      });

      it('does not put an animal inside a roaming pack', () => {
        // A hare living inside a pack's patch is a hare that spends the area being walked
        // through by three things trying to kill you. Compared patch to patch rather than
        // point to point, because neither of them stays where it was put.
        for (const w of area.props.wildlife ?? []) {
          for (const pk of area.props.packs ?? []) {
            const gap = Math.hypot(w.x - pk.x, w.z - pk.z);
            expect(
              gap,
              `${area.id}: ${w.kind} lives inside ${pk.encounterId}'s patch`,
            ).toBeGreaterThan(pk.roam);
          }
        }
      });

      it('stands its furniture where furniture can stand', () => {
        for (const d of area.props.dressing ?? []) {
          expect(isDressingId(d.kind), `${area.id}: unknown kind '${d.kind}'`).toBe(true);
          const kind = DRESSING[d.kind];
          // Only the things that stop a body have to be on walkable ground. A hoarding is
          // *supposed* to stand against a wall and an awning hangs over a stall row, so a flat
          // `isWalkable` rule here would ban exactly the placements those forms exist for.
          if (kind.collides) {
            expect(isWalkable(area, d.x, d.z), `${area.id}: ${d.kind} collides inside a wall`).toBe(
              true,
            );
          }
          // A yaw on a billboard is silently thrown away -- `faceCamera` overwrites
          // `rotation.y` every frame -- so declaring one is a mistake worth failing on rather
          // than a preference that quietly does nothing.
          if (kind.form === 'billboard') {
            expect(d.yaw, `${area.id}: ${d.kind} faces the camera; its yaw is discarded`).toBeUndefined();
          }
          if (d.kind === 'waystone') {
            expect(d.text, `${area.id}: a waystone with nothing carved on it`).toBeTruthy();
          }
        }
      });

      it('keeps its furniture out of the doorways', () => {
        // A colliding prop on a hotspot is the `ExitSpec.gate` failure again: every individual
        // coordinate is legal, and the door simply cannot be reached.
        const hotspots = [
          ...area.exits.map((e) => ({ what: `the ${e.to} exit`, x: e.x, z: e.z })),
          ...(area.props.doors ?? []).map((d) => ({ what: `the ${d.key} door`, x: d.x, z: d.z })),
        ];
        for (const d of area.props.dressing ?? []) {
          if (!DRESSING[d.kind].collides) continue;
          const size = d.size ?? DRESSING[d.kind].size;
          for (const h of hotspots) {
            expect(
              Math.hypot(d.x - h.x, d.z - h.z),
              `${area.id}: a ${d.kind} stands on ${h.what}`,
            ).toBeGreaterThan(size / 2 + 1.4);
          }
        }
      });

      it('names a lamplighter who is actually standing there, if it names one', () => {
        // A string pointing at another string, with no compiler between them -- the same silent
        // failure an errand's giver has. A misspelled id is a ward whose lamps quietly fall back
        // to fading together, which is exactly what it looked like before anybody walked the row.
        const who = area.props.lamplighter;
        if (!who) return;
        const cast = (area.props.npcs ?? []).map((n) => n.id);
        expect(cast, `${area.id}: no npc called '${who}'`).toContain(who);
        expect((area.props.lamps ?? []).length, `${area.id} has a lamplighter and no lamps`)
          .toBeGreaterThan(0);
      });

      it('gives every one of its people art, a prompt and something to say', () => {
        for (const n of area.props.npcs ?? []) {
          // No `art` means the Dispatcher, who is drawn from the hero bearings and whose
          // script is the tutorial. Exactly one such person exists and the screen special
          // cases them; anybody else without art would render as Vex's twin.
          if (!n.art) {
            expect(n.id, `${area.id}: only the Dispatcher may go without art`).toBe('vex');
            continue;
          }
          expect(isFolkId(n.art), `${area.id}: ${n.id} art '${n.art}'`).toBe(true);
          expect(n.label, `${area.id}: ${n.id} needs a prompt`).toBeTruthy();
          // The cross-file link that fails silently: a `says` with no entry gives a person
          // an interact prompt that opens an empty box.
          const key = n.says ?? n.id;
          expect(FOLK_LINES[key], `${area.id}: ${n.id} has no script under '${key}'`).toBeDefined();
          expect(FOLK_LINES[key]!.length, `${area.id}: ${n.id} script is empty`).toBeGreaterThan(0);
        }
      });

      it('keeps its people clear of each other and of the furniture', () => {
        // `NPC.interactRadius` is 2.8 and a `Hotspot`'s is 2.6. Two overlapping prompts is
        // not a cosmetic problem: the screen offers the nearest interactable, so a door
        // standing inside somebody's radius becomes a door you cannot reliably open.
        const npcs = area.props.npcs ?? [];
        for (let i = 0; i < npcs.length; i++) {
          for (let j = i + 1; j < npcs.length; j++) {
            const a = npcs[i]!;
            const b = npcs[j]!;
            expect(
              Math.hypot(a.x - b.x, a.z - b.z),
              `${area.id}: ${a.id} and ${b.id} share a prompt`,
            ).toBeGreaterThan(5.6);
          }
        }
        const hotspots = [
          ...(area.props.doors ?? []).map((d) => ({ what: 'a door', x: d.x, z: d.z })),
          ...area.exits.map((e) => ({ what: `the ${e.to} exit`, x: e.x, z: e.z })),
          ...(area.props.board ? [{ what: 'the board', ...area.props.board }] : []),
          ...(area.props.huntSignpost
            ? [{ what: 'the signpost', ...area.props.huntSignpost }]
            : []),
        ];
        for (const n of npcs) {
          for (const h of hotspots) {
            expect(
              Math.hypot(n.x - h.x, n.z - h.z),
              `${area.id}: ${n.id} stands on ${h.what}`,
            ).toBeGreaterThan(5.4);
          }
        }
      });

      it('does not stand anybody inside a roaming pack', () => {
        // A townsperson in a roam circle is a person you must walk into a fight to talk to.
        for (const n of area.props.npcs ?? []) {
          for (const pk of area.props.packs ?? []) {
            expect(
              Math.hypot(n.x - pk.x, n.z - pk.z),
              `${area.id}: ${n.id} is inside ${pk.encounterId}`,
            ).toBeGreaterThan(pk.roam);
          }
        }
      });

      it('agrees with itself about how big it is', () => {
        // The ground span was import-time constants off one global grid. If those ever
        // drift again, the paving, the collision and the baked texture stop describing the
        // same place -- silently, which is the whole reason this is here.
        expect(area.halfX).toBe((area.cols * 4) / 2);
        expect(area.halfZ).toBe((area.rows * 4) / 2);
      });

      it('paints every tile it declares', () => {
        // `TileDef.tex` is a plain string and `bakeGround` ends in a bare `else`, so a
        // misspelled paint does not fail -- it silently lays cobbles, and the first anyone
        // hears of it is a road that looks like a street. Fail where the mistake is.
        for (const [ch, def] of Object.entries(area.legend)) {
          expect(GROUND_TEXES, `'${ch}' asks for an unknown paint '${def.tex}'`).toContain(
            def.tex,
          );
        }
      });

      it('gives its Warden ground it is allowed to look at', () => {
        // Was asked of Ashfall alone, back when Ashfall was the only ward with a patrol.
        // A beat that ran along the pavement would be a beat with no teeth: the Warden may
        // never see you there, so it would spend its life somewhere it cannot do its job.
        for (const beat of area.props.patrols ?? []) {
          for (const wp of beat) {
            expect(isWalkable(area, wp.x, wp.z), `${area.id} waypoint walkable`).toBe(true);
            if (area.safety === 'sidewalk') {
              expect(isSafeAt(area, wp.x, wp.z), `${area.id} waypoint must not be pavement`).toBe(
                false,
              );
            }
          }
        }
      });

      it('has somewhere safe to put a seized player back', () => {
        // `lastSafePos` is seeded from the spawn. An area with a patrol and an unsafe spawn
        // drops a seized player onto danger ground and lets the Warden take them again on
        // the next frame.
        if ((area.props.patrols ?? []).length > 0 && area.safety === 'sidewalk') {
          expect(isSafeAt(area, area.spawn.x, area.spawn.z), `${area.id} spawn`).toBe(true);
        }
      });
    });
  }

  it('has unique ids, because a save stores one', () => {
    const ids = AREAS.map((a) => a.id);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
  });
});

describe('the Lamprow grid', () => {
  const HIGH_STREET_Z = [2, 6]; // the two rows of flags
  const KERB_Z = 8; // where they end and the Sink begins

  it('runs one unbroken safe lane from one end of the ward to the other', () => {
    // The whole reason the ward is on the map: a walkway long enough to matter, so that
    // stepping off it is a decision rather than an accident of where the paving stopped.
    for (const z of HIGH_STREET_Z) {
      for (let x = -42; x <= 34; x += 2) {
        expect(isSafeAt(LAMPROW, x, z), `the High Street breaks at (${x}, ${z})`).toBe(true);
      }
    }
  });

  it('opens onto the ward at the west end of that lane', () => {
    const back = LAMPROW.exits[0]!;
    expect(back.to).toBe('ashfall_ward');
    expect(isSafeAt(LAMPROW, back.x, back.z), 'the way out is on the flags').toBe(true);
  });

  it('puts every lamp on the flags, because the light is the safe zone', () => {
    // A lamp standing on danger ground would be the map telling a lie the rules do not back.
    for (const lamp of LAMPROW.props.lamps ?? []) {
      expect(isSafeAt(LAMPROW, lamp.x, lamp.z), `lamp at (${lamp.x}, ${lamp.z})`).toBe(true);
    }
  });

  it('keeps the Sink below the kerb, and its crews on it', () => {
    for (const spec of LAMPROW.props.packs ?? []) {
      expect(spec.z, `${spec.encounterId} should live below the flags`).toBeGreaterThan(KERB_Z);
      expect(isWalkable(LAMPROW, spec.x, spec.z)).toBe(true);
      expect(isSafeAt(LAMPROW, spec.x, spec.z)).toBe(false);
    }
  });
});

describe('the Chalk Road grid', () => {
  it('is a corridor rather than a room', () => {
    // The shape is the mechanic: a long sightline with things set in it to break the line.
    expect(CHALK_ROAD.cols).toBeGreaterThan(CHALK_ROAD.rows * 2);
  });

  it('offers no sanctioned ground at all', () => {
    expect(CHALK_ROAD.safety).toBe('none');
    for (const [ch, def] of Object.entries(CHALK_ROAD.legend)) {
      expect(def.safe, `'${ch}' claims to be safe out on the road`).toBe(false);
    }
  });

  it('never blocks the road itself', () => {
    // Waystones sit in the rows either side. The middle lane has to stay open end to end or
    // the artery is a dead end with scenery in it.
    for (let x = -58; x <= 62; x += 2) {
      expect(isWalkable(CHALK_ROAD, x, 2), `the road is blocked at x=${x}`).toBe(true);
    }
  });

  it('runs out of both ends, now that the Rimefields are walkable', () => {
    // This asserted the *opposite* until the Wildlands landed: the west end was hedge, and the
    // test said so while naming the work that would open it. A road with a wall across one end
    // is a cul-de-sac, and the Ring's whole shape depends on this one being a through route.
    expect(isWalkable(CHALK_ROAD, -62, 2), 'the west end').toBe(true);
    expect(isWalkable(CHALK_ROAD, 62, 2), 'the east end').toBe(true);
  });
});

describe('the ward grid', () => {
  it('is square and complete', () => {
    expect(ASHFALL.grid).toHaveLength(20);
    for (const row of ASHFALL.grid) expect(row).toHaveLength(20);
  });

  it('starts the player, the Dispatcher and every door on warded pavement', () => {
    // The whole guided lap has to be walkable without once stepping off the walkway.
    // Leaving it is a choice the player makes, and that is the only way the rule teaches.
    expect(isSafeAt(ASHFALL, SPAWN.x, SPAWN.z), 'spawn').toBe(true);
    // Every one of them, not just Vex. Ashfall gained a gate sentry, and the ward's whole
    // argument is that its business can be done without stepping off the flags -- one person
    // standing on danger ground is the map quietly withdrawing that promise.
    for (const npc of ASHFALL.props.npcs ?? []) {
      expect(isSafeAt(ASHFALL, npc.x, npc.z), npc.id).toBe(true);
    }
    expect(isSafeAt(ASHFALL, VEX_POS.x, VEX_POS.z), 'Vex').toBe(true);
    for (const door of DOORS) {
      expect(isSafeAt(ASHFALL, door.x, door.z), door.key).toBe(true);
      expect(isSafeAt(ASHFALL, door.x, door.returnZ), door.key + ' return').toBe(true);
    }
  });

  it('puts the bounty board within reach of the pavement', () => {
    expect(isSafeAt(ASHFALL, BOARD_POS.x, BOARD_POS.z + 2.4)).toBe(true);
  });

  it('keeps the Warden on unpaved ground, where it is allowed to look', () => {
    for (const wp of WARDEN_WAYPOINTS) {
      expect(isWalkable(ASHFALL, wp.x, wp.z), 'waypoint walkable').toBe(true);
      expect(isSafeAt(ASHFALL, wp.x, wp.z), 'waypoint must not be pavement').toBe(false);
    }
  });

  it('has somewhere legal to stand that is not pavement', () => {
    // The restore path asks "can you stand here", not "is this safe", because logging out
    // in an alley is legal and being quietly moved back to the plaza for it is not. This
    // guards the distinction the two questions rest on.
    const alley = { x: 22, z: -2 };
    expect(isWalkable(ASHFALL, alley.x, alley.z)).toBe(true);
    expect(isSafeAt(ASHFALL, alley.x, alley.z)).toBe(false);
  });

  it('keeps a guaranteed-safe fallback for the Warden to return you to', () => {
    // `lastSafePos` is seeded from the spawn whenever the restored spot is not pavement.
    // If the spawn itself were ever unsafe, a catch would drop the player straight back
    // into the cone that caught them.
    expect(isSafeAt(ASHFALL, SPAWN.x, SPAWN.z)).toBe(true);
  });

  it('bounds itself: the canal and everything off the edge are impassable', () => {
    expect(isWalkable(ASHFALL, 0, -38)).toBe(false); // the canal
    expect(isWalkable(ASHFALL, 0, 999)).toBe(false); // off the south edge
    expect(isWalkable(ASHFALL, -999, 0)).toBe(false); // off the west edge
    expect(tileAt(ASHFALL, 999, 999).walk).toBe(false);
  });

  it('reads buildings out of the map rather than beside it', () => {
    const blocks = extractRects(ASHFALL, 'B');
    expect(blocks.length).toBeGreaterThan(0);
    // Every extracted footprint must actually be impassable, or the geometry and the
    // collision would disagree about where a wall is.
    for (const r of blocks) {
      expect(ASHFALL.grid[r.row]![r.col]).toBe('B');
    }
  });

  it('extracts an oblong grid without dropping or repeating anything', () => {
    // `extractRects` allocated a square seen-map off one global GRID, which was correct
    // only for as long as every area was square. An oblong area is what proves it walks
    // rows and columns separately -- and the failure it would have had is silent.
    const verge = areaById('chalk_verge')!;
    expect(verge.cols).not.toBe(verge.rows);
    for (const char of Object.keys(verge.legend)) {
      if (!verge.legend[char]!.solid) continue;
      const rects = extractRects(verge, char);
      let tiles = 0;
      for (const r of rects) {
        tiles += r.w * r.d;
        for (let row = r.row; row < r.row + r.d; row++) {
          for (let col = r.col; col < r.col + r.w; col++) {
            expect(verge.grid[row]![col], 'covered tile is ' + char).toBe(char);
          }
        }
      }
      const inGrid = verge.grid.join('').split(char).length - 1;
      expect(tiles, char + ': covered exactly once').toBe(inGrid);
    }
  });

  it('splits long terraces so the skyline is not one slab', () => {
    expect(splitRun(6)).toEqual([
      [0, 3],
      [3, 3],
    ]);
    expect(splitRun(4)).toEqual([
      [0, 2],
      [2, 2],
    ]);
    expect(splitRun(2)).toEqual([[0, 2]]);
    // Whatever the length, the pieces tile it exactly.
    for (let len = 1; len <= 12; len++) {
      const parts = splitRun(len);
      expect(parts.reduce((a, [, w]) => a + w, 0)).toBe(len);
    }
  });
});

describe('collision', () => {
  it('slides along a wall instead of sticking to it', () => {
    const set = new ColliderSet(ASHFALL);
    // A wall running north–south just east of the spawn: thin across the direction of
    // travel, long along it, so pushing into it blocks X and leaves Z free.
    set.add(SPAWN.x + 1, SPAWN.z, 0.5, 6, 'wall');
    const pos = { x: SPAWN.x, z: SPAWN.z };
    // Pushing diagonally into it: the blocked axis is dropped, the free one still moves.
    set.move(pos, 1, 0.5);
    expect(pos.x, 'stopped by the wall').toBe(SPAWN.x);
    expect(pos.z, 'still slid along it').toBeGreaterThan(SPAWN.z);
  });

  it('will not let a body stand in the canal', () => {
    const set = new ColliderSet(ASHFALL);
    expect(set.blocked(0, -38)).toBe(true);
  });

  it('respects a disabled collider', () => {
    const set = new ColliderSet(ASHFALL);
    const box = set.add(SPAWN.x, SPAWN.z, 2, 2, 'gate');
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(true);
    box.enabled = false;
    expect(set.blocked(SPAWN.x, SPAWN.z)).toBe(false);
  });
});
