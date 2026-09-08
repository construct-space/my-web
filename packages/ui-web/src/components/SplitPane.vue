<script setup lang="ts">
const props = withDefaults(defineProps<{
  direction?: 'horizontal' | 'vertical'
  initialSize?: number
  minSize?: number
  maxSize?: number
  minPaneSizePx?: number
}>(), {
  direction: 'horizontal',
  initialSize: 50,
  minSize: 10,
  maxSize: 90,
  minPaneSizePx: 0,
})

const containerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const separatorPosition = ref(toRef(props, 'initialSize').value)

function startDrag(event: PointerEvent) {
  event.preventDefault()
  isDragging.value = true
  document.addEventListener('pointermove', onDrag)
  document.addEventListener('pointerup', stopDrag)
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

function onDrag(event: PointerEvent) {
  if (!isDragging.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const containerSize = props.direction === 'horizontal' ? rect.width : rect.height
  const containerStart = props.direction === 'horizontal' ? rect.left : rect.top
  const mousePos = props.direction === 'horizontal' ? event.clientX : event.clientY
  const relativePos = mousePos - containerStart

  let percentage = (relativePos / containerSize) * 100
  percentage = Math.min(Math.max(percentage, props.minSize), props.maxSize)

  if (props.minPaneSizePx > 0 && containerSize > 0) {
    const minPercent = (props.minPaneSizePx / containerSize) * 100
    const maxPercent = 100 - minPercent
    percentage = Math.min(Math.max(percentage, minPercent), maxPercent)
  }

  separatorPosition.value = percentage
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('pointermove', onDrag)
  document.removeEventListener('pointerup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function resetPosition() {
  separatorPosition.value = props.initialSize
}

onUnmounted(() => {
  document.removeEventListener('pointermove', onDrag)
  document.removeEventListener('pointerup', stopDrag)
})

const containerStyle = computed(() => ({
  display: 'flex',
  flexDirection: props.direction === 'horizontal' ? 'row' as const : 'column' as const,
  height: '100%',
  width: '100%',
  overflow: 'hidden',
}))

const firstPaneStyle = computed(() => {
  const size = `calc(${separatorPosition.value}% - 4px)`
  return props.direction === 'horizontal'
    ? { width: size, height: '100%', overflow: 'hidden', flexShrink: 0 }
    : { height: size, width: '100%', overflow: 'hidden', flexShrink: 0 }
})

const secondPaneStyle = computed(() => ({
  flex: 1,
  overflow: 'hidden',
  minWidth: 0,
  minHeight: 0,
}))
</script>

<template>
  <div ref="containerRef" class="relative" :style="containerStyle">
    <div :style="firstPaneStyle">
      <slot name="first" />
    </div>
    <div
      class="group shrink-0 flex items-center justify-center bg-transparent transition-colors duration-150"
      :class="[
        direction === 'horizontal' ? 'cursor-col-resize w-2 h-full' : 'cursor-row-resize h-2 w-full',
        isDragging ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]',
      ]"
      :style="{ flexShrink: 0, zIndex: 10 }"
      @pointerdown="startDrag"
      @dblclick="resetPosition"
    >
      <div
        class="rounded-sm transition-all duration-150"
        :class="[
          direction === 'horizontal' ? 'w-[3px] h-6' : 'w-6 h-[3px]',
          isDragging ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)] group-hover:bg-[var(--app-accent)]',
        ]"
      />
    </div>
    <div :style="secondPaneStyle">
      <slot name="second" />
    </div>
  </div>
</template>
