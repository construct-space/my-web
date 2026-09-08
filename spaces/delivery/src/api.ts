/**
 * Delivery API client — talks to delivery-api through the my.lisaos.dev
 * gateway (`/api/delivery/*`). Gateway injects X-Auth-User-ID from the tenant's
 * session; delivery-api trusts it via the X-Internal-Secret handshake.
 *
 * No cross-origin concerns: the browser sees every call as same-origin against
 * my.lisaos.dev. No explicit credentials header needed — session cookie
 * already flows with same-origin requests.
 */

export interface SendingDomain {
  id: number
  user_id: string
  domain: string
  status: string
  dkim_selector: string
  dkim_public_key: string
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  created_at: string
}

export interface DNSRecord {
  name: string
  type: string
  value: string
  ttl?: number
}

export interface DomainDetail {
  domain: SendingDomain
  dns_records: DNSRecord[]
}

export interface DeliveryMessage {
  id: number
  user_id: string
  domain_id?: number
  to_email: string
  from_email: string
  subject: string
  status: string
  error?: string | null
  sent_at?: string | null
  created_at: string
}

export interface DeliveryAPIKey {
  id: number
  user_id: string
  name: string
  prefix: string
  created_at: string
  last_used_at?: string | null
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text || `Request failed (${res.status})`
    try {
      const j = JSON.parse(text)
      if (j && typeof j.error === 'string') msg = j.error
    } catch {
      /* not JSON */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return readJson<T>(res)
}

// ─── Domains ──────────────────────────────────────────────────────────────

export function listDomains() {
  return send<{ domains: SendingDomain[] }>('GET', '/api/delivery/domains')
}

export function getDomain(id: number | string) {
  return send<DomainDetail>('GET', `/api/delivery/domains/${id}`)
}

export function createDomain(domain: string) {
  return send<DomainDetail>('POST', '/api/delivery/domains', { domain })
}

export function deleteDomain(id: number | string) {
  return send<{ ok: boolean }>('DELETE', `/api/delivery/domains/${id}`)
}

export function verifyDomain(id: number | string) {
  return send<DomainDetail>('POST', `/api/delivery/domains/${id}/verify`)
}

export function getDomainMessages(id: number | string) {
  return send<{ messages: DeliveryMessage[] }>('GET', `/api/delivery/domains/${id}/messages`)
}

// ─── Messages ─────────────────────────────────────────────────────────────

export function listMessages(params?: { page?: number }) {
  const qs = params?.page ? `?page=${params.page}` : ''
  return send<{ messages: DeliveryMessage[] }>('GET', `/api/delivery/messages${qs}`)
}

// ─── API keys ─────────────────────────────────────────────────────────────

export function listAPIKeys() {
  return send<{ keys: DeliveryAPIKey[] }>('GET', '/api/delivery/keys')
}

// Create returns the plaintext key once — caller must capture it.
export function createAPIKey(name: string) {
  return send<{ key: DeliveryAPIKey; secret: string }>('POST', '/api/delivery/keys', { name })
}
