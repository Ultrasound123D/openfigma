'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { findElementInList } from '@/lib/element-utils'

interface InlineTextEditorProps {
  elementId: string
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  panX: number
  panY: number
  containerWidth: number
  containerHeight: number
  onClose: () => void
}

export function InlineTextEditor({
  elementId,
  containerRef,
  zoom,
  panX,
  panY,
  containerWidth,
  containerHeight,
  onClose,
}: InlineTextEditorProps) {
  const { elements, updateElement, pushHistory, applyTextAutoSize } = useEditorStore()
  const editorRef = useRef<HTMLDivElement>(null)
  const hasPushedHistory = useRef(false)

  const element = findElementInList(elements, elementId)

  const getScreenPosition = useCallback(() => {
    if (!element) return { left: 0, top: 0, width: 100, height: 40 }
    const cx = containerWidth / 2 + panX
    const cy = containerHeight / 2 + panY
    return {
      left: cx + element.x * zoom,
      top: cy + element.y * zoom,
      width: element.width * zoom,
      height: element.height * zoom,
    }
  }, [element, zoom, panX, panY, containerWidth, containerHeight])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus()
      // Select all text
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [])

  const handleBlur = useCallback(() => {
    if (editorRef.current && element) {
      const newContent = editorRef.current.innerText || ''
      updateElement(elementId, { textContent: newContent })
      // PHASE 10: re-run auto-size (hug/grow) after editing
      applyTextAutoSize(elementId)
    }
    onClose()
  }, [elementId, updateElement, onClose, element, applyTextAutoSize])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (editorRef.current && element) {
        updateElement(elementId, { textContent: editorRef.current.innerText })
        applyTextAutoSize(elementId)
      }
      onClose()
    }
    e.stopPropagation()
  }, [elementId, updateElement, onClose, element, applyTextAutoSize])

  const handleInput = useCallback(() => {
    if (!hasPushedHistory.current) {
      pushHistory()
      hasPushedHistory.current = true
    }
    // Auto-resize while typing: DOM measurement for immediate feedback,
    // then the store's applyTextAutoSize reconciles exactly on commit.
    if (editorRef.current && element) {
      const mode = element.textAutoResize || 'fixed'
      if (mode === 'fixed') return
      if (mode === 'hug') {
        const range = document.createRange()
        range.selectNodeContents(editorRef.current)
        const rect = range.getBoundingClientRect()
        const contentWidth = rect.width / zoom
        const editorRect = editorRef.current.getBoundingClientRect()
        const contentHeight = editorRect.height / zoom
        const newWidth = Math.max(10, contentWidth + 2)
        const newHeight = Math.max(10, contentHeight + 2)
        if (Math.abs(newWidth - element.width) > 2 || Math.abs(newHeight - element.height) > 2) {
          updateElement(elementId, { width: Math.round(newWidth), height: Math.round(newHeight) })
        }
      } else {
        // grow: keep width, re-measure height
        const editorRect = editorRef.current.getBoundingClientRect()
        const contentHeight = editorRect.height / zoom
        if (Math.abs(contentHeight - element.height) > 2) {
          updateElement(elementId, { height: Math.round(contentHeight) })
        }
      }
    }
  }, [pushHistory, element, elementId, updateElement, zoom])

  if (!element) return null

  const pos = getScreenPosition()
  const fontSize = (element.fontSize || 18) * zoom
  const fontWeight = element.fontWeight || 400
  const fontFamily = element.fontFamily || 'Inter'
  const textAlign = element.textAlign || 'left'
  const textColor = element.textColor || '#000000'
  const lineHeight = element.lineHeight || 1.4
  const letterSpacing = (element.letterSpacing || 0) * zoom

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      className="absolute outline-none border-2 border-[#0D99FF] rounded-sm overflow-hidden whitespace-pre-wrap break-words"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
        minHeight: pos.height,
        fontSize,
        fontWeight,
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        textAlign: textAlign === 'justified' ? 'justify' : textAlign,
        color: textColor === '#000000' || textColor === 'black' ? '#ffffff' : textColor,
        lineHeight,
        letterSpacing,
        padding: '0px',
        zIndex: 50,
        cursor: 'text',
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
      }}
    >
      {element.textContent || ''}
    </div>
  )
}


