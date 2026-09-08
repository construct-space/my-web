import type { ClientConfig, Scope } from './types.js'
import { request } from './http.js'

export interface AccountsClient {
  /** Who is the caller acting as — identity + org + roles + developer flag. */
  scope(): Promise<Scope>
}

export function createAccountsClient(config: ClientConfig): AccountsClient {
  const base = (config.baseUrl ?? '').replace(/\/$/, '')
  return {
    async scope() {
      return request<Scope>(config, `${base}/api/accounts/me/scope`)
    },
  }
}
