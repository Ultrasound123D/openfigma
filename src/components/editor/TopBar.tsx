'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  ChevronDown,
  Plus,
  Minus,
  Maximize2,
  Play,
  Share2,
  Undo2,
  Redo2,
  Download,
  FileText,
  FolderOpen,
  Save,
  CloudOff,
  Check,
  Group,
  Ungroup,
  ArrowUpToLine,
  ArrowDownToLine,
  BringToFront,
  SendToBack,
  FlipHorizontal2,
  FlipVertical2,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Space,
  MousePointer2,
  Frame,
  Square,
  Circle,
  Spline,
  MoveRight,
  Pen,
  Type,
  Hand,
  Pipette,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { exportDesign, ExportFormat } from '@/lib/export'
import { importFiles, pickFiles } from '@/lib/import/handlers'
import { IMAGE_IMPORT_ACCEPT } from '@/lib/import/image-import'
import { saveProject, loadProject, listProjects } from '@/lib/storage'
import { pushProjectToServer } from '@/lib/server-project'
import { createVidVerseDesign } from '@/data/demo-design'
import { findElementInList } from '@/lib/element-utils'
import { isBooleanOperandType } from '@/lib/boolean-ops'
import { toast } from '@/hooks/use-toast'

export function TopBar() {
  const { zoom, setZoom, setPan, toggleLeftSidebar, toggleRightSidebar, fileName, setFileName, undo, redo, pushHistory, lastSavedAt, isSaving, isDirty, setLastSavedAt, setSaving, setDirty, elements, pages, guides, loadElements, loadServerProject } = useEditorStore()
  const currentProjectId = useEditorStore((s) => s.currentProjectId)
  const syncStatus = useEditorStore((s) => s.syncStatus)
  const lastRemoteOrigin = useEditorStore((s) => s.lastRemoteOrigin)
  const [isEditingName, setIsEditingName] = useState(false)
  const [showSaveIndicator, setShowSaveIndicator] = useState(false)
  const [serverProjects, setServerProjects] = useState<{ id: string; name: string }[]>([])
  const [loadingServer, setLoadingServer] = useState(false)

  // Auto-save (IndexedDB locally + server push when a server project is open)
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = useEditorStore.getState()
      if (!state.isDirty) return
      
      state.setSaving(true)
      try {
        const savedAt = await saveProject({
          id: 'current',
          elements: state.elements,
          pages: state.pages,
          fileName: state.fileName,
          guides: state.guides,
        })
        // Live sync: push to the server so other tabs / MCP see our edits.
        const serverAt = await pushProjectToServer(state)
        state.setLastSavedAt(savedAt)
        state.setDirty(false)
        if (serverAt) {
          setShowSaveIndicator(true)
          setTimeout(() => setShowSaveIndicator(false), 2000)
        }
      } catch (e) {
        console.error('Auto-save failed:', e)
      } finally {
        state.setSaving(false)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState()
    state.setSaving(true)
    try {
      const savedAt = await saveProject({
        id: 'current',
        elements: state.elements,
        pages: state.pages,
        fileName: state.fileName,
        guides: state.guides,
      })
      // Live sync: push to the server so other tabs / MCP see our edits.
      await pushProjectToServer(state)
      state.setLastSavedAt(savedAt)
      state.setDirty(false)
      setShowSaveIndicator(true)
      setTimeout(() => setShowSaveIndicator(false), 2000)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      state.setSaving(false)
    }
  }, [])

  const handleLoad = useCallback(async () => {
    try {
      const data = await loadProject('current')
      if (data && data.elements) {
        loadElements(data.elements)
        setFileName(data.fileName || 'Untitled')
        setShowSaveIndicator(true)
        setTimeout(() => setShowSaveIndicator(false), 2000)
      }
    } catch (e) {
      console.error('Load failed:', e)
    }
  }, [loadElements, setFileName])

  const handleLoadFromServer = useCallback(async (projectId: string) => {
    setLoadingServer(true)
    try {
      await loadServerProject(projectId)
      setShowSaveIndicator(true)
      setTimeout(() => setShowSaveIndicator(false), 2000)
    } catch (e) {
      console.error('Load from server failed:', e)
    } finally {
      setLoadingServer(false)
    }
  }, [loadServerProject])

  const fetchServerProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/editor/projects')
      const data = await res.json()
      setServerProjects(data.projects || [])
    } catch (e) {
      console.error('Failed to fetch server projects:', e)
    }
  }, [])

  // PHASE 3: unified quick export (any of the 5 formats) at 2x default.
  const handleExportFormat = useCallback(async (format: ExportFormat) => {
    await exportDesign({ format, scale: 2, quality: 0.92, fileName })
  }, [fileName])

  const formatSaveTime = (timestamp: number | null) => {
    if (!timestamp) return 'Not saved'
    const diff = Date.now() - timestamp
    if (diff < 60000) return 'Saved just now'
    if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`
    return `Saved at ${new Date(timestamp).toLocaleTimeString()}`
  }

  return (
    <div className="h-10 bg-[#2C2C2C] flex items-center justify-between px-1 select-none border-b border-[#1A1A1A] shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-1">
        <button onClick={toggleLeftSidebar} className="flex items-center justify-center w-7 h-7 rounded hover:bg-[#3C3C3C] transition-colors duration-100" title="Toggle left panel">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-[#FF7262] via-[#A259FF] to-[#0D99FF] flex items-center justify-center">
            <span className="text-white text-[8px] font-bold leading-none">F</span>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center h-6 px-2 rounded hover:bg-[#3C3C3C] text-[#CCCCCC] text-[11px] transition-colors duration-100">File</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[200px]">
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.setSelectedElementIds([]); s.closeServerProject() }}>
              <FileText className="w-4 h-4 mr-2" />New Design<DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={handleLoad}>
              <FolderOpen className="w-4 h-4 mr-2" />Open...<DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={fetchServerProjects}>
                <CloudOff className="w-4 h-4 mr-2" />Load from Server
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC]">
                {serverProjects.length === 0 ? (
                  <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[#666666]" disabled>
                    No projects found
                  </DropdownMenuItem>
                ) : (
                  serverProjects.map((p) => (
                    <DropdownMenuItem key={p.id} className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleLoadFromServer(p.id)}>
                      {loadingServer ? 'Loading...' : p.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            {/* PHASE 4: real import menu — images / editable SVG / project JSON */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                <FolderOpen className="w-4 h-4 mr-2" />Import
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC]">
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => pickFiles(IMAGE_IMPORT_ACCEPT, true, (files) => void importFiles(files))}>
                  Images… (PNG / JPG / WEBP / GIF)
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => pickFiles('.svg,image/svg+xml', true, (files) => void importFiles(files))}>
                  SVG… (editable shapes)
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => pickFiles('application/json,.json', false, (files) => void importFiles(files))}>
                  Project JSON… (replaces document)
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => {
              const state = useEditorStore.getState()
              state.pushHistory()
              state.loadElements(createVidVerseDesign())
              state.setFileName('VidVerse Mobile App')
            }}>
              <FileText className="w-4 h-4 mr-2" />Load Demo Design
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                <Download className="w-4 h-4 mr-2" />Export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC]">
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleExportFormat('PNG')}>Export as PNG</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleExportFormat('JPG')}>Export as JPG</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleExportFormat('SVG')}>Export as SVG</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleExportFormat('PDF')}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleExportFormat('WEBP')}>Export as WEBP</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center h-6 px-2 rounded hover:bg-[#3C3C3C] text-[#CCCCCC] text-[11px] transition-colors duration-100">Edit</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[200px]">
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => undo()}><Undo2 className="w-4 h-4 mr-2" />Undo<DropdownMenuShortcut>⌘Z</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => redo()}><Redo2 className="w-4 h-4 mr-2" />Redo<DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().copySelected()}>Copy<DropdownMenuShortcut>⌘C</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { pushHistory(); useEditorStore.getState().pasteClipboard() }}>Paste<DropdownMenuShortcut>⌘V</DropdownMenuShortcut></DropdownMenuItem>
            {/* PHASE 21 (E14) — paste over selection (source: PASTE_OVER_SELECTION=53,
                action "paste-over-selection", is_edit:!0). Shortcut: Figma-documented
                ⇧⌘V (not source-extracted — registry is minified). */}
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { pushHistory(); useEditorStore.getState().pasteOverSelection() }}>Paste Over Selection<DropdownMenuShortcut>⇧⌘V</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { pushHistory(); useEditorStore.getState().duplicateSelectedElements() }}>Duplicate<DropdownMenuShortcut>⌘D</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { pushHistory(); useEditorStore.getState().deleteSelectedElements() }}>Delete<DropdownMenuShortcut>⌫</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            {/* PHASE 21 (E16) — find & replace (source: FIND_AND_REPLACE=4;
                "load all pages before search"). No source-extractable shortcut. */}
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setFindReplaceOpen(true)}>Find and Replace…</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().selectAll()}>Select All<DropdownMenuShortcut>⌘A</DropdownMenuShortcut></DropdownMenuItem>
            {/* PHASE 21 (E15) — select similar / inverse + select-all-with submenu
                (source children: select-same-{style,fill,stroke,effect,text,font,instance,variant}) */}
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().selectSimilar('similar')}>Select Similar</DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().selectInverse()}>Select Inverse</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">Select All With</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[190px]">
                {([
                  ['style', 'Same style'],
                  ['fill', 'Same fill'],
                  ['stroke', 'Same stroke'],
                  ['effect', 'Same effect'],
                  ['text', 'Same type'],
                  ['font', 'Same font'],
                  ['instance', 'Same instance'],
                  ['variant', 'Same variant'],
                ] as const).map(([key, label]) => (
                  <DropdownMenuItem key={key} className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().selectSimilar(key)}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center h-6 px-2 rounded hover:bg-[#3C3C3C] text-[#CCCCCC] text-[11px] transition-colors duration-100">View</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[200px]">
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => setZoom(zoom + 0.25)}>Zoom In<DropdownMenuShortcut>⌘+</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => setZoom(zoom - 0.25)}>Zoom Out<DropdownMenuShortcut>⌘-</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { setZoom(1); setPan(0, 0) }}>Zoom to 100%<DropdownMenuShortcut>⌘1</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setShowGrid(!useEditorStore.getState().showGrid)}>Toggle Grid</DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setShowRulers(!useEditorStore.getState().showRulers)}>Toggle Rulers</DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setSnapToGrid(!useEditorStore.getState().snapToGrid)}>Toggle Snap to Grid</DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setSnapToElements(!useEditorStore.getState().snapToElements)}>Toggle Snap to Elements</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            {/* PHASE 21 (VW17) — outline mode + variants (source: toggle-outlines,
                toggle-outline-mode-hidden-layers, toggle-outline-mode-object-bounds).
                Shortcut ⌘⇧O is Figma-documented (registry minified in source). */}
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.setOutlinesMode(!s.outlinesMode) }}>
              Outlines<DropdownMenuShortcut>⌘⇧O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" disabled={!useEditorStore.getState().outlinesMode} onClick={() => { const s = useEditorStore.getState(); s.setOutlineHiddenLayers(!s.outlineHiddenLayers) }}>
              Outlines: Hidden Layers
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" disabled={!useEditorStore.getState().outlinesMode} onClick={() => { const s = useEditorStore.getState(); s.setOutlineObjectBounds(!s.outlineObjectBounds) }}>
              Outlines: Object Bounds
            </DropdownMenuItem>
            {/* PHASE 21 (VW18) — pixel preview + retina (source: toggle-pixel-preview /
                activeCanvasPixelPreview, activeCanvasRetinaMode). ⌘⇧P Figma-documented. */}
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.setPixelPreview(!s.pixelPreview) }}>
              Pixel Preview<DropdownMenuShortcut>⌘⇧P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" disabled={!useEditorStore.getState().pixelPreview} onClick={() => { const s = useEditorStore.getState(); s.setPixelPreviewRetina(!s.pixelPreviewRetina) }}>
              Pixel Preview: Retina
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={toggleLeftSidebar}>Toggle Left Panel</DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={toggleRightSidebar}>Toggle Right Panel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center h-6 px-2 rounded hover:bg-[#3C3C3C] text-[#CCCCCC] text-[11px] transition-colors duration-100">Object</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[220px]">
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); if (s.selectedElementIds.length >= 2) { s.pushHistory(); s.groupElements(s.selectedElementIds) } }}>
              <Group className="w-4 h-4 mr-2" />Group<DropdownMenuShortcut>⌘G</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); if (s.selectedElementIds.length === 1) { s.pushHistory(); s.ungroupElements(s.selectedElementIds[0]) } }}>
              <Ungroup className="w-4 h-4 mr-2" />Ungroup<DropdownMenuShortcut>⌘⇧G</DropdownMenuShortcut>
            </DropdownMenuItem>
            {/* PHASE 6: boolean operations + mask */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                <Square className="w-4 h-4 mr-2" />Boolean Operations
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[180px]">
                {(['union', 'subtract', 'intersect', 'exclude'] as const).map((op) => (
                  <DropdownMenuItem key={op} className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => {
                    const s = useEditorStore.getState()
                    if (s.selectedElementIds.length < 2) {
                      toast({ title: 'Boolean operation failed', description: 'Select at least 2 vector shapes (rectangle/ellipse/polygon/star/path)', variant: 'destructive' })
                      return
                    }
                    s.pushHistory()
                    const res = s.applyBooleanOperation(op)
                    if (!res.ok) toast({ title: 'Boolean operation failed', description: res.reason, variant: 'destructive' })
                  }}>
                    {op === 'union' ? 'Union' : op === 'subtract' ? 'Subtract' : op === 'intersect' ? 'Intersect' : 'Exclude'}
                    <DropdownMenuShortcut>⌥⌘{op === 'union' ? 'U' : op === 'subtract' ? 'S' : op === 'intersect' ? 'I' : 'E'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => {
              const s = useEditorStore.getState()
              if (s.selectedElementIds.length !== 1) return
              const el = findElementInList(s.elements, s.selectedElementIds[0])
              if (el && isBooleanOperandType(el)) { s.pushHistory(); s.setElementAsMask(el.id, !el.isMask) }
            }}>
              <Square className="w-4 h-4 mr-2" />Set as Mask / Unmask<DropdownMenuShortcut>⌃⌘M</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.bringForward(id)) }}>
              <ArrowUpToLine className="w-4 h-4 mr-2" />Bring Forward<DropdownMenuShortcut>⌘]</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.sendBackward(id)) }}>
              <ArrowDownToLine className="w-4 h-4 mr-2" />Send Backward<DropdownMenuShortcut>⌘[</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.bringToFront(id)) }}>
              <BringToFront className="w-4 h-4 mr-2" />Bring to Front<DropdownMenuShortcut>⌘⌥]</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.sendToBack(id)) }}>
              <SendToBack className="w-4 h-4 mr-2" />Send to Back<DropdownMenuShortcut>⌘⌥[</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.flipHorizontal(id)) }}>
              <FlipHorizontal2 className="w-4 h-4 mr-2" />Flip Horizontal
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.selectedElementIds.forEach(id => s.flipVertical(id)) }}>
              <FlipVertical2 className="w-4 h-4 mr-2" />Flip Vertical
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                Align
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC]">
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'left') }}>
                  <AlignLeft className="w-4 h-4 mr-2" />Align Left
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'center-h') }}>
                  <AlignCenterHorizontal className="w-4 h-4 mr-2" />Align Center
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'right') }}>
                  <AlignRight className="w-4 h-4 mr-2" />Align Right
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#3C3C3C]" />
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'top') }}>
                  <AlignStartVertical className="w-4 h-4 mr-2" />Align Top
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'center-v') }}>
                  <AlignCenterVertical className="w-4 h-4 mr-2" />Align Middle
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.alignElements(s.selectedElementIds, 'bottom') }}>
                  <AlignEndVertical className="w-4 h-4 mr-2" />Align Bottom
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator className="bg-[#3C3C3C]" />
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.distributeElements(s.selectedElementIds, 'horizontal') }}>
              <Space className="w-4 h-4 mr-2" />Distribute Horizontal Spacing
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { const s = useEditorStore.getState(); s.pushHistory(); s.distributeElements(s.selectedElementIds, 'vertical') }}>
              <Space className="w-4 h-4 mr-2 rotate-90" />Distribute Vertical Spacing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center h-6 px-2 rounded hover:bg-[#3C3C3C] text-[#CCCCCC] text-[11px] transition-colors duration-100">Tools</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCCCCC] min-w-[200px]">
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('move')}>
              <MousePointer2 className="w-4 h-4 mr-2" />Move<DropdownMenuShortcut>V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('frame')}>
              <Frame className="w-4 h-4 mr-2" />Frame<DropdownMenuShortcut>F</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('rectangle')}>
              <Square className="w-4 h-4 mr-2" />Rectangle<DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('ellipse')}>
              <Circle className="w-4 h-4 mr-2" />Ellipse<DropdownMenuShortcut>O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('line')}>
              <Spline className="w-4 h-4 mr-2" />Line<DropdownMenuShortcut>L</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('arrow')}>
              <MoveRight className="w-4 h-4 mr-2" />Arrow<DropdownMenuShortcut>⇧L</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('pen')}>
              <Pen className="w-4 h-4 mr-2" />Pen<DropdownMenuShortcut>P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('text')}>
              <Type className="w-4 h-4 mr-2" />Text<DropdownMenuShortcut>T</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('hand')}>
              <Hand className="w-4 h-4 mr-2" />Hand<DropdownMenuShortcut>H</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => useEditorStore.getState().setActiveTool('eyedropper')}>
              <Pipette className="w-4 h-4 mr-2" />Eyedropper<DropdownMenuShortcut>I</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* File name */}
        <div className="flex items-center gap-1 ml-1">
          {isEditingName ? (
            <input autoFocus value={fileName} onChange={(e) => setFileName(e.target.value)} onBlur={() => setIsEditingName(false)} onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false) }} className="h-5 px-1.5 text-[11px] bg-[#1E1E1E] border border-[#0D99FF] rounded text-white outline-none w-[120px]" />
          ) : (
            <button onDoubleClick={() => setIsEditingName(true)} className="flex items-center gap-1 h-6 px-2 rounded hover:bg-[#3C3C3C] text-white text-[11px] font-medium transition-colors duration-100">
              {fileName}
              <ChevronDown className="w-2.5 h-2.5 text-[#888]" />
            </button>
          )}
        </div>

        {/* Live-sync indicator (SSE) — only when a server project is open */}
        {currentProjectId && (
          <span
            className="text-[9px] flex items-center gap-0.5"
            title={
              syncStatus === 'live'
                ? `Live sync active — remote changes appear instantly${lastRemoteOrigin ? ` (last change by ${lastRemoteOrigin})` : ''}`
                : syncStatus === 'connecting'
                  ? 'Connecting live-sync stream…'
                  : 'Live sync offline'
            }
          >
            {syncStatus === 'live' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#2ED573] animate-pulse" />
                <span className="text-[#2ED573]">Live</span>
              </>
            ) : syncStatus === 'connecting' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFB800] animate-pulse" />
                <span className="text-[#FFB800]">Sync…</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#666]" />
                <span className="text-[#666]">Offline</span>
              </>
            )}
          </span>
        )}

        {/* Save indicator */}
        <div className="flex items-center gap-1 ml-1">
          {isSaving ? (
            <span className="text-[9px] text-[#0D99FF] animate-pulse">Saving...</span>
          ) : showSaveIndicator ? (
            <span className="text-[9px] text-[#2ED573] flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" />
              Saved
            </span>
          ) : isDirty ? (
            <span className="text-[9px] text-[#888] flex items-center gap-0.5" title={formatSaveTime(lastSavedAt)}>
              <CloudOff className="w-2.5 h-2.5" />
              Unsaved
            </span>
          ) : lastSavedAt ? (
            <span className="text-[9px] text-[#666]" title={formatSaveTime(lastSavedAt)}>
              {formatSaveTime(lastSavedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-1">
        <button onClick={() => undo()} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100" title="Undo (Ctrl+Z)">
          <Undo2 className="w-3 h-3" />
        </button>
        <button onClick={() => redo()} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="w-3 h-3" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-medium text-[#888] bg-[#383838] px-1.5 py-px rounded-full">Free</span>
        <div className="w-6 h-6 rounded-full bg-[#FFD700] flex items-center justify-center text-[10px] font-bold text-black">U</div>
        <button className="flex items-center gap-1 bg-[#0D99FF] hover:bg-[#0B87E0] text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors duration-100">
          <Share2 className="w-3 h-3" />Share
        </button>
        <button
          onClick={() => useEditorStore.getState().startPreview()}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100"
          title="Present prototype (▶)"
          data-testid="present-button"
        >
          <Play className="w-3.5 h-3.5" />
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-px ml-0.5">
          <button onClick={() => setZoom(zoom - 0.1)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100" title="Zoom out">
            <Minus className="w-3 h-3" />
          </button>
          <button onClick={() => { setZoom(1); setPan(0, 0) }} className="flex items-center justify-center h-6 px-1 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white text-[11px] font-medium min-w-[38px] transition-colors duration-100 tabular-nums" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(zoom + 0.1)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100" title="Zoom in">
            <Plus className="w-3 h-3" />
          </button>
          <button onClick={() => { const container = document.querySelector('[class*="bg-[#1E1E1E]"]'); if (container) { const rect = container.getBoundingClientRect(); const state = useEditorStore.getState(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; const processEl = (el: DesignElement, parentX = 0, parentY = 0) => { const absX = el.x + parentX; const absY = el.y + parentY; minX = Math.min(minX, absX); minY = Math.min(minY, absY); maxX = Math.max(maxX, absX + el.width); maxY = Math.max(maxY, absY + el.height); el.children?.forEach(c => processEl(c, absX, absY)) }; state.elements.forEach(el => processEl(el)); if (minX !== Infinity) { const cw = maxX - minX; const ch = maxY - minY; const pad = 100; const nz = Math.min((rect.width - pad * 2) / cw, (rect.height - pad * 2) / ch, 2); state.setZoom(nz); state.setPan(-(minX + cw / 2) * nz, -(minY + ch / 2) * nz) } } }} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100" title="Fit to screen">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        <button onClick={toggleRightSidebar} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] text-[#888] hover:text-white transition-colors duration-100 ml-0.5" title="Toggle right panel">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
