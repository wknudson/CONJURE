/**
 * What is falling out of the sky, and the one field that draws it.
 *
 * ## Why this is not called weather
 *
 * Because `core/types/state.ts` already has a `Weather`, it is a **combat** rule — fog shortens
 * every sightline on the board, a gale carries a shot downwind, rain blunts fire — and two things
 * called weather in one codebase, one of which changes what a card can reach, is a trap somebody
 * will fall into. This is the overworld's sky and it changes nothing at all: it is ash over a
 * ward that is named for it, embers off a crater floor, snow that has been falling on the
 * Rimefields since the world was made.
 *
 * The two are deliberately independent today, and that is worth being honest about rather than
 * quiet: it snows in the Rimefields and a fight started there has clear air, because nothing
 * seeds an encounter's weather from the ground it is standing on. Wiring that is the obvious next
 * move and nothing does it yet.
 *
 * The cheapest change in this pass and by a distance the largest one to how still a place feels.
 * Nineteen areas were authored with a ground, a skyline, a fog colour and a light — and above
 * all of it, nothing at all. Ashfall is named for what falls on it and none of it fell.
 *
 * ## The box rides the player
 *
 * The obvious build is a particle field covering the map, and it is wrong twice: the Ashwood is
 * thirty by twenty-six tiles, so covering it at a density you can see costs tens of thousands of
 * points, and all but a few dozen of them are behind you or beyond the fog. Instead there is one
 * box, forty units square, that **moves with whoever the camera is following** — the same trick
 * `DistrictWorld.trackSun` already uses to keep a shadow frustum useful without a map-sized one.
 * Four hundred points then cover everything anybody can see from anywhere, and a particle that
 * leaves the box wraps round to the other side rather than being allocated again.
 *
 * The wrap is on the *offset* rather than the position, which matters: recentring the box must
 * not teleport the flakes sideways, or walking would make the snow jump.
 *
 * Free of the DOM. Takes three.js, unlike `wildlife.ts` and `dressing.ts`, because unlike those
 * two it is not a registry that something else builds from — it is the thing itself, and there
 * is no second consumer for a table of drift speeds.
 */

import * as THREE from 'three';
import { DAY_HOURS, daylightAt, mixHex } from './daylight.js';
import { hashText, makeRng, nextFloat } from '../core/util/rng.js';
import type { Weather } from '../core/types/state.js';

export type SkyId = 'none' | 'ash' | 'snow' | 'embers' | 'leaves' | 'drizzle' | 'pollen';

export interface SkyKind {
  /** How many points in the box. Read against `EXTENT` below, not in the abstract. */
  readonly count: number;
  readonly color: string;
  /** Point size in world units. */
  readonly size: number;
  /** Units a second downward. Negative rises — which is what an ember does. */
  readonly fall: number;
  /** How far sideways it wanders as it goes, in units. Zero falls dead straight. */
  readonly drift: number;
  /** How fast the sideways wander cycles. A leaf turns over slowly; drizzle does not turn at all. */
  readonly sway: number;
  /** Added rather than composited. For anything that is its own light source. */
  readonly additive: boolean;
  /**
   * Roughly the share of days this sky is doing anything at all, 0 to 1.
   *
   * The one number that stops a place being the same place every time you walk into it. A crater
   * vents whether anybody is watching; whether ash falls on Ashfall depends on which way the wind
   * is off the Cinderworks, and some days it simply does not. That difference is the whole reason
   * this is per kind rather than one global rate.
   *
   * A clear night in a smogged ward should be a thing you notice.
   */
  readonly constancy: number;
  /**
   * What noon does to it, where the general answer is wrong.
   *
   * **Every colour above is the night colour** — the same convention `AmbientDef` follows, and
   * for the same reason: the night is what was authored and looked at, and the day is derived.
   * Absent means the transform below is right, which it is for five of the six.
   */
  readonly day?: { readonly color?: string; readonly opacity?: number };
  readonly note: string;
}

/**
 * What a mote looks like by day.
 *
 * Two rules, and they pull opposite ways because the two kinds of mote are lit differently.
 *
 * **Anything emissive fades.** An ember is a small hot thing competing with the sun, and at noon
 * it loses. Dropping the Caldera's embers to a fifth of their opacity is not a concession to the
 * renderer — it is the reason the crater is worth standing in after dark.
 *
 * **Anything lit from outside darkens.** This is the counter-intuitive half and it is the one that
 * matters. Ash is pale at night because it is the brightest thing in a near-black frame: the fog
 * there sits at a luma of about 40 and a `#b9b2a6` speck is unmissable. By day that same fog is at
 * 142, and the same pale speck disappears into it. Real ash is dark grey; what makes it visible
 * against a bright sky is being *darker* than the sky, not lighter. So the day colour is a
 * silhouette tone, and the flakes read as flakes at both ends of the clock.
 *
 * Snow is the exception and says so itself — see `SKIES`.
 */
/**
 * How hard this area's sky is going, right now. 0 is a clear sky.
 *
 * Rolled per **area per day** off a hash, so it is deterministic — the same place has the same
 * weather on the same day, every time, and walking out and back in does not reroll it. That
 * property matters more than it sounds: the alternative is a sky that flickers every time you
 * cross a road, which reads as a bug rather than as weather.
 *
 * The day's roll **holds flat**, and hands over to the next across a four-hour window through
 * midnight. The first cut lerped continuously from one midnight to the next, which sounds gentler
 * and is much worse: every noon sat exactly halfway between two days, so a clear day was never
 * actually clear -- it was half of yesterday's snow all afternoon. A day has to be able to *be* a
 * kind of day. The handover is what stops it snapping, and it happens in the small hours, when
 * there is nobody on the road to watch it happen.
 */
export function skyStrengthAt(areaId: string, sky: SkyId | undefined, clock: number): number {
  if (!sky || sky === 'none') return 0;
  const kind = SKIES[sky];
  // Shifted so the window straddles midnight rather than starting at it: today's weather runs
  // 02:00 to 22:00, and the four hours between are the changeover.
  const shifted = clock + HANDOVER_HOURS / 2;
  const day = Math.floor(shifted / DAY_HOURS);
  const into = shifted - day * DAY_HOURS;
  if (into >= HANDOVER_HOURS) return rollFor(areaId, kind, day);
  const k = smoothstep(into / HANDOVER_HOURS);
  return rollFor(areaId, kind, day - 1) * (1 - k) + rollFor(areaId, kind, day) * k;
}

/** How long the sky takes to change its mind. Four hours, through the middle of the night. */
export const HANDOVER_HOURS = 4;

/**
 * One day's weather for one place. Hashed rather than stored: a sky is not worth a save field.
 *
 * The mixing here is not incidental, and the first version got it wrong in a way worth recording.
 * It hashed the string `${areaId}:sky:${day}` with `hashText` and took the float straight off it.
 * FNV-1a is a perfectly good string hash, but consecutive days differ only in the final byte, and
 * the float is taken from the *top* bits -- which that byte barely reaches. The result was weather
 * in ten-day blocks, identical across areas: Bonemarket and the Cinderworks had, byte for byte,
 * the same month. That is not four wards under one sky, it is one ward drawn four times.
 *
 * So the area is hashed for its name and the day is folded in by the golden-ratio constant, and
 * the whole thing goes through `nextFloat` -- mulberry32's finalizer, which exists precisely to
 * avalanche a counter. Adjacent days now share nothing.
 */
function rollFor(areaId: string, kind: SkyKind, day: number): number {
  let salt = AREA_SALT.get(areaId);
  if (salt === undefined) {
    salt = hashText(`${areaId}:sky`);
    AREA_SALT.set(areaId, salt);
  }
  const roll = nextFloat(makeRng((salt ^ Math.imul(day, 0x9e3779b1)) >>> 0));
  // Above its constancy the sky is simply not doing anything today. Below it, the roll is
  // stretched back over a usable range -- a day it *is* snowing is never a barely-snowing day,
  // because a hundred flakes reads as a renderer struggling rather than as light snow.
  if (roll > kind.constancy) return 0;
  return 0.4 + (roll / Math.max(1e-6, kind.constancy)) * 0.6;
}

/** One FNV pass per area for the life of the process, rather than one per lookup. */
const AREA_SALT = new Map<string, number>();

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function skyDayOf(kind: SkyKind): { color: string; opacity: number } {
  const nightOpacity = kind.additive ? 0.9 : 0.62;
  const base = kind.additive
    ? { color: kind.color, opacity: nightOpacity * 0.24 }
    : { color: mixHex(kind.color, MOTE_SHADOW, 0.75), opacity: nightOpacity * 1.05 };
  return { ...base, ...(kind.day ?? {}) };
}

/**
 * What a mote lit from behind comes to. Not black: it is still in a great deal of scattered light.
 *
 * Measured rather than picked, and the first value was wrong. At `#4a4a48` blended 0.55, ash came
 * out at a luma of 121 against a daylight fog of 142 — a contrast of **21**, where the same flake
 * at night has 139. Daylight ash was technically present and practically gone. This is darker and
 * blended harder, which puts it near 79 and a contrast of 63: not a match for the night, and it
 * should not be, but a flake you can see.
 */
const MOTE_SHADOW = '#2e2e2c';

/**
 * How big the box is, in world units, and how high it stands.
 *
 * Wide enough to reach past the fog at the combat camera's pull-back, which is the furthest the
 * view ever gets. Tall enough that a flake entering at the top has a long way to fall before it
 * wraps, so nothing is ever seen popping into existence at eye level.
 */
export const EXTENT = 44;
export const CEILING = 22;

/**
 * The six moods, plus the absence of one.
 *
 * Each is written against a place rather than against a weather word: `ash` is what the
 * Cinderworks throws over the ward it is upwind of, `embers` is the Caldera lighting its own
 * air, `pollen` is farmland in the one season the Middle Ring gets. A generic `rain` and a
 * generic `snow` would have been two entries that could stand anywhere, which is the failure
 * mode the ground textures and the townsfolk scripts were both written to avoid.
 */
export const SKIES: Record<Exclude<SkyId, 'none'>, SkyKind> = {
  ash: {
    // Depends entirely on which way the wind is off the Cinderworks, and some days it
    // is off somewhere else. A clear night over Ashfall is a thing worth noticing.
    constancy: 0.6,
    count: 340,
    color: '#b9b2a6',
    size: 0.09,
    fall: 1.1,
    drift: 1.4,
    sway: 0.5,
    additive: false,
    note: 'Soft, slow, and everywhere downwind of the works. The ward is named for it.',
  },
  snow: {
    // Most days, up there. Not all of them.
    constancy: 0.75,
    count: 420,
    // The one that refuses the general rule. Snow is ice, not soot -- it does not go to
    // silhouette in daylight, it goes to a bright grey-white against a bright grey sky, which is
    // genuinely hard to see and is exactly what a snowfield at noon looks like. So the colour
    // barely moves and the opacity comes up instead, which keeps it findable without pretending
    // it is a dark object.
    day: { color: '#dfe6ee', opacity: 0.78 },
    color: '#e8f0f6',
    size: 0.12,
    fall: 1.4,
    drift: 1.8,
    sway: 0.7,
    additive: false,
    note: 'Bigger and brighter than ash, and it wanders further on the way down.',
  },
  embers: {
    // A crater vents whether anybody is watching. Very nearly always.
    constancy: 0.95,
    count: 150,
    color: '#ff8b3d',
    size: 0.1,
    fall: -1.6,
    drift: 1.1,
    sway: 1.3,
    additive: true,
    note: 'Rises rather than falls, because the ground is what is hot. Additive: it is a light.',
  },
  leaves: {
    // Wind-dependent, and the wood has only so many left to give.
    constancy: 0.7,
    count: 130,
    // The second exception, and the opposite one to snow. The Ashwood's daylight fog is
    // deliberately dark -- a wood at noon is green half-light -- so a *silhouetted* leaf in it
    // came out at a contrast of six and vanished. What a leaf actually does in a dark wood is
    // catch the light coming through the canopy, so it goes the other way: brighter than the air
    // rather than darker, which is both what you see and what reads.
    day: { color: '#c8b884' },
    color: '#8f9a5c',
    size: 0.22,
    fall: 0.8,
    drift: 2.6,
    sway: 0.35,
    additive: false,
    note: 'Few, large and slow, turning over as they go. The Ashwood, and nowhere else.',
  },
  drizzle: {
    // The most changeable thing in the world, which is what rain is.
    constancy: 0.55,
    count: 620,
    color: '#9fb4c4',
    size: 0.05,
    fall: 7.5,
    drift: 0,
    sway: 0,
    additive: false,
    note: 'Fast, fine and dead straight. The only one with no wander at all.',
  },
  pollen: {
    // Half the days, and only the still ones -- it does not hang about in a breeze.
    constancy: 0.5,
    count: 190,
    color: '#e6dc9a',
    size: 0.07,
    fall: 0.25,
    drift: 2.2,
    sway: 0.9,
    additive: true,
    note: 'Barely falls. Hangs in farmland light and catches the sun, which is why it adds.',
  },
};

/**
 * What a fight standing in this air is fought in.
 *
 * The header above says these two systems are deliberately independent and that wiring them is
 * the obvious next move. This is that move — one lookup, and it is worth being precise about what
 * it buys: **the thing you can see becomes the thing that acts.** It snows in the Rimefields and
 * a fight there had clear air; ash falls on Ashfall, which is what the ward is named for, and a
 * marksman on that street could see the length of it.
 *
 * Three of the six map, and the three that do not are not gaps:
 *
 *  - `ash` and `snow` become **fog**. Both are opaque things in the air between you and what you
 *    are shooting at, which is exactly what `FOG_VISION` models, and a whiteout on the Rimefields
 *    is the best possible reason for a sniper not to reach.
 *  - `drizzle` becomes **rain**, which is the same weather under a different name.
 *  - `embers`, `leaves` and `pollen` become nothing. They are small, sparse and warm, and none of
 *    them is between you and anything. A crater throwing sparks does not blunt a bowshot.
 *
 * **Nothing produces a gale**, and that is a real limit rather than an oversight: a gale carries a
 * shot *downwind*, so it needs a direction, and a sky field has none — its drift is a symmetric
 * wander, not a wind. Inventing a bearing here would be the mechanical half claiming something
 * the visible half never said. A gale stays a thing an encounter declares for itself.
 */
/**
 * Below this, the sky is doing something but not enough of it to matter in a fight.
 *
 * The point of the number is that a clear day in the Rimefields now produces a *clear fight*, and
 * a light fall produces one too. Fog is a real mechanical cost -- it shortens every sightline on
 * the board -- and charging it for a few drifting flakes would be the ground overstating what the
 * player can see out of the window.
 */
export const FIGHT_WEATHER_FLOOR = 0.45;

export function fightWeatherFor(sky: SkyId | undefined, strength = 1): Weather | undefined {
  if (strength < FIGHT_WEATHER_FLOOR) return undefined;
  if (sky === 'ash' || sky === 'snow') return { kind: 'fog' };
  if (sky === 'drizzle') return { kind: 'rain' };
  return undefined;
}

/**
 * An encounter as it is actually fought on this ground.
 *
 * The ground fills the weather in and **never overrides it**. An encounter that declares its own
 * has been authored, and in the campaign's case balanced against it — `weather.test.ts` holds real
 * rules about what fog does to a sightline and what a gale does to a lob — so this is a default in
 * exactly the sense `AmbientDef.day` is: the general answer applies unless the thing itself has an
 * opinion.
 *
 * Returns the encounter **unchanged** when there is nothing to add, which is not an optimisation:
 * `EncounterDef`s are shared registry objects and copying one per fight would leave two
 * definitions of the same encounter in play, differing in a field somebody will later assume is
 * canonical. Never mutates the original either way.
 */
export function groundedEncounter<T extends { weather?: Weather }>(
  encounter: T,
  sky: SkyId | undefined,
  strength = 1,
): T {
  if (encounter.weather) return encounter;
  const inherited = fightWeatherFor(sky, strength);
  return inherited ? { ...encounter, weather: inherited } : encounter;
}

export const SKY_IDS = Object.keys(SKIES) as Exclude<SkyId, 'none'>[];

export function isSkyId(id: string): id is SkyId {
  return id === 'none' || Object.prototype.hasOwnProperty.call(SKIES, id);
}

/**
 * One area's air, as a single draw call.
 *
 * `THREE.Points` rather than a sprite each: six hundred billboards would be six hundred draws
 * and six hundred matrix updates a frame to draw six hundred specks, which is the kind of cost
 * that only shows up on the machine you are not testing on.
 *
 * Depth-tested but not depth-written, so a flake in front of a wall is hidden by it and a flake
 * behind another flake does not punch a hole in it. Fogged like everything else, which is what
 * stops the field's far edge being a visible wall of specks.
 */
export class SkyField {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  /** Where the box is centred. The particles are stored as offsets from it. */
  private readonly centre = new THREE.Vector3();
  private readonly offset: Float32Array;
  /** Per-particle phase and wander rate, so nothing moves in lockstep with its neighbour. */
  private readonly phase: Float32Array;
  private clock = 0;

  constructor(
    private readonly kind: SkyKind,
    /** Seeded, so an area's weather is the same weather every time you walk into it. */
    rng: () => number,
  ) {
    const n = kind.count;
    this.offset = new Float32Array(n * 3);
    this.phase = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      this.offset[i * 3] = (rng() - 0.5) * EXTENT;
      this.offset[i * 3 + 1] = rng() * CEILING;
      this.offset[i * 3 + 2] = (rng() - 0.5) * EXTENT;
      this.phase[i * 2] = rng() * Math.PI * 2;
      // A spread rather than a single rate: a field where every mote wanders at one frequency
      // reads as a texture being scrolled, which is exactly what it is trying not to look like.
      this.phase[i * 2 + 1] = 0.6 + rng() * 0.8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    // The box moves; three.js must not decide it has left the view and stop drawing it.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), EXTENT);

    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: new THREE.Color(kind.color),
        size: kind.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: kind.additive ? 0.9 : 0.62,
        depthWrite: false,
        fog: true,
        blending: kind.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.write();
  }

  /**
   * One frame: fall, wander, wrap, and follow.
   *
   * `anchor` is whoever the camera is watching. Recentring writes the *centre* and leaves the
   * offsets alone, which is the whole reason the particles are stored as offsets: recentring a
   * box of absolute positions would drag every flake sideways with the player, and walking east
   * would blow the snow east with you.
   */
  update(dt: number, anchor: THREE.Vector3): void {
    // A clear sky costs nothing per frame. The field is still here and still seeded, so the
    // weather coming back is a `setStrength` rather than a rebuild.
    if (!this.points.visible) return;
    this.clock += dt;
    this.centre.set(anchor.x, 0, anchor.z);

    const n = this.kind.count;
    const drop = this.kind.fall * dt;
    for (let i = 0; i < n; i++) {
      let y = this.offset[i * 3 + 1]! - drop;
      // Wrapped rather than respawned, and wrapped in both directions because embers rise.
      if (y < 0) y += CEILING;
      else if (y > CEILING) y -= CEILING;
      this.offset[i * 3 + 1] = y;
    }
    this.write();
  }

  /**
   * Re-lights the field for the hour, and for the air it is falling through.
   *
   * Takes the area's *lit* ambience rather than an hour alone, because a mote is lit by whatever
   * is lighting everything else — so at dawn the ash picks up the same low warm cast the street
   * does, and in the Rimefields the snow takes a colder one. That tint is a third of the way at
   * most: a flake that went the whole way to the sun's colour would stop being ash and start
   * being a spark.
   *
   * Called from `DistrictWorld.setHour` on the same beat the lights move, which is roughly twice
   * a second rather than per frame — see `tickClock`.
   */
  relight(lit: { sunColor: string }, hour: number): void {
    const k = daylightAt(hour);
    const noon = skyDayOf(this.kind);
    const nightOpacity = this.kind.additive ? 0.9 : 0.62;

    const base = mixHex(this.kind.color, noon.color, k);
    this.points.material.color.set(mixHex(base, lit.sunColor, 0.32 * k));
    this.points.material.opacity = nightOpacity + (noon.opacity - nightOpacity) * k;
  }

  /**
   * How hard it is going, 0 to 1. See `skyStrengthAt`.
   *
   * Drawn as **fewer motes**, not dimmer ones, which is the whole difference between light snow
   * and snow rendered badly. `setDrawRange` cuts the field to a prefix of itself: one call, no
   * allocation, no buffer rewrite, and the flakes that remain are at full strength. Fading them
   * instead would give a sky of faint smears, which is not what less snow looks like.
   *
   * The particles are scattered independently, so any prefix of them is still a fair scatter over
   * the whole box -- there is no need to choose *which* to keep.
   */
  setStrength(k: number): void {
    this.strength = Math.min(1, Math.max(0, k));
    // Below this it is not a light shower, it is a dozen specks nobody would read as weather.
    this.points.visible = this.strength > 0.06;
    this.points.geometry.setDrawRange(0, Math.round(this.kind.count * this.strength));
  }

  private strength = 1;

  /** Offsets plus centre plus this instant's wander, into the buffer the GPU reads. */
  private write(): void {
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = this.kind.count;
    const { drift, sway } = this.kind;

    for (let i = 0; i < n; i++) {
      const ph = this.phase[i * 2]!;
      const rate = this.phase[i * 2 + 1]!;
      // Two axes off one phase, a quarter-turn apart, so a mote traces a slow ellipse rather
      // than sliding back and forth along one line.
      const wanderX = drift === 0 ? 0 : Math.sin(this.clock * sway * rate + ph) * drift;
      const wanderZ = drift === 0 ? 0 : Math.cos(this.clock * sway * rate * 0.8 + ph) * drift;
      arr[i * 3] = this.centre.x + this.offset[i * 3]! + wanderX;
      arr[i * 3 + 1] = this.offset[i * 3 + 1]!;
      arr[i * 3 + 2] = this.centre.z + this.offset[i * 3 + 2]! + wanderZ;
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
