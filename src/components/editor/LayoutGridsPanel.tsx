'use client'

/**
 * PHASE 8 — LayoutGridsPanel: per-frame layout grid editor.
 *
 * Shows in the right sidebar when a frame is selected. Figma parity:
 *   - "+" adds Columns / Rows / Grid (a frame can hold several grids)
 *   - per grid row: visibility eye, pattern icon (columns/rows/square),
 *     params (count/gutter/margin/type for columns-rows, size for grid),
 *     color swatch, remove ×
 *   - "type" select: Stretch / Center / Start / End / Min / Max
 *     (min/max reveal the fixed section-size input)
 */

import React from 'react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import type { LayoutGrid, GridLayoutType } from '@/lib/layout-grids'

const GRID_TYPES: { value: GridLayoutType; label: string }[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'center', label: 'Center' },
  { value: 'start', label: 'Start' },
  { value: 'end', label: 'End' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

function GridRow({ frameId, grid }: { frameId: string; grid: LayoutGrid }) {
  const updateLayoutGrid = useEditorStore((s) => s.updateLayoutGrid)
  const removeLayoutGrid = useEditorStore((s) => s.removeLayoutGrid)

  const upd = (patch: Partial<LayoutGrid>) => updateLayoutGrid(frameId, grid.id, patch)
  const num = (v: string): number | undefined => {
    const n = parseFloat(v)
    return isFinite(n) ? n : undefined
  }

  return (
    <div className="flex flex-col gap-1 p-1.5 rounded bg-[#1E1E1E] border border-[#383838]">
      <div className="flex items-center gap-1.5">
        {/* visibility */}
        <button
          className={`w-4 h-4 flex items-center justify-center rounded text-[10px] ${grid.visible ? 'text-[#DDD]' : 'text-[#555]'}`}
          onClick={() => upd({ visible: !grid.visible })}
          title={grid.visible ? 'Hide grid' : 'Show grid'}
        >
          {grid.visible ? '◉' : '○'}
        </button>
        {/* pattern icon */}
        <span className="w-4 h-4 flex items-center justify-center text-[#888]" title={grid.pattern}>
          {grid.pattern === 'columns' ? '▥' : grid.pattern === 'rows' ? '▤' : '▦'}
        </span>
        {/* color */}
        <label className="relative w-4 h-4 rounded-[2px] border border-[#555] cursor-pointer shrink-0" style={{ background: grid.color }} title="Grid color">
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={grid.color}
            onChange={(e) => upd({ color: e.target.value })}
          />
        </label>

        {grid.pattern === 'grid' ? (
          <div className="flex items-center gap-1 flex-1">
            <span className="text-[10px] text-[#888]">Size</span>
            <input
              type="number" min={1} step={1}
              value={grid.size ?? 8}
              onChange={(e) => upd({ size: num(e.target.value) ?? 8 })}
              className="w-12 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 overflow-hidden">
            <select
              value={grid.type || 'stretch'}
              onChange={(e) => upd({ type: e.target.value as GridLayoutType })}
              className="flex-1 min-w-0 h-5 px-0.5 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
              title="Grid type"
            >
              {GRID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}
        {/* remove */}
        <button
          className="w-4 h-4 flex items-center justify-center rounded text-[#888] hover:text-[#F24822]"
          onClick={() => removeLayoutGrid(frameId, grid.id)}
          title="Remove grid"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2 L8 8 M8 2 L2 8" />
          </svg>
        </button>
      </div>

      {grid.pattern !== 'grid' && (
        <div className="flex items-center gap-1 pl-6">
          <span className="text-[10px] text-[#888] w-8">Count</span>
          <input
            type="number" min={1} max={100} step={1}
            value={grid.count ?? 12}
            onChange={(e) => upd({ count: Math.max(1, Math.round(num(e.target.value) ?? 12)) })}
            className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
          />
          <span className="text-[10px] text-[#888] w-9 pl-1">Gutter</span>
          <input
            type="number" min={0} step={1}
            value={grid.gutter ?? 16}
            onChange={(e) => upd({ gutter: Math.max(0, num(e.target.value) ?? 16) })}
            className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
          />
          <span className="text-[10px] text-[#888] w-9 pl-1">Margin</span>
          <input
            type="number" min={0} step={1}
            value={grid.margin ?? 32}
            onChange={(e) => upd({ margin: Math.max(0, num(e.target.value) ?? 32) })}
            className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
          />
        </div>
      )}

      {grid.pattern !== 'grid' && (grid.type === 'min' || grid.type === 'max') && (
        <div className="flex items-center gap-1 pl-6">
          <span className="text-[10px] text-[#888]">Track</span>
          <input
            type="number" min={1} step={1}
            value={grid.sectionSize ?? 60}
            onChange={(e) => upd({ sectionSize: Math.max(1, num(e.target.value) ?? 60) })}
            className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
            title="Fixed track size for Min/Max"
          />
        </div>
      )}
    </div>
  )
}

export function LayoutGridsPanel({ element }: { element: DesignElement }) {
  const addLayoutGrid = useEditorStore((s) => s.addLayoutGrid)
  const grids = element.layoutGrids || []

  if (element.type !== 'frame') return null

  return (
    <div className="space-y-1.5">
      {grids.map((g) => (
        <GridRow key={g.id} frameId={element.id} grid={g} />
      ))}
      <div className="flex items-center gap-1">
        <button
          onClick={() => addLayoutGrid(element.id, 'columns')}
          className="flex-1 h-6 text-[10px] rounded bg-[#1E1E1E] border border-[#383838] text-[#CCC] hover:border-[#0D99FF] hover:text-white transition-colors"
        >
          + Columns
        </button>
        <button
          onClick={() => addLayoutGrid(element.id, 'rows')}
          className="flex-1 h-6 text-[10px] rounded bg-[#1E1E1E] border border-[#383838] text-[#CCC] hover:border-[#0D99FF] hover:text-white transition-colors"
        >
          + Rows
        </button>
        <button
          onClick={() => addLayoutGrid(element.id, 'grid')}
          className="flex-1 h-6 text-[10px] rounded bg-[#1E1E1E] border border-[#383838] text-[#CCC] hover:border-[#0D99FF] hover:text-white transition-colors"
        >
          + Grid
        </button>
      </div>
    </div>
  )
}
