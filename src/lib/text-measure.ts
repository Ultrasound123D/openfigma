/**
 * PHASE 10 — Real text measurement (textAutoResize: fixed / hug / grow).
 *
 * Measurement uses a shared offscreen 2D canvas + ctx.measureText with the
 * exact CSS font string, so canvas rendering and auto-sizing agree.
 *
 * Modes (Figma parity):
 *   fixed — width & height stay as set (text may clip)
 *   hug   — element shrinks-wraps its text: width = longest line,
 *           height = lines × lineHeight (no wrapping)
 *   grow  — width stays fixed, text WRAPS at that width,
 *           height = wrapped lines × lineHeight
 */

export interface TextStyleParams {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  fontStyle?: 'normal' | 'italic'
}

let measureCanvas: HTMLCanvasElement | null = null
function getCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  return measureCanvas.getContext('2d')
}

export function fontString(p: Pick<TextStyleParams, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle'>): string {
  const italic = p.fontStyle === 'italic' ? 'italic ' : ''
  return `${italic}${p.fontWeight} ${p.fontSize}px ${p.fontFamily}, Inter, system-ui, sans-serif`
}

/** Measured advance width of a single line (includes letterSpacing per char). */
export function measureLine(line: string, p: TextStyleParams): number {
  const ctx = getCtx()
  if (!ctx || line.length === 0) return 0
  ctx.font = fontString(p)
  return ctx.measureText(line).width + p.letterSpacing * line.length
}

/** Greedy word-wrap of `text` at `maxWidth`. Honors explicit \n breaks. */
export function wrapText(text: string, p: TextStyleParams, maxWidth: number): string[] {
  const out: string[] = []
  for (const rawLine of text.split('\n')) {
    if (rawLine.length === 0) { out.push(''); continue }
    const words = rawLine.split(/(\s+)/) // keep whitespace runs so joins are exact
    let current = ''
    for (const w of words) {
      const candidate = current + w
      if (measureLine(candidate.trimEnd(), p) <= maxWidth || current.length === 0) {
        current = candidate
      } else {
        out.push(current.trimEnd())
        current = w.trimStart()
      }
    }
    out.push(current.trimEnd())
  }
  return out
}

export interface MeasuredText {
  /** display lines (wrapped when mode=grow) */
  lines: string[]
  width: number
  height: number
}

/**
 * Measure a text block in the given auto-resize mode at the given box width.
 * For hug: no wrapping — width = longest raw line.
 * For grow/fixed: wrap at boxWidth.
 */
export function measureText(
  p: TextStyleParams,
  mode: 'fixed' | 'hug' | 'grow',
  boxWidth: number
): MeasuredText {
  const lineH = p.fontSize * p.lineHeight
  if (mode === 'hug') {
    const rawLines = p.text.split('\n')
    let w = 0
    for (const l of rawLines) w = Math.max(w, measureLine(l, p))
    return { lines: rawLines, width: Math.max(1, Math.ceil(w)), height: Math.max(lineH, Math.ceil(rawLines.length * lineH)) }
  }
  const lines = wrapText(p.text, p, Math.max(1, boxWidth))
  return { lines, width: boxWidth, height: Math.max(lineH, Math.ceil(lines.length * lineH)) }
}

/** Apply textCase to a string for rendering. */
export function applyTextCase(text: string, textCase: 'original' | 'upper' | 'lower' | 'title' | undefined): string {
  if (!textCase || textCase === 'original') return text
  if (textCase === 'upper') return text.toUpperCase()
  if (textCase === 'lower') return text.toLowerCase()
  // title case: capitalize first letter of each word
  return text.replace(/\p{L}[\p{L}\p{M}]*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * PHASE 13 — list-aware text line building (source evidence: ordered 12 /
 * unordered 6 refs; textAlignVertical TOP 33 / BOTTOM 35 / MIDDLE; JUSTIFIED 12).
 *
 * Builds display lines with list prefixes (bullets / numbers) and hanging
 * indent semantics: the first line of each list item starts after the prefix,
 * continuation lines align under it (wrap width reduced by indent + prefix).
 */
export type TextListType = 'none' | 'ordered' | 'unordered'

export interface TextDisplayLine {
  /** content text (without prefix) */
  text: string
  /** x offset where the text starts (after prefix / indent) */
  x: number
  /** list prefix rendered at (x - prefixWidth), e.g. "•" or "3." */
  prefix?: string
  /** x offset where the prefix is rendered */
  prefixX?: number
  /** PHASE 19 (T7) — char index of this line's text within the ORIGINAL
   *  content (for hyperlink run mapping). Undefined for legacy callers. */
  contentStart?: number
}

export interface BuildTextLinesOpts {
  listType?: TextListType
  /** extra indent before the prefix (Figma list indent) */
  listIndent?: number
  autoResize?: 'fixed' | 'hug' | 'grow'
  boxWidth?: number
}

export function buildTextLines(p: TextStyleParams, opts: BuildTextLinesOpts = {}): TextDisplayLine[] {
  const { listType = 'none', listIndent = 0, autoResize = 'fixed', boxWidth = 0 } = opts
  const rawLines = p.text.split('\n')
  // PHASE 19: absolute char start of each raw line (\n = 1 char)
  const rawStarts: number[] = []
  let acc = 0
  for (const rl of rawLines) { rawStarts.push(acc); acc += rl.length + 1 }
  if (listType === 'none') {
    if (autoResize === 'hug') {
      return rawLines.map((l, i) => ({ text: l, x: 0, contentStart: rawStarts[i] }))
    }
    const wrapped: TextDisplayLine[] = []
    for (let pi = 0; pi < rawLines.length; pi++) {
      const l = rawLines[pi]
      const ranges = wrapTextRanges(l, p, Math.max(1, boxWidth))
      for (const r of ranges) wrapped.push({ text: r.text, x: 0, contentStart: rawStarts[pi] + r.start })
    }
    return wrapped
  }
  // list mode: each paragraph is one item; hanging indent under the prefix
  const out: TextDisplayLine[] = []
  let itemIndex = 0
  for (let pi = 0; pi < rawLines.length; pi++) {
    const para = rawLines[pi]
    const paraStart = rawStarts[pi]
    const prefix = listType === 'ordered' ? `${itemIndex + 1}.` : '•'
    const prefixWidth = measureLine(prefix + ' ', p)
    const indent = listIndent
    const textX = indent + prefixWidth
    if (para.length === 0) {
      out.push({ text: '', x: textX, prefix, prefixX: indent, contentStart: paraStart })
      itemIndex++
      continue
    }
    if (autoResize === 'hug') {
      out.push({ text: para, x: textX, prefix, prefixX: indent, contentStart: paraStart })
    } else {
      const wrapWidth = Math.max(1, boxWidth - textX)
      const ranges = wrapTextRanges(para, p, wrapWidth)
      ranges.forEach((r, i) => {
        if (i === 0) out.push({ text: r.text, x: textX, prefix, prefixX: indent, contentStart: paraStart + r.start })
        else out.push({ text: r.text, x: textX, contentStart: paraStart + r.start })
      })
    }
    itemIndex++
  }
  return out
}

/**
 * PHASE 19 (T7) — wrapText with ABSOLUTE char ranges: mirrors wrapText's
 * algorithm but also reports each emitted chunk's start index within the
 * input line (whitespace runs consumed between chunks are accounted for).
 */
export function wrapTextRanges(text: string, p: TextStyleParams, maxWidth: number): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  let cursor = 0 // absolute index in `text`
  const words = text.split(/(\s+)/) // keep whitespace runs (same as wrapText)
  let current = ''
  let currentStart = -1
  const flush = () => {
    if (current.length > 0) {
      out.push({ text: current, start: currentStart < 0 ? 0 : currentStart })
    }
    current = ''
    currentStart = -1
  }
  for (const w of words) {
    if (/^\s+$/.test(w)) { current += w; cursor += w.length; continue } // whitespace run appended (same accumulation); cursor advanced
    if (currentStart < 0) currentStart = cursor
    const candidate = current + w
    if (measureLine(candidate.trimEnd(), p) <= maxWidth || current.length === 0) {
      current = candidate
    } else {
      flush()
      current = w.trimStart()
      currentStart = cursor + (w.length - w.trimStart().length)
    }
    cursor += w.length
  }
  flush()
  return out.map((r) => ({ text: r.text.trimEnd(), start: r.start }))
}
