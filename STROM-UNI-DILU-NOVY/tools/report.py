import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'catalog/oleje/catalog.json').read_text())
products=data['products']
counts={key:sum(bool(p['specifications'].get(key)) for p in products) for key in products[0]['specifications']}
labels={'sae':'Viskozita SAE','volume_l':'Objem v litrech','acea':'ACEA','api':'API','ilsac':'ILSAC','approvals':'Schválení dle katalogu','recommendations':'Doporučení výrobce','meets_requirements':'Splňuje požadavky','container':'Typ obalu','oil_type':'Typ oleje','other_standards':'Další normy'}
rows=['# Pokrytí databáze','',f"Datum vytvoření: {data['generated_at']}",'',f"Počet produktů: **{len(products)}**. Zdroj: [větev Auto Lenc]({data['source_branch']}).",'', '| Parametr | Vyplněných produktů |','| --- | ---: |']
rows += [f'| {labels.get(key,key)} | {count} |' for key,count in counts.items()]
rows += ['',f"Bez tabulky původních parametrů: {sum(not p['raw_parameters'] for p in products)}.",f"S údaji převzatými z jednoznačného názvu: {sum(bool(p['review'].get('fields_from_title')) for p in products)}.",f"S chybou načtení detailu: {sum(bool(p['review'].get('error')) for p in products)}.",'','Prázdné pole neznamená, že výrobek danou normu nesplňuje. Znamená, že ji použitý zdroj neuvádí ve zpracovatelném parametru. Viskozita SAE nemusí být uvedena u ATF nebo jiných speciálních kapalin.','', 'Údaje jsou doložené katalogem e-shopu. Nejde o nezávislé ověření všech objednacích čísel u výrobce. Rozdílná balení ani různé generace olejů se automaticky neslučují.']
(ROOT/'docs/pokryti.md').write_text('\n'.join(rows)+'\n')
with (ROOT/'catalog/oleje/ke-kontrole.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f,delimiter=';');writer.writerow(['ID','Objednací číslo','Výrobce','Název','Chybějící základní pole','Chybí tabulka parametrů','Chyba','Detail'])
    for p in products:
        review=p['review']
        if review['missing_core_fields'] or not p['raw_parameters'] or review.get('error'):
            writer.writerow([p['id'],p['code'],p['brand'],p['name'],', '.join(review['missing_core_fields']),not bool(p['raw_parameters']),review.get('error') or '',p['url']])
print('Coverage report and review CSV created.')
