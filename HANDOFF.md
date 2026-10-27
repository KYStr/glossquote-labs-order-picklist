# Order picklist source-publication handoff

日期：2026-10-27（Asia/Taipei）。狀態：獨立公開來源供審查；正式 hosting 未部署，外部待驗。Repository: https://github.com/KYStr/glossquote-labs-order-picklist 。當前版本以 Git commit 與 [PUBLISH-MANIFEST](PUBLISH-MANIFEST.json) 為準。

## Reviewed product

M2A source-set SHA-256：9f1f1f454e44dac3e00d0ed1be9e8093c84027add7acc9ff4d176636cd643749。
固定 release artifact aggregate SHA-256：269e622f3ff4184b226b5a1605c9d5e9e833ef10e4e79bfe38a411c9e88d7bba；15檔共69339 bytes（site14檔＋sibling manifest）。

原 public/dist preview 保持 noindex 與候選提示；正式 release 只用事實性banner，兩語 canonical/hreflang、robots/sitemap、CSP與runtime維持已審核契約。Wrangler compatibility_date=2026-10-24；純static assets設定，沒有runtime Worker/storage依賴。此來源包含設定，但本階段沒有CLI部署或正式hosting證明。

## Validation scope

- 主代理真隔離browser：主流程30 PASS；pagehide/back-forward兩語2 PASS、四mapping清空；0 FAIL／0 prohibited。兩次cleanup PASS。
- 10 NOT_RUN保留：兩語各自的精確source事件競態、真200% zoom、native chooser/save/print、真機/AT、exact8MiB browser boundary。Node邊界證據與browser範圍分開。
- M2A獨立副本21 release tests及check/build:release/check:release通過。這次公開副本的實際重現命令、結果與完整fixture/manifest核對見 [publication-checks](verification/publication-checks.json)。
- Source publication、hosting、外部驗收是不同里程碑；不宣稱工具版本已外驗完成。

## Portable contents

所有原runtime/public、必要build/release腳本、test與fake fixture保持審核bytes。產品規格及四份品牌/工程/設計/隱私文件保留。公開README/HANDOFF是本階段可攜整理；內部AGENTS、派工紀錄、workspace證據產生器與其原始logs不在public allowlist。完整對應與省略原因列在 [PUBLISH-MANIFEST](PUBLISH-MANIFEST.json)。

[README](README.md) 有離線重現命令；[release manifest](verification/release-manifest.json)、[reviewed source](verification/reviewed-source-set.json)、[browser summary](verification/browser-core-summary.json) 與 [fixture list](fixtures/browser/cases.json) 都在此repository內。未附license或第三方runtime依賴；這是使用者授權的source review publication。

下一步由主代理處理免費hosting與雙語首頁整合，仍須分別驗實際遠端部署與保留的人工範圍。這份source publication不授權此repo的自動部署或對外發信。
