import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLine, validateMapping, buildPickLists } from '../public/js/core/orders.mjs';

const mapping = { orderId: 0, sku: 1, name: 2, quantity: 3 };
const headers = ['order', 'sku', 'name', 'qty'];
const parsed = rows => ({ headers, rows });

test('A07 mapping requires four distinct existing integer columns', () => {
  assert.equal(validateMapping(headers, mapping), mapping);
  for (const invalid of [{ ...mapping, sku: 0 }, { ...mapping, sku: -1 }, { ...mapping, sku: 4 }, { ...mapping, sku: '1' }, { sku: 1 }, { ...mapping, extra: 4 }]) assert.throws(() => validateMapping(headers, invalid), { code: 'MAPPING_INVALID' });
});
test('A13/A14 exact empty values fail; whitespace, leading zeros, Unicode remain exact', () => {
  for (const column of [0, 1, 2]) {
    const row = ['O1', '001', '筆', '1']; row[column] = '';
    assert.equal(validateLine(row, mapping, 4)[0].code, 'REQUIRED_VALUE_EMPTY');
    assert.equal(validateLine(row, mapping, 4)[0].rowIndex, 4);
  }
  assert.deepEqual(validateLine([' ', '001', '筆 ', '0001'], mapping, 1), { orderId: ' ', sku: '001', name: '筆 ', quantity: 1n });
});
test('A15 quantity grammar and BigInt bounds', () => {
  for (const qty of ['1.5', '+1', '-1', '1e2', '1,000', ' 1', '1 ', '１', '١', '', '\n1', '1\n', '1\r', '1\r\n', '1\u2028']) assert.equal(validateLine(['O', 'A', '筆', qty], mapping, 1)[0].code, 'QUANTITY_SYNTAX');
  for (const qty of ['0', '0000', '100001', '9'.repeat(100_000)]) assert.equal(validateLine(['O', 'A', '筆', qty], mapping, 1)[0].code, 'QUANTITY_RANGE');
  for (const [qty, expected] of [['0001', 1n], ['100000', 100000n], ['0'.repeat(1000) + '1', 1n]]) assert.equal(validateLine(['O', 'A', '筆', qty], mapping, 1).quantity, expected);
});
test('A08 string identities stay separate', async () => {
  const result = await buildPickLists(parsed([['001', '001', '筆', '2'], ['1', '1', '筆', '3']]), mapping);
  assert.deepEqual(result.totals.map(({ sku, quantity }) => [sku, quantity]), [['001', 2], ['1', 3]]);
  assert.deepEqual(result.orders.map(order => order.orderId), ['001', '1']);
});
test('invalid rows produce at most 20 details and full issue count, no partial result', async () => {
  await assert.rejects(buildPickLists(parsed(Array.from({ length: 25 }, () => ['', 'A', '筆', '0'])), mapping), error => error.code === 'REQUIRED_VALUE_EMPTY' && error.issues.length === 20 && error.issueCount === 50 && !Object.hasOwn(error, 'totals'));
});

test('A09 stable totals and per-order sums use exact oracle', async () => {
  const result = await buildPickLists(parsed([['O1', 'A', '筆', '2'], ['O2', 'A', '筆', '3'], ['O1', 'B', '紙', '1']]), mapping);
  assert.deepEqual(result, {
    totals: [{ sku: 'A', name: '筆', quantity: 5, orderCount: 2, checked: false }, { sku: 'B', name: '紙', quantity: 1, orderCount: 1, checked: false }],
    orders: [
      { orderId: 'O1', items: [{ sku: 'A', name: '筆', quantity: 2, checked: false }, { sku: 'B', name: '紙', quantity: 1, checked: false }] },
      { orderId: 'O2', items: [{ sku: 'A', name: '筆', quantity: 3, checked: false }] },
    ], counts: { sourceRows: 3, skuCount: 2, orderCount: 2 },
  });
});
test('A10 repeated order/SKU lines add without inflating order count', async () => {
  const result = await buildPickLists(parsed([['O1', 'A', '筆', '2'], ['O1', 'A', '筆', '3']]), mapping);
  assert.equal(result.totals.length, 1);
  assert.equal(result.totals[0].quantity, 5);
  assert.equal(result.totals[0].orderCount, 1);
  assert.deepEqual(result.orders[0].items, [{ sku: 'A', name: '筆', quantity: 5, checked: false }]);
});
test('A11 name conflict contains both record indexes and names; no partial lists', async () => {
  await assert.rejects(buildPickLists(parsed([['O1', 'A', '筆', '1'], ['O2', 'A', '自動筆', '1']]), mapping), error => {
    assert.deepEqual(error.issues, [{ code: 'SKU_NAME_CONFLICT', rowIndex: 2, firstRowIndex: 1, sku: 'A', firstName: '筆', name: '自動筆' }]);
    assert.equal(Object.hasOwn(error, 'totals'), false);
    return error.code === 'SKU_NAME_CONFLICT';
  });
});
test('A12 exact names never merge distinct SKUs; no trim/case-fold/NFC', async () => {
  const result = await buildPickLists(parsed([['O', 'A', '筆', '1'], ['O', 'B', '筆', '1'], ['O', 'a', '筆', '1'], ['O', ' A', '筆', '1']]), mapping);
  assert.deepEqual(result.totals.map(item => item.sku), ['A', 'B', 'a', ' A']);
  for (const other of ['筆 ', '筆\n']) await assert.rejects(buildPickLists(parsed([['O', 'A', '筆', '1'], ['O', 'A', other, '1']]), mapping), { code: 'SKU_NAME_CONFLICT' });
  await assert.rejects(buildPickLists(parsed([['O', 'A', 'é', '1'], ['O', 'A', 'e\u0301', '1']]), mapping), { code: 'SKU_NAME_CONFLICT' });
});
test('A16 aggregate defense accepts exactly one billion, rejects next increment', async () => {
  // Direct synthetic core input only: parser still refuses more than 5000 rows.
  const rows = Array.from({ length: 10_000 }, () => ['O', 'A', '筆', '100000']);
  const result = await buildPickLists(parsed(rows), mapping);
  assert.equal(result.totals[0].quantity, 1_000_000_000);
  assert.equal(result.orders[0].items[0].quantity, 1_000_000_000);
  await assert.rejects(buildPickLists(parsed([...rows, ['O', 'A', '筆', '1']]), mapping), { code: 'TOTAL_TOO_LARGE' });
  await assert.rejects(buildPickLists(parsed([...rows, ['different', 'A', '筆', '1']]), mapping), { code: 'TOTAL_TOO_LARGE' });
});
test('first-seen order within each order is independent of global SKU order', async () => {
  const result = await buildPickLists(parsed([['Z', 'B', 'B', '1'], ['Y', 'A', 'A', '1'], ['Y', 'B', 'B', '1'], ['Z', 'A', 'A', '1']]), mapping);
  assert.deepEqual(result.totals.map(item => item.sku), ['B', 'A']);
  assert.deepEqual(result.orders.map(order => order.orderId), ['Z', 'Y']);
  assert.deepEqual(result.orders[1].items.map(item => item.sku), ['A', 'B']);
});
test('progress yields every 100 rows; abort returns no partial result', async () => {
  const controller = new AbortController();
  const progress = [];
  await assert.rejects(buildPickLists(parsed(Array.from({ length: 300 }, () => ['O', 'A', '筆', '1'])), mapping, {
    signal: controller.signal,
    onProgress: update => { progress.push(update); if (update.phase === 'aggregating' && update.processed === 100) controller.abort(); },
  }), { code: 'CANCELLED' });
  assert.equal(progress.at(-1).processed, 100);
  assert.equal(progress.at(-1).phase, 'aggregating');
});
test('empty data has a truthful empty result; pre-aborted work is rejected', async () => {
  assert.deepEqual(await buildPickLists(parsed([]), mapping), { totals: [], orders: [], counts: { sourceRows: 0, skuCount: 0, orderCount: 0 } });
  await assert.rejects(buildPickLists(parsed([]), mapping, { signal: AbortSignal.abort() }), { code: 'CANCELLED' });
});
