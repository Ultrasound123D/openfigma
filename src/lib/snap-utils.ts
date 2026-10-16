import { DesignElement } from '@/store/editor-store'

export interface SnapLine {
  orientation: 'horizontal' | 'vertical'
  position: number
  start: number
  end: number
}

const SNAP_THRESHOLD = 6

function getAllEdgePoints(el: DesignElement) {
  return {
    left: el.x,
    right: el.x + el.width,
    top: el.y,
    bottom: el.y + el.height,
    centerX: el.x + el.width / 2,
    centerY: el.y + el.height / 2,
  }
}

export function calculateSnapLines(
  draggedElement: DesignElement,
  allElements: DesignElement[],
  selectedIds: string[],
  gridSize: number,
  snapToGrid: boolean,
  snapToElements: boolean
): { snapLines: SnapLine[]; snapX: number | null; snapY: number | null } {
  const snapLines: SnapLine[] = []
  let snapX: number | null = null
  let snapY: number | null = null
  let bestDistX = SNAP_THRESHOLD
  let bestDistY = SNAP_THRESHOLD

  const drag = getAllEdgePoints(draggedElement)

  // Snap to grid
  if (snapToGrid && gridSize > 0) {
    const gridSnapX = Math.round(drag.left / gridSize) * gridSize
    const gridSnapY = Math.round(drag.top / gridSize) * gridSize
    const distX = Math.abs(drag.left - gridSnapX)
    const distY = Math.abs(drag.top - gridSnapY)
    if (distX < bestDistX) {
      bestDistX = distX
      snapX = gridSnapX - drag.left + draggedElement.x
      snapLines.push({
        orientation: 'vertical',
        position: gridSnapX,
        start: drag.top - 50,
        end: drag.bottom + 50,
      })
    }
    if (distY < bestDistY) {
      bestDistY = distY
      snapY = gridSnapY - drag.top + draggedElement.y
      snapLines.push({
        orientation: 'horizontal',
        position: gridSnapY,
        start: drag.left - 50,
        end: drag.right + 50,
      })
    }
  }

  // Snap to other elements
  if (snapToElements) {
    const otherElements = allElements.filter(
      (el) => !selectedIds.includes(el.id) && el.visible && !el.locked
    )

    for (const other of otherElements) {
      const otherPts = getAllEdgePoints(other)

      // Check vertical alignments (x axis)
      const xChecks: { dragVal: number; otherVal: number }[] = [
        { dragVal: drag.left, otherVal: otherPts.left },
        { dragVal: drag.left, otherVal: otherPts.right },
        { dragVal: drag.right, otherVal: otherPts.left },
        { dragVal: drag.right, otherVal: otherPts.right },
        { dragVal: drag.centerX, otherVal: otherPts.centerX },
      ]

      for (const check of xChecks) {
        const dist = Math.abs(check.dragVal - check.otherVal)
        if (dist < bestDistX) {
          bestDistX = dist
          const dx = check.otherVal - check.dragVal
          snapX = draggedElement.x + dx
          snapLines.push({
            orientation: 'vertical',
            position: check.otherVal,
            start: Math.min(drag.top, otherPts.top) - 20,
            end: Math.max(drag.bottom, otherPts.bottom) + 20,
          })
        }
      }

      // Check horizontal alignments (y axis)
      const yChecks: { dragVal: number; otherVal: number }[] = [
        { dragVal: drag.top, otherVal: otherPts.top },
        { dragVal: drag.top, otherVal: otherPts.bottom },
        { dragVal: drag.bottom, otherVal: otherPts.top },
        { dragVal: drag.bottom, otherVal: otherPts.bottom },
        { dragVal: drag.centerY, otherVal: otherPts.centerY },
      ]

      for (const check of yChecks) {
        const dist = Math.abs(check.dragVal - check.otherVal)
        if (dist < bestDistY) {
          bestDistY = dist
          const dy = check.otherVal - check.dragVal
          snapY = draggedElement.y + dy
          snapLines.push({
            orientation: 'horizontal',
            position: check.otherVal,
            start: Math.min(drag.left, otherPts.left) - 20,
            end: Math.max(drag.right, otherPts.right) + 20,
          })
        }
      }
    }
  }

  // Deduplicate snap lines
  const uniqueLines: SnapLine[] = []
  const seen = new Set<string>()
  for (const line of snapLines) {
    const key = `${line.orientation}-${Math.round(line.position)}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueLines.push(line)
    }
  }

  return {
    snapLines: uniqueLines,
    snapX: snapX !== null ? Math.round(snapX) : null,
    snapY: snapY !== null ? Math.round(snapY) : null,
  }
}

export function snapToGridPoint(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

export function constrainToAngle(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  angleSnap: number = 15
): { x: number; y: number } {
  const dx = currentX - startX
  const dy = currentY - startY
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const snapAngle = Math.round(angle / angleSnap) * angleSnap
  const length = Math.sqrt(dx * dx + dy * dy)
  const rad = (snapAngle * Math.PI) / 180
  return {
    x: startX + length * Math.cos(rad),
    y: startY + length * Math.sin(rad),
  }
}
