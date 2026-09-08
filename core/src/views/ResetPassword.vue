<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { resetPassword } from '../composables/useAuth'
import ConstructLogo from '../components/ConstructLogo.vue'
import { resolveResetPasswordFields } from './resetPasswordFields'

const router = useRouter()
const route = useRoute()

const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const nextUrl = computed(() => typeof route.query.next === 'string' ? route.query.next : '/login')

const password = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const done = ref(false)
const error = ref<string | null>(null)
const formEl = ref<HTMLFormElement | null>(null)

// Live mismatch signal — only shown once the user has typed in both
// fields. Submit re-reads the actual form values to cover autofill paths
// that update the DOM without emitting Vue model updates.
const mismatch = computed(() => {
  const fields = resolveResetPasswordFields({
    modelPassword: password.value,
    modelPasswordConfirm: passwordConfirm.value,
  })
  return fields.password.length > 0 && fields.passwordConfirm.length > 0 && !fields.passwordsMatch
})

onMounted(() => {
  if (!token.value) error.value = 'This reset link is missing a token.'
})

async function submit() {
  error.value = null
  const fields = resolveResetPasswordFields({
    modelPassword: password.value,
    modelPasswordConfirm: passwordConfirm.value,
    formData: formEl.value ? new FormData(formEl.value) : null,
  })
  password.value = fields.password
  passwordConfirm.value = fields.passwordConfirm

  if (fields.password.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  if (!fields.passwordsMatch) {
    error.value = 'Passwords do not match.'
    return
  }
  submitting.value = true
  const result = await resetPassword(token.value, fields.password, fields.passwordConfirm)
  submitting.value = false
  if (result.status === 'ok') {
    done.value = true
    setTimeout(() => router.replace({ path: '/login', query: { next: nextUrl.value } }), 1500)
  } else {
    error.value = result.message
  }
}
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6 bg-[var(--app-canvas-bg)]">
    <div class="w-full max-w-[420px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-7 flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <ConstructLogo :size="26" />
        <div class="text-lg font-semibold">Construct</div>
      </div>

      <template v-if="!done">
        <div>
          <h1 class="text-xl font-semibold">Set a new password</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1">Pick something strong — at least 8 characters.</p>
        </div>

        <form ref="formEl" class="flex flex-col gap-3" @submit.prevent="submit">
          <InputPassword v-model="password" name="password" placeholder="New password" autocomplete="new-password" :disabled="submitting || !token" autofocus strength />
          <InputPassword v-model="passwordConfirm" name="password_confirm" placeholder="Confirm new password" autocomplete="new-password" :disabled="submitting || !token" />
          <p v-if="mismatch" class="text-xs text-[var(--app-muted)]">Passwords don't match yet.</p>
          <Button type="submit" size="lg" block :loading="submitting" :disabled="submitting || !token">
            {{ submitting ? 'Saving…' : 'Update password' }}
          </Button>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </form>
      </template>

      <template v-else>
        <div class="text-center">
          <Icon icon="lucide:check-circle-2" class="size-10 mx-auto text-[var(--app-accent)]" />
          <h1 class="text-xl font-semibold mt-3">Password updated</h1>
          <p class="text-sm text-[var(--app-muted)] mt-2">Redirecting to sign-in…</p>
        </div>
      </template>
    </div>
  </div>
</template>
