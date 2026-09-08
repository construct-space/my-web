<script setup lang="ts">
export interface DropdownItem {
  label?: string
  icon?: string
  action?: () => void
  separator?: boolean
}

withDefaults(
  defineProps<{
    items?: DropdownItem[]
  }>(),
  {
    items: () => [],
  }
)

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
    let top = rect.bottom + 4
    let left = rect.left
    if (top + contentRect.height > window.innerHeight - 8) {
      top = rect.top - contentRect.height - 4
    }
    if (left + contentRect.width > window.innerWidth - 8) {
      left = window.innerWidth - contentRect.width - 8
    }
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

function onItemClick(item: DropdownItem) {
  item.action?.()
  close()
}

onUnmounted(cleanup)
</script>

<template>
  <div ref="triggerRef" class="inline-flex" @click="toggle">
    <slot name="trigger" />
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="contentRef"
      :style="{ position: 'fixed', ...contentStyle }"
      class="z-50 min-w-40 overflow-hidden rounded-md border border-(--app-border) bg-(--app-background) p-1 shadow-lg"
    >
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.separator" class="my-1 h-px bg-(--app-border)" />
        <div
          v-else
          class="relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-(--app-foreground) outline-none cursor-pointer select-none hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] hover:text-[var(--app-accent)]"
          @click="onItemClick(item)"
        >
          <component v-if="item.icon" :is="item.icon" class="h-4 w-4 text-[var(--app-muted)]" />
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>
