/**
 * The hour, and what the world looks like at it.
 *
 * ## Azo is a night game, and that is the whole design of this file
 *
 * Every number in `AMBIENT` was authored and then *measured* against the rendered frame over
 * several passes, and read together they say what kind of place this is: Ashfall's sun is
 * `#9fb2d6`, Ward Seven's `#a3b6d2`, Highcourt's `#b6c4dc`, Lamprow's `#8c9cc2` — cool blue-grey,
 * every one of them. That is moonlight. There are forty-one gas lamps on the Lamprow High Street
 * and a lamplighter who tells you he lights them and does not own them.
 *
 * So this does **not** add a night. Night is what the game already is, and every measured value
 * survives untouched. What it adds is a **day**, derived from the authored night by one
 * documented transform, with a per-area override where the transform would lie.
 *
 * That direction matters more than it sounds. Had the authored values been treated as noon and
 * night derived from them, every one of those measurements would have become a number nobody had
 * ever looked at, and the three separate occasions on which an area turned out to be near-black
 * would have been three occasions waiting to happen again.
 *
 * ## What day does, and why the fog is the important one
 *
 * The lighting passes established one rule the hard way: **fog colour is a hard ceiling on
 * brightness.** Weeping Stile was given 2.4× more light and moved from a mean of 23 to 38 —
 * lightening its `fogColor` is what actually fixed it. So a daylight transform that raised the
 * sun and left the fog alone would produce a brighter light source inside the same grey box, and
 * almost nothing on screen would change. Lifting `fogColor` is most of the work here.
 *
 * Pure: no three.js, no DOM. It takes an `AmbientDef` and an hour and returns another one.
 */

import type { AmbientDef, DayOverride } from './look.js';

/** Hours in a day. Named because the arithmetic below wraps on it in three places. */
export const DAY_HOURS = 24;

/**
 * The hour the authored ambience *is*.
 *
 * One in the morning. Everything in `AMBIENT` describes the world at this hour exactly, so
 * `ambientAt(amb, NIGHT_ANCHOR)` returns `amb` unchanged — which is the property that makes it
 * safe to add a clock to a game whose lighting has already been tuned three times.
 */
export const NIGHT_ANCHOR = 1;

/**
 * The hour a new character's clock starts at.
 *
 * Six in the morning, mid-dawn — and not `NIGHT_ANCHOR`, which is where every character used to
 * begin because the anchor was the only hour that existed when the clock was added. One in the
 * morning is the hardest hour in the world for a stranger: the Warden's grace is at two thirds,
 * the light is at nothing, the curfew is on and the night crews are at full vigour — and the
 * first thing a player ever saw was a dark ward. Dawn is the opposite of all of that, and it is
 * also the one hour where the cycle is *visible*: the light is coming up under them as they walk
 * the first lap, the lamps are half lit and going out one at a time behind the lamplighter, and
 * both the night crews and the day crews are on the road. "Being in the change" is the whole
 * value of a clock in a twenty-minute sitting, and this puts a new player in it from the first
 * step. Existing saves are untouched: this is the opening hour, not a migration.
 */
export const OPENING_HOUR = 6;

/**
 * Which day it is, from a clock that counts hours and never resets.
 *
 * The clock used to wrap at twenty-four, which was fine while nothing wanted to know how many
 * days had passed — and stopped being fine the moment the sky needed to be *different tomorrow*.
 * A wrapping clock throws that away every midnight.
 *
 * Not a save migration: a v24 file holds a number between 0 and 24, which is a perfectly good
 * monotonic clock reading — it means day zero. Nothing had to be rewritten, because every reader
 * of the hour already takes it modulo a day.
 */
export function dayNumber(clock: number): number {
  return Math.floor(clock / DAY_HOURS);
}

export type Phase = 'night' | 'dawn' | 'day' | 'dusk';

/**
 * A place at an hour: an `AmbientDef` with the day override taken off.
 *
 * The distinction the type system is being asked to keep is between *what a place is* — which
 * carries a night, a day and the rule for getting between them — and *what it looks like right
 * now*, which is seven numbers and no rule.
 */
export type Lit = Omit<AmbientDef, 'day'>;

/**
 * How much daylight there is at an hour, 0 to 1.
 *
 * Flat night, a long slow dawn, a flat day, a long slow dusk. The ramps are three hours each and
 * deliberately longer than a real one: the whole value of a cycle in a game you play in
 * twenty-minute sittings is being *in* the change, and a sunrise you miss by walking through a
 * door is a sunrise nobody sees.
 */
export function daylightAt(hour: number): number {
  const h = ((hour % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;
  if (h >= 7 && h < 17) return 1;
  if (h >= 4 && h < 7) return smooth((h - 4) / 3);
  if (h >= 17 && h < 20) return smooth(1 - (h - 17) / 3);
  return 0;
}

export function phaseAt(hour: number): Phase {
  const h = ((hour % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;
  if (h >= 4 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/**
 * How hard the gas lamps burn at this hour, 0 to 1.
 *
 * Not simply the inverse of the daylight. A lamplighter walks the row at dusk and again at dawn,
 * so the lamps are still up for the first of the morning and are lit before the light has
 * entirely gone — which is why this lags the sun by an hour at each end. That lag is the only
 * thing in the world that shows somebody is doing a job on a schedule.
 */
export function lampsAt(hour: number): number {
  return 1 - daylightAt(hour - 1);
}

/**
 * How far a **pack** can see at this hour, against its authored range.
 *
 * The steepest of the three curves here, and the reason is that a pack has nothing to see by. A
 * gutter crew working the Sink at two in the morning is going by sound and shapes; the same crew
 * at noon can watch you come the length of the road. Sidewalk Immunity is untouched — the rule is
 * absolute and about warrants, not about eyesight — so this only changes what happens off the
 * flags, which is where the whole hunt already lives.
 *
 * Night is the Whisperer's working day, and until now the world did not say so anywhere.
 */
/**
 * How long the Warden takes to walk its whole beat, in game-hours.
 *
 * Two, so a circuit is about a real minute at the street clock's two-hours-a-minute. Ashfall's
 * beat is a sixteen-by-eight rectangle — forty-eight units, or twenty real seconds at the
 * Warden's pace — so it arrives at each post early and waits there. That is what makes it read as
 * a beat rather than as a thing circling: a person on a schedule is somewhere *before* they are
 * due, and stands about.
 */
export const BEAT_HOURS = 2;

/**
 * Which post the Warden is due at, at this hour.
 *
 * The position is a **pure function of the clock**, which is the whole point and a real change in
 * what the ward is. A blind `(target + 1) % n` loop is unlearnable: where the Warden will be in
 * thirty seconds depends on where it happens to be now, which depends on everything that has
 * happened since the screen was built. A timetable is knowledge — at ten past two it is at the
 * north-east post, every day, and a player who has watched one circuit can plan the next.
 *
 * That matters more here than in most games, because Sidewalk Immunity is this world's core rule
 * and the interesting version of it is not "react to a cone" but "know where the cone will be".
 *
 * It also means `RETURN` has somewhere honest to go: not back to where it broke off, but forward
 * to wherever it *should* be by now. Which is what a person who has been chasing somebody does.
 */
export function beatPostAt(hour: number, posts: number): number {
  if (posts <= 0) return 0;
  const through = (((hour % BEAT_HOURS) + BEAT_HOURS) % BEAT_HOURS) / BEAT_HOURS;
  return Math.min(posts - 1, Math.floor(through * posts));
}

/**
 * How far into its shift a crew is, 0 at the edges and 1 in the middle.
 *
 * Used to scale how far they range. A crew coming on shift is near where it started and one about
 * to go off is drifting back, so a patch is at its widest in the small hours and tightest at the
 * edges of the window — which is the difference between a schedule and a switch.
 *
 * Always 1 for a crew that keeps no hours: the verge is never more or less dangerous.
 */
export function packVigourAt(hours: PackHours | undefined, hour: number): number {
  if (!hours || hours === 'any') return 1;
  const lit = daylightAt(hour);
  const depth = hours === 'night' ? 1 - lit : lit;
  // Rises to full over the first quarter of the window and holds. Not a triangle: a crew is at
  // full strength for most of its shift and only tapers at the ends.
  return Math.min(1, 0.35 + depth * 1.3);
}

/**
 * When a pack is out.
 *
 * `'any'` is the default and means what it says. The other two are the interesting ones, and they
 * are a reading of *what the pack is doing* rather than a difficulty knob: a gutter crew works the
 * Sink after dark because that is when nobody is looking, and a waywatch on the Chalk Road works
 * daylight because carts travel by day and an empty road pays nothing.
 *
 * The consequence for the player is a world with a timetable in it — somewhere is dangerous at a
 * time, not simply dangerous — and a reason to look at the clock before choosing a road.
 */
export type PackHours = 'any' | 'night' | 'day';

/** Whether this pack is on the road at this hour. */
export function packOutAt(hours: PackHours | undefined, hour: number): boolean {
  if (!hours || hours === 'any') return true;
  const lit = daylightAt(hour);
  // Generous on both sides and deliberately overlapping at the edges: a crew does not vanish at
  // the stroke of dawn, and two packs on one road at dusk is the road being busy rather than a
  // bug. The gap would be the bug -- an hour when nothing is out anywhere reads as an empty world.
  return hours === 'night' ? lit < 0.75 : lit > 0.25;
}

export function packSightAt(hour: number): number {
  return 0.62 + 0.38 * daylightAt(hour);
}

/**
 * The same for the **Warden**, and shallower, because a Warden carries a lamp.
 *
 * The Magistracy is funded. Its officers are not out there squinting — they have gaslight and a
 * beat, and the ward's forty-one lamps are lit for them as much as for anybody. So the night
 * costs them a fifth of their sight where it costs a pack nearly two fifths, which is exactly the
 * asymmetry that makes the two threats feel like different problems at the same hour.
 */
export function wardenSightAt(hour: number): number {
  return 0.8 + 0.2 * daylightAt(hour);
}

/**
 * How long the Warden gives you to get back on the flags, against the authored grace.
 *
 * The curfew, and the one number here that gets *worse* at night. `curfew_breakers` has been in
 * the campaign since Wave 1 and the world has never had a night-time rule to break — a curfew
 * that exists only in a contract's blurb is a curfew nobody is under.
 *
 * So after dark, being off the pavement is itself the offence and the beat of grace shortens to
 * two thirds. Read together with `wardenSightAt`, night is a genuinely different problem rather
 * than an easier one: they see you later and they act sooner.
 */
export function wardenGraceAt(hour: number): number {
  return 0.66 + 0.34 * daylightAt(hour);
}

/**
 * How many of a row's lamps are lit at this hour.
 *
 * The **cause** rather than the look, which is the whole of this. `lampsAt` fades every lamp in a
 * ward together on one curve, and that reads correctly and is a lie: nothing dims a gas lamp. A
 * lamp is lit or it is not, and what changes over an evening is *how many of them somebody has
 * got to yet*.
 *
 * Counted from index zero, so the row lights from one end and goes out from the other — and the
 * lamplighter is standing at the boundary. That makes his position a pure function of the clock,
 * the same property the Warden's beat has and for the same reason: it is watchable, repeatable,
 * and holds no state that could drift.
 */
export function lampsLitAt(hour: number, count: number): number {
  return Math.round(lampsAt(hour) * count);
}

/**
 * Which lamp the lamplighter is at, given how many are lit.
 *
 * The next one he has to deal with, which at dusk is the next to light and at dawn is the last
 * one still burning. One formula for both because the count moves in opposite directions: it
 * climbs through the evening and falls through the morning, so he walks up the row and back down
 * it over a day without either direction being written down.
 */
export function lamplighterPost(lit: number, count: number): number {
  return Math.max(0, Math.min(count - 1, lit));
}

/** "04:20", for the HUD. Whole minutes, because a seconds hand would be a clock nobody wanted. */
export function clockLabel(hour: number): string {
  const h = ((hour % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * What this place looks like at this hour.
 *
 * The authored def is returned **by value and unchanged** at `NIGHT_ANCHOR` and any other hour
 * with no daylight in it, which is what `world.ts` leans on: a night street is the street that
 * was measured, to the last digit, and the clock cannot have quietly moved it.
 */
export function ambientAt(night: AmbientDef, hour: number): Lit {
  const k = daylightAt(hour);
  const noon = dayOf(night);
  // Stripped of `day`, and not only for tidiness: what comes back is what the place looks like
  // *now*, and a lit ambience carrying "what this looks like by day" is a value somebody could
  // reasonably pass back into `dayOf` and get a noon derived from a noon.
  if (k <= 0) {
    const { day, ...bare } = night;
    void day;
    return bare;
  }
  return {
    sunIntensity: lerp(night.sunIntensity, noon.sunIntensity, k),
    sunColor: mixHex(night.sunColor, noon.sunColor, k),
    ambientIntensity: lerp(night.ambientIntensity, noon.ambientIntensity, k),
    skyColor: mixHex(night.skyColor, noon.skyColor, k),
    groundBounce: mixHex(night.groundBounce, noon.groundBounce, k),
    fogColor: mixHex(night.fogColor, noon.fogColor, k),
    fogDensity: lerp(night.fogDensity, noon.fogDensity, k),
  };
}

/**
 * Noon for a place, from its night, plus whatever it says about itself.
 *
 * The transform is one set of numbers for nineteen areas and is wrong in at least six of them —
 * a crater lit by its own floor does not become a meadow at noon, and a snowfield already
 * measured as the brightest place in the game does not want doubling. `AmbientDef.day` is the
 * escape hatch and is authored where the reasoning in `look.ts` already says the place is
 * unusual. Anything with no `day` gets the transform, which is most of them.
 */
export function dayOf(night: AmbientDef): Lit {
  const base = {
    // Moved *toward* a common daylight rather than multiplied, and that is a correction rather
    // than a preference. A multiply amplifies whatever spread the night already had: the Tallow
    // Levels and Saltglass are authored at 3.6 and 1.3 because one has dark marsh underfoot and
    // the other has salt, and scaling both by 2.4 put noon at 8.6 against 2.1 — a four-fold
    // difference in how brightly the *sun* shines on two fields ten miles apart.
    //
    // The sun at noon is the same sun everywhere. What differs between two places is what stands
    // between it and the ground, which is what `AMBIENT` describes and what the overrides adjust.
    // So day compresses the spread instead of widening it, and the places that must stay dark say
    // so themselves.
    //
    // Floored at the night value, and that guard is not theoretical. The Caldera is authored at
    // an ambient of 5.8 -- above the common daylight level, because the crater floor is a light
    // source and the night had to account for it. Blending toward 5.4 made **noon dimmer than
    // midnight** there, which is the one thing a day may never be.
    sunIntensity: Math.max(
      night.sunIntensity,
      lerp(night.sunIntensity, DAY_SUN_LEVEL, 0.62),
    ),
    sunColor: mixHex(night.sunColor, DAY_SUN, 0.8),
    ambientIntensity: Math.max(
      night.ambientIntensity,
      lerp(night.ambientIntensity, DAY_AMBIENT_LEVEL, 0.55),
    ),
    skyColor: mixHex(night.skyColor, DAY_SKY, 0.7),
    groundBounce: mixHex(night.groundBounce, DAY_BOUNCE, 0.5),
    // The one that actually does the work. See the header: fog colour is a ceiling, and a day
    // that raised the lights inside the same grey box would be a brighter lamp in the same room.
    fogColor: mixHex(night.fogColor, DAY_FOG, 0.72),
    // Barely thinner. A smog city in daylight is not a clear one -- it is a place where you can
    // finally see how much smog there is.
    fogDensity: night.fogDensity * 0.9,
  };
  return { ...base, ...(night.day ?? {}) };
}

/**
 * What the sun and the sky come to at noon, before a place says otherwise.
 *
 * One pair of numbers for the world, because there is one sun. Read against the authored nights,
 * which run 1.2 to 4.2: this lifts the dark places a long way and the bright ones barely at all,
 * which is the shape wanted.
 */
const DAY_SUN_LEVEL = 6.2;
const DAY_AMBIENT_LEVEL = 5.4;

/** A sun through smoke. Deliberately not white: nothing in Jolrek is lit by a clean sky. */
const DAY_SUN = '#f0dcb4';
const DAY_SKY = '#a8bccc';
const DAY_BOUNCE = '#8a8274';
const DAY_FOG = '#b4b6ac';

/* ------------------------------------------------------------------------------------ *
 * Arithmetic.
 * ------------------------------------------------------------------------------------ */

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/**
 * Mixes two `#rrggbb` strings.
 *
 * In gamma space, on purpose. Every colour in `AMBIENT` was picked by eye against the rendered
 * frame rather than derived, so blending them the way they were chosen keeps a half-lit street
 * looking like something between the two streets somebody actually looked at. A linear-space mix
 * would be more correct about photons and less correct about this table.
 */
export function mixHex(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => {
    const av = (x >> shift) & 255;
    const bv = (y >> shift) & 255;
    return Math.round(av + (bv - av) * k) & 255;
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Re-exported for the areas that need to say what noon does to them. See `dayOf`. */
export type { DayOverride };
