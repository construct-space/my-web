<script setup lang="ts">
/**
 * RadioGroup - Plain implementation (no reka-ui)
 */

export interface RadioOption {
  value: string
  label: string
  description?: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string
  options?: RadioOption[]
  orientation?: 'vertical' | 'horizontal'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'card'
  disabled?: boolean
}>(), {
  modelValue: '',
  options: () => [],
  orientation: 'vertical',
  size: 'md',
  variant: 'default',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const sizeClasses = {
  sm: {
    radio: 'size-3.5',
    dot: 'size-1.5',
    label: 'text-xs',
    description: 'text-[11px]',
    gap: 'gap-1.5',
    cardPadding: 'p-2',
  },
  md: {
    radio: 'size-4',
    dot: 'size-2',
    label: 'text-sm',
    description: 'text-xs',
    gap: 'gap-2',
    cardPadding: 'p-3',
  },
  lg: {
    radio: 'size-5',
    dot: 'size-2.5',
    label: 'text-base',
    description: 'text-sm',
    gap: 'gap-2.5',
    cardPadding: 'p-4',
  },
}

function select(value: string) {
  if (props.disabled) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    role="radiogroup"
    class="flex"
    :class="orientation === 'vertical' ? 'flex-col gap-2' : 'flex-row flex-wrap gap-3'"
  >
    <!-- Default variant -->
    <template v-if="variant === 'default'">
      <label
        v-for="option in options"
        :key="option.value"
        class="inline-flex items-start cursor-pointer"
        :class="[
          sizeClasses[size].gap,
          (option.disabled || disabled) ? 'opacity-50 cursor-not-allowed' : '',
        ]"
      >
        <span
          class="shrink-0 rounded-full border transition-colors flex items-center justify-center"
          :class="[
            sizeClasses[size].radio,
            modelValue === option.value
              ? 'border-[var(--app-accent)]'
              : 'border-[var(--app-border)] bg-[var(--app-background)]',
          ]"
        >
          <input
            type="radio"
            :name="'radio-group'"
            :value="option.value"
            :checked="modelValue === option.value"
            :disabled="option.disabled || disabled"
            class="sr-only"
            @change="select(option.value)"
          />
          <span
            v-if="modelValue === option.value"
            class="block rounded-full bg-[var(--app-accent)]"
            :class="sizeClasses[size].dot"
          />
        </span>
        <div class="flex flex-col">
          <span
            class="text-[var(--app-foreground)] leading-snug"
            :class="sizeClasses[size].label"
          >
            <component
              v-if="option.icon"
              :is="option.icon"
              class="inline-block h-4 w-4 mr-1 align-text-bottom"
            />
            {{ option.label }}
          </span>
          <span
            v-if="option.description"
            class="text-[var(--app-muted)] leading-snug mt-0.5"
            :class="sizeClasses[size].description"
          >
            {{ option.description }}
          </span>
        </div>
      </label>
    </template>

    <!-- Card variant -->
    <template v-if="variant === 'card'">
      <label
        v-for="option in options"
        :key="option.value"
        class="relative flex items-start rounded-lg border transition-colors cursor-pointer"
        :class="[
          sizeClasses[size].gap,
          sizeClasses[size].cardPadding,
          (option.disabled || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--app-accent)]/50',
          modelValue === option.value
            ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/5'
            : 'border-[var(--app-border)] bg-[var(--app-background)]',
        ]"
      >
        <span
          class="shrink-0 rounded-full border transition-colors flex items-center justify-center"
          :class="[
            sizeClasses[size].radio,
            modelValue === option.value
              ? 'border-[var(--app-accent)]'
              : 'border-[var(--app-border)] bg-[var(--app-background)]',
          ]"
        >
          <input
            type="radio"
            :name="'radio-group'"
            :value="option.value"
            :checked="modelValue === option.value"
            :disabled="option.disabled || disabled"
            class="sr-only"
            @change="select(option.value)"
          />
          <span
            v-if="modelValue === option.value"
            class="block rounded-full bg-[var(--app-accent)]"
            :class="sizeClasses[size].dot"
          />
        </span>
        <div class="flex flex-col min-w-0">
          <span
            class="text-[var(--app-foreground)] leading-snug font-medium"
            :class="sizeClasses[size].label"
          >
            <component
              v-if="option.icon"
              :is="option.icon"
              class="inline-block h-4 w-4 mr-1 align-text-bottom"
            />
            {{ option.label }}
          </span>
          <span
            v-if="option.description"
            class="text-[var(--app-muted)] leading-snug mt-0.5"
            :class="sizeClasses[size].description"
          >
            {{ option.description }}
          </span>
        </div>
      </label>
    </template>
  </div>
</template>
