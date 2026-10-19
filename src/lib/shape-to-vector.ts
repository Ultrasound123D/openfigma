/**
 * shape-to-vector.ts — PHASE 18 (V5).
 *
 * Source evidence:
 *  - isVectorEditMode / vectorEditableNodeCount (530-6fea, 9456): entering vector
 *    edit on a parametric shape converts it to an editable vector (Figma behavior).
 *  - break-vector-network-into-paths / fullscreen_actions.split_vector (5018):
 *    split a multi-contour vector into separate paths.
 *
 * Conversion rules (deterministic):
 *  - ellipse (no arc): EXACT 4-cubic-bezier ellipse (kappa 0.5522848) — 4
 *    vertices at 0/90/180/270°, tangents = relative control offsets.
 *  - ellipse with arc: sampled polyline from the arc path (outline-stroke
 *    sampler, DP-simplified at 0.6px) — anchors along the curve.
 *  - rectangle: straight polygon; rounded corners → corner bezier arcs
 *    (2 anchors per corner, kappa·r handles) — exact Figma-like result.
 *  - polygon / star: straight segments, N anchors (vertices at the shape's
 *    angles), closed.
 *  - line / arrow: 2 anchors, OPEN network (arrow keeps its decorative head —
 *    conversion covers the line geometry; heads follow strokeWidth styling).
 */

import type { DesignElement, VectorNetwork, VectorVertex, PathPoint } from '@/store/editor-store'
import { getVectorNetwork } from '@/lib/element-utils'
import { elementGeometryD, computeOutlineStroke } from '@/lib/outline-stroke'
import { ellipseShapePath } from '@/lib/arc'
import { simplifyPath } from '@/lib/element-utils'

const K = 0.5522847498307936 // cubic-bezier circle approximation constant

/** Straight-segment closed network from explicit points. */
function networkFromPoints(pts: { x: number; y: number }[], closed: boolean): VectorNetwork {
  const vertices: VectorVertex[] = pts.map((p) => ({ x: p.x, y: p.y }))
  const segments: { start: number; end: number; tangentStart?: { x: number; y: number }; tangentEnd?: { x: number; y: number } }[] = []
  for (let i = 0; i < pts.length - 1; i++) segments.push({ start: i, end: i + 1 })
  if (closed && pts.length > 2) segments.push({ start: pts.length - 1, end: 0 })
  return { vertices, segments, closed }
}

/** 4-vertex exact ellipse network (bezier handles as relative tangents). */
function ellipseNetwork(w: number, h: number): VectorNetwork {
  const rx = w / 2
  const ry = h / 2
  const kx = rx * K
  const ky = ry * K
  // vertices at 0°(right), 90°(bottom), 180°(left), 270°(top) — SVG y-down
  const v: VectorVertex[] = [
    { x: w, y: ry },
    { x: rx, y: h },
    { x: 0, y: ry },
    { x: rx, y: 0 },
  ]
  const rel = (dx: number, dy: number) => ({ x: dx, y: dy })
  // segment 0→1 (right→bottom): c1=(w, ry+ky) c2=(rx+kx, h)
  // segment 1→2 (bottom→left):  c1=(rx-kx, h) c2=(0, ry+ky)
  // segment 2→3 (left→top):     c1=(0, ry-ky) c2=(rx-kx, 0)
  // segment 3→0 (top→right):    c1=(rx+kx, 0) c2=(w, ry-ky)
  const segments = [
    { start: 0, end: 1, tangentStart: rel(0, ky), tangentEnd: rel(-kx, 0) },
    { start: 1, end: 2, tangentStart: rel(-kx, 0), tangentEnd: rel(0, -ky) },
    { start: 2, end: 3, tangentStart: rel(0, -ky), tangentEnd: rel(kx, 0) },
    { start: 3, end: 0, tangentStart: rel(kx, 0), tangentEnd: rel(0, ky) },
  ]
  return { vertices: v, segments, closed: true }
}

/** Rounded-rect network: straight edges + exact corner beziers (2 anchors/corner). */
function roundedRectNetwork(w: number, h: number, r: number): VectorNetwork {
  const rr = Math.min(r, w / 2, h / 2)
  if (rr <= 0.01) {
    return networkFromPoints([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], true)
  }
  const k = rr * K
  // 8 anchors: 2 per corner. Order: top-left corner (a at x=r,y=0 … b at 0,y=r) etc.
  const v: VectorVertex[] = [
    { x: rr, y: 0 }, { x: 0, y: rr },            // TL corner (top anchor → left anchor)
    { x: 0, y: h - rr }, { x: rr, y: h },        // BL corner
    { x: w - rr, y: h }, { x: w, y: h - rr },    // BR corner
    { x: w, y: rr }, { x: w - rr, y: 0 },        // TR corner
  ]
  const seg = (s: number, e: number, ts?: { x: number; y: number }, te?: { x: number; y: number }) =>
    ({ start: s, end: e, ...(ts ? { tangentStart: ts } : {}), ...(te ? { tangentEnd: te } : {}) })
  const segments = [
    seg(0, 1, { x: k, y: 0 }, { x: 0, y: k }),     // TL corner arc
    seg(1, 2),                                     // left edge
    seg(2, 3, { x: 0, y: -k }, { x: k, y: 0 }),    // BL corner arc
    seg(3, 4),                                     // bottom edge
    seg(4, 5, { x: -k, y: 0 }, { x: 0, y: -k }),   // BR corner arc
    seg(5, 6),                                     // right edge
    seg(6, 7, { x: 0, y: k }, { x: -k, y: 0 }),    // TR corner arc
    seg(7, 0),                                     // top edge
  ]
  return { vertices: v, segments, closed: true }
}

/** Sampled-polyline network for curved geometry (arcs) — DP-simplified. */
function sampledNetwork(d: string, closed: boolean, tolerance: number): VectorNetwork | null {
  // reuse the outline-stroke DOM sampler (detached <path>, Chromium computes
  // getTotalLength/getPointAtLength from data — no layout needed)
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', d)
  probe.appendChild(p)
  let len = 0
  try { len = p.getTotalLength() } catch { return null }
  if (!isFinite(len) || len <= 0) return null
  const step = Math.max(1.5, len / 240)
  const n = Math.max(8, Math.min(240, Math.ceil(len / step)))
  const raw: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) {
    const pt = p.getPointAtLength(Math.min(len, (len * i) / n))
    raw.push({ x: pt.x, y: pt.y })
  }
  const simplified = simplifyPath(raw, tolerance)
  if (simplified.length < 2) return null
  return networkFromPoints(simplified, closed)
}

const CONVERTIBLE = new Set(['rectangle', 'ellipse', 'polygon', 'star', 'line', 'arrow'])

export function isShapeToVectorCandidate(el: DesignElement): boolean {
  return CONVERTIBLE.has(el.type)
}

/** Convert a parametric shape to an editable VectorNetwork (local coords). */
export function shapeToVectorNetwork(el: DesignElement): VectorNetwork | null {
  switch (el.type) {
    case 'rectangle': {
      const r = el.cornerRadius || 0
      return roundedRectNetwork(el.width, el.height, r)
    }
    case 'ellipse': {
      if (el.arc) {
        const d = ellipseShapePath(el.width, el.height, el.arc)
        if (d) {
          const closed = Math.abs(el.arc.sweep) >= 360
          const net = sampledNetwork(d, closed, 0.6)
          if (net) return net
        }
      }
      return ellipseNetwork(el.width, el.height)
    }
    case 'polygon': {
      const sides = el.sides || 6
      const r = Math.min(el.width, el.height) / 2
      const cx = el.width / 2
      const cy = el.height / 2
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
      return networkFromPoints(pts, true)
    }
    case 'star': {
      const sides = el.sides || 5
      const outerR = Math.min(el.width, el.height) / 2
      const innerR = outerR * ((el.innerRadius || 40) / 100)
      const cx = el.width / 2
      const cy = el.height / 2
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i < sides * 2; i++) {
        const a = (i * Math.PI) / sides - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
      return networkFromPoints(pts, true)
    }
    case 'line':
    case 'arrow':
      return networkFromPoints([{ x: 0, y: 0 }, { x: el.width, y: el.height }], false)
    default:
      return null
  }
}

/** PathPoints flavor (used by legacy render path) — straight segments. */
export function networkToPathPoints(net: VectorNetwork): PathPoint[] {
  return net.vertices.map((v) => ({ x: v.x, y: v.y }))
}
