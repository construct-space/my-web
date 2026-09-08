<script setup lang="ts">
/**
 * Persistent banner at the top of every Developer page that makes the
 * active publisher identity visible. Without this the URL (/developer)
 * and the content (personal spaces vs org spaces) are indistinguishable
 * when a user has both a personal publisher and an org publisher —
 * nothing on-screen confirms which set they're looking at.
 *
 * Reads straight from the session scope. Scope flips globally when the
 * user switches via the account picker in the sidebar; this banner
 * follows automatically.
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'

const session = useSessionStore()

const kind = computed<'org' | 'personal'>(() =>
  session.scope?.scope === 'org' ? 'org' : 'personal',
)

const title = computed(() => {
  if (kind.value === 'org') return session.scope?.org?.name || 'Organization'
  return session.scope?.user?.name || session.scope?.user?.email || 'You'
})

const subtitle = computed(() => {
  if (kind.value === 'org') {
    const slug = session.scope?.org?.slug
    return slug ? `@${slug} · publishes as the organization` : 'publishes as the organization'
  }
  return 'personal publisher'
})
</script>

<template>
  <div
    class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-3 flex items-center gap-3"
  >
    <div
      class="size-9 rounded-lg grid place-items-center shrink-0"
      :class="kind === 'org'
        ? 'bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]'
        : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
    >
      <Icon :icon="kind === 'org' ? 'lucide:building-2' : 'lucide:user-round'" class="size-4" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Acting as</div>
      <div class="text-sm font-medium truncate flex items-center gap-2">
        {{ title }}
        <span
          class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
          :class="kind === 'org'
            ? 'text-[var(--app-accent)] border-[var(--app-accent)]/40 bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
            : 'text-[var(--app-muted)] border-[var(--app-border)]'"
        >{{ kind === 'org' ? 'Org' : 'Personal' }}</span>
      </div>
      <div class="text-xs text-[var(--app-muted)] truncate">{{ subtitle }}</div>
    </div>
  </div>
</template>
