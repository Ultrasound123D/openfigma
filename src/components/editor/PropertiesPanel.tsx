'use client'

import React, { useCallback, useState } from 'react'
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Link2,
  Link2Off,
  Plus,
  Trash2,
  FlipHorizontal2,
  FlipVertical2,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react'
import { useEditorStore, DesignElement, FillStyle, StrokeStyle } from '@/store/editor-store'
import { ColorPicker } from './ColorPicker'
import { GradientEditor } from './GradientEditor'
import { EffectsPanel } from './EffectsPanel'
import { ExportPanel } from './ExportPanel'
// PHASE 7 — style menu (four-dots) per slot
import type { StyleSlot, StyleKind } from '@/lib/styles'
// PHASE 8 — per-frame layout grid editor
import { LayoutGridsPanel } from './LayoutGridsPanel'

/** Figma-style four-dots style menu for a slot (fill/stroke/text/effect). */
function StyleMenuButton({ elementId, slot, kind }: { elementId: string; slot: StyleSlot; kind: StyleKind }) {
  const styles = useEditorStore((s) => s.styles)
  const createStyleFromElement = useEditorStore((s) => s.createStyleFromElement)
  const applyStyleToSelection = useEditorStore((s) => s.applyStyleToSelection)
  const detachStyleFromSelection = useEditorStore((s) => s.detachStyleFromSelection)
  const elements = useEditorStore((s) => s.elements)
  const [open, setOpen] = useState(false)

  const el = (() => {
    const find = (els: DesignElement[]): DesignElement | null => {
      for (const e of els) {
        if (e.id === elementId) return e
        if (e.children) { const f = find(e.children); if (f) return f }
      }
      return null
    }
    return find(elements)
  })()
  const attachedId = el ? (slot === 'fill' ? el.fillStyleId : slot === 'stroke' ? el.strokeStyleId : slot === 'text' ? el.textStyleId : el.effectStyleId) : undefined
  const attached = styles.find((s) => s.id === attachedId)
  const list = styles.filter((s) => s.kind === kind)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C] transition-colors"
        title="Styles"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill={attached ? '#0D99FF' : 'currentColor'} className="text-[#888]">
          <circle cx="2" cy="2" r="1.15" /><circle cx="8" cy="2" r="1.15" />
          <circle cx="5" cy="5" r="1.15" /><circle cx="2" cy="8" r="1.15" /><circle cx="8" cy="8" r="1.15" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-44 py-1 rounded-lg bg-[#2C2C2C] border border-[#3C3C3C] shadow-lg max-h-64 overflow-auto">
            <button
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-[#DDD] hover:bg-[#0D99FF]/20 flex items-center gap-1.5"
              onClick={() => {
                createStyleFromElement(elementId, slot, `${kind === 'paint' ? 'Paint' : kind === 'text' ? 'Text' : 'Effect'} style ${styles.length + 1}`)
                setOpen(false)
              }}
            >
              <span className="text-[#0D99FF]">＋</span> Create style
            </button>
            {attached && (
              <button
                className="w-full text-left px-2.5 py-1.5 text-[11px] text-[#DDD] hover:bg-[#0D99FF]/20"
                onClick={() => { detachStyleFromSelection(attached.id); setOpen(false) }}
              >
                Detach “{attached.name}”
              </button>
            )}
            {list.length > 0 && <div className="h-px bg-[#3C3C3C] my-1" />}
            {list.map((s) => (
              <button
                key={s.id}
                className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-[#0D99FF]/20 flex items-center gap-1.5 ${s.id === attachedId ? 'text-[#0D99FF]' : 'text-[#DDD]'}`}
                onClick={() => {
                  // apply to selection via store (works for multi-select too)
                  applyStyleToSelection(s.id)
                  setOpen(false)
                }}
              >
                <span className="w-3 h-3 rounded-[2px] border border-[#555] shrink-0" style={{
                  background: s.kind === 'paint'
                    ? (s.paint?.type === 'solid' ? s.paint.color : s.paint?.type === 'image' ? '#777' : `linear-gradient(135deg, ${(s.paint?.gradientStops || []).map((st) => st.color).join(', ')})`)
                    : s.kind === 'text' ? (s.text?.textColor || '#FFF') : 'repeating-linear-gradient(45deg,#444,#444 2px,#888 2px,#888 4px)',
                }} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PropertyInput({ label, value, onChange, onBlur, className = '' }: { label: string; value: number | string; onChange: (val: string) => void; onBlur?: () => void; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-[10px] text-[#888] w-3.5 shrink-0 text-right">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums transition-colors duration-100"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const num = parseFloat(String(value))
            if (!isNaN(num)) {
              const delta = e.shiftKey ? 10 : 1
              const newVal = e.key === 'ArrowUp' ? num + delta : num - delta
              onChange(String(Math.round(newVal)))
            }
          }
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

function SectionHeader({ title, action, collapsible, defaultOpen = true }: { title: string; action?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="flex items-center justify-between mb-1 cursor-pointer select-none" onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}>
      <div className="flex items-center gap-1">
        {collapsible && (
          <ChevronDown className={`w-2.5 h-2.5 text-[#888] transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        )}
        <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wider">{title}</span>
      </div>
      {action}
    </div>
  )
}

function SectionDivider() {
  return <div className="border-t border-[#383838] my-2" />
}

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
]

const FRAME_PRESETS = [
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'iPhone 15 Pro', width: 393, height: 852 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'iPad Pro 11"', width: 834, height: 1194 },
  { name: 'Desktop', width: 1440, height: 1024 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'A4', width: 595, height: 842 },
  { name: 'Twitter Post', width: 1200, height: 675 },
  { name: 'Instagram', width: 1080, height: 1080 },
]

export function PropertiesPanel() {
  const { elements, selectedElementIds, updateElement, alignElements, distributeElements, pushHistory, addFill, removeFill, updateFill, addStroke, removeStroke, updateStroke, setBlendMode, flipHorizontal, flipVertical, addComponent, detachInstance, resizeFrameWithConstraints, applyTextAutoSize } = useEditorStore()
  const [aspectLocked, setAspectLocked] = useState(false)
  const [cornersLinked, setCornersLinked] = useState(true)
  const [showInspect, setShowInspect] = useState(false)

  const getSelectedElement = useCallback((): DesignElement | null => {
    if (selectedElementIds.length === 0) return null
    const id = selectedElementIds[0]
    for (const el of elements) {
      if (el.id === id) return el
      if (el.children) {
        const child = el.children.find((c) => c.id === id)
        if (child) return child
      }
    }
    return null
  }, [elements, selectedElementIds])

  const element = getSelectedElement()

  if (!element) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#2C2C2C] flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1" stroke="#666" strokeWidth="1.5"/>
              <rect x="11" y="2" width="7" height="7" rx="1" stroke="#666" strokeWidth="1.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1" stroke="#666" strokeWidth="1.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1" stroke="#666" strokeWidth="1.5"/>
            </svg>
          </div>
          <p className="text-[11px] text-[#888]">Select an element to edit</p>
          <p className="text-[10px] text-[#666] mt-1">{selectedElementIds.length > 1 ? `${selectedElementIds.length} elements selected` : 'No selection'}</p>
        </div>
      </div>
    )
  }

  const handlePositionChange = (axis: 'x' | 'y', value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) updateElement(element.id, { [axis]: Math.round(num) })
  }

  const handleDimensionChange = (dim: 'width' | 'height', value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      const updates: Partial<DesignElement> = { [dim]: Math.round(num) }
      if (aspectLocked) {
        const ratio = element.width / element.height
        if (dim === 'width') updates.height = Math.round(num / ratio)
        else updates.width = Math.round(num * ratio)
      }
      // PHASE 9: frame resize via the numeric panel also applies constraints
      if (element.type === 'frame' && element.children && element.children.length > 0 && !element.autoLayout) {
        resizeFrameWithConstraints(element.id, {
          width: updates.width ?? element.width,
          height: updates.height ?? element.height,
        })
      } else {
        updateElement(element.id, updates)
      }
    }
  }

  const handleRotationChange = (value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) updateElement(element.id, { rotation: Math.round(num) % 360 })
  }

  const handleCornerRadiusChange = (value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) {
      if (cornersLinked) {
        updateElement(element.id, { cornerRadius: Math.round(num), cornerRadiusTL: Math.round(num), cornerRadiusTR: Math.round(num), cornerRadiusBL: Math.round(num), cornerRadiusBR: Math.round(num) })
      } else {
        updateElement(element.id, { cornerRadius: Math.round(num) })
      }
    }
  }

  const handleOpacityChange = (value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0 && num <= 100) updateElement(element.id, { opacity: Math.round(num) })
  }

  const handleFillChange = (color: string, _opacity: number) => {
    pushHistory()
    updateElement(element.id, { fill: color })
  }

  const handleStrokeChange = (color: string, _opacity: number) => {
    pushHistory()
    updateElement(element.id, { stroke: color })
  }

  const handleTextChange = (field: string, value: string | number) => {
    updateElement(element.id, { [field]: value })
    // PHASE 10: any text-affecting change re-runs auto-size (hug/grow)
    applyTextAutoSize(element.id)
  }

  const handleAlign = (alignment: string) => {
    if (selectedElementIds.length >= 2) {
      pushHistory()
      alignElements(selectedElementIds, alignment)
    }
  }

  const handleDistribute = (direction: string) => {
    if (selectedElementIds.length >= 3) {
      pushHistory()
      distributeElements(selectedElementIds, direction)
    }
  }

  const typeLabel = element.type.charAt(0).toUpperCase() + element.type.slice(1)
  const isText = element.type === 'text'
  const isLine = element.type === 'line'
  const isArrow = element.type === 'arrow'
  const isGroup = element.type === 'group'
  const isFrame = element.type === 'frame'
  const isStar = element.type === 'star'
  const isPolygon = element.type === 'polygon'

  // Generate CSS for inspect panel
  const generateCSS = () => {
    const lines: string[] = []
    lines.push(`/* ${element.name} */`)
    lines.push(`.element {`)
    lines.push(`  width: ${Math.round(element.width)}px;`)
    lines.push(`  height: ${Math.round(element.height)}px;`)
    if (element.x !== 0 || element.y !== 0) lines.push(`  position: absolute;`)
    if (element.x !== 0) lines.push(`  left: ${Math.round(element.x)}px;`)
    if (element.y !== 0) lines.push(`  top: ${Math.round(element.y)}px;`)
    if (element.fill && element.fill !== 'transparent') lines.push(`  background: ${element.fill};`)
    if (element.stroke && element.stroke !== 'transparent') lines.push(`  border: ${element.strokeWidth}px solid ${element.stroke};`)
    if (element.cornerRadius > 0) lines.push(`  border-radius: ${element.cornerRadius}px;`)
    if (element.opacity < 100) lines.push(`  opacity: ${element.opacity / 100};`)
    if (element.rotation) lines.push(`  transform: rotate(${element.rotation}deg);`)
    if (element.blendMode && element.blendMode !== 'normal') lines.push(`  mix-blend-mode: ${element.blendMode};`)
    if (isFrame && element.clipContent) lines.push(`  overflow: hidden;`)
    if (isFrame && element.autoLayout) {
      lines.push(`  display: flex;`)
      lines.push(`  flex-direction: ${element.autoLayout.direction === 'vertical' ? 'column' : 'row'};`)
      lines.push(`  gap: ${element.autoLayout.gap}px;`)
      lines.push(`  padding: ${element.autoLayout.paddingTop}px ${element.autoLayout.paddingRight}px ${element.autoLayout.paddingBottom}px ${element.autoLayout.paddingLeft}px;`)
    }
    if (isText) {
      if (element.fontFamily) lines.push(`  font-family: '${element.fontFamily}', sans-serif;`)
      if (element.fontSize) lines.push(`  font-size: ${element.fontSize}px;`)
      if (element.fontWeight) lines.push(`  font-weight: ${element.fontWeight};`)
      if (element.textAlign) lines.push(`  text-align: ${element.textAlign};`)
      if (element.lineHeight) lines.push(`  line-height: ${element.lineHeight};`)
      if (element.textColor) lines.push(`  color: ${element.textColor};`)
    }
    if (element.shadows && element.shadows.length > 0) {
      const shadowCSS = element.shadows.filter(s => s.visible).map(s => {
        return `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}${s.opacity < 100 ? Math.round(s.opacity * 2.55).toString(16).padStart(2, '0') : ''}`
      }).join(', ')
      if (shadowCSS) lines.push(`  box-shadow: ${shadowCSS};`)
    }
    if (element.blurs && element.blurs.length > 0) {
      const blur = element.blurs.find(b => b.visible && b.type === 'blur')
      if (blur) lines.push(`  filter: blur(${blur.radius}px);`)
    }
    lines.push(`}`)
    return lines.join('\n')
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
      {/* Design / Inspect toggle */}
      <div className="flex items-center gap-px rounded-sm bg-[#1E1E1E] p-px mb-1">
        <button
          onClick={() => setShowInspect(false)}
          className={`flex-1 px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors duration-100 ${!showInspect ? 'bg-[#0D99FF] text-white' : 'text-[#888] hover:text-white'}`}
        >
          Design
        </button>
        <button
          onClick={() => setShowInspect(true)}
          className={`flex-1 px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors duration-100 ${showInspect ? 'bg-[#0D99FF] text-white' : 'text-[#888] hover:text-white'}`}
        >
          Inspect
        </button>
      </div>

      {showInspect ? (
        <div className="space-y-2">
          <pre className="text-[10px] text-[#CCC] bg-[#1E1E1E] p-2 rounded border border-[#383838] overflow-x-auto whitespace-pre-wrap font-mono">
            {generateCSS()}
          </pre>
        </div>
      ) : (
        <>
          {/* Element type label */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {element.isComponent && (
                <div className="w-3 h-3 rounded bg-[#A259FF]" title="Component" />
              )}
              {element.componentId && (
                <div className="w-3 h-3 rounded border border-[#A259FF] bg-transparent" title="Instance" />
              )}
              <span className="text-[11px] font-semibold text-white">{typeLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              {!element.isComponent && !element.componentId && (
                <button
                  onClick={() => { pushHistory(); addComponent(element.id) }}
                  className="flex items-center justify-center h-5 px-1.5 rounded text-[9px] bg-[#A259FF]/20 text-[#A259FF] hover:bg-[#A259FF]/30 transition-colors"
                  title="Create Component (Ctrl+Alt+K)"
                >
                  ◆ Component
                </button>
              )}
              {element.componentId && (
                <button
                  onClick={() => { pushHistory(); detachInstance(element.id) }}
                  className="flex items-center justify-center h-5 px-1.5 rounded text-[9px] bg-[#A259FF]/20 text-[#A259FF] hover:bg-[#A259FF]/30 transition-colors"
                  title="Detach Instance"
                >
                  ◇ Detach
                </button>
              )}
              <span className="text-[10px] text-[#666]">{element.name}</span>
            </div>
          </div>

          <SectionDivider />

          {/* Position */}
          <div>
            <SectionHeader title="Position" />
            <div className="grid grid-cols-2 gap-2">
              <PropertyInput label="X" value={Math.round(element.x)} onChange={(v) => handlePositionChange('x', v)} onBlur={pushHistory} />
              <PropertyInput label="Y" value={Math.round(element.y)} onChange={(v) => handlePositionChange('y', v)} onBlur={pushHistory} />
            </div>
          </div>

          {/* Dimensions */}
          {!isGroup && (
            <div>
              <SectionHeader title="Size" />
              <div className="flex items-center gap-1">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <PropertyInput label="W" value={Math.round(element.width)} onChange={(v) => handleDimensionChange('width', v)} onBlur={pushHistory} />
                  <PropertyInput label="H" value={Math.round(element.height)} onChange={(v) => handleDimensionChange('height', v)} onBlur={pushHistory} />
                </div>
                <button onClick={() => setAspectLocked(!aspectLocked)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] transition-colors shrink-0" title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}>
                  {aspectLocked ? <Link2 className="w-3 h-3 text-[#0D99FF]" /> : <Link2Off className="w-3 h-3 text-[#888]" />}
                </button>
              </div>
            </div>
          )}

          {/* Rotation */}
          <div>
            <SectionHeader title="Rotation" />
            <div className="grid grid-cols-2 gap-2">
              <PropertyInput label="°" value={Math.round(element.rotation || 0)} onChange={handleRotationChange} onBlur={pushHistory} />
            </div>
          </div>

          {/* Frame presets */}
          {isFrame && (
            <div>
              <SectionHeader title="Frame Presets" />
              <select
                onChange={(e) => {
                  const preset = FRAME_PRESETS.find(p => p.name === e.target.value)
                  if (preset) {
                    pushHistory()
                    updateElement(element.id, { width: preset.width, height: preset.height, name: preset.name })
                  }
                }}
                className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                value=""
              >
                <option value="">Select preset...</option>
                {FRAME_PRESETS.map(p => (
                  <option key={p.name} value={p.name}>{p.name} ({p.width}×{p.height})</option>
                ))}
              </select>
            </div>
          )}

          {/* PHASE 8 — Layout grids (frames only) */}
          {element.type === 'frame' && (
            <div>
              <SectionHeader title="Layout Grids" />
              <LayoutGridsPanel element={element} />
            </div>
          )}

          {/* Alignment */}
          <div>
            <SectionHeader title="Alignment" />
            <div className="flex items-center gap-0.5 rounded bg-[#1E1E1E] p-0.5">
              {[
                { icon: AlignStartHorizontal, label: 'Left', align: 'left' },
                { icon: AlignCenterHorizontal, label: 'Center H', align: 'center-h' },
                { icon: AlignEndHorizontal, label: 'Right', align: 'right' },
                { icon: AlignHorizontalSpaceAround, label: 'Space H', action: () => handleDistribute('horizontal') },
                { icon: AlignStartVertical, label: 'Top', align: 'top' },
                { icon: AlignCenterVertical, label: 'Center V', align: 'center-v' },
                { icon: AlignEndVertical, label: 'Bottom', align: 'bottom' },
                { icon: AlignVerticalSpaceAround, label: 'Space V', action: () => handleDistribute('vertical') },
              ].map(({ icon: Icon, label, align, action }, i) => (
                <button
                  key={i}
                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] transition-colors"
                  title={label}
                  onClick={() => align ? handleAlign(align) : action?.()}
                >
                  <Icon className="w-3 h-3 text-[#888]" />
                </button>
              ))}
            </div>
          </div>

          <SectionDivider />

          {/* Appearance */}
          <div>
            <SectionHeader title="Appearance" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Opacity</span>
                <input type="range" min="0" max="100" value={element.opacity} onChange={(e) => handleOpacityChange(e.target.value)} onMouseUp={pushHistory} onTouchEnd={pushHistory} className="flex-1 h-1 accent-[#0D99FF] cursor-pointer" />
                <input type="text" value={element.opacity} onChange={(e) => handleOpacityChange(e.target.value)} onBlur={pushHistory} className="w-10 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums" />
              </div>
              {/* Blend Mode */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Blend</span>
                <select
                  value={element.blendMode || 'normal'}
                  onChange={(e) => { pushHistory(); setBlendMode(element.id, e.target.value) }}
                  className="flex-1 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                >
                  {BLEND_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                  ))}
                </select>
              </div>
              {/* Flip buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Flip</span>
                <div className="flex gap-0.5">
                  <button onClick={() => { pushHistory(); flipHorizontal(element.id) }} className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${element.flipH ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}>
                    <FlipHorizontal2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => { pushHistory(); flipVertical(element.id) }} className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${element.flipV ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}>
                    <FlipVertical2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <SectionDivider />

          {/* Fill layers */}
          {!isLine && !isArrow && !isGroup && (
            <div>
              <SectionHeader
                title="Fill"
                action={
                  <div className="flex items-center gap-1">
                    <StyleMenuButton elementId={element.id} slot="fill" kind="paint" />
                    <button
                      onClick={() => addFill(element.id, { type: 'solid', color: '#D9D9D9', opacity: 100 })}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C] transition-colors"
                      title="Add solid fill"
                    >
                      <Plus className="w-3 h-3 text-[#888]" />
                    </button>
                  </div>
                }
              />
              {/* Default fill */}
              <div className="flex items-center gap-2 p-1.5 rounded bg-[#1E1E1E] border border-[#383838] mb-1">
                <ColorPicker
                  color={element.fill === 'transparent' ? '#FFFFFF' : element.fill}
                  opacity={element.opacity}
                  onChange={handleFillChange}
                />
              </div>
              {/* Additional fill layers */}
              {(element.fills || []).map((fill, i) => (
                <FillLayerItem key={i} elementId={element.id} fill={fill} index={i} />
              ))}
            </div>
          )}

          {/* Stroke layers */}
          {!isGroup && (
            <div>
              <SectionHeader
                title="Stroke"
                action={
                  <div className="flex items-center gap-1">
                    <StyleMenuButton elementId={element.id} slot="stroke" kind="paint" />
                    <button
                      onClick={() => addStroke(element.id, { color: '#000000', width: 1, style: 'solid', opacity: 100, align: 'center' })}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C] transition-colors"
                      title="Add stroke"
                    >
                      <Plus className="w-3 h-3 text-[#888]" />
                    </button>
                  </div>
                }
              />
              <div className="flex items-center gap-2 p-1.5 rounded bg-[#1E1E1E] border border-[#383838] mb-1">
                <ColorPicker
                  color={element.stroke === 'transparent' ? '#000000' : element.stroke}
                  opacity={element.opacity}
                  onChange={handleStrokeChange}
                />
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="text"
                    value={element.strokeWidth}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value)
                      if (!isNaN(num) && num >= 0) updateElement(element.id, { strokeWidth: num })
                    }}
                    onBlur={pushHistory}
                    className="w-10 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
                  />
                </div>
              </div>
              {/* Stroke style */}
              <div className="flex items-center gap-1 mt-1 mb-1">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Style</span>
                <div className="flex gap-0.5">
                  {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                    <button key={style} onClick={() => updateElement(element.id, { strokeStyle: style })} className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${element.strokeStyle === style ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Stroke alignment */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Align</span>
                <div className="flex gap-0.5">
                  {(['inside', 'center', 'outside'] as const).map((align) => (
                    <button key={align} onClick={() => updateElement(element.id, { strokeAlign: align })} className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${(element.strokeAlign || 'center') === align ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}>
                      {align.charAt(0).toUpperCase() + align.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Additional stroke layers */}
              {(element.strokes || []).map((stroke, i) => (
                <StrokeLayerItem key={i} elementId={element.id} stroke={stroke} index={i} />
              ))}
            </div>
          )}

          {/* Corner Radius */}
          {!isLine && !isText && !isGroup && !isStar && !isPolygon && (
            <div>
              <SectionHeader title="Corner Radius" />
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <div className="grid grid-cols-4 gap-1">
                    <PropertyInput label="↖" value={element.cornerRadiusTL || 0} onChange={(v) => { const num = parseInt(v); if (!isNaN(num) && num >= 0) updateElement(element.id, { cornerRadiusTL: num }) }} />
                    <PropertyInput label="↗" value={element.cornerRadiusTR || 0} onChange={(v) => { const num = parseInt(v); if (!isNaN(num) && num >= 0) updateElement(element.id, { cornerRadiusTR: num }) }} />
                    <PropertyInput label="↙" value={element.cornerRadiusBL || 0} onChange={(v) => { const num = parseInt(v); if (!isNaN(num) && num >= 0) updateElement(element.id, { cornerRadiusBL: num }) }} />
                    <PropertyInput label="↘" value={element.cornerRadiusBR || 0} onChange={(v) => { const num = parseInt(v); if (!isNaN(num) && num >= 0) updateElement(element.id, { cornerRadiusBR: num }) }} />
                  </div>
                </div>
                <button onClick={() => setCornersLinked(!cornersLinked)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#3C3C3C] transition-colors shrink-0" title={cornersLinked ? 'Unlink corners' : 'Link corners'}>
                  {cornersLinked ? <Link2 className="w-3 h-3 text-[#0D99FF]" /> : <Link2Off className="w-3 h-3 text-[#888]" />}
                </button>
              </div>
              {cornersLinked && (
                <div className="mt-1">
                  <PropertyInput label="All" value={element.cornerRadius || 0} onChange={handleCornerRadiusChange} onBlur={pushHistory} />
                </div>
              )}
            </div>
          )}

          {/* Text Properties */}
          {isText && (
            <div>
              <SectionHeader title="Text" action={<StyleMenuButton elementId={element.id} slot="text" kind="text" />} />
              <div className="space-y-2">
                {/* Font family */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Font</span>
                  <select value={element.fontFamily || 'Inter'} onChange={(e) => { pushHistory(); handleTextChange('fontFamily', e.target.value) }} className="flex-1 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]">
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Noto Sans">Noto Sans</option>
                    <option value="Noto Sans SC">Noto Sans SC</option>
                    <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                    <option value="LXGW WenKai">LXGW WenKai</option>
                    <option value="SF Pro Display">SF Pro Display</option>
                    <option value="SF Pro Text">SF Pro Text</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Helvetica Neue">Helvetica Neue</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Menlo">Menlo</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Source Code Pro">Source Code Pro</option>
                    <option value="Sora">Sora</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="monospace">Monospace</option>
                    <option value="system-ui">System UI</option>
                  </select>
                </div>
                {/* Font size + Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#888] w-4 shrink-0 text-right">Sz</span>
                    <input
                      type="text"
                      value={element.fontSize || 18}
                      onChange={(e) => {
                        const num = parseInt(e.target.value)
                        if (!isNaN(num) && num > 0) handleTextChange('fontSize', num)
                      }}
                      onBlur={pushHistory}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          const current = element.fontSize || 18
                          const delta = e.shiftKey ? 10 : 1
                          handleTextChange('fontSize', e.key === 'ArrowUp' ? current + delta : current - delta)
                        }
                      }}
                      className="w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#888] w-4 shrink-0 text-right">Wt</span>
                    <select value={element.fontWeight || 400} onChange={(e) => { pushHistory(); handleTextChange('fontWeight', parseInt(e.target.value)) }} className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]">
                      <option value={100}>Thin (100)</option>
                      <option value={200}>Extra Light (200)</option>
                      <option value={300}>Light (300)</option>
                      <option value={400}>Regular (400)</option>
                      <option value={500}>Medium (500)</option>
                      <option value={600}>Semi Bold (600)</option>
                      <option value={700}>Bold (700)</option>
                      <option value={800}>Extra Bold (800)</option>
                      <option value={900}>Black (900)</option>
                    </select>
                  </div>
                </div>
                {/* Style toggles: Bold, Italic, Underline, Strikethrough (PHASE 10) */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Style</span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => { pushHistory(); handleTextChange('fontWeight', element.fontWeight === 700 ? 400 : 700) }}
                      className={`flex items-center justify-center h-6 w-7 rounded transition-colors ${element.fontWeight === 700 ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { pushHistory(); handleTextChange('fontStyle', element.fontStyle === 'italic' ? 'normal' : 'italic') }}
                      className={`flex items-center justify-center h-6 w-7 rounded transition-colors ${element.fontStyle === 'italic' ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { pushHistory(); handleTextChange('textDecoration', element.textDecoration === 'underline' ? 'none' : 'underline') }}
                      className={`flex items-center justify-center h-6 w-7 rounded transition-colors ${element.textDecoration === 'underline' ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                      title="Underline"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    {/* PHASE 10 — strikethrough */}
                    <button
                      onClick={() => { pushHistory(); handleTextChange('textDecoration', element.textDecoration === 'strikethrough' ? 'none' : 'strikethrough') }}
                      className={`flex items-center justify-center h-6 w-7 rounded transition-colors font-semibold text-[13px] ${element.textDecoration === 'strikethrough' ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                      title="Strikethrough"
                    >
                      <span style={{ textDecoration: 'line-through' }}>S</span>
                    </button>
                  </div>
                </div>
                {/* PHASE 10 — auto-resize + case */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#888] w-8 shrink-0" title="Auto resize">Auto</span>
                    <select
                      value={element.textAutoResize || 'fixed'}
                      onChange={(e) => { pushHistory(); updateElement(element.id, { textAutoResize: e.target.value as 'fixed' | 'hug' | 'grow' }); applyTextAutoSize(element.id) }}
                      className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                      title="Text auto resize — Fixed / Hug contents / Grow with wrapping"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="hug">Hug</option>
                      <option value="grow">Grow</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#888] w-8 shrink-0">Case</span>
                    <select
                      value={element.textCase || 'original'}
                      onChange={(e) => { pushHistory(); updateElement(element.id, { textCase: e.target.value as 'original' | 'upper' | 'lower' | 'title' }) }}
                      className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                      title="Letter case"
                    >
                      <option value="original">Aa</option>
                      <option value="upper">AA</option>
                      <option value="lower">aa</option>
                      <option value="title">Ab Cd</option>
                    </select>
                  </div>
                </div>
                {/* Text alignment with icons */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Align</span>
                  <div className="flex gap-0.5">
                    {([
                      { align: 'left' as const, Icon: AlignLeft },
                      { align: 'center' as const, Icon: AlignCenter },
                      { align: 'right' as const, Icon: AlignRight },
                      { align: 'justified' as const, Icon: AlignJustify },
                    ]).map(({ align, Icon }) => (
                      <button
                        key={align}
                        onClick={() => { pushHistory(); handleTextChange('textAlign', align) }}
                        className={`flex items-center justify-center h-6 w-7 rounded transition-colors ${element.textAlign === align ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                        title={align.charAt(0).toUpperCase() + align.slice(1)}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Line height + Letter spacing */}
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput label="LH" value={element.lineHeight || 1.4} onChange={(v) => { const num = parseFloat(v); if (!isNaN(num) && num > 0) handleTextChange('lineHeight', num) }} onBlur={pushHistory} />
                  <PropertyInput label="LS" value={element.letterSpacing || 0} onChange={(v) => { const num = parseFloat(v); if (!isNaN(num)) handleTextChange('letterSpacing', num) }} onBlur={pushHistory} />
                </div>
                {/* Text color */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Color</span>
                  <div className="flex-1">
                    <ColorPicker color={element.textColor || '#000000'} opacity={element.opacity} onChange={(color) => { pushHistory(); handleTextChange('textColor', color) }} />
                  </div>
                </div>
                {/* Content */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Content</span>
                  <textarea value={element.textContent || ''} onChange={(e) => handleTextChange('textContent', e.target.value)} className="flex-1 h-12 px-1.5 py-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] resize-none" rows={2} />
                </div>
              </div>
            </div>
          )}

          {/* Polygon/Star properties */}
          {(isPolygon || isStar) && (
            <div>
              <SectionHeader title={isStar ? 'Star' : 'Polygon'} />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Sides</span>
                  <input type="range" min="3" max="12" value={element.sides || (isPolygon ? 6 : 5)} onChange={(e) => updateElement(element.id, { sides: parseInt(e.target.value) })} className="flex-1 h-1 accent-[#0D99FF] cursor-pointer" />
                  <input type="text" value={element.sides || (isPolygon ? 6 : 5)} onChange={(e) => { const num = parseInt(e.target.value); if (!isNaN(num) && num >= 3 && num <= 12) updateElement(element.id, { sides: num }) }} className="w-8 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums" />
                </div>
                {isStar && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#888] w-14 shrink-0">Inner R</span>
                    <input type="range" min="10" max="90" value={element.innerRadius || 40} onChange={(e) => updateElement(element.id, { innerRadius: parseInt(e.target.value) })} className="flex-1 h-1 accent-[#0D99FF] cursor-pointer" />
                    <input type="text" value={element.innerRadius || 40} onChange={(e) => { const num = parseInt(e.target.value); if (!isNaN(num) && num >= 10 && num <= 90) updateElement(element.id, { innerRadius: num }) }} className="w-8 h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Arrow properties */}
          {isArrow && (
            <div>
              <SectionHeader title="Arrow" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888] w-14 shrink-0">Head</span>
                  <div className="flex gap-0.5">
                    {(['none', 'arrow', 'circle', 'diamond'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => updateElement(element.id, { arrowHeadStyle: style })}
                        className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${(element.arrowHeadStyle || 'arrow') === style ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}
                        title={style.charAt(0).toUpperCase() + style.slice(1)}
                      >
                        {style === 'arrow' ? '→' : style === 'circle' ? '●' : style === 'diamond' ? '◆' : '—'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Auto Layout */}
          {isFrame && (
            <div>
              <SectionHeader
                title="Auto Layout"
                action={
                  <button
                    className="flex items-center gap-1 h-6 px-2 rounded bg-[#0D99FF] text-white text-[10px] font-medium hover:bg-[#0B87E0] transition-colors"
                    onClick={() => {
                      if (!element.autoLayout) {
                        updateElement(element.id, { autoLayout: { direction: 'vertical', gap: 10, paddingTop: 10, paddingBottom: 10, paddingLeft: 10, paddingRight: 10, alignItems: 'start', justifyContent: 'start' } })
                      } else {
                        updateElement(element.id, { autoLayout: undefined })
                      }
                    }}
                  >
                    {element.autoLayout ? 'Remove' : '+ Add'}
                  </button>
                }
              />
              {element.autoLayout && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#888] w-14 shrink-0">Direction</span>
                    <div className="flex gap-0.5">
                      {(['vertical', 'horizontal'] as const).map((dir) => (
                        <button key={dir} onClick={() => updateElement(element.id, { autoLayout: { ...element.autoLayout!, direction: dir } })} className={`flex items-center justify-center h-6 px-2 rounded text-[10px] transition-colors ${element.autoLayout!.direction === dir ? 'bg-[#0D99FF] text-white' : 'bg-[#1E1E1E] text-[#888] hover:bg-[#3C3C3C]'}`}>
                          {dir.charAt(0).toUpperCase() + dir.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#888] w-14 shrink-0">Gap</span>
                    <input type="text" value={element.autoLayout.gap} onChange={(e) => { const num = parseInt(e.target.value); if (!isNaN(num)) updateElement(element.id, { autoLayout: { ...element.autoLayout!, gap: num } }) }} className="w-16 h-6 px-1.5 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#888] w-14 shrink-0">Padding</span>
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      <PropertyInput label="T" value={element.autoLayout.paddingTop} onChange={(v) => { const num = parseInt(v); if (!isNaN(num)) updateElement(element.id, { autoLayout: { ...element.autoLayout!, paddingTop: num } }) }} />
                      <PropertyInput label="R" value={element.autoLayout.paddingRight} onChange={(v) => { const num = parseInt(v); if (!isNaN(num)) updateElement(element.id, { autoLayout: { ...element.autoLayout!, paddingRight: num } }) }} />
                      <PropertyInput label="B" value={element.autoLayout.paddingBottom} onChange={(v) => { const num = parseInt(v); if (!isNaN(num)) updateElement(element.id, { autoLayout: { ...element.autoLayout!, paddingBottom: num } }) }} />
                      <PropertyInput label="L" value={element.autoLayout.paddingLeft} onChange={(v) => { const num = parseInt(v); if (!isNaN(num)) updateElement(element.id, { autoLayout: { ...element.autoLayout!, paddingLeft: num } }) }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clip Content */}
          {(isFrame || isGroup) && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#888]">Clip Content</span>
              <button
                onClick={() => updateElement(element.id, { clipContent: !element.clipContent })}
                className={`relative w-8 h-4 rounded-full transition-colors ${element.clipContent ? 'bg-[#0D99FF]' : 'bg-[#555]'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${element.clipContent ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          )}

          {/* Constraints (PHASE 9 — Figma-style 9-box picker + dropdowns).
              Only meaningful for children of a frame/group. */}
          {(() => {
            const hasParentFrame = (() => {
              const search = (els: DesignElement[]): boolean =>
                els.some((e) =>
                  (e.type === 'frame' || e.type === 'group') &&
                  (e.children?.some((c) => c.id === element.id) || (e.children ? search(e.children) : false))
                )
              return search(elements)
            })()
            if (!hasParentFrame) return null
            return (
          <div>
            <SectionHeader title="Constraints" />
            <div className="flex items-start gap-3">
              {/* Visual 9-box picker: columns = horizontal, rows = vertical */}
              <div className="grid grid-cols-3 gap-[2px] p-1 rounded bg-[#1E1E1E] border border-[#383838] shrink-0" data-testid="constraints-9box">
                {([
                  { h: 'left', v: 'top' }, { h: 'center', v: 'top' }, { h: 'right', v: 'top' },
                  { h: 'left', v: 'center' }, { h: 'center', v: 'center' }, { h: 'right', v: 'center' },
                  { h: 'left', v: 'bottom' }, { h: 'center', v: 'bottom' }, { h: 'right', v: 'bottom' },
                ] as const).map(({ h, v }) => {
                  const active = (element.constraints?.horizontal || 'left') === h &&
                                 (element.constraints?.vertical || 'top') === v
                  const edgeH = h === 'left' || h === 'right'
                  const edgeV = v === 'top' || v === 'bottom'
                  // draw Figma's pin glyphs: lines for pinned edges, dot for center
                  return (
                    <button
                      key={`${h}-${v}`}
                      className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-[2px] flex items-center justify-center transition-colors ${active ? 'bg-[#0D99FF]/25' : 'hover:bg-[#2C2C2C]'}`}
                      style={{ width: 18, height: 18 }}
                      title={`Horizontal: ${h}, Vertical: ${v}`}
                      onClick={() => updateElement(element.id, {
                        constraints: { horizontal: h, vertical: v },
                        constraintsEdited: true,
                      } as any)}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        {/* horizontal pin */}
                        {h === 'left' && <line x1="1" y1="6" x2="5" y2="6" stroke={active ? '#0D99FF' : '#777'} strokeWidth="1.2" />}
                        {h === 'center' && <circle cx="6" cy="6" r="1.6" fill={active ? '#0D99FF' : '#777'} />}
                        {h === 'right' && <line x1="7" y1="6" x2="11" y2="6" stroke={active ? '#0D99FF' : '#777'} strokeWidth="1.2" />}
                        {/* vertical pin */}
                        {v === 'top' && <line x1="6" y1="1" x2="6" y2="5" stroke={active ? '#0D99FF' : '#777'} strokeWidth="1.2" />}
                        {v === 'center' && h !== 'center' && <circle cx="6" cy="6" r="1.6" fill={active ? '#0D99FF' : '#777'} />}
                        {v === 'bottom' && <line x1="6" y1="7" x2="6" y2="11" stroke={active ? '#0D99FF' : '#777'} strokeWidth="1.2" />}
                        {edgeH && edgeV && <circle cx={h === 'left' ? 1.5 : 10.5} cy={v === 'top' ? 1.5 : 10.5} r="1.1" fill={active ? '#0D99FF' : '#777'} />}
                      </svg>
                    </button>
                  )
                })}
              </div>
              {/* Dropdowns for the two-axis + stretch modes the 9-box can't express */}
              <div className="flex-1 min-w-0 space-y-1">
                <select
                  value={element.constraints?.horizontal || 'left'}
                  onChange={(e) => updateElement(element.id, { constraints: { ...element.constraints, horizontal: e.target.value }, constraintsEdited: true } as any)}
                  className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                >
                  <option value="left">Left</option><option value="right">Right</option><option value="center">Center</option><option value="left-right">Left &amp; Right</option>
                </select>
                <select
                  value={element.constraints?.vertical || 'top'}
                  onChange={(e) => updateElement(element.id, { constraints: { ...element.constraints, vertical: e.target.value }, constraintsEdited: true } as any)}
                  className="w-full h-6 px-1 text-[11px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                >
                  <option value="top">Top</option><option value="bottom">Bottom</option><option value="center">Center</option><option value="top-bottom">Top &amp; Bottom</option>
                </select>
                <div className="text-[9px] text-[#666] leading-3">
                  {element.constraintsEdited ? 'Manual' : 'Auto-inferred from position'}
                </div>
              </div>
            </div>
          </div>
            )
          })()}

          <SectionDivider />

          {/* Effects */}
          <div>
            <SectionHeader title="Effects" action={<StyleMenuButton elementId={element.id} slot="effect" kind="effect" />} />
            <EffectsPanel element={element} />
          </div>

          <SectionDivider />

          {/* Export */}
          <div>
            <SectionHeader title="Export" />
            <ExportPanel element={element} />
          </div>
        </>
      )}
    </div>
  )
}

// Fill layer item
function FillLayerItem({ elementId, fill, index }: { elementId: string; fill: FillStyle; index: number }) {
  const { removeFill, updateFill, pushHistory } = useEditorStore()
  const [showGradient, setShowGradient] = useState(false)

  return (
    <div className="p-1.5 rounded bg-[#1E1E1E] border border-[#383838] mb-1">
      <div className="flex items-center gap-2">
        <select
          value={fill.type}
          onChange={(e) => updateFill(elementId, index, { type: e.target.value as FillStyle['type'] })}
          className="h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#2C2C2C] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
        >
          <option value="solid">Solid</option>
          <option value="linear-gradient">Linear</option>
          <option value="radial-gradient">Radial</option>
        </select>
        {fill.type === 'solid' ? (
          <input
            type="color"
            value={fill.color}
            onChange={(e) => updateFill(elementId, index, { color: e.target.value })}
            className="w-6 h-5 rounded border border-[#555] cursor-pointer bg-transparent"
          />
        ) : (
          <button
            onClick={() => setShowGradient(!showGradient)}
            className="w-6 h-5 rounded border border-[#555] overflow-hidden"
            style={{ background: `linear-gradient(${fill.gradientAngle || 0}deg, ${fill.color}, ${(fill.gradientStops || [])[1]?.color || '#000'})` }}
          />
        )}
        <button onClick={() => { pushHistory(); removeFill(elementId, index) }} className="ml-auto">
          <Trash2 className="w-3 h-3 text-[#F44336]" />
        </button>
      </div>
      {showGradient && fill.type !== 'solid' && fill.gradientStops && (
        <div className="mt-2">
          <GradientEditor
            angle={fill.gradientAngle || 0}
            stops={fill.gradientStops}
            onChange={(angle, stops) => updateFill(elementId, index, { gradientAngle: angle, gradientStops: stops })}
          />
        </div>
      )}
      {/* PHASE 10 — image fill modes: Fill (cover) / Fit (contain) / Crop (manual) */}
      {fill.type === 'image' && fill.imageUrl && (
        <div className="mt-1.5 flex items-center gap-1">
          <select
            value={fill.scaleMode || 'fill'}
            onChange={(e) => updateFill(elementId, index, { scaleMode: e.target.value as 'fill' | 'fit' | 'crop' })}
            className="flex-1 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
            title="Image fill mode"
          >
            <option value="fill">Fill</option>
            <option value="fit">Fit</option>
            <option value="crop">Crop</option>
          </select>
          {(fill.scaleMode || 'fill') === 'crop' && (
            <div className="flex items-center gap-1">
              <input
                type="number" step={0.1} min={0.1}
                value={fill.scale ?? 1}
                onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) updateFill(elementId, index, { scale: n }) }}
                className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
                title="Crop scale"
              />
              <input
                type="number" step={1}
                value={fill.offsetX || 0}
                onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) updateFill(elementId, index, { offsetX: n }) }}
                className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
                title="Crop offset X"
              />
              <input
                type="number" step={1}
                value={fill.offsetY || 0}
                onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) updateFill(elementId, index, { offsetY: n }) }}
                className="w-11 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
                title="Crop offset Y"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Stroke layer item
function StrokeLayerItem({ elementId, stroke, index }: { elementId: string; stroke: StrokeStyle; index: number }) {
  const { removeStroke, updateStroke, pushHistory } = useEditorStore()

  return (
    <div className="p-1.5 rounded bg-[#1E1E1E] border border-[#383838] mb-1">
      <div className="flex items-center gap-2">
        <input type="color" value={stroke.color} onChange={(e) => updateStroke(elementId, index, { color: e.target.value })} className="w-6 h-5 rounded border border-[#555] cursor-pointer bg-transparent" />
        <input type="text" value={stroke.width} onChange={(e) => { const num = parseFloat(e.target.value); if (!isNaN(num) && num >= 0) updateStroke(elementId, index, { width: num }) }} className="w-10 h-5 px-1 text-[10px] border border-[#383838] rounded-sm bg-[#2C2C2C] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums" />
        <button onClick={() => { pushHistory(); removeStroke(elementId, index) }} className="ml-auto">
          <Trash2 className="w-3 h-3 text-[#F44336]" />
        </button>
      </div>
    </div>
  )
}
