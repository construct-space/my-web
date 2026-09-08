import type { ClientConfig } from './types.js'
import { request } from './http.js'

// ─── shapes ────────────────────────────────────────────────────────────────
//
// Wire shapes match delivery-api's /api/notifications/* (and admin variants).
// Server values: id is a UUID string, read_at is RFC3339 or null.

export interface Notification {
  id: string
  source: string
  type: string
  title: string
  body: string
  link?: string
  data?: unknown
  read_at?: string | null
  created_at: string
}

export interface NotificationListInput {
  unread?: boolean
  limit?: number
  since_id?: string
}

export interface NotificationListResponse {
  notifications: Notification[]
}

export type NotificationPlatform = 'ios' | 'android'

export interface DeviceRegistration {
  platform: NotificationPlatform
  token: string
  app_version?: string
}

export interface NotificationPreferences {
  in_app_enabled: boolean
  web_push_enabled: boolean
  mobile_enabled: boolean
  email_fallback: boolean
  muted_types?: string[]
  updated_at: string
}

export type NotificationPreferencesUpdate = Partial<
  Pick<
    NotificationPreferences,
    'in_app_enabled' | 'web_push_enabled' | 'mobile_enabled' | 'email_fallback' | 'muted_types'
  >
>

export interface NotificationStreamHandlers {
  onNotification?(n: Notification): void
  onUnreadCount?(unread: number): void
  onError?(err: unknown): void
  onOpen?(): void
}

// Admin (oracle) shapes — server-side pagination, mirrors AdminListMessages.
export interface AdminListInput {
  user_id?: string
  source?: string
  type?: string
  unread?: boolean
  /** RFC3339; only items at or after this instant. */
  since?: string
  page?: number
  limit?: number
}

export interface AdminListResponse {
  data: Notification[]
  total: number
  page: number
  limit: number
}

export interface AdminBucket {
  key: string
  count: number
}

export interface AdminStatsResponse {
  total: number
  unread: number
  read: number
  last_24h: number
  by_source: AdminBucket[]
  by_type: AdminBucket[]
  push_surfaces: {
    web_subscriptions: number
    device_tokens: number
    ios: number
    android: number
  }
}

export interface AdminTestNotifyInput {
  user_id: string
  title: string
  body?: string
  link?: string
  source?: string
  type?: string
  data?: unknown
}

// ─── client ────────────────────────────────────────────────────────────────

export interface NotificationsClient {
  list(input?: NotificationListInput): Promise<NotificationListResponse>
  unreadCount(): Promise<{ unread: number }>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
  delete(id: string): Promise<void>
  /**
   * Open an SSE stream. Returns a function that closes it. Auto-reconnects
   * on transient drops (the browser's EventSource handles that natively
   * for network blips; we re-open on hard errors).
   */
  stream(handlers: NotificationStreamHandlers): () => void

  vapidPublicKey(): Promise<{ public_key: string }>
  /**
   * High-level web push enrollment: requests Notification permission,
   * subscribes via PushManager with the server's VAPID key, and registers
   * the resulting subscription with delivery-api. Returns true on success;
   * false if push is unsupported or permission is denied.
   * Browser-only — throws in Node.
   */
  enableWebPush(): Promise<boolean>
  /** Tear down the current browser's push subscription. */
  disableWebPush(): Promise<void>
  /** Browser only. True if there is an active PushSubscription. */
  isWebPushEnabled(): Promise<boolean>

  registerWebPush(input: { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string }): Promise<void>
  unregisterWebPush(endpoint: string): Promise<void>

  registerDevice(reg: DeviceRegistration): Promise<void>
  unregisterDevice(token: string): Promise<void>

  preferences: {
    get(): Promise<NotificationPreferences>
    update(patch: NotificationPreferencesUpdate): Promise<NotificationPreferences>
  }

  // Staff admin (oracle). The endpoints behind these are gated by oracle
  // session + X-Internal-Secret on oracle-api → delivery-api. Calling them
  // from my.lisaos.dev will 401 — they're exposed here so oracle-web
  // can reuse the same shapes/types instead of redeclaring them.
  admin: {
    list(input?: AdminListInput): Promise<AdminListResponse>
    stats(): Promise<AdminStatsResponse>
    sendTest(input: AdminTestNotifyInput): Promise<Notification>
  }
}

export function createNotificationsClient(config: ClientConfig): NotificationsClient {
  const base = (config.baseUrl ?? '').replace(/\/$/, '')
  const r = `${base}/api/notifications`

  function qs(input: Record<string, unknown> | undefined): string {
    if (!input) return ''
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(input)) {
      if (v == null || v === '' || v === false) continue
      usp.set(k, v === true ? 'true' : String(v))
    }
    const s = usp.toString()
    return s ? `?${s}` : ''
  }

  return {
    list(input) {
      return request<NotificationListResponse>(config, `${r}${qs(input as Record<string, unknown>)}`)
    },
    unreadCount() {
      return request<{ unread: number }>(config, `${r}/unread-count`)
    },
    async markRead(id) {
      await request<{ ok: boolean }>(config, `${r}/${encodeURIComponent(id)}/read`, { method: 'POST' })
    },
    async markAllRead() {
      await request<{ ok: boolean }>(config, `${r}/read-all`, { method: 'POST' })
    },
    async delete(id) {
      await request<{ ok: boolean }>(config, `${r}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },

    stream(handlers) {
      // EventSource doesn't support custom headers, so SSE auth piggybacks
      // on the cookie that the same-origin SPA already carries. CLI/desktop
      // contexts (Authorization bearer) need a different transport — out of
      // scope for the SPA-first first-party use case.
      const url = `${r}/stream`
      let es: EventSource | null = null
      let stopped = false
      let retry = 0

      function open() {
        es = new EventSource(url, { withCredentials: true })
        es.addEventListener('open', () => {
          retry = 0
          handlers.onOpen?.()
        })
        es.addEventListener('notification', (evt) => {
          try {
            const data = JSON.parse((evt as MessageEvent).data)
            if (data?.notification) handlers.onNotification?.(data.notification as Notification)
          } catch (e) {
            handlers.onError?.(e)
          }
        })
        es.addEventListener('unread_count', (evt) => {
          try {
            const data = JSON.parse((evt as MessageEvent).data)
            const c = typeof data?.unread === 'number' ? data.unread : data?.UnreadCount
            if (typeof c === 'number') handlers.onUnreadCount?.(c)
          } catch (e) {
            handlers.onError?.(e)
          }
        })
        es.addEventListener('error', (e) => {
          handlers.onError?.(e)
          // Browser auto-retries unless we close. Reopen on hard close
          // (readyState === CLOSED) with a capped exponential backoff.
          if (es && es.readyState === EventSource.CLOSED && !stopped) {
            es.close()
            const delay = Math.min(30_000, 1000 * 2 ** retry++)
            setTimeout(() => { if (!stopped) open() }, delay)
          }
        })
      }
      open()
      return () => {
        stopped = true
        es?.close()
      }
    },

    vapidPublicKey() {
      return request<{ public_key: string }>(config, `${r}/vapid-public-key`)
    },

    async isWebPushEnabled() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      return !!sub
    },

    async enableWebPush() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') return false

      // Caller must have registered a service worker at /sw.js (or any
      // active registration). We don't register one here so apps can pick
      // their own filename and scope.
      const reg = await navigator.serviceWorker.ready
      const { public_key } = await request<{ public_key: string }>(config, `${r}/vapid-public-key`)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // The PushManager type expects BufferSource; the cast keeps strict
        // TS happy across DOM lib variants where ArrayBufferLike unions
        // differ in their SharedArrayBuffer membership.
        applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false
      await request(config, `${r}/web-push`, {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          user_agent: navigator.userAgent,
        }),
      })
      return true
    },

    async disableWebPush() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (!sub) return
      await request(config, `${r}/web-push`, {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => { /* server may already not have it; unsubscribe locally regardless */ })
      await sub.unsubscribe()
    },

    async registerWebPush(input) {
      await request(config, `${r}/web-push`, { method: 'POST', body: JSON.stringify(input) })
    },
    async unregisterWebPush(endpoint) {
      await request(config, `${r}/web-push`, { method: 'DELETE', body: JSON.stringify({ endpoint }) })
    },

    async registerDevice(reg) {
      await request(config, `${r}/devices`, { method: 'POST', body: JSON.stringify(reg) })
    },
    async unregisterDevice(token) {
      await request(config, `${r}/devices`, { method: 'DELETE', body: JSON.stringify({ token }) })
    },

    preferences: {
      get() {
        return request<NotificationPreferences>(config, `${r}/preferences`)
      },
      async update(patch) {
        return request<NotificationPreferences>(config, `${r}/preferences`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        })
      },
    },

    admin: {
      list(input) {
        return request<AdminListResponse>(config, `${base}/api/delivery/notifications${qs(input as Record<string, unknown>)}`)
      },
      stats() {
        return request<AdminStatsResponse>(config, `${base}/api/delivery/notifications/stats`)
      },
      sendTest(input) {
        return request<Notification>(config, `${base}/api/delivery/admin/notifications/test`, {
          method: 'POST',
          body: JSON.stringify(input),
        })
      },
    },
  }
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const safe = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(safe)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
