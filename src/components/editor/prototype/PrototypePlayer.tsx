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

/** PHASE 20 — find a node anywhere under (or including) root. */
function findNodeInTree(root: DesignElement, id: string): DesignElement | null {
  if (root.id === id) return root
  for (const c of root.children || []) {
    const r = findNodeInTree(c, id)
    if (r) return r
  }
  return null
}

/** PHASE 20 — absolute offset of a node inside root's coordinate space. */
function absoluteOffsetIn(root: DesignElement, id: string): { x: number; y: number } {
  const walk = (el: DesignElement, ox: number, oy: number): { x: number; y: number } | null => {
    if (el.id === id) return { x: ox + el.x, y: oy + el.y }
    for (const c of el.children || []) {
      const r = walk(c, ox + el.x, oy + el.y)
      if (r) return r
    }
    return null
  }
  for (const c of root.children || []) {
    const r = walk(c, root.x, root.y)
    if (r) return r
  }
  return { x: 0, y: 0 }
}



/** PHASE 20 (PR11) — deep clone with fresh ids (player-local swap target). */
function cloneWithNewIds(el: DesignElement, tag: string): DesignElement {
  const id = `${el.id}-s${tag}`
  const children = el.children?.map((c) => cloneWithNewIds(c, tag))
  return { ...el, id, ...(children ? { children } : {}) }
}

/** PHASE 20 (PR11) — apply the swap map to a frame tree (transient, player-only). */
function applySwapMap(frame: DesignElement, swaps: Map<string, string>, pool: DesignElement[]): DesignElement {
  if (swaps.size === 0) return frame
  const find = (id: string): DesignElement | null => {
    const walk = (list: DesignElement[]): DesignElement | null => {
      for (const e of list) {
        if (e.id === id) return e
        if (e.children) { const r = walk(e.children); if (r) return r }
      }
      return null
    }
    return walk(pool)
  }
  const tag = Math.random().toString(36).slice(2, 7)
  const walk = (el: DesignElement): DesignElement => {
    const targetId = swaps.get(el.id)
    if (targetId) {
      const target = find(targetId)
      if (target) {
        // PHASE 20 fix (open-item E, live-verified): the swapped-in node takes
        // the SOURCE element's slot — cloneWithNewIds kept the target's own
        // x/y, which can lie OUTSIDE the host frame's viewBox (clipped →
        // "swap never appears"). Figma parity: Change To replaces the node in
        // place (same top-left).
        return { ...cloneWithNewIds(target, tag), x: el.x, y: el.y }
      }
    }
    if (el.children?.length) {
      return { ...el, children: el.children.map(walk) }
    }
    return el
  }
  return { ...frame, children: frame.children?.map(walk) }
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
  // PHASE 20 — scroll container for scrollable frames + player-local swap map
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [swapMap, setSwapMap] = React.useState<Map<string, string>>(new Map())
  const playScaleRef = useRef(1)
  const viewportRef = useRef({ w: 1920, h: 1080 })
  const currentFrameRef = useRef<DesignElement | null>(null)

  // Viewport tracking
  useEffect(() => {
    if (!isPreviewing) return
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isPreviewing])

  // PHASE 20 fix: restart presentation resets prototype state — the change-to
  // swap map is transient and must NOT survive stop/start preview (the player
  // component stays mounted while idle, so its useState would otherwise leak
  // swaps into the next presentation run; Figma parity: fresh run, fresh state).
  // Render-phase adjustment pattern (React docs: "adjusting state when a prop
  // changes") — covers every stopPreview entry point incl. external callers.
  const [prevPreviewing, setPrevPreviewing] = React.useState(isPreviewing)
  if (prevPreviewing !== isPreviewing) {
    setPrevPreviewing(isPreviewing)
    if (!isPreviewing && swapMap.size > 0) setSwapMap(new Map())
  }

  const currentFrame = useMemo(
    () => elements.find((el) => el.id === previewFrameId) ?? null,
    [elements, previewFrameId]
  )

  /** Run an interaction: navigate + animate. */
  const runInteraction = useCallback(
    (interaction: Interaction, sourceEl?: DesignElement) => {
      // url actions don't change player state
      if (interaction.action.type === 'url') {
        previewNavigate(interaction.action)
        return
      }

      // PHASE 20 (PR11) — change-to: swap this node for the target (player-local,
      // transient — never dirties the design; parity with SWAP_STATE).
      if (interaction.action.type === 'change-to') {
        if (interaction.action.destinationId && sourceEl) {
          const srcId = sourceEl.id
          setSwapMap((m) => { const n = new Map(m); n.set(srcId, interaction.action.destinationId!); return n })
        }
        return
      }

      // PHASE 20 (PR12) — scroll-to: smooth-scroll the frame to reveal the node.
      if (interaction.action.type === 'scroll-to') {
        const destId = interaction.action.destinationId
        const cf = currentFrameRef.current
        if (destId && scrollRef.current && cf) {
          const node = findNodeInTree(cf, destId)
          if (node) {
            const abs = absoluteOffsetIn(cf, destId)
            const ps = playScaleRef.current
            const vp = viewportRef.current
            scrollRef.current.scrollTo({
              top: Math.max(0, abs.y * ps - vp.h * 0.35),
              left: Math.max(0, abs.x * ps - vp.w * 0.35),
              behavior: 'smooth',
            })
          }
        }
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
    for (const { el: delEl, interaction } of findInteractionHandlers(currentFrame, 'delay')) {
      if (interaction.trigger.type === 'delay') {
        timers.push(setTimeout(() => runInteraction(interaction, delEl), Math.max(0, interaction.trigger.timeoutMs ?? 0)))
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
      for (const { el: keyEl, interaction } of findInteractionHandlers(currentFrame, 'keypress')) {
        if (interaction.trigger.type === 'keypress' && (interaction.trigger.keys || []).includes(key)) {
          e.preventDefault()
          runInteraction(interaction, keyEl)
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
            runInteraction(dragHandlers[0], el)
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
        runInteraction(clickHandlers[0], el)
      }
    },
    [runInteraction]
  )

  const handleElementHover = useCallback(
    (el: DesignElement) => {
      const hover = (el.interactions || []).find((i) => i.trigger.type === 'hover')
      if (hover) runInteraction(hover, el)
    },
    [runInteraction]
  )

  // PHASE 16 — discrete mouse triggers (source: MOUSE_ENTER/LEAVE/DOWN/UP ×11)
  const handleElementEvent = useCallback(
    (el: DesignElement, kind: 'enter' | 'leave' | 'down' | 'up') => {
      const map = { enter: 'mouse-enter', leave: 'mouse-leave', down: 'mouse-down', up: 'mouse-up' } as const
      const ix = (el.interactions || []).find((i) => i.trigger.type === map[kind])
      if (ix) runInteraction(ix, el)
    },
    [runInteraction]
  )

  // PHASE 20 — display frame with the change-to swap map applied (player-local).
  // Null-safe so the hook runs before any early return.
  const displayFrame = useMemo(
    () => (currentFrame ? applySwapMap(currentFrame, swapMap, elements) : null),
    [currentFrame, swapMap, elements]
  )
  // PHASE 20 — keep refs in sync for action handlers (scroll-to).
  // Computed from the same values the render uses (null-safe currentFrame).
  useEffect(() => {
    const cf = currentFrame
    if (!cf) return
    const widthFit = (viewport.w * 0.85) / Math.max(cf.width, 1)
    const scale0 = fitScale(cf, viewport.w, viewport.h)
    playScaleRef.current = cf.height * widthFit > viewport.h ? widthFit : scale0
    viewportRef.current = viewport
    currentFrameRef.current = cf
  }, [currentFrame, viewport])

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

  // PHASE 20 (PR10) — scrolling mode: a frame taller than the viewport (after
  // width-fit) becomes a scrollable frame (source: fixedScrolling). Fixed
  // children (scrollBehavior === 'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME', only
  // while this frame is scrollable — parity fixedScrollingDisabled) render in
  // a non-scrolling overlay layer.
  const widthFit = (viewport.w * 0.85) / Math.max(currentFrame.width, 1)
  const scrolling = currentFrame.height * widthFit > viewport.h
  const playScale = scrolling ? widthFit : scale
  const fixedChildren = (currentFrame.children || []).filter(
    (c) => c.scrollBehavior === 'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME'
  )
  const anyFixed = scrolling && fixedChildren.length > 0


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
      {/* Base frame — PHASE 20: scrollable frames render a scrolling layer
          (fixed children excluded) + a pinned overlay layer (fixed only).
          displayFrame applies the player-local change-to swap map. */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {scrolling ? (
          <div
            className="relative"
            style={{
              width: Math.round(currentFrame.width * playScale),
              height: Math.min(Math.round(currentFrame.height * playScale), viewport.h),
            }}
            onWheel={(e) => { if (!scrollRef.current) return }}
          >
            <div ref={scrollRef} className="absolute inset-0 overflow-auto" data-testid="player-scroll">
              <div
                key={`base-${previewFrameId}-${t.key}`}
                style={{
                  transform: `scale(${playScale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  ...enterStyle,
                  ...activeStyle,
                }}
              >
                <FrameRenderer
                  frame={displayFrame!}
                  interactive={overlayStack.length === 0}
                  onElementPointerDown={handleElementPointerDown}
                  onElementHover={handleElementHover}
                  onElementEvent={handleElementEvent}
                  elementStyle={smartElementStyle}
                  childFilter={anyFixed ? (c) => c.scrollBehavior !== 'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME' : undefined}
                />
              </div>
            </div>
            {anyFixed && (
              <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
                <div
                  style={{
                    transform: `scale(${playScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: currentFrame.width,
                    height: currentFrame.height,
                  }}
                >
                  <FrameRenderer
                    frame={currentFrame}
                    interactive={overlayStack.length === 0}
                    onElementPointerDown={handleElementPointerDown}
                    onElementHover={handleElementHover}
                    onElementEvent={handleElementEvent}
                    elementStyle={smartElementStyle}
                    childFilter={(c) => c.scrollBehavior === 'FIXED_WHEN_CHILD_OF_SCROLLING_FRAME'}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
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
              frame={displayFrame!}
              interactive={overlayStack.length === 0}
              onElementPointerDown={handleElementPointerDown}
              onElementHover={handleElementHover}
              onElementEvent={handleElementEvent}
              elementStyle={smartElementStyle}
            />
          </div>
        )}
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
