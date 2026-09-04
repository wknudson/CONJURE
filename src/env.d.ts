/**
 * Build-time constants, injected by the `define` block in `vite.config.ts`.
 *
 * Read only through `app/build.ts`, which also survives their absence: vitest runs from its
 * own config and does not define them.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;
