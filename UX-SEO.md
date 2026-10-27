# 介面與搜尋資料：訂單揀貨與裝箱單

狀態：規格，尚未實作。Surface mode：Product App。M1 noindex/nofollow，候選網址 `picklist.glossquote.com` 未驗證前不設 production canonical 或 sitemap。

## 搜尋文案

**繁中 title：** 訂單揀貨與裝箱單｜依 SKU 彙總訂單明細  
**繁中 description：** 在本機將訂單 CSV 轉為 SKU 總揀貨表及逐單裝箱清單，保留商品編號並找出品名衝突。  
**繁中 H1：** 先集中揀貨，再逐單核對

**English title:** Order Pick List and Packing Lists | Group by SKU  
**English description:** Turn a local order-lines CSV into a consolidated SKU pick sheet and per-order packing lists, with exact IDs and conflict checks.  
**English H1:** Pick products together, then pack each order

## 工作區線框

桌面 Wide：

```text
┌────────── 訂單揀貨與裝箱單 ── zh-TW ─────── 待載入 ────────────┐
│步驟 / 列表導覽  │                    工作區                   │ 來源摘要│
│ 1 匯入 CSV      │ [選擇訂單明細 CSV]                           │ 3 列   │
│ 2 欄位對應      │ 訂單ID → [?]  SKU → [?] 品名 → [?] 數量 → [?]│ 4欄上限│
│ 3 總揀貨        │ [預覽揀貨表]                                 │ 本機處理│
│ 4 逐單裝箱      │ SKU | 品名 | 總數 | 訂單數 | 已核 ✓           │        │
│                 │ A   | 筆   | 5    | 2      | □                 │        │
├─────────────────┴──────────────────────────────────────────────┤
│ 訂單 O1：A 筆 ×2 □  B 紙 ×1 □   訂單 O2：A 筆 ×3 □               │
│ 完成 1 / 3   [下載揀貨與裝箱資料]                                │
└─────────────────────────────────────────────────────────────────┘
```

手機 Compact：

```text
┌ 揀貨與裝箱 ─ 狀態 ┐
│ 匯入 → 欄位 → 核對 │
│ [選 CSV]          │
│ 訂單ID / SKU      │
│ 品名 / 數量       │
│ [產生清單]        │
├───────────────────┤
│ 總揀貨             │
│ A · 筆 · 5 · □    │
│ B · 紙 · 1 · □    │
│ [各訂單清單]      │
│ O1 — A×2 □ B×1 □  │
│ O2 — A×3 □        │
│ [下載 TXT] [JSON] │
└───────────────────┘
```

主要畫布是清單本身；mapping 放其前面的單一明確步驟，不要求拖曳。SKU 使用等寬字體便於辨識；checkbox 就在受影響的商品旁。

## 狀態文字

Idle：「選取訂單明細 CSV。」；parsing：「正在讀取 84 列…」；mapping：「請確認訂單編號、SKU、品名和數量欄。」；validating：「正在檢查數量與 SKU 品名…」；result：「已整理 25 個 SKU、18 張訂單。」；empty：「檔案只有欄名，沒有明細可揀。」；blocked duplicate name：「SKU A 在第 2、9 列有不同品名。清單未建立，請修正資料來源。」；quantity fail：「第 4 列數量必須是 1–100,000 的整數。」；running：「正在整理第 500 / 1,200 列…［取消］」；stale：「來源或欄位對應已變，舊清單已作廢。」；success check：「已核對 12 / 25 個 SKU。」這代表頁面標記，不代表已實物揀完。

## 無障礙

資料表使用 `<table>` 標籤及 scope heading；小螢幕表格可在 labeled region 橫捲，周圍按鈕不隨之離開畫面。checkbox 具有完整文字名稱如「已核對 SKU A，筆，5 件」；Space 操作、Tab 順序穩定。主要 touch target 至少 44×44px；不靠顏色表示衝突／已核對。320px、200% zoom、4.5:1 文字對比、明顯 focus 和 reduced-motion 都是 browser gate。

## FAQ

### 繁體中文

**相同品名的不同 SKU 會合併嗎？** 不會；只按 SKU 精確合併。  
**重複的訂單／SKU 列會怎樣？** 數量會加總，並保留第一次出現的順序。  
**會讀取地址或扣庫存嗎？** 不會；工具只接受四個訂單明細欄位，不連到庫存或物流系統。

### English

**Will different SKUs with the same name be merged?** No. Only exact SKU strings are grouped.  
**What happens to repeated order/SKU rows?** Their quantities are added while preserving first-seen order.  
**Does this read addresses or change inventory?** No. It uses four order-line fields and has no inventory or shipping connection.

## Browser gate

Node tests can verify parser, validation, exact totals and JSON schema. Actual file selection, checkbox keyboard operation, screen reflow, download and no-network behavior remain **NOT_RUN_USER_FOCUS_INCIDENT** until primary confirms a truly isolated browser execution surface. No OS print or save dialog may be triggered during tests.
