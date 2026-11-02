import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, ChevronDown, ChevronUp, Dumbbell, Play, Plus, Trash2, Trophy } from 'lucide-react'
import { Card, Confirm, Empty, Eyebrow, Field, Modal, PageHead, Tabs, useToast } from '../components/ui'
import ExerciseModal from '../components/ExerciseModal'
import { EXERCISES, exerciseById } from '../data/exercises'
import { MUSCLES } from '../data/muscles'
import { useActions, useData } from '../store/store'
import type { PlanDay, PlanStyle, SessionExercise, WorkoutPlan, WorkoutSession } from '../store/types'
import { uid } from '../lib/id'
import { generatePlan, recommendedStyle, canDo } from '../lib/plans'
import { bestWeights, completedSets, findPRs, sessionVolume } from '../lib/calc'
import { fmtDate, todayStr, weekday, WEEKDAYS } from '../lib/date'

const DRAFT = 'nexus.session.draft'
type Tab = 'today' | 'plans' | 'history' | 'library'

export default function Workouts() {
  const d = useData(); const [tab, setTab] = useState<Tab>('today')
  const [draft, setDraft] = useState<WorkoutSession | null>(() => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null') } catch { return null } })
  useEffect(() => { if (draft) localStorage.setItem(DRAFT, JSON.stringify(draft)); else localStorage.removeItem(DRAFT) }, [draft])
  if (draft) return <Runner session={draft} onChange={setDraft} onDone={() => setDraft(null)} />
  return <>
    <PageHead title="Workouts" sub="Plan it, log it, beat it." />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'today', label: 'Today' }, { id: 'plans', label: 'Plans' }, { id: 'history', label: 'History' }, { id: 'library', label: 'Exercises' }]} />
    <div style={{ marginTop: 12 }}>
      {tab === 'today' && <Today onStart={(plan, day) => setDraft(newSession(plan?.id, day, d.sessions))} goPlans={() => setTab('plans')} />}
      {tab === 'plans' && <Plans />}
      {tab === 'history' && <History />}
      {tab === 'library' && <Library />}
    </div>
  </>
}

function newSession(planId: string | undefined, day: PlanDay, sessions: WorkoutSession[]): WorkoutSession {
  const best = bestWeights(sessions)
  return { id: uid('ses'), date: todayStr(), planId, dayName: day.name, startedAt: Date.now(), endedAt: 0, notes: '', exercises: day.exercises.map(e => ({ exerciseId: e.exerciseId, restSec: e.restSec, sets: Array.from({ length: e.sets }, () => ({ weight: best[e.exerciseId] ?? 0, reps: Number(e.reps.split('-')[0]) || 8, done: false })) })) }
}

function Today({ onStart, goPlans }: { onStart: (p: WorkoutPlan | undefined, day: PlanDay) => void; goPlans: () => void }) {
  const d = useData(); const a = useActions()
  const plan = d.plans.find(p => p.id === d.activePlanId); const dow = weekday(todayStr())
  const todays = plan?.days.find(x => x.weekday === dow); const doneToday = d.sessions.filter(s => s.date === todayStr())
  const [quick, setQuick] = useState(false)
  if (!plan) return <Card><Empty icon={<Dumbbell size={28} />} title="No workout plan yet" text="Create a plan that matches your days and equipment, or log a quick session." action={<div className="row"><button className="btn primary" onClick={() => { const p = generatePlan(recommendedStyle(d.profile.daysPerWeek), d.profile.equipment, d.profile.daysPerWeek); a.savePlan(p) }}>Create a plan for me</button><button className="btn" onClick={goPlans}>Build my own</button></div>} /></Card>
  return <div className="col">
    {doneToday.length > 0 && <div className="banner info"><span><Check size={14} style={{ verticalAlign: -2 }} /> You trained today: {doneToday.map(s => s.dayName).join(', ')}.</span></div>}
    <Card>
      <Eyebrow>{plan.name} · {WEEKDAYS[dow]}</Eyebrow>
      {todays ? <><h2 style={{ margin: '2px 0 8px' }}>{todays.name}</h2>
        <div className="list">{todays.exercises.map(e => <div className="item" key={e.exerciseId}><div className="grow"><div className="t">{exerciseById(e.exerciseId)?.name}</div><div className="s">{e.sets} × {e.reps} · rest {e.restSec}s</div></div></div>)}</div>
        {todays.exercises.length === 0 ? <p className="muted">This day has no exercises yet. Add some in Plans.</p> : <button className="btn primary full" style={{ marginTop: 10 }} onClick={() => onStart(plan, todays)}><Play size={16} /> Start workout</button>}</>
        : <><h2 style={{ margin: '2px 0 4px' }}>Rest day</h2><p className="muted">Nothing is scheduled for today in this plan. You can still train.</p></>}
    </Card>
    <Card>
      <Eyebrow>Train a different day</Eyebrow>
      <div className="pill-row" style={{ marginTop: 8 }}>{plan.days.map(x => <button key={x.id} className="chip" onClick={() => onStart(plan, x)} disabled={!x.exercises.length}>{x.name}{x.weekday !== null ? ` · ${WEEKDAYS[x.weekday]}` : ''}</button>)}<button className="chip on" onClick={() => setQuick(true)}><Plus size={13} /> Quick session</button></div>
    </Card>
    {quick && <QuickPicker onClose={() => setQuick(false)} onPick={ids => { setQuick(false); onStart(undefined, { id: 'quick', name: 'Quick session', weekday: null, exercises: ids.map(exerciseId => ({ exerciseId, sets: 3, reps: '8-12', restSec: 90 })) }) }} />}
  </div>
}
function QuickPicker({ onClose, onPick }: { onClose: () => void; onPick: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]); const [q, setQ] = useState('')
  const list = EXERCISES.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))
  return <Modal title="Quick session" onClose={onClose} wide>
    <input placeholder="Search exercises" value={q} onChange={e => setQ(e.target.value)} aria-label="Search exercises" />
    <div className="list" style={{ maxHeight: '45vh', overflow: 'auto' }}>{list.map(e => <label className="item" key={e.id}><input type="checkbox" checked={sel.includes(e.id)} onChange={() => setSel(s => s.includes(e.id) ? s.filter(x => x !== e.id) : [...s, e.id])} /><div className="grow"><div className="t">{e.name}</div><div className="s">{e.primary.map(m => MUSCLES.find(x => x.id === m)?.name).join(', ')}</div></div></label>)}</div>
    <button className="btn primary" disabled={!sel.length} onClick={() => onPick(sel)}>Start with {sel.length} exercise{sel.length === 1 ? '' : 's'}</button>
  </Modal>
}

// ---- Session runner: record sets, rest timer, finish ----
function Runner({ session, onChange, onDone }: { session: WorkoutSession; onChange: (s: WorkoutSession) => void; onDone: () => void }) {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [rest, setRest] = useState(0); const [confirm, setConfirm] = useState(false); const [summary, setSummary] = useState<{ prs: string[]; vol: number; sets: number } | null>(null)
  const tick = useRef<number | undefined>(undefined)
  useEffect(() => { if (rest > 0) { tick.current = window.setTimeout(() => setRest(r => r - 1), 1000); return () => clearTimeout(tick.current) } }, [rest])
  const setEx = (i: number, fn: (e: SessionExercise) => SessionExercise) => onChange({ ...session, exercises: session.exercises.map((e, k) => (k === i ? fn(e) : e)) })
  const finish = () => {
    const ended = { ...session, endedAt: Date.now() }
    const done = ended.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length)
    if (!done.length) { toast('Complete at least one set before finishing', 'err'); return }
    const final = { ...ended, exercises: done }; const prs = findPRs(final, d.sessions)
    a.addSession(final); setSummary({ prs, vol: sessionVolume(final), sets: completedSets(final) })
  }
  if (summary) return <Card><div className="center col"><Trophy size={36} style={{ color: 'var(--acc)', margin: '0 auto' }} /><h2>Workout saved</h2><p className="muted">{summary.sets} sets · {Math.round(summary.vol)} kg total volume</p>
    {summary.prs.length > 0 && <div className="banner info"><span>New personal best: {summary.prs.map(id => exerciseById(id)?.name).join(', ')}</span></div>}
    <button className="btn primary" onClick={onDone}>Done</button></div></Card>
  return <>
    <PageHead title={session.dayName} sub="Tick each set when it is done." action={<button className="btn ghost sm" onClick={() => setConfirm(true)}>Discard</button>} />
    {rest > 0 && <div className="banner info"><span>Rest: <b>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</b></span><button className="btn sm ghost" onClick={() => setRest(0)}>Skip</button></div>}
    <div className="col">{session.exercises.map((e, i) => { const ex = exerciseById(e.exerciseId); return <Card key={i}>
      <div className="row between"><div><h3>{ex?.name}</h3><div className="muted small">Rest {e.restSec}s</div></div><button className="icon-btn" aria-label="Remove exercise" onClick={() => onChange({ ...session, exercises: session.exercises.filter((_, k) => k !== i) })}><Trash2 size={16} /></button></div>
      <div className="setrow muted small" style={{ marginTop: 8 }}><span>Set</span><span>kg</span><span>Reps</span><span>Done</span></div>
      {e.sets.map((s, k) => <div className="setrow" key={k}><span>{k + 1}</span>
        <input inputMode="decimal" aria-label={`Set ${k + 1} weight`} value={s.weight || ''} placeholder="0" onChange={ev => setEx(i, x => ({ ...x, sets: x.sets.map((y, j) => j === k ? { ...y, weight: Math.max(0, Number(ev.target.value.replace(',', '.')) || 0) } : y) }))} />
        <input inputMode="numeric" aria-label={`Set ${k + 1} reps`} value={s.reps || ''} placeholder="0" onChange={ev => setEx(i, x => ({ ...x, sets: x.sets.map((y, j) => j === k ? { ...y, reps: Math.max(0, Math.floor(Number(ev.target.value) || 0)) } : y) }))} />
        <button className={`icon-btn ${s.done ? 'on' : ''}`} style={s.done ? { background: 'rgba(74,222,154,.2)', color: 'var(--good)' } : {}} aria-label={`Mark set ${k + 1} ${s.done ? 'not done' : 'done'}`} onClick={() => { setEx(i, x => ({ ...x, sets: x.sets.map((y, j) => j === k ? { ...y, done: !y.done } : y) })); if (!s.done) setRest(e.restSec) }}><Check size={16} /></button></div>)}
      <button className="btn sm ghost" onClick={() => setEx(i, x => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { weight: 0, reps: 8 }), done: false }] }))}><Plus size={14} /> Add set</button>
    </Card> })}</div>
    <button className="btn primary full" style={{ marginTop: 12 }} onClick={finish}>Finish workout</button>
    {confirm && <Confirm title="Discard workout?" text="Everything you entered in this session will be lost." confirmLabel="Discard" onYes={() => { setConfirm(false); onDone() }} onNo={() => setConfirm(false)} />}
  </>
}

// ---- Plans ----
function Plans() {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [edit, setEdit] = useState<string | null>(null); const [del, setDel] = useState<string | null>(null); const [create, setCreate] = useState(false)
  const plan = d.plans.find(p => p.id === edit)
  if (plan) return <PlanEditor plan={plan} onBack={() => setEdit(null)} />
  return <div className="col">
    {d.plans.length === 0 && <Card><Empty icon={<Dumbbell size={28} />} title="No plans" text="Create a plan to schedule your training days." /></Card>}
    {d.plans.map(p => <Card key={p.id}><div className="row between"><div><h3>{p.name}</h3><div className="muted small">{p.days.length} days · {p.days.reduce((n, x) => n + x.exercises.length, 0)} exercises</div></div>
      {d.activePlanId === p.id ? <span className="chip good">Active</span> : <button className="btn sm" onClick={() => { a.setActivePlan(p.id); toast('Active plan changed') }}>Make active</button>}</div>
      <div className="row" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setEdit(p.id)}>Edit</button><button className="btn sm danger" onClick={() => setDel(p.id)}>Delete</button></div></Card>)}
    <button className="btn primary" onClick={() => setCreate(true)}><Plus size={16} /> New plan</button>
    {del && <Confirm title="Delete plan?" text="Your logged sessions are kept. Only the plan itself is removed." onYes={() => { a.deletePlan(del); setDel(null) }} onNo={() => setDel(null)} />}
    {create && <NewPlan onClose={() => setCreate(false)} onCreate={(style, name) => { const p = generatePlan(style, d.profile.equipment, d.profile.daysPerWeek); if (name) p.name = name; a.savePlan(p); setCreate(false); setEdit(p.id) }} />}
  </div>
}
function NewPlan({ onClose, onCreate }: { onClose: () => void; onCreate: (s: PlanStyle, name: string) => void }) {
  const d = useData(); const [style, setStyle] = useState<PlanStyle>(recommendedStyle(d.profile.daysPerWeek)); const [name, setName] = useState('')
  return <Modal title="New plan" onClose={onClose}><div className="form">
    <Field label="Training style" hint="Not sure? Full body suits 2–3 days, upper/lower 4, push/pull/legs 5–6."><select value={style} onChange={e => setStyle(e.target.value as PlanStyle)}><option value="fullbody">Full body</option><option value="upperlower">Upper / lower</option><option value="ppl">Push / pull / legs</option><option value="custom">Custom (empty)</option></select></Field>
    <Field label="Name (optional)"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home dumbbell plan" /></Field>
    <p className="muted small">Exercises are chosen from what your equipment allows ({d.profile.equipment.join(', ')}). You can change everything afterwards.</p>
    <button className="btn primary" onClick={() => onCreate(style, name.trim())}>Create plan</button></div></Modal>
}
function PlanEditor({ plan, onBack }: { plan: WorkoutPlan; onBack: () => void }) {
  const a = useActions(); const d = useData(); const [pick, setPick] = useState<string | null>(null)
  const upd = (fn: (p: WorkoutPlan) => WorkoutPlan) => a.savePlan(fn(plan))
  const setDay = (id: string, fn: (x: PlanDay) => PlanDay) => upd(p => ({ ...p, days: p.days.map(x => (x.id === id ? fn(x) : x)) }))
  const [q, setQ] = useState('')
  return <div className="col">
    <div className="row between"><button className="btn ghost sm" onClick={onBack}>← Plans</button><input aria-label="Plan name" value={plan.name} onChange={e => upd(p => ({ ...p, name: e.target.value }))} style={{ maxWidth: 220 }} /></div>
    {plan.days.map(day => <Card key={day.id}>
      <div className="row nowrap"><input aria-label="Day name" value={day.name} onChange={e => setDay(day.id, x => ({ ...x, name: e.target.value }))} />
        <select aria-label="Weekday" value={day.weekday ?? ''} onChange={e => setDay(day.id, x => ({ ...x, weekday: e.target.value === '' ? null : Number(e.target.value) }))} style={{ maxWidth: 110 }}><option value="">Any day</option>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select>
        <button className="icon-btn" aria-label="Delete day" onClick={() => upd(p => ({ ...p, days: p.days.filter(x => x.id !== day.id) }))}><Trash2 size={16} /></button></div>
      <div className="list" style={{ marginTop: 6 }}>{day.exercises.map((e, i) => <div className="item" key={e.exerciseId + i}>
        <div className="grow"><div className="t">{exerciseById(e.exerciseId)?.name}</div>
          <div className="row nowrap" style={{ marginTop: 4 }}><input aria-label="Sets" inputMode="numeric" style={{ width: 56 }} value={e.sets} onChange={ev => setDay(day.id, x => ({ ...x, exercises: x.exercises.map((y, j) => j === i ? { ...y, sets: Math.max(1, Math.min(10, Number(ev.target.value) || 1)) } : y) }))} /><span className="muted">×</span>
            <input aria-label="Reps" style={{ width: 76 }} value={e.reps} onChange={ev => setDay(day.id, x => ({ ...x, exercises: x.exercises.map((y, j) => j === i ? { ...y, reps: ev.target.value.slice(0, 8) } : y) }))} />
            <input aria-label="Rest seconds" inputMode="numeric" style={{ width: 64 }} value={e.restSec} onChange={ev => setDay(day.id, x => ({ ...x, exercises: x.exercises.map((y, j) => j === i ? { ...y, restSec: Math.max(0, Math.min(600, Number(ev.target.value) || 0)) } : y) }))} /><span className="muted small">s rest</span></div></div>
        <div className="col" style={{ gap: 2 }}><button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => setDay(day.id, x => { const l = [...x.exercises]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...x, exercises: l } })}><ChevronUp size={14} /></button><button className="icon-btn" aria-label="Move down" disabled={i === day.exercises.length - 1} onClick={() => setDay(day.id, x => { const l = [...x.exercises]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...x, exercises: l } })}><ChevronDown size={14} /></button></div>
        <button className="icon-btn" aria-label="Remove exercise" onClick={() => setDay(day.id, x => ({ ...x, exercises: x.exercises.filter((_, j) => j !== i) }))}><Trash2 size={16} /></button></div>)}</div>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setPick(day.id)}><Plus size={14} /> Add exercise</button></Card>)}
    <button className="btn" onClick={() => upd(p => ({ ...p, days: [...p.days, { id: uid('day'), name: `Day ${p.days.length + 1}`, weekday: null, exercises: [] }] }))}><Plus size={16} /> Add day</button>
    {pick && <Modal title="Add exercise" onClose={() => setPick(null)} wide><input placeholder="Search" aria-label="Search exercises" value={q} onChange={e => setQ(e.target.value)} />
      <div className="list" style={{ maxHeight: '50vh', overflow: 'auto' }}>{EXERCISES.filter(e => e.name.toLowerCase().includes(q.toLowerCase())).map(e => <button key={e.id} className="item" style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit', width: '100%' }} onClick={() => { setDay(pick, x => ({ ...x, exercises: [...x.exercises, { exerciseId: e.id, sets: 3, reps: '8-12', restSec: 90 }] })); setPick(null) }}><div className="grow"><div className="t">{e.name}</div><div className="s">{e.primary.map(m => MUSCLES.find(x => x.id === m)?.name).join(', ')}{canDo(e.id, d.profile.equipment) ? '' : ' · needs equipment you did not select'}</div></div></button>)}</div></Modal>}
  </div>
}

// ---- History + comparison ----
function History() {
  const d = useData(); const a = useActions(); const [exId, setExId] = useState(''); const [del, setDel] = useState<string | null>(null)
  const sessions = useMemo(() => [...d.sessions].sort((x, y) => y.startedAt - x.startedAt), [d.sessions])
  const used = useMemo(() => [...new Set(d.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))], [d.sessions])
  const series = useMemo(() => exId ? [...d.sessions].sort((x, y) => x.startedAt - y.startedAt).map(s => { const e = s.exercises.find(z => z.exerciseId === exId); return e ? { date: fmtDate(s.date, { day: 'numeric', month: 'short' }), best: Math.max(0, ...e.sets.map(z => z.weight)), volume: e.sets.reduce((n, z) => n + z.weight * z.reps, 0) } : null }).filter(Boolean) as { date: string; best: number; volume: number }[] : [], [d.sessions, exId])
  if (!sessions.length) return <Card><Empty icon={<Dumbbell size={28} />} title="No sessions yet" text="Completed workouts will appear here so you can compare performance over time." /></Card>
  return <div className="col">
    <Card><Eyebrow>Compare an exercise</Eyebrow><select aria-label="Exercise to compare" value={exId} onChange={e => setExId(e.target.value)} style={{ marginTop: 6 }}><option value="">Choose…</option>{used.map(id => <option key={id} value={id}>{exerciseById(id)?.name}</option>)}</select>
      {exId && (series.length < 2 ? <p className="muted small" style={{ marginTop: 8 }}>Log this exercise in at least two sessions to see a trend.</p> : <div className="chart" style={{ marginTop: 8 }}><ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="#1c2c40" vertical={false} /><XAxis dataKey="date" stroke="#72869c" tickLine={false} /><YAxis stroke="#72869c" tickLine={false} width={34} /><Tooltip contentStyle={{ background: '#101c2c', border: '1px solid #29435c', borderRadius: 10 }} /><Line type="monotone" dataKey="best" name="Best weight (kg)" stroke="#35d6ff" strokeWidth={2.5} dot /></LineChart></ResponsiveContainer></div>)}</Card>
    {sessions.map(s => <Card key={s.id}><div className="row between"><div><h3>{s.dayName}</h3><div className="muted small">{fmtDate(s.date)} · {completedSets(s)} sets · {Math.round(sessionVolume(s))} kg volume</div></div><button className="icon-btn" aria-label="Delete session" onClick={() => setDel(s.id)}><Trash2 size={16} /></button></div>
      <div className="small" style={{ marginTop: 6 }}>{s.exercises.map(e => `${exerciseById(e.exerciseId)?.name}: ${e.sets.map(x => `${x.weight}×${x.reps}`).join(', ')}`).join(' · ')}</div></Card>)}
    {del && <Confirm title="Delete this session?" text="This removes it from your history and progress." onYes={() => { a.deleteSession(del); setDel(null) }} onNo={() => setDel(null)} />}
  </div>
}
function Library() {
  const [q, setQ] = useState(''); const [m, setM] = useState(''); const [open, setOpen] = useState<string | null>(null)
  const list = EXERCISES.filter(e => e.name.toLowerCase().includes(q.toLowerCase()) && (!m || e.primary.includes(m) || e.secondary.includes(m)))
  return <div className="col"><div className="row nowrap"><input aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={e => setQ(e.target.value)} /><select aria-label="Muscle filter" value={m} onChange={e => setM(e.target.value)} style={{ maxWidth: 160 }}><option value="">All muscles</option>{MUSCLES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
    <Card><div className="list">{list.map(e => <button key={e.id} className="item" onClick={() => setOpen(e.id)} style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit', width: '100%' }}><div className="grow"><div className="t">{e.name}</div><div className="s">{e.primary.map(x => MUSCLES.find(y => y.id === x)?.name).join(', ')} · {e.difficulty}</div></div></button>)}{!list.length && <Empty title="No matches" />}</div></Card>
    {open && <ExerciseModal id={open} onClose={() => setOpen(null)} />}</div>
}
void Field
