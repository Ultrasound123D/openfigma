'use client'

import { useCallback, useRef, useState } from 'react'
import { useEditorStore, generateId } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { calculateSnapLines, constrainToAngle, type SnapLine } from '@/lib/snap-utils'
import { findElementInList, simplifyPath, smoothPointsToPathPoints, pathPointsToVectorNetwork } from '@/lib/element-utils'
import { loadImageAsBase64, createImageElement, isImageFile } from '@/lib/image-utils'
// PHASE 11 — uniform scale engine
import { scaleElementBy } from '@/lib/scale-element'
import { handleCursors } from './canvas-helpers'
import type { CanvasViewport } from './use-canvas-viewport'
import type { CanvasHitTest } from './use-canvas-hittest'
import type { PenTool } from './use-pen-tool'
import type { PathEditing } from './use-path-editing'

interface UseElementInteractionsParams {
  viewport: CanvasViewport
  hitTest: CanvasHitTest
  pen: PenTool
  pathEditing: PathEditing
}

/**
 * useElementInteractions — the canvas pointer state machine.
 *
 * Owns drag / resize / rubber-band selection / shape drawing preview /
 * eyedropper / text-edit trigger / drop-into-frame, plus the RAF-throttled
 * batched element updates during drags.
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor); the only structural
 * change is that the path-editing drag math now delegates to
 * pathEditing.updatePathDrag / finishPathDrag.
 */
export function useElementInteractions({ viewport, hitTest, pen, pathEditing }: UseElementInteractionsParams) {
  const elements = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const activeTool = useEditorStore((s) => s.activeTool)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const gridSize = useEditorStore((s) => s.gridSize)
  const snapToGrid = useEditorStore((s) => s.snapToGrid)
  const snapToElements = useEditorStore((s) => s.snapToElements)
  const currentFrameId = useEditorStore((s) => s.currentFrameId)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)

  const { containerRef, containerSize, isPanning, setIsPanning, panStartRef, spaceHeld, screenToCanvas } = viewport
  const { findResizeHandle, findElementAtPosition, findParentFrameAtPosition } = hitTest
  const {
    penPoints, setPenPoints, penElementIdRef, penDragStart, setPenDragStart,
    setPenCursorPos, syncPenElement, finishPenPath,
    isPencilDrawing, setIsPencilDrawing, pencilPoints, setPencilPoints, pencilRafRef,
  } = pen
  const { editingPathId, updatePathDrag, finishPathDrag } = pathEditing

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragElementStartsRef = useRef<Record<string, { x: number; y: number }>>({})
  const [altHeld, setAltHeld] = useState(false)
  const [dragDuplicates, setDragDuplicates] = useState<DesignElement[] | null>(null)

  const [isResizing, setIsResizing] = useState(false)
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; elX: number; elY: number; elW: number; elH: number; fontSize?: number } | null>(null)
  const resizeElementIdRef = useRef<string | null>(null)

  // PHASE 11 — Scale tool state: anchor = opposite bbox corner; originals are
  // deep clones so each mousemove scales from the pristine snapshot (no drift)
  const [isScaling, setIsScaling] = useState(false)
  const scaleStartRef = useRef<{
    anchorX: number
    anchorY: number
    startDist: number
    originals: { el: DesignElement; parentX: number; parentY: number }[]
  } | null>(null)

  // PHASE 11 — alt+hover distance measurement between selection and hovered element
  const [hoverDistances, setHoverDistances] = useState<{
    selBox: { x: number; y: number; w: number; h: number }
    hovBox: { x: number; y: number; w: number; h: number }
    dx: number | null
    dy: number | null
    leftGap: number | null
    rightGap: number | null
    topGap: number | null
    bottomGap: number | null
  } | null>(null)

  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  const rubberBandStartRef = useRef<{ x: number; y: number } | null>(null)

  // Eyedropper state
  const [eyedropperColor, setEyedropperColor] = useState<string | null>(null)
  const [eyedropperPos, setEyedropperPos] = useState<{ x: number; y: number } | null>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const elementCounterRef = useRef(0)

  // Frame drop highlight
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null)

  // RAF throttle for smooth drag/resize
  const dragRafRef = useRef<number>(0)
  const pendingDragUpdate = useRef<{ id: string; updates: Partial<DesignElement> }[] | null>(null)

  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1

  // PHASE 11 — Scale tool helpers -----------------------------------------
  /** Absolute bbox of a set of elements (handles frame-relative children). */
  const selectionBBox = (ids: string[]) => {
    const state = useEditorStore.getState()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const items: { el: DesignElement; parentX: number; parentY: number }[] = []
    const walk = (els: DesignElement[], parentX: number, parentY: number) => {
      for (const el of els) {
        if (ids.includes(el.id)) {
          const ax = el.x + parentX
          const ay = el.y + parentY
          minX = Math.min(minX, ax)
          minY = Math.min(minY, ay)
          maxX = Math.max(maxX, ax + el.width)
          maxY = Math.max(maxY, ay + el.height)
          items.push({ el, parentX, parentY })
        }
        if (el.children) walk(el.children, parentX + el.x, parentY + el.y)
      }
    }
    walk(state.elements, 0, 0)
    if (minX === Infinity) return null
    return { minX, minY, maxX, maxY, items }
  }

  /** Try to grab a scale corner near (x,y); returns true when scaling started. */
  const tryStartScaleDrag = (ids: string[], x: number, y: number): boolean => {
    const bbox = selectionBBox(ids)
    if (!bbox || bbox.items.length === 0) return false
    const threshold = 10 / safeZoom
    const corners = [
      { cx: bbox.minX, cy: bbox.minY, ax: bbox.maxX, ay: bbox.maxY }, // nw → anchor se
      { cx: bbox.maxX, cy: bbox.minY, ax: bbox.minX, ay: bbox.maxY }, // ne → anchor sw
      { cx: bbox.minX, cy: bbox.maxY, ax: bbox.maxX, ay: bbox.minY }, // sw → anchor ne
      { cx: bbox.maxX, cy: bbox.maxY, ax: bbox.minX, ay: bbox.minY }, // se → anchor nw
    ]
    for (const c of corners) {
      if (Math.abs(x - c.cx) <= threshold && Math.abs(y - c.cy) <= threshold) {
        const startDist = Math.hypot(x - c.ax, y - c.ay)
        if (startDist < 1) return false
        scaleStartRef.current = {
          anchorX: c.ax,
          anchorY: c.ay,
          startDist,
          originals: bbox.items.map((it) => ({
            el: JSON.parse(JSON.stringify(it.el)) as DesignElement,
            parentX: it.parentX,
            parentY: it.parentY,
          } as { el: DesignElement; parentX: number; parentY: number })),
        }
        setIsScaling(true)
        return true
      }
    }
    return false
  }

  const handleElementMouseDown = useCallback(
    (element: DesignElement, e: React.MouseEvent) => {
      // For right-clicks, just select and let context menu handle
      if (e.button === 2) {
        const state = useEditorStore.getState()
        if (!state.selectedElementIds.includes(element.id)) {
          setSelectedElementIds([element.id])
        }
        return
      }

      // When pen, pencil, eyedropper, or drawing tools are active, don't intercept clicks
      // Let the canvas handleMouseDown process these tools
      const state = useEditorStore.getState()
      if (['pen', 'pencil', 'eyedropper', 'rectangle', 'ellipse', 'line', 'frame', 'polygon', 'star', 'arrow', 'text', 'image', 'comment', 'slice'].includes(state.activeTool)) {
        // Don't stop propagation - let canvas handler process the tool
        return
      }

      e.stopPropagation()
      if (element.locked) return
      const currentState = useEditorStore.getState()
      const canvasPos = screenToCanvas(e.clientX, e.clientY)

      // PHASE 11 — deep select (⌘click): replace the hit element with the
      // deepest element under the cursor (Figma cmd-click)
      if (e.metaKey || e.ctrlKey) {
        const deepEl = findElementAtPosition(canvasPos.x, canvasPos.y, true)
        if (deepEl && deepEl.id !== element.id) {
          setSelectedElementIds([deepEl.id])
          return
        }
      }

      // PHASE 11 — Scale tool: start scaling when grabbing a bbox corner
      if (currentState.activeTool === 'scale') {
        if (!currentState.selectedElementIds.includes(element.id)) {
          setSelectedElementIds([element.id])
        }
        const selIds = currentState.selectedElementIds.includes(element.id)
          ? currentState.selectedElementIds
          : [element.id]
        const started = tryStartScaleDrag(selIds, canvasPos.x, canvasPos.y)
        if (started) return
        // fall through to normal move-drag when not on a corner
      }

      const handleInfo = findResizeHandle(canvasPos.x, canvasPos.y)

      if (handleInfo && currentState.selectedElementIds.includes(element.id)) {
        setIsResizing(true)
        setActiveResizeHandle(handleInfo.handle)
        resizeElementIdRef.current = handleInfo.elementId
        const el = findElementInList(currentState.elements, handleInfo.elementId)
        if (el) {
          resizeStartRef.current = { x: canvasPos.x, y: canvasPos.y, elX: el.x, elY: el.y, elW: el.width, elH: el.height, fontSize: el.fontSize }
        }
        return
      }

      if (e.shiftKey) {
        currentState.toggleElementSelection(element.id)
      } else if (!currentState.selectedElementIds.includes(element.id)) {
        setSelectedElementIds([element.id])
      }

      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }

      const selectedIds = e.shiftKey ? [...currentState.selectedElementIds] : [element.id]
      const starts: Record<string, { x: number; y: number }> = {}
      selectedIds.forEach((id) => {
        const el = findElementInList(currentState.elements, id)
        if (el) starts[id] = { x: el.x, y: el.y }
      })
      if (!starts[element.id]) {
        const el = findElementInList(currentState.elements, element.id)
        if (el) starts[element.id] = { x: el.x, y: el.y }
      }
      dragElementStartsRef.current = starts
    },
    [screenToCanvas, findResizeHandle, setSelectedElementIds]
  )

  // Handle double click on elements (enter frame, edit text)
  const handleElementDoubleClick = useCallback(
    (element: DesignElement, e: React.MouseEvent) => {
      e.stopPropagation()
      const state = useEditorStore.getState()
      // Only handle double-click for move tool
      if (state.activeTool !== 'move') return
      if (element.type === 'frame' || element.type === 'group') {
        useEditorStore.getState().enterFrame(element.id)
      } else if (element.type === 'text') {
        setEditingTextId(element.id)
      }
    },
    []
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Right-click handling: select element under cursor, then let context menu handle
      if (e.button === 2) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        if (clickedEl && !selectedElementIds.includes(clickedEl.id)) {
          setSelectedElementIds([clickedEl.id])
        }
        // Don't prevent default or stop propagation - let context menu handle
        return
      }

      if (e.button === 1 || activeTool === 'hand' || spaceHeld) {
        setIsPanning(true)
        panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
        e.preventDefault()
        return
      }

      if (e.button !== 0) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY)

      // PHASE 11 — Scale tool: grab selection-bbox corners even on empty canvas
      if (activeTool === 'scale' && selectedElementIds.length > 0) {
        if (tryStartScaleDrag(selectedElementIds, canvasPos.x, canvasPos.y)) {
          e.preventDefault()
          return
        }
      }

      if (useEditorStore.getState().selectedElementIds.length === 1) {
        const handleInfo = findResizeHandle(canvasPos.x, canvasPos.y)
        if (handleInfo) {
          setIsResizing(true)
          setActiveResizeHandle(handleInfo.handle)
          resizeElementIdRef.current = handleInfo.elementId
          const el = findElementInList(useEditorStore.getState().elements, handleInfo.elementId)
          if (el) {
            resizeStartRef.current = { x: canvasPos.x, y: canvasPos.y, elX: el.x, elY: el.y, elW: el.width, elH: el.height, fontSize: el.fontSize }
          }
          return
        }
      }
      if (['rectangle', 'ellipse', 'line', 'frame', 'polygon', 'star', 'arrow'].includes(activeTool)) {
        setDrawStart(canvasPos)
        setDrawCurrent(canvasPos)
        setIsDrawing(true)
        return
      }

      if (activeTool === 'text') {
        const state = useEditorStore.getState()
        const id = generateId('text')
        const fontSize = 18
        const text = 'Text'
        // Auto-calculate width based on font size (approximate)
        const approxCharWidth = fontSize * 0.6
        const autoWidth = Math.max(100, text.length * approxCharWidth + 20)
        const autoHeight = Math.round(fontSize * 1.4 * 2)
        const newEl: DesignElement = {
          id, name: 'Text', type: 'text',
          x: Math.round(canvasPos.x - autoWidth / 2), y: Math.round(canvasPos.y - autoHeight / 2), width: autoWidth, height: autoHeight,
          fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
          cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
          opacity: 100, rotation: 0, visible: true, locked: false,
          blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
          textContent: text, fontFamily: 'Inter', fontSize, fontWeight: 400, textAlign: 'center', textColor: '#ffffff', lineHeight: 1.4, letterSpacing: 0,
        }
        state.addElement(newEl)
        // Auto-detect if inside a frame (addElement already handles currentFrameId)
        const parentFrame = findParentFrameAtPosition(canvasPos.x, canvasPos.y, [newEl.id])
        if (parentFrame && parentFrame.id !== currentFrameId) {
          state.moveElementToFrame(newEl.id, parentFrame.id)
        }
        state.setSelectedElementIds([id])
        state.setActiveTool('move')
        setEditingTextId(id)
        state.pushHistory()
        return
      }

      if (activeTool === 'pen') {
        // Check if clicking near first point to close path
        if (penPoints.length >= 3) {
          const firstPt = penPoints[0]
          const dist = Math.sqrt((canvasPos.x - firstPt.x) ** 2 + (canvasPos.y - firstPt.y) ** 2)
          if (dist < 8 / safeZoom) {
            // Close the path
            syncPenElement(penPoints, true)
            if (penElementIdRef.current) {
              const parentFrame = findParentFrameAtPosition(penPoints[0].x, penPoints[0].y, [penElementIdRef.current])
              if (parentFrame && parentFrame.id !== currentFrameId) {
                useEditorStore.getState().moveElementToFrame(penElementIdRef.current, parentFrame.id)
              }
              useEditorStore.getState().setSelectedElementIds([penElementIdRef.current])
              useEditorStore.getState().pushHistory()
            }
            penElementIdRef.current = null
            setPenPoints([])
            setPenDragStart(null)
            setPenCursorPos(null)
            return
          }
        }
        // Add a new point
        const newPoints = [...penPoints, { x: canvasPos.x, y: canvasPos.y }]
        setPenPoints(newPoints)
        setPenCursorPos(canvasPos)
        // Sync element in store (creates on first click, updates on subsequent)
        syncPenElement(newPoints, false)
        setPenDragStart({ x: canvasPos.x, y: canvasPos.y, pointIndex: newPoints.length - 1 })
        return
      }

      if (activeTool === 'pencil') {
        setIsPencilDrawing(true)
        setPencilPoints([canvasPos])
        return
      }

      if (activeTool === 'image') {
        // Image tool handled on mouseUp (file picker)
        return
      }

      if (activeTool === 'eyedropper') {
        // Sample color at click position
        setEyedropperPos(canvasPos)
        return
      }

      if (activeTool === 'move') {
        const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        if (clickedEl) {
          handleElementMouseDown(clickedEl, e)
          return
        }
        if (!e.shiftKey) {
          setSelectedElementIds([])
        }
        rubberBandStartRef.current = canvasPos
        setRubberBand({ startX: canvasPos.x, startY: canvasPos.y, endX: canvasPos.x, endY: canvasPos.y })
        return
      }

      setSelectedElementIds([])
    },
    [activeTool, spaceHeld, panX, panY, screenToCanvas, findResizeHandle, selectedElementIds, findElementAtPosition, handleElementMouseDown, setSelectedElementIds, penPoints, penDragStart, zoom, currentFrameId, findParentFrameAtPosition, syncPenElement, penElementIdRef, setPenPoints, setPenDragStart, setPenCursorPos, safeZoom, setIsPencilDrawing, setPencilPoints]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        const state = useEditorStore.getState()
        state.setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
        return
      }

      if (isScaling && scaleStartRef.current) {
        // PHASE 11 — uniform scale from the pristine snapshot
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const { anchorX, anchorY, startDist, originals } = scaleStartRef.current
        let factor = Math.hypot(canvasPos.x - anchorX, canvasPos.y - anchorY) / startDist
        if (e.shiftKey) factor = Math.round(factor * 10) / 10 // 0.1 steps with Shift
        factor = Math.max(0.02, Math.min(factor, 100))
        const s = useEditorStore.getState()
        for (const { el, parentX, parentY } of originals) {
          const scaled = scaleElementBy(el, factor, anchorX - parentX, anchorY - parentY)
          s.updateElement(el.id, scaled)
        }
        return
      }

      if (isResizing && resizeStartRef.current && resizeElementIdRef.current && activeResizeHandle) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const start = resizeStartRef.current
        const handle = activeResizeHandle
        const dx = canvasPos.x - start.x
        const dy = canvasPos.y - start.y
        const shiftHeld = e.shiftKey
        const altKey = e.altKey

        if (handle === 'rotate') {
          const el = findElementInList(useEditorStore.getState().elements, resizeElementIdRef.current)
          if (el) {
            const centerX = el.x + el.width / 2
            const centerY = el.y + el.height / 2
            let angle = Math.atan2(canvasPos.y - centerY, canvasPos.x - centerX) * (180 / Math.PI) + 90
            if (shiftHeld) {
              angle = Math.round(angle / 15) * 15
            }
            useEditorStore.getState().updateElement(resizeElementIdRef.current, { rotation: Math.round(angle) % 360 })
          }
          return
        }
        let newX = start.elX
        let newY = start.elY
        let newW = start.elW
        let newH = start.elH

        if (altKey) {
          if (handle.includes('w') || handle === 'nw' || handle === 'sw') {
            newX = start.elX + dx / 2
            newW = start.elW - dx
          }
          if (handle.includes('e') || handle === 'ne' || handle === 'se') {
            newW = start.elW + dx
            newX = start.elX - dx / 2
          }
          if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
            newY = start.elY + dy / 2
            newH = start.elH - dy
          }
          if (handle.includes('s') || handle === 'sw' || handle === 'se') {
            newH = start.elH + dy
            newY = start.elY - dy / 2
          }
        } else {
          if (handle.includes('w') || handle === 'nw' || handle === 'sw') {
            newX = start.elX + dx
            newW = start.elW - dx
          }
          if (handle.includes('e') || handle === 'ne' || handle === 'se') {
            newW = start.elW + dx
          }
          if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
            newY = start.elY + dy
            newH = start.elH - dy
          }
          if (handle.includes('s') || handle === 'sw' || handle === 'se') {
            newH = start.elH + dy
          }
        }

        if (shiftHeld && (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw')) {
          const aspect = start.elW / start.elH
          if (Math.abs(dx) > Math.abs(dy)) {
            newH = newW / aspect
            if (handle.includes('n')) newY = start.elY + start.elH - newH
          } else {
            newW = newH * aspect
            if (handle.includes('w')) newX = start.elX + start.elW - newW
          }
        }

        if (newW < 2) { newW = 2; if (handle.includes('w')) newX = start.elX + start.elW - 2 }
        if (newH < 2) { newH = 2; if (handle.includes('n')) newY = start.elY + start.elH - 2 }

        // Text elements: scale fontSize proportionally with resize (Figma behavior)
        const resizeId = resizeElementIdRef.current
        const resizeEl = findElementInList(useEditorStore.getState().elements, resizeId)
        const resizeUpdates: Record<string, number> = { x: newX, y: newY, width: newW, height: newH }
        // PHASE 8: honor snap-to-pixels view option during resize
        if (useEditorStore.getState().snapToPixels !== false) {
          resizeUpdates.x = Math.round(newX)
          resizeUpdates.y = Math.round(newY)
          resizeUpdates.width = Math.round(newW)
          resizeUpdates.height = Math.round(newH)
        }
        if (resizeEl?.type === 'text' && start.fontSize) {
          const scaleX = newW / start.elW
          const scaleY = newH / start.elH
          const scale = Math.min(scaleX, scaleY)
          const newFontSize = Math.max(1, Math.round(start.fontSize * scale))
          resizeUpdates.fontSize = newFontSize
        }

        // Throttle resize updates using RAF for smoothness
        cancelAnimationFrame(dragRafRef.current)
        pendingDragUpdate.current = [{ id: resizeId, updates: resizeUpdates }]
        dragRafRef.current = requestAnimationFrame(() => {
          if (pendingDragUpdate.current) {
            const s = useEditorStore.getState()
            for (const { id, updates: u } of pendingDragUpdate.current) {
              // PHASE 9: resizing a frame repositions/resizes children by constraints
              const el = findElementInList(s.elements, id)
              if (el && el.type === 'frame' && el.children && el.children.length > 0 &&
                  !el.autoLayout && ('width' in u || 'height' in u)) {
                const geo = u as { x?: number; y?: number; width: number; height: number }
                s.resizeFrameWithConstraints(id, {
                  ...(geo.x !== undefined ? { x: geo.x } : {}),
                  ...(geo.y !== undefined ? { y: geo.y } : {}),
                  width: geo.width ?? el.width,
                  height: geo.height ?? el.height,
                })
              } else {
                s.updateElement(id, u)
              }
            }
            pendingDragUpdate.current = null
          }
        })
        return
      }

      if (isDragging && dragStartRef.current) {
        const state = useEditorStore.getState()
        const dx = (e.clientX - dragStartRef.current.x) / zoom
        const dy = (e.clientY - dragStartRef.current.y) / zoom

        // Alt+drag to duplicate
        if (e.altKey && !dragDuplicates) {
          const dups: DesignElement[] = []
          Object.entries(dragElementStartsRef.current).forEach(([id, startPos]) => {
            void startPos
            const el = findElementInList(state.elements, id)
            if (el) {
              const dup = { ...JSON.parse(JSON.stringify(el)), id: generateId(el.type), name: `${el.name} copy` }
              if (dup.children) dup.children = dup.children.map((c: DesignElement) => ({ ...c, id: generateId(c.type) }))
              dups.push(dup)
            }
          })
          setDragDuplicates(dups)
        }

        // Calculate snap for the primary element
        const primaryId = Object.keys(dragElementStartsRef.current)[0]
        const primaryStart = dragElementStartsRef.current[primaryId]
        if (primaryStart) {
          const primaryEl = findElementInList(state.elements, primaryId)
          if (primaryEl) {
            const tempEl = { ...primaryEl, x: primaryStart.x + dx, y: primaryStart.y + dy }
            const snap = calculateSnapLines(tempEl, state.elements, state.selectedElementIds, gridSize, snapToGrid, snapToElements)
            setSnapLines(snap.snapLines)

            const actualDx = snap.snapX !== null ? snap.snapX - primaryStart.x : dx
            const actualDy = snap.snapY !== null ? snap.snapY - primaryStart.y : dy

            // Batch drag updates using RAF for smoother editing
            // PHASE 8: snap-to-pixels is now a view option — when disabled,
            // positions may be fractional (Figma parity)
            const pixelSnap = state.snapToPixels !== false
            const updates: { id: string; updates: Partial<DesignElement> }[] = []
            Object.entries(dragElementStartsRef.current).forEach(([id, startPos]) => {
              const nx = startPos.x + actualDx
              const ny = startPos.y + actualDy
              updates.push({ id, updates: { x: pixelSnap ? Math.round(nx) : nx, y: pixelSnap ? Math.round(ny) : ny } })
            })
            cancelAnimationFrame(dragRafRef.current)
            pendingDragUpdate.current = updates
            dragRafRef.current = requestAnimationFrame(() => {
              if (pendingDragUpdate.current) {
                const s = useEditorStore.getState()
                for (const { id, updates: u } of pendingDragUpdate.current) {
                  s.updateElement(id, u)
                }
                pendingDragUpdate.current = null
              }
            })
          }
        }

        // Check if we're dragging over a frame for drop target
        if (selectedElementIds.length > 0) {
          const canvasPos = screenToCanvas(e.clientX, e.clientY)
          let foundFrame: DesignElement | null = null
          for (let i = state.elements.length - 1; i >= 0; i--) {
            const el = state.elements[i]
            if ((el.type === 'frame' || el.type === 'group') && !selectedElementIds.includes(el.id)) {
              if (canvasPos.x >= el.x && canvasPos.x <= el.x + el.width &&
                  canvasPos.y >= el.y && canvasPos.y <= el.y + el.height) {
                foundFrame = el
                break
              }
            }
          }
          setDropTargetFrameId(foundFrame ? foundFrame.id : null)
        }

        return
      }

      if (isDrawing && drawStart) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        if (activeTool === 'line' && e.shiftKey) {
          const constrained = constrainToAngle(drawStart.x, drawStart.y, canvasPos.x, canvasPos.y)
          setDrawCurrent(constrained)
        } else {
          setDrawCurrent(canvasPos)
        }
      }

      // Pencil drawing
      if (isPencilDrawing) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        cancelAnimationFrame(pencilRafRef.current)
        pencilRafRef.current = requestAnimationFrame(() => {
          setPencilPoints(prev => [...prev, canvasPos])
        })
      }

      // Pen tool: update bezier handles during drag, or track cursor position for preview line
      if (activeTool === 'pen' && penPoints.length > 0) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        if (penDragStart) {
          // Dragging to create bezier handles
          const dx = canvasPos.x - penDragStart.x
          const dy = canvasPos.y - penDragStart.y
          setPenPoints(prev => {
            const updated = [...prev]
            const idx = penDragStart.pointIndex
            if (idx < updated.length) {
              // Symmetric bezier handles: handle1 is mirror of handle2 relative to point
              updated[idx] = {
                ...updated[idx],
                cx1: updated[idx].x - dx,
                cy1: updated[idx].y - dy,
                cx2: updated[idx].x + dx,
                cy2: updated[idx].y + dy,
              }
            }
            return updated
          })
        } else {
          setPenCursorPos(canvasPos)
        }
      }

      // Eyedropper tracking
      if (activeTool === 'eyedropper') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        setEyedropperPos(canvasPos)
      }

      // Path editing: drag anchor or tangent handle
      if (updatePathDrag(e.clientX, e.clientY, screenToCanvas, e.altKey)) {
        return
      }

      // Hover tracking - show highlight on element under cursor when using move tool
      if (activeTool === 'move' && !isDragging && !isResizing && !isScaling) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const hoveredEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        setHoveredElementId(hoveredEl ? hoveredEl.id : null)

        // PHASE 11 — alt+hover distance measurement (single selection + another element)
        if (e.altKey && selectedElementIds.length === 1 && hoveredEl && hoveredEl.id !== selectedElementIds[0]) {
          const state = useEditorStore.getState()
          const sel = state.elements.find((x) => x.id === selectedElementIds[0]) ||
            state.elements.flatMap((x) => x.children || []).find((c) => c.id === selectedElementIds[0])
          if (sel && hoveredEl) {
            // absolute boxes (both may be children → one level of parent offset is enough for our tree)
            const absOf = (el: DesignElement): { x: number; y: number; w: number; h: number } => {
              let px = 0, py = 0
              for (const top of state.elements) {
                if (top.children) {
                  const c = top.children.find((cc) => cc.id === el.id)
                  if (c) { px = top.x; py = top.y; break }
                  // depth 2
                  for (const c1 of top.children) {
                    if (c1.children) {
                      const c2 = c1.children.find((cc) => cc.id === el.id)
                      if (c2) { px = top.x + c1.x; py = top.y + c1.y; break }
                    }
                  }
                }
              }
              return { x: el.x + px, y: el.y + py, w: el.width, h: el.height }
            }
            const selBox = absOf(sel)
            const hovBox = absOf(hoveredEl)
            const overlapY = selBox.y < hovBox.y + hovBox.h && hovBox.y < selBox.y + selBox.h
            const overlapX = selBox.x < hovBox.x + hovBox.w && hovBox.x < selBox.x + selBox.w
            setHoverDistances({
              selBox, hovBox,
              dx: overlapY ? null : Math.round(Math.max(hovBox.x - (selBox.x + selBox.w), selBox.x - (hovBox.x + hovBox.w))),
              dy: overlapX ? null : Math.round(Math.max(hovBox.y - (selBox.y + selBox.h), selBox.y - (hovBox.y + hovBox.h))),
              leftGap: overlapY ? Math.round(selBox.x - (hovBox.x + hovBox.w)) : null,
              rightGap: overlapY ? Math.round(hovBox.x - (selBox.x + selBox.w)) : null,
              topGap: overlapX ? Math.round(selBox.y - (hovBox.y + hovBox.h)) : null,
              bottomGap: overlapX ? Math.round(hovBox.y - (selBox.y + selBox.h)) : null,
            })
          }
        } else {
          setHoverDistances(null)
        }
      } else {
        setHoveredElementId(null)
        setHoverDistances(null)
      }

      if (rubberBandStartRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        setRubberBand({
          startX: rubberBandStartRef.current.x,
          startY: rubberBandStartRef.current.y,
          endX: canvasPos.x,
          endY: canvasPos.y,
        })
      }
    },
    [isPanning, isResizing, isDragging, isDrawing, drawStart, activeTool, screenToCanvas, zoom, snapToGrid, snapToElements, gridSize, dragDuplicates, isPencilDrawing, selectedElementIds, penDragStart, penPoints, updatePathDrag, findElementAtPosition, setActiveResizeHandle, setPenPoints, setPenCursorPos, setPencilPoints, pencilRafRef]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Flush any pending RAF drag/resize updates before handling mouse up
      cancelAnimationFrame(dragRafRef.current)
      if (pendingDragUpdate.current) {
        const s = useEditorStore.getState()
        for (const { id, updates } of pendingDragUpdate.current) {
          s.updateElement(id, updates)
        }
        pendingDragUpdate.current = null
      }

      // Finish pen drag operation if active
      if (activeTool === 'pen' && penDragStart) {
        // If drag distance was very small, remove the bezier handles (treat as a simple click)
        setPenPoints(prev => {
          const updated = [...prev]
          const idx = penDragStart.pointIndex
          if (idx < updated.length) {
            const pt = updated[idx]
            // Check if handles are essentially at the same position as the point (no meaningful drag)
            const handleDist1 = pt.cx1 !== undefined && pt.cy1 !== undefined ? Math.sqrt((pt.cx1 - pt.x) ** 2 + (pt.cy1 - pt.y) ** 2) : 0
            const handleDist2 = pt.cx2 !== undefined && pt.cy2 !== undefined ? Math.sqrt((pt.cx2 - pt.x) ** 2 + (pt.cy2 - pt.y) ** 2) : 0
            if (handleDist1 < 2 / safeZoom && handleDist2 < 2 / safeZoom) {
              // Remove handles - this was a simple click, not a drag
              const { cx1, cy1, cx2, cy2, ...rest } = pt
              updated[idx] = rest as typeof pt
            }
          }
          return updated
        })
        setPenDragStart(null)
        return
      }

      // Path editing: finish drag
      if (finishPathDrag()) {
        return
      }

      if (isPanning) {
        setIsPanning(false)
        return
      }

      if (isResizing) {
        useEditorStore.getState().pushHistory()
        setIsResizing(false)
        setActiveResizeHandle(null)
        resizeElementIdRef.current = null
        resizeStartRef.current = null
        return
      }

      // PHASE 11 — finish scale drag
      if (isScaling) {
        useEditorStore.getState().pushHistory()
        setIsScaling(false)
        scaleStartRef.current = null
        return
      }

      if (isDragging) {
        // Check if dropping into a frame
        if (dropTargetFrameId) {
          const state = useEditorStore.getState()
          const frame = findElementInList(state.elements, dropTargetFrameId)
          if (frame && (frame.type === 'frame' || frame.type === 'group')) {
            for (const id of state.selectedElementIds) {
              state.moveElementToFrame(id, dropTargetFrameId)
            }
          }
        }
        useEditorStore.getState().pushHistory()
        setIsDragging(false)
        dragStartRef.current = null
        dragElementStartsRef.current = {}
        setDragDuplicates(null)
        setSnapLines([])
        setDropTargetFrameId(null)
        return
      }

      // Pencil drawing complete
      if (isPencilDrawing && pencilPoints.length >= 2) {
        const simplified = simplifyPath(pencilPoints, 2)

        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        simplified.forEach(pt => {
          minX = Math.min(minX, pt.x)
          minY = Math.min(minY, pt.y)
          maxX = Math.max(maxX, pt.x)
          maxY = Math.max(maxY, pt.y)
        })

        if (maxX - minX > 2 || maxY - minY > 2) {
          // Convert to local coordinates then smooth via Catmull-Rom
          const localPoints = simplified.map(pt => ({
            x: pt.x - minX,
            y: pt.y - minY,
          }))
          const smoothPathPoints = smoothPointsToPathPoints(localPoints, 0.5)
          const pathPoints = smoothPathPoints

          // Build VectorNetwork from smoothed points (with bezier handles)
          const pencilVectorNetwork = pathPointsToVectorNetwork(pathPoints, false)

          const newEl: DesignElement = {
            id: generateId('path'), name: 'Pencil Path', type: 'path',
            x: Math.round(minX), y: Math.round(minY),
            width: Math.round(maxX - minX), height: Math.round(maxY - minY),
            fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
            cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
            opacity: 100, rotation: 0, visible: true, locked: false,
            blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
            pathPoints, pathClosed: false,
            vectorNetwork: pencilVectorNetwork,
          }
          const state = useEditorStore.getState()
          state.addElement(newEl)
          // Auto-detect if inside a frame
          const parentFrame = findParentFrameAtPosition(minX, minY, [newEl.id])
          if (parentFrame && parentFrame.id !== currentFrameId) {
            state.moveElementToFrame(newEl.id, parentFrame.id)
          }
          state.setSelectedElementIds([newEl.id])
          state.pushHistory()
        }
        setIsPencilDrawing(false)
        setPencilPoints([])
        return
      }
      setIsPencilDrawing(false)
      setPencilPoints([])

      // Eyedropper color sampling
      if (activeTool === 'eyedropper' && eyedropperPos) {
        const svgEl = containerRef.current?.querySelector('svg')
        if (svgEl) {
          try {
            const svgString = new XMLSerializer().serializeToString(svgEl)
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = svgEl.clientWidth
              canvas.height = svgEl.clientHeight
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (ctx) {
                ctx.drawImage(img, 0, 0)
                const rect = containerRef.current?.getBoundingClientRect()
                if (rect) {
                  const px = e.clientX - rect.left
                  const py = e.clientY - rect.top
                  const pixel = ctx.getImageData(Math.round(px), Math.round(py), 1, 1)
                  if (pixel && pixel.data[3] > 0) {
                    const [r, g, b] = pixel.data
                    const hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
                    // Apply to selected element's fill
                    const state = useEditorStore.getState()
                    if (state.selectedElementIds.length > 0) {
                      const id = state.selectedElementIds[0]
                      state.updateElement(id, { fill: hex })
                      state.pushHistory()
                    }
                  }
                }
              }
              URL.revokeObjectURL(url)
            }
            img.src = url
          } catch (err) {
            console.error('Eyedropper error:', err)
          }
        }
        setEyedropperPos(null)
        return
      }

      if (isDrawing && drawStart && drawCurrent) {
        const x = Math.min(drawStart.x, drawCurrent.x)
        const y = Math.min(drawStart.y, drawCurrent.y)
        const width = Math.abs(drawCurrent.x - drawStart.x)
        const height = Math.abs(drawCurrent.y - drawStart.y)
        const state = useEditorStore.getState()

        if (width > 2 || height > 2 || activeTool === 'line' || activeTool === 'arrow') {
          if (activeTool === 'line') {
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: generateId('line'), name: `Line ${elementCounterRef.current}`, type: 'line',
              x: Math.round(drawStart.x), y: Math.round(drawStart.y),
              width: Math.round(drawCurrent.x - drawStart.x), height: Math.round(drawCurrent.y - drawStart.y),
              fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
            }
            state.addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
            if (parentFrame && parentFrame.id !== currentFrameId) {
              state.moveElementToFrame(newEl.id, parentFrame.id)
            }
            state.setSelectedElementIds([newEl.id])
          } else if (activeTool === 'arrow') {
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: generateId('arrow'), name: `Arrow ${elementCounterRef.current}`, type: 'arrow',
              x: Math.round(drawStart.x), y: Math.round(drawStart.y),
              width: Math.round(drawCurrent.x - drawStart.x), height: Math.round(drawCurrent.y - drawStart.y),
              fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
              arrowHeadStyle: 'arrow',
            }
            state.addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
            if (parentFrame && parentFrame.id !== currentFrameId) {
              state.moveElementToFrame(newEl.id, parentFrame.id)
            }
            state.setSelectedElementIds([newEl.id])
          } else {
            const defaults: Record<string, { fill: string; stroke: string; strokeWidth: number; sides?: number; innerRadius?: number }> = {
              rectangle: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 },
              ellipse: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 },
              frame: { fill: '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1 },
              polygon: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, sides: 6 },
              star: { fill: '#FFD93D', stroke: 'transparent', strokeWidth: 0, sides: 5, innerRadius: 40 },
            }
            const td = defaults[activeTool] || { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 }
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: `${activeTool}-${Date.now()}`,
              name: `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} ${elementCounterRef.current}`,
              type: activeTool as DesignElement['type'],
              x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height),
              fill: td.fill, stroke: td.stroke, strokeWidth: td.strokeWidth, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: activeTool === 'frame' ? 8 : 0,
              cornerRadiusTL: activeTool === 'frame' ? 8 : 0,
              cornerRadiusTR: activeTool === 'frame' ? 8 : 0,
              cornerRadiusBL: activeTool === 'frame' ? 8 : 0,
              cornerRadiusBR: activeTool === 'frame' ? 8 : 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: activeTool === 'frame',
              ...(td.sides !== undefined ? { sides: td.sides } : {}),
              ...(td.innerRadius !== undefined ? { innerRadius: td.innerRadius } : {}),
            }
            state.addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            // Don't auto-nest frames inside frames, but allow inside current frame
            if (activeTool !== 'frame') {
              const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
              if (parentFrame && parentFrame.id !== currentFrameId) {
                state.moveElementToFrame(newEl.id, parentFrame.id)
              }
            }
            state.setSelectedElementIds([newEl.id])
          }
          state.pushHistory()
        }

        setIsDrawing(false)
        setDrawStart(null)
        setDrawCurrent(null)
      }

      // Image tool: open file picker on click
      if (activeTool === 'image' && !isDragging && !isResizing && !rubberBand) {
        const clientX = e.clientX
        const clientY = e.clientY
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0]
          if (!file || !isImageFile(file)) return
          try {
            const base64 = await loadImageAsBase64(file)
            const pos = screenToCanvas(clientX, clientY)
            const imgEl = await createImageElement(base64, pos.x, pos.y)
            const state = useEditorStore.getState()
            state.addElement(imgEl)
            state.setSelectedElementIds([imgEl.id])
            state.pushHistory()
          } catch (err) {
            console.error('Failed to load image:', err)
          }
        }
        input.click()
      }

      if (rubberBand) {
        const state = useEditorStore.getState()
        const rbMinX = Math.min(rubberBand.startX, rubberBand.endX)
        const rbMinY = Math.min(rubberBand.startY, rubberBand.endY)
        const rbMaxX = Math.max(rubberBand.startX, rubberBand.endX)
        const rbMaxY = Math.max(rubberBand.startY, rubberBand.endY)

        if (Math.abs(rbMaxX - rbMinX) > 5 || Math.abs(rbMaxY - rbMinY) > 5) {
          const selectedIds: string[] = []
          const addSelected = (el: DesignElement, parentX = 0, parentY = 0) => {
            if (!el.visible || el.locked) return
            const absX = el.x + parentX
            const absY = el.y + parentY
            if (absX + el.width > rbMinX && absX < rbMaxX &&
                absY + el.height > rbMinY && absY < rbMaxY) {
              selectedIds.push(el.id)
            }
            if (el.children) el.children.forEach(c => addSelected(c, absX, absY))
          }
          state.elements.forEach(el => addSelected(el))
          if (e.shiftKey) {
            state.setSelectedElementIds([...new Set([...state.selectedElementIds, ...selectedIds])])
          } else {
            state.setSelectedElementIds(selectedIds)
          }
        }
        setRubberBand(null)
        rubberBandStartRef.current = null
      }
    },
    [isPanning, isResizing, isDragging, isDrawing, drawStart, drawCurrent, rubberBand, activeTool, isPencilDrawing, pencilPoints, eyedropperPos, dropTargetFrameId, selectedElementIds, safeZoom, penDragStart, setPenPoints, setPenDragStart, finishPathDrag, screenToCanvas, findParentFrameAtPosition, currentFrameId, containerRef]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)

      // Enter frame/group on double-click
      if (!clickedEl || clickedEl.type === 'frame' || clickedEl.type === 'group') {
        if (clickedEl && (clickedEl.type === 'frame' || clickedEl.type === 'group')) {
          useEditorStore.getState().enterFrame(clickedEl.id)
        }
        return
      }

      // Path editing mode
      if (clickedEl.type === 'path') {
        pathEditing.setEditingPathId(clickedEl.id)
        pathEditing.setEditingPointIndex(null)
        return
      }

      // Inline text editing
      if (clickedEl.type === 'text') {
        setEditingTextId(clickedEl.id)
      }
    },
    [screenToCanvas, findElementAtPosition, pathEditing]
  )

  // Handle file drop (PHASE 4: unified router — SVG → editable elements,
  // images → image-fill rectangles, JSON → project merge; images keep the
  // exact drop position, via lib/import/handlers).
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      const { importFiles } = await import('@/lib/import/handlers')
      await importFiles(files, canvasPos)
    },
    [screenToCanvas]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const getCursor = (): string => {
    if (isPanning || spaceHeld) return 'grabbing'
    if (isResizing && activeResizeHandle) return handleCursors[activeResizeHandle as keyof typeof handleCursors]
    if (isScaling) return 'nwse-resize'
    if (isDragging) return 'move'
    switch (activeTool) {
      case 'hand': return 'grab'
      case 'move': return 'default'
      case 'rectangle': case 'ellipse': case 'line': case 'frame': case 'polygon': case 'star': case 'pen': case 'pencil': case 'comment': case 'slice': case 'arrow': case 'image': return 'crosshair'
      case 'text': return 'text'
      case 'eyedropper': return 'crosshair'
      // PHASE 11 — scale tool: corner-resize feel over the selection
      case 'scale': return selectedElementIds.length > 0 ? 'nwse-resize' : 'default'
      default: return 'default'
    }
  }

  return {
    // interaction state (for render + keyboard)
    isDrawing,
    drawStart,
    drawCurrent,
    isDragging,
    isResizing,
    activeResizeHandle,
    // PHASE 11 — scale tool + distance measurement
    isScaling,
    hoverDistances,
    rubberBand,
    snapLines,
    hoveredElementId,
    dropTargetFrameId,
    eyedropperPos,
    eyedropperColor,
    setEyedropperColor,
    editingTextId,
    setEditingTextId,
    altHeld,
    setAltHeld,
    hiddenCanvasRef,
    // handlers
    handleElementMouseDown,
    handleElementDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleDrop,
    handleDragOver,
    getCursor,
    // escape/reset helpers for keyboard hook
    resetDrawingState: () => {
      setIsDrawing(false)
      setDrawStart(null)
      setDrawCurrent(null)
    },
  }
}

/** Tiny stable indirection so the handleMouseDown dep array stays honest. */
function setSelectedElementIdsProxy() {
  return useEditorStore.getState().setSelectedElementIds
}
