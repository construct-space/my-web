<script setup lang="ts">
/**
 * HeaderLayout - Top header bar layout used by domains and other public-facing services.
 */
import { computed } from 'vue'

export interface HeaderNavItem {
  label: string
  to: string
  active?: boolean
}

const props = withDefaults(defineProps<{
  serviceName?: string
  navItems?: HeaderNavItem[]
  userName?: string
  userAvatar?: string
  accentColor?: string
  showAuth?: boolean
}>(), {
  serviceName: '',
  navItems: () => [],
  userName: '',
  userAvatar: '',
  accentColor: '#FF2D55',
  showAuth: true,
})

const emit = defineEmits<{
  (e: 'navigate', to: string): void
  (e: 'login'): void
  (e: 'logout'): void
}>()

const initials = computed(() => {
  if (!props.userName) return '?'
  return props.userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-[var(--app-border)] py-3.5 sticky top-0 z-[100] bg-[color-mix(in_srgb,var(--app-background)_92%,transparent)] backdrop-blur-md">
      <div class="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <slot name="logo">
            <span class="text-base font-bold text-[var(--app-foreground)] cursor-pointer tracking-wide" @click="emit('navigate', '/')">
              construct <span class="text-[var(--app-muted)] font-normal">/ {{ serviceName }}</span>
            </span>
          </slot>
          <nav v-if="navItems.length" class="flex items-center gap-4">
            <a
              v-for="item in navItems"
              :key="item.to"
              class="text-[13px] no-underline cursor-pointer transition-colors duration-150"
              :class="item.active ? 'text-[var(--app-foreground)]' : 'text-[var(--app-muted)] hover:text-[var(--app-foreground)]'"
              @click.prevent="emit('navigate', item.to)"
            >
              {{ item.label }}
            </a>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <slot name="actions" />
          <div v-if="showAuth && userName" class="size-8 rounded-full flex items-center justify-center text-white text-[13px] font-semibold cursor-pointer overflow-hidden" :style="{ background: accentColor }" @click="emit('logout')">
            <img v-if="userAvatar" :src="userAvatar" :alt="userName" class="w-full h-full object-cover" />
            <span v-else>{{ initials }}</span>
          </div>
          <button v-else-if="showAuth" class="px-4 py-1.5 text-[13px] font-medium bg-[var(--app-accent)] text-white border-none rounded-md cursor-pointer transition-opacity duration-150 hover:opacity-90 font-[inherit]" @click="emit('login')">
            Sign in
          </button>
        </div>
      </div>
    </header>
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
