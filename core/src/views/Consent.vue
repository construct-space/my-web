<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import ConstructLogo from '../components/ConstructLogo.vue'

const session = useSessionStore()
const route = useRoute()

// Query params forwarded from accounts' /oauth/authorize when it needs
// user consent: client info + the scopes being requested. The actual
// approve/deny POSTs back to accounts via the gateway, which then issues
// the code and redirects to the client's redirect_uri.
const clientId = computed(() => typeof route.query.client_id === 'string' ? route.query.client_id : '')
const clientName = computed(() => {
  const n = route.query.client_name
  return typeof n === 'string' && n ? n : clientId.value || 'Unknown application'
})
const scopes = computed<string[]>(() => {
  const s = route.query.scope
  if (typeof s !== 'string') return []
  return s.split(/\s+/).filter(Boolean)
})
const requestId = computed(() => typeof route.query.request_id === 'string' ? route.query.request_id : '')

const submitting = ref(false)
const error = ref<string | null>(null)

onMounted(() => {
  if (!clientId.value || !requestId.value) {
    error.value = 'Consent link is missing required parameters.'
  }
})

async function decide(approved: boolean) {
  if (!requestId.value) return
  error.value = null
  submitting.value = true
  const res = await fetch('/api/oauth/approve', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId.value, approved }),
  })
  submitting.value = false
  if (res.ok) {
    const data = (await res.json()) as { redirect_to?: string }
    if (data.redirect_to) {
      window.location.href = data.redirect_to
      return
    }
  }
  const text = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(text) as { error?: string; error_description?: string }
    error.value = parsed.error_description || parsed.error || `Request failed (${res.status})`
  } catch {
    error.value = text || `Request failed (${res.status})`
  }
}

const scopeLabels: Record<string, string> = {
  openid: 'Confirm your identity',
  profile: 'See your basic profile',
  email: 'See your email address',
  offline_access: 'Access on your behalf when you are offline',
}
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6 bg-[var(--app-canvas-bg)]">
    <div class="w-full max-w-[480px] rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-7 flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <ConstructLogo :size="26" />
        <div class="text-lg font-semibold">Construct</div>
      </div>

      <div>
        <h1 class="text-xl font-semibold">Authorize {{ clientName }}</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Signed in as <span class="text-[var(--app-foreground)]">{{ session.scope?.user?.email || 'you' }}</span>.
        </p>
      </div>

      <div v-if="scopes.length" class="flex flex-col gap-2">
        <div class="text-xs uppercase tracking-wider text-[var(--app-muted)]">This app will be able to</div>
        <ul class="flex flex-col gap-1.5">
          <li v-for="s in scopes" :key="s" class="flex items-center gap-2 text-sm">
            <Icon icon="lucide:check" class="size-4 text-[var(--app-accent)]" />
            <span>{{ scopeLabels[s] || s }}</span>
          </li>
        </ul>
      </div>

      <div class="flex gap-2">
        <Button variant="outline" color="neutral" block :disabled="submitting" @click="decide(false)">Cancel</Button>
        <Button block :loading="submitting" :disabled="submitting" @click="decide(true)">
          {{ submitting ? 'Working…' : 'Authorize' }}
        </Button>
      </div>
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </div>
</template>
