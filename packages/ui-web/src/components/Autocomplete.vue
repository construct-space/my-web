<script setup lang="ts">
/**
 * Autocomplete — Construct UI
 * Input with dropdown suggestions, searchable.
 */
import { Icon } from '@iconify/vue'

export interface AutocompleteOption {
  label: string
  value: string | number
  disabled?: boolean
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  options?: AutocompleteOption[] | string[]
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  icon?: string
  emptyText?: string
  clearable?: boolean
}>(), {
  modelValue: null,
  options: () => [],
  placeholder: 'Search...',
  size: 'md',
  disabled: false,
  emptyText: 'No results',
  clearable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const query = ref('')
const open = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const highlightIndex = ref(-1)

function getNormalizedOptions(): AutocompleteOption[] {
  return (props.options ?? []).map(opt =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt as AutocompleteOption
  )
}

function getFilteredOptions(): AutocompleteOption[] {
  const q = query.value.toLowerCase().trim()
  const options = getNormalizedOptions()
  if (!q) return options
  return options.filter(o => o.label.toLowerCase().includes(q))
}

function getSelectedLabel(): string {
  if (props.modelValue == null) return ''
  const opt = getNormalizedOptions().find(o => o.value === props.modelValue)
  return opt?.label ?? String(props.modelValue)
}

function onFocus() {
  open.value = true
  query.value = ''
  highlightIndex.value = -1
}

function onBlur() {
  setTimeout(() => { open.value = false }, 150)
}

function select(opt: AutocompleteOption) {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  query.value = ''
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
}

function onKeydown(e: KeyboardEvent) {
  const filteredOptions = getFilteredOptions()
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, filteredOptions.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  } else if (e.key === 'Enter' && highlightIndex.value >= 0) {
    e.preventDefault()
    const option = filteredOptions[highlightIndex.value]
    if (option) select(option)
  } else if (e.key === 'Escape') {
    open.value = false
    inputRef.value?.blur()
  }
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
}

const sizeClasses: Record<string, string> = {
  xs: 'py-0.5 text-xs',
  sm: 'py-1 text-xs',
  md: 'py-1.5 text-sm',
  lg: 'py-2 text-base',
}
</script>

<template>
  <div class="relative w-full">
    <div
      class="relative inline-flex items-center w-full rounded-md border transition-colors duration-150 overflow-hidden"
      :class="[
        'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-background)_80%,var(--app-canvas-bg)_20%)]',
        open ? 'border-[var(--app-accent)]' : 'hover:border-[var(--app-muted)]/50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
    >
      <Icon v-if="icon" :icon="icon" class="ml-2 shrink-0 size-3.5 text-[var(--app-muted)] pointer-events-none" />
      <input
        ref="inputRef"
        :class="['flex-1 min-w-0 bg-transparent text-[var(--app-foreground)] outline-none placeholder:text-[var(--app-muted)]/50 px-2.5', sizeClasses[size]]"
        :value="open ? query : getSelectedLabel()"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button v-if="clearable && modelValue != null" class="mr-1 p-0.5 rounded text-[var(--app-muted)] hover:text-[var(--app-foreground)]" @mousedown.prevent="clear">
        <Icon icon="lucide:x" class="size-3" />
      </button>
      <Icon icon="lucide:chevron-down" class="mr-2 size-3 text-[var(--app-muted)] pointer-events-none transition-transform" :class="open ? 'rotate-180' : ''" />
    </div>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="open" class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg">
        <div
          v-for="(opt, i) in getFilteredOptions()"
          :key="String(opt.value)"
          class="px-3 py-1.5 text-sm cursor-pointer transition-colors"
          :class="[
            opt.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)]',
            i === highlightIndex ? 'bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)]' : '',
            opt.value === modelValue ? 'text-[var(--app-accent)]' : 'text-[var(--app-foreground)]',
          ]"
          @mousedown.prevent="select(opt)"
        >
          {{ opt.label }}
        </div>
        <div v-if="getFilteredOptions().length === 0" class="px-3 py-3 text-xs text-[var(--app-muted)] text-center">{{ emptyText }}</div>
      </div>
    </Transition>
  </div>
</template>
