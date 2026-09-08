<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { getProfile, updateProfile, uploadAvatar, type UserProfile } from '../api'

const session = useSessionStore()

const profile = ref<UserProfile | null>(null)
const firstName = ref('')
const lastName = ref('')
const username = ref('')
const phone = ref('')
const avatarUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarBroken = ref(false)

const loading = ref(false)
const saving = ref(false)
const uploadingAvatar = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const displayName = computed(() => {
  const name = `${firstName.value} ${lastName.value}`.trim()
  return name || username.value || session.scope?.user?.email || ''
})

const initials = computed(() => {
  const f = firstName.value?.[0] || ''
  const l = lastName.value?.[0] || ''
  return (f + l).toUpperCase() || (displayName.value?.[0]?.toUpperCase() ?? '?')
})

const dirty = computed(() => {
  if (!profile.value) return false
  return firstName.value !== profile.value.first_name
      || lastName.value !== profile.value.last_name
      || username.value !== profile.value.username
      || avatarUrl.value !== (profile.value.avatar_url || '')
      || (phone.value || '') !== (profile.value.phone || '')
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const p = await getProfile()
    profile.value = p
    firstName.value = p.first_name
    lastName.value = p.last_name
    username.value = p.username
    phone.value = p.phone || ''
    avatarUrl.value = p.avatar_url || ''
    avatarBroken.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = null
  success.value = false
  saving.value = true
  try {
    const updated = await updateProfile({
      first_name: firstName.value.trim(),
      last_name:  lastName.value.trim(),
      username:   username.value.trim(),
      phone:      phone.value.trim() || null,
      avatar_url: avatarUrl.value,
    })
    profile.value = updated
    avatarUrl.value = updated.avatar_url || ''
    success.value = true
    await session.refreshScope()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function chooseAvatar() {
  if (loading.value || saving.value || uploadingAvatar.value) return
  avatarInput.value?.click()
}

async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  error.value = null
  success.value = false
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
  if (!allowed.has(file.type)) {
    error.value = 'Avatar must be a PNG, JPEG, WebP, GIF, or AVIF image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Avatar must be 5 MB or smaller.'
    return
  }

  uploadingAvatar.value = true
  try {
    const uploaded = await uploadAvatar(file)
    const updated = await updateProfile({ avatar_url: uploaded.public_url })
    if ((updated.avatar_url || '') !== uploaded.public_url) {
      throw new Error('Avatar uploaded, but the account profile did not save the avatar URL.')
    }
    profile.value = updated
    avatarUrl.value = updated.avatar_url || ''
    avatarBroken.value = false
    success.value = true
    await session.refreshScope()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploadingAvatar.value = false
  }
}

async function removeAvatar() {
  if (!avatarUrl.value || uploadingAvatar.value) return
  error.value = null
  success.value = false
  uploadingAvatar.value = true
  try {
    const updated = await updateProfile({ avatar_url: '' })
    profile.value = updated
    avatarUrl.value = ''
    avatarBroken.value = false
    success.value = true
    await session.refreshScope()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploadingAvatar.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Your profile</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">The basics about your Construct account.</p>
    </div>

    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 flex items-center gap-4">
      <div class="size-16 rounded-full grid place-items-center overflow-hidden bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)] text-xl font-semibold shrink-0">
        <img
          v-if="avatarUrl && !avatarBroken"
          :src="avatarUrl"
          :alt="displayName || 'Avatar'"
          class="size-full object-cover"
          @error="avatarBroken = true"
        />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-base font-medium truncate">
          {{ displayName || '—' }}
        </div>
        <div class="text-sm text-[var(--app-muted)] truncate">{{ session.scope?.user?.email || '—' }}</div>
      </div>
      <input
        ref="avatarInput"
        class="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        @change="onAvatarSelected"
      />
      <div class="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon="lucide:upload"
          :loading="uploadingAvatar"
          :disabled="loading || saving || uploadingAvatar"
          @click="chooseAvatar"
        >
          {{ avatarUrl ? 'Change' : 'Upload' }}
        </Button>
        <Button
          v-if="avatarUrl"
          type="button"
          size="sm"
          variant="ghost"
          color="error"
          icon="lucide:trash-2"
          :disabled="loading || saving || uploadingAvatar"
          @click="removeAvatar"
        >
          Remove
        </Button>
      </div>
    </div>

    <form class="flex flex-col gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6" @submit.prevent="save">
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--app-muted)]">First name</label>
          <Input v-model="firstName" :disabled="loading || saving" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--app-muted)]">Last name</label>
          <Input v-model="lastName" :disabled="loading || saving" />
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Username</label>
        <Input v-model="username" :disabled="loading || saving" autocomplete="username" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Phone <span class="opacity-60">(optional)</span></label>
        <Input v-model="phone" type="tel" :disabled="loading || saving" autocomplete="tel" />
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>
      <div v-if="success" class="flex items-start gap-2 text-sm text-green-500">
        <Icon icon="lucide:check-circle-2" class="size-4 mt-0.5 shrink-0" />
        <span>Profile saved.</span>
      </div>

      <div class="flex justify-end pt-2">
        <Button type="submit" :loading="saving" :disabled="saving || loading || !dirty">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </Button>
      </div>
    </form>
  </section>
</template>
