/**
 * How the sky is described to the player.
 *
 * One source for both places weather is named — the pre-combat briefing and the badge
 * worn during the fight — because two hand-written copies of the same rule text is how
 * a card ends up promising something the engine stopped doing three commits ago.
 *
 * Presentation only. Nothing here is imported by `src/core/`, and the engine has no
 * opinion about what a gale is called.
 */

import type { Weather } from '../core/types/state.js';
import { FOG_VISION } from '../core/types/state.js';

export interface WeatherReading {
  /** Worn on the badge. Kept to one glyph so it reads at a glance. */
  icon: string;
  /** The sky itself, in the world's own voice. */
  label: string;
  /** What it does to the rules, plainly. */
  effect: string;
  /** Drives the atmospheric overlay class on the board. */
  slug: 'fog' | 'rain' | 'gale';
  /**
   * Which way a gale blows, as a unit vector, for the drifting overlay. Absent for
   * weather that has no direction.
   */
  wind?: { x: number; y: number };
}

/** The compass heading of a wind vector, for prose. */
function heading(x: number, y: number): string {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'east' : 'west';
  return y > 0 ? 'south' : 'north';
}

export function readWeather(weather: Weather | undefined): WeatherReading | undefined {
  if (!weather) return undefined;

  if (weather.kind === 'fog') {
    return {
      icon: '☁',
      label: 'Smog Bank',
      effect: `Vision clamped: nothing sees or shoots past ${FOG_VISION} tiles.`,
      slug: 'fog',
    };
  }

  if (weather.kind === 'rain') {
    return {
      icon: '☂',
      label: 'Acid Rain',
      effect: 'Pyre dampened. Shock arcs to everything touching what it hits, yours included.',
      slug: 'rain',
    };
  }

  const { x, y } = weather.wind;
  return {
    icon: '≫',
    label: `Gale, ${heading(x, y)}ward`,
    effect: 'Projectiles carry further downwind, and fall short into it.',
    slug: 'gale',
    wind: { x, y },
  };
}
