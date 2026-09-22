// The report is built from the same calculated result as the screen.
// Sections excluded from the calculation are absent from every report table.
export function buildReportData(input, result) {
  if (result.errors?.length) return { errors: result.errors };
  const m = input.materials[input.material];
  const c = input.cells[input.cell];
  const sectionCount = result.sections.length;
  const faultFailCount = result.sections.filter(section => !section.fault.pass).length;

  return {
    errors: [],
    sectionCount,
    summary: {
      faultPass: result.shortPass,
      faultFailCount,
      continuousPass: result.continuousPass,
      continuousFailCount: result.failCount,
      faultCurrentA: result.faultCurrent,
      voltageV: result.packVoltage,
      selectedName: result.selected.name,
      selectedFinalC: result.selected.fault.finalC,
      hottestName: result.hottest.name,
      hottestFinalC: result.hottest.continuous.finalC
    },
    inputs: [
      { title: 'Pack and conductor', items: [
        ['Material', input.material], ['Cell', input.cell], ['Series / parallel', `${input.series}S / ${input.parallel}P`],
        ['Cell DCIR', `${c.dcir} mΩ`], ['Cell max voltage', `${c.voltage} V`],
        ['Main busbar length', `${input.spineLengthM} m`], ['Main busbar loop area', `${input.spineAreaMm2} mm²`],
        ['Weld resistance per cell', `${input.weldMilliOhm} mΩ`], ['Other series resistance', `${input.otherMilliOhm} mΩ`]
      ] },
      { title: 'Operating conditions', items: [
        ['External short resistance', `${input.externalMilliOhm} mΩ`],
        ['Hot-start temperature', `${input.hotStartC} °C`], ['Clearing time', `${input.clearingMs} ms`],
        ['Temperature limit', `${input.limitC} °C`], ['Continuous pack current', `${input.continuousA} A`],
        ['Continuous duration', `${input.durationS} s`], ['Ambient / start temperature', `${input.ambientC} °C`],
        ['Heat transfer coefficient', `${input.heatTransfer} W/m²·K`]
      ] },
      { title: `Selected material properties · ${input.material}`, items: [
        ['Resistivity at 20 °C', `${m.rho20} Ω·m`], ['Specific heat', `${m.cp} J/kg·K`],
        ['Density', `${m.density} kg/m³`], ['Temperature coefficient', `${m.alpha} 1/K`],
        ['Thermal conductivity', `${m.k} W/m·K`]
      ] }
    ],
    geometry: result.sections.map(s => [s.name, s.width, s.thickness, s.divisor, s.length, s.areaMm2]),
    faultRows: result.sections.map(s => [s.name, s.areaMm2, s.fault.currentA, s.fault.densityAmm2,
      s.fault.riseK, s.fault.finalC, s.fault.maxClearingMs, s.fault.pass]),
    continuousRows: result.sections.map(s => [s.name, s.areaMm2, s.continuous.currentA, s.continuous.densityAmm2,
      s.continuous.heatWm, s.continuous.tauS, s.continuous.finalC, s.continuous.steadyC, s.continuous.pass]),
    resistance: [
      ['External', result.resistance.external * 1000], ['Cells', result.resistance.cells * 1000],
      ['Main busbar', result.resistance.busbar * 1000], ['Welds', result.resistance.welds * 1000],
      ['Other', result.resistance.other * 1000], ['Total loop', result.resistance.total * 1000]
    ]
  };
}
