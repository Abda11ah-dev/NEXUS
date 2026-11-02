import { describe, expect, it } from 'vitest'
import { demoRespond } from './demo'
import { emptyData } from '../lib/storage'
import { extractProposals, validateAction } from './actions'
import { buildContext } from './context'
import { addDays, todayStr } from '../lib/date'
import type { AppData, JarvisMemory } from '../store/types'

const base = (): AppData => { const d = emptyData(); d.profile = { ...d.profile, onboarded: true, name: 'Abdi', weightKg: 55, targetKg: 62, goal: 'gain' }; return d }
const T = todayStr()
describe('Jarvis demo engine', () => {
  it('gives different answers to different questions', () => {
    const d = base(); const a = demoRespond('Explain progressive overload', d, {}, 0).text, b = demoRespond('how much protein do I need', d, {}, 1).text
    expect(a).not.toEqual(b); expect(a.toLowerCase()).toContain('overload')
  })
  it('logging weight produces a PROPOSAL, never a silent change', () => {
    const r = demoRespond('log my weight 57.5kg', base(), {}, 0); expect(r.proposals?.[0].action).toEqual({ type: 'log_weight', kg: 57.5 }); expect(r.proposals?.[0].status).toBe('pending')
  })
  it('asks a follow-up when the number is missing, then resolves it next message', () => {
    const d = base(); const r1 = demoRespond('log my weight', d, {}, 0); expect(r1.memory.awaiting?.type).toBe('weight'); expect(r1.proposals).toBeUndefined()
    const r2 = demoRespond('58', d, r1.memory, 1); expect(r2.proposals?.[0].action).toMatchObject({ type: 'log_weight', kg: 58 }); expect(r2.memory.awaiting).toBeUndefined()
  })
  it('rejects absurd weights', () => { const r = demoRespond('log my weight 900', base(), {}, 0); expect(r.proposals).toBeUndefined() })
  it('follow-up: breakfast after a weight-gain discussion, then "add that to my schedule"', () => {
    const d = base(); for (let i = 0; i < 4; i++) d.weights.push({ id: 'w' + i, date: addDays(T, -i * 7), kg: 55 - i * 0.2 })
    const r1 = demoRespond('Why am I not gaining weight?', d, {}, 0); expect(r1.memory.topic).toBe('gain')
    const r2 = demoRespond('What about increasing my breakfast?', d, r1.memory, 1); expect(r2.text.toLowerCase()).toContain('breakfast'); expect(r2.memory.suggestion?.kind).toBe('meal')
    const r3 = demoRespond('add that to my schedule at 7am', d, r2.memory, 2); const a = r3.proposals![0].action
    expect(a.type).toBe('add_event'); if (a.type === 'add_event') { expect(a.start).toBe('07:00'); expect(a.title).toContain('breakfast') }
    expect(r3.proposals![0].status).toBe('pending')
  })
  it('"log that" turns the suggested meal into a confirmable meal log', () => {
    const d = base(); const r2 = demoRespond('help me increase my daily calories', d, {}, 0); const r3 = demoRespond('log that', d, r2.memory, 1)
    expect(r3.proposals![0].action.type).toBe('log_meal_items')
  })
  it('parses meals: "I ate 200g rice for lunch"', () => { const a = demoRespond('I ate 200g rice for lunch', base(), {}, 0).proposals![0].action; expect(a).toMatchObject({ type: 'log_meal', foodId: 'rice-cooked', grams: 200, meal: 'lunch' }) })
  it('uses real data when sharing is on, and refuses to peek when it is off', () => {
    const d = base(); d.weights.push({ id: 'a', date: T, kg: 56 }, { id: 'b', date: addDays(T, -3), kg: 55 })
    expect(demoRespond('analyse my weight progress', d, {}, 0).text).toContain('56'); d.settings.jarvisShareData = false
    expect(demoRespond('analyse my weight progress', d, {}, 0).text).toContain('switched off'); expect(buildContext(d)).toBeNull()
  })
  it('is honest when it does not understand', () => { const t = demoRespond('what is the capital of Peru', base(), {} as JarvisMemory, 0).text; expect(t.toLowerCase()).toContain('demo mode'); expect(t.toLowerCase()).toContain('not a live ai') })
})
describe('AI action validation', () => {
  const d = base()
  it('accepts valid and rejects malformed or dangerous actions', () => {
    expect(validateAction({ type: 'log_weight', kg: 60 }, d)).not.toBeNull(); expect(validateAction({ type: 'log_weight', kg: 6000 }, d)).toBeNull()
    expect(validateAction({ type: 'delete_everything' }, d)).toBeNull(); expect(validateAction({ type: 'log_meal', foodId: 'nope', grams: 100, meal: 'lunch' }, d)).toBeNull()
    expect(validateAction({ type: 'add_event', title: 'x', date: '2026-02-30', start: '09:00' }, d)).toBeNull()
  })
  it('extracts action blocks from model text as pending proposals', () => {
    const r = extractProposals('Sure.\n```nexus-action\n{"type":"log_water","ml":500}\n```\nThen drink more.', d); expect(r.proposals).toHaveLength(1); expect(r.proposals[0].status).toBe('pending'); expect(r.text).not.toContain('nexus-action')
    expect(extractProposals('```nexus-action\n{bad json}\n```', d).proposals).toHaveLength(0)
  })
})
