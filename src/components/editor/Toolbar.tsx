'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  MousePointer2,
  Square,
  Frame,
  PenTool,
  Type,
  MessageCircle,
  Hand,
  Circle,
  Minus,
  Star,
  Hexagon,
  Pencil,
  Pipette,
  Scissors,
  ChevronDown,
  ChevronUp,
  Image,
  Move,
  MoreHorizontal,
  Scaling,
} from 'lucide-react'
import { useEditorStore, ToolType } from '@/store/editor-store'
// PHASE 8 — view options popup
import { ViewOptionsPopup } from './ViewOptionsPopup'

interface ToolDef {
  type: ToolType
  icon: React.ElementType
  label: string
  shortcut: string
}

interface ToolGroup {
  tools: ToolDef[]
  moreTools?: ToolDef[]
  label: string
}

// Tool groups matching Figma's toolbar layout with "more" dropdowns
const toolGroups: ToolGroup[] = [
  {
    label: 'Navigation',
    tools: [
      { type: 'move', icon: MousePointer2, label: 'Move', shortcut: 'V' },
      { type: 'frame', icon: Frame, label: 'Frame', shortcut: 'F' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { type: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
      { type: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'O' },
      { type: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
    ],
    moreTools: [
      { type: 'polygon', icon: Hexagon, label: 'Polygon', shortcut: 'Shift+R' },
      { type: 'star', icon: Star, label: 'Star', shortcut: 'Shift+O' },
      { type: 'arrow', icon: Move, label: 'Arrow', shortcut: 'Shift+L' },
    ],
  },
  {
    label: 'Pen',
    tools: [
      { type: 'pen', icon: PenTool, label: 'Pen', shortcut: 'P' },
      { type: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'Shift+P' },
    ],
  },
  {
    label: 'Text',
    tools: [
      { type: 'text', icon: Type, label: 'Text', shortcut: 'T' },
    ],
  },
  {
    label: 'Image',
    tools: [
      { type: 'image', icon: Image, label: 'Image', shortcut: 'Shift+I' },
    ],
  },
  {
    label: 'Tools',
    tools: [
      { type: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
      { type: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
    ],
    moreTools: [
      { type: 'scale', icon: Scaling, label: 'Scale', shortcut: 'K' },
      { type: 'comment', icon: MessageCircle, label: 'Comment', shortcut: 'C' },
      { type: 'slice', icon: Scissors, label: 'Slice', shortcut: 'S' },
    ],
  },
]

type EditorMode = 'design' | 'prototype' | 'dev'

// Contextual tool options shown above toolbar when a tool is active
const toolOptions: Partial<Record<ToolType, { label: string; options: { id: string; label: string; type: 'toggle' | 'button' | 'select'; items?: string[] }[] }>> = {
  pen: {
    label: 'Pen',
    options: [
      { id: 'pen-mode', label: 'Straight', type: 'button' },
      { id: 'pen-mirror', label: 'Mirror', type: 'toggle' },
      { id: 'pen-bezier', label: 'Bezier', type: 'toggle' },
    ],
  },
  pencil: {
    label: 'Pencil',
    options: [
      { id: 'pencil-smooth', label: 'Smooth', type: 'toggle' },
    ],
  },
  rectangle: {
    label: 'Rectangle',
    options: [
      { id: 'rect-corner', label: 'Corner Radius', type: 'button' },
    ],
  },
  text: {
    label: 'Text',
    options: [
      { id: 'text-fixed', label: 'Fixed Size', type: 'toggle' },
      { id: 'text-auto', label: 'Auto Width', type: 'toggle' },
    ],
  },
  move: {
    label: 'Move',
    options: [
      { id: 'move-deep', label: 'Deep Select', type: 'toggle' },
    ],
  },
  ellipse: {
    label: 'Ellipse',
    options: [
      { id: 'ellipse-pie', label: 'Pie', type: 'toggle' },
    ],
  },
  line: {
    label: 'Line',
    options: [
      { id: 'line-arrow', label: 'Arrow', type: 'toggle' },
    ],
  },
  hand: {
    label: 'Hand',
    options: [],
  },
}

export function Toolbar() {
  const { activeTool, setActiveTool, editorMode, setEditorMode, zoom, setZoom, setPan } = useEditorStore()
  // PHASE 8 — view options popup
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false)
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null)
  const [toolOptionsMenuOpen, setToolOptionsMenuOpen] = useState(false)
  const [penBezierEnabled, setPenBezierEnabled] = useState(true)
  const [penMirrorEnabled, setPenMirrorEnabled] = useState(false)
  const [pencilSmoothEnabled, setPencilSmoothEnabled] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuIdx(null)
        setToolOptionsMenuOpen(false)
      }
    }
    if (openMenuIdx !== null || toolOptionsMenuOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [openMenuIdx, toolOptionsMenuOpen])

  const currentToolOptions = toolOptions[activeTool]

  // Check if any tool in a group or its moreTools is active
  const isGroupActive = (group: ToolGroup) => {
    return group.tools.some(t => t.type === activeTool) || (group.moreTools?.some(t => t.type === activeTool) ?? false)
  }

  // Tool-specific options for the "more" dropdown
  const getToolSpecificOptions = (): { id: string; label: string; checked: boolean; onToggle: () => void }[] => {
    switch (activeTool) {
      case 'pen':
        return [
          { id: 'pen-bezier', label: 'Bezier Curve', checked: penBezierEnabled, onToggle: () => setPenBezierEnabled(!penBezierEnabled) },
          { id: 'pen-mirror', label: 'Mirror Handles', checked: penMirrorEnabled, onToggle: () => setPenMirrorEnabled(!penMirrorEnabled) },
        ]
      case 'pencil':
        return [
          { id: 'pencil-smooth', label: 'Smooth Path', checked: pencilSmoothEnabled, onToggle: () => setPencilSmoothEnabled(!pencilSmoothEnabled) },
        ]
      default:
        return []
    }
  }

  const toolSpecificOptions = getToolSpecificOptions()

  return (
    <>
      {/* Contextual tool options bar above toolbar - with "more" menu icon */}
      {currentToolOptions && (
        <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 z-[101] flex items-center rounded-lg bg-[#2C2C2C] border border-[#383838] px-2 py-1 gap-1.5">
          <button
            onClick={() => setToolOptionsMenuOpen(!toolOptionsMenuOpen)}
            className="flex items-center gap-1 hover:bg-[#3C3C3C] rounded px-1 py-0.5 transition-colors duration-100"
            title="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-[#0D99FF]" />
          </button>
          <span className="text-[10px] font-semibold text-[#0D99FF] uppercase tracking-wider">
            {currentToolOptions.label}
          </span>
          <div className="w-px h-4 bg-[#383838]" />
          {currentToolOptions.options.map((opt) => (
            <button
              key={opt.id}
              className="flex items-center justify-center h-6 px-2 rounded text-[10px] text-[#CCC] hover:bg-[#3C3C3C] hover:text-white transition-colors duration-100"
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
          {/* Active tool indicator dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-[#0D99FF] ml-1" />
          
          {/* More options dropdown for tool-specific settings */}
          {toolOptionsMenuOpen && toolSpecificOptions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-[#2C2C2C] rounded-md border border-[#383838] p-0.5 min-w-[180px] z-[200] shadow-lg shadow-black/30">
              <div className="px-2 py-1 text-[9px] font-semibold text-[#555] uppercase tracking-wider">
                Tool Options
              </div>
              {toolSpecificOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { opt.onToggle() }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[11px] text-[#CCC] hover:bg-[#3C3C3C] transition-colors duration-100"
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${opt.checked ? 'bg-[#0D99FF] border-[#0D99FF]' : 'border-[#666]'}`}>
                    {opt.checked && (
                      <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 text-left">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[100] flex items-center rounded-[13px] bg-fig-surface border border-fig-border overflow-visible" style={{ boxShadow: 'var(--fig-shadow-400)' }} ref={menuRef}>
        {/* Tool groups */}
        {toolGroups.map((group, groupIdx) => (
          <React.Fragment key={groupIdx}>
            {groupIdx > 0 && <div className="w-px h-4 bg-[#383838]" />}
            <div className="flex items-center px-[1px] py-[2px] relative gap-[1px]">
              {group.tools.map((tool) => {
                const Icon = tool.icon
                const isActive = activeTool === tool.type
                return (
                  <button
                    key={tool.type}
                    onClick={() => setActiveTool(tool.type)}
                    className={`
                      flex items-center justify-center rounded-md transition-colors duration-100
                      ${isActive ? 'bg-fig-surface-active text-white' : 'text-fig-text-tertiary hover:bg-fig-surface-hover hover:text-white'}
                    `}
                    style={{ width: 'var(--fig-toolbar-btn)', height: 'var(--fig-toolbar-btn)' }}
                    title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}

              {/* "More" button if group has moreTools */}
              {group.moreTools && group.moreTools.length > 0 && (
                <>
                  <button
                    onClick={() => setOpenMenuIdx(openMenuIdx === groupIdx ? null : groupIdx)}
                    className={`
                      flex items-center justify-center w-5 rounded-md transition-colors duration-100
                      ${openMenuIdx === groupIdx ? 'bg-fig-surface-hover text-white' : isGroupActive(group) ? 'text-fig-accent hover:bg-fig-surface-hover' : 'text-fig-text-disabled hover:bg-fig-surface-hover hover:text-white'}
                    `}
                    style={{ height: 'var(--fig-toolbar-btn)' }}
                    title={`${group.label} options`}
                  >
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>

                  {/* Dropdown menu - appears ABOVE the toolbar (Figma style) */}
                  {openMenuIdx === groupIdx && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[#2C2C2C] rounded-md border border-[#383838] p-0.5 min-w-[160px] z-[200] shadow-lg shadow-black/30">
                      <div className="px-2 py-1 text-[9px] font-semibold text-[#555] uppercase tracking-wider">
                        More {group.label}
                      </div>
                      {group.moreTools!.map((tool) => {
                        const Icon = tool.icon
                        const isActive = activeTool === tool.type
                        return (
                          <button
                            key={tool.type}
                            onClick={() => { setActiveTool(tool.type); setOpenMenuIdx(null) }}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[11px] transition-colors duration-100 ${
                              isActive ? 'bg-[#0D99FF]/15 text-[#0D99FF]' : 'text-[#CCC] hover:bg-[#3C3C3C]'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="flex-1 text-left">{tool.label}</span>
                            {tool.shortcut && <span className="text-[10px] text-[#555]">{tool.shortcut}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </React.Fragment>
        ))}

        {/* Divider before zoom */}
        <div className="w-px h-4 bg-[#383838]" />

        {/* Zoom controls in toolbar */}
        <div className="flex items-center px-[1px] py-[2px] gap-[1px]">
          <button
            onClick={() => setZoom(Math.max(0.01, zoom - 0.1))}
            className="flex items-center justify-center w-6 rounded-md text-fig-text-tertiary hover:bg-fig-surface-hover hover:text-white transition-colors duration-100"
            style={{ height: 'var(--fig-toolbar-btn)' }}
            title="Zoom out"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan(0, 0) }}
            className="flex items-center justify-center rounded-md text-[10px] text-fig-text-tertiary hover:bg-fig-surface-hover hover:text-white transition-colors duration-100 tabular-nums min-w-[34px]"
            style={{ height: 'var(--fig-toolbar-btn)', fontFamily: 'var(--fig-font-family-mono)' }}
            title="Reset zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(Math.min(64, zoom + 0.1))}
            className="flex items-center justify-center w-6 rounded-md text-fig-text-tertiary hover:bg-fig-surface-hover hover:text-white transition-colors duration-100"
            style={{ height: 'var(--fig-toolbar-btn)' }}
            title="Zoom in"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* PHASE 8 — View options (grids / snapping / rulers / units) */}
        <div className="relative">
          <button
            onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
            className={`flex items-center justify-center w-6 rounded-md transition-colors duration-100 ${viewOptionsOpen ? 'bg-fig-surface-hover text-white' : 'text-fig-text-tertiary hover:bg-fig-surface-hover hover:text-white'}`}
            style={{ height: 'var(--fig-toolbar-btn)' }}
            title="View options"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M1.5 3.5h9M1.5 6h9M1.5 8.5h9" />
              <circle cx="4" cy="3.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="8" cy="6" r="1" fill="currentColor" stroke="none" />
              <circle cx="5.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {viewOptionsOpen && <ViewOptionsPopup onClose={() => setViewOptionsOpen(false)} />}
        </div>

        {/* Divider before mode switch */}
        <div className="w-px h-4 bg-[#383838]" />

        {/* Mode toggle - Figma tab style */}
        <div className="flex items-center px-0.5 py-[2px]">
          {(['design', 'prototype', 'dev'] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setEditorMode(m)}
              className={`
                px-2 py-1 text-[10px] font-medium rounded-md transition-colors duration-100 capitalize
                ${editorMode === m ? 'bg-[#0D99FF] text-white' : 'text-[#888] hover:bg-[#3C3C3C] hover:text-white'}
              `}
            >
              {m === 'dev' ? 'Dev' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
