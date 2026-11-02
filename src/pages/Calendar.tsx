import { useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Repeat, Trash2 } from 'lucide-react'
import { Card, Confirm, Empty, Eyebrow, Field, Modal, PageHead, Tabs, useToast } from '../components/ui'
import { useActions, useData } from '../store/store'
import type { CalEvent, Task } from '../store/types'
import { MONTHS, WEEKDAYS, addDays, addMonths, daysInMonth, fmtDate, fmtLong, relativeDay, startOfWeek, todayStr, weekday, minToTime, timeToMin } from '../lib/date'
import { occurrences } from '../lib/recurrence'
import type { Occurrence } from '../lib/recurrence'

type View = 'month' | 'week' | 'day' | 'agenda'; type Tab = 'calendar' | 'tasks'
const blank = (date: string): Omit<CalEvent, 'id' | 'doneDates'> => ({ title: '', date, start: '09:00', end: '10:00', kind: 'event', recurrence: 'none', remindMin: 15, description: '' })

export default function Calendar() {
  const [tab, setTab] = useState<Tab>('calendar')
  return <><PageHead title="Calendar" sub="Africa/Nairobi time" /><Tabs value={tab} onChange={setTab} items={[{ id: 'calendar', label: 'Schedule' }, { id: 'tasks', label: 'Tasks & watchlist' }]} /><div style={{ marginTop: 12 }}>{tab === 'calendar' ? <Schedule /> : <Tasks />}</div></>
}

function Schedule() {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [view, setView] = useState<View>('month'); const [cursor, setCursor] = useState(todayStr()); const [sel, setSel] = useState(todayStr())
  const [form, setForm] = useState<{ id?: string; v: Omit<CalEvent, 'id' | 'doneDates'> } | null>(null); const [del, setDel] = useState<CalEvent | null>(null)
  const today = todayStr()
  const range = useMemo(() => {
    if (view === 'month') { const f = startOfWeek(cursor.slice(0, 8) + '01'); return [f, addDays(f, 41)] as const }
    if (view === 'week') { const f = startOfWeek(cursor); return [f, addDays(f, 6)] as const }
    if (view === 'day') return [cursor, cursor] as const
    return [today, addDays(today, 30)] as const
  }, [view, cursor, today])
  const occ = useMemo(() => occurrences(d.events, range[0], range[1]), [d.events, range])
  const by = (date: string) => occ.filter(o => o.date === date)
  const planned = (date: string) => { const p = d.plans.find(x => x.id === d.activePlanId); const day = p?.days.find(x => x.weekday === weekday(date)); return day ? [{ title: `Workout: ${day.name}`, plan: true }] : [] }
  const move = (n: number) => setCursor(view === 'month' ? addMonths(cursor, n) : view === 'week' ? addDays(cursor, 7 * n) : addDays(cursor, n))
  const title = view === 'month' ? `${MONTHS[Number(cursor.slice(5, 7)) - 1]} ${cursor.slice(0, 4)}` : view === 'week' ? `${fmtDate(range[0], { day: 'numeric', month: 'short' })} – ${fmtDate(range[1], { day: 'numeric', month: 'short' })}` : view === 'day' ? fmtLong(cursor) : 'Next 30 days'
  const open = (date: string) => setForm({ v: blank(date) })
  const Ev = ({ o }: { o: Occurrence }) => <button className={`ev ${o.event.kind} ${o.done ? 'done' : ''}`} onClick={() => setForm({ id: o.event.id, v: { ...o.event } })}>
    <div className="row between nowrap"><b>{o.event.title}</b><span className="muted small">{o.event.start}–{o.event.end}</span></div>
    <div className="muted small">{o.event.recurrence !== 'none' && <><Repeat size={11} style={{ verticalAlign: -1 }} /> {o.event.recurrence} · </>}{o.event.kind}{o.event.remindMin !== null ? ` · remind ${o.event.remindMin}m before` : ''}</div></button>
  return <div className="col">
    <div className="row between"><div className="seg">{(['month', 'week', 'day', 'agenda'] as View[]).map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div><button className="btn primary sm" onClick={() => open(view === 'month' || view === 'agenda' ? sel : cursor)}><Plus size={14} /> Event</button></div>
    {view !== 'agenda' && <div className="row between"><button className="icon-btn" aria-label="Previous" onClick={() => move(-1)}><ChevronLeft size={18} /></button><b>{title}</b><button className="icon-btn" aria-label="Next" onClick={() => move(1)}><ChevronRight size={18} /></button></div>}
    {view !== 'agenda' && <button className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => { setCursor(today); setSel(today) }}>Today</button>}
    {view === 'month' && <><div className="cal-grid">{[1, 2, 3, 4, 5, 6, 0].map(i => <div className="cal-head" key={i}>{WEEKDAYS[i]}</div>)}
      {Array.from({ length: 42 }, (_, i) => addDays(range[0], i)).map(dt => { const es = by(dt); const inM = dt.slice(0, 7) === cursor.slice(0, 7); return <button key={dt} className={`cal-cell ${inM ? '' : 'out'} ${dt === today ? 'today' : ''} ${dt === sel ? 'sel' : ''}`} onClick={() => setSel(dt)} aria-label={`${fmtLong(dt)}, ${es.length} events`}><b>{Number(dt.slice(8))}</b>{es.slice(0, 3).map((o, k) => <span key={k} className={`cal-dot ${o.event.kind}`} />)}</button> })}</div>
      <Card><div className="row between"><Eyebrow>{relativeDay(sel)} · {fmtLong(sel)}</Eyebrow><button className="btn sm" onClick={() => open(sel)}><Plus size={13} /> Add</button></div>
        <div className="col" style={{ marginTop: 8, gap: 8 }}>{planned(sel).map((p, i) => <div className="ev workout" key={i}>{p.title} <span className="muted small">(from your plan)</span></div>)}{by(sel).map(o => <Ev key={o.event.id + o.date} o={o} />)}{!by(sel).length && !planned(sel).length && <p className="muted small">Nothing scheduled.</p>}</div></Card></>}
    {view === 'week' && <div className="week-col">{Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map(dt => <Card key={dt}><div className="row between"><b style={{ color: dt === today ? 'var(--acc)' : undefined }}>{fmtDate(dt)}</b><button className="icon-btn" style={{ width: 32, height: 32 }} aria-label={`Add event on ${dt}`} onClick={() => open(dt)}><Plus size={14} /></button></div>
      <div className="col" style={{ gap: 6, marginTop: 6 }}>{planned(dt).map((p, i) => <div className="ev workout small" key={i}>{p.title}</div>)}{by(dt).map(o => <Ev key={o.event.id + o.date} o={o} />)}{!by(dt).length && !planned(dt).length && <span className="muted small">Free</span>}</div></Card>)}</div>}
    {view === 'day' && <Card><div className="col" style={{ gap: 8 }}>{planned(cursor).map((p, i) => <div className="ev workout" key={i}>{p.title} <span className="muted small">(from your plan)</span></div>)}{by(cursor).map(o => <Ev key={o.event.id} o={o} />)}{!by(cursor).length && !planned(cursor).length && <Empty icon={<CalendarDays size={26} />} title="Nothing scheduled" action={<button className="btn primary sm" onClick={() => open(cursor)}>Add event</button>} />}</div></Card>}
    {view === 'agenda' && <div className="col">{occ.length === 0 ? <Card><Empty icon={<CalendarDays size={26} />} title="Nothing in the next 30 days" action={<button className="btn primary sm" onClick={() => open(today)}>Add event</button>} /></Card>
      : [...new Set(occ.map(o => o.date))].map(dt => <Card key={dt}><Eyebrow>{relativeDay(dt)}</Eyebrow><div className="col" style={{ gap: 6, marginTop: 6 }}>{occ.filter(o => o.date === dt).map(o => <Ev key={o.event.id + dt} o={o} />)}</div></Card>)}</div>}
    {form && <EventForm initial={form.v} id={form.id} onClose={() => setForm(null)} onDelete={() => { const e = d.events.find(x => x.id === form.id); if (e) setDel(e); setForm(null) }} onSave={v => { const r = a.saveEvent({ ...v, id: form.id }); if (r.ok) { toast(form.id ? 'Event updated' : 'Event added'); setForm(null); return null } return r.error }}
      onDone={form.id ? () => { a.toggleEventDone(form.id!, form.v.date >= today ? form.v.date : today); setForm(null) } : undefined} />}
    {del && <Confirm title="Delete event?" text={del.recurrence !== 'none' ? 'This is a repeating event. Deleting removes the whole series.' : `"${del.title}" will be removed.`} onYes={() => { a.deleteEvent(del.id); setDel(null); toast('Event deleted') }} onNo={() => setDel(null)} />}
  </div>
}
function EventForm({ initial, id, onClose, onSave, onDelete, onDone }: { initial: Omit<CalEvent, 'id' | 'doneDates'>; id?: string; onClose: () => void; onSave: (v: Omit<CalEvent, 'id' | 'doneDates'>) => string | null; onDelete: () => void; onDone?: () => void }) {
  const [v, setV] = useState(initial); const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(p => ({ ...p, [k]: val }))
  return <Modal title={id ? 'Edit event' : 'New event'} onClose={onClose}><div className="form">
    <Field label="Title"><input autoFocus value={v.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Upper-body session" /></Field>
    <div className="two"><Field label="Date"><input type="date" value={v.date} onChange={e => set('date', e.target.value)} /></Field><Field label="Type"><select value={v.kind} onChange={e => set('kind', e.target.value as CalEvent['kind'])}><option value="event">Event</option><option value="workout">Workout</option><option value="meal">Meal</option><option value="reminder">Reminder</option></select></Field></div>
    <div className="two"><Field label="Starts"><input type="time" value={v.start} onChange={e => { const s = e.target.value; setV(p => ({ ...p, start: s, end: timeToMin(p.end) <= timeToMin(s) && s ? minToTime(timeToMin(s) + 60) : p.end })) }} /></Field><Field label="Ends"><input type="time" value={v.end} onChange={e => set('end', e.target.value)} /></Field></div>
    <div className="two"><Field label="Repeats"><select value={v.recurrence} onChange={e => set('recurrence', e.target.value as CalEvent['recurrence'])}><option value="none">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
      <Field label="Remind me"><select value={v.remindMin ?? ''} onChange={e => set('remindMin', e.target.value === '' ? null : Number(e.target.value))}><option value="">No reminder</option><option value="0">At start</option><option value="5">5 min before</option><option value="15">15 min before</option><option value="30">30 min before</option><option value="60">1 hour before</option></select></Field></div>
    {v.recurrence !== 'none' && <Field label="Repeat until (optional)"><input type="date" value={v.until ?? ''} onChange={e => set('until', e.target.value || undefined)} /></Field>}
    <Field label="Description"><textarea value={v.description ?? ''} onChange={e => set('description', e.target.value)} /></Field>
    {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <div className="row between"><div className="row">{id && <button className="btn danger sm" onClick={onDelete}><Trash2 size={14} /> Delete</button>}{onDone && <button className="btn sm" onClick={onDone}><Check size={14} /> Done</button>}</div><button className="btn primary" onClick={() => setErr(onSave(v))}>Save</button></div></div></Modal>
}

function Tasks() {
  const d = useData(); const a = useActions(); const toast = useToast(); const [title, setTitle] = useState(''); const [pri, setPri] = useState<Task['priority']>('medium'); const [due, setDue] = useState('')
  const [edit, setEdit] = useState<Task | null>(null); const today = todayStr(); const [filter, setFilter] = useState<'open' | 'all'>('open')
  const order = { high: 0, medium: 1, low: 2 }
  const tasks = [...d.tasks].filter(t => filter === 'all' || !t.done).sort((x, y) => Number(x.done) - Number(y.done) || order[x.priority] - order[y.priority] || (x.due ?? '9').localeCompare(y.due ?? '9'))
  const watch = [...d.tasks.filter(t => !t.done && (t.due ?? '') <= today && t.due), ...d.tasks.filter(t => !t.done && !t.due && t.priority === 'high')]
  const todayEvents = occurrences(d.events, today, today)
  const set = d.settings
  return <div className="col">
    <Card><Eyebrow>Daily watchlist</Eyebrow>
      {!watch.length && !todayEvents.length ? <p className="muted small" style={{ marginTop: 6 }}>Nothing urgent today: no overdue tasks, due-today tasks, high-priority tasks or events.</p> : <div className="list">{todayEvents.map(o => <div className="item" key={o.event.id}><Bell size={16} style={{ color: 'var(--acc)' }} /><div className="grow"><div className="t">{o.event.title}</div><div className="s">{o.event.start}</div></div></div>)}{watch.map(t => <div className="item" key={t.id}><button className="icon-btn" aria-label={`Complete ${t.title}`} onClick={() => a.updateTask(t.id, { done: true })}><Check size={16} /></button><div className="grow"><div className="t">{t.title}</div><div className="s">{t.due && t.due < today ? 'Overdue' : t.due ? 'Due today' : 'High priority'}</div></div></div>)}</div>}</Card>
    <Card><div className="form"><Eyebrow>Add a task</Eyebrow><input aria-label="Task title" placeholder="What needs doing?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const r = a.addTask({ title, priority: pri, due: due || undefined }); if (r.ok) { setTitle(''); setDue('') } else toast(r.error, 'err') } }} />
      <div className="two"><select aria-label="Priority" value={pri} onChange={e => setPri(e.target.value as Task['priority'])}><option value="high">High priority</option><option value="medium">Medium</option><option value="low">Low</option></select><input type="date" aria-label="Due date" value={due} onChange={e => setDue(e.target.value)} /></div>
      <button className="btn primary" onClick={() => { const r = a.addTask({ title, priority: pri, due: due || undefined }); if (r.ok) { setTitle(''); setDue(''); toast('Task added') } else toast(r.error, 'err') }}><Plus size={16} /> Add task</button></div></Card>
    <div className="row between"><Eyebrow>To-do list</Eyebrow><div className="seg"><button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Open</button><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button></div></div>
    <Card>{!tasks.length ? <Empty icon={<Check size={26} />} title={d.tasks.length ? 'All done' : 'No tasks yet'} text={d.tasks.length ? 'Nothing open. Nice.' : 'Add your first task above.'} /> : <div className="list">{tasks.map(t => <div className="item" key={t.id}>
      <input type="checkbox" aria-label={`Complete ${t.title}`} checked={t.done} onChange={() => a.updateTask(t.id, { done: !t.done })} />
      <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }} onClick={() => setEdit(t)}><div className="t">{t.title}</div><div className="s">{t.priority} priority{t.due ? ` · due ${t.due < today ? 'OVERDUE ' : ''}${fmtDate(t.due)}` : ''}</div></button>
      <button className="icon-btn" aria-label="Delete task" onClick={() => a.deleteTask(t.id)}><Trash2 size={16} /></button></div>)}</div>}</Card>
    <Card><div className="form"><Eyebrow>Reminder preferences</Eyebrow>
      <label className="row between"><span>In-app reminders for events</span><input type="checkbox" checked={set.remindersEnabled} onChange={e => a.setSettings({ remindersEnabled: e.target.checked })} /></label>
      <label className="row between"><span>Busy mode (silence reminders)</span><input type="checkbox" checked={set.busyMode} onChange={e => a.setSettings({ busyMode: e.target.checked })} /></label>
      <label className="row between"><span>Phone notifications while NEXUS is open</span><input type="checkbox" checked={set.notifications} onChange={async e => { if (e.target.checked && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('Notification permission was not granted', 'err'); return } } a.setSettings({ notifications: e.target.checked }) }} /></label>
      <p className="muted small">Honest limit: reminders only fire while NEXUS is open or running in the background of your phone. True push notifications when the app is closed need a push server, which is not set up yet.</p></div></Card>
    {edit && <TaskEdit task={edit} onClose={() => setEdit(null)} />}
  </div>
}
function TaskEdit({ task, onClose }: { task: Task; onClose: () => void }) {
  const a = useActions(); const [t, setT] = useState(task)
  return <Modal title="Edit task" onClose={onClose}><div className="form"><Field label="Title"><input value={t.title} onChange={e => setT({ ...t, title: e.target.value })} /></Field>
    <div className="two"><Field label="Priority"><select value={t.priority} onChange={e => setT({ ...t, priority: e.target.value as Task['priority'] })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field><Field label="Due"><input type="date" value={t.due ?? ''} onChange={e => setT({ ...t, due: e.target.value || undefined })} /></Field></div>
    <Field label="Notes"><textarea value={t.notes ?? ''} onChange={e => setT({ ...t, notes: e.target.value })} /></Field>
    <button className="btn primary" disabled={!t.title.trim()} onClick={() => { a.updateTask(t.id, { title: t.title.trim(), priority: t.priority, due: t.due, notes: t.notes }); onClose() }}>Save</button></div></Modal>
}
void daysInMonth
