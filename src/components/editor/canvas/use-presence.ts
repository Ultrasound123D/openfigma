'use client'

/**
 * PHASE 22 (C19) — multiplayer presence broadcast.
 *
 * Source evidence: remoteCursorStore (5877), multiplayer_cursors
 * (figma_app-ebce), multiplayer_viewport_overlay (2971). Broadcasts the local
 * cursor (canvas coords), viewport rect and selection bbox to the project's
 * SSE bus at a throttled rate. Receiving + rendering happens in
 * use-project-sync ('presence' event) and <RemoteCursors/>.
 */

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'

/** cursor broadcast throttle (ms) */
const CURSOR_THROTTLE_MS = 80
/** viewport/selection broadcast throttle (ms) */
const VIEWPORT_THROTTLE_MS = 400
/** heartbeat interval while idle (keeps presence alive for pruning) */
const HEARTBEAT_MS = 4000

const PRESENCE_COLORS = [
  '#0D99FF', '#F24E1E', '#A259FF', '#1ABCFE',
  '#0ACF83', '#FF7262', '#FFC700', '#EF5DA8',
]

function colorForClient(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]
}

function nameForClient(clientId: string): string {
  const n = Math.abs(parseInt(clientId.replace(/[^0-9]/g, '').slice(-4) || '7', 10) || 7)
  return `Guest ${1 + (n % 98)}`
}

export function usePresence(containerRef: React.RefObject<HTMLDivElement | null>) {
  const lastCursorSent = useRef(0)
  const lastViewportSent = useRef(0)
  const lastPayload = useRef<string>('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const send = (force = false) => {
      const s = useEditorStore.getState()
      if (!s.currentProjectId) return
      const now = Date.now()

      const rect = el.getBoundingClientRect()
      // canvas coords of the viewport corners: screen = center + canvas*zoom
      const zoom = isFinite(s.zoom) && s.zoom > 0.001 ? s.zoom : 1
      const cx = rect.width / 2 + s.panX
      const cy = rect.height / 2 + s.panY
      const viewport = {
        x: -cx / zoom,
        y: -cy / zoom,
        w: rect.width / zoom,
        h: rect.height / zoom,
      }

      // selection bbox in canvas coords (top-level elements)
      const selEls = s.selectedElementIds
        .map((id) => s.elements.find((e) => e.id === id))
        .filter(Boolean)
      let selection: { x: number; y: number; w: number; h: number } | null = null
      if (selEls.length > 0) {
        const x = Math.min(...selEls.map((e) => e!.x))
        const y = Math.min(...selEls.map((e) => e!.y))
        const r = Math.max(...selEls.map((e) => e!.x + e!.width))
        const b = Math.max(...selEls.map((e) => e!.y + e!.height))
        selection = { x, y, w: r - x, h: b - y }
      }

      const cursor = cursorRef.current
        ? { x: (cursorRef.current.x - cx) / zoom, y: (cursorRef.current.y - cy) / zoom }
        : undefined

      const payload = JSON.stringify({ cursor, viewport, selection })
      if (!force && payload === lastPayload.current) return
      if (!force) {
        if (cursor && now - lastCursorSent.current < CURSOR_THROTTLE_MS) return
        if (!cursor && now - lastViewportSent.current < VIEWPORT_THROTTLE_MS) return
      }
      if (cursor) lastCursorSent.current = now
      lastViewportSent.current = now
      lastPayload.current = payload

      void fetch(`/api/editor/projects/${s.currentProjectId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: s.clientId,
          name: nameForClient(s.clientId),
          color: colorForClient(s.clientId),
          cursor,
          viewport,
          selection,
        }),
      }).catch(() => {
        // presence is best-effort — never disturb the editor
      })
    }

    const cursorRef: { current: { x: number; y: number } | null } = { current: null }

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      cursorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      send()
    }
    const onMouseLeave = () => {
      cursorRef.current = null
      send(true)
    }

    // re-broadcast viewport on pan/zoom/selection changes (store subscription)
    const unsub = useEditorStore.subscribe((state, prev) => {
      if (
        state.panX !== prev.panX || state.panY !== prev.panY ||
        state.zoom !== prev.zoom || state.selectedElementIds !== prev.selectedElementIds ||
        state.currentProjectId !== prev.currentProjectId
      ) {
        const now = Date.now()
        if (now - lastViewportSent.current >= VIEWPORT_THROTTLE_MS) send(true)
      }
    })

    const heartbeat = setInterval(() => send(true), HEARTBEAT_MS)

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)
    return () => {
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
      unsub()
      clearInterval(heartbeat)
      // broadcast leave
      const s = useEditorStore.getState()
      if (s.currentProjectId) {
        void fetch(`/api/editor/projects/${s.currentProjectId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: s.clientId, kind: 'leave' }),
        }).catch(() => undefined)
      }
    }
  }, [containerRef])
}
