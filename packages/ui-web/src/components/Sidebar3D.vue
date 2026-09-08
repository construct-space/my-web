<script setup lang="ts">
/**
 * Sidebar3D — Construct UI
 * 3D rotating dock sidebar with front + side panel.
 * 72px wide, CSS 3D cube rotation on space enter/exit.
 */

export interface SidebarItem {
  id: string
  icon: string
  label: string
  to?: string
  active?: boolean
  badge?: string | number
  color?: string
}

export interface SidebarSection {
  items: SidebarItem[]
  separator?: boolean
}

const props = withDefaults(defineProps<{
  sections?: SidebarSection[]
  sideItems?: SidebarItem[]
  sideBackLabel?: string
  rotated?: boolean
  logoIcon?: string
  avatar?: string
  avatarActive?: boolean
}>(), {
  sections: () => [],
  sideItems: () => [],
  sideBackLabel: 'Back',
  rotated: false,
  avatar: '',
  avatarActive: false,
})

const emit = defineEmits<{
  'item-click': [item: SidebarItem]
  'back': []
  'logo-click': []
  'avatar-click': []
}>()

function sidebarBtnClass(active?: boolean): string {
  const base = 'flex items-center justify-center size-[42px] rounded-[10px] cursor-pointer transition-all duration-150 border-none'
  if (active) return `${base} bg-[color-mix(in_srgb,var(--item-color,var(--app-accent))_15%,transparent)] text-[var(--item-color,var(--app-accent))]`
  return `${base} bg-transparent text-[var(--app-muted)] hover:bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)] hover:text-[var(--app-foreground)]`
}
</script>

<template>
  <aside class="w-[72px] flex flex-col items-center shrink-0 z-50 bg-transparent backdrop-blur-md border-r border-[var(--app-border)]">
    <!-- Logo -->
    <div class="pt-12 pb-2 shrink-0 cursor-pointer" @click="emit('logo-click')">
      <slot name="logo">
        <div class="size-8 rounded-lg flex items-center justify-center text-[var(--app-accent)]">
          <slot name="logo-icon" />
        </div>
      </slot>
    </div>

    <!-- 3D Cube Container -->
    <div class="flex-1 w-full overflow-hidden" style="perspective: 800px">
      <div
        class="relative w-full h-full transition-transform duration-500 ease-out"
        :style="{
          transformStyle: 'preserve-3d',
          transform: rotated ? 'rotateY(-90deg)' : 'rotateY(0deg)',
        }"
      >
        <!-- Front Face: Main nav -->
        <div
          class="absolute inset-0 w-full h-full flex flex-col items-center gap-1 pt-2 overflow-y-auto"
          :style="{ backfaceVisibility: 'hidden', transform: 'translateZ(36px)' }"
        >
          <template v-for="(section, si) in sections" :key="si">
            <div v-if="section.separator && si > 0" class="w-8 border-t border-[var(--app-border)] my-1" />
            <button
              v-for="item in section.items"
              :key="item.id"
              :class="sidebarBtnClass(item.active)"
              :style="item.active && item.color ? `--item-color: ${item.color}` : ''"
              :title="item.label"
              class="relative"
              @click="emit('item-click', item)"
            >
              <component :is="'Icon'" :name="item.icon" class="size-5" />
              <span v-if="item.badge" class="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-[var(--app-accent)] text-[9px] font-bold text-white flex items-center justify-center">
                {{ item.badge }}
              </span>
            </button>
          </template>
        </div>

        <!-- Right Face: Side panel (space sub-pages) -->
        <div
          class="absolute inset-0 w-full h-full flex flex-col items-center gap-1 pt-2"
          :style="{ backfaceVisibility: 'hidden', transform: 'rotateY(90deg) translateZ(36px)' }"
        >
          <!-- Back button -->
          <button
            :class="sidebarBtnClass(false)"
            class="mb-2"
            :title="sideBackLabel"
            @click="emit('back')"
          >
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>

          <button
            v-for="item in sideItems"
            :key="item.id"
            :class="sidebarBtnClass(item.active)"
            :title="item.label"
            @click="emit('item-click', item)"
          >
            <component :is="'Icon'" :name="item.icon" class="size-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom: Avatar -->
    <div class="pb-4 pt-2 shrink-0 flex flex-col items-center gap-2">
      <slot name="bottom" />
      <button
        v-if="avatar"
        class="size-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors"
        :class="avatarActive ? 'bg-[var(--app-accent)] text-white' : 'bg-[var(--app-border)] text-[var(--app-foreground)] hover:bg-[var(--app-muted)]/20'"
        @click="emit('avatar-click')"
      >
        {{ avatar }}
      </button>
    </div>
  </aside>
</template>
