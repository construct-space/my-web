<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  type DNSRecord,
  type DomainDetail,
  type URLForwarding,
  createDNS,
  createRedirect,
  deleteDNS,
  deleteRedirect,
  getDomain,
  getRedirect,
  listDNS,
  setupDomain,
  updateAutoRenew,
} from '../api'

// Sub-page paths: domains/<name>, domains/<name>/dns, domains/<name>/forwarding.
// Dispatcher hands us {name, section}; we render the right block.
const props = defineProps<{ name: string; section?: string }>()

const detail = ref<DomainDetail | null>(null)
const loading = ref(false)
const error = ref('')
const tab = computed<'overview' | 'dns' | 'forwarding'>(() => {
  const s = (props.section || 'overview').toLowerCase()
  if (s === 'dns' || s === 'forwarding') return s
  return 'overview'
})

// DNS
const records = ref<DNSRecord[]>([])
const dnsLoading = ref(false)
const newRecord = ref<DNSRecord>({ type: 'A', name: '', content: '', ttl: 3600 })
const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'SRV']

// Forwarding
const forwarding = ref<URLForwarding | null>(null)
const redirectTarget = ref('')
const redirectType = ref<'301' | '302'>('301')
const redirectIncludePath = ref(true)
const redirectBusy = ref(false)

async function loadDomain() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await getDomain(props.name)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadDNS() {
  dnsLoading.value = true
  try {
    records.value = (await listDNS(props.name)).records ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    dnsLoading.value = false
  }
}

async function loadForwarding() {
  try {
    forwarding.value = await getRedirect(props.name)
    if (forwarding.value) {
      redirectTarget.value = forwarding.value.target
      redirectType.value = forwarding.value.redirect_type
      redirectIncludePath.value = forwarding.value.include_path
    }
  } catch (e) {
    // No redirect configured → backend commonly 404s; treat as no forwarding.
    forwarding.value = null
  }
}

const settingUp = ref(false)
async function doSetup() {
  settingUp.value = true
  try {
    await setupDomain(props.name)
    await loadDNS()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    settingUp.value = false
  }
}

const autoRenewBusy = ref(false)
async function toggleAutoRenew() {
  if (!detail.value) return
  autoRenewBusy.value = true
  try {
    await updateAutoRenew(props.name, !detail.value.auto_renew)
    await loadDomain()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    autoRenewBusy.value = false
  }
}

async function addRecord() {
  if (!newRecord.value.name || !newRecord.value.content) return
  try {
    await createDNS(props.name, newRecord.value)
    newRecord.value = { type: 'A', name: '', content: '', ttl: 3600 }
    await loadDNS()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function removeRecord(id: string | number) {
  if (!confirm('Delete this DNS record?')) return
  try {
    await deleteDNS(props.name, id)
    await loadDNS()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function saveRedirect() {
  if (!redirectTarget.value) return
  redirectBusy.value = true
  try {
    forwarding.value = await createRedirect(
      props.name,
      redirectTarget.value,
      redirectType.value,
      redirectIncludePath.value,
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    redirectBusy.value = false
  }
}

async function removeForwarding() {
  if (!confirm('Remove URL forwarding?')) return
  redirectBusy.value = true
  try {
    await deleteRedirect(props.name)
    forwarding.value = null
    redirectTarget.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    redirectBusy.value = false
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) } catch { return String(iso) }
}

onMounted(() => {
  loadDomain()
  if (tab.value === 'dns') loadDNS()
  if (tab.value === 'forwarding') loadForwarding()
})
watch(
  () => tab.value,
  (t) => {
    if (t === 'dns' && !records.value.length) loadDNS()
    if (t === 'forwarding') loadForwarding()
  },
)
watch(
  () => props.name,
  () => {
    detail.value = null
    records.value = []
    forwarding.value = null
    loadDomain()
    if (tab.value === 'dns') loadDNS()
    if (tab.value === 'forwarding') loadForwarding()
  },
)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <RouterLink to="/domains/domains" class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] inline-flex items-center gap-1.5 w-fit">
      <Icon icon="lucide:arrow-left" class="size-3.5" />
      All domains
    </RouterLink>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !detail" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="detail">
      <!-- Header -->
      <div class="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4">
        <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold truncate font-mono">{{ detail.domain }}</h1>
          <div class="text-xs text-[var(--app-muted)] mt-1">
            Expires {{ fmtDate(detail.expire_date) }}
          </div>
        </div>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0 bg-emerald-500/15 text-emerald-600">
          {{ detail.status }}
        </span>
      </div>

      <!-- Tab nav -->
      <div class="flex gap-1 border-b border-[var(--app-border)]">
        <RouterLink
          :to="`/domains/domains/${detail.domain}`"
          class="px-3 py-2 text-sm border-b-2 -mb-px"
          :class="tab === 'overview' ? 'border-[var(--app-accent)] text-[var(--app-foreground)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
        >Overview</RouterLink>
        <RouterLink
          :to="`/domains/domains/${detail.domain}/dns`"
          class="px-3 py-2 text-sm border-b-2 -mb-px"
          :class="tab === 'dns' ? 'border-[var(--app-accent)] text-[var(--app-foreground)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
        >DNS</RouterLink>
        <RouterLink
          :to="`/domains/domains/${detail.domain}/forwarding`"
          class="px-3 py-2 text-sm border-b-2 -mb-px"
          :class="tab === 'forwarding' ? 'border-[var(--app-accent)] text-[var(--app-foreground)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
        >Forwarding</RouterLink>
      </div>

      <!-- Overview -->
      <div v-if="tab === 'overview'" class="flex flex-col gap-5">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
            <div class="mono text-xs text-[var(--app-muted)] tracking-wider">REGISTERED</div>
            <div class="text-sm">{{ fmtDate(detail.create_date) }}</div>
          </div>
          <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
            <div class="mono text-xs text-[var(--app-muted)] tracking-wider">EXPIRES</div>
            <div class="text-sm">{{ fmtDate(detail.expire_date) }}</div>
          </div>
          <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex items-center justify-between">
            <div>
              <div class="mono text-xs text-[var(--app-muted)] tracking-wider">AUTO-RENEW</div>
              <div class="text-sm mt-1">{{ detail.auto_renew ? 'On — will renew before expiry' : 'Off — manual renewal' }}</div>
            </div>
            <button
              class="shrink-0 text-xs rounded-md border border-[var(--app-border)] px-3 py-1.5 hover:bg-[var(--app-card-hover)] disabled:opacity-50"
              :disabled="autoRenewBusy"
              @click="toggleAutoRenew"
            >
              {{ detail.auto_renew ? 'Turn off' : 'Turn on' }}
            </button>
          </div>
          <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-1">
            <div class="mono text-xs text-[var(--app-muted)] tracking-wider">WHOIS PRIVACY</div>
            <div class="text-sm">{{ detail.whois_privacy ? 'Enabled — WHOIS stays anonymous' : 'Disabled' }}</div>
          </div>
        </div>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold">Point at Construct</div>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Adds A record for the apex pointing at the Construct edge (23.88.112.108). Useful before hosting a site on this domain.
            </p>
          </div>
          <button
            class="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="settingUp"
            @click="doSetup"
          >
            <Icon icon="lucide:zap" class="size-4" />
            {{ settingUp ? 'Setting up…' : 'Point at Construct' }}
          </button>
        </div>
      </div>

      <!-- DNS -->
      <div v-if="tab === 'dns'" class="flex flex-col gap-4">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="text-sm font-semibold">Add DNS record</div>
          <div class="grid gap-2 md:grid-cols-[80px_1fr_2fr_90px_auto]">
            <select
              v-model="newRecord.type"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5"
            >
              <option v-for="t in recordTypes" :key="t">{{ t }}</option>
            </select>
            <input
              v-model="newRecord.name"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5"
              placeholder="name (e.g. @ or www)"
            />
            <input
              v-model="newRecord.content"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 font-mono"
              placeholder="content"
            />
            <input
              v-model.number="newRecord.ttl"
              type="number"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5"
              placeholder="TTL"
            />
            <button
              class="inline-flex items-center gap-1.5 rounded-md bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-3 py-1.5 text-xs font-medium"
              @click="addRecord"
            >
              <Icon icon="lucide:plus" class="size-3.5" />
              Add
            </button>
          </div>
        </div>

        <div v-if="dnsLoading && !records.length" class="text-sm text-[var(--app-muted)]">Loading records…</div>

        <div
          v-else-if="records.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
        >
          <div v-for="r in records" :key="r.id ?? `${r.type}-${r.name}-${r.content}`" class="px-5 py-3 flex items-center gap-3">
            <span class="inline-flex text-xs font-medium px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] font-mono shrink-0 w-14 justify-center">{{ r.type }}</span>
            <span class="text-sm font-mono truncate w-40 shrink-0">{{ r.name }}</span>
            <code class="flex-1 text-xs font-mono truncate">{{ r.content }}</code>
            <span v-if="r.ttl" class="text-xs text-[var(--app-muted)] shrink-0">TTL {{ r.ttl }}</span>
            <button
              v-if="r.id !== undefined"
              class="text-[var(--app-muted)] hover:text-rose-500 shrink-0"
              :aria-label="`Delete ${r.type} ${r.name}`"
              @click="removeRecord(r.id)"
            >
              <Icon icon="lucide:trash-2" class="size-4" />
            </button>
          </div>
        </div>

        <div v-else-if="!dnsLoading" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center text-sm text-[var(--app-muted)]">
          No DNS records yet. Add one above.
        </div>
      </div>

      <!-- Forwarding -->
      <div v-if="tab === 'forwarding'" class="flex flex-col gap-4">
        <div v-if="forwarding" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div class="text-sm">
            <span class="font-mono">{{ detail.domain }}</span>
            <span class="text-[var(--app-muted)]"> and </span>
            <span class="font-mono">*.{{ detail.domain }}</span>
            <span class="text-[var(--app-muted)]"> redirect to </span>
            <a
              :href="`https://${forwarding.target}`"
              target="_blank"
              rel="noopener"
              class="font-mono text-[var(--app-accent)]"
            >{{ forwarding.target }}</a>
            <span
              class="ml-2 inline-flex text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[var(--app-surface)]"
            >{{ forwarding.redirect_type }}</span>
          </div>
          <button
            class="w-fit inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 text-rose-500 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/10 disabled:opacity-50"
            :disabled="redirectBusy"
            @click="removeForwarding"
          >
            <Icon icon="lucide:trash-2" class="size-3.5" />
            {{ redirectBusy ? 'Removing…' : 'Remove redirect' }}
          </button>
        </div>

        <div v-else class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
          <div>
            <div class="text-sm font-semibold">Forward this domain</div>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Redirect the apex and every subdomain (including www) to another domain via HTTPS.
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs text-[var(--app-muted)]">Target domain</label>
            <input
              v-model="redirectTarget"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              placeholder="example.com"
            />
          </div>
          <div class="flex items-center gap-3">
            <select
              v-model="redirectType"
              class="text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5"
            >
              <option value="301">301 (permanent)</option>
              <option value="302">302 (temporary)</option>
            </select>
            <label class="inline-flex items-center gap-2 text-xs text-[var(--app-muted)]">
              <input v-model="redirectIncludePath" type="checkbox" />
              Include path
            </label>
          </div>
          <button
            class="w-fit inline-flex items-center gap-1.5 rounded-md bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            :disabled="redirectBusy || !redirectTarget"
            @click="saveRedirect"
          >
            <Icon icon="lucide:corner-up-right" class="size-3.5" />
            {{ redirectBusy ? 'Saving…' : 'Enable redirect' }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
