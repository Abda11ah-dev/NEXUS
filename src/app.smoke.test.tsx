// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import App from './App'
import { emptyData, STORAGE_KEY } from './lib/storage'
import { generatePlan } from './lib/plans'
import { addDays, todayStr } from './lib/date'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) })
  window.scrollTo = () => {}; Element.prototype.scrollTo = () => {}
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch
  class RO { observe() {} disconnect() {} unobserve() {} } ; (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
})
afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = '' })

const seed = () => {
  const d = emptyData(); const T = todayStr()
  d.profile = { ...d.profile, onboarded: true, name: 'Tester', weightKg: 56, targetKg: 63, heightCm: 172, age: 24, equipment: ['bodyweight', 'dumbbells', 'bench'] }
  d.weights = [0, 5, 10].map((n, i) => ({ id: 'w' + i, date: addDays(T, -n), kg: 56 - i * 0.4 }))
  const p = generatePlan('ppl', d.profile.equipment, 3); for (const x of p.days) x.weekday = new Date().getDay(); d.plans = [p]; d.activePlanId = p.id
  d.foodLog = [{ id: 'f1', date: T, meal: 'breakfast', foodId: 'egg', name: 'Egg', grams: 100, kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6, ts: 1 }]
  d.events = [{ id: 'e1', title: 'Gym', date: T, start: '17:00', end: '18:00', kind: 'workout', recurrence: 'weekly', remindMin: 15, doneDates: [] }]
  d.tasks = [{ id: 't1', title: 'Buy eggs', done: false, priority: 'high', createdAt: 1 }]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
}
describe('app smoke', () => {
  it('shows onboarding for a new user and blocks bad input', async () => {
    render(<App />); expect(screen.getByText('Tell us about you')).toBeTruthy()
    fireEvent.click(screen.getByText('Continue')); expect(screen.getByRole('alert').textContent).toMatch(/name/i)
  })
  for (const page of ['', 'body', 'workouts', 'nutrition', 'progress', 'calendar', 'jarvis', 'settings']) {
    it(`renders /${page} with real data without crashing`, async () => {
      seed(); window.location.hash = '/' + page; render(<App />)
      await waitFor(() => expect(document.querySelector('.content')).toBeTruthy())
      await act(async () => { await new Promise(r => setTimeout(r, 400)) })
      expect(screen.queryByText(/Something went wrong/)).toBeNull(); expect((document.querySelector('.content')?.textContent ?? '').length).toBeGreaterThan(20)
    })
  }
  it('Jarvis: send a message, get a demo reply, approve an action that changes real data', async () => {
    seed(); window.location.hash = '/jarvis'; render(<App />)
    const box = await screen.findByLabelText('Message Jarvis'); fireEvent.change(box, { target: { value: 'log my weight 57.2kg' } }); fireEvent.click(screen.getByLabelText('Send'))
    await screen.findByRole('button', { name: /Approve/ }, { timeout: 3000 }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights.some((w: { kg: number }) => w.kg === 57.2)).toBe(false) // nothing saved before approval
    fireEvent.click(screen.getByRole('button', { name: /Approve/ })); await waitFor(() => expect(screen.getByText(/Done:/)).toBeTruthy())
    await act(async () => { await new Promise(r => setTimeout(r, 400)) }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights.some((w: { kg: number }) => w.kg === 57.2)).toBe(true)
  })
  it('Progress: add weight validates, saves and persists', async () => {
    seed(); window.location.hash = '/progress'; render(<App />)
    fireEvent.click(await screen.findByText('Log weight')); const input = screen.getByPlaceholderText('e.g. 62.4')
    fireEvent.change(input, { target: { value: '5' } }); fireEvent.click(screen.getByText('Save')); expect(screen.getByRole('alert').textContent).toMatch(/between 20 and 400/)
    fireEvent.change(input, { target: { value: '58.1' } }); fireEvent.click(screen.getByText('Save'))
    await act(async () => { await new Promise(r => setTimeout(r, 450)) }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).weights.some((w: { kg: number }) => w.kg === 58.1)).toBe(true)
  })
  it('Workouts: start session, complete a set, finish and save history', async () => {
    seed(); window.location.hash = '/workouts'; render(<App />)
    fireEvent.click(await screen.findByText('Start workout')); const done = await screen.findAllByLabelText(/Mark set 1 done/); fireEvent.click(done[0])
    fireEvent.click(screen.getByText('Finish workout')); await screen.findByText('Workout saved')
    await act(async () => { await new Promise(r => setTimeout(r, 450)) }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions).toHaveLength(1)
  })
  it('Nutrition: search food, add, totals update', async () => {
    seed(); window.location.hash = '/nutrition'; render(<App />)
    fireEvent.click((await screen.findAllByText('Add food'))[1]); fireEvent.change(screen.getByLabelText('Search foods'), { target: { value: 'ugali' } }); fireEvent.click(await screen.findByText(/Ugali \(maize meal, cooked\)/))
    fireEvent.click(screen.getByText(/Add to lunch/)); await act(async () => { await new Promise(r => setTimeout(r, 450)) })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).foodLog.some((e: { foodId: string }) => e.foodId === 'ugali')).toBe(true)
  })
  it('Calendar: create an event and see it listed', async () => {
    seed(); window.location.hash = '/calendar'; render(<App />)
    fireEvent.click((await screen.findAllByText('Event'))[0].closest('button')!); fireEvent.change(screen.getByPlaceholderText('e.g. Upper-body session'), { target: { value: 'Leg day' } }); fireEvent.click(screen.getByText('Save'))
    await act(async () => { await new Promise(r => setTimeout(r, 450)) }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).events.some((e: { title: string }) => e.title === 'Leg day')).toBe(true)
  })
})
