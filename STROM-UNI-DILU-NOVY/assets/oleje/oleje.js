(function () {
  'use strict';
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const version = new URL(script.src).searchParams.get('v') || '2';
  const assetURL = path => { const url = new URL(path, base); url.searchParams.set('v', version); return url; };
  const mount = document.getElementById('al-oils-mount');
  if (!mount || mount.dataset.loaded) return;
  const hosted = mount.dataset.hostHash === 'uni';
  mount.dataset.loaded = 'true';
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = assetURL('oleje.css'); document.head.append(css);
  const adapter = document.createElement('script'); adapter.src = assetURL('live.js');
  const adapterReady = new Promise((resolve, reject) => { adapter.onload = resolve; adapter.onerror = reject; }); document.head.append(adapter);
  mount.innerHTML = '<div id="al-oils"><p role="status">Načítáme katalog olejů…</p></div>';
  const app = mount.firstElementChild;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } };
  const readJSON = async path => { const r = await fetch(assetURL(path), { credentials: 'omit' }); if (!r.ok) throw Error('Soubor ' + path + ' není dostupný (' + r.status + ').'); return r.json(); };
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/w-(\d)/g, 'w$1');
  const productCount = n => `${n} ${n === 1 ? 'produkt' : n >= 2 && n <= 4 ? 'produkty' : 'produktů'}`;
  const icon = name => `<svg class="ao-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({
    all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    engine: '<path d="M7 7h10v3h3v8H8l-3-3V9h2zM9 4h6M12 4v3M2 10v6M2 13h3"/>',
    gear: '<path d="m10 3-1 3-3 1-2-1-2 4 2 2v3l-1 2 3 3 3-1 3 1 1 2 4-1v-3l2-2 3-1-1-4-3-1-1-3 1-2-4-2z"/><circle cx="12" cy="12" r="3"/>',
    transmission: '<path d="M6 4v16M6 12h12M18 4v16M12 4v8"/><circle cx="6" cy="4" r="2"/><circle cx="18" cy="4" r="2"/><circle cx="18" cy="20" r="2"/>',
    moto: '<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 5-7h5l4 7M9 17h5l-4-7M13 6h3l1 5M6 10h4"/>',
    truck: '<path d="M2 5h12v12H2zM14 10h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    tractor: '<circle cx="7" cy="17" r="4"/><circle cx="19" cy="18" r="2"/><path d="M5 13V5h8l2 9h5v2M9 5v8M16 9V6M3 5h11"/>',
    drop: '<path d="M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12zM9 16a3 3 0 0 0 3 3"/>',
    image: '<path d="M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M3 3l18 18"/><circle cx="15" cy="8" r="1"/>',
    cart: '<path d="M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  })[name] || ''}</svg>`;
  Promise.all([readJSON('config.json'), readJSON('../../catalog/oleje/index.json').catch(() => readJSON('../../catalog/oleje/catalog.json')), readJSON('../../catalog/oleje/overrides.json'), adapterReady, readJSON('../../catalog/oleje/availability-order.json').catch(() => ({ entries: [] }))]).then(start).catch(error => {
    app.innerHTML = '<div class="ao-status" role="alert">Katalog se nepodařilo načíst. ' + esc(error.message) + '</div>';
  });
  function start([config, catalog, overrides, , availability]) {
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
    const categories = config.categories || [];
    const categoryById = new Map(products.map(p => [p.id, categories.find(c => c.pattern && new RegExp(c.pattern, 'i').test(p.name))?.id || categories.find(c => c.fallback)?.id || 'other']));
    const productById = new Map(products.map(p => [p.id, p]));
    const searchIndex = new Map(products.map(p => [p.id, fold([p.name, p.code, p.brand, ...Object.values(p.specifications).flat()].join(' '))]));
    const state = { selected: {}, q: '', page: 1, sort: 'stock', category: '' };
    const liveCache = new Map(); let run = 0; let controller; let searchTimer;
    const quantities = new Map(); const facetCounts = new Map();
    let stockOrder = new Map((availability.entries || []).map(([id, tier], rank) => [id, { tier, rank }]));
    let bulkPromise = null; let stockStatus = 'snapshot'; let stockCheckedAt = 0; let currentVisible = [];
    const sameShop = location.origin === new URL(config.shop_origin).origin;
    const size = Math.max(1, Number(config.page_size) || 12);
    const collator = new Intl.Collator('cs', { numeric: true, sensitivity: 'base' });
    function restore() {
      state.selected = {}; state.q = ''; state.page = 1; state.sort = 'stock'; state.category = '';
      if (!hosted && !location.hash.startsWith('#oil=')) return;
      try {
        const hash = new URLSearchParams(hosted ? new URLSearchParams(location.hash.slice(1)).get('oil') || '' : decodeURIComponent(location.hash.slice(5)));
        state.q = hash.get('q') || ''; state.page = Math.max(1, Math.floor(Number(hash.get('page'))) || 1);
        state.sort = ['stock', 'name', 'code'].includes(hash.get('sort')) ? hash.get('sort') : 'stock'; state.selected = {};
        state.category = categories.some(c => c.id === hash.get('category')) ? hash.get('category') : '';
        fields.forEach(key => { const list = hash.getAll(key); if (list.length) state.selected[key] = new Set(list); });
      } catch (_) {}
    }
    function writeHash() {
      if (hosted && (mount.hidden || new URLSearchParams(location.hash.slice(1)).get('uni') !== 'n:19058')) return;
      const h = new URLSearchParams(); if (state.q) h.set('q', state.q); if (state.page > 1) h.set('page', state.page); if (state.sort !== 'stock') h.set('sort', state.sort); if (state.category) h.set('category', state.category);
      Object.entries(state.selected).forEach(([key, set]) => set.forEach(v => h.append(key, v)));
      const host = hosted ? new URLSearchParams(location.hash.slice(1)) : null;
      if (host) { if (h.size) host.set('oil', h.toString()); else host.delete('oil'); }
      const hash = host ? '#' + host.toString() : h.size ? '#oil=' + encodeURIComponent(h.toString()) : '';
      history.replaceState(null, '', location.pathname + location.search + hash);
    }
    function matches(p, except) {
      if (except !== 'category' && state.category && categoryById.get(p.id) !== state.category) return false;
      if (state.q && !fold(state.q).split(/\s+/).every(word => searchIndex.get(p.id).includes(word))) return false;
      return config.filters.every(f => {
        if (f.key === except) return true;
        const selected = state.selected[f.key]; if (!selected?.size) return true;
        const actual = values(p, f.key);
        return f.mode === 'all' ? [...selected].every(v => actual.includes(v)) : [...selected].some(v => actual.includes(v));
      });
    }
    restore();
    app.innerHTML = `<header class="ao-head"><div><span class="ao-kicker">AUTO LENC · KATALOG</span><h2 class="ao-title">${esc(config.title)}</h2><p class="ao-intro">${esc(config.subtitle)}</p></div></header>
      <nav class="ao-categories" aria-label="Kategorie olejů"></nav>
      <div class="ao-layout"><aside class="ao-sidebar" aria-label="Filtry produktů"><div class="ao-filter-head"><strong>Filtrovat produkty</strong><button type="button" class="ao-reset">Vymazat</button></div><div class="ao-facets"></div></aside>
      <main class="ao-main"><button type="button" class="ao-mobile-filters" aria-expanded="false">Zobrazit filtry</button><div class="ao-viscosities" aria-label="Rychlý výběr viskozity"></div>
      <details class="ao-advisors"><summary>Potřebujete poradit s výběrem oleje?</summary><div>${config.advisors.map(a => `<a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.name)} ↗</a>`).join('')}</div></details>
      <div class="ao-searchbar">${icon('search')}<input class="ao-search" type="search" aria-label="Hledat v katalogu" placeholder="Hledat název, objednací číslo nebo normu…"></div>
      <div class="ao-toolbar"><strong class="ao-count" aria-live="polite"></strong><div class="ao-controls"><select class="ao-sort" aria-label="Řazení"><option value="stock">Skladem první</option><option value="name">Podle názvu</option><option value="code">Podle obj. čísla</option></select><button type="button" class="ao-small-button ao-share">Sdílet výběr</button><button type="button" class="ao-small-button ao-refresh">Obnovit sklad</button></div></div>
      <div class="ao-chips"></div><p class="ao-sync-status" role="status"></p><div class="ao-list-head"><span>Produkt</span><span>Specifikace a balení</span><span>Cena bez DPH</span></div><div class="ao-list"></div><nav class="ao-pagination" aria-label="Stránky produktů"></nav>
      <p class="ao-footer">Specifikace vycházejí z uvedených zdrojů. Požadavky na olej ověřte v příručce vozidla. ${sameShop ? 'Ceny a dostupnost se načítají z e-shopu při zobrazení produktů.' : 'Aktuální cenu, sklad a košík najdete na detailu produktu v e-shopu.'}</p></main></div>`;
    const $ = selector => app.querySelector(selector);
    $('.ao-search').value = state.q; $('.ao-sort').value = state.sort;
    $('.ao-mobile-filters').onclick = event => { const open = app.classList.toggle('ao-filters-open'); event.currentTarget.setAttribute('aria-expanded', String(open)); event.currentTarget.textContent = open ? 'Skrýt filtry' : 'Zobrazit filtry'; };
    $('.ao-reset').onclick = () => { state.selected = {}; state.q = ''; state.category = ''; state.page = 1; $('.ao-search').value = ''; render(); };
    $('.ao-search').oninput = event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = event.target.value.trim(); state.page = 1; render(); }, 220); };
    $('.ao-search').onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); };
    $('.ao-sort').onchange = event => { state.sort = event.target.value; state.page = 1; render(); };
    $('.ao-refresh').onclick = () => { if (bulkPromise) return; liveCache.clear(); stockCheckedAt = 0; syncStock(); render(); };
    $('.ao-share').onclick = async event => { try { await navigator.clipboard.writeText(location.href); event.target.textContent = 'Odkaz zkopírován'; setTimeout(() => { event.target.textContent = 'Sdílet výběr'; }, 1800); } catch (_) { event.target.textContent = 'Zkopírujte adresu stránky'; } };
    const restoreView = () => { if (hosted && mount.hidden) return; restore(); $('.ao-search').value = state.q; $('.ao-sort').value = state.sort; render(); };
    if (!hosted) window.addEventListener('hashchange', restoreView);
    mount.addEventListener('al:resume', restoreView);
    mount.addEventListener('al:pause', () => { clearTimeout(searchTimer); controller?.abort(); });
    function toggle(key, value) { const set = state.selected[key] ||= new Set(); if (!set.has(value) && !(facetCounts.get(key)?.get(value) > 0)) return; set.has(value) ? set.delete(value) : set.add(value); if (!set.size) delete state.selected[key]; state.page = 1; render(); }
    function sortedProducts() {
      return products.filter(p => matches(p)).sort((a, b) => {
        if (state.sort === 'stock') {
          const rank = p => { const live = liveCache.get(p.id); const stored = stockOrder.get(p.id); const fresh = live && live.at >= stockCheckedAt && Date.now() - live.at <= 300000; return { tier: fresh ? (live.onStock ? 0 : live.onWay ? 1 : 2) : stored?.tier ?? 2, rank: stored?.rank ?? Number.MAX_SAFE_INTEGER }; };
          const ra = rank(a), rb = rank(b); return ra.tier - rb.tier || ra.rank - rb.rank || collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
        }
        return collator.compare(a[state.sort], b[state.sort]) || collator.compare(a.id, b.id);
      });
    }
    function syncLabel() {
      const text = !sameShop ? 'Živá nabídka je dostupná na e-shopu.' : stockStatus === 'loading' ? 'Aktualizujeme ceny a dostupnost…' : stockStatus === 'ready' ? 'Ceny bez DPH · dostupnost právě ověřena' : stockStatus === 'error' ? 'Řazení podle posledního přehledu. Dostupnost ověřujeme u zobrazených položek.' : 'Řazení podle posledního přehledu skladu.';
      $('.ao-sync-status').textContent = text; $('.ao-sync-status').dataset.state = stockStatus;
    }
    function render() {
      controller?.abort(); controller = new AbortController(); const version = ++run;
      const active = document.activeElement;
      const focus = active?.dataset?.filter ? { key: active.dataset.filter, value: active.value } : null;
      const previousOpen = new Map([...app.querySelectorAll('.ao-facet')].map(el => [el.dataset.key, el.open]));
      const previousSearch = new Map([...app.querySelectorAll('.ao-facet-search')].map(el => [el.closest('.ao-facet').dataset.key, el.value]));
      const categoryProducts = products.filter(p => matches(p, 'category'));
      $('.ao-categories').innerHTML = [{ id: '', label: 'Všechny oleje', icon: 'all' }, ...categories].map(c => {
        const count = c.id ? categoryProducts.filter(p => categoryById.get(p.id) === c.id).length : categoryProducts.length;
        if (!count && c.id !== state.category) return '';
        return `<button type="button" class="ao-category ${state.category === c.id ? 'is-active' : ''}" data-category="${esc(c.id)}" aria-pressed="${state.category === c.id}">${icon(c.icon)}<span><strong>${esc(c.label)}</strong><small>${productCount(count)}</small></span></button>`;
      }).join('');
      app.querySelectorAll('[data-category]').forEach(b => { b.onclick = () => { state.category = b.dataset.category; state.page = 1; render(); }; });
      $('.ao-facets').innerHTML = config.filters.map(f => {
        const universe = products.filter(p => matches(p, f.mode === 'all' ? undefined : f.key));
        const counts = new Map(); universe.forEach(p => new Set(values(p, f.key)).forEach(v => counts.set(v, (counts.get(v) || 0) + 1))); facetCounts.set(f.key, counts);
        const selected = state.selected[f.key] || new Set();
        const all = [...new Set([...counts.keys(), ...selected])].sort(collator.compare);
        if (!all.length) return '';
        if (!selected.size && all.length === 1 && counts.get(all[0]) === universe.length) return '';
        return `<details class="ao-facet" data-key="${esc(f.key)}" ${(previousOpen.get(f.key) ?? f.open) ? 'open' : ''}><summary>${esc(f.label)}</summary>${f.mode === 'all' ? '<p class="ao-mode-hint">Musí splnit všechny vybrané hodnoty.</p>' : ''}${all.length > 12 ? `<input type="search" class="ao-facet-search" placeholder="Hledat v hodnotách" aria-label="Hledat: ${esc(f.label)}">` : ''}<div class="ao-facet-values">${all.map(v => `<label class="ao-option"><input type="checkbox" data-filter="${esc(f.key)}" value="${esc(v)}" ${state.selected[f.key]?.has(v) ? 'checked' : ''}><span>${esc(label(f.key, v))}</span><small>${counts.get(v) || 0}</small></label>`).join('')}</div></details>`;
      }).join('');
      app.querySelectorAll('[data-filter]').forEach(input => { input.onchange = () => toggle(input.dataset.filter, input.value); });
      if (focus) [...app.querySelectorAll('[data-filter]')].find(input => input.dataset.filter === focus.key && input.value === focus.value)?.focus?.({ preventScroll: true });
      app.querySelectorAll('.ao-facet-search').forEach(input => { input.oninput = () => { const q = input.value.toLocaleLowerCase('cs'); input.closest('.ao-facet').querySelectorAll('.ao-option').forEach(option => { option.hidden = !option.textContent.toLocaleLowerCase('cs').includes(q); }); }; input.onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); }; });
      app.querySelectorAll('.ao-facet-search').forEach(input => { input.value = previousSearch.get(input.closest('.ao-facet').dataset.key) || ''; if (input.value) input.oninput(); });
      $('.ao-viscosities').innerHTML = config.quick_viscosities.map(v => { const count = facetCounts.get('sae')?.get(v) || 0; return count || state.selected.sae?.has(v) ? `<button type="button" class="ao-viscosity ${state.selected.sae?.has(v) ? 'is-active' : ''}" data-sae="${esc(v)}" aria-pressed="${!!state.selected.sae?.has(v)}"><strong>${esc(v)}</strong><span>${productCount(count)}</span></button>` : ''; }).join('');
      $('.ao-viscosities').hidden = !$('.ao-viscosities').innerHTML;
      app.querySelectorAll('[data-sae]').forEach(button => { button.onclick = () => toggle('sae', button.dataset.sae); });
      const found = sortedProducts();
      const pages = Math.max(1, Math.ceil(found.length / size)); state.page = Math.min(state.page, pages); writeHash();
      const from = (state.page - 1) * size; const visible = found.slice(from, from + size); currentVisible = visible;
      $('.ao-count').textContent = found.length ? `${productCount(found.length)} · ${from + 1}–${Math.min(from + size, found.length)}` : 'Žádné produkty';
      $('.ao-chips').innerHTML = Object.entries(state.selected).flatMap(([key, set]) => [...set].map(v => `<button type="button" class="ao-chip" data-key="${esc(key)}" data-value="${esc(v)}">${esc(label(key, v))} ×</button>`)).join('');
      app.querySelectorAll('.ao-chip').forEach(b => { b.onclick = () => toggle(b.dataset.key, b.dataset.value); });
      $('.ao-list').innerHTML = visible.length ? visible.map(productRow).join('') : `<div class="ao-empty">${icon('search')}<strong>Pro tento výběr jsme nenašli žádné produkty.</strong><span>Zkuste ubrat filtr nebo upravit hledání.</span><button type="button" class="ao-empty-reset">Vymazat výběr</button></div>`;
      const emptyReset = $('.ao-empty-reset'); if (emptyReset) emptyReset.onclick = () => $('.ao-reset').click();
      app.querySelectorAll('.ao-image img').forEach(img => { const hide = () => { img.hidden = true; img.parentElement.classList.add('is-missing'); }; img.onerror = hide; img.onload = () => { if (img.naturalWidth < 12 || img.naturalHeight < 12) hide(); }; if (img.complete && (!img.naturalWidth || img.naturalWidth < 12)) hide(); });
      const pageSet = [...new Set([1, state.page - 1, state.page, state.page + 1, pages])].filter(p => p > 0 && p <= pages).sort((a, b) => a - b);
      $('.ao-pagination').innerHTML = pages > 1 ? `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>Předchozí</button>${pageSet.map(p => `<button type="button" data-page="${p}" ${p === state.page ? 'aria-current="page"' : ''}>${p}</button>`).join('')}<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Další</button>` : '';
      app.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { state.page = Number(b.dataset.page); render(); $('.ao-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
      syncLabel();
      if (sameShop && config.live_prices) { if (!bulkPromise && (!stockCheckedAt || Date.now() - stockCheckedAt > 300000)) syncStock(); loadLive(visible, version, controller.signal); }
    }
    function productRow(p) {
      const chips = ['acea', 'api', 'ilsac'].flatMap(key => values(p, key).map(v => `<span class="ao-spec"><small>${esc(key.toUpperCase())}</small> ${esc(v)}</span>`)).slice(0, 7).join('');
      const category = categories.find(c => c.id === categoryById.get(p.id));
      const primary = ['sae', 'volume_l'].flatMap(key => values(p, key).map(v => `<span class="ao-primary-spec"><small>${key === 'sae' ? 'Viskozita' : 'Balení'}</small><strong>${esc(label(key, v))}</strong></span>`)).join('');
      const approvals = values(p, 'approvals'); const recommendations = values(p, 'recommendations');
      const rawRows = (p.raw_parameters || []).map(x => `<tr><th>${esc(x.name)}</th><td>${esc(x.value)}</td></tr>`).join('');
      const extraRows = Object.entries(p.evidence || {}).filter(([, e]) => ['manual_verified', 'shop_product_title'].includes(e.source_type)).map(([key, e]) => `<tr><th>${esc(config.filters.find(f => f.key === key)?.label || key)} ${e.source_type === 'shop_product_title' ? '(z názvu)' : '(ověřené doplnění)'}</th><td>${esc(values(p, key).map(v => label(key, v)).join(' · '))} <a href="${esc(safeURL(e.source_url))}" target="_blank" rel="noopener noreferrer">Zdroj ↗</a></td></tr>`).join('');
      const rows = extraRows + rawRows;
      const source = safeURL(p.source?.url || p.source_url || p.url);
      const usableImage = safeURL(p.image) && !/FlexBlank|no[-_]?image|placeholder/i.test(p.image);
      return `<article class="ao-product" id="ao-product-${esc(p.id)}"><a class="ao-image ${usableImage ? '' : 'is-missing'}" href="${esc(safeURL(p.url))}" aria-label="${esc(p.name)}"><span class="ao-image-placeholder" role="img" aria-label="Fotografie není k dispozici">${icon('image')}</span>${usableImage ? `<img src="${esc(safeURL(p.image))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="112" height="130">` : ''}</a><div class="ao-info"><div class="ao-product-meta"><span class="ao-brand">${esc(p.brand)}</span><span>${esc(category?.label || '')}</span></div><h3><a href="${esc(safeURL(p.url))}">${esc(p.name)}</a></h3><p class="ao-code">Obj. číslo: <strong>${esc(p.code)}</strong></p><div class="ao-primary-specs">${primary}</div><div class="ao-specs">${chips}</div>${approvals.length ? `<p class="ao-oem"><strong>Schválení:</strong> ${esc(approvals.slice(0, 3).join(' · '))}${approvals.length > 3 ? ` <span>+${approvals.length - 3} dalších</span>` : ''}</p>` : ''}${rows ? `<details class="ao-parameters"><summary>Všechny parametry <span>+</span></summary>${recommendations.length ? `<p class="ao-oem"><strong>Doporučení:</strong> ${esc(recommendations.join(' · '))}</p>` : ''}<table>${rows}</table><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Zdroj parametrů ↗</a></details>` : ''}</div><div class="ao-buy"><div class="ao-live" role="status">${sameShop ? '<div class="ao-skeleton" aria-label="Načítáme cenu a dostupnost"><i></i><i></i><i></i></div>' : '<span class="ao-price-note">Cena a sklad v e-shopu</span>'}</div><a class="ao-detail" href="${esc(safeURL(p.url))}">Detail produktu →</a></div></article>`;
    }
    function paintLive(p, live) {
      const row = document.getElementById('ao-product-' + p.id); if (!row) return;
      if (row.contains(document.activeElement) && document.activeElement?.closest('.ao-cart')) return;
      row.classList.toggle('is-stock', !!live.onStock);
      row.querySelector('.ao-live').innerHTML = `<span class="ao-stock ${live.onStock ? 'is-stock' : ''}">${live.onStock ? icon('check') : icon('truck')}${esc(live.stock)}</span>${live.price ? `<strong class="ao-price">${esc(live.price)} <small>${esc(live.currency)}</small></strong><span class="ao-price-note">bez DPH</span>` : '<span class="ao-price-note">Cena na dotaz</span>'}${live.delivery ? `<span class="ao-delivery">${esc(live.delivery)}</span>` : ''}${live.args && typeof window.addToBasket === 'function' ? `<div class="flex-add-to-basket ao-cart" data-flex-product-id="${esc(live.productId)}" data-flex-group-id="${esc(p.id)}"><div class="flex-basket-spinner ao-quantity" data-flex="true" data-flex-spinner-step="${live.step}" data-flex-spinner-invalid-amount-text="Zadejte množství v násobcích {0}."><button type="button" data-amount="minus" aria-label="Snížit množství">−</button><input type="number" min="${live.step}" step="${live.step}" value="${esc(quantities.get(p.id) || live.step)}" aria-label="Množství ${esc(p.code)}"><button type="button" data-amount="plus" aria-label="Zvýšit množství">+</button></div><button type="button" class="ao-cart-button">${icon('cart')}Do košíku</button></div>` : '<span class="ao-price-note">Objednání na detailu</span>'}<span class="ao-cart-status" aria-live="polite"></span>`;
      const input = row.querySelector('.ao-quantity input');
      if (input) { input.oninput = () => quantities.set(p.id, input.value); row.querySelectorAll('[data-amount]').forEach(b => { b.onclick = () => { const n = Number(input.value) || live.step; input.value = String(Number(Math.max(live.step, n + (b.dataset.amount === 'plus' ? live.step : -live.step)).toFixed(6))); quantities.set(p.id, input.value); }; }); }
      const button = row.querySelector('.ao-cart-button'); if (button) button.onclick = () => {
        const status = row.querySelector('.ao-cart-status');
        try { window.AutoLencOilLive.add(button, row, live, input.value); status.textContent = 'Požadavek předán košíku.'; } catch (error) { status.textContent = error.message; }
      };
    }
    function syncStock() {
      if (!sameShop || !config.live_prices || bulkPromise) return bulkPromise;
      const bulkController = new AbortController(); const timeout = setTimeout(() => bulkController.abort(), 30000);
      stockStatus = 'loading'; $('.ao-refresh').disabled = true; syncLabel();
      bulkPromise = window.AutoLencOilLive.stockCatalog(config, bulkController.signal).then(({ entries, doc }) => {
        const nextOrder = new Map(); const at = Date.now();
        entries.forEach(({ id, code, root }, rank) => {
          const p = productById.get(id); if (!p || p.code !== code) return;
          try { const live = { ...window.AutoLencOilLive.extract(doc, p, root), at }; liveCache.set(id, live); nextOrder.set(id, { tier: live.onStock ? 0 : live.onWay ? 1 : 2, rank }); } catch (_) {}
        });
        stockOrder = nextOrder; stockStatus = 'ready'; stockCheckedAt = at;
        const editing = document.activeElement?.closest?.('.ao-cart');
        const expected = sortedProducts().slice((state.page - 1) * size, state.page * size);
        if (state.sort === 'stock' && !editing && expected.map(p => p.id).join() !== currentVisible.map(p => p.id).join()) render();
        else currentVisible.forEach(p => { const live = liveCache.get(p.id); if (live) paintLive(p, live); });
      }).catch(() => { stockStatus = 'error'; stockCheckedAt = Date.now(); }).finally(() => { clearTimeout(timeout); bulkPromise = null; $('.ao-refresh').disabled = false; syncLabel(); });
      return bulkPromise;
    }
    async function loadLive(visible, version, signal) {
      const queue = visible.slice();
      visible.forEach(p => { const cached = liveCache.get(p.id); if (cached && Date.now() - cached.at <= 300000) paintLive(p, cached); });
      async function worker() {
        while (queue.length && !signal.aborted) {
          const p = queue.shift(); const row = document.getElementById('ao-product-' + p.id);
          try {
            let live = liveCache.get(p.id);
            if ((!live || Date.now() - live.at > 300000) && bulkPromise && stockOrder.has(p.id)) { await bulkPromise; if (version !== run || signal.aborted) return; live = liveCache.get(p.id); }
            if (!live || Date.now() - live.at > 300000) {
              const url = new URL(p.url); if (url.origin !== location.origin || !url.pathname.startsWith('/cs/katalog/')) throw Error('Neplatný detail.');
              const response = await fetch(url, { credentials: 'same-origin', signal, cache: 'no-store' }); if (!response.ok) throw Error('Detail není dostupný.');
              const doc = new DOMParser().parseFromString(await response.text(), 'text/html'); live = { ...window.AutoLencOilLive.extract(doc, p), at: Date.now() }; liveCache.set(p.id, live);
            }
            if (version !== run || signal.aborted) return;
            paintLive(p, live);
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
