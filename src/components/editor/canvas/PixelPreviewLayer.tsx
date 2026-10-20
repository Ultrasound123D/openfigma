'use client'

/**
 * PHASE 21 (VW18) — Pixel preview layer.
 *
 * Source evidence:
 *   - js_bundles/8014-cb16…: `activeCanvasPixelPreview`, `activeCanvasRetinaMode`
 *   - js/9456-781c…: action `toggle-pixel-preview` (property activeCanvasPixelPreview)
 *
 * Behavior (Figma pixel preview parity): when enabled, the scene is rasterized
 * at true device resolution (1 CSS px = 1 device px; Retina mode uses
 * devicePixelRatio) and displayed with nearest-neighbor scaling, so at zoom ≠ 100%
 * you see exactly how the exported 1x/retina raster looks (pixel blocks above
 * 100%, merged pixels below).
 *
 * Implementation: builds a MINIMAL SVG document from the live scene —
 * <defs> (gradients/filters/clipPaths) + the [data-scene] subtree wrapped in a
 * group applying the same translate/scale as the canvas — rasterized via an
 * <img> into a backing canvas. Scene <image> fills reference blob:/http: URLs,
 * which are BLOCKED in SVG-as-image secure-static mode, so they are inlined to
 * data: URIs (cached) before serialization.
 *
 * KNOWN LIMITATION (documented): SVG-as-image cannot use document webfonts, so
 * text glyphs raster with the system fallback stack. Figma rasters text with
 * the real font engine; matching that would require embedding font data-URIs
 * (out of scope, documented per STRICT rules).
 */

import React, { useEffect, useRef } from 'react'

interface PixelPreviewLayerProps {
  /** Live scene SVG element (the one containing <defs> + [data-scene] group). */
  svgRef: React.RefObject<SVGSVGElement | null>
  /** Pixel preview is enabled and zoom ≠ 100%. */
  active: boolean
  /** Retina raster (source: activeCanvasRetinaMode) — rasterize at devicePixelRatio. */
  retina: boolean
  zoom: number
  panX: number
  panY: number
  centerX: number
  centerY: number
  width: number
  height: number
  /** Version counter that bumps whenever the scene content changes. */
  sceneVersion: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** blob:/http: image hrefs → data: URIs (secure-static mode requires inline data). */
async function inlineImageHrefs(root: Element, cache: Map<string, string>): Promise<void> {
  const images = Array.from(root.querySelectorAll('image'))
  await Promise.all(images.map(async (img) => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href')
    if (!href || href.startsWith('data:')) return
    let dataUri = cache.get(href)
    if (!dataUri) {
      try {
        const blob = await (await fetch(href)).blob()
        dataUri = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result))
          fr.onerror = reject
          fr.readAsDataURL(blob)
        })
        cache.set(href, dataUri)
      } catch {
        return // leave as-is; the raster just omits that image
      }
    }
    img.setAttribute('href', dataUri)
    img.removeAttribute('xlink:href')
  }))
}

export function PixelPreviewLayer({
  svgRef, active, retina, zoom, panX, panY, centerX, centerY, width, height, sceneVersion,
}: PixelPreviewLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const tokenRef = useRef(0)
  const hrefCacheRef = useRef(new Map<string, string>())

  useEffect(() => {
    if (!active || !svgRef.current || width <= 0 || height <= 0) return

    const rasterize = async () => {
      rafRef.current = null
      const svg = svgRef.current
      const canvas = canvasRef.current
      if (!svg || !canvas) return

      const dpr = retina ? Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1))) : 1
      // viewport rect in canvas coordinates (inverse of translate(center)·scale(zoom))
      const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
      const vx = -centerX / safeZoom
      const vy = -centerY / safeZoom
      const vw = width / safeZoom
      const vh = height / safeZoom

      const token = ++tokenRef.current

      // grab the live defs + scene subtree
      const liveDefs = svg.querySelector('defs')
      const liveScene = svg.querySelector('g[data-scene="1"]')
      if (!liveScene) return

      // build a minimal standalone SVG (defs + scene). The viewBox alone applies
      // the canvas mapping: raster = (canvasCoord - v) * (rasterSize / vSize),
      // which equals translate(center)·scale(zoom) — do NOT also wrap the scene
      // in a transform group or the mapping is applied twice.
      const out = document.createElementNS(SVG_NS, 'svg')
      out.setAttribute('xmlns', SVG_NS)
      out.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      if (liveDefs) out.appendChild(liveDefs.cloneNode(true))
      const sceneClone = liveScene.cloneNode(true) as SVGGElement
      // the live scene group is hidden (visibility) while pixel preview shows the
      // raster — the clone must render, so strip that inline style
      sceneClone.removeAttribute('style')
      out.appendChild(sceneClone)
      out.setAttribute('width', String(Math.round(width * dpr)))
      out.setAttribute('height', String(Math.round(height * dpr)))
      out.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`)

      // inline blob/http image fills (secure-static mode blocks external refs)
      await inlineImageHrefs(out, hrefCacheRef.current)
      if (token !== tokenRef.current || !canvasRef.current) return

      const xml = new XMLSerializer().serializeToString(out)
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        URL.revokeObjectURL(url)
        if (token !== tokenRef.current || !canvasRef.current) return
        const c = canvasRef.current
        c.width = Math.round(width * dpr)
        c.height = Math.round(height * dpr)
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, c.width, c.height)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, c.width, c.height)
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => { void rasterize() })
    return () => {
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [active, retina, zoom, panX, panY, centerX, centerY, width, height, sceneVersion, svgRef])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ imageRendering: 'pixelated' }}
      aria-label="Pixel preview raster"
    />
  )
}
