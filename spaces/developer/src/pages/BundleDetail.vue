<script setup lang="ts">
/**
 * Bundle detail — metadata + member spaces for one publisher bundle.
 *
 * The Bundles list already groups spaces by bundle, but that view only lists
 * what's attached right now. This page adds:
 *   - Bundle metadata (name + owner)
 *   - Member spaces table (reuses the same distribution/install count shape
 *     as the Spaces page so the row is familiar), with deep-links to each
 *     space's detail page where distribution/allowlist/installs live.
 *   - Total installs across the bundle — a quick "reach" signal.
 *
 * Cross-space imports are not surfaced yet; the graph service has the data
 * in _system.space_imports but no endpoint to enumerate it. When that lands,
 * add a third section here rather than a new page — bundles are the scope.
 */

import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { getBundle, listOwnedSpaces, type Bundle, type SpaceSummary } from '../graphApi'
import { useOrgNames } from '../useOrgNames'

const props = defineProps<{ bundleId: string }>()

const bundle  = ref<Bundle | null>(null)
const spaces  = ref<SpaceSummary[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)

const orgNames = useOrgNames()

async function load() {
  loading.value = true
  error.value = null
  try {
    const [b, s] = await Promise.all([
      getBundle(props.bundleId),
      listOwnedSpaces(),
    ])
    bundle.value = b
    // Filter spaces client-side — listOwnedSpaces is already scoped to the
    // caller's org, so any match is fair game. Keeps this page alive even
    // when the server gains cross-org visibility later.
    spaces.value = (s.spaces || []).filter((sp) => sp.bundle_id === props.bundleId)
    if (b.owner_org_id) void orgNames.resolve([b.owner_org_id])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(() => props.bundleId, load)
onMounted(load)

const totalInstalls = computed(() =>
  spaces.value.reduce((sum, s) => sum + (s.install_count || 0), 0),
)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div>
      <RouterLink
        to="/developer/bundles"
        class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] flex items-center gap-1"
      >
        <Icon icon="lucide:chevron-left" class="size-3.5" />
        All bundles
      </RouterLink>
      <h1 class="text-xl font-semibold mt-2 flex items-center gap-2">
        <Icon icon="lucide:package-2" class="size-5 text-[var(--app-muted)]" />
        {{ bundle?.name || props.bundleId }}
      </h1>
      <p v-if="bundle" class="text-xs text-[var(--app-muted)] mt-1 font-mono">
        {{ bundle.id }}
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !bundle" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="bundle">
      <!-- Summary card -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
        <div>
          <div class="text-xs text-[var(--app-muted)]">Owner</div>
          <div class="text-sm font-medium mt-1 truncate">
            {{ orgNames.label(bundle.owner_org_id) }}
          </div>
          <code
            v-if="orgNames.get(bundle.owner_org_id)"
            class="text-xs font-mono text-[var(--app-muted)] block truncate mt-0.5"
          >{{ bundle.owner_org_id }}</code>
        </div>
        <div>
          <div class="text-xs text-[var(--app-muted)]">Spaces</div>
          <div class="text-sm font-medium mt-1 tabular-nums">{{ spaces.length }}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--app-muted)]">Total installs</div>
          <div class="text-sm font-medium mt-1 tabular-nums">{{ totalInstalls }}</div>
        </div>
      </article>

      <!-- Member spaces -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <header class="px-5 py-4 border-b border-[var(--app-border)]">
          <h2 class="text-sm font-semibold">Spaces in this bundle</h2>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Click a space to manage its distribution, allowlist, and installs.
          </p>
        </header>
        <div v-if="spaces.length" class="divide-y divide-[var(--app-border)]">
          <RouterLink
            v-for="s in spaces"
            :key="s.id"
            :to="`/developer/spaces/${s.id}`"
            class="flex items-center gap-4 px-5 py-3 text-sm hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
          >
            <Icon icon="lucide:package" class="size-4 text-[var(--app-muted)]" />
            <div class="flex-1 min-w-0">
              <div class="truncate">{{ s.name }}</div>
              <code class="text-xs font-mono text-[var(--app-muted)] block truncate">
                {{ s.id }}<span v-if="s.latest_version"> · v{{ s.latest_version }}</span>
              </code>
            </div>
            <span
              class="text-xs font-medium px-2 py-0.5 rounded shrink-0"
              :class="{
                'bg-green-500/15 text-green-500': s.distribution === 'public',
                'bg-amber-500/15 text-amber-500': s.distribution === 'org_allowlist',
                'bg-purple-500/15 text-purple-500': s.distribution === 'private',
              }"
            >{{ s.distribution }}</span>
            <span class="text-xs text-[var(--app-muted)] shrink-0 tabular-nums">
              {{ s.install_count }} {{ s.install_count === 1 ? 'install' : 'installs' }}
            </span>
            <Icon icon="lucide:chevron-right" class="size-4 text-[var(--app-muted)]" />
          </RouterLink>
        </div>
        <div v-else class="p-10 text-center">
          <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:package" class="size-6" />
          </div>
          <div class="text-sm font-medium mt-3">No spaces attached yet</div>
          <p class="text-xs text-[var(--app-muted)] mt-1 max-w-md mx-auto">
            Add
            <code class="font-mono">"graph": { "bundle_id": "{{ bundle.id }}" }</code>
            to a space's <code class="font-mono">space.manifest.json</code>,
            then run <code class="font-mono">construct space publish</code>.
          </p>
        </div>
      </article>
    </template>
  </section>
</template>
