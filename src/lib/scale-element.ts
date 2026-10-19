/**
 * PHASE 11 — Scale tool engine: proportional scaling of EVERYTHING.
 *
 * Figma's Scale tool (K) scales geometry + all "size-carrying" properties,
 * recursively for children:
 *   geometry        x, y, width, height (about an anchor point)
 *   text            fontSize, letterSpacing (lineHeight is a multiplier — kept)
 *   corners         cornerRadius + per-corner radii
 *   strokes         strokeWidth
 *   vector          pathPoints, vectorNetwork vertices/vertices tangents
 *   effects         shadow x/y/blur/spread, blur radius
 *   auto-layout     paddings, gap
 *   polygons        sides kept; innerRadius is % — kept
 */

import type { DesignElement } from '@/store/editor-store'

export function scaleElementBy(
  el: DesignElement,
  factor: number,
  originX: number,
  originY: number
): DesignElement {
  if (!isFinite(factor) || factor <= 0 || factor === 1) return el
  const next: DesignElement = {
    ...el,
    x: originX + (el.x - originX) * factor,
    y: originY + (el.y - originY) * factor,
    width: Math.max(1, el.width * factor),
    height: Math.max(1, el.height * factor),
  }

  // corners
  next.cornerRadius = (el.cornerRadius || 0) * factor
  next.cornerRadiusTL = (el.cornerRadiusTL || 0) * factor
  next.cornerRadiusTR = (el.cornerRadiusTR || 0) * factor
  next.cornerRadiusBL = (el.cornerRadiusBL || 0) * factor
  next.cornerRadiusBR = (el.cornerRadiusBR || 0) * factor

  // strokes
  next.strokeWidth = (el.strokeWidth || 0) * factor

  // text
  if (el.type === 'text') {
    if (el.fontSize) next.fontSize = Math.max(1, el.fontSize * factor)
    if (el.letterSpacing) next.letterSpacing = el.letterSpacing * factor
  }

  // vector data (legacy points)
  if (el.pathPoints) {
    next.pathPoints = el.pathPoints.map((p) => ({
      ...p,
      x: p.x * factor,
      y: p.y * factor,
      cx1: p.cx1 !== undefined ? p.cx1 * factor : undefined,
      cy1: p.cy1 !== undefined ? p.cy1 * factor : undefined,
      cx2: p.cx2 !== undefined ? p.cx2 * factor : undefined,
      cy2: p.cy2 !== undefined ? p.cy2 * factor : undefined,
    }))
  }
  // vector network
  if (el.vectorNetwork) {
    next.vectorNetwork = {
      ...el.vectorNetwork,
      vertices: el.vectorNetwork.vertices.map((v) => ({ ...v, x: v.x * factor, y: v.y * factor })),
    }
  }
  // PHASE 6 multi-contours
  if (el.booleanContours) {
    next.booleanContours = el.booleanContours.map((c) => ({
      ...c,
      vertices: c.vertices.map((v) => ({ ...v, x: v.x * factor, y: v.y * factor })),
    }))
  }

  // effects
  if (el.shadows) {
    next.shadows = el.shadows.map((s) => ({
      ...s,
      x: s.x * factor,
      y: s.y * factor,
      blur: s.blur * factor,
      spread: (s.spread || 0) * factor,
    }))
  }
  if (el.blurs) {
    next.blurs = el.blurs.map((b) => ({ ...b, radius: b.radius * factor }))
  }

  // auto layout paddings
  if (el.autoLayout) {
    next.autoLayout = {
      ...el.autoLayout,
      gap: el.autoLayout.gap * factor,
      paddingTop: el.autoLayout.paddingTop * factor,
      paddingBottom: el.autoLayout.paddingBottom * factor,
      paddingLeft: el.autoLayout.paddingLeft * factor,
      paddingRight: el.autoLayout.paddingRight * factor,
    }
  }

  // children (recursive — child coords are parent-relative, uniform scaling
  // keeps them correct: x*f, y*f, w*f, h*f)
  if (el.children) {
    next.children = el.children.map((c) => scaleElementBy(c, factor, 0, 0))
  }

  return next
}
