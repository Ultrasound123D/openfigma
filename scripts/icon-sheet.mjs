#!/usr/bin/env node
/**
 * icon-sheet.mjs — Build the "opendesign — Icon Concepts" sheet inside openfigma.
 *
 * One project, one page, 8 top-level 512x512 icon frames laid out in a 4x2 grid,
 * plus title + subtitle + a caption under every icon. Every icon is a complete,
 * self-contained design built ONLY from openfigma primitives (frame, rectangle,
 * ellipse, star, polygon, path, text) with real gradients, shadows and rotation —
 * exactly the schema verified from the source:
 *   - FillStyle: { type: 'solid'|'linear-gradient'|'radial-gradient', color, opacity, gradientStops, gradientAngle }
 *   - star: { sides, innerRadius (percent 0..100) }
 *   - path: { pathPoints: [{x,y}], pathClosed: true }
 *   - ShadowEffect: { type:'drop-shadow', x, y, blur, spread, color, opacity, visible }
 *
 * Target: http://localhost:3111 (openfigma standalone server)
 */
const BASE = 'http://localhost:3111/api/editor'

// ---------- helpers ----------------------------------------------------------

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
const radial = (stops) => ({
  type: 'radial-gradient',
  color: stops[0][1],
  opacity: 100,
  gradientStops: stops.map(([offset, color, opacity = 100]) => ({ offset, color, opacity: opacity / 100 })),
})
const solid = (color, opacity = 100) => ({ type: 'solid', color, opacity })

const shadow = (y, blur, color, opacity) => ({
  type: 'drop-shadow', x: 0, y, blur, spread: 0, color, opacity: opacity / 100, visible: true,
})

/** add an element (child coords are relative to parent frame, Figma-style) */
async function add(projectId, parentId, o) {
  const { element } = await api(`/projects/${projectId}/elements`, { ...o, parentId })
  return element.id
}

const star = (x, y, size, inner, fill, extra = {}) =>
  ({ type: 'star', name: 'sparkle', x, y, width: size, height: size, sides: 4, innerRadius: inner, fill: fill.color || fill, ...(fill.type ? { fills: [fill] } : {}), ...extra })
const rect = (name, x, y, w, h, fill, extra = {}) =>
  ({ type: 'rectangle', name, x, y, width: w, height: h, fill: fill.color || fill, ...(fill.type ? { fills: [fill] } : {}), ...extra })

// ---------- layout constants -------------------------------------------------

const COLS = [96, 704, 1312, 1920]
const ROW1 = 232, ROW2 = 880
const CAP1 = 764, CAP2 = 1412
const GRAY = '#6B7280', INK = '#111827'

const shadowSpec = [shadow(28, 56, '#0F0A1E', 28)]

// ---------- the eight icon concepts ------------------------------------------

/**
 * Each builder receives (projectId, frameId) and paints children with
 * coordinates relative to the 512x512 icon frame.
 */
const ICONS = [
  {
    name: 'Icon 01 — Sparkle & Pen', col: 0, row: ROW1, cap: CAP1, caption: '01 · Sparkle & Pen — AI meets the design pen',
    bg: () => [grad(135, [[0, '#7C3AED'], [1, '#EC4899']])],
    async paint(p, f) {
      await add(p, f, star(128, 92, 216, 30, solid('#FFFFFF'), { name: 'sparkle main', shadows: [shadow(10, 34, '#4C1D95', 40)] }))
      await add(p, f, star(372, 72, 76, 32, solid('#FDE68A'), { name: 'sparkle gold' }))
      await add(p, f, star(84, 340, 44, 34, solid('#F9A8D4', 90), { name: 'sparkle pink' }))
      await add(p, f, rect('pen body', 306, 238, 44, 178, solid('#FFFFFF'), { cornerRadius: 22, rotation: -45, shadows: [shadow(8, 24, '#4C1D95', 35)] }))
    },
  },
  {
    name: 'Icon 02 — Chat to Design', col: 1, row: ROW1, cap: CAP1, caption: '02 · Chat to Design — a prompt becomes a design',
    bg: () => [grad(135, [[0, '#2563EB'], [1, '#8B5CF6']])],
    async paint(p, f) {
      await add(p, f, rect('bubble', 86, 88, 340, 260, solid('#FFFFFF', 98), { cornerRadius: 76, shadows: [shadow(12, 32, '#1E1B4B', 35)] }))
      await add(p, f, rect('bubble tail', 128, 342, 60, 48, solid('#FFFFFF', 98), { sides: 3, type: 'polygon', rotation: 180 }))
      for (const dx of [163, 217, 271]) {
        await add(p, f, { type: 'ellipse', name: 'chat dot', x: dx, y: 203, width: 30, height: 30, fill: '#7C3AED' })
      }
      await add(p, f, star(374, 64, 80, 30, solid('#FCD34D'), { name: 'sparkle gold' }))
    },
  },
  {
    name: 'Icon 03 — Canvas Sparkle', col: 2, row: ROW1, cap: CAP1, caption: '03 · Canvas Sparkle — the AI canvas',
    bg: () => [grad(135, [[0, '#0D0B1E'], [1, '#2B1A55']])],
    async paint(p, f) {
      const C = '#22D3EE'
      // four frame corners (Figma-style selection corners)
      await add(p, f, rect('corner TL-h', 64, 64, 60, 8, solid(C)))
      await add(p, f, rect('corner TL-v', 64, 64, 8, 60, solid(C)))
      await add(p, f, rect('corner TR-h', 388, 64, 60, 8, solid(C)))
      await add(p, f, rect('corner TR-v', 440, 64, 8, 60, solid(C)))
      await add(p, f, rect('corner BL-h', 64, 440, 60, 8, solid(C)))
      await add(p, f, rect('corner BL-v', 64, 388, 8, 60, solid(C)))
      await add(p, f, rect('corner BR-h', 388, 440, 60, 8, solid(C)))
      await add(p, f, rect('corner BR-v', 440, 388, 8, 60, solid(C)))
      await add(p, f, star(156, 156, 200, 25, solid('#FFFFFF'), { name: 'sparkle main', shadows: [shadow(0, 64, '#22D3EE', 60)] }))
      await add(p, f, star(338, 118, 64, 35, solid('#67E8F9'), { name: 'sparkle cyan' }))
      await add(p, f, star(118, 338, 36, 35, solid('#A78BFA', 80), { name: 'sparkle violet' }))
    },
  },
  {
    name: 'Icon 04 — OD Monogram', col: 3, row: ROW1, cap: CAP1, caption: '04 · OD Monogram — the brand mark',
    bg: () => [grad(135, [[0, '#17171F'], [1, '#2E2E44']])],
    async paint(p, f) {
      await add(p, f, { type: 'ellipse', name: 'violet glow', x: 86, y: 70, width: 340, height: 340, fill: '#8B5CF6', fills: [radial([[0, '#8B5CF6', 45], [0.6, '#8B5CF6', 14], [1, '#8B5CF6', 0]])] })
      await add(p, f, {
        type: 'text', name: 'OD', x: 36, y: 140, width: 440, height: 232,
        textContent: 'OD', textColor: '#FAFAFA', fontFamily: 'Inter', fontSize: 180, fontWeight: 800,
        textAlign: 'center', letterSpacing: -8,
      })
      await add(p, f, star(366, 112, 76, 30, solid('#FBBF24'), { name: 'sparkle gold' }))
    },
  },
  {
    name: 'Icon 05 — Terminal Spark', col: 0, row: ROW2, cap: CAP2, caption: '05 · Terminal Spark — opencode heritage',
    bg: () => [grad(135, [[0, '#0A0F0D'], [1, '#14382A']])],
    async paint(p, f) {
      await add(p, f, {
        type: 'text', name: 'prompt', x: 88, y: 108, width: 180, height: 240,
        textContent: '>', textColor: '#34D399', fontFamily: 'Roboto Mono', fontSize: 200, fontWeight: 700, textAlign: 'left',
      })
      await add(p, f, rect('cursor', 234, 262, 122, 26, solid('#34D399'), { cornerRadius: 13 }))
      await add(p, f, star(342, 80, 84, 28, solid('#38BDF8'), { name: 'sparkle blue', shadows: [shadow(0, 40, '#38BDF8', 50)] }))
    },
  },
  {
    name: 'Icon 06 — AI Layers', col: 1, row: ROW2, cap: CAP2, caption: '06 · AI Layers — intelligence stacked on design layers',
    bg: () => [grad(135, [[0, '#1E1B4B'], [1, '#5B21B6']])],
    async paint(p, f) {
      await add(p, f, rect('layer back', 116, 296, 280, 192, solid('#A78BFA', 40), { cornerRadius: 44 }))
      await add(p, f, rect('layer mid', 116, 232, 280, 192, solid('#C4B5FD', 60), { cornerRadius: 44 }))
      await add(p, f, rect('layer front', 116, 168, 280, 192, solid('#EDE9FE', 98), { cornerRadius: 44, shadows: [shadow(12, 32, '#1E1B4B', 45)] }))
      await add(p, f, rect('content line 1', 152, 208, 200, 20, solid('#6D28D9', 55), { cornerRadius: 10 }))
      await add(p, f, rect('content line 2', 152, 244, 132, 20, solid('#6D28D9', 35), { cornerRadius: 10 }))
      await add(p, f, star(330, 112, 96, 28, solid('#FCD34D'), { name: 'sparkle gold' }))
    },
  },
  {
    name: 'Icon 07 — Generative Orb', col: 2, row: ROW2, cap: CAP2, caption: '07 · Generative Orb — designs generated from light',
    bg: () => [grad(135, [[0, '#FFFBF5'], [1, '#FBE0C8']])],
    async paint(p, f) {
      for (const [dx, dy] of [[108, 108], [208, 108], [308, 108], [108, 208], [308, 208], [108, 308], [208, 308], [308, 308]]) {
        await add(p, f, { type: 'ellipse', name: 'grid dot', x: dx, y: dy, width: 12, height: 12, fill: '#E2C7A8' })
      }
      await add(p, f, {
        type: 'ellipse', name: 'orb', x: 96, y: 96, width: 320, height: 320, fill: '#F97316',
        fills: [radial([[0, '#FDBA74'], [0.55, '#F97316'], [1, '#DC2626']])],
        shadows: [shadow(28, 56, '#EA580C', 35)],
      })
      await add(p, f, { type: 'ellipse', name: 'gloss', x: 150, y: 146, width: 76, height: 46, fill: '#FFFFFF', opacity: 65, rotation: -24 })
      await add(p, f, star(336, 106, 72, 30, solid('#FFFFFF'), { name: 'sparkle white', shadows: [shadow(4, 20, '#F97316', 40)] }))
    },
  },
  {
    name: 'Icon 08 — Agent Cursor', col: 3, row: ROW2, cap: CAP2, caption: '08 · Agent Cursor — the agent works the canvas',
    bg: () => [grad(135, [[0, '#0EA5E9'], [1, '#4F46E5']])],
    async paint(p, f) {
      await add(p, f, {
        type: 'path', name: 'cursor arrow', x: 168, y: 126, width: 104, height: 178, fill: '#FFFFFF',
        pathPoints: [{ x: 0, y: 0 }, { x: 0, y: 148 }, { x: 34, y: 118 }, { x: 56, y: 176 }, { x: 80, y: 164 }, { x: 58, y: 110 }, { x: 102, y: 110 }],
        pathClosed: true,
        shadows: [shadow(14, 36, '#1E3A8A', 45)],
      })
      await add(p, f, star(316, 86, 88, 28, solid('#FDE047'), { name: 'sparkle yellow', shadows: [shadow(0, 36, '#FDE047', 45)] }))
      await add(p, f, star(304, 298, 48, 32, solid('#FFFFFF', 90), { name: 'sparkle white' }))
      await add(p, f, star(126, 330, 32, 34, solid('#BAE6FD', 85), { name: 'sparkle ice' }))
    },
  },
]

// ---------- build ------------------------------------------------------------

async function main() {
  // 1. create the project
  const { project } = await api('/projects', { name: 'opendesign — Icon Concepts' })
  const pid = project.id
  console.log(`project: ${pid} (${project.name})`)

  // 2. sheet header
  await add(pid, null, {
    type: 'text', name: 'sheet title', x: 96, y: 56, width: 1600, height: 64,
    textContent: 'opendesign — Icon Concepts', textColor: INK, fontFamily: 'Inter',
    fontSize: 46, fontWeight: 700, textAlign: 'left', letterSpacing: -1,
  })
  await add(pid, null, {
    type: 'text', name: 'sheet subtitle', x: 96, y: 122, width: 1800, height: 36,
    textContent: 'AI design agent · 8 directions · designed & rendered entirely inside openfigma', textColor: GRAY,
    fontFamily: 'Inter', fontSize: 21, fontWeight: 400, textAlign: 'left',
  })

  // 3. the eight icons + captions
  let n = 0
  for (const icon of ICONS) {
    const x = COLS[icon.col]
    const frameId = await add(pid, null, {
      type: 'frame', name: icon.name, x, y: icon.row, width: 512, height: 512,
      fill: '#111111', fills: icon.bg(), cornerRadius: 120, clipContent: true,
      shadows: shadowSpec,
    })
    await icon.paint(pid, frameId)
    await add(pid, null, {
      type: 'text', name: `caption ${icon.name}`, x, y: icon.cap, width: 512, height: 40,
      textContent: icon.caption, textColor: GRAY, fontFamily: 'Inter', fontSize: 22, fontWeight: 500, textAlign: 'left',
    })
    n++
    console.log(`  [${n}/8] ${icon.name}`)
  }

  // 4. verify the tree
  const el = await api(`/projects/${pid}/elements`, null, 'GET')
  const frames = el.elements.filter((e) => e.type === 'frame')
  const total = el.flatElements.length
  console.log(`\nverify: ${frames.length} frames, ${total} elements total (flat)`)
  if (frames.length !== 8) throw new Error(`expected 8 frames, got ${frames.length}`)
  for (const f of frames) {
    const kids = (f.children || []).length
    console.log(`  - ${f.name}: ${kids} children`)
  }
  console.log(`\nDONE — open http://localhost:3111 and open project "${project.name}" from File menu`)
}

main().catch((e) => { console.error(e); process.exit(1) })
