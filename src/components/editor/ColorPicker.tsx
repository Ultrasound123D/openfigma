'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  color: string
  opacity: number
  onChange: (color: string, opacity: number) => void
  recentColors?: string[]
}

// Convert hex to HSV
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  
  const s = max === 0 ? 0 : d / max
  const v = max
  
  return { h: h * 360, s: s * 100, v: v * 100 }
}

// Convert HSV to hex
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100
  v /= 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Material Design color palette (deduplicated)
const presetColors = [
  '#FFFFFF', '#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E',
  '#757575', '#616161', '#424242', '#212121', '#000000',
  '#FFEBEE', '#FFCDD2', '#EF9A9A', '#E57373', '#EF5350',
  '#F44336', '#E53935', '#C62828', '#B71C1C', '#880E4F',
  '#FCE4EC', '#F8BBD0', '#F48FB1', '#EC407A', '#E91E63',
  '#C2185B', '#AD1457', '#560027', '#3E2723', '#4E342E',
  '#FFF3E0', '#FFE0B2', '#FFCC80', '#FFA726', '#FF9800',
  '#FB8C00', '#E65100', '#DD2C00', '#FFF9C4', '#FFF176',
  '#FFEE58', '#FFEB3B', '#FDD835', '#F9A825', '#F57F17',
  '#E8F5E9', '#C8E6C9', '#A5D6A7', '#66BB6A', '#4CAF50',
  '#388E3C', '#2E7D32', '#1B5E20', '#B2DFDB', '#80CBC4',
  '#4DB6AC', '#26A69A', '#009688', '#00897B', '#00695C',
  '#E0F7FA', '#80DEEA', '#4DD0E1', '#26C6DA', '#00BCD4',
  '#0097A7', '#00838F', '#006064', '#BBDEFB', '#90CAF9',
  '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1565C0',
  '#0D47A1', '#C5CAE9', '#9FA8DA', '#7986CB', '#5C6BC0',
  '#3F51B5', '#303F9F', '#1A237E', '#E1BEE7', '#CE93D8',
  '#AB47BC', '#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C',
]

export function ColorPicker({ color, opacity, onChange, recentColors }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localHsv, setLocalHsv] = useState<{ h: number; s: number; v: number } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const svCanvasRef = useRef<HTMLCanvasElement>(null)
  const hueSliderRef = useRef<HTMLDivElement>(null)
  const [isDraggingSV, setIsDraggingSV] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const [hexInput, setHexInput] = useState(color.startsWith('#') ? color.toUpperCase() : '#D9D9D9')
  const [localRecentColors, setLocalRecentColors] = useState<string[]>([])

  // Derive HSV from color prop
  const propHsv = useMemo(() => {
    try { return hexToHsv(color.startsWith('#') && color.length === 7 ? color : '#D9D9D9') } catch { return { h: 0, s: 0, v: 80 } }
  }, [color])

  // Use local HSV when actively editing, otherwise derive from prop
  const effectiveHsv = localHsv ?? propHsv

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setLocalHsv(null) // Reset to prop-derived value
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Draw SV canvas
  useEffect(() => {
    const canvas = svCanvasRef.current
    if (!canvas || !isOpen) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    const hueColor = hsvToHex(effectiveHsv.h, 100, 100)
    ctx.fillStyle = hueColor
    ctx.fillRect(0, 0, w, h)

    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0)
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)')
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = whiteGrad
    ctx.fillRect(0, 0, w, h)

    const blackGrad = ctx.createLinearGradient(0, 0, 0, h)
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)')
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = blackGrad
    ctx.fillRect(0, 0, w, h)
  }, [isOpen, effectiveHsv.h])

  const handleSVChange = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = svCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    
    const newHsv = { ...effectiveHsv, s: x * 100, v: (1 - y) * 100 }
    setLocalHsv(newHsv)
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v)
    setHexInput(hex.toUpperCase())
    onChange(hex, opacity)
  }, [effectiveHsv, opacity, onChange])

  const handleHueChange = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const slider = hueSliderRef.current
    if (!slider) return
    const rect = slider.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    
    const newHsv = { ...effectiveHsv, h: x * 360 }
    setLocalHsv(newHsv)
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v)
    setHexInput(hex.toUpperCase())
    onChange(hex, opacity)
  }, [effectiveHsv, opacity, onChange])

  // Mouse move/up handlers for dragging
  useEffect(() => {
    if (!isDraggingSV && !isDraggingHue) return

    const handleMove = (e: MouseEvent) => {
      if (isDraggingSV) handleSVChange(e)
      if (isDraggingHue) handleHueChange(e)
    }
    const handleUp = () => {
      setIsDraggingSV(false)
      setIsDraggingHue(false)
      setLocalHsv(null) // Reset to prop-derived
      const hex = hsvToHex(effectiveHsv.h, effectiveHsv.s, effectiveHsv.v)
      setLocalRecentColors(prev => {
        const filtered = prev.filter(c => c !== hex)
        return [hex, ...filtered].slice(0, 8)
      })
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDraggingSV, isDraggingHue, handleSVChange, handleHueChange, effectiveHsv])

  const handleHexInputChange = (val: string) => {
    setHexInput(val.toUpperCase())
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      try {
        const newHsv = hexToHsv(val)
        setLocalHsv(newHsv)
        onChange(val, opacity)
      } catch { /* ignore */ }
    }
  }

  const handleOpacityChange = (val: string) => {
    const num = parseInt(val)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onChange(color, num)
    }
  }

  const displayHex = color.startsWith('#') && color.length === 7 ? color.toUpperCase() : '#D9D9D9'

  const selectPresetColor = (c: string) => {
    try {
      const newHsv = hexToHsv(c)
      setLocalHsv(newHsv)
      setHexInput(c.toUpperCase())
      onChange(c, opacity)
    } catch { /* ignore */ }
  }

  return (
    <div className="relative flex items-center gap-2" ref={pickerRef}>
      {/* Color swatch trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-7 h-7 rounded border border-[#555] shrink-0 overflow-hidden hover:ring-2 hover:ring-[#0D99FF]/30 transition-all"
        style={{ backgroundColor: displayHex }}
        title="Pick color"
      />

      {/* Hex input */}
      <input
        type="text"
        value={hexInput}
        onChange={(e) => handleHexInputChange(e.target.value)}
        onBlur={(e) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            onChange(e.target.value, opacity)
          } else {
            setHexInput(displayHex)
          }
        }}
        className="w-[72px] h-6 px-1.5 text-[11px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
      />

      {/* Opacity input */}
      <input
        type="text"
        value={opacity}
        onChange={(e) => handleOpacityChange(e.target.value)}
        className="w-[38px] h-6 px-1 text-[11px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
      />

      {/* Dropdown picker */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-[#2C2C2C] rounded-lg shadow-xl border border-[#3C3C3C] p-3 z-[100] w-[230px]">
          {/* SV Canvas */}
          <div className="relative mb-2">
            <canvas
              ref={svCanvasRef}
              width={204}
              height={150}
              className="w-full h-[150px] rounded cursor-crosshair"
              onMouseDown={(e) => {
                setIsDraggingSV(true)
                handleSVChange(e)
              }}
            />
            {/* SV indicator */}
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm pointer-events-none"
              style={{
                left: `${(effectiveHsv.s / 100) * 100}%`,
                top: `${(1 - effectiveHsv.v / 100) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueSliderRef}
            className="relative h-3 rounded-full mb-3 cursor-crosshair"
            style={{
              background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            }}
            onMouseDown={(e) => {
              setIsDraggingHue(true)
              handleHueChange(e)
            }}
          >
            {/* Hue indicator */}
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm pointer-events-none top-1/2"
              style={{
                left: `${(effectiveHsv.h / 360) * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: hsvToHex(effectiveHsv.h, 100, 100),
              }}
            />
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-[#888]">Opacity</span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => onChange(color, parseInt(e.target.value))}
              className="flex-1 h-1 accent-[#0D99FF] cursor-pointer"
            />
            <span className="text-[10px] text-[#999] w-7 text-right tabular-nums">{opacity}%</span>
          </div>

          {/* Hex input */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-[#888]">HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              className="flex-1 h-6 px-1.5 text-[11px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
            />
          </div>

          {/* Recent colors */}
          {(localRecentColors.length > 0 || (recentColors && recentColors.length > 0)) && (
            <div className="mb-3">
              <span className="text-[10px] text-[#888] mb-1 block">Recent</span>
              <div className="flex gap-1">
                {(localRecentColors.length > 0 ? localRecentColors : recentColors || []).map((c) => (
                  <button
                    key={c}
                    onClick={() => selectPresetColor(c)}
                    className="w-5 h-5 rounded border border-[#555] relative hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  >
                    {color.toUpperCase() === c.toUpperCase() && (
                      <Check className="w-2.5 h-2.5 absolute inset-0 m-auto text-white mix-blend-difference" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset colors grid */}
          <div className="grid grid-cols-10 gap-1">
            {presetColors.map((c, idx) => (
              <button
                key={`preset-${idx}-${c}`}
                onClick={() => selectPresetColor(c)}
                className="w-[18px] h-[18px] rounded-sm border border-[#555]/50 relative hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
              >
                {color.toUpperCase() === c.toUpperCase() && (
                  <Check className="w-2.5 h-2.5 absolute inset-0 m-auto text-white mix-blend-difference" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
