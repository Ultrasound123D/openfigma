'use client'

import React, { useCallback, useRef } from 'react'
import { useEditorStore, Guide } from '@/store/editor-store'

interface RulersProps {
  containerWidth: number
  containerHeight: number
  zoom: number
  panX: number
  panY: number
}

const RULER_SIZE = 24
const TICK_INTERVAL = 100

export function Rulers({ containerWidth, containerHeight, zoom, panX, panY }: RulersProps) {
  const { guides, addGuide, showRulers } = useEditorStore()
  const isDraggingGuide = useRef<{ orientation: 'horizontal' | 'vertical'; startPos: number } | null>(null)

  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number) => {
      const cx = containerWidth / 2 + panX
      const cy = containerHeight / 2 + panY
      return {
        x: cx + canvasX * zoom,
        y: cy + canvasY * zoom,
      }
    },
    [containerWidth, containerHeight, zoom, panX, panY]
  )

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const cx = containerWidth / 2 + panX
      const cy = containerHeight / 2 + panY
      return {
        x: (screenX - cx) / zoom,
        y: (screenY - cy) / zoom,
      }
    },
    [containerWidth, containerHeight, zoom, panX, panY]
  )

  if (!showRulers) return null

  const cx = containerWidth / 2 + panX
  const cy = containerHeight / 2 + panY

  const handleRulerMouseDown = (orientation: 'horizontal' | 'vertical', e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const startPos = orientation === 'horizontal' ? e.clientY - rect.top : e.clientX - rect.left

    const handleMove = (moveEvent: MouseEvent) => {
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

  // Generate tick marks for horizontal ruler
  const hTicks: { pos: number; label: string; isMajor: boolean }[] = []
  const startX = -cx / zoom
  const endX = (containerWidth - cx) / zoom
  const majorStep = TICK_INTERVAL
  const minorStep = majorStep / 5

  for (let v = Math.floor(startX / majorStep) * majorStep; v <= endX; v += minorStep) {
    const screenX = cx + v * zoom
    if (screenX < RULER_SIZE) continue
    const isMajor = Math.abs(v % majorStep) < minorStep / 2
    hTicks.push({
      pos: screenX,
      label: isMajor ? String(Math.round(v)) : '',
      isMajor,
    })
  }

  // Generate tick marks for vertical ruler
  const vTicks: { pos: number; label: string; isMajor: boolean }[] = []
  const startY = -cy / zoom
  const endY = (containerHeight - cy) / zoom

  for (let v = Math.floor(startY / majorStep) * majorStep; v <= endY; v += minorStep) {
    const screenY = cy + v * zoom
    if (screenY < RULER_SIZE) continue
    const isMajor = Math.abs(v % majorStep) < minorStep / 2
    vTicks.push({
      pos: screenY,
      label: isMajor ? String(Math.round(v)) : '',
      isMajor,
    })
  }

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

      {/* Corner square */}
      <div
        className="absolute top-0 left-0 bg-[#2A2A2A] border-r border-b border-[#383838] z-40"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
    </>
  )
}
