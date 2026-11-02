// Input validation shared by forms and by Jarvis actions, so bad data never reaches storage.
export const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.trim().replace(',', '.')); return v.trim() !== '' && Number.isFinite(n) ? n : null
}
export const between = (n: number | null, lo: number, hi: number): n is number => n !== null && n >= lo && n <= hi
export const LIMITS = { weightKg: [20, 400], heightCm: [100, 250], age: [10, 100], girthCm: [10, 250], grams: [1, 5000], waterMl: [10, 5000], kcal: [800, 8000], sleepH: [0, 24] } as const
export const err = (cond: boolean, msg: string): string | null => (cond ? null : msg)
