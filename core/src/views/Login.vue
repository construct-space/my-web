<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { login, verifyTwoFactor, loginWithPasskey } from '../composables/useAuth'
import ConstructLogo from '../components/ConstructLogo.vue'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

// step drives which form is visible — password first, then 2FA if needed.
const step = ref<'password' | '2fa'>('password')
const submitting = ref(false)
const error = ref<string | null>(null)

const email = ref('')
const password = ref('')
const code = ref('')
const pendingToken = ref('')

// Where to send the user after a successful login. Two query params are
// recognized so both direct callers (our own auth guard uses ?next=) and
// the OAuth redirect from accounts (which sends ?return_to=) funnel here
// without any caller needing to know the other's convention.
const nextUrl = computed(() => {
  const r = route.query.return_to
  if (typeof r === 'string' && r) return r
  const n = route.query.next
  return typeof n === 'string' && n ? n : '/'
})

async function afterAuth() {
  // Session cookie is now set on the my.lisaos.dev domain; refresh
  // our Pinia scope so the shell's gating logic sees the new identity
  // without a page reload.
  await session.refreshScope()
  router.replace(nextUrl.value)
}

async function submitPassword() {
  error.value = null
  if (!email.value.trim() || !password.value) {
    error.value = 'Email and password are required.'
    return
  }
  submitting.value = true
  const result = await login(email.value.trim(), password.value, nextUrl.value)
  submitting.value = false

  switch (result.status) {
    case 'ok':
      await afterAuth()
      return
    case '2fa_required':
      pendingToken.value = result.pendingToken
      step.value = '2fa'
      return
    case 'password_change_required':
      router.replace({ path: '/reset-password', query: { token: result.resetToken, next: nextUrl.value } })
      return
    case 'error':
      error.value = result.message
  }
}

async function submit2FA() {
  error.value = null
  if (!code.value.trim()) {
    error.value = 'Enter the 6-digit code from your authenticator.'
    return
  }
  submitting.value = true
  const result = await verifyTwoFactor(pendingToken.value, code.value.trim(), nextUrl.value)
  submitting.value = false
  if (result.status === 'ok') {
    await afterAuth()
  } else {
    error.value = result.message
  }
}

async function signInWithPasskey() {
  error.value = null
  submitting.value = true
  const result = await loginWithPasskey()
  submitting.value = false
  if (result.status === 'ok') {
    await afterAuth()
  } else {
    error.value = result.message
  }
}

function back() {
  error.value = null
  code.value = ''
  step.value = 'password'
}
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6 bg-[var(--app-canvas-bg)]">
    <div class="w-full max-w-[420px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-7 flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <ConstructLogo :size="26" />
        <div class="text-lg font-semibold">Construct</div>
      </div>

      <!-- Password step -->
      <template v-if="step === 'password'">
        <div>
          <h1 class="text-xl font-semibold">Sign in</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1">Welcome back.</p>
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="submitPassword">
          <Input v-model="email" type="email" placeholder="Email" autocomplete="email" :disabled="submitting" autofocus />
          <InputPassword v-model="password" autocomplete="current-password" :disabled="submitting" />
          <Button type="submit" size="lg" block :loading="submitting" :disabled="submitting">
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </Button>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </form>

        <div class="relative flex items-center gap-3 text-xs text-[var(--app-muted)] uppercase tracking-wider">
          <div class="flex-1 h-px bg-[var(--app-border)]" />
          or
          <div class="flex-1 h-px bg-[var(--app-border)]" />
        </div>

        <Button variant="outline" color="neutral" size="lg" block icon="lucide:key-round" :disabled="submitting" @click="signInWithPasskey">
          Sign in with passkey
        </Button>

        <div class="flex justify-between text-sm text-[var(--app-muted)]">
          <RouterLink to="/forgot-password" class="hover:text-[var(--app-foreground)]">Forgot password?</RouterLink>
          <RouterLink to="/register" class="hover:text-[var(--app-foreground)]">Create account</RouterLink>
        </div>
      </template>

      <!-- 2FA step -->
      <template v-else>
        <div>
          <h1 class="text-xl font-semibold">Two-factor verification</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1">Enter the 6-digit code from your authenticator app.</p>
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="submit2FA">
          <Input
            v-model="code"
            type="text"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength="6"
            autocomplete="one-time-code"
            placeholder="123456"
            :disabled="submitting"
            autofocus
          />
          <Button type="submit" :loading="submitting" :disabled="submitting">
            {{ submitting ? 'Verifying…' : 'Verify' }}
          </Button>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </form>

        <button
          class="text-sm text-[var(--app-muted)] hover:text-[var(--app-foreground)] text-left"
          :disabled="submitting"
          @click="back"
        >← Back to sign in</button>
      </template>
    </div>
  </div>
</template>
