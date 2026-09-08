/**
 * Typed wrapper over graph's publisher endpoints — reached through my's
 * gateway at /api/graph/*. Unlike developer's endpoints (api.ts) these hit
 * the graph service directly rather than going through the developer façade,
 * because bundles, distribution, and install metadata are owned by graph.
 *
 * Kept in a separate file so additions here don't have to grep through the
 * developer api.ts. Shares the same CSRF + credentials pattern.
 */

// The my.lisaos.dev gateway rewrites /api/graph/<path> → graph-upstream
// /api/<path>, so we drop the leading /api when constructing graph routes —
// a request to '/space-bundles' here reaches graph at /api/space-bundles.
const BASE = '/api/graph'
const PFX = '' // graph sub-path prefix; kept as a named constant to document intent

let csrfToken: string | null = null

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const r = await fetch('/api/accounts/auth/csrf', { credentials: 'include' })
  if (!r.ok) throw new Error(`Failed to fetch CSRF token (${r.status})`)
  const data = (await r.json()) as { token: string }
  csrfToken = data.token
  return csrfToken
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string }
    return parsed.error || parsed.message || `Request failed (${res.status})`
  } catch {
    return text || `Request failed (${res.status})`
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

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

export interface Bundle {
  id: string
  name: string
  owner_org_id: string
  created_at?: string
}

export interface SpaceSummary {
  id: string
  name: string
  latest_version: string
  bundle_id?: string
  distribution: string // 'public' | 'org_allowlist' | 'private'
  publisher_org_id?: string
  install_count: number
}

export type Distribution = 'public' | 'org_allowlist' | 'private'

// ─── Bundles ────────────────────────────────────────────────────────────────

export const listBundles  = () => call<{ bundles: Bundle[] }>('GET', `${PFX}/space-bundles`)
export const createBundle = (id: string, name: string) =>
  call<{ ok: boolean; id: string; name: string; owner_org_id: string }>(
    'POST',
    `${PFX}/space-bundles`,
    { id, name },
  )
export const getBundle    = (id: string) => call<Bundle>('GET', `${PFX}/space-bundles/${encodeURIComponent(id)}`)

// ─── Spaces (publisher view) ────────────────────────────────────────────────

export const listOwnedSpaces = () => call<{ spaces: SpaceSummary[] }>('GET', `${PFX}/spaces`)

// ─── Distribution + allowlist ───────────────────────────────────────────────

export const setDistribution = (spaceId: string, distribution: Distribution) =>
  call<{ ok: boolean; distribution: string }>(
    'PUT',
    `${PFX}/spaces/${encodeURIComponent(spaceId)}/distribution`,
    { distribution },
  )

export const addToAllowlist      = (spaceId: string, orgId: string) =>
  call<{ ok: boolean }>('POST',   `${PFX}/spaces/${encodeURIComponent(spaceId)}/allowlist`, { org_id: orgId })
export const removeFromAllowlist = (spaceId: string, orgId: string) =>
  call<{ ok: boolean }>('DELETE', `${PFX}/spaces/${encodeURIComponent(spaceId)}/allowlist`, { org_id: orgId })

// ─── Installs ───────────────────────────────────────────────────────────────

export const listInstalls = (spaceId: string) =>
  call<{ space_id: string; orgs: string[] }>(
    'GET',
    `${PFX}/spaces/${encodeURIComponent(spaceId)}/installs`,
  )

// Tenant-side: install/uninstall. Kept here so the same file covers both
// publisher and tenant flows; the caller decides which panel exposes what.
export const installSpace   = (spaceId: string) =>
  call<{ ok: boolean }>('POST',   `${PFX}/spaces/${encodeURIComponent(spaceId)}/install`)
export const uninstallSpace = (spaceId: string) =>
  call<{ ok: boolean }>('DELETE', `${PFX}/spaces/${encodeURIComponent(spaceId)}/install`)
