import { OutputLimitError } from './errors.mjs';

export const OUTPUT_LIMIT = 8_388_608;
export const DOWNLOADS = Object.freeze({ txt: { name: 'order-picklist.txt', mime: 'text/plain;charset=utf-8' }, json: { name: 'order-picklist.json', mime: 'application/json;charset=utf-8' } });

export function snapshotPickLists(result) {
  const quantity = value => {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) throw new TypeError('INVALID_RESULT_QUANTITY');
    return value;
  };
  return {
    schemaVersion: 1,
    tool: 'order-picklist',
    totals: result.totals.map(item => ({ sku: item.sku, name: item.name, quantity: quantity(item.quantity), orderCount: item.orderCount, checked: item.checked === true })),
    orders: result.orders.map(order => ({ orderId: order.orderId, items: order.items.map(item => ({ sku: item.sku, name: item.name, quantity: quantity(item.quantity), checked: item.checked === true })) })),
    counts: { sourceRows: result.counts.sourceRows, skuCount: result.counts.skuCount, orderCount: result.counts.orderCount },
  };
}

export function enforceOutputLimit(txt, json) {
  if (txt.byteLength + json.byteLength > OUTPUT_LIMIT) throw new OutputLimitError();
}

function quoteText(value) {
  if (typeof value !== 'string') throw new TypeError('INVALID_RESULT_TEXT');
  // JSON quoting is reversible and keeps all source fields on one report line.
  // Escape Unicode line separators as well as JSON's built-in C0 escapes.
  return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function serializePickLists(result) {
  const snapshot = snapshotPickLists(result);
  const lines = [
    'Order pick list and packing lists',
    'Checkmarks are page records, not proof of physical picking or packing.',
    String.raw`Text fields use JSON string quoting: \n = LF, \r = CR, \t = tab; \" = quote, \\ = backslash.`,
    `Source rows: ${snapshot.counts.sourceRows} | SKUs: ${snapshot.counts.skuCount} | Orders: ${snapshot.counts.orderCount}`,
    '', 'Total pick sheet',
  ];
  for (const item of snapshot.totals) {
    lines.push(`${item.checked ? '[x]' : '[ ]'} SKU: ${quoteText(item.sku)}`, `    Product: ${quoteText(item.name)}`, `    Quantity: ${item.quantity} | Orders: ${item.orderCount}`);
  }
  lines.push('', 'Per-order packing lists');
  for (const order of snapshot.orders) {
    lines.push('', `Order: ${quoteText(order.orderId)}`);
    for (const item of order.items) lines.push(`${item.checked ? '[x]' : '[ ]'} SKU: ${quoteText(item.sku)}`, `    Product: ${quoteText(item.name)}`, `    Quantity: ${item.quantity}`);
  }
  const encoder = new TextEncoder();
  const txt = encoder.encode(lines.join('\n') + '\n');
  const json = encoder.encode(JSON.stringify(snapshot, null, 2) + '\n');
  enforceOutputLimit(txt, json);
  return { txt, json };
}
