<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getPublisher, listMySpaces, getUsageStats, type Publisher, type Space } from '../api'

const publisher = ref<Publisher | null>(null)
const spaces    = ref<Space[]>([])
const totalSpaces = ref(0)
const stats     = ref<{ queries_today?: number; queries_this_month?: number; storage_bytes?: number } | null>(null)

const loading = ref(true)
const error   = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [pub, list, usage] = await Promise.allSettled([
      getPublisher(),
      listMySpaces(),
      getUsageStats(),
    ])
    if (pub.status === 'fulfilled') publisher.value = pub.value.publisher
    if (list.status === 'fulfilled') {
      spaces.value = list.value.spaces.slice(0, 4)
      totalSpaces.value = list.value.total
    }
    if (usage.status === 'fulfilled') stats.value = usage.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function fmtBytes(n?: number): string {
  if (!n) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let x = n
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++ }
  return `${x.toFixed(1)} ${u[i]}`
}
function fmtNum(n?: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

const statusColor: Record<string, string> = {
  published:         'bg-green-500/15 text-green-500',
  draft:             'bg-[var(--app-surface)] text-[var(--app-muted)]',
  pending_review:    'bg-amber-500/15 text-amber-500',
  approved:          'bg-sky-500/15 text-sky-500',
  rejected:          'bg-red-500/15 text-red-500',
  changes_requested: 'bg-amber-500/15 text-amber-500',
  unpublished:       'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

const pubStatus = computed(() => {
  if (!publisher.value) return { label: 'Not enrolled', color: 'text-amber-500' }
  if (publisher.value.verified) return { label: 'Verified', color: 'text-green-500' }
  return { label: 'Enrolled', color: 'text-[var(--app-accent)]' }
})

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Developer</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Overview of what you've published and how it's doing.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Status</div>
        <div class="mt-2 text-lg font-semibold" :class="pubStatus.color">{{ pubStatus.label }}</div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5">Publisher</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Spaces</div>
        <div class="mt-2 text-lg font-semibold">{{ fmtNum(totalSpaces) }}</div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5">Published + drafts</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Queries today</div>
        <div class="mt-2 text-lg font-semibold">{{ fmtNum(stats?.queries_today) }}</div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5">All spaces combined</div>
      </div>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Storage</div>
        <div class="mt-2 text-lg font-semibold">{{ fmtBytes(stats?.storage_bytes) }}</div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5">Across schemas</div>
      </div>
    </div>

    <!-- Recent spaces -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Recent spaces</h2>
        <RouterLink to="/developer/spaces" class="text-sm text-[var(--app-accent)] hover:underline">All spaces</RouterLink>
      </div>

      <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div v-else-if="spaces.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
        <RouterLink
          v-for="s in spaces"
          :key="s.id"
          :to="`/developer/spaces/${s.id}`"
          class="flex items-center gap-4 px-5 py-3.5 hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
        >
          <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon :icon="`lucide:${s.icon || 'package'}`" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ s.name || s.id }}</div>
            <div class="text-xs text-[var(--app-muted)] truncate">
              <code class="font-mono">{{ s.id }}</code>
              <span v-if="s.version"> · v{{ s.version }}</span>
            </div>
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded" :class="statusColor[s.status] || 'bg-[var(--app-surface)] text-[var(--app-muted)]'">
            {{ s.status.replace('_', ' ') }}
          </span>
        </RouterLink>
      </div>

      <div v-else class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
        <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:package" class="size-6" />
        </div>
        <div class="text-sm font-medium mt-3">No spaces yet</div>
        <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
          Publish your first space with <code class="font-mono">construct publish</code> — or use the Publish tab.
        </p>
      </div>
    </div>
  </section>
</template>
