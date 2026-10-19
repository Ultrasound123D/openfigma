import { NextRequest, NextResponse } from 'next/server'
import {
  getProject, saveProject, findElementInList, updateElementInList,
  removeElementFromList
} from '@/lib/server-state'
import { publishProjectEvent, getRequestOrigin } from '@/lib/events/bus'
import { ELEMENT_FIELD_WHITELIST, pickElementFields } from '@/lib/element-whitelist'

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
const ELEMENT_PUT_WHITELIST: readonly string[] = ELEMENT_FIELD_WHITELIST

function pickWhitelisted(body: unknown): Record<string, unknown> {
  return pickElementFields(body)
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
