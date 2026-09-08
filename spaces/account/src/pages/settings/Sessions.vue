<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listSessions, revokeSession, type Session } from '../../api'

const sessions = ref<Session[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const revoking = ref<number | string | null>(null)

async function load() {
  error.value = null
  loading.value = true
  try {
    const data = await listSessions()
    sessions.value = data.sessions || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function revoke(id: number | string) {
  revoking.value = id
  try {
    await revokeSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    revoking.value = null
  }
}

// Best-effort UA parsing for the list label — keeps the raw UA available
// via title attribute so someone debugging can still see the whole string.
function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone / iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  if (/Tauri|construct/i.test(ua)) return 'Construct desktop'
  return 'Browser'
}

function browserLabel(ua: string | null | undefined): string {
  if (!ua) return ''
  if (/Firefox/.test(ua)) return 'Firefox'
  if (/Edg/.test(ua)) return 'Edge'
  if (/Chrome/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  return ''
}

function relTime(iso: string): string {
  const d = new Date(iso)
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

const others = computed(() => sessions.value.filter((s) => !s.current))
const current = computed(() => sessions.value.find((s) => s.current))

onMounted(load)
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Active sessions</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Every device signed into your Construct account. Revoking signs out the session on that device.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !sessions.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <!-- Current session, highlighted. -->
    <div v-if="current" class="rounded-xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_6%,transparent)] p-4 flex items-center gap-4">
      <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-accent)] text-[var(--app-accent-foreground,white)]">
        <Icon icon="lucide:check" class="size-5" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">
          {{ deviceLabel(current.user_agent) }}
          <span v-if="browserLabel(current.user_agent)" class="text-[var(--app-muted)]">· {{ browserLabel(current.user_agent) }}</span>
        </div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5 truncate" :title="current.user_agent || ''">
          Current session · {{ current.ip_address || 'IP unknown' }}
        </div>
      </div>
      <span class="text-xs text-[var(--app-accent)] font-medium">THIS DEVICE</span>
    </div>

    <!-- Other sessions -->
    <div v-if="others.length" class="flex flex-col gap-2">
      <div class="text-xs uppercase tracking-wider text-[var(--app-muted)]">Other sessions</div>
      <div
        v-for="s in others"
        :key="s.id"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex items-center gap-4"
      >
        <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:monitor" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">
            {{ deviceLabel(s.user_agent) }}
            <span v-if="browserLabel(s.user_agent)" class="text-[var(--app-muted)]">· {{ browserLabel(s.user_agent) }}</span>
          </div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5 truncate" :title="s.user_agent || ''">
            {{ s.ip_address || 'IP unknown' }} · last active {{ relTime(s.created_at) }}
          </div>
        </div>
        <Button
          variant="ghost"
          color="error"
          size="xs"
          :loading="revoking === s.id"
          :disabled="revoking === s.id"
          @click="revoke(s.id)"
        >
          {{ revoking === s.id ? 'Revoking…' : 'Revoke' }}
        </Button>
      </div>
    </div>

    <div v-else-if="!loading" class="text-sm text-[var(--app-muted)]">
      No other active sessions.
    </div>
  </section>
</template>
