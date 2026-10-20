/**
 * text-on-path.ts + link runs — PHASE 19 (T6/T7) rendering helpers.
 *
 * Source evidence:
 *  - T6: vectors.text_on_path_tool_announcement (9488-7df5…) — text follows a
 *    vector path. Model: text element { onPathId, pathOffset }.
 *  - T7: text marker type "HYPERLINK" (1517-f945…) — link runs inside text.
 *
 * Rendering model (deterministic):
 *  - On-path text: <defs><path id=tp-{textId} d=targetD
 *    transform=translate(target.x-text.x, target.y-text.y) rotate(target.rotation
 *    about target center)/></defs> then <text><textPath href startOffset=%>.
 *    Target flip is NOT mirrored onto the reference (documented limitation).
 *  - Link runs: per rendered line, split into [plain][link][plain] tspans;
 *    x offsets measured with canvas 2D (measureText from lib/text-measure);
 *    link style: fill = link color + underline (text-decoration).
 */

import type { DesignElement } from '@/store/editor-store'
import { pathElementToSvgPath } from '@/lib/element-utils'
import { measureText } from '@/lib/text-measure'
import { ellipseShapePath } from '@/lib/arc'

/** Local geometry `d` of the on-path TARGET (path-ish elements only). */
export function onPathTargetD(target: DesignElement): string {
  if (target.type === 'path') {
    const d = pathElementToSvgPath(target)
    if (d) return d
  }
  if (target.type === 'ellipse') {
    return ellipseShapePath(target.width, target.height, target.arc || null)
  }
  // straight-line targets (documented scope: line/arrow geometry)
  if (target.type === 'line' || target.type === 'arrow') {
    return `M 0 0 L ${target.width} ${target.height}`
  }
  return ''
}

/** Transform string that maps the TARGET's local space into the TEXT's local space. */
export function onPathTargetTransform(target: DesignElement, text: DesignElement): string {
  const dx = target.x - text.x
  const dy = target.y - text.y
  const parts = [`translate(${dx}, ${dy})`]
  if (target.rotation) {
    parts.push(`rotate(${target.rotation}, ${target.width / 2}, ${target.height / 2})`)
  }
  return parts.join(' ')
}

export interface LinkRunRender {
  /** char index in the ORIGINAL textContent */
  start: number
  end: number
  url: string
}

/**
 * Split one rendered line into styled runs given the line's char range
 * within the original content. Returns per-run text + pixel x offset.
 */
export function splitLineIntoRuns(
  lineText: string,
  lineStartInContent: number,
  links: LinkRunRender[],
  measure: (s: string, fontSize: number) => number,
  fontSize: number,
): { text: string; x: number; link?: string }[] {
  const runs: { text: string; x: number; link?: string }[] = []
  // collect links intersecting this line, clamped to it
  const inLine = links
    .map((l) => ({ s: Math.max(l.start, lineStartInContent), e: Math.min(l.end, lineStartInContent + lineText.length), url: l.url }))
    .filter((l) => l.e > l.s)
    .sort((a, b) => a.s - b.s)
  let cursor = 0 // position within lineText
  let x = 0
  const push = (s: string, link?: string) => {
    if (!s) return
    runs.push({ text: s, x, link })
    x += measure(s, fontSize)
    cursor += s.length
  }
  for (const l of inLine) {
    const ls = l.s - lineStartInContent
    if (ls > cursor) push(lineText.slice(cursor, ls))
    const le = Math.min(l.e - lineStartInContent, lineText.length)
    push(lineText.slice(Math.max(cursor, ls), le), l.url)
  }
  if (cursor < lineText.length) push(lineText.slice(cursor))
  return runs
}

/** Default link color (Figma-blue family used across the app). */
export const LINK_COLOR = '#0D99FF'
