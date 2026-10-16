import { NextRequest, NextResponse } from 'next/server'
import { getProject, saveProject, deleteProject } from '@/lib/server-state'

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
