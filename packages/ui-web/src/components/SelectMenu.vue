<script setup lang="ts">
/**
 * SelectMenu - Nuxt UI v3 compatible searchable select
 */
import { Icon } from '@iconify/vue'

export interface SelectOption {
  label: string
  value?: string | number | null
  icon?: string
  disabled?: boolean
  description?: string
  type?: string
  [key: string]: unknown
}

export interface SelectGroup {
  label?: string
  items: (SelectOption | string)[]
}

interface DisplayEntry {
  kind: 'header' | 'option'
  label: string
  option?: SelectOption
  // Index into the flat list of selectable options. Only set for 'option' entries.
  optionIndex?: number
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  options?: SelectOption[] | SelectOption[][] | SelectGroup[] | string[]
  items?: SelectOption[] | SelectOption[][] | SelectGroup[] | string[]
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  icon?: string
  variant?: 'outline' | 'soft' | 'none'
  valueAttribute?: string
  valueKey?: string
  optionAttribute?: string
}>(), {
  modelValue: null,
  options: () => [],
  placeholder: 'Select...',
  searchable: false,
  searchPlaceholder: 'Search...',
  size: 'md',
  disabled: false,
  valueAttribute: 'value',
  optionAttribute: 'label',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

function toIconify(name: string) {
  if (name.startsWith('i-')) {
    const stripped = name.slice(2)
    const idx = stripped.indexOf('-')
    if (idx > 0) return stripped.slice(0, idx) + ':' + stripped.slice(idx + 1)
    return stripped
  }
  return name
}

function normalizeOption(opt: SelectOption | string): SelectOption {
  if (typeof opt === 'string') return { label: opt, value: opt }
  return opt
}

// Shape detection: raw can be flat options[], grouped via 2D array [[…],[…]],
// or grouped via { label, items }[]. Returns grouped structure either way.
const groupedSource = computed((): SelectGroup[] => {
  const raw = (props.items && (props.items as unknown[]).length ? props.items : props.options) ?? []
  if (!Array.isArray(raw) || raw.length === 0) return [{ items: [] }]

  // 2D array → each sub-array is a group
  if (Array.isArray(raw[0])) {
    return (raw as (SelectOption | string)[][]).map(group => ({
      items: group,
    }))
  }

  // { label, items } shape → treat as groups when every item has .items
  const first = raw[0] as Record<string, unknown>
  if (first && typeof first === 'object' && Array.isArray((first as { items?: unknown }).items)) {
    return (raw as SelectGroup[]).map(g => ({ label: g.label, items: g.items ?? [] }))
  }

  // Flat list → single unnamed group
  return [{ items: raw as (SelectOption | string)[] }]
})

const hasGroups = computed(() => {
  // Only render group headers when caller explicitly grouped (2D or {label,items}).
  const raw = (props.items && (props.items as unknown[]).length ? props.items : props.options) ?? []
  if (!Array.isArray(raw) || raw.length === 0) return false
  if (Array.isArray(raw[0])) return true
  const first = raw[0] as Record<string, unknown>
  return !!(first && typeof first === 'object' && Array.isArray((first as { items?: unknown }).items))
})

// Flat list of selectable options (used for modelValue lookup and keyboard nav indexing).
const normalizedOptions = computed((): SelectOption[] => {
  const out: SelectOption[] = []
  for (const g of groupedSource.value) {
    for (const it of g.items) out.push(normalizeOption(it))
  }
  return out
})

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

// Display entries, filtered by searchQuery. Preserves group headers for non-empty
// groups only (so a group that filters down to zero matches collapses cleanly).
const displayEntries = computed((): DisplayEntry[] => {
  const q = searchQuery.value.toLowerCase().trim()
  const entries: DisplayEntry[] = []
  let optionIdx = 0
  let groupN = 0
  for (const group of groupedSource.value) {
    const normalized = group.items.map(normalizeOption)
    const filtered = q
      ? normalized.filter(o => o.label.toLowerCase().includes(q))
      : normalized

    // Track optionIdx against the *unfiltered* flat list so it aligns with normalizedOptions.
    // We need the absolute index of each surviving option.
    const groupStartIdx = optionIdx
    optionIdx += normalized.length

    if (filtered.length === 0) {
      groupN += 1
      continue
    }

    if (hasGroups.value) {
      groupN += 1
      entries.push({
        kind: 'header',
        label: group.label ?? `Group ${groupN}`,
      })
    } else {
      groupN += 1
    }

    for (const opt of filtered) {
      // Recover absolute index of this option within normalizedOptions.
      const absoluteIdx = groupStartIdx + normalized.indexOf(opt)
      entries.push({ kind: 'option', label: opt.label, option: opt, optionIndex: absoluteIdx })
    }
  }
  return entries
})

// Indexes of rows that are selectable (skip headers) — used by keyboard nav.
const selectableRowIndexes = computed(() => {
  const out: number[] = []
  displayEntries.value.forEach((e, i) => { if (e.kind === 'option') out.push(i) })
  return out
})

const selectedLabel = computed(() => {
  const opt = normalizedOptions.value.find(o => o.value === props.modelValue)
  return opt?.label || ''
})

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const contentStyle = ref<{ top: string; left: string; minWidth: string }>({ top: '0px', left: '0px', minWidth: '0px' })
// Row index into displayEntries (not into normalizedOptions).
const highlightedRow = ref(-1)

function positionContent() {
  nextTick(() => {
    const triggerEl = triggerRef.value
    const contentEl = contentRef.value
    if (!triggerEl || !contentEl) return
    const rect = triggerEl.getBoundingClientRect()
    const contentRect = contentEl.getBoundingClientRect()
    let top = rect.bottom + 4
    let left = rect.left
    if (top + contentRect.height > window.innerHeight - 8) {
      top = rect.top - contentRect.height - 4
    }
    if (left + contentRect.width > window.innerWidth - 8) {
      left = window.innerWidth - contentRect.width - 8
    }
    if (left < 8) left = 8
    contentStyle.value = { top: `${top}px`, left: `${left}px`, minWidth: `${rect.width}px` }
  })
}

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightedRow.value = -1
    searchQuery.value = ''
    positionContent()
    nextTick(() => {
      document.addEventListener('mousedown', onClickOutside)
      document.addEventListener('keydown', onKeydown)
    })
  } else {
    searchQuery.value = ''
    cleanup()
  }
}

function close() {
  isOpen.value = false
  searchQuery.value = ''
  cleanup()
}

function cleanup() {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
}

function onClickOutside(e: MouseEvent) {
  if (triggerRef.value?.contains(e.target as Node)) return
  if (contentRef.value?.contains(e.target as Node)) return
  close()
}

function moveHighlight(dir: 1 | -1) {
  const selectable = selectableRowIndexes.value
  if (selectable.length === 0) return
  const currentPos = selectable.indexOf(highlightedRow.value)
  let nextPos: number
  if (currentPos === -1) {
    nextPos = dir === 1 ? 0 : selectable.length - 1
  } else {
    nextPos = currentPos + dir
    if (nextPos < 0) nextPos = 0
    if (nextPos > selectable.length - 1) nextPos = selectable.length - 1
  }
  highlightedRow.value = selectable[nextPos]
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveHighlight(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveHighlight(-1)
  } else if (e.key === 'Enter' && highlightedRow.value >= 0) {
    e.preventDefault()
    const entry = displayEntries.value[highlightedRow.value]
    if (entry?.kind === 'option' && entry.option && !entry.option.disabled) {
      selectOption(entry.option)
    }
  }
}

function selectOption(opt: SelectOption) {
  const val = String(opt.value)
  emit('update:modelValue', val)
  emit('change', val)
  close()
}

onUnmounted(cleanup)

const sizeClasses: Record<string, string> = {
  xs: 'px-2 py-0.5 text-xs',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}
</script>

<template>
  <div ref="triggerRef" class="inline-flex w-full">
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'inline-flex items-center justify-between gap-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-background)] text-[var(--app-foreground)]',
        'focus:border-[var(--app-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
      ]"
      @click="toggle"
    >
      <div class="flex items-center gap-2 truncate">
        <Icon v-if="icon" :icon="toIconify(icon)" class="size-4 shrink-0 text-[var(--app-muted)]" />
        <span :class="selectedLabel ? 'text-[var(--app-foreground)]' : 'text-[var(--app-muted)]'">
          {{ selectedLabel || placeholder }}
        </span>
      </div>
      <Icon icon="lucide:chevron-down" class="size-3.5 shrink-0 opacity-50" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="contentRef"
      :style="{ position: 'fixed', ...contentStyle }"
      class="z-[100] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] shadow-xl"
    >
      <div v-if="searchable" class="p-1 border-b border-[var(--app-border)]">
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full px-2 py-1 text-sm bg-transparent outline-none text-[var(--app-foreground)] placeholder:text-[var(--app-muted)]"
          @keydown.arrow-down.prevent="moveHighlight(1)"
          @keydown.arrow-up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="(() => { const e = displayEntries[highlightedRow]; if (e?.kind === 'option' && e.option && !e.option.disabled) selectOption(e.option) })()"
          @keydown.escape.prevent="close"
        />
      </div>
      <div class="p-1 max-h-64 overflow-y-auto">
        <template v-for="(entry, idx) in displayEntries" :key="entry.kind + ':' + idx">
          <div
            v-if="entry.kind === 'header'"
            class="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--app-muted)] select-none"
          >
            {{ entry.label }}
          </div>
          <div
            v-else
            :class="[
              'relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--app-foreground)] outline-none cursor-pointer select-none',
              'hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] hover:text-[var(--app-accent)]',
              idx === highlightedRow ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-accent)]' : '',
              entry.option?.disabled ? 'pointer-events-none opacity-50' : '',
            ]"
            @click="entry.option && !entry.option.disabled && selectOption(entry.option)"
            @mouseenter="highlightedRow = idx"
          >
            <span class="w-5 shrink-0 flex items-center justify-center">
              <Icon v-if="entry.option && String(entry.option.value) === String(modelValue)" icon="lucide:check" class="size-3.5" />
            </span>
            <div class="flex items-center gap-2">
              <Icon v-if="entry.option?.icon" :icon="toIconify(entry.option.icon)" class="size-4 shrink-0" />
              <span>{{ entry.option?.label }}</span>
            </div>
          </div>
        </template>
        <div v-if="displayEntries.length === 0" class="px-3 py-3 text-xs text-[var(--app-muted)] text-center">
          No results
        </div>
      </div>
    </div>
  </Teleport>
</template>
