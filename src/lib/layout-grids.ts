/**
 * PHASE 8 — Layout grids model + geometry.
 *
 * Ported behavior parity (source nR/nN lost — REGENERATED per PORT-PLAN-6-11.md
 * row 8 against Figma's published layout-grid model):
 *
 *  LayoutGrid (per frame, ordered list — Figma allows several grids per frame):
 *    pattern: 'columns' | 'rows' | 'grid'
 *    columns/rows: { count, gutter, margin, type }
 *      type: 'start' | 'center' | 'end' | 'stretch' | 'min' | 'max'
 *        - stretch: tracks fill the space between margins (count fixed, track w auto)
 *        - center:  grid centered, track width = (w - margins - gutters) / count
 *        - start/end: grid aligned to the respective edge
 *        - min/max: track width FIXED at `sectionSize`, count auto — Figma's
 *          "adaptive" sizing. We honor sectionSize when type is min/max.
 *    grid: square grid { size }
 *    visible: per-grid visibility, color: per-grid tint
 *
 *  computeGridRects(grid, frameW, frameH) → list of rectangles (frame-local
 *  coordinates) for the columns/rows tracks. Square grid is rendered with an
 *  SVG <pattern> instead, so computeGridRects returns [] for it.
 *
 * Ruler units (px / in / cm / mm @ DPI 72 — Figma's documented default) and
 * tick stepping live here too, shared by Rulers.tsx and ViewOptionsPopup.
 */

export type GridLayoutType = 'start' | 'center' | 'end' | 'stretch' | 'min' | 'max'

export interface LayoutGrid {
  id: string
  pattern: 'columns' | 'rows' | 'grid'
  visible: boolean
  color: string
  /** columns/rows */
  count?: number
  gutter?: number
  margin?: number
  type?: GridLayoutType
  /** used by min/max (fixed track size) */
  sectionSize?: number
  /** grid pattern */
  size?: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Compute the track rectangles of a columns/rows layout grid inside a frame of
 * the given size. Returns [] for the square grid pattern.
 */
export function computeGridRects(grid: LayoutGrid, frameW: number, frameH: number): Rect[] {
  if (grid.pattern === 'grid') return []
  const count = Math.max(1, grid.count || 1)
  const gutter = Math.max(0, grid.gutter || 0)
  const margin = Math.max(0, grid.margin || 0)
  const type = grid.type || 'stretch'
  const isColumns = grid.pattern === 'columns'
  const total = isColumns ? frameW : frameH

  // available space after margins (one margin on each side)
  const avail = Math.max(0, total - margin * 2)
  const rects: Rect[] = []

  const emit = (start: number, size: number) => {
    if (isColumns) rects.push({ x: start, y: 0, width: size, height: frameH })
    else rects.push({ x: 0, y: start, width: frameW, height: size })
  }

  if (type === 'stretch') {
    // count fixed, tracks share the remaining space after gutters
    const track = (avail - gutter * (count - 1)) / count
    if (track <= 0) return rects
    for (let i = 0; i < count; i++) emit(margin + i * (track + gutter), track)
  } else if (type === 'center') {
    // same arithmetic as stretch but the grid block is centered — for symmetric
    // margins both are identical; Figma's center differs when margins differ,
    // our model has a single margin so stretch/center coincide numerically
    // only when margins are equal; center ignores margin imbalance:
    const track = (avail - gutter * (count - 1)) / count
    if (track <= 0) return rects
    for (let i = 0; i < count; i++) emit(margin + i * (track + gutter), track)
  } else if (type === 'start') {
    const track = grid.sectionSize && grid.sectionSize > 0 ? grid.sectionSize : (avail - gutter * (count - 1)) / count
    let p = margin
    for (let i = 0; i < count && p + track <= total; i++) {
      emit(p, track)
      p += track + gutter
    }
  } else if (type === 'end') {
    const track = grid.sectionSize && grid.sectionSize > 0 ? grid.sectionSize : (avail - gutter * (count - 1)) / count
    // align the block to the end edge: right/bottom
    const block = count * track + gutter * (count - 1)
    let p = total - margin - block
    for (let i = 0; i < count; i++) {
      emit(p, track)
      p += track + gutter
    }
  } else {
    // 'min' / 'max' — adaptive: fixed track size (sectionSize, default 60px
    // like Figma), as many tracks as fit, aligned start (min) / end (max)
    const track = grid.sectionSize && grid.sectionSize > 0 ? grid.sectionSize : 60
    const fit = Math.max(1, Math.floor((avail + gutter) / (track + gutter)))
    const n = Math.min(count, fit)
    const block = n * track + gutter * (n - 1)
    let p = type === 'min' ? margin : total - margin - block
    for (let i = 0; i < n; i++) {
      emit(p, track)
      p += track + gutter
    }
  }
  return rects
}

/** Grid pattern step in frame px (square grids). */
export function gridStep(grid: LayoutGrid): number {
  return Math.max(1, grid.size || 8)
}

// ---------------------------------------------------------------------------
// Ruler units — px / in / cm / mm @ DPI 72 (Figma default document DPI).
// ---------------------------------------------------------------------------

export type RulerUnit = 'px' | 'in' | 'cm' | 'mm'

/** px per unit at DPI 72. cm = in / 2.54, mm = cm / 10. */
export const PX_PER_UNIT: Record<RulerUnit, number> = {
  px: 1,
  in: 72,
  cm: 72 / 2.54, // 28.346…
  mm: 72 / 25.4, // 2.8346…
}

/** Convert a canvas-px distance to the ruler unit (rounded for display). */
export function pxToUnit(px: number, unit: RulerUnit): number {
  return px / PX_PER_UNIT[unit]
}

/** Format a canvas-px value in the current unit (integers for px/mm, 2dp in/cm). */
export function formatPxInUnit(px: number, unit: RulerUnit): string {
  const v = pxToUnit(px, unit)
  if (unit === 'px') return String(Math.round(v))
  const s = v.toFixed(unit === 'mm' ? 1 : 2)
  return s.replace(/\.?0+$/, '')
}

/**
 * Adaptive tick stepping: pick a "nice" major step (1/2/5×10^k in the unit)
 * so that majors are ≥ ~64 screen px apart, and minors subdivide by 5.
 * Returns { major, minor } in UNIT units.
 */
export function rulerTickSteps(unit: RulerUnit, zoom: number): { major: number; minor: number } {
  const unitScreen = zoom * PX_PER_UNIT[unit] // screen px per 1 unit
  // find the smallest nice step whose on-screen size is >= 64px
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]
  let major = nice.find((n) => n * unitScreen >= 64) ?? 10000
  const minor = major / 5
  return { major, minor }
}
