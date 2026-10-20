import { NextRequest } from 'next/server'
import { getLibrary } from '@/lib/libraries'

export const dynamic = 'force-dynamic'

/**
 * PHASE 22 (C21) — GET /api/editor/libraries/[key]
 * One published library with its components
 * (source: getLibraryPublishedComponentsWithCodeConnectAll({libraryKey})).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const library = await getLibrary(key)
  if (!library) {
    return new Response(JSON.stringify({ error: 'Library not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return Response.json({
    library: {
      key: library.key,
      name: library.name,
      publisher: library.publisher,
      projectId: library.projectId,
      publishedAt: library.publishedAt,
      /** Full serialized masters — required for insertion into other projects. */
      components: library.components,
    },
  })
}
