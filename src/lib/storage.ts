import type { AppData, Profile } from '../store/types'
import { defaultTargets } from './calc'

export const STORAGE_KEY = 'nexus.data.v1'
export const DATA_VERSION = 1

export const defaultProfile = (): Profile => ({
  onboarded: false, name: '', age: 25, sex: 'male', heightCm: 170, weightKg: 60, targetKg: 65, goal: 'gain', experience: 'beginner',
  daysPerWeek: 3, activity: 'moderate', equipment: ['bodyweight'], foodPrefs: '', restrictions: '', units: { weight: 'kg', length: 'cm' }
})
export function emptyData(): AppData {
  const profile = defaultProfile()
  return {
    version: DATA_VERSION, profile, targets: defaultTargets(profile), weights: [], measurements: [], photos: [], plans: [], activePlanId: null, sessions: [],
    foodLog: [], customFoods: [], mealTemplates: [], events: [], tasks: [], habits: [], habitLogs: [], water: [], sleep: [], conversations: [],
    settings: { jarvisShareData: true, notifications: false, busyMode: false, remindersEnabled: true, accessCode: '' }, snoozed: {}, dismissed: {}
  }
}
/** Fill in anything missing so older saved data keeps working after app updates. */
export function normalise(raw: unknown): AppData {
  const base = emptyData()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AppData>
  const out: AppData = { ...base, ...r, profile: { ...base.profile, ...(r.profile ?? {}), units: { ...base.profile.units, ...(r.profile?.units ?? {}) } }, targets: { ...base.targets, ...(r.targets ?? {}) }, settings: { ...base.settings, ...(r.settings ?? {}) }, version: DATA_VERSION }
  for (const k of ['weights', 'measurements', 'photos', 'plans', 'sessions', 'foodLog', 'customFoods', 'mealTemplates', 'events', 'tasks', 'habits', 'habitLogs', 'water', 'sleep', 'conversations'] as const)
    if (!Array.isArray(out[k])) (out as unknown as Record<string, unknown>)[k] = []
  out.events = out.events.map(e => ({ ...e, doneDates: Array.isArray(e.doneDates) ? e.doneDates : [] }))
  return out
}
export interface LoadResult { data: AppData; fresh: boolean; error?: string }
export function load(): LoadResult {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return { data: emptyData(), fresh: true }
    return { data: normalise(JSON.parse(s)), fresh: false }
  } catch (e) {
    // Corrupt JSON: keep a copy so nothing is silently lost, then start fresh.
    try { const bad = localStorage.getItem(STORAGE_KEY); if (bad) localStorage.setItem(STORAGE_KEY + '.corrupt-' + Date.now(), bad) } catch { /* ignore */ }
    return { data: emptyData(), fresh: true, error: 'Saved data could not be read. A backup copy of the damaged data was kept.' }
  }
}
export function save(d: AppData): string | null {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); return null } catch { return 'Could not save: browser storage is full or blocked. Export a backup in Settings.' }
}

// ---- Progress photos live in IndexedDB (too big for localStorage) ----
const DB = 'nexus-photos'
const open = (): Promise<IDBDatabase> => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore('photos')
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((res, rej) => { const q = fn(db.transaction('photos', mode).objectStore('photos')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
}
export const photoPut = (id: string, dataUrl: string) => tx('readwrite', s => s.put(dataUrl, id))
export const photoGet = (id: string) => tx<string | undefined>('readonly', s => s.get(id) as IDBRequest<string | undefined>)
export const photoDelete = (id: string) => tx('readwrite', s => s.delete(id))
export const photoClear = () => tx('readwrite', s => s.clear())
/** Resize a picked image to max 1024px and return a JPEG data URL. */
export function resizeImage(file: File, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a readable image.')) }
    img.src = url
  })
}
