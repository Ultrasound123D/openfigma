/**
 * arc.ts — PHASE 17 (P4). Ellipse arc geometry.
 *
 * Source evidence (port-source/figmajsx, figma_app-*.min.js):
 *   transform_panel--arcToolInputsUi3 / --arcToolStart-- / --arcToolSweep--
 *   / --arcToolRatio--  → the arc tool has exactly three inputs:
 *   Start (deg), Sweep (deg), Ratio (inner radius ratio).
 *   Command enum CREATE_ARC=231 also exists (SLIDES/COOPER/SITES editors);
 *   the DESIGN surface gets the transform-panel inputs — that is what we port.
 *
 * Model on the element: `arc: { start: number; sweep: number; innerRatio: number }`
 *   - start: degrees, 0 = 3 o'clock, positive clockwise (SVG y-down convention)
 *   - sweep: degrees extent; positive = clockwise; |sweep| may exceed 360 (winds)
 *   - innerRatio: 0..1 — 0 = pie slice (closes to center), >0 = donut ring
 *
 * Rendering semantics (documented, deterministic):
 *   - sweep >= 360 && innerRatio > 0  → full donut (two ellipses, evenodd)
 *   - sweep >= 360 && innerRatio == 0 → full ellipse (arc ignored geometrically)
 *   - otherwise                       → pie / donut path
 */

export interface EllipseArc {
  start: number
  sweep: number
  innerRatio: number
}

const D2R = Math.PI / 180

function pt(cx: number, cy: number, rx: number, ry: number, deg: number): { x: number; y: number } {
  const a = deg * D2R
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
}

/** Full-ellipse path (two arc commands) — used when arc data means "no cut". */
export function fullEllipsePath(w: number, h: number): string {
  const rx = w / 2
  const ry = h / 2
  if (rx <= 0 || ry <= 0) return ''
  return `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${-rx} 0 A ${rx} ${ry} 0 1 1 ${rx} 0 Z`
}

/** SVG path for a pie slice / donut cut of an ellipse. Local coords (0,0 top-left). */
export function ellipseArcPath(w: number, h: number, arc: EllipseArc): string {
  const rx = w / 2
  const ry = h / 2
  if (rx <= 0 || ry <= 0) return ''

  const sweepFull = Math.abs(arc.sweep) >= 360
  if (sweepFull && !(arc.innerRatio > 0)) return fullEllipsePath(w, h)
  if (sweepFull && arc.innerRatio > 0) {
    // full donut: outer ellipse + inner ellipse (evenodd by caller)
    const irx = rx * clamp01(arc.innerRatio)
    const iry = ry * clamp01(arc.innerRatio)
    if (irx <= 0 || iry <= 0) return fullEllipsePath(w, h)
    return (
      `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${-rx} 0 A ${rx} ${ry} 0 1 1 ${rx} 0 Z ` +
      `M ${rx - irx} 0 A ${irx} ${iry} 0 1 0 ${rx + irx} 0 A ${irx} ${iry} 0 1 0 ${rx - irx} 0 Z`
    )
  }

  const start = arc.start ?? 0
  const sweep = arc.sweep ?? 0
  const end = start + sweep
  const large = Math.abs(sweep) > 180 ? 1 : 0
  const cw = sweep >= 0 ? 1 : 0
  const ccw = sweep >= 0 ? 0 : 1

  const p0 = pt(rx, ry, rx, ry, start)
  const p1 = pt(rx, ry, rx, ry, end)

  if (!(arc.innerRatio > 0)) {
    // pie slice: center → outer start → arc → close (through center)
    if (Math.abs(sweep) < 0.01) return ''
    return `M ${rx} ${ry} L ${p0.x} ${p0.y} A ${rx} ${ry} 0 ${large} ${cw} ${p1.x} ${p1.y} Z`
  }

  // donut: outer arc forward, then inner arc back
  const irx = rx * clamp01(arc.innerRatio)
  const iry = ry * clamp01(arc.innerRatio)
  if (irx <= 0 || iry <= 0) {
    return `M ${rx} ${ry} L ${p0.x} ${p0.y} A ${rx} ${ry} 0 ${large} ${cw} ${p1.x} ${p1.y} Z`
  }
  const q0 = pt(rx, ry, irx, iry, start)
  const q1 = pt(rx, ry, irx, iry, end)
  return (
    `M ${q0.x} ${q0.y} L ${p0.x} ${p0.y} ` +
    `A ${rx} ${ry} 0 ${large} ${cw} ${p1.x} ${p1.y} ` +
    `L ${q1.x} ${q1.y} ` +
    `A ${irx} ${iry} 0 ${large} ${ccw} ${q0.x} ${q0.y} Z`
  )
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Uniform entry: path d for an ellipse element that may carry arc data. */
export function ellipseShapePath(w: number, h: number, arc?: EllipseArc | null): string {
  if (!arc || arc === null) return fullEllipsePath(w, h)
  return ellipseArcPath(w, h, arc)
}

/** True when this arc data renders as multi-contour evenodd (donut). */
export function arcIsEvenOdd(arc?: EllipseArc | null): boolean {
  return !!arc && Math.abs(arc.sweep) >= 360 && arc.innerRatio > 0
}
