import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetUrl } from '../render/assetUrl.js';
import { folkSheetSrc } from '../render/folk.js';
import { companionSpriteSrc } from '../render/sprites.js';

/**
 * The game has to work under a path prefix, because that is how a GitHub Pages project
 * site is served, and a bare `/assets/...` 404s there. Every runtime asset path goes
 * through `assetUrl`, which joins Vite's deployed base to it.
 */
describe('assetUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is the plain root form at a domain root, which is what every other test asserts', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(assetUrl('assets/sprites/x.png')).toBe('/assets/sprites/x.png');
    expect(assetUrl('/assets/sprites/x.png'), 'a leading slash is tolerated, not doubled').toBe(
      '/assets/sprites/x.png',
    );
  });

  it('follows a relative base, which is what the shipped bundle is built with', () => {
    vi.stubEnv('BASE_URL', './');
    expect(assetUrl('assets/sprites/x.png')).toBe('./assets/sprites/x.png');
  });

  it('joins a prefixed base whether or not it carries its own slash', () => {
    vi.stubEnv('BASE_URL', '/CONJURE/');
    expect(assetUrl('assets/sprites/x.png')).toBe('/CONJURE/assets/sprites/x.png');
    vi.stubEnv('BASE_URL', '/CONJURE');
    expect(assetUrl('assets/sprites/x.png')).toBe('/CONJURE/assets/sprites/x.png');
  });

  it('is what the sprite and folk loaders actually build from', () => {
    vi.stubEnv('BASE_URL', '/CONJURE/');
    expect(companionSpriteSrc('ignis', 'front')).toBe(
      '/CONJURE/assets/sprites/companions/ignis-front.png',
    );
    expect(folkSheetSrc('painted').startsWith('/CONJURE/assets/sprites/')).toBe(true);
  });
});
