'use client'

/**
 * PHASE 2 — FrameRenderer: standalone production SVG renderer for the
 * prototype player (and reusable anywhere a "clean" render of a frame is
 * needed, e.g. export previews).
 *
 * Why not reuse Canvas.tsx renderShape: that renderer is bound to editing
 * concerns (selection handles, zoom-compensated dash widths, hit-test
 * layers, frustum culling). The player needs a static, self-contained
 * tree render at 1:1 scale. Behavior for every element type mirrors the
 * Canvas shapes (same attributes, same defaults) without the editing
 * chrome — see ARCHITECTURE.md L3.
 */

import React from 'react'
import type { DesignElement } from '@/store/editor-store'
import { pathElementToSvgPath, isEvenOddFill } from '@/lib/element-utils'
import { calculateAutoLayout, hasAutoLayout } from '@/lib/auto-layout'
import { buildTextLines, applyTextCase } from '@/lib/text-measure'
// PHASE 14 — angular + diamond gradient paints
import { AngularPatternContent, DiamondPatternContent } from '@/lib/gradient-paints'
// PHASE 17 — ellipse arc + live boolean baked geometry
import { ellipseShapePath, arcIsEvenOdd } from '@/lib/arc'
import { booleanGroupPathD } from '@/lib/boolean-ops'

/** Resolve the SVG fill value for an element (solid / gradient / image). */
function fillOf(el: DesignElement): string {
  const fill = el.fills?.[0]
  if (fill) {
    if (fill.visible === false) return 'none'
    if (fill.type === 'solid') return fill.color === 'transparent' ? 'none' : fill.color
    if (fill.type === 'linear-gradient' || fill.type === 'radial-gradient' || fill.type === 'angular-gradient' || fill.type === 'diamond-gradient') return `url(#pf-grad-${el.id})`
    if (fill.type === 'image') return fill.imageUrl ? `url(#pf-img-${el.id})` : 'none'
    // PHASE 17 — pattern paint (tile repeat)
    if (fill.type === 'pattern') return fill.imageUrl ? `url(#pf-pat-${el.id})` : 'none'
  }
  return el.fill === 'transparent' ? 'none' : el.fill
}

/** <defs> for gradients, image fills and shadow/blur filters. */
function ElementDefs({ el }: { el: DesignElement }) {
  const fill = el.fills?.[0]
  const shadows = el.shadows || []
  const blurs = el.blurs || []
  const needsFilter = shadows.length > 0 || blurs.length > 0

  if (!fill && !needsFilter) return null

  return (
    <defs>
      {fill?.type === 'linear-gradient' && (
        <linearGradient id={`pf-grad-${el.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          {(fill.gradientStops || []).map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </linearGradient>
      )}
      {fill?.type === 'radial-gradient' && (
        <radialGradient id={`pf-grad-${el.id}`}>
          {(fill.gradientStops || []).map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </radialGradient>
      )}
      {fill?.type === 'angular-gradient' && (fill.gradientStops || []).length >= 2 && (
        <pattern id={`pf-grad-${el.id}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" x={0} y={0} width={1} height={1}>
          <AngularPatternContent stops={fill.gradientStops || []} angleDeg={fill.gradientAngle || 0} />
        </pattern>
      )}
      {fill?.type === 'diamond-gradient' && (fill.gradientStops || []).length >= 2 && (
        <pattern id={`pf-grad-${el.id}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" x={0} y={0} width={1} height={1}>
          <DiamondPatternContent stops={fill.gradientStops || []} idBase={`pf-dia-${el.id}`} />
        </pattern>
      )}
      {fill?.type === 'image' && fill.imageUrl && (
        <pattern id={`pf-img-${el.id}`} width="100%" height="100%" patternContentUnits="objectBoundingBox">
          <image href={fill.imageUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      )}
      {fill?.type === 'pattern' && fill.imageUrl && (
        <pattern id={`pf-pat-${el.id}`} patternUnits="userSpaceOnUse" x={0} y={0}
          width={Math.max(1, (fill.patternW || 100) * (fill.patternScale && fill.patternScale > 0 ? fill.patternScale : 1))}
          height={Math.max(1, (fill.patternH || 100) * (fill.patternScale && fill.patternScale > 0 ? fill.patternScale : 1))}>
          <image href={fill.imageUrl} x={0} y={0}
            width={Math.max(1, (fill.patternW || 100) * (fill.patternScale && fill.patternScale > 0 ? fill.patternScale : 1))}
            height={Math.max(1, (fill.patternH || 100) * (fill.patternScale && fill.patternScale > 0 ? fill.patternScale : 1))}
            preserveAspectRatio="none" />
        </pattern>
      )}
      {needsFilter && (
        <filter id={`pf-filter-${el.id}`} x="-50%" y="-50%" width="200%" height="200%">
          {shadows.map((s, i) => (
            <feDropShadow
              key={`sh-${i}`}
              dx={s.x}
              dy={s.y}
              stdDeviation={Math.max(0, s.blur / 2)}
              floodColor={s.color}
              floodOpacity={s.opacity}
            />
          ))}
          {blurs.map((b, i) => (
            <feGaussianBlur key={`bl-${i}`} stdDeviation={b.type === 'blur' ? b.radius : 0} />
          ))}
        </filter>
      )}
    </defs>
  )
}

/** Render one element's shape (children handled by the tree walker). */
function Shape({ el }: { el: DesignElement }) {
  const fillAttr = fillOf(el)
  const strokeAttr = el.stroke === 'transparent' ? 'none' : el.stroke
  const strokeDasharray =
    el.strokeStyle === 'dashed' ? '6 4' : el.strokeStyle === 'dotted' ? '2 2' : undefined
  const filter = (el.shadows?.length || el.blurs?.length) ? `url(#pf-filter-${el.id})` : undefined
  const scaleX = el.flipH ? -1 : 1
  const scaleY = el.flipV ? -1 : 1
  const transform =
    scaleX !== 1 || scaleY !== 1
      ? `scale(${scaleX}, ${scaleY}) translate(${scaleX === -1 ? -el.width : 0}, ${scaleY === -1 ? -el.height : 0})`
      : undefined
  const common = {
    fill: fillAttr,
    stroke: strokeAttr,
    strokeWidth: el.strokeWidth,
    strokeDasharray,
    opacity: el.opacity / 100,
    filter,
    transform,
  }

  switch (el.type) {
    case 'rectangle':
    case 'frame':
      return <rect x={0} y={0} width={el.width} height={el.height} rx={el.cornerRadius || el.cornerRadiusTL || 0} ry={el.cornerRadius || el.cornerRadiusTL || 0} {...common} />
    // PHASE 15 — section / table / sticky (prototype parity, simplified)
    case 'section':
      return (
        <g>
          <rect x={0} y={0} width={el.width} height={el.height} rx={el.cornerRadius || 0} {...common} />
          <text x={2} y={-8} fontSize={14} fontWeight={600} fontFamily="Inter, system-ui, sans-serif" fill="#888888" style={{ pointerEvents: 'none', userSelect: 'none' }}>{el.name}</text>
        </g>
      )
    case 'table': {
      const td15 = el.tableData
      if (!td15) return <rect x={0} y={0} width={el.width} height={el.height} {...common} />
      const gs = el.stroke === 'transparent' ? '#383838' : el.stroke
      const grid: React.ReactNode[] = []
      let gx = 0
      td15.colWidths.slice(0, -1).forEach((w, i) => { gx += w; grid.push(<line key={`c${i}`} x1={gx} y1={0} x2={gx} y2={el.height} stroke={gs} strokeWidth={1} />) })
      let gy = 0
      td15.rowHeights.slice(0, -1).forEach((h, i) => { gy += h; grid.push(<line key={`r${i}`} x1={0} y1={gy} x2={el.width} y2={gy} stroke={gs} strokeWidth={1} />) })
      let ty = 0
      const cellTexts: React.ReactNode[] = []
      td15.rowHeights.forEach((rh, ri) => {
        let tx = 0
        td15.colWidths.forEach((cw, ci) => {
          const t = td15.cells[ri]?.[ci] || ''
          if (t) cellTexts.push(<text key={`t${ri}-${ci}`} x={tx + 8} y={ty + rh / 2 + 4} fontSize={12} fontFamily="Inter, system-ui, sans-serif" fill={el.textColor || '#DDD'} fontWeight={td15.headerRow && ri === 0 ? 600 : 400} style={{ pointerEvents: 'none', userSelect: 'none' }}>{t}</text>)
          tx += cw
        })
        ty += rh
      })
      return (
        <g>
          <rect x={0} y={0} width={el.width} height={el.height} {...common} />
          {td15.headerRow && td15.rowHeights[0] > 0 && <rect x={0} y={0} width={el.width} height={td15.rowHeights[0]} fill="#2C2C2C" opacity={0.9} />}
          {grid}
          {cellTexts}
        </g>
      )
    }
    case 'sticky': {
      const fold15 = Math.min(28, el.width * 0.18, el.height * 0.18)
      const lines15 = (el.textContent || '').split('\n')
      const lineH15 = (el.fontSize || 14) * (el.lineHeight || 1.4)
      return (
        <g>
          <rect x={0} y={0} width={el.width} height={el.height} rx={el.cornerRadius || 4} {...common} />
          <path d={`M ${el.width - fold15} ${el.height} L ${el.width} ${el.height - fold15} L ${el.width} ${el.height} Z`} fill="#00000022" />
          {lines15.map((l, i) => (
            <text key={i} x={12} y={16 + i * lineH15} fontSize={el.fontSize || 14} fontFamily={el.fontFamily || 'Inter, system-ui, sans-serif'} fill={el.textColor || '#1E1E1E'} style={{ pointerEvents: 'none', userSelect: 'none' }}>{l}</text>
          ))}
        </g>
      )
    }
    case 'ellipse':
      // PHASE 17 — arc-aware (pie/donut)
      if (el.arc) {
        const ad = ellipseShapePath(el.width, el.height, el.arc)
        if (ad) return <path d={ad} fillRule={arcIsEvenOdd(el.arc) ? 'evenodd' : undefined} strokeLinejoin="round" {...common} />
      }
      return <ellipse cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2} {...common} />
    case 'line':
      return (
        <line
          x1={0} y1={0} x2={el.width} y2={el.height}
          stroke={el.stroke === 'transparent' ? '#000000' : el.stroke}
          strokeWidth={el.strokeWidth || 2}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          opacity={el.opacity / 100}
        />
      )
    case 'arrow': {
      const stroke = el.stroke === 'transparent' ? '#000000' : el.stroke
      const w = el.strokeWidth || 2
      const angle = Math.atan2(el.height, el.width)
      const headLen = Math.max(10, w * 5)
      return (
        <g opacity={el.opacity / 100}>
          <line x1={0} y1={0} x2={el.width} y2={el.height} stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeDasharray={strokeDasharray} />
          <polygon
            points={`${el.width},${el.height} ${el.width - headLen * Math.cos(angle - Math.PI / 6)},${el.height - headLen * Math.sin(angle - Math.PI / 6)} ${el.width - headLen * Math.cos(angle + Math.PI / 6)},${el.height - headLen * Math.sin(angle + Math.PI / 6)}`}
            fill={stroke}
          />
        </g>
      )
    }
    case 'text': {
      const fontSize = el.fontSize || 18
      const lineHeightPx = fontSize * (el.lineHeight || 1.4)
      // PHASE 13: list-aware lines + vertical alignment (parity with Canvas)
      const params = {
        text: el.textContent || 'Text',
        fontFamily: el.fontFamily || 'Inter',
        fontSize,
        fontWeight: el.fontWeight || 400,
        lineHeight: el.lineHeight || 1.4,
        letterSpacing: el.letterSpacing || 0,
        fontStyle: el.fontStyle,
      }
      const displayLines = buildTextLines(params, {
        listType: el.listType || 'none',
        listIndent: el.listIndent || 0,
        autoResize: el.textAutoResize || 'fixed',
        boxWidth: el.width,
      })
      const lines = displayLines.map(l => ({ ...l, text: applyTextCase(l.text, el.textCase) }))
      const totalH = lines.length * lineHeightPx
      const valign = el.textAlignVertical || 'middle'
      const vOff = valign === 'top' ? 0 : valign === 'bottom' ? Math.max(0, el.height - totalH) : Math.max(0, (el.height - totalH) / 2)
      const startY = vOff + fontSize
      const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'
      const x = el.textAlign === 'center'
        ? (l: { x: number }) => l.x + (el.width - l.x) / 2
        : el.textAlign === 'right'
          ? () => el.width
          : (l: { x: number }) => l.x
      return (
        <g opacity={el.opacity / 100}>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line.prefix && (
                <text
                  x={line.prefixX ?? 0}
                  y={startY + i * lineHeightPx}
                  fontSize={fontSize}
                  fontWeight={el.fontWeight || 400}
                  fontFamily={el.fontFamily || 'Inter, system-ui, sans-serif'}
                  fontStyle={el.fontStyle || 'normal'}
                  letterSpacing={el.letterSpacing || 0}
                  fill={el.textColor || el.fill || '#000000'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {line.prefix}
                </text>
              )}
              <text
                x={x(line)}
                y={startY + i * lineHeightPx}
                fontSize={fontSize}
                fontWeight={el.fontWeight || 400}
                fontFamily={el.fontFamily || 'Inter, system-ui, sans-serif'}
                fontStyle={el.fontStyle || 'normal'}
                letterSpacing={el.letterSpacing || 0}
                fill={el.textColor || el.fill || '#000000'}
                textAnchor={anchor}
                textDecoration={el.textDecoration || 'none'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {line.text}
              </text>
            </React.Fragment>
          ))}
        </g>
      )
    }
    case 'star': {
      const sides = el.sides || 5
      const cx = el.width / 2
      const cy = el.height / 2
      const outerR = Math.min(el.width, el.height) / 2
      const innerR = outerR * ((el.innerRadius || 40) / 100)
      const points: string[] = []
      for (let i = 0; i < sides * 2; i++) {
        const angle = (i * Math.PI) / sides - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
      }
      return <polygon points={points.join(' ')} {...common} />
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
      return <polygon points={points.join(' ')} {...common} />
    }
    case 'path': {
      const d = pathElementToSvgPath(el)
      if (!d) return null
      return <path d={d} fill={fillAttr} fillRule={isEvenOddFill(el) ? 'evenodd' : undefined} stroke={strokeAttr} strokeWidth={el.strokeWidth || 2} strokeLinecap="round" strokeLinejoin="round" opacity={el.opacity / 100} strokeDasharray={strokeDasharray} />
    }
    case 'boolean': {
      // PHASE 17 — true baked geometry (was: bbox rect via default branch)
      const bd = booleanGroupPathD(el)
      if (!bd) return <rect x={0} y={0} width={el.width} height={el.height} {...common} />
      return <path d={bd} fill={fillAttr} fillRule="evenodd" stroke={strokeAttr} strokeWidth={el.strokeWidth || 2} strokeLinejoin="round" opacity={el.opacity / 100} strokeDasharray={strokeDasharray} />
    }
    default:
      return <rect x={0} y={0} width={el.width} height={el.height} {...common} />
  }
}

/** Recursively render an element tree inside a translated <g>. */
function TreeNode({
  el,
  elementStyle,
}: {
  el: DesignElement
  /** Per-element inline style override (used by smart-animate tweens). */
  elementStyle?: (el: DesignElement) => React.CSSProperties | undefined
}) {
  if (!el.visible) return null

  const isContainer = (el.type === 'frame' || el.type === 'group' || el.type === 'section' || el.type === 'component-set') && el.children?.length
  let children = el.children
  if (el.type === 'frame' && hasAutoLayout(el) && el.children) {
    children = calculateAutoLayout(el)
  }

  // PHASE 6: render children honoring mask semantics (a mask child clips all
  // previous siblings + itself within this parent).
  const renderChildrenWithMasks = (kids: DesignElement[]): React.ReactNode => {
    const groups: React.ReactNode[] = []
    let buffer: React.ReactNode[] = []
    for (const child of kids) {
      if (!child.visible) continue
      if (child.isMask) {
        const clipId = `pf-mask-${el.id}-${child.id}`
        const clipShape = maskClipShape(child)
        if (clipShape) {
          groups.push(
            <g key={clipId}>
              <defs>
                <clipPath id={clipId}>
                  <g transform={`translate(${child.x}, ${child.y})${child.rotation ? ` rotate(${child.rotation} ${child.width / 2} ${child.height / 2})` : ''}`}>
                    {clipShape}
                  </g>
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                {buffer}
                <TreeNode key={child.id} el={child} elementStyle={elementStyle} />
              </g>
            </g>
          )
          buffer = []
        } else {
          buffer.push(<TreeNode key={child.id} el={child} elementStyle={elementStyle} />)
        }
      } else {
        buffer.push(<TreeNode key={child.id} el={child} elementStyle={elementStyle} />)
      }
    }
    groups.push(...buffer)
    return groups
  }

  return (
    <g transform={`translate(${el.x}, ${el.y})${el.rotation ? ` rotate(${el.rotation} ${el.width / 2} ${el.height / 2})` : ''}`} style={elementStyle?.(el)}>
      <ElementDefs el={el} />
      {/* frame/group containers clip their children when clipContent is set */}
      {isContainer && el.clipContent && el.type === 'frame' ? (
        <defs>
          <clipPath id={`pf-clip-${el.id}`}>
            <rect x={0} y={0} width={el.width} height={el.height} rx={el.cornerRadius || 0} />
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={isContainer && el.clipContent && el.type === 'frame' ? `url(#pf-clip-${el.id})` : undefined}>
        {/* The container's own background */}
        <Shape el={el} />
        {children ? renderChildrenWithMasks(children) : null}
      </g>
    </g>
  )
}

/** PHASE 6: clip geometry for a mask child (local coords). */
function maskClipShape(mask: DesignElement): React.ReactNode {
  switch (mask.type) {
    case 'rectangle':
      return <rect x={0} y={0} width={mask.width} height={mask.height} rx={mask.cornerRadius || 0} ry={mask.cornerRadius || 0} />
    case 'ellipse':
      // PHASE 17 — arc-aware mask shape
      if (mask.arc) {
        const md = ellipseShapePath(mask.width, mask.height, mask.arc)
        if (md) return <path d={md} fillRule={arcIsEvenOdd(mask.arc) ? 'evenodd' : undefined} />
      }
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

/**
 * Render a full frame tree into an <svg> sized to the frame.
 * `style`/`className` are forwarded so the player can animate the wrapper.
 */
export function FrameRenderer({
  frame,
  className,
  style,
  onElementPointerDown,
  onElementHover,
  onElementEvent,
  interactive = false,
  elementStyle,
}: {
  frame: DesignElement
  className?: string
  style?: React.CSSProperties
  /** When interactive, elements with interactions get pointer handlers. */
  onElementPointerDown?: (el: DesignElement, e: React.PointerEvent) => void
  /** Hover triggers (prototype player) — legacy. */
  onElementHover?: (el: DesignElement) => void
  /** PHASE 16 — discrete mouse events for the separate triggers. */
  onElementEvent?: (el: DesignElement, kind: 'enter' | 'leave' | 'down' | 'up', e: React.PointerEvent) => void
  interactive?: boolean
  /** Per-element inline style override (smart-animate tweens). */
  elementStyle?: (el: DesignElement) => React.CSSProperties | undefined
}) {
  // Interactive mode: attach pointer handlers to every element <g> that has
  // interactions, using per-element hit rects (transparent shapes).
  const renderInteractive = (el: DesignElement): React.ReactNode => {
    if (!el.visible) return null
    const hasInteractions = (el.interactions?.length ?? 0) > 0
    let children = el.children
    if (el.type === 'frame' && hasAutoLayout(el) && el.children) {
      children = calculateAutoLayout(el)
    }
    return (
      <g key={el.id} transform={`translate(${el.x}, ${el.y})${el.rotation ? ` rotate(${el.rotation} ${el.width / 2} ${el.height / 2})` : ''}`} style={elementStyle?.(el)}>
        <ElementDefs el={el} />
        <Shape el={el} />
        {children?.map(renderInteractive)}
        {hasInteractions && onElementPointerDown && (
          <rect
            x={0}
            y={0}
            width={el.width}
            height={el.height}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => { onElementEvent?.(el, 'down', e); onElementPointerDown(el, e) }}
            onPointerUp={(e) => onElementEvent?.(el, 'up', e)}
            onPointerEnter={(e) => { onElementEvent?.(el, 'enter', e); onElementHover?.(el) }}
            onPointerLeave={(e) => onElementEvent?.(el, 'leave', e)}
          />
        )}
      </g>
    )
  }

  return (
    <svg
      width={frame.width}
      height={frame.height}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className={className}
      style={{ display: 'block', ...style }}
    >
      {interactive && onElementPointerDown
        ? frame.children?.map(renderInteractive)
        : frame.children?.map((child) => <TreeNode key={child.id} el={child} elementStyle={elementStyle} />)}
    </svg>
  )
}
