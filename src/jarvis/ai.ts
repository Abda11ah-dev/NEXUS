// Client for the secure AI endpoint (netlify/functions/jarvis.mjs). No API keys ever live in the browser.
import type { ChatMsg } from '../store/types'
import type { JarvisContext } from './context'

export const AI_ENDPOINT = '/.netlify/functions/jarvis'
export interface AiStatus { configured: boolean; provider?: string; model?: string; needsCode?: boolean; error?: string }

export async function checkAi(): Promise<AiStatus> {
  try {
    const r = await fetch(AI_ENDPOINT, { method: 'GET', cache: 'no-store' })
    if (!r.ok) return { configured: false }
    const j = await r.json(); return { configured: !!j.configured, provider: j.provider, model: j.model, needsCode: !!j.needsCode }
  } catch { return { configured: false, error: 'offline' } }
}
export class AiError extends Error { constructor(msg: string, public retryable: boolean) { super(msg) } }

/** Sends the conversation (and user-approved context) to the backend. Retries once on network / 5xx errors. */
export async function askAi(messages: ChatMsg[], context: JarvisContext | null, accessCode: string, signal?: AbortSignal): Promise<string> {
  const body = JSON.stringify({ messages: messages.filter(m => !m.error).slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })), context })
  let lastErr: AiError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessCode ? { 'x-nexus-code': accessCode } : {}) }, body, signal })
      if (r.status === 401) throw new AiError('The access code is missing or wrong. Check Settings → Jarvis.', false)
      if (r.status === 429) throw new AiError('The AI service is busy. Please try again shortly.', true)
      if (r.status >= 500) throw new AiError('The AI service had a problem. You can retry.', true)
      if (!r.ok) throw new AiError('The request was rejected.', false)
      const j = await r.json(); if (typeof j.text !== 'string' || !j.text) throw new AiError('The AI returned an empty answer.', true)
      return j.text
    } catch (e) {
      if (e instanceof AiError) { lastErr = e; if (!e.retryable) throw e } else if ((e as Error).name === 'AbortError') throw e
      else lastErr = new AiError('Could not reach the AI service. Check your connection.', true)
      await new Promise(r => setTimeout(r, 700))
    }
  }
  throw lastErr ?? new AiError('Unknown error', true)
}
