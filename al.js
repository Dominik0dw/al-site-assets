(function () {
  'use strict';

  const pathname = location.pathname.replace(/\/+$/, '');

  const routeMatch = pathname.match(
    /^\/([a-z]{2})\/katalog\/tecdoc\/osobni\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/([1-9]\d*)\/([1-9]\d*)\/([1-9]\d*)$/i
  );

  if (!routeMatch) return;

  if (window.__autolencQuickPartsDirectStarted) return;
  window.__autolencQuickPartsDirectStarted = true;

  const language = routeMatch[1];
  const manufacturer = routeMatch[2];
  const model = routeMatch[3];
  const engine = routeMatch[4];

  const manufacturerId = routeMatch[5];
  const modelId = routeMatch[6];
  const engineId = routeMatch[7];

  const vehicleBase =
    '/' +
    [
      language,
      'katalog',
      'tecdoc',
      'osobni',
      manufacturer,
      model,
      engine
    ].join('/') +
    '/';

  const vehicleIdPath =
    [manufacturerId, modelId, engineId].join('/');

  const imageBase =
    'https://dominik0dw.github.io/al-site-assets/image-tec/';

  const parts = [
    {
      id: '101994',
      title: 'Motorový olej',
      slug: 'olej',
      path: ['100002', '100245', '101994'],
      image: 'olej.webp'
    },
    {
      id: '100259',
      title: 'Olejový filtr',
      slug: 'olejovy-filtr',
      path: ['100005', '100259'],
      image: 'olejfiltr.webp'
    },
    {
      id: '100263',
      title: 'Kabinový filtr',
      slug: 'kabinovy-vzduchovy-filtr',
      path: ['100005', '100263'],
      image: 'kabfiltr.webp'
    },
    {
      id: '100260',
      title: 'Vzduchový filtr',
      slug: 'vzduchovy-filtr',
      path: ['100005', '100260'],
      image: 'vzduchfiltr.webp'
    },
    {
      id: '100261',
      title: 'Palivový filtr',
      slug: 'palivovy-filtr',
      path: ['100005', '100261'],
      image: 'palfiltr.webp'
    },
    {
      id: '100042',
      title: 'Baterie',
      slug: 'baterie',
      path: ['100010', '100042'],
      image: 'baterie.webp'
    },
    {
      id: '100133',
      title: 'Stírací gumička',
      slug: 'stiraci-gumicka',
      path: ['100018', '100133'],
      image: 'sterac.webp'
    },
    {
      id: '100032',
      title: 'Brzdové kotouče',
      slug: 'brzdovy-kotouc',
      path: ['100006', '100626', '100032'],
      image: 'kotouc.webp'
    },
    {
      id: '100030',
      title: 'Brzdové destičky',
      slug: 'brzdove-oblozeni',
      path: ['100006', '100626', '100030'],
      image: 'desky.webp'
    },
    {
      id: '100121',
      title: 'Tlumiče',
      slug: 'tlumic-perovani',
      path: ['100011', '100121'],
      image: 'tlumic.webp'
    },
    {
      id: '100113',
      title: 'Pružiny',
      slug: 'pruzina-podvozku',
      path: ['100011', '100113'],
      image: 'pruzina.webp'
    },
    {
      id: '100579',
      title: 'Ložisko kola',
      slug: 'lozisko-kola',
      path: ['100013', '100206', '100579'],
      image: 'lozisko.webp'
    },

    {
      id: '100453',
      title: 'Rozvody',
      slug: 'sada-rozvodoveho-remene',
      path: ['100016', '100085', '100453'],
      image: 'rozvody.webp'
    },
    {
      id: '100051',
      title: 'Sada spojky',
      slug: 'sada-spojky',
      path: ['100050', '100051'],
      image: 'spojka.webp'
    },
    {
      id: '100571',
      title: 'Ramena',
      slug: 'pricne-rameno',
      path: ['100013', '100208', '100571'],
      image: 'ramena.webp'
    },
    {
      id: '100198',
      title: 'Čepy řízení',
      slug: 'klouby',
      path: ['100012', '100198'],
      image: 'cepy-rizeni.webp'
    }
  ];

  function getTarget() {
    const roots =
      document.querySelectorAll('.flex-tecdoc');

    if (roots.length !== 1) return null;

    const targets = Array.from(
      roots[0].querySelectorAll('.shortcuts-container')
    ).filter(
      element => element.querySelector('.shortcuts')
    );

    return targets.length === 1
      ? targets[0]
      : null;
  }

  function buildHref(part) {
    if (
      !/^[a-z0-9-]+$/.test(part.slug) ||
      !/^[1-9]\d*$/.test(part.id) ||
      !Array.isArray(part.path) ||
      part.path.length < 2 ||
      part.path[part.path.length - 1] !== part.id ||
      !part.path.every(
        value => /^[1-9]\d*$/.test(value)
      )
    ) {
      return null;
    }

    return (
      vehicleBase +
      part.slug +
      '/' +
      vehicleIdPath +
      '/' +
      part.id +
      '/?path=' +
      part.path.join('~')
    );
  }

  function createBlock() {
    const section =
      document.createElement('section');

    section.id = 'autolenc-quick-parts';

    section.setAttribute(
      'aria-labelledby',
      'autolenc-quick-parts-title'
    );

    const heading =
      document.createElement('h2');

    heading.id =
      'autolenc-quick-parts-title';

    heading.className =
      'autolenc-heading';

    heading.textContent =
      'Nejčastěji hledané díly';

    const grid =
      document.createElement('div');

    grid.className =
      'autolenc-grid';

    for (const part of parts) {
      const href = buildHref(part);

      if (!href) continue;

      const link =
        document.createElement('a');

      link.className =
        'autolenc-tile';

      link.href = href;

      link.setAttribute(
        'data-autolenc-node-id',
        part.id
      );

      const image =
        document.createElement('img');

      image.className =
        'autolenc-image';

      image.src =
        imageBase + part.image;

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

      const label =
        document.createElement('span');

      label.className =
        'autolenc-label';

      label.textContent =
        part.title;

      link.append(
        image,
        label
      );

      grid.appendChild(link);
    }

    if (!grid.children.length) {
      return null;
    }

    section.append(
      heading,
      grid
    );

    return section;
  }

  function mount() {
    if (
      document.getElementById(
        'autolenc-quick-parts'
      )
    ) {
      return true;
    }

    const target =
      getTarget();

    if (!target) {
      return false;
    }

    const block =
      createBlock();

    if (!block) {
      return false;
    }

    target.before(block);

    return true;
  }

  function start() {
    if (mount()) {
      return;
    }

    const observer =
      new MutationObserver(() => {
        if (mount()) {
          observer.disconnect();
        }
      });

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );

    window.setTimeout(
      () => observer.disconnect(),
      5000
    );
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );
  } else {
    start();
  }

  window.addEventListener(
    'pageshow',
    mount
  );
})();
