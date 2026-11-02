// Netlify serverless function: the ONLY place AI provider keys are used (server-side environment variables).
//
// Environment variables (Netlify -> Site settings -> Environment variables):
//   JARVIS_PROVIDER      "anthropic" (default) or "openai" (any OpenAI-compatible API)
//   JARVIS_API_KEY       your provider key (REQUIRED to enable live AI)
//   JARVIS_MODEL         model id, e.g. claude-sonnet-5-5 (default) or an OpenAI-compatible model name
//   JARVIS_BASE_URL      (openai provider only) default https://api.openai.com/v1
//   JARVIS_SYSTEM        (optional) replaces the default system instructions
//   JARVIS_ACCESS_CODE   (recommended) if set, requests must send it in the "x-nexus-code" header,
//                        so strangers cannot spend your API credits.
const SYSTEM = `You are Jarvis, the assistant inside NEXUS, a fitness, nutrition and body-tracking app used mainly in Kenya.
Style: intelligent, natural, calm and direct. Match answer length to the question. Give specific, actionable advice using the user's data when it is provided. Do not use filler praise.
Use the conversation history; resolve phrases like "that" or "it" from earlier messages. Ask one relevant follow-up question when key information is missing.
Prefer affordable, locally available foods (ugali, beans, ndengu, eggs, milk, omena, sukuma wiki, etc.).
Health: you are not a doctor. Do not diagnose. Suggest seeing a professional for pain, injury, medical conditions or disordered eating.
If the user asks you to change data in the app, DO NOT claim it is done. Instead append one or more action blocks; the app shows them to the user for approval:
\`\`\`nexus-action
{"type":"log_weight","kg":62.5}
\`\`\`
Allowed types and fields: log_weight{kg}, log_water{ml}, add_task{title,priority?,due?(YYYY-MM-DD)}, add_event{title,date(YYYY-MM-DD),start(HH:mm),end?,kind?(event|workout|meal|reminder)}, log_meal{foodId,grams,meal(breakfast|lunch|dinner|snack)}, create_plan{style(fullbody|upperlower|ppl)}, set_targets{calories?,protein?}.
Times are Africa/Nairobi. Never invent data that is not in the provided context.`

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export default async (req) => {
  const key = process.env.JARVIS_API_KEY
  const provider = (process.env.JARVIS_PROVIDER || 'anthropic').toLowerCase()
  const model = process.env.JARVIS_MODEL || (provider === 'anthropic' ? 'claude-sonnet-5-5' : '')
  const code = process.env.JARVIS_ACCESS_CODE || ''
  if (req.method === 'GET') return json({ configured: !!key && !!model, provider: key ? provider : undefined, model: key ? model : undefined, needsCode: !!code })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!key || !model) return json({ error: 'not_configured' }, 503)
  if (code && req.headers.get('x-nexus-code') !== code) return json({ error: 'unauthorized' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-20).filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length < 4000) : []
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'no_message' }, 400)
  const ctx = body.context ? `\n\nUser data shared with you (JSON, may be partial):\n${JSON.stringify(body.context).slice(0, 8000)}` : '\n\n(The user has NOT shared their app data; ask for numbers if you need them.)'
  const system = (process.env.JARVIS_SYSTEM || SYSTEM) + ctx

  try {
    let text = ''
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 900, system, messages: msgs }) })
      if (!r.ok) return json({ error: 'upstream', status: r.status }, r.status === 429 ? 429 : 502)
      const j = await r.json(); text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    } else {
      const base = (process.env.JARVIS_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
      const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: system }, ...msgs] }) })
      if (!r.ok) return json({ error: 'upstream', status: r.status }, r.status === 429 ? 429 : 502)
      const j = await r.json(); text = j.choices?.[0]?.message?.content || ''
    }
    return json({ text })
  } catch { return json({ error: 'network' }, 502) }
}
