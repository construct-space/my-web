<script setup lang="ts">
/**
 * SidebarLayout - 60px icon sidebar used by billing, delivery, and other infra services.
 */
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

function toIconify(name: string): string {
  if (name.includes(':')) return name
  if (name.startsWith('lucide-')) return name.replace('-', ':')
  return `lucide:${name}`
}

export interface NavItem {
  icon: string
  label: string
  to: string
  active?: boolean
}

const props = withDefaults(defineProps<{
  navItems?: NavItem[]
  serviceName?: string
  serviceIcon?: string
  userName?: string
  userAvatar?: string
  accentColor?: string
}>(), {
  navItems: () => [],
  serviceName: '',
  serviceIcon: '',
  userName: '',
  userAvatar: '',
  accentColor: '#FF2D55',
})

const emit = defineEmits<{
  (e: 'navigate', to: string): void
  (e: 'logout'): void
}>()

const showUserMenu = ref(false)
const hoveredNav = ref<string | null>(null)

const initials = computed(() => {
  if (!props.userName) return '?'
  return props.userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="w-[60px] bg-[var(--app-background)] border-r border-[var(--app-border)] flex flex-col items-center py-4 fixed top-0 left-0 bottom-0 z-[100]">
      <!-- Logo -->
      <div class="mb-6 text-xl font-bold text-[var(--app-foreground)]">
        <slot name="logo">
          <span v-if="serviceIcon">{{ serviceIcon }}</span>
          <span v-else class="flex items-center justify-center size-8">C</span>
        </slot>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 flex flex-col items-center gap-1">
        <div
          v-for="item in navItems"
          :key="item.to"
          class="relative size-10 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-150"
          :class="item.active
            ? 'text-[var(--app-accent)] bg-white/[0.06]'
            : 'text-[var(--app-muted)] hover:bg-white/[0.06] hover:text-[var(--app-foreground)]'"
          @click="emit('navigate', item.to)"
          @mouseenter="hoveredNav = item.to"
          @mouseleave="hoveredNav = null"
        >
          <Icon :icon="toIconify(item.icon)" width="20" height="20" />
          <div v-if="hoveredNav === item.to" class="absolute left-[52px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--app-foreground)] text-[var(--app-background)] text-xs font-medium rounded-md whitespace-nowrap pointer-events-none z-[200]">
            {{ item.label }}
          </div>
        </div>
      </nav>

      <!-- User -->
      <div class="relative">
        <div
          class="size-8 rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer overflow-hidden"
          :style="{ background: accentColor }"
          @click="showUserMenu = !showUserMenu"
        >
          <img v-if="userAvatar" :src="userAvatar" :alt="userName" class="w-full h-full object-cover" />
          <span v-else>{{ initials }}</span>
        </div>
        <div v-if="showUserMenu" class="absolute left-[52px] bottom-0 bg-[var(--app-background)] border border-[var(--app-border)] rounded-lg min-w-[160px] p-1 z-[200]">
          <slot name="user-menu">
            <div class="px-3 py-2 text-[13px] text-[var(--app-foreground)] cursor-pointer rounded-md transition-colors duration-150 hover:bg-white/[0.06]" @click="emit('logout')">
              Sign out
            </div>
          </slot>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 ml-[60px] min-h-screen">
      <slot />
    </main>
  </div>
</template>
