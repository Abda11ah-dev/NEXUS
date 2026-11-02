import { useEffect, useRef, useState } from 'react'
import { Download, Smartphone, Trash2, Upload } from 'lucide-react'
import { Card, Confirm, Eyebrow, PageHead, useToast } from '../components/ui'
import { ProfileSections, toKg } from './Onboarding'
import { useActions, useData, useStore } from '../store/store'
import type { Profile } from '../store/types'
import { checkAi } from '../jarvis/ai'
import type { AiStatus } from '../jarvis/ai'
import { round, kgToLb } from '../lib/calc'
import { todayStr } from '../lib/date'

export default function Settings() {
  const d = useData(); const a = useActions(); const toast = useToast(); const { storageError } = useStore()
  const [p, setP] = useState<Profile>(d.profile); const unit = p.units.weight
  const [w, setW] = useState(String(round(unit === 'kg' ? d.profile.weightKg : kgToLb(d.profile.weightKg), 1))); const [t, setT] = useState(String(round(unit === 'kg' ? d.profile.targetKg : kgToLb(d.profile.targetKg), 1)))
  const [err, setErr] = useState<string | null>(null); const [wipe, setWipe] = useState(false); const [status, setStatus] = useState<AiStatus | null>(null); const file = useRef<HTMLInputElement>(null)
  const [installEvt, setInstallEvt] = useState<Event | null>((window as unknown as { __nexusInstall?: Event }).__nexusInstall ?? null)
  useEffect(() => { checkAi().then(setStatus); const h = () => setInstallEvt((window as unknown as { __nexusInstall?: Event }).__nexusInstall ?? null); window.addEventListener('nexus-install-ready', h); return () => window.removeEventListener('nexus-install-ready', h) }, [])
  const save = () => { const r = a.saveProfile({ ...p, weightKg: d.profile.weightKg, targetKg: toKg(t, p.units.weight), onboarded: true }); if (r.ok) { setErr(null); toast('Profile saved') } else setErr(r.error) }
  const exportData = async () => { const json = await a.exportData(); const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const el = document.createElement('a'); el.href = url; el.download = `nexus-backup-${todayStr()}.json`; el.click(); URL.revokeObjectURL(url); toast('Backup downloaded') }
  const install = async () => { const e = installEvt as (Event & { prompt: () => Promise<void> }) | null; if (!e) return; await e.prompt(); (window as unknown as { __nexusInstall?: Event }).__nexusInstall = undefined; setInstallEvt(null) }
  return <>
    <PageHead title="Settings" />
    <div className="col">
      {storageError && <div className="banner bad"><span>{storageError}</span></div>}
      <Card><div className="form"><Eyebrow>Profile</Eyebrow><ProfileSections p={p} set={n => setP(x => ({ ...x, ...n }))} sections={[0, 1, 2, 3]} wInput={w} setW={setW} tInput={t} setT={setT} />
        <p className="muted small">Your current weight comes from your latest weigh-in (Progress). Change the target here.</p>
        {err && <small role="alert" style={{ color: 'var(--bad)' }}>{err}</small>}<button className="btn primary" onClick={save}>Save profile</button></div></Card>
      <Card><div className="form"><Eyebrow>Jarvis</Eyebrow>
        <label className="row between"><span>Let Jarvis use my NEXUS data (weight, food, workouts, schedule)</span><input type="checkbox" checked={d.settings.jarvisShareData} onChange={e => a.setSettings({ jarvisShareData: e.target.checked })} /></label>
        <p className="small muted">Status: {status === null ? 'checking…' : status.configured ? `live AI connected (${status.provider}, ${status.model})` : 'demo mode (no AI provider configured on the server)'}. When live AI is used, the data you allow is sent to your AI provider through your own server function.</p>
        {status?.needsCode && <label className="field"><span>Access code</span><input type="password" value={d.settings.accessCode} onChange={e => a.setSettings({ accessCode: e.target.value })} autoComplete="off" /></label>}</div></Card>
      <Card><div className="form"><Eyebrow>Install and offline</Eyebrow>
        <p className="small muted">NEXUS works offline after your first visit. To install on Android: open it in Chrome, tap ⋮ then "Install app" (or "Add to Home screen").</p>
        {installEvt ? <button className="btn" onClick={install}><Smartphone size={16} /> Install NEXUS</button> : <p className="small muted">The install button appears here when your browser allows it.</p>}</div></Card>
      <Card><div className="form"><Eyebrow>Your data</Eyebrow>
        <p className="small muted">Everything is stored on this device. Export a backup regularly; photos are included.</p>
        <div className="row"><button className="btn" onClick={exportData}><Download size={16} /> Export backup</button><button className="btn" onClick={() => file.current?.click()}><Upload size={16} /> Restore backup</button></div>
        <input ref={file} type="file" accept="application/json" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const r = a.importData(await f.text()); toast(r.ok ? (r.message ?? 'Restored') : r.error, r.ok ? 'ok' : 'err') }} />
        <button className="btn danger" onClick={() => setWipe(true)}><Trash2 size={16} /> Delete all my data</button></div></Card>
      <p className="muted small center">NEXUS {__APP_VERSION__} · build {__BUILD_ID__} · local-first, no account</p>
    </div>
    {wipe && <Confirm title="Delete all data?" text="This permanently erases your profile, logs, photos and chats from this device. Export a backup first if you might want them back." confirmLabel="Delete everything" onYes={async () => { await a.deleteAll(); setWipe(false); window.location.hash = '/'; toast('All data deleted') }} onNo={() => setWipe(false)} />}
  </>
}
