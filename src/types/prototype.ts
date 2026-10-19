/**
 * PHASE 2 — Prototype interaction model (Figma source parity).
 * Source: PHASE-0 functional inventory of the Figma web bundle
 * (see ARCHITECTURE.md "PHASE 2", DECISION-002).
 *
 * Mirrors Figma's prototype model:
 *   Trigger   — what fires the interaction (click / hover / drag /
 *               keypress / delay)
 *   Action    — what happens (navigate / open-overlay / close-overlay /
 *               url / back)
 *   Animation — how it looks (instant / dissolve / move-in / slide-in /
 *               push / smart-animate) + direction + easing + duration
 *
 * Stored on DesignElement.interactions (optional — old documents load
 * unchanged, see RULES.md §9).
 */

export type PrototypeTriggerType = 'click' | 'hover' | 'drag' | 'keypress' | 'delay'

export interface PrototypeTrigger {
  type: PrototypeTriggerType
  /** keypress: normalized key list, e.g. ['enter'], ['a'], ['arrowright'] */
  keys?: string[]
  /** delay: fire after this many ms */
  timeoutMs?: number
}

export type OverlayBackgroundType = 'none' | 'solid' | 'blur'

export interface OverlayBackground {
  type: OverlayBackgroundType
  /** solid: CSS color */
  color?: string
  /** blur: backdrop blur radius in px */
  blurRadius?: number
}

export type PrototypeActionType =
  | 'navigate'
  | 'open-overlay'
  | 'close-overlay'
  | 'url'
  | 'back'

export interface PrototypeAction {
  type: PrototypeActionType
  /** navigate / open-overlay: destination frame id (null = not wired yet) */
  destinationId?: string | null
  /** open-overlay */
  background?: OverlayBackground
  closeOnClickOutside?: boolean
  /** url */
  url?: string
  newTab?: boolean
}

export type PrototypeAnimationType =
  | 'instant'
  | 'dissolve'
  | 'move-in'
  | 'move-out'
  | 'slide-in'
  | 'slide-out'
  | 'push'
  | 'smart-animate'

export type PrototypeDirection = 'left' | 'right' | 'top' | 'bottom'

export type PrototypeEasing =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'gentle'
  | 'quick'
  | 'slow'
  | 'bouncy'
  | 'custom-bezier'

export interface PrototypeAnimation {
  type: PrototypeAnimationType
  direction?: PrototypeDirection
  durationMs: number
  easing: PrototypeEasing
  /** custom-bezier: [x1, y1, x2, y2] */
  bezier?: [number, number, number, number]
}

/** One wired interaction on a design element. */
export interface Interaction {
  id: string
  trigger: PrototypeTrigger
  action: PrototypeAction
  animation: PrototypeAnimation
}

/** Human labels shared by the interactions panel and the player HUD. */
export const TRIGGER_LABELS: Record<PrototypeTriggerType, string> = {
  click: 'On click',
  hover: 'On hover',
  drag: 'On drag',
  keypress: 'On keypress',
  delay: 'After delay',
}

export const ACTION_LABELS: Record<PrototypeActionType, string> = {
  navigate: 'Navigate to',
  'open-overlay': 'Open overlay',
  'close-overlay': 'Close overlay',
  url: 'Open URL',
  back: 'Back',
}

export const ANIMATION_LABELS: Record<PrototypeAnimationType, string> = {
  instant: 'Instant',
  dissolve: 'Dissolve',
  'move-in': 'Move in',
  'move-out': 'Move out',
  'slide-in': 'Slide in',
  'slide-out': 'Slide out',
  push: 'Push',
  'smart-animate': 'Smart animate',
}

export const EASING_LABELS: Record<PrototypeEasing, string> = {
  linear: 'Linear',
  'ease-in': 'Ease in',
  'ease-out': 'Ease out',
  'ease-in-out': 'Ease in and out',
  gentle: 'Gentle',
  quick: 'Quick',
  slow: 'Slow',
  bouncy: 'Bouncy',
  'custom-bezier': 'Custom cubic bezier',
}

export const DIRECTION_LABELS: Record<PrototypeDirection, string> = {
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
}

/** Default animation used when adding a new interaction (Figma default). */
export function defaultAnimation(): PrototypeAnimation {
  return { type: 'instant', durationMs: 300, easing: 'ease-in-out' }
}
