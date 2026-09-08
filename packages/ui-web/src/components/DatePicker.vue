<script setup lang="ts">
/**
 * DatePicker — Construct UI
 * Input with calendar dropdown for date selection.
 */
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  min?: string
  max?: string
  format?: 'iso' | 'locale'
}>(), {
  modelValue: null,
  placeholder: 'Select date...',
  size: 'md',
  disabled: false,
  format: 'iso',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const open = ref(false)
const viewDate = ref(new Date())

const selectedDate = computed(() => props.modelValue ? new Date(props.modelValue) : null)

const displayValue = computed(() => {
  if (!selectedDate.value) return ''
  return props.format === 'locale'
    ? selectedDate.value.toLocaleDateString()
    : selectedDate.value.toISOString().split('T')[0]
})

const monthYear = computed(() => {
  return viewDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const calendarDays = computed(() => {
  const year = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0
  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6

  const days: { date: Date; current: boolean; disabled: boolean }[] = []

  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, current: false, disabled: true })
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    let disabled = false
    if (props.min && d < new Date(props.min)) disabled = true
    if (props.max && d > new Date(props.max)) disabled = true
    days.push({ date: d, current: true, disabled })
  }

  // Next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    days.push({ date: d, current: false, disabled: true })
  }

  return days
})

function getCalendarDays() {
  return calendarDays.value
}

function isSelected(date: Date): boolean {
  if (!selectedDate.value) return false
  return date.toDateString() === selectedDate.value.toDateString()
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString()
}

function selectDay(day: { date: Date; disabled: boolean }) {
  if (day.disabled) return
  const iso = day.date.toISOString().split('T')[0]
  emit('update:modelValue', iso)
  open.value = false
}

function prevMonth() { viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1, 1) }
function nextMonth() { viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 1) }

function clear() {
  emit('update:modelValue', null)
}

function toggleOpen() {
  if (!props.disabled) {
    open.value = !open.value
  }
}

const sizeClasses: Record<string, string> = { xs: 'py-0.5 text-xs', sm: 'py-1 text-xs', md: 'py-1.5 text-sm', lg: 'py-2 text-base' }
</script>

<template>
  <div class="relative w-full">
    <div
      class="relative inline-flex items-center w-full rounded-md border transition-colors duration-150 overflow-hidden cursor-pointer"
      :class="[
        'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-background)_80%,var(--app-canvas-bg)_20%)]',
        open ? 'border-[var(--app-accent)]' : 'hover:border-[var(--app-muted)]/50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @click="toggleOpen"
    >
      <Icon icon="lucide:calendar" class="ml-2 shrink-0 size-3.5 text-[var(--app-muted)]" />
      <span :class="['flex-1 px-2.5 truncate', sizeClasses[size], modelValue ? 'text-[var(--app-foreground)]' : 'text-[var(--app-muted)]/50']">
        {{ displayValue || placeholder }}
      </span>
      <button v-if="modelValue" class="mr-1 p-0.5 rounded text-[var(--app-muted)] hover:text-[var(--app-foreground)]" @click.stop="clear">
        <Icon icon="lucide:x" class="size-3" />
      </button>
    </div>

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="open" class="absolute z-50 mt-1 w-64 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg p-3" @click.stop>
        <!-- Month navigation -->
        <div class="flex items-center justify-between mb-2">
          <button class="p-1 rounded hover:bg-[var(--app-card-hover)] text-[var(--app-muted)]" @click="prevMonth">
            <Icon icon="lucide:chevron-left" class="size-4" />
          </button>
          <span class="text-sm font-medium text-[var(--app-foreground)]">{{ monthYear }}</span>
          <button class="p-1 rounded hover:bg-[var(--app-card-hover)] text-[var(--app-muted)]" @click="nextMonth">
            <Icon icon="lucide:chevron-right" class="size-4" />
          </button>
        </div>

        <!-- Week day headers -->
        <div class="grid grid-cols-7 gap-0.5 mb-1">
          <div v-for="d in weekDays" :key="d" class="text-center text-[10px] font-medium text-[var(--app-muted)] py-1">{{ d }}</div>
        </div>

        <!-- Days grid -->
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="(day, i) in getCalendarDays()"
            :key="i"
            class="size-8 rounded text-xs transition-colors"
            :class="[
              isSelected(day.date) ? 'bg-[var(--app-accent)] text-[var(--app-accent-foreground)] font-medium' :
              isToday(day.date) && day.current ? 'bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)]' :
              day.current && !day.disabled ? 'text-[var(--app-foreground)] hover:bg-[var(--app-card-hover)]' :
              'text-[var(--app-muted)]/30',
              day.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            ]"
            :disabled="day.disabled"
            @click="selectDay(day)"
          >
            {{ day.date.getDate() }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
