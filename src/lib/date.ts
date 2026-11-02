// Date helpers. NEXUS stores calendar dates as plain "YYYY-MM-DD" strings and times as "HH:mm"
// in the Africa/Nairobi timezone, so we never have to do risky timezone maths on stored data.
export const TZ = 'Africa/Nairobi'

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

/** Today's date in Nairobi, e.g. "2026-11-01". */
export const todayStr = (now: Date = new Date()): string => dateFmt.format(now)
/** Current clock time in Nairobi, e.g. "14:05". */
export const nowTime = (now: Date = new Date()): string => timeFmt.format(now).replace('24:', '00:')

const toUtc = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fromUtc = (d: Date): string => d.toISOString().slice(0, 10)

export const addDays = (s: string, n: number): string => { const d = toUtc(s); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d) }
export const addMonths = (s: string, n: number): string => {
  const d = toUtc(s); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n)
  const max = daysInMonth(d.getUTCFullYear(), d.getUTCMonth()); d.setUTCDate(Math.min(day, max)); return fromUtc(d)
}
export const daysInMonth = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()
/** 0 = Sunday ... 6 = Saturday */
export const weekday = (s: string): number => toUtc(s).getUTCDay()
export const diffDays = (a: string, b: string): number => Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000)
export const startOfWeek = (s: string): string => addDays(s, -((weekday(s) + 6) % 7)) // Monday-first weeks
export const monthKey = (s: string): string => s.slice(0, 7)
export const isValidDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s
export const isValidTime = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
export const timeToMin = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const minToTime = (m: number): string => { const c = Math.max(0, Math.min(1439, m)); return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}` }

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(toUtc(s))
export const fmtLong = (s: string): string => fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long' })
export const relativeDay = (s: string, today = todayStr()): string => {
  const d = diffDays(today, s)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return fmtDate(s)
}
export const fmtTs = (ts: number): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
/** Date string of a millisecond timestamp, in Nairobi time. */
export const dateOfTs = (ts: number): string => dateFmt.format(new Date(ts))
