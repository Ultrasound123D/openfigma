/**
 * PHASE 21 (E16) — canvas find & replace engine.
 *
 * Source evidence (js/9488-7df54fdf6b8e82aa.min.js):
 *   - search options: `matchCase`, `wholeWords`, `searchLayerNames`
 *   - scope enum: `ACTIVE_PAGE=0 / ALL_PAGES=1`
 *   - "load all pages before search" (FIND_AND_REPLACE=4 LoadAllPagesReason)
 *   - actions: canvas_search.{find, replace, replace_all, next, previous, close, filter}
 *   - messages: no_results, no_results_on_page, replace_all_message(_all_pages)
 *
 * Pure functions only — no store access (keeps this testable + import-safe).
 */

import type { DesignElement } from '@/store/editor-store'

export interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
  /** Search layer names in addition to text content (source: searchLayerNames). */
  includeLayerNames: boolean
}

export interface SearchHit {
  pageId: string
  pageName: string
  elementId: string
  elementName: string
  /** Where the match lives: a text element's content or a layer name. */
  field: 'text' | 'name'
  /** Match range within the field's string value. */
  start: number
  end: number
  /** ±30 chars context around the match for the results list. */
  preview: string
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  matchCase: false,
  wholeWord: false,
  includeLayerNames: true,
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** All match ranges of `query` inside `text` honoring the options. */
export function findMatches(text: string, query: string, opts: SearchOptions): { start: number; end: number }[] {
  if (!query) return []
  const flags = opts.matchCase ? 'g' : 'gi'
  const body = opts.wholeWord ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query)
  const re = new RegExp(body, flags)
  const out: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length })
    if (m[0].length === 0) re.lastIndex++ // safety for empty matches
    if (out.length > 5000) break // pathological guard
  }
  return out
}

function makePreview(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 30)
  const to = Math.min(text.length, end + 30)
  return (from > 0 ? '…' : '') + text.slice(from, to) + (to < text.length ? '…' : '')
}

/** Collect hits for one element subtree (text content + layer names). */
function collectFromElement(
  el: DesignElement,
  pageId: string,
  pageName: string,
  query: string,
  opts: SearchOptions,
  out: SearchHit[]
): void {
  if (el.type === 'text' && el.textContent) {
    for (const m of findMatches(el.textContent, query, opts)) {
      out.push({
        pageId, pageName,
        elementId: el.id,
        elementName: el.name || 'Text',
        field: 'text',
        start: m.start,
        end: m.end,
        preview: makePreview(el.textContent, m.start, m.end),
      })
    }
  }
  if (opts.includeLayerNames && el.name) {
    for (const m of findMatches(el.name, query, opts)) {
      out.push({
        pageId, pageName,
        elementId: el.id,
        elementName: el.name,
        field: 'name',
        start: m.start,
        end: m.end,
        preview: makePreview(el.name, m.start, m.end),
      })
    }
  }
  if (el.children) {
    for (const c of el.children) collectFromElement(c, pageId, pageName, query, opts, out)
  }
}

export interface SearchablePage {
  pageId: string
  pageName: string
  elements: DesignElement[]
}

/** Search one page's element tree. */
export function searchPage(page: SearchablePage, query: string, opts: SearchOptions): SearchHit[] {
  const out: SearchHit[] = []
  if (!query) return out
  for (const el of page.elements) collectFromElement(el, page.pageId, page.pageName, query, opts, out)
  return out
}

/** Replace one match range inside a string. */
export function replaceRange(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end)
}

/** Replace every match inside a string; returns the new text + count. */
export function replaceAllInText(
  text: string,
  query: string,
  replacement: string,
  opts: SearchOptions
): { text: string; count: number } {
  const matches = findMatches(text, query, opts)
  if (matches.length === 0) return { text, count: 0 }
  // replace back-to-front so earlier ranges stay valid
  let out = text
  for (let i = matches.length - 1; i >= 0; i--) {
    out = replaceRange(out, matches[i].start, matches[i].end, replacement)
  }
  return { text: out, count: matches.length }
}
