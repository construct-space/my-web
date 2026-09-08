<script setup lang="ts">
/**
 * Usage — rolled-up stats across all of the user's spaces. Queries the
 * /api/developer/data/stats façade which aggregates from graph internally.
 *
 * Keeping this lean for MVP — four scalar cards + a "last request at"
 * timestamp. Per-space + per-day charts land in a follow-up once we
 * know what cardinality graph's stats endpoint returns.
 */
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { getUsageStats, type UsageStats } from '../api'

const stats = ref<UsageStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    stats.value = await getUsageStats()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function fmtNum(n?: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}
function fmtBytes(n?: number): string {
  if (!n) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let x = n
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++ }
  return `${x.toFixed(1)} ${u[i]}`
}
function fmtPct(n?: number): string {
  if (typeof n !== 'number') return '—'
  return `${(n * 100).toFixed(2)}%`
}
function fmtRelative(iso?: string | null): string {
  if (!iso) return 'never'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Usage</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Rolled up across every space you publish.
        </p>
      </div>
      <Button variant="outline" color="neutral" size="sm" icon="lucide:refresh-cw" :loading="loading" :disabled="loading" @click="load">
        Refresh
      </Button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-center gap-2 text-xs text-[var(--app-muted)] uppercase tracking-wider">
          <Icon icon="lucide:activity" class="size-3.5" />
          Queries today
        </div>
        <div class="mt-3 text-2xl font-semibold">{{ fmtNum(stats?.queries_today) }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-center gap-2 text-xs text-[var(--app-muted)] uppercase tracking-wider">
          <Icon icon="lucide:calendar" class="size-3.5" />
          This month
        </div>
        <div class="mt-3 text-2xl font-semibold">{{ fmtNum(stats?.queries_this_month) }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-center gap-2 text-xs text-[var(--app-muted)] uppercase tracking-wider">
          <Icon icon="lucide:hard-drive" class="size-3.5" />
          Storage
        </div>
        <div class="mt-3 text-2xl font-semibold">{{ fmtBytes(stats?.storage_bytes) }}</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-center gap-2 text-xs text-[var(--app-muted)] uppercase tracking-wider">
          <Icon icon="lucide:alert-triangle" class="size-3.5" />
          Error rate
        </div>
        <div class="mt-3 text-2xl font-semibold" :class="(stats?.error_rate || 0) > 0.01 ? 'text-amber-500' : ''">
          {{ fmtPct(stats?.error_rate) }}
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex items-center gap-3">
      <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:clock" class="size-5" />
      </div>
      <div>
        <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Last request</div>
        <div class="text-sm font-medium">{{ fmtRelative(stats?.last_request_at) }}</div>
      </div>
    </div>

    <p class="text-xs text-[var(--app-muted)] text-center">
      Per-space breakdowns + time-series charts coming next.
    </p>
  </section>
</template>
