# 訂單揀貨與裝箱單 / Order pick and packing lists

在此瀏覽器將訂單 CSV 整理成 SKU 總揀貨表與逐單裝箱表。ID/SKU 精確比對並保留前導零；相同 SKU 品名矛盾會拒絕整批。當頁核對可匯出 TXT/JSON，輸入只留在頁面記憶體。

Turn order-line CSV data into a consolidated SKU pick sheet and per-order packing lists. Identifiers stay exact strings; conflicting product names block the batch. Checkmarks can be exported as TXT/JSON.

此 repository 是使用者授權的獨立公開來源供審查；正式 hosting 與外部驗收尚未完成。預定 origin 為 https://picklist.glossquote.com 。本階段沒有部署。詳見 [HANDOFF](HANDOFF.md)。

## Offline reproduction

Node.js 24+，零 runtime/dev dependencies，不需 npm install。在乾淨 clone 執行：

~~~text
npm test
npm run check
npm run build
npm run build:release
npm run check:release
~~~

- [繁中 preview](public/index.html)／[English preview](public/en/index.html) 保留原 noindex 與候選提示。build 只產生 dist 預覽。
- build:release 產生 release-artifacts/site 與 sibling manifest.json；正式 SEO、banner、CSP 與三條固定入口轉址納入精確產物驗證。
- 正式 _redirects 恰為 / → /index.html、/en 與 /en/ → /en/index.html，全部301，使用LF並有尾端LF。此檔的離線核對不等於正式HTTP已驗。
- F03 測試清理先核 owned link／預期目錄 target；Windows 用 rmdir，POSIX 用 unlink，均不遞迴刪 target。整合版 POSIX 尚未在該平台執行。
- 所有 test 檔、helper 與固定合成 fixtures 都保留；generated evidence/dist/release-artifacts 不納入來源。已污染輸出仍由 build/check 拒絕覆寫；使用乾淨 clone 重現。
- npm run dev 是明確手動選用的 loopback preview。測試不啟動 listener、browser 或原生UI。

## Review evidence

- [公開副本檢查](verification/publication-checks.json)：實際命令、exit 與測試範圍。
- [固定 release manifest](verification/release-manifest.json)：16份產物中的 sibling manifest，涵蓋15份 site 檔案；重建應逐 byte 相同。
- [主代理 browser 摘要](verification/browser-core-summary.json)：主流程30 PASS、生命週期兩語2 PASS、0 FAIL/prohibited，10 NOT_RUN 原樣保留。
- [合成 fixtures 與獨立 oracle](fixtures/browser/cases.json)：只含固定假資料。
- [原審查來源集](verification/reviewed-source-set.json)：source-set SHA-256 e9f2311c60c9c0ccb154d51b5b7fd1ea5f2b52fd3b06606d571d170e294b9ed5。公開副本經白名單選取及文件整理，payload digest 與此來源集不同。
- [公開 payload manifest](PUBLISH-MANIFEST.json)：逐檔 bytes/SHA 與來源對應；不包含 manifest 自己以避免循環雜湊。

所有 public/runtime、必要 scripts、package/config、test 和產品契約保留審查 bytes。README/HANDOFF 改為可攜說明；排除內部派工、私人路徑、歷史證據產生器、原始執行 profiles、憑證、其他工具與完整 workspace。

[產品需求](PRODUCT.md) · [技術契約](TECHNICAL.md) · [驗收 oracle](ACCEPTANCE.md) · [介面規格](UX-SEO.md) · [隱私](docs/PRIVACY-SECURITY.md)。早期規格狀態屬歷史，最新驗證範圍以 HANDOFF 為準。
