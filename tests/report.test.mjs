import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, freshDefaults } from '../calculations.mjs';
import { buildReportData } from '../report-data.mjs';

test('PDF report includes both assessments and no unticked sections', () => {
  const design = freshDefaults();
  design.sections.filter(s => s.id.startsWith('custom-')).forEach(s => { s.included = false; });
  const report = buildReportData(design, calculate(design));
  assert.equal(report.sectionCount, 4);
  assert.equal(report.geometry.length, 4);
  assert.equal(report.faultRows.length, 4);
  assert.equal(report.continuousRows.length, 4);
  assert.ok(report.geometry.every(row => !row[0].startsWith('Custom')));
  assert.ok(report.faultRows.every(row => !row[0].startsWith('Custom')));
  assert.ok(report.continuousRows.every(row => !row[0].startsWith('Custom')));
  assert.equal(report.summary.faultPass, true);
  assert.equal(report.summary.continuousPass, false);
  assert.equal(report.summary.continuousFailCount, 1);
  assert.ok(report.inputs.flatMap(group => group.items).some(([label]) => label === 'Heat transfer coefficient'));
  assert.ok(report.inputs.flatMap(group => group.items).some(([label]) => label === 'Clearing time'));
});
