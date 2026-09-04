import { describe, expect, it } from 'vitest';
import { webglAvailable } from '../app/unsupported.js';

/**
 * The probe must answer, never throw: under node there is no `document`, which is the
 * "no context" case as far as the caller is concerned, and a browser that blocks WebGL
 * outright throws from `getContext` the same way. The screen it gates is checked in the
 * browser.
 */
describe('webglAvailable', () => {
  it('says no where there is no way to ask, rather than throwing', () => {
    expect(webglAvailable()).toBe(false);
  });
});
