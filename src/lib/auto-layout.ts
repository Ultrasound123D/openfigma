import type { DesignElement, AutoLayout } from '@/store/editor-store'
import { measureText } from '@/lib/text-measure'

/**
 * PHASE 12 — Full auto layout engine (Figma parity).
 *
 * Source evidence (port-source/analysis/phase12_16_gap_analysis.md):
 *   layoutMode HORIZONTAL 88 / VERTICAL 81 / WRAP 14
 *   layoutSizingHorizontal + layoutSizingVertical (FILL 81 / FIXED 18 / HUG 8)
 *   primaryAxisAlignItems / counterAxisAlignItems / itemSpacing / counterAxisSpacing
 *   minWidth / minHeight / maxWidth / maxHeight (13 refs each)
 *
 * Semantics implemented:
 * - direction: horizontal | vertical (main axis)
 * - wrap: children flow into lines when the main-axis extent overflows a FIXED
 *   frame extent; lines stack along the counter axis separated by counterAxisGap;
 *   line stacking uses counterAxisAlignContent (start/center/end/space-between).
 *   (wrap + hug counter-axis sizing degenerates to a single line, like Figma.)
 * - Frame sizing per axis: primaryAxisSizing / counterAxisSizing
 *     fixed → keep frame.width/height as authored
 *     hug   → frame sizes to its content (+ padding)
 *     fill  → frame is stretched by its PARENT auto layout (via the frame's own
 *             layoutSizingH/V); at this level it behaves like fixed.
 * - Child sizing per axis: layoutSizingH / layoutSizingV
 *     fixed → keep child.width/height
 *     hug   → child sizes to content (text measured via canvas 2D; nested
 *             auto-layout frames computed recursively; other types keep size)
 *     fill  → stretches: main axis = share of leftover space among fill children
 *             (flex-grow style); counter axis = full inner extent (or line extent
 *             when wrapping).
 * - alignItems legacy 'stretch' keeps pre-PHASE-12 behavior (all children stretch
 *   on the counter axis). New 'baseline' aligns text children by first baseline
 *   (horizontal direction only; falls back to start otherwise).
 * - layoutPositioning 'absolute' children are excluded from the flow and keep
 *   their authored x/y relative to the frame.
 * - minWidth/maxWidth/minHeight/maxHeight clamp the final frame size.
 */

export interface AutoLayoutResult {
  /** children with flow positions applied (invisible + absolute children unchanged) */
  children: DesignElement[]
  /** final frame width (sizing modes + min/max applied) */
  width: number
  /** final frame height (sizing modes + min/max applied) */
  height: number
}

type AxisSizing = 'fixed' | 'hug' | 'fill'

function isTextLike(el: DesignElement): boolean {
  return el.type === 'text' && typeof el.textContent === 'string'
}

/** Measure a text child's content size for hug sizing. */
function textContentSize(el: DesignElement): { width: number; height: number } {
  if (!isTextLike(el)) return { width: el.width, height: el.height }
  const autoResize = el.textAutoResize || 'grow'
  const p = {
    text: el.textContent || '',
    fontFamily: el.fontFamily || 'Inter',
    fontSize: el.fontSize || 16,
    fontWeight: el.fontWeight || 400,
    lineHeight: el.lineHeight || (el.fontSize || 16) * 1.4,
    letterSpacing: el.letterSpacing || 0,
    fontStyle: el.fontStyle || 'normal' as const,
  }
  if (autoResize === 'hug') {
    // hug: width follows content (no wrap), height follows line count
    const m = measureText(p, 'hug', el.width)
    return { width: m.width, height: m.height }
  }
  // grow/fixed: wrap at authored width; height follows wrapped content
  const m = measureText(p, 'grow', el.width)
  return { width: el.width, height: m.height }
}

/** Child hug size for one axis (recursive for nested auto-layout frames). */
function childHugSize(child: DesignElement, axis: 'w' | 'h'): number {
  if (isTextLike(child)) {
    const m = textContentSize(child)
    return axis === 'w' ? m.width : m.height
  }
  if (child.type === 'frame' && child.autoLayout && child.children) {
    const nested = computeAutoLayout(child)
    return axis === 'w' ? nested.width : nested.height
  }
  return axis === 'w' ? child.width : child.height
}

function clampDim(v: number, min?: number, max?: number): number {
  let out = v
  if (typeof min === 'number' && Number.isFinite(min)) out = Math.max(min, out)
  if (typeof max === 'number' && Number.isFinite(max)) out = Math.min(max, out)
  return out
}

/** Baseline of a child's first text line, measured from its top edge. */
function textBaselineOffset(el: DesignElement): number | null {
  if (!isTextLike(el)) return null
  const fontSize = el.fontSize || 16
  const lineHeight = typeof el.lineHeight === 'number' && el.lineHeight > 0
    ? el.lineHeight
    : fontSize * 1.4
  // approximation: ascent ≈ 0.8 × fontSize, centered within the line box
  return (lineHeight - fontSize) / 2 + fontSize * 0.8
}

export function computeAutoLayout(frame: DesignElement): AutoLayoutResult {
  const layout = frame.autoLayout
  if (!layout || frame.type !== 'frame') {
    return { children: frame.children || [], width: frame.width, height: frame.height }
  }

  const {
    direction = 'vertical',
    gap = 10,
    counterAxisGap = 10,
    paddingTop = 10,
    paddingBottom = 10,
    paddingLeft = 10,
    paddingRight = 10,
    alignItems = 'start',
    justifyContent = 'start',
    counterAxisAlignContent = 'start',
    wrap = false,
    primaryAxisSizing = 'fixed',
    counterAxisSizing = 'fixed',
  } = layout as AutoLayout & {
    counterAxisGap?: number
    counterAxisAlignContent?: 'start' | 'center' | 'end' | 'space-between'
    wrap?: boolean
    primaryAxisSizing?: AxisSizing
    counterAxisSizing?: AxisSizing
  }

  const isHorizontal = direction === 'horizontal'
  const allChildren = frame.children || []
  const inFlow = allChildren.filter(c => c.visible && c.layoutPositioning !== 'absolute')
  if (inFlow.length === 0) {
    // hug with no content: frame collapses to padding, clamped
    const w = clampDim(paddingLeft + paddingRight, frame.minWidth, frame.maxWidth)
    const h = clampDim(paddingTop + paddingBottom, frame.minHeight, frame.maxHeight)
    return {
      children: allChildren,
      width: primaryAxisSizing === 'hug' || counterAxisSizing === 'hug'
        ? Math.min(frame.width, Math.max(w, frame.width))
        : frame.width,
      height: primaryAxisSizing === 'hug' || counterAxisSizing === 'hug'
        ? Math.min(frame.height, Math.max(h, frame.height))
        : frame.height,
    }
  }

  // ---------- 1. Resolve child sizes ----------
  type SizedItem = { el: DesignElement; mainSizing: AxisSizing; crossSizing: AxisSizing }
  const legacyStretch = alignItems === 'stretch'
  const sized: SizedItem[] = inFlow.map(child => {
    const out = { ...child }
    const mainSizing: AxisSizing = (isHorizontal ? out.layoutSizingH : out.layoutSizingV) || 'fixed'
    const crossSizing: AxisSizing = (isHorizontal ? out.layoutSizingV : out.layoutSizingH) || (legacyStretch ? 'fill' : 'fixed')
    // main-axis hug now (fill resolved later once leftovers are known)
    if (mainSizing === 'hug') {
      if (isHorizontal) out.width = childHugSize(out, 'w')
      else out.height = childHugSize(out, 'h')
    }
    // cross-axis hug now (needs no leftover info); fill resolved per line later
    if (crossSizing === 'hug') {
      if (isHorizontal) out.height = childHugSize(out, 'h')
      else out.width = childHugSize(out, 'w')
    }
    return { el: out, mainSizing, crossSizing }
  })

  // ---------- 2. Frame sizing + wrap threshold ----------
  // Hug main size: content total along main axis (single line, ignoring wrap:
  // hug primary + wrap would degenerate to one line anyway).
  let frameW = frame.width
  let frameH = frame.height

  const mainContentSingleLine = sized.reduce((sum, s) => sum + (isHorizontal ? s.el.width : s.el.height), 0)
    + gap * Math.max(0, sized.length - 1)
  const maxCrossSingle = sized.reduce((m, s) => Math.max(m, isHorizontal ? s.el.height : s.el.width), 0)

  if (primaryAxisSizing === 'hug') {
    if (isHorizontal) frameW = paddingLeft + mainContentSingleLine + paddingRight
    else frameH = paddingTop + mainContentSingleLine + paddingBottom
  }
  if (counterAxisSizing === 'hug') {
    if (isHorizontal) frameH = paddingTop + maxCrossSingle + paddingBottom
    else frameW = paddingLeft + maxCrossSingle + paddingRight
  }

  // Effective inner extents for this pass
  const innerW = Math.max(0, frameW - paddingLeft - paddingRight)
  const innerH = Math.max(0, frameH - paddingTop - paddingBottom)
  const innerMain = isHorizontal ? innerW : innerH

  // ---------- 3. Main-axis fill distribution (before wrap, so fills take the
  // full inner extent when they own the line) ----------
  const fillMain = sized.filter(s => s.mainSizing === 'fill')
  if (fillMain.length > 0 && primaryAxisSizing !== 'hug') {
    const fixedMain = sized.reduce((sum, s) =>
      sum + (s.mainSizing === 'fill' ? 0 : (isHorizontal ? s.el.width : s.el.height)), 0)
    const gaps = gap * Math.max(0, sized.length - 1)
    const leftover = Math.max(0, innerMain - fixedMain - gaps)
    const share = leftover / fillMain.length
    for (const s of sized) {
      if (s.mainSizing === 'fill') {
        if (isHorizontal) s.el.width = Math.round(share)
        else s.el.height = Math.round(share)
      }
    }
  } else {
    // fill with hug parent (or no space): fall back to content size
    for (const s of sized) {
      if (s.mainSizing === 'fill') {
        if (isHorizontal) s.el.width = childHugSize(s.el, 'w')
        else s.el.height = childHugSize(s.el, 'h')
      }
    }
  }

  // ---------- 4. Wrap into lines ----------
  const doWrap = wrap && primaryAxisSizing !== 'hug'
  const lines: SizedItem[][] = []
  if (doWrap) {
    let current: SizedItem[] = []
    let used = 0
    for (const s of sized) {
      const sz = isHorizontal ? s.el.width : s.el.height
      if (current.length > 0 && used + gap + sz > innerMain && innerMain > 0) {
        lines.push(current)
        current = []
        used = 0
      }
      current.push(s)
      used += sz + (current.length > 1 ? gap : 0)
    }
    if (current.length) lines.push(current)
  } else {
    lines.push(sized)
  }

  // ---------- 5. Cross-axis fill per line + line extents ----------
  const lineExtents = lines.map(line => {
    let extent = 0
    for (const s of line) {
      if (s.crossSizing === 'fill') {
        // fill to the frame's inner cross extent (or line extent when wrapping
        // makes the line the limiting box — Figma fills the frame extent)
        if (isHorizontal) s.el.height = innerH
        else s.el.width = innerW
      }
      extent = Math.max(extent, isHorizontal ? s.el.height : s.el.width)
    }
    return extent
  })

  // ---------- 6. Position lines along the counter axis ----------
  const totalLines = lines.length
  const totalLineGaps = counterAxisGap * Math.max(0, totalLines - 1)
  const linesCrossTotal = lineExtents.reduce((a, b) => a + b, 0) + totalLineGaps
  const innerCross = isHorizontal ? innerH : innerW

  const lineCrossOffsets: number[] = []
  if (counterAxisAlignContent === 'center') {
    const start = Math.max(0, (innerCross - linesCrossTotal) / 2)
    lineCrossOffsets.push(start)
  } else if (counterAxisAlignContent === 'end') {
    lineCrossOffsets.push(Math.max(0, innerCross - linesCrossTotal))
  } else if (counterAxisAlignContent === 'space-between' && totalLines > 1) {
    lineCrossOffsets.push(0)
  } else {
    lineCrossOffsets.push(0)
  }
  for (let i = 1; i < totalLines; i++) {
    let extra = counterAxisGap
    if (counterAxisAlignContent === 'space-between' && totalLines > 1) {
      extra = Math.max(0, (innerCross - linesCrossTotal + totalLineGaps) / (totalLines - 1))
    }
    lineCrossOffsets.push(lineCrossOffsets[i - 1] + lineExtents[i - 1] + extra)
  }

  // ---------- 7. Position children within lines ----------
  const positioned: DesignElement[] = []
  lines.forEach((line, li) => {
    const lineCrossStart = lineCrossOffsets[li]
    const lineExtent = lineExtents[li]

    // main-axis offsets per justifyContent (per line)
    const lineMain = line.reduce((sum, s) => sum + (isHorizontal ? s.el.width : s.el.height), 0)
      + gap * Math.max(0, line.length - 1)
    const lineAvail = primaryAxisSizing === 'hug' ? 0 : Math.max(0, innerMain - lineMain)
    let lead: number
    let between = gap
    if (justifyContent === 'center') lead = lineAvail / 2
    else if (justifyContent === 'end') lead = lineAvail
    else if (justifyContent === 'space-between' && line.length > 1) {
      lead = 0
      between = gap + lineAvail / (line.length - 1)
    } else lead = 0

    // baseline info for horizontal
    let lineBaseline = 0
    if (alignItems === 'baseline' && isHorizontal) {
      for (const s of line) {
        const b = textBaselineOffset(s.el)
        if (b !== null) lineBaseline = Math.max(lineBaseline, b)
      }
    }

    let cursorMain = lead
    for (const s of line) {
      const child = s.el
      const mainSize = isHorizontal ? child.width : child.height
      const crossSize = isHorizontal ? child.height : child.width

      let crossOffset: number
      if (alignItems === 'center') crossOffset = (lineExtent - crossSize) / 2
      else if (alignItems === 'end') crossOffset = lineExtent - crossSize
      else if (alignItems === 'baseline' && isHorizontal) {
        const b = textBaselineOffset(child)
        crossOffset = b !== null && lineBaseline > 0 ? lineBaseline - b : 0
      } else crossOffset = 0 // start / stretch(fill already resized)

      let x: number, y: number
      if (isHorizontal) {
        x = paddingLeft + cursorMain
        y = paddingTop + lineCrossStart + crossOffset
      } else {
        y = paddingTop + cursorMain
        x = paddingLeft + lineCrossStart + crossOffset
      }
      positioned.push({ ...child, x: Math.round(x), y: Math.round(y) })
      cursorMain += mainSize + between
    }
  })

  // ---------- 8. Final frame size + min/max ----------
  if (primaryAxisSizing === 'hug') {
    if (isHorizontal) frameW = paddingLeft + mainContentSingleLine + paddingRight
    else frameH = paddingTop + mainContentSingleLine + paddingBottom
  }
  if (counterAxisSizing === 'hug') {
    if (isHorizontal) frameH = paddingTop + linesCrossTotal + paddingBottom
    else frameW = paddingLeft + linesCrossTotal + paddingRight
  }
  frameW = clampDim(Math.round(frameW), frame.minWidth, frame.maxWidth)
  frameH = clampDim(Math.round(frameH), frame.minHeight, frame.maxHeight)

  // ---------- 9. Merge back (invisible + absolute keep authored positions) ----------
  const positionedMap = new Map(positioned.map(p => [p.id, p]))
  const children = allChildren.map(child => {
    const hit = positionedMap.get(child.id)
    if (hit) {
      // re-apply clamped min/max on children
      const w = clampDim(hit.width, hit.minWidth, hit.maxWidth)
      const h = clampDim(hit.height, hit.minHeight, hit.maxHeight)
      return { ...hit, width: w, height: h }
    }
    return child
  })

  return { children, width: frameW, height: frameH }
}

/**
 * Back-compat: positioned children only (pre-PHASE-12 signature).
 */
export function calculateAutoLayout(frame: DesignElement): DesignElement[] {
  return computeAutoLayout(frame).children
}

/**
 * Check if a frame has auto layout enabled.
 */
export function hasAutoLayout(frame: DesignElement): boolean {
  return !!(frame.type === 'frame' && frame.autoLayout)
}

/**
 * Back-compat: minimum frame size to fit children (hug size).
 */
export function calculateAutoLayoutSize(frame: DesignElement): { width: number; height: number } {
  const r = computeAutoLayout(frame)
  return { width: r.width, height: r.height }
}
