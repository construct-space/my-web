<script setup lang="ts">
/**
 * ToggleGroup — Construct UI
 * Segmented control / button group for single or multi selection.
 */

export interface ToggleOption {
  label: string
  value: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | string[]
  options: ToggleOption[] | string[]
  multiple?: boolean
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
}>(), {
  modelValue: '',
  multiple: false,
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

function getOptions(): ToggleOption[] {
  return props.options.map(opt =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt as ToggleOption
  )
}

function isSelected(value: string): boolean {
  if (Array.isArray(props.modelValue)) return props.modelValue.includes(value)
  return props.modelValue === value
}

function toggle(value: string) {
  if (props.disabled) return

  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.indexOf(value)
    if (idx >= 0) current.splice(idx, 1)
    else current.push(value)
    emit('update:modelValue', current)
  } else {
    emit('update:modelValue', value)
  }
}

const sizeClasses: Record<string, string> = {
  xs: 'px-2 py-0.5 text-[11px]',
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
}
</script>

<template>
  <div
    class="inline-flex rounded-lg p-0.5 gap-0.5"
    style="background: color-mix(in srgb, var(--app-muted) 8%, transparent)"
  >
    <button
      v-for="opt in getOptions()"
      :key="opt.value"
      :class="[
        'rounded-md font-medium transition-colors cursor-pointer',
        sizeClasses[size],
        isSelected(opt.value)
          ? 'bg-[var(--app-accent)] text-white shadow-sm'
          : 'text-[var(--app-muted)] hover:text-[var(--app-foreground)]',
        opt.disabled || disabled ? 'opacity-40 cursor-not-allowed' : '',
      ]"
      :disabled="opt.disabled || disabled"
      @click="toggle(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
