# Volt Energy Systems · Busbar Designer

A static, GitHub-ready web app based on `Busbar Heating Calulator COPY.xlsx`. It models the workbook's short-circuit fault loop, adiabatic heating and lumped continuous-current heating for every included busbar section. The logo is copied from the workbook. It runs locally in the browser without an account, server, or API.

## Publish

1. Extract this ZIP. Upload **the contents of `volt-busbar-designer`** to the root of a new GitHub repository (`index.html`, `app.mjs`, `calculations.mjs`, `styles.css`, `assets/`, etc.).
2. On Netlify, import the GitHub repository as a new site. Build command: **leave blank**. Publish directory: **`.`** (repository root). Deploy.
3. Or use GitHub Pages: Repository **Settings → Pages → Deploy from a branch → main → / (root)**. Files are relative so a project URL works.

To preview on your PC, open a terminal in this directory and run `python -m http.server 8000`, then visit `http://localhost:8000`. Browsers generally block module imports when opened directly as `file://`.

There is no `npm install` or build step for publishing. `app.mjs` is a self-contained browser file; `npm test` rebuilds it and runs the optional Node.js checks without dependencies. When updating the app, upload all files in this folder, especially `index.html`, `app.mjs`, `styles.css`, and `print.css`.

## Using the design tool

- Inputs are grouped into Pack & material, Short-circuit scenario, Continuous operation, and Section geometry.
- You can edit the material properties and the selected cell's DCIR/voltage in the expanded material panel and main pack panel. These values are stored in the browser for this design.
- Section widths, thicknesses, current divisors and feature lengths follow the workbook's table. The nine “Custom” rows are **included by default**, just like the workbook. Exclude or edit example sections that do not represent real geometry; leaving them included changes the overall verdict.
- Export a design to JSON for a portable backup and import it later; download CSV results, or use **Preview PDF report** and **Print / save PDF**. The report is a separate layout with both short-circuit and continuous summaries and result tables. It contains only sections ticked into the calculation; unused section boxes and alternate material/cell presets do not appear. Auto-save uses local browser storage only; clearing browser data removes it.

## Calculation mapping

The `calculations.mjs` comments give the source cells. For example, the pack fault current comes from `C19 = C18/(C12+C17)`. Material and cell presets are the workbook's entries in columns AE:AJ and AL:AN. Temperature rise for each section follows `F45:F57`; continuous temperature follows `J69:J81`. The test file compares output against the workbook's cached values at the saved design, including 18,957.4519 A fault current, 74.694 °C for the selected tab rim, and 10 of 13 continuous sections over the 80 °C limit.

The workbook treats **main busbar loop area** (`K7`, 70 mm²) independently of the **main spine geometry** (`AF12 × AG12`, 62 mm²). Both inputs are preserved separately. It also calculates the selected short-circuit result independently of the overall continuous-current check. The app additionally displays the short-circuit outcome for all included sections.

## Engineering limitations carried over from the workbook

- Fault current uses a constant cell DCIR and maximum open-circuit voltage. Cell voltage collapse, fault-current dynamics, joints, and resistance rise while heating are outside the model.
- The adiabatic model holds the initial-temperature resistivity fixed during the fault. Its heat-conduction check is the workbook's diffusion-length comparison; it does not validate geometry, thermal contacts, or protection-device let-through.
- The continuous model fixes conductor resistivity at ambient, treats every rectangular face as exposed to the selected heat-transfer coefficient, and neglects axial conduction and weld heat. This can understate heating when resistivity increases, faces are masked, or welds dominate.
- Material properties, cell DCIR, heat transfer, clearance time, temperature limit and section dimensions are workbook examples or assumptions, not verified specifications. Confirm against actual materials, cells, CAD and protection-device data before design approval.
- The workbook references R100.5 Annex 9F. This app reproduces its arithmetic; it is **not** a certification or a complete regulatory test method.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout and input fields |
| `styles.css` | Responsive green Volt styling and print layout |
| `print.css` | Separate PDF report layout |
| `report-data.mjs` | Report content derived from included calculation sections |
| `app.mjs` | Self-contained browser code; upload this file with the page |
| `calculations.mjs` | Pure calculation and validation functions |
| `src/app-ui.mjs` | Source for browser interaction, autosave, exports and chart |
| `build.mjs` | Regenerates the self-contained `app.mjs` from source files |
| `assets/volt-logo.png` | Company logo extracted from the supplied workbook |
| `tests/calculations.test.mjs` | Workbook-output comparisons and edge checks |
