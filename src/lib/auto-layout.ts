import { DesignElement, AutoLayout } from '@/store/editor-store'

/**
 * Calculate auto layout positions for frame children.
 * Implements a flexbox-like layout engine similar to Figma's auto layout.
 * Returns new children with updated x, y, width, height positions.
 */
export function calculateAutoLayout(frame: DesignElement): DesignElement[] {
  const layout = frame.autoLayout
  if (!layout || !frame.children || frame.children.length === 0) return frame.children || []

  const children = frame.children.filter(c => c.visible)
  if (children.length === 0) return frame.children

  const {
    direction = 'vertical',
    gap = 10,
    paddingTop = 10,
    paddingBottom = 10,
    paddingLeft = 10,
    paddingRight = 10,
    alignItems = 'start',
    justifyContent = 'start',
  } = layout

  const isHorizontal = direction === 'horizontal'
  const innerWidth = frame.width - paddingLeft - paddingRight
  const innerHeight = frame.height - paddingTop - paddingBottom

  // Calculate sizes: stretch children in cross-axis if alignItems=stretch
  const sizedChildren = children.map(child => {
    const newChild = { ...child }
    if (alignItems === 'stretch') {
      if (isHorizontal) {
        newChild.width = innerWidth
      } else {
        newChild.height = innerHeight
      }
    }
    return newChild
  })

  // Calculate total size of children along main axis
  const totalMainSize = sizedChildren.reduce((sum, child) => {
    return sum + (isHorizontal ? child.width : child.height)
  }, 0)

  const totalGaps = gap * Math.max(0, sizedChildren.length - 1)
  const totalContentSize = totalMainSize + totalGaps

  // Calculate available space along main axis
  const availableMain = (isHorizontal ? innerWidth : innerHeight) - totalContentSize

  // Calculate gaps based on justifyContent
  let gaps: number[]
  let offsets: number[]

  if (justifyContent === 'space-between' && sizedChildren.length > 1) {
    const spaceGap = sizedChildren.length > 1 ? availableMain / (sizedChildren.length - 1) : 0
    gaps = Array(sizedChildren.length - 1).fill(spaceGap)
    offsets = [0]
    for (let i = 1; i < sizedChildren.length; i++) {
      offsets.push(offsets[i - 1] + (isHorizontal ? sizedChildren[i - 1].width : sizedChildren[i - 1].height) + gaps[i - 1])
    }
  } else if (justifyContent === 'center') {
    const startOffset = availableMain / 2
    gaps = Array(sizedChildren.length - 1).fill(gap)
    offsets = [startOffset]
    for (let i = 1; i < sizedChildren.length; i++) {
      offsets.push(offsets[i - 1] + (isHorizontal ? sizedChildren[i - 1].width : sizedChildren[i - 1].height) + gap)
    }
  } else if (justifyContent === 'end') {
    const startOffset = availableMain
    gaps = Array(sizedChildren.length - 1).fill(gap)
    offsets = [startOffset]
    for (let i = 1; i < sizedChildren.length; i++) {
      offsets.push(offsets[i - 1] + (isHorizontal ? sizedChildren[i - 1].width : sizedChildren[i - 1].height) + gap)
    }
  } else {
    // start (default)
    gaps = Array(sizedChildren.length - 1).fill(gap)
    offsets = [0]
    for (let i = 1; i < sizedChildren.length; i++) {
      offsets.push(offsets[i - 1] + (isHorizontal ? sizedChildren[i - 1].width : sizedChildren[i - 1].height) + gap)
    }
  }

  // Position children (relative to frame's origin, since parent <g> already translates to frame.x, frame.y)
  const positionedChildren = sizedChildren.map((child, i) => {
    let x: number, y: number

    if (isHorizontal) {
      x = paddingLeft + offsets[i]
      // Cross axis alignment (vertical)
      switch (alignItems) {
        case 'center':
          y = paddingTop + (innerHeight - child.height) / 2
          break
        case 'end':
          y = paddingTop + innerHeight - child.height
          break
        case 'stretch':
          y = paddingTop
          break
        default: // start
          y = paddingTop
      }
    } else {
      y = paddingTop + offsets[i]
      // Cross axis alignment (horizontal)
      switch (alignItems) {
        case 'center':
          x = paddingLeft + (innerWidth - child.width) / 2
          break
        case 'end':
          x = paddingLeft + innerWidth - child.width
          break
        case 'stretch':
          x = paddingLeft
          break
        default: // start
          x = paddingLeft
      }
    }

    return { ...child, x: Math.round(x), y: Math.round(y) }
  })

  // Merge with invisible children (keep their original positions)
  const result = frame.children.map(child => {
    if (!child.visible) return child
    const positioned = positionedChildren.find(p => p.id === child.id)
    return positioned || child
  })

  return result
}

/**
 * Check if a frame has auto layout enabled.
 */
export function hasAutoLayout(frame: DesignElement): boolean {
  return !!(frame.type === 'frame' && frame.autoLayout)
}

/**
 * Calculate the minimum frame size needed to fit all children with auto layout.
 */
export function calculateAutoLayoutSize(frame: DesignElement): { width: number; height: number } {
  const layout = frame.autoLayout
  if (!layout || !frame.children || frame.children.length === 0) {
    return { width: frame.width, height: frame.height }
  }

  const {
    direction = 'vertical',
    gap = 10,
    paddingTop = 10,
    paddingBottom = 10,
    paddingLeft = 10,
    paddingRight = 10,
  } = layout

  const children = frame.children.filter(c => c.visible)
  const isHorizontal = direction === 'horizontal'

  const totalMainSize = children.reduce((sum, child) => {
    return sum + (isHorizontal ? child.width : child.height)
  }, 0)
  const totalGaps = gap * Math.max(0, children.length - 1)
  const maxCrossSize = children.reduce((max, child) => {
    return Math.max(max, isHorizontal ? child.height : child.width)
  }, 0)

  if (isHorizontal) {
    return {
      width: paddingLeft + totalMainSize + totalGaps + paddingRight,
      height: paddingTop + maxCrossSize + paddingBottom,
    }
  } else {
    return {
      width: paddingLeft + maxCrossSize + paddingRight,
      height: paddingTop + totalMainSize + totalGaps + paddingBottom,
    }
  }
}
