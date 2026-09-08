<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { type DeliveryMessage, listMessages } from '../api'

const messages = ref<DeliveryMessage[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    messages.value = (await listMessages()).messages ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return messages.value
  return messages.value.filter(
    (m) => m.to_email.toLowerCase().includes(q) || (m.subject || '').toLowerCase().includes(q),
  )
})

function pill(s: string): string {
  switch (s) {
    case 'sent':     return 'bg-emerald-500/15 text-emerald-600'
    case 'queued':
    case 'sending': return 'bg-sky-500/15 text-sky-600'
    case 'failed':   return 'bg-amber-500/15 text-amber-600'
    case 'bounced':  return 'bg-rose-500/15 text-rose-500'
    default:         return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }
  catch { return String(iso) }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Messages</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">Your outbound mail — most recent 200 shown.</p>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by recipient or subject…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !messages.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="m in filtered" :key="m.id" class="flex items-center gap-4 px-5 py-3">
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:mail" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ m.subject || '(no subject)' }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate">{{ m.to_email }} · from {{ m.from_email }}</div>
        </div>
        <span class="text-xs text-[var(--app-muted)] w-36 shrink-0 hidden md:inline text-right">
          {{ fmt(m.sent_at || m.created_at) }}
        </span>
        <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="pill(m.status)">
          {{ m.status }}
        </span>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:send" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No messages yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Send something via the API and it'll show up here.
      </p>
    </div>
  </section>
</template>
