import type { AppData } from '../store/types'
import { addDays, diffDays, todayStr } from './date'
import { sortByDate } from './calc'

export interface Achievement { id: string; title: string; desc: string; unlocked: boolean; progress: string }

/** Best run of consecutive dates in a set. */
export function longestRun(dates: Set<string>): number {
  let best = 0; for (const d of dates) { if (dates.has(addDays(d, -1))) continue; let n = 0, c = d; while (dates.has(c)) { n++; c = addDays(c, 1) } best = Math.max(best, n) }
  return best
}
/** Achievements are computed from REAL logged data only; opening a screen never unlocks anything. */
export function computeAchievements(d: AppData, today = todayStr()): Achievement[] {
  const sessions = [...d.sessions].sort((a, b) => a.startedAt - b.startedAt)
  const trackedDates = new Set<string>([...d.weights.map(x => x.date), ...d.foodLog.map(x => x.date), ...sessions.map(x => x.date), ...d.water.map(x => x.date), ...d.sleep.map(x => x.date)])
  const sorted = [...trackedDates].sort(); let weekOk = false
  for (const s of sorted) { let n = 0; for (let i = 0; i < 7; i++) if (trackedDates.has(addDays(s, i))) n++; if (n >= 5) { weekOk = true; break } }
  const foodRun = longestRun(new Set(d.foodLog.map(e => e.date)))
  const w = sortByDate(d.weights); const start = w[0]?.kg, goalDir = Math.sign(d.profile.targetKg - (start ?? d.profile.weightKg))
  const moved = start !== undefined && w.length > 1 ? (w[w.length - 1].kg - start) * goalDir : 0
  let pr = false; const best: Record<string, number> = {}
  for (const s of sessions) for (const e of s.exercises) { const m = Math.max(0, ...e.sets.filter(x => x.done).map(x => x.weight)); if (m > 0) { if (best[e.exerciseId] !== undefined && m > best[e.exerciseId]) pr = true; best[e.exerciseId] = Math.max(best[e.exerciseId] ?? 0, m) } }
  let month = 0; for (const s of sessions) month = Math.max(month, sessions.filter(x => diffDays(s.date, x.date) >= 0 && diffDays(s.date, x.date) < 30).length)
  const A = (id: string, title: string, desc: string, unlocked: boolean, progress: string): Achievement => ({ id, title, desc, unlocked, progress })
  return [
    A('first-workout', 'First workout', 'Complete and save one workout.', sessions.length >= 1, `${Math.min(1, sessions.length)}/1`),
    A('first-week', 'First consistent week', 'Track something on at least 5 days within one week.', weekOk, weekOk ? '5/5 days' : `${Math.min(5, activeIn7(trackedDates, today))}/5 days this week`),
    A('weight-1kg', 'First weight milestone', 'Move 1 kg toward your target weight.', moved >= 1, `${Math.max(0, Math.round(moved * 10) / 10)}/1 kg`),
    A('nutrition-7', '7-day nutrition streak', 'Log food 7 days in a row.', foodRun >= 7, `${Math.min(7, foodRun)}/7 days`),
    A('pr', 'Personal lifting record', 'Lift more weight than your previous best on an exercise.', pr, pr ? 'Done' : 'Beat a previous best'),
    A('month', 'Monthly consistency', 'Complete 8 workouts within 30 days.', month >= 8, `${Math.min(8, month)}/8 workouts`),
    A('hydration', 'Hydration goal', 'Hit your daily water target once.', d.water.some(x => d.water.filter(y => y.date === x.date).reduce((n, y) => n + y.ml, 0) >= d.targets.waterMl), 'Reach your water target')
  ]
}
const activeIn7 = (s: Set<string>, today: string) => { let n = 0; for (let i = 0; i < 7; i++) if (s.has(addDays(today, -i))) n++; return n }
