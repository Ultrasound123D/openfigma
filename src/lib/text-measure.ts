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
