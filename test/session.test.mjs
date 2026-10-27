import test from 'node:test';
import assert from 'node:assert/strict';
import { PickSession, DownloadLease } from '../public/js/core/session.mjs';
import { OUTPUT_LIMIT } from '../public/js/core/export.mjs';

const encode = value => new TextEncoder().encode(value);
const csv = 'o,s,n,q\nO1,A,Pen,2\nO2,A,Pen,3\nO1,B,Paper,1\nO3,C,Paper,2';
const load = (session, text = csv, name = 'FAKE.csv') => { const data = encode(text); return session.loadSource({ name, size: data.length, read: async () => data }); };
const map = session => ['orderId', 'sku', 'name', 'quantity'].forEach((field, index) => session.setMapping(field, index));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('A18 session check ratio source, exact snapshot and reset', async () => {
  const session = new PickSession(); await load(session); map(session);
  assert.equal(await session.run(), true);
  session.setChecked('pick', 0, -1, true);
  assert.equal(session.result.totals.filter(item => item.checked).length, 1);
  assert.equal(session.result.totals.length, 3);
  session.setChecked('order', 0, 0, true);
  const snapshot = JSON.parse(new TextDecoder().decode(session.prepareDownload().json));
  assert.deepEqual(snapshot.totals.map(item => item.checked), [true, false, false]);
  assert.equal(snapshot.orders[0].items[0].checked, true);
  session.reset();
  for (const field of ['result', 'output', 'parsed', 'file', 'controller', 'error']) assert.equal(session[field], null);
  assert.deepEqual(session.mapping, {}); assert.equal(session.sourceName, ''); assert.equal(session.state, 'idle');
});
test('mapping change invalidates checks and output synchronously, before another run', async () => {
  let invalidations = 0;
  const session = new PickSession({ onInvalidate: () => invalidations++ }); await load(session); map(session); await session.run();
  session.setChecked('pick', 0, -1, true); session.prepareDownload();
  const generation = session.generation;
  session.setMapping('sku', 0);
  assert.equal(session.generation, generation + 1); assert.equal(session.result, null); assert.equal(session.output, null);
  assert.equal(session.prepareDownload(), null); assert.equal(session.isMappingValid(), false); assert.ok(invalidations >= 7);
  assert.equal(await session.run(), false); assert.equal(session.error.code, 'MAPPING_INVALID');
  session.setMapping('sku', 1); assert.equal(await session.run(), true); assert.ok(session.result.totals.every(item => !item.checked));
});
test('new source synchronously discards old results; old read cannot replace new source', async () => {
  const session = new PickSession(); await load(session); map(session); await session.run();
  const oldRead = deferred();
  const old = session.loadSource({ name: 'OLD.csv', size: 100, read: () => oldRead.promise });
  assert.equal(session.state, 'parsing'); assert.equal(session.result, null); assert.equal(session.output, null); assert.equal(session.parsed, null);
  await load(session, 'o,s,n,q\nNEW,NEW,Paper,1', 'NEW.csv');
  oldRead.resolve(encode(csv)); assert.equal(await old, false);
  assert.equal(session.sourceName, 'NEW.csv'); assert.equal(session.parsed.rows[0][0], 'NEW');
});
test('late rejected read and reset never resurrect data or errors', async () => {
  const session = new PickSession(); const read = deferred();
  const task = session.loadSource({ name: 'OLD.csv', size: 100, read: () => read.promise });
  session.reset(); read.resolve(new Uint8Array([0xff])); await task;
  assert.equal(session.parsed, null); assert.equal(session.error, null); assert.equal(session.state, 'idle');
});
test('oversize size gate avoids file read; content size is checked again', async () => {
  const session = new PickSession(); let reads = 0;
  await session.loadSource({ name: 'oversized.csv', size: 1_048_577, read: async () => { reads++; return encode(csv); } });
  assert.equal(reads, 0); assert.equal(session.error.code, 'FILE_TOO_LARGE');
  await session.loadSource({ name: 'size-lie.csv', size: 1, read: async () => new Uint8Array(1_048_577) });
  assert.equal(session.error.code, 'FILE_TOO_LARGE');
});
test('synthetic File interface accepts content regardless of extension and releases File', async () => {
  const session = new PickSession(); const bytes = encode(csv);
  await session.loadFile({ name: 'orders.not-csv', size: bytes.length, type: 'application/octet-stream', arrayBuffer: async () => bytes.buffer });
  assert.equal(session.state, 'mapping'); assert.equal(session.file, null); assert.equal(session.parsed.rows.length, 4);
  await session.loadSource({ name: 'unreadable', size: 0, read: async () => { throw new Error('FAKE_PRIVATE_ERROR_CANARY'); } });
  assert.deepEqual(session.error, { code: 'READ_FAILED' });
});
test('cancel during aggregation returns mapping, no partial result, and can rerun', async () => {
  let cancelled = false; let session;
  session = new PickSession({ onChange: (state, event) => {
    if (!cancelled && event === 'progress' && state.progress.phase === 'aggregating' && state.progress.processed === 100) { cancelled = true; state.cancel(); }
  } });
  await load(session, 'o,s,n,q\n' + Array.from({ length: 250 }, () => 'O,A,Pen,1').join('\n')); map(session);
  assert.equal(await session.run(), false); assert.equal(session.state, 'mapping'); assert.equal(session.result, null); assert.equal(session.error, null);
  assert.equal(await session.run(), true); assert.equal(session.result.totals[0].quantity, 250);
});
test('mapping invalidation during a yielding run blocks stale completion', async () => {
  let changed = false;
  const session = new PickSession({ onChange: (state, event) => {
    if (!changed && event === 'progress' && state.progress.phase === 'validating' && state.progress.processed === 100) { changed = true; state.setMapping('sku', 0); }
  } });
  await load(session, 'o,s,n,q\n' + Array.from({ length: 200 }, () => 'O,A,Pen,1').join('\n')); map(session);
  assert.equal(await session.run(), false); assert.equal(session.result, null); assert.equal(session.output, null); assert.equal(session.state, 'stale');
});
test('old run cannot overwrite a newly loaded source or reset', async () => {
  const session = new PickSession(); await load(session); map(session);
  const run = session.run(); session.reset(); await run;
  assert.equal(session.state, 'idle'); assert.equal(session.result, null);
  await load(session); map(session); const run2 = session.run(); await load(session, 'o,s,n,q\nNEW,NEW,Pen,1'); await run2;
  assert.equal(session.state, 'mapping'); assert.equal(session.result, null); assert.equal(session.parsed.rows[0][0], 'NEW');
});
test('URL lease revokes old URL before replacement and on clear; cap precedes Blob', () => {
  const events = []; let count = 0;
  const api = { createObjectURL: blob => { events.push(['create', blob]); return 'blob:fake-' + ++count; }, revokeObjectURL: url => events.push(['revoke', url]) };
  class FakeBlob { constructor(parts, options) { events.push(['blob', parts[0].length, options.type]); } }
  const lease = new DownloadLease(api, FakeBlob); const output = { txt: encode('txt'), json: encode('{}') };
  assert.equal(lease.create('txt', output).name, 'order-picklist.txt');
  assert.equal(lease.create('json', output).name, 'order-picklist.json');
  assert.equal(events[2][0], 'revoke'); assert.equal(events[2][1], 'blob:fake-1');
  lease.clear(); lease.clear(); assert.equal(events.filter(event => event[0] === 'revoke').length, 2);
  const before = events.length;
  assert.throws(() => lease.create('txt', { txt: new Uint8Array(OUTPUT_LIMIT), json: new Uint8Array(1) }), { code: 'OUTPUT_TOO_LARGE' });
  assert.equal(events.length, before); assert.throws(() => lease.create('../../secret', output), /INVALID_FORMAT/);
});
test('source, mapping, checks and reset all revoke the active download lease', async () => {
  const revoked = []; let next = 0;
  const lease = new DownloadLease({ createObjectURL: () => `blob:fake-${++next}`, revokeObjectURL: url => revoked.push(url) }, Blob);
  const session = new PickSession({ onInvalidate: () => lease.clear() });
  await load(session); map(session); await session.run();
  lease.create('json', session.prepareDownload()); session.setChecked('pick', 0, -1, true);
  lease.create('txt', session.prepareDownload()); session.setMapping('name', 2); await session.run();
  lease.create('json', session.prepareDownload()); await load(session); map(session); await session.run();
  lease.create('json', session.prepareDownload()); session.reset();
  assert.deepEqual(revoked, ['blob:fake-1', 'blob:fake-2', 'blob:fake-3', 'blob:fake-4']);
});
