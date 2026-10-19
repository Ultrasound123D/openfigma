'use client'

/**
 * PHASE 7 — StylesPanel: project styles list (paint / text / effect).
 *
 * Lives in the left sidebar "Assets" tab. Behaviors (Figma parity):
 *   - list styles with swatch + name + usage count badge
 *   - click a style → apply to current selection
 *   - double-click name → rename
 *   - right side: detach (unlink icon) when selection references it, delete (×)
 *   - "Create style" flow is initiated from the PropertiesPanel slot menus
 *     (the four-dots style menu), matching Figma's mental model.
 */

import React, { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { countStyleUsage, styleSwatchStyle, STYLE_KIND_LABEL } from '@/lib/styles'
import type { ProjectStyle } from '@/lib/styles'

function StyleRow({ style }: { style: ProjectStyle }) {
  const { elements, selectedElementIds, applyStyleToSelection, detachStyleFromSelection, deleteStyle, renameStyle } = useEditorStore()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(style.name)

  const usage = useMemo(() => countStyleUsage(elements, style.id), [elements, style.id])
  const attachedToSelection = useMemo(() => {
    const selected = selectedElementIds.map((id) => findDeep(elements, id)).filter(Boolean) as DesignElement[]
    return selected.some((el) =>
      el.fillStyleId === style.id || el.strokeStyleId === style.id ||
      el.textStyleId === style.id || el.effectStyleId === style.id)
  }, [elements, selectedElementIds, style.id])

  const kindIcon = style.kind === 'paint' ? '◍' : style.kind === 'text' ? 'T' : '◉'

  return (
    <div
      className="group flex items-center gap-2 px-2 h-7 rounded hover:bg-[#2C2C2C] cursor-pointer"
      onClick={() => applyStyleToSelection(style.id)}
      title={`${STYLE_KIND_LABEL[style.kind]} — click to apply to selection`}
    >
      <span
        className="w-3.5 h-3.5 rounded-[2px] border border-[#555] shrink-0 flex items-center justify-center text-[9px] text-[#DDD]"
        style={{ background: styleSwatchStyle(style) }}
      >
        {style.kind !== 'paint' ? kindIcon : ''}
      </span>
      {editingName ? (
        <input
          autoFocus
          className="flex-1 min-w-0 h-5 px-1 text-[11px] bg-[#1E1E1E] border border-[#0D99FF] rounded text-[#DDD] focus:outline-none"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { setEditingName(false); if (nameDraft.trim()) renameStyle(style.id, nameDraft.trim()) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setEditingName(false); if (nameDraft.trim()) renameStyle(style.id, nameDraft.trim()) }
            if (e.key === 'Escape') { setEditingName(false); setNameDraft(style.name) }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-[11px] text-[#DDD]"
          onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); setNameDraft(style.name) }}
        >
          {style.name}
        </span>
      )}
      {usage > 0 && (
        <span className="text-[9px] text-[#888] tabular-nums shrink-0" title={`${usage} usage${usage === 1 ? '' : 's'}`}>
          {usage}
        </span>
      )}
      {attachedToSelection && (
        <button
          className="w-4 h-4 shrink-0 hidden group-hover:flex items-center justify-center text-[#888] hover:text-[#FFA116]"
          title="Detach from selection"
          onClick={(e) => { e.stopPropagation(); detachStyleFromSelection(style.id) }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M5.5 2.5 L2.5 5.5 a1.4 1.4 0 0 0 0 2 l0 0 a1.4 1.4 0 0 0 2 0 L7.5 4.5" />
            <path d="M4 2 L5.5 2 L8 4.5 L8 6" />
          </svg>
        </button>
      )}
      <button
        className="w-4 h-4 shrink-0 hidden group-hover:flex items-center justify-center text-[#888] hover:text-[#F24822]"
        title="Delete style (references detach, values stay)"
        onClick={(e) => { e.stopPropagation(); deleteStyle(style.id) }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 2 L8 8 M8 2 L2 8" />
        </svg>
      </button>
    </div>
  )
}

function findDeep(elements: DesignElement[], id: string): DesignElement | null {
  for (const el of elements) {
    if (el.id === id) return el
    if (el.children) {
      const found = findDeep(el.children, id)
      if (found) return found
    }
  }
  return null
}

export function StylesPanel() {
  const styles = useEditorStore((s) => s.styles)

  if (styles.length === 0) {
    return (
      <div className="px-3 py-4 text-[10px] leading-4 text-[#666]">
        No styles yet. Select an element and use the style menu (four dots) next to
        Fill, Stroke, Text or Effects in the design panel to create one.
      </div>
    )
  }

  const byKind = (kind: ProjectStyle['kind']) => styles.filter((s) => s.kind === kind)
  const sections: { kind: ProjectStyle['kind']; label: string }[] = [
    { kind: 'paint', label: 'Paint styles' },
    { kind: 'text', label: 'Text styles' },
    { kind: 'effect', label: 'Effect styles' },
  ]

  return (
    <div className="flex flex-col gap-1 py-1">
      {sections.map(({ kind, label }) => {
        const list = byKind(kind)
        if (list.length === 0) return null
        return (
          <div key={kind}>
            <div className="px-2 pt-1 pb-0.5 text-[9px] font-medium uppercase tracking-wide text-[#666]">{label}</div>
            {list.map((s) => (
              <StyleRow key={s.id} style={s} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
