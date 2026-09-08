<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { requestPasswordReset } from '../composables/useAuth'
import ConstructLogo from '../components/ConstructLogo.vue'

const email = ref('')
const submitting = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  if (!email.value.trim()) {
    error.value = 'Email is required.'
    return
  }
  submitting.value = true
  const result = await requestPasswordReset(email.value.trim())
  submitting.value = false
  if (result.status === 'ok') {
    // Accounts responds 200 even for unknown emails (prevents enumeration);
    // show the same success state either way.
    sent.value = true
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

      <template v-if="!sent">
        <div>
          <h1 class="text-xl font-semibold">Reset password</h1>
          <p class="text-sm text-[var(--app-muted)] mt-1">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <Input v-model="email" type="email" placeholder="Email" autocomplete="email" :disabled="submitting" autofocus />
          <Button type="submit" :loading="submitting" :disabled="submitting">
            {{ submitting ? 'Sending…' : 'Send reset link' }}
          </Button>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </form>
      </template>

      <template v-else>
        <div class="text-center">
          <Icon icon="lucide:mail-check" class="size-10 mx-auto text-[var(--app-accent)]" />
          <h1 class="text-xl font-semibold mt-3">Check your inbox</h1>
          <p class="text-sm text-[var(--app-muted)] mt-2">
            If an account exists for <span class="text-[var(--app-foreground)]">{{ email }}</span>, a reset link is on its way.
          </p>
        </div>
      </template>

      <RouterLink to="/login" class="text-sm text-[var(--app-muted)] hover:text-[var(--app-foreground)] text-center">
        ← Back to sign in
      </RouterLink>
    </div>
  </div>
</template>
