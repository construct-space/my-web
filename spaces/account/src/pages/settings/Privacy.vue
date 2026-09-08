<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import {
  getPreference,
  putPreference,
  requestDataExport,
  deleteAccount,
} from '../../api'

// The account space is loaded by the core shell, which owns the router.
// Rather than pull vue-router into every space, we clear the local
// session and let the auth guard redirect to /login via page reload.
const session = useSessionStore()

const prefs = reactive<Record<string, boolean>>({
  analytics: false,
  crash_reports: false,
})

const error = ref<string | null>(null)
const exporting = ref(false)
const exportOk = ref(false)

const showDelete = ref(false)
const deletePassword = ref('')
const deleteLoading = ref(false)
const deleteError = ref<string | null>(null)

async function load() {
  for (const key of Object.keys(prefs)) {
    try {
      const result = await getPreference(`privacy_${key}`)
      if (result?.value !== undefined) prefs[key] = !!result.value
    } catch {
      // Missing preference row just means defaults apply. Silent.
    }
  }
}

async function toggle(key: string) {
  const prev = prefs[key]
  prefs[key] = !prev
  try {
    await putPreference(`privacy_${key}`, prefs[key])
  } catch (e) {
    prefs[key] = prev
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function handleExport() {
  error.value = null
  exportOk.value = false
  exporting.value = true
  try {
    const result = await requestDataExport()
    if (result?.url) {
      // Server generated a pre-signed URL — fire the download.
      window.location.href = result.url
    } else {
      // Inline JSON payload — dump it to a client-side download.
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `construct-account-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
    exportOk.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    exporting.value = false
  }
}

async function handleDelete() {
  deleteError.value = null
  if (!deletePassword.value) {
    deleteError.value = 'Password required.'
    return
  }
  deleteLoading.value = true
  try {
    await deleteAccount(deletePassword.value)
    // Cookie-session is now invalid server-side; clear local state and
    // let the shell's auth guard bounce us to /login on next paint.
    session.signOut()
    window.location.href = '/login'
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : String(e)
  } finally {
    deleteLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Privacy</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Control what Construct shares about you — and take your data with you if you leave.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Telemetry toggles -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
      <label class="flex items-start gap-4 px-5 py-4 cursor-pointer">
        <input type="checkbox" class="mt-1 accent-[var(--app-accent)]" :checked="prefs.analytics" @change="toggle('analytics')" />
        <div class="flex-1">
          <div class="text-sm font-medium">Usage analytics</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">Help improve Construct by sharing anonymous usage data — pages visited, actions taken, no content.</div>
        </div>
      </label>
      <label class="flex items-start gap-4 px-5 py-4 cursor-pointer">
        <input type="checkbox" class="mt-1 accent-[var(--app-accent)]" :checked="prefs.crash_reports" @change="toggle('crash_reports')" />
        <div class="flex-1">
          <div class="text-sm font-medium">Crash reports</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">Automatically send crash traces when the app fails unexpectedly.</div>
        </div>
      </label>
    </div>

    <!-- Data export -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex items-center gap-4">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">Export your data</div>
        <div class="text-xs text-[var(--app-muted)] mt-1">Download everything Construct stores about your account in JSON.</div>
        <div v-if="exportOk" class="text-xs text-green-500 mt-1.5">Export ready.</div>
      </div>
      <Button variant="outline" color="neutral" :loading="exporting" :disabled="exporting" @click="handleExport">
        {{ exporting ? 'Preparing…' : 'Export' }}
      </Button>
    </div>

    <!-- Danger zone -->
    <div class="rounded-xl border border-red-500/40 bg-[color-mix(in_srgb,#ef4444_4%,transparent)] p-5 flex items-center gap-4">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-red-400">Delete account</div>
        <div class="text-xs text-[var(--app-muted)] mt-1">
          Permanently removes your account, all spaces, schemas, and data you own. Irreversible.
        </div>
      </div>
      <Button variant="outline" color="error" @click="showDelete = true; deletePassword = ''; deleteError = null">
        Delete…
      </Button>
    </div>

    <!-- Delete confirmation modal -->
    <div
      v-if="showDelete"
      class="fixed inset-0 z-50 bg-black/60 grid place-items-center p-6"
      @click.self="showDelete = false"
    >
      <div class="w-full max-w-md rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg grid place-items-center bg-red-500/15 text-red-400">
            <Icon icon="lucide:alert-triangle" class="size-5" />
          </div>
          <h2 class="text-lg font-semibold text-red-400">Delete account</h2>
        </div>
        <p class="text-sm text-[var(--app-muted)]">
          This deletes everything and can't be undone. Enter your current password to confirm.
        </p>
        <InputPassword
          v-model="deletePassword"
          placeholder="Password"
          autocomplete="current-password"
          :disabled="deleteLoading"
        />
        <div v-if="deleteError" class="flex items-start gap-2 text-sm text-red-500">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ deleteError }}</span>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" color="neutral" :disabled="deleteLoading" @click="showDelete = false">Cancel</Button>
          <Button color="error" :loading="deleteLoading" :disabled="deleteLoading || !deletePassword" @click="handleDelete">
            {{ deleteLoading ? 'Deleting…' : 'Delete my account' }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
