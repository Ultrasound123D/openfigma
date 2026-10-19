'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'
import type { DesignElement } from '@/store/editor-store'

/**
 * useCanvasViewport — pan / zoom / fit / wheel / space-panning / container size.
 *
 * Owns:
 *   - containerRef + ResizeObserver (drives auto-fit on first layout)
 *   - screenToCanvas coordinate conversion
 *   - wheel interactions (Ctrl=zoom, Shift=horizontal pan, Alt=zoom, plain=pan)
 *   - space/middle-button panning state (shared with the interaction hook)
 *
 * Extracted verbatim from Canvas.tsx (P4 refactor) — behavior identical.
 */
export function useCanvasViewport() {
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setPan = useEditorStore((s) => s.setPan)

  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const hasAutoFitted = useRef(false)

  // Native app feel: prevent drag-to-text, browser zoom
  useEffect(() => {
    const preventDefaults = (e: Event) => e.preventDefault()
    const container = containerRef.current
    if (container) {
      container.addEventListener('dragstart', preventDefaults)
      // Prevent browser zoom with Ctrl+scroll (React onWheel is passive)
      container.addEventListener('wheel', preventDefaults, { passive: false })
    }
    return () => {
      if (container) {
        container.removeEventListener('dragstart', preventDefaults)
        container.removeEventListener('wheel', preventDefaults)
      }
    }
  }, [])

  const calculateFitToScreen = useCallback((size: { width: number; height: number }) => {
    const state = useEditorStore.getState()
    const allElements = state.elements
    if (allElements.length === 0 || size.width < 200 || size.height < 200) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const processElement = (el: DesignElement, parentX = 0, parentY = 0) => {
      const absX = el.x + parentX
      const absY = el.y + parentY
      minX = Math.min(minX, absX)
      minY = Math.min(minY, absY)
      maxX = Math.max(maxX, absX + el.width)
      maxY = Math.max(maxY, absY + el.height)
      if (el.children) el.children.forEach(c => processElement(c, absX, absY))
    }
    allElements.forEach((el) => processElement(el))
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    const padding = 100
    const scaleX = (size.width - padding * 2) / contentWidth
    const scaleY = (size.height - padding * 2) / contentHeight
    const newZoom = Math.min(scaleX, scaleY, 2)
    state.setZoom(newZoom)
    state.setPan(-contentCenterX * newZoom, -contentCenterY * newZoom)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const size = { width: entry.contentRect.width, height: entry.contentRect.height }
        setContainerSize(size)
        if (!hasAutoFitted.current && size.width > 400 && size.height > 300) {
          hasAutoFitted.current = true
          setTimeout(() => calculateFitToScreen(size), 200)
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [calculateFitToScreen])

  const fitToScreen = useCallback(() => {
    if (containerSize.width === 0) return
    calculateFitToScreen(containerSize)
  }, [containerSize, calculateFitToScreen])

  const zoomToSelection = useCallback(() => {
    const state = useEditorStore.getState()
    const selected = state.selectedElementIds
      .map(id => findElementInList(state.elements, id))
      .filter(Boolean) as DesignElement[]
    if (selected.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    selected.forEach(el => {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    })
    const cw = maxX - minX
    const ch = maxY - minY
    const pad = 100
    const nz = Math.min((containerSize.width - pad * 2) / cw, (containerSize.height - pad * 2) / ch, 4)
    state.setZoom(nz)
    state.setPan(-(minX + cw / 2) * nz, -(minY + ch / 2) * nz)
  }, [containerSize])

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
      const cx = (containerSize.width || 0) / 2 + panX
      const cy = (containerSize.height || 0) / 2 + panY
      const x = (clientX - rect.left - cx) / safeZoom
      const y = (clientY - rect.top - cy) / safeZoom
      return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 }
    },
    [zoom, panX, panY, containerSize]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + scroll = zoom centered on cursor (Figma default)
        const delta = -e.deltaY * 0.005
        const newZoom = Math.min(64, Math.max(0.01, zoom + delta * zoom))
        if (rect) {
          const mouseX = e.clientX - rect.left - containerSize.width / 2
          const mouseY = e.clientY - rect.top - containerSize.height / 2
          const scale = newZoom / zoom
          const newPanX = mouseX - scale * (mouseX - panX)
          const newPanY = mouseY - scale * (mouseY - panY)
          setZoom(newZoom)
          setPan(newPanX, newPanY)
        }
      } else if (e.shiftKey) {
        // Shift + scroll = pan horizontally
        setPan(panX - e.deltaY, panY - e.deltaX)
      } else if (e.altKey) {
        // Alt + scroll = zoom (alternative)
        const delta = -e.deltaY * 0.003
        const newZoom = Math.min(64, Math.max(0.01, zoom + delta * zoom))
        if (rect) {
          const mouseX = e.clientX - rect.left - containerSize.width / 2
          const mouseY = e.clientY - rect.top - containerSize.height / 2
          const scale = newZoom / zoom
          const newPanX = mouseX - scale * (mouseX - panX)
          const newPanY = mouseY - scale * (mouseY - panY)
          setZoom(newZoom)
          setPan(newPanX, newPanY)
        }
      } else {
        // Plain scroll = pan vertically
        setPan(panX - e.deltaX, panY - e.deltaY)
      }
    },
    [zoom, panX, panY, setZoom, setPan, containerSize]
  )

  return {
    containerRef,
    containerSize,
    isPanning,
    setIsPanning,
    panStartRef,
    spaceHeld,
    setSpaceHeld,
    fitToScreen,
    zoomToSelection,
    screenToCanvas,
    handleWheel,
  }
}

export type CanvasViewport = ReturnType<typeof useCanvasViewport>
