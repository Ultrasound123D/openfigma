# PORT-PLAN 23 — Complete-port terminal wave (final-audit gaps)

> **Status: ✅ DONE (2026-10-20)** — all 14 items closed, live-verified
> (5 rounds, 33 checks), VLM-confirmed 4/4 screenshots. See PROGRESS.md
> PHASE 23 and WORKLOG.md DECISION-018.

Provenance: `port-source/analysis/final_audit_report.md` (3 fresh search
surfaces, registry-semantics control experiment). All 14 implementable items below are (F12 was found already ported during the audit)
source-proven; every rejection is evidence-based.

## Scope (15 items → 4 clusters)

### A. Clipboard exports (source: 5018 design ctx-menu module)
- **F1 Copy as PNG**: selection → SVG render (existing `buildElementSvg`) →
  rasterize → PNG blob → `navigator.clipboard.write([ClipboardItem])`.
  Fallback toast when API unavailable. Ctx menu + ⇧⌘C (bound by us — source
  shortcut not extracted, documented).
- **F2 Copy as SVG**: selection → serialized SVG markup → clipboard
  `text/plain`. Ctx menu.
- **F3 Copy text**: text element selected → `writeText(content)`. Ctx menu
  (text-only).
- **F4 Copy layer name**: `writeText(name)` of first selected. Ctx menu.
- **F5 Copy/Paste properties**: store `propertyClipboard` (partial
  style+layout props) + `copyProperties`/`pasteProperties` actions; ctx menu
  (paste gated on selection + non-empty property clipboard).

### B. Context-menu & edit completions
- **F6 Paste here**: paste clipboard translated so its top-left lands at the
  right-click canvas point (ctx menu receives canvasX/canvasY already).
- **F7 Unlock all**: store action — set `isLocked:false` on every element on
  the current page (+ children), one history push. Ctx menu.
- **F10 Frame selection**: wrap selection in a new `frame` at selection bbox
  (reparent children, ids preserved). Edit menu + ⌥⌘G (bound by us,
  documented) + ctx menu (multi-select).

### C. Inspector depth
- **F8 Resize to fit**: one-shot fit — containers (frame/group/section) →
  bounds to children bbox (+strokes); text → measured content box (existing
  measureText). Button in PropertiesPanel Position section.
- **F9 Math in inputs**: `lib/math-input.ts` — safe arithmetic parser
  (`+ - * / % ( )`), relative ops (`+20`, `*2`) resolved against the current
  value; wired into `PropertyInput` commit (error → keep last valid, toast).
  Parity `evaluateMathExpression`.

### D. Preferences, view & components
- **F11 Nudge amount**: store `nudgeAmount {small, large}` (defaults 1/10,
  Figma defaults) + ViewOptionsPopup "Nudge Amount" section (selects 1/2/4/8
  small, 2/8/10/20 large… keep honest: free number inputs) + arrow-key nudging
  reads the store (replaces hardcoded `delta = shift?10:1`).
- **F12 Snap to objects toggle**: expose existing `snapToElements` store flag
  in View menu + ViewOptionsPopup (parity `snapToObjects` visual_bell).
- **F13 Shortcuts modal**: `ShortcutsModal.tsx` — grouped table of the port's
  real bindings (tools, edit, view, canvas, text, prototype); View menu entry
  + ⌘/ (bound by us, documented).
- **F14 Toggle show comments**: store `showComments` (default true) gating
  comment pins + composer; View menu + ViewOptionsPopup entry.
- **F15 Add variant**: component-set ctx menu + ComponentPanel — duplicate a
  component (default or selected variant) into the set with a fresh variant
  property combination (auto-increment "V{n}" for the first property),
  reusing existing variantProps/componentSetId semantics.

## Rejected (documented in final_audit_report.md — not re-litigated here)

swap-nodes, remove-interactions, separate/combine-text-path, main-component
menu, duplicate-in-place, paste-to-replace, ruler units, table row/col ops,
video fills, copy-as-css/ios/android, sites/slides/make tools,
show-rotation-origin (UNKNOWN), voice/search/bend/.fig/annotate (prior).

## Rules (unchanged — see RULES.md)

STRICT: no guessing; UNKNOWN marked; every phase: tsc+eslint+build zero,
live browser verification, VLM screenshots `download/openfigma-pN-*.png`,
PROGRESS/WORKLOG/worklog updates, commit + push.
