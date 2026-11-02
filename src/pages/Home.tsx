import { useMemo } from 'react'
import { BrainCircuit, Dumbbell, Droplets, Flame, Moon, Plus, Target } from 'lucide-react'
import { Card, Eyebrow, Progress, Ring, Spark, Stat, nav, useToast } from '../components/ui'
import { useActions, useData } from '../store/store'
import { buildContext } from '../jarvis/context'
import { fmtLong, relativeDay, todayStr, weekday, WEEKDAYS, addDays, diffDays } from '../lib/date'
import { dayTotals, fmtWeight, goalProgress, latestWeight, pct, round, sortByDate, waterToday, weeklyTrend } from '../lib/calc'
import { occurrences } from '../lib/recurrence'
import { exerciseById } from '../data/exercises'

export default function Home() {
  const d = useData(); const a = useActions(); const toast = useToast(); const today = todayStr()
  const lw = latestWeight(d.weights); const first = sortByDate(d.weights)[0]; const unit = d.profile.units.weight
  const t = dayTotals(d.foodLog, today); const g = d.targets; const water = waterToday(d)
  const plan = d.plans.find(p => p.id === d.activePlanId); const day = plan?.days.find(x => x.weekday === weekday(today)); const trained = d.sessions.some(s => s.date === today)
  const sleep = d.sleep.find(s => s.date === today) ?? d.sleep.find(s => s.date === addDays(today, -1))
  const upcoming = useMemo(() => occurrences(d.events, today, addDays(today, 7)).filter(o => !o.done).slice(0, 3), [d.events, today])
  const tasks = d.tasks.filter(x => !x.done).slice(0, 3); const trend = weeklyTrend(d.weights)
  const spark = sortByDate(d.weights).slice(-14).map(w => w.kg)
  const ctx = buildContext({ ...d, settings: { ...d.settings, jarvisShareData: true } })!
  const insights: string[] = []
  if (!lw || diffDays(lw.date, today) > 6) insights.push('No weigh-in in the last week. Log your weight to keep your trend accurate.')
  if (ctx.todayIntake.kcal === 0 && Number(new Date().getHours()) >= 10) insights.push('Nothing logged in Nutrition yet today.')
  else if (ctx.intake7 && ctx.intake7.avgKcal < g.calories * 0.85 && d.profile.goal === 'gain') insights.push(`You average ${ctx.intake7.avgKcal} kcal vs a ${g.calories} kcal target: under-eating is the likeliest reason weight isn't climbing.`)
  if (ctx.todayWorkout && !ctx.todayWorkout.done) insights.push(`${ctx.todayWorkout.day} is scheduled today.`)
  if (water < g.waterMl * 0.4 && Number(new Date().getHours()) >= 14) insights.push('Water intake is low for this time of day.')
  const gp = lw && first ? goalProgress(first.kg, lw.kg, d.profile.targetKg) : 0
  const hour = new Date().getHours()
  return <>
    <header className="page-head"><div><div className="eyebrow">{fmtLong(today)}</div><h1>{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}{d.profile.name ? `, ${d.profile.name}` : ''}</h1></div></header>
    <div className="grid g2" style={{ marginBottom: 12 }}>
      <Stat label="Weight" to="/progress" value={lw ? round(unit === 'kg' ? lw.kg : lw.kg * 2.2046226, 1) : '—'} unit={lw ? unit : undefined} sub={lw ? `Target ${fmtWeight(d.profile.targetKg, unit)}` : 'Tap to log your first weight'} />
      <Stat label="Change" to="/progress" value={lw && first && d.weights.length > 1 ? `${lw.kg - first.kg >= 0 ? '+' : ''}${round(unit === 'kg' ? lw.kg - first.kg : (lw.kg - first.kg) * 2.2046226, 1)}` : '—'} unit={unit} sub={trend !== null ? `trend ${trend >= 0 ? '+' : ''}${trend} kg/wk (est.)` : 'needs more entries'} />
    </div>
    <div className="grid two-main" style={{ gap: 12 }}>
      <div className="col">
        <Card onClick={() => nav('/nutrition')} label="Open nutrition log">
          <div className="row between nowrap"><div><Eyebrow>Calories today</Eyebrow><div className="stat-value">{Math.round(t.kcal)}<small>/ {g.calories} kcal</small></div></div><Ring value={pct(t.kcal, g.calories)} /></div>
          <div className="grid g3" style={{ marginTop: 10 }}>{([['Protein', t.protein, g.protein], ['Carbs', t.carbs, g.carbs], ['Fat', t.fat, g.fat]] as const).map(([n, v, tg]) => <div key={n}><div className="small muted">{n} {Math.round(v)}/{tg}g</div><Progress value={pct(v, tg)} /></div>)}</div>
        </Card>
        <Card onClick={() => nav('/workouts')} label="Open workouts">
          <div className="row between nowrap"><div><Eyebrow>Today's workout</Eyebrow>
            {day ? <><h2 style={{ marginTop: 2 }}>{day.name}</h2><div className="muted small">{day.exercises.slice(0, 3).map(e => exerciseById(e.exerciseId)?.name).join(' · ')}{day.exercises.length > 3 ? ` +${day.exercises.length - 3}` : ''}</div></>
              : <><h2 style={{ marginTop: 2 }}>{plan ? 'Rest day' : 'No plan yet'}</h2><div className="muted small">{plan ? `Nothing scheduled on ${WEEKDAYS[weekday(today)]}` : 'Create a plan in Workouts'}</div></>}</div>
            <span className={`chip ${trained ? 'good' : ''}`}><Dumbbell size={13} /> {trained ? 'Done' : day ? 'Start' : 'Open'}</span></div>
        </Card>
        <div className="grid g2">
          <Card><div className="row between"><Eyebrow>Water</Eyebrow><Droplets size={16} style={{ color: 'var(--acc)' }} /></div><div className="stat-value" onClick={() => nav('/progress?tab=habits')} style={{ cursor: 'pointer' }}>{(water / 1000).toFixed(2)}<small>/ {(g.waterMl / 1000).toFixed(1)} L</small></div><Progress value={pct(water, g.waterMl)} />
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { a.addWater(250); toast('+250 ml') }}><Plus size={13} /> 250 ml</button></Card>
          <Card onClick={() => nav('/progress?tab=habits')} label="Open sleep log"><div className="row between"><Eyebrow>Sleep</Eyebrow><Moon size={16} style={{ color: 'var(--acc2)' }} /></div>{sleep ? <><div className="stat-value">{sleep.hours}<small>h</small></div><div className="muted small">quality {sleep.quality}/5</div></> : <div className="muted small" style={{ marginTop: 8 }}>No sleep logged. Tap to add.</div>}</Card>
        </div>
        {spark.length >= 2 && <Card onClick={() => nav('/progress')} label="Open progress"><div className="row between"><Eyebrow>Recent weight</Eyebrow><span className="muted small">{round(gp * 100, 0)}% to target</span></div><Spark values={spark} /></Card>}
      </div>
      <div className="col">
        <Card onClick={() => nav('/jarvis')} label="Open Jarvis"><div className="row nowrap"><div className="brand-mark" style={{ flexShrink: 0 }}><BrainCircuit size={18} /></div><div><Eyebrow>Insights</Eyebrow>{insights.length ? insights.slice(0, 3).map((i, k) => <p key={k} style={{ marginTop: 4 }}>{i}</p>) : <p style={{ marginTop: 4 }} className="muted">You're on track today. Ask Jarvis for a deeper review.</p>}</div></div></Card>
        <Card><div className="row between"><Eyebrow>Upcoming</Eyebrow><button className="btn ghost sm" onClick={() => nav('/calendar')}>Calendar</button></div>
          {!upcoming.length && !tasks.length ? <p className="muted small" style={{ marginTop: 6 }}>No reminders or tasks. Add some in Calendar.</p> : <div className="list">{upcoming.map(o => <div className="item" key={o.event.id + o.date}><div className="grow"><div className="t">{o.event.title}</div><div className="s">{relativeDay(o.date)} · {o.event.start}</div></div></div>)}{tasks.map(tk => <div className="item" key={tk.id}><input type="checkbox" aria-label={`Complete ${tk.title}`} onChange={() => a.updateTask(tk.id, { done: true })} /><div className="grow"><div className="t">{tk.title}</div><div className="s">{tk.priority}{tk.due ? ` · due ${relativeDay(tk.due)}` : ''}</div></div></div>)}</div>}</Card>
        <Card onClick={() => nav('/body')} label="Open body model"><div className="row between nowrap"><div><Eyebrow>Body</Eyebrow><p style={{ marginTop: 4 }}>Explore muscles in 3D and see the exercises that train them.</p></div><Target style={{ color: 'var(--acc)' }} /></div></Card>
        <Card onClick={() => nav('/progress?tab=awards')} label="Open achievements"><div className="row between"><Eyebrow>Streak</Eyebrow><Flame size={16} style={{ color: 'var(--warn)' }} /></div><p className="muted small" style={{ marginTop: 4 }}>Awards unlock only from what you log.</p></Card>
      </div>
    </div>
  </>
}
