import json
from pathlib import Path
from urllib.parse import urlsplit

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'catalog/uni/tree.json').read_text())
config=json.loads((root/'assets/uni/config.json').read_text())
nodes=data['nodes']
assert data.get('complete') is True or config.get('lazy_tree') is True,'Neúplný export vyžaduje průběžné načítání.'
roots=set(data['roots']);covered=[]
for group in config['groups']:
    assert group['id'] and group['name']
    for id in group['roots']:
        assert id in roots
        covered.append(id)
assert len(covered)==len(set(covered)),'Hlavní větev je v několika oddílech.'
assert set(covered)|set(config['hidden_roots'])==roots,'Některé hlavní větve chybí.'
assert not(set(covered)&set(config['hidden_roots']))
visited=set()
def walk(id,ancestors):
    assert id not in visited,'Duplicitní uzel nebo cyklus: '+id
    visited.add(id);node=nodes[id]
    assert node['id']==id and id.isdecimal()
    assert node['path']==ancestors+[id]
    assert node['parent']==(ancestors[-1]if ancestors else None)
    assert len(node['children'])<=node['children_count'],id+' nesouhlasí počet podkategorií.'
    if len(node['children'])<node['children_count']:assert id in data.get('pending',[]),'Větev chybí v seznamu průběžně načítaných kategorií.'
    assert len(set(node['children']))==len(node['children'])
    url=urlsplit(node['url']);assert url.scheme=='https' and url.netloc=='eshop.auto-lenc.cz'
    assert url.path.startswith('/cs/katalog/univerzalni-dily')
    assert isinstance(node['name'],str) and node['name']
    assert node['items_count'] is None or isinstance(node['items_count'],int)
    for child in node['children']:walk(child,node['path'])
for id in data['roots']:walk(id,[])
assert visited==set(nodes),'Existují osiřelé uzly.'
assert len([g for g in config['groups']if not g.get('secondary')])==12
for q in config['quick_links']:
    if q.get('route','').startswith('n:'):assert q['route'][2:]in nodes
print(f'{len(nodes)} kategorií; {len(roots)} zdrojových kořenů; 12 hlavních oddílů + Akce. Žádné osiřelé uzly, cykly ani nepokryté hlavní větve. {len(data.get('pending',[]))} větví se načte při rozkliknutí.')
