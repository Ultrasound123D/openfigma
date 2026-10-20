import fs from 'fs/promises'
import path from 'path'

export interface DesignElement {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  strokeStyle: string
  strokeAlign?: string
  cornerRadius: number
  cornerRadiusTL: number
  cornerRadiusTR: number
  cornerRadiusBL: number
  cornerRadiusBR: number
  opacity: number
  rotation: number
  visible: boolean
  locked: boolean
  children?: DesignElement[]
  textContent?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: string
  textDecoration?: string
  textAlign?: string
  lineHeight?: number
  letterSpacing?: number
  textColor?: string
  pathPoints?: any[]
  pathClosed?: boolean
  sides?: number
  innerRadius?: number
  fills?: any[]
  strokes?: any[]
  shadows?: any[]
  blurs?: any[]
  autoLayout?: any
  exportSettings?: any[]
  blendMode?: string
  isComponent?: boolean
  componentId?: string
  overrides?: Record<string, any>
  isComponentSet?: boolean
  componentSetId?: string
  componentPropertyDefinitions?: Record<string, any>
  variantProperties?: Record<string, string>
  variantGroupProperties?: Record<string, any>
  defaultVariant?: string
  componentProperties?: Record<string, any>
  componentPropertyReferences?: any
  arrowStartId?: string
  arrowEndId?: string
  arrowHeadStyle?: string
  flipH?: boolean
  flipV?: boolean
  constraints?: any
  clipContent?: boolean
  booleanOperation?: string
  booleanSourceIds?: string[]
  booleanContours?: any[]
  isMask?: boolean
  vectorNetwork?: any
}

export interface Page {
  id: string
  name: string
  elements: DesignElement[]
  backgroundColor?: string
}

export interface ProjectState {
  id: string
  name: string
  elements: DesignElement[]
  pages: Page[]
  activePageId: string
  guides: any[]
  /** PHASE 20 — flow starting points (whole-project round-trip) */
  flowStartingPoints?: any[]
  /** PHASE 22 (C20) — version history snapshots (source: versionHistory.versions,
   *  activeId ('current_version' = live), restore creates a new version) */
  versions?: VersionSnapshot[]
  /** PHASE 22 (C21) — libraries this project subscribed to (source:
   *  fileSubscribedLibraryKeys / is_subscribed) */
  subscribedLibraryKeys?: string[]
  createdAt: string
  updatedAt: string
}

/** PHASE 22 (C20) — one version-history snapshot (source: versionHistory
 *  versions[] with id + label; restoring records a new version). */
export interface VersionSnapshot {
  id: string
  label: string
  at: string
  /** Full document snapshot at capture time */
  snapshot: {
    elements: DesignElement[]
    pages: Page[]
    activePageId: string
    guides: any[]
    flowStartingPoints?: any[]
    styles?: unknown
    comments?: unknown
  }
}

const DATA_DIR = path.join(process.cwd(), '.design-data')

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

function getProjectPath(projectId: string): string {
  return path.join(DATA_DIR, `${projectId}.json`)
}

export async function getProject(projectId: string): Promise<ProjectState | null> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(getProjectPath(projectId), 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

export async function saveProject(project: ProjectState): Promise<void> {
  await ensureDataDir()
  project.updatedAt = new Date().toISOString()
  await fs.writeFile(getProjectPath(project.id), JSON.stringify(project, null, 2))
}

export async function listProjects(): Promise<{ id: string; name: string; updatedAt: string }[]> {
  await ensureDataDir()
  try {
    const files = await fs.readdir(DATA_DIR)
    const projects: { id: string; name: string; updatedAt: string }[] = []
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8')
        const project = JSON.parse(data)
        projects.push({ id: project.id, name: project.name, updatedAt: project.updatedAt })
      }
    }
    return projects
  } catch {
    return []
  }
}

export async function deleteProject(projectId: string): Promise<boolean> {
  await ensureDataDir()
  try {
    await fs.unlink(getProjectPath(projectId))
    return true
  } catch {
    return false
  }
}

export function generateId(prefix: string = 'el'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function findElementInList(elements: DesignElement[], id: string): DesignElement | null {
  for (const el of elements) {
    if (el.id === id) return el
    if (el.children) {
      const found = findElementInList(el.children, id)
      if (found) return found
    }
  }
  return null
}

export function updateElementInList(
  elements: DesignElement[],
  id: string,
  updates: Partial<DesignElement>
): DesignElement[] {
  return elements.map((el) => {
    if (el.id === id) {
      return { ...el, ...updates }
    }
    if (el.children) {
      return { ...el, children: updateElementInList(el.children, id, updates) }
    }
    return el
  })
}

export function removeElementFromList(elements: DesignElement[], id: string): DesignElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) => {
      if (el.children) {
        return { ...el, children: removeElementFromList(el.children, id) }
      }
      return el
    })
}

export function flattenElements(elements: DesignElement[]): DesignElement[] {
  const result: DesignElement[] = []
  for (const el of elements) {
    result.push(el)
    if (el.children) {
      result.push(...flattenElements(el.children))
    }
  }
  return result
}

export function createDefaultElement(type: string, overrides?: Partial<DesignElement>): DesignElement {
  const id = generateId(type)
  const typeDefaults: Record<string, Partial<DesignElement>> = {
    rectangle: { name: `Rectangle`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    ellipse: { name: `Ellipse`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    line: { name: `Line`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0 },
    text: { name: `Text`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, textContent: 'Text', fontFamily: 'Inter', fontSize: 18, fontWeight: 400, textAlign: 'left', textColor: '#000000', lineHeight: 1.4, letterSpacing: 0 },
    frame: { name: `Frame`, fill: '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1, cornerRadius: 0, clipContent: true },
    group: { name: `Group`, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 },
    path: { name: `Path`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, pathPoints: [], pathClosed: false },
    polygon: { name: `Polygon`, fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 6 },
    star: { name: `Star`, fill: '#FFD93D', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0, sides: 5, innerRadius: 40 },
    arrow: { name: `Arrow`, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 0, arrowHeadStyle: 'arrow' },
  }

  const td = typeDefaults[type] || {}
  return {
    id,
    name: td.name || `${type}`,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: td.fill ?? 'transparent',
    stroke: td.stroke ?? 'transparent',
    strokeWidth: td.strokeWidth ?? 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: td.cornerRadius ?? 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    ...(td.textContent !== undefined ? { textContent: td.textContent } : {}),
    ...(td.fontFamily !== undefined ? { fontFamily: td.fontFamily } : {}),
    ...(td.fontSize !== undefined ? { fontSize: td.fontSize } : {}),
    ...(td.fontWeight !== undefined ? { fontWeight: td.fontWeight } : {}),
    ...(td.textAlign !== undefined ? { textAlign: td.textAlign } : {}),
    ...(td.textColor !== undefined ? { textColor: td.textColor } : {}),
    ...(td.lineHeight !== undefined ? { lineHeight: td.lineHeight } : {}),
    ...(td.letterSpacing !== undefined ? { letterSpacing: td.letterSpacing } : {}),
    ...(td.pathPoints !== undefined ? { pathPoints: td.pathPoints } : {}),
    ...(td.pathClosed !== undefined ? { pathClosed: td.pathClosed } : {}),
    ...(td.sides !== undefined ? { sides: td.sides } : {}),
    ...(td.innerRadius !== undefined ? { innerRadius: td.innerRadius } : {}),
    ...(td.clipContent !== undefined ? { clipContent: td.clipContent } : {}),
    ...(td.arrowHeadStyle !== undefined ? { arrowHeadStyle: td.arrowHeadStyle } : {}),
    ...overrides,
  }
}

// ---- PHASE 22 (C20) — version history helpers --------------------------------

const MAX_VERSIONS = 20
/** auto-snapshot throttle window (ms) — manual labeled saves bypass it */
const AUTO_SNAPSHOT_MIN_GAP_MS = 60_000

/** Capture the current document state as a new version (newest first).
 *  Auto snapshots (label=null passed as 'Autosave') are throttled. */
export async function addVersionSnapshot(
  projectId: string,
  label: string,
  opts?: { force?: boolean }
): Promise<VersionSnapshot | null> {
  const project = await getProject(projectId)
  if (!project) return null
  const versions = project.versions || []
  const last = versions[0]
  if (!opts?.force && last && last.label === 'Autosave') {
    const lastAt = new Date(last.at).getTime()
    if (Date.now() - lastAt < AUTO_SNAPSHOT_MIN_GAP_MS) return null
  }
  const snapshot: VersionSnapshot['snapshot'] = {
    elements: project.elements,
    pages: project.pages,
    activePageId: project.activePageId,
    guides: project.guides,
    flowStartingPoints: project.flowStartingPoints,
  }
  const version: VersionSnapshot = {
    id: `ver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    at: new Date().toISOString(),
    snapshot,
  }
  project.versions = [version, ...versions].slice(0, MAX_VERSIONS)
  await saveProject(project)
  return version
}

/** Restore a version: applies the snapshot to the live document AND records
 *  the restore as a new version (Figma semantics — restore is itself a
 *  versioned change; source: restoreVersionId + versions.unshift pattern). */
export async function restoreVersion(
  projectId: string,
  versionId: string
): Promise<{ ok: boolean; restoredAs?: VersionSnapshot; reason?: string }> {
  const project = await getProject(projectId)
  if (!project) return { ok: false, reason: 'Project not found' }
  const version = (project.versions || []).find((v) => v.id === versionId)
  if (!version) return { ok: false, reason: 'Version not found' }

  project.elements = version.snapshot.elements
  project.pages = version.snapshot.pages
  project.activePageId = version.snapshot.activePageId
  project.guides = version.snapshot.guides
  project.flowStartingPoints = version.snapshot.flowStartingPoints
  // keep the active page's per-page copy in sync (loads read pages[active])
  project.pages = project.pages.map((p) =>
    p.id === project.activePageId ? { ...p, elements: project.elements } : p
  )

  const restoredAs: VersionSnapshot = {
    id: `ver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label: `Restored “${version.label}”`,
    at: new Date().toISOString(),
    snapshot: {
      elements: project.elements,
      pages: project.pages,
      activePageId: project.activePageId,
      guides: project.guides,
      flowStartingPoints: project.flowStartingPoints,
    },
  }
  project.versions = [restoredAs, ...(project.versions || [])].slice(0, MAX_VERSIONS)
  await saveProject(project)
  return { ok: true, restoredAs }
}

/** Version list WITHOUT the heavy snapshots (for the history panel). */
export async function listVersions(
  projectId: string
): Promise<{ id: string; label: string; at: string }[]> {
  const project = await getProject(projectId)
  if (!project) return []
  return (project.versions || []).map(({ id, label, at }) => ({ id, label, at }))
}
