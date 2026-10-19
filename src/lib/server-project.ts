import type { DesignElement, Page } from '@/store/editor-store'

/**
 * Normalization layer between the server's persisted ProjectState and the
 * browser's editor model. The server stores a superset of fields and may miss
 * newer optional ones, so every element coming from the network goes through
 * normalizeServerElement before entering the Zustand store.
 *
 * Shared by loadServerProject (initial fetch) and the live-sync actions
 * (applyRemoteProject / applyRemoteElement*) in editor-store.
 */

export function normalizeServerElement(el: any): DesignElement {
  // PHASE 2 fix (see WORKLOG DECISION-008): preserve EVERY field the server
  // sent (fills, strokes, effects, autoLayout, interactions, vector data…)
  // and only fill in defaults for known-missing base fields. The previous
  // implementation rebuilt elements from a fixed field list, which silently
  // dropped advanced properties on live-sync updates between tabs.
  // Write-side safety is enforced by the API whitelist, so spreading the
  // incoming object is safe here.
  const out: any = { ...el }
  out.id = el.id || `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  out.name = el.name || 'Element'
  out.type = el.type || 'rectangle'
  out.x = el.x ?? 0
  out.y = el.y ?? 0
  out.width = el.width ?? 100
  out.height = el.height ?? 100
  out.fill = el.fill ?? 'transparent'
  out.stroke = el.stroke ?? 'transparent'
  out.strokeWidth = el.strokeWidth ?? 0
  out.strokeStyle = el.strokeStyle ?? 'solid'
  out.cornerRadius = el.cornerRadius ?? 0
  out.cornerRadiusTL = el.cornerRadiusTL ?? 0
  out.cornerRadiusTR = el.cornerRadiusTR ?? 0
  out.cornerRadiusBL = el.cornerRadiusBL ?? 0
  out.cornerRadiusBR = el.cornerRadiusBR ?? 0
  out.opacity = el.opacity ?? 100
  out.rotation = el.rotation ?? 0
  out.visible = el.visible !== false
  out.locked = el.locked === true
  out.blendMode = el.blendMode || 'normal'
  out.clipContent = el.clipContent ?? false
  out.flipH = el.flipH ?? false
  out.flipV = el.flipV ?? false
  if (el.type === 'text') {
    out.textContent = el.textContent ?? 'Text'
    out.fontFamily = el.fontFamily ?? 'Inter'
    out.fontSize = el.fontSize ?? 18
    out.fontWeight = el.fontWeight ?? 400
    out.fontStyle = el.fontStyle
    out.textDecoration = el.textDecoration
    out.textAlign = el.textAlign ?? 'left'
    out.lineHeight = el.lineHeight ?? 1.4
    out.letterSpacing = el.letterSpacing ?? 0
    out.textColor = el.textColor ?? '#000000'
  }
  if (el.children && Array.isArray(el.children)) {
    out.children = el.children.map(normalizeServerElement)
  }
  return out as DesignElement
}

export interface NormalizedProject {
  pages: Page[]
  activePageId: string
  activePageElements: DesignElement[]
  name: string
  /** PHASE 7 — project styles (empty array when the server has none) */
  styles: unknown[]
}

export function normalizeServerProject(project: any): NormalizedProject {
  const pages = project.pages || []
  const activePage =
    pages.find((p: any) => p.id === project.activePageId) || pages[0]
  const pageElements = activePage?.elements || project.elements || []

  const converted = pageElements.map(normalizeServerElement)
  const convertedPages: Page[] = pages.map((p: any) => ({
    id: p.id,
    name: p.name || 'Page 1',
    elements: (p.elements || []).map(normalizeServerElement),
  }))

  return {
    pages:
      convertedPages.length > 0
        ? convertedPages
        : [{ id: 'page-1', name: 'Page 1', elements: converted }],
    activePageId: activePage?.id || 'page-1',
    activePageElements: converted,
    name: project.name || 'Untitled',
    styles: Array.isArray(project.styles) ? project.styles : [],
  }
}

/**
 * Push the current editor state to the server for the open project.
 * Used by auto-save and manual save when a server project is open.
 *
 * The `X-Client-Id` header lets the SSE layer suppress the echo: the pushing
 * tab never receives its own project-updated event, other tabs refresh.
 * Returns the server timestamp, or null when nothing was pushed (no open
 * server project / request failed — local IndexedDB save still applies).
 */
export async function pushProjectToServer(state: {
  currentProjectId: string | null
  clientId: string
  fileName: string
  elements: DesignElement[]
  pages: Page[]
  activePageId: string
  guides?: unknown[]
  /** PHASE 7 — project styles ride the whole-project PUT */
  styles?: unknown[]
}): Promise<string | null> {
  if (!state.currentProjectId) return null
  try {
    const res = await fetch(`/api/editor/projects/${state.currentProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': state.clientId,
      },
      body: JSON.stringify({
        name: state.fileName,
        elements: state.elements,
        pages: state.pages,
        activePageId: state.activePageId,
        ...(state.guides ? { guides: state.guides } : {}),
        ...(state.styles ? { styles: state.styles } : {}),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.project?.updatedAt ?? new Date().toISOString()
  } catch (err) {
    console.error('pushProjectToServer failed:', err)
    return null
  }
}
