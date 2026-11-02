import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const BUILD_ID = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)

// Emits /precache.json (every built file) so the service worker can cache the WHOLE app, including
// lazy-loaded pages and the 3D chunk, on first visit. That is what makes offline use reliable.
const precache = (): Plugin => ({
  name: 'nexus-precache',
  generateBundle(_o, bundle) {
    const files = Object.keys(bundle).filter(f => !f.endsWith('.map')).map(f => '/' + f)
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify({ build: BUILD_ID, files }) })
  }
})
export default defineConfig({
  plugins: [react(), precache()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { three: ['three'], charts: ['recharts'] } } } },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] }
} as Parameters<typeof defineConfig>[0])
