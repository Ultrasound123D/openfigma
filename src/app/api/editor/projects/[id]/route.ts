import { NextRequest, NextResponse } from 'next/server'
import { getProject, saveProject, deleteProject, addVersionSnapshot } from '@/lib/server-state'
import { publishProjectEvent, getRequestOrigin } from '@/lib/events/bus'

// GET /api/editor/projects/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json({ project })
}

// PUT /api/editor/projects/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const project = await getProject(id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const updated = { ...project, ...body, id, updatedAt: new Date().toISOString() }
  await saveProject(updated)

  // PHASE 22 (C20) — throttled auto-snapshot on save (source: versionHistory
  // autosaves; manual labeled saves come via POST .../versions with force).
  await addVersionSnapshot(id, 'Autosave').catch(() => null)

  // Live sync: whole project replaced (e.g. another tab pushed its state).
  publishProjectEvent(id, {
    type: 'project-updated',
    origin: getRequestOrigin(request),
  })

  return NextResponse.json({ project: updated })
}

// DELETE /api/editor/projects/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = await deleteProject(id)
  if (!deleted) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
