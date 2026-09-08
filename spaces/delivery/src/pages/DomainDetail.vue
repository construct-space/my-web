<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ConfirmationModal } from '@construct-space/ui-web'
import {
  type DeliveryMessage,
  type DomainDetail,
  getDomain,
  getDomainMessages,
  verifyDomain,
} from '../api'

// The Dispatcher parses the sub-page path (`domains/<id>`) and hands the id
// down as a prop — keeps this space free of vue-router.
const props = defineProps<{ id: string }>()

const detail = ref<DomainDetail | null>(null)
const messages = ref<DeliveryMessage[]>([])
const loading = ref(false)
const error = ref('')
const verifyOpen = ref(false)
const verifyBusy = ref(false)

async function load() {
  if (!props.id) return
  loading.value = true
  error.value = ''
  try {
    const [d, m] = await Promise.all([getDomain(props.id), getDomainMessages(props.id)])
    detail.value = d
    messages.value = m.messages ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function confirmVerify() {
  verifyBusy.value = true
  try {
    detail.value = await verifyDomain(props.id)
    verifyOpen.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    verifyOpen.value = false
  } finally {
    verifyBusy.value = false
  }
}

watch(() => props.id, load)

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignored */ }
}

function pill(s: string): string {
  return s === 'verified' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
}

function msgPill(s: string): string {
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
    <div v-if="loading && !detail" class="text-sm text-[var(--app-muted)]">Loading…</div>
    <div v-else-if="error && !detail" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <template v-else-if="detail">
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate font-mono">{{ detail.domain.domain }}</h1>
          <div class="flex items-center gap-3 text-xs text-[var(--app-muted)] mt-1">
            <span :class="detail.domain.dkim_verified ? 'text-emerald-600' : ''">
              <Icon :icon="detail.domain.dkim_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DKIM
            </span>
            <span :class="detail.domain.spf_verified ? 'text-emerald-600' : ''">
              <Icon :icon="detail.domain.spf_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> SPF
            </span>
            <span :class="detail.domain.dmarc_verified ? 'text-emerald-600' : ''">
              <Icon :icon="detail.domain.dmarc_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DMARC
            </span>
          </div>
        </div>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="pill(detail.domain.status)">
          {{ detail.domain.status }}
        </span>
        <button
          class="inline-flex items-center gap-1.5 rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]"
          @click="verifyOpen = true"
        >
          <Icon icon="lucide:refresh-cw" class="size-3.5" />
          Re-verify
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DNS RECORDS</div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]">
          <div v-for="(rec, i) in detail.dns_records" :key="i" class="px-5 py-3 flex flex-col gap-1">
            <div class="flex items-center gap-3">
              <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] font-mono shrink-0">{{ rec.type }}</span>
              <span class="text-sm font-mono truncate flex-1">{{ rec.name }}</span>
              <span v-if="rec.ttl" class="text-xs text-[var(--app-muted)] shrink-0">TTL {{ rec.ttl }}</span>
            </div>
            <div class="flex items-start gap-2">
              <code class="flex-1 text-xs font-mono bg-[var(--app-surface)] rounded px-2 py-1.5 break-all">{{ rec.value }}</code>
              <button
                class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] shrink-0"
                title="Copy value"
                @click="copy(rec.value)"
              >
                <Icon icon="lucide:copy" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">RECENT MESSAGES ({{ messages.length }})</div>
        <div
          v-if="messages.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div v-for="m in messages" :key="m.id" class="flex items-center gap-4 px-5 py-3">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ m.subject || '(no subject)' }}</div>
              <div class="text-xs text-[var(--app-muted)] truncate">to {{ m.to_email }}</div>
            </div>
            <span class="text-xs text-[var(--app-muted)] shrink-0 hidden md:inline">{{ fmt(m.sent_at || m.created_at) }}</span>
            <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded shrink-0" :class="msgPill(m.status)">{{ m.status }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-[var(--app-muted)] px-5 py-3 rounded-xl border border-dashed border-[var(--app-border)]">
          No messages sent from this domain yet.
        </div>
      </div>
    </template>

    <ConfirmationModal
      v-model="verifyOpen"
      title="Re-verify domain"
      message="Re-run DKIM / SPF / DMARC DNS lookups and update status. Read-only against public DNS — safe."
      confirm-text="Verify"
      confirm-color="primary"
      :loading="verifyBusy"
      @confirm="confirmVerify"
    />
  </section>
</template>
