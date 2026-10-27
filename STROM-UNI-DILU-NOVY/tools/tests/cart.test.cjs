const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
class Element {
  constructor(record, parent = null) {
    this.attrs = record.attrs; this.tagName = record.tag; this.parent = parent;
    this.children = record.children.map(c => new Element(c, this)); this.text = record.text; this.tail = record.tail;
    this.dataset = Object.fromEntries(Object.entries(this.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
    this.classList = { contains: c => (this.attrs.class || '').split(' ').includes(c) };
  }
  get textContent() { return this.text + this.children.map(c => c.textContent + c.tail).join(''); }
  getAttribute(name) { return this.attrs[name]; }
  matches(selector) {
    const attribute = selector.match(/\[([^=*\]]+)(\*?=)"([^\"]*)"\]/);
    if (attribute) { const [, k, op, v] = attribute; if (op === '=' ? this.attrs[k] !== v : !(this.attrs[k] || '').includes(v)) return false; }
    const exists = selector.match(/\[([^=*\]]+)\]/); if (exists && !Object.hasOwn(this.attrs, exists[1])) return false;
    return [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].every(m => this.classList.contains(m[1]));
  }
  querySelectorAll(selector) {
    const parts = selector.split(' ');
    return this.children.flatMap(c => [c, ...c.descendants()]).filter(n => {
      if (!n.matches(parts.at(-1))) return false;
      let parent = n.parent;
      for (let i = parts.length - 2; i >= 0; i--) { while (parent && !parent.matches(parts[i])) parent = parent.parent; if (!parent) return false; parent = parent.parent; }
      return true;
    });
  }
  descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  closest(s) { for (let n = this; n; n = n.parent) if (n.matches(s)) return n; return null; }
}
const root = new Element(JSON.parse(fs.readFileSync(path.join(__dirname, 'native-detail.json'), 'utf8')));
const document = { querySelectorAll: s => root.querySelectorAll(s), getElementById: id => [root, ...root.descendants()].find(n => n.attrs.id === id) };
let calls = [];
const window = { addToBasket: (...args) => calls.push(args) };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../assets/oleje/live.js'), 'utf8'), { window });
const adapter = window.AutoLencOilLive;
const live = adapter.extract(document, { id: '2941184', code: '113430' });
assert.equal(live.price, '1 234,50');
assert.equal(live.currency, 'Kč');
assert.equal(live.onStock, true);
assert.match(live.stock, /7/);
assert.equal(live.args[4], 4424043);
assert.equal(live.args[18], false);
assert.equal(live.step, 1);
const button = {}; adapter.add(button, { id: 'ao-product-2941184' }, live, '2');
assert.equal(calls.length, 1); assert.equal(calls[0][0], button); assert.equal(calls[0][1], '#ao-product-2941184'); assert.equal(calls[0][6], '2');
for (const bad of ['0', '-1', 'NaN', '1.5']) assert.throws(() => adapter.add(button, { id: 'row' }, live, bad));
assert.equal(calls.length, 1);
assert.throws(() => adapter.parseArguments('addToBasket(alert(1))'));
assert.throws(() => adapter.extract(document, { id: '999', code: '113430' }));
assert.equal(adapter.extract(document, { id: '2941184', code: 'WRONG' }).args, undefined);
delete window.addToBasket;
assert.throws(() => adapter.add(button, { id: 'row' }, live, '1'));
console.log('Native adapter: native HTML structure fixture with sample price/stock, price/stock, exact product, quantity and safe cart arguments passed. No cart request sent.');
