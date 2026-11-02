import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ActionPayload, AppData, CalEvent, ChatMsg, Conversation, Food, FoodEntry, MealType, Measurement, Profile, Targets, Task, WorkoutPlan, WorkoutSession } from './types'
import { DATA_VERSION, STORAGE_KEY, emptyData, load, normalise, photoClear, photoDelete, photoGet, photoPut, resizeImage, save } from '../lib/storage'
import { uid } from '../lib/id'
import { defaultTargets, foodMacros } from '../lib/calc'
import { generatePlan } from '../lib/plans'
import { foodById } from '../data/foods'
import { isValidDate, isValidTime, timeToMin, todayStr } from '../lib/date'
import { LIMITS, between, num } from '../lib/validate'

export type Result = { ok: true; message?: string } | { ok: false; error: string }
const ok = (message?: string): Result => ({ ok: true, message })
const bad = (error: string): Result => ({ ok: false, error })

export interface Actions {
  saveProfile(p: Profile, resetTargets?: boolean): Result
  setTargets(t: Partial<Targets>): Result
  addWeight(kg: unknown, date?: string, note?: string): Result
  deleteWeight(id: string): void
  addMeasurement(m: Omit<Measurement, 'id'>): Result
  deleteMeasurement(id: string): void
  addPhoto(file: File, date: string, note?: string): Promise<Result>
  deletePhoto(id: string): Promise<void>
  savePlan(p: WorkoutPlan): void
  deletePlan(id: string): void
  setActivePlan(id: string | null): void
  addSession(s: WorkoutSession): void
  deleteSession(id: string): void
  addFood(e: { foodId: string; grams: unknown; meal: MealType; date?: string }): Result
  deleteFoodEntry(id: string): void
  saveCustomFood(f: Omit<Food, 'id' | 'source'> & { id?: string }): Result
  deleteCustomFood(id: string): void
  saveMealTemplate(name: string, meal: MealType, items: { foodId: string; grams: number }[]): Result
  deleteMealTemplate(id: string): void
  saveEvent(e: Omit<CalEvent, 'id' | 'doneDates'> & { id?: string; doneDates?: string[] }): Result
  deleteEvent(id: string): void
  toggleEventDone(id: string, date: string): void
  addTask(t: { title: string; priority?: Task['priority']; due?: string; notes?: string }): Result
  updateTask(id: string, patch: Partial<Task>): void
  deleteTask(id: string): void
  addWater(ml: unknown, date?: string): Result
  deleteWater(id: string): void
  setSleep(date: string, hours: unknown, quality: number): Result
  addHabit(name: string, perWeek: number): Result
  deleteHabit(id: string): void
  toggleHabit(habitId: string, date: string): void
  setSettings(s: Partial<AppData['settings']>): void
  snooze(key: string, until: number): void
  dismiss(key: string): void
  newConversation(): string
  updateConversation(id: string, fn: (c: Conversation) => Conversation): void
  appendMessage(id: string, m: ChatMsg): void
  deleteConversation(id: string): void
  runAction(a: ActionPayload): Result
  importData(json: string): Result
  exportData(): Promise<string>
  deleteAll(): Promise<void>
}
interface Ctx { data: AppData; actions: Actions; storageError: string | null; loadError: string | null; fresh: boolean }
const StoreCtx = createContext<Ctx | null>(null)
export const useStore = () => { const c = useContext(StoreCtx); if (!c) throw new Error('useStore outside provider'); return c }
export const useData = () => useStore().data
export const useActions = () => useStore().actions

/** One-time migration of tasks from the very first prototype (key "nexus-tasks"), dropping its built-in sample tasks. */
function legacyTasks(): Task[] {
  try {
    const raw = JSON.parse(localStorage.getItem('nexus-tasks') || 'null'); if (!Array.isArray(raw)) return []
    const samples = ['Morning mobility and warm-up', 'Breakfast — oats, banana, eggs and milk', 'Upper-body strength session', 'Log meals and water intake', 'Evening stretch and wind down']
    return raw.filter((t: { text?: string }) => t?.text && !samples.includes(t.text)).map((t: { text: string; done?: boolean }) => ({ id: uid('task'), title: String(t.text), done: !!t.done, priority: 'medium' as const, createdAt: Date.now() }))
  } catch { return [] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef(load())
  const [data, setData] = useState<AppData>(() => {
    const d = initial.current.data
    if (initial.current.fresh) { const lt = legacyTasks(); if (lt.length) d.tasks = lt }
    return d
  })
  const [storageError, setStorageError] = useState<string | null>(null)
  const dataRef = useRef(data); dataRef.current = data
  const timer = useRef<number | undefined>(undefined)

  // Save shortly after any change; also flush when the page is hidden so nothing is lost.
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStorageError(save(data)), 250)
    return () => window.clearTimeout(timer.current)
  }, [data])
  useEffect(() => {
    const flush = () => { window.clearTimeout(timer.current); save(dataRef.current) }
    const vis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', vis)
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY && e.newValue) { try { setData(normalise(JSON.parse(e.newValue))) } catch { /* ignore */ } } }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); window.removeEventListener('storage', onStorage) }
  }, [])

  const up = useCallback((fn: (d: AppData) => AppData) => setData(d => fn(d)), [])

  const actions = useMemo<Actions>(() => {
    const a: Actions = {
      saveProfile(p, resetTargets) {
        if (!p.name.trim()) return bad('Please enter a name.')
        if (!between(p.age, ...LIMITS.age)) return bad('Age must be between 10 and 100.')
        if (!between(p.heightCm, ...LIMITS.heightCm)) return bad('Height must be between 100 and 250 cm.')
        if (!between(p.weightKg, ...LIMITS.weightKg)) return bad('Current weight must be between 20 and 400 kg.')
        if (!between(p.targetKg, ...LIMITS.weightKg)) return bad('Target weight must be between 20 and 400 kg.')
        up(d => {
          const targets = resetTargets || !d.targets.custom ? defaultTargets(p) : d.targets
          // First time: record the starting weight so charts and Jarvis have a real data point.
          const weights = d.weights.length === 0 && p.onboarded ? [{ id: uid('w'), date: todayStr(), kg: p.weightKg }] : d.weights
          return { ...d, profile: p, targets, weights }
        })
        return ok()
      },
      setTargets(t) {
        if (t.calories !== undefined && !between(t.calories, ...LIMITS.kcal)) return bad('Calories must be between 800 and 8000.')
        for (const k of ['protein', 'carbs', 'fat'] as const) if (t[k] !== undefined && !between(t[k]!, 0, 1000)) return bad(`${k} must be between 0 and 1000 g.`)
        up(d => ({ ...d, targets: { ...d.targets, ...t, custom: true } })); return ok()
      },
      addWeight(kgIn, date = todayStr(), note) {
        const kg = num(kgIn)
        if (!between(kg, ...LIMITS.weightKg)) return bad('Enter a weight between 20 and 400 kg.')
        if (!isValidDate(date)) return bad('Invalid date.')
        if (date > todayStr()) return bad('Date cannot be in the future.')
        // One entry per day: re-saving the same day replaces it, which avoids duplicates.
        up(d => ({ ...d, weights: [...d.weights.filter(w => w.date !== date), { id: uid('w'), date, kg: Math.round(kg * 10) / 10, note }] }))
        return ok('Weight saved')
      },
      deleteWeight: id => up(d => ({ ...d, weights: d.weights.filter(w => w.id !== id) })),
      addMeasurement(m) {
        const keys = ['chest', 'waist', 'arm', 'thigh', 'hip', 'calf'] as const
        if (!isValidDate(m.date) || m.date > todayStr()) return bad('Choose a valid date that is not in the future.')
        if (!keys.some(k => m[k] !== undefined)) return bad('Enter at least one measurement.')
        for (const k of keys) if (m[k] !== undefined && !between(m[k]!, ...LIMITS.girthCm)) return bad(`${k} must be between 10 and 250 cm.`)
        up(d => ({ ...d, measurements: [...d.measurements.filter(x => x.date !== m.date), { ...m, id: uid('m') }] })); return ok('Measurements saved')
      },
      deleteMeasurement: id => up(d => ({ ...d, measurements: d.measurements.filter(m => m.id !== id) })),
      async addPhoto(file, date, note) {
        try {
          const url = await resizeImage(file); const id = uid('photo')
          await photoPut(id, url); up(d => ({ ...d, photos: [...d.photos, { id, date, note }] })); return ok('Photo saved on this device')
        } catch (e) { return bad(e instanceof Error ? e.message : 'Could not save photo.') }
      },
      async deletePhoto(id) { try { await photoDelete(id) } catch { /* ignore */ } up(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) })) },
      savePlan: p => up(d => ({ ...d, plans: d.plans.some(x => x.id === p.id) ? d.plans.map(x => (x.id === p.id ? p : x)) : [...d.plans, p], activePlanId: d.activePlanId ?? p.id })),
      deletePlan: id => up(d => ({ ...d, plans: d.plans.filter(p => p.id !== id), activePlanId: d.activePlanId === id ? null : d.activePlanId })),
      setActivePlan: id => up(d => ({ ...d, activePlanId: id })),
      addSession: s => up(d => ({ ...d, sessions: d.sessions.some(x => x.id === s.id) ? d.sessions : [...d.sessions, s] })),
      deleteSession: id => up(d => ({ ...d, sessions: d.sessions.filter(s => s.id !== id) })),
      addFood({ foodId, grams: g, meal, date = todayStr() }) {
        const grams = num(g)
        if (!between(grams, ...LIMITS.grams)) return bad('Enter a portion between 1 and 5000 g.')
        const f = foodById(foodId, dataRef.current.customFoods); if (!f) return bad('Food not found.')
        const m = foodMacros(f, grams)
        const entry: FoodEntry = { id: uid('f'), date, meal, foodId, name: f.name, grams, ...m, ts: Date.now() }
        up(d => ({ ...d, foodLog: [...d.foodLog, entry] })); return ok('Added to log')
      },
      deleteFoodEntry: id => up(d => ({ ...d, foodLog: d.foodLog.filter(e => e.id !== id) })),
      saveCustomFood(f) {
        if (!f.name.trim()) return bad('Give the food a name.')
        for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) if (!Number.isFinite(f[k]) || f[k] < 0 || f[k] > 1000) return bad(`${k} must be a number between 0 and 1000 per 100 g.`)
        const id = f.id ?? uid('cf')
        up(d => ({ ...d, customFoods: [...d.customFoods.filter(x => x.id !== id), { ...f, id, source: 'custom' }] })); return ok('Food saved')
      },
      deleteCustomFood: id => up(d => ({ ...d, customFoods: d.customFoods.filter(f => f.id !== id) })),
      saveMealTemplate(name, meal, items) {
        if (!name.trim()) return bad('Name the meal.'); if (!items.length) return bad('Add at least one food.')
        up(d => ({ ...d, mealTemplates: [...d.mealTemplates, { id: uid('mt'), name: name.trim(), meal, items }] })); return ok('Meal saved')
      },
      deleteMealTemplate: id => up(d => ({ ...d, mealTemplates: d.mealTemplates.filter(m => m.id !== id) })),
      saveEvent(e) {
        if (!e.title.trim()) return bad('Add a title.')
        if (!isValidDate(e.date)) return bad('Choose a valid date.')
        if (!isValidTime(e.start) || !isValidTime(e.end)) return bad('Choose valid times.')
        if (timeToMin(e.end) < timeToMin(e.start)) return bad('End time must be after the start time.')
        if (e.until && e.until < e.date) return bad('"Repeat until" must be after the start date.')
        const id = e.id ?? uid('ev')
        const dup = dataRef.current.events.some(x => x.id !== id && x.title === e.title.trim() && x.date === e.date && x.start === e.start)
        if (dup) return bad('An identical event already exists at that time.')
        up(d => { const ev: CalEvent = { ...e, title: e.title.trim(), id, doneDates: e.doneDates ?? d.events.find(x => x.id === id)?.doneDates ?? [] }; return { ...d, events: d.events.some(x => x.id === id) ? d.events.map(x => (x.id === id ? ev : x)) : [...d.events, ev] } })
        return ok('Event saved')
      },
      deleteEvent: id => up(d => ({ ...d, events: d.events.filter(e => e.id !== id) })),
      toggleEventDone: (id, date) => up(d => ({ ...d, events: d.events.map(e => e.id === id ? { ...e, doneDates: e.doneDates.includes(date) ? e.doneDates.filter(x => x !== date) : [...e.doneDates, date] } : e) })),
      addTask(t) {
        if (!t.title.trim()) return bad('Describe the task.')
        if (t.due && !isValidDate(t.due)) return bad('Invalid due date.')
        up(d => ({ ...d, tasks: [...d.tasks, { id: uid('task'), title: t.title.trim(), done: false, priority: t.priority ?? 'medium', due: t.due, notes: t.notes, createdAt: Date.now() }] })); return ok('Task added')
      },
      updateTask: (id, patch) => up(d => ({ ...d, tasks: d.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: id => up(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) })),
      addWater(mlIn, date = todayStr()) {
        const ml = num(mlIn); if (!between(ml, ...LIMITS.waterMl)) return bad('Enter between 10 and 5000 ml.')
        up(d => ({ ...d, water: [...d.water, { id: uid('wt'), date, ml, ts: Date.now() }] })); return ok('Water logged')
      },
      deleteWater: id => up(d => ({ ...d, water: d.water.filter(w => w.id !== id) })),
      setSleep(date, hoursIn, quality) {
        const h = num(hoursIn); if (!between(h, 0.5, 24)) return bad('Sleep must be between 0.5 and 24 hours.')
        up(d => ({ ...d, sleep: [...d.sleep.filter(s => s.date !== date), { id: uid('sl'), date, hours: h, quality }] })); return ok('Sleep saved')
      },
      addHabit(name, perWeek) {
        if (!name.trim()) return bad('Name the habit.')
        up(d => ({ ...d, habits: [...d.habits, { id: uid('hb'), name: name.trim(), perWeek: Math.max(1, Math.min(7, perWeek)) }] })); return ok('Habit added')
      },
      deleteHabit: id => up(d => ({ ...d, habits: d.habits.filter(h => h.id !== id), habitLogs: d.habitLogs.filter(l => l.habitId !== id) })),
      toggleHabit: (habitId, date) => up(d => ({ ...d, habitLogs: d.habitLogs.some(l => l.habitId === habitId && l.date === date) ? d.habitLogs.filter(l => !(l.habitId === habitId && l.date === date)) : [...d.habitLogs, { habitId, date }] })),
      setSettings: s => up(d => ({ ...d, settings: { ...d.settings, ...s } })),
      snooze: (key, until) => up(d => ({ ...d, snoozed: { ...d.snoozed, [key]: until } })),
      dismiss: key => up(d => ({ ...d, dismissed: { ...d.dismissed, [key]: true } })),
      newConversation() {
        const c: Conversation = { id: uid('conv'), title: 'New conversation', createdAt: Date.now(), messages: [], memory: {} }
        up(d => ({ ...d, conversations: [c, ...d.conversations].slice(0, 40) })); return c.id
      },
      updateConversation: (id, fn) => up(d => ({ ...d, conversations: d.conversations.map(c => (c.id === id ? fn(c) : c)) })),
      appendMessage: (id, m) => up(d => ({ ...d, conversations: d.conversations.map(c => (c.id === id ? { ...c, messages: [...c.messages, m] } : c)) })),
      deleteConversation: id => up(d => ({ ...d, conversations: d.conversations.filter(c => c.id !== id) })),
      // Run a (user-approved) Jarvis action. Every action goes through the same validated functions as the forms.
      runAction(act) {
        switch (act.type) {
          case 'log_weight': return a.addWeight(act.kg, act.date)
          case 'log_water': return a.addWater(act.ml)
          case 'add_task': return a.addTask({ title: act.title, priority: act.priority, due: act.due })
          case 'add_event': {
            const end = act.end ?? `${String(Math.min(23, Number(act.start.slice(0, 2)) + 1)).padStart(2, '0')}:${act.start.slice(3)}`
            return a.saveEvent({ title: act.title, date: act.date, start: act.start, end, kind: act.kind ?? 'event', recurrence: 'none', remindMin: 15 })
          }
          case 'log_meal': return a.addFood({ foodId: act.foodId, grams: act.grams, meal: act.meal, date: act.date })
          case 'log_meal_items': { for (const i of act.items) { const r = a.addFood({ foodId: i.foodId, grams: i.grams, meal: act.meal }); if (!r.ok) return r } return ok('Meal logged') }
          case 'create_plan': { const p = generatePlan(act.style, dataRef.current.profile.equipment, dataRef.current.profile.daysPerWeek); a.savePlan(p); return ok(`Created "${p.name}"`) }
          case 'set_targets': return a.setTargets({ calories: act.calories, protein: act.protein, carbs: act.carbs, fat: act.fat })
        }
      },
      importData(json) {
        try {
          const raw = JSON.parse(json); const d = raw?.data ?? raw
          if (!d || typeof d !== 'object' || !('profile' in d)) return bad('This file does not look like a NEXUS backup.')
          const next = normalise(d); setData(next); save(next)
          const photos = raw?.photos as Record<string, string> | undefined
          if (photos) Object.entries(photos).forEach(([id, url]) => { void photoPut(id, url) })
          return ok('Backup restored')
        } catch { return bad('The file could not be read as JSON.') }
      },
      async exportData() {
        const photos: Record<string, string> = {}
        for (const p of dataRef.current.photos) { try { const u = await photoGet(p.id); if (u) photos[p.id] = u } catch { /* skip */ } }
        return JSON.stringify({ app: 'NEXUS', version: DATA_VERSION, exportedAt: new Date().toISOString(), data: dataRef.current, photos }, null, 2)
      },
      async deleteAll() {
        try { await photoClear() } catch { /* ignore */ }
        localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('nexus-tasks'); setData(emptyData())
      }
    }
    return a
  }, [up])

  const ctx = useMemo<Ctx>(() => ({ data, actions, storageError, loadError: initial.current.error ?? null, fresh: initial.current.fresh }), [data, actions, storageError])
  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>
}
