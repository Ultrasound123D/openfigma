'use client'

import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import { useEditorStore } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'

interface CanvasContextMenuProps {
  children: React.ReactNode
  canvasX: number
  canvasY: number
}

export function CanvasContextMenu({ children, canvasX, canvasY }: CanvasContextMenuProps) {
  const {
    selectedElementIds,
    deleteSelectedElements,
    duplicateSelectedElements,
    groupElements,
    ungroupElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    addComponent,
    detachInstance,
    flipHorizontal,
    flipVertical,
    updateElement,
    pushHistory,
    copySelected,
    pasteClipboard,
    elements,
  } = useEditorStore()

  const selectedElement = selectedElementIds.length === 1
    ? findElementInList(elements, selectedElementIds[0])
    : null

  const handleAction = (action: string) => {
    switch (action) {
      case 'copy':
        copySelected()
        break
      case 'paste':
        pasteClipboard()
        pushHistory()
        break
      case 'delete':
        deleteSelectedElements()
        pushHistory()
        break
      case 'duplicate':
        duplicateSelectedElements()
        pushHistory()
        break
      case 'group':
        if (selectedElementIds.length >= 2) {
          groupElements(selectedElementIds)
          pushHistory()
        }
        break
      case 'ungroup':
        if (selectedElementIds.length === 1) {
          ungroupElements(selectedElementIds[0])
          pushHistory()
        }
        break
      case 'bring-forward':
        selectedElementIds.forEach(id => bringForward(id))
        pushHistory()
        break
      case 'send-backward':
        selectedElementIds.forEach(id => sendBackward(id))
        pushHistory()
        break
      case 'bring-to-front':
        selectedElementIds.forEach(id => bringToFront(id))
        pushHistory()
        break
      case 'send-to-back':
        selectedElementIds.forEach(id => sendToBack(id))
        pushHistory()
        break
      case 'make-component':
        if (selectedElementIds.length === 1) {
          addComponent(selectedElementIds[0])
          pushHistory()
        }
        break
      case 'detach-instance':
        if (selectedElement?.componentId) {
          detachInstance(selectedElement.id)
          pushHistory()
        }
        break
      case 'flip-h':
        if (selectedElementIds.length > 0) {
          selectedElementIds.forEach(id => flipHorizontal(id))
          pushHistory()
        }
        break
      case 'flip-v':
        if (selectedElementIds.length > 0) {
          selectedElementIds.forEach(id => flipVertical(id))
          pushHistory()
        }
        break
      case 'lock':
        if (selectedElementIds.length > 0) {
          selectedElementIds.forEach(id => {
            const el = findElementInList(useEditorStore.getState().elements, id)
            if (el) updateElement(id, { locked: !el.locked })
          })
          pushHistory()
        }
        break
      case 'unlock':
        if (selectedElementIds.length > 0) {
          selectedElementIds.forEach(id => updateElement(id, { locked: false }))
          pushHistory()
        }
        break
      case 'add-auto-layout':
        if (selectedElementIds.length === 1 && selectedElement?.type === 'frame') {
          updateElement(selectedElement.id, {
            autoLayout: { direction: 'vertical', gap: 10, paddingTop: 10, paddingBottom: 10, paddingLeft: 10, paddingRight: 10, alignItems: 'start', justifyContent: 'start' }
          })
          pushHistory()
        }
        break
      case 'remove-auto-layout':
        if (selectedElementIds.length === 1 && selectedElement?.autoLayout) {
          updateElement(selectedElement.id, { autoLayout: undefined })
          pushHistory()
        }
        break
    }
  }

  const hasSelection = selectedElementIds.length > 0

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[220px]">
        {/* Copy/Paste section */}
        {hasSelection && (
          <>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('copy')}>
              Copy
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste')}>
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('duplicate')}>
              Duplicate
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[#F44336]" onClick={() => handleAction('delete')}>
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
          </>
        )}

        {/* Paste when no selection */}
        {!hasSelection && (
          <>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste')}>
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
          </>
        )}

        {/* Group/Ungroup */}
        {hasSelection && (
          <>
            {selectedElementIds.length >= 2 && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('group')}>
                Group
                <ContextMenuShortcut>⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {selectedElement?.type === 'group' && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('ungroup')}>
                Ungroup
                <ContextMenuShortcut>⌘⇧G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Z-order */}
        {hasSelection && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                Arrange
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[180px]">
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('bring-to-front')}>
                  Bring to Front
                  <ContextMenuShortcut>⌘⇧]</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('bring-forward')}>
                  Bring Forward
                  <ContextMenuShortcut>⌘]</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#3C3C3C]" />
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('send-backward')}>
                  Send Backward
                  <ContextMenuShortcut>⌘[</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('send-to-back')}>
                  Send to Back
                  <ContextMenuShortcut>⌘⇧[</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {/* Component system */}
        {hasSelection && !selectedElement?.isComponent && !selectedElement?.componentId && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('make-component')}>
              Create Component
              <ContextMenuShortcut>⌥⌘K</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {selectedElement?.componentId && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('detach-instance')}>
              Detach Instance
            </ContextMenuItem>
          </>
        )}

        {/* Flip */}
        {hasSelection && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                Flip
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[160px]">
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('flip-h')}>
                  Flip Horizontal
                  <ContextMenuShortcut>⇧H</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('flip-v')}>
                  Flip Vertical
                  <ContextMenuShortcut>⇧V</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {/* Auto Layout */}
        {hasSelection && selectedElement?.type === 'frame' && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            {selectedElement.autoLayout ? (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('remove-auto-layout')}>
                Remove Auto Layout
                <ContextMenuShortcut>⇧A</ContextMenuShortcut>
              </ContextMenuItem>
            ) : (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('add-auto-layout')}>
                Add Auto Layout
                <ContextMenuShortcut>⇧A</ContextMenuShortcut>
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Lock/Unlock */}
        {hasSelection && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('lock')}>
              {selectedElement?.locked ? 'Unlock' : 'Lock'}
              <ContextMenuShortcut>⌘L</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
