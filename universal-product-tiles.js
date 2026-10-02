(function () {
  'use strict';

  const links = document.querySelectorAll(
    '.flex-universal-parts .products > .flex-sub-categories > a'
  );

  links.forEach(function (link) {
    const url = new URL(link.href, location.origin);
    const path = url.searchParams.get('path');

    if (!path) return;

    const categoryId = path.split('~').pop();

    if (!/^\d+$/.test(categoryId)) return;

    const img = document.createElement('img');

    img.className = 'autolenc-subcategory-image';
    img.src = '/Image.ashx?type=5&id=' + categoryId;
    img.alt = '';
    img.loading = 'lazy';

    img.onerror = function () {
      img.remove();
    };

    link.prepend(img);
  });
})();
