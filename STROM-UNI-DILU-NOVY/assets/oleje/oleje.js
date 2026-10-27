(function () {
  'use strict';
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const mount = document.getElementById('al-oils-mount');
  if (!mount || mount.dataset.loaded) return;
  mount.dataset.loaded = 'true';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('oleje.css', base); document.head.append(css);
  const adapter = document.createElement('script'); adapter.src = new URL('live.js', base);
  const adapterReady = new Promise((resolve, reject) => { adapter.onload = resolve; adapter.onerror = reject; }); document.head.append(adapter);
  mount.innerHTML = '<div id="al-oils"><p role="status">Načítáme katalog olejů…</p></div>';
  const app = mount.firstElementChild;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } };
  const readJSON = async path => { const r = await fetch(new URL(path, base), { credentials: 'omit' }); if (!r.ok) throw Error('Soubor ' + path + ' není dostupný (' + r.status + ').'); return r.json(); };
  Promise.all([readJSON('config.json'), readJSON('../../catalog/oleje/catalog.json'), readJSON('../../catalog/oleje/overrides.json'), adapterReady]).then(start).catch(error => {
    app.innerHTML = '<div class="ao-status" role="alert">Katalog se nepodařilo načíst. ' + esc(error.message) + '</div>';
  });
  function start([config, catalog, overrides]) {
    const fields = new Set(config.filters.map(f => f.key));
    const products = catalog.products.map(p => {
      const o = overrides.products?.[p.id];
      if (!o) return p;
      const copy = { ...p, specifications: { ...p.specifications }, evidence: { ...p.evidence } };
      for (const [key, correction] of Object.entries(o.fields || {})) {
        if (!fields.has(key) || !Array.isArray(correction.value) || !safeURL(correction.source_url) || !correction.checked_at) continue;
        if (key === 'brand') copy.brand = String(correction.value[0] || p.brand);
        else copy.specifications[key] = correction.value;
        copy.evidence[key] = { source_url: correction.source_url, checked_at: correction.checked_at, source_type: 'manual_verified' };
      }
      return copy;
    });
    const values = (p, key) => key === 'brand' ? [p.brand] : (p.specifications[key] || []).map(String);
    const label = (key, value) => key === 'volume_l' ? value + ' l' : value;
    const state = { selected: {}, q: '', page: 1, sort: 'name' };
    const liveCache = new Map(); let run = 0; let controller; let searchTimer;
    const sameShop = location.origin === new URL(config.shop_origin).origin;
    const size = Math.max(1, Number(config.page_size) || 12);
    const collator = new Intl.Collator('cs', { numeric: true, sensitivity: 'base' });
    function restore() {
      if (!location.hash.startsWith('#oil=')) return;
      try {
        const hash = new URLSearchParams(decodeURIComponent(location.hash.slice(5)));
        state.q = hash.get('q') || ''; state.page = Math.max(1, Number(hash.get('page')) || 1);
        state.sort = ['name', 'code'].includes(hash.get('sort')) ? hash.get('sort') : 'name'; state.selected = {};
        fields.forEach(key => { const list = hash.getAll(key); if (list.length) state.selected[key] = new Set(list); });
      } catch (_) {}
    }
    function writeHash() {
      const h = new URLSearchParams(); if (state.q) h.set('q', state.q); if (state.page > 1) h.set('page', state.page); if (state.sort !== 'name') h.set('sort', state.sort);
      Object.entries(state.selected).forEach(([key, set]) => set.forEach(v => h.append(key, v)));
      const hash = h.size ? '#oil=' + encodeURIComponent(h.toString()) : '';
      history.replaceState(null, '', location.pathname + location.search + hash);
    }
    function matches(p, except) {
      if (state.q && ![p.name, p.code, p.brand, ...Object.values(p.specifications).flat()].join(' ').toLocaleLowerCase('cs').includes(state.q.toLocaleLowerCase('cs'))) return false;
      return config.filters.every(f => {
        if (f.key === except) return true;
        const selected = state.selected[f.key]; if (!selected?.size) return true;
        const actual = values(p, f.key);
        return f.mode === 'all' ? [...selected].every(v => actual.includes(v)) : [...selected].some(v => actual.includes(v));
      });
    }
    restore();
    app.innerHTML = `<header class="ao-head"><div><span class="ao-kicker">AUTO LENC · KATALOG</span><h2 class="ao-title">${esc(config.title)}</h2><p class="ao-intro">${esc(config.subtitle)}</p></div></header>
      <div class="ao-layout"><aside class="ao-sidebar" aria-label="Filtry produktů"><div class="ao-filter-head"><strong>Filtrovat produkty</strong><button type="button" class="ao-reset">Vymazat</button></div><div class="ao-facets"></div></aside>
      <main class="ao-main"><button type="button" class="ao-mobile-filters" aria-expanded="false">Zobrazit filtry</button><div class="ao-viscosities" aria-label="Rychlý výběr viskozity"></div>
      <div class="ao-advisors"><strong>Poradci pro výběr oleje</strong><div>${config.advisors.map(a => `<a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.name)} ↗</a>`).join('')}</div></div>
      <div class="ao-toolbar"><strong class="ao-count" aria-live="polite"></strong><div class="ao-controls"><input class="ao-search" type="search" aria-label="Hledat v katalogu" placeholder="Název, číslo nebo specifikace"><select class="ao-sort" aria-label="Řazení"><option value="name">Podle názvu</option><option value="code">Podle obj. čísla</option></select><button type="button" class="ao-small-button ao-share">Sdílet výběr</button><button type="button" class="ao-small-button ao-refresh">Obnovit sklad</button></div></div>
      <div class="ao-chips"></div><div class="ao-list-head"><span>Produkt</span><span>Popis a specifikace</span><span>Cena a dostupnost</span></div><div class="ao-list"></div><nav class="ao-pagination" aria-label="Stránky produktů"></nav>
      <p class="ao-footer">Specifikace vycházejí z uvedených zdrojů. Požadavky na olej ověřte v příručce vozidla. ${sameShop ? 'Ceny a dostupnost se načítají z e-shopu při zobrazení produktů.' : 'Aktuální cenu, sklad a košík najdete na detailu produktu v e-shopu.'}</p></main></div>`;
    const $ = selector => app.querySelector(selector);
    $('.ao-search').value = state.q; $('.ao-sort').value = state.sort;
    $('.ao-mobile-filters').onclick = event => { const open = app.classList.toggle('ao-filters-open'); event.currentTarget.setAttribute('aria-expanded', String(open)); event.currentTarget.textContent = open ? 'Skrýt filtry' : 'Zobrazit filtry'; };
    $('.ao-reset').onclick = () => { state.selected = {}; state.q = ''; state.page = 1; $('.ao-search').value = ''; render(); };
    $('.ao-search').oninput = event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = event.target.value.trim(); state.page = 1; render(); }, 220); };
    $('.ao-search').onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); };
    $('.ao-sort').onchange = event => { state.sort = event.target.value; state.page = 1; render(); };
    $('.ao-refresh').onclick = () => { liveCache.clear(); render(); };
    $('.ao-share').onclick = async event => { try { await navigator.clipboard.writeText(location.href); event.target.textContent = 'Odkaz zkopírován'; setTimeout(() => { event.target.textContent = 'Sdílet výběr'; }, 1800); } catch (_) { event.target.textContent = 'Zkopírujte adresu stránky'; } };
    window.addEventListener('hashchange', () => { restore(); $('.ao-search').value = state.q; $('.ao-sort').value = state.sort; render(); });
    function toggle(key, value) { const set = state.selected[key] ||= new Set(); set.has(value) ? set.delete(value) : set.add(value); if (!set.size) delete state.selected[key]; state.page = 1; render(); }
    function render() {
      controller?.abort(); controller = new AbortController(); const version = ++run;
      const previousOpen = new Map([...app.querySelectorAll('.ao-facet')].map(el => [el.dataset.key, el.open]));
      $('.ao-facets').innerHTML = config.filters.map(f => {
        const counts = new Map(); products.filter(p => matches(p, f.key)).forEach(p => new Set(values(p, f.key)).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
        const all = [...new Set(products.flatMap(p => values(p, f.key)))].sort(collator.compare);
        if (!all.length) return '';
        return `<details class="ao-facet" data-key="${esc(f.key)}" ${(previousOpen.get(f.key) ?? f.open) ? 'open' : ''}><summary>${esc(f.label)}</summary>${f.mode === 'all' ? '<p class="ao-mode-hint">Musí splnit všechny vybrané hodnoty.</p>' : ''}${all.length > 12 ? `<input type="search" class="ao-facet-search" placeholder="Hledat v hodnotách" aria-label="Hledat: ${esc(f.label)}">` : ''}<div class="ao-facet-values">${all.map(v => `<label class="ao-option"><input type="checkbox" data-filter="${esc(f.key)}" value="${esc(v)}" ${state.selected[f.key]?.has(v) ? 'checked' : ''}><span>${esc(label(f.key, v))}</span><small>${counts.get(v) || 0}</small></label>`).join('')}</div></details>`;
      }).join('');
      app.querySelectorAll('[data-filter]').forEach(input => { input.onchange = () => toggle(input.dataset.filter, input.value); });
      app.querySelectorAll('.ao-facet-search').forEach(input => { input.oninput = () => { const q = input.value.toLocaleLowerCase('cs'); input.closest('.ao-facet').querySelectorAll('.ao-option').forEach(option => { option.hidden = !option.textContent.toLocaleLowerCase('cs').includes(q); }); }; input.onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); }; });
      $('.ao-viscosities').innerHTML = config.quick_viscosities.map(v => `<button type="button" class="ao-viscosity ${state.selected.sae?.has(v) ? 'is-active' : ''}" data-sae="${esc(v)}"><strong>${esc(v)}</strong><span>${products.filter(p => matches(p, 'sae') && values(p, 'sae').includes(v)).length} produktů</span></button>`).join('');
      app.querySelectorAll('[data-sae]').forEach(button => { button.onclick = () => toggle('sae', button.dataset.sae); });
      const found = products.filter(p => matches(p)); found.sort((a, b) => collator.compare(a[state.sort], b[state.sort]) || collator.compare(a.id, b.id));
      const pages = Math.max(1, Math.ceil(found.length / size)); state.page = Math.min(state.page, pages); writeHash();
      const from = (state.page - 1) * size; const visible = found.slice(from, from + size);
      $('.ao-count').textContent = found.length ? `${found.length} produktů · ${from + 1}–${Math.min(from + size, found.length)}` : 'Žádné produkty';
      $('.ao-chips').innerHTML = Object.entries(state.selected).flatMap(([key, set]) => [...set].map(v => `<button type="button" class="ao-chip" data-key="${esc(key)}" data-value="${esc(v)}">${esc(label(key, v))} ×</button>`)).join('');
      app.querySelectorAll('.ao-chip').forEach(b => { b.onclick = () => toggle(b.dataset.key, b.dataset.value); });
      $('.ao-list').innerHTML = visible.length ? visible.map(productRow).join('') : '<p class="ao-empty">Pro tento výběr jsme nenašli žádné produkty. Zkuste upravit filtry.</p>';
      const pageSet = [...new Set([1, state.page - 1, state.page, state.page + 1, pages])].filter(p => p > 0 && p <= pages).sort((a, b) => a - b);
      $('.ao-pagination').innerHTML = pages > 1 ? `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>Předchozí</button>${pageSet.map(p => `<button type="button" data-page="${p}" ${p === state.page ? 'aria-current="page"' : ''}>${p}</button>`).join('')}<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Další</button>` : '';
      app.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { state.page = Number(b.dataset.page); render(); $('.ao-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
      if (sameShop && config.live_prices) loadLive(visible, version, controller.signal);
    }
    function productRow(p) {
      const chips = ['sae', 'volume_l', 'acea', 'api', 'ilsac'].flatMap(key => values(p, key).map(v => `<span class="ao-spec">${esc(label(key, v))}</span>`)).join('');
      const approvals = values(p, 'approvals'); const recommendations = values(p, 'recommendations');
      const rawRows = (p.raw_parameters || []).map(x => `<tr><th>${esc(x.name)}</th><td>${esc(x.value)}</td></tr>`).join('');
      const extraRows = Object.entries(p.evidence || {}).filter(([, e]) => ['manual_verified', 'shop_product_title'].includes(e.source_type)).map(([key, e]) => `<tr><th>${esc(config.filters.find(f => f.key === key)?.label || key)} ${e.source_type === 'shop_product_title' ? '(z názvu)' : '(ověřené doplnění)'}</th><td>${esc(values(p, key).map(v => label(key, v)).join(' · '))} <a href="${esc(safeURL(e.source_url))}" target="_blank" rel="noopener noreferrer">Zdroj ↗</a></td></tr>`).join('');
      const rows = extraRows + rawRows;
      const source = safeURL(p.source?.url || p.source_url || p.url);
      return `<article class="ao-product" id="ao-product-${esc(p.id)}"><a class="ao-image" href="${esc(safeURL(p.url))}">${safeURL(p.image) ? `<img src="${esc(safeURL(p.image))}" alt="${esc(p.name)}" loading="lazy">` : '<span>OLEJE</span>'}</a><div class="ao-info"><span class="ao-brand">${esc(p.brand)}</span><h3><a href="${esc(safeURL(p.url))}">${esc(p.name)}</a></h3><p class="ao-code">Obj. číslo: <strong>${esc(p.code)}</strong></p><div class="ao-specs">${chips}</div>${approvals.length ? `<p class="ao-oem"><strong>Schválení dle katalogu:</strong> ${esc(approvals.join(' · '))}</p>` : ''}${recommendations.length ? `<p class="ao-oem"><strong>Doporučení:</strong> ${esc(recommendations.join(' · '))}</p>` : ''}${rows ? `<details class="ao-parameters"><summary>Všechny parametry a zdroj</summary><table>${rows}</table><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Zdroj parametrů ↗</a></details>` : '<p class="ao-oem">Parametry se doplňují.</p>'}</div><div class="ao-buy"><div class="ao-live" role="status">${sameShop ? '<span class="ao-price-note">Načítáme cenu a sklad…</span>' : '<span class="ao-price-note">Cena a sklad v e-shopu</span>'}</div><a class="ao-detail" href="${esc(safeURL(p.url))}">Detail produktu →</a></div></article>`;
    }
    async function loadLive(visible, version, signal) {
      const queue = visible.slice();
      async function worker() {
        while (queue.length && !signal.aborted) {
          const p = queue.shift(); const row = document.getElementById('ao-product-' + p.id);
          try {
            let live = liveCache.get(p.id);
            if (!live || Date.now() - live.at > 300000) {
              const url = new URL(p.url); if (url.origin !== location.origin || !url.pathname.startsWith('/cs/katalog/')) throw Error('Neplatný detail.');
              const response = await fetch(url, { credentials: 'same-origin', signal, cache: 'no-store' }); if (!response.ok) throw Error('Detail není dostupný.');
              const doc = new DOMParser().parseFromString(await response.text(), 'text/html'); live = { ...window.AutoLencOilLive.extract(doc, p), at: Date.now() }; liveCache.set(p.id, live);
            }
            if (version !== run || signal.aborted) return;
            row.querySelector('.ao-live').innerHTML = `${live.price ? `<strong class="ao-price">${esc(live.price)} ${esc(live.currency)}</strong><span class="ao-price-note">včetně DPH</span>` : '<span class="ao-price-note">Cena na dotaz</span>'}<span class="ao-stock ${live.onStock ? 'is-stock' : ''}">${esc(live.stock)}</span>${live.delivery ? `<span class="ao-price-note">${esc(live.delivery)}</span>` : ''}${live.args && typeof window.addToBasket === 'function' ? `<div class="flex-add-to-basket ao-cart" data-flex-product-id="${esc(live.productId)}" data-flex-group-id="${esc(p.id)}"><div class="flex-basket-spinner ao-quantity" data-flex="true" data-flex-spinner-step="${live.step}" data-flex-spinner-invalid-amount-text="Zadejte množství v násobcích {0}."><label>Množství<input type="number" min="${live.step}" step="${live.step}" value="${live.step}" aria-label="Množství ${esc(p.code)}"></label></div><button type="button" class="ao-cart-button">Do košíku</button></div>` : '<span class="ao-price-note">Objednání na detailu</span>'}<span class="ao-cart-status" aria-live="polite"></span>`;
            const button = row.querySelector('.ao-cart-button'); if (button) button.onclick = () => {
              const status = row.querySelector('.ao-cart-status');
              try { window.AutoLencOilLive.add(button, row, live, row.querySelector('.ao-quantity input').value); status.textContent = 'Požadavek předán košíku.'; } catch (error) { status.textContent = error.message; }
            };
          } catch (error) {
            if (error.name !== 'AbortError' && version === run && row) row.querySelector('.ao-live').innerHTML = '<span class="ao-price-note">Cenu a sklad ověřte na detailu.</span>';
          }
        }
      }
      await Promise.all([worker(), worker(), worker()]);
    }
    render();
  }
})();
