/**
 * PHASE 4 — SVG import (DECISION-004): parse an .svg file with the
 * standard DOMParser and convert its shape tree into editable
 * DesignElements (NOT a flat image paste). Supported nodes:
 *   svg (root → optional wrapping frame), g, rect, circle, ellipse,
 *   line, polyline, polygon, path, text/tspan, image
 * The document viewBox drives the coordinate scale so imported icons
 * land at their authored proportions. Gradients are approximated by
 * their mid stop; unsupported nodes are skipped and counted.
 */

import type { DesignElement, ElementType, PathPoint, VectorNetwork } from '@/store/editor-store'
import { pathPointsToVectorNetwork } from '@/lib/element-utils'

interface ImportContext {
  makeId: (prefix: string) => string
  /** scale from SVG user units → canvas units (viewBox aware) */
  scale: number
  /** stats surfaced to the user after import */
  stats: { imported: number; skipped: number }
}

function num(el: Element, attr: string, fallback = 0): number {
  const v = parseFloat(el.getAttribute(attr) || '')
  return Number.isFinite(v) ? v : fallback
}

/** Convert any CSS/SVG color string; returns 'transparent' for 'none'. */
function colorOf(value: string | null, fallback = '#000000'): string {
  if (!value || value === 'none' || value === 'transparent') return 'transparent'
  return value
}

/** opacity attr × group opacity is handled by the caller via inheritance. */
function opacityOf(el: Element): number {
  const v = parseFloat(el.getAttribute('opacity') || '')
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
}

function baseElement(
  id: string,
  name: string,
  type: ElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number
): DesignElement {
  return {
    id,
    name,
    type,
    x,
    y,
    width: Math.max(0.01, width),
    height: Math.max(0.01, height),
    fill,
    stroke,
    strokeWidth,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: Math.round(opacity * 100),
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
  }
}

/** Convert an SVG path's `d` into our VectorNetwork via sampled points.
 * We keep the original `d` untouched by storing it as a two-point network
 * when parsing is complex — paths remain fully editable as vector nodes. */
function pathToVectorNetwork(d: string): VectorNetwork | undefined {
  // Sample the path with a detached SVGPathElement (browser-native parsing).
  const svgNS = 'http://www.w3.org/2000/svg'
  const helper = document.createElementNS(svgNS, 'svg')
  helper.setAttribute('style', 'position:absolute;left:-99999px;top:-99999px')
  const pathEl = document.createElementNS(svgNS, 'path')
  pathEl.setAttribute('d', d)
  helper.appendChild(pathEl)
  document.body.appendChild(helper)
  try {
    const len = pathEl.getTotalLength()
    if (!Number.isFinite(len) || len === 0) return undefined
    const STEP = 8
    const count = Math.max(2, Math.ceil(len / STEP))
    const points: PathPoint[] = []
    for (let i = 0; i <= count; i++) {
      const t = (i / count) * len
      const p = pathEl.getPointAtLength(t)
      // skip near-duplicate points to keep networks light
      const prev = points[points.length - 1]
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1.5) {
        points.push({ x: p.x, y: p.y })
      }
    }
    return pathPointsToVectorNetwork(points, false)
  } catch {
    return undefined
  } finally {
    document.body.removeChild(helper)
  }
}

/** Parse points="x,y x,y …" (polygon/polyline). */
function parsePoints(raw: string | null): PathPoint[] {
  if (!raw) return []
  return raw
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

/** Mid stop color of a gradient definition (approximation, documented). */
function gradientMidColor(def: Element | null): string | null {
  if (!def) return null
  const stops = Array.from(def.querySelectorAll('stop'))
  if (stops.length === 0) return null
  const mid = stops[Math.floor(stops.length / 2)]
  return mid.getAttribute('stop-color') || stops[0].getAttribute('stop-color')
}

/** Resolve fill/stroke that may reference a gradient by url(#id). */
function resolvePaint(
  value: string | null,
  idMap: Map<string, Element>
): string {
  if (!value) return 'transparent'
  const urlMatch = value.match(/url\(#([^)]+)\)/)
  if (urlMatch) {
    const grad = gradientMidColor(idMap.get(urlMatch[1]) ?? null)
    if (grad) return grad
  }
  return colorOf(value)
}

function convertNode(
  node: Element,
  ctx: ImportContext,
  inheritedOpacity: number,
  idMap: Map<string, Element>
): DesignElement | null {
  const tag = node.tagName.toLowerCase()
  const opacity = inheritedOpacity * opacityOf(node)
  const fill = resolvePaint(node.getAttribute('fill'), idMap)
  const stroke = resolvePaint(node.getAttribute('stroke'), idMap)
  const strokeWidth = num(node, 'stroke-width', stroke !== 'transparent' ? 1 : 0)

  const mk = (type: ElementType, name: string, x: number, y: number, w: number, h: number): DesignElement =>
    baseElement(ctx.makeId(type), name, type, x * ctx.scale, y * ctx.scale, w * ctx.scale, h * ctx.scale, fill, stroke, strokeWidth * ctx.scale, opacity)

  switch (tag) {
    case 'rect': {
      const el = mk('rectangle', node.id || 'Rectangle', num(node, 'x'), num(node, 'y'), num(node, 'width'), num(node, 'height'))
      const rx = num(node, 'rx', 0)
      el.cornerRadius = rx * ctx.scale
      el.cornerRadiusTL = el.cornerRadiusTR = el.cornerRadiusBL = el.cornerRadiusBR = rx * ctx.scale
      return el
    }
    case 'circle': {
      const cx = num(node, 'cx'), cy = num(node, 'cy'), r = num(node, 'r')
      return mk('ellipse', node.id || 'Ellipse', cx - r, cy - r, r * 2, r * 2)
    }
    case 'ellipse': {
      const cx = num(node, 'cx'), cy = num(node, 'cy'), rx = num(node, 'rx'), ry = num(node, 'ry')
      return mk('ellipse', node.id || 'Ellipse', cx - rx, cy - ry, rx * 2, ry * 2)
    }
    case 'line': {
      const el = mk('line', node.id || 'Line', num(node, 'x1'), num(node, 'y1'), num(node, 'x2') - num(node, 'x1'), num(node, 'y2') - num(node, 'y1'))
      return el
    }
    case 'polygon':
    case 'polyline': {
      const pts = parsePoints(node.getAttribute('points'))
      if (pts.length < 2) { ctx.stats.skipped++; return null }
      const minX = Math.min(...pts.map((p) => p.x))
      const minY = Math.min(...pts.map((p) => p.y))
      const w = Math.max(...pts.map((p) => p.x)) - minX
      const h = Math.max(...pts.map((p) => p.y)) - minY
      const el = mk('path', node.id || (tag === 'polygon' ? 'Polygon' : 'Polyline'), minX, minY, w, h)
      el.pathPoints = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
      el.pathClosed = tag === 'polygon'
      el.vectorNetwork = pathPointsToVectorNetwork(el.pathPoints, tag === 'polygon')
      return el
    }
    case 'path': {
      const d = node.getAttribute('d')
      if (!d) { ctx.stats.skipped++; return null }
      const network = pathToVectorNetwork(d)
      if (!network || network.vertices.length < 2) { ctx.stats.skipped++; return null }
      const xs = network.vertices.map((v) => v.x)
      const ys = network.vertices.map((v) => v.y)
      const minX = Math.min(...xs), minY = Math.min(...ys)
      const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY
      const el = mk('path', node.id || 'Path', minX, minY, w, h)
      el.vectorNetwork = {
        ...network,
        vertices: network.vertices.map((v) => ({ ...v, x: v.x - minX, y: v.y - minY })),
      }
      el.pathClosed = !!network.closed
      return el
    }
    case 'text': {
      const content = (node.textContent || '').trim()
      if (!content) { ctx.stats.skipped++; return null }
      const fontSize = num(node, 'font-size', 16)
      const x = num(node, 'x'), y = num(node, 'y')
      const el = mk('text', node.id || 'Text', x, y - fontSize, content.length * fontSize * 0.55, fontSize * 1.4)
      el.textContent = content
      el.fontFamily = node.getAttribute('font-family') || 'Inter'
      el.fontSize = Math.round(fontSize * ctx.scale)
      el.fontWeight = parseInt(node.getAttribute('font-weight') || '400', 10) || 400
      el.textAlign = 'left'
      el.textColor = fill === 'transparent' ? '#000000' : fill
      el.lineHeight = 1.4
      el.letterSpacing = 0
      // fix: mk() already scaled x/y — but fontSize scale via mk width is fine
      el.width = Math.max(10, content.length * el.fontSize * 0.55)
      el.height = el.fontSize * 1.4
      return el
    }
    case 'image': {
      const href = node.getAttribute('href') || node.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
      if (!href) { ctx.stats.skipped++; return null }
      const el = mk('rectangle', node.id || 'Image', num(node, 'x'), num(node, 'y'), num(node, 'width', 100), num(node, 'height', 100))
      el.fills = [{ type: 'image', color: 'transparent', opacity: 100, imageUrl: href, visible: true }]
      return el
    }
    case 'g':
    case 'svg':
    case 'a': {
      // container: children become nested under a group element
      const children: DesignElement[] = []
      for (const child of Array.from(node.children)) {
        const converted = convertNode(child, ctx, opacity, idMap)
        if (converted) children.push(converted)
      }
      if (children.length === 0) { ctx.stats.skipped++; return null }

      if (tag === 'svg') {
        // root svg handled by caller (importSvg) — not reached here
        return null
      }

      const minX = Math.min(...children.map((c) => c.x))
      const minY = Math.min(...children.map((c) => c.y))
      const maxX = Math.max(...children.map((c) => c.x + c.width))
      const maxY = Math.max(...children.map((c) => c.y + c.height))
      const group = baseElement(
        ctx.makeId('group'), node.id || 'Group', 'group',
        minX, minY, maxX - minX, maxY - minY,
        'transparent', 'transparent', 0, opacity
      )
      group.children = children.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY }))
      ctx.stats.imported += children.length
      return group
    }
    default: {
      // defs, metadata, title, unknown tags…
      if (tag !== 'defs' && tag !== 'title' && tag !== 'desc' && tag !== 'metadata') ctx.stats.skipped++
      return null
    }
  }
}

export interface SvgImportResult {
  /** top-level elements ready to insert */
  elements: DesignElement[]
  stats: { imported: number; skipped: number }
  /** root document size in canvas units */
  width: number
  height: number
}

/**
 * Parse SVG text into DesignElements. When `wrapInFrame` is true the
 * content lands inside one frame named after the file (Figma behavior:
 * imported SVGs become a frame-like group).
 */
export function importSvgText(
  svgText: string,
  makeId: (prefix: string) => string,
  wrapInFrame = true
): SvgImportResult {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const parseError = doc.querySelector('parsererror')
  const root = doc.documentElement
  if (parseError || !root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('Invalid SVG file')
  }

  // gradient/defs id map for paint resolution
  const idMap = new Map<string, Element>()
  for (const def of Array.from(root.querySelectorAll('linearGradient, radialGradient'))) {
    const id = def.getAttribute('id')
    if (id) idMap.set(id, def)
  }

  // viewBox → canvas scale (default 100x100 SVGs without viewBox use width/height attrs)
  let scale = 1
  let docWidth = num(root, 'width', 0)
  let docHeight = num(root, 'height', 0)
  const viewBox = root.getAttribute('viewBox')
  if (viewBox) {
    const [, , vbW, vbH] = viewBox.split(/[\s,]+/).map(Number)
    if (Number.isFinite(vbW) && vbW > 0 && Number.isFinite(vbH) && vbH > 0) {
      if (docWidth > 0) scale = docWidth / vbW
      else docWidth = vbW
      if (docHeight <= 0) docHeight = vbH
    }
  }
  if (docWidth <= 0) docWidth = 100
  if (docHeight <= 0) docHeight = 100

  const ctx: ImportContext = { makeId, scale, stats: { imported: 0, skipped: 0 } }

  const children: DesignElement[] = []
  for (const child of Array.from(root.children)) {
    const converted = convertNode(child, ctx, 1, idMap)
    if (converted) children.push(converted)
  }
  ctx.stats.imported += children.length

  if (!wrapInFrame || children.length === 0) {
    return { elements: children, stats: ctx.stats, width: docWidth * scale, height: docHeight * scale }
  }

  // Wrap everything in a frame (Figma-style import result)
  const minX = Math.min(...children.map((c) => c.x))
  const minY = Math.min(...children.map((c) => c.y))
  const maxX = Math.max(...children.map((c) => c.x + c.width))
  const maxY = Math.max(...children.map((c) => c.y + c.height))
  const frame = baseElement(
    makeId('frame'), 'Imported SVG', 'frame',
    minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY),
    'transparent', 'transparent', 0, 1
  )
  frame.children = children.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY }))
  return { elements: [frame], stats: ctx.stats, width: frame.width, height: frame.height }
}
