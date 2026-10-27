import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, ASSETS, assertAssets } from './assets.mjs';

export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function routeRequest(method, url, host) {
  const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  if (host !== '127.0.0.1:4224') return { status: 403, headers };
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } };
  const path = url === '/' ? 'index.html' : url === '/en/' ? 'en/index.html' : url?.slice(1);
  if (!ASSETS.includes(path) || path === '_headers' || url.includes('%') || url.includes('\\')) return { status: 404, headers };
  const ext = path.split('.').pop();
  const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', txt: 'text/plain; charset=utf-8' }[ext];
  return { status: 200, headers: { ...headers, 'Content-Type': mime }, asset: path };
}

export async function startServer() {
  await assertAssets(join(ROOT, 'public'));
  const server = createServer(async (req, res) => {
    const route = routeRequest(req.method, req.url, req.headers.host);
    if (!route.asset) { res.writeHead(route.status, route.headers).end(); return; }
    try {
      const bytes = await readFile(join(ROOT, 'public', route.asset));
      res.writeHead(200, { ...route.headers, 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(500, route.headers).end(); }
  });
  server.on('error', () => { console.error('Preview could not bind 127.0.0.1:4224. Existing processes were preserved.'); process.exitCode = 1; });
  server.listen(4224, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4224 (no browser opened)'));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startServer();
