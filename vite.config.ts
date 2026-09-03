import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so one bundle works at a domain root *and* under the `/<repo>/` prefix a
  // GitHub Pages project site is served from. Runtime asset paths go through
  // `render/assetUrl.ts`, which reads this back as `import.meta.env.BASE_URL`.
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', outDir: 'dist' },
});
