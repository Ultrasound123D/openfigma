/**
 * PHASE 2 — Prototype transition engine (pure helpers, no React).
 * Converts a PrototypeAnimation into CSS transition primitives used by
 * PrototypePlayer: a css `transition` shorthand + the enter/exit
 * transform for a given animation type and direction.
 *
 * Reference: Figma UI3 prototype animation set (instant / dissolve /
 * move-in / move-out / slide-in / slide-out / push / smart-animate).
 * Smart-animate keyframes live in smart-animate.ts (DECISION-005).
 */

import type {
  PrototypeAnimation,
  PrototypeDirection,
  PrototypeEasing,
} from '@/types/prototype'

/** Figma's named easing curves, expressed as cubic-bezier where possible. */
const EASING_BEZIERS: Record<Exclude<PrototypeEasing, 'custom-bezier'>, string> = {
  linear: 'cubic-bezier(0, 0, 1, 1)',
  'ease-in': 'cubic-bezier(0.42, 0, 1, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
  gentle: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  quick: 'cubic-bezier(0.9, 0, 1, 0.1)',
  slow: 'cubic-bezier(0.1, 0.5, 0.2, 1)',
  bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

export function easingCss(easing: PrototypeEasing, bezier?: [number, number, number, number]): string {
  if (easing === 'custom-bezier' && bezier) {
    return `cubic-bezier(${bezier.join(', ')})`
  }
  return EASING_BEZIERS[easing] ?? EASING_BEZIERS['ease-in-out']
}

/** Off-screen offset (in px) for slide/move animations. */
const OFFSCREEN = (distance: number) => distance

/** Unit transform string (element at rest). */
export const IDENTITY = 'translate(0px, 0px)'

/**
 * Compute the CSS properties for the *entering* frame of a transition.
 * Returns the style to animate FROM (applied on first paint) — the player
 * then flips to the identity/destination style inside a requestAnimationFrame.
 */
export function enterFrom(
  animation: PrototypeAnimation,
  direction: PrototypeDirection,
  distance: { width: number; height: number }
): React.CSSProperties {
  const d = animation.direction ?? direction
  switch (animation.type) {
    case 'dissolve':
      return { opacity: 0 }
    case 'move-in':
    case 'slide-in': {
      const off =
        d === 'left' ? `translateX(${OFFSCREEN(distance.width)}px)` :
        d === 'right' ? `translateX(${-OFFSCREEN(distance.width)}px)` :
        d === 'top' ? `translateY(${OFFSCREEN(distance.height)}px)` :
        `translateY(${-OFFSCREEN(distance.height)}px)`
      return animation.type === 'slide-in'
        ? { transform: off }
        : { transform: off, opacity: 0 }
    }
    case 'push':
      // push: both frames move; the incoming one comes from the direction side
      return {
        transform:
          d === 'left' ? `translateX(${OFFSCREEN(distance.width)}px)` :
          d === 'right' ? `translateX(${-OFFSCREEN(distance.width)}px)` :
          d === 'top' ? `translateY(${OFFSCREEN(distance.height)}px)` :
          `translateY(${-OFFSCREEN(distance.height)}px)`,
      }
    default:
      // instant / smart-animate / move-out / slide-out: nothing to pre-apply
      return {}
  }
}

/**
 * Compute the style the *leaving* frame animates TO for exit animations.
 * Returns null when the old frame should simply unmount (instant, overlays…).
 */
export function exitTo(
  animation: PrototypeAnimation,
  direction: PrototypeDirection,
  distance: { width: number; height: number }
): React.CSSProperties | null {
  const d = animation.direction ?? direction
  switch (animation.type) {
    case 'dissolve':
      return { opacity: 0 }
    case 'push':
      return {
        transform:
          d === 'left' ? `translateX(${-OFFSCREEN(distance.width)}px)` :
          d === 'right' ? `translateX(${OFFSCREEN(distance.width)}px)` :
          d === 'top' ? `translateY(${-OFFSCREEN(distance.height)}px)` :
          `translateY(${OFFSCREEN(distance.height)}px)`,
      }
    default:
      return null
  }
}

/** CSS transition shorthand for animating the given animation type. */
export function transitionCss(animation: PrototypeAnimation): string {
  if (animation.type === 'instant') return 'none'
  const dur = Math.max(0, animation.durationMs)
  const ez = easingCss(animation.easing, animation.bezier)
  const smartProps = animation.type === 'smart-animate'
    ? 'transform, opacity, width, height, border-radius, fill, stroke'
    : 'transform, opacity'
  return `${smartProps} ${dur}ms ${ez}`
}

/** Default direction for a given animation type (Figma defaults). */
export function defaultDirectionFor(
  type: PrototypeAnimation['type']
): PrototypeDirection {
  return type === 'push' ? 'left' : 'right'
}
