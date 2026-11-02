import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { Camera, Layers, RotateCcw, ChevronRight } from 'lucide-react'
import { Card, Eyebrow, PageHead, useToast, nav } from '../components/ui'
import ExerciseModal from '../components/ExerciseModal'
import { MUSCLES, muscleById } from '../data/muscles'
import type { SceneCommand } from '../body/BodyScene'
import { exercisesForMuscle } from '../data/exercises'
import { useData } from '../store/store'
import { exerciseById } from '../data/exercises'
import { fmtDate } from '../lib/date'

// three.js is loaded only when this page opens (keeps first load fast on phones)
const BodyScene = lazy(() => import('../body/BodyScene'))

export default function Body() {
  const d = useData(); const toast = useToast()
  const [mode, setMode] = useState<'real' | 'holo'>('real')
  const [sel, setSel] = useState<string | null>('pectoralis')
  const [peel, setPeel] = useState(false)
  const [cmd, setCmd] = useState<(SceneCommand & { n: number }) | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [exId, setExId] = useState<string | null>(null)
  const send = (c: SceneCommand) => setCmd(p => ({ ...c, n: (p?.n ?? 0) + 1 }))
  const m = sel ? muscleById(sel) : undefined
  const ex = useMemo(() => (sel ? exercisesForMuscle(sel) : { primary: [], secondary: [] }), [sel])
  const onSelect = useCallback((id: string | null) => setSel(id), [])
  const onError = useCallback((s: string) => setErr(s), [])
  const choose = (id: string) => { setSel(id); send({ type: 'focus', id, rotate: true }) }
  const history = useMemo(() => {
    if (!sel) return []
    return d.sessions.filter(s => s.exercises.some(e => exerciseById(e.exerciseId)?.primary.includes(sel) && e.sets.some(x => x.done))).sort((a, b) => b.startedAt - a.startedAt).slice(0, 3)
  }, [d.sessions, sel])
  const regions = ['Upper body', 'Core', 'Lower body'] as const

  return <>
    <PageHead title="Body" sub="Drag to rotate, pinch to zoom, tap a muscle." />
    <div className="body-layout">
      <div>
        <div className={`scene-wrap ${mode === 'holo' ? 'holo' : ''}`}>
          {err ? <div className="loading"><div className="center"><p>{err}</p><p className="small">You can still pick muscles from the list below.</p></div></div>
            : <Suspense fallback={<div className="loading"><div><div className="spinner" />Loading 3D model…</div></div>}>
              <BodyScene mode={mode} selected={sel} peel={peel} onSelect={onSelect} command={cmd} onError={onError} />
            </Suspense>}
          <div className="scene-overlay">
            <div className="scene-bar">
              <div className="seg" role="group" aria-label="Display mode"><button className={mode === 'real' ? 'on' : ''} onClick={() => setMode('real')}>Anatomy</button><button className={mode === 'holo' ? 'on' : ''} onClick={() => setMode('holo')}>Hologram</button></div>
              <button className={`btn sm ${peel ? 'primary' : ''}`} onClick={() => setPeel(p => !p)} aria-pressed={peel}><Layers size={15} /> Deep layer</button>
            </div>
            <div className="scene-bar" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div className="seg" role="group" aria-label="Camera view">{(['front', 'back', 'side'] as const).map(v => <button key={v} onClick={() => send({ type: 'view', view: v })}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
              <button className="icon-btn" onClick={() => send({ type: 'reset' })} aria-label="Reset camera" style={{ background: 'rgba(6,12,22,.75)' }}><RotateCcw size={16} /></button>
            </div>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          <Camera size={12} style={{ verticalAlign: -2 }} /> Procedural anatomical model: muscle positions follow real anatomy, but it is not a scan. See README → "3D body" for how to swap in a licensed GLB.
        </p>
      </div>

      <div className="col">
        <Card>
          {m ? <>
            <Eyebrow>{m.region}{m.deep ? ' · deep layer' : ''}</Eyebrow><h2 style={{ margin: '2px 0 8px' }}>{m.name}</h2>
            <p><b>Location:</b> {m.location}</p><p style={{ marginTop: 6 }}><b>Function:</b> {m.function}</p><p style={{ marginTop: 6 }}><b>Movement:</b> {m.movement}</p>
            <div className="region-label">Primary exercises</div>
            <div className="muscle-list">{ex.primary.length ? ex.primary.map(e => <button key={e.id} className="chip on" onClick={() => setExId(e.id)}>{e.name}</button>) : <span className="muted small">None in the library yet</span>}</div>
            {ex.secondary.length > 0 && <><div className="region-label">Secondary exercises</div><div className="muscle-list">{ex.secondary.map(e => <button key={e.id} className="chip" onClick={() => setExId(e.id)}>{e.name}</button>)}</div></>}
            <div className="region-label">Training tips</div><ul style={{ margin: 0, paddingLeft: 18 }}>{m.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <div className="region-label">Your recent work</div>
            {history.length ? history.map(s => <div key={s.id} className="small">{fmtDate(s.date)} · {s.dayName}</div>) : <p className="muted small">No logged sessions have trained this muscle yet.</p>}
            <div className="row" style={{ marginTop: 12 }}><button className="btn primary sm" onClick={() => nav('/workouts')}>Open workouts <ChevronRight size={14} /></button><button className="btn ghost sm" onClick={() => { setSel(null); toast('Selection cleared') }}>Clear</button></div>
          </> : <p className="muted">Tap a muscle on the model or choose one below.</p>}
        </Card>
        <Card>
          {regions.map(r => <div key={r}><div className="region-label">{r}</div><div className="muscle-list">{MUSCLES.filter(x => x.region === r).map(x => <button key={x.id} className={`chip ${sel === x.id ? 'on' : ''}`} onClick={() => choose(x.id)}>{x.name}</button>)}</div></div>)}
        </Card>
      </div>
    </div>
    {exId && <ExerciseModal id={exId} onClose={() => setExId(null)} />}
  </>
}
