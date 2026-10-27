(function () {
  'use strict';
  const script=document.currentScript,mount=document.getElementById('al-uni-mount');
  if(!mount||mount.dataset.loaded)return;mount.dataset.loaded='true';
  const base=new URL('.',script.src),version=new URL(script.src).searchParams.get('v')||'4';
  const asset=path=>{const url=new URL(path,base);url.searchParams.set('v',version);return url.href;};
  const css=document.createElement('link');css.rel='stylesheet';css.href=asset('uni.css');document.head.append(css);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const icons={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    oil:'<path d="M8 3h7v4l4 3v11H5V7h3zM8 7h7M8 12h7v5H8zM10 3v4"/>',
    drop:'<path d="M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12zM8 16a4 4 0 0 0 4 3"/>',
    battery:'<path d="M3 7h18v13H3zM6 4h3v3M15 4h3v3M6 13h4M8 11v4M15 13h3"/>',
    spray:'<path d="M8 9h8v12H8zM10 6h4v3M10 3h6v3h-6zM18 3h3M19 6l2 1M11 13h2"/>',
    shine:'<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM21 2v4M19 4h4"/>',
    paint:'<path d="M4 3h14v6H4zM18 5h3v8H11v3M9 16h4v6H9z"/>',
    car:'<path d="m3 11 3-7h12l3 7v8H3zM3 11h18M6 15h3M15 15h3M5 19v2M19 19v2"/>',
    bulb:'<path d="M8 15a7 7 0 1 1 8 0v3H8zM9 21h6M10 18v-7l4 3v4"/>',
    tools:'<path d="m14 3 1 5 5 1a6 6 0 0 1-7 7l-7 6-4-4 7-7a6 6 0 0 1 5-8z"/>',
    wheel:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1"/><path d="m12 6 0 4M6 12h4M12 14v4M14 12h4"/>',
    parts:'<path d="m9 3-1 3-3 1-2 4 2 2v3l3 3 3-1 3 1 3-3v-3l2-2-2-4-3-1-1-3z"/><circle cx="11" cy="11" r="3"/>',
    tent:'<path d="m12 3 10 18H2zM7 21l5-10 5 10M10 3l2 4 2-4"/>',
    tag:'<path d="M3 3h9l10 10-9 9L3 12z"/><circle cx="8" cy="8" r="1.5"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 6-6 5 5 3-3 4 4M3 3l18 18"/><circle cx="15" cy="8" r="1"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    truck:'<path d="M2 5h12v12H2zM14 10h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    cart:'<path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    refresh:'<path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>'
  };
  const icon=name=>`<svg class="au-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.parts}</svg>`;
  const json=async path=>{const r=await fetch(asset(path),{credentials:'omit'});if(!r.ok)throw Error('Katalog není dostupný.');return r.json();};
  const scripts=new Map();
  function loadScript(path){if(scripts.has(path))return scripts.get(path);const promise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=asset(path);s.onload=resolve;s.onerror=()=>{scripts.delete(path);s.remove();reject(Error('Soubor katalogu není dostupný.'));};document.head.append(s);});scripts.set(path,promise);return promise;}
  mount.innerHTML='<div id="al-uni"><div class="au-loading" role="status">Načítáme katalog univerzálních dílů…</div></div>';
  const app=mount.firstElementChild;
  Promise.all([json('config.json'),json('../../catalog/uni/tree.json')]).then(start).catch(()=>{app.innerHTML=`<div class="au-empty"><h2>Katalog se nepodařilo načíst.</h2><p>Zkuste stránku obnovit.</p><a class="au-primary" href="https://eshop.auto-lenc.cz/cs/katalog/univerzalni-dily">Přejít do katalogu →</a></div>`;});
  function start([config,data]){
    const nodes=data.nodes,groups=config.groups,expanded=new Set(),collapsed=new Set();
    let current='',lastHash=null,request=0,nativeView=null,searchTimer,oilLoaded=false,oilPromise=null;
    const groupByRoot=new Map(groups.flatMap(g=>g.roots.map(id=>[id,g])));
    const name=node=>config.name_overrides?.[node.id]||node.name;
    const groupFor=node=>groupByRoot.get(node.path[0]);
    const hidden=node=>config.hidden_roots.includes(node.path[0]);
    const treeRequests=new Map();
    function importNodes(markup,parent){
      const doc=new DOMParser().parseFromString(markup,'text/html');const children=[];
      doc.querySelectorAll('a[data-node-id][data-full-category-ids-path]').forEach(a=>{
        const id=a.dataset.nodeId,path=a.dataset.fullCategoryIdsPath.split('~');
        if(!/^\d+$/.test(id)||path.some(id=>!/^\d+$/.test(id))||path.slice(0,-1).join('~')!==parent.path.join('~'))return;
        const url=new URL(a.getAttribute('href'),config.shop_origin);if(url.origin!==config.shop_origin||!url.pathname.startsWith('/cs/katalog/univerzalni-dily'))return;
        const label=a.querySelector('.name')?.textContent.trim();if(!label)return;
        const count=Number(a.querySelector('.children-count')?.textContent||0),items=a.querySelector('.items-count');
        const child={id,parent:parent.id,path,name:label,url:url.href,children_count:count,items_count:items?Number(items.textContent):null,children:nodes[id]?.children||[],product_category:fold([...path.slice(0,-1).map(id=>nodes[id]?.name||''),label].join(' ')).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')};
        nodes[id]=child;children.push(id);
      });
      if(!children.length&&parent.children_count)throw Error('Kategorie nevrátila podúrovně.');
      parent.children=[...new Set(children)];parent.children_count=parent.children.length;
    }
    function ensureNode(node){
      if(node.children.length>=node.children_count)return Promise.resolve();
      if(location.origin!==config.shop_origin)return Promise.reject(Error('Podkategorie jsou dostupné na e-shopu.'));
      if(treeRequests.has(node.id))return treeRequests.get(node.id);
      const pending=(async()=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);try{
        const r=await fetch(new URL('/LegacyEshop/AjaxWSLegacy/GetUniversalPartsSubcategories',config.shop_origin),{method:'POST',credentials:'same-origin',signal:abort.signal,headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({id:Number(node.id),useDynamicLoad:true,rootCategoryID:-1})});
        if(!r.ok)throw Error('Podkategorie není dostupná.');let response=await r.json();if(typeof response==='string')response=JSON.parse(response);if(typeof response.ItemsHTMLContent!=='string')throw Error('Neplatný strom.');importNodes(response.ItemsHTMLContent,node);
      }finally{clearTimeout(timer);treeRequests.delete(node.id);}})();treeRequests.set(node.id,pending);return pending;
    }
    async function resolveTrail(trail){
      const path=trail.split('~');if(path.length>15||path.some(id=>!/^\d+$/.test(id))||!data.roots.includes(path[0]))throw Error('Neplatná cesta.');
      for(let i=0;i<path.length-1;i++){const parent=nodes[path[i]];if(!parent)throw Error('Kategorie nebyla nalezena.');if(!nodes[path[i+1]])await ensureNode(parent);if(!parent.children.includes(path[i+1]))throw Error('Kategorie nepatří do této větve.');}
    }
    let view='grid',recent=[];
    try{view=localStorage.getItem('al-uni-view')==='list'?'list':'grid';recent=JSON.parse(localStorage.getItem('al-uni-recent')||'[]').filter(id=>nodes[id]&&!hidden(nodes[id])).slice(0,5);}catch(_){}
    const href=(route,params={})=>{const u=new URL(location.href);const h=new URLSearchParams();if(route)h.set('uni',route);if(route?.startsWith('n:')&&nodes[route.slice(2)])h.set('trail',nodes[route.slice(2)].path.join('~'));for(const[k,v]of Object.entries(params))if(v)h.set(k,v);u.hash=h.toString();return u.href;};
    const link=(route,label,cls='',extra='')=>`<a href="${esc(href(route))}" data-route="${esc(route)}" class="${cls}" ${extra}>${label}</a>`;
    app.innerHTML=`<header class="au-header"><div><span class="au-eyebrow">AUTO LENC · KATALOG</span><h2>${esc(config.title)}</h2></div><a class="au-configurator" href="https://eshop.auto-lenc.cz/cs/clanek/konfiguratory---rohoze-cz">${icon('car')}Rohože podle auta ${icon('arrow')}</a></header><div class="au-search-wrap"><label class="au-search">${icon('search')}<input type="search" placeholder="Najít kategorii, například stěrače, AdBlue nebo nářadí…" aria-label="Hledat kategorie"><button type="button" class="au-search-clear" aria-label="Vymazat hledání" hidden>×</button></label><a class="au-shop-search" hidden>Hledat zboží →</a></div><div class="au-mobile-bar"><button type="button" class="au-catalog-toggle" aria-expanded="false" aria-controls="au-category-dialog" aria-haspopup="dialog">${icon('list')}Kategorie</button><span>Oleje, výbava a dílna na jednom místě</span></div><dialog id="au-category-dialog" class="au-category-dialog" aria-label="Kategorie univerzálních dílů"></dialog><div class="au-layout"><aside class="au-sidebar" aria-label="Kategorie univerzálních dílů"><div class="au-side-heading">Katalog produktů<button type="button" class="au-menu-close" aria-label="Zavřít kategorie">×</button></div><nav class="au-tree"></nav><a class="au-side-help" href="https://eshop.auto-lenc.cz/cs/clanek/mazaci-plan---totalenergies-cz">${icon('oil')}Mazací plán TotalEnergies ${icon('arrow')}</a></aside><div class="au-main"><nav class="au-breadcrumb" aria-label="Drobečková navigace"></nav><section class="au-page"></section><div id="al-oils-mount" data-host-hash="uni" hidden></div><div class="au-native-host" hidden></div></div></div>`;
    const $=s=>app.querySelector(s),search=$('.au-search input'),oil=$('#al-oils-mount');
    const drawer=$('.au-category-dialog'),side=$('.au-sidebar'),layout=$('.au-layout'),sidePlaceholder=document.createElement('div');
    sidePlaceholder.className='au-side-placeholder';sidePlaceholder.setAttribute('aria-hidden','true');
    let menuOpen=false,bodyOverflow='';
    function closeMenu(restoreFocus=true){
      if(!menuOpen)return;menuOpen=false;
      if(drawer.open&&drawer.close)drawer.close();else drawer.removeAttribute('open');
      layout.insertBefore(side,$('.au-main'));sidePlaceholder.remove();document.body.style.overflow=bodyOverflow;
      app.classList.remove('au-menu-open');$('.au-catalog-toggle').setAttribute('aria-expanded','false');
      if(restoreFocus)$('.au-catalog-toggle').focus();
    }
    $('.au-catalog-toggle').onclick=()=>{
      if(menuOpen){closeMenu();return;}menuOpen=true;bodyOverflow=document.body.style.overflow;
      layout.insertBefore(sidePlaceholder,side);drawer.append(side);app.classList.add('au-menu-open');document.body.style.overflow='hidden';
      $('.au-catalog-toggle').setAttribute('aria-expanded','true');
      if(drawer.showModal)drawer.showModal();else drawer.setAttribute('open','');
      $('.au-menu-close').focus();
    };
    $('.au-menu-close').onclick=()=>closeMenu();
    drawer.addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
    drawer.addEventListener('close',()=>{if(menuOpen&&!drawer.open)closeMenu();});
    drawer.addEventListener('click',e=>{if(e.target===drawer)closeMenu();});
    app.addEventListener('keydown',e=>{
      if(!menuOpen)return;
      if(e.key==='Escape'){e.preventDefault();closeMenu();}
      if(e.key==='Tab'){
        const items=[...side.querySelectorAll('a[href],button:not([disabled])')];
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
    app.addEventListener('click',e=>{const a=e.target.closest('a[data-route]');if(!a||e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();search.value='';clearTimeout(searchTimer);navigate(a.dataset.route,a.dataset.trail?{trail:a.dataset.trail}:{});});
    function navigate(route,params={},replace=false){history[replace?'replaceState':'pushState'](null,'',href(route,params));render(true);}
    function remember(id){recent=[id,...recent.filter(x=>x!==id)].slice(0,5);try{localStorage.setItem('al-uni-recent',JSON.stringify(recent));}catch(_){} }
    function navNode(id,level,active){const n=nodes[id];if(!n)return'';const open=!collapsed.has(id)&&(expanded.has(id)||active?.path.includes(id));return `<div class="au-node-row ${active?.id===id?'is-active':''}" style="--au-depth:${level}">${link('n:'+id,esc(name(n)),'',active?.id===id?'aria-current="page"':'')}${n.children_count?`<button type="button" data-expand="${id}" aria-label="${open?'Sbalit':'Rozbalit'} ${esc(name(n))}" aria-expanded="${!!open}">${open?'−':'+'}</button>`:''}</div>${open?n.children.map(child=>navNode(child,level+1,active)).join(''):''}`;}
    function sidebar(active,group){const tree=$('.au-tree'),scroll=tree.scrollTop,focus=document.activeElement?.dataset?.expand;tree.innerHTML=link('',`${icon('grid')}<span>Všechny kategorie</span>`,'au-all '+(!current?'is-active':''))+groups.map(g=>{const open=!collapsed.has('g:'+g.id)&&(group?.id===g.id||expanded.has('g:'+g.id));return `<div class="au-menu-group ${g.secondary?'is-secondary':''}"><div class="au-group-row ${group?.id===g.id?'is-active':''}">${link('g:'+g.id,`${icon(g.icon)}<span>${esc(g.name)}</span>`)}<button type="button" data-expand="g:${g.id}" aria-label="${open?'Sbalit':'Rozbalit'} ${esc(g.name)}" aria-expanded="${!!open}">${open?'−':'+'}</button></div>${open?`<div class="au-branch">${(g.roots.length===1&&nodes[g.roots[0]]?.children.length?nodes[g.roots[0]].children:g.roots).map(id=>navNode(id,0,active)).join('')}</div>`:''}</div>`;}).join('');tree.scrollTop=scroll;if(focus)[...tree.querySelectorAll('[data-expand]')].find(b=>b.dataset.expand===focus)?.focus({preventScroll:true});app.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{const id=b.dataset.expand;const wasOpen=b.getAttribute('aria-expanded')==='true';if(wasOpen){collapsed.add(id);expanded.delete(id);}else{collapsed.delete(id);expanded.add(id);}sidebar(active,group);if(!wasOpen&&nodes[id]&&nodes[id].children.length<nodes[id].children_count){const route=current;ensureNode(nodes[id]).then(()=>{if(current===route)sidebar(active,group);}).catch(()=>{if(current===route)navigate('n:'+id);});}});}
    function breadcrumbs(node,group){const links=[link('','Všechny kategorie')];if(group)links.push(link('g:'+group.id,esc(group.name)));if(node)for(const id of node.path){const n=nodes[id];if(n)links.push(id===node.id?`<span aria-current="page">${esc(name(n))}</span>`:link('n:'+id,esc(name(n))));}$('.au-breadcrumb').innerHTML=links.join('<span aria-hidden="true">/</span>');}
    function picture(id,kind,local=false){const src=local?asset('images/'+id+'.webp'):'https://eshop.auto-lenc.cz/Image.ashx?type=5&id='+encodeURIComponent(id);return `<span class="au-category-image">${icon(kind)}<img src="${esc(src)}" alt="" width="76" height="76" loading="lazy" decoding="async"></span>`;}
    function groupCard(g){return link('g:'+g.id,`${picture(g.image_id,g.icon,!!data.local_images?.includes(g.image_id))}<span class="au-card-content"><strong>${esc(g.name)}</strong><small>${esc(g.description)}</small><span class="au-card-go">Vybrat kategorii <span>→</span></span></span>`,'au-category-card');}
    function nodeCard(n){const g=groupFor(n),summary=n.children_count?(n.children.length?n.children.map(id=>name(nodes[id])).slice(0,3).join(' · '):n.children_count+' podkategorií'):n.items_count===0?'Prohlédnout kategorii':n.items_count!=null?`${n.items_count.toLocaleString('cs-CZ')} položek v katalogu`:'Prohlédnout produkty';return link('n:'+n.id,`${picture(n.id,g?.icon||'parts')}<span class="au-card-content"><strong>${esc(name(n))}</strong><small>${esc(summary)}</small><span class="au-card-go">${n.children_count?'Vybrat podkategorii':'Zobrazit produkty'} <span>→</span></span></span>`,'au-category-card');}
    function viewSwitch(){return `<div class="au-view-switch" aria-label="Zobrazení kategorií"><button type="button" data-view="grid" aria-label="Dlaždice" aria-pressed="${view==='grid'}">${icon('grid')}</button><button type="button" data-view="list" aria-label="Seznam" aria-pressed="${view==='list'}">${icon('list')}</button></div>`;}
    function bindPage(){app.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;try{localStorage.setItem('al-uni-view',view);}catch(_){}$('.au-category-grid')?.classList.toggle('is-list',view==='list');app.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view===view)));});app.querySelectorAll('.au-category-image img').forEach(img=>{const fail=()=>{img.hidden=true;img.parentElement.classList.add('is-missing');};img.onerror=fail;img.onload=()=>{if(img.naturalWidth<12||img.naturalHeight<12)fail();else img.parentElement.classList.add('has-image');};if(img.complete){if(img.naturalWidth<12)fail();else img.parentElement.classList.add('has-image');}});}
    function quick(){return `<nav class="au-quick" aria-label="Rychlý výběr">${config.quick_links.map(q=>q.route?link(q.route,`${icon(q.icon)}<span>${esc(q.name)}</span>${icon('arrow')}`):`<a href="${esc(q.url)}">${icon(q.icon)}<span>${esc(q.name)}</span>${icon('arrow')}</a>`).join('')}</nav>`;}
    function heading(title,description,controls=''){return `<div class="au-page-heading"><div><h3 tabindex="-1" class="au-page-title">${esc(title)}</h3>${description?`<p>${esc(description)}</p>`:''}</div>${controls}</div>`;}
    function searchRow(n){return link('n:'+n.id,`${icon(groupFor(n)?.icon)}<span><strong>${esc(name(n))}</strong><small>${esc(n.path.slice(0,-1).map(id=>nodes[id]?name(nodes[id]):'').filter(Boolean).join(' › ')||groupFor(n)?.name||'')}</small></span>${icon('arrow')}`);}
    function showSearch(q){
      const searchToken=++request;
      nativeView?.destroy();nativeView=null;oil.hidden=true;oil.dispatchEvent(new Event('al:pause'));$('.au-native-host').hidden=true;app.classList.remove('au-product-view');current='';sidebar(null,null);breadcrumbs(null,null);
      const words=fold(q).split(/\s+/).filter(Boolean);
      const results=Object.values(nodes).filter(n=>!hidden(n)&&words.every(w=>fold([name(n),...n.path.slice(0,-1).map(id=>nodes[id]?.name||'')].join(' ')).includes(w))).sort((a,b)=>Number(fold(name(b)).includes(fold(q)))-Number(fold(name(a)).includes(fold(q))));
      let limit=80;
      const paint=()=>{ $('.au-page').innerHTML=heading('Výsledky hledání',`${results.length} kategorií v rychlém hledání`)+`<div class="au-search-results">${results.slice(0,limit).map(searchRow).join('')||'<div class="au-empty"><h3>Kategorii jsme nenašli.</h3><p>Zkuste kratší název nebo rozšiřte hledání.</p></div>'}</div>${limit<results.length?'<button type="button" class="au-primary au-show-products" data-more-results>Další výsledky →</button>':''}${location.origin===config.shop_origin?'<div class="au-search-extended"><button type="button" class="au-secondary" data-search-all>Prohledat celý strom kategorií</button><div class="au-extended-results" role="status"></div></div>':''}`;
        $('[data-more-results]')?.addEventListener('click',()=>{limit+=80;paint();});
        $('[data-search-all]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;const area=$('.au-extended-results');area.textContent='Vyhledáváme další kategorie…';const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);try{
          const r=await fetch(new URL('/LegacyEshop/AjaxWSLegacy/GetUniversalPartsBySearchPhrase2',config.shop_origin),{method:'POST',credentials:'same-origin',signal:abort.signal,headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({searchPhrase:q,rootCategoryID:-1})});if(!r.ok)throw Error();let markup=await r.text();try{const parsed=JSON.parse(markup);markup=typeof parsed==='string'?parsed:parsed.ItemsHTMLContent||parsed.HTMLContent||'';}catch(_){}if(searchToken!==request)return;
          const doc=new DOMParser().parseFromString(markup,'text/html'),found=new Map();
          doc.querySelectorAll('a[data-node-id][data-full-category-ids-path]').forEach(a=>{const id=a.dataset.nodeId,path=a.dataset.fullCategoryIdsPath.split('~'),label=a.querySelector('.name')?.textContent.trim();if(!/^\d+$/.test(id)||path.some(id=>!/^\d+$/.test(id))||!data.roots.includes(path[0])||config.hidden_roots.includes(path[0])||!label||!words.every(w=>fold(label).includes(w)))return;found.set(id,{id,path,name:label});});
          area.innerHTML=found.size?`<div class="au-search-results">${[...found.values()].map(n=>`<a href="${esc(href('n:'+n.id,{trail:n.path.join('~')}))}" data-route="n:${n.id}" data-trail="${esc(n.path.join('~'))}">${icon('parts')}<span><strong>${esc(n.name)}</strong><small>${esc(groupByRoot.get(n.path[0])?.name||'')}</small></span>${icon('arrow')}</a>`).join('')}</div>`:'<p>Zdroj nevrátil další odpovídající kategorie. Zkuste hledání zboží.</p>';
        }catch(_){if(searchToken===request)area.innerHTML=`<p>Rozšířené hledání se nepodařilo načíst. <a href="${config.shop_origin}/cs/katalog/univerzalni-dily">Otevřít původní katalog →</a></p>`;}finally{clearTimeout(timer);if(searchToken===request)$('[data-search-all]').disabled=false;}});
      };paint();
      $('.au-search-clear').hidden=false;const shop=$('.au-shop-search');shop.hidden=false;shop.href=config.shop_origin+'/cs/hledani/1/9/'+encodeURIComponent(q);lastHash=null;
    }
    search.oninput=()=>{clearTimeout(searchTimer);const q=search.value.trim();searchTimer=setTimeout(()=>{if(q)showSearch(q);else render(true);},140);};search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(searchTimer);if(search.value.trim())showSearch(search.value.trim());}};
    $('.au-search-clear').onclick=()=>{clearTimeout(searchTimer);search.value='';render(true);search.focus();};
    function readProductState(){
      const h=new URLSearchParams(location.hash.slice(1));let attrs={},ranges={};
      try{const parsed=JSON.parse(h.get('filters')||'{}');for(const[k,v]of Object.entries(parsed)){if(/^[\w-]+\|[\w-]+$/.test(k)&&Array.isArray(v))attrs[k]=v.filter(x=>typeof x==='string'&&x.length<200&&!/[;|~]/.test(x)).slice(0,500);}}catch(_){}
      try{for(const[k,v]of Object.entries(JSON.parse(h.get('ranges')||'{}'))){if(attrs[k]?.length&&Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]<=v[1])ranges[k]=v;}}catch(_){}
      return{page:Math.max(1,Math.min(100000,parseInt(h.get('page'),10)||1)),sort:['4','5','6','7','3','1','2'].includes(h.get('sort'))?h.get('sort'):'4',stock:h.get('stock')==='1',brands:h.getAll('brand').filter(x=>/^-?\d+$/.test(x)),groups:h.getAll('type').filter(x=>/^[\w-]+$/.test(x)).slice(0,1),attrs,ranges};
    }
    function productNavigate(state,force){
      const previous=new URLSearchParams(location.hash.slice(1)),h=new URLSearchParams();h.set('uni',current);
      if(previous.get('trail'))h.set('trail',previous.get('trail'));if(previous.get('products')==='1')h.set('products','1');
      if(state.page>1)h.set('page',state.page);if(state.sort!=='4')h.set('sort',state.sort);if(state.stock)h.set('stock','1');
      state.brands.forEach(b=>h.append('brand',b));(state.groups||[]).forEach(g=>h.append('type',g));
      if(Object.keys(state.attrs).length)h.set('filters',JSON.stringify(state.attrs));if(Object.keys(state.ranges||{}).length)h.set('ranges',JSON.stringify(state.ranges));
      const u=new URL(location.href);u.hash=h.toString();history[force?'replaceState':'pushState'](null,'',u.href);render(true);
    }
    const hasProducts=node=>!!node&&!new URL(node.url).searchParams.has('category-id');
    function subcategories(node){
      const list=node.children.map(id=>nodes[id]).filter(Boolean);
      const tile=n=>link('n:'+n.id,`${esc(name(n))}<span aria-hidden="true">→</span>`,'au-subcategory');
      return list.length?`<nav class="au-refine" aria-label="Upřesnit kategorii"><strong>Upřesnit výběr</strong><div class="au-subcategory-grid">${list.slice(0,8).map(tile).join('')}</div>${list.length>8?`<details class="au-more-categories"><summary>Další podkategorie (${list.length-8})</summary><div class="au-subcategory-grid">${list.slice(8).map(tile).join('')}</div></details>`:''}</nav>`:'';
    }
    function sourceLinks(node,group){return group?.roots.length>1&&node.path.length===1?`<nav class="au-sources" aria-label="Nabídky v této skupině">${group.roots.map(id=>link('n:'+id,esc(name(nodes[id])),'',id===node.id?'aria-current="page"':'')).join('')}</nav>`:'';}
    function loadSubcategories(node,token){
      const host=$('.au-subcategories');if(!host)return;
      host.innerHTML=subcategories(node)+'<p class="au-muted" role="status">Načítáme podkategorie…</p>';
      ensureNode(node).then(()=>{if(token===request){host.innerHTML=subcategories(node);sidebar(node,groupFor(node));}}).catch(()=>{
        if(token!==request)return;host.innerHTML=subcategories(node)+'<p class="au-tree-notice">Podkategorie se nepodařilo načíst. <button type="button" data-tree-retry>Zkusit znovu</button></p>';
        host.querySelector('[data-tree-retry]').onclick=()=>loadSubcategories(node,token);
      });
    }
    async function products(node,token){
      const host=$('.au-native-host');host.hidden=false;host.innerHTML='<div class="au-loading" role="status">Načítáme produkty…</div>';
      try{await Promise.all([loadScript('../oleje/live.js'),loadScript('native.js')]);if(token!==request)return;nativeView=window.AutoLencUniNative.mount(host,node,{config,icon,readState:readProductState,navigate:productNavigate});}
      catch(_){if(token===request)host.innerHTML=`<div class="au-empty">Nabídku se nepodařilo načíst. <a href="${esc(node.url)}">Otevřít produkty v katalogu →</a></div>`;}
    }
    async function oils(token){oil.hidden=false;if(oilLoaded){oil.dispatchEvent(new Event('al:resume'));return;}oil.innerHTML='<div class="au-loading" role="status">Načítáme výběr olejů…</div>';try{oilPromise||=loadScript('../oleje/oleje.js');await oilPromise;oilLoaded=true;if(token!==request)oil.hidden=true;}catch(_){oilPromise=null;oil.dataset.loaded='';oil.innerHTML=`<div class="au-empty">Katalog olejů není dostupný. <a href="${esc(nodes['19058'].url)}">Otevřít původní nabídku →</a></div>`;}}
    function render(force=false){
      if(location.hash.startsWith('#oil=')){try{const legacy=new URLSearchParams({uni:'n:19058',trail:'19058',oil:decodeURIComponent(location.hash.slice(5))});const url=new URL(location.href);url.hash=legacy.toString();history.replaceState(null,'',url.href);}catch(_){} }
      const incoming=new URLSearchParams(location.hash.slice(1)),entry=groups.find(g=>'g:'+g.id===incoming.get('uni'));
      const primary=entry?.roots.map(id=>nodes[id]).find(n=>hasProducts(n)&&(n.children_count>0||n.items_count!==0));
      if(primary){const u=new URL(location.href);incoming.set('uni','n:'+primary.id);incoming.set('trail',primary.path.join('~'));u.hash=incoming.toString();history.replaceState(null,'',u.href);}
      if(!force&&lastHash===location.hash)return;const hadRoute=lastHash!==null,previous=current;lastHash=location.hash;
      const h=new URLSearchParams(location.hash.slice(1));current=h.get('uni')||'';if(current===previous&&nativeView&&!$('.au-native-host').hidden){nativeView.update(!!force);return;}const token=++request;
      nativeView?.destroy();nativeView=null;oil.hidden=true;oil.dispatchEvent(new Event('al:pause'));$('.au-native-host').hidden=true;closeMenu(false);$('.au-search-clear').hidden=true;$('.au-shop-search').hidden=true;search.value='';app.classList.remove('au-product-view');
      const node=current.startsWith('n:')?nodes[current.slice(2)]:null,group=node?groupFor(node):groups.find(g=>'g:'+g.id===current);
      if(current!==previous){if(group)collapsed.delete('g:'+group.id);node?.path.forEach(id=>collapsed.delete(id));}sidebar(node,group);breadcrumbs(node,group);
      const page=$('.au-page');
      if(!node&&current.startsWith('n:')&&h.get('trail')?.split('~').at(-1)===current.slice(2)){
        page.innerHTML='<div class="au-loading" role="status">Načítáme zvolenou kategorii…</div>';
        resolveTrail(h.get('trail')).then(()=>{if(token===request)render(true);}).catch(()=>{if(token===request)page.innerHTML=`<div class="au-empty"><h3>Kategorii se nepodařilo otevřít.</h3><p>Vraťte se do hlavního katalogu a vyberte příslušnou větev.</p>${link('','Všechny kategorie','au-primary')}</div>`;});return;
      }
      if(node&&!hasProducts(node)&&node.children.length<node.children_count){
        page.innerHTML=heading(name(node),'Vyberte podkategorii.')+'<div class="au-loading" role="status">Načítáme podkategorie…</div>';
        ensureNode(node).then(()=>{if(token===request)render(true);}).catch(()=>{if(token!==request)return;page.innerHTML=heading(name(node),'Vyberte podkategorii.')+`<div class="au-empty"><h3>${location.origin===config.shop_origin?'Podkategorie se teď nepodařilo načíst.':'Další podkategorie najdete na e-shopu.'}</h3>${location.origin===config.shop_origin?'<button type="button" class="au-primary" data-tree-retry>Zkusit znovu</button>':''}<a href="${esc(node.url)}" class="au-secondary">Pokračovat v původní kategorii →</a></div>`;$('[data-tree-retry]')?.addEventListener('click',()=>render(true));});return;
      }
      if(!current){page.innerHTML=heading('Co potřebujete pro své auto nebo dílnu?','Vyberte kategorii nebo začněte jednou z rychlých voleb.')+quick()+`<div class="au-section-line"><h3>Všechny kategorie</h3>${viewSwitch()}</div><div class="au-category-grid ${view==='list'?'is-list':''}">${groups.filter(g=>!g.secondary).map(groupCard).join('')}</div>${recent.length?`<div class="au-recent"><h4>Naposledy prohlížené</h4>${recent.map(id=>link('n:'+id,esc(name(nodes[id])))).join('')}</div>`:''}<div class="au-bottom-links">${groups.filter(g=>g.secondary).map(g=>link('g:'+g.id,`${icon(g.icon)}${esc(g.name)} →`)).join('')}<a href="${config.shop_origin}/cs/katalog/tecdoc/osobni">Hledáte díl podle vozidla? →</a></div>`;}
      else if(node){
        remember(node.id);const list=node.children.map(id=>nodes[id]).filter(Boolean);
        if(hasProducts(node)){
          app.classList.add('au-product-view');
          page.innerHTML=heading(name(node),'Vyberte z nabídky nebo ji zpřesněte kategorií a filtry.')+sourceLinks(node,group)+`<div class="au-subcategories">${subcategories(node)}</div>`;
          if(node.id==='19058')oils(token);else products(node,token);
          if(node.children.length<node.children_count)loadSubcategories(node,token);
        }else{page.innerHTML=heading(name(node),'Vyberte oblast nabídky.',viewSwitch())+`<div class="au-category-grid ${view==='list'?'is-list':''}">${list.map(nodeCard).join('')}</div>`;}
      }else if(group){const list=group.roots.length===1&&nodes[group.roots[0]]?.children.length?nodes[group.roots[0]].children.map(id=>nodes[id]):group.roots.map(id=>nodes[id]).filter(Boolean);page.innerHTML=heading(group.name,group.description,viewSwitch())+(group.id==='oleje'?`<div class="au-oil-entry">${icon('oil')}<div><strong>Najděte olej podle požadované normy</strong><span>Viskozita, ACEA, API a schválení výrobce na jednom místě.</span></div>${link('n:19058','Vybrat olej →','au-primary')}</div>`:'')+`<div class="au-category-grid ${view==='list'?'is-list':''}">${list.map(nodeCard).join('')}</div>`;}
      else{page.innerHTML=`<div class="au-empty"><h3>Tuto kategorii se nepodařilo najít.</h3>${link('','Zpět na všechny kategorie','au-primary')}</div>`;}
      bindPage();if(force&&hadRoute&&previous!==current){$('.au-page-title')?.focus?.({preventScroll:true});$('.au-breadcrumb').scrollIntoView?.({block:'start',behavior:'auto'});}
    }
    window.addEventListener('hashchange',()=>render());window.addEventListener('popstate',()=>render());render(true);
  }
})();
