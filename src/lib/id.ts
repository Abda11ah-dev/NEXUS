/** Short unique id. Uses crypto when available so ids never collide across devices. */
export const uid = (prefix = ''): string => {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 14) : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
  return prefix ? `${prefix}_${r}` : r
}
