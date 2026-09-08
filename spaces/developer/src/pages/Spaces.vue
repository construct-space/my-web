<script setup lang="ts">
/**
 * My spaces — what the graph service says this org publishes.
 *
 * Replaces the previous developer-service-backed list (/api/developer/spaces/
 * mine), which showed marketplace-submission status (draft / in review / etc)
 * but didn't know about graph attachment, distribution, or installs. With
 * bundles + install gates now living on graph, the single source of truth
 * for "what have I published as an org" is /api/spaces on graph, which also
 * gives us bundle, distribution, and install_count for the same cost.
 *
 * Marketplace review status is a separate concept — when/if we need it, add
 * a "Submissions" page fed by the developer service rather than conflating
 * the two here.
 */

import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listOwnedSpaces, type SpaceSummary } from '../graphApi'

const spaces   = ref<SpaceSummary[]>([])
const loading  = ref(false)
const error    = ref<string | null>(null)

// Filter chips reshaped around distribution — the dimension a publisher
// actually cares about when scanning a list of their spaces. If we grow a
// marketplace status later, it becomes a second row of chips or moves off to
// a separate page.
type DistFilter = 'all' | 'public' | 'org_allowlist' | 'private'
const filter = ref<DistFilter>('all')
const search = ref('')

const filters: { id: DistFilter; label: string }[] = [
  { id: 'all',           label: 'All' },
  { id: 'public',        label: 'Public' },
  { id: 'org_allowlist', label: 'Allowlist' },
  { id: 'private',       label: 'Private' },
]

const distClass: Record<string, string> = {
  public:        'bg-green-500/15 text-green-500',
  org_allowlist: 'bg-amber-500/15 text-amber-500',
  private:       'bg-purple-500/15 text-purple-500',
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await listOwnedSpaces()
    spaces.value = data.spaces || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return spaces.value.filter((s) => {
    if (filter.value !== 'all' && s.distribution !== filter.value) return false
    if (!q) return true
    return (
      s.id.toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.bundle_id || '').toLowerCase().includes(q)
    )
  })
})

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">My spaces</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Spaces your org has published — click through for distribution,
          allowlist, and install management.
        </p>
      </div>
      <RouterLink to="/developer/publish">
        <Button icon="lucide:upload-cloud">Publish new</Button>
      </RouterLink>
    </div>

    <!-- Search + distribution filters. The four chips compress to the four
         values a publisher actually differentiates by. Room for a marketplace
         status dimension later as a second row. -->
    <div class="flex flex-col sm:flex-row gap-3">
      <Input v-model="search" icon="lucide:search" placeholder="Search by id, name, bundle…" class="max-w-md" />
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="f in filters"
          :key="f.id"
          class="px-3 py-1 rounded-md text-xs font-medium transition-colors border"
          :class="filter === f.id
            ? 'bg-[var(--app-accent)] text-[var(--app-accent-foreground,white)] border-[var(--app-accent)]'
            : 'bg-transparent text-[var(--app-muted)] border-[var(--app-border)] hover:border-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
          @click="filter = f.id"
        >{{ f.label }}</button>
      </div>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !spaces.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="visible.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
      <RouterLink
        v-for="s in visible"
        :key="s.id"
        :to="`/developer/spaces/${s.id}`"
        class="flex items-center gap-4 px-5 py-4 hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
      >
        <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:package" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ s.name || s.id }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate mt-0.5">
            <code class="font-mono">{{ s.id }}</code>
            <span v-if="s.latest_version"> · v{{ s.latest_version }}</span>
            <span v-if="s.bundle_id">
              · <RouterLink :to="`/developer/bundles/${s.bundle_id}`" class="hover:underline" @click.stop>
                bundle {{ s.bundle_id }}
              </RouterLink>
            </span>
          </div>
        </div>
        <span
          class="text-xs font-medium px-2 py-1 rounded shrink-0"
          :class="distClass[s.distribution] || 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ s.distribution.replace('_', ' ') }}
        </span>
        <span class="text-xs text-[var(--app-muted)] shrink-0 tabular-nums w-20 text-right">
          {{ s.install_count }} {{ s.install_count === 1 ? 'install' : 'installs' }}
        </span>
        <Icon icon="lucide:chevron-right" class="size-4 text-[var(--app-muted)]" />
      </RouterLink>
    </div>

    <div v-else-if="!loading && !spaces.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:package" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No spaces yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Publish your first one with <code class="font-mono">construct space publish</code>
        and <code class="font-mono">construct graph push</code>.
      </p>
    </div>

    <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">
      No spaces match your search.
    </div>
  </section>
</template>
