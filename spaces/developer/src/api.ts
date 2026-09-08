/**
 * Typed wrapper over developer's /api/* — reached through my's gateway
 * at /api/developer/*. Same CSRF + credentials dance as the account
 * space's api.ts, factored to stay lean: no shared abstraction until a
 * third space needs it.
 *
 * Handles two kinds of endpoints:
 *   1. Developer's own — publisher registry, spaces list, publish,
 *      transfers. Owned by infra/developer service.
 *   2. Graph admin façade — /api/developer/schemas/* proxies internally
 *      to srv-captain--graph. Clients don't know the difference.
 */

const BASE = '/api/developer'

let csrfToken: string | null = null

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  // Developer doesn't serve its own CSRF; accounts owns session CSRF and
  // the gateway exposes it at /api/accounts/auth/csrf.
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

export interface Publisher {
  id: number
  name: string
  slug: string
  email?: string
  description?: string
  website?: string
  verified: boolean
  created_at: string
}

export interface ApiKey {
  id: number
  key?: string           // full value — only returned on create / regenerate
  last8?: string         // always safe to show
  label?: string
  created_at: string
  last_used_at?: string | null
}

export type SpaceStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'changes_requested' | 'published' | 'unpublished'

// Reflects the Go developer service's Space.ToJSON output: `id` is the slug
// (the `name` column in the DB, used as the unique key everywhere — manifest,
// graph, route paths) and `name` is the human-readable display name. The
// Go model has these inverted (`Name string json:"id"`,
// `DisplayName string json:"name"`), so don't be tempted to rename.
export interface Space {
  id: string
  name: string
  description?: string
  version?: string
  status: SpaceStatus
  owner_type?: 'user' | 'org'
  submitted_by?: string
  icon?: string
  category?: string
  created_at: string
  updated_at: string
}

export interface SpaceListResponse {
  spaces: Space[]
  total: number
}

export interface Transfer {
  id: number
  space_id: number
  space_name: string
  from_publisher: string
  to_publisher: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  created_at: string
  expires_at: string
}

export interface SchemaSummary {
  space_id: string
  model_count?: number
  version?: string
  registered_at?: string
}

export interface Schema {
  space_id: string
  models: SchemaModel[]
  version?: string
}

export interface SchemaModel {
  name: string
  fields: SchemaField[]
}

export interface SchemaField {
  name: string
  type: string
  nullable?: boolean
  indexed?: boolean
}

export interface UsageStats {
  queries_today?: number
  queries_this_month?: number
  storage_bytes?: number
  error_rate?: number
  last_request_at?: string | null
}

// ─── Publisher ───────────────────────────────────────────────────────────────

export const getPublisher    = () => call<{ publisher: Publisher | null }>('GET', '/publisher')
export const updatePublisher = (p: Partial<Publisher>) => call<{ publisher: Publisher }>('PUT', '/publisher', p)

// ─── API keys + enrollment ───────────────────────────────────────────────────

export interface PublisherWithKey {
  name: string
  kind: 'user' | 'org'
  api_key?: string
  verified?: boolean
}

export const listCliPublishers = () =>
  call<{ publishers: PublisherWithKey[] }>('GET', '/auth/cli-verify')
export const enrollPersonal  = () =>
  call<{ apiKey?: string; api_key?: string; message?: string }>('POST', '/enroll/personal', {})
export const regenerateKey   = () =>
  call<{ apiKey: string; message?: string }>('POST', '/publishers/regenerate-key')

// ─── Spaces ──────────────────────────────────────────────────────────────────

export const listMySpaces    = () => call<SpaceListResponse>('GET', '/spaces/mine')
export const getSpace        = (name: string) => call<{ space: Space }>('GET', `/spaces/${encodeURIComponent(name)}`)
export const submitSpace     = (name: string) => call<{ space: Space }>('POST', `/spaces/${encodeURIComponent(name)}/submit`)
export const deleteSpace     = (name: string) => call<void>('DELETE', `/spaces/${encodeURIComponent(name)}`)

// ─── Publish history ─────────────────────────────────────────────────────────
// Backed by the developer service's append-only space_publishes audit table.
// Owner-gated server-side: the caller must own the space personally OR be a
// member of the org that owns it. The My UI only renders this for spaces the
// caller can see anyway, so 403s shouldn't happen in practice.

export interface SpacePublishItem {
  id: number
  spaceId: number
  version: string
  publisherUserId: string
  ownerUserId?: string
  ownerOrgId?: string
  publishedAt: string
  buildSize: number
  hasSource: boolean
  bundleUrl?: string
  buildChecksum?: string
  buildDuration?: string
  publisher?: {
    name: string
    email: string
    kind: string
  }
}

export const listSpacePublishes = (name: string) =>
  call<{ publishes: SpacePublishItem[]; total: number }>(
    'GET',
    `/spaces/${encodeURIComponent(name)}/publishes`,
  )

// ─── Transfers ───────────────────────────────────────────────────────────────

export const listIncoming    = () => call<{ transfers: Transfer[] }>('GET', '/transfers/incoming')
export const listOutgoing    = () => call<{ transfers: Transfer[] }>('GET', '/transfers/outgoing')
export const acceptTransfer  = (id: number) => call<void>('POST', `/transfers/${id}/accept`)
export const declineTransfer = (id: number) => call<void>('POST', `/transfers/${id}/decline`)
export const cancelTransfer  = (id: number) => call<void>('DELETE', `/transfers/${id}`)

// ─── Schemas (graph admin via developer façade) ──────────────────────────────

export const getSchema    = (spaceId: string) => call<Schema>('GET', `/schemas/${encodeURIComponent(spaceId)}`)
export const dropSchema   = (spaceId: string) => call<void>('DELETE', `/schemas/${encodeURIComponent(spaceId)}`)

// Owner-scoped table-rows browse. Server gates by space ownership against
// the gateway's X-Auth-* identity. Server caps limit at 200; clients
// paginate for full-table reads (CSV export does this).
export interface TableRowsResponse {
  space_id: string
  // Single string when reading one schema; "(union)" when the server
  // aggregated across multiple tenant schemas. `schemas` is the full set.
  schema: string
  schemas?: string[]
  table: string
  // When schemas.length > 1 the row set includes a synthetic _schema column
  // identifying the partition each row came from.
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  limit: number
  offset: number
}

export const getTableRows = (
  spaceId: string,
  tableName: string,
  opts: { limit?: number; offset?: number; schema?: string; project?: string } = {},
) => {
  const params = new URLSearchParams()
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts.schema) params.set('schema', opts.schema)
  if (opts.project) params.set('project', opts.project)
  const qs = params.toString()
  return call<TableRowsResponse>(
    'GET',
    `/schemas/${encodeURIComponent(spaceId)}/tables/${encodeURIComponent(tableName)}/rows${qs ? `?${qs}` : ''}`,
  )
}

// ─── Usage ───────────────────────────────────────────────────────────────────

export const getUsageStats = () => call<UsageStats>('GET', '/data/stats')
