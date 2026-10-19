/**
 * PHASE 4 — Project JSON import: load a saved openfigma document
 * ({ elements, pages, fileName, guides, savedAt } — the same shape
 * saveToFile/IndexedDB produces, see editor-store) or merge it into the
 * current document. Strict validation: the file must contain either a
 * `pages` array or an `elements` array of plausible element objects;
 * IDs are regenerated on merge to avoid collisions.
 */

import type { DesignElement, Page } from '@/store/editor-store'

export interface ProjectFile {
  elements?: DesignElement[]
  pages?: Page[]
  fileName?: string
  guides?: unknown[]
  savedAt?: number
  /** pages[].backgroundColor etc. tolerated */
  [key: string]: unknown
}

/** Runtime shape check for a serialized DesignElement. */
function looksLikeElement(value: unknown): value is DesignElement {
  if (typeof value !== 'object' || value === null) return false
  const el = value as Record<string, unknown>
  return (
    typeof el.id === 'string' &&
    typeof el.type === 'string' &&
    typeof el.x === 'number' &&
    typeof el.y === 'number' &&
    typeof el.width === 'number' &&
    typeof el.height === 'number'
  )
}

export interface ParsedProject {
  pages: Page[]
  fileName: string | null
  guides: ProjectFile['guides']
  mode: 'pages' | 'elements-only'
  elementCount: number
}

/** Parse + validate a project JSON string. Throws on invalid files. */
export function parseProjectJson(text: string): ParsedProject {
  let raw: ProjectFile
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Project file must be a JSON object')
  }

  if (Array.isArray(raw.pages) && raw.pages.length > 0) {
    const pages: Page[] = []
    let elementCount = 0
    for (const p of raw.pages) {
      if (typeof p !== 'object' || p === null) continue
      const page = p as unknown as Record<string, unknown>
      const elements = Array.isArray(page.elements) ? page.elements.filter(looksLikeElement) : []
      if (typeof page.id !== 'string') continue
      elementCount += elements.length
      pages.push({
        id: page.id,
        name: typeof page.name === 'string' ? page.name : 'Page',
        elements: elements as DesignElement[],
        backgroundColor: typeof page.backgroundColor === 'string' ? page.backgroundColor : undefined,
      })
    }
    if (pages.length === 0) throw new Error('Project file has no valid pages')
    return {
      pages,
      fileName: typeof raw.fileName === 'string' ? raw.fileName : null,
      guides: Array.isArray(raw.guides) ? raw.guides : [],
      mode: 'pages',
      elementCount,
    }
  }

  if (Array.isArray(raw.elements) && raw.elements.some(looksLikeElement)) {
    const elements = raw.elements.filter(looksLikeElement)
    return {
      pages: [{ id: 'page-imported', name: 'Imported', elements }],
      fileName: typeof raw.fileName === 'string' ? raw.fileName : null,
      guides: [],
      mode: 'elements-only',
      elementCount: elements.length,
    }
  }

  throw new Error('Project file has neither pages nor elements')
}

/** Regenerate every id in a tree (used by merge mode to avoid collisions). */
export function regenerateTreeIds(element: DesignElement, makeId: (prefix: string) => string): DesignElement {
  const clone: DesignElement = { ...element, id: makeId(element.type) }
  if (element.children) {
    clone.children = element.children.map((c) => regenerateTreeIds(c, makeId))
  }
  return clone
}
