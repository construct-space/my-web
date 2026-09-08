import type { ClientConfig, TokenPair } from './types.js'
import { authHeadersForPair } from './token.js'

export class InfraError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'InfraError'
  }
}

export async function request<T>(
  config: ClientConfig,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const tokens: TokenPair = await config.getToken()
  const doFetch = config.fetch ?? fetch

  const resp = await doFetch(url, {
    // credentials:'include' so the browser ships the my.lisaos.dev
    // session cookie along with the request — that's how the portal's
    // own users authenticate (no bearer token in the SPA). CLI/desktop
    // still send Authorization via authHeadersForPair below.
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeadersForPair(tokens.identity, tokens.publisher),
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  const contentType = resp.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const body: unknown = isJson ? await resp.json().catch(() => null) : await resp.text().catch(() => '')

  if (!resp.ok) {
    const msg = (isJson && body && typeof body === 'object' && 'error' in body)
      ? String((body as { error: unknown }).error)
      : `${resp.status} ${resp.statusText}`
    throw new InfraError(`${msg} (status ${resp.status})`, resp.status, body)
  }
  if (!isJson) {
    throw new InfraError(`Expected JSON response (status ${resp.status})`, resp.status, body)
  }
  return body as T
}
