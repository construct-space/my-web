<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getOrg, listMembers, listProjects, type Org, type Member } from '../api'

const org      = ref<Org | null>(null)
const members  = ref<Member[]>([])
const projectCount = ref(0)

const loading = ref(true)
const error   = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    // Parallel + allSettled so one failing endpoint (e.g. projects not
    // yet provisioned) doesn't kill the whole overview.
    const [o, m, p] = await Promise.allSettled([
      getOrg(),
      listMembers(),
      listProjects(),
    ])
    if (o.status === 'fulfilled') org.value = o.value.org
    if (m.status === 'fulfilled') members.value = m.value
    if (p.status === 'fulfilled') projectCount.value = p.value.length
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function fmtNum(n?: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

const activeMembers = computed(() => members.value.filter((m) => m.status === 'active').length)
const recentMembers = computed(() =>
  [...members.value]
    .sort((a, b) => (b.joined_at || '').localeCompare(a.joined_at || ''))
    .slice(0, 5)
)

function initials(name: string | undefined, email: string): string {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+|@/).filter(Boolean)
  return parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?'
}

const roleColor: Record<string, string> = {
  owner:     'bg-amber-500/15 text-amber-500',
  admin:     'bg-sky-500/15 text-sky-500',
  developer: 'bg-violet-500/15 text-violet-500',
  member:    'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Organization</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Who's on the team and what they're working on.
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Not-in-org empty state. scope:org gates the whole space, so
         reaching this page without an org means the session snapshot
         is stale; a refresh usually resolves it. -->
    <div v-if="!loading && !org" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:building-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No organization context</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Switch into an org from the account picker to see members, projects, and billing.
      </p>
    </div>

    <template v-else-if="org">
      <!-- Org header card -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 flex items-center gap-4">
        <div class="size-14 rounded-xl grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)] text-xl font-semibold">
          <Icon v-if="org.icon" :icon="`lucide:${org.icon}`" class="size-7" />
          <span v-else>{{ (org.name?.[0] || '?').toUpperCase() }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-base font-medium truncate">{{ org.name }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5 flex items-center gap-2">
            <code class="font-mono">@{{ org.slug }}</code>
            <span>· Created {{ fmtDate(org.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Stat cards. Four wide on ≥md, two on mobile. Same rhythm as
           the developer space for visual consistency across spaces. -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3" aria-live="polite">
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Members</div>
          <div class="mt-2 text-lg font-semibold">{{ fmtNum(members.length) }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">{{ fmtNum(activeMembers) }} active</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Projects</div>
          <div class="mt-2 text-lg font-semibold">{{ fmtNum(projectCount) }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">Across the org</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Plan</div>
          <div class="mt-2 text-lg font-semibold">Free</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">Billing coming soon</div>
        </div>
        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
          <div class="text-xs text-[var(--app-muted)] uppercase tracking-wider">Developer</div>
          <div class="mt-2 text-lg font-semibold capitalize">{{ org.developer_status || 'none' }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">Publisher status</div>
        </div>
      </div>

      <!-- Recent members -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">Recent members</h2>
          <RouterLink to="/org/members" class="text-sm text-[var(--app-accent)] hover:underline">All members</RouterLink>
        </div>

        <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>

        <div v-else-if="recentMembers.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
          <div
            v-for="m in recentMembers"
            :key="m.id"
            class="flex items-center gap-4 px-5 py-3.5"
          >
            <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-sm font-semibold overflow-hidden">
              <img v-if="m.avatar" :src="m.avatar" :alt="m.name" class="size-full object-cover" />
              <span v-else>{{ initials(m.name, m.email) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ m.name || m.email }}</div>
              <div class="text-xs text-[var(--app-muted)] truncate">{{ m.email }}</div>
            </div>
            <span
              class="text-xs font-medium px-2 py-1 rounded capitalize shrink-0"
              :class="roleColor[m.role] || roleColor.member"
            >{{ m.role }}</span>
            <span class="text-xs text-[var(--app-muted)] shrink-0 hidden sm:inline">{{ fmtDate(m.joined_at) }}</span>
          </div>
        </div>

        <div v-else class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
          <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:users" class="size-6" />
          </div>
          <div class="text-sm font-medium mt-3">No members yet</div>
          <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
            Invite your first teammate from the Members tab.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>
