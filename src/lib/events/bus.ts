/**
 * In-memory pub/sub event bus for real-time project sync (SSE).
 *
 * Architecture:
 *   - Mutation API routes (elements/pages/tools/project) call publishProjectEvent()
 *     AFTER the change is durably saved to disk.
 *   - The SSE route (/api/editor/projects/[id]/events) subscribes a listener per
 *     connected client and forwards events over the stream.
 *   - Every event carries an `origin` (client id). The SSE route filters out
 *     events caused by the same client that is listening, so a tab never
 *     receives echoes of its own writes.
 *
 * Limitations (documented, accepted for P4 scope):
 *   - Single Next.js process only. If the app is ever scaled horizontally,
 *     replace this module with Redis pub/sub keeping the same interface.
 *   - Uses globalThis so Next.js dev-mode hot reloads don't lose subscribers.
 */

export type ProjectEventType =
  | 'element-created'
  | 'element-updated'
  | 'element-deleted'
  | 'pages-changed'
  | 'project-updated'
  | 'presence'

export interface ProjectEvent {
  type: ProjectEventType
  /** Id of the client that caused the change (never receives its own event) */
  origin: string
  projectId: string
  /** Server-side page that was mutated, when known */
  pageId?: string
  /** Full element payload for created/updated events */
  element?: unknown
  /** Element id for updated/deleted events */
  elementId?: string
  /** PHASE 22 (C19) — multiplayer presence payload (cursor/viewport/selection).
   *  Ephemeral: never persisted, only forwarded live. */
  presence?: {
    clientId: string
    name: string
    color: string
    /** Cursor position in canvas coordinates */
    cursor?: { x: number; y: number }
    /** Viewport rect in canvas coordinates */
    viewport?: { x: number; y: number; w: number; h: number }
    /** Selection bbox in canvas coordinates (null = no selection) */
    selection?: { x: number; y: number; w: number; h: number } | null
    /** 'leave' = client disconnected / stopped sharing */
    kind?: 'move' | 'leave'
  }
  /** Timestamp (ms) */
  at: number
}

type Listener = (event: ProjectEvent) => void

interface BusState {
  listeners: Map<string, Set<Listener>>
  counter: number
}

const globalForBus = globalThis as unknown as { __openfigmaEventBus?: BusState }

function getBus(): BusState {
  if (!globalForBus.__openfigmaEventBus) {
    globalForBus.__openfigmaEventBus = { listeners: new Map(), counter: 0 }
  }
  return globalForBus.__openfigmaEventBus
}

/** Subscribe to every change of a project. Returns an unsubscribe function. */
export function subscribeToProject(projectId: string, listener: Listener): () => void {
  const bus = getBus()
  let set = bus.listeners.get(projectId)
  if (!set) {
    set = new Set()
    bus.listeners.set(projectId, set)
  }
  set.add(listener)
  const subscribedSet = set
  return () => {
    subscribedSet.delete(listener)
    if (subscribedSet.size === 0) {
      bus.listeners.delete(projectId)
    }
  }
}

/** Broadcast a change event to all subscribers of that project. */
export function publishProjectEvent(projectId: string, event: Omit<ProjectEvent, 'projectId' | 'at'>): void {
  const bus = getBus()
  bus.counter += 1
  const full: ProjectEvent = { ...event, projectId, at: Date.now() }
  const set = bus.listeners.get(projectId)
  if (!set || set.size === 0) return
  for (const listener of set) {
    try {
      listener(full)
    } catch (err) {
      // A broken SSE stream must never break the mutation that publishes it.
      console.error('project-event listener error:', err)
    }
  }
}

/**
 * Identify the actor of a mutation.
 * Browser tabs send `X-Client-Id` (a per-tab uuid); the MCP server sends
 * `X-Client-Id: mcp-server`; anything else falls back to a query param or
 * 'anonymous'.
 */
export function getRequestOrigin(request: Request): string {
  return (
    request.headers.get('x-client-id') ||
    new URL(request.url).searchParams.get('clientId') ||
    'anonymous'
  )
}
