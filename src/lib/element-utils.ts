/**
 * Shared element utility functions.
 * Single source of truth for tree-traversal helpers used across the editor.
 * Previously duplicated in: editor-store.ts, Canvas.tsx, CanvasContextMenu.tsx,
 * RightSidebar.tsx, InlineTextEditor.tsx, ComponentPanel.tsx, LayerPanel.tsx
 */

import { DesignElement, VectorNetwork, PathPoint, VectorSegment, VectorVertex, VectorTangent, HandleMirroring } from '@/store/editor-store'

/**
 * Recursively search for an element by id in a list (including children).
 */
export function findElementInList(elements: DesignElement[], id: string): DesignElement | null {
  for (const el of elements) {
    if (el.id === id) return el
    if (el.children) {
      const found = findElementInList(el.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * PHASE 12 — ancestor chain of an element: [immediateParent, ..., root].
 * Empty when the element is root-level or not found.
 */
export function findAncestors(elements: DesignElement[], id: string): DesignElement[] {
  for (const el of elements) {
    if (el.id === id) return []
    if (el.children && findElementInList(el.children, id)) {
      return [el, ...findAncestors(elements, el.id)]
    }
  }
  return []
}

/**
 * Flatten all elements (including children) to a flat list.
 */
export function getAllElements(elements: DesignElement[]): DesignElement[] {
  const result: DesignElement[] = []
  for (const el of elements) {
    result.push(el)
    if (el.children) {
      result.push(...getAllElements(el.children))
    }
  }
  return result
}

/**
 * Recursively update an element in the list by id, returning a new array.
 */
export function updateElementInList(
  elements: DesignElement[],
  id: string,
  updates: Partial<DesignElement>
): DesignElement[] {
  return elements.map((el) => {
    if (el.id === id) {
      return { ...el, ...updates }
    }
    if (el.children) {
      const childFound = findElementInList(el.children, id)
      if (childFound) {
        return {
          ...el,
          children: updateElementInList(el.children, id, updates),
        }
      }
    }
    return el
  })
}

/**
 * Recursively remove an element by id from the list, returning a new array.
 */
export function removeElementFromList(elements: DesignElement[], id: string): DesignElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) => {
      if (el.children) {
        return {
          ...el,
          children: removeElementFromList(el.children, id),
        }
      }
      return el
    })
}

/**
 * Deep-clone elements via JSON round-trip.
 */
export function deepCloneElements(elements: DesignElement[]): DesignElement[] {
  return JSON.parse(JSON.stringify(elements))
}

/* ============================================================================
 * VectorNetwork utilities (Figma source parity)
 * Source: 9456-*.min.js line 1712 (Zod schema) + line 1020 (eT.VectorNetwork)
 * ==========================================================================*/

/**
 * Compute absolute position of a tangent handle given a vertex and a relative tangent.
 * Source: 9456-*.min.js line 1712 — `control = anchor + tangent`
 */
export function tangentToAbsolute(vertex: VectorVertex, tangent: VectorTangent): VectorTangent {
  return { x: vertex.x + tangent.x, y: vertex.y + tangent.y }
}

/**
 * Convert an absolute handle position to a RELATIVE tangent offset from a vertex.
 * Source: 9456-*.min.js line 1712 — `tangent = control - anchor`
 */
export function absoluteToTangent(vertex: VectorVertex, absolute: VectorTangent): VectorTangent {
  return { x: absolute.x - vertex.x, y: absolute.y - vertex.y }
}

/**
 * Mirror a tangent across its vertex (the opposite handle has equal & opposite offset).
 * Used when handleMirroring = ANGLE or ANGLE_AND_LENGTH.
 * Source: 9456-*.min.js line 1020 PathBuilder.
 */
export function mirrorTangent(t: VectorTangent): VectorTangent {
  return { x: -t.x, y: -t.y }
}

/**
 * Convert legacy PathPoint[] (absolute tangents cx1/cy1/cx2/cy2) to VectorNetwork.
 * Maintains backward compat with old path data.
 * Source parity: 9456-*.min.js line 1712 (segment schema).
 */
export function pathPointsToVectorNetwork(points: PathPoint[], closed: boolean): VectorNetwork {
  if (points.length === 0) return { vertices: [], segments: [], closed }

  const vertices: VectorVertex[] = points.map((p) => ({ x: p.x, y: p.y }))

  const segments: VectorSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i]
    const next = points[i + 1]
    let tangentStart: VectorTangent | undefined
    let tangentEnd: VectorTangent | undefined

    // tangentStart = outgoing handle of start point (cx2/cy2)
    if (cur.cx2 !== undefined && cur.cy2 !== undefined) {
      tangentStart = { x: cur.cx2 - cur.x, y: cur.cy2 - cur.y }
    }
    // tangentEnd = incoming handle of end point (cx1/cy1)
    if (next.cx1 !== undefined && next.cy1 !== undefined) {
      tangentEnd = { x: next.cx1 - next.x, y: next.cy1 - next.y }
    }

    segments.push({
      start: i,
      end: i + 1,
      ...(tangentStart ? { tangentStart } : {}),
      ...(tangentEnd ? { tangentEnd } : {}),
    })
  }

  // If closed, add a final segment from last vertex back to vertex 0
  if (closed && points.length > 2) {
    const last = points[points.length - 1]
    const first = points[0]
    let tangentStart: VectorTangent | undefined
    let tangentEnd: VectorTangent | undefined
    // tangentStart = outgoing handle of last point (cx2/cy2)
    if (last.cx2 !== undefined && last.cy2 !== undefined) {
      tangentStart = { x: last.cx2 - last.x, y: last.cy2 - last.y }
    }
    // tangentEnd = incoming handle of first point (cx1/cy1)
    if (first.cx1 !== undefined && first.cy1 !== undefined) {
      tangentEnd = { x: first.cx1 - first.x, y: first.cy1 - first.y }
    }
    segments.push({
      start: points.length - 1,
      end: 0,
      ...(tangentStart ? { tangentStart } : {}),
      ...(tangentEnd ? { tangentEnd } : {}),
    })
  }

  return { vertices, segments, closed }
}

/**
 * Convert a VectorNetwork to legacy PathPoint[] (absolute tangents).
 * Inverse of pathPointsToVectorNetwork.
 */
export function vectorNetworkToPathPoints(network: VectorNetwork): { points: PathPoint[]; closed: boolean } {
  const { vertices, segments, closed } = network
  if (vertices.length === 0) return { points: [], closed: !!closed }

  const points: PathPoint[] = vertices.map((v) => ({ x: v.x, y: v.y }))

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const startIdx = seg.start
    const endIdx = seg.end
    const startV = vertices[startIdx]
    const endV = vertices[endIdx]
    if (!startV || !endV) continue

    if (seg.tangentStart) {
      const tsAbs = tangentToAbsolute(startV, seg.tangentStart)
      points[startIdx].cx1 = tsAbs.x
      points[startIdx].cy1 = tsAbs.y
    }

    if (seg.tangentEnd) {
      const teAbs = tangentToAbsolute(endV, seg.tangentEnd)
      points[endIdx].cx2 = teAbs.x
      points[endIdx].cy2 = teAbs.y
    }
  }

  return { points, closed: !!closed }
}

/**
 * Render a VectorNetwork as an SVG `d` path string.
 * Handles both line (L) and cubic bezier (C) segments.
 * Source parity: 9456-*.min.js line 1712 (segment schema).
 */
export function vectorNetworkToSvgPath(network: VectorNetwork): string {
  const { vertices, segments, closed } = network
  if (vertices.length === 0 || segments.length === 0) return ''

  let d = ''
  const firstSeg = segments[0]
  const firstV = vertices[firstSeg.start]
  d += `M ${firstV.x} ${firstV.y}`

  for (const seg of segments) {
    const startV = vertices[seg.start]
    const endV = vertices[seg.end]
    const hasTangents = seg.tangentStart || seg.tangentEnd
    const isLine = !hasTangents || (
      (!seg.tangentStart || (seg.tangentStart.x === 0 && seg.tangentStart.y === 0)) &&
      (!seg.tangentEnd || (seg.tangentEnd.x === 0 && seg.tangentEnd.y === 0))
    )
    if (isLine) {
      d += ` L ${endV.x} ${endV.y}`
    } else {
      const tsAbs = tangentToAbsolute(startV, seg.tangentStart || { x: 0, y: 0 })
      const teAbs = tangentToAbsolute(endV, seg.tangentEnd || { x: 0, y: 0 })
      d += ` C ${tsAbs.x} ${tsAbs.y}, ${teAbs.x} ${teAbs.y}, ${endV.x} ${endV.y}`
    }
  }

  if (closed) d += ' Z'
  return d
}

/**
 * Ensure a DesignElement has a usable VectorNetwork.
 * If the element has vectorNetwork, return it.
 * Otherwise, convert from legacy pathPoints and cache as vectorNetwork on the element.
 */
export function getVectorNetwork(el: DesignElement): VectorNetwork {
  if (el.vectorNetwork) return el.vectorNetwork
  if (el.pathPoints && el.pathPoints.length > 0) {
    return pathPointsToVectorNetwork(el.pathPoints, !!el.pathClosed)
  }
  return { vertices: [], segments: [], closed: false }
}

/**
 * Build the SVG `d` path string for a path-type element, preferring VectorNetwork.
 * Falls back to PathPoint[] rendering for backward compatibility.
 * PHASE 6: multi-contour boolean results (el.booleanContours) serialize as
 * concatenated subpaths (M…Z M…Z) — rendered with fillRule=evenodd by callers.
 */
export function pathElementToSvgPath(el: DesignElement): string {
  if (el.booleanContours && el.booleanContours.length > 0) {
    return el.booleanContours
      .map((net) => vectorNetworkToSvgPath(net))
      .filter(Boolean)
      .join(' ')
  }
  if (el.vectorNetwork) {
    return vectorNetworkToSvgPath(el.vectorNetwork)
  }
  if (el.pathPoints && el.pathPoints.length > 0) {
    let d = `M ${el.pathPoints[0].x} ${el.pathPoints[0].y}`
    for (let i = 1; i < el.pathPoints.length; i++) {
      const pt = el.pathPoints[i]
      if (pt.cx1 !== undefined && pt.cy1 !== undefined && pt.cx2 !== undefined && pt.cy2 !== undefined) {
        d += ` C ${pt.cx1} ${pt.cy1}, ${pt.cx2} ${pt.cy2}, ${pt.x} ${pt.y}`
      } else {
        d += ` L ${pt.x} ${pt.y}`
      }
    }
    if (el.pathClosed) d += ' Z'
    return d
  }
  return ''
}

/** PHASE 6: true when the element renders as multi-contour evenodd (boolean result). */
export function isEvenOddFill(el: DesignElement): boolean {
  return !!(el.booleanContours && el.booleanContours.length > 0)
}

/**
 * Build a new empty VectorNetwork with a single vertex.
 * Used when starting a new pen path.
 */
export function createEmptyVectorNetwork(): VectorNetwork {
  return { vertices: [], segments: [], closed: false }
}

/**
 * Add a vertex to a VectorNetwork and connect it to the previous vertex (if any)
 * via a straight (L) segment. Returns a new network.
 */
export function addVertexToNetwork(network: VectorNetwork, x: number, y: number): VectorNetwork {
  const newVertexIndex = network.vertices.length
  const newVertices = [...network.vertices, { x, y }]
  let newSegments = [...network.segments]
  if (newVertexIndex > 0) {
    newSegments.push({
      start: newVertexIndex - 1,
      end: newVertexIndex,
    })
  }
  return { ...network, vertices: newVertices, segments: newSegments }
}

/**
 * Update a vertex position. The element's bounding box is NOT recomputed here;
 * the caller should call computeNetworkBounds() to get the updated box.
 */
export function updateVertexInNetwork(network: VectorNetwork, index: number, x: number, y: number): VectorNetwork {
  const newVertices = network.vertices.map((v, i) => (i === index ? { x, y } : v))
  return { ...network, vertices: newVertices }
}

/**
 * Set the tangent at a vertex for the segment that ENDS at that vertex (tangentEnd)
 * OR the segment that STARTS at that vertex (tangentStart), depending on context.
 * handleMirroring is passed separately since Figma stores it on the node level.
 */
export function setTangentInNetwork(
  network: VectorNetwork,
  vertexIndex: number,
  side: 'start' | 'end',
  tangent: VectorTangent,
  handleMirroring: HandleMirroring = 'NONE'
): VectorNetwork {
  const newSegments = network.segments.map((seg) => {
    if (side === 'end' && seg.end === vertexIndex) {
      const newSeg = { ...seg, tangentEnd: tangent }
      if (handleMirroring !== 'NONE' && seg.tangentStart) {
        newSeg.tangentStart = mirrorTangent(tangent)
      }
      return newSeg
    }
    if (side === 'start' && seg.start === vertexIndex) {
      const newSeg = { ...seg, tangentStart: tangent }
      if (handleMirroring !== 'NONE' && seg.tangentEnd) {
        newSeg.tangentEnd = mirrorTangent(tangent)
      }
      return newSeg
    }
    return seg
  })
  return { ...network, segments: newSegments }
}

/**
 * Compute the bounding box of a VectorNetwork (vertices + tangent extents).
 */
export function computeNetworkBounds(network: VectorNetwork): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const v of network.vertices) {
    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }
  for (const seg of network.segments) {
    const startV = network.vertices[seg.start]
    const endV = network.vertices[seg.end]
    if (!startV || !endV) continue
    if (seg.tangentStart) {
      const tsAbs = tangentToAbsolute(startV, seg.tangentStart)
      if (tsAbs.x < minX) minX = tsAbs.x
      if (tsAbs.y < minY) minY = tsAbs.y
      if (tsAbs.x > maxX) maxX = tsAbs.x
      if (tsAbs.y > maxY) maxY = tsAbs.y
    }
    if (seg.tangentEnd) {
      const teAbs = tangentToAbsolute(endV, seg.tangentEnd)
      if (teAbs.x < minX) minX = teAbs.x
      if (teAbs.y < minY) minY = teAbs.y
      if (teAbs.x > maxX) maxX = teAbs.x
      if (teAbs.y > maxY) maxY = teAbs.y
    }
  }
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 0; maxY = 0
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Translate a VectorNetwork by (dx, dy). Returns a new network.
 */
export function translateNetwork(network: VectorNetwork, dx: number, dy: number): VectorNetwork {
  return {
    ...network,
    vertices: network.vertices.map((v) => ({ ...v, x: v.x + dx, y: v.y + dy })),
  }
}

/**
 * Simplify a point array using Douglas-Peucker algorithm.
 * Source parity: standard vector simplification used in Figma's pencil tool.
 */
export function simplifyPath(points: { x: number; y: number }[], tolerance: number = 2): { x: number; y: number }[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyPath(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [first, last]
}

function perpendicularDistance(point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const norm = Math.sqrt(dx * dx + dy * dy)
  if (norm === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
  return Math.abs(dx * (lineStart.y - point.y) - dy * (lineStart.x - point.x)) / norm
}

/**
 * Convert simplified polyline points to smooth PathPoints with Catmull-Rom bezier handles.
 * This produces cubic bezier control points that create smooth curves through the input points.
 * Source parity: Figma pencil tool uses Catmull-Rom spline for path smoothing.
 */
export function smoothPointsToPathPoints(
  points: { x: number; y: number }[],
  tension: number = 0.5
): PathPoint[] {
  if (points.length === 0) return []
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }]
  if (points.length === 2) return points.map(p => ({ x: p.x, y: p.y }))

  const result: PathPoint[] = []

  for (let i = 0; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[Math.min(points.length - 1, i + 1)]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    if (i === 0) {
      // First point: only outgoing tangent (cx2/cy2)
      const cp1x = p1.x + (p2.x - p0.x) * tension / 3
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3
      result.push({ x: p1.x, y: p1.y, cx2: cp1x, cy2: cp1y })
    } else if (i === points.length - 1) {
      // Last point: only incoming tangent (cx1/cy1)
      const cp1x = p1.x + (p2.x - p0.x) * tension / 3
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3
      result.push({ x: p1.x, y: p1.y, cx1: cp1x, cy1: cp1y })
    } else {
      // Middle points: both incoming and outgoing tangents
      const cp1x = p1.x + (p2.x - p0.x) * tension / 3
      const cp1y = p1.y + (p2.y - p0.y) * tension / 3
      const cp2x = p2.x - (p3.x - p1.x) * tension / 3
      const cp2y = p2.y - (p3.y - p1.y) * tension / 3
      result.push({ x: p1.x, y: p1.y, cx1: cp1x, cy1: cp1y, cx2: cp2x, cy2: cp2y })
    }
  }

  return result
}
