<script setup lang="ts">
/**
 * Popover - Nuxt UI v3 compatible popover
 */

const props = withDefaults(defineProps<{
  open?: boolean
  content?: { side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end'; sideOffset?: number }
}>(), {
  open: undefined,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const internalOpen = ref(false)

const isOpen = computed({
  get: () => props.open !== undefined ? props.open : internalOpen.value,
  set: (val: boolean) => {
    internalOpen.value = val
    emit('update:open', val)
  },
})

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
    const align = props.content?.align || 'center'
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

// Watch for external open prop changes
watch(() => props.open, (val) => {
  if (val !== undefined) {
    if (val) {
      positionContent()
      nextTick(() => {
        document.addEventListener('mousedown', onClickOutside)
        document.addEventListener('keydown', onEscape)
      })
    } else {
      cleanup()
    }
  }
})

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
      class="z-[100] min-w-48 rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] shadow-xl animate-in fade-in-0 zoom-in-95"
    >
      <slot name="content" />
    </div>
  </Teleport>
</template>
