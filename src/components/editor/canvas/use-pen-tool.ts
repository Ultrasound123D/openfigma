'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore, generateId } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { pathPointsToVectorNetwork, translateNetwork } from '@/lib/element-utils'

export interface PenPoint {
  x: number
  y: number
  cx1?: number
  cy1?: number
  cx2?: number
  cy2?: number
}

interface UsePenToolParams {
  findParentFrameAtPosition: (x: number, y: number, excludeIds?: string[]) => DesignElement | null
}

/**
 * usePenTool — pen (bezier) and pencil (freehand) drawing state machines.
 *
 * Owns:
 *   - pen anchor points + bezier drag state + live cursor preview
 *   - the in-progress pen element (created on first click, updated per point)
 *   - freehand pencil points (RAF-throttled capture)
 *   - finalize-on-tool-switch behavior
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor) — behavior identical.
 */
export function usePenTool({ findParentFrameAtPosition }: UsePenToolParams) {
  const activeTool = useEditorStore((s) => s.activeTool)
  const currentFrameId = useEditorStore((s) => s.currentFrameId)

  const [penPoints, setPenPoints] = useState<PenPoint[]>([])
  const penPointsRef = useRef(penPoints)
  useEffect(() => { penPointsRef.current = penPoints }, [penPoints])

  const penElementIdRef = useRef<string | null>(null)
  const [penDragStart, setPenDragStart] = useState<{ x: number; y: number; pointIndex: number } | null>(null)
  const [penCursorPos, setPenCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Pencil drawing state
  const [isPencilDrawing, setIsPencilDrawing] = useState(false)
  const [pencilPoints, setPencilPoints] = useState<{ x: number; y: number }[]>([])
  const pencilRafRef = useRef<number>(0)

  // Create or update the pen element in real-time (appears in layers immediately)
  const syncPenElement = useCallback((points: PenPoint[], closed: boolean) => {
    const state = useEditorStore.getState()
    if (points.length < 1) return
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity
    points.forEach(pt => {
      pMinX = Math.min(pMinX, pt.x, pt.cx1 ?? pt.x, pt.cx2 ?? pt.x)
      pMinY = Math.min(pMinY, pt.y, pt.cy1 ?? pt.y, pt.cy2 ?? pt.y)
      pMaxX = Math.max(pMaxX, pt.x, pt.cx1 ?? pt.x, pt.cx2 ?? pt.x)
      pMaxY = Math.max(pMaxY, pt.y, pt.cy1 ?? pt.y, pt.cy2 ?? pt.y)
    })
    const relPoints = points.map(pt => ({
      x: pt.x - pMinX, y: pt.y - pMinY,
      cx1: pt.cx1 !== undefined ? pt.cx1 - pMinX : undefined,
      cy1: pt.cy1 !== undefined ? pt.cy1 - pMinY : undefined,
      cx2: pt.cx2 !== undefined ? pt.cx2 - pMinX : undefined,
      cy2: pt.cy2 !== undefined ? pt.cy2 - pMinY : undefined,
    }))
    const vectorNetwork = translateNetwork(
      pathPointsToVectorNetwork(relPoints, closed),
      0, 0
    )
    const x = Math.round(pMinX), y = Math.round(pMinY)
    const w = Math.round(pMaxX - pMinX) || 1, h = Math.round(pMaxY - pMinY) || 1
    if (penElementIdRef.current) {
      state.updateElement(penElementIdRef.current, {
        x, y, width: w, height: h,
        pathPoints: relPoints, pathClosed: closed, vectorNetwork,
      })
    } else {
      const newEl: DesignElement = {
        id: generateId('path'), name: 'Path', type: 'path',
        x, y, width: w, height: h,
        fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false,
        blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        pathPoints: relPoints, pathClosed: closed, vectorNetwork,
      }
      state.addElement(newEl)
      penElementIdRef.current = newEl.id
    }
  }, [])

  // Finish pen path — the element is already in the store (created on first click)
  const finishPenPath = useCallback(() => {
    const state = useEditorStore.getState()
    if (penPoints.length < 2) {
      // Remove the element if only 1 point (not enough for a path)
      if (penElementIdRef.current) {
        state.deleteElement(penElementIdRef.current)
        penElementIdRef.current = null
      }
      setPenPoints([])
      setPenDragStart(null)
      setPenCursorPos(null)
      return
    }
    // Finalize: element already exists, just select it
    if (penElementIdRef.current) {
      const parentFrame = findParentFrameAtPosition(penPoints[0].x, penPoints[0].y, [penElementIdRef.current])
      if (parentFrame && parentFrame.id !== currentFrameId) {
        state.moveElementToFrame(penElementIdRef.current, parentFrame.id)
      }
      state.setSelectedElementIds([penElementIdRef.current])
      state.pushHistory()
    }
    penElementIdRef.current = null
    setPenPoints([])
    setPenDragStart(null)
    setPenCursorPos(null)
  }, [penPoints, currentFrameId, findParentFrameAtPosition])

  // Auto-sync pen element in store whenever penPoints changes (live update in layers)
  useEffect(() => {
    if (activeTool !== 'pen' || penPoints.length === 0 || !penElementIdRef.current) return
    syncPenElement(penPoints, false)
  }, [penPoints, activeTool, syncPenElement])

  // Finalize pen path when switching away from pen tool.
  // Implemented as a store subscription (external system) instead of a
  // setState-in-effect: React's hooks lint allows state updates inside
  // subscription callbacks, and this fires exactly on the tool transition.
  const finishPenPathRef = useRef(finishPenPath)
  useEffect(() => { finishPenPathRef.current = finishPenPath })

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (prev.activeTool === 'pen' && state.activeTool !== 'pen') {
        if (penPointsRef.current.length >= 2) {
          finishPenPathRef.current()
        } else {
          // Remove incomplete element from store
          if (penElementIdRef.current) {
            useEditorStore.getState().deleteElement(penElementIdRef.current)
            penElementIdRef.current = null
          }
          setPenPoints([])
          setPenDragStart(null)
          setPenCursorPos(null)
        }
      }
    })
    return unsubscribe
    // All inputs are stable refs/setters; the store is the source of truth.
  }, [])

  return {
    penPoints,
    setPenPoints,
    penPointsRef,
    penElementIdRef,
    penDragStart,
    setPenDragStart,
    penCursorPos,
    setPenCursorPos,
    syncPenElement,
    finishPenPath,
    isPencilDrawing,
    setIsPencilDrawing,
    pencilPoints,
    setPencilPoints,
    pencilRafRef,
  }
}

export type PenTool = ReturnType<typeof usePenTool>
