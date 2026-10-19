'use client'

import React from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useEditorStore } from '@/store/editor-store'
import { useProjectSync } from '@/hooks/use-project-sync'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { Canvas } from './Canvas'
import { RightSidebar } from './RightSidebar'
import { Toolbar } from './Toolbar'
import { PrototypePlayer } from './prototype/PrototypePlayer'

/**
 * UI3 chrome dimensions (PHASE 1, verified measurements — globals.css tokens):
 *   left sidebar 241px, right sidebar 320px.
 * react-resizable-panels sizes in %, so the defaults are derived from the
 * pixel tokens against the live viewport, then clamped to sane min/max.
 */
const PX_LEFT = 241
const PX_RIGHT = 320

function usePanelPercents(leftVisible: boolean, rightVisible: boolean) {
  const [vw, setVw] = React.useState(0)
  React.useEffect(() => {
    const update = () => setVw(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const pct = (px: number) => Math.max(8, Math.min(30, (px / Math.max(vw || 1920, 1024)) * 100))
  const left = pct(PX_LEFT)
  const right = pct(PX_RIGHT)
  const center = leftVisible && rightVisible ? 100 - left - right : leftVisible || rightVisible ? 100 - (leftVisible ? left : right) : 100
  return { left, right, center }
}

export function EditorLayout() {
  const { leftSidebarVisible, rightSidebarVisible } = useEditorStore()
  const { left, right, center } = usePanelPercents(leftSidebarVisible, rightSidebarVisible)

  // Live sync: single SSE subscription for the whole editor (P4).
  useProjectSync()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1E1E1E]">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {leftSidebarVisible && (
            <>
              <ResizablePanel defaultSize={left} minSize={10} maxSize={34} className="overflow-hidden">
                <LeftSidebar />
              </ResizablePanel>
              <ResizableHandle className="!bg-[#383838] !w-px hover:!bg-[#0D99FF] transition-colors" />
            </>
          )}
          <ResizablePanel defaultSize={center}>
            <div className="relative w-full h-full">
              <Canvas />
              <Toolbar />
            </div>
          </ResizablePanel>
          {rightSidebarVisible && (
            <>
              <ResizableHandle className="!bg-[#383838] !w-px hover:!bg-[#0D99FF] transition-colors" />
              <ResizablePanel defaultSize={right} minSize={12} maxSize={38} className="overflow-hidden">
                <RightSidebar />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      {/* PHASE 2: fullscreen prototype playback (▶) */}
      <PrototypePlayer />
    </div>
  )
}
