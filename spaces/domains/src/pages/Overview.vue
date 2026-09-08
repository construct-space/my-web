<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { type Domain, listDomains } from '../api'

// Overview is a thin summary of the user's portfolio — counts by status,
// upcoming renewals. Full list lives on /domains/domains.

const domains = ref<Domain[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listDomains()
    domains.value = res.domains ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (isNaN(then)) return null
  return Math.floor((then - Date.now()) / 86_400_000)
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) } catch { return String(iso) }
}

onMounted(load)
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Domains</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Your registered domains, DNS, and renewals — all in one place.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else>
      <!-- Summary -->
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REGISTERED</div>
          <div class="text-3xl font-semibold">{{ domains.length }}</div>
          <div class="text-xs text-[var(--app-muted)]">Total domains you own.</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">AUTO-RENEWING</div>
          <div class="text-3xl font-semibold">{{ domains.filter((d) => d.auto_renew).length }}</div>
          <div class="text-xs text-[var(--app-muted)]">Will renew automatically.</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
          <div class="mono text-xs text-[var(--app-muted)] tracking-wider">EXPIRING &lt;30d</div>
          <div class="text-3xl font-semibold">
            {{ domains.filter((d) => { const n = daysUntil(d.expire_date); return n !== null && n < 30 }).length }}
          </div>
          <div class="text-xs text-[var(--app-muted)]">Needs attention.</div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="flex flex-wrap gap-2">
        <RouterLink
          to="/domains/search"
          class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2 text-sm font-medium"
        >
          <Icon icon="lucide:search" class="size-4" />
          Search &amp; buy
        </RouterLink>
        <RouterLink
          to="/domains/domains"
          class="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm hover:bg-[var(--app-card-hover)]"
        >
          <Icon icon="lucide:list" class="size-4" />
          My domains
        </RouterLink>
      </div>

      <!-- Empty state -->
      <div
        v-if="!domains.length"
        class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
      >
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:globe-2" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No domains yet</div>
        <p class="text-xs text-[var(--app-muted)] mt-1">
          Search for a domain and register it in a few clicks.
        </p>
      </div>

      <!-- Recent / expiring -->
      <div
        v-else
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
      >
        <RouterLink
          v-for="d in domains.slice(0, 5)"
          :key="d.domain"
          :to="`/domains/domains/${d.domain}`"
          class="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--app-card-hover)]"
        >
          <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon icon="lucide:globe-2" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-mono truncate">{{ d.domain }}</div>
            <div class="text-xs text-[var(--app-muted)]">Expires {{ fmtDate(d.expire_date) }}</div>
          </div>
          <span
            v-if="d.auto_renew"
            class="text-[10px] uppercase tracking-wider text-emerald-600 border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0"
          >Auto</span>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
