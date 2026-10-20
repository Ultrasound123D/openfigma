/**
 * PHASE 22 (C21) — published component libraries registry.
 *
 * Source evidence:
 *   - js_bundles/4964 / 5977: `design_systems.assets_panel.publish_library`,
 *     `remove_library_from_file`, "unsubscribe", `add_more_libraries`
 *   - js_bundles/9035: `getLibraryPublishedComponentsWithCodeConnectAll({libraryKey})`,
 *     components carry `library_key`
 *   - js_bundles/figma_app-ebce: `publishedLibrary`, `fileSubscribedLibraryKeys`,
 *     `is_subscribed` (per-file library subscriptions)
 *
 * A library is a named, cross-project collection of components serialized at
 * publish time. Libraries live in .design-data/libraries.json (single-process
 * model, same limitation class as the SSE bus).
 */

import fs from 'fs/promises'
import path from 'path'
import type { DesignElement } from './server-state'

export interface PublishedLibrary {
  /** Stable library key (source: library_key) */
  key: string
  name: string
  publisher: string
  /** Project the library was published from */
  projectId: string
  publishedAt: string
  /** Serialized component masters (isComponent / isComponentSet elements) */
  components: DesignElement[]
}

const DATA_DIR = path.join(process.cwd(), '.design-data')
const LIBRARIES_PATH = path.join(DATA_DIR, 'libraries.json')

interface Registry {
  libraries: PublishedLibrary[]
}

const globalForLibs = globalThis as unknown as { __openfigmaLibraries?: Registry }

function getRegistry(): Registry {
  if (!globalForLibs.__openfigmaLibraries) {
    globalForLibs.__openfigmaLibraries = { libraries: [] }
  }
  return globalForLibs.__openfigmaLibraries
}

async function load(): Promise<Registry> {
  const registry = getRegistry()
  try {
    const data = await fs.readFile(LIBRARIES_PATH, 'utf-8')
    const parsed = JSON.parse(data) as Registry
    registry.libraries = Array.isArray(parsed.libraries) ? parsed.libraries : []
  } catch {
    registry.libraries = []
  }
  return registry
}

async function persist(registry: Registry): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(LIBRARIES_PATH, JSON.stringify(registry, null, 2))
}

/** List all published libraries (components stripped from the listing). */
export async function listLibraries(): Promise<Omit<PublishedLibrary, 'components'>[]> {
  const registry = await load()
  return registry.libraries.map(({ components: _c, ...rest }) => rest)
}

/** Publish (or re-publish) a named library from a project's components. */
export async function publishLibrary(input: {
  name: string
  publisher: string
  projectId: string
  components: DesignElement[]
}): Promise<PublishedLibrary> {
  const registry = await load()
  const key = `lib-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
  const library: PublishedLibrary = {
    key,
    name: input.name,
    publisher: input.publisher,
    projectId: input.projectId,
    publishedAt: new Date().toISOString(),
    components: input.components,
  }
  registry.libraries = [library, ...registry.libraries].slice(0, 50)
  await persist(registry)
  return library
}

/** Get one library with its components (source: getLibraryPublishedComponents). */
export async function getLibrary(key: string): Promise<PublishedLibrary | null> {
  const registry = await load()
  return registry.libraries.find((l) => l.key === key) || null
}

/** Delete a published library. */
export async function deleteLibrary(key: string): Promise<boolean> {
  const registry = await load()
  const before = registry.libraries.length
  registry.libraries = registry.libraries.filter((l) => l.key !== key)
  if (registry.libraries.length === before) return false
  await persist(registry)
  return true
}
