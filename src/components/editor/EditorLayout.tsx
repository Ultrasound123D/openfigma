'use client'

import React from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useEditorStore } from '@/store/editor-store'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { Canvas } from './Canvas'
import { RightSidebar } from './RightSidebar'
import { Toolbar } from './Toolbar'

export function EditorLayout() {
  const { leftSidebarVisible, rightSidebarVisible } = useEditorStore()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1E1E1E]">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {leftSidebarVisible && (
            <>
              <ResizablePanel defaultSize={18} minSize={14} maxSize={28} className="overflow-hidden">
                <LeftSidebar />
              </ResizablePanel>
              <ResizableHandle className="!bg-[#383838] !w-px hover:!bg-[#0D99FF] transition-colors" />
            </>
          )}
          <ResizablePanel defaultSize={leftSidebarVisible && rightSidebarVisible ? 64 : leftSidebarVisible || rightSidebarVisible ? 82 : 100}>
            <div className="relative w-full h-full">
              <Canvas />
              <Toolbar />
            </div>
          </ResizablePanel>
          {rightSidebarVisible && (
            <>
              <ResizableHandle className="!bg-[#383838] !w-px hover:!bg-[#0D99FF] transition-colors" />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={25} className="overflow-hidden">
                <RightSidebar />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
