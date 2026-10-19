/**
 * PHASE 2 — Smart Animate engine (DECISION-005).
 *
 * Figma's Smart Animate matches layers that exist in BOTH the origin and
 * destination frame and tweens their properties. Figma matches by layer
 * identity within the same component/instance context; for document-level
 * frames we match by FULL NAME PATH (e.g. "Frame 1/Group 2/Button"),
 * which is deterministic, user-controllable (rename to force match), and
 * documented in ARCHITECTURE.md.
 *
 * Pure functions — no React, no store access.
 */

import type { DesignElement } from '@/store/editor-store'

/** Animate-able property diff between two matched elements. */
export interface SmartDiff {
  from: { x: number; y: number; width: number; height: number; opacity: number; rotation: number }
  to: { x: number; y: number; width: number; height: number; opacity: number; rotation: number }
}

export interface SmartMatch {
  /** element in the origin frame */
  from: DesignElement
  /** element in the destination frame */
  to: DesignElement
  diff: SmartDiff
}

export interface SmartFrameMatch {
  matched: SmartMatch[]
  /** present only in the destination frame → fade in */
  entering: DesignElement[]
  /** present only in the origin frame → fade out */
  exiting: DesignElement[]
}

function snapshot(el: DesignElement) {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    opacity: el.opacity / 100,
    rotation: el.rotation || 0,
  }
}

/**
 * Build a map of every element (recursive) keyed by its full name path.
 * Later siblings with identical paths overwrite earlier ones — Figma
 * behaves the same for duplicate names (last one wins the tween).
 */
export function indexByNamePath(root: DesignElement): Map<string, DesignElement> {
  const map = new Map<string, DesignElement>()
  const walk = (el: DesignElement, prefix: string) => {
    const path = prefix ? `${prefix}/${el.name}` : el.name
    map.set(path, el)
    if (el.children) {
      for (const child of el.children) walk(child, path)
    }
  }
  walk(root, '')
  return map
}

/**
 * Match two frames by name path and compute the property diffs for every
 * matched pair. The frame roots themselves are NOT matched (the player
 * renders the destination frame as the container).
 */
export function matchFrames(
  fromFrame: DesignElement,
  toFrame: DesignElement
): SmartFrameMatch {
  const fromIndex = indexByNamePath(fromFrame)
  const toIndex = indexByNamePath(toFrame)

  const matched: SmartMatch[] = []
  const entering: DesignElement[] = []
  const exiting: DesignElement[] = []

  // Iterate destination order so tween order follows the target frame.
  for (const [path, toEl] of toIndex) {
    const fromEl = fromIndex.get(path)
    if (fromEl) {
      matched.push({
        from: fromEl,
        to: toEl,
        diff: { from: snapshot(fromEl), to: snapshot(toEl) },
      })
    } else {
      entering.push(toEl)
    }
  }
  for (const [path, fromEl] of fromIndex) {
    if (!toIndex.has(path)) exiting.push(fromEl)
  }

  return { matched, entering, exiting }
}

/** True when at least one matched pair actually changes an animate-able prop. */
export function hasVisibleChanges(match: SmartFrameMatch): boolean {
  return match.matched.some(
    (m) =>
      m.diff.from.x !== m.diff.to.x ||
      m.diff.from.y !== m.diff.to.y ||
      m.diff.from.width !== m.diff.to.width ||
      m.diff.from.height !== m.diff.to.height ||
      m.diff.from.opacity !== m.diff.to.opacity ||
      m.diff.from.rotation !== m.diff.to.rotation
  )
}
