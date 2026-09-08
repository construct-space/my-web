/**
 * Domains API client — calls domains-api.lisaos.dev through the
 * my.lisaos.dev gateway at `/api/domains/*`. Gateway injects
 * X-Auth-User-ID; domains-api trusts it via the X-Internal-Secret
 * handshake used across the fleet.
 */

export interface Domain {
  domain: string
  status: string
  /** Server emits `create_date`; older code may have used `registered_at`. */
  create_date?: string | null
  expire_date?: string | null
  auto_renew?: boolean
  nameservers?: string | string[] | null
}

export interface DomainDetail extends Domain {
  whois_privacy?: boolean
  /** Server emits `security_lock`; older code may have used `locked`. */
  security_lock?: boolean
  /** Set when registrar lookup failed and the response is from the local row only. */
  registrar_unavailable?: boolean
}

export interface SearchResult {
  domain: string
  available: boolean
  price?: number | string
}

export interface DNSRecord {
  id?: number | string
  type: string
  name: string
  content: string
  ttl?: number
  priority?: number
  notes?: string
}

export interface URLForwarding {
  target: string
  redirect_type: '301' | '302'
  include_path: boolean
}

export interface Order {
  id: string
  status: string
  total: number | string
  created_at: string
  domains: Array<{ domain: string; price: number | string }>
}

export interface CheckoutResponse {
  checkout_id: string
  checkout_url: string
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Request failed (${res.status})`
    try {
      const j = JSON.parse(text)
      if (j && typeof j.error === 'string') msg = j.error
    } catch {
      // Body wasn't JSON (e.g. raw nginx HTML on a 4xx/5xx from an
      // upstream gateway). Surfacing it verbatim leaks markup into the
      // UI, so fall back to the generic status-only message above.
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

// ─── Search (public) ──────────────────────────────────────────────────────
export function searchDomain(query: string) {
  return send<{ results: SearchResult[] }>('POST', '/api/domains/search', { query })
}

export function getPricing() {
  return send<Record<string, number | string>>('GET', '/api/domains/pricing')
}

// ─── Owned domains ────────────────────────────────────────────────────────
export function listDomains() {
  return send<{ domains: Domain[] }>('GET', '/api/domains')
}

export function getDomain(domain: string) {
  return send<DomainDetail>('GET', `/api/domains/${encodeURIComponent(domain)}`)
}

export function updateAutoRenew(domain: string, status: boolean) {
  return send<{ ok: true }>('PUT', `/api/domains/${encodeURIComponent(domain)}/auto-renew`, { status })
}

export function updateNameservers(domain: string, nameservers: string[]) {
  return send<{ ok: true }>('PUT', `/api/domains/${encodeURIComponent(domain)}/nameservers`, { nameservers })
}

export function setupDomain(domain: string) {
  return send<{ ok: true }>('POST', `/api/domains/${encodeURIComponent(domain)}/setup`)
}

export function getSSL(domain: string) {
  return send<{ certificate?: string; private_key?: string; chain?: string }>(
    'GET',
    `/api/domains/${encodeURIComponent(domain)}/ssl`,
  )
}

// ─── Redirect / URL forwarding ────────────────────────────────────────────
export function getRedirect(domain: string) {
  return send<URLForwarding | null>('GET', `/api/domains/${encodeURIComponent(domain)}/redirect`)
}

export function createRedirect(
  domain: string,
  target: string,
  redirectType: '301' | '302' = '301',
  includePath = true,
) {
  return send<URLForwarding>('POST', `/api/domains/${encodeURIComponent(domain)}/redirect`, {
    target,
    redirect_type: redirectType,
    include_path: includePath,
  })
}

export function deleteRedirect(domain: string) {
  return send<{ ok: true }>('DELETE', `/api/domains/${encodeURIComponent(domain)}/redirect`)
}

// ─── DNS ──────────────────────────────────────────────────────────────────
export function listDNS(domain: string) {
  return send<{ records: DNSRecord[] }>('GET', `/api/domains/${encodeURIComponent(domain)}/dns`)
}

export function createDNS(domain: string, record: DNSRecord) {
  return send<DNSRecord>('POST', `/api/domains/${encodeURIComponent(domain)}/dns`, record)
}

export function editDNS(domain: string, id: string | number, record: Partial<DNSRecord>) {
  return send<DNSRecord>('PUT', `/api/domains/${encodeURIComponent(domain)}/dns/${id}`, record)
}

export function deleteDNS(domain: string, id: string | number) {
  return send<{ ok: true }>('DELETE', `/api/domains/${encodeURIComponent(domain)}/dns/${id}`)
}

export function bulkCreateDNS(domain: string, records: DNSRecord[]) {
  return send<{ records: DNSRecord[] }>('POST', `/api/domains/${encodeURIComponent(domain)}/dns/bulk`, { records })
}

// ─── Checkout & orders ────────────────────────────────────────────────────
export function createCheckout(items: Array<{ domain: string; price?: number | string }>, email?: string) {
  return send<CheckoutResponse>('POST', '/api/domains/checkout', { items, email })
}

export function getCheckoutStatus(id: string) {
  return send<{ status: string; order_id?: string }>('GET', `/api/domains/checkout/${id}`)
}

export function listOrders() {
  return send<{ orders: Order[] }>('GET', '/api/domains/orders')
}

export function getOrder(id: string) {
  return send<Order>('GET', `/api/domains/orders/${id}`)
}
