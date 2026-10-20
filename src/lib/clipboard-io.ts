/**
 * PHASE 23 (F1–F4) — clipboard exports (source: 5018 design/dev context-menu
 * module: {action:"copy-as-png"} / "copy-as-svg" / "copy-text" /
 * "copy-layer-name", gated by isExportBlockedByApprovals / canAccessDevMode).
 *
 * Copy as PNG  → rasterize the element offscreen (existing export pipeline)
 *                and write a real PNG blob via the async Clipboard API
 *                (navigator.clipboard.write + ClipboardItem).
 * Copy as SVG  → serialized SVG markup as text/plain.
 * Copy text    → the text element's content as text/plain.
 * Copy layer name → the element's name as text/plain.
 *
 * All functions are fail-soft: when the Clipboard API is unavailable
 * (insecure context / Firefox image clipboard), they report via toast and
 * return false instead of throwing.
 */
import type { DesignElement } from '@/store/editor-store'
import { buildElementSvg } from '@/lib/export'
import { toast } from '@/hooks/use-toast'

async function elementPngBlob(element: DesignElement, scale = 2): Promise<Blob> {
  const svg = buildElementSvg(element, 1)
  svg.style.position = 'absolute'
  svg.style.left = '-99999px'
  svg.style.top = '-99999px'
  document.body.appendChild(svg)
  try {
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(svg as unknown as HTMLElement, {
      quality: 1,
      pixelRatio: scale,
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  } finally {
    document.body.removeChild(svg)
  }
}

function elementSvgMarkup(element: DesignElement): string {
  const svg = buildElementSvg(element, 1)
  return new XMLSerializer().serializeToString(svg)
}

/** F1 — Copy as PNG: PNG blob → system clipboard. */
export async function copyAsPngToClipboard(element: DesignElement, scale = 2): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      toast({ title: 'Copy as PNG unavailable', description: 'Clipboard image write is not supported in this browser.' })
      return false
    }
    const blob = await elementPngBlob(element, scale)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast({ title: `Copied as PNG (${Math.round(element.width * scale)}×${Math.round(element.height * scale)})` })
    return true
  } catch {
    toast({ title: 'Copy as PNG failed', description: 'The browser refused the clipboard write.' })
    return false
  }
}

/** F2 — Copy as SVG: serialized markup → clipboard text. */
export async function copyAsSvgToClipboard(element: DesignElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(elementSvgMarkup(element))
    toast({ title: 'Copied as SVG' })
    return true
  } catch {
    toast({ title: 'Copy as SVG failed', description: 'The browser refused the clipboard write.' })
    return false
  }
}

/** F3 — Copy text: the text element's characters → clipboard text. */
export async function copyTextToClipboard(element: DesignElement): Promise<boolean> {
  if (element.type !== 'text' || typeof element.textContent !== 'string') return false
  try {
    await navigator.clipboard.writeText(element.textContent)
    toast({ title: 'Text copied' })
    return true
  } catch {
    toast({ title: 'Copy text failed' })
    return false
  }
}

/** F4 — Copy layer name → clipboard text. */
export async function copyLayerNameToClipboard(element: DesignElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(element.name)
    toast({ title: 'Layer name copied', description: element.name })
    return true
  } catch {
    toast({ title: 'Copy layer name failed' })
    return false
  }
}
