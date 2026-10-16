'use client'

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useEditorStore, DesignElement, generateId } from '@/store/editor-store'
import { calculateSnapLines, SnapLine, constrainToAngle } from '@/lib/snap-utils'
import { calculateAutoLayout, hasAutoLayout } from '@/lib/auto-layout'
import { loadImageAsBase64, createImageElement, isImageFile } from '@/lib/image-utils'
import { findElementInList, getAllElements, pathElementToSvgPath, getVectorNetwork, vectorNetworkToPathPoints, pathPointsToVectorNetwork, translateNetwork, simplifyPath, smoothPointsToPathPoints, updateVertexInNetwork, setTangentInNetwork } from '@/lib/element-utils'
import { Rulers } from './Rulers'
import { CanvasContextMenu } from './CanvasContextMenu'
import { InlineTextEditor } from './InlineTextEditor'

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

const HANDLE_SIZE = 8
const ROTATION_HANDLE_DISTANCE = 30

function getHandlePositions(el: DesignElement, zoom: number): Record<HandlePosition, { x: number; y: number }> {
  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
  return {
    nw: { x: el.x, y: el.y },
    n: { x: el.x + el.width / 2, y: el.y },
    ne: { x: el.x + el.width, y: el.y },
    e: { x: el.x + el.width, y: el.y + el.height / 2 },
    se: { x: el.x + el.width, y: el.y + el.height },
    s: { x: el.x + el.width / 2, y: el.y + el.height },
    sw: { x: el.x, y: el.y + el.height },
    w: { x: el.x, y: el.y + el.height / 2 },
    rotate: { x: el.x + el.width / 2, y: el.y - ROTATION_HANDLE_DISTANCE / safeZoom },
  }
}

const handleCursors: Record<HandlePosition, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
  se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize', rotate: 'grab',
}

// Frustum culling: check if element is visible in viewport
function isElementInViewport(el: DesignElement, viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return (
    el.x + el.width >= viewportBounds.minX &&
    el.x <= viewportBounds.maxX &&
    el.y + el.height >= viewportBounds.minY &&
    el.y <= viewportBounds.maxY
  )
}

// Generate SVG defs for gradients, filters, clip paths, and image patterns
function generateSVGDefs(elements: DesignElement[], zoom: number): React.ReactNode {
  const defs: React.ReactNode[] = []
  const allEls = getAllElements(elements)
  
  let filterIndex = 0
  let gradientIndex = 0

  for (const el of allEls) {
    // Generate gradient defs for fills
    const fills = el.fills || []
    for (const fill of fills) {
      if (fill.type === 'linear-gradient' && fill.gradientStops && fill.gradientStops.length >= 2) {
        const id = `grad-${el.id}-${gradientIndex++}`
        const angle = fill.gradientAngle || 0
        const rad = (angle * Math.PI) / 180
        const x1 = 0.5 - 0.5 * Math.sin(rad)
        const y1 = 0.5 + 0.5 * Math.cos(rad)
        const x2 = 0.5 + 0.5 * Math.sin(rad)
        const y2 = 0.5 - 0.5 * Math.cos(rad)
        
        defs.push(
          <linearGradient key={id} id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="objectBoundingBox">
            {fill.gradientStops.map((stop, i) => (
              <stop key={i} offset={stop.offset * 100 + '%'} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </linearGradient>
        )
      } else if (fill.type === 'radial-gradient' && fill.gradientStops && fill.gradientStops.length >= 2) {
        const id = `grad-${el.id}-${gradientIndex++}`
        defs.push(
          <radialGradient key={id} id={id} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
            {fill.gradientStops.map((stop, i) => (
              <stop key={i} offset={stop.offset * 100 + '%'} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </radialGradient>
        )
      } else if (fill.type === 'image' && fill.imageUrl) {
        const id = `img-${el.id}-${gradientIndex++}`
        defs.push(
          <pattern key={id} id={id} patternUnits="objectBoundingBox" width="100%" height="100%">
            <image href={fill.imageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )
      }
    }

    // Generate filter defs for shadows and blurs
    const shadows = el.shadows || []
    const blurs = el.blurs || []
    if (shadows.length > 0 || blurs.length > 0) {
      const filterId = `filter-${el.id}-${filterIndex++}`
      const filterParts: string[] = []
      
      for (const shadow of shadows) {
        if (!shadow.visible) continue
        if (shadow.type === 'drop-shadow') {
          filterParts.push(`<feDropShadow dx="${shadow.x}" dy="${shadow.y}" stdDeviation="${shadow.blur / 2}" flood-color="${shadow.color}" flood-opacity="${shadow.opacity / 100}"/>`)
        } else if (shadow.type === 'inner-shadow') {
          filterParts.push(`<feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`)
          filterParts.push(`<feGaussianBlur stdDeviation="${shadow.blur / 2}"/>`)
          filterParts.push(`<feOffset dx="${shadow.x}" dy="${shadow.y}" result="offsetblur"/>`)
          filterParts.push(`<feFlood flood-color="${shadow.color}" flood-opacity="${shadow.opacity / 100}"/>`)
          filterParts.push(`<feComposite in2="offsetblur" operator="in"/>`)
          filterParts.push(`<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge>`)
        }
      }
      
      for (const blur of blurs) {
        if (!blur.visible) continue
        filterParts.push(`<feGaussianBlur stdDeviation="${blur.radius / 2}"/>`)
      }
      
      if (filterParts.length > 0) {
        defs.push(
          <filter key={filterId} id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <g dangerouslySetInnerHTML={{ __html: filterParts.join('') }} />
          </filter>
        )
      }
    }
  }

  // Clip paths for frames
  for (const el of allEls) {
    if ((el.type === 'frame' || el.type === 'group') && el.clipContent && el.children && el.children.length > 0) {
      defs.push(
        <clipPath key={`clip-${el.id}`} id={`clip-${el.id}`}>
          <rect x={0} y={0} width={el.width} height={el.height} rx={el.cornerRadius || 0} />
        </clipPath>
      )
    }
  }

  return <defs>{defs}</defs>
}

function getFillForElement(el: DesignElement, zoom: number, fillIndex: number = 0): string {
  const fills = el.fills || []
  
  if (fills.length > fillIndex) {
    const fill = fills[fillIndex]
    if (!fill.visible && fill.visible === false) return 'none'
    switch (fill.type) {
      case 'solid':
        return fill.color === 'transparent' ? 'none' : fill.color
      case 'linear-gradient':
      case 'radial-gradient':
        return `url(#grad-${el.id}-${fillIndex})`
      case 'image':
        return fill.imageUrl ? `url(#img-${el.id}-${fillIndex})` : 'none'
    }
  }
  
  return el.fill === 'transparent' ? 'none' : el.fill
}

// Memoized element renderer
const CanvasElement = React.memo(function CanvasElement({
  element,
  zoom,
  selectedIds,
  onElementMouseDown,
  onDoubleClick,
  viewportBounds,
}: {
  element: DesignElement
  zoom: number
  selectedIds: string[]
  onElementMouseDown: (el: DesignElement, e: React.MouseEvent) => void
  onDoubleClick: (el: DesignElement, e: React.MouseEvent) => void
  viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }
}) {
  if (!element.visible) return null

  // Safe zoom - never NaN or zero, used throughout SVG rendering
  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1

  // Frustum culling for top-level elements
  if (!isElementInViewport(element, viewportBounds)) return null

  const isSelected = selectedIds.includes(element.id)
  const isGroup = element.type === 'group' || element.type === 'component-set'
  const isFrame = element.type === 'frame'
  const hasChildren = (isGroup || isFrame) && element.children && element.children.length > 0

  const getFilterAttr = () => {
    const shadows = element.shadows || []
    const blurs = element.blurs || []
    if (shadows.length > 0 || blurs.length > 0) {
      return `url(#filter-${element.id}-0)`
    }
    return undefined
  }

  // Apply auto layout to frame children if applicable
  const getEffectiveChildren = (): DesignElement[] | undefined => {
    if (!hasChildren) return undefined
    if (isFrame && hasAutoLayout(element)) {
      return calculateAutoLayout(element)
    }
    return element.children
  }

  const effectiveChildren = getEffectiveChildren()

  const renderShape = (el: DesignElement, isChildRendering: boolean = false) => {
    const fillAttr = getFillForElement(el, zoom)
    const strokeAttr = el.stroke === 'transparent' ? 'none' : el.stroke
    const strokeDasharray = el.strokeStyle === 'dashed' ? `${6 / safeZoom} ${4 / safeZoom}` : el.strokeStyle === 'dotted' ? `${2 / safeZoom} ${2 / safeZoom}` : undefined
    const blendMode = el.blendMode && el.blendMode !== 'normal' ? el.blendMode : undefined
    const style: React.CSSProperties = blendMode ? { mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'] } : {}
    const filterAttr = isChildRendering ? undefined : getFilterAttr()
    const scaleX = el.flipH ? -1 : 1
    const scaleY = el.flipV ? -1 : 1
    const transform = (scaleX !== 1 || scaleY !== 1) ? `scale(${scaleX}, ${scaleY}) translate(${scaleX === -1 ? -el.width : 0}, ${scaleY === -1 ? -el.height : 0})` : undefined

    switch (el.type) {
      case 'rectangle':
      case 'frame':
        return (
          <rect
            x={0} y={0} width={el.width} height={el.height}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDasharray}
            rx={el.cornerRadius || el.cornerRadiusTL || 0}
            ry={el.cornerRadius || el.cornerRadiusTL || 0}
            opacity={el.opacity / 100}
            filter={filterAttr}
            transform={transform}
            style={style}
          />
        )
      case 'ellipse':
        return (
          <ellipse
            cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            strokeDasharray={strokeDasharray}
            opacity={el.opacity / 100}
            filter={filterAttr}
            transform={transform}
            style={style}
          />
        )
      case 'line':
        return (
          <line
            x1={0} y1={0} x2={el.width} y2={el.height}
            stroke={el.stroke === 'transparent' ? '#000000' : el.stroke}
            strokeWidth={el.strokeWidth || 2}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            opacity={el.opacity / 100}
            style={style}
          />
        )
      case 'arrow': {
        const arrowStroke = el.stroke === 'transparent' ? '#000000' : el.stroke
        const arrowWidth = el.strokeWidth || 2
        const headStyle = el.arrowHeadStyle || 'arrow'
        const x2 = el.width
        const y2 = el.height
        const angle = Math.atan2(y2, x2)
        const headLen = Math.max(10, arrowWidth * 5)
        return (
          <g style={style}>
            <line
              x1={0} y1={0} x2={x2} y2={y2}
              stroke={arrowStroke}
              strokeWidth={arrowWidth}
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              opacity={el.opacity / 100}
            />
            {headStyle === 'arrow' && (
              <polygon
                points={`${x2},${y2} ${x2 - headLen * Math.cos(angle - Math.PI / 6)},${y2 - headLen * Math.sin(angle - Math.PI / 6)} ${x2 - headLen * Math.cos(angle + Math.PI / 6)},${y2 - headLen * Math.sin(angle + Math.PI / 6)}`}
                fill={arrowStroke}
                opacity={el.opacity / 100}
              />
            )}
            {headStyle === 'circle' && (
              <circle
                cx={x2} cy={y2} r={headLen / 3}
                fill={arrowStroke}
                opacity={el.opacity / 100}
              />
            )}
            {headStyle === 'diamond' && (
              <polygon
                points={`${x2},${y2} ${x2 - headLen * 0.6 * Math.cos(angle - Math.PI / 4)},${y2 - headLen * 0.6 * Math.sin(angle - Math.PI / 4)} ${x2 - headLen * Math.cos(angle)},${y2 - headLen * Math.sin(angle)} ${x2 - headLen * 0.6 * Math.cos(angle + Math.PI / 4)},${y2 - headLen * 0.6 * Math.sin(angle + Math.PI / 4)}`}
                fill={arrowStroke}
                opacity={el.opacity / 100}
              />
            )}
          </g>
        )
      }
      case 'text': {
        const fontSize = el.fontSize || 18
        const fontWeight = el.fontWeight || 400
        const fontFamily = el.fontFamily || 'Inter, system-ui, sans-serif'
        const textAlign = el.textAlign || 'left'
        const textColor = el.textColor || el.fill || '#000000'
        const lineHeight = el.lineHeight || 1.4
        const letterSpacing = el.letterSpacing || 0
        const fontStyle = el.fontStyle || 'normal'
        const textDecoration = el.textDecoration || 'none'
        const lines = (el.textContent || 'Text').split('\n')
        const lineHeightPx = fontSize * lineHeight
        const totalTextHeight = lines.length * lineHeightPx
        const startY = (el.height - totalTextHeight) / 2 + fontSize
        const clipId = `text-clip-${el.id}`
        return (
          <g style={style}>
            {el.clipContent && (
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={0} width={el.width} height={el.height} />
                </clipPath>
              </defs>
            )}
            <rect x={0} y={0} width={el.width} height={el.height} fill="transparent" stroke="none" />
            <g clipPath={el.clipContent ? `url(#${clipId})` : undefined}>
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={textAlign === 'center' ? el.width / 2 : textAlign === 'right' ? el.width : 0}
                  y={startY + i * lineHeightPx}
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  fontFamily={fontFamily}
                  fontStyle={fontStyle}
                  letterSpacing={letterSpacing}
                  fill={textColor}
                  textAnchor={textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'}
                  textDecoration={textDecoration}
                  opacity={el.opacity / 100}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {line}
                </text>
              ))}
            </g>
          </g>
        )
      }
      case 'star': {
        const sides = el.sides || 5
        const innerRadiusPercent = el.innerRadius || 40
        const cx = el.width / 2
        const cy = el.height / 2
        const outerR = Math.min(el.width, el.height) / 2
        const innerR = outerR * (innerRadiusPercent / 100)
        const points: string[] = []
        for (let i = 0; i < sides * 2; i++) {
          const angle = (i * Math.PI) / sides - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return (
          <polygon
            points={points.join(' ')}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            opacity={el.opacity / 100}
            transform={transform}
            style={style}
          />
        )
      }
      case 'polygon': {
        const sides = el.sides || 6
        const cx = el.width / 2
        const cy = el.height / 2
        const r = Math.min(el.width, el.height) / 2
        const points: string[] = []
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return (
          <polygon
            points={points.join(' ')}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            opacity={el.opacity / 100}
            transform={transform}
            style={style}
          />
        )
      }
      case 'path': {
        // Prefer VectorNetwork (Figma parity); fall back to legacy PathPoint[]
        const d = pathElementToSvgPath(el)
        if (!d) return null
        return (
          <path
            d={d}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth || 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={el.opacity / 100}
            style={style}
          />
        )
      }
      case 'boolean': {
        return (
          <rect
            x={0} y={0} width={el.width} height={el.height}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            rx={el.cornerRadius || 0}
            opacity={el.opacity / 100}
            style={style}
          />
        )
      }
      default:
        return (
          <rect
            x={0} y={0} width={el.width} height={el.height}
            fill={fillAttr}
            stroke={strokeAttr}
            strokeWidth={el.strokeWidth}
            rx={el.cornerRadius || 0}
            opacity={el.opacity / 100}
            style={style}
          />
        )
    }
  }

  return (
    <g
      key={element.id}
      transform={`translate(${element.x}, ${element.y})${element.rotation ? ` rotate(${element.rotation}, ${element.width / 2}, ${element.height / 2})` : ''}`}
      onMouseDown={(e) => onElementMouseDown(element, e)}
      onDoubleClick={(e) => onDoubleClick(element, e)}
      style={{ cursor: element.locked ? 'default' : 'move' }}
    >
      {(isFrame || isGroup) && isSelected && (
        <text
          x={0} y={-6 / safeZoom}
          fontSize={Math.max(10, 11 / safeZoom)}
          fill="#0D99FF"
          fontFamily="Inter, system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {element.name}
        </text>
      )}

      {/* Text element label when selected */}
      {element.type === 'text' && isSelected && (
        <text
          x={0} y={-6 / safeZoom}
          fontSize={Math.max(10, 11 / safeZoom)}
          fill="#0D99FF"
          fontFamily="Inter, system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          Text
        </text>
      )}

      {/* Always render the frame/group's own shape (background + border) */}
      {(isFrame || isGroup) ? renderShape(element) : (!hasChildren && renderShape(element))}
      
      {/* Text element visible frame (always visible) */}
      {element.type === 'text' && (
        <rect
          x={0} y={0}
          width={element.width} height={element.height}
          fill="transparent"
          stroke={isSelected ? '#0D99FF' : 'rgba(255,255,255,0.15)'}
          strokeWidth={isSelected ? 1 / safeZoom : 0.5 / safeZoom}
          strokeDasharray={isSelected ? `${4 / safeZoom} ${2 / safeZoom}` : undefined}
          pointerEvents="none"
        />
      )}
      
      {/* Render children on top of the frame's own shape */}
      {effectiveChildren && (
        <g clipPath={element.clipContent ? `url(#clip-${element.id})` : undefined}>
          {effectiveChildren.map((child) => {
            if (!child.visible) return null
            return (
              <g
                key={child.id}
                transform={`translate(${child.x}, ${child.y})${child.rotation ? ` rotate(${child.rotation}, ${child.width / 2}, ${child.height / 2})` : ''}`}
              >
                {renderShape(child, true)}
                {selectedIds.includes(child.id) && (
                  <rect
                    x={-1} y={-1}
                    width={child.width + 2} height={child.height + 2}
                    fill="none"
                    stroke="#0D99FF"
                    strokeWidth={1.5 / safeZoom}
                    strokeDasharray={`${6 / safeZoom} ${3 / safeZoom}`}
                    pointerEvents="none"
                  />
                )}
              </g>
            )
          })}
        </g>
      )}
      
      {/* For non-frame/group elements without children, shape already rendered above */}

      {(isGroup || isFrame) && (
        <rect x={0} y={0} width={element.width} height={element.height} fill="transparent" stroke="none" />
      )}

      {/* Component-set persistent purple border */}
      {element.type === 'component-set' && (
        <rect
          x={0} y={0} width={element.width} height={element.height}
          fill="none"
          stroke="#A259FF"
          strokeWidth={1 / safeZoom}
          strokeDasharray={`${4 / safeZoom} ${2 / safeZoom}`}
          rx={2 / safeZoom}
          ry={2 / safeZoom}
          opacity={0.6}
          pointerEvents="none"
        />
      )}

      {isSelected && (
        <>
          <rect
            x={-1} y={-1}
            width={element.width + 2} height={element.height + 2}
            fill="none"
            stroke="#0D99FF"
            strokeWidth={1.5 / safeZoom}
            strokeDasharray={isGroup ? `${6 / safeZoom} ${3 / safeZoom}` : undefined}
            pointerEvents="none"
          />
          {(isFrame || isGroup) && (
            <text
              x={element.width / 2}
              y={element.height + 14 / safeZoom}
              fontSize={Math.max(9, 10 / safeZoom)}
              fill="#888"
              fontFamily="Inter, system-ui, sans-serif"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {Math.round(element.width)} × {Math.round(element.height)}
            </text>
          )}
          {/* Auto layout indicator */}
          {isFrame && hasAutoLayout(element) && (
            <text
              x={0} y={-16 / safeZoom}
              fontSize={Math.max(8, 9 / safeZoom)}
              fill="#0D99FF"
              fontFamily="Inter, system-ui, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              Auto Layout
            </text>
          )}
          {/* Component indicator */}
          {element.isComponent && (
            <circle
              cx={element.width + 4 / safeZoom}
              cy={-4 / safeZoom}
              r={4 / safeZoom}
              fill="#A259FF"
              stroke="none"
            />
          )}
          {element.componentId && (
            <circle
              cx={element.width + 4 / safeZoom}
              cy={-4 / safeZoom}
              r={4 / safeZoom}
              fill="none"
              stroke="#A259FF"
              strokeWidth={1.5 / safeZoom}
            />
          )}
        </>
      )}
    </g>
  )
})

export function Canvas() {
  const {
    elements,
    zoom,
    setZoom,
    panX,
    panY,
    setPan,
    setSelectedElementIds,
    selectedElementIds,
    activeTool,
    addElement,
    updateElement,
    pushHistory,
    setActiveTool,
    showGrid,
    snapToGrid,
    snapToElements,
    gridSize,
    showRulers,
    guides,
    removeGuide,
    currentFrameId,
    enterFrame,
    exitFrame,
    moveElementToFrame,
  } = useEditorStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const hasAutoFitted = useRef(false)

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragElementStartsRef = useRef<Record<string, { x: number; y: number }>>({})
  const [altHeld, setAltHeld] = useState(false)
  const [dragDuplicates, setDragDuplicates] = useState<DesignElement[] | null>(null)

  const [isResizing, setIsResizing] = useState(false)
  const [activeResizeHandle, setActiveResizeHandle] = useState<HandlePosition | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; elX: number; elY: number; elW: number; elH: number; fontSize?: number } | null>(null)
  const resizeElementIdRef = useRef<string | null>(null)

  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  const rubberBandStartRef = useRef<{ x: number; y: number } | null>(null)

  const [penPoints, setPenPoints] = useState<{ x: number; y: number; cx1?: number; cy1?: number; cx2?: number; cy2?: number }[]>([])
  const penPointsRef = useRef(penPoints)
  useEffect(() => { penPointsRef.current = penPoints }, [penPoints])

  // Native app feel: prevent drag-to-text, browser zoom
  useEffect(() => {
    const preventDefaults = (e: Event) => e.preventDefault()
    const container = containerRef.current
    if (container) {
      container.addEventListener('dragstart', preventDefaults)
      // Prevent browser zoom with Ctrl+scroll (React onWheel is passive)
      container.addEventListener('wheel', preventDefaults, { passive: false })
    }
    return () => {
      if (container) {
        container.removeEventListener('dragstart', preventDefaults)
        container.removeEventListener('wheel', preventDefaults)
      }
    }
  }, [])
  const penElementIdRef = useRef<string | null>(null)
  const [penDragStart, setPenDragStart] = useState<{ x: number; y: number; pointIndex: number } | null>(null)
  const [penCursorPos, setPenCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Path editing state (double-click to enter edit mode on existing path)
  const [editingPathId, setEditingPathId] = useState<string | null>(null)
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null)
  const [editingDragType, setEditingDragType] = useState<'anchor' | 'tangentStart' | 'tangentEnd' | null>(null)
  const [editingDragSegIdx, setEditingDragSegIdx] = useState<number | null>(null)
  const editingDragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null)

  // Pencil drawing state
  const [isPencilDrawing, setIsPencilDrawing] = useState(false)
  const [pencilPoints, setPencilPoints] = useState<{ x: number; y: number }[]>([])
  const pencilRafRef = useRef<number>(0)

  // Eyedropper state
  const [eyedropperColor, setEyedropperColor] = useState<string | null>(null)
  const [eyedropperPos, setEyedropperPos] = useState<{ x: number; y: number } | null>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const elementCounterRef = useRef(0)

  // Frame drop highlight
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null)

  // RAF throttle for smooth drag/resize
  const dragRafRef = useRef<number>(0)
  const pendingDragUpdate = useRef<{ id: string; updates: Partial<DesignElement> }[] | null>(null)

  const calculateFitToScreen = useCallback((size: { width: number; height: number }) => {
    const state = useEditorStore.getState()
    const allElements = state.elements
    if (allElements.length === 0 || size.width < 200 || size.height < 200) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const processElement = (el: DesignElement, parentX = 0, parentY = 0) => {
      const absX = el.x + parentX
      const absY = el.y + parentY
      minX = Math.min(minX, absX)
      minY = Math.min(minY, absY)
      maxX = Math.max(maxX, absX + el.width)
      maxY = Math.max(maxY, absY + el.height)
      if (el.children) el.children.forEach(c => processElement(c, absX, absY))
    }
    allElements.forEach((el) => processElement(el))
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    const padding = 100
    const scaleX = (size.width - padding * 2) / contentWidth
    const scaleY = (size.height - padding * 2) / contentHeight
    const newZoom = Math.min(scaleX, scaleY, 2)
    state.setZoom(newZoom)
    state.setPan(-contentCenterX * newZoom, -contentCenterY * newZoom)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const size = { width: entry.contentRect.width, height: entry.contentRect.height }
        setContainerSize(size)
        if (!hasAutoFitted.current && size.width > 400 && size.height > 300) {
          hasAutoFitted.current = true
          setTimeout(() => calculateFitToScreen(size), 200)
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [calculateFitToScreen])

  const fitToScreen = useCallback(() => {
    if (containerSize.width === 0) return
    calculateFitToScreen(containerSize)
  }, [containerSize, calculateFitToScreen])

  const zoomToSelection = useCallback(() => {
    const state = useEditorStore.getState()
    const selected = state.selectedElementIds
      .map(id => findElementInList(state.elements, id))
      .filter(Boolean) as DesignElement[]
    if (selected.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    selected.forEach(el => {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    })
    const cw = maxX - minX
    const ch = maxY - minY
    const pad = 100
    const nz = Math.min((containerSize.width - pad * 2) / cw, (containerSize.height - pad * 2) / ch, 4)
    state.setZoom(nz)
    state.setPan(-(minX + cw / 2) * nz, -(minY + ch / 2) * nz)
  }, [containerSize])

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
      const cx = (containerSize.width || 0) / 2 + panX
      const cy = (containerSize.height || 0) / 2 + panY
      const x = (clientX - rect.left - cx) / safeZoom
      const y = (clientY - rect.top - cy) / safeZoom
      return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 }
    },
    [zoom, panX, panY, containerSize]
  )

  // Find the deepest frame/group that contains the given canvas position
  const findParentFrameAtPosition = useCallback(
    (canvasX: number, canvasY: number, excludeIds: string[] = []): DesignElement | null => {
      const state = useEditorStore.getState()
      // Search recursively - find the deepest nested frame/group
      let bestMatch: DesignElement | null = null
      let bestDepth = -1

      const searchElements = (elements: DesignElement[], parentX: number, parentY: number, depth: number) => {
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i]
          if (!el.visible || el.locked) continue
          if (excludeIds.includes(el.id)) continue
          if (el.type !== 'frame' && el.type !== 'group') continue

          const absX = el.x + parentX
          const absY = el.y + parentY

          if (canvasX >= absX && canvasX <= absX + el.width &&
              canvasY >= absY && canvasY <= absY + el.height) {
            // Found a match - check if there's a deeper nested match
            if (depth > bestDepth) {
              bestDepth = depth
              bestMatch = el
            }
            // Search children for deeper frames
            if (el.children) {
              searchElements(el.children, absX, absY, depth + 1)
            }
          }
        }
      }

      searchElements(state.elements, 0, 0, 0)
      return bestMatch
    },
    []
  )

  const findElementAtPosition = useCallback(
    (canvasX: number, canvasY: number): DesignElement | null => {
      const state = useEditorStore.getState()
      for (let i = state.elements.length - 1; i >= 0; i--) {
        const el = state.elements[i]
        if (!el.visible || el.locked) continue
        if (el.children) {
          for (let j = el.children.length - 1; j >= 0; j--) {
            const child = el.children[j]
            if (!child.visible || child.locked) continue
            // Convert child's relative coordinates to absolute canvas coordinates
            const absChildX = el.x + child.x
            const absChildY = el.y + child.y
            if (canvasX >= absChildX && canvasX <= absChildX + child.width &&
                canvasY >= absChildY && canvasY <= absChildY + child.height) {
              return child
            }
          }
        }
        if (canvasX >= el.x && canvasX <= el.x + el.width &&
            canvasY >= el.y && canvasY <= el.y + el.height) {
          return el
        }
      }
      return null
    },
    []
  )

  // Helper: get absolute position of an element (accounts for parent frame offsets)
  const getAbsolutePosition = useCallback(
    (elementId: string): { x: number; y: number } | null => {
      const state = useEditorStore.getState()
      // Check if element is a child of any frame/group
      for (const parent of state.elements) {
        if (parent.children) {
          const child = parent.children.find(c => c.id === elementId)
          if (child) {
            return { x: parent.x + child.x, y: parent.y + child.y }
          }
        }
      }
      // Top-level element
      const el = state.elements.find(e => e.id === elementId)
      if (el) return { x: el.x, y: el.y }
      return null
    },
    []
  )

  // Create or update the pen element in real-time (appears in layers immediately)
  const syncPenElement = useCallback((points: { x: number; y: number; cx1?: number; cy1?: number; cx2?: number; cy2?: number }[], closed: boolean) => {
    const state = useEditorStore.getState()
    if (points.length < 1) return
    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity
    points.forEach(pt => {
      pMinX = Math.min(pMinX, pt.x, pt.cx1 ?? pt.x, pt.cx2 ?? pt.x)
      pMinY = Math.min(pMinY, pt.y, pt.cy1 ?? pt.y, pt.cy2 ?? pt.y)
      pMaxX = Math.max(pMaxX, pt.x, pt.cx1 ?? pt.x, pt.cx2 ?? pt.x)
      pMaxY = Math.max(pMaxY, pt.y, pt.cy1 ?? pt.y, pt.cy2 ?? pt.y)
    })
    const relPoints = points.map(pt => ({
      x: pt.x - pMinX, y: pt.y - pMinY,
      cx1: pt.cx1 !== undefined ? pt.cx1 - pMinX : undefined,
      cy1: pt.cy1 !== undefined ? pt.cy1 - pMinY : undefined,
      cx2: pt.cx2 !== undefined ? pt.cx2 - pMinX : undefined,
      cy2: pt.cy2 !== undefined ? pt.cy2 - pMinY : undefined,
    }))
    const vectorNetwork = translateNetwork(
      pathPointsToVectorNetwork(relPoints, closed),
      0, 0
    )
    const x = Math.round(pMinX), y = Math.round(pMinY)
    const w = Math.round(pMaxX - pMinX) || 1, h = Math.round(pMaxY - pMinY) || 1
    if (penElementIdRef.current) {
      state.updateElement(penElementIdRef.current, {
        x, y, width: w, height: h,
        pathPoints: relPoints, pathClosed: closed, vectorNetwork,
      })
    } else {
      const newEl: DesignElement = {
        id: generateId('path'), name: 'Path', type: 'path',
        x, y, width: w, height: h,
        fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false,
        blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
        pathPoints: relPoints, pathClosed: closed, vectorNetwork,
      }
      state.addElement(newEl)
      penElementIdRef.current = newEl.id
    }
  }, [])

  // Finish pen path — the element is already in the store (created on first click)
  const finishPenPath = useCallback(() => {
    const state = useEditorStore.getState()
    if (penPoints.length < 2) {
      // Remove the element if only 1 point (not enough for a path)
      if (penElementIdRef.current) {
        state.deleteElement(penElementIdRef.current)
        penElementIdRef.current = null
      }
      setPenPoints([])
      setPenDragStart(null)
      setPenCursorPos(null)
      return
    }
    // Finalize: element already exists, just select it
    if (penElementIdRef.current) {
      const parentFrame = findParentFrameAtPosition(penPoints[0].x, penPoints[0].y, [penElementIdRef.current])
      if (parentFrame && parentFrame.id !== currentFrameId) {
        state.moveElementToFrame(penElementIdRef.current, parentFrame.id)
      }
      state.setSelectedElementIds([penElementIdRef.current])
      state.pushHistory()
    }
    penElementIdRef.current = null
    setPenPoints([])
    setPenDragStart(null)
    setPenCursorPos(null)
  }, [penPoints, currentFrameId, findParentFrameAtPosition])

  // Auto-sync pen element in store whenever penPoints changes (live update in layers)
  useEffect(() => {
    if (activeTool !== 'pen' || penPoints.length === 0 || !penElementIdRef.current) return
    syncPenElement(penPoints, false)
  }, [penPoints, activeTool, syncPenElement])

  // Finalize pen path when switching away from pen tool
  const prevToolRef = useRef(activeTool)
  useEffect(() => {
    if (prevToolRef.current === 'pen' && activeTool !== 'pen') {
      if (penPoints.length >= 2) {
        finishPenPath()
      } else {
        // Remove incomplete element from store
        if (penElementIdRef.current) {
          useEditorStore.getState().deleteElement(penElementIdRef.current)
          penElementIdRef.current = null
        }
        setPenPoints([])
        setPenDragStart(null)
        setPenCursorPos(null)
      }
    }
    prevToolRef.current = activeTool
  }, [activeTool]) // eslint-disable-line react-hooks/exhaustive-deps

  const findResizeHandle = useCallback(
    (canvasX: number, canvasY: number): { elementId: string; handle: HandlePosition } | null => {
      const state = useEditorStore.getState()
      if (state.selectedElementIds.length !== 1) return null
      const id = state.selectedElementIds[0]
      const el = findElementInList(state.elements, id)
      if (!el) return null
      // Use absolute position for child elements
      let absEl = el
      for (const parent of state.elements) {
        if (parent.children) {
          const child = parent.children.find(c => c.id === id)
          if (child) {
            absEl = { ...child, x: parent.x + child.x, y: parent.y + child.y }
            break
          }
        }
      }
      const safeZoomForHandles = isFinite(zoom) && zoom > 0.001 ? zoom : 1
      const handles = getHandlePositions(absEl, safeZoomForHandles)
      const threshold = HANDLE_SIZE / safeZoomForHandles
      const rotHandle = handles.rotate
      if (Math.abs(canvasX - rotHandle.x) < threshold && Math.abs(canvasY - rotHandle.y) < threshold) {
        return { elementId: id, handle: 'rotate' }
      }
      for (const [pos, point] of Object.entries(handles)) {
        if (pos === 'rotate') continue
        if (Math.abs(canvasX - point.x) < threshold && Math.abs(canvasY - point.y) < threshold) {
          return { elementId: id, handle: pos as HandlePosition }
        }
      }
      return null
    },
    [zoom]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + scroll = zoom centered on cursor (Figma default)
        const delta = -e.deltaY * 0.005
        const newZoom = Math.min(64, Math.max(0.01, zoom + delta * zoom))
        if (rect) {
          const mouseX = e.clientX - rect.left - containerSize.width / 2
          const mouseY = e.clientY - rect.top - containerSize.height / 2
          const scale = newZoom / zoom
          const newPanX = mouseX - scale * (mouseX - panX)
          const newPanY = mouseY - scale * (mouseY - panY)
          setZoom(newZoom)
          setPan(newPanX, newPanY)
        }
      } else if (e.shiftKey) {
        // Shift + scroll = pan horizontally
        setPan(panX - e.deltaY, panY - e.deltaX)
      } else if (e.altKey) {
        // Alt + scroll = zoom (alternative)
        const delta = -e.deltaY * 0.003
        const newZoom = Math.min(64, Math.max(0.01, zoom + delta * zoom))
        if (rect) {
          const mouseX = e.clientX - rect.left - containerSize.width / 2
          const mouseY = e.clientY - rect.top - containerSize.height / 2
          const scale = newZoom / zoom
          const newPanX = mouseX - scale * (mouseX - panX)
          const newPanY = mouseY - scale * (mouseY - panY)
          setZoom(newZoom)
          setPan(newPanX, newPanY)
        }
      } else {
        // Plain scroll = pan vertically
        setPan(panX - e.deltaX, panY - e.deltaY)
      }
    },
    [zoom, panX, panY, setZoom, setPan, containerSize]
  )

  const handleElementMouseDown = useCallback(
    (element: DesignElement, e: React.MouseEvent) => {
      // For right-clicks, just select and let context menu handle
      if (e.button === 2) {
        const state = useEditorStore.getState()
        if (!state.selectedElementIds.includes(element.id)) {
          setSelectedElementIds([element.id])
        }
        return
      }

      // When pen, pencil, eyedropper, or drawing tools are active, don't intercept clicks
      // Let the canvas handleMouseDown process these tools
      const state = useEditorStore.getState()
      if (['pen', 'pencil', 'eyedropper', 'rectangle', 'ellipse', 'line', 'frame', 'polygon', 'star', 'arrow', 'text', 'image', 'comment', 'slice'].includes(state.activeTool)) {
        // Don't stop propagation - let canvas handler process the tool
        return
      }

      e.stopPropagation()
      if (element.locked) return
      const currentState = useEditorStore.getState()
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      const handleInfo = findResizeHandle(canvasPos.x, canvasPos.y)

      if (handleInfo && currentState.selectedElementIds.includes(element.id)) {
        setIsResizing(true)
        setActiveResizeHandle(handleInfo.handle)
        resizeElementIdRef.current = handleInfo.elementId
        const el = findElementInList(currentState.elements, handleInfo.elementId)
        if (el) {
          resizeStartRef.current = { x: canvasPos.x, y: canvasPos.y, elX: el.x, elY: el.y, elW: el.width, elH: el.height, fontSize: el.fontSize }
        }
        return
      }

      if (e.shiftKey) {
        currentState.toggleElementSelection(element.id)
      } else if (!currentState.selectedElementIds.includes(element.id)) {
        setSelectedElementIds([element.id])
      }

      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }

      const selectedIds = e.shiftKey ? [...currentState.selectedElementIds] : [element.id]
      const starts: Record<string, { x: number; y: number }> = {}
      selectedIds.forEach((id) => {
        const el = findElementInList(currentState.elements, id)
        if (el) starts[id] = { x: el.x, y: el.y }
      })
      if (!starts[element.id]) {
        const el = findElementInList(currentState.elements, element.id)
        if (el) starts[element.id] = { x: el.x, y: el.y }
      }
      dragElementStartsRef.current = starts
    },
    [screenToCanvas, findResizeHandle, setSelectedElementIds]
  )

  // Handle double click on elements (enter frame, edit text)
  const handleElementDoubleClick = useCallback(
    (element: DesignElement, e: React.MouseEvent) => {
      e.stopPropagation()
      const state = useEditorStore.getState()
      // Only handle double-click for move tool
      if (state.activeTool !== 'move') return
      if (element.type === 'frame' || element.type === 'group') {
        enterFrame(element.id)
      } else if (element.type === 'text') {
        setEditingTextId(element.id)
      }
    },
    [enterFrame]
  )

  // simplifyPath and perpendicularDistance are imported from @/lib/element-utils

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Right-click handling: select element under cursor, then let context menu handle
      if (e.button === 2) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        if (clickedEl && !selectedElementIds.includes(clickedEl.id)) {
          setSelectedElementIds([clickedEl.id])
        }
        // Don't prevent default or stop propagation - let context menu handle
        return
      }

      if (e.button === 1 || activeTool === 'hand' || spaceHeld) {
        setIsPanning(true)
        panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
        e.preventDefault()
        return
      }

      if (e.button !== 0) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY)

      if (selectedElementIds.length === 1) {
        const handleInfo = findResizeHandle(canvasPos.x, canvasPos.y)
        if (handleInfo) {
          setIsResizing(true)
          setActiveResizeHandle(handleInfo.handle)
          resizeElementIdRef.current = handleInfo.elementId
          const el = findElementInList(useEditorStore.getState().elements, handleInfo.elementId)
          if (el) {
            resizeStartRef.current = { x: canvasPos.x, y: canvasPos.y, elX: el.x, elY: el.y, elW: el.width, elH: el.height, fontSize: el.fontSize }
          }
          return
        }
      }

      if (['rectangle', 'ellipse', 'line', 'frame', 'polygon', 'star', 'arrow'].includes(activeTool)) {
        setDrawStart(canvasPos)
        setDrawCurrent(canvasPos)
        setIsDrawing(true)
        return
      }

      if (activeTool === 'text') {
        const state = useEditorStore.getState()
        const id = generateId('text')
        const fontSize = 18
        const text = 'Text'
        // Auto-calculate width based on font size (approximate)
        const approxCharWidth = fontSize * 0.6
        const autoWidth = Math.max(100, text.length * approxCharWidth + 20)
        const autoHeight = Math.round(fontSize * 1.4 * 2)
        const newEl: DesignElement = {
          id, name: 'Text', type: 'text',
          x: Math.round(canvasPos.x - autoWidth / 2), y: Math.round(canvasPos.y - autoHeight / 2), width: autoWidth, height: autoHeight,
          fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', strokeAlign: 'center',
          cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
          opacity: 100, rotation: 0, visible: true, locked: false,
          blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
          textContent: text, fontFamily: 'Inter', fontSize, fontWeight: 400, textAlign: 'center', textColor: '#ffffff', lineHeight: 1.4, letterSpacing: 0,
        }
        addElement(newEl)
        // Auto-detect if inside a frame (addElement already handles currentFrameId)
        const parentFrame = findParentFrameAtPosition(canvasPos.x, canvasPos.y, [newEl.id])
        if (parentFrame && parentFrame.id !== currentFrameId) {
          moveElementToFrame(newEl.id, parentFrame.id)
        }
        setSelectedElementIds([id])
        setActiveTool('move')
        setEditingTextId(id)
        pushHistory()
        return
      }

      if (activeTool === 'pen') {
        // Check if clicking near first point to close path
        if (penPoints.length >= 3) {
          const firstPt = penPoints[0]
          const dist = Math.sqrt((canvasPos.x - firstPt.x) ** 2 + (canvasPos.y - firstPt.y) ** 2)
          if (dist < 8 / safeZoom) {
            // Close the path
            syncPenElement(penPoints, true)
            if (penElementIdRef.current) {
              const parentFrame = findParentFrameAtPosition(penPoints[0].x, penPoints[0].y, [penElementIdRef.current])
              if (parentFrame && parentFrame.id !== currentFrameId) {
                moveElementToFrame(penElementIdRef.current, parentFrame.id)
              }
              setSelectedElementIds([penElementIdRef.current])
              pushHistory()
            }
            penElementIdRef.current = null
            setPenPoints([])
            setPenDragStart(null)
            setPenCursorPos(null)
            return
          }
        }
        // Add a new point
        const newPoints = [...penPoints, { x: canvasPos.x, y: canvasPos.y }]
        setPenPoints(newPoints)
        setPenCursorPos(canvasPos)
        // Sync element in store (creates on first click, updates on subsequent)
        syncPenElement(newPoints, false)
        setPenDragStart({ x: canvasPos.x, y: canvasPos.y, pointIndex: newPoints.length - 1 })
        return
      }

      if (activeTool === 'pencil') {
        setIsPencilDrawing(true)
        setPencilPoints([canvasPos])
        return
      }

      if (activeTool === 'image') {
        // Image tool handled on mouseUp (file picker)
        return
      }

      if (activeTool === 'eyedropper') {
        // Sample color at click position
        setEyedropperPos(canvasPos)
        return
      }

      if (activeTool === 'move') {
        const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        if (clickedEl) {
          handleElementMouseDown(clickedEl, e)
          return
        }
        if (!e.shiftKey) {
          setSelectedElementIds([])
        }
        rubberBandStartRef.current = canvasPos
        setRubberBand({ startX: canvasPos.x, startY: canvasPos.y, endX: canvasPos.x, endY: canvasPos.y })
        return
      }

      setSelectedElementIds([])
    },
    [activeTool, spaceHeld, panX, panY, screenToCanvas, findResizeHandle, selectedElementIds, findElementAtPosition, handleElementMouseDown, addElement, pushHistory, setSelectedElementIds, setActiveTool, penPoints, penDragStart, zoom, currentFrameId, moveElementToFrame, findParentFrameAtPosition, syncPenElement]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
        return
      }

      if (isResizing && resizeStartRef.current && resizeElementIdRef.current && activeResizeHandle) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const start = resizeStartRef.current
        const handle = activeResizeHandle
        const dx = canvasPos.x - start.x
        const dy = canvasPos.y - start.y
        const shiftHeld = e.shiftKey
        const altHeld = e.altKey

        if (handle === 'rotate') {
          const el = findElementInList(useEditorStore.getState().elements, resizeElementIdRef.current)
          if (el) {
            const centerX = el.x + el.width / 2
            const centerY = el.y + el.height / 2
            let angle = Math.atan2(canvasPos.y - centerY, canvasPos.x - centerX) * (180 / Math.PI) + 90
            if (shiftHeld) {
              angle = Math.round(angle / 15) * 15
            }
            updateElement(resizeElementIdRef.current, { rotation: Math.round(angle) % 360 })
          }
          return
        }

        let newX = start.elX
        let newY = start.elY
        let newW = start.elW
        let newH = start.elH

        if (altHeld) {
          if (handle.includes('w') || handle === 'nw' || handle === 'sw') {
            newX = start.elX + dx / 2
            newW = start.elW - dx
          }
          if (handle.includes('e') || handle === 'ne' || handle === 'se') {
            newW = start.elW + dx
            newX = start.elX - dx / 2
          }
          if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
            newY = start.elY + dy / 2
            newH = start.elH - dy
          }
          if (handle.includes('s') || handle === 'sw' || handle === 'se') {
            newH = start.elH + dy
            newY = start.elY - dy / 2
          }
        } else {
          if (handle.includes('w') || handle === 'nw' || handle === 'sw') {
            newX = start.elX + dx
            newW = start.elW - dx
          }
          if (handle.includes('e') || handle === 'ne' || handle === 'se') {
            newW = start.elW + dx
          }
          if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
            newY = start.elY + dy
            newH = start.elH - dy
          }
          if (handle.includes('s') || handle === 'sw' || handle === 'se') {
            newH = start.elH + dy
          }
        }

        if (shiftHeld && (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw')) {
          const aspect = start.elW / start.elH
          if (Math.abs(dx) > Math.abs(dy)) {
            newH = newW / aspect
            if (handle.includes('n')) newY = start.elY + start.elH - newH
          } else {
            newW = newH * aspect
            if (handle.includes('w')) newX = start.elX + start.elW - newW
          }
        }

        if (newW < 2) { newW = 2; if (handle.includes('w')) newX = start.elX + start.elW - 2 }
        if (newH < 2) { newH = 2; if (handle.includes('n')) newY = start.elY + start.elH - 2 }

        // Text elements: scale fontSize proportionally with resize (Figma behavior)
        const resizeId = resizeElementIdRef.current
        const resizeEl = findElementInList(useEditorStore.getState().elements, resizeId)
        const resizeUpdates: Record<string, number> = { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
        if (resizeEl?.type === 'text' && start.fontSize) {
          const scaleX = newW / start.elW
          const scaleY = newH / start.elH
          const scale = Math.min(scaleX, scaleY)
          const newFontSize = Math.max(1, Math.round(start.fontSize * scale))
          resizeUpdates.fontSize = newFontSize
        }

        // Throttle resize updates using RAF for smoothness
        cancelAnimationFrame(dragRafRef.current)
        pendingDragUpdate.current = [{ id: resizeId, updates: resizeUpdates }]
        dragRafRef.current = requestAnimationFrame(() => {
          if (pendingDragUpdate.current) {
            const s = useEditorStore.getState()
            for (const { id, updates: u } of pendingDragUpdate.current) {
              s.updateElement(id, u)
            }
            pendingDragUpdate.current = null
          }
        })
        return
      }

      if (isDragging && dragStartRef.current) {
        const state = useEditorStore.getState()
        const dx = (e.clientX - dragStartRef.current.x) / zoom
        const dy = (e.clientY - dragStartRef.current.y) / zoom

        // Alt+drag to duplicate
        if (e.altKey && !dragDuplicates) {
          const dups: DesignElement[] = []
          Object.entries(dragElementStartsRef.current).forEach(([id, startPos]) => {
            const el = findElementInList(state.elements, id)
            if (el) {
              const dup = { ...JSON.parse(JSON.stringify(el)), id: generateId(el.type), name: `${el.name} copy` }
              if (dup.children) dup.children = dup.children.map((c: DesignElement) => ({ ...c, id: generateId(c.type) }))
              dups.push(dup)
            }
          })
          setDragDuplicates(dups)
        }

        // Calculate snap for the primary element
        const primaryId = Object.keys(dragElementStartsRef.current)[0]
        const primaryStart = dragElementStartsRef.current[primaryId]
        if (primaryStart) {
          const primaryEl = findElementInList(state.elements, primaryId)
          if (primaryEl) {
            const tempEl = { ...primaryEl, x: primaryStart.x + dx, y: primaryStart.y + dy }
            const snap = calculateSnapLines(tempEl, state.elements, state.selectedElementIds, gridSize, snapToGrid, snapToElements)
            setSnapLines(snap.snapLines)
            
            const actualDx = snap.snapX !== null ? snap.snapX - primaryStart.x : dx
            const actualDy = snap.snapY !== null ? snap.snapY - primaryStart.y : dy

            // Batch drag updates using RAF for smoother editing
            const updates: { id: string; updates: Partial<DesignElement> }[] = []
            Object.entries(dragElementStartsRef.current).forEach(([id, startPos]) => {
              updates.push({ id, updates: { x: Math.round(startPos.x + actualDx), y: Math.round(startPos.y + actualDy) } })
            })
            cancelAnimationFrame(dragRafRef.current)
            pendingDragUpdate.current = updates
            dragRafRef.current = requestAnimationFrame(() => {
              if (pendingDragUpdate.current) {
                const s = useEditorStore.getState()
                for (const { id, updates: u } of pendingDragUpdate.current) {
                  s.updateElement(id, u)
                }
                pendingDragUpdate.current = null
              }
            })
          }
        }

        // Check if we're dragging over a frame for drop target
        if (selectedElementIds.length > 0) {
          const canvasPos = screenToCanvas(e.clientX, e.clientY)
          let foundFrame: DesignElement | null = null
          for (let i = state.elements.length - 1; i >= 0; i--) {
            const el = state.elements[i]
            if ((el.type === 'frame' || el.type === 'group') && !selectedElementIds.includes(el.id)) {
              if (canvasPos.x >= el.x && canvasPos.x <= el.x + el.width &&
                  canvasPos.y >= el.y && canvasPos.y <= el.y + el.height) {
                foundFrame = el
                break
              }
            }
          }
          setDropTargetFrameId(foundFrame ? foundFrame.id : null)
        }

        return
      }

      if (isDrawing && drawStart) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        if (activeTool === 'line' && e.shiftKey) {
          const constrained = constrainToAngle(drawStart.x, drawStart.y, canvasPos.x, canvasPos.y)
          setDrawCurrent(constrained)
        } else {
          setDrawCurrent(canvasPos)
        }
      }

      // Pencil drawing
      if (isPencilDrawing) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        cancelAnimationFrame(pencilRafRef.current)
        pencilRafRef.current = requestAnimationFrame(() => {
          setPencilPoints(prev => [...prev, canvasPos])
        })
      }

      // Pen tool: update bezier handles during drag, or track cursor position for preview line
      if (activeTool === 'pen' && penPoints.length > 0) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        if (penDragStart) {
          // Dragging to create bezier handles
          const dx = canvasPos.x - penDragStart.x
          const dy = canvasPos.y - penDragStart.y
          setPenPoints(prev => {
            const updated = [...prev]
            const idx = penDragStart.pointIndex
            if (idx < updated.length) {
              // Symmetric bezier handles: handle1 is mirror of handle2 relative to point
              updated[idx] = {
                ...updated[idx],
                cx1: updated[idx].x - dx,
                cy1: updated[idx].y - dy,
                cx2: updated[idx].x + dx,
                cy2: updated[idx].y + dy,
              }
            }
            return updated
          })
        } else {
          setPenCursorPos(canvasPos)
        }
      }

      // Eyedropper tracking
      if (activeTool === 'eyedropper') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        setEyedropperPos(canvasPos)
      }

      // Path editing: drag anchor or tangent handle
      if (editingPathId && editingDragType && editingDragStartRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const state = useEditorStore.getState()
        const el = findElementInList(state.elements, editingPathId)
        if (el) {
          const network = getVectorNetwork(el)
          const absPos = getAbsolutePosition(editingPathId)
          const elX = absPos?.x ?? el.x
          const elY = absPos?.y ?? el.y
          const dx = canvasPos.x - screenToCanvas(editingDragStartRef.current.x, editingDragStartRef.current.y).x
          const dy = canvasPos.y - screenToCanvas(editingDragStartRef.current.x, editingDragStartRef.current.y).y

          if (editingDragType === 'anchor' && editingPointIndex !== null) {
            const v = network.vertices[editingPointIndex]
            if (v) {
              const newX = editingDragStartRef.current.origX + dx - elX
              const newY = editingDragStartRef.current.origY + dy - elY
              const newNetwork = updateVertexInNetwork(network, editingPointIndex, newX, newY)
              state.updateElement(editingPathId, { vectorNetwork: newNetwork })
            }
          } else if ((editingDragType === 'tangentStart' || editingDragType === 'tangentEnd') && editingDragSegIdx !== null) {
            const seg = network.segments[editingDragSegIdx]
            if (seg) {
              const vertexIdx = editingDragType === 'tangentStart' ? seg.start : seg.end
              const v = network.vertices[vertexIdx]
              if (v) {
                const newTanX = editingDragStartRef.current.origX + dx - elX - v.x
                const newTanY = editingDragStartRef.current.origY + dy - elY - v.y
                const newNetwork = setTangentInNetwork(network, editingPointIndex ?? vertexIdx, editingDragType === 'tangentStart' ? 'start' : 'end', { x: newTanX, y: newTanY }, e.altKey ? 'NONE' : 'ANGLE')
                state.updateElement(editingPathId, { vectorNetwork: newNetwork })
              }
            }
          }
        }
        return
      }

      // Hover tracking - show highlight on element under cursor when using move tool
      if (activeTool === 'move' && !isDragging && !isResizing) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        const hoveredEl = findElementAtPosition(canvasPos.x, canvasPos.y)
        setHoveredElementId(hoveredEl ? hoveredEl.id : null)
      } else {
        setHoveredElementId(null)
      }

      if (rubberBandStartRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY)
        setRubberBand({
          startX: rubberBandStartRef.current.x,
          startY: rubberBandStartRef.current.y,
          endX: canvasPos.x,
          endY: canvasPos.y,
        })
      }
    },
    [isPanning, isResizing, isDragging, isDrawing, drawStart, activeTool, rubberBandStartRef, screenToCanvas, setPan, zoom, updateElement, snapToGrid, snapToElements, gridSize, dragDuplicates, drawCurrent, isPencilDrawing, selectedElementIds, penDragStart]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Flush any pending RAF drag/resize updates before handling mouse up
      cancelAnimationFrame(dragRafRef.current)
      if (pendingDragUpdate.current) {
        const s = useEditorStore.getState()
        for (const { id, updates } of pendingDragUpdate.current) {
          s.updateElement(id, updates)
        }
        pendingDragUpdate.current = null
      }

      // Finish pen drag operation if active
      if (activeTool === 'pen' && penDragStart) {
        // If drag distance was very small, remove the bezier handles (treat as a simple click)
        setPenPoints(prev => {
          const updated = [...prev]
          const idx = penDragStart.pointIndex
          if (idx < updated.length) {
            const pt = updated[idx]
            // Check if handles are essentially at the same position as the point (no meaningful drag)
            const handleDist1 = pt.cx1 !== undefined && pt.cy1 !== undefined ? Math.sqrt((pt.cx1 - pt.x) ** 2 + (pt.cy1 - pt.y) ** 2) : 0
            const handleDist2 = pt.cx2 !== undefined && pt.cy2 !== undefined ? Math.sqrt((pt.cx2 - pt.x) ** 2 + (pt.cy2 - pt.y) ** 2) : 0
            if (handleDist1 < 2 / safeZoom && handleDist2 < 2 / safeZoom) {
              // Remove handles - this was a simple click, not a drag
              const { cx1, cy1, cx2, cy2, ...rest } = pt
              updated[idx] = rest as typeof pt
            }
          }
          return updated
        })
        setPenDragStart(null)
        return
      }

      // Path editing: finish drag
      if (editingPathId && editingDragType) {
        pushHistory()
        setEditingDragType(null)
        setEditingDragSegIdx(null)
        editingDragStartRef.current = null
        return
      }

      if (isPanning) {
        setIsPanning(false)
        return
      }

      if (isResizing) {
        pushHistory()
        setIsResizing(false)
        setActiveResizeHandle(null)
        resizeElementIdRef.current = null
        resizeStartRef.current = null
        return
      }

      if (isDragging) {
        // Check if dropping into a frame
        if (dropTargetFrameId) {
          const state = useEditorStore.getState()
          const frame = findElementInList(state.elements, dropTargetFrameId)
          if (frame && (frame.type === 'frame' || frame.type === 'group')) {
            for (const id of selectedElementIds) {
              state.moveElementToFrame(id, dropTargetFrameId)
            }
          }
        }
        pushHistory()
        setIsDragging(false)
        dragStartRef.current = null
        dragElementStartsRef.current = {}
        setDragDuplicates(null)
        setSnapLines([])
        setDropTargetFrameId(null)
        return
      }

      // Pencil drawing complete
      if (isPencilDrawing && pencilPoints.length >= 2) {
        const simplified = simplifyPath(pencilPoints, 2)
        
        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        simplified.forEach(pt => {
          minX = Math.min(minX, pt.x)
          minY = Math.min(minY, pt.y)
          maxX = Math.max(maxX, pt.x)
          maxY = Math.max(maxY, pt.y)
        })

        if (maxX - minX > 2 || maxY - minY > 2) {
          // Convert to local coordinates then smooth via Catmull-Rom
          const localPoints = simplified.map(pt => ({
            x: pt.x - minX,
            y: pt.y - minY,
          }))
          const smoothPathPoints = smoothPointsToPathPoints(localPoints, 0.5)
          const pathPoints = smoothPathPoints

          // Build VectorNetwork from smoothed points (with bezier handles)
          const pencilVectorNetwork = pathPointsToVectorNetwork(pathPoints, false)

          const newEl: DesignElement = {
            id: generateId('path'), name: 'Pencil Path', type: 'path',
            x: Math.round(minX), y: Math.round(minY),
            width: Math.round(maxX - minX), height: Math.round(maxY - minY),
            fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
            cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
            opacity: 100, rotation: 0, visible: true, locked: false,
            blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
            pathPoints, pathClosed: false,
            vectorNetwork: pencilVectorNetwork,
          }
          addElement(newEl)
          // Auto-detect if inside a frame
          const parentFrame = findParentFrameAtPosition(minX, minY, [newEl.id])
          if (parentFrame && parentFrame.id !== currentFrameId) {
            moveElementToFrame(newEl.id, parentFrame.id)
          }
          setSelectedElementIds([newEl.id])
          pushHistory()
        }
        setIsPencilDrawing(false)
        setPencilPoints([])
        return
      }
      setIsPencilDrawing(false)
      setPencilPoints([])

      // Eyedropper color sampling
      if (activeTool === 'eyedropper' && eyedropperPos) {
        const svgEl = containerRef.current?.querySelector('svg')
        if (svgEl) {
          try {
            const svgString = new XMLSerializer().serializeToString(svgEl)
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = svgEl.clientWidth
              canvas.height = svgEl.clientHeight
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (ctx) {
                ctx.drawImage(img, 0, 0)
                const rect = containerRef.current?.getBoundingClientRect()
                if (rect) {
                  const px = e.clientX - rect.left
                  const py = e.clientY - rect.top
                  const pixel = ctx.getImageData(Math.round(px), Math.round(py), 1, 1)
                  if (pixel && pixel.data[3] > 0) {
                    const [r, g, b] = pixel.data
                    const hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
                    // Apply to selected element's fill
                    const state = useEditorStore.getState()
                    if (state.selectedElementIds.length > 0) {
                      const id = state.selectedElementIds[0]
                      state.updateElement(id, { fill: hex })
                      state.pushHistory()
                    }
                  }
                }
              }
              URL.revokeObjectURL(url)
            }
            img.src = url
          } catch (err) {
            console.error('Eyedropper error:', err)
          }
        }
        setEyedropperPos(null)
        return
      }

      if (isDrawing && drawStart && drawCurrent) {
        const x = Math.min(drawStart.x, drawCurrent.x)
        const y = Math.min(drawStart.y, drawCurrent.y)
        const width = Math.abs(drawCurrent.x - drawStart.x)
        const height = Math.abs(drawCurrent.y - drawStart.y)

        if (width > 2 || height > 2 || activeTool === 'line' || activeTool === 'arrow') {
          if (activeTool === 'line') {
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: generateId('line'), name: `Line ${elementCounterRef.current}`, type: 'line',
              x: Math.round(drawStart.x), y: Math.round(drawStart.y),
              width: Math.round(drawCurrent.x - drawStart.x), height: Math.round(drawCurrent.y - drawStart.y),
              fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
            }
            addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
            if (parentFrame && parentFrame.id !== currentFrameId) {
              moveElementToFrame(newEl.id, parentFrame.id)
            }
            setSelectedElementIds([newEl.id])
          } else if (activeTool === 'arrow') {
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: generateId('arrow'), name: `Arrow ${elementCounterRef.current}`, type: 'arrow',
              x: Math.round(drawStart.x), y: Math.round(drawStart.y),
              width: Math.round(drawCurrent.x - drawStart.x), height: Math.round(drawCurrent.y - drawStart.y),
              fill: 'transparent', stroke: '#000000', strokeWidth: 2, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: false,
              arrowHeadStyle: 'arrow',
            }
            addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
            if (parentFrame && parentFrame.id !== currentFrameId) {
              moveElementToFrame(newEl.id, parentFrame.id)
            }
            setSelectedElementIds([newEl.id])
          } else {
            const defaults: Record<string, { fill: string; stroke: string; strokeWidth: number; sides?: number; innerRadius?: number }> = {
              rectangle: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 },
              ellipse: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 },
              frame: { fill: '#FFFFFF', stroke: '#E0E0E0', strokeWidth: 1 },
              polygon: { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0, sides: 6 },
              star: { fill: '#FFD93D', stroke: 'transparent', strokeWidth: 0, sides: 5, innerRadius: 40 },
            }
            const td = defaults[activeTool] || { fill: '#D9D9D9', stroke: 'transparent', strokeWidth: 0 }
            elementCounterRef.current++
            const newEl: DesignElement = {
              id: `${activeTool}-${Date.now()}`,
              name: `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} ${elementCounterRef.current}`,
              type: activeTool as DesignElement['type'],
              x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height),
              fill: td.fill, stroke: td.stroke, strokeWidth: td.strokeWidth, strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: activeTool === 'frame' ? 8 : 0,
              cornerRadiusTL: activeTool === 'frame' ? 8 : 0,
              cornerRadiusTR: activeTool === 'frame' ? 8 : 0,
              cornerRadiusBL: activeTool === 'frame' ? 8 : 0,
              cornerRadiusBR: activeTool === 'frame' ? 8 : 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: activeTool === 'frame',
              ...(td.sides !== undefined ? { sides: td.sides } : {}),
              ...(td.innerRadius !== undefined ? { innerRadius: td.innerRadius } : {}),
            }
            addElement(newEl)
            // Auto-detect if inside a frame (addElement already handles currentFrameId)
            // Don't auto-nest frames inside frames, but allow inside current frame
            if (activeTool !== 'frame') {
              const parentFrame = findParentFrameAtPosition(x, y, [newEl.id])
              if (parentFrame && parentFrame.id !== currentFrameId) {
                moveElementToFrame(newEl.id, parentFrame.id)
              }
            }
            setSelectedElementIds([newEl.id])
          }
          pushHistory()
        }

        setIsDrawing(false)
        setDrawStart(null)
        setDrawCurrent(null)
      }

      // Image tool: open file picker on click
      if (activeTool === 'image' && !isDragging && !isResizing && !rubberBand) {
        const clientX = e.clientX
        const clientY = e.clientY
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0]
          if (!file || !isImageFile(file)) return
          try {
            const base64 = await loadImageAsBase64(file)
            const pos = screenToCanvas(clientX, clientY)
            const imgEl = await createImageElement(base64, pos.x, pos.y)
            addElement(imgEl)
            setSelectedElementIds([imgEl.id])
            pushHistory()
          } catch (err) {
            console.error('Failed to load image:', err)
          }
        }
        input.click()
      }

      if (rubberBand) {
        const state = useEditorStore.getState()
        const rbMinX = Math.min(rubberBand.startX, rubberBand.endX)
        const rbMinY = Math.min(rubberBand.startY, rubberBand.endY)
        const rbMaxX = Math.max(rubberBand.startX, rubberBand.endX)
        const rbMaxY = Math.max(rubberBand.startY, rubberBand.endY)

        if (Math.abs(rbMaxX - rbMinX) > 5 || Math.abs(rbMaxY - rbMinY) > 5) {
          const selectedIds: string[] = []
          const addSelected = (el: DesignElement, parentX = 0, parentY = 0) => {
            if (!el.visible || el.locked) return
            const absX = el.x + parentX
            const absY = el.y + parentY
            if (absX + el.width > rbMinX && absX < rbMaxX &&
                absY + el.height > rbMinY && absY < rbMaxY) {
              selectedIds.push(el.id)
            }
            if (el.children) el.children.forEach(c => addSelected(c, absX, absY))
          }
          state.elements.forEach(el => addSelected(el))
          if (e.shiftKey) {
            setSelectedElementIds([...new Set([...state.selectedElementIds, ...selectedIds])])
          } else {
            setSelectedElementIds(selectedIds)
          }
        }
        setRubberBand(null)
        rubberBandStartRef.current = null
      }
    },
    [isPanning, isResizing, isDragging, isDrawing, drawStart, drawCurrent, rubberBand, activeTool, addElement, pushHistory, setSelectedElementIds, isPencilDrawing, pencilPoints, eyedropperPos, dropTargetFrameId, selectedElementIds]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      const clickedEl = findElementAtPosition(canvasPos.x, canvasPos.y)

      // Enter frame/group on double-click
      if (!clickedEl || clickedEl.type === 'frame' || clickedEl.type === 'group') {
        if (clickedEl && (clickedEl.type === 'frame' || clickedEl.type === 'group')) {
          enterFrame(clickedEl.id)
        }
        return
      }

      // Path editing mode
      if (clickedEl.type === 'path') {
        setEditingPathId(clickedEl.id)
        setEditingPointIndex(null)
        return
      }

      // Inline text editing
      if (clickedEl.type === 'text') {
        setEditingTextId(clickedEl.id)
      }
    },
    [screenToCanvas, findElementAtPosition, enterFrame]
  )

  // Path editing: click on anchor point to select it
  const handlePathAnchorClick = useCallback((e: React.MouseEvent, vertexIndex: number) => {
    e.stopPropagation()
    if (!editingPathId) return
    setEditingPointIndex(vertexIndex)
    setEditingDragType('anchor')
    const state = useEditorStore.getState()
    const el = findElementInList(state.elements, editingPathId)
    if (!el) return
    const network = getVectorNetwork(el)
    const v = network.vertices[vertexIndex]
    if (!v) return
    const absPos = getAbsolutePosition(editingPathId)
    const elX = absPos?.x ?? el.x
    const elY = absPos?.y ?? el.y
    editingDragStartRef.current = { x: e.clientX, y: e.clientY, origX: elX + v.x, origY: elY + v.y }
  }, [editingPathId, getAbsolutePosition])

  // Path editing: click on tangent handle to select it
  const handlePathTangentClick = useCallback((e: React.MouseEvent, segIdx: number, side: 'start' | 'end') => {
    e.stopPropagation()
    if (!editingPathId) return
    setEditingDragType(side === 'start' ? 'tangentStart' : 'tangentEnd')
    setEditingDragSegIdx(segIdx)
    const state = useEditorStore.getState()
    const el = findElementInList(state.elements, editingPathId)
    if (!el) return
    const network = getVectorNetwork(el)
    const seg = network.segments[segIdx]
    if (!seg) return
    const vertexIdx = side === 'start' ? seg.start : seg.end
    const v = network.vertices[vertexIdx]
    if (!v) return
    const tangent = side === 'start' ? seg.tangentStart : seg.tangentEnd
    const absPos = getAbsolutePosition(editingPathId)
    const elX = absPos?.x ?? el.x
    const elY = absPos?.y ?? el.y
    const tanX = elX + v.x + (tangent?.x ?? 0)
    const tanY = elY + v.y + (tangent?.y ?? 0)
    editingDragStartRef.current = { x: e.clientX, y: e.clientY, origX: tanX, origY: tanY }
  }, [editingPathId, getAbsolutePosition])

  // Exit path editing mode
  const exitPathEditing = useCallback(() => {
    if (editingPathId) {
      setEditingPathId(null)
      setEditingPointIndex(null)
      setEditingDragType(null)
      setEditingDragSegIdx(null)
      editingDragStartRef.current = null
    }
  }, [editingPathId])

  // Handle image drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files).filter(isImageFile)
      if (files.length === 0) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY)

      for (const file of files) {
        try {
          const base64 = await loadImageAsBase64(file)
          const imgEl = await createImageElement(base64, canvasPos.x, canvasPos.y)
          addElement(imgEl)
          setSelectedElementIds([imgEl.id])
          pushHistory()
        } catch (err) {
          console.error('Failed to load image:', err)
        }
      }
    },
    [screenToCanvas, pushHistory, addElement, setSelectedElementIds]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // BRAKE: Block ALL browser shortcuts to make app feel native
  // This runs in capture phase and prevents Ctrl+key combos from reaching the browser
  useEffect(() => {
    const BLOCKED_SHORTCUTS = new Set([
      'KeyS', // Ctrl+S = Save dialog
      'KeyR', // Ctrl+R = Refresh
      'KeyL', // Ctrl+L = Address bar
      'KeyH', // Ctrl+H = History
      'KeyJ', // Ctrl+J = Downloads
      'KeyU', // Ctrl+U = View source
      'KeyP', // Ctrl+P = Print
      'KeyN', // Ctrl+N = New window
      'KeyT', // Ctrl+T = New tab
      'KeyW', // Ctrl+W = Close tab
      'KeyF', // Ctrl+F = Find (we handle our own)
      'Comma', // Ctrl+, = Settings
      'Period', // Ctrl+. = ?
    ])

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Block Ctrl+key combos that we don't handle
      if (ctrl && !e.altKey) {
        const code = e.code
        // Allow Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+Y (redo)
        if (code === 'KeyZ' || code === 'KeyY') return
        // Allow Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, Ctrl+G
        if (code === 'KeyC' || code === 'KeyV' || code === 'KeyD' || code === 'KeyA' || code === 'KeyG') return
        // Allow Ctrl+/-, Ctrl+0, Ctrl+1, Ctrl+2
        if (code === 'Equal' || code === 'Minus' || code === 'Digit0' || code === 'Digit1' || code === 'Digit2') return
        // Allow Ctrl+], Ctrl+[, Ctrl+;
        if (code === 'BracketRight' || code === 'BracketLeft' || code === 'Semicolon') return
        // Allow Ctrl+' (apostrophe)
        if (code === 'Quote') return
        // Allow Ctrl+PageUp/PageDown
        if (code === 'PageUp' || code === 'PageDown') return

        // Block everything else
        if (BLOCKED_SHORTCUTS.has(code)) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }

      // Block Ctrl+Alt combos (browser features)
      if (ctrl && e.altKey) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // Other keyboard shortcuts (non-undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Allow typing in input fields and textareas (for non-undo/redo shortcuts)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Don't intercept shortcuts when editing contentEditable text
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (editingTextId) return

      // Undo/redo
      if (ctrl && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        if (useEditorStore.getState().activeTool === 'pen' && penPointsRef.current.length > 0) {
          const newLen = penPointsRef.current.length - 1
          if (newLen < 1 && penElementIdRef.current) {
            useEditorStore.getState().deleteElement(penElementIdRef.current)
            penElementIdRef.current = null
            setPenPoints([])
          } else {
            setPenPoints(prev => prev.slice(0, -1))
          }
          return
        }
        useEditorStore.getState().undo()
        return
      }
      if (ctrl && e.code === 'KeyZ' && e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }
      if (ctrl && e.code === 'KeyY') {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }

      // Prevent Alt key from activating browser menu bar
      if (e.key === 'Alt') {
        e.preventDefault()
        setAltHeld(true)
      }

      if (e.key === ' ' && !spaceHeld) {
        e.preventDefault()
        setSpaceHeld(true)
      }

      const state = useEditorStore.getState()

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Path editing: delete selected point
        if (editingPathId && editingPointIndex !== null) {
          e.preventDefault()
          const el = findElementInList(state.elements, editingPathId)
          if (el) {
            const network = getVectorNetwork(el)
            if (network.vertices.length > 2) {
              const newVertices = network.vertices.filter((_, i) => i !== editingPointIndex)
              const newSegments = network.segments
                .filter(s => s.start !== editingPointIndex && s.end !== editingPointIndex)
                .map(s => ({
                  ...s,
                  start: s.start > editingPointIndex ? s.start - 1 : s.start,
                  end: s.end > editingPointIndex ? s.end - 1 : s.end,
                }))
              const newNetwork = { ...network, vertices: newVertices, segments: newSegments }
              state.updateElement(editingPathId, { vectorNetwork: newNetwork })
              state.pushHistory()
              setEditingPointIndex(null)
            }
          }
          return
        }
        e.preventDefault()
        state.deleteSelectedElements()
        state.pushHistory()
      }

      // Enter key to finish pen path (Figma behavior)
      if (e.key === 'Enter' && penPoints.length > 0) {
        e.preventDefault()
        finishPenPath()
        return
      }

      if (e.key === 'Escape') {
        // Exit path editing mode first
        if (editingPathId) {
          exitPathEditing()
        } else if (isPencilDrawing || pencilPoints.length > 0) {
          setIsPencilDrawing(false)
          setPencilPoints([])
        } else if (penPoints.length > 0) {
          // Finish pen path
          finishPenPath()
        } else if (currentFrameId) {
          exitFrame()
        } else {
          setSelectedElementIds([])
          setIsDrawing(false)
          setDrawStart(null)
          setDrawCurrent(null)
          setEditingTextId(null)
          if (activeTool !== 'move') setActiveTool('move')
        }
      }

      if (ctrl && e.key === 'c') { e.preventDefault(); state.copySelected() }
      if (ctrl && e.key === 'v') { e.preventDefault(); state.pasteClipboard(); state.pushHistory() }
      if (ctrl && e.key === 'd') { e.preventDefault(); state.duplicateSelectedElements(); state.pushHistory() }
      if (ctrl && e.key === 'a') { e.preventDefault(); state.selectAll() }

      if (ctrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        if (state.selectedElementIds.length >= 2) { state.groupElements(state.selectedElementIds); state.pushHistory() }
      }
      if (ctrl && e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        if (state.selectedElementIds.length === 1) { state.ungroupElements(state.selectedElementIds[0]); state.pushHistory() }
      }

      // Zoom shortcuts
      if (ctrl && e.key === '=') { e.preventDefault(); state.setZoom(state.zoom + 0.1) }
      if (ctrl && e.key === '-') { e.preventDefault(); state.setZoom(state.zoom - 0.1) }
      if (ctrl && e.key === '0') { e.preventDefault(); fitToScreen() }
      if (ctrl && e.key === '1' && !e.shiftKey) { e.preventDefault(); state.setZoom(1); state.setPan(0, 0) }
      if (ctrl && e.shiftKey && e.key === '1') { e.preventDefault(); fitToScreen() }
      if (ctrl && e.key === '2') { e.preventDefault(); zoomToSelection() }
      // +/- without modifier for zoom
      if (!ctrl && !e.shiftKey && !e.altKey && e.key === '=') { state.setZoom(state.zoom + 0.1) }
      if (!ctrl && !e.shiftKey && !e.altKey && e.key === '-') { state.setZoom(state.zoom - 0.1) }

      // Page navigation (Ctrl+PageUp/PageDown like Figma)
      if (ctrl && e.key === 'PageUp') {
        e.preventDefault()
        const idx = state.pages.findIndex((p) => p.id === state.activePageId)
        if (idx > 0) state.setActivePage(state.pages[idx - 1].id)
      }
      if (ctrl && e.key === 'PageDown') {
        e.preventDefault()
        const idx = state.pages.findIndex((p) => p.id === state.activePageId)
        if (idx < state.pages.length - 1) state.setActivePage(state.pages[idx + 1].id)
      }

      // Z-order shortcuts (Ctrl+] and Ctrl+[ like Figma)
      if (ctrl && e.key === ']') { e.preventDefault(); state.selectedElementIds.forEach(id => state.bringForward(id)); state.pushHistory() }
      if (ctrl && e.key === '[') { e.preventDefault(); state.selectedElementIds.forEach(id => state.sendBackward(id)); state.pushHistory() }

      // Shift+2 for zoom to selection (Figma shortcut)
      if (e.shiftKey && e.key === '2') { e.preventDefault(); zoomToSelection() }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const delta = e.shiftKey ? 10 : 1
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el) {
            if (e.key === 'ArrowUp') state.updateElement(id, { y: el.y - delta })
            if (e.key === 'ArrowDown') state.updateElement(id, { y: el.y + delta })
            if (e.key === 'ArrowLeft') state.updateElement(id, { x: el.x - delta })
            if (e.key === 'ArrowRight') state.updateElement(id, { x: el.x + delta })
          }
        })
        state.pushHistory()
      }

      if (!ctrl && !e.shiftKey && !e.altKey) {
        // Finalize pen path before switching tools via keyboard
        const currentPenPoints = useEditorStore.getState().activeTool === 'pen' ? penPoints : []
        if (e.key !== 'p' && e.key !== 'P' && currentPenPoints.length >= 2) {
          finishPenPath()
        }
        if (e.key === 'v' || e.key === 'V') state.setActiveTool('move')
        if (e.key === 'f' || e.key === 'F') state.setActiveTool('frame')
        if (e.key === 'r' || e.key === 'R') state.setActiveTool('rectangle')
        if (e.key === 'o' || e.key === 'O') state.setActiveTool('ellipse')
        if (e.key === 'l' || e.key === 'L') state.setActiveTool('line')
        if (e.key === 'p' || e.key === 'P') state.setActiveTool('pen')
        if (e.key === 't' || e.key === 'T') state.setActiveTool('text')
        if (e.key === 'h' || e.key === 'H') state.setActiveTool('hand')
        if (e.key === 'i' || e.key === 'I') state.setActiveTool('eyedropper')
        if (e.key === 'c' || e.key === 'C') state.setActiveTool('comment')
        if (e.key === 's' || e.key === 'S') state.setActiveTool('slice')
      }

      // Shift+tool shortcuts (Figma variants)
      if (!ctrl && e.shiftKey && !e.altKey) {
        // Finalize pen path before switching tools via keyboard
        if (penPoints.length >= 2) {
          finishPenPath()
        }
        if (e.key === 'p' || e.key === 'P') state.setActiveTool('pencil')
        if (e.key === 'r' || e.key === 'R') state.setActiveTool('polygon')
        if (e.key === 'o' || e.key === 'O') state.setActiveTool('star')
        if (e.key === 'l' || e.key === 'L') state.setActiveTool('arrow')
        if (e.key === 'i' || e.key === 'I') state.setActiveTool('image')
      }

      // Toggle shortcuts
      if (ctrl && e.key === ';') {
        e.preventDefault()
        state.setShowGrid(!state.showGrid)
      }
      if (ctrl && e.key === "'") {
        e.preventDefault()
        // Toggle snap to grid
        state.setSnapToGrid(!state.snapToGrid)
      }

      // Ctrl+Alt shortcuts (Figma compatibility) - prevent browser defaults aggressively
      if (ctrl && e.altKey) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (ctrl && e.altKey && (e.key === 'k' || e.key === 'K')) {
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && !el.isComponent) { state.addComponent(id); state.pushHistory() }
        })
      }
      if (ctrl && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        e.stopPropagation()
        state.selectedElementIds.forEach(id => {
          const el = findElementInList(state.elements, id)
          if (el && el.isComponent) { state.createInstance(id); state.pushHistory() }
        })
      }
      // Ctrl+Alt+G = Frame Selection (Figma shortcut)
      if (ctrl && e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        if (state.selectedElementIds.length >= 1) {
          const ids = state.selectedElementIds
          const elementsToFrame = ids
            .map(id => findElementInList(state.elements, id))
            .filter(Boolean) as DesignElement[]
          if (elementsToFrame.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            elementsToFrame.forEach(el => {
              minX = Math.min(minX, el.x)
              minY = Math.min(minY, el.y)
              maxX = Math.max(maxX, el.x + el.width)
              maxY = Math.max(maxY, el.y + el.height)
            })
            const frameId = generateId('frame')
            // Convert children to relative coordinates (relative to frame's origin)
            const relativeChildren = elementsToFrame.map(el => ({
              ...el,
              x: el.x - minX,
              y: el.y - minY,
            }))
            const frame: DesignElement = {
              id: frameId,
              name: 'Frame',
              type: 'frame',
              x: minX, y: minY,
              width: maxX - minX,
              height: maxY - minY,
              fill: 'transparent', stroke: 'transparent', strokeWidth: 0,
              strokeStyle: 'solid', strokeAlign: 'center',
              cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
              opacity: 100, rotation: 0, visible: true, locked: false,
              blendMode: 'normal', flipH: false, flipV: false, clipContent: true,
              children: relativeChildren,
            }
            const remaining = state.elements.filter(el => !ids.includes(el.id))
            state.loadElements([...remaining, frame])
            state.setSelectedElementIds([frameId])
            state.pushHistory()
          }
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false)
      if (e.key === 'Alt') setAltHeld(false)
    }

    const handleAuxClick = (e: MouseEvent) => {
      // Prevent middle-click from opening links or triggering browser features
      if (e.button === 1) e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('auxclick', handleAuxClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('auxclick', handleAuxClick)
    }
  }, [spaceHeld, fitToScreen, zoomToSelection, editingTextId, setSelectedElementIds, setActiveTool, activeTool, currentFrameId, exitFrame, penPoints, isPencilDrawing, pencilPoints, pushHistory, addElement, finishPenPath])

  const getCursor = (): string => {
    if (isPanning || spaceHeld) return 'grabbing'
    if (isResizing && activeResizeHandle) return handleCursors[activeResizeHandle]
    if (isDragging) return 'move'
    switch (activeTool) {
      case 'hand': return 'grab'
      case 'move': return 'default'
      case 'rectangle': case 'ellipse': case 'line': case 'frame': case 'polygon': case 'star': case 'pen': case 'pencil': case 'comment': case 'slice': case 'arrow': case 'image': return 'crosshair'
      case 'text': return 'text'
      case 'eyedropper': return 'crosshair'
      default: return 'default'
    }
  }

  // Safe zoom value - never NaN or zero, used throughout SVG rendering
  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1

  const centerX = (containerSize.width || 0) / 2 + (isFinite(panX) ? panX : 0)
  const centerY = (containerSize.height || 0) / 2 + (isFinite(panY) ? panY : 0)

  // Calculate viewport bounds for frustum culling
  const viewportBounds = useMemo(() => ({
    minX: (-(isFinite(panX) ? panX : 0) - (containerSize.width || 0) / 2) / safeZoom,
    minY: (-(isFinite(panY) ? panY : 0) - (containerSize.height || 0) / 2) / safeZoom,
    maxX: (-(isFinite(panX) ? panX : 0) + (containerSize.width || 0) / 2) / safeZoom,
    maxY: (-(isFinite(panY) ? panY : 0) + (containerSize.height || 0) / 2) / safeZoom,
  }), [safeZoom, panX, panY, containerSize])

  // SVG Defs
  const svgDefs = useMemo(() => generateSVGDefs(elements, safeZoom), [elements, safeZoom])

  // Drawing preview
  const drawPreviewEl = isDrawing && drawStart && drawCurrent ? (
    <g>
      {activeTool === 'line' ? (
        <line x1={drawStart.x} y1={drawStart.y} x2={drawCurrent.x} y2={drawCurrent.y} stroke="#0D99FF" strokeWidth={2 / safeZoom} strokeLinecap="round" />
      ) : activeTool === 'arrow' ? (
        <g>
          <line x1={drawStart.x} y1={drawStart.y} x2={drawCurrent.x} y2={drawCurrent.y} stroke="#0D99FF" strokeWidth={2 / safeZoom} strokeLinecap="round" />
          <polygon
            points={(() => {
              const dx = drawCurrent.x - drawStart.x
              const dy = drawCurrent.y - drawStart.y
              const angle = Math.atan2(dy, dx)
              const headLen = 12 / safeZoom
              return `${drawCurrent.x},${drawCurrent.y} ${drawCurrent.x - headLen * Math.cos(angle - Math.PI / 6)},${drawCurrent.y - headLen * Math.sin(angle - Math.PI / 6)} ${drawCurrent.x - headLen * Math.cos(angle + Math.PI / 6)},${drawCurrent.y - headLen * Math.sin(angle + Math.PI / 6)}`
            })()}
            fill="#0D99FF"
          />
        </g>
      ) : activeTool === 'ellipse' ? (
        <ellipse cx={(drawStart.x + drawCurrent.x) / 2} cy={(drawStart.y + drawCurrent.y) / 2} rx={Math.abs(drawCurrent.x - drawStart.x) / 2} ry={Math.abs(drawCurrent.y - drawStart.y) / 2} fill="rgba(217,217,217,0.3)" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} />
      ) : (
        <rect x={Math.min(drawStart.x, drawCurrent.x)} y={Math.min(drawStart.y, drawCurrent.y)} width={Math.abs(drawCurrent.x - drawStart.x)} height={Math.abs(drawCurrent.y - drawStart.y)} fill={activeTool === 'frame' ? 'rgba(255,255,255,0.3)' : 'rgba(217,217,217,0.3)'} stroke="#0D99FF" strokeWidth={1.5 / safeZoom} strokeDasharray={`${4 / safeZoom}`} rx={activeTool === 'frame' ? 8 : 0} />
      )}
    </g>
  ) : null

  // Pen preview
  const penPreviewEl = penPoints.length > 0 ? (
    <g>
      {/* Lines connecting pen points (always visible dashed lines) */}
      {penPoints.map((pt, i) =>
        i > 0 ? (
          <line
            key={`pen-line-${i}`}
            x1={penPoints[i-1].x} y1={penPoints[i-1].y}
            x2={pt.x} y2={pt.y}
            stroke="#0D99FF" strokeWidth={1.5 / safeZoom}
            strokeDasharray={`${4 / safeZoom} ${3 / safeZoom}`}
            opacity={0.5}
          />
        ) : null
      )}
      {/* Preview line from last point to cursor */}
      {penCursorPos && penPoints.length > 0 && (
        <line
          x1={penPoints[penPoints.length-1].x}
          y1={penPoints[penPoints.length-1].y}
          x2={penCursorPos.x} y2={penCursorPos.y}
          stroke="#0D99FF" strokeWidth={1 / safeZoom}
          strokeDasharray={`${3 / safeZoom} ${3 / safeZoom}`}
          opacity={0.6}
        />
      )}
      {/* Live path preview using SVG <path> element with bezier curves */}
      {penPoints.length >= 2 && (
        <path
          d={(() => {
            let d = `M ${penPoints[0].x} ${penPoints[0].y}`
            for (let i = 1; i < penPoints.length; i++) {
              const pt = penPoints[i]
              if (pt.cx1 !== undefined && pt.cy1 !== undefined && pt.cx2 !== undefined && pt.cy2 !== undefined) {
                d += ` C ${pt.cx1} ${pt.cy1}, ${pt.cx2} ${pt.cy2}, ${pt.x} ${pt.y}`
              } else {
                d += ` L ${pt.x} ${pt.y}`
              }
            }
            if (penCursorPos) {
              d += ` L ${penCursorPos.x} ${penCursorPos.y}`
            }
            return d
          })()}
          fill="none"
          stroke="#0D99FF"
          strokeWidth={1.5 / safeZoom}
          strokeDasharray={penCursorPos ? `${4 / safeZoom} ${3 / safeZoom}` : undefined}
          pointerEvents="none"
        />
      )}
      {penPoints.map((pt, i) => {
        const isLast = i === penPoints.length - 1
        const isFirst = i === 0
        // Blender-style: last point is large (active), others are small
        const anchorRadius = isLast ? 5 / safeZoom : 3 / safeZoom
        return (
          <React.Fragment key={i}>
            {/* Bezier handle lines and control points */}
            {pt.cx1 !== undefined && pt.cy1 !== undefined && (
              <>
                <line x1={pt.cx1} y1={pt.cy1} x2={pt.x} y2={pt.y} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom}`} />
                <circle cx={pt.cx1} cy={pt.cy1} r={2.5 / safeZoom} fill="#FF6B6B" stroke="#0D99FF" strokeWidth={1 / safeZoom} />
              </>
            )}
            {pt.cx2 !== undefined && pt.cy2 !== undefined && (
              <>
                <line x1={pt.cx2} y1={pt.cy2} x2={pt.x} y2={pt.y} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom}`} />
                <circle cx={pt.cx2} cy={pt.cy2} r={2.5 / safeZoom} fill="#FF6B6B" stroke="#0D99FF" strokeWidth={1 / safeZoom} />
              </>
            )}
            {/* Anchor point - Blender style: last point large/active, others small */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={anchorRadius}
              fill={isLast ? '#0D99FF' : 'white'}
              stroke="#0D99FF"
              strokeWidth={1.5 / safeZoom}
            />
          </React.Fragment>
        )
      })}
      {/* Close path indicator ring on first point */}
      {penPoints.length >= 3 && (
        <circle cx={penPoints[0].x} cy={penPoints[0].y} r={7 / safeZoom} fill="none" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} strokeDasharray={`${2 / safeZoom}`} opacity={0.6} />
      )}
    </g>
  ) : null

  // Pencil preview
  const pencilPreviewEl = isPencilDrawing && pencilPoints.length >= 2 ? (
    <g>
      <polyline
        points={pencilPoints.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#0D99FF"
        strokeWidth={2 / safeZoom}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ) : null

  // Eyedropper loupe
  const eyedropperEl = activeTool === 'eyedropper' && eyedropperPos ? (
    <g>
      <circle cx={eyedropperPos.x} cy={eyedropperPos.y} r={20 / safeZoom} fill="none" stroke="#0D99FF" strokeWidth={2 / safeZoom} />
      <line x1={eyedropperPos.x - 8 / safeZoom} y1={eyedropperPos.y} x2={eyedropperPos.x + 8 / safeZoom} y2={eyedropperPos.y} stroke="#0D99FF" strokeWidth={1 / safeZoom} />
      <line x1={eyedropperPos.x} y1={eyedropperPos.y - 8 / safeZoom} x2={eyedropperPos.x} y2={eyedropperPos.y + 8 / safeZoom} stroke="#0D99FF" strokeWidth={1 / safeZoom} />
      {eyedropperColor && (
        <rect x={eyedropperPos.x + 24 / safeZoom} y={eyedropperPos.y - 12 / safeZoom} width={24 / safeZoom} height={24 / safeZoom} fill={eyedropperColor} stroke="#FFFFFF" strokeWidth={1.5 / safeZoom} rx={4 / safeZoom} />
      )}
    </g>
  ) : null

  // Selection handles - use circular points for path elements, square for others
  const selectionHandlesEl = selectedElementIds.length === 1 ? (() => {
    const id = selectedElementIds[0]
    const el = findElementInList(elements, id)
    if (!el) return null
    // Get absolute position for handles (child elements have relative coords)
    const absPos = getAbsolutePosition(id)
    const absEl = absPos ? { ...el, x: absPos.x, y: absPos.y } : el
    const handles = getHandlePositions(absEl, zoom)
    const isPathType = el.type === 'path'

    // For path elements, also show the path's control points for editing
    // Prefer VectorNetwork (Figma parity) — circles for smooth, squares for corner
    const pathControlPointsEl = isPathType ? (() => {
      const elX = absPos?.x ?? el.x
      const elY = absPos?.y ?? el.y
      const network = getVectorNetwork(el)
      if (network.vertices.length === 0) return null
      return (
        <g>
          {/* Render segments with handle lines and control points */}
          {network.segments.map((seg, segIdx) => {
            const startV = network.vertices[seg.start]
            const endV = network.vertices[seg.end]
            if (!startV || !endV) return null
            // Tangent positions in ABSOLUTE world coordinates
            const startAbsX = elX + startV.x
            const startAbsY = elY + startV.y
            const endAbsX = elX + endV.x
            const endAbsY = elY + endV.y
            const tsX = startAbsX + (seg.tangentStart?.x ?? 0)
            const tsY = startAbsY + (seg.tangentStart?.y ?? 0)
            const teX = endAbsX + (seg.tangentEnd?.x ?? 0)
            const teY = endAbsY + (seg.tangentEnd?.y ?? 0)
            // Smooth (mirrored) → circle handles; Corner (independent) → square handles
            const hasTangentStart = (seg.tangentStart?.x ?? 0) !== 0 || (seg.tangentStart?.y ?? 0) !== 0
            const hasTangentEnd = (seg.tangentEnd?.x ?? 0) !== 0 || (seg.tangentEnd?.y ?? 0) !== 0
            const isSmooth = hasTangentStart || hasTangentEnd
            const handleSize = 2.5 / safeZoom
            const isEditingThis = editingPathId === el.id
            const renderHandle = (cx: number, cy: number, key: string, side: 'start' | 'end') =>
              isSmooth ? (
                <circle key={key} cx={cx} cy={cy} r={handleSize} fill="white" stroke="#0D99FF" strokeWidth={1 / safeZoom}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onMouseDown={(e) => isEditingThis && handlePathTangentClick(e, segIdx, side)} />
              ) : (
                <rect
                  key={key}
                  x={cx - handleSize}
                  y={cy - handleSize}
                  width={handleSize * 2}
                  height={handleSize * 2}
                  fill="white"
                  stroke="#0D99FF"
                  strokeWidth={1 / safeZoom}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onMouseDown={(e) => isEditingThis && handlePathTangentClick(e, segIdx, side)}
                />
              )
            return (
              <React.Fragment key={`seg-${segIdx}`}>
                {hasTangentStart && (
                  <>
                    <line x1={tsX} y1={tsY} x2={startAbsX} y2={startAbsY} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom}`} />
                    {renderHandle(tsX, tsY, `ts-${segIdx}`, 'start')}
                  </>
                )}
                {hasTangentEnd && (
                  <>
                    <line x1={teX} y1={teY} x2={endAbsX} y2={endAbsY} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom}`} />
                    {renderHandle(teX, teY, `te-${segIdx}`, 'end')}
                  </>
                )}
              </React.Fragment>
            )
          })}
          {/* Render anchor points on top */}
          {network.vertices.map((v, i) => {
            const isLast = i === network.vertices.length - 1
            const isSelected = editingPathId === el.id && editingPointIndex === i
            const anchorR = (isLast || isSelected) ? 5 / safeZoom : 3 / safeZoom
            return (
              <circle
                key={`anchor-${i}`}
                cx={elX + v.x}
                cy={elY + v.y}
                r={anchorR}
                fill={isSelected ? '#0D99FF' : isLast ? '#0D99FF' : 'white'}
                stroke="#0D99FF"
                strokeWidth={1.5 / safeZoom}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onMouseDown={(e) => editingPathId === el.id && handlePathAnchorClick(e, i)}
              />
            )
          })}
        </g>
      )
    })() : null

    return (
      <g style={{ pointerEvents: 'auto' }}>
        <line x1={handles.n.x} y1={handles.n.y} x2={handles.rotate.x} y2={handles.rotate.y} stroke="#0D99FF" strokeWidth={1 / safeZoom} />
        <circle cx={handles.rotate.x} cy={handles.rotate.y} r={5 / safeZoom} fill="white" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} style={{ cursor: 'grab' }} />
        {/* Center alignment guides for text elements */}
        {el.type === 'text' && (
          <>
            <line
              x1={absEl.x + el.width / 2} y1={absEl.y - 8 / safeZoom}
              x2={absEl.x + el.width / 2} y2={absEl.y + el.height + 8 / safeZoom}
              stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom} ${2 / safeZoom}`} opacity={0.5}
            />
            <line
              x1={absEl.x - 8 / safeZoom} y1={absEl.y + el.height / 2}
              x2={absEl.x + el.width + 8 / safeZoom} y2={absEl.y + el.height / 2}
              stroke="#0D99FF" strokeWidth={0.5 / safeZoom} strokeDasharray={`${3 / safeZoom} ${2 / safeZoom}`} opacity={0.5}
            />
            <circle cx={absEl.x + el.width / 2} cy={absEl.y + el.height / 2} r={3 / safeZoom} fill="#0D99FF" opacity={0.6} />
          </>
        )}
        {/* Use circular handles for path elements, square for others (Figma-style) */}
        {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as HandlePosition[]).map((pos) => (
          isPathType ? (
            <circle key={pos} cx={handles[pos].x} cy={handles[pos].y} r={4 / safeZoom} fill="white" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} style={{ cursor: handleCursors[pos] }} />
          ) : (
            <rect key={pos} x={handles[pos].x - 4 / safeZoom} y={handles[pos].y - 4 / safeZoom} width={8 / safeZoom} height={8 / safeZoom} fill="white" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} rx={0} style={{ cursor: handleCursors[pos] }} />
          )
        ))}
        {pathControlPointsEl}
      </g>
    )
  })() : null

  // Hover highlight - show a subtle outline on hovered element (Figma-style)
  const hoverHighlightEl = hoveredElementId && !selectedElementIds.includes(hoveredElementId) ? (() => {
    const el = findElementInList(elements, hoveredElementId)
    if (!el) return null
    const absPos = getAbsolutePosition(hoveredElementId)
    const x = absPos?.x ?? el.x
    const y = absPos?.y ?? el.y
    return (
      <g pointerEvents="none">
        <rect
          x={x - 1.5 / safeZoom} y={y - 1.5 / safeZoom}
          width={el.width + 3 / safeZoom} height={el.height + 3 / safeZoom}
          fill="rgba(13,153,255,0.06)"
          stroke="rgba(13,153,255,0.6)"
          strokeWidth={1.5 / safeZoom}
          rx={el.cornerRadius ? el.cornerRadius / 4 : 0}
        />
        {/* Also highlight children of frames/groups when hovering */}
        {(el.type === 'frame' || el.type === 'group') && el.children && el.children.map((child) => {
          if (!child.visible) return null
          return (
            <rect
              key={`hover-child-${child.id}`}
              x={x + child.x - 0.5 / safeZoom} y={y + child.y - 0.5 / safeZoom}
              width={child.width + 1 / safeZoom} height={child.height + 1 / safeZoom}
              fill="none"
              stroke="rgba(13,153,255,0.3)"
              strokeWidth={1 / safeZoom}
              rx={child.cornerRadius ? child.cornerRadius / 4 : 0}
            />
          )
        })}
      </g>
    )
  })() : null

  // Distance measurement lines (show automatically when element is selected, like Figma)
  // In Figma, distance measurements show automatically on selection
  const measurementEl = selectedElementIds.length === 1 ? (() => {
    const id = selectedElementIds[0]
    const selEl = findElementInList(elements, id)
    if (!selEl) return null

    // Get absolute position for measurement (child elements have relative coords)
    const selAbsPos = getAbsolutePosition(id)
    const selX = selAbsPos?.x ?? selEl.x
    const selY = selAbsPos?.y ?? selEl.y

    // Find the nearest element in each direction and show distance
    const measurements: { x1: number; y1: number; x2: number; y2: number; dist: number; dir: 'h' | 'v' }[] = []

    const selL = selX
    const selR = selX + selEl.width
    const selT = selY
    const selB = selY + selEl.height

    for (const otherEl of elements) {
      if (otherEl.id === id || !otherEl.visible) continue
      const othL = otherEl.x
      const othR = otherEl.x + otherEl.width
      const othT = otherEl.y
      const othB = otherEl.y + otherEl.height

      // Check horizontal proximity
      if (othB > selT && othT < selB) {
        // Element is to the left
        if (othR <= selL) {
          const dist = selL - othR
          measurements.push({ x1: othR, y1: Math.max(selT, othT) + Math.min(selB, othB) - Math.max(selT, othT), x2: selL, y2: Math.max(selT, othT) + Math.min(selB, othB) - Math.max(selT, othT), dist, dir: 'h' })
        }
        // Element is to the right
        if (othL >= selR) {
          const dist = othL - selR
          measurements.push({ x1: selR, y1: Math.max(selT, othT) + Math.min(selB, othB) - Math.max(selT, othT), x2: othL, y2: Math.max(selT, othT) + Math.min(selB, othB) - Math.max(selT, othT), dist, dir: 'h' })
        }
      }

      // Check vertical proximity
      if (othR > selL && othL < selR) {
        // Element is above
        if (othB <= selT) {
          const dist = selT - othB
          measurements.push({ x1: Math.max(selL, othL) + Math.min(selR, othR) - Math.max(selL, othL), y1: othB, x2: Math.max(selL, othL) + Math.min(selR, othR) - Math.max(selL, othL), y2: selT, dist, dir: 'v' })
        }
        // Element is below
        if (othT >= selB) {
          const dist = othT - selB
          measurements.push({ x1: Math.max(selL, othL) + Math.min(selR, othR) - Math.max(selL, othL), y1: selB, x2: Math.max(selL, othL) + Math.min(selR, othR) - Math.max(selL, othL), y2: othT, dist, dir: 'v' })
        }
      }
    }

    // Only show the closest measurement in each direction
    const closestLeft = measurements.filter(m => m.dir === 'h' && m.x2 === selL).sort((a, b) => a.dist - b.dist)[0]
    const closestRight = measurements.filter(m => m.dir === 'h' && m.x1 === selR).sort((a, b) => a.dist - b.dist)[0]
    const closestTop = measurements.filter(m => m.dir === 'v' && m.y2 === selT).sort((a, b) => a.dist - b.dist)[0]
    const closestBottom = measurements.filter(m => m.dir === 'v' && m.y1 === selB).sort((a, b) => a.dist - b.dist)[0]

    const closestMeasurements = [closestLeft, closestRight, closestTop, closestBottom].filter(Boolean)

    if (closestMeasurements.length === 0) return null

    return (
      <g>
        {closestMeasurements.map((m, i) => {
          if (!m) return null
          const labelX = m.dir === 'h' ? (m.x1 + m.x2) / 2 : m.x2 + 8 / safeZoom
          const labelY = m.dir === 'h' ? m.y1 - 8 / safeZoom : (m.y1 + m.y2) / 2
          const distText = Math.round(m.dist).toString()
          const pillW = (distText.length * 6 + 8) / safeZoom
          const pillH = 14 / safeZoom
          return (
            <g key={`measure-${i}`}>
              {/* Measurement line */}
              <line
                x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
                stroke="#00C853"
                strokeWidth={1 / safeZoom}
              />
              {/* Perpendicular end markers (small T-shapes at endpoints) */}
              {m.dir === 'h' ? (
                <>
                  <line x1={m.x1} y1={m.y1 - 5 / safeZoom} x2={m.x1} y2={m.y1 + 5 / safeZoom} stroke="#00C853" strokeWidth={1 / safeZoom} />
                  <line x1={m.x2} y1={m.y2 - 5 / safeZoom} x2={m.x2} y2={m.y2 + 5 / safeZoom} stroke="#00C853" strokeWidth={1 / safeZoom} />
                </>
              ) : (
                <>
                  <line x1={m.x1 - 5 / safeZoom} y1={m.y1} x2={m.x1 + 5 / safeZoom} y2={m.y1} stroke="#00C853" strokeWidth={1 / safeZoom} />
                  <line x1={m.x2 - 5 / safeZoom} y1={m.y2} x2={m.x2 + 5 / safeZoom} y2={m.y2} stroke="#00C853" strokeWidth={1 / safeZoom} />
                </>
              )}
              {/* Distance label with background pill for readability */}
              <rect
                x={labelX - pillW / 2}
                y={labelY - pillH / 2}
                width={pillW}
                height={pillH}
                rx={3 / safeZoom}
                fill="#00C853"
                opacity={0.9}
              />
              <text
                x={labelX}
                y={labelY + 4 / safeZoom}
                fontSize={Math.max(8, 9 / safeZoom)}
                fill="white"
                fontFamily="Inter, system-ui, sans-serif"
                textAnchor="middle"
                fontWeight={500}
                style={{ pointerEvents: 'none' }}
              >
                {Math.round(m.dist)}
              </text>
            </g>
          )
        })}
      </g>
    )
  })() : null

  // Multi-select bounding box - blue dashed border like Figma
  const multiSelectBoxEl = selectedElementIds.length > 1 ? (() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    selectedElementIds.forEach(id => {
      const absPos = getAbsolutePosition(id)
      const el = findElementInList(elements, id)
      if (el && absPos) {
        minX = Math.min(minX, absPos.x)
        minY = Math.min(minY, absPos.y)
        maxX = Math.max(maxX, absPos.x + el.width)
        maxY = Math.max(maxY, absPos.y + el.height)
      }
    })
    if (minX === Infinity) return null
    return (
      <rect
        x={minX - 1} y={minY - 1}
        width={maxX - minX + 2} height={maxY - minY + 2}
        fill="none" stroke="#0D99FF" strokeWidth={1.5 / safeZoom}
        strokeDasharray={`${6 / safeZoom} ${3 / safeZoom}`}
        pointerEvents="none"
      />
    )
  })() : null

  // Snap lines
  const snapLinesEl = snapLines.length > 0 ? (
    <g>
      {snapLines.map((line, i) => {
        if (line.orientation === 'horizontal') {
          return <line key={i} x1={line.start} y1={line.position} x2={line.end} y2={line.position} stroke="#FF3B30" strokeWidth={1 / safeZoom} strokeDasharray={`${4 / safeZoom} ${2 / safeZoom}`} />
        } else {
          return <line key={i} x1={line.position} y1={line.start} x2={line.position} y2={line.end} stroke="#FF3B30" strokeWidth={1 / safeZoom} strokeDasharray={`${4 / safeZoom} ${2 / safeZoom}`} />
        }
      })}
    </g>
  ) : null

  // Guides
  const guidesEl = guides.length > 0 ? (
    <g>
      {guides.map(guide => {
        const pos = guide.position
        if (guide.orientation === 'horizontal') {
          return (
            <g key={guide.id}>
              <line x1={-10000} y1={pos} x2={10000} y2={pos} stroke="#0D99FF" strokeWidth={1 / safeZoom} strokeDasharray={`${4 / safeZoom} ${2 / safeZoom}`} pointerEvents="none" />
              <line x1={-10000} y1={pos} x2={10000} y2={pos} stroke="transparent" strokeWidth={4 / safeZoom}
                style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  const handleMove = (moveEvent: MouseEvent) => {
                    const canvasPos = screenToCanvas(moveEvent.clientX, moveEvent.clientY)
                    useEditorStore.getState().removeGuide(guide.id)
                    useEditorStore.getState().addGuide({ ...guide, position: Math.round(canvasPos.y) })
                  }
                  const handleUp = (upEvent: MouseEvent) => {
                    document.removeEventListener('mousemove', handleMove)
                    document.removeEventListener('mouseup', handleUp)
                    const canvasPos = screenToCanvas(upEvent.clientX, upEvent.clientY)
                    if (Math.abs(canvasPos.y - guide.position) < 5) {
                      useEditorStore.getState().removeGuide(guide.id)
                    }
                  }
                  document.addEventListener('mousemove', handleMove)
                  document.addEventListener('mouseup', handleUp)
                }}
              />
            </g>
          )
        } else {
          return (
            <g key={guide.id}>
              <line x1={pos} y1={-10000} x2={pos} y2={10000} stroke="#0D99FF" strokeWidth={1 / safeZoom} strokeDasharray={`${4 / safeZoom} ${2 / safeZoom}`} pointerEvents="none" />
              <line x1={pos} y1={-10000} x2={pos} y2={10000} stroke="transparent" strokeWidth={4 / safeZoom}
                style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  const handleMove = (moveEvent: MouseEvent) => {
                    const canvasPos = screenToCanvas(moveEvent.clientX, moveEvent.clientY)
                    useEditorStore.getState().removeGuide(guide.id)
                    useEditorStore.getState().addGuide({ ...guide, position: Math.round(canvasPos.x) })
                  }
                  const handleUp = (upEvent: MouseEvent) => {
                    document.removeEventListener('mousemove', handleMove)
                    document.removeEventListener('mouseup', handleUp)
                    const canvasPos = screenToCanvas(upEvent.clientX, upEvent.clientY)
                    if (Math.abs(canvasPos.x - guide.position) < 5) {
                      useEditorStore.getState().removeGuide(guide.id)
                    }
                  }
                  document.addEventListener('mousemove', handleMove)
                  document.addEventListener('mouseup', handleUp)
                }}
              />
            </g>
          )
        }
      })}
    </g>
  ) : null

  // Grid - dot grid pattern like Figma
  const gridEl = showGrid ? (
    <g opacity={0.3}>
      <defs>
        <pattern id="dotGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <circle cx={gridSize / 2} cy={gridSize / 2} r={0.6 / safeZoom} fill="#888" />
        </pattern>
        <pattern id="dotGridLarge" width={gridSize * 8} height={gridSize * 8} patternUnits="userSpaceOnUse">
          <rect width={gridSize * 8} height={gridSize * 8} fill="url(#dotGrid)" />
          <circle cx={gridSize * 4} cy={gridSize * 4} r={1 / safeZoom} fill="#888" />
        </pattern>
      </defs>
      <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#dotGridLarge)" />
    </g>
  ) : null

  // Layout Grid overlay for selected frames (column grid like Figma)
  const layoutGridEl = selectedElementIds.length === 1 ? (() => {
    const id = selectedElementIds[0]
    const el = findElementInList(elements, id)
    if (!el || el.type !== 'frame') return null
    // Show a 12-column grid overlay inside the frame (like Figma's layout grid)
    const cols = 12
    const gutter = 8
    const margin = 16
    const availW = el.width - margin * 2
    const colW = (availW - (cols - 1) * gutter) / cols
    if (colW <= 0) return null
    return (
      <g opacity={0.15}>
        {Array.from({ length: cols }, (_, i) => (
          <rect
            key={`col-${i}`}
            x={el.x + margin + i * (colW + gutter)}
            y={el.y}
            width={colW}
            height={el.height}
            fill="#FF3B30"
            stroke="none"
          />
        ))}
      </g>
    )
  })() : null

  // Origin crosshair
  const originEl = (
    <g opacity={0.3}>
      <line x1={0} y1={-10000} x2={0} y2={10000} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} />
      <line x1={-10000} y1={0} x2={10000} y2={0} stroke="#0D99FF" strokeWidth={0.5 / safeZoom} />
    </g>
  )

  // Frame drop highlight
  const dropHighlightEl = dropTargetFrameId ? (() => {
    const frame = findElementInList(elements, dropTargetFrameId)
    if (!frame) return null
    return (
      <rect
        x={frame.x - 2 / safeZoom} y={frame.y - 2 / safeZoom}
        width={frame.width + 4 / safeZoom} height={frame.height + 4 / safeZoom}
        fill="rgba(13,153,255,0.05)"
        stroke="#0D99FF"
        strokeWidth={2 / safeZoom}
        strokeDasharray={`${6 / safeZoom} ${3 / safeZoom}`}
        pointerEvents="none"
      />
    )
  })() : null

  const gradientCounter = { value: 0 }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1E1E1E] select-none" ref={containerRef} onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}>
      <Rulers
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />

      <CanvasContextMenu canvasX={0} canvasY={0}>
        <div
          className="w-full h-full"
          style={{ cursor: getCursor(), userSelect: 'none', WebkitUserSelect: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <svg
            className="w-full h-full canvas-svg-export"
            style={{ background: '#1E1E1E' }}
          >
            <g transform={`translate(${centerX}, ${centerY}) scale(${safeZoom})`}>
              {svgDefs}
              {gridEl}
              {layoutGridEl}
              {originEl}
              {guidesEl}
              {elements.map((el) => (
                <CanvasElement
                  key={el.id}
                  element={el}
                  zoom={safeZoom}
                  selectedIds={selectedElementIds}
                  onElementMouseDown={handleElementMouseDown}
                  onDoubleClick={handleElementDoubleClick}
                  viewportBounds={viewportBounds}
                />
              ))}
              {drawPreviewEl}
              {penPreviewEl}
              {pencilPreviewEl}
              {eyedropperEl}
              {selectionHandlesEl}
              {hoverHighlightEl}
              {measurementEl}
              {multiSelectBoxEl}
              {snapLinesEl}
              {dropHighlightEl}
              {rubberBand && isFinite(rubberBand.startX) && isFinite(rubberBand.endX) && isFinite(rubberBand.startY) && isFinite(rubberBand.endY) && (
                <rect
                  x={Math.min(rubberBand.startX, rubberBand.endX)}
                  y={Math.min(rubberBand.startY, rubberBand.endY)}
                  width={Math.abs(rubberBand.endX - rubberBand.startX)}
                  height={Math.abs(rubberBand.endY - rubberBand.startY)}
                  fill="rgba(13,153,255,0.08)"
                  stroke="#0D99FF"
                  strokeWidth={1 / safeZoom}
                  strokeDasharray={`${4 / safeZoom}`}
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
        </div>
      </CanvasContextMenu>

      {/* Frame breadcrumb */}
      {currentFrameId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#2C2C2C] rounded-lg px-3 py-1.5 border border-[#3C3C3C] shadow-lg z-20">
          <button
            onClick={() => exitFrame()}
            className="text-[11px] text-[#0D99FF] hover:text-[#0B87E0] transition-colors"
          >
            ← Back
          </button>
          <span className="text-[11px] text-[#888]">/</span>
          {useEditorStore.getState().frameBreadcrumb.map((name, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-[11px] text-[#888]">/</span>}
              <span className="text-[11px] text-[#DDD]">{name}</span>
            </React.Fragment>
          ))}
          <span className="text-[10px] text-[#666] ml-2">Press Esc to exit</span>
        </div>
      )}

      {/* Inline text editor */}
      {editingTextId && (
        <InlineTextEditor
          elementId={editingTextId}
          containerRef={containerRef}
          zoom={zoom}
          panX={panX}
          panY={panY}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          onClose={() => setEditingTextId(null)}
        />
      )}

      {/* Hidden canvas for eyedropper */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Selection info badge (bottom-left, Figma-style) */}
      {selectedElementIds.length > 0 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#2C2C2C]/90 backdrop-blur-sm rounded-lg border border-[#3C3C3C]/60 px-2 py-1 z-20">
          <span className="text-[10px] text-[#888] tabular-nums">
            {selectedElementIds.length} selected
          </span>
        </div>
      )}

      {/* Canvas coordinates (bottom-right, Figma-style) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-[#2C2C2C]/90 backdrop-blur-sm rounded-lg border border-[#3C3C3C]/60 px-2 py-1 z-20">
        <span className="text-[10px] text-[#666] tabular-nums">
          Zoom: {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  )
}
