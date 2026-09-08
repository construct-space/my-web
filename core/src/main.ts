import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useTheme } from '@construct-space/ui-web'
import { useSessionStore } from '@construct-space/infra-shell'

// Rubik — brand typeface. Shipped as a variable font (one WOFF2, all
// weights 300-900) so we don't rely on Google Fonts / third-party CDN
// and there's no flash while a font stylesheet fetches.
import '@fontsource-variable/rubik'

import App from './App.vue'
import { routes } from './routes'
import { infraSpaces } from './spaces'
import { initHost } from './host'
import './styles/global.css'

useTheme().init()

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Capability guard — mirror the `requires` list declared by each space.
// Without this, a signed-in user could still navigate to /org/* (or any
// other gated space) via URL and get a wall of 401s from API calls the
// space makes on mount. Redirect to / instead so the Home card list
// (already capability-filtered) is their entry point.
function capsFor(session: ReturnType<typeof useSessionStore>): Set<string> {
  const out = new Set<string>()
  const s = session.scope
  if (!session.isAuthenticated) return out
  out.add('identity')
  if (s?.developer) out.add('developer')
  if (s?.delivery) out.add('delivery')
  if (s?.scope === 'org') {
    out.add('scope:org')
    for (const r of s.roles) out.add(`role:${r}`)
  }
  if (s?.scope === 'user') out.add('scope:user')
  return out
}

router.beforeEach((to) => {
  const seg = to.path.split('/').filter(Boolean)[0] || ''
  if (!seg) return true
  const space = infraSpaces.find((s) => s.id === seg)
  if (!space || !space.requires?.length) return true

  const session = useSessionStore()
  if (!session.isAuthenticated) return true // handled by other auth paths

  const have = capsFor(session)
  const ok = space.requires.every((c) => have.has(c))
  return ok ? true : '/'
})

initHost()

// Register the push service worker as soon as the app boots. The Push API
// (PushManager.subscribe) requires an active SW registration before
// useNotification().enableWebPush() can run; doing it here means the
// account → notifications "Enable" button works without any user-visible
// extra step. Failures are silent — push just stays unavailable.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[sw] registration failed:', err)
  })
}

createApp(App)
  .use(createPinia())
  .use(router)
  .mount('#app')
