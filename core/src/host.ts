/**
 * Host runtime — exposes `globalThis.construct` so infra spaces can reach
 * the shared SDK, session, and navigation the same way Construct app spaces
 * reach their host. Matches the shape spaces already expect.
 */

import { createClient, type InfraClient } from '@construct-space/infra'
import { useSessionStore } from '@construct-space/infra-shell'
// ConstructRuntime + globalThis.construct declaration lives in
// @construct-space/infra-shell so spaces and the session store share one
// definition. The host just populates it in initHost().

// Same-origin by default — the SPA is served by the gateway, so /api/*
// paths resolve to the gateway's nginx proxy. Override via VITE_API_URL
// only for edge cases (e.g. dev frontend pointed at a remote gateway).
const BASE_URL = import.meta.env.VITE_API_URL || ''

export function initHost(): void {
  const infra = createClient({
    baseUrl: BASE_URL,
    getToken: () => {
      const session = useSessionStore()
      return { identity: session.token, publisher: session.publisherKey }
    },
  })

  globalThis.construct = {
    infra,
    auth: {
      async getAccessToken() {
        const session = useSessionStore()
        return session.token ?? null
      },
      getUserId() {
        const session = useSessionStore()
        return session.scope?.user?.id ?? null
      },
    },
  }
}

export function useInfra(): InfraClient {
  if (!globalThis.construct) throw new Error('Host not initialized — call initHost() first')
  return globalThis.construct.infra
}
