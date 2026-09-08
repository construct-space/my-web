<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSessionStore } from '@construct-space/infra-shell'
import Shell from './views/Shell.vue'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  // Try to rehydrate regardless of token presence — cookie-based auth
  // carries itself on the request; a 401 simply means "signed out".
  await session.refreshScope()
})

watchEffect(() => {
  const needsAuth = route.meta.requiresAuth === true
  if (needsAuth && session.scopeLoaded && !session.isAuthenticated) {
    router.replace({ name: 'login', query: { next: route.fullPath } })
  }
})
</script>

<template>
  <Shell v-if="session.scopeLoaded">
    <RouterView />
  </Shell>
  <div v-else class="loading">Loading…</div>
</template>

<style scoped>
.loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}
</style>
