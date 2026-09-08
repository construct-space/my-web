<script setup lang="ts">
/**
 * DropdownMenu - Nuxt UI v3 compatible dropdown menu
 * Accepts items array with { label, icon, description, onSelect, type }
 */
import { Icon } from '@iconify/vue'

export interface UDropdownItem {
  label?: string
  icon?: string
  description?: string
  type?: 'separator' | 'label'
  disabled?: boolean
  color?: string
  click?: () => void
  onSelect?: () => void
}

const props = withDefaults(defineProps<{
  items?: UDropdownItem[] | UDropdownItem[][]
  content?: { side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end'; sideOffset?: number }
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

// Normalize items: support both flat array and grouped arrays
const normalizedItems = computed(() => {
  if (!props.items?.length) return []
  if (Array.isArray(props.items[0]) && Array.isArray(props.items[0])) {
    // Grouped: [[item, item], [item, item]]
    const groups = props.items as UDropdownItem[][]
    const result: UDropdownItem[] = []
    groups.forEach((group, gi) => {
      if (gi > 0) result.push({ type: 'separator' })
      result.push(...group)
    })
    return result
  }
  return props.items as UDropdownItem[]
})

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const contentStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

function positionContent() {
  nextTick(() => {
    const triggerEl = triggerRef.value
    const contentEl = contentRef.value
    if (!triggerEl || !contentEl) return
    const rect = triggerEl.getBoundingClientRect()
    const contentRect = contentEl.getBoundingClientRect()
    const side = props.content?.side || 'bottom'
    const align = props.content?.align || 'start'
    const offset = props.content?.sideOffset || 4

    let top = 0
    let left = 0

    if (side === 'bottom') {
      top = rect.bottom + offset
      if (top + contentRect.height > window.innerHeight - 8) {
        top = rect.top - contentRect.height - offset
      }
    } else if (side === 'top') {
      top = rect.top - contentRect.height - offset
      if (top < 8) {
        top = rect.bottom + offset
      }
    } else if (side === 'left') {
      left = rect.left - contentRect.width - offset
      top = rect.top
    } else if (side === 'right') {
      left = rect.right + offset
      top = rect.top
    }

    if (side === 'bottom' || side === 'top') {
      if (align === 'start') left = rect.left
      else if (align === 'center') left = rect.left + rect.width / 2 - contentRect.width / 2
      else left = rect.right - contentRect.width
    }

    if (left + contentRect.width > window.innerWidth - 8) {
      left = window.innerWidth - contentRect.width - 8
    }
    if (left < 8) left = 8

    contentStyle.value = { top: `${top}px`, left: `${left}px` }
  })
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    positionContent()
    nextTick(() => {
      document.addEventListener('mousedown', onClickOutside)
      document.addEventListener('keydown', onEscape)
    })
  } else {
    cleanup()
  }
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
  if (triggerRef.value?.contains(e.target as Node)) return
  if (contentRef.value?.contains(e.target as Node)) return
  close()
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function onItemClick(item: UDropdownItem) {
  if (item.disabled) return
  ;(item.onSelect || item.click)?.()
  close()
}

onUnmounted(cleanup)
</script>

<template>
  <div ref="triggerRef" class="inline-flex" @click="toggle">
    <slot />
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="contentRef"
      :style="{ position: 'fixed', ...contentStyle }"
      class="z-[100] min-w-40 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] p-1 shadow-xl animate-in fade-in-0 zoom-in-95"
    >
      <template v-for="(item, index) in normalizedItems" :key="index">
        <div
          v-if="item.type === 'separator'"
          class="my-1 h-px bg-[var(--app-border)]"
        />
        <div
          v-else-if="item.type === 'label'"
          class="px-2 py-1.5 text-xs font-semibold text-[var(--app-muted)]"
        >
          {{ item.label }}
        </div>
        <div
          v-else
          :class="[
            'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--app-foreground)] outline-none cursor-pointer select-none',
            'hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] hover:text-[var(--app-accent)]',
            item.disabled ? 'pointer-events-none opacity-50' : '',
          ]"
          @click="onItemClick(item)"
        >
          <Icon v-if="item.icon" :icon="toIconify(item.icon)" class="size-4 shrink-0 text-[var(--app-muted)]" />
          <div class="flex-1">
            <div>{{ item.label }}</div>
            <div v-if="item.description" class="text-xs text-[var(--app-muted)]">{{ item.description }}</div>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>
