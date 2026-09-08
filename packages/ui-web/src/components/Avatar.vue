<script setup lang="ts">
/**
 * Avatar - Plain implementation (no reka-ui)
 */
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    fallback?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    src: '',
    alt: '',
    fallback: '',
    size: 'md',
  }
)

const sizeClasses: Record<string, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

const imgFailed = ref(false)

const classes = computed(() => {
  return [
    'inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden',
    sizeClasses[props.size],
  ]
})

function onError() {
  imgFailed.value = true
}
</script>

<template>
  <span :class="classes">
    <img
      v-if="src && !imgFailed"
      :src="src"
      :alt="alt"
      class="h-full w-full object-cover"
      @error="onError"
    />
    <span
      v-else
      class="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)] font-medium"
    >
      {{ fallback }}
    </span>
  </span>
</template>
