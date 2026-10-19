'use client'

import React, { useMemo } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import { findElementInList, getVectorNetwork, getAllElements, pathElementToSvgPath, isEvenOddFill } from '@/lib/element-utils'
import { calculateAutoLayout, hasAutoLayout } from '@/lib/auto-layout'
import { Rulers } from './Rulers'
import { CanvasContextMenu } from './CanvasContextMenu'
import { InlineTextEditor } from './InlineTextEditor'
import { getHandlePositions, handleCursors, isElementInViewport, type HandlePosition } from './canvas/canvas-helpers'
import { useCanvasViewport } from './canvas/use-canvas-viewport'
import { useCanvasHitTest } from './canvas/use-canvas-hittest'
import { usePenTool } from './canvas/use-pen-tool'
import { usePathEditing } from './canvas/use-path-editing'
import { useElementInteractions } from './canvas/use-element-interactions'
import { useCanvasKeyboard } from './canvas/use-canvas-keyboard'
// PHASE 8 — per-frame layout grids renderer
import { FrameGrids } from './canvas/FrameGrids'
// PHASE 10 — real text measurement + case transform
import { measureText, measureLine, applyTextCase, buildTextLines } from '@/lib/text-measure'

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
        // PHASE 10 — image fill modes: fill (cover), fit (contain), crop (manual)
        const mode = fill.scaleMode || 'fill'
        if (mode === 'crop') {
          // userSpaceOnUse pattern sized to the element; image placed with
          // manual scale/offset, clipped by the pattern tile
          const s = fill.scale && fill.scale > 0 ? fill.scale : 1
          const ox = fill.offsetX || 0
          const oy = fill.offsetY || 0
          defs.push(
            <pattern key={id} id={id} patternUnits="userSpaceOnUse" width={Math.max(1, el.width)} height={Math.max(1, el.height)} x={0} y={0}>
              <image href={fill.imageUrl} x={ox} y={oy} width={el.width * s} height={el.height * s} preserveAspectRatio="none" />
            </pattern>
          )
        } else {
          defs.push(
            <pattern key={id} id={id} patternUnits="objectBoundingBox" width="100%" height="100%">
              <image href={fill.imageUrl} width="100%" height="100%" preserveAspectRatio={mode === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'} />
            </pattern>
          )
        }
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
        // PHASE 10: real measurement drives line layout (wrap for grow, shrink for hug)
        const autoResize = el.textAutoResize || 'fixed'
        const measureParams = {
          text: el.textContent || 'Text',
          fontFamily: el.fontFamily || 'Inter',
          fontSize, fontWeight, lineHeight, letterSpacing, fontStyle,
        }
        // PHASE 13: list-aware lines (bullets / numbers with hanging indent)
        const displayLines = buildTextLines(measureParams, {
          listType: el.listType || 'none',
          listIndent: el.listIndent || 0,
          autoResize,
          boxWidth: el.width,
        })
        const lines = displayLines.map((l) => ({ ...l, text: applyTextCase(l.text, el.textCase) }))
        const lineHeightPx = fontSize * lineHeight
        const totalTextHeight = lines.length * lineHeightPx
        // PHASE 13: vertical alignment inside the text box (top/middle/bottom)
        const valign = el.textAlignVertical || 'middle'
        const valignOffset = valign === 'top' ? 0 : valign === 'bottom' ? Math.max(0, el.height - totalTextHeight) : Math.max(0, (el.height - totalTextHeight) / 2)
        const startY = valignOffset + fontSize
        const clipId = `text-clip-${el.id}`
        const anchorX = (i: number) =>
          textAlign === 'center' ? el.width / 2 : textAlign === 'right' ? el.width : 0
        void anchorX
        // PHASE 13: justified — distribute words across the full line width
        // (except the last line and lines that can't stretch)
        const justifyLine = (lineText: string, lineX: number, isLast: boolean): { words: { w: string; x: number }[]; justified: boolean } => {
          const words = lineText.split(/\s+/).filter(Boolean)
          const avail = el.width - lineX
          if (isLast || words.length < 2) return { words: [{ w: lineText, x: lineX }], justified: false }
          const wordsW = words.map(w2 => measureLine(w2, measureParams))
          const totalW = wordsW.reduce((a, b) => a + b, 0)
          if (totalW >= avail) return { words: [{ w: lineText, x: lineX }], justified: false }
          const gapW = (avail - totalW) / (words.length - 1)
          let cursor = lineX
          return {
            words: words.map((w2, i2) => {
              const item = { w: w2, x: cursor }
              cursor += wordsW[i2] + gapW
              return item
            }),
            justified: true,
          }
        }
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
              {lines.map((line, i) => {
                // anchor x for center/right is computed against the usable
                // region (after list indent/prefix), so lists can center too
                const baseX = textAlign === 'center'
                  ? line.x + (el.width - line.x) / 2
                  : textAlign === 'right'
                    ? el.width
                    : line.x
                const isJustified = textAlign === 'justified'
                const jres = isJustified ? justifyLine(line.text, line.x, i === lines.length - 1) : null
                return (
                  <g key={i}>
                    {/* PHASE 13: list prefix (bullet / number) at hanging indent */}
                    {line.prefix && (
                      <text
                        x={line.prefixX ?? 0}
                        y={startY + i * lineHeightPx}
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                        fontFamily={fontFamily}
                        fontStyle={fontStyle}
                        letterSpacing={letterSpacing}
                        fill={textColor}
                        opacity={el.opacity / 100}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {line.prefix}
                      </text>
                    )}
                    {jres && jres.justified ? (
                      /* PHASE 13: justified — words distributed across the width */
                      jres.words.map((wordEl, wi) => (
                        <text
                          key={wi}
                          x={wordEl.x}
                          y={startY + i * lineHeightPx}
                          fontSize={fontSize}
                          fontWeight={fontWeight}
                          fontFamily={fontFamily}
                          fontStyle={fontStyle}
                          letterSpacing={letterSpacing}
                          fill={textColor}
                          textDecoration={textDecoration === 'underline' ? 'underline' : undefined}
                          opacity={el.opacity / 100}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {wordEl.w}
                        </text>
                      ))
                    ) : (
                      <text
                        x={baseX}
                        y={startY + i * lineHeightPx}
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                        fontFamily={fontFamily}
                        fontStyle={fontStyle}
                        letterSpacing={letterSpacing}
                        fill={textColor}
                        textAnchor={textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'}
                        textDecoration={textDecoration === 'underline' ? 'underline' : undefined}
                        opacity={el.opacity / 100}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {line.text}
                      </text>
                    )}
                    {/* PHASE 10: manual strikethrough (SVG line-through support is inconsistent) */}
                    {textDecoration === 'strikethrough' && line.text.length > 0 && (() => {
                      const w = measureLine(line.text, measureParams)
                      const sx = textAlign === 'center' ? baseX - w / 2 : textAlign === 'right' ? baseX - w : baseX
                      const sy = startY + i * lineHeightPx - fontSize * 0.28
                      return <line x1={sx} y1={sy} x2={sx + w} y2={sy} stroke={textColor} strokeWidth={Math.max(1, fontSize * 0.06)} />
                    })()}
                  </g>
                )
              })}
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
            fillRule={isEvenOddFill(el) ? 'evenodd' : undefined}
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
      
      {/* Render children on top of the frame's own shape.
          PHASE 6 mask semantics: a child with isMask clips all PREVIOUS
          siblings (+ the mask itself) within this parent. */}
      {effectiveChildren && (() => {
        const renderChild = (child: DesignElement) => (
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
        const maskClipShape = (mask: DesignElement) => {
          switch (mask.type) {
            case 'rectangle':
              return <rect x={0} y={0} width={mask.width} height={mask.height} rx={mask.cornerRadius || 0} ry={mask.cornerRadius || 0} />
            case 'ellipse':
              return <ellipse cx={mask.width / 2} cy={mask.height / 2} rx={mask.width / 2} ry={mask.height / 2} />
            case 'polygon': {
              const sides = mask.sides || 6
              const r = Math.min(mask.width, mask.height) / 2
              const pts: string[] = []
              for (let i = 0; i < sides; i++) {
                const a = (i * 2 * Math.PI) / sides - Math.PI / 2
                pts.push(`${(mask.width / 2) + r * Math.cos(a)},${(mask.height / 2) + r * Math.sin(a)}`)
              }
              return <polygon points={pts.join(' ')} />
            }
            case 'star': {
              const sides = mask.sides || 5
              const outerR = Math.min(mask.width, mask.height) / 2
              const innerR = outerR * ((mask.innerRadius || 40) / 100)
              const pts: string[] = []
              for (let i = 0; i < sides * 2; i++) {
                const a = (i * Math.PI) / sides - Math.PI / 2
                const r = i % 2 === 0 ? outerR : innerR
                pts.push(`${(mask.width / 2) + r * Math.cos(a)},${(mask.height / 2) + r * Math.sin(a)}`)
              }
              return <polygon points={pts.join(' ')} />
            }
            case 'path': {
              const d = pathElementToSvgPath(mask)
              return d ? <path d={d} fillRule={isEvenOddFill(mask) ? 'evenodd' : undefined} /> : null
            }
            default:
              return null
          }
        }
        const groups: React.ReactNode[] = []
        let buffer: React.ReactNode[] = []
        for (const child of effectiveChildren) {
          if (!child.visible) continue
          if (child.isMask) {
            const clipId = `mask-${element.id}-${child.id}`
            const clipShape = maskClipShape(child)
            if (clipShape) {
              groups.push(
                <g key={clipId}>
                  <defs>
                    <clipPath id={clipId}>
                      <g transform={`translate(${child.x}, ${child.y})${child.rotation ? ` rotate(${child.rotation}, ${child.width / 2}, ${child.height / 2})` : ''}`}>
                        {clipShape}
                      </g>
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {buffer}
                    {renderChild(child)}
                  </g>
                </g>
              )
              buffer = []
            } else {
              // unsupported mask geometry — render unclipped
              buffer.push(renderChild(child))
            }
          } else {
            buffer.push(renderChild(child))
          }
        }
        groups.push(...buffer)
        return (
          <g clipPath={element.clipContent ? `url(#clip-${element.id})` : undefined}>
            {groups}
          </g>
        )
      })()}
      
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
  // Store state needed for rendering
  const elements = useEditorStore((s) => s.elements)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const activeTool = useEditorStore((s) => s.activeTool)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const showGrid = useEditorStore((s) => s.showGrid)
  const gridSize = useEditorStore((s) => s.gridSize)
  // PHASE 8 — view options
  const showPixelGrid = useEditorStore((s) => s.showPixelGrid)
  const guides = useEditorStore((s) => s.guides)
  const currentFrameId = useEditorStore((s) => s.currentFrameId)
  const exitFrame = useEditorStore((s) => s.exitFrame)

  // --- P4 refactor: the component now composes focused hooks ---------------
  // viewport: pan / zoom / fit / wheel / space-panning / container size
  const viewport = useCanvasViewport()
  const { containerRef, containerSize, screenToCanvas, handleWheel } = viewport

  // hitTest: geometry lookups (element / frame / resize-handle under cursor)
  const hitTest = useCanvasHitTest()
  const { getAbsolutePosition } = hitTest

  // pen: bezier pen + freehand pencil state machines
  const pen = usePenTool({ findParentFrameAtPosition: hitTest.findParentFrameAtPosition })
  const { penPoints, penCursorPos, isPencilDrawing, pencilPoints } = pen

  // pathEditing: double-click anchor/tangent editing of existing paths
  const pathEditing = usePathEditing({ getAbsolutePosition })
  const { editingPathId, editingPointIndex, handlePathAnchorClick, handlePathTangentClick } = pathEditing

  // interactions: drag / resize / rubber-band / draw preview / eyedropper
  const interactions = useElementInteractions({ viewport, hitTest, pen, pathEditing })
  const {
    isDrawing, drawStart, drawCurrent, rubberBand, snapLines, hoveredElementId,
    dropTargetFrameId, eyedropperPos, eyedropperColor, editingTextId, setEditingTextId,
    hiddenCanvasRef, isScaling, hoverDistances,
    handleElementMouseDown, handleElementDoubleClick, handleMouseDown, handleMouseMove,
    handleMouseUp, handleDoubleClick, handleDrop, handleDragOver, getCursor,
  } = interactions

  // keyboard: global shortcut layer (undo, tools, zoom, clipboard, ...)
  useCanvasKeyboard({
    fitToScreen: viewport.fitToScreen,
    zoomToSelection: viewport.zoomToSelection,
    pen,
    pathEditing,
    editingTextId,
    setEditingTextId,
    setSpaceHeld: viewport.setSpaceHeld,
    setAltHeld: interactions.setAltHeld,
    resetDrawingState: interactions.resetDrawingState,
  })


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

  // PHASE 11 — Scale tool: 4 corner handles on the selection bbox (any selection size)
  const scaleHandlesEl = activeTool === 'scale' && selectedElementIds.length > 0 ? (() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const walk = (els: DesignElement[], px: number, py: number) => {
      for (const el of els) {
        if (selectedElementIds.includes(el.id)) {
          minX = Math.min(minX, el.x + px)
          minY = Math.min(minY, el.y + py)
          maxX = Math.max(maxX, el.x + px + el.width)
          maxY = Math.max(maxY, el.y + py + el.height)
        }
        if (el.children) walk(el.children, px + el.x, py + el.y)
      }
    }
    walk(elements, 0, 0)
    if (minX === Infinity) return null
    const corners = [
      [minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY],
    ] as const
    const r = 5 / safeZoom
    return (
      <g pointerEvents="none">
        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="none" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} />
        {corners.map(([cx, cy], i) => (
          <rect key={i} x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#FFFFFF" stroke="#0D99FF" strokeWidth={1.5 / safeZoom} />
        ))}
        {isScaling && (
          <text x={minX} y={minY - 8 / safeZoom} fontSize={11 / safeZoom} fill="#0D99FF" fontFamily="Inter, system-ui" style={{ pointerEvents: 'none' }}>
            scale
          </text>
        )}
      </g>
    )
  })() : null

  // PHASE 11 — alt+hover distance measurement overlay (pink, Figma-style)
  const distanceMeasureEl = hoverDistances ? (() => {
    const { selBox, hovBox, dx, dy, leftGap, rightGap, topGap, bottomGap } = hoverDistances
    const stroke = '#FF3B8E'
    const sw = 1.5 / safeZoom
    const segs: React.ReactNode[] = []
    const labels: React.ReactNode[] = []
    const pill = (x: number, y: number, text: string, key: string) => {
      const w = Math.max(text.length * 6.5, 16) / safeZoom
      const h = 14 / safeZoom
      labels.push(
        <g key={key} style={{ pointerEvents: 'none' }}>
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3 / safeZoom} fill={stroke} />
          <text x={x} y={y + 3.5 / safeZoom} fontSize={9 / safeZoom} fill="#fff" textAnchor="middle" fontFamily="Inter, system-ui">{text}</text>
        </g>
      )
    }
    // horizontal gaps (elements vertically overlapping)
    if (leftGap !== null) {
      const y = (Math.max(selBox.y, hovBox.y) + Math.min(selBox.y + selBox.h, hovBox.y + hovBox.h)) / 2
      const x1 = Math.min(selBox.x, hovBox.x + hovBox.w)
      const x2 = Math.max(selBox.x, hovBox.x + hovBox.w)
      segs.push(<line key="lg" x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={sw} />)
      if (Math.abs(leftGap) > 0) pill((x1 + x2) / 2, y, `${leftGap}`, 'lgl')
    }
    if (rightGap !== null) {
      const y = (Math.max(selBox.y, hovBox.y) + Math.min(selBox.y + selBox.h, hovBox.y + hovBox.h)) / 2
      const x1 = Math.min(selBox.x + selBox.w, hovBox.x)
      const x2 = Math.max(selBox.x + selBox.w, hovBox.x)
      segs.push(<line key="rg" x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={sw} />)
      if (Math.abs(rightGap) > 0) pill((x1 + x2) / 2, y, `${rightGap}`, 'rgl')
    }
    // vertical gaps (elements horizontally overlapping)
    if (topGap !== null) {
      const x = (Math.max(selBox.x, hovBox.x) + Math.min(selBox.x + selBox.w, hovBox.x + hovBox.w)) / 2
      const y1 = Math.min(selBox.y, hovBox.y + hovBox.h)
      const y2 = Math.max(selBox.y, hovBox.y + hovBox.h)
      segs.push(<line key="tg" x1={x} y1={y1} x2={x} y2={y2} stroke={stroke} strokeWidth={sw} />)
      if (Math.abs(topGap) > 0) pill(x, (y1 + y2) / 2, `${topGap}`, 'tgl')
    }
    if (bottomGap !== null) {
      const x = (Math.max(selBox.x, hovBox.x) + Math.min(selBox.x + selBox.w, hovBox.x + hovBox.w)) / 2
      const y1 = Math.min(selBox.y + selBox.h, hovBox.y)
      const y2 = Math.max(selBox.y + selBox.h, hovBox.y)
      segs.push(<line key="bg" x1={x} y1={y1} x2={x} y2={y2} stroke={stroke} strokeWidth={sw} />)
      if (Math.abs(bottomGap) > 0) pill(x, (y1 + y2) / 2, `${bottomGap}`, 'bgl')
    }
    // diagonal gaps (no overlap on either axis)
    if (dx !== null && dy !== null) {
      // horizontal nearest-edge distance at the shared vertical band
      const y = (Math.max(selBox.y, hovBox.y) + Math.min(selBox.y + selBox.h, hovBox.y + hovBox.h)) / 2
      const x1 = hovBox.x < selBox.x ? hovBox.x + hovBox.w : selBox.x + selBox.w
      const x2 = hovBox.x < selBox.x ? selBox.x : hovBox.x
      segs.push(<line key="dx" x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={sw} />)
      pill((x1 + x2) / 2, y, `${Math.round(x2 - x1)}`, 'dxl')
    }
    if (dx !== null && dy !== null) {
      const x = (Math.max(selBox.x, hovBox.x) + Math.min(selBox.x + selBox.w, hovBox.x + hovBox.w)) / 2
      const y1 = hovBox.y < selBox.y ? hovBox.y + hovBox.h : selBox.y + selBox.h
      const y2 = hovBox.y < selBox.y ? selBox.y : hovBox.y
      segs.push(<line key="dy" x1={x} y1={y1} x2={x} y2={y2} stroke={stroke} strokeWidth={sw} />)
      pill(x, (y1 + y2) / 2, `${Math.round(y2 - y1)}`, 'dyl')
    }
    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect x={hovBox.x} y={hovBox.y} width={hovBox.w} height={hovBox.h} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={`${4 / safeZoom} ${3 / safeZoom}`} />
        {segs}
        {labels}
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

  // PHASE 8 — per-frame layout grids (replaces the old hardcoded 12-col overlay)
  const layoutGridEl = <FrameGrids />

  // PHASE 8 — pixel grid: Figma shows it only at zoom >= 400%
  const pixelGridEl = showPixelGrid && safeZoom >= 4 ? (
    <g pointerEvents="none">
      <defs>
        <pattern id="pixelGrid" width={1} height={1} patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#3C3C3C" strokeWidth={1 / safeZoom} />
        </pattern>
      </defs>
      <rect x={viewportBounds.minX} y={viewportBounds.minY} width={viewportBounds.maxX - viewportBounds.minX} height={viewportBounds.maxY - viewportBounds.minY} fill="url(#pixelGrid)" />
    </g>
  ) : null

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
              {pixelGridEl}
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
              {scaleHandlesEl}
              {distanceMeasureEl}
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
