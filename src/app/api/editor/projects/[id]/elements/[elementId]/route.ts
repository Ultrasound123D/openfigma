import { NextRequest, NextResponse } from 'next/server'
import {
  getProject, saveProject, findElementInList, updateElementInList,
  removeElementFromList
} from '@/lib/server-state'
import { publishProjectEvent, getRequestOrigin } from '@/lib/events/bus'

// GET /api/editor/projects/[id]/elements/[elementId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]
  const element = findElementInList(page.elements, elementId)
  if (!element) {
    return NextResponse.json({ error: 'Element not found' }, { status: 404 })
  }

  return NextResponse.json({ element })
}

// PUT /api/editor/projects/[id]/elements/[elementId]
//
// DECISION-006 (see ARCHITECTURE.md): the update body is filtered through
// an explicit whitelist of DesignElement fields. This prevents clients from
// injecting arbitrary/injected keys (e.g. __proto__-adjacent junk or future
// server-only fields). New editor features must add their field here.
const ELEMENT_PUT_WHITELIST = [
  // identity & geometry
  'name', 'type', 'x', 'y', 'width', 'height', 'rotation', 'opacity',
  'visible', 'locked', 'flipH', 'flipV', 'blendMode',
  // fills & strokes
  'fill', 'stroke', 'strokeWidth', 'strokeStyle', 'strokeAlign',
  'cornerRadius', 'cornerRadiusTL', 'cornerRadiusTR', 'cornerRadiusBL', 'cornerRadiusBR',
  'fills', 'strokes',
  // effects
  'shadows', 'blurs',
  // text
  'textContent', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'textDecoration', 'textAlign', 'lineHeight', 'letterSpacing', 'textColor',
  // vector / shape
  'pathPoints', 'pathClosed', 'vectorNetwork', 'sides', 'innerRadius',
  // structure
  'children', 'autoLayout', 'clipContent', 'constraints', 'constraintsEdited',
  'booleanOperation', 'booleanSourceIds', 'booleanContours', 'isMask',
  // component system
  'isComponent', 'componentId', 'overrides',
  'isComponentSet', 'componentSetId', 'componentPropertyDefinitions',
  'variantProperties', 'variantGroupProperties', 'defaultVariant',
  'componentProperties', 'componentPropertyReferences',
  // arrows
  'arrowStartId', 'arrowEndId', 'arrowHeadStyle',
  // export settings (PHASE 3)
  'exportSettings',
  // prototype interactions (PHASE 2)
  'interactions',
  // PHASE 7 — style references
  'fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId',
  // PHASE 8 — per-frame layout grids
  'layoutGrids',
  // PHASE 10 — text sizing/case
  'textAutoResize', 'textCase',
] as const

function pickWhitelisted(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return {}
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of ELEMENT_PUT_WHITELIST) {
    if (key in source) out[key] = source[key]
  }
  return out
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]
  const existing = findElementInList(page.elements, elementId)
  if (!existing) {
    return NextResponse.json({ error: 'Element not found' }, { status: 404 })
  }

  const body = await request.json()
  const updates = pickWhitelisted(body)
  page.elements = updateElementInList(page.elements, elementId, updates)
  await saveProject(project)

  const updated = findElementInList(page.elements, elementId)

  // Live sync: broadcast the full updated element to other connected clients.
  publishProjectEvent(projectId, {
    type: 'element-updated',
    origin: getRequestOrigin(request),
    pageId: page.id,
    elementId,
    element: updated,
  })

  return NextResponse.json({ element: updated })
}

// DELETE /api/editor/projects/[id]/elements/[elementId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]
  page.elements = removeElementFromList(page.elements, elementId)
  await saveProject(project)

  // Live sync: broadcast the deletion to other connected clients.
  publishProjectEvent(projectId, {
    type: 'element-deleted',
    origin: getRequestOrigin(request),
    pageId: page.id,
    elementId,
  })

  return NextResponse.json({ success: true })
}
