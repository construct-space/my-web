<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { type Order, listOrders } from '../api'

const orders = ref<Order[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    orders.value = (await listOrders()).orders ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function statusPill(s: string): string {
  switch (s) {
    case 'paid':
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-600'
    case 'pending':
    case 'processing':
      return 'bg-sky-500/15 text-sky-600'
    case 'failed':
    case 'cancelled':
      return 'bg-rose-500/15 text-rose-500'
    default:
      return 'bg-[var(--app-surface)] text-[var(--app-muted)]'
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return String(iso) }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Orders</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every domain purchase receipt and its current status.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !orders.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="orders.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div
        v-for="o in orders"
        :key="o.id"
        class="px-5 py-4 flex items-center gap-4"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:receipt" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">
            {{ o.domains.length }} {{ o.domains.length === 1 ? 'domain' : 'domains' }}
            <span class="text-[var(--app-muted)] font-normal">·</span>
            ${{ o.total }}
          </div>
          <div class="text-xs text-[var(--app-muted)] truncate font-mono">
            {{ o.domains.map((d) => d.domain).join(', ') }}
          </div>
        </div>
        <span class="text-xs text-[var(--app-muted)] shrink-0 hidden md:inline">{{ fmtDateTime(o.created_at) }}</span>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="statusPill(o.status)">
          {{ o.status }}
        </span>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:receipt" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No orders yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1">Purchases show up here after you buy your first domain.</p>
    </div>
  </section>
</template>
