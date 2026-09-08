<script setup lang="ts">
/**
 * Org → AI Providers. Admins paste one API key per provider; every org
 * member's Construct client picks it up on next operator boot. The
 * "Enforce" toggle makes the org key override any personal key the
 * member has configured — use it when you want all usage to bill back
 * to the org account.
 *
 * Catalog comes from the public /api/source/providers feed (same
 * source-of-truth used by the desktop app), so adding a new provider in
 * oracle lights up a row here with zero frontend release.
 */

import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import {
  type CatalogProvider,
  deleteOrgProviderKey,
  listCatalog,
  listOrgProviderKeys,
  type OrgProviderKey,
  setOrgProviderKey,
} from '../api'

const session = useSessionStore()

// Gate behind owner (or any role with providers.manage — session.scope.roles
// doesn't surface permission-level state here, so use ownership as the
// conservative proxy, matching the source handler's requirePermission).
const canManage = computed(() => (session.scope?.roles || []).includes('owner'))

const catalog = ref<CatalogProvider[]>([])
const keys = ref<OrgProviderKey[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const drafts = ref<Record<string, string>>({})
const editing = ref<Record<string, boolean>>({})
const pending = ref<Record<string, boolean>>({})

const byProvider = computed(() => {
  const m = new Map<string, OrgProviderKey>()
  for (const k of keys.value) m.set(k.provider, k)
  return m
})

// Only providers that take an API key — OAuth-style providers (Claude
// OAuth, Copilot device) can't be centralised from here today.
const keyProviders = computed(() =>
  catalog.value.filter(p => p.auth_type === 'api_key' || !p.auth_type),
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [cat, k] = await Promise.all([listCatalog(), listOrgProviderKeys().catch(() => [])])
    catalog.value = cat.data
    keys.value = k || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startEdit(providerId: string) {
  editing.value[providerId] = true
  drafts.value[providerId] = ''
}

function cancelEdit(providerId: string) {
  editing.value[providerId] = false
  drafts.value[providerId] = ''
}

async function saveKey(providerId: string) {
  const value = (drafts.value[providerId] || '').trim()
  if (!value) return
  pending.value[providerId] = true
  error.value = null
  try {
    await setOrgProviderKey(providerId, { api_key: value })
    editing.value[providerId] = false
    drafts.value[providerId] = ''
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[providerId] = false
  }
}

async function toggleEnforced(providerId: string, current: boolean) {
  pending.value[providerId] = true
  error.value = null
  try {
    await setOrgProviderKey(providerId, { enforced: !current })
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[providerId] = false
  }
}

async function removeKey(providerId: string) {
  if (!confirm('Remove the org key for this provider? Members will fall back to their personal keys.')) return
  pending.value[providerId] = true
  error.value = null
  try {
    await deleteOrgProviderKey(providerId)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    pending.value[providerId] = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">AI Providers</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Paste a key once — every member's Construct client picks it up on next boot. Toggle
        <strong>Enforce</strong> to override members' personal keys and funnel all usage through
        the org account.
      </p>
    </div>

    <div v-if="!canManage" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 text-sm text-[var(--app-muted)]">
      Only org owners can manage shared provider keys.
    </div>

    <template v-else>
      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loading && !catalog.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div
        v-else-if="keyProviders.length"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)] overflow-hidden"
      >
        <div v-for="p in keyProviders" :key="p.id" class="flex items-center gap-3 px-4 py-3">
          <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon :icon="`lucide:${p.icon || 'cpu'}`" class="size-4" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate">{{ p.name }}</span>
              <span
                v-if="byProvider.get(p.id)?.enforced"
                class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-accent)]/15 text-[var(--app-accent)] shrink-0"
              >
                <Icon icon="lucide:shield-check" class="size-3" />
                Enforced
              </span>
            </div>
            <div v-if="byProvider.get(p.id)" class="text-xs font-mono text-[var(--app-muted)] truncate">
              {{ byProvider.get(p.id)?.masked_key }}
            </div>
            <div v-else class="text-xs text-[var(--app-muted)]">
              Not set — members fall back to their personal keys.
            </div>
          </div>

          <template v-if="editing[p.id]">
            <input
              v-model="drafts[p.id]"
              type="password"
              :placeholder="`${p.name} API key`"
              class="w-56 rounded-md border border-[var(--app-border)] bg-[var(--app-background)] px-2 py-1.5 text-xs font-mono text-[var(--app-foreground)]"
              @keydown.enter="saveKey(p.id)"
            />
            <button
              :disabled="!drafts[p.id]?.trim() || pending[p.id]"
              class="rounded-md bg-[var(--app-accent)] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              @click="saveKey(p.id)"
            >
              <Icon :icon="pending[p.id] ? 'lucide:loader-2' : 'lucide:save'" :class="['size-3.5', { 'animate-spin': pending[p.id] }]" />
            </button>
            <button
              class="rounded-md border border-[var(--app-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--app-card-hover)]"
              @click="cancelEdit(p.id)"
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </template>

          <template v-else>
            <button
              v-if="byProvider.get(p.id)"
              class="rounded-md border border-[var(--app-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-50"
              :disabled="pending[p.id]"
              @click="toggleEnforced(p.id, !!byProvider.get(p.id)?.enforced)"
            >
              {{ byProvider.get(p.id)?.enforced ? 'Unenforce' : 'Enforce' }}
            </button>
            <button
              class="rounded-md border border-[var(--app-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--app-card-hover)]"
              @click="startEdit(p.id)"
            >
              {{ byProvider.get(p.id) ? 'Replace' : 'Set key' }}
            </button>
            <button
              v-if="byProvider.get(p.id)"
              class="rounded-md border border-red-500/30 text-red-500 px-2.5 py-1.5 text-xs hover:bg-red-500/10 disabled:opacity-50"
              :disabled="pending[p.id]"
              @click="removeKey(p.id)"
            >
              Remove
            </button>
          </template>
        </div>
      </div>

      <div
        v-else-if="!loading"
        class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
      >
        <Icon icon="lucide:cpu" class="size-6 mx-auto text-[var(--app-muted)]" />
        <div class="text-sm font-medium mt-3">No providers in the catalog yet.</div>
      </div>
    </template>
  </section>
</template>
