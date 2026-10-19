'use client'

/**
 * PHASE 8 — Rulers: unit-aware (px / in / cm / mm @ DPI 72) with adaptive
 * tick stepping (majors kept ≥ ~64 screen px apart, minors 1/5 of major).
 * Drag from a ruler to create guides (behavior unchanged from before).
 */

import React, { useCallback, useRef } from 'react'
import { useEditorStore, Guide } from '@/store/editor-store'
import { PX_PER_UNIT, rulerTickSteps, type RulerUnit } from '@/lib/layout-grids'

interface RulersProps {
  containerWidth: number
  containerHeight: number
  zoom: number
  panX: number
  panY: number
}

const RULER_SIZE = 24

function fmtLabel(unitValue: number, unit: RulerUnit): string {
  if (unit === 'px') return String(Math.round(unitValue))
  // in/cm: 2 decimals trimmed; mm: 1 decimal trimmed
  const s = unitValue.toFixed(unit === 'mm' ? 1 : 2)
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

export function Rulers({ containerWidth, containerHeight, zoom, panX, panY }: RulersProps) {
  const { guides, addGuide, showRulers, rulerUnit } = useEditorStore()
  const isDraggingGuide = useRef<{ orientation: 'horizontal' | 'vertical'; startPos: number } | null>(null)

  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number) => {
      const cx = containerWidth / 2 + panX
      const cy = containerHeight / 2 + panY
      return { x: cx + canvasX * zoom, y: cy + canvasY * zoom }
    },
    [containerWidth, containerHeight, zoom, panX, panY]
  )
  void canvasToScreen

  if (!showRulers) return null

  const cx = containerWidth / 2 + panX
  const cy = containerHeight / 2 + panY

  const handleRulerMouseDown = (orientation: 'horizontal' | 'vertical', e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const startPos = orientation === 'horizontal' ? e.clientY - rect.top : e.clientX - rect.left

    const handleMove = (_moveEvent: MouseEvent) => {
      // Visual feedback - guide follows cursor
    }

    const handleUp = (upEvent: MouseEvent) => {
      const pos = orientation === 'horizontal'
        ? (upEvent.clientY - cy - RULER_SIZE) / zoom
        : (upEvent.clientX - cx - RULER_SIZE) / zoom

      const guide: Guide = {
        id: `guide-${Date.now()}`,
        orientation,
        position: Math.round(pos),
      }
      addGuide(guide)

      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  // --- Adaptive, unit-aware tick generation ------------------------------
  const unit = rulerUnit as RulerUnit
  const { major, minor } = rulerTickSteps(unit, zoom)
  const pxPerUnit = PX_PER_UNIT[unit]

  const makeTicks = (startPx: number, endPx: number) => {
    // startPx/endPx in CANVAS px; ticks computed in UNIT space
    const startU = startPx / pxPerUnit
    const endU = endPx / pxPerUnit
    const ticks: { pos: number; label: string; isMajor: boolean }[] = []
    const first = Math.floor(startU / minor) * minor
    // guard against runaway loops at extreme zoom/unit combos
    const maxTicks = 4000
    let count = 0
    for (let v = first; v <= endU && count < maxTicks; v += minor, count++) {
      // snap floating accumulation error
      const snapped = Math.round(v / minor) * minor
      const screenPos = cx === undefined ? 0 : 0 // placeholder, set by caller
      void screenPos
      const isMajor = Math.abs(snapped % major) < minor / 2
      ticks.push({ pos: snapped, label: isMajor ? fmtLabel(snapped, unit) : '', isMajor })
    }
    return ticks
  }

  const screenFor = (canvasPx: number, axis: 'x' | 'y') =>
    axis === 'x' ? cx + canvasPx * zoom : cy + canvasPx * zoom

  const hStart = -cx / zoom
  const hEnd = (containerWidth - cx) / zoom
  const hTicks = makeTicks(hStart, hEnd).map((t) => ({ ...t, pos: screenFor(t.pos * pxPerUnit, 'x') }))

  const vStart = -cy / zoom
  const vEnd = (containerHeight - cy) / zoom
  const vTicks = makeTicks(vStart, vEnd).map((t) => ({ ...t, pos: screenFor(t.pos * pxPerUnit, 'y') }))

  return (
    <>
      {/* Horizontal ruler */}
      <div
        className="absolute top-0 left-6 right-0 bg-[#2A2A2A] border-b border-[#383838] z-30 cursor-crosshair overflow-hidden select-none"
        style={{ height: RULER_SIZE }}
        onMouseDown={(e) => handleRulerMouseDown('horizontal', e)}
      >
        <svg width="100%" height={RULER_SIZE} className="block">
          {hTicks.map((tick, i) => (
            <React.Fragment key={i}>
              {tick.isMajor ? (
                <>
                  <line
                    x1={tick.pos}
                    y1={RULER_SIZE - 10}
                    x2={tick.pos}
                    y2={RULER_SIZE}
                    stroke="#888"
                    strokeWidth={1}
                  />
                  <text
                    x={tick.pos + 2}
                    y={9}
                    fontSize={9}
                    fill="#888"
                    fontFamily="Inter, system-ui"
                  >
                    {tick.label}
                  </text>
                </>
              ) : (
                <line
                  x1={tick.pos}
                  y1={RULER_SIZE - 5}
                  x2={tick.pos}
                  y2={RULER_SIZE}
                  stroke="#666"
                  strokeWidth={0.5}
                />
              )}
            </React.Fragment>
          ))}
        </svg>
      </div>

      {/* Vertical ruler */}
      <div
        className="absolute top-6 left-0 bottom-0 bg-[#2A2A2A] border-r border-[#383838] z-30 cursor-crosshair overflow-hidden select-none"
        style={{ width: RULER_SIZE }}
        onMouseDown={(e) => handleRulerMouseDown('vertical', e)}
      >
        <svg width={RULER_SIZE} height="100%" className="block">
          {vTicks.map((tick, i) => (
            <React.Fragment key={i}>
              {tick.isMajor ? (
                <>
                  <line
                    x1={RULER_SIZE - 10}
                    y1={tick.pos}
                    x2={RULER_SIZE}
                    y2={tick.pos}
                    stroke="#888"
                    strokeWidth={1}
                  />
                  <text
                    x={2}
                    y={tick.pos + 3}
                    fontSize={9}
                    fill="#888"
                    fontFamily="Inter, system-ui"
                    transform={`rotate(-90, 8, ${tick.pos})`}
                  >
                    {tick.label}
                  </text>
                </>
              ) : (
                <line
                  x1={RULER_SIZE - 5}
                  y1={tick.pos}
                  x2={RULER_SIZE}
                  y2={tick.pos}
                  stroke="#666"
                  strokeWidth={0.5}
                />
              )}
            </React.Fragment>
          ))}
        </svg>
      </div>

      {/* Corner square with unit label */}
      <div
        className="absolute top-0 left-0 bg-[#2A2A2A] border-r border-b border-[#383838] z-40 flex items-center justify-center"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
        title={`Ruler unit: ${unit} (DPI 72)`}
      >
        <span className="text-[8px] text-[#888] uppercase">{unit}</span>
      </div>
    </>
  )
}
