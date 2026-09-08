<script setup lang="ts">
/**
 * Progress - Bar and circle progress indicator
 * Supports: bar (horizontal) and circle (SVG) variants
 * Indeterminate mode for unknown progress
 */

const props = withDefaults(defineProps<{
  value?: number
  max?: number
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  indeterminate?: boolean
  label?: boolean
  variant?: 'bar' | 'circle'
}>(), {
  value: 0,
  max: 100,
  size: 'md',
  indeterminate: false,
  label: false,
  variant: 'bar',
})

const percentage = computed(() => {
  if (props.indeterminate) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})

const barHeight = computed(() => {
  const map: Record<string, string> = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }
  return map[props.size]
})

const accentColor = computed(() => {
  return props.color || 'var(--app-accent)'
})

// Circle variant sizing
const circleSize = computed(() => {
  const map: Record<string, number> = { xs: 32, sm: 48, md: 64, lg: 96 }
  return map[props.size]
})

const strokeWidth = computed(() => {
  const map: Record<string, number> = { xs: 3, sm: 4, md: 5, lg: 6 }
  return map[props.size]
})

const circleRadius = computed(() => {
  return (circleSize.value - strokeWidth.value) / 2
})

const circumference = computed(() => {
  return 2 * Math.PI * circleRadius.value
})

const strokeDashoffset = computed(() => {
  if (props.indeterminate) return circumference.value * 0.75
  return circumference.value - (percentage.value / 100) * circumference.value
})

const labelFontSize = computed(() => {
  const map: Record<string, string> = { xs: 'text-[8px]', sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  return map[props.size]
})

const indeterminateBarStyle = computed(() => ({
  width: '40%',
  backgroundColor: accentColor.value,
  animation: 'cui-progress-indeterminate 1.5s ease-in-out infinite',
}))

const barFillStyle = computed(() => ({
  width: `${percentage.value}%`,
  backgroundColor: accentColor.value,
}))

// Inject keyframes on mount (once)
const injected = ref(false)
onMounted(() => {
  if (injected.value) return
  if (typeof document === 'undefined') return
  if (document.getElementById('cui-progress-keyframes')) { injected.value = true; return }
  const style = document.createElement('style')
  style.id = 'cui-progress-keyframes'
  style.textContent = `@keyframes cui-progress-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`
  document.head.appendChild(style)
  injected.value = true
})
</script>

<template>
  <!-- Bar variant -->
  <div v-if="variant === 'bar'" class="w-full">
    <div
      :class="[
        'w-full rounded-full bg-[var(--app-border)] overflow-hidden',
        barHeight,
      ]"
    >
      <div
        :class="['h-full rounded-full transition-all duration-500 ease-out']"
        :style="indeterminate ? indeterminateBarStyle : barFillStyle"
      />
    </div>
    <div
      v-if="label && !indeterminate"
      class="mt-1 text-xs text-[var(--app-muted)] text-right"
    >
      {{ Math.round(percentage) }}%
    </div>
  </div>

  <!-- Circle variant -->
  <div
    v-else
    class="relative inline-flex items-center justify-center"
    :style="{ width: `${circleSize}px`, height: `${circleSize}px` }"
  >
    <svg
      :width="circleSize"
      :height="circleSize"
      :class="{ 'animate-spin': indeterminate }"
      class="-rotate-90"
    >
      <!-- Background circle -->
      <circle
        :cx="circleSize / 2"
        :cy="circleSize / 2"
        :r="circleRadius"
        fill="none"
        stroke="var(--app-border)"
        :stroke-width="strokeWidth"
      />
      <!-- Progress circle -->
      <circle
        :cx="circleSize / 2"
        :cy="circleSize / 2"
        :r="circleRadius"
        fill="none"
        :stroke="accentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        class="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
    <div
      v-if="label && !indeterminate"
      :class="[
        'absolute inset-0 flex items-center justify-center text-[var(--app-foreground)] font-medium',
        labelFontSize,
      ]"
    >
      {{ Math.round(percentage) }}%
    </div>
  </div>
</template>
