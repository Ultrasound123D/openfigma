/**
 * PHASE 14 — angular (conic) and diamond gradient paints.
 *
 * Source evidence (port-source/analysis/phase12_16_gap_analysis.md):
 *   gradient types LINEAR 33 / RADIAL 4 / DIAMOND 8 refs.
 *
 * SVG has no native conic/diamond gradients, so both are rendered as exact
 * vector constructions inside a unit-square <pattern>:
 *
 * - Angular: pie slices around the center (0.5, 0.5). Stop offsets map to the
 *   0→360° sweep (rotated by gradientAngle). Each adjacent stop pair is
 *   subdivided into per-slice solid interpolated colors — a real conic ramp.
 *
 * - Diamond: Figma's diamond metric |dx| + |dy| is LINEAR inside each
 *   axis-aligned quadrant around the center, so each quadrant rect carries a
 *   linear gradient pointing at 45° toward its outer corner — iso-color lines
 *   are exact diamonds.
 */
import React from 'react'
import type { GradientStop } from '@/store/editor-store'

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h || '000000', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`
}

/** color at a 0..1 position along the stop ramp */
export function colorAt(stops: GradientStop[], pos: number): { color: string; opacity: number } {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  if (pos <= sorted[0].offset) return { color: sorted[0].color, opacity: sorted[0].opacity }
  const last = sorted[sorted.length - 1]
  if (pos >= last.offset) return { color: last.color, opacity: last.opacity }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (pos >= a.offset && pos <= b.offset) {
      const t = b.offset === a.offset ? 0 : (pos - a.offset) / (b.offset - a.offset)
      return { color: mixHex(a.color, b.color, t), opacity: a.opacity + (b.opacity - a.opacity) * t }
    }
  }
  return { color: last.color, opacity: last.opacity }
}

export interface PieSlice {
  /** unit-square path from center to arc */
  d: string
  color: string
  opacity: number
}

/**
 * Pie slices reproducing a conic sweep. `angleDeg` rotates the start
 * (Figma: 0° at 12 o'clock, clockwise — matches the linear angle convention).
 */
export function angularSlices(stops: GradientStop[], angleDeg: number, subdivPerPair = 8): PieSlice[] {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  if (sorted.length < 2) return []
  const cx = 0.5
  const cy = 0.5
  const r = 0.78 // covers the unit square corners (diag/2 ≈ 0.707) with margin
  const pt = (frac: number): [number, number] => {
    const deg = angleDeg + frac * 360
    const rad = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const out: PieSlice[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const span = b.offset - a.offset
    if (span <= 0) continue
    const steps = Math.max(2, Math.ceil(span * 360 / 12)) // ~12° per slice max
    for (let s = 0; s < steps; s++) {
      const f1 = a.offset + (span * s) / steps
      const f2 = a.offset + (span * (s + 1)) / steps
      const mid = (f1 + f2) / 2
      const c = colorAt(sorted, mid)
      const [x1, y1] = pt(f1)
      const [x2, y2] = pt(f2)
      const largeArc = f2 - f1 > 0.5 ? 1 : 0
      out.push({
        d: `M ${cx} ${cy} L ${x1.toFixed(4)} ${y1.toFixed(4)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(4)} ${y2.toFixed(4)} Z`,
        color: c.color,
        opacity: c.opacity,
      })
    }
  }
  void subdivPerPair
  return out
}

export interface DiamondQuad {
  x: number
  y: number
  w: number
  h: number
  /** gradient vector in the quad's own bbox coords (0-1), center-corner → outer corner */
  gx1: number
  gy1: number
  gx2: number
  gy2: number
  gid: string
}

/** 4 axis-aligned quadrant rects; each gradient points 45° at its corner. */
export function diamondQuads(idBase: string): DiamondQuad[] {
  return [
    // top-right: center at its bottom-left, outer corner at its top-right
    { x: 0.5, y: 0, w: 0.5, h: 0.5, gx1: 0, gy1: 1, gx2: 1, gy2: 0, gid: `${idBase}-tr` },
    // top-left: center at its bottom-right, outer corner at its top-left
    { x: 0, y: 0, w: 0.5, h: 0.5, gx1: 1, gy1: 1, gx2: 0, gy2: 0, gid: `${idBase}-tl` },
    // bottom-left: center at its top-right, outer corner at its bottom-left
    { x: 0, y: 0.5, w: 0.5, h: 0.5, gx1: 1, gy1: 0, gx2: 0, gy2: 1, gid: `${idBase}-bl` },
    // bottom-right: center at its top-left, outer corner at its bottom-right
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5, gx1: 0, gy1: 0, gx2: 1, gy2: 1, gid: `${idBase}-br` },
  ]
}

/** Angular pattern content (render inside a unit <pattern>). */
export function AngularPatternContent({ stops, angleDeg }: { stops: GradientStop[]; angleDeg: number }): React.ReactNode {
  return (
    <>
      {angularSlices(stops, angleDeg).map((s, i) => (
        <path key={i} d={s.d} fill={s.color} fillOpacity={s.opacity} />
      ))}
    </>
  )
}

/** Diamond pattern content (render inside a unit <pattern>). */
export function DiamondPatternContent({ stops, idBase }: { stops: GradientStop[]; idBase: string }): React.ReactNode {
  return (
    <>
      {diamondQuads(idBase).map(q => (
        <React.Fragment key={q.gid}>
          {/* objectBoundingBox units relative to the quad rect itself —
              userSpaceOnUse gradients inside objectBoundingBox patterns fail
              to resolve in Chromium (verified live during PHASE 14). */}
          <linearGradient id={q.gid} gradientUnits="objectBoundingBox" x1={q.gx1} y1={q.gy1} x2={q.gx2} y2={q.gy2}>
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
            ))}
          </linearGradient>
          <rect x={q.x} y={q.y} width={q.w} height={q.h} fill={`url(#${q.gid})`} />
        </React.Fragment>
      ))}
    </>
  )
}

/** CSS preview approximations for the property panel swatches. */
export function gradientPreviewCSS(type: string, stops: GradientStop[], angleDeg: number): string {
  const ramp = stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')
  if (type === 'angular-gradient') return `conic-gradient(from ${angleDeg}deg, ${ramp})`
  if (type === 'diamond-gradient') return `conic-gradient(from ${angleDeg + 45}deg, ${ramp}, ${stops[0]?.color || '#000'} 100%)`
  if (type === 'radial-gradient') return `radial-gradient(${ramp})`
  return `linear-gradient(${angleDeg}deg, ${ramp})`
}
