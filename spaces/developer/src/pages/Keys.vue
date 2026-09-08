<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listCliPublishers,
  enrollPersonal,
  regenerateKey,
  type PublisherWithKey,
} from '../api'

const publishers = ref<PublisherWithKey[]>([])
const loading   = ref(false)
const enrolling = ref(false)
const regenerating = ref(false)
const error     = ref<string | null>(null)

// Current key state. `currentKey` is the existing `csk_live_*` we read
// from the publisher row — only shown when the user clicks "Show".
// `newKey` is the one-time value returned by enroll/regenerate; we
// highlight it in a warning card since this is the only chance to copy.
const currentKey = ref('')
const revealed   = ref(false)
const newKey     = ref('')
const keyCopied  = ref(false)

const personal = computed(() => publishers.value.find((p) => p.kind === 'user'))
const orgs     = computed(() => publishers.value.filter((p) => p.kind === 'org'))

async function load() {
  loading.value = true
  error.value = null
  try {
    const { publishers: list } = await listCliPublishers()
    publishers.value = list || []
    // Prefer the personal key, then any org key, else blank.
    const owner = personal.value?.api_key
      ? personal.value
      : publishers.value.find((p) => p.api_key)
    currentKey.value = owner?.api_key || ''
    revealed.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function enroll() {
  error.value = null
  enrolling.value = true
  try {
    const res = await enrollPersonal()
    newKey.value = res.apiKey || res.api_key || ''
    await load()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 409 = already enrolled — just refresh silently, no error card.
    if (/409/.test(msg) || /already/i.test(msg)) {
      await load()
      return
    }
    error.value = msg
  } finally {
    enrolling.value = false
  }
}

async function regenerate() {
  if (!confirm('Regenerate your API key? Every CLI or tool using the current key will stop working immediately.')) return
  error.value = null
  regenerating.value = true
  try {
    const res = await regenerateKey()
    newKey.value = res.apiKey
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    regenerating.value = false
  }
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    keyCopied.value = true
    setTimeout(() => (keyCopied.value = false), 1500)
  } catch { /* clipboard perm denied */ }
}

function maskKey(k: string): string {
  if (!k) return '—'
  if (k.length <= 16) return k
  return `${k.slice(0, 12)}…${k.slice(-4)}`
}

onMounted(load)
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">API keys</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Your <code class="font-mono">csk_live_*</code> key authorizes CLI publishes and programmatic access. Treat it like a password.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- One-time key display after enroll / regenerate. -->
    <div v-if="newKey" class="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <Icon icon="lucide:key" class="size-5 shrink-0 text-amber-500 mt-0.5" />
        <div class="flex-1">
          <div class="text-sm font-medium text-amber-600 dark:text-amber-400">Copy this key now</div>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            This is the only time the full key is shown. Once you navigate away it's gone forever — paste it into your CLI or a password manager.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <code class="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] px-3 py-2 rounded font-mono text-sm break-all">{{ newKey }}</code>
        <Button variant="outline" color="neutral" size="sm" @click="copy(newKey)">
          {{ keyCopied ? 'Copied!' : 'Copy' }}
        </Button>
      </div>
      <Button variant="ghost" color="neutral" size="sm" class="self-end" @click="newKey = ''">Got it, hide</Button>
    </div>

    <!-- Not enrolled → primary CTA. -->
    <div v-if="!loading && !publishers.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center flex flex-col gap-4 items-center">
      <div class="size-12 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:user-round-plus" class="size-6" />
      </div>
      <div>
        <div class="text-sm font-medium">Not enrolled as a publisher yet</div>
        <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm">
          Enroll once to get an API key. You can publish spaces under your own name, transfer them to orgs, or rotate keys any time.
        </p>
      </div>
      <Button :loading="enrolling" :disabled="enrolling" icon="lucide:sparkles" @click="enroll">
        {{ enrolling ? 'Enrolling…' : 'Enroll as publisher' }}
      </Button>
    </div>

    <!-- Enrolled: show the current key + manage. -->
    <template v-else-if="personal">
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
            <Icon icon="lucide:key-round" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium flex items-center gap-1.5">
              Personal publisher
              <Icon v-if="personal.verified" icon="lucide:badge-check" class="size-3.5 text-green-500" />
            </div>
            <div class="text-xs text-[var(--app-muted)] truncate">
              <code class="font-mono">{{ personal.name }}</code>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <code class="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] px-3 py-2 rounded font-mono text-sm break-all">{{ revealed ? currentKey : maskKey(currentKey) }}</code>
          <Button variant="outline" color="neutral" size="sm" :icon="revealed ? 'lucide:eye-off' : 'lucide:eye'" @click="revealed = !revealed">
            {{ revealed ? 'Hide' : 'Show' }}
          </Button>
          <Button variant="outline" color="neutral" size="sm" :disabled="!currentKey" @click="copy(currentKey)">
            {{ keyCopied ? 'Copied' : 'Copy' }}
          </Button>
        </div>

        <div class="flex justify-between items-center border-t border-[var(--app-border)] pt-4 -mx-5 px-5">
          <div class="text-xs text-[var(--app-muted)]">
            Rotate regularly or after a device is lost.
          </div>
          <Button variant="outline" color="error" size="sm" :loading="regenerating" :disabled="regenerating" icon="lucide:refresh-cw" @click="regenerate">
            {{ regenerating ? 'Rotating…' : 'Rotate key' }}
          </Button>
        </div>
      </div>

      <!-- Org publishers, if any. Listed read-only here; rotating an org key
           is an admin action owned by the org's owners. -->
      <div v-if="orgs.length" class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold">Organization publishers</h2>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
          <div
            v-for="o in orgs"
            :key="o.name"
            class="flex items-center gap-4 px-5 py-4"
          >
            <Icon icon="lucide:building-2" class="size-5 text-[var(--app-muted)] shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">{{ o.name }}</div>
              <div class="text-xs text-[var(--app-muted)]">Managed via the org's API keys page</div>
            </div>
            <Icon v-if="o.verified" icon="lucide:badge-check" class="size-4 text-green-500 shrink-0" />
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
