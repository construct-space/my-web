<script setup lang="ts">
/**
 * ContextMenu - Nuxt UI v3 compatible context menu
 */
import { Icon } from '@iconify/vue'

export interface ContextMenuOption {
  label?: string
  icon?: string
  type?: 'separator' | 'label'
  disabled?: boolean
  onSelect?: () => void
}

const props = withDefaults(defineProps<{
  items?: ContextMenuOption[] | ContextMenuOption[][]
}>(), {
  items: () => [],
})

function toIconify(name: string) {
  if (name.startsWith('i-')) {
    const stripped = name.slice(2)
    const idx = stripped.indexOf('-')
    if (idx > 0) return stripped.slice(0, idx) + ':' + stripped.slice(idx + 1)
    return stripped
  }
  return name
}

const normalizedItems = computed(() => {
  const raw = props.items
  if (!raw?.length) return []
  if (Array.isArray(raw[0]) && Array.isArray(raw[0])) {
    const groups = raw as ContextMenuOption[][]
    const result: ContextMenuOption[] = []
    groups.forEach((group, gi) => {
      if (gi > 0) result.push({ type: 'separator' })
      result.push(...group)
    })
    return result
  }
  return raw as ContextMenuOption[]
})

const isOpen = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

function onContextMenu(e: MouseEvent) {
  e.preventDefault()

  // Position at mouse coordinates
  let top = e.clientY
  let left = e.clientX

  isOpen.value = true

  nextTick(() => {
    const contentEl = contentRef.value
    if (contentEl) {
      const contentRect = contentEl.getBoundingClientRect()
      if (top + contentRect.height > window.innerHeight - 8) {
        top = window.innerHeight - contentRect.height - 8
      }
      if (left + contentRect.width > window.innerWidth - 8) {
        left = window.innerWidth - contentRect.width - 8
      }
    }
    menuStyle.value = { top: `${top}px`, left: `${left}px` }

    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
  })
}

function close() {
  isOpen.value = false
  cleanup()
}

function cleanup() {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onEscape)
}

function onClickOutside(e: MouseEvent) {
  if (contentRef.value?.contains(e.target as Node)) return
  close()
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function onItemClick(item: ContextMenuOption) {
  if (item.disabled) return
  item.onSelect?.()
  close()
}

onUnmounted(cleanup)
</script>

<template>
  <div @contextmenu="onContextMenu">
    <slot />
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="contentRef"
      :style="{ position: 'fixed', ...menuStyle }"
      class="z-[100] min-w-48 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] p-1 shadow-xl"
    >
      <template v-for="(item, index) in normalizedItems" :key="index">
        <div v-if="item.type === 'separator'" class="my-1 h-px bg-[var(--app-border)]" />
        <div
          v-else
          :class="[
            'relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--app-foreground)] outline-none cursor-pointer select-none',
            'hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] hover:text-[var(--app-accent)]',
            item.disabled ? 'pointer-events-none opacity-50' : '',
          ]"
          @click="onItemClick(item)"
        >
          <Icon v-if="item.icon" :icon="toIconify(item.icon)" class="size-4 shrink-0 text-[var(--app-muted)]" />
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>
