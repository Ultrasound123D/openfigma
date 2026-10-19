/**
 * outline-stroke.ts — PHASE 17 (P2).
 *
 * Source evidence: command enum OUTLINE_STROKE=233 (figma_app-*.min.js) +
 * menu action "outline-stroke" (fullscreen_actions.outline-stroke).
 *
 * Semantics (ported): converts a stroked shape into a filled outline path —
 * the stroke band becomes the geometry. Result: element becomes type 'path'
 * carrying `booleanContours` (multi-subpath evenodd), painted with the
 * ORIGINAL stroke color; its own stroke is removed.
 *
 * Algorithm (deterministic, browser-side):
 *   1. Build the element's local SVG path d (shared geometry builder).
 *   2. Sample the path via SVGGeometryElement.getTotalLength/getPointAtLength
 *      (step ~2px) — works on detached <path> in Chromium (computed from path
 *      data, no layout needed).
 *   3. Ring offset: outer = p + n*(w/2), inner = p − n*(w/2), n = unit normal.
 *   4. Simplify each ring (existing element-utils.simplifyPath, tol 2px).
 *   5. OPEN geometry (line/unclosed path) → single closed band ring.
 *      CLOSED geometry → outer ring + inner ring (evenodd hole).
 *
 * Caps: butt (end cuts perpendicular to path at ±w/2) — matches sampling.
 * Joins: outer ring is the +offset curve, inner the −offset: self-intersecting
 * outlines at sharp joins follow SVG evenodd parity — documented, deterministic.
 */

import type { DesignElement, VectorNetwork } from '@/store/editor-store'
import { pathElementToSvgPath, simplifyPath } from '@/lib/element-utils'
import { ellipseShapePath } from '@/lib/arc'
import { polysToContours, contoursBounds } from '@/lib/boolean-ops'
import type { Poly } from '@/lib/polygon-clip'

/** Element types whose geometry outline-stroke supports. */
const SUPPORTED = new Set(['rectangle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path'])

export function isOutlineStrokeCandidate(el: DesignElement): boolean {
  return SUPPORTED.has(el.type) && (el.strokeWidth || 0) > 0
}

/** Local-coords geometry `d` for any supported element (before transforms). */
export function elementGeometryD(el: DesignElement): string {
  switch (el.type) {
    case 'rectangle': {
      const w = el.width
      const h = el.height
      const r = Math.min(el.cornerRadius || 0, w / 2, h / 2)
      return r > 0.01
        ? `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
        : `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
    }
    case 'ellipse':
      return ellipseShapePath(el.width, el.height, (el as any).arc || null)
    case 'polygon': {
      const sides = el.sides || 6
      const r = Math.min(el.width, el.height) / 2
      const cx = el.width / 2
      const cy = el.height / 2
      const pts: string[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2
        pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`)
      }
      return `M ${pts.join(' L ')} Z`
    }
    case 'star': {
      const sides = el.sides || 5
      const outerR = Math.min(el.width, el.height) / 2
      const innerR = outerR * ((el.innerRadius || 40) / 100)
      const cx = el.width / 2
      const cy = el.height / 2
      const pts: string[] = []
      for (let i = 0; i < sides * 2; i++) {
        const a = (i * Math.PI) / sides - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`)
      }
      return `M ${pts.join(' L ')} Z`
    }
    case 'line':
      return `M 0 0 L ${el.width} ${el.height}`
    case 'arrow': {
      // geometry line only (arrowheads are decoration — Figma outline-stroke
      // on an arrow outlines the line; heads follow the stroke band of the line)
      return `M 0 0 L ${el.width} ${el.height}`
    }
    case 'path': {
      const d = pathElementToSvgPath(el)
      return d
    }
    default:
      return ''
  }
}

/** Whether the element's geometry is a closed loop (band vs ring-with-hole). */
function geometryIsClosed(el: DesignElement): boolean {
  if (el.type === 'line' || el.type === 'arrow') return false
  if (el.type === 'path') {
    if (el.booleanContours?.length) return true
    if (el.vectorNetwork) return !!el.vectorNetwork.closed
    return !!el.pathClosed
  }
  return true
}

interface Sample {
  x: number
  y: number
  tx: number
  ty: number
}

/** Sample the path with tangents. Detached SVG path — Chromium computes
 *  getTotalLength/getPointAtLength from path data without layout. */
function samplePathD(d: string, step: number): { samples: Sample[]; length: number } | null {
  if (typeof document === 'undefined') return null
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  const p = document.createElementNS(NS, 'path')
  p.setAttribute('d', d)
  svg.appendChild(p)
  let len = 0
  try {
    len = p.getTotalLength()
  } catch {
    return null
  }
  if (!isFinite(len) || len <= 0) return null
  const n = Math.max(16, Math.min(600, Math.ceil(len / Math.max(0.5, step))))
  const eps = Math.min(0.5, len / n)
  const samples: Sample[] = []
  for (let i = 0; i <= n; i++) {
    const t = Math.min(len, (len * i) / n)
    const pt = p.getPointAtLength(t)
    const ahead = p.getPointAtLength(Math.min(len, t + eps))
    const behind = p.getPointAtLength(Math.max(0, t - eps))
    let tx = ahead.x - behind.x
    let ty = ahead.y - behind.y
    const m = Math.hypot(tx, ty)
    if (m > 1e-9) {
      tx /= m
      ty /= m
    } else {
      tx = 1
      ty = 0
    }
    samples.push({ x: pt.x, y: pt.y, tx, ty })
  }
  return { samples, length: len }
}

export interface OutlineResult {
  contours: VectorNetwork[]
  bounds: { x: number; y: number; width: number; height: number }
  closedBand: boolean
}

/**
 * Compute the outline-stroke geometry for one element.
 * Returns contours relative to (0,0) in LOCAL element space + bounds.
 * null when not computable (no DOM / degenerate).
 */
export function computeOutlineStroke(el: DesignElement): OutlineResult | null {
  const d = elementGeometryD(el)
  if (!d) return null
  const half = (el.strokeWidth || 0) / 2
  if (half <= 0) return null
  const sampled = samplePathD(d, Math.max(1.5, half * 0.75))
  if (!sampled || sampled.samples.length < 2) return null
  const { samples } = sampled
  const closed = geometryIsClosed(el)

  // unit normals (left of travel direction)
  const outer: { x: number; y: number }[] = []
  const inner: { x: number; y: number }[] = []
  for (const s of samples) {
    const nx = -s.ty
    const ny = s.tx
    outer.push({ x: s.x + nx * half, y: s.y + ny * half })
    inner.push({ x: s.x - nx * half, y: s.y - ny * half })
  }

  const outerS = simplifyPath(outer, 1.2)
  const innerRev = [...inner].reverse()
  const innerS = simplifyPath(innerRev, 1.2)

  let contours: VectorNetwork[]
  if (closed) {
    // ring with hole: outer loop + inner loop (evenodd)
    if (outerS.length < 3 || innerS.length < 3) return null
    contours = [
      polyToNetwork(outerS, true),
      polyToNetwork(innerS, true),
    ]
  } else {
    // open path: single band ring = outer forward + inner backward
    const band = [...outerS, ...innerS]
    if (band.length < 4) return null
    contours = [polyToNetwork(band, true)]
  }

  const bounds = contoursBounds(contours)
  if (bounds.width <= 0 || bounds.height <= 0) return null
  return { contours, bounds, closedBand: closed }
}

function polyToNetwork(poly: { x: number; y: number }[], closed: boolean): VectorNetwork {
  const vertices = poly.map((p) => ({ x: p.x, y: p.y }))
  const n = vertices.length
  const segments: { start: number; end: number }[] = []
  for (let i = 0; i < n - 1; i++) segments.push({ start: i, end: i + 1 })
  if (closed && n > 2) segments.push({ start: n - 1, end: 0 })
  return { vertices, segments, closed: true }
}

/** Convenience for tests: contours from explicit polys (parity with polysToContours). */
export function outlineContoursFromPolys(polys: Poly[], origin: { x: number; y: number }): VectorNetwork[] {
  return polysToContours(polys, origin)
}
