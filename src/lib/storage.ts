import { DesignElement, Page, Guide } from '@/store/editor-store'

const DB_NAME = 'figma-editor'
const DB_VERSION = 2
const STORE_NAME = 'projects'
const AUTOSAVE_INTERVAL = 30000

export interface ProjectData {
  id: string
  elements: DesignElement[]
  pages: Page[]
  fileName: string
  guides: Guide[]
  savedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProject(data: Omit<ProjectData, 'savedAt'>): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const savedAt = Date.now()
  await wrapRequest(store.put({ ...data, savedAt }))
  return savedAt
}

export async function loadProject(id: string = 'current'): Promise<ProjectData | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result = await wrapRequest(store.get(id))
  return result || null
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result = await wrapRequest(store.getAll())
  return result || []
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await wrapRequest(store.delete(id))
}

let autoSaveTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSave(
  getState: () => { elements: DesignElement[]; pages: Page[]; fileName: string; guides: Guide[]; isDirty: boolean; setLastSavedAt: (t: number | null) => void; setSaving: (s: boolean) => void; setDirty: (d: boolean) => void }
) {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  
  autoSaveTimer = setInterval(async () => {
    const state = getState()
    if (!state.isDirty) return
    
    state.setSaving(true)
    try {
      const savedAt = await saveProject({
        id: 'current',
        elements: state.elements,
        pages: state.pages,
        fileName: state.fileName,
        guides: state.guides,
      })
      state.setLastSavedAt(savedAt)
      state.setDirty(false)
    } catch (e) {
      console.error('Auto-save failed:', e)
    } finally {
      state.setSaving(false)
    }
  }, AUTOSAVE_INTERVAL)
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}
