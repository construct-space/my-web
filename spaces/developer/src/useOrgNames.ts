/**
 * useOrgNames — batch + cache resolver for org UUIDs → display names.
 *
 * Problem this solves: the graph service stores orgs as opaque ids on install
 * rows, allowlists, and audit logs. UIs that render those lists (SpaceDetail,
 * Bundles, Transfers) otherwise show raw UUIDs, which users can't interpret.
 *
 * Strategy — request coalescing:
 *   - Each call to `resolve(ids)` buckets unknown ids into a queue and fires
 *     a single HTTP request on the next microtask. This way 50 `<OrgName/>`
 *     components rendering in the same tick share one roundtrip.
 *   - Resolved names live in a module-level reactive map, so later renders
 *     are synchronous and consistent across components.
 *   - Unknown ids (deleted orgs, typos) cache a `null` sentinel so we don't
 *     retry forever.
 *
 * Why module scope, not a Pinia store: we want cache-across-routes behavior
 * without adding a store dependency to this space. If Pinia lands later, this
 * can collapse into a store without API changes for consumers.
 */

import { reactive } from 'vue'

interface OrgPublic {
  id: string
  name: string
  slug: string
  icon?: string
}

// Reactive cache. Value types:
//   OrgPublic  — resolved successfully
//   null       — looked up and got nothing back (deleted or access-denied)
//   undefined  — never requested (absent from the map entirely)
const cache = reactive<Record<string, OrgPublic | null>>({})

// Pending resolution queue. Flushed on the next microtask so a burst of
// lookups across components in the same render collapses to one request.
let pending = new Set<string>()
let flushScheduled = false
const waiters: Array<() => void> = []

async function flush(): Promise<void> {
  flushScheduled = false
  if (pending.size === 0) return

  const ids = Array.from(pending).join(',')
  pending.clear()

  try {
    const res = await fetch(`/api/source/api/orgs?ids=${encodeURIComponent(ids)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data = (await res.json()) as { orgs: OrgPublic[] }
    const returned = new Set<string>()
    for (const o of data.orgs || []) {
      cache[o.id] = o
      returned.add(o.id)
    }
    // Ids we asked for but didn't come back — mark null so we don't retry.
    for (const id of ids.split(',')) {
      if (!returned.has(id)) cache[id] = null
    }
  } catch {
    // Network / auth failure — leave cache alone so a later retry can
    // succeed. Better to show a raw UUID briefly than to poison the cache
    // with null on a transient error.
  } finally {
    const toNotify = waiters.splice(0, waiters.length)
    for (const fn of toNotify) fn()
  }
}

function schedule(): void {
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(flush)
}

export interface UseOrgNames {
  /** Synchronous lookup — returns cached value or undefined. */
  get(id: string): OrgPublic | null | undefined
  /** Display string for an id: name if cached, else the id itself as fallback. */
  label(id: string): string
  /** Queue one or more ids for batch resolution. Returns when the next flush completes. */
  resolve(ids: string[]): Promise<void>
}

export function useOrgNames(): UseOrgNames {
  return {
    get(id) {
      return cache[id]
    },
    label(id) {
      const hit = cache[id]
      if (hit && hit.name) return hit.name
      return id
    },
    async resolve(ids) {
      let queued = false
      for (const raw of ids) {
        const id = (raw || '').trim()
        if (!id) continue
        // Skip ids already in the cache (resolved OR known-missing).
        if (id in cache) continue
        pending.add(id)
        queued = true
      }
      if (!queued) return
      schedule()
      await new Promise<void>((done) => waiters.push(done))
    },
  }
}
