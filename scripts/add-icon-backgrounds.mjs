#!/usr/bin/env node
/**
 * add-icon-backgrounds.mjs — FrameRenderer (prototype player) renders only a
 * frame's CHILDREN, not the frame's own background. To make every icon render
 * identically in the editor AND the fullscreen player, insert a 512x512
 * background rectangle (same gradient, radius 120) as the FIRST child of each
 * of the 8 icon frames, using PUT on the frame to control child order.
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

const grad = (angle, stops) => ({
  type: 'linear-gradient',
  color: stops[0].color,
  opacity: 100,
  gradientAngle: angle,
  gradientStops: stops.map(([offset, color, opacity = 100]) => ({ offset, color, opacity: opacity / 100 })),
})

const BGS = [
  ['Icon 01 — Sparkle & Pen', grad(135, [[0, '#7C3AED'], [1, '#EC4899']])],
  ['Icon 02 — Chat to Design', grad(135, [[0, '#2563EB'], [1, '#8B5CF6']])],
  ['Icon 03 — Canvas Sparkle', grad(135, [[0, '#0D0B1E'], [1, '#2B1A55']])],
  ['Icon 04 — OD Monogram', grad(135, [[0, '#17171F'], [1, '#2E2E44']])],
  ['Icon 05 — Terminal Spark', grad(135, [[0, '#0A0F0D'], [1, '#14382A']])],
  ['Icon 06 — AI Layers', grad(135, [[0, '#1E1B4B'], [1, '#5B21B6']])],
  ['Icon 07 — Generative Orb', grad(135, [[0, '#FFFBF5'], [1, '#FBE0C8']])],
  ['Icon 08 — Agent Cursor', grad(135, [[0, '#0EA5E9'], [1, '#4F46E5']])],
]

async function main() {
  const { projects } = await api('/projects', null, 'GET')
  const project = projects.find((p) => p.name === 'opendesign — Icon Concepts')
  if (!project) throw new Error('icon project not found')
  const pid = project.id

  const { elements } = await api(`/projects/${pid}/elements`, null, 'GET')

  for (const [name, bgFill] of BGS) {
    const frame = elements.find((e) => e.type === 'frame' && e.name === name)
    if (!frame) throw new Error(`frame not found: ${name}`)
    if (frame.children?.[0]?.name === 'icon background') {
      console.log(`  skip (already has bg): ${name}`)
      continue
    }
    // create the bg rect (appended last), then re-order it to the front of children via PUT
    const { element: bg } = await api(`/projects/${pid}/elements`, {
      type: 'rectangle', name: 'icon background', x: 0, y: 0, width: 512, height: 512,
      fill: bgFill.color, fills: [bgFill], cornerRadius: 120, parentId: frame.id,
    })
    await api(`/projects/${pid}/elements/${frame.id}`, {
      children: [bg, ...(frame.children || [])],
    }, 'PUT')
    console.log(`  bg added: ${name}`)
  }

  // verify
  const { elements: after } = await api(`/projects/${pid}/elements`, null, 'GET')
  for (const f of after.filter((e) => e.type === 'frame')) {
    const ok = f.children?.[0]?.name === 'icon background'
    console.log(`verify: ${f.name} -> first child = ${f.children?.[0]?.name} ${ok ? 'OK' : '!!'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
