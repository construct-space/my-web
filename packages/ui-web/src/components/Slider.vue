<script setup lang="ts">
/**
 * Slider - Plain implementation (no reka-ui)
 */
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
}>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const trackRef = ref<HTMLElement | null>(null)
const dragging = ref(false)

const percentage = computed(() => {
  const range = props.max - props.min
  if (range === 0) return 0
  return ((props.modelValue - props.min) / range) * 100
})

const trackHeight = computed(() => {
  if (props.size === 'xs') return 'h-1'
  if (props.size === 'sm') return 'h-1.5'
  return 'h-2'
})

const thumbSize = computed(() => {
  if (props.size === 'xs') return 'size-3'
  if (props.size === 'sm') return 'size-3.5'
  return 'size-4'
})

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

function snapToStep(val: number) {
  const steps = Math.round((val - props.min) / props.step)
  return clamp(props.min + steps * props.step, props.min, props.max)
}

function updateFromEvent(e: MouseEvent | TouchEvent) {
  if (!trackRef.value || props.disabled) return
  const rect = trackRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
  const raw = props.min + ratio * (props.max - props.min)
  emit('update:modelValue', snapToStep(raw))
}

function onPointerDown(e: MouseEvent) {
  if (props.disabled) return
  dragging.value = true
  updateFromEvent(e)
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
}

function onPointerMove(e: MouseEvent) {
  if (dragging.value) updateFromEvent(e)
}

function onPointerUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
}
</script>

<template>
  <div
    ref="trackRef"
    class="relative flex items-center w-full select-none touch-none"
    :class="disabled ? 'opacity-50' : 'cursor-pointer'"
    @mousedown="onPointerDown"
  >
    <div :class="['relative grow rounded-full bg-[var(--app-border)]', trackHeight]">
      <div
        class="absolute h-full rounded-full bg-app-accent"
        :style="{ width: percentage + '%' }"
      />
    </div>
    <div
      :class="[
        'absolute block rounded-full bg-white border-2 border-app-accent shadow-sm -translate-x-1/2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent',
        thumbSize,
      ]"
      :style="{ left: percentage + '%' }"
      tabindex="0"
      role="slider"
      :aria-valuenow="modelValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
    />
  </div>
</template>
