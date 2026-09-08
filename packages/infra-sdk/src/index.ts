/**
 * @construct-space/infra — typed HTTP clients for Construct infra services.
 *
 * All services are reached through a single gateway at `${baseUrl}/api/<service>/...`.
 * The SPA defaults to `baseUrl: ''` (same-origin); CLI/desktop pass
 * `baseUrl: 'https://my.lisaos.dev'`.
 *
 * Usage:
 *   import { createClient } from '@construct-space/infra'
 *
 *   const construct = createClient({
 *     baseUrl: '',  // same-origin (SPA)
 *     getToken: async () => ({ identity: authStore.token }),
 *   })
 *
 *   const scope = await construct.accounts.scope()
 */

export type { ClientConfig, TokenPair, TokenProvider, Scope } from './types.js'
export { InfraError } from './http.js'
export { authHeadersFor, authHeadersForPair } from './token.js'

import type { ClientConfig } from './types.js'
import { createAccountsClient, type AccountsClient } from './accounts.js'
import { createNotificationsClient, type NotificationsClient } from './notifications.js'

export * from './notifications.js'

export interface InfraClient {
  accounts: AccountsClient
  notifications: NotificationsClient
  /** Raw config, useful for adding custom requests while the SDK grows. */
  config: ClientConfig
}

export function createClient(config: ClientConfig): InfraClient {
  return {
    accounts: createAccountsClient(config),
    notifications: createNotificationsClient(config),
    config,
  }
}
