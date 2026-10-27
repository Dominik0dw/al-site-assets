import json
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'catalog/oleje/catalog.json').read_text())
audit=json.loads((ROOT/'catalog/oleje/audit.json').read_text())
config=json.loads((ROOT/'assets/oleje/config.json').read_text())
overrides=json.loads((ROOT/'catalog/oleje/overrides.json').read_text())
products=data['products'];ids={p['id'] for p in products}
assert len(products)==len(ids)==data['product_count']==audit['expected_count']
for p in products:
    assert p['id'].isdigit() and p['code'] and p['name']
    u=urlparse(p['url']);assert u.scheme=='https' and u.netloc=='eshop.auto-lenc.cz' and u.path.endswith('/'+p['id'])
    assert not any(key in p for key in ['price','stock','cart','credentials','token'])
    for key,values in p['specifications'].items():
        assert isinstance(values,list), (p['id'],key)
        assert len(values)==len(set(values)), (p['id'],key)
        if values:
            assert key in p['evidence'],(p['id'],key)
            assert p['evidence'][key]['source_url'] and p['evidence'][key]['checked_at']
    for volume in p['specifications']['volume_l']:assert isinstance(volume,(int,float)) and volume>0
    assert not p['review'].get('error'),(p['id'],p['review'].get('error'))
for key,entry in overrides['products'].items():
    assert key in ids,key
    for field,change in entry['fields'].items():
        assert field in {f['key'] for f in config['filters']}
        assert isinstance(change['value'],list) and change['source_url'].startswith('https://') and change['checked_at']
assert all(f['mode'] in ['all','any'] for f in config['filters'])
print(f'{len(products)} unique products; valid IDs, sources, specifications and overrides; no price/stock/account data in database.')
