import { NextRequest } from 'next/server'
import { restoreVersion } from '@/lib/server-state'
import { publishProjectEvent } from '@/lib/events/bus'

export const dynamic = 'force-dynamic'

/**
 * PHASE 22 (C20) — POST /api/editor/projects/[id]/versions/[versionId]/restore
 *
 * Applies the snapshot to the live document, records the restore as a NEW
 * version (Figma semantics), and broadcasts project-updated so every connected
 * tab reloads the restored state.
 * Source: restoreVersionId + versions.unshift + restore_initiated/completed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params
  const result = await restoreVersion(id, versionId)
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.reason }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  publishProjectEvent(id, {
    type: 'project-updated',
    origin: request.headers.get('x-client-id') || 'version-restore',
  })

  return Response.json({
    ok: true,
    restoredAs: result.restoredAs
      ? { id: result.restoredAs.id, label: result.restoredAs.label, at: result.restoredAs.at }
      : null,
  })
}
