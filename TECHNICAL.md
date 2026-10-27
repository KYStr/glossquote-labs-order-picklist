# 技術契約：訂單揀貨與裝箱單

狀態：規格，尚未實作。使用原生 HTML/CSS/瀏覽器 ESM、Node.js 24+ 內建模組、node:test；runtime 無 dependencies。Node 僅開發／測試／build。正式候選為靜態瀏覽器工具，不連外、不上傳、不用框架、CDN、外部字型或第三方 API。

## 建議檔案樹

```text
package.json
public/index.html
public/styles/app.css
public/js/app.js
public/js/core/csv.mjs
public/js/core/orders.mjs
public/js/core/export.mjs
scripts/serve.mjs
scripts/check.mjs
scripts/build.mjs
test/csv.test.mjs
test/orders.test.mjs
test/export.test.mjs
```

產品獨立，不 import sibling source。共用安全、品牌、工程規則由 `docs/PRIVACY-SECURITY.md`、`docs/BRAND.md`、`docs/ENGINEERING.md`、`docs/DESIGN-SYSTEM.md` 提供。

## 純函式介面

```js
parseCsv(bytes, limits = { maxBytes: 1_048_576, maxRows: 5000, maxColumns: 30 })
// -> { headers: string[], rows: string[][] } | CsvError

validateLine(row, mapping, rowIndex)
// -> { orderId, sku, name, quantity: bigint } | RowIssue[]

buildPickLists(parsed, mapping, { signal, onProgress })
// -> { totals: PickTotal[], orders: OrderList[], counts } | OrderError

serializePickLists(result)
// -> { txt: Uint8Array, json: Uint8Array } | OutputLimitError
```

Parser採 byte cap first、fatal UTF-8、single leading BOM removal、strict quote state machine、exact header / row width；only uniform CRLF/LF/CR exterior record separator is accepted, quoted values preserve embedded separators. `001` remains ID/SKU string. Quantity accepts only ASCII `[0-9]+`, parse via `BigInt`, bounds `1n..100000n`; do not call `Number` before validation.

Aggregate in one pass. `Map` preserves insertion order; `skuMap` maps exact SKU to first-seen exact name and BigInt total; `ordersMap` maps exact order ID to per-order SKU map. On each row compare exact name and add quantity; run limits immediately. Keep original input order references only as long as needed. Before DOM, convert validated quantities to base-10 strings for display and JSON to avoid unsafe integer loss. HTML data is inserted by `textContent`.

## 處理狀態、取消、清理

UI runner has generation integer and AbortController. States: `idle`, `parsing`, `mapping`, `validating`, `ready`, `aggregating`, `result`, `stale`, `blocked`, `cancelled`. Change source/mapping first invalidates `result` synchronously and disables download. Aggregate runner yields every 100 input rows; after each yield rechecks abort and generation. On cancel discard totals/orders arrays. Reset clears File references, parser data, maps, checkbox state and output bytes. Blob URL is revoked on re-export, reset and `pagehide`; no persistent storage.

Progress copy reports processed row counts; never user data. User file names are text only. Checkbox state is local page state and excluded from no-upload interactions except explicitly exported JSON; JSON only records the checkbox values at time of export. Exports use fixed safe names and TXT/JSON MIME types. Total artifact bytes cap 8,388,608 across both outputs.

## 命令與 build

ESM private package, no dependencies. `npm test` = `node --test`; `npm run check` = `node scripts/check.mjs`; `npm run build` = `node scripts/build.mjs`; future local preview on `127.0.0.1:4224`, static root `public/`. `build` copies only reviewed `public/` files into `dist/`. This spec phase does not install packages or start any server/browser.

## Official sources

- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html) describes common CSV quoting and acknowledges implementation variations; this product deliberately accepts a specified strict subset.
- [ECMAScript Map](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects) defines insertion-ordered key collections; required first-seen output order is an explicit product rule.
- [ECMAScript BigInt](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-bigint-objects) supports exact integer accumulation beyond safe Number arithmetic; serialized quantities are decimal strings where needed.
