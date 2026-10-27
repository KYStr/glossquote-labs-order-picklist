import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPickLists } from '../public/js/core/orders.mjs';
import { parseCsv } from '../public/js/core/csv.mjs';
import { serializePickLists, snapshotPickLists, DOWNLOADS, OUTPUT_LIMIT } from '../public/js/core/export.mjs';

const fixture = async () => buildPickLists({ headers: ['o', 's', 'n', 'q'], rows: [['../../secret', 'A', '筆', '2'], ['O2', 'B', '紙', '1'], ['O2', 'C', '紙', '3']] }, { orderId: 0, sku: 1, name: 2, quantity: 3 });
const decode = bytes => new TextDecoder().decode(bytes);

test('A18/A19 schemaVersion 1, checked snapshot, safe fixed download names', async () => {
  const result = await fixture();
  result.totals[1].checked = true;
  result.orders[0].items[0].checked = true;
  const output = serializePickLists(result);
  const json = JSON.parse(decode(output.json));
  assert.deepEqual(Object.keys(json), ['schemaVersion', 'tool', 'totals', 'orders', 'counts']);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.tool, 'order-picklist');
  assert.deepEqual(json.totals.map(item => item.checked), [false, true, false]);
  assert.equal(json.orders[0].orderId, '../../secret');
  assert.equal(json.orders[0].items[0].checked, true);
  assert.equal(DOWNLOADS.json.name, 'order-picklist.json');
  assert.equal(DOWNLOADS.txt.name, 'order-picklist.txt');
  assert.match(decode(output.txt), /^Order pick list and packing lists\n/);
  assert.match(decode(output.txt), /Order: "\.\.\/\.\.\/secret"/);
  assert.match(decode(output.txt), /\[x\] SKU: "B"/);
  assert.deepEqual(json.counts, { sourceRows: 3, skuCount: 3, orderCount: 2 });
});
test('export has no extra source fields or mutable snapshot aliases', async () => {
  const result = await fixture();
  result.address = 'FAKE_ADDRESS_CANARY'; result.email = 'FAKE_EMAIL_CANARY';
  result.totals[0].payment = 'FAKE_PAYMENT_CANARY';
  const snapshot = snapshotPickLists(result);
  result.totals[0].checked = true;
  assert.equal(snapshot.totals[0].checked, false);
  const outputs = serializePickLists(result);
  for (const bytes of Object.values(outputs)) assert.doesNotMatch(decode(bytes), /FAKE_(?:ADDRESS|EMAIL|PAYMENT)_CANARY/);
});
test('A17/A19 hostile identifiers and exact multiline strings round-trip as data', async () => {
  const result = await fixture();
  result.totals[0].sku = '<img src=x onerror=alert(1)>';
  result.orders[0].orderId = '001\n"訂單"';
  const output = serializePickLists(result);
  assert.equal(JSON.parse(decode(output.json)).totals[0].sku, '<img src=x onerror=alert(1)>');
  assert.equal(JSON.parse(decode(output.json)).orders[0].orderId, '001\n"訂單"');
  assert.ok(decode(output.txt).includes('<img src=x onerror=alert(1)>'));
  assert.ok(decode(output.txt).includes(JSON.stringify('001\n"訂單"')));
});
test('A20 actual UTF-8 serializer: exactly 8 MiB accepted, +1 byte rejected', async () => {
  const result = await fixture();
  result.totals[0].checked = true;
  let initial = serializePickLists(result);
  let remaining = OUTPUT_LIMIT - initial.txt.length - initial.json.length;
  // String characters now receive the same reversible quoting in both files.
  // A checkmark changes JSON true/false by 1 byte while TXT [x]/[ ] stays 3.
  if (remaining % 2 === 1) {
    result.totals[1].checked = true;
    initial = serializePickLists(result);
    remaining = OUTPUT_LIMIT - initial.txt.length - initial.json.length;
  }
  result.orders[0].orderId += 'x'.repeat(remaining / 2);
  const exact = serializePickLists(result);
  assert.equal(exact.txt.length + exact.json.length, OUTPUT_LIMIT);
  result.totals[0].checked = false;
  assert.throws(() => serializePickLists(result), { code: 'OUTPUT_TOO_LARGE' });
});
test('invalid or unsafe result quantities are rejected before serialization', async () => {
  const result = await fixture();
  for (const value of [1n, 1.5, 0, 1_000_000_001, Number.MAX_SAFE_INTEGER + 1]) {
    result.totals[0].quantity = value;
    assert.throws(() => serializePickLists(result), /INVALID_RESULT_QUANTITY/);
  }
});

test('R01 actual quoted-multiline CSV cannot introduce a second TXT pick item', async () => {
  const csv = new TextEncoder().encode('o,s,n,q\nO1,A,"Pen\n[ ] SKU: B\n    Product: Paper",1');
  const result = await buildPickLists(parseCsv(csv), { orderId: 0, sku: 1, name: 2, quantity: 3 });
  const output = serializePickLists(result);
  const text = decode(output.txt);
  const lines = text.split('\n');
  assert.equal(result.totals.length, 1);
  assert.deepEqual(lines.filter(line => /^\[[ x]\] SKU: /.test(line)), ['[ ] SKU: "A"', '[ ] SKU: "A"']);
  assert.deepEqual(lines.filter(line => line.startsWith('Order: ')), ['Order: "O1"']);
  assert.deepEqual(lines.filter(line => line.startsWith('    Product: ')), [
    '    Product: "Pen\\n[ ] SKU: B\\n    Product: Paper"',
    '    Product: "Pen\\n[ ] SKU: B\\n    Product: Paper"',
  ]);
  assert.equal(JSON.parse(decode(output.json)).totals[0].name, 'Pen\n[ ] SKU: B\n    Product: Paper');
});

test('R01 every TXT source field is a reversible single line for controls, quotes and backslashes', async () => {
  const values = [
    'value\n[ ] SKU: FAKE', 'value\r\nOrder: FAKE', 'value\rTotal pick sheet',
    'value\tQuantity: 99', 'value"quoted"', 'value\\path\\n',
    'value\u0085Order: FAKE', 'value\u2028[ ] SKU: FAKE', 'value\u2029Per-order packing lists',
    'combined\r\n\t"\\end',
  ];
  for (const value of values) {
    const csvField = '"' + value.replaceAll('"', '""') + '"';
    const bytes = new TextEncoder().encode(`o,s,n,q\n${csvField},${csvField},${csvField},1`);
    const result = await buildPickLists(parseCsv(bytes), { orderId: 0, sku: 1, name: 2, quantity: 3 });
    const output = serializePickLists(result);
    const text = decode(output.txt);
    const lines = text.split('\n');
    assert.equal(lines.length, 17, 'Source text must not introduce a physical report line');
    assert.doesNotMatch(text, /[\r\t\u0085\u2028\u2029]/);
    const skus = lines.filter(line => /^\[[ x]\] SKU: /.test(line));
    const names = lines.filter(line => line.startsWith('    Product: '));
    const orders = lines.filter(line => line.startsWith('Order: '));
    assert.equal(skus.length, 2); assert.equal(names.length, 2); assert.equal(orders.length, 1);
    assert.equal(lines.filter(line => line === 'Total pick sheet').length, 1);
    assert.equal(lines.filter(line => line === 'Per-order packing lists').length, 1);
    for (const line of skus) assert.equal(JSON.parse(line.slice('[ ] SKU: '.length)), value);
    for (const line of names) assert.equal(JSON.parse(line.slice('    Product: '.length)), value);
    assert.equal(JSON.parse(orders[0].slice('Order: '.length)), value);
    const json = JSON.parse(decode(output.json));
    assert.equal(json.totals[0].sku, value); assert.equal(json.totals[0].name, value);
    assert.equal(json.orders[0].orderId, value); assert.equal(json.orders[0].items[0].sku, value); assert.equal(json.orders[0].items[0].name, value);
  }
});
