# 產品需求：訂單揀貨與裝箱單

狀態：規格，尚未實作。目標使用者是小店包貨人員，先把同 SKU 的訂單行加總成倉庫走貨清單，再逐訂單檢查箱內品項。

## MVP 決策

- 輸入單一 UTF-8 CSV，必須有唯一非空標題列；第一個 BOM 可去除。檔案 ≤1 MiB、資料列 ≤5,000、欄 ≤30；使用者映射 order ID、SKU、product name、quantity 四欄。
- CSV 依 RFC 4180 常見 quoting，接受 CRLF/LF/CR 之一作一致 record separator。Malformed quoting、不同列欄數、無效 UTF-8、空／重複欄名拒絕。值保留字串，ID/SKU 不 trim、不轉數字。
- order ID、SKU、品名必須非空（精確空字串視空）；空白字元不是空值，保留為內容。ID/SKU 僅以精確字串比對，`001 !== 1`。
- 數量只接受 ASCII 十進位整數字串；允許前導零，但解析為正整數 1–100,000。禁止正負號、小數、千分位、指數、內外空格及 Unicode digits。以 `BigInt` parse；任一 SKU 全表累計與任一 order/SKU 合計均不得超過 1,000,000,000。
- 相同 SKU 若出現不同品名字串（exact）屬歧義，整批拒絕，不按第一筆選名。相同 order ID + SKU 重複行可加總，並保留首見順序。
- 成功後提供 total pick sheet 和逐訂單 packing lists；頁面勾選僅當前分頁狀態，可下載固定名稱 `order-picklist.txt` 和 `order-picklist.json`。無地址/付款欄匯出。

## 功能需求

### FR-01：檔案與 CSV

byte cap 1,048,576；標題後 ≤5,000 rows；≤30 columns。採嚴格 parser：quoted comma、`""`、quoted CRLF/LF/CR；外部 record separator 同檔一致；末尾 newline 不算空列。非 UTF-8、malformed quote、mixed record separator、row width error、duplicate/empty header 都有固定錯碼與 record index。任何超限整檔拒絕。

### FR-02：欄位映射和資料列驗證

使用者為 orderId、sku、name、quantity 各選一個不同 header；不得重複選相同欄。映射前顯示 headers 和兩筆樣本。每列前三欄 `value !== ''`；數量需符合 `^[0-9]+$`，再 `BigInt` 範圍檢查。`0001` 允許，數值計算 1；order ID/SKU 保留 `0001` 原樣。行錯誤最多先顯示 20 筆細節及總數；有任一錯誤即不產出 partial list。

### FR-03：SKU 品名一致性

依第一筆出現順序建立 `Map<sku,{name,total,...}>`；同 SKU 後續品名必須與首筆 exact `===`。不套 NFC、不 trim、不 case-fold；品名衝突列出 SKU、row index 和兩種品名，阻止全批。相同品名的 SKU 彼此絕不合併。

### FR-04：彙總和每單裝箱

每輸入 row 依序加到 SKU totals 和該 order 的 items；SKU totals 順序 = SKU 首次出現順序；orders 順序 = order ID 首次出現順序；單內 items 順序 = SKU 首次在該 order 出現順序。重複 order+SKU 行累加。逐次累加以 BigInt，若任一SKU total或order/SKU總量 >1,000,000,000，拒絕 `TOTAL_TOO_LARGE`。

例：`O1,A,筆,2; O2,A,筆,3; O1,B,紙,1` => pick A 5、B 1；O1 A 2/B 1；O2 A 3。

### FR-05：完成核對

總揀貨表每一 SKU 有可勾 checkbox、SKU、品名、總件數和包含該 SKU 的訂單數。各訂單區塊顯示訂單 ID、item 列和數量，可逐項勾核。勾選存 page memory；結果或來源變更即清空。完成率是 checkboxes checked/total，不宣稱貨品已實際入箱。

### FR-06：輸出 schema

JSON schemaVersion=1：

```json
{
  "schemaVersion": 1,
  "tool": "order-picklist",
  "totals": [{"sku":"A","name":"筆","quantity":5,"orderCount":2,"checked":false}],
  "orders": [{"orderId":"O1","items":[{"sku":"A","name":"筆","quantity":2,"checked":true}]}],
  "counts": {"sourceRows":3,"skuCount":2,"orderCount":2}
}
```

JSON 和 TXT 合計輸出上限 8 MiB；UTF-8 byte cap 在 Blob 建立前檢查。TXT 使用固定 heading 和所有原始識別字串；filename 固定，不將欄值轉成路徑。下載不含客戶地址、付款、email、電話。

### FR-07：狀態、取消、stale 與清理

`idle → parsing → mapping → validating → ready → aggregating → result`。錯誤為 `blocked`，取消回 `mapping`。換檔、映射變更、reset 使 generation++，清結果／checks／Blob URLs；舊 run 不可覆蓋新狀態。聚合可同步；每 100 rows yield 並檢查 AbortSignal，cancel 不輸出 partial result。Reset/pagehide 清 File、rows、map、結果，revoke URL。沒有 browser storage。

## 錯誤碼與非目標

`FILE_TOO_LARGE`, `INVALID_UTF8`, `CSV_SYNTAX`, `ROW_WIDTH`, `HEADER_INVALID`, `ROW_LIMIT`, `COLUMN_LIMIT`, `MAPPING_INVALID`, `REQUIRED_VALUE_EMPTY`, `QUANTITY_SYNTAX`, `QUANTITY_RANGE`, `SKU_NAME_CONFLICT`, `TOTAL_TOO_LARGE`, `OUTPUT_TOO_LARGE`, `CANCELLED`。不支援庫存扣減、訂單付款狀態、客戶地址、配送/分批/套組/BOM、barcode、外部連結或安全庫存建議。
