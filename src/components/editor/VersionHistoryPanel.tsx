'use client'

/**
 * PHASE 22 (C20) — version history panel.
 *
 * Source evidence (figma_app-ebce / 9456 / 3835):
 *   - versionHistory state: versions[] (newest first), activeId where
 *     'current_version' = live document
 *   - activeCanvasEditModeType === HISTORY → read-only canvas while previewing
 *   - restoreVersionId; restore records a NEW version (versions.unshift)
 *   - restore_initiated / restore_completed metrics; restore.in_progress toast
 *   - fullscreen.filename_view.restore (Restore button label)
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { toast } from '@/hooks/use-toast'

interface VersionRow {
  id: string
  label: string
  at: string
}

export function VersionHistoryPanel() {
  const open = useEditorStore((s) => s.versionHistoryOpen)
  const currentProjectId = useEditorStore((s) => s.currentProjectId)
  const viewingVersion = useEditorStore((s) => s.viewingVersion)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')

  const refresh = useCallback(async () => {
    if (!currentProjectId) return
    try {
      const res = await fetch(`/api/editor/projects/${currentProjectId}/versions`)
      if (!res.ok) return
      const data = await res.json()
      setVersions(Array.isArray(data?.versions) ? data.versions : [])
    } catch {
      // offline — keep current list
    }
  }, [currentProjectId])

  useEffect(() => {
    if (!open) return
    // fetch happens async — setState lands after the effect returns
    const t = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(t)
  }, [open, refresh])

  if (!open) return null

  const preview = async (v: VersionRow) => {
    if (!currentProjectId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/editor/projects/${currentProjectId}`)
      if (!res.ok) return
      const data = await res.json()
      const project = data?.project
      const snap = project?.versions?.find((x: { id: string }) => x.id === v.id)?.snapshot
      if (!snap) return
      useEditorStore.getState().previewVersion({
        id: v.id,
        label: v.label,
        snapshot: {
          elements: snap.elements || [],
          pages: snap.pages || [],
          activePageId: snap.activePageId,
        },
      })
    } finally {
      setBusy(false)
    }
  }

  const restore = async (v: VersionRow) => {
    // parity: restore.in_progress → restore_initiated → restore_completed
    toast({ title: 'Restoring version…', description: v.label })
    setBusy(true)
    try {
      const ok = await useEditorStore.getState().restoreVersion(v.id)
      if (ok) {
        toast({ title: 'Version restored', description: `Restored “${v.label}”` })
        await refresh()
      } else {
        toast({ title: 'Restore failed', variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  const saveVersion = async () => {
    if (!label.trim()) return
    setBusy(true)
    try {
      const ok = await useEditorStore.getState().saveVersionSnapshot(label.trim())
      if (ok) {
        toast({ title: 'Version saved', description: label.trim() })
        setLabel('')
        await refresh()
      } else {
        toast({ title: 'Save version failed', variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute top-3 right-3 z-50 w-[300px] rounded-lg bg-[#2C2C2C] border border-[#3C3C3C] shadow-xl">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#3C3C3C]">
        <span className="text-[11px] font-medium text-[#DDD]">Version history</span>
        <button
          className="w-5 h-5 flex items-center justify-center rounded text-[#888] hover:text-[#DDD] hover:bg-[#3C3C3C]"
          onClick={() => {
            useEditorStore.getState().exitVersionPreview()
            useEditorStore.getState().setVersionHistoryOpen(false)
          }}
          aria-label="Close version history"
        >
          ✕
        </button>
      </div>

      {/* save labeled version */}
      {currentProjectId && (
        <div className="flex items-center gap-1.5 p-2.5 border-b border-[#3C3C3C]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveVersion() }}
            placeholder="Version name"
            className="flex-1 h-7 px-2 text-[11px] rounded bg-[#1E1E1E] border border-[#383838] text-[#DDD] placeholder-[#666] focus:outline-none focus:border-[#0D99FF]"
          />
          <button
            className="h-7 px-2.5 text-[10px] rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] disabled:bg-[#333] disabled:text-[#666]"
            disabled={busy || !label.trim()}
            onClick={() => void saveVersion()}
          >
            Save
          </button>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto">
        {versions.length === 0 && (
          <div className="px-3 py-4 text-[10px] text-[#888]">
            {currentProjectId
              ? 'No versions yet. Versions are captured on save.'
              : 'Open a server project to use version history.'}
          </div>
        )}
        {versions.map((v) => {
          const isViewing = viewingVersion?.id === v.id
          return (
            <div
              key={v.id}
              className={`px-3 py-2 border-b border-[#333] last:border-0 ${isViewing ? 'bg-[#0D99FF]/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#DDD] truncate flex-1">{v.label}</span>
                <span className="text-[9px] text-[#666] shrink-0">
                  {new Date(v.at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  className="h-6 px-2 text-[10px] rounded border border-[#383838] text-[#CCC] hover:bg-[#3C3C3C] disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void preview(v)}
                >
                  {isViewing ? 'Viewing' : 'Preview'}
                </button>
                {currentProjectId && (
                  <button
                    className="h-6 px-2 text-[10px] rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void restore(v)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
