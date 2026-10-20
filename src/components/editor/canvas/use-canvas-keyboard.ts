'use client'

import { useEffect } from 'react'
import { useEditorStore, generateId } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { findElementInList, getVectorNetwork } from '@/lib/element-utils'
import { isBooleanOperandType } from '@/lib/boolean-ops'
// PHASE 18 — parametric shape → vector conversion on Enter
import { isShapeToVectorCandidate } from '@/lib/shape-to-vector'
import { toast } from '@/hooks/use-toast'
import type { PenTool } from './use-pen-tool'
import type { PathEditing } from './use-path-editing'

interface UseCanvasKeyboardParams {
  fitToScreen: () => void
  zoomToSelection: () => void
  pen: PenTool
  pathEditing: PathEditing
  editingTextId: string | null
  setEditingTextId: (id: string | null) => void
  setSpaceHeld: (held: boolean) => void
  setAltHeld: (held: boolean) => void
  resetDrawingState: () => void
}

/**
 * useCanvasKeyboard — global keyboard shortcut layer.
 *
 * Two effects:
 *   1. Capture-phase blocker that swallows browser Ctrl+key combos
 *      (native-app feel).
 *   2. The editor shortcut map: undo/redo, tools, zoom, clipboard, grouping,
 *      z-order, arrow nudging, page navigation, pen finish, path editing.
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor) — behavior identical.
 */
export function useCanvasKeyboard({
  fitToScreen,
  zoomToSelection,
  pen,
  pathEditing,
  editingTextId,
  setEditingTextId,
  setSpaceHeld,
  setAltHeld,
  resetDrawingState,
}: UseCanvasKeyboardParams) {
  const activeTool = useEditorStore((s) => s.activeTool)
  const currentFrameId = useEditorStore((s) => s.currentFrameId)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  const {
    penPoints, setPenPoints, penPointsRef, penElementIdRef,
    finishPenPath, isPencilDrawing, setIsPencilDrawing,
    pencilPoints, setPencilPoints,
  } = pen
  const { editingPathId, editingPointIndex, setEditingPointIndex, exitPathEditing, setEditingPathId } = pathEditing

  // BRAKE: Block ALL browser shortcuts to make app feel native
  // This runs in capture phase and prevents Ctrl+key combos from reaching the browser
  useEffect(() => {
    const BLOCKED_SHORTCUTS = new Set([
      'KeyS', // Ctrl+S = Save dialog
      'KeyR', // Ctrl+R = Refresh
      'KeyL', // Ctrl+L = Address bar
      'KeyH', // Ctrl+H = History
      'KeyJ', // Ctrl+J = Downloads
      'KeyU', // Ctrl+U = View source
      'KeyP', // Ctrl+P = Print
      'KeyN', // Ctrl+N = New window
      'KeyT', // Ctrl+T = New tab
      'KeyW', // Ctrl+W = Close tab
      'KeyF', // Ctrl+F = Find (we handle our own)
      'Comma', // Ctrl+, = Settings
      'Period', // Ctrl+. = ?
    ])

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Block Ctrl+key combos that we don't handle
      if (ctrl && !e.altKey) {
        const code = e.code
        // Allow Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+Y (redo)
        if (code === 'KeyZ' || code === 'KeyY') return
        // Allow Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, Ctrl+G
        if (code === 'KeyC' || code === 'KeyV' || code === 'KeyD' || code === 'KeyA' || code === 'KeyG') return
        // Allow Ctrl+/-, Ctrl+0, Ctrl+1, Ctrl+2
        if (code === 'Equal' || code === 'Minus' || code === 'Digit0' || code === 'Digit1' || code === 'Digit2') return
        // Allow Ctrl+], Ctrl+[, Ctrl+;
        if (code === 'BracketRight' || code === 'BracketLeft' || code === 'Semicolon') return
        // Allow Ctrl+' (apostrophe)
        if (code === 'Quote') return
        // Allow Ctrl+PageUp/PageDown
        if (code === 'PageUp' || code === 'PageDown') return

        // Block everything else
        if (BLOCKED_SHORTCUTS.has(code)) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }

      // Block Ctrl+Alt combos (browser features) — EXCEPT the PHASE 6 boolean
      // operation shortcuts (⌥⌘U/S/I/E) which we handle ourselves.
      if (ctrl && e.altKey) {
        e.preventDefault()
        if (!['KeyU', 'KeyS', 'KeyI', 'KeyE'].includes(e.code)) {
          e.stopPropagation()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // Other keyboard shortcuts (non-undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Allow typing in input fields and textareas (for non-undo/redo shortcuts)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Don't intercept shortcuts when editing contentEditable text
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (editingTextId) return

      // Undo/redo
      if (ctrl && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        if (useEditorStore.getState().activeTool === 'pen' && penPointsRef.current.length > 0) {
          const newLen = penPointsRef.current.length - 1
          if (newLen < 1 && penElementIdRef.current) {
            useEditorStore.getState().deleteElement(penElementIdRef.current)
            penElementIdRef.current = null
            setPenPoints([])
          } else {
            setPenPoints(prev => prev.slice(0, -1))
          }
          return
        }
        useEditorStore.getState().undo()
        return
      }
      if (ctrl && e.code === 'KeyZ' && e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }
      if (ctrl && e.code === 'KeyY') {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }

      // Prevent Alt key from activating browser menu bar
      if (e.key === 'Alt') {
        e.preventDefault()
        setAltHeld(true)
      }

      if (e.key === ' ') {
        e.preventDefault()
        setSpaceHeld(true)
      }

      const state = useEditorStore.getState()

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Path editing: delete selected point
        if (editingPathId && editingPointIndex !== null) {
          e.preventDefault()
          const el = findElementInList(state.elements, editingPathId)
          if (el) {
            const network = getVectorNetwork(el)
            if (network.vertices.length > 2) {
              const newVertices = network.vertices.filter((_, i) => i !== editingPointIndex)
              const newSegments = network.segments
                .filter(s => s.start !== editingPointIndex && s.end !== editingPointIndex)
                .map(s => ({
                  ...s,
                  start: s.start > editingPointIndex ? s.start - 1 : s.start,
                  end: s.end > editingPointIndex ? s.end - 1 : s.end,
                }))
              const newNetwork = { ...network, vertices: newVertices, segments: newSegments }
              state.updateElement(editingPathId, { vectorNetwork: newNetwork })
              state.pushHistory()
              setEditingPointIndex(null)
            }
          }
          return
        }
        e.preventDefault()
        state.deleteSelectedElements()
        state.pushHistory()
      }

      // Enter key to finish pen path (Figma behavior)
      if (e.key === 'Enter' && penPoints.length > 0) {
        e.preventDefault()
        finishPenPath()
        return
      }

      // PHASE 18 — Enter on a single selected parametric shape converts it
      // and enters vector edit mode (Figma parity: isVectorEditMode entry).
      if (e.key === 'Enter' && !editingPathId && activeTool === 'move') {
        const sel = useEditorStore.getState().selectedElementIds
        if (sel.length === 1) {
          const el = findElementInList(useEditorStore.getState().elements, sel[0])
          if (el && isShapeToVectorCandidate(el)) {
            const ok = useEditorStore.getState().convertShapeToVector(el.id)
            if (ok) {
              e.preventDefault()
              setEditingPathId(el.id)
              setEditingPointIndex(null)
              return
            }
          }
        }
      }

      if (e.key === 'Escape') {
        // Exit path editing mode first
        if (editingPathId) {
          exitPathEditing()
        } else if (isPencilDrawing || pencilPoints.length > 0) {
          setIsPencilDrawing(false)
          setPencilPoints([])
        } else if (penPoints.length > 0) {
          // Finish pen path
          finishPenPath()
        } else if (currentFrameId) {
          state.exitFrame()
        } else {
          setSelectedElementIds([])
          resetDrawingState()
          setEditingTextId(null)
          if (activeTool !== 'move') setActiveTool('move')
        }
      }

      if (ctrl && e.key === 'c') { e.preventDefault(); state.copySelected() }
      if (ctrl && e.key === 'v' && !e.shiftKey) { e.preventDefault(); state.pasteClipboard(); state.pushHistory() }
      // PHASE 21 (E14) — ⇧⌘V paste over selection (source: PASTE_OVER_SELECTION=53)
      if (ctrl && e.shiftKey && e.code === 'KeyV') {
        e.preventDefault()
        state.pasteOverSelection()
        state.pushHistory()
        return
      }
      if (ctrl && e.key === 'd') { e.preventDefault(); state.duplicateSelectedElements(); state.pushHistory() }
      if (ctrl && e.key === 'a') { e.preventDefault(); state.selectAll() }

      // PHASE 21 (E16) — ⌘F opens find & replace (source: FIND_AND_REPLACE=4;
      // our app binding — the source shortcut registry is minified/not recovered)
      if (ctrl && !e.shiftKey && e.code === 'KeyF') {
        e.preventDefault()
        state.setFindReplaceOpen(!state.findReplaceOpen)
        return
      }

      // PHASE 21 (VW17/VW18) — ⇧⌘O outlines, ⇧⌘P pixel preview
      // (source actions: toggle-outlines, toggle-pixel-preview; shortcut keys
      // are Figma-documented — the source registry is minified)
      if (ctrl && e.shiftKey && e.code === 'KeyO') {
        e.preventDefault()
        state.setOutlinesMode(!state.outlinesMode)
        return
      }
      if (ctrl && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault()
        state.setPixelPreview(!state.pixelPreview)
        return
      }

      if (ctrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        if (state.selectedElementIds.length >= 2) { state.groupElements(state.selectedElementIds); state.pushHistory() }
      }
      if (ctrl && e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        if (state.selectedElementIds.length === 1) { state.ungroupElements(state.selectedElementIds[0]); state.pushHistory() }
      }

      // PHASE 6: boolean ops ⌥⌘U/S/I/E + mask ⌃⌘M
      if (ctrl && e.altKey && ['KeyU', 'KeyS', 'KeyI', 'KeyE'].includes(e.code)) {
        e.preventDefault()
        const op = e.code === 'KeyU' ? 'union' : e.code === 'KeyS' ? 'subtract' : e.code === 'KeyI' ? 'intersect' : 'exclude' as const
        if (state.selectedElementIds.length >= 2) {
          state.pushHistory()
          const res = state.applyBooleanOperation(op)
          if (!res.ok) {
            toast({ title: 'Boolean operation failed', description: res.reason, variant: 'destructive' })
          }
        }
        return
      }
      if (e.ctrlKey && e.metaKey && e.code === 'KeyM') {
        e.preventDefault()
        if (state.selectedElementIds.length === 1) {
          const el = findElementInList(state.elements, state.selectedElementIds[0])
          if (el && isBooleanOperandType(el)) {
            state.pushHistory()
            state.setElementAsMask(el.id, !el.isMask)
          }
        }
        return
      }

      // Zoom shortcuts
      if (ctrl && e.key === '=') { e.preventDefault(); state.setZoom(state.zoom + 0.1) }
      if (ctrl && e.key === '-') { e.preventDefault(); state.setZoom(state.zoom - 0.1) }
      if (ctrl && e.key === '0') { e.preventDefault(); fitToScreen() }
      if (ctrl && e.key === '1' && !e.shiftKey) { e.preventDefault(); state.setZoom(1); state.setPan(0, 0) }
      if (ctrl && e.shiftKey && e.key === '1') { e.preventDefault(); fitToScreen() }
      if (ctrl && e.key === '2') { e.preventDefault(); zoomToSelection() }
      // +/- without modifier for zoom
      if (!ctrl && !e.shiftKey && !e.altKey && e.key === '=') { state.setZoom(state.zoom + 0.1) }
      if (!ctrl && !e.shiftKey && !e.altKey && e.key === '-') { state.setZoom(state.zoom - 0.1) }
      // PHASE 16 — Figma zoom shortcuts: Shift+1 zoom-to-fit, Shift+0 zoom 100%
      // (Shift+2 zoom-to-selection exists below)
      if (!ctrl && e.shiftKey && !e.altKey && (e.key === '1' || e.key === '!')) { e.preventDefault(); fitToScreen() }
      if (!ctrl && e.shiftKey && !e.altKey && (e.key === '0' || e.key === ')')) { e.preventDefault(); state.setZoom(1) }
      if (!ctrl && e.shiftKey && !e.altKey && (e.key === '2' || e.key === '@')) { e.preventDefault(); zoomToSelection() }

      // Page navigation (Ctrl+PageUp/PageDown like Figma)
      if (ctrl && e.key === 'PageUp') {
        e.preventDefault()
        const idx = state.pages.findIndex((p) => p.id === state.activePageId)
        if (idx > 0) state.setActivePage(state.pages[idx - 1].id)
      }
      if (ctrl && e.key === 'PageDown') {
        e.preventDefault()
        const idx = state.pages.findIndex((p) => p.id === state.activePageId)
        if (idx < state.pages.length - 1) state.setActivePage(state.pages[idx + 1].id)
      }

      // Z-order shortcuts (Ctrl+] and Ctrl+[ like Figma)
      if (ctrl && e.key === ']') { e.preventDefault(); state.selectedElementIds.forEach(id => state.bringForward(id)); state.pushHistory() }
      if (ctrl && e.key === '[') { e.preventDefault(); state.selectedElementIds.forEach(id => state.sendBackward(id)); state.pushHistory() }

      // Shift+2 for zoom to selection (Figma shortcut)
      if (e.shiftKey && e.key === '2') { e.preventDefault(); zoomToSelection() }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        // PHASE 23 (F11) — nudge amounts from the preferences store
        // (source: nudgeAmountPicker, figma_app; Figma defaults 1/10)
        const nudge = state.nudgeAmount
        const delta = e.shiftKey ? nudge.large : nudge.small
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el) {
            if (e.key === 'ArrowUp') state.updateElement(id, { y: el.y - delta })
            if (e.key === 'ArrowDown') state.updateElement(id, { y: el.y + delta })
            if (e.key === 'ArrowLeft') state.updateElement(id, { x: el.x - delta })
            if (e.key === 'ArrowRight') state.updateElement(id, { x: el.x + delta })
          }
        })
        state.pushHistory()
      }

      if (!ctrl && !e.shiftKey && !e.altKey) {
        // Finalize pen path before switching tools via keyboard
        const currentPenPoints = useEditorStore.getState().activeTool === 'pen' ? penPoints : []
        if (e.key !== 'p' && e.key !== 'P' && currentPenPoints.length >= 2) {
          finishPenPath()
        }
        if (e.key === 'v' || e.key === 'V') state.setActiveTool('move')
        if (e.key === 'f' || e.key === 'F') state.setActiveTool('frame')
        if (e.key === 'r' || e.key === 'R') state.setActiveTool('rectangle')
        if (e.key === 'o' || e.key === 'O') state.setActiveTool('ellipse')
        if (e.key === 'l' || e.key === 'L') state.setActiveTool('line')
        if (e.key === 'p' || e.key === 'P') state.setActiveTool('pen')
        if (e.key === 't' || e.key === 'T') state.setActiveTool('text')
        if (e.key === 'h' || e.key === 'H') state.setActiveTool('hand')
        if (e.key === 'i' || e.key === 'I') state.setActiveTool('eyedropper')
        if (e.key === 'c' || e.key === 'C') state.setActiveTool('comment')
        if (e.key === 's' || e.key === 'S') state.setActiveTool('slice')
        // PHASE 11: K = Scale tool (Figma parity)
        if (e.key === 'k' || e.key === 'K') state.setActiveTool('scale')
      }

      // Shift+tool shortcuts (Figma variants)
      if (!ctrl && e.shiftKey && !e.altKey) {
        // Finalize pen path before switching tools via keyboard
        if (penPoints.length >= 2) {
          finishPenPath()
        }
        if (e.key === 'p' || e.key === 'P') state.setActiveTool('pencil')
        if (e.key === 'r' || e.key === 'R') state.setActiveTool('polygon')
        if (e.key === 'o' || e.key === 'O') state.setActiveTool('star')
        if (e.key === 'l' || e.key === 'L') state.setActiveTool('arrow')
        if (e.key === 'i' || e.key === 'I') state.setActiveTool('image')
        // PHASE 15 — section / table / sticky (source: SECTION/TABLE/STICKY refs)
        if (e.key === 's' || e.key === 'S') state.setActiveTool('section')
        if (e.key === 't' || e.key === 'T') state.setActiveTool('table')
        if (e.key === 'n' || e.key === 'N') state.setActiveTool('sticky')
      }

      // Toggle shortcuts
      if (ctrl && e.key === ';') {
        e.preventDefault()
        state.setShowGrid(!state.showGrid)
      }
      // PHASE 8 (Figma parity): ⌘' = pixel grid, ⇧⌘' = snap-to-pixels,
      // ⌘\ = layout grids. Legacy snapToGrid (8px dot grid) moves to ⌘⇧;
      if (ctrl && !e.shiftKey && e.key === "'") {
        e.preventDefault()
        state.setShowPixelGrid(!state.showPixelGrid)
      }
      if (ctrl && e.shiftKey && (e.key === "'" || e.key === '"')) {
        e.preventDefault()
        state.setSnapToPixels(!state.snapToPixels)
      }
      if (ctrl && !e.shiftKey && e.key === '\\') {
        e.preventDefault()
        state.setShowLayoutGrids(!state.showLayoutGrids)
      }
      if (ctrl && e.shiftKey && (e.key === ';' || e.key === ':')) {
        e.preventDefault()
        state.setSnapToGrid(!state.snapToGrid)
      }

      // PHASE 23 (F13) — ⌘/ keyboard shortcuts modal (source:
      // keyboard_settings.keyboard_shortcuts_modal; binding chosen by us,
      // registry minified in source).
      if (ctrl && !e.shiftKey && e.key === '/') {
        e.preventDefault()
        state.setShortcutsOpen(!state.shortcutsOpen)
      }
      // PHASE 23 (F1) — ⇧⌘C copy as PNG (source: copy-as-png action, 5018;
      // binding is Figma-documented, registry minified in source).
      if (ctrl && e.shiftKey && (e.key === 'c' || e.key === 'C') && state.selectedElementIds.length === 1) {
        e.preventDefault()
        const el = findElementInList(state.elements, state.selectedElementIds[0])
        if (el) void import('@/lib/clipboard-io').then((m) => m.copyAsPngToClipboard(el, 2))
      }
      // PHASE 11: K = Scale tool (no modifier, tool keys block below handles it)

      // Ctrl+Alt shortcuts (Figma compatibility) - prevent browser defaults aggressively
      if (ctrl && e.altKey) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (ctrl && e.altKey && (e.key === 'k' || e.key === 'K')) {
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && !el.isComponent) { state.addComponent(id); state.pushHistory() }
        })
      }
      if (ctrl && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        e.stopPropagation()
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && el.isComponent) { state.createInstance(id); state.pushHistory() }
        })
      }
      // PHASE 23 (F10) — ⌥⌘G frame selection (source: frame-selection /
      // convert-selected-nodes-to-frame, figma_app). Previously implemented
      // inline here; now routes through the store action (which also resolves
      // absolute positions for nested children). Binding is Figma-documented
      // (registry minified in source).
      if (ctrl && e.altKey && !e.shiftKey && (e.key === 'g' || e.key === 'G') && state.selectedElementIds.length >= 1) {
        e.preventDefault()
        state.pushHistory()
        state.frameSelection()
      }
      // Ctrl+Alt shortcuts (Figma compatibility) - prevent browser defaults aggressively
      if (ctrl && e.altKey) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (ctrl && e.altKey && (e.key === 'k' || e.key === 'K')) {
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && !el.isComponent) { state.addComponent(id); state.pushHistory() }
        })
      }
      if (ctrl && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        e.stopPropagation()
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && el.isComponent) { state.createInstance(id); state.pushHistory() }
        })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false)
      if (e.key === 'Alt') setAltHeld(false)
    }

    const handleAuxClick = (e: MouseEvent) => {
      // Prevent middle-click from opening links or triggering browser features
      if (e.button === 1) e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('auxclick', handleAuxClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('auxclick', handleAuxClick)
    }
  }, [activeTool, currentFrameId, editingTextId, editingPathId, editingPointIndex, penPoints, isPencilDrawing, pencilPoints, finishPenPath, fitToScreen, zoomToSelection, setSelectedElementIds, setActiveTool, setEditingTextId, setSpaceHeld, setAltHeld, resetDrawingState, exitPathEditing, setEditingPointIndex, setIsPencilDrawing, setPencilPoints, setPenPoints, penPointsRef, penElementIdRef])
}
