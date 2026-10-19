import { NextRequest, NextResponse } from 'next/server'
import {
  getProject, saveProject, findElementInList, updateElementInList,
  removeElementFromList, generateId, flattenElements
} from '@/lib/server-state'
import { publishProjectEvent, getRequestOrigin } from '@/lib/events/bus'

// POST /api/editor/projects/[id]/tools
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { action, ...toolParams } = body
  const page = project.pages.find(p => p.id === project.activePageId) || project.pages[0]

  switch (action) {
    case 'move': {
      const { id, dx, dy } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      page.elements = updateElementInList(page.elements, id, {
        x: el.x + (dx || 0),
        y: el.y + (dy || 0),
      })
      break
    }
    case 'moveTo': {
      const { id, x, y } = toolParams
      page.elements = updateElementInList(page.elements, id, { x, y })
      break
    }
    case 'resize': {
      const { id, width, height } = toolParams
      page.elements = updateElementInList(page.elements, id, { width, height })
      break
    }
    case 'rotate': {
      const { id, rotation } = toolParams
      page.elements = updateElementInList(page.elements, id, { rotation })
      break
    }
    case 'duplicate': {
      const { id } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      const newEl = {
        ...JSON.parse(JSON.stringify(el)),
        id: generateId(el.type),
        name: `${el.name} copy`,
        x: el.x + 20,
        y: el.y + 20,
      }
      page.elements = [...page.elements, newEl]
      break
    }
    case 'group': {
      const { ids } = toolParams
      if (!ids || ids.length < 2) return NextResponse.json({ error: 'At least 2 ids required' }, { status: 400 })
      const elementsToGroup = ids.map((id: string) => findElementInList(page.elements, id)).filter(Boolean)
      if (elementsToGroup.length < 2) return NextResponse.json({ error: 'Elements not found' }, { status: 400 })
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      elementsToGroup.forEach((el: any) => {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width)
        maxY = Math.max(maxY, el.y + el.height)
      })
      const relativeChildren = elementsToGroup.map((el: any) => ({ ...el, x: el.x - minX, y: el.y - minY }))
      const group: any = {
        id: generateId('group'), name: 'Group', type: 'group',
        x: minX, y: minY, width: maxX - minX, height: maxY - minY,
        fill: 'transparent', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid',
        cornerRadius: 0, cornerRadiusTL: 0, cornerRadiusTR: 0, cornerRadiusBL: 0, cornerRadiusBR: 0,
        opacity: 100, rotation: 0, visible: true, locked: false, children: relativeChildren,
      }
      let remaining = page.elements
      for (const id of ids) { remaining = removeElementFromList(remaining, id) }
      page.elements = [...remaining, group]
      break
    }
    case 'ungroup': {
      const { id } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el || el.type !== 'group' || !el.children) return NextResponse.json({ error: 'Not a group' }, { status: 400 })
      const absoluteChildren = el.children.map(c => ({ ...c, x: c.x + el.x, y: c.y + el.y }))
      page.elements = removeElementFromList(page.elements, id)
      page.elements = [...page.elements, ...absoluteChildren]
      break
    }
    case 'bringForward': {
      const { id } = toolParams
      const idx = page.elements.findIndex(el => el.id === id)
      if (idx < 0 || idx >= page.elements.length - 1) break
      const newElements = [...page.elements]
      ;[newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]]
      page.elements = newElements
      break
    }
    case 'sendBackward': {
      const { id } = toolParams
      const idx = page.elements.findIndex(el => el.id === id)
      if (idx <= 0) break
      const newElements = [...page.elements]
      ;[newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]]
      page.elements = newElements
      break
    }
    case 'bringToFront': {
      const { id } = toolParams
      const idx = page.elements.findIndex(el => el.id === id)
      if (idx < 0) break
      const newElements = [...page.elements]
      const [el] = newElements.splice(idx, 1)
      newElements.push(el)
      page.elements = newElements
      break
    }
    case 'sendToBack': {
      const { id } = toolParams
      const idx = page.elements.findIndex(el => el.id === id)
      if (idx <= 0) break
      const newElements = [...page.elements]
      const [el] = newElements.splice(idx, 1)
      newElements.unshift(el)
      page.elements = newElements
      break
    }
    case 'align': {
      const { ids, alignment } = toolParams
      const elements = ids.map((id: string) => findElementInList(page.elements, id)).filter(Boolean) as any[]
      if (elements.length < 2) break
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      elements.forEach((el: any) => {
        minX = Math.min(minX, el.x); minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height)
      })
      const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2
      for (const el of elements) {
        let updates: any = {}
        switch (alignment) {
          case 'left': updates = { x: minX }; break
          case 'center-h': updates = { x: centerX - el.width / 2 }; break
          case 'right': updates = { x: maxX - el.width }; break
          case 'top': updates = { y: minY }; break
          case 'center-v': updates = { y: centerY - el.height / 2 }; break
          case 'bottom': updates = { y: maxY - el.height }; break
        }
        page.elements = updateElementInList(page.elements, el.id, updates)
      }
      break
    }
    case 'distribute': {
      const { ids, direction } = toolParams
      const elements = ids.map((id: string) => findElementInList(page.elements, id)).filter(Boolean) as any[]
      if (elements.length < 3) break
      if (direction === 'horizontal') {
        const sorted = [...elements].sort((a, b) => a.x - b.x)
        const totalGap = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].width) - sorted[0].x - sorted.reduce((sum, el) => sum + el.width, 0)
        const gap = totalGap / (sorted.length - 1)
        let currentX = sorted[0].x
        for (const el of sorted) { page.elements = updateElementInList(page.elements, el.id, { x: Math.round(currentX) }); currentX += el.width + gap }
      } else {
        const sorted = [...elements].sort((a, b) => a.y - b.y)
        const totalGap = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].height) - sorted[0].y - sorted.reduce((sum, el) => sum + el.height, 0)
        const gap = totalGap / (sorted.length - 1)
        let currentY = sorted[0].y
        for (const el of sorted) { page.elements = updateElementInList(page.elements, el.id, { y: Math.round(currentY) }); currentY += el.height + gap }
      }
      break
    }
    case 'rename': {
      const { id, name } = toolParams
      page.elements = updateElementInList(page.elements, id, { name })
      break
    }
    case 'setVisible': {
      const { id, visible } = toolParams
      page.elements = updateElementInList(page.elements, id, { visible })
      break
    }
    case 'setLocked': {
      const { id, locked } = toolParams
      page.elements = updateElementInList(page.elements, id, { locked })
      break
    }
    case 'setOpacity': {
      const { id, opacity } = toolParams
      page.elements = updateElementInList(page.elements, id, { opacity })
      break
    }
    case 'setFill': {
      const { id, fill } = toolParams
      page.elements = updateElementInList(page.elements, id, { fill })
      break
    }
    case 'setStroke': {
      const { id, stroke, strokeWidth } = toolParams
      const updates: any = {}
      if (stroke !== undefined) updates.stroke = stroke
      if (strokeWidth !== undefined) updates.strokeWidth = strokeWidth
      page.elements = updateElementInList(page.elements, id, updates)
      break
    }
    case 'setCornerRadius': {
      const { id, cornerRadius } = toolParams
      page.elements = updateElementInList(page.elements, id, {
        cornerRadius, cornerRadiusTL: cornerRadius, cornerRadiusTR: cornerRadius,
        cornerRadiusBL: cornerRadius, cornerRadiusBR: cornerRadius,
      })
      break
    }
    case 'setTextContent': {
      const { id, textContent } = toolParams
      page.elements = updateElementInList(page.elements, id, { textContent })
      break
    }
    case 'setTextStyle': {
      const { id, fontFamily, fontSize, fontWeight, textAlign, textColor, lineHeight, letterSpacing } = toolParams
      const updates: any = {}
      if (fontFamily !== undefined) updates.fontFamily = fontFamily
      if (fontSize !== undefined) updates.fontSize = fontSize
      if (fontWeight !== undefined) updates.fontWeight = fontWeight
      if (textAlign !== undefined) updates.textAlign = textAlign
      if (textColor !== undefined) updates.textColor = textColor
      if (lineHeight !== undefined) updates.lineHeight = lineHeight
      if (letterSpacing !== undefined) updates.letterSpacing = letterSpacing
      page.elements = updateElementInList(page.elements, id, updates)
      break
    }
    case 'addShadow': {
      const { id, shadow } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      page.elements = updateElementInList(page.elements, id, { shadows: [...(el.shadows || []), shadow] })
      break
    }
    case 'addBlur': {
      const { id, blur } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      page.elements = updateElementInList(page.elements, id, { blurs: [...(el.blurs || []), blur] })
      break
    }
    case 'setBlendMode': {
      const { id, blendMode } = toolParams
      page.elements = updateElementInList(page.elements, id, { blendMode })
      break
    }
    case 'flipHorizontal': {
      const { id } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      page.elements = updateElementInList(page.elements, id, { flipH: !el.flipH })
      break
    }
    case 'flipVertical': {
      const { id } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      page.elements = updateElementInList(page.elements, id, { flipV: !el.flipV })
      break
    }
    case 'search': {
      const { query, type, name } = toolParams
      let results = flattenElements(page.elements)
      if (query) { const q = query.toLowerCase(); results = results.filter(el => el.name.toLowerCase().includes(q) || el.textContent?.toLowerCase().includes(q)) }
      if (type) results = results.filter(el => el.type === type)
      if (name) results = results.filter(el => el.name.toLowerCase().includes(name.toLowerCase()))
      return NextResponse.json({ elements: results })
    }
    case 'getElement': {
      const { id } = toolParams
      const el = findElementInList(page.elements, id)
      if (!el) return NextResponse.json({ error: 'Element not found' }, { status: 404 })
      return NextResponse.json({ element: el })
    }
    case 'getAllElements': {
      return NextResponse.json({ elements: flattenElements(page.elements) })
    }
    case 'loadElements': {
      const { elements } = toolParams
      page.elements = elements
      break
    }
    case 'clearCanvas': {
      page.elements = []
      break
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  await saveProject(project)

  // Live sync: a mutating tool action was applied (MCP / AI edits).
  publishProjectEvent(projectId, {
    type: 'project-updated',
    origin: getRequestOrigin(request),
  })

  return NextResponse.json({ success: true })
}
