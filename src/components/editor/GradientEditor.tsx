'use client'

import React, { useState, useCallback, useRef } from 'react'
import { GradientStop } from '@/store/editor-store'

interface GradientEditorProps {
  angle: number
  stops: GradientStop[]
  onChange: (angle: number, stops: GradientStop[]) => void
}

export function GradientEditor({ angle, stops, onChange }: GradientEditorProps) {
  const [activeStop, setActiveStop] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleAngleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val >= 0 && val < 360) {
      onChange(val, stops)
    }
  }, [stops, onChange])

  const handleStopColorChange = useCallback((index: number, color: string) => {
    const newStops = stops.map((s, i) => i === index ? { ...s, color } : s)
    onChange(angle, newStops)
  }, [angle, stops, onChange])

  const handleStopOffsetChange = useCallback((index: number, offset: number) => {
    const newStops = stops.map((s, i) => i === index ? { ...s, offset: Math.max(0, Math.min(1, offset)) } : s)
    onChange(angle, newStops)
  }, [angle, stops, onChange])

  const handleAddStop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    // Find color at this position by interpolation
    const newStop: GradientStop = {
      offset,
      color: interpolateColor(stops, offset),
      opacity: 1,
    }
    onChange(angle, [...stops, newStop].sort((a, b) => a.offset - b.offset))
  }, [angle, stops, onChange])

  const handleRemoveStop = useCallback((index: number) => {
    if (stops.length <= 2) return
    onChange(angle, stops.filter((_, i) => i !== index))
  }, [angle, stops, onChange])

  const gradientCSS = `linear-gradient(${angle}deg, ${stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`

  return (
    <div className="space-y-2">
      {/* Gradient preview bar */}
      <div
        ref={barRef}
        className="h-4 rounded border border-[#555] cursor-crosshair relative"
        style={{ background: gradientCSS }}
        onClick={handleAddStop}
      >
        {/* Stop handles */}
        {stops.map((stop, i) => (
          <div
            key={i}
            className={`absolute top-full w-3 h-3 -ml-1.5 mt-0.5 cursor-grab border-2 rounded-sm ${
              i === activeStop ? 'border-white' : 'border-[#888]'
            }`}
            style={{
              left: `${stop.offset * 100}%`,
              backgroundColor: stop.color,
            }}
            onClick={(e) => {
              e.stopPropagation()
              setActiveStop(i)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setActiveStop(i)
              isDragging.current = true
              const startX = e.clientX
              const bar = barRef.current
              if (!bar) return
              const barRect = bar.getBoundingClientRect()
              const startOffset = stop.offset

              const handleMove = (moveEvent: MouseEvent) => {
                if (!isDragging.current) return
                const dx = moveEvent.clientX - startX
                const newOffset = startOffset + dx / barRect.width
                handleStopOffsetChange(i, newOffset)
              }

              const handleUp = () => {
                isDragging.current = false
                document.removeEventListener('mousemove', handleMove)
                document.removeEventListener('mouseup', handleUp)
              }

              document.addEventListener('mousemove', handleMove)
              document.addEventListener('mouseup', handleUp)
            }}
          />
        ))}
      </div>

      {/* Angle control */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#888] w-8">Angle</span>
        <input
          type="range"
          min="0"
          max="359"
          value={angle}
          onChange={handleAngleChange}
          className="flex-1 h-1 accent-[#0D99FF] cursor-pointer"
        />
        <input
          type="text"
          value={angle}
          onChange={handleAngleChange}
          className="w-8 h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
        />
      </div>

      {/* Active stop controls */}
      {stops[activeStop] && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#888] w-8">Color</span>
          <input
            type="color"
            value={stops[activeStop].color}
            onChange={(e) => handleStopColorChange(activeStop, e.target.value)}
            className="w-6 h-5 rounded border border-[#555] cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={stops[activeStop].color}
            onChange={(e) => handleStopColorChange(activeStop, e.target.value)}
            className="w-16 h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
          />
          <button
            onClick={() => handleRemoveStop(activeStop)}
            className="text-[10px] text-[#F44336] hover:text-[#FF6B6B] ml-auto"
            title="Remove stop"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function interpolateColor(stops: GradientStop[], offset: number): string {
  if (stops.length === 0) return '#000000'
  if (stops.length === 1) return stops[0].color

  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  if (offset <= sorted[0].offset) return sorted[0].color
  if (offset >= sorted[sorted.length - 1].offset) return sorted[sorted.length - 1].color

  for (let i = 0; i < sorted.length - 1; i++) {
    if (offset >= sorted[i].offset && offset <= sorted[i + 1].offset) {
      const t = (offset - sorted[i].offset) / (sorted[i + 1].offset - sorted[i].offset)
      return lerpColor(sorted[i].color, sorted[i + 1].color, t)
    }
  }
  return sorted[0].color
}

function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
