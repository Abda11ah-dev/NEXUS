# NEXUS — Transformation OS (foundation prototype)

A responsive React + TypeScript starter for an Android/web personal transformation app.

## Current working screens
- Body: interactive, procedural Three.js body placeholder; drag to rotate, tap body parts, switch muscular/hologram material modes.
- Watchlist: add, complete and delete tasks; saved in browser localStorage.
- Calendar: today's sample timeline (calendar editing/reminders are not connected yet).
- Training: training focus selector and starter UI.
- Progress: sample weight chart (clearly marked illustrative).
- Jarvis: local demo chat with basic contextual responses; no external AI API is connected.

## Run locally
Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build
```bash
npm run build
npm run preview
```

## Android packaging (later step)
After the web app is running and verified:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init NEXUS com.nexus.transform
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
Android Studio is required to build/sign the APK.

## Important implementation notes
- This is a front-end foundation, not a production-ready fitness/medical product.
- The 3D figure is a stylised procedural placeholder, not a medically accurate anatomical asset. Replace it with a properly licensed, segmented 3D anatomy model before claiming anatomical accuracy.
- User data currently stays in the browser's localStorage. There is no account, cloud sync, encryption layer, or backup yet.
- Jarvis is a local demo. To add real AI, create a server-side endpoint (for example Supabase Edge Function) and keep provider API keys server-side. Never put API keys in frontend code.
- Calendar/reminders need real scheduling, permission handling, and native Android notification integration.
- Progress chart uses sample data and must be replaced with actual logged measurements.
- For production, add tests, input validation, accessibility review, privacy policy, data export/deletion, and Supabase Row Level Security.


## Install on Android (phone-friendly route)

This project is PWA-ready. It must first be deployed to an HTTPS website.
A phone-only route is to upload this project to a GitHub repository and connect that repository to Netlify.
Netlify runs `npm run build` and publishes the `dist` folder using the included `netlify.toml`.
Then open the published HTTPS address in Chrome on your Samsung and use **⋮ > Install app** (or **Add to Home screen**).

This is an installable web app, not yet a signed native APK. The service worker caches the app shell and visited same-origin assets. Cloud sync, real AI, push notifications, and full nutrition/workout integrations are not yet production-complete.
