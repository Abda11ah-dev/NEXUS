import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'

export const nav = (path: string) => { window.location.hash = path }

export function Card({ children, className = '', onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  return onClick
    ? <button className={`card clickable ${className}`} onClick={onClick} aria-label={label}>{children}</button>
    : <section className={`card ${className}`}>{children}</section>
}
export const Eyebrow = ({ children }: { children: ReactNode }) => <div className="eyebrow">{children}</div>
export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <header className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{action}</header>
}
export function Stat({ label, value, unit, sub, to, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; to?: string; tone?: 'good' | 'warn' }) {
  const inner = <><div className="eyebrow">{label}</div><div className="stat-value">{value}{unit && <small>{unit}</small>}</div>{sub && <div className={`stat-sub ${tone ?? ''}`}>{sub}</div>}</>
  return to ? <button className="card stat clickable" onClick={() => nav(to)}>{inner}</button> : <div className="card stat">{inner}</div>
}
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return <div className="empty">{icon}<b>{title}</b>{text && <p>{text}</p>}{action}</div>
}
export function Progress({ value, tone }: { value: number; tone?: 'warn' }) {
  return <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><span className={tone} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return <div className="tabs" role="tablist">{items.map(i => <button key={i.id} role="tab" aria-selected={value === i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)}>{i.label}</button>)}</div>
}
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <small className="err" role="alert">{error}</small>}</label>
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k); document.body.classList.add('modal-open'); ref.current?.focus()
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('modal-open') }
  }, [onClose])
  return <div className="backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <div className="modal-body">{children}</div>
    </div></div>
}
export function Confirm({ title, text, confirmLabel = 'Delete', onYes, onNo }: { title: string; text: string; confirmLabel?: string; onYes: () => void; onNo: () => void }) {
  return <Modal title={title} onClose={onNo}><p className="muted">{text}</p><div className="row end"><button className="btn ghost" onClick={onNo}>Cancel</button><button className="btn danger" onClick={onYes}>{confirmLabel}</button></div></Modal>
}

// ---- Toasts ----
type Toast = { id: number; text: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random(); setList(l => [...l.slice(-2), { id, text, kind }]); setTimeout(() => setList(l => l.filter(t => t.id !== id)), kind === 'err' ? 5000 : 2600)
  }, [])
  return <ToastCtx.Provider value={push}>{children}<div className="toasts" aria-live="polite">{list.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{t.text}</div>)}</div></ToastCtx.Provider>
}

/** Small SVG sparkline/area chart without extra dependencies (used on Home). */
export function Spark({ values, color = '#35d6ff', height = 44 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1, w = 160
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 4 - ((v - min) / span) * (height - 8)}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${height}`} className="spark" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}
export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: ReactNode }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value))
  return <div className="ring" style={{ width: size, height: size }}><svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" /><circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg><span>{label ?? `${Math.round(v)}%`}</span></div>
}
