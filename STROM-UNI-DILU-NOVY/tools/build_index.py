import argparse
import datetime as dt
import json
from pathlib import Path
from urllib.request import Request, urlopen
from lxml import html

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--stock-response',type=Path)
parser.add_argument('--refresh-stock',action='store_true')
args=parser.parse_args()
data=json.loads((ROOT/'catalog/oleje/catalog.json').read_text())
fields=['id','code','brand','name','url','image','specifications','raw_parameters']
products=[]
for p in data['products']:
    item={key:p[key] for key in fields}
    item['evidence']={key:value for key,value in p['evidence'].items() if value['source_type']=='shop_product_title'}
    products.append(item)
compact={key:data[key] for key in ['schema_version','generated_at','source_branch','product_count']}
compact['products']=products
target=ROOT/'catalog/oleje/index.json'
target.write_text(json.dumps(compact,ensure_ascii=False,separators=(',',':'))+'\n')
print('Product index:',target.stat().st_size,'bytes')
payload=None
endpoint='https://eshop.auto-lenc.cz/LegacyEshop/AjaxWSLegacy/GetUniversalPartsProducts'
if args.stock_response:
    payload=json.loads(args.stock_response.read_text())
elif args.refresh_stock:
    body={'sortBy':'4','onStockOnly':'true','purchasePricePriorized':'false','viewMode':'0','filteredManufacturers':[],'parametersFilterQuery':'','parametersFilterRangeQuery':'','categoryID':'19058','fullCategoryIDs':'19058','rootCategoryID':'-1','category':'oleje-a-maziva','itemsCount':'-1','areHiddenGroupsVisible':'false','loadAllItems':'true','page':'1'}
    with urlopen(Request(endpoint,data=json.dumps(body).encode(),headers={'Content-Type':'application/json; charset=utf-8'}),timeout=45) as response:payload=json.load(response)
if payload is not None:
    if isinstance(payload,str):payload=json.loads(payload)
    assert payload['IsLastPage'] is True,'Incomplete availability index'
    doc=html.fromstring(payload['HTMLContent'])
    entries=[]
    for row in doc.xpath('//*[@data-flex-group-id and contains(concat(" ",normalize-space(@class)," ")," flex-item ")]'):
        stocks=row.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," flex-total-amount ")]')
        tier=0 if any('flex-on-stock' in (s.get('class') or '').split() for s in stocks) else 1
        entries.append([row.get('data-flex-group-id'),tier])
    snapshot={'schema_version':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'source':endpoint,'purpose':'Initial ordering only; current prices and stock are loaded in the visitor session.','entries':entries}
    (ROOT/'catalog/oleje/availability-order.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Initial availability order:',len(entries),'products; no prices or quantities saved')
