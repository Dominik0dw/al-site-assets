(function () {
  'use strict';
  const memory = new Map();
  const text = (root, selector) => (root.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const safe = (s, origin, image) => { if(!s)return ''; try { const u = new URL(s, origin); return u.protocol === 'https:' && (image || u.origin === origin) ? u.href : ''; } catch (_) { return ''; } };
  function query(filters, types = []) {
    const groups = new Map(types.map(type => [type, []]));
    for (const [key, values] of Object.entries(filters)) {
      if (!values.length) continue;
      const [group, attribute] = key.split('|');
      if (!group || !attribute) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(attribute + ';' + values.join(';'));
    }
    return [...groups].map(([group, attrs]) => group + (attrs.length ? '|' + attrs.join('|') : '')).join('~');
  }
  function parseFilters(doc, state) {
    const facets = [], total = Number(text(doc,'.flex-product-count-value').replace(/\D/g,''));
    const number = value => value == null || value === '' ? null : Number(value);
    const useful = (values, selected) => selected?.length || values.length > 1 || (values.length === 1 && (!total || values[0].count !== total));
    const brands = [...doc.querySelectorAll('[data-products-manufacturers-filter-item],.flex-manufacturers input[type="checkbox"]')].map(input => {
      const label = input.closest('label'); const name = text(label, '.label span') || label?.getAttribute('title') || input.value;
      const count = number((input.dataset.flexToogleText || '').match(/\(([\d\s]+)\)\s*$/)?.[1]?.replace(/\s/g,''));
      return { value: input.value, name, count: Number.isFinite(count) ? count : null };
    }).filter(v=>v.count!==0||state.brands.includes(v.value));
    if (useful(brands,state.brands)) facets.push({ key:'brand', name:'Výrobce', values:brands });
    const types=[...doc.querySelectorAll('[data-generic-article-checkbox],input.flex-generic-article')].map(input=>({value:input.dataset.flexGenericArticleKey,name:input.value||text(input.closest('label'),'.label'),count:null})).filter(v=>v.value&&v.name);
    if(types.length>1||state.groups?.length)facets.push({key:'type',name:'Typ produktu',values:types});
    doc.querySelectorAll('[data-attribute],.flex-attributes>.flex-attribute').forEach(attribute => {
      const title = attribute.querySelector('[data-title],.flex-title'); if (!title) return;
      const group = title.dataset.flexGenericArticleKey, key = title.dataset.flexAttributeKey;if(!group||!key)return;
      if(state.groups?.length&&!state.groups.includes(group))return;
      const values = [...attribute.querySelectorAll('input[data-flex-attribute-value]')].map(input => ({ value:input.dataset.flexAttributeValue, name:input.value, count:number(input.dataset.flexParamsCount) }));
      const slider = attribute.querySelector('[data-flex-values]');
      if (!values.length && slider) {
        const names=String(slider.dataset.flexDisplayValues||slider.dataset.flexValues).split(';'),units=String(slider.dataset.flexDisplayUnits||'').split(';');
        String(slider.dataset.flexValues).replace('.',',').split(';').filter(Boolean).forEach((value,i)=>values.push({value,name:((names[i]||value)+' '+(units[i]||'')).trim(),number:Number(value.replace(',','.')),count:null}));
      }
      const usable = values.filter(v => v.name && v.value != null && (v.count !== 0 || state.attrs[group+'|'+key]?.includes(v.value)));
      if (useful(usable,state.attrs[group+'|'+key])) facets.push({ key:group+'|'+key, group, groupName:types.find(t=>t.value===group)?.name||'', name:title.textContent.trim().replace(/^\d+\.\s*/, '').replace(/\s+/g,' '), values:usable, range:!!slider&&usable.length>1&&usable.every(v=>Number.isFinite(v.number)) });
    });
    const rank=f=>f.key==='type'?-2:f.key==='brand'?-1:/kapacita|startovací|objem|viskozita|napětí|polarita|roční|typ|technologie/i.test(f.name)?0:1;
    return facets.sort((a,b)=>rank(a)-rank(b));
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
    const {config,icon,navigate,readState} = options, $ = s => target.querySelector(s);
    let state=readState(),controller,disposed=false,generation=0,facets=[],lastPage=state.page,signature='';
    const labels=new Map(),quantities=new Map(),rangeValues=new Map();
    const source=safe(node.url,config.shop_origin),onShop=location.origin===config.shop_origin;
    const selected=key=>key==='brand'?state.brands:key==='type'?state.groups:state.attrs[key]||[];
    const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    target.classList.remove('au-filters-open');
    target.innerHTML=`<div class="au-products-layout"><aside class="au-filters"><div class="au-filter-top"><strong>Filtrovat produkty</strong><button type="button" data-clear>Vymazat</button></div><label class="au-find-filter"><input type="search" placeholder="Najít filtr nebo hodnotu…" aria-label="Hledat ve filtrech"></label><div class="au-live-facets"><p class="au-muted">Načítáme filtry…</p></div><button type="button" class="au-apply-mobile">Zobrazit produkty</button></aside><div class="au-results"><div class="au-toolbar"><span class="au-count" aria-live="polite">Načítáme nabídku…</span><label class="au-stock-check"><input type="checkbox" data-stock> Pouze skladem</label><select class="au-sort" aria-label="Řazení produktů"><option value="4">Skladem první</option><option value="5">Dostupnost a cena</option><option value="6">Nejlevnější</option><option value="7">Nejdražší</option><option value="3">Podle názvu</option><option value="1">Podle kódu</option><option value="2">Podle výrobce</option></select></div><button type="button" class="au-toggle-filters" aria-expanded="false">Filtry produktů</button><div class="au-selected" aria-label="Použité filtry"></div><div class="au-product-status" role="status"></div><div class="au-product-list" aria-busy="true">${Array.from({length:3},()=>'<div class="au-product-skeleton"><i></i><div><b></b><b></b><b></b></div><div><b></b><b></b></div></div>').join('')}</div><nav class="au-pages" aria-label="Stránkování produktů"></nav><p class="au-source-link"><a href="${esc(source)}">Otevřít kategorii v původním katalogu →</a></p></div></div>`;
    const change=()=>{state.page=1;navigate(state);};
    $('[data-stock]').onchange=e=>{state.stock=e.target.checked;change();};
    $('.au-sort').onchange=e=>{state.sort=e.target.value;change();};
    $('[data-clear]').onclick=()=>{state.attrs={};state.ranges={};state.groups=[];state.brands=[];state.stock=false;$('.au-find-filter input').value='';change();};
    const mobile=open=>{target.classList.toggle('au-filters-open',open);$('.au-toggle-filters').setAttribute('aria-expanded',String(open));if(open)$('.au-find-filter input').focus();};
    $('.au-toggle-filters').onclick=()=>mobile(!target.classList.contains('au-filters-open'));
    $('.au-apply-mobile').onclick=()=>{mobile(false);$('.au-toggle-filters').focus();$('.au-toolbar').scrollIntoView?.({block:'start'});};
    $('.au-find-filter input').oninput=searchFacets;
    $('.au-find-filter input').onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};
    function searchFacets(){
      const q=fold($('.au-find-filter input').value);
      target.querySelectorAll('.au-facet').forEach(detail=>{
        const match=!q||fold(detail.textContent).includes(q);detail.hidden=!match;
        if(q&&detail.dataset.beforeSearch==null)detail.dataset.beforeSearch=detail.hasAttribute('open')?'1':'0';
        if(q&&match)detail.setAttribute('open','');
        if(!q&&detail.dataset.beforeSearch!=null){detail.toggleAttribute('open',detail.dataset.beforeSearch==='1');delete detail.dataset.beforeSearch;}
      });
      $('.au-filter-no-match').hidden=!q||[...target.querySelectorAll('.au-facet')].some(d=>!d.hidden);
    }
    function restrictGroup(group){
      state.groups=[group];
      for(const key of Object.keys(state.attrs))if(key.split('|')[0]!==group){delete state.attrs[key];delete state.ranges[key];}
    }
    function renderFacets(){
      const old=new Map([...target.querySelectorAll('.au-facet')].map(d=>[d.dataset.facet,{open:d.hasAttribute('open'),q:d.querySelector('.au-filter-search')?.value||'',scroll:d.querySelector('.au-filter-values')?.scrollTop||0,before:d.dataset.beforeSearch}]));
      const active=document.activeElement,activeFacet=active?.closest?.('.au-facet')?.dataset.facet;
      const focus=activeFacet?{key:activeFacet,value:active.value,kind:active.classList.contains('au-filter-search')?'search':active.dataset.key?'value':active.dataset.bound?'range':'summary',bound:active.dataset.bound}:null;
      for(const f of facets){labels.set(f.key+'|name',f.name);for(const v of f.values)labels.set(f.key+'|'+v.value,v.name);if(f.range)rangeValues.set(f.key,f.values);}
      $('.au-live-facets').innerHTML=facets.map((f,i)=>{
        const open=old.has(f.key)?old.get(f.key).open:i<3||selected(f.key).length;
        const title=`${esc(f.name)}${selected(f.key).length?'<i class="au-facet-selected" aria-label="Filtr je aktivní"></i>':''}`;
        let body;
        if(f.range){
          const values=rangeValues.get(f.key),min=Math.min(...values.map(v=>v.number)),max=Math.max(...values.map(v=>v.number)),range=state.ranges[f.key]||[min,max];
          body=`<div class="au-range"><div><label>Od<input type="text" inputmode="decimal" data-bound="min" value="${range[0]}" aria-label="${esc(f.name)} od"></label><label>Do<input type="text" inputmode="decimal" data-bound="max" value="${range[1]}" aria-label="${esc(f.name)} do"></label></div><small>${min.toLocaleString('cs-CZ')} – ${max.toLocaleString('cs-CZ')}</small><button type="button" data-range-apply="${esc(f.key)}">Použít rozsah</button><span class="au-range-error" role="status"></span></div>`;
        }else{
          const all=f.key==='type'?`<label><input type="radio" name="au-product-type" data-key="type" value="" ${!state.groups.length?'checked':''}><span>Všechny typy</span></label>`:'';
          body=(f.values.length>12?'<input class="au-filter-search" type="search" placeholder="Hledat hodnotu" aria-label="Hledat hodnotu filtru">':'')+`<div class="au-filter-values">${all}${f.values.map(v=>`<label><input type="${f.key==='type'?'radio':'checkbox'}" ${f.key==='type'?'name="au-product-type"':''} data-key="${esc(f.key)}" value="${esc(v.value)}" ${selected(f.key).includes(v.value)?'checked':''}><span>${esc(v.name)}</span><small>${Number.isFinite(v.count)?v.count:''}</small></label>`).join('')}</div>`;
        }
        return `<details class="au-facet" data-facet="${esc(f.key)}" ${open?'open':''}><summary>${title}</summary>${f.groupName&&facets.find(x=>x.key==='type')&&!state.groups.length?`<small class="au-facet-group">${esc(f.groupName)}</small>`:''}${body}</details>`;
      }).join('')+(facets.length?'':'<p class="au-muted">Pro tuto nabídku nejsou další parametry k dispozici.</p>')+'<p class="au-muted au-filter-no-match" hidden>Žádný odpovídající filtr.</p>';
      target.querySelectorAll('[data-key]').forEach(input=>input.onchange=()=>{
        const key=input.dataset.key;
        if(key==='type'){state.groups=input.value?[input.value]:[];state.attrs={};state.ranges={};}
        else{if(key!=='brand')restrictGroup(key.split('|')[0]);const list=key==='brand'?state.brands:state.attrs[key]||=[];const index=list.indexOf(input.value);if(input.checked&&index<0)list.push(input.value);else if(!input.checked&&index>=0)list.splice(index,1);if(key!=='brand'&&!list.length)delete state.attrs[key];}
        change();
      });
      target.querySelectorAll('[data-range-apply]').forEach(button=>button.onclick=()=>{
        const key=button.dataset.rangeApply,root=button.closest('.au-range'),inputs=[...root.querySelectorAll('input')],values=rangeValues.get(key);
        const bounds=inputs.map(input=>input.value.trim()===''?NaN:Number(input.value.trim().replace(',','.')));
        const available=values.filter(v=>v.number>=bounds[0]&&v.number<=bounds[1]).map(v=>v.value);
        if(bounds.some(v=>!Number.isFinite(v))||bounds[0]>bounds[1]||!available.length){root.querySelector('.au-range-error').textContent='Zadejte platný rozsah s dostupnými hodnotami.';return;}
        restrictGroup(key.split('|')[0]);state.attrs[key]=available;state.ranges[key]=bounds;change();
      });
      target.querySelectorAll('.au-range input').forEach(input=>input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.closest('.au-range').querySelector('button').click();}});
      target.querySelectorAll('.au-filter-search').forEach(input=>{
        input.oninput=()=>{const q=fold(input.value);input.closest('details').querySelectorAll('.au-filter-values label').forEach(label=>label.hidden=!fold(label.textContent).includes(q));};
        input.onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};input.value=old.get(input.closest('details').dataset.facet)?.q||'';input.oninput();
      });
      target.querySelectorAll('.au-facet').forEach(d=>{const previous=old.get(d.dataset.facet);if(previous?.before!=null)d.dataset.beforeSearch=previous.before;const values=d.querySelector('.au-filter-values');if(values)values.scrollTop=previous?.scroll||0;});
      searchFacets();
      if(focus){const detail=[...target.querySelectorAll('.au-facet')].find(d=>d.dataset.facet===focus.key);const el=focus.kind==='search'?detail?.querySelector('.au-filter-search'):focus.kind==='range'?detail?.querySelector(`[data-bound="${focus.bound}"]`):focus.kind==='value'?[...detail?.querySelectorAll('[data-key]')||[]].find(i=>i.value===focus.value):detail?.querySelector('summary');(el||detail?.querySelector('summary'))?.focus({preventScroll:true});}
      renderChips();
    }
    function renderChips(){
      const chips=[];
      const chip=(key,value,label)=>`<button type="button" data-remove-key="${esc(key)}" data-remove-value="${esc(value)}" aria-label="Odebrat filtr ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`;
      if(state.stock)chips.push(chip('stock','','Pouze skladem'));
      for(const [key,values]of [['brand',state.brands],['type',state.groups],...Object.entries(state.attrs)]){
        if(state.ranges[key]){chips.push(chip(key,'',`${labels.get(key+'|name')||key.split('|')[1]}: ${state.ranges[key].map(n=>n.toLocaleString('cs-CZ')).join(' – ')}`));continue;}
        for(const value of values)chips.push(chip(key,value,labels.get(key+'|'+value)||value));
      }
      $('.au-selected').innerHTML=chips.join('');$('[data-clear]').hidden=!chips.length;
      $('.au-toggle-filters').textContent='Filtry produktů'+(chips.length?' ('+chips.length+')':'');
      target.querySelectorAll('[data-remove-key]').forEach(b=>b.onclick=()=>{
        const key=b.dataset.removeKey,v=b.dataset.removeValue;
        if(key==='stock')state.stock=false;
        else if(key==='brand')state.brands=state.brands.filter(x=>x!==v);
        else if(key==='type'){state.groups=[];state.attrs={};state.ranges={};}
        else if(state.ranges[key]){delete state.ranges[key];delete state.attrs[key];}
        else{state.attrs[key]=(state.attrs[key]||[]).filter(x=>x!==v);if(!state.attrs[key].length)delete state.attrs[key];}
        change();
      });
    }
    async function load(bypass=false){
      controller?.abort();controller=new AbortController();const activeController=controller,signal=controller.signal,token=++generation;
      state=readState();state.groups||=[];state.ranges||={};
      $('.au-sort').value=state.sort;$('[data-stock]').checked=state.stock;
      $('.au-count').textContent='Načítáme nabídku…';$('.au-product-list').setAttribute('aria-busy','true');$('.au-product-list').inert=true;$('.au-pages').inert=true;renderChips();
      if(!onShop){$('.au-filters').hidden=true;$('.au-toolbar').hidden=true;$('.au-toggle-filters').hidden=true;$('.au-product-list').inert=false;$('.au-product-list').setAttribute('aria-busy','false');$('.au-product-list').innerHTML=`<div class="au-empty">${icon('parts')}<h3>Prohlédnout produkty</h3><p>Ceny, dostupnost a košík jsou dostupné přímo na e-shopu Auto Lenc.</p><a class="au-primary" href="${esc(source)}">Zobrazit nabídku →</a></div>`;return;}
      const pieces=new URL(node.url).pathname.split('/').filter(Boolean);
      const body={sortBy:state.sort,onStockOnly:String(state.stock),purchasePricePriorized:'false',viewMode:'0',filteredManufacturers:state.brands,parametersFilterQuery:query(state.attrs,state.groups),parametersFilterRangeQuery:query(state.ranges),categoryID:node.path.join('~'),fullCategoryIDs:node.path.join('~'),rootCategoryID:'-1',category:node.product_category||pieces[3]||'',itemsCount:String(config.page_size||20),areHiddenGroupsVisible:'false',loadAllItems:'false',page:String(state.page)};
      const key=JSON.stringify(body),cached=memory.get(key);signature=JSON.stringify(state);let data;
      const timer=setTimeout(()=>activeController.abort(),25000);
      try{
        if(!bypass&&cached&&Date.now()-cached.at<(config.cache_seconds||120)*1000)data=cached.data;
        else{const response=await fetch(new URL('/LegacyEshop/AjaxWSLegacy/GetUniversalPartsProducts',config.shop_origin),{method:'POST',credentials:'same-origin',signal,headers:{'Content-Type':'application/json; charset=utf-8'},body:key});
          if(!response.ok)throw Error('Nabídku se nepodařilo načíst.');data=await response.json();if(typeof data==='string')data=JSON.parse(data);
          if(typeof data?.HTMLContent!=='string'||typeof data?.FilterHTMLContent!=='string')throw Error('Neplatná odpověď katalogu.');
          if(disposed||token!==generation)return;memory.set(key,{data,at:Date.now()});if(memory.size>20)memory.delete(memory.keys().next().value);
        }
        if(disposed||token!==generation)return;
        const doc=new DOMParser().parseFromString(data.HTMLContent,'text/html'),filters=new DOMParser().parseFromString(data.FilterHTMLContent,'text/html');
        const products=parseProducts(doc,config);facets=parseFilters(filters,state);
        const count=text(filters,'.flex-product-count-value'),total=Number(count.replace(/\D/g,''));
        $('.au-count').textContent=`${(count?total:products.length).toLocaleString('cs-CZ')} produktů · strana ${state.page}`;
        $('.au-product-status').textContent='Ceny bez DPH · dostupnost z e-shopu';renderFacets();
        $('.au-product-list').innerHTML=products.length?products.map(p=>row(p,icon)).join(''):`<div class="au-empty">${icon('search')}<h3>Žádné odpovídající produkty</h3><p>${state.page>1?'Vraťte se na první stranu nebo upravte filtry.':'Upravte filtry nebo vyberte podkategorii nad nabídkou.'}</p>${state.page>1?'<button type="button" class="au-primary" data-first-page>První strana</button>':'<button type="button" class="au-primary" data-empty-clear>Zrušit filtry</button>'}</div>`;
        $('[data-empty-clear]')?.addEventListener('click',()=>$('[data-clear]').click());$('[data-first-page]')?.addEventListener('click',()=>{state.page=1;navigate(state);});
        target.querySelectorAll('.au-product-image img').forEach(img=>{const hide=()=>{img.hidden=true;img.parentElement.classList.add('is-missing');};img.onerror=hide;img.onload=()=>{if(img.naturalWidth<12||img.naturalHeight<12)hide();};if(img.complete&&img.naturalWidth<12)hide();});
        products.forEach(p=>{
          const product=target.querySelector('#au-product-'+p.id),input=product?.querySelector('input[type=number]');if(!input)return;
          const qtyKey=p.id+'|'+p.live.productId;input.value=quantities.get(qtyKey)||String(p.live.step);input.oninput=()=>quantities.set(qtyKey,input.value);
          product.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{input.value=String(Number(Math.max(p.live.step,(Number(input.value)||p.live.step)+Number(b.dataset.step)*p.live.step).toFixed(6)));quantities.set(qtyKey,input.value);});
          product.querySelector('.au-cart-button').onclick=e=>{const status=product.querySelector('.au-cart-status');try{window.AutoLencOilLive.add(e.currentTarget,product,p.live,input.value);status.textContent='Požadavek předán košíku.';}catch(error){status.textContent=error.message;}};
        });
        $('.au-pages').innerHTML=`${state.page>1?'<button type="button" data-page="prev">← Předchozí</button>':''}<span>Strana ${state.page}</span>${data.IsLastPage===false?'<button type="button" data-page="next">Další produkty →</button>':''}`;
        target.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page+=b.dataset.page==='next'?1:-1;navigate(state);});
        if(lastPage!==state.page)$('.au-toolbar').scrollIntoView?.({block:'start'});lastPage=state.page;
      }catch(error){if(disposed||token!==generation)return;$('.au-count').textContent='Nabídka není dostupná';$('.au-product-status').textContent='';$('.au-pages').innerHTML='';$('.au-product-list').innerHTML=`<div class="au-empty">${icon('refresh')}<h3>Nabídku se teď nepodařilo načíst.</h3><p>Zkuste načtení zopakovat nebo pokračujte v původním katalogu.</p><button type="button" class="au-primary" data-retry>Zkusit znovu</button><a href="${esc(source)}">Otevřít nabídku →</a></div>`;$('[data-retry]').onclick=()=>load(true);if(!facets.length)$('.au-live-facets').innerHTML='<p class="au-muted">Filtry se načtou spolu s produkty.</p>';}
      finally{clearTimeout(timer);if(!disposed&&token===generation){$('.au-product-list').setAttribute('aria-busy','false');$('.au-product-list').inert=false;$('.au-pages').inert=false;}}
    }
    load();return {update(force){const same=signature===JSON.stringify(readState());if(!same||force)load(same&&force);},destroy(){disposed=true;generation++;controller?.abort();}};
  }
  function row(p,icon){
    const live=p.live, image=p.image&&!/FlexBlank|no[-_]?image|placeholder/i.test(p.image);
    const buy=live?.args&&typeof window.addToBasket==='function';
    return `<article class="au-product ${live?.onStock?'is-stock':''}" id="au-product-${p.id}"><a class="au-product-image ${image?'':'is-missing'}" href="${esc(p.url)}" aria-label="${esc(p.name)}"><span role="img" aria-label="Fotografie není k dispozici">${icon('image')}</span>${image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" width="100" height="120" loading="lazy" decoding="async">`:''}</a><div class="au-product-info"><span class="au-brand">${esc(p.brand)}</span><h3><a href="${esc(p.url)}">${esc(p.name)}</a></h3><p class="au-code">Obj. číslo: <strong>${esc(p.code)}</strong></p>${p.description?`<p class="au-description">${esc(p.description)}</p>`:''}${p.parameters.length?`<dl>${p.parameters.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:''}<a class="au-text-link" href="${esc(p.url)}">Detail a parametry →</a></div><div class="au-buy"><span class="au-stock ${live?.onStock?'is-stock':''}">${icon(live?.onStock?'check':'truck')}${esc(live?.stock||'Dostupnost na detailu')}</span>${live?.price?`<strong class="au-price">${esc(live.price)} <small>${esc(live.currency)}</small></strong><span class="au-tax">bez DPH</span>`:'<span class="au-tax">Cena na dotaz</span>'}${live?.delivery?`<small class="au-delivery">${esc(live.delivery)}</small>`:''}${live?.returnInfo?`<small class="au-return-note">${esc(live.returnInfo)}</small>`:''}${buy?`<div class="flex-add-to-basket au-cart" data-flex-product-id="${esc(live.productId)}" data-flex-group-id="${p.id}"><div class="flex-basket-spinner au-quantity" data-flex="true" data-flex-spinner-step="${live.step}" data-flex-spinner-invalid-amount-text="Zadejte množství v násobcích {0}."><button type="button" data-step="-1" aria-label="Snížit množství">−</button><input type="number" min="${live.step}" step="${live.step}" value="${live.step}" aria-label="Množství ${esc(p.code)}"><button type="button" data-step="1" aria-label="Zvýšit množství">+</button></div><button type="button" class="au-cart-button">${icon('cart')}Do košíku</button></div>`:`<a class="au-primary" href="${esc(p.url)}">Zobrazit produkt →</a>`}<span class="au-cart-status" aria-live="polite"></span></div></article>`;
  }
  window.AutoLencUniNative={mount,query,parseFilters,parseProducts};
})();
