// Direct translation of the calculations in Busbar Heating Calulator COPY.xlsx.
// Inputs use mm, mm², mΩ, ms and °C in the UI; convert to SI at the formula boundary.
export const workbookDefaults = {
  material: 'Copper',
  cell: 'Reliance RS60',
  materials: {
    Copper: { rho20: 1.72e-8, cp: 385, density: 8960, alpha: 0.00393, k: 400 },
    Aluminium: { rho20: 2.82e-8, cp: 900, density: 2700, alpha: 0.00403, k: 237 },
    Nickel: { rho20: 6.99e-8, cp: 440, density: 8908, alpha: 0.006, k: 90 }
  },
  cells: {
    'Molicell P60C': { dcir: 27.5, voltage: 4.2 },
    'Molicell M65A': { dcir: 14.5, voltage: 4.2 },
    'FEB 68E': { dcir: 16, voltage: 4.2 },
    'Reliance RS60': { dcir: 5.5, voltage: 4.2 }
  },
  series: 96, parallel: 28, spineLengthM: 2, spineAreaMm2: 70,
  weldMilliOhm: 0.1, otherMilliOhm: 0.5, hotStartC: 60,
  externalMilliOhm: 1, clearingMs: 2, limitC: 80,
  continuousA: 476, durationS: 2000, ambientC: 25, heatTransfer: 50,
  selectedSectionId: 'tab-rim',
  sections: [
    { id: 'spine', name: 'Main spine', width: 124, thickness: 0.5, divisor: 1, length: 100, included: true },
    { id: 'branch', name: '4-cell branch leg', width: 4.5, thickness: 0.5, divisor: 7, length: 30, included: true },
    { id: 'feed', name: 'Tab feed', width: 5, thickness: 0.3, divisor: 28, length: 6, included: true },
    { id: 'tab-rim', name: 'Tab rim section', width: 2, thickness: 0.3, divisor: 28, length: 2, included: true },
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `custom-${i + 1}`, name: i ? `Custom ${i + 1}` : 'Custom',
      width: 4, thickness: 2, divisor: 1, length: 30, included: true
    }))
  ]
};

export function freshDefaults() { return structuredClone(workbookDefaults); }

const finite = (x) => Number.isFinite(x);
const positive = (x) => finite(x) && x > 0;
const nonnegative = (x) => finite(x) && x >= 0;

export function validate(input) {
  const errors = [];
  const material = input.materials?.[input.material];
  const cell = input.cells?.[input.cell];
  if (!material) errors.push('Choose an available material.');
  if (!cell) errors.push('Choose an available cell.');
  for (const [key, label] of [
    ['rho20', 'Resistivity'], ['cp', 'Specific heat'], ['density', 'Density'],
    ['k', 'Thermal conductivity']
  ]) if (material && !positive(material[key])) errors.push(`${label} must be greater than zero.`);
  if (material && (!finite(material.alpha) || material.alpha < 0)) errors.push('Temperature coefficient must be zero or greater.');
  if (cell && !positive(cell.dcir)) errors.push('Cell DCIR must be greater than zero.');
  if (cell && !positive(cell.voltage)) errors.push('Cell maximum voltage must be greater than zero.');
  for (const [key, label] of [
    ['series', 'Series count'], ['parallel', 'Parallel count']
  ]) if (!Number.isSafeInteger(input[key]) || input[key] <= 0) errors.push(`${label} must be a positive whole number.`);
  for (const [key, label] of [
    ['spineLengthM', 'Main busbar length'], ['spineAreaMm2', 'Main busbar area'],
    ['clearingMs', 'Clearing time'], ['durationS', 'Continuous duration'],
    ['heatTransfer', 'Heat transfer coefficient']
  ]) if (!positive(input[key])) errors.push(`${label} must be greater than zero.`);
  for (const [key, label] of [
    ['weldMilliOhm', 'Weld resistance'], ['otherMilliOhm', 'Other resistance'],
    ['externalMilliOhm', 'External resistance'], ['continuousA', 'Continuous current']
  ]) if (!nonnegative(input[key])) errors.push(`${label} must be zero or greater.`);
  if (!finite(input.hotStartC) || !finite(input.ambientC) || !finite(input.limitC)) errors.push('Temperatures must be finite numbers.');
  if (finite(input.limitC) && finite(input.hotStartC) && input.limitC <= input.hotStartC) errors.push('Limit temperature must exceed hot-start temperature.');
  if (finite(input.limitC) && finite(input.ambientC) && input.limitC <= input.ambientC) errors.push('Limit temperature must exceed ambient temperature.');
  if (!Array.isArray(input.sections) || !input.sections.some(s => s.included)) errors.push('Include at least one section.');
  if (Array.isArray(input.sections)) {
    const ids = new Set();
    for (const section of input.sections) {
      if (ids.has(section.id)) errors.push('Section IDs must be unique.');
      ids.add(section.id);
      if (!section.included) continue;
      if (!String(section.name || '').trim()) errors.push('Included sections need a name.');
      for (const [key, label] of [['width', 'width'], ['thickness', 'thickness'], ['divisor', 'current divisor'], ['length', 'feature length']]) {
        if (!positive(section[key])) errors.push(`${section.name || 'Section'} ${label} must be greater than zero.`);
      }
    }
    if (!input.sections.some(s => s.id === input.selectedSectionId && s.included)) errors.push('Select an included section for the detailed short-circuit result.');
  }
  if (material && finite(input.hotStartC) && material.rho20 * (1 + material.alpha * (input.hotStartC - 20)) <= 0) errors.push('Resistivity at hot-start temperature must be positive.');
  if (material && finite(input.ambientC) && material.rho20 * (1 + material.alpha * (input.ambientC - 20)) <= 0) errors.push('Resistivity at ambient must be positive.');
  return errors;
}

export function calculate(input) {
  const errors = validate(input);
  if (errors.length) return { errors };
  const m = input.materials[input.material];
  const c = input.cells[input.cell];
  const rhoHot = m.rho20 * (1 + m.alpha * (input.hotStartC - 20)); // C32
  const rhoAmbient = m.rho20 * (1 + m.alpha * (input.ambientC - 20)); // C66
  const resistance = {
    external: input.externalMilliOhm / 1000, // C12
    cells: c.dcir * input.series / input.parallel / 1000, // C13
    busbar: rhoHot * input.spineLengthM / (input.spineAreaMm2 / 1e6), // C14
    welds: input.series * input.weldMilliOhm / input.parallel / 1000, // C15
    other: input.otherMilliOhm / 1000 // C16
  };
  resistance.internal = resistance.cells + resistance.busbar + resistance.welds + resistance.other; // C17
  resistance.total = resistance.internal + resistance.external;
  const packVoltage = c.voltage * input.series; // C18
  const faultCurrent = packVoltage / resistance.total; // C19
  const diffusionMm = Math.sqrt(m.k / (m.density * m.cp) * input.clearingMs / 1000) * 1000; // C40
  const sections = input.sections.filter(s => s.included).map(s => {
    const area = s.width * s.thickness; // C45
    const faultA = faultCurrent / s.divisor; // D45
    const faultDensity = faultA / area; // E45
    const riseK = rhoHot * (faultDensity * 1e6) ** 2 * (input.clearingMs / 1000) / (m.density * m.cp); // F45
    const finalC = input.hotStartC + riseK; // G45
    const maxClearingMs = (input.limitC - input.hotStartC) * m.density * m.cp / (rhoHot * (faultDensity * 1e6) ** 2) * 1000; // H45
    const fault = {
      currentA: faultA, densityAmm2: faultDensity, riseK, finalC, maxClearingMs,
      marginK: input.limitC - finalC, pass: finalC <= input.limitC,
      i2tFault: faultA ** 2 * input.clearingMs / 1000, // C38
      i2tWithstand: m.density * m.cp * (area / 1e6) ** 2 * (input.limitC - input.hotStartC) / rhoHot, // C39
      adiabaticValid: diffusionMm < s.length / 3 // C41
    };
    const currentA = input.continuousA / s.divisor; // D69
    const perimeterMm = 2 * (s.width + s.thickness); // F69
    const heatWm = currentA ** 2 * rhoAmbient / (area / 1e6); // G69
    const tauS = m.density * (area / 1e6) * m.cp / (input.heatTransfer * (perimeterMm / 1000)); // H69
    const riseSteadyK = heatWm / (input.heatTransfer * (perimeterMm / 1000)); // I69
    const continuousC = input.ambientC + riseSteadyK * (1 - Math.exp(-input.durationS / tauS)); // J69
    const steadyC = input.ambientC + riseSteadyK; // K69
    return { ...s, areaMm2: area, fault,
      continuous: {
        currentA, densityAmm2: currentA / area, perimeterMm, heatWm, tauS,
        riseSteadyK, finalC: continuousC, steadyC,
        marginK: input.limitC - continuousC, pass: continuousC <= input.limitC
      }
    };
  });
  const selected = sections.find(s => s.id === input.selectedSectionId);
  const hottest = sections.reduce((a, s) => s.continuous.finalC > a.continuous.finalC ? s : a);
  const failCount = sections.filter(s => !s.continuous.pass).length;
  return {
    errors: [], rhoHot, rhoAmbient, resistance, packVoltage, faultCurrent, diffusionMm,
    sections, selected, hottest, failCount,
    shortPass: sections.every(s => s.fault.pass),
    continuousPass: failCount === 0
  };
}
