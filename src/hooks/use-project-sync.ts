'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'

/**
 * useProjectSync — live sync over Server-Sent Events.
 *
 * Opens an EventSource to /api/editor/projects/:id/events whenever a server
 * project is open (currentProjectId !== null) and applies incoming remote
 * changes to the editor store:
 *
 *   element-created / element-updated / element-deleted  → granular merge
 *   pages-changed / project-updated                      → full project refresh
 *
 * Echo suppression is handled twice:
 *   1. Server side: events carry `origin`; the SSE stream never sends an
 *      event back to the client that caused it.
 *   2. Client side: applying a remote change never sets isDirty, so the
 *      autosave push never bounces it back to the server.
 *
 * EventSource auto-reconnects (server sends retry: 3000). While disconnected
 * the status flips to 'connecting'; granular events that were missed are
 * compensated by the full refresh that follows pages-changed/project-updated,
 * or by the user reloading. Mount this hook once (EditorLayout).
 */
export function useProjectSync() {
  const currentProjectId = useEditorStore((s) => s.currentProjectId)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Close any previous stream when the open project changes or is closed.
    if (sourceRef.current) {
      sourceRef.current.close()
      sourceRef.current = null
    }

    if (!currentProjectId) {
      useEditorStore.getState().setSyncStatus('offline')
      return
    }

    const store = useEditorStore.getState()
    const clientId = store.clientId
    store.setSyncStatus('connecting')

    const url = `/api/editor/projects/${currentProjectId}/events?clientId=${encodeURIComponent(clientId)}`
    const source = new EventSource(url)
    sourceRef.current = source

    const setOrigin = (origin: string) => {
      // Tag the store so the UI can show who made the latest remote change.
      useEditorStore.setState({ lastRemoteOrigin: origin })
    }

    source.addEventListener('ready', () => {
      useEditorStore.getState().setSyncStatus('live')
    })

    source.addEventListener('element-created', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        if (payload?.element) {
          useEditorStore.getState().applyRemoteElement(payload.element, payload.pageId)
          setOrigin(payload.origin)
        }
      } catch (err) {
        console.error('live-sync: bad element-created payload', err)
      }
    })

    source.addEventListener('element-updated', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        if (payload?.element) {
          useEditorStore.getState().applyRemoteElementUpdate(payload.element, payload.pageId)
          setOrigin(payload.origin)
        }
      } catch (err) {
        console.error('live-sync: bad element-updated payload', err)
      }
    })

    source.addEventListener('element-deleted', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        if (payload?.elementId) {
          useEditorStore.getState().applyRemoteElementDelete(payload.elementId, payload.pageId)
          setOrigin(payload.origin)
        }
      } catch (err) {
        console.error('live-sync: bad element-deleted payload', err)
      }
    })

    const refreshProject = async (origin: string) => {
      try {
        const res = await fetch(`/api/editor/projects/${currentProjectId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.project) {
          useEditorStore.getState().applyRemoteProject(data.project)
          setOrigin(origin)
        }
      } catch (err) {
        console.error('live-sync: project refresh failed', err)
      }
    }

    source.addEventListener('pages-changed', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        void refreshProject(payload?.origin ?? 'remote')
      } catch {
        void refreshProject('remote')
      }
    })

    source.addEventListener('project-updated', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        void refreshProject(payload?.origin ?? 'remote')
      } catch {
        void refreshProject('remote')
      }
    })

    // PHASE 22 (C19) — multiplayer presence (ephemeral, never persisted)
    source.addEventListener('presence', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data)
        if (payload?.presence) {
          useEditorStore.getState().applyRemotePresence(payload.presence)
        }
      } catch {
        // malformed presence payload — ignore (ephemeral by design)
      }
    })

    source.onerror = () => {
      // EventSource retries automatically; surface the state to the UI.
      useEditorStore.getState().setSyncStatus('connecting')
    }

    return () => {
      source.close()
      if (sourceRef.current === source) sourceRef.current = null
      useEditorStore.getState().setSyncStatus('offline')
    }
  }, [currentProjectId])
}
