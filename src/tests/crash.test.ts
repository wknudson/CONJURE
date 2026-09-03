import { describe, expect, it } from 'vitest';
import { describeThrown, formatReport } from '../app/crash.js';
import { BUILD, buildLabel } from '../app/build.js';

/**
 * The crash report is what a playtester pastes into a message. It has to name the build,
 * the screen and the fight, and it has to be built from whatever was thrown, whatever
 * shape that had. The DOM half of `crash.ts` is exercised in the browser; this is the text.
 */
describe('the crash report', () => {
  const build = { version: '0.1.0', sha: 'abc1234' };
  const env = { userAgent: 'TestBrowser/1', viewport: '1280x800' };

  it('leads with the build stamp, then names the screen, profile and last fight', () => {
    const text = formatReport(
      build,
      [{ source: 'error', message: 'boom', stack: 'Error: boom\n    at x.ts:1', at: 2500 }],
      {
        screen: 'screen screen--combat',
        profile: 'slot-1',
        lastRun: { encounterId: 'lamprow_tithe', seed: 7, companionId: 'ignis' },
      },
      env,
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe('CONJURE crash report — v0.1.0 · abc1234');
    expect(lines[1]).toBe('screen: screen screen--combat');
    expect(lines[2]).toBe('profile: slot-1');
    expect(lines[3]).toBe('last fight: lamprow_tithe seed 7 with ignis');
    expect(text).toContain('browser: TestBrowser/1');
    expect(text).toContain('[1] error at +2.5s: boom');
    expect(text).toContain('    at x.ts:1');
  });

  it('says so when nothing is open, rather than printing undefined', () => {
    const text = formatReport(build, [], {}, env);
    expect(text).toContain('screen: unknown');
    expect(text).toContain('profile: none');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('last fight');
  });

  it('numbers a cascade as one incident', () => {
    const text = formatReport(
      build,
      [
        { source: 'error', message: 'first', at: 1000 },
        { source: 'unhandledrejection', message: 'second', at: 1200 },
      ],
      {},
      env,
    );
    expect(text).toContain('[1] error at +1.0s: first');
    expect(text).toContain('[2] unhandledrejection at +1.2s: second');
  });
});

describe('describing what was thrown', () => {
  it('keeps an Error\'s stack and follows its cause', () => {
    const inner = new Error('handler blew up');
    const outer = new Error('animation failed on damageDealt', { cause: inner });
    const d = describeThrown(outer);
    expect(d.message).toBe('animation failed on damageDealt');
    expect(d.stack).toContain('caused by:');
    expect(d.stack).toContain('handler blew up');
  });

  it('copes with a string, an object and something unserialisable', () => {
    expect(describeThrown('plain').message).toBe('plain');
    expect(describeThrown({ code: 7 }).message).toBe('{"code":7}');
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(describeThrown(loop).message).toBe('[object Object]');
  });
});

describe('the build stamp', () => {
  it('has a value under test even though nothing defines it, and reads as one line', () => {
    expect(BUILD.version).toBeTruthy();
    expect(BUILD.sha).toBeTruthy();
    expect(buildLabel({ version: '0.1.0', sha: 'abc1234' })).toBe('v0.1.0 · abc1234');
  });
});
