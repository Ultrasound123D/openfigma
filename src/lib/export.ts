import { DesignElement } from '@/store/editor-store'

export async function exportAsPNG(
  elements: DesignElement[],
  scale: number = 2
): Promise<void> {
  const svgEl = document.querySelector('.canvas-svg-export') as SVGElement | null
  if (!svgEl) return

  try {
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(svgEl, {
      quality: 1,
      pixelRatio: scale,
      backgroundColor: '#FFFFFF',
    })
    downloadDataUrl(dataUrl, `design-${scale}x.png`)
  } catch (e) {
    console.error('PNG export failed:', e)
  }
}

export async function exportAsSVG(
  elements: DesignElement[]
): Promise<void> {
  const svgEl = document.querySelector('.canvas-svg-export') as SVGElement | null
  if (!svgEl) return

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svgEl)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'design.svg'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportAsPDF(): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf')
    const svgEl = document.querySelector('.canvas-svg-export') as SVGElement | null
    if (!svgEl) return

    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(svgEl, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#FFFFFF',
    })

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [svgEl.clientWidth, svgEl.clientHeight],
    })

    pdf.addImage(dataUrl, 'PNG', 0, 0, svgEl.clientWidth, svgEl.clientHeight)
    pdf.save('design.pdf')
  } catch (e) {
    console.error('PDF export failed:', e)
  }
}

export async function exportElementAsPNG(
  element: DesignElement,
  scale: number = 2
): Promise<void> {
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', String(element.width * scale))
  svg.setAttribute('height', String(element.height * scale))
  svg.setAttribute('viewBox', `0 0 ${element.width} ${element.height}`)
  svg.classList.add('canvas-svg-export')
  svg.style.position = 'absolute'
  svg.style.left = '-9999px'
  svg.style.top = '-9999px'

  renderElementToSVG(element, svg, svgNS)
  document.body.appendChild(svg)

  try {
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(svg, {
      quality: 1,
      pixelRatio: scale,
      backgroundColor: null,
    })
    downloadDataUrl(dataUrl, `${element.name}-${scale}x.png`)
  } catch (e) {
    console.error('Element PNG export failed:', e)
  } finally {
    document.body.removeChild(svg)
  }
}

function renderElementToSVG(el: DesignElement, svg: SVGSVGElement, svgNS: string) {
  const g = document.createElementNS(svgNS, 'g')
  g.setAttribute('transform', `translate(${el.x}, ${el.y})`)

  switch (el.type) {
    case 'rectangle':
    case 'frame': {
      const rect = document.createElementNS(svgNS, 'rect')
      rect.setAttribute('x', '0')
      rect.setAttribute('y', '0')
      rect.setAttribute('width', String(el.width))
      rect.setAttribute('height', String(el.height))
      rect.setAttribute('fill', el.fill === 'transparent' ? 'none' : el.fill)
      rect.setAttribute('rx', String(el.cornerRadius || 0))
      g.appendChild(rect)
      break
    }
    case 'ellipse': {
      const ellipse = document.createElementNS(svgNS, 'ellipse')
      ellipse.setAttribute('cx', String(el.width / 2))
      ellipse.setAttribute('cy', String(el.height / 2))
      ellipse.setAttribute('rx', String(el.width / 2))
      ellipse.setAttribute('ry', String(el.height / 2))
      ellipse.setAttribute('fill', el.fill === 'transparent' ? 'none' : el.fill)
      g.appendChild(ellipse)
      break
    }
    default: {
      const rect = document.createElementNS(svgNS, 'rect')
      rect.setAttribute('x', '0')
      rect.setAttribute('y', '0')
      rect.setAttribute('width', String(el.width))
      rect.setAttribute('height', String(el.height))
      rect.setAttribute('fill', el.fill === 'transparent' ? 'none' : el.fill)
      g.appendChild(rect)
    }
  }

  svg.appendChild(g)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
