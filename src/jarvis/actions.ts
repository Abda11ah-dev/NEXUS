import type { ActionPayload, AppData, MealType, Proposal } from '../store/types'
import { uid } from '../lib/id'
import { isValidDate, isValidTime, fmtDate } from '../lib/date'
import { foodById } from '../data/foods'
import { LIMITS, between, num } from '../lib/validate'

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** Human-readable preview shown BEFORE anything is changed. */
export function describeAction(a: ActionPayload, d: AppData): string {
  switch (a.type) {
    case 'log_weight': return `Log body weight: ${a.kg} kg${a.date ? ' on ' + fmtDate(a.date) : ' for today'}`
    case 'log_water': return `Log ${a.ml} ml of water`
    case 'add_task': return `Add task "${a.title}"${a.due ? ` (due ${fmtDate(a.due)})` : ''}`
    case 'add_event': return `Add calendar ${a.kind ?? 'event'} "${a.title}" on ${fmtDate(a.date)}, ${a.start}${a.end ? '–' + a.end : ''}`
    case 'log_meal': return `Log ${a.grams} g ${foodById(a.foodId, d.customFoods)?.name ?? 'food'} as ${a.meal}`
    case 'log_meal_items': return `Log ${a.label} as ${a.meal}: ${a.items.map(i => `${i.grams} g ${foodById(i.foodId, d.customFoods)?.name ?? 'food'}`).join(', ')}`
    case 'create_plan': return `Create a new "${a.style}" workout plan from your profile (you can edit it afterwards)`
    case 'set_targets': return `Change your daily targets: ${[a.calories && `${a.calories} kcal`, a.protein && `${a.protein} g protein`, a.carbs && `${a.carbs} g carbs`, a.fat && `${a.fat} g fat`].filter(Boolean).join(', ')}`
  }
}
export const makeProposal = (action: ActionPayload, d: AppData): Proposal => ({ id: uid('prop'), action, summary: describeAction(action, d), status: 'pending' })

/** Validate an action coming from an AI model. Anything malformed is rejected, never executed. */
export function validateAction(raw: unknown, d: AppData): ActionPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  switch (r.type) {
    case 'log_weight': { const kg = num(r.kg); return between(kg, ...LIMITS.weightKg) ? { type: 'log_weight', kg, date: typeof r.date === 'string' && isValidDate(r.date) ? r.date : undefined } : null }
    case 'log_water': { const ml = num(r.ml); return between(ml, ...LIMITS.waterMl) ? { type: 'log_water', ml } : null }
    case 'add_task': return typeof r.title === 'string' && r.title.trim() ? { type: 'add_task', title: r.title.trim().slice(0, 140), priority: (['low', 'medium', 'high'] as const).find(p => p === r.priority), due: typeof r.due === 'string' && isValidDate(r.due) ? r.due : undefined } : null
    case 'add_event': return typeof r.title === 'string' && typeof r.date === 'string' && isValidDate(r.date) && typeof r.start === 'string' && isValidTime(r.start)
      ? { type: 'add_event', title: r.title.trim().slice(0, 140), date: r.date, start: r.start, end: typeof r.end === 'string' && isValidTime(r.end) ? r.end : undefined, kind: (['event', 'workout', 'meal', 'reminder'] as const).find(k => k === r.kind) } : null
    case 'log_meal': { const g = num(r.grams); return typeof r.foodId === 'string' && foodById(r.foodId, d.customFoods) && between(g, ...LIMITS.grams) && MEALS.includes(r.meal as MealType) ? { type: 'log_meal', foodId: r.foodId, grams: g, meal: r.meal as MealType } : null }
    case 'create_plan': return (['fullbody', 'upperlower', 'ppl'] as const).includes(r.style as 'ppl') ? { type: 'create_plan', style: r.style as 'ppl' } : null
    case 'set_targets': { const c = num(r.calories), p = num(r.protein); if (c !== null && !between(c, ...LIMITS.kcal)) return null; if (p !== null && !between(p, 0, 600)) return null; return c !== null || p !== null ? { type: 'set_targets', calories: c ?? undefined, protein: p ?? undefined } : null }
    default: return null
  }
}
/** Pull ```nexus-action {...}``` blocks out of a model reply. Returns the clean text and the valid proposals. */
export function extractProposals(text: string, d: AppData): { text: string; proposals: Proposal[] } {
  const proposals: Proposal[] = []
  const clean = text.replace(/```nexus-action\s*([\s\S]*?)```/g, (_m, body: string) => {
    try { const a = validateAction(JSON.parse(body), d); if (a && proposals.length < 3) proposals.push(makeProposal(a, d)) } catch { /* ignore malformed block */ }
    return ''
  }).trim()
  return { text: clean, proposals }
}
