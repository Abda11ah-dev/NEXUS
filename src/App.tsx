import * as React from 'react'
import { Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Activity, BrainCircuit, CalendarDays, Dumbbell, Home as HomeIcon, MoreHorizontal, ScanLine, Settings as SettingsIcon, Utensils, WifiOff, X, Zap } from 'lucide-react'
import { StoreProvider, useActions, useData, useStore } from './store/store'
import { ToastProvider, nav, useToast } from './components/ui'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import { occurrences } from './lib/recurrence'
import { nowTime, timeToMin, todayStr } from './lib/date'

const pages = { body: lazy(() => import('./pages/Body')), workouts: lazy(() => import('./pages/Workouts')), nutrition: lazy(() => import('./pages/Nutrition')), progress: lazy(() => import('./pages/Progress')), calendar: lazy(() => import('./pages/Calendar')), jarvis: lazy(() => import('./pages/Jarvis')), settings: lazy(() => import('./pages/Settings')) } as Record<string, React.LazyExoticComponent<ComponentType>>
const NAV = [{ id: 'home', label: 'Home', icon: HomeIcon }, { id: 'body', label: 'Body', icon: ScanLine }, { id: 'workouts', label: 'Workouts', icon: Dumbbell }, { id: 'nutrition', label: 'Nutrition', icon: Utensils }, { id: 'progress', label: 'Progress', icon: Activity }, { id: 'calendar', label: 'Calendar', icon: CalendarDays }, { id: 'jarvis', label: 'Jarvis', icon: BrainCircuit }, { id: 'settings', label: 'Settings', icon: SettingsIcon }]
const PRIMARY = ['home', 'body', 'workouts', 'nutrition', 'jarvis']
const route = () => { const h = window.location.hash.replace(/^#\/?/, '').split('?')[0]; return NAV.some(n => n.id === h) ? h : 'home' }

class Boundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() { return this.state.err ? <div className="card" style={{ margin: 16 }}><h2>Something went wrong on this screen</h2><p className="muted" style={{ margin: '6px 0 12px' }}>Your data is safe. {this.state.err.message}</p><button className="btn primary" onClick={() => { this.setState({ err: null }); nav('/') }}>Back to Home</button></div> : this.props.children }
}

function Reminders() {
  const d = useData(); const a = useActions(); const toast = useToast(); const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (!d.settings.remindersEnabled || d.settings.busyMode) return
    const today = todayStr(), now = timeToMin(nowTime())
    for (const o of occurrences(d.events, today, today)) {
      const e = o.event; if (e.remindMin === null || o.done) continue
      const key = `${e.id}:${today}`; const start = timeToMin(e.start), fire = start - e.remindMin
      if (now >= fire && now <= start + 10 && !d.dismissed[key] && (d.snoozed[key] ?? 0) < Date.now()) {
        toast(`${e.title} · ${e.start}`); a.dismiss(key)
        if (d.settings.notifications && 'Notification' in window && Notification.permission === 'granted') { try { new Notification(e.title, { body: `Starts at ${e.start}`, icon: '/icons/icon-192.png' }) } catch { /* ignore */ } }
      }
    }
  })
  return null
}

function Shell() {
  const { data, loadError, fresh } = useStore(); const [page, setPage] = useState(route()); const [more, setMore] = useState(false)
  const [online, setOnline] = useState(navigator.onLine); const [upd, setUpd] = useState<ServiceWorker | null>(null)
  useEffect(() => { const h = () => { setPage(route()); setMore(false); window.scrollTo(0, 0) }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); const u = (e: Event) => setUpd((e as CustomEvent<ServiceWorker>).detail); window.addEventListener('nexus-update', u); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('nexus-update', u) } }, [])
  if (!data.profile.onboarded) return <Onboarding />
  const Page = pages[page]
  const item = (n: (typeof NAV)[number], cls: string) => { const I = n.icon; return <button key={n.id} className={`${cls} ${page === n.id ? 'on' : ''}`} onClick={() => nav('/' + (n.id === 'home' ? '' : n.id))} aria-current={page === n.id ? 'page' : undefined}><I size={cls === 'nav-item' ? 18 : 21} /><span>{n.label}</span></button> }
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Zap size={19} /></div><div><b>NEXUS</b><small>FITNESS OS</small></div></div>{NAV.map(n => item(n, 'nav-item'))}</aside>
    <div className="main">
      <div className="topbar"><div className="brand"><div className="brand-mark"><Zap size={15} /></div><b>NEXUS</b></div><div className="eyebrow">{NAV.find(n => n.id === page)?.label}</div><span className="muted small">{!online && <><WifiOff size={13} style={{ verticalAlign: -2 }} /> offline</>}</span></div>
      <main className="content">
        {upd && <div className="banner info"><span>A new version of NEXUS is ready.</span><button className="btn sm primary" onClick={() => upd.postMessage({ type: 'SKIP_WAITING' })}>Update</button></div>}
        {loadError && fresh && <div className="banner bad"><span>{loadError}</span></div>}
        {!online && <div className="banner info"><span>You are offline. Everything you log is saved on this device.</span></div>}
        <Boundary key={page}><Suspense fallback={<div className="empty"><div className="spinner" /></div>}>{page === 'home' ? <Home /> : <Page />}</Suspense></Boundary>
      </main>
    </div>
    {more && <div className="more-sheet" role="menu">{NAV.filter(n => !PRIMARY.includes(n.id)).map(n => { const I = n.icon; return <button key={n.id} className="nav-item" role="menuitem" onClick={() => { nav('/' + n.id); setMore(false) }}><I size={18} />{n.label}</button> })}<button className="nav-item" onClick={() => setMore(false)}><X size={18} />Close</button></div>}
    <nav className="bottom-nav" aria-label="Main">{NAV.filter(n => PRIMARY.includes(n.id)).map(n => item(n, 'bn'))}<button className={`${['progress', 'calendar', 'settings'].includes(page) ? 'on' : ''}`} onClick={() => setMore(m => !m)} aria-expanded={more}><MoreHorizontal size={21} /><span>More</span></button></nav>
    <Reminders />
  </div>
}
export default function App() { return <StoreProvider><ToastProvider><Shell /></ToastProvider></StoreProvider> }
