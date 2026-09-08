<script setup lang="ts">
/**
 * UserMenu — popover anchored to the avatar button at the bottom of the
 * shell sidebar. Replaces the previous "click avatar → sign out
 * immediately" behavior, which was too easy to hit by accident and gave
 * the user no way to land on their profile / settings without using the
 * URL bar.
 *
 * Renders identity (name + email) at the top, then Profile / Settings
 * navigation, then a destructive Sign out at the bottom. Profile-switching
 * is intentionally not surfaced here; that flow lives in account.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { displayName } from '../utils/displayName'

const session = useSessionStore()
const router = useRouter()

const open = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const userName = computed(() => displayName(session.scope?.user, 'You'))
const userEmail = computed(() => session.scope?.user?.email || '')
const avatarUrl = computed(() => session.scope?.user?.avatar_url || '')
const avatarBroken = ref(false)

const initials = computed(() => {
  const n = userName.value
  return n.split(/\s+|@/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?'
})

watch(avatarUrl, () => {
  avatarBroken.value = false
})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function go(path: string) {
  close()
  router.push(path)
}

function signOut() {
  close()
  session.signOut()
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

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="relative">
    <button
      ref="anchorRef"
      class="size-9 rounded-full grid place-items-center overflow-hidden bg-[var(--app-surface)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
      :class="{ 'ring-2 ring-[var(--app-accent)] ring-offset-1 ring-offset-[var(--app-canvas-bg)]': open }"
      :title="userEmail || userName"
      @click="toggle"
    >
      <img
        v-if="avatarUrl && !avatarBroken"
        :src="avatarUrl"
        :alt="userName"
        class="size-full rounded-full object-cover"
        @error="avatarBroken = true"
      />
      <span v-else>{{ initials }}</span>
    </button>

    <div
      v-if="open"
      ref="popoverRef"
      class="absolute bottom-0 left-[calc(100%+8px)] z-50 w-64 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg overflow-hidden"
    >
      <!-- Identity header -->
      <div class="px-4 py-3 border-b border-[var(--app-border)]">
        <div class="text-sm font-semibold truncate">{{ userName }}</div>
        <div v-if="userEmail" class="text-xs text-[var(--app-muted)] truncate">{{ userEmail }}</div>
      </div>

      <!-- Navigation -->
      <div class="py-1">
        <button
          class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
          @click="go('/account')"
        >
          <Icon icon="lucide:user-round" class="size-4 text-[var(--app-muted)]" />
          <span>Profile</span>
        </button>
        <button
          class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
          @click="go('/account/appearance')"
        >
          <Icon icon="lucide:settings" class="size-4 text-[var(--app-muted)]" />
          <span>Settings</span>
        </button>
      </div>

      <!-- Sign out -->
      <div class="border-t border-[var(--app-border)] py-1">
        <button
          class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-[color-mix(in_srgb,#ef4444_8%,transparent)] transition-colors"
          @click="signOut"
        >
          <Icon icon="lucide:log-out" class="size-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  </div>
</template>
