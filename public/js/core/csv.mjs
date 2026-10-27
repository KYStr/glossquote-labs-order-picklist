import { CsvError } from './errors.mjs';

export const CSV_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxRows: 5_000, maxColumns: 30 });

export function parseCsv(bytes, limits = CSV_LIMITS) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('CSV_BYTES_REQUIRED');
  const caps = { ...CSV_LIMITS, ...limits };
  for (const value of Object.values(caps)) if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('INVALID_LIMIT');
  if (bytes.byteLength > caps.maxBytes) throw new CsvError('FILE_TOO_LARGE');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new CsvError('INVALID_UTF8'); }
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  if (text === '') throw new CsvError('HEADER_INVALID');

  let headers;
  const rows = [];
  let fields = [];
  let field = '';
  let state = 'start';
  let separator;
  let recordIndex = 0;
  let endedOnSeparator = false;
  const pushField = () => {
    fields.push(field);
    if (fields.length > caps.maxColumns) throw new CsvError('COLUMN_LIMIT', recordIndex);
    field = '';
    state = 'start';
  };
  const pushRecord = () => {
    pushField();
    if (recordIndex === 0) {
      if (fields.some(header => header === '') || new Set(fields).size !== fields.length) throw new CsvError('HEADER_INVALID', 0);
      headers = fields;
    } else {
      if (recordIndex > caps.maxRows) throw new CsvError('ROW_LIMIT', recordIndex);
      if (fields.length !== headers.length) throw new CsvError('ROW_WIDTH', recordIndex, { expected: headers.length, actual: fields.length });
      rows.push(fields);
    }
    fields = [];
    recordIndex++;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    endedOnSeparator = false;
    if (state === 'quoted') {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else state = 'afterQuote';
      } else field += char;
      continue;
    }
    if (char === '\r' || char === '\n') {
      const current = char === '\r' && text[i + 1] === '\n' ? '\r\n' : char;
      if (separator !== undefined && separator !== current) throw new CsvError('CSV_SYNTAX', recordIndex, { reason: 'MIXED_SEPARATOR' });
      separator = current;
      if (current === '\r\n') i++;
      pushRecord();
      endedOnSeparator = true;
    } else if (char === ',') pushField();
    else if (char === '"' && state === 'start') state = 'quoted';
    else if (char === '"' || state === 'afterQuote') throw new CsvError('CSV_SYNTAX', recordIndex, { reason: 'QUOTE_POSITION' });
    else { field += char; state = 'unquoted'; }
  }
  if (state === 'quoted') throw new CsvError('CSV_SYNTAX', recordIndex, { reason: 'UNCLOSED_QUOTE' });
  if (!endedOnSeparator) pushRecord();
  return { headers, rows };
}
