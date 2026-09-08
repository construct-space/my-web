<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { listDomains, listMessages, listAPIKeys, type SendingDomain, type DeliveryMessage, type DeliveryAPIKey } from '../api'

const session = useSessionStore()

const domains = ref<SendingDomain[]>([])
const messages = ref<DeliveryMessage[]>([])
const keys = ref<DeliveryAPIKey[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const verifiedDomains = computed(() => domains.value.filter((d) => d.status === 'verified').length)
const sentMessages   = computed(() => messages.value.filter((m) => m.status === 'sent').length)
const failedMessages = computed(() => messages.value.filter((m) => m.status === 'failed' || m.status === 'bounced').length)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [d, m, k] = await Promise.all([listDomains(), listMessages(), listAPIKeys()])
    domains.value = d.domains ?? []
    messages.value = m.messages ?? []
    keys.value = k.keys ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Email delivery</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Welcome{{ session.scope?.user?.name ? `, ${session.scope.user.name.split(' ')[0]}` : '' }} — send transactional email through {{ sentMessages + failedMessages }} messages' worth of real-world deliverability.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !domains.length && !messages.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">DOMAINS</div>
        <div class="text-3xl font-semibold">{{ domains.length }}</div>
        <div class="text-xs text-[var(--app-muted)]">
          <strong class="text-emerald-600">{{ verifiedDomains }}</strong> verified ·
          <strong>{{ domains.length - verifiedDomains }}</strong> pending
        </div>
      </div>

      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">MESSAGES</div>
        <div class="text-3xl font-semibold">{{ messages.length }}</div>
        <div class="text-xs text-[var(--app-muted)]">
          <strong class="text-emerald-600">{{ sentMessages }}</strong> sent ·
          <strong class="text-rose-500">{{ failedMessages }}</strong> failed/bounced
        </div>
      </div>

      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-2">
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">API KEYS</div>
        <div class="text-3xl font-semibold">{{ keys.length }}</div>
        <div class="text-xs text-[var(--app-muted)]">Programmatic access tokens.</div>
      </div>
    </div>
  </section>
</template>
