'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useEditorStore, DesignElement } from '@/store/editor-store'

interface CanvasElementProps {
  element: DesignElement
}

export function CanvasElement({ element }: CanvasElementProps) {
  const { selectedElementIds, setSelectedElementIds, zoom } = useEditorStore()
  const isSelected = selectedElementIds.includes(element.id)
  const [isHovered, setIsHovered] = useState(false)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const elementStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (element.locked) return

      // Select the element
      if (e.shiftKey) {
        useEditorStore.getState().toggleElementSelection(element.id)
      } else if (!isSelected) {
        setSelectedElementIds([element.id])
      }

      isDragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY }
      elementStart.current = { x: element.x, y: element.y }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const dx = (moveEvent.clientX - dragStart.current.x) / zoom
        const dy = (moveEvent.clientY - dragStart.current.y) / zoom
        const newX = elementStart.current.x + dx
        const newY = elementStart.current.y + dy
        useEditorStore.getState().updateElement(element.id, {
          x: Math.round(newX),
          y: Math.round(newY),
        })
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [element.id, element.x, element.y, element.locked, isSelected, setSelectedElementIds, zoom]
  )

  // Child element mouse down handler
  const handleChildMouseDown = useCallback(
    (child: DesignElement, e: React.MouseEvent) => {
      e.stopPropagation()
      if (child.locked) return

      if (e.shiftKey) {
        useEditorStore.getState().toggleElementSelection(child.id)
      } else if (!selectedElementIds.includes(child.id)) {
        setSelectedElementIds([child.id])
      }

      isDragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY }
      elementStart.current = { x: child.x, y: child.y }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const dx = (moveEvent.clientX - dragStart.current.x) / zoom
        const dy = (moveEvent.clientY - dragStart.current.y) / zoom
        const newX = elementStart.current.x + dx
        const newY = elementStart.current.y + dy
        useEditorStore.getState().updateElement(child.id, {
          x: Math.round(newX),
          y: Math.round(newY),
        })
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [selectedElementIds, setSelectedElementIds, zoom]
  )

  if (!element.visible) return null

  const isFrame = element.type === 'frame'
  const isGroup = element.type === 'group'
  const showLabel = isFrame || isGroup

  // Font size for labels (scales inversely with zoom to maintain readability)
  const labelFontSize = Math.max(10, 11 / zoom)

  return (
    <g
      transform={`translate(${element.x}, ${element.y})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Frame/Group name label */}
      {showLabel && (isSelected || isHovered) && (
        <text
          x={0}
          y={-6 / zoom}
          fontSize={labelFontSize}
          fill={isSelected ? '#0D99FF' : '#888'}
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {element.name}
        </text>
      )}

      {/* Render children for groups/frames */}
      {(isGroup || isFrame) && element.children
        ? (
            <>
              {/* Clip path for children using the frame child's bounds */}
              {element.children.find((c) => c.type === 'frame') && (
                <defs>
                  <clipPath id={`clip-${element.id}`}>
                    <rect
                      x={element.children.find((c) => c.type === 'frame')!.x - element.x}
                      y={element.children.find((c) => c.type === 'frame')!.y - element.y}
                      width={element.children.find((c) => c.type === 'frame')!.width}
                      height={element.children.find((c) => c.type === 'frame')!.height}
                      rx={element.children.find((c) => c.type === 'frame')!.cornerRadius}
                      ry={element.children.find((c) => c.type === 'frame')!.cornerRadius}
                    />
                  </clipPath>
                </defs>
              )}
              <g clipPath={element.children.find((c) => c.type === 'frame') ? `url(#clip-${element.id})` : undefined}>
                {element.children.map((child) => {
                  if (!child.visible) return null
                  const childIsSelected = selectedElementIds.includes(child.id)
                  const relativeX = child.x - element.x
                  const relativeY = child.y - element.y

                  return (
                    <g
                      key={child.id}
                      transform={`translate(${relativeX}, ${relativeY})`}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={child.width}
                        height={child.height}
                        fill={child.fill === 'transparent' ? 'none' : child.fill}
                        stroke={child.stroke === 'transparent' ? 'none' : child.stroke}
                        strokeWidth={child.strokeWidth}
                        rx={child.cornerRadius}
                        ry={child.cornerRadius}
                        opacity={child.opacity / 100}
                        onMouseDown={(e) => handleChildMouseDown(child, e)}
                        style={{ cursor: child.locked ? 'default' : 'move' }}
                      />
                      {/* Hit area */}
                      <rect
                        x={0}
                        y={0}
                        width={child.width}
                        height={child.height}
                        fill="transparent"
                        stroke="none"
                        onMouseDown={(e) => handleChildMouseDown(child, e)}
                        style={{ cursor: child.locked ? 'default' : 'move' }}
                      />
                      {/* Child frame label */}
                      {(child.type === 'frame' || child.type === 'group') && (childIsSelected) && (
                        <text
                          x={0}
                          y={-6 / zoom}
                          fontSize={labelFontSize}
                          fill="#0D99FF"
                          fontFamily="system-ui, sans-serif"
                          style={{ pointerEvents: 'none' }}
                        >
                          {child.name}
                        </text>
                      )}
                      {/* Child selection outline */}
                      {childIsSelected && (
                        <rect
                          x={-1}
                          y={-1}
                          width={child.width + 2}
                          height={child.height + 2}
                          fill="none"
                          stroke="#0D99FF"
                          strokeWidth={2 / zoom}
                          rx={child.cornerRadius + 1}
                          ry={child.cornerRadius + 1}
                          pointerEvents="none"
                        />
                      )}
                      {/* Resize handles for child */}
                      {childIsSelected && (
                        <>
                          {[
                            [0, 0],
                            [child.width, 0],
                            [0, child.height],
                            [child.width, child.height],
                            [child.width / 2, 0],
                            [child.width / 2, child.height],
                            [0, child.height / 2],
                            [child.width, child.height / 2],
                          ].map(([hx, hy], i) => (
                            <rect
                              key={i}
                              x={hx - 4 / zoom}
                              y={hy - 4 / zoom}
                              width={8 / zoom}
                              height={8 / zoom}
                              fill="white"
                              stroke="#0D99FF"
                              strokeWidth={1.5 / zoom}
                              rx={1}
                              pointerEvents="none"
                            />
                          ))}
                        </>
                      )}
                    </g>
                  )
                })}
              </g>
            </>
          )
        : null}

      {/* Main element shape (non-group) */}
      {!isGroup && !isFrame && (
        <>
          <rect
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            fill={element.fill === 'transparent' ? 'none' : element.fill}
            stroke={element.stroke === 'transparent' ? 'none' : element.stroke}
            strokeWidth={element.strokeWidth}
            rx={element.cornerRadius}
            ry={element.cornerRadius}
            opacity={element.opacity / 100}
            onMouseDown={handleMouseDown}
            style={{ cursor: element.locked ? 'default' : 'move' }}
          />
          {/* Invisible hit area */}
          <rect
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            fill="transparent"
            stroke="none"
            onMouseDown={handleMouseDown}
            style={{ cursor: element.locked ? 'default' : 'move' }}
          />
          {/* Hover outline for non-selected elements */}
          {isHovered && !isSelected && (
            <rect
              x={-0.5}
              y={-0.5}
              width={element.width + 1}
              height={element.height + 1}
              fill="none"
              stroke="#0D99FF"
              strokeWidth={1 / zoom}
              rx={element.cornerRadius}
              ry={element.cornerRadius}
              pointerEvents="none"
              opacity={0.5}
            />
          )}
        </>
      )}

      {/* Group/Frame hit area */}
      {(isGroup || isFrame) && (
        <>
          <rect
            x={0}
            y={0}
            width={element.width}
            height={element.height}
            fill="transparent"
            stroke="none"
            onMouseDown={handleMouseDown}
            style={{ cursor: element.locked ? 'default' : 'move' }}
          />
          {/* Hover outline for groups/frames */}
          {isHovered && !isSelected && (
            <rect
              x={-0.5}
              y={-0.5}
              width={element.width + 1}
              height={element.height + 1}
              fill="none"
              stroke="#0D99FF"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom}`}
              rx={element.cornerRadius}
              ry={element.cornerRadius}
              pointerEvents="none"
              opacity={0.5}
            />
          )}
        </>
      )}

      {/* Selection outline for top-level */}
      {isSelected && (
        <rect
          x={-1}
          y={-1}
          width={element.width + 2}
          height={element.height + 2}
          fill="none"
          stroke="#0D99FF"
          strokeWidth={2 / zoom}
          rx={(isFrame || isGroup) ? element.cornerRadius + 1 : element.cornerRadius}
          ry={(isFrame || isGroup) ? element.cornerRadius + 1 : element.cornerRadius}
          pointerEvents="none"
        />
      )}

      {/* Resize handles for top-level */}
      {isSelected && (
        <>
          {[
            [0, 0],
            [element.width, 0],
            [0, element.height],
            [element.width, element.height],
            [element.width / 2, 0],
            [element.width / 2, element.height],
            [0, element.height / 2],
            [element.width, element.height / 2],
          ].map(([hx, hy], i) => (
            <rect
              key={i}
              x={hx - 4 / zoom}
              y={hy - 4 / zoom}
              width={8 / zoom}
              height={8 / zoom}
              fill="white"
              stroke="#0D99FF"
              strokeWidth={1.5 / zoom}
              rx={1}
              pointerEvents="none"
            />
          ))}
        </>
      )}

      {/* Dimension label when selected */}
      {isSelected && (isFrame || isGroup) && (
        <text
          x={element.width / 2}
          y={element.height + 16 / zoom}
          fontSize={Math.max(9, 10 / zoom)}
          fill="#888"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(element.width)} × {Math.round(element.height)}
        </text>
      )}
    </g>
  )
}
