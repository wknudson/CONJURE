/**
 * Where a file under `public/` is fetched from, wherever the game is hosted.
 *
 * Every sprite path used to start with a bare `/assets/...`. That is right when the game
 * sits at a domain root and wrong everywhere else: a GitHub Pages project site serves from
 * `/<repo>/`, and every fetch 404s. Vite knows the deployed base (`base` in `vite.config.ts`,
 * exposed as `import.meta.env.BASE_URL`), so this is the one place a public path is joined to
 * it. Under vitest the base is `/`, which is why the tests can keep asserting the plain form.
 *
 * `path` is the file's location under `public/`, with or without a leading slash.
 *
 * `render/folk.ts` is also pulled in by the build-time scripts, which run under plain node
 * where `import.meta.env` is undefined; nothing there calls this, and the `??` keeps a call
 * from throwing if something ever does.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  const rel = path.startsWith('/') ? path.slice(1) : path;
  return base.endsWith('/') ? `${base}${rel}` : `${base}/${rel}`;
}
