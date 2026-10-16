import { NextRequest, NextResponse } from 'next/server'
import {
  getProject, saveProject, findElementInList, updateElementInList,
  removeElementFromList
} from '@/lib/server-state'

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
  page.elements = updateElementInList(page.elements, elementId, body)
  await saveProject(project)

  const updated = findElementInList(page.elements, elementId)
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

  return NextResponse.json({ success: true })
}
