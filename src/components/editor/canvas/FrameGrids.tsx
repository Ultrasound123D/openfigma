'use client'

/**
 * PHASE 8 — FrameGrids: renders every frame's layout grids on the canvas.
 *
 * Figma parity notes:
 *   - Layout grids render INSIDE their frame (translated to frame origin).
 *   - Columns/rows render as tinted track rects; the square grid renders as a
 *     line pattern clipped to the frame.
 *   - Global visibility is gated by the store's showLayoutGrids view option
 *     (⌘\), per-grid visibility by grid.visible.
 *   - Grids render UNDER the frame's own background fill (Figma draws grids
 *     beneath content) — we render them as a sibling layer just above the
 *     canvas background and below elements.
 */

import React, { useMemo } from 'react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import { computeGridRects, gridStep } from '@/lib/layout-grids'

function frameGridsFor(el: DesignElement, keyPrefix: string): React.ReactNode {
  const grids = (el.layoutGrids || []).filter((g) => g.visible)
  if (grids.length === 0) return null
  return (
    <g key={keyPrefix} transform={`translate(${el.x}, ${el.y})`}>
      {grids.map((grid) => {
        if (grid.pattern === 'grid') {
          const step = gridStep(grid)
          const patId = `lgrid-${el.id}-${grid.id}`
          return (
            <g key={grid.id}>
              <defs>
                <pattern id={patId} width={step} height={step} patternUnits="userSpaceOnUse">
                  <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke={grid.color} strokeWidth={1} />
                </pattern>
              </defs>
              <rect x={0} y={0} width={el.width} height={el.height} fill={`url(#${patId})`} opacity={0.35} />
            </g>
          )
        }
        const rects = computeGridRects(grid, el.width, el.height)
        return (
          <g key={grid.id} opacity={0.12}>
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill={grid.color} stroke="none" />
            ))}
          </g>
        )
      })}
    </g>
  )
}

export function FrameGrids() {
  const elements = useEditorStore((s) => s.elements)
  const showLayoutGrids = useEditorStore((s) => s.showLayoutGrids)

  const layers = useMemo(() => {
    if (!showLayoutGrids) return null
    const out: React.ReactNode[] = []
    const walk = (els: DesignElement[]) => {
      for (const el of els) {
        if (el.type === 'frame' && el.visible) {
          const node = frameGridsFor(el, `fg-${el.id}`)
          if (node) out.push(node)
        }
        if (el.children) walk(el.children)
      }
    }
    walk(elements)
    return out.length > 0 ? out : null
  }, [elements, showLayoutGrids])

  if (!layers) return null
  return <g pointerEvents="none">{layers}</g>
}
