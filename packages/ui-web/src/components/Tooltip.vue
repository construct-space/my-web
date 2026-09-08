<script setup lang="ts">
/**
 * Tooltip - Plain implementation (no reka-ui)
 */
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  content?: { side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end'; sideOffset?: number }
  popper?: { placement?: string }
}>(), {
  text: '',
})

const triggerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const show = ref(false)
const pos = ref({ top: '0px', left: '0px' })

function updatePosition() {
  if (!triggerRef.value || !tooltipRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const tip = tooltipRef.value.getBoundingClientRect()
  const side = props.content?.side || 'bottom'
  const offset = props.content?.sideOffset || 6

  let top = 0, left = 0
  switch (side) {
    case 'top':
      top = rect.top - tip.height - offset
      left = rect.left + rect.width / 2 - tip.width / 2
      break
    case 'bottom':
      top = rect.bottom + offset
      left = rect.left + rect.width / 2 - tip.width / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - tip.height / 2
      left = rect.left - tip.width - offset
      break
    case 'right':
      top = rect.top + rect.height / 2 - tip.height / 2
      left = rect.right + offset
      break
  }
  pos.value = { top: `${top}px`, left: `${left}px` }
}

async function onEnter() {
  show.value = true
  await nextTick()
  updatePosition()
}

function onLeave() {
  show.value = false
}
</script>

<template>
  <span ref="triggerRef" @mouseenter="onEnter" @mouseleave="onLeave" style="display: inline-flex">
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="show && text"
      ref="tooltipRef"
      class="pointer-events-none rounded-lg px-3 py-2 text-xs font-medium text-white shadow-lg max-w-[250px] text-center"
      style="position: fixed; z-index: 100; background-color: #4b4b4b"
      :style="pos"
    >
      {{ text }}
    </div>
  </Teleport>
</template>
