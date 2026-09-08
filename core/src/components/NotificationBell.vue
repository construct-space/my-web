<script setup lang="ts">
/**
 * NotificationBell — sidebar widget that shows the current user's
 * notification inbox. Mirrors UserMenu's popover pattern: a small icon
 * button anchors a panel that flies out to the right.
 *
 * Wiring:
 *   • Initial unread count + first page on mount.
 *   • Live updates via SSE through useInfra().notifications.stream().
 *   • Click a row → mark read + navigate to its `link` if set.
 *   • "Mark all read" + "Notification settings" footer actions.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import type { Notification } from '@construct-space/infra'
import { useInfra } from '../host'

const router = useRouter()
const session = useSessionStore()
const construct = useInfra()
const api = construct.notifications

const open = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const items = ref<Notification[]>([])
const unread = ref(0)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
let stopStream: (() => void) | null = null

const badge = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))

async function load() {
  loading.value = true
  errorMsg.value = null
  try {
    const [list, count] = await Promise.all([
      api.list({ limit: 30 }),
      api.unreadCount(),
    ])
    items.value = list.notifications
    unread.value = count.unread
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    loading.value = false
  }
}

function attachStream() {
  if (stopStream) return
  stopStream = api.stream({
    onNotification(n) {
      // Prepend, dedupe by id (server may resend on reconnect resync).
      items.value = [n, ...items.value.filter((x) => x.id !== n.id)].slice(0, 50)
    },
    onUnreadCount(c) {
      unread.value = c
    },
    onError() {
      // EventSource auto-retries; if the auto-retry gives up, the SDK
      // backoff loop reopens. No UI surface needed for blips.
    },
  })
}

function detachStream() {
  stopStream?.()
  stopStream = null
}

watch(
  () => session.isAuthenticated,
  (auth) => {
    if (auth) {
      load()
      attachStream()
    } else {
      detachStream()
      items.value = []
      unread.value = 0
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  detachStream()
})

function toggle() {
  open.value = !open.value
  if (open.value) load()
}

function close() {
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  const t = e.target as Node | null
  if (!t) return
  if (anchorRef.value?.contains(t)) return
  if (popoverRef.value?.contains(t)) return
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

async function activate(n: Notification) {
  if (!n.read_at) {
    try {
      await api.markRead(n.id)
      n.read_at = new Date().toISOString()
      unread.value = Math.max(0, unread.value - 1)
    } catch {
      /* swallow — UI optimistic state already updated below */
    }
  }
  close()
  if (n.link) router.push(n.link)
}

async function markAll() {
  const prev = unread.value
  unread.value = 0
  items.value = items.value.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
  try {
    await api.markAllRead()
  } catch {
    unread.value = prev
  }
}

async function remove(n: Notification, e: Event) {
  e.stopPropagation()
  const idx = items.value.findIndex((x) => x.id === n.id)
  if (idx < 0) return
  const [removed] = items.value.splice(idx, 1)
  if (!removed.read_at) unread.value = Math.max(0, unread.value - 1)
  try {
    await api.delete(n.id)
  } catch {
    items.value.splice(idx, 0, removed)
    if (!removed.read_at) unread.value += 1
  }
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const diff = Math.max(0, Date.now() - d)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString()
}

function iconFor(n: Notification): string {
  // Map known event types to lucide icons; fall back to a generic bell.
  if (n.type.startsWith('billing.')) return 'lucide:credit-card'
  if (n.type.startsWith('transfer.')) return 'lucide:arrow-left-right'
  if (n.type.startsWith('space.')) return 'lucide:package'
  if (n.type.startsWith('developer.')) return 'lucide:code-2'
  if (n.type.startsWith('org.')) return 'lucide:building-2'
  if (n.source === 'oracle') return 'lucide:shield'
  return 'lucide:bell'
}

function goToPreferences() {
  close()
  router.push('/account/notifications')
}
</script>

<template>
  <div class="relative">
    <button
      ref="anchorRef"
      class="size-9 rounded-lg grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors relative"
      :class="{ 'text-[var(--app-foreground)] bg-[var(--app-card-hover)]': open }"
      title="Notifications"
      @click="toggle"
    >
      <Icon icon="lucide:bell" class="size-5" />
      <span
        v-if="unread > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[16px] font-semibold text-center"
      >
        {{ badge }}
      </span>
    </button>

    <div
      v-if="open"
      ref="popoverRef"
      class="absolute bottom-0 left-[calc(100%+8px)] z-50 w-[360px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg overflow-hidden flex flex-col"
      style="max-height: min(560px, 80vh)"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--app-border)] flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">Notifications</div>
        <button
          v-if="unread > 0"
          class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] transition-colors"
          @click="markAll"
        >
          Mark all read
        </button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loading && !items.length" class="px-4 py-8 text-center text-xs text-[var(--app-muted)]">
          Loading…
        </div>
        <div v-else-if="errorMsg" class="px-4 py-8 text-center text-xs text-red-500">
          {{ errorMsg }}
        </div>
        <div v-else-if="!items.length" class="px-4 py-10 text-center">
          <Icon icon="lucide:bell-off" class="size-6 text-[var(--app-muted)] mx-auto mb-2" />
          <div class="text-xs text-[var(--app-muted)]">You're all caught up.</div>
        </div>
        <ul v-else class="divide-y divide-[var(--app-border)]">
          <li
            v-for="n in items"
            :key="n.id"
            class="group px-4 py-3 cursor-pointer hover:bg-[var(--app-card-hover)] transition-colors flex gap-3"
            :class="{ 'bg-[color-mix(in_srgb,var(--app-accent)_4%,transparent)]': !n.read_at }"
            @click="activate(n)"
          >
            <div
              class="size-8 rounded-md grid place-items-center shrink-0 mt-0.5"
              :class="!n.read_at
                ? 'bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]'
                : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
            >
              <Icon :icon="iconFor(n)" class="size-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2">
                <div class="text-sm font-medium truncate flex-1">{{ n.title }}</div>
                <div class="text-[10px] text-[var(--app-muted)] shrink-0">{{ relTime(n.created_at) }}</div>
              </div>
              <div v-if="n.body" class="text-xs text-[var(--app-muted)] mt-0.5 line-clamp-2">{{ n.body }}</div>
            </div>
            <button
              class="size-6 rounded grid place-items-center text-[var(--app-muted)] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-[color-mix(in_srgb,#ef4444_10%,transparent)] transition-all shrink-0"
              :title="`Dismiss`"
              @click="remove(n, $event)"
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </li>
        </ul>
      </div>

      <!-- Footer -->
      <div class="border-t border-[var(--app-border)] px-3 py-2 flex items-center justify-between">
        <button
          class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] flex items-center gap-1.5 transition-colors"
          @click="goToPreferences"
        >
          <Icon icon="lucide:settings" class="size-3.5" />
          Notification settings
        </button>
      </div>
    </div>
  </div>
</template>
