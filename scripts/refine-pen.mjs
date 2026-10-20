#!/usr/bin/env node
/**
 * refine-pen.mjs — upgrade Icon 01's pen: replace the pill-shaped body with a
 * shorter body + a sharp triangular nib, so the "design pen" metaphor reads
 * clearly (VLM feedback: body looked like an untapered pill).
 *
 * Pen geometry (frame-local coords, verified against the -45° rotation math):
 *   axis direction after -45° SVG rotation: (+0.707, +0.707) — from top-left to bottom-right
 *   body center: (328, 327); short body half-length 70
 *   nib: triangle with base at t=64 (width 44 perpendicular) and apex at t=104
 */
const BASE = 'http://localhost:3111/api/editor'

async function api(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`)
  return res.json()
}

const solid = (color, opacity = 100) => ({ type: 'solid', color, opacity })
const shadow = (y, blur, color, opacity) => ({
  type: 'drop-shadow', x: 0, y, blur, spread: 0, color, opacity: opacity / 100, visible: true,
})

async function main() {
  const { projects } = await api('/projects', null, 'GET')
  const project = projects.find((p) => p.name === 'opendesign — Icon Concepts')
  const pid = project.id
  const { elements } = await api(`/projects/${pid}/elements`, null, 'GET')

  const frame = elements.find((e) => e.type === 'frame' && e.name === 'Icon 01 — Sparkle & Pen')
  if (!frame) throw new Error('frame not found')
  const oldPen = (frame.children || []).find((c) => c.name === 'pen body')
  if (!oldPen) throw new Error('old pen not found')

  // 1. remove old pill body
  await api(`/projects/${pid}/elements/${oldPen.id}`, null, 'DELETE')
  console.log('old pen removed')

  // 2. shorter body (same center, same -45° rotation)
  const { element: body } = await api(`/projects/${pid}/elements`, {
    type: 'rectangle', name: 'pen body', x: 306, y: 257, width: 44, height: 140,
    fill: '#FFFFFF', cornerRadius: 20, rotation: -45,
    shadows: [shadow(8, 24, '#4C1D95', 35)], parentId: frame.id,
  })
  console.log(`new body: ${body.id}`)

  // 3. sharp nib — closed triangle path (coords relative to element box)
  const { element: nib } = await api(`/projects/${pid}/elements`, {
    type: 'path', name: 'pen nib', x: 357.6, y: 356.6, width: 44, height: 44,
    fill: '#FFFFFF',
    pathPoints: [{ x: 43.9, y: 43.9 }, { x: 31.2, y: 0 }, { x: 0, y: 31.2 }],
    pathClosed: true,
    shadows: [shadow(6, 18, '#4C1D95', 30)], parentId: frame.id,
  })
  console.log(`nib: ${nib.id}`)

  // verify order
  const { elements: after } = await api(`/projects/${pid}/elements`, null, 'GET')
  const f = after.find((e) => e.id === frame.id)
  console.log('children:', (f.children || []).map((c) => c.name).join(' | '))
}

main().catch((e) => { console.error(e); process.exit(1) })
