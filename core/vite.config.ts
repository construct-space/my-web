import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwind from '@tailwindcss/vite'
import ui from '@construct-space/ui-web/vite'
import { fileURLToPath, URL } from 'node:url'

// Dev proxy for /api/* — two modes:
//   1. GATEWAY_URL set → proxy /api/* to the local gateway (docker-compose)
//      which then fans out to services. True prod parity.
//   2. GATEWAY_URL unset → proxy per-service to prod subdomains (quick mode
//      for frontend-only iteration before the gateway is running locally).
// Either way, the SPA always sees same-origin /api/<service>/... URLs.
const GATEWAY_URL = process.env.GATEWAY_URL || ''

const PER_SERVICE_FALLBACK: Record<string, string> = {
  '/api/accounts':  process.env.ACCOUNTS_URL  || 'https://accounts.lisaos.dev',
  '/api/developer': process.env.DEVELOPER_URL || 'https://developer.lisaos.dev',
  '/api/source':    process.env.SOURCE_URL    || 'https://source.lisaos.dev',
  '/api/graph':     process.env.GRAPH_URL     || 'https://graph.lisaos.dev',
  '/api/telemetry': process.env.TELEMETRY_URL || 'https://telemetry-api.lisaos.dev',
}

const proxy = GATEWAY_URL
  ? {
      '/api': {
        target: GATEWAY_URL,
        changeOrigin: true,
        secure: false,
      },
    }
  : Object.fromEntries(
      Object.entries(PER_SERVICE_FALLBACK).map(([prefix, target]) => [
        prefix,
        {
          target,
          changeOrigin: true,
          secure: true,
          // Most services keep their own route tree at / (e.g.
          // /api/accounts/me/scope → /me/scope on accounts). Telemetry is
          // the exception: its service routes already live under /api/*, so
          // /api/telemetry/device must become /api/device.
          rewrite: (path: string) => (
            prefix === '/api/telemetry'
              ? path.replace(/^\/api\/telemetry/, '/api')
              : path.replace(new RegExp(`^${prefix}`), '')
          ),
        },
      ]),
    )

export default defineConfig({
  plugins: [vue(), tailwind(), ...ui()],
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 60100,
    strictPort: true,
    proxy,
  },
})
