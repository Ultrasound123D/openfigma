import { NextRequest, NextResponse } from 'next/server'
import { listProjects, saveProject, generateId } from '@/lib/server-state'

// GET /api/editor/projects
export async function GET() {
  const projects = await listProjects()
  return NextResponse.json({ projects })
}

// POST /api/editor/projects
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name } = body

  const project = {
    id: generateId('project'),
    name: name || 'Untitled Project',
    elements: [],
    pages: [{ id: generateId('page'), name: 'Page 1', elements: [] }],
    activePageId: '',
    guides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  project.activePageId = project.pages[0].id

  await saveProject(project)
  return NextResponse.json({ project })
}
