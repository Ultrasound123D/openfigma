'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'
import { PropertiesPanel } from './PropertiesPanel'
import { ComponentPanel } from './ComponentPanel'
import { Plus, ArrowRight, MousePointer2, Zap, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

export function RightSidebar() {
  const { rightTab, setRightTab, elements, selectedElementIds, addComponent, createInstance, pushHistory } = useEditorStore()
  const [interactionTrigger, setInteractionTrigger] = useState<'click' | 'hover' | 'drag'>('click')
  const [interactionTarget, setInteractionTarget] = useState<string>('')

  const selectedElement = selectedElementIds.length === 1
    ? findElementInList(elements, selectedElementIds[0])
    : null

  const frames = elements.filter(el => el.type === 'frame')
  const components = elements.filter(el => el.isComponent)

  return (
    <div className="h-full bg-[#252525] flex flex-col border-l border-[#383838] select-none">
      {/* Tabs */}
      <div className="flex border-b border-[#383838] shrink-0">
        <button
          onClick={() => setRightTab('design')}
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors duration-100 uppercase tracking-wider ${
            rightTab === 'design' ? 'text-white border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#CCC]'
          }`}
        >
          Design
        </button>
        <button
          onClick={() => setRightTab('prototype')}
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors duration-100 uppercase tracking-wider ${
            rightTab === 'prototype' ? 'text-white border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#CCC]'
          }`}
        >
          Prototype
        </button>
        <button
          onClick={() => setRightTab('inspect')}
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors duration-100 uppercase tracking-wider ${
            rightTab === 'inspect' ? 'text-white border-b-2 border-[#0D99FF]' : 'text-[#888] hover:text-[#CCC]'
          }`}
        >
          Inspect
        </button>
      </div>

      {/* Design Tab */}
      {rightTab === 'design' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <PropertiesPanel />
        </div>
      )}

      {/* Prototype Tab */}
      {rightTab === 'prototype' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {selectedElement ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Interactions</span>
                <button className="flex items-center justify-center w-5 h-5 rounded bg-[#0D99FF] text-white hover:bg-[#0B87E0] transition-colors duration-100">
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Trigger selection */}
              <div>
                <span className="text-[10px] text-[#888] mb-0.5 block">Trigger</span>
                <select
                  value={interactionTrigger}
                  onChange={(e) => setInteractionTrigger(e.target.value as any)}
                  className="w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                >
                  <option value="click">On Click</option>
                  <option value="hover">On Hover</option>
                  <option value="drag">On Drag</option>
                </select>
              </div>

              {/* Action */}
              <div>
                <span className="text-[10px] text-[#888] mb-1 block">Action</span>
                <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#1E1E1E] border border-[#383838]">
                  <ArrowRight className="w-3 h-3 text-[#0D99FF]" />
                  <span className="text-[11px] text-[#CCC]">Navigate to</span>
                </div>
              </div>

              {/* Target frame */}
              <div>
                <span className="text-[10px] text-[#888] mb-0.5 block">Destination</span>
                <select
                  value={interactionTarget}
                  onChange={(e) => setInteractionTarget(e.target.value)}
                  className="w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]"
                >
                  <option value="">Select frame...</option>
                  {frames.map(frame => (
                    <option key={frame.id} value={frame.id}>{frame.name}</option>
                  ))}
                </select>
              </div>

              {/* Animation */}
              <div>
                <span className="text-[10px] text-[#888] mb-0.5 block">Animation</span>
                <select className="w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]">
                  <option value="instant">Instant</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="smart-animate">Smart Animate</option>
                  <option value="move-in">Move In</option>
                  <option value="move-out">Move Out</option>
                  <option value="push">Push</option>
                  <option value="slide-in">Slide In</option>
                </select>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888] w-14 shrink-0">Duration</span>
                <input type="text" defaultValue="300" className="w-14 h-6 px-1 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF] tabular-nums" />
                <span className="text-[9px] text-[#888]">ms</span>
              </div>

              {/* Easing */}
              <div>
                <span className="text-[10px] text-[#888] mb-0.5 block">Easing</span>
                <select className="w-full h-6 px-1.5 text-[11px] border border-[#383838] rounded bg-[#1E1E1E] text-[#DDD] focus:outline-none focus:border-[#0D99FF]">
                  <option value="ease">Ease In Out</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="linear">Linear</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full bg-[#2C2C2C] flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-[#666]" />
                </div>
                <p className="text-[10px] text-[#888] mb-0.5">No interactions</p>
                <p className="text-[9px] text-[#666]">Select an element to add interactions</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspect Tab */}
      {rightTab === 'inspect' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {selectedElement ? (
            <InspectPanel element={selectedElement} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MousePointer2 className="w-5 h-5 text-[#666] mx-auto mb-1.5" />
                <p className="text-[10px] text-[#888]">Select an element to inspect</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================
// Copy to clipboard hook
// =============================================

function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  return { copy, copiedId }
}

// =============================================
// Code generators
// =============================================

function generateCSS(element: any): string {
  const lines: string[] = []
  lines.push(`/* ${element.name} */`)
  lines.push(`.${sanitizeClassName(element.name)} {`)
  lines.push(`  position: absolute;`)
  lines.push(`  left: ${Math.round(element.x)}px;`)
  lines.push(`  top: ${Math.round(element.y)}px;`)
  lines.push(`  width: ${Math.round(element.width)}px;`)
  lines.push(`  height: ${Math.round(element.height)}px;`)

  if (element.fill && element.fill !== 'transparent') {
    lines.push(`  background: ${element.fill};`)
  }
  if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
    lines.push(`  border: ${element.strokeWidth}px solid ${element.stroke};`)
  }
  if (element.strokeStyle === 'dashed') {
    lines.push(`  border-style: dashed;`)
  } else if (element.strokeStyle === 'dotted') {
    lines.push(`  border-style: dotted;`)
  }
  if (element.cornerRadius > 0) {
    const r = element.cornerRadius
    if (element.cornerRadiusTL === element.cornerRadiusTR && element.cornerRadiusTL === element.cornerRadiusBL && element.cornerRadiusTL === element.cornerRadiusBR) {
      lines.push(`  border-radius: ${r}px;`)
    } else {
      lines.push(`  border-radius: ${element.cornerRadiusTL}px ${element.cornerRadiusTR}px ${element.cornerRadiusBR}px ${element.cornerRadiusBL}px;`)
    }
  }
  if (element.opacity < 100) {
    lines.push(`  opacity: ${(element.opacity / 100).toFixed(2)};`)
  }
  if (element.rotation) {
    lines.push(`  transform: rotate(${element.rotation}deg);`)
  }
  if (element.blendMode && element.blendMode !== 'normal') {
    lines.push(`  mix-blend-mode: ${element.blendMode};`)
  }
  if (element.shadows?.length > 0) {
    const shadowCSS = element.shadows.filter((s: any) => s.visible).map((s: any) => {
      const inset = s.type === 'inner-shadow' ? 'inset ' : ''
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`
    }).join(', ')
    if (shadowCSS) lines.push(`  box-shadow: ${shadowCSS};`)
  }
  if (element.type === 'text') {
    if (element.fontFamily) lines.push(`  font-family: '${element.fontFamily}', sans-serif;`)
    if (element.fontSize) lines.push(`  font-size: ${element.fontSize}px;`)
    if (element.fontWeight) lines.push(`  font-weight: ${element.fontWeight};`)
    if (element.fontStyle === 'italic') lines.push(`  font-style: italic;`)
    if (element.textDecoration === 'underline') lines.push(`  text-decoration: underline;`)
    if (element.textAlign) lines.push(`  text-align: ${element.textAlign};`)
    if (element.lineHeight) lines.push(`  line-height: ${element.lineHeight};`)
    if (element.letterSpacing) lines.push(`  letter-spacing: ${element.letterSpacing}px;`)
    if (element.textColor) lines.push(`  color: ${element.textColor};`)
    lines.push(`  white-space: pre-wrap;`)
  }
  if (element.flipH || element.flipV) {
    const scaleX = element.flipH ? -1 : 1
    const scaleY = element.flipV ? -1 : 1
    const existingTransform = element.rotation ? ` rotate(${element.rotation}deg)` : ''
    lines.push(`  transform: scale(${scaleX}, ${scaleY})${existingTransform};`)
  }
  lines.push(`}`)
  return lines.join('\n')
}

function generateSwiftUI(element: any): string {
  const lines: string[] = []
  const name = sanitizeSwiftName(element.name)

  if (element.type === 'text') {
    lines.push(`// ${element.name}`)
    lines.push(`Text("${element.textContent || 'Text'}")`)
    if (element.fontFamily || element.fontSize) {
      lines.push(`    .font(.system(size: ${element.fontSize || 16}, weight: .${mapFontWeight(element.fontWeight)}, design: .default))`)
    }
    if (element.textColor) {
      lines.push(`    .foregroundColor(Color(hex: "${element.textColor}"))`)
    }
    if (element.textAlign === 'center') {
      lines.push(`    .multilineTextAlignment(.center)`)
    } else if (element.textAlign === 'right') {
      lines.push(`    .multilineTextAlignment(.trailing)`)
    }
    lines.push(`    .frame(width: ${Math.round(element.width)}, height: ${Math.round(element.height)}, alignment: .${mapAlignment(element.textAlign)})`)
    if (element.opacity < 100) {
      lines.push(`    .opacity(${(element.opacity / 100).toFixed(2)})`)
    }
  } else if (element.type === 'ellipse') {
    lines.push(`// ${element.name}`)
    lines.push(`Circle()`)
    if (element.fill && element.fill !== 'transparent') {
      lines.push(`    .fill(Color(hex: "${element.fill}"))`)
    }
    lines.push(`    .frame(width: ${Math.round(element.width)}, height: ${Math.round(element.height)})`)
    if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
      lines.push(`    .overlay(Circle().stroke(Color(hex: "${element.stroke}"), lineWidth: ${element.strokeWidth}))`)
    }
    if (element.opacity < 100) {
      lines.push(`    .opacity(${(element.opacity / 100).toFixed(2)})`)
    }
  } else {
    lines.push(`// ${element.name}`)
    lines.push(`RoundedRectangle(cornerRadius: ${element.cornerRadius || 0})`)
    if (element.fill && element.fill !== 'transparent') {
      lines.push(`    .fill(Color(hex: "${element.fill}"))`)
    } else {
      lines.push(`    .fill(Color.clear)`)
    }
    lines.push(`    .frame(width: ${Math.round(element.width)}, height: ${Math.round(element.height)})`)
    if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
      lines.push(`    .overlay(RoundedRectangle(cornerRadius: ${element.cornerRadius || 0}).stroke(Color(hex: "${element.stroke}"), lineWidth: ${element.strokeWidth}))`)
    }
    if (element.shadows?.length > 0) {
      const shadow = element.shadows.find((s: any) => s.visible)
      if (shadow) {
        lines.push(`    .shadow(color: Color(hex: "${shadow.color}").opacity(${(shadow.opacity / 100).toFixed(2)}), radius: ${shadow.blur}, x: ${shadow.x}, y: ${shadow.y})`)
      }
    }
    if (element.opacity < 100) {
      lines.push(`    .opacity(${(element.opacity / 100).toFixed(2)})`)
    }
    if (element.rotation) {
      lines.push(`    .rotationEffect(.degrees(${element.rotation}))`)
    }
  }

  lines.push(`    .position(x: ${Math.round(element.x + element.width / 2)}, y: ${Math.round(element.y + element.height / 2)})`)

  return lines.join('\n')
}

function generateAndroidXML(element: any): string {
  const lines: string[] = []
  lines.push(`<!-- ${element.name} -->`)

  if (element.type === 'text') {
    lines.push(`<TextView`)
    lines.push(`    android:layout_width="${Math.round(element.width)}dp"`)
    lines.push(`    android:layout_height="${Math.round(element.height)}dp"`)
    lines.push(`    android:layout_marginStart="${Math.round(element.x)}dp"`)
    lines.push(`    android:layout_marginTop="${Math.round(element.y)}dp"`)
    lines.push(`    android:text="${element.textContent || 'Text'}"`)
    if (element.textColor) {
      lines.push(`    android:textColor="${element.textColor}"`)
    }
    if (element.fontSize) {
      lines.push(`    android:textSize="${element.fontSize}sp"`)
    }
    if (element.fontWeight && element.fontWeight >= 700) {
      lines.push(`    android:textStyle="bold"`)
    } else if (element.fontStyle === 'italic') {
      lines.push(`    android:textStyle="italic"`)
    }
    if (element.textAlign === 'center') {
      lines.push(`    android:gravity="center"`)
    } else if (element.textAlign === 'right') {
      lines.push(`    android:gravity="end"`)
    } else {
      lines.push(`    android:gravity="start"`)
    }
    if (element.letterSpacing) {
      lines.push(`    android:letterSpacing="${element.letterSpacing}"`)
    }
    if (element.opacity < 100) {
      lines.push(`    android:alpha="${(element.opacity / 100).toFixed(2)}"`)
    }
    lines.push(`    android:fontFamily="${element.fontFamily || 'sans-serif'}" />`)
  } else if (element.type === 'ellipse') {
    lines.push(`<shape xmlns:android="http://schemas.android.com/apk/res/android"`)
    lines.push(`    android:shape="oval">`)
    if (element.fill && element.fill !== 'transparent') {
      lines.push(`    <solid android:color="${element.fill}" />`)
    }
    if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
      lines.push(`    <stroke android:width="${element.strokeWidth}dp" android:color="${element.stroke}" />`)
    }
    lines.push(`</shape>`)
    lines.push(``)
    lines.push(`<!-- Usage in layout:`)
    lines.push(`<View`)
    lines.push(`    android:layout_width="${Math.round(element.width)}dp"`)
    lines.push(`    android:layout_height="${Math.round(element.height)}dp"`)
    lines.push(`    android:layout_marginStart="${Math.round(element.x)}dp"`)
    lines.push(`    android:layout_marginTop="${Math.round(element.y)}dp"`)
    lines.push(`    android:background="@drawable/${sanitizeAndroidName(element.name)}" />`)
    lines.push(`-->`)
  } else {
    lines.push(`<com.google.android.material.card.MaterialCardView`)
    lines.push(`    android:layout_width="${Math.round(element.width)}dp"`)
    lines.push(`    android:layout_height="${Math.round(element.height)}dp"`)
    lines.push(`    android:layout_marginStart="${Math.round(element.x)}dp"`)
    lines.push(`    android:layout_marginTop="${Math.round(element.y)}dp"`)
    if (element.fill && element.fill !== 'transparent') {
      lines.push(`    app:cardBackgroundColor="${element.fill}"`)
    }
    if (element.cornerRadius > 0) {
      lines.push(`    app:cardCornerRadius="${element.cornerRadius}dp"`)
    }
    if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
      lines.push(`    app:cardStrokeWidth="${element.strokeWidth}dp"`)
      lines.push(`    app:cardStrokeColor="${element.stroke}"`)
    }
    if (element.opacity < 100) {
      lines.push(`    android:alpha="${(element.opacity / 100).toFixed(2)}"`)
    }
    if (element.shadows?.length > 0) {
      const shadow = element.shadows.find((s: any) => s.visible)
      if (shadow) {
        lines.push(`    app:cardElevation="${Math.round(shadow.blur / 2)}dp"`)
      }
    }
    lines.push(`    app:layout_constraintStart_toStartOf="parent"`)
    lines.push(`    app:layout_constraintTop_toTopOf="parent" />`)
  }

  return lines.join('\n')
}

// Helpers
function sanitizeClassName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function sanitizeSwiftName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '_$&')
}

function sanitizeAndroidName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function mapFontWeight(weight: number | undefined): string {
  if (!weight) return 'regular'
  if (weight >= 800) return 'heavy'
  if (weight >= 700) return 'bold'
  if (weight >= 600) return 'semibold'
  if (weight >= 500) return 'medium'
  return 'regular'
}

function mapAlignment(align: string | undefined): string {
  if (align === 'center') return 'center'
  if (align === 'right') return 'trailing'
  return 'leading'
}

// =============================================
// Enhanced InspectPanel
// =============================================

function InspectPanel({ element }: { element: any }) {
  const { copy, copiedId } = useCopyToClipboard()
  const [codeTab, setCodeTab] = useState<'css' | 'swiftui' | 'android'>('css')
  const [colorsExpanded, setColorsExpanded] = useState(true)
  const [typographyExpanded, setTypographyExpanded] = useState(true)
  const [layoutExpanded, setLayoutExpanded] = useState(true)
  const [codeExpanded, setCodeExpanded] = useState(true)

  // Collect all relevant colors from the element
  const elementColors: { label: string; color: string }[] = []
  if (element.fill && element.fill !== 'transparent') {
    elementColors.push({ label: 'Fill', color: element.fill })
  }
  if (element.fills?.length) {
    element.fills.forEach((f: any, i: number) => {
      if (f.color && f.color !== 'transparent') {
        elementColors.push({ label: `Fill ${i + 1}`, color: f.color })
      }
    })
  }
  if (element.stroke && element.stroke !== 'transparent' && element.strokeWidth > 0) {
    elementColors.push({ label: 'Stroke', color: element.stroke })
  }
  if (element.textColor) {
    elementColors.push({ label: 'Text', color: element.textColor })
  }
  if (element.shadows?.length) {
    element.shadows.forEach((s: any, i: number) => {
      if (s.visible && s.color) {
        elementColors.push({ label: `Shadow ${i + 1}`, color: s.color })
      }
    })
  }

  // Determine code output based on tab
  const codeOutput = codeTab === 'css'
    ? generateCSS(element)
    : codeTab === 'swiftui'
    ? generateSwiftUI(element)
    : generateAndroidXML(element)

  const codeLanguage = codeTab === 'css' ? 'CSS' : codeTab === 'swiftui' ? 'SwiftUI' : 'Android XML'

  return (
    <div className="space-y-2">
      {/* Element header */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-white">{element.type.charAt(0).toUpperCase() + element.type.slice(1)}</span>
        <span className="text-[10px] text-[#666]">{element.name}</span>
      </div>

      {/* Layout Section */}
      <div className="border border-[#383838] rounded-md overflow-hidden">
        <button
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-[#2A2A2A] hover:bg-[#333] transition-colors"
          onClick={() => setLayoutExpanded(!layoutExpanded)}
        >
          {layoutExpanded ? (
            <ChevronDown className="w-3 h-3 text-[#888]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#888]" />
          )}
          <span className="text-[10px] font-semibold text-[#AAA] uppercase tracking-wider">Layout</span>
        </button>
        {layoutExpanded && (
          <div className="p-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <LayoutField label="X" value={Math.round(element.x)} unit="px" />
              <LayoutField label="Y" value={Math.round(element.y)} unit="px" />
              <LayoutField label="W" value={Math.round(element.width)} unit="px" />
              <LayoutField label="H" value={Math.round(element.height)} unit="px" />
            </div>
            {element.rotation ? (
              <div className="mt-1.5">
                <LayoutField label="R" value={Math.round(element.rotation)} unit="°" />
              </div>
            ) : null}
            {element.cornerRadius > 0 && (
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {element.cornerRadiusTL === element.cornerRadiusTR && element.cornerRadiusTL === element.cornerRadiusBL && element.cornerRadiusTL === element.cornerRadiusBR ? (
                  <LayoutField label="Radius" value={element.cornerRadius} unit="px" />
                ) : (
                  <>
                    <LayoutField label="TL" value={element.cornerRadiusTL} unit="px" />
                    <LayoutField label="TR" value={element.cornerRadiusTR} unit="px" />
                    <LayoutField label="BL" value={element.cornerRadiusBL} unit="px" />
                    <LayoutField label="BR" value={element.cornerRadiusBR} unit="px" />
                  </>
                )}
              </div>
            )}
            <div className="mt-1.5 flex gap-3">
              {element.opacity < 100 && (
                <LayoutField label="Opacity" value={element.opacity} unit="%" />
              )}
              {element.blendMode && element.blendMode !== 'normal' && (
                <span className="text-[10px] text-[#888]">Blend: <span className="text-[#CCC]">{element.blendMode}</span></span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Colors Section */}
      {elementColors.length > 0 && (
        <div className="border border-[#383838] rounded-md overflow-hidden">
          <button
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-[#2A2A2A] hover:bg-[#333] transition-colors"
            onClick={() => setColorsExpanded(!colorsExpanded)}
          >
            {colorsExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#888]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#888]" />
            )}
            <span className="text-[10px] font-semibold text-[#AAA] uppercase tracking-wider">Colors</span>
            <span className="text-[9px] text-[#555] ml-auto">{elementColors.length}</span>
          </button>
          {colorsExpanded && (
            <div className="p-2.5 space-y-1">
              {elementColors.map((item, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 w-full px-1.5 py-1 rounded hover:bg-[#333] transition-colors group"
                  onClick={() => copy(item.color.toUpperCase(), `color-${i}`)}
                  title="Click to copy hex value"
                >
                  <div
                    className="w-5 h-5 rounded border border-[#555]/50 shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-[#888] w-14 text-left shrink-0">{item.label}</span>
                  <span className="text-[11px] text-[#CCC] font-mono flex-1 text-left">
                    {item.color.toUpperCase()}
                  </span>
                  {copiedId === `color-${i}` ? (
                    <Check className="w-3 h-3 text-[#4CAF50] shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#555] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Typography Section (for text elements) */}
      {element.type === 'text' && (
        <div className="border border-[#383838] rounded-md overflow-hidden">
          <button
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-[#2A2A2A] hover:bg-[#333] transition-colors"
            onClick={() => setTypographyExpanded(!typographyExpanded)}
          >
            {typographyExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#888]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#888]" />
            )}
            <span className="text-[10px] font-semibold text-[#AAA] uppercase tracking-wider">Typography</span>
          </button>
          {typographyExpanded && (
            <div className="p-2.5 space-y-1">
              {element.fontFamily && (
                <TypographyRow label="Family" value={element.fontFamily} onCopy={() => copy(element.fontFamily, 'font-family')} copied={copiedId === 'font-family'} />
              )}
              {element.fontSize && (
                <TypographyRow label="Size" value={`${element.fontSize}px`} onCopy={() => copy(`${element.fontSize}px`, 'font-size')} copied={copiedId === 'font-size'} />
              )}
              {element.fontWeight && (
                <TypographyRow label="Weight" value={`${element.fontWeight}`} onCopy={() => copy(`${element.fontWeight}`, 'font-weight')} copied={copiedId === 'font-weight'} />
              )}
              {element.lineHeight && (
                <TypographyRow label="Line Height" value={`${element.lineHeight}`} onCopy={() => copy(`${element.lineHeight}`, 'line-height')} copied={copiedId === 'line-height'} />
              )}
              {element.letterSpacing !== undefined && element.letterSpacing !== 0 && (
                <TypographyRow label="Letter Spacing" value={`${element.letterSpacing}px`} onCopy={() => copy(`${element.letterSpacing}px`, 'letter-spacing')} copied={copiedId === 'letter-spacing'} />
              )}
              {element.textAlign && (
                <TypographyRow label="Align" value={element.textAlign} onCopy={() => copy(element.textAlign, 'text-align')} copied={copiedId === 'text-align'} />
              )}
              {element.fontStyle && element.fontStyle !== 'normal' && (
                <TypographyRow label="Style" value={element.fontStyle} onCopy={() => copy(element.fontStyle, 'font-style')} copied={copiedId === 'font-style'} />
              )}
              {element.textDecoration && element.textDecoration !== 'none' && (
                <TypographyRow label="Decoration" value={element.textDecoration} onCopy={() => copy(element.textDecoration, 'text-decoration')} copied={copiedId === 'text-decoration'} />
              )}
              {element.textContent && (
                <div className="pt-1 border-t border-[#383838]">
                  <span className="text-[10px] text-[#666] block mb-0.5">Content</span>
                  <span className="text-[11px] text-[#CCC] break-all">&quot;{element.textContent}&quot;</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Code Section */}
      <div className="border border-[#383838] rounded-md overflow-hidden">
        <button
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 bg-[#2A2A2A] hover:bg-[#333] transition-colors"
          onClick={() => setCodeExpanded(!codeExpanded)}
        >
          {codeExpanded ? (
            <ChevronDown className="w-3 h-3 text-[#888]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#888]" />
          )}
          <span className="text-[10px] font-semibold text-[#AAA] uppercase tracking-wider">Code</span>
        </button>
        {codeExpanded && (
          <div className="p-2.5">
            {/* Code tab buttons */}
            <div className="flex gap-1 mb-2">
              {(['css', 'swiftui', 'android'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCodeTab(tab)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${
                    codeTab === tab
                      ? 'bg-[#0D99FF] text-white'
                      : 'bg-[#1E1E1E] text-[#888] hover:text-[#CCC] border border-[#383838]'
                  }`}
                >
                  {tab === 'css' ? 'CSS' : tab === 'swiftui' ? 'SwiftUI' : 'Android'}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="relative">
              <pre className="text-[10px] text-[#CCC] bg-[#1A1A1A] p-2.5 rounded border border-[#333] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                {codeOutput}
              </pre>
              <button
                onClick={() => copy(codeOutput, `code-${codeTab}`)}
                className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded bg-[#333] hover:bg-[#444] text-[#AAA] hover:text-white transition-colors"
                title={`Copy ${codeLanguage} code`}
              >
                {copiedId === `code-${codeTab}` ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-[#4CAF50]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-2.5 h-2.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// Sub-components
// =============================================

function LayoutField({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1E1E1E] rounded">
      <span className="text-[9px] font-semibold text-[#0D99FF] w-3 shrink-0">{label}</span>
      <span className="text-[11px] text-[#CCC] tabular-nums flex-1">{value}</span>
      <span className="text-[9px] text-[#555]">{unit}</span>
    </div>
  )
}

function TypographyRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <button
      className="flex items-center gap-2 w-full px-1.5 py-0.5 rounded hover:bg-[#333] transition-colors group"
      onClick={onCopy}
      title="Click to copy"
    >
      <span className="text-[10px] text-[#888] w-20 text-left shrink-0">{label}</span>
      <span className="text-[11px] text-[#CCC] flex-1 text-left font-mono">{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-[#4CAF50] shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-[#555] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  )
}
