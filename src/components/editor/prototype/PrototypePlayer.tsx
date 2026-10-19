'use client'

/**
 * PHASE 2 — PrototypePlayer: fullscreen prototype playback (Figma ▶).
 *
 * Behavior parity with Figma's presentation mode:
 *   - frame centered and scaled to fit the viewport
 *   - triggers fire: click / hover / drag / keypress / delay
 *   - actions: navigate, open-overlay (with backdrop), close-overlay, url, back
 *   - animations: instant, dissolve, move-in/out, slide-in/out, push,
 *     smart-animate (per-element tween via name-path matching — DECISION-005)
 *   - Esc exits, R restarts the flow
 *
 * State lives in the editor store (isPreviewing / previewFrameId /
 * overlayStack / previewHistory) so any surface can start/stop playback.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { DesignElement } from '@/store/editor-store'
import type { Interaction, PrototypeAnimation } from '@/types/prototype'
import { FrameRenderer } from './FrameRenderer'
import { enterFrom, exitTo, transitionCss } from '@/lib/prototype/transitions'
import { matchFrames } from '@/lib/prototype/smart-animate'

/** Fit scale with a comfortable margin, like Figma presentation mode. */
function fitScale(frame: { width: number; height: number }, vw: number, vh: number) {
  const margin = 0.85
  return Math.min((vw * margin) / Math.max(frame.width, 1), (vh * margin) / Math.max(frame.height, 1))
}

/** Find all elements (recursive) that have interactions on a trigger. */
function findInteractionHandlers(root: DesignElement, triggerType: Interaction['trigger']['type']) {
  const handlers: { el: DesignElement; interaction: Interaction }[] = []
  const walk = (el: DesignElement) => {
    for (const interaction of el.interactions || []) {
      if (interaction.trigger.type === triggerType) handlers.push({ el, interaction })
    }
    el.children?.forEach(walk)
  }
  root.children?.forEach(walk)
  return handlers
}

export function PrototypePlayer() {
  const {
    isPreviewing,
    previewFrameId,
    overlayStack,
    previewHistory,
    elements,
    stopPreview,
    startPreview,
    previewNavigate,
  } = useEditorStore()

  const [viewport, setViewport] = useState({ w: 1920, h: 1080 })
  const [transitionState, setTransitionState] = React.useState<{
    key: number
    phase: 'from' | 'to'
    animation: PrototypeAnimation | null
    /** smart-animate: destination frame element style overrides */
    smartFrom?: Map<string, React.CSSProperties>
    smartTransition?: string
  }>({ key: 0, phase: 'to', animation: null })
  const rafRef = useRef<number | null>(null)
  const dragStateRef = useRef<{ x: number; y: number; fired: boolean } | null>(null)

  // Viewport tracking
  useEffect(() => {
    if (!isPreviewing) return
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isPreviewing])

  const currentFrame = useMemo(
    () => elements.find((el) => el.id === previewFrameId) ?? null,
    [elements, previewFrameId]
  )

  /** Run an interaction: navigate + animate. */
  const runInteraction = useCallback(
    (interaction: Interaction) => {
      // url actions don't change player state
      if (interaction.action.type === 'url') {
        previewNavigate(interaction.action)
        return
      }

      const isFrameChange =
        interaction.action.type === 'navigate' ||
        interaction.action.type === 'back'
      const destId =
        interaction.action.type === 'navigate'
          ? interaction.action.destinationId
          : interaction.action.type === 'back'
            ? previewHistory[previewHistory.length - 1]
            : null

      // Smart animate needs the ORIGIN frame BEFORE navigating.
      let smartFrom: Map<string, React.CSSProperties> | undefined
      let smartTransition: string | undefined
      if (
        interaction.animation.type === 'smart-animate' &&
        isFrameChange &&
        currentFrame &&
        destId
      ) {
        const destFrame = elements.find((el) => el.id === destId)
        if (destFrame) {
          const match = matchFrames(currentFrame, destFrame)
          const offsets = new Map<string, React.CSSProperties>()
          for (const m of match.matched) {
            offsets.set(m.to.id, {
              transform: `translate(${m.diff.from.x - m.diff.to.x}px, ${m.diff.from.y - m.diff.to.y}px) scale(${m.diff.to.width ? m.diff.from.width / m.diff.to.width : 1}, ${m.diff.to.height ? m.diff.from.height / m.diff.to.height : 1})`,
              opacity: m.diff.from.opacity,
            })
          }
          for (const entering of match.entering) {
            offsets.set(entering.id, { opacity: 0 })
          }
          smartFrom = offsets
          smartTransition = transitionCss(interaction.animation)
        }
      }

      // Apply the action to the store (navigate/overlay/back).
      previewNavigate(interaction.action)

      // Kick off the enter animation (skip for overlays: they pop over).
      if (interaction.animation.type !== 'instant') {
        if (isFrameChange || interaction.action.type === 'open-overlay') {
          setTransitionState((s) => ({
            key: s.key + 1,
            phase: 'from',
            animation: interaction.animation,
            smartFrom,
            smartTransition,
          }))
        }
      }
    },
    [currentFrame, elements, previewHistory, previewNavigate]
  )

  // Flip phase 'from' -> 'to' on the next frame so CSS transitions run.
  useEffect(() => {
    if (transitionState.phase !== 'from') return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionState((s) => (s.phase === 'from' ? { ...s, phase: 'to' } : s))
      })
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [transitionState])

  // Delay triggers: fire when the shown frame changes.
  useEffect(() => {
    if (!isPreviewing || !currentFrame) return
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const { interaction } of findInteractionHandlers(currentFrame, 'delay')) {
      if (interaction.trigger.type === 'delay') {
        timers.push(setTimeout(() => runInteraction(interaction), Math.max(0, interaction.trigger.timeoutMs ?? 0)))
      }
    }
    return () => timers.forEach(clearTimeout)
  }, [isPreviewing, currentFrame, runInteraction])

  // Keypress triggers + Esc/R shortcuts.
  useEffect(() => {
    if (!isPreviewing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopPreview()
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        startPreview(previewFrameId)
        return
      }
      if (!currentFrame) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
      for (const { interaction } of findInteractionHandlers(currentFrame, 'keypress')) {
        if (interaction.trigger.type === 'keypress' && (interaction.trigger.keys || []).includes(key)) {
          e.preventDefault()
          runInteraction(interaction)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPreviewing, currentFrame, previewFrameId, runInteraction, startPreview, stopPreview])

  // Body scroll lock while playing.
  useEffect(() => {
    if (!isPreviewing) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isPreviewing])

  const handleElementPointerDown = useCallback(
    (el: DesignElement, e: React.PointerEvent) => {
      const clickHandlers = (el.interactions || []).filter((i) => i.trigger.type === 'click')
      const dragHandlers = (el.interactions || []).filter((i) => i.trigger.type === 'drag')

      if (dragHandlers.length > 0) {
        dragStateRef.current = { x: e.clientX, y: e.clientY, fired: false }
        const onMove = (ev: PointerEvent) => {
          const st = dragStateRef.current
          if (!st || st.fired) return
          if (Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 6) {
            st.fired = true
            runInteraction(dragHandlers[0])
            cleanup()
          }
        }
        const onUp = () => {
          // drag not achieved -> treat as click if a click trigger also exists
          const st = dragStateRef.current
          if (st && !st.fired && clickHandlers.length > 0) runInteraction(clickHandlers[0])
          cleanup()
        }
        const cleanup = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          dragStateRef.current = null
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return
      }

      if (clickHandlers.length > 0) {
        runInteraction(clickHandlers[0])
      }
    },
    [runInteraction]
  )

  const handleElementHover = useCallback(
    (el: DesignElement) => {
      const hover = (el.interactions || []).find((i) => i.trigger.type === 'hover')
      if (hover) runInteraction(hover)
    },
    [runInteraction]
  )

  // PHASE 16 — discrete mouse triggers (source: MOUSE_ENTER/LEAVE/DOWN/UP ×11)
  const handleElementEvent = useCallback(
    (el: DesignElement, kind: 'enter' | 'leave' | 'down' | 'up') => {
      const map = { enter: 'mouse-enter', leave: 'mouse-leave', down: 'mouse-down', up: 'mouse-up' } as const
      const ix = (el.interactions || []).find((i) => i.trigger.type === map[kind])
      if (ix) runInteraction(ix)
    },
    [runInteraction]
  )

  if (!isPreviewing) return null

  if (!currentFrame) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-2" style={{ fontSize: 14 }}>No frame to preview</p>
          <button onClick={stopPreview} className="px-4 h-8 rounded bg-[#0D99FF] text-white text-xs">
            Close (Esc)
          </button>
        </div>
      </div>
    )
  }

  const scale = fitScale(currentFrame, viewport.w, viewport.h)
  const t = transitionState
  const enterStyle: React.CSSProperties =
    t.phase === 'from' && t.animation
      ? enterFrom(t.animation, t.animation.direction ?? 'right', { width: viewport.w, height: viewport.h })
      : {}
  const activeStyle: React.CSSProperties =
    t.phase === 'to' && t.animation && t.animation.type !== 'instant'
      ? { transition: transitionCss(t.animation), transform: 'translate(0px, 0px)', opacity: 1 }
      : {}

  const smartElementStyle = (el: DesignElement): React.CSSProperties | undefined => {
    if (!t.smartFrom || !t.smartTransition) return undefined
    const from = t.smartFrom.get(el.id)
    if (!from) return undefined
    if (t.phase === 'from') return from
    return { ...from, transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, transition: t.smartTransition }
  }

  const innermostOverlay = overlayStack[overlayStack.length - 1]

  return (
    <div className="fixed inset-0 z-[10000] bg-[#141414] select-none" data-testid="prototype-player">
      {/* Base frame */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          key={`base-${previewFrameId}-${t.key}`}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            position: 'absolute',
            ...enterStyle,
            ...activeStyle,
          }}
        >
          <FrameRenderer
            frame={currentFrame}
            interactive={overlayStack.length === 0}
            onElementPointerDown={handleElementPointerDown}
            onElementHover={handleElementHover}
            onElementEvent={handleElementEvent}
            elementStyle={smartElementStyle}
          />
        </div>
      </div>

      {/* Overlay stack (innermost on top) */}
      {overlayStack.map((ov, idx) => {
        const ovFrame = elements.find((el) => el.id === ov.frameId)
        if (!ovFrame) return null
        const isInnermost = idx === overlayStack.length - 1
        const ovScale = fitScale(ovFrame, viewport.w, viewport.h)
        return (
          <div
            key={`ov-${ov.frameId}-${idx}`}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                ov.background.type === 'solid' ? ov.background.color ?? 'rgba(0,0,0,0.4)' : undefined,
              backdropFilter:
                ov.background.type === 'blur' ? `blur(${ov.background.blurRadius ?? 8}px)` : undefined,
              backgroundColor:
                ov.background.type === 'none' ? 'transparent' : undefined,
            }}
            onPointerDown={(e) => {
              if (isInnermost && ov.closeOnClickOutside && e.target === e.currentTarget) {
                useEditorStore.getState().previewNavigate({ type: 'close-overlay' })
              }
            }}
          >
            <div
              key={`ovc-${ov.frameId}-${idx}-${t.key}`}
              style={{
                position: 'relative',
                transform: `scale(${ovScale})`,
                ...enterStyle,
                ...activeStyle,
              }}
            >
              <FrameRenderer
                frame={ovFrame}
                interactive={isInnermost}
                onElementPointerDown={isInnermost ? handleElementPointerDown : undefined}
              />
            </div>
          </div>
        )
      })}

      {/* HUD: bottom bar (Figma-style) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 h-9 rounded-full bg-[#2C2C2C]/95 border border-[#383838] text-xs text-[#CCC]">
        <span className="px-2 tabular-nums" style={{ fontFamily: 'var(--fig-font-family-mono)' }}>
          {currentFrame.name}
        </span>
        {previewHistory.length > 0 && (
          <button
            className="flex items-center gap-1 px-2 h-7 rounded-full hover:bg-[#3C3C3C] hover:text-white"
            onClick={() => previewNavigate({ type: 'back' })}
          >
            ← Back
          </button>
        )}
        <button
          className="flex items-center gap-1 px-2 h-7 rounded-full hover:bg-[#3C3C3C] hover:text-white"
          onClick={() => startPreview(previewFrameId)}
        >
          ⟳ Restart (R)
        </button>
        <button
          className="flex items-center gap-1 px-2 h-7 rounded-full bg-[#0D99FF] text-white hover:bg-[#0B87E0]"
          onClick={stopPreview}
        >
          ✕ Exit (Esc)
        </button>
      </div>
    </div>
  )
}
