'use client'

/**
 * PHASE 23 (F13) — keyboard shortcuts modal.
 *
 * Source evidence (figma_app-*.min.js):
 *   - "keyboard_settings.keyboard_shortcuts_modal.title"
 *   - keyboard_shortcuts_modal.tab.{keyboard_layout,most_used}
 *
 * Scope honesty: the source modal is a full customizable-shortcut editor
 * (pinning, layouts, re-binding). What is portable without guessing is the
 * cheatsheet surface — a grouped, searchable list of the shortcuts this port
 * actually implements (documented per phase in use-canvas-keyboard.ts and the
 * menus). Re-binding/pinning is marked OUT OF SCOPE (no extractable behavior).
 */

import React, { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'

interface ShortcutRow {
  keys: string
  label: string
}

const SHORTCUT_GROUPS: { group: string; rows: ShortcutRow[] }[] = [
  {
    group: 'Tools',
    rows: [
      { keys: 'V', label: 'Move' },
      { keys: 'F', label: 'Frame' },
      { keys: 'R', label: 'Rectangle' },
      { keys: 'O', label: 'Ellipse' },
      { keys: 'L', label: 'Line' },
      { keys: 'P', label: 'Pen' },
      { keys: '⇧P', label: 'Pencil' },
      { keys: 'T', label: 'Text' },
      { keys: 'K', label: 'Scale' },
      { keys: 'I', label: 'Eyedropper' },
      { keys: 'S', label: 'Slice' },
      { keys: 'C', label: 'Comment' },
      { keys: 'H', label: 'Hand' },
    ],
  },
  {
    group: 'Edit',
    rows: [
      { keys: '⌘Z', label: 'Undo' },
      { keys: '⌘⇧Z', label: 'Redo' },
      { keys: '⌘C / ⌘V', label: 'Copy / Paste' },
      { keys: '⇧⌘C', label: 'Copy as PNG' },
      { keys: '⇧⌘V', label: 'Paste over selection' },
      { keys: '⌘D', label: 'Duplicate' },
      { keys: '⌘G / ⌘⇧G', label: 'Group / Ungroup' },
      { keys: '⌥⌘G', label: 'Frame selection' },
      { keys: '⌘F', label: 'Find and replace' },
      { keys: '⌘A', label: 'Select all' },
      { keys: 'Esc', label: 'Deselect / cancel' },
      { keys: '⌫', label: 'Delete' },
    ],
  },
  {
    group: 'Transform',
    rows: [
      { keys: 'Arrows', label: 'Nudge (small amount)' },
      { keys: '⇧Arrows', label: 'Nudge (large amount)' },
      { keys: '⌘[ / ⌘]', label: 'Send backward / Bring forward' },
      { keys: '⌥⌘U', label: 'Boolean union' },
      { keys: '⌥⌘S', label: 'Boolean subtract' },
      { keys: '⌥⌘I', label: 'Boolean intersect' },
      { keys: '⌥⌘E', label: 'Boolean exclude' },
    ],
  },
  {
    group: 'View',
    rows: [
      { keys: '⌘+', label: 'Zoom in' },
      { keys: '⌘-', label: 'Zoom out' },
      { keys: '⌘1', label: 'Zoom to 100%' },
      { keys: '⇧1', label: 'Zoom to fit' },
      { keys: '⇧2', label: 'Zoom to selection' },
      { keys: '⇧⌘O', label: 'Outlines mode' },
      { keys: '⇧⌘P', label: 'Pixel preview' },
      { keys: "⌘'", label: 'Pixel grid' },
      { keys: '⌘\\', label: 'Layout grids' },
      { keys: '⌘/', label: 'Keyboard shortcuts' },
    ],
  },
  {
    group: 'Text',
    rows: [
      { keys: '⌘B', label: 'Bold' },
      { keys: '⌘I', label: 'Italic' },
      { keys: '⌘U', label: 'Underline' },
      { keys: '⌥⌘↵', label: 'Auto resize text' },
      { keys: 'Enter', label: 'Edit text (in place)' },
    ],
  },
  {
    group: 'Canvas',
    rows: [
      { keys: 'Space+Drag', label: 'Pan' },
      { keys: '⌘Scroll', label: 'Zoom to cursor' },
      { keys: '⌥Drag', label: 'Duplicate drag' },
      { keys: 'Hold ⌥', label: 'Measure distances' },
    ],
  },
]

export function ShortcutsModal() {
  const open = useEditorStore((s) => s.shortcutsOpen)
  const [query, setQuery] = useState('')

  // Reset the search when the modal (re)opens — render-phase adjustment
  // (eslint react-hooks/set-state-in-effect forbids the effect form).
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) setQuery('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SHORTCUT_GROUPS
    return SHORTCUT_GROUPS.map((g) => ({
      group: g.group,
      rows: g.rows.filter(
        (r) => r.label.toLowerCase().includes(q) || r.keys.toLowerCase().includes(q)
      ),
    })).filter((g) => g.rows.length > 0)
  }, [query])

  if (!open) return null

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => useEditorStore.getState().setShortcutsOpen(false)}
    >
      <div
        className="w-[560px] max-h-[80%] flex flex-col rounded-lg bg-[#2C2C2C] border border-[#3C3C3C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[#3C3C3C]">
          <span className="text-[13px] font-medium text-[#DDD]">Keyboard shortcuts</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-[#888] hover:text-[#DDD] hover:bg-[#3C3C3C]"
            onClick={() => useEditorStore.getState().setShortcutsOpen(false)}
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        {/* search */}
        <div className="px-4 py-2 border-b border-[#3C3C3C]">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts…"
            className="w-full h-7 px-2 text-[12px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
            onKeyDown={(e) => {
              if (e.key === 'Escape') useEditorStore.getState().setShortcutsOpen(false)
            }}
          />
        </div>

        {/* groups */}
        <div className="overflow-y-auto px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-4">
          {filtered.map((g) => (
            <div key={g.group}>
              <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">
                {g.group}
              </div>
              <div className="space-y-0.5">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[#BBB] truncate">{r.label}</span>
                    <span className="text-[10px] text-[#888] shrink-0 font-mono border border-[#383838] rounded px-1 py-px bg-[#1E1E1E]">
                      {r.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center text-[11px] text-[#888] py-6">
              No shortcuts match “{query}”.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
