import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './assets.mjs';

const pages = {
  zh: {
    lang: 'zh-Hant', prefix: './', home: 'https://glossquote.com/index.html', switchPath: './en/index.html', switchLabel: 'English', switchLang: 'en',
    title: '訂單揀貨與裝箱單｜依 SKU 彙總訂單明細', description: '在本機將訂單 CSV 轉為 SKU 總揀貨表及逐單裝箱清單，保留商品編號並找出品名衝突。',
    brand: '訂單揀貨與裝箱單', homeLabel: '工具首頁', skip: '跳到訂單工作區', preview: '本地預覽候選',
    heading: '先集中揀貨，再逐單核對', intro: '把訂單明細整理成 SKU 總揀貨表，再依每張訂單逐項核對裝箱內容。',
    privacy: '資料只在此頁記憶體處理；不會上傳、不會自動儲存。重新整理、換語言或離開此頁會失去來源與勾選，請先下載。',
    nav: '工作步驟', sourceLink: '匯入與欄位', pickLink: '總揀貨表', ordersLink: '逐單裝箱', helpLink: '格式與說明',
    sourceTitle: '匯入訂單明細', sourceHint: '選擇單一 UTF-8 CSV，第一列須為唯一且非空的欄名。檔案內容決定是否有效，不依副檔名判斷。',
    fileLabel: '訂單明細 CSV', caps: '上限 1 MiB、5,000 筆明細、30 欄。請先移除地址、付款及聯絡資料等不需要的欄位。',
    sample: '載入假資料範例', reset: '清除來源與核對', sourceEmpty: '尚未載入明細。選擇 CSV，或載入假資料試用。',
    mapTitle: '確認四個來源欄位', mapHint: '四個用途必須各選不同欄位。只會彙總並輸出這四欄；SKU 與訂單編號保持原樣，不去空格、不轉數字。',
    mapping: [['orderId','訂單編號'], ['sku','SKU'], ['name','品名'], ['quantity','數量']], choose: '選擇來源欄位',
    generate: '產生揀貨與裝箱清單', cancel: '取消整理', progress: '處理進度', state: '選取訂單明細 CSV。', errorTitle: '請先修正來源或欄位',
    resultTitle: '揀貨與裝箱工作表', pickTitle: '總揀貨表', pickHint: '依 SKU 首次出現順序排列。同名不同 SKU 仍分開；勾選表示此頁核對紀錄。',
    pickRegion: '可橫向捲動的 SKU 總揀貨表', orderTitle: '逐單裝箱', orderHint: '訂單與單內品項保留首次出現順序。請依每一張訂單分別核對，裝箱標記與總揀貨標記互相獨立。',
    downloadTitle: '下載目前工作表', downloadHint: String.raw`TXT 與 JSON 都包含目前核對標記；檔名固定，合計上限 8 MiB。TXT 的 SKU、品名及訂單編號以 JSON 字串引號包住；\n 表示換行、\r 表示歸位、\t 表示定位字元，\" 與 \\ 表示原本的雙引號與反斜線，可完整還原；JSON 保留原文。這些標記不代表貨品已實際揀出或入箱。`,
    txt: '下載文字清單 (.txt)', json: '下載結構資料 (.json)',
    helpTitle: '格式與使用說明', rulesTitle: '什麼資料會停止整批？', rules: ['數量只接受 ASCII 整數字串 1–100,000，可有前導零；不得含空格、小數、符號或千分位。', '訂單編號、SKU、品名不能是空字串；空白字元會原樣保留。欄數必須一致，CSV 引號與外部換列格式必須完整一致。', '同一 SKU 的品名必須完全一致。遇到歧義、非法數量或超限時，不提供部分清單。'],
    faqs: [['相同品名的不同 SKU 會合併嗎？','不會；只按 SKU 精確合併。001、1、A、a 與帶空格的 SKU 都各自分開。'], ['重複的訂單／SKU 列會怎樣？','數量會加總，並保留第一次出現的順序；請先確認重複行確實代表需要累加的商品。'], ['會讀取地址或扣庫存嗎？','只使用四個對應的訂單明細欄位，不輸出其他欄位；請在匯入前移除無關個資。工具不連到庫存或物流系統。'], ['勾選會自動保存嗎？','不會。勾選只存在當前頁面；來源或欄位改變會清空。可在離開前下載 TXT 或 JSON，這些檔案目前沒有重新匯入勾選的功能。']],
    footer: 'Gloss Tools by GlossQuote · 本地處理的訂單工作表', noscript: '本工具需要 JavaScript 才能在此頁處理 CSV。請啟用後重新載入。',
  },
  en: {
    lang: 'en', prefix: '../', home: 'https://glossquote.com/en/index.html', switchPath: '../index.html', switchLabel: '繁體中文', switchLang: 'zh-Hant',
    title: 'Order Pick List and Packing Lists | Group by SKU', description: 'Turn a local order-lines CSV into a consolidated SKU pick sheet and per-order packing lists, with exact IDs and conflict checks.',
    brand: 'Order pick and packing lists', homeLabel: 'All tools', skip: 'Skip to the order workspace', preview: 'Local preview candidate',
    heading: 'Pick products together, then pack each order', intro: 'Group order lines into one SKU pick sheet, then check the items for each order as you pack.',
    privacy: 'Data stays in this page’s memory, with no upload or automatic saving. Refreshing, changing language or leaving clears the source and checkmarks. Download before leaving.',
    nav: 'Workflow', sourceLink: 'Import and columns', pickLink: 'Pick sheet', ordersLink: 'Packing lists', helpLink: 'Format and help',
    sourceTitle: 'Import order lines', sourceHint: 'Choose one UTF-8 CSV with unique, nonempty column headers in the first record. File content is validated regardless of its extension.',
    fileLabel: 'Order-lines CSV', caps: 'Limit: 1 MiB, 5,000 data records and 30 columns. Remove unneeded address, payment and contact columns before importing.',
    sample: 'Load fake-data example', reset: 'Clear source and checkmarks', sourceEmpty: 'No order lines loaded. Choose a CSV or load the fake-data example.',
    mapTitle: 'Confirm four source columns', mapHint: 'Choose a different column for each field. Only these four columns are grouped and exported. SKU and order IDs keep their exact text, including spaces and leading zeros.',
    mapping: [['orderId','Order ID'], ['sku','SKU'], ['name','Product name'], ['quantity','Quantity']], choose: 'Choose a source column',
    generate: 'Generate pick and packing lists', cancel: 'Cancel grouping', progress: 'Processing progress', state: 'Choose an order-lines CSV.', errorTitle: 'Correct the source or mapping first',
    resultTitle: 'Pick and packing worksheet', pickTitle: 'Consolidated pick sheet', pickHint: 'SKUs appear in first-seen order. Different SKUs with the same name stay separate. Checkmarks record page checks.',
    pickRegion: 'Horizontally scrollable consolidated SKU pick sheet', orderTitle: 'Per-order packing lists', orderHint: 'Orders and their items keep first-seen order. Check each order separately. Packing checkmarks are independent of pick-sheet checkmarks.',
    downloadTitle: 'Download this worksheet', downloadHint: String.raw`TXT and JSON include the current checkmarks with fixed filenames and an 8 MiB combined limit. TXT shows every SKU, product name and order ID as a quoted JSON string: \n means line feed, \r carriage return, \t tab, \" a quote and \\ a backslash. These escapes are reversible; JSON keeps the original text. Checkmarks do not prove that products were physically picked or packed.`,
    txt: 'Download text lists (.txt)', json: 'Download structured data (.json)',
    helpTitle: 'Format and help', rulesTitle: 'What blocks the entire batch?', rules: ['Quantity must be an ASCII integer string from 1 to 100,000. Leading zeros are allowed; spaces, decimals, signs and thousands separators are not.', 'Order ID, SKU and product name must not be empty strings. Whitespace stays unchanged. Column counts must match; CSV quoting and exterior record separators must be consistent.', 'Each SKU must have exactly one product name. Conflicts, invalid quantities and limits stop the entire batch, with no partial lists.'],
    faqs: [['Will different SKUs with the same name be merged?','No. Only exact SKU strings are grouped. 001, 1, A, a and SKUs with spaces stay separate.'], ['What happens to repeated order/SKU rows?','Their quantities are added while preserving first-seen order. Check that duplicate lines really represent additional quantities before importing.'], ['Does this read addresses or change inventory?','Only the four mapped order-line fields are used; other columns are not exported. Remove unrelated personal data before importing. There is no inventory or shipping connection.'], ['Are checkmarks saved automatically?','No. They exist only in this page and are cleared when the source or mapping changes. Download TXT or JSON before leaving; restoring checkmarks from an export is not supported.']],
    footer: 'Gloss Tools by GlossQuote · Local order worksheets', noscript: 'JavaScript is required to process CSV in this page. Enable it and reload.',
  },
};

const html = (c, locale) => `<!doctype html>
<html lang="${c.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="description" content="${c.description}">
  <title>${c.title}</title>
  <link rel="alternate" hreflang="${c.switchLang}" href="${c.switchPath}">
  <link rel="stylesheet" href="${c.prefix}styles/app.css">
  <script type="module" src="${c.prefix}js/app.js"></script>
</head>
<body data-locale="${locale}">
  <a class="skip-link" href="#workspace">${c.skip}</a>
  <header class="topbar">
    <div class="product-name"><span class="family-name">Gloss Tools</span><span>${c.brand}</span></div>
    <nav class="global-nav" aria-label="${locale === 'zh' ? '語言與首頁' : 'Language and home'}"><a href="${c.home}">${c.homeLabel}</a><a href="${c.switchPath}" lang="${c.switchLang}" hreflang="${c.switchLang}">${c.switchLabel}</a></nav>
  </header>
  <main id="workspace">
    <div class="intro"><p class="preview-label">${c.preview}</p><h1>${c.heading}</h1><p>${c.intro}</p></div>
    <p class="privacy-note">${c.privacy}</p>
    <nav class="workflow" aria-label="${c.nav}"><a href="#source">${c.sourceLink}</a><a href="#pick-heading">${c.pickLink}</a><a href="#orders-heading">${c.ordersLink}</a><a href="#help">${c.helpLink}</a></nav>
    <noscript><p class="notice">${c.noscript}</p></noscript>
    <div id="status" class="status" role="status" aria-live="polite" aria-atomic="true">${c.state}</div>
    <div id="progress-area" hidden><label for="progress">${c.progress}</label><progress id="progress" max="100" value="0"></progress><button id="cancel" type="button">${c.cancel}</button></div>
    <section id="errors" class="error-panel" aria-labelledby="error-heading" hidden><h2 id="error-heading" tabindex="-1">${c.errorTitle}</h2><p id="error-summary"></p><ul id="error-details"></ul></section>
    <details id="source" class="source-panel" open>
      <summary><h2>${c.sourceTitle}</h2><span id="source-summary">${c.sourceEmpty}</span></summary>
      <div class="source-body"><p>${c.sourceHint}</p><div class="source-controls"><div class="file-field"><label for="csv-file">${c.fileLabel}</label><input id="csv-file" type="file" aria-describedby="file-caps"><p id="file-caps" class="hint">${c.caps}</p></div><button id="load-sample" type="button">${c.sample}</button></div>
      <p id="source-name" class="identifier exact-value"></p>
      <section id="mapping-area" aria-labelledby="mapping-heading" hidden><div id="samples" class="table-region" role="region" aria-label="${locale === 'zh' ? '可橫向捲動的來源樣本' : 'Horizontally scrollable source samples'}" tabindex="0"></div>
        <h3 id="mapping-heading">${c.mapTitle}</h3><p id="mapping-hint" class="hint">${c.mapHint}</p>
        <div class="mapping-grid">${c.mapping.map(([key,label]) => `<div class="field"><label for="map-${key}">${label}</label><select id="map-${key}" aria-describedby="mapping-hint mapping-error"><option value="">${c.choose}</option></select></div>`).join('')}</div>
        <p id="mapping-error" class="field-error" hidden></p>
        <button id="generate" class="primary" type="button" disabled>${c.generate}</button>
      </section></div>
    </details>
    <div class="reset-row"><button id="reset" class="quiet" type="button" disabled>${c.reset}</button></div>
    <section id="results" aria-labelledby="result-heading" hidden>
      <div class="result-heading"><h2 id="result-heading">${c.resultTitle}</h2><p id="result-summary"></p></div>
      <section aria-labelledby="pick-heading"><h2 id="pick-heading" tabindex="-1">${c.pickTitle}</h2><p class="hint">${c.pickHint}</p><p id="pick-progress" class="check-progress"></p><div id="pick-sheet" class="table-region" role="region" aria-label="${c.pickRegion}" tabindex="0"></div></section>
      <section class="packing-section" aria-labelledby="orders-heading"><h2 id="orders-heading" tabindex="-1">${c.orderTitle}</h2><p class="hint">${c.orderHint}</p><p id="packing-progress" class="check-progress"></p><div id="packing-lists"></div></section>
      <section class="download-section" aria-labelledby="download-heading"><h2 id="download-heading">${c.downloadTitle}</h2><p id="download-hint" class="hint">${c.downloadHint}</p><div class="download-actions"><button id="download-txt" type="button" aria-describedby="download-hint" disabled>${c.txt}</button><button id="download-json" type="button" aria-describedby="download-hint" disabled>${c.json}</button></div></section>
    </section>
    <section id="help" class="help" aria-labelledby="help-heading"><h2 id="help-heading">${c.helpTitle}</h2><details><summary>${c.rulesTitle}</summary><ul>${c.rules.map(rule => `<li>${rule}</li>`).join('')}</ul></details>${c.faqs.map(([question,answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</section>
  </main>
  <footer>${c.footer}</footer>
</body>
</html>
`;

for (const [locale, copy] of Object.entries(pages)) {
  const path = join(ROOT, 'public', locale === 'en' ? 'en/index.html' : 'index.html');
  await mkdir(join(ROOT, 'public', 'en'), { recursive: true });
  await writeFile(path, html(copy, locale), 'utf8');
}
console.log('Generated the two local noindex preview documents.');
