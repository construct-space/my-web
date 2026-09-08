<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { changePassword } from '../../api'

const current = ref('')
const next = ref('')
const confirm = ref('')

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function submit() {
  error.value = null
  success.value = false
  if (next.value !== confirm.value) {
    error.value = 'New passwords do not match.'
    return
  }
  if (next.value.length < 8) {
    error.value = 'New password must be at least 8 characters.'
    return
  }
  loading.value = true
  try {
    await changePassword(current.value, next.value)
    success.value = true
    current.value = ''
    next.value = ''
    confirm.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="max-w-xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Change password</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        You'll stay signed in on this device. Other sessions can be ended on the Sessions page.
      </p>
    </div>

    <form class="flex flex-col gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6" @submit.prevent="submit">
      <InputPassword v-model="current" placeholder="Current password" autocomplete="current-password" :disabled="loading" />
      <InputPassword v-model="next" placeholder="New password" autocomplete="new-password" :disabled="loading" strength />
      <InputPassword v-model="confirm" placeholder="Confirm new password" autocomplete="new-password" :disabled="loading" />

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>
      <div v-if="success" class="flex items-start gap-2 text-sm text-green-500">
        <Icon icon="lucide:check-circle-2" class="size-4 mt-0.5 shrink-0" />
        <span>Password updated.</span>
      </div>

      <div class="flex justify-end pt-2">
        <Button type="submit" :loading="loading" :disabled="loading || !current || !next || !confirm">
          {{ loading ? 'Updating…' : 'Update password' }}
        </Button>
      </div>
    </form>
  </section>
</template>
