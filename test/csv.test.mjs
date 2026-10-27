import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, CSV_LIMITS } from '../public/js/core/csv.mjs';

const bytes = text => new TextEncoder().encode(text);
const parse = text => parseCsv(bytes(text));
const fails = (input, code, recordIndex) => assert.throws(() => parse(input), error => error.code === code && (recordIndex === undefined || error.recordIndex === recordIndex));

test('A01: CRLF CSV leaves quantities as strings', () => {
  assert.deepEqual(parse('order,sku,name,qty\r\nO1,A,筆,2'), { headers: ['order', 'sku', 'name', 'qty'], rows: [['O1', 'A', '筆', '2']] });
});
test('A02/A03: quoted comma, escaped quote, mixed embedded line breaks preserved', () => {
  assert.deepEqual(parse('o,s,n,q\nO1,A,"筆,自動鉛筆",2').rows, [['O1', 'A', '筆,自動鉛筆', '2']]);
  assert.deepEqual(parse('o,s,n,q\nO1,A,"筆\n藍色\r\n細\r\"\"款",2').rows, [['O1', 'A', '筆\n藍色\r\n細\r"款', '2']]);
});
test('A04: malformed quoting fails closed at logical record', () => {
  for (const bad of ['o,s,n,q\nO1,A,"bad', 'o,s,n,q\nO1,A,b"ad,2', 'o,s,n,q\nO1,A,"bad" x,2']) fails(bad, 'CSV_SYNTAX', 1);
  fails('o,s,n,q\nO1,A,"long\nname",1\nO2,A,"bad', 'CSV_SYNTAX', 2);
});
test('A05: shorter and longer data rows fail at record 1', () => {
  fails('o,s,n,q\nO1,A,筆', 'ROW_WIDTH', 1);
  fails('o,s,n,q\nO1,A,筆,1,x', 'ROW_WIDTH', 1);
});
test('A06 bytes: exactly 1 MiB accepted, +1 rejected before decode', () => {
  const exact = bytes('h\n' + 'a'.repeat(CSV_LIMITS.maxBytes - 2));
  assert.equal(parseCsv(exact).rows[0][0].length, CSV_LIMITS.maxBytes - 2);
  assert.throws(() => parseCsv(new Uint8Array(CSV_LIMITS.maxBytes + 1)), { code: 'FILE_TOO_LARGE' });
});
test('A06 rows: exactly 5000 accepted, 5001 rejected (terminal newline ignored)', () => {
  assert.equal(parse('h\n' + 'a\n'.repeat(5000)).rows.length, 5000);
  fails('h\n' + 'a\n'.repeat(5001), 'ROW_LIMIT', 5001);
});
test('A06 columns: exactly 30 accepted, 31 rejected', () => {
  assert.equal(parse(Array.from({ length: 30 }, (_, i) => 'h' + i).join(',')).headers.length, 30);
  fails(Array.from({ length: 31 }, (_, i) => 'h' + i).join(','), 'COLUMN_LIMIT', 0);
});
test('UTF-8 fatal decoding; only first BOM removed', () => {
  assert.throws(() => parseCsv(new Uint8Array([0xc3, 0x28])), { code: 'INVALID_UTF8' });
  assert.deepEqual(parse('\uFEFFh\nv'), { headers: ['h'], rows: [['v']] });
  assert.deepEqual(parse('\uFEFF\uFEFFh\nv').headers, ['\uFEFFh']);
});
test('empty and duplicate headers rejected, exact spaces/case retained', () => {
  for (const input of ['', '\uFEFF', 'a,,b', 'a,a', '"",b']) fails(input, 'HEADER_INVALID', 0);
  assert.deepEqual(parse('a,A, ').headers, ['a', 'A', ' ']);
});
test('only uniform exterior separators accepted; CR, LF, CRLF each valid', () => {
  for (const sep of ['\r', '\n', '\r\n']) assert.deepEqual(parse(`h${sep}a${sep}`).rows, [['a']]);
  for (const input of ['h\na\rb', 'h\r\na\nb', 'h\ra\r\nb']) fails(input, 'CSV_SYNTAX', 1);
});
test('header-only empty dataset and blank records are distinct', () => {
  assert.deepEqual(parse('a,b\n').rows, []);
  assert.deepEqual(parse('h\n\n').rows, [['']]);
  assert.deepEqual(parse('h\n""').rows, [['']]);
  assert.deepEqual(parse('a,b\nx,').rows, [['x', '']]);
});
test('multibyte cap checks bytes, never UTF-16 length', () => {
  assert.throws(() => parseCsv(bytes('h\n筆'), { maxBytes: 4 }), { code: 'FILE_TOO_LARGE' });
  assert.equal(parseCsv(bytes('h\n筆'), { maxBytes: 5 }).rows[0][0], '筆');
});
