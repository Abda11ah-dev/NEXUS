// Pure calculation helpers (no React). These are unit-tested in calc.test.ts.
import type { Activity, AppData, Food, FoodEntry, Goal, Profile, Targets, WeightEntry, WorkoutSession } from '../store/types'
import { addDays, diffDays, todayStr } from './date'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54
export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB
export const round = (n: number, d = 1) => { const f = 10 ** d; return Math.round(n * f) / f }

/** Mifflin-St Jeor basal metabolic rate (kcal/day). An estimate only. */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
}
const ACTIVITY: Record<Activity, number> = { low: 1.375, moderate: 1.55, high: 1.725 }
export const tdee = (p: Profile): number => bmr(p) * ACTIVITY[p.activity]

/** Starting calorie/macro targets. These are estimates; the user can edit every value. */
export function defaultTargets(p: Profile, currentKg = p.weightKg): Targets {
  const adj: Record<Goal, number> = { gain: 400, lose: -450, maintain: 0 }
  const maintenance = tdee({ ...p, weightKg: currentKg })
  const calories = Math.max(1200, Math.round((maintenance + adj[p.goal]) / 10) * 10)
  const protein = Math.round(currentKg * (p.goal === 'maintain' ? 1.6 : 1.9))
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { calories, protein, carbs, fat, waterMl: Math.round((currentKg * 35) / 250) * 250, sleepH: 8, custom: false }
}

export const foodMacros = (f: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number) => ({
  kcal: round((f.kcal * grams) / 100, 0), protein: round((f.protein * grams) / 100, 1), carbs: round((f.carbs * grams) / 100, 1), fat: round((f.fat * grams) / 100, 1)
})
export function totals(entries: FoodEntry[]) {
  return entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}
export const dayTotals = (log: FoodEntry[], date: string) => totals(log.filter(e => e.date === date))

export const sortByDate = <T extends { date: string }>(a: T[]): T[] => [...a].sort((x, y) => x.date.localeCompare(y.date))
export type RangeKey = '7d' | '30d' | '3m' | '6m' | '1y' | 'all'
export const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '3m': 90, '6m': 182, '1y': 365, all: Infinity }
export function inRange<T extends { date: string }>(a: T[], range: RangeKey, today = todayStr()): T[] {
  const n = RANGE_DAYS[range]
  return n === Infinity ? sortByDate(a) : sortByDate(a).filter(e => diffDays(e.date, today) < n && diffDays(e.date, today) >= 0)
}

/** Average of the weights in the 7 days ending on `date` (null if none). */
export function weeklyAverage(w: WeightEntry[], date = todayStr()): number | null {
  const v = w.filter(e => diffDays(e.date, date) >= 0 && diffDays(e.date, date) < 7).map(e => e.kg)
  return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length, 2) : null
}
/**
 * Estimated weekly weight change (kg/week) using a least-squares line through the last 28 days.
 * Returns null unless there are at least 3 weigh-ins spanning at least 7 days; this is an ESTIMATE.
 */
export function weeklyTrend(w: WeightEntry[], today = todayStr()): number | null {
  const pts = w.filter(e => diffDays(e.date, today) >= 0 && diffDays(e.date, today) <= 28).map(e => ({ x: -diffDays(e.date, today), y: e.kg }))
  if (pts.length < 3) return null
  const xs = pts.map(p => p.x); if (Math.max(...xs) - Math.min(...xs) < 7) return null
  const n = pts.length, sx = xs.reduce((a, b) => a + b, 0), sy = pts.reduce((a, p) => a + p.y, 0)
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0), sxx = xs.reduce((a, b) => a + b * b, 0)
  const den = n * sxx - sx * sx; if (den === 0) return null
  return round(((n * sxy - sx * sy) / den) * 7, 2)
}
export const latestWeight = (w: WeightEntry[]): WeightEntry | null => (w.length ? sortByDate(w)[w.length - 1] : null)
/** Fraction (0..1) of the distance from start to target that has been covered. */
export function goalProgress(start: number, current: number, target: number): number {
  if (start === target) return 1
  return Math.max(0, Math.min(1, (current - start) / (target - start)))
}

/** Epley estimated one-rep max. */
export const e1rm = (weight: number, reps: number) => (reps <= 0 || weight <= 0 ? 0 : round(reps === 1 ? weight : weight * (1 + reps / 30), 1))
export const sessionVolume = (s: WorkoutSession) => s.exercises.reduce((a, e) => a + e.sets.filter(x => x.done).reduce((b, x) => b + x.weight * x.reps, 0), 0)
export const completedSets = (s: WorkoutSession) => s.exercises.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0)
/** Best weight lifted (for completed sets) per exercise in earlier sessions, used to detect personal records. */
export function bestWeights(sessions: WorkoutSession[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sessions) for (const e of s.exercises) for (const x of e.sets) if (x.done && x.weight > (out[e.exerciseId] ?? 0)) out[e.exerciseId] = x.weight
  return out
}
export function findPRs(session: WorkoutSession, previous: WorkoutSession[]): string[] {
  const best = bestWeights(previous); const prs: string[] = []
  for (const e of session.exercises) {
    const max = Math.max(0, ...e.sets.filter(x => x.done).map(x => x.weight))
    if (max > 0 && (best[e.exerciseId] ?? 0) > 0 && max > best[e.exerciseId]) prs.push(e.exerciseId)
  }
  return prs
}

/** Consecutive days (ending today or yesterday) for which `has(date)` is true. */
export function streak(has: (d: string) => boolean, today = todayStr()): number {
  let d = has(today) ? today : addDays(today, -1), n = 0
  while (has(d) && n < 3650) { n++; d = addDays(d, -1) }
  return n
}
export const dateSet = (dates: string[]) => new Set(dates)

/** Which days of the last `days` days have any tracked activity. */
export function activeDays(d: AppData, days: number, today = todayStr()): number {
  const s = new Set<string>([...d.weights.map(x => x.date), ...d.foodLog.map(x => x.date), ...d.sessions.map(x => x.date), ...d.water.map(x => x.date), ...d.sleep.map(x => x.date)])
  let n = 0; for (let i = 0; i < days; i++) if (s.has(addDays(today, -i))) n++
  return n
}
export const pct = (v: number, t: number) => (t > 0 ? Math.max(0, Math.min(100, Math.round((v / t) * 100))) : 0)
export const waterToday = (d: AppData, date = todayStr()) => d.water.filter(w => w.date === date).reduce((a, w) => a + w.ml, 0)

export const fmtWeight = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? `${round(kg, 1)} kg` : `${round(kgToLb(kg), 1)} lb`)
