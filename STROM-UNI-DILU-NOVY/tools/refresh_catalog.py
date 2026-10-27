#!/usr/bin/env python3
"""Read the public Auto Lenc branch and its product parameters. No account data."""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from lxml import html

SOURCE='https://eshop.auto-lenc.cz/cs/katalog/univerzalni-dily/oleje-a-maziva/19058/?root=-1&path=19058'
SHOP='https://eshop.auto-lenc.cz'
ROOT=Path(__file__).resolve().parents[1]
NOW=dt.datetime.now(dt.timezone.utc).isoformat()
CL=lambda name: 'contains(concat(" ",normalize-space(@class)," ")," '+name+' ")'

def clean(s):return re.sub(r'\s+',' ',s or '').strip()
def node_text(node,xpath):
    found=node.xpath(xpath)
    return clean(found[0].text_content() if hasattr(found[0],'text_content') else str(found[0])) if found else ''
def unique(values):return list(dict.fromkeys(clean(v) for v in values if clean(v)))
def dump(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(path)
def tree(data):return html.fromstring(data,parser=html.HTMLParser(encoding='utf-8'))

def fetch(url):
    for attempt in range(3):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'AutoLencCatalogPreparation/1.0','Accept':'text/html'})
            with urllib.request.urlopen(request,timeout=40) as res:
                data=res.read()
            if len(data)<1000:raise ValueError('Unexpectedly short response')
            return data
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))

def get_page(n,work):
    path=work/'pages'/f'{n}.html'
    if path.exists():data=path.read_bytes()
    else:
        url=SOURCE+'&page='+str(n)
        data=fetch(url);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        time.sleep(.25)
    doc=tree(data)
    rows=doc.xpath('//*['+CL('products-list')+']//*['+CL('flex-item')+' and @data-flex-group-id]')
    if not rows:raise ValueError(f'Page {n} has no products')
    products=[]
    for row in rows:
        anchor=row.xpath('.//*['+CL('flex-header-container')+']//h2/a[@href]')
        if not anchor:continue
        href=urllib.parse.urljoin(SHOP,anchor[0].get('href'))
        products.append({'id':row.get('data-flex-group-id'),
            'code':node_text(row,'.//*['+CL('manufacturer-code')+']//*['+CL('code')+']'),
            'brand':node_text(row,'.//*['+CL('manufacturer-code')+']//*['+CL('manufacturer')+']'),
            'name':node_text(row,'.//*['+CL('flex-header-container')+']//*['+CL('name')+']'),
            'url':href,
            'image':node_text(row,'.//*['+CL('flex-image-wrapper')+']//img/@data-flex-async-image-src'),
            'generic_article_id':row.get('data-flex-tecdoc-generic-article-id'),
            'catalog_numbers':node_text(row,'.//*['+CL('usage-numbers')+']/strong')})
    count=node_text(doc,'//*['+CL('flex-product-count-value')+']')
    total=int(re.sub(r'\D','',count)) if count else None
    more=doc.xpath('//*['+CL('products-list')+']//a['+CL('flex-load-next')+']/@href')
    return {'page':n,'products':products,'total':total,'has_more':bool(more)}

def detail(product,work):
    cache=work/'details'/(product['id']+'.json')
    if cache.exists():return json.loads(cache.read_text())
    try:
        data=fetch(product['url']);doc=tree(data)
        title=node_text(doc,'//title')
        if '404' in title or 'nenalezena' in title.lower():raise ValueError('Product detail not found')
        params=[]
        for row in doc.xpath('//*['+CL('flex-product-informations')+']//table//tr'):
            cells=row.xpath('./td')
            if len(cells)==2:
                key,value=clean(cells[0].text_content()),clean(cells[1].text_content())
                if key and value:params.append({'name':key,'value':value})
        description=node_text(doc,'//*['+CL('flex-product-informations')+']//*['+CL('flex-description')+']')
        canonical=node_text(doc,'//link[@rel="canonical"]/@href')
        record={'id':product['id'],'parameters':params,'source_url':canonical or product['url'],
                'checked_at':NOW,'source_type':'shop_catalog','response_sha256':hashlib.sha256(data).hexdigest(),
                'description':description[:1200],'error':None}
        dump(cache,record);time.sleep(.2);return record
    except Exception as exc:
        return {'id':product['id'],'parameters':[],'source_url':product['url'],'checked_at':NOW,'source_type':'shop_catalog','error':str(exc)}

def normalize(product,record):
    attrs=record['parameters']
    def values(pattern):return unique(a['value'] for a in attrs if re.search(pattern,a['name'],re.I))
    volume=values(r'obsah.*litr|objem.*litr|^balení$|^\d+\.\s*Objem$')
    litres=[]
    for text in volume:
        m=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*(?:l|litr[ůy]?)?',text,re.I)
        if m:litres.append(float(m.group(1).replace(',','.')))
    def split_values(items,prefix=''):
        result=[]
        for item in items:
            for part in re.split(r'\s+/\s+|\s*;\s*',item):
                part=re.sub(r'^'+prefix+r'\s+','',part,flags=re.I) if prefix else part
                if part:result.append(part)
        return unique(result)
    sae=[]
    for value in values(r'viskoz.*SAE|^SAE|^Viskozitní třída$|^\d+\.\s*Viskozita$'):
        value=re.sub(r'^SAE\s*','',value,flags=re.I)
        value=re.sub(r'(\d+)\s*W\s*[-–]?\s*(\d+)',r'\1W-\2',value,flags=re.I)
        sae.append(value)
    specs={'sae':unique(sae),
           'volume_l':list(dict.fromkeys(litres)),
           'acea':split_values(values(r'specifikace.*ACEA|^ACEA'),'ACEA'),
           'api':split_values(values(r'specifikace.*API|^API'),'API'),
           'ilsac':split_values(values(r'ILSAC'),'ILSAC'),
           'approvals':split_values(values(r'^uvolnění výrobce$|^schválení výrobce$|^schválení výrobců$|^schváleno$')),
           'recommendations':split_values(values(r'doporučení výrobce oleje|^Vhodné pro$')),
           'meets_requirements':split_values(values(r'^Splňuje požadavky$|^OV Splňuje$')),
           'container':values(r'typ kontejneru|typ obalu'),
           'oil_type':values(r'^olej$|chemická vlastnost|^Typ oleje$'),
           'other_standards':values(r'specifikace|norma|kvalita')}
    for item in attrs:
        if not re.fullmatch(r'specifikace|Mezinárodní normy',item['name'],re.I):continue
        for part in re.split(r'\s+/\s+|\s*;\s*',item['value']):
            for key,prefix,pattern in [('acea','ACEA',r'[ABCEF]\d+(?:/[ABCEF]\d+)*'),('api','API',r'(?:[SC][A-Z](?:-\d)?|GL-[1-6]|MT-1)(?:/(?:[SC][A-Z](?:-\d)?|GL-[1-6]|MT-1))*'),('ilsac','ILSAC',r'GF-\d[A-B]?')]:
                match=re.fullmatch(prefix+r'\s+('+pattern+r')',part,re.I)
                if match:specs[key].append(match.group(1).upper())
    for key in ['acea','api','ilsac']:
        specs[key]=unique(part.strip() for value in specs[key] for part in value.split('/'))
    evidence={k:{'source_url':record['source_url'],'source_type':'shop_catalog','checked_at':record['checked_at']} for k,v in specs.items() if v}
    inferred={}
    title_fields=[]
    if not specs['sae']:
        m=re.search(r'(?<!\d)(\d{1,2})\s*W\s*[-–]?\s*(\d{1,3})(?!\d)',product['name'],re.I)
        if m:
            specs['sae']=[m.group(1)+'W-'+m.group(2)];title_fields.append('sae')
    if not specs['volume_l']:
        matches=re.findall(r'(?<![\d.,])(\d+(?:[.,]\d+)?)\s*L\b',product['name'],re.I)
        if len(matches)==1 and not re.search(r'\bIBC\b',product['name'],re.I):
            specs['volume_l']=[float(matches[0].replace(',','.'))];title_fields.append('volume_l')
        elif matches:inferred['volume_l_candidates']=[float(m.replace(',','.')) for m in matches]
    for field in title_fields:
        evidence[field]={'source_url':record['source_url'],'source_type':'shop_product_title','checked_at':record['checked_at'],'text':product['name']}
    missing=[k for k in ['sae','volume_l'] if not specs[k]]
    return {**product,'url':record['source_url'],'specifications':specs,'raw_parameters':attrs,
            'evidence':evidence,'candidates_not_used_for_filters':inferred,
            'review':{'status':'catalog_parameters' if attrs else 'needs_research','missing_core_fields':missing,
                      'fields_from_title':title_fields,'manufacturer_verified':False,'error':record.get('error')}}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--work-dir',type=Path,default=ROOT/'.cache'/dt.datetime.now().strftime('%Y%m%d-%H%M%S'));parser.add_argument('--workers',type=int,default=3)
    args=parser.parse_args();work=args.work_dir;workers=max(1,min(args.workers,4));errors=[]
    first=get_page(1,work);total=first['total'];per_page=len(first['products']);pages=math.ceil(total/per_page)
    print(f'Branch total: {total}; page size: {per_page}; pages: {pages}',flush=True)
    results={1:first}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        pending={pool.submit(get_page,n,work):n for n in range(2,pages+1)}
        for future in concurrent.futures.as_completed(pending):
            n=pending[future]
            try:results[n]=future.result()
            except Exception as exc:errors.append({'page':n,'error':str(exc)})
            if len(results)%10==0:print(f'Listing pages: {len(results)}/{pages}',flush=True)
    products={p['id']:p for n in sorted(results) for p in results[n]['products']}
    dump(work/'inventory.json',{'expected_total':total,'products':list(products.values()),'errors':errors})
    print(f'Unique products: {len(products)}/{total}',flush=True)
    if errors or len(products)!=total:
        raise RuntimeError('Incomplete or changing listing; rerun with cache and inspect inventory.json before continuing.')
    records={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        pending={pool.submit(detail,p,work):p['id'] for p in products.values()}
        for future in concurrent.futures.as_completed(pending):
            record=future.result();records[record['id']]=record
            if len(records)%25==0:print(f'Details: {len(records)}/{total}',flush=True)
    normalized=[normalize(p,records[p['id']]) for p in products.values()]
    normalized.sort(key=lambda p:(p['brand'],p['name'],p['code'],p['id']))
    coverage={k:sum(bool(p['specifications'][k]) for p in normalized) for k in normalized[0]['specifications']}
    audit={'generated_at':NOW,'expected_count':total,'downloaded_count':len(normalized),'coverage':coverage,
           'details_failed':[p['id'] for p in normalized if p['review']['error']],
           'needs_review':[{'id':p['id'],'brand':p['brand'],'code':p['code'],'name':p['name'],**p['review']} for p in normalized if p['review']['missing_core_fields'] or not p['raw_parameters']]}
    payload={'schema_version':1,'generated_at':NOW,'source_branch':SOURCE,'product_count':len(normalized),
             'source_policy':'Catalog parameters are attributed to Auto Lenc, not manufacturer-verified. Approvals and recommendations remain separate.',
             'products':normalized}
    dump(ROOT/'catalog/oleje/catalog.json',payload);dump(ROOT/'catalog/oleje/audit.json',audit)
    print(json.dumps({'count':len(normalized),'coverage':coverage,'detail_errors':len(audit['details_failed']),'needs_review':len(audit['needs_review'])}),flush=True)

if __name__=='__main__':main()
