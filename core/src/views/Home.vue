<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { infraSpaces } from '../spaces'
import { displayName } from '../utils/displayName'

const session = useSessionStore()
const greeting = computed(() => `Welcome, ${displayName(session.scope?.user)}`)

// Capability gates — mirrors the Shell sidebar filter so Home cards and the
// icon rail stay in sync. A user with no org shouldn't see the Organization
// card (it 401s anyway); a non-developer shouldn't see the Developer card.
function caps(): Set<string> {
  const out = new Set<string>()
  const s = session.scope
  if (!session.isAuthenticated) return out
  out.add('identity')
  if (s?.developer) out.add('developer')
  if (s?.scope === 'org') {
    out.add('scope:org')
    for (const r of s.roles) out.add(`role:${r}`)
  }
  if (s?.scope === 'user') out.add('scope:user')
  return out
}

const visibleSpaces = computed(() => {
  const have = caps()
  return infraSpaces.filter((space) => (space.requires ?? []).every((c) => have.has(c)))
})
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-8">
    <header>
      <h1 class="text-3xl font-semibold tracking-tight">{{ greeting }}</h1>
      <div class="flex items-center gap-2 mt-2 text-sm text-[var(--app-muted)]">
        <span class="mono text-xs px-2 py-0.5 rounded bg-[var(--app-surface)] border border-[var(--app-border)]">
          {{ session.scope?.scope?.toUpperCase() || '—' }}
        </span>
        <span v-if="session.scope?.org">· {{ session.scope.org.slug }}</span>
        <span v-if="session.isDeveloper" class="inline-flex items-center gap-1">
          · <Icon icon="lucide:sparkles" class="size-3.5" /> developer
        </span>
      </div>
    </header>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      <RouterLink
        v-for="space in visibleSpaces"
        :key="space.id"
        :to="`/${space.id}`"
        class="p-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] hover:bg-[var(--app-card-hover)] transition-colors flex flex-col gap-3"
      >
        <div class="size-9 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
          <Icon :icon="`lucide:${space.icon}`" class="size-5" />
        </div>
        <div>
          <div class="font-medium text-sm">{{ space.name }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{{ space.description }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
