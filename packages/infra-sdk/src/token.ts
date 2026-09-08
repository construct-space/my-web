/**
 * Header routing for Construct auth tokens.
 *
 *   cat_*       → Authorization: Bearer  (identity)
 *   csk_live_*  → X-API-Key               (publisher / developer enrollment)
 *
 * Other token shapes fall back to Bearer and let the server's middleware
 * decide (dev-portal CLI tokens, session cookies, etc.).
 */

export type AuthHeaderSet = Record<string, string>

export function authHeadersFor(token: string | null | undefined): AuthHeaderSet {
  if (!token) return {}
  if (token.startsWith('csk_live_')) return { 'X-API-Key': token }
  return { Authorization: `Bearer ${token}` }
}

/**
 * Some endpoints want both: an identity token (who) *and* a publisher key
 * (what they own). Callers provide whichever is known; the header set is
 * the union.
 */
export function authHeadersForPair(
  identity?: string | null,
  publisher?: string | null,
): AuthHeaderSet {
  const headers: AuthHeaderSet = {}
  if (identity) headers.Authorization = `Bearer ${identity}`
  if (publisher) headers['X-API-Key'] = publisher
  return headers
}
