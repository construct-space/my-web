<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ConfirmationModal, Modal } from '@construct-space/ui-web'
import { createDomain, deleteDomain, listDomains, verifyDomain, type SendingDomain } from '../api'

const domains = ref<SendingDomain[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')

// New-domain modal
const createOpen = ref(false)
const createBusy = ref(false)
const createError = ref('')
const newDomain = ref('')

// Verify + delete state
const busyId = ref<number | null>(null)
const deleteOpen = ref(false)
const deleteTarget = ref<SendingDomain | null>(null)

async function load() {
  loading.value = true
  error.value = null
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

async function submitCreate() {
  createError.value = ''
  if (!newDomain.value.trim()) { createError.value = 'Enter a domain.'; return }
  createBusy.value = true
  try {
    await createDomain(newDomain.value.trim())
    createOpen.value = false
    newDomain.value = ''
    await load()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    createBusy.value = false
  }
}

async function doVerify(d: SendingDomain) {
  busyId.value = d.id
  try { await verifyDomain(d.id); await load() }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { busyId.value = null }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  busyId.value = deleteTarget.value.id
  try {
    await deleteDomain(deleteTarget.value.id)
    deleteOpen.value = false
    deleteTarget.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyId.value = null
  }
}

function pill(d: SendingDomain): string {
  return d.status === 'verified' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Sending domains</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">Register domains you send from and manage their DKIM/SPF/DMARC records.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 shrink-0"
        @click="createOpen = true; newDomain = ''; createError = ''"
      >
        <Icon icon="lucide:plus" class="size-4" />
        <span>Add domain</span>
      </button>
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

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !domains.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="d in filtered" :key="d.id" class="flex items-center gap-4 px-5 py-3.5">
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:globe-2" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <RouterLink :to="`/delivery/domains/${d.id}`" class="text-sm font-medium truncate font-mono hover:text-[var(--app-accent)] transition-colors block">
            {{ d.domain }}
          </RouterLink>
          <div class="flex items-center gap-3 text-xs text-[var(--app-muted)] mt-0.5">
            <span :class="d.dkim_verified ? 'text-emerald-600' : ''">
              <Icon :icon="d.dkim_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DKIM
            </span>
            <span :class="d.spf_verified ? 'text-emerald-600' : ''">
              <Icon :icon="d.spf_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> SPF
            </span>
            <span :class="d.dmarc_verified ? 'text-emerald-600' : ''">
              <Icon :icon="d.dmarc_verified ? 'lucide:check' : 'lucide:x'" class="size-3 inline" /> DMARC
            </span>
          </div>
        </div>
        <span class="inline-flex text-xs font-medium px-2.5 py-1 rounded shrink-0" :class="pill(d)">
          {{ d.status }}
        </span>
        <button
          class="size-8 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)] hover:text-[var(--app-foreground)] disabled:opacity-30"
          :disabled="busyId === d.id"
          title="Re-verify DNS"
          @click="doVerify(d)"
        >
          <Icon icon="lucide:refresh-cw" class="size-3.5" />
        </button>
        <button
          class="size-8 grid place-items-center rounded text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500"
          :disabled="busyId === d.id"
          title="Delete"
          @click="deleteTarget = d; deleteOpen = true"
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      </div>
    </div>

    <div v-else-if="!loading && !domains.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:globe-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No sending domains yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Add the domain you send from. We'll generate DKIM keys + SPF/DMARC guidance you can publish to DNS.
      </p>
    </div>

    <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">No domains match your filter.</div>

    <Modal v-model:open="createOpen">
      <template #header><h3 class="text-lg font-semibold">Add sending domain</h3></template>
      <template #body>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreate">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Domain *</span>
            <input
              v-model="newDomain"
              type="text"
              placeholder="example.com"
              required
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] font-mono"
            />
          </label>
          <p class="text-xs text-[var(--app-muted)]">
            We'll generate a DKIM keypair for this domain. Publish the returned DNS records, then verify.
          </p>
          <p v-if="createError" class="text-xs text-red-500">{{ createError }}</p>
        </form>
      </template>
      <template #footer>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]" :disabled="createBusy" @click="createOpen = false">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40" :disabled="createBusy" @click="submitCreate">{{ createBusy ? 'Adding…' : 'Add' }}</button>
        </div>
      </template>
    </Modal>

    <ConfirmationModal
      v-model="deleteOpen"
      title="Delete domain"
      :message="`Stop sending from ${deleteTarget?.domain ?? 'this domain'}? DKIM records in DNS can be removed afterwards.`"
      confirm-text="Delete"
      confirm-color="error"
      :loading="busyId !== null"
      @confirm="confirmDelete"
    />
  </section>
</template>
