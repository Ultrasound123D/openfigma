/**
 * PHASE 4 — Image import (GAP G5 closure — ARCHITECTURE.md "PHASE 4",
 * DECISION-004). Zero new packages: FileReader + Image are standard.
 *
 * Places an imported image as a rectangle element with an image fill
 * (FillStyle.type='image'), sized to the image's natural dimensions
 * (clamped to the viewport so huge photos don't explode the canvas),
 * positioned at the center of the current view.
 */

import type { DesignElement } from '@/store/editor-store'

/** Read a File as a data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

/** Load an image data URL and return its natural size. */
function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 100, height: img.naturalHeight || 100 })
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = dataUrl
  })
}

export const IMAGE_IMPORT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Build the element for an imported image. `viewCenter` is the canvas
 * coordinate where the image should be centered (viewport center).
 */
export async function importImageFile(
  file: File,
  viewCenter: { x: number; y: number },
  makeId: () => string
): Promise<DesignElement> {
  const dataUrl = await readFileAsDataUrl(file)
  const natural = await measureImage(dataUrl)

  // Clamp giant images to a sane on-canvas size (keep aspect ratio).
  const MAX_EDGE = 640
  const ratio = Math.min(1, MAX_EDGE / Math.max(natural.width, natural.height))
  const width = Math.max(1, Math.round(natural.width * ratio))
  const height = Math.max(1, Math.round(natural.height * ratio))

  // Animated GIFs keep animation via <image href>; static formats all fine.
  return {
    id: makeId(),
    name: file.name.replace(/\.[^.]+$/, '') || 'Image',
    type: 'rectangle',
    x: Math.round(viewCenter.x - width / 2),
    y: Math.round(viewCenter.y - height / 2),
    width,
    height,
    fill: 'transparent',
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
    fills: [
      {
        type: 'image',
        color: 'transparent',
        opacity: 100,
        imageUrl: dataUrl,
        visible: true,
      },
    ],
  }
}
