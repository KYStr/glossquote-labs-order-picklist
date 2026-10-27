# 實作任務：訂單揀貨與裝箱單

狀態：規格，尚未實作。Node 24+ ESM，零 runtime dependencies；不 `npm install`。本規格階段不啟動 server/browser。真 browser gate 依 focus incident 暫記 `NOT_RUN_USER_FOCUS_INCIDENT`，待主驗提供確實隔離的方式。

1. **T00 — Scaffold / contract check。** 前置：規格及主編共用文件。Allowed paths：本專案 `package.json`, `.gitignore`, `scripts/**`, `public/**`, `test/**`, `dist/**`, `HANDOFF.md`, `TASK-ENTRY.md`, `evidence/m1/**`。設 ESM private package、Node test/check/build/dev；dev loopback-only `127.0.0.1:4224`。驗收 `node scripts/check.mjs`，確認 build source allowlist。完成：零依賴和真實腳本；寫 HANDOFF。
2. **T10 — CSV parser and line validation。** 前置 T00 PASS。新增 parser core + unit tests。實作 strict UTF-8/CSV、caps、四欄不同 mapping、required values、quantity regex/BigInt bounds。驗收 `node --test test/csv.test.mjs test/orders.test.mjs`，核對 A01–A08、A13–A15。完成：非法來源一律整批拒絕；寫 HANDOFF。
3. **T20 — aggregation and exports。** 前置 T10 PASS。新增 stable insertion-order maps、品名 conflict、sum caps、schema/TXT、8 MiB combined output check。驗收 `npm test`，核對 A09–A12、A16–A20。完成：總表與各單 totals 不丟列、不混 SKU；寫 HANDOFF。
4. **T30 — Bilingual Product App。** 前置 T20 PASS。建立 source selection, column mapping, pick sheet, packing lists, checkboxes, download. DOM insertion text-only。驗收 `npm run check` + `npm run build`；browser gate 只有隔離可用才跑。完成：工作結果是畫布主體、各狀態清楚；寫 HANDOFF。
5. **T40 — lifecycle and safety。** 前置 T30 PASS。加入 progress, AbortController, generation invalidation, stale/cancel, reset/pagehide clearing and blob cleanup; no storage/remote resource. 驗收 `npm test`, `npm run check`, `npm run build`。完成：source/mapping change kills old export and checks；寫 HANDOFF。
6. **T50 — UX/accessibility/final M1。** 前置 T40 PASS。完成兩語 meta/H1/FAQ、noindex、keyboard, aria, 320px, 200% zoom, reduced-motion. 驗收 final `npm test`, `npm run check`, `npm run build` each once；真 browser not run 如實登記。Allowed paths 同 T00。完成：HANDOFF 載明每個 gate 的 PASS/FAIL/NOT_RUN，無超範圍 changes；不得未經主驗另指令發布。

每項完成需回寫 HANDOFF。失敗時停在當前項，不提前勾後項；修復後只重跑受影響的檢查。
