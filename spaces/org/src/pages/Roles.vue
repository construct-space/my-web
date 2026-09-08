<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  listMembers,
  type Role,
  type Member,
} from '../api'

interface Permission {
  key: string
  label?: string
  group?: string
  description?: string
}

const roles       = ref<Role[]>([])
const members     = ref<Member[]>([])
const permissions = ref<Permission[]>([])
const loading     = ref(false)
const error       = ref<string | null>(null)

// Form state. One form at a time — either creating (editingId='new') or
// editing an existing role (editingId=<role.id>). Null means collapsed.
const editingId = ref<string | null>(null)
const form = ref({ name: '', description: '', permissions: [] as string[] })
const formError = ref<string | null>(null)
const saving    = ref(false)

// Which built-in row is expanded for a read-only permission peek.
const expandedBuiltinId = ref<string | null>(null)

// Per-row busy flag so delete spinner is scoped.
const busyRow = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [rList, mList, pList] = await Promise.allSettled([
      listRoles(),
      listMembers(),
      listPermissions(),
    ])
    if (rList.status === 'fulfilled') roles.value = rList.value
    else throw rList.reason
    if (mList.status === 'fulfilled') members.value = mList.value
    if (pList.status === 'fulfilled') permissions.value = pList.value.permissions
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// Group permissions by their `group` field — preserves server order via
// a Map so we don't accidentally alpha-sort and shuffle the UX.
const permissionGroups = computed(() => {
  const groups = new Map<string, Permission[]>()
  for (const p of permissions.value) {
    const g = p.group || 'general'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(p)
  }
  return Array.from(groups, ([name, items]) => ({ name, items }))
})

const memberCountByRole = computed(() => {
  const counts = new Map<string, number>()
  for (const m of members.value) {
    if (!m.role_id) continue
    counts.set(m.role_id, (counts.get(m.role_id) || 0) + 1)
  }
  return counts
})

const roleColor: Record<string, string> = {
  owner:     'bg-amber-500/15 text-amber-500',
  admin:     'bg-sky-500/15 text-sky-500',
  developer: 'bg-violet-500/15 text-violet-500',
  member:    'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

function resetForm() {
  form.value = { name: '', description: '', permissions: [] }
  formError.value = null
}

function startCreate() {
  expandedBuiltinId.value = null
  editingId.value = 'new'
  resetForm()
}

async function startEdit(role: Role) {
  expandedBuiltinId.value = null
  editingId.value = role.id
  formError.value = null
  // If the list endpoint didn't include permissions, fetch them now.
  // Source populates permissions on single-role GET.
  let perms = role.permissions
  if (!perms) {
    try {
      const full = await getRole(role.id)
      perms = full.permissions || []
      // Cache onto the row so a subsequent edit skips the round-trip.
      const idx = roles.value.findIndex((r) => r.id === role.id)
      if (idx >= 0) roles.value[idx] = full
    } catch (e) {
      formError.value = e instanceof Error ? e.message : String(e)
      perms = []
    }
  }
  form.value = {
    name: role.name,
    description: role.description || '',
    permissions: [...(perms || [])],
  }
}

function cancelForm() {
  editingId.value = null
  resetForm()
}

async function submitForm() {
  formError.value = null
  const name = form.value.name.trim()
  if (!name) { formError.value = 'Name is required.'; return }
  saving.value = true
  try {
    const payload = {
      name,
      description: form.value.description.trim() || undefined,
      permissions: form.value.permissions,
    }
    if (editingId.value === 'new') {
      const created = await createRole(payload)
      roles.value = [...roles.value, created]
    } else if (editingId.value) {
      const updated = await updateRole(editingId.value, payload)
      const idx = roles.value.findIndex((r) => r.id === updated.id)
      if (idx >= 0) roles.value[idx] = updated
    }
    editingId.value = null
    resetForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function doDelete(role: Role) {
  if (role.is_builtin) return
  const count = memberCountByRole.value.get(role.id) || 0
  if (count > 0) return
  if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
  busyRow.value = role.id
  try {
    await deleteRole(role.id)
    roles.value = roles.value.filter((r) => r.id !== role.id)
    if (editingId.value === role.id) cancelForm()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyRow.value = null
  }
}

async function toggleBuiltin(role: Role) {
  if (expandedBuiltinId.value === role.id) {
    expandedBuiltinId.value = null
    return
  }
  // Fetch full permissions on demand — list endpoint may omit them.
  if (!role.permissions) {
    try {
      const full = await getRole(role.id)
      const idx = roles.value.findIndex((r) => r.id === role.id)
      if (idx >= 0) roles.value[idx] = full
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return
    }
  }
  expandedBuiltinId.value = role.id
}

function togglePermission(key: string) {
  const i = form.value.permissions.indexOf(key)
  if (i >= 0) form.value.permissions.splice(i, 1)
  else form.value.permissions.push(key)
}

function permissionLabel(key: string): string {
  const p = permissions.value.find((x) => x.key === key)
  return p?.label || key
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Roles</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Roles decide what each member can do. Assign permissions here, then
          pick a role for each teammate on the Members page.
        </p>
      </div>
      <Button
        icon="lucide:plus"
        :aria-expanded="editingId === 'new'"
        aria-controls="role-form"
        @click="editingId === 'new' ? cancelForm() : startCreate()"
      >
        {{ editingId === 'new' ? 'Cancel' : 'New role' }}
      </Button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !roles.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <!-- Shared create/edit form. Rendered once at the top when creating, or
         inline inside the matching row when editing. -->
    <form
      v-if="editingId === 'new'"
      id="role-form"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4"
      @submit.prevent="submitForm"
    >
      <div class="text-sm font-medium">New role</div>
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label for="role-name" class="text-xs text-[var(--app-muted)]">Name</label>
          <Input
            id="role-name"
            v-model="form.name"
            placeholder="e.g. Support"
            :disabled="saving"
            autocomplete="off"
          />
        </div>
        <div class="flex-1 flex flex-col gap-1">
          <label for="role-desc" class="text-xs text-[var(--app-muted)]">Description</label>
          <Input
            id="role-desc"
            v-model="form.description"
            placeholder="What this role is for"
            :disabled="saving"
          />
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="text-xs font-medium text-[var(--app-muted)] uppercase tracking-wide">Permissions</div>
        <div v-if="!permissions.length" class="text-xs text-[var(--app-muted)] italic">
          No permissions available.
        </div>
        <div
          v-for="group in permissionGroups"
          :key="group.name"
          class="flex flex-col gap-2"
        >
          <div class="text-xs font-medium capitalize">{{ group.name }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <label
              v-for="p in group.items"
              :key="p.key"
              class="flex items-start gap-2 text-sm cursor-pointer select-none px-2 py-1 rounded hover:bg-[var(--app-surface)]"
              :title="p.description || ''"
            >
              <input
                type="checkbox"
                class="mt-0.5 shrink-0"
                :checked="form.permissions.includes(p.key)"
                :disabled="saving"
                @change="togglePermission(p.key)"
              />
              <span>{{ p.label || p.key }}</span>
            </label>
          </div>
        </div>
      </div>

      <div v-if="formError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ formError }}</span>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" :disabled="saving" @click="cancelForm">Cancel</Button>
        <Button type="submit" :loading="saving" :disabled="saving || !form.name.trim()">
          {{ saving ? 'Saving…' : 'Create role' }}
        </Button>
      </div>
    </form>

    <div
      v-if="roles.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
      aria-live="polite"
    >
      <template v-for="role in roles" :key="role.id">
        <div class="flex items-center gap-4 px-5 py-3.5">
          <div
            class="size-9 rounded-md grid place-items-center text-sm font-semibold shrink-0 capitalize"
            :class="roleColor[role.name.toLowerCase()] || roleColor.member"
          >
            <Icon icon="lucide:shield" class="size-4" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate capitalize">{{ role.name }}</span>
              <span
                v-if="role.is_builtin"
                class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-muted)]"
              >Built-in</span>
            </div>
            <div v-if="role.description" class="text-xs text-[var(--app-muted)] truncate">
              {{ role.description }}
            </div>
          </div>

          <span
            class="text-xs px-2 py-1 rounded bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0"
            :title="`${memberCountByRole.get(role.id) || 0} member(s) assigned`"
          >
            {{ memberCountByRole.get(role.id) || 0 }}
            {{ (memberCountByRole.get(role.id) || 0) === 1 ? 'member' : 'members' }}
          </span>

          <div class="flex items-center gap-1 shrink-0">
            <button
              v-if="role.is_builtin"
              type="button"
              class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-surface)]"
              :aria-label="`View permissions for ${role.name}`"
              :aria-expanded="expandedBuiltinId === role.id"
              @click="toggleBuiltin(role)"
            >
              <Icon
                :icon="expandedBuiltinId === role.id ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                class="size-4"
              />
            </button>
            <button
              v-else
              type="button"
              class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-surface)] disabled:opacity-40"
              :disabled="busyRow === role.id"
              :aria-label="`Edit ${role.name}`"
              @click="editingId === role.id ? cancelForm() : startEdit(role)"
            >
              <Icon icon="lucide:pencil" class="size-4" />
            </button>
            <button
              type="button"
              class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[var(--app-muted)] disabled:hover:bg-transparent"
              :disabled="role.is_builtin || (memberCountByRole.get(role.id) || 0) > 0 || busyRow === role.id"
              :title="role.is_builtin
                ? 'Built-in roles cannot be deleted'
                : (memberCountByRole.get(role.id) || 0) > 0
                  ? 'Reassign members first'
                  : `Delete ${role.name}`"
              :aria-label="`Delete ${role.name}`"
              @click="doDelete(role)"
            >
              <Icon icon="lucide:trash-2" class="size-4" />
            </button>
          </div>
        </div>

        <!-- Inline edit form expands below the row being edited. -->
        <form
          v-if="editingId === role.id && !role.is_builtin"
          :key="`edit-${role.id}`"
          class="px-5 py-5 bg-[var(--app-surface)] flex flex-col gap-4"
          @submit.prevent="submitForm"
        >
          <div class="text-sm font-medium">Edit role</div>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label :for="`name-${role.id}`" class="text-xs text-[var(--app-muted)]">Name</label>
              <Input
                :id="`name-${role.id}`"
                v-model="form.name"
                :disabled="saving"
                autocomplete="off"
              />
            </div>
            <div class="flex-1 flex flex-col gap-1">
              <label :for="`desc-${role.id}`" class="text-xs text-[var(--app-muted)]">Description</label>
              <Input
                :id="`desc-${role.id}`"
                v-model="form.description"
                :disabled="saving"
              />
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="text-xs font-medium text-[var(--app-muted)] uppercase tracking-wide">Permissions</div>
            <div
              v-for="group in permissionGroups"
              :key="group.name"
              class="flex flex-col gap-2"
            >
              <div class="text-xs font-medium capitalize">{{ group.name }}</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <label
                  v-for="p in group.items"
                  :key="p.key"
                  class="flex items-start gap-2 text-sm cursor-pointer select-none px-2 py-1 rounded hover:bg-[var(--app-card-bg)]"
                  :title="p.description || ''"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 shrink-0"
                    :checked="form.permissions.includes(p.key)"
                    :disabled="saving"
                    @change="togglePermission(p.key)"
                  />
                  <span>{{ p.label || p.key }}</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="formError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
            <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
            <span>{{ formError }}</span>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" :disabled="saving" @click="cancelForm">Cancel</Button>
            <Button type="submit" :loading="saving" :disabled="saving || !form.name.trim()">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </Button>
          </div>
        </form>

        <!-- Read-only permission peek for built-in roles. -->
        <div
          v-if="expandedBuiltinId === role.id && role.is_builtin"
          :key="`builtin-${role.id}`"
          class="px-5 py-4 bg-[var(--app-surface)] flex flex-col gap-2"
        >
          <div class="text-xs font-medium text-[var(--app-muted)] uppercase tracking-wide">
            Permissions ({{ role.permissions?.length || 0 }})
          </div>
          <div v-if="role.permissions && role.permissions.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="key in role.permissions"
              :key="key"
              class="text-xs px-2 py-0.5 rounded border border-[var(--app-border)] bg-[var(--app-card-bg)]"
            >{{ permissionLabel(key) }}</span>
          </div>
          <div v-else class="text-xs text-[var(--app-muted)] italic">
            No permissions granted.
          </div>
        </div>
      </template>
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
    >
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:shield" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No custom roles yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Create one to fine-tune access.
      </p>
    </div>
  </section>
</template>
