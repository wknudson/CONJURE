/**
 * Deep clone for simulation. GameState is deliberately plain data (no class instances,
 * no closures) so structuredClone is both correct and fast enough for the AI to call
 * once per candidate action.
 */

// structuredClone is a global in Node 17+ and every modern browser, but is not declared
// by the ES2022 lib the core compiles against (deliberately, to keep the DOM out).
declare const structuredClone: <T>(value: T) => T;

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Stable stringify used by the determinism harness to hash a resolved state. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = obj[k];
          return acc;
        }, {});
    }
    return val;
  });
}
