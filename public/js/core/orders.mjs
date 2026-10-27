import { OrderError } from './errors.mjs';

export const MAPPING_FIELDS = Object.freeze(['orderId', 'sku', 'name', 'quantity']);
export const MAX_TOTAL = 1_000_000_000n;

export function validateMapping(headers, mapping) {
  if (!mapping || Object.keys(mapping).length !== 4 || !MAPPING_FIELDS.every(key => Object.hasOwn(mapping, key))) throw new OrderError('MAPPING_INVALID');
  const values = MAPPING_FIELDS.map(key => mapping[key]);
  if (new Set(values).size !== 4 || values.some(value => !Number.isInteger(value) || value < 0 || value >= headers.length)) throw new OrderError('MAPPING_INVALID');
  return mapping;
}

export function validateLine(row, mapping, rowIndex) {
  const issues = [];
  const values = {};
  for (const key of ['orderId', 'sku', 'name']) {
    const value = row[mapping[key]];
    if (typeof value !== 'string' || value === '') issues.push({ code: 'REQUIRED_VALUE_EMPTY', rowIndex, field: key });
    values[key] = value;
  }
  const raw = row[mapping.quantity];
  let quantity;
  if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) issues.push({ code: 'QUANTITY_SYNTAX', rowIndex, field: 'quantity' });
  else {
    // Bound the significant digits before allocating a potentially huge BigInt.
    const significant = raw.replace(/^0+/, '') || '0';
    if (significant.length > 6) issues.push({ code: 'QUANTITY_RANGE', rowIndex, field: 'quantity' });
    else {
      quantity = BigInt(significant);
      if (quantity < 1n || quantity > 100_000n) issues.push({ code: 'QUANTITY_RANGE', rowIndex, field: 'quantity' });
    }
  }
  return issues.length ? issues : { ...values, quantity };
}

export function checkCancelled(signal) {
  if (signal?.aborted) throw new OrderError('CANCELLED');
}

const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

export async function buildPickLists(parsed, mapping, { signal, onProgress = () => {} } = {}) {
  validateMapping(parsed.headers, mapping);
  checkCancelled(signal);
  const valid = [];
  const issues = [];
  let issueCount = 0;
  const total = parsed.rows.length;
  const addIssue = issue => { issueCount++; if (issues.length < 20) issues.push(issue); };
  const checkpoint = async (phase, processed) => {
    onProgress({ phase, processed, total });
    await yieldTask();
    checkCancelled(signal);
  };
  await checkpoint('validating', 0);
  for (let i = 0; i < total; i++) {
    const line = validateLine(parsed.rows[i], mapping, i + 1);
    if (Array.isArray(line)) line.forEach(addIssue);
    else valid.push({ ...line, rowIndex: i + 1 });
    if ((i + 1) % 100 === 0) await checkpoint('validating', i + 1);
  }
  checkCancelled(signal);
  if (issueCount) throw new OrderError(issues[0].code, { issues, issueCount });
  await checkpoint('ready', total);
  const skuMap = new Map();
  const orderMap = new Map();
  for (let i = 0; i < valid.length; i++) {
    const { orderId, sku, name, quantity, rowIndex } = valid[i];
    let pick = skuMap.get(sku);
    if (!pick) { pick = { sku, name, quantity: 0n, orderIds: new Set(), rowIndex }; skuMap.set(sku, pick); }
    if (pick.name !== name) {
      addIssue({ code: 'SKU_NAME_CONFLICT', rowIndex, firstRowIndex: pick.rowIndex, sku, firstName: pick.name, name });
    }
    pick.quantity += quantity;
    pick.orderIds.add(orderId);
    let order = orderMap.get(orderId);
    if (!order) { order = new Map(); orderMap.set(orderId, order); }
    let item = order.get(sku);
    if (!item) { item = { sku, name, quantity: 0n }; order.set(sku, item); }
    item.quantity += quantity;
    if (pick.quantity > MAX_TOTAL || item.quantity > MAX_TOTAL) throw new OrderError('TOTAL_TOO_LARGE', { issues: [{ code: 'TOTAL_TOO_LARGE', rowIndex, sku }] });
    if ((i + 1) % 100 === 0) await checkpoint('aggregating', i + 1);
  }
  await checkpoint('aggregating', total);
  if (issueCount) throw new OrderError('SKU_NAME_CONFLICT', { issues, issueCount });
  const totals = [...skuMap.values()].map(item => ({ sku: item.sku, name: item.name, quantity: Number(item.quantity), orderCount: item.orderIds.size, checked: false }));
  const orders = [...orderMap].map(([orderId, items]) => ({ orderId, items: [...items.values()].map(item => ({ ...item, quantity: Number(item.quantity), checked: false })) }));
  return { totals, orders, counts: { sourceRows: total, skuCount: totals.length, orderCount: orders.length } };
}
