import type { CalEvent } from '../store/types'
import { addDays, daysInMonth, diffDays, weekday } from './date'

/** Does a (possibly repeating) event happen on `date`? */
export function occursOn(e: CalEvent, date: string): boolean {
  if (date < e.date) return false
  if (e.until && date > e.until) return false
  switch (e.recurrence) {
    case 'none': return date === e.date
    case 'daily': return true
    case 'weekly': return diffDays(e.date, date) % 7 === 0
    case 'monthly': {
      const day = Number(e.date.slice(8, 10)); const [y, m] = date.split('-').map(Number)
      return Number(date.slice(8, 10)) === Math.min(day, daysInMonth(y, m - 1))
    }
  }
}
export interface Occurrence { event: CalEvent; date: string; done: boolean }
export function occurrences(events: CalEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  for (let d = from, i = 0; d <= to && i < 800; d = addDays(d, 1), i++)
    for (const e of events) if (occursOn(e, d)) out.push({ event: e, date: d, done: e.doneDates.includes(d) })
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.event.start.localeCompare(b.event.start))
}
export const weekdayOf = weekday
