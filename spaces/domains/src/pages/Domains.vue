<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { type Domain, listDomains } from '../api'

const domains = ref<Domain[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    domains.value = (await listDomains()).domains ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return domains.value
  return domains.value.filter((d) => d.domain.toLowerCase().includes(q))
})

function statusPill(d: Domain): string {
  if (d.status === 'active' || d.status === 'registered') return 'bg-emerald-500/15 text-emerald-600'
  if (d.status === 'pending') return 'bg-amber-500/15 text-amber-600'
  return 'bg-rose-500/15 text-rose-500'
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) } catch { return String(iso) }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">My domains</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">Every domain you own with its registration status and expiry.</p>
      </div>
      <RouterLink
        to="/domains/search"
        class="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2 text-sm font-medium"
      >
        <Icon icon="lucide:plus" class="size-4" />
        Buy domain
      </RouterLink>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Filter by domain…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !domains.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <RouterLink
        v-for="d in filtered"
        :key="d.domain"
        :to="`/domains/domains/${d.domain}`"
        class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--app-card-hover)]"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-mono truncate">{{ d.domain }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">
            Expires {{ fmtDate(d.expire_date) }}
          </div>
        </div>
        <span
          v-if="d.auto_renew"
          class="text-[10px] uppercase tracking-wider text-emerald-600 border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0"
        >Auto-renew</span>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="statusPill(d)">
          {{ d.status }}
        </span>
      </RouterLink>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:globe-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">
        {{ search ? 'No domains match your filter' : 'No domains yet' }}
      </div>
      <RouterLink
        v-if="!search"
        to="/domains/search"
        class="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2 text-sm font-medium"
      >
        <Icon icon="lucide:search" class="size-4" />
        Search domains
      </RouterLink>
    </div>
  </section>
</template>
