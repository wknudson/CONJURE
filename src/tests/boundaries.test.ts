import { describe, expect, it } from 'vitest';

/**
 * Architectural rules, held to by the only thing that cannot forget them.
 *
 * These are the constraints that last exactly as long as somebody remembers to honour
 * them, which is to say not very long. A comment saying "the engine must not import the
 * overworld" is a wish; this file is the rule.
 *
 * Source text is read rather than the module graph, deliberately. A type-only import
 * vanishes at runtime, so a graph walk would call the boundary clean while the code says
 * otherwise — and it is the code that a future reader copies from. The raw glob is Vite's
 * rather than `node:fs` because this project carries no Node types, and one architectural
 * guard is not worth a dependency.
 */

// The options must be an inline object literal — Vite parses these statically, so a
// shared constant is rejected at transform time.
const ENGINE = {
  ...import.meta.glob<string>('../core/engine/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../core/ai/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../contract/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

const RUN_STATE = import.meta.glob<string>('../core/overworld/state.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every `from '...'` specifier in a file — import or re-export, type-only included. */
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
}

describe('the combat engine', () => {
  it('never imports the overworld', () => {
    // The rule that keeps `createCombat` testable without a run existing at all. The
    // engine is handed armour and pips through `CombatCarry`; it has never heard of a
    // brew, and adding a fourth one must not mean editing the reducer.
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(ENGINE)) {
      for (const spec of importsOf(source)) {
        if (spec.includes('overworld')) offenders.push(`${path} -> ${spec}`);
      }
    }

    // A scan that read nothing would pass by vacuum, which is the one way an
    // architectural guard fails silently.
    expect(Object.keys(ENGINE).length, 'files actually read').toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it('is not reached back into by the run state itself', () => {
    // `state.ts` is the run's own data and stays ignorant of fights; `run.ts` is the one
    // file allowed to know both, which is why the brew table lives there and not beside
    // the brew ids.
    const sources = Object.values(RUN_STATE);
    expect(sources).toHaveLength(1);
    const specs = importsOf(sources[0]!);
    expect(specs.filter((s) => s.includes('engine') || s.includes('contract'))).toEqual([]);
  });
});
