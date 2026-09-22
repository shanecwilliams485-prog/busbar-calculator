import { calculate, freshDefaults, validate } from './calculations.mjs';

const STORAGE_KEY = 'volt-busbar-designer-v1';
let state = loadState();
let latest = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = (value, digits = 1) => Number.isFinite(value)
  ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
  : '—';
const compact = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 5 }).format(value)
  : '—';
const set = (selector, content) => { $(selector).textContent = content; };

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.sections) && stored.materials && stored.cells && !validate(stored).length) return stored;
  } catch { /* A fresh design is safe when browser storage is unavailable. */ }
  return freshDefaults();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); set('#save-status', 'Saved in this browser'); }
  catch { set('#save-status', 'Browser storage unavailable · export to save'); }
}

function option(label, value) {
  const item = document.createElement('option');
  item.value = value; item.textContent = label;
  return item;
}

function populateOptions() {
  const materialSelect = $('#material-select');
  const cellSelect = $('#cell-select');
  materialSelect.replaceChildren(...Object.keys(state.materials).map(key => option(key, key)));
  cellSelect.replaceChildren(...Object.keys(state.cells).map(key => option(key, key)));
  populateSections();
}

function populateSections() {
  const select = $('#selected-section');
  select.replaceChildren(...state.sections.filter(s => s.included).map(s => option(s.name || 'Unnamed', s.id)));
  if (!state.sections.some(s => s.id === state.selectedSectionId && s.included)) {
    state.selectedSectionId = state.sections.find(s => s.included)?.id || '';
  }
  select.value = state.selectedSectionId;
}

function syncFields() {
  $$('[data-field]').forEach(input => { input.value = state[input.dataset.field]; });
  $$('[data-material]').forEach(input => { input.value = state.materials[state.material][input.dataset.material]; });
  $$('[data-cell]').forEach(input => { input.value = state.cells[state.cell][input.dataset.cell]; });
}

function numberFrom(input) { return input.value.trim() === '' ? NaN : Number(input.value); }

$$('[data-field]').forEach(input => input.addEventListener('input', () => {
  const key = input.dataset.field;
  state[key] = input.tagName === 'SELECT' ? input.value : numberFrom(input);
  if (key === 'material' || key === 'cell') syncFields();
  refresh();
}));
$$('[data-material]').forEach(input => input.addEventListener('input', () => {
  state.materials[state.material][input.dataset.material] = numberFrom(input);
  refresh();
}));
$$('[data-cell]').forEach(input => input.addEventListener('input', () => {
  state.cells[state.cell][input.dataset.cell] = numberFrom(input);
  refresh();
}));

function cell(text, className = '') {
  const td = document.createElement('td');
  td.textContent = text;
  td.className = className;
  return td;
}
function badge(pass) {
  const span = document.createElement('span');
  span.className = `pill ${pass ? 'pass' : 'fail'}`;
  span.textContent = pass ? 'PASS' : 'FAIL';
  return span;
}
function resultRow(values, pass) {
  const tr = document.createElement('tr');
  tr.replaceChildren(...values.map(value => cell(value)), (() => {
    const td = document.createElement('td'); td.append(badge(pass)); return td;
  })());
  return tr;
}
function detail(label, value) {
  const div = document.createElement('div');
  const caption = document.createElement('span'); caption.textContent = label;
  const figure = document.createElement('strong'); figure.textContent = value;
  div.append(caption, figure); return div;
}

function renderResults(r) {
  set('#fault-current', `${fmt(r.faultCurrent, 0)} A`);
  set('#fault-temperature', `${fmt(r.selected.fault.finalC)} °C`);
  set('#fault-section-name', r.selected.name);
  const faultVerdict = $('#fault-verdict');
  faultVerdict.textContent = r.selected.fault.pass ? 'PASS' : 'FAIL';
  faultVerdict.className = `pill ${r.selected.fault.pass ? 'pass' : 'fail'}`;
  set('#continuous-temperature', `${fmt(r.hottest.continuous.finalC)} °C`);
  set('#hottest-name', r.hottest.name);
  const contVerdict = $('#continuous-verdict');
  contVerdict.textContent = r.continuousPass ? 'PASS' : 'FAIL';
  contVerdict.className = `pill ${r.continuousPass ? 'pass' : 'fail'}`;
  set('#section-count', `${r.sections.length - r.failCount} / ${r.sections.length}`);
  set('#section-count-caption', `${r.failCount} section${r.failCount === 1 ? '' : 's'} exceed the continuous temperature limit`);
  set('#pack-voltage', `${fmt(r.packVoltage)} V`);
  set('#selected-description', `${r.selected.name} · ${fmt(r.selected.areaMm2, 2)} mm² · ÷${compact(r.selected.divisor)} current`);
  set('#curve-name', r.selected.name);

  const parts = [
    ['External short', r.resistance.external], ['Cells', r.resistance.cells],
    ['Main busbar', r.resistance.busbar], ['Welds', r.resistance.welds],
    ['Other', r.resistance.other], ['Total loop', r.resistance.total]
  ];
  $('#resistance-table').replaceChildren(...parts.map(([label, ohms], i) => {
    const div = document.createElement('div');
    div.className = i === parts.length - 1 ? 'resistance-row total' : 'resistance-row';
    const a = document.createElement('span'); a.textContent = label;
    const b = document.createElement('strong'); b.textContent = `${fmt(ohms * 1000, 3)} mΩ`;
    div.append(a, b); return div;
  }));
  $('#selected-metrics').replaceChildren(
    detail('Section fault current', `${fmt(r.selected.fault.currentA)} A`),
    detail('Current density', `${fmt(r.selected.fault.densityAmm2)} A/mm²`),
    detail('Temperature rise', `${fmt(r.selected.fault.riseK, 2)} K`),
    detail('Margin to limit', `${fmt(r.selected.fault.marginK, 2)} K`),
    detail('Max clearing time', `${fmt(r.selected.fault.maxClearingMs, 3)} ms`),
    detail('Fault I²t / section withstand', `${fmt(r.selected.fault.i2tFault, 2)} / ${fmt(r.selected.fault.i2tWithstand, 2)} A²s`)
  );
  const insight = $('#adiabatic-note');
  insight.textContent = `${r.selected.fault.adiabaticValid ? 'Workbook check: conduction negligible' : 'Workbook check: conduction significant; adiabatic estimate is conservative'}. Diffusion length ${fmt(r.diffusionMm, 3)} mm vs feature length / 3 = ${fmt(r.selected.length / 3, 3)} mm.`;
  insight.classList.toggle('caution', !r.selected.fault.adiabaticValid);
  $('#fault-body').replaceChildren(...r.sections.map(s => resultRow([
    s.name, fmt(s.areaMm2, 2), fmt(s.fault.currentA), fmt(s.fault.densityAmm2, 2),
    fmt(s.fault.riseK, 2), fmt(s.fault.finalC, 2), fmt(s.fault.maxClearingMs, 3)
  ], s.fault.pass)));
  $('#continuous-body').replaceChildren(...r.sections.map(s => resultRow([
    s.name, fmt(s.areaMm2, 2), fmt(s.continuous.currentA), fmt(s.continuous.densityAmm2, 2),
    fmt(s.continuous.heatWm, 2), fmt(s.continuous.tauS, 2),
    fmt(s.continuous.finalC, 2), fmt(s.continuous.steadyC, 2)
  ], s.continuous.pass)));
  set('#overview-note', `Selected short-circuit section: ${r.selected.name} · ${r.selected.fault.pass ? 'PASS' : 'FAIL'}. ${r.sections.filter(s => !s.fault.pass).length} of ${r.sections.length} included sections fail the short-circuit check; view both tables for all results.`);
  renderCurve(r);
}

function geometryInput(section, key, type, min = null) {
  const input = document.createElement('input');
  input.type = type; input.setAttribute('aria-label', `${section.name} ${key}`);
  if (type === 'number') { input.step = 'any'; if (min !== null) input.min = min; }
  input.value = section[key];
  input.addEventListener('input', () => {
    section[key] = type === 'number' ? numberFrom(input) : input.value;
    if (key === 'name') { populateSections(); } // Preserve text input focus.
    refresh();
  });
  return input;
}

function renderGeometry() {
  $('#geometry-body').replaceChildren(...state.sections.map(section => {
    const tr = document.createElement('tr');
    const include = document.createElement('input');
    include.type = 'checkbox'; include.checked = section.included;
    include.setAttribute('aria-label', `Include ${section.name}`);
    include.addEventListener('change', () => {
      section.included = include.checked;
      populateSections(); refresh();
    });
    const includeTd = document.createElement('td'); includeTd.append(include);
    const fields = [['name', 'text'], ['width', 'number'], ['thickness', 'number'], ['divisor', 'number'], ['length', 'number']]
      .map(([key, type]) => { const td = document.createElement('td'); td.append(geometryInput(section, key, type, type === 'number' ? 0 : null)); return td; });
    const action = document.createElement('td'); action.className = 'no-print';
    if (section.id.startsWith('added-')) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'small-action'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${section.name}`);
      remove.addEventListener('click', () => {
        state.sections = state.sections.filter(s => s.id !== section.id);
        populateSections(); renderGeometry(); refresh();
      });
      action.append(remove);
    }
    tr.append(includeTd, ...fields, action); return tr;
  }));
}

function svg(tag, attributes = {}, content = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (content) node.textContent = content;
  return node;
}
function renderCurve(r) {
  const chart = $('#curve-chart');
  const s = r.selected.continuous;
  const width = 560, left = 56, right = 18, top = 18, bottom = 34;
  const plotW = width - left - right, plotH = 250 - top - bottom;
  const minY = Math.min(state.ambientC, state.limitC, s.finalC);
  const maxY = Math.max(state.ambientC, state.limitC, s.finalC);
  const pad = Math.max((maxY - minY) * 0.12, 3);
  const low = minY - pad, high = maxY + pad;
  const x = t => left + (t / state.durationS) * plotW;
  const y = temp => top + (high - temp) / (high - low) * plotH;
  const nodes = [];
  for (let i = 0; i <= 4; i++) {
    const temp = low + (high - low) * i / 4;
    const yy = y(temp);
    nodes.push(svg('line', { x1: left, x2: left + plotW, y1: yy, y2: yy, stroke: '#dce8dd' }));
    nodes.push(svg('text', { x: left - 10, y: yy + 4, 'text-anchor': 'end', class: 'axis-label' }, fmt(temp, 0)));
  }
  nodes.push(svg('line', { x1: left, x2: left + plotW, y1: y(state.limitC), y2: y(state.limitC), stroke: '#e18f51', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
  let path = '';
  for (let i = 0; i <= 100; i++) {
    const t = state.durationS * i / 100;
    const temp = state.ambientC + s.riseSteadyK * (1 - Math.exp(-t / s.tauS));
    path += `${i ? ' L' : 'M'}${x(t).toFixed(2)} ${y(temp).toFixed(2)}`;
  }
  nodes.push(svg('path', { d: path, fill: 'none', stroke: '#36aa63', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  nodes.push(svg('circle', { cx: x(state.durationS), cy: y(s.finalC), r: 5, fill: '#36aa63' }));
  nodes.push(svg('text', { x: left, y: 246, class: 'axis-label' }, '0 s'));
  nodes.push(svg('text', { x: left + plotW, y: 246, class: 'axis-label', 'text-anchor': 'end' }, `${fmt(state.durationS, 0)} s`));
  chart.replaceChildren(...nodes);
}

function refresh() {
  latest = calculate(state);
  const banner = $('#error-banner');
  if (latest.errors.length) {
    banner.hidden = false; banner.textContent = latest.errors.join(' ');
    // Never show prior results alongside invalid inputs.
    $$('.metric-value').forEach(el => { el.textContent = '—'; });
    $('#fault-body').replaceChildren(); $('#continuous-body').replaceChildren();
    $('#selected-metrics').replaceChildren(); $('#resistance-table').replaceChildren();
    $('#curve-chart').replaceChildren();
    for (const selector of ['#pack-voltage', '#fault-section-name', '#hottest-name', '#section-count-caption', '#selected-description', '#adiabatic-note', '#overview-note']) set(selector, '—');
    for (const selector of ['#fault-verdict', '#continuous-verdict']) { set(selector, '—'); $(selector).className = 'pill'; }
  } else {
    banner.hidden = true; renderResults(latest);
  }
  saveState();
}

function download(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#add-section').addEventListener('click', () => {
  const id = `added-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  state.sections.push({ id, name: 'New section', width: 4, thickness: 0.5, divisor: 1, length: 30, included: true });
  populateSections(); renderGeometry(); refresh();
});
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Reset this design to the spreadsheet example? Export first if you want to keep your changes.')) return;
  state = freshDefaults(); populateOptions(); syncFields(); renderGeometry(); refresh();
});
$('#export-btn').addEventListener('click', () => download('volt-busbar-design.json', JSON.stringify({ format: 'volt-busbar-designer-v1', design: state }, null, 2), 'application/json'));
$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (imported.format !== 'volt-busbar-designer-v1' || validate(imported.design).length) throw new Error('Design file is incomplete or contains invalid inputs.');
    state = imported.design;
    populateOptions(); syncFields(); renderGeometry(); refresh();
  } catch (error) { alert(`Could not import design: ${error.message}`); }
  event.target.value = '';
});
$('#print-btn').addEventListener('click', () => window.print());
$('#csv-btn').addEventListener('click', () => {
  if (!latest || latest.errors.length) return;
  const quote = val => `"${String(val).replaceAll('"', '""')}"`;
  const header = ['Section', 'Area mm2', 'Fault current A', 'Fault density A/mm2', 'Fault rise K', 'Fault final C', 'Max clearing ms', 'Fault pass', 'Continuous current A', 'Continuous density A/mm2', 'Heat W/m', 'Time constant s', 'Continuous final C', 'Steady-state C', 'Continuous pass'];
  const rows = latest.sections.map(s => [s.name, s.areaMm2, s.fault.currentA, s.fault.densityAmm2, s.fault.riseK, s.fault.finalC, s.fault.maxClearingMs, s.fault.pass, s.continuous.currentA, s.continuous.densityAmm2, s.continuous.heatWm, s.continuous.tauS, s.continuous.finalC, s.continuous.steadyC, s.continuous.pass]);
  download('volt-busbar-results.csv', '\ufeff' + [header, ...rows].map(row => row.map(quote).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
});
$$('[role="tab"]').forEach(tab => tab.addEventListener('click', () => {
  $$('[role="tab"]').forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  $('#fault-pane').hidden = tab.id !== 'fault-tab';
  $('#continuous-pane').hidden = tab.id !== 'continuous-tab';
}));

populateOptions(); syncFields(); renderGeometry(); refresh();
