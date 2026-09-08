<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSessionStore } from '@construct-space/infra-shell'
import { registerUser } from '../composables/useAuth'
import ConstructLogo from '../components/ConstructLogo.vue'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const firstName = ref('')
const lastName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')

const submitting = ref(false)
const error = ref<string | null>(null)

const nextUrl = computed(() => {
  const n = route.query.next
  return typeof n === 'string' && n ? n : '/'
})

async function submit() {
  error.value = null
  if (password.value !== passwordConfirm.value) {
    error.value = 'Passwords do not match.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  submitting.value = true
  const result = await registerUser({
    first_name: firstName.value.trim(),
    last_name: lastName.value.trim(),
    username: username.value.trim(),
    email: email.value.trim(),
    password: password.value,
    return_to: nextUrl.value,
  })
  submitting.value = false
  if (result.status === 'ok') {
    await session.refreshScope()
    router.replace(nextUrl.value)
  } else {
    error.value = result.message
  }
}
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6 bg-[var(--app-canvas-bg)]">
    <div class="w-full max-w-[460px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-7 flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <ConstructLogo :size="26" />
        <div class="text-lg font-semibold">Construct</div>
      </div>

      <div>
        <h1 class="text-xl font-semibold">Create account</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">Join to build and publish Construct spaces.</p>
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <Input v-model="firstName" placeholder="First name" autocomplete="given-name" :disabled="submitting" autofocus />
          <Input v-model="lastName" placeholder="Last name" autocomplete="family-name" :disabled="submitting" />
        </div>
        <Input v-model="username" placeholder="Username" autocomplete="username" :disabled="submitting" />
        <Input v-model="email" type="email" placeholder="Email" autocomplete="email" :disabled="submitting" />
        <InputPassword v-model="password" placeholder="Password" autocomplete="new-password" :disabled="submitting" strength />
        <InputPassword v-model="passwordConfirm" placeholder="Confirm password" autocomplete="new-password" :disabled="submitting" />

        <Button type="submit" size="lg" block :loading="submitting" :disabled="submitting">
          {{ submitting ? 'Creating account…' : 'Create account' }}
        </Button>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </form>

      <p class="text-sm text-[var(--app-muted)] text-center">
        Have an account?
        <RouterLink to="/login" class="text-[var(--app-accent)] hover:underline">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
