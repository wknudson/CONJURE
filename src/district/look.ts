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
  exposure: 1.15,
  sunIntensity: 1.25,
  sunColor: '#8fa3c8',
  ambientIntensity: 0.95,
  skyColor: '#5d6b8a',
  groundBounce: '#3d2e21',

  fogColor: '#2b2630',
  fogDensity: 0.03,

  bloomStrength: 0.85,
  bloomRadius: 0.7,
  bloomThreshold: 0.45,

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
}

export const AMBIENT: Record<string, AmbientDef> = {
  ashfall_ward: {
    sunIntensity: 1.25,
    sunColor: '#8fa3c8',
    ambientIntensity: 0.95,
    skyColor: '#5d6b8a',
    groundBounce: '#3d2e21',
    fogColor: '#2b2630',
    fogDensity: 0.03,
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
