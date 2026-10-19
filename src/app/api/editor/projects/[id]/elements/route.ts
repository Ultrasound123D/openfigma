import { NextRequest, NextResponse } from 'next/server'
import {
  getProject, saveProject, findElementInList, updateElementInList,
  removeElementFromList, flattenElements
} from '@/lib/server-state'
import { publishProjectEvent, getRequestOrigin } from '@/lib/events/bus'

// GET /api/editor/projects/[projectId]/elements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]
  return NextResponse.json({
    elements: page.elements,
    flatElements: flattenElements(page.elements),
  })
}

// POST /api/editor/projects/[projectId]/elements - Create element
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { type = 'rectangle', parentId, ...overrides } = body

  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const element = {
    id,
    name: overrides.name || `${type}`,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: '#D9D9D9',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
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
    ...overrides,
  }

  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]

  if (parentId) {
    const parent = findElementInList(page.elements, parentId)
    if (parent && (parent.type === 'frame' || parent.type === 'group')) {
      parent.children = [...(parent.children || []), element]
    }
  } else {
    page.elements = [...page.elements, element]
  }

  await saveProject(project)

  // Live sync: tell every other connected client (browser tabs) about the new element.
  publishProjectEvent(projectId, {
    type: 'element-created',
    origin: getRequestOrigin(request),
    pageId: page.id,
    element,
  })

  return NextResponse.json({ element })
}
