// All source-derived values enter text nodes, never markup or URL attributes.
export function node(document, tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export function renderSamples(document, target, parsed, copy) {
  target.replaceChildren();
  const table = node(document, 'table');
  table.append(node(document, 'caption', copy.samples));
  const head = node(document, 'thead');
  const heading = node(document, 'tr');
  for (const text of [copy.record, ...parsed.headers]) {
    const cell = node(document, 'th', text); cell.scope = 'col'; heading.append(cell);
  }
  head.append(heading); table.append(head);
  const body = node(document, 'tbody');
  parsed.rows.slice(0, 2).forEach((row, i) => {
    const line = node(document, 'tr');
    const index = node(document, 'th', i + 1); index.scope = 'row'; line.append(index);
    row.forEach(value => line.append(node(document, 'td', value, 'exact-value')));
    body.append(line);
  });
  table.append(body); target.append(table);
}

function checkbox(document, label, checked, onChange) {
  const wrapper = node(document, 'label', undefined, 'check-control');
  const input = node(document, 'input');
  input.type = 'checkbox'; input.checked = checked; input.setAttribute('aria-label', label);
  input.addEventListener('change', () => { onChange(input.checked); wrapper.classList.toggle('is-checked', input.checked); });
  wrapper.classList.toggle('is-checked', checked);
  wrapper.append(input);
  return wrapper;
}

function tableHead(document, labels) {
  const head = node(document, 'thead');
  const row = node(document, 'tr');
  for (const label of labels) { const cell = node(document, 'th', label); cell.scope = 'col'; row.append(cell); }
  head.append(row); return head;
}

export function renderResults(document, targets, result, copy, format, onCheck) {
  targets.pick.replaceChildren(); targets.orders.replaceChildren();
  const table = node(document, 'table');
  table.append(node(document, 'caption', copy.pickCaption));
  table.append(tableHead(document, [copy.checked, copy.sku, copy.name, copy.qty, copy.orderCount]));
  const body = node(document, 'tbody');
  result.totals.forEach((item, index) => {
    const row = node(document, 'tr');
    const check = node(document, 'td');
    check.append(checkbox(document, copy.checkPick(item.sku, item.name, format(item.quantity)), item.checked, checked => onCheck('pick', index, -1, checked)));
    const sku = node(document, 'th', item.sku, 'identifier exact-value'); sku.scope = 'row';
    row.append(check, sku, node(document, 'td', item.name, 'exact-value'), node(document, 'td', format(item.quantity), 'numeric'), node(document, 'td', format(item.orderCount), 'numeric'));
    body.append(row);
  });
  table.append(body); targets.pick.append(table);

  const orderProgress = [];
  result.orders.forEach((order, orderIndex) => {
    const section = node(document, 'section', undefined, 'packing-order');
    const title = node(document, 'h3'); title.id = `packing-order-${orderIndex}`;
    title.append(node(document, 'span', copy.order + ' '), node(document, 'span', order.orderId, 'identifier exact-value'));
    section.setAttribute('aria-labelledby', title.id);
    const progress = node(document, 'p', '', 'order-progress'); orderProgress.push(progress);
    section.append(title, progress);
    const list = node(document, 'ul', undefined, 'packing-items');
    order.items.forEach((item, itemIndex) => {
      const line = node(document, 'li');
      const detail = node(document, 'div', undefined, 'item-detail');
      detail.append(node(document, 'span', item.sku, 'identifier exact-value'), node(document, 'span', item.name, 'exact-value'));
      line.append(checkbox(document, copy.checkItem(order.orderId, item.sku, item.name, format(item.quantity)), item.checked, checked => onCheck('order', orderIndex, itemIndex, checked)), detail, node(document, 'span', '× ' + format(item.quantity), 'numeric'));
      list.append(line);
    });
    section.append(list); targets.orders.append(section);
  });
  return orderProgress;
}
