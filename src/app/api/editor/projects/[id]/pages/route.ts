import { NextRequest, NextResponse } from 'next/server'
import { getProject, saveProject, generateId } from '@/lib/server-state'

// GET /api/editor/projects/[id]/pages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json({ pages: project.pages, activePageId: project.activePageId })
}

// POST /api/editor/projects/[id]/pages
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
  const newPage = {
    id: generateId('page'),
    name: body.name || `Page ${project.pages.length + 1}`,
    elements: [],
  }

  project.pages = [...project.pages, newPage]
  await saveProject(project)
  return NextResponse.json({ page: newPage })
}
