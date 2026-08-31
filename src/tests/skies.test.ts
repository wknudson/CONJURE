/**
 * The sky, and the one invariant that makes it affordable.
 *
 * Not to be confused with `weather.test.ts`, which is the *combat* weather — fog, gale and rain,
 * all of which change what a card can reach. This is the overworld's falling air and it changes
 * nothing at all. The two were briefly both called weather, which is how this file came to be
 * written over that one; see the header of `district/skies.ts`.
 *
 * A particle field big enough to cover the Ashwood would be tens of thousands of points, all but
 * a few dozen of them behind the player or beyond the fog. So there is one box of four hundred
 * that **rides whoever the camera is watching** — and the whole design rests on a single detail
 * that is invisible in code review and unmistakable on screen: the particles are stored as
 * offsets from the box, not as world positions.
 *
 * Get that backwards and recentring drags every flake sideways with the player. Walking east
 * blows the snow east with you, at exactly your walking speed, forever. It looks like wind. It
 * is the bug. That is what the second test here is for.
 *
 * `THREE.Points` and `BufferGeometry` are plain objects until something draws them, so all of
 * this runs under node with no renderer — the same reason `boardMesh.test.ts` can exist.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CEILING,
  EXTENT,
  SKIES,
  SKY_IDS,
  SkyField,
  fightWeatherFor,
  groundedEncounter,
  skyStrengthAt,
  FIGHT_WEATHER_FLOOR,
  isSkyId,
  skyDayOf,
} from '../district/skies.js';
import { AMBIENT } from '../district/look.js';
import { AREAS } from '../district/areas/index.js';
import type { Weather } from '../core/types/state.js';
import { ambientAt } from '../district/daylight.js';

/** A seeded roll, so a field is the same field twice and a failure is reproducible. */
function rolls(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function field(id: keyof typeof SKIES, seed = 5): SkyField {
  return new SkyField(SKIES[id], rolls(seed));
}

/** Every particle's world position, as the GPU would read it. */
function points(f: SkyField): { x: number; y: number; z: number }[] {
  const attr = f.points.geometry.getAttribute('position');
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < attr.count; i++) {
    out.push({ x: attr.getX(i), y: attr.getY(i), z: attr.getZ(i) });
  }
  return out;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);

describe('the box that rides the player', () => {
  it('starts around wherever the camera is looking', () => {
    const f = field('snow');
    f.update(0.016, new THREE.Vector3(40, 0, -25));
    for (const p of points(f)) {
      // Half the extent plus the widest drift any kind carries, which is what a mote is allowed
      // to wander outside the box it belongs to.
      expect(Math.abs(p.x - 40)).toBeLessThan(EXTENT / 2 + 3);
      expect(Math.abs(p.z + 25)).toBeLessThan(EXTENT / 2 + 3);
    }
    f.dispose();
  });

  it('does not drag the weather along with the player', () => {
    // The invariant this file exists for. Recentring writes the box's centre and leaves the
    // offsets alone, so a flake's position *relative to the player* is unchanged by walking —
    // the flake keeps falling where it was falling and the player moves under it. Stored as
    // world positions instead, every flake would move exactly as far as the player did, which
    // reads as the whole sky sliding sideways at walking pace.
    const f = field('ash');
    f.update(0, ORIGIN);
    const before = points(f).map((p) => ({ x: p.x, z: p.z }));

    // Moved, with no time passing at all: nothing may have fallen, so any change is the
    // recentring and nothing else.
    f.update(0, new THREE.Vector3(30, 0, 30));
    const after = points(f).map((p) => ({ x: p.x, z: p.z }));

    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.x - before[i]!.x, `particle ${i} x`).toBeCloseTo(30, 5);
      expect(after[i]!.z - before[i]!.z, `particle ${i} z`).toBeCloseTo(30, 5);
    }
    f.dispose();
  });

  it('is never culled, because three.js cannot know where the box has got to', () => {
    // The field is moved by writing vertex positions, which three.js does not watch. Left to
    // frustum-cull against a bounding sphere at the origin, the entire weather system vanishes
    // as soon as the player walks off the middle of the map — and comes back when they return.
    const f = field('snow');
    expect(f.points.frustumCulled).toBe(false);
    f.dispose();
  });
});

describe('falling', () => {
  it('wraps rather than running out', () => {
    // Nothing is respawned: a flake that reaches the floor reappears at the ceiling. Run for
    // long enough that every particle has crossed the whole height several times over.
    const f = field('drizzle');
    for (let i = 0; i < 400; i++) f.update(0.05, ORIGIN);
    for (const p of points(f)) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(CEILING);
    }
    f.dispose();
  });

  it('wraps the other way for anything that rises', () => {
    // The Caldera's embers have a negative fall, which is the reason the wrap is written in both
    // directions. A one-sided wrap would empty the crater's air over about fifteen seconds.
    const f = field('embers');
    expect(SKIES.embers.fall, 'embers rise').toBeLessThan(0);
    for (let i = 0; i < 400; i++) f.update(0.05, ORIGIN);
    for (const p of points(f)) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(CEILING);
    }
    f.dispose();
  });

  it('actually falls', () => {
    const f = field('snow');
    const before = points(f).map((p) => p.y);
    f.update(0.5, ORIGIN);
    const after = points(f).map((p) => p.y);
    // Most, not all: the handful that wrapped in that half-second went up.
    const fell = after.filter((y, i) => y < before[i]!).length;
    expect(fell / after.length).toBeGreaterThan(0.9);
    f.dispose();
  });

  it('gives drizzle no sideways wander at all', () => {
    // The one kind with `drift: 0`, and the reason the wander is skipped rather than multiplied
    // by zero: rain falls straight, and rain that swirls is snow wearing the wrong colour.
    const f = field('drizzle');
    f.update(0, ORIGIN);
    const before = points(f).map((p) => ({ x: p.x, z: p.z }));
    // Time passes, but the centre does not move -- so any x/z change would be the wander.
    for (let i = 0; i < 40; i++) f.update(0.05, ORIGIN);
    const after = points(f).map((p) => ({ x: p.x, z: p.z }));
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.x).toBeCloseTo(before[i]!.x, 6);
      expect(after[i]!.z).toBeCloseTo(before[i]!.z, 6);
    }
    f.dispose();
  });

  it('gives everything else some, so no two motes move alike', () => {
    const f = field('leaves');
    f.update(0, ORIGIN);
    const before = points(f).map((p) => p.x);
    for (let i = 0; i < 20; i++) f.update(0.05, ORIGIN);
    const after = points(f).map((p) => p.x);
    const moved = after.filter((x, i) => Math.abs(x - before[i]!) > 1e-4).length;
    expect(moved / after.length, 'the whole field wanders').toBeGreaterThan(0.95);
    // And not in step: a field on one frequency reads as a scrolled texture, which is exactly
    // what it is trying not to be.
    const deltas = after.map((x, i) => x - before[i]!);
    const spread = Math.max(...deltas) - Math.min(...deltas);
    expect(spread, 'they are not all doing the same thing').toBeGreaterThan(0.05);
    f.dispose();
  });
});

describe('the six moods', () => {
  it('are all reachable, and all say what they are', () => {
    for (const id of SKY_IDS) {
      expect(isSkyId(id), id).toBe(true);
      const kind = SKIES[id];
      expect(kind.count, `${id} has nothing in it`).toBeGreaterThan(0);
      expect(kind.note, `${id} does not say what it is for`).toBeTruthy();
      // The budget. Six hundred points is one draw call and a Float32Array write a frame;
      // six thousand is the kind of number that only shows up on the machine you are not
      // testing on, and there is no reason for one.
      expect(kind.count, `${id} is extravagant`).toBeLessThanOrEqual(700);
    }
  });

  it('counts still air as a weather, because saying nothing is a decision', () => {
    expect(isSkyId('none')).toBe(true);
    expect(isSkyId('sunshine')).toBe(false);
  });

  it('adds light only where the thing is a light', () => {
    // Embers and pollen are lit; ash, snow, rain and leaves are lit *by* something. An additive
    // raindrop on a dark street glows, which is how you get luminous drizzle.
    for (const id of SKY_IDS) {
      const f = field(id);
      const additive = f.points.material.blending === THREE.AdditiveBlending;
      expect(additive, `${id} blending`).toBe(SKIES[id].additive);
      f.dispose();
    }
  });

  it('never writes depth, so motes do not punch holes in each other', () => {
    for (const id of SKY_IDS) {
      const f = field(id);
      expect(f.points.material.depthWrite, id).toBe(false);
      expect(f.points.material.fog, `${id} must fade into the area's own haze`).toBe(true);
      f.dispose();
    }
  });
});

describe('the air reads the hour too', () => {
  const luma = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };

  /** Which area actually wears each sky, so the fog it is compared against is the real one. */
  const wearers = new Map<string, string>();
  for (const area of AREAS) {
    const sky = area.props.sky;
    if (sky && sky !== 'none' && !wearers.has(sky)) wearers.set(sky, area.id);
  }

  it('has somewhere wearing every sky, or the comparison below is fiction', () => {
    for (const id of Object.keys(SKIES)) {
      expect(wearers.get(id), `nowhere declares ${id}`).toBeDefined();
    }
  });

  it('keeps every mote visible against its own air, at both ends of the clock', () => {
    // The test this pass exists for, and it caught two real failures. `leaves` came out at a
    // daylight contrast of **six** -- a silhouetted leaf against the Ashwood's deliberately dark
    // green half-light is the same value as the air it is falling through -- and the general
    // darkening left ash and drizzle at 21 against a fog of 142, where the same flake at night
    // has 139. Technically present, practically gone, and invisible in code review because every
    // number involved looks reasonable on its own.
    for (const [id, kind] of Object.entries(SKIES)) {
      const amb = AMBIENT[wearers.get(id)!]!;
      const night = Math.abs(luma(kind.color) - luma(ambientAt(amb, 1).fogColor));
      const day = Math.abs(luma(skyDayOf(kind).color) - luma(ambientAt(amb, 12).fogColor));
      expect(night, `${id} is invisible at night`).toBeGreaterThan(40);
      expect(day, `${id} is invisible by day`).toBeGreaterThan(40);
    }
  });

  it('fades anything emissive by day, because a spark cannot compete with the sun', () => {
    // And this is why the Caldera is worth standing in after dark.
    for (const [id, kind] of Object.entries(SKIES)) {
      if (!kind.additive) continue;
      expect(skyDayOf(kind).opacity, `${id} burns as hard at noon`).toBeLessThan(0.4);
    }
  });

  it('does not fade the things that are merely lit', () => {
    for (const [id, kind] of Object.entries(SKIES)) {
      if (kind.additive) continue;
      expect(skyDayOf(kind).opacity, `${id} thins by day`).toBeGreaterThanOrEqual(0.62);
    }
  });

  it('leaves the authored colour untouched at night', () => {
    // Same convention as the ambience: every colour in `SKIES` is the night colour, so nothing in
    // the dark hours may differ from what was written down.
    for (const kind of Object.values(SKIES)) {
      const rng = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
      const field = new SkyField(kind, rng);
      field.relight({ sunColor: '#9fb2d6' }, 1);
      expect(field.points.material.color.getHexString()).toBe(kind.color.slice(1));
      field.dispose();
    }
  });

  it('takes a cast off whatever is lighting the street', () => {
    // A mote is lit by the same light as everything else, so at dawn the ash picks up the low
    // warm colour the street does. A third of the way at most -- a flake that went the whole way
    // to the sun's colour would stop being ash and start being a spark.
    const rng = (() => { let a = 3; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    const field = new SkyField(SKIES.ash, rng);
    field.relight({ sunColor: '#ff0000' }, 12);
    const tinted = field.points.material.color;
    expect(tinted.r, 'warmed by a red sun').toBeGreaterThan(tinted.b);
    field.dispose();
  });
});

describe('the ground you fight on', () => {
  /** The slice of an `EncounterDef` this cares about. */
  type Fought = { id: string; weather?: Weather };

  it('turns the two opaque skies into fog', () => {
    // Both are a thing in the air between you and what you are shooting at, which is exactly what
    // `FOG_VISION` models -- and a whiteout on the Rimefields is the best reason a sniper has
    // ever had for not reaching.
    expect(fightWeatherFor('ash')).toEqual({ kind: 'fog' });
    expect(fightWeatherFor('snow')).toEqual({ kind: 'fog' });
  });

  it('turns drizzle into rain, which is the same weather twice', () => {
    expect(fightWeatherFor('drizzle')).toEqual({ kind: 'rain' });
  });

  it('leaves the small warm ones alone', () => {
    // None of these is *between* you and anything. A crater throwing sparks does not blunt a
    // bowshot, and saying it did would be the mechanical half inventing something the visible
    // half never claimed.
    for (const sky of ['embers', 'leaves', 'pollen', 'none'] as const) {
      expect(fightWeatherFor(sky), sky).toBeUndefined();
    }
    expect(fightWeatherFor(undefined)).toBeUndefined();
  });

  it('never produces a gale, because a sky has no direction', () => {
    // A real limit rather than an oversight. A gale carries a shot *downwind*, so it needs a
    // bearing; a sky field's drift is a symmetric wander and has none. A gale stays a thing an
    // encounter declares for itself.
    for (const sky of [...SKY_IDS, 'none'] as const) {
      expect(fightWeatherFor(sky)?.kind, sky).not.toBe('gale');
    }
  });

  it('fills a weather in and never overrides one', () => {
    // The rule that keeps this safe. An encounter that declares its own has been authored and,
    // in the campaign's case, balanced against it.
    const authored = { id: 'x', weather: { kind: 'gale', wind: { x: 0, y: 1 } } } as const;
    expect(groundedEncounter(authored, 'ash'), 'the ground overruled the author').toBe(authored);

    const bare: Fought = { id: 'y' };
    expect(groundedEncounter(bare, 'ash')).toEqual({ id: 'y', weather: { kind: 'fog' } });
  });

  it('hands the encounter straight back when it has nothing to add', () => {
    // Identity, not a copy. `EncounterDef`s are shared registry objects, and copying one per
    // fight leaves two definitions of the same encounter in play that differ in a field somebody
    // will later assume is canonical.
    const bare: Fought = { id: 'z' };
    expect(groundedEncounter(bare, 'pollen')).toBe(bare);
    expect(groundedEncounter(bare, 'none')).toBe(bare);
  });

  it('never writes through the encounter it was handed', () => {
    const bare: Fought = { id: 'w' };
    groundedEncounter(bare, 'snow');
    expect(bare.weather, 'the registry was mutated').toBeUndefined();
  });

  it('fogs the city and leaves the country clear, which is what Azo is', () => {
    // The whole point, read off the world rather than asserted about the table. Every fight that
    // can start on its own ground is in a ward that is named for what falls on it, or on a road
    // where nothing does.
    const fightable = AREAS.filter(
      (a) => (a.props.packs ?? []).length > 0 || (a.props.patrols ?? []).length > 0,
    );
    expect(fightable.length, 'somewhere can start a fight').toBeGreaterThan(2);

    const fogged = fightable.filter((a) => fightWeatherFor(a.props.sky)?.kind === 'fog');
    const clear = fightable.filter((a) => !fightWeatherFor(a.props.sky));
    expect(fogged.map((a) => a.id).sort(), 'the smogged wards').toEqual(['ashfall_ward', 'lamprow']);
    expect(clear.map((a) => a.id).sort(), 'the open road').toEqual(['chalk_road', 'chalk_verge']);
  });
});

/**
 * The last thing about the sky that was still a lie.
 *
 * Every other row in this file tests a sky that is always doing what it does, and for most of the
 * project that was the point — an area declared `snow` and it snowed, which was more weather than
 * the world had before. It also meant the Rimefields had been snowing since the world was made and
 * no ward had ever had a clear night. A place you have seen once you have seen.
 */
describe('a sky that stops', () => {
  const AREA = 'rimefields';
  const noon = (d: number): number => d * 24 + 12;

  it('is nothing at all where nothing is declared', () => {
    expect(skyStrengthAt(AREA, 'none', noon(3))).toBe(0);
    expect(skyStrengthAt(AREA, undefined, noon(3))).toBe(0);
  });

  it('gives the same place the same day, however many times you walk into it', () => {
    // Not a nicety. The alternative — rolling on entry, or off a wall clock — is a sky that
    // changes every time you cross a road, which a player reads as a bug and not as weather.
    const once = skyStrengthAt(AREA, 'snow', noon(9));
    for (let i = 0; i < 20; i++) expect(skyStrengthAt(AREA, 'snow', noon(9))).toBe(once);
  });

  it('holds all day, so a clear day is actually clear', () => {
    // The first cut lerped from one midnight to the next, which put every noon exactly halfway
    // between two days: a clear day was half of yesterday's snow all afternoon, and no day was
    // ever a *kind* of day. Between the small hours the roll does not move at all.
    for (let d = 0; d < 40; d++) {
      const at = (h: number): number => skyStrengthAt(AREA, 'snow', d * 24 + h);
      const held = at(3);
      for (const h of [6, 9, 12, 15, 18, 21.5]) {
        expect(at(h), `day ${d} moved at ${h}:00`).toBeCloseTo(held, 10);
      }
    }
  });

  it('changes over in the small hours, when nobody is out to watch it', () => {
    // A sky that snapped would be worse than a constant one. It hands over across four hours
    // through midnight, and the only place the value is allowed to move is inside that window.
    for (let d = 0; d < 20; d++) {
      // 02:00 to 22:00 is the flat run, and the step has to land inside it at both ends.
      for (let h = 2.1; h < 21.7; h += 0.2) {
        const a = skyStrengthAt(AREA, 'snow', d * 24 + h);
        const b = skyStrengthAt(AREA, 'snow', d * 24 + h + 0.2);
        expect(Math.abs(a - b), `it changed at ${h.toFixed(1)}:00 on day ${d}`).toBeLessThan(1e-9);
      }
    }
  });

  it('never snaps, even at the turn', () => {
    // Four game-hours is two real minutes at the street clock's rate, so the handover is
    // something you can stand in rather than something you blink and miss.
    let worst = 0;
    for (let h = 0; h < 24 * 30; h += 0.25) {
      worst = Math.max(
        worst,
        Math.abs(skyStrengthAt(AREA, 'snow', h) - skyStrengthAt(AREA, 'snow', h + 0.25)),
      );
    }
    expect(worst, 'the sky changed its mind faster than a quarter-hour').toBeLessThan(0.15);
  });

  it('is either weather or nothing, never a hundred flakes', () => {
    // A sky at a tenth strength is not light snow, it is a renderer struggling. The roll below
    // the constancy is stretched back over a usable range, so a day it *is* falling is a day you
    // would describe as falling.
    for (const sky of SKY_IDS) {
      for (let d = 0; d < 200; d++) {
        const v = skyStrengthAt('ashwood', sky, noon(d));
        if (v > 0) expect(v, `${sky} on day ${d}`).toBeGreaterThanOrEqual(0.4);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('stops about as often as its kind says it should', () => {
    // The one number that separates the six. A crater vents whether anybody is watching; whether
    // ash falls on Ashfall depends on the wind, and some days it is off somewhere else.
    for (const sky of SKY_IDS) {
      let clear = 0;
      const n = 4000;
      for (let d = 0; d < n; d++) if (skyStrengthAt('ashfall_ward', sky, noon(d)) === 0) clear++;
      expect(clear / n, `${sky} is not stopping at its stated rate`).toBeCloseTo(
        1 - SKIES[sky].constancy,
        1,
      );
    }
  });

  it('gives every ward its own month, not one month drawn nineteen times', () => {
    // The regression that cost this feature an afternoon, kept as a test because reading the code
    // will not tell you. The first roll hashed the string `area:sky:day` with FNV-1a and took the
    // float off the top bits, which a trailing digit barely reaches: the result was weather in
    // ten-day blocks, and Bonemarket and the Cinderworks had — byte for byte — the same month.
    const month = (area: string): string =>
      Array.from({ length: 60 }, (_, d) => (skyStrengthAt(area, 'ash', noon(d)) > 0 ? '#' : '.'))
        .join('');
    const seen = new Map<string, string>();
    for (const area of AREAS) {
      const m = month(area.id);
      const twin = seen.get(m);
      expect(twin, `${area.id} and ${twin} have identical weather`).toBeUndefined();
      seen.set(m, area.id);
    }
  });

  it('does not repeat itself from one day to the next', () => {
    // The other half of the same failure: blocks. Consecutive days have to be independent, or a
    // week of snow is one roll wearing seven hats.
    let same = 0;
    const n = 500;
    for (let d = 0; d < n; d++) {
      const a = skyStrengthAt('lamprow', 'ash', noon(d)) > 0;
      const b = skyStrengthAt('lamprow', 'ash', noon(d + 1)) > 0;
      if (a === b) same++;
    }
    // Independent days agree about half the time. Blocked ones agree nearly always.
    expect(same / n, 'today is telling you what tomorrow will be').toBeLessThan(0.62);
  });
});

describe('fewer motes, not fainter ones', () => {
  it('draws a prefix of the field and leaves the rest alone', () => {
    // The whole difference between light snow and snow rendered badly. Fading the field would
    // give a sky of faint smears; cutting the draw range gives fewer flakes at full strength,
    // and because the motes are scattered independently any prefix is still a fair scatter.
    const f = field('snow');
    const all = f.points.geometry.getAttribute('position').count;
    f.setStrength(0.5);
    expect(f.points.geometry.drawRange.count).toBe(Math.round(all * 0.5));
    expect(
      (f.points.material as THREE.PointsMaterial).opacity,
      'it dimmed them instead of thinning them',
    ).toBeGreaterThan(0);
    f.dispose();
  });

  it('goes away entirely on a clear day, and costs nothing while it is gone', () => {
    const f = field('ash');
    f.setStrength(0);
    expect(f.points.visible).toBe(false);
    const before = points(f).map((p) => ({ ...p }));
    f.update(5, new THREE.Vector3(80, 0, 80));
    // Not merely invisible: not integrated either. Nothing fell and nothing recentred.
    expect(points(f)).toEqual(before);
    f.dispose();
  });

  it('comes back without being rebuilt', () => {
    const f = field('ash');
    f.setStrength(0);
    f.setStrength(1);
    expect(f.points.visible).toBe(true);
    expect(f.points.geometry.drawRange.count).toBe(
      f.points.geometry.getAttribute('position').count,
    );
    f.dispose();
  });

  it('clamps rather than trusting its caller', () => {
    const f = field('leaves');
    f.setStrength(-3);
    expect(f.points.geometry.drawRange.count).toBe(0);
    f.setStrength(9);
    expect(f.points.geometry.drawRange.count).toBe(SKIES.leaves.count);
    f.dispose();
  });
});

describe('and the fight only inherits it when it is falling', () => {
  it('leaves the air clear below the floor', () => {
    // Fog is a real cost — it shortens every sightline on the board — and charging it for a few
    // drifting flakes would be the ground overstating what the player can see out of the window.
    expect(fightWeatherFor('snow', 0)).toBeUndefined();
    expect(fightWeatherFor('snow', FIGHT_WEATHER_FLOOR - 0.01)).toBeUndefined();
    expect(fightWeatherFor('snow', FIGHT_WEATHER_FLOOR)).toEqual({ kind: 'fog' });
  });

  it('gives the Rimefields a clear fight on a clear day', () => {
    // The point of the whole change, stated as one assertion: the weather you can see is the
    // weather you fight in, *including* when there is not any.
    const bare: { id: string; weather?: Weather } = { id: 'z' };
    expect(groundedEncounter(bare, 'snow', 0)).toBe(bare);
    expect(groundedEncounter(bare, 'snow', 1)).toEqual({ id: 'z', weather: { kind: 'fog' } });
  });

  it('still never overrules an author, however hard it is coming down', () => {
    const authored = { id: 'z', weather: { kind: 'gale', wind: { x: 0, y: 1 } } } as const;
    expect(groundedEncounter(authored, 'snow', 1)).toBe(authored);
  });
});
