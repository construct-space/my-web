/**
 * OAuth 2.0 PKCE client for my.lisaos.dev.
 *
 * Flow:
 *   1. startLogin() generates state + PKCE verifier, stashes them in
 *      sessionStorage, and navigates to /api/oauth/authorize.
 *   2. Accounts bounces the user back to /oauth/callback?code=... after
 *      they authenticate. OAuthCallback.vue calls exchangeCode().
 *   3. exchangeCode() POSTs to /api/oauth/token with the verifier,
 *      receives an access token, stores it on the session store.
 *
 * All requests are same-origin (the gateway proxies /api/oauth/* through
 * to accounts), so no CORS dance.
 */

const STATE_KEY = 'construct-oauth:state'
const VERIFIER_KEY = 'construct-oauth:verifier'

const CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID || 'construct_my'
const REDIRECT_URI = `${window.location.origin}/oauth/callback`

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  // base64url
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function startLogin(): Promise<void> {
  const state = randomUrlSafe(16)
  const verifier = randomUrlSafe(32)
  const challenge = await sha256(verifier)

  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `/api/oauth/authorize?${params.toString()}`
}

export interface TokenResponse {
  access_token: string
  token_type?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

export async function exchangeCode(code: string, returnedState: string): Promise<TokenResponse> {
  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)

  if (!expectedState || expectedState !== returnedState) {
    throw new Error('State mismatch — possible CSRF or a stale login tab.')
  }
  if (!verifier) {
    throw new Error('Missing PKCE verifier — sessionStorage was cleared mid-flow.')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let parsed: Record<string, string> = {}
    try { parsed = JSON.parse(text) } catch { /* not JSON */ }
    throw new Error(parsed.error_description || parsed.error || `Token exchange failed (${res.status})`)
  }

  const data = (await res.json()) as TokenResponse
  if (!data.access_token) {
    throw new Error('Token response missing access_token')
  }
  return data
}
