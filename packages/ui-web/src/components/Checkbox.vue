<script setup lang="ts">
/**
 * Checkbox - Plain implementation (no reka-ui)
 */
withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
  color?: string
}>(), {
  modelValue: false,
  label: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label class="inline-flex items-center gap-2 cursor-pointer" :class="disabled ? 'opacity-50 cursor-not-allowed' : ''">
    <span
      class="relative size-4 shrink-0 rounded border transition-colors focus-within:ring-2 focus-within:ring-app-accent"
      :class="modelValue ? 'bg-app-accent border-app-accent' : 'border-[var(--app-border)] bg-[var(--app-background)]'"
    >
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <svg
        v-if="modelValue"
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="absolute inset-0 m-auto text-app-accent-foreground"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
    <span v-if="label" class="text-sm text-[var(--app-foreground)]">{{ label }}</span>
    <slot />
  </label>
</template>
