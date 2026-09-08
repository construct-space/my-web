/**
 * Token provider contract — the SDK does not manage storage. The host app
 * (Construct Account, CLI, etc.) owns auth state and hands tokens to the
 * SDK on demand. Returning both lets endpoints that need publisher
 * ownership proof (Graph, developer) present it alongside identity.
 */
export interface TokenPair {
  identity?: string | null   // cat_… accounts OAuth token
  publisher?: string | null  // csk_live_… publisher API key (if enrolled)
}

export type TokenProvider = () => TokenPair | Promise<TokenPair>

export interface ClientConfig {
  /**
   * Base URL of the Construct gateway. Services are reached at
   * `${baseUrl}/api/<service>/...`. Default `''` for same-origin
   * (the SPA served by the gateway itself).
   *
   * Examples:
   *   ''                              — browser, same-origin
   *   'https://my.lisaos.dev'    — CLI / desktop / Node
   *   'http://localhost:8080'         — local gateway in docker-compose
   */
  baseUrl?: string
  getToken: TokenProvider
  /** Optional fetch override for Node/Bun server contexts or tests. */
  fetch?: typeof fetch
}

export interface Scope {
  authenticated: boolean
  user: {
    id: string
    email: string
    /**
     * Convenience composed name. Not always present — the accounts /me/scope
     * endpoint serializes the User struct directly (first_name, last_name,
     * username, email) rather than calling ProfileJSON(), so callers should
     * compose via first_name + last_name → username → email rather than
     * relying on `name` being populated.
     */
    name?: string
    first_name?: string
    last_name?: string
    username?: string
    avatar_url?: string
  }
  scope: 'user' | 'org'
  org?: {
    id: string
    slug: string
    name?: string
    icon?: string
    // True when the org itself is enrolled as a publisher (distinct from
    // the top-level `developer` flag, which tracks the caller's personal
    // publisher). Only populated when scope === 'org'.
    developer?: boolean
  }
  roles: string[]
  /** Personal publisher exists for this user. */
  developer: boolean
  /**
   * User is enrolled as a delivery tenant (at least one api_key row on
   * delivery-api). Drives the Services page Enable/Disable toggle and the
   * shell capability filter that hides the Delivery space from unenrolled
   * users.
   */
  delivery: boolean
}
