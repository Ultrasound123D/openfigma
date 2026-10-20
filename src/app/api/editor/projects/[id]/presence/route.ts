import { NextRequest } from 'next/server'
import { getProject } from '@/lib/server-state'
import { publishProjectEvent } from '@/lib/events/bus'

export const dynamic = 'force-dynamic'

/**
 * PHASE 22 (C19) — POST /api/editor/projects/[id]/presence
 *
 * Multiplayer presence broadcast (source: remoteCursorStore,
 * multiplayer_viewport_overlay, multiplayer_cursors). Ephemeral — the payload is
 * forwarded to other subscribers over SSE and never persisted to disk.
 *
 * Body: { clientId, name, color, cursor?, viewport?, selection?, kind? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    clientId?: string
    name?: string
    color?: string
    cursor?: { x: number; y: number }
    viewport?: { x: number; y: number; w: number; h: number }
    selection?: { x: number; y: number; w: number; h: number } | null
    kind?: 'move' | 'leave'
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.clientId) {
    return new Response(JSON.stringify({ error: 'clientId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  publishProjectEvent(id, {
    type: 'presence',
    origin: body.clientId,
    presence: {
      clientId: body.clientId,
      name: body.name || 'Guest',
      color: body.color || '#0D99FF',
      cursor: body.cursor,
      viewport: body.viewport,
      selection: body.selection ?? null,
      kind: body.kind || 'move',
    },
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
