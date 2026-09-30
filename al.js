(function () {
  'use strict';

  const script = document.getElementById('autolenc-custom-ux-js');
  if (script && script.__autolencStarted) return;
  if (script) script.__autolencStarted = true;

  const iconBase = '/Plugins/FlexView/Images/CategoriesSvg/';

  const parts = [
    { id: '101994', title: 'Motorový olej', path: ['100002', '100245', '101994'], image: iconBase + 'tdengineicon.svg' },
    { id: '100259', title: 'Olejový filtr', path: ['100005', '100259'], image: iconBase + 'tdfiltersicon.svg' },
    { id: '100263', title: 'Kabinový filtr', path: ['100005', '100263'], image: iconBase + 'tdfiltersicon.svg' },
    { id: '100260', title: 'Vzduchový filtr', path: ['100005', '100260'], image: iconBase + 'tdfiltersicon.svg' },
    { id: '100261', title: 'Palivový filtr', path: ['100005', '100261'], image: iconBase + 'tdfiltersicon.svg' },
    { id: '100042', title: 'Baterie', path: ['100010', '100042'], image: iconBase + 'tdelectronicsicon.svg' },
    { id: '100136', title: 'Raménko / uložení stěrače', path: ['100018', '100136'], image: iconBase + 'tdwindowsicon.svg' },
    { id: '100032', title: 'Brzdové kotouče', path: ['100006', '100626', '100032'], image: iconBase + 'tdbreakesicon.svg' },
    { id: '100030', title: 'Brzdové destičky', path: ['100006', '100626', '100030'], image: iconBase + 'tdbreakesicon.svg' },
    { id: '100121', title: 'Tlumiče', path: ['100011', '100121'], image: iconBase + 'tdsuspensionicon.svg' },
    { id: '100113', title: 'Pružiny', path: ['100011', '100113'], image: iconBase + 'tdsuspensionicon.svg' },
    { id: '100206', title: 'Náboj / ložisko kola', path: ['100013', '100206'], image: iconBase + 'tdsuspensionicon.svg' }
  ];

  const shortcutRx = /^javascript:\s*getTecDocConstructionGroupShortcutSubcategories\(\s*\d+\s*,\s*'([a-z0-9-]+)'\s*,\s*'([1-9]\d*)'\s*,\s*'([a-z0-9-]+)'\s*,\s*'([1-9]\d*)'\s*,\s*'([a-z0-9-]+)'\s*,\s*'([1-9]\d*)'\s*,\s*'(osobni)'\s*,\s*''\s*\)\s*;?\s*$/;
  const MAX_REQUESTS_PER_VEHICLE = 12;

  let block = null;
  let target = null;
  let signature = '';
  let loading = '';
  let generation = 0;
  let timer = null;
  let disabled = false;
  let cache = new Map();
  let requestSig = '';
  let requestCount = 0;

  function lang() {
    const match = location.pathname.match(/^\/([^/]+)\//);
    return match ? match[1] : 'cs';
  }

  function routeSignature() {
    const p = location.pathname.replace(/^\/+|\/+$/g, '').split('/');

    if (
      (p.length !== 10 && p.length !== 12) ||
      p[0] !== lang() ||
      p[1] !== 'katalog' ||
      p[2] !== 'tecdoc' ||
      p[3] !== 'osobni'
    ) return null;

    const numericStart = p.length === 10 ? 7 : 8;
    const slugs = [p[4], p[5], p[6]];
    if (p.length === 12) slugs.push(p[7]);

    if (!slugs.every(value => /^[a-z0-9-]+$/.test(value))) return null;

    if (![p[numericStart], p[numericStart + 1], p[numericStart + 2]]
      .every(value => /^[1-9]\d*$/.test(value))) return null;

    if (p.length === 12 && !/^[1-9]\d*$/.test(p[11])) return null;

    return [
      p[3],
      p[4],
      p[numericStart],
      p[5],
      p[numericStart + 1],
      p[6],
      p[numericStart + 2]
    ].join('|');
  }

  function context() {
    const roots = document.querySelectorAll('.flex-tecdoc');
    if (roots.length !== 1) return null;

    const containers = Array.from(
      roots[0].querySelectorAll('.categories .shortcuts-container')
    ).filter(element => element.querySelector(
      'a[href*="getTecDocConstructionGroupShortcutSubcategories"]'
    ));

    if (containers.length !== 1) return null;

    const sourceLinks = containers[0].querySelectorAll(
      'a[href*="getTecDocConstructionGroupShortcutSubcategories"]'
    );

    let vehicle = null;

    for (const link of sourceLinks) {
      const match = (link.getAttribute('href') || '').trim().match(shortcutRx);
      if (!match) return null;

      const candidate = {
        manufacturerName: match[1],
        manufacturerID: match[2],
        modelName: match[3],
        modelID: match[4],
        engineName: match[5],
        engineID: match[6],
        vehicleType: match[7]
      };

      candidate.signature = [
        candidate.vehicleType,
        candidate.manufacturerName,
        candidate.manufacturerID,
        candidate.modelName,
        candidate.modelID,
        candidate.engineName,
        candidate.engineID
      ].join('|');

      if (!vehicle) vehicle = candidate;
      else if (vehicle.signature !== candidate.signature) return null;
    }

    if (!vehicle || vehicle.signature !== routeSignature()) return null;

    return { target: containers[0], vehicle };
  }

  function getApiBase() {
    try {
      // DŮLEŽITÉ: Nextis má API_LEGACY_TECDOCSVC jako globální binding,
      // ne jako window.API_LEGACY_TECDOCSVC.
      if (typeof API_LEGACY_TECDOCSVC !== 'string') return null;

      const url = new URL(API_LEGACY_TECDOCSVC, location.origin + '/');
      if (
        url.origin !== location.origin ||
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) return null;

      return url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    } catch (_) {
      return null;
    }
  }

  function removeBlock() {
    if (block && block.isConnected) block.remove();
    block = null;
  }

  function parseItems(response) {
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    if (!data || typeof data.ItemsHTMLContent !== 'string') return null;

    const template = document.createElement('template');
    template.innerHTML = data.ItemsHTMLContent;
    return template.content;
  }

  function branch(parentId, fullPath, vehicle) {
    const key = vehicle.signature + '|' + fullPath;
    if (cache.has(key)) return cache.get(key);

    if (requestSig !== vehicle.signature) {
      requestSig = vehicle.signature;
      requestCount = 0;
    }

    if (requestCount >= MAX_REQUESTS_PER_VEHICLE) {
      const skipped = Promise.resolve(null);
      cache.set(key, skipped);
      return skipped;
    }

    requestCount++;

    const promise = new Promise(resolve => {
      let done = false;

      function finish(value) {
        if (done) return;
        done = true;
        resolve(value);
      }

      const timeout = window.setTimeout(() => finish(null), 8000);

      try {
        const apiBase = getApiBase();

        if (
          !window.app ||
          !window.app.ajax ||
          typeof window.app.ajax.postMvc !== 'function' ||
          !apiBase
        ) {
          window.clearTimeout(timeout);
          finish(null);
          return;
        }

        window.app.ajax.postMvc({
          url: apiBase + 'GetTecDocConstructionGroupsSubcategories',
          data: {
            id: parentId,
            manufacturerName: vehicle.manufacturerName,
            manufacturerID: vehicle.manufacturerID,
            modelName: vehicle.modelName,
            modelID: vehicle.modelID,
            engineName: vehicle.engineName,
            engineID: vehicle.engineID,
            vehicleType: vehicle.vehicleType,
            fullCategoryIDsPath: fullPath,
            isShortcut: false
          }
        }, function (response) {
          window.clearTimeout(timeout);
          try {
            finish(parseItems(response));
          } catch (error) {
            console.warn('[AutoLenc UX] Neplatná odpověď TecDoc větve ' + fullPath, error);
            finish(null);
          }
        });
      } catch (error) {
        window.clearTimeout(timeout);
        console.warn('[AutoLenc UX] Nelze načíst TecDoc větev ' + fullPath, error);
        finish(null);
      }
    });

    cache.set(key, promise);
    return promise;
  }

  function findNode(fragment, nodeId, fullPath, requireEnd) {
    if (!fragment) return null;

    const found = Array.from(
      fragment.querySelectorAll('a[data-node-id="' + nodeId + '"]')
    ).filter(link => {
      if ((link.getAttribute('data-full-category-ids-path') || '') !== fullPath) {
        return false;
      }

      if (requireEnd) {
        return (
          link.getAttribute('data-is-end-node') === 'true' &&
          link.getAttribute('data-is-expandable') === 'false'
        );
      }

      return (
        link.getAttribute('data-is-end-node') === 'false' &&
        link.getAttribute('data-is-expandable') === 'true'
      );
    });

    return found.length === 1 ? found[0] : null;
  }

  function finalHref(rawHref, part, vehicle) {
    let url;

    try {
      url = new URL(rawHref, location.origin + '/');
    } catch (_) {
      return null;
    }

    if (
      url.origin !== location.origin ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash
    ) return null;

    const p = url.pathname.replace(/^\/+|\/+$/g, '').split('/');

    if (
      p.length !== 12 ||
      p[0] !== lang() ||
      p[1] !== 'katalog' ||
      p[2] !== 'tecdoc' ||
      p[3] !== vehicle.vehicleType ||
      p[4] !== vehicle.manufacturerName ||
      p[5] !== vehicle.modelName ||
      p[6] !== vehicle.engineName ||
      p[8] !== vehicle.manufacturerID ||
      p[9] !== vehicle.modelID ||
      p[10] !== vehicle.engineID ||
      p[11] !== part.id ||
      !/^[a-z0-9-]+$/.test(p[7])
    ) return null;

    const expectedPath = part.path.join('~');

    if (
      url.searchParams.getAll('path').length !== 1 ||
      url.searchParams.get('path') !== expectedPath ||
      Array.from(url.searchParams.keys()).some(key => key !== 'path')
    ) return null;

    return url.href;
  }

  async function resolvePart(part, vehicle) {
    if (part.path[part.path.length - 1] !== part.id) return null;

    for (let i = 0; i < part.path.length - 1; i++) {
      const parentId = part.path[i];
      const parentPath = part.path.slice(0, i + 1).join('~');
      const childId = part.path[i + 1];
      const childPath = part.path.slice(0, i + 2).join('~');
      const isFinal = i + 1 === part.path.length - 1;

      const fragment = await branch(parentId, parentPath, vehicle);
      const link = findNode(fragment, childId, childPath, isFinal);
      if (!link) return null;

      if (isFinal) {
        const href = finalHref(link.getAttribute('href'), part, vehicle);
        return href ? { part, href } : null;
      }
    }

    return null;
  }

  function render(ctx, entries) {
    removeBlock();

    if (
      !entries.length ||
      !ctx.target.isConnected ||
      document.getElementById('autolenc-quick-parts')
    ) return;

    const section = document.createElement('section');
    section.id = 'autolenc-quick-parts';
    section.dataset.vehicleSignature = ctx.vehicle.signature;
    section.setAttribute('aria-labelledby', 'autolenc-quick-parts-title');

    const heading = document.createElement('h2');
    heading.id = 'autolenc-quick-parts-title';
    heading.className = 'autolenc-heading';
    heading.textContent = 'Nejčastěji hledané díly';

    const grid = document.createElement('div');
    grid.className = 'autolenc-grid';

    for (const entry of entries) {
      const link = document.createElement('a');
      link.className = 'autolenc-tile';
      link.href = entry.href;
      link.setAttribute('data-autolenc-node-id', entry.part.id);

      try {
        const imageUrl = new URL(entry.part.image, location.origin + '/');
        if (
          imageUrl.protocol === 'https:' &&
          !imageUrl.username &&
          !imageUrl.password
        ) {
          const image = document.createElement('img');
          image.className = 'autolenc-image';
          image.src = imageUrl.href;
          image.alt = '';
          image.width = 50;
          image.height = 50;
          image.loading = 'lazy';
          image.addEventListener('error', () => image.remove(), { once: true });
          link.appendChild(image);
        }
      } catch (_) {}

      const label = document.createElement('span');
      label.className = 'autolenc-label';
      label.textContent = entry.part.title;

      link.appendChild(label);
      grid.appendChild(link);
    }

    section.append(heading, grid);

    function guard(event) {
      const link = event.target.closest && event.target.closest('a.autolenc-tile');
      if (!link) return;

      const now = context();
      if (!now || now.vehicle.signature !== section.dataset.vehicleSignature) {
        event.preventDefault();
        refresh();
      }
    }

    ['click', 'auxclick', 'contextmenu', 'dragstart'].forEach(eventName => {
      section.addEventListener(eventName, guard, true);
    });

    ctx.target.before(section);
    block = section;
  }

  async function load(ctx) {
    const run = ++generation;
    loading = ctx.vehicle.signature;
    removeBlock();

    const entries = [];

    for (const part of parts) {
      if (run !== generation || disabled) return;

      try {
        const entry = await resolvePart(part, ctx.vehicle);
        if (entry) entries.push(entry);
      } catch (error) {
        console.warn('[AutoLenc UX] Přeskočena kategorie ' + part.id, error);
      }
    }

    if (run !== generation || disabled) return;

    const now = context();
    if (!now || now.vehicle.signature !== ctx.vehicle.signature) return;

    loading = '';
    signature = now.vehicle.signature;
    target = now.target;
    render(now, entries);
  }

  function resetState() {
    generation++;
    loading = '';
    signature = '';
    target = null;
    cache.clear();
    requestSig = '';
    requestCount = 0;
    removeBlock();
  }

  function refresh() {
    if (
      disabled ||
      document.hidden ||
      !window.matchMedia('(min-width: 1024px)').matches
    ) return;

    try {
      const ctx = context();

      if (!ctx) {
        resetState();
        return;
      }

      const same = (
        ctx.vehicle.signature === signature &&
        ctx.target === target
      );

      if (same && block && block.isConnected) return;
      if (ctx.vehicle.signature === loading) return;

      if (ctx.vehicle.signature !== signature) {
        cache.clear();
        requestSig = ctx.vehicle.signature;
        requestCount = 0;
        signature = '';
      }

      load(ctx);
    } catch (error) {
      disabled = true;
      generation++;
      loading = '';
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      removeBlock();
      console.warn('[AutoLenc UX] Doplněk byl vypnut:', error);
    }
  }

  function start() {
    if (disabled) return;
    refresh();
    if (timer === null) timer = window.setInterval(refresh, 1000);
  }

  function pause() {
    generation++;
    loading = '';
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  }

  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', start);
  window.addEventListener('popstate', refresh);
  document.addEventListener('visibilitychange', refresh);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
