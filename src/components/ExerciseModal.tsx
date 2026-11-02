import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal, useToast } from './ui'
import { exerciseById } from '../data/exercises'
import { muscleById } from '../data/muscles'
import { useActions, useData } from '../store/store'
import { uid } from '../lib/id'
import { generatePlan } from '../lib/plans'
import { bestWeights } from '../lib/calc'

export default function ExerciseModal({ id, onClose }: { id: string; onClose: () => void }) {
  const ex = exerciseById(id); const d = useData(); const a = useActions(); const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [planId, setPlanId] = useState(d.activePlanId ?? d.plans[0]?.id ?? '')
  const plan = d.plans.find(p => p.id === planId); const [dayId, setDayId] = useState(plan?.days[0]?.id ?? '')
  if (!ex) return null
  const best = bestWeights(d.sessions)[ex.id]
  const add = () => {
    let p = plan
    if (!p) { p = generatePlan('custom', d.profile.equipment, d.profile.daysPerWeek); p.name = 'My plan' }
    const day = p.days.find(x => x.id === dayId) ?? p.days[0]
    if (day.exercises.some(e => e.exerciseId === ex.id)) { toast(`${ex.name} is already in ${day.name}`, 'err'); return }
    const next = { ...p, days: p.days.map(x => x.id === day.id ? { ...x, exercises: [...x.exercises, { exerciseId: ex.id, sets: 3, reps: '8-12', restSec: 90 }] } : x) }
    a.savePlan(next); toast(`Added to ${next.name} · ${day.name}`); onClose()
  }
  return <Modal title={ex.name} onClose={onClose} wide>
    <div className="row"><span className="chip on">{ex.difficulty}</span>{ex.equipment.map(e => <span key={e} className="chip">{e}</span>)}</div>
    <div><div className="eyebrow">Targets</div><div className="row" style={{ marginTop: 6 }}>{ex.primary.map(m => <span key={m} className="chip good">{muscleById(m)?.name ?? m}</span>)}{ex.secondary.map(m => <span key={m} className="chip">{muscleById(m)?.name ?? m}</span>)}</div></div>
    <div><div className="eyebrow">How to do it</div><ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
    <div><div className="eyebrow">Sets and reps</div><p>{ex.guidance}</p></div>
    <div><div className="eyebrow">Common mistakes</div><ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{ex.mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
    <div className="banner info"><span><b>Safety:</b> {ex.safety}</span></div>
    {best ? <p className="muted small">Your best logged weight: {best} kg</p> : null}
    {!adding ? <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Add to a workout</button> : <div className="form">
      {d.plans.length > 0 ? <div className="two">
        <label className="field"><span>Plan</span><select value={planId} onChange={e => { setPlanId(e.target.value); setDayId(d.plans.find(p => p.id === e.target.value)?.days[0]?.id ?? '') }}>{d.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field"><span>Day</span><select value={dayId} onChange={e => setDayId(e.target.value)}>{plan?.days.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </div> : <p className="muted small">You have no plan yet, so a new one called "My plan" will be created.</p>}
      <div className="row end"><button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" onClick={add}>Add exercise</button></div>
    </div>}
  </Modal>
}
void uid
