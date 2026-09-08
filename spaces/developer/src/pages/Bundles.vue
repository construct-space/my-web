<script setup lang="ts">
/**
 * Bundles page — publisher grouping (kanban + kanban-admin as one unit).
 *
 * Scope for v1:
 *  - List bundles owned by the caller's org.
 *  - Inline-create a bundle (id + name) so publishers can self-serve without
 *    touching the CLI.
 *  - For each bundle, show which owned spaces belong to it. We fetch once
 *    (listOwnedSpaces) and group client-side — the set is small enough that
 *    one list + one group is cheaper than a per-bundle GET.
 *
 * Not included yet: distribution editor + allowlist (lives on the space
 * detail page), installs panel (lives on space detail too). This page is the
 * starting point; everything drills down from here.
 */

import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { listBundles, createBundle, listOwnedSpaces, type Bundle, type SpaceSummary } from '../graphApi'

const bundles = ref<Bundle[]>([])
const spaces  = ref<SpaceSummary[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)

const newId   = ref('')
const newName = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [b, s] = await Promise.all([listBundles(), listOwnedSpaces()])
    bundles.value = b.bundles || []
    spaces.value  = s.spaces  || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// Group spaces by bundle_id so each bundle card can list its members without
// another round trip. Spaces with no bundle sit under the synthetic "—" key
// and are shown in a separate "Standalone" section below the bundles list.
const spacesByBundle = computed(() => {
  const map = new Map<string, SpaceSummary[]>()
  for (const s of spaces.value) {
    const key = s.bundle_id || ''
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  return map
})

const standalone = computed(() => spacesByBundle.value.get('') || [])

async function submitCreate() {
  createError.value = null
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id || !name) {
    createError.value = 'Both id and name are required.'
    return
  }
  creating.value = true
  try {
    await createBundle(id, name)
    newId.value = ''
    newName.value = ''
    await load()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Bundles</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Group related spaces you publish — e.g. a Kanban app + its admin tool
          — so they share ownership, can import each other's models, and can
          expose publisher-only queries.
        </p>
      </div>
    </div>

    <!-- Create form — inline rather than a modal so users can scan the list
         and create in the same view. Keep it small; no validation UI beyond
         the error line because ids are short and the backend already gives
         clean error messages. -->
    <form
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-3"
      @submit.prevent="submitCreate"
    >
      <div class="flex flex-col sm:flex-row gap-3">
        <Input
          v-model="newId"
          placeholder="bundle-id (e.g. kanban-suite)"
          class="font-mono"
        />
        <Input v-model="newName" placeholder="Display name (e.g. Kanban Suite)" class="flex-1" />
        <Button type="submit" :loading="creating" icon="lucide:plus">Create bundle</Button>
      </div>
      <div v-if="createError" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ createError }}</span>
      </div>
    </form>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !bundles.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div v-else-if="bundles.length" class="flex flex-col gap-4">
      <article
        v-for="b in bundles"
        :key="b.id"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)]"
      >
        <RouterLink
          :to="`/developer/bundles/${b.id}`"
          class="px-5 py-4 border-b border-[var(--app-border)] flex items-center gap-4 hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
        >
          <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:package-2" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">{{ b.name }}</div>
            <div class="text-xs text-[var(--app-muted)] mt-0.5 font-mono truncate">{{ b.id }}</div>
          </div>
          <Icon icon="lucide:chevron-right" class="size-4 text-[var(--app-muted)]" />
        </RouterLink>
        <div
          v-if="spacesByBundle.get(b.id)?.length"
          class="divide-y divide-[var(--app-border)]"
        >
          <RouterLink
            v-for="s in spacesByBundle.get(b.id)!"
            :key="s.id"
            :to="`/developer/spaces/${s.id}`"
            class="flex items-center gap-4 px-5 py-3 text-sm hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
          >
            <Icon icon="lucide:package" class="size-4 text-[var(--app-muted)]" />
            <code class="font-mono flex-1 min-w-0 truncate">{{ s.id }}</code>
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
        <div v-else class="px-5 py-4 text-xs text-[var(--app-muted)]">
          No spaces attached yet. Add <code class="font-mono">"bundle_id": "{{ b.id }}"</code>
          to a space's <code class="font-mono">space.manifest.json</code> under the
          <code class="font-mono">graph</code> field, then publish.
        </div>
      </article>
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
    >
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:package-2" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No bundles yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Create one above to group related spaces (e.g. an app + its admin UI)
        under one ownership umbrella.
      </p>
    </div>

    <section v-if="standalone.length" class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">Standalone spaces</h2>
      <p class="text-xs text-[var(--app-muted)]">
        Spaces you publish that aren't attached to any bundle. Attach them by
        setting <code class="font-mono">graph.bundle_id</code> in their manifest.
      </p>
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
        <RouterLink
          v-for="s in standalone"
          :key="s.id"
          :to="`/developer/spaces/${s.id}`"
          class="flex items-center gap-4 px-5 py-3 text-sm hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)] transition-colors"
        >
          <Icon icon="lucide:package" class="size-4 text-[var(--app-muted)]" />
          <code class="font-mono flex-1 min-w-0 truncate">{{ s.id }}</code>
          <span class="text-xs text-[var(--app-muted)] shrink-0 tabular-nums">
            {{ s.install_count }} {{ s.install_count === 1 ? 'install' : 'installs' }}
          </span>
          <Icon icon="lucide:chevron-right" class="size-4 text-[var(--app-muted)]" />
        </RouterLink>
      </div>
    </section>
  </section>
</template>
