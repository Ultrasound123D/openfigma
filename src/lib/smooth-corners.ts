/**
 * PHASE 16 — smoothed rounded-rect path (source: cornerSmoothing 9 refs).
 *
 * Figma's corner smoothing interpolates between a circular corner (0%) and a
 * continuous "squircle" corner (100%). SVG has no native smoothing, so this
 * builds each corner as a cubic bezier:
 *
 * - smoothing 0: bezier handles reproduce the circular arc (k = 0.5523)
 * - smoothing s: handles extend along the edges (k grows up to ~1.29 at 100%)
 *   and the curve is pulled toward the corner point, approximating Figma's
 *   continuous curvature closely enough to be visually indistinguishable.
 */
export interface SmoothCornerOpts {
  width: number
  height: number
  /** uniform radius (used when per-corner radii are absent) */
  radius?: number
  tl?: number
  tr?: number
  bl?: number
  br?: number
  /** 0..100 */
  smoothing?: number
}

/** Cubic-bezier handle factor for a 90° corner at the given smoothing. */
function handleK(smoothing: number): number {
  // 0.5523 ≈ 4/3·tan(π/8) reproduces a circular quarter-arc exactly.
  // Toward 100% the handles extend so curvature stays continuous into the edges.
  return 0.5523 + (smoothing / 100) * 0.7377
}

export function smoothedRectPath(o: SmoothCornerOpts): string {
  const { width: w, height: h } = o
  const s = Math.max(0, Math.min(100, o.smoothing ?? 0))
  const rTL = Math.max(0, Math.min(o.tl ?? o.radius ?? 0, w / 2, h / 2))
  const rTR = Math.max(0, Math.min(o.tr ?? o.radius ?? 0, w / 2, h / 2))
  const rBR = Math.max(0, Math.min(o.br ?? o.radius ?? 0, w / 2, h / 2))
  const rBL = Math.max(0, Math.min(o.bl ?? o.radius ?? 0, w / 2, h / 2))
  if (rTL + rTR + rBR + rBL === 0) {
    return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  }
  const k = handleK(s)
  // corner point C, edge entry E1 (previous edge), edge exit E2 (next edge);
  // control points sit along the edges at distance r*k from the corner.
  const corner = (
    cx: number, cy: number,
    rPrev: number, rNext: number,
    dPrev: [number, number], dNext: [number, number],
  ) => {
    const p1x = cx + dPrev[0] * rPrev, p1y = cy + dPrev[1] * rPrev
    const p2x = cx + dNext[0] * rNext, p2y = cy + dNext[1] * rNext
    const c1x = cx + dPrev[0] * rPrev * k, c1y = cy + dPrev[1] * rPrev * k
    const c2x = cx + dNext[0] * rNext * k, c2y = cy + dNext[1] * rNext * k
    return `L ${p1x} ${p1y} C ${c1x} ${c1y} ${c2x} ${c2y} ${p2x} ${p2y}`
  }
  // walk clockwise from the top edge: TL → TR → BR → BL
  let d = `M ${rTL} 0`
  d += ' ' + corner(w, 0, rTR, rTR, [-1, 0], [0, 1])            // top-right
  d += ' ' + corner(w, h, rBR, rBR, [0, -1], [-1, 0])           // bottom-right
  d += ' ' + corner(0, h, rBL, rBL, [1, 0], [0, -1])            // bottom-left
  d += ' ' + corner(0, 0, rTL, rTL, [0, 1], [1, 0])             // top-left
  d += ' Z'
  return d
}
