import type { AppData } from '../store/types'
import { addDays, diffDays, nowTime, todayStr, weekday } from '../lib/date'
import { dayTotals, latestWeight, round, sortByDate, waterToday, weeklyAverage, weeklyTrend } from '../lib/calc'
import { exerciseById } from '../data/exercises'
import { occurrences } from '../lib/recurrence'

export interface JarvisContext {
  today: string; time: string; name: string; goal: string; units: string; heightCm: number; age: number; equipment: string[]
  weightKg: number | null; targetKg: number; weightsRecent: { date: string; kg: number }[]; weeklyAvgKg: number | null; trendKgPerWeek: number | null
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number }
  todayIntake: { kcal: number; protein: number; carbs: number; fat: number; waterMl: number }
  intake7: { daysLogged: number; avgKcal: number; avgProtein: number } | null
  breakfastAvgKcal: number | null
  sessionsLast7: number; sessionsLast30: number; lastSession: { date: string; day: string } | null
  todayWorkout: { plan: string; day: string; exercises: string[]; done: boolean } | null
  sleepAvg7: number | null
  openTasks: string[]; eventsToday: { title: string; start: string }[]
}
/** Snapshot of the user's data that Jarvis may see. Returns null when the user has switched sharing off. */
export function buildContext(d: AppData): JarvisContext | null {
  if (!d.settings.jarvisShareData) return null
  const today = todayStr(), w = sortByDate(d.weights), lw = latestWeight(d.weights)
  const t = dayTotals(d.foodLog, today)
  const days = new Set<string>(); for (let i = 1; i <= 7; i++) if (d.foodLog.some(e => e.date === addDays(today, -i))) days.add(addDays(today, -i))
  let intake7 = null as JarvisContext['intake7']
  if (days.size) { const es = d.foodLog.filter(e => days.has(e.date)); intake7 = { daysLogged: days.size, avgKcal: Math.round(es.reduce((a, e) => a + e.kcal, 0) / days.size), avgProtein: Math.round(es.reduce((a, e) => a + e.protein, 0) / days.size) } }
  const bf = d.foodLog.filter(e => e.meal === 'breakfast' && diffDays(e.date, today) <= 14 && diffDays(e.date, today) >= 1); const bfDays = new Set(bf.map(e => e.date))
  const plan = d.plans.find(p => p.id === d.activePlanId); const dow = weekday(today); const pd = plan?.days.find(x => x.weekday === dow)
  const sorted = [...d.sessions].sort((a, b) => b.startedAt - a.startedAt)
  const sl = d.sleep.filter(s => diffDays(s.date, today) >= 0 && diffDays(s.date, today) < 7)
  return {
    today, time: nowTime(), name: d.profile.name, goal: d.profile.goal, units: `${d.profile.units.weight}/${d.profile.units.length}`, heightCm: d.profile.heightCm, age: d.profile.age, equipment: d.profile.equipment,
    weightKg: lw?.kg ?? null, targetKg: d.profile.targetKg, weightsRecent: w.slice(-14).map(x => ({ date: x.date, kg: x.kg })), weeklyAvgKg: weeklyAverage(d.weights), trendKgPerWeek: weeklyTrend(d.weights),
    targets: { calories: d.targets.calories, protein: d.targets.protein, carbs: d.targets.carbs, fat: d.targets.fat, waterMl: d.targets.waterMl },
    todayIntake: { ...t, waterMl: waterToday(d) }, intake7, breakfastAvgKcal: bfDays.size ? Math.round(bf.reduce((a, e) => a + e.kcal, 0) / bfDays.size) : null,
    sessionsLast7: d.sessions.filter(s => diffDays(s.date, today) < 7 && diffDays(s.date, today) >= 0).length, sessionsLast30: d.sessions.filter(s => diffDays(s.date, today) < 30 && diffDays(s.date, today) >= 0).length,
    lastSession: sorted[0] ? { date: sorted[0].date, day: sorted[0].dayName } : null,
    todayWorkout: plan && pd ? { plan: plan.name, day: pd.name, exercises: pd.exercises.map(e => exerciseById(e.exerciseId)?.name ?? e.exerciseId), done: d.sessions.some(s => s.date === today && s.dayName === pd.name) } : null,
    sleepAvg7: sl.length ? round(sl.reduce((a, s) => a + s.hours, 0) / sl.length, 1) : null,
    openTasks: d.tasks.filter(x => !x.done).slice(0, 8).map(x => x.title),
    eventsToday: occurrences(d.events, today, today).map(o => ({ title: o.event.title, start: o.event.start }))
  }
}
/** Suggested prompts that depend on what the user has (or hasn't) tracked. */
export function suggestedPrompts(d: AppData): string[] {
  const c = buildContext({ ...d, settings: { ...d.settings, jarvisShareData: true } })!; const out: string[] = []
  if (!c.weightsRecent.length || diffDays(c.weightsRecent[c.weightsRecent.length - 1].date, c.today) > 6) out.push('Log my weight')
  else out.push('Analyse my weight progress')
  if (c.intake7 && c.intake7.avgKcal < c.targets.calories * 0.9 && c.goal === 'gain') out.push('Help me increase my daily calories')
  if (c.goal === 'gain' && c.trendKgPerWeek !== null && c.trendKgPerWeek < 0.1) out.push('Why am I not gaining weight?')
  if (c.todayWorkout && !c.todayWorkout.done) out.push("Build today's workout")
  if (c.todayIntake.kcal === 0) out.push('What should I eat today?'); else out.push('Review my nutrition')
  if (c.sessionsLast30 > 0) out.push('Explain my training progress')
  if (c.todayIntake.waterMl < c.targets.waterMl * 0.4) out.push('Log 500 ml of water')
  return out.slice(0, 5)
}
