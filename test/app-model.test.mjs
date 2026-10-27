import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocumentModel, descendants } from './dom-model.mjs';

for (const locale of ['zh', 'en']) test(`offline ${locale} app model: actual listeners, sample, mappings, checks, downloads and pagehide (not browser PASS)`, async t => {
  const html = await readFile(new URL(locale === 'en' ? '../public/en/index.html' : '../public/index.html', import.meta.url), 'utf8');
  const document = createDocumentModel(html, locale);
  const old = { document: globalThis.document, window: globalThis.window, URL: globalThis.URL };
  const events = new Map(); const blobs = new Map(); const revoked = []; let next = 0;
  globalThis.document = document;
  globalThis.window = { addEventListener: (name, listener) => events.set(name, listener) };
  globalThis.URL = class ModelURL extends old.URL {
    static createObjectURL(blob) { const url = 'blob:model-' + ++next; blobs.set(url, blob); return url; }
    static revokeObjectURL(url) { revoked.push(url); blobs.delete(url); }
  };
  t.after(() => { globalThis.document = old.document; globalThis.window = old.window; globalThis.URL = old.URL; });
  await import(`../public/js/app.js?offline-model=${locale}`);
  const get = id => document.getElementById(id);
  const map = async () => { for (const [index, field] of ['orderId', 'sku', 'name', 'quantity'].entries()) { get(`map-${field}`).value = String(index); await get(`map-${field}`).dispatch('change'); } };

  assert.equal(get('download-json').disabled, true);
  await get('load-sample').dispatch('click');
  assert.equal(get('mapping-area').hidden, false); assert.equal(get('generate').disabled, true);
  assert.equal(get('samples').children[0].tagName, 'TABLE');
  await map(); assert.equal(get('generate').disabled, false);
  await get('generate').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('source').open, false);
  assert.equal(document.activeElement.id, 'pick-heading');
  assert.equal(get('pick-sheet').children[0].tagName, 'TABLE');
  const pickChecks = descendants(get('pick-sheet')).filter(node => node.tagName === 'INPUT');
  assert.equal(pickChecks.length, 3); assert.match(pickChecks[0].getAttribute('aria-label'), /SKU 001/);
  assert.ok(get('pick-sheet').textContent.includes('001')); assert.ok(get('pick-sheet').textContent.includes('PAPER'));
  pickChecks[0].checked = true; await pickChecks[0].dispatch('change');
  assert.match(get('pick-progress').textContent, /1 \/ 3/);
  const orderChecks = descendants(get('packing-lists')).filter(node => node.tagName === 'INPUT');
  orderChecks[0].checked = true; await orderChecks[0].dispatch('change');
  await get('download-json').dispatch('click');
  const downloaded = document.downloads.at(-1); assert.equal(downloaded.download, 'order-picklist.json');
  const snapshot = JSON.parse(await blobs.get(downloaded.href).text());
  assert.deepEqual(snapshot.totals.map(item => [item.sku, item.quantity, item.checked]), [['001', 7, true], ['PAPER', 1, false], ['1', 1, false]]);
  assert.equal(snapshot.orders[0].items[0].checked, true);
  await get('download-txt').dispatch('click');
  assert.equal(document.downloads.at(-1).download, 'order-picklist.txt'); assert.ok(revoked.includes(downloaded.href));

  // Changing even one mapping invalidates visible old results and both downloads.
  get('map-sku').value = '0'; await get('map-sku').dispatch('change');
  assert.equal(get('results').hidden, true); assert.equal(get('download-json').disabled, true);
  assert.equal(get('pick-sheet').textContent, ''); assert.equal(get('mapping-error').hidden, false);
  await map(); await get('generate').dispatch('click'); assert.match(get('pick-progress').textContent, /0 \/ 3/);

  // A synthetic File object tests file-event wiring, with no chooser or real file.
  const hostile = '<img src=x onerror=alert(1)>';
  const bytes = new TextEncoder().encode(`o,s,n,q\nO1,${hostile},Pen,1`);
  get('csv-file').files = [{ name: hostile + '.txt', size: bytes.length, arrayBuffer: async () => bytes.buffer }];
  await get('csv-file').dispatch('change');
  assert.equal(get('results').hidden, true); assert.equal(get('source-name').textContent, hostile + '.txt');
  await map(); await get('generate').dispatch('click');
  assert.ok(get('pick-sheet').textContent.includes(hostile)); assert.equal(document.created.some(node => node.tagName === 'IMG'), false);
  await get('download-json').dispatch('click'); const lastURL = document.downloads.at(-1).href;
  events.get('pagehide')();
  assert.equal(get('results').hidden, true); assert.equal(get('download-json').disabled, true);
  assert.equal(get('source-name').textContent, ''); assert.equal(get('samples').textContent, ''); assert.ok(revoked.includes(lastURL));
});
