'use client'

import { useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'
import { getHandlePositions, HANDLE_SIZE, type HandlePosition } from './canvas-helpers'

/**
 * useCanvasHitTest — pure geometry lookups against the current scene.
 *
 * All functions read the store imperatively (useEditorStore.getState()) so
 * they never go stale; only findResizeHandle depends on live zoom.
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor) — behavior identical.
 */
export function useCanvasHitTest() {
  const zoom = useEditorStore((s) => s.zoom)

  // Find the deepest frame/group that contains the given canvas position
  const findParentFrameAtPosition = useCallback(
    (canvasX: number, canvasY: number, excludeIds: string[] = []): DesignElement | null => {
      const state = useEditorStore.getState()
      // Search recursively - find the deepest nested frame/group
      let bestMatch: DesignElement | null = null
      let bestDepth = -1

      const searchElements = (elements: DesignElement[], parentX: number, parentY: number, depth: number) => {
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i]
          if (!el.visible || el.locked) continue
          if (excludeIds.includes(el.id)) continue
          if (el.type !== 'frame' && el.type !== 'group') continue

          const absX = el.x + parentX
          const absY = el.y + parentY

          if (canvasX >= absX && canvasX <= absX + el.width &&
              canvasY >= absY && canvasY <= absY + el.height) {
            // Found a match - check if there's a deeper nested match
            if (depth > bestDepth) {
              bestDepth = depth
              bestMatch = el
            }
            // Search children for deeper frames
            if (el.children) {
              searchElements(el.children, absX, absY, depth + 1)
            }
          }
        }
      }

      searchElements(state.elements, 0, 0, 0)
      return bestMatch
    },
    []
  )

  const findElementAtPosition = useCallback(
    (canvasX: number, canvasY: number, deep = false): DesignElement | null => {
      const state = useEditorStore.getState()

      // PHASE 11 — deep select (⌘click): walk to the DEEPEST element under the
      // point at any nesting depth (Figma's cmd-click deep selection)
      if (deep) {
        let best: DesignElement | null = null
        let bestDepth = -1
        let bestAbs = { x: 0, y: 0 }
        const search = (elements: DesignElement[], parentAbsX: number, parentAbsY: number, depth: number) => {
          for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i]
            if (!el.visible || el.locked) continue
            const absX = el.x + parentAbsX
            const absY = el.y + parentAbsY
            const hit = canvasX >= absX && canvasX <= absX + el.width &&
                        canvasY >= absY && canvasY <= absY + el.height
            if (hit && depth >= bestDepth) {
              bestDepth = depth
              best = el
              bestAbs = { x: absX, y: absY }
            }
            if (el.children && (hit || true)) {
              // recurse into containers so deeper elements can win even when
              // the parent bounds don't contain the point (overflow)
              search(el.children, absX, absY, depth + 1)
            }
          }
        }
        search(state.elements, 0, 0, 0)
        void bestAbs
        return best
      }

      for (let i = state.elements.length - 1; i >= 0; i--) {
        const el = state.elements[i]
        if (!el.visible || el.locked) continue
        if (el.children) {
          for (let j = el.children.length - 1; j >= 0; j--) {
            const child = el.children[j]
            if (!child.visible || child.locked) continue
            // Convert child's relative coordinates to absolute canvas coordinates
            const absChildX = el.x + child.x
            const absChildY = el.y + child.y
            if (canvasX >= absChildX && canvasX <= absChildX + child.width &&
                canvasY >= absChildY && canvasY <= absChildY + child.height) {
              return child
            }
          }
        }
        if (canvasX >= el.x && canvasX <= el.x + el.width &&
            canvasY >= el.y && canvasY <= el.y + el.height) {
          return el
        }
      }
      return null
    },
    []
  )

  // Helper: get absolute position of an element (accounts for parent frame offsets)
  const getAbsolutePosition = useCallback(
    (elementId: string): { x: number; y: number } | null => {
      const state = useEditorStore.getState()
      // Check if element is a child of any frame/group
      for (const parent of state.elements) {
        if (parent.children) {
          const child = parent.children.find(c => c.id === elementId)
          if (child) {
            return { x: parent.x + child.x, y: parent.y + child.y }
          }
        }
      }
      // Top-level element
      const el = state.elements.find(e => e.id === elementId)
      if (el) return { x: el.x, y: el.y }
      return null
    },
    []
  )

  const findResizeHandle = useCallback(
    (canvasX: number, canvasY: number): { elementId: string; handle: HandlePosition } | null => {
      const state = useEditorStore.getState()
      if (state.selectedElementIds.length !== 1) return null
      const id = state.selectedElementIds[0]
      const el = findElementInList(state.elements, id)
      if (!el) return null
      // Use absolute position for child elements
      let absEl = el
      for (const parent of state.elements) {
        if (parent.children) {
          const child = parent.children.find(c => c.id === id)
          if (child) {
            absEl = { ...child, x: parent.x + child.x, y: parent.y + child.y }
            break
          }
        }
      }
      const safeZoomForHandles = isFinite(zoom) && zoom > 0.001 ? zoom : 1
      const handles = getHandlePositions(absEl, safeZoomForHandles)
      const threshold = HANDLE_SIZE / safeZoomForHandles
      const rotHandle = handles.rotate
      if (Math.abs(canvasX - rotHandle.x) < threshold && Math.abs(canvasY - rotHandle.y) < threshold) {
        return { elementId: id, handle: 'rotate' }
      }
      for (const [pos, point] of Object.entries(handles)) {
        if (pos === 'rotate') continue
        if (Math.abs(canvasX - point.x) < threshold && Math.abs(canvasY - point.y) < threshold) {
          return { elementId: id, handle: pos as HandlePosition }
        }
      }
      return null
    },
    [zoom]
  )

  return {
    findParentFrameAtPosition,
    findElementAtPosition,
    getAbsolutePosition,
    findResizeHandle,
  }
}

export type CanvasHitTest = ReturnType<typeof useCanvasHitTest>
