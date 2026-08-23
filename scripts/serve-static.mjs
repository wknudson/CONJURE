// Dead-simple static file server for the standalone HD-2D prototypes at the
// repo root (hd2d-starter.html, tutorial-area.html).
//
// Those files pull three.js from a CDN through an importmap. Vite's dev server
// rewrites inline module scripts and tries to resolve `three/addons/...` from
// node_modules, which fails — so they need a server that just hands the bytes
// over untouched. That is all this does.
//
//   npm run serve:static     ->  http://localhost:5199/tutorial-area.html

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT ?? 5199);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filePath = normalize(join(ROOT, urlPath === '/' ? '/index.html' : urlPath));

  // Refuse anything that escapes the repo root.
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`static server: http://localhost:${PORT}/`);
  console.log(`  prototype:   http://localhost:${PORT}/tutorial-area.html`);
});
