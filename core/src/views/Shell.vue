<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { Toolbar3D } from '@construct-space/ui-web'
import ConstructLogo from '../components/ConstructLogo.vue'
import UserMenu from '../components/UserMenu.vue'
import NotificationBell from '../components/NotificationBell.vue'
import {
  useSessionStore,
  usePageActions,
  type InfraSpace,
  type ToolbarAction,
} from '@construct-space/infra-shell'
import { infraSpaces, findSpace } from '../spaces'

const router = useRouter()

const session = useSessionStore()
const route = useRoute()

const showChrome = computed(() => route.meta.requiresAuth !== false && route.name !== 'signin')

function caps(): Set<string> {
  const s = session.scope
  const out = new Set<string>()
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

const visibleSpaces = computed<InfraSpace[]>(() => {
  if (!session.isAuthenticated) return []
  const have = caps()
  return infraSpaces.filter((space) => (space.requires ?? []).every((c) => have.has(c)))
})

// Current space derived from the leading segment of the route path
const currentSpace = computed<InfraSpace | null>(() => {
  const seg = route.path.split('/').filter(Boolean)[0]
  return seg ? findSpace(seg) ?? null : null
})

const currentSubId = computed(() => {
  if (!currentSpace.value) return ''
  const params = route.params as { subPage?: string }
  return params.subPage ?? ''
})

function subPath(space: InfraSpace, sub: string): string {
  return sub ? `/${space.id}/${sub}` : `/${space.id}`
}

interface Crumb { label: string; to?: string; icon?: string }

function crumbsForPath(path: string): Crumb[] {
  const segs = path.split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: 'HOME', to: '/', icon: 'lucide:home' }]
  const space = segs[0] ? findSpace(segs[0]) : undefined
  if (space) {
    crumbs.push({ label: space.name.toUpperCase(), to: `/${space.id}` })
    const subId = segs.slice(1).join('/')
    for (const section of space.sections) {
      const item = section.items.find((i) => i.id === subId)
      if (item) { crumbs.push({ label: item.label.toUpperCase() }); break }
    }
  }
  return crumbs
}

function sameCrumbs(a: Crumb[], b: Crumb[]): boolean {
  return a.length === b.length && a.every((c, i) => c.label === b[i]?.label)
}

// Two-panel state drives the 3D rotation. Mirrors construct-app's useToolbar.
const breadcrumbs = ref<Crumb[]>(crumbsForPath(route.path))
const nextBreadcrumbs = ref<Crumb[]>([])
const rotating = ref(false)
let rotateTimer: ReturnType<typeof setTimeout> | null = null

// Must match the CSS transition duration on .toolbar-cube__wrapper--animated
// in ui-web/components/Toolbar3D.vue. If they drift, the class snap happens
// either before the animation ends (visible cut-off) or after (visible pause).
const ROTATE_MS = 420

watch(
  () => route.path,
  (path) => {
    const next = crumbsForPath(path)
    if (sameCrumbs(next, breadcrumbs.value) || rotating.value) return
    nextBreadcrumbs.value = next
    rotating.value = true
    if (rotateTimer) clearTimeout(rotateTimer)
    rotateTimer = setTimeout(() => {
      // Disable the transition first so the subsequent angle reset
      // doesn't animate back. Next RAF swaps panels instantly.
      rotating.value = false
      requestAnimationFrame(() => {
        breadcrumbs.value = next
        nextBreadcrumbs.value = []
      })
    }, ROTATE_MS)
  },
)

function onCrumbClick(c: { to?: string }) {
  if (c.to) router.push(c.to)
}

const pageActions = usePageActions()

function onActionClick(a: ToolbarAction) {
  if (a.disabled) return
  if (a.onClick) a.onClick()
  else if (a.to) router.push(a.to)
}
</script>

<template>
  <div v-if="showChrome" class="flex h-screen overflow-hidden bg-[var(--app-canvas-bg)] text-[var(--app-foreground)]">
    <!-- Icon rail -->
    <aside class="w-[60px] shrink-0 bg-[var(--app-background)] border-r border-[var(--app-border)] flex flex-col items-center py-4 gap-1">
      <RouterLink
        to="/"
        class="mb-4 size-9 rounded-lg grid place-items-center text-[var(--app-accent)]"
        :class="{ 'bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]': route.name === 'home' }"
        title="Construct Account"
      >
        <ConstructLogo :size="22" />
      </RouterLink>

      <RouterLink
        v-for="space in visibleSpaces"
        :key="space.id"
        :to="`/${space.id}`"
        class="size-9 rounded-lg grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
        :class="{ 'text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]': currentSpace?.id === space.id }"
        :title="space.name"
      >
        <Icon :icon="`lucide:${space.icon}`" class="size-5" />
      </RouterLink>

      <div class="flex-1" />

      <NotificationBell v-if="session.isAuthenticated" />
      <UserMenu />
    </aside>

    <!-- Sub-nav panel (only when inside a space with sections) -->
    <aside
      v-if="currentSpace && currentSpace.sections.length"
      class="w-[260px] shrink-0 bg-[var(--app-background)] border-r border-[var(--app-border)] py-6 px-4 flex flex-col gap-6 overflow-y-auto"
    >
      <div>
        <div class="mono text-xs text-[var(--app-muted)] tracking-wider">CONSTRUCT:ACCOUNT</div>
        <div class="mono text-sm font-semibold mt-1">{{ currentSpace.name.toUpperCase() }}</div>
      </div>

      <!-- Acting-as identity card. Shown only for the developer space, where
           the active publisher (personal vs org) changes which set of spaces
           the page lists. Lives in the sidebar instead of as a top-of-page
           banner so it's persistently visible without taking content room. -->
      <div
        v-if="currentSpace.id === 'developer' && session.scope"
        class="rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2.5 flex items-center gap-2.5"
      >
        <div
          class="size-7 rounded-md grid place-items-center shrink-0"
          :class="session.scope.scope === 'org'
            ? 'bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]'
            : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          <Icon
            :icon="session.scope.scope === 'org' ? 'lucide:building-2' : 'lucide:user-round'"
            class="size-3.5"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-[var(--app-muted)] leading-tight">
            Acting as
          </div>
          <div class="text-xs font-medium truncate leading-tight mt-0.5">
            {{ session.scope.scope === 'org'
              ? (session.scope.org?.name || 'Organization')
              : (session.scope.user?.name || session.scope.user?.email || 'You') }}
          </div>
        </div>
        <span
          class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0"
          :class="session.scope.scope === 'org'
            ? 'text-[var(--app-accent)] border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
            : 'text-[var(--app-muted)] border-[var(--app-border)]'"
        >{{ session.scope.scope === 'org' ? 'Org' : 'You' }}</span>
      </div>

      <div v-for="section in currentSpace.sections" :key="section.label" class="flex flex-col gap-1">
        <div class="mono text-[11px] text-[var(--app-muted)] px-2 mb-1 tracking-wider">{{ section.label }}</div>
        <RouterLink
          v-for="item in section.items"
          :key="item.id"
          :to="subPath(currentSpace, item.id)"
          class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)] transition-colors"
          :class="{
            '!text-[var(--app-accent)] !bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]': currentSubId === item.id,
          }"
        >
          <Icon :icon="`lucide:${item.icon}`" class="size-4 opacity-80" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </aside>

    <!-- Main area: Toolbar3D + content -->
    <main class="flex-1 min-w-0 flex flex-col">
      <Toolbar3D
        :breadcrumbs="breadcrumbs"
        :next-breadcrumbs="nextBreadcrumbs"
        :actions="pageActions"
        :rotating="rotating"
        :space-icon="currentSpace ? `lucide:${currentSpace.icon}` : 'lucide:hexagon'"
        @breadcrumb-click="onCrumbClick"
        @action-click="onActionClick"
      >
        <!-- Pages can teleport widgets into the right side of the toolbar
             (e.g. the developer Schemas page's schema picker). Lives in the
             "right" slot of Toolbar3D so it sits past the action buttons. -->
        <template #right>
          <div id="page-toolbar-right" class="flex items-center gap-2"></div>
        </template>
      </Toolbar3D>

      <div class="flex-1 overflow-y-auto px-8 py-6">
        <slot />
      </div>
    </main>
  </div>

  <div v-else class="min-h-screen bg-[var(--app-canvas-bg)] text-[var(--app-foreground)]">
    <slot />
  </div>
</template>
