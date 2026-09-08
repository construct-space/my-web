<script setup lang="ts">
/**
 * Schemas — phpMyAdmin-style data browser. A space is the "schema",
 * its models are the "tables". Pick a schema from the top dropdown,
 * pick a table on the left, then flip between Structure (the field
 * definitions) and Data (paginated rows + CSV export) on the right.
 *
 * All calls go through my's /api/developer/schemas/* façade which
 * proxies to graph; ownership of the space is enforced server-side
 * against the gateway-asserted X-Auth-* identity.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { getSchema, getTableRows, listMySpaces, type Schema, type SchemaModel, type Space } from '../api'
import { useOrgNames } from '../useOrgNames'

const session = useSessionStore()
const orgNames = useOrgNames()

// Parse a physical schema name into a friendly tenant descriptor. The naming
// patterns are:
//   u_<user-uuid>_s_<space>     app scope, per user
//   c_<org-uuid>_s_<space>      org scope, per org
//   s_<space>_p_<project>       project scope (often "default")
// UUIDs were sanitized at registration (hyphens → underscores), so we
// restore the canonical 8-4-4-4-12 dash form for display + accounts lookup.
interface TenantInfo {
  kind: 'user' | 'org' | 'project'
  raw: string
  id: string        // UUID with dashes restored, or the project id
  schema: string
}

function unsanitizeUUID(raw: string): string {
  // 8-4-4-4-12 → restore dashes only when the input matches that 32-hex shape.
  const compact = raw.replace(/_/g, '')
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
  }
  return raw
}

function parseSchema(schema: string, spaceId: string): TenantInfo {
  const safeSpace = spaceId.toLowerCase().replace(/-/g, '_')
  const userPrefix = 'u_'
  const orgPrefix = 'c_'
  const tail = `_s_${safeSpace}`
  if (schema.startsWith(userPrefix) && schema.endsWith(tail)) {
    const raw = schema.slice(userPrefix.length, schema.length - tail.length)
    return { kind: 'user', raw, id: unsanitizeUUID(raw), schema }
  }
  if (schema.startsWith(orgPrefix) && schema.endsWith(tail)) {
    const raw = schema.slice(orgPrefix.length, schema.length - tail.length)
    return { kind: 'org', raw, id: unsanitizeUUID(raw), schema }
  }
  const projHead = `s_${safeSpace}_p_`
  if (schema.startsWith(projHead)) {
    return { kind: 'project', raw: schema.slice(projHead.length), id: schema.slice(projHead.length), schema }
  }
  return { kind: 'project', raw: schema, id: schema, schema }
}

function tenantLabel(info: TenantInfo): string {
  if (info.kind === 'user') {
    const me = session.scope?.user?.id
    if (me && me === info.id) return 'You'
    const shortened = info.id.length > 8 ? `${info.id.slice(0, 8)}…` : info.id
    return `User · ${shortened}`
  }
  if (info.kind === 'org') {
    const hit = orgNames.get(info.id)
    if (hit && hit.name) return hit.name
    const shortened = info.id.length > 8 ? `${info.id.slice(0, 8)}…` : info.id
    return `Org · ${shortened}`
  }
  return `Project · ${info.id}`
}

const spaces = ref<Space[]>([])
const selected = ref<Space | null>(null)
const schema = ref<Schema | null>(null)

const loadingSpaces = ref(false)
const loadingSchema = ref(false)
const error = ref<string | null>(null)

const tableSearch = ref('')
const selectedTable = ref<string | null>(null)
const activeTab = ref<'structure' | 'data'>('structure')

const visibleTables = computed<SchemaModel[]>(() => {
  const all = schema.value?.models || []
  const q = tableSearch.value.trim().toLowerCase()
  if (!q) return all
  return all.filter((m) => m.name.toLowerCase().includes(q))
})

const selectedModel = computed<SchemaModel | null>(() => {
  if (!selectedTable.value) return null
  return schema.value?.models.find((m) => m.name === selectedTable.value) || null
})

async function loadSpaces() {
  loadingSpaces.value = true
  error.value = null
  try {
    const data = await listMySpaces()
    spaces.value = data.spaces || []
    if (spaces.value.length && !selected.value) {
      await selectSpace(spaces.value[0])
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingSpaces.value = false
  }
}

async function selectSpace(space: Space) {
  selected.value = space
  schema.value = null
  selectedTable.value = null
  tableData.clear()
  loadingSchema.value = true
  error.value = null
  try {
    const fetched = await getSchema(space.id)
    schema.value = {
      ...fetched,
      models: (fetched.models || []).map((m) => ({
        ...m,
        fields: m.fields || [],
      })),
    }
    if (schema.value.models.length) {
      selectedTable.value = schema.value.models[0].name
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/404|not.?found/i.test(msg)) error.value = msg
    schema.value = { space_id: space.id, models: [], version: undefined }
  } finally {
    loadingSchema.value = false
  }
}

function onSpaceChange(e: Event) {
  const target = e.target as HTMLSelectElement
  const space = spaces.value.find((s) => s.id === target.value)
  if (space) selectSpace(space)
}

function pickTable(name: string) {
  selectedTable.value = name
  ensureState(name)
  if (activeTab.value === 'data') loadIfEmpty(name)
}

watch([activeTab, selectedTable], ([tab, name]) => {
  if (tab === 'data' && name) loadIfEmpty(name)
})

function loadIfEmpty(name: string) {
  const st = ensureState(name)
  if (st.columns.length === 0 && !st.busy) loadPage(name, 0)
}

// ─── Per-table data state ────────────────────────────────────────────────
interface TableState {
  rows: Record<string, unknown>[]
  columns: string[]
  total: number
  offset: number
  limit: number
  busy: boolean
  error: string
  exporting: boolean
  // All physical schemas discovered for this space + table on the
  // unfiltered load. Persists across tenant filtering so the dropdown
  // stays visible (the server collapses `schemas` to one entry when a
  // ?schema= filter is active, which would otherwise hide the picker as
  // soon as the user picks a tenant).
  schemas: string[]
  tenantFilter: string
}

const PAGE_SIZE = 50
const tableData = reactive(new Map<string, TableState>())

function ensureState(name: string): TableState {
  let st = tableData.get(name)
  if (!st) {
    st = {
      rows: [],
      columns: [],
      total: 0,
      offset: 0,
      limit: PAGE_SIZE,
      busy: false,
      error: '',
      exporting: false,
      schemas: [],
      tenantFilter: '',
    }
    tableData.set(name, st)
  }
  return st
}

async function loadPage(name: string, offset: number) {
  if (!selected.value) return
  const st = ensureState(name)
  st.busy = true
  st.error = ''
  try {
    const r = await getTableRows(selected.value.id, name, {
      limit: PAGE_SIZE,
      offset,
      schema: st.tenantFilter || undefined,
    })
    st.rows = r.rows
    st.columns = r.columns
    st.total = r.total
    st.offset = r.offset
    st.limit = r.limit
    if (r.schemas) {
      // Only refresh the discovered-schemas list on the unfiltered load.
      // When a tenantFilter is active the server returns just that one
      // schema in the response — overwriting `st.schemas` would collapse
      // the dropdown to a single option and hide it.
      if (!st.tenantFilter) {
        st.schemas = r.schemas
      }
      // Kick off org-name resolution for any org-scope schemas in the set so
      // the dropdown labels switch from raw UUIDs to display names without
      // a manual refresh.
      if (selected.value) {
        const orgIds: string[] = []
        for (const s of r.schemas) {
          const info = parseSchema(s, selected.value.id)
          if (info.kind === 'org') orgIds.push(info.id)
        }
        if (orgIds.length) orgNames.resolve(orgIds)
      }
    }
  } catch (err) {
    st.error = err instanceof Error ? err.message : 'Failed to load rows'
  } finally {
    st.busy = false
  }
}

function changeTenantFilter(name: string, value: string) {
  const st = ensureState(name)
  st.tenantFilter = value
  loadPage(name, 0)
}

function nextPage(name: string) {
  const st = tableData.get(name)
  if (!st || st.busy) return
  if (st.offset + st.rows.length >= st.total) return
  loadPage(name, st.offset + st.limit)
}

function prevPage(name: string) {
  const st = tableData.get(name)
  if (!st || st.busy) return
  loadPage(name, Math.max(0, st.offset - st.limit))
}

function pageLabel(st: TableState | undefined): string {
  if (!st || st.total === 0) return '0 rows'
  const end = Math.min(st.offset + st.rows.length, st.total)
  return `${st.offset + 1}–${end} of ${st.total}`
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

// ─── CSV export ──────────────────────────────────────────────────────────
const EXPORT_CAP = 10000

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s =
    typeof v === 'object'
      ? (() => {
          try {
            return JSON.stringify(v)
          } catch {
            return String(v)
          }
        })()
      : String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function exportTable(name: string) {
  if (!selected.value) return
  const st = ensureState(name)
  st.exporting = true
  st.error = ''
  try {
    let r = await getTableRows(selected.value.id, name, { limit: 200, offset: 0 })
    const columns = r.columns
    const all: Record<string, unknown>[] = [...r.rows]
    while (all.length < r.total && all.length < EXPORT_CAP) {
      r = await getTableRows(selected.value.id, name, {
        limit: 200,
        offset: all.length,
      })
      if (r.rows.length === 0) break
      all.push(...r.rows)
    }
    const lines = [columns.map(csvEscape).join(',')]
    for (const row of all) {
      lines.push(columns.map((c) => csvEscape(row[c])).join(','))
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.value.id}__${name}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    st.error = err instanceof Error ? err.message : 'Export failed'
  } finally {
    st.exporting = false
  }
}

onMounted(loadSpaces)
</script>

<template>
  <section class="flex flex-col gap-5">
    <!-- Schema picker — teleported into the toolbar's right slot in Shell so
         it sits next to the breadcrumbs (which the toolbar owns on the left)
         instead of stealing a row from the page content. -->
    <Teleport to="#page-toolbar-right" :disabled="!spaces.length">
      <div class="flex items-center gap-2">
        <label class="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">Schema</label>
        <div class="relative">
          <select
            class="appearance-none bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-md pl-2.5 pr-7 py-1 text-xs font-medium min-w-[180px] focus:outline-none focus:border-[var(--app-accent)]"
            :value="selected?.id || ''"
            :disabled="!spaces.length"
            @change="onSpaceChange"
          >
            <option v-if="!spaces.length" value="">No spaces</option>
            <option
              v-for="s in spaces"
              :key="s.id"
              :value="s.id"
            >
              {{ s.name || s.id }} ({{ s.id }})
            </option>
          </select>
          <Icon icon="lucide:chevron-down" class="size-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--app-muted)]" />
        </div>
      </div>
    </Teleport>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Loading initial -->
    <div v-if="loadingSpaces && !spaces.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <!-- No spaces at all -->
    <div v-else-if="!spaces.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:database" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">Nothing to inspect yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Once you publish a space and push a schema, its models will be browsable here.
      </p>
    </div>

    <!-- Two-pane browser -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 min-h-[480px]">
      <!-- Left: tables list -->
      <aside class="flex flex-col gap-3 min-w-0">
        <div class="flex items-center justify-between text-xs uppercase tracking-wider text-[var(--app-muted)]">
          <span>Tables</span>
          <span v-if="schema" class="tabular-nums">{{ schema.models.length }}</span>
        </div>

        <Input
          v-if="schema?.models?.length"
          v-model="tableSearch"
          icon="lucide:search"
          placeholder="Filter tables"
          size="sm"
        />

        <div v-if="loadingSchema" class="text-sm text-[var(--app-muted)] px-1">Loading schema…</div>

        <div
          v-else-if="schema?.models?.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)] overflow-hidden"
        >
          <button
            v-for="m in visibleTables"
            :key="m.name"
            class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
            :class="selectedTable === m.name
              ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
              : 'hover:bg-[color-mix(in_srgb,var(--app-muted)_6%,transparent)]'"
            @click="pickTable(m.name)"
          >
            <Icon
              icon="lucide:table-2"
              class="size-4 shrink-0"
              :class="selectedTable === m.name ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'"
            />
            <span class="font-mono text-sm truncate flex-1">{{ m.name }}</span>
            <span class="text-xs text-[var(--app-muted)] tabular-nums">{{ m.fields.length }}</span>
          </button>
          <div v-if="!visibleTables.length" class="px-3 py-6 text-xs text-[var(--app-muted)] text-center">
            No matches.
          </div>
        </div>

        <div v-else class="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-6 text-center">
          <p class="text-xs text-[var(--app-muted)]">
            No schema pushed yet for this space.
          </p>
        </div>
      </aside>

      <!-- Right: tabs + content -->
      <div class="flex flex-col gap-4 min-w-0">
        <template v-if="selectedModel">
          <!-- Tab strip -->
          <div class="flex items-center justify-between gap-3 border-b border-[var(--app-border)]">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                :class="activeTab === 'structure'
                  ? 'border-[var(--app-accent)] text-[var(--app-foreground)]'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
                @click="activeTab = 'structure'"
              >
                <Icon icon="lucide:list-tree" class="size-4 inline-block mr-1.5 -mt-0.5" />
                Structure
              </button>
              <button
                type="button"
                class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                :class="activeTab === 'data'
                  ? 'border-[var(--app-accent)] text-[var(--app-foreground)]'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
                @click="activeTab = 'data'"
              >
                <Icon icon="lucide:rows-3" class="size-4 inline-block mr-1.5 -mt-0.5" />
                Data
              </button>
            </div>
            <div class="text-xs text-[var(--app-muted)] flex items-center gap-2 pb-2">
              <code class="font-mono">{{ selectedModel.name }}</code>
              <span v-if="schema?.version">· v{{ schema.version }}</span>
            </div>
          </div>

          <!-- Structure tab -->
          <div v-if="activeTab === 'structure'" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wider text-[var(--app-muted)] bg-[var(--app-surface)]">
                  <th class="px-4 py-2 font-medium">Field</th>
                  <th class="px-4 py-2 font-medium">Type</th>
                  <th class="px-4 py-2 font-medium">Nullable</th>
                  <th class="px-4 py-2 font-medium">Indexed</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--app-border)]">
                <tr v-for="f in selectedModel.fields" :key="f.name">
                  <td class="px-4 py-2 font-mono text-[var(--app-foreground)]">{{ f.name }}</td>
                  <td class="px-4 py-2 font-mono text-[var(--app-muted)]">{{ f.type }}</td>
                  <td class="px-4 py-2 text-[var(--app-muted)]">
                    <Icon v-if="f.nullable" icon="lucide:check" class="size-4 text-[var(--app-accent)]" />
                    <span v-else>—</span>
                  </td>
                  <td class="px-4 py-2 text-[var(--app-muted)]">
                    <Icon v-if="f.indexed" icon="lucide:hash" class="size-4 text-[var(--app-accent)]" />
                    <span v-else>—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Data tab -->
          <div v-if="activeTab === 'data'" class="flex flex-col gap-3">
            <!-- Toolbar -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-[var(--app-muted)] tabular-nums">
                {{ tableData.get(selectedModel.name)?.busy ? 'Loading…' : pageLabel(tableData.get(selectedModel.name)) }}
              </span>

              <!-- Tenant / partition picker. Visible whenever the server
                   returned more than one schema for this space + table —
                   which happens when the space is multi-tenant (per-org or
                   per-user) and at least two installs have written rows.
                   Labels resolve org UUIDs to display names; user-scope
                   schemas matching the session show as "You". -->
              <div
                v-if="(tableData.get(selectedModel.name)?.schemas?.length || 0) > 1 && selected"
                class="flex items-center gap-1.5"
              >
                <label class="text-[10px] uppercase tracking-wider text-[var(--app-muted)]">Tenant</label>
                <div class="relative">
                  <select
                    class="appearance-none bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-md pl-2.5 pr-7 py-1 text-xs focus:outline-none focus:border-[var(--app-accent)]"
                    :value="tableData.get(selectedModel.name)?.tenantFilter || ''"
                    @change="changeTenantFilter(selectedModel.name, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">All ({{ tableData.get(selectedModel.name)!.schemas.length }})</option>
                    <option
                      v-for="s in tableData.get(selectedModel.name)!.schemas"
                      :key="s"
                      :value="s"
                    >
                      {{ tenantLabel(parseSchema(s, selected.id)) }}
                    </option>
                  </select>
                  <Icon icon="lucide:chevron-down" class="size-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--app-muted)]" />
                </div>
              </div>

              <div class="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40"
                  :disabled="!tableData.get(selectedModel.name) || tableData.get(selectedModel.name)!.busy || tableData.get(selectedModel.name)!.offset === 0"
                  @click="prevPage(selectedModel.name)"
                  title="Previous page"
                >
                  <Icon icon="lucide:chevron-left" class="size-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40"
                  :disabled="!tableData.get(selectedModel.name) || tableData.get(selectedModel.name)!.busy || (tableData.get(selectedModel.name)!.offset + tableData.get(selectedModel.name)!.rows.length) >= tableData.get(selectedModel.name)!.total"
                  @click="nextPage(selectedModel.name)"
                  title="Next page"
                >
                  <Icon icon="lucide:chevron-right" class="size-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs hover:bg-[var(--app-card-hover)] disabled:opacity-40 inline-flex items-center gap-1.5"
                  :disabled="!tableData.get(selectedModel.name) || tableData.get(selectedModel.name)!.busy || tableData.get(selectedModel.name)!.exporting || tableData.get(selectedModel.name)!.total === 0"
                  :title="tableData.get(selectedModel.name)?.total && tableData.get(selectedModel.name)!.total > 10000 ? 'Capped at 10000 rows' : 'Export CSV'"
                  @click="exportTable(selectedModel.name)"
                >
                  <Icon
                    :icon="tableData.get(selectedModel.name)?.exporting ? 'lucide:loader-2' : 'lucide:download'"
                    class="size-3.5"
                    :class="tableData.get(selectedModel.name)?.exporting ? 'animate-spin' : ''"
                  />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            <p v-if="tableData.get(selectedModel.name)?.error" class="text-xs text-red-500">
              {{ tableData.get(selectedModel.name)!.error }}
            </p>

            <div
              v-if="tableData.get(selectedModel.name) && tableData.get(selectedModel.name)!.columns.length"
              class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] overflow-x-auto"
            >
              <table class="w-full text-xs">
                <thead class="bg-[var(--app-surface)]">
                  <tr>
                    <th
                      v-for="col in tableData.get(selectedModel.name)!.columns"
                      :key="col"
                      class="text-left font-mono font-medium px-3 py-2 text-[var(--app-muted)] whitespace-nowrap border-b border-[var(--app-border)]"
                    >{{ col }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--app-border)]">
                  <tr
                    v-for="(row, i) in tableData.get(selectedModel.name)!.rows"
                    :key="i"
                    class="hover:bg-[var(--app-card-hover)]"
                  >
                    <td
                      v-for="col in tableData.get(selectedModel.name)!.columns"
                      :key="col"
                      class="px-3 py-1.5 font-mono text-[var(--app-foreground)] max-w-xs truncate"
                      :title="cellText(row[col])"
                    >{{ cellText(row[col]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-else-if="tableData.get(selectedModel.name) && !tableData.get(selectedModel.name)!.busy"
              class="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-10 text-center"
            >
              <Icon icon="lucide:rows-3" class="size-6 mx-auto text-[var(--app-muted)]" />
              <p class="text-xs text-[var(--app-muted)] mt-2">
                {{ tableData.get(selectedModel.name)!.error ? 'Could not load rows.' : 'Empty table.' }}
              </p>
            </div>
          </div>
        </template>

        <!-- No table selected (schema present but nothing chosen yet — rare,
             since we auto-pick the first one. Empty schema state below.) -->
        <div
          v-else-if="!loadingSchema && schema && !schema.models.length"
          class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
        >
          <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:database" class="size-6" />
          </div>
          <div class="text-sm font-medium mt-3">No schema registered</div>
          <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
            Push one from the CLI: <code class="font-mono">construct graph push</code>. The schema + data become queryable from the runtime SDK the moment it lands.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
