/**
 * Typed wrapper over source's org endpoints — reached through my's gateway
 * at /api/source/*. Same CSRF + credentials pattern as the account + developer
 * spaces' api.ts. No shared abstraction yet; each space stays independent so
 * we can split them into real packages later without untangling.
 *
 * Path shape: in prod, nginx strips /api/source/ and swaps in /api/, so
 * /api/source/org/members → source's own /api/org/members. Dev uses the
 * vite per-service fallback which also lands on source. Either way, the
 * SPA just sees same-origin /api/source/... URLs.
 */

const BASE = '/api/source'

let csrfToken: string | null = null

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  // Source has no CSRF of its own; accounts owns session CSRF and the
  // gateway exposes it at /api/accounts/auth/csrf (same token covers
  // every service behind the gateway).
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
    // Prefer `message` — the human-readable one — over `error` (a code).
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

export interface Org {
  id: string
  name: string
  slug: string
  icon?: string
  owner_id: string
  developer_status?: string
  created_at: string
  updated_at: string
}

export type MemberStatus = 'active' | 'invited' | 'suspended' | 'disabled'

export interface Member {
  id: string
  org_id: string
  user_id?: string
  name: string
  email: string
  avatar?: string
  title?: string
  phone?: string
  bio?: string
  role: string
  role_id?: string | null
  status: MemberStatus
  department_id?: string | null
  joined_at: string
  last_active_at?: string
  created_at: string
  updated_at: string
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Invite {
  id: string
  org_id: string
  email: string
  role: string
  department_id?: string | null
  invited_by: string
  token: string
  code?: string
  status: InviteStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  org_id: string
  name: string
  description?: string
  is_builtin: boolean
  permissions?: string[]
  created_at: string
  updated_at: string
}

export interface OrgProject {
  id: string
  org_id: string
  name: string
  description?: string
  repo_url?: string
  default_branch?: string
  framework?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Membership {
  member: Member | null
  org: Org | null
  roles: string[]
}

// ─── Org ─────────────────────────────────────────────────────────────────────

/**
 * GetOrg returns the raw Organization object (not wrapped). We wrap on
 * this side so callers get a stable `{ org }` shape regardless of any
 * future server-side change.
 */
export const getOrg = async (): Promise<{ org: Org | null }> => {
  try {
    const org = await call<Org>('GET', '/org')
    return { org }
  } catch (e) {
    // 404 when the caller isn't in an org — surface it as null rather
    // than throw, so Overview can render an empty state instead of an
    // error card.
    const msg = e instanceof Error ? e.message : String(e)
    if (/not in an organization|organization not found/i.test(msg)) return { org: null }
    throw e
  }
}

export const updateOrg = (patch: Partial<Pick<Org, 'name' | 'icon'>>) =>
  call<Org>('PUT', '/org', patch)

export const getMembership = () => call<Membership>('GET', '/org/membership')

// ─── Members ─────────────────────────────────────────────────────────────────

export const listMembers = () => call<Member[]>('GET', '/org/members')

export interface InviteInput {
  name?: string
  email: string
  role?: string
  role_id?: string
  title?: string
  department_id?: string | null
}

/**
 * inviteMember actually creates a *member* record on source (CreateMember).
 * Source also exposes a true invite-via-email flow at POST /org/invites —
 * for now the UI's "Invite" button creates the member directly so it
 * shows up instantly; switch to /org/invites once the email template is
 * ready (see Invites.vue).
 */
export const inviteMember = (body: InviteInput) =>
  call<Member>('POST', '/org/members', {
    name: body.name || body.email.split('@')[0],
    email: body.email,
    role: body.role,
    role_id: body.role_id,
    title: body.title,
    department_id: body.department_id,
  })

export const removeMember = (id: string) =>
  call<void>('DELETE', `/org/members/${encodeURIComponent(id)}`)

export const updateMemberRole = (id: string, roleId: string) =>
  call<Member>('PUT', `/org/members/${encodeURIComponent(id)}/role`, { role_id: roleId })

// ─── Invites ─────────────────────────────────────────────────────────────────

export const listInvites = () => call<Invite[]>('GET', '/org/invites')

export interface CreateInviteInput {
  email: string
  role?: string
  department_id?: string | null
}

export const createInvite = (body: CreateInviteInput) =>
  call<Invite>('POST', '/org/invites', body)

export const cancelInvite = (id: string) =>
  call<void>('PUT', `/org/invites/${encodeURIComponent(id)}/revoke`)

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectMember {
  id: string
  project_id: string
  member_id: string
  role?: string
  member?: Member
  added_at?: string
}

export interface ProjectRepo {
  id: string
  project_id: string
  provider: string
  name: string
  url: string
  default_branch?: string
  added_at?: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  repo_url?: string
  default_branch?: string
  framework?: string
}

export const listProjects = () => call<OrgProject[]>('GET', '/org/projects')

export const getProject = (id: string) =>
  call<OrgProject>('GET', `/org/projects/${encodeURIComponent(id)}`)

export const createProject = (body: CreateProjectInput) =>
  call<OrgProject>('POST', '/org/projects', body)

export const updateProject = (id: string, patch: Partial<CreateProjectInput>) =>
  call<OrgProject>('PUT', `/org/projects/${encodeURIComponent(id)}`, patch)

export const deleteProject = (id: string) =>
  call<void>('DELETE', `/org/projects/${encodeURIComponent(id)}`)

export const listProjectMembers = (projectId: string) =>
  call<ProjectMember[]>('GET', `/org/projects/${encodeURIComponent(projectId)}/members`)

export const addProjectMember = (projectId: string, body: { member_id: string; role?: string }) =>
  call<ProjectMember>('POST', `/org/projects/${encodeURIComponent(projectId)}/members`, body)

export const removeProjectMember = (projectId: string, memberId: string) =>
  call<void>(
    'DELETE',
    `/org/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
  )

export const listProjectRepos = (projectId: string) =>
  call<ProjectRepo[]>('GET', `/org/projects/${encodeURIComponent(projectId)}/repos`)

export const addProjectRepo = (projectId: string, body: { provider: string; name: string; url: string; default_branch?: string }) =>
  call<ProjectRepo>('POST', `/org/projects/${encodeURIComponent(projectId)}/repos`, body)

export const removeProjectRepo = (projectId: string, repoId: string) =>
  call<void>(
    'DELETE',
    `/org/projects/${encodeURIComponent(projectId)}/repos/${encodeURIComponent(repoId)}`,
  )

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface CreateRoleInput {
  name: string
  description?: string
  permissions?: string[]
}

export const listRoles = () => call<Role[]>('GET', '/org/roles')

export const getRole = (id: string) =>
  call<Role>('GET', `/org/roles/${encodeURIComponent(id)}`)

export const createRole = (body: CreateRoleInput) =>
  call<Role>('POST', '/org/roles', body)

export const updateRole = (id: string, patch: Partial<CreateRoleInput>) =>
  call<Role>('PUT', `/org/roles/${encodeURIComponent(id)}`, patch)

export const deleteRole = (id: string) =>
  call<void>('DELETE', `/org/roles/${encodeURIComponent(id)}`)

export const listPermissions = () =>
  call<{ permissions: Array<{ key: string; label?: string; group?: string; description?: string }> }>(
    'GET',
    '/org/permissions',
  )

// ─── Preferences (org-wide policies) ─────────────────────────────────────────

export const listOrgPreferences = () => call<{ data: Record<string, unknown> }>('GET', '/org/preferences')
export const setOrgPreference = (key: string, value: unknown) =>
  call<{ success: true }>('PUT', `/org/preferences/${encodeURIComponent(key)}`, { value })

// ─── Services (developer enrollment for the org) ─────────────────────────────

/**
 * Enroll the current org as a publisher. Developer verifies ownership via
 * source's /internal/org/owned, so only the org owner succeeds. Returns the
 * publisher's csk_live_* key on first enroll; "already enrolled" afterward.
 *
 * Hits the developer service directly (not source), so the BASE path doesn't
 * apply — inline fetch here with the same CSRF header pattern.
 */
export const enrollOrgAsDeveloper = async (): Promise<{
  apiKey?: string
  api_key?: string
  message?: string
}> => {
  const csrf = await getCsrf()
  const r = await fetch('/api/developer/enroll/org', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: '{}',
  })
  if (!r.ok) throw new Error(await readError(r))
  return (await r.json()) as { apiKey?: string; api_key?: string; message?: string }
}

/**
 * Disable the org's developer status. Returns 409 with `message` explaining
 * which spaces block the delete — caller surfaces that to the user.
 */
export const unenrollOrgAsDeveloper = async (): Promise<void> => {
  const csrf = await getCsrf()
  const r = await fetch('/api/developer/enroll/org', {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrf },
  })
  if (!r.ok) throw new Error(await readError(r))
}

// ─── AI provider catalog + org-level keys ───────────────────────────────────
//
// Catalog is the public read of /api/source/providers — same URL the desktop
// app hits, no auth required so first-run clients can browse before login.
// Org keys are admin-scoped (providers.manage permission) via /api/source/org/providers.

export interface CatalogModel {
  id: string
  name: string
  capabilities?: string[]
  context_window?: number
  max_output_tokens?: number
  default?: boolean
  deprecated?: boolean
  replaced_by?: string
}

export interface CatalogProvider {
  id: string
  slug: string
  name: string
  description?: string
  auth_type: string
  base_url?: string
  env_keys?: string[]
  capabilities?: string[]
  docs_url?: string
  signup_url?: string
  icon?: string
  has_shared_key: boolean
  models: CatalogModel[]
}

export const listCatalog = async (): Promise<{ data: CatalogProvider[]; version: string }> => {
  // Public endpoint — no CSRF/session required, so bypass the wrapped
  // `call()` (which would fetch CSRF we don't need).
  const r = await fetch('/api/source/providers', { credentials: 'omit' })
  if (!r.ok) throw new Error(await readError(r))
  return (await r.json()) as { data: CatalogProvider[]; version: string }
}

export interface OrgProviderKey {
  id: string
  provider: string
  masked_key: string
  enforced: boolean
  set_by: string
}

export const listOrgProviderKeys = () =>
  call<OrgProviderKey[]>('GET', '/org/providers')

export interface SetOrgProviderKeyInput {
  api_key?: string
  enforced?: boolean
}

export const setOrgProviderKey = (provider: string, body: SetOrgProviderKeyInput) =>
  call<{ status: string; provider: string; enforced: boolean }>(
    'PUT',
    `/org/providers/${encodeURIComponent(provider)}`,
    body,
  )

export const deleteOrgProviderKey = (provider: string) =>
  call<void>('DELETE', `/org/providers/${encodeURIComponent(provider)}`)
