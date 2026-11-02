import type { Equipment, PlanDay, PlanExercise, PlanStyle, WorkoutPlan } from '../store/types'
import { EXERCISES } from '../data/exercises'
import { uid } from './id'

/** Does the user have the kit for this exercise? Exercises listing several options need at least one. */
export const canDo = (exerciseId: string, have: Equipment[]): boolean => {
  const ex = EXERCISES.find(e => e.id === exerciseId); if (!ex) return false
  const kit = new Set<Equipment>([...have, 'bodyweight'])
  // Bench + dumbbells style exercises need every non-bodyweight item that is listed together with a bench
  const needsBench = ex.equipment.includes('bench') && !ex.equipment.includes('bodyweight')
  if (needsBench && !kit.has('bench')) return false
  return ex.equipment.some(q => q !== 'bench' && kit.has(q))
}
const pick = (ids: string[], have: Equipment[], n: number): PlanExercise[] => {
  const ok = ids.filter(i => canDo(i, have))
  const list = (ok.length ? ok : ids.filter(i => canDo(i, ['bodyweight']))).slice(0, n)
  return list.map(exerciseId => ({ exerciseId, sets: 3, reps: '8-12', restSec: 90 }))
}
const PUSH = ['bench-press', 'db-bench-press', 'incline-db-press', 'pushup', 'overhead-press', 'lateral-raise', 'triceps-pushdown', 'overhead-triceps-ext', 'bench-dip']
const PULL = ['pullup', 'lat-pulldown', 'barbell-row', 'db-row', 'rear-delt-fly', 'barbell-curl', 'db-curl', 'hammer-curl', 'face-pull']
const LEGS = ['squat', 'goblet-squat', 'bodyweight-squat', 'lunge', 'rdl', 'hip-thrust', 'glute-bridge', 'calf-raise', 'leg-curl']
const UPPER = ['bench-press', 'db-bench-press', 'pushup', 'barbell-row', 'db-row', 'pullup', 'overhead-press', 'lateral-raise', 'db-curl', 'overhead-triceps-ext', 'triceps-pushdown']
const CORE = ['plank', 'crunch', 'side-plank']

/** Weekdays (0 = Sunday) for N training days a week. */
export const scheduleDays = (n: number): number[] =>
  ({ 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] } as Record<number, number[]>)[Math.max(1, Math.min(7, n))]

export function generatePlan(style: PlanStyle, have: Equipment[], daysPerWeek = 3): WorkoutPlan {
  const day = (name: string, ex: PlanExercise[], weekday: number | null): PlanDay => ({ id: uid('day'), name, weekday, exercises: ex })
  const wd = scheduleDays(daysPerWeek)
  let days: PlanDay[] = []
  if (style === 'ppl') {
    const kinds = ['Push', 'Pull', 'Legs']
    days = wd.map((w, i) => { const k = kinds[i % 3]; const ids = k === 'Push' ? PUSH : k === 'Pull' ? PULL : LEGS; return day(k, pick(ids, have, 5), w) })
  } else if (style === 'upperlower') {
    days = wd.map((w, i) => i % 2 === 0 ? day('Upper', pick(UPPER, have, 6), w) : day('Lower', pick(LEGS, have, 5), w))
  } else if (style === 'fullbody') {
    days = wd.map((w, i) => day(`Full body ${String.fromCharCode(65 + (i % 3))}`, [...pick(i % 2 ? [...PULL, ...PUSH] : [...PUSH, ...PULL], have, 3), ...pick(LEGS, have, 2), ...pick(CORE, have, 1)], w))
  } else days = [day('Day 1', [], wd[0] ?? 1)]
  const label = { fullbody: 'Full body', upperlower: 'Upper / lower', ppl: 'Push / pull / legs', custom: 'Custom plan' }[style]
  return { id: uid('plan'), name: label, style, days }
}
export const recommendedStyle = (days: number): PlanStyle => (days <= 3 ? 'fullbody' : days === 4 ? 'upperlower' : 'ppl')
