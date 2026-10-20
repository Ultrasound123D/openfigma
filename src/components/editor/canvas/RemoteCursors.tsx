'use client'

/**
 * PHASE 22 (C19) — remote cursors + viewport overlay.
 *
 * Source evidence:
 *   - multiplayer_cursors--cursorImage / --isPointingRight (figma_app-ebce)
 *   - multiplayer_viewport_overlay--viewportFrame / --prototypeView (2971)
 *   - allUsers[e].color / name chips
 *   - toggle-viewport-overlay-hiding → temporarilyHideViewportOverlay
 *
 * Renders an absolutely-positioned layer OVER the canvas SVG:
 *   - remote cursor arrows with name chips (color per client)
 *   - remote selection outlines
 *   - remote viewport rectangles (hidden when hideViewportOverlay is on)
 */

import React, { useEffect } from 'react'
import { useEditorStore } from '@/store/editor-store'

export function RemoteCursors() {
  const remotePresences = useEditorStore((s) => s.remotePresences)
  const showMultiplayerCursors = useEditorStore((s) => s.showMultiplayerCursors)
  const hideViewportOverlay = useEditorStore((s) => s.hideViewportOverlay)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)

  // PHASE 22 (C19) — prune stale presences on a timer (pruning must not depend
  // on new events arriving: a disconnected peer stops sending)
  useEffect(() => {
    const t = setInterval(() => useEditorStore.getState().pruneRemotePresences(), 3000)
    return () => clearInterval(t)
  }, [])

  const others = Object.values(remotePresences)
  if (others.length === 0) return null

  const safeZoom = isFinite(zoom) && zoom > 0.001 ? zoom : 1
  // canvas → container CSS px: screen = W/2 + panX + canvas*zoom. The layer is
  // inset-0 over the same container, so position = center + canvas*zoom where
  // center depends on container size — computed per entry via calc() using
  // 50% of the layer itself.
  const project = (x: number, y: number): React.CSSProperties => ({
    left: `calc(50% + ${panX + x * safeZoom}px)`,
    top: `calc(50% + ${panY + y * safeZoom}px)`,
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {/* remote viewport rectangles (multiplayer_viewport_overlay--viewportFrame) */}
      {!hideViewportOverlay &&
        others.map((p) =>
          p.viewport ? (
            <div
              key={`vp-${p.clientId}`}
              className="absolute border"
              style={{
                ...project(p.viewport.x, p.viewport.y),
                width: p.viewport.w * safeZoom,
                height: p.viewport.h * safeZoom,
                borderColor: p.color,
                borderWidth: 1,
                borderStyle: 'dashed',
                opacity: 0.55,
                borderRadius: 4,
              }}
            >
              <span
                className="absolute -top-[15px] left-0 text-[9px] px-1 rounded-t"
                style={{ background: p.color, color: '#fff' }}
              >
                {p.name}
              </span>
            </div>
          ) : null
        )}

      {/* remote selections */}
      {others.map((p) =>
        p.selection ? (
          <div
            key={`sel-${p.clientId}`}
            className="absolute border-2"
            style={{
              ...project(p.selection.x, p.selection.y),
              width: p.selection.w * safeZoom,
              height: p.selection.h * safeZoom,
              borderColor: p.color,
              borderRadius: 2,
              opacity: 0.9,
            }}
          />
        ) : null
      )}

      {/* remote cursors (multiplayer_cursors--cursorImage + name chip) */}
      {showMultiplayerCursors &&
        others.map((p) =>
          p.cursor ? (
            <div
              key={`cur-${p.clientId}`}
              className="absolute transition-transform duration-75 ease-linear"
              style={project(p.cursor.x, p.cursor.y)}
            >
              <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow-sm">
                <path
                  d="M1 1 L1 15 L5 11.5 L7.5 17 L10 16 L7.5 10.5 L12.5 10 Z"
                  fill={p.color}
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="absolute left-[14px] top-[14px] text-[9px] leading-none px-1 py-[2px] rounded text-white whitespace-nowrap"
                style={{ background: p.color }}
              >
                {p.name}
              </span>
            </div>
          ) : null
        )}
    </div>
  )
}
