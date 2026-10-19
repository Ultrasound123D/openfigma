/**
 * boolean-ops.ts — PHASE 6 adapter (REBUILT per PORT-PLAN-6-11.md)
 * Element-level boolean operations + mask geometry, on top of the pure
 * polygon-clip.ts math (62/62 unit-tested in scripts/test_polygon_clip.mjs).
 *
 * Semantics (documented decisions — no Figma source copy, LOST-SOURCE):
 * - Operands: rectangle / ellipse / polygon / star / path only (vector shapes).
 *   Lines, text, images, frames, groups, components are rejected with reason.
 * - Result: single element of type 'path' carrying `booleanContours`
 *   (VectorNetwork[], rendered fillRule=evenodd) + provenance
 *   (`booleanOperation`, `booleanSourceIds` — previously dead fields, now live).
 * - Paint (fill/stroke/effects) inherited from the BACKMOST operand (array order).
 * - Result is inserted at the backmost operand's z-slot inside its parent.
 * - Masks: `isMask` clips all PREVIOUS siblings (+ the mask itself) within the
 *   same parent. Mask operand types: rectangle/ellipse/polygon/star/path.
 */

import type { DesignElement, VectorNetwork } from '@/store/editor-store'
import type { Poly, Pt, BooleanOp } from '@/lib/polygon-clip'
import {
  foldOp, normalizeLoops, ensureCCW,
} from '@/lib/polygon-clip'
import { getVectorNetwork } from '@/lib/element-utils'

export type { BooleanOp }

const MASKABLE_TYPES = new Set(['rectangle', 'ellipse', 'polygon', 'star', 'path'])
const OPERAND_TYPES = MASKABLE_TYPES

export type BooleanFailure = { ok: false; reason: string }

/** Eligibility check shared by store action + UI gating. */
export function isBooleanOperandType(el: DesignElement): boolean {
  return OPERAND_TYPES.has(el.type) && el.visible !== false
}

/* ---------- geometry sampling (mirrors renderShape in Canvas.tsx exactly) ---------- */

function sampleQuarterArc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 6): Pt[] {
  const out: Pt[] = []
  for (let i = 1; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps)
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

/** Local-coordinate polygon(s) for a shape element (before flip/rot/translate). */
function localShapePolys(el: DesignElement): Poly[] | null {
  const w = el.width
  const h = el.height
  if (w <= 0 || h <= 0) return null
  switch (el.type) {
    case 'rectangle': {
      const r = Math.min(el.cornerRadius || 0, w / 2, h / 2)
      if (r <= 0.01) {
        return [[{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]]
      }
      const pts: Pt[] = []
      // start at (r,0), walk CCW: bottom-right corner, right edge, etc.
      pts.push({ x: r, y: 0 })
      pts.push(...sampleQuarterArc(w - r, r, r, -Math.PI / 2, 0))        // br corner
      pts.push({ x: w, y: r })
      pts.push(...sampleQuarterArc(w - r, h - r, r, 0, Math.PI / 2))     // tr
      pts.push({ x: w - r, y: h })
      pts.push(...sampleQuarterArc(r, h - r, r, Math.PI / 2, Math.PI))    // tl
      pts.push({ x: 0, y: h - r })
      pts.push(...sampleQuarterArc(r, r, r, Math.PI, Math.PI * 1.5))     // bl
      return [pts]
    }
    case 'ellipse': {
      const cx = w / 2
      const cy = h / 2
      const n = 48
      const pts: Pt[] = []
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2
        pts.push({ x: cx + (w / 2) * Math.cos(a), y: cy + (h / 2) * Math.sin(a) })
      }
      return [pts]
    }
    case 'polygon': {
      const sides = el.sides || 6
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) / 2
      const pts: Pt[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
      return [pts]
    }
    case 'star': {
      const sides = el.sides || 5
      const innerRadiusPercent = el.innerRadius || 40
      const cx = w / 2
      const cy = h / 2
      const outerR = Math.min(w, h) / 2
      const innerR = outerR * (innerRadiusPercent / 100)
      const pts: Pt[] = []
      for (let i = 0; i < sides * 2; i++) {
        const a = (i * Math.PI) / sides - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
      return [pts]
    }
    case 'path': {
      const contours: VectorNetwork[] = el.booleanContours?.length
        ? el.booleanContours
        : [getVectorNetwork(el)]
      const out: Poly[] = []
      for (const net of contours) {
        if (!net || !net.segments?.length || !net.vertices?.length) continue
        const poly: Pt[] = []
        const first = net.vertices[net.segments[0].start]
        poly.push({ x: first.x, y: first.y })
        for (const seg of net.segments) {
          const s = net.vertices[seg.start]
          const e = net.vertices[seg.end]
          const hasT = seg.tangentStart || seg.tangentEnd
          const isLine = !hasT || (
            (!seg.tangentStart || (seg.tangentStart.x === 0 && seg.tangentStart.y === 0)) &&
            (!seg.tangentEnd || (seg.tangentEnd.x === 0 && seg.tangentEnd.y === 0))
          )
          if (isLine) {
            poly.push({ x: e.x, y: e.y })
          } else {
            // sample cubic: control points = tangent-relative offsets from endpoints
            const ts = seg.tangentStart ? { x: s.x + seg.tangentStart.x, y: s.y + seg.tangentStart.y } : { x: s.x, y: s.y }
            const te = seg.tangentEnd ? { x: e.x + seg.tangentEnd.x, y: e.y + seg.tangentEnd.y } : { x: e.x, y: e.y }
            for (let k = 1; k <= 12; k++) {
              const t = k / 12
              const mt = 1 - t
              const x = mt * mt * mt * s.x + 3 * mt * mt * t * ts.x + 3 * mt * t * t * te.x + t * t * t * e.x
              const y = mt * mt * mt * s.y + 3 * mt * mt * t * ts.y + 3 * mt * t * t * te.y + t * t * t * e.y
              poly.push({ x, y })
            }
          }
        }
        if (poly.length >= 3) out.push(poly)
      }
      return out.length ? out : null
    }
    default:
      return null
  }
}

/** Apply flip mirror + rotation (matching SVG render transform order) then translate. */
function toAbsolute(poly: Poly, el: DesignElement, ax: number, ay: number): Poly {
  const cx = el.width / 2
  const cy = el.height / 2
  const th = ((el.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const sx = el.flipH ? -1 : 1
  const sy = el.flipV ? -1 : 1
  return poly.map((p) => {
    // mirror about center (matches renderShape flip transform)
    let x = p.x
    let y = p.y
    if (sx === -1) x = el.width - x
    if (sy === -1) y = el.height - y
    // rotate about center
    const dx = x - cx
    const dy = y - cy
    const rx = cx + dx * cos - dy * sin
    const ry = cy + dx * sin + dy * cos
    return { x: rx + el.x + ax, y: ry + el.y + ay }
  })
}

/** Flatten an operand to absolute-coordinate Polys; null if unsupported. */
export function flattenOperand(el: DesignElement, absAncestor: { x: number; y: number }): Poly[] | null {
  if (!OPERAND_TYPES.has(el.type)) return null
  if (!el.visible) return null
  const local = localShapePolys(el)
  if (!local) return null
  return local.map((poly) => toAbsolute(ensureCCW(poly), el, absAncestor.x, absAncestor.y))
}

/** Build booleanContours (VectorNetwork[]) from absolute Polys relative to origin. */
export function polysToContours(polys: Poly[], origin: { x: number; y: number }): VectorNetwork[] {
  return polys.map((poly) => {
    const vertices = poly.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }))
    const segments = poly.map((_, i) => ({ start: i, end: (i + 1) % poly.length }))
    return { vertices, segments, closed: true }
  })
}

/** Contour bounds for placing the result element. */
export function contoursBounds(contours: VectorNetwork[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of contours) {
    for (const v of c.vertices) {
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Core element-level fold across operands (already flattened, absolute coords).
 * Returns normalized loops or a failure.
 */
export function foldElementPolys(operandPolys: Poly[][], op: BooleanOp): Poly[] | BooleanFailure {
  let acc: Poly[] = operandPolys[0]
  for (let i = 1; i < operandPolys.length; i++) {
    for (const loop of operandPolys[i]) {
      const r = foldOp(acc, loop, op)
      if (r === null) {
        return { ok: false, reason: `degenerate geometry at operand #${i + 1} (try nudging shapes)` }
      }
      acc = r
    }
  }
  const norm = normalizeLoops(acc)
  if (!norm.length) return { ok: false, reason: 'result is empty' }
  return norm
}

/* ============================================================
 * PHASE 17 — live boolean group geometry (display + flatten share this).
 * Latent PHASE 6 defect (proven live 2026-10-19, baseline script
 * scripts/p17_baseline.sh): boolean groups rendered as a bbox rect with the
 * first operand's fill — children invisible, no compositing anywhere
 * (Canvas case 'boolean' hit the default rect branch; FrameRenderer has no
 * 'boolean' case at all). Fix: bake the group's true geometry through the
 * same Greiner-Hormann engine (foldElementPolys) and render THAT.
 *
 * Display model (documented decision): the result path is painted with the
 * GROUP's own fill/stroke (which booleanOperation() sets from the backmost
 * operand) — deterministic and identical to what flattenSelection() persists.
 * Per-child paint compositing inside live boolean groups is UNKNOWN at
 * minified-source level and is not modeled.
 * ============================================================ */

/** Recursively collect absolute Polys for one operand
 *  (a plain shape, or a nested boolean group folded first). */
function collectOperandPolys(el: DesignElement, absAncestor: { x: number; y: number }): Poly[] | null {
  if (!el.visible) return null
  if (el.type === 'boolean') {
    const nested = foldGroupPolys(el)
    if (!nested) return null
    // nested group result is in the PARENT-of-nested coordinate space (canvas
    // absolute when the nested group sits at top level); shift by absAncestor
    // is not needed — foldGroupPolys returns absolute-to-canvas coords already.
    return nested
  }
  return flattenOperand(el, absAncestor)
}

/** Fold a boolean group's children into absolute Polys (canvas space). null on failure. */
function foldGroupPolys(group: DesignElement): Poly[] | null {
  const op = group.booleanOperation as BooleanOp
  if (!op || !group.children?.length) return null
  const operandPolys: Poly[][] = []
  for (const child of group.children) {
    const polys = collectOperandPolys(child, { x: 0, y: 0 })
    if (!polys) continue
    operandPolys.push(polys)
  }
  if (!operandPolys.length) return null
  const r = foldElementPolys(operandPolys, op)
  if (!Array.isArray(r) || !r.length) return null
  return r
}

const groupContoursCache = new WeakMap<object, VectorNetwork[] | null>()

/**
 * Baked geometry of a boolean group, as contours RELATIVE to the group's own
 * x/y (ready for `<path>` inside the group's translate(g)). null when the
 * group can't be folded (unsupported operand / degenerate geometry).
 */
export function getBooleanGroupContours(group: DesignElement): VectorNetwork[] | null {
  if (group.type !== 'boolean') return null
  const cached = groupContoursCache.get(group)
  if (cached !== undefined) return cached
  let out: VectorNetwork[] | null = null
  const polys = foldGroupPolys(group)
  if (polys && polys.length) {
    const contours = polysToContours(polys, { x: group.x, y: group.y })
    if (contours.length) out = contours
  }
  groupContoursCache.set(group, out)
  return out
}

/** Concatenated multi-subpath `d` for a boolean group's baked geometry ('' if none). */
export function booleanGroupPathD(group: DesignElement): string {
  const contours = getBooleanGroupContours(group)
  if (!contours) return ''
  return contours
    .map((net) => net.vertices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x} ${v.y}`).join(' ') + ' Z')
    .join(' ')
}
