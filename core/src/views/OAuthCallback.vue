<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { exchangeCode } from '../composables/useOAuth'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const error = ref<string | null>(null)

onMounted(async () => {
  // Accounts may redirect back with an error instead of a code (user denied,
  // client misconfigured, etc.). Surface it immediately.
  if (typeof route.query.error === 'string') {
    error.value = typeof route.query.error_description === 'string'
      ? route.query.error_description
      : route.query.error
    return
  }

  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const state = typeof route.query.state === 'string' ? route.query.state : ''
  if (!code) {
    error.value = 'No authorization code in callback — the OAuth redirect is malformed.'
    return
  }

  try {
    const token = await exchangeCode(code, state)
    session.setTokens(token.access_token, null)
    await session.refreshScope()

    // Clean the code/state off the URL before routing so a refresh doesn't
    // try to redeem the code a second time.
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    router.replace(next)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6 bg-[var(--app-canvas-bg)]">
    <div class="w-full max-w-[420px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-7 flex flex-col gap-5 text-center">
      <Icon
        :icon="error ? 'lucide:alert-triangle' : 'lucide:loader-circle'"
        :class="['size-8 mx-auto', error ? 'text-red-500' : 'text-[var(--app-accent)] animate-spin']"
      />
      <div v-if="!error">
        <div class="text-lg font-semibold">Signing you in…</div>
        <p class="text-sm text-[var(--app-muted)] mt-1">Exchanging the authorization code.</p>
      </div>
      <div v-else>
        <div class="text-lg font-semibold">Sign-in failed</div>
        <p class="text-sm text-red-500 mt-2">{{ error }}</p>
        <button
          class="mt-4 text-sm text-[var(--app-accent)] hover:underline"
          @click="router.replace('/signin')"
        >Try again</button>
      </div>
    </div>
  </div>
</template>
