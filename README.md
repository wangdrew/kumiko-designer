# Kumiko Studio

A fully client-side JavaScript designer for rectangular Kumiko panels. Open **index.html** in a current browser; no build, server, account, or network connection is needed. Keep the `js` directory and `style.css` beside it. It also works on any static host.

## Designing

- Choose sides-at-corners or vertices-at-corners, then X/Y counts and Jigumi pitch in millimeters. X counts triangle-altitude columns; Y counts full triangle-side pitches. The lattice is 3 mm wide; the surrounding frame is fixed at 8 mm.
- Mitsuke controls the visible width of the insert strips, from 0.5 to 8 mm (default 3 mm). It updates the palette, placed inserts and SVG export, and is saved with the design. Hover the Pitch or Mitsuke label/input for a plain-language explanation. The board lattice and print depth are separate from this setting. At thicker settings, narrow openings can close as neighboring strips merge.
- Set board and empty-space colors using palette popovers with Bambu PLA Matte, PLA Basic, and Custom sets, or their free color pickers. Use **+ Custom color** in the insert palette (or the frame palette popovers) to add a named hex color. The Custom set is shared across all three targets and saved with the design, including unused custom colors. Defaults are `#BF9E82` and `#EBEBE3`.
- The palette contains insert 0 (clear) and STL designs 1–40. Designs 10, 11, 12, 13, 16 and 40 have an orange exclamation badge; hover for the glue requirement. The printed parts list also identifies these designs. Select from 55 Bambu PLA Basic and Matte colors; every palette preview updates, while previously placed inserts retain their color.
- Drag an insert onto a triangle, or select triangles and click a palette insert. When there is a selection, dropping onto the board fills the selection. Inserts are unlimited.
- Choose **Cursor** for box selection or **Pencil** to select triangles along a freeform drag without a selection box. Pencil strokes replace the selection; hold Command/Ctrl to add to it. Fast strokes include triangles crossed between pointer events. Space-drag and middle-drag still pan in either mode.
- Drag a box to select intersecting triangles; Command/Ctrl-click toggles individual triangles. Command/Ctrl-drag adds a box selection. Tab to a triangle and press Enter/Space for keyboard selection.
- Double-click an insert to select its connected region of the same design along shared edges. Double-click that insert again to include connections at vertices; a third double-click deselects. Double-clicking a different insert starts again with shared edges. Matching requires the same color ID and ignores rotation; empty design 0 also supports connected selection.
- Right-click an insert for either connected-selection mode, clear, or rotation by 120° CW / 240° CCW or 240° CW / 120° CCW. Right-clicking within a selection preserves the group for clear/rotate; right-clicking outside it targets only that insert. Group edits are undoable in one step. Shift+F10 opens the menu for a focused triangle; arrow keys navigate, Enter activates, and Escape dismisses.
- Delete/Backspace replaces one or multiple selected inserts with empty design 0, preserving the triangles and their selection. Clearing is undoable. Text fields retain normal deletion behavior. Escape deselects; Command/Ctrl+A selects all. Undo/redo supports Command/Ctrl+Z, Shift+Command/Ctrl+Z and Ctrl+Y.
- Click a placed insert to reveal counterclockwise/clockwise arrows with a gap outside its triangular opening. With multiple inserts selected, the arrows rotate the whole selection in one undoable step. Clicking an already selected insert preserves the group. Each arrow click rotates by 120°; three clicks return to the original. Rotations persist to localStorage and disk, support undo/redo, and are included in SVG export. Edge halves are clipped after rotating the full pattern.
- Zoom the canvas using the −/+ toolbar buttons or plain `+`/`=` and `−` keys. The view ranges from 50% to 400%. Click the percentage or press plain `0` to fit the full panel. Command/Ctrl with +, −, or 0 keeps the browser's native page zoom behavior. Hold Space and drag, or use the middle mouse button, to pan while zoomed in. Zoom/pan change only the view, not the saved geometry or undo history.
- The denser layout fits the window height. All 41 palette entries fit at common desktop sizes; narrow screens use Panel / Canvas / Inserts tabs. Exceptionally small windows may scroll within a panel to keep controls accessible.
- Geometry changes retain placements with surviving cell IDs and remove out-of-bounds cells. Undo restores removed placements.

## Saving and printing

**New Design** opens a warning before replacing the current panel. Choose **Download design** to download the current design, then **Start New Design** to reset; Cancel keeps your work. Starting a new design is also undoable.

Changes automatically save to localStorage. The header counts design-changing actions (including undo and redo) since the last design download; selection and view changes do not count. The count survives reloads and resets when you download a design. **Download design** downloads a versioned `.kumiko.json` design. **Load from disk** validates the entire file before applying it; loading is undoable. Browser storage depends on the browser/profile and file location. If storage is unavailable, the status also indicates that browser storage is unavailable and directs you to download the design.

**Print parts list** opens a checklist grouped by insert design number and filament color, with full-triangle, edge-half and total quantities. Empty inserts are excluded. **Print / Save PDF** opens the browser's print dialog. The printed document contains a small full-panel preview and the checklist; it includes panel dimensions, pitch, orientation, filament family, name and hex code. The normal browser Print command also generates the current checklist.

**Export SVG** downloads physical millimeter dimensions, the frame, lattice and colored inserts, without selection overlays or the empty-space background. This is a 2D CAD starting point, not an STL or toolpath. Convert lattice strokes to paths, union touching geometry, then extrude in your CAD tool. Set depth, clearances and print tolerances there.

All **40 designs** use top-view contours extracted from `insert-stls/insert-N.stl`, including internal openings. Insert 0 remains the empty/clear tool and has no STL. The three sharp outer tips of insert 1 define the shared source triangle. All files use that coordinate frame, preserving the size and location of designs that do not reach all three corners. On the board, the source triangle aligns with the inside of the 3 mm lattice. At 50 mm pitch, it has the original 44.8038 mm tip spacing; other pitches scale uniformly. STL depth is metadata and does not affect the 2D preview.

Mitsuke offsets these silhouettes from the supplied library's nominal 2 mm strip width to the requested physical width. Width stays constant in millimeters when pitch changes. At 50 mm pitch and 2 mm Mitsuke, the original STL outline is reproduced. Thinning extends the geometry across shared triangle edges before offsetting, preserving frame contacts. Legacy files without a Mitsuke field use the 3 mm default.

### Regenerating STL designs

Add or replace `insert-N.stl` files in `insert-stls`, then run `npm ci` and `npm run import:stls`. Reload the page. The script regenerates `js/stl-patterns.js` and the [preview sheet](previews/stl-inserts.svg). Existing saved designs automatically use the corrected outlines because pattern IDs remain the same. The browser still runs entirely offline; the polygon library is only used by the import script.

The importer supports binary and ASCII STL and validates straight extrusions with two Z levels. It unions top-face triangles to recover the planar silhouette, handling overlapping faces, disconnected parts and internal holes. The supplied files for 18/19 share the same top-view outline, as do 20/21; these IDs are intentionally preserved separately. The shared triangle comes from insert 1; each outline is checked to fit within it. Stepped or beveled meshes are rejected because they require a more general projection. Source coordinates, dimensions, depth and projected area remain in the generated data for inspection.

## Extension points

- `js/catalog.js`: hardcoded JSON-compatible catalog with stable pattern IDs, orientation IDs and filament color IDs. Catalog entries include source URLs. Saved designs reference those IDs.
- `js/stl-patterns.js`: generated STL silhouettes and source measurements for all 40 designs.
- `js/traced-patterns.js`: historical screenshot traces; no longer loaded by the app. `scripts/trace-patterns.py` documents the old extraction.
- `js/geometry.js`: triangular tiling, clipping, vector transforms, validation, parts aggregation, and procedural geometry support for additional patterns.
- `js/insert-width.js`: cached physical strip-width adjustment using the locally bundled `js/vendor/clipper.js`; its license is included alongside it. No network requests are needed at runtime.
- `js/connected-selection.js`: same-design connected regions through shared edges or vertices.
- `js/app.js`: rendering, selection, history, persistence, export and printing.
- `favicon.svg`: a compact Kumiko lattice mark in the app's green, wood and ivory palette.

Saved design format is `kumiko-studio`, version `1`. It includes name, panel configuration, palette color ID and a map of cell IDs to `{patternId, colorId, rotation?}`. An optional `customColors` list stores `{id, family: "custom", name, hex}` entries; custom IDs begin with `custom-`. Inserts reference these IDs just like Bambu colors; panel colors remain hex values for compatibility. Optional rotation is 120 or 240 degrees clockwise; an omitted rotation means 0°, so older files still load. Empty cells have no entry. Unknown schema versions and catalog references are rejected. Adding schema fields requires explicit validation/migration.

Color values are from the [official PLA Matte table](https://store.bblcdn.eu/s8/default/f131f643495b417197832b291fc7b068/Bambu_PLA_Matte_Hex_Code.pdf) and [official PLA Basic table](https://store.bblcdn.eu/s8/default/903b60b06ac142e9b1b49ad53cfa4c82/Bambu_PLA_Basic_Hex_Code.pdf). The supplied forum link did not load, so the manufacturer table supplies Basic colors.

## Verification

After `npm ci`, `npm test` runs Node tests for tiling, catalogs, schema validation and parts grouping.

For browser tests, run `npm ci` then `npm run test:browser`. Playwright uses installed Google Chrome; change `channel` in `playwright.config.cjs` to use another installed browser. These dependencies are development-only. Tests open `index.html` directly using `file://`, exercising offline operation, placement, box selection, shortcuts, history, localStorage, file imports/downloads, print layout, saved rotations, keyboard deletion, zoom/pan and viewport sizing.
