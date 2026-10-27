#!/usr/bin/env python3
import argparse
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import re
import time
import unicodedata
import urllib.request
from lxml import html

ROOT=Path(__file__).resolve().parents[1]
SHOP='https://eshop.auto-lenc.cz'
SOURCE=SHOP+'/cs/katalog/univerzalni-dily/'
ENDPOINT=SHOP+'/LegacyEshop/AjaxWSLegacy/GetUniversalPartsSubcategories'

def parse(markup,parent):
    doc=html.fromstring(markup);result=[]
    for a in doc.xpath('//*[@data-node-id and @data-full-category-ids-path]'):
        path=a.get('data-full-category-ids-path').split('~')
        if (path[-2] if len(path)>1 else '-1')!=parent:continue
        count=a.xpath('./span[@class="children-count"]/text()');items=a.xpath('./span[@class="items-count"]/text()')
        result.append(dict(id=a.get('data-node-id'),parent=parent if parent!='-1' else None,name=''.join(a.xpath('./span[@class="name"]//text()')).strip(),url=SHOP+a.get('href'),path=path,children_count=int(count[0])if count else 0,items_count=int(items[0])if items else None,children=[]))
    return result

def request(url,payload=None):
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,data=json.dumps(payload).encode()if payload else None,headers={'Content-Type':'application/json; charset=utf-8','User-Agent':'AutoLencCatalog/3.0'})
            return urllib.request.urlopen(req,timeout=40).read()
        except Exception:
            if attempt==2:raise
            time.sleep(attempt+1)

def run(work,offline,workers):
    work.mkdir(parents=True,exist_ok=True);cache=work/'tree-cache';cache.mkdir(exist_ok=True)
    root_file=work/'root.html'
    if not root_file.exists():
        if offline:raise ValueError('Chybí root.html v pracovním adresáři.')
        root_file.write_bytes(request(SOURCE))
    roots=parse(root_file.read_bytes().decode('utf-8'),'-1')
    if not roots:raise ValueError('Zdroj neobsahuje hlavní kategorie.')
    nodes={n['id']:n for n in roots};queue=[n['id']for n in roots if n['children_count']];seen=set();errors={}
    def load(id):
        try:
            file=cache/(id+'.json')
            if file.exists():data=json.loads(file.read_text(encoding='utf-8'))
            else:
                if offline:raise ValueError('Kategorie není v mezipaměti.')
                data=json.loads(request(ENDPOINT,dict(id=int(id),useDynamicLoad=True,rootCategoryID=-1)))
                if isinstance(data,str):data=json.loads(data)
                if not isinstance(data.get('ItemsHTMLContent'),str):raise ValueError('Chybí HTML kategorií.')
                file.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
            return id,parse(data['ItemsHTMLContent'],id),None
        except Exception as error:return id,[],str(error)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers)as executor:
        while queue:
            batch=[id for id in queue if id not in seen];queue=[];seen.update(batch)
            for id,children,error in executor.map(load,batch):
                if error:errors[id]=error;continue
                nodes[id]['children']=[n['id']for n in children]
                if len(children)!=nodes[id]['children_count']:errors[id]='Počet podkategorií se změnil. Spusťte nový export.'
                for n in children:
                    if n['id']in nodes and nodes[n['id']]['path']!=n['path']:raise ValueError('Kategorie má více cest: '+n['id'])
                    nodes[n['id']]=n
                    if n['children_count'] and n['id']not in seen:queue.append(n['id'])
            print(len(nodes),'kategorií,',len(seen),'načtených větví,',len(errors),'chyb',flush=True)
    if errors:
        (work/'errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
        raise ValueError('Neúplný export. Původní tree.json zůstává beze změny; viz errors.json.')
    def slug(value):return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',value).encode('ascii','ignore').decode().lower()).strip('-')
    for node in nodes.values():node['product_category']=slug(' '.join(nodes[id]['name']for id in node['path']))
    output={'schema_version':1,'source':SOURCE,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'roots':[n['id']for n in roots],'nodes':nodes,'complete':True,'local_images':[]}
    destination=ROOT/'catalog/uni/tree.json';destination.parent.mkdir(parents=True,exist_ok=True)
    temp=destination.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(destination)
    print('Uloženo',destination,len(nodes),'kategorií.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Aktualizuje veřejný strom kategorií Auto Lenc. Nestahuje ceny ani košík.')
    parser.add_argument('--work-dir',type=Path,default=ROOT/'.cache'/'uni'/dt.datetime.now().strftime('%Y%m%d-%H%M%S'))
    parser.add_argument('--from-cache',action='store_true')
    parser.add_argument('--workers',type=int,choices=[1,2,3,4],default=3)
    args=parser.parse_args();run(args.work_dir,args.from_cache,args.workers)
