'use client'

/**
 * PHASE 4 — Import orchestration shared by the TopBar "Import" menu and
 * the canvas drag-and-drop. Routes each File by MIME type:
 *   image/svg+xml  → svg-import (editable elements, DECISION-004)
 *   image/*        → image-import (image-fill rectangle)
 *   application/json / .json → project-import (replace or merge)
 * Falls back to text-based SVG sniffing when the MIME type is generic.
 */

import { useEditorStore, generateId } from '@/store/editor-store'
import { importImageFile, isImageFile } from './image-import'
import { importSvgText } from './svg-import'
import { parseProjectJson, regenerateTreeIds, type ParsedProject } from './project-import'
import { toast } from '@/hooks/use-toast'

export type ImportPlacement = { x: number; y: number } | 'view-center'

/** Canvas coordinate of the current viewport center. */
function viewCenter(): { x: number; y: number } {
  const { panX, panY, zoom } = useEditorStore.getState()
  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
  return { x: -panX / safeZoom, y: -panY / safeZoom }
}

async function readAsText(file: File): Promise<string> {
  return file.text()
}

/** Import one SVG file → wrapped frame placed at `at`. */
async function importSvg(file: File, at: ImportPlacement): Promise<string> {
  const text = await readAsText(file)
  const result = importSvgText(text, (p) => generateId(p), true)
  const place = at === 'view-center' ? viewCenter() : at

  const placed = result.elements.map((el) => ({
    ...el,
    x: Math.round(place.x - el.width / 2 + (el.x - result.elements[0].x)),
    y: Math.round(place.y - el.height / 2 + (el.y - result.elements[0].y)),
  }))

  const store = useEditorStore.getState()
  store.pushHistory()
  store.importElementsBatch(placed)
  return `SVG "${file.name}": ${result.stats.imported} elements imported` +
    (result.stats.skipped > 0 ? ` (${result.stats.skipped} nodes skipped)` : '')
}

/** Import one raster image file → image-fill rectangle at `at`. */
async function importImage(file: File, at: ImportPlacement): Promise<string> {
  const place = at === 'view-center' ? viewCenter() : at
  const element = await importImageFile(file, place, () => generateId('image'))
  const store = useEditorStore.getState()
  store.pushHistory()
  store.importElementsBatch([element])
  return `Image "${file.name}" imported`
}

/** Import a project JSON file. `mode` decides replace vs merge. */
async function importProject(file: File, mode: 'replace' | 'merge'): Promise<string> {
  const text = await readAsText(file)
  const parsed: ParsedProject = parseProjectJson(text)
  const store = useEditorStore.getState()

  if (mode === 'merge') {
    // merge: flattened pages appended to the current document
    const all = parsed.pages.flatMap((p) => p.elements)
    const reidentified = all.map((el) => regenerateTreeIds(el, (p) => generateId(p)))
    store.pushHistory()
    store.importElementsBatch(reidentified)
    return `Merged "${file.name}": ${parsed.elementCount} elements added`
  }

  store.loadImportedProject(parsed.pages, parsed.fileName, parsed.guides)
  return `Project "${file.name}" loaded (${parsed.pages.length} pages, ${parsed.elementCount} elements)`
}

/** Sniff SVG when the browser reports a generic type. */
async function looksLikeSvg(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.svg')) return true
  if (file.type === 'image/svg+xml') return true
  if (file.type === '' || file.type === 'text/plain' || file.type === 'application/octet-stream') {
    if (file.size > 1_000_000) return false
    const head = (await file.slice(0, 512).text()).trim().toLowerCase()
    return head.startsWith('<?xml') || head.startsWith('<svg')
  }
  return false
}

export interface ImportSummary {
  ok: string[]
  failed: string[]
}

/**
 * Import an arbitrary list of dropped/selected files. Images and SVGs
 * land at `at`; JSON projects are offered in merge mode when other files
 * are also present, otherwise replace.
 */
export async function importFiles(files: File[], at: ImportPlacement = 'view-center'): Promise<ImportSummary> {
  const summary: ImportSummary = { ok: [], failed: [] }
  const store = useEditorStore.getState()

  for (const file of files) {
    try {
      const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
      if (isJson) {
        const mode = files.length > 1 ? 'merge' : 'replace'
        summary.ok.push(await importProject(file, mode))
      } else if (await looksLikeSvg(file)) {
        summary.ok.push(await importSvg(file, at))
      } else if (isImageFile(file)) {
        summary.ok.push(await importImage(file, at))
      } else {
        summary.failed.push(`Unsupported file: ${file.name}`)
      }
    } catch (e) {
      summary.failed.push(`${file.name}: ${e instanceof Error ? e.message : 'import failed'}`)
    }
  }

  // surface results through the existing toast system
  for (const msg of summary.ok) {
    toast({ title: 'Import', description: msg })
  }
  for (const msg of summary.failed) {
    toast({ title: 'Import failed', description: msg, variant: 'destructive' })
  }

  // keep server projects in sync when a document was replaced
  if (summary.ok.some((m) => m.startsWith('Project ')) && store.currentProjectId) {
    void useEditorStore.getState().saveToFile()
  }

  return summary
}

/** Programmatic file picker for menu entries (no new packages). */
export function pickFiles(accept: string, multiple: boolean, onPicked: (files: File[]) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.style.display = 'none'
  input.onchange = () => {
    const files = Array.from(input.files ?? [])
    document.body.removeChild(input)
    if (files.length > 0) onPicked(files)
  }
  document.body.appendChild(input)
  input.click()
}
