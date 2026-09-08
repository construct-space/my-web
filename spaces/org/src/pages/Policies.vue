<script setup lang="ts">
/**
 * Policies — team-wide defaults for the org. Thin UI over source's
 * /org/preferences key/value store; each control saves on change and
 * reverts the local state if the server rejects the PUT (the typical
 * rejection is 403 for non-admins — we gate the inputs up front via the
 * session scope, but the server remains the source of truth).
 *
 * v1 keys:
 *   - members.invite_role_default    (string — default role_id|name for new invites)
 *   - members.require_2fa            (bool)
 *   - projects.default_visibility    (enum: private | internal | public)
 *   - providers.allow_member_oauth   (bool)
 */
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import {
  listOrgPreferences,
  setOrgPreference,
  listRoles,
  type Role,
} from '../api'

const session = useSessionStore()

const canEdit = computed(() => {
  const roles = session.scope?.roles || []
  return roles.includes('owner') || roles.includes('admin')
})

// ─── Defaults ────────────────────────────────────────────────────────────────
// Fall back values if the server hasn't stored a value yet. Keep these in
// sync with source's preference defaults.
const DEFAULTS = {
  'members.invite_role_default': 'member',
  'members.require_2fa': false,
  'projects.default_visibility': 'private',
  'providers.allow_member_oauth': true,
} as const

type VisibilityKey = 'private' | 'internal' | 'public'

// Reactive policy values. All four are defined up front so the template
// can render immediately without null-checks; we overwrite from the
// server response once load() resolves.
const inviteRoleDefault    = ref<string>(DEFAULTS['members.invite_role_default'])
const requireTwoFactor     = ref<boolean>(DEFAULTS['members.require_2fa'])
const defaultVisibility    = ref<VisibilityKey>(DEFAULTS['projects.default_visibility'])
const allowMemberOauth     = ref<boolean>(DEFAULTS['providers.allow_member_oauth'])

const roles      = ref<Role[]>([])
const loading    = ref(false)
const error      = ref<string | null>(null)
// Per-key saving/error flags so two concurrent edits don't step on each other.
const saving     = ref<Record<string, boolean>>({})
const keyError   = ref<Record<string, string | null>>({})

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: r.name, value: r.name.toLowerCase() })),
)

const visibilityOptions = [
  { label: 'Private',  value: 'private',  description: 'Visible only to project members.' },
  { label: 'Internal', value: 'internal', description: 'Visible to all org members.' },
  { label: 'Public',   value: 'public',   description: 'Visible to anyone with a link.' },
]

async function load() {
  loading.value = true
  error.value = null
  try {
    const [prefsRes, rolesRes] = await Promise.allSettled([
      listOrgPreferences(),
      listRoles(),
    ])
    if (prefsRes.status === 'fulfilled') {
      const data = prefsRes.value.data || {}
      if (typeof data['members.invite_role_default'] === 'string')
        inviteRoleDefault.value = data['members.invite_role_default'] as string
      if (typeof data['members.require_2fa'] === 'boolean')
        requireTwoFactor.value = data['members.require_2fa'] as boolean
      const vis = data['projects.default_visibility']
      if (vis === 'private' || vis === 'internal' || vis === 'public')
        defaultVisibility.value = vis
      if (typeof data['providers.allow_member_oauth'] === 'boolean')
        allowMemberOauth.value = data['providers.allow_member_oauth'] as boolean
    } else {
      throw prefsRes.reason
    }
    if (rolesRes.status === 'fulfilled') roles.value = rolesRes.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

/**
 * Persist one key. On failure we roll the ref back to `previous` so the
 * UI stays consistent with the server — no stale "looks saved" state.
 */
async function save<T>(key: string, value: T, previous: T, apply: (v: T) => void) {
  keyError.value = { ...keyError.value, [key]: null }
  saving.value = { ...saving.value, [key]: true }
  try {
    await setOrgPreference(key, value)
  } catch (e) {
    apply(previous)
    const msg = e instanceof Error ? e.message : String(e)
    keyError.value = { ...keyError.value, [key]: msg }
  } finally {
    saving.value = { ...saving.value, [key]: false }
  }
}

function onInviteRoleChange(next: string) {
  if (!canEdit.value) return
  const prev = inviteRoleDefault.value
  inviteRoleDefault.value = next
  save('members.invite_role_default', next, prev, (v) => { inviteRoleDefault.value = v })
}

function onRequire2faChange(next: boolean) {
  if (!canEdit.value) return
  const prev = requireTwoFactor.value
  requireTwoFactor.value = next
  save('members.require_2fa', next, prev, (v) => { requireTwoFactor.value = v })
}

function onVisibilityChange(next: string) {
  if (!canEdit.value) return
  if (next !== 'private' && next !== 'internal' && next !== 'public') return
  const prev = defaultVisibility.value
  defaultVisibility.value = next
  save('projects.default_visibility', next, prev, (v) => { defaultVisibility.value = v as VisibilityKey })
}

function onAllowOauthChange(next: boolean) {
  if (!canEdit.value) return
  const prev = allowMemberOauth.value
  allowMemberOauth.value = next
  save('providers.allow_member_oauth', next, prev, (v) => { allowMemberOauth.value = v })
}

onMounted(load)
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Policies</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Team-wide defaults that apply to every member, project, and connected
        provider in this organization.
      </p>
    </div>

    <div v-if="!canEdit" class="flex items-start gap-2 text-xs text-[var(--app-muted)] rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
      <Icon icon="lucide:info" class="size-4 mt-0.5 shrink-0" />
      <span>Only owners and admins can change policies.</span>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <!-- Members card -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-5">
      <div class="flex items-start gap-4">
        <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
          <Icon icon="lucide:users" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold">Members</div>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Defaults applied when new people join the organization.
          </p>
        </div>
      </div>

      <!-- invite_role_default -->
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <label class="text-sm font-medium" for="pol-invite-role">Default invite role</label>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              Role assigned when an admin invites a new teammate.
            </p>
          </div>
          <div class="w-48 shrink-0">
            <SelectMenu
              id="pol-invite-role"
              :model-value="inviteRoleDefault"
              :options="roleOptions"
              :disabled="!canEdit || saving['members.invite_role_default'] || loading"
              placeholder="Pick a role"
              @update:model-value="onInviteRoleChange"
            />
          </div>
        </div>
        <div v-if="keyError['members.invite_role_default']" class="flex items-start gap-2 text-xs text-red-500">
          <Icon icon="lucide:alert-circle" class="size-3.5 mt-0.5 shrink-0" />
          <span>{{ keyError['members.invite_role_default'] }}</span>
        </div>
      </div>

      <!-- require_2fa -->
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">Require two-factor authentication</div>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              Members without 2FA enabled will be blocked from signing in.
            </p>
          </div>
          <div class="shrink-0">
            <Switch
              :model-value="requireTwoFactor"
              :disabled="!canEdit || saving['members.require_2fa'] || loading"
              @update:model-value="onRequire2faChange"
            />
          </div>
        </div>
        <div v-if="keyError['members.require_2fa']" class="flex items-start gap-2 text-xs text-red-500">
          <Icon icon="lucide:alert-circle" class="size-3.5 mt-0.5 shrink-0" />
          <span>{{ keyError['members.require_2fa'] }}</span>
        </div>
      </div>
    </div>

    <!-- Projects card -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-5">
      <div class="flex items-start gap-4">
        <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
          <Icon icon="lucide:folder-kanban" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold">Projects</div>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Defaults applied to projects created in this organization.
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <label class="text-sm font-medium" for="pol-visibility">Default visibility</label>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              Applied to new projects. Owners can still change it per project.
            </p>
          </div>
          <div class="w-48 shrink-0">
            <SelectMenu
              id="pol-visibility"
              :model-value="defaultVisibility"
              :options="visibilityOptions"
              :disabled="!canEdit || saving['projects.default_visibility'] || loading"
              @update:model-value="onVisibilityChange"
            />
          </div>
        </div>
        <div v-if="keyError['projects.default_visibility']" class="flex items-start gap-2 text-xs text-red-500">
          <Icon icon="lucide:alert-circle" class="size-3.5 mt-0.5 shrink-0" />
          <span>{{ keyError['projects.default_visibility'] }}</span>
        </div>
      </div>
    </div>

    <!-- Providers card -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-5">
      <div class="flex items-start gap-4">
        <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
          <Icon icon="lucide:plug" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold">Providers</div>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            How members authenticate to external providers (GitHub, GitLab, …).
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">Allow members' personal OAuth</div>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              When off, members must use the org's provider keys instead of
              their personal OAuth.
            </p>
          </div>
          <div class="shrink-0">
            <Switch
              :model-value="allowMemberOauth"
              :disabled="!canEdit || saving['providers.allow_member_oauth'] || loading"
              @update:model-value="onAllowOauthChange"
            />
          </div>
        </div>
        <div v-if="keyError['providers.allow_member_oauth']" class="flex items-start gap-2 text-xs text-red-500">
          <Icon icon="lucide:alert-circle" class="size-3.5 mt-0.5 shrink-0" />
          <span>{{ keyError['providers.allow_member_oauth'] }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
