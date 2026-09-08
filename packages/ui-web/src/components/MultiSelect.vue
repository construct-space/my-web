<script setup lang="ts">
/**
 * MultiSelect — Construct UI
 * Select multiple items with chips display and search.
 */
import { Icon } from '@iconify/vue'

export interface MultiSelectOption {
  label: string
  value: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string[]
  options?: MultiSelectOption[] | string[]
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  searchable?: boolean
  max?: number
}>(), {
  modelValue: () => [],
  options: () => [],
  placeholder: 'Select...',
  size: 'md',
  disabled: false,
  searchable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const query = ref('')
const highlightIndex = ref(-1)
const searchInputRef = ref<HTMLInputElement | null>(null)

const normalizedOptions = computed<MultiSelectOption[]>(() =>
  (props.options ?? []).map(opt =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt as MultiSelectOption
  )
)

const filteredOptions = computed<MultiSelectOption[]>(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return normalizedOptions.value
  return normalizedOptions.value.filter(o => o.label.toLowerCase().includes(q))
})

const selectedItems = computed(() => {
  return (props.modelValue ?? []).map(v => {
    const opt = normalizedOptions.value.find(o => o.value === v)
    return { value: v, label: opt?.label ?? v }
  })
})

function isSelected(value: string): boolean {
  return (props.modelValue ?? []).includes(value)
}

function toggleOption(opt: MultiSelectOption) {
  if (opt.disabled || props.disabled) return
  const current = [...(props.modelValue ?? [])]
  const idx = current.indexOf(opt.value)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    if (props.max && current.length >= props.max) return
    current.push(opt.value)
  }
  emit('update:modelValue', current)
}

function removeChip(value: string) {
  emit('update:modelValue', (props.modelValue ?? []).filter(v => v !== value))
}

function onBlur() {
  // Delay so clicks on option rows register before we close.
  setTimeout(() => {
    open.value = false
    query.value = ''
    highlightIndex.value = -1
  }, 150)
}

function openMenu() {
  if (props.disabled) return
  open.value = true
  nextTick(() => searchInputRef.value?.focus())
}

function onFocus() {
  if (!props.disabled) open.value = true
}

function onKeydown(e: KeyboardEvent) {
  const opts = filteredOptions.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) { open.value = true; return }
    highlightIndex.value = Math.min(highlightIndex.value + 1, opts.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    if (highlightIndex.value >= 0 && opts[highlightIndex.value]) {
      e.preventDefault()
      toggleOption(opts[highlightIndex.value])
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    searchInputRef.value?.blur()
  } else if (e.key === 'Backspace' && query.value === '' && selectedItems.value.length > 0) {
    // Convenience: backspace on empty query removes last chip.
    const last = selectedItems.value[selectedItems.value.length - 1]
    if (last) removeChip(last.value)
  }
}

// Reset highlight whenever the filtered set changes.
watch(filteredOptions, () => { highlightIndex.value = -1 })

const sizeClasses: Record<string, string> = { xs: 'text-xs', sm: 'text-xs', md: 'text-sm', lg: 'text-base' }
</script>

<template>
  <div class="relative w-full">
    <div
      class="flex flex-wrap items-center gap-1 min-h-[34px] px-2 py-1 rounded-md border transition-colors cursor-text"
      :class="[
        'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-background)_80%,var(--app-canvas-bg)_20%)]',
        open ? 'border-[var(--app-accent)]' : 'hover:border-[var(--app-muted)]/50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @click="openMenu"
    >
      <!-- Chips -->
      <span
        v-for="item in selectedItems"
        :key="item.value"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]"
      >
        {{ item.label }}
        <button class="hover:text-[var(--app-foreground)]" @click.stop="removeChip(item.value)">
          <Icon icon="lucide:x" class="size-2.5" />
        </button>
      </span>

      <!-- Search input: always visible when searchable. -->
      <input
        v-if="searchable"
        ref="searchInputRef"
        v-model="query"
        :class="['flex-1 min-w-[60px] bg-transparent outline-none text-[var(--app-foreground)] placeholder:text-[var(--app-muted)]/50', sizeClasses[size]]"
        :placeholder="modelValue?.length ? '' : placeholder"
        :disabled="disabled"
        @blur="onBlur"
        @focus="onFocus"
        @keydown="onKeydown"
      />
      <span v-else-if="!modelValue?.length" :class="['text-[var(--app-muted)]/50', sizeClasses[size]]">{{ placeholder }}</span>

      <Icon icon="lucide:chevron-down" class="ml-auto shrink-0 size-3 text-[var(--app-muted)]" />
    </div>

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="open" class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg">
        <div
          v-for="(opt, i) in filteredOptions"
          :key="opt.value"
          class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors"
          :class="[
            opt.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)]',
            i === highlightIndex ? 'bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)]' : '',
            isSelected(opt.value) ? 'text-[var(--app-accent)]' : 'text-[var(--app-foreground)]',
          ]"
          @mousedown.prevent="toggleOption(opt)"
          @mouseenter="highlightIndex = i"
        >
          <div class="size-3.5 rounded border flex items-center justify-center shrink-0" :class="isSelected(opt.value) ? 'bg-[var(--app-accent)] border-[var(--app-accent)]' : 'border-[var(--app-border)]'">
            <Icon v-if="isSelected(opt.value)" icon="lucide:check" class="size-2.5 text-white" />
          </div>
          {{ opt.label }}
        </div>
        <div v-if="filteredOptions.length === 0" class="px-3 py-3 text-xs text-[var(--app-muted)] text-center">No results</div>
      </div>
    </Transition>
  </div>
</template>
