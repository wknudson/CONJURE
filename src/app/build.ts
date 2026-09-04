/**
 * Which build this is.
 *
 * There was no way to tell. `package.json` said `0.1.0` and nothing read it, so a
 * playtester's report could not be matched to the code it was about, and a bug already
 * fixed looked the same as one that was not. The version comes from `package.json` and the
 * commit from `git rev-parse` (or `GITHUB_SHA` on the Pages deploy), both inlined by the
 * `define` block in `vite.config.ts`.
 *
 * Read through `typeof` rather than bare, because vitest runs from its own config and never
 * defines them; a test that pulls in a module that mentions the build must not fall over.
 */
export interface BuildStamp {
  version: string;
  /** Short commit hash, or `local` when built outside a checkout. */
  sha: string;
}

export const BUILD: BuildStamp = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-test',
  sha: typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'test',
};

/** `v0.1.0 · a1b2c3d` — how the stamp is written wherever a player can see it. */
export function buildLabel(build: BuildStamp = BUILD): string {
  return `v${build.version} · ${build.sha}`;
}
