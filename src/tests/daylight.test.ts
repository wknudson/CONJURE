/**
 * The clock, and the one property that made it safe to add.
 *
 * Every number in `AMBIENT` was authored and then *measured* against the rendered frame over
 * three separate passes — including three occasions on which an area turned out to be near-black
 * and one on which the combat grid was found adding 212 of 255 luma to the road under it. Putting
 * a time of day over that is putting a transform over the most carefully tuned table in the
 * project, and the way to do it without throwing the measurements away is to make the authored
 * values **one hour on the clock** rather than an average of all of them.
 *
 * So the first test here is the important one: at `NIGHT_ANCHOR`, and at every other hour with no
 * daylight in it, `ambientAt` returns the authored values *exactly*. Night is not derived. Night
 * is what was measured, and the clock cannot have moved it.
 */

import { describe, expect, it } from 'vitest';
import {
  DAY_HOURS,
  NIGHT_ANCHOR,
  ambientAt,
  clockLabel,
  dayOf,
  daylightAt,
  lamplighterPost,
  lampsAt,
  lampsLitAt,
  mixHex,
  packOutAt,
  packSightAt,
  phaseAt,
  wardenGraceAt,
  wardenSightAt,
} from '../district/daylight.js';
import { AMBIENT } from '../district/look.js';
import { AREAS } from '../district/areas/index.js';

const areas = Object.keys(AMBIENT);
const luma = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

describe('night is what was measured, not what was derived', () => {
  it('hands back the authored values untouched at the anchor hour', () => {
    for (const id of areas) {
      const authored = AMBIENT[id]!;
      const { day, ...bare } = authored;
      void day;
      expect(ambientAt(authored, NIGHT_ANCHOR), id).toEqual(bare);
    }
  });

  it('does the same at every dark hour, not just the anchor', () => {
    // The anchor is one in the morning, and the small hours run either side of it. Nothing
    // between dusk and dawn may differ by a digit from the table three lighting passes agreed on.
    for (const hour of [21, 22, 23, 0, 1, 2, 3, 3.9]) {
      for (const id of areas) {
        const { day, ...bare } = AMBIENT[id]!;
        void day;
        expect(ambientAt(AMBIENT[id]!, hour), `${id} at ${hour}`).toEqual(bare);
      }
    }
  });

  it('never mutates the table it was handed', () => {
    // `AMBIENT` is bound live by the tuning panel. A transform that wrote through it would mean
    // walking around at noon permanently rewrote the authored night.
    const before = JSON.stringify(AMBIENT.ashfall_ward);
    ambientAt(AMBIENT.ashfall_ward!, 12);
    expect(JSON.stringify(AMBIENT.ashfall_ward)).toBe(before);
  });
});

describe('the curve', () => {
  it('is flat dark at night and flat light at noon', () => {
    expect(daylightAt(2)).toBe(0);
    expect(daylightAt(23)).toBe(0);
    expect(daylightAt(12)).toBe(1);
    expect(daylightAt(9)).toBe(1);
  });

  it('rises through dawn and falls through dusk, without a step in it', () => {
    let last = -1;
    for (let h = 4; h <= 7; h += 0.25) {
      const now = daylightAt(h);
      expect(now, `dawn goes backwards at ${h}`).toBeGreaterThanOrEqual(last);
      last = now;
    }
    last = 2;
    for (let h = 17; h <= 20; h += 0.25) {
      const now = daylightAt(h);
      expect(now, `dusk goes forwards at ${h}`).toBeLessThanOrEqual(last);
      last = now;
    }
  });

  it('wraps, so an hour past midnight is not an hour before the world began', () => {
    expect(daylightAt(-1)).toBe(daylightAt(23));
    expect(daylightAt(25)).toBe(daylightAt(1));
    expect(daylightAt(DAY_HOURS + 12)).toBe(daylightAt(12));
  });

  it('names the four phases where they belong', () => {
    expect(phaseAt(2)).toBe('night');
    expect(phaseAt(5)).toBe('dawn');
    expect(phaseAt(12)).toBe('day');
    expect(phaseAt(18)).toBe('dusk');
    expect(phaseAt(22)).toBe('night');
  });

  it('reads the hour back as a clock', () => {
    expect(clockLabel(0)).toBe('00:00');
    expect(clockLabel(13.5)).toBe('13:30');
    expect(clockLabel(NIGHT_ANCHOR)).toBe('01:00');
    expect(clockLabel(25)).toBe('01:00');
  });
});

describe('the lamps, which are the point of having a clock', () => {
  it('burns them through the night and puts them out at noon', () => {
    expect(lampsAt(1)).toBe(1);
    expect(lampsAt(12)).toBe(0);
  });

  it('lags the sun at both ends, because somebody is walking the row', () => {
    // The lamplighter's whole job. They are lit before the light has entirely gone and are still
    // up for the first of the morning, which is the only thing in the world that shows a person
    // keeping to a schedule.
    expect(lampsAt(7), 'still up at seven, though the sun is fully up').toBeGreaterThan(0);
    expect(daylightAt(7), 'and the sun is fully up').toBe(1);
    expect(lampsAt(19.5), 'lit before dusk has finished').toBeGreaterThan(0);
    expect(daylightAt(19.5), 'while there is still light').toBeGreaterThan(0);
  });

  it('never goes negative or past full', () => {
    for (let h = 0; h < DAY_HOURS; h += 0.1) {
      const k = lampsAt(h);
      expect(k, `at ${h}`).toBeGreaterThanOrEqual(0);
      expect(k, `at ${h}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('day, and the six places the general answer is wrong about', () => {
  it('is never dimmer than night, anywhere, in any term', () => {
    // The one thing a day may not be. Caught the Caldera: it is authored at an ambient of 5.8,
    // *above* the common daylight level, because its crater floor is a light source and the
    // night had to account for that -- so blending toward 5.4 made noon dimmer than midnight.
    // `dayOf` floors every intensity at the night value now.
    for (const id of areas) {
      const night = AMBIENT[id]!;
      const noon = ambientAt(night, 12);
      expect(noon.sunIntensity, `${id} sun`).toBeGreaterThanOrEqual(night.sunIntensity);
      expect(noon.ambientIntensity, `${id} ambient`).toBeGreaterThanOrEqual(night.ambientIntensity);
    }
  });

  it('is brighter than night everywhere, taken together', () => {
    // Loosened from "every term" for exactly one place, and the loosening is the content: the
    // Caldera's ambient does not rise at noon because a crater lit by its own floor does not care
    // what the sky is doing. Its sun does, and its air does, so the place still reads as daytime.
    for (const id of areas) {
      const night = AMBIENT[id]!;
      const noon = ambientAt(night, 12);
      const total = (a: { sunIntensity: number; ambientIntensity: number; fogColor: string }) =>
        a.sunIntensity + a.ambientIntensity + luma(a.fogColor) / 20;
      expect(total(noon), `${id} does not read as day at all`).toBeGreaterThan(total(night));
    }
  });

  it('lifts the fog colour everywhere, which is the one that actually does the work', () => {
    // The rule three lighting passes established the hard way: fog colour is a **ceiling** on
    // brightness. Weeping Stile was given 2.4x more light and moved from a mean of 23 to 38;
    // lightening its `fogColor` is what fixed it. A day that raised the lights and left the fog
    // would be a brighter lamp inside the same grey box.
    for (const id of areas) {
      const night = AMBIENT[id]!;
      const noon = ambientAt(night, 12);
      expect(luma(noon.fogColor), `${id} fog is no lighter by day`).toBeGreaterThan(
        luma(night.fogColor),
      );
    }
  });

  it('narrows the spread rather than widening it, because there is one sun', () => {
    // The correction this transform needed, and it is only visible across the whole table. The
    // first version *multiplied* the authored night, which amplifies whatever spread it had: the
    // Tallow Levels and Saltglass are authored at 3.6 and 1.3 because one has dark marsh
    // underfoot and the other has salt, and scaling both by 2.4 put noon at 8.6 against 2.1 --
    // a four-fold difference in how brightly the sun shines on two fields ten miles apart.
    //
    // Blending toward a common daylight compresses instead. What differs between two places at
    // noon is what stands between the sun and the ground, which is what the table describes.
    const nights = areas.map((id) => AMBIENT[id]!.sunIntensity);
    const noons = areas.map((id) => ambientAt(AMBIENT[id]!, 12).sunIntensity);
    const spread = (xs: number[]): number => Math.max(...xs) / Math.min(...xs);
    expect(spread(noons), 'noon is more varied than night').toBeLessThan(spread(nights));
  });

  it('leaves no area lit like a different world from its neighbours', () => {
    // Excluding the ones that say for themselves that they are unusual. What is left should read
    // as one sky over one country.
    const ordinary = areas.filter((id) => !AMBIENT[id]!.day);
    const noons = ordinary.map((id) => ambientAt(AMBIENT[id]!, 12).sunIntensity);
    expect(Math.max(...noons) / Math.min(...noons), 'one sky').toBeLessThan(1.5);
  });

  it('only ever holds a place back, never pushes it up', () => {
    // The rule an override exists for, stated rather than listed -- and it caught four that were
    // no longer earning their place. The overrides were first written against a transform that
    // *multiplied* the authored night; switching to a blend toward one common daylight already
    // did what four of the six were for, and two of them had quietly become pushes *upward*
    // rather than holds. An override that raises a value is the transform being overruled by a
    // number nobody has looked at since.
    for (const id of areas) {
      const night = AMBIENT[id]!;
      if (!night.day) continue;
      const { day, ...bare } = night;
      const general = dayOf(bare);
      if (day!.sunIntensity !== undefined) {
        expect(day!.sunIntensity, `${id} raises its own sun`).toBeLessThan(general.sunIntensity);
      }
      if (day!.ambientIntensity !== undefined) {
        expect(day!.ambientIntensity, `${id} raises its own ambient`).toBeLessThan(
          general.ambientIntensity,
        );
      }
    }
  });

  it('still holds the two brightest grounds in the game well down', () => {
    // Salt at 184 of 255 and snow at 140 are the two that would clip, and they are the two the
    // measured passes flagged. A thing you squint at on a screen is a white rectangle.
    for (const id of ['saltglass', 'rimefields']) {
      const night = AMBIENT[id]!;
      const { day, ...bare } = night;
      void day;
      expect(ambientAt(night, 12).sunIntensity, `${id} at noon`).toBeLessThan(
        dayOf(bare).sunIntensity * 0.6,
      );
    }
  });

  it('leaves the rest to the transform', () => {
    const overridden = areas.filter((id) => AMBIENT[id]!.day);
    expect(overridden.length, 'a handful, not a second table').toBeLessThanOrEqual(8);
    expect(overridden.length, 'but the unusual places do say so').toBeGreaterThanOrEqual(3);
  });

  it('keeps every area declaring a day that is a real ambience', () => {
    for (const id of areas) {
      const noon = dayOf(AMBIENT[id]!);
      expect(noon.sunIntensity, `${id}`).toBeGreaterThan(0);
      expect(noon.ambientIntensity, `${id}`).toBeGreaterThan(0);
      expect(noon.fogDensity, `${id}`).toBeGreaterThan(0);
      for (const hex of [noon.sunColor, noon.skyColor, noon.groundBounce, noon.fogColor]) {
        expect(hex, `${id} produced a malformed colour`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('gives every walkable area an ambience to have a day of', () => {
    // `ambientFor` falls back to Ashfall's rather than failing, which is how five Wildlands areas
    // once shipped wearing a ward's lighting. The clock doubles what a missing entry costs.
    for (const area of AREAS) {
      expect(AMBIENT[area.id], `${area.id} has no ambience of its own`).toBeDefined();
    }
  });
});

describe('the colour mix', () => {
  it('returns each end exactly', () => {
    expect(mixHex('#102030', '#a0b0c0', 0)).toBe('#102030');
    expect(mixHex('#102030', '#a0b0c0', 1)).toBe('#a0b0c0');
  });

  it('lands between them, and stays a colour', () => {
    const mid = mixHex('#000000', '#ffffff', 0.5);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
    expect(luma(mid)).toBeGreaterThan(100);
    expect(luma(mid)).toBeLessThan(155);
  });

  it('pads a channel that rounds to a single digit', () => {
    // `toString(16)` on a small number drops leading zeroes, and a five-character hex is a colour
    // three.js reads as something else entirely.
    expect(mixHex('#000000', '#000102', 1)).toBe('#000102');
    expect(mixHex('#000000', '#000000', 0.5)).toBe('#000000');
  });
});

describe('the curfew: what the hour does to the things hunting you', () => {
  it('costs a pack far more sight than it costs a Warden', () => {
    // The asymmetry is the design. A gutter crew at two in the morning is going by sound and
    // shapes; the Magistracy is funded, its officers carry a lamp, and the ward's forty-one
    // lamps are lit for them as much as for anybody. Night should be a different problem for
    // each, not a uniformly easier one.
    const packLoss = 1 - packSightAt(1);
    const wardenLoss = 1 - wardenSightAt(1);
    expect(packLoss, 'a pack loses more of its sight after dark').toBeGreaterThan(wardenLoss * 1.5);
  });

  it('gives both of them all of it at noon', () => {
    expect(packSightAt(12)).toBe(1);
    expect(wardenSightAt(12)).toBe(1);
    expect(wardenGraceAt(12)).toBe(1);
  });

  it('shortens the Warden grace after dark, which is the one thing that gets worse', () => {
    // `curfew_breakers` has been in the campaign since Wave 1 and the world has never had a
    // night-time rule to break. Being off the pavement after dark is the offence now: they see
    // you later and they act sooner, so night is genuinely a different problem rather than a
    // softer one.
    expect(wardenGraceAt(1), 'less time to get back on the flags').toBeLessThan(1);
    expect(wardenGraceAt(1)).toBeLessThan(wardenGraceAt(12));
  });

  it('never blinds anything completely, at any hour', () => {
    // A pack that could not see at all would be scenery, and Sidewalk Immunity would stop being
    // the thing that keeps you alive off the flags -- because nothing would be looking.
    for (let h = 0; h < DAY_HOURS; h += 0.25) {
      expect(packSightAt(h), `pack at ${h}`).toBeGreaterThan(0.5);
      expect(wardenSightAt(h), `warden at ${h}`).toBeGreaterThan(0.5);
      expect(wardenGraceAt(h), `grace at ${h}`).toBeGreaterThan(0.5);
    }
  });
});

describe('who is out, and when', () => {
  it('leaves an unscheduled crew out at every hour', () => {
    for (let h = 0; h < DAY_HOURS; h += 0.5) {
      expect(packOutAt(undefined, h), `at ${h}`).toBe(true);
      expect(packOutAt('any', h), `at ${h}`).toBe(true);
    }
  });

  it('puts the night crews out at night and the day crew out by day', () => {
    expect(packOutAt('night', 1)).toBe(true);
    expect(packOutAt('night', 12)).toBe(false);
    expect(packOutAt('day', 12)).toBe(true);
    expect(packOutAt('day', 1)).toBe(false);
  });

  it('overlaps them at the edges rather than leaving a gap', () => {
    // The bug the overlap prevents: an hour when nothing is out anywhere reads as an empty world
    // rather than as a quiet one. A crew does not vanish at the stroke of dawn either.
    for (let h = 0; h < DAY_HOURS; h += 0.25) {
      const anyone = packOutAt('night', h) || packOutAt('day', h);
      expect(anyone, `nothing at all is out at ${h}`).toBe(true);
    }
  });

  it('keeps every scheduled crew reachable, so no pack is unfightable', () => {
    // A pack nobody can ever meet is an encounter, a bounty and a hunt entry that exist as data
    // only -- and one of them is the target of an errand.
    for (const area of AREAS) {
      for (const pack of area.props.packs ?? []) {
        const hours = [...Array(48)].map((_, i) => i / 2);
        expect(
          hours.some((h) => packOutAt(pack.hours, h)),
          `${pack.encounterId} is never out`,
        ).toBe(true);
      }
    }
  });

  it('still leaves somewhere to fight at any hour of the day', () => {
    // Between them the world's eight crews must cover the clock. A player who wants a fight at
    // four in the afternoon should not find every road in Azo empty.
    for (let h = 0; h < DAY_HOURS; h += 0.5) {
      const out = AREAS.flatMap((a) => a.props.packs ?? []).filter((p) => packOutAt(p.hours, h));
      expect(out.length, `nothing is roaming anywhere at ${h}`).toBeGreaterThan(0);
    }
  });
});

describe('the lamplighter walks the row', () => {
  const ROW = 7; // Lamprow's High Street, seven lamps in a straight line

  it('has none lit by day and all of them lit at night', () => {
    expect(lampsLitAt(12, ROW)).toBe(0);
    expect(lampsLitAt(1, ROW)).toBe(ROW);
  });

  it('lights them one at a time rather than dimming them together', () => {
    // The cause rather than the look, and the whole point of the pass. Nothing dims a gas lamp:
    // what changes over an evening is how many of them somebody has got to yet. Walking dusk in
    // small steps should produce every count between none and all.
    const counts = new Set<number>();
    for (let h = 16.5; h <= 21; h += 0.05) counts.add(lampsLitAt(h, ROW));
    for (let i = 0; i <= ROW; i++) {
      expect(counts.has(i), `dusk never had exactly ${i} lamps lit`).toBe(true);
    }
  });

  it('only ever goes one way through an evening', () => {
    // A count that went up and down would be a man lighting a lamp and going back to put it out.
    let last = lampsLitAt(16, ROW);
    for (let h = 16; h <= 21; h += 0.05) {
      const now = lampsLitAt(h, ROW);
      expect(now, `the row went backwards at ${h}`).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it('goes out the other way through a morning', () => {
    let last = lampsLitAt(4, ROW);
    for (let h = 4; h <= 9; h += 0.05) {
      const now = lampsLitAt(h, ROW);
      expect(now, `the row relit at ${h}`).toBeLessThanOrEqual(last);
      last = now;
    }
  });

  it('puts him at the next lamp he has to deal with', () => {
    // One formula for both halves of the day: the count climbs through the evening and falls
    // through the morning, so he walks up the street and back down it without either direction
    // being written down anywhere.
    expect(lamplighterPost(0, ROW), 'start of the evening, at the first').toBe(0);
    expect(lamplighterPost(3, ROW), 'halfway along').toBe(3);
    expect(lamplighterPost(ROW, ROW), 'done, and standing at the far end').toBe(ROW - 1);
  });

  it('never sends him to a lamp that is not there', () => {
    for (let n = -2; n <= ROW + 2; n++) {
      const i = lamplighterPost(n, ROW);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(ROW);
    }
  });

  it('leaves a ward with no lamps alone rather than dividing by it', () => {
    expect(lampsLitAt(1, 0)).toBe(0);
    expect(lamplighterPost(0, 0)).toBe(0);
  });

  it('is still working into the dark, and has not started at first light', () => {
    // The lag `lampsAt` puts on the sun, doing exactly what it was for -- and my first version of
    // this test asserted the opposite and was wrong. He does not finish before dusk is over: he
    // starts as the light goes and is still on the last few after full dark (five of seven at
    // 20:00, all seven by 21:00), which is what somebody walking a row actually does.
    //
    // The same at the other end. Dawn breaks at 04:00 and the row is still fully lit at 05:00 --
    // nobody puts a street out while it is still dark to save an hour of gas.
    expect(lampsLitAt(19, ROW), 'started, well into it').toBeGreaterThan(0);
    expect(lampsLitAt(20, ROW), 'and not finished when dusk ends').toBeLessThan(ROW);
    expect(lampsLitAt(21, ROW), 'finished an hour into the dark').toBe(ROW);

    expect(lampsLitAt(5, ROW), 'untouched an hour into dawn').toBe(ROW);
    expect(lampsLitAt(8, ROW), 'and out an hour into full light').toBe(0);
  });
});
