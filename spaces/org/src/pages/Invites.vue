<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listInvites,
  listRoles,
  createInvite,
  cancelInvite,
  type Invite,
  type Role,
} from '../api'

const invites = ref<Invite[]>([])
const roles   = ref<Role[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)

const creating    = ref(false)
const showForm    = ref(false)
const formEmail   = ref('')
const formRole    = ref<string>('member')
const formError   = ref<string | null>(null)

const busyRow     = ref<string | null>(null)
const copiedId    = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [i, r] = await Promise.allSettled([listInvites(), listRoles()])
    if (i.status === 'fulfilled') invites.value = i.value
    if (r.status === 'fulfilled') {
      roles.value = r.value
      if (!roles.value.some((x) => x.name.toLowerCase() === formRole.value.toLowerCase())
          && roles.value.length) {
        formRole.value = roles.value[0].name
      }
    }
    if (i.status === 'rejected') throw i.reason
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: r.name, value: r.name }))
)

const roleColor: Record<string, string> = {
  owner:     'bg-amber-500/15 text-amber-500',
  admin:     'bg-sky-500/15 text-sky-500',
  developer: 'bg-violet-500/15 text-violet-500',
  member:    'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

const statusColor: Record<Invite['status'], string> = {
  pending:  'bg-amber-500/15 text-amber-500',
  accepted: 'bg-emerald-500/15 text-emerald-500',
  revoked:  'bg-[var(--app-surface)] text-[var(--app-muted)]',
  expired:  'bg-[var(--app-surface)] text-[var(--app-muted)]',
}

function relativeTime(iso?: string): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const diffMs = Date.now() - then
  const sec = Math.round(diffMs / 1000)
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.round(day / 365)
  return `${yr}y ago`
}

async function submit() {
  formError.value = null
  const email = formEmail.value.trim()
  if (!email) { formError.value = 'Email is required.'; return }
  creating.value = true
  try {
    const created = await createInvite({ email, role: formRole.value || undefined })
    invites.value = [created, ...invites.value]
    formEmail.value = ''
    showForm.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creating.value = false
  }
}

async function copyLink(inv: Invite) {
  const url = `${location.origin}/invites/${inv.token}/accept`
  try {
    await navigator.clipboard.writeText(url)
    copiedId.value = inv.id
    setTimeout(() => { if (copiedId.value === inv.id) copiedId.value = null }, 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function doRevoke(inv: Invite) {
  if (!confirm(`Revoke invitation for ${inv.email}? They won't be able to use the link anymore.`)) return
  busyRow.value = inv.id
  try {
    await cancelInvite(inv.id)
    const idx = invites.value.findIndex((x) => x.id === inv.id)
    if (idx >= 0) invites.value[idx] = { ...invites.value[idx], status: 'revoked' }
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
        <h1 class="text-xl font-semibold">Invites</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Track pending invitations, share the accept link, and revoke the ones you no longer want.
        </p>
      </div>
      <Button
        icon="lucide:mail-plus"
        :aria-expanded="showForm"
        aria-controls="new-invite-form"
        @click="showForm = !showForm"
      >
        {{ showForm ? 'Cancel' : 'Invite member' }}
      </Button>
    </div>

    <form
      v-if="showForm"
      id="new-invite-form"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3"
      @submit.prevent="submit"
    >
      <div class="text-sm font-medium">Send a new invitation</div>
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label for="new-invite-email" class="text-xs text-[var(--app-muted)]">Email</label>
          <Input
            id="new-invite-email"
            v-model="formEmail"
            type="email"
            placeholder="teammate@company.com"
            icon="lucide:at-sign"
            :disabled="creating"
            autocomplete="email"
          />
        </div>
        <div class="sm:w-56 flex flex-col gap-1">
          <label class="text-xs text-[var(--app-muted)]">Role</label>
          <SelectMenu
            v-model="formRole"
            :options="roleOptions"
            searchable
            placeholder="Select role…"
            :disabled="creating || !roles.length"
          />
        </div>
      </div>
      <div v-if="formError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ formError }}</span>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" :disabled="creating" @click="showForm = false">Cancel</Button>
        <Button type="submit" :loading="creating" :disabled="creating || !formEmail.trim()">
          {{ creating ? 'Sending…' : 'Send invite' }}
        </Button>
      </div>
    </form>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !invites.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="invites.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
      aria-live="polite"
    >
      <div
        v-for="inv in invites"
        :key="inv.id"
        class="flex items-center gap-4 px-5 py-3.5"
      >
        <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
          <Icon icon="lucide:mail" class="size-4" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">{{ inv.email }}</div>
          <div class="text-xs text-[var(--app-muted)] flex items-center gap-2 mt-0.5">
            <span>{{ relativeTime(inv.created_at) }}</span>
            <span v-if="inv.code" class="font-mono px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]">
              {{ inv.code }}
            </span>
          </div>
        </div>

        <span
          class="text-xs font-medium px-2 py-1 rounded capitalize w-24 text-center shrink-0"
          :class="roleColor[inv.role] || roleColor.member"
        >{{ inv.role }}</span>

        <span
          class="text-xs font-medium px-2 py-1 rounded capitalize w-20 text-center shrink-0"
          :class="statusColor[inv.status]"
        >{{ inv.status }}</span>

        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="inv.status === 'pending'"
            type="button"
            class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-surface)] disabled:opacity-40"
            :aria-label="`Copy invite link for ${inv.email}`"
            @click="copyLink(inv)"
          >
            <Icon :icon="copiedId === inv.id ? 'lucide:check' : 'lucide:link'" class="size-4" />
          </button>
          <button
            v-if="inv.status === 'pending'"
            type="button"
            class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)] disabled:opacity-40"
            :disabled="busyRow === inv.id"
            :aria-label="`Revoke invite for ${inv.email}`"
            @click="doRevoke(inv)"
          >
            <Icon icon="lucide:x" class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:mail" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No invitations yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Send your first invite to bring teammates into the organization.
      </p>
    </div>
  </section>
</template>
