<script setup lang="ts">
/**
 * Switch — Construct UI
 * Toggle switch with size variants. Pure Tailwind, no scoped CSS.
 */
const props = withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
}>(), {
  modelValue: false,
  label: '',
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const sizeConfig = {
  xs: { trackWidth: '28px', trackHeight: '16px', thumbSize: '12px', thumbOffset: '12px' },
  sm: { trackWidth: '32px', trackHeight: '18px', thumbSize: '14px', thumbOffset: '14px' },
  md: { trackWidth: '40px', trackHeight: '20px', thumbSize: '16px', thumbOffset: '20px' },
} as const

const currentSize = computed(() => sizeConfig[props.size])

const trackStyle = computed(() => ({
  width: currentSize.value.trackWidth,
  height: currentSize.value.trackHeight,
}))

const thumbStyle = computed(() => ({
  width: currentSize.value.thumbSize,
  height: currentSize.value.thumbSize,
  transform: props.modelValue
    ? `translate(${currentSize.value.thumbOffset}, -50%)`
    : 'translate(0, -50%)',
}))

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label
    class="inline-flex items-center gap-2 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
    @click.prevent="toggle"
  >
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :data-state="modelValue ? 'checked' : 'unchecked'"
      :disabled="disabled"
      class="relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/35"
      :class="[
        modelValue ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      ]"
      :style="trackStyle"
      @click.stop="toggle"
    >
      <span
        class="absolute top-1/2 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
        :style="thumbStyle"
      />
    </button>
    <span v-if="label" class="text-sm text-[var(--app-foreground)]">{{ label }}</span>
    <slot />
  </label>
</template>
