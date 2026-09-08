<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { Modal } from '@construct-space/ui-web'
import { createAPIKey, type DeliveryAPIKey, listAPIKeys } from '../api'

const keys = ref<DeliveryAPIKey[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

// Create modal state
const createOpen = ref(false)
const createBusy = ref(false)
const createError = ref('')
const newName = ref('')
const revealed = ref<{ key: DeliveryAPIKey; secret: string } | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try { keys.value = (await listAPIKeys()).keys ?? [] }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { loading.value = false }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return keys.value
  return keys.value.filter((k) => k.name.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q))
})

function openCreate() {
  newName.value = ''
  createError.value = ''
  revealed.value = null
  createOpen.value = true
}

async function submitCreate() {
  createError.value = ''
  if (!newName.value.trim()) { createError.value = 'Name is required.'; return }
  createBusy.value = true
  try {
    const res = await createAPIKey(newName.value.trim())
    revealed.value = res
    await load()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    createBusy.value = false
  }
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignored */ }
}

function fmt(iso?: string | null): string {
  if (!iso) return 'Never'
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }
  catch { return String(iso) }
}

onMounted(load)
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">API keys</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Bearer tokens for programmatic access. Use to send mail via POST /api/emails.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 shrink-0"
        @click="openCreate"
      >
        <Icon icon="lucide:plus" class="size-4" />
        <span>New key</span>
      </button>
    </div>

    <div class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3">
      <Icon icon="lucide:search" class="size-4 shrink-0 text-[var(--app-muted)]" />
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or prefix…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-[var(--app-muted)]"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !keys.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[color:var(--app-border)]"
    >
      <div v-for="k in filtered" :key="k.id" class="flex items-center gap-4 px-5 py-3">
        <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:key-square" class="size-4" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ k.name }}</div>
          <div class="text-xs text-[var(--app-muted)] font-mono truncate">{{ k.prefix }}…</div>
        </div>
        <span class="text-xs text-[var(--app-muted)] hidden md:inline">last used {{ fmt(k.last_used_at) }}</span>
      </div>
    </div>

    <div v-else-if="!loading && !keys.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:key-square" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No API keys yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Create one, save the secret immediately — we don't store it in plaintext.
      </p>
    </div>

    <Modal v-model:open="createOpen">
      <template #header>
        <h3 class="text-lg font-semibold">{{ revealed ? 'Key created — save the secret' : 'New API key' }}</h3>
      </template>

      <template #body>
        <form v-if="!revealed" class="flex flex-col gap-3" @submit.prevent="submitCreate">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-[var(--app-muted)]">Name *</span>
            <input
              v-model="newName"
              type="text"
              required
              placeholder="e.g. Production"
              class="rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
            />
          </label>
          <p v-if="createError" class="text-xs text-red-500">{{ createError }}</p>
        </form>

        <div v-else class="flex flex-col gap-3">
          <p class="text-sm text-[var(--app-muted)]">
            Copy this now — Construct Delivery does not store it in plaintext. If you lose it you'll need to rotate.
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 rounded bg-[var(--app-surface)] px-2 py-1.5 text-xs font-mono truncate">{{ revealed.secret }}</code>
            <button
              class="size-7 grid place-items-center rounded text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
              title="Copy"
              @click="revealed && copy(revealed.secret)"
            >
              <Icon icon="lucide:copy" class="size-3.5" />
            </button>
          </div>
        </div>
      </template>

      <template #footer>
        <div v-if="!revealed" class="flex items-center gap-2">
          <button type="button" class="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--app-card-hover)]" :disabled="createBusy" @click="createOpen = false">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40" :disabled="createBusy" @click="submitCreate">{{ createBusy ? 'Creating…' : 'Create' }}</button>
        </div>
        <button
          v-else
          type="button"
          class="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          @click="createOpen = false"
        >Done</button>
      </template>
    </Modal>
  </section>
</template>
