import { describe, expect, it } from 'vitest'
import { bmr, defaultTargets, e1rm, findPRs, foodMacros, goalProgress, inRange, kgToLb, lbToKg, streak, weeklyAverage, weeklyTrend } from './calc'
import { defaultProfile, emptyData, normalise } from './storage'
import { addDays, addMonths, diffDays, isValidDate, startOfWeek, todayStr, weekday } from './date'
import { occursOn, occurrences } from './recurrence'
import { between, num } from './validate'
import { computeAchievements, longestRun } from './achievements'
import { generatePlan, canDo } from './plans'
import type { CalEvent, WorkoutSession } from '../store/types'

const T = '2026-11-02'
const w = (date: string, kg: number) => ({ id: date, date, kg })
const ev = (o: Partial<CalEvent>): CalEvent => ({ id: 'e', title: 't', date: '2026-11-02', start: '09:00', end: '10:00', kind: 'event', recurrence: 'none', remindMin: null, doneDates: [], ...o })

describe('calories and macros', () => {
  it('Mifflin-St Jeor for a 25y male 170cm 60kg', () => expect(bmr({ sex: 'male', age: 25, heightCm: 170, weightKg: 60 })).toBe(1542.5))
  it('female formula is 166 lower', () => expect(bmr({ sex: 'male', age: 25, heightCm: 170, weightKg: 60 }) - bmr({ sex: 'female', age: 25, heightCm: 170, weightKg: 60 })).toBe(166))
  it('gain target is above maintenance and macros add up', () => {
    const p = { ...defaultProfile(), goal: 'gain' as const }; const g = defaultTargets(p); const m = defaultTargets({ ...p, goal: 'maintain' })
    expect(g.calories).toBeGreaterThan(m.calories)
    expect(Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.calories)).toBeLessThan(40)
  })
  it('never targets under 1200 kcal', () => expect(defaultTargets({ ...defaultProfile(), goal: 'lose', weightKg: 40, heightCm: 140, age: 70, sex: 'female', activity: 'low' }).calories).toBeGreaterThanOrEqual(1200))
  it('scales food per 100 g', () => expect(foodMacros({ kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, 200)).toEqual({ kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 }))
})
describe('weight tracking', () => {
  it('unit conversion round trips', () => expect(lbToKg(kgToLb(62.5))).toBeCloseTo(62.5, 6))
  it('weekly average covers 7 days only', () => expect(weeklyAverage([w('2026-11-02', 60), w('2026-10-30', 62), w('2026-10-20', 90)], T)).toBe(61))
  it('trend needs 3 points over 7 days', () => { expect(weeklyTrend([w('2026-11-02', 60), w('2026-11-01', 60)], T)).toBeNull(); expect(weeklyTrend([w('2026-11-02', 60), w('2026-10-30', 60), w('2026-10-31', 60)], T)).toBeNull() })
  it('trend of +0.5kg/week', () => expect(weeklyTrend([w('2026-10-19', 60), w('2026-10-26', 60.5), w('2026-11-02', 61)], T)).toBe(0.5))
  it('goal progress is clamped 0..1', () => { expect(goalProgress(50, 55, 60)).toBe(0.5); expect(goalProgress(50, 70, 60)).toBe(1); expect(goalProgress(50, 45, 60)).toBe(0) })
  it('range filter', () => { const a = [w('2026-11-02', 1), w('2026-10-20', 2), w('2025-01-01', 3)]; expect(inRange(a, '7d', T)).toHaveLength(1); expect(inRange(a, '3m', T)).toHaveLength(2); expect(inRange(a, 'all', T)).toHaveLength(3) })
})
describe('lifting', () => {
  const mk = (kg: number): WorkoutSession => ({ id: String(kg), date: T, dayName: 'x', startedAt: kg, endedAt: kg, exercises: [{ exerciseId: 'squat', restSec: 60, sets: [{ weight: kg, reps: 5, done: true }] }] })
  it('e1RM', () => { expect(e1rm(100, 1)).toBe(100); expect(e1rm(100, 10)).toBe(133.3) })
  it('detects a PR only when heavier than a previous best', () => { expect(findPRs(mk(60), [mk(50)])).toEqual(['squat']); expect(findPRs(mk(50), [mk(60)])).toEqual([]); expect(findPRs(mk(50), [])).toEqual([]) })
})
describe('dates (Africa/Nairobi plain strings)', () => {
  it('arithmetic across month ends', () => { expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); expect(diffDays('2026-11-01', '2026-11-02')).toBe(1) })
  it('weekday and Monday-first week start', () => { expect(weekday('2026-11-02')).toBe(1); expect(startOfWeek('2026-11-08')).toBe('2026-11-02') })
  it('validation', () => { expect(isValidDate('2026-02-30')).toBe(false); expect(isValidDate('2026-02-28')).toBe(true); expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/) })
})
describe('recurring events', () => {
  it('weekly repeats on the same weekday', () => { const e = ev({ recurrence: 'weekly' }); expect(occursOn(e, '2026-11-09')).toBe(true); expect(occursOn(e, '2026-11-10')).toBe(false); expect(occursOn(e, '2026-10-26')).toBe(false) })
  it('monthly clamps to short months', () => { const e = ev({ date: '2026-01-31', recurrence: 'monthly' }); expect(occursOn(e, '2026-02-28')).toBe(true); expect(occursOn(e, '2026-03-31')).toBe(true) })
  it('respects until and done dates', () => { const e = ev({ recurrence: 'daily', until: '2026-11-04', doneDates: ['2026-11-03'] }); const o = occurrences([e], '2026-11-02', '2026-11-06'); expect(o.map(x => x.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']); expect(o[1].done).toBe(true) })
})
describe('validation', () => {
  it('parses numbers with comma decimals', () => { expect(num('62,5')).toBe(62.5); expect(num('abc')).toBeNull(); expect(num('')).toBeNull() })
  it('range check', () => { expect(between(500, 20, 400)).toBe(false); expect(between(null, 1, 2)).toBe(false) })
})
describe('data model', () => {
  it('normalise fills gaps from older data and rejects junk', () => { const d = normalise({ profile: { name: 'A' }, weights: 5 }); expect(d.weights).toEqual([]); expect(d.profile.units.weight).toBe('kg'); expect(normalise(null).version).toBe(1) })
  it('streak counts consecutive days', () => { const s = new Set(['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-29']); expect(streak(d => s.has(d), T)).toBe(3); expect(longestRun(s)).toBe(3) })
})
describe('achievements only unlock from real data', () => {
  it('fresh data unlocks nothing', () => expect(computeAchievements(emptyData(), T).filter(a => a.unlocked)).toHaveLength(0))
  it('first workout unlocks after a saved session', () => { const d = emptyData(); d.sessions.push({ id: 's', date: T, dayName: 'x', startedAt: 1, endedAt: 2, exercises: [] }); expect(computeAchievements(d, T).find(a => a.id === 'first-workout')!.unlocked).toBe(true) })
  it('7-day nutrition streak', () => { const d = emptyData(); for (let i = 0; i < 7; i++) d.foodLog.push({ id: String(i), date: addDays(T, -i), meal: 'lunch', foodId: 'egg', name: 'egg', grams: 50, kcal: 1, protein: 1, carbs: 1, fat: 1, ts: 1 }); expect(computeAchievements(d, T).find(a => a.id === 'nutrition-7')!.unlocked).toBe(true) })
})
describe('plans', () => {
  it('bodyweight-only users get only bodyweight-capable exercises', () => { const p = generatePlan('ppl', ['bodyweight'], 3); for (const day of p.days) for (const e of day.exercises) expect(canDo(e.exerciseId, ['bodyweight'])).toBe(true); expect(p.days).toHaveLength(3) })
  it('barbell bench press needs a bench', () => { expect(canDo('bench-press', ['barbell'])).toBe(false); expect(canDo('bench-press', ['barbell', 'bench'])).toBe(true) })
})
