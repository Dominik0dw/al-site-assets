const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog/oleje/catalog.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'assets/oleje/config.json'), 'utf8'));
const script = fs.readFileSync(path.join(root, 'assets/oleje/oleje.js'), 'utf8');
async function preview(hash = '', failure = false) {
  const nodes = new Map();
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', setAttribute() {}, scrollIntoView() {} });
    return nodes.get(selector);
  };
  const app = { innerHTML: '', querySelector: element, querySelectorAll: () => [], classList: { toggle: () => true } };
  const mount = { dataset: {}, innerHTML: '', firstElementChild: app };
  const document = {
    currentScript: { src: 'https://example.github.io/assets/oleje/oleje.js' },
    getElementById: id => id === 'al-oils-mount' ? mount : null,
    createElement: () => ({}), head: { append: item => queueMicrotask(() => item.onload?.()) }
  };
  const location = { origin: 'https://example.github.io', pathname: '/nahled-oleju.html', search: '', hash, href: 'https://example.github.io/nahled-oleju.html' + hash };
  let replaced = '';
  const sandbox = { document, location, URL, URLSearchParams, Intl, Set, Map, Promise, AbortController, setTimeout, clearTimeout,
    window: { addEventListener() {} }, history: { replaceState: (_, __, url) => { replaced = url; } },
    fetch: async url => ({ ok: !failure, status: failure ? 404 : 200, json: async () => url.pathname.endsWith('config.json') ? config : url.pathname.endsWith('overrides.json') ? { products: {} } : catalog }) };
  vm.runInNewContext(script, sandbox);
  await new Promise(resolve => setTimeout(resolve, 20));
  return { app, nodes, replaced };
}
(async () => {
  const initial = await preview();
  assert.match(initial.nodes.get('.ao-count').textContent, new RegExp('^' + catalog.product_count + ' produktů'));
  assert.equal((initial.nodes.get('.ao-list').innerHTML.match(/<article /g) || []).length, config.page_size);
  assert.match(initial.app.innerHTML, /Filtrovat produkty/);
  const target = catalog.products.find(p => p.specifications.sae.includes('5W-30'));
  assert.ok(target);
  const query = new URLSearchParams({ q: target.code });
  const searched = await preview('#oil=' + encodeURIComponent(query.toString()));
  assert.ok(searched.nodes.get('.ao-list').innerHTML.includes('ao-product-' + target.id));
  assert.ok(searched.replaced.includes('#oil='));
  const q = new URLSearchParams({ sae: '5W-30', volume_l: '5' });
  const filtered = await preview('#oil=' + encodeURIComponent(q.toString()));
  const expected = catalog.products.filter(p => p.specifications.sae.includes('5W-30') && p.specifications.volume_l.includes(5)).length;
  assert.ok(filtered.nodes.get('.ao-count').textContent.startsWith(expected + ' produktů'));
  const empty = await preview('#oil=' + encodeURIComponent('q=nenalezitelnypokusXYZ'));
  assert.match(empty.nodes.get('.ao-list').innerHTML, /nenašli žádné produkty/);
  const failed = await preview('', true);
  assert.match(failed.app.innerHTML, /Katalog se nepodařilo načíst/);
  console.log('Interface logic: full inventory, pagination, code search, combined filters, share hash, no-result and download-error states passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
