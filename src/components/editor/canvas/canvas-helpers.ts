import type { DesignElement } from '@/store/editor-store'

/**
 * Shared handle geometry & cursors for canvas selection/resize handles.
 * Extracted from Canvas.tsx (P4 refactor) so both the hit-testing hook and
 * the rendering layer can use them without circular imports.
 */

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export const HANDLE_SIZE = 8
export const ROTATION_HANDLE_DISTANCE = 30

export function getHandlePositions(el: DesignElement, zoom: number): Record<HandlePosition, { x: number; y: number }> {
  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
  return {
    nw: { x: el.x, y: el.y },
    n: { x: el.x + el.width / 2, y: el.y },
    ne: { x: el.x + el.width, y: el.y },
    e: { x: el.x + el.width, y: el.y + el.height / 2 },
    se: { x: el.x + el.width, y: el.y + el.height },
    s: { x: el.x + el.width / 2, y: el.y + el.height },
    sw: { x: el.x, y: el.y + el.height },
    w: { x: el.x, y: el.y + el.height / 2 },
    rotate: { x: el.x + el.width / 2, y: el.y - ROTATION_HANDLE_DISTANCE / safeZoom },
  }
}

export const handleCursors: Record<HandlePosition, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
  se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize', rotate: 'grab',
}

// Frustum culling: check if element is visible in viewport
export function isElementInViewport(el: DesignElement, viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return (
    el.x + el.width >= viewportBounds.minX &&
    el.x <= viewportBounds.maxX &&
    el.y + el.height >= viewportBounds.minY &&
    el.y <= viewportBounds.maxY
  )
}
