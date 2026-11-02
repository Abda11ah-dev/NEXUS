# NEXUS: Fitness & Body Intelligence

React + TypeScript + Vite PWA with a Three.js anatomical body, a local-first data layer and a conversational assistant (Jarvis). Deploys to Netlify.

## Run it
```bash
npm install
npm run dev          # local development
npm run typecheck    # tsc -b
npm test             # 53 unit + UI-journey tests (vitest, jsdom)
npm run build        # typecheck + production build into dist/
```
Deploy: push to GitHub and connect the repo to Netlify (`netlify.toml` already sets build command, publish folder, SPA redirect, cache headers and the functions folder).

## What is in the app
Home dashboard, Body (3D), Workouts (plans, session runner, history, exercise library), Nutrition (Kenyan foods, custom foods, targets, saved meals), Progress (weight/measurements/photos/habits/awards), Calendar (month/week/day/agenda, recurring events, tasks), Jarvis (chat), Settings (profile, backup/restore, delete data). First launch runs onboarding.

All data lives on the device (localStorage + IndexedDB for photos). Export / restore / delete are in Settings.

## Jarvis: live AI vs demo mode
* **Demo mode (default):** a rule-based engine (`src/jarvis/demo.ts`) that reads your real data, remembers the conversation (topic, last suggestion, pending questions) and proposes actions. Every message is labelled **demo**. It is **not** an AI model.
* **Live AI:** deploy `netlify/functions/jarvis.mjs` with these Netlify environment variables. Keys never reach the browser.

| Variable | Purpose |
|---|---|
| `JARVIS_API_KEY` | provider key (required to enable live AI) |
| `JARVIS_PROVIDER` | `anthropic` (default) or `openai` (any OpenAI-compatible API) |
| `JARVIS_MODEL` | model id (default `claude-sonnet-5-5`) |
| `JARVIS_BASE_URL` | OpenAI-compatible base URL (openai provider only) |
| `JARVIS_SYSTEM` | optional replacement system prompt |
| `JARVIS_ACCESS_CODE` | **recommended**: users must enter this code in Settings, otherwise anyone could spend your credits |

Anything Jarvis wants to change (log weight, add events/tasks, log meals, create a plan, change targets) is shown as a **proposal** and only runs after you tap Approve. Model-produced actions are schema-validated first.
Limitations: replies are not streamed (Netlify buffers them); retry/regenerate is supported.

## 3D body, honest notes
`src/body/anatomy.ts` builds a **procedural** anatomical male (about 16k vertices, 21 muscle groups, left/right mirrored, deep layer for rhomboids, internal obliques and soleus). Muscle positions follow real anatomy, so a selected muscle always lights up where it really is. It is **not a scan and not photorealistic**. One shader draws both Anatomy and Hologram modes, so the hologram is exactly the same model and the transition is smooth. No external asset or licence is used.
To upgrade fidelity: obtain a properly licensed, optimised anatomical GLB (one mesh per muscle group, named with the ids in `src/data/muscles.ts`), verify its licence, and load it in `BodyScene.tsx` in place of `buildAnatomy()`.

## Offline / PWA
Service worker (`public/sw.js`) precaches every built file listed in `dist/precache.json`, serves navigations network-first with an offline fallback, and waits for the user to tap **Update** before activating a new version. Installable from Chrome (manifest, any + maskable icons). Reminders fire only while the app is open; real push notifications need a push server (not built).

## Known limitations
* No cloud sync / accounts yet. Data is local-first; the model is ready for a per-user backend (e.g. Supabase) but none is wired. Cross-device use = Export / Restore.
* No barcode or label scanning (manual search and custom foods only). Food values are rounded reference estimates; Kenyan composite dishes especially are approximate and editable.
* No exercise demo images or videos (text instructions only).
* No push notifications when the app is closed.
* The 3D shader/touch behaviour and Galaxy A22 performance have **not** been tested on real devices from this environment. Test on-device and lower `dpr` / particle count in `BodyScene.tsx` if needed.
* `NEXUS_foundation_v0.1.zip` (old prototype archive) is left in the repo root; it can be deleted.

## Audit of the original prototype (what was wrong)
Single 1.16 MB bundle; body made of primitives; Jarvis returned one canned answer; weight, calories and tasks were hard-coded sample data; charts were fake; settings/bell buttons did nothing; training buttons only toggled a highlight; the service worker was cache-first forever (users never got updates) with no offline fallback; maskable icon was a copy of the normal one; no validation, no onboarding, no export or delete.
