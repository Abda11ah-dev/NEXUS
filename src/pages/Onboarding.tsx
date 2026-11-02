import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Field } from '../components/ui'
import type { Equipment, Profile } from '../store/types'
import { useActions, useData } from '../store/store'
import { defaultTargets, kgToLb, lbToKg, round, tdee } from '../lib/calc'
import { generatePlan, recommendedStyle } from '../lib/plans'
import { num } from '../lib/validate'
import { defaultProfile } from '../lib/storage'

const EQUIP: [Equipment, string][] = [['bodyweight', 'No equipment'], ['dumbbells', 'Dumbbells'], ['barbell', 'Barbell'], ['bench', 'Bench'], ['pullupbar', 'Pull-up bar'], ['bands', 'Resistance bands'], ['machines', 'Gym machines']]
/** Profile form sections, shared by onboarding (one step at a time) and Settings (all at once). */
export function ProfileSections({ p, set, sections, wInput, setW, tInput, setT }: { p: Profile; set: (n: Partial<Profile>) => void; sections: number[]; wInput: string; setW: (v: string) => void; tInput: string; setT: (v: string) => void }) {
  const wu = p.units.weight, lu = p.units.length
  return <>
    {sections.includes(0) && <div className="form">
      <Field label="Preferred name"><input value={p.name} onChange={e => set({ name: e.target.value })} autoComplete="given-name" /></Field>
      <div className="two"><Field label="Age"><input inputMode="numeric" value={p.age || ''} onChange={e => set({ age: Number(e.target.value) || 0 })} /></Field><Field label="Sex (for calorie estimates)"><select value={p.sex} onChange={e => set({ sex: e.target.value as Profile['sex'] })}><option value="male">Male</option><option value="female">Female</option></select></Field></div>
      <div className="two"><Field label="Weight units"><select value={wu} onChange={e => { const u = e.target.value as 'kg' | 'lb'; const cur = num(wInput), tg = num(tInput); if (cur !== null) setW(String(round(u === 'lb' ? kgToLb(wu === 'lb' ? lbToKg(cur) : cur) : (wu === 'lb' ? lbToKg(cur) : cur), 1))); if (tg !== null) setT(String(round(u === 'lb' ? kgToLb(wu === 'lb' ? lbToKg(tg) : tg) : (wu === 'lb' ? lbToKg(tg) : tg), 1))); set({ units: { ...p.units, weight: u } }) }}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></Field>
        <Field label="Length units"><select value={lu} onChange={e => set({ units: { ...p.units, length: e.target.value as 'cm' | 'in' } })}><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></Field></div>
      <Field label={`Height (${lu})`}><input inputMode="decimal" value={p.heightCm ? round(lu === 'cm' ? p.heightCm : p.heightCm / 2.54, 1) : ''} onChange={e => { const n = num(e.target.value); set({ heightCm: n === null ? 0 : lu === 'cm' ? n : n * 2.54 }) }} /></Field>
    </div>}
    {sections.includes(1) && <div className="form">
      <div className="two"><Field label={`Current weight (${wu})`}><input inputMode="decimal" value={wInput} onChange={e => setW(e.target.value)} /></Field><Field label={`Target weight (${wu})`}><input inputMode="decimal" value={tInput} onChange={e => setT(e.target.value)} /></Field></div>
      <Field label="Main goal"><select value={p.goal} onChange={e => set({ goal: e.target.value as Profile['goal'] })}><option value="gain">Gain muscle / weight</option><option value="lose">Lose fat</option><option value="maintain">Maintain and get fitter</option></select></Field>
      <div className="two"><Field label="Training experience"><select value={p.experience} onChange={e => set({ experience: e.target.value as Profile['experience'] })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
        <Field label="Daily activity (outside training)"><select value={p.activity} onChange={e => set({ activity: e.target.value as Profile['activity'] })}><option value="low">Mostly seated</option><option value="moderate">On my feet some of the day</option><option value="high">Physical job / very active</option></select></Field></div>
    </div>}
    {sections.includes(2) && <div className="form">
      <Field label="Training days per week"><select value={p.daysPerWeek} onChange={e => set({ daysPerWeek: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
      <div><div className="small muted" style={{ marginBottom: 6 }}>Equipment you can use</div><div className="pill-row">{EQUIP.map(([k, label]) => <button type="button" key={k} className={`chip ${p.equipment.includes(k) ? 'on' : ''}`} aria-pressed={p.equipment.includes(k)} onClick={() => set({ equipment: p.equipment.includes(k) ? p.equipment.filter(x => x !== k) : [...p.equipment, k] })}>{label}</button>)}</div></div>
    </div>}
    {sections.includes(3) && <div className="form">
      <Field label="Food preferences" hint="e.g. likes ugali and beans, eats fish, tight budget"><textarea value={p.foodPrefs} onChange={e => set({ foodPrefs: e.target.value })} /></Field>
      <Field label="Dietary restrictions or allergies"><textarea value={p.restrictions} onChange={e => set({ restrictions: e.target.value })} placeholder="e.g. no pork, lactose intolerant" /></Field>
    </div>}
  </>
}
export const toKg = (s: string, unit: 'kg' | 'lb') => { const n = num(s); return n === null ? 0 : unit === 'kg' ? n : lbToKg(n) }

export default function Onboarding() {
  const d = useData(); const a = useActions(); const [step, setStep] = useState(0)
  const [p, setP] = useState<Profile>({ ...defaultProfile(), ...d.profile, weightKg: 0, targetKg: 0, heightCm: 0, age: 0, name: d.profile.name })
  const [w, setW] = useState(''); const [t, setT] = useState(''); const [err, setErr] = useState<string | null>(null); const [plan, setPlan] = useState(true)
  const set = (n: Partial<Profile>) => setP(x => ({ ...x, ...n }))
  const full = (): Profile => ({ ...p, weightKg: toKg(w, p.units.weight), targetKg: toKg(t, p.units.weight), onboarded: true })
  const next = () => {
    if (step === 0 && !p.name.trim()) return setErr('Please enter a name.')
    if (step === 0 && (p.age < 10 || p.age > 100)) return setErr('Enter an age between 10 and 100.')
    if (step === 0 && (p.heightCm < 100 || p.heightCm > 250)) return setErr('Enter a realistic height.')
    if (step === 1) { const f = full(); if (f.weightKg < 20 || f.weightKg > 400) return setErr('Enter your current weight.'); if (f.targetKg < 20 || f.targetKg > 400) return setErr('Enter your target weight.') }
    setErr(null); setStep(step + 1)
  }
  const finish = () => {
    const f = full(); const r = a.saveProfile(f, true); if (!r.ok) { setErr(r.error); return }
    if (plan) a.savePlan(generatePlan(recommendedStyle(f.daysPerWeek), f.equipment, f.daysPerWeek))
  }
  const preview = step === 3 && full().weightKg ? defaultTargets(full()) : null
  return <div className="onboard">
    <div className="brand"><div className="brand-mark"><Zap size={19} /></div><div><b>NEXUS</b><small>PERSONAL FITNESS OS</small></div></div>
    <div className="steps">{[0, 1, 2, 3].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
    <div><h1>{['Tell us about you', 'Your body and goal', 'How you train', 'Food and targets'][step]}</h1><p className="muted">Step {step + 1} of 4. Everything stays on your device, and you can change it later in Settings.</p></div>
    <ProfileSections p={p} set={set} sections={[step]} wInput={w} setW={setW} tInput={t} setT={setT} />
    {preview && <div className="card"><div className="eyebrow">Your starting targets (estimates)</div><p style={{ marginTop: 6 }}><b>{preview.calories} kcal</b> · protein {preview.protein} g · carbs {preview.carbs} g · fat {preview.fat} g · water {preview.waterMl / 1000} L</p>
      <p className="muted small" style={{ marginTop: 6 }}>Estimated maintenance is about {Math.round(tdee(full()))} kcal. These numbers come from a standard formula and are only a starting point. Change them any time in Nutrition → Targets.</p>
      <label className="row" style={{ marginTop: 8 }}><input type="checkbox" checked={plan} onChange={e => setPlan(e.target.checked)} /><span>Create a starter workout plan for {p.daysPerWeek} days/week</span></label></div>}
    {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}
    <div className="row between">{step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button> : <span />}{step < 3 ? <button className="btn primary" onClick={next}>Continue</button> : <button className="btn primary" onClick={finish}>Start using NEXUS</button>}</div>
  </div>
}
