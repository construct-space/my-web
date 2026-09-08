/**
 * Thin typed wrapper over accounts' /api/* routes. All paths go through
 * my's gateway (`/api/accounts/*` → `accounts/api/*`), so same-origin
 * fetch with credentials lets the browser ship the session cookie back
 * unchanged. Mutations grab a CSRF token once and reuse it; accounts'
 * middleware accepts either X-CSRF-Token header or `_csrf` form field.
 */

const BASE = '/api/accounts'

let csrfToken: string | null = null

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const r = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' })
  if (!r.ok) throw new Error(`Failed to fetch CSRF token (${r.status})`)
  const data = (await r.json()) as { token: string }
  csrfToken = data.token
  return csrfToken
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string }
    // Prefer `message` — it's the human-friendly one; `error` is a code
    // like `has_spaces` the UI can still pattern-match on.
    return parsed.message || parsed.error || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrf()

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return undefined as T
  return (await res.json()) as T
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number
  uuid: string
  first_name: string
  last_name: string
  username: string
  email: string
  avatar_url?: string | null
  phone?: string | null
  totp_enabled: boolean
  last_login?: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: number
  token_preview?: string
  user_agent?: string | null
  ip_address?: string | null
  created_at: string
  expires_at: string
  current?: boolean
}

export interface ConnectedService {
  client_id: string
  name: string
  description?: string
  last_used_at?: string | null
  granted_at: string
}

export interface Passkey {
  id: string
  name: string
  created_at: string
  last_used_at?: string | null
}

export interface TwoFactorSetup {
  secret: string
  qr_code: string   // data:image/png;base64,… — ready to drop into <img src>
  uri: string       // otpauth:// URL for manual authenticator entry
}

export interface NotificationPrefs {
  product_updates: boolean
  security_alerts: boolean
  marketing: boolean
  [k: string]: unknown
}

// ─── Profile / password ──────────────────────────────────────────────────────

// `/auth/me` wraps the user in `{ authenticated, user }`; `/auth/profile`
// returns the flat user object. Unwrap here so callers see a consistent
// UserProfile shape.
export const getProfile = async () => {
  const r = await call<{ authenticated: boolean; user: UserProfile }>('GET', '/auth/me')
  return r.user
}
export const updateProfile = (p: Partial<UserProfile>) => call<UserProfile>('PUT', '/auth/profile', p)
export const changePassword = (current_password: string, new_password: string) =>
  call<void>('PUT', '/auth/password', { current_password, new_password })

export interface StorageUpload {
  public_url: string
  key: string
  bucket: string
  size: number
}

export async function uploadAvatar(file: File): Promise<StorageUpload> {
  const fd = new FormData()
  const ext = extensionForAvatar(file)
  fd.append('key', `avatars/avatar-${Date.now()}${ext}`)
  fd.append('file', file, file.name || `avatar${ext}`)

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    body: fd,
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as StorageUpload
}

function extensionForAvatar(file: File): string {
  const byType: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  }
  if (byType[file.type]) return byType[file.type]
  const match = file.name.match(/\.(png|jpe?g|webp|gif|avif)$/i)
  return match ? `.${match[1].toLowerCase().replace('jpeg', 'jpg')}` : '.png'
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export const listSessions = () => call<{ sessions: Session[] }>('GET', '/auth/sessions')
export const revokeSession = (id: number | string) => call<void>('DELETE', `/auth/sessions/${id}`)

// ─── Services (connected OAuth clients) ──────────────────────────────────────

export const listServices = () => call<{ services: ConnectedService[] }>('GET', '/services')
export const revokeService = (clientId: string) => call<void>('DELETE', `/services/${clientId}`)

// ─── Preferences ─────────────────────────────────────────────────────────────

export const listPreferences = () => call<{ data: Record<string, unknown> }>('GET', '/preferences')
export const getPreference = (key: string) => call<{ value: unknown }>('GET', `/preferences/${key}`)
export const putPreference = (key: string, value: unknown) =>
  call<void>('PUT', `/preferences/${key}`, { value })

// ─── Capability enrollment ───────────────────────────────────────────────────
// Cross-service calls from the Services page. Touching the gateway paths for
// developer + source here (rather than those spaces' own api.ts) keeps the
// Services page self-contained — it's the one surface that spans all three.

export interface Organization {
  id: string
  name: string
  slug: string
  icon?: string
  owner_id?: string
}

async function callExternal<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrf()
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return undefined as T
  return (await res.json()) as T
}

/** Enroll as a personal developer (publisher). 409 = already enrolled,
 *  which the caller can treat as success for idempotency. */
export const enrollAsDeveloper = () =>
  callExternal<{ apiKey?: string; api_key?: string; message?: string }>('POST', '/api/developer/enroll/personal', {})

/** Enroll the current user's organization as a publisher. Caller must be the
 *  org owner — developer verifies via source. Same response shape as personal. */
export const enrollOrgAsDeveloper = () =>
  callExternal<{ apiKey?: string; api_key?: string; message?: string }>('POST', '/api/developer/enroll/org', {})

/** Disable personal developer status. Returns 409 with `space_count` if any
 *  spaces still belong to the publisher — the caller must delete or transfer
 *  them before the unenroll succeeds. */
export const unenrollAsDeveloper = () =>
  callExternal<{ ok?: true }>('DELETE', '/api/developer/enroll/personal')

/** Create a new organization and make the current user its owner. */
export const createOrganization = (input: { name: string; slug: string; icon?: string }) =>
  callExternal<{ org: Organization }>('POST', '/api/source/org', input)

/** Enroll the current user as a delivery tenant. On first enrollment returns
 *  `created: true` and a one-time `api_key` (the plaintext `cd_live_…` value).
 *  Idempotent: repeated calls return `created: false` without a key. */
export const enableDelivery = () =>
  callExternal<{ enabled: boolean; created: boolean; api_key?: string }>('POST', '/api/delivery/enroll', {})

/** Revoke all delivery API keys for the current user. Destructive — any
 *  integrations using a previously-issued `cd_live_…` key will start getting 401. */
export const disableDelivery = () =>
  callExternal<{ enabled: boolean }>('DELETE', '/api/delivery/enroll')

// ─── Privacy: export + delete ────────────────────────────────────────────────

/** Triggers server-side generation; response body is either an async job
 *  descriptor or the download URL, depending on accounts' implementation. */
export const requestDataExport = () => call<{ status: string; url?: string }>('GET', '/account/export')
export const deleteAccount = (password: string) =>
  call<void>('POST', '/account/delete', { password })

// ─── 2FA ─────────────────────────────────────────────────────────────────────

export const twoFactorSetup   = () => call<TwoFactorSetup>('POST', '/2fa/setup')
export const twoFactorVerify  = (code: string) => call<{ message: string }>('POST', '/2fa/verify', { code })
export const twoFactorDisable = (password: string) => call<void>('POST', '/2fa/disable', { password })

// ─── Passkeys ────────────────────────────────────────────────────────────────

export const listPasskeys = () => call<{ passkeys: Passkey[] }>('GET', '/passkeys')
export const deletePasskey = (id: string) => call<void>('DELETE', `/passkey/${id}`)

// Registration ceremony — return raw bag so the page can run navigator.credentials.create
export const passkeyRegisterBegin  = () => call<{ publicKey: any }>('POST', '/passkey/register/begin')
export const passkeyRegisterFinish = (credential: unknown) =>
  call<{ passkey: Passkey }>('POST', '/passkey/register/finish', credential)
