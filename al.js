(function () {
  'use strict';

  if (window.__autolencQuickPartsDirectStarted) return;
  window.__autolencQuickPartsDirectStarted = true;

  const imageBase =
    'https://dominik0dw.github.io/al-site-assets/image-tec/';

  const parts = [
    {
      id: '101994',
      title: 'Motorový olej',
      slug: 'olej',
      path: ['100002', '100245', '101994'],
      image: imageBase + 'olej.png'
    },
    {
      id: '100259',
      title: 'Olejový filtr',
      slug: 'olejovy-filtr',
      path: ['100005', '100259'],
      image: imageBase + 'olejfiltr.png'
    },
    {
      id: '100263',
      title: 'Kabinový filtr',
      slug: 'kabinovy-vzduchovy-filtr',
      path: ['100005', '100263'],
      image: imageBase + 'kabfiltr.png'
    },
    {
      id: '100260',
      title: 'Vzduchový filtr',
      slug: 'vzduchovy-filtr',
      path: ['100005', '100260'],
      image: imageBase + 'vzduchfiltr.png'
    },
    {
      id: '100261',
      title: 'Palivový filtr',
      slug: 'palivovy-filtr',
      path: ['100005', '100261'],
      image: imageBase + 'palfiltr.png'
    },
    {
      id: '100042',
      title: 'Baterie',
      slug: 'baterie',
      path: ['100010', '100042'],
      image: imageBase + 'baterie.png'
    },
    {
      id: '100133',
      title: 'Stírací gumička',
      slug: 'stiraci-gumicka',
      path: ['100018', '100133'],
      image: imageBase + 'sterac.png'
    },
    {
      id: '100032',
      title: 'Brzdové kotouče',
      slug: 'brzdovy-kotouc',
      path: ['100006', '100626', '100032'],
      image: imageBase + 'kotouc.png'
    },
    {
      id: '100030',
      title: 'Brzdové destičky',
      slug: 'brzdove-oblozeni',
      path: ['100006', '100626', '100030'],
      image: imageBase + 'desky.png'
    },
    {
      id: '100121',
      title: 'Tlumiče',
      slug: 'tlumic-perovani',
      path: ['100011', '100121'],
      image: imageBase + 'tlumic.png'
    },
    {
      id: '100113',
      title: 'Pružiny',
      slug: 'pruzina-podvozku',
      path: ['100011', '100113'],
      image: imageBase + 'pruzina.png'
    },
    {
      id: '100579',
      title: 'Ložisko kola',
      slug: 'lozisko-kola',
      path: ['100013', '100206', '100579'],
      image: imageBase + 'lozisko.png'
    }
  ];

  let block = null;
  let mountedSignature = '';
  let observer = null;
  let scheduled = false;

  function getVehicleContext() {
    const p = location.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/');

    if (
      (p.length !== 10 && p.length !== 12) ||
      !/^[a-z]{2}$/.test(p[0]) ||
      p[1] !== 'katalog' ||
      p[2] !== 'tecdoc' ||
      p[3] !== 'osobni'
    ) {
      return null;
    }

    const categoryPage = p.length === 12;
    const numericStart = categoryPage ? 8 : 7;

    const manufacturer = p[4];
    const model = p[5];
    const engine = p[6];

    const manufacturerId = p[numericStart];
    const modelId = p[numericStart + 1];
    const engineId = p[numericStart + 2];

    if (
      ![manufacturer, model, engine].every(value =>
        /^[a-z0-9-]+$/.test(value)
      ) ||
      ![manufacturerId, modelId, engineId].every(value =>
        /^[1-9]\d*$/.test(value)
      )
    ) {
      return null;
    }

    if (
      categoryPage &&
      (
        !/^[a-z0-9-]+$/.test(p[7]) ||
        !/^[1-9]\d*$/.test(p[11])
      )
    ) {
      return null;
    }

    const base =
      '/' + [
        p[0],
        'katalog',
        'tecdoc',
        'osobni',
        manufacturer,
        model,
        engine
      ].join('/') + '/';

    const vehicleIdPath =
      [manufacturerId, modelId, engineId].join('/');

    return {
      base: base,
      vehicleIdPath: vehicleIdPath,
      signature: [
        manufacturer,
        manufacturerId,
        model,
        modelId,
        engine,
        engineId
      ].join('|')
    };
  }

  function getTarget() {
    const roots = document.querySelectorAll('.flex-tecdoc');
    if (roots.length !== 1) return null;

    const preferred = Array.from(
      roots[0].querySelectorAll('.categories .shortcuts-container')
    ).filter(element => element.querySelector('.shortcuts'));

    if (preferred.length === 1) return preferred[0];

    const fallback = Array.from(
      roots[0].querySelectorAll('.shortcuts-container')
    ).filter(element => element.querySelector('.shortcuts'));

    return fallback.length === 1 ? fallback[0] : null;
  }

  function buildHref(ctx, part) {
    if (
      part.path.length < 2 ||
      part.path[part.path.length - 1] !== part.id ||
      !part.path.every(value => /^[1-9]\d*$/.test(value)) ||
      !/^[a-z0-9-]+$/.test(part.slug)
    ) {
      return null;
    }

    return (
      ctx.base +
      part.slug + '/' +
      ctx.vehicleIdPath + '/' +
      part.id + '/?path=' +
      part.path.join('~')
    );
  }

  function removeBlock() {
    if (block && block.isConnected) {
      block.remove();
    }

    block = null;
    mountedSignature = '';
  }

  function createBlock(ctx) {
    const section = document.createElement('section');

    section.id = 'autolenc-quick-parts';
    section.dataset.vehicleSignature = ctx.signature;
    section.setAttribute(
      'aria-labelledby',
      'autolenc-quick-parts-title'
    );

    const heading = document.createElement('h2');

    heading.id = 'autolenc-quick-parts-title';
    heading.className = 'autolenc-heading';
    heading.textContent = 'Nejčastěji hledané díly';

    const grid = document.createElement('div');
    grid.className = 'autolenc-grid';

    for (const part of parts) {
      const href = buildHref(ctx, part);
      if (!href) continue;

      const link = document.createElement('a');

      link.className = 'autolenc-tile';
      link.href = href;
      link.setAttribute('data-autolenc-node-id', part.id);

      try {
        const imageUrl = new URL(part.image);

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
          image.decoding = 'async';

          image.addEventListener(
            'error',
            () => image.remove(),
            { once: true }
          );

          link.appendChild(image);
        }
      } catch (_) {}

      const label = document.createElement('span');

      label.className = 'autolenc-label';
      label.textContent = part.title;

      link.appendChild(label);
      grid.appendChild(link);
    }

    if (!grid.children.length) return null;

    section.append(heading, grid);

    return section;
  }

  function mount() {
    scheduled = false;

    const ctx = getVehicleContext();
    const target = getTarget();

    if (!ctx || !target) {
      removeBlock();
      return;
    }

    if (
      block &&
      block.isConnected &&
      mountedSignature === ctx.signature &&
      block.nextElementSibling === target
    ) {
      return;
    }

    removeBlock();

    const section = createBlock(ctx);

    if (!section) return;

    target.before(section);

    block = section;
    mountedSignature = ctx.signature;
  }

  function scheduleMount() {
    if (scheduled) return;

    scheduled = true;
    window.requestAnimationFrame(mount);
  }

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(scheduleMount);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener('pageshow', scheduleMount);
  window.addEventListener('popstate', scheduleMount);

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount();
        startObserver();
      },
      { once: true }
    );
  } else {
    mount();
    startObserver();
  }
})();
