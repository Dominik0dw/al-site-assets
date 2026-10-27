(function () {
  'use strict';
  const memory = new Map();
  const text = (root, selector) => (root.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const safe = (s, origin, image) => { if(!s)return ''; try { const u = new URL(s, origin); return u.protocol === 'https:' && (image || u.origin === origin) ? u.href : ''; } catch (_) { return ''; } };
  function query(filters) {
    const groups = new Map();
    for (const [key, values] of Object.entries(filters)) {
      if (!values.length) continue;
      const [group, attribute] = key.split('|');
      if (!group || !attribute) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(attribute + ';' + values.join(';'));
    }
    return [...groups].map(([group, attrs]) => group + '|' + attrs.join('|')).join('~');
  }
  function parseFilters(doc, state) {
    const facets = [];
    const brands = [...doc.querySelectorAll('[data-products-manufacturers-filter-item]')].map(input => {
      const label = input.closest('label'); const name = text(label, '.label span') || label?.getAttribute('title') || input.value;
      const count = Number((input.dataset.flexToogleText || '').match(/\((\d+)\)\s*$/)?.[1]);
      return { value: input.value, name, count: Number.isFinite(count) ? count : null };
    });
    if (brands.length > 1 || state.brands.length) facets.push({ key:'brand', name:'Výrobce', values:brands });
    doc.querySelectorAll('[data-attribute]').forEach(attribute => {
      const title = attribute.querySelector('[data-title]'); if (!title) return;
      const group = title.dataset.flexGenericArticleKey, key = title.dataset.flexAttributeKey;if(!group||!key)return;
      const values = [...attribute.querySelectorAll('input[data-products-parameters-filter-item]')].map(input => ({ value:input.dataset.flexAttributeValue, name:input.value, count:Number(input.dataset.flexParamsCount) }));
      const slider = attribute.querySelector('[data-flex-values]');
      if (!values.length && slider) String(slider.dataset.flexValues).split(';').filter(Boolean).forEach(value => values.push({value, name:value, count:null}));
      const usable = values.filter(v => v.name && v.value != null && (v.count !== 0 || state.attrs[group+'|'+key]?.includes(v.value)));
      if (usable.length > 1 || state.attrs[group+'|'+key]?.length) facets.push({ key:group+'|'+key, name:title.textContent.trim().replace(/^\d+\.\s*/, ''), values:usable });
    });
    return facets;
  }
  function parseProducts(doc, config) {
    return [...doc.querySelectorAll('.flex-item[data-flex-group-id]')].map(root => {
      const a = root.querySelector('.flex-header-container h2 a[href]'); if (!a) return null;
      const img = root.querySelector('.flex-image-wrapper img');
      const p = { id:root.dataset.flexGroupId, code:text(root,'.manufacturer-code .code'), brand:text(root,'.manufacturer-code .manufacturer'), name:text(root,'.flex-header-container .name'), url:safe(a.getAttribute('href'),config.shop_origin), image:img ? safe(img.getAttribute('data-flex-async-image-src') || img.getAttribute('src'),config.shop_origin,true) : '' };
      if (!/^\d+$/.test(p.id) || !p.url || !p.code) return null;
      p.description = text(root,'.productDescriptionContainer').slice(0,500);
      p.parameters = [...root.querySelectorAll('.flex-attributes tr')].map(row => [...row.querySelectorAll('td')].map(c => c.textContent.trim())).filter(c => c.length === 2 && c[0] && c[1]).slice(0, 6);
      try { p.live = window.AutoLencOilLive.extract(doc,p,root); } catch (_) { p.live = null; }
      return p;
    }).filter(Boolean);
  }
  function mount(target, node, options) {
    const {config,icon,navigate,readState} = options;
    const state = readState(); const controller = new AbortController(); let disposed = false;
    const $ = s => target.querySelector(s);
    const source = safe(node.url,config.shop_origin);
    target.innerHTML = `<div class="au-products-layout"><aside class="au-filters"><div class="au-filter-top"><strong>Filtrovat produkty</strong><button type="button" data-clear>Vymazat</button></div><div class="au-live-facets"><p class="au-muted">Načítáme filtry…</p></div></aside><div class="au-results"><div class="au-toolbar"><span class="au-count" aria-live="polite">Načítáme nabídku…</span><label class="au-stock-check"><input type="checkbox" data-stock ${state.stock?'checked':''}> Pouze skladem</label><select class="au-sort" aria-label="Řazení produktů"><option value="4">Skladem první</option><option value="6">Nejlevnější</option><option value="7">Nejdražší</option><option value="3">Podle názvu</option></select></div><button type="button" class="au-toggle-filters" aria-expanded="false">Filtry produktů</button><div class="au-selected"></div><div class="au-product-status" role="status"></div><div class="au-product-list" aria-busy="true">${Array.from({length:3},()=>'<div class="au-product-skeleton"><i></i><div><b></b><b></b><b></b></div><div><b></b><b></b></div></div>').join('')}</div><nav class="au-pages" aria-label="Stránkování produktů"></nav><p class="au-source-link"><a href="${esc(source)}">Otevřít kategorii v původním katalogu →</a></p></div></div>`;
    $('.au-sort').value=state.sort;
    const change = () => { state.page=1; navigate(state); };
    $('[data-stock]').onchange=e=>{state.stock=e.target.checked;change();};
    $('.au-sort').onchange=e=>{state.sort=e.target.value;change();};
    $('[data-clear]').onclick=()=>{state.attrs={};state.brands=[];state.stock=false;change();};
    $('.au-toggle-filters').onclick=e=>{const open=target.classList.toggle('au-filters-open');e.currentTarget.setAttribute('aria-expanded',String(open));};
    if (location.origin !== config.shop_origin) {
      $('.au-live-facets').innerHTML='';$('.au-count').textContent='Nabídka e-shopu';$('.au-toolbar').hidden=true;
      $('.au-product-list').setAttribute('aria-busy','false');
      $('.au-product-list').innerHTML=`<div class="au-empty">${icon('parts')}<h3>Prohlédnout produkty</h3><p>Ceny, dostupnost a košík jsou dostupné přímo na e-shopu Auto Lenc.</p><a class="au-primary" href="${esc(source)}">Zobrazit nabídku →</a></div>`;
      return {destroy(){disposed=true;controller.abort();}};
    }
    async function load() {
      const url = new URL(node.url); const pieces=url.pathname.split('/').filter(Boolean);
      const body = {sortBy:state.sort,onStockOnly:String(state.stock),purchasePricePriorized:'false',viewMode:'0',filteredManufacturers:state.brands,parametersFilterQuery:query(state.attrs),parametersFilterRangeQuery:'',categoryID:node.path.join('~'),fullCategoryIDs:node.path.join('~'),rootCategoryID:'-1',category:node.product_category||pieces[3]||'',itemsCount:String(config.page_size||20),areHiddenGroupsVisible:'false',loadAllItems:'false',page:String(state.page)};
      const key=JSON.stringify(body),cached=memory.get(key);let data;
      const timer=setTimeout(()=>controller.abort(),35000);
      try {
        if(cached && Date.now()-cached.at<(config.cache_seconds||120)*1000)data=cached.data;
        else {
          const response=await fetch(new URL('/LegacyEshop/AjaxWSLegacy/GetUniversalPartsProducts',config.shop_origin),{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json; charset=utf-8'},body:key});
          if(!response.ok)throw Error('Nabídku se nepodařilo načíst.');
          data=await response.json();if(typeof data==='string')data=JSON.parse(data);
          if(typeof data?.HTMLContent!=='string'||typeof data?.FilterHTMLContent!=='string')throw Error('Neplatná odpověď katalogu.');
          memory.set(key,{data,at:Date.now()});if(memory.size>20)memory.delete(memory.keys().next().value);
        }
        if(disposed)return;
        const doc=new DOMParser().parseFromString(data.HTMLContent,'text/html');
        const filters=new DOMParser().parseFromString(data.FilterHTMLContent,'text/html');
        const products=parseProducts(doc,config),facets=parseFilters(filters,state);
        const total=Number(text(filters,'.flex-product-count-value').replace(/\D/g,''));
        $('.au-count').textContent=total?`${total.toLocaleString('cs-CZ')} produktů · strana ${state.page}`:`${products.length} produktů · strana ${state.page}`;
        $('.au-product-status').textContent='Ceny bez DPH · dostupnost z e-shopu';
        $('.au-live-facets').innerHTML=facets.length?facets.map((f,i)=>`<details class="au-facet" ${i<2?'open':''}><summary>${esc(f.name)}</summary>${f.values.length>12?'<input class="au-filter-search" type="search" placeholder="Hledat hodnotu" aria-label="Hledat hodnotu filtru">':''}<div class="au-filter-values">${f.values.filter(v=>v.count!==0||(f.key==='brand'?state.brands:state.attrs[f.key]||[]).includes(v.value)).map(v=>`<label><input type="checkbox" data-key="${esc(f.key)}" value="${esc(v.value)}" ${(f.key==='brand'?state.brands:state.attrs[f.key]||[]).includes(v.value)?'checked':''}><span>${esc(v.name)}</span><small>${Number.isFinite(v.count)?v.count:''}</small></label>`).join('')}</div></details>`).join(''):'<p class="au-muted">Pro tuto kategorii nejsou další filtry k dispozici.</p>';
        target.querySelectorAll('[data-key]').forEach(input=>{input.onchange=()=>{const key=input.dataset.key,list=key==='brand'?state.brands:state.attrs[key]||=[];const index=list.indexOf(input.value);if(index<0)list.push(input.value);else list.splice(index,1);if(key!=='brand'&&!list.length)delete state.attrs[key];change();};});
        target.querySelectorAll('.au-filter-search').forEach(input=>{input.oninput=()=>{const q=input.value.toLocaleLowerCase('cs');input.closest('details').querySelectorAll('label').forEach(label=>label.hidden=!label.textContent.toLocaleLowerCase('cs').includes(q));};input.onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};});
        const selected=[];
        for(const [key,vals]of [['brand',state.brands],...Object.entries(state.attrs)])for(const value of vals){const f=facets.find(f=>f.key===key),v=f?.values.find(v=>v.value===value);selected.push(`<button type="button" data-remove-key="${esc(key)}" data-remove-value="${esc(value)}">${esc(v?.name||value)} ×</button>`);}
        $('.au-selected').innerHTML=selected.join('');
        target.querySelectorAll('[data-remove-key]').forEach(b=>b.onclick=()=>{const key=b.dataset.removeKey,v=b.dataset.removeValue;if(key==='brand')state.brands=state.brands.filter(x=>x!==v);else{state.attrs[key]=(state.attrs[key]||[]).filter(x=>x!==v);if(!state.attrs[key].length)delete state.attrs[key];}change();});
        $('.au-product-list').innerHTML=products.length?products.map(p=>row(p,icon)).join(''):`<div class="au-empty">${icon('search')}<h3>Žádné odpovídající produkty</h3><p>Zkuste zrušit filtry nebo vybrat jinou podkategorii.</p><button type="button" class="au-primary" data-empty-clear>Zrušit filtry</button></div>`;
        $('[data-empty-clear]')?.addEventListener('click',()=>$('[data-clear]').click());
        target.querySelectorAll('.au-product-image img').forEach(img=>{const hide=()=>{img.hidden=true;img.parentElement.classList.add('is-missing');};img.onerror=hide;img.onload=()=>{if(img.naturalWidth<12||img.naturalHeight<12)hide();};if(img.complete&&img.naturalWidth<12)hide();});
        products.forEach(p=>{
          const product=target.querySelector('#au-product-'+p.id),input=product?.querySelector('input[type=number]');if(!input)return;
          product.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{input.value=String(Number(Math.max(p.live.step,(Number(input.value)||p.live.step)+Number(b.dataset.step)*p.live.step).toFixed(6)));});
          product.querySelector('.au-cart-button').onclick=e=>{const status=product.querySelector('.au-cart-status');try{window.AutoLencOilLive.add(e.currentTarget,product,p.live,input.value);status.textContent='Požadavek předán košíku.';}catch(error){status.textContent=error.message;}};
        });
        $('.au-pages').innerHTML=`${state.page>1?'<button type="button" data-page="prev">← Předchozí</button>':''}<span>Strana ${state.page}</span>${data.IsLastPage===false?'<button type="button" data-page="next">Další produkty →</button>':''}`;
        target.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page+=b.dataset.page==='next'?1:-1;navigate(state);});
      }catch(error){if(disposed)return;$('.au-count').textContent='Nabídka není dostupná';$('.au-live-facets').innerHTML='';$('.au-product-status').textContent='';$('.au-product-list').innerHTML=`<div class="au-empty">${icon('refresh')}<h3>Nabídku se teď nepodařilo načíst.</h3><p>Zkuste načtení zopakovat nebo pokračujte v původním katalogu.</p><button type="button" class="au-primary" data-retry>Zkusit znovu</button><a href="${esc(source)}">Otevřít nabídku →</a></div>`;$('[data-retry]').onclick=()=>navigate(state,true);}
      finally{clearTimeout(timer);if(!disposed)$('.au-product-list').setAttribute('aria-busy','false');}
    }
    load();return {destroy(){disposed=true;controller.abort();}};
  }
  function row(p,icon){
    const live=p.live, image=p.image&&!/FlexBlank|no[-_]?image|placeholder/i.test(p.image);
    const buy=live?.args&&typeof window.addToBasket==='function';
    return `<article class="au-product ${live?.onStock?'is-stock':''}" id="au-product-${p.id}"><a class="au-product-image ${image?'':'is-missing'}" href="${esc(p.url)}" aria-label="${esc(p.name)}"><span role="img" aria-label="Fotografie není k dispozici">${icon('image')}</span>${image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" width="100" height="120" loading="lazy" decoding="async">`:''}</a><div class="au-product-info"><span class="au-brand">${esc(p.brand)}</span><h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3><p class="au-code">Obj. číslo: <strong>${esc(p.code)}</strong></p>${p.description?`<p class="au-description">${esc(p.description)}</p>`:''}${p.parameters.length?`<dl>${p.parameters.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:''}<a class="au-text-link" href="${esc(p.url)}">Detail a parametry →</a></div><div class="au-buy"><span class="au-stock ${live?.onStock?'is-stock':''}">${icon(live?.onStock?'check':'truck')}${esc(live?.stock||'Dostupnost na detailu')}</span>${live?.price?`<strong class="au-price">${esc(live.price)} <small>${esc(live.currency)}</small></strong><span class="au-tax">bez DPH</span>`:'<span class="au-tax">Cena na dotaz</span>'}${live?.delivery?`<small class="au-delivery">${esc(live.delivery)}</small>`:''}${live?.returnInfo?`<small class="au-return-note">${esc(live.returnInfo)}</small>`:''}${buy?`<div class="flex-add-to-basket au-cart" data-flex-product-id="${esc(live.productId)}" data-flex-group-id="${p.id}"><div class="flex-basket-spinner au-quantity" data-flex="true" data-flex-spinner-step="${live.step}" data-flex-spinner-invalid-amount-text="Zadejte množství v násobcích {0}."><button type="button" data-step="-1" aria-label="Snížit množství">−</button><input type="number" min="${live.step}" step="${live.step}" value="${live.step}" aria-label="Množství ${esc(p.code)}"><button type="button" data-step="1" aria-label="Zvýšit množství">+</button></div><button type="button" class="au-cart-button">${icon('cart')}Do košíku</button></div>`:`<a class="au-primary" href="${esc(p.url)}">Zobrazit produkt →</a>`}<span class="au-cart-status" aria-live="polite"></span></div></article>`;
  }
  window.AutoLencUniNative={mount,query,parseFilters,parseProducts};
})();
