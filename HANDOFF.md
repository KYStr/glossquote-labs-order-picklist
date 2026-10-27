# Order picklist source-publication handoff

日期：2026-10-27（Asia/Taipei）。狀態：F03 與入口轉址來源已經主代理審查，獨立公開來源更新；正式 hosting 未部署，外部驗收待辦。Repository: https://github.com/KYStr/glossquote-labs-order-picklist 。本版以 Git commit 與 [PUBLISH-MANIFEST](PUBLISH-MANIFEST.json) 為準。

## Reviewed source and artifacts

原審查 source-set SHA-256：e9f2311c60c9c0ccb154d51b5b7fd1ea5f2b52fd3b06606d571d170e294b9ed5。前次公開 commit 為 9d715f17686e95f76ca97192b7eca79dd72fc3a4，本版保留其歷史。

F03 只修測試 directory link 的 owned path/type/target 核對與平台清理；普通檔案／目錄、越界與錯誤 target 拒絕，原產品 oracle 與空 target 案例保留，哨兵 bytes 不變。

入口修正只在 release generator 增加固定 _redirects 與 manifest 項目；原14份 site bytes、public/runtime、CSP、canonical/index.html 與 Wrangler config 不變。三條LF規則為 / /index.html 301、/en /en/index.html 301、/en/ /en/index.html 301；檔案共65 bytes且有尾端LF。

固定 release artifact aggregate SHA-256：18d0b11120e5ab361c15f7a21ef37389f6d52619bb4390edf6fd2dc229aca210。16檔／69547 bytes（15份site＋sibling manifest）。release manifest 本身 SHA-256：a89639a1e1129b5f60cf638ed22aa3851b650c0a830a5ed30a973278e65f44e4。

compatibility_date=2026-10-24；assets-only，html_handling=none，沒有 runtime Worker 或 storage binding。設定與規則檔不是已部署／已驗HTTP轉址的證明。

## Validation scope

- 原 F03 Windows 完整 suite 71/71、check PASS；後續入口修正 release suite 24/24、check/build:release/check:release PASS。主代理固定副本另驗 preview build、release tests、check、release build/check，五項exit0，產物逐 byte 相同。
- 本次公開副本與遠端重現的實際命令另記於 [publication-checks](verification/publication-checks.json) 與發布回條。可用 [README](README.md) 的五項離線命令從乾淨 clone 重現；所有 test/helper 和固定合成 fixtures 齊全。
- Windows junction 清理有本機驗證；整合版 POSIX 分支 NOT_RUN_LOCAL_PLATFORM，不把外部候選的結果當成整合版PASS。
- 主代理既有真隔離 browser：主流程30 PASS、生命週期兩語2 PASS，0 FAIL/prohibited，兩次 cleanup PASS。本輪沒有再操作 browser/native UI。
- 原10 NOT_RUN保留：兩語各自精確source事件競態、真200% zoom、native chooser/save/print、真機/AT、exact8MiB browser boundary。
- 正式 HTTP 301、Cloudflare routing 與外部驗收仍待後續流程。來源公開、hosting、外部驗收分開記錄。

## Portable contents

41份核准來源保持原bytes；README/HANDOFF 是本輪可攜整理。必要 scripts/test/package/config、產品規格與四份品牌／設計／工程／隱私文件保留。固定 fixture 及 [browser summary](verification/browser-core-summary.json) 僅為假資料和安全摘要，沒有原始 profiles、cookie、憑證或工作區路徑。完整選取／排除理由見 [PUBLISH-MANIFEST](PUBLISH-MANIFEST.json)。

[Reviewed source inventory](verification/reviewed-source-set.json)、[release manifest](verification/release-manifest.json)、[fixture list](fixtures/browser/cases.json) 均在 repository 內。主代理接續獨立核對遠端、免費hosting與雙語首頁；此階段沒有部署或自動部署設定。
