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
import { isBooleanOperandType } from '@/lib/boolean-ops'
import { isOutlineStrokeCandidate } from '@/lib/outline-stroke'
import { toast } from '@/hooks/use-toast'
// PHASE 23 (F1–F4) — clipboard exports (source: 5018 design ctx menu)
import { copyAsPngToClipboard, copyAsSvgToClipboard, copyTextToClipboard, copyLayerNameToClipboard } from '@/lib/clipboard-io'

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
    applyBooleanOperation,
    setElementAsMask,
    outlineStrokeSelection,
    flattenSelection,
    splitVectorSelection,
    pasteOverSelection,
    selectSimilar,
    selectInverse,
    clipboard,
    // PHASE 23 — final-audit completions (see PORT-PLAN-23)
    propertyClipboard,
    pasteClipboardAt,
    copyProperties,
    pasteProperties,
    unlockAllOnPage,
    frameSelection,
    addVariantToSet,
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
      // PHASE 21 (E14) — paste over selection (source: PASTE_OVER_SELECTION=53)
      case 'paste-over':
        pasteOverSelection()
        pushHistory()
        break
      // PHASE 23 (F6) — paste here (source: {action:"paste-here",flags:["edit"]})
      case 'paste-here':
        pasteClipboardAt(canvasX, canvasY)
        pushHistory()
        break
      // PHASE 23 (F5) — copy/paste properties
      case 'copy-properties':
        copyProperties()
        toast({ title: 'Properties copied' })
        break
      case 'paste-properties':
        pasteProperties()
        pushHistory()
        break
      // PHASE 23 (F7) — unlock all (source: unlock-all)
      case 'unlock-all':
        unlockAllOnPage()
        pushHistory()
        break
      // PHASE 23 (F10) — frame selection (source: frame-selection)
      case 'frame-selection':
        frameSelection()
        pushHistory()
        break
      // PHASE 23 (F15) — add variant (source: add-variant, figma_app)
      case 'add-variant':
        if (selectedElement?.isComponentSet) {
          addVariantToSet(selectedElement.id)
          pushHistory()
        }
        break
      // PHASE 21 (E15) — select similar / inverse + select-all-with children
      case 'select-similar':
        selectSimilar('similar')
        break
      case 'select-inverse':
        selectInverse()
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
      // PHASE 6: boolean ops + mask
      case 'boolean-union':
      case 'boolean-subtract':
      case 'boolean-intersect':
      case 'boolean-exclude': {
        const op = action.replace('boolean-', '') as 'union' | 'subtract' | 'intersect' | 'exclude'
        pushHistory()
        const res = applyBooleanOperation(op)
        if (!res.ok) {
          toast({ title: 'Boolean operation failed', description: res.reason, variant: 'destructive' })
        }
        break
      }
      case 'toggle-mask': {
        if (selectedElement && isBooleanOperandType(selectedElement)) {
          pushHistory()
          setElementAsMask(selectedElement.id, !selectedElement.isMask)
        }
        break
      }
      // PHASE 17 (P2) — outline stroke (source: OUTLINE_STROKE=233)
      case 'outline-stroke': {
        pushHistory()
        const n = outlineStrokeSelection()
        if (n === 0) toast({ title: 'Nothing to outline', description: 'Select shapes with a visible stroke.', variant: 'destructive' })
        break
      }
      // PHASE 17 (P3) — flatten (source: FLATTEN_SELECTION)
      case 'flatten': {
        pushHistory()
        const n = flattenSelection()
        if (n === 0) toast({ title: 'Nothing to flatten', description: 'Select a boolean group (live boolean result).', variant: 'destructive' })
        break
      }
      // PHASE 20 (PR13) — flow starting points on frames
      case 'add-flow-start': {
        if (selectedElement?.type === 'frame') {
          pushHistory()
          useEditorStore.getState().addFlowStartingPoint(selectedElement.id)
        }
        break
      }
      case 'remove-flow-start': {
        if (selectedElement?.type === 'frame') {
          pushHistory()
          useEditorStore.getState().removeFlowStartingPoint(selectedElement.id)
        }
        break
      }
      // PHASE 18 — split vector network into paths (source: split_vector)
      case 'split-vector': {
        pushHistory()
        const n = splitVectorSelection()
        if (n === 0) toast({ title: 'Nothing to split', description: 'Select a multi-contour path (flatten / outline result).', variant: 'destructive' })
        break
      }
    }
  }

  const hasSelection = selectedElementIds.length > 0
  // PHASE 6 gating: boolean needs ≥2 vector shapes; mask needs 1 maskable shape
  const booleanEligible = selectedElementIds
    .map((id) => findElementInList(elements, id))
    .filter((el): el is NonNullable<typeof el> => !!el && isBooleanOperandType(el))
  const canBoolean = booleanEligible.length >= 2
  const maskCandidate = selectedElement && !selectedElement.isMask && isBooleanOperandType(selectedElement)
    ? selectedElement
    : null
  const unmaskCandidate = selectedElement?.isMask ? selectedElement : null

  // PHASE 23 (F7) — unlock-all shows only when something is actually locked
  const anyLocked = (function walk(els: typeof elements): boolean {
    return els.some((el) => el.locked || (el.children ? walk(el.children) : false))
  })(elements)

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
            {/* PHASE 23 (F1–F4) — copy-as entries (source: 5018 design/dev ctx
                menu: copy-as-png / copy-as-svg / copy-text / copy-layer-name) */}
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { if (selectedElement) copyAsPngToClipboard(selectedElement, 2) }}>
              Copy as PNG
              <ContextMenuShortcut>⇧⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { if (selectedElement) copyAsSvgToClipboard(selectedElement) }}>
              Copy as SVG
            </ContextMenuItem>
            {selectedElement?.type === 'text' && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { if (selectedElement) copyTextToClipboard(selectedElement) }}>
                Copy Text
              </ContextMenuItem>
            )}
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => { if (selectedElement) copyLayerNameToClipboard(selectedElement) }}>
              Copy Layer Name
            </ContextMenuItem>
            {/* PHASE 23 (F5) — copy/paste properties (source: copy-properties /
                paste-properties, 5018 ctx menu) */}
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('copy-properties')}>
              Copy Properties
            </ContextMenuItem>
            {propertyClipboard && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste-properties')}>
                Paste Properties
              </ContextMenuItem>
            )}
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste')}>
              Paste
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            {clipboard.length > 0 && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste-here')}>
                {/* PHASE 23 (F6) — paste here (source: paste-here) */}
                Paste Here
              </ContextMenuItem>
            )}
            {clipboard.length > 0 && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste-over')}>
                Paste Over Selection
                <ContextMenuShortcut>⇧⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('duplicate')}>
              Duplicate
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C] text-[#F44336]" onClick={() => handleAction('delete')}>
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
            {/* PHASE 21 (E15) — select similar / inverse + select-all-with submenu
                (source children: select-same-{style,fill,stroke,effect,text,font,instance,variant}) */}
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('select-similar')}>
              Select Similar
            </ContextMenuItem>
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('select-inverse')}>
              Select Inverse
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">Select All With</ContextMenuSubTrigger>
              <ContextMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[190px]">
                {([
                  ['style', 'Same style'],
                  ['fill', 'Same fill'],
                  ['stroke', 'Same stroke'],
                  ['effect', 'Same effect'],
                  ['text', 'Same type'],
                  ['font', 'Same font'],
                  ['instance', 'Same instance'],
                  ['variant', 'Same variant'],
                ] as const).map(([key, label]) => (
                  <ContextMenuItem key={key} className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => selectSimilar(key)}>
                    {label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
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
            {clipboard.length > 0 && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('paste-here')}>
                {/* PHASE 23 (F6) — paste here (source: paste-here) */}
                Paste Here
              </ContextMenuItem>
            )}
            {anyLocked && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('unlock-all')}>
                {/* PHASE 23 (F7) — unlock all (source: unlock-all) */}
                Unlock All
              </ContextMenuItem>
            )}
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
            {/* PHASE 23 (F10) — frame selection (source: frame-selection) */}
            {selectedElementIds.length >= 1 && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('frame-selection')}>
                Frame Selection
                <ContextMenuShortcut>⌥⌘G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {/* PHASE 23 (F15) — add variant (source: add-variant, figma_app ×16) */}
            {selectedElement?.isComponentSet && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('add-variant')}>
                Add Variant
              </ContextMenuItem>
            )}
            {anyLocked && hasSelection && (
              <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('unlock-all')}>
                {/* PHASE 23 (F7) — unlock all (source: unlock-all) */}
                Unlock All
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

        {/* PHASE 6: Boolean operations + mask */}
        {canBoolean && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]">
                Boolean Operations
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="bg-[#2C2C2C] border-[#3C3C3C] text-[#CCC] min-w-[180px]">
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('boolean-union')}>
                  Union
                  <ContextMenuShortcut>⌥⌘U</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('boolean-subtract')}>
                  Subtract
                  <ContextMenuShortcut>⌥⌘S</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('boolean-intersect')}>
                  Intersect
                  <ContextMenuShortcut>⌥⌘I</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('boolean-exclude')}>
                  Exclude
                  <ContextMenuShortcut>⌥⌘E</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        {(maskCandidate || unmaskCandidate) && (
          <>
            <ContextMenuSeparator className="bg-[#3C3C3C]" />
            <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('toggle-mask')}>
              {unmaskCandidate ? 'Remove Mask' : 'Set as Mask'}
              <ContextMenuShortcut>⌃⌘M</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {/* PHASE 17: outline stroke + flatten (source: OUTLINE_STROKE=233 /
            FLATTEN_SELECTION; gated on real eligibility) */}
        {hasSelection && (() => {
          const selected = selectedElementIds
            .map((id) => findElementInList(elements, id))
            .filter((el): el is NonNullable<typeof el> => !!el)
          const outlineable = selected.filter((el) => isOutlineStrokeCandidate(el)).length > 0
          const flattenable = selected.some((el) => el.type === 'boolean')
          const splittable = selected.some((el) => el.type === 'path' && el.booleanContours && el.booleanContours.length > 1)
          if (!outlineable && !flattenable && !splittable) return null
          return (
            <>
              <ContextMenuSeparator className="bg-[#3C3C3C]" />
              {outlineable && (
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('outline-stroke')}>
                  Outline Stroke
                </ContextMenuItem>
              )}
              {flattenable && (
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('flatten')}>
                  Flatten
                </ContextMenuItem>
              )}
              {splittable && (
                <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('split-vector')}>
                  Split Vector
                </ContextMenuItem>
              )}
              {selectedElement?.type === 'frame' && (() => {
                const hasStart = useEditorStore.getState().flowStartingPoints.some((f) => f.frameId === selectedElement.id)
                return hasStart ? (
                  <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('remove-flow-start')}>
                    Remove Flow Start
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem className="hover:bg-[#3C3C3C] focus:bg-[#3C3C3C]" onClick={() => handleAction('add-flow-start')}>
                    Add Flow Start ▶
                  </ContextMenuItem>
                )
              })()}
            </>
          )
        })()}

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
