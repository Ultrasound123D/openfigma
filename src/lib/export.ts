/**
 * PHASE 3 — Unified export pipeline: PNG / JPG / SVG / PDF / WEBP
 * (GAP G4 closure — see ARCHITECTURE.md "PHASE 3", DECISION-003).
 *
 * Zero new packages: html-to-image (raster), jsPDF (PDF), XMLSerializer
 * (SVG), canvas.toBlob (WEBP re-encode). All browser-standard APIs.
 *
 * Two entry points:
 *   exportDesign(opts)      — exports the live canvas scene SVG
 *                             (.canvas-svg-export, rendered by Canvas.tsx)
 *   exportElement(el, opts) — renders a single element (with children)
 *                             offscreen through the same SVG model, so
 *                             element-level exports match the canvas render.
 */

import { DesignElement } from '@/store/editor-store'
import { pathElementToSvgPath, isEvenOddFill } from '@/lib/element-utils'
import { calculateAutoLayout, hasAutoLayout } from '@/lib/auto-layout'
// PHASE 17 — ellipse arc + live boolean baked geometry
import { ellipseShapePath, arcIsEvenOdd } from '@/lib/arc'
import { booleanGroupPathD } from '@/lib/boolean-ops'

export type ExportFormat = 'PNG' | 'JPG' | 'SVG' | 'PDF' | 'WEBP'

export const EXPORT_FORMATS: ExportFormat[] = ['PNG', 'JPG', 'SVG', 'PDF', 'WEBP']

export interface ExportOptions {
  format: ExportFormat
  /** raster scale multiplier (1 | 2 | 4) */
  scale?: number
  /** JPG/WEBP quality 0..1 */
  quality?: number
  /** base file name without extension */
  fileName?: string
}

const MIME: Record<ExportFormat, string> = {
  PNG: 'image/png',
  JPG: 'image/jpeg',
  SVG: 'image/svg+xml',
  PDF: 'application/pdf',
  WEBP: 'image/webp',
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function safeName(name: string): string {
  return (name || 'design').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 60)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/** Re-encode a raster dataURL into a target mime via canvas.toBlob. */
async function reencodeToBlob(dataUrl: string, mime: string, quality: number): Promise<Blob> {
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`reencodeToBlob: failed to load ${mime} source`))
    img.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('reencodeToBlob: no 2d context')
  if (mime === 'image/jpeg') {
    // JPG has no alpha — paint the mandatory white backing first
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`canvas.toBlob(${mime}) returned null`))),
      mime,
      quality
    )
  })
}

/* ------------------------------------------------------------------ */
/* whole-canvas export (the live .canvas-svg-export element)           */
/* ------------------------------------------------------------------ */

function getCanvasExportRoot(): SVGElement | null {
  return document.querySelector('.canvas-svg-export') as SVGElement | null
}

/**
 * Export the live canvas scene in any of the five formats.
 * SVG serializes the scene DOM; PDF rasterizes at 2x then embeds in a
 * jsPDF page sized to the scene bounds; rasters go through html-to-image.
 */
export async function exportDesign(opts: ExportOptions): Promise<void> {
  const { format, scale = 2, quality = 0.92, fileName = 'design' } = opts
  const svgEl = getCanvasExportRoot()
  if (!svgEl) {
    console.error('exportDesign: no .canvas-svg-export element on the page')
    return
  }

  const base = `${safeName(fileName)}`

  switch (format) {
    case 'SVG': {
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgEl)
      downloadBlob(new Blob([svgString], { type: MIME.SVG }), `${base}.svg`)
      return
    }
    case 'PNG': {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(svgEl as unknown as HTMLElement, {
        quality: 1,
        pixelRatio: scale,
        backgroundColor: undefined,
      })
      downloadDataUrl(dataUrl, `${base}@${scale}x.png`)
      return
    }
    case 'JPG': {
      const { toPng } = await import('html-to-image')
      // html-to-image toJpeg renders text poorly in some engines; raster to
      // PNG first, then re-encode on a white backing (DECISION-003).
      const dataUrl = await toPng(svgEl as unknown as HTMLElement, {
        quality: 1,
        pixelRatio: scale,
        backgroundColor: undefined,
      })
      const blob = await reencodeToBlob(dataUrl, 'image/jpeg', quality)
      downloadBlob(blob, `${base}@${scale}x.jpg`)
      return
    }
    case 'WEBP': {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(svgEl as unknown as HTMLElement, {
        quality: 1,
        pixelRatio: scale,
        backgroundColor: undefined,
      })
      const blob = await reencodeToBlob(dataUrl, 'image/webp', quality)
      downloadBlob(blob, `${base}@${scale}x.webp`)
      return
    }
    case 'PDF': {
      const { toPng } = await import('html-to-image')
      const { default: jsPDF } = await import('jspdf')
      const dataUrl = await toPng(svgEl as unknown as HTMLElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
      })
      const w = svgEl.clientWidth || svgEl.getBoundingClientRect().width
      const h = svgEl.clientHeight || svgEl.getBoundingClientRect().height
      const pdf = new jsPDF({
        orientation: w >= h ? 'landscape' : 'portrait',
        unit: 'px',
        format: [Math.max(1, w), Math.max(1, h)],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, Math.max(1, w), Math.max(1, h))
      pdf.save(`${base}.pdf`)
      return
    }
  }
}

/* ------------------------------------------------------------------ */
/* single-element export (offscreen SVG through the data model)        */
/* ------------------------------------------------------------------ */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Resolve the fill attribute for the offscreen renderer. */
function fillAttrOf(el: DesignElement): string {
  const fill = el.fills?.[0]
  if (fill) {
    if (fill.visible === false) return 'none'
    if (fill.type === 'solid') return fill.color === 'transparent' ? 'none' : fill.color
    if (fill.type === 'image' && fill.imageUrl) return `url(#exp-img-${el.id})`
    // PHASE 17 — pattern paint (tile repeat)
    if (fill.type === 'pattern' && fill.imageUrl) return `url(#exp-pat-${el.id})`
    // gradients are approximated by their first stop color offscreen
    if ((fill.type === 'linear-gradient' || fill.type === 'radial-gradient') && fill.gradientStops?.length) {
      return fill.gradientStops[0].color
    }
  }
  return el.fill === 'transparent' ? 'none' : el.fill
}

function appendDefs(target: SVGElement, el: DesignElement) {
  const fill = el.fills?.[0]
  if (fill?.type === 'image' && fill.imageUrl) {
    const defs = document.createElementNS(SVG_NS, 'defs')
    const pattern = document.createElementNS(SVG_NS, 'pattern')
    pattern.setAttribute('id', `exp-img-${el.id}`)
    pattern.setAttribute('width', '100%')
    pattern.setAttribute('height', '100%')
    pattern.setAttribute('patternContentUnits', 'objectBoundingBox')
    const image = document.createElementNS(SVG_NS, 'image')
    image.setAttribute('href', fill.imageUrl)
    image.setAttribute('x', '0')
    image.setAttribute('y', '0')
    image.setAttribute('width', '1')
    image.setAttribute('height', '1')
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice')
    pattern.appendChild(image)
    defs.appendChild(pattern)
    target.appendChild(defs)
  }
  // PHASE 17 — pattern paint (tile repeat, source parity)
  if (fill?.type === 'pattern' && fill.imageUrl) {
    const sc = fill.patternScale && fill.patternScale > 0 ? fill.patternScale : 1
    const tw = String(Math.max(1, (fill.patternW || 100) * sc))
    const th = String(Math.max(1, (fill.patternH || 100) * sc))
    const defs = document.createElementNS(SVG_NS, 'defs')
    const pattern = document.createElementNS(SVG_NS, 'pattern')
    pattern.setAttribute('id', `exp-pat-${el.id}`)
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    pattern.setAttribute('x', '0'); pattern.setAttribute('y', '0')
    pattern.setAttribute('width', tw); pattern.setAttribute('height', th)
    const image = document.createElementNS(SVG_NS, 'image')
    image.setAttribute('href', fill.imageUrl)
    image.setAttribute('x', '0'); image.setAttribute('y', '0')
    image.setAttribute('width', tw); image.setAttribute('height', th)
    image.setAttribute('preserveAspectRatio', 'none')
    pattern.appendChild(image)
    defs.appendChild(pattern)
    target.appendChild(defs)
  }
}

/**
 * Render a DesignElement (and its tree) into a detached <g>.
 * Mirrors the shapes of FrameRenderer/Canvas renderShape — DOM flavor.
 */
function renderTree(el: DesignElement, svg: SVGElement): SVGElement | null {
  if (!el.visible) return null

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('transform', `translate(${el.x}, ${el.y})${el.rotation ? ` rotate(${el.rotation} ${el.width / 2} ${el.height / 2})` : ''}`)
  appendDefs(g, el)

  const fillAttr = fillAttrOf(el)
  const strokeAttr = el.stroke === 'transparent' ? 'none' : el.stroke
  const dash = el.strokeStyle === 'dashed' ? '6 4' : el.strokeStyle === 'dotted' ? '2 2' : null
  const common = {
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': String(el.strokeWidth),
    'stroke-dasharray': dash ?? '',
    opacity: String(el.opacity / 100),
  }
  const set = (node: SVGElement, attrs: Record<string, string>) => {
    for (const [k, v] of Object.entries(attrs)) if (v !== '') node.setAttribute(k, v)
  }

  switch (el.type) {
    case 'rectangle':
    case 'frame':
    case 'group': {
      // groups render children only; frames/groups still draw their own bg
      const rect = document.createElementNS(SVG_NS, 'rect')
      set(rect, { ...common, x: '0', y: '0', width: String(el.width), height: String(el.height), rx: String(el.cornerRadius || 0) })
      g.appendChild(rect)
      break
    }
    case 'ellipse': {
      // PHASE 17 — arc-aware: pie/donut path when arc data present
      if (el.arc) {
        const d = ellipseShapePath(el.width, el.height, el.arc)
        if (d) {
          const p = document.createElementNS(SVG_NS, 'path')
          const attrs: Record<string, string> = { ...common, d, 'stroke-linejoin': 'round' }
          if (arcIsEvenOdd(el.arc)) attrs['fill-rule'] = 'evenodd'
          set(p, attrs)
          g.appendChild(p)
          break
        }
      }
      const ellipse = document.createElementNS(SVG_NS, 'ellipse')
      set(ellipse, { ...common, cx: String(el.width / 2), cy: String(el.height / 2), rx: String(el.width / 2), ry: String(el.height / 2) })
      g.appendChild(ellipse)
      break
    }
    case 'boolean': {
      // PHASE 17 — export the true baked geometry (was: default rect)
      const d = booleanGroupPathD(el)
      if (d) {
        const p = document.createElementNS(SVG_NS, 'path')
        const attrs: Record<string, string> = { ...common, d, 'fill-rule': 'evenodd', 'stroke-linejoin': 'round' }
        set(p, attrs)
        g.appendChild(p)
      } else {
        const rect = document.createElementNS(SVG_NS, 'rect')
        set(rect, { ...common, x: '0', y: '0', width: String(el.width), height: String(el.height) })
        g.appendChild(rect)
      }
      break
    }
    case 'line': {
      const line = document.createElementNS(SVG_NS, 'line')
      set(line, {
        x1: '0', y1: '0', x2: String(el.width), y2: String(el.height),
        stroke: el.stroke === 'transparent' ? '#000000' : el.stroke,
        'stroke-width': String(el.strokeWidth || 2),
        'stroke-dasharray': dash ?? '',
        'stroke-linecap': 'round',
        opacity: String(el.opacity / 100),
      })
      g.appendChild(line)
      break
    }
    case 'text': {
      const fontSize = el.fontSize || 18
      const lineHeightPx = fontSize * (el.lineHeight || 1.4)
      const lines = (el.textContent || 'Text').split('\n')
      const startY = (el.height - lines.length * lineHeightPx) / 2 + fontSize
      const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'
      const x = el.textAlign === 'center' ? el.width / 2 : el.textAlign === 'right' ? el.width : 0
      lines.forEach((line, i) => {
        const text = document.createElementNS(SVG_NS, 'text')
        set(text, {
          x: String(x), y: String(startY + i * lineHeightPx),
          'font-size': String(fontSize),
          'font-weight': String(el.fontWeight || 400),
          'font-family': el.fontFamily || 'Inter, system-ui, sans-serif',
          'letter-spacing': String(el.letterSpacing || 0),
          fill: el.textColor || el.fill || '#000000',
          'text-anchor': anchor,
          opacity: String(el.opacity / 100),
        })
        text.textContent = line
        g.appendChild(text)
      })
      break
    }
    case 'polygon':
    case 'star': {
      const sides = el.sides || (el.type === 'star' ? 5 : 6)
      const cx = el.width / 2
      const cy = el.height / 2
      const outerR = Math.min(el.width, el.height) / 2
      const innerR = outerR * ((el.innerRadius || 40) / 100)
      const pts: string[] = []
      const count = el.type === 'star' ? sides * 2 : sides
      for (let i = 0; i < count; i++) {
        const angle = el.type === 'star' ? (i * Math.PI) / sides - Math.PI / 2 : (i * 2 * Math.PI) / sides - Math.PI / 2
        const r = el.type === 'star' ? (i % 2 === 0 ? outerR : innerR) : outerR
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
      }
      const poly = document.createElementNS(SVG_NS, 'polygon')
      set(poly, { ...common, points: pts.join(' ') })
      g.appendChild(poly)
      break
    }
    case 'path': {
      const d = pathElementToSvgPath(el)
      if (d) {
        const path = document.createElementNS(SVG_NS, 'path')
        const attrs: Record<string, string> = { ...common, d, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
        if (isEvenOddFill(el)) attrs['fill-rule'] = 'evenodd'
        set(path, attrs)
        g.appendChild(path)
      }
      break
    }
    default: {
      const rect = document.createElementNS(SVG_NS, 'rect')
      set(rect, { ...common, x: '0', y: '0', width: String(el.width), height: String(el.height) })
      g.appendChild(rect)
    }
  }

  // children (auto-layout applied when the frame uses it)
  // PHASE 6: mask semantics — a mask child clips all previous siblings + itself
  if (el.children && el.children.length > 0) {
    const effective = el.type === 'frame' && hasAutoLayout(el) ? calculateAutoLayout(el) : el.children
    const groups: SVGElement[] = []
    let buffer: SVGElement[] = []
    for (const child of effective) {
      if (!child.visible) continue
      if (child.isMask) {
        const clipId = `exp-mask-${el.id}-${child.id}`
        const clipShape = exportMaskClipShape(child)
        const childG = renderTree(child, svg)
        if (clipShape && childG) {
          const defs = document.createElementNS(SVG_NS, 'defs')
          const clip = document.createElementNS(SVG_NS, 'clipPath')
          clip.setAttribute('id', clipId)
          const cg = document.createElementNS(SVG_NS, 'g')
          cg.setAttribute('transform', `translate(${child.x}, ${child.y})${child.rotation ? ` rotate(${child.rotation} ${child.width / 2} ${child.height / 2})` : ''}`)
          cg.appendChild(clipShape)
          clip.appendChild(cg)
          defs.appendChild(clip)
          const clipped = document.createElementNS(SVG_NS, 'g')
          clipped.setAttribute('clip-path', `url(#${clipId})`)
          for (const b of buffer) clipped.appendChild(b)
          clipped.appendChild(childG)
          const wrap = document.createElementNS(SVG_NS, 'g')
          wrap.appendChild(defs)
          wrap.appendChild(clipped)
          groups.push(wrap)
          buffer = []
        } else if (childG) {
          buffer.push(childG)
        }
      } else {
        const childG = renderTree(child, svg)
        if (childG) buffer.push(childG)
      }
    }
    groups.push(...buffer)
    for (const grp of groups) g.appendChild(grp)
  }

  return g
}

/** PHASE 6: clip geometry for a mask child (local coords, SVG DOM). */
function exportMaskClipShape(mask: DesignElement): SVGElement | null {
  switch (mask.type) {
    case 'rectangle': {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', '0'); rect.setAttribute('y', '0')
      rect.setAttribute('width', String(mask.width)); rect.setAttribute('height', String(mask.height))
      rect.setAttribute('rx', String(mask.cornerRadius || 0))
      return rect
    }
    case 'ellipse': {
      // PHASE 17 — arc-aware mask shape
      if (mask.arc) {
        const md = ellipseShapePath(mask.width, mask.height, mask.arc)
        if (md) {
          const p = document.createElementNS(SVG_NS, 'path')
          p.setAttribute('d', md)
          if (arcIsEvenOdd(mask.arc)) p.setAttribute('fill-rule', 'evenodd')
          return p
        }
      }
      const ell = document.createElementNS(SVG_NS, 'ellipse')
      ell.setAttribute('cx', String(mask.width / 2)); ell.setAttribute('cy', String(mask.height / 2))
      ell.setAttribute('rx', String(mask.width / 2)); ell.setAttribute('ry', String(mask.height / 2))
      return ell
    }
    case 'polygon': {
      const sides = mask.sides || 6
      const r = Math.min(mask.width, mask.height) / 2
      const pts: string[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides - Math.PI / 2
        pts.push(`${(mask.width / 2) + r * Math.cos(a)},${(mask.height / 2) + r * Math.sin(a)}`)
      }
      const poly = document.createElementNS(SVG_NS, 'polygon')
      poly.setAttribute('points', pts.join(' '))
      return poly
    }
    case 'star': {
      const sides = mask.sides || 5
      const outerR = Math.min(mask.width, mask.height) / 2
      const innerR = outerR * ((mask.innerRadius || 40) / 100)
      const pts: string[] = []
      for (let i = 0; i < sides * 2; i++) {
        const a = (i * Math.PI) / sides - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        pts.push(`${(mask.width / 2) + r * Math.cos(a)},${(mask.height / 2) + r * Math.sin(a)}`)
      }
      const poly = document.createElementNS(SVG_NS, 'polygon')
      poly.setAttribute('points', pts.join(' '))
      return poly
    }
    case 'path': {
      const d = pathElementToSvgPath(mask)
      if (!d) return null
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', d)
      if (isEvenOddFill(mask)) path.setAttribute('fill-rule', 'evenodd')
      return path
    }
    default:
      return null
  }
}

/** Build a detached, export-ready <svg> for a single element. */
export function buildElementSvg(element: DesignElement, scale = 1): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('xmlns', SVG_NS)
  svg.setAttribute('width', String(element.width * scale))
  svg.setAttribute('height', String(element.height * scale))
  svg.setAttribute('viewBox', `0 0 ${element.width} ${element.height}`)
  svg.classList.add('canvas-svg-export')

  // The root element itself is the canvas: render its tree at (0,0).
  const root = { ...element, x: 0, y: 0 }
  const g = renderTree(root, svg)
  if (g) svg.appendChild(g)
  return svg
}

/** Rasterize a detached SVG element to a dataURL via html-to-image. */
async function rasterizeDetached(
  svg: SVGSVGElement,
  opts: { scale: number; background?: string }
): Promise<string> {
  svg.style.position = 'absolute'
  svg.style.left = '-99999px'
  svg.style.top = '-99999px'
  document.body.appendChild(svg)
  try {
    const { toPng } = await import('html-to-image')
    return await toPng(svg as unknown as HTMLElement, {
      quality: 1,
      pixelRatio: opts.scale,
      backgroundColor: opts.background,
    })
  } finally {
    document.body.removeChild(svg)
  }
}

/**
 * Export one element (frame/shape/text/tree) in any of the five formats.
 * The element is rendered offscreen — the editor canvas is untouched.
 */
export async function exportElement(element: DesignElement, opts: ExportOptions): Promise<void> {
  const { format, scale = 2, quality = 0.92, fileName } = opts
  const base = safeName(fileName || element.name)

  switch (format) {
    case 'SVG': {
      const svg = buildElementSvg(element, 1)
      const str = new XMLSerializer().serializeToString(svg)
      downloadBlob(new Blob([str], { type: MIME.SVG }), `${base}.svg`)
      return
    }
    case 'PNG': {
      const dataUrl = await rasterizeDetached(buildElementSvg(element, 1), { scale })
      downloadDataUrl(dataUrl, `${base}@${scale}x.png`)
      return
    }
    case 'JPG': {
      const dataUrl = await rasterizeDetached(buildElementSvg(element, 1), { scale })
      const blob = await reencodeToBlob(dataUrl, 'image/jpeg', quality)
      downloadBlob(blob, `${base}@${scale}x.jpg`)
      return
    }
    case 'WEBP': {
      const dataUrl = await rasterizeDetached(buildElementSvg(element, 1), { scale })
      const blob = await reencodeToBlob(dataUrl, 'image/webp', quality)
      downloadBlob(blob, `${base}@${scale}x.webp`)
      return
    }
    case 'PDF': {
      const { default: jsPDF } = await import('jspdf')
      const dataUrl = await rasterizeDetached(buildElementSvg(element, 1), { scale: 2, background: '#FFFFFF' })
      const pdf = new jsPDF({
        orientation: element.width >= element.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [Math.max(1, element.width), Math.max(1, element.height)],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, Math.max(1, element.width), Math.max(1, element.height))
      pdf.save(`${base}.pdf`)
      return
    }
  }
}

/* ------------------------------------------------------------------ */
/* Backwards-compatible wrappers (used by TopBar quick actions)        */
/* ------------------------------------------------------------------ */

export async function exportAsPNG(scale: number = 2): Promise<void> {
  return exportDesign({ format: 'PNG', scale })
}

export async function exportAsSVG(): Promise<void> {
  return exportDesign({ format: 'SVG' })
}

export async function exportAsPDF(): Promise<void> {
  return exportDesign({ format: 'PDF' })
}

export async function exportElementAsPNG(element: DesignElement, scale: number = 2): Promise<void> {
  return exportElement(element, { format: 'PNG', scale })
}
