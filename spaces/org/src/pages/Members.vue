<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listMembers,
  listRoles,
  inviteMember,
  removeMember,
  updateMemberRole,
  type Member,
  type Role,
} from '../api'

const members = ref<Member[]>([])
const roles   = ref<Role[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)
const search  = ref('')

// Invite form state. Kept inline (not a modal) so the primary action
// stays one click away; expands only when the user hits "Invite member".
const inviting     = ref(false)
const showInvite   = ref(false)
const inviteEmail  = ref('')
const inviteRoleId = ref<string>('')
const inviteError  = ref<string | null>(null)

// Row action state — keyed by member id so only the affected row is busy.
const busyRow      = ref<string | null>(null)
const editingRoleId = ref<string | null>(null)
const changingRoleTo = ref<string>('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const [m, r] = await Promise.allSettled([listMembers(), listRoles()])
    if (m.status === 'fulfilled') members.value = m.value
    if (r.status === 'fulfilled') {
      roles.value = r.value
      // Default invite role to 'member' if present, else first role.
      if (!inviteRoleId.value && roles.value.length) {
        const def = roles.value.find((x) => x.name.toLowerCase() === 'member') || roles.value[0]
        inviteRoleId.value = def.id
      }
    }
    if (m.status === 'rejected') throw m.reason
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: r.name, value: r.id }))
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter((m) =>
    m.name.toLowerCase().includes(q) ||
    m.email.toLowerCase().includes(q) ||
    m.role.toLowerCase().includes(q)
  )
})

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

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

async function submitInvite() {
  inviteError.value = null
  const email = inviteEmail.value.trim()
  if (!email) { inviteError.value = 'Email is required.'; return }
  if (!inviteRoleId.value) { inviteError.value = 'Pick a role.'; return }
  inviting.value = true
  try {
    const created = await inviteMember({ email, role_id: inviteRoleId.value })
    // Optimistic prepend — avoids a second round-trip and keeps the form snappy.
    members.value = [created, ...members.value]
    inviteEmail.value = ''
    showInvite.value = false
  } catch (e) {
    inviteError.value = e instanceof Error ? e.message : String(e)
  } finally {
    inviting.value = false
  }
}

function startRoleEdit(m: Member) {
  editingRoleId.value = m.id
  changingRoleTo.value = m.role_id || ''
}

async function commitRoleChange(m: Member) {
  if (!changingRoleTo.value || changingRoleTo.value === m.role_id) {
    editingRoleId.value = null
    return
  }
  busyRow.value = m.id
  try {
    const updated = await updateMemberRole(m.id, changingRoleTo.value)
    const idx = members.value.findIndex((x) => x.id === m.id)
    if (idx >= 0) members.value[idx] = updated
    editingRoleId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyRow.value = null
  }
}

async function doRemove(m: Member) {
  if (!confirm(`Remove ${m.name || m.email} from the organization? This cannot be undone.`)) return
  busyRow.value = m.id
  try {
    await removeMember(m.id)
    members.value = members.value.filter((x) => x.id !== m.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyRow.value = null
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Members</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Add teammates, change roles, and offboard people.
        </p>
      </div>
      <Button
        icon="lucide:user-plus"
        :aria-expanded="showInvite"
        aria-controls="invite-form"
        @click="showInvite = !showInvite"
      >
        {{ showInvite ? 'Cancel' : 'Invite member' }}
      </Button>
    </div>

    <!-- Invite form. Expands inline above the list so focus order is
         predictable and screen readers announce it via the aria-expanded
         toggle above. -->
    <form
      v-if="showInvite"
      id="invite-form"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3"
      @submit.prevent="submitInvite"
    >
      <div class="text-sm font-medium">Invite a new member</div>
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label for="invite-email" class="text-xs text-[var(--app-muted)]">Email</label>
          <Input
            id="invite-email"
            v-model="inviteEmail"
            type="email"
            placeholder="teammate@company.com"
            icon="lucide:at-sign"
            :disabled="inviting"
            autocomplete="email"
          />
        </div>
        <div class="sm:w-56 flex flex-col gap-1">
          <label class="text-xs text-[var(--app-muted)]">Role</label>
          <SelectMenu
            v-model="inviteRoleId"
            :options="roleOptions"
            searchable
            placeholder="Select role…"
            :disabled="inviting || !roles.length"
          />
        </div>
      </div>
      <div v-if="inviteError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ inviteError }}</span>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" :disabled="inviting" @click="showInvite = false">Cancel</Button>
        <Button type="submit" :loading="inviting" :disabled="inviting || !inviteEmail.trim() || !inviteRoleId">
          {{ inviting ? 'Sending…' : 'Send invite' }}
        </Button>
      </div>
    </form>

    <div class="flex items-center gap-3">
      <Input
        v-model="search"
        icon="lucide:search"
        placeholder="Search by name, email, or role…"
        class="max-w-md"
        aria-label="Filter members"
      />
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !members.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="filtered.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
      aria-live="polite"
    >
      <div
        v-for="m in filtered"
        :key="m.id"
        class="flex items-center gap-4 px-5 py-3.5"
      >
        <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-sm font-semibold overflow-hidden shrink-0">
          <img v-if="m.avatar" :src="m.avatar" :alt="m.name" class="size-full object-cover" />
          <span v-else>{{ initials(m.name, m.email) }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ m.name || m.email }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate">{{ m.email }}</div>
        </div>

        <!-- Inline role editor swaps in when the user clicks the role
             pill. Keeps list/edit modes in one component — no modal, no
             extra nav. -->
        <div class="w-40 shrink-0">
          <SelectMenu
            v-if="editingRoleId === m.id"
            v-model="changingRoleTo"
            :options="roleOptions"
            searchable
            size="sm"
            :disabled="busyRow === m.id"
            @update:model-value="commitRoleChange(m)"
          />
          <button
            v-else
            type="button"
            class="text-xs font-medium px-2 py-1 rounded capitalize hover:ring-1 hover:ring-[var(--app-border)]"
            :class="roleColor[m.role] || roleColor.member"
            :aria-label="`Change role for ${m.name || m.email}`"
            @click="startRoleEdit(m)"
          >{{ m.role }}</button>
        </div>

        <span class="text-xs text-[var(--app-muted)] w-28 shrink-0 hidden md:inline">{{ fmtDate(m.joined_at) }}</span>

        <button
          type="button"
          class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)] disabled:opacity-40"
          :disabled="busyRow === m.id"
          :aria-label="`Remove ${m.name || m.email}`"
          @click="doRemove(m)"
        >
          <Icon icon="lucide:trash-2" class="size-4" />
        </button>
      </div>
    </div>

    <div v-else-if="!loading && !members.length" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:users" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No members yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Invite your first teammate to get the organization rolling.
      </p>
    </div>

    <div v-else class="text-sm text-[var(--app-muted)] text-center py-8">
      No members match your search.
    </div>
  </section>
</template>
