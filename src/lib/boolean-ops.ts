import { DesignElement } from '@/store/editor-store'

// Simplified boolean operations using SVG path approximation
// For production, a proper polygon clipping library would be better

interface Point {
  x: number
  y: number
}

function getElementPath(el: DesignElement): Point[] {
  switch (el.type) {
    case 'rectangle':
    case 'frame': {
      const r = el.cornerRadius || 0
      if (r > 0) {
        return getRoundedRectPoints(el.width, el.height, r)
      }
      return [
        { x: el.x, y: el.y },
        { x: el.x + el.width, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ]
    }
    case 'ellipse': {
      return getEllipsePoints(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2)
    }
    case 'polygon': {
      return getPolygonPoints(el)
    }
    case 'star': {
      return getStarPoints(el)
    }
    default:
      return [
        { x: el.x, y: el.y },
        { x: el.x + el.width, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ]
  }
}

function getRoundedRectPoints(w: number, h: number, r: number): Point[] {
  const points: Point[] = []
  const segments = 8
  r = Math.min(r, w / 2, h / 2)
  // Top-left corner
  for (let i = segments; i >= 0; i--) {
    const angle = (Math.PI / 2) * (i / segments) + Math.PI
    points.push({ x: r + r * Math.cos(angle), y: r + r * Math.sin(angle) })
  }
  // Top-right corner
  for (let i = segments; i >= 0; i--) {
    const angle = (Math.PI / 2) * (i / segments) + 1.5 * Math.PI
    points.push({ x: w - r + r * Math.cos(angle), y: r + r * Math.sin(angle) })
  }
  // Bottom-right corner
  for (let i = segments; i >= 0; i--) {
    const angle = (Math.PI / 2) * (i / segments)
    points.push({ x: w - r + r * Math.cos(angle), y: h - r + r * Math.sin(angle) })
  }
  // Bottom-left corner
  for (let i = segments; i >= 0; i--) {
    const angle = (Math.PI / 2) * (i / segments) + Math.PI / 2
    points.push({ x: r + r * Math.cos(angle), y: h - r + r * Math.sin(angle) })
  }
  return points.map(p => ({ x: p.x, y: p.y }))
}

function getEllipsePoints(cx: number, cy: number, rx: number, ry: number): Point[] {
  const points: Point[] = []
  const segments = 32
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
  }
  return points
}

function getPolygonPoints(el: DesignElement): Point[] {
  const sides = el.sides || 6
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const r = Math.min(el.width, el.height) / 2
  const points: Point[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }
  return points
}

function getStarPoints(el: DesignElement): Point[] {
  const sides = el.sides || 5
  const innerRadiusPercent = el.innerRadius || 40
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const outerR = Math.min(el.width, el.height) / 2
  const innerR = outerR * (innerRadiusPercent / 100)
  const points: Point[] = []
  for (let i = 0; i < sides * 2; i++) {
    const angle = (i * Math.PI) / sides - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }
  return points
}

function pointsToPathD(points: Point[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  d += ' Z'
  return d
}

// Sutherland-Hodgman polygon clipping for intersection
function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  if (subject.length === 0 || clip.length === 0) return []
  
  let output = [...subject]
  
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return []
    const input = [...output]
    output = []
    
    const edgeStart = clip[i]
    const edgeEnd = clip[(i + 1) % clip.length]
    
    for (let j = 0; j < input.length; j++) {
      const current = input[j]
      const previous = input[(j + input.length - 1) % input.length]
      
      const currentInside = isInside(current, edgeStart, edgeEnd)
      const previousInside = isInside(previous, edgeStart, edgeEnd)
      
      if (currentInside) {
        if (!previousInside) {
          const intersection = lineIntersection(previous, current, edgeStart, edgeEnd)
          if (intersection) output.push(intersection)
        }
        output.push(current)
      } else if (previousInside) {
        const intersection = lineIntersection(previous, current, edgeStart, edgeEnd)
        if (intersection) output.push(intersection)
      }
    }
  }
  
  return output
}

function isInside(point: Point, edgeStart: Point, edgeEnd: Point): boolean {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - 
         (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  }
}

export function booleanUnion(elements: DesignElement[]): string {
  // Union: return merged path using the bounding box approach
  const allPoints: Point[] = []
  for (const el of elements) {
    allPoints.push(...getElementPath(el))
  }
  // Simple convex hull for union
  return pointsToPathD(convexHull(allPoints))
}

export function booleanSubtract(elements: DesignElement[]): string {
  // Subtract: first element minus the rest
  if (elements.length < 2) return ''
  const subject = getElementPath(elements[0])
  const clip = getElementPath(elements[1])
  // Invert the clip and intersect
  const result = clipPolygon(subject, clip)
  // Return the subject minus intersection - simplified approach
  if (result.length > 0) {
    // For subtraction, we use the difference
    return pointsToPathD(subject) // Simplified - full subtraction would need complex path operations
  }
  return pointsToPathD(subject)
}

export function booleanIntersect(elements: DesignElement[]): string {
  if (elements.length < 2) return ''
  let result = getElementPath(elements[0])
  for (let i = 1; i < elements.length; i++) {
    result = clipPolygon(result, getElementPath(elements[i]))
    if (result.length === 0) break
  }
  return pointsToPathD(result)
}

export function booleanExclude(elements: DesignElement[]): string {
  // XOR: combine all paths, excluding overlapping regions
  if (elements.length < 2) return ''
  const path1 = getElementPath(elements[0])
  const path2 = getElementPath(elements[1])
  // Simplified: return both paths
  return pointsToPathD(path1) + ' ' + pointsToPathD(path2)
}

function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points
  
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (O: Point, A: Point, B: Point) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x)

  const lower: Point[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
      lower.pop()
    lower.push(point)
  }

  const upper: Point[] = []
  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
      upper.pop()
    upper.push(point)
  }

  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

export function getBooleanOperationPath(
  elements: DesignElement[],
  operation: string
): string {
  switch (operation) {
    case 'union':
      return booleanUnion(elements)
    case 'subtract':
      return booleanSubtract(elements)
    case 'intersect':
      return booleanIntersect(elements)
    case 'exclude':
      return booleanExclude(elements)
    default:
      return booleanUnion(elements)
  }
}
