import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, freshDefaults } from '../calculations.mjs';

const near = (actual, expected, label) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-10),
  `${label}: expected ${expected}, received ${actual}`
);

test('supplied workbook cached values match the web formulas at its saved inputs', () => {
  const result = calculate(freshDefaults());
  assert.deepEqual(result.errors, []);
  near(result.resistance.cells, 0.018857142857142857, 'C13 cell resistance');
  near(result.resistance.busbar, 0.0005686811428571429, 'C14 busbar resistance');
  near(result.resistance.welds, 0.0003428571428571429, 'C15 weld resistance');
  near(result.resistance.internal, 0.020268681142857143, 'C17 internal resistance');
  near(result.packVoltage, 403.20000000000005, 'C18 voltage');
  near(result.faultCurrent, 18957.4519121234, 'C19 fault current');
  near(result.selected.fault.riseK, 14.693981575791366, 'C33 selected rise');
  near(result.selected.fault.finalC, 74.69398157579137, 'C34 selected final temp');
  near(result.selected.fault.maxClearingMs, 2.722202950485579, 'C37 clearing time');
  near(result.selected.fault.i2tFault, 916.7984260216101, 'C38 let-through');
  near(result.selected.fault.i2tWithstand, 1247.855690158281, 'C39 withstand');
  near(result.diffusionMm, 0.4815713303308872, 'C40 diffusion');
  assert.equal(result.selected.fault.adiabaticValid, true);
  near(result.sections[0].fault.finalC, 61.078883808520125, 'G45 main spine fault');
  near(result.sections[1].fault.finalC, 76.71848570401151, 'G46 branch fault');
  near(result.sections[4].fault.finalC, 124.80045874923995, 'G49 custom fault');
  near(result.sections[0].continuous.finalC, 30.14792765446301, 'J69 main spine continuous');
  near(result.sections[1].continuous.finalC, 97.08499512888888, 'J70 branch continuous');
  near(result.sections[3].continuous.finalC, 61.72808855072464, 'J72 rim continuous');
  near(result.hottest.continuous.finalC, 852.8511159333333, 'D84 hottest temperature');
  assert.equal(result.failCount, 10);
  assert.equal(result.hottest.name, 'Custom');
  assert.equal(result.continuousPass, false);
  assert.equal(result.selected.fault.pass, true);
});

test('excluding workbook template sections removes them from the overall checks', () => {
  const design = freshDefaults();
  design.sections.filter(s => s.id.startsWith('custom-')).forEach(s => { s.included = false; });
  const result = calculate(design);
  assert.equal(result.sections.length, 4);
  assert.equal(result.failCount, 1);
  assert.equal(result.hottest.name, '4-cell branch leg');
  assert.equal(result.shortPass, true);
});

test('raising heat transfer changes continuous results but leaves short circuit unchanged', () => {
  const design = freshDefaults();
  const before = calculate(design);
  design.heatTransfer *= 2;
  const after = calculate(design);
  assert.ok(after.sections[0].continuous.finalC < before.sections[0].continuous.finalC);
  near(after.faultCurrent, before.faultCurrent, 'fault current');
  near(after.selected.fault.finalC, before.selected.fault.finalC, 'short-circuit result');
});

test('invalid geometry and temperature limits return errors instead of a pass', () => {
  const design = freshDefaults();
  design.sections[0].thickness = 0;
  design.limitC = design.hotStartC;
  const result = calculate(design);
  assert.ok(result.errors.some(e => e.includes('thickness')));
  assert.ok(result.errors.some(e => e.includes('Limit temperature')));
  assert.equal(result.sections, undefined);
});
