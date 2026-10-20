'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Plus, FileText, Palette, Type as TypeIcon, Sparkles, Component as ComponentIcon, Search, ChevronDown, ChevronRight, Eye, EyeOff, LayoutTemplate, MoreHorizontal, Trash2, Copy, ArrowUpDown } from 'lucide-react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import { LayerPanel } from './LayerPanel'
import { ComponentPanel } from './ComponentPanel'
// PHASE 22 (C21) — published libraries section
import { LibrariesPanel } from './LibrariesPanel'
import { UITemplatesPanel } from './UITemplatesPanel'
import { StylesPanel } from './StylesPanel'

export function LeftSidebar() {
  const { leftTab, setLeftTab, pages, activePageId, addPage, deletePage, renamePage, setActivePage, duplicatePage, reorderPages, elements } = useEditorStore()
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [colorsExpanded, setColorsExpanded] = useState(true)
  const [textStylesExpanded, setTextStylesExpanded] = useState(true)
  const [effectsExpanded, setEffectsExpanded] = useState(false)
  const [fontsExpanded, setFontsExpanded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const handleAddPage = () => {
    addPage(`Page ${pages.length + 1}`)
  }

  const handlePageClick = (pageId: string) => {
    if (pageId !== activePageId) {
      setActivePage(pageId)
    }
  }

  const handlePageDoubleClick = (pageId: string, currentName: string) => {
    setRenamingPageId(pageId)
    setRenameValue(currentName)
  }

  const handleRenameSubmit = () => {
    if (renamingPageId && renameValue.trim()) {
      renamePage(renamingPageId, renameValue.trim())
    }
    setRenamingPageId(null)
  }

  const handleContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, pageId })
  }

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDropIdx(idx)
  }

  const handleDragLeave = () => setDropIdx(null)

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== idx) {
      reorderPages(dragIdx, idx)
    }
    setDragIdx(null)
    setDropIdx(null)
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // ... existing color/font collection ...

  // Collect all unique colors from elements (Document Colors)
  const documentColors = useMemo(() => {
    const colorMap = new Map<string, number>() // color -> count
    const processEl = (el: DesignElement) => {
      const addColor = (c: string) => {
        if (c && c !== 'transparent' && c.startsWith('#')) {
          const upper = c.toUpperCase()
          colorMap.set(upper, (colorMap.get(upper) || 0) + 1)
        }
      }
      addColor(el.fill)
      addColor(el.stroke)
      if (el.textColor) addColor(el.textColor)
      if (el.fills) el.fills.forEach(f => addColor(f.color))
      if (el.strokes) el.strokes.forEach(s => addColor(s.color))
      if (el.shadows) el.shadows.forEach(s => addColor(s.color))
      el.children?.forEach(processEl)
    }
    elements.forEach(processEl)
    return Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by usage count
      .slice(0, 30)
  }, [elements])

  // Collect all unique text styles (Document Text Styles)
  const documentTextStyles = useMemo(() => {
    const styleMap = new Map<string, { fontFamily: string; fontSize: number; fontWeight: number; count: number }>()
    const processEl = (el: DesignElement) => {
      if (el.type === 'text' && el.fontFamily && el.fontSize) {
        const key = `${el.fontFamily}-${el.fontSize}-${el.fontWeight || 400}`
        const existing = styleMap.get(key)
        if (existing) {
          existing.count++
        } else {
          styleMap.set(key, { fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight || 400, count: 1 })
        }
      }
      el.children?.forEach(processEl)
    }
    elements.forEach(processEl)
    return Array.from(styleMap.values()).sort((a, b) => b.count - a.count)
  }, [elements])

  // Collect all fonts used
  const documentFonts = useMemo(() => {
    const fontSet = new Set<string>()
    const processEl = (el: DesignElement) => {
      if (el.fontFamily) fontSet.add(el.fontFamily)
      el.children?.forEach(processEl)
    }
    elements.forEach(processEl)
    return Array.from(fontSet).sort()
  }, [elements])

  const elementCount = elements.length

  return (
    <div className="h-full bg-[#252525] flex flex-col border-r border-[#383838] select-none">
      {/* Tabs */}
      <div className="flex border-b border-[#383838] shrink-0">
        <button
          onClick={() => setLeftTab('file')}
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors duration-100 uppercase tracking-wider ${
            leftTab === 'file' ? 'text-white border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#CCC]'
          }`}
        >
          Layers
        </button>
        <button
          onClick={() => setLeftTab('assets')}
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors duration-100 uppercase tracking-wider ${
            leftTab === 'assets' ? 'text-white border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#CCC]'
          }`}
        >
          Assets
        </button>
      </div>

      {/* Layers Tab Content */}
      {leftTab === 'file' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Pages section */}
          <div className="border-b border-[#383838]">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Pages</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-[#666] tabular-nums">{pages.length}</span>
                <button onClick={handleAddPage} className="flex items-center justify-center w-4 h-4 rounded hover:bg-[#3C3C3C] transition-colors duration-100" title="Add page">
                  <Plus className="w-3 h-3 text-[#888]" />
                </button>
              </div>
            </div>
            {pages.map((page, idx) => (
              <div key={page.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-colors duration-100 group ${
                  page.id === activePageId ? 'bg-[#0D99FF]/15' : 'hover:bg-[#2A2A2A]'
                } ${dropIdx === idx ? 'border-t border-[#0D99FF]' : ''}`}
                onClick={() => handlePageClick(page.id)}
                onDoubleClick={() => handlePageDoubleClick(page.id, page.name)}
                onContextMenu={(e) => handleContextMenu(e, page.id)}
              >
                <div className="w-3 h-3 rounded-sm border border-[#555] flex items-center justify-center shrink-0" style={{ backgroundColor: page.backgroundColor || '#2C2C2C' }}>
                  <FileText className="w-2 h-2 text-[#888]" />
                </div>
                {renamingPageId === page.id ? (
                  <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={handleRenameSubmit} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenamingPageId(null) }} className="flex-1 h-4 px-1 text-[10px] bg-[#1E1E1E] border border-[#0D99FF] rounded text-[#DDD] outline-none" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className={`text-[11px] flex-1 truncate ${page.id === activePageId ? 'text-white' : 'text-[#CCC]'}`}>{page.name}</span>
                )}
                {page.id === activePageId && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); duplicatePage(page.id) }} className="w-4 h-4 rounded hover:bg-[#3C3C3C] flex items-center justify-center" title="Duplicate page">
                      <Copy className="w-2.5 h-2.5 text-[#888]" />
                    </button>
                    {pages.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deletePage(page.id) }} className="w-4 h-4 rounded hover:bg-[#3C3C3C] flex items-center justify-center" title="Delete page">
                        <Trash2 className="w-2.5 h-2.5 text-[#888]" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Layers section - LayerPanel has its own search/filter */}
          <div className="flex-1 overflow-hidden">
            <LayerPanel />
          </div>
          
          {/* Selection count */}
          <div className="px-2 py-0.5 border-t border-[#383838] shrink-0">
            <span className="text-[9px] text-[#666]">{elementCount} elements</span>
          </div>
        </div>
      )}

      {/* Assets Tab Content */}
      {leftTab === 'assets' && (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="relative p-2 border-b border-[#383838] shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#888]" />
            <input type="text" placeholder="Search assets..." className="w-full h-7 pl-7 pr-2 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#CCC] focus:outline-none focus:border-[#0D99FF]" />
          </div>

          {/* Local components */}
          <div className="p-3 border-b border-[#383838]">
            <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">Local Components</h3>
            <ComponentPanel />
            <LibrariesPanel />
          </div>

          {/* PHASE 7 — Project styles */}
          <div className="border-b border-[#383838]">
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <svg width="12" height="12" viewBox="0 0 10 10" className="text-[#888]" fill="currentColor">
                <circle cx="2" cy="2" r="1.15" /><circle cx="8" cy="2" r="1.15" />
                <circle cx="5" cy="5" r="1.15" /><circle cx="2" cy="8" r="1.15" /><circle cx="8" cy="8" r="1.15" />
              </svg>
              <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Styles</h3>
            </div>
            <StylesPanel />
          </div>

          {/* UI Templates section */}
          <div className="border-b border-[#383838]">
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-[#888]" />
              <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">UI Templates</h3>
            </div>
            <UITemplatesPanel />
          </div>

          {/* Document Colors section */}
          <div className="border-b border-[#383838]">
            <button 
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2A2A2A] transition-colors"
              onClick={() => setColorsExpanded(!colorsExpanded)}
            >
              {colorsExpanded ? <ChevronDown className="w-3 h-3 text-[#666]" /> : <ChevronRight className="w-3 h-3 text-[#666]" />}
              <Palette className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-[11px] text-[#CCC] flex-1 text-left">Document Colors</span>
              <span className="text-[10px] text-[#666] tabular-nums">{documentColors.length}</span>
            </button>
            {colorsExpanded && documentColors.length > 0 && (
              <div className="px-3 pb-2">
                <div className="flex flex-wrap gap-1">
                  {documentColors.map(([color, count]) => (
                    <button
                      key={color}
                      className="w-7 h-7 rounded border border-[#555]/50 hover:scale-110 transition-transform relative group"
                      style={{ backgroundColor: color }}
                      title={`${color} (${count} uses)`}
                    >
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#333] text-[7px] text-[#AAA] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {count > 9 ? '9+' : count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {colorsExpanded && documentColors.length === 0 && (
              <div className="px-3 pb-2">
                <span className="text-[10px] text-[#555]">No document colors yet</span>
              </div>
            )}
          </div>

          {/* Text Styles section */}
          <div className="border-b border-[#383838]">
            <button 
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2A2A2A] transition-colors"
              onClick={() => setTextStylesExpanded(!textStylesExpanded)}
            >
              {textStylesExpanded ? <ChevronDown className="w-3 h-3 text-[#666]" /> : <ChevronRight className="w-3 h-3 text-[#666]" />}
              <TypeIcon className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-[11px] text-[#CCC] flex-1 text-left">Text Styles</span>
              <span className="text-[10px] text-[#666] tabular-nums">{documentTextStyles.length}</span>
            </button>
            {textStylesExpanded && documentTextStyles.length > 0 && (
              <div className="px-3 pb-2 space-y-0.5">
                {documentTextStyles.map((style, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2A2A2A] cursor-pointer transition-colors">
                    <span className="text-[11px] text-[#CCC] flex-1" style={{ fontFamily: style.fontFamily, fontWeight: style.fontWeight }}>
                      {style.fontFamily} {style.fontSize}px
                    </span>
                    <span className="text-[9px] text-[#555] tabular-nums">{style.count}x</span>
                  </div>
                ))}
              </div>
            )}
            {textStylesExpanded && documentTextStyles.length === 0 && (
              <div className="px-3 pb-2">
                <span className="text-[10px] text-[#555]">No text styles yet</span>
              </div>
            )}
          </div>

          {/* Effects section */}
          <div className="border-b border-[#383838]">
            <button 
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2A2A2A] transition-colors"
              onClick={() => setEffectsExpanded(!effectsExpanded)}
            >
              {effectsExpanded ? <ChevronDown className="w-3 h-3 text-[#666]" /> : <ChevronRight className="w-3 h-3 text-[#666]" />}
              <Sparkles className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-[11px] text-[#CCC] flex-1 text-left">Effects</span>
              <span className="text-[10px] text-[#666] tabular-nums">0</span>
            </button>
          </div>

          {/* Fonts section */}
          <div>
            <button 
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#2A2A2A] transition-colors"
              onClick={() => setFontsExpanded(!fontsExpanded)}
            >
              {fontsExpanded ? <ChevronDown className="w-3 h-3 text-[#666]" /> : <ChevronRight className="w-3 h-3 text-[#666]" />}
              <TypeIcon className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-[11px] text-[#CCC] flex-1 text-left">Fonts</span>
              <span className="text-[10px] text-[#666] tabular-nums">{documentFonts.length}</span>
            </button>
            {fontsExpanded && documentFonts.length > 0 && (
              <div className="px-3 pb-2 space-y-0.5">
                {documentFonts.map(font => (
                  <div key={font} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2A2A2A] cursor-pointer transition-colors">
                    <span className="text-[11px] text-[#CCC]" style={{ fontFamily: font }}>{font}</span>
                  </div>
                ))}
              </div>
            )}
            {fontsExpanded && documentFonts.length === 0 && (
              <div className="px-3 pb-2">
                <span className="text-[10px] text-[#555]">No fonts used yet</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={closeContextMenu}>
          <div className="absolute bg-[#2C2C2C] border border-[#555] rounded-lg shadow-2xl py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button onClick={() => { renamePage(contextMenu.pageId, prompt('Rename page:', pages.find(p => p.id === contextMenu.pageId)?.name) || ''); closeContextMenu() }} className="w-full px-3 py-1 text-left text-[11px] text-[#CCC] hover:bg-[#3C3C3C] flex items-center gap-2">
              Rename
            </button>
            <button onClick={() => { duplicatePage(contextMenu.pageId); closeContextMenu() }} className="w-full px-3 py-1 text-left text-[11px] text-[#CCC] hover:bg-[#3C3C3C] flex items-center gap-2">
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <div className="h-px bg-[#555] my-1" />
            {pages.length > 1 && (
              <button onClick={() => { deletePage(contextMenu.pageId); closeContextMenu() }} className="w-full px-3 py-1 text-left text-[11px] text-[#F00] hover:bg-[#3C3C3C] flex items-center gap-2">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
