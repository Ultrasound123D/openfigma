/**
 * PHASE 9 — Constraints: how children reposition/resize when their parent
 * frame is resized. Model (Figma published behavior, PORT-PLAN-6-11 row 9):
 *
 *   horizontal: 'left' | 'center' | 'right' | 'left-right' (+'scale' alias)
 *     left       → keeps distance from the LEFT edge   (x unchanged)
 *     center     → keeps distance from the horizontal center
 *     right      → keeps distance from the RIGHT edge  (x += dW)
 *     left-right → both edges pinned → child scales proportionally
 *   vertical:   'top' | 'center' | 'bottom' | 'top-bottom' (+'scale' alias)
 *
 * All math is in the PARENT-RELATIVE coordinate space (children x/y are
 * relative to the frame origin), so it is independent of the frame moving.
 *
 * Auto-inference: constraints are inferred from the child's creation position
 * (centered → center; nearer the left → left; …) — Figma's documented
 * behavior. Inference runs on creation / drop-into-frame only; manual edits
 * via the panel are respected afterwards.
 */

import type { DesignElement } from '@/store/editor-store'

export type HConstraint = 'left' | 'center' | 'right' | 'left-right' | 'scale'
export type VConstraint = 'top' | 'center' | 'bottom' | 'top-bottom' | 'scale'

export interface Constraints {
  horizontal: HConstraint
  vertical: VConstraint
}

/** Tolerance (px) used when deciding "centered enough to be center". */
const CENTER_EPS = 2

/** Infer constraints from a child's position inside its parent frame. */
export function inferConstraints(child: DesignElement, parentW: number, parentH: number): Constraints {
  // --- horizontal ---
  let horizontal: HConstraint
  const leftMargin = child.x
  const rightMargin = parentW - (child.x + child.width)
  const centerOffset = Math.abs(parentW / 2 - (child.x + child.width / 2))
  if (centerOffset <= CENTER_EPS) horizontal = 'center'
  else if (leftMargin <= rightMargin) horizontal = 'left'
  else horizontal = 'right'

  // --- vertical ---
  let vertical: VConstraint
  const topMargin = child.y
  const bottomMargin = parentH - (child.y + child.height)
  const vCenterOffset = Math.abs(parentH / 2 - (child.y + child.height / 2))
  if (vCenterOffset <= CENTER_EPS) vertical = 'center'
  else if (topMargin <= bottomMargin) vertical = 'top'
  else vertical = 'bottom'

  return { horizontal, vertical }
}

/**
 * Compute the new geometry of a child after its parent frame changed size.
 * Pure function — returns a new child object (or the same one if untouched).
 */
export function constrainChild(
  child: DesignElement,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): DesignElement {
  const h = (child.constraints?.horizontal as HConstraint | undefined) || 'left'
  const v = (child.constraints?.vertical as VConstraint | undefined) || 'top'
  const dW = newW - oldW
  const dH = newH - oldH
  if (dW === 0 && dH === 0) return child

  let x = child.x
  let width = child.width
  let y = child.y
  let height = child.height

  if (dW !== 0) {
    if (h === 'center') x = child.x + dW / 2
    else if (h === 'right') x = child.x + dW
    else if (h === 'left-right' || h === 'scale') {
      const s = newW / oldW
      x = child.x * s
      width = child.width * s
    }
    // 'left' → x unchanged
  }
  if (dH !== 0) {
    if (v === 'center') y = child.y + dH / 2
    else if (v === 'bottom') y = child.y + dH
    else if (v === 'top-bottom' || v === 'scale') {
      const s = newH / oldH
      y = child.y * s
      height = child.height * s
    }
    // 'top' → y unchanged
  }
  return { ...child, x, y, width, height }
}

/**
 * Apply constraints to every child of a frame that changed size.
 * Auto-layout frames position children themselves → constraints are skipped.
 */
export function constrainChildren(
  frame: DesignElement,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): DesignElement[] | undefined {
  if (!frame.children || frame.children.length === 0) return undefined
  if (frame.autoLayout) return undefined // auto-layout owns child geometry
  if (oldW === newW && oldH === newH) return undefined
  return frame.children.map((c) => constrainChild(c, oldW, oldH, newW, newH))
}
