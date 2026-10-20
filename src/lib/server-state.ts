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
  createdAt: string
  updatedAt: string
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
