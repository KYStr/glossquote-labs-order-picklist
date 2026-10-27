# 驗收 oracle：訂單揀貨與裝箱單

狀態：規格，尚未實作。資料為合成 fixture oracle，並非已執行的測試。

## 自動 oracle

1. **A01 FR-01 CSV basics** — `order,sku,name,qty\r\nO1,A,筆,2`；一筆 4 欄，`qty==='2'` 字串。
2. **A02 FR-01 quoted field** — `o,s,n,q\nO1,A,"筆,自動鉛筆",2`；name 精確為 `筆,自動鉛筆`。
3. **A03 FR-01 quoted line break** — `o,s,n,q\nO1,A,"筆\n藍色",2`；name 保留 LF；row index 不跟實體行數混淆。
4. **A04 FR-01 malformed CSV** — `o,s,n,q\nO1,A,"bad`；`CSV_SYNTAX`，不回任何可匯總 rows。
5. **A05 FR-01 width** — 4 headers 卻只有 3 cells；`ROW_WIDTH` 並標 record index 1。
6. **A06 FR-01 caps** — bytes 1,048,576 / 5,000 rows / 30 columns 邊界接受；各自多一單位拒絕相應 cap error。
7. **A07 FR-02 mapping** — 同一 header 被映射給 orderId 和 SKU；`MAPPING_INVALID`。四個不同 headers 可映射成功。
8. **A08 FR-02 string identity** — SKU `001` 一列 qty2、SKU `1` 一列 qty3；兩個 SKU totals，標籤保持 `001` 和 `1`。
9. **A09 FR-04 aggregate** — `O1,A,筆,2;O2,A,筆,3;O1,B,紙,1`；totals A=5/B=1，O1 A=2/B=1，O2 A=3。
10. **A10 FR-04 repeated line** — `O1,A,筆,2;O1,A,筆,3`；一 SKU total5，一 order item quantity5。
11. **A11 FR-03 name conflict** — `O1,A,筆,1;O2,A,自動筆,1`；`SKU_NAME_CONFLICT`，含 row indexes 1、2，不產生總表。
12. **A12 FR-03 same name, different SKU** — rows SKU A/筆、SKU B/筆；仍兩個 pick rows。
13. **A13 FR-02 required empty** — 空 orderId、空 SKU 或空 name 任一欄；`REQUIRED_VALUE_EMPTY`，整批阻止。
14. **A14 FR-02 empty versus spaces** — orderId `""` rejects; orderId `" "` is retained as nonempty exact string and is not silently trimmed.
15. **A15 FR-02 quantity grammar** — `0`, `100001` -> `QUANTITY_RANGE`; `1.5`, `+1`, `1e2`, ` 1`, `１` -> `QUANTITY_SYNTAX`; `0001` accepted as 1.
16. **A16 FR-04 total bound** — synthetic same-SKU/order values sum exactly 1,000,000,000 accepted; next increment -> `TOTAL_TOO_LARGE` with no partial list.
17. **A17 FR-05 hostile strings** — SKU `<img src=x onerror=alert(1)>`; it displays as text, no element, script or request is created.
18. **A18 FR-05 check state** — check one of 3 pick rows; page says `1 / 3`, exported JSON marks only that row `checked:true`; reset removes all checks.
19. **A19 FR-06 schema / safe filename** — order ID `../../secret` remains JSON text; downloaded name exactly `order-picklist.json` or `.txt`.
20. **A20 FR-06 output cap** — combined TXT+JSON exactly 8,388,608 bytes accepted; one byte more blocks both outputs without partial download.

## Browser／人工門檻

需確認 CSV file chooser 不以名稱誤判格式、欄位映射可鍵盤操作、總表及各訂單清單在 320px／200% zoom 仍可讀、checkbox accessible name、進度／取消、TXT/JSON 下載、network offline 無外連。這些真瀏覽器檢查標 **NOT_RUN_USER_FOCUS_INCIDENT**，不准用純函式結果冒充 PASS；不開 OS print/file-picker dialog。
