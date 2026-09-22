import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.listeners = {}; this.value = ''; this.hidden = false; this.checked = false;
    this.attributes = {}; this._text = '';
    this.classList = { toggle() {} };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  get childNodes() { return this.children; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = [...children]; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { for (const callback of this.listeners[type] || []) callback({ target: this }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  cloneNode() { const copy = new Element(this.tagName); copy._text = this._text; copy.children = this.children.map(c => c.cloneNode()); return copy; }
}

test('complete site starts, inputs recalculate, exclusion works and PDF preview opens', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const fields = [...html.matchAll(/<(input|select)\b[^>]*\bdata-field="([^"]+)"[^>]*>/g)]
    .map(([, tag, field]) => Object.assign(new Element(tag), { dataset: { field } }));
  const materialFields = ['rho20', 'cp', 'density', 'alpha', 'k'].map(key => Object.assign(new Element('input'), { dataset: { material: key } }));
  const cellFields = ['dcir', 'voltage'].map(key => Object.assign(new Element('input'), { dataset: { cell: key } }));
  // The material, cell and selected-section controls are also addressed by ID.
  for (const field of fields) {
    const id = field.dataset.field === 'material' ? 'material-select'
      : field.dataset.field === 'cell' ? 'cell-select'
      : field.dataset.field === 'selectedSectionId' ? 'selected-section' : null;
    if (id) nodes.set(id, field);
  }
  const metrics = ['fault-current', 'fault-temperature', 'continuous-temperature', 'section-count'].map(id => nodes.get(id));
  globalThis.document = {
    querySelector: selector => nodes.get(selector.slice(1)) || null,
    querySelectorAll: selector => ({
      '[data-field]': fields, '[data-material]': materialFields, '[data-cell]': cellFields,
      '[role="tab"]': [nodes.get('fault-tab'), nodes.get('continuous-tab')],
      '.metric-value': metrics
    }[selector] || []),
    createElement: tag => new Element(tag), createElementNS: (_namespace, tag) => new Element(tag)
  };
  const saved = new Map();
  globalThis.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  globalThis.window = { addEventListener() {}, print() {} };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;

  await import('../app.mjs');
  assert.match(nodes.get('fault-current').textContent, /18,957/);
  assert.equal(nodes.get('fault-body').children.length, 13);
  assert.match(nodes.get('print-report').textContent, /Short-circuit results/);
  assert.match(nodes.get('print-report').textContent, /Continuous-current results/);

  for (let i = 4; i < 13; i++) {
    const checkbox = nodes.get('geometry-body').children[i].children[0].children[0];
    checkbox.checked = false; checkbox.dispatch('change');
  }
  assert.equal(nodes.get('fault-body').children.length, 4);
  assert.equal(nodes.get('continuous-body').children.length, 4);
  assert.doesNotMatch(nodes.get('print-report').textContent, /Custom 9/);

  const series = fields.find(field => field.dataset.field === 'series');
  series.value = '48'; series.dispatch('input');
  assert.doesNotMatch(nodes.get('fault-current').textContent, /18,957/);

  nodes.get('preview-btn').dispatch('click');
  assert.equal(nodes.get('report-dialog').open, true);
});
