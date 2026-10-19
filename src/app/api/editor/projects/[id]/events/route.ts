import { NextRequest } from 'next/server'
import { getProject } from '@/lib/server-state'
import { subscribeToProject, ProjectEvent, getRequestOrigin } from '@/lib/events/bus'

export const dynamic = 'force-dynamic'

/**
 * GET /api/editor/projects/[id]/events
 * Server-Sent Events stream of live project changes.
 *
 * Query: ?clientId=<tab-uuid> (may also be sent as X-Client-Id header).
 * The stream filters out events originating from this same client.
 *
 * Event names: ready | element-created | element-updated | element-deleted |
 *              pages-changed | project-updated
 * Heartbeat comment every 25s keeps proxies from closing the connection.
 */
export async function GET(
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

  const clientId = getRequestOrigin(request)
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      const sendEvent = (event: ProjectEvent) => {
        if (closed || event.origin === clientId) return // echo suppression
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }

      // Reconnect hint + initial handshake so the client can flip to "live".
      send(`retry: 3000\n\n`)
      send(`event: ready\ndata: ${JSON.stringify({ projectId: id, clientId, at: Date.now() })}\n\n`)

      const unsubscribe = subscribeToProject(id, sendEvent)

      const heartbeat = setInterval(() => {
        if (closed) return
        send(`: heartbeat ${Date.now()}\n\n`)
      }, 25000)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed by the platform
        }
      }

      request.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
