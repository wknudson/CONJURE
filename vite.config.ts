import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/**
 * The build stamp, inlined so the game can say which build it is (`app/build.ts`).
 *
 * The version is `package.json`'s. The commit is `GITHUB_SHA` on the Pages deploy and
 * `git rev-parse` locally; a build outside any checkout says `local` rather than failing.
 */
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const sha = (() => {
  const fromCi = process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
})();

export default defineConfig({
  // Relative, so one bundle works at a domain root *and* under the `/<repo>/` prefix a
  // GitHub Pages project site is served from. Runtime asset paths go through
  // `render/assetUrl.ts`, which reads this back as `import.meta.env.BASE_URL`.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_SHA__: JSON.stringify(sha),
  },
  server: { port: 5173, open: false },
  build: { target: 'es2022', outDir: 'dist' },
});
