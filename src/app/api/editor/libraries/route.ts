import { NextRequest } from 'next/server'
import { listLibraries, publishLibrary } from '@/lib/libraries'
import { getProject, type DesignElement } from '@/lib/server-state'

export const dynamic = 'force-dynamic'

/**
 * PHASE 22 (C21) — published component libraries.
 *
 * GET  /api/editor/libraries  → list all published libraries
 * POST /api/editor/libraries  → publish this project's components as a library
 *      body: { projectId, name, publisher? }
 *      (source: design_systems.assets_panel.publish_library)
 */
export async function GET() {
  const libraries = await listLibraries()
  return Response.json({ libraries })
}

export async function POST(request: NextRequest) {
  let body: { projectId?: string; name?: string; publisher?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!body.projectId || !body.name?.trim()) {
    return new Response(JSON.stringify({ error: 'projectId and name are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const project = await getProject(body.projectId)
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // components = this file's component masters (source:
  // getLibraryPublishedComponentsWithCodeConnectAll — published set)
  const allPages = [project, ...project.pages]
  const seen = new Set<string>()
  const components: DesignElement[] = []
  for (const page of allPages) {
    for (const el of page.elements || []) {
      if ((el.isComponent || el.isComponentSet) && !seen.has(el.id)) {
        seen.add(el.id)
        components.push(el)
      }
    }
  }
  if (components.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No components to publish (create components first)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const library = await publishLibrary({
    name: body.name.trim(),
    publisher: body.publisher?.trim() || 'Anonymous',
    projectId: body.projectId,
    components,
  })

  return Response.json({
    library: {
      key: library.key,
      name: library.name,
      publisher: library.publisher,
      projectId: library.projectId,
      publishedAt: library.publishedAt,
      componentCount: library.components.length,
    },
  })
}
