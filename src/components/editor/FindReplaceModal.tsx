'use client'

/**
 * PHASE 21 (E16) — Find & replace panel.
 *
 * Source evidence (js/9488-7df54fdf6b8e82aa.min.js):
 *   - FIND_AND_REPLACE=4 (LoadAllPagesReason) — "load all pages before search"
 *   - scope enum ACTIVE_PAGE=0 / ALL_PAGES=1, setSearchScope
 *   - options: matchCase / wholeWords / searchLayerNames
 *   - actions: canvas_search.{find, replace, replace_all, next, previous, close}
 *   - messages: no_results, no_results_on_page, replace_all_message(_all_pages)
 *
 * All pages are in memory (single-document model), so "load all pages" is
 * inherently satisfied; searching the inactive pages reads pages[].elements.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { findAncestors } from '@/lib/element-utils'
import {
  DEFAULT_SEARCH_OPTIONS,
  searchPage,
  replaceRange,
  replaceAllInText,
  type SearchHit,
  type SearchOptions,
} from '@/lib/find-replace'
import { toast } from '@/hooks/use-toast'

export function FindReplaceModal() {
  const open = useEditorStore((s) => s.findReplaceOpen)
  const elements = useEditorStore((s) => s.elements)
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId)

  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const [opts, setOpts] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS)
  const [activeIndex, setActiveIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setActiveIndex(0)
      // focus the find field on open (canvas_search.find)
      requestAnimationFrame(() => findInputRef.current?.focus())
    }
  }, [open])

  /** Pages actually searched: active page uses live elements; others pages[]. */
  const searchablePages = useMemo(() => {
    const list = [
      { pageId: activePageId, pageName: pages.find((p) => p.id === activePageId)?.name || 'Page', elements },
    ]
    if (scope === 'all') {
      for (const p of pages) {
        if (p.id === activePageId) continue
        list.push({ pageId: p.id, pageName: p.name, elements: p.elements })
      }
    }
    return list
  }, [pages, activePageId, elements, scope])

  const hits = useMemo<SearchHit[]>(() => {
    if (!query) return []
    const out: SearchHit[] = []
    for (const p of searchablePages) out.push(...searchPage(p, query, opts))
    return out
  }, [searchablePages, query, opts])

  useEffect(() => {
    if (activeIndex > hits.length - 1) setActiveIndex(0)
  }, [hits.length, activeIndex])

  /** Pan + select the hit's element (switch page first when needed). */
  const jumpTo = useCallback((hit: SearchHit) => {
    const s = useEditorStore.getState()
    const continueJump = () => {
      const st = useEditorStore.getState()
      const el = (function find(list: DesignElement[]): DesignElement | null {
        for (const e of list) {
          if (e.id === hit.elementId) return e
          if (e.children) { const r = find(e.children); if (r) return r }
        }
        return null
      })(st.elements)
      if (!el) return
      st.setSelectedElementIds([el.id])
      // absolute position: element + ancestors chain
      const chain = findAncestors(st.elements, el.id)
      const absX = el.x + chain.reduce((sum, a) => sum + a.x, 0) + el.width / 2
      const absY = el.y + chain.reduce((sum, a) => sum + a.y, 0) + el.height / 2
      // center the element: translate(center) ⇒ pan = -abs * zoom
      st.setPan(-absX * st.zoom, -absY * st.zoom)
    }
    if (hit.pageId !== s.activePageId) {
      s.setActivePage(hit.pageId)
      // selection is cleared on page switch — apply after the store settles
      requestAnimationFrame(continueJump)
    } else {
      continueJump()
    }
  }, [])

  const step = useCallback((dir: 1 | -1) => {
    if (hits.length === 0) return
    const next = (activeIndex + dir + hits.length) % hits.length
    setActiveIndex(next)
    jumpTo(hits[next])
  }, [hits, activeIndex, jumpTo])

  /** Replace the currently active match only. */
  const replaceCurrent = useCallback(() => {
    const hit = hits[activeIndex]
    if (!hit) return
    const s = useEditorStore.getState()
    const pageEls = hit.pageId === s.activePageId ? s.elements : (s.pages.find((p) => p.id === hit.pageId)?.elements || [])
    const el = (function find(list: DesignElement[]): DesignElement | null {
      for (const e of list) {
        if (e.id === hit.elementId) return e
        if (e.children) { const r = find(e.children); if (r) return r }
      }
      return null
    })(pageEls)
    if (!el) return
    const source = hit.field === 'text' ? (el.textContent || '') : el.name
    const next = replaceRange(source, hit.start, hit.end, replacement)
    s.pushHistory()
    if (hit.field === 'text') {
      s.updateElementOnPage(hit.pageId, el.id, { textContent: next })
      if (hit.pageId === s.activePageId) s.applyTextAutoSize(el.id)
    } else {
      s.updateElementOnPage(hit.pageId, el.id, { name: next })
    }
  }, [hits, activeIndex, replacement])

  /** Replace every match in scope (source: canvas_search.replace_all). */
  const replaceAll = useCallback(() => {
    if (hits.length === 0 || !query) return
    const s = useEditorStore.getState()
    // group hits per (page, element, field) — one element update per group
    const groups = new Map<string, { pageId: string; elementId: string; field: 'text' | 'name' }>()
    for (const h of hits) groups.set(`${h.pageId}:${h.elementId}:${h.field}`, h)
    s.pushHistory()
    let count = 0
    for (const g of groups.values()) {
      const pageEls = g.pageId === s.activePageId ? s.elements : (s.pages.find((p) => p.id === g.pageId)?.elements || [])
      const el = (function find(list: DesignElement[]): DesignElement | null {
        for (const e of list) {
          if (e.id === g.elementId) return e
          if (e.children) { const r = find(e.children); if (r) return r }
        }
        return null
      })(pageEls)
      if (!el) continue
      const source = g.field === 'text' ? (el.textContent || '') : el.name
      const res = replaceAllInText(source, query, replacement, opts)
      if (res.count === 0) continue
      count += res.count
      if (g.field === 'text') {
        s.updateElementOnPage(g.pageId, el.id, { textContent: res.text })
        if (g.pageId === s.activePageId) s.applyTextAutoSize(el.id)
      } else {
        s.updateElementOnPage(g.pageId, el.id, { name: res.text })
      }
    }
    // parity: canvas_search.replace_all_message(_all_pages)
    toast({
      title: 'Replace all',
      description: scope === 'all'
        ? `Replaced ${count} match${count === 1 ? '' : 'es'} across all pages.`
        : `Replaced ${count} match${count === 1 ? '' : 'es'} on this page.`,
    })
  }, [hits, query, replacement, opts, scope])

  if (!open) return null

  const noResults = query !== '' && hits.length === 0

  return (
    <div className="absolute top-3 right-3 z-50 w-[340px] rounded-lg bg-[#2C2C2C] border border-[#3C3C3C] shadow-xl">
      {/* header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#3C3C3C]">
        <span className="text-[11px] font-medium text-[#DDD]">Find and replace</span>
        <button
          className="w-5 h-5 flex items-center justify-center rounded text-[#888] hover:text-[#DDD] hover:bg-[#3C3C3C]"
          onClick={() => useEditorStore.getState().setFindReplaceOpen(false)}
          aria-label="Close find and replace"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* find row */}
        <div className="flex items-center gap-1.5">
          <input
            ref={findInputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
              if (e.key === 'Escape') useEditorStore.getState().setFindReplaceOpen(false)
            }}
            placeholder="Find"
            className="flex-1 h-7 px-2 text-[11px] rounded bg-[#1E1E1E] border border-[#383838] text-[#DDD] placeholder-[#666] focus:outline-none focus:border-[#0D99FF]"
          />
          <span className="text-[10px] text-[#888] min-w-[52px] text-center tabular-nums">
            {hits.length > 0 ? `${activeIndex + 1} / ${hits.length}` : '0 / 0'}
          </span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-[#CCC] hover:bg-[#3C3C3C] disabled:text-[#555] disabled:hover:bg-transparent"
            disabled={hits.length === 0}
            onClick={() => step(-1)}
            aria-label="Previous match"
            title="Previous"
          >
            ↑
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-[#CCC] hover:bg-[#3C3C3C] disabled:text-[#555] disabled:hover:bg-transparent"
            disabled={hits.length === 0}
            onClick={() => step(1)}
            aria-label="Next match"
            title="Next"
          >
            ↓
          </button>
        </div>

        {/* replace row */}
        <div className="flex items-center gap-1.5">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with"
            className="flex-1 h-7 px-2 text-[11px] rounded bg-[#1E1E1E] border border-[#383838] text-[#DDD] placeholder-[#666] focus:outline-none focus:border-[#0D99FF]"
          />
          <button
            className="h-7 px-2.5 text-[10px] rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] disabled:bg-[#333] disabled:text-[#666]"
            disabled={hits.length === 0}
            onClick={replaceCurrent}
          >
            Replace
          </button>
          <button
            className="h-7 px-2.5 text-[10px] rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] disabled:bg-[#333] disabled:text-[#666]"
            disabled={hits.length === 0}
            onClick={replaceAll}
          >
            All
          </button>
        </div>

        {/* options row (source: matchCase / wholeWords / searchLayerNames) */}
        <div className="flex items-center gap-3 pt-0.5">
          <select
            value={scope}
            onChange={(e) => { setScope(e.target.value as 'active' | 'all'); setActiveIndex(0) }}
            className="h-6 px-1 text-[10px] rounded bg-[#1E1E1E] border border-[#383838] text-[#CCC] focus:outline-none focus:border-[#0D99FF]"
            title="Search scope (source: ACTIVE_PAGE / ALL_PAGES)"
          >
            <option value="active">This page</option>
            <option value="all">All pages</option>
          </select>
          {([
            ['matchCase', 'Match case'],
            ['wholeWord', 'Whole word'],
            ['includeLayerNames', 'Layer names'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 text-[10px] text-[#AAA] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={opts[key]}
                onChange={(e) => { setOpts((o) => ({ ...o, [key]: e.target.checked })); setActiveIndex(0) }}
                className="accent-[#0D99FF] w-3 h-3"
              />
              {label}
            </label>
          ))}
        </div>

        {/* no-results line (source: no_results / no_results_on_page) */}
        {noResults && (
          <div className="text-[10px] text-[#888] pt-0.5">
            {scope === 'all' ? 'No results found' : 'No results on this page'}
          </div>
        )}

        {/* results list */}
        {hits.length > 0 && (
          <div className="max-h-52 overflow-y-auto rounded border border-[#383838] divide-y divide-[#333]">
            {hits.map((h, i) => (
              <button
                key={`${h.pageId}:${h.elementId}:${h.field}:${h.start}`}
                className={`w-full text-left px-2 py-1.5 hover:bg-[#3C3C3C] ${i === activeIndex ? 'bg-[#0D99FF]/15' : ''}`}
                onClick={() => { setActiveIndex(i); jumpTo(h) }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1 rounded bg-[#1E1E1E] text-[#888] shrink-0">
                    {h.field === 'name' ? 'layer' : 'text'}
                  </span>
                  <span className="text-[10px] text-[#DDD] truncate">{h.elementName}</span>
                  {scope === 'all' && <span className="text-[9px] text-[#666] ml-auto shrink-0">{h.pageName}</span>}
                </div>
                <div className="text-[10px] text-[#999] truncate font-mono">…{h.preview}…</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
