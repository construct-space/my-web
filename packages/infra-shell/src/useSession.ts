/**
 * useSession — focused composable for "who is the caller acting as".
 *
 * Thin wrapper over useSessionStore that exposes the read-mostly shape
 * components care about: identity, scope, org, roles, loading state,
 * and a refresh() trigger. Storing it as a composable keeps consumers
 * one import away from "what scope am I in" without learning Pinia or
 * remembering which getter name maps to which scope field.
 *
 * Writes (setTokens / signOut) still go through the store directly —
 * those are infrastructure concerns, not per-component state.
 */

import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import type { Scope } from '@construct-space/infra'
import { useSessionStore } from './session.js'

export interface UseSession {
  /** Current scope payload from /api/me/scope, or null until first load. */
  scope: ComputedRef<Scope | null>
  /** Did the first scope fetch complete (success OR known-unauthenticated)? */
  loaded: ComputedRef<boolean>
  /** True while a refresh is in flight. */
  loading: ComputedRef<boolean>
  /** Last refresh error, if any. */
  error: ComputedRef<string | null>

  /** Authenticated via session cookie OR bearer token. */
  isAuthenticated: ComputedRef<boolean>
  /** Caller is currently acting in an org context. */
  isOrg: ComputedRef<boolean>
  /** Active org id when isOrg, else null. */
  orgId: ComputedRef<string | null>
  /** Caller has the developer capability in the current scope. */
  isDeveloper: ComputedRef<boolean>
  /** Roles the caller holds in the current scope. */
  roles: ComputedRef<readonly string[]>

  /** Re-fetch /api/me/scope and update reactive state. */
  refresh(): Promise<void>
}

export function useSession(): UseSession {
  const store = useSessionStore()
  const { scope, scopeLoaded, loading, error } = storeToRefs(store)
  return {
    scope: computed(() => scope.value),
    loaded: computed(() => scopeLoaded.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated: computed(() => store.isAuthenticated),
    isOrg: computed(() => scope.value?.scope === 'org' && !!scope.value?.org?.id),
    orgId: computed(() => store.orgId),
    isDeveloper: computed(() => store.isDeveloper),
    roles: computed(() => scope.value?.roles ?? []),
    refresh: () => store.refreshScope(),
  }
}
