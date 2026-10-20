# PORT-PLAN 17–22 — Complete-port wave 2 (post-recovery fresh audit)

## Provenance (strict engineering: evidence only)

Fresh audit after environment recovery (see `port-source/audit/audit_report.md` +
`scripts/verify_round2.py` output). Source: `port-source/figmajsx` (js/, js_bundles/,
core/, vendor/ — 254 JS files, 74MB) + 3 HTML shells. Every gap below is
**source-proven with a concrete snippet**; every rejected item is rejected on
evidence, not opinion.

### Evidence-verified gap list (21 items → 6 phases)

| # | Gap | Source evidence (bundle + snippet) | Phase |
|---|-----|-------------------------------------|-------|
| P1 | Pattern paint type | `73-81181acf3b7691a4`: `addPaintOfType`, `disablePatternPaints`; flag `vec_pattern_fill_nested_images` | 17 |
| P2 | Outline stroke | cmd enum `OUTLINE_STROKE=233` (`figma_app-ebce…`); menu `action:"outline-stroke"` | 17 |
| P3 | Flatten selection | `FLATTEN_SELECTION / "flatten-selection"` (context menu + command table) | 17 |
| P4 | Arc tool (ellipse arc inputs) | `transform_panel--arcToolInputsUi3`, `arcToolRatio`; cmd `CREATE_ARC` | 17 |
| V5 | Vector edit mode | `isVectorEditMode` (530-6fea…), `vectorEditableNodeCount` (9456) | 18 |
| T6 | Text on path | `vectors.text_on_path_tool_announcement` (9488-7df5…) | 19 |
| T7 | Hyperlink text markers | text marker types `"EMOJI"` + `"HYPERLINK"` (1517-f945…) | 19 |
| T8 | Emoji picker (comments+text) | `comments.emojiPicker`, `insertEmoji`, `add_emoji` (5101-a9dd…) | 19 |
| T9 | Place image mode | `editMode===PLACE_IMAGE` (9456); `"toolbar-place-image":"fullscreen_actions.click_or_drag_to_place"` (3835) | 19 |
| PR10 | Fixed scrolling | `scrollBehavior:"FIXED_WHEN_CHILD_OF_SCROLLING_FRAME"`, `isAncestorFixed` (8014-cb16…) | 20 |
| PR11 | Change To action | `"SWAP_STATE"!==t.navigationType` guard (8063-215e…), `proto.variant_actions.change_to` | 20 |
| PR12 | Scroll To action | `"SCROLL_TO"===e.action` (5977-0843…) | 20 |
| PR13 | Flow starting points | `getFlowStartingPoints`, `flowStartingPointNameInput` (5018, 5977) | 20 |
| E14 | Paste over selection | `PASTE_OVER_SELECTION / "paste-over-selection", is_edit:!0` (9456) | 21 |
| E15 | Select all with X / similar / inverse | `select-all-with-menu-options` children, `select-similar`, `select-inverse` (9456) | 21 |
| E16 | Find and replace | `FIND_AND_REPLACE=4` enum (`figma_app-ebce…`), `load all pages before search` (9488) | 21 |
| VW17 | Outlines mode | `toggle-outlines` + `-hidden-layers` + `-object-bounds` (9456 action list) | 21 |
| VW18 | Pixel preview | `activeCanvasPixelPreview`, `toggle-pixel-preview`, `activeCanvasRetinaMode` (8014) | 21 |
| C19 | Multiplayer presence | `remoteCursorStore` (5877), `multiplayer_viewport_overlay` (2971), `toggle-viewport-overlay-hiding` | 22 |
| C20 | Version history + restore | `restoreVersionId`, `restore_initiated` (73-81181, 7401) | 22 |
| C21 | Publish library | `getLibraryPublishedComponentsWithCodeConnectAll`, `library_key` (9035, 1795) | 22 |

### Rejected on evidence (documented, not guessed)

| Item | Rejection reason |
|---|---|
| Layer/background blur | Already ported — `BlurEffect {type:'blur'\|'background-blur'}` + EffectsPanel + feGaussianBlur (audit pattern was too literal) |
| Voice prototype triggers | Only figmake **AI-chat** voice (`voice_recording_started` in ChatPortion) — no prototype-voice evidence |
| Search palette | SRC-ABSENT under `menuSearch\|searchPalette\|commandPalette` |
| Bend tool | word-list false positive; behavior subsumed by vector edit mode |
| `.fig` import | URL false positives (`.figma` strings); server binary format — no portable evidence |
| Annotate | a11y lint domain (`sts_lint_flattened_aria`); comments already ported |
| Arc word-lists | word-list false positives — REAL arc proof is the transform-panel inputs (P4) |

## Phase scopes (each: extraction → compare → implement → tsc/eslint/build → live+VLM → 3 docs → push)

### PHASE 17 — Paint & vector commands ✅ DONE (2026-10-20)
<!-- closed: pattern paint + outline stroke + flatten + arc + live-boolean display fix; see PROGRESS.md -->
- **P1 Pattern paint**: new paint type `pattern` on fills (image + tile repeat,
  CSS `background-repeat` semantics; source's AI generation is figmake-only —
  documented out of scope). SVG `<pattern>` fill + picker entry + panel preview.
- **P2 Outline stroke**: convert stroke geometry to filled outline path.
  Algorithm: sample element path via `getPointAtLength`, offset ±strokeWidth/2
  along normals, outer ring + inner ring (even-odd), caps butt/round/square.
  Replaces element with editable path (Figma behavior: result is a vector).
- **P3 Flatten selection**: boolean groups → baked single path (geometry from
  existing boolean-ops engine); also multi-select same-frame shapes? No —
  Figma flatten = boolean bake. Scope: boolean groups only (evidence-based).
- **P4 Arc tool**: ellipse gains `arcStart/arcEnd/innerRadiusRatio`; pie/donut
  rendering path; PropertiesPanel Arc section (3 inputs) for ellipses —
  parity with `arcToolInputsUi3` + ratio input.

### PHASE 18 — Vector edit mode ✅ DONE (2026-10-20)
<!-- closed: parametric→vector conversion (exact bezier), Enter/dblclick entry, split-vector; see PROGRESS.md -->
- Enter/exit (⌘+double-click / Enter / Esc), per-node `isVectorEditMode`.
- Show vertices + tangent handles (segments store relative tangents already).
- Drag vertex / drag handle (mirroring per existing `handleMirroring` semantics),
  corner-radius on vertex, strokeCap/strokeJoin already in model.
- Works on pen/pencil paths AND parametric shapes entered for editing
  (parametric → converted to path copy, non-destructive ask? Figma converts —
  follow Figma: entering edit on parametric shape converts it to a path).

### PHASE 19 — Text & media depth ✅ DONE (2026-10-20)
<!-- closed: text-on-path + hyperlink runs + emoji picker + place-image queue; see PROGRESS.md -->
- **T6 Text on path**: text element gains `onPathId`; rendering via SVG
  `<textPath>`; offset along path; editing UX = type in place.
- **T7 Hyperlink markers**: text-run `links: {start,end,url}[]`; render
  underline+color; Cmd+K link editor; click → open URL (viewer + prototype).
- **T8 Emoji**: emoji picker (comments composer + text editor), insertEmoji —
  local emoji dataset (no external API), search + categories.
- **T9 Place image**: after picking N images → PLACE_IMAGE mode: click places
  at natural size centered on point; drag places scaled; sequential for N>1;
  Esc cancels rest. Matches `click_or_drag_to_place`.

### PHASE 20 — Prototype completion ✅ (2026-10-20; fixed-overlay isolation + change-to visual marked OPEN — see PROGRESS.md)
- **PR10 Fixed scrolling**: node `scrollBehavior: 'SCROLLS' |
  'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME'` + player honors fixed children when
  parent scrolls; panel toggle in Prototype section (disabled when not in
  scrollable frame — parity `fixedScrollingDisabled`).
- **PR11 Change To**: new action `change-to` (source SWAP_STATE): target =
  another component/variant; player swaps node (smart-animate compatible);
  interactions panel entry when component/variant selected.
- **PR12 Scroll To**: action `scroll-to`: destination node inside same frame;
  player smooth-scrolls the frame to reveal node (no page change).
- **PR13 Flow starting points**: named starting points on frames
  (`flowStartingPoints` on design: [{frameId, name}]); canvas badge + name
  editor (on-canvas input per `flowStartingPointNameInput`); presentation
  starts from first starting point (`getEffectivePrototypeStartNodeId`).

### PHASE 21 — Edit & view parity
- **E14 paste-over-selection**: paste clipboard style as overlay onto selected
  (replaces selection content with clipboard nodes, keeping ids/position).
- **E15 select-all-with**: submenu (same: fill / stroke / effects / opacity /
  type / text style / instance) + select-similar + select-inverse; Edit menu
  + context menu (`select-all-with-menu-options` children parity).
- **E16 find/replace**: panel with scope=all pages (loads all pages first —
  parity), find options (case, whole), replace (text content + style props? —
  scope: text content only, evidence-based: text search), replace-all.
- **VW17 outlines mode**: render mode = wireframe outlines (fills hidden);
  variants: hidden-layers-outlines, object-bounds (overlay boxes); main menu
  View entries + shortcuts (⌘⇧O toggle, per action list).
- **VW18 pixel preview**: canvas renders rasterized at device pixels when
  zoom<100% (pixelated sampling); toggle in View menu + shortcut; retina mode
  follows devicePixelRatio (parity `activeCanvasRetinaMode`).

### PHASE 22 — Collaboration & libraries
- **C19 presence over SSE**: broadcast cursor position + selection bounds
  (throttled); render remote cursors (name chip) + remote viewport overlay
  rectangles; `toggle-viewport-overlay-hiding` parity (View menu).
- **C20 version history**: server-side snapshots (on save, throttled);
  panel: list (time, label), open = preview state, restore = committed
  restore action (parity `restore_initiated`); undo-able via history.
- **C21 publish library**: publish current project's components → named
  library (server-side, cross-project); Assets panel: Libraries section
  (list, enable/disable), insert components from enabled libraries into any
  project (instance semantics reuse existing createInstance).

## Rules (unchanged — see RULES.md)
- STRICT: no guessing; UNKNOWN marked; every phase: tsc+eslint+build zero,
  live browser verification, VLM screenshots `download/openfigma-pN-*.png`,
  PROGRESS/WORKLOG/worklog updates, commit + push per phase.
