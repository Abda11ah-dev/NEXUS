// Jarvis OFFLINE / DEMO engine.
// This is NOT an AI model. It is a rule-based assistant that reads your real NEXUS data, remembers the
// current conversation (topic, last suggestion, pending question) and can propose app actions.
// Every message it produces is labelled "demo" in the UI.
import type { ActionPayload, AppData, JarvisMemory, MealType, Proposal, Suggestion } from '../store/types'
import type { JarvisContext } from './context'
import { buildContext } from './context'
import { makeProposal } from './actions'
import { EXERCISES, exerciseById } from '../data/exercises'
import { MUSCLES } from '../data/muscles'
import { REFERENCE_FOODS, allFoods, foodById } from '../data/foods'
import { addDays, fmtLong, nowTime, todayStr, weekday, WEEKDAYS_LONG, minToTime, timeToMin } from '../lib/date'
import { canDo, recommendedStyle } from '../lib/plans'
import { foodMacros, fmtWeight, round } from '../lib/calc'

export interface DemoReply { text: string; proposals?: Proposal[]; memory: JarvisMemory }
const pick = <T,>(a: T[], seed: number): T => a[Math.abs(seed) % a.length]
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h }
const has = (t: string, re: RegExp) => re.test(t)
const mealNow = (): MealType => { const h = Number(nowTime().slice(0, 2)); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner' }

/** Parse "5pm", "17:30", "at 6", "tomorrow", "monday" into a date + time. */
function parseWhen(t: string, fallbackTime?: string): { date?: string; time?: string } {
  const today = todayStr(); let date: string | undefined; let time: string | undefined
  if (/\btomorrow\b/.test(t)) date = addDays(today, 1); else if (/\btoday\b|\btonight\b/.test(t)) date = today
  else { const i = WEEKDAYS_LONG.findIndex(w => t.includes(w.toLowerCase())); if (i >= 0) { let n = (i - weekday(today) + 7) % 7; if (n === 0) n = 7; date = addDays(today, n) } }
  const m = t.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? t.match(/\bat\s*(\d{1,2})(?::(\d{2}))?\b/) ?? t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (m) { let h = Number(m[1]); const mi = Number(m[2] ?? 0); const ap = m[3]; if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h <= 23) time = minToTime(h * 60 + mi) }
  else if (/\bevening\b/.test(t)) time = '18:00'; else if (/\bmorning\b/.test(t)) time = '07:00'; else if (/\bafternoon\b/.test(t)) time = '15:00'
  return { date, time: time ?? fallbackTime }
}
const findFood = (t: string, d: AppData) => {
  const aliases: Record<string, string> = { eggs: 'egg', 'peanut butter': 'peanut-butter', pb: 'peanut-butter', rice: 'rice-cooked', beans: 'beans-cooked', ndengu: 'ndengu-cooked', 'green grams': 'ndengu-cooked', oats: 'oats-porridge', porridge: 'oats-porridge', 'sweet potato': 'sweet-potato', potatoes: 'potato', potato: 'potato', 'sukuma': 'sukuma', cabbage: 'cabbage-boiled', milk: 'milk', banana: 'banana', bananas: 'banana', ugali: 'ugali', chapati: 'chapati', chapo: 'chapati', mandazi: 'mandazi', githeri: 'githeri', chicken: 'chicken-breast', beef: 'beef-stew', fish: 'tilapia', tilapia: 'tilapia', bread: 'bread', avocado: 'avocado', yoghurt: 'yoghurt', groundnuts: 'groundnuts', omena: 'omena', matoke: 'matoke', mango: 'mango', orange: 'orange', chai: 'chai', tea: 'chai', whey: 'whey', 'protein powder': 'whey' }
  for (const f of d.customFoods) if (t.includes(f.name.toLowerCase())) return f
  for (const k of Object.keys(aliases).sort((a, b) => b.length - a.length)) if (t.includes(k)) return foodById(aliases[k], d.customFoods)
  return undefined
}
function quantity(t: string, f: { servings?: { label: string; grams: number }[] }): number | null {
  const g = t.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?|gm)\b/); if (g) return Number(g[1])
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml\b/); if (ml) return Number(ml[1])
  const n = t.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|a|an|half)\b\s*(?:cups?|glass(?:es)?|pieces?|slices?|tablespoons?|tbsp|scoops?|plates?|bowls?|servings?)?/)
  const words: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5 }
  if (n && f.servings?.length) { const k = isNaN(Number(n[1])) ? words[n[1]] : Number(n[1]); if (k && k <= 20) return Math.round(k * f.servings[0].grams) }
  return null
}
const MUSCLE_WORDS: [RegExp, string][] = [[/chest|pec/, 'pectoralis'], [/shoulder|delt/, 'deltoids'], [/bicep/, 'biceps'], [/tricep/, 'triceps'], [/forearm|grip/, 'forearms'], [/trap/, 'trapezius'], [/\blat|back width|pull/, 'lats'], [/lower back|erector/, 'erectors'], [/\babs?\b|core|six.?pack/, 'abs'], [/oblique/, 'obliques'], [/glute|butt/, 'glutes'], [/quad/, 'quadriceps'], [/hamstring/, 'hamstrings'], [/adductor|inner thigh/, 'adductors'], [/calf|calves/, 'gastrocnemius'], [/\bback\b/, 'lats'], [/\bleg/, 'quadriceps'], [/\barm/, 'biceps']]
const CONCEPTS: [RegExp, string][] = [
  [/progressive overload/, 'Progressive overload means gradually asking your muscles to do a bit more over time: one more rep, a little more weight, or one extra set. Muscles only grow when they have a reason to. A simple rule: when you can do the top of your rep range on every set with good form, add the smallest weight jump next session. Log your sets in Workouts and I can tell you where you are stalling.'],
  [/protein/, 'For building muscle, roughly 1.6–2.2 g of protein per kg of body weight per day is a well-supported range. Spread it over 3–4 meals. Affordable sources in Kenya: eggs, beans, ndengu, milk, omena, tilapia, chicken, and groundnuts. It is a guideline, not a medical prescription.'],
  [/surplus|bulk(ing)?\b/, 'A calorie surplus means eating more energy than you burn. For lean gain, a surplus of about 250–500 kcal above maintenance is a sensible start; expect around 0.25–0.5 kg per week for a beginner. If the scale is flat for two weeks while you are training consistently, add ~150–250 kcal per day.'],
  [/deficit|cutting|fat loss|lose weight/, 'A calorie deficit means eating a bit less than you burn. About 300–500 kcal under maintenance is usually sustainable. Keep protein high and keep lifting so you lose fat rather than muscle.'],
  [/hypertroph|muscle growth|how do muscles grow/, 'Muscle growth (hypertrophy) comes from three things working together: enough hard sets (roughly 10–20 per muscle per week), progressive overload, and enough food, protein and sleep to recover. Rep ranges from about 5 to 30 can all work if the set is taken close to failure.'],
  [/rest day|recovery|overtrain|soreness/, 'Muscles grow while you recover, not while you lift. Aim for 7–9 hours of sleep, at least one full rest day a week, and avoid training the same muscle hard on consecutive days. Mild soreness is normal; sharp or joint pain is not, so stop and rest if you feel it.'],
  [/sleep/, 'Sleep is when most recovery happens. Aim for 7–9 hours. Short sleep makes hunger harder to control and reduces training performance. Log your sleep in Progress → Habits and I can spot patterns.'],
  [/rep range|how many reps|how many sets/, 'A practical default: 3–4 sets of 6–12 reps for most lifts, 12–20 for isolation moves like lateral raises and calves, and 3–6 for heavy compound strength work. Stop each set with 1–3 reps still in reserve, except the last set where you can go closer to failure.'],
  [/creatine/, 'Creatine monohydrate is one of the best-studied supplements for strength and muscle. A typical dose is 3–5 g per day. It is optional, and you should check with a doctor first if you have kidney problems or take medication.']
]

/** Main entry: produce Jarvis's reply to `input`. */
export function demoRespond(input: string, d: AppData, mem: JarvisMemory, turn: number): DemoReply {
  const t = input.toLowerCase().trim(); const ctx = buildContext(d); const seed = hash(t) + turn
  const m: JarvisMemory = { ...mem }
  const out = (text: string, extra: Partial<DemoReply> = {}): DemoReply => ({ text, memory: m, ...extra })
  const prop = (a: ActionPayload) => makeProposal(a, d)
  const wu = d.profile.units.weight
  const noData = (what: string) => out(`I can't see your ${what} because data sharing with Jarvis is switched off (Settings → Jarvis). Turn it on, or tell me the numbers and I'll work from those.`)

  // ---- 1. A question I asked earlier is being answered ----
  if (m.awaiting) {
    const a = m.awaiting; const num = t.match(/(\d+(?:[.,]\d+)?)/)
    if (a.type === 'weight') {
      if (num) { let v = Number(num[1].replace(',', '.')); if (wu === 'lb' || /lb|pound/.test(t)) v = v * 0.45359237; if (v >= 20 && v <= 400) { m.awaiting = undefined; return out(`Got it: ${round(v, 1)} kg. Confirm below and I'll save it to today's log.`, { proposals: [prop({ type: 'log_weight', kg: round(v, 1) })] }) } }
      if (/never mind|cancel|skip/.test(t)) { m.awaiting = undefined; return out('No problem, we can do it later.') }
      return out('I need a number between 20 and 400 kg, for example "62.5". What is your weight today?')
    }
    if (a.type === 'water') {
      if (num) { m.awaiting = undefined; let ml = Number(num[1]); if (/\bl\b|litre|liter/.test(t) && ml < 10) ml *= 1000; return out(`${Math.round(ml)} ml of water. Confirm to log it.`, { proposals: [prop({ type: 'log_water', ml: Math.round(ml) })] }) }
    }
    if (a.type === 'event_time') {
      const w = parseWhen(t); const title = String(a.payload?.title ?? 'Event'); const date = w.date ?? String(a.payload?.date ?? todayStr())
      if (w.time) { m.awaiting = undefined; return out(`Here is the calendar entry I'd create. Approve it and it goes in.`, { proposals: [prop({ type: 'add_event', title, date, start: w.time, kind: (a.payload?.kind as 'workout' | 'meal' | 'event') ?? 'event' })] }) }
      return out('What time should it start? For example "5pm" or "17:30".')
    }
    if (a.type === 'task_title') { m.awaiting = undefined; return out('Here is the task. Approve to add it.', { proposals: [prop({ type: 'add_task', title: input.trim().slice(0, 140) })] }) }
  }

  // ---- 2. Follow-ups that depend on what we just discussed ----
  const sug = m.suggestion
  if (sug && has(t, /\b(add|put|save|schedule|book)\b.*\b(that|it|this)\b.*\b(schedule|calendar|plan|diary)\b|\bschedule (that|it|this)\b/)) {
    const w = parseWhen(t, sug.kind === 'workout' ? '17:00' : sug.meal === 'breakfast' ? '07:30' : '13:00'); const date = w.date ?? todayStr()
    if (!w.time) { m.awaiting = { type: 'event_time', payload: { title: sug.title, date, kind: sug.kind === 'workout' ? 'workout' : sug.kind === 'meal' ? 'meal' : 'event' } }; return out(`Sure, I'll schedule "${sug.title}". What time should it be, and is ${date === todayStr() ? 'today' : fmtLong(date)} right?`) }
    return out(`Here is the calendar change for "${sug.title}". Nothing is saved until you approve it.`, { proposals: [prop({ type: 'add_event', title: sug.title, date, start: w.time, end: minToTime(timeToMin(w.time) + (sug.kind === 'workout' ? 60 : 30)), kind: sug.kind === 'workout' ? 'workout' : sug.kind === 'meal' ? 'meal' : 'event' })] })
  }
  if (sug?.kind === 'meal' && sug.items && has(t, /^(yes|yeah|ok(ay)?|sure|do it|go ahead|log (that|it|this)|add (that|it|this)( to (my )?(food )?log)?|please do)\b/)) {
    return out(`Here's what I'd log as ${sug.meal ?? 'a meal'}. Confirm to save it.`, { proposals: [prop({ type: 'log_meal_items', items: sug.items, meal: sug.meal ?? mealNow(), label: sug.title })] })
  }

  // ---- 3. Direct actions ----
  if (has(t, /\b(log|record|add|enter)\b.*\bweight\b|\bi (weigh|weighed|am)\s+\d|\bmy weight (is|was)\s+\d|\bweigh(ed)?\s+\d/)) {
    const n = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs|pounds)?/)
    if (n) { let v = Number(n[1].replace(',', '.')); if (/lb|pound/.test(n[2] ?? '') || (wu === 'lb' && !n[2])) v *= 0.45359237; if (v >= 20 && v <= 400) return out(`Noted: ${round(v, 1)} kg. Approve below to add it to today's log.`, { proposals: [prop({ type: 'log_weight', kg: round(v, 1) })] }) }
    m.awaiting = { type: 'weight' }; return out(pick(['Sure. What do you weigh today?', 'Happy to log it. What does the scale say?'], seed))
  }
  if (has(t, /\b(drank|drink|had|log|add|record)\b.*\b(\d+(?:\.\d+)?)\s*(ml|l|litres?|liters?|cups?|glass(?:es)?)\b/)) {
    const n = t.match(/(\d+(?:\.\d+)?)\s*(ml|l|litres?|liters?|cups?|glass(?:es)?)\b/)!; let ml = Number(n[1]); const u = n[2]
    if (/^l|litre|liter/.test(u)) ml *= 1000; else if (/cup/.test(u)) ml *= 250; else if (/glass/.test(u)) ml *= 250
    return out(`${Math.round(ml)} ml of water. Confirm to log it.`, { proposals: [prop({ type: 'log_water', ml: Math.round(ml) })] })
  }
  if (has(t, /\bremind me to\b|\b(add|create|new)\b.*\b(task|to-?do|todo)\b/)) {
    const mm = input.match(/remind me to\s+(.+)/i) ?? input.match(/(?:task|to-?do|todo)\s*(?:to|:)?\s*(.+)/i)
    const title = mm?.[1]?.replace(/\b(tomorrow|today|tonight)\b/i, '').trim()
    if (title) { const w = parseWhen(t); return out('I can add that as a task. Approve below.', { proposals: [prop({ type: 'add_task', title: title.charAt(0).toUpperCase() + title.slice(1), due: w.date })] }) }
    m.awaiting = { type: 'task_title' }; return out('What is the task?')
  }
  if (has(t, /\b(schedule|book|put|add)\b.*\b(calendar|schedule|event|session|meeting)\b|\bschedule\b\s+\w/) && !sug) {
    const w = parseWhen(t); const title = input.replace(/\b(please|schedule|book|add|put|to my calendar|on my calendar|in my calendar|at \d.*|tomorrow|today)\b/gi, '').replace(/\s+/g, ' ').trim() || 'Event'
    if (w.time) return out('Here is the event. Approve it to add it to your calendar.', { proposals: [prop({ type: 'add_event', title: title.charAt(0).toUpperCase() + title.slice(1), date: w.date ?? todayStr(), start: w.time, kind: /workout|gym|train/.test(t) ? 'workout' : 'event' })] })
    m.awaiting = { type: 'event_time', payload: { title: title.charAt(0).toUpperCase() + title.slice(1), date: w.date ?? todayStr() } }; return out(`What time should "${title}" start?`)
  }
  if (has(t, /\b(ate|eaten|had|log|record|add|just ate)\b/) && !has(t, /\b(my|the) (calories|nutrition|food log)\b/)) {
    const f = findFood(t, d)
    if (f) {
      const g = quantity(t, f)
      const meal: MealType = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).find(x => t.includes(x)) ?? mealNow()
      if (g && g >= 1 && g <= 5000) { const mac = foodMacros(f, g); return out(`${g} g of ${f.name} is about ${mac.kcal} kcal, ${mac.protein} g protein. I'd log it as ${meal}. Confirm to save.`, { proposals: [prop({ type: 'log_meal', foodId: f.id, grams: g, meal })] }) }
      return out(`How much ${f.name.toLowerCase()} did you have? You can say grams ("200 g") or a serving${f.servings?.length ? ` (for example "${f.servings[0].label}")` : ''}.`)
    }
  }
  if (has(t, /\b(set|change|update|raise|lower)\b.*\b(calorie|protein)\b.*\d{2,4}/)) {
    const cal = t.match(/(\d{3,4})\s*(kcal|cal|calories)?/), pro = t.match(/(\d{2,3})\s*g\b.*protein|protein.*?(\d{2,3})/)
    const a: ActionPayload = /protein/.test(t) && !/calorie/.test(t) ? { type: 'set_targets', protein: Number(pro?.[1] ?? pro?.[2]) } : { type: 'set_targets', calories: Number(cal?.[1]) }
    return out('Changing targets affects every nutrition screen, so I need your approval first.', { proposals: [prop(a)] })
  }
  if (has(t, /\b(build|make|create|generate|set up|give me)\b.*\b(plan|routine|program|split)\b/) && !/today/.test(t)) {
    const style = /ppl|push.?pull|legs/.test(t) ? 'ppl' : /upper.?lower/.test(t) ? 'upperlower' : /full.?body/.test(t) ? 'fullbody' : recommendedStyle(d.profile.daysPerWeek)
    return out(`Based on ${d.profile.daysPerWeek} training days a week and your equipment, a ${style === 'ppl' ? 'push/pull/legs' : style === 'upperlower' ? 'upper/lower' : 'full-body'} plan fits. I'll build it from exercises you can do with what you have. You can edit every exercise afterwards. Approve to create it.`, { proposals: [prop({ type: 'create_plan', style })] })
  }

  // ---- 4. Analysis (needs data) ----
  if (has(t, /(build|make|plan|give me|what).*\b(today'?s?|todays)\b.*\bworkout|\bworkout for today|\btoday'?s workout|what should i train/)) {
    if (!ctx) return noData('workout plan')
    m.topic = 'workout'
    if (ctx.todayWorkout) {
      const w = ctx.todayWorkout; const title = `${w.day} workout`; m.suggestion = { kind: 'workout', title, detail: w.exercises.join(', ') }
      return out(`${w.done ? 'You already trained today, but here is the plan again' : 'Today is'}: ${w.day} (${w.plan}).\n\n${w.exercises.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nStart it from Workouts to log your sets. Want me to put it in your calendar?`)
    }
    const groups = d.profile.daysPerWeek >= 5 ? ['pectoralis', 'deltoids', 'triceps'] : ['quadriceps', 'glutes', 'pectoralis', 'lats']
    const ex = groups.flatMap(g => EXERCISES.filter(e => e.primary.includes(g) && canDo(e.id, d.profile.equipment)).slice(0, 1)).slice(0, 5)
    m.suggestion = { kind: 'workout', title: 'Full-body workout', detail: ex.map(e => e.name).join(', ') }
    return out(`You have no plan scheduled for today, so here is a simple full-body session using your equipment:\n\n${ex.map((e, i) => `${i + 1}. ${e.name}, ${e.guidance}`).join('\n')}\n\nSay "add that to my schedule" and I'll prepare the calendar entry, or ask me to build a full weekly plan.`)
  }
  if (has(t, /why.*(not|n't|isn't|am i not).*(gain|growing|bulk|bigger|heavier)|not gaining|can'?t gain|hardgainer/) || (m.topic === 'gain' && has(t, /\bwhy\b|what.*wrong/))) {
    m.topic = 'gain'
    if (!ctx) return noData('weight and food history')
    const parts: string[] = []
    if (ctx.weightsRecent.length < 2) { m.awaiting = { type: 'weight' }; return out('I don\'t have enough weigh-ins to judge your trend yet. What do you weigh today? Then weigh yourself 2–3 times a week at the same time of day.') }
    if (ctx.trendKgPerWeek !== null) parts.push(`Your 4-week trend is about ${ctx.trendKgPerWeek >= 0 ? '+' : ''}${ctx.trendKgPerWeek} kg/week${ctx.weeklyAvgKg ? ` (7-day average ${ctx.weeklyAvgKg} kg)` : ''}. That is an estimate from your logged weigh-ins.`)
    else parts.push('I need at least 3 weigh-ins spread over a week to estimate a trend.')
    const causes: string[] = []
    if (!ctx.intake7) causes.push('You haven\'t logged food on the last 7 days, so I can\'t check your calories. That is the biggest unknown.')
    else { if (ctx.intake7.avgKcal < ctx.targets.calories * 0.92) causes.push(`You averaged ${ctx.intake7.avgKcal} kcal on ${ctx.intake7.daysLogged} logged days against a ${ctx.targets.calories} kcal target, about ${ctx.targets.calories - ctx.intake7.avgKcal} kcal short. Gaining needs a surplus.`)
      if (ctx.intake7.avgProtein < d.profile.weightKg * 1.5) causes.push(`Protein averaged ${ctx.intake7.avgProtein} g, below the ~${Math.round(d.profile.weightKg * 1.6)} g that supports growth.`)
      if (ctx.intake7.daysLogged < 5) causes.push(`You logged only ${ctx.intake7.daysLogged} of 7 days; unlogged days are often the low ones.`) }
    if (ctx.sessionsLast7 < Math.min(2, d.profile.daysPerWeek)) causes.push(`You trained ${ctx.sessionsLast7} time${ctx.sessionsLast7 === 1 ? '' : 's'} this week; growth needs a training signal.`)
    if (ctx.sleepAvg7 !== null && ctx.sleepAvg7 < 7) causes.push(`Sleep averaged ${ctx.sleepAvg7} h; under 7 h hurts recovery and appetite.`)
    if (!causes.length) causes.push('Your logged intake, training and sleep look on track, so the most likely fix is patience plus roughly +200 kcal per day for two weeks.')
    m.suggestion = { kind: 'generic', title: 'Raise calories by ~300 kcal/day' }
    return out(`${parts.join(' ')}\n\nWhat the data points to:\n${causes.map(c => '• ' + c).join('\n')}\n\nThe easiest lever is usually breakfast and snacks. Want me to suggest an affordable way to add about 300–400 kcal?`)
  }
  if (has(t, /\b(increase|raise|boost|more|add)\b.*\b(calorie|kcal|food|eat|eating|breakfast|lunch|dinner|snack)|help me eat more|eat more|\bwhat should i eat\b|what about (increasing|adding|raising).*(breakfast|lunch|dinner|snack)|\b(breakfast|lunch|dinner)\b.*\b(more|bigger|increase)/) || (m.topic && has(t, /^(what|how) about\b.*\b(breakfast|lunch|dinner|snacks?)\b/))) {
    const meal = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).find(x => t.includes(x)) ?? 'breakfast'
    const gap = ctx?.intake7 ? Math.max(200, ctx.targets.calories - ctx.intake7.avgKcal) : 350; const add = Math.min(450, Math.max(250, Math.round(gap / 3 / 10) * 10))
    const opts: { id: string; g: number }[] = [{ id: 'milk', g: 206 }, { id: 'banana', g: 118 }, { id: 'egg', g: 100 }, { id: 'bread', g: 60 }, { id: 'peanut-butter', g: 16 }, { id: 'groundnuts', g: 30 }]
    const items: { foodId: string; grams: number }[] = []; let kcal = 0
    for (const o of opts) { if (kcal >= add * 0.92) break; const f = foodById(o.id)!; items.push({ foodId: o.id, grams: o.g }); kcal += foodMacros(f, o.g).kcal }
    const protein = items.reduce((a, i) => a + foodMacros(foodById(i.foodId)!, i.grams).protein, 0)
    m.topic = 'calories'; m.suggestion = { kind: 'meal', title: `Bigger ${meal}`, items, meal }
    const cur = meal === 'breakfast' && ctx?.breakfastAvgKcal ? `Your breakfasts average about ${ctx.breakfastAvgKcal} kcal. ` : ''
    const gapTxt = ctx?.intake7 ? `Over your last ${ctx.intake7.daysLogged} logged days you averaged ${ctx.intake7.avgKcal} kcal against a ${ctx.targets.calories} kcal target. ` : ''
    return out(`${gapTxt}${cur}Adding about ${Math.round(kcal)} kcal (${Math.round(protein)} g protein) to ${meal} is realistic and cheap:\n\n${items.map(i => { const f = foodById(i.foodId)!; const s = f.servings?.find(x => x.grams === i.grams); return `• ${s ? s.label : i.grams + ' g'} ${f.name.toLowerCase()}` }).join('\n')}\n\nSay "log that" to record it, or "add that to my schedule" to plan it.`)
  }
  if (has(t, /(analy[sz]e|review|check|how('s| is| am i doing with)).*(weight|progress|gaining|losing)|am i (gaining|losing)|weight progress/)) {
    if (!ctx) return noData('weight history'); m.topic = 'weight'
    if (!ctx.weightsRecent.length) { m.awaiting = { type: 'weight' }; return out('You have no weigh-ins yet. What do you weigh today? I\'ll prepare the entry.') }
    const first = ctx.weightsRecent[0], last = ctx.weightsRecent[ctx.weightsRecent.length - 1], diff = round(last.kg - first.kg, 1), toGo = round(ctx.targetKg - last.kg, 1)
    const tr = ctx.trendKgPerWeek; const eta = tr && Math.sign(tr) === Math.sign(toGo) && Math.abs(tr) > 0.05 ? Math.ceil(Math.abs(toGo / tr)) : null
    return out(`Latest: ${fmtWeight(last.kg, wu)} on ${last.date}. Across your last ${ctx.weightsRecent.length} weigh-ins that is ${diff >= 0 ? '+' : ''}${diff} kg. Target: ${fmtWeight(ctx.targetKg, wu)} (${Math.abs(toGo)} kg ${toGo >= 0 ? 'to gain' : 'to lose'}).${tr !== null ? `\n\nEstimated trend: ${tr >= 0 ? '+' : ''}${tr} kg/week.${eta ? ` At that pace you'd reach the target in roughly ${eta} weeks; that is only an estimate.` : tr * (toGo || 1) < 0 ? ' That is moving away from your goal.' : ''}` : '\n\nLog 3+ weigh-ins across a week and I can estimate a trend.'}${ctx.goal === 'gain' && tr !== null && tr < 0.1 ? '\n\nWant me to look at why gaining is slow?' : ''}`)
  }
  if (has(t, /(review|analy[sz]e|check|how('s| is)).*(nutrition|diet|food|eating|macros|calories)|what.*eaten today/)) {
    if (!ctx) return noData('food log'); m.topic = 'nutrition'; const ti = ctx.todayIntake, tg = ctx.targets
    if (!ti.kcal && !ctx.intake7) return out('I don\'t see any food logged yet. Log a meal in Nutrition (or tell me "I ate 200 g rice for lunch") and I\'ll review it.')
    const lines = [`Today so far: ${Math.round(ti.kcal)} / ${tg.calories} kcal, protein ${Math.round(ti.protein)} / ${tg.protein} g, carbs ${Math.round(ti.carbs)} / ${tg.carbs} g, fat ${Math.round(ti.fat)} / ${tg.fat} g, water ${ti.waterMl} / ${tg.waterMl} ml.`]
    if (ctx.intake7) lines.push(`Last 7 days (${ctx.intake7.daysLogged} logged): ${ctx.intake7.avgKcal} kcal and ${ctx.intake7.avgProtein} g protein per day on average.`)
    const left = tg.protein - ti.protein; if (left > 20) lines.push(`You still need about ${Math.round(left)} g of protein today. Eggs, ndengu, beans, milk or omena would cover it cheaply.`)
    return out(lines.join('\n\n'))
  }
  if (has(t, /(explain|review|analy[sz]e|how('s| is| am i doing with)).*(training|workout|lifting|strength)|training progress/)) {
    if (!ctx) return noData('training history'); m.topic = 'training'
    if (!d.sessions.length) return out('You haven\'t completed a workout yet, so there is nothing to compare. Start one from Workouts. After two sessions I can show where your weights and reps are climbing.')
    const sessions = [...d.sessions].sort((a, b) => a.startedAt - b.startedAt); const best = new Map<string, { first: number; last: number }>()
    for (const s of sessions) for (const e of s.exercises) { const w = Math.max(0, ...e.sets.filter(x => x.done).map(x => x.weight)); if (!w) continue; const c = best.get(e.exerciseId); best.set(e.exerciseId, { first: c?.first ?? w, last: w }) }
    const ups = [...best.entries()].filter(([, v]) => v.last > v.first).map(([id, v]) => `${exerciseById(id)?.name ?? id}: ${v.first} → ${v.last} kg`)
    return out(`You have ${sessions.length} logged session${sessions.length === 1 ? '' : 's'}: ${ctx.sessionsLast7} this week and ${ctx.sessionsLast30} in the last 30 days.${ups.length ? `\n\nTop weight increases:\n${ups.slice(0, 5).map(u => '• ' + u).join('\n')}` : '\n\nNo exercise has gone up in weight yet. That is normal early on; try adding a rep or two before adding load.'}`)
  }
  const mw = MUSCLE_WORDS.find(([re]) => re.test(t)); if (mw && has(t, /exercise|train|work(ing)? out|how (do|to|can)|best|build|grow|target|hit/)) {
    const mu = MUSCLES.find(x => x.id === mw[1])!; const ex = EXERCISES.filter(e => e.primary.includes(mu.id) && canDo(e.id, d.profile.equipment)).slice(0, 4)
    m.topic = 'muscle'; m.suggestion = { kind: 'generic', title: `${mu.name} exercises` }
    return out(`${mu.name}: ${mu.function}\n\nGood options with your equipment:\n${(ex.length ? ex : EXERCISES.filter(e => e.primary.includes(mu.id)).slice(0, 3)).map(e => `• ${e.name}, ${e.guidance}`).join('\n')}\n\nTip: ${mu.tips[0]} You can also tap it on the Body screen to see everything.`)
  }
  const concept = CONCEPTS.find(([re]) => re.test(t)); if (concept) { m.topic = 'concept'; return out(concept[1]) }

  // ---- 5. Small talk and honest fallback ----
  if (has(t, /^(hi|hello|hey|yo|good (morning|afternoon|evening)|sasa|mambo)\b/)) return out(pick([`Hi${d.profile.name ? ' ' + d.profile.name : ''}. What shall we work on, training, food or your schedule?`, `Hello${d.profile.name ? ' ' + d.profile.name : ''}. Ask me about your progress, or tell me what to log.`], seed))
  if (has(t, /^(thanks|thank you|asante|cheers)/)) return out(pick(['Anytime.', 'You\'re welcome. Tell me what\'s next.', 'Sure.'], seed))
  if (has(t, /\bwhat can you do\b|\bhelp\b|\bcommands?\b/)) return out('In demo mode I can: log your weight or water, add tasks and calendar events, log meals ("I ate 200 g ugali"), review your weight, nutrition and training from your real data, build today\'s workout or a weekly plan, suggest exercises per muscle, and explain basics like progressive overload or protein. Anything that changes your data is shown to you first for approval.')
  void REFERENCE_FOODS; void allFoods
  return out(pick([
    'I\'m running in demo mode (a rule-based engine, not a live AI model), so I only handle a defined set of requests. Try: "Why am I not gaining weight?", "Log my weight", "Build today\'s workout", "I ate 200 g rice", or "How do I train my chest?". Connect an AI provider in Settings → Jarvis for open-ended conversation.',
    'I didn\'t understand that one. In demo mode I can log things, review your progress, build workouts and explain fitness basics. Say "what can you do" for the list, or connect an AI provider for free-form chat.'
  ], seed))
}
export const demoGreeting = (live: boolean, name: string) => live
  ? `Hi${name ? ' ' + name : ''}. I'm connected to a live AI model and can see the NEXUS data you've allowed. What would you like to work on?`
  : `Hi${name ? ' ' + name : ''}. I'm in demo mode: a rule-based assistant using your NEXUS data, not a live AI model. I can log entries, review your progress and build workouts. What would you like to do?`
export type { Suggestion, JarvisContext }
