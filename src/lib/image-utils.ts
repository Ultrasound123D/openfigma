import { DesignElement } from '@/store/editor-store'

/**
 * Load an image file as base64 data URL.
 */
export function loadImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Get the natural dimensions of an image from its base64 data.
 */
export function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = base64
  })
}

/**
 * Create a DesignElement for an imported image.
 * The element will have an image fill using the base64 data.
 */
export async function createImageElement(
  base64: string,
  x: number = 0,
  y: number = 0
): Promise<DesignElement> {
  const dims = await getImageDimensions(base64)
  // Cap max dimension to 800px for reasonable canvas size
  const maxDim = 800
  let width = dims.width
  let height = dims.height
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  return {
    id: `image-${Date.now()}`,
    name: 'Image',
    type: 'rectangle',
    x,
    y,
    width,
    height,
    fill: '#FFFFFF',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    fills: [{
      type: 'image',
      color: '#FFFFFF',
      opacity: 100,
      imageUrl: base64,
      visible: true,
    }],
  }
}

/**
 * Check if a file is an image file.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Sample the color at a specific pixel on the canvas.
 * Uses a temporary canvas to read pixel data from the rendered SVG.
 */
export function sampleColorAtPixel(clientX: number, clientY: number): string | null {
  try {
    const el = document.elementFromPoint(clientX, clientY)
    if (el) {
      const style = window.getComputedStyle(el)
      const fill = style.fill || style.backgroundColor || style.color
      if (fill && fill !== 'none') return fill
    }
    return null
  } catch {
    return null
  }
}

/**
 * Simplify a path by reducing the number of points using the Douglas-Peucker algorithm.
 */
export function simplifyPath(
  points: { x: number; y: number }[],
  tolerance: number = 2
): { x: number; y: number }[] {
  if (points.length <= 2) return points

  // Find the point with the maximum distance
  let maxDist = 0
  let maxIndex = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [first, last]
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len
}
