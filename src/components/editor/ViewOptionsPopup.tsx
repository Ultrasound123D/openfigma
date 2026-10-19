'use client'

/**
 * PHASE 8 — ViewOptionsPopup: canvas view toggles + ruler units.
 *
 * Figma parity ("View options" in the toolbar / main menu ⌘⇧O-ish region):
 *   - Pixel grid  (⌘')      — visible only ≥ 400% zoom (Figma behavior)
 *   - Layout grids (⌘\)     — global visibility of per-frame layout grids
 *   - Dot grid    (⌘;)      — the legacy background dot grid
 *   - Snap to pixel grid (⇧⌘') — rounds coords to whole canvas px
 *   - Snap to objects       — existing smart snapping
 *   - Rulers      (⇧R)      — with unit px/in/cm/mm @ DPI 72
 */

import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { RulerUnit } from '@/lib/layout-grids'

function ToggleRow({ label, checked, onChange, shortcut }: { label: string; checked: boolean; onChange: (v: boolean) => void; shortcut?: string }) {
  return (
    <button
      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-[#0D99FF]/20 rounded"
      onClick={() => onChange(!checked)}
    >
      <span className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center text-[9px] shrink-0 ${checked ? 'bg-[#0D99FF] border-[#0D99FF] text-white' : 'border-[#555] text-transparent'}`}>
        ✓
      </span>
      <span className="flex-1 text-[11px] text-[#DDD]">{label}</span>
      {shortcut && <span className="text-[9px] text-[#666]">{shortcut}</span>}
    </button>
  )
}

export function ViewOptionsPopup({ onClose }: { onClose: () => void }) {
  const {
    showPixelGrid, showLayoutGrids, showGrid, snapToPixels, snapToElements, showRulers, rulerUnit, zoom,
    setShowPixelGrid, setShowLayoutGrids, setShowGrid, setSnapToPixels, setSnapToElements, setShowRulers, setRulerUnit,
  } = useEditorStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const units: { value: RulerUnit; label: string }[] = [
    { value: 'px', label: 'Pixels' },
    { value: 'in', label: 'Inches' },
    { value: 'cm', label: 'Centimeters' },
    { value: 'mm', label: 'Millimeters' },
  ]

  return (
    <div ref={ref} className="absolute bottom-9 right-0 z-50 w-52 py-1.5 rounded-lg bg-[#2C2C2C] border border-[#3C3C3C] shadow-lg">
      <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#666]">View options</div>
      <ToggleRow label="Pixel grid" checked={showPixelGrid} onChange={setShowPixelGrid} shortcut="⌘'" />
      <div className="px-2.5 pb-1 text-[9px] text-[#666] pl-9">Shows at 400% zoom and above</div>
      <ToggleRow label="Layout grids" checked={showLayoutGrids} onChange={setShowLayoutGrids} shortcut="⌘\" />
      <ToggleRow label="Dot grid" checked={showGrid} onChange={setShowGrid} shortcut="⌘;" />
      <div className="h-px bg-[#3C3C3C] my-1" />
      <ToggleRow label="Snap to pixel grid" checked={snapToPixels} onChange={setSnapToPixels} shortcut="⇧⌘'" />
      <ToggleRow label="Snap to objects" checked={snapToElements} onChange={setSnapToElements} />
      <div className="h-px bg-[#3C3C3C] my-1" />
      <ToggleRow label="Rulers" checked={showRulers} onChange={setShowRulers} shortcut="⇧R" />
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="text-[11px] text-[#DDD] flex-1">Units</span>
        <select
          value={rulerUnit}
          onChange={(e) => setRulerUnit(e.target.value as RulerUnit)}
          className="h-6 px-1 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
          title="Ruler units — DPI 72"
        >
          {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      {rulerUnit !== 'px' && (
        <div className="px-2.5 pb-1.5 text-[9px] text-[#666]">DPI 72 — 1 in = 72 px</div>
      )}
      <div className="h-px bg-[#3C3C3C] my-1" />
      <div className="px-2.5 py-1 text-[9px] text-[#666]">Zoom: {Math.round(zoom * 100)}%</div>
    </div>
  )
}
