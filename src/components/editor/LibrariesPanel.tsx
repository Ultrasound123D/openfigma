'use client'

/**
 * PHASE 22 (C21) — libraries section for the Assets panel.
 *
 * Source evidence (4964 / 5977 / 9035 / figma_app-ebce):
 *   - design_systems.assets_panel.publish_library (Publish library button)
 *   - design_systems.assets_panel.add_more_libraries
 *   - publishedLibrary + library_key; getLibraryPublishedComponents(libraryKey)
 *   - is_subscribed / fileSubscribedLibraryKeys — per-file subscriptions
 *
 * Publish this project's components as a named library; subscribe/unsubscribe
 * per project; insert a library component (imports a hidden master + a visible
 * instance reusing createInstance semantics).
 */

import React, { useEffect, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { toast } from '@/hooks/use-toast'

interface LibraryComponentMeta {
  id: string
  name: string
  type: string
  width: number
  height: number
  fill?: string
}

export function LibrariesPanel() {
  const libraries = useEditorStore((s) => s.libraries)
  const subscribedLibraryKeys = useEditorStore((s) => s.subscribedLibraryKeys)
  const currentProjectId = useEditorStore((s) => s.currentProjectId)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [components, setComponents] = useState<Record<string, LibraryComponentMeta[]>>({})

  useEffect(() => {
    void useEditorStore.getState().loadLibraries()
  }, [])

  const publish = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const ok = await useEditorStore.getState().publishLibraryFromProject(name.trim())
      if (ok) {
        toast({ title: 'Library published', description: name.trim() })
        setName('')
      } else {
        toast({
          title: 'Publish failed',
          description: 'Open a server project with at least one component.',
          variant: 'destructive',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleExpand = async (key: string) => {
    if (expanded === key) {
      setExpanded(null)
      return
    }
    setExpanded(key)
    if (!components[key]) {
      try {
        const res = await fetch(`/api/editor/libraries/${encodeURIComponent(key)}`)
        if (res.ok) {
          const data = await res.json()
          setComponents((c) => ({ ...c, [key]: data?.library?.components || [] }))
        }
      } catch {
        // offline
      }
    }
  }

  const insert = async (key: string, componentId: string) => {
    const ok = await useEditorStore.getState().insertLibraryComponent(key, componentId)
    if (ok) {
      toast({ title: 'Component inserted', description: 'Instance added at viewport center.' })
    } else {
      toast({ title: 'Insert failed', variant: 'destructive' })
    }
  }

  return (
    <div className="border-t border-[#383838] pt-2 mt-2">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">Libraries</span>
      </div>

      {/* publish row (source: assets_panel.publish_library) */}
      <div className="flex items-center gap-1 px-1 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void publish() }}
          placeholder="Library name"
          className="flex-1 h-6 px-1.5 text-[10px] rounded bg-[#1E1E1E] border border-[#383838] text-[#DDD] placeholder-[#666] focus:outline-none focus:border-[#0D99FF]"
        />
        <button
          className="h-6 px-2 text-[10px] rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] disabled:bg-[#333] disabled:text-[#666]"
          disabled={busy || !name.trim()}
          onClick={() => void publish()}
        >
          Publish
        </button>
      </div>

      {libraries.length === 0 && (
        <div className="px-1 pb-1 text-[9px] text-[#666]">
          No published libraries yet. Publish this file&apos;s components to share them across projects.
        </div>
      )}

      <div className="space-y-1">
        {libraries.map((lib) => {
          const subscribed = subscribedLibraryKeys.includes(lib.key)
          const isExpanded = expanded === lib.key
          return (
            <div key={lib.key} className="rounded border border-[#383838]">
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  className="flex-1 text-left text-[10px] text-[#DDD] truncate hover:text-white"
                  onClick={() => void toggleExpand(lib.key)}
                >
                  {isExpanded ? '▾' : '▸'} {lib.name}
                </button>
                <span className="text-[8px] text-[#666]">{lib.publisher}</span>
                <button
                  className={`w-9 h-5 text-[9px] rounded ${subscribed ? 'bg-[#0D99FF] text-white' : 'border border-[#383838] text-[#888]'} hover:opacity-90`}
                  title={subscribed ? 'Unsubscribe (remove from this file)' : 'Subscribe (use in this file)'}
                  onClick={() => useEditorStore.getState().toggleLibrarySubscription(lib.key)}
                >
                  {subscribed ? 'On' : 'Off'}
                </button>
              </div>
              {isExpanded && (
                <div className="px-2 pb-1.5 space-y-0.5">
                  {(components[lib.key] || []).length === 0 && (
                    <div className="text-[9px] text-[#666]">Loading components…</div>
                  )}
                  {(components[lib.key] || []).map((c) => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-1.5 px-1 py-1 rounded hover:bg-[#2C2C2C] text-left disabled:opacity-50"
                      disabled={!subscribed}
                      title={subscribed ? 'Insert instance at viewport center' : 'Subscribe to insert'}
                      onClick={() => void insert(lib.key, c.id)}
                    >
                      <span className="w-3 h-3 rounded-sm border border-[#555] shrink-0" style={{ background: c.fill }} />
                      <span className="text-[10px] text-[#CCC] truncate flex-1">{c.name}</span>
                      <span className="text-[8px] text-[#666]">{Math.round(c.width)}×{Math.round(c.height)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!currentProjectId && (
        <div className="px-1 pt-1.5 text-[9px] text-[#666]">
          Open a server project to publish or insert library components.
        </div>
      )}
    </div>
  )
}
