<script setup lang="ts">
/**
 * Space detail — publisher-side management for one space.
 *
 * Three panels, stacked:
 *   1. Summary      — id, version, bundle, raw distribution/install counts.
 *   2. Distribution — radio (public / org_allowlist / private), save inline.
 *                     When org_allowlist is active, an allowlist editor is
 *                     revealed: add / remove by org id (UUID). We keep this
 *                     dumb — no accounts lookup by name; paste the id.
 *   3. Installs     — read-only list of orgs that installed this space.
 *                     Refresh button + count. No uninstall button here (that
 *                     belongs on the tenant's side, not the publisher's).
 *
 * All three endpoints live on graph via /api/graph/*. The page is load-then-
 * mutate: `load()` pulls the space summary, `installs`, and the saved
 * distribution; individual panels call the mutation endpoints and re-load
 * just the parts that changed to stay fresh.
 */

import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listOwnedSpaces,
  setDistribution,
  listInstalls,
  addToAllowlist,
  removeFromAllowlist,
  type SpaceSummary,
  type Distribution,
} from '../graphApi'
import { listSpacePublishes, type SpacePublishItem } from '../api'
import { useOrgNames } from '../useOrgNames'

const orgNames = useOrgNames()

const props = defineProps<{ spaceId: string }>()

const space     = ref<SpaceSummary | null>(null)
const installs  = ref<string[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)

// Distribution panel state
const selectedDist = ref<Distribution>('public')
const savingDist   = ref(false)
const distError    = ref<string | null>(null)

// Allowlist panel state
const allowlistInput = ref('')
const allowlist      = ref<string[]>([]) // local echo — see note in loadAllowlist
const allowlistBusy  = ref(false)
const allowlistError = ref<string | null>(null)

async function loadSpace() {
  // There is no single-space GET endpoint yet — list owned spaces and pick
  // this one. The list is already paginated by the server; until it grows
  // past ~1k rows this is cheaper than a new endpoint.
  const { spaces } = await listOwnedSpaces()
  const found = spaces.find((s) => s.id === props.spaceId)
  if (!found) {
    throw new Error(`Space "${props.spaceId}" not found in your org.`)
  }
  space.value = found
  selectedDist.value = (found.distribution as Distribution) || 'public'
}

async function loadInstalls() {
  const r = await listInstalls(props.spaceId)
  installs.value = r.orgs || []
  // Fire-and-forget batch name resolution. The template reads labels
  // through useOrgNames().label() which returns the raw id until names
  // arrive, then swaps reactively.
  if (installs.value.length) void orgNames.resolve(installs.value)
}

// ─── Publish history ──────────────────────────────────────────────────────
// Sourced from the developer service's append-only space_publishes audit
// table. Owner-gated server-side. Surfaces "who in the org published v1.2.3"
// — the trace question that motivated this panel.
const publishes = ref<SpacePublishItem[]>([])
const publishesLoading = ref(false)
const publishesError = ref<string | null>(null)

async function loadPublishes() {
  publishesLoading.value = true
  publishesError.value = null
  try {
    const data = await listSpacePublishes(props.spaceId)
    publishes.value = data.publishes || []
  } catch (e) {
    // Silent on 403 — caller may not have access if they're not in the
    // owning org. Surface other errors so a misconfigured gateway is
    // visible rather than silently empty.
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('403') && !msg.includes('access')) {
      publishesError.value = msg
    }
    publishes.value = []
  } finally {
    publishesLoading.value = false
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// The graph service doesn't have a list-allowlist endpoint yet — the table
// is write-through. We keep a local echo of the orgs the user has added in
// this session so the UI can show confirmation without a GET. If the page
// reloads, the echo clears but the server row persists (install attempts
// from those orgs will still succeed). Wiring a real GET is a later pass.
function resetAllowlistEcho() {
  allowlist.value = []
}

async function load() {
  loading.value = true
  error.value = null
  try {
    await Promise.all([loadSpace(), loadInstalls(), loadPublishes()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(() => props.spaceId, () => {
  resetAllowlistEcho()
  load()
})

onMounted(load)

// ─── Distribution panel ────────────────────────────────────────────────────

const distOptions: { id: Distribution; label: string; description: string }[] = [
  {
    id: 'public',
    label: 'Public',
    description: 'Any org can install from the marketplace.',
  },
  {
    id: 'org_allowlist',
    label: 'Allowlist',
    description: 'Only orgs you add below can install.',
  },
  {
    id: 'private',
    label: 'Private',
    description: 'Only your org can install. Useful for admin-side spaces.',
  },
]

const distDirty = computed(() =>
  space.value ? selectedDist.value !== space.value.distribution : false,
)

async function saveDistribution() {
  if (!space.value || !distDirty.value) return
  savingDist.value = true
  distError.value = null
  try {
    await setDistribution(space.value.id, selectedDist.value)
    await loadSpace()
  } catch (e) {
    distError.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingDist.value = false
  }
}

// ─── Allowlist panel ───────────────────────────────────────────────────────

async function addAllowlist() {
  const orgId = allowlistInput.value.trim()
  if (!orgId) return
  allowlistBusy.value = true
  allowlistError.value = null
  try {
    await addToAllowlist(props.spaceId, orgId)
    if (!allowlist.value.includes(orgId)) allowlist.value.push(orgId)
    allowlistInput.value = ''
    void orgNames.resolve([orgId])
  } catch (e) {
    allowlistError.value = e instanceof Error ? e.message : String(e)
  } finally {
    allowlistBusy.value = false
  }
}

async function removeAllowlist(orgId: string) {
  allowlistBusy.value = true
  allowlistError.value = null
  try {
    await removeFromAllowlist(props.spaceId, orgId)
    allowlist.value = allowlist.value.filter((o) => o !== orgId)
  } catch (e) {
    allowlistError.value = e instanceof Error ? e.message : String(e)
  } finally {
    allowlistBusy.value = false
  }
}
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <!-- Breadcrumb + title -->
    <div>
      <RouterLink
        to="/developer/spaces"
        class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] flex items-center gap-1"
      >
        <Icon icon="lucide:chevron-left" class="size-3.5" />
        All spaces
      </RouterLink>
      <h1 class="text-xl font-semibold mt-2">
        {{ space?.name || props.spaceId }}
      </h1>
      <p v-if="space" class="text-xs text-[var(--app-muted)] mt-1 font-mono">
        {{ space.id }}<span v-if="space.latest_version"> · v{{ space.latest_version }}</span>
      </p>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !space" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="space">
      <!-- Summary card -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div>
          <div class="text-xs text-[var(--app-muted)]">Bundle</div>
          <div class="text-sm font-medium mt-1">
            <RouterLink
              v-if="space.bundle_id"
              to="/developer/bundles"
              class="font-mono text-[var(--app-accent)] hover:underline"
            >{{ space.bundle_id }}</RouterLink>
            <span v-else class="text-[var(--app-muted)]">—</span>
          </div>
        </div>
        <div>
          <div class="text-xs text-[var(--app-muted)]">Distribution</div>
          <div class="text-sm font-medium mt-1 capitalize">
            {{ space.distribution.replace('_', ' ') }}
          </div>
        </div>
        <div>
          <div class="text-xs text-[var(--app-muted)]">Installs</div>
          <div class="text-sm font-medium mt-1 tabular-nums">{{ space.install_count }}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--app-muted)]">Version</div>
          <div class="text-sm font-medium mt-1 font-mono">{{ space.latest_version || '0.0.0' }}</div>
        </div>
      </article>

      <!-- Distribution panel -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <header>
          <h2 class="text-sm font-semibold">Distribution</h2>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Who may install this space. Tenants that have already installed
            keep their data when you tighten access — they can no longer query
            only if they fail the install gate on next request.
          </p>
        </header>

        <div class="flex flex-col gap-2">
          <label
            v-for="o in distOptions"
            :key="o.id"
            class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="selectedDist === o.id
              ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]'
              : 'border-[var(--app-border)] hover:border-[var(--app-muted)]'"
          >
            <input
              type="radio"
              class="mt-1 accent-[var(--app-accent)]"
              :value="o.id"
              v-model="selectedDist"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">{{ o.label }}</div>
              <div class="text-xs text-[var(--app-muted)] mt-0.5">{{ o.description }}</div>
            </div>
          </label>
        </div>

        <div v-if="distError" class="flex items-start gap-2 text-sm text-red-500">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ distError }}</span>
        </div>

        <div class="flex justify-end">
          <Button
            :disabled="!distDirty || savingDist"
            :loading="savingDist"
            icon="lucide:check"
            @click="saveDistribution"
          >Save</Button>
        </div>
      </article>

      <!-- Allowlist panel — only meaningful when distribution is org_allowlist.
           We render it whenever the selection OR the saved value is allowlist,
           so someone who switched modes sees the editor immediately. -->
      <article
        v-if="selectedDist === 'org_allowlist' || space.distribution === 'org_allowlist'"
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4"
      >
        <header>
          <h2 class="text-sm font-semibold">Allowlist</h2>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Orgs permitted to install this space. Your own org is always
            allowed — no need to list it. Paste an org UUID.
          </p>
        </header>

        <form class="flex gap-2" @submit.prevent="addAllowlist">
          <Input
            v-model="allowlistInput"
            placeholder="org-…"
            class="flex-1 font-mono"
          />
          <Button type="submit" :loading="allowlistBusy" icon="lucide:plus">Add</Button>
        </form>

        <div v-if="allowlistError" class="flex items-start gap-2 text-sm text-red-500">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ allowlistError }}</span>
        </div>

        <div v-if="allowlist.length" class="flex flex-col gap-1">
          <div
            v-for="org in allowlist"
            :key="org"
            class="flex items-center gap-3 px-3 py-2 rounded-md border border-[var(--app-border)]"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ orgNames.label(org) }}</div>
              <code v-if="orgNames.get(org)" class="text-xs font-mono text-[var(--app-muted)] truncate block">{{ org }}</code>
            </div>
            <button
              class="text-xs text-[var(--app-muted)] hover:text-red-500 transition-colors"
              :disabled="allowlistBusy"
              @click="removeAllowlist(org)"
            >Remove</button>
          </div>
        </div>
        <p v-else class="text-xs text-[var(--app-muted)]">
          No orgs added in this session. (A list endpoint is pending; previously-added orgs are still active on the server.)
        </p>
      </article>

      <!-- Publish history panel.
           Append-only audit of every publish for this space, in reverse
           chronological order. The reason this exists: when an org
           publishes, the Space row only carries the latest publisher;
           prior publishers are lost. This panel is the trace. -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <header class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-sm font-semibold">Publish history</h2>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Every successful publish for this space, with the user who shipped it.
            </p>
          </div>
          <button
            class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] flex items-center gap-1"
            :disabled="publishesLoading"
            @click="loadPublishes"
          >
            <Icon icon="lucide:refresh-cw" class="size-3.5" />
            Refresh
          </button>
        </header>

        <div v-if="publishesError" class="flex items-start gap-2 text-sm text-red-500">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ publishesError }}</span>
        </div>

        <div v-if="publishesLoading && !publishes.length" class="text-xs text-[var(--app-muted)]">Loading…</div>

        <div v-else-if="publishes.length" class="flex flex-col gap-1">
          <div
            v-for="p in publishes"
            :key="p.id"
            class="flex items-start gap-3 px-3 py-2 rounded-md border border-[var(--app-border)]"
          >
            <Icon icon="lucide:package" class="size-4 text-[var(--app-muted)] mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm flex items-center gap-2">
                <span class="font-mono font-medium">v{{ p.version }}</span>
                <span class="text-[var(--app-muted)]">·</span>
                <span class="text-[var(--app-muted)]">{{ fmtDate(p.publishedAt) }}</span>
              </div>
              <div class="text-xs text-[var(--app-muted)] mt-0.5 truncate">
                <template v-if="p.publisher">
                  by <span class="text-[var(--app-foreground)]">{{ p.publisher.name }}</span>
                  <span class="font-mono"> &lt;{{ p.publisher.email }}&gt;</span>
                </template>
                <template v-else>
                  by <span class="font-mono">{{ p.publisherUserId.slice(0, 8) }}…</span>
                </template>
                <span class="ml-1">· {{ fmtBytes(p.buildSize) }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-[var(--app-muted)] text-center py-4">
          No publish history recorded yet for this space.
        </p>
      </article>

      <!-- Installs panel -->
      <article class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <header class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-sm font-semibold">Installs</h2>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Orgs that have installed this space and can query it today.
            </p>
          </div>
          <button
            class="text-xs text-[var(--app-muted)] hover:text-[var(--app-foreground)] flex items-center gap-1"
            :disabled="loading"
            @click="loadInstalls"
          >
            <Icon icon="lucide:refresh-cw" class="size-3.5" />
            Refresh
          </button>
        </header>

        <div v-if="installs.length" class="flex flex-col gap-1">
          <div
            v-for="org in installs"
            :key="org"
            class="flex items-center gap-3 px-3 py-2 rounded-md border border-[var(--app-border)]"
          >
            <Icon icon="lucide:building" class="size-4 text-[var(--app-muted)] shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ orgNames.label(org) }}</div>
              <code v-if="orgNames.get(org)" class="text-xs font-mono text-[var(--app-muted)] truncate block">{{ org }}</code>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-[var(--app-muted)] text-center py-4">
          No tenants have installed this space yet.
        </p>
      </article>
    </template>
  </section>
</template>
