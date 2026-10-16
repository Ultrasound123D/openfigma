import { NextRequest, NextResponse } from 'next/server'
import { getProject, saveProject } from '@/lib/server-state'

// PUT /api/editor/projects/[id]/pages/[pageId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { id: projectId, pageId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  project.pages = project.pages.map(p => p.id === pageId ? { ...p, ...body } : p)
  if (body.active) {
    project.activePageId = pageId
  }
  await saveProject(project)
  return NextResponse.json({ success: true })
}

// DELETE /api/editor/projects/[id]/pages/[pageId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { id: projectId, pageId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (project.pages.length <= 1) {
    return NextResponse.json({ error: 'Cannot delete last page' }, { status: 400 })
  }

  project.pages = project.pages.filter(p => p.id !== pageId)
  if (project.activePageId === pageId) {
    project.activePageId = project.pages[0].id
  }
  await saveProject(project)
  return NextResponse.json({ success: true })
}
