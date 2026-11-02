// Service worker registration, update detection and install prompt capture.
declare global { interface Window { __nexusInstall?: Event } }
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__nexusInstall = e; window.dispatchEvent(new Event('nexus-install-ready')) })
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', async () => {
    try {
      // The ?v= build id makes every deploy a new worker script, so users reliably get updates.
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`)
      const announce = (w: ServiceWorker | null) => { if (w) window.dispatchEvent(new CustomEvent('nexus-update', { detail: w })) }
      if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting)
      reg.addEventListener('updatefound', () => { const n = reg.installing; n?.addEventListener('statechange', () => { if (n.state === 'installed' && navigator.serviceWorker.controller) announce(n) }) })
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    } catch (e) { console.warn('Service worker registration failed', e) }
  })
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; window.location.reload() })
}
