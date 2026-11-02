import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, Camera, Droplets, Moon, Plus, Scale, Trash2 } from 'lucide-react'
import { Card, Confirm, Empty, Eyebrow, Field, Modal, PageHead, Progress as Bar, Stat, Tabs, useToast } from '../components/ui'
import { useActions, useData } from '../store/store'
import { addDays, fmtDate, todayStr, diffDays } from '../lib/date'
import { RANGE_DAYS, fmtWeight, goalProgress, inRange, kgToLb, latestWeight, lbToKg, round, sortByDate, waterToday, weeklyAverage, weeklyTrend } from '../lib/calc'
import type { RangeKey } from '../lib/calc'
import { computeAchievements } from '../lib/achievements'
import { photoGet } from '../lib/storage'
import { num } from '../lib/validate'

type Tab = 'weight' | 'measure' | 'photos' | 'habits' | 'awards'
const RANGES: RangeKey[] = ['7d', '30d', '3m', '6m', '1y', 'all']
export default function Progress() {
  const [tab, setTab] = useState<Tab>((new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tab') as Tab) || 'weight')
  return <>
    <PageHead title="Progress" sub="Trends beat daily noise." />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'weight', label: 'Weight' }, { id: 'measure', label: 'Measures' }, { id: 'photos', label: 'Photos' }, { id: 'habits', label: 'Habits' }, { id: 'awards', label: 'Awards' }]} />
    <div style={{ marginTop: 12 }}>{tab === 'weight' && <WeightTab />}{tab === 'measure' && <Measures />}{tab === 'photos' && <Photos />}{tab === 'habits' && <Habits />}{tab === 'awards' && <Awards />}</div>
  </>
}

function WeightTab() {
  const d = useData(); const a = useActions(); const toast = useToast(); const unit = d.profile.units.weight
  const [range, setRange] = useState<RangeKey>('30d'); const [add, setAdd] = useState(false); const [del, setDel] = useState<string | null>(null)
  const all = sortByDate(d.weights); const last = latestWeight(d.weights); const first = all[0]
  const data = inRange(d.weights, range).map(w => ({ date: fmtDate(w.date, { day: 'numeric', month: 'short' }), kg: unit === 'kg' ? w.kg : round(kgToLb(w.kg), 1) }))
  const avg = weeklyAverage(d.weights), trend = weeklyTrend(d.weights)
  const conv = (kg: number) => (unit === 'kg' ? kg : kgToLb(kg))
  const pr = last && first ? goalProgress(first.kg, last.kg, d.profile.targetKg) : 0
  return <div className="col">
    <div className="grid g2"><Stat label="Current" value={last ? round(conv(last.kg), 1) : '—'} unit={unit} sub={last ? `measured ${fmtDate(last.date)}` : 'no entries yet'} />
      <Stat label="Target" value={round(conv(d.profile.targetKg), 1)} unit={unit} sub={last ? `${round(Math.abs(conv(d.profile.targetKg - last.kg)), 1)} ${unit} to go` : undefined} />
      <Stat label="7-day average" value={avg ? round(conv(avg), 1) : '—'} unit={unit} sub={avg ? 'calculated from entries' : 'needs entries this week'} />
      <Stat label="Trend (estimate)" value={trend !== null ? `${trend >= 0 ? '+' : ''}${round(conv(trend), 2)}` : '—'} unit={`${unit}/wk`} sub={trend !== null ? 'last 4 weeks, estimated' : 'needs 3+ entries over 7+ days'} /></div>
    {first && last && all.length > 1 && <Card><div className="row between"><Eyebrow>Progress to target</Eyebrow><b>{Math.round(pr * 100)}%</b></div><Bar value={pr * 100} /><p className="muted small" style={{ marginTop: 6 }}>Started {fmtWeight(first.kg, unit)} on {fmtDate(first.date)} · changed {last.kg - first.kg >= 0 ? '+' : ''}{round(conv(last.kg - first.kg), 1)} {unit}</p></Card>}
    <Card>
      <div className="row between"><Eyebrow>Weight history (measured)</Eyebrow><button className="btn sm primary" onClick={() => setAdd(true)}><Plus size={14} /> Log weight</button></div>
      <div className="tabs" style={{ marginTop: 8 }}>{RANGES.map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r === 'all' ? 'All' : r.toUpperCase()}</button>)}</div>
      {data.length < 2 ? <Empty icon={<Scale size={26} />} title={data.length ? 'One entry so far' : 'No weight data'} text={`A chart needs at least two entries${range !== 'all' ? ' in this period' : ''}. ${all.length >= 2 ? 'Try a longer period.' : 'Log your weight a few times a week.'}`} />
        : <div className="chart" style={{ marginTop: 8 }}><ResponsiveContainer><AreaChart data={data}><defs><linearGradient id="wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35d6ff" stopOpacity={0.3} /><stop offset="100%" stopColor="#35d6ff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#1c2c40" vertical={false} /><XAxis dataKey="date" stroke="#72869c" tickLine={false} minTickGap={24} /><YAxis stroke="#72869c" tickLine={false} width={40} domain={['dataMin - 1', 'dataMax + 1']} /><Tooltip contentStyle={{ background: '#101c2c', border: '1px solid #29435c', borderRadius: 10 }} formatter={(v: number) => [`${v} ${unit}`, 'Measured']} /><ReferenceLine y={round(conv(d.profile.targetKg), 1)} stroke="#ffb454" strokeDasharray="4 4" label={{ value: 'target', fill: '#ffb454', fontSize: 11, position: 'insideTopRight' }} /><Area type="monotone" dataKey="kg" stroke="#35d6ff" strokeWidth={2.5} fill="url(#wf)" dot={data.length < 20} /></AreaChart></ResponsiveContainer></div>}
    </Card>
    {all.length > 0 && <Card><Eyebrow>Entries</Eyebrow><div className="list">{[...all].reverse().slice(0, 15).map(w => <div className="item" key={w.id}><div className="grow"><div className="t">{fmtWeight(w.kg, unit)}</div><div className="s">{fmtDate(w.date)}{w.note ? ` · ${w.note}` : ''}</div></div><button className="icon-btn" aria-label="Delete entry" onClick={() => setDel(w.id)}><Trash2 size={16} /></button></div>)}</div></Card>}
    {add && <WeightForm onClose={() => setAdd(false)} onSave={(v, date, note) => { const r = a.addWeight(unit === 'kg' ? v : lbToKg(Number(v)), date, note); if (r.ok) { toast('Weight saved'); setAdd(false); return null } return r.error }} unit={unit} />}
    {del && <Confirm title="Delete this entry?" text="The chart and averages will update." onYes={() => { a.deleteWeight(del); setDel(null) }} onNo={() => setDel(null)} />}
  </div>
}
function WeightForm({ onClose, onSave, unit }: { onClose: () => void; onSave: (v: string, date: string, note: string) => string | null; unit: string }) {
  const [v, setV] = useState(''); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null)
  return <Modal title="Log weight" onClose={onClose}><div className="form">
    <Field label={`Weight (${unit})`} error={err}><input autoFocus inputMode="decimal" value={v} onChange={e => { setV(e.target.value); setErr(null) }} placeholder={unit === 'kg' ? 'e.g. 62.4' : 'e.g. 137.5'} /></Field>
    <Field label="Date"><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} /></Field>
    <Field label="Note (optional)"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Morning, after the toilet…" /></Field>
    <p className="muted small">If you already logged this date, it will be replaced (one entry per day).</p>
    <button className="btn primary" onClick={() => setErr(onSave(v, date, note))}>Save</button></div></Modal>
}

const KEYS = [['chest', 'Chest'], ['waist', 'Waist'], ['arm', 'Arm'], ['thigh', 'Thigh'], ['hip', 'Hip'], ['calf', 'Calf']] as const
function Measures() {
  const d = useData(); const a = useActions(); const toast = useToast(); const [add, setAdd] = useState(false); const inch = d.profile.units.length === 'in'
  const ms = sortByDate(d.measurements); const f = ms[0], l = ms[ms.length - 1]; const cv = (cm: number) => round(inch ? cm / 2.54 : cm, 1)
  return <div className="col">
    <div className="row between"><Eyebrow>Body measurements ({inch ? 'in' : 'cm'})</Eyebrow><button className="btn sm primary" onClick={() => setAdd(true)}><Plus size={14} /> Add</button></div>
    {ms.length === 0 ? <Card><Empty icon={<Scale size={26} />} title="No measurements" text="Measure at the same spot each time, about every 2–4 weeks." /></Card> : <>
      <Card><div className="grid g3">{KEYS.map(([k, n]) => { const cur = [...ms].reverse().find(m => m[k] !== undefined)?.[k], st = ms.find(m => m[k] !== undefined)?.[k]; return <div key={k}><div className="small muted">{n}</div><b>{cur !== undefined ? cv(cur) : '—'}</b>{cur !== undefined && st !== undefined && ms.filter(m => m[k] !== undefined).length > 1 && <div className={`small ${cur - st >= 0 ? 'muted' : 'muted'}`}>{cur - st >= 0 ? '+' : ''}{cv(cur - st)} since first</div>}</div> })}</div></Card>
      {ms.length >= 2 && <Card><Eyebrow>Change over time</Eyebrow><div className="chart"><ResponsiveContainer><LineChart data={ms.map(m => ({ date: fmtDate(m.date, { day: 'numeric', month: 'short' }), ...Object.fromEntries(KEYS.map(([k]) => [k, m[k] !== undefined ? cv(m[k]!) : null])) }))}><CartesianGrid stroke="#1c2c40" vertical={false} /><XAxis dataKey="date" stroke="#72869c" tickLine={false} /><YAxis stroke="#72869c" tickLine={false} width={34} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: '#101c2c', border: '1px solid #29435c', borderRadius: 10 }} />{KEYS.map(([k], i) => <Line key={k} dataKey={k} connectNulls stroke={['#35d6ff', '#ffb454', '#7a8bff', '#4ade9a', '#ff6b7a', '#c4a3ff'][i]} strokeWidth={2} dot />)}</LineChart></ResponsiveContainer></div></Card>}
      <Card><div className="list">{[...ms].reverse().map(m => <div className="item" key={m.id}><div className="grow"><div className="t">{fmtDate(m.date)}</div><div className="s">{KEYS.filter(([k]) => m[k] !== undefined).map(([k, n]) => `${n} ${cv(m[k]!)}`).join(' · ')}</div></div><button className="icon-btn" aria-label="Delete" onClick={() => a.deleteMeasurement(m.id)}><Trash2 size={16} /></button></div>)}</div></Card></>}
    {add && <MeasureForm inch={inch} onClose={() => setAdd(false)} onSave={(m) => { const r = a.addMeasurement(m); if (r.ok) { toast('Saved'); setAdd(false); return null } return r.error }} />}
    <span hidden>{f?.date}{l?.date}</span>
  </div>
}
function MeasureForm({ inch, onClose, onSave }: { inch: boolean; onClose: () => void; onSave: (m: { date: string; chest?: number; waist?: number; arm?: number; thigh?: number; hip?: number; calf?: number }) => string | null }) {
  const [v, setV] = useState<Record<string, string>>({}); const [date, setDate] = useState(todayStr()); const [err, setErr] = useState<string | null>(null)
  return <Modal title="Add measurements" onClose={onClose}><div className="form"><Field label="Date"><input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} /></Field>
    <div className="two">{KEYS.map(([k, n]) => <Field key={k} label={`${n} (${inch ? 'in' : 'cm'})`}><input inputMode="decimal" value={v[k] ?? ''} onChange={e => setV({ ...v, [k]: e.target.value })} /></Field>)}</div>
    {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <button className="btn primary" onClick={() => { const m: Record<string, number> = {}; for (const [k] of KEYS) { const n = num(v[k] ?? ''); if (n !== null) m[k] = inch ? n * 2.54 : n } setErr(onSave({ date, ...m })) }}>Save</button></div></Modal>
}
function Photos() {
  const d = useData(); const a = useActions(); const toast = useToast(); const [urls, setUrls] = useState<Record<string, string>>({}); const [view, setView] = useState<string | null>(null); const [del, setDel] = useState<string | null>(null)
  useEffect(() => { let on = true; (async () => { const o: Record<string, string> = {}; for (const p of d.photos) { try { const u = await photoGet(p.id); if (u) o[p.id] = u } catch { /* ignore */ } } if (on) setUrls(o) })(); return () => { on = false } }, [d.photos])
  return <div className="col"><Card><Eyebrow>Progress photos</Eyebrow><p className="muted small">Photos are stored only on this device (and included in your backup). Same lighting and pose each time works best.</p>
    <label className="btn primary" style={{ marginTop: 8, cursor: 'pointer' }}><Camera size={16} /> Add photo<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const r = await a.addPhoto(f, todayStr()); toast(r.ok ? 'Photo saved' : r.error, r.ok ? 'ok' : 'err') }} /></label></Card>
    {d.photos.length === 0 ? <Card><Empty icon={<Camera size={26} />} title="No photos yet" /></Card> : <div className="photo-grid">{sortByDate(d.photos).reverse().map(p => <button key={p.id} style={{ background: 'none', border: 0, padding: 0, position: 'relative' }} onClick={() => setView(p.id)}>{urls[p.id] ? <img src={urls[p.id]} alt={`Progress photo ${fmtDate(p.date)}`} /> : <div className="card" style={{ aspectRatio: '3/4' }} />}<span className="chip" style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,.6)' }}>{fmtDate(p.date, { day: 'numeric', month: 'short' })}</span></button>)}</div>}
    {view && <Modal title="Photo" onClose={() => setView(null)}>{urls[view] && <img src={urls[view]} alt="Progress" style={{ width: '100%', borderRadius: 12 }} />}<button className="btn danger" onClick={() => setDel(view)}>Delete photo</button></Modal>}
    {del && <Confirm title="Delete photo?" text="This cannot be undone." onYes={async () => { await a.deletePhoto(del); setDel(null); setView(null) }} onNo={() => setDel(null)} />}</div>
}
function Habits() {
  const d = useData(); const a = useActions(); const toast = useToast(); const today = todayStr(); const [name, setName] = useState(''); const [water, setWater] = useState(''); const [sl, setSl] = useState({ h: '', q: 3 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)); const wt = waterToday(d); const sleepToday = d.sleep.find(s => s.date === today)
  const waterDays = days.map(x => ({ date: x, ml: d.water.filter(w => w.date === x).reduce((n, w) => n + w.ml, 0) }))
  return <div className="col">
    <Card><div className="row between"><div><Eyebrow>Water today</Eyebrow><div className="stat-value">{wt}<small>/ {d.targets.waterMl} ml</small></div></div><Droplets style={{ color: 'var(--acc)' }} /></div><Bar value={(wt / d.targets.waterMl) * 100} />
      <div className="pill-row" style={{ marginTop: 10 }}>{[250, 500, 750].map(ml => <button key={ml} className="chip on" onClick={() => { a.addWater(ml); toast(`+${ml} ml`) }}>+{ml} ml</button>)}</div>
      <div className="row nowrap" style={{ marginTop: 8 }}><input inputMode="numeric" placeholder="Custom ml" aria-label="Custom water ml" value={water} onChange={e => setWater(e.target.value)} /><button className="btn" onClick={() => { const r = a.addWater(water); if (r.ok) setWater(''); else toast(r.error, 'err') }}>Add</button></div>
      {d.water.filter(w => w.date === today).slice(-3).reverse().map(w => <div className="item" key={w.id}><div className="grow small">{w.ml} ml</div><button className="icon-btn" aria-label="Remove" onClick={() => a.deleteWater(w.id)}><Trash2 size={14} /></button></div>)}
      <p className="muted small" style={{ marginTop: 6 }}>Last 7 days: {waterDays.map(x => `${Math.round(x.ml / 100) / 10}L`).join(' · ')}</p></Card>
    <Card><div className="row between"><Eyebrow>Sleep (last night)</Eyebrow><Moon style={{ color: 'var(--acc2)' }} /></div>
      {sleepToday && <p>Logged: <b>{sleepToday.hours} h</b>, quality {sleepToday.quality}/5</p>}
      <div className="two form" style={{ marginTop: 6 }}><Field label="Hours slept"><input inputMode="decimal" value={sl.h} onChange={e => setSl({ ...sl, h: e.target.value })} placeholder="7.5" /></Field><Field label="Quality"><select value={sl.q} onChange={e => setSl({ ...sl, q: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></Field></div>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => { const r = a.setSleep(today, sl.h, sl.q); toast(r.ok ? 'Sleep saved' : r.error, r.ok ? 'ok' : 'err'); if (r.ok) setSl({ ...sl, h: '' }) }}>Save sleep</button>
      {d.sleep.length >= 2 && <p className="muted small" style={{ marginTop: 8 }}>7-night average: {round(d.sleep.filter(s => diffDays(s.date, today) < 7).reduce((n, s, _, arr) => n + s.hours / arr.length, 0), 1)} h</p>}</Card>
    <Card><Eyebrow>Daily habits</Eyebrow>
      {d.habits.length === 0 && <p className="muted small">Add habits like "Stretch 10 min" or "No sugary drinks".</p>}
      {d.habits.map(h => { const done = days.filter(x => d.habitLogs.some(l => l.habitId === h.id && l.date === x)).length; return <div key={h.id} style={{ marginTop: 10 }}><div className="row between"><b>{h.name}</b><span className="muted small">{done}/{h.perWeek} this week</span></div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>{days.map(x => { const on = d.habitLogs.some(l => l.habitId === h.id && l.date === x); return <button key={x} aria-label={`${h.name} ${x}`} aria-pressed={on} className={`chip ${on ? 'on' : ''}`} onClick={() => a.toggleHabit(h.id, x)} style={{ minWidth: 38, justifyContent: 'center' }}>{fmtDate(x, { weekday: 'narrow' })}</button> })}<button className="icon-btn" aria-label={`Delete habit ${h.name}`} style={{ width: 34, height: 34 }} onClick={() => a.deleteHabit(h.id)}><Trash2 size={14} /></button></div></div> })}
      <div className="row nowrap" style={{ marginTop: 12 }}><input placeholder="New habit" aria-label="New habit name" value={name} onChange={e => setName(e.target.value)} /><button className="btn" onClick={() => { const r = a.addHabit(name, 5); if (r.ok) setName(''); else toast(r.error, 'err') }}>Add</button></div></Card>
  </div>
}
function Awards() {
  const d = useData(); const list = computeAchievements(d)
  return <div className="col"><p className="muted small">Awards unlock from what you actually log. Opening a screen never unlocks one.</p>{list.map(x => <div key={x.id} className={`ach ${x.unlocked ? '' : 'locked'}`}><Award style={{ color: x.unlocked ? 'var(--warn)' : 'var(--muted)' }} /><div className="grow"><b>{x.title}</b><div className="muted small">{x.desc}</div></div><span className={`chip ${x.unlocked ? 'good' : ''}`}>{x.unlocked ? 'Unlocked' : x.progress}</span></div>)}</div>
}
void Eyebrow
