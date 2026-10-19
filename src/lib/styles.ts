/**
 * PHASE 7 — Project style system (color / text / effect styles).
 *
 * Ported behavior parity (Figma published model, source files lost — REGENERATED
 * per PORT-PLAN-6-11.md row 7):
 *   - A style is a PROJECT-level reusable definition (paint / text / effect).
 *   - Elements reference styles by id (fillStyleId / strokeStyleId / textStyleId /
 *     effectStyleId). Figma actually uses per-fill style ids; we keep one id per
 *     slot which covers single-fill workflows and stays lossless for our model.
 *   - Editing a style re-broadcasts its values to every element referencing it.
 *   - Detaching removes the reference but keeps the current values.
 *   - Usage counter = number of elements currently referencing the style.
 *
 * Style persistence rides the whole-project PUT (name/elements/pages/…) — see
 * pushProjectToServer / loadServerProject (DECISION-006: element-level PUT is
 * whitelisted; project PUT replaces the project document).
 */

import type { DesignElement, FillStyle, ShadowEffect, BlurEffect } from '@/store/editor-store'

export type StyleKind = 'paint' | 'text' | 'effect'

export interface TextStyleDef {
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right' | 'justified'
  textColor: string
  /** PHASE 10 fields are mirrored so a text style can carry them (optional). */
  textCase?: 'original' | 'upper' | 'lower' | 'title'
  textDecoration?: 'none' | 'underline' | 'strikethrough'
}

export interface EffectStyleDef {
  shadows: ShadowEffect[]
  blurs: BlurEffect[]
}

export interface ProjectStyle {
  id: string
  name: string
  kind: StyleKind
  /** paint styles: the fill value applied to fill (and optionally stroke slot) */
  paint?: FillStyle
  text?: TextStyleDef
  effects?: EffectStyleDef
  createdAt: number
}

/** Slot on a DesignElement that can reference a style. */
export type StyleSlot = 'fill' | 'stroke' | 'text' | 'effect'

export const SLOT_FIELD: Record<StyleSlot, string> = {
  fill: 'fillStyleId',
  stroke: 'strokeStyleId',
  text: 'textStyleId',
  effect: 'effectStyleId',
}

/** Count how many elements (deep) reference a given style id. */
export function countStyleUsage(elements: DesignElement[], styleId: string): number {
  let n = 0
  const walk = (els: DesignElement[]) => {
    for (const el of els) {
      if (el.fillStyleId === styleId || el.strokeStyleId === styleId ||
          el.textStyleId === styleId || el.effectStyleId === styleId) n++
      if (el.children) walk(el.children)
    }
  }
  walk(elements)
  return n
}

/** Build the updates object that applies a style to an element. */
export function applyStyleUpdates(el: DesignElement, style: ProjectStyle): Partial<DesignElement> {
  const updates: Partial<DesignElement> = {}
  if (style.kind === 'paint' && style.paint) {
    if (el.fillStyleId === style.id || el.type !== 'text') {
      // paint style → fills[0] (or legacy `fill` when the element has no layer fills)
      if ((el.fills || []).length > 0) {
        updates.fills = [...(el.fills || [])]
        updates.fills[0] = { ...updates.fills[0], ...style.paint }
      } else {
        updates.fill = style.paint.type === 'solid' ? style.paint.color : el.fill
        updates.fills = [deepCopyFill(style.paint)]
      }
      updates.fillStyleId = style.id
    }
  } else if (style.kind === 'text' && style.text) {
    updates.textStyleId = style.id
    const t = style.text
    updates.fontFamily = t.fontFamily
    updates.fontSize = t.fontSize
    updates.fontWeight = t.fontWeight
    updates.fontStyle = t.fontStyle
    updates.lineHeight = t.lineHeight
    updates.letterSpacing = t.letterSpacing
    updates.textAlign = t.textAlign
    updates.textColor = t.textColor
    if (t.textCase) updates.textCase = t.textCase
    if (t.textDecoration) updates.textDecoration = t.textDecoration
  } else if (style.kind === 'effect' && style.effects) {
    updates.effectStyleId = style.id
    updates.shadows = style.effects.shadows.map((s) => ({ ...s }))
    updates.blurs = style.effects.blurs.map((b) => ({ ...b }))
  }
  return updates
}

function deepCopyFill(f: FillStyle): FillStyle {
  return { ...f, gradientStops: f.gradientStops?.map((s) => ({ ...s })) }
}

/** Extract a paint-style definition from an element's current first fill. */
export function paintFromElement(el: DesignElement): FillStyle | undefined {
  const fills = el.fills || []
  if (fills.length > 0) return deepCopyFill(fills[0])
  if (el.fill && el.fill !== 'transparent') {
    return { type: 'solid', color: el.fill, opacity: 100 }
  }
  return undefined
}

/** Extract a text-style definition from an element. */
export function textFromElement(el: DesignElement): TextStyleDef | undefined {
  if (el.type !== 'text') return undefined
  return {
    fontFamily: el.fontFamily || 'Inter',
    fontSize: el.fontSize || 18,
    fontWeight: el.fontWeight || 400,
    fontStyle: el.fontStyle || 'normal',
    lineHeight: el.lineHeight || 1.4,
    letterSpacing: el.letterSpacing || 0,
    textAlign: el.textAlign || 'left',
    textColor: el.textColor || '#000000',
    textCase: el.textCase,
    textDecoration: el.textDecoration,
  }
}

/** Extract an effect-style definition from an element. */
export function effectsFromElement(el: DesignElement): EffectStyleDef | undefined {
  const shadows = el.shadows || []
  const blurs = el.blurs || []
  if (shadows.length === 0 && blurs.length === 0) return undefined
  return {
    shadows: shadows.map((s) => ({ ...s })),
    blurs: blurs.map((b) => ({ ...b })),
  }
}

/** Detach updates: remove the reference for the slots that point at styleId. */
export function detachStyleUpdates(el: DesignElement, styleId: string): Partial<DesignElement> {
  const updates: Partial<DesignElement> = {}
  if (el.fillStyleId === styleId) updates.fillStyleId = undefined
  if (el.strokeStyleId === styleId) updates.strokeStyleId = undefined
  if (el.textStyleId === styleId) updates.textStyleId = undefined
  if (el.effectStyleId === styleId) updates.effectStyleId = undefined
  return updates
}

export function styleSwatchStyle(style: ProjectStyle): string {
  if (style.kind === 'paint' && style.paint) {
    if (style.paint.type === 'solid') return style.paint.color
    if (style.paint.type === 'image') return 'repeating-linear-gradient(45deg,#666,#666 3px,#999 3px,#999 6px)'
    return `linear-gradient(135deg, ${(style.paint.gradientStops || []).map((s) => s.color).join(', ')})`
  }
  if (style.kind === 'text') return style.text?.textColor || '#FFF'
  return 'transparent'
}

/** Kind → readable label. */
export const STYLE_KIND_LABEL: Record<StyleKind, string> = {
  paint: 'Paint style',
  text: 'Text style',
  effect: 'Effect style',
}
