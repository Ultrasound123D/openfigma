'use client'

import React, { useState, useCallback } from 'react'
import { useEditorStore, DesignElement } from '@/store/editor-store'
import { findElementInList, getAllElements } from '@/lib/element-utils'
import { Eye, EyeOff, ChevronRight, ChevronDown, Lock, Unlock, Component as ComponentIcon, Search, Filter } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'

const typeLabels: Record<string, string> = {
  frame: 'Frame',
  group: 'Group',
  rectangle: 'Rect',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  text: 'Text',
  path: 'Path',
  polygon: 'Polygon',
  star: 'Star',
  boolean: 'Boolean',
  slice: 'Slice',
  // PHASE 15
  section: 'Section',
  table: 'Table',
  sticky: 'Sticky',
}

function getElementThumbnailColor(el: DesignElement): string {
  if (el.type === 'text') return el.textColor || '#000000'
  if (el.type === 'line' || el.type === 'arrow') return el.stroke === 'transparent' ? '#000000' : el.stroke
  if (el.type === 'path') return el.stroke === 'transparent' ? (el.fill && el.fill !== 'transparent' ? el.fill : '#000000') : el.stroke
  if (el.fill && el.fill !== 'transparent') return el.fill
  if (el.fills && el.fills.length > 0 && el.fills[0].color && el.fills[0].color !== 'transparent') return el.fills[0].color
  return '#444444'
}

/* ── SVG-based shape thumbnails ───────────────────────────── */

function ShapeThumbnail({ element }: { element: DesignElement }) {
  const color = getElementThumbnailColor(element)
  const size = 14

  if (element.type === 'frame') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="1.5" stroke={color} strokeWidth="1.2" fill="none" />
        <rect x="3" y="3" width="8" height="8" rx="0.5" stroke={color} strokeWidth="0.6" strokeDasharray="1.5 1" fill="none" opacity="0.5" />
      </svg>
    )
  }
  if (element.type === 'group') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="1" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" fill="none" opacity="0.7" />
      </svg>
    )
  }
  if (element.type === 'ellipse') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <ellipse cx="7" cy="7" rx="5.5" ry="5.5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
      </svg>
    )
  }
  if (element.type === 'line') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <line x1="2" y1="12" x2="12" y2="2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (element.type === 'arrow') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <line x1="2" y1="12" x2="11" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="6,2 11,3 10,8" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (element.type === 'text') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <text x="7" y="11" textAnchor="middle" fontSize="10" fontWeight="700" fill={color} fontFamily="sans-serif">T</text>
      </svg>
    )
  }
  if (element.type === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M7 1l1.8 4.2H13l-3.4 2.6 1.3 4.2L7 9.8 3.1 12l1.3-4.2L1 5.2h4.2z" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="0.8" />
      </svg>
    )
  }
  if (element.type === 'polygon') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5l5.1 3.7-1.9 6H3.8l-1.9-6z" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="0.8" />
      </svg>
    )
  }
  if (element.type === 'path') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M2 10 C4 2, 10 12, 12 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  if (element.type === 'slice') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="1" stroke={color} strokeWidth="1" strokeDasharray="3 2" fill="none" />
        <line x1="1" y1="7" x2="13" y2="7" stroke={color} strokeWidth="0.6" strokeDasharray="1.5 1" />
      </svg>
    )
  }
  if (element.type === 'boolean') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="7" height="7" rx="0.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="0.8" />
        <rect x="6" y="4" width="7" height="7" rx="0.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="0.8" />
      </svg>
    )
  }
  // Default rectangle
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
    </svg>
  )
}

/* ── Dotted indent lines (Figma-style) ────────────────────── */

function IndentLines({ depth }: { depth: number }) {
  if (depth === 0) return null
  const lines: React.ReactNode[] = []
  for (let i = 0; i < depth; i++) {
    const left = i * 14 + 8
    lines.push(
      <div
        key={`indent-${i}`}
        className="absolute top-0 bottom-0"
        style={{ left: `${left}px` }}
      >
        <div
          className="w-px h-full"
          style={{
            backgroundImage: 'linear-gradient(to bottom, #444 33%, transparent 33%, transparent 66%, #444 66%)',
            backgroundSize: '1px 3px',
          }}
        />
      </div>
    )
  }
  return <>{lines}</>
}

/* ── LayerItem ────────────────────────────────────────────── */

function LayerItem({
  element,
  depth = 0,
  onContextMenuAction,
  searchQuery = '',
  filterType = 'all',
  hoveredLayerId,
  onHoverLayer,
}: {
  element: DesignElement
  depth?: number
  onContextMenuAction: (action: string, elementId: string) => void
  searchQuery?: string
  filterType?: string
  hoveredLayerId: string | null
  onHoverLayer: (id: string | null) => void
}) {
  const { selectedElementIds, setSelectedElementIds, updateElement } = useEditorStore()
  const isSelected = selectedElementIds.includes(element.id)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(element.name)
  const [isDragOver, setIsDragOver] = useState(false)

  // Filter check
  if (filterType !== 'all' && element.type !== filterType) {
    if (!element.children || !element.children.some(c => c.type === filterType)) {
      return null
    }
  }

  // Search check
  if (searchQuery && !element.name.toLowerCase().includes(searchQuery.toLowerCase())) {
    const hasMatchingChild = element.children?.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (!hasMatchingChild) return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      useEditorStore.getState().toggleElementSelection(element.id)
    } else {
      setSelectedElementIds([element.id])
    }
  }

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateElement(element.id, { visible: !element.visible })
  }

  const toggleLocked = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateElement(element.id, { locked: !element.locked })
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleRename = () => {
    if (renameValue.trim()) updateElement(element.id, { name: renameValue.trim() })
    setIsRenaming(false)
  }

  // Drag-to-reorder
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', element.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== element.id) {
      const state = useEditorStore.getState()
      const dropIdx = state.elements.findIndex(el => el.id === element.id)
      if (dropIdx >= 0) {
        state.reorderElement(draggedId, dropIdx)
      }
    }
  }

  const isHovered = hoveredLayerId === element.id
  const hasChildren = element.children && element.children.length > 0
  const childCount = element.children?.length ?? 0

  const rowContent = (
    <div
      className={`flex items-center h-[28px] cursor-pointer group text-[11px] relative select-none ${
        isSelected
          ? 'bg-[#0D99FF]/15 text-white'
          : isHovered
            ? 'bg-[#2A2A2A] text-[#DDD]'
            : isDragOver
              ? 'bg-[#0D99FF]/10'
              : 'text-[#CCC]'
      } ${!element.visible ? 'opacity-50' : ''}`}
      style={{
        paddingLeft: `${depth * 14 + 4}px`,
        paddingRight: '2px',
        transition: 'background-color 100ms ease, color 100ms ease, opacity 100ms ease',
      }}
      onClick={handleClick}
      onMouseEnter={() => onHoverLayer(element.id)}
      onMouseLeave={() => onHoverLayer(null)}
      draggable={!element.locked}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Dotted indent lines */}
      <IndentLines depth={depth} />

      {/* Expand/collapse toggle */}
      {hasChildren ? (
        <button
          onClick={toggleExpand}
          className="flex items-center justify-center w-3.5 h-3.5 shrink-0 mr-px rounded-sm transition-colors duration-100 hover:bg-[#3C3C3C]"
        >
          {isExpanded
            ? <ChevronDown className="w-2.5 h-2.5 text-[#888]" />
            : <ChevronRight className="w-2.5 h-2.5 text-[#888]" />
          }
        </button>
      ) : (
        <span className="w-[14px] shrink-0" />
      )}

      {/* Component / instance icon */}
      {element.isComponent ? (
        <ComponentIcon className="w-3 h-3 mr-0.5 text-[#A259FF] shrink-0" />
      ) : element.componentId ? (
        <div className="w-3 h-3 mr-0.5 shrink-0 border border-[#A259FF] rounded-[2px]" />
      ) : null}

      {/* Shape thumbnail */}
      <div className="shrink-0 mr-1 flex items-center justify-center w-[14px] h-[14px]">
        <ShapeThumbnail element={element} />
      </div>

      {/* Name */}
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); e.stopPropagation() }}
          className="flex-1 h-4 px-1 text-[10px] bg-[#1E1E1E] border border-[#0D99FF] rounded text-[#DDD] outline-none min-w-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`truncate flex-1 text-[11px] leading-none ${
            !element.visible
              ? 'text-[#555] line-through'
              : isSelected
                ? 'text-white'
                : 'text-[#CCC]'
          }`}
        >
          {element.name}
        </span>
      )}

      {/* Child count badge */}
      {hasChildren && !isRenaming && (
        <span className="text-[9px] text-[#555] mr-0.5 shrink-0 tabular-nums font-medium leading-none">
          {childCount}
        </span>
      )}

      {/* Type label for Frame/Group */}
      {((element.type === 'frame' || element.type === 'group' || element.type === 'section')) && !hasChildren && !isRenaming && (
        <span className="text-[8px] text-[#555] mr-0.5 shrink-0 leading-none">
          {typeLabels[element.type] || ''}
        </span>
      )}

      {/* Lock toggle */}
      <button
        onClick={toggleLocked}
        className={`flex items-center justify-center w-4 h-4 shrink-0 transition-opacity duration-100 ${
          element.locked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {element.locked
          ? <Lock className="w-2.5 h-2.5 text-[#F44336]" />
          : <Unlock className="w-2.5 h-2.5 text-[#666]" />
        }
      </button>

      {/* Visibility toggle */}
      <button
        onClick={toggleVisibility}
        className={`flex items-center justify-center w-4 h-4 shrink-0 transition-opacity duration-100 ${
          element.visible ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        }`}
      >
        {element.visible
          ? <Eye className="w-2.5 h-2.5 text-[#666]" />
          : <EyeOff className="w-2.5 h-2.5 text-[#F44336]" />
        }
      </button>
    </div>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {rowContent}
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[180px]">
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('duplicate', element.id)}>
            Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => { onContextMenuAction('rename', element.id); setIsRenaming(true) }}>
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-[#3C3C3C]" />
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('bring-forward', element.id)}>
            Bring Forward <ContextMenuShortcut>⌘]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('send-backward', element.id)}>
            Send Backward <ContextMenuShortcut>⌘[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('bring-to-front', element.id)}>
            Bring to Front
          </ContextMenuItem>
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('send-to-back', element.id)}>
            Send to Back
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-[#3C3C3C]" />
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('select-all-same', element.id)}>
            Select All Same Type
          </ContextMenuItem>
          {!element.isComponent && (
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('make-component', element.id)}>
              Make Component <ContextMenuShortcut>⌥⌘K</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          {element.isComponent && (
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6" onClick={() => onContextMenuAction('create-instance', element.id)}>
              Create Instance
            </ContextMenuItem>
          )}
          <ContextMenuSeparator className="bg-[#3C3C3C]" />
          <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[11px] h-6 text-[#F44336]" onClick={() => onContextMenuAction('delete', element.id)}>
            Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {hasChildren && isExpanded &&
        element.children!.map((child) => (
          <LayerItem
            key={child.id}
            element={child}
            depth={depth + 1}
            onContextMenuAction={onContextMenuAction}
            searchQuery={searchQuery}
            filterType={filterType}
            hoveredLayerId={hoveredLayerId}
            onHoverLayer={onHoverLayer}
          />
        ))}
    </>
  )
}

/* ── LayerPanel ───────────────────────────────────────────── */

export function LayerPanel() {
  const { elements, deleteElement, duplicateElement, bringForward, sendBackward, bringToFront, sendToBack, setSelectedElementIds, pushHistory, addComponent, createInstance } = useEditorStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null)

  const handleContextMenuAction = useCallback((action: string, elementId: string) => {
    switch (action) {
      case 'delete': pushHistory(); deleteElement(elementId); break
      case 'duplicate': pushHistory(); duplicateElement(elementId); break
      case 'rename': break
      case 'bring-forward': pushHistory(); bringForward(elementId); break
      case 'send-backward': pushHistory(); sendBackward(elementId); break
      case 'bring-to-front': pushHistory(); bringToFront(elementId); break
      case 'send-to-back': pushHistory(); sendToBack(elementId); break
      case 'select-all-same':
        const el = findElementInList(useEditorStore.getState().elements, elementId)
        if (el) {
          const allEls = getAllElements(useEditorStore.getState().elements)
          const sameTypeIds = allEls.filter(e => e.type === el.type).map(e => e.id)
          setSelectedElementIds(sameTypeIds)
        }
        break
      case 'make-component':
        pushHistory()
        addComponent(elementId)
        break
      case 'create-instance':
        pushHistory()
        createInstance(elementId)
        break
    }
  }, [deleteElement, duplicateElement, bringForward, sendBackward, bringToFront, sendToBack, pushHistory, setSelectedElementIds, addComponent, createInstance])

  const filterTypes = [
    { value: 'all', label: 'All' },
    { value: 'frame', label: 'Frames' },
    { value: 'group', label: 'Groups' },
    { value: 'rectangle', label: 'Rects' },
    { value: 'ellipse', label: 'Ellipses' },
    { value: 'text', label: 'Text' },
    { value: 'line', label: 'Lines' },
    { value: 'arrow', label: 'Arrows' },
    { value: 'path', label: 'Paths' },
    { value: 'star', label: 'Stars' },
    { value: 'polygon', label: 'Polygons' },
  ]

  // Count total visible elements
  const totalLayers = elements.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 h-5 border-b border-[#383838] shrink-0">
        <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Layers</span>
        <span className="text-[9px] text-[#555] tabular-nums">{totalLayers}</span>
      </div>

      {/* Search/Filter bar - single compact row */}
      <div className="px-1 py-0.5 border-b border-[#383838] shrink-0">
        <div className="flex items-center gap-0.5">
          <div className="flex items-center flex-1 h-[18px] px-1 bg-[#1E1E1E] border border-[#383838] rounded-sm">
            <Search className="w-2 h-2 text-[#555] shrink-0 mr-0.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter"
              className="flex-1 text-[10px] bg-transparent text-[#CCC] placeholder-[#444] focus:outline-none min-w-0"
            />
          </div>
          <div className="flex items-center h-[18px] pl-1 pr-0.5 bg-[#1E1E1E] border border-[#383838] rounded-sm">
            <Filter className="w-2 h-2 text-[#555] shrink-0 mr-0.5" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[9px] bg-transparent text-[#CCC] focus:outline-none appearance-none cursor-pointer"
            >
              {filterTypes.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Layer list with smooth scrolling */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#444 transparent',
        }}
      >
        <style>{`
          .layer-scroll::-webkit-scrollbar { width: 4px; }
          .layer-scroll::-webkit-scrollbar-track { background: transparent; }
          .layer-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
          .layer-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
          .layer-scroll::-webkit-scrollbar-corner { background: transparent; }
        `}</style>
        <div className="layer-scroll h-full overflow-y-auto">
          {[...elements].reverse().map((element) => (
            <LayerItem
              key={element.id}
              element={element}
              onContextMenuAction={handleContextMenuAction}
              searchQuery={searchQuery}
              filterType={filterType}
              hoveredLayerId={hoveredLayerId}
              onHoverLayer={setHoveredLayerId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
