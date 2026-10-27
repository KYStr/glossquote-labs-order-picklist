import { COPY } from './copy.mjs';
import { PickSession, DownloadLease } from './core/session.mjs';
import { MAPPING_FIELDS } from './core/orders.mjs';
import { renderSamples, renderResults, node } from './view.mjs';

const locale = document.body.dataset.locale === 'en' ? 'en' : 'zh';
const copy = COPY[locale];
const number = new Intl.NumberFormat(locale === 'zh' ? 'zh-TW' : 'en');
const format = value => number.format(value);
const byId = id => document.getElementById(id);
const elements = Object.fromEntries(['status', 'progress-area', 'progress', 'cancel', 'errors', 'error-summary', 'error-details', 'source', 'source-summary', 'source-name', 'csv-file', 'load-sample', 'mapping-area', 'samples', 'mapping-error', 'generate', 'reset', 'results', 'result-summary', 'pick-sheet', 'packing-lists', 'pick-progress', 'packing-progress', 'download-txt', 'download-json'].map(id => [id, byId(id)]));
const selects = Object.fromEntries(MAPPING_FIELDS.map(field => [field, byId(`map-${field}`)]));
const lease = new DownloadLease(URL, Blob);
let renderedResult = null;
let orderProgress = [];

function clearResultView() {
  renderedResult = null; orderProgress = [];
  elements['pick-sheet'].replaceChildren(); elements['packing-lists'].replaceChildren();
  elements['result-summary'].textContent = ''; elements['pick-progress'].textContent = ''; elements['packing-progress'].textContent = '';
}
function clearMappingView() {
  elements.samples.replaceChildren();
  for (const select of Object.values(selects)) {
    const option = node(document, 'option', copy.choose); option.value = '';
    select.replaceChildren(option); select.removeAttribute('aria-invalid');
  }
}
function showError(error) {
  elements.errors.hidden = !error;
  elements['error-summary'].textContent = ''; elements['error-details'].replaceChildren();
  if (!error) return;
  const message = copy.errors[error.code] ?? copy.errors.UNEXPECTED;
  elements['error-summary'].textContent = `${error.code ?? 'UNEXPECTED'} · ${message}`;
  if (error.recordIndex !== undefined) elements['error-details'].append(node(document, 'li', copy.csvIssue(error.recordIndex, message)));
  if (error.issues?.length) {
    elements['error-summary'].append(document.createTextNode(' ' + copy.errorCount(format(error.issues.length), format(error.issueCount))));
    error.issues.forEach(issue => {
      const detail = issue.code === 'SKU_NAME_CONFLICT' ? copy.conflict(issue) : copy.rowIssue(issue.rowIndex, copy.fields[issue.field] ?? copy.sku, copy.errors[issue.code] ?? message);
      elements['error-details'].append(node(document, 'li', detail, 'exact-value'));
    });
  }
}
function updateChecks(session) {
  const result = session.result;
  if (!result) return;
  elements['pick-progress'].textContent = copy.picked(format(result.totals.filter(item => item.checked).length), format(result.totals.length));
  let checked = 0; let total = 0;
  result.orders.forEach((order, index) => {
    const count = order.items.filter(item => item.checked).length;
    checked += count; total += order.items.length;
    orderProgress[index].textContent = copy.orderProgress(format(count), format(order.items.length));
  });
  elements['packing-progress'].textContent = copy.packed(format(checked), format(total));
}
function paint(session, event) {
  const busy = ['parsing', 'validating', 'ready', 'aggregating'].includes(session.state);
  elements.status.dataset.state = session.state;
  elements.status.textContent = event === 'cancelled' ? copy.states.cancelled : copy.states[session.state];
  elements['progress-area'].hidden = !busy;
  elements.cancel.disabled = !session.controller;
  if (session.progress && session.state !== 'ready') {
    const p = session.progress;
    elements.progress.max = Math.max(p.total, 1); elements.progress.value = p.processed;
    elements.status.textContent = copy.progress(p.phase, format(p.processed), format(p.total));
  } else elements.progress.removeAttribute('value');
  elements.source.setAttribute('aria-busy', String(busy));
  elements.results.setAttribute('aria-busy', 'false');
  elements.reset.disabled = session.state === 'idle';
  elements['source-name'].textContent = session.sourceName;
  elements['mapping-area'].hidden = !session.parsed;
  if (!session.parsed && ['source', 'reset'].includes(event)) clearMappingView();
  if (event === 'parsed') {
    renderSamples(document, elements.samples, session.parsed, copy);
    for (const select of Object.values(selects)) {
      const options = [node(document, 'option', copy.choose)]; options[0].value = '';
      session.parsed.headers.forEach((header, index) => { const option = node(document, 'option', header); option.value = String(index); options.push(option); });
      select.replaceChildren(...options); select.value = ''; select.removeAttribute('aria-invalid');
    }
  }
  const validMapping = session.isMappingValid();
  const hasMapping = Object.keys(session.mapping).length > 0;
  elements['mapping-error'].hidden = !hasMapping || validMapping;
  elements['mapping-error'].textContent = hasMapping && !validMapping ? copy.errors.MAPPING_INVALID : '';
  for (const [field, select] of Object.entries(selects)) {
    const duplicate = Object.entries(session.mapping).some(([other, index]) => other !== field && index === session.mapping[field]);
    select.setAttribute('aria-invalid', String(hasMapping && (!Number.isInteger(session.mapping[field]) || session.mapping[field] < 0 || duplicate)));
  }
  elements.generate.disabled = busy || !validMapping || !session.parsed?.rows.length;
  elements['source-summary'].textContent = session.parsed ? copy.imported(format(session.parsed.rows.length), format(session.parsed.headers.length)) : session.sourceName || copy.states.idle;
  if (session.parsed?.rows.length === 0) elements.status.textContent = copy.empty;
  else if (event === 'parsed' && session.sourceKind === 'sample') elements.status.textContent = copy.sample;
  showError(session.error);
  elements.results.hidden = !session.result;
  elements['download-txt'].disabled = elements['download-json'].disabled = !session.result || session.state !== 'result';
  if (!session.result) clearResultView();
  else {
    if (renderedResult !== session.result) {
      renderedResult = session.result;
      orderProgress = renderResults(document, { pick: elements['pick-sheet'], orders: elements['packing-lists'] }, session.result, copy, format, (kind, index, itemIndex, checked) => session.setChecked(kind, index, itemIndex, checked));
      const { skuCount, orderCount, sourceRows } = session.result.counts;
      elements['result-summary'].textContent = copy.resultSummary(format(skuCount), format(orderCount), format(sourceRows));
    }
    updateChecks(session);
    if (event === 'checks') elements.status.textContent = elements['pick-progress'].textContent + ' · ' + elements['packing-progress'].textContent;
  }
  if (['source', 'reset'].includes(event)) elements.source.open = true;
}

const session = new PickSession({ onChange: paint, onInvalidate: () => lease.clear() });
elements['csv-file'].addEventListener('change', () => {
  const file = elements['csv-file'].files[0];
  if (file) void session.loadFile(file);
  elements['csv-file'].value = '';
});
elements['load-sample'].addEventListener('click', () => {
  const bytes = new TextEncoder().encode('Order ID,SKU,Product,Quantity,Ignored note\r\nDEMO-001,001,Blue pen,2,Fake data\r\nDEMO-002,001,Blue pen,3,Fake data\r\nDEMO-001,PAPER,Plain notebook,1,Fake data\r\nDEMO-003,1,Blue pen,1,Fake data\r\nDEMO-001,001,Blue pen,2,Fake data');
  void session.loadSource({ name: 'example-order-lines.csv', size: bytes.length, read: async () => bytes, kind: 'sample' });
});
for (const [field, select] of Object.entries(selects)) select.addEventListener('change', () => session.setMapping(field, select.value === '' ? -1 : Number(select.value)));
elements.generate.addEventListener('click', async () => {
  if (await session.run()) { elements.source.open = false; byId('pick-heading').focus(); }
  else if (session.state === 'blocked') byId('error-heading').focus();
});
elements.cancel.addEventListener('click', () => { session.cancel(); if (!elements.generate.disabled) elements.generate.focus(); });
elements.reset.addEventListener('click', () => { session.reset(); elements['csv-file'].value = ''; elements['csv-file'].focus(); });
for (const format of ['txt', 'json']) elements[`download-${format}`].addEventListener('click', () => {
  const output = session.prepareDownload();
  if (!output) return;
  try {
    const download = lease.create(format, output);
    const anchor = node(document, 'a'); anchor.href = download.url; anchor.download = download.name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    elements.status.textContent = copy.exported(format);
  } catch { session.fail({ code: 'UNEXPECTED' }); }
});
window.addEventListener('pagehide', () => { session.reset(); elements['csv-file'].value = ''; });
paint(session, 'reset');
