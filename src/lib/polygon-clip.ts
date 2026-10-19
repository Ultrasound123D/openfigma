/**
 * polygon-clip.ts — PHASE 6 (REBUILT per PORT-PLAN-6-11.md)
 * Pure polygon boolean math. ZERO imports (standalone-testable).
 *
 * Source status: port-source/figmajsx lost (2nd environment loss) — REGENERATED
 * against public Greiner-Hormann 1998 clipping semantics. No source copy.
 *
 * Representation: every region = Poly[] (multi-loop), rendered/point-tested with
 * fill-rule=evenodd (odd coverage = inside). Region algebra proven by coverage
 * counting — with int = GHint(A,B) (genuine intersection loops):
 *   intersect(A,B) = int
 *   union(A,B)     = [A, B, int]         (A-only:1✓  B-only:1✓  overlap:3✓filled)
 *   subtract(A,B)  = [A, B, B, int]      (A-only:1✓  B-only:2✓empty  overlap:4✓empty)
 *   exclude(A,B)   = [A, B]              (A-only:1✓  B-only:1✓  overlap:2✓empty)
 */

export type Pt = { x: number; y: number }
export type Poly = Pt[]

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude'

const EPS = 1e-9
const JITTER = 1e-7

export function signedArea(poly: Poly): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export function ensureCCW(poly: Poly): Poly {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly
}

export function pointInPoly(p: Pt, poly: Poly): boolean {
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y) {
      const t = (p.y - a.y) / (b.y - a.y)
      const xAt = a.x + t * (b.x - a.x)
      if (xAt > p.x) inside = !inside
    }
  }
  return inside
}

/** Point-in-REGION under evenodd semantics (what renderers do with fillRule). */
export function pointInRegion(p: Pt, loops: Poly[]): boolean {
  let inside = false
  for (const loop of loops) if (pointInPoly(p, loop)) inside = !inside
  return inside
}

/** Region area under evenodd (shoelace with alternating sign is NOT valid for
 * evenodd; integrate by… using signed areas of odd-coverage via decomposition is
 * overkill — we only need point tests + rendering parity. Kept for tests via
 * Monte-Carlo in the test script instead.) */
export function regionBounds(loops: Poly[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const l of loops) {
    if (l.length < 3) continue
    for (const p of l) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, minY, maxX, maxY }
}

/** Deterministic tiny perturbation to break degeneracies (collinear/touching). */
function jitterPt(p: Pt, seed: number): Pt {
  const h1 = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const h2 = Math.sin(seed * 269.5 + 183.3) * 22578.1449
  return { x: p.x + (h1 - Math.floor(h1) - 0.5) * JITTER, y: p.y + (h2 - Math.floor(h2) - 0.5) * JITTER }
}

interface INode {
  pt: Pt
  isIsect: boolean
  entry: boolean
  visited: boolean
  twin: INode | null
  listIndex: number
}

interface FlatList {
  nodes: INode[]
  isects: INode[]
}

function buildFlatList(poly: Poly): FlatList {
  const nodes: INode[] = poly.map((pt, i) => ({
    pt, isIsect: false, entry: false, visited: false, twin: null, listIndex: i,
  }))
  return { nodes, isects: [] }
}

/** Proper crossing of segments (a1→a2) × (b1→b2); returns t along each or null. */
function segCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): { ta: number; tb: number; pt: Pt } | null {
  const dax = a2.x - a1.x
  const day = a2.y - a1.y
  const dbx = b2.x - b1.x
  const dby = b2.y - b1.y
  const den = dax * dby - day * dbx
  if (Math.abs(den) < EPS) return null
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / den
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / den
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null
  return { ta: t, tb: u, pt: { x: a1.x + t * dax, y: a1.y + t * day } }
}

function insertIntersections(A: FlatList, B: FlatList): number {
  const insertsA: { afterIdx: number; node: INode; alpha: number }[] = []
  const insertsB: { afterIdx: number; node: INode; alpha: number }[] = []
  for (let i = 0; i < A.nodes.length; i++) {
    const ai = A.nodes[i]
    const aj = A.nodes[(i + 1) % A.nodes.length]
    if (ai.isIsect || aj.isIsect) continue
    for (let j = 0; j < B.nodes.length; j++) {
      const bi = B.nodes[j]
      const bj = B.nodes[(j + 1) % B.nodes.length]
      if (bi.isIsect || bj.isIsect) continue
      const hit = segCross(ai.pt, aj.pt, bi.pt, bj.pt)
      if (!hit) continue
      const na: INode = { pt: hit.pt, isIsect: true, entry: false, visited: false, twin: null, listIndex: -1 }
      const nb: INode = { pt: hit.pt, isIsect: true, entry: false, visited: false, twin: null, listIndex: -1 }
      na.twin = nb
      nb.twin = na
      insertsA.push({ afterIdx: i, node: na, alpha: hit.ta })
      insertsB.push({ afterIdx: j, node: nb, alpha: hit.tb })
    }
  }
  if (insertsA.length === 0) return 0

  const rebuild = (list: FlatList, inserts: { afterIdx: number; node: INode; alpha: number }[]) => {
    const byEdge = new Map<number, { node: INode; alpha: number }[]>()
    for (const ins of inserts) {
      const arr = byEdge.get(ins.afterIdx) ?? []
      arr.push({ node: ins.node, alpha: ins.alpha })
      byEdge.set(ins.afterIdx, arr)
    }
    const out: INode[] = []
    const isects: INode[] = []
    for (let i = 0; i < list.nodes.length; i++) {
      out.push(list.nodes[i])
      const arr = byEdge.get(i)
      if (arr) {
        arr.sort((p, q) => p.alpha - q.alpha)
        for (const { node } of arr) {
          out.push(node)
          isects.push(node)
        }
      }
    }
    for (let k = 0; k < out.length; k++) out[k].listIndex = k
    list.nodes = out
    list.isects = isects
  }
  rebuild(A, insertsA)
  rebuild(B, insertsB)
  return insertsA.length
}

function markEntries(list: FlatList, otherPoly: Poly) {
  // status = inside-ness (vs otherPoly) of THIS list's first segment.
  // list.nodes[0] is always the original poly[0] (plain vertex).
  let status = pointInPoly(list.nodes[0].pt, otherPoly)
  for (const node of list.nodes) {
    if (node.isIsect) {
      status = !status
      node.entry = status
    }
  }
}

function ghChains(A: FlatList, B: FlatList): Poly[] | null {
  const out: Poly[] = []
  const samePt = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6
  for (const s of A.isects) {
    if (s.visited) continue
    if (!s.entry) continue
    const chain: Pt[] = [s.pt]
    const startPt = s.pt
    let cur: INode = s
    let curIsA = true
    let guard = 0
    let closed = false
    while (!closed) {
      if (++guard > 10000) return null
      cur.visited = true
      if (cur.twin) cur.twin.visited = true
      const list = curIsA ? A : B
      let idx = cur.listIndex
      let next: INode | null = null
      let steps = 0
      // Both loops CCW + intersect marking: at a proper crossing the twin of an
      // exit node is always an entry node (complementarity), so every leg walks
      // FORWARD on its own list. Verified analytically; guarded by retry-on-null.
      while (steps < list.nodes.length) {
        steps++
        idx = (idx + 1) % list.nodes.length
        const nd = list.nodes[idx]
        if (nd.isIsect) { next = nd; break }
        chain.push(nd.pt)
      }
      if (!next) return null
      if (samePt(next.pt, startPt) || next === s || next === s.twin) {
        chain.push(next.pt)
        closed = true
        break
      }
      if (next.visited) return null
      chain.push(next.pt)
      cur = next.twin ?? next
      curIsA = !curIsA
    }
    if (chain.length >= 3) out.push(chain)
  }
  for (const n of A.isects) {
    if (!n.visited && n.entry) return null
  }
  return out
}

/** Distance from point to segment (for boundary-touch detection). */
function distPtSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 < EPS * EPS) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Min distance between the two boundaries (verts × edges, both directions). */
function boundaryDistance(a: Poly, b: Poly): number {
  let best = Infinity
  const nb = b.length
  for (const p of a) {
    for (let j = 0; j < nb; j++) {
      const d = distPtSeg(p, b[j], b[(j + 1) % nb])
      if (d < best) best = d
      if (best < 1e-6) return best
    }
  }
  const na = a.length
  for (const p of b) {
    for (let i = 0; i < na; i++) {
      const d = distPtSeg(p, a[i], a[(i + 1) % na])
      if (d < best) best = d
      if (best < 1e-6) return best
    }
  }
  return best
}

/** One clipping attempt on the given (possibly jittered) loop pair. */
function attemptCore(pa: Poly, pb: Poly): Poly[] | null {
  const A = buildFlatList(pa)
  const B = buildFlatList(pb)
  const crossings = insertIntersections(A, B)
  if (crossings === 0) {
    if (pointInPoly(pa[0], pb)) return [pa]
    if (pointInPoly(pb[0], pa)) return [pb]
    return []
  }
  if (crossings % 2 !== 0) return null
  markEntries(A, pb)
  markEntries(B, pa)
  return ghChains(A, B)
}

/** GHint for a single pair of simple loops (genuine intersection). */
export function ghIntersectLoops(a: Poly, b: Poly): Poly[] | null {
  if (a.length < 3 || b.length < 3) return []
  const aCCW = ensureCCW(a)
  const bCCW = ensureCCW(b)

  // identical (within 1e-2 grid) → intersection is the shape itself
  if (loopKey(aCCW) === loopKey(bCCW)) return [aCCW]

  // boundary-touch gate: raw crossing counts are untrustworthy when the
  // boundaries touch (vertex-on-edge / vertex-on-vertex kills proper crossings)
  const touch = boundaryDistance(aCCW, bCCW) <= 1e-6
  if (!touch) {
    const r = attemptCore(aCCW, bCCW)
    if (r !== null) return r
  }
  for (let k = 1; k <= 5; k++) {
    const ja = jitterPoly(aCCW, k * 7 + 3)
    const jb = jitterPoly(bCCW, k * 13 + 5)
    const r = attemptCore(ja, jb)
    if (r !== null) return r
  }
  return null
}

function jitterPoly(poly: Poly, seed: number): Poly {
  return poly.map((p, i) => jitterPt(p, seed + i * 17 + 1))
}

/** Canonical key for duplicate-loop detection (grid-rounded point set). */
function loopKey(poly: Poly): string {
  const norm = ensureCCW(poly)
  const pts = norm
    .map((p) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`)
    .sort()
  return pts.join('|')
}

/**
 * Remove identical loops in EVEN multiples (preserves evenodd parity exactly).
 * Kill collinear-duplicate degeneracies produced by subtract's [b,b] term.
 */
export function normalizeLoops(loops: Poly[]): Poly[] {
  const groups = new Map<string, Poly[]>()
  for (const l of loops) {
    if (l.length < 3) continue
    const k = loopKey(l)
    const arr = groups.get(k) ?? []
    arr.push(l)
    groups.set(k, arr)
  }
  const out: Poly[] = []
  for (const arr of groups.values()) {
    const keep = arr.length % 2 === 0 ? 0 : 1
    for (let i = 0; i < keep; i++) out.push(arr[i])
  }
  return out
}

/** region(loopsA) ∩ b — evenodd semantics across all loops of A. */
export function ghIntersectRegion(loopsA: Poly[], b: Poly): Poly[] | null {
  const out: Poly[] = []
  const bCCW = ensureCCW(b)
  for (const a of loopsA) {
    const r = ghIntersectLoops(a, bCCW)
    if (r === null) return null
    out.push(...r)
  }
  return out
}

/**
 * Fold operand b into accumulated multi-loop result (evenodd algebra).
 * Always call normalizeLoops on the FINAL result before building the element.
 */
export function foldOp(acc: Poly[], b: Poly, op: BooleanOp): Poly[] | null {
  if (b.length < 3) {
    switch (op) {
      case 'intersect': return []
      case 'subtract': return acc
      case 'union': case 'exclude': return [...acc, b]
    }
  }
  switch (op) {
    case 'intersect':
      return ghIntersectRegion(acc, b)
    case 'subtract': {
      const inter = ghIntersectRegion(acc, b)
      if (inter === null) return null
      return [...acc, b, b, ...inter]
    }
    case 'union': {
      const inter = ghIntersectRegion(acc, b)
      if (inter === null) return null
      return [...acc, b, ...inter]
    }
    case 'exclude':
      return [...acc, b]
  }
}
