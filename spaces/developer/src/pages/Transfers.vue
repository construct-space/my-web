<script setup lang="ts">
/**
 * Space ownership transfers — two-tab inbox (Incoming / Outgoing).
 *
 * Incoming: transfers someone else kicked off that target this user
 * (or an org they own). User can accept or decline.
 *
 * Outgoing: transfers this user initiated to another user/org. Can be
 * cancelled up until the recipient responds.
 *
 * No URL sync like the legacy page — a single-page sub-nav tab swap
 * fits better inside my's space chrome, and there are no deep-link
 * callers to preserve (the old /author/transfers URLs are gone).
 */
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listIncoming,
  listOutgoing,
  acceptTransfer,
  declineTransfer,
  cancelTransfer,
  type Transfer,
} from '../api'

const tab       = ref<'incoming' | 'outgoing'>('incoming')
const incoming  = ref<Transfer[]>([])
const outgoing  = ref<Transfer[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)
const mutating  = ref<Record<number, 'accept' | 'decline' | 'cancel'>>({})

const current = computed(() => tab.value === 'incoming' ? incoming.value : outgoing.value)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [inn, out] = await Promise.allSettled([listIncoming(), listOutgoing()])
    incoming.value = inn.status === 'fulfilled' ? (inn.value.transfers || []) : []
    outgoing.value = out.status === 'fulfilled' ? (out.value.transfers || []) : []
    if (inn.status === 'rejected' && out.status === 'rejected') {
      error.value = inn.reason instanceof Error ? inn.reason.message : String(inn.reason)
    }
  } finally {
    loading.value = false
  }
}

async function run(action: 'accept' | 'decline' | 'cancel', t: Transfer) {
  const prompts = {
    accept: 'Accept ownership of this space? This cannot be undone.',
    decline: undefined,
    cancel: 'Cancel this pending transfer?',
  } as const
  const prompt = prompts[action]
  if (prompt && !confirm(prompt)) return

  mutating.value = { ...mutating.value, [t.id]: action }
  error.value = null
  try {
    if (action === 'accept')       await acceptTransfer(t.id)
    else if (action === 'decline') await declineTransfer(t.id)
    else                            await cancelTransfer(t.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    const next = { ...mutating.value }
    delete next[t.id]
    mutating.value = next
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

const statusBadge: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-500',
  accepted:  'bg-green-500/15 text-green-500',
  declined:  'bg-red-500/15 text-red-500',
  expired:   'bg-[var(--app-surface)] text-[var(--app-muted)]',
  cancelled: 'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

onMounted(load)
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Transfers</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Move space ownership between users or organizations. Pending transfers expire after 14 days.
      </p>
    </div>

    <!-- Tab switcher -->
    <div class="inline-flex self-start rounded-lg border border-[var(--app-border)] p-0.5 bg-[var(--app-card-bg)]">
      <button
        class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
        :class="tab === 'incoming'
          ? 'bg-[var(--app-accent)] text-[var(--app-accent-foreground,white)]'
          : 'text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
        @click="tab = 'incoming'"
      >
        <Icon icon="lucide:inbox" class="size-3.5" />
        Incoming
        <span v-if="incoming.length" class="text-[10px] px-1.5 rounded-full" :class="tab === 'incoming' ? 'bg-white/20' : 'bg-[var(--app-surface)]'">{{ incoming.length }}</span>
      </button>
      <button
        class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
        :class="tab === 'outgoing'
          ? 'bg-[var(--app-accent)] text-[var(--app-accent-foreground,white)]'
          : 'text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
        @click="tab = 'outgoing'"
      >
        <Icon icon="lucide:send" class="size-3.5" />
        Outgoing
        <span v-if="outgoing.length" class="text-[10px] px-1.5 rounded-full" :class="tab === 'outgoing' ? 'bg-white/20' : 'bg-[var(--app-surface)]'">{{ outgoing.length }}</span>
      </button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !current.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="current.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
      <div
        v-for="t in current"
        :key="t.id"
        class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4"
      >
        <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon :icon="tab === 'incoming' ? 'lucide:download' : 'lucide:upload'" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">
            <code class="font-mono">{{ t.space_name || `space#${t.space_id}` }}</code>
          </div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">
            <template v-if="tab === 'incoming'">
              From <span class="text-[var(--app-foreground)]">{{ t.from_publisher || '—' }}</span>
            </template>
            <template v-else>
              To <span class="text-[var(--app-foreground)]">{{ t.to_publisher || '—' }}</span>
            </template>
            · requested {{ fmtDate(t.created_at) }}
            <span v-if="t.status === 'pending'"> · expires in {{ daysUntil(t.expires_at) }}d</span>
          </div>
        </div>

        <span class="text-xs font-medium px-2 py-1 rounded capitalize" :class="statusBadge[t.status] || 'bg-[var(--app-surface)] text-[var(--app-muted)]'">
          {{ t.status }}
        </span>

        <div v-if="t.status === 'pending'" class="flex items-center gap-2">
          <template v-if="tab === 'incoming'">
            <Button
              variant="ghost"
              color="neutral"
              size="sm"
              :loading="mutating[t.id] === 'decline'"
              :disabled="!!mutating[t.id]"
              @click="run('decline', t)"
            >Decline</Button>
            <Button
              size="sm"
              :loading="mutating[t.id] === 'accept'"
              :disabled="!!mutating[t.id]"
              @click="run('accept', t)"
            >Accept</Button>
          </template>
          <template v-else>
            <Button
              variant="outline"
              color="error"
              size="sm"
              :loading="mutating[t.id] === 'cancel'"
              :disabled="!!mutating[t.id]"
              @click="run('cancel', t)"
            >Cancel</Button>
          </template>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon :icon="tab === 'incoming' ? 'lucide:inbox' : 'lucide:send'" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">
        No {{ tab }} transfers
      </div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        <template v-if="tab === 'incoming'">
          When someone sends you ownership of a space, it'll appear here.
        </template>
        <template v-else>
          Start a transfer from any space's detail page to move ownership to another user or org.
        </template>
      </p>
    </div>
  </section>
</template>
