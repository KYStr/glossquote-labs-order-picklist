# 訂單揀貨與裝箱單 / Order pick and packing lists

在此瀏覽器把訂單 CSV 整理為 SKU 總揀貨表與逐單裝箱表。ID/SKU 精確比對，保留前導零；相同 SKU 品名矛盾會拒絕整批。當頁核對可下載 TXT/JSON，不連庫存或物流、不上傳或持久保存輸入。

Turn an order-lines CSV into a consolidated SKU pick sheet and per-order packing lists. Exact identifiers remain strings; conflicting product names block the batch. Checkmarks stay in page memory and can be exported as TXT/JSON.

此 repository 是獨立公開來源供審查；正式站與外部驗收尚未完成。預定 hosting origin 為 https://picklist.glossquote.com，沒有在本階段部署。詳細狀態見 [HANDOFF](HANDOFF.md)。

## Offline reproduction

Node.js 24+，零 runtime/dev dependencies；不需 npm install。

~~~text
npm test
npm run check
npm run build:release
npm run check:release
~~~

- [繁中預覽來源](public/index.html) / [English preview source](public/en/index.html)：原 noindex/nofollow 與候選提示。
- build:release 產生 release-artifacts/site/ 與 sibling manifest.json；正式 canonical、hreflang、robots/sitemap 已固定，僅 banner 使用事實性處理提示。
- release-artifacts 與 evidence 是本機生成／測試目錄，不納入來源。既有輸出若被改過，build/check 拒絕覆寫；請使用乾淨 checkout 重現，勿以刪除未知檔案迴避拒絕。
- 原 npm run build 只產生 dist 預覽；npm run dev 是明確手動選用的 loopback preview，測試不會自行啟動服務或瀏覽器。
- [固定 release manifest](verification/release-manifest.json) 與 build 的輸出逐檔 hash 可比對；此設定不是已部署證據。

## Review evidence

- [公開副本檢查](verification/publication-checks.json)：實際命令／exit 與受影響測試數。
- [主代理 browser 摘要](verification/browser-core-summary.json)：主流程30 PASS、pagehide兩語2 PASS、0 FAIL/prohibited，保留10 NOT_RUN，未轉成PASS。
- [合成 fixtures 與獨立 oracle](fixtures/browser/cases.json)：沒有使用者文件或產品函式生成expected。
- [公開 payload manifest](PUBLISH-MANIFEST.json)：每個公開檔案的 bytes/SHA 與M2A來源對應。
- [M2A 審核來源集](verification/reviewed-source-set.json)：source-set SHA-256 9f1f1f454e44dac3e00d0ed1be9e8093c84027add7acc9ff4d176636cd643749。這是原始審核來源的provenance；公開副本經下述 allowlist 選取及文件整理，不能與此來源集當成同一個hash。

公開副本保留所有public/runtime、必要scripts/test/package/config與產品契約。僅README/HANDOFF改為可攜公開版本；省略內部派工、私人路徑與歷史證據生成器，並附固定合成fixture／安全摘要。未上傳原始執行profile、cookie、憑證、其他工具或完整workspace。

[產品需求](PRODUCT.md) · [技術契約](TECHNICAL.md) · [驗收 oracle](ACCEPTANCE.md) · [介面規格](UX-SEO.md) · [隱私](docs/PRIVACY-SECURITY.md)。規格中的早期狀態為歷史，實際狀態以HANDOFF及驗證摘要為準。
