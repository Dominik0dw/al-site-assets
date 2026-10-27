(function () {
  'use strict';
  function parseArguments(code) {
    const start = code.indexOf('addToBasket(');
    if (start < 0) throw Error('Chybí funkce košíku.');
    let i = start + 12;
    const ws = () => { while (/\s/.test(code[i] || '') && i < code.length) i++; };
    function value() {
      ws(); const c = code[i];
      if (c === '"' || c === "'") {
        i++; let out = '';
        while (i < code.length) {
          const ch = code[i++];
          if (ch === c) return out;
          if (ch === '\\') {
            const next = code[i++];
            if (!['\\', '"', "'", 'n', 'r', 't'].includes(next)) throw Error('Nepodporovaný zápis.');
            out += ({ n: '\n', r: '\r', t: '\t' })[next] || next;
          } else out += ch;
        }
        throw Error('Neuzavřený řetězec.');
      }
      if (c === '[') {
        i++; const a = []; ws();
        while (code[i] !== ']') { a.push(value()); ws(); if (code[i] !== ',') break; i++; ws(); }
        if (code[i++] !== ']') throw Error('Neplatné pole.');
        return a;
      }
      const m = code.slice(i).match(/^(true|false|null|this|amountValue|-?\d+(?:\.\d+)?)(?=\s*[,\)\]])/);
      if (!m) throw Error('Nepodporovaný argument.');
      i += m[0].length;
      const literals = { true: true, false: false, null: null, this: '__sender__', amountValue: '__quantity__' };
      return Object.hasOwn(literals, m[0]) ? literals[m[0]] : Number(m[0]);
    }
    const args = [];
    while (i < code.length) { args.push(value()); ws(); if (code[i] === ')') break; if (code[i++] !== ',') throw Error('Neplatné argumenty.'); }
    if (code[i] !== ')' || args.length !== 20 || args[0] !== '__sender__' || args[6] !== '__quantity__') throw Error('Změněná funkce košíku.');
    return args;
  }
  const txt = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  function extract(document, product, suppliedRoot) {
    const root = suppliedRoot || document.getElementById('ProductItem_' + product.id) || Array.from(document.querySelectorAll('.flex-item[data-flex-group-id]')).find(n => String(n.dataset.flexGroupId) === String(product.id));
    if (!root) throw Error('Detail neodpovídá produktu.');
    const actualCode = txt(root.querySelector('.manufacturer-code .code'));
    if (actualCode && actualCode !== product.code) throw Error('Objednací číslo se liší.');
    let widget, args, supplier, bestScore = Infinity;
    for (const candidate of root.querySelectorAll('.flex-add-to-basket')) {
      const button = candidate.querySelector('[onclick*="addToBasket("]');
      if (!button) continue;
      try {
        const parsed = parseArguments(button.getAttribute('onclick'));
        if (String(parsed[3]) !== String(product.id) || parsed[2] !== product.code || String(parsed[4]) !== candidate.dataset.flexProductId) continue;
        const offer = candidate.closest('.flex-delivery-time-item') || root;
        const amount = offer.querySelector('.flex-total-amount');
        const score = amount?.classList.contains('flex-on-stock') ? 0 : amount?.classList.contains('flex-on-the-way') ? 1 : 2;
        if (score < bestScore) { widget = candidate; args = parsed; supplier = offer; bestScore = score; }
      } catch (_) {}
    }
    supplier ||= root.querySelector('.flex-delivery-time-item') || root;
    const price = txt(supplier.querySelector('.flex-price .flex-value'));
    const currency = txt(supplier.querySelector('.flex-price .flex-currency'));
    const stockNode = supplier.querySelector('.flex-total-amount');
    const stockValue = txt(stockNode);
    const onStock = stockNode?.classList.contains('flex-on-stock') || false;
    const onWay = stockNode?.classList.contains('flex-on-the-way') || false;
    const stock = onStock ? 'Skladem' + (stockValue ? ' · ' + stockValue : '') : onWay ? 'Dostupné k dodání · ' + stockValue : stockValue || 'Dostupnost na detailu';
    const delivery = txt(supplier.querySelector('.flex-delivery-to-time-text'));
    const spinner = widget?.querySelector('.flex-basket-spinner');
    const step = Number((spinner?.dataset.flexSpinnerStep || '').replace(',', '.'));
    if (!Number.isFinite(step) || step <= 0) args = undefined;
    if (args) args[18] = false;
    const returnInfo = txt(supplier.querySelector('.flex-return-info'));
    return { price, currency, stock, onStock, onWay, delivery, returnInfo, args, step: step > 0 ? step : 1, productId: widget?.dataset.flexProductId };
  }
  function add(button, row, live, quantity) {
    const amount = Number(String(quantity).replace(',', '.'));
    if (!Number.isFinite(amount) || amount < live.step || Math.abs(amount / live.step - Math.round(amount / live.step)) > 0.000001) throw Error('Zadejte množství v násobcích ' + live.step + '.');
    if (typeof window.addToBasket !== 'function' || !live.args) throw Error('Košík není dostupný. Otevřete detail produktu.');
    const args = live.args.slice();
    args[0] = button; args[1] = '#' + row.id; args[6] = String(amount); args[18] = false;
    window.addToBasket.apply(window, args);
  }
  async function stockCatalog(config, signal) {
    const response = await fetch(new URL('/LegacyEshop/AjaxWSLegacy/GetUniversalPartsProducts', config.shop_origin), {
      method: 'POST', credentials: 'same-origin', signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ sortBy: '4', onStockOnly: 'true', purchasePricePriorized: 'false', viewMode: '0', filteredManufacturers: [], parametersFilterQuery: '', parametersFilterRangeQuery: '', categoryID: '19058', fullCategoryIDs: '19058', rootCategoryID: '-1', category: 'oleje-a-maziva', itemsCount: '-1', areHiddenGroupsVisible: 'false', loadAllItems: 'true', page: '1' })
    });
    if (!response.ok) throw Error('Dostupnost se nepodařilo aktualizovat.');
    let data = await response.json();
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || typeof data.HTMLContent !== 'string' || data.IsLastPage !== true) throw Error('Neúplný přehled skladu.');
    const doc = new DOMParser().parseFromString(data.HTMLContent, 'text/html');
    const rows = Array.from(doc.querySelectorAll('.flex-item[data-flex-group-id]'));
    const entries = rows.map(row => ({ id: row.dataset.flexGroupId, code: txt(row.querySelector('.manufacturer-code .code')), root: row }));
    return { entries, doc };
  }
  window.AutoLencOilLive = { parseArguments, extract, add, stockCatalog };
})();
