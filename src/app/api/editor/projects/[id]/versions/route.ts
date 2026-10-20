import { NextRequest } from 'next/server'
import { addVersionSnapshot, listVersions } from '@/lib/server-state'

export const dynamic = 'force-dynamic'

/**
 * PHASE 22 (C20) — version history.
 *
 * GET  /api/editor/projects/[id]/versions       → list {id, label, at}[]
 * POST /api/editor/projects/[id]/versions       → create a labeled snapshot
 *      body: { label?: string }  (default "Manual save"; source: save-version)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const versions = await listVersions(id)
  return Response.json({ versions })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let label = 'Manual save'
  try {
    const body = await request.json()
    if (typeof body?.label === 'string' && body.label.trim()) label = body.label.trim()
  } catch {
    // empty body → default label
  }
  const version = await addVersionSnapshot(id, label, { force: true })
  if (!version) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return Response.json({ version: { id: version.id, label: version.label, at: version.at } })
}
