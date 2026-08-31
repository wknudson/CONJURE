/**
 * Every value that defines the ward's look, in one object with a panel attached.
 *
 * Module-level on purpose. The screen is torn down and rebuilt every time a shop door
 * closes, and tuning that reset on the way back from the Apothecary would make the panel
 * useless for the thing it exists for — walking around and adjusting until it reads right.
 */

import GUI from 'lil-gui';
import { FACING } from './sprites3d.js';

export interface LookConfig {
  fov: number;
  cameraPitch: number;
  cameraDistance: number;

  exposure: number;
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  skyColor: string;
  groundBounce: string;

  fogColor: string;
  fogDensity: number;

  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;

  tiltEnabled: boolean;
  tiltFocusCenter: number;
  tiltFocusWidth: number;
  tiltFalloff: number;
  tiltMaxBlur: number;

  impactColor: string;
  impactIntensity: number;
  impactDistance: number;
  impactDecayTime: number;

  lampColor: string;
  lampIntensity: number;
  lampDistance: number;
  lampFlicker: number;
  signColor: string;

  coneOpacity: number;
  visionRange: number;
  visionAngle: number;

  packConeOpacity: number;
  packVisionRange: number;
  packVisionAngle: number;
  packChaseSpeed: number;
  packAggroRingOpacity: number;
}

export const LOOK: LookConfig = {
  // A narrow lens is what makes the ward read as a diorama rather than a level. The pitch
  // is steep enough to see into the alleys between the terraces.
  fov: 28,
  cameraPitch: 50,
  cameraDistance: 22,

  // A cold moon through coal smoke. `exposure` is the master dial — turn this first, and
  // only reach for the individual lights when the balance between them is wrong rather
  // than the overall level.
  //
  // Raised from 1.15, which was too dark to play in rather than atmospheric: measured off the
  // rendered frame, the *brightest* area in the game never put a pixel above 87 of 255 and the
  // hub ward topped out at 44. A night scene still needs a top end — without one there is no
  // difference between shadow and lit ground, only a uniform murk, and the two city wards were
  // reading as black. The individual lights were wrong too and are fixed below; this is the
  // half of it that was genuinely the overall level.
  exposure: 1.7,
  sunIntensity: 2.0,
  sunColor: '#9fb2d6',
  ambientIntensity: 1.5,
  skyColor: '#71809f',
  groundBounce: '#4a3828',

  fogColor: '#2b2630',
  fogDensity: 0.03,

  bloomStrength: 0.85,
  bloomRadius: 0.7,
  // Raised with the exposure. The threshold is what decides which things glow, and lifting the
  // whole scene past a fixed one would have made the *street* bloom rather than the lamps and
  // signs standing on it — turning a brighter ward into a hazier one.
  bloomThreshold: 0.62,

  tiltEnabled: true,
  tiltFocusCenter: 0.54,
  tiltFocusWidth: 0.15,
  tiltFalloff: 0.24,
  tiltMaxBlur: 3.4,

  impactColor: '#ffb347',
  impactIntensity: 40,
  impactDistance: 9,
  impactDecayTime: 0.45,

  lampColor: '#ffb45e',
  lampIntensity: 26,
  lampDistance: 17,
  lampFlicker: 0.14,
  signColor: '#5ef2d6',

  coneOpacity: 0.16,
  visionRange: 8,
  visionAngle: 80,

  // The roaming packs hunt on their own numbers, not the Warden's. Shorter sight and a
  // wider arc: a Warden is looking *for* you down a street, a pack notices you walk past.
  packVisionRange: 6,
  packVisionAngle: 100,
  packConeOpacity: 0.12,
  /**
   * How fast a pack runs you down.
   *
   * **Must stay at or below 6.** The collision layer's anti-tunneling proof is stated for
   * the fastest mover on the board at 6 units per second against the frame delta clamped
   * to 0.05 — a step of 0.3, comfortably inside the smallest collider radius. A pack that
   * outran that would walk through walls. Below the player's own 6 as well, so running is
   * always a real option rather than a formality.
   */
  packChaseSpeed: 5.2,
  packAggroRingOpacity: 0.1,
};

/**
 * The ambient half of the look, per area.
 *
 * `LOOK` is module-level and deliberately survives a teardown, which is what makes the tuning
 * panel usable — you nudge the fog, walk into a shop and back out, and it is still nudged.
 * That same persistence is why the ambience cannot live there once there is more than one
 * place: the first crossing into the wilds would permanently retune the ward.
 *
 * So the values that describe *a place* live here keyed by area, and everything that
 * describes the *camera and the film* — distance, bloom, tilt-shift, facing — stays global,
 * because those are properties of how the game is shot rather than of where you are standing.
 */
export interface AmbientDef {
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  skyColor: string;
  groundBounce: string;
  fogColor: string;
  fogDensity: number;
  /**
   * What noon does to this place, where the general answer is wrong.
   *
   * **Every value above describes this place at one in the morning** — that is the hour the whole
   * table was authored and measured at, and `daylight.ts` derives the rest of the day from it by
   * one transform. Absent means the transform is right here, which it is for thirteen of the
   * nineteen.
   *
   * It is present where the reasoning in this file already says the place is unusual: somewhere
   * lit by its own floor rather than by the sky does not become a meadow at noon, somewhere under
   * a closed canopy barely notices, and the two brightest grounds in the game do not want
   * doubling. Only the fields that differ; the rest still come from the transform.
   */
  day?: DayOverride;
}

/** The half of an `AmbientDef` a place may say for itself about daylight. */
export type DayOverride = Partial<Omit<AmbientDef, 'day'>>;

export const AMBIENT: Record<string, AmbientDef> = {
  /**
   * Ashfall Ward: a smogged street, but a street you can see.
   *
   * Lifted hard from where it started (sun 1.25, ambient 0.95). Measured against the rendered
   * frame those values put the hub — the place a player spends most of their time — at a mean
   * of 31 and a *maximum* of 44 out of 255, against 59 and 87 for the open road. Three times
   * darker than the countryside is not moody, it is unlit; the gas lamps were carrying a scene
   * that had nothing under them to carry.
   *
   * The ordering the four areas were authored in survives, which is the point of moving them
   * together: Lamprow is still the darkest, then this, then the Verge, then the Road.
   */
  ashfall_ward: {
    sunIntensity: 2.0,
    sunColor: '#9fb2d6',
    ambientIntensity: 1.5,
    skyColor: '#71809f',
    groundBounce: '#4a3828',
    fogColor: '#2b2630',
    fogDensity: 0.03,
  },
  /**
   * The Bonemarket: enclosed, and lit by the people in it.
   *
   * The dimmest sky of any of the wards and the warmest bounce, because almost none of the
   * light here falls from above -- the ranges box it in on all four sides and what you can see
   * by is stall lamps and braziers. Fog is thick for a place you can cross in twenty strides,
   * which is deliberate: it is smoke, not weather.
   */
  bonemarket: {
    sunIntensity: 2.9,
    sunColor: '#c8ba9c',
    ambientIntensity: 3.0,
    skyColor: '#a09a82',
    groundBounce: '#8a7053',
    fogColor: '#2f2820',
    fogDensity: 0.032,
  },

  /**
   * The Cinderworks: lit from the ground.
   *
   * The only area whose bounce is stronger than its sky. Everything here is under-lit by what
   * is in the furnaces, so the key is weak and orange and the ground throws more back than it
   * receives -- which is exactly backwards from every other place in the game and is the whole
   * reason the ward reads as hot rather than merely dark.
   */
  cinderworks: {
    sunIntensity: 3.6,
    sunColor: '#dca873',
    ambientIntensity: 5.0,
    skyColor: '#b89a7c',
    groundBounce: '#cc7f48',
    fogColor: '#2b2119',
    fogDensity: 0.026,
  },

  /**
   * Ward Seven: cold, wet and under-maintained.
   *
   * Bluer and flatter than Ashfall. Standing water is the brightest thing in the ward, so the
   * sky colour is doing double duty as what the pools reflect -- lifting it is what makes the
   * basin read as water rather than as a hole.
   */
  ward_seven: {
    sunIntensity: 3.0,
    sunColor: '#a3b6d2',
    ambientIntensity: 3.4,
    skyColor: '#8b9db4',
    groundBounce: '#565e50',
    fogColor: '#242a2e',
    fogDensity: 0.03,
  },

  /**
   * Highcourt & the Spire: the only place in Jolrek that is lit on purpose.
   *
   * The strongest key in the city and the thinnest fog, because the ward is a sightline and
   * fogging it would defeat the one thing it was built to do. Cool and clean -- the Magistracy
   * does not light its own district in the colour of somebody else's furnace.
   */
  highcourt: {
    sunIntensity: 2.3,
    sunColor: '#b6c4dc',
    ambientIntensity: 1.55,
    skyColor: '#7d8ca8',
    groundBounce: '#4a4a4e',
    fogColor: '#2a2e36',
    fogDensity: 0.02,
  },

  /**
   * The Chalk Verge: open country under the same Lid.
   *
   * Brighter and thinner than the ward, and that is doing a job rather than being pretty.
   * Ashfall has ten gas lamps carrying its light, and they are also its safe-zone tell — the
   * verge has neither, so the same fog density and the same weak sun would leave a road with
   * nothing on it at all. The moon does the work here: a colder, stronger key, a lifted
   * ambient, and half the fog so the treeline reads as distance instead of as a wall.
   */
  chalk_verge: {
    sunIntensity: 1.75,
    sunColor: '#a8bcd8',
    ambientIntensity: 1.35,
    skyColor: '#6d7f9e',
    groundBounce: '#4a4636',
    fogColor: '#232a2c',
    fogDensity: 0.016,
  },

  /**
   * Lamprow: the ward that pays for its own light, lit worse than the ward that taxes it.
   *
   * Darker and thicker than Ashfall on purpose. The lamp string down the High Street is the
   * only real light in the place, which is the fiction and also the mechanic — the flags
   * under those lamps are the safe tiles, so the eye should be drawn along them and the
   * ground either side should be somewhere you can lose track of what is on it.
   *
   * "Lose track of what is on it" and not "see nothing at all", which is what it had become:
   * a mean of 21 and a maximum of 28 out of 255 is a black screen with a rumour of a street in
   * it. Raised alongside the ward and still the darkest place in the game by a clear margin —
   * the *relationship* is the design, not the absolute level.
   */
  lamprow: {
    sunIntensity: 1.7,
    sunColor: '#8c9cc2',
    ambientIntensity: 1.35,
    skyColor: '#5f6c8c',
    groundBounce: '#48372a',
    fogColor: '#262130',
    fogDensity: 0.032,
  },

  /**
   * Millharrow: the Ring's daylight, and the reference the rest of it is lit against.
   *
   * Deliberately close to the Chalk Road's -- it is the same country with a town on it, and a
   * crossroads that looked like a different climate to the road running through it would be
   * the one thing a hub cannot afford. Slightly thicker fog, because a town has chimneys.
   */
  millharrow: {
    sunIntensity: 1.4,
    sunColor: '#c4b294',
    ambientIntensity: 1.1,
    skyColor: '#8a8468',
    groundBounce: '#544f3c',
    fogColor: '#2e2c24',
    fogDensity: 0.016,
  },

  /**
   * The Tallow Levels: flat light over standing water.
   *
   * The weakest key in the Ring and the highest ambient, which is what wet flat country looks
   * like -- there is nothing here tall enough to cast a shadow worth having, so the light comes
   * from the whole sky rather than from one direction. The cuts do the rest.
   */
  tallow_levels: {
    sunIntensity: 3.6,
    sunColor: '#a8b0a4',
    ambientIntensity: 4.8,
    skyColor: '#7e8a86',
    groundBounce: '#4a4c3e',
    fogColor: '#282c28',
    fogDensity: 0.02,
  },

  /**
   * Saltglass: glare.
   *
   * The strongest key anywhere and a bounce almost as strong, because that is what a salt pan
   * does -- half the light here has already hit the ground once. It is the brightest place in
   * the game and it is meant to be uncomfortable after the Levels.
   */
  saltglass: {
    // Already the brightest place in the game at night, at a measured mean of 105 -- the salt
    // itself averages 184 of 255 and does most of the work. Doubled by the general transform it
    // would clip; a salt flat at noon is a thing you squint at, and a thing you squint at on a
    // screen is a white rectangle.
    day: { sunIntensity: 2.1, ambientIntensity: 1.7 },
    sunIntensity: 1.25,
    sunColor: '#dcd6c0',
    ambientIntensity: 0.95,
    skyColor: '#9aa0a0',
    groundBounce: '#8e8a76',
    fogColor: '#333630',
    fogDensity: 0.012,
  },

  /**
   * Bray's Hollow: green country, and the only unremarkable light in the world.
   *
   * Nothing clever. It is grass under an open sky, and the point of the place is that there is
   * nothing to look at except how far across it is.
   */
  brays_hollow: {
    sunIntensity: 1.7,
    sunColor: '#bcc0a0',
    ambientIntensity: 1.3,
    skyColor: '#84907a',
    groundBounce: '#4e5440',
    fogColor: '#2a2e26',
    fogDensity: 0.015,
  },

  /**
   * Fenwick's Crossing: a town, and the water it is built over.
   *
   * Cooler than Millharrow and thicker with it -- river towns hold their weather. The bounce is
   * pulled toward the water rather than the ground, which is what makes the bridgehead read as
   * a bridgehead from the far end of the street.
   */
  fenwicks_crossing: {
    sunIntensity: 1.9,
    sunColor: '#aeb8c0',
    ambientIntensity: 1.7,
    skyColor: '#7c8894',
    groundBounce: '#4a5048',
    fogColor: '#282e30',
    fogDensity: 0.022,
  },

  /**
   * Weeping Stile: under the canopy.
   *
   * The darkest place in the Ring by a distance, and the only one where that is the design
   * rather than a fault -- the whole map is enclosed and you are meant to lose track of where
   * its edges are. Green key, heavy fog, and a floor that gives almost nothing back.
   */
  weeping_stile: {
    // Small, close and overgrown -- the tightest map in the game. Daylight here is only what
    // gets through the canopy and over the walls, so the sun is held below the common one.
    day: { sunIntensity: 4.4 },
    sunIntensity: 3.0,
    sunColor: '#8f9c7e',
    ambientIntensity: 3.8,
    skyColor: '#6f7c66',
    groundBounce: '#4a4a38',
    fogColor: '#39412f',
    fogDensity: 0.024,
  },

  /**
   * The Caldera: lit by the ground, like the ward downwind of it.
   *
   * The same trick as the Cinderworks and for the same reason — the floor is what is warm here,
   * not the sky. Stronger than the works because there is no roof over any of it, and the crater
   * walls bounce what little there is back down.
   */
  caldera: {
    // The one place where the ground *is* the light source, so noon changes the sky over the
    // crater and leaves the floor doing what it does. Only the fog: blending toward one daylight
    // already holds the sun where it should be, and the crater keeps its own dark air.
    day: { fogColor: '#6e5a4a' },
    sunIntensity: 4.2,
    sunColor: '#c98f5e',
    ambientIntensity: 5.8,
    skyColor: '#8a6a55',
    groundBounce: '#a05a2c',
    fogColor: '#42342c',
    fogDensity: 0.016,
  },

  /**
   * The Ashwood: under a closed canopy.
   *
   * The hardest area in the game to light, and the numbers say so — the floor is leaf litter at
   * an albedo of 41 of 255, the darkest ground anywhere, and the timber shadows most of what
   * falls on it. Both levers are turned a long way up, and the fog is deliberately *pale* for a
   * dark place: as Weeping Stile proved, heavy fog puts a hard ceiling on how bright anything
   * can get, and no amount of sun climbs past it.
   */
  ashwood: {
    // Under a closed canopy. Only the fog is overridden: what makes a wood dark at noon is the
    // green half-light under the timber, not a weaker sun, and that is a colour rather than an
    // intensity.
    day: { fogColor: '#5e6a4c' },
    sunIntensity: 3.8,
    sunColor: '#9aa878',
    ambientIntensity: 4.8,
    skyColor: '#6e7c5a',
    groundBounce: '#54502e',
    fogColor: '#3a4230',
    fogDensity: 0.022,
  },

  /**
   * The Rimefields: the weakest light in the world, over the brightest ground.
   *
   * Turned *down* rather than up, which no other area needed. Snow at 140 of 255 does most of
   * the work by itself, and lighting it like ordinary country puts the field well above every
   * other place in the game. Cold, flat and overcast — a snowfield in strong sun would be a
   * different climate from the road it continues.
   */
  rimefields: {
    // Snow at 140 of 255 already doing most of the work, which is why this is the one area whose
    // night was tuned *downward*. Noon on a snowfield is genuinely blinding, and a thing you
    // squint at on a screen is a white rectangle -- so what it gets is a cold, flat, very bright
    // overcast rather than a sun.
    day: { sunIntensity: 2.0, ambientIntensity: 1.9, sunColor: '#e8eef4', fogColor: '#9aa8b4' },
    sunIntensity: 1.2,
    sunColor: '#b8c6d8',
    ambientIntensity: 0.95,
    skyColor: '#8494a6',
    groundBounce: '#5c6470',
    fogColor: '#333c44',
    fogDensity: 0.014,
  },

  /**
   * The Storm Shelf: charged air.
   *
   * The only violet-keyed area anywhere. Everything else in the world is lit by fire, moon or
   * daylight; this is lit by whatever is about to happen, and the colour is the whole of what
   * separates it from any other stretch of rock.
   */
  storm_shelf: {
    sunIntensity: 2.4,
    sunColor: '#a8a0d0',
    ambientIntensity: 2.2,
    skyColor: '#6e6890',
    groundBounce: '#4a4658',
    fogColor: '#2b2a38',
    fogDensity: 0.018,
  },

  /**
   * The Bone Bastion: pale, dry and dead.
   *
   * Almost no colour in the key at all — the one place lit by nothing in particular. Bone dust
   * is bright enough on its own that the lights are modest, and the flatness is the point: this
   * is country nothing has happened in for a long time and the light should not suggest
   * otherwise.
   */
  bone_bastion: {
    sunIntensity: 1.5,
    sunColor: '#c2bfb4',
    ambientIntensity: 1.2,
    skyColor: '#8e8c84',
    groundBounce: '#605c52',
    fogColor: '#32302c',
    fogDensity: 0.016,
  },

  /**
   * The Chalk Road: farmland daylight, and the longest sightline in the game.
   *
   * The thinnest fog anywhere, because a thirty-two-column corridor whose whole tension is
   * what you can see coming down it cannot be fogged to the length of a street. Warmer than
   * the Verge's moon as well — this is worked ground with people on it somewhere, not the
   * wild edge.
   */
  chalk_road: {
    sunIntensity: 1.9,
    sunColor: '#c8b490',
    ambientIntensity: 1.3,
    skyColor: '#8a8468',
    groundBounce: '#4f4a38',
    fogColor: '#2e2c24',
    fogDensity: 0.012,
  },
};

/** An area's ambience, or the ward's if nobody wrote one. */
export function ambientFor(areaId: string): AmbientDef {
  return AMBIENT[areaId] ?? AMBIENT.ashfall_ward!;
}


/**
 * What the panel needs to reach in order to make a change visible.
 *
 * Passed in rather than imported so `look.ts` stays free of scene knowledge: this file
 * owns the numbers and the widgets, and the screen owns the objects they point at.
 */
export interface LookHandles {
  onExposure(v: number): void;
  onCamera(): void;
  onSun(): void;
  onAmbient(): void;
  onFog(): void;
  onBloom(): void;
  onTilt(): void;
  onLamps(): void;
  onSigns(): void;
  onVision(): void;
  onPackVision(): void;
  onColliders(show: boolean): void;
}

export function buildLookGui(handles: LookHandles, areaId = 'ashfall_ward', areaName = 'Ashfall Ward'): GUI {
  const gui = new GUI({ title: `${areaName} — Look` });
  // Bound to the area's own ambience, so tuning the road does not retune the ward. The
  // camera and film folders below stay on `LOOK`, because those describe how the game is
  // shot rather than where you are standing.
  const amb = ambientFor(areaId);

  const cam = gui.addFolder('Camera');
  cam.add(LOOK, 'fov', 15, 70, 1).onChange(handles.onCamera);
  cam.add(LOOK, 'cameraPitch', 15, 80, 1);
  cam.add(LOOK, 'cameraDistance', 6, 40, 0.5);

  const light = gui.addFolder('Lighting');
  light.add(LOOK, 'exposure', 0.2, 2.5, 0.05).name('exposure (master)').onChange(handles.onExposure);
  light.add(amb, 'sunIntensity', 0, 4, 0.05).onChange(handles.onSun);
  light.addColor(amb, 'sunColor').onChange(handles.onSun);
  light.add(amb, 'ambientIntensity', 0, 2, 0.05).onChange(handles.onAmbient);
  light.addColor(amb, 'skyColor').onChange(handles.onAmbient);
  light.addColor(amb, 'groundBounce').onChange(handles.onAmbient);

  const atmo = gui.addFolder('Atmosphere');
  atmo.addColor(amb, 'fogColor').onChange(handles.onFog);
  atmo.add(amb, 'fogDensity', 0, 0.12, 0.001).onChange(handles.onFog);

  const gas = gui.addFolder('Gaslamp');
  gas.addColor(LOOK, 'lampColor').onChange(handles.onLamps);
  gas.add(LOOK, 'lampIntensity', 0, 60, 0.5);
  gas.add(LOOK, 'lampDistance', 4, 40, 0.5).onChange(handles.onLamps);
  gas.add(LOOK, 'lampFlicker', 0, 0.6, 0.01);
  gas.addColor(LOOK, 'signColor').onChange(handles.onSigns);

  const bloom = gui.addFolder('Bloom');
  bloom.add(LOOK, 'bloomStrength', 0, 3, 0.01).onChange(handles.onBloom);
  bloom.add(LOOK, 'bloomRadius', 0, 1.5, 0.01).onChange(handles.onBloom);
  bloom.add(LOOK, 'bloomThreshold', 0, 1, 0.01).onChange(handles.onBloom);

  const tilt = gui.addFolder('Tilt-shift');
  tilt.add(LOOK, 'tiltEnabled').onChange(handles.onTilt);
  tilt.add(LOOK, 'tiltFocusCenter', 0, 1, 0.01).onChange(handles.onTilt);
  tilt.add(LOOK, 'tiltFocusWidth', 0, 0.5, 0.01).onChange(handles.onTilt);
  tilt.add(LOOK, 'tiltFalloff', 0.01, 0.6, 0.01).onChange(handles.onTilt);
  tilt.add(LOOK, 'tiltMaxBlur', 0, 12, 0.1).onChange(handles.onTilt);

  const fx = gui.addFolder('Impact light');
  fx.addColor(LOOK, 'impactColor');
  fx.add(LOOK, 'impactIntensity', 0, 150, 1);
  fx.add(LOOK, 'impactDistance', 1, 25, 0.5);
  fx.add(LOOK, 'impactDecayTime', 0.05, 2, 0.05);

  const warden = gui.addFolder('Warden');
  warden.add(LOOK, 'visionRange', 3, 20, 0.5).onChange(handles.onVision);
  warden.add(LOOK, 'visionAngle', 20, 180, 1).onChange(handles.onVision);
  warden.add(LOOK, 'coneOpacity', 0, 0.6, 0.01);

  const packs = gui.addFolder('Packs');
  packs.add(LOOK, 'packVisionRange', 2, 16, 0.5).onChange(handles.onPackVision);
  packs.add(LOOK, 'packVisionAngle', 30, 240, 1).onChange(handles.onPackVision);
  packs.add(LOOK, 'packConeOpacity', 0, 0.6, 0.01);
  packs.add(LOOK, 'packAggroRingOpacity', 0, 0.6, 0.01);
  // Capped at 6 in the widget as well as in the comment: the tunneling bound is not a
  // matter of taste, and a slider that could break collision would eventually be dragged.
  packs.add(LOOK, 'packChaseSpeed', 1, 6, 0.1);

  // Two ways to stop the walk sprite flickering on a diagonal, side by side so they can be
  // felt rather than argued about. Neither makes the diagonal *correct* — there is no
  // correct frame to show at 45 degrees — they only stop the wrong one changing every frame.
  const facing = gui.addFolder('Facing');
  facing.add(FACING, 'mode', ['raw', 'hysteresis', 'smoothing', 'both']).name('mode');
  facing.add(FACING, 'hysteresisDeg', 0, 44, 1).name('hysteresis (deg past line)');
  facing.add(FACING, 'smoothDistance', 0.05, 2, 0.05).name('smoothing (units)');

  const debug = gui.addFolder('Debug');
  const state = { showColliders: false };
  debug.add(state, 'showColliders').onChange((v: boolean) => handles.onColliders(v));
  debug.close();

  gui
    .add({ copy: () => console.log(JSON.stringify(LOOK, null, 2)) }, 'copy')
    .name('log LOOK to console');

  return gui;
}
