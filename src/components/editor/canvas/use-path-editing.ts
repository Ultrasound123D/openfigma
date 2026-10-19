'use client'

import { useCallback, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { findElementInList, getVectorNetwork, updateVertexInNetwork, setTangentInNetwork } from '@/lib/element-utils'

export type PathDragType = 'anchor' | 'tangentStart' | 'tangentEnd'

interface UsePathEditingParams {
  getAbsolutePosition: (elementId: string) => { x: number; y: number } | null
}

/**
 * usePathEditing — double-click path edit mode (anchor & tangent dragging).
 *
 * Owns the editing selection state (which path, which vertex/segment) and the
 * click handlers wired to the on-canvas control points rendered by Canvas.
 * The per-move drag math lives here as `updatePathDrag`, called from the
 * canvas-level mouse-move handler.
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor) — behavior identical.
 */
export function usePathEditing({ getAbsolutePosition }: UsePathEditingParams) {
  // Path editing state (double-click to enter edit mode on existing path)
  const [editingPathId, setEditingPathId] = useState<string | null>(null)
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null)
  const [editingDragType, setEditingDragType] = useState<PathDragType | null>(null)
  const [editingDragSegIdx, setEditingDragSegIdx] = useState<number | null>(null)
  const editingDragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null)

  // Path editing: click on anchor point to select it
  const handlePathAnchorClick = useCallback((e: React.MouseEvent, vertexIndex: number) => {
    e.stopPropagation()
    if (!editingPathId) return
    setEditingPointIndex(vertexIndex)
    setEditingDragType('anchor')
    const state = useEditorStore.getState()
    const el = findElementInList(state.elements, editingPathId)
    if (!el) return
    const network = getVectorNetwork(el)
    const v = network.vertices[vertexIndex]
    if (!v) return
    const absPos = getAbsolutePosition(editingPathId)
    const elX = absPos?.x ?? el.x
    const elY = absPos?.y ?? el.y
    editingDragStartRef.current = { x: e.clientX, y: e.clientY, origX: elX + v.x, origY: elY + v.y }
  }, [editingPathId, getAbsolutePosition])

  // Path editing: click on tangent handle to select it
  const handlePathTangentClick = useCallback((e: React.MouseEvent, segIdx: number, side: 'start' | 'end') => {
    e.stopPropagation()
    if (!editingPathId) return
    setEditingDragType(side === 'start' ? 'tangentStart' : 'tangentEnd')
    setEditingDragSegIdx(segIdx)
    const state = useEditorStore.getState()
    const el = findElementInList(state.elements, editingPathId)
    if (!el) return
    const network = getVectorNetwork(el)
    const seg = network.segments[segIdx]
    if (!seg) return
    const vertexIdx = side === 'start' ? seg.start : seg.end
    const v = network.vertices[vertexIdx]
    if (!v) return
    const tangent = side === 'start' ? seg.tangentStart : seg.tangentEnd
    const absPos = getAbsolutePosition(editingPathId)
    const elX = absPos?.x ?? el.x
    const elY = absPos?.y ?? el.y
    const tanX = elX + v.x + (tangent?.x ?? 0)
    const tanY = elY + v.y + (tangent?.y ?? 0)
    editingDragStartRef.current = { x: e.clientX, y: e.clientY, origX: tanX, origY: tanY }
  }, [editingPathId, getAbsolutePosition])

  // Exit path editing mode
  const exitPathEditing = useCallback(() => {
    if (editingPathId) {
      setEditingPathId(null)
      setEditingPointIndex(null)
      setEditingDragType(null)
      setEditingDragSegIdx(null)
      editingDragStartRef.current = null
    }
  }, [editingPathId])

  /**
   * Per-move drag update for the active anchor/tangent.
   * Returns true when the event was consumed (caller should stop).
   * Extracted from the middle of the old handleMouseMove.
   */
  const updatePathDrag = useCallback(
    (
      clientX: number,
      clientY: number,
      screenToCanvas: (x: number, y: number) => { x: number; y: number },
      altKey: boolean
    ): boolean => {
      if (!editingPathId || !editingDragType || !editingDragStartRef.current) return false
      const canvasPos = screenToCanvas(clientX, clientY)
      const state = useEditorStore.getState()
      const el = findElementInList(state.elements, editingPathId)
      if (!el) return true
      const network = getVectorNetwork(el)
      const absPos = getAbsolutePosition(editingPathId)
      const elX = absPos?.x ?? el.x
      const elY = absPos?.y ?? el.y
      const dx = canvasPos.x - screenToCanvas(editingDragStartRef.current.x, editingDragStartRef.current.y).x
      const dy = canvasPos.y - screenToCanvas(editingDragStartRef.current.x, editingDragStartRef.current.y).y

      if (editingDragType === 'anchor' && editingPointIndex !== null) {
        const v = network.vertices[editingPointIndex]
        if (v) {
          const newX = editingDragStartRef.current.origX + dx - elX
          const newY = editingDragStartRef.current.origY + dy - elY
          const newNetwork = updateVertexInNetwork(network, editingPointIndex, newX, newY)
          state.updateElement(editingPathId, { vectorNetwork: newNetwork })
        }
      } else if ((editingDragType === 'tangentStart' || editingDragType === 'tangentEnd') && editingDragSegIdx !== null) {
        const seg = network.segments[editingDragSegIdx]
        if (seg) {
          const vertexIdx = editingDragType === 'tangentStart' ? seg.start : seg.end
          const v = network.vertices[vertexIdx]
          if (v) {
            const newTanX = editingDragStartRef.current.origX + dx - elX - v.x
            const newTanY = editingDragStartRef.current.origY + dy - elY - v.y
            const newNetwork = setTangentInNetwork(network, editingPointIndex ?? vertexIdx, editingDragType === 'tangentStart' ? 'start' : 'end', { x: newTanX, y: newTanY }, altKey ? 'NONE' : 'ANGLE')
            state.updateElement(editingPathId, { vectorNetwork: newNetwork })
          }
        }
      }
      return true
    },
    [editingPathId, editingDragType, editingPointIndex, editingDragSegIdx, getAbsolutePosition]
  )

  /** Finish a path drag (mouse up) — returns true when consumed. */
  const finishPathDrag = useCallback((): boolean => {
    if (editingPathId && editingDragType) {
      useEditorStore.getState().pushHistory()
      setEditingDragType(null)
      setEditingDragSegIdx(null)
      editingDragStartRef.current = null
      return true
    }
    return false
  }, [editingPathId, editingDragType])

  return {
    editingPathId,
    setEditingPathId,
    editingPointIndex,
    setEditingPointIndex,
    editingDragType,
    editingDragSegIdx,
    handlePathAnchorClick,
    handlePathTangentClick,
    exitPathEditing,
    updatePathDrag,
    finishPathDrag,
  }
}

export type PathEditing = ReturnType<typeof usePathEditing>
