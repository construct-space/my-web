/**
 * Shared session store — any infra space imports this to read the
 * authenticated user, scope, org, and roles. The host (Construct infra
 * core) owns writes (tokens); spaces only read. All SDK calls go through
 * globalThis.construct.infra which the host wires up during boot.
 *
 * Persisting scope in localStorage means cold reloads + HMR hydrate
 * instantly without flashing an empty UI.
 */

import { defineStore } from 'pinia'
import type { InfraClient, Scope } from '@construct-space/infra'

const STORAGE_KEY = 'construct-infra:session'

interface Persisted {
  token: string | null
  publisherKey: string | null
  scope: Scope | null
}

/**
 * Shape of globalThis.construct — the host (core) sets this on boot.
 * Kept here so every space + the session store share one definition.
 * Spaces that need the full runtime augment this via module declaration.
 */
export interface ConstructRuntime {
  infra: InfraClient
  auth: {
    getAccessToken(): Promise<string | null>
    getUserId(): string | null
  }
}

declare global {
  // eslint-disable-next-line no-var
  var construct: ConstructRuntime | undefined
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, publisherKey: null, scope: null }
    return JSON.parse(raw) as Persisted
  } catch {
    return { token: null, publisherKey: null, scope: null }
  }
}

function save(p: Persisted): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

export const useSessionStore = defineStore('infra-session', {
  state: () => {
    const persisted = load()
    return {
      token: persisted.token,
      publisherKey: persisted.publisherKey,
      scope: persisted.scope,
      scopeLoaded: !!persisted.scope,
      loading: false,
      error: null as string | null,
    }
  },
  getters: {
    // Two auth paths coexist: browser users authenticate via a session
    // cookie (no token in store; the scope reflects who we are), while
    // CLI/desktop clients pass a bearer token. Either is sufficient.
    isAuthenticated: (s): boolean => !!s.token || !!s.scope?.authenticated,
    orgId: (s): string | null => s.scope?.org?.id ?? null,
    isDeveloper: (s): boolean => s.scope?.developer ?? false,
  },
  actions: {
    setTokens(token: string | null, publisherKey: string | null = null) {
      this.token = token
      this.publisherKey = publisherKey
      save({ token, publisherKey, scope: this.scope })
    },
    async refreshScope() {
      // Always attempt the call — cookie-based auth carries itself via
      // the browser, and tokened calls ride along on getToken(). A 401
      // response simply means "not signed in yet" and we record that
      // with an unauthenticated scope.
      const infra = globalThis.construct?.infra
      if (!infra) {
        this.error = 'Infra client not initialised'
        this.scopeLoaded = true
        return
      }
      this.loading = true
      this.error = null
      try {
        const raw = await infra.accounts.scope()
        const normalized: Scope = {
          ...raw,
          roles: Array.isArray(raw.roles) ? raw.roles : [],
          developer: !!raw.developer,
        }
        this.scope = normalized
        save({ token: this.token, publisherKey: this.publisherKey, scope: normalized })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // 401 is the "signed out" signal, not an error worth showing.
        if (/\b401\b/.test(msg)) {
          this.scope = null
          save({ token: this.token, publisherKey: this.publisherKey, scope: null })
        } else {
          this.error = msg
        }
      } finally {
        this.loading = false
        this.scopeLoaded = true
      }
    },
    signOut() {
      this.token = null
      this.publisherKey = null
      this.scope = null
      this.scopeLoaded = true
      save({ token: null, publisherKey: null, scope: null })
    },
  },
})
