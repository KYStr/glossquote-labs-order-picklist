import { parseCsv, CSV_LIMITS } from './csv.mjs';
import { buildPickLists, validateMapping, MAPPING_FIELDS } from './orders.mjs';
import { serializePickLists, DOWNLOADS, enforceOutputLimit } from './export.mjs';
import { CsvError } from './errors.mjs';

export class PickSession {
  constructor({ onChange = () => {}, onInvalidate = () => {} } = {}) {
    this.onChange = onChange; this.onInvalidate = onInvalidate;
    this.generation = 0; this.controller = null;
    this.state = 'idle'; this.parsed = null; this.mapping = {};
    this.result = null; this.output = null; this.error = null; this.progress = null;
    this.file = null; this.sourceName = ''; this.sourceKind = null;
  }
  emit(event = 'state') { this.onChange(this, event); }
  invalidate(state) {
    this.generation++;
    this.controller?.abort(); this.controller = null;
    this.result = null; this.output = null; this.error = null; this.progress = null;
    this.state = state; this.onInvalidate();
    return this.generation;
  }
  fail(error) {
    this.result = null; this.output = null; this.progress = null;
    this.error = error; this.state = 'blocked'; this.onInvalidate(); this.emit('error');
  }
  async loadSource({ name, size, read, kind = 'file', file = null }) {
    const generation = this.invalidate('parsing');
    this.parsed = null; this.mapping = {}; this.file = file;
    this.sourceName = name; this.sourceKind = kind; this.emit('source');
    try {
      if (size > CSV_LIMITS.maxBytes) throw new CsvError('FILE_TOO_LARGE');
      const bytes = await read();
      if (generation !== this.generation) return false;
      this.parsed = parseCsv(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      this.state = 'mapping'; this.emit('parsed'); return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.fail(error?.code ? error : { code: 'READ_FAILED' }); return false;
    } finally { if (generation === this.generation) this.file = null; }
  }
  loadFile(file) { return this.loadSource({ name: file.name, size: file.size, read: () => file.arrayBuffer(), file }); }
  setMapping(field, index) {
    if (!this.parsed || !MAPPING_FIELDS.includes(field)) return;
    this.invalidate('stale'); this.mapping = { ...this.mapping, [field]: index }; this.emit('mapping');
  }
  isMappingValid() {
    try { validateMapping(this.parsed?.headers ?? [], this.mapping); return true; }
    catch { return false; }
  }
  async run() {
    if (!this.parsed) return false;
    const parsed = this.parsed; const mapping = { ...this.mapping };
    const generation = this.invalidate('validating');
    const controller = new AbortController(); this.controller = controller; this.emit('running');
    try {
      const result = await buildPickLists(parsed, mapping, {
        signal: controller.signal,
        onProgress: progress => {
          if (generation !== this.generation || controller.signal.aborted) return;
          this.progress = progress; this.state = progress.phase; this.emit('progress');
        },
      });
      if (generation !== this.generation || controller.signal.aborted) return false;
      const output = serializePickLists(result);
      this.result = result; this.output = output; this.progress = null;
      this.state = 'result'; this.emit('result'); return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      if (error?.code === 'CANCELLED') { this.state = 'mapping'; this.progress = null; this.emit('cancelled'); }
      else this.fail(error?.code ? error : { code: 'UNEXPECTED' });
      return false;
    } finally { if (generation === this.generation) this.controller = null; }
  }
  cancel() {
    if (!this.controller) return;
    this.invalidate('mapping'); this.emit('cancelled');
  }
  setChecked(kind, index, itemIndex, checked) {
    if (this.state !== 'result' || !this.result) return;
    const item = kind === 'pick' ? this.result.totals[index] : this.result.orders[index]?.items[itemIndex];
    if (!item || typeof checked !== 'boolean') return;
    item.checked = checked; this.output = null; this.onInvalidate(); this.emit('checks');
  }
  prepareDownload() {
    if (this.state !== 'result' || !this.result) return null;
    try { this.output = serializePickLists(this.result); return this.output; }
    catch (error) { this.fail(error); return null; }
  }
  reset() {
    this.invalidate('idle'); this.parsed = null; this.mapping = {};
    this.file = null; this.sourceName = ''; this.sourceKind = null; this.emit('reset');
  }
}

export class DownloadLease {
  constructor(urlApi, BlobType) { this.urlApi = urlApi; this.BlobType = BlobType; this.url = null; }
  clear() { if (this.url) this.urlApi.revokeObjectURL(this.url); this.url = null; }
  create(format, output) {
    if (!Object.hasOwn(DOWNLOADS, format)) throw new TypeError('INVALID_FORMAT');
    enforceOutputLimit(output.txt, output.json);
    this.clear();
    this.url = this.urlApi.createObjectURL(new this.BlobType([output[format]], { type: DOWNLOADS[format].mime }));
    return { url: this.url, name: DOWNLOADS[format].name };
  }
}
