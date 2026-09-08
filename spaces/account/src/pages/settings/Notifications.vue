<script setup lang="ts">
/**
 * Account → Notifications: two distinct concerns on one page.
 *
 *   Channels — per-surface toggles for transactional notifications (in-app,
 *     web push, mobile push, email fallback) plus device controls for
 *     enabling browser push on this machine. Backed by delivery-api's
 *     /api/notifications/preferences. This is what the bell uses.
 *
 *   Marketing — opt-in for product updates and campaigns. Backed by the
 *     generic preferences row at key="notifications". Security alerts are
 *     always-on.
 */
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from '@construct-space/infra'
import { getPreference, putPreference, type NotificationPrefs } from '../../api'

// Spaces don't import the host module directly — they read the runtime
// the host populated on globalThis. session.ts in infra-shell uses the
// same pattern.
const notif = (() => {
  const infra = globalThis.construct?.infra
  if (!infra) throw new Error('Construct runtime not initialised')
  return infra.notifications
})()

// ─── Channels (transactional) ────────────────────────────────────────────
const channels = ref<NotificationPreferences | null>(null)
const channelsLoading = ref(false)
const channelsError = ref<string | null>(null)
const savingChannel = ref<string | null>(null)

const webPushSupported = ref(true)
const webPushEnabled = ref(false)
const webPushBusy = ref(false)
const webPushError = ref<string | null>(null)

async function loadChannels() {
  channelsLoading.value = true
  channelsError.value = null
  try {
    channels.value = await notif.preferences.get()
  } catch (e) {
    channelsError.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    channelsLoading.value = false
  }
}

async function syncWebPushStatus() {
  if (typeof window === 'undefined') {
    webPushSupported.value = false
    return
  }
  webPushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window
  if (!webPushSupported.value) return
  webPushEnabled.value = await notif.isWebPushEnabled()
}

type ChannelKey = 'in_app_enabled' | 'web_push_enabled' | 'mobile_enabled' | 'email_fallback'

async function toggleChannel(key: ChannelKey, current: boolean) {
  if (!channels.value) return
  channelsError.value = null
  savingChannel.value = key
  const next = !current
  ;(channels.value as Record<string, unknown>)[key] = next
  try {
    channels.value = await notif.preferences.update({ [key]: next } as NotificationPreferencesUpdate)
  } catch (e) {
    ;(channels.value as Record<string, unknown>)[key] = current
    channelsError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    savingChannel.value = null
  }
}

async function toggleWebPush() {
  webPushError.value = null
  webPushBusy.value = true
  try {
    if (webPushEnabled.value) {
      await notif.disableWebPush()
      webPushEnabled.value = false
    } else {
      const ok = await notif.enableWebPush()
      webPushEnabled.value = ok
      if (!ok) {
        webPushError.value = 'Permission denied or push unsupported in this browser.'
      }
    }
  } catch (e) {
    webPushError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    webPushBusy.value = false
  }
}

interface ChannelRow {
  key: ChannelKey
  title: string
  description: string
  icon: string
}

const channelRows: ChannelRow[] = [
  { key: 'in_app_enabled',   title: 'In-app',     description: 'Show notifications in the bell menu and on the live SSE stream.', icon: 'lucide:bell' },
  { key: 'web_push_enabled', title: 'Web push',   description: 'Send notifications to this browser even when the tab is closed.', icon: 'lucide:globe' },
  { key: 'mobile_enabled',   title: 'Mobile',     description: 'Send to Construct Mobile devices registered to your account.',     icon: 'lucide:smartphone' },
  { key: 'email_fallback',   title: 'Email',      description: 'Email a copy when no other channel reaches you within a few minutes.', icon: 'lucide:mail' },
]

// ─── Marketing (legacy) ──────────────────────────────────────────────────
const PREF_KEY = 'notifications'
const marketing = ref<NotificationPrefs>({
  product_updates: true,
  security_alerts: true,
  marketing: false,
})
const marketingLoading = ref(false)
const marketingError = ref<string | null>(null)
const savingMarketing = ref<string | null>(null)

async function loadMarketing() {
  marketingLoading.value = true
  marketingError.value = null
  try {
    const data = await getPreference(PREF_KEY)
    if (data?.value && typeof data.value === 'object') {
      marketing.value = { ...marketing.value, ...(data.value as NotificationPrefs) }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/404|not.?found/i.test(msg)) marketingError.value = msg
  } finally {
    marketingLoading.value = false
  }
}

async function toggleMarketing(key: keyof NotificationPrefs) {
  marketingError.value = null
  const prev = !!marketing.value[key]
  marketing.value = { ...marketing.value, [key]: !prev }
  savingMarketing.value = String(key)
  try {
    await putPreference(PREF_KEY, marketing.value)
  } catch (e) {
    marketing.value = { ...marketing.value, [key]: prev }
    marketingError.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingMarketing.value = null
  }
}

interface MarketingRow {
  key: keyof NotificationPrefs
  title: string
  description: string
  locked?: boolean
}

const marketingRows: MarketingRow[] = [
  { key: 'security_alerts', title: 'Security alerts', description: 'Password changes, new sign-ins, 2FA events.', locked: true },
  { key: 'product_updates', title: 'Product updates', description: 'New features and important platform changes.' },
  { key: 'marketing',       title: 'Marketing',       description: 'Occasional news about events and launches.' },
]

const inAppOn = computed(() => channels.value?.in_app_enabled ?? false)
const webPushPrefOn = computed(() => channels.value?.web_push_enabled ?? false)
const mobileOn = computed(() => channels.value?.mobile_enabled ?? false)
const emailOn = computed(() => channels.value?.email_fallback ?? false)

function valueOf(row: ChannelRow): boolean {
  if (!channels.value) return false
  return Boolean(channels.value[row.key])
}

onMounted(() => {
  loadChannels()
  loadMarketing()
  syncWebPushStatus()
})
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-8">
    <div>
      <h1 class="text-xl font-semibold">Notifications</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Pick which channels Construct uses to reach you, and what kind of news you want.
      </p>
    </div>

    <!-- ─── Channels ──────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-3">
      <div>
        <h2 class="text-sm font-semibold">Channels</h2>
        <p class="text-xs text-[var(--app-muted)] mt-1">Transactional notifications — receipts, transfers, security events.</p>
      </div>

      <div v-if="channelsError" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ channelsError }}</span>
      </div>

      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
        <label
          v-for="row in channelRows"
          :key="row.key"
          class="flex items-start gap-4 px-5 py-4 cursor-pointer"
        >
          <input
            type="checkbox"
            class="mt-1 accent-[var(--app-accent)]"
            :checked="valueOf(row)"
            :disabled="channelsLoading || savingChannel === row.key"
            @change="toggleChannel(row.key, valueOf(row))"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium flex items-center gap-2">
              <Icon :icon="row.icon" class="size-3.5 text-[var(--app-muted)]" />
              {{ row.title }}
              <span v-if="savingChannel === row.key" class="text-xs text-[var(--app-muted)]">saving…</span>
            </div>
            <div class="text-xs text-[var(--app-muted)] mt-1">{{ row.description }}</div>
          </div>
        </label>
      </div>

      <!-- Web push device enrollment — distinct from the channel toggle:
           the toggle says "I want web push at all", this button connects
           THIS BROWSER to my account so push can reach it. -->
      <div
        v-if="webPushPrefOn"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-4 flex items-start gap-4"
      >
        <Icon icon="lucide:monitor-smartphone" class="size-5 text-[var(--app-muted)] mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">This browser</div>
          <div class="text-xs text-[var(--app-muted)] mt-1">
            <template v-if="!webPushSupported">
              Web push isn't supported in this browser.
            </template>
            <template v-else-if="webPushEnabled">
              Subscribed. You'll get push here even when the tab is closed.
            </template>
            <template v-else>
              Not subscribed. Click below to enable for this device.
            </template>
          </div>
          <div v-if="webPushError" class="text-xs text-red-500 mt-1">{{ webPushError }}</div>
        </div>
        <button
          v-if="webPushSupported"
          class="px-3 py-1.5 text-xs rounded-md border border-[var(--app-border)] hover:bg-[var(--app-card-hover)] transition-colors disabled:opacity-50"
          :disabled="webPushBusy"
          @click="toggleWebPush"
        >
          {{ webPushEnabled ? 'Disable' : 'Enable' }}
        </button>
      </div>
    </div>

    <!-- ─── Marketing ─────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-3">
      <div>
        <h2 class="text-sm font-semibold">Marketing emails</h2>
        <p class="text-xs text-[var(--app-muted)] mt-1">News, releases, and platform announcements. Security alerts can't be turned off.</p>
      </div>

      <div v-if="marketingError" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ marketingError }}</span>
      </div>

      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
        <label
          v-for="row in marketingRows"
          :key="row.key"
          class="flex items-start gap-4 px-5 py-4 cursor-pointer"
          :class="row.locked ? 'opacity-70 cursor-not-allowed' : ''"
        >
          <input
            type="checkbox"
            class="mt-1 accent-[var(--app-accent)]"
            :checked="!!marketing[row.key] || row.locked"
            :disabled="row.locked || marketingLoading || savingMarketing === row.key"
            @change="!row.locked && toggleMarketing(row.key)"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium flex items-center gap-2">
              {{ row.title }}
              <span v-if="row.locked" class="text-[10px] uppercase tracking-wider text-[var(--app-muted)] border border-[var(--app-border)] px-1.5 py-0.5 rounded">Required</span>
              <span v-if="savingMarketing === row.key" class="text-xs text-[var(--app-muted)]">saving…</span>
            </div>
            <div class="text-xs text-[var(--app-muted)] mt-1">{{ row.description }}</div>
          </div>
        </label>
      </div>
    </div>
  </section>
</template>
