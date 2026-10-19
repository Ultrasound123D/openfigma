'use client'

import React from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { useEditorStore, ShadowEffect, BlurEffect, DesignElement } from '@/store/editor-store'
import { ColorPicker } from './ColorPicker'

interface EffectsPanelProps {
  element: DesignElement
}

export function EffectsPanel({ element }: EffectsPanelProps) {
  const { addEffect, removeEffect, updateEffect, pushHistory } = useEditorStore()
  const shadows = element.shadows || []
  const blurs = element.blurs || []
  const totalEffects = shadows.length + blurs.length

  const handleAddShadow = (type: 'drop-shadow' | 'inner-shadow') => {
    pushHistory()
    const effect: ShadowEffect = {
      type,
      x: 0,
      y: 4,
      blur: 12,
      spread: 0,
      color: '#000000',
      opacity: 25,
      visible: true,
    }
    addEffect(element.id, effect)
  }

  const handleAddBlur = (type: 'blur' | 'background-blur') => {
    pushHistory()
    const effect: BlurEffect = {
      type,
      radius: 4,
      visible: true,
    }
    addEffect(element.id, effect)
  }

  return (
    <div>
      {/* Add effect buttons */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => handleAddShadow('drop-shadow')}
          className="flex items-center gap-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]"
        >
          <Plus className="w-3 h-3" />
          Drop Shadow
        </button>
        <button
          onClick={() => handleAddShadow('inner-shadow')}
          className="flex items-center gap-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]"
        >
          <Plus className="w-3 h-3" />
          Inner Shadow
        </button>
        <button
          onClick={() => handleAddBlur('blur')}
          className="flex items-center gap-1 h-6 px-2 rounded bg-[#1E1E1E] text-[10px] text-[#888] hover:bg-[#3C3C3C] hover:text-white transition-colors border border-[#383838]"
        >
          <Plus className="w-3 h-3" />
          Blur
        </button>
      </div>

      {/* Effect list */}
      {totalEffects === 0 && (
        <div className="flex items-center justify-center py-2 text-[11px] text-[#666]">
          No effects
        </div>
      )}

      {shadows.map((shadow, i) => (
        <div key={`shadow-${i}`} className="bg-[#1E1E1E] border border-[#383838] rounded p-2 mb-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-[#CCC]">
              {shadow.type === 'drop-shadow' ? 'Drop Shadow' : 'Inner Shadow'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateEffect(element.id, i, { visible: !shadow.visible })}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
              >
                {shadow.visible ? (
                  <Eye className="w-3 h-3 text-[#888]" />
                ) : (
                  <EyeOff className="w-3 h-3 text-[#F44336]" />
                )}
              </button>
              <button
                onClick={() => { pushHistory(); removeEffect(element.id, i) }}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
              >
                <Trash2 className="w-3 h-3 text-[#F44336]" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#888] w-4">X</span>
              <input
                type="text"
                value={shadow.x}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) updateEffect(element.id, i, { x: v })
                }}
                className="w-full h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#888] w-4">Y</span>
              <input
                type="text"
                value={shadow.y}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) updateEffect(element.id, i, { y: v })
                }}
                className="w-full h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#888] w-4">B</span>
              <input
                type="text"
                value={shadow.blur}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v) && v >= 0) updateEffect(element.id, i, { blur: v })
                }}
                className="w-full h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#888] w-4">S</span>
              <input
                type="text"
                value={shadow.spread}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) updateEffect(element.id, i, { spread: v })
                }}
                className="w-full h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <ColorPicker
              color={shadow.color}
              opacity={shadow.opacity}
              onChange={(color, opacity) => updateEffect(element.id, i, { color, opacity })}
            />
          </div>
        </div>
      ))}

      {blurs.map((blur, i) => (
        <div key={`blur-${i}`} className="bg-[#1E1E1E] border border-[#383838] rounded p-2 mb-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-[#CCC]">
              {blur.type === 'blur' ? 'Blur' : 'Background Blur'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateEffect(element.id, shadows.length + i, { visible: !blur.visible })}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
              >
                {blur.visible ? (
                  <Eye className="w-3 h-3 text-[#888]" />
                ) : (
                  <EyeOff className="w-3 h-3 text-[#F44336]" />
                )}
              </button>
              <button
                onClick={() => { pushHistory(); removeEffect(element.id, shadows.length + i) }}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#3C3C3C]"
              >
                <Trash2 className="w-3 h-3 text-[#F44336]" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#888] w-8">Radius</span>
            <input
              type="range"
              min="0"
              max="50"
              value={blur.radius}
              onChange={(e) => updateEffect(element.id, shadows.length + i, { radius: parseInt(e.target.value) })}
              className="flex-1 h-1 accent-[#0D99FF] cursor-pointer"
            />
            <input
              type="text"
              value={blur.radius}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v >= 0) updateEffect(element.id, shadows.length + i, { radius: v })
              }}
              className="w-8 h-5 px-1 text-[10px] border border-[#555] rounded bg-[#1E1E1E] text-[#DDD] text-center focus:outline-none focus:border-[#0D99FF] tabular-nums"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
