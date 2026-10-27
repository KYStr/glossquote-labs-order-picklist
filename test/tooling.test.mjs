import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, ASSETS, assertAssets } from '../scripts/assets.mjs';
import { auditAsset } from '../scripts/audit.mjs';
import { routeRequest } from '../scripts/serve.mjs';

test('both static preview documents and every public asset satisfy the audit', async () => {
  assert.equal((await assertAssets(join(ROOT, 'public'))).length, 13);
  for (const path of ASSETS) assert.deepEqual(auditAsset(path, await readFile(join(ROOT, 'public', path), 'utf8')), [], path);
});
test('semantic negatives: wrong language home, title, indexing, inline event and missing label fail', async () => {
  const en = await readFile(join(ROOT, 'public/en/index.html'), 'utf8');
  assert.ok(auditAsset('en/index.html', en.replaceAll('https://glossquote.com/en/index.html', 'https://glossquote.com/index.html')).includes('LANGUAGE_HOME'));
  assert.ok(auditAsset('en/index.html', en.replace('Order Pick List and Packing Lists | Group by SKU', 'Wrong title')).includes('DOCUMENT_IDENTITY'));
  assert.ok(auditAsset('en/index.html', en.replace('noindex, nofollow', 'index, follow')).includes('PREVIEW_INDEXING'));
  assert.ok(auditAsset('en/index.html', en.replace('<body ', '<body onclick="alert(1)" ')).includes('INLINE_OR_ACTIVE_MARKUP'));
  assert.ok(auditAsset('en/index.html', en.replace('for="map-sku"', 'for="wrong-id"')).includes('LABEL_REFERENCE'));
  assert.ok(auditAsset('js/example.mjs', "import { x } from '../../sibling.mjs';").includes('IMPORT_NOT_IN_PUBLIC'));
  assert.ok(auditAsset('styles/app.css', '@import "external.css";').includes('REMOTE_OR_CSS_RESOURCE'));
  assert.ok(auditAsset('styles/app.css', 'body { background: url(example.png); }').includes('REMOTE_OR_CSS_RESOURCE'));
  assert.deepEqual(auditAsset('js/example.mjs', 'URL.revokeObjectURL(this.url);'), []);
});
test('R01 bilingual download guidance describes reversible TXT escaping and unchanged JSON', async () => {
  const zh = await readFile(join(ROOT, 'public/index.html'), 'utf8');
  const en = await readFile(join(ROOT, 'public/en/index.html'), 'utf8');
  for (const html of [zh, en]) {
    const hint = html.match(/<p id="download-hint" class="hint">([^<]+)<\/p>/)[1];
    for (const marker of ['\\n', '\\r', '\\t', '\\"', '\\\\']) assert.ok(hint.includes(marker), marker);
  }
  assert.ok(zh.includes('可完整還原；JSON 保留原文'));
  assert.ok(en.includes('These escapes are reversible; JSON keeps the original text.'));
});
test('route model: GET/HEAD exact routes and MIME; no listener or HTTP request is started', () => {
  assert.equal(routeRequest('GET', '/', '127.0.0.1:4224').asset, 'index.html');
  assert.equal(routeRequest('HEAD', '/en/', '127.0.0.1:4224').asset, 'en/index.html');
  assert.equal(routeRequest('GET', '/js/core/csv.mjs', '127.0.0.1:4224').headers['Content-Type'], 'text/javascript; charset=utf-8');
  assert.equal(routeRequest('GET', '/robots.txt', '127.0.0.1:4224').headers['Content-Type'], 'text/plain; charset=utf-8');
  assert.equal(routeRequest('POST', '/', '127.0.0.1:4224').status, 405);
  for (const host of ['localhost:4224', 'example.com', '127.0.0.1:80', undefined]) assert.equal(routeRequest('GET', '/', host).status, 403);
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/en/../index.html', '/js\\app.js', '/index.html?q=FAKE', '/_headers', '/missing']) assert.equal(routeRequest('GET', path, '127.0.0.1:4224').status, 404);
  const headers = routeRequest('GET', '/', '127.0.0.1:4224').headers;
  assert.match(headers['Content-Security-Policy'], /connect-src 'none'/); assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
});
