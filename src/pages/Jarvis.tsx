import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, BrainCircuit, Check, Copy, History, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react'
import { Modal, useToast } from '../components/ui'
import { useActions, useData } from '../store/store'
import type { ChatMsg, Proposal } from '../store/types'
import { checkAi } from '../jarvis/ai'
import type { AiStatus } from '../jarvis/ai'
import { askAi, AiError } from '../jarvis/ai'
import { demoGreeting, demoRespond } from '../jarvis/demo'
import { buildContext, suggestedPrompts } from '../jarvis/context'
import { extractProposals } from '../jarvis/actions'
import { fmtDate, fmtTs, dateOfTs } from '../lib/date'
import { uid } from '../lib/id'

export default function Jarvis() {
  const d = useData(); const a = useActions(); const toast = useToast()
  const [status, setStatus] = useState<AiStatus | null>(null); const [online, setOnline] = useState(navigator.onLine)
  const [convId, setConvId] = useState<string | null>(d.conversations[0]?.id ?? null); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [hist, setHist] = useState(false)
  const box = useRef<HTMLDivElement>(null); const [atBottom, setAtBottom] = useState(true); const abort = useRef<AbortController | null>(null)
  const conv = d.conversations.find(c => c.id === convId) ?? null; const live = !!status?.configured && online
  useEffect(() => { checkAi().then(setStatus) }, [])
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  useEffect(() => { if (atBottom) box.current?.scrollTo({ top: box.current.scrollHeight }) }, [conv?.messages.length, busy, atBottom])
  const prompts = useMemo(() => suggestedPrompts(d), [d.weights, d.foodLog, d.sessions, d.water, d.plans, d.activePlanId, d.profile.goal]) // eslint-disable-line react-hooks/exhaustive-deps

  const respond = useCallback(async (id: string, history: ChatMsg[], userText: string) => {
    setBusy(true); abort.current = new AbortController()
    const latest = () => d.conversations.find(c => c.id === id)
    try {
      if (live) {
        const reply = await askAi(history, buildContext(d), d.settings.accessCode, abort.current.signal)
        const { text: clean, proposals } = extractProposals(reply, d)
        a.appendMessage(id, { id: uid('m'), role: 'jarvis', text: clean || 'Done. Please review the proposed change below.', ts: Date.now(), source: 'live', proposals: proposals.length ? proposals : undefined })
      } else {
        await new Promise(r => setTimeout(r, 350 + Math.random() * 350))
        const turn = history.length; const mem = latest()?.memory ?? {}
        const r = demoRespond(userText, d, mem, turn)
        const prefix = status?.configured && !online ? 'You are offline, so this answer comes from the built-in demo engine rather than the live model.\n\n' : ''
        a.updateConversation(id, c => ({ ...c, memory: r.memory, messages: [...c.messages, { id: uid('m'), role: 'jarvis', text: prefix + r.text, ts: Date.now(), source: 'demo', proposals: r.proposals }] }))
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      a.appendMessage(id, { id: uid('m'), role: 'jarvis', text: e instanceof AiError ? e.message : 'Something went wrong.', ts: Date.now(), error: true })
    } finally { setBusy(false) }
  }, [a, d, live, online, status?.configured])

  const send = (raw?: string) => {
    const t = (raw ?? text).trim(); if (!t || busy) return
    let id = convId; if (!id || !conv) { id = a.newConversation(); setConvId(id) }
    const msg: ChatMsg = { id: uid('m'), role: 'user', text: t, ts: Date.now() }
    const before = d.conversations.find(c => c.id === id)?.messages ?? []
    a.updateConversation(id, c => ({ ...c, title: c.messages.length ? c.title : t.slice(0, 40), messages: [...c.messages, msg] }))
    setText(''); setAtBottom(true); void respond(id, [...before, msg], t)
  }
  const retry = () => {
    if (!conv || busy) return; const msgs = conv.messages; let i = msgs.length - 1; while (i >= 0 && msgs[i].role !== 'user') i-- ; if (i < 0) return
    const kept = msgs.slice(0, i + 1); a.updateConversation(conv.id, c => ({ ...c, messages: kept })); void respond(conv.id, kept, msgs[i].text)
  }
  const decide = (mid: string, p: Proposal, approve: boolean) => {
    if (!conv) return
    let status: Proposal['status'] = approve ? 'approved' : 'cancelled', note: string | undefined
    if (approve) { const r = a.runAction(p.action); if (!r.ok) { status = 'failed'; note = r.error; toast(r.error, 'err') } else { note = r.message ?? 'Done'; toast(note) } }
    a.updateConversation(conv.id, c => ({ ...c, messages: c.messages.map(m => m.id === mid ? { ...m, proposals: m.proposals?.map(x => x.id === p.id ? { ...x, status, note } : x) } : m) }))
  }
  const newChat = () => { abort.current?.abort(); setConvId(a.newConversation()); setBusy(false) }
  const lastJ = conv ? [...conv.messages].reverse().find(m => m.role === 'jarvis')?.id : undefined

  return <div className="chat">
    <div className="row between" style={{ marginBottom: 6 }}>
      <div className="row" style={{ gap: 8 }}><div className="brand-mark" style={{ width: 34, height: 34 }}><BrainCircuit size={18} /></div><div><b>Jarvis</b><div className="small muted"><span className={`dot ${live ? '' : online ? 'off' : 'bad'}`} /> {live ? `Live AI · ${status?.model}` : online ? 'Demo mode · not a live AI model' : 'Offline · demo mode'}</div></div></div>
      <div className="row" style={{ gap: 6 }}><button className="icon-btn" aria-label="Conversation history" onClick={() => setHist(true)}><History size={18} /></button><button className="icon-btn" aria-label="New conversation" onClick={newChat}><Plus size={18} /></button></div>
    </div>
    {!live && <div className="banner"><span>Demo mode: replies come from a rule-based engine using your NEXUS data, not an AI model. To enable live AI, deploy the Jarvis function with an API key (see README).</span></div>}
    {!d.settings.jarvisShareData && <div className="banner info"><span>Jarvis cannot see your data. Turn on sharing in Settings for personalised answers.</span></div>}
    <div className="messages" ref={box} onScroll={e => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80) }} aria-live="polite">
      {(!conv || !conv.messages.length) && <div className="bubble"><div className="bmeta"><b>JARVIS</b></div>{demoGreeting(live, d.profile.name)}</div>}
      {conv?.messages.map(m => <div key={m.id} className={`bubble ${m.role} ${m.error ? 'err' : ''}`}>
        <div className="bmeta"><b>{m.role === 'user' ? 'YOU' : 'JARVIS'}</b><span>{fmtTs(m.ts)}</span>{m.role === 'jarvis' && !m.error && <span className={`badge ${m.source === 'live' ? '' : 'demo'}`}>{m.source === 'live' ? 'live AI' : 'demo'}</span>}</div>
        {m.text}
        {m.proposals?.map(p => <div className="proposal" key={p.id}><div className="eyebrow">Proposed change</div><div style={{ margin: '4px 0 8px' }}>{p.summary}</div>
          {p.status === 'pending' ? <div className="row"><button className="btn primary sm" onClick={() => decide(m.id, p, true)}><Check size={14} /> Approve</button><button className="btn ghost sm" onClick={() => decide(m.id, p, false)}><X size={14} /> Cancel</button></div>
            : <span className={`chip ${p.status === 'approved' ? 'good' : p.status === 'failed' ? 'warn' : ''}`}>{p.status === 'approved' ? `Done: ${p.note}` : p.status === 'failed' ? `Not saved: ${p.note}` : 'Cancelled'}</span>}</div>)}
        {m.role === 'jarvis' && <div className="bactions"><button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(m.text).then(() => toast('Copied')).catch(() => toast('Copy failed', 'err')) }}><Copy size={13} /> Copy</button>{(m.id === lastJ) && <button className="btn ghost sm" onClick={retry} disabled={busy}><RefreshCw size={13} /> {m.error ? 'Retry' : 'Regenerate'}</button>}</div>}
      </div>)}
      {busy && <div className="bubble"><div className="bmeta"><b>JARVIS</b></div><span className="typing" aria-label="Jarvis is typing"><span /><span /><span /></span></div>}
    </div>
    {!atBottom && <button className="btn sm" style={{ alignSelf: 'center', marginTop: -36, zIndex: 2 }} onClick={() => { setAtBottom(true); box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }) }}><ArrowDown size={14} /> Latest</button>}
    <div className="suggest" aria-label="Suggested prompts">{prompts.map(p => <button key={p} className="chip on" onClick={() => send(p)} disabled={busy}>{p}</button>)}</div>
    <div className="compose"><textarea aria-label="Message Jarvis" rows={1} placeholder="Message Jarvis…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} /><button className="btn primary" onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button></div>
    {hist && <Modal title="Conversations" onClose={() => setHist(false)}>{!d.conversations.length ? <p className="muted">No saved conversations yet.</p> : <div className="list">{d.conversations.map(c => <div className="item" key={c.id}><button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', color: 'inherit' }} onClick={() => { setConvId(c.id); setHist(false) }}><div className="t">{c.title}</div><div className="s">{fmtDate(dateOfTs(c.createdAt))} · {c.messages.length} messages</div></button><button className="icon-btn" aria-label="Delete conversation" onClick={() => { a.deleteConversation(c.id); if (c.id === convId) setConvId(null) }}><Trash2 size={16} /></button></div>)}</div>}</Modal>}
  </div>
}
