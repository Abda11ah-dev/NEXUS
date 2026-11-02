import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Utensils } from 'lucide-react'
import { Card, Confirm, Empty, Eyebrow, Field, Modal, PageHead, Progress, Stat, Tabs, useToast } from '../components/ui'
import { allFoods, foodById, searchFoods } from '../data/foods'
import { useActions, useData } from '../store/store'
import type { Food, MealType } from '../store/types'
import { addDays, fmtDate, fmtLong, nowTime, relativeDay, todayStr } from '../lib/date'
import { dayTotals, foodMacros, pct, round } from '../lib/calc'
import { num } from '../lib/validate'
import { uid } from '../lib/id'

const MEALS: { id: MealType; label: string }[] = [{ id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' }, { id: 'dinner', label: 'Dinner' }, { id: 'snack', label: 'Snacks' }]
type Tab = 'log' | 'week' | 'meals' | 'targets'
const defaultMeal = (): MealType => { const h = Number(nowTime().slice(0, 2)); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner' }

export default function Nutrition() {
  const [tab, setTab] = useState<Tab>('log')
  return <>
    <PageHead title="Nutrition" sub="Log what you eat. Estimates, not medical advice." />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'log', label: 'Daily log' }, { id: 'week', label: 'Week' }, { id: 'meals', label: 'Saved meals' }, { id: 'targets', label: 'Targets' }]} />
    <div style={{ marginTop: 12 }}>{tab === 'log' && <Log />}{tab === 'week' && <Week />}{tab === 'meals' && <Meals />}{tab === 'targets' && <Targets />}</div>
  </>
}

function Log() {
  const d = useData(); const a = useActions(); const [date, setDate] = useState(todayStr()); const [add, setAdd] = useState<MealType | null>(null)
  const t = dayTotals(d.foodLog, date); const g = d.targets
  return <div className="col">
    <div className="row between"><button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={18} /></button><b>{relativeDay(date)} · {fmtLong(date)}</b><button className="icon-btn" aria-label="Next day" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><ChevronRight size={18} /></button></div>
    <Card>
      <div className="row between"><div><Eyebrow>Calories</Eyebrow><div className="stat-value">{Math.round(t.kcal)}<small>/ {g.calories} kcal</small></div></div><span className={`chip ${t.kcal > g.calories * 1.1 ? 'warn' : ''}`}>{Math.round(g.calories - t.kcal) >= 0 ? `${Math.round(g.calories - t.kcal)} left` : `${Math.round(t.kcal - g.calories)} over`}</span></div>
      <Progress value={pct(t.kcal, g.calories)} tone={t.kcal > g.calories * 1.1 ? 'warn' : undefined} />
      <div className="grid g3" style={{ marginTop: 12 }}>{([['Protein', t.protein, g.protein], ['Carbs', t.carbs, g.carbs], ['Fat', t.fat, g.fat]] as const).map(([n, v, tg]) => <div key={n}><div className="small muted">{n}</div><b>{Math.round(v)}</b><span className="muted small"> / {tg} g</span><Progress value={pct(v, tg)} /></div>)}</div>
    </Card>
    {MEALS.map(m => { const es = d.foodLog.filter(e => e.date === date && e.meal === m.id); return <Card key={m.id}>
      <div className="row between"><div><h3>{m.label}</h3><div className="muted small">{Math.round(es.reduce((n, e) => n + e.kcal, 0))} kcal</div></div><button className="btn sm" onClick={() => setAdd(m.id)}><Plus size={14} /> Add food</button></div>
      {es.length > 0 && <div className="list" style={{ marginTop: 6 }}>{es.map(e => <div className="item" key={e.id}><div className="grow"><div className="t">{e.name}</div><div className="s">{e.grams} g · {Math.round(e.kcal)} kcal · P {e.protein} C {e.carbs} F {e.fat}</div></div><button className="icon-btn" aria-label={`Remove ${e.name}`} onClick={() => a.deleteFoodEntry(e.id)}><Trash2 size={16} /></button></div>)}</div>}
    </Card> })}
    {add && <AddFood meal={add} date={date} onClose={() => setAdd(null)} />}
  </div>
}

export function AddFood({ meal, date, onClose }: { meal: MealType; date: string; onClose: () => void }) {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [q, setQ] = useState(''); const [food, setFood] = useState<Food | null>(null); const [grams, setGrams] = useState('100'); const [custom, setCustom] = useState(false); const [err, setErr] = useState<string | null>(null)
  const results = useMemo(() => searchFoods(q, d.customFoods, 40), [q, d.customFoods])
  const variants = food ? allFoods(d.customFoods).filter(f => f.group === food.group && f.id !== food.id) : []
  if (custom) return <CustomFood onClose={() => setCustom(false)} onSaved={f => { setCustom(false); setFood(f) }} />
  const mac = food ? foodMacros(food, num(grams) ?? 0) : null
  return <Modal title={food ? food.name : `Add to ${meal}`} onClose={onClose} wide>
    {!food ? <>
      <div className="row nowrap"><div style={{ position: 'relative', flex: 1 }}><Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--muted)' }} /><input style={{ paddingLeft: 36 }} autoFocus placeholder="Search foods (ugali, rice, egg…)" aria-label="Search foods" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <div className="list" style={{ maxHeight: '48vh', overflow: 'auto' }}>{results.map(f => <button key={f.id} className="item" style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit', width: '100%' }} onClick={() => { setFood(f); setGrams(String(f.servings?.[0]?.grams ?? 100)) }}>
        <div className="grow"><div className="t">{f.name}{f.state && <span className="chip" style={{ marginLeft: 6 }}>{f.state}</span>}{f.source === 'custom' && <span className="chip good" style={{ marginLeft: 6 }}>mine</span>}</div><div className="s">{f.kcal} kcal · P {f.protein} · C {f.carbs} · F {f.fat} per 100 g</div></div></button>)}
        {!results.length && <Empty title="No food found" text="Create it as a custom food." />}</div>
      <button className="btn" onClick={() => setCustom(true)}><Plus size={16} /> Create custom food</button>
      <p className="muted small">Reference values are rounded estimates (see README). Barcode scanning is not available; search or enter foods manually.</p>
    </> : <div className="form">
      {food.note && <div className="banner info"><span>{food.note}</span></div>}
      {variants.length > 0 && <div><div className="small muted" style={{ marginBottom: 4 }}>Cooked or uncooked?</div><div className="pill-row">{[food, ...variants].map(v => <button key={v.id} className={`chip ${v.id === food.id ? 'on' : ''}`} onClick={() => setFood(v)}>{v.state ?? v.name}</button>)}</div><p className="muted small" style={{ marginTop: 4 }}>Weigh cooked food as cooked and dry food as dry. They have very different calories per gram.</p></div>}
      <Field label="Portion (grams)" error={err}><input inputMode="decimal" value={grams} onChange={e => { setGrams(e.target.value); setErr(null) }} /></Field>
      {food.servings && <div className="pill-row">{food.servings.map(s => <button key={s.label} className="chip" onClick={() => setGrams(String(s.grams))}>{s.label} · {s.grams} g</button>)}</div>}
      {mac && <div className="card"><b>{Math.round(mac.kcal)} kcal</b><div className="muted small">Protein {mac.protein} g · Carbs {mac.carbs} g · Fat {mac.fat} g</div></div>}
      <div className="row end"><button className="btn ghost" onClick={() => setFood(null)}>Back</button><button className="btn primary" onClick={() => { const r = a.addFood({ foodId: food.id, grams, meal, date }); if (r.ok) { toast(`${food.name} added`); onClose() } else setErr(r.error) }}>Add to {meal}</button></div>
    </div>}
  </Modal>
}
function CustomFood({ onClose, onSaved }: { onClose: () => void; onSaved: (f: Food) => void }) {
  const a = useActions(); const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' }); const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return <Modal title="Custom food" onClose={onClose}><div className="form">
    <Field label="Name"><input value={f.name} onChange={set('name')} placeholder="e.g. Mama's pilau" /></Field>
    <p className="muted small">Enter values per 100 g exactly as on the label or from your own estimate.</p>
    <div className="two"><Field label="Calories (kcal)"><input inputMode="decimal" value={f.kcal} onChange={set('kcal')} /></Field><Field label="Protein (g)"><input inputMode="decimal" value={f.protein} onChange={set('protein')} /></Field></div>
    <div className="two"><Field label="Carbs (g)"><input inputMode="decimal" value={f.carbs} onChange={set('carbs')} /></Field><Field label="Fat (g)"><input inputMode="decimal" value={f.fat} onChange={set('fat')} /></Field></div>
    {err && <small className="err" role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <button className="btn primary" onClick={() => { const n = { kcal: num(f.kcal), protein: num(f.protein) ?? 0, carbs: num(f.carbs) ?? 0, fat: num(f.fat) ?? 0 }; if (n.kcal === null) { setErr('Enter the calories per 100 g.'); return }
      const id = uid('cf'); const food = { id, name: f.name.trim(), kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, group: 'custom-' + f.name.trim().toLowerCase().replace(/\s+/g, '-'), state: 'prepared' as const, note: 'Your own estimate' }
      const r = a.saveCustomFood(food); if (!r.ok) { setErr(r.error); return }; onSaved({ ...food, source: 'custom' as const }) }}>Save food</button></div></Modal>
}
function Week() {
  const d = useData(); const days = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i - 6))
  const rows = days.map(x => { const t = dayTotals(d.foodLog, x); return { date: x, label: fmtDate(x, { weekday: 'short' }), kcal: Math.round(t.kcal), protein: Math.round(t.protein), logged: d.foodLog.some(e => e.date === x) } })
  const logged = rows.filter(r => r.logged)
  if (!logged.length) return <Card><Empty icon={<Utensils size={28} />} title="No food logged this week" text="Your weekly summary appears after your first entry." /></Card>
  const avg = Math.round(logged.reduce((n, r) => n + r.kcal, 0) / logged.length), avgP = Math.round(logged.reduce((n, r) => n + r.protein, 0) / logged.length)
  return <div className="col"><div className="grid g3"><Stat label="Avg calories" value={avg} unit="kcal" sub={`target ${d.targets.calories}`} /><Stat label="Avg protein" value={avgP} unit="g" sub={`target ${d.targets.protein}`} /><Stat label="Days logged" value={`${logged.length}/7`} /></div>
    <Card><Eyebrow>Calories per day</Eyebrow><div className="chart"><ResponsiveContainer><BarChart data={rows}><CartesianGrid stroke="#1c2c40" vertical={false} /><XAxis dataKey="label" stroke="#72869c" tickLine={false} /><YAxis stroke="#72869c" tickLine={false} width={40} /><Tooltip contentStyle={{ background: '#101c2c', border: '1px solid #29435c', borderRadius: 10 }} /><ReferenceLine y={d.targets.calories} stroke="#ffb454" strokeDasharray="4 4" /><Bar dataKey="kcal" fill="#35d6ff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="muted small">Dashed line is your target. Days with no entries show as zero and are excluded from averages.</p></Card></div>
}
function Meals() {
  const d = useData(); const a = useActions(); const toast = useToast(); const [make, setMake] = useState(false); const [del, setDel] = useState<string | null>(null)
  return <div className="col">
    {!d.mealTemplates.length && <Card><Empty icon={<Utensils size={28} />} title="No saved meals" text="Save combinations you eat often (for example 'Oats, milk and banana') and add them in one tap." /></Card>}
    {d.mealTemplates.map(mt => { const k = mt.items.reduce((n, i) => { const f = foodById(i.foodId, d.customFoods); return n + (f ? foodMacros(f, i.grams).kcal : 0) }, 0); return <Card key={mt.id}><div className="row between"><div><h3>{mt.name}</h3><div className="muted small">{mt.items.map(i => `${i.grams} g ${foodById(i.foodId, d.customFoods)?.name.split(' (')[0] ?? '?'}`).join(', ')}<br />{Math.round(k)} kcal</div></div></div>
      <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" onClick={() => { for (const i of mt.items) a.addFood({ foodId: i.foodId, grams: i.grams, meal: mt.meal }); toast(`${mt.name} added to today`) }}>Add to today</button><button className="btn sm danger" onClick={() => setDel(mt.id)}>Delete</button></div></Card> })}
    <button className="btn primary" onClick={() => setMake(true)}><Plus size={16} /> New saved meal</button>
    {make && <MealMaker onClose={() => setMake(false)} />}
    {del && <Confirm title="Delete saved meal?" text="Food you already logged is not affected." onYes={() => { a.deleteMealTemplate(del); setDel(null) }} onNo={() => setDel(null)} />}
  </div>
}
function MealMaker({ onClose }: { onClose: () => void }) {
  const d = useData(); const a = useActions(); const toast = useToast(); const [name, setName] = useState(''); const [meal, setMeal] = useState<MealType>(defaultMeal()); const [items, setItems] = useState<{ foodId: string; grams: number }[]>([]); const [q, setQ] = useState(''); const [err, setErr] = useState<string | null>(null)
  return <Modal title="New saved meal" onClose={onClose} wide><div className="form">
    <div className="two"><Field label="Name"><input value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Meal"><select value={meal} onChange={e => setMeal(e.target.value as MealType)}>{MEALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field></div>
    {items.map((i, k) => <div className="row nowrap" key={k}><div className="grow small">{foodById(i.foodId, d.customFoods)?.name}</div><input style={{ width: 80 }} aria-label="Grams" inputMode="numeric" value={i.grams} onChange={e => setItems(items.map((x, j) => j === k ? { ...x, grams: Math.max(1, Number(e.target.value) || 1) } : x))} /><span className="muted small">g</span><button className="icon-btn" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== k))}><Trash2 size={14} /></button></div>)}
    <input placeholder="Search a food to add" aria-label="Search foods" value={q} onChange={e => setQ(e.target.value)} />
    {q && <div className="list" style={{ maxHeight: 180, overflow: 'auto' }}>{searchFoods(q, d.customFoods, 8).map(f => <button key={f.id} className="item" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', width: '100%' }} onClick={() => { setItems([...items, { foodId: f.id, grams: f.servings?.[0]?.grams ?? 100 }]); setQ('') }}>{f.name}</button>)}</div>}
    {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <button className="btn primary" onClick={() => { const r = a.saveMealTemplate(name, meal, items); if (r.ok) { toast('Meal saved'); onClose() } else setErr(r.error) }}>Save meal</button></div></Modal>
}
function Targets() {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [f, setF] = useState({ calories: String(d.targets.calories), protein: String(d.targets.protein), carbs: String(d.targets.carbs), fat: String(d.targets.fat), waterMl: String(d.targets.waterMl) }); const [err, setErr] = useState<string | null>(null)
  const kcalFromMacros = round((num(f.protein) ?? 0) * 4 + (num(f.carbs) ?? 0) * 4 + (num(f.fat) ?? 0) * 9, 0)
  return <Card><div className="form"><div className="banner info"><span>These are <b>estimates</b> from your profile (Mifflin-St Jeor formula, activity level and goal). Bodies differ, so adjust them based on how your weight actually responds over 2–3 weeks.</span></div>
    <div className="two"><Field label="Calories (kcal)"><input inputMode="numeric" value={f.calories} onChange={e => setF({ ...f, calories: e.target.value })} /></Field><Field label="Water (ml)"><input inputMode="numeric" value={f.waterMl} onChange={e => setF({ ...f, waterMl: e.target.value })} /></Field></div>
    <div className="two"><Field label="Protein (g)"><input inputMode="numeric" value={f.protein} onChange={e => setF({ ...f, protein: e.target.value })} /></Field><Field label="Carbs (g)"><input inputMode="numeric" value={f.carbs} onChange={e => setF({ ...f, carbs: e.target.value })} /></Field></div>
    <Field label="Fat (g)" hint={`Macros add up to ${kcalFromMacros} kcal`}><input inputMode="numeric" value={f.fat} onChange={e => setF({ ...f, fat: e.target.value })} /></Field>
    {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <div className="row"><button className="btn primary" onClick={() => { const r = a.setTargets({ calories: num(f.calories) ?? 0, protein: num(f.protein) ?? 0, carbs: num(f.carbs) ?? 0, fat: num(f.fat) ?? 0, waterMl: num(f.waterMl) ?? 2000 }); if (r.ok) { setErr(null); toast('Targets saved') } else setErr(r.error) }}>Save targets</button>
      <button className="btn ghost" onClick={() => { a.saveProfile(d.profile, true); toast('Targets recalculated from your profile') }}>Recalculate from profile</button></div></div></Card>
}
